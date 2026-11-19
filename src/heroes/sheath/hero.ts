import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { icons, portrait } from './icons';
import { C, E, P, Q, R, W } from './numbers';

/**
 * Kagen, the Scarlet Sheath: the card (found by the game by itself, src/heroes/index.ts). A DRAFT made by
 * pipeline/tools/new-hero.py on 2026-11-18: off the roster, the shop, the CPU's picks and the Codex until its gates pass
 * (its checklist: docs/heroes/new/sheath.md). It plays on the hero workbench (/workbench.html), and on the dev server on
 * any page opened with ?drafts=1. Released at gate 6: delete the `draft` line, add its shop row to the server.
 * The tooltips are written from numbers.ts.
 */
const kit: HeroKit = {
  name: 'Kagen',
  maxHp: P.hp,
  melee: true,
  title: 'the Scarlet Sheath',
  accent: C.accent,
  foil: C.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'issen', name: 'Issen', range: Q.range, cooldown: Q.cooldown, aim: 'line', overCover: true,
      blurb: `One Flash. A line shows down the aim for ${Q.windup} s, then he crosses it (${Q.range} m) and stands at its end: ${Q.damage} damage and a cut mark to whoever the cut passes.`,
      icon: icons.Q,
    },
    {
      key: 'W', label: 'noto', name: 'Noto', range: 0, cooldown: W.cooldown,
      blurb: `The Click. He sheathes the blade: a ring of ${W.radius} m shows round him for ${W.windup} s, then every cut mark on an enemy inside it opens, ${P.markDamage} each. For ${W.parry} s after the click, the next hit on him is parried and leaves a mark on the attacker.`,
      icon: icons.W,
    },
    {
      key: 'E', label: 'senbon', name: 'Senbon', range: E.range, cooldown: E.cooldown,
      blurb: `Thousand Swords. A ring of ${E.radius} m is painted on a spot for ${E.warn} s, then katanas rain into it in ${E.waves.length} waves: ${E.damage} damage and a cut mark for each wave you stand in.`,
      icon: icons.E,
    },
    {
      key: 'R', label: 'sekai giri', name: 'Sekai-giri', range: R.range, cooldown: R.cooldown, aim: 'line', overCover: true,
      blurb: `Ultimate, World Sever. He draws one cut along a ${R.range} m line and stands still for ${R.windup} s; then it tears: ${R.damage} damage on the line, and every cut mark on you opens wherever you stand, ${R.markDamage} each.`,
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 40,
  kit,
  // his own model since gate 2: blender/heroes/real/sheath.py (real_build.py)
  model: 'models/heroes/sheath_v4.glb',
  // the hit size, measured on the model at gate 2 (src/heroes.ts, HERO_BODIES): his build and height match Zephyr's and Wick's
  body: { radius: 0.41, height: 2.37 },
  shop: { kind: 'assassin', shelf: 3 },
  icons: 'kagen',
  draft: true,
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Kagen | the Scarlet Sheath"',
  model: 'blender/heroes/real/sheath.py',
  design: 'pipeline/designs/kit-sheath.md',
};
