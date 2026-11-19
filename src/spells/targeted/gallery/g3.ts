import type { EffectModule } from '../../../effects/types';
import { mandalaUnbindingModule } from './mandalaUnbinding';
import { mosaicNovaModule } from './mosaicNova';

/** Gallery group 3 (pipeline/designs/gallery-20.md): its helper lists its spells here. */
export const g3Modules: EffectModule[] = [mosaicNovaModule, mandalaUnbindingModule];
