import type { EffectModule } from './types';
import { divineSwordModule } from './divineSword';
import { gateOfBabylonModule } from './gateOfBabylon';
import { meteorShowerModule } from './meteorShower';
import { shockwavePunchModule } from './shockwavePunch';
import { lightningStrikeModule } from './lightningStrike';
import { spiralSphereModule } from './spiralSphere';
import { energyBeamModule } from './energyBeam';
import { blackHoleModule } from './blackHole';

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
];
