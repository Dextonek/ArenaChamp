import { cycle, type LandmarkPose } from '.';

/**
 * The Drowned Harbour's Harbour Serpent (blender/arenas/landmarks/serpent.py): three arches of its body bob in the bay, its fluke
 * sways; about every 40 s its neck rises out of the water, looks over the quay, opens its jaws once, and sinks again. Parts:
 * neck1 > neck2 > neck3 > head > jaw, arch1..arch3, fluke. In the model's space y is up and +z its front (toward the quay).
 */
export const serpentPose: LandmarkPose = (p, t) => {
  for (let i = 1; i <= 3; i++) {
    p.move(`arch${i}`, 0, -0.5 + 0.6 * Math.sin(t * 0.35 + i * 1.3), 0);
    p.turn(`arch${i}`, 0, 0, 0.05 * Math.sin(t * 0.3 + i));
  }
  p.move('fluke', 0, -0.3 + 0.5 * Math.sin(t * 0.4 + 4), 0);
  p.turn('fluke', 0, 0.25 * Math.sin(t * 0.5), 0);
  // The neck: under the water most of the time, up for a while each loop.
  const up = cycle(t, 40, 0.1, 0.25, 0.7, 0.85);
  p.move('neck1', 0, -10 * (1 - up), 1.5 * (1 - up));
  p.turn('neck1', 0.25 * (1 - up) + 0.03 * Math.sin(t * 0.6), 0.25 * Math.sin(t * 0.2) * up, 0);
  p.turn('neck2', 0.04 * Math.sin(t * 0.5 + 1), 0.3 * Math.sin(t * 0.27 + 2) * up, 0);
  p.turn('head', 0.08 * Math.sin(t * 0.45 + 2), 0.2 * Math.sin(t * 0.33) * up, 0);
  // Its jaws open once while it looks.
  const roar = cycle(t, 40, 0.42, 0.46, 0.5, 0.56);
  p.turn('jaw', 0.05 + 0.5 * roar, 0, 0);
  p.turn('head', -0.25 * roar, 0, 0);
};
