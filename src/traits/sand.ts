import type { Trait } from './types';

/**
 * Burrow (the old E, `src/spells/targeted/burrow.ts`, still listed by the VFX tool): seconds from the cast during which Sefu
 * was untouchable. The v5 kit no longer uses it; the old effect still imports it.
 */
export const BURROW_SECONDS = 1.1;

/** Seconds a Judged mark lasts, and the damage a Judged enemy takes more from Sefu. */
export const JUDGED_SECONDS = 3;
export const JUDGED_BONUS = 0.2;
/** Judged: dashes, blinks and leaps go this much less far (the `grounded` debuff). */
export const JUDGED_GROUNDED = 0.5;

/**
 * Sefu (controller, v5). Passive Pharaoh's Decree: an enemy his Shepherd's Crook pulls, or his Sarcophagus opens on, is Judged
 * for 3 s (one stack of 'judged' on the enemy, drawn over their head). A Judged enemy takes 20% more from all his hits, and
 * their dashes, blinks and leaps go half as far (the `grounded` debuff). A Cobra Spit that hits a Judged enemy halves what is
 * left of its cooldown. Basic attack: a thrown sand lash (5.5 m).
 *
 * `dealt` runs where the hit is decided (online, the victim's screen): it reads the stack before this hit adds it, and tells
 * Sefu's own client about a Cobra Spit refund with `noteOwner`, which `peerNote` turns into the cooldown cut. The cast's cooldown
 * is set right after the cast starts (hero mode and duel both set it before any bolt can fly), and the bolt lands at least 0.3 s
 * later, so the cut always acts on a running cooldown.
 */
export const sandTrait: Trait = {
  passive: { name: "Pharaoh's Decree", blurb: 'An enemy his crook pulls or his sarcophagus opens on is Judged for 3 s: his hits deal 20% more to them and their dashes, blinks and leaps go half as far. A Cobra Spit on a Judged enemy halves its cooldown.' },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'sand' },
  dealt(t, hit) {
    // A hit swallowed (a sealed figure) judges nothing and gains nothing.
    if (!hit.victimIsHero || hit.blocked) return;
    const judged = t.stacks('judged') > 0;
    if (judged) hit.damage *= 1 + JUDGED_BONUS;
    if (hit.kind !== 'spell') return;
    if (hit.slot === 0 && judged) t.noteOwner('spit', 0);
    // The crook's hit, and the sarcophagus's opening burst (not the 0-damage seal before it): Judged.
    const seal = hit.opts.status?.kind === 'sealed';
    if (hit.slot === 1 || (hit.slot === 3 && !seal)) {
      t.addStacks('judged', 1, JUDGED_SECONDS, 1);
      hit.opts.debuff = { kind: 'grounded', amount: JUDGED_GROUNDED, seconds: JUDGED_SECONDS };
      if (!judged) t.say('JUDGED', '#ffd27a');
    }
  },
  peerNote(t, name) {
    if (name === 'spit') t.setCooldown(0, t.cooldownLeft(0) / 2);
  },
  badge: (t) => (t.stacks('judged') > 0 ? 'J' : ''),
};
