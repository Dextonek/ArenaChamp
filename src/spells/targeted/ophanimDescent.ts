import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  ShockRefraction, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic, createScreenFx, flashBeat,
  impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ophanim Descent (targeted ground AoE, radius 7, hero tier, ~22 s cutscene): a "biblically accurate" angel. Three
 * interlocking bronze wheels (within wheels), covered in drawn eyes, descend through a split in a storm-cloud ring.
 * Their lids are shut while they settle 11 m above the point; after a dead beat every eye snaps open at once and
 * looks at the enemies. Six ivory wings unfold behind them, then every eye fires a thin gold-and-blue beam in a
 * cascade (three volleys, each leaving a gold ground burn), and a final converged beam from all eyes hits the point.
 * The eyes close, the wings fold and the wheels rise back up through the closing clouds.
 *
 * The eyes are the hero: each one is an instanced quad on a wheel face, drawn in a fragment shader (almond opening,
 * pale sclera, blue iris with a dark limbal ring, black pupil, glint, bronze lid skin with an ink outline). Per eye
 * the lid openness, the pupil direction and the fire glow are instanced attributes computed from the clock. The
 * bronze wheels are lit PBR metal with a drawn glyph texture and do NOT glow; only the pupils' glints, the beam
 * cores and the flashes pass the bloom threshold.
 *
 * Everything is a pure function of the clock `time` (hits and emitter bursts fire when the clock crosses them), so
 * scrubbing works. Camera: scripted with `cinematic`, every shot placed explicitly (no auto-fit) and clamped to 26
 * from its look-at. The cutscene draws its own sky dome (main.ts hides the stage sky during a cinematic).
 *
 * Design: pipeline/designs/ophanim-descent.md.
 *
 * Timeline (seconds):
 *  0 omen (low wide behind caster, clouds gather, part, rays) | 3 descent (cut, ground level looking up) |
 *  6 wide side (wheels settle) | 8 close on one wheel (lids shut, dead beat, lids snap open at 8.5) | 9.4 wide (all
 *  eyes open) | 11 wings (slow orbit) | 13 judgement (cut, behind and above; volleys 13.4 / 14.2 / 15.0) |
 *  15.6 final beam (cut, ground level; impact frames, shell, refraction) | 16.4 ascension (wide) | 20 calm | 22 end
 */
export interface OphanimDescentSettings {
  damage: number;
  loop: boolean;
}

export const defaultOphanimDescent = (): OphanimDescentSettings => ({ damage: 70, loop: false });

const DURATION = 22;
const RADIUS = 7;
const T_TELE = 8.0;
const T_OPEN = 8.5;
const T_FINAL = 15.6;
const T_VOLLEY = [13.4, 14.2, 15.0, T_FINAL];
const HIT_DAMAGE = 20;
const CAM_MAX = 26;
const SETTLE_Y = 12;
const WHEEL_K = 1.3;

// Palette (core -> hot -> body -> accent -> dark).
const GOLD = 0xffd36a;
const BLUE = 0x5ab8ff;
const VOID = 0x07060c;

const TUBE = 0.42;
const FLAT = 0.55;
const FACE_Z = TUBE * FLAT + 0.02;
const EYE_W = 1.25;
const EYE_H = EYE_W / 1.76;

interface WheelDef {
  R: number;
  n: number;
  tilt: [number, number, number];
  axis: [number, number, number];
  wp: number;
  ws: number;
}

const WHEELS: WheelDef[] = [
  { R: 6, n: 28, tilt: [-1.15, 0, 0.2], axis: [0, 1, 0], wp: 0.3, ws: 0.5 },
  { R: 5, n: 24, tilt: [0, Math.PI / 2 + 0.25, 0], axis: [1, 0, 0.25], wp: -0.42, ws: -0.35 },
  { R: 4, n: 18, tilt: [0.9, 0.5, 0], axis: [0.3, 0.8, 0.5], wp: 0.62, ws: 0.45 },
];
const EYES_TOTAL = WHEELS.reduce((a, w) => a + w.n * 2, 0);

const VOLLEYS = [
  { spread: 0.7, dur: 0.3, width: 1, every: 3 },
  { spread: 0.7, dur: 0.3, width: 1, every: 3 },
  { spread: 0.7, dur: 0.3, width: 1, every: 3 },
  { spread: 0.14, dur: 0.6, width: 1, every: 4 },
];
const RING_R = [6.0, 4.3, 2.6];

const CLOUDS = 34;
const CLOUD_Y = 26;
const RAYS = 9;
const FEATHERS = 24;
const WING_TIERS = [
  { open: 0.95, len: 10, y: 0.9 },
  { open: 0.2, len: 12, y: 0, },
  { open: -0.55, len: 9, y: -0.9 },
];
const BURNS = 3 * EYES_TOTAL + 1;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const UP = v3(0, 1, 0);
const AXIS_Z = v3(0, 0, 1);

/** Small deterministic random generator (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Drawn textures ---------------------------------------------------------------------------------------

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

/** Aged bronze: dark rim bands, panel grooves and engraved glyph bands on the two faces (u along the ring, v round the tube). */
function bronzeTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(1024, 128, (g) => {
    const rnd = rng(7);
    g.fillStyle = '#8a6a34';
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#5e4622';
    for (const [y0, y1] of [[0, 10], [54, 74], [118, 128]]) g.fillRect(0, y0, 1024, y1 - y0);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(20,12,4,0.14)' : 'rgba(230,200,130,0.10)';
      g.fillRect(rnd() * 1024, rnd() * 128, 2 + rnd() * 5, 1 + rnd() * 2);
    }
    for (const yc of [32, 96]) {
      g.strokeStyle = '#3a2a10';
      g.lineWidth = 3;
      for (const dy of [-23, 23]) {
        g.beginPath();
        g.moveTo(0, yc + dy);
        g.lineTo(1024, yc + dy);
        g.stroke();
      }
      for (let x = 10; x < 1024; x += 26) {
        const k = Math.floor(rnd() * 5);
        g.beginPath();
        if (k === 0) { g.moveTo(x, yc - 12); g.lineTo(x, yc + 12); g.moveTo(x - 7, yc - 3); g.lineTo(x + 7, yc - 3); }
        else if (k === 1) g.arc(x, yc, 8, 0, Math.PI * 2);
        else if (k === 2) { g.moveTo(x - 8, yc + 10); g.lineTo(x, yc - 10); g.lineTo(x + 8, yc + 10); }
        else if (k === 3) { g.moveTo(x - 8, yc - 8); g.lineTo(x + 8, yc + 8); g.moveTo(x + 8, yc - 8); g.lineTo(x - 8, yc + 8); }
        else { g.moveTo(x - 9, yc); g.lineTo(x + 9, yc); g.moveTo(x, yc - 9); g.lineTo(x, yc + 9); }
        g.lineWidth = 3;
        g.strokeStyle = '#3a2a10';
        g.stroke();
      }
    }
    g.strokeStyle = '#3a2a10';
    g.lineWidth = 4;
    for (let x = 0; x < 1024; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 128);
      g.stroke();
    }
    g.fillStyle = '#b8924a';
    for (let x = 12; x < 1024; x += 128) for (const y of [8, 120, 64]) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** A fan of ivory feathers with gold edges: three rows (long flight feathers, coverts, down). Pivot near the left. */
function wingTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 384, (g) => {
    const px = 24, py = 270;
    const rows = [
      { n: 11, len: 480, a0: -8, a1: 52, fill: '#e2d9bd', w: 34 },
      { n: 12, len: 290, a0: -2, a1: 70, fill: '#ebe3c9', w: 26 },
      { n: 14, len: 150, a0: 4, a1: 88, fill: '#f2ecd6', w: 18 },
    ];
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const f = i / (r.n - 1);
        const a = THREE.MathUtils.degToRad(lerp(r.a0, r.a1, f));
        const len = r.len * (1 - 0.34 * Math.pow(f, 1.2));
        const dx = Math.cos(a), dy = -Math.sin(a);
        const tx = px + dx * len, ty = py + dy * len;
        const mx = px + dx * len * 0.55, my = py + dy * len * 0.55;
        const nx = -dy, ny = dx;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(mx + nx * r.w, my + ny * r.w, tx, ty);
        g.quadraticCurveTo(mx - nx * r.w * 0.6, my - ny * r.w * 0.6, px, py);
        g.closePath();
        g.fillStyle = r.fill;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#c79a3e';
        g.stroke();
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(tx, ty);
        g.lineWidth = 2;
        g.strokeStyle = '#a8946a';
        g.stroke();
      }
    }
  });
}

/** One falling feather. */
function featherTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 128, (g) => {
    g.beginPath();
    g.moveTo(32, 122);
    g.quadraticCurveTo(62, 70, 32, 6);
    g.quadraticCurveTo(2, 70, 32, 122);
    g.fillStyle = '#ece4cc';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#c79a3e';
    g.stroke();
    g.beginPath();
    g.moveTo(32, 124);
    g.lineTo(32, 10);
    g.lineWidth = 2;
    g.strokeStyle = '#a8946a';
    g.stroke();
  });
}

/** A toon storm cloud: overlapping puffs, dark outline, a paler rim light on top. */
function cloudTexture(seed: number): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = rng(seed);
    const puffs: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) puffs.push([60 + rnd() * 136, 130 + (rnd() - 0.4) * 60, 34 + rnd() * 30]);
    for (const [pass, col, dy] of [[0, '#0e1226', 0], [1, '#222a4a', 0], [2, '#3a4570', -9]] as const) {
      for (const [x, y, r] of puffs) {
        g.beginPath();
        g.arc(x, y + dy, pass === 0 ? r + 5 : pass === 1 ? r : r * 0.8, 0, Math.PI * 2);
        g.fillStyle = col;
        g.fill();
      }
    }
    const fade = g.createRadialGradient(128, 128, 60, 128, 128, 128);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'source-over';
  });
}

/** A tapered god ray: wide and bright at the top, narrowing and fading toward the ground. */
function rayTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 256, (g) => {
    for (let y = 0; y < 256; y++) {
      const f = y / 255;
      const half = lerp(30, 7, f);
      const a = Math.pow(1 - f, 0.8) * 0.9;
      const gr = g.createLinearGradient(32 - half, 0, 32 + half, 0);
      gr.addColorStop(0, 'rgba(255,230,160,0)');
      gr.addColorStop(0.5, `rgba(255,230,160,${a})`);
      gr.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = gr;
      g.fillRect(32 - half, y, half * 2, 1);
    }
  });
}

/** Ground burn: a ragged soot blotch with a broken gold rim and a few gold cracks. */
function burnTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const rnd = rng(21);
    const soot = g.createRadialGradient(128, 128, 0, 128, 128, 112);
    soot.addColorStop(0, 'rgba(8,6,12,0.9)');
    soot.addColorStop(0.7, 'rgba(8,6,12,0.75)');
    soot.addColorStop(1, 'rgba(8,6,12,0)');
    g.fillStyle = soot;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = 70 + rnd() * 30;
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 10 + rnd() * 14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(8,6,12,0.7)';
      g.fill();
    }
    g.strokeStyle = '#b8903a';
    g.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 + rnd() * 0.2;
      g.beginPath();
      g.arc(128, 128, 84 + rnd() * 6, a0, a0 + 0.4 + rnd() * 0.3);
      g.stroke();
    }
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 20, 128 + Math.sin(a) * 20);
      g.lineTo(128 + Math.cos(a + 0.2) * 74, 128 + Math.sin(a + 0.2) * 74);
      g.stroke();
    }
  });
}

/** A toon flame: gold outer teardrop, paler middle, near-white tiny core. */
function flameTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 256, (g) => {
    const drop = (cx: number, base: number, top: number, w: number, col: string) => {
      g.beginPath();
      g.moveTo(cx, top);
      g.bezierCurveTo(cx + w * 0.2, top + (base - top) * 0.35, cx + w, base - (base - top) * 0.35, cx + w * 0.6, base - 8);
      g.quadraticCurveTo(cx, base + 6, cx - w * 0.6, base - 8);
      g.bezierCurveTo(cx - w, base - (base - top) * 0.35, cx - w * 0.2, top + (base - top) * 0.35, cx, top);
      g.closePath();
      g.fillStyle = col;
      g.fill();
    };
    drop(64, 244, 8, 54, '#07060c');
    drop(64, 238, 16, 48, '#f2b53c');
    drop(64, 232, 70, 32, '#ffe39a');
    drop(64, 226, 130, 17, '#fffbe8');
  });
}

// --- The eye ----------------------------------------------------------------------------------------------

const eyeVertex = /* glsl */ `
  attribute float aOpen;
  attribute vec2 aLook;
  attribute float aGlow;
  varying vec2 vUv;
  varying float vOpen;
  varying vec2 vLook;
  varying float vGlow;
  void main() {
    vUv = uv;
    vOpen = aOpen;
    vLook = aLook;
    vGlow = aGlow;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// q spans x -0.88..0.88, y -0.5..0.5 (the quad aspect is 1.76). Almond opening scaled by vOpen, lid skin around it.
const eyeFragment = /* glsl */ `
  uniform vec3 uSclera, uIris, uIris2, uRing, uLid, uInk, uGold, uHot;
  varying vec2 vUv;
  varying float vOpen;
  varying vec2 vLook;
  varying float vGlow;
  void main() {
    vec2 q = (vUv - 0.5) * vec2(1.76, 1.0);
    float u = q.x / 0.88;
    if (abs(u) > 1.0) discard;
    float aa = 0.012;
    float body = pow(max(1.0 - u * u, 0.0), 0.8);
    float hh = 0.36 * vOpen * body;
    float ay = abs(q.y);
    float band = hh + 0.09 * body + 0.02;
    if (ay > band + aa) discard;
    float inside = 1.0 - smoothstep(-aa, aa, ay - hh);

    float lt = clamp((ay - hh) / max(band - hh, 0.001), 0.0, 1.0);
    vec3 lid = mix(uLid * 1.15, uLid * 0.65, lt);
    lid = mix(lid, uInk, smoothstep(0.8, 1.0, lt));

    float dEdge = hh - ay;
    vec3 ball = mix(uSclera * 0.5, uSclera, smoothstep(0.0, 0.11, dEdge));
    ball = mix(ball, ball * vec3(0.8, 0.9, 1.1), u * u);
    vec2 ic = vLook * vec2(0.19, 0.08);
    vec2 dv = q - ic;
    float d = length(dv);
    float R = 0.3;
    float irisM = 1.0 - smoothstep(R - aa, R + aa, d);
    float streak = 0.85 + 0.15 * sin(atan(dv.y, dv.x) * 16.0);
    vec3 iris = mix(uIris2, uIris, smoothstep(0.08, R, d)) * streak;
    iris = mix(iris, uRing, smoothstep(R - 0.06, R - 0.005, d));
    vec3 col = mix(ball, iris, irisM);
    float pr = 0.12;
    float pupilM = 1.0 - smoothstep(pr - aa, pr + aa, d);
    col = mix(col, uInk, pupilM);

    col += uGold * 1.3 * vGlow * irisM * (1.0 - pupilM);
    col = mix(col, uHot * 2.4, pupilM * vGlow);
    float gd = length(q - ic - vec2(-0.085, 0.09));
    col += uHot * 1.7 * (1.0 - smoothstep(0.03, 0.045, gd)) * step(0.25, vOpen);
    col *= mix(0.55, 1.0, smoothstep(0.0, 0.07, dEdge));

    vec3 outc = mix(lid, col, inside);
    float edgeLine = 1.0 - smoothstep(0.012, 0.026, abs(dEdge));
    outc = mix(outc, uInk, edgeLine);
    float alpha = 1.0 - smoothstep(band - aa, band + aa, ay);
    gl_FragColor = vec4(outc, alpha);
    #include <colorspace_fragment>
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop, uHorizon, uGlow;
  uniform float uGlowAmt;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.6, h));
    col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.2, h));
    col += uGlow * uGlowAmt * smoothstep(0.55, 1.0, h);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// --- The effect -------------------------------------------------------------------------------------------

interface Eye {
  w: number;
  slot: number;
  i: number;
  lp: THREE.Vector3;
  lx: THREE.Vector3;
  ly: THREE.Vector3;
  ln: THREE.Vector3;
}

interface Cloud {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  a: number;
  R: number;
  y: number;
  size: number;
  spin: number;
}

interface Wing {
  pg: THREE.Group;
  mesh: THREE.Mesh;
  tier: number;
  side: number;
}

export class OphanimDescent implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OphanimDescentSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitsFired = [false, false, false, false];
  private motesDone = false;
  private keys: ShotKey[] = [];

  // Cast geometry. back points from the point toward the caster, right is the horizontal axis across the shot.
  private C = v3();
  private P0 = v3(0, 0, 12);
  private back = v3(0, 0, 1);
  private right = v3(1, 0, 0);

  // Eye logic (cast): where each eye looks by default, aims and fire times per volley.
  private eyes: Eye[] = [];
  private gaze: THREE.Vector3[] = [];
  private aim: THREE.Vector3[][] = [];
  private fireT: number[][] = [];
  private burnR: number[][] = [];

  // Wheel orientation helpers.
  private wAxis: THREE.Vector3[] = WHEELS.map((d) => v3(...d.axis).normalize());
  private wTilt: THREE.Quaternion[] = WHEELS.map((d) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...d.tilt)));
  private wq: THREE.Quaternion[] = WHEELS.map(() => new THREE.Quaternion());
  private wm: THREE.Matrix4[] = WHEELS.map(() => new THREE.Matrix4());

  // Parts.
  private skyU = {
    uTop: { value: new THREE.Color(0x1b2448) }, uHorizon: { value: new THREE.Color(0x3a3a5a) },
    uGlow: { value: new THREE.Color(GOLD) }, uGlowAmt: { value: 0 },
  };
  private sky: THREE.Mesh;
  private clouds: Cloud[] = [];
  private holeGlow: THREE.Sprite;
  private rays: THREE.Mesh[] = [];
  private rayMat: THREE.MeshBasicMaterial;
  private pool: THREE.Mesh;
  private wheelGroups: THREE.Group[] = [];
  private eyeMeshes: THREE.InstancedMesh[] = [];
  private eyeOpen: THREE.InstancedBufferAttribute[] = [];
  private eyeLook: THREE.InstancedBufferAttribute[] = [];
  private eyeGlow: THREE.InstancedBufferAttribute[] = [];
  private hubRoot = new THREE.Group();
  private flame: THREE.Sprite;
  private flameMat: THREE.SpriteMaterial;
  private coreStar = new StarBurst({ points: 4, inner: 0.16, jitter: 0.1, color: GOLD, core: 0xfff4d6 });
  private hubLight = new THREE.PointLight(0xffd890, 0, 70, 1.5);
  private groundLight = new THREE.PointLight(0xffd890, 0, 60, 1.5);
  private wings: Wing[] = [];
  private wingMat!: THREE.MeshBasicMaterial;
  private feathers: THREE.InstancedMesh;
  private featherSeed: { x: number; z: number; y: number; t0: number; ph: number }[] = [];
  private beamCore: THREE.InstancedMesh;
  private beamEdge: THREE.InstancedMesh;
  private burns: THREE.InstancedMesh;
  private flashes: THREE.InstancedMesh;
  private burnMat: THREE.MeshBasicMaterial;
  private flashMat: THREE.MeshBasicMaterial;
  private beamsOn = false;
  private burnsOn = false;
  private lens = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private shocks: ShockRefraction[] = [];
  private bigShock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private shell: THREE.Mesh;
  private shellMat: THREE.MeshBasicMaterial;
  private inkRing: THREE.Mesh;
  private inkMat: THREE.MeshBasicMaterial;
  private goldRing = createRing(GOLD, 0.9, 1, 96);
  private pillar: THREE.Mesh;
  private pillarMat: THREE.MeshBasicMaterial;
  private finalStar = new StarBurst({ points: 12, inner: 0.3, color: 0xffc247, core: 0xfffbe8 });
  private motes: Emitter;
  private sparks: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpD = v3();
  private spinQ = new THREE.Quaternion();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = v3();

  constructor(settings: OphanimDescentSettings = defaultOphanimDescent()) {
    this.settings = settings;
    this.screen.tint.set(0x2a3358);
    this.screen.impactColor.set(GOLD);
    this.screen.edgeTint.set(GOLD);
    this.screen.speedLineColor.set(0xfff4d6);
    this.screen.keepHue.set(BLUE);
    this.screen.whiteColor.set(0xfff0c8);

    // Sky dome (main.ts hides the stage sky during a cinematic).
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: this.skyU,
        vertexShader: skyVertex, fragmentShader: skyFragment,
      }),
    );
    this.sky.renderOrder = -5;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    // Clouds (a ring of toon storm sprites), the glow in the hole, god rays and the pool of light on the ground.
    const rc = rng(5);
    const cloudTex = [cloudTexture(11), cloudTexture(23), cloudTexture(37)];
    for (let i = 0; i < CLOUDS; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex[i % 3], color: 0x8a92b8, transparent: true, opacity: 0, depthWrite: false, fog: false,
      });
      mat.rotation = (rc() - 0.5) * 0.5;
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);
      this.clouds.push({
        sprite, mat, a: (i / CLOUDS) * Math.PI * 2 + rc() * 0.4, R: 15 + rc() * 14, y: CLOUD_Y - 0.5 + rc() * 3.5,
        size: 9 + rc() * 6, spin: 0.02 + rc() * 0.03,
      });
    }
    this.holeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.holeGlow.scale.setScalar(26);
    this.holeGlow.visible = false;
    this.group.add(this.holeGlow);

    this.rayMat = new THREE.MeshBasicMaterial({
      map: rayTexture(), color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, fog: false,
    });
    const rayGeo = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
    const rr = rng(9);
    for (let i = 0; i < RAYS; i++) {
      const m = new THREE.Mesh(rayGeo, this.rayMat);
      const a = (i / RAYS) * Math.PI * 2 + rr() * 0.5, r = 1 + rr() * 6.5;
      m.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, w: 2.2 + rr() * 2.6, ph: rr() * 6.28 };
      m.frustumCulled = false;
      m.visible = false;
      m.onBeforeRender = (_r, _s, camera) => {
        this.tmpS.setFromMatrixPosition(m.matrixWorld);
        m.rotation.y = Math.atan2(camera.position.x - this.tmpS.x, camera.position.z - this.tmpS.z);
        m.updateMatrixWorld(true);
      };
      this.rays.push(m);
      this.group.add(m);
    }
    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        map: softDotTexture(), color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.visible = false;
    this.group.add(this.pool);

    this.buildWheels();
    this.buildWings();

    // Falling feathers.
    const rf = rng(77);
    const fMat = new THREE.MeshBasicMaterial({
      map: featherTexture(), color: 0xd8d0b8, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    this.feathers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.55, 1.1), fMat, FEATHERS);
    this.feathers.frustumCulled = false;
    this.group.add(this.feathers);
    for (let i = 0; i < FEATHERS; i++) {
      const a = rf() * Math.PI * 2, r = 2.5 + rf() * 8;
      this.featherSeed.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: SETTLE_Y + (rf() - 0.5) * 7, t0: 11.2 + rf() * 2.4, ph: rf() * 6.28 });
    }

    // Beams: a thin gold-white core inside a blue edge, both instanced thin cylinders.
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
    this.beamEdge = new THREE.InstancedMesh(
      beamGeo, new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      EYES_TOTAL,
    );
    this.beamCore = new THREE.InstancedMesh(
      beamGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      EYES_TOTAL,
    );
    for (const b of [this.beamEdge, this.beamCore]) {
      b.frustumCulled = false;
      b.renderOrder = 6;
      b.visible = false;
      this.group.add(b);
    }

    // Ground burns (soot with a gold rim) and the brief gold flash under each impact.
    this.burnMat = new THREE.MeshBasicMaterial({
      map: burnTexture(), transparent: true, opacity: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.flashMat = new THREE.MeshBasicMaterial({
      map: softDotTexture(), color: GOLD, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    const flat = new THREE.PlaneGeometry(1, 1);
    this.burns = new THREE.InstancedMesh(flat, this.burnMat, BURNS);
    this.flashes = new THREE.InstancedMesh(flat, this.flashMat, BURNS);
    for (const m of [this.burns, this.flashes]) {
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
    }

    // Distortion: a lens around the core, six pooled ground rings under beam impacts, one big ring at the final hit.
    this.group.add(this.lens.mesh, this.bigShock.mesh);
    for (let i = 0; i < 6; i++) {
      const s = new ShockRefraction({ facing: 'ground', width: 0.3 });
      this.shocks.push(s);
      this.group.add(s.mesh);
    }

    // Final payoff: gold toon shell, ink ring, gold ring, pillar, star.
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0xf2b53c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.shellMat);
    this.inkMat = new THREE.MeshBasicMaterial({ color: VOID, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.inkRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), this.inkMat);
    this.inkRing.rotation.x = -Math.PI / 2;
    this.pillarMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0), this.pillarMat);
    for (const o of [this.shell, this.inkRing, this.pillar, this.goldRing.mesh]) {
      o.visible = false;
      o.frustumCulled = false;
      this.group.add(o);
    }
    this.group.add(this.finalStar.mesh);

    // Core flame + glint at the centre of the wheels.
    this.flameMat = new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, fog: false });
    this.flame = new THREE.Sprite(this.flameMat);
    this.flame.center.set(0.5, 0.18);
    this.hubRoot.add(this.flame, this.coreStar.mesh);
    this.group.add(this.hubRoot, this.hubLight, this.groundLight);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.motes = em({
      maxParticles: 400, lifetime: 4.2, lifetimeJitter: 0.4, shapeSize: 8, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0.35,
      drag: 1.0, sizeStart: 0.16, sizeEnd: 0.05, colorStart: '#ffe39a', colorEnd: '#f2b53c', opacityStart: 0.8, opacityEnd: 0, additive: true,
      sizeJitter: 0.5,
    });
    this.sparks = em({
      maxParticles: 500, lifetime: 1.2, lifetimeJitter: 0.5, shapeSize: 0.6, speed: 9, speedJitter: 0.6, spread: 85, gravity: 6, drag: 0.8,
      sizeStart: 0.2, sizeEnd: 0.04, colorStart: '#fff4d6', colorEnd: '#f2b53c', opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- Construction helpers ------------------------------------------------------------------------------

  private buildWheels() {
    const bronze = new THREE.MeshStandardMaterial({ map: bronzeTexture(), color: 0xffffff, roughness: 0.45, metalness: 0.75 });
    const col = (hex: number) => ({ value: new THREE.Color(hex) });
    const eyeMat = new THREE.ShaderMaterial({
      vertexShader: eyeVertex,
      fragmentShader: eyeFragment,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: {
        uSclera: col(0xc9c1a4), uIris: col(0x2a6fc0), uIris2: col(0x7fd0ff), uRing: col(0x0a1a38), uLid: col(0x9a7a3c),
        uInk: col(VOID), uGold: col(0xffc247), uHot: col(0xfff4d6),
      },
    });
    WHEELS.forEach((d, w) => {
      // Flattened torus: squash z, and fix the normals for the squash.
      const tg = new THREE.TorusGeometry(d.R, TUBE, 14, 128);
      const p = tg.attributes.position, n = tg.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, p.getZ(i) * FLAT);
        this.tmpA.set(n.getX(i), n.getY(i), n.getZ(i) / FLAT).normalize();
        n.setXYZ(i, this.tmpA.x, this.tmpA.y, this.tmpA.z);
      }
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tg, bronze));

      const count = d.n * 2;
      const geo = new THREE.PlaneGeometry(1, 1);
      const aOpen = new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
      const aLook = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
      const aGlow = new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aOpen', aOpen);
      geo.setAttribute('aLook', aLook);
      geo.setAttribute('aGlow', aGlow);
      const mesh = new THREE.InstancedMesh(geo, eyeMat, count);
      mesh.frustumCulled = false;
      let slot = 0;
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < d.n; i++) {
          const th = ((i + 0.5 * f) / d.n) * Math.PI * 2;
          const c = Math.cos(th), s = Math.sin(th);
          const t = v3(-s, c, 0), r = v3(c, s, 0);
          const eye: Eye = {
            w, slot, i, lp: v3(d.R * c, d.R * s, f ? -FACE_Z : FACE_Z), lx: t,
            ly: f ? r.clone() : r.clone().negate(), ln: v3(0, 0, f ? -1 : 1),
          };
          this.tmpM.makeBasis(eye.lx.clone().multiplyScalar(EYE_W), eye.ly.clone().multiplyScalar(EYE_H), eye.ln);
          this.tmpM.setPosition(eye.lp);
          mesh.setMatrixAt(slot, this.tmpM);
          this.eyes.push(eye);
          slot++;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
      g.visible = false;
      this.group.add(g);
      this.wheelGroups.push(g);
      this.eyeMeshes.push(mesh);
      this.eyeOpen.push(aOpen);
      this.eyeLook.push(aLook);
      this.eyeGlow.push(aGlow);
    });
  }

  private buildWings() {
    this.wingMat = new THREE.MeshBasicMaterial({
      map: wingTexture(), color: 0xd0c8b0, transparent: true, alphaTest: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    for (const side of [1, -1]) {
      WING_TIERS.forEach((tr, tier) => {
        const W = tr.len, H = W * 0.75;
        const geo = new THREE.PlaneGeometry(W, H).translate(W / 2 - W * (24 / 512), H / 2 - H * (1 - 270 / 384), 0);
        const mesh = new THREE.Mesh(geo, this.wingMat);
        mesh.frustumCulled = false;
        const pg = new THREE.Group();
        pg.scale.x = side;
        pg.add(mesh);
        pg.visible = false;
        this.hubRoot.add(pg);
        this.wings.push({ pg, mesh, tier, side });
      });
    }
  }

  // --- Cast, path and camera keys ------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.C.copy(ctx.point).setY(0);
    this.P0.copy(ctx.from).setY(0);
    this.back.copy(this.P0).sub(this.C).setY(0);
    if (this.back.lengthSq() < 1e-4) this.back.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    if (this.back.lengthSq() < 1e-4) this.back.set(0, 0, 1);
    this.back.normalize();
    // right = (-fwd.z, 0, fwd.x) with fwd = -back, so that (right, up, back) is right-handed.
    this.right.set(this.back.z, 0, -this.back.x);
    this.buildAims();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), ...this.wheelGroups];
    this.buildKeys();
    this.reset();
  }

  /** Seeded aim points and fire times for every eye and volley (ring pattern on the ground, some beams on the enemies). */
  private buildAims() {
    const ctx = this.ctx;
    const nT = ctx ? ctx.targets.length : 0;
    const rand = rng(1337);
    const N = EYES_TOTAL;
    this.aim = [];
    this.fireT = [];
    this.burnR = [];
    this.gaze = [];
    for (let k = 0; k < N; k++) {
      this.gaze.push(nT > 0 ? ctx!.targetPos[k % nT].clone().setY(1.2) : this.C.clone().setY(1.2));
    }
    VOLLEYS.forEach((vo, v) => {
      const aims: THREE.Vector3[] = [];
      const times: number[] = [];
      const radii: number[] = [];
      const order = Array.from({ length: N }, (_, i) => i);
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (let k = 0; k < N; k++) {
        const rank = order[k];
        times.push((k + v) % vo.every === 0 ? T_VOLLEY[v] + (vo.spread * rank) / (N - 1) : 1e9);
        if (v === 3) {
          const a = rand() * Math.PI * 2;
          aims.push(v3(this.C.x + Math.cos(a) * 0.3 * rand(), 0.05, this.C.z + Math.sin(a) * 0.3 * rand()));
          radii.push(0);
        } else if (nT > 0 && rand() < 0.35) {
          aims.push(ctx!.targetPos[(k + v) % nT].clone().setY(1.1));
          radii.push(0.7 + rand() * 0.6);
        } else {
          const a = (((k * 37 + v * 11) % N) / N) * Math.PI * 2 + (rand() - 0.5) * 0.25;
          const r = RING_R[v] + (rand() - 0.5) * 1.6;
          aims.push(v3(this.C.x + Math.cos(a) * r, 0.05, this.C.z + Math.sin(a) * r));
          radii.push(0.7 + rand() * 0.7);
        }
      }
      this.aim.push(aims);
      this.fireT.push(times);
      this.burnR.push(radii);
    });
  }

  private hubY(t: number): number {
    if (t < 3) return 40;
    if (t < 8) return lerp(40, SETTLE_Y, ss(3, 8, t));
    if (t < 16.6) return SETTLE_Y + 0.22 * Math.sin(t * 1.3);
    return lerp(SETTLE_Y, 46, ss(16.6, 20, t));
  }

  private hubScale(t: number): number {
    if (t < 8) return WHEEL_K * lerp(0.35, 1, ss(3, 8, t));
    return WHEEL_K * lerp(1, 0.55, ss(16.6, 20, t));
  }

  /** Spin phase: wheels speed up between 11 and 13. */
  private phase(t: number): number {
    const u = clamp((t - 11) / 2, 0, 1);
    const integral = t <= 13 ? 2 * (u * u * u - (u * u * u * u) / 2) : 1 + (t - 13);
    return t + 1.2 * (t <= 11 ? 0 : integral);
  }

  private wheelQuat(w: number, t: number, out: THREE.Quaternion) {
    const P = this.phase(t);
    out.setFromAxisAngle(this.wAxis[w], WHEELS[w].wp * P).multiply(this.wTilt[w]);
    out.multiply(this.spinQ.setFromAxisAngle(AXIS_Z, WHEELS[w].ws * P));
  }

  private wheelMatrix(w: number, t: number, out: THREE.Matrix4) {
    const q = new THREE.Quaternion();
    this.wheelQuat(w, t, q);
    const sc = this.hubScale(t);
    out.compose(v3(this.C.x, this.hubY(t), this.C.z), q, v3(sc, sc, sc));
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, back = this.back, right = this.right;
    const dirOf = (b: number, r: number, y: number) => v3().addScaledVector(back, b).addScaledVector(right, r).addScaledVector(UP, y).normalize();
    const push = (t: number, position: THREE.Vector3, target: THREE.Vector3, fov: number, o: { cut?: boolean; ease?: ShotKey['ease'] } = {}) => {
      keys.push({ t, position, target, fov, roll: 0, cut: o.cut, ease: o.ease ?? 'linear' });
    };
    const E = 0.001;

    // 1. Omen: low and wide from behind the caster, looking up at the sky over the point. Slow push.
    const aPos = this.P0.clone().addScaledVector(back, 6).addScaledVector(right, 2.5).setY(1.1);
    push(0, aPos, C.clone().setY(13), 66, { cut: true });
    push(3 - E, aPos.clone().addScaledVector(back, -4), C.clone().setY(15), 62);

    // 2. Descent: ground level beside the enemies, looking straight up at the cloud hole.
    const bPos = C.clone().addScaledVector(back, 6.5).addScaledVector(right, 3).setY(0.9);
    push(3, bPos, C.clone().setY(23), 72, { cut: true });
    push(6 - E, bPos.clone().addScaledVector(back, 0.6), C.clone().setY(19), 70);

    // 3. Wide side: the wheels settle. Contains all three wheels (hub 20 -> 11).
    const cT = C.clone().setY(17);
    const cDir = dirOf(0.35, 1, 0.12);
    push(6, cT.clone().addScaledVector(cDir, 24), cT, 66, { cut: true });
    push(8 - E, cT.clone().setY(13).addScaledVector(cDir, 23), cT.clone().setY(13), 66);

    // 4. Close on one wheel: a row of eyes, lids shut; the lids snap open at T_OPEN. The camera tracks the eye.
    const pick = this.pickCloseEye();
    for (let t = 8; t <= 9.4 + 1e-6; t += 0.1) {
      const f = this.eyeFrame(pick, t);
      const position = f.pos.clone().addScaledVector(f.n, 4.6).addScaledVector(f.tan, -0.4);
      if (position.y < 1) position.y = 1;
      push(Math.min(t, 9.4 - E), position, f.pos.clone().addScaledVector(f.tan, 0.9), 38, { cut: t === 8 });
    }

    // 5. Wide: every eye open and looking at the enemies.
    const eT = C.clone().setY(12);
    const eDir = dirOf(0.8, 0.55, 0.1);
    push(9.4, eT.clone().addScaledVector(eDir, 22), eT, 66, { cut: true });
    push(11 - E, eT.clone().addScaledVector(eDir, 20), eT, 66);

    // 6. Wings: a slow orbit at mid distance (starts three-quarter, ends from behind so the wings face the camera).
    const fT = C.clone().setY(13);
    for (let i = 0; i <= 4; i++) {
      const th = THREE.MathUtils.degToRad(lerp(35, 75, i / 4));
      const dir = v3().addScaledVector(right, Math.cos(th)).addScaledVector(back, Math.sin(th));
      const position = fT.clone().addScaledVector(dir, 23).setY(15);
      push(i === 4 ? 13 - E : 11 + i * 0.5, position, fT, 60, { cut: i === 0 });
    }

    // 7. Judgement: behind and above the wheels, looking down at the enemies and the beams.
    // Three-quarter view: the wheels end up upper-left, the enemies lower-right (look-at shifted along screen-right).
    const gA = C.clone().addScaledVector(back, 15).addScaledVector(right, 8).setY(15);
    const gB = C.clone().addScaledVector(back, 13).addScaledVector(right, 7).setY(14);
    const shiftOf = (p: THREE.Vector3) => {
      const d = C.clone().sub(p).setY(0).normalize();
      return C.clone().add(v3(-d.z, 0, d.x).multiplyScalar(4)).setY(6);
    };
    push(13, gA, shiftOf(gA), 70, { cut: true });
    push(T_FINAL - E, gB, shiftOf(gB), 70);

    // 8. Final beam: ground level, the converging beams and the targets in frame.
    const hT = C.clone().setY(5);
    push(T_FINAL, C.clone().addScaledVector(back, 13).addScaledVector(right, 6).setY(1.2), hT, 60, { cut: true });
    push(16.4 - E, C.clone().addScaledVector(back, 12).addScaledVector(right, 6).setY(1.4), hT.clone().setY(6), 60);

    // 9. Ascension: wide, tilting up with the wheels (the wheel stays within +-4 of the look-at height).
    for (let t = 16.4; t <= 20 + 1e-6; t += 0.25) {
      const ty = clamp(this.hubY(t), 13, 24);
      const target = C.clone().setY(ty);
      const position = C.clone().addScaledVector(back, 19).addScaledVector(right, 8).setY(9 + 0.45 * (ty - 13));
      push(Math.min(t, 20 - E), position, target, 66, { cut: t === 16.4 });
    }

    // 10. Calm: gameplay-like three-quarter view while the letterbox leaves.
    const jT = this.P0.clone().add(C).multiplyScalar(0.5).setY(1.2);
    const jDir = dirOf(0.62, 0.55, 0.5);
    push(20, jT.clone().addScaledVector(jDir, 20), jT, 42, { cut: true });
    push(DURATION, jT.clone().addScaledVector(jDir, 21), jT, 42);

    // Never further than CAM_MAX from the look-at, never under the floor.
    for (const k of keys) {
      const off = k.position.clone().sub(k.target);
      if (off.length() > CAM_MAX) k.position.copy(k.target).addScaledVector(off.normalize(), CAM_MAX);
      if (k.position.y < 0.7) k.position.y = 0.7;
    }
  }

  /** The eye on wheel 0 that faces the shot best at t = 8 (towards the caster side, mid-height). */
  private pickCloseEye(): number {
    const want = v3().addScaledVector(this.back, 0.85).addScaledVector(this.right, 0.35).addScaledVector(UP, 0.15).normalize();
    let best = 0, bestS = -Infinity;
    for (let k = 0; k < this.eyes.length; k++) {
      if (this.eyes[k].w !== 0) continue;
      const f = this.eyeFrame(k, 8);
      const sc = f.n.dot(want) - Math.abs(f.pos.y - SETTLE_Y) * 0.04;
      if (sc > bestS) { bestS = sc; best = k; }
    }
    return best;
  }

  /** World position, face normal and tangent of eye k at time t. */
  private eyeFrame(k: number, t: number) {
    const e = this.eyes[k];
    const m = new THREE.Matrix4();
    this.wheelMatrix(e.w, t, m);
    const q = new THREE.Quaternion();
    this.wheelQuat(e.w, t, q);
    return {
      pos: e.lp.clone().applyMatrix4(m), n: e.ln.clone().applyQuaternion(q), tan: e.lx.clone().applyQuaternion(q),
    };
  }

  /** Danger zone: the judgement circle. */
  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: T_TELE, impact: T_VOLLEY[0] }];
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
    this.hitsFired = [false, false, false, false];
    this.motesDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.time = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.layout();
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
    for (let i = 0; i < 4; i++) {
      if (!this.hitsFired[i] && t >= T_VOLLEY[i]) this.onHit(i);
    }
    if (!this.motesDone && t >= 18.8) {
      this.motesDone = true;
      this.motes.burst(170, this.tmpA.set(this.C.x, 15, this.C.z));
    }
    this.layout();
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

  private onHit(i: number) {
    this.hitsFired[i] = true;
    const final = i === 3;
    if (final) this.sparks.burst(300, this.tmpA.set(this.C.x, 0.6, this.C.z));
    const ctx = this.ctx;
    if (!ctx) return;
    for (const j of this.inRange()) {
      ctx.hit(ctx.targets[j], {
        damage: final ? this.settings.damage : HIT_DAMAGE, knock: final ? 10 : 2, from: this.safeFrom(ctx.targetPos[j]), color: '#ffd36a',
      });
    }
  }

  // --- Layout (pure function of time, apart from emitter bursts) -----------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    const c = this.C;

    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(20, 20.8, t));
      cin.active = t < 21.7;
    }

    const hy = on ? this.hubY(t) : 40;
    const sc = on ? this.hubScale(t) : 0.35;
    const wheelsOn = on && t >= 2.6 && t < 20.6;

    this.layoutSky(t);
    this.layoutClouds(t);
    this.layoutWheels(t, wheelsOn, hy, sc);
    this.layoutEyes(t, wheelsOn);
    this.layoutHub(t, wheelsOn, hy, sc);
    this.layoutWings(t, wheelsOn);
    this.layoutFeathers(t);
    this.layoutBeams(t);
    this.layoutFinal(t);

    // Screen layer.
    const scr = this.screen;
    const judge = ss(13.0, 13.4, t) * (1 - ss(15.4, 15.6, t));
    scr.darken = on ? Math.max(0.38 * ss(0.2, 2.5, t) * (1 - ss(17, 20, t)), 0.5 * judge) : 0;
    scr.desaturate = on ? 0.45 * ss(9.0, 9.6, t) * (1 - ss(12.4, 13.4, t)) : 0;
    scr.impact = on ? impactFrameAt(t, T_FINAL, [1, 2], 0.04) : 0;
    scr.chroma = on ? chromaPulse(t, T_FINAL, 0.6, 7) : 0;
    scr.speedLines = on ? (t >= T_FINAL ? Math.max(0, 0.45 - (t - T_FINAL) * 3) : 0) : 0;
    if (on) {
      const fb = flashBeat(t, T_FINAL + 0.08, 0.04, 0.3, 0.1);
      scr.exposure = fb.exposure;
      scr.whiteout = fb.whiteout * 0.45;
      scr.focus.set(c.x, t >= T_FINAL ? 1.5 : hy, c.z);
    }

    let sh = 0;
    if (on) {
      sh = 0.05 * ss(0, 1, t) * (1 - ss(8, 8.5, t));
      sh = Math.max(sh, 0.2 * Math.exp(-Math.abs(t - T_OPEN - 0.25) * 4) * ss(T_OPEN - 0.1, T_OPEN, t));
      sh = Math.max(sh, 0.06 * ss(9.4, 10, t) * (1 - ss(13, 13.4, t)));
      for (let i = 0; i < 3; i++) {
        const a = t - T_VOLLEY[i];
        if (a >= 0 && a < 0.8) sh = Math.max(sh, 0.25 * Math.exp(-a * 3));
      }
      if (t >= T_FINAL) sh = Math.max(sh, 0.7 * Math.exp(-(t - T_FINAL) * 3.5));
      sh = Math.max(sh, 0.08 * ss(16.6, 17.2, t) * (1 - ss(19, 20, t)));
    }
    this.shake = sh;
  }

  private layoutSky(t: number) {
    const on = this.playing;
    const u = this.skyU;
    const s1 = on ? ss(0, 2.5, t) : 0;
    const s2 = on ? ss(17.5, 20, t) : 1;
    u.uTop.value.setHex(0x1b2448).lerp(this.tmpCol(0x080b16), s1).lerp(this.tmpCol(0x05070f), s2);
    u.uHorizon.value.setHex(0x3a3a5a).lerp(this.tmpCol(0x1a1e30), s1).lerp(this.tmpCol(0x232a40), s2);
    u.uGlowAmt.value = on ? 0.55 * ss(2.5, 5, t) * (1 - ss(17, 19.5, t)) : 0;
    this.sky.visible = on;
    this.sky.position.copy(this.C);
  }

  private colTmp = new THREE.Color();
  private tmpCol(hex: number) {
    return this.colTmp.setHex(hex);
  }

  private layoutClouds(t: number) {
    const on = this.playing;
    const c = this.C;
    const gather = ss(0, 1.8, t), part = ss(1.8, 4.2, t), close = ss(17.4, 19.8, t);
    for (const cl of this.clouds) {
      const rc = cl.R * 0.28, rf = cl.R * 1.5;
      let r = lerp(rf, rc, gather);
      r = lerp(r, cl.R, part);
      r = lerp(r, rc, close);
      const a = cl.a + cl.spin * Math.max(0, t);
      cl.sprite.position.set(c.x + Math.cos(a) * r, cl.y, c.z + Math.sin(a) * r);
      cl.sprite.scale.setScalar(cl.size * (0.9 + 0.1 * gather));
      cl.mat.opacity = on ? 0.93 * ss(0, 1.2, t) * (1 - ss(20, 21.5, t)) : 0;
      cl.sprite.visible = cl.mat.opacity > 0.01;
    }
    const hole = on ? part * (1 - close) : 0;
    this.holeGlow.position.set(c.x, CLOUD_Y + 3.2, c.z);
    (this.holeGlow.material as THREE.SpriteMaterial).opacity = 0.4 * hole;
    this.holeGlow.visible = hole > 0.01;

    const rayA = on ? 0.2 * ss(2.4, 4.4, t) * (1 - 0.5 * ss(8, 9, t)) * (1 - ss(17.4, 19.5, t)) : 0;
    this.rayMat.opacity = rayA;
    for (const m of this.rays) {
      const d = m.userData as { x: number; z: number; w: number; ph: number };
      m.position.set(c.x + d.x, CLOUD_Y + 1, c.z + d.z);
      m.scale.set(d.w * (0.8 + 0.2 * Math.sin(t * 0.9 + d.ph)), CLOUD_Y + 1, 1);
      m.visible = rayA > 0.003;
    }
    const poolA = on ? 0.16 * ss(3.2, 6.5, t) * (1 - ss(17.5, 20, t)) : 0;
    (this.pool.material as THREE.MeshBasicMaterial).opacity = poolA;
    this.pool.position.set(c.x, 0.05, c.z);
    this.pool.scale.setScalar(9);
    this.pool.visible = poolA > 0.005;
  }

  private layoutWheels(t: number, wheelsOn: boolean, hy: number, sc: number) {
    for (let w = 0; w < WHEELS.length; w++) {
      const g = this.wheelGroups[w];
      g.visible = wheelsOn;
      this.wheelQuat(w, Math.max(t, 0), this.wq[w]);
      g.position.set(this.C.x, hy, this.C.z);
      g.quaternion.copy(this.wq[w]);
      g.scale.setScalar(Math.max(sc, 1e-3));
      g.updateMatrix();
      this.wm[w].copy(g.matrix);
    }
    this.hubLight.position.set(this.C.x, hy, this.C.z);
    this.hubLight.intensity = wheelsOn ? 8 * ss(2.8, 5, t) : 0;
    this.groundLight.position.set(this.C.x, 3, this.C.z);
    const a = t - T_FINAL;
    this.groundLight.intensity = this.playing ? 20 * ss(3.5, 6.5, t) * (1 - ss(17.5, 20, t)) + (a >= 0 ? 500 * Math.exp(-a * 4) : 0) : 0;
  }

  private layoutEyes(t: number, wheelsOn: boolean) {
    const N = this.eyes.length;
    for (let k = 0; k < N; k++) {
      const e = this.eyes[k];
      const open = this.eyeOpen[e.w], look = this.eyeLook[e.w], glow = this.eyeGlow[e.w];
      if (!wheelsOn || !this.aim.length) {
        open.setX(e.slot, 0);
        look.setXY(e.slot, 0, 0);
        glow.setX(e.slot, 0);
        continue;
      }
      const start = T_OPEN + 0.02 * e.i + 0.06 * e.w;
      const cs = 16.6 + 0.012 * e.i;
      const o = ss(start, start + 0.1, t) * (1 - ss(cs, cs + 0.2, t));
      // Aim: the latest volley that has started for this eye, else the default gaze.
      let aim = this.gaze[k];
      let g = 0;
      for (let v = 3; v >= 0; v--) {
        const age = t - this.fireT[v][k];
        if (age >= 0) {
          if (aim === this.gaze[k]) aim = this.aim[v][k];
          if (age < (v === 3 ? 0.9 : 0.45)) g = Math.max(g, Math.exp(-age * (v === 3 ? 4 : 7)));
        }
      }
      this.tmpA.copy(e.lp).applyMatrix4(this.wm[e.w]);
      this.tmpB.copy(aim).sub(this.tmpA).normalize();
      this.tmpC.copy(e.lx).applyQuaternion(this.wq[e.w]);
      this.tmpD.copy(e.ly).applyQuaternion(this.wq[e.w]);
      let lx = this.tmpB.dot(this.tmpC) * 1.7, ly = this.tmpB.dot(this.tmpD) * 1.7;
      const len = Math.hypot(lx, ly);
      if (len > 1) { lx /= len; ly /= len; }
      const snap = ss(start, start + 0.14, t);
      open.setX(e.slot, o);
      look.setXY(e.slot, lx * snap, ly * snap);
      glow.setX(e.slot, g);
    }
    for (let w = 0; w < WHEELS.length; w++) {
      this.eyeOpen[w].needsUpdate = true;
      this.eyeLook[w].needsUpdate = true;
      this.eyeGlow[w].needsUpdate = true;
    }
  }

  private layoutHub(t: number, wheelsOn: boolean, hy: number, sc: number) {
    this.hubRoot.position.set(this.C.x, hy, this.C.z);
    this.hubRoot.scale.setScalar(Math.max(sc, 1e-3));
    const flick = 1 + 0.08 * Math.sin(t * 17) + 0.05 * Math.sin(t * 29 + 1);
    const vis = wheelsOn ? ss(3.2, 5, t) : 0;
    this.flame.visible = vis > 0.01;
    this.flame.scale.set(1.6 * flick, 2.6 * flick, 1);
    this.flameMat.opacity = vis;
    this.coreStar.set(this.tmpA.set(0, 0.4, 0), 1.6 * (0.9 + 0.1 * Math.sin(t * 9)), 0.85 * vis, t * 0.4);
    // Camera-facing lens around the core: a soft pulse while the wheels spin, a spike as the lids open.
    let ls = wheelsOn ? 0.03 * (0.65 + 0.35 * Math.sin(t * 4.5)) * ss(3.5, 5, t) * (1 - ss(16.5, 18, t)) : 0;
    if (wheelsOn && t >= T_OPEN) ls += 0.03 * Math.exp(-(t - T_OPEN) * 6);
    this.lens.set(this.tmpB.set(this.C.x, hy, this.C.z), 3.3 * sc, ls);
  }

  private layoutWings(t: number, wheelsOn: boolean) {
    for (const w of this.wings) {
      const tr = WING_TIERS[w.tier];
      const stag = 0.12 * w.tier;
      const u = ss(11 + stag, 12.7 + stag, t) * (1 - ss(16.7 + stag, 18.1 + stag, t));
      w.pg.visible = wheelsOn && u > 0.01;
      // The wing plane faces the caster side (+back); the pivot sits a little behind the wheels.
      w.pg.position.set(0, tr.y, 0).addScaledVector(this.right, w.side * 1.3).addScaledVector(this.back, -2.6);
      w.pg.quaternion.setFromRotationMatrix(this.tmpM.makeBasis(this.right, UP, this.back));
      w.pg.scale.set(w.side * Math.max(0.2, u), Math.max(0.2, u), 1);
      w.mesh.rotation.z = lerp(-1.5, tr.open, u);
    }
    this.wingMat.opacity = 1;
  }

  private layoutFeathers(t: number) {
    const c = this.C;
    this.feathers.visible = this.playing;
    for (let i = 0; i < FEATHERS; i++) {
      const s = this.featherSeed[i];
      const age = t - s.t0;
      const life = 6;
      if (!this.playing || age < 0 || age > life) {
        this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
      } else {
        const y = Math.max(0.3, s.y - 1.1 * age);
        this.tmpA.set(c.x + s.x + Math.sin(age * 1.3 + s.ph) * 1.2, y, c.z + s.z + Math.cos(age * 1.1 + s.ph) * 1.2);
        this.tmpQ.setFromEuler(new THREE.Euler(Math.sin(age * 2 + s.ph) * 0.9, age * 0.8 + s.ph, Math.cos(age * 1.7 + s.ph) * 0.9));
        const fade = Math.min(1, age * 2) * (1 - ss(life - 1, life, age));
        this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(1.4 * fade + 1e-4, 1.4 * fade + 1e-4, 1));
      }
      this.feathers.setMatrixAt(i, this.tmpM);
    }
    this.feathers.instanceMatrix.needsUpdate = true;
  }

  private hide(m: THREE.InstancedMesh, n: number) {
    this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
    for (let i = 0; i < n; i++) m.setMatrixAt(i, this.tmpM);
    m.instanceMatrix.needsUpdate = true;
  }

  /** Beams from every eye, the burns they leave and their ground refraction rings. */
  private layoutBeams(t: number) {
    const on = this.playing && this.aim.length > 0;
    const N = EYES_TOTAL;
    const beamWindow = on && t >= 13.3 && t <= 17.1;
    const burnWindow = on && t >= 13.3;

    if (beamWindow) {
      this.beamsOn = true;
      this.beamEdge.visible = this.beamCore.visible = true;
      for (let k = 0; k < N; k++) {
        const e = this.eyes[k];
        let done = false;
        for (let v = 3; v >= 0 && !done; v--) {
          const age = t - this.fireT[v][k];
          const vo = VOLLEYS[v];
          if (age < 0 || age >= vo.dur) continue;
          done = true;
          const env = age < 0.04 ? 1.25 : Math.pow(1 - (age - 0.04) / (vo.dur - 0.04), 1.4);
          this.tmpA.copy(e.lp).addScaledVector(e.ln, 0.05).applyMatrix4(this.wm[e.w]);
          this.tmpB.copy(this.aim[v][k]).sub(this.tmpA);
          const len = Math.max(this.tmpB.length(), 1e-3);
          this.tmpQ.setFromUnitVectors(UP, this.tmpB.divideScalar(len));
          const wd = vo.width * env;
          this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(0.14 * wd + 1e-4, len, 0.14 * wd + 1e-4));
          this.beamEdge.setMatrixAt(k, this.tmpM);
          this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(0.045 * wd + 1e-4, len, 0.045 * wd + 1e-4));
          this.beamCore.setMatrixAt(k, this.tmpM);
        }
        if (!done) {
          this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
          this.beamEdge.setMatrixAt(k, this.tmpM);
          this.beamCore.setMatrixAt(k, this.tmpM);
        }
      }
      this.beamEdge.instanceMatrix.needsUpdate = true;
      this.beamCore.instanceMatrix.needsUpdate = true;
    } else if (this.beamsOn) {
      this.beamsOn = false;
      this.beamEdge.visible = this.beamCore.visible = false;
      this.hide(this.beamEdge, N);
      this.hide(this.beamCore, N);
    }

    if (burnWindow) {
      this.burnsOn = true;
      this.burns.visible = this.flashes.visible = true;
      this.burnMat.opacity = 1 - ss(21, 22, t);
      for (let v = 0; v < 3; v++) {
        for (let k = 0; k < N; k++) {
          const idx = v * N + k;
          const age = t - this.fireT[v][k];
          const a = this.aim[v][k], r = this.burnR[v][k];
          if (age >= 0) {
            this.tmpA.set(a.x, 0.04 + 0.0003 * idx, a.z);
            this.tmpQ.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (idx * 2.399) % 6.28));
            const pop = ss(0, 0.12, age);
            this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(r * 2.2 * pop + 1e-4, r * 2.2 * pop + 1e-4, 1));
            this.burns.setMatrixAt(idx, this.tmpM);
          } else {
            this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
            this.burns.setMatrixAt(idx, this.tmpM);
          }
          if (age >= 0 && age < 0.45) {
            this.tmpA.set(a.x, 0.07, a.z);
            const fs = r * 3.4 * (1 - age / 0.45) * (0.6 + 0.4 * ss(0, 0.05, age));
            this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(fs + 1e-4, fs + 1e-4, 1));
          } else this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
          this.flashes.setMatrixAt(idx, this.tmpM);
        }
      }
      // The final scorch at the point.
      const fa = t - T_FINAL;
      const last = 3 * N;
      if (fa >= 0) {
        this.tmpA.set(this.C.x, 0.045, this.C.z);
        this.tmpQ.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.7));
        const pop = ss(0, 0.2, fa);
        this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(11 * pop + 1e-4, 11 * pop + 1e-4, 1));
        this.burns.setMatrixAt(last, this.tmpM);
        const fs = 14 * (1 - clamp(fa / 0.6, 0, 1)) * ss(0, 0.04, fa);
        this.tmpA.set(this.C.x, 0.08, this.C.z);
        this.tmpM.compose(this.tmpA, this.tmpQ, this.tmpS.set(fs + 1e-4, fs + 1e-4, 1));
        this.flashes.setMatrixAt(last, this.tmpM);
      } else {
        this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
        this.burns.setMatrixAt(last, this.tmpM);
        this.flashes.setMatrixAt(last, this.tmpM);
      }
      this.burns.instanceMatrix.needsUpdate = true;
      this.flashes.instanceMatrix.needsUpdate = true;
    } else if (this.burnsOn) {
      this.burnsOn = false;
      this.burns.visible = this.flashes.visible = false;
      this.hide(this.burns, BURNS);
      this.hide(this.flashes, BURNS);
    }

    // Pooled ground refraction under beam impacts (radius 0.5 -> 3, strength 0.035).
    for (let s = 0; s < this.shocks.length; s++) {
      let str = 0, r = 0.5;
      const pos = this.tmpA.set(this.C.x, 0.05, this.C.z);
      if (on) {
        for (let v = 2; v >= 0; v--) {
          const base = (s * Math.floor(N / this.shocks.length) + 5) % N;
          const k = base + ((VOLLEYS[v].every - ((base + v) % VOLLEYS[v].every)) % VOLLEYS[v].every);
          const age = t - this.fireT[v][Math.min(k, N - 1)];
          if (age < 0) continue;
          if (age < 0.4) {
            const p = age / 0.4;
            pos.copy(this.aim[v][Math.min(k, N - 1)]).setY(0.05);
            r = 0.5 + 2.5 * p;
            str = 0.035 * (1 - p) * (1 - p);
          }
          break;
        }
      }
      this.shocks[s].set(pos, r, str);
    }
  }

  /** The final converged hit: shell, rings, pillar, star and the big refraction ring. */
  private layoutFinal(t: number) {
    const on = this.playing;
    const a = t - T_FINAL;
    const c = this.C;
    const live = on && a >= 0;

    const p1 = clamp(a / 0.45, 0, 1);
    this.shell.visible = live && a < 0.6;
    this.shell.position.set(c.x, 0, c.z);
    this.shell.scale.setScalar(1.2 + 8 * (1 - Math.pow(1 - p1, 3)));
    this.shellMat.opacity = live ? 0.7 * Math.pow(1 - clamp(a / 0.55, 0, 1), 1.5) : 0;

    const p2 = clamp(a / 0.6, 0, 1);
    this.inkRing.visible = live && a < 0.7;
    this.inkRing.position.set(c.x, 0.06, c.z);
    this.inkRing.scale.setScalar(1 + 10 * (1 - Math.pow(1 - p2, 3)));
    this.inkMat.opacity = live ? 0.8 * (1 - p2) : 0;

    const p3 = clamp(a / 0.7, 0, 1);
    this.goldRing.mesh.visible = live && a < 0.8;
    this.goldRing.mesh.position.set(c.x, 0.07, c.z);
    this.goldRing.mesh.scale.setScalar(1 + 12 * (1 - Math.pow(1 - p3, 3)));
    this.goldRing.material.opacity = live ? 0.9 * (1 - p3) : 0;

    const p4 = clamp(a / 0.9, 0, 1);
    this.pillar.visible = live && a < 1.0;
    this.pillar.position.set(c.x, 0, c.z);
    this.pillar.scale.set(lerp(1.0, 0.25, p4), 26, lerp(1.0, 0.25, p4));
    this.pillarMat.opacity = live ? 0.85 * Math.pow(1 - p4, 1.5) * ss(0, 0.03, a) : 0;

    const pop = StarBurst.pop(a, 0.14, 0.22);
    this.finalStar.set(this.tmpA.set(c.x, 1.8, c.z), live ? 10 * pop.scale : 0, live ? pop.opacity : 0, a * 0.5);

    const pb = clamp(a / 0.7, 0, 1);
    this.bigShock.set(this.tmpA.set(c.x, 0.05, c.z), 1 + 15 * (1 - Math.pow(1 - pb, 3)), live && a < 0.7 ? 0.06 * (1 - pb) * (1 - pb) : 0);
  }
}

export const ophanimDescentModule: EffectModule = {
  label: 'ophanim descent',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new OphanimDescent(),
  telegraphs(effect) {
    return (effect as OphanimDescent).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as OphanimDescent;
    if (e.ctx) frameCast(camera, controls, e.ctx, 16);
  },
  buildGui(f, effect) {
    const s = (effect as OphanimDescent).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
