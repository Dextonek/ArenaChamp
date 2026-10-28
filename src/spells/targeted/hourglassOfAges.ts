import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, flashBeat, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hourglass of Ages (targeted ground AoE, radius 6, hero tier, ~18 s cutscene): the caster raises a hand, a clock
 * chime rolls out and a giant brass-framed hourglass condenses from gold dust above the enemies, drops over them and
 * slams down, trapping them in the lower bulb. Sand pours from the top bulb and rises around their feet while the
 * gears on the frame turn. Then the caster turns the hand: time reverses, the sand streams back up, the gears spin
 * backwards, the enemies age-flicker grey, cracks run over the glass and it shatters outward in big sharp flat shards.
 *
 * Everything is a pure function of the clock `time` (hits and emitter bursts fire when the clock crosses them), so
 * scrubbing works. Camera: scripted with `cinematic`, every shot placed explicitly (no auto-fit), clamped to 24 from
 * its look-at, never inside the hourglass.
 *
 * Design: pipeline/designs/hourglass-of-ages.md.
 *
 * Timeline (seconds):
 *  0 toll (behind the caster, arm up, violet chime ring) | 1.5 the hourglass condenses from gold dust (sky shot) |
 *  3 descent (low wide), lands 5.2 (hit, slam) | 6 fill (eye level, slow orbit) | 10 reverse (the hand, dead beat) |
 *  11 rewind (wide; grey flickers + ticks 11.6 / 12.4 / 13.2; mid shot from 12.6) | 14 shatter (low three-quarter) |
 *  15 settle (wide, shards fade, frame dissolves into gold dust) | 18 end
 */
export interface HourglassSettings {
  damage: number;
  loop: boolean;
}

export const defaultHourglass = (): HourglassSettings => ({ damage: 65, loop: false });

const DURATION = 18;
const RADIUS = 6;
const T_START_TELE = 2;
const T_LAND = 5.2;
const T_SHATTER = 14.0;
const T_TICK = [T_LAND, 11.6, 12.4, 13.2, T_SHATTER];
const TICK_DAMAGE = [10, 15, 15, 15, 65];
const CAM_MAX = 24;

// Geometry (local to the hourglass group, origin = centre of the floor ring).
const RB = 6.8; // glass radius at the bottom of the lower bulb
const NECK = 0.6;
const HN = 9.5; // neck height
const TOP_Y = HN * 2; // top rim of the glass
const PH = TOP_Y + 1.0; // total frame height
const PILLAR_R = 7.4;
const H0 = 9; // hover height before the descent

// Palette: sand gold -> brass -> glass teal -> time violet accent -> dark.
const GOLD = 0xf2c66d;
const SAND = 0xd9b25f;
const VIOLET = 0x9a7bff;
const INK = 0x0a0806;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const UP = v3(0, 1, 0);
const DEG = Math.PI / 180;

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

/** Radius of the glass at height y (lower bulb; the upper bulb mirrors it around the neck). */
const rProf = (y: number) => {
  const yy = y > HN ? TOP_Y - y : y;
  return NECK + (RB - NECK) * (1 - Math.pow(clamp(yy / HN, 0, 1), 2.2));
};

// --- Drawn textures ---------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Brass with engraved bands: dark etched lines, a diamond chain and tick marks. Wraps in both directions. */
function brassTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(512, 256, (g) => {
    const rnd = rng(5);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#b78d45');
    grad.addColorStop(0.5, '#c79c52');
    grad.addColorStop(1, '#a37a38');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(80,52,16,0.07)' : 'rgba(240,210,140,0.07)';
      g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 18, 1 + rnd() * 3);
    }
    g.strokeStyle = 'rgba(58,38,12,0.85)';
    for (const y of [24, 232]) {
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y + (y < 128 ? 9 : -9));
      g.lineTo(512, y + (y < 128 ? 9 : -9));
      g.stroke();
    }
    g.lineWidth = 3;
    for (let x = 0; x < 512; x += 32) {
      g.beginPath();
      g.moveTo(x, 128);
      g.lineTo(x + 16, 96);
      g.lineTo(x + 32, 128);
      g.lineTo(x + 16, 160);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(x + 16, 60);
      g.lineTo(x + 16, 82);
      g.moveTo(x + 16, 174);
      g.lineTo(x + 16, 196);
      g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A brass gear on a transparent background: dark outline, toothed rim, cut-out spokes, hub. */
function gearTexture(teeth: number, spokes: number): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const c = 256, rt = 244, rr = 206;
    const path = () => {
      g.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const p = (Math.PI * 2) / teeth;
        const pts: [number, number][] = [[rr, a - 0.3 * p], [rt, a - 0.17 * p], [rt, a + 0.17 * p], [rr, a + 0.3 * p]];
        pts.forEach(([r, aa], j) => {
          const x = c + Math.cos(aa) * r, y = c + Math.sin(aa) * r;
          if (i === 0 && j === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
      }
      g.closePath();
    };
    path();
    const grad = g.createRadialGradient(c - 60, c - 60, 20, c, c, rt);
    grad.addColorStop(0, '#cfa458');
    grad.addColorStop(1, '#94692c');
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = '#1a1208';
    g.stroke();
    // Cut the spoke windows.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2 + 0.16, a1 = ((i + 1) / spokes) * Math.PI * 2 - 0.16;
      g.beginPath();
      g.arc(c, c, 168, a0, a1);
      g.arc(c, c, 62, a1, a0, true);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2 + 0.16, a1 = ((i + 1) / spokes) * Math.PI * 2 - 0.16;
      g.beginPath();
      g.arc(c, c, 168, a0, a1);
      g.arc(c, c, 62, a1, a0, true);
      g.closePath();
      g.lineWidth = 7;
      g.strokeStyle = '#1a1208';
      g.stroke();
    }
    g.beginPath();
    g.arc(c, c, 40, 0, Math.PI * 2);
    g.fillStyle = '#7a5520';
    g.fill();
    g.lineWidth = 8;
    g.stroke();
    g.beginPath();
    g.arc(c, c, 14, 0, Math.PI * 2);
    g.fillStyle = '#e0bd6e';
    g.fill();
  });
}

/** Sand: a mottled gold body with darker and lighter grains. Tiles. */
function sandTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 256, (g) => {
    const rnd = rng(9);
    g.fillStyle = '#c29a50';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const l = rnd();
      g.fillStyle = l < 0.45 ? 'rgba(110,76,26,0.35)' : l < 0.85 ? 'rgba(240,210,140,0.32)' : 'rgba(70,46,14,0.4)';
      const s = 1 + rnd() * 2.5;
      g.fillRect(rnd() * 256, rnd() * 256, s, s);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 2);
  return tex;
}

/** The falling stream: light and dark vertical grain streaks with a soft transparent edge. Tiles vertically. */
function streamTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, 128, (g) => {
    const rnd = rng(13);
    g.fillStyle = '#d6ad5c';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,84,30,0.55)' : 'rgba(250,224,150,0.5)';
      g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 4 + rnd() * 14);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The time dial that hangs over the caster's palm: double ring, tick marks and twelve dots (violet on clear). */
function dialTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const c = 256;
    const strokeBoth = (w: number) => {
      g.lineWidth = w + 8;
      g.strokeStyle = '#120a22';
      g.stroke();
      g.lineWidth = w;
      g.strokeStyle = '#a58cff';
      g.stroke();
    };
    g.beginPath();
    g.arc(c, c, 236, 0, Math.PI * 2);
    strokeBoth(8);
    g.beginPath();
    g.arc(c, c, 196, 0, Math.PI * 2);
    strokeBoth(4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * 204, c + Math.sin(a) * 204);
      g.lineTo(c + Math.cos(a) * (i % 3 === 0 ? 150 : 172), c + Math.sin(a) * (i % 3 === 0 ? 150 : 172));
      strokeBoth(i % 3 === 0 ? 9 : 5);
    }
  });
}

/** Two dial hands (long and short) pointing up from the centre. */
function handsTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const c = 256;
    const hand = (len: number, w: number, ang: number) => {
      const x = c + Math.sin(ang) * len, y = c - Math.cos(ang) * len;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(x, y);
      g.lineWidth = w + 8;
      g.strokeStyle = '#120a22';
      g.stroke();
      g.lineWidth = w;
      g.strokeStyle = '#d9ccff';
      g.stroke();
    };
    hand(176, 8, 0);
    hand(110, 11, 2.2);
    g.beginPath();
    g.arc(c, c, 16, 0, Math.PI * 2);
    g.fillStyle = '#a58cff';
    g.fill();
  });
}

// --- Shaders ----------------------------------------------------------------------------------------------

const glassVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Faint teal body, a thin bright rim, two thin glints, and cracks (a Voronoi edge net revealed cell by cell by uCrack).
const glassFragment = /* glsl */ `
  uniform vec3 uTint, uRimCol, uCrackCol;
  uniform float uFade, uCrack, uBase;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  void main() {
    float nv = abs(dot(normalize(vN), normalize(vView)));
    float rim = pow(1.0 - nv, 4.0);
    float a = uBase + 0.42 * rim;
    a += 0.2 * smoothstep(0.012, 0.0, abs(vUv.x - 0.14)) + 0.14 * smoothstep(0.009, 0.0, abs(vUv.x - 0.63));
    vec2 q = vec2(vUv.x * 24.0, vUv.y * 13.0);
    vec2 ip = floor(q);
    vec2 fp = fract(q);
    float d1 = 9.0;
    float d2 = 9.0;
    float cellId = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 cc = vec2(mod(ip.x + g.x, 24.0), ip.y + g.y);
        vec2 o = hash2(cc);
        vec2 r = g + o - fp;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; cellId = hash2(cc + 7.0).x; }
        else if (d < d2) { d2 = d; }
      }
    }
    float crack = (1.0 - smoothstep(0.0, 0.06, sqrt(d2) - sqrt(d1))) * step(cellId, uCrack);
    vec3 col = mix(uTint, uRimCol, clamp(rim * 1.6, 0.0, 1.0));
    col = mix(col, uCrackCol, crack);
    a = max(a, crack * 0.85);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uFade);
    #include <colorspace_fragment>
  }
`;

const shardVertex = /* glsl */ `
  attribute vec3 bary;
  varying vec3 vB;
  void main() {
    vB = bary;
    vec4 p = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }
`;

// A flat glass shard: faint teal fill, thin bright edge.
const shardFragment = /* glsl */ `
  uniform vec3 uFill, uEdge;
  uniform float uFade;
  varying vec3 vB;
  void main() {
    float e = min(vB.x, min(vB.y, vB.z));
    float ed = 1.0 - smoothstep(0.0, 0.07, e);
    vec3 col = mix(uFill, uEdge, ed);
    gl_FragColor = vec4(col, mix(0.24, 0.95, ed) * uFade);
    #include <colorspace_fragment>
  }
`;

// --- Sand mesh --------------------------------------------------------------------------------------------

const SAND_SEG = 40;
const SAND_NW = 12;
const SAND_NC = 8;

/** A pile of sand inside a bulb: a wall following the glass up to level L, then a cap that peaks (or dips) at the centre. */
class SandMesh {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;

  constructor(mat: THREE.Material, private y0: number, private dir: number, private rAt: (s: number) => number) {
    const rows = SAND_NW + SAND_NC + 1;
    this.pos = new Float32Array(rows * (SAND_SEG + 1) * 3);
    const uv = new Float32Array(rows * (SAND_SEG + 1) * 2);
    const idx: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i <= SAND_SEG; i++) {
        const k = r * (SAND_SEG + 1) + i;
        uv[k * 2] = i / SAND_SEG;
        uv[k * 2 + 1] = r / (rows - 1);
        if (r < rows - 1 && i < SAND_SEG) {
          const a = k, b = k + 1, c = k + SAND_SEG + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.update(0.05, 0);
  }

  update(L: number, peak: number) {
    const rows = SAND_NW + SAND_NC + 1;
    const rEdge = this.rAt(L) * 0.965;
    for (let r = 0; r < rows; r++) {
      let rad: number, s: number;
      if (r <= SAND_NW) {
        s = (L * r) / SAND_NW;
        rad = this.rAt(s) * 0.965;
      } else {
        const f = (r - SAND_NW) / SAND_NC;
        s = L + peak * Math.pow(f, 1.3);
        rad = rEdge * (1 - f);
      }
      const y = this.y0 + this.dir * s;
      for (let i = 0; i <= SAND_SEG; i++) {
        const a = (i / SAND_SEG) * Math.PI * 2;
        const k = (r * (SAND_SEG + 1) + i) * 3;
        this.pos[k] = Math.cos(a) * rad;
        this.pos[k + 1] = y;
        this.pos[k + 2] = Math.sin(a) * rad;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// --- The effect -------------------------------------------------------------------------------------------

interface ShardData {
  p0: THREE.Vector3;
  q0: THREE.Quaternion;
  vh: THREE.Vector3; // horizontal drift
  vy: number;
  axis: THREE.Vector3;
  omega: number;
  scale: THREE.Vector3;
  variant: number;
  slot: number;
}

interface GearRig {
  holder: THREE.Group;
  mesh: THREE.Mesh;
  dir: number;
  ratio: number;
}

const SHARD_VARIANTS: [number, number][][] = [
  [[-0.5, -0.5], [0.5, -0.4], [0.1, 0.7]],
  [[-0.6, -0.2], [0.5, -0.5], [0.3, 0.6]],
  [[-0.2, -0.7], [0.25, -0.7], [0.0, 0.9]],
  [[-0.7, -0.3], [0.7, -0.2], [0.0, 0.4]],
];
const SHARDS_PER = 44;

export class HourglassOfAges implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HourglassSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitsFired = [false, false, false, false, false];
  private fired = new Set<string>();
  private fillTick = 0;
  private riseTick = 0;
  private flickering = false;
  private keys: ShotKey[] = [];

  // Cast geometry. back points from the point toward the caster; (right, up, back) is right-handed.
  private C = v3();
  private P0 = v3(0, 0, 12);
  private back = v3(0, 0, 1);
  private right = v3(1, 0, 0);
  private fwdA = v3(0, 0, 1);
  private rightA = v3(-1, 0, 0);

  // Hourglass.
  private hg = new THREE.Group();
  private fade: { m: THREE.Material; b: number }[] = [];
  private glassMat: THREE.ShaderMaterial;
  private glass: THREE.Mesh;
  private sandLow: SandMesh;
  private sandUp: SandMesh;
  private sandMatLow: THREE.MeshStandardMaterial;
  private sandMatUp: THREE.MeshStandardMaterial;
  private stream: THREE.Mesh;
  private streamTex: THREE.Texture;
  private streamMat: THREE.MeshBasicMaterial;
  private gears: GearRig[] = [];

  // Shards.
  private shards: ShardData[] = [];
  private shardMeshes: THREE.InstancedMesh[] = [];
  private shardMat: THREE.ShaderMaterial;

  // Caster hand, dial, chime.
  private arm: THREE.Mesh;
  private cuff: THREE.Mesh;
  private palm: THREE.Mesh;
  private dial = new THREE.Group();
  private dialFace: THREE.Mesh;
  private dialHands: THREE.Mesh;
  private dialMat: THREE.MeshBasicMaterial;
  private handsMat: THREE.MeshBasicMaterial;
  private handStar = new StarBurst({ points: 6, inner: 0.2, jitter: 0.1, color: VIOLET, core: 0xcfc2ff });
  private chime = [createRing(VIOLET, 0.93, 1, 96), createRing(VIOLET, 0.93, 1, 96)];

  // Lights and distortion.
  private glow = new THREE.PointLight(0xffd08a, 0, 45, 1.5);
  private violetLight = new THREE.PointLight(VIOLET, 0, 18, 1.5);
  private flashLight = new THREE.PointLight(0xffd88a, 0, 60, 1.5);
  private lens = new ShockRefraction({ facing: 'camera', width: 0.25 });
  private bigShock = new ShockRefraction({ facing: 'ground', width: 0.3 });

  // Slam and shatter graphics.
  private slamRing = createRing(SAND, 0.88, 1, 96);
  private shell: THREE.Mesh;
  private shellMat: THREE.MeshBasicMaterial;
  private shatterRing = createRing(GOLD, 0.9, 1, 96);
  private shatterStar = new StarBurst({ points: 8, inner: 0.24, color: GOLD, core: 0xf3e0aa });
  private slamStar = new StarBurst({ points: 8, inner: 0.26, color: SAND, core: 0xf0d89c });
  private smoke = new SmokeBall({ color: 0x0b0906, rim: 0x3a2e1c, flake: '#0c0a06', maxBalls: 3 });

  private goldDust: Emitter;
  private splash: Emitter;
  private rise: Emitter;
  private sandBurst: Emitter;
  private dust: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpS = v3();
  private greyTint = new THREE.Color(0xa9aab8);

  constructor(settings: HourglassSettings = defaultHourglass()) {
    this.settings = settings;
    this.screen.tint.set(0x2c2547);
    this.screen.impactColor.set(0xf2dca0);
    this.screen.edgeTint.set(VIOLET);
    this.screen.speedLineColor.set(0xe8d29a);
    this.screen.keepHue.set(VIOLET);
    this.screen.whiteColor.set(0xf6e6b8);

    const brassTex = brassTexture();
    const brassSide = brassTex.clone();
    brassSide.repeat.set(4, 1);
    brassSide.needsUpdate = true;
    const brassPillar = brassTex.clone();
    brassPillar.repeat.set(1, 6);
    brassPillar.needsUpdate = true;
    const brass = (map: THREE.Texture | null) => {
      const m = new THREE.MeshStandardMaterial({
        map, color: 0xb98f4a, roughness: 0.5, metalness: 0.4, emissive: 0x2a1c08, emissiveIntensity: 0.5,
        transparent: true, side: THREE.DoubleSide, fog: false,
      });
      this.fade.push({ m, b: 1 });
      return m;
    };
    const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true, fog: false });
    this.fade.push({ m: inkMat, b: 1 });

    // Frame: floor ring, top disc, four turned pillars, collar and struts at the neck.
    const ring = new THREE.Mesh(
      new THREE.LatheGeometry([[6.9, 0], [8.0, 0], [8.35, 0.18], [8.2, 0.42], [7.8, 0.55], [6.9, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      brass(brassSide),
    );
    const ringInk = new THREE.Mesh(
      new THREE.LatheGeometry([[6.8, -0.04], [8.18, -0.04], [8.55, 0.18], [8.38, 0.46], [7.9, 0.62], [6.8, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      inkMat,
    );
    const topMats = [brass(brassSide), brass(null), brass(null)];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 8.35, 1.0, 64), topMats);
    top.position.y = TOP_Y + 0.5;
    const topInk = new THREE.Mesh(new THREE.CylinderGeometry(8.28, 8.55, 1.14, 64), inkMat);
    topInk.position.y = TOP_Y + 0.5;
    const bump = (y: number, c: number, w: number) => Math.exp(-(((y - c) / w) ** 2));
    const pillarProfile = (grow: number) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 140; i++) {
        const y = (i / 140) * PH;
        const r = 0.24 + 0.3 * bump(y, 0.45, 0.5) + 0.22 * bump(y, HN, 0.5) + 0.12 * bump(y, PH * 0.27, 0.28)
          + 0.12 * bump(y, PH * 0.73, 0.28) + 0.3 * bump(y, PH - 0.45, 0.5);
        pts.push(new THREE.Vector2(r * grow + (grow > 1 ? 0.03 : 0), y));
      }
      return pts;
    };
    const pillarGeo = new THREE.LatheGeometry(pillarProfile(1), 20);
    const pillarInkGeo = new THREE.LatheGeometry(pillarProfile(1.18), 20);
    const pillarMat = brass(brassPillar);
    const strutMat = brass(null);
    const collar = new THREE.Mesh(
      new THREE.LatheGeometry([[0.5, HN - 0.35], [1.15, HN - 0.25], [1.35, HN], [1.15, HN + 0.25], [0.5, HN + 0.35]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
      brass(null),
    );
    this.hg.add(ring, ringInk, top, topInk, collar);
    for (let k = 0; k < 4; k++) {
      const psi = (45 + 90 * k) * DEG;
      const px = Math.cos(psi) * PILLAR_R, pz = Math.sin(psi) * PILLAR_R;
      const pil = new THREE.Mesh(pillarGeo, pillarMat);
      const pilInk = new THREE.Mesh(pillarInkGeo, inkMat);
      pil.position.set(px, 0, pz);
      pilInk.position.set(px, 0, pz);
      const len = PILLAR_R - 1.2;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 10), strutMat);
      const dirv = v3(Math.cos(psi), 0, Math.sin(psi));
      strut.position.copy(dirv).multiplyScalar(1.2 + len / 2).setY(HN);
      strut.quaternion.setFromUnitVectors(UP, dirv);
      this.hg.add(pil, pilInk, strut);
      // Two gears per pillar, on the outer face.
      const gearDefs: [number, number, number, number, number][] = [[4.4, 1.9, 14, 6, 1], [15.2, 1.5, 11, 5, -1.4]];
      gearDefs.forEach(([gy, gr, teeth, spokes, ratio], gi) => {
        // Unlit on purpose: a lit gear facing a light flared past the bloom threshold.
        const mat = new THREE.MeshBasicMaterial({
          map: gearTexture(teeth, spokes), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xa89878, fog: false,
        });
        this.fade.push({ m: mat, b: 1 });
        const holder = new THREE.Group();
        holder.position.set(px + dirv.x * 0.6, gy, pz + dirv.z * 0.6);
        holder.lookAt(holder.position.clone().add(dirv));
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(gr * 2, gr * 2), mat);
        holder.add(mesh);
        this.hg.add(holder);
        this.gears.push({ holder, mesh, dir: (k + gi) % 2 ? 1 : -1, ratio });
      });
    }

    // Glass: two lathe bulbs in one surface, faint teal with a thin bright rim.
    const prof: THREE.Vector2[] = [];
    const NB = 40;
    for (let i = 0; i <= NB; i++) prof.push(new THREE.Vector2(rProf((HN * i) / NB), (HN * i) / NB));
    for (let i = NB - 1; i >= 0; i--) prof.push(new THREE.Vector2(rProf((HN * i) / NB), TOP_Y - (HN * i) / NB));
    this.glassMat = new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: new THREE.Color(0x9fd9d0) }, uRimCol: { value: new THREE.Color(0xa9e6dc) }, uCrackCol: { value: new THREE.Color(0xe8d8a8) },
        uFade: { value: 0 }, uCrack: { value: 0 }, uBase: { value: 0.1 },
      },
      vertexShader: glassVertex, fragmentShader: glassFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    this.glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), this.glassMat);
    this.glass.renderOrder = 10;
    this.glass.frustumCulled = false;
    this.hg.add(this.glass);

    // Sand: a pile in each bulb and the falling stream.
    const sTex = sandTexture();
    const sandMat = () => {
      const m = new THREE.MeshStandardMaterial({
        map: sTex, color: 0xcfa75a, roughness: 1, metalness: 0, emissive: 0x3a2a10, emissiveIntensity: 0.55, transparent: true, side: THREE.DoubleSide, fog: false,
      });
      this.fade.push({ m, b: 1 });
      return m;
    };
    this.sandMatLow = sandMat();
    this.sandMatUp = sandMat();
    this.sandLow = new SandMesh(this.sandMatLow, 0, 1, (s) => rProf(s));
    this.sandUp = new SandMesh(this.sandMatUp, HN, 1, (s) => rProf(HN - s));
    this.sandLow.mesh.renderOrder = 5;
    this.sandUp.mesh.renderOrder = 5;
    this.hg.add(this.sandLow.mesh, this.sandUp.mesh);
    this.streamTex = streamTexture();
    this.streamMat = new THREE.MeshBasicMaterial({ map: this.streamTex, color: 0xe0c07a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1, 12, 1, true).translate(0, 0.5, 0), this.streamMat);
    this.stream.renderOrder = 6;
    this.stream.frustumCulled = false;
    this.hg.add(this.stream);

    // Shards: flat triangles sitting on the glass surface until the shatter.
    this.shardMat = new THREE.ShaderMaterial({
      uniforms: { uFill: { value: new THREE.Color(0x8fd4c8) }, uEdge: { value: new THREE.Color(0xa6e3d8) }, uFade: { value: 1 } },
      vertexShader: shardVertex, fragmentShader: shardFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    SHARD_VARIANTS.forEach((tri, vi) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flatMap(([x, y]) => [x, y, 0])), 3));
      geo.setAttribute('bary', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3));
      const im = new THREE.InstancedMesh(geo, this.shardMat, SHARDS_PER);
      im.frustumCulled = false;
      im.renderOrder = 11;
      im.visible = false;
      this.hg.add(im);
      this.shardMeshes.push(im);
    });
    this.buildShards();

    this.group.add(this.hg);

    // Caster's raised arm (the arena figure has no pose controls) and the time dial over the palm.
    const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3524, roughness: 0.5, metalness: 0.4 });
    this.arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.82, 10), armMat);
    this.cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10), armMat);
    this.palm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), armMat);
    for (const m of [this.arm, this.cuff, this.palm]) {
      m.visible = false;
      this.group.add(m);
    }
    this.dialMat = new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.handsMat = new THREE.MeshBasicMaterial({ map: handsTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.dialFace = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.dialMat);
    this.dialHands = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.handsMat);
    this.dialHands.position.z = 0.01;
    this.dial.add(this.dialFace, this.dialHands);
    this.dial.visible = false;
    this.group.add(this.dial, this.handStar.mesh);
    for (const r of this.chime) {
      r.mesh.visible = false;
      this.group.add(r.mesh);
    }

    // Slam / shatter graphics.
    this.shellMat = new THREE.MeshBasicMaterial({ color: SAND, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.shellMat);
    for (const o of [this.shell, this.slamRing.mesh, this.shatterRing.mesh]) {
      o.visible = false;
      o.frustumCulled = false;
      this.group.add(o);
    }
    this.group.add(
      this.slamStar.mesh, this.shatterStar.mesh, this.smoke.mesh, this.glow, this.violetLight, this.flashLight, this.lens.mesh, this.bigShock.mesh,
    );

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.goldDust = em({
      maxParticles: 1200, lifetime: 2.4, lifetimeJitter: 0.4, shapeSize: 7, speed: 0.6, speedJitter: 0.6, spread: 180, gravity: -0.15, drag: 1.0,
      sizeStart: 0.22, sizeEnd: 0.06, colorStart: '#f2c66d', colorEnd: '#b3863a', opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.splash = em({
      maxParticles: 500, lifetime: 0.8, lifetimeJitter: 0.4, shape: 'cone', shapeSize: 0.4, speed: 4, speedJitter: 0.5, spread: 40, gravity: 10, drag: 0.3,
      sizeStart: 0.17, sizeEnd: 0.07, colorStart: '#ecc983', colorEnd: '#a8803a', opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.rise = em({
      maxParticles: 500, lifetime: 1.3, lifetimeJitter: 0.4, shape: 'cone', shapeSize: 1.5, speed: 3.5, speedJitter: 0.5, spread: 25, gravity: -7, drag: 0.3,
      sizeStart: 0.17, sizeEnd: 0.07, colorStart: '#ecc983', colorEnd: '#a8803a', opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.sandBurst = em({
      maxParticles: 900, lifetime: 1.9, lifetimeJitter: 0.4, shapeSize: 3, speed: 12, speedJitter: 0.6, spread: 80, gravity: 9, drag: 0.35,
      sizeStart: 0.28, sizeEnd: 0.08, colorStart: '#f0cf8a', colorEnd: '#a8803a', opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.dust = em({
      maxParticles: 500, lifetime: 1.3, lifetimeJitter: 0.4, shapeSize: 0.8, speed: 8, speedJitter: 0.6, spread: 88, gravity: 3, drag: 0.9,
      sizeStart: 0.5, sizeEnd: 0.9, colorStart: '#8a7048', colorEnd: '#3a2e1c', opacityStart: 0.8, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.4,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points);
    this.smoke.hold = 0.3;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- Construction helpers ------------------------------------------------------------------------------

  /** Scatters flat shards over both bulbs (weighted by circumference); each remembers its tangent frame and its flight. */
  private buildShards() {
    const r = rng(77);
    const z = v3(0, 0, 1);
    for (let vi = 0; vi < SHARD_VARIANTS.length; vi++) {
      for (let k = 0; k < SHARDS_PER; k++) {
        let y = 0;
        for (let tries = 0; tries < 20; tries++) {
          y = r() * TOP_Y;
          if (r() < rProf(y) / RB) break;
        }
        const th = r() * Math.PI * 2;
        const rad = rProf(y) * 0.99;
        const p0 = v3(Math.cos(th) * rad, y, Math.sin(th) * rad);
        // Surface normal from the profile slope (outward).
        const dr = (rProf(y + 0.05) - rProf(y - 0.05)) / 0.1;
        const n = v3(Math.cos(th), -dr, Math.sin(th)).normalize();
        const q0 = new THREE.Quaternion().setFromUnitVectors(z, n);
        q0.multiply(new THREE.Quaternion().setFromAxisAngle(z, r() * Math.PI * 2));
        const outward = v3(Math.cos(th), 0, Math.sin(th));
        const sp = 3.5 + r() * 4.5;
        const s = 1.1 + Math.pow(r(), 1.3) * 1.5;
        this.shards.push({
          p0, q0, vh: outward.multiplyScalar(sp), vy: (r() - 0.35) * 5 + (y > HN ? 1.5 : 0),
          axis: v3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), omega: (3 + r() * 5) * (r() < 0.5 ? -1 : 1),
          scale: v3(s * (0.8 + r() * 0.6), s, 1), variant: vi, slot: k,
        });
      }
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
    this.right.set(this.back.z, 0, -this.back.x);
    this.fwdA.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.rightA.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    // Local x = right, local z = back, so the pillars sit at 45 / 135 / 225 / 315 degrees around the shot axes.
    this.tmpM.makeBasis(this.right, UP, this.back);
    this.hg.quaternion.setFromRotationMatrix(this.tmpM);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.buildKeys();
    this.reset();
  }

  /** Arm direction at raise amount u: from hanging out-and-down to straight up with a slight lean forward. */
  private armDir(u: number): THREE.Vector3 {
    const th = lerp(-1.35, 1.4, u);
    return v3().addScaledVector(this.rightA, Math.cos(th)).addScaledVector(UP, Math.sin(th)).addScaledVector(this.fwdA, 0.22).normalize();
  }

  private shoulder(): THREE.Vector3 {
    return this.P0.clone().add(v3(0, 1.5, 0)).addScaledVector(this.rightA, 0.5);
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const C = this.C, back = this.back, right = this.right;
    const E = 0.001;
    const dirAt = (phiDeg: number) => right.clone().multiplyScalar(Math.cos(phiDeg * DEG)).addScaledVector(back, Math.sin(phiDeg * DEG));
    /** An arc shot around the hourglass: polar angle phi (0 = the right of the cast axis, 90 = the caster's side). */
    const arc = (t0: number, t1: number, p0: number, p1: number, r0: number, r1: number, y0: number, y1: number,
      ty0: number, ty1: number, f0: number, f1: number) => {
      const N = 4;
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        const position = C.clone().addScaledVector(dirAt(lerp(p0, p1, f)), lerp(r0, r1, f)).setY(lerp(y0, y1, f));
        const target = C.clone().setY(lerp(ty0, ty1, f));
        keys.push({ t: i === N ? t1 - E : lerp(t0, t1, f), position, target, fov: lerp(f0, f1, f), roll: 0, cut: i === 0, ease: 'linear' });
      }
    };

    // 1. Toll: behind the caster, the raised arm in the lower foreground, gold dust gathering over the arena.
    const look1 = C.clone().add(v3(0, 9, 0));
    const p1a = this.P0.clone().addScaledVector(this.fwdA, -5.6).addScaledVector(this.rightA, 1.8).setY(2.7);
    const p1b = this.P0.clone().addScaledVector(this.fwdA, -4.6).addScaledVector(this.rightA, 1.6).setY(2.9);
    keys.push({ t: 0, position: p1a, target: look1, fov: 62, roll: 0, cut: true, ease: 'linear' });
    keys.push({ t: 1.5 - E, position: p1b, target: look1, fov: 62, roll: 0, ease: 'linear' });

    // 2. Sky: low, looking up at the hourglass condensing from gold dust.
    arc(1.5, 3, 62, 70, 19, 18, 4, 6, 18, 17, 60, 60);
    // 3. Descent: low wide from the side, tilting down as it lands.
    arc(3, 6, 8, 0, 21, 20, 1.6, 2.0, 11, 9.4, 64, 62);
    // 4. Fill: eye level, slow orbit, the sand rising round the enemies' feet.
    arc(6, 10, -30, 30, 13.8, 13.2, 1.7, 2.2, 4.5, 4.8, 58, 56);

    // 5. Reverse: the hand, seen from behind and the side, the dial turning against the night sky.
    const tip = this.shoulder().addScaledVector(this.armDir(1), 1.0);
    const p5a = tip.clone().addScaledVector(this.fwdA, -2.2).addScaledVector(this.rightA, 3.0).setY(2.4);
    const p5b = tip.clone().addScaledVector(this.fwdA, -1.9).addScaledVector(this.rightA, 2.7).setY(2.5);
    const t5 = tip.clone().addScaledVector(this.fwdA, 0.4).add(v3(0, 0.95, 0));
    keys.push({ t: 10, position: p5a, target: t5, fov: 40, roll: 0, cut: true, ease: 'linear' });
    keys.push({ t: 11 - E, position: p5b, target: t5, fov: 38, roll: 0, ease: 'linear' });

    // 6. Rewind: wide, the whole hourglass in frame; 7. mid-low at eye level through the faint glass.
    arc(11, 12.6, -22, -8, 20, 19.5, 5.5, 5.0, 9.5, 9.5, 64, 62);
    arc(12.6, 14, -14, 6, 15.5, 14.8, 2.3, 2.0, 5.0, 4.2, 60, 56);
    // 8. Shatter: low three-quarter, the enemies and the bursting glass.
    arc(14, 15, 30, 24, 16, 15.2, 1.6, 2.2, 3.6, 3.2, 56, 54);
    // 9. Settle: wide, slow pull-back.
    arc(15, DURATION, -28, -12, 21, 23, 5.5, 8, 8.5, 9, 62, 62);

    // Never further than CAM_MAX from the look-at, never under the floor.
    for (const k of keys) {
      const off = k.position.clone().sub(k.target);
      if (off.length() > CAM_MAX) k.position.copy(k.target).addScaledVector(off.normalize(), CAM_MAX);
      if (k.position.y < 0.6) k.position.y = 0.6;
    }
  }

  /** Danger zone: the circle the hourglass lands on. */
  telegraphSpecs(): TelegraphSpec[] {
    const p = this.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: T_START_TELE, impact: T_LAND }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private clearFlicker() {
    if (!this.ctx) return;
    if (this.flickering) for (const e of this.ctx.targets) e.setFlash(0);
    this.flickering = false;
  }

  private reset() {
    this.time = 0;
    this.hitsFired = [false, false, false, false, false];
    this.fired.clear();
    this.fillTick = 0;
    this.riseTick = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.lens.set(this.tmpA.set(0, 0, 0), 1, 0);
    this.bigShock.set(this.tmpA.set(0, 0, 0), 1, 0);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.clearFlicker();
    this.layout();
  }

  private finish() {
    this.playing = false;
    this.time = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.lens.set(this.tmpA.set(0, 0, 0), 1, 0);
    this.bigShock.set(this.tmpA.set(0, 0, 0), 1, 0);
    this.clearFlicker();
    this.layout();
  }

  private once(name: string, cond: boolean): boolean {
    if (!cond || this.fired.has(name)) return false;
    this.fired.add(name);
    return true;
  }

  // --- Time functions (pure) -----------------------------------------------------------------------------

  /** Sand progress: 0 = all in the top bulb, 1 = all in the bottom. Pours 5.8-10.2, reverses 11-13.9. */
  private prog(t: number) {
    return ss(5.8, 10.2, t) * (1 - ss(11.0, 13.9, t));
  }

  private lowLevel(p: number) {
    return { L: 1.4 * p, peak: 0.8 * clamp(p * 6, 0, 1) };
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
    const t = this.time;
    for (let i = 0; i < T_TICK.length; i++) {
      if (!this.hitsFired[i] && t >= T_TICK[i]) this.onHit(i);
    }
    const c = this.C;
    if (this.once('mat1', t >= 1.4)) this.goldDust.burst(240, this.tmpA.set(c.x, H0 + 10, c.z));
    if (this.once('mat2', t >= 2.2)) this.goldDust.burst(160, this.tmpA.set(c.x, H0 + 10, c.z));
    if (this.once('slam', t >= T_LAND)) {
      this.dust.burst(170, this.tmpA.set(c.x, 0.5, c.z));
      this.splash.burst(60, this.tmpA.set(c.x, 0.4, c.z));
    }
    if (this.once('slamSmoke', t >= T_LAND + 0.1)) this.smoke.trigger(this.tmpA.set(c.x, 0.4, c.z), 1.4, 1.1);
    // Sand pouring in: a few grains kicked up where the stream lands, every 0.09 s.
    while (5.9 + this.fillTick * 0.09 <= t && 5.9 + this.fillTick * 0.09 <= 10.2) {
      const q = this.lowLevel(this.prog(5.9 + this.fillTick * 0.09));
      this.splash.burst(4, this.tmpA.set(c.x, q.L + q.peak, c.z));
      this.fillTick++;
    }
    // Sand streaming back up.
    while (11.1 + this.riseTick * 0.07 <= t && 11.1 + this.riseTick * 0.07 <= 13.8) {
      const q = this.lowLevel(this.prog(11.1 + this.riseTick * 0.07));
      this.rise.burst(4, this.tmpA.set(c.x, q.L + q.peak + 0.1, c.z));
      this.riseTick++;
    }
    if (this.once('shatter', t >= T_SHATTER)) {
      this.sandBurst.burst(260, this.tmpA.set(c.x, 1.2, c.z));
      this.sandBurst.burst(220, this.tmpA.set(c.x, HN + 1.5, c.z));
      this.dust.burst(110, this.tmpA.set(c.x, 0.4, c.z));
    }
    if (this.once('shatterSmoke', t >= T_SHATTER + 0.1)) this.smoke.trigger(this.tmpA.set(c.x, 0.4, c.z), 1.5, 1.2);
    [15.4, 15.9, 16.4].forEach((tt, i) => {
      if (this.once('diss' + i, t >= tt)) this.goldDust.burst(150, this.tmpA.set(c.x, 4 + i * 5, c.z));
    });
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

  private onHit(i: number) {
    this.hitsFired[i] = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const final = i === 4;
    for (const j of this.inRange()) {
      const from = this.C.clone();
      if (from.distanceToSquared(ctx.targetPos[j]) < 0.09) from.set(ctx.targetPos[j].x - 0.5, 0, ctx.targetPos[j].z + 0.5);
      ctx.hit(ctx.targets[j], {
        damage: final ? this.settings.damage : TICK_DAMAGE[i], knock: final ? 9 : 0, from, color: i === 0 || final ? '#f2c66d' : '#c9c3e0',
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
      cin.letterbox = ss(0.3, 0.8, t) * (1 - ss(16.9, 17.7, t));
      cin.active = t < 17.7;
    }

    this.layoutHourglass(t);
    this.layoutShards(t);
    this.layoutHand(t);
    this.layoutImpacts(t);
    this.layoutFlicker(t);

    // Lights: warm key over the hourglass, violet at the hand, gold flash at the shatter.
    const vis = on ? ss(1.5, 3, t) * (1 - ss(15, 17, t)) : 0;
    this.glow.position.set(c.x, 8, c.z);
    this.glow.intensity = 16 * vis;
    const a = t - T_SHATTER;
    this.flashLight.position.set(c.x, 3, c.z);
    this.flashLight.intensity = on && a >= 0 ? 50 * Math.exp(-a * 6) : 0;
    const vo = on ? Math.max(0, 1 - Math.abs(t - 10.5) * 2.2) + 0.5 * ss(0.5, 1.2, t) * (1 - ss(1.8, 2.6, t)) : 0;
    const tip = this.shoulder().addScaledVector(this.armDir(1), 1.2);
    this.violetLight.position.copy(tip).add(v3(0, 0.8, 0));
    this.violetLight.intensity = 8 * vo;

    // Screen layer.
    const scr = this.screen;
    const beat = on ? ss(10.0, 10.4, t) * (1 - ss(10.9, 11.05, t)) : 0;
    scr.darken = on ? 0.32 * ss(0.2, 1.5, t) * (1 - ss(16, 17.6, t)) + 0.12 * beat : 0;
    scr.desaturate = 0.55 * beat;
    scr.impact = on ? impactFrameAt(t, T_SHATTER, [1, 2], 0.04) : 0;
    scr.chroma = on ? Math.max(chromaPulse(t, T_SHATTER, 0.6, 7), chromaPulse(t, T_LAND, 0.5, 3), chromaPulse(t, 10.5, 0.5, 3.5), chromaPulse(t, 0.7, 0.5, 2.5)) : 0;
    scr.speedLines = 0;
    if (on) {
      const fb = flashBeat(t, T_SHATTER + 0.08, 0.03, 0.08, 0.1);
      scr.exposure = fb.exposure;
      scr.whiteout = 0;
      scr.focus.set(c.x, t >= T_SHATTER ? 3 : 6, c.z);
    }

    let sh = 0;
    if (on) {
      for (const tt of [0.7, 1.9]) {
        const d = t - tt;
        if (d >= 0 && d < 0.8) sh = Math.max(sh, 0.06 * Math.exp(-d * 4));
      }
      sh = Math.max(sh, 0.4 * Math.exp(-(t - T_LAND) * 5) * (t >= T_LAND ? 1 : 0));
      sh = Math.max(sh, 0.05 * ss(5.8, 6.4, t) * (1 - ss(10, 10.3, t)));
      sh = Math.max(sh, 0.1 * ss(13.3, 13.95, t) * (t < T_SHATTER ? 1 : 0));
      if (t >= T_SHATTER) sh = Math.max(sh, 0.7 * Math.exp(-(t - T_SHATTER) * 3.4));
    }
    this.shake = sh;
  }

  private layoutHourglass(t: number) {
    const on = this.playing;
    const c = this.C;
    const vis = on ? ss(1.4, 3.0, t) * (1 - ss(15.4, 17.4, t)) : 0;
    const e = clamp((t - 3) / (T_LAND - 3), 0, 1);
    let off = H0 * (1 - e * e);
    if (t < 3) off += 0.3 * Math.sin(Math.max(t, 0) * 1.6) * (1 - ss(2.6, 3, t));
    if (t >= T_LAND) off = 0.18 * Math.exp(-(t - T_LAND) * 7) * Math.abs(Math.sin((t - T_LAND) * 22));
    this.hg.position.set(c.x, on ? off : 0, c.z);
    this.hg.scale.setScalar(lerp(0.88, 1, ss(1.4, 3, t)));
    this.hg.visible = vis > 0.01;
    for (const f of this.fade) f.m.opacity = f.b * vis;

    // Glass: faint, cracks crawl over it 13.3-13.95, gone at the shatter.
    const glassOn = t < T_SHATTER;
    this.glass.visible = glassOn && vis > 0.01;
    this.glassMat.uniforms.uFade.value = vis;
    this.glassMat.uniforms.uCrack.value = on ? ss(13.3, 13.95, t) : 0;

    // Sand and stream.
    const p = on ? this.prog(t) : 0;
    const q = this.lowLevel(p);
    const Lu = 5.2 - 4.3 * p;
    const dip = -Math.min(0.9 * ss(0, 0.08, p), Lu * 0.85);
    this.sandLow.update(Math.max(q.L, 0.03), q.peak);
    this.sandUp.update(Lu, dip);
    this.sandLow.mesh.visible = glassOn && vis > 0.01 && p > 0.003;
    this.sandUp.mesh.visible = glassOn && vis > 0.01;
    const flow = on ? ss(5.7, 6.0, t) * (1 - ss(10.0, 10.3, t)) + ss(11.0, 11.2, t) * (1 - ss(13.8, 14.0, t)) : 0;
    const floorY = q.L + q.peak;
    const len = Math.max(HN + 0.25 - floorY, 0.05);
    this.stream.visible = flow > 0.01 && vis > 0.01;
    this.stream.position.set(0, floorY, 0);
    this.stream.scale.set(1, len, 1);
    this.streamMat.opacity = 0.95 * flow;
    this.streamTex.repeat.set(1, len / 1.6);
    this.streamTex.offset.y = 2.2 * (clamp(t, 5.7, 10.3) - 5.7) - 2.8 * (clamp(t, 11, 14) - 11);

    // Gears: slow idle, turn with the pour, spin backwards through the rewind.
    const A = 0.3 * (clamp(t, 1.5, 5.8) - 1.5) + 0.7 * (clamp(t, 5.8, 11) - 5.8) - 2.2 * (clamp(t, 11, 14) - 11);
    for (const g of this.gears) g.mesh.rotation.z = A * g.dir * g.ratio;

    // Distortion: a lens inside the glass while time is trapped.
    const trapped = on ? ss(5.2, 6.0, t) * (t < T_SHATTER ? 1 : 0) : 0;
    this.lens.set(this.tmpA.set(c.x, off + HN, c.z), 7.5, 0.02 * trapped);
  }

  private layoutShards(t: number) {
    const a = t - T_SHATTER;
    const on = this.playing && a >= 0;
    const fadeU = 1 - ss(16.3, 17.8, t);
    this.shardMat.uniforms.uFade.value = fadeU;
    const live = on && fadeU > 0.01;
    for (const im of this.shardMeshes) im.visible = live;
    if (!live) return;
    const kd = 1.6, G = 9;
    const travel = (1 - Math.exp(-kd * a)) / kd;
    for (const s of this.shards) {
      const px = s.p0.x + s.vh.x * travel;
      const pz = s.p0.z + s.vh.z * travel;
      const py = Math.max(0.12, s.p0.y + s.vy * travel - 0.5 * G * a * a);
      this.tmpQ.setFromAxisAngle(s.axis, s.omega * travel).multiply(s.q0);
      this.tmpM.compose(this.tmpA.set(px, py, pz), this.tmpQ, this.tmpS.copy(s.scale));
      this.shardMeshes[s.variant].setMatrixAt(s.slot, this.tmpM);
    }
    for (const im of this.shardMeshes) im.instanceMatrix.needsUpdate = true;
  }

  private layoutHand(t: number) {
    const on = this.playing && this.ctx !== null;
    const u = on ? Math.max(ss(0.15, 1.3, t) * (1 - ss(3.2, 4.0, t)), ss(9.4, 10.0, t) * (1 - ss(11.2, 12.0, t))) : 0;
    const vis = on && u > 0.01;
    for (const m of [this.arm, this.cuff, this.palm]) m.visible = vis;
    const sh = this.shoulder();
    const dir = this.armDir(u);
    this.tmpQ2.setFromUnitVectors(UP, dir);
    this.arm.quaternion.copy(this.tmpQ2);
    this.cuff.quaternion.copy(this.tmpQ2);
    this.arm.position.copy(sh).addScaledVector(dir, 0.41);
    this.cuff.position.copy(sh).addScaledVector(dir, 0.8);
    this.palm.position.copy(sh).addScaledVector(dir, 0.92);

    // Time dial hanging over the palm: spins forward at the toll, turns back at the reverse, holds through the dead beat.
    const dv = on ? Math.max(ss(0.6, 1.1, t) * (1 - ss(2.0, 2.8, t)), ss(9.8, 10.2, t) * (1 - ss(11.0, 11.4, t))) : 0;
    this.dial.visible = dv > 0.01;
    this.dialMat.opacity = 0.9 * dv;
    this.handsMat.opacity = 0.95 * dv;
    this.dial.position.copy(sh).addScaledVector(this.armDir(1), 1.0).add(v3(0, 0.95, 0)).addScaledVector(this.fwdA, 0.4);
    this.dial.scale.setScalar(1.9);
    if (this.cinematic.active) this.dial.lookAt(this.cinematic.position);
    else this.dial.quaternion.identity();
    this.dialHands.rotation.z = t < 5 ? -0.9 * t : (clamp(t, 9.8, 10.6) - 9.8) * 6;

    const glint = on ? ss(10.35, 10.45, t) * (1 - ss(10.45, 10.75, t)) : 0;
    this.handStar.set(this.tmpA.copy(this.dial.position).addScaledVector(this.tmpB.copy(this.cinematic.position).sub(this.dial.position).normalize(), -0.3), 0.9 * glint, 0.8 * glint, t * 0.8);
  }

  private layoutImpacts(t: number) {
    const on = this.playing;
    const c = this.C;
    // Chime rings from the caster's feet.
    [0.7, 1.9].forEach((tt, i) => {
      const r = this.chime[i];
      const p = clamp((t - tt) / 1.1, 0, 1);
      const live = on && t >= tt && p < 1;
      r.mesh.visible = live;
      r.mesh.position.set(this.P0.x, 0.06, this.P0.z);
      r.mesh.scale.setScalar(0.5 + 9 * (1 - Math.pow(1 - p, 3)));
      r.material.opacity = live ? 0.7 * (1 - p) : 0;
    });

    // Landing: a sand-gold ring, a coloured shell, a small star.
    const a = t - T_LAND;
    const lived = on && a >= 0;
    const p1 = clamp(a / 0.7, 0, 1);
    this.slamRing.mesh.visible = lived && a < 0.8;
    this.slamRing.mesh.position.set(c.x, 0.07, c.z);
    this.slamRing.mesh.scale.setScalar(1 + 10 * (1 - Math.pow(1 - p1, 3)));
    this.slamRing.material.opacity = lived ? 0.7 * (1 - p1) : 0;
    const p2 = clamp(a / 0.45, 0, 1);
    this.shell.visible = lived && a < 0.55;
    this.shell.position.set(c.x, 0, c.z);
    this.shell.scale.setScalar(1.2 + 3.6 * (1 - Math.pow(1 - p2, 3)));
    this.shellMat.opacity = lived ? 0.38 * Math.pow(1 - clamp(a / 0.4, 0, 1), 1.5) : 0;
    const pop1 = StarBurst.pop(a, 0.1, 0.16);
    this.slamStar.set(this.tmpA.set(c.x, 1.4, c.z), lived ? 1.8 * pop1.scale : 0, lived ? pop1.opacity : 0, a * 0.5);

    // Shatter: star, ring, wide refraction.
    const b = t - T_SHATTER;
    const sl = on && b >= 0;
    const pop2 = StarBurst.pop(b, 0.12, 0.2);
    this.shatterStar.set(this.tmpA.set(c.x, 2.6, c.z), sl ? 2.6 * pop2.scale : 0, sl ? pop2.opacity : 0, b * 0.5);
    const p3 = clamp(b / 0.8, 0, 1);
    this.shatterRing.mesh.visible = sl && b < 0.9;
    this.shatterRing.mesh.position.set(c.x, 0.08, c.z);
    this.shatterRing.mesh.scale.setScalar(1 + 12 * (1 - Math.pow(1 - p3, 3)));
    this.shatterRing.material.opacity = sl ? 0.65 * (1 - p3) : 0;
    const pb = clamp(b / 0.7, 0, 1);
    this.bigShock.set(this.tmpA.set(c.x, 0.05, c.z), 1 + 13 * (1 - Math.pow(1 - pb, 3)), sl && b < 0.7 ? 0.06 * (1 - pb) * (1 - pb) : 0);
  }

  /** The enemies age-flicker: three grey pulses around the rewind ticks. */
  private layoutFlicker(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    let f = 0;
    for (const tt of [11.6, 12.4, 13.2]) f = Math.max(f, ss(tt - 0.3, tt - 0.05, t) * (1 - ss(tt + 0.05, tt + 0.35, t)));
    if (f > 0.01) {
      for (const e of ctx.targets) e.setFlash(f, this.greyTint);
      this.flickering = true;
    } else if (this.flickering) {
      for (const e of ctx.targets) e.setFlash(0);
      this.flickering = false;
    }
  }
}

export const hourglassOfAgesModule: EffectModule = {
  label: 'hourglass of ages',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new HourglassOfAges(),
  telegraphs(effect) {
    return (effect as HourglassOfAges).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HourglassOfAges;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as HourglassOfAges).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
