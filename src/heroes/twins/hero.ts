import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, pimIcons, pimPortrait, pomIcons, pomPortrait, tagIcon } from './icons';
import {
  BONK_DAMAGE, BONK_REACH, CHARGE_DAMAGE, CHARGE_RANGE, FLIP_DAMAGE, FLIP_DISTANCE, PEBBLE_DAMAGE, PEBBLE_RANGE, SHIELD_AMOUNT, SHIELD_SECONDS,
  SNARE_DAMAGE, SNARE_RANGE, SNARE_ROOT,
} from './trait';

/**
 * Pim and Pom, the Changeling Twins: the card (found by the game by itself, src/heroes/index.ts). A hero of two halves: the kit
 * is Pim (melee), its `alt` is Pom (ranged), with the same name, so the same passive; each has its own Q, W, E, model, portrait
 * and basic attack, and both share the one Tag Out (one object: the icon hook wraps it once). Their drawings are in `icons.ts`,
 * the passive in `trait.ts`, the seven spells in `spells/`, the look parts in `parts.ts`.
 */
const tagOut = {
  key: 'R' as const, label: 'tag out', name: 'Tag Out', range: 0, cooldown: 8, anytime: true as const,
  blurb: 'Swap twins: a 0.5 s hold while the other pops out of the backpack. The one who comes in has the next spell ready 2 s sooner. The twin who rests heals 6 HP a second.',
  icon: tagIcon,
};

const pom: HeroKit = {
  name: 'Pim and Pom',
  title: 'the Changeling Twins',
  accent: S.pom,
  foil: S.pim,
  maxHp: 620,
  hpChunks: 2,
  model: 'models/heroes/pom_v3.glb',
  attack: { kind: 'ranged', range: 6, damage: 12, interval: 0.9, speed: 20, look: 'dart' },
  portrait: pomPortrait,
  spells: [
    {
      key: 'Q', label: 'pebble', name: 'Pebble', range: PEBBLE_RANGE, cooldown: 3, aim: 'line',
      blurb: `A pebble from the slingshot (${PEBBLE_RANGE} m, quick): ${PEBBLE_DAMAGE} damage. Sidestep it.`,
      icon: pomIcons.Q,
    },
    {
      key: 'W', label: 'snare', name: 'Snare', range: SNARE_RANGE, cooldown: 9, cc: true,
      blurb: `A net drops on a spot (${SNARE_RANGE} m, 1 s warning, 2 m round): ${SNARE_DAMAGE} damage and a ${SNARE_ROOT} s root. Leave the circle.`,
      icon: pomIcons.W,
    },
    {
      key: 'E', label: 'backflip', name: 'Backflip', range: FLIP_DISTANCE, cooldown: 10, dash: true, escape: true,
      blurb: `A hop ${FLIP_DISTANCE} m toward the aim. She leaves a party popper where she stood: after a moment it goes off for ${FLIP_DAMAGE}.`,
      icon: pomIcons.E,
    },
    tagOut,
  ],
};

const kit: HeroKit = {
  name: 'Pim and Pom',
  title: 'the Changeling Twins',
  accent: S.pim,
  foil: S.pom,
  maxHp: 620,
  hpChunks: 2,
  melee: true,
  model: 'models/heroes/pim_v3.glb',
  attack: { kind: 'melee', range: 2.4, damage: 16, interval: 0.9, look: 'sweep' },
  portrait: pimPortrait,
  alt: pom,
  spells: [
    {
      key: 'Q', label: 'bonk', name: 'Bonk', range: BONK_REACH, cooldown: 3,
      blurb: `A wooden sword swings across a ${BONK_REACH} m cone in front of him: ${BONK_DAMAGE} damage. Stay out of 3 m.`,
      icon: pimIcons.Q,
    },
    {
      key: 'W', label: 'pim charge', name: 'Charge', range: CHARGE_RANGE, cooldown: 9, dash: true,
      blurb: `He lowers his head and runs ${CHARGE_RANGE} m toward the aim after a short wind-up: ${CHARGE_DAMAGE} damage to whoever is in the lane when he arrives.`,
      icon: pimIcons.W,
    },
    {
      key: 'E', label: 'shield up', name: 'Shield Up', range: 0, cooldown: 10,
      blurb: `A little toy shield: ${SHIELD_AMOUNT} shield for ${SHIELD_SECONDS} s. Wait it out, or take the space.`,
      icon: pimIcons.E,
    },
    tagOut,
  ],
};

const card: HeroCard = {
  order: 38,
  kit,
  model: 'models/heroes/pim_v3.glb',
  body: { radius: 0.38, height: 2.39 },
  shop: { kind: 'fighter', shelf: 3 },
  // each half its own icons: Pim's, then Pom's
  icons: ['pim', 'pom'],
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Pim and Pom | the Changeling Twins"',
  model: 'blender/heroes/real/pim.py and pom.py',
  design: 'pipeline/designs/kit-twins.md',
};
