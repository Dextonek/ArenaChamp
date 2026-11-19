import type { EffectModule } from '../../../effects/types';
import { venomOrchidModule } from './venomOrchid';
import { whiplashFissureModule } from './whiplashFissure';

/** Gallery group 10 (pipeline/designs/gallery-20.md): its helper lists its spells here. */
export const g10Modules: EffectModule[] = [whiplashFissureModule, venomOrchidModule];
