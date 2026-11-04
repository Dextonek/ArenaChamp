import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Fluff, StrandTube, YARN, YARN_CSS, YarnBalls, catLook, strandPoints } from '../../effects/parts/yarn';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  BISCUIT_DAMAGE, BISCUIT_EVERY, BISCUIT_HP, BISCUIT_LIFE, BISCUIT_SPEED, bookOf, catGoal, type CatPlay,
} from '../../traits/yarn';

/**
 * Mr. Biscuit (yarn kit v5, R: the ultimate, a cat). Grandma tips a big ball of wool out of her basket at her feet; it wobbles and
 * swells for 0.4 s and bursts in a puff of wool, and Mr. Biscuit, a big grey cat (`ctx.summon`, `catLook`: wide body, round head,
 * two ears, a long curling tail), springs out of it at her feet and runs at the enemy at 4.5 m/s. He has 200 HP and stays 6 s. In
 * reach he pounces and sits on them: 25 damage a second (a melee unit, `projectile` hits through the engine), and every hit slows
 * (the trait's `dealt`). It stops for yarn: when one of her lines is cut within 4 m of him he goes to the loose end and plays with
 * it for 1 s, sitting with his head down and batting at the floor, tail flicking (`SummonOptions.goal`, `catGoal` in
 * src/traits/yarn.ts). Shoot him (he is a unit: bolts, spells and attacks hit him), or lead him off. He puffs into wool when
 * he goes. Network duels without `ctx.summon` on this screen: a ball of wool rolls at the enemy trailing its thread and bursts there,
 * no hit. No zone (the touch is the dodge check), so no telegraph. Clean 0.8 s after he goes. See pipeline/designs/kit-yarn.md.
 */
export interface MrBiscuitSettings {
  damage: number;
  hp: number;
  /** Running speed (m/s). */
  speed: number;
  loop: boolean;
}

export const defaultMrBiscuit = (): MrBiscuitSettings => ({ damage: BISCUIT_DAMAGE, hp: BISCUIT_HP, speed: BISCUIT_SPEED, loop: false });

// Timeline (seconds).
const SPAWN_T = 0.4;
const TAIL = 0.8;
const DURATION = SPAWN_T + BISCUIT_LIFE + TAIL;
const ROLL_SECONDS = 1.1;
const SEGS = 16;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class MrBiscuitFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MrBiscuitSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private spot = new THREE.Vector3();
  private foe = new THREE.Vector3();
  private spawned = false;
  private rolled = false;
  private unit: SummonUnit | null = null;
  private last = new THREE.Vector3();
  private stepClock = 0;
  private endAt = DURATION;
  private popAt = -1;
  private popPos = new THREE.Vector3();
  private play_: CatPlay = { seen: 0, x: 0, z: 0, until: 0, playing: false };
  private goalOut = new THREE.Vector3();
  private pts: THREE.Vector3[] = [];

  private balls = new YarnBalls(1);
  private thread = new StrandTube(SEGS, 5, YARN.pink, 0.06);
  private fluff = new Fluff(70);
  private star = new StarBurst({ points: 10, inner: 0.3, color: YARN.pink, core: YARN.core, additive: false });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MrBiscuitSettings = defaultMrBiscuit()) {
    this.settings = settings;
    this.group.add(this.balls.mesh, this.thread.mesh, this.fluff.mesh, this.star.mesh);
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
    this.spot.copy(this.from).addScaledVector(this.fwd, 0.7);
    this.foe.copy(ctx.targets[0]?.group.position ?? this.from.clone().addScaledVector(this.fwd, 6));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spawned = false;
    this.rolled = false;
    this.unit = null;
    this.endAt = DURATION;
    this.popAt = -1;
    this.stepClock = 0;
    this.play_.playing = false;
    this.balls.reset();
    this.thread.hide();
    this.fluff.reset();
    this.star.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.fluff.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt && !this.fluff.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;
    if (!ctx) return;

    // --- 0..0.4: a big ball of wool comes out of the basket at her feet, wobbling and swelling. ---
    if (t < SPAWN_T) {
      const k = easeOut(t / SPAWN_T);
      this.v1.set(this.spot.x, 0.1 + 0.42 * k + Math.abs(Math.sin(t * 22)) * 0.06, this.spot.z);
      this.balls.place(0, this.v1, Math.max(0.15 + 0.4 * k, MIN), t * 14, t * 9);
      if (Math.random() < 0.4) this.fluff.burst(this.v2.copy(this.v1), 1, 0.9, 0.6, 0.2);
    }

    // --- The spawn: it bursts, and the cat is there. ---
    if (!this.spawned && t >= SPAWN_T) {
      this.spawned = true;
      this.balls.hide(0);
      this.v1.set(this.spot.x, 0.6, this.spot.z);
      this.fluff.burst(this.v1, 16, 4.5, 1.3);
      this.popAt = t;
      this.popPos.copy(this.v1);
      this.shake = 0.2;
      const b = bookOf(ctx.caster);
      this.play_.seen = performance.now();
      this.play_.until = 0;
      this.play_.playing = false;
      const handle = ctx.summon?.({
        kind: 'melee', at: this.from.clone(), count: 1, hp: this.settings.hp, seconds: BISCUIT_LIFE, damage: this.settings.damage,
        attackEvery: BISCUIT_EVERY, speed: this.settings.speed, color: YARN_CSS.grey, look: catLook(this.play_),
        // It stops for yarn: a line cut near it, and it goes to the loose end and plays with it.
        goal: (pos) => catGoal(b, this.play_, pos, this.goalOut),
      });
      const unit = handle?.units[0];
      if (handle && unit) {
        this.unit = unit;
        b.cat = unit;
        this.last.copy(unit.pos);
        handle.onDeath((u) => {
          if (u !== this.unit) return;
          // He goes in a puff of wool, wherever he stood.
          this.fluff.burst(this.v2.set(u.pos.x, 0.5, u.pos.z), 14, 4, 1.2);
          this.endAt = Math.min(this.endAt, this.time + TAIL);
          if (b.cat === u) b.cat = null;
          this.play_.playing = false;
        });
      }
    }

    // --- While he lives: tufts where he runs. Without a unit on this screen: a ball of wool rolls at the enemy and bursts. ---
    if (this.spawned) {
      const u = this.unit;
      if (u && u.alive) {
        const moved = Math.hypot(u.pos.x - this.last.x, u.pos.z - this.last.z);
        this.last.copy(u.pos);
        if (moved > 1e-4) {
          this.stepClock += dt;
          if (this.stepClock >= 0.14) {
            this.stepClock = 0;
            this.fluff.burst(this.v1.set(u.pos.x, 0.08, u.pos.z), 1, 0.7, 0.6, 0.2);
          }
        }
      } else if (!u && !ctx.summon) {
        this.roll(t - SPAWN_T);
      }
    }

    if (this.popAt >= 0) {
      const a = t - this.popAt, sp = StarBurst.pop(a, 0.05, 0.2);
      this.star.set(this.popPos, 2 * Math.max(sp.scale, MIN), sp.opacity, a * 3);
    }
    this.shake *= Math.exp(-dt * 10);
  }

  /** The look when this screen has no unit: a ball of wool rolls to the enemy, paying out its thread, and bursts there. */
  private roll(a: number) {
    const k = a / ROLL_SECONDS;
    if (k >= 1) {
      if (!this.rolled) {
        this.rolled = true;
        this.balls.hide(0);
        this.thread.hide();
        this.fluff.burst(this.v1.set(this.foe.x, 0.5, this.foe.z), 14, 4.5, 1.2);
        this.endAt = Math.min(this.endAt, this.time + TAIL);
      }
      return;
    }
    const u = easeOut(k);
    this.v1.lerpVectors(this.spot, this.foe, u).setY(0.35);
    this.balls.place(0, this.v1, 0.4, a * 18, a * 9);
    strandPoints(this.spot, this.foe, SEGS, this.pts, u);
    for (const p of this.pts) p.y = Math.max(0.12, p.y * 0.4);
    this.thread.set(this.pts);
  }
}

export const mrBiscuitModule: EffectModule = {
  label: 'mr biscuit',
  category: 'hero: yarn',
  // `enemies` (as Homunculus): every enemy, up to 10, is in `targets`. The AI casts a summon by its own rule (the enemy within
  // about 10 m), not by this radius.
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new MrBiscuitFx(),
  // The cat's hits are decided by touch (`projectile`), so there is no zone to show.
  telegraphs: () => [],
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as MrBiscuitFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MrBiscuitFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'hp', 10, 400, 10);
    f.add(s, 'speed', 1, 8, 0.5);
  },
};
