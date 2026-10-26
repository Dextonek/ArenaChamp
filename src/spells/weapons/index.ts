import type { EffectModule } from '../../effects/types';
import { phoenixFanModule } from './phoenixFan';
import { frostLilySwordModule } from './frostLilySword';
import { azureDragonSwordModule } from './azureDragonSword';
import { thunderDrumHammerModule } from './thunderDrumHammer';
import { greenDragonCrescentModule } from './greenDragonCrescent';
import { dragonSlashModule } from './strikes/dragonSlash';
import { frostThrustModule } from './strikes/frostThrust';
import { crescentSweepModule } from './strikes/crescentSweep';
import { thunderSlamModule } from './strikes/thunderSlam';
import { phoenixGaleModule } from './strikes/phoenixGale';

/**
 * Weapon idle auras (category 'weapons'): the five Blender weapons in public/models/weapons with their looping
 * enchant VFX (technique: docs/WEAPON_VFX_GUIDE.md, kit: src/effects/weapons). One import + entry each.
 */
export const weaponModules: EffectModule[] = [
  phoenixFanModule,
  frostLilySwordModule,
  azureDragonSwordModule,
  thunderDrumHammerModule,
  greenDragonCrescentModule,
  // weapon attacks (category 'weapon attacks'): the hero wields the weapon against the arena enemies
  dragonSlashModule,
  frostThrustModule,
  crescentSweepModule,
  thunderSlamModule,
  phoenixGaleModule,
];
