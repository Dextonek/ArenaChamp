import type { BeastDef } from '../../tower/world/beasts';
import { ease } from '../../tower/world/beasts';

/**
 * The Cinder Pit's Coal Heart (blender/raid/coalheart.py): a burning heart under a skin of cooling slag, held in a cage of five slag
 * shards, over a little cone of cooled lava. Parts: coalheart > base, heart, cage > shard1..shard5. It never walks (the stage's adds
 * stand where they rise). The model is Blender's, z up and facing -y, so in the file a shard's place round the heart is (cos a, 0, -sin a).
 *
 * The cage turns slowly and the shards bob each on its own beat; the heart pulses. At its shot (`pose.shot` jumps to 1 as the lob leaves) the
 * shards spread open and the heart flares, then the cage closes again within half a second.
 */
const SHARDS = 5, SPREAD = 0.4, OPEN = 0.5;

export const COAL_HEART: BeastDef = {
  id: 'coalheart',
  url: 'models/raid/coalheart.glb',
  // The bar over its top (the shards stand to 1.8 m).
  barY: 2.25,
  // The lob leaves the heart's centre.
  shotY: 1.35,
  pose(p, s) {
    const t = s.time;
    // 1 as the shot leaves, down to 0 over half a second.
    const x = Math.min(1, s.sinceShot / OPEN), th = s.sinceShot < OPEN ? 1 - x * x * (3 - 2 * x) : 0;
    // The cage: turning slowly, and for a moment faster as it opens.
    const open = ease(s, 'open', th, 14);
    p.turn('cage', 0, t * 0.7 + open * 0.6, 0);
    for (let k = 0; k < SHARDS; k++) {
      const a = 0.3 + (k * Math.PI * 2) / SHARDS, out = SPREAD * open;
      p.move(`shard${k + 1}`, Math.cos(a) * out, 0.05 * Math.sin(t * 1.7 + k * 1.3 + s.seed * 6) + 0.06 * open * (k % 2 ? 1 : -1), -Math.sin(a) * out);
      p.turn(`shard${k + 1}`, 0, 0, 0.18 * open * (k % 2 ? 1 : -1));
    }
    // The heart: a beat standing, a flare as the lob leaves.
    p.glow('heart', 0.9 + 0.2 * Math.sin(t * 5 + s.seed * 4) + 0.9 * open);
  },
};
