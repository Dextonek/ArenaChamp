import type { EffectModule } from '../../effects/types';
import { solarVerdictModule } from './solarVerdict';
import { crownOfTheFinalStarModule } from './crownOfTheFinalStar';
import { corpseFingerGravityPullModule } from './corpseFingerGravityPull';
import { illusionistRainOfDoomModule } from './illusionistRainOfDoom';

/** Original moves designed from their names (category 'original'), in dropdown order. */
export const originalModules: EffectModule[] = [
  corpseFingerGravityPullModule,
  illusionistRainOfDoomModule,
  solarVerdictModule,
  crownOfTheFinalStarModule,
];
