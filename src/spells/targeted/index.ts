import type { EffectModule } from '../../effects/types';
import { starbreakerLanceModule } from './starbreakerLance';
import { glacialRicochetModule } from './glacialRicochet';
import { cataclysmSigilModule } from './cataclysmSigil';
import { abyssalGazeModule } from './abyssalGaze';
import { partsShowcaseModule } from './partsShowcase';
import { tempestLatticeModule } from './tempestLattice';
import { galeBulletModule } from './galeBullet';
import { cinderBowModule } from './cinderBow';
import { emberCometModule } from './emberComet';
import { violetSeveranceModule } from './violetSeverance';

/**
 * Targeted spells (category 'targeted'): they aim at the enemies / ground spot picked in the shared arena.
 * Written by the forge-vfx pipeline (`.claude/skills/forge-vfx`); the orchestrator adds one import + entry each.
 */
export const targetedModules: EffectModule[] = [
  starbreakerLanceModule,
  glacialRicochetModule,
  cataclysmSigilModule,
  abyssalGazeModule,
  partsShowcaseModule,
  tempestLatticeModule,
  galeBulletModule,
  cinderBowModule,
  emberCometModule,
  violetSeveranceModule,
];
