import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BARD, BARD_CSS, DuetWall, GLYPH, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BEAT, cantorClock, cantorDuets, type DuetState } from '../../traits/bard';

/**
 * Duet (bard kit v5, R: a ring that holds both heroes). Self cast. A ring of staves closes from 9 m to 6 m round the spot he
 * stood on (`ctx.sentFrom ?? ctx.from`, so both screens agree) in 0.8 s (`CLOSE_T`): a wall of five-line staves 2.4 m tall,
 * dark notes sliding along it, and a stave on the floor at its foot. The cast's telegraph is the 6 m circle (impact 0.8 s).
 * At 0.8 s the effect judges the enemy on its LIVE position: if it is inside 6 m, `ctx.confine(x, z, 6, 3.4)` closes the ring
 * (neither hero can leave it until 4.2 s) and the trait's record `cantorDuets.live` is set (the trait's `dealt` then adds a
 * 0.5 s silence to an in-tune spell hit). If nobody is inside the ring collapses (the wall shatters into notes, no confine) and
 * `cantorDuets.collapsed` is set: his trait's `tick` gives back half of R's cooldown, once. While the ring holds, on every beat
 * (the trait's `cantorClock`, so it matches the ring under him; every 1.2 s where there is no trait) a pulse of 12
 * (`PULSE_DAMAGE`, `projectile: true`) hits each enemy inside the ring on its live position (6 m plus 0.1 m, since the
 * confine presses a hero against the wall), with a gold ring racing out from the centre. Everything is gone by 4.2 s
 * (`DURATION`), the record with it. He cannot cast it while the enemy is charmed (the trait's `canCast`). Cooldown 24 s.
 * Network duels: each screen applies the confine to its own hero (`ctx.confine`), judges the enemy on its own screen's live
 * positions and draws the ring; only the victim's screen's pulse hits count.
 */
export interface DuetSettings {
  /** Damage of each beat's pulse. */
  damage: number;
  loop: boolean;
}

export const defaultDuet = (): DuetSettings => ({ damage: 18, loop: false });

// Timeline (seconds).
const CLOSE_T = 0.8; // the ring has closed: the check
const HOLD_S = 3.4; // how long it confines
const DURATION = CLOSE_T + HOLD_S; // 4.2: everything ends
const START_R = 9;
const RING_R = 6;
const REACH = RING_R + 0.1; // a pulse reaches this far (a hero pressed against the wall)
const FOOT = 64;

export class Duet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DuetSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { checked: false, ended: false };
  /** 0 = closing, 1 = holding, 2 = collapsed, 3 = over. */
  private phase = 0;
  private phaseAt = 0;
  private state: DuetState | null = null;
  private lastBeat = 0;
  private fallback = 0;
  private centre = new THREE.Vector3();

  // Parts.
  private wall = new DuetWall();
  private foot = new Stave(96);
  private notes = new Notes(32);
  private rings = new SoundRings(6);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: BARD.accent, core: BARD.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private pts = Array.from({ length: FOOT }, () => new THREE.Vector3());

  constructor(settings: DuetSettings = defaultDuet()) {
    this.settings = settings;
    this.screen.impactColor.set(BARD.hot);
    this.screen.tint.set(BARD.dark);
    this.group.add(this.wall.mesh, this.foot.mesh, this.notes.mesh, this.rings.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return CLOSE_T;
  }

  /** The ring: where he stood, 6 m wide. */
  get ringAt() {
    return this.centre;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.centre.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(1.2);
    // A fresh cast replaces any old record at once.
    this.state = { live: false, collapsed: false };
    cantorDuets.set(ctx.caster, this.state);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    // A cast that stops (a new round, the tool's stop) never leaves the ring on.
    if (this.state) this.state.live = false;
    this.time = 0;
    this.shake = 0;
    this.fallback = 0;
    this.phase = 0;
    this.phaseAt = 0;
    this.flags.checked = this.flags.ended = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(BARD.dark);
    this.wall.set(this.centre, RING_R, 0);
    this.foot.reset();
    this.notes.reset();
    this.rings.reset();
    this.pop.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    this.fallback += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    if (!this.flags.checked && t >= CLOSE_T) {
      this.flags.checked = true;
      if (ctx) this.check(ctx);
    }
    if (this.phase === 1 && ctx) {
      const b = this.beatNow();
      if (b !== this.lastBeat) {
        this.lastBeat = b;
        this.pulse(ctx);
      }
    }
    this.layout(t);
    this.foot.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    this.shake *= Math.exp(-dt * 10);
  }

  /** The beat count now: the trait's round clock where there is one, else one every 1.2 s of this effect. */
  private beatNow() {
    const clock = this.ctx ? cantorClock.get(this.ctx.caster) : undefined;
    return clock !== undefined ? Math.floor(clock / BEAT) : Math.floor(this.fallback / BEAT);
  }

  /** The ring closes: who is inside, on their live positions? */
  private inside(ctx: CastContext, reach: number) {
    return ctx.targets.filter((e) => Math.hypot(e.group.position.x - this.centre.x, e.group.position.z - this.centre.z) <= reach);
  }

  private check(ctx: CastContext) {
    this.phaseAt = this.time;
    if (this.inside(ctx, RING_R).length) {
      this.phase = 1;
      this.lastBeat = this.beatNow();
      ctx.confine?.(this.centre.x, this.centre.z, RING_R, HOLD_S);
      if (this.state) this.state.live = true;
      this.shake = 0.3;
      this.rings.pulse(this.v1.copy(this.centre).setY(0.1), RING_R + 0.6, 0.5, undefined, { r0: 1, width: 0.3, tone: 'gold' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.notes.emit(this.v1.set(this.centre.x + Math.cos(a) * RING_R, 1.2, this.centre.z + Math.sin(a) * RING_R), this.v2.set(0, 1.5, 0), 1, 0.8, { size: 0.6, gold: true, spread: 0.8 });
      }
      for (let n = 0; n < 5; n++) this.notes.ride(this.foot, (n + 0.5) / 5, [GLYPH.quarter, GLYPH.eighth, GLYPH.beamed, GLYPH.quarter, GLYPH.eighth][n], { size: 0.8, du: 0.05, lift: 0.3, wrap: true });
    } else {
      // Nobody inside: the ring collapses and half of R's cooldown comes back (his trait's `tick`).
      this.phase = 2;
      if (this.state) this.state.collapsed = true;
      this.notes.emit(this.v1.copy(this.centre).setY(1.2), this.v2.set(0, 2, 0), 14, 1.4, { size: 0.7, spread: 4.5, gravity: 4 });
      this.rings.pulse(this.v1.copy(this.centre).setY(0.1), RING_R * 0.5, 0.5, undefined, { r0: RING_R, width: 0.25, tone: 'dark', inward: true });
      this.shake = 0.12;
    }
  }

  /** A beat while the ring holds: a pulse hits everyone inside it, on their live positions. */
  private pulse(ctx: CastContext) {
    this.rings.pulse(this.v1.copy(this.centre).setY(0.12), RING_R, 0.5, undefined, { r0: 0.6, width: 0.3, tone: 'gold' });
    this.shake = Math.max(this.shake, 0.12);
    for (const e of this.inside(ctx, REACH)) {
      ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.centre.clone(), color: BARD_CSS.body, projectile: true });
      this.notes.emit(this.v1.set(e.group.position.x, 1.2, e.group.position.z), this.v2.set(0, 2.2, 0), 3, 0.7, { size: 0.45, gold: true, spread: 1.6 });
    }
  }

  private layout(t: number) {
    const holding = this.phase === 1;
    // The wall closes from 9 m to 6 m, holds, and fades over the last 0.3 s. A collapsed ring falls apart over 0.3 s.
    const close = smoothstep(t / CLOSE_T);
    const radius = START_R + (RING_R - START_R) * close;
    let alpha = 0.3 + 0.7 * close;
    if (holding) alpha *= 1 - smoothstep((t - (DURATION - 0.3)) / 0.3);
    if (this.phase === 2) alpha *= 1 - smoothstep((t - this.phaseAt) / 0.3);
    this.wall.set(this.centre, radius, alpha, t);

    // The stave on the floor at the wall's foot.
    for (let k = 0; k < FOOT; k++) {
      const a = (k / (FOOT - 1)) * Math.PI * 2;
      this.pts[k].set(this.centre.x + Math.cos(a) * radius, 0.14, this.centre.z + Math.sin(a) * radius);
    }
    this.foot.setPath(this.pts, 0.12, 1, 0);
    this.foot.wave(0.03);
    this.foot.alpha = alpha;

    // One impact frame as it closes.
    this.screen.impact = impactFrameAt(t, CLOSE_T, [1], 0.03);
    if (this.flags.checked && t - CLOSE_T < 0.5) {
      const sp = StarBurst.pop(t - CLOSE_T, 0, 0.03);
      this.pop.set(this.v1.copy(this.centre).setY(1.3), 1.9 * sp.scale, sp.opacity, 0.2);
    }
  }
}

export const duetModule: EffectModule = {
  label: 'duet',
  category: 'hero: bard',
  // SELF: the radius fills `ctx.targets` with every enemy near enough to be inside the ring by 0.8 s (judged live there).
  targeting: { mode: 'self', radius: 9 },
  create: () => new Duet(),
  telegraphs(effect) {
    const e = effect as Duet;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.ringAt.x, z: e.ringAt.z, radius: RING_R }, start: 0, impact: CLOSE_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Duet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Duet).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
