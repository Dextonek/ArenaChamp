import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Gale Bullet (targeted, single target): the caster kicks up a wind swirl and a dust cloud that hides them for a
 * beat, then fires a compact ball of spinning wind crescents. On the target it bursts into a cyclone of hard-edged
 * white and mint crescents on tilted planes that lifts the enemy and grinds it three times, then slams it down.
 * The crescents fade by turning into dark-teal ghosts that keep turning slowly.
 *
 * Recipes: e-seo-wind-bullet (timing and layers), e-yordin-soft-wind-swirl (the bullet and its gust lines).
 */
export interface GaleBulletSettings {
  damage: number;
  lift: number;
  color: string;
  loop: boolean;
}

export const defaultGaleBullet = (): GaleBulletSettings => ({
  damage: 40,
  lift: 1.5,
  color: '#40d8a0',
  loop: false,
});

const T_REL = 0.45; // bullet released, dust hides the caster
const T_HIT = 0.8; // bullet bursts into the cyclone
const HITS = [0.8, 1.1, 1.4]; // grinding hits
const T_SLAM = 1.9; // final drop
const DURATION = 3.4;
const CYC = 7;
const BIG = 3;
const GUSTS = 3;
const ROCKS = 20;
const GLINTS = 4;
const SWEEPS = [0, 0.38, 0.72]; // re-sweep offsets after T_HIT

const rand = (n: number) => {
  const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const WHITE = new THREE.Color(0xffffff);
const TEAL = new THREE.Color(0x2a6a5a);

interface CycArc {
  plane: THREE.Group;
  soft: CrescentArc;
  ghost: CrescentArc;
  start: number;
  dur: number;
  phase: number;
}

export class GaleBullet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GaleBulletSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private relDone = false;
  private hitDone = [false, false, false];
  private slamDone = false;

  // Cast geometry.
  private start = new THREE.Vector3();
  private chest = new THREE.Vector3();
  private feet = new THREE.Vector3();
  private tFeet = new THREE.Vector3();

  // Anticipation at the caster.
  private swirlRoot = new THREE.Group();
  private swirl: CrescentArc[] = [];
  private castRing = createRing(0xffffff, 0.8, 1, 64);
  private puff = new GlowSphere(0xffffff, { rim: false });

  // The bullet.
  private bullet = new THREE.Group();
  private bulletArcs: CrescentArc[] = [];
  private bulletCore = new GlowSphere(0xe8fff8, { rim: false });
  private gustRoot: THREE.Group[] = [];
  private gusts: CrescentArc[] = [];

  // The cyclone (follows the target).
  private cycRoot = new THREE.Group();
  private cyc: CycArc[] = [];
  private bigPlanes: THREE.Group[] = [];
  private big: CrescentArc[] = [];
  private flash = new GlowSphere(0xe8fff8, { rim: false });
  private star = new StarBurst({ points: 9, color: 0x40d8a0, core: 0xffffff, additive: false });
  private slamStar = new StarBurst({ points: 12, color: 0x7affd0, core: 0xffffff, additive: false });
  private glints: StarBurst[] = [];
  private ringA = createRing(0x40d8a0, 0.72, 1, 96);
  private ringB = createRing(0xc8fff0, 0.93, 1, 96);
  private ringC = createRing(0x40d8a0, 0.8, 1, 96);
  private smoke = new SmokeBall({ maxBalls: 2 });

  private rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.9, emissive: 0x6a5a48, emissiveIntensity: 0 });
  private rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2), this.rockMat, ROCKS);
  private rockState = Array.from({ length: ROCKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));

  private dust: Emitter;
  private trail: Emitter;
  private sparks: Emitter;

  constructor(settings: GaleBulletSettings = defaultGaleBullet()) {
    this.settings = settings;
    this.screen.tint.set(0x3a5a6a);
    this.screen.impactColor.set(0x40d8a0);
    this.screen.speedLineColor.set(0xe8fff8);

    // Ground swirl: thin soft crescents lying flat at the caster's feet.
    this.swirlRoot.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const a = new CrescentArc({ radius: 0.9 + 0.35 * i, width: 0.22, sweep: Math.PI * 1.5, style: 'soft', edge: 0xffffff, mid: 0xdff8f4, outer: 0x9acfc8 });
      this.swirlRoot.add(a.mesh);
      this.swirl.push(a);
    }

    // Bullet: four small arcs on tilted planes around a soft core.
    for (let i = 0; i < 4; i++) {
      const plane = new THREE.Group();
      plane.rotation.set((i * Math.PI) / 4 + 0.3, (i * Math.PI) / 2.6, 0);
      const a = new CrescentArc({ radius: 0.5, width: 0.3, sweep: Math.PI * 1.6, style: 'soft', edge: 0xffffff, mid: 0xc8fff0, outer: 0x40d8a0 });
      plane.add(a.mesh);
      this.bullet.add(plane);
      this.bulletArcs.push(a);
    }
    this.bullet.add(this.bulletCore.mesh);

    // Gust lines: near-straight thin soft arcs trailing the bullet (local +Y = direction of travel).
    for (let i = 0; i < GUSTS; i++) {
      const root = new THREE.Group();
      const a = new CrescentArc({ radius: 8 + i * 2, width: 0.2 + i * 0.05, sweep: 0.42, style: 'soft', edge: 0xffffff, mid: 0xdff8f4, outer: 0x9acfc8 });
      root.add(a.mesh);
      this.group.add(root);
      this.gustRoot.push(root);
      this.gusts.push(a);
    }

    // Cyclone: hard-edged soft-style crescents on random tilted planes, each paired with a dark-teal ghost.
    for (let i = 0; i < CYC; i++) {
      const plane = new THREE.Group();
      const tilt = THREE.MathUtils.degToRad(20 + rand(i + 1) * 50);
      plane.rotation.set(Math.PI / 2 + (rand(i + 9) < 0.5 ? -tilt : tilt), rand(i + 17) * Math.PI * 2, 0, 'YXZ');
      const radius = 1.2 + rand(i + 31) * 1.3;
      const sweep = THREE.MathUtils.degToRad(120 + rand(i + 41) * 80);
      const soft = new CrescentArc({ radius, width: 0.55, sweep, style: 'soft', edge: 0xffffff, mid: 0xc8fff0, outer: 0x40d8a0 });
      const ghost = new CrescentArc({ radius, width: 0.55, sweep, style: 'toon', edge: 0x2a6a5a, mid: 0x1f4f46, outer: 0x0e2222 });
      plane.add(soft.mesh, ghost.mesh);
      this.cycRoot.add(plane);
      this.cyc.push({ plane, soft, ghost, start: i * 0.035, dur: 0.15 + rand(i + 53) * 0.1, phase: rand(i + 61) * Math.PI * 2 });
    }
    for (let i = 0; i < BIG; i++) {
      const plane = new THREE.Group();
      plane.rotation.set(Math.PI / 2 + (i - 1) * 0.55, i * 2.1, 0, 'YXZ');
      const a = new CrescentArc({ radius: 3.4 + i * 0.55, width: 1.2, sweep: Math.PI * 1.2, style: 'toon', edge: 0xf4f8f8, mid: 0xb0b8b8, outer: 0x6a7474 });
      plane.add(a.mesh);
      this.cycRoot.add(plane);
      this.bigPlanes.push(plane);
      this.big.push(a);
    }

    for (let i = 0; i < GLINTS; i++) {
      const g = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff });
      this.glints.push(g);
      this.group.add(g.mesh);
    }
    this.rocks.frustumCulled = false;

    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 6, speedJitter: 0.6, spread: 85, gravity: -0.3, drag: 3,
      sizeStart: 1, sizeEnd: 3, colorStart: '#d8dcd8', colorEnd: '#5a6060', colorMid: '#9aa0a0',
      opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.5, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.15, speed: 0.8, speedJitter: 0.8, spread: 180, gravity: 0, drag: 2.5,
      sizeStart: 0.45, sizeEnd: 0.05, colorStart: '#ffffff', colorEnd: '#40d8a0', colorMid: '#c8fff0',
      opacityStart: 0.4, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.6, spread: 120, gravity: 8, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#a0ffd8',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.dust, this.trail, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);

    this.group.add(
      this.swirlRoot, this.castRing.mesh, this.puff.mesh, this.bullet, this.cycRoot, this.flash.mesh,
      this.star.mesh, this.slamStar.mesh, this.ringA.mesh, this.ringB.mesh, this.ringC.mesh, this.smoke.mesh, this.rocks,
    );
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    this.ringA.material.color.set(this.settings.color);
    this.ringC.material.color.set(this.settings.color);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return T_HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.feet.copy(ctx.from).setY(0);
    this.start.copy(ctx.from).addScaledVector(fwd, 0.7).setY(1.5);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.tFeet.copy(target).setY(0);
    this.chest.copy(target).setY(1.3);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.relDone = false;
    this.hitDone = [false, false, false];
    this.slamDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const r of this.rockState) r.p.set(0, -50, 0);
    this.layout(0);
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
    }
    const t = this.time;
    // Anticipation dust plumes at the feet.
    if (!this.relDone && dt > 0 && t > 0.05 && t < T_REL && Math.floor(t / 0.12) !== Math.floor((t - dt) / 0.12)) {
      this.dust.burst(26, this.feet.clone().setY(0.15));
    }
    if (!this.relDone && t >= T_REL) this.onRelease();
    HITS.forEach((h, i) => { if (!this.hitDone[i] && t >= h) this.onHit(i); });
    if (!this.slamDone && t >= T_SLAM) this.onSlam();
    this.layout(dt);
  }

  private lift(t: number): number {
    const up = smoothstep((t - T_HIT) / (T_SLAM - T_HIT - 0.25));
    const wobble = 0.08 * Math.sin(t * 22) * up;
    if (t < T_SLAM) return this.settings.lift * up + wobble;
    return Math.max(0, this.settings.lift * (1 - (t - T_SLAM) / 0.07));
  }

  /** Bullet path point, u in 0..1: straight with a slight upward arc. */
  private path(u: number, out: THREE.Vector3) {
    out.lerpVectors(this.start, this.chest, u);
    out.y += 0.7 * Math.sin(Math.PI * u);
    return out;
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - T_HIT;
    const lift = this.lift(t);
    const fade = 1 - smoothstep((t - (DURATION - 0.6)) / 0.6);
    let shake = 0;

    // --- Screen: dim the world from the release on so the mint glows, release it after the slam. ---
    this.screen.darken = t < T_REL ? 0 : 0.5 * smoothstep((t - T_REL) / 0.35) * (1 - smoothstep((t - T_SLAM - 0.2) / 0.5));
    const sl = t - T_SLAM;
    this.screen.speedLines = t >= T_HIT && t < T_HIT + 0.15 ? 0.5 : sl >= 0 && sl < 0.18 ? 0.6 : 0;
    this.screen.focus.copy(this.chest).setY(this.chest.y + lift);
    this.screen.impact = impactFrameAt(t, T_SLAM, [1, 2]);

    // --- Anticipation: ground swirl, ring, white puff at waist height. ---
    const ant = smoothstep(t / 0.15);
    const swirlLife = t < T_REL ? 1 : Math.exp(-(t - T_REL) * 4);
    this.swirlRoot.position.set(this.feet.x, 0.08, this.feet.z);
    this.swirlRoot.scale.setScalar(0.6 + 0.9 * easeOut(t / 0.5));
    this.swirl.forEach((a, i) => {
      a.mesh.rotation.z = t * 7 + i * 2.1;
      a.head = ((t * 2.2 + i * 0.3) % 1.3) + 0.1;
      a.length = 0.55;
      a.time = t;
      a.opacity = 0.85 * ant * swirlLife * fade;
    });
    this.castRing.mesh.position.set(this.feet.x, 0.05, this.feet.z);
    this.castRing.mesh.scale.setScalar(0.8 + 1.4 * easeOut(t / 0.5));
    this.castRing.material.opacity = 0.5 * ant * swirlLife * fade;
    this.puff.mesh.position.set(this.feet.x, 1.1, this.feet.z);
    this.puff.mesh.scale.setScalar(0.3 + 0.5 * smoothstep(t / T_REL));
    this.puff.opacity = t < T_REL ? 0.4 * smoothstep((t - 0.1) / 0.3) : 0.4 * Math.exp(-(t - T_REL) * 9);

    // --- The bullet: forms in front of the caster, then flies to the chest. ---
    const flying = t >= T_REL && t < T_HIT;
    const bp = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    const showBullet = t >= 0.3 && t < T_HIT;
    if (t < T_REL) {
      this.path(0, bp);
      this.path(0.05, ahead);
    } else {
      const u = Math.min(1, (t - T_REL) / (T_HIT - T_REL));
      this.path(easeOut(u * 0.6) * 0.4 + u * 0.6, bp);
      this.path(Math.min(1, u + 0.05), ahead);
    }
    const dir = ahead.sub(bp);
    if (dir.lengthSq() < 1e-8) dir.set(Math.sin(ctx?.aim ?? 0), 0, Math.cos(ctx?.aim ?? 0));
    dir.normalize();
    this.bullet.visible = showBullet;
    this.bullet.position.copy(bp);
    this.bullet.scale.setScalar(t < T_REL ? 0.3 + 0.7 * smoothstep((t - 0.3) / 0.15) : 1);
    this.bulletArcs.forEach((a, i) => {
      a.mesh.rotation.z = t * (14 + i * 3) + i;
      a.head = ((t * 3 + i * 0.25) % 1.5) + 0.1;
      a.length = 0.55;
      a.time = t;
      a.opacity = showBullet ? 0.9 : 0;
    });
    this.bulletCore.mesh.scale.setScalar(0.3 + 0.1 * Math.sin(t * 40));
    this.bulletCore.opacity = showBullet ? 0.6 : 0;
    if (flying && dt > 0) this.trail.burst(10, bp);
    // Gust lines: thin streaks behind the bullet, sliding with it.
    const gustOn = flying ? 1 : 0;
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    this.gusts.forEach((g, i) => {
      const root = this.gustRoot[i];
      const rad = 8 + i * 2;
      const chord = rad * Math.sin(0.42);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      root.quaternion.copy(q);
      const off = new THREE.Vector3().copy(side).multiplyScalar((i - 1) * 0.35).addScaledVector(up, ((i % 2) - 0.5) * 0.4);
      const startP = bp.clone().addScaledVector(dir, -chord - i * 0.3).add(off);
      // The arc starts at local (rad, 0, 0); put that point at startP.
      root.position.copy(startP).sub(new THREE.Vector3(rad, 0, 0).applyQuaternion(q));
      g.head = 1.15;
      g.length = 0.9;
      g.time = t;
      g.opacity = 0.7 * gustOn;
    });
    if (flying) shake = Math.max(shake, 0.05);

    // --- Release: dust cloud around the caster hides it for a beat. ---
    if (t >= T_REL && t < T_REL + 0.2) shake = Math.max(shake, 0.25 * Math.exp(-(t - T_REL) * 8));

    // --- Cyclone around the (lifted) target. ---
    const cc = new THREE.Vector3(this.chest.x, this.chest.y + lift, this.chest.z);
    this.cycRoot.position.copy(cc);
    const spin = t < T_SLAM ? t * 1.5 : T_SLAM * 1.5 + (t - T_SLAM) * 0.45;
    this.cycRoot.rotation.y = spin;
    const active = t >= T_HIT;
    this.cycRoot.visible = active;
    for (const c of this.cyc) {
      c.soft.mesh.rotation.z = c.phase + spin * 1.6;
      c.ghost.mesh.rotation.z = c.phase + spin * 1.6;
      let op = 0;
      let head = -1;
      let kk = 0;
      for (let k = 0; k < SWEEPS.length; k++) {
        const x = (t - (T_HIT + SWEEPS[k] + c.start)) / c.dur;
        if (x >= 0 && x <= 1.15) {
          head = easeOut(Math.min(1, x)) * 1.5;
          op = 0.9 * (1 - smoothstep((x - 0.75) / 0.4));
          kk = k;
        }
      }
      // Later sweeps lose their white edge toward dark teal.
      c.soft.edgeColor.lerpColors(WHITE, TEAL, kk * 0.4);
      c.soft.head = head;
      c.soft.length = 0.5;
      c.soft.time = t;
      c.soft.opacity = active ? op * fade : 0;
      // Ghost: the dark-teal state, turning slowly, eroding away over about a second.
      const g = t - (T_SLAM - 0.15);
      c.ghost.head = ((Math.max(0, g) * 0.4 + c.start * 4) % 1.3) + 0.2;
      c.ghost.length = 0.6;
      c.ghost.time = t * 0.3;
      c.ghost.erosion = smoothstep((t - (T_SLAM + 0.1)) / 1.1);
      c.ghost.opacity = g > 0 ? 0.55 * smoothstep(g / 0.25) * (1 - smoothstep((t - (T_SLAM + 0.9)) / 0.9)) * fade : 0;
    }
    this.big.forEach((a, i) => {
      a.mesh.rotation.z = i * 2 + spin * 0.9;
      let op = 0;
      let head = -1;
      for (const off of [0.05 + i * 0.12, 0.6 + i * 0.1]) {
        const x = (t - (T_HIT + off)) / 0.45;
        if (x >= 0 && x <= 1.1) {
          head = easeOut(Math.min(1, x)) * 1.5;
          op = 0.8 * (1 - smoothstep((x - 0.7) / 0.4));
        }
      }
      a.head = head;
      a.length = 0.55;
      a.time = t;
      a.erosion = smoothstep((t - T_SLAM) / 0.8);
      a.opacity = active ? op * fade : 0;
    });

    // --- Impact: flash, star, rings, glints. ---
    this.flash.mesh.position.copy(cc);
    this.flash.mesh.scale.setScalar(1.2 + Math.max(0, after) * 5);
    this.flash.opacity = after >= 0 ? 0.8 * Math.exp(-after * 14) : 0;
    const pop = StarBurst.pop(after);
    this.star.set(cc, 3 * pop.scale, pop.opacity, 0.4);
    const ps = StarBurst.pop(sl - 0.02, 0.1, 0.2);
    this.slamStar.set(new THREE.Vector3(this.tFeet.x, 1.2, this.tFeet.z), 3.6 * ps.scale, ps.opacity, 0.2);

    const tf = this.tFeet;
    const ra = after / 0.45;
    this.ringA.mesh.position.set(tf.x, 0.06, tf.z);
    this.ringA.mesh.scale.setScalar(0.8 + 2.2 * easeOut(ra));
    this.ringA.material.opacity = after >= 0 ? Math.max(0, 0.85 * (1 - ra)) * fade : 0;
    const rb = (after - 0.1) / 0.7;
    this.ringB.mesh.position.set(tf.x, 0.07, tf.z);
    this.ringB.mesh.scale.setScalar(0.8 + 2.2 * easeOut(rb));
    this.ringB.material.opacity = rb >= 0 && rb <= 1 ? 0.7 * (1 - rb) * fade : 0;
    const rc = sl / 0.5;
    this.ringC.mesh.position.set(tf.x, 0.06, tf.z);
    this.ringC.mesh.scale.setScalar(1 + 3.2 * easeOut(rc));
    this.ringC.material.opacity = rc >= 0 && rc <= 1 ? 0.85 * (1 - rc) * fade : 0;

    // Four-point glints flicking at random points around the cyclone while it grinds.
    this.glints.forEach((g, i) => {
      const period = 0.14;
      const n = Math.floor((t - 0.85 - i * 0.035) / period);
      const age = t - 0.85 - i * 0.035 - n * period;
      if (n < 0 || t > T_SLAM + 0.05 || (n + i) % 3 === 0) { g.set(new THREE.Vector3(), 0, 0); return; }
      const sd = n * 7 + i * 31;
      const dirV = new THREE.Vector3(rand(sd) - 0.5, rand(sd + 1) - 0.5, rand(sd + 2) - 0.5);
      if (dirV.lengthSq() < 1e-6) dirV.set(1, 0, 0);
      dirV.normalize().multiplyScalar(1.2 + rand(sd + 3) * 1.4);
      const p = StarBurst.pop(age, 0.03, 0.07);
      g.set(cc.clone().add(dirV), 0.8 * p.scale, p.opacity, rand(sd + 4) * 3);
    });

    // Shake: the burst, the grinds, the slam.
    if (after >= 0) shake = Math.max(shake, 0.55 * Math.exp(-after * 7));
    for (const h of HITS.slice(1)) if (t >= h) shake = Math.max(shake, 0.25 * Math.exp(-(t - h) * 9));
    if (sl >= 0) shake = Math.max(shake, 0.85 * Math.exp(-sl * 6));
    this.shake = shake;

    // --- Lift the target; the arena resets this offset on every cast. ---
    if (ctx && ctx.targets[0]) ctx.displace(ctx.targets[0], new THREE.Vector3(0, lift, 0));

    // --- Rocks: dark chunks thrown outward, gravity 18. ---
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    this.rockMat.emissiveIntensity = after >= 0 ? 0.6 * Math.exp(-after * 3) : 0;
    for (let i = 0; i < ROCKS; i++) {
      const r = this.rockState[i];
      if (dt > 0 && r.p.y > -10) {
        r.v.y -= 18 * dt;
        r.p.addScaledVector(r.v, dt);
        if (r.p.y < 0.1) { r.p.y = 0.1; r.v.set(0, 0, 0); r.w.set(0, 0, 0); }
        r.r.set(r.r.x + r.w.x * dt, r.r.y + r.w.y * dt, r.r.z + r.w.z * dt);
      }
      sc.setScalar(Math.max(1e-4, (0.6 + (i % 5) * 0.25) * fade));
      m.compose(r.p, q.setFromEuler(r.r), sc);
      this.rocks.setMatrixAt(i, m);
    }
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  private onRelease() {
    this.relDone = true;
    // Big dust burst engulfs the caster.
    this.dust.burst(260, this.feet.clone().setY(0.7));
  }

  private onHit(i: number) {
    this.hitDone[i] = true;
    const ctx = this.ctx;
    const c = this.chest;
    if (i === 0) {
      this.sparks.burst(160, c);
      this.dust.burst(120, this.tFeet.clone().setY(0.2));
      for (const r of this.rockState) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 5;
        r.p.set(this.tFeet.x, 0.4, this.tFeet.z);
        r.v.set(Math.cos(a) * sp, 6 + Math.random() * 3, Math.sin(a) * sp);
        r.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      }
    } else {
      this.sparks.burst(50, c.clone().setY(c.y + this.lift(this.time)));
    }
    if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: 8, knock: 1, from: ctx.from, color: '#c8fff0' });
  }

  private onSlam() {
    this.slamDone = true;
    const ctx = this.ctx;
    this.sparks.burst(220, this.tFeet.clone().setY(0.5));
    this.dust.burst(180, this.tFeet.clone().setY(0.2));
    this.smoke.trigger(this.tFeet.clone().setY(0.9), 1.3, 1.2);
    if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 6, from: ctx.from, color: '#7affd0' });
  }
}

export const galeBulletModule: EffectModule = {
  label: 'gale bullet',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new GaleBullet(),
  telegraphs(effect) {
    const e = effect as GaleBullet;
    const ctx = e.ctx;
    if (!ctx) return [];
    const p = ctx.targetPos[0] ?? ctx.point;
    return [
      { shape: { kind: 'line' as const, x1: ctx.from.x, z1: ctx.from.z, x2: p.x, z2: p.z, width: 1.2 }, start: 0.1, impact: T_HIT },
      { shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 3 }, start: 0.45, impact: T_HIT, until: T_SLAM },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as GaleBullet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as GaleBullet).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'lift', 0, 4, 0.1);
    f.addColor(s, 'color').onChange(() => (effect as GaleBullet).applyStyle());
  },
};
