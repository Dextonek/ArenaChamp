import type { BeastDef } from '../../tower/world/beasts';
import { beastLook, ease } from '../../tower/world/beasts';
import { hourStoneLook } from '../bodies/adds';

/**
 * The Sun Warden's Hour Stone (blender/raid/hourstone.py): one of the Sun Court's sundial stones risen, a six-sided pillar of pale
 * marble with an hour numeral and rays inlaid in gold, a gold crown-band that floats and turns round it, and one eye where its beam
 * leaves. Parts: hourstone > base, body > (band, eye, lid). It faces +z; a part that leans forward turns with a positive turn about x.
 *
 * It never walks. The band turns slowly, the stone breathes a little, the eyelid drops now and then. At its shot (`pose.shot` jumps to 1)
 * the eye flares and the band spins up for a moment, and the stone leans a little toward its aim.
 */
const FLARE = 0.7;

export const HOUR_STONE: BeastDef = {
  id: 'hourstone',
  url: 'models/raid/hourstone.glb',
  // The model is 2.5 m to its tip; the bar floats over it.
  barY: 2.85,
  // Where a beam leaves its eye (stage.ts SHOT_Y).
  shotY: 1.9,
  pose(p, s) {
    const t = s.time;
    const x = Math.min(1, s.sinceShot / FLARE);
    // The shot's shape: 1 at the moment the beam leaves, easing to 0; `kick` is the first instants only.
    const th = s.sinceShot < FLARE ? 1 - x * x * (3 - 2 * x) : 0;
    const kick = Math.max(0, 1 - s.sinceShot / 0.1);
    const spin = ease(s, 'spin', 1 + 5 * th, 6);
    s.mem.band = (s.mem.band ?? s.seed * 6.28) + s.dt * 0.7 * spin;

    // The breath: the stone swells a little about its foot and the band rides it.
    const breath = Math.sin(t * 1.6 + s.seed * 6);
    p.size('body', 1 + 0.008 * breath);
    p.turn('body', 0.09 * th - 0.03 * kick, 0.02 * Math.sin(t * 0.4 + s.seed * 5), 0.01 * breath);
    p.turn('band', 0, s.mem.band, 0);
    p.move('band', 0, 0.035 * Math.sin(t * 1.3 + s.seed * 3), 0);

    // The eye: a low steady glow, a flare at the shot. The lid drops over it for a moment now and then, never while it shoots.
    const cyc = (t * 0.22 + s.seed * 3) % 1;
    const blink = th > 0.02 ? 0 : Math.max(0, 1 - Math.abs(cyc - 0.5) * 22);
    p.move('lid', 0, -0.075 * blink - 0.01 * Math.sin(t * 0.9), 0);
    p.glow('eye', 0.9 + 0.1 * Math.sin(t * 2.4 + s.seed * 4) + 1.6 * th * th - 0.6 * blink);
    p.glow('band', 1 + 0.5 * th);
  },
};

/** The look the stage's adds draw: the model, with the code look standing in until its file has landed. */
export const HOUR_STONE_LOOK = beastLook(HOUR_STONE, hourStoneLook, { speed: 0 });
