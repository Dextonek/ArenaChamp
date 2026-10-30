import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BoneHand, BoneShards, BoneSpire, GroundCracks, SoulWisps, skeletonLook } from '../../effects/parts/bone';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Legion of the Ossuary (bone kit, R: the MOBA ultimate, summon). Under the normal gameplay camera, no letterbox: the
 * world darkens to a teal-black and cracks with teal light spread over the zone. A colossal skeletal hand (fingers about
 * 5 long, wrist about 4 high, soulfire in every joint) rises out of the ground at the zone's far edge, rears up and opens
 * over the point while the enemies are drawn in, closes into a fist, hangs for a dead beat, then slams down: a ring of
 * bone spires bursts across the zone, dust, an ember accent, a ground shockwave and the hit. Two skeleton archers climb
 * out of the cracks (`ctx.summon`); the hand crumbles into the ground, the spires sink and the light lifts. Clean by
 * 4.5 s. See pipeline/designs/kit-bone.md.
 */
export interface LegionOfTheOssuarySettings {
  damage: number;
  loop: boolean;
}

export const defaultLegionOfTheOssuary = (): LegionOfTheOssuarySettings => ({ damage: 95, loop: false });

// Timeline (seconds).
const DARK_T = 0.4; // the world has darkened, the cracks have spread
const RISE_T = 0.3; // the hand rises out of the ground
const OPEN_T = 1.0; // the fingers open over the point
const REAR_T = 1.6; // the hand is up and open
const CLOSE_T = 1.85; // the fist is closed
const BEAT_T = 1.85; // dead beat 1.85..2.0
const SLAM_T = 2.0;
const HIT_T = 2.2;
const ARCHER_T = 2.4;
const CRUMBLE_T = 2.6; // the hand sinks and falls apart
const SINK_T = 3.3; // the spires sink
const HAND_OUT_T = 4.0;
const DURATION = 4.5;

const RADIUS = 7;
const BEAT_LEN = SLAM_T - BEAT_T;
const SPIRES = 16;
const HAND_OPEN_SCALE = 0.75;
const OPEN_PITCH = -1.0;
const HAND_FIST_SCALE = 1.0;
const WRIST_OPEN_Y = 3.5;
const WRIST_HOLD_Y = 6.6;
const HOLD_OFFSET = -0.4;
const SLAM_DROP = 3.3;

/** The hand's clock: runs with the timeline but stands still during the dead beat. */
const gClock = (t: number) => (t < BEAT_T ? t : t < SLAM_T ? BEAT_T : t - BEAT_LEN);

export class LegionOfTheOssuary implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LegionOfTheOssuarySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  /** Unit ground direction from the caster to the point; the hand rises at point + fwd * 7 and faces back. */
  private fwd = new THREE.Vector3(0, 0, -1);
  private face = new THREE.Vector3(0, 0, 1);
  private base = new THREE.Vector3();
  private wristOpen = new THREE.Vector3();
  private wristHold = new THREE.Vector3();
  private wristLow = new THREE.Vector3();
  private wristUnder = new THREE.Vector3();
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = { cracks: false, hit: false, archers: false, crumble1: false, crumble2: false, sunk: false, faded: false };

  // Parts.
  private cracks = new GroundCracks();
  private hand = new BoneHand();
  private spires = Array.from({ length: SPIRES }, (_, i) => new BoneSpire(i % 6 === 1, 5, i));
  private shards = new BoneShards(56);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private w = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor(settings: LegionOfTheOssuarySettings = defaultLegionOfTheOssuary()) {
    this.settings = settings;
    this.screen.impactColor.set(BONE.hot);
    this.screen.tint.set(BONE.dark);
    this.group.add(
      this.cracks.mesh, this.hand.mesh, ...this.spires.map((s) => s.mesh), this.dust.mesh, this.shards.mesh, this.wisps.mesh,
      this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(this.point.x - ctx.from.x, 0, this.point.z - ctx.from.z);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.fwd.normalize();
    this.face.copy(this.fwd).negate();
    this.base.copy(this.point).addScaledVector(this.fwd, RADIUS).setY(-0.3);
    this.wristOpen.copy(this.point).addScaledVector(this.fwd, 3.0).setY(WRIST_OPEN_Y);
    this.wristHold.copy(this.point).addScaledVector(this.fwd, HOLD_OFFSET).setY(WRIST_HOLD_Y);
    this.wristLow.copy(this.wristHold).setY(WRIST_HOLD_Y - SLAM_DROP);
    this.wristUnder.copy(this.point).addScaledVector(this.fwd, 6.3).setY(-3.2);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1.5);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(BONE.dark);
    this.cracks.reset();
    this.hand.reset();
    for (const s of this.spires) s.reset();
    this.shards.reset();
    this.wisps.reset();
    this.dust.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < SLAM_T;
    this.cracks.frozen = held;
    this.wisps.frozen = held;
    this.dust.frozen = held;
    this.shards.frozen = held;
    this.cracks.update(dt);
    for (const s of this.spires) s.update(dt);
    this.shards.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.cracks && t >= 0.02) {
      f.cracks = true;
      this.cracks.spread(this.point, RADIUS, DARK_T);
      // Soulfire flickers out of the cracks across the zone.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4, r = RADIUS * (0.35 + 0.14 * (i % 4));
        this.wisps.attach(this.v1.set(this.point.x + Math.cos(a) * r, 0.12, this.point.z + Math.sin(a) * r), 1, 0.3, 0.22);
      }
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      // A ring of bone spires bursts outward across the zone (the far ones a hair later), the third of them skull-capped.
      this.spires.forEach((s, i) => {
        const ring = i < 6 ? 0 : 1;
        const a = ring === 0 ? (i / 6) * Math.PI * 2 + 0.2 : ((i - 6) / 10) * Math.PI * 2 + 0.5 + (i % 2) * 0.08;
        const r = ring === 0 ? 2.3 + (i % 3) * 0.3 : 4.4 + (i % 4) * 0.55;
        this.v1.set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
        s.grow(this.v1, 1.7 + (((i * 53) % 10) / 10) * 1.6, 0.3, 0.7, a, (r / RADIUS) * 0.14);
      });
      this.dust.ring(this.point, RADIUS, 14, 0.8);
      this.dust.burst(this.point, 10, 3.2, 0.6);
      this.shards.burst(this.v1.set(this.point.x, 0.4, this.point.z), 18, 7, 6, 0.46);
      this.wisps.puff(this.point, 6, 1.6, 0.3);
      if (ctx) for (const e of ctx.targets) if (this.inside(e)) ctx.hit(e, { damage: this.settings.damage, knock: 5, from: this.point, color: BONE_CSS.body });
    }
    if (!f.archers && t >= ARCHER_T) {
      f.archers = true;
      this.wisps.puff(this.point, 8, 1.2, 0.3);
      this.dust.burst(this.v1.set(this.point.x, 0, this.point.z), 6, 2.2, 0.5);
      ctx?.summon?.({
        kind: 'ranged', at: this.point.clone(), count: 2, hp: 35, seconds: 6, damage: 8, attackEvery: 1.5, color: BONE_CSS.body, look: skeletonLook,
      });
    }
    // The hand falls apart in two waves of chips as it sinks.
    if (!f.crumble1 && t >= CRUMBLE_T) {
      f.crumble1 = true;
      this.crumbleHand(10);
    }
    if (!f.crumble2 && t >= CRUMBLE_T + 0.55) {
      f.crumble2 = true;
      this.crumbleHand(8);
    }
    if (!f.sunk && t >= SINK_T) {
      f.sunk = true;
      this.spires.forEach((s, i) => s.crumble(0.5, (i % 5) * 0.05));
      this.wisps.release();
    }
    if (!f.faded && t >= SINK_T + 0.2) {
      f.faded = true;
      this.cracks.fade(0.9);
    }

    this.layout(dt);
  }

  /** A burst of chips and dust where the hand sinks. */
  private crumbleHand(n: number) {
    this.v1.copy(this.point).addScaledVector(this.fwd, 0.4).setY(0.5);
    this.shards.burst(this.v1, n, 5, 4, 0.42);
    this.dust.burst(this.v1.setY(0), 5, 2.4, 0.55);
    this.shake = Math.max(this.shake, 0.18);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  /** The hand's pose at hand-clock `g` (and real time `t` for the sink): wrist, pitch, curl, spread. */
  private pose(g: number, t: number, outWrist: THREE.Vector3) {
    // Rise out of the ground (0.3 - 1.0), then hold open over the point, palm to the camera, until 1.5.
    const rise = smoothstep((g - RISE_T) / (OPEN_T - RISE_T));
    outWrist.lerpVectors(this.wristUnder, this.wristOpen, rise);
    // Rear up and close (1.5 - 1.85): it grows, lifts and folds over into a fist held high over the point.
    const rear = smoothstep((g - 1.45) / (CLOSE_T - 1.45));
    outWrist.lerp(this.wristHold, rear);
    let pitch = OPEN_PITCH + (1.2 - OPEN_PITCH) * rear;
    // Fingers: half curled coming out, open at 1.0, a fist at 1.85.
    let curl = 0.55 - 0.5 * smoothstep((g - 0.7) / 0.3);
    curl += (1 - curl) * smoothstep((g - 1.5) / (CLOSE_T - 1.5));
    const spread = smoothstep((g - 0.7) / 0.3) * (1 - rear);
    // The slam: ease-in down to the landing spot.
    const s = THREE.MathUtils.clamp((t - SLAM_T) / (HIT_T - SLAM_T), 0, 1);
    const k = s * s * s;
    outWrist.lerp(this.wristLow, k);
    pitch += 0.1 * k;
    // The sink: it goes back into the ground.
    const sink = smoothstep((t - CRUMBLE_T) / (HAND_OUT_T - CRUMBLE_T));
    outWrist.y -= sink * 7;
    return { pitch, curl, spread, sink, scale: HAND_OPEN_SCALE + (HAND_FIST_SCALE - HAND_OPEN_SCALE) * rear };
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const g = gClock(t);

    // --- Screen: teal-black world, a lift at the landing, lifting away as the hand sinks. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / DARK_T) * (1 - smoothstep((t - 2.4) / 2.1));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The hand. ---
    if (t >= RISE_T && t < HAND_OUT_T) {
      const p = this.pose(g, t, this.w);
      this.b.copy(this.base);
      this.b.y -= p.sink * 3;
      this.hand.place(this.b, this.w, this.face, p.pitch, p.curl, p.spread, g, p.scale);
    } else this.hand.hide();

    // --- The pull on the enemies: in while the hand rises and closes, released at the landing. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - RISE_T) / (REAR_T - RISE_T + 0.4)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The landing: ember star at the centre, ground refraction, shake. ---
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.0), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.75 * Math.exp(-after * 9), this.shake * Math.exp(-dt * 10));
    }
  }
}

export const legionOfTheOssuaryModule: EffectModule = {
  label: 'legion of the ossuary',
  category: 'hero: bone',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new LegionOfTheOssuary(),
  telegraphs(effect) {
    const e = effect as LegionOfTheOssuary;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as LegionOfTheOssuary;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as LegionOfTheOssuary).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
