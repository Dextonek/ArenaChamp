import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import { rimAt } from '../land';
import type { DeepLook } from '../deepZone';
import type { DeepCave } from '../deepDepth';

/**
 * Scenes in the Deep (floors 31 to 40; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on
 * the maps, make actual scenarios and stuff", then "continue more refine"): groups of props, 5 to 12 m across, that say from the game's
 * camera what happened in the mine. Called from deepDepth.ts, they go into the depth's own merged meshes (one per quarter of the floor
 * on one material: no draw calls of their own), and each scene's ground is painted into the cave floor's canvas before it goes to the
 * graphics card (deepZone.ts hands it over): trodden ground, ash, ore and rock dust, puddles, and footprints or drag marks to the track.
 *
 * **Looks only, never cover:** nothing here stops a walk or a shot. In the Deep a cart, a crate, timber or a hut is cover, so on ground a
 * hero walks on only low things lie (a tarp with bedrolls, ore tubs under the knee, a great heap of fallen rock, a lift's cage crushed
 * flat); anything taller (a cold stove, a lamp on its post, a winch, a cart or a cage on its side) stands right south of existing cover
 * (the camera looks north, so it hides nobody), and the sunken boat lies out on the lake past the walkable edge. Every part keeps 3 m off
 * the floor's spots (keep.ts), off the tracks, the cover, the places' stands and the pools, and off the depth's own props.
 *
 * **Light:** the dark law reads only the floor's own lights (crystals, lamps, waystones). Here a glow is the depth's unlit `glow` vertex
 * colour (a lamp's glass, a candle's flame, crystal shards in a crate): it reads as lit and adds no light. Kept to a few small ones.
 *
 * Kinds, most with two ways of being: the miners' last camp (a tarp with bedrolls, or the table fallen flat), a cart off its rails (an
 * ore tub upside down, or the cart on its side against a rock), a collapse (a great heap of pale fallen rock under its timbers), a
 * crystal harvest, a survey left behind (its measuring line pegged across the floor), a winch with its chain snapped (against a rock),
 * a shrine of stacked stones, a derailed train at a rail junction (three ore tubs, one still on the rails), a lift's cage fallen at the
 * shaft's foot (on its side against a rock), a camp flooded by the lake; past the edge, a rowing boat half sunk in the black lake.
 * Between the scenes, single props on the verges (ore, a dropped lamp, a pick, a helmet) join them up along the tracks.
 *
 * Every part's shape is built once for the page and copied into place by a matrix. Its own random stream: nothing that was there moves.
 */

/** A part's shape (deepDepth.ts's `Proto`): positions, normals and colours, not indexed. */
export interface Proto { pos: Float32Array; nor: Float32Array; col: Float32Array }
/** How a part is lit, as deepDepth.ts's batch reads it: matte, the gold's warmth, or unlit (reads as lit). */
export type Bucket = 'low' | 'metal' | 'glow';
export interface DeepSceneSink { put(b: Bucket, p: Proto, m: THREE.Matrix4): void }
export interface SceneItem { x: number; z: number; r: number; h: number; far: boolean }
/** A placed scene: `main` is its main piece (the views probe's); `echo`: a single prop dropped between the scenes, not a scene. */
export interface SceneRec { kind: string; where: string; x: number; z: number; yaw: number; items: SceneItem[]; main?: { x: number; z: number }; echo?: boolean }

/** For the before-and-after pictures and the speed A/B: `VITE_NO_SCENES=1` at the dev server, or `window.__noScenes = true` before a floor is built. */
export { scenesOff };

/** The Deep's colours (deepDepth.ts's, the heroes' palette; violet is the Deep's own); `G` gold, `L` lit. */
const C = {
  rock: '#3a3a4c', rockLight: '#4c4a60', rockDark: '#2c2c3a', pale: '#b8b2cc', wood: '#4a3626', plank: '#5a3c26', darkWood: '#2a1f1a',
  cloth: '#4a3a6a', wine: '#5e1a28', cream: '#a89e86', sack: '#6e604a', rope: '#9a8250', iron: '#2a2c34', rail: '#55586a', ore: '#262632',
  ash: '#4a4650', char: '#1e1a1a', map: '#c8bc9c', ink: '#3a3040', violet: '#7a52c8', black: '#08080c', rubble: '#6a6680',
} as const;
const GOLD = '#c9a24a', GLASS = '#ffcf80', FLAME = '#ffb050', SHARD = '#9a72e8';

// --- shapes (standing on y = 0 unless said) ------------------------------------------------------------------------------------------
type Part = [THREE.BufferGeometry, string];
const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
/** A cylinder centred on its middle (`cyl` stands on its base): for the ones laid on their side. */
const rod = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
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
  const pickParts = (): Part[] => [[rod(0.03, 0.03, 0.95, 6).rotateX(Math.PI / 2).translate(0, 0.035, 0), C.wood], [box(0.62, 0.06, 0.07, 0, 0.045, 0.46), C.rail], [box(0.09, 0.09, 0.09, 0, 0.045, 0.4), GOLD]];
  const wheel = (r: number): Part[] => [[cyl(r, r, 0.09, 12).rotateZ(Math.PI / 2), C.darkWood], [cyl(r * 0.35, r * 0.35, 0.11, 8).rotateZ(Math.PI / 2), C.iron]];
  return {
    unitWood: K([[new THREE.BoxGeometry(1, 1, 1), C.wood]]),
    unitRope: K([[new THREE.BoxGeometry(1, 1, 1), C.rope]]),
    unitPlank: K([[new THREE.BoxGeometry(1, 1, 1), C.plank]]),
    // --- the miners' last camp
    bedroll: K([[box(0.78, 0.1, 1.9), C.cloth], [box(0.8, 0.11, 0.5, 0, 0.055, -0.55), C.wine], [rod(0.13, 0.13, 0.62, 8).rotateZ(Math.PI / 2).translate(0, 0.16, -0.78), C.cream], [box(0.8, 0.02, 0.05, 0, 0.11, 0.3), GOLD]]),
    rolled: K([[rod(0.15, 0.15, 0.8, 10).rotateZ(Math.PI / 2).translate(0, 0.15, 0), C.cloth], [ring(0.155, 0.02, 4, 12).rotateY(Math.PI / 2).translate(0.25, 0.15, 0), C.rope], [ring(0.155, 0.02, 4, 12).rotateY(Math.PI / 2).translate(-0.25, 0.15, 0), C.rope]]),
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
    wheelset: K([[rod(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2).translate(0, 0.3, 0), C.iron], ...wheel(0.3).map(([g, c]) => [g.translate(0.55, 0.3, 0), c] as Part), ...wheel(0.3).map(([g, c]) => [g.translate(-0.55, 0.3, 0), c] as Part)]),
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
    sledge: K([[rod(0.03, 0.03, 0.9, 6).rotateX(Math.PI / 2).translate(0, 0.04, 0), C.wood], [box(0.32, 0.14, 0.14, 0, 0.07, 0.48), C.iron], [box(0.04, 0.03, 0.22, 0.3, 0.015, -0.1), C.rail], [box(0.04, 0.03, 0.22, 0.4, 0.015, 0.05).rotateY(0.6), C.rail]]),
    // --- a survey left behind: a map weighted with stones, a spyglass, a compass, the tripod fallen (or standing against the rock)
    map: K([
      [box(1.0, 0.012, 0.7, 0, 0.006), C.map], [box(0.7, 0.014, 0.02, 0, 0.012, 0.1).rotateY(0.4), C.ink], [box(0.5, 0.014, 0.02, 0.1, 0.012, -0.12).rotateY(-0.7), C.ink], [box(0.02, 0.014, 0.4, -0.25, 0.012, 0), C.ink],
      [cyl(0.05, 0.05, 0.016, 8).translate(0.2, 0.012, 0.15), C.wine],
      ...[[0.45, 0.3], [-0.45, 0.3], [0.45, -0.3], [-0.45, -0.3]].map(([x, z]) => [ico(0.08).scale(1, 0.6, 1).translate(x, 0.04, z), C.rockLight] as Part),
    ]),
    spyglass: K([[rod(0.035, 0.05, 0.62, 10).rotateZ(Math.PI / 2).translate(0, 0.05, 0), GOLD], [rod(0.052, 0.052, 0.06, 10).rotateZ(Math.PI / 2).translate(0.2, 0.05, 0), C.iron], [cyl(0.07, 0.07, 0.02, 12).translate(0.1, 0, 0.3), GOLD], [cyl(0.055, 0.055, 0.025, 12).translate(0.1, 0.005, 0.3), C.cream]]),
    tripodLying: K([...[-0.12, 0, 0.12].map((a) => [rod(0.025, 0.025, 1.5, 5).rotateZ(Math.PI / 2).rotateY(a).translate(0, 0.03, 0), C.wood] as Part), [rod(0.08, 0.08, 0.1, 10).rotateZ(Math.PI / 2).translate(0.78, 0.08, 0), GOLD]]),
    tripod: K([
      ...[0, 2.1, 4.2].map((a) => [cyl(0.025, 0.025, 1.45, 5).translate(0, -1.45, 0).rotateZ(0.28).rotateY(a).translate(0, 1.45, 0), C.wood] as Part),
      [cyl(0.09, 0.09, 0.08, 10).translate(0, 1.38, 0), GOLD], [rod(0.04, 0.06, 0.5, 10).rotateZ(Math.PI / 2).translate(0, 1.55, 0), GOLD], [box(0.12, 0.12, 0.08, 0, 1.5), C.iron],
    ]),
    board: K([[box(1.0, 0.7, 0.05, 0, 0, 0).rotateX(-0.25).translate(0, 0.45, 0), C.wood], [box(0.86, 0.56, 0.02, 0, 0, 0).rotateX(-0.25).translate(0, 0.46, 0.035), C.map], [box(0.5, 0.02, 0.01, 0, 0, 0).rotateX(-0.25).translate(0, 0.5, 0.05), C.ink]]),
    // --- a winch with its chain snapped (against the rock), the skip overturned and its ore out
    winch: K([[box(0.14, 1.1, 0.9, -0.7, 0.55), C.wood], [box(0.14, 1.1, 0.9, 0.7, 0.55), C.wood], [rod(0.3, 0.3, 1.26, 10).rotateZ(Math.PI / 2).translate(0, 0.85, 0), C.rail], [box(0.06, 0.45, 0.06, 0.82, 0.68, 0.18), C.iron], [rod(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(-0.6, 0.85, 0), GOLD], [rod(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(0.6, 0.85, 0), GOLD]]),
    chain: K(Array.from({ length: 12 }, (_, k) => [ring(0.08, 0.022, 4, 8).rotateX(k % 2 ? Math.PI / 2 : 0).rotateY(k % 2 ? 0 : Math.PI / 2).translate(0, k % 2 ? 0.03 : 0.08, k * 0.13 + Math.sin(k * 0.9) * 0.05).rotateY(Math.sin(k * 0.5) * 0.2), C.rail] as Part)),
    hook: K([[ring(0.12, 0.03, 4, 10, Math.PI * 1.4).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.iron], [box(0.05, 0.05, 0.2, 0.12, 0.03, -0.1), C.iron]]),
    // the skip tipped onto its side, its mouth to the ore (low: it lies on open floor before the winch)
    skip: K([[box(0.8, 0.5, 0.6, 0, 0, 0).rotateZ(0.25).translate(0, 0.25, 0), C.iron], [box(0.05, 0.52, 0.62, 0, 0, 0).rotateZ(0.25).translate(-0.4, 0.15, 0), GOLD]]),
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
    oar: K([[rod(0.03, 0.03, 2.0, 6).rotateZ(Math.PI / 2), C.wood], [box(0.5, 0.03, 0.16, 1.1, 0), C.wood]]),
    crateFloat: K([[box(0.6, 0.5, 0.6), C.plank], [box(0.62, 0.05, 0.62, 0, 0.12), C.darkWood], [box(0.62, 0.05, 0.62, 0, 0.38), C.darkWood]]),
    // --- the refinement (2026-11-14, "continue more refine"): larger, low main pieces that read from the game's camera
    // a wheel set off its cart, lying: the axle and its two wheels flat on the floor
    wheelsLying: K([[rod(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2).translate(0, 0.08, 0), C.iron], ...[0.55, -0.55].flatMap((x) => [[cyl(0.3, 0.3, 0.09, 12).translate(x, 0, 0.05 * Math.sign(x)), C.darkWood], [cyl(0.105, 0.105, 0.11, 8).translate(x, 0, 0.05 * Math.sign(x)), C.iron]] as Part[])]),
    // a low ore tub (1.2 x 0.75 m, 0.52 high on its wheels), its rim gilt; upside down; its load
    tub: K([
      [box(1.2, 0.34, 0.72, 0, 0.33), C.rail], [box(1.22, 0.1, 0.74, 0, 0.3), C.plank], [box(1.24, 0.03, 0.76, 0, 0.5), GOLD],
      ...[[0.4, 0.38], [-0.4, 0.38], [0.4, -0.38], [-0.4, -0.38]].map(([x, z]) => [cyl(0.15, 0.15, 0.07, 10).rotateX(Math.PI / 2).translate(x, 0.15, z), C.darkWood] as Part),
      [ico(0.3).scale(1.6, 0.25, 0.9).translate(0, 0.47, 0), C.ore],
    ]),
    tubUpside: K([
      [box(1.2, 0.34, 0.72, 0, 0.17), C.rail], [box(1.22, 0.1, 0.74, 0, 0.2), C.plank], [box(1.24, 0.03, 0.76, 0, 0.015), GOLD],
      ...[[0.4, 0.38], [-0.4, 0.38], [0.4, -0.38], [-0.4, -0.38]].map(([x, z]) => [cyl(0.15, 0.15, 0.07, 10).rotateX(Math.PI / 2).translate(x, 0.36, z), C.darkWood] as Part),
    ]),
    // a 4 m length of rails on their sleepers (along z), and the points' lever lying
    rails: K([
      [box(0.08, 0.1, 4, 0.4, 0.13), C.rail], [box(0.08, 0.1, 4, -0.4, 0.13), C.rail],
      ...[-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].map((z) => [box(1.3, 0.08, 0.22, 0, 0.04, z), C.wood] as Part),
    ]),
    lever: K([[box(0.16, 0.12, 0.3, 0, 0.06), C.iron], [rod(0.025, 0.025, 1.0, 6).rotateX(Math.PI / 2).translate(0, 0.04, 0.6), C.iron], [ball(0.06, 8, 5).translate(0, 0.05, 1.1), GOLD]]),
    // the cage of a lift, fallen at the shaft's foot: crushed flat on open ground; on its side against the rock
    cageFlat: K([
      [box(1.5, 0.06, 1.5, 0, 0.03), C.iron], [box(1.54, 0.03, 0.06, 0, 0.07, 0.74), GOLD], [box(1.54, 0.03, 0.06, 0, 0.07, -0.74), GOLD],
      ...[-0.5, -0.17, 0.17, 0.5].map((x) => [box(0.05, 0.05, 1.5, x, 0.09), C.rail] as Part),
      [box(1.5, 0.05, 1.5, 0, 0, 0).rotateZ(0.22).translate(0.35, 0.22, 0.1), C.rail], [box(1.52, 0.03, 0.05, 0, 0, 0).rotateZ(0.22).translate(0.35, 0.25, 0.84), GOLD],
      [box(0.05, 0.05, 1.7, 0, 0, 0).rotateY(0.5).translate(-0.9, 0.05, 0.3), C.rail], [box(0.05, 0.05, 1.6, 0, 0, 0).rotateY(-0.3).translate(-1.1, 0.05, -0.4), C.rail],
    ]),
    cageSide: K([
      // a 2.1 x 1.4 x 1.4 frame of bars lying on its side (its length along x)
      ...[[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].map(([y, z]) => [box(2.1, 0.07, 0.07, 0, 0.72 + y, z), C.rail] as Part),
      ...[1.03, -1.03].flatMap((x) => [[box(0.07, 1.42, 0.07, x, 0.72, 0.7), C.rail], [box(0.07, 1.42, 0.07, x, 0.72, -0.7), C.rail], [box(0.07, 0.07, 1.42, x, 0.02, 0), C.rail], [box(0.07, 0.07, 1.42, x, 1.42, 0), C.rail]] as Part[]),
      ...[-0.6, -0.2, 0.2, 0.6].map((x) => [box(0.04, 1.4, 0.04, x, 0.72, 0.7), C.iron] as Part),
      [box(2.1, 0.05, 1.4, 0, 0.72, -0.7).rotateX(0), C.iron],
      ...[[1.03, 1.42, 0.7], [-1.03, 1.42, 0.7]].map(([x, y, z]) => [box(0.12, 0.12, 0.12, x, y, z), GOLD] as Part),
    ]),
    sheave: K([
      [ring(0.9, 0.07, 3, 20).rotateX(Math.PI / 2).translate(0, 0.08, 0), C.rail], [ring(0.78, 0.03, 3, 20).rotateX(Math.PI / 2).translate(0, 0.1, 0), GOLD],
      ...[0, 1, 2].map((k) => [box(1.75, 0.06, 0.08, 0, 0.08, 0).rotateY((k * Math.PI) / 3), C.iron] as Part),
      [cyl(0.16, 0.16, 0.2, 10), GOLD],
    ]),
    coil: K([[ring(0.5, 0.05, 3, 16).rotateX(Math.PI / 2).translate(0, 0.05, 0), C.rope], [ring(0.58, 0.05, 3, 16).rotateX(Math.PI / 2).translate(0.03, 0.12, 0.02), C.rope], [ring(0.44, 0.05, 3, 16).rotateX(Math.PI / 2).translate(-0.02, 0.17, 0), C.rope]]),
    shaftMouth: K([
      [cyl(1.3, 1.3, 0.02, 20), C.black],
      ...Array.from({ length: 11 }, (_, k) => { const a = (k / 11) * Math.PI * 2; return [box(0.72, 0.3, 0.4, 0, 0.15, 0).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5), C.rubble] as Part; }),
      [ring(1.5, 0.03, 3, 24).rotateX(Math.PI / 2).translate(0, 0.31, 0), GOLD],
    ]),
    // the camp's things: a tarp spread, a barrel lying, a plank table fallen flat with its legs broken off
    tarpBig: K([[box(3.0, 0.02, 2.3, 0, 0.01), C.cloth], [box(3.0, 0.024, 0.3, 0, 0.012, 0.6), C.cream], [box(3.04, 0.026, 0.06, 0, 0.013, 1.13), GOLD], [box(3.04, 0.026, 0.06, 0, 0.013, -1.13), GOLD]]),
    barrel: K([[rod(0.26, 0.26, 0.8, 12).rotateZ(Math.PI / 2).translate(0, 0.26, 0), C.plank], [rod(0.27, 0.27, 0.05, 12).rotateZ(Math.PI / 2).translate(0.28, 0.26, 0), C.iron], [rod(0.27, 0.27, 0.05, 12).rotateZ(Math.PI / 2).translate(-0.28, 0.26, 0), C.iron], [rod(0.2, 0.2, 0.02, 10).rotateZ(Math.PI / 2).translate(0.41, 0.26, 0), GOLD]]),
    tableFlat: K([[box(1.7, 0.06, 0.85, 0, 0.03), C.plank], [box(1.72, 0.065, 0.06, 0, 0.033, 0.4), C.darkWood], [box(1.72, 0.065, 0.06, 0, 0.033, -0.4), C.darkWood], [box(0.08, 0.08, 0.7, 1.2, 0.04, 0.5).rotateY(0.4), C.wood], [box(0.08, 0.08, 0.7, -1.3, 0.04, -0.4).rotateY(-0.6), C.wood]]),
    // a collapse's great heap (4 x 3 m, under the knee) and the barrow tipped by it
    heap: K([
      // fresh fallen rock is paler than the trodden floor (it read as nothing in the first pass)
      [ico(1).scale(2.0, 0.42, 1.45).translate(0, 0.08, 0), C.rubble], [ico(0.5).scale(1.2, 0.6, 1).translate(1.2, 0.18, 0.6), C.pale], [ico(0.45).scale(1, 0.6, 1.1).translate(-1.3, 0.16, 0.5), C.rockLight],
      [ico(0.35).translate(0.4, 0.2, -0.9), C.pale], [ico(0.3).scale(1, 0.7, 1).translate(-0.6, 0.15, -0.8), C.rubble], [ico(0.28).translate(1.9, 0.1, -0.3), C.rockLight], [ico(0.25).translate(-2.0, 0.08, -0.2), C.pale],
    ]),
    barrow: K([[box(0.7, 0.3, 0.55, 0, 0, 0).rotateZ(1.2).translate(0, 0.3, 0), C.rail], [box(0.72, 0.03, 0.57, 0, 0, 0).rotateZ(1.2).translate(-0.16, 0.33, 0), GOLD], [cyl(0.2, 0.2, 0.08, 10).rotateX(Math.PI / 2).translate(0.5, 0.2, 0), C.darkWood], [cyl(0.025, 0.025, 1.1, 6).rotateZ(Math.PI / 2).translate(-0.2, 0.05, 0.22), C.wood], [cyl(0.025, 0.025, 1.1, 6).rotateZ(Math.PI / 2).translate(-0.2, 0.05, -0.22), C.wood]]),
    peg: K([[cyl(0.03, 0.04, 0.4, 5), C.wood], [cyl(0.05, 0.05, 0.04, 6).translate(0, 0.38, 0), GOLD]]),
    shards: K([...[[0, 0, 0.3], [0.25, 0.15, -0.4], [-0.2, 0.2, 0.6], [0.1, -0.25, -0.2], [-0.3, -0.15, 0.1]].map(([x, z, t]) => [oct(0.06, 0.24).rotateZ(t).translate(x, 0.02, z), SHARD] as Part)]),
    sack: K([[ball(1, 8, 5).scale(0.4, 0.24, 0.3).translate(0, 0.2, 0), C.sack], [ring(0.09, 0.022, 3, 8).rotateY(Math.PI / 2).translate(0.42, 0.18, 0), C.rope]]),
    stone: K([[ico(0.14).scale(1, 0.65, 1).translate(0, 0.05, 0), C.pale]]),
  };
}

type Ks = ReturnType<typeof makeKits>;
type Op = { p: Kit; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; tilt: number; roll: number };
/**
 * What a scene paints into the cave floor's canvas (no draw calls): `stain` a soft ellipse (`a` x `b` m, turned `rot`), `fan` a spill
 * fanning out from a point (`a` long, `b` its half-angle), `band` a strip (`a` long, `b` wide: the rails' ballast, a pegged line),
 * `puddle` standing water with a pale rim. Angles as the canvas reads them (atan2(z, x)) in the scene's frame. `c` "r,g,b", `al` strength.
 */
type Paint = { t: 'stain' | 'fan' | 'band' | 'puddle'; x: number; z: number; a: number; b: number; rot: number; c: string; al: number };
/** The ground's colours: trodden dark, pale rock dust, ore dust, ash, violet shard dust, ballast, the black water. */
const G = { tramp: '18,16,26', dust: '96,92,114', ore: '14,14,20', ash: '70,66,78', violet: '120,86,200', ballast: '86,84,98', water: '12,18,36' } as const;
class Recipe {
  ops: Op[] = [];
  items: { x: number; z: number; r: number; h: number }[] = [];
  paints: Paint[] = [];
  main = { x: 0, z: 0 };
  trail: 'prints' | 'drag' | null = null;
  s(p: Kit, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) { this.ops.push({ p, x, y, z, yaw, sx, sy, sz, tilt, roll }); return this; }
  /** A unit shape stretched from a to b (`w` wide, `h` high). */
  beam(p: Kit, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h = w) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy);
    return this.s(p, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), w, h, len, -Math.atan2(dy, flat));
  }
  item(x: number, z: number, r: number, h: number) { this.items.push({ x, z, r, h }); return this; }
  at(x: number, z: number) { this.main = { x, z }; return this; }
  paint(t: Paint['t'], x: number, z: number, a: number, b: number, rot: number, c: string, al: number) { this.paints.push({ t, x, z, a, b, rot, c, al }); return this; }
  get reach() { let m = 0; for (const it of this.items) m = Math.max(m, Math.hypot(it.x, it.z) + it.r); return m; }
}

type Make = (rc: Recipe, K: Ks, r: () => number, o: { backed: boolean; far: boolean }) => void;
const KINDS: Record<string, Make> = {
  // The miners' last camp: a tarp spread with bedrolls on it (one still rolled), a cold fire ring and its kettle, tin plates and mugs,
  // packs, a lamp on the ground, a barrel; or the second way, the plank table fallen flat with the meal on the ground. Against the rock,
  // the cold stove, a lamp hung from its post and picks leaned on the rock. Ash and trodden ground round the fire.
  camp: (rc, K, r, o) => {
    const z0 = o.backed ? 1.3 : 0, v = r() < 0.6 ? 0 : 1;
    if (o.backed) {
      rc.s(K.stove, -1.0, 0, -0.1, r() * 6).item(-1.0, -0.1, 0.45, 1.65);
      rc.s(K.lampPost, 0.2, 0, -0.35, -0.2).item(0.35, -0.3, 0.45, 2.2);
      rc.s(K.pickLeaning, 1.2, 0.35, -0.25, Math.PI + 0.2).s(K.pickLeaning, 1.55, 0.35, -0.2, Math.PI - 0.15).item(1.4, -0.1, 0.45, 0.95);
    }
    const a = r() * 0.4 - 0.2;
    if (v === 0) {
      rc.s(K.tarpBig, -0.3, 0, z0 + 0.7, a).item(-0.3, z0 + 0.7, 1.9, 0.05).at(-0.3, z0 + 0.7);
      rc.s(K.bedroll, -1.0, 0.02, z0 + 0.6, a).item(-1.0, z0 + 0.6, 1.0, 0.18);
      rc.s(K.bedroll, 0.2, 0.02, z0 + 0.8, a + 0.25).item(0.2, z0 + 0.8, 1.0, 0.18);
      if (r() < 0.7) rc.s(K.rolled, 1.6, 0, z0 + 0.2, 1.4 + r() * 0.3).item(1.6, z0 + 0.2, 0.45, 0.3);
    } else {
      rc.s(K.tableFlat, -0.2, 0, z0 + 0.6, a + 0.3).item(-0.2, z0 + 0.6, 1.3, 0.1).at(-0.2, z0 + 0.6);
      rc.s(K.bedroll, 1.7, 0, z0 + 0.3, a + 1.4).item(1.7, z0 + 0.3, 1.0, 0.18);
      rc.s(K.plates, 0.4, 0.06, z0 + 0.5, r() * 6);
    }
    rc.s(K.fireRing, 0.5, 0, z0 + 2.6, 0, 1.2).item(0.5, z0 + 2.6, 0.72, 0.15);
    rc.s(K.kettle, 0.35, 0.1, z0 + 2.5, r() * 6, 1.2);
    rc.s(K.plates, -1.1, 0, z0 + 2.7, r() * 6).item(-1.1, z0 + 2.7, 0.45, 0.1);
    rc.s(K.pack, 2.0, 0, z0 + 1.7, r() * 6).item(2.0, z0 + 1.7, 0.35, 0.36);
    rc.s(K.barrel, -2.4, 0, z0 + 1.6, r() * 6).item(-2.4, z0 + 1.6, 0.6, 0.53);
    if (!o.backed) rc.s(K.lampGround, -1.9, 0, z0 + 0.0, r()).item(-1.9, z0, 0.25, 0.45);
    rc.paint('stain', 0.5, z0 + 2.6, 1.5, 1.5, 0, G.ash, 0.55).paint('stain', 0, z0 + 1.3, 3.6, 2.6, r(), G.tramp, 0.4);
    rc.trail = 'prints';
  },
  // A cart off its rails: against the rock, the cart on its side; on open ground a low ore tub tipped over with its wheel set off, its
  // ore fanned out across the floor with crystal chips in it, a rail bent up, sleepers knocked askew.
  cart: (rc, K, r, o) => {
    const z0 = o.backed ? 1.2 : 0;
    if (o.backed) rc.s(K.cartSide, 0, 0, -0.1, (r() - 0.5) * 0.2).item(0, -0.1, 0.95, 1.05).at(0, 0);
    else {
      rc.s(K.tubUpside, 0.2, 0, -0.3, r() * 0.6 - 0.3, 1.45, 1, 1.45).item(0.2, -0.3, 1.1, 0.53).at(0.2, -0.3);
      rc.s(K.wheelsLying, 2.3, 0, -1.1, r() * 6).item(2.3, -1.1, 0.95, 0.2);
    }
    rc.s(K.ore, -0.5, 0, z0 + 0.9, r() * 6, 1.4).item(-0.5, z0 + 0.9, 0.95, 0.32);
    rc.s(K.ore, 0.9, 0, z0 + 1.6, r() * 6, 1.0).item(0.9, z0 + 1.6, 0.7, 0.24);
    rc.s(K.ore, -1.4, 0, z0 + 2.2, r() * 6, 0.7).item(-1.4, z0 + 2.2, 0.55, 0.2);
    rc.s(K.chips, -0.3, 0.05, z0 + 1.1, r() * 6).s(K.chips, 1.0, 0.04, z0 + 1.4, r() * 6, 0.8).s(K.chips, -1.2, 0.04, z0 + 2.0, r() * 6);
    rc.s(K.rail, -2.2, 0, z0 + 0.4, 0.3 + r() * 0.4).item(-2.2, z0 + 0.4, 1.65, 0.45);
    rc.paint('fan', 0, z0 + 0.4, 3.6, 0.7, Math.PI / 2 + (r() - 0.5) * 0.5, G.ore, 0.6).paint('stain', 0, z0 + 0.8, 3.2, 2.4, 0, G.tramp, 0.35);
    rc.trail = 'drag';
  },
  // A collapse: a great heap of fallen rock (4 x 3 m), the timbers that held the roof fallen across it, a broken prop with its cap, a
  // miner's helmet with its lamp out, a barrow tipped; pale rock dust fanned out round it. Against the rock, a frame leaned on it.
  collapse: (rc, K, r, o) => {
    const z0 = o.backed ? 1.6 : 0;
    if (o.backed) rc.s(K.frameLeaning, 0, 0, -0.2, (r() - 0.5) * 0.2, 1.2).item(-0.7, -0.2, 0.8, 2.8).item(0.8, -0.15, 0.8, 2.6);
    rc.s(K.heap, 0, 0, z0 + 0.6, r() * 0.6 - 0.3, 1.0, 1.1, 1.0).item(-1.0, z0 + 0.6, 1.3, 0.55).item(1.0, z0 + 0.6, 1.3, 0.55).at(0, z0 + 0.6);
    rc.s(K.timber, -0.8, 0.2, z0 + 0.5, 1.1 + r() * 0.3, 1.1, 0.9, 1.2, 0.03).item(-0.8, z0 + 0.5, 1.9, 0.55);
    rc.s(K.timber, 0.9, 0.18, z0 + 0.8, 2.0 + r() * 0.3, 1.1, 0.9, 1.2, -0.03).item(0.9, z0 + 0.8, 1.9, 0.5);
    rc.s(K.timber, 0.3, 0, z0 + 2.4, 1.6 + r() * 0.4, 0.9).item(0.3, z0 + 2.4, 1.45, 0.25);
    rc.s(K.rubble, 2.4, 0, z0 + 1.9, r() * 6, 0.7).item(2.4, z0 + 1.9, 0.75, 0.32);
    rc.s(K.helmet, -1.7, 0.1, z0 + 2.4, r() * 6, 1.2, 1.2, 1.2, 0.4, 0.5).item(-1.7, z0 + 2.4, 0.35, 0.33);
    if (r() < 0.6) rc.s(K.barrow, -2.6, 0, z0 + 1.0, r() * 6, 0.8).item(-2.6, z0 + 1.0, 0.7, 0.55);
    else rc.s(K.lampGround, -2.4, 0, z0 + 1.2, 0, 1, 1, 1, 1.3, 0.3).item(-2.4, z0 + 1.2, 0.35, 0.3);
    rc.paint('fan', 0, z0 + 0.6, 4.6, 0.9, Math.PI / 2 + (r() - 0.5) * 0.4, G.dust, 0.4).paint('stain', 0, z0 + 0.6, 3.6, 2.8, 0, G.dust, 0.22);
  },
  // A crystal harvest: open crates of glowing shards (their glow is the shards' own), the lid off, shards spilled on a tarp, cut
  // stumps, the sledge and chisels, a barrow; violet dust on the floor round them.
  harvest: (rc, K, r) => {
    if (r() < 0.4) {
      // the second way: the vein itself, cut open, its stumps standing in a cluster with the shards round them and one crate filled
      for (const [x, z, sc] of [[0, 0, 1.6], [0.7, 0.4, 1.3], [-0.6, 0.5, 1.2], [0.2, -0.6, 1.1]] as const) rc.s(K.stumps, x, 0, z, r() * 6, sc).item(x, z, 0.4 * sc, 0.33 * sc);
      rc.at(0, 0);
      rc.s(K.shards, 0.4, 0.02, 1.4, r() * 6, 1.3).s(K.shards, -1.2, 0.02, -0.2, r() * 6).s(K.chips, 1.3, 0.02, -0.6, r() * 6);
      rc.s(K.crateShards, -1.6, 0.02, 1.2, r() * 6, 1.2, 1.1, 1.2).item(-1.6, 1.2, 0.6, 0.55);
      rc.s(K.sledge, 1.6, 0, 1.3, r() * 6, 1.2).item(1.6, 1.3, 0.65, 0.15);
      rc.s(K.lid, -2.3, 0, 0.2, r() * 3, 1.2, 1, 1.2, 0.06);
      rc.paint('stain', 0, 0.2, 3.0, 2.4, 0, G.violet, 0.35);
      rc.trail = 'prints';
      return;
    }
    rc.s(K.tarpBig, 0.4, 0, 0.6, r() * 0.6 - 0.3, 0.8).item(0.4, 0.6, 1.5, 0.05).at(0.4, 0.6);
    rc.s(K.crateShards, -0.6, 0.02, 0.2, r() * 0.6, 1.25, 1.1, 1.25).item(-0.6, 0.2, 0.6, 0.55);
    rc.s(K.crateShards, 0.6, 0.02, -0.1, 1.3 + r() * 0.5, 1.25, 1.1, 1.25).item(0.6, -0.1, 0.6, 0.55);
    if (r() < 0.7) rc.s(K.crateShards, 1.5, 0, 1.3, r() * 6, 1.2, 1.1, 1.2).item(1.5, 1.3, 0.6, 0.55);
    rc.s(K.lid, -1.8, 0, 1.1, r() * 3, 1.2, 1, 1.2, 0.06);
    rc.s(K.shards, 0.0, 0.02, 1.2, r() * 6, 1.3).s(K.chips, 0.9, 0.02, 1.6, r() * 6);
    rc.s(K.stumps, 2.6, 0, -0.6, r() * 6, 1.4).item(2.6, -0.6, 0.7, 0.35);
    rc.s(K.stumps, -2.4, 0, -0.4, r() * 6, 1.1).item(-2.4, -0.4, 0.55, 0.28);
    rc.s(K.sledge, -0.8, 0, 2.1, r() * 6, 1.2).item(-0.8, 2.1, 0.65, 0.15);
    if (r() < 0.5) rc.s(K.barrow, 2.4, 0, 1.6, r() * 6, 0.8).item(2.4, 1.6, 0.7, 0.55);
    rc.paint('stain', 0.2, 0.6, 3.6, 2.6, 0, G.violet, 0.3).paint('fan', 2.6, -0.6, 2.4, 0.8, Math.PI / 2, G.violet, 0.35);
    rc.trail = 'prints';
  },
  // A survey left behind: a map on the ground weighted with stones, a spyglass and a compass, packs; a measuring line pegged out across
  // the floor; the tripod fallen (or, against the rock, standing over a board with the map pinned).
  survey: (rc, K, r, o) => {
    const z0 = o.backed ? 1.0 : 0;
    if (o.backed) rc.s(K.tripod, 0.8, 0, -0.1, r() * 6).item(0.8, -0.1, 0.5, 1.8).s(K.board, -0.6, 0, -0.35, (r() - 0.5) * 0.2).item(-0.6, -0.3, 0.55, 0.85);
    else rc.s(K.tripodLying, 1.6, 0, -0.6, r() * 0.8 - 0.4, 1.2).item(1.7, -0.6, 1.05, 0.14);
    rc.s(K.map, 0, 0, z0 + 0.7, (r() - 0.5) * 0.5, 2.0, 1, 2.0).item(0, z0 + 0.7, 1.25, 0.08).at(0, z0 + 0.7);
    rc.s(K.spyglass, -1.4, 0, z0 + 1.6, r() * 6, 1.5).item(-1.4, z0 + 1.6, 0.65, 0.12);
    rc.s(K.pack, 1.5, 0, z0 + 1.7, r() * 6).item(1.5, z0 + 1.7, 0.35, 0.36);
    // the measuring line: pegs every 1.6 m with the rope between, out across the floor
    const ly = (r() - 0.5) * 0.4, n = 4;
    for (let k = 0; k < n; k++) {
      const x = -3.0 + k * 1.6, z = z0 + 2.8 + Math.sin(ly) * k * 1.6;
      rc.s(K.peg, x, 0, z).item(x, z, 0.2, 0.42);
      if (k) rc.beam(K.unitRope, x - 1.6, 0.3, z - Math.sin(ly) * 1.6, x, 0.3, z, 0.02).item(x - 0.8, z - Math.sin(ly) * 0.8, 0.6, 0.32);
    }
    if (r() < 0.6) rc.s(K.lampGround, -0.9, 0, z0 - 0.4 + (o.backed ? 0.5 : 0), r()).item(-0.9, z0 - 0.4 + (o.backed ? 0.5 : 0), 0.25, 0.45);
    rc.paint('band', -0.6, z0 + 2.8, 6.2, 0.5, -ly, G.dust, 0.3).paint('stain', 0, z0 + 1.0, 2.8, 2.0, 0, G.tramp, 0.35);
    rc.trail = 'prints';
  },
  // A winch with its chain snapped (only against the rock), drawn larger: its chain run out across the floor to the hook, the skip
  // overturned and its ore out, the pulley wheel fallen flat.
  winch: (rc, K, r) => {
    rc.s(K.winch, 0, 0, -0.1, (r() - 0.5) * 0.2, 1.35).item(0, -0.1, 1.2, 1.6).at(0, 0);
    rc.s(K.chain, 0.4, 0, 0.7, 0.2 + r() * 0.4, 1.4).item(0.8, 1.6, 1.15, 0.12);
    rc.s(K.hook, 1.2, 0, 2.9, r() * 6, 1.4);
    if (r() < 0.6) {
      rc.s(K.skip, -1.7, 0, 1.8, 0.4 + r() * 0.4, 1.15, 0.85, 1.15).item(-1.7, 1.8, 0.7, 0.55);
      rc.s(K.ore, -0.9, 0, 2.7, r() * 6, 1.2).item(-0.9, 2.7, 0.8, 0.26);
    } else rc.s(K.coil, -1.6, 0, 2.0, r() * 6, 1.3).item(-1.6, 2.0, 0.85, 0.24).s(K.helmet, -0.6, 0.1, 2.8, r() * 6, 1.1, 1.1, 1.1, 0.4, 0.5).item(-0.6, 2.8, 0.33, 0.3);
    rc.s(K.sheave, 2.4, 0, 1.4, r() * 6).item(2.4, 1.4, 1.0, 0.25);
    rc.item(1.2, 2.9, 0.35, 0.06);
    rc.paint('fan', -1.3, 1.9, 3.0, 0.7, Math.PI / 2, G.ore, 0.55).paint('stain', 0.4, 1.4, 3.2, 2.2, 0, G.tramp, 0.35);
  },
  // A shrine of stacked stones: a candle on top (its flame unlit, it adds no light), stubs at its foot, coins and a shard left, a ring
  // of small stones round it.
  shrine: (rc, K, r) => {
    if (r() < 0.6) rc.s(K.cairn, 0, 0, 0, r() * 6, 1.6, 1.25, 1.6).item(0, 0, 0.76, 0.56).at(0, 0);
    else {
      // the second way: a flat offering stone, a ring of candles round it
      rc.s(K.cairn, 0, 0, 0, r() * 6, 2.0, 0.45, 2.0).item(0, 0, 0.95, 0.2).at(0, 0);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; rc.s(K.candle, Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05, 0, 0.9); }
    }
    rc.s(K.candle, -0.15, 0, 0.75, 0, 1.2); // (the candle on top would stand past the knee: they are all at its foot)
    rc.s(K.candle, 0.7, 0, 0.4, 0, 0.9).s(K.candle, -0.65, 0, 0.45, 0, 0.8).s(K.candle, 0.1, 0, -0.85, 0, 0.9);
    rc.s(K.offering, 0, 0, 0.85, r() * 6, 1.5);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; rc.s(K.stone, Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35, r() * 6, 0.8 + r() * 0.4); }
    rc.item(0, 0, 1.55, 0.12);
    rc.paint('stain', 0, 0, 2.2, 2.2, 0, G.dust, 0.3);
  },
  // A rowing boat half sunk in the black lake (past the edge only), its bow up and its lantern still lit; an oar and a crate afloat.
  wreck: (rc, K, r) => {
    // drawn half again as large as the landing's boat: it is seen from far across the water
    rc.s(K.hull, 0, -0.8, 0, 0, 1.5, 1.5, 1.5, -0.32, (r() - 0.5) * 0.4).item(0, 0, 3.6, 1.5).at(0, 0);
    rc.s(K.oar, 3.0, 0.0, 1.8, r() * 6, 1.5).item(3.0, 1.8, 1.8, 0.1);
    rc.s(K.crateFloat, -2.7, -0.45, -2.1, r() * 6, 1.5, 1.5, 1.5, 0.2, 0.25).item(-2.7, -2.1, 0.75, 0.4);
  },
  // A derailed train at a rail junction: a spur of rails and its branch, the points' lever lying; three low ore tubs, the first still
  // on the rails, the second jack-knifed off them, the third upside down with its ore spilled; ballast and ore dust on the floor.
  junction: (rc, K, r) => {
    if (r() < 0.4) {
      // the second way: no points, a straight spur; the three tubs jack-knifed along it, ore heaped between them, the buffer knocked down
      rc.s(K.rails, 0, 0, 0, 0).s(K.rails, 0, 0, 4, 0).item(0, -1.4, 1.0, 0.14).item(0, 0.4, 1.0, 0.14).item(0, 2.2, 1.0, 0.14).item(0, 4.0, 1.0, 0.14).item(0, 5.6, 0.7, 0.14);
      for (const [x, z, yaw, up] of [[0.5, 4.4, Math.PI / 2 + 0.5, 1], [-0.6, 2.5, Math.PI / 2 - 0.6, 1], [0.7, 0.4, Math.PI / 2 + 0.7, 0]] as const) rc.s(up ? K.tub : K.tubUpside, x, 0, z, yaw, 1.25, 1, 1.25).item(x, z, 0.95, 0.55);
      rc.at(-0.6, 2.5);
      rc.s(K.ore, -0.3, 0, 3.5, r() * 6, 1.0).s(K.ore, 0.4, 0, 1.4, r() * 6, 0.9).item(0, 2.4, 1.6, 0.3);
      rc.s(K.unitWood, 0.2, 0.07, -2.2, 0.6, 1.3, 0.14, 0.26).s(K.unitWood, -0.4, 0.07, -2.6, -0.4, 1.3, 0.14, 0.26).item(0, -2.4, 0.9, 0.14);
      rc.paint('band', 0, 2.2, 7.6, 1.5, Math.PI / 2, G.dust, 0.32).paint('fan', 0, 2.4, 3.2, 0.9, 0, G.ore, 0.5);
      return;
    }
    const br = 0.4 + r() * 0.2;
    rc.s(K.rails, 0, 0, 0, 0).s(K.rails, 0, 0, 4, 0).item(0, -1.4, 1.0, 0.14).item(0, 0.4, 1.0, 0.14).item(0, 2.2, 1.0, 0.14).item(0, 4.0, 1.0, 0.14).item(0, 5.6, 0.7, 0.14);
    rc.s(K.rails, Math.sin(br) * 2.0, 0, 2.0 + Math.cos(br) * 2.0, br).item(Math.sin(br) * 1.2, 2.0 + Math.cos(br) * 1.2, 0.9, 0.14).item(Math.sin(br) * 3.2, 2.0 + Math.cos(br) * 3.2, 0.9, 0.14);
    rc.s(K.lever, -1.0, 0, 2.0, r() * 6).item(-1.0, 2.0, 0.6, 0.13);
    rc.s(K.tub, 0, 0.03, 4.6, Math.PI / 2, 1.25, 1, 1.25).item(0, 4.6, 0.95, 0.55);
    rc.s(K.tub, 1.2, 0, 2.4, 0.7 + r() * 0.3, 1.25, 1, 1.25, 0, 0.06).item(1.2, 2.4, 0.95, 0.55).at(1.2, 2.4);
    rc.s(K.tubUpside, 2.5, 0, 0.3, 1.3 + r() * 0.4, 1.25, 1, 1.25).item(2.5, 0.3, 0.95, 0.53);
    rc.s(K.ore, 3.3, 0, -0.9, r() * 6, 1.2).item(3.3, -0.9, 0.85, 0.3).s(K.chips, 2.9, 0.04, -0.6, r() * 6);
    rc.s(K.chain, 0.2, 0, 3.0, 0.4, 0.8);
    rc.paint('band', 0, 2.2, 7.6, 1.5, Math.PI / 2, G.dust, 0.32).paint('fan', 2.4, 0.2, 3.0, 0.7, -Math.PI / 2 + 0.4, G.ore, 0.55);
  },
  // A lift's cage fallen at the shaft's foot: the shaft's mouth ringed with stones; the cage crushed flat beside it (on its side
  // against a rock), its cable coiled, the head-frame's pulley wheel fallen; dust round it.
  cage: (rc, K, r, o) => {
    if (o.backed) {
      rc.s(K.cageSide, 0, 0, 0, (r() - 0.5) * 0.15).item(-0.6, 0, 0.8, 1.5).item(0.6, 0, 0.8, 1.5).at(0, 0);
      rc.s(K.sheave, 1.8, 0, 1.8, r() * 6).item(1.8, 1.8, 1.0, 0.25);
      rc.s(K.coil, -1.3, 0, 1.9, r() * 6, 1.2).item(-1.3, 1.9, 0.8, 0.22);
      rc.beam(K.unitRope, -0.9, 0.12, 1.5, -0.4, 0.4, 0.5, 0.05);
      rc.paint('stain', 0, 1.2, 3.2, 2.4, 0, G.dust, 0.3);
    } else {
      rc.s(K.shaftMouth, -2.0, 0, 0, r() * 6).item(-2.0, 0, 1.85, 0.32);
      rc.s(K.cageFlat, 0.6, 0, 0.4, r() * 6, 1.15).item(0.6, 0.4, 1.2, 0.48).at(0.6, 0.4);
      rc.s(K.sheave, 2.6, 0, -1.2, r() * 6).item(2.6, -1.2, 1.0, 0.25);
      rc.s(K.coil, 2.2, 0, 1.6, r() * 6, 1.2).item(2.2, 1.6, 0.8, 0.22);
      rc.beam(K.unitRope, 1.6, 0.1, 1.4, -0.9, 0.08, 0.3, 0.05);
      rc.paint('stain', -2.0, 0, 2.4, 2.4, 0, G.ore, 0.5).paint('stain', 0.6, 0.4, 3.4, 2.6, 0, G.dust, 0.3);
    }
    rc.s(K.helmet, -0.4, 0.1, 2.3, r() * 6, 1.1, 1.1, 1.1, 0.4, 0.5).item(-0.4, 2.3, 0.33, 0.3);
    rc.trail = 'drag';
  },
  // A camp flooded where the black lake rose: puddles standing on the floor, the tarp drowned in the largest, crates and a barrel half
  // in the water, a bedroll soaked, a lamp on its side. Only by the lake.
  flooded: (rc, K, r) => {
    if (r() < 0.4) {
      // the second way: the water higher, one great pool; a tub upside down in it, barrels and bedrolls adrift, a lamp on the shore
      rc.paint('puddle', 0, 0.4, 4.2, 3.0, r() * 0.6, G.water, 0.88).paint('puddle', -2.8, -1.4, 1.3, 0.9, r() * 3, G.water, 0.8);
      rc.s(K.tubUpside, 0.3, -0.12, 0.4, r() * 6, 1.25, 1, 1.25).item(0.3, 0.4, 0.95, 0.42).at(0.3, 0.4);
      rc.s(K.barrel, -1.6, -0.1, 1.2, r() * 6).item(-1.6, 1.2, 0.6, 0.43).s(K.barrel, 2.0, -0.12, -0.6, r() * 6).item(2.0, -0.6, 0.6, 0.41);
      rc.s(K.bedroll, 1.6, -0.02, 1.8, r() * 6).item(1.6, 1.8, 1.0, 0.1);
      rc.s(K.crateFloat, -0.8, -0.25, -1.2, r() * 6, 0.9, 0.9, 0.9, 0.2, 0.15).item(-0.8, -1.2, 0.5, 0.25);
      rc.s(K.lampGround, -2.9, 0, 0.8, 0, 1, 1, 1, 1.4, 0.2).item(-2.9, 0.8, 0.35, 0.3);
      rc.trail = 'prints';
      return;
    }
    rc.paint('puddle', 0, 0, 3.4, 2.4, r() * 0.6, G.water, 0.85).paint('puddle', 2.6, 1.6, 1.5, 1.0, r() * 3, G.water, 0.8).paint('puddle', -2.4, 1.4, 1.2, 0.9, r() * 3, G.water, 0.8);
    rc.s(K.tarpBig, -0.2, -0.005, 0.1, r() * 0.6 - 0.3, 0.9, 1, 0.9, 0.04).item(-0.2, 0.1, 1.75, 0.05).at(0, 0);
    rc.s(K.crateFloat, 1.2, -0.2, -0.4, r() * 6, 0.9, 0.9, 0.9, 0.15, 0.2).item(1.2, -0.4, 0.5, 0.3);
    rc.s(K.crateFloat, 2.4, -0.3, 1.5, r() * 6, 0.9, 0.9, 0.9, -0.1, 0.25).item(2.4, 1.5, 0.5, 0.22);
    rc.s(K.barrel, -2.2, -0.08, 1.3, r() * 6).item(-2.2, 1.3, 0.6, 0.45);
    rc.s(K.bedroll, -0.9, 0, -0.2, r() * 0.4 + 0.5).item(-0.9, -0.2, 1.0, 0.12);
    rc.s(K.lampGround, 0.6, 0, 2.0, 0, 1, 1, 1, 1.4, 0.2).item(0.6, 2.0, 0.35, 0.3);
    rc.s(K.pack, -2.6, 0, -0.8, r() * 6).item(-2.6, -0.8, 0.35, 0.36);
    rc.trail = 'prints';
  },
};

/** Single props dropped between the scenes along the tracks, so the stories join up (ore off a cart, a dropped lamp, a pick, a sack). */
const ECHOES: Record<string, (rc: Recipe, K: Ks, r: () => number) => void> = {
  ore: (rc, K, r) => { rc.s(K.ore, 0, 0, 0, r() * 6, 0.8).s(K.chips, 0.3, 0.03, 0.1, r() * 6).item(0, 0, 0.65, 0.24); rc.paint('fan', 0, 0, 1.4, 0.6, r() * 6, G.ore, 0.5); },
  lamp: (rc, K, r) => { rc.s(K.lampGround, 0, 0, 0, r() * 6, 1, 1, 1, 1.3, 0.2).item(0, 0, 0.35, 0.3); },
  pick: (rc, K, r) => { rc.s(K.pickLeaning, 0, 0.03, 0, r() * 6, 1, 1, 1, 1.1).item(0, 0, 0.6, 0.12); },
  sack: (rc, K, r) => { rc.s(K.sack, 0, 0, 0, r() * 6).item(0, 0, 0.5, 0.3); },
  helmet: (rc, K, r) => { rc.s(K.helmet, 0, 0.1, 0, r() * 6, 1, 1, 1, 0.4, 0.5).item(0, 0, 0.3, 0.3); },
  sleeper: (rc, K, r) => { rc.s(K.unitWood, 0, 0.07, 0, r() * 6, 0.26, 0.14, 1.4).item(0, 0, 0.75, 0.14); },
  coil: (rc, K, r) => { rc.s(K.coil, 0, 0, 0, r() * 6, 0.8).item(0, 0, 0.55, 0.18); },
};

/** For the shape check (pipeline/tools/scenes-shape-sd.js): the kinds and their shapes, to measure every part against its footprint. */
export const __shapes = { KINDS, ECHOES, Recipe, autoCover, shapes: () => (KITS ??= makeKits()) };

/** A shape's telling points (kept per shape): its extremes in 26 directions and an even sample, at most 64 (autoCover's). */
const hulls = new WeakMap<object, Float32Array>();
const hullOf = (p: Proto) => {
  const pts: number[] = [], A = p.pos, n = A.length / 3;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    if (!dx && !dy && !dz) continue;
    let best = -1e9, bi = 0;
    for (let i = 0; i < A.length; i += 3) { const d = A[i] * dx + A[i + 1] * dy + A[i + 2] * dz; if (d > best) { best = d; bi = i; } }
    pts.push(A[bi], A[bi + 1], A[bi + 2]);
  }
  const step = Math.max(1, Math.ceil(n / 38));
  for (let v = 0; v < n; v += step) pts.push(A[v * 3], A[v * 3 + 1], A[v * 3 + 2]);
  return new Float32Array(pts);
};
/** A tall part's points, denser (every vertex up to about 320 a shape; autoCover's for the parts that stand past the knee). */
const denses = new WeakMap<object, Float32Array>();
const denseOf = (p: object) => {
  let D = denses.get(p);
  if (!D) {
    const pts: number[] = [];
    for (const A of (Object.values(p) as Proto[]).map((q) => q.pos)) { const n = A.length / 3, step = Math.max(1, Math.ceil(n / 320)); for (let v = 0; v < n; v += step) pts.push(A[v * 3], A[v * 3 + 1], A[v * 3 + 2]); }
    denses.set(p, (D = new Float32Array(pts)));
  }
  return D;
};
/**
 * The footprint made true to the parts (2026-11-14). The planner first tries a scene on its declared circles (cheap: most tries fail
 * there); once it fits, each part is measured in the scene's frame. An upright part (turned only about the vertical) reaches no further
 * than its shape's own reach round its origin, and its top is exact: one circle and one height, from numbers kept per shape. A tilted
 * part uses the reach in any direction, and its top from its telling points (`hullOf`). A part not inside one circle of the scene (or
 * taller than that circle says) adds its own circle; a tall part adds small circles only where its telling points pass the scene's
 * circles, each as high as its points there. The scene must then fit again (checked: pipeline/tools/scenes-shape-sd.js).
 */
const stats = new WeakMap<object, number[]>();
function autoCover(rc: Recipe) {
  const items = rc.items.slice();
  const cells = new Map<number, number[]>(); // per 1 m cell: the box of the points found there and their top
  for (const op of rc.ops) {
    let st = stats.get(op.p);
    if (!st) {
      st = [0, -1e9, 0]; // reach round the origin across the ground, top, reach in any direction
      for (const A of (Object.values(op.p) as Proto[]).map((q) => q.pos)) for (let i = 0; i < A.length; i += 3) { st[0] = Math.max(st[0], Math.hypot(A[i], A[i + 2])); st[1] = Math.max(st[1], A[i + 1]); st[2] = Math.max(st[2], Math.hypot(A[i], A[i + 1], A[i + 2])); }
      stats.set(op.p, st);
    }
    let P = hulls.get(op.p);
    if (!P) hulls.set(op.p, (P = (() => { const parts = (Object.values(op.p) as Proto[]).map(hullOf); const out = new Float32Array(parts.reduce((s2, q) => s2 + q.length, 0)); let o2 = 0; for (const q of parts) { out.set(q, o2); o2 += q.length; } return out; })()));
    const upright = op.tilt === 0 && op.roll === 0;
    const cy = Math.cos(op.yaw), sy = Math.sin(op.yaw), cx = Math.cos(op.tilt), sx = Math.sin(op.tilt), cz = Math.cos(op.roll), sz = Math.sin(op.roll);
    // three.js Euler 'YXZ': R = Ry * Rx * Rz
    const R0 = cy * cz + sy * sx * sz, R1 = -cy * sz + sy * sx * cz, R2 = sy * cx, R3 = cx * sz, R4 = cx * cz, R5 = -sx, R6 = -sy * cz + cy * sx * sz, R7 = sy * sz + cy * sx * cz, R8 = cy * cx;
    const r = upright ? Math.max(op.sx, op.sz) * st[0] : Math.max(op.sx, op.sy, op.sz) * st[2];
    let top = op.y + op.sy * st[1];
    if (!upright) { top = -1e9; for (let i = 0; i < P.length; i += 3) top = Math.max(top, op.y + R3 * P[i] * op.sx + R4 * P[i + 1] * op.sy + R5 * P[i + 2] * op.sz); top += 0.02; }
    if (items.some((it) => Math.hypot(op.x - it.x, op.z - it.z) + r <= it.r + 0.02 && (top <= KNEE || it.h >= top - 0.02))) continue;
    if (top <= KNEE) { rc.items.push({ x: op.x, z: op.z, r: r + 0.02, h: Math.max(0, top) }); continue; }
    // a tall part: small circles where its telling points pass the scene's circles (or stand above what they say)
    const near = items.filter((it) => Math.hypot(op.x - it.x, op.z - it.z) < it.r + r), T = denseOf(op.p);
    for (let i = 0; i < T.length; i += 3) {
      const vx = T[i] * op.sx, vy = T[i + 1] * op.sy, vz = T[i + 2] * op.sz;
      const x = op.x + R0 * vx + R1 * vy + R2 * vz, y = op.y + R3 * vx + R4 * vy + R5 * vz, z = op.z + R6 * vx + R7 * vy + R8 * vz;
      let ok = false;
      for (const it of near) if (Math.hypot(x - it.x, z - it.z) <= it.r - 0.03 && (y <= KNEE - 0.02 || it.h >= y + 0.02)) { ok = true; break; }
      if (ok) continue;
      const key = Math.floor(x) * 4096 + Math.floor(z);
      const c = cells.get(key);
      if (!c) cells.set(key, [x, z, x, z, y + 0.02]);
      else { c[0] = Math.min(c[0], x); c[1] = Math.min(c[1], z); c[2] = Math.max(c[2], x); c[3] = Math.max(c[3], z); c[4] = Math.max(c[4], y + 0.02); }
    }
  }
  // a circle drawn tight round the points found in each cell (a fat one would not fit against the rock the tall parts lean on)
  for (const [x0, z0, x1, z1, y] of cells.values()) rc.items.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 + 0.06, h: Math.max(0, y) });
  return rc;
}

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
  /** The cave floor's canvas (deepZone.ts `paint`), `L` metres across, not yet on the graphics card: each scene's ground is painted in. */
  ground?: { canvas: HTMLCanvasElement; L: number } | null;
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
  // the lists the room checks read: the whole floor's, or (inside `fits`) only what is near the scene being tried
  let tN = tracks, cN: typeof cover = [], kN = keep, pN = look.places, sN = props;
  const trackClear = (x: number, z: number) => { let m = 1e9; for (const s of tN) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return m; };
  const trackPoint = (x: number, z: number) => {
    let m = 1e9, px = x, pz = z;
    for (const s of tracks) {
      const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2)) : 0;
      const qx = s.ax + ex * t, qz = s.az + ez * t, d = Math.hypot(x - qx, z - qz);
      if (d < m) { m = d; px = qx; pz = qz; }
    }
    return { x: px, z: pz, d: m };
  };
  const coverClear = (x: number, z: number) => { let m = 1e9; for (const c of cN) if (near(x, z, c.ax, c.az, c.bx, c.bz, 30)) m = Math.min(m, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r); return m; };
  const keepClear = (x: number, z: number) => { let m = 1e9; for (const k of kN) m = Math.min(m, Math.hypot(x - k.x, z - k.z)); return m; };
  const placeClear = (x: number, z: number) => { let m = 1e9; for (const p of pN) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r); return m; };
  const propClear = (x: number, z: number) => { let m = 1e9; for (const s of sN) m = Math.min(m, Math.hypot(x - s.x, z - s.z) - s.r); return m; };
  cN = cover;
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
  const echoes: SceneRec[] = [];
  const paints: (Paint & { yaw: number })[] = [];
  const trails: { t: 'prints' | 'drag'; ax: number; az: number; bx: number; bz: number }[] = [];
  const used = new Map<string, number>();
  const cap: Record<string, number> = {};
  for (const k of Object.keys(KINDS)) cap[k] = 3 + Math.floor(rnd() * 2);
  cap.wreck = rnd() < 0.8 ? 1 : 0; cap.shrine = 2; cap.winch = 1 + (rnd() < 0.5 ? 1 : 0); cap.flooded = 1 + (rnd() < 0.5 ? 1 : 0);
  const off = ['camp', 'cart', 'collapse', 'harvest', 'survey', 'junction', 'cage'];
  cap[off[Math.floor(rnd() * off.length)]] = 1; // one kind this floor has little of
  cap[off[Math.floor(rnd() * off.length)]] += 2; // and one it has more of
  const MAX = 30; // on the walkable floor; the wreck is out on the lake
  let farN = 0;
  const left = (k: string) => (cap[k] ?? 0) - (used.get(k) ?? 0);

  const world = (rc: Recipe, x: number, z: number, yaw: number, far: boolean): SceneItem[] => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return rc.items.map((it) => ({ x: x + it.x * c + it.z * s, z: z - it.x * s + it.z * c, r: it.r, h: it.h, far }));
  };
  const roomFor = (it: SceneItem) => {
    const b = beyond(it.x, it.z), dx = it.x - RING.x, dz = it.z - RING.z;
    if (it.far) {
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
    return true;
  };
  /** A circle round all of a scene's parts (to skip the far ones quickly). */
  const bound = (items: SceneItem[]) => {
    let cx = 0, cz = 0;
    for (const it of items) { cx += it.x; cz += it.z; }
    cx /= items.length || 1; cz /= items.length || 1;
    let r = 0;
    for (const it of items) r = Math.max(r, Math.hypot(it.x - cx, it.z - cz) + it.r);
    return { cx, cz, r };
  };
  const bounds = new Map<SceneRec, { cx: number; cz: number; r: number }>();
  const clearOf = (items: SceneItem[], b: { cx: number; cz: number; r: number }, list: SceneRec[], gap: number) => {
    for (const sc of list) {
      const q0 = bounds.get(sc)!;
      if (Math.hypot(q0.cx - b.cx, q0.cz - b.cz) >= q0.r + b.r + gap) continue;
      for (const it of items) for (const q of sc.items) if (Math.hypot(it.x - q.x, it.z - q.z) < it.r + q.r + gap) return false;
    }
    return true;
  };
  const fits = (items: SceneItem[], gap = 1.5) => {
    const b = bound(items);
    if (!clearOf(items, b, placed, gap) || !clearOf(items, b, echoes, 0.8)) return false;
    // only what is near this scene takes part in the room checks (the same answers: the rest is further than any margin)
    const R = b.r + 6, nearSeg = (q: { ax: number; az: number; bx: number; bz: number }, pad: number) => { const d = R + pad; return !((q.ax - b.cx > d && q.bx - b.cx > d) || (b.cx - q.ax > d && b.cx - q.bx > d) || (q.az - b.cz > d && q.bz - b.cz > d) || (b.cz - q.az > d && b.cz - q.bz > d)); };
    if (items.length >= 4) {
      tN = tracks.filter((q) => nearSeg(q, 0)); cN = cover.filter((q) => nearSeg(q, q.r + 3)); kN = keep.filter((k) => Math.hypot(k.x - b.cx, k.z - b.cz) <= R);
      pN = look.places.filter((q) => Math.hypot(q.x - b.cx, q.z - b.cz) - q.r <= R); sN = props.filter((q) => Math.hypot(q.x - b.cx, q.z - b.cz) - q.r <= R);
    }
    let ok = true;
    for (const it of items) if (!roomFor(it)) { ok = false; break; }
    tN = tracks; cN = cover; kN = keep; pN = look.places; sN = props;
    return ok;
  };
  const keepRec = (list: SceneRec[], r: SceneRec) => { list.push(r); bounds.set(r, bound(r.items)); };
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const emit = (rc: Recipe, x: number, y: number, z: number, yaw: number) => {
    M.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S.set(1, 1, 1));
    for (const op of rc.ops) {
      L.compose(V.set(op.x, op.y, op.z), Q.setFromEuler(E.set(op.tilt, op.yaw, op.roll, 'YXZ')), S.set(op.sx, op.sy, op.sz)).premultiply(M);
      for (const b of ['low', 'metal', 'glow'] as Bucket[]) { const p = op.p[b]; if (p) sink.put(b, p, L); }
    }
  };
  const toWorld = (lx: number, lz: number, x: number, z: number, yaw: number) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  const rec = (kind: string, where: string, x: number, z: number, yaw: number, items: SceneItem[], main: { x: number; z: number }): SceneRec =>
    ({ kind, where, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), main: { x: +main.x.toFixed(2), z: +main.z.toFixed(2) }, items: items.map((it) => ({ ...it, x: +it.x.toFixed(2), z: +it.z.toFixed(2) })) });
  const tryAt = (kind: string, where: string, x: number, z: number, yaw0: number, o2: { backed?: boolean; far?: boolean; spread?: number; rc?: Recipe } = {}) => {
    const far = !!o2.far, backed = !!o2.backed;
    if (left(kind) <= 0 || (!far && placed.length - farN >= MAX)) return false;
    for (const sc of placed) if (Math.hypot(sc.x - x, sc.z - z) < (sc.kind === kind ? 28 : 12)) return false;
    // quick noes before the parts are made: a scene's middle is never on a spot, a rock, a place or past the edge
    if (keepClear(x, z) < 3.2 || (!far && (coverClear(x, z) < 0.3 || placeClear(x, z) < 2 || beyond(x, z) > -2))) return false;
    for (let t = 0; t < 3; t++) {
      let rc = t === 0 ? o2.rc : undefined;
      if (!rc) { rc = new Recipe(); KINDS[kind](rc, K, rnd, { backed, far }); }
      const yaw = yaw0 + (t === 0 ? 0 : (rnd() - 0.5) * (o2.spread ?? 0.8));
      let items = world(rc, x, z, yaw, far);
      if (!fits(items)) continue;
      if (!far) {
        // the circles the measuring added must have room too (the declared ones have)
        const n0 = rc.items.length;
        autoCover(rc);
        if (rc.items.length > n0) { items = world(rc, x, z, yaw, far); if (!fits(items.slice(n0))) continue; }
      }
      emit(rc, x, far ? waterLevel : 0, z, yaw);
      const main = toWorld(rc.main.x, rc.main.z, x, z, yaw);
      keepRec(placed, rec(kind, where, x, z, yaw, items, main));
      used.set(kind, (used.get(kind) ?? 0) + 1);
      if (far) farN++;
      else {
        for (const p of rc.paints) paints.push({ ...p, ...toWorld(p.x, p.z, x, z, yaw), yaw });
        if (rc.trail) {
          const tp = trackPoint(main.x, main.z);
          if (tp.d > 4 && tp.d < 22) { const ux = (tp.x - main.x) / tp.d, uz = (tp.z - main.z) / tp.d; trails.push({ t: rc.trail, ax: main.x + ux * 1.5, az: main.z + uz * 1.5, bx: tp.x - ux * 1.2, bz: tp.z - uz * 1.2 }); }
        }
      }
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
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, d = 4.6 + rnd() * 2; if (tryAt('shrine', 'fork', x + Math.cos(a) * d, z + Math.sin(a) * d, rnd() * 6)) break; }
    }
  }
  // 2. Past the edge on the water's side (never the south): a boat half sunk in the black lake. Early, so the caps never leave it out.
  for (let k = 0; k < 120 && left('wreck') > 0; k++) {
    const a = rnd() * Math.PI * 2, rr = rimAt(rim, a) + 7 + rnd() * 8, x = RING.x + Math.cos(a) * rr, z = RING.z + Math.sin(a) * rr;
    tryAt('wreck', 'far', x, z, rnd() * 6, { far: true, spread: 1 });
  }
  // 3. By the lake's edge, on the floor: the flooded camp (where the black water is a few metres past the outline).
  for (let k = 0; k < 160 && left('flooded') > 0; k++) {
    const a = rnd() * Math.PI * 2, rr = rimAt(rim, a), ox = RING.x + Math.cos(a) * (rr + 6), oz = RING.z + Math.sin(a) * (rr + 6);
    if (cave.water(ox - RING.x, oz - RING.z) < 0.6 || cave.south(ox - RING.x, oz - RING.z) > 0.3) continue;
    const d = rr - 7.5 - rnd() * 3, x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
    tryAt('flooded', 'shore', x, z, Math.atan2(RING.x - x, RING.z - z) + Math.PI);
  }
  // 4. By the places that suit them: the last camp by the rest, a cart or a derailed train by the yard, a winch, a collapse or the
  //    fallen cage by the shaft, a harvest by the crystal halls, a survey by the shore and the pools, a shrine by the well.
  const SUITS: Record<string, string[]> = { rest: ['camp'], yard: ['junction', 'cart'], shaft: ['cage', 'winch', 'collapse'], hall: ['harvest'], shore: ['survey', 'flooded'], pools: ['survey', 'shrine'], well: ['shrine'], camp: ['camp'] };
  for (const pl of shuffle(look.places.slice())) {
    for (const kind of SUITS[pl.kind ?? ''] ?? []) {
      const needsBack = kind === 'winch';
      let done = false;
      for (let k = 0; k < 24 && !done; k++) {
        const a = rnd() * Math.PI * 2, d = pl.r + 5 + rnd() * 8, x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        if (needsBack) {
          const c = cover.find((q) => q.r > 0.7 && segDist(x, z, q.ax, q.az, q.bx, q.bz) < q.r + 3);
          if (!c) continue;
          const t = rnd(), cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
          done = tryAt(kind, 'place', cx, cz + c.r + 1.5, (rnd() - 0.5) * 0.3, { backed: true, spread: 0.3 });
        } else done = tryAt(kind, 'place', x, z, rnd() * 6);
      }
    }
  }
  // 5. Along the tracks, on the verge: one every 26 to 36 m of track, either side.
  const TRACKSIDE = ['camp', 'cart', 'collapse', 'harvest', 'survey', 'junction', 'cage', 'shrine'];
  let since = 10 + rnd() * 14;
  for (const s of shuffle(tracks.slice())) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 3; d < len - 3; d += 3) {
      since += 3;
      if (since < 26 + rnd() * 10) continue;
      const side = rnd() < 0.5 ? 1 : -1, cx = s.ax + ux * d, cz = s.az + uz * d;
      if (placed.some((sc) => Math.hypot(sc.x - cx, sc.z - cz) < 9)) continue;
      const sides = [side, -side].filter((sd) => { const x = cx - uz * sd * 7, z = cz + ux * sd * 7; return beyond(x, z) < -4 && keepClear(x, z) > 5 && placeClear(x, z) > 3 && coverClear(x, z) > 1.5 && cave.water(x - RING.x, z - RING.z) < 0.02; });
      if (!sides.length) { since -= 6; continue; }
      let ok = false;
      for (const kind of pick(TRACKSIDE).slice(0, 4)) {
        for (const [sd, extra] of [[sides[0], 0.6], [sides[0], 1.8], [sides[1] ?? 0, 0.6]]) {
          if (!sd) continue;
          const rc = new Recipe(); KINDS[kind](rc, K, rnd, { backed: false, far: false });
          const offd = 2.4 + rc.reach + extra, x = cx - uz * sd * offd, z = cz + ux * sd * offd;
          if (tryAt(kind, 'track', x, z, Math.atan2(ux, uz) + (rnd() - 0.5) * 0.6, { rc })) { ok = true; break; }
        }
        if (ok) break;
      }
      since = ok ? 0 : since - 6;
    }
  }
  // 6. Against the rock: the tall stories stand right south of a piece of cover.
  const rocks = shuffle(cover.filter((c) => c.r >= 0.7 && beyond(c.ax, c.az) < -3));
  let backedN = 0;
  for (const c of rocks) {
    if (backedN >= 6) break;
    const t = 0.2 + rnd() * 0.6, cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
    for (const kind of pick(['camp', 'cart', 'collapse', 'survey', 'winch', 'cage'])) {
      const back = kind === 'camp' ? 0.95 : kind === 'cart' ? 1.25 : kind === 'collapse' ? 1.3 : kind === 'survey' ? 1.05 : kind === 'cage' ? 1.25 : 1.5;
      if (tryAt(kind, 'backed', cx, cz + c.r + back, (rnd() - 0.5) * 0.3, { backed: true, spread: 0.3 })) { backedN++; break; }
    }
  }
  // 7. The open cave floor between the places.
  const rmax = Math.max(...rim);
  for (let k = 0, open = 0; k < 1200 && open < 6; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyond(x, z) > -6 || trackClear(x, z) < 7 || placeClear(x, z) < 6 || keepClear(x, z) < 6 || coverClear(x, z) < 2) continue;
    if (placed.some((sc) => Math.hypot(sc.x - x, sc.z - z) < 12)) continue;
    for (const kind of pick(['camp', 'cart', 'collapse', 'harvest', 'survey', 'junction', 'cage', 'shrine']).slice(0, 3)) if (tryAt(kind, 'open', x, z, rnd() * 6)) { open++; break; }
  }
  // 8. Echoes on the verges between the scenes: ore off a cart, a dropped lamp, a pick, a sack, a helmet, a sleeper, a rope's coil.
  const EK = Object.keys(ECHOES);
  let gap = 6;
  for (const s of tracks) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 2; d < len - 2; d += 2) {
      gap += 2;
      if (gap < 14 + rnd() * 8 || echoes.length >= 20) continue;
      const cx = s.ax + ux * d, cz = s.az + uz * d;
      if (placed.some((sc) => Math.hypot(sc.x - cx, sc.z - cz) < 9)) continue;
      const side = rnd() < 0.5 ? 1 : -1, offd = 3.4 + rnd() * 1.2, x = cx - uz * side * offd, z = cz + ux * side * offd;
      const e = new Recipe(), kind = EK[Math.floor(rnd() * EK.length)];
      ECHOES[kind](e, K, rnd);
      const yaw = rnd() * 6;
      let items = world(e, x, z, yaw, false);
      if (!fits(items, 0.8)) { gap -= 4; continue; } // no room here: the next try a few metres on
      const n0 = e.items.length;
      autoCover(e); items = world(e, x, z, yaw, false);
      if (!fits(items.slice(n0), 0.8)) continue;
      emit(e, x, 0, z, yaw);
      for (const p of e.paints) paints.push({ ...p, ...toWorld(p.x, p.z, x, z, yaw), yaw });
      keepRec(echoes, { ...rec(`echo:${kind}`, 'verge', x, z, yaw, items, { x, z }), echo: true });
      gap = 0;
    }
  }
  // 9. The scenes' ground, painted into the cave floor (never on a place): trodden ground, ash, ore and rock dust, ballast, puddles; the
  //    prints and drag marks back to the track.
  if (o.ground) paintGround(o.ground, paints, trails, look);
  return { scenes: placed.concat(echoes), ms: +(performance.now() - t0).toFixed(1) };
}

/** Paints the scenes' ground into the cave floor's canvas (before it goes to the graphics card): no draw calls, no geometry. */
function paintGround(gc: { canvas: HTMLCanvasElement; L: number }, paints: (Paint & { yaw: number })[], trails: { t: 'prints' | 'drag'; ax: number; az: number; bx: number; bz: number }[], look: DeepLook) {
  const g = gc.canvas.getContext('2d');
  if (!g) return;
  const size = gc.canvas.width, ppm = size / gc.L;
  const px = (x: number) => size / 2 + (x - RING.x) * ppm, pz = (z: number) => size / 2 + (z - RING.z) * ppm;
  g.save();
  g.beginPath();
  g.rect(0, 0, size, size);
  for (const p of look.places) { g.moveTo(px(p.x) + (p.r + 0.3) * ppm, pz(p.z)); g.arc(px(p.x), pz(p.z), (p.r + 0.3) * ppm, 0, Math.PI * 2, true); }
  g.clip('evenodd');
  const rgba = (c: string, a: number) => `rgba(${c},${a.toFixed(3)})`;
  for (const p of paints) {
    g.save();
    g.translate(px(p.x), pz(p.z));
    g.rotate(p.rot - p.yaw);
    if (p.t === 'stain' || p.t === 'puddle') {
      g.scale(1, p.b / p.a);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.a * ppm);
      if (p.t === 'puddle') { gr.addColorStop(0, rgba(p.c, p.al)); gr.addColorStop(0.8, rgba(p.c, p.al)); gr.addColorStop(0.9, 'rgba(96,112,150,0.55)'); gr.addColorStop(1, 'rgba(96,112,150,0)'); }
      else { gr.addColorStop(0, rgba(p.c, p.al)); gr.addColorStop(0.55, rgba(p.c, p.al * 0.75)); gr.addColorStop(1, rgba(p.c, 0)); }
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, p.a * ppm, 0, Math.PI * 2); g.fill();
      if (p.t === 'puddle') { g.fillStyle = 'rgba(120,140,180,0.25)'; g.beginPath(); g.ellipse(-p.a * 0.3 * ppm, -p.a * 0.25 * ppm, p.a * 0.35 * ppm, p.a * 0.12 * ppm, 0.3, 0, Math.PI * 2); g.fill(); }
    } else if (p.t === 'fan') {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.a * ppm);
      gr.addColorStop(0, rgba(p.c, p.al)); gr.addColorStop(0.5, rgba(p.c, p.al * 0.6)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, p.a * ppm, -p.b, p.b); g.closePath(); g.fill();
    } else if (p.t === 'band') {
      const w = p.b * ppm, l = p.a * ppm, gr = g.createLinearGradient(-l / 2, 0, l / 2, 0);
      gr.addColorStop(0, rgba(p.c, 0)); gr.addColorStop(0.1, rgba(p.c, p.al)); gr.addColorStop(0.9, rgba(p.c, p.al)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr;
      g.fillRect(-l / 2, -w / 2, l, w);
    }
    g.restore();
  }
  for (const t of trails) {
    const len = Math.hypot(t.bx - t.ax, t.bz - t.az);
    if (len < 0.5) continue;
    g.save();
    g.translate(px(t.ax), pz(t.az));
    g.rotate(Math.atan2(t.bz - t.az, t.bx - t.ax));
    const L2 = len * ppm;
    if (t.t === 'drag') {
      const gr = g.createLinearGradient(0, 0, L2, 0);
      gr.addColorStop(0, rgba(G.tramp, 0.55)); gr.addColorStop(1, rgba(G.tramp, 0.12));
      g.fillStyle = gr; g.fillRect(0, -0.35 * ppm, L2, 0.7 * ppm);
    } else {
      g.fillStyle = rgba(G.dust, 0.4);
      for (let d = 0, k = 0; d < len; d += 0.42, k++) { g.beginPath(); g.ellipse(d * ppm, (k % 2 ? 0.13 : -0.13) * ppm, 0.12 * ppm, 0.06 * ppm, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
  g.restore();
}
