import { frameCast } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { EffectModule } from '../../effects/types';
import { RULE_DELAY, RULE_RANGE } from '../../traits/referee';
import { RuleWhistle, type NoRunningSettings } from './noRunning';

/**
 * No Casting (referee kit, E: a rule). The same whistle and ring as No Running (`RuleWhistle` in `noRunning.ts`: the whistle at his
 * lips at 0.2 s, a fat ring of sound rushing out along the floor to 7 m, the rule landing at 0.5 s on whoever is inside and seen). The
 * hit's damage 1 becomes the rule NO CASTING for 2 s (`CAST_SECONDS`, set in the trait's `dealt`, slot 2): no spells but basic attacks.
 * The sign that stamps down under each of them is a wand crossed out in red. Casting anyway is never blocked: the cast goes out and
 * the trait gives a yellow card. Clean by about 2.1 s. See pipeline/designs/kit-referee.md.
 */
export type NoCastingSettings = NoRunningSettings;

export const defaultNoCasting = (): NoCastingSettings => ({ damage: 1, loop: false });

export const noCastingModule: EffectModule = {
  label: 'no casting',
  category: 'hero: referee',
  // A rule is a ring round him: the enemies inside it are the targets.
  targeting: { mode: 'self', radius: RULE_RANGE },
  create: () => new RuleWhistle('cast', defaultNoCasting()),
  telegraphs(effect) {
    const e = effect as RuleWhistle;
    if (!e.ctx) return [];
    const spec: TelegraphSpec = { shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: RULE_RANGE }, start: 0, impact: RULE_DELAY };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as RuleWhistle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as RuleWhistle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 20, 1);
  },
};
