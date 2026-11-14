import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import { rimAt } from '../land';
import type { SandsLook } from '../sandsZone';
import type { SandsLand } from '../sandsDepth';

/**
 * Scenes on a Sands floor (floors 21 to 30; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props
 * on the maps, make actual scenarios and stuff", then "continue more refine"). A scene is a group of props, 5 to 13 m across, that tells at
 * a glance from the game's camera what happened there: a caravan ambushed, a nomad's tent blown down, a water-wheel fallen by its dry
 * channel. Called from sandsDepth.ts's `build`, it adds its parts to the depth's own merged meshes (no draw calls of its own) and paints
 * each scene's ground into the sand's canvas before it goes to the graphics card: trampled sand, spice fanned out, drifts, the channel's
 * cracked bed, and the wheel ruts, footprints or drag marks that lead back to the road.
 *
 * **Looks only, never cover:** nothing here stops a walk or a shot. On walkable sand only low things (under knee height: a cart's bed
 * fallen flat, a tent's cloth lying over its pole, a water-wheel on its side, spilled crates); anything taller stands right south of
 * existing cover (the camera looks north, so it hides nobody) or past the walkable edge as a story in the background (never in the
 * south, the camera's side). Every part keeps 3 m off the floor's spots (keep.ts), off the roads' middles, the cover, the places' courts
 * and the depth's own props.
 *
 * Kinds, each with two or three ways of being: the ambushed caravan (its cart's bed flat, or its loads round the torn awning, or against
 * a rock the cart on its side), a fight's aftermath (a great standard fallen, or a chariot upside down), the abandoned dig (a pit, or a
 * trench with its finds on a cloth), the dry well (its windlass down, or jars and water-skins left round it), the travellers' rest (a rug,
 * or two saddles; a lean-to against a rock), the sundial and the broken obelisk (or a column fallen in its drums), a shrine at a fork, a
 * grave (or three), the fallen tent (half standing against a rock), the half-buried amphorae (a line, or a heap), the water-wheel at a dry
 * channel (upright against a rock); and against the rocks or past the edge: a jackal's head in black stone and gold half buried in a
 * drift, a covered wagon sunk to its axles, pots at a tomb's door, the bleached ribs of a great beast. Between the scenes, single props on
 * the verges (a crate, a sack and its spice, arrows) join the stories along the road.
 *
 * Every part's shape is built once for the page (`protos`) and copied into place by a matrix; each kind is a recipe of parts with its own
 * small variations. Its own random stream, so nothing that was there moves.
 */

/** A part's shape: positions, normals and colours, not indexed. Built once, copied per placement. */
export interface Proto { pos: Float32Array; nor: Float32Array; col: Float32Array }
/** Where the parts go: the depth's merged meshes (`s` casts shadows, `f` is flat on the ground). */
export interface SceneSink { proto(kind: 's' | 'f', p: Proto, m: THREE.Matrix4): void }
/** A part's footprint in the world: a circle and its height; `far`: meant to stand past the walkable edge. */
export interface SceneItem { x: number; z: number; r: number; h: number; far: boolean }
/** A placed scene: `main` is its main piece (the views probe's); `echo`: a single prop dropped between the scenes, not a scene. */
export interface SceneRec { kind: string; where: string; x: number; z: number; yaw: number; items: SceneItem[]; main?: { x: number; z: number }; echo?: boolean }

/** For the before-and-after pictures and the speed A/B: `VITE_NO_SCENES=1` at the dev server, or `window.__noScenes = true` before a floor is built. */
export { scenesOff };

/** The Sands' colours (the heroes' palette, sandsZone.ts's; turquoise is the canyon's own). */
const C = {
  sandstone: '#9a7252', cream: '#a89a80', ivory: '#c8b994', wood: '#4a3220', plank: '#6b4226', lacquer: '#1d1b21',
  wine: '#5e1a28', turquoise: '#1f8a86', clay: '#9a5638', rope: '#b89a5a', iron: '#3c3f47', steel: '#70747e', brass: '#a8843e',
  bone: '#c4b89c', hide: '#9a7a56', red: '#8a3424', sand: '#9c7850', sandDark: '#8c6c4c', pitRim: '#7a5c44', pit: '#5a4434',
  grain: '#c8b890', ochre: '#b0843a', char: '#2a2420', ash: '#5a4a40', rockA: '#8a4c36', rockB: '#a0664a', glass: '#d8c890',
} as const;

// --- shapes (standing on y = 0 unless said) ------------------------------------------------------------------------------------------
type Part = [THREE.BufferGeometry, string];
const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0: number, r1: number, h: number, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
/** A cylinder centred on its middle (`cyl` stands on its base): for the ones laid on their side. */
const rod = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
const ball = (r: number, w = 10, hs = 7) => new THREE.SphereGeometry(r, w, hs);
const ring = (R: number, t: number, rs = 3, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, Math.min(rs, 3), ts, arc); // thin trims and rims: three sides read the same from the game's camera
const cone = (r: number, h: number, n = 10) => new THREE.ConeGeometry(r, h, n).translate(0, h / 2, 0);

function proto(parts: Part[]): Proto {
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

/** Every part's shape, made the first time a Sands floor is built and kept for the page (a few hundred kB). */
let PROTOS: ReturnType<typeof makeProtos> | null = null;
function makeProtos() {
  const P = proto;
  const arrow = (): Part[] => [[new THREE.CylinderGeometry(0.014, 0.014, 0.66, 4, 1, true).translate(0, 0.19, 0), C.wood], [box(0.006, 0.13, 0.06, 0, 0.44), C.wine], [box(0.06, 0.13, 0.006, 0, 0.44), C.cream]];
  const pot = (body: string, band: string): Part[] => [
    [ball(0.32, 10, 7).scale(1, 1.22, 1).translate(0, 0.4, 0), body], [cyl(0.12, 0.16, 0.16, 10).translate(0, 0.76, 0), body],
    [ring(0.13, 0.026, 4, 12).rotateX(Math.PI / 2).translate(0, 0.93, 0), C.brass], [ring(0.325, 0.03, 4, 18).rotateX(Math.PI / 2).translate(0, 0.46, 0), band],
  ];
  const wheelParts = (R: number, col: string): Part[] => [
    [ring(R, 0.07, 3, 14), col], [cyl(0.12, 0.12, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0, -0.08), col],
    ...[0, 1, 2].map((k) => [box(R * 2, 0.06, 0.05, 0, 0, 0).rotateZ((k * Math.PI) / 3), col] as Part),
    [cyl(0.07, 0.07, 0.04, 6).rotateX(Math.PI / 2).translate(0, 0, 0.08), C.brass],
  ];
  /** A cloth draped by `h(x, z)` (its height over the sand), in `n` strips across z, each its own colour. */
  const drape = (w: number, d: number, n: number, col: (k: number) => string, h: (x: number, z: number) => number): Part[] => Array.from({ length: n }, (_, k) => {
    const g = new THREE.PlaneGeometry(w, d / n, 9, 3).rotateX(-Math.PI / 2).translate(0, 0, -d / 2 + ((k + 0.5) * d) / n), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, h(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return [g, col(k)] as Part;
  });
  /** A water-wheel lying on its side (radius R): two rims, twelve paddles, the spokes, a hub capped in brass. */
  const bigWheel = (R: number): Part[] => [
    [ring(R, 0.05, 3, 20).rotateX(Math.PI / 2).translate(0, 0.07, 0), C.wood], [ring(R, 0.05, 3, 20).rotateX(Math.PI / 2).translate(0, 0.43, 0), C.wood],
    ...Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return [box(0.44, 0.34, 0.06, 0, 0, 0).rotateY(-a).translate(Math.cos(a) * (R - 0.2), 0.25, Math.sin(a) * (R - 0.2)), C.plank] as Part; }),
    ...[0, 1, 2, 3].map((k) => [box(R * 2, 0.06, 0.1, 0, 0.43, 0).rotateY((k * Math.PI) / 4), C.wood] as Part),
    [cyl(0.2, 0.2, 0.46, 10).translate(0, 0.02, 0), C.wood], [cyl(0.24, 0.24, 0.04, 10).translate(0, 0.46, 0), C.brass], [ring(R, 0.02, 3, 20).rotateX(Math.PI / 2).translate(0, 0.47, 0), C.brass],
  ];
  return {
    unitWood: P([[new THREE.BoxGeometry(1, 1, 1), C.wood]]),
    unitRope: P([[new THREE.BoxGeometry(1, 1, 1), C.rope]]),
    poleWood: P([[new THREE.CylinderGeometry(1, 1, 1, 6), C.wood]]), // a unit pole along y, centred
    // --- the caravan
    crate: P([[box(0.6, 0.5, 0.6), C.plank], [box(0.62, 0.05, 0.62, 0, 0.12), C.lacquer], [box(0.62, 0.05, 0.62, 0, 0.38), C.lacquer], [box(0.63, 0.025, 0.63, 0, 0.5), C.brass]]),
    crateOpen: P([
      [box(0.6, 0.05, 0.6), C.plank], [box(0.6, 0.45, 0.05, 0, 0.27, 0.275), C.plank], [box(0.6, 0.45, 0.05, 0, 0.27, -0.275), C.plank],
      [box(0.05, 0.45, 0.5, 0.275, 0.27), C.plank], [box(0.05, 0.45, 0.5, -0.275, 0.27), C.plank], [box(0.62, 0.05, 0.62, 0, 0.12), C.lacquer],
      [rod(0.1, 0.1, 0.52, 8).rotateZ(Math.PI / 2).translate(0, 0.38, -0.12), C.wine], [rod(0.1, 0.1, 0.52, 8).rotateZ(Math.PI / 2).translate(0, 0.4, 0.1), C.turquoise],
    ]),
    lid: P([[box(0.62, 0.05, 0.62), C.plank], [box(0.62, 0.052, 0.08, 0, 0.026, 0.2), C.lacquer], [box(0.62, 0.052, 0.08, 0, 0.026, -0.2), C.lacquer]]),
    sack: P([[ball(1, 8, 5).scale(0.42, 0.24, 0.3).translate(0, 0.2, 0), C.cream], [cyl(0.08, 0.1, 0.14, 7).rotateZ(Math.PI / 2).translate(0.46, 0.18, 0), C.cream], [ring(0.09, 0.022, 4, 8).rotateY(Math.PI / 2).translate(0.52, 0.18, 0), C.rope]]),
    sackHide: P([[ball(1, 8, 5).scale(0.4, 0.26, 0.3).translate(0, 0.22, 0), C.hide], [cyl(0.08, 0.1, 0.14, 7).rotateZ(Math.PI / 2).translate(0.44, 0.2, 0), C.hide], [ring(0.09, 0.022, 4, 8).rotateY(Math.PI / 2).translate(0.5, 0.2, 0), C.rope]]),
    heapRed: P([[cone(0.62, 0.24, 12), C.red]]),
    heapOchre: P([[cone(0.62, 0.24, 12), C.ochre]]),
    heapGrain: P([[cone(0.62, 0.22, 12), C.grain]]),
    heapTurq: P([[cone(0.5, 0.18, 12), C.turquoise]]),
    lantern: P([
      [rod(0.12, 0.12, 0.3, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0), C.lacquer], [rod(0.105, 0.105, 0.16, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0), C.glass],
      [cone(0.13, 0.12, 8).rotateZ(-Math.PI / 2).translate(0.15, 0.12, 0), C.brass], [ring(0.08, 0.014, 4, 10).rotateY(Math.PI / 2).translate(0.32, 0.12, 0), C.brass],
    ]),
    wheelFlat: P(wheelParts(0.7, C.wood).map(([g, c]) => [g.rotateX(-Math.PI / 2).translate(0, 0.08, 0), c] as Part)),
    clothTurq: P([[box(2.6, 0.03, 1.7), C.turquoise], [box(2.6, 0.034, 0.26, 0, 0.017, 0.5), C.wine], [box(2.62, 0.034, 0.06, 0, 0.017, -0.84), C.brass]]),
    clothWine: P([[box(2.4, 0.03, 1.6), C.wine], [box(2.4, 0.034, 0.22, 0, 0.017, -0.4), C.cream]]),
    arrow: P(arrow()),
    // the cart on its side, against a rock: its floor towards the camera (+z), its open top to the rock (-z), one wheel up in the air
    cartSide: P([
      [box(2.4, 1.3, 0.1, 0, 0.65, 0), C.plank], [box(2.4, 0.08, 0.5, 0, 1.26, -0.27), C.plank], [box(2.4, 0.08, 0.5, 0, 0.04, -0.27), C.plank],
      [box(0.08, 1.3, 0.5, 1.18, 0.65, -0.27), C.wood], [box(0.08, 1.3, 0.5, -1.18, 0.65, -0.27), C.wood], [box(2.44, 0.05, 0.12, 0, 1.31, 0.02), C.brass],
      [box(2.2, 0.1, 0.1, 0, 0.35, 0.1), C.wood], [box(2.2, 0.1, 0.1, 0, 0.95, 0.1), C.wood],
      [cyl(0.05, 0.05, 1.5, 6).translate(0, -0.05, 0.3), C.iron],
      ...wheelParts(0.62, C.wood).map(([g, c]) => [g.rotateX(-Math.PI / 2).translate(0, 1.47, 0.3), c] as Part),
    ]),
    // --- a jackal's head in black stone, fallen from its statue and lying on its cheek, half buried: its profile to the sky (the camera
    //     sees it from above). The snout along +x, the ears towards +z; gold inlay on the eye and the ear, a collar of turquoise and gold
    //     at the broken neck, which shows the pale stone inside.
    jackal: P([
      [ball(1, 12, 8).scale(0.72, 0.46, 0.62).translate(0, 0.34, 0), C.lacquer],
      [new THREE.CylinderGeometry(0.11, 0.33, 1.35, 6, 1).rotateZ(-Math.PI / 2).scale(1, 0.8, 1).translate(0.92, 0.3, -0.12), C.lacquer],
      [ball(0.1, 8, 6).translate(1.6, 0.31, -0.12), C.lacquer],
      [ball(0.13, 10, 6).scale(1.9, 0.3, 0.7).translate(0.42, 0.76, 0.06), C.brass],
      [box(0.12, 0.03, 0.04, 0.44, 0.8, 0.06), C.lacquer],
      [cone(0.3, 1.15, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).rotateX(Math.PI / 2).rotateY(-0.35).translate(-0.12, 0.62, 0.42), C.lacquer],
      [cone(0.17, 0.8, 4).rotateY(Math.PI / 4).scale(1, 1, 0.2).rotateX(Math.PI / 2).rotateY(-0.35).translate(-0.1, 0.7, 0.5), C.brass],
      [cone(0.3, 1.1, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).rotateX(Math.PI / 2).rotateY(-0.6).translate(-0.3, 0.12, 0.38), C.lacquer],
      [cyl(0.48, 0.48, 0.16, 16).rotateZ(Math.PI / 2).translate(-0.62, 0.3, 0), C.turquoise],
      [cyl(0.5, 0.5, 0.05, 16).rotateZ(Math.PI / 2).translate(-0.5, 0.3, 0), C.brass],
      [cyl(0.5, 0.5, 0.05, 16).rotateZ(Math.PI / 2).translate(-0.74, 0.3, 0), C.brass],
      [cyl(0.42, 0.42, 0.04, 14).rotateZ(Math.PI / 2).translate(-0.79, 0.3, 0), C.ivory],
      // the headdress's gold bands round the back of the head (they read from far)
      [ring(1, 0.04, 4, 20).rotateY(Math.PI / 2).scale(1, 0.399, 0.535).translate(-0.38, 0.34, 0), C.brass],
      [ring(1, 0.04, 4, 20).rotateY(Math.PI / 2).scale(1, 0.463, 0.621).translate(-0.12, 0.34, 0), C.brass],
      [ring(1, 0.04, 4, 20).rotateY(Math.PI / 2).scale(1, 0.461, 0.618).translate(0.14, 0.34, 0), C.brass],
    ]),
    paw: P([[box(0.56, 0.28, 0.8), C.lacquer], ...[-0.18, 0, 0.18].map((x) => [ball(0.12, 8, 6).scale(1, 0.9, 1.2).translate(x, 0.12, 0.42), C.lacquer] as Part), [box(0.6, 0.06, 0.1, 0, 0.25, -0.2), C.brass], [box(0.5, 0.24, 0.04, 0, 0.12, -0.42), C.ivory]]),
    drift: P([[new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.sand]]), // only its top half ever shows
    driftDark: P([[ball(1, 14, 8), C.sandDark]]),
    // --- the dig
    pit: P([[box(3.0, 0.02, 2.2, 0, 0.01), C.pitRim], [box(2.6, 0.02, 1.8, 0, 0.02), C.pit], [box(2.6, 0.022, 0.5, 0, 0.026, -0.65), C.pitRim]]),
    peg: P([[cyl(0.03, 0.04, 0.42, 5), C.wood], [cyl(0.045, 0.045, 0.04, 5).translate(0, 0.4, 0), C.brass]]),
    sieve: P([[box(0.9, 0.06, 0.62), C.wood], [box(0.8, 0.012, 0.52, 0, 0.065), C.rope], [box(0.92, 0.03, 0.05, 0, 0.07, 0.29), C.brass]]),
    basket: P([[cyl(0.26, 0.21, 0.34, 12), C.rope], [ring(0.26, 0.025, 4, 14).rotateX(Math.PI / 2).translate(0, 0.34, 0), C.brass], [cyl(0.23, 0.23, 0.02, 12).translate(0, 0.28, 0), C.sandDark]]),
    basketLying: P([[cyl(0.26, 0.21, 0.34, 12).rotateZ(Math.PI / 2).translate(-0.17, 0.25, 0), C.rope], [ring(0.26, 0.025, 4, 14).rotateY(Math.PI / 2).translate(0.17, 0.25, 0), C.brass], [cone(0.45, 0.14, 10).translate(0.55, 0, 0), C.sandDark]]),
    ladder: P([[box(0.06, 0.06, 2.6, 0.22, 0.03), C.wood], [box(0.06, 0.06, 2.6, -0.22, 0.03), C.wood], ...[-1.1, -0.73, -0.36, 0, 0.37, 0.74, 1.1].map((z) => [box(0.5, 0.04, 0.05, 0, 0.065, z), C.plank] as Part)]),
    shovel: P([[rod(0.025, 0.025, 1.3, 6).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.wood], [box(0.24, 0.02, 0.3, 0, 0.02, 0.78), C.steel], [box(0.18, 0.04, 0.05, 0, 0.03, -0.66), C.brass]]),
    pick: P([[rod(0.025, 0.025, 0.95, 6).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.wood], [box(0.6, 0.05, 0.06, 0, 0.04, 0.46), C.steel], [box(0.08, 0.07, 0.08, 0, 0.04, 0.46), C.brass]]),
    sherds: P([[box(0.14, 0.02, 0.1, 0, 0.01, 0).rotateY(0.4), C.clay], [box(0.1, 0.02, 0.12, 0.25, 0.012, 0.1).rotateY(-0.3), C.turquoise], [box(0.12, 0.02, 0.08, -0.2, 0.012, 0.18), C.clay], [box(0.09, 0.02, 0.09, 0.05, 0.012, -0.25), C.cream]]),
    // --- the dry well
    block: P([[box(0.62, 0.42, 0.36), C.sandstone], [box(0.64, 0.05, 0.38, 0, 0.44), C.turquoise]]),
    hole: P([[cyl(0.8, 0.8, 0.02, 20), C.lacquer]]),
    postLying: P([[box(0.14, 0.14, 1.7, 0, 0.07), C.wood], [box(0.18, 0.04, 0.18, 0, 0.07, 0.86).rotateX(Math.PI / 2), C.brass]]),
    drum: P([[rod(0.15, 0.15, 1.2, 10).rotateZ(Math.PI / 2).translate(0, 0.2, 0), C.rope], [rod(0.2, 0.2, 0.05, 12).rotateZ(Math.PI / 2).translate(0.62, 0.2, 0), C.wood], [rod(0.2, 0.2, 0.05, 12).rotateZ(Math.PI / 2).translate(-0.62, 0.2, 0), C.wood], [box(0.05, 0.05, 0.36, 0.7, 0.2, 0.16), C.iron], [box(0.05, 0.05, 0.16, 0.76, 0.2, 0.34), C.iron]]),
    bucketLying: P([[cyl(0.2, 0.16, 0.32, 12).rotateZ(Math.PI / 2).translate(-0.16, 0.2, 0), C.wood], [ring(0.2, 0.02, 4, 14).rotateY(Math.PI / 2).translate(0.15, 0.2, 0), C.brass], [ring(0.18, 0.02, 4, 14).rotateY(Math.PI / 2).translate(-0.06, 0.19, 0), C.brass]]),
    jarLying: P([[ball(0.3, 10, 7).scale(1, 1.25, 1).rotateZ(Math.PI / 2).translate(0, 0.28, 0), C.clay], [cyl(0.1, 0.13, 0.16, 8).rotateZ(Math.PI / 2).translate(-0.44, 0.28, 0), C.clay], [ring(0.31, 0.025, 4, 16).rotateY(Math.PI / 2).translate(0.05, 0.28, 0), C.turquoise]]),
    // --- the travellers' rest
    rug: P([[box(2.3, 0.012, 1.6, 0, 0.012), C.wine], [box(2.0, 0.012, 1.3, 0, 0.022), C.turquoise], [box(0.62, 0.012, 0.62, 0, 0.032).rotateY(Math.PI / 4), C.cream], [box(2.0, 0.012, 0.05, 0, 0.034, 0.5), C.brass], [box(2.0, 0.012, 0.05, 0, 0.034, -0.5), C.brass]]),
    teaTray: P([
      [cyl(0.3, 0.3, 0.03, 16), C.brass], [ball(0.14, 12, 8).scale(1, 0.85, 1).translate(0, 0.15, 0), C.brass], [cone(0.08, 0.07, 10).translate(0, 0.26, 0), C.brass],
      [ball(0.025, 6, 4).translate(0, 0.34, 0), C.lacquer], [cyl(0.02, 0.034, 0.16, 6).rotateZ(-0.9).translate(0.17, 0.17, 0), C.brass], [ring(0.07, 0.013, 4, 10, Math.PI).rotateZ(Math.PI / 2).translate(-0.14, 0.17, 0), C.brass],
      ...[[0.18, 0.15], [-0.05, 0.22], [0.2, -0.12]].map(([x, z]) => [cyl(0.035, 0.03, 0.07, 8).translate(x, 0.03, z), C.cream] as Part),
    ]),
    cushionWine: P([[ball(1, 12, 8).scale(0.34, 0.13, 0.28).translate(0, 0.12, 0), C.wine], ...[[0.3, 0.24], [-0.3, 0.24], [0.3, -0.24], [-0.3, -0.24]].map(([x, z]) => [ball(0.035, 6, 4).translate(x, 0.1, z), C.brass] as Part)]),
    cushionTurq: P([[ball(1, 12, 8).scale(0.34, 0.13, 0.28).translate(0, 0.12, 0), C.turquoise], ...[[0.3, 0.24], [-0.3, 0.24], [0.3, -0.24], [-0.3, -0.24]].map(([x, z]) => [ball(0.035, 6, 4).translate(x, 0.1, z), C.brass] as Part)]),
    fireRing: P([
      ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return [new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.6, 1).translate(Math.cos(a) * 0.44, 0.05, Math.sin(a) * 0.44), k % 2 ? C.rockA : C.rockB] as Part; }),
      [cyl(0.36, 0.36, 0.012, 12), C.ash], [cyl(0.05, 0.05, 0.6, 6).rotateZ(Math.PI / 2).rotateY(0.6).translate(0, 0.06, 0), C.char], [cyl(0.05, 0.05, 0.55, 6).rotateZ(Math.PI / 2).rotateY(-0.7).translate(0, 0.1, 0), C.char],
    ]),
    kettle: P([[ball(0.13, 10, 7).scale(1, 0.85, 1).translate(0, 0.13, 0), C.iron], [cyl(0.018, 0.03, 0.13, 6).rotateZ(-0.8).translate(0.15, 0.15, 0), C.iron], [ring(0.1, 0.012, 4, 10, Math.PI).translate(0, 0.22, 0), C.brass]]),
    pack: P([[box(0.5, 0.32, 0.28), C.hide], [box(0.52, 0.05, 0.3, 0, 0.33), C.hide], [box(0.52, 0.18, 0.03, 0, 0.24, 0.15), C.hide], [box(0.07, 0.08, 0.02, 0, 0.2, 0.17), C.brass]]),
    staff: P([[rod(0.03, 0.03, 1.8, 6).rotateZ(Math.PI / 2).translate(0, 0.03, 0), C.wood], [rod(0.04, 0.04, 0.08, 6).rotateZ(Math.PI / 2).translate(0.9, 0.03, 0), C.brass]]),
    // a lean-to against a rock: its back up on the rock (-z), two poles in front (+z)
    leanTo: P([
      [cyl(0.045, 0.05, 1.05, 6).translate(1.3, 0, 0.9), C.wood], [cyl(0.045, 0.05, 1.05, 6).translate(-1.3, 0, 0.9), C.wood],
      [box(2.8, 0.03, 1.5, 0, 0, 0).rotateX(0.59).translate(0, 1.42, 0.28), C.turquoise], [box(2.8, 0.035, 0.3, 0, 0, 0).rotateX(0.59).translate(0, 1.42, 0.28), C.wine],
      [box(2.84, 0.05, 0.06, 0, 1.03, 0.9), C.brass],
    ]),
    // --- the sundial and the broken obelisk
    dial: P([
      [cyl(0.75, 0.82, 0.3, 8), C.sandstone], [cyl(0.7, 0.7, 0.04, 24).translate(0, 0.3, 0), C.ivory], [ring(0.7, 0.025, 4, 28).rotateX(Math.PI / 2).translate(0, 0.34, 0), C.brass],
      ...Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return [box(0.03, 0.012, 0.12, 0, 0, 0).rotateY(-a).translate(Math.sin(a) * 0.56, 0.345, Math.cos(a) * 0.56), C.lacquer] as Part; }),
      [new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.3)]), { depth: 0.03, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.015, 0.34, -0.25), C.brass],
    ]),
    stump: P([[box(0.72, 0.42, 0.72), C.sandstone], [box(0.76, 0.08, 0.76, 0, 0.32), C.turquoise], [box(0.62, 0.14, 0.62, 0, 0, 0).rotateX(0.22).translate(0, 0.46, 0), C.sandstone]]),
    shaft: P([[box(0.48, 0.48, 1.7, 0, 0.24), C.ivory], [box(0.5, 0.5, 0.1, 0, 0.24, 0.6), C.turquoise], [box(0.5, 0.5, 0.04, 0, 0.24, 0.75), C.brass]]),
    shaftShort: P([[box(0.46, 0.46, 1.2, 0, 0.23), C.ivory], [box(0.48, 0.48, 0.1, 0, 0.23, -0.4), C.turquoise]]),
    pyramidion: P([[cone(0.34, 0.46, 4).rotateY(Math.PI / 4).rotateZ(Math.PI / 2).translate(0.23, 0.24, 0), C.ivory], [cone(0.08, 0.11, 4).rotateY(Math.PI / 4).rotateZ(Math.PI / 2).translate(0.46, 0.24, 0), C.brass]]),
    chunk: P([[new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.7, 1).translate(0, 0.1, 0), C.sandstone]]),
    // --- a wagon sunk to its axles (its length along x)
    wagon: P([
      [box(2.6, 0.1, 1.4, 0, 0.4), C.plank], [box(2.6, 0.55, 0.08, 0, 0.72, 0.7), C.plank], [box(2.6, 0.55, 0.08, 0, 0.72, -0.7), C.plank],
      [box(0.08, 0.55, 1.4, 1.3, 0.72), C.wood], [box(0.08, 0.55, 1.4, -1.3, 0.72), C.wood],
      [box(2.64, 0.04, 0.1, 0, 1.0, 0.7), C.brass], [box(2.64, 0.04, 0.1, 0, 1.0, -0.7), C.brass],
      ...[[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]].flatMap(([x, z]) => wheelParts(0.65, C.wood).map(([g, c]) => [g.rotateY(z > 0 ? 0 : Math.PI).translate(x, 0.28, z), c] as Part)),
      [ball(1, 10, 7).scale(0.42, 0.26, 0.3).translate(0.5, 0.6, 0.2), C.cream], [ball(1, 10, 7).scale(0.4, 0.26, 0.3).translate(-0.3, 0.6, -0.25), C.hide],
    ]),
    // --- pots at a tomb's door
    potClay: P(pot(C.clay, C.turquoise)),
    potCream: P(pot(C.cream, C.wine)),
    potTurq: P(pot(C.turquoise, C.brass)),
    potBroken: P([
      [cyl(0.26, 0.2, 0.26, 12), C.clay], [ring(0.27, 0.03, 4, 14).rotateX(Math.PI / 2).translate(0, 0.24, 0), C.turquoise],
      [box(0.2, 0.025, 0.14, 0.45, 0.012, 0.1).rotateY(0.3), C.clay], [box(0.16, 0.025, 0.12, -0.4, 0.012, 0.3).rotateY(-0.5), C.clay], [box(0.14, 0.025, 0.18, 0.15, 0.012, 0.5), C.clay],
      [box(0.12, 0.025, 0.1, -0.2, 0.012, -0.42), C.turquoise], [cone(0.4, 0.12, 10).translate(0.3, 0, 0.35), C.grain],
    ]),
    // --- a fight's aftermath
    shield: P([[cyl(0.48, 0.48, 0.05, 16), C.wine], [cyl(0.34, 0.34, 0.06, 14), C.turquoise], [ball(0.1, 8, 6).scale(1, 0.6, 1).translate(0, 0.06, 0), C.brass], [ring(0.48, 0.028, 4, 26).rotateX(Math.PI / 2).translate(0, 0.04, 0), C.brass]]),
    sword: P([[box(0.06, 0.014, 0.85, 0, 0.02, 0.45), C.steel], [box(0.26, 0.03, 0.045, 0, 0.025, 0), C.brass], [box(0.04, 0.04, 0.18, 0, 0.025, -0.11), C.wood], [ball(0.036, 6, 4).translate(0, 0.03, -0.22), C.brass]]),
    helmet: P([[new THREE.SphereGeometry(0.2, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), C.iron], [ring(0.2, 0.025, 4, 16).rotateX(Math.PI / 2), C.brass], [box(0.03, 0.06, 0.32, 0, 0.21), C.wine]]),
    spearHalf: P([[rod(0.022, 0.022, 1.1, 6).rotateZ(Math.PI / 2).translate(0, 0.025, 0), C.wood], [cone(0.045, 0.24, 4).rotateZ(-Math.PI / 2).translate(0.55, 0.03, 0), C.steel], [rod(0.03, 0.03, 0.05, 6).rotateZ(Math.PI / 2).translate(0.53, 0.03, 0), C.brass]]),
    spearButt: P([[rod(0.022, 0.022, 0.9, 6).rotateZ(Math.PI / 2).translate(0, 0.025, 0), C.wood]]),
    // --- a shrine at a fork
    cairn: P([[cyl(0.5, 0.55, 0.16, 7), C.rockB], [cyl(0.38, 0.42, 0.14, 7).translate(0, 0.16, 0), C.sandstone], [cyl(0.24, 0.28, 0.12, 7).translate(0, 0.3, 0), C.rockA], [box(0.14, 0.02, 0.86, 0, 0.43), C.turquoise], [box(0.14, 0.02, 0.3, 0, 0, 0).rotateX(1.0).translate(0, 0.33, 0.5), C.turquoise]]),
    bowl: P([[cyl(0.13, 0.09, 0.07, 8), C.clay], [ball(0.05, 5, 3).translate(0.03, 0.08, 0), C.red], [ball(0.045, 5, 3).translate(-0.04, 0.08, 0.03), C.ochre], [ring(0.13, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0, 0.07, 0), C.brass]]),
    candles: P([[cyl(0.03, 0.03, 0.14, 6), C.ivory], [cyl(0.03, 0.03, 0.09, 6).translate(0.08, 0, 0.04), C.ivory], [cyl(0.03, 0.03, 0.11, 6).translate(-0.06, 0, 0.06), C.ivory], [cyl(0.005, 0.005, 0.03, 4).translate(0, 0.14, 0), C.lacquer]]),
    standard: P([[rod(0.03, 0.03, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 0.03, 0), C.wood], [cone(0.06, 0.2, 6).rotateZ(-Math.PI / 2).translate(1.3, 0.03, 0), C.brass], [box(1.1, 0.02, 0.8, 0.55, 0.012, 0.42), C.wine], [box(1.1, 0.022, 0.12, 0.55, 0.014, 0.72), C.brass], [box(0.4, 0.024, 0.4, 0.55, 0.016, 0.42).rotateY(Math.PI / 4), C.turquoise]]),
    rugSmall: P([[box(1.3, 0.012, 0.8, 0, 0.006), C.wine], [box(1.1, 0.012, 0.6, 0, 0.012), C.turquoise], [box(0.3, 0.012, 0.3, 0, 0.018).rotateY(Math.PI / 4), C.cream]]),
    plate: P([[cyl(0.17, 0.17, 0.015, 16).rotateX(-1.2).translate(0, 0.16, 0), C.brass]]),
    // --- a grave
    mound: P([[ball(1, 14, 8).scale(0.8, 0.26, 1.5), C.sandDark]]),
    stone: P([[new THREE.IcosahedronGeometry(0.14, 0).scale(1, 0.65, 1).translate(0, 0.05, 0), C.rockB]]),
    // --- the ribs of a great beast (past the edge): a vertebra (the spine along x), a rib arching over z, the skull
    vertebra: P([[rod(0.2, 0.2, 0.34, 8).rotateZ(Math.PI / 2), C.bone], [cone(0.07, 0.38, 6).translate(0, 0.15, 0), C.bone]]),
    rib: P([[ring(1, 0.075, 5, 16, Math.PI * 0.9).rotateY(Math.PI / 2), C.bone]]),
    skull: P([
      [ball(0.5, 12, 8).scale(1.7, 0.66, 0.8).translate(0, 0.25, 0), C.bone], [ball(0.1, 6, 4).translate(-0.2, 0.42, 0.3), C.lacquer], [ball(0.1, 6, 4).translate(-0.2, 0.42, -0.3), C.lacquer],
      [cone(0.13, 0.8, 8).rotateX(-1.0).translate(-0.4, 0.4, -0.3), C.bone], [cone(0.13, 0.8, 8).rotateX(1.0).translate(-0.4, 0.4, 0.3), C.bone],
      [box(0.7, 0.08, 0.5, 0.55, 0.06), C.bone],
    ]),
    // --- the refinement (2026-11-14, "continue more refine"): larger, low main pieces that read from the game's camera
    // the cart's bed broken off its wheels and lying flat (its length along x), the side boards fallen outward
    cartBed: P([
      [box(2.7, 0.14, 1.5, 0, 0.2), C.plank], [box(2.74, 0.05, 0.08, 0, 0.29, 0.72), C.brass], [box(2.74, 0.05, 0.08, 0, 0.29, -0.72), C.brass],
      [box(2.6, 0.06, 0.5, 0, 0.05, 1.05).rotateX(0.12), C.wood], [box(2.6, 0.06, 0.5, 0, 0.05, -1.05).rotateX(-0.12), C.wood],
      [box(0.5, 0.06, 1.4, -1.6, 0.05), C.wood], [box(2.4, 0.03, 0.06, 0, 0.28, 0.25), C.lacquer], [box(2.4, 0.03, 0.06, 0, 0.28, -0.25), C.lacquer],
      [rod(0.06, 0.06, 1.8, 6).rotateX(Math.PI / 2).translate(0.9, 0.08, 0), C.iron], [box(1.9, 0.1, 0.1, 2.3, 0.06, 0.1).rotateY(0.15), C.wood], [box(0.12, 0.08, 0.9, 3.2, 0.06, 0.25), C.wood],
    ]),
    // a striped awning torn down (3.2 x 2.4 m), its two colourways
    awningA: P([...[0, 1, 2, 3, 4, 5].map((k) => [box(3.2, 0.03, 0.4, 0, 0.015, -1.0 + k * 0.4), k % 2 ? C.cream : C.wine] as Part), [box(3.24, 0.034, 0.12, 0, 0.017, 1.24), C.turquoise], [box(3.24, 0.034, 0.05, 0, 0.018, -1.22), C.brass]]),
    awningB: P([...[0, 1, 2, 3, 4, 5].map((k) => [box(3.2, 0.03, 0.4, 0, 0.015, -1.0 + k * 0.4), k % 2 ? C.cream : C.turquoise] as Part), [box(3.24, 0.034, 0.12, 0, 0.017, 1.24), C.wine], [box(3.24, 0.034, 0.05, 0, 0.018, -1.22), C.brass]]),
    // a nomad's tent fallen flat: its striped cloth draped over the ridge pole (5.4 x 4.2 m, under knee height), the pole's ends out
    tentFlat: P([
      ...drape(5.4, 4.2, 6, (k) => (k === 0 || k === 5 ? C.turquoise : k % 2 ? C.cream : C.wine), (x, z) => 0.05 + 0.4 * Math.exp(-(z * z) / 0.55) * Math.max(0, 1 - (x / 2.75) ** 6) + 0.05 * Math.max(0, Math.sin(x * 2.3 + z * 0.8))),
      [rod(0.05, 0.05, 6.4, 6).rotateZ(Math.PI / 2).translate(0, 0.42, 0), C.wood], [rod(0.07, 0.07, 0.06, 6).rotateZ(Math.PI / 2).translate(3.2, 0.42, 0), C.brass], [rod(0.07, 0.07, 0.06, 6).rotateZ(Math.PI / 2).translate(-3.2, 0.42, 0), C.brass],
      [box(5.44, 0.02, 0.06, 0, 0.06, 2.08), C.brass], [box(5.44, 0.02, 0.06, 0, 0.06, -2.08), C.brass],
    ]),
    // the tent half standing against a rock: the back pole still up (-z, by the rock), the cloth sloping down to the sand in front
    tentHalf: P([
      ...drape(4.4, 4.4, 6, (k) => (k === 0 ? C.turquoise : k % 2 ? C.cream : C.wine), (x, z) => 0.05 + 1.55 * Math.max(0, Math.min(1, (0.3 - z) / 2.3)) ** 1.25 * (1 - 0.45 * (x / 2.2) ** 2)),
      [cyl(0.055, 0.06, 1.68, 6).translate(0, 0, -1.95), C.wood], [cyl(0.08, 0.08, 0.08, 6).translate(0, 1.66, -1.95), C.brass],
      [rod(0.045, 0.045, 4.6, 6).rotateZ(Math.PI / 2).translate(0, 1.58, -1.95), C.wood],
    ]),
    // an amphora buried to its shoulders (its top half shows) and one lying whole, one broken
    amphoraTop: P([
      [new THREE.SphereGeometry(0.27, 9, 4, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.35, 1), C.clay], [cyl(0.085, 0.11, 0.17, 8).translate(0, 0.32, 0), C.clay], [ring(0.095, 0.022, 3, 10).rotateX(Math.PI / 2).translate(0, 0.49, 0), C.brass],
      [ring(0.24, 0.024, 3, 12).rotateX(Math.PI / 2).translate(0, 0.17, 0), C.turquoise],
    ]),
    amphoraLying: P([
      [ball(0.26, 9, 5).scale(1.55, 1, 1).translate(0, 0.26, 0), C.clay], [cyl(0.08, 0.11, 0.24, 8).rotateZ(-Math.PI / 2).translate(0.5, 0.26, 0), C.clay], [ring(0.09, 0.022, 4, 10).rotateY(Math.PI / 2).translate(0.63, 0.26, 0), C.brass],
      [cone(0.07, 0.2, 6).rotateZ(Math.PI / 2).translate(-0.4, 0.26, 0), C.clay], [ring(0.235, 0.024, 4, 14).rotateY(Math.PI / 2).translate(0.15, 0.26, 0), C.turquoise],
    ]),
    // the water-wheel fallen flat on its side (R 1.6 m): two rims, twelve paddles between them, the spokes, a brass hub
    wheelBig: P(bigWheel(1.6)),
    // the water-wheel standing in its channel against a rock, its face to the camera (its axle along z, on two posts)
    wheelUp: P([
      ...bigWheel(1.6).map(([g, c]) => [g.translate(0, -0.25, 0).rotateX(Math.PI / 2).translate(0, 1.72, 0), c] as Part),
      [box(0.2, 1.8, 0.2, 0, 0.9, 0.55), C.wood], [box(0.2, 1.8, 0.2, 0, 0.9, -0.55), C.wood], [rod(0.07, 0.07, 1.4, 6).rotateX(Math.PI / 2).translate(0, 1.72, 0), C.iron],
    ]),
    kerb: P([[box(0.8, 0.22, 0.4, 0, 0.11), C.sandstone], [box(0.82, 0.04, 0.42, 0, 0.24), C.ivory], [box(0.82, 0.045, 0.08, 0, 0.245, 0.17), C.turquoise]]),
    trough: P([[box(1.7, 0.4, 0.66, 0, 0.2), C.sandstone], [box(1.5, 0.02, 0.46, 0, 0.405), C.pit], [box(1.72, 0.04, 0.68, 0, 0.42).translate(0, 0, 0), C.brass], [box(0.08, 0.36, 0.7, 0.35, 0.2).rotateZ(0.05), C.pitRim]]),
    // a column's drums lying in a row, its capital set down
    colDrum: P([[rod(0.27, 0.27, 0.8, 12).rotateZ(Math.PI / 2).translate(0, 0.27, 0), C.ivory], [rod(0.28, 0.28, 0.08, 12).rotateZ(Math.PI / 2).translate(0.36, 0.27, 0), C.turquoise]]),
    capital: P([[box(0.78, 0.2, 0.78, 0, 0.1), C.ivory], [cyl(0.3, 0.36, 0.26, 12).translate(0, 0.2, 0), C.ivory], [box(0.8, 0.04, 0.8, 0, 0.2), C.brass]]),
    // a chariot's car upside down (its wine-painted front), its shaft and yoke
    chariot: P([
      [box(1.15, 0.42, 0.9, 0, 0.21), C.plank], [box(0.03, 0.36, 0.86, 0.59, 0.21), C.wine], [box(1.19, 0.04, 0.94, 0, 0.02), C.brass], [box(1.19, 0.04, 0.94, 0, 0.42), C.lacquer],
      [rod(0.04, 0.04, 2.6, 6).rotateZ(Math.PI / 2).translate(1.9, 0.05, 0.1), C.wood], [box(0.1, 0.08, 1.1, 3.15, 0.05, 0.1), C.wood], [box(0.12, 0.09, 0.12, 3.15, 0.06, 0.6), C.brass], [box(0.12, 0.09, 0.12, 3.15, 0.06, -0.4), C.brass],
    ]),
    // a camel saddle set down: a frame under a wine cloth, two pommels capped in brass
    saddle: P([
      [box(0.9, 0.14, 0.62, 0, 0.07), C.wood], [box(1.0, 0.04, 0.9, 0, 0.16), C.wine], [box(1.02, 0.042, 0.12, 0, 0.165, 0.3), C.cream], [box(1.02, 0.042, 0.12, 0, 0.165, -0.3), C.cream],
      [cyl(0.05, 0.06, 0.32, 6).translate(0.36, 0.16, 0), C.wood], [cyl(0.05, 0.06, 0.32, 6).translate(-0.36, 0.16, 0), C.wood], [ball(0.07, 8, 5).translate(0.36, 0.48, 0), C.brass], [ball(0.07, 8, 5).translate(-0.36, 0.48, 0), C.brass],
    ]),
    rugRolled: P([[rod(0.16, 0.16, 1.4, 10).rotateZ(Math.PI / 2).translate(0, 0.16, 0), C.wine], [rod(0.165, 0.165, 0.12, 10).rotateZ(Math.PI / 2).translate(0.5, 0.16, 0), C.turquoise], [rod(0.165, 0.165, 0.12, 10).rotateZ(Math.PI / 2).translate(-0.5, 0.16, 0), C.turquoise], [rod(0.1, 0.1, 1.42, 8).rotateZ(Math.PI / 2).translate(0, 0.16, 0), C.cream]]),
    waterskin: P([[ball(1, 10, 6).scale(0.32, 0.15, 0.2).translate(0, 0.15, 0), C.hide], [cyl(0.04, 0.06, 0.16, 6).rotateZ(-Math.PI / 2).translate(0.38, 0.14, 0), C.hide], [cyl(0.045, 0.045, 0.03, 6).rotateZ(-Math.PI / 2).translate(0.47, 0.14, 0), C.brass]]),
    // a covered wagon sunk to its axles: the cream canvas on wooden hoops (its length along x)
    wagonCover: P([
      [new THREE.CylinderGeometry(0.72, 0.72, 2.3, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 1.0, 0), C.cream],
      ...[-1.05, -0.35, 0.35, 1.05].map((x) => [ring(0.74, 0.03, 4, 14, Math.PI).rotateY(Math.PI / 2).translate(x, 1.0, 0), C.plank] as Part),
      [box(2.32, 0.03, 0.05, 0, 1.73, 0), C.brass],
    ]),
    // a statue's broken base: its block and the jackal's forepaws on it
    jackalBase: P([[box(1.7, 0.36, 1.1, 0, 0.18), C.sandstone], [box(1.74, 0.06, 1.14, 0, 0.36), C.turquoise], [box(0.32, 0.14, 0.62, 0.4, 0.43, 0.1), C.lacquer], [box(0.32, 0.14, 0.62, -0.1, 0.43, 0.1), C.lacquer], [box(0.36, 0.03, 0.06, 0.4, 0.5, 0.42), C.brass], [box(0.36, 0.03, 0.06, -0.1, 0.5, 0.42), C.brass]]),
    // a tarp of finds laid out by a trench
    finds: P([
      [box(2.0, 0.02, 1.3, 0, 0.01), C.cream], [box(2.02, 0.024, 0.06, 0, 0.012, 0.62), C.wine], [box(2.02, 0.024, 0.06, 0, 0.012, -0.62), C.wine],
      ...[[-0.6, -0.3], [0, -0.3], [0.6, -0.3]].map(([x, z]) => [ball(0.13, 8, 6).scale(1, 1.2, 1).translate(x, 0.15, z), C.clay] as Part),
      ...[[-0.6, 0.3], [0.6, 0.3]].map(([x, z]) => [ball(0.12, 8, 6).scale(1, 1.1, 1).translate(x, 0.14, z), C.turquoise] as Part),
      [box(0.3, 0.03, 0.2, 0, 0.03, 0.3), C.brass], [cyl(0.1, 0.1, 0.03, 10).translate(0.3, 0.02, 0.35), C.brass],
    ]),
  };
}

type Pr = ReturnType<typeof makeProtos>;
type Op = { k: 's' | 'f'; p: Proto; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; tilt: number; roll: number };
/**
 * What a scene paints into the ground's canvas (no draw calls): `stain` a soft ellipse (`a` x `b` m, turned `rot`), `fan` a spill fanning
 * out from a point (`a` long, `b` its half-angle), `band` a dry channel (`a` long, `b` wide), `prints` footprints from the point `a` m
 * towards `rot`. Angles as the canvas reads them (atan2(z, x)) in the scene's frame. `c` is "r,g,b", `al` its strength.
 */
type Paint = { t: 'stain' | 'fan' | 'band' | 'prints'; x: number; z: number; a: number; b: number; rot: number; c: string; al: number };
/** The ground's colours: trampled sand, light dust, the spices, a dry channel's cracked earth. */
const G = { tramp: '112,80,54', dust: '196,166,124', drift: '204,176,134', red: '138,52,36', ochre: '176,124,52', grain: '206,190,148', turq: '31,138,134', crack: '104,76,54', dark: '84,60,44' } as const;
/** One scene in its own frame (+z towards the camera, -z the rock behind it): its parts, its footprint, its ground. */
class Recipe {
  ops: Op[] = [];
  items: { x: number; z: number; r: number; h: number }[] = [];
  paints: Paint[] = [];
  /** The main piece (the views probe counts a view when it is in frame). */
  main = { x: 0, z: 0 };
  /** What leads from the scene to the nearest road: wheel ruts, footprints, a drag mark, arrows stuck in the sand, a dropped load. */
  trail: 'ruts' | 'prints' | 'drag' | 'arrows' | 'load' | null = null;
  s(p: Proto, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) { this.ops.push({ k: 's', p, x, y, z, yaw, sx, sy, sz, tilt, roll }); return this; }
  f(p: Proto, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) { this.ops.push({ k: 'f', p, x, y, z, yaw, sx, sy, sz, tilt, roll }); return this; }
  /** A unit shape stretched from a to b (`w` thick). */
  beam(p: Proto, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h = w) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy);
    return this.s(p, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), w, h, len, -Math.atan2(dy, flat));
  }
  /** A pole from a to b (the unit pole is along y). */
  pole(p: Proto, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy);
    return this.s(p, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), r, len, r, Math.PI / 2 - Math.atan2(dy, flat));
  }
  item(x: number, z: number, r: number, h: number) { this.items.push({ x, z, r, h }); return this; }
  at(x: number, z: number) { this.main = { x, z }; return this; }
  paint(t: Paint['t'], x: number, z: number, a: number, b: number, rot: number, c: string, al: number) { this.paints.push({ t, x, z, a, b, rot, c, al }); return this; }
  get reach() { let m = 0; for (const it of this.items) m = Math.max(m, Math.hypot(it.x, it.z) + it.r); return m; }
}

/** The scene kinds. `backed`: a rock is right north of the scene (its tall part may stand); `far`: past the walkable edge. */
type Make = (rc: Recipe, P: Pr, r: () => number, o: { backed: boolean; far: boolean }) => void;
const SPICE: [keyof Pr, string][] = [['heapRed', G.red], ['heapOchre', G.ochre], ['heapGrain', G.grain], ['heapTurq', G.turq]];
const KINDS: Record<string, Make> = {
  // An ambushed caravan. The main piece: the cart's bed broken off its wheels and lying flat (or, against a rock, the cart on its side;
  // or, the second way, the awning torn down with the loads round it). Crates (one open, its cloth out), split sacks and their spice
  // fanned out on the sand in red, ochre and grain, a dropped lantern, arrows; the ground trampled, wheel ruts back to the road.
  caravan: (rc, P, r, o) => {
    const v = o.backed ? 2 : r() < 0.6 ? 0 : 1;
    if (v === 2) {
      rc.s(P.cartSide, 0, 0, 0, (r() - 0.5) * 0.2).item(0, 0, 1.4, 1.6).at(0, 0);
      rc.pole(P.poleWood, 1.25, 0.12, 0.05, 2.9, 0.05, 0.7, 0.05).pole(P.poleWood, 1.25, 0.45, 0.05, 2.7, 0.05, 1.3, 0.05).item(2.1, 0.75, 0.85, 0.45);
    } else if (v === 0) {
      rc.s(P.cartBed, 0, 0, 0, (r() - 0.5) * 0.3).item(-0.5, 0, 1.45, 0.36).item(1.0, 0, 1.0, 0.36).item(2.7, 0.2, 0.7, 0.12).at(0, 0);
      rc.s(P.wheelFlat, -0.6, 0.02, 2.0, r() * 3, 1, 1, 1, 0.06).item(-0.6, 2.0, 0.8, 0.22);
      rc.s(P.wheelFlat, 1.5, 0.12, -1.7, r() * 3, 1, 1, 1, 0.22).item(1.5, -1.7, 0.85, 0.45);
    }
    const z0 = v === 2 ? 2.0 : 0;
    const aw = r() < 0.5 ? P.awningA : P.awningB;
    if (v === 1) rc.f(aw, 0, 0.02, 0, 0.2 + r() * 0.3, 1.15, 1, 1.15, 0, 0.03).item(0, 0, 2.35, 0.06).at(0, 0);
    else rc.f(aw, -3.0, 0.02, z0 + 1.1, 0.4 + r() * 0.4, 1, 1, 1, 0, 0.04).item(-3.0, z0 + 1.1, 2.05, 0.06);
    rc.pole(P.poleWood, -4.4, 0.05, z0 - 0.5, -1.6, 0.05, z0 + 0.4, 0.045);
    const cx = v === 1 ? 0 : 0.4, cz = v === 1 ? 0 : z0;
    rc.s(P.crate, cx + 2.2, 0, cz - 0.6 + (v === 1 ? -1.6 : 0), r() * 2).item(cx + 2.2, cz - 0.6 + (v === 1 ? -1.6 : 0), 0.45, 0.52);
    if (r() < 0.8) rc.s(P.crate, cx + 2.75, 0.27, cz + 0.3 + (v === 1 ? -1.4 : 0), r() * 2, 0.9, 0.9, 0.9, Math.PI / 2).item(cx + 2.8, cz + 0.3 + (v === 1 ? -1.4 : 0), 0.45, 0.55);
    rc.s(P.crateOpen, cx + 0.9, 0, cz + 2.4, r() * 2).item(cx + 0.9, cz + 2.4, 0.45, 0.48);
    rc.s(P.lid, cx + 1.6, 0, cz + 3.1, r() * 3, 1, 1, 1, 0.08);
    if (r() < 0.6) rc.s(P.rugRolled, cx - 1.6, 0, cz - 1.8, r() * 0.6 - 0.3).item(cx - 1.6, cz - 1.8, 0.75, 0.32);
    for (let k = 0, n = 3 + Math.floor(r() * 2); k < n; k++) {
      const a = 0.6 + k * 1.25 + r() * 0.5, d = 3.0 + r() * 0.6, x = Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.85;
      const [hk, hc] = SPICE[(k + Math.floor(r() * 4)) % 4];
      rc.s(P[hk] as Proto, x + 0.3, 0, z + 0.1, 0, 0.9 + r() * 0.4, 1, 0.9 + r() * 0.4);
      rc.s(k % 2 ? P.sackHide : P.sack, x - 0.25, 0, z - 0.1, r() * 6).item(x, z, 0.8, 0.32);
      rc.paint('fan', x + 0.2, z, 1.6 + r() * 0.8, 0.5, Math.atan2(z - cz, x) + (r() - 0.5) * 0.6, hc, 0.55);
    }
    rc.s(P.lantern, -0.9, 0, cz + 2.6, r() * 6).item(-0.9, cz + 2.6, 0.3, 0.25);
    for (let k = 0, n = 4 + Math.floor(r() * 5); k < n; k++) rc.s(P.arrow, -1.5 + r() * 4, 0, cz - 0.4 + r() * 3.4, r() * 6, 1.05, 1.05, 1.05, 0.35 + r() * 0.3);
    rc.item(0.4, cz + 1.0, 3.2, 0.5); // the arrows and the loose things between
    rc.paint('stain', 0.3, cz + 0.4, 4.6, 3.4, r() * 0.6 - 0.3, G.tramp, 0.3);
    rc.trail = v === 1 ? 'prints' : 'ruts';
  },
  // A fight's aftermath. The skirmish: a great standard fallen (its banner the main piece), shields, swords and helmets dropped, spears
  // snapped, arrows standing in a spray. The second way: a chariot upside down, a wheel off, its shaft and yoke. Churned sand round it.
  fight: (rc, P, r) => {
    const v = r() < 0.6 ? 0 : 1;
    if (v === 0) {
      const sy = 0.3 + r() * 0.5, cs = Math.cos(sy), sn = Math.sin(sy), lx = (x: number, z: number) => -0.8 + x * cs + z * sn, lz = (x: number, z: number) => -x * sn + z * cs;
      rc.f(P.standard, -0.8, 0.02, 0, sy, 1.45).item(lx(1.95, 0), lz(1.95, 0), 0.35, 0.08).item(lx(-1.9, 0), lz(-1.9, 0), 0.35, 0.08).item(lx(0.8, 0.6), lz(0.8, 0.6), 1.0, 0.08).at(lx(0.8, 0.6), lz(0.8, 0.6));
      for (let k = 0; k < 3; k++) { const a = 1.2 + k * 1.9 + r() * 0.6, d = 2.0 + r() * 1.0, x = Math.cos(a) * d, z = 0.5 + Math.sin(a) * d; rc.s(P.shield, x, 0, z, r() * 6, 1.3, 1, 1.3, r() * 0.3).item(x, z, 0.7, 0.18); }
    } else {
      rc.s(P.chariot, 0, 0, 0, (r() - 0.5) * 0.4, 1.3, 1.25, 1.3).item(0, 0, 1.05, 0.55).item(2.2, 0.1, 1.0, 0.1).item(4.0, 0.1, 0.8, 0.12).at(0.5, 0);
      rc.s(P.wheelFlat, -1.6, 0.02, 1.8, r() * 3, 1.05, 1.05, 1.05, 0.06).item(-1.6, 1.8, 0.85, 0.22);
      rc.s(P.wheelFlat, 1.4, 0.05, -2.0, r() * 3, 1.05, 1.05, 1.05, 0.12).item(1.4, -2.0, 0.85, 0.28);
      rc.s(P.shield, -2.0, 0, -0.8, r() * 6, 1.3, 1, 1.3, 0.1).item(-2.0, -0.8, 0.7, 0.15);
      rc.paint('band', -2.6, 0.05, 4.6, 0.9, (r() - 0.5) * 0.3, G.tramp, 0.32); // its skid
    }
    rc.s(P.sword, 1.6, 0, 1.6, r() * 6, 1.3).item(1.6, 1.6, 0.6, 0.06);
    if (r() < 0.6) rc.s(P.sword, -2.6, 0, 1.4, r() * 6, 1.3).item(-2.6, 1.4, 0.6, 0.06);
    rc.s(P.helmet, -1.9, 0.17, 2.2, r() * 6, 1.25, 1.25, 1.25, 1.2).item(-1.9, 2.2, 0.36, 0.4);
    if (r() < 0.6) rc.s(P.helmet, 2.6, 0.17, -0.4, r() * 6, 1.25, 1.25, 1.25, 1.4).item(2.6, -0.4, 0.36, 0.4);
    const a = r() * 6;
    rc.s(P.spearHalf, 0.9, 0, -2.1, a).s(P.spearButt, -0.6, 0, -2.4, a + 0.5).item(0.2, -2.2, 1.1, 0.06);
    for (let k = 0, n = 9 + Math.floor(r() * 7); k < n; k++) {
      const x = -3.0 + r() * 6.0, z = -0.8 + r() * 3.8;
      rc.s(P.arrow, x, 0, z, 2.6 + (r() - 0.5) * 0.6, 1.05, 1.05, 1.05, 0.3 + r() * 0.35);
    }
    rc.item(0, 1.1, 3.3, 0.5);
    for (let k = 0; k < 3; k++) rc.paint('stain', -1.5 + k * 1.5 + r(), 0.4 + r() * 1.2, 2.2 + r(), 1.4 + r() * 0.6, r() * 3, G.tramp, 0.26);
    rc.paint('prints', -2.5, 2.2, 3.5, 0, 2.3 + r() * 0.6, G.dark, 0.35).paint('prints', 2.2, -0.6, 3.0, 0, -0.4 + r() * 0.6, G.dark, 0.35);
    rc.trail = 'arrows';
  },
  // An abandoned dig. A pit (4 x 3 m) with its pegged rope, the spoil heap with a sieve on it, baskets (one tipped), a ladder, a tool,
  // sherds; or a long trench with the finds laid out on a cloth beside it. The spoil's lighter sand fans out from the pit.
  dig: (rc, P, r) => {
    const v = r() < 0.55 ? 0 : 1;
    if (v === 0) {
      rc.f(P.pit, 0, 0, 0, (r() - 0.5) * 0.3, 1.4, 1, 1.4).item(0, 0, 3.05, 0.42).at(0, 0);
      const pegs = [[-2.4, -1.85], [2.4, -1.85], [2.4, 1.85], [-2.4, 1.85]];
      for (const [x, z] of pegs) rc.s(P.peg, x, 0, z);
      for (let k = 0; k < 4; k++) { if (k === 2 && r() < 0.5) continue; const [ax, az] = pegs[k], [bx, bz] = pegs[(k + 1) % 4]; rc.beam(P.unitRope, ax, 0.33, az, bx, 0.33, bz, 0.025); }
      rc.s(P.drift, 3.8, -0.05, -0.5, r(), 1.4, 0.44, 1.1).item(3.8, -0.5, 1.4, 0.4);
      rc.s(P.sieve, 3.6, 0.22, -0.3, 0.4, 1, 1, 1, -0.45).item(3.6, -0.3, 0.55, 0.5);
      rc.s(P.ladder, 0.4, 0, 2.9, Math.PI / 2 + (r() - 0.5) * 0.3).item(0.4, 2.9, 1.3, 0.1);
      rc.paint('fan', 2.6, -0.4, 3.0, 0.7, 0, G.dust, 0.5);
    } else {
      rc.f(P.pit, 0, 0, 0, (r() - 0.5) * 0.2, 2.0, 1, 0.75).item(-1.8, 0, 1.6, 0.42).item(0, 0, 1.6, 0.42).item(1.8, 0, 1.6, 0.42).item(-3.2, 0, 1.2, 0.42).item(3.2, 0, 1.2, 0.42).at(0, 0);
      for (const [x, z] of [[-3.2, -1.1], [3.2, -1.1], [3.2, 1.1], [-3.2, 1.1]]) rc.s(P.peg, x, 0, z);
      rc.f(P.finds, 0.6, 0.01, 2.5, (r() - 0.5) * 0.3).item(0.6, 2.5, 1.2, 0.3);
      rc.s(P.amphoraLying, -2.0, 0, 2.4, r() * 6).item(-2.0, 2.4, 0.6, 0.52);
      rc.s(P.drift, 0.5, -0.06, -2.4, 0, 3.0, 0.4, 0.9).item(-1.2, -2.4, 0.9, 0.36).item(1.2, -2.4, 0.9, 0.36);
      rc.paint('stain', 0, -2.4, 4.2, 1.5, 0, G.dust, 0.45);
    }
    rc.s(P.basket, -3.3, 0, 0.8).item(-3.3, 0.8, 0.3, 0.36);
    rc.s(P.basketLying, -3.1, 0, -0.8 + r() * 0.3, r() * 6).item(-2.9, -0.8, 0.6, 0.3);
    rc.s(r() < 0.5 ? P.shovel : P.pick, -1.4, 0, v === 0 ? -2.6 : 1.6, 1.2 + r()).item(-1.4, v === 0 ? -2.6 : 1.6, 0.7, 0.08);
    rc.f(P.sherds, -0.5 + r(), 0.02, 0.2 - r() * 0.5, r() * 6);
    rc.paint('stain', 0, 0, 4.4, 3.4, 0, G.tramp, 0.22);
    rc.trail = 'prints';
  },
  // A dry well, its windlass fallen: a ring of dressed blocks (two gone, lying by it), the dark hole, the posts and the drum on the sand,
  // the bucket on its side, a stone trough cracked; or the waiting place, jars and water-skins left round the ring. A pale dry ring.
  well: (rc, P, r) => {
    const v = r() < 0.55 ? 0 : 1, R = 1.25;
    const gap = Math.floor(r() * 9);
    for (let k = 0; k < 9; k++) {
      if (k === gap || (v === 0 && k === (gap + 1) % 9)) continue;
      const a = (k / 9) * Math.PI * 2;
      rc.s(P.block, Math.sin(a) * R, 0, Math.cos(a) * R, a, 1.2, 1.1, 1.2);
    }
    rc.item(0, 0, 1.7, 0.55).at(0, 0);
    rc.f(P.hole, 0, 0.01, 0, 0, 1.3, 1, 1.3);
    const ga = ((gap + 0.5) / 9) * Math.PI * 2, side = r() < 0.5 ? 1 : -1;
    if (v === 0) {
      rc.s(P.block, Math.sin(ga) * 2.3, 0, Math.cos(ga) * 2.3, ga + 0.6, 1.0, 1.0, 1.0, 0.12, 0.08).item(Math.sin(ga) * 2.3, Math.cos(ga) * 2.3, 0.5, 0.52);
      rc.s(P.postLying, side * 2.2, 0, -0.4, 0.2 * side, 1.2).item(side * 2.2, -0.4, 1.05, 0.17);
      rc.s(P.postLying, side * 2.9, 0, 0.8, -0.5 * side, 1.2).item(side * 2.9, 0.8, 1.05, 0.17);
      rc.s(P.drum, side * 1.8, 0, 2.2, 0.4 * side).item(side * 1.8, 2.2, 0.75, 0.4);
      rc.beam(P.unitRope, side * 1.3, 0.15, 2.1, 0.3 * side, 0.03, 0.6, 0.03);
      rc.s(P.bucketLying, -side * 2.0, 0, 1.4, r() * 6).item(-side * 2.0, 1.4, 0.4, 0.4);
      rc.s(P.trough, -side * 2.8, 0, -0.9, Math.PI / 2 + (r() - 0.5) * 0.4).item(-side * 2.8, -0.9, 0.95, 0.46);
    } else {
      for (let k = 0; k < 4; k++) { const a = ga + 0.6 + k * 1.3, d = 2.4 + r() * 0.5; rc.s(k % 2 ? P.jarLying : P.potClay, Math.sin(a) * d, 0, Math.cos(a) * d, r() * 6, k % 2 ? 0.88 : 0.56).item(Math.sin(a) * d, Math.cos(a) * d, 0.45, 0.54); }
      for (let k = 0; k < 3; k++) { const a = ga - 0.9 - k * 0.7, d = 2.6; rc.s(P.waterskin, Math.sin(a) * d, 0, Math.cos(a) * d, r() * 6).item(Math.sin(a) * d, Math.cos(a) * d, 0.45, 0.3); }
      rc.f(P.rugSmall, side * 0.4, 0.004, 2.7, 0.2, 1.2).item(side * 0.4, 2.7, 0.8, 0.03);
    }
    rc.paint('stain', 0, 0, 2.6, 2.6, 0, G.dust, 0.45).paint('stain', 0.2, 0.6, 4.0, 3.2, r(), G.tramp, 0.22);
    rc.trail = 'prints';
  },
  // A travellers' rest: a great rug (3 x 2 m) with its brass tea tray, cushions, a cold fire ring and its kettle, a pack and a staff, a
  // camel saddle; or the second way, two saddles set down by rolled rugs and water-skins. Against a rock, a lean-to over it.
  rest: (rc, P, r, o) => {
    const z0 = o.backed ? 1.0 : 0, v = o.backed ? 0 : r() < 0.55 ? 0 : 1;
    if (o.backed) rc.s(P.leanTo, 0, 0, 0).item(0.65, 0.35, 0.9, 1.85).item(-0.65, 0.35, 0.9, 1.85);
    if (v === 0) {
      rc.f(P.rug, 0, 0, z0, (r() - 0.5) * 0.3, 1.3).item(-0.7, z0, 1.35, 0.05).item(0.7, z0, 1.35, 0.05).at(0, z0);
      rc.s(P.teaTray, 0.15, 0.035, z0 + 0.1, r() * 6, 1.2);
      rc.s(P.cushionWine, -1.0, 0.03, z0 - 0.45, 0.3, 1.2).s(P.cushionTurq, 1.05, 0.03, z0 - 0.5, -0.2, 1.2);
      if (r() < 0.7) rc.s(r() < 0.5 ? P.cushionWine : P.cushionTurq, -0.8, 0.03, z0 + 0.7, 1.2, 1.2);
      if (!o.backed) rc.s(P.saddle, 2.6, 0, z0 - 0.6, 1.2 + r() * 0.4).item(2.6, z0 - 0.6, 0.65, 0.55);
    } else {
      rc.s(P.saddle, -0.7, 0, 0, 0.3 + r() * 0.3).item(-0.7, 0, 0.65, 0.55).at(0, 0.3);
      rc.s(P.saddle, 0.9, 0, -0.3, -0.4 + r() * 0.3).item(0.9, -0.3, 0.65, 0.55);
      rc.s(P.rugRolled, -0.1, 0, 1.2, (r() - 0.5) * 0.4).item(-0.1, 1.2, 0.75, 0.32);
      rc.f(P.rugSmall, 0.3, 0.004, -1.5, r() * 0.4, 1.5).item(0.3, -1.5, 1.05, 0.03);
      rc.s(P.waterskin, -2.0, 0, -1.0, r() * 6).s(P.waterskin, -2.3, 0, -0.5, r() * 6).item(-2.15, -0.75, 0.55, 0.3);
    }
    rc.s(P.fireRing, 2.4, 0, z0 + 1.6, 0, 1.2).item(2.4, z0 + 1.6, 0.7, 0.12);
    rc.s(P.kettle, 2.25, 0.08, z0 + 1.5, r() * 6, 1.2);
    rc.s(P.pack, -2.1, 0, z0 + 1.2, 0.5 + r()).item(-2.1, z0 + 1.2, 0.4, 0.38);
    if (r() < 0.6) rc.s(P.staff, 0.2, 0, z0 + 2.0, r() * 0.6 - 0.3).item(0.2, z0 + 2.0, 0.95, 0.06);
    rc.paint('stain', 2.4, z0 + 1.6, 1.6, 1.6, 0, G.dark, 0.3).paint('stain', 0.3, z0 + 0.6, 3.8, 2.8, r() * 0.4, G.tramp, 0.24);
    rc.trail = 'prints';
  },
  // A sundial on its plinth and the obelisk beside it broken (the stump, two lengths of shaft, the gilt cap); or a column fallen in its
  // drums, a row along the sand, its capital set down. Stone chips and a fan of pale dust.
  sundial: (rc, P, r) => {
    const v = r() < 0.5 ? 0 : 1, s = r() < 0.5 ? 1 : -1;
    if (v === 0) {
      rc.s(P.dial, 0, 0, 0, r() * 6, 1.25, 0.85, 1.25).item(0, 0, 1.05, 0.55);
      rc.s(P.stump, s * 2.8, 0, -0.8, r(), 1.15, 0.9, 1.15).item(s * 2.8, -0.8, 0.62, 0.55);
      rc.s(P.shaft, s * 3.1, 0, 1.3, Math.PI / 2 + 0.25 * s, 1.1, 1.1, 1.3, 0, 0.04).item(s * 2.4, 1.2, 0.7, 0.53).item(s * 3.8, 1.5, 0.7, 0.53).at(s * 3.1, 1.3);
      rc.s(P.shaftShort, s * 1.3, 0, 2.6, 0.9 * s, 1.1).item(s * 1.3, 2.6, 0.75, 0.52);
      rc.s(P.pyramidion, -s * 0.9, 0, 3.0, Math.PI + 0.5 * s, 1.1).item(-s * 0.9, 3.0, 0.68, 0.44);
      rc.paint('fan', s * 2.8, -0.6, 3.6, 0.6, s > 0 ? Math.PI / 2 : Math.PI / 2, G.dust, 0.42);
    } else {
      const n = 4 + Math.floor(r() * 2);
      rc.s(P.stump, -s * 2.4, 0, -0.2, r() * 0.3, 1.1, 0.9, 1.1).item(-s * 2.4, -0.2, 0.6, 0.55);
      for (let k = 0; k < n; k++) { const x = -s * 1.2 + s * k * 0.95, z = (r() - 0.5) * 0.3 + k * 0.12; rc.s(P.colDrum, x, 0, z, (r() - 0.5) * 0.3 + (s < 0 ? Math.PI : 0)).item(x, z, 0.5, 0.54); }
      rc.at(s * (n * 0.95) * 0.3, 0.2);
      rc.s(P.capital, s * (n * 0.95 - 0.4), 0, 1.0 + r() * 0.4, r()).item(s * (n * 0.95 - 0.4), 1.2, 0.55, 0.5);
      rc.paint('band', s * 0.6, 0.2, n + 1.5, 1.6, 0, G.dust, 0.32);
    }
    for (let k = 0; k < 5; k++) rc.s(P.chunk, s * (0.6 + r() * 2.6), 0, -0.4 + r() * 2.8, r() * 6, 0.6 + r() * 0.7);
    rc.item(s * 1.8, 1.1, 1.6, 0.2);
    rc.trail = r() < 0.5 ? 'prints' : null;
  },
  // A shrine at a fork: a cairn under a turquoise cloth, a ring of offering bowls, candle stubs, a brass plate; or a flat altar stone
  // with its cloth and bowls. The sand round it swept and trodden.
  shrine: (rc, P, r) => {
    if (r() < 0.6) rc.s(P.cairn, 0, 0, 0, r() * 6, 1.5, 1.2, 1.5).item(0, 0, 0.85, 0.55).at(0, 0);
    else rc.s(P.trough, 0, 0, 0, r() * 0.4 - 0.2, 1.0, 0.7, 1.1).f(P.rugSmall, 0, 0.29, 0, 0, 1.0, 1, 0.6).item(0, 0, 0.95, 0.32).at(0, 0);
    for (let k = 0, n = 5 + Math.floor(r() * 3); k < n; k++) { const a = Math.PI * (0.05 + 0.9 * (k / (n - 1))); rc.s(P.bowl, Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35, r() * 6, 1.4); }
    rc.f(P.rugSmall, 0, 0.005, 1.3, 0, 1.4);
    rc.s(P.candles, 0.6, 0, 0.6).s(P.candles, -0.65, 0, 0.5, 1).s(P.candles, 0.1, 0, -0.95, 2);
    rc.s(P.plate, 0, 0, 0.75, 0, 1.4);
    rc.item(0, 0.9, 1.6, 0.2);
    rc.paint('stain', 0, 0.4, 2.6, 2.4, 0, G.dust, 0.4);
  },
  // A grave: a long mound ringed with stones, a helmet laid on it, a sword across it, a small cairn at its head; or three side by side.
  grave: (rc, P, r) => {
    const n = r() < 0.5 ? 1 : 3;
    for (let g = 0; g < n; g++) {
      const gx = (g - (n - 1) / 2) * 2.2;
      rc.s(P.mound, gx, 0, 0, 0, 1.1).item(gx, 0, 1.95, 0.29);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; rc.s(P.stone, gx + Math.cos(a) * 1.05, 0, Math.sin(a) * 1.85, r() * 6, 0.8 + r() * 0.5); }
      rc.s(P.cairn, gx, 0, -2.2, r() * 6, 0.55, 0.7, 0.55).item(gx, -2.2, 0.4, 0.33);
      if (g === Math.floor(n / 2) || r() < 0.4) rc.s(P.helmet, gx, 0.22, -0.5, r() * 0.5, 1, 1, 1, 0.12);
      if (g === Math.floor(n / 2)) rc.s(P.sword, gx - 0.05, 0.2, 0.55, Math.PI / 2 + (r() - 0.5) * 0.4, 1, 1, 1, 0, 0.08);
    }
    rc.at(0, 0);
    rc.paint('stain', 0, 0, 1.6 + n * 1.1, 2.6, 0, G.dark, 0.26);
    rc.trail = 'prints';
  },
  // A jackal's head in black stone fallen from its statue, lying on its cheek half buried in a drift: gold bands of its headdress, gold
  // in its eye and ear, a turquoise collar at the broken neck; a paw further off, or the statue's base with its forepaws.
  jackal: (rc, P, r, o) => {
    const s = o.far ? 1.8 + r() * 0.3 : 1.45;
    const yaw = (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.6;
    rc.s(P.drift, -Math.cos(yaw) * 0.6 * s, -0.12, 0.3, yaw, (o.far ? 2.4 : 1.7) * s, 0.4 * s, (o.far ? 1.7 : 1.25) * s);
    rc.s(P.jackal, 0, -0.1 * s, 0, yaw, s, s, s, 0, 0.1).item(0, 0, (o.far ? 1.75 : 1.7) * s, 0.95 * s).at(0, 0);
    if (o.far) rc.s(P.paw, 2.6 * s, -0.05, 1.2 * s, 0.4, s).item(2.6 * s, 1.2 * s, 0.6 * s, 0.4 * s);
    else if (r() < 0.5) rc.s(P.paw, 3.0, -0.06, 1.4, 0.4 + r() * 0.4, 1.3).item(3.0, 1.4, 0.7, 0.36);
    else rc.s(P.jackalBase, -2.9, -0.05, 1.8, 0.3 + r() * 0.4).item(-2.9, 1.8, 1.0, 0.52);
    if (!o.far) rc.paint('stain', 0, 0.5, 3.4, 2.6, 0, G.drift, 0.5).paint('fan', 0, 1.0, 3.8, 0.5, Math.PI / 2, G.drift, 0.35);
    for (let k = 0; k < 4; k++) rc.s(P.chunk, (r() - 0.5) * 5, 0, 1.5 + r() * 1.5, r() * 6, 0.5 + r() * 0.6);
  },
  // A wagon sunk to its axles in a drift: its cream canvas on its hoops (or open, its sacks spilling into the sand), its tongue up.
  wagon: (rc, P, r, o) => {
    const s = o.far ? 1.35 : 1.15, yaw = (r() - 0.5) * 0.3, cover = r() < 0.65;
    rc.s(P.wagon, 0, -0.22, 0, yaw, s, s, s, 0.06, 0.08).item(0, 0, 1.7 * s, 1.05 * s).at(0, 0);
    if (cover) rc.s(P.wagonCover, 0, -0.22, 0, yaw, s, s, s, 0.06, 0.08).item(0, 0, 1.7 * s, 1.75 * s);
    else { rc.s(P.sack, 1.6 * s, 0, 1.3, r() * 6).s(P.sackHide, 0.6, 0, 1.6, r() * 6).item(1.1 * s, 1.45, 0.8, 0.32); rc.s(P.heapGrain, 1.3 * s, 0, 1.9, 0, 1.2).paint('fan', 1.2, 1.4, 2.4, 0.6, Math.PI / 2, G.grain, 0.5); }
    if (o.far) rc.s(P.drift, 0.4, -0.15, -0.6, 0.3, 2.4 * s, 0.7 * s, 1.3 * s);
    else rc.s(P.drift, -0.7, -0.15, -0.5, 0.3, 1.35 * s, 0.6 * s, 1.1 * s).s(P.drift, 1.0, -0.15, -0.6, 0.2, 1.35 * s, 0.6 * s, 1.1 * s); // two drifts: one wide one reached into the rock
    rc.s(P.drift, 1.6 * s, -0.1, 0.4, 0.3, 1.2 * s, 0.45 * s, 1.1 * s).item(1.6 * s, 0.4, 1.1 * s, 0.45 * s);
    if (o.far) rc.pole(P.poleWood, -1.3 * s, 0.35, 0.1, -2.8 * s, 1.2 * s, 0.4, 0.06).item(-2.2 * s, 0.3, 0.5, 1.2 * s);
    else rc.pole(P.poleWood, -1.3, 0.35, 0.1, -2.9, 0.08, 0.5, 0.06).item(-2.2, 0.3, 0.75, 0.4);
    if (!o.far) { rc.s(P.sack, -0.6, 0, 1.6, r() * 6).item(-0.6, 1.6, 0.5, 0.3); rc.paint('stain', 0.3, 0.4, 3.6, 2.6, 0, G.drift, 0.5); }
    rc.trail = 'ruts';
  },
  // Pots stacked at a tomb's door, one smashed and its grain spilled (smaller than the cover's jars, so no one takes them for cover).
  pots: (rc, P, r) => {
    const kinds = [P.potClay, P.potCream, P.potTurq];
    // stacked by the door; or the second way, set in a row along the rock with gaps where two were smashed
    const row = r() < 0.4;
    const at: [number, number, number][] = row ? [[-1.4, 0, -0.1], [-0.7, 0, -0.12], [0.7, 0, -0.1], [1.4, 0, -0.14]] : [[-0.5, 0, -0.1], [0, 0, -0.15], [0.5, 0, -0.1], [-0.25, 0.53, -0.12], [0.25, 0.53, -0.12]];
    if (!row && r() < 0.6) at.push([0, 1.06, -0.12]);
    if (row) rc.s(P.potBroken, 0, 0, 0.1, r() * 6, 0.8).item(0, 0.1, 0.65, 0.24);
    at.forEach(([x, y, z], k) => rc.s(kinds[(k + Math.floor(r() * 3)) % 3], x, y, z, r() * 6, 0.68 + r() * 0.06));
    if (row) rc.item(-1.05, -0.1, 0.8, 0.7).item(1.05, -0.1, 0.8, 0.7).at(0, 0);
    else rc.item(0, -0.1, 0.9, at.length > 5 ? 1.75 : 1.25).at(0, 0);
    rc.s(P.potBroken, 1.1, 0, 0.6, r() * 6, 0.8).item(1.15, 0.65, 0.65, 0.24);
    rc.s(kinds[Math.floor(r() * 3)], -1.15, 0.22, 0.5, r() * 6, 0.68, 0.68, 0.68, Math.PI / 2).item(-1.15, 0.5, 0.5, 0.45);
    if (r() < 0.6) rc.s(P.amphoraLying, -0.4, 0, 1.5, r() * 6, 0.9).item(-0.4, 1.5, 0.55, 0.47);
    rc.paint('fan', 1.1, 0.6, 2.0, 0.6, Math.PI / 2 - 0.4, G.grain, 0.5).paint('stain', 0, 0.6, 2.2, 1.6, 0, G.tramp, 0.22);
  },
  // The bleached ribs of a great beast arching from the sand, its spine and its horned skull (past the edge only).
  ribs: (rc, P, r) => {
    const n = 7, len = 7.5, g = 1.4; // a great beast, seen from far: everything 1.4 times
    const s0 = rc.ops.length;
    for (let k = 0; k < n + 2; k++) rc.s(P.vertebra, -len / 2 + (k * len) / (n + 1), -0.05, Math.sin(k * 0.5) * 0.25, 0, 1.2 - Math.abs(k - n / 2) * 0.05);
    for (let k = 0; k < n; k++) {
      const x = -len / 2 + ((k + 1) * len) / (n + 1), R = 2.3 - Math.abs(k - (n - 1) / 2) * 0.22, broken = k === 1 + Math.floor(r() * (n - 2));
      if (broken) rc.s(P.rib, x + 0.6, 0.05, 1.4, 0.4, R * 0.8, R * 0.8, R * 0.8, Math.PI / 2 - 0.1);
      else rc.s(P.rib, x, -0.25, Math.sin(k * 0.5) * 0.25, 0.08 * (k - n / 2), R, R * 1.1, R, -0.2);
    }
    rc.s(P.skull, len / 2 + 1.2, -0.1, 0.3, -0.3 + r() * 0.3, 1.3);
    rc.s(P.drift, -1, -0.2, 0.8, r(), 4.2, 0.45, 2.2);
    for (let k = s0; k < rc.ops.length; k++) { const op = rc.ops[k]; op.x *= g; op.y *= g; op.z *= g; op.sx *= g; op.sy *= g; op.sz *= g; }
    rc.item(0, 0, 5.5 * g, 2.6 * g).at(0, 0);
  },
  // A nomad camp's tent fallen: its striped cloth (5.4 x 4.2 m) draped flat over the ridge pole, guy ropes slack to their pegs, a rug's
  // corner out from under it, a brass lamp, a pot rolled away. Against a rock, the tent half standing, its back pole still up.
  tent: (rc, P, r, o) => {
    if (o.backed) {
      rc.s(P.tentHalf, 0, 0, 0, (r() - 0.5) * 0.15).item(0, -1.3, 1.0, 1.75).item(-1.5, -0.9, 0.7, 1.2).item(1.5, -0.9, 0.7, 1.2).item(-1.3, -1.75, 0.75, 1.55).item(1.3, -1.75, 0.75, 1.55).item(-2.05, -1.9, 0.45, 1.65).item(2.05, -1.9, 0.45, 1.65).item(0, 1.9, 0.85, 0.3).item(-2.0, -0.6, 0.7, 0.95).item(2.0, -0.6, 0.7, 0.95).item(-2.0, 0.6, 0.7, 0.4).item(2.0, 0.6, 0.7, 0.4).item(-1.9, 1.7, 0.6, 0.2).item(1.9, 1.7, 0.6, 0.2).item(-2.05, -1.35, 0.5, 1.2).item(2.05, -1.35, 0.5, 1.2).item(-0.65, -2.0, 0.55, 1.78).item(0.65, -2.0, 0.55, 1.78).item(0, -0.2, 1.05, 0.7).item(-1.2, -0.3, 0.6, 0.85).item(1.2, -0.3, 0.6, 0.85).item(-1.3, 1.2, 1.4, 0.4).item(1.3, 1.2, 1.4, 0.4).at(0, 0);
    } else {
      rc.s(P.tentFlat, 0, 0, 0, (r() - 0.5) * 0.2).item(-1.35, -1.05, 1.75, 0.5).item(1.35, -1.05, 1.75, 0.5).item(-1.35, 1.05, 1.75, 0.5).item(1.35, 1.05, 1.75, 0.5).item(3.15, 0, 0.3, 0.45).item(-3.15, 0, 0.3, 0.45).at(0, 0);
      const side = r() < 0.5 ? 1 : -1;
      for (const [px, pz] of [[3.9, 1.7], [3.9, -1.7], [-3.9, 1.7], [-3.9, -1.7]]) { rc.s(P.peg, px, 0, pz); rc.beam(P.unitRope, Math.sign(px) * 2.7, 0.08, pz * 0.9, px, 0.32, pz, 0.02); }
      rc.item(3.9, 1.7, 0.2, 0.4).item(3.9, -1.7, 0.2, 0.4).item(-3.9, 1.7, 0.2, 0.4).item(-3.9, -1.7, 0.2, 0.4);
      rc.pole(P.poleWood, -2.0 * side, 0.05, 2.6, 1.6 * side, 0.05, 3.0, 0.05).item(-0.2 * side, 2.8, 1.8, 0.1);
      rc.f(P.rugSmall, 2.3 * side, 0.006, 2.4, 0.4, 1.2).item(2.3 * side, 2.4, 0.8, 0.03);
    }
    rc.s(P.lantern, -2.6, 0, 3.0, r() * 6).item(-2.6, 3.0, 0.3, 0.25);
    rc.s(P.potBroken, 1.0, 0, 3.3, r() * 6, 0.7).item(1.0, 3.3, 0.55, 0.22);
    rc.s(P.pack, 3.4, 0, 3.0, r() * 6).item(3.4, 3.0, 0.4, 0.38);
    rc.paint('stain', 0, 0.6, 5.0, 3.8, 0, G.tramp, 0.26);
    rc.trail = 'drag';
  },
  // A line of amphorae half buried in the sand, the cargo of a caravan that never came back for it (one lying, one broken, the crate
  // they came in split); or a heap of them by the split crate. Light sand drifted against each.
  amphorae: (rc, P, r) => {
    const v = r() < 0.6 ? 0 : 1;
    const n = v === 0 ? 8 + Math.floor(r() * 3) : 6;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) pts.push(v === 0 ? [-((n - 1) * 0.9) / 2 + k * 0.9, Math.sin(k * 0.7) * 0.4] : [Math.cos(k * 1.05) * 1.1, Math.sin(k * 1.05) * 1.1]);
    pts.forEach(([x, z], k) => {
      if (k === 2) rc.s(P.potBroken, x, 0, z, r() * 6, 0.85);
      else if (k % 4 === 3) rc.s(P.amphoraLying, x, 0, z + 0.4, (r() - 0.5) * 0.8 + Math.PI / 2, 1.05);
      else rc.s(P.amphoraTop, x, -0.08, z, r() * 6, 1.18, 1.18, 1.18, (r() - 0.5) * 0.4, (r() - 0.5) * 0.3);
      rc.item(x, z + (k % 4 === 3 ? 0.4 : 0), 0.48, 0.55);
      rc.paint('stain', x - 0.05, z + 0.12, 0.55, 0.45, 0, G.drift, 0.55);
    });
    rc.at(0, 0);
    const ex = v === 0 ? ((n - 1) * 0.9) / 2 + 1.2 : 2.1;
    rc.s(P.crateOpen, ex, 0, 0.6, r() * 2).item(ex, 0.6, 0.45, 0.48);
    rc.s(P.lid, ex + 0.5, 0, 1.4, r() * 3, 1, 1, 1, 0.08);
    rc.s(P.heapGrain, ex - 0.2, 0, 1.3, 0, 0.8).item(ex - 0.2, 1.3, 0.5, 0.22);
    rc.paint(v === 0 ? 'band' : 'stain', 0, 0.15, v === 0 ? n * 0.9 + 1.6 : 2.8, v === 0 ? 1.5 : 2.4, 0, G.drift, 0.42);
    rc.trail = 'ruts';
  },
  // A water-wheel fallen at a dry channel: the channel's cracked bed between low stone kerbs (some gone, one in the channel), the wheel
  // (3.2 m across) lying on its side by it, its axle beam, a cracked trough. Against a rock, the wheel still upright at the channel's head.
  waterwheel: (rc, P, r, o) => {
    if (o.backed) {
      rc.s(P.wheelUp, 0, 0, 0, (r() - 0.5) * 0.1).item(0, 0, 0.8, 3.3).item(-1.0, 0, 0.8, 3.3).item(1.0, 0, 0.8, 3.3).at(0, 0);
      rc.paint('band', 0, 4.2, 8.0, 1.5, Math.PI / 2, G.crack, 0.55);
      for (let k = 0; k < 5; k++) { const z = 1.6 + k * 1.5; if (r() < 0.2) continue; rc.s(P.kerb, -1.0, 0, z, Math.PI / 2).s(P.kerb, 1.0, 0, z + 0.4, Math.PI / 2); }
      for (let z = 1.6; z <= 8; z += 1.6) rc.item(0, z, 1.2, 0.26);
      rc.s(P.bucketLying, 1.8, 0, 2.4, r() * 6).item(1.8, 2.4, 0.4, 0.4);
    } else {
      rc.paint('band', 0, -2.3, 12, 1.6, 0, G.crack, 0.55);
      for (let k = 0; k < 8; k++) {
        const x = -5.2 + k * 1.5;
        if (r() < 0.25) continue;
        rc.s(P.kerb, x, 0, -3.35, 0).s(P.kerb, x + 0.5, 0, -1.25, 0);
      }
      for (let x = -5.5; x <= 5.5; x += 1.6) rc.item(x, -2.3, 1.25, 0.26);
      rc.s(P.kerb, 1.4, -0.05, -2.2, 0.9, 1, 1, 1, 0.3);
      rc.s(P.wheelBig, 0.4, -0.03, 0.9, r() * 6, 1, 1, 1, 0.03).item(0.4, 0.9, 1.7, 0.5).at(0.4, 0.9);
      rc.s(P.postLying, -2.6, 0, 1.2, 1.2 + r() * 0.4, 1.5, 1.5, 1.5).item(-2.6, 1.2, 1.3, 0.22);
      rc.s(P.trough, 3.4, 0, 1.6, (r() - 0.5) * 0.5).item(3.4, 1.6, 0.95, 0.46);
      rc.paint('stain', 0.4, 0.9, 3.0, 2.6, 0, G.tramp, 0.22);
    }
  },
};

/** Single props dropped between the scenes along the roads, so the stories join up (a crate off a cart, a lost sack, arrows). */
const ECHOES: Record<string, (rc: Recipe, P: Pr, r: () => number) => void> = {
  crate: (rc, P, r) => { rc.s(P.crate, 0, 0, 0, r() * 6).item(0, 0, 0.45, 0.52); if (r() < 0.5) rc.s(P.lid, 0.7, 0, 0.3, r() * 6, 1, 1, 1, 0.06); rc.paint('stain', 0, 0, 1.2, 0.9, r() * 3, G.tramp, 0.22); },
  sack: (rc, P, r) => { const [hk, hc] = SPICE[Math.floor(r() * 4)]; rc.s(P.sack, 0, 0, 0, r() * 6).item(0, 0, 0.5, 0.3).s(P[hk] as Proto, 0.5, 0, 0.1, 0, 0.6); rc.paint('fan', 0.3, 0, 1.3, 0.5, r() * 6, hc, 0.5); },
  jar: (rc, P, r) => { rc.s(P.jarLying, 0, 0, 0, r() * 6, 0.88).item(0, 0, 0.5, 0.55); rc.f(P.sherds, 0.5, 0.02, 0.3, r() * 6); },
  arrows: (rc, P, r) => { for (let k = 0; k < 3 + Math.floor(r() * 3); k++) rc.s(P.arrow, (r() - 0.5) * 1.4, 0, (r() - 0.5) * 1.4, 2.6 + (r() - 0.5) * 0.6, 1.05, 1.05, 1.05, 0.3 + r() * 0.35); rc.item(0, 0, 1.05, 0.5); },
  wheel: (rc, P, r) => { rc.s(P.wheelFlat, 0, 0.02, 0, r() * 3, 0.85, 0.85, 0.85, 0.06).item(0, 0, 0.7, 0.2); rc.paint('stain', 0, 0, 1.2, 1.0, 0, G.tramp, 0.2); },
  basket: (rc, P, r) => { rc.s(P.basketLying, 0, 0, 0, r() * 6).item(0.2, 0, 0.6, 0.3); },
  amphora: (rc, P, r) => { rc.s(P.amphoraLying, 0, 0, 0, r() * 6).item(0, 0, 0.6, 0.52); rc.paint('stain', 0, 0, 1.0, 0.8, 0, G.drift, 0.4); },
};

/** For the shape check (pipeline/tools/scenes-shape-sd.js): the kinds and their shapes, to measure every part against its footprint. */
export const __shapes = { KINDS, ECHOES, Recipe, autoCover, shapes: () => (PROTOS ??= makeProtos()) };

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
    for (const A of [(p as Proto).pos]) { const n = A.length / 3, step = Math.max(1, Math.ceil(n / 320)); for (let v = 0; v < n; v += step) pts.push(A[v * 3], A[v * 3 + 1], A[v * 3 + 2]); }
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
      for (const A of [op.p.pos]) for (let i = 0; i < A.length; i += 3) { st[0] = Math.max(st[0], Math.hypot(A[i], A[i + 2])); st[1] = Math.max(st[1], A[i + 1]); st[2] = Math.max(st[2], Math.hypot(A[i], A[i + 1], A[i + 2])); }
      stats.set(op.p, st);
    }
    let P = hulls.get(op.p);
    if (!P) hulls.set(op.p, (P = hullOf(op.p)));
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

/** The ground's canvas (sandsZone.ts `paint`, reached through sandsDepth.ts): `X`, `Z` from offsets to pixels, `ppm` pixels a metre. */
export interface GroundCanvas { g: CanvasRenderingContext2D; X: (dx: number) => number; Z: (dz: number) => number; ppm: number }

export interface SandsScenesIn {
  look: SandsLook;
  land: SandsLand;
  keep: { x: number; z: number }[];
  /** The depth's own props and pools (sandsDepth.ts `solids`), kept clear of. */
  solids: { x: number; z: number; r: number }[];
  sink: SceneSink;
  /** The ground's canvas, not yet on the graphics card: each scene's ground is painted into it (no draw calls). */
  ground?: GroundCanvas | null;
}

/** Plans and places one Sands floor's scenes. Returns what was placed (for the checks: `group.userData.depth.scenes`). */
export function sandsScenes(o: SandsScenesIn) {
  const t0 = performance.now();
  if (scenesOff()) return { scenes: [] as SceneRec[], ms: 0 };
  const P = (PROTOS ??= makeProtos());
  const { look, land, keep, solids, sink } = o;
  const rnd = seeded(61_721 + look.seed);
  const rim = look.rim;
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover = look.pieces.map((p) => p.o);
  // The room checks look only at the 8 m cells round their point, and further by the part's own reach (every margin they test is under
  // 8 m past a part's edge; the places, few and wide, are all checked). A grid made once a floor: a road, a rock or a prop in every
  // cell its box touches.
  type Cell = { k: typeof keep; s: typeof solids; r: typeof roads; c: typeof cover };
  const grid = new Map<number, Cell>(), CS = 8;
  const cellAt = (gx: number, gz: number) => { const key = gx * 4096 + gz; let c = grid.get(key); if (!c) grid.set(key, (c = { k: [], s: [], r: [], c: [] })); return c; };
  const span = (x0: number, z0: number, x1: number, z1: number, put: (c: Cell) => void) => {
    for (let gx = Math.floor(Math.min(x0, x1) / CS); gx <= Math.floor(Math.max(x0, x1) / CS); gx++) for (let gz = Math.floor(Math.min(z0, z1) / CS); gz <= Math.floor(Math.max(z0, z1) / CS); gz++) put(cellAt(gx, gz));
  };
  for (const k of keep) span(k.x, k.z, k.x, k.z, (c) => c.k.push(k));
  for (const q of solids) span(q.x - q.r, q.z - q.r, q.x + q.r, q.z + q.r, (c) => c.s.push(q));
  for (const q of roads) span(q.ax, q.az, q.bx, q.bz, (c) => c.r.push(q));
  for (const q of cover) span(Math.min(q.ax, q.bx) - q.r, Math.min(q.az, q.bz) - q.r, Math.max(q.ax, q.bx) + q.r, Math.max(q.az, q.bz) + q.r, (c) => c.c.push(q));
  const around = (x: number, z: number, f: (c: Cell) => void, reach = 0) => {
    const gx = Math.floor(x / CS), gz = Math.floor(z / CS), n = 1 + Math.ceil(reach / CS);
    for (let a = gx - n; a <= gx + n; a++) for (let b = gz - n; b <= gz + n; b++) { const c = grid.get(a * 4096 + b); if (c) f(c); }
  };
  const roadClear = (x: number, z: number, reach = 0) => { let m = 1e9; around(x, z, (c) => { for (const s of c.r) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz)); }, reach); return m; };
  /** The nearest point on a road's middle line. */
  const roadPoint = (x: number, z: number) => {
    let m = 1e9, px = x, pz = z;
    for (const s of roads) {
      const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2)) : 0;
      const qx = s.ax + ex * t, qz = s.az + ez * t, d = Math.hypot(x - qx, z - qz);
      if (d < m) { m = d; px = qx; pz = qz; }
    }
    return { x: px, z: pz, d: m };
  };
  const coverClear = (x: number, z: number, reach = 0) => { let m = 1e9; around(x, z, (c) => { for (const q of c.c) m = Math.min(m, segDist(x, z, q.ax, q.az, q.bx, q.bz) - q.r); }, reach); return m; };
  const keepClear = (x: number, z: number, reach = 0) => { let m = 1e9; around(x, z, (c) => { for (const k of c.k) m = Math.min(m, Math.hypot(x - k.x, z - k.z)); }, reach); return m; };
  const placeClear = (x: number, z: number) => { let m = 1e9; for (const p of look.places) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r); return m; };
  const solidClear = (x: number, z: number, reach = 0) => { let m = 1e9; around(x, z, (c) => { for (const q of c.s) m = Math.min(m, Math.hypot(x - q.x, z - q.z) - q.r); }, reach); return m; };
  const beyond = (x: number, z: number) => land.beyond(x - RING.x, z - RING.z);
  /** A rock (or a wall) right north of the point's edge: the camera looks north, so a tall thing there hides nobody. */
  const backedAt = (x: number, z: number, r: number) => coverClear(x, z - r - 0.6) < 0.5 && coverClear(x, z) < r + 1.2;

  const placed: SceneRec[] = [];
  const echoes: SceneRec[] = [];
  const paints: (Paint & { yaw: number })[] = [];
  const trails: { t: 'ruts' | 'prints' | 'drag'; ax: number; az: number; bx: number; bz: number }[] = [];
  const used = new Map<string, number>();
  // How many of each kind this floor may have: the floor's own mix, so no two floors look alike.
  const cap: Record<string, number> = {};
  for (const k of Object.keys(KINDS)) cap[k] = 2 + Math.floor(rnd() * 2);
  cap.ribs = rnd() < 0.8 ? 1 : 0; cap.jackal = 1 + (rnd() < 0.5 ? 1 : 0); cap.pots = 2; cap.shrine = 2;
  const off = Object.keys(KINDS).filter((k) => !['ribs', 'jackal', 'shrine', 'pots'].includes(k));
  cap[off[Math.floor(rnd() * off.length)]] = 1; // a kind this floor has little of
  for (let k = 0; k < 2; k++) cap[off[Math.floor(rnd() * off.length)]] += 1; // and two it has more of
  const MAX = 28; // on the walkable sand, not counting the few against the rocks (up to six) and past the edge (up to three)
  let farN = 0, backN = 0;
  const left = (k: string) => (cap[k] ?? 0) - (used.get(k) ?? 0);

  const world = (rc: Recipe, x: number, z: number, yaw: number, far: boolean): SceneItem[] => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return rc.items.map((it) => ({ x: x + it.x * c + it.z * s, z: z - it.x * s + it.z * c, r: it.r, h: it.h, far }));
  };
  /** One part's room on the walkable sand: off the spots, the roads' middles, the cover, the courts, the depth's props, the outline. */
  const roomFor = (it: SceneItem) => {
    // the quick and the most often failing first (the same answer in any order)
    if (keepClear(it.x, it.z, it.r) < it.r + 3.2) return false;
    if (roadClear(it.x, it.z, it.r) < it.r + 2.2) return false;
    if (placeClear(it.x, it.z) < it.r + 2.6) return false;
    const b = beyond(it.x, it.z);
    if (it.far) {
      if (b < it.r + 4 || b > 26) return false;
      const dx = it.x - RING.x, dz = it.z - RING.z;
      if (land.south(dx, dz) > 0.2 || land.steepness(dx, dz) > 0.45) return false;
    } else {
      if (b > -(it.r + 1.2)) return false;
      if (coverClear(it.x, it.z, it.r) < it.r + 0.15) return false;
      if (it.h > KNEE && !backedAt(it.x, it.z, it.r)) return false;
    }
    if (solidClear(it.x, it.z, it.r) < it.r + 0.4) return false;
    return true;
  };
  /** Does a scene fit here? Every part with room, and off the other scenes (and the echoes). */
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
      const o = bounds.get(sc)!;
      if (Math.hypot(o.cx - b.cx, o.cz - b.cz) >= o.r + b.r + gap) continue;
      for (const it of items) for (const q of sc.items) if (Math.hypot(it.x - q.x, it.z - q.z) < it.r + q.r + gap) return false;
    }
    return true;
  };
  const fits = (items: SceneItem[], gap = 1.5) => {
    const b = bound(items);
    if (!clearOf(items, b, placed, gap) || !clearOf(items, b, echoes, 0.8)) return false;
    let ok = true;
    for (const it of items) if (!roomFor(it)) { ok = false; break; }
    return ok;
  };
  const keepRec = (list: SceneRec[], r: SceneRec) => { list.push(r); bounds.set(r, bound(r.items)); };
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const emit = (rc: Recipe, x: number, y: number, z: number, yaw: number) => {
    M.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S.set(1, 1, 1));
    for (const op of rc.ops) {
      L.compose(V.set(op.x, op.y, op.z), Q.setFromEuler(E.set(op.tilt, op.yaw, op.roll, 'YXZ')), S.set(op.sx, op.sy, op.sz));
      sink.proto(op.k, op.p, L.premultiply(M));
    }
  };
  const toWorld = (lx: number, lz: number, x: number, z: number, yaw: number) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  const rec = (kind: string, where: string, x: number, z: number, yaw: number, items: SceneItem[], main: { x: number; z: number }): SceneRec =>
    ({ kind, where, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), main: { x: +main.x.toFixed(2), z: +main.z.toFixed(2) }, items: items.map((it) => ({ ...it, x: +it.x.toFixed(2), z: +it.z.toFixed(2) })) });
  /** What leads from a placed scene to the road it is by: painted ruts, prints or a drag mark; arrows stuck along the way; a dropped load. */
  const lead = (rc: Recipe, main: { x: number; z: number }, kind: string) => {
    if (!rc.trail) return;
    const rp = roadPoint(main.x, main.z);
    if (rp.d < 4 || rp.d > 24) return;
    const ux = (rp.x - main.x) / rp.d, uz = (rp.z - main.z) / rp.d;
    if (rc.trail === 'ruts' || rc.trail === 'prints' || rc.trail === 'drag') trails.push({ t: rc.trail, ax: main.x + ux * 1.2, az: main.z + uz * 1.2, bx: rp.x - ux * 1.2, bz: rp.z - uz * 1.2 });
    if (rc.trail === 'arrows' || rc.trail === 'ruts') {
      // arrows towards the fight; a crate or a sack off the cart, on the verge where the ruts leave the road
      const room = rp.d - 3.4;
      if (room < 2.5) return;
      const steps = rc.trail === 'arrows' ? [0.66, 0.33, 0] : [0];
      for (const f of steps) {
        const back = 3.4 + room * f, ex = rp.x - ux * back + (rnd() - 0.5) * 0.6, ez = rp.z - uz * back + (rnd() - 0.5) * 0.6;
        const e = new Recipe();
        (rc.trail === 'arrows' ? ECHOES.arrows : kind === 'amphorae' ? ECHOES.amphora : rnd() < 0.5 ? ECHOES.crate : ECHOES.sack)(e, P, rnd);
        const yaw = rnd() * 6;
        let items = world(e, ex, ez, yaw, false);
        if (!fits(items, 0.6)) continue;
        const n0 = e.items.length;
        autoCover(e); items = world(e, ex, ez, yaw, false);
        if (!fits(items.slice(n0), 0.6)) continue;
        emit(e, ex, 0, ez, yaw);
        for (const p of e.paints) paints.push({ ...p, ...toWorld(p.x, p.z, ex, ez, yaw), yaw });
        keepRec(echoes, { ...rec('echo', 'trail', ex, ez, yaw, items, { x: ex, z: ez }), echo: true });
      }
    }
  };
  /** Tries one kind at one spot (a few turns); places it if it fits. */
  const tryAt = (kind: string, where: string, x: number, z: number, yaw0: number, o2: { backed?: boolean; far?: boolean; spread?: number; rc?: Recipe } = {}) => {
    const far = !!o2.far, backed = !!o2.backed;
    if (left(kind) <= 0 || (!far && !backed && placed.length - farN - backN >= MAX)) return false;
    for (const sc of placed) if (Math.hypot(sc.x - x, sc.z - z) < (sc.kind === kind ? 30 : 13)) return false;
    // quick noes before the parts are made: a scene's middle is never on a spot, a rock, a court or past the edge
    if (keepClear(x, z) < 3.2 || (!far && (coverClear(x, z) < 0.3 || placeClear(x, z) < 2 || beyond(x, z) > -2))) return false;
    for (let t = 0, tries = backed ? 3 : 2; t < tries; t++) {
      let rc = t === 0 ? o2.rc : undefined;
      if (!rc) { rc = new Recipe(); KINDS[kind](rc, P, rnd, { backed, far }); }
      const yaw = yaw0 + (t === 0 ? 0 : (rnd() - 0.5) * (o2.spread ?? 0.8));
      let items = world(rc, x, z, yaw, far);
      if (!fits(items)) continue;
      if (!far) {
        // the circles the measuring added must have room too (the declared ones have)
        const n0 = rc.items.length;
        autoCover(rc);
        if (rc.items.length > n0) { items = world(rc, x, z, yaw, far); if (!fits(items.slice(n0))) continue; }
      }
      let y = 0;
      if (far) { y = 1e9; for (const it of items) for (const [ox, oz] of [[0, 0], [it.r, 0], [-it.r, 0], [0, it.r], [0, -it.r]]) y = Math.min(y, land.height(it.x + ox - RING.x, it.z + oz - RING.z)); y -= 0.15; }
      emit(rc, x, y, z, yaw);
      const main = toWorld(rc.main.x, rc.main.z, x, z, yaw);
      keepRec(placed, rec(kind, where, x, z, yaw, items, main));
      used.set(kind, (used.get(kind) ?? 0) + 1);
      if (far) farN++;
      if (backed) backN++;
      if (!far) {
        for (const p of rc.paints) paints.push({ ...p, ...toWorld(p.x, p.z, x, z, yaw), yaw });
        lead(rc, main, kind);
      }
      return true;
    }
    return false;
  };
  const shuffle = <T,>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
  /** The kinds that fit a spot, the ones this floor has the most of left first. */
  const pick = (list: string[]) => shuffle(list.filter((k) => left(k) > 0)).sort((a, b) => left(b) - left(a));

  // 1. Shrines at the forks: where a road ends on another road.
  for (const p of look.paths) {
    for (const end of [p[0], p[p.length - 1]]) {
      const x = RING.x + end[0], z = RING.z + end[1];
      if (roads.filter((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 3).length < 2 || placeClear(x, z) < 6) continue;
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, d = 4.6 + rnd() * 2; if (tryAt('shrine', 'fork', x + Math.cos(a) * d, z + Math.sin(a) * d, rnd() * 6)) break; }
    }
  }
  // 2. Past the edge, stories in the background: a great beast's ribs, a jackal's head, a wagon in the dunes (never in the south). Early,
  //    so the caps of the walkable sand never leave them out.
  const farKinds = new Set<string>(); // one of each out there
  for (let k = 0, far = 0; k < 160 && far < 3; k++) {
    const a = rnd() * Math.PI * 2, b = 9 + rnd() * 10, rr = rimAt(rim, a) + b, x = RING.x + Math.cos(a) * rr, z = RING.z + Math.sin(a) * rr;
    const facing = Math.atan2(RING.x - x, RING.z - z); // the scene's +z towards the middle
    for (const kind of pick(['ribs', 'jackal', 'wagon'].filter((q) => !farKinds.has(q)))) if (tryAt(kind, 'far', x, z, kind === 'ribs' ? facing + Math.PI / 2 : facing, { far: true, spread: 0.5 })) { far++; farKinds.add(kind); break; }
  }
  // 3. Round the places that suit them: pots at the tombs, a fight by the raiders and the forts, a rest, a tent or a caravan by the serai
  //    and the oasis, a dig and its amphorae by the dig.
  const SUITS: Record<string, string[]> = {
    tombs: ['pots', 'amphorae'], raiders: ['fight', 'tent', 'grave'], fort: ['fight', 'grave'], gatehouse: ['fight'], serai: ['caravan', 'tent', 'rest'],
    oasis: ['rest', 'waterwheel', 'well'], dig: ['dig', 'amphorae'], ruins: ['sundial', 'amphorae'], well: ['well', 'waterwheel'], camp: ['tent'],
  };
  for (const pl of shuffle(look.places.slice())) {
    const want = SUITS[pl.kind ?? ''];
    if (!want) continue;
    for (const kind of want) {
      const needsBack = kind === 'pots';
      let done = false;
      for (let k = 0; k < 16 && !done; k++) {
        const a = rnd() * Math.PI * 2, d = pl.r + 5 + rnd() * 8, x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        if (needsBack) {
          // a rock near the place's edge with free sand south of it
          const c = cover.find((q) => q.r > 0.8 && segDist(x, z, q.ax, q.az, q.bx, q.bz) < q.r + 3);
          if (!c) continue;
          const t = rnd(), cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
          done = tryAt(kind, 'place', cx, cz + c.r + 1.15, (rnd() - 0.5) * 0.4, { backed: true, spread: 0.3 });
        } else done = tryAt(kind, 'place', x, z, rnd() * 6);
      }
    }
  }
  // 4. Along the roads, on the verge: one every 26 to 38 m of road, either side.
  const ROADSIDE = ['caravan', 'fight', 'sundial', 'well', 'rest', 'grave', 'dig', 'tent', 'amphorae', 'waterwheel'];
  let since = 12 + rnd() * 14;
  for (const s of shuffle(roads.slice())) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 3; d < len - 3; d += 3) {
      since += 3;
      if (since < 26 + rnd() * 12) continue;
      const side = rnd() < 0.5 ? 1 : -1, cx = s.ax + ux * d, cz = s.az + uz * d;
      if (placed.some((sc) => Math.hypot(sc.x - cx, sc.z - cz) < 9)) continue; // a scene is here already
      // a quick look at both verges before any scene is made for them: room enough round the spot 7 m out?
      const sides = [side, -side].filter((sd) => { const x = cx - uz * sd * 7, z = cz + ux * sd * 7; return beyond(x, z) < -4 && keepClear(x, z) > 5 && placeClear(x, z) > 3 && coverClear(x, z) > 1.5; });
      if (!sides.length) { since -= 6; continue; }
      let ok = false;
      for (const kind of pick(ROADSIDE).slice(0, 3)) {
        for (const [sd, extra] of [[sides[0], 0.6], [sides[0], 2.0], [sides[1] ?? 0, 0.6]]) {
          if (!sd) continue;
          const rc = new Recipe(); KINDS[kind](rc, P, rnd, { backed: false, far: false });
          const off = 2.2 + rc.reach + extra, x = cx - uz * sd * off, z = cz + ux * sd * off;
          if (tryAt(kind, 'road', x, z, Math.atan2(ux, uz) + (rnd() - 0.5) * 0.6, { rc })) { ok = true; break; }
        }
        if (ok) break;
      }
      since = ok ? 0 : since - 6; // no room here: the next try a few metres on
    }
  }
  // 5. Against the rocks: the tall stories stand right south of a rock (a jackal's head, a wagon in its drift, a cart, a lean-to, the
  //    tent half standing, the water-wheel upright).
  const rocks = shuffle(cover.filter((c) => c.r >= 0.9 && beyond(c.ax, c.az) < -4));
  let backedN = 0;
  for (const c of rocks) {
    if (backedN >= 6) break;
    const t = 0.2 + rnd() * 0.6, cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
    for (const kind of pick(['jackal', 'wagon', 'caravan', 'rest', 'tent', 'waterwheel'])) {
      const back = kind === 'jackal' ? 2.65 : kind === 'wagon' ? 2.3 : kind === 'caravan' ? 1.6 : kind === 'tent' ? 2.6 : kind === 'waterwheel' ? 1.2 : 0.8;
      if (tryAt(kind, 'backed', cx, cz + c.r + back, (rnd() - 0.5) * 0.4, { backed: true, spread: 0.3 })) { backedN++; break; }
    }
  }
  // 6. The open sand between the places.
  const rmax = Math.max(...rim);
  for (let k = 0, open = 0; k < 700 && open < 5; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyond(x, z) > -8 || roadClear(x, z) < 7 || placeClear(x, z) < 6 || keepClear(x, z) < 6 || coverClear(x, z) < 2) continue;
    if (placed.some((sc) => Math.hypot(sc.x - x, sc.z - z) < 13)) continue;
    for (const kind of pick(['sundial', 'well', 'dig', 'grave', 'fight', 'caravan', 'rest', 'tent', 'amphorae', 'waterwheel']).slice(0, 3)) if (tryAt(kind, 'open', x, z, rnd() * 6)) { open++; break; }
  }
  // 7. Echoes on the verges between the scenes: a crate, a sack, a jar, arrows, a wheel, a basket, every 14 to 22 m where no scene is near.
  const EK = Object.keys(ECHOES);
  let gap = 6;
  for (const s of roads) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 2; d < len - 2; d += 2) {
      gap += 2;
      if (gap < 16 + rnd() * 8 || echoes.length >= 16) continue;
      const cx = s.ax + ux * d, cz = s.az + uz * d;
      if (placed.some((sc) => Math.hypot(sc.x - cx, sc.z - cz) < 9)) continue;
      const side = rnd() < 0.5 ? 1 : -1, off = 3.2 + rnd() * 1.2, x = cx - uz * side * off, z = cz + ux * side * off;
      const e = new Recipe(), kind = EK[Math.floor(rnd() * EK.length)];
      ECHOES[kind](e, P, rnd);
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
  // 8. The scenes' ground, painted into the sand (never inside a court): trampled patches, spilled spice, dust, the channels; the ruts,
  //    prints and drag marks that lead back to the road.
  if (o.ground) paintGround(o.ground, paints, trails, look, rnd);
  return { scenes: placed.concat(echoes), ms: +(performance.now() - t0).toFixed(1) };
}

/** Paints the scenes' ground into the sand's canvas (before it goes to the graphics card): no draw calls, no geometry. */
function paintGround(gc: GroundCanvas, paints: (Paint & { yaw: number })[], trails: { t: 'ruts' | 'prints' | 'drag'; ax: number; az: number; bx: number; bz: number }[], look: SandsLook, rnd: () => number) {
  const { g, X, Z, ppm } = gc;
  const px = (x: number) => X(x - RING.x), pz = (z: number) => Z(z - RING.z);
  g.save();
  // never inside a court (they are drawn already): everything but the courts' discs
  g.beginPath();
  g.rect(0, 0, g.canvas.width, g.canvas.height);
  for (const p of look.places) { g.moveTo(px(p.x) + (p.r + 0.3) * ppm, pz(p.z)); g.arc(px(p.x), pz(p.z), (p.r + 0.3) * ppm, 0, Math.PI * 2, true); }
  g.clip('evenodd');
  const rgba = (c: string, a: number) => `rgba(${c},${a.toFixed(3)})`;
  for (const p of paints) {
    g.save();
    g.translate(px(p.x), pz(p.z));
    g.rotate(p.rot - p.yaw);
    if (p.t === 'stain') {
      g.scale(1, p.b / p.a);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.a * ppm), al = Math.min(0.7, p.al * 1.4);
      gr.addColorStop(0, rgba(p.c, al)); gr.addColorStop(0.55, rgba(p.c, al * 0.75)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, p.a * ppm, 0, Math.PI * 2); g.fill();
    } else if (p.t === 'fan') {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.a * ppm);
      gr.addColorStop(0, rgba(p.c, p.al)); gr.addColorStop(0.5, rgba(p.c, p.al * 0.6)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, p.a * ppm, -p.b, p.b); g.closePath(); g.fill();
    } else if (p.t === 'band') {
      // a dry channel or a drifted line: the bed, its darker edges, a few cracks
      const w = p.b * ppm, l = p.a * ppm;
      const gr = g.createLinearGradient(-l / 2, 0, l / 2, 0);
      gr.addColorStop(0, rgba(p.c, 0)); gr.addColorStop(0.08, rgba(p.c, p.al)); gr.addColorStop(0.92, rgba(p.c, p.al)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr;
      g.fillRect(-l / 2, -w / 2, l, w);
      if (p.c === G.crack) {
        g.strokeStyle = rgba(G.dark, 0.5); g.lineWidth = 0.08 * ppm;
        g.beginPath(); g.moveTo(-l / 2 + 0.4 * ppm, -w / 2); g.lineTo(l / 2 - 0.4 * ppm, -w / 2); g.moveTo(-l / 2 + 0.4 * ppm, w / 2); g.lineTo(l / 2 - 0.4 * ppm, w / 2); g.stroke();
        g.lineWidth = 0.04 * ppm;
        g.beginPath();
        for (let x = -l / 2 + 0.6 * ppm; x < l / 2 - 0.6 * ppm; x += (0.5 + rnd() * 0.5) * ppm) { const y0 = (rnd() - 0.5) * w * 0.8; g.moveTo(x, y0); g.lineTo(x + (rnd() - 0.5) * 0.5 * ppm, y0 + (rnd() - 0.5) * 0.6 * ppm); }
        g.stroke();
      }
    } else if (p.t === 'prints') {
      g.fillStyle = rgba(p.c, p.al);
      for (let d = 0, k = 0; d < p.a; d += 0.42, k++) { g.beginPath(); g.ellipse(d * ppm, (k % 2 ? 0.13 : -0.13) * ppm, 0.12 * ppm, 0.06 * ppm, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
  for (const t of trails) {
    const len = Math.hypot(t.bx - t.ax, t.bz - t.az);
    if (len < 0.5) continue;
    g.save();
    g.translate(px(t.ax), pz(t.az));
    g.rotate(Math.atan2(t.bz - t.az, t.bx - t.ax));
    const L2 = len * ppm, gr = g.createLinearGradient(0, 0, L2, 0);
    if (t.t === 'ruts') {
      gr.addColorStop(0, rgba(G.dark, 0.55)); gr.addColorStop(1, rgba(G.dark, 0.14));
      g.strokeStyle = gr; g.lineWidth = 0.2 * ppm; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -0.7 * ppm); g.lineTo(L2, -0.7 * ppm); g.moveTo(0, 0.7 * ppm); g.lineTo(L2, 0.7 * ppm); g.stroke();
    } else if (t.t === 'drag') {
      gr.addColorStop(0, rgba(G.tramp, 0.45)); gr.addColorStop(1, rgba(G.tramp, 0.1));
      g.fillStyle = gr; g.fillRect(0, -0.35 * ppm, L2, 0.7 * ppm);
    } else {
      g.fillStyle = rgba(G.dark, 0.42);
      for (let d = 0, k = 0; d < len; d += 0.42, k++) { g.beginPath(); g.ellipse(d * ppm, (k % 2 ? 0.13 : -0.13) * ppm, 0.12 * ppm, 0.06 * ppm, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
  g.restore();
}
