import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { GroundSign, REFEREE, REFEREE_CSS, SoundRings, buildWhistle, type SignKind } from '../../effects/parts/referee';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { RULE_DELAY, RULE_RANGE } from '../../traits/referee';

/**
 * No Running (referee kit, W: a rule). No target and no damage. Whistler draws the whistle up to his lips (0.2 s) and blows: a
 * fat pale ring of sound rushes out along the floor to 7 m (`RULE_RANGE`) with a dark one behind it and a thin echo after that. At
 * 0.5 s (`RULE_DELAY`) every enemy hero inside the 7 m, whom he still sees (`stillSees`: cover saves them, as for his other
 * sight spells), takes a hit of damage 1 that the trait (`dealt`, slot 1) turns into the rule NO RUNNING for 3 s, no dashes, blinks
 * or leaps. A prohibition sign (a runner crossed out in red) stamps down under each of them and fades. The words over their head
 * are the trait's (`enemyLabel`). Nothing is blocked: a dash taken anyway is a yellow card. Clean by about 2.1 s.
 *
 * `RuleWhistle` is the whole effect, shared with No Casting (`noCasting.ts`): only the sign and the numbers differ. Telegraph: the
 * 7 m circle round him, which ends at the blast (a rule is not a dodge: the answer is to walk). See pipeline/designs/kit-referee.md.
 */
export interface NoRunningSettings {
  /** The hit the trait replaces: it only has to exist. */
  damage: number;
  loop: boolean;
}

export const defaultNoRunning = (): NoRunningSettings => ({ damage: 1, loop: false });

// Timeline (seconds).
const BLOW_T = 0.2;
const SIGN_T = RULE_DELAY;
const SIGN_LIFE = 1.3;
const DURATION = 2.1;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** A whistle blown for a rule: the effect behind No Running and No Casting. */
export class RuleWhistle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NoRunningSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  centre = new THREE.Vector3();
  private time = 0;
  private blown = false;
  private struck = false;
  private yaw = 0;
  private mouth = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private signAt: { x: number; z: number; born: number }[] = [];

  private whistle = buildWhistle();
  private rings = new SoundRings(10);
  private signs: GroundSign[] = [];
  private stars: StarBurst[] = [];
  private starAt: THREE.Vector3[] = [];
  private starAge: number[] = [];

  constructor(kind: SignKind, settings: NoRunningSettings = defaultNoRunning()) {
    this.settings = settings;
    this.group.add(this.whistle, this.rings.group);
    for (let i = 0; i < 2; i++) {
      const sign = new GroundSign(kind, 2.6);
      const star = new StarBurst({ points: 8, inner: 0.32, color: REFEREE.white, core: REFEREE.pale, additive: false });
      this.signs.push(sign);
      this.stars.push(star);
      this.starAt.push(new THREE.Vector3());
      this.starAge.push(9);
      this.group.add(sign.mesh, star.mesh);
    }
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SIGN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens agree on the circle: it is round his place when he cast.
    const s = ctx.sentFrom ?? ctx.from;
    this.centre.set(s.x, 0, s.z);
    this.yaw = ctx.aim;
    const fx = Math.sin(ctx.aim), fz = Math.cos(ctx.aim);
    this.mouth.set(ctx.from.x + fx * 0.4, 1.62, ctx.from.z + fz * 0.4);
    this.hand.set(this.mouth.x - fx * 0.5 + fz * 0.35, 1.0, this.mouth.z - fz * 0.5 - fx * 0.35);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.blown = false;
    this.struck = false;
    this.signAt.length = 0;
    this.whistle.visible = false;
    this.rings.reset();
    for (let i = 0; i < this.signs.length; i++) {
      this.signs[i].set(0, 0, 0);
      this.starAge[i] = 9;
      this.stars[i].set(this.starAt[i], 0, 0);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, c = this.centre;
    if (t >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      this.reset();
      return;
    }

    // --- The whistle rises from his hand to his lips. ---
    if (t < BLOW_T + 0.3) {
      const k = easeOut(t / BLOW_T);
      this.whistle.visible = true;
      this.whistle.position.set(this.hand.x + (this.mouth.x - this.hand.x) * k, 1.0 + 0.62 * k, this.hand.z + (this.mouth.z - this.hand.z) * k);
      this.whistle.rotation.set(0, this.yaw - Math.PI / 2, 0);
      this.whistle.scale.setScalar(1.5);
    } else this.whistle.visible = false;

    // --- 0.2 The blast: a fat ring rushes out along the floor, a dark one behind it, an echo after. ---
    if (!this.blown && t >= BLOW_T) {
      this.blown = true;
      this.shake = 0.08;
      this.rings.fire({ x: c.x, y: 0.1, z: c.z, r0: 0.6, r1: RULE_RANGE, life: SIGN_T - BLOW_T, yaw: null, opacity: 0.9, thick: 2 });
      this.rings.fire({ x: c.x, y: 0.08, z: c.z, r0: 0.3, r1: RULE_RANGE - 0.4, life: SIGN_T - BLOW_T + 0.08, yaw: null, color: REFEREE.foil, opacity: 0.8, thick: 2 });
      this.rings.fire({ x: c.x, y: 0.12, z: c.z, r0: 0.4, r1: RULE_RANGE + 0.5, life: 0.5, yaw: null, opacity: 0.55, thick: 0 });
      this.rings.fire({ x: this.mouth.x, y: this.mouth.y, z: this.mouth.z, r0: 0.3, r1: 1.4, life: 0.3, yaw: this.yaw, opacity: 0.7, thick: 1 });
    }

    // --- 0.5 The rule lands: who is inside now, and seen, is hit (the trait makes it the rule). ---
    if (!this.struck && t >= SIGN_T) {
      this.struck = true;
      this.strike(ctx);
    }

    // The signs stamp down (a big bounce in, then still) and fade; a star pops at each.
    for (let i = 0; i < this.signs.length; i++) {
      const s = this.signAt[i];
      if (!s) continue;
      const a = t - s.born;
      const bounce = a < 0.18 ? 2.2 - 1.2 * easeOut(a / 0.18) : 1;
      const op = 0.95 * Math.min(1, a / 0.05) * (1 - smoothstep((a - SIGN_LIFE + 0.4) / 0.4));
      this.signs[i].set(s.x, s.z, a >= 0 && a < SIGN_LIFE ? op : 0, bounce);
      this.starAge[i] += dt;
      const sp = StarBurst.pop(this.starAge[i], 0.05, 0.16);
      this.stars[i].set(this.starAt[i], 1.3 * sp.scale, sp.opacity, this.starAge[i] * 4);
    }
    this.shake *= Math.exp(-dt * 12);
  }

  private strike(ctx: CastContext | null) {
    if (!ctx) return;
    const c = this.centre;
    const list = ctx.enemies?.() ?? ctx.targets;
    for (const e of list) {
      const q = e.group.position;
      if (Math.hypot(q.x - c.x, q.z - c.z) > RULE_RANGE) continue;
      // Cover saves them: the rule needs Whistler to see them when the whistle lands.
      if (!stillSees(ctx, q)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 0, from: c, color: REFEREE_CSS.accent });
      const i = this.signAt.length;
      if (i >= this.signs.length) continue;
      this.signAt.push({ x: q.x, z: q.z, born: this.time });
      this.starAt[i].set(q.x, 1.4, q.z);
      this.starAge[i] = 0;
      this.shake = 0.12;
    }
  }
}

export const noRunningModule: EffectModule = {
  label: 'no running',
  category: 'hero: referee',
  // A rule is a ring round him: the enemies inside it are the targets.
  targeting: { mode: 'self', radius: RULE_RANGE },
  create: () => new RuleWhistle('run'),
  telegraphs(effect) {
    const e = effect as RuleWhistle;
    if (!e.ctx) return [];
    const spec: TelegraphSpec = { shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: RULE_RANGE }, start: 0, impact: RULE_DELAY };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as RuleWhistle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RuleWhistle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 20, 1);
  },
};
