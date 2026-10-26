import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Neon Fracture Jab (targeted, single target): the caster crouches in cyan wind, a glowing ball lands on the
 * target's head before the fist does, hard cyan brush strokes shoot in along the dash, and the hit becomes a
 * six-card impact sequence (dark, outline, X-ray, light, normal, dark). Then a ~1 s hit-stop: thin splash strokes
 * hang almost frozen on a navy world with horizontal smear streaks. Release: everything flies out, the target is
 * knocked back, cyan shards burst and a small black smoke ball closes the move.
 *
 * Recipe: i-xray-cyan-punch-impact-cards (frame log youtube-i/cL3SOjXcMlU.md, section A).
 */
export interface NeonFractureJabSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultNeonFractureJab = (): NeonFractureJabSettings => ({ damage: 62, knock: 9, loop: false });

const T_BALL = 0.35; // glowing ball lands on the head
const T_DASH = 0.4; // dash start
const T_DASH_END = 0.52;
const T_HIT = 0.55; // card sequence + first hit
const T_FREEZE = 0.85; // hit-stop begins
const T_RELEASE = 1.85; // hit-stop ends
const DURATION = 2.8;
const CARD_STEP = 0.05;
const CARDS: (0 | 1 | 2 | 3 | 4)[] = [1, 4, 3, 2, 0, 1];
const CARD_HEX = [0x3fd6ff, 0xffffff, 0x3fd6ff, 0xffffff, 0x3fd6ff, 0x3fd6ff];
const FROZEN_SPEED = 0.05;
const WISPS = 3;
const STROKES = 3;
const SPLASH = 8;
const STREAKS = 2;
const STOP_SHORT = 1.2;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rand = (n: number) => {
  const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

export class NeonFractureJab implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NeonFractureJabSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hitDone = false;
  private releaseDone = false;
  private smokeDone = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private casterEnd = new THREE.Vector3();
  private head = new THREE.Vector3();
  private contact = new THREE.Vector3();
  private tFeet = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private up = new THREE.Vector3(0, 1, 0);
  private casterYaw0 = 0;

  // Layers.
  private wisps: CrescentArc[] = [];
  private wispPlanes: THREE.Group[] = [];
  private afterWisps: CrescentArc[] = [];
  private afterPlanes: THREE.Group[] = [];
  private strokes: CrescentArc[] = [];
  private strokeRoots: THREE.Group[] = [];
  private splash: CrescentArc[] = [];
  private splashPlanes: THREE.Group[] = [];
  private splashArm: THREE.Group[] = [];
  private streaks: CrescentArc[] = [];
  private streakRoots: THREE.Group[] = [];
  private ball = new GlowSphere(0x3fd6ff, { rim: false });
  private ballCore = new GlowSphere(0xffffff, { rim: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
  private shardStar = new StarBurst({ points: 8, color: 0x3fd6ff, core: 0xffffff, additive: false });
  private bigStar = new StarBurst({ points: 10, color: 0x3fd6ff, core: 0xffffff, additive: false });
  private ring = createRing(0x3fd6ff, 0.9, 1, 96);
  private smoke = new SmokeBall({ maxBalls: 2 });
  private shards: Emitter;
  private sparks: Emitter;

  constructor(settings: NeonFractureJabSettings = defaultNeonFractureJab()) {
    this.settings = settings;
    this.screen.tint.set(0x0a1428);
    this.screen.impactColor.set(0x3fd6ff);
    this.screen.speedLineColor.set(0x3fd6ff);
    this.screen.edgeTint.set(0x3fd6ff);

    const wispOpts = { style: 'soft' as const, edge: 0xffffff, mid: 0x3fd6ff, outer: 0x0a3a6a };
    for (let i = 0; i < WISPS; i++) {
      const plane = new THREE.Group();
      const a = new CrescentArc({ radius: 2.2 + 0.4 * i, width: 1.4, sweep: Math.PI * 1.3, ...wispOpts });
      plane.add(a.mesh);
      this.group.add(plane);
      this.wispPlanes.push(plane);
      this.wisps.push(a);
      const plane2 = new THREE.Group();
      const b = new CrescentArc({ radius: 1.8 + 0.4 * i, width: 1.2, sweep: Math.PI * 1.3, ...wispOpts });
      plane2.add(b.mesh);
      this.group.add(plane2);
      this.afterPlanes.push(plane2);
      this.afterWisps.push(b);
    }
    for (let i = 0; i < STROKES; i++) {
      const root = new THREE.Group();
      const a = new CrescentArc({ radius: 10, width: 0.4 + 0.12 * i, sweep: 0.5, style: 'toon', edge: 0xffffff, mid: 0x2fb8ff, outer: 0x0a1428 });
      root.add(a.mesh);
      this.group.add(root);
      this.strokeRoots.push(root);
      this.strokes.push(a);
    }
    for (let i = 0; i < SPLASH; i++) {
      const plane = new THREE.Group();
      const arm = new THREE.Group(); // scales outward at the release
      const white = i % 3 === 0;
      const a = new CrescentArc({
        radius: 0.9 + rand(i + 3) * 0.9, width: 0.16 + rand(i + 7) * 0.1, sweep: Math.PI * (0.55 + rand(i + 11) * 0.5), style: 'soft',
        edge: 0xffffff, mid: white ? 0xdff8ff : 0x3fd6ff, outer: white ? 0x9adfff : 0x0a4a8a,
      });
      arm.add(a.mesh);
      plane.add(arm);
      this.group.add(plane);
      this.splashPlanes.push(plane);
      this.splashArm.push(arm);
      this.splash.push(a);
    }
    for (let i = 0; i < STREAKS; i++) {
      const root = new THREE.Group();
      const a = new CrescentArc({ radius: 12, width: 0.14, sweep: 0.5, style: 'soft', edge: 0xffffff, mid: 0xffffff, outer: 0xbfeaff });
      root.add(a.mesh);
      this.group.add(root);
      this.streakRoots.push(root);
      this.streaks.push(a);
    }

    this.shards = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 13, speedJitter: 0.6, spread: 180, gravity: 6, drag: 2,
      sizeStart: 0.32, sizeEnd: 0.05, colorStart: '#3fd6ff', colorEnd: '#0a1428',
      opacityStart: 1, opacityEnd: 0.2, additive: false, sizeJitter: 0.5, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 10, speedJitter: 0.7, spread: 180, gravity: 5, drag: 1.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#3fd6ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.shards, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(
      this.ball.mesh, this.ballCore.mesh, this.glint.mesh, this.shardStar.mesh, this.bigStar.mesh, this.ring.mesh,
      this.smoke.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return T_HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    const tp = ctx.targetPos[0] ?? ctx.point;
    this.tFeet.copy(tp).setY(0);
    const d = new THREE.Vector3(tp.x - ctx.from.x, 0, tp.z - ctx.from.z);
    const dist = d.length();
    if (dist < 1e-4) d.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else d.divideScalar(dist);
    this.dir.copy(d);
    const dashLen = Math.max(0, dist - STOP_SHORT);
    this.casterEnd.copy(this.from).addScaledVector(d, dashLen);
    this.head.set(tp.x, 1.95, tp.z);
    this.contact.set(tp.x, 1.5, tp.z);
    this.casterYaw0 = ctx.caster.group.rotation.y;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.contact);

    // Wisps crouch around the caster; after-wisps and splash strokes sit on the contact point.
    for (let i = 0; i < WISPS; i++) {
      this.wispPlanes[i].position.set(this.from.x, 1.2, this.from.z);
      this.wispPlanes[i].rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 2.1 + ctx.aim, 0, 'YXZ');
      this.afterPlanes[i].position.copy(this.contact);
      this.afterPlanes[i].rotation.set(Math.PI / 2 + (i - 1) * 0.6, i * 2.3 + ctx.aim + 1, 0, 'YXZ');
    }

    // Line frame: local X = up, local Y = dash direction, local Z = up x dir (a vertical plane along the dash).
    const side = new THREE.Vector3().crossVectors(this.up, d);
    const basis = new THREE.Matrix4().makeBasis(this.up, d, side);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis);
    const sideN = side.clone();
    for (let i = 0; i < STROKES; i++) {
      const R = 10;
      const chord = R * Math.sin(0.5);
      const off = sideN.clone().multiplyScalar((i - 1) * 0.55);
      const startP = this.contact.clone().addScaledVector(d, -chord * 0.95).add(off);
      startP.y += (i - 1) * 0.25;
      this.strokeRoots[i].quaternion.copy(q);
      this.strokeRoots[i].position.copy(startP).addScaledVector(this.up, -R);
    }
    for (let i = 0; i < STREAKS; i++) {
      const R = 12;
      const chord = R * Math.sin(0.5);
      const startP = this.contact.clone().addScaledVector(d, -chord * 0.5).addScaledVector(sideN, (i - 0.5) * 0.5);
      startP.y += (i === 0 ? 0.25 : -0.2);
      this.streakRoots[i].quaternion.copy(q);
      this.streakRoots[i].position.copy(startP).addScaledVector(this.up, -R);
    }
    // Splash: planes facing sideways (toward a side-on camera), fanned around the contact point.
    for (let i = 0; i < SPLASH; i++) {
      const plane = this.splashPlanes[i];
      plane.position.copy(this.contact);
      plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.up, d, side));
      plane.rotateX((rand(i + 21) - 0.5) * 0.9);
      plane.rotateY((rand(i + 33) - 0.5) * 0.9);
      this.splash[i].mesh.rotation.z = (i / SPLASH) * Math.PI * 2 + rand(i + 5) * 0.6;
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.releaseDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.restoreCaster();
    this.layout(0);
  }

  private restoreCaster() {
    const c = this.ctx?.caster;
    if (!c) return;
    c.group.position.copy(this.from);
    c.group.scale.set(1, 1, 1);
    c.group.rotation.y = this.casterYaw0;
    c.material.emissive.setRGB(0, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.restoreCaster();
      return;
    }
    const t = this.time;
    if (!this.hitDone && t >= T_HIT) this.onHit();
    if (!this.releaseDone && t >= T_RELEASE) this.onRelease();
    if (!this.smokeDone && t >= T_RELEASE + 0.2) {
      this.smokeDone = true;
      this.smoke.trigger(this.contact.clone().setY(1.2), 1.1, 1.0);
    }
    this.layout(dt);
  }

  private layout(_dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const r = t - T_RELEASE; // time since release (negative before)
    const frozen = t >= T_FREEZE && t < T_RELEASE;
    let shake = 0;

    // --- Screen: pre-darken, card sequence, hit-stop grade, chroma. ---
    const pre = 0.25 * smoothstep((t - 0.3) / 0.2) * (1 - smoothstep((t - T_HIT) / 0.1));
    const hold = 0.4 * smoothstep((t - T_FREEZE) / 0.08) * (1 - smoothstep(r / 0.45));
    this.screen.darken = Math.max(pre, hold);
    this.screen.speedLines = t >= T_DASH && t < T_HIT ? 1 : 0;
    const cardIdx = Math.floor((t - T_HIT) / CARD_STEP);
    this.screen.impact = impactFrameAt(t, T_HIT, CARDS, CARD_STEP);
    if (cardIdx >= 0 && cardIdx < CARD_HEX.length) this.screen.impactColor.set(CARD_HEX[cardIdx]);
    const chromaHold = 0.3 * smoothstep((t - T_FREEZE) / 0.05) * (1 - smoothstep(r / 0.5));
    this.screen.chroma = Math.max(chromaHold, t >= T_RELEASE ? chromaPulse(t, T_RELEASE, 0.8) : 0);

    // --- Caster: crouch, dash, hold the jab, walk back. Never a zero scale. ---
    if (ctx) {
      const g = ctx.caster.group;
      const crouch = smoothstep(t / 0.28) * (1 - smoothstep((t - T_DASH) / (T_DASH_END - T_DASH)));
      g.scale.set(1 + 0.06 * crouch, 1 - 0.15 * crouch, 1 + 0.06 * crouch);
      const dashU = easeOut((t - T_DASH) / (T_DASH_END - T_DASH));
      const back = smoothstep((t - 2.3) / 0.5);
      const stage = new THREE.Vector3().lerpVectors(this.from, this.casterEnd, dashU);
      g.position.lerpVectors(stage, this.from, back);
      g.rotation.y = ctx.aim;
      const glow = t < T_HIT ? smoothstep(t / 0.3) : Math.exp(-(t - T_HIT) * 3);
      ctx.caster.material.emissive.setRGB(0.02 * glow, 0.28 * glow, 0.45 * glow);
    }

    // --- Cyan wisps around the caster (0-0.4), and a second set at the contact point on the release. ---
    for (let i = 0; i < WISPS; i++) {
      const w = this.wisps[i];
      const x = (t - i * 0.05) / 0.4;
      w.head = easeOut(x) * 1.35;
      w.length = 0.7;
      w.time = t;
      w.erosion = smoothstep((x - 0.7) / 0.5);
      w.opacity = x >= 0 && x < 1.3 ? 0.5 * smoothstep(x / 0.2) * (1 - smoothstep((x - 0.8) / 0.5)) : 0;
      const a = this.afterWisps[i];
      const y = (r - i * 0.06) / 0.6;
      a.head = easeOut(y) * 1.35;
      a.length = 0.7;
      a.time = t;
      a.erosion = smoothstep((y - 0.4) / 0.6);
      a.opacity = y >= 0 && y < 1.2 ? 0.45 * (1 - smoothstep((y - 0.5) / 0.7)) : 0;
    }

    // --- The ball lands on the head first, grows, and turns into shards at the hit. ---
    const bx = (t - T_BALL) / (T_HIT - T_BALL);
    const ballOn = t >= T_BALL && t < T_HIT + 0.04;
    this.ball.mesh.position.copy(this.head);
    this.ball.mesh.scale.setScalar(Math.max(1e-4, 0.3 + 0.55 * easeOut(bx)));
    this.ball.opacity = ballOn ? 0.55 : 0;
    this.ballCore.mesh.position.copy(this.head);
    this.ballCore.mesh.scale.setScalar(Math.max(1e-4, 0.14 + 0.2 * easeOut(bx)));
    this.ballCore.opacity = ballOn ? 0.7 : 0;
    const gp = StarBurst.pop(t - T_BALL - 0.02, 0.1, 0.12);
    this.glint.set(this.head, 1.1 * gp.scale, gp.opacity, t * 3);
    const sp = StarBurst.pop(t - T_HIT, 0.06, 0.12);
    this.shardStar.set(this.head, 2.4 * sp.scale, sp.opacity, 0.3);

    // --- Hard brush strokes shoot in along the dash. ---
    for (let i = 0; i < STROKES; i++) {
      const s = this.strokes[i];
      const x = (t - T_DASH - i * 0.02) / 0.15;
      s.head = easeOut(x) * 1.5;
      s.length = 0.55;
      s.time = t;
      s.erosion = smoothstep((x - 1) / 0.8);
      s.opacity = x >= 0 && x < 2 ? 1 : 0;
    }

    // --- Hit-stop: splash strokes hang at 5 % speed; at the release they fly out and erode. ---
    const hang = clamp01((t - T_FREEZE) / (T_RELEASE - T_FREEZE)) * (T_RELEASE - T_FREEZE);
    for (let i = 0; i < SPLASH; i++) {
      const a = this.splash[i];
      const pop = easeOut((t - T_FREEZE - i * 0.035) / 0.1);
      const out = easeOut(r / 0.4);
      a.head = 0.15 + 0.4 * pop + FROZEN_SPEED * 2.8 * hang + 1.2 * out;
      a.length = 0.5;
      a.time = T_FREEZE + hang * FROZEN_SPEED + Math.max(0, r);
      a.erosion = smoothstep((r - 0.05) / 0.5);
      const alive = t >= T_FREEZE && r < 0.7;
      a.opacity = alive ? 0.9 * smoothstep((t - T_FREEZE - i * 0.035) / 0.05) * (1 - smoothstep((r - 0.25) / 0.4)) : 0;
      const grow = 1 + 0.05 * hang + 0.9 * out;
      this.splashArm[i].scale.setScalar(Math.max(1e-4, grow));
    }
    for (let i = 0; i < STREAKS; i++) {
      const s = this.streaks[i];
      s.head = 1.2;
      s.length = 1;
      s.time = t;
      s.erosion = smoothstep(r / 0.3);
      s.opacity = frozen ? 0.6 * smoothstep((t - T_FREEZE - i * 0.03) / 0.04) : 0;
    }

    // --- Release: star, ring, shake. ---
    const bs = StarBurst.pop(r, 0.08, 0.2);
    this.bigStar.set(this.contact, 3.8 * bs.scale, bs.opacity, 0.5);
    this.ring.mesh.position.set(this.tFeet.x, 0.06, this.tFeet.z);
    this.ring.mesh.scale.setScalar(Math.max(1e-4, 0.8 + 5 * easeOut(r / 0.5)));
    this.ring.material.opacity = r >= 0 && r < 0.5 ? 0.8 * (1 - r / 0.5) : 0;
    if (r >= 0) shake = 0.7 * Math.exp(-r * 7);
    this.shake = frozen ? 0 : shake;
  }

  private onHit() {
    this.hitDone = true;
    this.shards.burst(90, this.head);
    this.sparks.burst(120, this.head);
    const ctx = this.ctx;
    if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 0, from: ctx.from, color: '#7fe8ff' });
  }

  private onRelease() {
    this.releaseDone = true;
    this.shards.burst(260, this.contact);
    this.sparks.burst(200, this.contact);
    const ctx = this.ctx;
    if (ctx && ctx.targets[0]) {
      ctx.hit(ctx.targets[0], { damage: 8, knock: this.settings.knock, from: this.casterEnd, color: '#ffffff' });
    }
  }
}

export const neonFractureJabModule: EffectModule = {
  label: 'neon fracture jab',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new NeonFractureJab(),
  telegraphs(effect) {
    const e = effect as NeonFractureJab;
    const ctx = e.ctx;
    if (!ctx) return [];
    const p = ctx.targetPos[0] ?? ctx.point;
    return [
      { shape: { kind: 'line' as const, x1: ctx.from.x, z1: ctx.from.z, x2: p.x, z2: p.z, width: 1.2 }, start: 0.05, impact: T_HIT },
      { shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.8 }, start: T_BALL, impact: T_HIT },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as NeonFractureJab;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as NeonFractureJab).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 15, 0.5);
  },
};
