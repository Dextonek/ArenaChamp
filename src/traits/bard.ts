import type { Trait } from './types';

/** The beat: a pulse every `BEAT` seconds of round time. A spell cast within `TUNE` seconds of a pulse is in tune. */
export const BEAT = 1.2;
export const TUNE = 0.2;
/** In tune: the spell's power, the seconds off its cooldown. */
export const TUNE_POWER = 1.3;
export const TUNE_CD = 1;
/** A stun, a silence or a hit of this much breaks the beat for `BROKEN_SECONDS`. */
export const BREAK_DAMAGE = 50;
export const BROKEN_SECONDS = 2;
/** Rising Chorus: how long it runs, and what each in-tune cast gives while it does. */
export const CHORUS_SECONDS = 3;
export const CHORUS_HASTE = { amount: 0.25, seconds: 1.5 };
export const CHORUS_SHIELD = { amount: 30, seconds: 3 };
/** Duet: the silence an in-tune spell adds to a hit inside the ring. */
export const DUET_SILENCE = 0.5;

const GOLD = '#ffd24a';

/**
 * Signed seconds from `time` to the nearest pulse (-0.6 .. 0.6): negative before a pulse, positive after. A pure function
 * of round time, so both screens agree on it.
 */
export function beatPhase(time: number): number {
  const k = time / BEAT;
  return (k - Math.round(k)) * BEAT;
}

/** Is `time` within 0.2 s of a pulse? (A broken beat is the trait's business: see `Trait.castMods`.) */
export function inTune(time: number): boolean {
  return Math.abs(beatPhase(time)) <= TUNE;
}

/**
 * Whether Cantor's last cast was in tune, keyed by his figure. `afterCast` writes it on his own screen, `ownChanged` on the
 * other one, so his effects read the same value at the cast (silence on Q, a longer charm on W) on both.
 */
export const cantorTuned = new WeakMap<object, boolean>();

/**
 * The round time of Cantor's side, keyed by his figure. `ring` writes it every frame on both screens (it is the one hook
 * that runs on both), so an effect can pulse on the same beat as the ring under him. Missing in the VFX tool.
 */
export const cantorClock = new WeakMap<object, number>();

/**
 * Duet's state, keyed by his figure. The effect owns `live` (true while the ring holds: from its close to its end, on both
 * screens) and sets `collapsed` when the enemy was outside at the close; the trait's `tick` turns that into the cooldown
 * refund once and clears it.
 */
export interface DuetState { live: boolean; collapsed: boolean }
export const cantorDuets = new WeakMap<object, DuetState>();

const broken = (t: { time: number; mem: Record<string, number> }) => t.time < (t.mem.brokenUntil ?? 0);

/**
 * Cantor (support), kits v5. Passive On the Beat: a beat pulses under him every 1.2 s of round time (`beatPhase`, `inTune`).
 * A spell cast within 0.2 s of a pulse is in tune: +30% power (`castMods`) and 1 s off its cooldown (`cooldown`); `afterCast`
 * records it for the effects (`cantorTuned`, `show('tuned')`). A stun, a silence or a hit of 50 or more breaks the beat for
 * 2 s (`taken`, on his own client; `tick` shows `beatoff`): nothing is in tune then and the ring under him is a flat grey.
 * Rising Chorus (E) opens `chorusUntil` for 3 s: each in-tune cast in it gives +25% speed for 1.5 s and a 30 shield (the engine
 * keeps the larger, nothing stacks). Duet (R) cannot be cast while the enemy is charmed (`canCast`); if its ring closed on
 * nobody, `tick` gives back half its cooldown (the effect sets `cantorDuets.collapsed`); inside the ring `dealt` adds a 0.5 s
 * silence to an in-tune spell hit.
 */
export const bardTrait: Trait = {
  // The CPU waits for the beat about 70% of the time: which beats is fixed by the round clock, so it does not flicker.
  aiHold(t, _slot) {
    if (broken(t) || inTune(t.time)) return false;
    return Math.floor(t.time / 1.2) % 10 < 7;
  },
  passive: { name: 'On the Beat', blurb: 'A beat pulses under him every 1.2 s. A spell cast within 0.2 s of a pulse is in tune: +30% effect and 1 s off its cooldown. A stun, a silence or a hit of 50 or more breaks the beat for 2 s.' },
  ownLook: {
    chorus: { color: GOLD, shape: 'gem' },
  },
  ownChanged(t, name, n) {
    if (name === 'tuned') cantorTuned.set(t.self(), n > 0);
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'note' },
  canCast(t, slot) {
    if (slot !== 3) return null;
    const foe = t.enemy();
    return foe && t.status(foe)?.charmed ? 'The enemy is charmed' : null;
  },
  castMods(t) {
    if (broken(t) || !inTune(t.time)) {
      t.mem.tuned = 0;
      return {};
    }
    t.mem.tuned = 1;
    t.say('IN TUNE', '#ffe58a');
    return { power: TUNE_POWER };
  },
  cooldown: (t, slot, base) => (t.mem.tuned ? base - TUNE_CD : base),
  afterCast(t, slot) {
    const tuned = !!t.mem.tuned;
    t.mem.tuned = 0;
    cantorTuned.set(t.self(), tuned);
    // 0 first, so a repeated 1 still reaches the other screen.
    t.show('tuned', 0);
    if (tuned) t.show('tuned', 1);
    if (tuned && t.time < (t.mem.chorusUntil ?? 0)) {
      t.buff('haste', CHORUS_HASTE.amount, CHORUS_HASTE.seconds);
      t.shield(CHORUS_SHIELD.amount, CHORUS_SHIELD.seconds);
    }
    if (slot === 2) {
      t.mem.chorusUntil = t.time + CHORUS_SECONDS;
      t.show('chorus', 0);
      t.show('chorus', 1);
    }
  },
  taken(t, hit) {
    if (hit.blocked) return;
    const kinds = [hit.opts.status?.kind, hit.mods.status?.kind];
    const breaks = kinds.includes('stun') || kinds.includes('silence') || kinds.includes('knockup') || hit.damage >= BREAK_DAMAGE;
    if (breaks) t.mem.brokenUntil = t.time + BROKEN_SECONDS;
  },
  dealt(t, hit) {
    // Inside Duet's ring, an in-tune spell also silences (not the ring's own pulses, not a hit with a status of its own).
    if (hit.kind !== 'spell' || hit.slot === 3 || !hit.victimIsHero || hit.opts.status) return;
    if (!cantorTuned.get(t.self()) || !cantorDuets.get(t.self())?.live) return;
    hit.opts.status = { kind: 'silence', seconds: DUET_SILENCE };
  },
  tick(t) {
    t.show('beatoff', broken(t) ? 1 : 0);
    if (t.mem.chorusUntil && t.time >= t.mem.chorusUntil) {
      t.mem.chorusUntil = 0;
      t.show('chorus', 0);
    }
    const d = cantorDuets.get(t.self());
    if (d?.collapsed) {
      // The ring closed on nobody: half of Duet's cooldown comes back, once.
      d.collapsed = false;
      t.setCooldown(3, t.cooldownLeft(3) / 2);
    }
  },
  ring(t) {
    cantorClock.set(t.self(), t.time);
    if (t.own('beatoff') > 0) return { radius: 1.2, color: '#8a8494', opacity: 0.45 };
    // The window: the ring swells from 1.0 to 1.6 over the 0.2 s before a pulse and falls back over the 0.2 s after it.
    const k = Math.max(0, 1 - Math.abs(beatPhase(t.time)) / TUNE);
    if (k <= 0) return { radius: 1.0, color: '#b0508f', opacity: 0.3 };
    return { radius: 1.0 + 0.6 * k, color: GOLD, opacity: 0.5 + 0.5 * k };
  },
  badge: (t) => (t.own('beatoff') > 0 ? 'OFF' : inTune(t.time) ? 'TUNE' : ''),
};
