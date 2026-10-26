import type { EffectModule } from './types';
import { divineSwordModule } from './divineSword';
import { gateOfBabylonModule } from './gateOfBabylon';
import { meteorShowerModule } from './meteorShower';
import { shockwavePunchModule } from './shockwavePunch';
import { lightningStrikeModule } from './lightningStrike';
import { spiralSphereModule } from './spiralSphere';
import { energyBeamModule } from './energyBeam';
import { blackHoleModule } from './blackHole';
import { paladinModules } from '../spells/paladin';
import { iconicModules } from '../spells/iconic';
import { originalModules } from '../spells/original';
import { targetedModules } from '../spells/targeted';
import { weaponModules } from '../spells/weapons';

/** Every set-piece effect, in dropdown order. Add one import + entry per new effect. */
export const effectModules: EffectModule[] = [
  divineSwordModule,
  gateOfBabylonModule,
  meteorShowerModule,
  shockwavePunchModule,
  lightningStrikeModule,
  spiralSphereModule,
  energyBeamModule,
  blackHoleModule,
  ...paladinModules,
  ...iconicModules,
  ...originalModules,
  ...targetedModules,
  ...weaponModules,
];
