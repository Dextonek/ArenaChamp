import { cycle, type LandmarkPose } from '.';

/** The parts that glow, from the top of the rock down: the three veins of light, the six clusters (the nearer the lip, the higher), the great crystal. */
const LIGHT = ['vein1', 'vein2', 'vein3', 'crystal1', 'crystal2', 'crystal3', 'crystal4', 'crystal5', 'crystal6', 'core'];
const PERIOD = 22;

/**
 * The Crystal Cavern's Last Light (blender/arenas/landmarks/geode.py): a giant geode split open in the wall. The sun's last light runs down
 * the three gold veins into it and on through the amethyst, a slow pulse from the top down about every 22 s (each part a little later than
 * the one above it); a few small crystals on the floor grow and settle, each on its own long loop. Parts: vein1..3, core, crystal1..6,
 * grow1..3. Nothing moves fast or flashes: the glow lifts to about double and falls again.
 */
export const geodePose: LandmarkPose = (p, t) => {
  LIGHT.forEach((name, i) => {
    const u = (((t / PERIOD - i * 0.045) % 1) + 1) % 1;
    const wave = Math.pow(0.5 + 0.5 * Math.sin(u * Math.PI * 2 - Math.PI / 2), 2.2);
    p.glow(name, 0.45 + 1.1 * wave);
  });
  for (let i = 1; i <= 3; i++) {
    const g = cycle(t + i * 17, 52, 0.05, 0.3, 0.45, 0.6);
    const settle = 1 + 0.07 * Math.sin(Math.min(1, g) * Math.PI) * (g < 1 ? 1 : 0);
    p.size(`grow${i}`, Math.max(0.05, (0.55 + 0.45 * g) * settle));
  }
};
