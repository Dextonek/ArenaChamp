import * as THREE from 'three';
import type { ArenaStage } from './types';

/** The duel ring every arena is built around (same numbers as `RING` in duel.ts). */
export const RING = { x: 0, z: 7, r: 12 };

/** The stage the tool has outside a duel (main.ts): the night sky, fog over the far ground, warm sun, cool rim. */
export const DEFAULT_STAGE: ArenaStage = {
  background: 0x1a1f2b,
  zenith: 0x05070f,
  horizon: 0x232a40,
  glow: 0x4a3a4a,
  stars: 1,
  fog: 0x232a40,
  fogNear: 48,
  fogFar: 150,
  hemiSky: 0x9fb4ff,
  hemiGround: 0x20160f,
  hemiIntensity: 0.6,
  sun: 0xfff0d8,
  sunIntensity: 1.5,
  rim: 0x8fa8ff,
  rimIntensity: 0.9,
};

/** Marks a mesh as casting and receiving shadows. */
export const shadowed = <T extends THREE.Mesh>(m: T) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** A flat ring on the floor round the arena centre (rim lines, glowing bands). */
export function flatRing(inner: number, outer: number, color: number, opacity: number, y: number, segments = 128) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, segments),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(RING.x, y, RING.z);
  return m;
}

/**
 * A disc lying on the floor at the arena centre (radius `r`, at height `y`), for the arena floor or a wider terrain
 * apron round it. Keep floors in the luminance band of the default disc (`0x15131a`): every ultimate darkens the
 * world to 0.55 and the kits' dark layers need a dark floor to read on.
 */
export function floorDisc(r: number, material: THREE.Material, y = 0.012, segments = 96) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, segments), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(RING.x, y, RING.z);
  m.receiveShadow = true;
  return m;
}

/** A canvas texture drawn by `draw` (size × size px), repeating, sRGB. */
export function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, size: number) => void, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** A small seeded random generator (mulberry32), so an arena's scattered props look the same every time. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frees the geometries, materials and textures under `root`. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Points).isPoints) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    }
  });
}
