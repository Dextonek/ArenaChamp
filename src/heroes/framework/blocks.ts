import type { Enemy } from '../../effects/common';
import type { TargetingSpec } from '../../effects/targeting';
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
 */

/** A point on the ground. */
export interface P { x: number; z: number }

export type Shape<S> =
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
  | { kind: 'circle'; radius: number; at: (c: Cast<S>) => readonly P[]; still?: (c: Cast<S>, centres: readonly P[]) => boolean[] }
  /**
   * A lane from where she stood along the aim, `length` by `width`, swept by a front from her release on: whoever the front
   * has passed inside it (on its live position) is hit, once. The front runs evenly over the move's `seconds` to the reach the
   * move got (`c.reach`); `front` may change it (Firebird: her beak leads with her). It keeps hitting `late` seconds after.
   */
  | { kind: 'lane'; length: number; width: number; late?: number; front?: (c: Cast<S>, even: number) => number };

/** What one hit does. The damage is the spell's `settings.damage` (the tool page's slider), first set from `damage`. */
export interface Hit {
  damage: number;
  knock: number;
  /** The colour of the hit's flash and number (css). */
  color: string;
}

/**
 * A move of the caster (`ctx.moveCaster`; there is none on the other screen of a network duel, where her client streams it):
 * at the cast's `play` (a flight that starts at once) or at the `release`, to `to` (`'end'`: the far end of the lane or the
 * bolt's reach; a function: a spot of the hero's own, or null for no move), in `seconds`. The engine clamps the spot into the
 * ring and out of the walls; where she really lands is `c.landing`, and how far along the aim that is, `c.reach`.
 */
export interface Move<S> {
  at: 'play' | 'release';
  to: 'end' | ((c: Cast<S>) => P | null);
  seconds: number;
}

export interface Rules<S> {
  /** Seconds from the cast to the release (the bolt leaves, she takes off). She is rooted until the latest impact. */
  windup: number;
  shape: Shape<S>;
  /** Circles: seconds from the release to the impact (their fuse). */
  delay?: number;
  hit: Hit;
  move?: Move<S>;
  /** Seconds after the cast when the danger zone appears (default 0.04). */
  warn?: number;
  /** The hero's own hooks, at the moments the rules say. */
  on?: {
    /** At the cast, after `c.from` and `c.dir` are set (a passive's cast number, which ember to fly to ...). */
    cast?(c: Cast<S>): void;
    /** At the release, before the move. */
    release?(c: Cast<S>): void;
    /** A bolt stopped at (x, z): in an enemy (`hit`), at a wall or at its full reach. Once a cast. */
    stop?(c: Cast<S>, x: number, z: number, hit: boolean): void;
    /** Circles: after their hits. */
    impact?(c: Cast<S>): void;
  };
}

/**
 * The look: today's drawing code, told the moments. It is made after the spell's group (its objects in its own order, as
 * before) and adds them to `group`. Every method is optional. Per frame, after `tick`: the release and a bolt's stop (their
 * moments), `frame`, the impact of circles (`impact`), the sweep of a lane (`struck`), then `after`.
 */
export interface Look<S> {
  /** A full-screen effect (impact frames ...), read every frame like the shake. */
  readonly screen?: import('../../effects/parts/screen').ScreenFx;
  reset?(c: Cast<S>): void;
  cast?(c: Cast<S>): void;
  /** At play(), after a move made at play. */
  played?(c: Cast<S>): void;
  /** Every frame while it plays, before the clock moves (particles age). */
  tick?(dt: number): void;
  released?(c: Cast<S>): void;
  stopped?(c: Cast<S>, x: number, z: number): void;
  frame?(c: Cast<S>, t: number, dt: number): void;
  /** Circles landed; `lit`: which of them still burned. */
  impact?(c: Cast<S>, lit: readonly boolean[]): void;
  /** A lane's front struck someone. */
  struck?(c: Cast<S>, who: Enemy): void;
  after?(c: Cast<S>, t: number, dt: number): void;
}

/** A spell: its label and look in the tool page and the engine, its rules, its look. */
export interface SpellDef<S> {
  /** The effect's label (the card's), and the tool page's group. */
  label: string;
  category: string;
  targeting: TargetingSpec;
  /** Seconds the effect plays (the look may make it longer: `c.extend`). */
  seconds: number;
  /** The hero's own state for one cast (reset at each cast). */
  state: () => S;
  rules: Rules<S>;
  look: new (group: import('three').Group, c: Cast<S>) => Look<S>;
  bloom: BloomSettings;
  /** How far the tool page's camera stands back from the cast (`frameCast`). */
  frame: number;
  /** The tool page's damage slider's top. */
  maxDamage: number;
}
