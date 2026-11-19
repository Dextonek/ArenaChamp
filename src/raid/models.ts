import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fewerDraws } from '../tower/world/beasts';

/**
 * The Raid's fight objects as models (the user, 2026-11-19: "lets make more models for the raid too"; docs/raid/models/README.md):
 * the stones that fall, the sun shards carried to the altar, the Heart's crust plates. Each is a still model built by script
 * (blender/raid/<key>.py), drawn from models/raid/<key>.glb. The fights load them as they begin (`preloadProps`); until a file has
 * landed, the object is drawn as it was in code (`propClone` returns null), so nothing waits on a file.
 *
 * The stage's adds (the Hour Stones, the Coal Hearts, the Cast shades) are posed models too, through the Climb's beasts' look
 * (src/tower/world/beasts, `BeastDef.url`).
 */

const loads = new Map<string, Promise<THREE.Object3D | null>>();
const landed = new Map<string, THREE.Object3D>();
let loader: GLTFLoader | null = null;

/** Starts loading a prop's file (once). */
export function preloadProp(key: string): Promise<THREE.Object3D | null> {
  let p = loads.get(key);
  if (!p) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(`models/raid/${key}.glb`).then((g) => {
      fewerDraws(g.scene);
      g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      landed.set(key, g.scene);
      return g.scene;
    }).catch((e) => {
      console.warn(`The raid model ${key} did not load; it stays drawn in code.`, e);
      return null;
    });
    loads.set(key, p);
  }
  return p;
}

/** Loads these props now (a fight as it begins). */
export function preloadProps(keys: string[]) {
  for (const k of keys) void preloadProp(k);
}

/** A copy of a prop that has landed (geometry and materials shared: a prop is never flashed or tinted), or null. */
export function propClone(key: string): THREE.Object3D | null {
  void preloadProp(key);
  const src = landed.get(key);
  return src ? src.clone(true) : null;
}
