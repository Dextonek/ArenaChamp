import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  CrescentArc, HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hellfire Chains (targeted, `enemies` mode): demonic glyph gates open in the ground under every chosen enemy and
 * heavy dark-iron chains lash out of them, spiral round the enemies and cinch tight while a few links glow
 * red-hot. The chains drag the enemies toward the centre, where a bear-trap maw of toon fire (two hinged half-discs
 * with flame rims and teeth) rises out of an infernal sigil. A dead beat, then the maw snaps shut: red impact
 * frames, a toon flame column with a black core, the chains burst into flying links that cool to dark iron, and
 * the sigil burns out last.
 */
export interface HellfireChainsSettings {
  damage: number;
  tickDamage: number;
  loop: boolean;
}

export const defaultHellfireChains = (): HellfireChainsSettings => ({ damage: 45, tickDamage: 8, loop: false });

const D = 2.1; // the maw shuts (impact frames start)
const H = D + 0.08; // hit, burst and links fly (right after the two impact frames)
const DURATION = 4.6;
const MAXT = 5;
const CH = 2; // chains per enemy
const NL = 9; // links per chain
const NLINK = MAXT * CH * NL;
const JAW_R = 6;

const LINE = '#e2561a';
const HOT = '#ffc060';
const SULPHUR = '#b8e030';

const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);

/** Infernal sigil on a transparent canvas: dark pit, black-outlined orange lines, spikes, an inverted pentagram. */
function sigilTexture(full: boolean): THREE.CanvasTexture {
  const S = 1024, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (g) {
    let seed = full ? 7 : 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pt = (r: number, a: number): [number, number] => [c + Math.cos(a) * r, c + Math.sin(a) * r];
    const stroke = (draw: () => void, w: number, col = LINE) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = '#000000'; g.lineWidth = w + 12; draw(); g.stroke();
      g.strokeStyle = col; g.lineWidth = w; draw(); g.stroke();
      g.strokeStyle = HOT; g.lineWidth = Math.max(1.5, w * 0.28); draw(); g.stroke();
    };
    const ring = (r: number, w: number) => stroke(() => { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); }, w);

    // Dark pit: the sigil is a hole, the fire lives on its lines.
    const pit = g.createRadialGradient(c, c, 0, c, c, 440);
    pit.addColorStop(0, 'rgba(10,5,5,0.8)');
    pit.addColorStop(0.85, 'rgba(10,5,5,0.8)');
    pit.addColorStop(1, 'rgba(10,5,5,0)');
    g.fillStyle = pit;
    g.beginPath(); g.arc(c, c, 440, 0, Math.PI * 2); g.fill();

    ring(440, 10);
    ring(396, 5);
    if (full) ring(300, 5);
    // Outward spikes on the rim.
    const SP = 24;
    for (let i = 0; i < SP; i++) {
      const a = (i / SP) * Math.PI * 2;
      g.beginPath();
      const p0 = pt(440, a - 0.07), p1 = pt(498, a), p2 = pt(440, a + 0.07);
      g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath();
      g.fillStyle = '#0a0606'; g.fill();
      g.strokeStyle = LINE; g.lineWidth = 4; g.lineJoin = 'miter'; g.stroke();
    }
    // Glyph band: jagged runes between the two outer rings (full sigil only).
    if (full) {
      const N = 36;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        stroke(() => {
          g.beginPath();
          let r = 338;
          const first = pt(r, a - 0.02);
          g.moveTo(first[0], first[1]);
          for (let k = 0; k < 4; k++) {
            r += 12 + rnd() * 14;
            const p = pt(Math.min(r, 388), a + (rnd() - 0.5) * 0.05);
            g.lineTo(p[0], p[1]);
          }
        }, 5);
      }
    }
    // Inverted pentagram.
    const R = full ? 300 : 270;
    const verts = [0, 1, 2, 3, 4].map((k) => pt(R, Math.PI / 2 + (k * Math.PI * 2) / 5));
    stroke(() => {
      g.beginPath();
      for (let k = 0; k <= 5; k++) {
        const v = verts[(k * 2) % 5];
        if (k === 0) g.moveTo(v[0], v[1]); else g.lineTo(v[0], v[1]);
      }
    }, 9);
    for (const v of verts) {
      g.beginPath(); g.arc(v[0], v[1], 16, 0, Math.PI * 2);
      g.fillStyle = '#000000'; g.fill();
      g.beginPath(); g.arc(v[0], v[1], 10, 0, Math.PI * 2);
      g.fillStyle = SULPHUR; g.fill();
    }
    if (full) {
      // A slit eye in the middle.
      stroke(() => {
        g.beginPath();
        g.moveTo(c - 92, c);
        g.quadraticCurveTo(c, c - 72, c + 92, c);
        g.quadraticCurveTo(c, c + 72, c - 92, c);
        g.closePath();
      }, 7);
      g.fillStyle = '#0a0606'; g.fill();
      g.beginPath(); g.ellipse(c, c, 9, 50, 0, 0, Math.PI * 2);
      g.fillStyle = SULPHUR; g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function flatPlane(map: THREE.Texture) {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.visible = false;
  return { mesh, mat };
}

interface Jaw {
  group: THREE.Group;
  arcs: CrescentArc[];
  disc: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  teeth: THREE.Group;
}

interface Flame {
  plane: THREE.Group;
  arc: CrescentArc;
}

export class HellfireChains implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HellfireChainsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hitDone = false;
  private snapped = false;
  private smokeDone = false;
  private cleared = false;
  private ticked: boolean[] = [];

  // Cast geometry.
  private tp: THREE.Vector3[] = [];
  private disp: THREE.Vector3[] = Array.from({ length: MAXT }, () => new THREE.Vector3());
  private centroid = new THREE.Vector3();
  private knockFrom = new THREE.Vector3();

  // Ground: central sigil, gates, scorch.
  private central = flatPlane(sigilTexture(true));
  private gates = Array.from({ length: MAXT }, () => flatPlane(sigilTexture(false)));
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x0a0404, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.scorchMat);

  // Chains: dark iron links, plus the same links swapped into a glowing mesh while they are hot.
  private linkGeo = new THREE.TorusGeometry(0.37, 0.13, 8, 16).scale(1.5, 1, 1);
  private ironMat = new THREE.MeshStandardMaterial({
    color: 0x2b2724, metalness: 0.75, roughness: 0.45, emissive: 0x1a0604, emissiveIntensity: 0.6,
  });
  private hotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private iron = new THREE.InstancedMesh(this.linkGeo, this.ironMat, NLINK);
  private hot = new THREE.InstancedMesh(this.linkGeo, this.hotMat, NLINK);
  private linkPos = Array.from({ length: NLINK }, () => new THREE.Vector3());
  private linkQ = Array.from({ length: NLINK }, () => new THREE.Quaternion());
  private linkVis = new Float32Array(NLINK);
  private linkVel = Array.from({ length: NLINK }, () => new THREE.Vector3());
  private linkW = Array.from({ length: NLINK }, () => new THREE.Vector3());
  private linkLanded = new Uint8Array(NLINK);
  private linkRnd = Float32Array.from({ length: NLINK }, () => Math.random());
  private linkHot = new Float32Array(NLINK); // 0 iron, else colour mix 0..1 (1 = yellow-orange, 0 = deep red) + 1
  private pts = Array.from({ length: NL }, () => new THREE.Vector3());

  // The maw: two hinged half-discs, flame rim + teeth, standing on the central sigil.
  private maw = new THREE.Group();
  private near: Jaw;
  private far: Jaw;

  // Flame column.
  private flames: Flame[] = [];
  private flameGroup = new THREE.Group();
  private flameCore: THREE.Mesh;
  private refract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 6, height: 6, scale: 4 });

  private stars: StarBurst[] = [];
  private bigStar = new StarBurst({ points: 9, inner: 0.3, color: 0xff7a1a, core: 0xffe08a, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xb8e030, core: 0xf4ffb0, additive: false });
  private smoke = new SmokeBall({ maxBalls: 6 });
  private embers: Emitter;
  private sparks: Emitter;
  private ash: Emitter;

  // Scratch.
  private m4 = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private cYellow = new THREE.Color(0xffc860);
  private cOrange = new THREE.Color(0xff6a1a);
  private cRed = new THREE.Color(0xb81c10);
  private hidden = new THREE.Matrix4().compose(new THREE.Vector3(0, -50, 0), new THREE.Quaternion(), new THREE.Vector3(1e-4, 1e-4, 1e-4));

  constructor(settings: HellfireChainsSettings = defaultHellfireChains()) {
    this.settings = settings;
    this.screen.tint.set(0x6a1c14);
    this.screen.impactColor.set(0xc01a10);
    this.screen.speedLineColor.set(0xff7a1a);
    this.screen.edgeTint.set(0xff2a10);
    this.smoke.hold = 0.25;

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;
    this.scorch.visible = false;
    this.group.add(this.scorch, this.central.mesh);
    for (const gt of this.gates) this.group.add(gt.mesh);

    this.iron.frustumCulled = false;
    this.hot.frustumCulled = false;
    this.group.add(this.iron, this.hot);

    this.near = this.makeJaw(false);
    this.far = this.makeJaw(true);
    this.maw.add(this.near.group, this.far.group);
    this.maw.rotation.order = 'YXZ';
    this.maw.visible = false;
    this.group.add(this.maw);

    // Flame column: five tall toon crescents in vertical planes around a black core.
    for (let k = 0; k < 3; k++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({
        radius: 1.9 + 0.2 * k, width: 1.5, sweep: Math.PI * 1.25, style: 'toon',
        edge: 0xffe08a, mid: 0xff7a1a, outer: 0x3a0d0a,
      });
      arc.mesh.rotation.z = k * 1.3;
      plane.add(arc.mesh);
      plane.rotation.y = (k * Math.PI) / 3;
      this.flameGroup.add(plane);
      this.flames.push({ plane, arc });
    }
    const coreGeo = new THREE.CylinderGeometry(0.25, 1.1, 1, 14).translate(0, 0.5, 0);
    this.flameCore = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x090303, transparent: true, opacity: 0.96, depthWrite: false }));
    this.flameCore.visible = false;
    this.flameGroup.add(this.flameCore);
    this.group.add(this.flameGroup, this.refract.mesh, this.haze.mesh);

    for (let i = 0; i < MAXT; i++) {
      const s = new StarBurst({ points: 7, inner: 0.3, color: 0xff7a1a, core: 0xffe08a, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
    }
    this.group.add(this.bigStar.mesh, this.glint.mesh, this.smoke.mesh);

    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 2.4, speedJitter: 0.6, spread: 65, gravity: -1.0, drag: 0.8,
      sizeStart: 0.15, sizeEnd: 0, colorStart: '#ffe08a', colorEnd: '#c01a10', colorMid: '#ff7a1a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0.2, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 11, speedJitter: 0.6, spread: 100, gravity: 12, drag: 1.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffe08a', colorEnd: '#c01a10',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short black ash (normal-blended) so the fire has something dark to read against.
    this.ash = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 3, speedJitter: 0.6, spread: 90, gravity: -0.5, drag: 1.6,
      sizeStart: 0.35, sizeEnd: 0.7, colorStart: '#1c0f0c', colorEnd: '#050202',
      opacityStart: 0.6, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.emitters.push(this.embers, this.sparks, this.ash, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  /** One half of the bear-trap maw: a half-disc in the local XY plane, hinged on the x axis, rim up to +Y. */
  private makeJaw(far: boolean): Jaw {
    const group = new THREE.Group();
    const discMat = new THREE.MeshBasicMaterial({ color: 0x0b0404, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(JAW_R - 0.7, 40, 0, Math.PI), discMat);
    group.add(disc);
    // Flame rim: two quarter crescents mirrored about the top so the band is fattest at the crown.
    const arcs: CrescentArc[] = [];
    for (const flip of [false, true]) {
      const arc = new CrescentArc({
        radius: JAW_R, width: 1.6, sweep: Math.PI / 2, style: 'toon', edge: 0xffe08a, mid: 0xff7a1a, outer: 0x2a0805,
      });
      if (flip) arc.mesh.scale.x = -1;
      arc.mesh.position.z = 0.01;
      arcs.push(arc);
      group.add(arc.mesh);
    }
    // Teeth stand on the rim and point across, toward the other jaw.
    const teeth = new THREE.Group();
    const toothGeo = new THREE.ConeGeometry(0.42, 2.1, 7);
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xe0641a });
    const T = 6;
    for (let i = 0; i < T; i++) {
      const a = Math.PI * (0.1 + (0.8 * (i + (far ? 0.5 : 0))) / T);
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.set(Math.cos(a) * (JAW_R - 0.7), Math.sin(a) * (JAW_R - 0.7), 0);
      tooth.rotation.x = far ? Math.PI / 2 : -Math.PI / 2;
      tooth.scale.setScalar(0.8 + 0.4 * ((i * 7) % 3) / 2);
      teeth.add(tooth);
    }
    group.add(teeth);
    return { group, arcs, disc, discMat, teeth };
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const src = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.tp = src.slice(0, MAXT).map((p) => p.clone().setY(0));
    this.centroid.set(0, 0, 0);
    for (const p of this.tp) this.centroid.add(p);
    this.centroid.divideScalar(Math.max(1, this.tp.length)).setY(0);
    const toCaster = this.tmpV.set(ctx.from.x - this.centroid.x, 0, ctx.from.z - this.centroid.z);
    const len = toCaster.length();
    if (len < 1e-3) toCaster.set(0, 0, 1); else toCaster.divideScalar(len);
    this.knockFrom.copy(this.centroid).addScaledVector(toCaster, 0.9);
    this.maw.position.copy(this.centroid).setY(0.12);
    this.maw.rotation.y = Math.atan2(toCaster.x, toCaster.z);
    this.maw.rotation.x = 0.3; // leans toward the caster so the throat faces the camera
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
    this.ticked = this.tp.map(() => false);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.snapped = false;
    this.smokeDone = false;
    this.cleared = false;
    this.ticked = this.tp.map(() => false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const d of this.disp) d.set(0, 0, 0);
    this.linkLanded.fill(0);
    this.layout(0);
  }

  update(dt: number) {
    this.embers.update(dt);
    this.sparks.update(dt);
    this.ash.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.releaseTargets();
    }
    this.timedEvents();
    if (!this.snapped && this.time >= H) this.onSnap();
    this.layout(dt);
  }

  private releaseTargets() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.cleared = true;
    const zero = this.tmpV.set(0, 0, 0);
    for (const e of ctx.targets) ctx.displace(e, zero);
  }

  /** Point on chain (i, k) at s in 0..1: a loose lash first, then a spiral cinched round the enemy. */
  private pathPos(i: number, k: number, s: number, t: number, wrapK: number, tight: number, out: THREE.Vector3) {
    const base = this.tp[i];
    const a = k * ((Math.PI * 2) / CH) + i * 0.9 + 0.4;
    const th = a + s * 0.9 * Math.PI * 2;
    let r = THREE.MathUtils.lerp(1.6, 1.05 - 0.15 * tight, smoothstep(s * 1.5));
    r *= 1 + (1 - wrapK) * 0.9 * Math.sin(Math.PI * s);
    const y = 0.12 + s * 2.05 + (1 - wrapK) * (1.0 * Math.sin(Math.PI * s) + 0.06 * Math.sin(t * 10 + s * 14 + k));
    out.set(base.x + Math.cos(th) * r, y, base.z + Math.sin(th) * r);
    out.addScaledVector(this.disp[i], Math.pow(s, 1.2));
    return out;
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - H;
    const ctx = this.ctx;
    const n = Math.min(this.tp.length, MAXT);
    const c = this.centroid;
    const live = t > 0;

    // --- World + screen. ---
    const s = this.screen;
    s.darken = t < H ? 0.75 * smoothstep(t / 0.5) : 0.75 * (1 - smoothstep((after - 0.25) / 1.8));
    s.impact = impactFrameAt(t, D, [1, 2], 0.04);
    s.speedLines = t < D ? 0.8 * smoothstep((t - 1.55) / 0.5) : Math.max(0, 0.8 - (t - D) * 8);
    s.chroma = chromaPulse(t, H, 0.7, 10);

    // --- Central sigil: opens first, burns out last. ---
    const cs = smoothstep(t / 0.55);
    const burn = 1 - smoothstep((after - 0.8) / 1.5);
    const flick = t > H ? 0.85 + 0.15 * Math.sin(t * 40) : 1;
    this.central.mesh.position.set(c.x, 0.05, c.z);
    this.central.mesh.scale.setScalar(Math.max(1e-3, 3.6 * (0.7 + 0.3 * cs)));
    this.central.mesh.rotation.z = -t * 0.35;
    this.central.mat.opacity = 0.95 * cs * burn * flick;
    this.central.mesh.visible = this.central.mat.opacity > 0.01;
    this.scorch.position.set(c.x, 0.03, c.z);
    this.scorch.scale.setScalar(3.1);
    this.scorchMat.opacity = after > 0 ? 0.5 * smoothstep(after / 0.1) * burn : 0;
    this.scorch.visible = this.scorchMat.opacity > 0.01;

    // --- Gates under each target. ---
    const gateFade = 1 - smoothstep((after - 0.3) / 1.0);
    for (let i = 0; i < MAXT; i++) {
      const gt = this.gates[i];
      if (i >= n) { gt.mesh.visible = false; continue; }
      const go = smoothstep((t - 0.12 - 0.07 * i) / 0.4);
      gt.mesh.position.set(this.tp[i].x, 0.06, this.tp[i].z);
      gt.mesh.scale.setScalar(Math.max(1e-3, 1.9 * (0.3 + 0.7 * easeOut((t - 0.12 - 0.07 * i) / 0.4))));
      gt.mesh.rotation.z = t * (i % 2 ? 0.6 : -0.6);
      gt.mat.opacity = 0.95 * go * gateFade;
      gt.mesh.visible = gt.mat.opacity > 0.01;
    }

    // --- Pull the enemies toward the centre (held until the maw shuts, released with the knockback). ---
    if (ctx && live) {
      if (after > 0.8) {
        if (!this.cleared) this.releaseTargets();
      } else {
        const pull = smoothstep((t - 1.45) / 0.55);
        const k = after > 0 ? Math.exp(-after * 14) : 1;
        const trem = t > 1.5 && t < 1.9 ? 0.03 * Math.sin(t * 38) : 0;
        for (let i = 0; i < n; i++) {
          const e = ctx.targets[i];
          if (!e) continue;
          const dx = c.x - this.tp[i].x, dz = c.z - this.tp[i].z;
          const dist = Math.hypot(dx, dz);
          const amt = dist > 1e-3 ? (Math.min(1.5, dist * 0.85) * pull * k) / dist : 0;
          this.disp[i].set(dx * amt + trem, 0, dz * amt);
          ctx.displace(e, this.disp[i]);
        }
      }
    }

    // --- Chains. ---
    this.layoutChains(t, after, dt, n);

    // --- Maw. ---
    this.layoutMaw(t, after);

    // --- Flame column. ---
    this.layoutFlames(t, after);

    // --- Distortion: ground bend as the maw snaps shut, heat shimmer over the flame column. ---
    const rp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
    this.refract.set(c, 1 + 5 * easeOut(rp), after > 0 && after < 0.5 ? 0.04 * (1 - rp) * (1 - rp) : 0);
    this.haze.set(c, after > 0 ? 0.012 * smoothstep(after / 0.15) * (1 - smoothstep((after - 0.7) / 0.9)) : 0, t, 1.2);

    // --- Stars. ---
    for (let i = 0; i < MAXT; i++) {
      const pop = StarBurst.pop(after - 0.02 * i);
      if (i >= n || pop.opacity === 0) { this.stars[i].set(this.tmpV.set(0, -50, 0), 0, 0); continue; }
      this.stars[i].set(this.tmpV.set(this.tp[i].x, 1.3, this.tp[i].z), 1.9 * pop.scale, pop.opacity, i * 0.7);
    }
    const bp = StarBurst.pop(after, 0.1, 0.22);
    if (bp.opacity === 0) this.bigStar.set(this.tmpV.set(0, -50, 0), 0, 0);
    else this.bigStar.set(this.tmpV.set(c.x, 1.4, c.z), 3.6 * bp.scale, bp.opacity, 0.3);
    const gp = StarBurst.pop(after - 0.05, 0.05, 0.2);
    if (gp.opacity === 0) this.glint.set(this.tmpV.set(0, -50, 0), 0, 0);
    else this.glint.set(this.tmpV.set(c.x, 3.0, c.z), 1.3 * gp.scale, gp.opacity, t * 2);

    // --- Particles. ---
    if (dt > 0) {
      if (t > 0.25 && t < 1.9 && n > 0 && Math.random() < 0.6) {
        const i = Math.floor(Math.random() * n);
        const a = Math.random() * Math.PI * 2;
        this.embers.burst(1, this.tmpV.set(this.tp[i].x + Math.cos(a) * 1.5, 0.15, this.tp[i].z + Math.sin(a) * 1.5));
      }
      if (after > 0 && after < 1.4) {
        const a = Math.random() * Math.PI * 2;
        this.embers.burst(2, this.tmpV.set(c.x + Math.cos(a) * 1.6, 0.3, c.z + Math.sin(a) * 1.6));
      }
    }

    // --- Shake. ---
    this.shake = after >= 0
      ? 0.9 * Math.exp(-after * 7)
      : t > 1.5 && t < D - 0.2 ? 0.05 * smoothstep((t - 1.5) / 0.4) : 0;
  }

  private layoutChains(t: number, after: number, dt: number, n: number) {
    const tight = smoothstep((t - 1.5) / 0.5);
    const tf = Math.min(t, 1.9); // flicker freezes in the dead beat
    const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), ref = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const post = this.snapped;

    for (let i = 0; i < MAXT; i++) {
      for (let k = 0; k < CH; k++) {
        const base = (i * CH + k) * NL;
        const t0 = 0.6 + 0.1 * i + 0.07 * k;
        if (!post) {
          const active = i < n && t > t0;
          const g = easeOut((t - t0) / 0.55);
          const wrapK = smoothstep((t - t0 - 0.2) / 0.5);
          if (active) for (let j = 0; j < NL; j++) this.pathPos(i, k, j / (NL - 1), t, wrapK, tight, this.pts[j]);
          const front = (t - t0 - 0.1) * 2.2;
          for (let j = 0; j < NL; j++) {
            const idx = base + j;
            const sj = j / (NL - 1);
            const vis = active ? THREE.MathUtils.clamp((g - sj) * 10, 0, 1) : 0;
            this.linkVis[idx] = vis;
            if (vis <= 0) { this.linkHot[idx] = 0; continue; }
            T.copy(this.pts[Math.min(NL - 1, j + 1)]).sub(this.pts[Math.max(0, j - 1)]);
            if (T.lengthSq() < 1e-8) T.set(0, 1, 0);
            T.normalize();
            ref.set(0, 1, 0);
            if (Math.abs(T.y) > 0.95) ref.set(1, 0, 0);
            N.copy(ref).addScaledVector(T, -ref.dot(T)).normalize();
            B.crossVectors(T, N);
            if (j % 2 === 0) this.m4.makeBasis(T, N, B);
            else this.m4.makeBasis(T, B, N.negate());
            q.setFromRotationMatrix(this.m4);
            this.linkPos[idx].copy(this.pts[j]);
            this.linkQ[idx].copy(q);
            // Heat: a red-hot band runs along the chain after it lands, then strained links flicker as it cinches.
            let h = 0;
            if (front < 1.5 && sj < front && sj > front - 0.3) h = 1 - (front - sj) / 0.3 * 0.5 + 1;
            else if (tight > 0.1 && (j + Math.floor(tf * 9)) % 4 === 0) h = 1.15;
            this.linkHot[idx] = h;
          }
        } else {
          // After the snap: free flight, landing, cooling to dark iron.
          for (let j = 0; j < NL; j++) {
            const idx = base + j;
            if (this.linkVis[idx] <= 0) continue;
            if (!this.linkLanded[idx] && dt > 0) {
              const vel = this.linkVel[idx], p = this.linkPos[idx];
              vel.y -= 24 * dt;
              p.addScaledVector(vel, dt);
              const w = this.linkW[idx];
              const ang = w.length() * dt;
              if (ang > 1e-6) this.linkQ[idx].premultiply(q.setFromAxisAngle(T.copy(w).normalize(), ang));
              if (p.y < 0.12) {
                p.y = 0.12;
                this.linkLanded[idx] = 1;
                vel.set(0, 0, 0);
                w.set(0, 0, 0);
              }
            }
            const hotFrac = Math.exp(-after * 1.2) * 0.95;
            this.linkHot[idx] = after < 0.15 || this.linkRnd[idx] < hotFrac ? 1 + Math.max(0, 1 - after / 1.6) : 0;
          }
        }
      }
    }

    // Write the instances.
    for (let idx = 0; idx < NLINK; idx++) {
      let vis = this.linkVis[idx];
      if (post) vis *= 1 - smoothstep((after - 0.5 - this.linkRnd[idx] * 0.3) / 0.4);
      if (vis < 0.02) {
        this.iron.setMatrixAt(idx, this.hidden);
        this.hot.setMatrixAt(idx, this.hidden);
        continue;
      }
      this.m4.compose(this.linkPos[idx], this.linkQ[idx], this.tmpV.setScalar(Math.max(1e-4, vis)));
      const h = this.linkHot[idx];
      if (h > 0) {
        this.hot.setMatrixAt(idx, this.m4);
        this.iron.setMatrixAt(idx, this.hidden);
        // h - 1 in 0..1.15: 1 = yellow-orange, 0 = deep red.
        const mix = THREE.MathUtils.clamp(h - 1, 0, 1);
        this.tmpC.copy(this.cRed).lerp(this.cOrange, Math.min(1, mix * 1.6)).lerp(this.cYellow, Math.max(0, mix - 0.6) * 2);
        this.hot.setColorAt(idx, this.tmpC);
      } else {
        this.iron.setMatrixAt(idx, this.m4);
        this.hot.setMatrixAt(idx, this.hidden);
      }
    }
    this.iron.instanceMatrix.needsUpdate = true;
    this.hot.instanceMatrix.needsUpdate = true;
    if (this.hot.instanceColor) this.hot.instanceColor.needsUpdate = true;
  }

  private layoutMaw(t: number, after: number) {
    const open = smoothstep((t - 1.4) / 0.55); // rises from the sigil
    const OPEN_N = 0.55, OPEN_F = 1.2; // rise angle of the near / far jaw when open (rad)
    const slam = THREE.MathUtils.clamp((t - (D - 0.09)) / 0.09, 0, 1);
    const wob = t > 1.9 ? 0 : 0.03 * Math.sin(t * 30) * open;
    const bN = t < D - 0.09 ? OPEN_N * open + wob : THREE.MathUtils.lerp(OPEN_N, Math.PI / 2, slam * slam);
    const bF = t < D - 0.09 ? OPEN_F * open + wob : THREE.MathUtils.lerp(OPEN_F, Math.PI / 2, slam * slam);
    const grow = easeOut((t - 1.4) / 0.5);
    this.maw.scale.setScalar(Math.max(1e-3, 0.55 + 0.45 * grow));
    const fadeA = after > 0 ? 1 - smoothstep((after - 0.35) / 0.5) : 1; // burnt away after the bite
    this.maw.visible = t > 1.4 && fadeA > 0.01;
    this.near.group.rotation.x = Math.PI / 2 - bN;
    this.far.group.rotation.x = -Math.PI / 2 + bF;
    const er = after > 0 ? smoothstep((after - 0.3) / 0.5) : 0;
    for (const jaw of [this.near, this.far]) {
      for (const arc of jaw.arcs) {
        arc.head = 1;
        arc.length = 1;
        arc.time = t;
        arc.erosion = er;
        arc.opacity = open > 0 ? 1 : 0;
      }
      jaw.discMat.opacity = open * fadeA;
      jaw.teeth.scale.setScalar(Math.max(1e-3, open * (1 - er)));
    }
  }

  private layoutFlames(t: number, after: number) {
    const live = after >= 0 && after < 1.2;
    this.flameGroup.position.set(this.centroid.x, 0, this.centroid.z);
    const pop = smoothstep(after / 0.12);
    const shrink = 1 - 0.5 * smoothstep((after - 0.5) / 0.6);
    this.flames.forEach((f, k) => {
      f.plane.position.y = 3.2;
      f.plane.rotation.y = (k * Math.PI) / 3 + t * 1.5;
      f.plane.scale.set(1, Math.max(1e-3, (0.5 + 2.3 * pop) * shrink), 1);
      f.arc.head = 0.3 + 1.5 * smoothstep(after / 0.3);
      f.arc.length = 0.9;
      f.arc.time = t * 2;
      f.arc.erosion = smoothstep((after - 0.35) / 0.6);
      f.arc.opacity = live ? 1 : 0;
    });
    const coreH = 4.8 * pop * (1 - smoothstep((after - 0.25) / 0.5));
    this.flameCore.scale.set(Math.max(1e-3, 0.9 * pop), Math.max(1e-3, coreH), Math.max(1e-3, 0.9 * pop));
    this.flameCore.visible = live && coreH > 0.05;
  }

  private onSnap() {
    this.snapped = true;
    const c = this.centroid;
    // Every revealed link flies outward and up from the centre.
    for (let idx = 0; idx < NLINK; idx++) {
      const p = this.linkPos[idx];
      const dir = this.linkVel[idx].set(p.x - c.x, 0, p.z - c.z);
      if (dir.lengthSq() < 1e-4) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      dir.normalize().multiplyScalar(3 + this.linkRnd[idx] * 6);
      dir.y = 4 + Math.random() * 7;
      this.linkW[idx].set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18);
      this.linkLanded[idx] = 0;
    }
    this.sparks.burst(380, this.tmpV.set(c.x, 1.2, c.z));
    this.ash.burst(70, this.tmpV.set(c.x, 1.0, c.z));
    this.embers.burst(160, this.tmpV.set(c.x, 0.6, c.z));
    for (const p of this.tp) this.sparks.burst(110, this.tmpV.set(p.x, 1.2, p.z));
    if (!this.hitDone) {
      this.hitDone = true;
      const ctx = this.ctx;
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          if (i >= MAXT) return;
          ctx.hit(e, { damage: this.settings.damage, knock: 5, from: this.knockFrom, color: '#ffb347' });
        });
      }
    }
  }

  /** The small chain-wrap ticks and the smoke, called from update() before layout. */
  private timedEvents() {
    const ctx = this.ctx;
    const t = this.time;
    if (ctx) {
      for (let i = 0; i < this.tp.length && i < MAXT; i++) {
        if (!this.ticked[i] && t >= 1.2 + 0.1 * i && ctx.targets[i]) {
          this.ticked[i] = true;
          ctx.hit(ctx.targets[i], { damage: this.settings.tickDamage, knock: 0, color: '#ff7a1a' });
        }
      }
    }
    if (!this.smokeDone && t >= H + 0.2) {
      this.smokeDone = true;
      for (const p of this.tp) this.smoke.trigger(this.tmpV.set(p.x, 0.9, p.z), 0.8, 0.7);
      this.smoke.trigger(this.tmpV.set(this.centroid.x, 1.1, this.centroid.z), 1.1, 0.8);
    }
  }
}

export const hellfireChainsModule: EffectModule = {
  label: 'hellfire chains',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new HellfireChains(),
  telegraphs(effect) {
    const e = effect as HellfireChains;
    const pts = e.ctx?.targetPos ?? [];
    if (!pts.length) return [];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    const zones = pts.slice(0, MAXT).map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.9 }, start: 0.1, impact: D,
    }));
    zones.push({ shape: { kind: 'circle' as const, x: cx, z: cz, radius: 2.8 }, start: 0.4, impact: D });
    return zones;
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as HellfireChains;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as HellfireChains).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 30, 1).name('chain tick damage');
  },
};
