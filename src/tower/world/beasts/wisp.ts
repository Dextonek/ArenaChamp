import type { BeastDef } from '.';
import { ease } from '.';

/**
 * The wisp (blender/tower/beasts/wisp.py): a light of the Walking Wood that guides the lost, a quest's helper (it is led and never
 * fights). Parts: wisp > core > (cage, finL, finR, veil), mote1, mote2. It faces +z, its left +x. A positive turn about x leans a part
 * forward (its top toward +z); a positive turn about z tips it toward its right.
 *
 * It floats and bobs, the core a little ahead of the cage's sway; the fins beat slowly, faster when it moves; going, it leans into its
 * way, the veil streams out behind it and the two small lights lag and swing wide on their own beats.
 */
export const WISP: BeastDef = {
  id: 'wisp',
  // A third bigger than built: from the game's high camera it read small and thin beside the code look's ball of light.
  scale: 1.3,
  barY: 1.8,
  pose(p, s) {
    const t = s.time + s.seed * 7, g = s.gait;
    const lean = ease(s, 'lean', g, 4);
    // The bob: slow and deep standing, lighter going; the cage turns a little about its height.
    const bob = Math.sin(t * 2.2) * (0.07 - 0.03 * g) + Math.sin(t * 3.7 + 1) * 0.015;
    p.move('core', 0, bob, 0);
    p.turn('core', 0.22 * lean + 0.04 * Math.sin(t * 1.6), 0.5 * Math.sin(t * 0.8) * (1 - g), 0.05 * Math.sin(t * 1.9 + 0.5));
    p.size('core', 1 + Math.sin(t * 4.6) * 0.035);
    p.glow('core', 0.9 + 0.12 * Math.sin(t * 4.6));
    // The fins: a slow beat that quickens as it goes.
    const beat = Math.sin(t * (2.4 + 3.2 * g)) * (0.25 + 0.15 * g);
    p.turn('finL', 0, 0, -0.35 - beat);
    p.turn('finR', 0, 0, 0.35 + beat);
    // The veil streams out behind and ripples.
    p.turn('veil', -0.25 * lean + 0.1 * Math.sin(t * 3.1), 0.12 * Math.sin(t * 2.3), 0);
    // The followers: they hang behind, dip and drift on beats of their own, and fall further back when it goes.
    for (const [name, ph, wide, back] of [['mote1', 0.0, 0.1, 0.12], ['mote2', 1.7, 0.14, 0.22]] as [string, number, number, number][]) {
      const w = Math.sin(t * 2.6 - ph - 0.8);
      p.move(name, Math.sin(t * 2.0 + ph) * wide * (1 + g), 0.06 * w + bob * 0.5, back * lean * 0.6 + 0.03 * Math.cos(t * 1.7 + ph));
      p.glow(name, 0.85 + 0.15 * Math.sin(t * 5.1 + ph));
    }
  },
};
