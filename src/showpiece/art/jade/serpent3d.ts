import * as THREE from 'three';
import { clamp, lerp, smooth } from '../../core';
import type { Layers } from '../../piece';
import { Path, creature, drawCreature, loadCreature, pose } from '../../stage3d';
import type { Track } from './serpent';

/**
 * The jade serpent as a real 3D model (blender/creatures/dragon.py, "jade": one continuous body, twice the water dragon's
 * length, a closed mouth, swept jade crests), bent every frame along the same paths the drawn serpent followed.
 *
 * - **The glide** (the grove, seen from the side): the drawn serpent's track lifted into 3D as it is, one world unit for
 *   every 100 px, on the plane the camera looks straight at; so it passes between the same stalks.
 * - **The coil** (the dark, seen from above at a slant): a spiral on the ground, one and three quarter turns inwards, the
 *   neck rising in an S at the middle and the head turning to look out to the right.
 */

export const SERPENT_URL = '/models/showpiece/jade.glb';
export const loadSerpent = () => loadCreature(SERPENT_URL);

/** One world unit for every 100 picture units at the plane the camera looks at: the camera's distance for a 30° view. */
const D = 540 / (100 * Math.tan((15 * Math.PI) / 180));

const glidePaths = new WeakMap<Track, Path>();

/** The drawn serpent's track, in 3D on the picture's plane. */
function glidePath(track: Track) {
  let p = glidePaths.get(track);
  if (!p) {
    const pts: THREE.Vector3[] = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const q = track.at((track.total * i) / n);
      pts.push(new THREE.Vector3((q.x - 960) / 100, -(q.y - 540) / 100, 0));
    }
    // Its back up, tipped a little towards the camera so the crest shows.
    p = new Path(pts, new THREE.Vector3(0, 1, 0), 800, () => new THREE.Vector3(0, 1, 0.35));
    glidePaths.set(track, p);
  }
  return p;
}

/** The serpent gliding through the grove: `head` and `width` as the drawn pose had them (picture units along the track). */
export function serpentGlide3d(L: Layers, track: Track, head: number, width: number, glow: number) {
  const c = creature(SERPENT_URL);
  if (!c) return;
  const sp = glidePath(track);
  // Its girth as wide as the drawn one: the model is 0.52 m across at its thickest.
  const scale = width / 100 / 0.52;
  pose(c, sp, (head / track.total) * sp.length, scale, 0);
  drawCreature(L, c, { eye: [0, 0, D], at: [0, 0, 0], fov: 30, rim: 0xb8ffd8, key: 0xfffaf0, glow });
}

// --- The coil ---------------------------------------------------------------------------------------------------------
/** The camera's slant over the ground (the drawn coil's ellipse was 0.56 as tall as wide). */
const SLANT = Math.asin(0.56);
let coil: Path | null = null;

function coilPath() {
  if (coil) return coil;
  const pts: THREE.Vector3[] = [];
  // The tail's end comes in on a wide arc from outside the frame...
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, a = lerp(-1.3 * Math.PI, 0, u), r = lerp(16, 7, smooth(u));
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.0, Math.sin(a) * r));
  }
  // ...then closes in, one and three quarter turns...
  for (let i = 1; i <= 70; i++) {
    const u = i / 70, a = u * 1.75 * Math.PI * 2, r = lerp(7, 1.9, u);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.0, Math.sin(a) * r));
  }
  // ...and the neck rises off the inner ring in an S, bending over so the head looks out to the right.
  const last = pts[pts.length - 1].clone();
  const rise = [[0.0, 0.9, 0.3], [-0.3, 2.2, 0.6], [-0.2, 3.6, 0.7], [0.4, 4.6, 0.6], [1.3, 5.0, 0.5], [2.2, 4.85, 0.45]];
  for (const [dx, dy, dz] of rise) pts.push(new THREE.Vector3(last.x + dx, last.y + dy, last.z + dz));
  // The back faces up on the ground; on the rising neck it faces back (left), so the head's top stays up as it bends over.
  coil = new Path(pts, new THREE.Vector3(0, 1, 0), 1200, (_p, t) => {
    const v = clamp(Math.abs(t.y));
    return new THREE.Vector3(-v, 1 - v * 0.6, 0);
  });
  return coil;
}

/**
 * The serpent coiling: `go` (0 to 1) how far its head has come along the coil; the drawn coil's centre is at `centre`
 * (picture units).
 */
export function serpentCoil3d(L: Layers, go: number, centre: { x: number; y: number }, glow: number) {
  const c = creature(SERPENT_URL);
  if (!c) return;
  const sp = coilPath();
  const scale = 0.96 / 0.52;
  const head = lerp(sp.length * 0.36, sp.length - 0.2, clamp(go));
  pose(c, sp, head, scale, 0);
  drawCreature(L, c, {
    eye: [0, D * Math.sin(SLANT), D * Math.cos(SLANT)],
    at: [0, 0, 0],
    fov: 30,
    rim: 0x8cffc0,
    key: 0xf4fff0,
    glow,
    shift: [centre.x - 960, centre.y - 540],
  });
}
