import type { Trait } from './types';
import { stormTrait } from './storm';
import { prismTrait } from './prism';
import { dawnTrait } from './dawn';
import { bardTrait } from './bard';
import { forgeTrait } from './forge';
import { voidTrait } from './void';
import { hiveTrait } from './hive';
import { chronoTrait } from './chrono';
import { frostTrait } from './frost';
import { boneTrait } from './bone';
import { clockworkTrait } from './clockwork';
import { inkTrait } from './ink';
import { mirrorTrait } from './mirror';
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
  Opaline: prismTrait,
  Auriel: dawnTrait,
  Cantor: bardTrait,
  Brannoc: forgeTrait,
  Oblivion: voidTrait,
  Sirix: hiveTrait,
  Tempo: chronoTrait,
  Isolde: frostTrait,
  Silvane: mirrorTrait,
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
  Mortis: boneTrait,
  Ada: clockworkTrait,
  Shiori: inkTrait,
  ...FOLDER_TRAITS,
};

export function traitFor(kitName: string): Trait | null {
  return TRAITS[kitName] ?? null;
}
