import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ALCHEMY, Bubbles, Flames, Flask, GlassShards, REACTION_PREVIEW, REAGENT, ReactionBurst, previewReactions, type ReactionPreview } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Enemy } from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';
import { takeReaction } from '../../traits/alchemy';

/**
 * Fire Vial (alchemy kit, W: a targeted hit that cannot miss, 7 m, reagent orange). She uncorks a vial of orange fire
 * (it flares in her hand), flicks it in a short high arc that follows the enemy's live position, and it bursts on them:
 * a fireball flash, glass chips, an impact frame and a camera shake, 25 at once. Then the enemy burns for 2 s: flame
 * tongues stand on them and five ticks of 5 follow (`ctx.hit` with `projectile: true`: a sure hit, no zone). When the hit
 * sets off a reaction the effect reads it (`takeReaction`, written by the trait inside `ctx.hit`) and plays that burst.
 * With no one to hit it bursts on the aimed spot. See pipeline/designs/kit-alchemy.md.
 */
export interface FireVialSettings {
  damage: number;
  /** Damage of each burn tick (five of them, 0.4 s apart). */
  tick: number;
  loop: boolean;
  /** Tool preview only: plays this reaction burst when no reaction was set off (no trait runs there). */
  reaction: ReactionPreview;
}

export const defaultFireVial = (): FireVialSettings => ({ damage: 30, tick: 6, loop: false, reaction: 'none' });

// Timeline (seconds).
const FLARE_T = 0.2; // the vial flares in her hand
const THROW_T = 0.32;
const HIT_T = 0.72; // it lands
const TICKS = 5;
const TICK_EVERY = 0.4;
const BURN_END = HIT_T + TICKS * TICK_EVERY + 0.2;
const DURATION = BURN_END + 0.7;
const VIAL_SCALE = 0.7;

export class FireVial implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FireVialSettings;
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
  private hand = new THREE.Vector3(0, 1.4, 13);
  private spot = new THREE.Vector3(0, 0, -6); // the aimed spot, used when there is nothing to follow
  private victim: Enemy | null = null;
  private at = new THREE.Vector3(); // where it burst (feet)
  private flags = { flare: false, burst: false, drain: false };
  private nextTick = 0;
  private trailTimer = 0;

  // Parts.
  private flask = new Flask(REAGENT[1]);
  private shards = new GlassShards({ max: 40, color: REAGENT[1].body, edge: ALCHEMY.core, opacity: 0.95 });
  private bubbles = new Bubbles(24);
  private flames = new Flames(7);
  private fireball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: REAGENT[1].body, transparent: true, depthWrite: false }));
  private fireCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: REAGENT[1].hot, transparent: true, depthWrite: false }));
  private flare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: REAGENT[1].hot, core: ALCHEMY.core, additive: false });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: REAGENT[1].hot, core: ALCHEMY.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private reaction = new ReactionBurst();

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: FireVialSettings = defaultFireVial()) {
    this.settings = settings;
    this.screen.tint.set(0x1a0a02);
    this.screen.impactColor.set(REAGENT[1].hot);
    this.bubbles.tint(REAGENT[1]);
    this.group.add(
      this.shards.mesh, this.bubbles.mesh, this.flames.mesh, this.fireball, this.fireCore, this.flask.mesh, this.flare.mesh,
      this.pop.mesh, this.groundShock.mesh, this.reaction.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.35).setY(1.4);
    this.spot.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.nextTick = 0;
    this.trailTimer = 0;
    this.victim = null;
    this.at.copy(this.spot);
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.flask.reset();
    this.shards.reset();
    this.bubbles.reset();
    this.flames.reset();
    this.reaction.reset();
    this.fireball.visible = this.fireCore.visible = false;
    this.flare.set(this.hand, 0, 0);
    this.pop.set(this.spot, 0, 0);
    this.groundShock.set(this.spot, 0, 0);
  }

  /** Where the vial is headed now: the enemy's live chest while it flies, else the aimed spot. */
  private goal(out: THREE.Vector3) {
    const e = this.ctx?.targets[0];
    if (e && !this.flags.burst) return out.set(e.group.position.x, 1.1, e.group.position.z);
    return out.set(this.at.x, 1.1, this.at.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.reaction.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
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

    if (!f.flare && t >= FLARE_T) {
      f.flare = true;
      this.bubbles.emit(this.v1.copy(this.hand), 0.07, { life: 0.5, rise: 1.4 });
    }
    // The vial lands where the enemy stands now: a sure hit (`projectile: true` skips the duel's zone check).
    if (!f.burst && t >= HIT_T) {
      f.burst = true;
      const e = ctx?.targets[0] ?? null;
      this.victim = e;
      if (e) this.at.set(e.group.position.x, 0, e.group.position.z);
      else this.at.copy(this.spot);
      this.flask.mesh.visible = false;
      this.burst();
      if (ctx && e) {
        ctx.hit(e, { damage: this.settings.damage, knock: 0, from: ctx.from, color: REAGENT[1].css, projectile: true });
        let kinds = takeReaction(ctx.caster);
        if (!kinds.length) kinds = previewReactions(this.settings.reaction);
        if (kinds.length) this.reaction.trigger(kinds, e.group.position);
        this.nextTick = HIT_T + TICK_EVERY;
      }
    }
    // Five burn ticks while the flames stand on them (live position).
    if (f.burst && this.victim && this.nextTick > 0) {
      while (this.time >= this.nextTick && this.nextTick < HIT_T + TICKS * TICK_EVERY + 0.01) {
        this.nextTick += TICK_EVERY;
        ctx?.hit(this.victim, { damage: this.settings.tick, knock: 0, from: ctx.from, color: REAGENT[1].css, projectile: true });
        this.v1.set(this.victim.group.position.x, 1.3, this.victim.group.position.z);
        this.bubbles.splash(this.v1, 0.2);
        this.shake = Math.max(this.shake, 0.05);
      }
    }
    this.layout(dt);
  }

  /** The vial shatters: glass chips and sparks, the fireball (drawn in `layout`). */
  private burst() {
    this.v1.set(this.at.x, 1.1, this.at.z);
    this.shards.burst(this.v1, 12, 7.5, { size: 0.26, life: 0.55 });
    for (let i = 0; i < 6; i++) {
      this.v2.set(this.at.x + (Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.2, this.at.z + (Math.random() - 0.5) * 0.8);
      this.bubbles.emit(this.v2, 0.06 + Math.random() * 0.06, { life: 0.4 + Math.random() * 0.4, rise: 1.4 });
    }
    this.shake = 0.3;
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;
    const fl = this.flask;

    // --- 0..0.32 Uncork: the vial rises into her hand, a gold-orange glint flares on the cork at 0.2. ---
    // --- 0.32..0.72 Lob: a short high arc to the enemy's live position, a spark trail. ---
    if (t < HIT_T) {
      fl.mesh.visible = true;
      fl.scale = VIAL_SCALE * smoothstep(t / 0.14);
      fl.slosh(t, 1.3);
      if (t < THROW_T) {
        fl.mesh.position.copy(this.hand);
        fl.mesh.position.y += 0.08 * Math.sin(t * 24);
        fl.mesh.rotation.set(0, 0, Math.sin(t * 22) * 0.12);
      } else {
        fl.lob(this.hand, this.goal(this.v3), 2.4, (t - THROW_T) / (HIT_T - THROW_T));
        this.trailTimer += dt;
        while (this.trailTimer >= 0.03) {
          this.trailTimer -= 0.03;
          this.bubbles.emit(fl.mesh.position, 0.05 + Math.random() * 0.04, { life: 0.3, rise: 1.2 });
        }
      }
    }
    const fk = t - FLARE_T;
    const fs = fk >= 0 && fk < 0.2 ? StarBurst.pop(fk, 0.05, 0.1) : { scale: 0, opacity: 0 };
    this.v1.copy(this.hand).setY(this.hand.y + 0.35);
    this.flare.set(this.v1, 1.0 * fs.scale, fs.opacity, 0.2);

    // --- The burst: fireball flash with a gold core, spiked star, ground ring, an impact frame, shake. ---
    const after = t - HIT_T;
    let imp: 0 | 1 | 2 | 3 | 4 = 0;
    if (f.burst) {
      imp = impactFrameAt(t, HIT_T, [1], 0.03);
      const grow = THREE.MathUtils.clamp(after / 0.2, 0, 1), fade = 1 - THREE.MathUtils.clamp((after - 0.1) / 0.35, 0, 1);
      this.fireball.visible = this.fireCore.visible = fade > 0.01;
      this.fireball.position.set(this.at.x, 1.1, this.at.z);
      this.fireCore.position.copy(this.fireball.position);
      this.fireball.scale.setScalar(0.3 + 1.1 * (1 - Math.pow(1 - grow, 3)));
      this.fireCore.scale.setScalar(Math.max(1e-3, (0.2 + 0.6 * grow) * (1 - THREE.MathUtils.clamp((after - 0.04) / 0.2, 0, 1))));
      (this.fireball.material as THREE.MeshBasicMaterial).opacity = fade;
      (this.fireCore.material as THREE.MeshBasicMaterial).opacity = fade;
      const sp = StarBurst.pop(after - 0.02, 0.0, 0.015);
      this.pop.set(this.v1.set(this.at.x, 1.1, this.at.z), 1.6 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.v2.set(this.at.x, 0, this.at.z), 0.4 + 2.6 * gp, 0.035 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.3 * Math.exp(-after * 14));
      // The flames stand on the burning body until the last tick, then die down.
      if (this.victim) {
        const on = smoothstep(after / 0.15) * (1 - smoothstep((after - (BURN_END - HIT_T)) / 0.3));
        this.v2.set(this.victim.group.position.x, 0, this.victim.group.position.z);
        this.flames.set(this.v2, on, dt);
      }
    }
    this.screen.impact = imp !== 0 ? imp : this.reaction.impact;
    this.shake = Math.max(this.shake, this.reaction.shake);
  }
}

export const fireVialModule: EffectModule = {
  label: 'fire vial',
  category: 'hero: alchemy',
  // A targeted spell: it flies to the picked enemy (else the nearest) and always hits; no ground zone.
  targeting: { mode: 'enemy' },
  create: () => new FireVial(),
  // A sure hit: nothing to dodge, so nothing to draw (the hit carries `projectile: true`).
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FireVial;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as FireVial).settings;
    f.add(s, 'loop');
    f.add(s, 'reaction', [...REACTION_PREVIEW]);
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'tick', 1, 30, 1);
  },
};
