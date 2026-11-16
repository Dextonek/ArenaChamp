/**
 * The fight's clock, in milliseconds: it moves only when the game steps (`step` in src/runtime.ts), by the step's own `dt`, so it
 * stands still while the game is paused, follows `vfx.step`, the simulator's stepped frames and the speed slider, and never runs
 * ahead through a frame hitch the game itself clamps. It never goes back (it is not the round's clock: a rule that stamps a
 * time keeps working across a new round, as it did on the wall clock).
 *
 * For the rules that heroes' spells and passives time themselves (a recast's window, an object's life, a deadline), which used
 * `performance.now()`: the wall clock runs on while the game does not (a hidden tab, a stepped fight). A look that only wants a
 * phase to wobble with may keep the wall clock.
 */
let ms = 0;

/** The fight clock now (ms). */
export function fightNow(): number {
  return ms;
}

/** The runtime's step moves the clock on, first thing (`dt` in seconds). */
export function advanceFightClock(dt: number) {
  ms += dt * 1000;
}
