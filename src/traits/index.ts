import type { Trait } from './types';
import { shadowTrait } from './shadow';
import { stormTrait } from './storm';
import { astralTrait } from './astral';
import { prismTrait } from './prism';
import { dawnTrait } from './dawn';
import { groveTrait } from './grove';
import { bardTrait } from './bard';
import { alchemyTrait } from './alchemy';
import { skyTrait } from './sky';
import { forgeTrait } from './forge';
import { voidTrait } from './void';
import { bloodTrait } from './blood';
import { hiveTrait } from './hive';
import { chronoTrait } from './chrono';
import { frostTrait } from './frost';
import { sandTrait } from './sand';
import { tideTrait } from './tide';
import { boneTrait } from './bone';
import { clockworkTrait } from './clockwork';
import { inkTrait } from './ink';

export { TraitRuntime, type TraitHost } from './runtime';
export * from './types';

/** Each hero's identity layer, by kit name (pipeline/designs/hero-identity.md). Heroes without one play as before. */
export const TRAITS: Record<string, Trait> = {
  Nyx: shadowTrait,
  Kaia: stormTrait,
  Lyra: astralTrait,
  Opaline: prismTrait,
  Auriel: dawnTrait,
  Fenna: groveTrait,
  Cantor: bardTrait,
  Vex: alchemyTrait,
  Zephyr: skyTrait,
  Brannoc: forgeTrait,
  Oblivion: voidTrait,
  Vesper: bloodTrait,
  Sirix: hiveTrait,
  Tempo: chronoTrait,
  Isolde: frostTrait,
  Sefu: sandTrait,
  Marin: tideTrait,
  Mortis: boneTrait,
  Ada: clockworkTrait,
  Shiori: inkTrait,
};

export function traitFor(kitName: string): Trait | null {
  return TRAITS[kitName] ?? null;
}
