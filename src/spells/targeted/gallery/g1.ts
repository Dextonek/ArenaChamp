import type { EffectModule } from '../../../effects/types';
import { carnivalMasqueradeModule } from './carnivalMasquerade';
import { kintsugiShatterModule } from './kintsugiShatter';

/** Gallery group 1 (pipeline/designs/gallery-20.md): its helper lists its spells here. */
export const g1Modules: EffectModule[] = [kintsugiShatterModule, carnivalMasqueradeModule];
