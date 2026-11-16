import type { Enemy } from '../../effects/common';
import type { StatusKind } from '../../effects/status';
import type { TargetingSpec } from '../../effects/targeting';
import type { TelegraphShape } from '../../effects/telegraph';
import type { BloomSettings } from '../../presets';
import type { Cast } from './spell';

/**
 * The spell building blocks (docs/pipeline/hero-framework.md, section 4): a spell's RULES as a short description, numbers,
 * shape and timing, that the block runner (`spell.ts`) plays. Rules only: no three.js object is made and no dice are rolled
 * here, so a spell moved onto the blocks plays the same fight. The look (particles, meshes, the picture's timing) is the
 * spell's own code, told the moments it needs (`Look`).
 *
 * Only the blocks a moved hero needs are built; each new one comes with the hero that needs it. Anka's four use:
 * - a bolt (Ember Quill),
 * - circles that land after a fuse (Fan the Flames, at her embers; Ember Flight, at the ember she flies to),
 * - a lane swept by a moving front (Firebird),
 * - a move of the caster (Ember Flight's flight, Firebird's crossing),
 * and hooks into her passive: which cast this is, where an ember is laid or spent, which ember she flies to.
 * The trial of 2026-11-16 (docs/pipeline/hero-framework/blocks-trial.html) added, for Sefu and Professor Puff:
 * - a sure hit on the chosen enemy (`target`),
 * - an area judged once (`zone`: a circle round him, a cone or a strip in front of him; the danger zone IS the hit's shape),
 * - `facing` (a quick spell goes the way he faces, not the aim), a per-frame rules hook (`on.frame`), settings without a
 *   damage or a loop slider (as some old files had),
 * - numbers the tool page tunes (`tune`, `Num`), and a hit's pull, status, `from` and `projectile`,
 * - the look's moments before the rules (`releasing`, `impacting`) and its ticking while idle (`idle`), so the dice keep
 *   their order where the old file drew first.
 */

/**
 * A number of the rules: a plain number, the name of one of the spell's `tune` sliders, or a number worked out from them
 * (read at the moment it is used).
 */
export type Num<K extends string> = number | K | ((s: Readonly<Record<K, number>>) => number);

/** A slider of the tool page: the start value, its least, its most and its step. */
export type Slider = readonly [value: number, min: number, max: number, step: number];

/** A point on the ground. */
export interface P { x: number; z: number }

export type Shape<S, K extends string = never> =
  /**
   * A skillshot (`ctx.projectile`): released at `windup` from where she stood at the cast, along the aim; it hits the first
   * enemy it touches. It STOPS where it hits, at a wall or at its full reach (`on.stop`, a step short of where it died).
   */
  | { kind: 'bolt'; speed: number; range: number; radius: number }
  /**
   * Circles that land at `windup + delay`: `at` gives their centres at the cast (the same records on both screens). At the
   * impact, `still` may put some out (an ember stamped meanwhile); every enemy inside a circle that still burns, on its LIVE
   * position (`ctx.enemies`), is hit once, from the first circle it stands in.
   */
  | { kind: 'circle'; radius: number; at: (c: Cast<S, K>) => readonly P[]; still?: (c: Cast<S, K>, centres: readonly P[]) => boolean[] }
  /**
   * A lane from where she stood along the aim, `length` by `width`, swept by a front from her release on: whoever the front
   * has passed inside it (on its live position) is hit, once. The front runs evenly over the move's `seconds` to the reach the
   * move got (`c.reach`); `front` may change it (Firebird: her beak leads with her). It keeps hitting `late` seconds after.
   */
  | { kind: 'lane'; length: number; width: number; late?: number; front?: (c: Cast<S, K>, even: number) => number }
  /**
   * A sure hit on the chosen enemy (`targeting: { mode: 'enemy' }`; the engine checked the range and the sight at the cast):
   * it lands at `windup + delay` on the enemy's live position. The danger zone is a circle of `mark` m where they stood at the
   * cast. With `inside`, they must still stand within that many metres of that spot, or it lands on nothing.
   */
  | { kind: 'target'; mark: number; inside?: number }
  /**
   * An area judged once, at `windup + delay`: every enemy inside `area` then (live positions, the engine's own
   * `insideTelegraph`) is hit, from where she stood at the cast unless the hit says. `area` is made at the cast and is also
   * the danger zone, shown from `warn` to the impact (and `until` seconds after it).
   */
  | { kind: 'zone'; area: (c: Cast<S, K>) => TelegraphShape; until?: number };

/**
 * What one hit does. The damage is the spell's `settings.damage` (the tool page's slider), first set from `damage`; with
 * `none` it deals 0 whatever the slider says (a seal whose damage lands later, in a hook). Only the fields given are passed on.
 */
export interface Hit<K extends string = never> {
  damage: number;
  none?: true;
  knock: Num<K>;
  /** The colour of the hit's flash and number (css). */
  color: string;
  /** Metres it drags the enemy toward the caster (`knock: 0` with it). */
  pull?: Num<K>;
  status?: { kind: StatusKind; seconds: Num<K> };
  /** The range and the sight were the check (a sure hit): the duel's zone filters let it through. */
  projectile?: true;
  /**
   * Where the knock comes from: a circle's centre (circles' default), where she stood at the cast (lanes' default), or not
   * given: the engine's own, the caster (bolts' and sure hits' default).
   */
  from?: 'centre' | 'caster' | 'none';
}

/**
 * A move of the caster (`ctx.moveCaster`; there is none on the other screen of a network duel, where her client streams it):
 * at the cast's `play` (a flight that starts at once) or at the `release`, to `to` (`'end'`: the far end of the lane or the
 * bolt's reach; a function: a spot of the hero's own, or null for no move), in `seconds`. The engine clamps the spot into the
 * ring and out of the walls; where she really lands is `c.landing`, and how far along the aim that is, `c.reach`.
 */
export interface Move<S, K extends string = never> {
  /** `impact`: right after a zone's, a circle's or a sure hit's impact (a push, then away). */
  at: 'play' | 'release' | 'impact';
  to: 'end' | ((c: Cast<S, K>) => P | null);
  seconds: number;
}

export interface Rules<S, K extends string = never> {
  /** Seconds from the cast to the release (the bolt leaves, she takes off). She is rooted until the latest impact. */
  windup: number;
  shape: Shape<S, K>;
  /** Circles and sure hits: seconds from the release to the impact (their fuse). */
  delay?: number;
  hit: Hit<K>;
  move?: Move<S, K>;
  /** Seconds after the cast when the danger zone appears (default 0.04). */
  warn?: number;
  /** The spell goes the way the caster faces (`caster.group.rotation.y`), not the aim: `c.dir` and `c.yaw` follow it. */
  facing?: true;
  /** The hero's own hooks, at the moments the rules say. */
  on?: {
    /** At the cast, after `c.from` and `c.dir` are set (a passive's cast number, which ember to fly to ...). */
    cast?(c: Cast<S, K>): void;
    /** At the release, before the move. */
    release?(c: Cast<S, K>): void;
    /** A bolt stopped at (x, z): in an enemy (`hit`), at a wall or at its full reach. Once a cast. */
    stop?(c: Cast<S, K>, x: number, z: number, hit: boolean): void;
    /** Circles, a zone: after their hits (`c.caught`). A sure hit: after it (`hit`: whether it landed on someone). */
    impact?(c: Cast<S, K>, hit: boolean): void;
    /** Every frame while it plays, after the impact and the sweep, before the look's `after` (a follow-up of the hero's own). */
    frame?(c: Cast<S, K>, t: number, dt: number): void;
  };
}

/**
 * The look: today's drawing code, told the moments. It is made after the spell's group (its objects in its own order, as
 * before) and adds them to `group`. Every method is optional. Per frame, after `tick`: the release and a bolt's stop (their
 * moments), `frame`, the impact of circles (`impact`), the sweep of a lane (`struck`), then `after`.
 */
export interface Look<S, K extends string = never> {
  /** A full-screen effect (impact frames ...), read every frame like the shake. */
  readonly screen?: import('../../effects/parts/screen').ScreenFx;
  reset?(c: Cast<S, K>): void;
  cast?(c: Cast<S, K>): void;
  /** At play(), after a move made at play. */
  played?(c: Cast<S, K>): void;
  /** Every frame while it plays, before the clock moves (particles age). */
  tick?(dt: number): void;
  /** Every frame while it does NOT play (the old file aged its particles before it asked whether it played). */
  idle?(dt: number): void;
  /** At the release, before the rules (where the old file drew first: its dice before the bolt's). */
  releasing?(c: Cast<S, K>): void;
  released?(c: Cast<S, K>): void;
  /** A bolt stopped; `who`: the enemy it hit (null at a wall or its reach). */
  stopped?(c: Cast<S, K>, x: number, z: number, who: Enemy | null): void;
  frame?(c: Cast<S, K>, t: number, dt: number): void;
  /** Circles or a sure hit: at the impact, before the hits (where the old file drew first). */
  impacting?(c: Cast<S, K>): void;
  /** Circles landed; `lit`: which of them still burned (a sure hit: one, whether it landed). */
  impact?(c: Cast<S, K>, lit: readonly boolean[]): void;
  /** A lane's front struck someone. */
  struck?(c: Cast<S, K>, who: Enemy): void;
  after?(c: Cast<S, K>, t: number, dt: number): void;
}

/** A spell: its label and look in the tool page and the engine, its rules, its look. */
export interface SpellDef<S, K extends string = never> {
  /** The effect's label (the card's), and the tool page's group. */
  label: string;
  category: string;
  targeting: TargetingSpec;
  /** Seconds the effect plays (the look may make it longer: `c.extend`). */
  seconds: number;
  /** The hero's own state for one cast (reset at each cast). */
  state: () => S;
  rules: Rules<S, K>;
  /** More numbers the tool page tunes (the rules name them, `Num`), after the damage: kept in `settings` under their names. */
  tune?: Record<K, Slider>;
  /** No damage slider (the spell deals none, or its damage is a `tune` number): `settings` has no `damage`, hits deal 0. */
  noDamage?: true;
  /** No loop switch (the old file had none). */
  noLoop?: true;
  /** No `screen` field on the effect (the old file had none; the engine reads an absent one as none). */
  noScreen?: true;
  look: new (group: import('three').Group, c: Cast<S, K>) => Look<S, K>;
  bloom: BloomSettings;
  /** How far the tool page's camera stands back from the cast (`frameCast`). */
  frame: number;
  /** The tool page's damage slider's top. */
  maxDamage: number;
}
