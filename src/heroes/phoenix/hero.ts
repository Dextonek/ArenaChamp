import type { HeroCard } from '../framework/card';
import { COLOURS, icons, portrait } from './icons';
import {
  BIRD_DAMAGE, BIRD_LENGTH, BIRD_WIDTH, BIRD_WIND, FLARE_DAMAGE, FLARE_RADIUS, FLARE_WIND, FLIGHT_DAMAGE, FLIGHT_RADIUS, FLIGHT_RANGE,
  QUILL_DAMAGE, QUILL_RANGE,
} from './numbers';

/**
 * Anka, the Firebird (hero 40; the first hero in a folder of her own). Her card: name, colours, HP, model and body, her shop row,
 * and her four spells. The tooltips are written from her numbers (`numbers.ts`), so they cannot disagree with the hit.
 * The rest of her: the passive (`trait.ts`), one file a spell (`spells/`), the look parts (`parts.ts`), the canvas icons
 * (`icons.ts`). Found by the game by itself (src/heroes/index.ts).
 */
const anka: HeroCard = {
  order: 39,
  kit: {
    name: 'Anka',
    maxHp: 460,
    title: 'the Firebird',
    accent: COLOURS.accent,
    foil: COLOURS.foil,
    portrait,
    spells: [
      {
        key: 'Q', label: 'ember quill', name: 'Ember Quill', range: QUILL_RANGE, cooldown: 3.5, aim: 'line',
        blurb: `A feather (${QUILL_RANGE} m): ${QUILL_DAMAGE} damage. Where it ends, in the enemy or in the floor, it stays as an ember and becomes her nest.`,
        icon: icons.Q,
      },
      {
        key: 'W', label: 'fan the flames', name: 'Fan the Flames', range: 0, cooldown: 9,
        blurb: `Every ember flares after ${FLARE_WIND} s in a ring of ${FLARE_RADIUS} m: ${FLARE_DAMAGE} damage, once. The embers burn out.`,
        icon: icons.W,
      },
      {
        key: 'E', label: 'ember flight', name: 'Ember Flight', range: FLIGHT_RANGE, cooldown: 10,
        blurb: `She flies to her ember nearest the aimed spot (${FLIGHT_RANGE} m) and lands in a burst of ${FLIGHT_RADIUS} m: ${FLIGHT_DAMAGE} damage. The ember is spent. Needs an ember.`,
        icon: icons.E,
      },
      {
        key: 'R', label: 'firebird', name: 'Firebird', range: BIRD_LENGTH, cooldown: 24, aim: 'line', overCover: true,
        blurb: `She spreads wings of fire for ${BIRD_WIND} s, then crosses ${BIRD_LENGTH} m as a great firebird: ${BIRD_DAMAGE} damage to everyone in the ${BIRD_WIDTH} m lane. An ember is left where she took off.`,
        icon: icons.R,
      },
    ],
  },
  // born in the fourth style: there is no older model, so `?figs=old` shows her as she is
  model: 'models/heroes/phoenix_v4.glb',
  body: { radius: 0.4, height: 2.4 },
  shop: { kind: 'caster', shelf: 3 },
  icons: 'anka',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Anka | the Firebird"',
    model: 'blender/heroes/real/phoenix.py',
    design: 'pipeline/designs/kit-phoenix.md',
  },
};

export default anka;
