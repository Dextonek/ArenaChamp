import * as THREE from 'three';
import type { GroundMark, TraitView } from '../../traits/types';
import { Slit } from './parts';

/**
 * Kagen's cut marks on the enemy's body (`Trait.marks` / `Trait.markLook`, drawn on both screens; the pips over the head stay).
 * One record per mark, 1 to 4, each its own kind (`cut0`..`cut3`): a thin cinnabar almond with a rice-paper rim, at its own
 * angle and height on the torso, standing in front of them and tilted a little toward the steep camera. It follows the enemy
 * (the engine asks every frame) and pops in when its mark comes (`t.mem`, the passive's scratch, keeps the births).
 * The look knows nothing of the marks' timer: they go when the passive's stacks go (opened, parried away or faded).
 */

/** Each mark: [angle (rad), height (m), sideways (m), length (m)]. Fixed, so the four never sit on top of each other. */
const SPOTS: readonly (readonly [number, number, number, number])[] = [
  [0.62, 1.28, -0.1, 0.8],
  [-0.7, 1.02, 0.14, 0.74],
  [0.2, 0.78, -0.14, 0.66],
  [-1.15, 1.46, 0.16, 0.6],
];

const KINDS = ['cut0', 'cut1', 'cut2', 'cut3'];

export function cutMarks(t: TraitView): GroundMark[] {
  const n = t.stacks('cut');
  const e = t.enemy();
  const m = t.mem;
  if (!e || n <= 0) {
    m.cutN = 0;
    return [];
  }
  // A mark born: its time is kept, so it can pop in; marks that went (opened, faded) are forgotten.
  if (n !== (m.cutN ?? 0)) {
    for (let i = 0; i < SPOTS.length; i++) {
      if (i >= n) m[`cutBorn${i}`] = 0;
      else if (i >= (m.cutN ?? 0) || !m[`cutBorn${i}`]) m[`cutBorn${i}`] = t.time;
    }
    m.cutN = n;
  }
  const p = e.group.position, out: GroundMark[] = [];
  for (let i = 0; i < n && i < SPOTS.length; i++) {
    out.push({ x: p.x, z: p.z, kind: KINDS[i], age: Math.max(0, t.time - (m[`cutBorn${i}`] ?? t.time)) + 0.05, life: 99 });
  }
  return out;
}

/** One mark's object: feet at y 0, the slash `SPOTS[i]` high on the body; the engine pops it in with its age. */
function slash(i: number): () => THREE.Object3D {
  return () => {
    const [angle, y, side, len] = SPOTS[i];
    const slit = new Slit(len, 0.05, angle, 0.03);
    const holder = new THREE.Group();
    // In front of the body, tipped back so the steep camera sees it face on.
    slit.group.position.set(side, y, 0.34);
    holder.add(slit.group);
    holder.rotation.x = 0;
    slit.group.rotation.x = -0.45;
    slit.open(1);
    return holder;
  };
}

export const cutLook: Record<string, () => THREE.Object3D> = {
  cut0: slash(0),
  cut1: slash(1),
  cut2: slash(2),
  cut3: slash(3),
};
