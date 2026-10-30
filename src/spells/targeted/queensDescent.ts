import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { HIVE, HIVE_CSS, Honeycomb, HoneySplash, QueenBody, Swarm, waspLook } from '../../effects/parts/hive';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Queen's Descent (hive kit, R: the swarm-queen dive that drops 3 wasp soldiers). Under the normal gameplay camera, no letterbox: the world darkens to
 * amber-black and honeycomb cells grow over the zone edge, then rise into a ring wall (about 2 high). Hundreds of wasps
 * stream in from the rim and form the silhouette of a giant queen wasp (about 8 wide wings, 6 long, hovering 4 to 7 high,
 * its top under 8.5) while the enemies are pulled in. At 1.6 s she folds her wings and points down; dead beat 1.85..2.0;
 * at 2.0 s the swarm-queen dives into the centre. At 2.2 s the swarm bursts outward in a ring with honey splashes, a green
 * star and the hit (slows, no stun); three wasp soldiers (melee units) peel off where she lands. The wasps scatter and fade, the wall crumbles, the darkness lifts; clean by 4.5 s.
 * See pipeline/designs/kit-hive.md.
 */
export interface QueensDescentSettings {
  damage: number;
  /** Seconds of slow on the hit. */
  slow: number;
  loop: boolean;
}

export const defaultQueensDescent = (): QueensDescentSettings => ({ damage: 85, slow: 1.5, loop: false });

// Timeline (seconds).
const RISE_T = 0.3; // the wall rises and the swarm gathers
const WALL_END_T = 1.6;
const FOLD_T = 1.6; // she folds her wings and points down
const BEAT_T = 1.85; // dead beat 1.85..2.0
const DIVE_T = 2.0; // she dives
const HIT_T = 2.2;
const CRUMBLE_T = 2.8;
const DURATION = 4.5;

const RADIUS = 7;
const N_WASP = 380;
const QS = 1.0; // scale of the queen
const TOP_MAX = 8.0; // the highest point of the queen (the gameplay frame ends near 8.5)
const HOVER_Y = 4.6;

const sstep = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const hs = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const easeIn = (x: number) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t; };

export class QueensDescent implements Effect {
  readonly group = new THREE.Group();
  readonly settings: QueensDescentSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private fwd = new THREE.Vector3(0, 0, 1);
  private lat = new THREE.Vector3(1, 0, 0);
  private from0 = new THREE.Vector3();
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  private flags = { start: false, crumble: false, hit: false };

  // The queen's frame for this frame: centre, body axis, wing axis, normal; the fold (0 open, 1 folded), the flap.
  private qc = new THREE.Vector3();
  private qa = new THREE.Vector3(0, 1, 0);
  private qp = new THREE.Vector3(1, 0, 0);
  private qn = new THREE.Vector3(0, 0, 1);
  private fold = 0;
  private flap = 0;
  private a0 = new THREE.Vector3();
  private region: Uint8Array;
  private ru = new Float32Array(N_WASP * 3);

  // Parts.
  private queen = new QueenBody();
  private swarm = new Swarm(N_WASP, 0.7);
  private floor = new Honeycomb(150, 'wax');
  private wall = new Honeycomb(150, 'wax');
  private honey = new HoneySplash(24);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();

  constructor(settings: QueensDescentSettings = defaultQueensDescent()) {
    this.settings = settings;
    this.screen.impactColor.set(HIVE.hot);
    this.screen.tint.set(HIVE.dark);
    this.region = new Uint8Array(N_WASP);
    for (let i = 0; i < N_WASP; i++) {
      this.region[i] = i % 20;
      this.ru[i * 3] = hs(i * 1.37 + 0.1);
      this.ru[i * 3 + 1] = hs(i * 2.11 + 5.3);
      this.ru[i * 3 + 2] = hs(i * 3.73 + 9.7);
    }
    this.group.add(this.queen.mesh, this.floor.mesh, this.wall.mesh, this.swarm.mesh, this.honey.mesh, this.pop.mesh, this.groundShock.mesh);
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
    this.from0.copy(ctx.from).setY(0);
    // The gameplay camera looks along caster -> point; the queen is laid out in the plane facing it.
    this.fwd.set(this.point.x - this.from0.x, 0, this.point.z - this.from0.z);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.fwd.normalize();
    this.lat.set(this.fwd.z, 0, -this.fwd.x);
    // Hover pose: head up and to the side, tilted 35 degrees from the vertical of the camera plane.
    const up = this.v1.set(0, Math.cos(0.2), 0).addScaledVector(this.fwd, Math.sin(0.2));
    this.a0.copy(up).multiplyScalar(Math.cos(0.87)).addScaledVector(this.lat, Math.sin(0.87)).normalize();
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fold = 0;
    this.flap = 0;
    this.flags.start = this.flags.crumble = this.flags.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(HIVE.dark);
    this.swarm.reset();
    this.queen.reset();
    this.floor.reset();
    this.wall.reset();
    this.honey.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** Poses the queen's frame (centre, body axis, wing axis, normal) for time `t`. */
  private poseQueen(t: number) {
    const pd = smoothstep((t - FOLD_T) / 0.25);
    this.fold = pd;
    // Body axis: tilted in the hover, then swung down to point at the ground.
    this.qa.copy(this.a0).lerp(this.v4.set(0, -1, 0), pd).normalize();
    this.qp.copy(this.lat).addScaledVector(this.qa, -this.lat.dot(this.qa)).normalize();
    this.qn.crossVectors(this.qa, this.qp);
    // Height: keep her top under the frame (the tail end rises when she points down), then drop into the centre.
    const rear = 4.6 * Math.max(0, -this.qa.y);
    const head = 2.2 * Math.max(0, this.qa.y) + 0.6;
    const wingUp = 4.1 * Math.abs(this.qp.y) * (1 - pd) + 1.0 * Math.abs(this.qa.y);
    const yTop = Math.min(HOVER_Y, TOP_MAX - Math.max(rear, head, wingUp));
    let y = yTop + Math.sin(t * 3) * 0.15 * (1 - pd);
    if (t >= DIVE_T) y = THREE.MathUtils.lerp(yTop, 1.4, easeIn((t - DIVE_T) / (HIT_T - DIVE_T)));
    this.qc.set(this.point.x, Math.max(y, 2.8), this.point.z);
    this.queen.set(this.qc, this.qa, this.qp, this.qn, pd, this.flap, sstep(0.4, 1.0, t));
  }

  /** Where wasp `i` sits in the queen's silhouette this frame (body, thorax, head, four wings, stinger, antennae). */
  private queenPoint = (i: number, out: THREE.Vector3): boolean => {
    const r = this.region[i];
    const u1 = this.ru[i * 3], u2 = this.ru[i * 3 + 1], u3 = this.ru[i * 3 + 2];
    const A = this.qa, P = this.qp, N = this.qn, Q = this.qc;
    const f = this.fold;
    let a = 0, p = 0, n = 0;
    if (r < 7) {
      // Abdomen: a long ellipsoid shell behind the thorax.
      const s = u1;
      const rad = 1.12 * QS * Math.pow(Math.max(Math.sin(Math.PI * (0.1 + 0.8 * s)), 0.05), 0.75) * (0.8 + 0.2 * u3);
      const ang = u2 * Math.PI * 2;
      a = -(0.5 + 3.0 * s) * QS;
      p = Math.cos(ang) * rad;
      n = Math.sin(ang) * rad * 0.9;
    } else if (r < 10) {
      // Thorax (7, 8) and head (9): small spheres.
      const th = u1 * Math.PI * 2, z = 2 * u2 - 1, rho = Math.sqrt(1 - z * z);
      const rad = (r < 9 ? 1.0 : 0.7) * QS * (0.7 + 0.3 * u3);
      a = z * rad + (r < 9 ? 0.1 : 1.55) * QS;
      p = rho * Math.cos(th) * rad;
      n = rho * Math.sin(th) * rad;
    } else if (r < 18) {
      // Wings: a leaf-shaped fan from a root on the thorax; folded they lie back along the body.
      const k = r - 10;
      const side = k & 1 ? 1 : -1, hind = (k >> 1) & 1;
      const span = (hind ? 2.6 : 3.9) * QS, chord = (hind ? 1.2 : 1.8) * QS * (1 - 0.5 * f);
      const sweep = hind ? 0.55 : 0.25;
      this.v2.copy(P).multiplyScalar(side * Math.cos(sweep)).addScaledVector(A, -Math.sin(sweep));
      this.v3.copy(P).multiplyScalar(side * 0.25).addScaledVector(A, -0.97);
      const wd = this.v2.lerp(this.v3, f).normalize();
      const cd = this.v3.copy(A).addScaledVector(wd, -A.dot(wd)).normalize();
      const s = 0.06 + 0.94 * Math.pow(u1, 0.6);
      const leaf = Math.min(1, 0.3 + 2.0 * Math.sqrt(s) * (1 - s));
      const tc = (u2 - 0.5) * chord * leaf - 0.25 * chord * s * (1 - f);
      const root = (hind ? -0.15 : 0.35) * QS;
      out.copy(Q).addScaledVector(A, root).addScaledVector(wd, span * s).addScaledVector(cd, tc);
      out.addScaledVector(N, 0.04 * span * s + Math.sin(this.flap * 20 + i) * 0.12 * (1 - f) * s);
      return true;
    } else if (r === 18) {
      // Stinger.
      a = -(3.6 + 0.9 * u1) * QS;
      p = (u2 - 0.5) * 0.2 * (1 - u1);
      n = (u3 - 0.5) * 0.2 * (1 - u1);
    } else {
      // Antennae.
      const s = u1;
      a = (1.9 + 1.1 * s) * QS;
      p = (u2 < 0.5 ? -1 : 1) * (0.3 + 0.8 * s) * QS;
      n = 0;
    }
    out.copy(Q).addScaledVector(A, a).addScaledVector(P, p).addScaledVector(N, n);
    return true;
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < DIVE_T;
    this.swarm.frozen = held;
    this.honey.frozen = held;
    this.floor.frozen = held;
    this.wall.frozen = held;
    this.swarm.update(dt);
    this.floor.update(dt);
    this.wall.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;
    if (!held) this.flap += dt;

    // 0..0.4: the honeycomb grows over the zone edge; from 0.3 the ring wall rises.
    if (!f.start) {
      f.start = true;
      this.floor.grow(this.point, RADIUS + 0.4, 0.45, RADIUS - 1.4, 0.5);
      this.wall.wall(this.point, RADIUS, 2.0, WALL_END_T - RISE_T, 0.5, 3);
    }
    // The swarm gathers from the rim into the queen's silhouette.
    if (t >= RISE_T && !held && t < HIT_T) {
      if (this.swarm.count === 0) {
        this.swarm.spawner = (i, out) => {
          const a = hs(i * 1.9 + 0.4) * Math.PI * 2, r = RADIUS * (0.9 + 0.25 * hs(i * 4.1));
          out.set(this.point.x + Math.cos(a) * r, 0.3 + hs(i * 2.3) * 3.2, this.point.z + Math.sin(a) * r);
        };
        this.swarm.form(this.queenPoint, 1, 3);
      }
      this.swarm.count = Math.round(N_WASP * sstep(RISE_T, 1.3, t));
      this.swarm.stiffness = t < DIVE_T ? 4 + 5 * sstep(0.6, 1.4, t) : 18;
    }

    // Pull the enemies toward the centre while the hive builds, released at the landing.
    if (ctx) {
      const after0 = t - HIT_T;
      const pull = 0.4 * smoothstep((t - RISE_T) / 1.3) * (1 - smoothstep(after0 / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.swarm.center.copy(this.point);
      this.swarm.scatter(1.8, true, 7);
      this.honey.burst(this.v1.set(this.point.x, 0.3, this.point.z), 12, 7, 0.2, 5);
      this.shake = 0.7;
      if (ctx) {
        for (const v of this.victims) {
          if (!this.inside(v.enemy)) continue;
          ctx.hit(v.enemy, { damage: this.settings.damage, knock: 3, from: this.point, color: HIVE_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
        }
        // Three wasp soldiers (melee units, inside the cap of 6 together with Swarm Leap's two) drop where she lands.
        ctx.summon?.({
          kind: 'melee', at: this.point.clone(), count: 3, hp: 40, seconds: 6, damage: 6, attackEvery: 1, color: HIVE_CSS.body, look: waspLook,
        });
      }
    }
    if (f.hit && !f.crumble && t >= CRUMBLE_T) {
      f.crumble = true;
      this.wall.crumble(1.2);
      this.floor.crumble(1.0);
    }

    this.layout();
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;

    // Screen: amber-black, lifting away after the crumble; impact frames at the hit.
    let dk = 0.55 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 1.0));
    if (after >= 0) dk *= 1 - 0.25 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // The queen's frame.
    if (t < HIT_T) this.poseQueen(t);
    else this.queen.hide();

    // The landing: green star at the centre, ground refraction, shake.
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.set(this.point.x, 1.2, this.point.z), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.7 * Math.exp(-after * 9);
    }
  }
}

export const queensDescentModule: EffectModule = {
  label: "queen's descent",
  category: 'hero: hive',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new QueensDescent(),
  telegraphs(effect) {
    const e = effect as QueensDescent;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as QueensDescent;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as QueensDescent).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
