import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { icons, portrait } from './icons';
import { C, E, Q, R, W } from './numbers';

/**
 * Kagen, the Scarlet Sheath: the card (found by the game by itself, src/heroes/index.ts). A DRAFT made by
 * pipeline/tools/new-hero.py on 2026-11-18: off the roster, the shop, the CPU's picks and the Codex until its gates pass
 * (its checklist: docs/heroes/new/sheath.md). It plays on the hero workbench (/workbench.html), and on the dev server on
 * any page opened with ?drafts=1. Released at gate 6: delete the `draft` line, add its shop row to the server.
 * The tooltips are written from numbers.ts.
 */
const kit: HeroKit = {
  name: 'Kagen',
  maxHp: 700,
  melee: true,
  title: 'the Scarlet Sheath',
  accent: C.accent,
  foil: C.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'kagen first spell', name: 'First Spell', range: Q.range, cooldown: Q.cooldown, aim: 'line',
      blurb: `A bolt down the aim (${Q.range} m, ${Q.windup} s wind-up): ${Q.damage} damage to the first enemy it touches.`,
      icon: icons.Q,
    },
    {
      key: 'W', label: 'kagen second spell', name: 'Second Spell', range: W.range, cooldown: W.cooldown,
      blurb: `A circle of ${W.radius} m at the aim lands after ${W.delay} s: ${W.damage} damage to everyone inside.`,
      icon: icons.W,
    },
    {
      key: 'E', label: 'kagen third spell', name: 'Third Spell', range: E.range, cooldown: E.cooldown, dash: true, aim: 'line', overCover: true,
      blurb: `A dash of ${E.range} m down the aim (${E.windup} s wind-up): ${E.damage} damage to whoever it passes.`,
      icon: icons.E,
    },
    {
      key: 'R', label: 'kagen ultimate', name: 'Ultimate', range: R.range, cooldown: R.cooldown,
      blurb: `A circle of ${R.radius} m at the aim lands after ${R.delay} s: ${R.damage} damage to everyone inside.`,
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
