import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { stillSees } from '../../effects/channel';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BALLOON, BALLOON_CSS, Bubbles, PopWords, Scraps, buildPin } from '../../effects/parts/balloon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { KNOCK_PER_M, POP_BASE, POP_RANGE, POP_SHOVE, POP_WIND, AIR_MAX, airSeen } from '../../traits/balloon';

/**
 * Pop! (balloon kit v5, R: a targeted pin). A click on the enemy (9 m, sight checked by the engine at the cast) with a real 0.6 s wind-up:
 * Professor Puff draws a brass pin with a pink glass head, a red circle and a closing pale ring mark the enemy on both screens (they follow it),
 * and a star pulses over its head. The pin is thrown at 0.15 s and flies, turning to follow the enemy's live position, to land at 0.6 s.
 * At 0.6 s the spell checks itself: if `stillSees` the enemy is false, or the enemy is more than 11 m away, the pin clatters off (a few rubber
 * scraps, a puff, no hit). Otherwise the enemy POPS: one hit, `projectile: true`, judged on its live position, 50 (the trait adds 20 per Air it
 * carries and lets all the Air out in a fixed 3 m shove). The pop is a real snap, sized by the Air it let out (read from `airSeen`, the
 * swelling the trait draws): a spiky star, a refraction ring, a ring of puffs thrown out flat (the Air going), rubber scraps (10 to 30), the word
 * POP!, one short impact frame, a chromatic kick and a hard shake. Reach cover or break sight in the 0.6 s and it fizzles.
 *
 * Clean by 1.9 s. See pipeline/designs/kit-balloon.md.
 */
export interface PopPinSettings {
  /** Damage of the pin before the trait's 20 per Air. */
  damage: number;
  loop: boolean;
}

export const defaultPopPin = (): PopPinSettings => ({ damage: POP_BASE, loop: false });

// Timeline (seconds).
const THROW_T = 0.15;
const LAND_T = POP_WIND;
const DURATION = 1.9;
const MARK_R = 1.2;
const FIZZLE_REACH = POP_RANGE + 2;
const CHEST = 1.3;

export class PopPin implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PopPinSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private done = { thrown: false, landed: false };
  private fizzled = false;
  private air = 0;
  private trailT = 0;
  private fizzleAt = -1;

  private hand = new THREE.Vector3();
  private foe = new THREE.Vector3();
  private pinFrom = new THREE.Vector3();
  private pinPos = new THREE.Vector3();
  private popAt = new THREE.Vector3();

  private pin = buildPin();
  private bubbles = new Bubbles(90);
  private scraps = new Scraps(40);
  private words = new PopWords(2);
  private markStar = new StarBurst({ points: 6, inner: 0.25, color: BALLOON.body, core: 0xffffff, additive: false });
  private star = new StarBurst({ points: 14, inner: 0.26, color: BALLOON.body, core: 0xffffff, additive: false });
  private flare = new StarBurst({ points: 8, inner: 0.4, color: BALLOON.foil, core: 0xffffff, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shockUp = new ShockRefraction({ facing: 'camera' });
  private closing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: BALLOON.foil, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(settings: PopPinSettings = defaultPopPin()) {
    this.settings = settings;
    this.pin.visible = false;
    this.closing.renderOrder = 3;
    this.screen.impactColor.set(BALLOON.hot);
    this.screen.tint.set(BALLOON.dark);
    this.group.add(
      this.closing, this.pin, this.bubbles.mesh, this.scraps.mesh, this.words.mesh, this.markStar.mesh, this.star.mesh, this.flare.mesh, this.shock.mesh, this.shockUp.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    this.hand.set(ctx.from.x, 1.35, ctx.from.z);
    this.air = airSeen.get(ctx.caster) ?? 0;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    // The Air it carries when the pin is thrown sizes the pop (the trait writes it every frame).
    this.air = this.ctx ? airSeen.get(this.ctx.caster) ?? this.air : this.air;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.done.thrown = this.done.landed = false;
    this.fizzled = false;
    this.fizzleAt = -1;
    this.trailT = 0;
    this.pin.visible = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(BALLOON.hot);
    this.screen.tint.set(BALLOON.dark);
    this.bubbles.reset();
    this.scraps.reset();
    this.words.reset();
    this.markStar.set(this.foe, 1e-3, 0);
    this.star.set(this.foe, 1e-3, 0);
    this.flare.set(this.foe, 1e-3, 0);
    this.shock.set(this.foe, 0, 0);
    this.shockUp.set(this.foe, 0, 0);
    (this.closing.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bubbles.update(dt);
    this.scraps.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= (this.fizzled ? 1.4 : DURATION)) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, d = this.done;
    if (!d.landed) this.liveFoe();

    // --- The pin is drawn at his hand (a glint), then thrown. ---
    if (!d.thrown && t >= THROW_T) {
      d.thrown = true;
      this.pinFrom.copy(this.hand);
      this.pin.visible = true;
    }
    if (d.thrown && !d.landed && this.pin.visible) {
      const k = Math.min(1, (t - THROW_T) / (LAND_T - THROW_T)), u = k * k * (1.6 - 0.6 * k);
      this.v1.set(this.foe.x, CHEST, this.foe.z);
      this.pinPos.lerpVectors(this.pinFrom, this.v1, Math.min(1, u));
      this.pinPos.y += Math.sin(Math.PI * k) * 0.5;
      this.d.subVectors(this.v1, this.pinPos);
      if (this.d.lengthSq() > 1e-4) this.pin.lookAt(this.v2.copy(this.pinPos).add(this.d));
      this.pin.position.copy(this.pinPos);
      this.trailT += dt;
      if (this.trailT >= 0.04) {
        this.trailT = 0;
        this.v2.set((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6);
        this.bubbles.emit(this.pinPos, this.v2, 0.18, 0.4, 0.4, BALLOON.hot, 1, 2.5, 0);
      }
    }
    if (!d.thrown && t < THROW_T + 0.05 && Math.random() < 0.3) {
      this.bubbles.emit(this.hand, this.v1.set(0, 0.5, 0), 0.06, 0.14, 0.4, BALLOON.foil, 0, 1, 0.5);
    }

    // --- 0.6 The pin lands: the sight check, then the pop (or a clatter). ---
    if (!d.landed && t >= LAND_T) {
      d.landed = true;
      if (this.check()) this.fizzle();
      else this.pop();
    }

    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  /** True when the pin lands without sight of the enemy, or with it more than 11 m away. */
  private check() {
    const ctx = this.ctx;
    if (!ctx || !this.target) return false;
    const from = ctx.caster.group.position, p = this.target.group.position;
    return !stillSees(ctx, p) || Math.hypot(p.x - from.x, p.z - from.z) > FIZZLE_REACH;
  }

  /** The pin clatters off: a few scraps and a puff, no hit. */
  private fizzle() {
    this.fizzled = true;
    this.fizzleAt = this.time;
    this.pin.visible = false;
    this.v1.set(this.pinPos.x, 0.5, this.pinPos.z);
    this.scraps.burst(this.v1, 5, 3.5, 0.2);
    this.bubbles.ring(this.v1, 5, 2.5, 0.5, 0.6, BALLOON.hot, 1);
    this.words.show('PFFT', this.v1.set(this.pinPos.x, 1.8, this.pinPos.z), 0.8, 0.8);
    this.shake = 0.06;
  }

  /** The pop: the hit, then the snap sized by the Air that was in it. */
  private pop() {
    const ctx = this.ctx;
    const e = this.target;
    this.pin.visible = false;
    this.popAt.set(this.foe.x, CHEST, this.foe.z);
    // The Air now, before the hit lets it out: the pop's size matches the damage the trait adds.
    if (ctx) this.air = airSeen.get(ctx.caster) ?? this.air;
    if (ctx && e) {
      // `projectile: true`: judged by the live position, so the enemy cannot walk out of it now.
      ctx.hit(e, {
        damage: this.settings.damage, knock: POP_SHOVE * KNOCK_PER_M, from: ctx.caster.group.position.clone(), color: BALLOON_CSS.body, projectile: true,
      });
    }
    const r = Math.min(1, this.air / AIR_MAX);
    // Rubber scraps (10 to 30), a flat ring of puffs (the Air going out), soap bubbles, and the word.
    this.scraps.burst(this.popAt, Math.round(10 + 20 * r), 7 + 3 * r, 0.32, [BALLOON.body, BALLOON.body, BALLOON.shade, BALLOON.hot, BALLOON.foil]);
    this.bubbles.ring(this.popAt, 12, 8 + 3 * r, 1.0 + 0.6 * r, 0.8, BALLOON.hot, 1);
    this.bubbles.ring(this.popAt, 10, 5, 0.5, 1.0, BALLOON.hot, 0);
    this.v1.set(this.foe.x, 2.9 + 0.5 * r, this.foe.z);
    this.words.show('POP!', this.v1, 1.6 + 0.8 * r, 1.2);
    this.shake = 0.5 + 0.2 * r;
  }

  private layout(t: number) {
    const d = this.done;
    // --- The mark on the enemy: a ring that closes in and a pink star over its head, both following it. ---
    const cm = this.closing.material as THREE.MeshBasicMaterial;
    if (t < LAND_T && !d.landed) {
      const mp = smoothstep(t / 0.15), k = t / LAND_T;
      const pulse = 0.5 + 0.5 * Math.sin(t * 20);
      this.closing.position.set(this.foe.x, 0.07, this.foe.z);
      this.closing.scale.setScalar(Math.max(0.05, MARK_R * (1.5 - 0.5 * k)));
      cm.opacity = 0.9 * mp;
      this.v1.copy(this.foe).setY(2.7);
      this.markStar.set(this.v1, (0.6 + 0.25 * pulse) * mp + 1e-3, 0.95 * mp, t * 4);
    } else {
      cm.opacity = 0;
      this.markStar.set(this.foe, 1e-3, 0);
    }
    if (!d.landed || this.fizzled) {
      this.screen.darken = 0.25 * smoothstep(t / LAND_T);
      if (this.fizzled) this.screen.darken *= 1 - smoothstep((t - this.fizzleAt) / 0.3);
      return;
    }
    // --- After the pop: impact frame, chroma kick, the star, the flare, the rings. ---
    const a = t - LAND_T, r = Math.min(1, this.air / AIR_MAX);
    this.screen.impact = impactFrameAt(t, LAND_T, [1], 0.045);
    this.screen.chroma = chromaPulse(t, LAND_T, 0.5, 6);
    this.screen.darken = 0.25 * (1 - smoothstep(a / 0.35));
    this.screen.edgeTint.set(BALLOON.body);
    const sp = StarBurst.pop(a, 0.05, 0.2);
    this.star.set(this.popAt, (2.6 + 2 * r) * sp.scale + 1e-3, sp.opacity, a * 3);
    const fp = StarBurst.pop(a - 0.03, 0.02, 0.25);
    this.flare.set(this.popAt, (3.6 + 2.4 * r) * fp.scale + 1e-3, fp.opacity * 0.9, 0.5 - a);
    const g = smoothstep(a / 0.45);
    this.shock.set(this.v1.set(this.foe.x, 0, this.foe.z), 0.6 + (3.2 + 1.8 * r) * g, 0.06 * (1 - g) * (1 - g));
    this.shockUp.set(this.popAt, 0.4 + (2.2 + 1.2 * r) * g, 0.045 * (1 - g) * (1 - g));
  }
}

export const popPinModule: EffectModule = {
  label: 'pop!',
  category: 'hero: balloon',
  // Click an enemy: one hit that always lands (`projectile`) once the 0.6 s wind-up holds; the wind-up is the warning.
  targeting: { mode: 'enemy' },
  create: () => new PopPin(),
  telegraphs(effect) {
    const e = effect as PopPin;
    if (!e.ctx) return [];
    // The mark on the enemy for the wind-up, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as PopPin;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PopPin).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
