import * as THREE from 'three';
import { clamp, lerp } from '../../core';
import type { Layers } from '../../piece';
import { Path, creature, drawCreature, loadCreature, pose } from '../../stage3d';
import type { DragonPose } from './dragon';

/**
 * The water dragon as a real 3D model (blender/creatures/dragon.py, "water"): one continuous body, bent every frame along
 * a spiral that rises out of the whirlpool, as the 2D dragon's path did (art/tide/dragon.ts). The whirlpool's centre is
 * the world's origin, the water at height 0; nothing under the water is drawn.
 */

export const DRAGON_URL = '/models/showpiece/water.glb';
export const loadDragon = () => loadCreature(DRAGON_URL);

/** How big the model is drawn (world units for each of its metres) and the spiral it climbs. */
const SCALE = 1.8;
const TURNS = 1.1;
const HEIGHT = 6.4;

let spiral: Path | null = null;
let deep = 0;

/** The path: straight up from deep under the whirlpool, then a widening spiral, its end turning towards the camera. */
function path() {
  if (spiral) return spiral;
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, -14, 0), new THREE.Vector3(0, -6, 0), new THREE.Vector3(0, -1.5, 0.2)];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const phi = -Math.PI / 2 - Math.PI * 2 * TURNS * (1 - u);
    const R = 0.8 + 3.0 * u ** 0.7;
    pts.push(new THREE.Vector3(Math.cos(phi) * R, HEIGHT * u, Math.sin(phi) * R));
  }
  // The last stretch comes round towards the viewer.
  pts.push(new THREE.Vector3(-0.8, HEIGHT + 0.7, 4.4), new THREE.Vector3(-0.2, HEIGHT + 0.9, 6.0));
  // Its back faces up and out, away from the spiral's axis; the belly towards the axis and down.
  spiral = new Path(pts, new THREE.Vector3(0, 0, 1), 900, (p) => {
    const out = new THREE.Vector3(p.x, 0, p.z);
    const r = out.length();
    return out.multiplyScalar(r > 0.01 ? 0.7 / r : 0).add(new THREE.Vector3(0, 1, 0.3));
  });
  // How far along the path the water's surface is.
  for (let i = 0; i < spiral.pts.length; i++) if (spiral.pts[i].y >= 0) { deep = i * spiral.step; break; }
  return spiral;
}

/** The 3D dragon, posed like the 2D one: `emerge` how far it has come up, the camera as the piece frames the whirlpool. */
export function dragon3d(L: Layers, p: DragonPose) {
  const c = creature(DRAGON_URL);
  if (!c) return;
  const sp = path();
  // Long enough that when the head reaches the path's end the tail is still in the water (as the drawn dragon's was).
  const above = sp.length - 0.3 - deep;
  const scale = Math.max(SCALE, Math.min(2.6, (above * 1.06) / c.length));
  // The head starts just under the water and ends at the path's end.
  const head = lerp(deep - 0.5, sp.length - 0.3, clamp(p.emerge));
  pose(c, sp, head, scale, 0);
  drawCreature(L, c, {
    eye: [0, 4.2, 19],
    at: [0, 4.0, 0],
    fov: 34,
    rim: 0x7ff6ec,
    key: 0xfff2dc,
    glow: p.light,
    clipBelow: 0.0,
  });

}
