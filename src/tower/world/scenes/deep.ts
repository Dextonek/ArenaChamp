import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import { rimAt } from '../land';
import type { DeepLook } from '../deepZone';
import type { DeepCave } from '../deepDepth';

/**
 * Scenes in the Deep (floors 31 to 40; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on
 * the maps, make actual scenarios and stuff"): small groups of props, 3 to 10 m across, that say what happened in the mine. Called from
 * deepDepth.ts, they go into the depth's own merged meshes (one per quarter of the floor on one material: no draw calls of their own).
 *
 * **Looks only, never cover:** nothing here stops a walk or a shot. In the Deep a cart, a crate, timber or a hut is cover, so on ground a
 * hero walks on only low things lie (bedrolls, ore spilled, timbers fallen flat, an open crate under knee height); anything taller (a cold
 * stove, a lamp on its post, picks leaned on the rock, a winch, a cart on its side) stands right south of existing cover (the camera looks
 * north, so it hides nobody), and the sunken boat lies out on the lake past the walkable edge. Every part keeps 3 m off the floor's
 * spots (keep.ts), off the tracks, the cover, the places' stands and the pools, and off the depth's own props.
 *
 * **Light:** the dark law reads only the floor's own lights (crystals, lamps, waystones). Here a glow is the depth's unlit `glow` vertex
 * colour (a lamp's glass, a candle's flame, crystal shards in a crate): it reads as lit and adds no light. Kept to a few small ones.
 *
 * Kinds: the miners' last camp, a cart off its rails with its ore spilled, a collapse (timbers and fallen rock), a crystal harvest
 * (open crates of shards), a survey left behind (a map weighted with stones, a spyglass, the tripod), a winch with its chain snapped,
 * a shrine of stacked stones with a candle; and past the edge, out on the black lake, a rowing boat half sunk, its lantern still lit.
 *
 * Every part's shape is built once for the page and copied into place by a matrix. Its own random stream: nothing that was there moves.
 */

/** A part's shape (deepDepth.ts's `Proto`): positions, normals and colours, not indexed. */
export interface Proto { pos: Float32Array; nor: Float32Array; col: Float32Array }
/** How a part is lit, as deepDepth.ts's batch reads it: matte, the gold's warmth, or unlit (reads as lit). */
export type Bucket = 'low' | 'metal' | 'glow';
export interface DeepSceneSink { put(b: Bucket, p: Proto, m: THREE.Matrix4): void }
export interface SceneItem { x: number; z: number; r: number; h: number; far: boolean }
export interface SceneRec { kind: string; where: string; x: number; z: number; yaw: number; items: SceneItem[] }

/** For the before-and-after pictures and the speed A/B: `VITE_NO_SCENES=1` at the dev server, or `window.__noScenes = true` before a floor is built. */
export { scenesOff };

/** The Deep's colours (deepDepth.ts's, the heroes' palette; violet is the Deep's own); `G` gold, `L` lit. */
const C = {
  rock: '#3a3a4c', rockLight: '#4c4a60', rockDark: '#2c2c3a', pale: '#b8b2cc', wood: '#4a3626', plank: '#5a3c26', darkWood: '#2a1f1a',
  cloth: '#4a3a6a', wine: '#5e1a28', cream: '#a89e86', sack: '#6e604a', rope: '#9a8250', iron: '#2a2c34', rail: '#55586a', ore: '#262632',
  ash: '#4a4650', char: '#1e1a1a', map: '#c8bc9c', ink: '#3a3040', violet: '#7a52c8',
} as const;
const GOLD = '#c9a24a', GLASS = '#ffcf80', FLAME = '#ffb050', SHARD = '#9a72e8';

// --- shapes (standing on y = 0 unless said) ------------------------------------------------------------------------------------------
type Part = [THREE.BufferGeometry, string];
const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
const ball = (r: number, w = 8, hs = 6) => new THREE.SphereGeometry(r, w, hs);
const ring = (R: number, t: number, rs = 4, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, rs, ts, arc);
const cone = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n).translate(0, h / 2, 0);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const oct = (r: number, h: number) => new THREE.OctahedronGeometry(1).scale(r, h / 2, r).translate(0, h / 2, 0);

/** One part, split by how it is lit: gold parts to `metal`, glass, flames and shards to `glow`, the rest `low`. */
type Kit = Partial<Record<Bucket, Proto>>;
function bake(parts: Part[]): Proto {
  let n = 0;
  const list = parts.map(([g, hex]) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    if (!ng.attributes.normal) ng.computeVertexNormals();
    n += ng.attributes.position.count;
    return { g: ng, c: new THREE.Color(hex) };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const { g, c } of list) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += k;
    g.dispose();
  }
  return { pos, nor, col };
}
function kit(parts: Part[]): Kit {
  const by: Record<Bucket, Part[]> = { low: [], metal: [], glow: [] };
  for (const p of parts) by[p[1] === GOLD ? 'metal' : p[1] === GLASS || p[1] === FLAME || p[1] === SHARD ? 'glow' : 'low'].push(p);
  const out: Kit = {};
  for (const b of ['low', 'metal', 'glow'] as Bucket[]) if (by[b].length) out[b] = bake(by[b]);
  return out;
}

let KITS: ReturnType<typeof makeKits> | null = null;
function makeKits() {
  const K = kit;
  const pickParts = (): Part[] => [[cyl(0.03, 0.03, 0.95, 6).rotateX(Math.PI / 2).translate(0, 0.035, 0), C.wood], [box(0.62, 0.06, 0.07, 0, 0.045, 0.46), C.rail], [box(0.09, 0.09, 0.09, 0, 0.045, 0.4), GOLD]];
  const wheel = (r: number): Part[] => [[cyl(r, r, 0.09, 12).rotateZ(Math.PI / 2), C.darkWood], [cyl(r * 0.35, r * 0.35, 0.11, 8).rotateZ(Math.PI / 2), C.iron]];
  return {
    unitWood: K([[new THREE.BoxGeometry(1, 1, 1), C.wood]]),
    unitRope: K([[new THREE.BoxGeometry(1, 1, 1), C.rope]]),
    unitPlank: K([[new THREE.BoxGeometry(1, 1, 1), C.plank]]),
    // --- the miners' last camp
    bedroll: K([[box(0.78, 0.1, 1.9), C.cloth], [box(0.8, 0.11, 0.5, 0, 0.055, -0.55), C.wine], [cyl(0.13, 0.13, 0.62, 8).rotateZ(Math.PI / 2).translate(0, 0.16, -0.78), C.cream], [box(0.8, 0.02, 0.05, 0, 0.11, 0.3), GOLD]]),
    rolled: K([[cyl(0.15, 0.15, 0.8, 10).rotateZ(Math.PI / 2).translate(0, 0.15, 0), C.cloth], [ring(0.155, 0.02, 4, 12).rotateY(Math.PI / 2).translate(0.25, 0.15, 0), C.rope], [ring(0.155, 0.02, 4, 12).rotateY(Math.PI / 2).translate(-0.25, 0.15, 0), C.rope]]),
    fireRing: K([
      ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return [ico(0.14).scale(1, 0.6, 1).translate(Math.cos(a) * 0.48, 0.06, Math.sin(a) * 0.48), k % 2 ? C.rockLight : C.pale] as Part; }),
      [cyl(0.38, 0.38, 0.015, 12), C.ash], [cyl(0.05, 0.05, 0.62, 6).rotateZ(Math.PI / 2).rotateY(0.6).translate(0, 0.07, 0), C.char], [cyl(0.05, 0.05, 0.55, 6).rotateZ(Math.PI / 2).rotateY(-0.7).translate(0, 0.11, 0), C.char],
    ]),
    kettle: K([[ball(0.14, 10, 7).scale(1, 0.85, 1).translate(0, 0.14, 0), C.iron], [cyl(0.02, 0.03, 0.14, 6).rotateZ(-0.8).translate(0.16, 0.16, 0), C.iron], [ring(0.1, 0.012, 4, 10, Math.PI).translate(0, 0.24, 0), GOLD]]),
    plates: K([[cyl(0.11, 0.1, 0.02, 12), C.rail], [cyl(0.11, 0.1, 0.02, 12).translate(0.3, 0, 0.12), C.rail], [cyl(0.05, 0.045, 0.1, 8).translate(-0.22, 0, 0.1), C.cream], [cyl(0.05, 0.045, 0.1, 8).rotateZ(Math.PI / 2).translate(0.1, 0.05, -0.25), C.cream]]),
    pack: K([[box(0.46, 0.3, 0.26), C.sack], [box(0.48, 0.05, 0.28, 0, 0.31), C.sack], [box(0.07, 0.08, 0.02, 0, 0.18, 0.14), GOLD]]),
    lampGround: K([[box(0.24, 0.05, 0.24, 0, 0.025), C.iron], [box(0.18, 0.24, 0.18, 0, 0.17), GLASS], [cone(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.29, 0), GOLD], [ring(0.07, 0.012, 4, 8, Math.PI).translate(0, 0.42, 0), C.iron]]),
    // the camp's tall things, against the rock: the cold stove, a lamp hung from a post, picks leaned on the rock
    stove: K([[cyl(0.36, 0.36, 0.75, 10).translate(0, 0.18, 0), C.iron], ...[0, 1, 2].map((k) => [box(0.06, 0.2, 0.06, Math.cos(k * 2.1) * 0.28, 0.1, Math.sin(k * 2.1) * 0.28), C.iron] as Part), [cyl(0.07, 0.07, 1.4, 6).translate(-0.18, 0.93, -0.12), C.iron], [ring(0.37, 0.025, 4, 14).rotateX(Math.PI / 2).translate(0, 0.93, 0), GOLD], [box(0.24, 0.16, 0.04, 0, 0.45, 0.35), C.char]]),
    lampPost: K([[cyl(0.07, 0.09, 2.2, 6), C.darkWood], [box(0.7, 0.07, 0.07, 0.3, 2.15), C.darkWood], [box(0.03, 0.4, 0.03, 0.58, 1.95), C.iron], [box(0.24, 0.05, 0.24, 0.58, 1.72), C.iron], [box(0.18, 0.24, 0.18, 0.58, 1.6), GLASS], [cone(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(0.58, 1.72, 0), GOLD]]),
    pickLeaning: K(pickParts().map(([g, c]) => [g.rotateX(-1.1).translate(0, 0.0, 0), c] as Part)),
    // --- a cart off its rails, on its side against the rock (its open top to the rock, -z), and its ore
    cartSide: K([
      [box(1.5, 1.0, 0.08, 0, 0.5, 0.36), C.rail], [box(1.5, 0.08, 0.72, 0, 0.04), C.rail], [box(1.5, 0.08, 0.72, 0, 0.96), C.rail], [box(0.08, 1.0, 0.72, 0.75, 0.5), C.rail], [box(0.08, 1.0, 0.72, -0.75, 0.5), C.rail],
      [box(1.52, 0.12, 0.1, 0, 0.3, 0.38), C.plank], [box(1.52, 0.12, 0.1, 0, 0.7, 0.38), C.plank],
      [box(1.58, 0.06, 0.06, 0, 1.0, -0.36), GOLD],
      ...[0.55, -0.55].flatMap((x) => [[cyl(0.26, 0.26, 0.09, 12).rotateX(Math.PI / 2).translate(x, 0.07, 0.5), C.darkWood], [cyl(0.26, 0.26, 0.09, 12).rotateX(Math.PI / 2).translate(x, 0.93, 0.5), C.darkWood]] as Part[]),
    ]),
    ore: K([
      [ico(0.34).scale(1.3, 0.55, 1.1).translate(0, 0.1, 0), C.ore], [ico(0.22).scale(1, 0.6, 1).translate(0.4, 0.08, 0.2), C.rock], [ico(0.2).scale(1, 0.6, 1).translate(-0.36, 0.07, 0.24), C.ore],
      [ico(0.15).translate(0.15, 0.06, -0.38), C.rockDark], [ico(0.13).translate(-0.25, 0.05, -0.3), C.ore], [ico(0.16).translate(0.55, 0.06, -0.15), C.ore],
    ]),
    chips: K([[oct(0.07, 0.24).rotateZ(0.4).translate(0.05, 0.02, 0), SHARD], [oct(0.06, 0.2).rotateX(-0.5).translate(-0.12, 0.02, 0.1), SHARD], [oct(0.05, 0.16).rotateZ(-0.6).translate(0.02, 0.02, -0.14), SHARD]]),
    wheelset: K([[cyl(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2).translate(0, 0.3, 0), C.iron], ...wheel(0.3).map(([g, c]) => [g.translate(0.55, 0.3, 0), c] as Part), ...wheel(0.3).map(([g, c]) => [g.translate(-0.55, 0.3, 0), c] as Part)]),
    rail: K([[box(0.09, 0.12, 3.2, 0, 0.06), C.rail], [box(0.09, 0.12, 2.0, 0, 0, 0).rotateX(0.18).translate(0.62, 0.2, 0.7), C.rail], [box(0.26, 0.14, 1.4, 0, 0.07, -0.9).rotateY(1.45), C.wood], [box(0.26, 0.14, 1.4, 0, 0.07, 0.6).rotateY(1.75), C.wood]]),
    // --- a collapse: timbers fallen, rock come down; a frame leaned on the rock; a miner's helmet with its lamp out
    timber: K([[box(0.24, 0.24, 3.0, 0, 0.12), C.wood], [box(0.26, 0.05, 0.26, 0, 0.12, 1.45).rotateX(Math.PI / 2).translate(0, 0, 0), C.darkWood]]),
    rubble: K([
      [ico(0.45).scale(1.2, 0.6, 1).translate(0, 0.2, 0), C.rock], [ico(0.32).scale(1, 0.7, 1.1).translate(0.6, 0.15, 0.3), C.rockLight], [ico(0.28).scale(1, 0.7, 1).translate(-0.55, 0.12, 0.35), C.rockDark],
      [ico(0.2).translate(0.2, 0.08, 0.7), C.rock], [ico(0.18).translate(-0.3, 0.07, -0.6), C.rockLight], [ico(0.24).scale(1, 0.6, 1).translate(0.75, 0.1, -0.45), C.rock],
    ]),
    frameLeaning: K([
      [box(0.22, 2.6, 0.22, -1.1, 1.3, 0).rotateX(-0.3), C.wood], [box(0.22, 2.4, 0.22, 1.1, 1.2, 0).rotateX(-0.36), C.wood],
      [box(2.7, 0.24, 0.26, 0, 0, 0).rotateZ(0.5).translate(0.2, 0.75, 0.3), C.darkWood], [box(0.3, 0.06, 0.3, -1.1, 0.25, 0.05), GOLD],
    ]),
    helmet: K([[new THREE.SphereGeometry(0.17, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.rail], [cyl(0.24, 0.24, 0.02, 12), C.rail], [cyl(0.05, 0.05, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0.1, 0.17), C.cream], [ring(0.17, 0.015, 4, 12).rotateX(Math.PI / 2).translate(0, 0.02, 0), GOLD]]),
    // --- a crystal harvest: open crates of shards, shards spilled on a tarp, cut stumps, the sledge and chisels
    crateShards: K([
      [box(0.7, 0.05, 0.5), C.plank], [box(0.7, 0.36, 0.05, 0, 0.2, 0.225), C.plank], [box(0.7, 0.36, 0.05, 0, 0.2, -0.225), C.plank], [box(0.05, 0.36, 0.42, 0.325, 0.2), C.plank], [box(0.05, 0.36, 0.42, -0.325, 0.2), C.plank],
      [box(0.72, 0.04, 0.52, 0, 0.36), GOLD],
      ...[[-0.18, -0.08, 0.3], [0.05, 0.06, -0.4], [0.2, -0.05, 0.5], [-0.05, 0.1, 0.2]].map(([x, z, t]) => [oct(0.07, 0.3).rotateZ(t).translate(x, 0.18, z), SHARD] as Part),
    ]),
    lid: K([[box(0.72, 0.05, 0.52), C.plank], [box(0.72, 0.052, 0.06, 0, 0.026, 0.15), C.darkWood], [box(0.72, 0.052, 0.06, 0, 0.026, -0.15), C.darkWood]]),
    tarp: K([[box(1.6, 0.02, 1.2, 0, 0.01), C.cloth], [box(1.6, 0.022, 0.08, 0, 0.012, 0.5), GOLD]]),
    stumps: K([[oct(0.18, 0.32).translate(0, -0.05, 0), C.violet], [oct(0.14, 0.24).translate(0.32, -0.04, 0.1), C.violet], [oct(0.12, 0.2).translate(-0.24, -0.04, 0.18), C.violet], [cyl(0.2, 0.18, 0.02, 6).translate(0, 0.2, 0), SHARD], [cyl(0.15, 0.13, 0.02, 6).translate(0.32, 0.14, 0.1), SHARD]]),
    sledge: K([[cyl(0.03, 0.03, 0.9, 6).rotateX(Math.PI / 2).translate(0, 0.04, 0), C.wood], [box(0.32, 0.14, 0.14, 0, 0.07, 0.48), C.iron], [box(0.04, 0.03, 0.22, 0.3, 0.015, -0.1), C.rail], [box(0.04, 0.03, 0.22, 0.4, 0.015, 0.05).rotateY(0.6), C.rail]]),
    // --- a survey left behind: a map weighted with stones, a spyglass, a compass, the tripod fallen (or standing against the rock)
    map: K([
      [box(1.0, 0.012, 0.7, 0, 0.006), C.map], [box(0.7, 0.014, 0.02, 0, 0.012, 0.1).rotateY(0.4), C.ink], [box(0.5, 0.014, 0.02, 0.1, 0.012, -0.12).rotateY(-0.7), C.ink], [box(0.02, 0.014, 0.4, -0.25, 0.012, 0), C.ink],
      [cyl(0.05, 0.05, 0.016, 8).translate(0.2, 0.012, 0.15), C.wine],
      ...[[0.45, 0.3], [-0.45, 0.3], [0.45, -0.3], [-0.45, -0.3]].map(([x, z]) => [ico(0.08).scale(1, 0.6, 1).translate(x, 0.04, z), C.rockLight] as Part),
    ]),
    spyglass: K([[cyl(0.035, 0.05, 0.62, 10).rotateZ(Math.PI / 2).translate(0, 0.05, 0), GOLD], [cyl(0.052, 0.052, 0.06, 10).rotateZ(Math.PI / 2).translate(0.2, 0.05, 0), C.iron], [cyl(0.07, 0.07, 0.02, 12).translate(0.1, 0, 0.3), GOLD], [cyl(0.055, 0.055, 0.025, 12).translate(0.1, 0.005, 0.3), C.cream]]),
    tripodLying: K([...[-0.12, 0, 0.12].map((a) => [cyl(0.025, 0.025, 1.5, 5).rotateZ(Math.PI / 2).rotateY(a).translate(0, 0.03, 0), C.wood] as Part), [cyl(0.08, 0.08, 0.1, 10).rotateZ(Math.PI / 2).translate(0.78, 0.08, 0), GOLD]]),
    tripod: K([
      ...[0, 2.1, 4.2].map((a) => [cyl(0.025, 0.025, 1.45, 5).translate(0, -1.45, 0).rotateZ(0.28).rotateY(a).translate(0, 1.45, 0), C.wood] as Part),
      [cyl(0.09, 0.09, 0.08, 10).translate(0, 1.38, 0), GOLD], [cyl(0.04, 0.06, 0.5, 10).rotateZ(Math.PI / 2).translate(0, 1.55, 0), GOLD], [box(0.12, 0.12, 0.08, 0, 1.5), C.iron],
    ]),
    board: K([[box(1.0, 0.7, 0.05, 0, 0, 0).rotateX(-0.25).translate(0, 0.45, 0), C.wood], [box(0.86, 0.56, 0.02, 0, 0, 0).rotateX(-0.25).translate(0, 0.46, 0.035), C.map], [box(0.5, 0.02, 0.01, 0, 0, 0).rotateX(-0.25).translate(0, 0.5, 0.05), C.ink]]),
    // --- a winch with its chain snapped (against the rock), the skip overturned and its ore out
    winch: K([[box(0.14, 1.1, 0.9, -0.7, 0.55), C.wood], [box(0.14, 1.1, 0.9, 0.7, 0.55), C.wood], [cyl(0.3, 0.3, 1.26, 10).rotateZ(Math.PI / 2).translate(0, 0.85, 0), C.rail], [box(0.06, 0.45, 0.06, 0.82, 0.68, 0.18), C.iron], [cyl(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(-0.6, 0.85, 0), GOLD], [cyl(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(0.6, 0.85, 0), GOLD]]),
    chain: K(Array.from({ length: 12 }, (_, k) => [ring(0.08, 0.022, 4, 8).rotateX(k % 2 ? Math.PI / 2 : 0).rotateY(k % 2 ? 0 : Math.PI / 2).translate(0, k % 2 ? 0.03 : 0.08, k * 0.13 + Math.sin(k * 0.9) * 0.05).rotateY(Math.sin(k * 0.5) * 0.2), C.rail] as Part)),
    hook: K([[ring(0.12, 0.03, 4, 10, Math.PI * 1.4).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.iron], [box(0.05, 0.05, 0.2, 0.12, 0.03, -0.1), C.iron]]),
    skip: K([[box(0.8, 0.5, 0.6, 0, 0, 0).rotateZ(Math.PI / 2 - 0.15).translate(0, 0.38, 0), C.iron], [box(0.82, 0.05, 0.62, 0, 0, 0).rotateZ(Math.PI / 2 - 0.15).translate(-0.24, 0.42, 0), GOLD]]),
    // --- a shrine of stacked stones with a candle
    cairn: K([[cyl(0.42, 0.46, 0.14, 7), C.rockLight], [cyl(0.32, 0.36, 0.12, 7).translate(0, 0.14, 0), C.pale], [cyl(0.22, 0.26, 0.1, 7).translate(0, 0.26, 0), C.rockLight], [cyl(0.14, 0.17, 0.08, 7).translate(0, 0.36, 0), C.pale]]),
    candle: K([[cyl(0.035, 0.035, 0.12, 8), C.cream], [cone(0.025, 0.07, 6).translate(0, 0.12, 0), FLAME]]),
    offering: K([[cyl(0.06, 0.06, 0.012, 10), GOLD], [cyl(0.05, 0.05, 0.012, 10).translate(0.12, 0, 0.05), GOLD], [oct(0.04, 0.14).rotateZ(0.5).translate(-0.12, 0, 0.04), SHARD]]),
    // --- a rowing boat half sunk in the black lake (past the edge, on the water's side): its bow up, its lantern still lit, an oar and a
    //     crate afloat
    hull: K([
      [new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.85, 0.5, 2.3).translate(0, 0.42, 0), C.plank],
      [box(1.5, 0.06, 0.32, 0, 0.32, 0.6), C.darkWood], [box(1.5, 0.06, 0.32, 0, 0.32, -0.7), C.darkWood],
      [ring(1, 0.035, 4, 24).rotateX(Math.PI / 2).scale(0.85, 1, 2.3).translate(0, 0.43, 0), GOLD],
      [box(0.03, 0.5, 0.03, 0, 0.65, 1.95), C.iron], [box(0.2, 0.24, 0.2, 0, 0.82, 2.0), GLASS], [cone(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.94, 2.0), GOLD],
    ]),
    oar: K([[cyl(0.03, 0.03, 2.0, 6).rotateZ(Math.PI / 2), C.wood], [box(0.5, 0.03, 0.16, 1.1, 0), C.wood]]),
    crateFloat: K([[box(0.6, 0.5, 0.6), C.plank], [box(0.62, 0.05, 0.62, 0, 0.12), C.darkWood], [box(0.62, 0.05, 0.62, 0, 0.38), C.darkWood]]),
  };
}

type Ks = ReturnType<typeof makeKits>;
type Op = { p: Kit; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; tilt: number; roll: number };
class Recipe {
  ops: Op[] = [];
  items: { x: number; z: number; r: number; h: number }[] = [];
  s(p: Kit, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) { this.ops.push({ p, x, y, z, yaw, sx, sy, sz, tilt, roll }); return this; }
  /** A unit shape stretched from a to b (`w` wide, `h` high). */
  beam(p: Kit, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h = w) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy);
    return this.s(p, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), w, h, len, -Math.atan2(dy, flat));
  }
  item(x: number, z: number, r: number, h: number) { this.items.push({ x, z, r, h }); return this; }
  get reach() { let m = 0; for (const it of this.items) m = Math.max(m, Math.hypot(it.x, it.z) + it.r); return m; }
}

type Make = (rc: Recipe, K: Ks, r: () => number, o: { backed: boolean; far: boolean }) => void;
const KINDS: Record<string, Make> = {
  // The miners' last camp: bedrolls (one still rolled), a cold fire ring and its kettle, tin plates and mugs, packs, a lamp on the
  // ground; against the rock, the cold stove, a lamp hung from its post and picks leaned on the rock.
  camp: (rc, K, r, o) => {
    const z0 = o.backed ? 1.3 : 0;
    if (o.backed) {
      rc.s(K.stove, -1.0, 0, -0.1, r() * 6).item(-1.0, -0.1, 0.45, 1.65);
      rc.s(K.lampPost, 0.2, 0, -0.35, -0.2).item(0.35, -0.3, 0.45, 2.2);
      rc.s(K.pickLeaning, 1.2, 0.35, -0.25, Math.PI + 0.2).s(K.pickLeaning, 1.55, 0.35, -0.2, Math.PI - 0.15).item(1.4, -0.1, 0.45, 0.95);
    }
    const a = r() * 0.4 - 0.2;
    rc.s(K.bedroll, -1.0, 0, z0 + 0.5, a).item(-1.0, z0 + 0.5, 1.0, 0.18);
    rc.s(K.bedroll, 0.1, 0, z0 + 0.7, a + 0.25).item(0.1, z0 + 0.7, 1.0, 0.18);
    if (r() < 0.6) rc.s(K.rolled, 1.2, 0, z0 + 0.3, 1.4 + r() * 0.3).item(1.2, z0 + 0.3, 0.45, 0.3);
    rc.s(K.fireRing, 0.4, 0, z0 + 2.1).item(0.4, z0 + 2.1, 0.62, 0.15);
    rc.s(K.kettle, 0.3, 0.1, z0 + 2.0, r() * 6);
    rc.s(K.plates, -0.8, 0, z0 + 2.2, r() * 6).item(-0.8, z0 + 2.2, 0.45, 0.1);
    rc.s(K.pack, 1.4, 0, z0 + 1.4, r() * 6).item(1.4, z0 + 1.4, 0.35, 0.36);
    if (!o.backed) rc.s(K.lampGround, -1.5, 0, z0 + 1.5, r()).item(-1.5, z0 + 1.5, 0.25, 0.45);
  },
  // A cart off its rails: against the rock, the cart itself on its side; on open ground its wheel set; the ore spilled with crystal chips
  // in it, a rail bent up, sleepers knocked askew.
  cart: (rc, K, r, o) => {
    const z0 = o.backed ? 1.2 : 0;
    if (o.backed) rc.s(K.cartSide, 0, 0, -0.1, (r() - 0.5) * 0.2).item(0, -0.1, 0.95, 1.05);
    else rc.s(K.wheelset, 0.6, 0, -0.6, r() * 6, 1, 1, 1, 0, Math.PI / 2 - 0.2).item(0.6, -0.6, 0.75, 0.35);
    rc.s(K.ore, -0.5, 0, z0 + 0.6, r() * 6, 1.2).item(-0.5, z0 + 0.6, 0.85, 0.3);
    rc.s(K.ore, 0.7, 0, z0 + 1.2, r() * 6, 0.8).item(0.7, z0 + 1.2, 0.6, 0.22);
    rc.s(K.chips, -0.3, 0.05, z0 + 0.8, r() * 6).s(K.chips, 0.9, 0.04, z0 + 1.0, r() * 6, 0.8);
    rc.s(K.rail, -1.6, 0, z0 + 0.4, 0.3 + r() * 0.4).item(-1.6, z0 + 0.4, 1.65, 0.45);
  },
  // A collapse: timbers fallen across each other, rock come down, a miner's helmet with its lamp out; against the rock, a frame leaned.
  collapse: (rc, K, r, o) => {
    const z0 = o.backed ? 1.1 : 0;
    if (o.backed) rc.s(K.frameLeaning, 0, 0, -0.2, (r() - 0.5) * 0.2).item(-0.6, -0.2, 0.75, 2.4).item(0.7, -0.15, 0.75, 2.2);
    rc.s(K.rubble, 0, 0, z0 + 0.4, r() * 6, 1.1).item(0, z0 + 0.4, 1.05, 0.48);
    rc.s(K.timber, -0.6, 0, z0 + 0.9, 1.2 + r() * 0.3, 1, 1, 1, 0.06).item(-0.6, z0 + 0.9, 1.6, 0.4);
    rc.s(K.timber, 0.8, 0.12, z0 + 0.6, 2.0 + r() * 0.3, 1, 1, 1, -0.05).item(0.8, z0 + 0.6, 1.6, 0.45);
    if (r() < 0.6) rc.s(K.timber, 0.2, 0, z0 + 1.9, 1.6 + r() * 0.4, 0.8).item(0.2, z0 + 1.9, 1.3, 0.25);
    rc.s(K.rubble, 1.6, 0, z0 + 1.6, r() * 6, 0.6).item(1.6, z0 + 1.6, 0.65, 0.3);
    rc.s(K.helmet, -1.4, 0.1, z0 + 1.9, r() * 6, 1, 1, 1, 0.4, 0.5).item(-1.4, z0 + 1.9, 0.3, 0.3);
  },
  // A crystal harvest: open crates of shards (their glow is the shards' own), the lid off, shards spilled on a tarp, cut stumps, the sledge.
  harvest: (rc, K, r) => {
    rc.s(K.crateShards, -0.6, 0, 0, r() * 0.6).item(-0.6, 0, 0.5, 0.45);
    if (r() < 0.7) rc.s(K.crateShards, 0.3, 0, -0.5, 1.3 + r() * 0.5).item(0.3, -0.5, 0.5, 0.45);
    rc.s(K.lid, -1.5, 0, 0.5, r() * 3, 1, 1, 1, 0.06);
    rc.s(K.tarp, 0.6, 0, 0.9, r() * 0.8 - 0.4).item(0.6, 0.9, 1.0, 0.1);
    rc.s(K.chips, 0.4, 0.02, 0.8, r() * 6).s(K.chips, 0.9, 0.02, 1.1, r() * 6, 0.8);
    rc.s(K.stumps, 1.8, 0, -0.4, r() * 6).item(1.8, -0.4, 0.5, 0.25);
    rc.s(K.sledge, -0.6, 0, 1.3, r() * 6).item(-0.6, 1.3, 0.55, 0.15);
    rc.item(-1.5, 0.5, 0.5, 0.1);
  },
  // A survey left behind: a map on the ground weighted with stones, a spyglass and a compass; the tripod fallen (or, against the rock,
  // standing over a board with the map pinned).
  survey: (rc, K, r, o) => {
    const z0 = o.backed ? 1.0 : 0;
    if (o.backed) rc.s(K.tripod, 0.8, 0, -0.1, r() * 6).item(0.8, -0.1, 0.5, 1.8).s(K.board, -0.6, 0, -0.35, (r() - 0.5) * 0.2).item(-0.6, -0.3, 0.55, 0.85);
    else rc.s(K.tripodLying, 1.2, 0, -0.5, r() * 0.8 - 0.4).item(1.3, -0.5, 0.9, 0.12);
    rc.s(K.map, 0, 0, z0 + 0.6, (r() - 0.5) * 0.5, 1.5, 1, 1.5).item(0, z0 + 0.6, 0.95, 0.08);
    rc.s(K.spyglass, -1.1, 0, z0 + 1.3, r() * 6, 1.4).item(-1.1, z0 + 1.3, 0.6, 0.12);
    rc.s(K.pack, 1.2, 0, z0 + 1.4, r() * 6).item(1.2, z0 + 1.4, 0.35, 0.36);
    if (r() < 0.5) rc.s(K.lampGround, -0.6, 0, z0 - 0.3 + (o.backed ? 0.5 : 0), r()).item(-0.6, z0 - 0.3 + (o.backed ? 0.5 : 0), 0.25, 0.45);
  },
  // A winch with its chain snapped (only against the rock): the chain on the ground, its hook, the skip overturned, its ore out.
  winch: (rc, K, r) => {
    rc.s(K.winch, 0, 0, -0.1, (r() - 0.5) * 0.2).item(0, -0.1, 0.9, 1.2);
    rc.s(K.chain, 0.3, 0, 0.5, 0.2 + r() * 0.4).item(0.6, 1.2, 0.85, 0.12);
    rc.s(K.hook, 0.9, 0, 2.1, r() * 6);
    rc.s(K.skip, -1.3, 0, 1.4, 0.4 + r() * 0.4).item(-1.3, 1.4, 0.55, 0.52);
    rc.s(K.ore, -0.7, 0, 2.0, r() * 6, 0.9).item(-0.7, 2.0, 0.65, 0.22);
    rc.item(0.9, 2.1, 0.25, 0.06);
  },
  // A shrine of stacked stones: a candle on top (its flame unlit, it adds no light), stubs at its foot, coins and a shard left.
  shrine: (rc, K, r) => {
    rc.s(K.cairn, 0, 0, 0, r() * 6, 1.4, 1.2, 1.4).item(0, 0, 0.66, 0.56);
    rc.s(K.candle, 0, 0.53, 0, 0, 1.2);
    rc.s(K.candle, 0.6, 0, 0.35, 0, 0.9).s(K.candle, -0.55, 0, 0.4, 0, 0.8);
    rc.s(K.offering, 0, 0, 0.75, r() * 6, 1.4);
    rc.item(0, 0.5, 0.95, 0.1);
  },
  // A rowing boat half sunk in the black lake (past the edge only), its bow up and its lantern still lit; an oar and a crate afloat.
  wreck: (rc, K, r) => {
    // drawn half again as large as the landing's boat: it is seen from far across the water
    rc.s(K.hull, 0, -0.8, 0, 0, 1.5, 1.5, 1.5, -0.32, (r() - 0.5) * 0.4).item(0, 0, 3.6, 1.5);
    rc.s(K.oar, 3.0, 0.0, 1.8, r() * 6, 1.5).item(3.0, 1.8, 1.8, 0.1);
    rc.s(K.crateFloat, -2.7, -0.45, -2.1, r() * 6, 1.5, 1.5, 1.5, 0.2, 0.25).item(-2.7, -2.1, 0.75, 0.4);
  },
};

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/** Knee height: anything taller stands south of a rock or past the edge. */
export const KNEE = 0.56;

export interface DeepScenesIn {
  look: DeepLook;
  cave: DeepCave;
  keep: { x: number; z: number }[];
  /** The depth's own props taller than a pebble (deepDepth.ts `props`), kept clear of. */
  props: { x: number; z: number; r: number }[];
  sink: DeepSceneSink;
  /** The black water's level (m). */
  waterLevel: number;
}

/** Plans and places one Deep floor's scenes. Returns what was placed (for the checks: the depth group's `userData.scenes`). */
export function deepScenes(o: DeepScenesIn) {
  const t0 = performance.now();
  if (scenesOff()) return { scenes: [] as SceneRec[], ms: 0 };
  const K = (KITS ??= makeKits());
  const { look, cave, keep, props, sink, waterLevel } = o;
  const rnd = seeded(73_517 + look.seed);
  const rim = look.rim;
  const tracks: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) tracks.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover = look.pieces.map((p) => p.o);
  const near = (x: number, z: number, ax: number, az: number, bx: number, bz: number, d: number) =>
    !((ax - x > d && bx - x > d) || (x - ax > d && x - bx > d) || (az - z > d && bz - z > d) || (z - az > d && z - bz > d));
  const trackClear = (x: number, z: number) => { let m = 1e9; for (const s of tracks) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return m; };
  const coverClear = (x: number, z: number) => { let m = 1e9; for (const c of cover) if (near(x, z, c.ax, c.az, c.bx, c.bz, 30)) m = Math.min(m, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r); return m; };
  const keepClear = (x: number, z: number) => { let m = 1e9; for (const k of keep) m = Math.min(m, Math.hypot(x - k.x, z - k.z)); return m; };
  const placeClear = (x: number, z: number) => { let m = 1e9; for (const p of look.places) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r); return m; };
  const propClear = (x: number, z: number) => { let m = 1e9; for (const s of props) m = Math.min(m, Math.hypot(x - s.x, z - s.z) - s.r); return m; };
  const poolClear = (x: number, z: number) => {
    let m = 1e9;
    for (const f of look.pools) {
      const c = Math.cos(-(f.rot ?? 0)), s = Math.sin(-(f.rot ?? 0)), lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
      m = Math.min(m, (Math.hypot(lx / f.rx, lz / f.rz) - 1) * Math.min(f.rx, f.rz));
    }
    return m;
  };
  const beyond = (x: number, z: number) => cave.beyond(x - RING.x, z - RING.z);
  const backedAt = (x: number, z: number, r: number) => coverClear(x, z - r - 0.6) < 0.5 && coverClear(x, z) < r + 1.2;

  const placed: SceneRec[] = [];
  const used = new Map<string, number>();
  const cap: Record<string, number> = {};
  for (const k of Object.keys(KINDS)) cap[k] = 3 + Math.floor(rnd() * 2);
  cap.wreck = rnd() < 0.8 ? 1 : 0; cap.shrine = 2; cap.winch = 1 + (rnd() < 0.5 ? 1 : 0);
  const off = ['camp', 'cart', 'collapse', 'harvest', 'survey'];
  cap[off[Math.floor(rnd() * off.length)]] = 1; // one kind this floor has little of
  cap[off[Math.floor(rnd() * off.length)]] += 2; // and one it has more of
  const left = (k: string) => (cap[k] ?? 0) - (used.get(k) ?? 0);

  const world = (rc: Recipe, x: number, z: number, yaw: number, far: boolean): SceneItem[] => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return rc.items.map((it) => ({ x: x + it.x * c + it.z * s, z: z - it.x * s + it.z * c, r: it.r, h: it.h, far }));
  };
  const fits = (items: SceneItem[], far: boolean) => {
    for (const it of items) {
      const b = beyond(it.x, it.z), dx = it.x - RING.x, dz = it.z - RING.z;
      if (far) {
        // on the black lake, well out from the edge, not in the south (the camera's side)
        if (b < it.r + 3.2 || b > 24 || cave.south(dx, dz) > 0.2 || cave.water(dx, dz) < 0.9 || cave.height(dx, dz) > waterLevel - 0.6) return false;
      } else {
        if (b > -(it.r + 1.2) || cave.water(dx, dz) > 0.02) return false;
        if (coverClear(it.x, it.z) < it.r + 0.15) return false;
        if (it.h > KNEE && !backedAt(it.x, it.z, it.r)) return false;
        if (poolClear(it.x, it.z) < it.r + 0.6) return false;
      }
      if (keepClear(it.x, it.z) < it.r + 3.2) return false;
      if (trackClear(it.x, it.z) < it.r + 2.4) return false;
      if (placeClear(it.x, it.z) < it.r + 2.6) return false;
      if (propClear(it.x, it.z) < it.r + 0.4) return false;
      if (look.middle && Math.hypot(it.x - look.middle.x, it.z - look.middle.z) < it.r + 7) return false;
      for (const sc of placed) for (const q of sc.items) if (Math.hypot(it.x - q.x, it.z - q.z) < it.r + q.r + 1.5) return false;
    }
    return true;
  };
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const emit = (rc: Recipe, x: number, y: number, z: number, yaw: number) => {
    M.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S.set(1, 1, 1));
    for (const op of rc.ops) {
      L.compose(V.set(op.x, op.y, op.z), Q.setFromEuler(E.set(op.tilt, op.yaw, op.roll, 'YXZ')), S.set(op.sx, op.sy, op.sz)).premultiply(M);
      for (const b of ['low', 'metal', 'glow'] as Bucket[]) { const p = op.p[b]; if (p) sink.put(b, p, L); }
    }
  };
  const tryAt = (kind: string, where: string, x: number, z: number, yaw0: number, o2: { backed?: boolean; far?: boolean; spread?: number } = {}) => {
    if (left(kind) <= 0 || placed.length >= 24) return false;
    const far = !!o2.far, backed = !!o2.backed;
    for (const sc of placed) if (Math.hypot(sc.x - x, sc.z - z) < (sc.kind === kind ? 30 : 12)) return false;
    for (let t = 0; t < 3; t++) {
      const rc = new Recipe();
      KINDS[kind](rc, K, rnd, { backed, far });
      const yaw = yaw0 + (t === 0 ? 0 : (rnd() - 0.5) * (o2.spread ?? 0.8));
      const items = world(rc, x, z, yaw, far);
      if (!fits(items, far)) continue;
      const y = far ? waterLevel : 0;
      emit(rc, x, y, z, yaw);
      placed.push({ kind, where, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), items: items.map((it) => ({ ...it, x: +it.x.toFixed(2), z: +it.z.toFixed(2) })) });
      used.set(kind, (used.get(kind) ?? 0) + 1);
      return true;
    }
    return false;
  };
  const shuffle = <T,>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
  const pick = (list: string[]) => shuffle(list.filter((k) => left(k) > 0)).sort((a, b) => left(b) - left(a));

  // 1. Shrines where a track ends on another.
  for (const p of look.paths) {
    for (const end of [p[0], p[p.length - 1]]) {
      const x = RING.x + end[0], z = RING.z + end[1];
      if (tracks.filter((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 3).length < 2 || placeClear(x, z) < 6) continue;
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, d = 4.4 + rnd() * 2; if (tryAt('shrine', 'fork', x + Math.cos(a) * d, z + Math.sin(a) * d, rnd() * 6)) break; }
    }
  }
  // 2. By the places that suit them: the last camp by the rest, a cart by the yard, a collapse or a winch by the shaft, a harvest by the
  //    crystal halls, a survey by the shore and the pools, a shrine by the well.
  const SUITS: Record<string, string[]> = { rest: ['camp'], yard: ['cart'], shaft: ['winch', 'collapse'], hall: ['harvest'], shore: ['survey'], pools: ['survey', 'shrine'], well: ['shrine'], camp: ['camp'] };
  for (const pl of shuffle(look.places.slice())) {
    for (const kind of SUITS[pl.kind ?? ''] ?? []) {
      const needsBack = kind === 'winch';
      let done = false;
      for (let k = 0; k < 40 && !done; k++) {
        const a = rnd() * Math.PI * 2, d = pl.r + 4 + rnd() * 7, x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        if (needsBack) {
          const c = cover.find((q) => q.r > 0.7 && segDist(x, z, q.ax, q.az, q.bx, q.bz) < q.r + 3);
          if (!c) continue;
          const t = rnd(), cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
          done = tryAt(kind, 'place', cx, cz + c.r + 1.2, (rnd() - 0.5) * 0.3, { backed: true, spread: 0.3 });
        } else done = tryAt(kind, 'place', x, z, rnd() * 6);
      }
    }
  }
  // 3. Along the tracks, on the verge: one every 40 to 55 m of track.
  let since = 15 + rnd() * 20, onTracks = 0;
  for (const s of shuffle(tracks.slice())) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 3; d < len - 3; d += 3) {
      since += 3;
      if (since < 40 + rnd() * 15 || onTracks >= 7) continue; // leave room for the tall ones against the rock
      const side = rnd() < 0.5 ? 1 : -1, cx = s.ax + ux * d, cz = s.az + uz * d;
      for (const kind of pick(['camp', 'cart', 'collapse', 'harvest', 'survey', 'shrine'])) {
        let ok = false;
        for (const extra of [0.6, 1.8]) {
          const rc = new Recipe(); KINDS[kind](rc, K, rnd, { backed: false, far: false });
          const offd = 2.4 + rc.reach + extra, x = cx - uz * side * offd, z = cz + ux * side * offd;
          if (tryAt(kind, 'track', x, z, Math.atan2(ux, uz) + (rnd() - 0.5) * 0.6)) { ok = true; onTracks++; break; }
        }
        if (ok) { since = 0; break; }
      }
    }
  }
  // 4. Against the rock: the tall stories stand right south of a piece of cover.
  const rocks = shuffle(cover.filter((c) => c.r >= 0.7 && beyond(c.ax, c.az) < -3));
  let backedN = 0;
  for (const c of rocks) {
    if (backedN >= 5) break;
    const t = 0.2 + rnd() * 0.6, cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
    for (const kind of pick(['camp', 'cart', 'collapse', 'survey', 'winch'])) {
      const back = kind === 'camp' ? 0.95 : kind === 'cart' ? 1.25 : kind === 'collapse' ? 1.15 : kind === 'survey' ? 1.05 : 1.2;
      if (tryAt(kind, 'backed', cx, cz + c.r + back, (rnd() - 0.5) * 0.3, { backed: true, spread: 0.3 })) { backedN++; break; }
    }
  }
  // 5. The open cave floor between the places (a few).
  const rmax = Math.max(...rim);
  for (let k = 0, open = 0; k < 900 && open < 4; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyond(x, z) > -6 || trackClear(x, z) < 7 || placeClear(x, z) < 6) continue;
    for (const kind of pick(['camp', 'cart', 'collapse', 'harvest', 'survey', 'shrine'])) if (tryAt(kind, 'open', x, z, rnd() * 6)) { open++; break; }
  }
  // 6. Past the edge on the water's side (never the south): a boat half sunk in the black lake.
  for (let k = 0; k < 120 && left('wreck') > 0; k++) {
    const a = rnd() * Math.PI * 2, rr = rimAt(rim, a) + 7 + rnd() * 8, x = RING.x + Math.cos(a) * rr, z = RING.z + Math.sin(a) * rr;
    tryAt('wreck', 'far', x, z, rnd() * 6, { far: true, spread: 1 });
  }
  return { scenes: placed, ms: +(performance.now() - t0).toFixed(1) };
}
