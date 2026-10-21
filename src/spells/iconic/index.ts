import type { EffectModule } from '../../effects/types';
import { fireballModule } from './fireball';
import { pyroblastModule } from './pyroblast';
import { frostboltModule } from './frostbolt';
import { blizzardModule } from './blizzard';
import { arcaneMissilesModule } from './arcaneMissiles';
import { chainLightningModule } from './chainLightning';
import { chaosBoltModule } from './chaosBolt';
import { rainOfFireModule } from './rainOfFire';
import { deathCoilModule } from './deathCoil';
import { armyOfTheDeadModule } from './armyOfTheDead';
import { starfallModule } from './starfall';
import { penanceModule } from './penance';
import { earthquakeModule } from './earthquake';
import { bladestormModule } from './bladestorm';
import { heroicLeapModule } from './heroicLeap';
import { spinningCraneKickModule } from './spinningCraneKick';
import { deepBreathModule } from './deepBreath';
import { volleyModule } from './volley';
import { eyeBeamModule } from './eyeBeam';
import { metamorphosisModule } from './metamorphosis';

/** Iconic spells from across the classes (category 'iconic'), in dropdown order. */
export const iconicModules: EffectModule[] = [
  fireballModule,
  pyroblastModule,
  frostboltModule,
  blizzardModule,
  arcaneMissilesModule,
  chainLightningModule,
  chaosBoltModule,
  rainOfFireModule,
  deathCoilModule,
  armyOfTheDeadModule,
  starfallModule,
  penanceModule,
  earthquakeModule,
  bladestormModule,
  heroicLeapModule,
  volleyModule,
  eyeBeamModule,
  metamorphosisModule,
  spinningCraneKickModule,
  deepBreathModule,
];
