import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ALCHEMY, AcidPool, Bubbles, GlassShards, REACTION_PREVIEW, REAGENT, ReactionBurst, previewReactions, type ReactionPreview } from '../../effects/parts/alchemy';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Enemy } from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';
import { takeReaction } from '../../traits/alchemy';

/**
 * Toxin Dart (alchemy kit, Q: a 9 m line skillshot, reagent green). She flicks a glass dart full of green toxin out of
 * her bandolier; it glints for a beat, then flies fast as a bolt (`ctx.projectile`, dodged by stepping off the line).
 * On a hit it bursts into a green splat (an impact frame, a star, glass chips) and the toxin clings to the body as a
 * bubbling green blob while it eats at them: 25 up front, then 5 five times over 3 s (`ctx.hit` with `projectile: true`,
 * so the ticks follow a target that walks). The green reagent itself is the trait's (`src/traits/alchemy.ts`); when this
 * hit sets off a reaction the effect reads it (`takeReaction`) and plays that burst. A miss only splashes the floor.
 * With no projectile (a network duel on the caster's screen) the dart is a deterministic visual and nothing hits.
 * See pipeline/designs/kit-alchemy.md.
 */
export interface ToxinDartSettings {
  damage: number;
  /** Damage of each burn tick (five of them, 0.6 s apart). */
  tick: number;
  loop: boolean;
  /** Tool preview only: plays this reaction burst when no reaction was set off (no trait runs there). */
  reaction: ReactionPreview;
}

export const defaultToxinDart = (): ToxinDartSettings => ({ damage: 22, tick: 5, loop: false, reaction: 'none' });

// Timeline (seconds).
const GLINT_T = 0.12;
const THROW_T = 0.25;
const DURATION = 4.3;
const REACH = 9; // from her feet: the kit's range
const MUZZLE = 0.5;
const SPEED = 20;
const RADIUS = 0.4;
const FLIGHT_END = THROW_T + (REACH - MUZZLE) / SPEED;
const TICKS = 5;
const TICK_EVERY = 0.6;
const DART_LEN = 0.7;

export class ToxinDart implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ToxinDartSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.35, 13);
  private feet = new THREE.Vector3(0, 0, -8);
  private head = new THREE.Vector3(0, BOLT_HEIGHT, 0);
  private hit = new THREE.Vector3(0, 1.1, -8);
  private bolt: Projectile | null = null;
  private victim: Enemy | null = null;
  private impT = -1;
  private struck = false;
  private trailTimer = 0;
  private globAt = new THREE.Vector3();

  private flags = { glint: false, thrown: false, landed: false, splat: false };
  private nextTick = 0;

  // Parts.
  private dart = new THREE.Group();
  private dartCore: THREE.Mesh;
  private glob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: REAGENT[0].body, transparent: true, opacity: 0.92 }));
  private globRim = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: REAGENT[0].hot, transparent: true, opacity: 0.45, wireframe: true }));
  private shards = new GlassShards({ max: 40, color: REAGENT[0].body, edge: ALCHEMY.core, opacity: 0.95 });
  private pool = new AcidPool(20);
  private bubbles = new Bubbles(40);
  private glint = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: REAGENT[0].hot, core: ALCHEMY.core, additive: false });
  private pop = new StarBurst({ points: 9, inner: 0.3, color: REAGENT[0].hot, core: ALCHEMY.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private reaction = new ReactionBurst();

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q = new THREE.Quaternion();

  constructor(settings: ToxinDartSettings = defaultToxinDart()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    this.screen.impactColor.set(REAGENT[0].hot);
    this.pool.tint(REAGENT[0]);
    this.pool.boil = 5;
    this.pool.bubbleSize = 0.2;
    this.bubbles.tint(REAGENT[0]);

    // The dart: a pale glass shell round a bright green core, a needle tip and a glint-white cap. Axis along +Z.
    const body = new THREE.CapsuleGeometry(0.055, DART_LEN * 0.6, 4, 10).rotateX(Math.PI / 2);
    this.dartCore = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: REAGENT[0].hot }));
    const shell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, DART_LEN * 0.6, 4, 10).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ALCHEMY.glass, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: ALCHEMY.core }));
    tip.position.z = DART_LEN * 0.5;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: ALCHEMY.glass }));
    cap.position.z = -DART_LEN * 0.4;
    this.dart.add(this.dartCore, shell, tip, cap);

    this.group.add(
      this.pool.mesh, this.shards.mesh, this.bubbles.mesh, this.dart, this.glob, this.globRim, this.glint.mesh, this.pop.mesh,
      this.groundShock.mesh, this.reaction.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return THROW_T + 0.1;
  }

  /** Seconds until the dart has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.3).setY(1.35);
    this.feet.copy(ctx.from).addScaledVector(this.fwd, REACH).setY(0);
    this.hit.copy(this.feet).setY(1.1);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.trailTimer = 0;
    this.bolt = null;
    this.victim = null;
    this.impT = -1;
    this.struck = false;
    this.nextTick = 0;
    this.head.copy(this.hand);
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.dart.visible = false;
    this.glob.visible = false;
    this.globRim.visible = false;
    this.shards.reset();
    this.pool.reset();
    this.bubbles.reset();
    this.reaction.reset();
    this.glint.set(this.hand, 0, 0);
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.reaction.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.pool.update(dt);
    this.bubbles.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.glint && t >= GLINT_T) {
      f.glint = true;
      this.bubbles.emit(this.v1.copy(this.hand), 0.07, { life: 0.5, rise: 1.4 });
    }
    // The throw: the dart flies as a bolt (without one, no bolt flies on this screen and the visual runs the same path).
    if (!f.thrown && t >= THROW_T) {
      f.thrown = true;
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.fwd, MUZZLE);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 0, color: REAGENT[0].css },
        });
        this.bolt.onHit((target, at) => this.land(at, target));
      }
    }
    if (f.thrown && !f.landed) {
      const b = this.bolt;
      if (b) {
        if (b.alive) this.head.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        else this.land(b.pos, null);
      } else {
        const d = Math.min(REACH - MUZZLE, (t - THROW_T) * SPEED);
        this.head.copy(ctx?.from ?? this.feet).addScaledVector(this.fwd, MUZZLE + d).setY(BOLT_HEIGHT);
        if (d >= REACH - MUZZLE) this.land(this.head, null);
      }
      // A thin green bubble trail along the flight.
      this.trailTimer += dt;
      while (this.trailTimer >= 0.03) {
        this.trailTimer -= 0.03;
        this.v1.copy(this.head).addScaledVector(this.fwd, -0.3 - Math.random() * 0.6);
        this.v1.x += (Math.random() - 0.5) * 0.12; this.v1.z += (Math.random() - 0.5) * 0.12;
        this.bubbles.emit(this.v1, 0.05 + Math.random() * 0.04, { life: 0.3 + Math.random() * 0.25, rise: 0.4 });
      }
    }
    if (f.landed) this.afterLanding(t, dt);

    this.layout();
  }

  /** The dart lands: on a body (`victim`) or at the end of its range / a pillar. */
  private land(at: THREE.Vector3, victim: Enemy | null) {
    const f = this.flags;
    if (f.landed) return;
    f.landed = true;
    this.victim = victim;
    this.struck = victim !== null;
    this.impT = this.time;
    this.head.set(at.x, BOLT_HEIGHT, at.z);
    this.feet.set(at.x, 0, at.z);
    this.hit.set(at.x, 1.1, at.z);
    this.screen.focus.copy(this.hit);
    this.dart.visible = false;
    if (this.struck) {
      this.shards.burst(this.hit, 8, 5.5, { size: 0.2, life: 0.5 });
      this.bubbles.splash(this.hit, 0.3);
      this.shake = 0.32;
      this.nextTick = this.time + TICK_EVERY;
      this.react();
    } else {
      this.pool.spread(this.feet, 0.7, 0.15);
      this.pool.bubbleAt(this.feet.x, this.feet.z, 0.12, 0.5);
      this.bubbles.splash(this.v1.set(at.x, 0.1, at.z), 0.2);
      this.shake = 0.08;
    }
  }

  /** Plays the reaction burst the hit that just landed set off (the trait wrote it inside `ctx.hit`). */
  private react() {
    const ctx = this.ctx, v = this.victim;
    if (!ctx || !v) return;
    let kinds = takeReaction(ctx.caster);
        if (!kinds.length) kinds = previewReactions(this.settings.reaction);
    if (kinds.length) this.reaction.trigger(kinds, v.group.position);
  }

  /** The toxin at work: the blob clings, bubbles rise off it, five ticks bite. */
  private afterLanding(t: number, dt: number) {
    const f = this.flags;
    const after = t - this.impT;
    const v = this.victim, ctx = this.ctx;
    if (!f.splat && after >= 0.04) {
      f.splat = true;
      this.pool.spread(this.feet, this.struck ? 1.1 : 0.7, 0.18);
      if (this.struck) for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random();
        this.pool.bubbleAt(this.feet.x + Math.cos(a) * 0.4, this.feet.z + Math.sin(a) * 0.4, 0.12 + Math.random() * 0.1);
      }
    }
    if (!this.struck || !v) return;
    const clingEnd = TICKS * TICK_EVERY + 0.3;
    if (after < clingEnd + 0.25) {
      // The blob follows the body (live position), bubbling.
      this.globAt.set(v.group.position.x, 1.05, v.group.position.z);
      if (Math.random() < dt * 14) {
        this.v2.set(this.globAt.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.1, this.globAt.z + (Math.random() - 0.5) * 0.6);
        this.bubbles.emit(this.v2, 0.06 + Math.random() * 0.06, { life: 0.5 + Math.random() * 0.4, rise: 0.8 });
      }
    }
    // The ticks (the first hit already carried the reagent; later ones are the same cast, so they add none).
    while (this.nextTick > 0 && this.time >= this.nextTick && this.nextTick < this.impT + TICKS * TICK_EVERY + 0.01) {
      this.nextTick += TICK_EVERY;
      ctx?.hit(v, { damage: this.settings.tick, knock: 0, from: ctx.from, color: REAGENT[0].css, projectile: true });
      this.v2.set(v.group.position.x, 1.2, v.group.position.z);
      this.bubbles.splash(this.v2, 0.18);
      this.shake = Math.max(this.shake, 0.05);
    }
  }

  private layout() {
    const t = this.time;
    const after = t - this.impT;
    const f = this.flags;

    // --- 0..0.2 Pluck: the dart rises out of the bandolier into her hand, a green glint on its tip at 0.12. ---
    if (t < THROW_T || (f.thrown && !f.landed)) {
      this.dart.visible = true;
      this.dartCore.scale.setScalar(1);
      if (!f.thrown) {
        const k = smoothstep(t / 0.12);
        this.dart.position.copy(this.hand).addScaledVector(this.fwd, 0.1 * k);
        this.dart.position.y -= 0.3 * (1 - k);
        this.dart.scale.setScalar(0.4 + 0.6 * k);
        this.v1.copy(this.fwd);
      } else {
        this.dart.position.copy(this.head);
        this.dart.scale.setScalar(1.15);
        this.v1.copy(this.bolt ? this.bolt.dir : this.fwd).setY(0).normalize();
      }
      this.q.setFromUnitVectors(this.v2.set(0, 0, 1), this.v1);
      this.dart.quaternion.copy(this.q);
    } else {
      this.dart.visible = false;
    }
    const gk = t - GLINT_T;
    const gs = gk >= 0 ? StarBurst.pop(gk, 0.04, 0.1) : { scale: 0, opacity: 0 };
    this.v1.copy(this.hand).addScaledVector(this.fwd, 0.4);
    this.glint.set(this.v1, 0.9 * gs.scale, gs.opacity, 0.3);

    // --- Impact: a green star, a ground ring, an impact frame, shake. ---
    let imp: 0 | 1 | 2 | 3 | 4 = 0;
    if (f.landed && this.struck) {
      imp = impactFrameAt(t, this.impT, [1], 0.03);
      const sp = StarBurst.pop(after - 0.03, 0.0, 0.015);
      this.pop.set(this.hit, 1.2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.3 + 1.8 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.32 * Math.exp(-after * 14));
    } else if (f.landed) {
      this.shake = 0.08 * Math.exp(-after * 12);
    }
    this.screen.impact = imp !== 0 ? imp : this.reaction.impact;
    this.shake = Math.max(this.shake, this.reaction.shake);

    // --- The clinging blob: swells in, pulses while the ticks bite, shrinks away. ---
    if (this.struck && this.victim) {
      const end = TICKS * TICK_EVERY + 0.3;
      const grow = smoothstep(after / 0.15) * (1 - smoothstep((after - end) / 0.25));
      const pulse = 1 + 0.12 * Math.sin(t * 16);
      this.glob.visible = this.globRim.visible = grow > 0.01;
      this.glob.position.copy(this.globAt);
      this.globRim.position.copy(this.globAt);
      this.glob.scale.setScalar(Math.max(1e-3, 0.3 * grow * pulse));
      this.globRim.scale.setScalar(Math.max(1e-3, 0.48 * grow * pulse));
      this.globRim.rotation.y = t * 2;
    }
  }
}

export const toxinDartModule: EffectModule = {
  label: 'toxin dart',
  category: 'hero: alchemy',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim strip.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ToxinDart(),
  telegraphs(effect) {
    const e = effect as ToxinDart;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the dart has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * REACH, z2: ctx.from.z + d.z * REACH, width: boltWidth(RADIUS) },
      start: 0.08, impact: THROW_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ToxinDart;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ToxinDart).settings;
    f.add(s, 'loop');
    f.add(s, 'reaction', [...REACTION_PREVIEW]);
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'tick', 1, 30, 1);
  },
};
