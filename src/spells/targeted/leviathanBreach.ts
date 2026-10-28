import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, chromaPulse, clearCinematic, clearScreenFx, createCinematic, createScreenFx,
  impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Leviathan Breach (targeted ground AoE, radius 5, hero tier, ~11 s cutscene): a whirlpool opens in the ground at
 * the point, a sea serpent bursts out of it inside a toon water column, arcs over the arena in one huge loop (apex
 * ~14.6 m) and crashes head-first onto the target in a crown splash. The rest of the body pours down into the point
 * and the tail slips under last.
 *
 * The serpent is a tube (drawn scale texture) that slides along ONE fixed Catmull-Rom loop: the head leads, every
 * body point follows the same curve, so the whole animation is a function of the head's arc-length position
 * `sHead(t)` and therefore deterministic from time t (scrub-safe). Sections below the ground collapse to radius 0.
 *
 * Camera: scripted with `cinematic` (hard cuts, letterbox in at 1.1-1.5 and out at 9.0-9.6). Every key is fitted
 * from the body's real curve positions at the shot's times (`fitDist`), never guessed.
 *
 * Recipes: jadeDragonAscension (body along a curve + drawn head), genesisCollapse / colossusDrop (cinematic).
 *
 * Timeline: 0 call (whirlpool, haze, beads) | 1.5 breach (cut, low) | 3.5 arc (cut, wide) | 4.7 head close-up (cut) |
 * 5.6 dive tracker (cut) | 6.0 crash (cut, 3/4 behind caster; impact frames, crown, hit) | 7.2 pour (cut, low front;
 * backwash + hit) | 9.0 calm (cut, gameplay camera, letterbox out) | 11 end
 */
export interface LeviathanBreachSettings {
  damage: number;
  loop: boolean;
}

export const defaultLeviathanBreach = (): LeviathanBreachSettings => ({ damage: 80, loop: false });

const DURATION = 11;
const IMPACT = 6.0;
const RADIUS = 5;
const BACKWASH = 7.3;

// Palette (core -> hot -> body -> accent -> dark).
const SEA = 0x4fe0d0;
const TEAL = 0x1d6a74;
const ABYSS = 0x03141c;

const LB = 24; // visible body length behind the neck
const HEAD_LEN = 5.5; // neck base to snout tip
const HEAD_SCALE = 1.15;
const SEG = 110;
const RAD = 12;
const TILE = 5; // world units per scale-texture tile
const SWAY = 0.8;
const DROPS = 150;
const BEADS = 80;
const BIG = 9;
const SMALL = 14;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const UP = new THREE.Vector3(0, 1, 0);

/** The loop in local (u along the right axis, y, w along the plane normal) coordinates. Rises at the left, apex, dives onto (0, 0). */
const LOOP: [number, number, number][] = [
  [-0.2, -40, 0.55], [-0.4, -14, 0.55], [-0.55, -4, 0.55], [-0.6, 0, 0.55], [-1.2, 3.2, 0.45], [-3.0, 7.5, 0.3],
  [-3.6, 11.2, 0.1], [-0.8, 14.0, 0], [3.4, 14.6, -0.1], [7.4, 12.4, -0.2], [8.9, 8.6, -0.35], [6.8, 5.0, -0.5],
  [3.6, 2.7, -0.55], [1.6, 1.1, -0.6], [0, 0, -0.6], [-1.4, -3, -0.6], [-2.2, -14, -0.6], [-2.4, -40, -0.6],
];

// --- Small helpers ----------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Monotone cubic (Fritsch-Carlson) through (ts, fs): smooth, never overshoots, so the head never runs backwards. */
class Mono {
  private m: number[] = [];
  constructor(private ts: number[], private fs: number[]) {
    const n = ts.length;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((fs[i + 1] - fs[i]) / (ts[i + 1] - ts[i]));
    const m = new Array<number>(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
    }
    this.m = m;
  }

  at(x: number): number {
    const { ts, fs, m } = this;
    const n = ts.length;
    if (x <= ts[0]) return fs[0];
    if (x >= ts[n - 1]) return fs[n - 1];
    let i = 0;
    while (i < n - 2 && ts[i + 1] <= x) i++;
    const h = ts[i + 1] - ts[i];
    const t = (x - ts[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * fs[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * fs[i + 1] + (t3 - t2) * h * m[i + 1];
  }
}

/** Distance from `target` along `dir` (unit, pointing to the camera) so every point sits inside the frame (letterbox included). */
function fitDist(target: THREE.Vector3, dir: THREE.Vector3, fov: number, pts: THREE.Vector3[]): number {
  const fwd = dir.clone().negate();
  const rt = new THREE.Vector3().crossVectors(fwd, UP);
  if (rt.lengthSq() < 1e-6) rt.set(1, 0, 0);
  rt.normalize();
  const up = new THREE.Vector3().crossVectors(rt, fwd);
  const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tvEff = tv * 0.72; // the letterbox keeps ~75% of the height
  const th = tv * 1.5;
  const margin = 0.88;
  let D = 0;
  for (const p of pts) {
    const rel = p.clone().sub(target);
    const x = Math.abs(rel.dot(rt)), y = Math.abs(rel.dot(up)), z = rel.dot(fwd);
    D = Math.max(D, x / (th * margin) - z, y / (tvEff * margin) - z, 2.5 - z);
  }
  return D;
}

// --- Drawn textures ---------------------------------------------------------------------------------------

/** Overlapping crescent scales in teal with dark outlines, a pale belly band and a gold dorsal stripe (u = along the body, v = round it). */
function scaleTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 256, (g) => {
    const W = 256, H = 256, sw = 32, sh = 32;
    g.fillStyle = '#0c3a44';
    g.fillRect(0, 0, W, H);
    for (let row = -1; row <= 8; row++) {
      for (let col = 8; col >= -1; col--) {
        const x = col * sw + (((row % 2) + 2) % 2 ? sw / 2 : 0), y = row * sh + sh / 2;
        const v = ((y % H) + H) % H / H;
        const belly = Math.abs(v - 0.5) < 0.2;
        const k = (((row * 3 + col) % 3) + 3) % 3;
        const body = belly ? ['#6fb8aa', '#7cc4b4', '#62ac9f'][k] : ['#1d6a74', '#23788a', '#175862'][k];
        g.beginPath();
        g.arc(x, y, 19, 0, Math.PI * 2);
        g.fillStyle = body;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = belly ? '#1d6a74' : '#03141c';
        g.stroke();
        g.beginPath();
        g.arc(x, y, 13, Math.PI * 1.1, Math.PI * 1.9);
        g.lineWidth = 3;
        g.strokeStyle = belly ? '#b8e8dc' : '#3fa8a8';
        g.stroke();
      }
    }
    // Gold dorsal stripe on the wrap edge (v = 0 and v = 1).
    for (const y0 of [0, H - 9]) {
      g.fillStyle = '#8a6420';
      g.fillRect(0, y0, W, 9);
      g.fillStyle = '#03141c';
      g.fillRect(0, y0 === 0 ? 9 : y0 - 3, W, 3);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The ground whirlpool: dark abyss centre and four thick teal spiral arms with black outlines and foam ticks. */
function whirlpoolTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 1024, (g) => {
    const c = 512;
    const base = g.createRadialGradient(c, c, 0, c, c, 500);
    base.addColorStop(0, 'rgba(3,20,28,1)');
    base.addColorStop(0.55, 'rgba(3,20,28,0.92)');
    base.addColorStop(0.9, 'rgba(6,40,50,0.6)');
    base.addColorStop(1, 'rgba(6,40,50,0)');
    g.fillStyle = base;
    g.fillRect(0, 0, 1024, 1024);
    const N = 70;
    for (let k = 0; k < 4; k++) {
      const pt = (j: number) => {
        const p = j / N;
        const a = p * Math.PI * 2.3 + (k * Math.PI) / 2;
        const r = 70 + 400 * Math.pow(p, 0.9);
        return [c + Math.cos(a) * r, c + Math.sin(a) * r, 8 + 40 * (1 - p)] as const;
      };
      for (const pass of [0, 1, 2]) {
        for (let j = 1; j <= N; j++) {
          const a = pt(j - 1), b = pt(j);
          g.beginPath();
          g.moveTo(a[0], a[1]);
          g.lineTo(b[0], b[1]);
          g.lineWidth = pass === 0 ? b[2] + 14 : pass === 1 ? b[2] : b[2] * 0.28;
          g.strokeStyle = pass === 0 ? '#03141c' : pass === 1 ? '#1f8a8e' : '#4fe0d0';
          g.stroke();
        }
      }
      // Foam ticks along the outer edge of the arm.
      for (let j = 6; j < N; j += 7) {
        const a = pt(j), b = pt(j + 1);
        const nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1;
        g.beginPath();
        g.moveTo(a[0] + (nx / nl) * a[2] * 0.5, a[1] + (ny / nl) * a[2] * 0.5);
        g.lineTo(b[0] + (nx / nl) * b[2] * 0.7, b[1] + (ny / nl) * b[2] * 0.7);
        g.lineWidth = 6;
        g.strokeStyle = '#cffaf4';
        g.stroke();
      }
    }
    const hole = g.createRadialGradient(c, c, 0, c, c, 90);
    hole.addColorStop(0, 'rgba(0,6,10,1)');
    hole.addColorStop(1, 'rgba(0,6,10,0)');
    g.fillStyle = hole;
    g.fillRect(0, 0, 1024, 1024);
  });
}

/** A wet, dark ring decal with two ripple lines and a hard outer edge. */
function wetTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = 'rgba(3,20,28,0.72)';
    g.beginPath();
    g.arc(256, 256, 246, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    const hole = g.createRadialGradient(256, 256, 70, 256, 256, 130);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hole;
    g.fillRect(0, 0, 512, 512);
    g.globalCompositeOperation = 'source-over';
    for (const [r, a] of [[222, 0.8], [180, 0.55]]) {
      g.beginPath();
      g.arc(256, 256, r, 0, Math.PI * 2);
      g.lineWidth = 4;
      g.strokeStyle = `rgba(31,138,142,${a})`;
      g.stroke();
    }
  });
}

/** A water sheet (soft alpha): dark teal base fading up through translucent teal to a soft foam band at the tip. No outline, no hard bands. */
function bladeTexture(body: string, mid: string, tip: string): THREE.CanvasTexture {
  return canvasTexture(128, 256, (g) => {
    g.beginPath();
    g.moveTo(2, 256);
    g.bezierCurveTo(0, 150, 30, 60, 100, 6);
    g.bezierCurveTo(92, 70, 142, 160, 126, 256);
    g.closePath();
    const gr = g.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, body);
    gr.addColorStop(0.55, mid);
    gr.addColorStop(0.82, mid);
    gr.addColorStop(1, tip);
    g.fillStyle = gr;
    g.fill();
  });
}

/** Column shell: tall hard-edged water spears, pale only near the top. */
function shellTexture(seed: number, body: string, light: string): THREE.CanvasTexture {
  const tex = canvasTexture(256, 512, (g) => {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const n = 22;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 256 + (rnd() - 0.5) * 6;
      const w = 12 + rnd() * 12;
      const top = 6 + rnd() * 130;
      g.beginPath();
      g.moveTo(x - w, 512);
      g.lineTo(x + w, 512);
      g.lineTo(x + w * 0.2, top);
      g.closePath();
      g.fillStyle = body;
      g.fill();
      g.beginPath();
      g.moveTo(x - w * 0.35, 512);
      g.lineTo(x + w * 0.35, 512);
      g.lineTo(x + w * 0.1, top + 14);
      g.closePath();
      g.fillStyle = light;
      g.fill();
      g.beginPath();
      g.moveTo(x - w * 0.45, top + 100);
      g.lineTo(x + w * 0.5, top + 80);
      g.lineTo(x + w * 0.2, top);
      g.closePath();
      g.fillStyle = '#cffaf4';
      g.fill();
      g.beginPath();
      g.moveTo(x + w * 0.3, top + 40);
      g.lineTo(x + w * 1.6, top + 22);
      g.lineTo(x + w * 0.4, top + 70);
      g.closePath();
      g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function eyeTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.beginPath();
    g.ellipse(64, 64, 58, 36, -0.2, 0, Math.PI * 2);
    g.fillStyle = '#ffcf5a';
    g.fill();
    g.lineWidth = 9;
    g.strokeStyle = '#03141c';
    g.stroke();
    g.beginPath();
    g.ellipse(68, 64, 8, 31, -0.2, 0, Math.PI * 2);
    g.fillStyle = '#03141c';
    g.fill();
  });
}

// --- Geometry ---------------------------------------------------------------------------------------------

/** Extrudes a side profile (x forward, y up) and tapers its width along x (z is the width axis). */
function taperedExtrude(shape: THREE.Shape, depth: number, bevel: number, wOf: (x: number) => number): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * wOf(p.getX(i)));
  g.computeVertexNormals();
  return g;
}

function flatShape(pts: [number, number][], curved: [number, number, number, number][] | null = null): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  void curved;
  s.closePath();
  return s;
}

const dorsalShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(1.0, 0);
  s.quadraticCurveTo(0.5, 1.1, -1.1, 2.0);
  s.quadraticCurveTo(-0.7, 1.0, -1.5, 0);
  s.closePath();
  return s;
})();

const spineShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.35, 0);
  s.quadraticCurveTo(0.1, 0.8, -0.55, 1.6);
  s.quadraticCurveTo(-0.2, 0.7, -0.55, 0);
  s.closePath();
  return s;
})();

const flukeShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.3, 0);
  s.quadraticCurveTo(-0.8, 0.9, -3.0, 2.2);
  s.quadraticCurveTo(-1.9, 0.8, -2.1, 0);
  s.quadraticCurveTo(-1.9, -0.8, -3.0, -2.2);
  s.quadraticCurveTo(-0.8, -0.9, 0.3, 0);
  s.closePath();
  return s;
})();

/** A fin: a gold plate with a smaller teal plate through it, so a gold edge frames the teal. */
class FinKind {
  private gold: THREE.BufferGeometry;
  private teal: THREE.BufferGeometry;

  constructor(shape: THREE.Shape, depth: number, inset = 0.8, cx = 0, cy = 0) {
    this.gold = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -depth / 2);
    this.teal = new THREE.ExtrudeGeometry(shape, { depth: depth * 2.4, bevelEnabled: false, curveSegments: 8 })
      .translate(0, 0, -depth * 1.2).translate(-cx, -cy, 0).scale(inset, inset, 1).translate(cx, cy, 0);
  }

  make(goldMat: THREE.Material, tealMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.gold, goldMat), new THREE.Mesh(this.teal, tealMat));
    g.visible = false;
    return g;
  }
}

// --- The head ---------------------------------------------------------------------------------------------

/**
 * A sea dragon head built from shapes (x forward, y up, z across, neck at x = 0): a tapered wedge skull, a hinged
 * lower jaw, a dark mouth cavity with fangs, a crest fin, swept-back horns, cheek frills and gold slit eyes.
 */
class SeaHead {
  readonly group = new THREE.Group();
  private jaw = new THREE.Group();
  private cavity: THREE.Mesh;
  private cavPos = new Float32Array(9);
  private eyeMat: THREE.MeshBasicMaterial;

  constructor(skin: THREE.Material, goldMat: THREE.Material) {
    const inner = new THREE.Group();
    inner.scale.setScalar(HEAD_SCALE);
    this.group.add(inner);
    const ivory = new THREE.MeshStandardMaterial({ color: 0xcfe6df, roughness: 0.5, metalness: 0, emissive: 0x3a5a54, emissiveIntensity: 0.4 });
    const tealFin = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.45, metalness: 0.1, emissive: 0x0c3a44, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const wSkull = (x: number) => (x < 1.4 ? 1 : lerp(1, 0.55, clamp((x - 1.4) / 3.4, 0, 1)));
    const wJaw = (x: number) => lerp(0.95, 0.4, clamp(x / 3.3, 0, 1));

    // Upper skull.
    const sk = new THREE.Shape();
    sk.moveTo(0, -1.15);
    sk.lineTo(0, 1.15);
    sk.quadraticCurveTo(0.5, 1.65, 1.3, 1.8);
    sk.quadraticCurveTo(2.0, 1.95, 2.4, 1.45);
    sk.quadraticCurveTo(3.2, 1.05, 4.2, 0.85);
    sk.quadraticCurveTo(4.7, 0.85, 4.95, 0.62);
    sk.quadraticCurveTo(5.1, 0.4, 4.9, 0.2);
    sk.quadraticCurveTo(4.7, 0.05, 4.2, 0.08);
    sk.lineTo(1.2, 0);
    sk.lineTo(0.6, -0.4);
    sk.closePath();
    inner.add(new THREE.Mesh(taperedExtrude(sk, 2.0, 0.12, wSkull), skin));

    // Lower jaw (hinged at (1.0, -0.05)).
    const jw = new THREE.Shape();
    jw.moveTo(-0.7, 0.1);
    jw.lineTo(3.3, 0);
    jw.quadraticCurveTo(3.55, -0.15, 3.3, -0.4);
    jw.quadraticCurveTo(2.0, -0.78, 0.6, -0.9);
    jw.quadraticCurveTo(-0.3, -0.85, -0.8, -0.45);
    jw.closePath();
    this.jaw.position.set(1.0, -0.05, 0);
    this.jaw.add(new THREE.Mesh(taperedExtrude(jw, 1.2, 0.08, (x) => wJaw(x)), skin));
    inner.add(this.jaw);

    // Mouth cavity (a dark wedge between the lip and the jaw, updated with the jaw angle).
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(this.cavPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.cavity = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: ABYSS, side: THREE.DoubleSide }));
    this.cavity.frustumCulled = false;
    inner.add(this.cavity);

    // Fangs: upper row hangs from the lip line, lower row stands on the jaw; two long tusks at the front.
    const fang = (r: number, h: number) => new THREE.ConeGeometry(r, h, 6);
    const upFang = fang(0.1, 0.55).rotateX(Math.PI).translate(0, -0.27, 0);
    const loFang = fang(0.1, 0.5).translate(0, 0.25, 0);
    for (const sgn of [-1, 1]) {
      [[4.15, 1.5], [3.5, 1.0], [2.8, 0.9], [2.1, 0.8]].forEach(([x, sc]) => {
        const f = new THREE.Mesh(upFang, ivory);
        f.position.set(x, 0.06, sgn * 0.5 * wSkull(x) * 0.95);
        f.scale.setScalar(sc);
        inner.add(f);
      });
      [[2.9, 1.0], [2.1, 0.9], [1.3, 0.8]].forEach(([x, sc]) => {
        const f = new THREE.Mesh(loFang, ivory);
        f.position.set(x, 0.04, sgn * 0.45 * wJaw(x) * 0.95);
        f.scale.setScalar(sc);
        this.jaw.add(f);
      });
    }

    // Crest fin along the skull (spiky), swept horns and cheek frills.
    const crest = new FinKind(flatShape([[4.0, 0.8], [3.4, 1.7], [3.0, 1.0], [2.4, 2.1], [1.9, 1.3], [1.2, 2.3], [0.6, 1.3], [-0.4, 1.4], [-0.6, 0.6]]), 0.1, 0.8, 1.5, 0.9);
    const crestG = crest.make(goldMat, tealFin);
    crestG.visible = true;
    crestG.position.y = 0.4;
    inner.add(crestG);
    const hornShape = new THREE.Shape();
    hornShape.moveTo(0.4, 0.3);
    hornShape.quadraticCurveTo(-0.6, 2.4, -4.2, 3.5);
    hornShape.quadraticCurveTo(-1.7, 1.4, -0.7, -0.3);
    hornShape.closePath();
    const frillShape = flatShape([[0.6, 0.3], [-0.8, 2.3], [-0.9, 1.2], [-2.4, 1.9], [-1.9, 0.6], [-3.3, 0.4], [-1.4, -0.3], [0.6, -0.2]]);
    const horn = new FinKind(hornShape, 0.12, 0.78, -0.8, 0.3);
    const frill = new FinKind(frillShape, 0.08, 0.8, -1, 0.7);
    for (const sgn of [-1, 1]) {
      const h = horn.make(goldMat, tealFin);
      h.visible = true;
      h.position.set(1.6, 1.45, sgn * 0.65);
      h.rotation.x = -sgn * 0.35;
      inner.add(h);
      const f = frill.make(goldMat, tealFin);
      f.visible = true;
      f.position.set(1.1, 0.1, sgn * 0.72);
      f.rotation.y = sgn * 0.6;
      inner.add(f);
    }

    // Gold slit eyes: the only bright spot of the serpent.
    this.eyeMat = new THREE.MeshBasicMaterial({ map: eyeTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const socketMat = new THREE.MeshBasicMaterial({ color: ABYSS, side: THREE.DoubleSide });
    for (const sgn of [-1, 1]) {
      const x = 2.2;
      const zz = sgn * (1.0 * wSkull(x) + 0.1);
      const yaw = sgn > 0 ? 0.2 : Math.PI - 0.2;
      const sock = new THREE.Mesh(new THREE.CircleGeometry(0.78, 20), socketMat);
      sock.scale.set(1.25, 0.8, 1);
      sock.position.set(x, 0.92, zz + sgn * 0.01);
      sock.rotation.y = yaw;
      inner.add(sock);
      const e = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), this.eyeMat);
      e.position.set(x, 0.92, zz + sgn * 0.03);
      e.rotation.y = yaw;
      inner.add(e);
    }
    this.pose(0.1, 1);
  }

  /** Jaw angle in radians (0 = shut) and the eye glow multiplier (above ~1.3 it blooms). */
  pose(open: number, glow: number) {
    this.jaw.rotation.z = -open;
    this.eyeMat.color.setScalar(glow);
    const a = this.cavPos;
    a.set([1.0, -0.05, 0, 4.2, 0.06, 0, 1.0 + 3.3 * Math.cos(open), -0.05 - 3.3 * Math.sin(open), 0]);
    this.cavity.geometry.attributes.position.needsUpdate = true;
  }
}

// --- The effect -------------------------------------------------------------------------------------------

interface HeadPose {
  neck: THREE.Vector3;
  f: THREE.Vector3;
  u: THREE.Vector3;
  s: THREE.Vector3;
  tip: THREE.Vector3;
}

const newPose = (): HeadPose => ({ neck: v3(), f: v3(), u: v3(), s: v3(), tip: v3() });

export class LeviathanBreach implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LeviathanBreachSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private crashed = false;
  private backwashed = false;
  private mistDone = false;
  private keys: ShotKey[] = [];

  // Cast geometry. latW is the loop's plane normal (towards the caster), right the loop's horizontal axis.
  private C = v3();
  private P0 = v3(0, 0, 12);
  private fwd = v3(0, 0, -1);
  private right = v3(1, 0, 0);
  private latW = v3(0, 0, 1);

  // The loop and the head's arc-length track.
  private curve!: THREE.CatmullRomCurve3;
  private pathLen = 1;
  private sA = 0;
  private S = 1;
  private track!: Mono;

  // Serpent.
  private bodyGeo = new THREE.BufferGeometry();
  private bodyPos = new Float32Array((SEG + 1) * (RAD + 1) * 3);
  private bodyNrm = new Float32Array((SEG + 1) * (RAD + 1) * 3);
  private bodyMesh: THREE.Mesh;
  private bp: THREE.Vector3[] = Array.from({ length: SEG + 1 }, () => v3());
  private bT = v3();
  private bU: THREE.Vector3[] = Array.from({ length: SEG + 1 }, () => v3());
  private bS: THREE.Vector3[] = Array.from({ length: SEG + 1 }, () => v3());
  private bT2: THREE.Vector3[] = Array.from({ length: SEG + 1 }, () => v3());
  private bR: number[] = new Array(SEG + 1).fill(0);
  private head: SeaHead;
  private hp = newPose();
  private hpC = newPose();
  private colRings: ReturnType<typeof createRing>[] = [];
  private finGroup = new THREE.Group();
  private fins: { g: THREE.Group; i: number; size: number; kind: 'plate' | 'spine' | 'fluke' }[] = [];

  // Ground.
  private floorDisc: THREE.Mesh;
  private whirlG = new THREE.Group();
  private whirl: THREE.Mesh;
  private wet: THREE.Mesh;
  private callRings: ReturnType<typeof createRing>[] = [];
  private crashRing = createRing(SEA, 0.88, 1, 96);
  private crashRing2 = createRing(0x8fe8e0, 0.93, 1, 96);
  private backRing = createRing(SEA, 0.9, 1, 96);
  private beadGeo = new THREE.BufferGeometry();
  private beadPos = new Float32Array(BEADS * 3);
  private beadSeed = Array.from({ length: BEADS }, () => ({
    a: Math.random() * Math.PI * 2, r: Math.random() * 3.8, s: 0.25 + Math.random() * 0.35, o: Math.random(),
  }));
  private beadMat = new THREE.PointsMaterial({
    size: 0.2, map: softDotTexture(), color: 0xbff6f0, transparent: true, opacity: 0, depthWrite: false,
  });
  private beads: THREE.Points;

  // Water column.
  private shells: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.CanvasTexture; r: number; spin: number; scroll: number }[] = [];

  // Droplets shed by the body.
  private dropGeo = new THREE.BufferGeometry();
  private dropPos = new Float32Array(DROPS * 3);
  private dropSeed = Array.from({ length: DROPS }, () => ({
    d: Math.random() * LB, ph: Math.random(), per: 1.0 + Math.random() * 0.6,
    v: v3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(2.6),
  }));
  private dropMat = new THREE.PointsMaterial({
    size: 0.26, map: softDotTexture(), color: 0xbff6f0, transparent: true, opacity: 0.85, depthWrite: false,
  });
  private drops: THREE.Points;

  // Crash.
  private haze = new HeatHaze({ width: 9, height: 18, scale: 3 });
  private shock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shock2 = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private crown: { mesh: THREE.InstancedMesh; seeds: { a: number; h: number; w: number; r0: number; lean: number; lag: number }[] }[] = [];

  private spray: Emitter;
  private foam: Emitter;
  private mist: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpS = v3();

  constructor(settings: LeviathanBreachSettings = defaultLeviathanBreach()) {
    this.settings = settings;
    this.screen.tint.set(0x0d3a46);
    this.screen.impactColor.set(SEA);
    this.screen.edgeTint.set(SEA);
    this.screen.speedLineColor.set(0xcffaf4);

    this.buildPath();

    // Body tube.
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const uv = new Float32Array((SEG + 1) * (RAD + 1) * 2);
    for (let i = 0; i <= SEG; i++) {
      for (let j = 0; j <= RAD; j++) {
        const o = (i * (RAD + 1) + j) * 2;
        uv[o] = ((i / SEG) * LB) / TILE;
        uv[o + 1] = j / RAD;
      }
    }
    this.bodyGeo.setAttribute('position', new THREE.BufferAttribute(this.bodyPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.bodyGeo.setAttribute('normal', new THREE.BufferAttribute(this.bodyNrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.bodyGeo.setIndex(idx);
    const scales = scaleTexture();
    const skin = new THREE.MeshStandardMaterial({
      map: scales, emissiveMap: scales, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.35, metalness: 0.12, side: THREE.DoubleSide,
    });
    this.bodyMesh = new THREE.Mesh(this.bodyGeo, skin);
    this.bodyMesh.frustumCulled = false;
    this.bodyMesh.visible = false;
    this.group.add(this.bodyMesh);

    // Head, fins.
    const goldMat = new THREE.MeshStandardMaterial({ color: 0x7a5c1e, roughness: 0.75, metalness: 0.35, emissive: 0x1a1204, emissiveIntensity: 0.15, side: THREE.DoubleSide });
    const skinHead = new THREE.MeshStandardMaterial({
      color: 0x1f7a84, roughness: 0.38, metalness: 0.15, emissive: 0x0c3a44, emissiveIntensity: 0.6,
    });
    this.head = new SeaHead(skinHead, goldMat);
    this.head.group.visible = false;
    this.group.add(this.head.group);
    const tealFin = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.45, metalness: 0.1, emissive: 0x0c3a44, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const plate = new FinKind(dorsalShape, 0.09, 0.8, -0.2, 0);
    const spine = new FinKind(spineShape, 0.08, 0.78, -0.1, 0);
    const fluke = new FinKind(flukeShape, 0.1, 0.8, -1.2, 0);
    ([[6.5, 1.7], [10.5, 1.9], [14.5, 1.6], [18.5, 1.2]] as const).forEach(([d, size]) => {
      this.fins.push({ g: plate.make(goldMat, tealFin), i: Math.round((d / LB) * SEG), size, kind: 'plate' });
    });
    ([[0.9, 1.0], [1.8, 1.15], [2.7, 1.05], [3.6, 0.95], [4.5, 0.85]] as const).forEach(([d, size]) => {
      this.fins.push({ g: spine.make(goldMat, tealFin), i: Math.round((d / LB) * SEG), size, kind: 'spine' });
    });
    this.fins.push({ g: fluke.make(goldMat, tealFin), i: SEG, size: 1.0, kind: 'fluke' });
    for (const f of this.fins) this.finGroup.add(f.g);
    this.group.add(this.finGroup);

    // Ground: dark disc, whirlpool, wet ring, foam rings, beads.
    this.floorDisc = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS + 0.5, 64),
      new THREE.MeshBasicMaterial({ color: ABYSS, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    this.floorDisc.rotation.x = -Math.PI / 2;
    this.whirl = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ map: whirlpoolTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.whirl.rotation.x = -Math.PI / 2;
    this.whirlG.add(this.whirl);
    this.wet = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: wetTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    this.wet.rotation.x = -Math.PI / 2;
    this.group.add(this.floorDisc, this.whirlG, this.wet);
    for (let k = 0; k < 3; k++) {
      const r = createRing(SEA, 0.9, 1, 96);
      this.callRings.push(r);
      this.group.add(r.mesh);
    }
    this.group.add(this.crashRing.mesh, this.crashRing2.mesh, this.backRing.mesh);
    this.beadGeo.setAttribute('position', new THREE.BufferAttribute(this.beadPos, 3));
    this.beads = new THREE.Points(this.beadGeo, this.beadMat);
    this.beads.frustumCulled = false;
    this.group.add(this.beads);

    // Water column: three nested toon shells.
    const shellDefs: [number, number, string, string, number, number, number][] = [
      [1.0, 0x8ff0e6, '#2a9d9a', '#4fe0d0', 11, 0.7, 1.1],
      [0.7, 0xffffff, '#1d6a74', '#3fc4b8', 23, -1.0, 1.5],
      [0.45, 0x2a8c94, '#0c3a44', '#1f8a8e', 37, 1.4, 1.9],
    ];
    for (const [r, color, body, light, seed, spin, scroll] of shellDefs) {
      const tex = shellTexture(seed, body, light);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, color, transparent: true, alphaTest: 0.3, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1, 1, 28, 1, true).translate(0, 0.5, 0), mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.shells.push({ mesh, mat, tex, r, spin, scroll });
      this.group.add(mesh);
    }

    for (let k = 0; k < 5; k++) {
      const r = createRing(0xcffaf4, 0.9, 1, 48);
      this.colRings.push(r);
      this.group.add(r.mesh);
    }
    // Droplets shed by the body.
    this.dropGeo.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    this.drops = new THREE.Points(this.dropGeo, this.dropMat);
    this.drops.frustumCulled = false;
    this.group.add(this.drops);

    // Crown splash blades (instanced alpha-cutout planes).
    const bladeGeo = new THREE.PlaneGeometry(1, 1, 6, 14).translate(0, 0.5, 0);
    {
      // Smooth curl: the sheet leans outward (local +z) and its top rolls over and down.
      const bp = bladeGeo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const y = bp.getY(i);
        bp.setZ(i, 0.8 * y * y + 0.7 * y * y * y * y);
        bp.setY(i, y - 0.28 * y * y * y);
        bp.setX(i, bp.getX(i) * (1 - 0.3 * y));
      }
      bladeGeo.computeVertexNormals();
    }
    const crownDefs: [number, number, number, string, string, string][] = [
      [BIG, 5, 4, '#0f5a63', '#2fb8b0', '#a8e8e0'],
      [SMALL, 1.2, 1.3, '#0f5a63', '#2fb8b0', '#a8e8e0'],
    ];
    for (const [n, h0, hv, body, mid, tip] of crownDefs) {
      const mat = new THREE.MeshBasicMaterial({
        map: bladeTexture(body, mid, tip), transparent: true, alphaTest: 0.05, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(bladeGeo, mat, n);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      const seeds = Array.from({ length: n }, (_, i) => ({
        a: (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25, h: h0 + Math.random() * hv, w: (h0 > 3 ? 2.6 : 2.2) + Math.random() * 0.8,
        r0: (h0 > 3 ? 1.4 : 3.2) + Math.random() * 0.8, lean: Math.random(), lag: Math.random(),
      }));
      this.crown.push({ mesh, seeds });
      this.group.add(mesh);
    }

    this.group.add(this.haze.mesh, this.shock.mesh, this.shock2.mesh);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.spray = em({
      maxParticles: 900, lifetime: 1.0, lifetimeJitter: 0.5, shapeSize: 0.5, speed: 10, speedJitter: 0.6, spread: 80, gravity: 9, drag: 0.8,
      sizeStart: 0.24, sizeEnd: 0.05, colorStart: '#cffaf4', colorEnd: '#4fe0d0', opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.4,
    });
    this.foam = em({
      maxParticles: 300, lifetime: 1.6, lifetimeJitter: 0.4, shapeSize: 1.8, speed: 3.5, speedJitter: 0.6, spread: 85, gravity: -0.2, drag: 1.4,
      sizeStart: 1.1, sizeEnd: 2.6, colorStart: '#8fe8e0', colorEnd: '#1d6a74', opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.mist = em({
      maxParticles: 220, lifetime: 3.0, lifetimeJitter: 0.4, shapeSize: 3.2, speed: 1.8, speedJitter: 0.6, spread: 85, gravity: -0.08, drag: 1.2,
      sizeStart: 1.6, sizeEnd: 3.6, colorStart: '#2a6a74', colorEnd: '#03141c', opacityStart: 0.32, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.3,
      groundFade: 0.3,
    });

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT;
  }

  // --- Cast, path and camera keys -----------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.C.copy(ctx.point).setY(0);
    this.P0.copy(ctx.from).setY(0);
    this.fwd.copy(this.C).sub(this.P0).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.latW.copy(this.fwd).negate();
    this.buildPath();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.head.group, this.bodyMesh, this.finGroup];
    this.buildKeys();
    this.reset();
  }

  /** Builds the world-space loop from the local control points and finds the entry (sA) and crash (sC) arc lengths. */
  private buildPath() {
    const pts = LOOP.map(([u, y, w]) => this.C.clone().addScaledVector(this.right, u).addScaledVector(UP, y).addScaledVector(this.latW, w));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve.arcLengthDivisions = 1600;
    this.curve.updateArcLengths();
    this.pathLen = this.curve.getLength();
    // Scan the arc: first upward crossing of y = 0 (entry), apex, then the downward crossing (crash).
    const p = v3();
    let apexS = 0, apexY = -Infinity;
    for (let s = 0; s <= this.pathLen; s += 0.05) {
      this.curve.getPointAt(s / this.pathLen, p);
      if (p.y > apexY) { apexY = p.y; apexS = s; }
    }
    let sA = 0, sC = this.pathLen;
    for (let s = 0.05; s <= this.pathLen; s += 0.02) {
      this.curve.getPointAt(s / this.pathLen, p);
      if (!sA && p.y >= 0) sA = s;
      if (sA && s > apexS && p.y <= 0) { sC = s; break; }
    }
    this.sA = sA;
    this.S = Math.max(1, sC - sA);
    const fa = (apexS - sA) / this.S;
    const r = LB / this.S;
    this.track = new Mono(
      [0, 1.5, 1.9, 2.6, 3.5, 4.2, 4.7, 5.4, 5.7, 6.0, 7.2, 9.0, 11.0],
      [-0.03, 0, 0.18 * fa, 0.38 * fa, 0.64 * fa, 0.88 * fa, 1.03 * fa, Math.min(1.14 * fa, 0.62), 0.7, 1, 1 + 0.45 * r, 1 + r, 1 + r],
    );
  }

  /** Head-tip arc-length position at time t. */
  private sHead(t: number): number {
    return this.sA + this.S * this.track.at(t);
  }

  private pathAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    const L = this.pathLen;
    if (s <= 0 || s >= L) {
      const e = s <= 0 ? 0 : 1;
      this.curve.getPointAt(e, out);
      this.curve.getTangentAt(e, this.tmpS);
      return out.addScaledVector(this.tmpS, s <= 0 ? s : s - L);
    }
    return this.curve.getPointAt(s / L, out);
  }

  private tangentAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    return this.curve.getTangentAt(clamp(s / this.pathLen, 0, 1), out);
  }

  /** Head frame at time t: neck base, forward, dorsal up and side axes, snout tip. The head turns to the target on the way down. */
  private headPose(t: number, o: HeadPose) {
    const sN = this.sHead(t) - HEAD_LEN;
    this.pathAt(sN, o.neck);
    this.tangentAt(sN, o.f);
    const turn = Math.max(0.85 * ss(4.2, 5.1, t), ss(5.3, 5.6, t)) * (1 - ss(6.6, 6.9, t));
    if (turn > 0) {
      this.tmpA.copy(this.C).y += 0.2;
      this.tmpA.sub(o.neck).normalize();
      o.f.lerp(this.tmpA, turn).normalize();
    }
    o.u.crossVectors(this.latW, this.tangentAt(sN, this.tmpB)).normalize();
    o.u.addScaledVector(o.f, -o.u.dot(o.f)).normalize();
    o.s.crossVectors(o.f, o.u);
    o.tip.copy(o.neck).addScaledVector(o.f, HEAD_LEN);
  }

  private bodyPts(t: number, step = 3): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const hp = newPose();
    this.headPose(t, hp);
    pts.push(hp.tip.clone());
    pts.push(hp.neck.clone());
    const sN = this.sHead(t) - HEAD_LEN;
    for (let d = 0; d <= LB; d += step) {
      const p = this.pathAt(sN + 0.5 - d, v3());
      if (p.y > -0.3) pts.push(p);
    }
    return pts;
  }

  private ptsAt(times: number[], extra: THREE.Vector3[] = [], step = 3): THREE.Vector3[] {
    const out: THREE.Vector3[] = [...extra];
    for (const t of times) out.push(...this.bodyPts(t, step));
    return out;
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, back = this.latW, right = this.right;
    const dirOf = (b: number, r: number, y: number) => v3().addScaledVector(back, b).addScaledVector(right, r).addScaledVector(UP, y).normalize();
    /** A key looking at the box centre of `pts` from `dir`, backed off until every point fits. */
    const fit = (t: number, dir: THREE.Vector3, fov: number, pts: THREE.Vector3[], minD: number, o: { cut?: boolean; ease?: ShotKey['ease']; scale?: number } = {}) => {
      const target = new THREE.Box3().setFromPoints(pts).getCenter(v3());
      const dist = Math.max(minD, fitDist(target, dir, fov, pts)) * (o.scale ?? 1);
      const position = target.clone().addScaledVector(dir, dist);
      if (position.y < 0.8) position.y = 0.8;
      keys.push({ t, position, target, fov, roll: 0, cut: o.cut, ease: o.ease });
    };
    const ring = [this.C.clone(), C.clone().addScaledVector(right, RADIUS), C.clone().addScaledVector(right, -RADIUS)];

    // 1. Call: gameplay-like three-quarter view behind the caster (letterbox eases in at the end).
    const gp = dirOf(0.62, 0.55, 0.5);
    const gpPts = [this.P0.clone().setY(1.8), ...ring, C.clone().setY(3), ...(this.ctx?.targetPos ?? [])];
    fit(0, gp, 42, gpPts, 12, { cut: true });
    fit(1.5 - 0.001, gp, 42, gpPts, 12, { ease: 'linear', scale: 0.96 });

    // 2. Breach: low angle beside the whirlpool, looking up the water column as the head climbs.
    const lowDir = dirOf(0.7, 0.72, 0.1);
    fit(1.5, lowDir, 56, this.ptsAt([1.9, 2.3], [C.clone().setY(0.5)]), 11, { cut: true });
    fit(3.5 - 0.001, lowDir, 56, this.ptsAt([3.0, 3.5], [C.clone().setY(0.5)]), 11, { ease: 'linear' });

    // 3. Arc: wide, the whole loop in frame.
    const wideTimes = [3.5, 4.0, 4.7];
    fit(3.5, dirOf(1, 0.38, 0.1), 52, this.ptsAt(wideTimes, [C.clone()]), 20, { cut: true });
    fit(4.7 - 0.001, dirOf(1, 0.62, 0.1), 52, this.ptsAt(wideTimes, [C.clone()]), 20, { ease: 'linear', scale: 0.97 });

    // 4. Close-up: the head turning to the target, jaw opening (follows the head, slow-motion by the head's own easing).
    const hp = newPose();
    for (let t = 4.7; t < 5.6 - 1e-6; t += 0.1) {
      this.headPose(t, hp);
      const ctr = hp.neck.clone().addScaledVector(hp.f, 2.4).addScaledVector(hp.u, 0.2);
      const side = hp.s.clone();
      if (side.dot(back) < 0) side.negate();
      const position = ctr.clone().addScaledVector(side, 9).addScaledVector(hp.f, 3).addScaledVector(hp.u, 1.2);
      if (position.y < 0.8) position.y = 0.8;
      keys.push({ t, position, target: ctr.clone().addScaledVector(hp.f, 0.4), fov: 36, roll: 0, cut: t === 4.7, ease: 'linear' });
    }
    this.headPose(5.6 - 0.001, hp);
    {
      const ctr = hp.neck.clone().addScaledVector(hp.f, 2.4).addScaledVector(hp.u, 0.2);
      const side = hp.s.clone();
      if (side.dot(back) < 0) side.negate();
      const position = ctr.clone().addScaledVector(side, 9).addScaledVector(hp.f, 3).addScaledVector(hp.u, 1.2);
      if (position.y < 0.8) position.y = 0.8;
      keys.push({ t: 5.6 - 0.001, position, target: ctr.clone().addScaledVector(hp.f, 0.4), fov: 36, roll: 0, ease: 'linear' });
    }

    // 5. Dive tracker: a fixed low camera watches the head fall onto the point.
    const divePos = C.clone().addScaledVector(back, 10).addScaledVector(right, -6).setY(2.5);
    for (let t = 5.6; t < 6.0 - 1e-6; t += 0.05) {
      this.headPose(t, hp);
      const target = hp.tip.clone().multiplyScalar(0.8).addScaledVector(C, 0.2);
      keys.push({ t, position: divePos.clone(), target, fov: 55, roll: 0, cut: t === 5.6, ease: 'linear' });
    }
    this.headPose(6.0 - 0.001, hp);
    keys.push({ t: 6.0 - 0.001, position: divePos.clone(), target: hp.tip.clone().multiplyScalar(0.8).addScaledVector(C, 0.2), fov: 55, roll: 0, ease: 'linear' });

    // 6. Crash: three-quarter view behind the caster, crown splash and the body above it in frame.
    const crashPos = this.P0.clone().addScaledVector(this.fwd, -9).setY(4);
    const crashLook = C.clone().setY(2.5);
    keys.push({ t: 6.0, position: crashPos.clone(), target: crashLook.clone(), fov: 46, roll: 0, cut: true });
    keys.push({ t: 7.2 - 0.001, position: crashPos.clone().lerp(crashLook, 0.06), target: crashLook.clone(), fov: 46, roll: 0, ease: 'linear' });

    // 7. Pour: low, from the far side, the body pouring down into the point.
    const pourLook = C.clone().setY(3.5);
    keys.push({ t: 7.2, position: C.clone().addScaledVector(right, 16).setY(5), target: pourLook.clone(), fov: 46, roll: 0, cut: true });
    keys.push({ t: 9.0 - 0.001, position: C.clone().addScaledVector(right, 14).setY(5), target: pourLook.clone(), fov: 46, roll: 0, ease: 'linear' });

    // 8. Calm: back to the gameplay-like view while the letterbox leaves.
    fit(9.0, gp, 42, gpPts, 12, { cut: true });
    fit(DURATION, gp, 42, gpPts, 12, { ease: 'linear', scale: 1.04 });
    // Never further than 22 units from the look-at point.
    for (const k of keys) {
      const off = k.position.clone().sub(k.target);
      if (off.length() > 22) k.position.copy(k.target).addScaledVector(off.normalize(), 22);
    }
  }

  /** Danger zone: the impact circle. */
  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: 0, impact: IMPACT }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout(0);
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.crashed = false;
    this.backwashed = false;
    this.mistDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  /** End of the timeline: everything back to neutral and hidden. */
  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const t = this.time;
    this.kick *= Math.exp(-dt * 5);
    if (!this.crashed && t >= IMPACT) this.onCrash();
    if (!this.backwashed && t >= BACKWASH) this.onBackwash();
    if (!this.mistDone && t >= 8.8) this.onMist();
    if (dt > 0) {
      // Spray off the head while it is above ground, foam at the base while the column stands.
      if (t >= 1.5 && t < 6.2) {
        this.headPose(t, this.hp);
        if (this.hp.tip.y > 1) this.spray.burst(3, this.hp.tip);
      }
      if (t >= 1.45 && t < 3.4) this.foam.burst(3, this.tmpA.copy(this.C).setY(0.6));
      if (t >= 1.6 && t < 3.2) {
        this.headPose(t, this.hpC);
        this.spray.burst(4, this.tmpA.copy(this.C).setY(Math.max(0.5, this.hpC.tip.y - 2.6)));
      }
    }
    this.layout(dt);
  }

  private inRange(): number[] {
    const ctx = this.ctx;
    if (!ctx) return [];
    const out: number[] = [];
    ctx.targets.forEach((_, i) => {
      if (Math.hypot(ctx.targetPos[i].x - this.C.x, ctx.targetPos[i].z - this.C.z) <= RADIUS + 0.5) out.push(i);
    });
    return out;
  }

  private safeFrom(p: THREE.Vector3): THREE.Vector3 {
    const from = this.C.clone();
    if (from.distanceToSquared(p) < 0.09) from.set(p.x - 0.5, 0, p.z + 0.5);
    return from;
  }

  private onCrash() {
    this.crashed = true;
    this.kick = 0.8;
    const c = this.C;
    this.spray.burst(850, this.tmpA.set(c.x, 0.7, c.z));
    this.foam.burst(320, this.tmpA.set(c.x, 0.5, c.z));
    const ctx = this.ctx;
    if (!ctx) return;
    for (const i of this.inRange()) {
      ctx.hit(ctx.targets[i], { damage: this.settings.damage, knock: 9, from: this.safeFrom(ctx.targetPos[i]), color: '#4fe0d0' });
    }
  }

  private onBackwash() {
    this.backwashed = true;
    this.kick = Math.max(this.kick, 0.3);
    this.spray.burst(140, this.tmpA.set(this.C.x, 0.6, this.C.z));
    const ctx = this.ctx;
    if (!ctx) return;
    for (const i of this.inRange()) {
      ctx.hit(ctx.targets[i], { damage: 20, knock: 3, from: this.safeFrom(ctx.targetPos[i]), color: '#4fe0d0' });
    }
  }

  private onMist() {
    this.mistDone = true;
    this.mist.burst(170, this.tmpA.set(this.C.x, 0.3, this.C.z));
  }

  // --- Layout (pure function of time, apart from emitter bursts) ---------------------------------------------

  private layout(dt: number) {
    const on = this.playing;
    const t = on ? this.time : -1;
    const after = t - IMPACT;
    const c = this.C;
    const cin = this.cinematic;

    // Camera and letterbox.
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(1.1, 1.5, t) * (1 - ss(9.0, 9.6, t));
      cin.active = t < 9.7;
    }

    this.layoutGround(t, after);
    this.layoutSerpent(t);
    this.layoutColumn(t);
    this.layoutDrops(t);
    this.layoutCrash(t, after);

    // Screen layer.
    const scr = this.screen;
    scr.darken = on ? 0.35 * ss(0, 1.2, t) * (1 - ss(8.5, 10, t)) : 0;
    scr.impact = on ? impactFrameAt(t, IMPACT, [1, 2]) : 0;
    scr.chroma = on ? chromaPulse(t, IMPACT, 0.55, 8) : 0;
    scr.speedLines = on ? (t > 5.55 && t < IMPACT ? 0.5 * ss(5.55, 5.8, t) : after >= 0 ? Math.max(0, 0.5 - after * 4) : 0) : 0;
    if (on) {
      scr.focus.copy(this.hp.tip);
      if (after >= 0) scr.focus.copy(c).setY(1.5);
    }

    const base = on ? Math.max(t >= 1.5 && t < 3.4 ? 0.12 : 0, t >= 6.1 && t < 9 ? 0.06 : 0) : 0;
    this.shake = on ? Math.max(base, this.kick) : 0;
    void dt;
  }

  private layoutGround(t: number, after: number) {
    const c = this.C;
    // Whirlpool: spins up in the call, narrows under the crash, reopens for the tail, closes after.
    const sw = ss(0.2, 1.2, t) * (1 - 0.65 * ss(IMPACT, IMPACT + 0.15, t) * (1 - ss(7.0, 7.4, t))) * (1 - ss(9.0, 9.8, t));
    this.whirlG.position.set(c.x, 0.05, c.z);
    this.whirlG.rotation.y = -Math.max(0, t) * (3.2 + 2.2 * (1 - ss(0, 2, t)));
    this.whirl.scale.setScalar(Math.max(1e-3, (RADIUS + 0.3) * sw));
    (this.whirl.material as THREE.MeshBasicMaterial).opacity = 0.95 * sw;
    this.whirl.visible = sw > 0.005;
    this.floorDisc.position.set(c.x, 0.03, c.z);
    (this.floorDisc.material as THREE.MeshBasicMaterial).opacity = 0.5 * ss(0, 1.2, t) * (1 - ss(9.3, 10.8, t));
    this.wet.position.set(c.x, 0.035, c.z);
    this.wet.scale.setScalar(RADIUS + 1.6 + 0.6 * ss(0, 1, after));
    (this.wet.material as THREE.MeshBasicMaterial).opacity = after < 0 ? 0 : ss(0, 0.15, after) * (1 - ss(9.3, 10.9, t));

    // Foam rings pulse outward from the whirlpool during the call and the breach.
    this.callRings.forEach((r, k) => {
      const p = (((t - 0.2) / 1.2 + k / 3) % 1 + 1) % 1;
      const gate = ss(0.2, 0.6, t) * (1 - ss(3.0, 3.6, t));
      r.mesh.position.set(c.x, 0.06 + k * 0.004, c.z);
      r.mesh.scale.setScalar(1.2 + 4.2 * p);
      r.material.opacity = 0.4 * Math.sin(Math.PI * p) * gate;
    });

    // Crash rings and the backwash.
    const e1 = 1 - Math.pow(1 - clamp(after / 0.55, 0, 1), 3);
    this.crashRing.mesh.position.set(c.x, 0.08, c.z);
    this.crashRing.mesh.scale.setScalar(1 + 9 * e1);
    this.crashRing.material.opacity = after > 0 && after < 0.6 ? 0.8 * (1 - after / 0.6) : 0;
    const a2 = after - 0.1;
    const e2 = 1 - Math.pow(1 - clamp(a2 / 0.6, 0, 1), 3);
    this.crashRing2.mesh.position.set(c.x, 0.09, c.z);
    this.crashRing2.mesh.scale.setScalar(1 + 6.5 * e2);
    this.crashRing2.material.opacity = a2 > 0 && a2 < 0.65 ? 0.4 * (1 - a2 / 0.65) : 0;
    const bw = (t - (BACKWASH - 0.1)) / 0.8;
    this.backRing.mesh.position.set(c.x, 0.1, c.z);
    this.backRing.mesh.scale.setScalar(lerp(7.5, 1.5, clamp(bw, 0, 1)));
    this.backRing.material.opacity = bw > 0 && bw < 1 ? 0.5 * Math.sin(Math.PI * bw) : 0;

    // Beads of water rising off the whirlpool.
    const bo = ss(0.3, 0.8, t) * (1 - ss(1.9, 2.6, t));
    for (let i = 0; i < BEADS; i++) {
      const s = this.beadSeed[i];
      const y = (((t * s.s + s.o) % 1) + 1) % 1;
      const a = s.a + t * 0.5;
      this.beadPos[i * 3] = c.x + Math.cos(a) * s.r * (1 - 0.3 * y);
      this.beadPos[i * 3 + 1] = 0.2 + y * 3.6;
      this.beadPos[i * 3 + 2] = c.z + Math.sin(a) * s.r * (1 - 0.3 * y);
    }
    this.beadGeo.attributes.position.needsUpdate = true;
    this.beadMat.opacity = 0.75 * bo;
    this.beads.visible = bo > 0.005;

    // Water refraction over the whirlpool and up the column.
    const hz = ss(0.5, 1.3, t) * (1 - ss(3.4, 4.4, t));
    this.haze.set(this.tmpA.set(c.x, 0, c.z), 0.016 * hz, Math.max(0, t));
  }

  /** The serpent: tube, head, fins. */
  private layoutSerpent(t: number) {
    const live = t >= 1.2 && t < 9.5;
    this.bodyMesh.visible = live;
    this.finGroup.visible = live;
    const hp = this.hp;
    this.headPose(Math.max(0, t), hp);
    const headVisible = live && hp.neck.y > -1.5;
    this.head.group.visible = headVisible;
    if (!live) return;

    // Head.
    this.head.group.position.copy(hp.neck);
    this.tmpM.makeBasis(hp.f, hp.u, hp.s);
    this.head.group.quaternion.setFromRotationMatrix(this.tmpM);
    const open = 0.08
      + 0.3 * Math.exp(-Math.pow((t - 2.25) / 0.3, 2))
      + 0.62 * ss(4.4, 5.0, t) * (1 - ss(6.05, 6.3, t));
    const glow = 1.1 + 0.3 * ss(4.4, 4.8, t) * (1 - ss(6.1, 6.3, t)) + 0.2 * Math.exp(-Math.pow((t - 1.9) / 0.3, 2));
    this.head.pose(open, glow);
    if (t > 5.3 && t < 6.8) {
      // Final word on the dive: the snout's local +x points straight at the impact point.
      hp.f.copy(this.C).setY(0.2).sub(hp.neck).normalize();
      hp.u.crossVectors(this.latW, hp.f).normalize();
      hp.s.crossVectors(hp.f, hp.u);
      this.tmpM.makeBasis(hp.f, hp.u, hp.s);
      this.head.group.quaternion.setFromRotationMatrix(this.tmpM);
    }

    // Body samples along the loop, trailing the neck.
    const sN = this.sHead(t) - HEAD_LEN;
    const bp = this.bp;
    for (let i = 0; i <= SEG; i++) {
      const d = (i / SEG) * LB;
      const q = d / LB;
      this.pathAt(sN + 0.5 - d, bp[i]);
      const env = ss(0.5, 3.5, bp[i].y);
      bp[i].addScaledVector(this.latW, SWAY * Math.sin(d * 0.55 - t * 3.4) * (0.25 + 0.75 * q) * env);
      this.bR[i] = (0.08 + 1.02 * Math.pow(1 - q, 0.85)) * ss(-0.4, 0.7, bp[i].y);
    }
    const T = this.bT;
    for (let i = 0; i <= SEG; i++) {
      T.copy(bp[Math.max(0, i - 1)]).sub(bp[Math.min(SEG, i + 1)]);
      if (T.lengthSq() < 1e-8) T.copy(hp.f);
      T.normalize();
      this.bT2[i].copy(T);
      this.bU[i].crossVectors(this.latW, T).normalize();
      this.bS[i].crossVectors(T, this.bU[i]);
      const r = this.bR[i];
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * Math.PI * 2;
        const ca = Math.cos(th), sa = Math.sin(th);
        const o = (i * (RAD + 1) + j) * 3;
        const nx = ca * this.bU[i].x + sa * this.bS[i].x, ny = ca * this.bU[i].y + sa * this.bS[i].y, nz = ca * this.bU[i].z + sa * this.bS[i].z;
        this.bodyNrm[o] = nx; this.bodyNrm[o + 1] = ny; this.bodyNrm[o + 2] = nz;
        this.bodyPos[o] = bp[i].x + nx * r;
        this.bodyPos[o + 1] = bp[i].y + ny * r;
        this.bodyPos[o + 2] = bp[i].z + nz * r;
      }
    }
    this.bodyGeo.attributes.position.needsUpdate = true;
    this.bodyGeo.attributes.normal.needsUpdate = true;

    // Fins sit on the dorsal side of their body sample; they shrink away as the sample sinks into the ground.
    for (const f of this.fins) {
      const i = f.i;
      const vis = ss(0, 1.2, bp[i].y);
      f.g.visible = vis > 0.02;
      if (!f.g.visible) continue;
      this.tmpM.makeBasis(this.bT2[i], this.bU[i], this.bS[i]);
      this.tmpQ.setFromRotationMatrix(this.tmpM);
      if (f.kind === 'fluke') {
        const flick = t > 8.2 ? 0.7 * Math.sin((t - 8.2) * 14) * Math.exp(-(t - 8.2) * 2) : 0;
        this.tmpQ.premultiply(this.tmpQ2.setFromAxisAngle(this.bS[i], flick));
        f.g.position.copy(bp[i]);
      } else {
        f.g.position.copy(bp[i]).addScaledVector(this.bU[i], Math.max(0.1, this.bR[i]) * 0.78);
      }
      f.g.quaternion.copy(this.tmpQ);
      f.g.scale.setScalar(Math.max(1e-3, f.size * vis));
    }
  }

  /** The water column: toon shells rise with the head, then fall as sheets. */
  private layoutColumn(t: number) {
    const c = this.C;
    // The column is crowned by the head: its top sits just under the snout while the head climbs.
    const tipY = (tt: number) => { this.headPose(tt, this.hpC); return clamp(this.hpC.tip.y - 2.6, 0, 15); };
    const fallP = clamp((t - 2.6) / 1.1, 0, 1);
    const top = t < 1.45 ? 0 : (t < 2.6 ? tipY(t) : tipY(2.6)) * (1 - fallP * fallP);
    const spread = 1 + 0.75 * fallP;
    const op = t < 1.45 || t > 3.7 ? 0 : 1 - ss(0.55, 1, fallP) ;
    this.shells.forEach((s, k) => {
      s.mesh.visible = op > 0.02 && top > 0.05;
      s.mesh.position.set(c.x, 0, c.z);
      s.mesh.scale.set(2.4 * s.r * spread, Math.max(top * (1 - 0.12 * k), 1e-3), 2.4 * s.r * spread);
      s.mesh.rotation.y = Math.max(0, t) * s.spin;
      s.tex.offset.y = -Math.max(0, t) * s.scroll * (1 + 1.5 * fallP) * (fallP > 0 ? -1 : 1) * 0.5;
      s.mat.opacity = 0.7 * op;
    });
    this.colRings.forEach((r, k) => {
      const p = (((t - 1.5) * 0.9 + k / this.colRings.length) % 1 + 1) % 1;
      const y = p * top;
      r.mesh.visible = op > 0.02 && top > 0.5;
      r.mesh.position.set(c.x, y, c.z);
      r.mesh.scale.setScalar((2.4 * spread) * (1 - 0.25 * (top > 0 ? y / top : 0)) + 0.3);
      r.material.opacity = 0.4 * op * Math.sin(Math.PI * p);
    });
  }

  /** Droplets shed from the body: each is emitted at a body point at a fixed phase, then flies ballistically. */
  private layoutDrops(t: number) {
    const p = this.tmpA;
    for (let i = 0; i < DROPS; i++) {
      const s = this.dropSeed[i];
      const per = s.per;
      const ph = s.ph * per;
      const te = ph + Math.floor((t - ph) / per) * per;
      const age = t - te;
      let hide = te < 1.6 || te > 8.6 || age > 0.95;
      if (!hide) {
        const sN = this.sHead(te) - HEAD_LEN;
        this.pathAt(sN + 0.5 - s.d, p);
        if (p.y < 0.8) hide = true;
        else {
          p.x += s.v.x * age;
          p.y += s.v.y * age - 4.5 * age * age;
          p.z += s.v.z * age;
          if (p.y < 0.1) hide = true;
        }
      }
      if (hide) p.set(0, -100, 0);
      this.dropPos[i * 3] = p.x;
      this.dropPos[i * 3 + 1] = p.y;
      this.dropPos[i * 3 + 2] = p.z;
    }
    this.dropGeo.attributes.position.needsUpdate = true;
  }

  /** Crash: crown splash blades, ground refraction rings, the star. */
  private layoutCrash(t: number, after: number) {
    const c = this.C;
    const up = UP;
    const yawQ = this.tmpQ, tiltQ = this.tmpQ2;
    const pos = this.tmpB, sc = this.tmpC;
    for (const { mesh, seeds } of this.crown) {
      seeds.forEach((s, i) => {
        if (after < 0 || after > 1.1) {
          this.tmpM.compose(pos.set(0, -100, 0), yawQ.identity(), sc.setScalar(1e-4));
          mesh.setMatrixAt(i, this.tmpM);
          return;
        }
        const aa = Math.max(0, after - s.lag * 0.06);
        const rise = 1 - Math.exp(-aa * 10);
        const fall = ss(0.25 + s.lag * 0.1, 0.8 + s.lag * 0.12, aa);
        const h = Math.max(1e-3, s.h * rise * (1 - 0.97 * fall));
        const tilt = 0.12 + 0.35 * s.lean + 1.1 * ss(0.25, 1.4, aa) * (0.6 + 0.4 * s.lean);
        const r = s.r0 + 2.6 * (1 - Math.exp(-aa * 4)) + 2.2 * ss(0.4, 1.6, aa);
        yawQ.setFromAxisAngle(up, Math.PI / 2 - s.a);
        tiltQ.setFromAxisAngle(this.tmpS.set(1, 0, 0), tilt);
        yawQ.multiply(tiltQ);
        pos.set(c.x + Math.cos(s.a) * r, 0.04, c.z + Math.sin(s.a) * r);
        this.tmpM.compose(pos, yawQ, sc.set(s.w * (1 - 0.6 * fall), h, h * 0.45));
        mesh.setMatrixAt(i, this.tmpM);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Distortion: a ground ring with the splash, a smaller one 0.25 s later; everything zero otherwise.
    const p1 = clamp(after / 0.5, 0, 1);
    const r1 = 1 + 8 * (1 - Math.pow(1 - p1, 3));
    this.shock.set(this.tmpA.set(c.x, 0.05, c.z), r1, after >= 0 && after < 0.5 ? 0.045 * (1 - p1) * (1 - p1) : 0);
    const a2 = after - 0.25;
    const p2 = clamp(a2 / 0.5, 0, 1);
    const r2 = 1 + 5 * (1 - Math.pow(1 - p2, 3));
    this.shock2.set(this.tmpA.set(c.x, 0.05, c.z), r2, a2 >= 0 && a2 < 0.5 ? 0.028 * (1 - p2) * (1 - p2) : 0);

    void t;
  }
}

export const leviathanBreachModule: EffectModule = {
  label: 'leviathan breach',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new LeviathanBreach(),
  telegraphs(effect) {
    return (effect as LeviathanBreach).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as LeviathanBreach;
    if (e.ctx) frameCast(camera, controls, e.ctx, 16);
  },
  buildGui(f, effect) {
    const s = (effect as LeviathanBreach).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
