import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { CHRONO, CHRONO_CSS, Dial, ECHO_GOLD, EchoClock, Flakes, FrozenMotes } from '../../effects/parts/chrono';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ECHO_DELAY, ECHO_SHARE, startStolen } from '../../traits/chrono';

/**
 * Stolen Hour (chrono kit v5, R: a targeted, delayed hit, label 'stolen hour'). A click on the enemy (8 m, `enemy` mode).
 * A big clock face forms over the enemy (0.35 s to draw in, 1.2 m radius, over their head, following them live) and its
 * hands tick to twelve over 0.8 s; a ground ring closes in on their feet and a red circle (the telegraph) marks them on both
 * screens. He is NOT untouchable and not held beyond the wind-up. At 0.8 s the spell checks itself: if `stillSees` the
 * enemy is false it fizzles (the face cracks, flakes fall, nothing else happens: no hit, no Stolen Hour, no echo). Otherwise
 * the hands stop dead with a flash and an impact frame, the face cracks and falls apart, and the enemy takes `damage` (70)
 * and is slowed `slowSeconds` (2 s), a `projectile: true` hit (the wind-up was the warning, and the sight check is the
 * dodge). STOLEN HOUR starts only here, so this file writes the flag at that moment (`startStolen`: his echoes are 80% for
 * 4 s on this screen) and his trait does the rest (`dealt` slot 3 -> `noteOwner` -> `peerNote`: the haste, the gold pip and
 * ring). THE ECHO: from the hit a gold ghost clock hangs over the enemy (following them), its hands running to twelve at 2.3 s
 * (1.5 s after the hit); then it flashes and, if `stillSees` again, the enemy takes `echoDamage` (28, always 40%: the
 * strong share is for his other spells) with a smaller flake burst. It does not touch cooldowns. R's echo is a
 * `projectile: true` hit too. Clean by 2.7 s. R's cooldown is 24 s, so nothing restarts it first. See
 * pipeline/designs/kit-chrono.md.
 */
export interface StolenHourSettings {
  damage: number;
  slowSeconds: number;
  loop: boolean;
}

export const defaultStolenHour = (): StolenHourSettings => ({ damage: 70, slowSeconds: 2, loop: false });

// Timeline (seconds).
const WIND_T = 0.8;
const ECHO_T = WIND_T + ECHO_DELAY;
const DURATION = ECHO_T + 0.4;
const FIZZLE_END = WIND_T + 0.7;
const MARK_R = 1.2;
const FACE_R = 1.2;
const FACE_Y = 2.75;
const STEPS = 8;

export class StolenHour implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StolenHourSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private flags = { check: false, echo: false };
  private landed = false;
  private fizzled = false;
  private popAt = [-1, -1];
  private shockAt = -1;
  private foe = new THREE.Vector3();
  private normal = new THREE.Vector3(0, 0.3, 1).normalize();

  // Parts.
  private face = new Dial({ face: 'dark', marks: 'full', order: 9 });
  private clock = new EchoClock(10);
  private flakes = new Flakes(4);
  private motes = new FrozenMotes();
  private markRing = new ShockRefraction({ facing: 'ground' });
  private shock = new ShockRefraction({ facing: 'camera' });
  private pops = [0, 1].map((i) => new StarBurst({ points: 8, inner: 0.3, color: i ? CHRONO.foil : CHRONO.body, core: CHRONO.core, additive: false }));

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: StolenHourSettings = defaultStolenHour()) {
    this.settings = settings;
    this.screen.impactColor.set(CHRONO.hot);
    this.screen.tint.set(CHRONO.dark);
    this.group.add(
      this.face.group, this.clock.group, this.flakes.mesh, this.motes.mesh, this.markRing.mesh, this.shock.mesh, ...this.pops.map((p) => p.mesh),
    );
    this.reset();
  }

  /** The echo's damage: 40% of the first hit, whatever Stolen Hour does for his other spells. */
  get echoDamage() {
    return Math.round(this.settings.damage * ECHO_SHARE);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    // The clock face forms over the enemy: its hands run to twelve at the hit.
    this.faceNormal();
    this.face.show(this.v1.copy(this.foe).setY(FACE_Y), FACE_R, this.normal, 0.35);
  }

  private faceNormal() {
    const c = this.ctx?.caster.group.position;
    if (c) this.normal.set(c.x - this.foe.x, 0, c.z - this.foe.z);
    if (this.normal.lengthSq() < 1e-4) this.normal.set(0, 0, 1);
    this.normal.normalize().y = 0.3;
    this.normal.normalize();
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.check = this.flags.echo = false;
    this.landed = this.fizzled = false;
    this.popAt[0] = this.popAt[1] = -1;
    this.shockAt = -1;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(CHRONO.hot);
    this.screen.tint.set(CHRONO.dark);
    this.face.reset();
    this.clock.reset();
    this.flakes.reset();
    this.motes.reset();
    this.markRing.set(this.foe, 0, 0);
    this.shock.set(this.foe, 0, 0);
    for (const p of this.pops) p.set(this.foe, 1e-3, 0);
  }

  /** Throws `n` flakes of the cracked face from the enemy's head. */
  private shatter(n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      this.v1.set(this.foe.x + Math.cos(a) * 0.5, FACE_Y + Math.sin(a) * 0.5, this.foe.z + (i % 3) * 0.1);
      this.v2.set(Math.cos(a) * speed, 1.2 + (i % 4) * 0.5, Math.sin(a * 1.3) * speed * 0.6);
      this.flakes.emit(this.v1, this.v2, 0.34, 0.9 + (i % 3) * 0.15);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.face.update(dt);
    this.clock.update(dt);
    this.flakes.update(dt);
    this.motes.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;
    this.liveFoe();
    if (t >= (this.fizzled ? FIZZLE_END : DURATION)) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }

    // --- The wind-up: the face hangs over the enemy (following them), its hands tick to twelve; a ring closes in on their feet. ---
    if (t < WIND_T) {
      this.face.place(this.v1.copy(this.foe).setY(FACE_Y), FACE_R);
      const p = t / WIND_T, step = Math.floor(p * STEPS) / STEPS;
      this.face.hands[0].setAngle(step * Math.PI * 2);
      this.face.hands[1].setAngle(Math.PI * 0.66 + step * Math.PI * 0.5);
      const mp = smoothstep(t / 0.15);
      this.markRing.set(this.foe, 2.0 - 1.0 * p, 0.05 * mp);
      this.screen.darken = 0.3 * smoothstep(t / WIND_T);
    }

    if (!f.check && t >= WIND_T) {
      f.check = true;
      this.markRing.set(this.foe, 0, 0);
      const sees = !!ctx && !!this.target && stillSees(ctx, this.target.group.position);
      if (sees && ctx && this.target) {
        this.landed = true;
        // The hands stop dead with a flash; the face cracks and falls apart.
        this.face.freeze();
        this.face.hands[0].setAngle(Math.PI * 2);
        this.face.crack(1);
        this.face.hide(0.35);
        this.shatter(14, 3.2);
        this.popAt[0] = t;
        this.shockAt = t;
        this.shake = 0.5;
        // Stolen Hour starts here, on this screen; his trait tells his own client (`dealt` -> `noteOwner`).
        startStolen(ctx.caster);
        ctx.hit(this.target, {
          damage: this.settings.damage, knock: 1.5, from: ctx.from, color: CHRONO_CSS.body, projectile: true,
          status: { kind: 'slow', seconds: this.settings.slowSeconds },
        });
        // The ghost clock of the echo hangs over the enemy, gold, until 2.3 s.
        this.clock.gold(true);
        this.clock.show(this.v1.copy(this.foe).setY(FACE_Y), 0.9, this.normal, ECHO_DELAY);
        this.motes.freeze(this.v1.copy(this.foe), 1.4, 10);
      } else {
        // No sight: the face cracks and falls, and nothing else happens.
        this.fizzled = true;
        this.face.crack(1);
        this.face.hide(0.3);
        this.shatter(8, 1.6);
        this.shake = 0.08;
      }
    }

    if (this.landed) {
      this.clock.place(this.v1.copy(this.foe).setY(FACE_Y));
      if (!f.echo && t >= ECHO_T) {
        f.echo = true;
        this.clock.gold(true);
        this.clock.fire();
        this.popAt[1] = t;
        this.shockAt = t;
        this.shake = Math.max(this.shake, 0.18);
        this.shatter(6, 2.2);
        this.motes.release(0.4);
        // The same sight check: cover (or distance that breaks sight) still answers it.
        if (ctx && this.target && stillSees(ctx, this.target.group.position)) {
          ctx.hit(this.target, { damage: this.echoDamage, knock: 0.6, from: ctx.from, color: CHRONO_CSS.body, projectile: true });
        } else this.popAt[1] = -1;
      }
    }

    // --- The impact frame and the chroma kick on the hit; the star and the ring on the body (the echo's are smaller, ivory). ---
    this.screen.focus.copy(this.foe).setY(1.2);
    this.screen.impact = this.landed ? impactFrameAt(t, WIND_T, [1, 2], 0.04) : 0;
    this.screen.chroma = this.landed && t >= WIND_T ? chromaPulse(t, WIND_T, 0.7, 7) : 0;
    this.screen.edgeTint.set(ECHO_GOLD);
    if (t >= WIND_T) this.screen.darken = 0.3 * (1 - smoothstep((t - WIND_T) / 0.3));
    for (let i = 0; i < 2; i++) {
      if (this.popAt[i] < 0) continue;
      const sp = StarBurst.pop(t - this.popAt[i], 0.03, 0.14);
      this.pops[i].set(this.v1.copy(this.foe).setY(1.3), (i ? 1.4 : 2.4) * sp.scale + 1e-3, sp.opacity, 0.3 + i);
    }
    if (this.shockAt >= 0) {
      const g = smoothstep((t - this.shockAt) / 0.4);
      if (g >= 1) { this.shockAt = -1; this.shock.set(this.foe, 0, 0); }
      else this.shock.set(this.v1.copy(this.foe).setY(1.2), 0.3 + (f.echo ? 1.4 : 2.0) * g, 0.05 * (1 - g) * (1 - g));
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const stolenHourModule: EffectModule = {
  label: 'stolen hour',
  category: 'hero: chrono',
  // Click an enemy: the hit lands (`projectile`) once the 0.8 s wind-up holds and he still sees them; the wind-up is the warning.
  targeting: { mode: 'enemy' },
  create: () => new StolenHour(),
  telegraphs(effect) {
    const e = effect as StolenHour;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: WIND_T }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StolenHour;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StolenHour).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slowSeconds', 0, 3, 0.1);
  },
};
