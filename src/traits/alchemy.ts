import type * as THREE from 'three';
import type { Trait, TraitHit, TraitView } from './types';
import type { Reaction } from '../effects/parts/alchemy';
import { shapeMove } from './tide';

/**
 * Vitriol (mage; the kit was Vex before v5). Passive Reaction (pipeline/designs/kit-alchemy.md, kits-v5.md): each spell
 * leaves its reagent on the enemy hero for 4 s: Q green toxin, W orange fire, E violet acid. A hit with a second, different
 * reagent sets off a reaction and clears both, and the reaction takes 2 s off the spell that took no part:
 *   toxin + fire  = Combust: 55 more damage on that hit;
 *   toxin + acid  = Corrode: the enemy takes 35% more for 3 s (`vulnerable`);
 *   fire + acid   = Concussion: a 2.5 m push (the same on a player and the CPU) and a 0.5 s silence.
 * The homunculus (R, slot 3) bursts carrying all three reagents: every reaction goes off at once and the reagents clear
 * (no refund). A spell that hits many times (the darts' and the vial's burn) puts its reagent on once per cast, on its first hit.
 * The reagents are stacks on the enemy (`toxin`, `fire`, `acid`, one pip each, 4 s), so both players see them and they sync
 * online; the last cast counted per slot is `t.mem.c0`..`c3`. Online `dealt` runs on the victim's screen, where the hit is
 * decided: the reaction's damage, push, silence and vulnerable are part of that hit, and the refund reaches her own client
 * through `noteOwner` / `peerNote`. The burst is drawn where `dealt` ran.
 */

/** How long a reagent stays on the enemy (s). */
export const REAGENT_SECONDS = 4;
/** The reactions' numbers (kits-v4.md). */
export const COMBUST_DAMAGE = 55;
export const CORRODE = { amount: 0.35, seconds: 3 };
/** Concussion: metres the push moves the enemy (`shapeMove`: a pull the engine moves the same on a player and a foe), and the silence. */
export const CONCUSSION = { push: 2.5, silence: 0.5 };
/** Seconds a reaction takes off the spell that took no part. */
export const REFUND_SECONDS = 2;

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

function apply(hit: TraitHit, kind: Reaction, me: THREE.Vector3) {
  if (kind === 'combust') hit.damage += COMBUST_DAMAGE;
  else if (kind === 'corrode') hit.opts.debuff = { kind: 'vulnerable', amount: CORRODE.amount, seconds: CORRODE.seconds };
  else {
    shapeMove(hit.opts, true, me, hit.victim.group.position, me, CONCUSSION.push);
    hit.opts.status = { kind: 'silence', seconds: CONCUSSION.silence };
  }
}

function announce(t: TraitView, hit: TraitHit, kinds: Reaction[]) {
  const me = t.self().group.position;
  for (const k of kinds) apply(hit, k, me);
  noted.set(t.self(), kinds);
  t.say(kinds.length > 1 ? 'ALL REACT' : WORD[kinds[0]], COLOUR[kinds[kinds.length - 1]]);
}

export const alchemyTrait: Trait = {
  passive: {
    name: 'Reaction',
    blurb: 'Each spell leaves its reagent on the enemy for 4 s: Q green toxin, W orange fire, E violet acid. A second, different reagent sets off a reaction, clears both and takes 2 s off the spell that took no part. Toxin + fire: Combust, 55 at once. Toxin + acid: Corrode, the enemy takes 35% more for 3 s. Fire + acid: Concussion, pushed 2.5 m and silenced 0.5 s. The Homunculus carries all three.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6.5, damage: 9, interval: 1.0, windup: 0.25, speed: 18, look: 'dart' },
  dealt(t, hit) {
    if (!hit.victimIsHero || hit.kind !== 'spell' || hit.slot === undefined || hit.slot > 3) return;
    const slot = hit.slot;
    // Once per cast: a dart's or a vial's burn ticks, and a homunculus's single burst, add their reagents on the first hit only.
    if (hit.cast !== undefined) {
      if (t.mem[`c${slot}`] === hit.cast) return;
      t.mem[`c${slot}`] = hit.cast;
    }
    if (slot === 3) {
      // The homunculus pours all three reagents in at once: all three reactions, then a clean slate. No refund.
      announce(t, hit, ['combust', 'corrode', 'concussion']);
      for (const n of NAMES) t.clearStacks(n);
      return;
    }
    const other = [0, 1, 2].find((j) => j !== slot && t.stacks(NAMES[j]) > 0);
    if (other === undefined) {
      t.addStacks(NAMES[slot], 1, REAGENT_SECONDS, 1);
      return;
    }
    t.clearStacks(NAMES[slot]);
    t.clearStacks(NAMES[other]);
    announce(t, hit, [reactionOf(slot, other)]);
    // The third spell took no part: it comes back 2 s sooner (on her own client, which `peerNote` runs on).
    t.noteOwner('react', 3 - slot - other);
  },
  peerNote(t, name, n) {
    if (name === 'react') t.setCooldown(n, Math.max(0, t.cooldownLeft(n) - REFUND_SECONDS));
  },
  badge(t) {
    let s = '';
    for (let i = 0; i < 3; i++) if (t.stacks(NAMES[i]) > 0) s += (s ? ' ' : '') + LETTER[i];
    return s;
  },
};

/** The reagent names by slot (docs and the AI's logs). */
export const REAGENT_NAMES = NAMES;
