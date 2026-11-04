import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  ALCHEMY, Bubbles, Flask, GlassShards, REACTION_PREVIEW, REAGENT, ReactionBurst, TransmuteCircle, homunculusLook, previewReactions,
  type ReactionPreview,
} from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { SummonUnit } from '../../effects/summon';
import type { Effect, EffectModule } from '../../effects/types';
import { takeReaction } from '../../traits/alchemy';

/**
 * Homunculus (alchemy kit, R: the ultimate, a walking bomb). She pulls three vials (green toxin, orange fire, violet
 * acid) from her bandolier and flings them into an alchemical circle at her feet; the circle flares and a little
 * glass-bellied homunculus (`ctx.summon`, `homunculusLook`) hops out of it, at her feet (`ctx.from`, not the aim spot), with the three reagents swirling in its belly, and
 * waddles at the enemy (4 m/s). It bursts on contact: when it comes within 1.5 m of an enemy the effect hits everyone
 * within 2 m for 70 (`ctx.hit` with `projectile: true`: the touch is the dodge check) and ends the unit by setting its
 * `left` to 0. The trait (`src/traits/alchemy.ts`) keys on slot 3: that one hit carries all three reagents, so Combust,
 * Corrode and Concussion all go off; the effect reads them (`takeReaction`) and plays the three bursts, a beat apart, on
 * the enemy. It lives 3.7 s at most (the duel drops a hit more than about 4.2 s after the cast: it appears at 0.4 s) and
 * can be shot down (120 HP): then it only fizzles. Network duels leave `ctx.summon` undefined: the effect plays the look
 * with the homunculus as a flask thrown at the enemy, which bursts there and hits no one. See
 * pipeline/designs/kit-alchemy.md.
 */
export interface HomunculusSettings {
  damage: number;
  hp: number;
  /** Walking speed (m/s). */
  speed: number;
  loop: boolean;
  /** Tool preview only: plays this reaction burst when no reaction was set off (no trait runs there). */
  reaction: ReactionPreview;
}

export const defaultHomunculus = (): HomunculusSettings => ({ damage: 55, hp: 120, speed: 4, loop: false, reaction: 'none' });

// Timeline (seconds).
const SPAWN_T = 0.4; // the circle flares, the homunculus hops out
/** Lifetime of the unit: it must burst before the duel's hit window (about 4.2 s after the cast) closes. */
const LIFE = 3.7;
const CONTACT = 1.5; // the burst fires when an enemy is this close
const BLAST = 2; // everyone this close to the unit is hit
const TAIL = 1.4; // seconds the effect plays on after the burst
const DURATION = SPAWN_T + LIFE + TAIL;
const CIRCLE_R = 1.4;
const THROW_SECONDS = 0.9; // network look: the flask's flight

export class Homunculus implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HomunculusSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 13);
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private spot = new THREE.Vector3(0, 0, 13); // where the circle lies and the homunculus appears: her feet
  private flags = { spawned: false, burst: false, flare: false };
  private unit: SummonUnit | null = null;
  private burstT = -1;
  private burstAt = new THREE.Vector3();
  private endAt = DURATION;
  private done = false; // burst or fizzle already happened
  private stepClock = 0;
  private last = new THREE.Vector3();

  // Parts.
  private vials = REAGENT.map((r) => new Flask(r));
  private circle = new TransmuteCircle();
  private bomb = new Flask(REAGENT[1]); // the network look: the homunculus as a flask in flight
  private shardSets = REAGENT.map((r) => new GlassShards({ max: 32, color: r.body, edge: r.hot, opacity: 0.95 }));
  private bubbles = new Bubbles(40);
  private balls = REAGENT.map((r) => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: r.body, transparent: true, depthWrite: false })));
  private blastRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ALCHEMY.core, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  private pop = new StarBurst({ points: 12, inner: 0.3, color: REAGENT[1].hot, core: ALCHEMY.core, additive: false });
  private flare = new StarBurst({ points: 6, inner: 0.25, color: REAGENT[0].hot, core: ALCHEMY.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private reaction = new ReactionBurst();

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HomunculusSettings = defaultHomunculus()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    this.screen.impactColor.set(REAGENT[1].hot);
    this.circle.hole = 0.25;
    this.bubbles.tint(REAGENT[0]);
    this.group.add(
      this.circle.mesh, ...this.vials.map((v) => v.mesh), this.bomb.mesh, ...this.shardSets.map((s) => s.mesh), this.bubbles.mesh,
      ...this.balls, this.blastRing, this.pop.mesh, this.flare.mesh, this.groundShock.mesh, this.reaction.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SPAWN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.45).addScaledVector(this.side, 0.3).setY(1.4);
    this.spot.copy(ctx.from).setY(0); // at her feet: the unit climbs out here and walks at the enemy
    this.circle.set(this.spot, CIRCLE_R);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.unit = null;
    this.burstT = -1;
    this.endAt = DURATION;
    this.done = false;
    this.stepClock = 0;
    this.burstAt.copy(this.spot);
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.circle.reset();
    this.circle.hole = 0.25;
    for (const v of this.vials) v.reset();
    this.bomb.reset();
    for (const s of this.shardSets) s.reset();
    this.bubbles.reset();
    this.reaction.reset();
    for (const b of this.balls) b.visible = false;
    this.blastRing.visible = false;
    this.pop.set(this.spot, 0, 0);
    this.flare.set(this.spot, 0, 0);
    this.groundShock.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.reaction.update(dt);
    if (!this.playing) return;
    for (const s of this.shardSets) s.update(dt);
    this.bubbles.update(dt);
    this.time += dt;
    if (this.time >= this.endAt) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // The spawn: the circle flares and the homunculus hops out (or, online, the bomb flask is launched).
    if (!f.spawned && t >= SPAWN_T) {
      f.spawned = true;
      this.flareUp();
      const handle = ctx?.summon?.({
        kind: 'melee', at: this.spot.clone(), count: 1, hp: this.settings.hp, seconds: LIFE, damage: 0, attackEvery: 99,
        speed: this.settings.speed, color: REAGENT[0].css, look: homunculusLook,
      });
      const unit = handle?.units[0];
      if (handle && unit) {
        this.unit = unit;
        this.last.copy(unit.pos);
        // Shot down before it arrives: only a fizzle. (Running out of time after a burst is ignored: `done` is set.)
        handle.onDeath((u) => {
          if (u === this.unit && !this.done) this.fizzle(u.pos);
        });
      } else if (!ctx?.summon) {
        this.bomb.mesh.visible = true;
      } else {
        this.fizzle(this.spot);
      }
    }
    if (f.spawned && !this.done) this.follow(dt);
    this.layout(dt);
  }

  /** The circle flares: a green star, shards and bubbles where the homunculus appears. */
  private flareUp() {
    this.flags.flare = true;
    this.v1.set(this.spot.x, 0.8, this.spot.z);
    for (let i = 0; i < 3; i++) this.shardSets[i].burst(this.v1, 5, 5, { size: 0.2, life: 0.5 });
    for (let i = 0; i < 6; i++) {
      this.v2.set(this.spot.x + (Math.random() - 0.5) * 1.2, 0.1, this.spot.z + (Math.random() - 0.5) * 1.2);
      this.bubbles.emit(this.v2, 0.08 + Math.random() * 0.08, { life: 0.5 + Math.random() * 0.4, rise: 1.2 });
    }
    this.shake = 0.15;
  }

  /** While it lives: puffs at its feet, the contact check, the burst. Online: the flask's flight and burst. */
  private follow(dt: number) {
    const ctx = this.ctx;
    const u = this.unit;
    if (!u) {
      // No summon on this screen: the homunculus is a flask thrown at the enemy.
      const e = ctx?.targets[0];
      const k = (this.time - SPAWN_T) / THROW_SECONDS;
      const to = e ? this.v1.set(e.group.position.x, 1.0, e.group.position.z) : this.v1.copy(this.spot).addScaledVector(this.fwd, 6).setY(1);
      this.bomb.scale = 1.3;
      this.bomb.slosh(this.time, 1);
      this.bomb.lob(this.v2.copy(this.spot).setY(1.0), to, 2.6, k);
      if (k >= 1) this.explode(to, null);
      return;
    }
    if (!u.alive) return;
    // Little puffs where it walks.
    const moved = Math.hypot(u.pos.x - this.last.x, u.pos.z - this.last.z);
    this.last.copy(u.pos);
    if (moved > 1e-4) {
      this.stepClock += dt;
      if (this.stepClock >= 0.12) {
        this.stepClock = 0;
        this.bubbles.splash(this.v1.set(u.pos.x, 0.06, u.pos.z), 0.1);
      }
    }
    // Contact: an enemy within CONTACT. Everyone within BLAST is hit, the unit ends.
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - u.pos.x, p.z - u.pos.z) <= CONTACT) {
        this.explode(u.pos, u);
        return;
      }
    }
  }

  /** The burst: hits everyone close (all three reagents: the trait keys on slot 3) and plays the blast. */
  private explode(at: THREE.Vector3, u: SummonUnit | null) {
    if (this.done) return;
    this.done = true;
    const ctx = this.ctx;
    this.burstAt.set(at.x, 0, at.z);
    this.burstT = this.time;
    this.endAt = Math.min(this.endAt, this.time + TAIL);
    if (u) {
      u.left = 0;
      u.figure.group.visible = false; // the blast replaces its death puff
    }
    this.bomb.mesh.visible = false;
    this.v1.set(at.x, 1.0, at.z);
    for (let i = 0; i < 3; i++) this.shardSets[i].burst(this.v1, 8, 7.5 + i, { size: 0.28, life: 0.6, up: 2 + i });
    for (let i = 0; i < 8; i++) {
      this.v2.set(at.x + (Math.random() - 0.5) * 2, 0.2 + Math.random() * 1.2, at.z + (Math.random() - 0.5) * 2);
      this.bubbles.emit(this.v2, 0.08 + Math.random() * 0.1, { life: 0.5 + Math.random() * 0.4, rise: 1.5 });
    }
    this.shake = 0.8;
    if (!u || !ctx) return;
    let first = true;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - at.x, p.z - at.z) > BLAST) continue;
      // `projectile: true`: the touch was the dodge check. The reagents (the three reactions) are the trait's.
      ctx.hit(e, { damage: this.settings.damage, knock: 4, from: this.v1.set(at.x, 0, at.z).clone(), color: REAGENT[0].css, projectile: true });
      let kinds = takeReaction(ctx.caster);
      if (!kinds.length) kinds = previewReactions(this.settings.reaction);
      if (kinds.length && first) {
        first = false;
        this.reaction.trigger(kinds, p);
      }
    }
    // Tool preview: nobody in the blast, still show the chosen reaction where it went off.
    const pre = previewReactions(this.settings.reaction);
    if (first && pre.length) this.reaction.trigger(pre, at);
  }

  /** A harmless pop: shot down, or the unit could not be made. */
  private fizzle(at: THREE.Vector3) {
    if (this.done) return;
    this.done = true;
    this.burstAt.set(at.x, 0, at.z);
    this.burstT = -1;
    this.endAt = Math.min(this.endAt, this.time + 1.0);
    this.v1.set(at.x, 0.6, at.z);
    for (let i = 0; i < 3; i++) this.shardSets[i].burst(this.v1, 4, 4.5, { size: 0.2, life: 0.5 });
    for (let i = 0; i < 6; i++) {
      this.v2.set(at.x + (Math.random() - 0.5), 0.2 + Math.random() * 0.6, at.z + (Math.random() - 0.5));
      this.bubbles.emit(this.v2, 0.06 + Math.random() * 0.06, { life: 0.4 + Math.random() * 0.3, rise: 1.2 });
    }
    this.shake = 0.12;
  }

  private layout(dt: number) {
    const t = this.time;
    void dt;

    // --- 0..0.4 Pour: three vials fly one after another from her bandolier into the circle, which draws on. ---
    const reveal = smoothstep(t / 0.3);
    this.circle.reveal = reveal;
    this.circle.opacity = this.flags.spawned ? 1 - smoothstep((t - SPAWN_T - 0.5) / 0.7) : 1;
    this.circle.lit = Math.floor(reveal * 6);
    for (let i = 0; i < 3; i++) {
      const fl = this.vials[i];
      const u = (t - i * 0.06) / 0.28;
      if (u <= 0 || u >= 1) { fl.mesh.visible = false; continue; }
      fl.mesh.visible = true;
      fl.scale = 0.5 * smoothstep(u * 4);
      fl.slosh(t + i, 1);
      this.v1.copy(this.hand).addScaledVector(this.side, (i - 1) * 0.25);
      this.v2.copy(this.spot).setY(0.5);
      fl.lob(this.v1, this.v2, 1.2, u);
    }

    // --- The flare at the spawn: a green star. ---
    const fk = t - SPAWN_T;
    const fs = this.flags.flare ? StarBurst.pop(fk, 0.03, 0.12) : { scale: 0, opacity: 0 };
    this.flare.set(this.v1.set(this.spot.x, 0.9, this.spot.z), 1.8 * fs.scale, fs.opacity, 0.2);

    // --- The blast: three colour spheres a beat apart, a bright ground ring at the blast radius, a star, an impact frame. ---
    let imp: 0 | 1 | 2 | 3 | 4 = 0;
    if (this.burstT >= 0) {
      const a = t - this.burstT;
      imp = impactFrameAt(t, this.burstT, [1, 2], 0.04);
      this.balls.forEach((b, i) => {
        const local = (a - i * 0.05) / 0.4;
        b.visible = local > 0 && local < 1;
        b.position.set(this.burstAt.x + (i - 1) * 0.35, 1.0 + (i === 1 ? 0.3 : 0), this.burstAt.z);
        b.scale.setScalar(0.3 + (1.3 + i * 0.15) * (1 - Math.pow(1 - THREE.MathUtils.clamp(local * 2, 0, 1), 3)));
        (b.material as THREE.MeshBasicMaterial).opacity = 1 - THREE.MathUtils.clamp((local - 0.3) / 0.7, 0, 1);
      });
      const rk = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.blastRing.visible = a < 0.55;
      this.blastRing.position.set(this.burstAt.x, 0.08, this.burstAt.z);
      this.blastRing.scale.setScalar(Math.max(1e-3, BLAST * (1 - Math.pow(1 - rk, 3))));
      (this.blastRing.material as THREE.MeshBasicMaterial).opacity = 1 - THREE.MathUtils.clamp((a - 0.2) / 0.35, 0, 1);
      const sp = StarBurst.pop(a - 0.03, 0.02, 0.12);
      this.pop.set(this.v1.set(this.burstAt.x, 1.1, this.burstAt.z), 3.0 * sp.scale, sp.opacity, 0.2);
      this.groundShock.set(this.burstAt, 0.5 + 3.4 * rk, 0.06 * (1 - rk) * (1 - rk));
      this.shake = Math.max(0.8 * Math.exp(-a * 8), this.shake * 0.9);
    } else if (this.shake > 0) {
      this.shake *= 0.85;
    }
    this.screen.impact = imp !== 0 ? imp : this.reaction.impact;
    this.shake = Math.max(this.shake, this.reaction.shake);
  }
}

export const homunculusModule: EffectModule = {
  label: 'homunculus',
  category: 'hero: alchemy',
  // `enemies` (as Mandible Rend): every enemy, up to 10, is in `targets` (the hero and its units), so the burst can check
  // them by their live position. The AI casts a summon by its own rule (the enemy within about 10 m), not by this radius.
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new Homunculus(),
  // The burst is decided by touch (`projectile: true`), so there is no zone to show.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Homunculus;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Homunculus).settings;
    f.add(s, 'loop');
    f.add(s, 'reaction', [...REACTION_PREVIEW]);
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'hp', 10, 400, 10);
    f.add(s, 'speed', 1, 8, 0.5);
  },
};
