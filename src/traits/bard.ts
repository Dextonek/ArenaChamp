import type { Trait, TraitView } from './types';

/** The beat: a pulse every `BEAT` seconds of round time. A spell cast within `TUNE` seconds of a pulse is on the beat. */
export const BEAT = 1.2;
export const TUNE = 0.25;
/** The Crescendo: its top, and what each step adds to a clean spell's power. */
export const CRESCENDO_MAX = 5;
export const CRESCENDO_POWER = 0.12;
/** A spell cast off the beat goes sour: this much of its power, no silence, no charm, no shield. */
export const SOUR_POWER = 0.25;
/** The Crescendo holds this many beats without a clean spell, then falls one step a beat. */
export const REST_BEATS = 3;
/** Resounding Chord at the top of the Crescendo also silences. */
export const CHORD_SILENCE = 0.5;
/** Siren Song spends the Crescendo: seconds of charm for each step. */
export const CHARM_PER = 0.25;
/** Rising Chorus spends the Crescendo: shield for each step and how long it lasts, and the speed it gives. */
export const CHORUS_SHIELD_PER = 15;
export const CHORUS_SHIELD_SECONDS = 3;
export const CHORUS_HASTE = { amount: 0.25, seconds: 1.5 };
/** How long Rising Chorus's gold rings play (the effect reads it). */
export const CHORUS_SECONDS = 3;
/** Duet: the silence a clean spell adds to a hit inside the ring. */
export const DUET_SILENCE = 0.5;

const GOLD = '#ffd24a';
const SOUR = '#8a8494';

/**
 * Signed seconds from `time` to the nearest pulse (-0.6 .. 0.6): negative before a pulse, positive after. A pure function
 * of round time, so both screens agree on it.
 */
export function beatPhase(time: number): number {
  const k = time / BEAT;
  return (k - Math.round(k)) * BEAT;
}

/** Is `time` on the beat (within `TUNE` of a pulse)? */
export function inTune(time: number): boolean {
  return Math.abs(beatPhase(time)) <= TUNE;
}

/** Which pulse `time` belongs to. */
const beatOf = (time: number) => Math.round(time / BEAT);

/**
 * Cantor's last cast, keyed by his figure, for his effects on both screens: was it on the beat, and at what Crescendo
 * (the charm of Siren Song, the silence of the Chord, gold or rose). `castMods` writes it on his own screen just before the
 * effect plays, `ownChanged` on the other one. Missing in the VFX tool, where the effects fall back to their own numbers.
 */
export interface CantorNote { clean: boolean; crescendo: number }
export const cantorNotes = new WeakMap<object, CantorNote>();

/**
 * The round time of Cantor's side, keyed by his figure. `ring` writes it every frame on both screens (it is the one hook
 * that runs on both), so an effect can pulse on the same beat as the ring under him. Missing in the VFX tool.
 */
export const cantorClock = new WeakMap<object, number>();

/**
 * Duet's state, keyed by his figure. The effect owns `live` (true while the ring holds: from its close to its end, on both
 * screens) and sets `collapsed` when the enemy was outside at the close; the trait's `tick` only clears that now (the
 * ultimate's cooldown is the least the game server allows, so nothing can be given back).
 */
export interface DuetState { live: boolean; collapsed: boolean }
export const cantorDuets = new WeakMap<object, DuetState>();

/** How the CPU plays him: it walks in until the enemy is this close, to stand about this far off. */
const AI_CHORD_REACH = 3.2;
const AI_CHORD_STAND = 2.6;

/** The spells that spend the Crescendo. */
const spends = (slot: number) => slot === 1 || slot === 2;

function setNote(t: TraitView, clean: boolean, crescendo: number) {
  cantorNotes.set(t.self(), { clean, crescendo });
  // 0 first, so the same note twice still reaches the other screen. 1: sour; 2 and up: clean, at Crescendo n - 2.
  t.show('note', 0);
  t.show('note', clean ? 2 + crescendo : 1);
}

/**
 * Cantor (support), reworked round one rule (2026-11-12, pipeline/designs/heroes-rework.md): only on the beat. His spells
 * have no cooldown (the kit's 0.5 s is the gap the game server asks between two casts of a slot; Duet's 11 s is its one
 * ultimate in 10 s), but he may cast one spell a beat (`canCast`), and the beat decides what it is. A pulse runs under him
 * every 1.2 s of round time (`beatPhase`, `inTune`, the ring).
 * On the beat (within 0.25 s of a pulse) a spell lands: +12% power for each step of Crescendo (`castMods`, so it travels with
 * the cast), and the Crescendo, his bar (`resource`, 0 to 5), goes up one. Off the beat it goes sour: a quarter of its power,
 * no silence, charm or shield, and the Crescendo is gone. The Crescendo holds three beats without a clean spell and then
 * falls a step a beat (`tick`): a stun or a silence costs him beats, nothing more.
 * Q Resounding Chord and R Duet build it; at 5 the Chord also silences 0.5 s. W Siren Song and E Rising Chorus spend all of
 * it (and need at least 1): 0.25 s of charm a step, a 15 shield a step for 3 s with +25% speed for 1.5 s.
 * `cantorNotes` tells his effects what the cast was, on both screens (`show('note')`). Duet (R) cannot be cast while the
 * enemy is charmed (`canCast`); inside its ring `dealt` adds a 0.5 s silence to a clean spell hit.
 * The CPU (`aiHold`) casts only inside the window, sings the Siren Song from 4 Crescendo, and spends on the Chorus's shield
 * when it is under 65% HP with no shield and 3 Crescendo; it walks in to where the Chord reaches (`aiGoal`).
 */
export const bardTrait: Trait = {
  aiHold(t, slot, dist) {
    if (!inTune(t.time)) return true;
    const hurt = t.hp() < t.maxHp() * 0.65 && t.shieldAmount() <= 0 && t.res >= 3;
    if (slot === 1) return t.res < 4 || hurt;
    if (slot === 2) return !hurt;
    if (slot === 3) return dist > 4.5;
    return false;
  },
  // The CPU playing him stands where his Chord reaches (a 5 m cone), not out at the end of his basic attack.
  aiGoal(t) {
    const e = t.enemy();
    if (!e || t.enemyDistance() <= AI_CHORD_REACH) return null;
    const me = t.self().group.position, p = e.group.position, d = t.enemyDistance();
    const k = (d - AI_CHORD_STAND) / d;
    return { x: me.x + (p.x - me.x) * k, z: me.z + (p.z - me.z) * k };
  },
  passive: {
    name: 'Only on the Beat',
    blurb: 'No cooldowns: one spell a beat (every 1.2 s). On the pulse it lands and the Crescendo climbs a step (5 at most, +12% power a step). Off the pulse it goes sour: a quarter of the power, nothing else, and the Crescendo is gone. Siren Song and Rising Chorus spend the Crescendo. It holds three beats of rest, then falls.',
  },
  resource: { name: 'Crescendo', max: CRESCENDO_MAX, color: GOLD },
  ownChanged(t, name, n) {
    if (name === 'note' && n > 0) cantorNotes.set(t.self(), { clean: n >= 2, crescendo: Math.max(0, n - 2) });
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'note' },
  canCast(t, slot) {
    if (t.mem.beatCast === beatOf(t.time) + 1) return 'One spell a beat';
    if (spends(slot) && t.res < 1) return 'No Crescendo to spend';
    if (slot !== 3) return null;
    const foe = t.enemy();
    return foe && t.status(foe)?.charmed ? 'The enemy is charmed' : null;
  },
  castMods(t, slot) {
    const c = Math.round(t.res);
    t.mem.beatCast = beatOf(t.time) + 1;
    if (!inTune(t.time)) {
      // Off the beat: a sour note. The cast still goes out, at a quarter of its power, and the run is over.
      t.addRes(-CRESCENDO_MAX);
      setNote(t, false, 0);
      t.say('SOUR', SOUR);
      return { power: SOUR_POWER };
    }
    setNote(t, true, c);
    t.mem.cleanAt = t.time;
    if (spends(slot)) {
      t.addRes(-CRESCENDO_MAX);
      if (slot === 2) {
        t.shield(CHORUS_SHIELD_PER * c, CHORUS_SHIELD_SECONDS);
        t.buff('haste', CHORUS_HASTE.amount, CHORUS_HASTE.seconds);
      }
    } else {
      t.addRes(1);
      if (c + 1 === CRESCENDO_MAX) t.say('CRESCENDO', '#ffe58a');
    }
    return { power: 1 + CRESCENDO_POWER * c };
  },
  dealt(t, hit) {
    // Inside Duet's ring, a clean spell also silences (not the ring's own pulses, not a hit with a status of its own).
    if (hit.kind !== 'spell' || hit.slot === 3 || !hit.victimIsHero || hit.opts.status) return;
    if (!cantorNotes.get(t.self())?.clean || !cantorDuets.get(t.self())?.live) return;
    hit.opts.status = { kind: 'silence', seconds: DUET_SILENCE };
  },
  tick(t) {
    // Three beats of rest are free; after that the Crescendo falls a step a beat.
    if (t.res > 0 && t.time - (t.mem.cleanAt ?? 0) > REST_BEATS * BEAT + TUNE) {
      t.addRes(-1);
      t.mem.cleanAt = (t.mem.cleanAt ?? 0) + BEAT;
    }
    const d = cantorDuets.get(t.self());
    if (d?.collapsed) d.collapsed = false;
  },
  ring(t) {
    cantorClock.set(t.self(), t.time);
    // The window: the ring swells from 1.0 to 1.6 over the 0.25 s before a pulse and falls back over the 0.25 s after it.
    const k = Math.max(0, 1 - Math.abs(beatPhase(t.time)) / TUNE);
    if (k <= 0) return { radius: 1.0, color: '#b0508f', opacity: 0.3 };
    return { radius: 1.0 + 0.6 * k, color: GOLD, opacity: 0.5 + 0.5 * k };
  },
  badge: (t) => (inTune(t.time) ? 'NOW' : ''),
};
