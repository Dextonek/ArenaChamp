import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  CrescentArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thousand-Cut Iaido (targeted enemies, up to 8, hero tier, ~16 s cutscene): a samurai duel cut. The caster draws a
 * katana (drawn model: curved blade, gold tsuba, wrapped hilt, lacquer scabbard) and time stops: the world drains to
 * grey, dust hangs in the air. The caster dashes in straight lines through the enemies, one segment per target in chain
 * order, leaving flat dark afterimages and a thin white line in the air along the path. Back at the start the blade
 * slides into the scabbard (close-up), the tsuba meets the mouth: click. Only then do the cuts appear: red-and-white
 * slash crescents across every enemy at once, the colour floods back, impact frames, the afterimages shatter into black
 * shards, ground rings fire and every target is hit.
 *
 * The arena caster is animated directly (position, yaw, lean, crouch) as a pure function of t and put back exactly
 * (position, rotation, scale, Euler order) at the end, in reset() and when a new cast arrives after an aborted play.
 * Everything is a pure function of time t; only the release (hits, emitter bursts, smoke) fires when t crosses its time.
 *
 * Camera: scripted with `cinematic`, every shot placed explicitly from the caster pose, the dash waypoints, the target
 * centroid C and the arena axes F (caster to targets) and R (right), every key clamped to at most 24 from its look-at.
 *
 * Palette: blade white (thin lines only) | steel | cut red | gold tsuba | ink black; the world goes grey in the time-stop.
 *
 * Timeline: 0 stance (low side, cut 1.9 eye close-up, cut 2.5 blade at the mouth, glint 2.75) | 3.0 time stops (wide,
 * grey, heartbeat ring) | 4.0-8.0 the dash (six cuts of 0.67 s: low beyond the enemy / top-down / side tracking, twice) |
 * 8.0 sheath (medium, cut 8.45 extreme close-up; click 9.5, dead beat) | 10.0 release (wide, cut) | 12.0 aftermath
 * (over the shoulder push past the caster) | 15.9 end
 */
export interface ThousandCutSettings {
  damage: number;
  loop: boolean;
}

export const defaultThousandCut = (): ThousandCutSettings => ({ damage: 90, loop: false });

const DURATION = 16;
const MAXT = 8;
const SLASHES = 3;
const STOP = 3.0; // time stops
const DASH0 = 4.0;
const DASH1 = 8.0;
const CLICK = 9.5;
const RELEASE = 10.0;
const SHARDS = 14;
const MAXDUST = 180;

// Palette.
const BLADE = 0xffffff;
const STEEL = 0xc9d2dc;
const RED = 0xd81e2a;
const GOLD = 0xd9a441;
const INK = 0x050505;

// Katana frames (caster-local: +Z forward, +X the caster's left). The scabbard axis (rig +Y) points backward and a
// little up; drawing pulls the sword assembly forward along -Y. The sword's own +Y is the blade, its hilt is -Y.
const RIG_POS = new THREE.Vector3(0.62, 1.0, 0.35);
const RIG_TH = -(Math.PI / 2 - 0.15);
const CARRY_POS = new THREE.Vector3(-0.45, 1.05, 0.55);
const CARRY_TH = -(Math.PI / 2 + 0.2);
const BLADE_LEN = 1.0;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const angLerp = (a: number, b: number, k: number) => {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * k;
};

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

/** Hilt wrap: dark cord with a red diamond lattice and a thin outline on every diamond. */
function hiltTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, 256, (g) => {
    g.fillStyle = '#14090c';
    g.fillRect(0, 0, 128, 256);
    g.lineWidth = 7;
    for (let k = -4; k < 12; k++) {
      g.strokeStyle = '#7a1520';
      g.beginPath();
      g.moveTo(0, k * 32);
      g.lineTo(128, k * 32 + 128);
      g.stroke();
      g.beginPath();
      g.moveTo(128, k * 32);
      g.lineTo(0, k * 32 + 128);
      g.stroke();
    }
    g.lineWidth = 2;
    g.strokeStyle = '#05030a';
    for (let k = -4; k < 12; k++) {
      g.beginPath();
      g.moveTo(0, k * 32 + 5);
      g.lineTo(128, k * 32 + 133);
      g.stroke();
      g.beginPath();
      g.moveTo(128, k * 32 + 5);
      g.lineTo(0, k * 32 + 133);
      g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The streak left in the air along the dash: a thin bright core with a faint body, fading toward both ends. */
function lineTexture(): THREE.CanvasTexture {
  const W = 256, H = 64;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const d = y - H / 2 + 0.5;
    const prof = Math.exp(-(d * d) / 6) + 0.16 * Math.exp(-(d * d) / 180);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const ends = ss(0, 0.12, u) * ss(1, 0.88, u);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * clamp(prof * ends, 0, 1));
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Curved katana blade profile (x = edge to spine, y = along the blade) extruded thin, with a pale edge sliver. */
function bladeGeometries(): { body: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
  const N = 16;
  const xc = (y: number) => 0.07 * y * y;
  const hw = (y: number) => (0.044 - 0.012 * y) / 2;
  const body = new THREE.Shape();
  const edge = new THREE.Shape();
  const pts: number[] = [];
  for (let i = 0; i <= N; i++) pts.push((i / N) * 0.96);
  body.moveTo(xc(0) - hw(0), 0);
  pts.forEach((y) => body.lineTo(xc(y) - hw(y), y));
  body.lineTo(xc(1.0) + hw(1) * 0.2, BLADE_LEN + 0.03); // the kissaki tip
  [...pts].reverse().forEach((y) => body.lineTo(xc(y) + hw(y), y));
  body.closePath();
  edge.moveTo(xc(0) - hw(0), 0);
  pts.forEach((y) => edge.lineTo(xc(y) - hw(y), y));
  edge.lineTo(xc(1.0) + hw(1) * 0.2, BLADE_LEN + 0.03);
  [...pts].reverse().forEach((y) => edge.lineTo(xc(y) - hw(y) + 0.011, y));
  edge.closePath();
  const bg = new THREE.ExtrudeGeometry(body, { depth: 0.014, bevelEnabled: false }).translate(0, 0, -0.007);
  const eg = new THREE.ExtrudeGeometry(edge, { depth: 0.018, bevelEnabled: false }).translate(0, 0, -0.009);
  return { body: bg, edge: eg };
}

interface Pose {
  x: number;
  z: number;
  yaw: number;
  lean: number;
  sy: number;
}

interface Slash {
  pivot: THREE.Group;
  arc: CrescentArc;
}

interface Streak {
  v: THREE.Mesh;
  h: THREE.Mesh;
}

export class ThousandCutIaido implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThousandCutSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private keys: ShotKey[] = [];
  private released = false;
  private clicked = false;

  // Cast geometry.
  private P0 = v3(0, 0, 12);
  private C = v3();
  private F = v3(0, 0, -1);
  private R = v3(1, 0, 0);
  private yaw0 = 0;
  private n = 1;
  private sd = 2;
  private tp: THREE.Vector3[] = [];
  private W: THREE.Vector3[] = []; // dash waypoints: beyond each target, the last one is P0
  private segYaw: number[] = [];
  private camRel = v3();

  // The arena caster, borrowed.
  private homePos = v3();
  private homeRot = new THREE.Euler();
  private homeScale = v3(1, 1, 1);
  private dirty = false;
  private probe = new THREE.Object3D();
  private _pose: Pose = { x: 0, z: 0, yaw: 0, lean: 0, sy: 1 };

  // Katana (follows the caster's frame).
  private frame = new THREE.Group();
  private sword = new THREE.Group();
  private rigQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(RIG_TH, 0, 0));
  private carryQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(CARRY_TH, 0, 0));
  private rigAxis = v3(0, Math.cos(RIG_TH), Math.sin(RIG_TH));

  // Afterimages, streaks, shards, slashes, rings.
  private ghostMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.6, depthWrite: false });
  private ghosts: THREE.Group[] = [];
  private streaks: Streak[] = [];
  private streakMats: THREE.MeshBasicMaterial[] = [];
  private shards: THREE.InstancedMesh;
  private shardData: { o: THREE.Vector3; v: THREE.Vector3; ax: THREE.Vector3; spin: number; size: number; tilt: number }[] = [];
  private slashes: Slash[][] = [];
  private groundRings: ReturnType<typeof createRing>[] = [];
  private beat: ReturnType<typeof createRing>;
  private segShock: ShockRefraction[] = [];
  private relShock: ShockRefraction[] = [];
  private glint = new StarBurst({ points: 4, inner: 0.16, jitter: 0.15, color: 0x7a8696, core: BLADE });
  private clickStar = new StarBurst({ points: 6, inner: 0.2, jitter: 0.2, color: STEEL, core: BLADE });
  private smoke = new SmokeBall({ maxBalls: 14, color: 0x14151a, rim: 0x3a3d46, flake: '#14151a' });

  // Dust that hangs in the time-stop.
  private dustGeo = new THREE.BufferGeometry();
  private dustPos = new Float32Array(MAXDUST * 3);
  private dustBase: { b: THREE.Vector3; ph: number }[] = [];
  private dust: THREE.Points;

  private petals: Emitter;
  private ink: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private dummy = new THREE.Object3D();

  constructor(settings: ThousandCutSettings = defaultThousandCut()) {
    this.settings = settings;
    this.probe.rotation.order = 'YXZ';
    this.frame.rotation.order = 'YXZ';
    this.screen.tint.set(0x9aa2b0);
    this.screen.impactColor.set(RED);
    this.screen.edgeTint.set(RED);
    this.screen.keepHue.set(0x2850ff); // a hue nothing in the scene has: the time-stop is near-greyscale

    this.buildKatana();
    this.frame.visible = false;
    this.group.add(this.frame);

    // Dash streaks (a vertical and a flat sheet per segment).
    const lineTex = lineTexture();
    const vGeo = new THREE.PlaneGeometry(1, 1);
    const hGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let j = 0; j <= MAXT; j++) {
      const mat = new THREE.MeshBasicMaterial({
        map: lineTex, color: 0xdfe6ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      this.streakMats.push(mat);
      const v = new THREE.Mesh(vGeo, mat);
      const h = new THREE.Mesh(hGeo, mat);
      v.visible = h.visible = false;
      v.frustumCulled = h.frustumCulled = false;
      this.streaks.push({ v, h });
      this.group.add(v, h);
      const s = new ShockRefraction({ facing: 'camera', width: 0.3 });
      this.segShock.push(s);
      this.group.add(s.mesh);
    }

    // Shards of the shattered afterimages.
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.35, -0.4, 0, 0.4, -0.3, 0.05], 3));
    tri.computeVertexNormals();
    this.shards = new THREE.InstancedMesh(tri, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAXT * SHARDS);
    this.shards.frustumCulled = false;
    this.shards.count = 0;
    this.shards.visible = false;
    this.group.add(this.shards);

    // Slash crescents (three per enemy) and the ground rings and refraction rings that fire with them.
    const types: [number, number, number][] = [[3.2, 0.95, 0.3], [3.0, 0.9, 0.26], [2.2, 0.8, 0.22]];
    for (let i = 0; i < MAXT; i++) {
      const row: Slash[] = [];
      for (let s = 0; s < SLASHES; s++) {
        const [radius, sweep, width] = types[s];
        const arc = new CrescentArc({ radius, width, sweep, style: 'toon', edge: BLADE, mid: RED, outer: INK });
        arc.mesh.renderOrder = 6;
        const m = sweep / 2;
        arc.mesh.position.set(-radius * Math.cos(m), -radius * Math.sin(m), 0);
        const pivot = new THREE.Group();
        pivot.add(arc.mesh);
        pivot.visible = false;
        this.group.add(pivot);
        row.push({ pivot, arc });
      }
      this.slashes.push(row);
      const ring = createRing(RED, 0.9, 1, 64);
      this.groundRings.push(ring);
      this.group.add(ring.mesh);
      const sh = new ShockRefraction({ facing: 'camera', width: 0.3 });
      this.relShock.push(sh);
      this.group.add(sh.mesh);
    }
    this.beat = createRing(0xc9d2dc, 0.94, 1, 96);
    this.group.add(this.beat.mesh, this.glint.mesh, this.clickStar.mesh);

    // Dust.
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(this.dustGeo, new THREE.PointsMaterial({
      size: 0.16, map: softDotTexture(), color: 0xd8dce4, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    this.dust.visible = false;
    this.group.add(this.dust);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.petals = em({
      maxParticles: 700, lifetime: 2.0, lifetimeJitter: 0.4, shapeSize: 0.4, speed: 5.5, speedJitter: 0.6, spread: 110, gravity: 2.5, drag: 1.3,
      sizeStart: 0.16, sizeEnd: 0.1, colorStart: '#d81e2a', colorEnd: '#7a0f18', opacityStart: 1, opacityEnd: 0, additive: false, sizeJitter: 0.4, spin: 2,
    });
    this.ink = em({
      maxParticles: 500, lifetime: 1.0, lifetimeJitter: 0.4, shapeSize: 0.3, speed: 7, speedJitter: 0.6, spread: 100, gravity: 14, drag: 0.5,
      sizeStart: 0.1, sizeEnd: 0.06, colorStart: '#101018', colorEnd: '#050505', opacityStart: 1, opacityEnd: 0.5, additive: false, sizeJitter: 0.4, groundFade: 0.2,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points, this.smoke.mesh);
    this.smoke.hold = 0.25;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- The katana ----------------------------------------------------------------------------------------

  private buildKatana() {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3cf, roughness: 0.3, metalness: 0.5, emissive: 0x161a20 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.4, metalness: 0.5, emissive: 0x2a1c05 });
    const lacquer = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.35, metalness: 0.2 });
    const cord = new THREE.MeshStandardMaterial({ color: 0x8a1520, roughness: 0.7 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ee });

    // Sword assembly: tsuba at the origin, blade along +Y, hilt along -Y.
    const { body, edge } = bladeGeometries();
    this.sword.add(new THREE.Mesh(body, steel), new THREE.Mesh(edge, edgeMat));
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.014, 8), gold);
    const habaki = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.05, 8), gold);
    habaki.position.y = 0.03;
    const tsubaRim = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.005, 5, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.6 }));
    const hiltTex = hiltTexture();
    hiltTex.repeat.set(1, 1.4);
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.021, 0.3, 10).translate(0, -0.17, 0),
      new THREE.MeshStandardMaterial({ map: hiltTex, roughness: 0.7 }),
    );
    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.025, 8), gold);
    pommel.position.y = -0.335;
    this.sword.add(tsuba, tsubaRim, habaki, hilt, pommel);
    // The drawing hand: a leather fist around the hilt and a thumb pressed against the tsuba.
    const leather = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.8 });
    const fist = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.15, 10).translate(0, -0.16, 0), leather);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8), leather);
    thumb.position.set(0.03, -0.065, 0.02);
    thumb.rotation.z = -0.25;
    this.sword.add(fist, thumb);

    // Scabbard: tapered lacquer from the mouth (y 0) to the tip (y 1.04), with gold mouth and tip and a red cord band.
    const saya = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 1.04, 10).translate(0, 0.52, 0), lacquer);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.045, 10), gold);
    mouth.position.y = 0.02;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.07, 8), gold);
    tip.position.y = 1.0;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.05, 10), cord);
    band.position.y = 0.3;
    const scabbard = new THREE.Group();
    scabbard.add(saya, mouth, tip, band);
    scabbard.position.copy(RIG_POS);
    scabbard.quaternion.copy(this.rigQ);
    this.frame.add(scabbard, this.sword);
  }

  // --- Caster pose (a pure function of t) ----------------------------------------------------------------

  private poseAt(t: number, out: Pose): Pose {
    const { P0, n, sd } = this;
    out.x = P0.x;
    out.z = P0.z;
    out.yaw = this.yaw0;
    out.lean = 0;
    out.sy = 1;
    if (t < DASH0) {
      // Stance: a low crouch with a lean, rising as time stops.
      const c = ss(0.2, 1.0, t) * (1 - ss(STOP - 0.05, STOP + 0.35, t));
      out.sy = 1 - 0.12 * c;
      out.lean = 0.12 * c;
      return out;
    }
    if (t < DASH1) {
      const j = Math.min(n, Math.floor((t - DASH0) / sd));
      const u = clamp((t - DASH0 - j * sd) / (0.7 * sd), 0, 1);
      const e = outCubic(u);
      const from = j === 0 ? P0 : this.W[j - 1];
      const to = this.W[j];
      out.x = lerp(from.x, to.x, e);
      out.z = lerp(from.z, to.z, e);
      out.yaw = this.segYaw[j];
      out.lean = 0.35 * (1 - ss(0.75, 1, u));
      return out;
    }
    out.yaw = angLerp(this.segYaw[n], this.yaw0, ss(DASH1, DASH1 + 0.4, t));
    return out;
  }

  /** A caster-local point in world space at time t. */
  private casterLocal(t: number, l: [number, number, number] | THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const p = this.poseAt(t, this._pose);
    this.probe.position.set(p.x, this.homePos.y, p.z);
    this.probe.rotation.set(p.lean, p.yaw, 0);
    this.probe.scale.set(1, p.sy, 1);
    this.probe.updateMatrixWorld(true);
    if (Array.isArray(l)) out.set(l[0], l[1], l[2]);
    else out.copy(l);
    return out.applyMatrix4(this.probe.matrixWorld);
  }

  /** How far the blade is drawn (0 sheathed, 1 fully out) and how far the sword has left the scabbard line. */
  private swordState(t: number) {
    let a: number;
    if (t < 2.85) a = 0.14 * ss(2.2, 2.75, t);
    else if (t < 8.45) a = 0.14 + 0.86 * ss(2.85, 3.0, t);
    else a = 1 - Math.pow(ss(8.45, CLICK, t), 1.8);
    const w = ss(STOP, STOP + 0.5, t) * (1 - ss(DASH1, 8.45, t));
    return { a, w };
  }

  // --- Cast and camera keys ------------------------------------------------------------------------------

  cast(ctx: CastContext) {
    if (this.dirty) this.restoreCaster();
    this.ctx = ctx;
    const g = ctx.caster.group;
    this.homePos.copy(g.position);
    this.homeRot.copy(g.rotation);
    this.homeScale.copy(g.scale);

    this.tp = ctx.targetPos.length ? ctx.targetPos.slice(0, MAXT).map((p) => p.clone().setY(0)) : [ctx.point.clone().setY(0)];
    this.n = this.tp.length;
    this.sd = (DASH1 - DASH0) / (this.n + 1);
    this.C.set(0, 0, 0);
    for (const p of this.tp) this.C.add(p);
    this.C.multiplyScalar(1 / this.n);
    this.P0.copy(ctx.from).setY(0);
    this.F.copy(this.C).sub(this.P0).setY(0);
    if (this.F.lengthSq() < 1e-4) this.F.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.F.lengthSq() < 1e-4) this.F.set(0, 0, -1);
    this.F.normalize();
    this.R.set(-this.F.z, 0, this.F.x);
    this.yaw0 = Math.atan2(this.F.x, this.F.z);

    // Dash waypoints: each runs straight through its target and stops 1.6 beyond it; the last returns to the start.
    this.W = [];
    this.segYaw = [];
    const prev = this.P0.clone();
    for (let i = 0; i < this.n; i++) {
      const d = this.tp[i].clone().sub(prev).setY(0);
      if (d.lengthSq() < 0.25) d.copy(this.F);
      d.normalize();
      this.segYaw.push(Math.atan2(d.x, d.z));
      const w = this.tp[i].clone().addScaledVector(d, 1.6);
      this.W.push(w);
      prev.copy(w);
    }
    const back = this.P0.clone().sub(prev).setY(0);
    this.segYaw.push(back.lengthSq() < 0.25 ? this.yaw0 : Math.atan2(back.x, back.z));
    this.W.push(this.P0.clone());

    // Release camera (also decides which way the slash crescents face).
    let dist = clamp(9 + this.spread() * 1.2, 11, 19);
    for (let k = 0; k < 6; k++) {
      this.camRel.copy(this.C).addScaledVector(this.R, dist);
      if (this.tp.every((p) => p.distanceTo(this.camRel) > 5) || dist >= 21) break;
      dist += 1.5;
    }

    this.buildGhosts();
    this.buildSlashes();
    this.buildShards();
    this.buildDust();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.buildKeys();
    this.reset();
  }

  private spread() {
    let s = 1;
    for (const p of this.tp) s = Math.max(s, p.distanceTo(this.C));
    return s;
  }

  /** Flat black copies of the caster figure, one per stop. */
  private buildGhosts() {
    for (const g of this.ghosts) this.group.remove(g);
    this.ghosts = [];
    for (let i = 0; i < this.n; i++) {
      const c = this.ctx!.caster.group.clone(true);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = this.ghostMat;
          m.castShadow = false;
          m.renderOrder = 2;
        }
      });
      c.visible = false;
      this.group.add(c);
      this.ghosts.push(c);
    }
  }

  private buildSlashes() {
    const rnd = lcg(91);
    const base = [38, -34, 80];
    const yoff = [0.15, -0.15, 0.05];
    const xoff = [0, 0.1, -0.1];
    const types: [number, number][] = [[3.2, 0.95], [3.0, 0.9], [2.2, 0.8]];
    const up = v3(0, 1, 0);
    for (let i = 0; i < this.n; i++) {
      const toCam = this.camRel.clone().sub(this.tp[i]).setY(0);
      if (toCam.lengthSq() < 1e-4) toCam.copy(this.R);
      toCam.normalize();
      const x = v3(toCam.z, 0, -toCam.x);
      const baseQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, toCam));
      for (let s = 0; s < SLASHES; s++) {
        const theta = THREE.MathUtils.degToRad(base[s] + (rnd() - 0.5) * 16);
        const phi = theta - types[s][1] / 2 - Math.PI / 2;
        const sl = this.slashes[i][s];
        sl.pivot.quaternion.copy(baseQ).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), phi));
        sl.pivot.position.copy(this.tp[i]).addScaledVector(toCam, 0.8).addScaledVector(x, xoff[s]);
        sl.pivot.position.y = 1.15 + yoff[s];
      }
    }
  }

  private buildShards() {
    const rnd = lcg(5);
    this.shardData = [];
    const col = new THREE.Color();
    const palette = [0x0c0c10, 0x0c0c10, 0x0c0c10, 0x5a6472, 0x8a96a4, 0x9a1822];
    for (let i = 0; i < this.n; i++) {
      for (let k = 0; k < SHARDS; k++) {
        const o = this.W[i].clone();
        o.x += (rnd() - 0.5) * 0.8;
        o.z += (rnd() - 0.5) * 0.8;
        o.y = 0.25 + rnd() * 1.7;
        const a = rnd() * Math.PI * 2;
        const sp = 2 + rnd() * 3;
        const v = v3(Math.cos(a) * sp, 2 + rnd() * 4, Math.sin(a) * sp);
        const ax = v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        this.shardData.push({ o, v, ax, spin: 4 + rnd() * 8, size: 0.14 + rnd() * 0.22, tilt: rnd() * 6 });
        this.shards.setColorAt(i * SHARDS + k, col.setHex(palette[Math.floor(rnd() * palette.length)]));
      }
    }
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
  }

  private buildDust() {
    const rnd = lcg(17);
    const M = this.P0.clone().lerp(this.C, 0.5);
    const half = this.P0.distanceTo(this.C) / 2 + 5;
    this.dustBase = [];
    for (let i = 0; i < MAXDUST; i++) {
      const b = M.clone().addScaledVector(this.F, (rnd() - 0.5) * 2 * half).addScaledVector(this.R, (rnd() - 0.5) * 18);
      b.y = 0.3 + rnd() * 5.5;
      this.dustBase.push({ b, ph: rnd() * 6.28 });
    }
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const { P0, C, F, R } = this;
    const up = (y: number) => v3(0, y, 0);
    const key = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false, ease: ShotKey['ease'] = 'inOut') => {
      const p = pos.clone();
      if (p.y < 0.7) p.y = 0.7;
      const off = p.clone().sub(target);
      if (off.length() > 24) p.copy(target).addScaledVector(off.normalize(), 24);
      keys.push({ t, position: p, target: target.clone(), fov, roll: 0, cut, ease });
    };
    const cl = (t: number, l: [number, number, number]) => this.casterLocal(t, l, v3());
    const MOUTH_T: [number, number, number] = [0.62, 1.0, 0.36];

    // 1. Stance (0-1.9): low side shot from the sword side; the crouch settles, dust drifts.
    key(0, cl(0, [4.4, 0.55, 0.9]), cl(0, [0, 1.15, 0.2]), 38, true);
    key(1.9 - 0.001, cl(1.9, [3.7, 0.7, 0.7]), cl(1.9, [0, 1.1, 0.25]), 38, false, 'linear');
    // 2. Close-up of the hand on the hilt, thumb at the tsuba, from the side (1.9-2.5), about 1.2 away, no face.
    key(1.9, cl(1.9, [1.85, 1.08, 0.55]), cl(1.9, [0.62, 1.0, 0.5]), 32, true);
    key(2.5 - 0.001, cl(2.5, [1.75, 1.06, 0.62]), cl(2.5, [0.62, 1.0, 0.52]), 30, false, 'linear');
    // 3. The blade edge sliding out of the mouth, a glint (2.5-3.0).
    key(2.5, cl(2.5, [1.25, 1.2, 0.6]), cl(2.5, MOUTH_T), 30, true);
    key(STOP - 0.001, cl(STOP, [1.2, 1.17, 0.55]), cl(STOP, MOUTH_T), 30, false, 'linear');

    // 4. Time stops (3-4): wide from the side, the whole arena in view, a slow push.
    const M = P0.clone().lerp(C, 0.5);
    const wd = clamp(P0.distanceTo(C) * 0.8, 10, 17);
    const wlook = M.clone().add(up(1.3));
    key(STOP, M.clone().addScaledVector(R, wd).add(up(7)), wlook, 50, true);
    key(DASH0 - 0.001, M.clone().addScaledVector(R, wd * 0.9).add(up(6.4)), wlook, 50, false, 'linear');

    // 5. The dash (4-8): six cuts, each framing the whole action (dasher, streaks, enemies, afterimages) from 7-16 away:
    // low side, high three-quarter, top-down, one side-tracking close shot, low from the far side, high three-quarter.
    let rho = 4;
    for (const p of [P0, ...this.tp, ...this.W]) rho = Math.max(rho, p.distanceTo(M));
    const shot = 4 / 6;
    const dasher = (t: number) => this.casterLocal(t, [0, 0, 0], v3());
    const wideShot = (T0: number, T1: number, at: (k: number) => THREE.Vector3, fov: number) => {
      const lookAt = (t: number) => M.clone().lerp(dasher(t), 0.3).add(up(1.0));
      key(T0, at(0), lookAt(T0), fov, true);
      key(T1, at(1), lookAt(T1), fov, false, 'linear');
    };
    for (let j = 0; j < 6; j++) {
      const T0 = DASH0 + j * shot, T1 = T0 + shot - 0.001;
      const d = clamp(rho * 2.2, 8, 16);
      if (j === 0) {
        wideShot(T0, T1, (k) => M.clone().addScaledVector(R, d * (1 - 0.06 * k)).add(up(1.8)), 50);
      } else if (j === 1) {
        wideShot(T0, T1, (k) => M.clone().addScaledVector(R, d * 0.6).addScaledVector(F, -d * 0.6).add(up(d * (0.6 - 0.06 * k))), 50);
      } else if (j === 2) {
        wideShot(T0, T1, (k) => M.clone().addScaledVector(R, 2.5).add(up(clamp(rho * 2.4, 12, 18) * (1 - 0.05 * k))), 48);
      } else if (j === 3) {
        // The one closer shot: side tracking 7 away, never behind the back.
        const mid = T0 + shot / 2;
        const sj = Math.min(this.n, Math.floor((mid - DASH0) / this.sd));
        const wprev = sj === 0 ? P0 : this.W[sj - 1];
        const dir = this.W[sj].clone().sub(wprev).setY(0);
        if (dir.lengthSq() < 1e-4) dir.copy(F);
        dir.normalize();
        const perp = v3(-dir.z, 0, dir.x);
        for (let t = T0; t <= T1 + 1e-6; t += 1 / 12) {
          const tt = Math.min(t, T1);
          const p = dasher(tt);
          key(tt, p.clone().addScaledVector(perp, 7).addScaledVector(dir, -1.5).add(up(1.8)), p.clone().addScaledVector(dir, 1.5).add(up(1.2)), 50, t === T0, 'linear');
        }
      } else if (j === 4) {
        wideShot(T0, T1, (k) => M.clone().addScaledVector(R, -d * (1 - 0.06 * k)).add(up(1.6)), 50);
      } else {
        wideShot(T0, T1, (k) => M.clone().addScaledVector(R, -d * 0.6).addScaledVector(F, d * 0.6).add(up(d * (0.6 - 0.06 * k))), 50);
      }
    }

    // 6. Sheath (8-10): medium at the hip, cut to the extreme close-up of the blade entering the mouth; held to the click.
    key(DASH1, cl(DASH1, [2.5, 1.4, 2.6]), cl(DASH1, [0.5, 1.0, 0.7]), 40, true);
    key(8.45 - 0.001, cl(8.45, [2.3, 1.35, 2.5]), cl(8.45, [0.5, 1.0, 0.7]), 40, false, 'linear');
    // Front-left of the hip, 2.3 from the mouth: the hand and the blade in view, the arena floor behind, not the robe.
    key(8.45, cl(8.45, [1.95, 1.2, 2.3]), cl(8.45, [0.62, 1.0, 0.6]), 26, true);
    key(RELEASE - 0.001, cl(RELEASE, [1.85, 1.15, 2.2]), cl(RELEASE, MOUTH_T), 24, false, 'inOut');

    // 7. Release (10-12): wide from the side over the enemies, the slashes face this camera; a slow push in.
    const relLook = C.clone().add(up(1.4));
    key(RELEASE, this.camRel.clone().add(up(6)), relLook, 50, true);
    key(12 - 0.001, this.camRel.clone().lerp(relLook, 0.14).add(up(5)), relLook, 50, false, 'out');

    // 8. Aftermath (12-16): over the caster's shoulder, a slow push past it toward the reeling enemies.
    const aLook = P0.clone().lerp(C, 0.55).add(up(1.5));
    key(12, P0.clone().addScaledVector(F, -3).addScaledVector(R, 1.5).add(up(1.1)), aLook, 42, true);
    key(DURATION, P0.clone().addScaledVector(F, 0.3).addScaledVector(R, 2.6).add(up(1.9)), aLook, 42, false, 'inOut');
  }

  /** Danger zones: a circle at each target from 3 to 10. */
  telegraphSpecs(): TelegraphSpec[] {
    return this.tp.map((p) => ({ shape: { kind: 'circle', x: p.x, z: p.z, radius: 1.5 }, start: STOP, impact: RELEASE }));
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
    this.released = false;
    this.clicked = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  /** End of the timeline: everything back to neutral and hidden, the caster where it started. */
  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.layout();
  }

  private restoreCaster() {
    this.dirty = false;
    const g = this.ctx?.caster.group;
    if (!g) return;
    g.position.copy(this.homePos);
    g.rotation.copy(this.homeRot);
    g.scale.copy(this.homeScale);
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
    this.kick *= Math.exp(-dt * 6);
    if (!this.clicked && t >= CLICK) {
      this.clicked = true;
      this.kick = Math.max(this.kick, 0.15);
    }
    if (!this.released && t >= RELEASE) this.onRelease();
    this.layout();
  }

  private onRelease() {
    this.released = true;
    this.kick = Math.max(this.kick, 0.5);
    for (let i = 0; i < this.n; i++) {
      const chest = this.tmpA.copy(this.tp[i]).setY(1.2);
      this.petals.burst(55, chest);
      this.ink.burst(32, chest);
      this.smoke.trigger(this.tmpB.copy(this.tp[i]).setY(0.9), 0.7, 0.9);
    }
    const ctx = this.ctx;
    if (ctx) {
      for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 6, color: '#d81e2a' });
    }
  }

  // --- Layout (pure function of time, apart from the release above) -------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(15.1, 15.9, t));
      cin.active = t < 15.9;
    }
    this.layoutCaster(t);
    this.layoutKatana(t);
    this.layoutGhosts(t);
    this.layoutStreaks(t);
    this.layoutShards(t);
    this.layoutSlashes(t);
    this.layoutRings(t);
    this.layoutDust(t);
    this.layoutScreen(t);
  }

  private layoutCaster(t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (t < 0) {
      if (this.dirty) this.restoreCaster();
      return;
    }
    const p = this.poseAt(t, this._pose);
    const g = ctx.caster.group;
    this.dirty = true;
    g.rotation.order = 'YXZ';
    g.position.set(p.x, this.homePos.y, p.z);
    g.rotation.set(p.lean, p.yaw, 0);
    g.scale.set(this.homeScale.x, this.homeScale.y * p.sy, this.homeScale.z);
    this.frame.position.copy(g.position);
    this.frame.rotation.set(p.lean, p.yaw, 0);
    this.frame.scale.set(1, p.sy, 1);
  }

  private layoutKatana(t: number) {
    const on = this.playing && !!this.ctx;
    this.frame.visible = on;
    this.glint.set(this.tmpA, 0, 0);
    this.clickStar.set(this.tmpA, 0, 0);
    if (!on) return;
    const { a, w } = this.swordState(t);
    const rig = this.tmpA.copy(RIG_POS).addScaledVector(this.rigAxis, -a);
    this.sword.position.lerpVectors(rig, CARRY_POS, w);
    this.sword.quaternion.slerpQuaternions(this.rigQ, this.carryQ, w);
    // Glint on the exposed edge.
    const ga = t - 2.62;
    if (ga >= 0 && ga < 0.4) {
      // A tiny star travelling along the exposed edge, from the tsuba to the mouth.
      const pop = StarBurst.pop(ga, 0.2, 0.15);
      const k = ga / 0.4;
      const at = this.casterLocal(t, this.tmpB.copy(RIG_POS).addScaledVector(this.rigAxis, -a * (1 - k)), this.tmpC);
      this.glint.set(at, 0.22 * pop.scale, pop.opacity, 0.2);
    }
    // The click: a tiny white star at the mouth.
    const ca = t - CLICK;
    if (ca >= 0 && ca < 0.3) {
      const pop = StarBurst.pop(ca, 0.05, 0.12);
      const at = this.casterLocal(t, this.tmpB.copy(RIG_POS), this.tmpC);
      this.clickStar.set(at, 0.3 * pop.scale, pop.opacity, 0.4);
    }
  }

  /** Dark afterimage silhouettes at every stop, from the moment the dasher arrives until the release shatters them. */
  private layoutGhosts(t: number) {
    const on = this.playing;
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      const arr = DASH0 + i * this.sd + 0.7 * this.sd;
      const age = t - arr;
      g.visible = on && age >= 0 && t < RELEASE;
      const pop = 1 + 0.12 * (1 - ss(0, 0.12, age));
      g.position.copy(this.W[i]);
      g.rotation.set(0, this.segYaw[i], 0);
      g.scale.set(pop, 0.95 * pop, pop);
    }
  }

  /** The thin white line left in the air along every dash segment; it fades out at the release. */
  private layoutStreaks(t: number) {
    const on = this.playing;
    for (let j = 0; j <= MAXT; j++) {
      const st = this.streaks[j];
      const mat = this.streakMats[j];
      const live = on && j <= this.n && this.W.length > this.n;
      let shown = false;
      if (live) {
        const ts = DASH0 + j * this.sd;
        const u = clamp((t - ts) / (0.7 * this.sd), 0, 1);
        const from = j === 0 ? this.P0 : this.W[j - 1];
        const to = this.W[j];
        const dx = to.x - from.x, dz = to.z - from.z;
        const full = Math.hypot(dx, dz);
        const len = full * outCubic(u);
        const fade = 1 - ss(RELEASE, RELEASE + 0.35, t);
        if (len > 0.05 && fade > 0.01 && full > 1e-3) {
          const e = outCubic(u);
          const cx = from.x + dx * e * 0.5, cz = from.z + dz * e * 0.5;
          const ry = -Math.atan2(dz, dx);
          st.v.position.set(cx, 1.15, cz);
          st.v.rotation.set(0, ry, 0);
          st.v.scale.set(len, 0.5, 1);
          st.h.position.set(cx, 1.15, cz);
          st.h.rotation.set(0, ry, 0);
          st.h.scale.set(len, 1, 0.5);
          mat.opacity = 0.85 * fade;
          shown = true;
        }
      }
      st.v.visible = st.h.visible = shown;

      // A camera-facing refraction ring at the start of each segment.
      const ts = DASH0 + j * this.sd;
      const p = (t - ts) / 0.3;
      const from2 = j === 0 || !live ? this.P0 : this.W[j - 1];
      const on2 = live && p > 0 && p < 1;
      this.segShock[j].set(this.tmpA.set(from2.x, 1.2, from2.z), lerp(0.4, 3, outCubic(p)), on2 ? 0.03 * (1 - p) * (1 - p) : 0);
    }
  }

  private layoutShards(t: number) {
    const age0 = t - RELEASE;
    const on = this.playing && age0 >= 0 && age0 < 1.7;
    this.shards.visible = on;
    if (!on) return;
    const d = this.dummy;
    const cnt = this.n * SHARDS;
    this.shards.count = cnt;
    for (let i = 0; i < cnt; i++) {
      const s = this.shardData[i];
      const k = (1 - Math.exp(-3 * age0)) / 3;
      d.position.set(s.o.x + s.v.x * k, Math.max(0.06, s.o.y + s.v.y * age0 - 7 * age0 * age0), s.o.z + s.v.z * k);
      d.quaternion.setFromAxisAngle(s.ax, s.tilt + s.spin * age0 * Math.exp(-age0 * 0.8));
      d.scale.setScalar(s.size * (1 - ss(1.0, 1.7, age0)));
      d.updateMatrix();
      this.shards.setMatrixAt(i, d.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;
  }

  /** The cuts: three crescents per enemy appear at once at the release, hold, then erode away. */
  private layoutSlashes(t: number) {
    const on = this.playing;
    for (let i = 0; i < MAXT; i++) {
      for (let s = 0; s < SLASHES; s++) {
        const sl = this.slashes[i][s];
        const age = t - (RELEASE + s * 0.035);
        const live = on && i < this.n && age >= 0 && age < 1.7;
        sl.pivot.visible = live;
        if (!live) {
          sl.arc.opacity = 0;
          continue;
        }
        sl.arc.head = clamp(age / 0.07, 0, 1);
        sl.arc.length = 1;
        sl.arc.erosion = ss(1.0, 1.65, age);
        sl.arc.time = t;
        sl.arc.opacity = 1 - ss(1.4, 1.7, age);
      }
    }
  }

  /** Ground rings and refraction rings at the release, the heartbeat ripple when time stops. */
  private layoutRings(t: number) {
    const on = this.playing;
    for (let i = 0; i < MAXT; i++) {
      const live = on && i < this.n;
      const age = t - RELEASE;
      const p = clamp(age / 0.55, 0, 1);
      const ring = this.groundRings[i];
      const c = live ? this.tp[i] : this.P0;
      ring.mesh.position.set(c.x, 0.08 + i * 0.002, c.z);
      ring.mesh.scale.setScalar(0.3 + 2.5 * outCubic(p));
      ring.material.opacity = live && age >= 0 && age < 0.6 ? 0.6 * (1 - p) : 0;
      const q = clamp(age / 0.4, 0, 1);
      this.relShock[i].set(this.tmpA.set(c.x, 1.2, c.z), lerp(0.3, 3, outCubic(q)), live && age >= 0 && age < 0.4 ? 0.04 * (1 - q) * (1 - q) : 0);
    }
    const bp = (t - STOP) / 1.0;
    this.beat.mesh.position.set(this.P0.x, 0.06, this.P0.z);
    this.beat.mesh.scale.setScalar(1 + 15 * outCubic(bp));
    this.beat.material.opacity = on && bp > 0 && bp < 1 ? 0.3 * (1 - bp) : 0;
  }

  /** Dust drifts on the wind, hangs still while time is stopped (3-10) and moves again after the release. */
  private layoutDust(t: number) {
    const on = this.playing && this.dustBase.length > 0;
    this.dust.visible = on;
    if (!on) return;
    const tau = t < STOP ? t : t < RELEASE ? STOP : STOP + (t - RELEASE);
    const pa = this.dustPos;
    const wr = 0.8, wu = 0.25;
    for (let i = 0; i < this.dustBase.length; i++) {
      const d = this.dustBase[i];
      pa[i * 3] = d.b.x + this.R.x * wr * tau + Math.sin(tau * 1.3 + d.ph) * 0.25;
      pa[i * 3 + 1] = d.b.y + wu * tau + Math.sin(tau * 0.9 + d.ph * 2) * 0.12;
      pa[i * 3 + 2] = d.b.z + this.R.z * wr * tau + Math.cos(tau * 1.1 + d.ph) * 0.25;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
    (this.dust.material as THREE.PointsMaterial).opacity = 0.55 * ss(0, 0.6, t) * (1 - ss(14.5, 15.8, t));
  }

  private layoutScreen(t: number) {
    const on = this.playing;
    const scr = this.screen;
    const freeze = ss(STOP, STOP + 0.2, t) * (1 - ss(RELEASE, RELEASE + 0.45, t));
    scr.desaturate = on ? 0.95 * freeze : 0;
    scr.darken = on ? 0.12 * ss(0, 1, t) + 0.25 * freeze : 0;
    scr.impact = on ? impactFrameAt(t, RELEASE, [1, 2], 0.04) : 0;
    scr.chroma = on ? chromaPulse(t, RELEASE, 0.5, 9) : 0;
    scr.speedLines = 0;
    if (on) scr.focus.copy(this.C).setY(1.2);
    this.shake = on ? this.kick : 0;
  }
}

export const thousandCutIaidoModule: EffectModule = {
  label: 'thousand-cut iaido',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: 8 },
  create: () => new ThousandCutIaido(),
  telegraphs(effect) {
    return (effect as ThousandCutIaido).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThousandCutIaido;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as ThousandCutIaido).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
