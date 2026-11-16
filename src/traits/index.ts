import type { Trait } from './types';
import { stormTrait } from './storm';
import { dawnTrait } from './dawn';
import { forgeTrait } from './forge';
import { hiveTrait } from './hive';
import { frostTrait } from './frost';
import { masonTrait } from './mason';
import { timberTrait } from './timber';
import { balloonTrait } from './balloon';
import { catTrait } from './cat';
import { ledgerTrait } from './ledger';
import { sumoTrait } from './sumo';
import { mimeTrait } from './mime';
import { refereeTrait } from './referee';
import { chefTrait } from './chef';
import { courierTrait } from './courier';
import { janitorTrait } from './janitor';
import { moleTrait } from './mole';
import { yarnTrait } from './yarn';
import { weatherTrait } from './weather';
import { sheepTrait } from './sheep';
import { magicTrait } from './magic';
import { doorTrait } from './door';
import { twinsTrait } from './twins';
import { FOLDER_TRAITS } from '../heroes/traits';

export { TraitRuntime, type TraitHost } from './runtime';
export * from './types';

/**
 * Each hero's identity layer, by kit name (pipeline/designs/hero-identity.md). Heroes without one play as before. A hero in a
 * folder of its own (src/heroes/<theme>/trait.ts) is found by itself and added at the end.
 */
export const TRAITS: Record<string, Trait> = {
  Kaia: stormTrait,
  Auriel: dawnTrait,
  Brannoc: forgeTrait,
  Sirix: hiveTrait,
  Isolde: frostTrait,
  Bram: masonTrait,
  Hank: timberTrait,
  'Professor Puff': balloonTrait,
  'Sir Whiskers': catTrait,
  'Mr. Ledger': ledgerTrait,
  'Big Yoko': sumoTrait,
  Mum: mimeTrait,
  'Referee Whistler': refereeTrait,
  'Madame Cleaver': chefTrait,
  Pip: courierTrait,
  Gus: janitorTrait,
  Mabel: moleTrait,
  'Grandma Ironknit': yarnTrait,
  'Barry Cloudsley': weatherTrait,
  Bo: sheepTrait,
  'The Great Zambini': magicTrait,
  Wick: doorTrait,
  'Pim and Pom': twinsTrait,
  ...FOLDER_TRAITS,
};

export function traitFor(kitName: string): Trait | null {
  return TRAITS[kitName] ?? null;
}
