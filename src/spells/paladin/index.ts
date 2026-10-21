import type { EffectModule } from '../../effects/types';
import { judgmentModule } from './judgment';
import { hammerOfWrathModule } from './hammerOfWrath';
import { avengersShieldModule } from './avengersShield';
import { hammerOfJusticeModule } from './hammerOfJustice';
import { crusaderStrikeModule } from './crusaderStrike';
import { divineStormModule } from './divineStorm';
import { wakeOfAshesModule } from './wakeOfAshes';
import { consecrationModule } from './consecration';
import { avengingWrathModule } from './avengingWrath';
import { divineShieldModule } from './divineShield';
import { layOnHandsModule } from './layOnHands';
import { lightOfDawnModule } from './lightOfDawn';
import { divineTollModule } from './divineToll';

/** Paladin spells (category 'paladin'), in dropdown order. */
export const paladinModules: EffectModule[] = [
  judgmentModule,
  crusaderStrikeModule,
  divineStormModule,
  wakeOfAshesModule,
  consecrationModule,
  avengingWrathModule,
  divineShieldModule,
  layOnHandsModule,
  lightOfDawnModule,
  divineTollModule,
  hammerOfWrathModule,
  avengersShieldModule,
  hammerOfJusticeModule,
];
