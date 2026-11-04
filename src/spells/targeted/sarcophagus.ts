import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, GlyphRing, Sarcophagus, ScarabSwarm } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sarcophagus (sand kit v5, R: a sealed tomb at the enemy's spot, `enemy` mode, 9 m, sight checked by the engine at the cast).
 * A circle of glyph-carved stone (1.6 m, the telegraph) is laid at the spot the enemy stood at the cast and a gold
 * mummiform sarcophagus rises out of the floor there with its two halves swung wide, in 0.4 s. At 0.7 s the halves slam shut
 * (`impact`, the one short warning-free moment, the shut is the hit). If the enemy is still inside 1.6 m (their live position)
 * `ctx.hit(target, { damage: 0, knock: 0, status: sealed 1.2 s })`: sealed, they cannot act and nothing can hit them from
 * either side, and the opaque gold case hides them. If they stepped out it shuts on nothing, and sinks: no seal, no damage.
 * The seal runs 1.2 s from the frame it landed. The frame it ends is not trusted (statuses tick each frame and the effect
 * cannot read the enemy's status), so the effect waits one more frame, then the halves burst open in scarabs and the 90 damage
 * lands (`projectile: true`: the hit is on the seal's own result, a figure no longer sealed, so `resolve` does not swallow it)
 * with a brief impact frame. The trait (`src/traits/sand.ts`) Judges them with that hit. So the burst comes about
 * 1.3 s after the seal, around 2.0 s after the cast; clean by about 3.1 s. Sefu is free to move and act from 0.7 s.
 * Network duels: the victim's client decides the seal and the burst from the cast's live positions; the dealer's screen draws
 * the same case at the same times.
 */
export interface SarcophagusSettings {
  /** Damage of the burst when the seal opens (a Judged enemy takes 20% more: the trait). */
  damage: number;
  /** Seal seconds (engine cap 1.2). */
  seal: number;
  loop: boolean;
}

export const defaultSarcophagus = (): SarcophagusSettings => ({ damage: 110, seal: 1.2, loop: false });

// Timeline (seconds).
const RISE_T = 0.4; // fully up, halves wide
const SHUT_FROM = 0.55; // the halves start to swing shut
const SHUT_T = 0.7; // shut: the seal decision
const MISS_SINK_T = 0.95; // a shut-on-nothing case starts to sink
const MISS_END = 1.7;
const AFTER_BURST = 1.0; // from the burst to clean

const RADIUS = 1.6; // the telegraph circle, and how far from the spot the enemy may be at 0.7 s
const RING_R = 1.75; // the carved ring on the floor

export class SarcophagusSpell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SarcophagusSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the enemy stood at the cast: the circle's centre. */
  readonly spot = new THREE.Vector3();
  /** Where the case stands: the spot, or where the sealed enemy stood when it shut (they are frozen there, inside it). */
  private casePos = new THREE.Vector3();
  private target: Enemy | null = null;
  private time = 0;
  private yaw = 0;
  private decided = false;
  /** The frame the seal landed (-1: shut on nothing, or not yet). */
  private sealAt = -1;
  private armed = false;
  private burstAt = -1;
  private endT = MISS_END;
  private flags = { rise: false, shut: false };

  private ring = new GlyphRing();
  private case = new Sarcophagus();
  private swarm = new ScarabSwarm(40);
  private dust = new Dust(10, 40);
  private flash = new StarBurst({ points: 12, inner: 0.3, color: SAND.hot, core: SAND.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shock = new ShockRefraction({ facing: 'camera' });

  private v1 = new THREE.Vector3();

  constructor(settings: SarcophagusSettings = defaultSarcophagus()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.screen.tint.set(SAND.dark);
    this.dust.life = 0.7;
    this.group.add(this.ring.mesh, this.case.mesh, this.swarm.mesh, this.dust.mesh, this.flash.mesh, this.groundShock.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return this.endT;
  }

  get impactTime() {
    return SHUT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.spot.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.casePos.copy(this.spot);
    const from = ctx.sentFrom ?? ctx.from;
    // The face looks toward the caster's side, which is the camera's.
    this.yaw = Math.atan2(from.x - this.spot.x, from.z - this.spot.z);
    this.case.place(this.casePos, this.yaw);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.decided = false;
    this.sealAt = -1;
    this.armed = false;
    this.burstAt = -1;
    this.endT = MISS_END;
    this.casePos.copy(this.spot);
    this.flags.rise = this.flags.shut = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(SAND.stone);
    this.screen.tint.set(SAND.dark);
    this.ring.reset();
    this.ring.set(this.spot, RING_R, 0);
    this.case.reset();
    this.case.place(this.casePos, this.yaw);
    this.swarm.reset();
    this.dust.reset();
    this.flash.set(this.spot, 1e-3, 0);
    this.groundShock.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= this.endT) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.rise && t >= 0.05) {
      f.rise = true;
      this.dust.puff(this.v1.copy(this.spot).setY(0.3), 1.0);
      this.dust.fall(this.spot, 1.4, 14, 2.5, 0.8);
    }

    // --- 0.7 s: the halves shut. Still inside the circle: sealed. Stepped out: shut on nothing. ---
    if (!this.decided && t >= SHUT_T) {
      this.decided = true;
      f.shut = true;
      this.shake = 0.35;
      this.dust.puff(this.v1.copy(this.spot).setY(0.3), 1.2);
      this.dust.fall(this.spot, 1.4, 14, 2.0, 0.6);
      const ctx = this.ctx, tg = this.target;
      const inside = !!ctx && !!tg && Math.hypot(tg.group.position.x - this.spot.x, tg.group.position.z - this.spot.z) <= RADIUS;
      if (inside) {
        this.sealAt = t;
        // The effect must outlive the seal: the burst sets the real end (without this it stopped at MISS_END, before the burst).
        this.endT = t + this.settings.seal + AFTER_BURST;
        // The seal freezes them where they stand (up to 1.6 m off the centre): the case shuts round them there.
        this.casePos.set(tg!.group.position.x, 0, tg!.group.position.z);
        this.case.place(this.casePos, this.yaw);
        this.dust.puff(this.v1.copy(this.casePos).setY(0.3), 1.0);
        ctx!.hit(tg!, { damage: 0, knock: 0, color: SAND_CSS.hot, status: { kind: 'sealed', seconds: this.settings.seal } });
      }
    }
    // --- The seal has run its time: wait one frame, then the case bursts open and the 90 lands on an unsealed figure. ---
    if (this.sealAt >= 0 && this.burstAt < 0) {
      if (this.armed) this.burst(t);
      else if (t >= this.sealAt + this.settings.seal) this.armed = true;
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  private burst(t: number) {
    this.burstAt = t;
    this.endT = t + AFTER_BURST;
    this.shake = 0.8;
    this.swarm.burst(this.v1.copy(this.casePos).setY(0.6), 30, 6, 1.1);
    this.dust.puff(this.v1.copy(this.casePos).setY(0.4), 1.3);
    this.dust.fall(this.casePos, 1.6, 20, 3, 0.8);
    const ctx = this.ctx, tg = this.target;
    // `projectile`: the seal and the circle were the check; the burst reaches the figure inside.
    if (ctx && tg) ctx.hit(tg, { damage: this.settings.damage, knock: 2, from: this.casePos.clone(), color: SAND_CSS.hot, projectile: true });
  }

  private layout(t: number) {
    // --- The carved ring: swept on in 0.3 s, pulsing turquoise while they are sealed, gone with the case. ---
    const burstA = this.burstAt >= 0 ? t - this.burstAt : -1;
    const ringFade = burstA >= 0 ? 1 - smoothstep((burstA - 0.4) / 0.5) : this.decided && this.sealAt < 0 ? 1 - smoothstep((t - MISS_SINK_T) / 0.5) : 1;
    this.ring.reveal = smoothstep(t / 0.3);
    this.ring.opacity = ringFade;
    this.ring.lit = this.sealAt >= 0 && burstA < 0 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    this.ring.set(this.spot, RING_R, 0);

    // --- The case: rises with its halves wide, swings shut at 0.7 s, shakes while it holds, bursts open, sinks. ---
    let rise = smoothstep((t - 0.05) / (RISE_T - 0.05));
    let open = 1 - smoothstep((t - SHUT_FROM) / (SHUT_T - SHUT_FROM));
    if (burstA >= 0) {
      open = Math.min(1.7, smoothstep(burstA / 0.15) * 1.7);
      rise = 1 - smoothstep((burstA - 0.35) / 0.55);
    } else if (this.decided && this.sealAt < 0) {
      rise = 1 - smoothstep((t - MISS_SINK_T) / 0.5);
    }
    this.case.set(open, rise);
    const held = this.sealAt >= 0 && burstA < 0;
    const shake = held ? 0.035 * (0.4 + 0.6 * smoothstep((t - this.sealAt) / this.settings.seal)) : 0;
    this.case.mesh.position.x = this.casePos.x + Math.sin(t * 61) * shake;
    this.case.mesh.position.z = this.casePos.z + Math.cos(t * 53) * shake;

    // --- The screen: dims through the hold and the dead beat, one short impact frame on the burst. ---
    const dim = held ? smoothstep((t - this.sealAt) / 0.2) : burstA >= 0 ? 1 - smoothstep(burstA / 0.4) : 0;
    this.screen.darken = 0.3 * dim;
    this.screen.focus.copy(this.casePos).setY(1.4);
    this.screen.impact = burstA >= 0 ? impactFrameAt(t, this.burstAt, [1, 2], 0.04) : 0;

    // --- The shut and the burst: a star and rings. ---
    if (this.decided) {
      const a = t - SHUT_T;
      const sp = StarBurst.pop(a, 0.02, 0.08);
      this.flash.set(this.v1.copy(this.casePos).setY(1.4), (this.sealAt >= 0 ? 1.3 : 0.7) * sp.scale + 1e-3, sp.opacity, 0.2);
    }
    if (burstA >= 0) {
      const sp = StarBurst.pop(burstA, 0.03, 0.14);
      this.flash.set(this.v1.copy(this.casePos).setY(1.5), 2.4 * sp.scale + 1e-3, sp.opacity, 0.4);
      const g = THREE.MathUtils.clamp(burstA / 0.45, 0, 1);
      this.groundShock.set(this.casePos, 0.6 + 3.4 * g, 0.05 * (1 - g) * (1 - g));
      const s = THREE.MathUtils.clamp(burstA / 0.3, 0, 1);
      this.shock.set(this.v1.copy(this.casePos).setY(1.5), 0.4 + 2.0 * s, 0.05 * (1 - s) * (1 - s));
    }
  }
}

export const sarcophagusModule: EffectModule = {
  label: 'sarcophagus',
  category: 'hero: sand',
  // Click an enemy within 9 m (the engine checks sight at the cast). The circle is fixed where they stood: step out of it.
  targeting: { mode: 'enemy' },
  create: () => new SarcophagusSpell(),
  telegraphs(effect) {
    const e = effect as SarcophagusSpell;
    if (!e.ctx) return [];
    // One zone only: a longer one would root the caster for the whole seal. It ends at the shut (0.7 s).
    return [{ shape: { kind: 'circle', x: e.spot.x, z: e.spot.z, radius: RADIUS }, start: 0, impact: SHUT_T }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SarcophagusSpell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SarcophagusSpell).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'seal', 0.2, 1.2, 0.1);
  },
};
