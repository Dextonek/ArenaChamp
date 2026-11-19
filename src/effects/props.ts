import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fewerDraws } from '../tower/world/beasts';

/**
 * Still models for the heroes' spells (the user, 2026-11-19: "lets make more models for the heroes spells too";
 * docs/heroes/props/README.md): what a spell plants or places, built by script (blender/heroes/props/) and drawn from
 * models/heroes/props/<key>.glb. A spell asks `heroProp(key)` when it builds the thing: a copy once the file has landed (geometry and
 * materials shared), or null, and then it draws its own code shape as before. The first ask starts the file loading, so at most the
 * first one of a fight is drawn in code.
 */

const loads = new Map<string, Promise<THREE.Object3D | null>>();
const landed = new Map<string, THREE.Object3D>();
let loader: GLTFLoader | null = null;

/** Starts loading a prop's file (once). */
export function preloadHeroProp(key: string): Promise<THREE.Object3D | null> {
  let p = loads.get(key);
  if (!p) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(`models/heroes/props/${key}.glb`).then((g) => {
      // One draw call for the plain pieces of each part (a tree: bark, needles and moss in one), as the beasts.
      fewerDraws(g.scene);
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
      });
      landed.set(key, g.scene);
      return g.scene;
    }).catch((e) => {
      console.warn(`The spell model ${key} did not load; it stays drawn in code.`, e);
      return null;
    });
    loads.set(key, p);
  }
  return p;
}

/** A copy of a prop whose file has landed, or null (and its file starts loading). */
export function heroProp(key: string): THREE.Object3D | null {
  void preloadHeroProp(key);
  const src = landed.get(key);
  return src ? src.clone(true) : null;
}
