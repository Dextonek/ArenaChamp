import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ALCHEMY, AcidPool, Bubbles, Droplets, Flask, GlassShards, REACTION_PREVIEW, REAGENT, ReactionBurst, previewReactions, type ReactionPreview } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { takeReaction } from '../../traits/alchemy';

/**
 * Acid Splash (alchemy kit, E: a 4 m cone in front of her, reagent violet; her answer to being rushed). She hauls a flask of
 * violet acid up in front of her chest (it shakes and swells while the cone fills on the ground), then smashes it: the
 * flask bursts in a fan of acid, a spray of droplets arcs out across the cone, a violet ring rolls out of her feet and
 * everyone inside the cone (live positions, at the smash) takes 30 and a shove of about 1.5 m. The acid lies in a
 * bubbling violet puddle for a moment, then drains. When the hit sets off a reaction the effect reads it (`takeReaction`)
 * and plays that burst. The targeting is `self` with radius 4: the duel AI casts it when the enemy is within 3.4 m.
 * See pipeline/designs/kit-alchemy.md.
 */
export interface AcidSplashSettings {
  damage: number;
  /** Knock-back speed (the foe slides knock / 7 m; the player is capped at about 1.4 m). */
  knock: number;
  loop: boolean;
  /** Tool preview only: plays this reaction burst when no reaction was set off (no trait runs there). */
  reaction: ReactionPreview;
}

export const defaultAcidSplash = (): AcidSplashSettings => ({ damage: 40, knock: 10, loop: false, reaction: 'none' });

// Timeline (seconds).
const RAISE_T = 0.1; // the flask comes up
const GLINT_T = 0.26;
const HIT_T = 0.42; // the smash
const DRAIN_T = 1.5;
const DURATION = 2.1;
const RANGE = 4; // the cone's length: the kit's reach (the self radius is the same)
const SELF_RADIUS = 4.5; // the duel AI casts it when the enemy is within this minus 0.6 (3.9 m)
const ANGLE = 100; // degrees, the cone's full width
const FLASK_SCALE = 0.85;

export class AcidSplash implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AcidSplashSettings;
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
  private hold = new THREE.Vector3(0, 1.3, 13);
  private smash = new THREE.Vector3(0, 1.3, 12);
  private mid = new THREE.Vector3(0, 0, 11);
  private yaw = 0;
  private flags = { glint: false, hit: false, drain: false };
  private struck = false;
  private hitAt = new THREE.Vector3();

  // Parts.
  private flask = new Flask(REAGENT[2]);
  private shards = new GlassShards({ max: 40, color: REAGENT[2].body, edge: ALCHEMY.core, opacity: 0.95 });
  private pool = new AcidPool(28);
  private bubbles = new Bubbles(24);
  private drops = new Droplets(28);
  private fan: THREE.Mesh;
  private fanEdge: THREE.Mesh;
  private glint = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: REAGENT[2].hot, core: ALCHEMY.core, additive: false });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: REAGENT[2].hot, core: ALCHEMY.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private reaction = new ReactionBurst();

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: AcidSplashSettings = defaultAcidSplash()) {
    this.settings = settings;
    this.screen.tint.set(0x14081f);
    this.screen.impactColor.set(REAGENT[2].hot);
    this.pool.tint(REAGENT[2]);
    this.pool.boil = 6;
    this.pool.bubbleSize = 0.24;
    this.bubbles.tint(REAGENT[2]);
    this.drops.tint(REAGENT[2]);
    // The spray fan: a flat sector of violet on the floor, and its bright outer edge.
    const half = THREE.MathUtils.degToRad(ANGLE) / 2;
    const sector = new THREE.CircleGeometry(1, 28, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
    this.fan = new THREE.Mesh(sector, new THREE.MeshBasicMaterial({ color: REAGENT[2].body, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const arc = new THREE.RingGeometry(0.94, 1, 28, 1, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
    this.fanEdge = new THREE.Mesh(arc, new THREE.MeshBasicMaterial({ color: REAGENT[2].hot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.fan.position.y = 0.05;
    this.fanEdge.position.y = 0.06;
    this.drops.onLand = (p) => {
      this.bubbles.splash(this.v2.set(p.x, 0.08, p.z), 0.14);
      this.pool.bubbleAt(p.x, p.z, 0.1 + Math.random() * 0.1, 0.5 + Math.random() * 0.5);
    };
    this.group.add(
      this.pool.mesh, this.fan, this.fanEdge, this.drops.mesh, this.shards.mesh, this.bubbles.mesh, this.flask.mesh, this.glint.mesh,
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
    this.from.copy(ctx.from).setY(0);
    this.yaw = ctx.aim;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hold.copy(this.from).addScaledVector(this.fwd, 0.45).addScaledVector(this.side, 0.15).setY(1.25);
    this.smash.copy(this.from).addScaledVector(this.fwd, 1.1).setY(1.2);
    this.mid.copy(this.from).addScaledVector(this.fwd, RANGE * 0.55).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.smash);
    this.fan.position.set(this.from.x, 0.05, this.from.z);
    this.fanEdge.position.set(this.from.x, 0.06, this.from.z);
    this.fan.rotation.y = this.fanEdge.rotation.y = ctx.aim + Math.PI;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.struck = false;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.flask.reset();
    this.shards.reset();
    this.pool.reset();
    this.bubbles.reset();
    this.drops.reset();
    this.reaction.reset();
    this.fan.visible = this.fanEdge.visible = false;
    this.glint.set(this.hold, 0, 0);
    this.pop.set(this.smash, 0, 0);
    this.groundShock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.reaction.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.pool.update(dt);
    this.bubbles.update(dt);
    this.drops.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.glint && t >= GLINT_T) {
      f.glint = true;
      this.bubbles.emit(this.v1.copy(this.hold), 0.07, { life: 0.5, rise: 1.4 });
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.smashFlask();
    }
    if (!f.drain && t >= DRAIN_T) {
      f.drain = true;
      this.pool.drain(0.5);
    }
    this.layout();
  }

  /** The flask bursts: acid spray over the cone, the hit on everyone inside it. */
  private smashFlask() {
    const ctx = this.ctx;
    this.flask.mesh.visible = false;
    this.shards.burst(this.smash, 12, 7, { size: 0.26, life: 0.55 });
    // The pool lies in the middle of the cone.
    this.pool.spread(this.mid, 1.7, 0.2);
    // Droplets arc out over the whole fan.
    const half = THREE.MathUtils.degToRad(ANGLE) / 2;
    for (let i = 0; i < 20; i++) {
      const a = this.yaw + (Math.random() * 2 - 1) * half * 0.95;
      const d = 1.2 + Math.random() * (RANGE - 1.3);
      this.v1.set(this.from.x + Math.sin(a) * d, 0.05, this.from.z + Math.cos(a) * d);
      this.drops.fire(this.smash, this.v1, 0.22 + d * 0.06, 0.07 + Math.random() * 0.06, Math.random() * 0.06);
    }
    this.shake = 0.3;
    if (!ctx) return;
    // Everyone inside the cone right now (live positions).
    for (const e of ctx.targets) {
      const p = e.group.position;
      const dx = p.x - this.from.x, dz = p.z - this.from.z;
      if (Math.hypot(dx, dz) > RANGE) continue;
      let diff = Math.atan2(dx, dz) - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > half) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: ctx.from, color: REAGENT[2].css });
      this.struck = true;
      this.hitAt.set(p.x, 1.1, p.z);
      this.shards.burst(this.hitAt, 6, 4.5, { size: 0.2, life: 0.45 });
      let kinds = takeReaction(ctx.caster);
        if (!kinds.length) kinds = previewReactions(this.settings.reaction);
      if (kinds.length) this.reaction.trigger(kinds, p);
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const fl = this.flask;

    // --- 0..0.42 Raise: the flask comes up in front of her chest, swelling, shaking harder as the smash nears. ---
    if (t < HIT_T) {
      const k = smoothstep((t - RAISE_T + 0.1) / 0.22);
      fl.mesh.visible = true;
      fl.scale = FLASK_SCALE * k;
      fl.slosh(t, 1.6);
      fl.mesh.position.copy(this.hold);
      fl.mesh.position.y -= 0.35 * (1 - k);
      const tremble = smoothstep((t - GLINT_T) / (HIT_T - GLINT_T));
      fl.mesh.position.x += Math.sin(t * 60) * 0.02 * tremble;
      fl.mesh.position.z += Math.cos(t * 53) * 0.02 * tremble;
      fl.mesh.rotation.set(0, 0, Math.sin(t * 22) * 0.12 * (1 + tremble));
    }
    const gk = t - GLINT_T;
    const gs = gk >= 0 && gk < 0.18 ? StarBurst.pop(gk, 0.04, 0.1) : { scale: 0, opacity: 0 };
    this.v1.copy(this.hold).setY(this.hold.y + 0.45);
    this.glint.set(this.v1, 0.9 * gs.scale, gs.opacity, 0.2);

    // --- The smash: the fan of acid shoots out across the cone, a ring rolls out of her feet, an impact frame, shake. ---
    const after = t - HIT_T;
    let imp: 0 | 1 | 2 | 3 | 4 = 0;
    if (f.hit) {
      if (this.struck) imp = impactFrameAt(t, HIT_T, [1], 0.03);
      const grow = 1 - Math.pow(1 - THREE.MathUtils.clamp(after / 0.16, 0, 1), 3);
      const fade = 1 - THREE.MathUtils.clamp((after - 0.12) / 0.5, 0, 1);
      this.fan.visible = this.fanEdge.visible = fade > 0.01;
      this.fan.scale.setScalar(Math.max(1e-3, RANGE * grow));
      this.fanEdge.scale.setScalar(Math.max(1e-3, RANGE * grow));
      (this.fan.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
      (this.fanEdge.material as THREE.MeshBasicMaterial).opacity = fade;
      const sp = StarBurst.pop(after - 0.01, 0.01, 0.1);
      this.pop.set(this.smash, 1.8 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.groundShock.set(this.from, 0.5 + 3.8 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 12);
    }
    this.screen.impact = imp !== 0 ? imp : this.reaction.impact;
    this.shake = Math.max(this.shake, this.reaction.shake);
  }
}

export const acidSplashModule: EffectModule = {
  label: 'acid splash',
  category: 'hero: alchemy',
  // Around her: the duel AI casts it when the enemy is within radius - 0.6 (3.4 m). The cone itself reaches RANGE.
  targeting: { mode: 'self', radius: SELF_RADIUS },
  create: () => new AcidSplash(),
  telegraphs(effect) {
    const e = effect as AcidSplash;
    const ctx = e.ctx;
    if (!ctx) return [];
    // Live from the first frame so a target that leaves before the smash is not hit; it counts only while it is inside.
    return [{ shape: { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: RANGE, angle: ANGLE, dir: ctx.aim }, start: 0, impact: HIT_T, until: HIT_T + 0.2 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as AcidSplash;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as AcidSplash).settings;
    f.add(s, 'loop');
    f.add(s, 'reaction', [...REACTION_PREVIEW]);
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'knock', 0, 30, 1);
  },
};
