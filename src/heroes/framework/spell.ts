import * as THREE from 'three';
import type { Enemy } from '../../effects/common';
import { boltWidth } from '../../effects/projectile';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape, type TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import type { Emitter } from '../../emitter';
import type { Hit, Look, Move, Num, P, SpellDef } from './blocks';

type Bolt = ReturnType<NonNullable<CastContext['projectile']>>;

/**
 * The block runner: plays a spell's rules (`blocks.ts`) at their moments and tells its look. It is the `Effect` the engine
 * knows (one per spell label, played again for every cast), so every hook of the engine keeps working: the context it is
 * given (`ctx.projectile`, `ctx.hit`, `ctx.moveCaster`, live `ctx.enemies`), the danger zones (built here from the same
 * shape and times as the hit), the tool page's slider and camera.
 *
 * It makes no three.js object and rolls no dice (the fight's dice also name three's objects, so one more object or roll in
 * mid-fight is another fight): the group is made first, then the look makes its own, in its own order, as before.
 */
export class Cast<S, K extends string = never> implements Effect {
  readonly group = new THREE.Group();
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;
  /** The tool page's numbers: the damage, the spell's `tune` sliders by name, and its loop. */
  readonly settings: { damage: number; loop: boolean } & Record<K, number>;

  /** The last cast's context (null until the first). */
  ctx: CastContext | null = null;
  /** The hero's own state for this cast (`def.state`). */
  state: S;
  /** Where the caster stood at the cast (on the ground; the sender's spot online) and the aim's direction. */
  readonly from = new THREE.Vector3();
  readonly dir = new THREE.Vector3(0, 0, -1);
  /** Seconds since play(). */
  time = 0;
  /** A bolt spell's bolt, once released. */
  bolt: Bolt | null = null;
  released = false;
  /** A bolt stopped (`on.stop` ran), and whether in an enemy. */
  stopped = false;
  hitSomething = false;
  /** Circles: their centres at the cast; landed; which still burned. */
  centres: readonly P[] = [];
  impacted = false;
  /** A sure hit: the chosen enemy (null if none) and where they stood at the cast (on the ground); whether it landed. */
  target: Enemy | null = null;
  readonly spot = new THREE.Vector3();
  landed = false;
  /** A zone: its shape (made at the cast); circles and zones: whom the impact hit. */
  area: TelegraphShape | null = null;
  caught: Enemy[] = [];
  /** The aim's yaw (or the caster's facing, with `facing`). */
  yaw = 0;
  lit: readonly boolean[] = [];
  /** A move: the spot asked for and then where the engine put her; how far along the aim she got (a lane's or a bolt's length until then). */
  readonly landing = new THREE.Vector3();
  reach = 0;
  /** The engine moved her this cast (there is no `moveCaster` on the other screen online). */
  moved = false;
  readonly look: Look<S, K>;
  private endT: number;
  private struck = new Set<Enemy>();

  constructor(readonly def: SpellDef<S, K>) {
    const tuned = {} as Record<K, number>;
    for (const k in def.tune) tuned[k] = def.tune[k][0];
    const base: Record<string, number | boolean> = def.noDamage ? {} : { damage: def.rules.hit.damage };
    Object.assign(base, tuned);
    if (!def.noLoop) base.loop = false;
    this.settings = base as { damage: number; loop: boolean } & Record<K, number>;
    this.state = def.state();
    this.endT = def.seconds;
    this.look = new def.look(this.group, this);
    this.reset();
  }

  get duration() {
    return this.endT;
  }

  /** The look plays on: the effect lasts until `until` s after play() (this cast only). */
  extend(until: number) {
    this.endT = Math.max(this.endT, until);
  }

  /** Seconds after play() of the release, or of circles' (or a sure hit's) impact. */
  get impactTime() {
    const r = this.def.rules;
    return r.windup + (r.shape.kind === 'circle' || r.shape.kind === 'target' || r.shape.kind === 'zone' ? r.delay ?? 0 : 0);
  }

  /** A number of the rules, now: a plain one, or the tool page's slider of that name. */
  num(v: Num<K>): number {
    const tuned = this.settings as Record<K, number>;
    return typeof v === 'number' ? v : typeof v === 'function' ? v(tuned) : tuned[v];
  }

  /** The engine's hit from the rules' `Hit`: only the fields given, `from` the shape's default unless the hit says. */
  hitOptions(h: Hit<K> = this.def.rules.hit, from?: THREE.Vector3): HitOptions {
    const o: HitOptions = { damage: h.none || this.def.noDamage ? 0 : this.settings.damage, knock: this.num(h.knock) };
    if (h.pull !== undefined) o.pull = this.num(h.pull);
    const at = h.from === 'none' ? undefined : h.from === 'caster' ? this.from.clone() : from;
    if (at) o.from = at;
    o.color = h.color;
    if (h.status) o.status = { kind: h.status.kind, seconds: this.num(h.status.seconds) };
    if (h.projectile) o.projectile = true;
    return o;
  }

  cast(ctx: CastContext) {
    const r = this.def.rules, sh = r.shape;
    this.ctx = ctx;
    this.state = this.def.state();
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.yaw = r.facing ? ctx.caster.group.rotation.y : ctx.aim;
    this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.reach = sh.kind === 'lane' ? sh.length : sh.kind === 'bolt' ? sh.range : 0;
    if (sh.kind === 'target') {
      this.target = ctx.targets[0] ?? null;
      this.spot.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    }
    r.on?.cast?.(this);
    this.centres = sh.kind === 'circle' ? sh.at(this) : [];
    this.area = sh.kind === 'zone' ? sh.area(this) : null;
    this.look.cast?.(this);
  }

  play() {
    this.reset();
    this.playing = true;
    const m = this.def.rules.move;
    if (m?.at === 'play') this.move(m);
    this.look.played?.(this);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.bolt = null;
    this.released = this.stopped = this.hitSomething = this.impacted = this.landed = this.moved = false;
    this.caught = [];
    this.lit = [];
    this.struck.clear();
    this.endT = this.def.seconds;
    this.look.reset?.(this);
  }

  /** The caster moves (where there is a `moveCaster`: not on the other screen online). */
  private move(m: Move<S, K>) {
    const ctx = this.ctx;
    if (!ctx?.moveCaster) return;
    if (m.to === 'end') this.landing.copy(this.from).addScaledVector(this.dir, this.reach);
    else {
      const p = m.to(this);
      if (!p) return;
      this.landing.set(p.x, 0, p.z);
    }
    this.landing.copy(ctx.moveCaster(this.landing, m.seconds)).setY(0);
    this.moved = true;
    this.reach = Math.max(0.5, this.landing.distanceTo(this.from));
  }

  private release() {
    const r = this.def.rules, sh = r.shape, ctx = this.ctx;
    this.released = true;
    this.look.releasing?.(this);
    r.on?.release?.(this);
    if (r.move?.at === 'release') this.move(r.move);
    if (sh.kind === 'bolt' && ctx?.projectile) {
      this.bolt = ctx.projectile({
        from: this.from.clone(), dir: this.dir.clone(), speed: sh.speed, range: sh.range, radius: sh.radius,
        hit: this.hitOptions(),
      });
      this.bolt.onHit((target, at) => {
        this.hitSomething = true;
        this.stop(at.x, at.z, true, target);
      });
    }
    this.look.released?.(this);
  }

  /** A bolt stops at (x, z): once a cast. */
  private stop(x: number, z: number, hit: boolean, who: Enemy | null = null) {
    if (this.stopped) return;
    this.stopped = true;
    this.def.rules.on?.stop?.(this, x, z, hit);
    this.look.stopped?.(this, x, z, who);
  }

  /** Circles land: every enemy inside one that still burns, on its live position, is hit once. */
  private impact() {
    const r = this.def.rules, sh = r.shape, ctx = this.ctx;
    this.impacted = true;
    if (sh.kind === 'target') return this.strike();
    if (sh.kind === 'zone') return this.judge();
    if (!ctx || sh.kind !== 'circle') return;
    this.look.impacting?.(this);
    const centres = this.centres;
    const lit = sh.still ? sh.still(this, centres) : centres.map(() => true);
    this.lit = lit;
    const live = centres.filter((_, i) => lit[i]);
    if (live.length) {
      for (const en of ctx.enemies?.() ?? ctx.targets) {
        const p = en.group.position;
        const at = live.find((q) => Math.hypot(p.x - q.x, p.z - q.z) <= sh.radius);
        if (!at) continue;
        ctx.hit(en, this.hitOptions(r.hit, new THREE.Vector3(at.x, 0, at.z)));
        this.caught.push(en);
      }
    }
    r.on?.impact?.(this, live.length > 0);
    this.look.impact?.(this, lit);
    if (r.move?.at === 'impact') this.move(r.move);
  }

  /** A sure hit lands on the chosen enemy (live), if it still stands inside its circle when the rules ask that. */
  private strike() {
    const r = this.def.rules, sh = r.shape, ctx = this.ctx;
    if (sh.kind !== 'target') return;
    const tg = this.target, p = tg?.group.position;
    const landed = !!ctx && !!tg && (sh.inside === undefined || Math.hypot(p!.x - this.spot.x, p!.z - this.spot.z) <= sh.inside);
    this.landed = landed;
    this.look.impacting?.(this);
    if (landed) ctx!.hit(tg!, this.hitOptions());
    r.on?.impact?.(this, landed);
    this.look.impact?.(this, [landed]);
    if (r.move?.at === 'impact') this.move(r.move);
  }

  /** A zone is judged: every enemy inside it now (live) is hit once, from where she stood unless the hit says. */
  private judge() {
    const r = this.def.rules, ctx = this.ctx, area = this.area;
    this.look.impacting?.(this);
    if (ctx && area) {
      for (const en of ctx.enemies?.() ?? ctx.targets) {
        const q = en.group.position;
        if (!insideTelegraph(area, q.x, q.z)) continue;
        ctx.hit(en, this.hitOptions(r.hit, this.from.clone()));
        this.caught.push(en);
      }
    }
    r.on?.impact?.(this, this.caught.length > 0);
    this.look.impact?.(this, [this.caught.length > 0]);
    if (r.move?.at === 'impact') this.move(r.move);
  }

  /** A lane's front, `t` s after play(): how far along it the hit has reached. */
  front(t: number) {
    const r = this.def.rules, sh = r.shape;
    if (sh.kind !== 'lane') return 0;
    const k = Math.min(1, (t - r.windup) / (r.move?.seconds ?? 1));
    const even = k * this.reach;
    return sh.front ? sh.front(this, even) : even;
  }

  /** A lane: whoever the front has passed inside it is hit, once. */
  private sweep(t: number) {
    const r = this.def.rules, sh = r.shape, ctx = this.ctx;
    if (!ctx || sh.kind !== 'lane') return;
    const front = this.front(t);
    for (const en of ctx.enemies?.() ?? ctx.targets) {
      if (this.struck.has(en)) continue;
      const dx = en.group.position.x - this.from.x, dz = en.group.position.z - this.from.z;
      const along = dx * this.dir.x + dz * this.dir.z;
      const perp = Math.abs(dx * this.dir.z - dz * this.dir.x);
      if (along < 0 || along > Math.min(front, sh.length) || perp > sh.width / 2) continue;
      this.struck.add(en);
      ctx.hit(en, this.hitOptions(r.hit, this.from.clone()));
      this.look.struck?.(this, en);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) {
      this.look.idle?.(dt);
      return;
    }
    this.look.tick?.(dt);
    this.time += dt;
    const t = this.time;
    if (t >= this.endT) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const r = this.def.rules, sh = r.shape;
    if (!this.released && t >= r.windup) this.release();
    // A bolt that died with no hit (its full reach, or a wall) stops a step short of where it died.
    if (this.bolt && !this.bolt.alive && !this.hitSomething && !this.stopped) {
      this.stop(this.bolt.pos.x - this.dir.x * 0.2, this.bolt.pos.z - this.dir.z * 0.2, false);
    }
    this.look.frame?.(this, t, dt);
    if ((sh.kind === 'circle' || sh.kind === 'target' || sh.kind === 'zone') && !this.impacted && t >= r.windup + (r.delay ?? 0)) this.impact();
    if (sh.kind === 'lane' && this.released && t <= r.windup + (r.move?.seconds ?? 0) + (sh.late ?? 0)) this.sweep(t);
    r.on?.frame?.(this, t, dt);
    this.look.after?.(this, t, dt);
  }

  /** The danger zones: the rules' own shape and times (the same the hit uses). */
  zones(): TelegraphSpec[] {
    const ctx = this.ctx, r = this.def.rules, sh = r.shape, warn = r.warn ?? 0.04;
    if (!ctx) return [];
    const a = this.from, d = this.dir;
    switch (sh.kind) {
      case 'bolt':
        // shown from the warning, armed at the release, until the bolt has flown its reach; the bolt's own hit is the dodge check
        return [{
          shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + d.x * sh.range, z2: a.z + d.z * sh.range, width: boltWidth(sh.radius) },
          start: warn, impact: r.windup, until: r.windup + sh.range / sh.speed,
        }];
      case 'circle':
        return this.centres.map((p) => ({ shape: { kind: 'circle', x: p.x, z: p.z, radius: sh.radius }, start: warn, impact: r.windup + (r.delay ?? 0) }));
      case 'lane':
        return [{
          shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + d.x * sh.length, z2: a.z + d.z * sh.length, width: sh.width },
          start: warn, impact: r.windup, until: r.windup + (r.move?.seconds ?? 0),
        }];
      case 'target':
        return [{ shape: { kind: 'circle', x: this.spot.x, z: this.spot.z, radius: sh.mark }, start: warn, impact: r.windup + (r.delay ?? 0) }];
      case 'zone': {
        if (!this.area) return [];
        const impact = r.windup + (r.delay ?? 0);
        return [sh.until === undefined ? { shape: this.area, start: warn, impact } : { shape: this.area, start: warn, impact, until: impact + sh.until }];
      }
    }
  }
}

/** A cast whose look has a full-screen effect (the engine reads `screen` every frame; `noScreen` spells have no such field). */
class ScreenCast<S, K extends string = never> extends Cast<S, K> {
  get screen() {
    return this.look.screen;
  }
}

/** A spell from its blocks: the `EffectModule` the engine and the tool page know. */
export function spell<S, K extends string = never>(def: SpellDef<S, K>): EffectModule {
  return {
    label: def.label,
    category: def.category,
    targeting: def.targeting,
    create: () => (def.noScreen ? new Cast(def) : new ScreenCast(def)),
    telegraphs: (effect) => (effect as Cast<S, K>).zones(),
    bloom: def.bloom,
    frameCamera(camera, controls, effect) {
      const c = effect as Cast<S, K>;
      if (c.ctx) frameCast(camera, controls, c.ctx, def.frame);
    },
    buildGui(f, effect) {
      const s = (effect as Cast<S, K>).settings as unknown as Record<string, number>;
      if (!def.noLoop) f.add(s, 'loop');
      if (!def.noDamage) f.add(s, 'damage', 1, def.maxDamage, 1);
      for (const k in def.tune) {
        const [, min, max, step] = def.tune[k];
        f.add(s, k, min, max, step);
      }
    },
  };
}
