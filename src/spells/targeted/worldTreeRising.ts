import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, mergeParts, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * World Tree Rising (targeted ground AoE r8, hero tier, ~22 s cutscene): a seed thrown by the caster sinks into the
 * floor at the point and cracks the ground, then a colossal tree grows in one continuous rise: a twisting 22 tall trunk
 * (a tube along a twisting curve with a drawn bark texture, grown by sliding its tip along the curve), forked branches,
 * and a canopy of layered leaf-cluster cards. Roots tear out of the floor and coil around every enemy (and lift them a
 * little). The canopy blossoms in a wave, amber fruit swells and hangs for one dead beat, then the fruit drops in a
 * cascade onto the enemies and bursts (two hits per target), the roots let go and a final bloom pulse rolls over the
 * floor. In autumn the leaves turn amber and fall, the tree withers back into the earth and a ring of petals remains.
 *
 * Everything is a pure function of time t (tubes, clusters, fruit, roots, enemy lift); only the events (hits, emitter
 * bursts, smoke) fire when t crosses their time. The caster is not animated; the enemies are shoved clear of the trunk
 * and lifted with `ctx.displace`, which every layout call sets (zero again in reset()).
 *
 * Camera: scripted with `cinematic`, every shot placed explicitly from the point T and the arena axes F (caster to T)
 * and R (right), the enemy centroid C and a free direction found around T, every key clamped to at most 24 from its
 * look-at and never inside a prop or against an enemy.
 *
 * Palette: blossom white (tiny) | leaf green | bark brown | amber fruit accent | root dark.
 *
 * Timeline: 0 seed thrown (side shot of the caster, cut 1.3 close at the point: sinks, cracks spread) | 2.5 growth (low
 * wide, cut 4.5 crane up the trunk, cut 6.2 wide as the canopy unfolds) | 8.0 roots (ground level, hit 9.5) |
 * 11.0 bloom (under the canopy looking up, dead beat 13.6-14.0) | 14.0 harvest (three-quarter on the enemies, hits
 * 14.6 and 15.6, bloom pulse 16.4) | 17.0 autumn (wide, slow orbit, wither) | 21.8 camera released | 22 end
 */
export interface WorldTreeSettings {
  damage: number;
  loop: boolean;
}

export const defaultWorldTree = (): WorldTreeSettings => ({ damage: 35, loop: false });

const DURATION = 22;
const MAXT = 8;
const NB = 8;
const TRUNK_H = 32;
const EXTRA = 22;
const FRUIT_MAX = MAXT * 2 + EXTRA;
const CL_MAX = 190;
const FL_MAX = 240;
const GROUND_PETALS = 110;
const TOP_PETALS = 14;

// Timeline.
const SEED_OUT = 0.35;
const SEED_LAND = 1.35;
const SPROUT = 2.5;
const ROOT0 = 8.0;
const HIT0 = 9.5;
const HARV = 14.0;
const HIT1 = 14.6;
const HIT2 = 15.6;
const PULSE = 16.4;
const CAM_END = 21.8;

// Palette.
const LEAF = 0x5fbf5a;
const AMBER = 0xffb43a;
const AMBER_PALE = 0xffe2a0;
const GREENS = [0x5fbf5a, 0x4fa84c, 0x6fcb62];
const AUTUMNS = [0xffb43a, 0xe0862a, 0xc25a22];

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const outBack = (x: number) => {
  const k = clamp(x, 0, 1) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
const angDiff = (a: number, b: number) => ((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const UP = v3(0, 1, 0);

/** Deterministic 0..1 sequence. */
function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

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

/** Trunk growth 0..1: a fast burst from the floor, then a long smooth rise. */
const trunkGrow = (t: number) => 0.22 * outCubic((t - SPROUT) / 0.9) + 0.78 * ss(3.0, 6.6, t);

/** The time at which the trunk tip reaches parameter g. */
function timeForG(g: number): number {
  let lo = SPROUT, hi = 6.6;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (trunkGrow(mid) < g) lo = mid;
    else hi = mid;
  }
  return hi;
}

// --- Drawn textures --------------------------------------------------------------------------------------

/** Bark: dark furrows, lighter ridges, small cracks and moss patches; tiles in both directions. */
function barkTexture(): THREE.CanvasTexture {
  const W = 256, H = 512;
  const tex = canvasTexture(W, H, (g) => {
    const rnd = lcg(7);
    g.fillStyle = '#3f2c1b';
    g.fillRect(0, 0, W, H);
    const wrap = (fn: (ox: number, oy: number) => void) => {
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) fn(ox, oy);
    };
    const stroke = (x: number, y: number, len: number, w: number, col: string, wob: number) => {
      const pts: [number, number][] = [];
      let px = x;
      for (let s = 0; s <= 6; s++) {
        pts.push([px, y + (len * s) / 6]);
        px += (rnd() - 0.5) * wob;
      }
      g.strokeStyle = col;
      g.lineWidth = w;
      wrap((ox, oy) => {
        g.beginPath();
        pts.forEach(([a, b], i) => (i ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy)));
        g.stroke();
      });
    };
    for (let i = 0; i < 40; i++) stroke(rnd() * W, rnd() * H, 120 + rnd() * 220, 8 + rnd() * 14, '#6a4929', 12);
    for (let i = 0; i < 26; i++) stroke(rnd() * W, rnd() * H, 100 + rnd() * 200, 3 + rnd() * 4, '#8a6238', 8);
    for (let i = 0; i < 70; i++) stroke(rnd() * W, rnd() * H, 90 + rnd() * 240, 3 + rnd() * 5, '#190f07', 10);
    g.strokeStyle = '#190f07';
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W, y = rnd() * H, l = 10 + rnd() * 26;
      g.lineWidth = 2 + rnd() * 2;
      wrap((ox, oy) => {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + l + ox, y + (rnd() - 0.5) * 6 + oy);
        g.stroke();
      });
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = rnd() * H, rw = 10 + rnd() * 16, rh = 14 + rnd() * 30;
      wrap((ox, oy) => {
        g.beginPath();
        g.ellipse(x + ox, y + oy, rw, rh, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(70,112,56,0.6)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(20,30,12,0.8)';
        g.stroke();
      });
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** A cluster of leaves, neutral grey with dark outlines (tinted green / amber per instance), upper leaves lighter. */
function leafClusterTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = lcg(11);
    const leaves: { x: number; y: number; ang: number; len: number; wid: number }[] = [];
    for (let i = 0; i < 48; i++) {
      const r = Math.sqrt(rnd()) * 50;
      const a = rnd() * Math.PI * 2;
      leaves.push({
        x: 128 + Math.cos(a) * r, y: 128 + Math.sin(a) * r * 0.85, ang: a + (rnd() - 0.5) * 0.9, len: 44 + rnd() * 26, wid: 20 + rnd() * 9,
      });
    }
    leaves.sort((a, b) => b.y - a.y);
    for (const l of leaves) {
      g.save();
      g.translate(l.x, l.y);
      g.rotate(l.ang);
      const c = Math.round(150 + 95 * (1 - l.y / 256) - rnd() * 22);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(l.len * 0.5, -l.wid, l.len, 0);
      g.quadraticCurveTo(l.len * 0.5, l.wid, 0, 0);
      g.fillStyle = `rgb(${c},${c},${c})`;
      g.fill();
      g.lineWidth = 3.5;
      g.strokeStyle = '#10160c';
      g.stroke();
      g.beginPath();
      g.moveTo(l.len * 0.1, 0);
      g.lineTo(l.len * 0.8, 0);
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(20,30,15,0.7)';
      g.stroke();
      g.restore();
    }
  });
}

/** Five cream petals with dark outlines and an amber centre. */
function flowerTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    for (let i = 0; i < 5; i++) {
      g.save();
      g.translate(64, 64);
      g.rotate((i / 5) * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, -28, 17, 29, 0, 0, Math.PI * 2);
      g.fillStyle = '#f0e7d8';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#3a2418';
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(64, 64, 11, 0, Math.PI * 2);
    g.fillStyle = '#ffb43a';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#3a2418';
    g.stroke();
  });
}

/** Amber fruit skin: warm gradient, dark speckles, a toon highlight; wraps a sphere. */
function fruitTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 128, (g) => {
    const rnd = lcg(31);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#f2a42a');
    gr.addColorStop(0.55, '#e08a1e');
    gr.addColorStop(1, '#a8501a');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 46; i++) {
      g.beginPath();
      g.ellipse(rnd() * 256, rnd() * 128, 2 + rnd() * 4, 1.5 + rnd() * 3, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(86,38,8,0.55)';
      g.fill();
    }
    for (const [x, y] of [[64, 42], [192, 42]]) {
      g.beginPath();
      g.ellipse(x, y, 22, 12, -0.5, 0, Math.PI * 2);
      g.fillStyle = '#ffd47a';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#7a3a0c';
      g.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Cracks radiating from the centre: a thick black line with a thin leaf-green glow line and an amber core. */
function crackTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const rnd = lcg(5);
    const paths: { pts: [number, number][]; w: number }[] = [];
    const walk = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
      const pts: [number, number][] = [[x, y]];
      const steps = Math.max(3, Math.round(len / 22));
      let a = ang;
      for (let s = 0; s < steps; s++) {
        a += (rnd() - 0.5) * 0.7;
        x += Math.cos(a) * (len / steps);
        y += Math.sin(a) * (len / steps);
        pts.push([x, y]);
        if (depth < 2 && rnd() < 0.3) walk(x, y, a + (rnd() < 0.5 ? 0.8 : -0.8), len * 0.4, w * 0.6, depth + 1);
      }
      paths.push({ pts, w });
    };
    for (let i = 0; i < 13; i++) walk(256, 256, (i / 13) * Math.PI * 2 + rnd() * 0.3, 190 + rnd() * 50, 9, 0);
    const draw = (style: string, k: number) => {
      g.strokeStyle = style;
      for (const p of paths) {
        g.lineWidth = Math.max(1.2, p.w * k);
        g.beginPath();
        p.pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
        g.stroke();
      }
    };
    draw('#0b0805', 1);
    draw('#5fbf5a', 0.38);
    draw('#ffb43a', 0.16);
  });
}

// --- Growing tubes ---------------------------------------------------------------------------------------

type Flute = [number, number, number] | null; // amplitude, lobes, twist along the length

/**
 * A tube along a curve whose tip slides along it: `set(g)` rebuilds the ring positions up to curve parameter g and
 * rounds the last rings into a dome. Normals are radial and fixed; only the positions change.
 */
class GrowTube {
  readonly mesh: THREE.Mesh;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly centers: THREE.Vector3[] = [];
  private readonly N: THREE.Vector3[];
  private readonly B: THREE.Vector3[];
  private readonly cs: number[] = [];
  private readonly sn: number[] = [];
  private last = -1;
  private tip = v3();

  constructor(
    readonly curve: THREE.Curve<THREE.Vector3>,
    private readonly radius: (u: number) => number,
    material: THREE.Material,
    private readonly rings: number,
    private readonly sides: number,
    private readonly flute: Flute,
    vScale: number,
  ) {
    const fr = curve.computeFrenetFrames(rings, false);
    this.N = fr.normals;
    this.B = fr.binormals;
    const cnt = (rings + 1) * (sides + 1);
    const nor = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2);
    const idx: number[] = [];
    for (let j = 0; j <= sides; j++) {
      this.cs.push(Math.cos((j / sides) * Math.PI * 2));
      this.sn.push(Math.sin((j / sides) * Math.PI * 2));
    }
    for (let i = 0; i <= rings; i++) {
      this.centers.push(curve.getPoint(i / rings));
      for (let j = 0; j <= sides; j++) {
        const k = i * (sides + 1) + j;
        nor[k * 3] = this.N[i].x * this.cs[j] + this.B[i].x * this.sn[j];
        nor[k * 3 + 1] = this.N[i].y * this.cs[j] + this.B[i].y * this.sn[j];
        nor[k * 3 + 2] = this.N[i].z * this.cs[j] + this.B[i].z * this.sn[j];
        uv[k * 2] = j / sides;
        uv[k * 2 + 1] = (i / rings) * vScale;
        if (i < rings && j < sides) {
          const a = k, b = k + sides + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(g: number) {
    g = clamp(g, 0, 1);
    if (Math.abs(g - this.last) < 1e-5) return;
    this.last = g;
    this.mesh.visible = g > 0.003;
    if (!this.mesh.visible) return;
    this.curve.getPoint(g, this.tip);
    const cap = 2.5 / this.rings;
    const pa = this.posAttr.array as Float32Array;
    const f = this.flute;
    for (let i = 0; i <= this.rings; i++) {
      const u = i / this.rings;
      let r = 0;
      let c = this.tip;
      if (u <= g) {
        c = this.centers[i];
        const k = clamp((g - u) / cap, 0, 1);
        r = this.radius(u) * Math.sqrt(1 - (1 - k) * (1 - k));
      }
      const N = this.N[i], B = this.B[i];
      for (let j = 0; j <= this.sides; j++) {
        const rr = r * (f ? 1 + f[0] * Math.sin((j / this.sides) * Math.PI * 2 * f[1] + u * f[2]) : 1);
        const k = (i * (this.sides + 1) + j) * 3;
        pa[k] = c.x + (N.x * this.cs[j] + B.x * this.sn[j]) * rr;
        pa[k + 1] = c.y + (N.y * this.cs[j] + B.y * this.sn[j]) * rr;
        pa[k + 2] = c.z + (N.z * this.cs[j] + B.z * this.sn[j]) * rr;
      }
    }
    this.posAttr.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

interface Branch {
  tube: GrowTube;
  ts: number;
  dur: number;
  child: boolean;
}

interface Cluster {
  p: THREE.Vector3;
  size: number;
  tU: number;
  yaw: number;
  fall: number;
  col: number;
  autumn: number;
  sway: number;
}

interface FlowerDef {
  p: THREE.Vector3;
  open: number;
  gone: number;
  size: number;
  yaw: number;
  tilt: number;
}

interface FruitDef {
  H: THREE.Vector3;
  G: THREE.Vector3;
  swell: number;
  r: number;
  tf0: number;
  tl: number;
  hit: boolean;
  spin: number;
}

interface RootDef {
  a: GrowTube;
  b: GrowTube;
  s: number;
}

interface PetalDef {
  p: THREE.Vector3;
  yaw: number;
  size: number;
  appear: number;
}

interface Ev {
  t: number;
  fn: () => void;
}

export class WorldTreeRising implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WorldTreeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private keys: ShotKey[] = [];
  private events: Ev[] = [];
  private evI = 0;

  // Cast geometry (world, flat).
  private T = v3();
  private F = v3(0, 0, -1);
  private R = v3(1, 0, 0);
  private tp: THREE.Vector3[] = [];
  private E: THREE.Vector3[] = []; // enemy feet after the shove
  private shove: THREE.Vector3[] = [];
  private C = v3();
  private rho = 3;
  private n = 0;
  private hand = v3();

  // Tree (local to T).
  private tree = new THREE.Group();
  private trunkCurve: THREE.CatmullRomCurve3 | null = null;
  private trunk: GrowTube | null = null;
  private branches: Branch[] = [];
  private roots: RootDef[] = [];
  private clusters: Cluster[] = [];
  private flowers: FlowerDef[] = [];
  private fruit: FruitDef[] = [];
  private groundPetals: PetalDef[] = [];

  private barkMat: THREE.MeshStandardMaterial;
  private rootMat: THREE.MeshStandardMaterial;
  private clusterMesh: THREE.InstancedMesh;
  private flowerMesh: THREE.InstancedMesh;
  private fruitMesh: THREE.InstancedMesh;
  private petalMesh: THREE.InstancedMesh;
  private halo: THREE.Points;
  private haloPos = new Float32Array(FRUIT_MAX * 3);
  private crack: THREE.Mesh;
  private seedGrp = new THREE.Group();
  private seed: THREE.Mesh;
  private seedHalo: THREE.Points;
  private trail: THREE.Points;
  private trailPos = new Float32Array(8 * 3);

  // Effects.
  private haze = new HeatHaze({ width: 9, height: 20, scale: 3, speed: 1 });
  private sproutShock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private pulseShock = new ShockRefraction({ facing: 'ground', width: 0.25 });
  private landShocks: ShockRefraction[] = [];
  private landStars: StarBurst[] = [];
  private landRings: ReturnType<typeof createRing>[] = [];
  private seedStar = new StarBurst({ points: 4, inner: 0.16, jitter: 0.15, color: LEAF, core: 0xfff6e8 });
  private ringA = createRing(LEAF, 0.9, 1, 64);
  private ringB = createRing(LEAF, 0.94, 1, 96);
  private pulseRing = createRing(LEAF, 0.95, 1, 128);
  private smoke = new SmokeBall({ maxBalls: 10, color: 0x1c130c, rim: 0x4a3524, flake: '#1c130c' });
  private dirt: Emitter;
  private juice: Emitter;
  private leaves: Emitter;
  private petals: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();
  private col2 = new THREE.Color();

  constructor(settings: WorldTreeSettings = defaultWorldTree()) {
    this.settings = settings;
    this.screen.tint.set(0x28402c);
    this.screen.impactColor.set(AMBER);
    this.screen.edgeTint.set(LEAF);
    this.group.add(this.tree);

    this.barkMat = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.92, metalness: 0 });
    this.rootMat = new THREE.MeshStandardMaterial({ map: this.barkMat.map, color: 0x8a7260, roughness: 0.95, metalness: 0 });

    // Canopy: three crossed cards per cluster, alpha-tested, tinted per instance; below the bloom threshold.
    const leafTex = leafClusterTexture();
    const q1 = new THREE.PlaneGeometry(1, 1).rotateY(0.4);
    const q2 = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2 + 0.4);
    const q3 = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).rotateY(0.6);
    this.clusterMesh = new THREE.InstancedMesh(
      mergeParts([q1, q2, q3]),
      new THREE.MeshBasicMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide }),
      CL_MAX,
    );
    this.clusterMesh.frustumCulled = false;
    this.clusterMesh.count = 0;
    this.tree.add(this.clusterMesh);

    const f1 = new THREE.PlaneGeometry(1, 1);
    const f2 = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2);
    this.flowerMesh = new THREE.InstancedMesh(
      mergeParts([f1, f2]),
      new THREE.MeshBasicMaterial({ map: flowerTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xe8e0d2 }),
      FL_MAX,
    );
    this.flowerMesh.frustumCulled = false;
    this.flowerMesh.count = 0;
    this.tree.add(this.flowerMesh);

    this.fruitMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshStandardMaterial({ map: fruitTexture(), roughness: 0.5, emissive: new THREE.Color(AMBER), emissiveIntensity: 0.2 }),
      FRUIT_MAX,
    );
    this.fruitMesh.frustumCulled = false;
    this.fruitMesh.count = 0;
    this.tree.add(this.fruitMesh);

    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(this.haloPos, 3));
    this.halo = new THREE.Points(hg, new THREE.PointsMaterial({
      size: 2.0, map: softDotTexture(), color: AMBER, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.halo.frustumCulled = false;
    this.halo.visible = false;
    this.tree.add(this.halo);

    // Cracks in the floor.
    this.crack = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.crack.renderOrder = 1;
    this.crack.visible = false;
    this.group.add(this.crack);

    // The seed: a small amber-green teardrop with a soft halo.
    this.seed = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe0a030 }));
    this.seed.scale.set(0.8, 1.15, 0.8);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    this.seedHalo = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 1.8, map: softDotTexture(), color: LEAF, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.seedHalo.frustumCulled = false;
    this.seedGrp.add(this.seed, this.seedHalo);
    this.seedGrp.visible = false;
    this.group.add(this.seedGrp);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Points(tg, new THREE.PointsMaterial({
      size: 0.8, map: softDotTexture(), color: AMBER, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.group.add(this.trail);

    // Fallen petals of the ending.
    const ps = new THREE.Shape();
    ps.moveTo(0, -0.5);
    ps.quadraticCurveTo(0.5, -0.1, 0, 0.5);
    ps.quadraticCurveTo(-0.5, -0.1, 0, -0.5);
    this.petalMesh = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(ps).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe6d3c0, side: THREE.DoubleSide }),
      GROUND_PETALS,
    );
    this.petalMesh.frustumCulled = false;
    this.petalMesh.count = 0;
    this.group.add(this.petalMesh);

    // Fruit bursts: a ring per landing, a toon star and a ground refraction ring per hit landing.
    for (let i = 0; i < FRUIT_MAX; i++) {
      const ring = createRing(AMBER, 0.86, 1, 48);
      this.landRings.push(ring);
      this.group.add(ring.mesh);
    }
    for (let i = 0; i < MAXT * 2; i++) {
      const star = new StarBurst({ points: 8, inner: 0.3, jitter: 0.25, color: AMBER, core: AMBER_PALE, additive: false });
      star.mesh.renderOrder = 6;
      this.landStars.push(star);
      const sh = new ShockRefraction({ facing: 'ground', width: 0.3 });
      this.landShocks.push(sh);
      this.group.add(star.mesh, sh.mesh);
    }
    this.group.add(
      this.haze.mesh, this.sproutShock.mesh, this.pulseShock.mesh, this.seedStar.mesh,
      this.ringA.mesh, this.ringB.mesh, this.pulseRing.mesh,
    );

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.dirt = em({
      maxParticles: 700, lifetime: 1.1, lifetimeJitter: 0.4, shapeSize: 0.5, speed: 6, speedJitter: 0.6, spread: 85, gravity: 14, drag: 0.4,
      sizeStart: 0.24, sizeEnd: 0.12, colorStart: '#5a4030', colorEnd: '#2a1d12', opacityStart: 1, opacityEnd: 0.4, additive: false, sizeJitter: 0.5, groundFade: 0.15,
    });
    this.juice = em({
      maxParticles: 900, lifetime: 0.9, lifetimeJitter: 0.4, shapeSize: 0.25, speed: 7, speedJitter: 0.6, spread: 110, gravity: 16, drag: 0.5,
      sizeStart: 0.16, sizeEnd: 0.08, colorStart: '#ffb43a', colorEnd: '#c76a10', opacityStart: 1, opacityEnd: 0.3, additive: false, sizeJitter: 0.4,
    });
    this.leaves = em({
      maxParticles: 900, lifetime: 3.4, lifetimeJitter: 0.4, shapeSize: 1.8, speed: 1.4, speedJitter: 0.6, spread: 120, gravity: 1.3, drag: 1.1,
      sizeStart: 0.3, sizeEnd: 0.24, colorStart: '#ffb43a', colorEnd: '#a8501c', opacityStart: 1, opacityEnd: 0.6, additive: false, sizeJitter: 0.5, spin: 2, groundFade: 0.3,
    });
    this.petals = em({
      maxParticles: 600, lifetime: 2.4, lifetimeJitter: 0.4, shapeSize: 0.4, speed: 5, speedJitter: 0.6, spread: 110, gravity: 1.2, drag: 1.4,
      sizeStart: 0.15, sizeEnd: 0.1, colorStart: '#f0e4d2', colorEnd: '#d9a890', opacityStart: 1, opacityEnd: 0, additive: false, sizeJitter: 0.4, spin: 2, groundFade: 0.2,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points, this.smoke.mesh);
    this.smoke.hold = 0.3;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- Cast ----------------------------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.T.copy(ctx.point).setY(0);
    this.F.copy(this.T).sub(ctx.from).setY(0);
    if (this.F.lengthSq() < 1e-4) this.F.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.F.lengthSq() < 1e-4) this.F.set(0, 0, -1);
    this.F.normalize();
    this.R.set(-this.F.z, 0, this.F.x);
    this.hand.copy(ctx.from).setY(0).addScaledVector(this.F, 0.5).addScaledVector(this.R, 0.3);
    this.hand.y = 1.2;

    // Enemies standing in the trunk's footprint are shoved clear when it bursts up.
    this.tp = ctx.targetPos.slice(0, MAXT).map((p) => p.clone().setY(0));
    this.n = this.tp.length;
    this.shove = [];
    this.E = [];
    this.C.set(0, 0, 0);
    this.tp.forEach((p, i) => {
      const d = p.clone().sub(this.T).setY(0);
      const dist = d.length();
      if (dist < 1e-3) d.copy(this.R).applyAxisAngle(UP, i * 1.3);
      else d.multiplyScalar(1 / dist);
      const s = dist < 4.8 ? d.clone().multiplyScalar(4.8 - dist) : v3();
      this.shove.push(s);
      this.E.push(p.clone().add(s));
      this.C.add(this.E[i]);
    });
    if (this.n) this.C.multiplyScalar(1 / this.n);
    else this.C.copy(this.T);
    this.rho = 3;
    for (const e of this.E) this.rho = Math.max(this.rho, e.distanceTo(this.C));

    this.buildTree();
    this.buildKeys();
    this.buildEvents();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.slice(0, MAXT).map((e) => e.group)];
    this.reset();
  }

  /** A unit direction around T (angle in the R/F frame) whose point at `dist` keeps `gap` from every enemy. */
  private freeDir(a0: number, dist: number, gap: number): { dir: THREE.Vector3; az: number } {
    for (let k = 0; k < 13; k++) {
      const az = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
      const dir = this.R.clone().multiplyScalar(Math.cos(az)).addScaledVector(this.F, Math.sin(az));
      const p = this.T.clone().addScaledVector(dir, dist);
      if (this.E.every((e) => e.distanceTo(p) > gap)) return { dir, az };
    }
    return { dir: this.R.clone().multiplyScalar(Math.cos(a0)).addScaledVector(this.F, Math.sin(a0)), az: a0 };
  }

  private away(): THREE.Vector3 {
    const d = this.C.clone().sub(this.T).setY(0);
    return d.lengthSq() > 2.25 ? d.normalize() : this.R.clone();
  }

  private buildTree() {
    for (const b of this.branches) { this.tree.remove(b.tube.mesh); b.tube.dispose(); }
    for (const r of this.roots) { this.tree.remove(r.a.mesh, r.b.mesh); r.a.dispose(); r.b.dispose(); }
    if (this.trunk) { this.tree.remove(this.trunk.mesh); this.trunk.dispose(); }
    this.branches = [];
    this.roots = [];
    this.clusters = [];
    this.flowers = [];
    this.fruit = [];
    this.groundPetals = [];

    // Trunk: a twisting curve, a flared base, spiralling bark flutes.
    const tp: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const a = u * Math.PI * 2.4;
      const rr = 2.2 * Math.sin(u * Math.PI * 0.95);
      tp.push(v3(Math.cos(a) * rr, -0.6 + u * (TRUNK_H + 0.6), Math.sin(a) * rr));
    }
    const trunkCurve = new THREE.CatmullRomCurve3(tp, false, 'centripetal');
    this.trunkCurve = trunkCurve;
    this.trunk = new GrowTube(
      trunkCurve, (u) => 0.8 + 1.6 * Math.pow(1 - u, 1.5) + 1.0 * Math.exp(-u * 12), this.barkMat, 110, 16, [0.07, 6, 14], 7,
    );
    this.tree.add(this.trunk.mesh);

    const rnd = lcg(23);
    const craneAz = this.freeDir(-0.45, 22, 4).az;
    const addCluster = (p: THREE.Vector3, size: number, tU: number) => {
      if (this.clusters.length >= CL_MAX) return;
      this.clusters.push({
        p: p.clone(), size, tU, yaw: rnd() * 6.28, fall: 18.3 + rnd() * 1.7, col: Math.floor(rnd() * 3), autumn: 17.0 + rnd() * 1.3, sway: rnd() * 6.28,
      });
    };

    // Main branches fork off the upper trunk; children fork off the main ones.
    for (let k = 0; k < NB; k++) {
      const u = 0.3 + (0.6 * k) / (NB - 1);
      let az = k * 2.4 + rnd() * 0.3;
      const dd = angDiff(az, craneAz);
      if (Math.abs(dd) < 0.5) az = craneAz + (dd >= 0 ? 1 : -1) * 0.55;
      const d = this.R.clone().multiplyScalar(Math.cos(az)).addScaledVector(this.F, Math.sin(az));
      const L = 15.5 - 5.5 * (k / (NB - 1)) + rnd() * 1.0;
      const side = v3(-d.z, 0, d.x).multiplyScalar((rnd() - 0.5) * L * 0.15);
      const p0 = trunkCurve.getPoint(u).addScaledVector(d, -0.3);
      const at = (f: number, h: number) => p0.clone().addScaledVector(d, L * f).addScaledVector(UP, L * h).addScaledVector(side, f);
      const curve = new THREE.CatmullRomCurve3([p0, at(0.25, 0.1), at(0.55, 0.2), at(0.82, 0.3), at(1, 0.34)], false, 'centripetal');
      const r0 = 0.9 - (0.4 * k) / (NB - 1);
      const tube = new GrowTube(curve, (x) => r0 * Math.pow(1 - x, 0.9) + 0.1, this.barkMat, 34, 8, null, 3);
      const ts = timeForG(u) + 0.1, dur = 1.3;
      this.tree.add(tube.mesh);
      this.branches.push({ tube, ts, dur, child: false });
      for (const v of [0.5, 0.7, 0.88, 1.0]) {
        const P = curve.getPoint(v);
        for (let q = 0; q < 2; q++) {
          addCluster(P.clone().addScaledVector(UP, 0.5).addScaledVector(side.clone().normalize(), (q ? 1 : -1) * 1.2 * (0.4 + rnd())),
            (v === 1 ? 7.0 : 5.5) + rnd() * 1.8, ts + dur * v + 0.15);
        }
      }
      const nChild = k % 2 === 0 ? 2 : 1;
      for (let c = 0; c < nChild; c++) {
        const v = 0.5 + 0.12 * c;
        const P = curve.getPoint(v);
        const cd = d.clone().applyAxisAngle(UP, (c % 2 ? -1 : 1) * (0.6 + rnd() * 0.2));
        const Lc = 0.55 * L;
        const cat = (f: number, h: number) => P.clone().addScaledVector(cd, Lc * f).addScaledVector(UP, Lc * h);
        const cc = new THREE.CatmullRomCurve3([P, cat(0.3, 0.15), cat(0.65, 0.3), cat(1, 0.42)], false, 'centripetal');
        const ct = new GrowTube(cc, (x) => 0.4 * (1 - x) + 0.06, this.barkMat, 26, 7, null, 2);
        const cts = ts + dur * v, cdur = 1.0;
        this.tree.add(ct.mesh);
        this.branches.push({ tube: ct, ts: cts, dur: cdur, child: true });
        for (const w of [0.7, 0.9, 1.0]) {
          const Q = cc.getPoint(w);
          for (let q = 0; q < 2; q++) {
            addCluster(Q.clone().addScaledVector(UP, 0.4).add(v3((rnd() - 0.5) * 2.2, (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 2.2)),
              (w === 1 ? 6.0 : 4.6) + rnd() * 1.4, cts + cdur * w + 0.15);
          }
        }
      }
    }
    // Crown: clusters round the top of the trunk.
    for (let i = 0; i < 10; i++) {
      const u = 0.84 + (i / 10) * 0.16;
      addCluster(trunkCurve.getPoint(u).add(v3((rnd() - 0.5) * 3.2, (rnd() - 0.2) * 1.5, (rnd() - 0.5) * 3.2)), 6.5 + rnd() * 1.2, timeForG(u) + 0.2);
    }

    // Blossoms on the underside of the clusters, opening in a wave out from the trunk.
    const nFl = Math.min(FL_MAX, this.clusters.length * 2);
    for (let i = 0; i < nFl; i++) {
      const c = this.clusters[Math.floor(rnd() * this.clusters.length)];
      const dir = v3(rnd() - 0.5, 0, rnd() - 0.5);
      dir.y = -(0.25 + rnd() * 0.6);
      dir.normalize();
      const p = c.p.clone().addScaledVector(dir, c.size * 0.42);
      const hd = Math.hypot(p.x, p.z) / 17;
      this.flowers.push({ p, open: 11.0 + 1.6 * clamp(hd, 0, 1) + rnd() * 0.3, gone: 12.4 + rnd() * 0.5, size: 0.7 + rnd() * 0.35, yaw: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.8 });
    }

    // Fruit: two droppers per target (they land on the enemies) plus extras that burst on the floor.
    const low = this.clusters.filter((c) => c.p.y > 14);
    const pool = low.length ? low : this.clusters;
    const hang = () => {
      const c = pool[Math.floor(rnd() * pool.length)];
      return c.p.clone().add(v3((rnd() - 0.5) * c.size * 0.5, -c.size * 0.38, (rnd() - 0.5) * c.size * 0.5));
    };
    for (let i = 0; i < this.n; i++) {
      const dirK = this.E[i].clone().sub(this.T).setY(0).normalize();
      for (let w = 0; w < 2; w++) {
        const G = this.E[i].clone().sub(this.T).setY(1.55);
        if (w) G.addScaledVector(dirK, 0.55);
        const tl = w ? HIT2 : HIT1, dur = w ? 0.62 : 0.6;
        this.fruit.push({ H: hang(), G, swell: 12.5 + rnd() * 0.35, r: 0.82, tf0: tl - dur, tl, hit: true, spin: (rnd() - 0.5) * 8 });
      }
    }
    for (let i = 0; i < EXTRA; i++) {
      const a = rnd() * Math.PI * 2, rad = 5.6 + rnd() * 4.4;
      const tl = HARV + 0.7 + rnd() * 1.7, dur = 0.65 + rnd() * 0.15;
      this.fruit.push({
        H: hang(), G: v3(Math.cos(a) * rad, 0.4, Math.sin(a) * rad), swell: 12.5 + rnd() * 0.35, r: 0.62 + rnd() * 0.2, tf0: tl - dur, tl, hit: false, spin: (rnd() - 0.5) * 8,
      });
    }

    // Roots: from under the trunk across the floor, then a double helix round every enemy.
    for (let i = 0; i < this.n; i++) {
      const Eloc = this.E[i].clone().sub(this.T).setY(0);
      const dist = Eloc.length();
      const dirE = dist > 1e-3 ? Eloc.clone().multiplyScalar(1 / dist) : this.R.clone();
      const perp = v3(-dirE.z, 0, dirE.x);
      const ang0 = Math.atan2(-dirE.z, -dirE.x);
      const make = (rad: number, turns: number, sgn: number, wob: number, r0: number, r1: number, vs: number) => {
        const pts: THREE.Vector3[] = [dirE.clone().multiplyScalar(2.6).setY(-0.15)];
        for (let m = 1; m <= 4; m++) {
          const f = m / 4;
          const along = lerp(3.4, Math.max(3.8, dist - rad), f);
          pts.push(dirE.clone().multiplyScalar(along).addScaledVector(perp, Math.sin(m * 1.7 + i + wob) * 0.5 * (1 - f * 0.6)).setY(0.12 + 0.2 * Math.sin(m * 2.1 + wob)));
        }
        for (let q = 0; q <= 13; q++) {
          const f = q / 13;
          const ang = ang0 + sgn * f * turns * Math.PI * 2;
          pts.push(Eloc.clone().add(v3(Math.cos(ang) * rad, 0.15 + f * 2.05, Math.sin(ang) * rad)));
        }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const tube = new GrowTube(curve, (x) => r0 * Math.pow(1 - x, 1.1) + r1, this.rootMat, 90, 8, null, vs);
        this.tree.add(tube.mesh);
        return tube;
      };
      this.roots.push({ a: make(0.82, 1.9, 1, 0, 0.34, 0.13, 5), b: make(0.95, 1.9, -1, 2.3, 0.22, 0.09, 4), s: ROOT0 + 0.05 * i });
    }

    // The ring of fallen petals that remains.
    for (let i = 0; i < GROUND_PETALS; i++) {
      const a = rnd() * Math.PI * 2, rad = 7 + rnd() * 5;
      this.groundPetals.push({ p: v3(Math.cos(a) * rad, 0.05 + i * 0.0006, Math.sin(a) * rad), yaw: rnd() * 6.28, size: 0.34 + rnd() * 0.3, appear: 19.4 + rnd() * 1.1 });
    }
  }

  // --- Camera keys ---------------------------------------------------------------------------------------

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const { T, C, F, R } = this;
    const up = (y: number) => v3(0, y, 0);
    const key = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false, ease: ShotKey['ease'] = 'inOut', maxD = 24) => {
      const p = pos.clone();
      if (p.y < 0.9) p.y = 0.9;
      const off = p.clone().sub(target);
      if (off.length() > maxD) p.copy(target).addScaledVector(off.normalize(), maxD);
      keys.push({ t, position: p, target: target.clone(), fov, roll: 0, cut, ease });
    };
    const at = (dir: THREE.Vector3, d: number, y: number) => T.clone().addScaledVector(dir, d).add(up(y));

    // 1. The throw (0-1.3): the caster from the side at about a third of the frame height, the seed falling from the hand.
    const cpos = this.ctx!.from.clone().setY(0);
    key(0, cpos.clone().addScaledVector(R, 11).addScaledVector(F, -0.5).add(up(1.8)), cpos.clone().addScaledVector(F, 1.6).add(up(1.3)), 44, true);
    key(1.3 - 0.001, cpos.clone().addScaledVector(R, 10.2).addScaledVector(F, 0.6).add(up(1.8)), cpos.clone().addScaledVector(F, 2.4).add(up(1.2)), 44, false, 'linear');

    // 2. The cracks (1.3-2.5): about 8 from the point at y 3, looking down; an enemy stands in them, fully in frame.
    let a2 = -0.5;
    if (this.n) {
      const v = T.clone().sub(C).setY(0);
      if (v.lengthSq() > 1) a2 = Math.atan2(v.dot(F), v.dot(R));
    }
    const d2 = this.freeDir(a2, 8, 3.2).dir;
    const look2 = this.n ? T.clone().lerp(C, 0.4).add(up(0.6)) : T.clone().add(up(0.3));
    key(1.3, at(d2, 8, 3.0), look2, 46, true);
    key(SPROUT - 0.001, at(d2, 7.2, 2.6), look2, 44, false, 'linear');

    // 3. Low wide (2.5-4.5): the sapling bursts up, ground to tip in frame, dirt included.
    const d3 = this.freeDir(-0.9, 22, 4).dir;
    key(SPROUT, at(d3, 22, 2.5), T.clone().add(up(5)), 62, true);
    key(4.5 - 0.001, at(d3, 21, 3), T.clone().add(up(10)), 62, false, 'inOut');

    // 4. Crane (4.5-6.2): up the trunk, 22 from the axis, looking 6 below the tip so the forks and first buds show.
    const d4 = this.freeDir(-0.45, 22, 4).dir;
    for (let t = 4.5; t <= 6.2 + 1e-6; t += 0.1) {
      const tt = Math.min(t, 6.2 - 0.001);
      const tip = this.trunkCurve!.getPoint(trunkGrow(tt));
      key(tt, at(d4, 22, tip.y * 0.8 + 2), T.clone().add(tip).add(up(-6)), 64, t === 4.5, 'linear');
    }

    // 5. Wide (6.2-8.0): the whole tree as the canopy unfolds, 22 away.
    const d5 = this.freeDir(0.2, 44, 4).dir;
    key(6.2, at(d5, 44, 4), T.clone().add(up(17)), 54, true, 'inOut', 48);
    key(ROOT0 - 0.001, at(d5, 42, 4), T.clone().add(up(17)), 54, false, 'linear', 48);

    // 6. Roots (8-11): ground level, the trunk behind the enemies.
    const aw = this.away();
    const look6 = C.clone().add(up(1.3));
    key(ROOT0, C.clone().addScaledVector(aw, this.rho + 9).add(up(1.0)), look6, 52, true);
    key(11 - 0.001, C.clone().addScaledVector(aw, this.rho + 7).add(up(1.3)), look6.clone().add(up(0.2)), 50, false, 'inOut');

    // 7. Under the canopy (11-14): looking up past the trunk at the blossoms and the swelling fruit.
    const d7 = this.freeDir(1.2, 9, 3.5).dir;
    const side7 = v3(-d7.z, 0, d7.x);
    key(11, at(d7, 9, 1.2), T.clone().addScaledVector(side7, 3).add(up(21)), 70, true);
    key(HARV - 0.001, at(d7, 8, 1.4), T.clone().addScaledVector(side7, 2.4).add(up(24)), 66, false, 'inOut');

    // 8. Harvest (14-17): three-quarter on the enemies, the fruit falling into frame from above.
    const dh = aw.clone().applyAxisAngle(UP, 0.6);
    key(HARV, C.clone().addScaledVector(dh, 18).add(up(8.5)), C.clone().add(up(3.8)), 52, true);
    key(17 - 0.001, C.clone().addScaledVector(dh, 15.5).add(up(7.5)), C.clone().add(up(3.2)), 50, false, 'inOut');

    // 9. Autumn (17-21.8): wide from the far side, a slow orbit while the tree withers.
    const th0 = this.freeDir(Math.PI + 0.3, 44, 4).az;
    for (let t = 17; t <= CAM_END + 1e-6; t += 0.4) {
      const k = (t - 17) / (CAM_END - 17);
      const th = th0 + 0.5 * k;
      const dir = R.clone().multiplyScalar(Math.cos(th)).addScaledVector(F, Math.sin(th));
      key(Math.min(t, CAM_END), at(dir, 44, 4 + 2 * k), T.clone().add(up(17 - 2 * k)), 54, t === 17, 'linear', 48);
    }
  }

  // --- Events (fire when t crosses their time) -----------------------------------------------------------

  private world(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(local).add(this.T);
  }

  private buildEvents() {
    const ev: Ev[] = [];
    const add = (t: number, fn: () => void) => ev.push({ t, fn });
    const T = this.T;
    const ctx = this.ctx!;
    const targets = ctx.targets.slice(0, MAXT);

    add(SEED_LAND, () => {
      this.dirt.burst(14, this.tmpA.copy(T).setY(0.15));
      this.kick = Math.max(this.kick, 0.1);
    });
    add(SPROUT, () => {
      this.dirt.burst(90, this.tmpA.copy(T).setY(0.3));
      this.smoke.trigger(this.tmpB.copy(T).setY(0.9), 1.2, 1.0);
      this.kick = Math.max(this.kick, 0.5);
    });

    // Roots tear out of the floor: dirt and a little dark smoke where the tip breaks through.
    this.roots.forEach((r, i) => {
      for (const gs of [0.12, 0.3, 0.5, 0.7, 0.88]) {
        const p = r.a.curve.getPoint(gs);
        add(r.s + 1.2 * gs, () => {
          this.dirt.burst(14, this.world(p, this.tmpA).setY(Math.max(0.1, p.y)));
          if (gs === 0.3 && i % 2 === 0) this.smoke.trigger(this.world(p, this.tmpB).setY(0.5), 0.55, 0.8);
        });
      }
    });
    add(HIT0, () => {
      this.kick = Math.max(this.kick, 0.25);
      for (const e of targets) ctx.hit(e, { damage: Math.round(this.settings.damage * 0.57), knock: 0, from: T, color: '#5fbf5a' });
    });

    // Blossoms shed a few petals.
    [11.2, 11.5, 11.8].forEach((tt, m) => add(tt, () => {
      for (let q = 0; q < 3; q++) {
        const f = this.flowers[(m * 31 + q * 17) % Math.max(1, this.flowers.length)];
        if (f) this.petals.burst(8, this.world(f.p, this.tmpA));
      }
    }));

    // Harvest: every fruit landing bursts; the droppers also hit.
    this.fruit.forEach((f) => add(f.tl, () => {
      this.juice.burst(f.hit ? 34 : 16, this.world(f.G, this.tmpA).setY(f.hit ? 1.4 : 0.4));
      if (f.hit) this.kick = Math.max(this.kick, 0.2);
    }));
    for (const tt of [HIT1, HIT2]) {
      add(tt, () => {
        for (const e of targets) ctx.hit(e, { damage: this.settings.damage, knock: 4, from: T, color: '#ffb43a' });
      });
    }

    // The final bloom pulse: a ring of petals sprays up from the floor.
    add(PULSE, () => {
      this.kick = Math.max(this.kick, 0.6);
      for (let q = 0; q < TOP_PETALS; q++) {
        const a = (q / TOP_PETALS) * Math.PI * 2;
        this.petals.burst(14, this.tmpA.set(T.x + Math.cos(a) * 6.5, 0.3, T.z + Math.sin(a) * 6.5));
      }
    });

    // Autumn: leaves drift down from the canopy.
    for (let m = 0; m < 15; m++) {
      add(17.3 + 0.22 * m, () => {
        for (let q = 0; q < 3; q++) {
          const c = this.clusters[(m * 7 + q * 13) % Math.max(1, this.clusters.length)];
          if (c) this.leaves.burst(24, this.world(c.p, this.tmpA));
        }
      });
    }

    ev.sort((a, b) => a.t - b.t);
    this.events = ev;
  }

  /** Danger zone: the circle at the point from the sprout to the first root hit. */
  telegraphSpecs(): TelegraphSpec[] {
    return [{ shape: { kind: 'circle', x: this.T.x, z: this.T.z, radius: 8 }, start: SPROUT, impact: HIT0 }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.shake = 0;
    this.evI = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.evI = 0;
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    this.kick *= Math.exp(-dt * 6);
    while (this.evI < this.events.length && this.events[this.evI].t <= this.time) this.events[this.evI++].fn();
    this.layout();
  }

  // --- Layout (pure function of time) --------------------------------------------------------------------

  private layout() {
    const on = this.playing && !!this.ctx;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(21.0, CAM_END, t));
      cin.active = t < CAM_END;
    }
    this.layoutEnemies(t);
    this.layoutSeed(t);
    this.layoutTree(t);
    this.layoutRoots(t);
    this.layoutCanopy(t);
    this.layoutFruit(t);
    this.layoutFx(t);
    this.layoutScreen(t);
  }

  /** Shoves enemies out of the trunk footprint and lifts them in the root coils. */
  private layoutEnemies(t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const targets = ctx.targets.slice(0, MAXT);
    for (let i = 0; i < targets.length; i++) {
      const o = this.tmpC.set(0, 0, 0);
      if (t >= 0 && this.shove[i]) {
        o.copy(this.shove[i]).multiplyScalar(ss(2.55, 3.3, t) * (1 - ss(21.2, 21.9, t)));
        o.y = 0.38 * ss(9.3, 10.3, t) * (1 - ss(HIT1 - 0.05, HIT1 + 0.25, t));
      }
      ctx.displace(targets[i], o);
    }
  }

  /** Seed position: in the hand, an arc to the point, then sinking into the floor. */
  private seedAt(t: number, p: THREE.Vector3) {
    const land = this.tmpB.set(this.T.x, 0.17, this.T.z);
    if (t < SEED_OUT) p.copy(this.hand);
    else if (t < SEED_LAND) {
      const k = (t - SEED_OUT) / (SEED_LAND - SEED_OUT);
      p.lerpVectors(this.hand, land, k);
      p.y += 3.4 * 4 * k * (1 - k);
    } else {
      const k = ss(SEED_LAND, 2.05, t);
      p.set(land.x, lerp(0.17, -0.3, k), land.z);
    }
    return p;
  }

  private layoutSeed(t: number) {
    const on = t >= 0 && t < 2.15;
    this.seedGrp.visible = on;
    this.trail.visible = t >= 0 && t < 1.5;
    this.seedStar.set(this.tmpA, 0, 0);
    this.crack.visible = t >= 1.8;
    if (t >= 1.8) {
      const s = 0.12 + 0.88 * outCubic((t - 1.8) / 1.4);
      this.crack.position.set(this.T.x, 0.035, this.T.z);
      this.crack.scale.set(s, 1, s);
      (this.crack.material as THREE.MeshBasicMaterial).opacity = 1 - ss(20.4, 21.6, t);
    }
    if (!on) return;
    const sink = ss(SEED_LAND, 2.05, t);
    this.seedAt(t, this.seedGrp.position);
    this.seedGrp.scale.setScalar((1 - 0.5 * sink) * (1 + 0.1 * Math.sin(t * 14)));
    (this.seedHalo.material as THREE.PointsMaterial).opacity = 0.55 + 0.15 * Math.sin(t * 9);
    if (this.trail.visible) {
      const q = this.tmpC;
      for (let i = 0; i < 8; i++) {
        this.seedAt(Math.max(0, t - (i + 1) * 0.04), q);
        this.trailPos.set([q.x, q.y, q.z], i * 3);
      }
      this.trail.geometry.attributes.position.needsUpdate = true;
    }
    const ga = t - SEED_LAND;
    if (ga >= 0 && ga < 0.3) {
      const pop = StarBurst.pop(ga, 0.05, 0.15);
      this.seedStar.set(this.tmpA.set(this.T.x, 0.5, this.T.z), 0.9 * pop.scale, pop.opacity, 0.2);
    }
  }

  private layoutTree(t: number) {
    const on = t >= 0 && !!this.trunk;
    this.tree.position.set(this.T.x, -0.6 * ss(19.6, 21.6, t), this.T.z);
    if (this.trunk) this.trunk.set(on ? trunkGrow(t) * (1 - ss(19.6, 21.6, t)) : 0);
    for (const b of this.branches) {
      const x = clamp((t - b.ts) / b.dur, 0, 1);
      const w = b.child ? ss(18.6, 19.8, t) : ss(19.0, 20.6, t);
      b.tube.set(on ? (1 - (1 - x) * (1 - x)) * (1 - w) : 0);
    }
  }

  private layoutRoots(t: number) {
    const rel = 1 - ss(HIT1 + 0.1, HIT2 - 0.1, t);
    for (const r of this.roots) {
      r.a.set(t >= 0 ? clamp((t - r.s) / 1.2, 0, 1) * rel : 0);
      r.b.set(t >= 0 ? clamp((t - r.s - 0.12) / 1.2, 0, 1) * rel : 0);
    }
  }

  private layoutCanopy(t: number) {
    const on = t >= 0;
    const d = this.dummy;
    const swayK = on ? 1 - ss(13.2, 13.6, t) * (1 - ss(13.95, 14.05, t)) : 0;
    this.clusterMesh.count = on ? this.clusters.length : 0;
    this.flowerMesh.count = on ? this.flowers.length : 0;
    this.petalMesh.count = on ? this.groundPetals.length : 0;
    if (!on) return;

    for (let i = 0; i < this.clusters.length; i++) {
      const c = this.clusters[i];
      const unfold = outBack((t - c.tU) / 0.9);
      const gone = 1 - ss(c.fall, c.fall + 1.0, t);
      const s = c.size * unfold * gone;
      d.position.copy(c.p);
      d.position.y -= 1.6 * (1 - gone);
      d.rotation.set(0, c.yaw + 0.07 * Math.sin(t * 0.9 + c.sway) * swayK, 0);
      d.scale.setScalar(Math.max(s, 1e-4));
      d.updateMatrix();
      this.clusterMesh.setMatrixAt(i, d.matrix);
      const shade = 0.72 + 0.28 * clamp(c.p.y / 22, 0, 1);
      this.col.setHex(GREENS[c.col]).multiplyScalar(shade);
      this.col2.setHex(AUTUMNS[c.col]);
      this.clusterMesh.setColorAt(i, this.col.lerp(this.col2, ss(c.autumn, c.autumn + 1.4, t)));
    }
    this.clusterMesh.instanceMatrix.needsUpdate = true;
    if (this.clusterMesh.instanceColor) this.clusterMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < this.flowers.length; i++) {
      const f = this.flowers[i];
      const s = f.size * outBack((t - f.open) / 0.5) * (1 - ss(f.gone, f.gone + 0.5, t));
      d.position.copy(f.p);
      d.rotation.set(f.tilt, f.yaw, 0);
      d.scale.setScalar(Math.max(s, 1e-4));
      d.updateMatrix();
      this.flowerMesh.setMatrixAt(i, d.matrix);
    }
    this.flowerMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.groundPetals.length; i++) {
      const p = this.groundPetals[i];
      d.position.set(this.T.x + p.p.x, p.p.y, this.T.z + p.p.z);
      d.rotation.set(0, p.yaw, 0);
      d.scale.setScalar(Math.max(p.size * ss(p.appear, p.appear + 0.6, t), 1e-4));
      d.updateMatrix();
      this.petalMesh.setMatrixAt(i, d.matrix);
    }
    this.petalMesh.instanceMatrix.needsUpdate = true;
  }

  /** Fruit: swell and ripen on the branches, hang through the dead beat, drop onto the enemies, vanish in the burst. */
  private layoutFruit(t: number) {
    const on = t >= 0;
    const d = this.dummy;
    this.fruitMesh.count = on ? this.fruit.length : 0;
    this.halo.visible = on && this.fruit.length > 0;
    for (let i = 0; i < FRUIT_MAX; i++) this.haloPos[i * 3 + 1] = -100;
    if (!on) return;
    for (let i = 0; i < this.fruit.length; i++) {
      const f = this.fruit[i];
      let s = 0;
      const pos = this.tmpC;
      if (t < f.swell || t >= f.tl) s = 0;
      else if (t < f.tf0) {
        s = f.r * outBack((t - f.swell) / 0.7);
        pos.copy(f.H);
      } else {
        const k = (t - f.tf0) / (f.tl - f.tf0);
        s = f.r;
        const h = ss(0, 0.55, k);
        pos.set(lerp(f.H.x, f.G.x, h), lerp(f.H.y, f.G.y, k * k), lerp(f.H.z, f.G.z, h));
      }
      d.position.copy(pos);
      d.rotation.set(0, i, t >= f.tf0 ? (t - f.tf0) * f.spin : 0);
      d.scale.setScalar(Math.max(s, 1e-4));
      d.updateMatrix();
      this.fruitMesh.setMatrixAt(i, d.matrix);
      const ripe = ss(f.swell + 0.1, f.swell + 0.9, t);
      this.fruitMesh.setColorAt(i, this.col.setRGB(lerp(0.66, 1, ripe), lerp(0.76, 1, ripe), lerp(0.28, 1, ripe)));
      if (s > 0.55 * f.r) {
        this.haloPos[i * 3] = pos.x;
        this.haloPos[i * 3 + 1] = pos.y;
        this.haloPos[i * 3 + 2] = pos.z;
      }
    }
    this.fruitMesh.instanceMatrix.needsUpdate = true;
    if (this.fruitMesh.instanceColor) this.fruitMesh.instanceColor.needsUpdate = true;
    this.halo.geometry.attributes.position.needsUpdate = true;
  }

  /** Distortion, rings and stars: all zeroed when not playing. */
  private layoutFx(t: number) {
    const on = t >= 0;
    const T = this.T;
    this.haze.set(this.tmpA.set(T.x, 0, T.z), on ? 0.01 * ss(2.6, 3.2, t) * (1 - ss(7.0, 8.0, t)) : 0, t, 1.6);

    // Seed ring and sprout ring + refraction.
    const pa = (t - 2.0) / 0.7;
    this.ringA.mesh.position.set(T.x, 0.06, T.z);
    this.ringA.mesh.scale.setScalar(0.3 + 2.7 * outCubic(pa));
    this.ringA.material.opacity = on && pa > 0 && pa < 1 ? 0.5 * (1 - pa) : 0;
    const pb = (t - SPROUT) / 0.9;
    this.ringB.mesh.position.set(T.x, 0.07, T.z);
    this.ringB.mesh.scale.setScalar(0.5 + 6 * outCubic(pb));
    this.ringB.material.opacity = on && pb > 0 && pb < 1 ? 0.5 * (1 - pb) : 0;
    const q = (t - SPROUT) / 0.7;
    this.sproutShock.set(this.tmpA.set(T.x, 0.1, T.z), lerp(0.4, 6, outCubic(q)), on && q > 0 && q < 1 ? 0.03 * (1 - q) * (1 - q) : 0);

    // Fruit landings.
    for (let i = 0; i < FRUIT_MAX; i++) {
      const f = this.fruit[i];
      const ring = this.landRings[i];
      const age = f ? t - f.tl : -1;
      const live = on && !!f && age >= 0 && age < 0.55;
      const p = clamp(age / 0.5, 0, 1);
      if (f) ring.mesh.position.set(T.x + f.G.x, 0.08, T.z + f.G.z);
      ring.mesh.scale.setScalar(0.4 + 2.2 * outCubic(p));
      ring.material.opacity = live ? 0.55 * (1 - p) : 0;
      if (i < MAXT * 2) {
        const star = this.landStars[i];
        const sh = this.landShocks[i];
        const hitLive = on && !!f && f.hit && age >= 0;
        if (hitLive) {
          const pop = StarBurst.pop(age, 0.03, 0.1);
          star.set(this.tmpA.set(T.x + f.G.x, 1.4, T.z + f.G.z), 1.15 * pop.scale, pop.opacity, age * 3);
          const qq = clamp(age / 0.45, 0, 1);
          sh.set(this.tmpB.set(T.x + f.G.x, 0.1, T.z + f.G.z), lerp(0.4, 3.4, outCubic(qq)), age < 0.45 ? 0.03 * (1 - qq) * (1 - qq) : 0);
        } else {
          star.set(this.tmpA, 0, 0);
          sh.set(this.tmpB, 1, 0);
        }
      }
    }

    // Final bloom pulse: a thin green ring and one wide refraction ring.
    const pp = (t - PULSE) / 1.0;
    this.pulseRing.mesh.position.set(T.x, 0.1, T.z);
    this.pulseRing.mesh.scale.setScalar(lerp(2, 16, outCubic(pp)));
    this.pulseRing.material.opacity = on && pp > 0 && pp < 1 ? 0.5 * (1 - pp) : 0;
    this.pulseShock.set(this.tmpA.set(T.x, 0.1, T.z), lerp(2, 16, outCubic(pp)), on && pp > 0 && pp < 1 ? 0.05 * (1 - pp) * (1 - pp) : 0);
  }

  private layoutScreen(t: number) {
    const on = t >= 0;
    const scr = this.screen;
    scr.darken = on ? 0.16 * ss(10.8, 11.3, t) * (1 - ss(13.9, 14.3, t)) : 0;
    scr.impact = on ? impactFrameAt(t, PULSE, [1, 2], 0.04) : 0;
    scr.chroma = on ? chromaPulse(t, PULSE, 0.5, 9) : 0;
    scr.speedLines = 0;
    if (on) scr.focus.copy(this.C).setY(1.2);
    this.shake = on ? this.kick : 0;
  }
}

export const worldTreeRisingModule: EffectModule = {
  label: 'world tree rising',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 8 },
  create: () => new WorldTreeRising(),
  telegraphs(effect) {
    return (effect as WorldTreeRising).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as WorldTreeRising;
    if (e.ctx) frameCast(camera, controls, e.ctx, 22);
  },
  buildGui(f, effect) {
    const s = (effect as WorldTreeRising).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
