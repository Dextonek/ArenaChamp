import type { Trait, TraitHit, TraitView } from './types';
import type { Reaction } from '../effects/parts/alchemy';

/**
 * Vex (mage). Passive Reaction (pipeline/designs/kit-alchemy.md, kits-v4.md): each spell leaves its reagent on the enemy
 * hero for 4 s: Q green toxin, W orange fire, E violet acid. A hit with a second, different reagent sets off a reaction
 * and clears both:
 *   toxin + fire  = Combust: 45 more damage on that hit;
 *   toxin + acid  = Corrode: the enemy takes 20% more for 3 s (`vulnerable`);
 *   fire + acid   = Concussion: a 3 m knock-back and a 0.5 s silence.
 * The homunculus (R, slot 3) bursts carrying all three reagents: every reaction goes off at once and the reagents clear.
 * A spell that hits many times (the darts' and the vial's burn) puts its reagent on once per cast, on its first hit.
 * The reagent deadlines are round time in `t.mem` (`r0`..`r2`), the last cast counted per slot is `c0`..`c3`.
 * Online the reagents live only in the dealing hero's trait, so the reaction's burst is drawn on that screen only; its
 * damage, knock-back, silence and vulnerable reach the other screen the way any hit's extras do.
 */

/** How long a reagent stays on the enemy (s). */
export const REAGENT_SECONDS = 4;
/** The reactions' numbers (kits-v4.md). */
export const COMBUST_DAMAGE = 55;
export const CORRODE = { amount: 0.2, seconds: 3 };
/** `HitOptions.knock` is speed (the foe slides knock / 7 m, the player knock * 0.18 m up to knock 8): 21 is 3 m on a foe. */
export const CONCUSSION = { knock: 21, silence: 0.5 };

const NAMES = ['toxin', 'fire', 'acid'] as const;
const LETTER = ['T', 'F', 'A'] as const;
const WORD: Record<Reaction, string> = { combust: 'COMBUST', corrode: 'CORRODE', concussion: 'CONCUSSION' };
const COLOUR: Record<Reaction, string> = { combust: '#ff8a2a', corrode: '#b872ff', concussion: '#ffc23a' };

/**
 * The reactions this hero's last hit set off, keyed by her figure (as `bloodBonds`): the trait writes it inside `dealt`
 * and the effect, which called `ctx.hit` a moment ago, reads it with `takeReaction` to draw the burst. Only the screen
 * that owns her trait has them (see the note above).
 */
const noted = new WeakMap<object, Reaction[]>();

/** The reactions the hit just made by `owner` (her figure) set off, once: the list is cleared as it is read. */
export function takeReaction(owner: object): Reaction[] {
  const r = noted.get(owner);
  if (!r || !r.length) return [];
  noted.delete(owner);
  return r;
}

/** The pair of reagent slots a reaction needs. */
function reactionOf(a: number, b: number): Reaction {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return lo === 0 && hi === 1 ? 'combust' : lo === 0 ? 'corrode' : 'concussion';
}

function apply(hit: TraitHit, kind: Reaction) {
  if (kind === 'combust') hit.damage += COMBUST_DAMAGE;
  else if (kind === 'corrode') hit.opts.debuff = { kind: 'vulnerable', amount: CORRODE.amount, seconds: CORRODE.seconds };
  else {
    hit.opts.knock = Math.max(hit.opts.knock ?? 0, CONCUSSION.knock);
    hit.opts.status = { kind: 'silence', seconds: CONCUSSION.silence };
  }
}

function announce(t: TraitView, hit: TraitHit, kinds: Reaction[]) {
  for (const k of kinds) apply(hit, k);
  noted.set(t.self(), kinds);
  t.say(kinds.length > 1 ? 'ALL REACT' : WORD[kinds[0]], COLOUR[kinds[kinds.length - 1]]);
}

export const alchemyTrait: Trait = {
  passive: {
    name: 'Reaction',
    blurb: 'Each spell leaves its reagent on the enemy for 4 s: Q green toxin, W orange fire, E violet acid. A second, different reagent sets off a reaction and clears both. Toxin + fire: Combust, 55 at once. Toxin + acid: Corrode, the enemy takes 20% more for 3 s. Fire + acid: Concussion, a 3 m knock-back and a 0.5 s silence. The Homunculus carries all three.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6.5, damage: 9, interval: 1.0, windup: 0.25, speed: 18, look: 'dart' },
  dealt(t, hit) {
    if (!hit.victimIsHero || hit.kind !== 'spell' || hit.slot === undefined || hit.slot > 3) return;
    const slot = hit.slot, now = t.time;
    // Once per cast: a dart's or a vial's burn ticks, and a homunculus's single burst, add their reagents on the first hit only.
    if (hit.cast !== undefined) {
      if (t.mem[`c${slot}`] === hit.cast) return;
      t.mem[`c${slot}`] = hit.cast;
    }
    if (slot === 3) {
      // The homunculus pours all three reagents in at once: all three reactions, then a clean slate.
      announce(t, hit, ['combust', 'corrode', 'concussion']);
      for (let i = 0; i < 3; i++) t.mem[`r${i}`] = 0;
      return;
    }
    const other = [0, 1, 2].find((j) => j !== slot && (t.mem[`r${j}`] ?? 0) > now);
    if (other === undefined) {
      t.mem[`r${slot}`] = now + REAGENT_SECONDS;
      return;
    }
    t.mem[`r${slot}`] = 0;
    t.mem[`r${other}`] = 0;
    announce(t, hit, [reactionOf(slot, other)]);
  },
  badge(t) {
    let s = '';
    for (let i = 0; i < 3; i++) if ((t.mem[`r${i}`] ?? 0) > t.time) s += (s ? ' ' : '') + LETTER[i];
    return s;
  },
};

/** The reagent names by slot (docs and the AI's logs). */
export const REAGENT_NAMES = NAMES;
