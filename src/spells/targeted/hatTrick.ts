import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { HIDDEN_LOOK, Hats, MAGIC, MAGIC_CSS, Pieces, rabbitLook } from '../../effects/parts/magic';
import { SmokeBall } from '../../effects/parts/smokeBall';
import type { Summon, SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  HAT_HP, HAT_RING, HAT_TIME, RABBIT_DAMAGE, RABBIT_HP, RABBIT_LIFE, RABBIT_SPEED, bookOf, shuffleOf, type HatAct,
} from '../../traits/magic';

/**
 * The Hat Trick (magic kit, E: which hat?). A puff of purple smoke at his feet and three top hats pop up round him (1.1 m out, a triangle).
 * He is gone: he is not drawn and is sealed (the trait, src/traits/magic.ts) for 1.5 s, and the hats shuffle. At 0.15 s three swaps
 * begin, 0.42 s each: two hats trade places along two half-circles round the midpoint of their spots (one over the front, one behind), each
 * hopping a little, so a watcher can follow them (about 7 m/s at the fastest). Which two swap, and which hat is his, come from a value both
 * screens share (`bookOf(caster).key`: made on his own client from the round time and a counter and sent with the cast, never
 * `Math.random`); the other screen technically knows it, and hats stand at known spots on both screens. At 1.5 s he steps out of his hat
 * (his own client moves him there with `ctx.moveCaster`, 0.05 s, just before): smoke, a ring, a star, confetti, and the white rabbit
 * (Ta-da!: `ctx.summon` melee, 20 HP, 8 damage, `rabbitLook`) runs at the enemy.
 *
 * Each hat is a real unit (`ctx.summon`: a 'turret' of 1 HP, damage 0, an invisible look: the effect draws the hat) pinned to the hat every
 * frame, made on both screens (`ctx.summon` exists in the hero's own context and in the replayed one, so online his hats are hit by the enemy's
 * replayed casts on his screen, and by the enemy's own spells on theirs). Hats are only hittable when all 3 units could be made (6 a side). A spell or bolt that reaches a hat pops it: a wrong hat bursts into confetti and goes; the right hat bursts and he pops
 * out stunned 1 s where it was (the effect writes `act.popped`; the trait tells his own client). An area spell reaches all three. That
 * makes up to 3 hat units and the rabbit: the cap is 6 units a side. Clean by about 2.7 s. No damage and no telegraph (nothing here hits).
 * See pipeline/designs/kit-magic.md.
 */
export interface HatTrickSettings {
  loop: boolean;
}

export const defaultHatTrick = (): HatTrickSettings => ({ loop: false });

// Timeline (seconds).
const POP_IN = 0.2;
const LEAD = 0.15;
const SWAP_T = 0.42;
const SHUF_END = LEAD + 3 * SWAP_T;
const EMERGE_T = HAT_TIME;
const MOVE_T = EMERGE_T - 0.1;
const DURATION = EMERGE_T + 1.2;

const easeOutBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
};

export class HatTrickFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HatTrickSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private slots: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private swaps: [number, number][] = [[0, 1], [1, 2], [0, 2]];
  private right = 0;
  private act: HatAct | null = null;
  private handle: Summon | null = null;
  private dead = [false, false, false];
  private gone = [false, false, false];
  private flags = { start: false, units: false, moved: false, emerged: false, rabbit: false };
  private emergeAt = -1;
  private emergeSpot = new THREE.Vector3();
  private spark = 0;

  private hats = new Hats(3);
  private confetti = new Pieces('confetti', 160);
  private stars = new Pieces('star', 70);
  private smoke = new SmokeBall({ color: 0x2a1448, rim: 0x8a4ad0, flake: 0xb05aff, maxBalls: 6 });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: MAGIC.foil, core: MAGIC.core, additive: false });
  private ring: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: MAGIC.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HatTrickSettings = defaultHatTrick()) {
    this.settings = settings;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.visible = false;
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.hats.group, this.confetti.mesh, this.stars.mesh, this.smoke.mesh, this.pop.mesh, this.ring);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return EMERGE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the spots: only `sentFrom`.
    this.centre.copy(ctx.sentFrom ?? ctx.from).setY(0);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      this.slots[i].set(this.centre.x + Math.sin(a) * HAT_RING, 0, this.centre.z + Math.cos(a) * HAT_RING);
    }
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Both screens work out the same shuffle from the shared key.
    const b = bookOf(ctx.caster);
    const plan = shuffleOf(b.key);
    this.swaps = plan.swaps;
    this.right = plan.right;
    const now = performance.now();
    this.act = { kind: 'trick', right: this.right, bornAt: now, until: now + EMERGE_T * 1000, popped: false, told: false };
    b.act = this.act;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.act = null;
    this.handle = null;
    this.dead = [false, false, false];
    this.gone = [false, false, false];
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.emergeAt = -1;
    this.spark = 0;
    this.hats.hideAll();
    this.confetti.reset();
    this.stars.reset();
    this.smoke.clear();
    this.pop.set(this.centre, 0, 0);
    this.ring.visible = false;
    this.ringMat.opacity = 0;
  }

  /** Where hat `h` is at time `t` (ground), and how high it hops: the swaps trade two spots along half-circles. */
  private hatAt(h: number, t: number, out: THREE.Vector3): number {
    let slot = h;
    for (let k = 0; k < this.swaps.length; k++) {
      const [a, b] = this.swaps[k];
      const t0 = LEAD + k * SWAP_T, t1 = t0 + SWAP_T;
      if (t >= t1) {
        if (slot === a) slot = b;
        else if (slot === b) slot = a;
        continue;
      }
      if (t > t0 && (slot === a || slot === b)) {
        const A = this.slots[a], B = this.slots[b];
        const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
        const from = slot === a ? A : B;
        const r = Math.hypot(A.x - B.x, A.z - B.z) / 2;
        const th = Math.atan2(from.z - mz, from.x - mx);
        const phi = THREE.MathUtils.smoothstep((t - t0) / SWAP_T, 0, 1) * Math.PI * (k % 2 ? -1 : 1);
        out.set(mx + Math.cos(th + phi) * r, 0, mz + Math.sin(th + phi) * r);
        return Math.sin(Math.abs(phi)) * 0.4;
      }
      break;
    }
    out.copy(this.slots[slot]);
    return 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.confetti.update(dt);
    this.stars.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, ctx = this.ctx;
    if (t >= DURATION && !this.confetti.busy && !this.stars.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- 0: a puff of purple smoke where he stood, the hats pop up round it. ---
    if (!f.start) {
      f.start = true;
      this.smoke.trigger(this.v1.set(this.centre.x, 0.5, this.centre.z), 1.5, 1.0);
      this.confetti.burst(this.v1.set(this.centre.x, 0.6, this.centre.z), 28, 4.6, { size: 0.16, life: 1.0 });
      this.stars.burst(this.v1, 8, 3.2, { size: 0.26, life: 0.9, up: 1 });
      this.shake = 0.12;
    }

    // --- 0.15: the hats are units, so a spell or a bolt can reach them. ---
    if (!f.units && t >= LEAD) {
      f.units = true;
      this.handle = ctx?.summon?.({
        kind: 'turret', at: this.centre.clone(), count: 3, hp: HAT_HP, seconds: EMERGE_T + 0.6, damage: 0, attackEvery: 999, range: 0.01,
        color: MAGIC_CSS.violet, look: HIDDEN_LOOK,
      }) ?? null;
      this.handle?.onDeath((u) => this.hatDied(u));
    }

    const act = this.act;
    if (f.units && !f.emerged) this.keepUnits();

    // --- The hats: pop up, then trade places in arcs. ---
    if (!f.emerged) {
      this.spark += dt;
      for (let i = 0; i < 3; i++) {
        if (this.dead[i]) continue;
        const grow = easeOutBack((t - i * 0.04) / POP_IN);
        const lift = this.hatAt(i, Math.min(t, SHUF_END), this.v1);
        const moving = lift > 0.02;
        this.hats.set(i, this.v1.x, this.v1.z, grow, lift, moving ? Math.sin(t * 20 + i) * 0.1 : 0, t * 0.5);
        if (moving && this.spark >= 0.05) this.stars.burst(this.v2.set(this.v1.x, 0.5 + lift, this.v1.z), 1, 0.9, { size: 0.18, life: 0.5, up: 0.1 });
      }
      if (this.spark >= 0.05) this.spark = 0;
    }

    // --- 1.4: his own client moves him to his hat (he is still unseen), so that he is there when the act ends. ---
    if (!f.moved && !f.emerged && t >= MOVE_T) {
      f.moved = true;
      this.hatAt(this.right, SHUF_END, this.v1);
      ctx?.moveCaster?.(this.v1.clone(), 0.05);
    }

    // --- The right hat was hit (this screen, or his own client's note): he pops out where it is. ---
    if (!f.emerged && act?.popped) {
      this.hatAt(this.right, Math.min(t, SHUF_END), this.v1);
      this.emerge(this.v1, true);
    } else if (!f.emerged && t >= EMERGE_T) {
      this.hatAt(this.right, SHUF_END, this.v1);
      this.emerge(this.v1, false);
    }

    // --- After he is out: the ring and the star, his hat tips and shrinks, and the rabbit. ---
    if (f.emerged) this.after(t - this.emergeAt);
    this.shake *= Math.exp(-dt * 10);
  }

  /** A hat unit died: by damage it bursts (a wrong one goes; the right one is him). */
  private hatDied(u: SummonUnit) {
    if (!u.slain || this.flags.emerged) return;
    const i = this.handle?.units.indexOf(u) ?? -1;
    if (i < 0 || this.dead[i]) return;
    this.dead[i] = true;
    u.figure.group.visible = false;
    this.hatAt(i, Math.min(this.time, SHUF_END), this.v1);
    const at = this.v1.clone();
    this.hats.hide(i);
    this.confetti.burst(this.v2.set(at.x, 0.7, at.z), 30, 5.2, { size: 0.17, life: 1.0 });
    this.stars.burst(this.v2, 6, 3.6, { size: 0.24, life: 0.9, up: 1 });
    this.smoke.trigger(this.v2.set(at.x, 0.4, at.z), 0.9, 0.7);
    this.shake = Math.max(this.shake, 0.1);
    if (i === this.right && this.act) this.act.popped = true;
  }

  /** The hat units stand on their hats and cannot be pushed; their bars stay hidden. */
  private keepUnits() {
    const h = this.handle;
    if (!h) return;
    h.units.forEach((u, i) => {
      if (!u.alive || this.dead[i]) return;
      this.hatAt(i, Math.min(this.time, SHUF_END), this.v1);
      u.pos.set(this.v1.x, 0, this.v1.z);
      u.knock.set(0, 0, 0);
      u.figure.bar.visible = false;
    });
  }

  /** He steps out of his hat at `at`: smoke, a ring, a star, confetti; the other hats go; the rabbit is due. */
  private emerge(at: THREE.Vector3, popped: boolean) {
    const f = this.flags;
    f.emerged = true;
    this.emergeAt = this.time;
    this.emergeSpot.copy(at);
    // His own client: out of the hat where it is (a pop moves him; the normal end already did).
    if (popped || !f.moved) this.ctx?.moveCaster?.(at.clone(), 0.05);
    this.smoke.trigger(this.v1.set(at.x, 0.7, at.z), 1.6, 1.0);
    this.confetti.burst(this.v1.set(at.x, 0.9, at.z), popped ? 46 : 38, 6.4, { size: 0.18, life: 1.2 });
    this.stars.burst(this.v1, popped ? 14 : 12, 5, { size: 0.3, life: 1.0, up: 1.1 });
    this.shake = popped ? 0.4 : 0.3;
    if (this.dead[this.right]) this.gone[this.right] = true;
    // The other hats and the units go.
    for (let i = 0; i < 3; i++) {
      if (i === this.right || this.gone[i]) continue;
      if (!this.dead[i]) {
        this.hatAt(i, Math.min(this.time, SHUF_END), this.v2);
        this.confetti.burst(this.v1.set(this.v2.x, 0.5, this.v2.z), 8, 3, { size: 0.14, life: 0.7 });
      }
      this.gone[i] = true;
      this.hats.hide(i);
    }
    for (const u of this.handle?.units ?? []) {
      if (!u.alive) continue;
      u.left = 0;
      u.figure.group.visible = false;
    }
  }

  private after(a: number) {
    const f = this.flags, ctx = this.ctx, at = this.emergeSpot;
    // The ring and the star.
    const rk = THREE.MathUtils.clamp(a / 0.5, 0, 1);
    this.ring.visible = rk < 1;
    this.ring.position.set(at.x, 0.07, at.z);
    this.ring.scale.setScalar(0.6 + 2.8 * (1 - (1 - rk) ** 3));
    this.ringMat.opacity = 0.9 * (1 - rk);
    const sp = StarBurst.pop(a, 0.06, 0.2);
    this.pop.set(this.v1.set(at.x, 1.3, at.z), 2.6 * sp.scale, sp.opacity, a * 3);
    // His hat tips up and shrinks away.
    if (!this.gone[this.right]) {
      const k = THREE.MathUtils.smoothstep(a / 0.6, 0, 1);
      this.hats.set(this.right, at.x, at.z, 1 - k * 0.98, 0.3 * Math.sin(Math.min(1, a / 0.3) * Math.PI), 0.5 * Math.min(1, a / 0.3), 0, 1 - k);
      if (k >= 1) { this.gone[this.right] = true; this.hats.hide(this.right); }
    }
    // The rabbit: once the hat units are gone (a side holds 6 units at most), where he came out.
    if (!f.rabbit && a > 0.05 && ctx?.summon && !this.handle?.alive) {
      f.rabbit = true;
      ctx.summon({
        kind: 'melee', at: new THREE.Vector3(at.x, 0, at.z), count: 1, hp: RABBIT_HP, seconds: RABBIT_LIFE, damage: RABBIT_DAMAGE, attackEvery: 1.2,
        speed: RABBIT_SPEED, color: MAGIC_CSS.hot, look: rabbitLook,
      });
      this.smoke.trigger(this.v1.set(at.x, 0.3, at.z), 0.8, 0.6);
    }
  }
}

export const hatTrickModule: EffectModule = {
  label: 'hat trick',
  category: 'hero: magic',
  // Centred on him; the hats stand 1.1 m round him.
  targeting: { mode: 'self', radius: 2 },
  create: () => new HatTrickFx(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HatTrickFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as HatTrickFx).settings, 'loop');
  },
};
