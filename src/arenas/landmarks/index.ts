import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BodyParts } from '../../raid/bodies/look';

/**
 * The arenas' landmarks (the user, 2026-11-19: "lets make more models for the arenas too and make them special";
 * docs/arenas/landmarks/README.md): one great living thing a arena, far out past the ring where the arenas' rules allow what is tall,
 * tied to the arena's realm. Each is a model of rigid parts built by script (blender/arenas/landmarks/<id>.py) and posed in code by
 * its own `pose` (one file a landmark here), through the bosses' `BodyParts`. It plays only for the eye: no hit, no cover, nothing
 * the fight reads, so it may run on each screen's own clock.
 *
 * Its file loads with the arena; until it lands nothing is drawn there. Its materials are dimmed a little, as the arenas' props are
 * (`dim`): the world stays behind the heroes.
 */

export type LandmarkPose = (p: BodyParts, t: number) => void;

let loader: GLTFLoader | null = null;
const loads = new Map<string, Promise<THREE.Object3D>>();

/** A landmark placed at (x, y, z) facing yaw `face` (its front is +z, toward the ring), posed by `pose` each frame. */
export function landmark(id: string, at: { x: number; y: number; z: number; face: number; scale?: number }, pose: LandmarkPose, dim = 0.85) {
  const group = new THREE.Group();
  group.position.set(at.x, at.y, at.z);
  group.rotation.y = at.face;
  group.scale.setScalar(at.scale ?? 1);
  let parts: BodyParts | null = null, gone = false;
  const mats: THREE.Material[] = [];
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let p = loads.get(id);
  if (!p) loads.set(id, (p = loader.loadAsync(`models/arenas/landmarks/${id}.glb`).then((g) => g.scene)));
  p.then((src) => {
    if (gone) return;
    const root = src.clone(true);
    const seen = new Map<THREE.Material, THREE.Material>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = false;
      const one = (mat: THREE.Material) => {
        let c = seen.get(mat);
        if (!c) {
          const std = (mat as THREE.MeshStandardMaterial).clone();
          std.color.multiplyScalar(dim);
          seen.set(mat, (c = std));
          mats.push(std);
        }
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
    });
    group.add(root);
    parts = new BodyParts(root);
  }).catch((e) => console.warn(`The landmark ${id} did not load.`, e));
  return {
    group,
    update(time: number) {
      if (!parts) return;
      parts.reset();
      pose(parts, time);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const m of mats) m.dispose();
    },
  };
}

/** 0 to 1 and back over a loop of `period` s: up from `a` to `b`, held, down from `c` to `d` (shares of the loop), eased. */
export function cycle(t: number, period: number, a: number, b: number, c: number, d: number) {
  const u = ((t % period) + period) % period / period;
  const ease = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
  if (u < a) return 0;
  if (u < b) return ease((u - a) / (b - a));
  if (u < c) return 1;
  if (u < d) return 1 - ease((u - c) / (d - c));
  return 0;
}
