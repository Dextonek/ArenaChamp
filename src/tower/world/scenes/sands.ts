import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import { rimAt } from '../land';
import type { SandsLook } from '../sandsZone';
import type { SandsLand } from '../sandsDepth';

/**
 * Scenes on a Sands floor (floors 21 to 30; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props
 * on the maps, make actual scenarios and stuff"). A scene is a small group of props, 3 to 12 m across, that tells at a glance that
 * something happened there: a caravan ambushed, a dig abandoned, a jackal's head in black stone half buried in a drift. Called from sandsDepth.ts's
 * `build`, it adds its parts to the depth's own merged meshes (no draw calls of its own).
 *
 * **Looks only, never cover:** nothing here stops a walk or a shot. On walkable sand only low things (under knee height: spilled crates,
 * a rug, a fallen windlass, a pit's dark floor); anything taller stands right south of existing cover (the camera looks north, so it
 * hides nobody) or past the walkable edge as a story in the background (never in the south, the camera's side). Every part keeps 3 m off
 * the floor's spots (keep.ts), off the roads' middles, the cover, the places' courts and the depth's own props.
 *
 * Kinds: the ambushed caravan (with its cart tipped against a rock where there is one), the abandoned dig, the dry well with its
 * windlass fallen, the travellers' rest (a lean-to against a rock where there is one), the sundial and the broken obelisk, a fight's
 * aftermath, a shrine at a fork, a grave; and against the rocks or past the edge: a jackal's head in black stone half buried in a drift, a wagon sunk to
 * its axles, pots stacked at a tomb's door (one smashed), the bleached ribs of a great beast.
 *
 * Every part's shape is built once for the page (`protos`) and copied into place by a matrix; each kind is a recipe of parts with its own
 * small variations (which crates, how many arrows). Its own random stream, so nothing that was there moves.
 */

/** A part's shape: positions, normals and colours, not indexed. Built once, copied per placement. */
export interface Proto { pos: Float32Array; nor: Float32Array; col: Float32Array }
/** Where the parts go: the depth's merged meshes (`s` casts shadows, `f` is flat on the ground). */
export interface SceneSink { proto(kind: 's' | 'f', p: Proto, m: THREE.Matrix4): void }
/** A part's footprint in the world: a circle and its height; `far`: meant to stand past the walkable edge. */
export interface SceneItem { x: number; z: number; r: number; h: number; far: boolean }
export interface SceneRec { kind: string; where: string; x: number; z: number; yaw: number; items: SceneItem[] }

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
const ball = (r: number, w = 10, hs = 7) => new THREE.SphereGeometry(r, w, hs);
const ring = (R: number, t: number, rs = 5, ts = 18, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, rs, ts, arc);
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
  const arrow = (): Part[] => [[cyl(0.014, 0.014, 0.66, 5).translate(0, -0.14, 0), C.wood], [box(0.006, 0.13, 0.06, 0, 0.44), C.wine], [box(0.06, 0.13, 0.006, 0, 0.44), C.cream]];
  const pot = (body: string, band: string): Part[] => [
    [ball(0.32, 12, 9).scale(1, 1.22, 1).translate(0, 0.4, 0), body], [cyl(0.12, 0.16, 0.16, 10).translate(0, 0.76, 0), body],
    [ring(0.13, 0.026, 4, 12).rotateX(Math.PI / 2).translate(0, 0.93, 0), C.brass], [ring(0.325, 0.03, 4, 18).rotateX(Math.PI / 2).translate(0, 0.46, 0), band],
  ];
  const wheelParts = (R: number, col: string): Part[] => [
    [ring(R, 0.07, 6, 20), col], [cyl(0.12, 0.12, 0.16, 8).rotateX(Math.PI / 2).translate(0, 0, -0.08), col],
    ...[0, 1, 2].map((k) => [box(R * 2, 0.06, 0.05, 0, 0, 0).rotateZ((k * Math.PI) / 3), col] as Part),
    [cyl(0.07, 0.07, 0.04, 8).rotateX(Math.PI / 2).translate(0, 0, 0.08), C.brass],
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
      [cyl(0.1, 0.1, 0.52, 8).rotateZ(Math.PI / 2).translate(0, 0.38, -0.12), C.wine], [cyl(0.1, 0.1, 0.52, 8).rotateZ(Math.PI / 2).translate(0, 0.4, 0.1), C.turquoise],
    ]),
    lid: P([[box(0.62, 0.05, 0.62), C.plank], [box(0.62, 0.052, 0.08, 0, 0.026, 0.2), C.lacquer], [box(0.62, 0.052, 0.08, 0, 0.026, -0.2), C.lacquer]]),
    sack: P([[ball(1, 10, 7).scale(0.42, 0.24, 0.3).translate(0, 0.2, 0), C.cream], [cyl(0.08, 0.1, 0.14, 7).rotateZ(Math.PI / 2).translate(0.46, 0.18, 0), C.cream], [ring(0.09, 0.022, 4, 8).rotateY(Math.PI / 2).translate(0.52, 0.18, 0), C.rope]]),
    sackHide: P([[ball(1, 10, 7).scale(0.4, 0.26, 0.3).translate(0, 0.22, 0), C.hide], [cyl(0.08, 0.1, 0.14, 7).rotateZ(Math.PI / 2).translate(0.44, 0.2, 0), C.hide], [ring(0.09, 0.022, 4, 8).rotateY(Math.PI / 2).translate(0.5, 0.2, 0), C.rope]]),
    heapRed: P([[cone(0.62, 0.24, 12), C.red]]),
    heapOchre: P([[cone(0.62, 0.24, 12), C.ochre]]),
    heapGrain: P([[cone(0.62, 0.22, 12), C.grain]]),
    heapTurq: P([[cone(0.5, 0.18, 12), C.turquoise]]),
    lantern: P([
      [cyl(0.12, 0.12, 0.3, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0), C.lacquer], [cyl(0.105, 0.105, 0.16, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0), C.glass],
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
    ]),
    paw: P([[box(0.56, 0.28, 0.8), C.lacquer], ...[-0.18, 0, 0.18].map((x) => [ball(0.12, 8, 6).scale(1, 0.9, 1.2).translate(x, 0.12, 0.42), C.lacquer] as Part), [box(0.6, 0.06, 0.1, 0, 0.25, -0.2), C.brass], [box(0.5, 0.24, 0.04, 0, 0.12, -0.42), C.ivory]]),
    drift: P([[ball(1, 16, 8), C.sand]]),
    driftDark: P([[ball(1, 14, 8), C.sandDark]]),
    // --- the dig
    pit: P([[box(3.0, 0.02, 2.2, 0, 0.01), C.pitRim], [box(2.6, 0.02, 1.8, 0, 0.02), C.pit], [box(2.6, 0.022, 0.5, 0, 0.026, -0.65), C.pitRim]]),
    peg: P([[cyl(0.03, 0.04, 0.42, 5), C.wood], [cyl(0.045, 0.045, 0.04, 5).translate(0, 0.4, 0), C.brass]]),
    sieve: P([[box(0.9, 0.06, 0.62), C.wood], [box(0.8, 0.012, 0.52, 0, 0.065), C.rope], [box(0.92, 0.03, 0.05, 0, 0.07, 0.29), C.brass]]),
    basket: P([[cyl(0.26, 0.21, 0.34, 12), C.rope], [ring(0.26, 0.025, 4, 14).rotateX(Math.PI / 2).translate(0, 0.34, 0), C.brass], [cyl(0.23, 0.23, 0.02, 12).translate(0, 0.28, 0), C.sandDark]]),
    basketLying: P([[cyl(0.26, 0.21, 0.34, 12).rotateZ(Math.PI / 2).translate(-0.17, 0.25, 0), C.rope], [ring(0.26, 0.025, 4, 14).rotateY(Math.PI / 2).translate(0.17, 0.25, 0), C.brass], [cone(0.45, 0.14, 10).translate(0.55, 0, 0), C.sandDark]]),
    ladder: P([[box(0.06, 0.06, 2.6, 0.22, 0.03), C.wood], [box(0.06, 0.06, 2.6, -0.22, 0.03), C.wood], ...[-1.1, -0.73, -0.36, 0, 0.37, 0.74, 1.1].map((z) => [box(0.5, 0.04, 0.05, 0, 0.065, z), C.plank] as Part)]),
    shovel: P([[cyl(0.025, 0.025, 1.3, 6).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.wood], [box(0.24, 0.02, 0.3, 0, 0.02, 0.78), C.steel], [box(0.18, 0.04, 0.05, 0, 0.03, -0.66), C.brass]]),
    pick: P([[cyl(0.025, 0.025, 0.95, 6).rotateX(Math.PI / 2).translate(0, 0.03, 0), C.wood], [box(0.6, 0.05, 0.06, 0, 0.04, 0.46), C.steel], [box(0.08, 0.07, 0.08, 0, 0.04, 0.46), C.brass]]),
    sherds: P([[box(0.14, 0.02, 0.1, 0, 0.01, 0).rotateY(0.4), C.clay], [box(0.1, 0.02, 0.12, 0.25, 0.012, 0.1).rotateY(-0.3), C.turquoise], [box(0.12, 0.02, 0.08, -0.2, 0.012, 0.18), C.clay], [box(0.09, 0.02, 0.09, 0.05, 0.012, -0.25), C.cream]]),
    // --- the dry well
    block: P([[box(0.62, 0.42, 0.36), C.sandstone], [box(0.64, 0.05, 0.38, 0, 0.44), C.turquoise]]),
    hole: P([[cyl(0.8, 0.8, 0.02, 20), C.lacquer]]),
    postLying: P([[box(0.14, 0.14, 1.7, 0, 0.07), C.wood], [box(0.18, 0.04, 0.18, 0, 0.07, 0.86).rotateX(Math.PI / 2), C.brass]]),
    drum: P([[cyl(0.15, 0.15, 1.2, 10).rotateZ(Math.PI / 2).translate(0, 0.2, 0), C.rope], [cyl(0.2, 0.2, 0.05, 12).rotateZ(Math.PI / 2).translate(0.62, 0.2, 0), C.wood], [cyl(0.2, 0.2, 0.05, 12).rotateZ(Math.PI / 2).translate(-0.62, 0.2, 0), C.wood], [box(0.05, 0.05, 0.36, 0.7, 0.2, 0.16), C.iron], [box(0.05, 0.05, 0.16, 0.76, 0.2, 0.34), C.iron]]),
    bucketLying: P([[cyl(0.2, 0.16, 0.32, 12).rotateZ(Math.PI / 2).translate(-0.16, 0.2, 0), C.wood], [ring(0.2, 0.02, 4, 14).rotateY(Math.PI / 2).translate(0.15, 0.2, 0), C.brass], [ring(0.18, 0.02, 4, 14).rotateY(Math.PI / 2).translate(-0.06, 0.19, 0), C.brass]]),
    jarLying: P([[ball(0.3, 12, 8).scale(1, 1.25, 1).rotateZ(Math.PI / 2).translate(0, 0.28, 0), C.clay], [cyl(0.1, 0.13, 0.16, 8).rotateZ(Math.PI / 2).translate(-0.44, 0.28, 0), C.clay], [ring(0.31, 0.025, 4, 16).rotateY(Math.PI / 2).translate(0.05, 0.28, 0), C.turquoise]]),
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
    staff: P([[cyl(0.03, 0.03, 1.8, 6).rotateZ(Math.PI / 2).translate(0, 0.03, 0), C.wood], [cyl(0.04, 0.04, 0.08, 6).rotateZ(Math.PI / 2).translate(0.9, 0.03, 0), C.brass]]),
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
    shield: P([[cyl(0.48, 0.48, 0.05, 20), C.wine], [cyl(0.34, 0.34, 0.06, 20), C.turquoise], [ball(0.1, 8, 6).scale(1, 0.6, 1).translate(0, 0.06, 0), C.brass], [ring(0.48, 0.028, 4, 26).rotateX(Math.PI / 2).translate(0, 0.04, 0), C.brass]]),
    sword: P([[box(0.06, 0.014, 0.85, 0, 0.02, 0.45), C.steel], [box(0.26, 0.03, 0.045, 0, 0.025, 0), C.brass], [box(0.04, 0.04, 0.18, 0, 0.025, -0.11), C.wood], [ball(0.036, 6, 4).translate(0, 0.03, -0.22), C.brass]]),
    helmet: P([[new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.iron], [ring(0.2, 0.025, 4, 16).rotateX(Math.PI / 2), C.brass], [box(0.03, 0.06, 0.32, 0, 0.21), C.wine]]),
    spearHalf: P([[cyl(0.022, 0.022, 1.1, 6).rotateZ(Math.PI / 2).translate(0, 0.025, 0), C.wood], [cone(0.045, 0.24, 4).rotateZ(-Math.PI / 2).translate(0.55, 0.03, 0), C.steel], [cyl(0.03, 0.03, 0.05, 6).rotateZ(Math.PI / 2).translate(0.53, 0.03, 0), C.brass]]),
    spearButt: P([[cyl(0.022, 0.022, 0.9, 6).rotateZ(Math.PI / 2).translate(0, 0.025, 0), C.wood]]),
    // --- a shrine at a fork
    cairn: P([[cyl(0.5, 0.55, 0.16, 7), C.rockB], [cyl(0.38, 0.42, 0.14, 7).translate(0, 0.16, 0), C.sandstone], [cyl(0.24, 0.28, 0.12, 7).translate(0, 0.3, 0), C.rockA], [box(0.14, 0.02, 0.86, 0, 0.43), C.turquoise], [box(0.14, 0.02, 0.3, 0, 0, 0).rotateX(1.0).translate(0, 0.33, 0.5), C.turquoise]]),
    bowl: P([[cyl(0.13, 0.09, 0.07, 10), C.clay], [ball(0.05, 6, 4).translate(0.03, 0.08, 0), C.red], [ball(0.045, 6, 4).translate(-0.04, 0.08, 0.03), C.ochre], [ring(0.13, 0.012, 4, 12).rotateX(Math.PI / 2).translate(0, 0.07, 0), C.brass]]),
    candles: P([[cyl(0.03, 0.03, 0.14, 6), C.ivory], [cyl(0.03, 0.03, 0.09, 6).translate(0.08, 0, 0.04), C.ivory], [cyl(0.03, 0.03, 0.11, 6).translate(-0.06, 0, 0.06), C.ivory], [cyl(0.005, 0.005, 0.03, 4).translate(0, 0.14, 0), C.lacquer]]),
    standard: P([[cyl(0.03, 0.03, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 0.03, 0), C.wood], [cone(0.06, 0.2, 6).rotateZ(-Math.PI / 2).translate(1.3, 0.03, 0), C.brass], [box(1.1, 0.02, 0.8, 0.55, 0.012, 0.42), C.wine], [box(1.1, 0.022, 0.12, 0.55, 0.014, 0.72), C.brass], [box(0.4, 0.024, 0.4, 0.55, 0.016, 0.42).rotateY(Math.PI / 4), C.turquoise]]),
    rugSmall: P([[box(1.3, 0.012, 0.8, 0, 0.006), C.wine], [box(1.1, 0.012, 0.6, 0, 0.012), C.turquoise], [box(0.3, 0.012, 0.3, 0, 0.018).rotateY(Math.PI / 4), C.cream]]),
    plate: P([[cyl(0.17, 0.17, 0.015, 16).rotateX(-1.2).translate(0, 0.16, 0), C.brass]]),
    // --- a grave
    mound: P([[ball(1, 14, 8).scale(0.8, 0.26, 1.5), C.sandDark]]),
    stone: P([[new THREE.IcosahedronGeometry(0.14, 0).scale(1, 0.65, 1).translate(0, 0.05, 0), C.rockB]]),
    // --- the ribs of a great beast (past the edge): a vertebra (the spine along x), a rib arching over z, the skull
    vertebra: P([[cyl(0.2, 0.2, 0.34, 8).rotateZ(Math.PI / 2), C.bone], [cone(0.07, 0.38, 6).translate(0, 0.15, 0), C.bone]]),
    rib: P([[ring(1, 0.075, 5, 16, Math.PI * 0.9).rotateY(Math.PI / 2), C.bone]]),
    skull: P([
      [ball(0.5, 12, 8).scale(1.7, 0.66, 0.8).translate(0, 0.25, 0), C.bone], [ball(0.1, 6, 4).translate(-0.2, 0.42, 0.3), C.lacquer], [ball(0.1, 6, 4).translate(-0.2, 0.42, -0.3), C.lacquer],
      [cone(0.13, 0.8, 8).rotateX(-1.0).translate(-0.4, 0.4, -0.3), C.bone], [cone(0.13, 0.8, 8).rotateX(1.0).translate(-0.4, 0.4, 0.3), C.bone],
      [box(0.7, 0.08, 0.5, 0.55, 0.06), C.bone],
    ]),
  };
}

type Pr = ReturnType<typeof makeProtos>;
type Op = { k: 's' | 'f'; p: Proto; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; tilt: number; roll: number };
/** One scene in its own frame (+z towards the camera, -z the rock behind it): its parts and its footprint. */
class Recipe {
  ops: Op[] = [];
  items: { x: number; z: number; r: number; h: number }[] = [];
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
  get reach() { let m = 0; for (const it of this.items) m = Math.max(m, Math.hypot(it.x, it.z) + it.r); return m; }
}

/** The scene kinds. `backed`: a rock is right north of the scene (its tall part may stand); `far`: past the walkable edge. */
type Make = (rc: Recipe, P: Pr, r: () => number, o: { backed: boolean; far: boolean }) => void;
const KINDS: Record<string, Make> = {
  // An ambushed caravan: crates (one open, its goods out), split sacks and their spice in coloured heaps, the awning torn down, a dropped
  // lantern, arrows in the sand; against a rock the cart itself on its side, a wheel up in the air.
  caravan: (rc, P, r, o) => {
    if (o.backed) {
      rc.s(P.cartSide, 0, 0, 0, (r() - 0.5) * 0.2).item(0, 0, 1.4, 1.6);
      rc.pole(P.poleWood, 1.25, 0.12, 0.05, 2.9, 0.05, 0.7, 0.05).pole(P.poleWood, 1.25, 0.45, 0.05, 2.7, 0.05, 1.3, 0.05).item(2.1, 0.75, 0.85, 0.45);
    }
    const z0 = o.backed ? 1.9 : 0;
    const cloth = r() < 0.5 ? P.clothTurq : P.clothWine;
    rc.f(cloth, -1.2, 0.02, z0 + 0.6, 0.3 + r() * 0.4, 1, 1, 1, 0, 0.04).item(-1.2, z0 + 0.6, 1.6, 0.1);
    rc.pole(P.poleWood, -2.4, 0.05, z0 - 0.4, -0.2, 0.05, z0 + 0.1, 0.045);
    rc.s(P.crate, 1.0, 0, z0 - 0.2, r() * 2).item(1.0, z0 - 0.2, 0.45, 0.52);
    if (r() < 0.7) { rc.s(P.crate, 1.55, 0.27, z0 + 0.3, r() * 2, 0.9, 0.9, 0.9, Math.PI / 2).item(1.6, z0 + 0.3, 0.45, 0.55); }
    rc.s(P.crateOpen, 0.3, 0, z0 + 1.2, r() * 2).item(0.3, z0 + 1.2, 0.45, 0.48);
    rc.s(P.lid, 0.6, 0, z0 + 2.0, r() * 3, 1, 1, 1, 0.08);
    const heaps = [P.heapRed, P.heapOchre, P.heapGrain, P.heapTurq];
    for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) {
      const a = 1.5 + k * 1.3 + r() * 0.5, d = 2.0 + r() * 0.4, x = Math.cos(a) * d, z = z0 + Math.sin(a) * d * 0.8;
      rc.s(heaps[(k + Math.floor(r() * 4)) % 4], x + 0.25, 0, z + 0.1, 0, 0.8 + r() * 0.4, 1, 0.8 + r() * 0.4);
      rc.s(k % 2 ? P.sackHide : P.sack, x - 0.25, 0, z - 0.1, r() * 6).item(x, z, 0.75, 0.32);
    }
    rc.s(P.lantern, -0.4, 0, z0 + 2.1, r() * 6).item(-0.4, z0 + 2.1, 0.3, 0.25);
    if (!o.backed) rc.s(P.wheelFlat, 2.4, 0, z0 + 1.0, r() * 3, 1, 1, 1, 0.08).item(2.4, z0 + 1.0, 0.8, 0.2);
    for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k++) rc.s(P.arrow, -0.2 + r() * 1.8, 0, z0 + 0.2 + r() * 1.6, r() * 6, 1, 1, 1, 0.35 + r() * 0.3);
    rc.item(0.6, z0 + 1.0, 1.1, 0.5);
  },
  // An abandoned dig: a pit's dark floor, its pegged rope, the spoil heap with a sieve on it, baskets (one tipped), tools, finds.
  dig: (rc, P, r) => {
    rc.f(P.pit, 0, 0, 0, (r() - 0.5) * 0.3).item(0, 0, 2.35, 0.42);
    for (const [x, z] of [[-1.8, -1.4], [1.8, -1.4], [1.8, 1.4], [-1.8, 1.4]]) rc.s(P.peg, x, 0, z);
    const pegs = [[-1.8, -1.4], [1.8, -1.4], [1.8, 1.4], [-1.8, 1.4]];
    for (let k = 0; k < 4; k++) { if (k === 2 && r() < 0.5) continue; const [ax, az] = pegs[k], [bx, bz] = pegs[(k + 1) % 4]; rc.beam(P.unitRope, ax, 0.33, az, bx, 0.33, bz, 0.025); }
    rc.s(P.drift, 2.9, -0.05, -0.4, r(), 1.1, 0.42, 0.9).item(2.9, -0.4, 1.1, 0.4);
    rc.s(P.sieve, 2.7, 0.22, -0.2, 0.4, 1, 1, 1, -0.45).item(2.7, -0.2, 0.55, 0.5);
    rc.s(P.basket, -2.5, 0, 0.6).item(-2.5, 0.6, 0.3, 0.36);
    rc.s(P.basketLying, -2.3, 0, -0.6 + r() * 0.3, r() * 6).item(-2.1, -0.6, 0.6, 0.3);
    rc.s(P.ladder, 0.3, 0, 2.2, Math.PI / 2 + (r() - 0.5) * 0.3).item(0.3, 2.2, 1.3, 0.1);
    rc.s(r() < 0.5 ? P.shovel : P.pick, -1.0, 0, -2.0, 1.2 + r()).item(-1.0, -2.0, 0.7, 0.08);
    rc.f(P.sherds, -0.5 + r(), 0.02, 0.2 - r() * 0.5, r() * 6);
  },
  // A dry well, its windlass fallen: a ring of dressed blocks with two gone (lying by it), the dark hole, the posts and the drum on the
  // sand, the bucket on its side, a jar.
  well: (rc, P, r) => {
    const gap = Math.floor(r() * 9);
    for (let k = 0; k < 9; k++) {
      if (k === gap || k === (gap + 1) % 9) continue;
      const a = (k / 9) * Math.PI * 2;
      rc.s(P.block, Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95, a);
    }
    rc.item(0, 0, 1.35, 0.5);
    rc.f(P.hole, 0, 0.01, 0);
    const ga = ((gap + 0.5) / 9) * Math.PI * 2;
    rc.s(P.block, Math.sin(ga) * 1.9, 0, Math.cos(ga) * 1.9, ga + 0.6, 1, 1, 1, 0.15, 0.1).item(Math.sin(ga) * 1.9, Math.cos(ga) * 1.9, 0.45, 0.5);
    rc.s(P.block, Math.sin(ga + 0.5) * 2.5, -0.1, Math.cos(ga + 0.5) * 2.5, ga - 0.4, 1, 1, 1, Math.PI / 2).item(Math.sin(ga + 0.5) * 2.5, Math.cos(ga + 0.5) * 2.5, 0.45, 0.55);
    const side = r() < 0.5 ? 1 : -1;
    rc.s(P.postLying, side * 1.7, 0, -0.3, 0.2 * side).item(side * 1.7, -0.3, 0.9, 0.15);
    rc.s(P.postLying, side * 2.3, 0, 0.6, -0.5 * side).item(side * 2.3, 0.6, 0.9, 0.15);
    rc.s(P.drum, side * 1.4, 0, 1.6, 0.4 * side).item(side * 1.4, 1.6, 0.75, 0.4);
    rc.beam(P.unitRope, side * 1.0, 0.15, 1.5, 0.2 * side, 0.03, 0.4, 0.03);
    rc.s(P.bucketLying, -side * 1.5, 0, 1.0, r() * 6).item(-side * 1.5, 1.0, 0.4, 0.4);
    if (r() < 0.7) rc.s(P.jarLying, -side * 1.9, 0, -0.6, r() * 6).item(-side * 1.9, -0.6, 0.5, 0.56);
  },
  // A travellers' rest: a rug, a brass tea tray with its cups, cushions, a cold fire ring with a kettle, a pack and a staff; against a
  // rock, a lean-to over it.
  rest: (rc, P, r, o) => {
    const z0 = o.backed ? 1.0 : 0;
    if (o.backed) rc.s(P.leanTo, 0, 0, 0).item(0.65, 0.35, 0.9, 1.85).item(-0.65, 0.35, 0.9, 1.85);
    rc.f(P.rug, 0, 0, z0, (r() - 0.5) * 0.3).item(0, z0, 1.35, 0.05);
    rc.s(P.teaTray, 0.15, 0.035, z0 + 0.1, r() * 6);
    rc.s(P.cushionWine, -0.75, 0.03, z0 - 0.35, 0.3).s(P.cushionTurq, 0.8, 0.03, z0 - 0.4, -0.2);
    if (r() < 0.6) rc.s(r() < 0.5 ? P.cushionWine : P.cushionTurq, -0.6, 0.03, z0 + 0.55, 1.2);
    rc.item(0, z0, 1.2, 0.3);
    rc.s(P.fireRing, 1.9, 0, z0 + 1.2).item(1.9, z0 + 1.2, 0.6, 0.12);
    rc.s(P.kettle, 1.75, 0.08, z0 + 1.1, r() * 6);
    rc.s(P.pack, -1.6, 0, z0 + 0.9, 0.5 + r()).item(-1.6, z0 + 0.9, 0.4, 0.38);
    if (r() < 0.6) rc.s(P.staff, 0.2, 0, z0 + 1.5, r() * 0.6 - 0.3).item(0.2, z0 + 1.5, 0.95, 0.06);
  },
  // A sundial on its plinth and the obelisk beside it broken: the stump, two lengths of shaft lying, the gilt-tipped cap.
  sundial: (rc, P, r) => {
    rc.s(P.dial, 0, 0, 0, r() * 6).item(0, 0, 0.85, 0.36);
    const s = r() < 0.5 ? 1 : -1;
    rc.s(P.stump, s * 2.4, 0, -0.6, r()).item(s * 2.4, -0.6, 0.55, 0.55);
    rc.s(P.shaft, s * 2.6, 0, 1.0, Math.PI / 2 + 0.25 * s, 1, 1, 1, 0, 0.04).item(s * 2.6, 1.0, 0.95, 0.5);
    rc.s(P.shaftShort, s * 1.1, 0, 2.1, 0.9 * s).item(s * 1.1, 2.1, 0.7, 0.47);
    rc.s(P.pyramidion, -s * 0.6, 0, 2.6, Math.PI + 0.5 * s).item(-s * 0.6, 2.6, 0.62, 0.4);
    for (let k = 0; k < 4; k++) rc.s(P.chunk, s * (1.6 + r() * 1.5), 0, -0.2 + r() * 2.2, r() * 6, 0.6 + r() * 0.6);
    rc.item(s * 2.3, 0.9, 1.5, 0.2);
  },
  // A fight's aftermath: a round shield and a curved sword dropped, a helmet rolled away, a spear snapped, arrows standing in the sand.
  fight: (rc, P, r) => {
    rc.f(P.standard, -0.4, 0.02, 1.4, 0.5 + r() * 0.6).item(-0.4, 1.4, 1.5, 0.08);
    rc.s(P.shield, 0, 0.0, 0, r() * 6, 1.3, 1, 1.3, 0.1).item(0, 0, 0.7, 0.15);
    rc.s(P.sword, 1.1, 0, 0.5, r() * 6, 1.3).item(1.1, 0.5, 0.6, 0.06);
    rc.s(P.helmet, -1.4, 0.17, 0.2, r() * 6, 1.25, 1.25, 1.25, 1.2).item(-1.4, 0.2, 0.36, 0.4);
    const a = r() * 6;
    rc.s(P.spearHalf, 0.6, 0, -1.4, a).s(P.spearButt, -0.6, 0, -1.6, a + 0.5).item(0, -1.5, 1.1, 0.06);
    for (let k = 0, n = 5 + Math.floor(r() * 5); k < n; k++) {
      const x = -2.2 + r() * 4.4, z = -0.4 + r() * 2.4;
      rc.s(P.arrow, x, 0, z, 2.6 + (r() - 0.5) * 0.6, 1.15, 1.15, 1.15, 0.3 + r() * 0.35);
    }
    rc.item(0, 0.8, 2.3, 0.5);
  },
  // A shrine at a fork: a cairn under a turquoise cloth, offering bowls, candle stubs, a brass plate leaned on it.
  shrine: (rc, P, r) => {
    rc.s(P.cairn, 0, 0, 0, r() * 6, 1.2, 1.1, 1.2).item(0, 0, 0.7, 0.52);
    for (let k = 0, n = 3 + Math.floor(r() * 2); k < n; k++) { const a = Math.PI * (0.15 + 0.7 * (k / (n - 1))); rc.s(P.bowl, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0, r() * 6, 1.3); }
    rc.f(P.rugSmall, 0, 0.005, 0.9, 0);
    rc.s(P.candles, 0.45, 0, 0.45).s(P.candles, -0.5, 0, 0.35, 1);
    rc.s(P.plate, 0, 0, 0.62, 0, 1.3);
    rc.item(0, 0.6, 1.3, 0.2);
  },
  // A grave: a long mound ringed with stones, a helmet laid on it, a sword across it, a small cairn at its head.
  grave: (rc, P, r) => {
    rc.s(P.mound, 0, 0, 0, 0).item(0, 0, 1.95, 0.28);
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; rc.s(P.stone, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.75, r() * 6, 0.8 + r() * 0.5); }
    rc.s(P.helmet, 0, 0.22, -0.5, r() * 0.5, 1, 1, 1, 0.12);
    rc.s(P.sword, -0.05, 0.2, 0.55, Math.PI / 2 + (r() - 0.5) * 0.4, 1, 1, 1, 0, 0.08);
    rc.s(P.cairn, 0, 0, -2.1, r() * 6, 0.55, 0.7, 0.55).item(0, -2.1, 0.4, 0.33);
  },
  // A jackal's head in black stone half buried in a drift, a paw further off (an animal, never a person).
  jackal: (rc, P, r, o) => {
    const s = o.far ? 1.35 + r() * 0.3 : 1;
    const yaw = (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.6;
    rc.s(P.drift, -Math.cos(yaw) * 0.6 * s, -0.12, 0.3, yaw, (o.far ? 2.4 : 1.6) * s, 0.4 * s, (o.far ? 1.7 : 1.2) * s);
    rc.s(P.jackal, 0, -0.1 * s, 0, yaw, s, s, s, 0, 0.1).item(0, 0, 1.75 * s, 0.95 * s);
    if (o.far) rc.s(P.paw, 2.6 * s, -0.05, 1.2 * s, 0.4, s).item(2.6 * s, 1.2 * s, 0.6 * s, 0.4 * s);
    else rc.s(P.paw, 2.0, -0.06, 1.0, 0.4 + r() * 0.4).item(2.0, 1.0, 0.55, 0.3);
  },
  // A wagon sunk to its axles in a drift, its tongue in the air.
  wagon: (rc, P, r, o) => {
    const s = o.far ? 1.2 : 1;
    rc.s(P.wagon, 0, -0.22, 0, (r() - 0.5) * 0.3, s, s, s, 0.06, 0.08).item(0, 0, 1.7 * s, 1.05 * s);
    rc.s(P.drift, 0.4, -0.15, -0.6, 0.3, 2.4 * s, 0.7 * s, 1.3 * s);
    rc.s(P.drift, 1.6 * s, -0.1, 0.4, 0.3, 1.2 * s, 0.45 * s, 1.1 * s).item(1.6 * s, 0.4, 1.1 * s, 0.45 * s);
    if (o.far) rc.pole(P.poleWood, -1.3 * s, 0.35, 0.1, -2.8 * s, 1.2 * s, 0.4, 0.06).item(-2.2 * s, 0.3, 0.5, 1.2 * s);
    else rc.pole(P.poleWood, -1.3, 0.35, 0.1, -2.9, 0.08, 0.5, 0.06).item(-2.2, 0.3, 0.75, 0.4);
    if (!o.far) rc.s(P.sack, -0.6, 0, 1.4, r() * 6).item(-0.6, 1.4, 0.5, 0.3);
  },
  // Pots stacked at a tomb's door, one smashed, its grain spilled.
  pots: (rc, P, r) => {
    const kinds = [P.potClay, P.potCream, P.potTurq];
    // smaller than the cover's jars, so no one takes them for cover
    const at: [number, number, number][] = [[-0.5, 0, -0.1], [0, 0, -0.15], [0.5, 0, -0.1], [-0.25, 0.53, -0.12], [0.25, 0.53, -0.12]];
    if (r() < 0.6) at.push([0, 1.06, -0.12]);
    at.forEach(([x, y, z], k) => rc.s(kinds[(k + Math.floor(r() * 3)) % 3], x, y, z, r() * 6, 0.68 + r() * 0.06));
    rc.item(0, -0.1, 0.9, at.length > 5 ? 1.75 : 1.25);
    rc.s(P.potBroken, 1.1, 0, 0.6, r() * 6, 0.8).item(1.15, 0.65, 0.65, 0.24);
    rc.s(kinds[Math.floor(r() * 3)], -1.15, 0.22, 0.5, r() * 6, 0.68, 0.68, 0.68, Math.PI / 2).item(-1.15, 0.5, 0.5, 0.45);
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
    rc.item(0, 0, 5.5 * g, 2.6 * g);
  },
};

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/** Knee height: anything taller stands south of a rock or past the edge. */
export const KNEE = 0.56;

export interface SandsScenesIn {
  look: SandsLook;
  land: SandsLand;
  keep: { x: number; z: number }[];
  /** The depth's own props and pools (sandsDepth.ts `solids`), kept clear of. */
  solids: { x: number; z: number; r: number }[];
  sink: SceneSink;
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
  const roadClear = (x: number, z: number) => { let m = 1e9; for (const s of roads) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return m; };
  const coverClear = (x: number, z: number) => {
    let m = 1e9;
    for (const c of cover) {
      if ((c.ax - x > 30 && c.bx - x > 30) || (x - c.ax > 30 && x - c.bx > 30) || (c.az - z > 30 && c.bz - z > 30) || (z - c.az > 30 && z - c.bz > 30)) continue; // far: not the nearest that matters
      m = Math.min(m, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r);
    }
    return m;
  };
  const keepClear = (x: number, z: number) => { let m = 1e9; for (const k of keep) m = Math.min(m, Math.hypot(x - k.x, z - k.z)); return m; };
  const placeClear = (x: number, z: number) => { let m = 1e9; for (const p of look.places) m = Math.min(m, Math.hypot(x - p.x, z - p.z) - p.r); return m; };
  const solidClear = (x: number, z: number) => { let m = 1e9; for (const s of solids) m = Math.min(m, Math.hypot(x - s.x, z - s.z) - s.r); return m; };
  const beyond = (x: number, z: number) => land.beyond(x - RING.x, z - RING.z);
  /** A rock (or a wall) right north of the point's edge: the camera looks north, so a tall thing there hides nobody. */
  const backedAt = (x: number, z: number, r: number) => coverClear(x, z - r - 0.6) < 0.5 && coverClear(x, z) < r + 1.2;

  const placed: SceneRec[] = [];
  const used = new Map<string, number>();
  // How many of each kind this floor may have: the floor's own mix, so no two floors look alike.
  const cap: Record<string, number> = {};
  for (const k of Object.keys(KINDS)) cap[k] = 2 + Math.floor(rnd() * 2);
  cap.ribs = rnd() < 0.8 ? 1 : 0; cap.jackal = 1 + (rnd() < 0.5 ? 1 : 0); cap.pots = 2; cap.shrine = 2;
  const off = Object.keys(KINDS).filter((k) => !['ribs', 'jackal', 'shrine', 'pots'].includes(k));
  for (let k = 0; k < 2; k++) cap[off[Math.floor(rnd() * off.length)]] = 0; // two kinds this floor goes without
  cap[off[Math.floor(rnd() * off.length)]] += 2; // and one it has more of
  const left = (k: string) => (cap[k] ?? 0) - (used.get(k) ?? 0);

  const world = (rc: Recipe, x: number, z: number, yaw: number, far: boolean): SceneItem[] => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return rc.items.map((it) => ({ x: x + it.x * c + it.z * s, z: z - it.x * s + it.z * c, r: it.r, h: it.h, far }));
  };
  /** Does a scene fit here? Every part off the spots, the roads' middles, the cover, the courts, the depth's props, the other scenes. */
  const fits = (items: SceneItem[], far: boolean) => {
    for (const it of items) {
      const b = beyond(it.x, it.z);
      if (far) {
        if (b < it.r + 4 || b > 26) return false;
        const dx = it.x - RING.x, dz = it.z - RING.z;
        if (land.south(dx, dz) > 0.2 || land.steepness(dx, dz) > 0.45) return false;
      } else {
        if (b > -(it.r + 1.2)) return false;
        if (coverClear(it.x, it.z) < it.r + 0.15) return false;
        if (it.h > KNEE && !backedAt(it.x, it.z, it.r)) return false;
      }
      if (keepClear(it.x, it.z) < it.r + 3.2) return false;
      if (roadClear(it.x, it.z) < it.r + 2.2) return false;
      if (placeClear(it.x, it.z) < it.r + 2.6) return false;
      if (solidClear(it.x, it.z) < it.r + 0.4) return false;
      for (const sc of placed) for (const q of sc.items) if (Math.hypot(it.x - q.x, it.z - q.z) < it.r + q.r + 1.5) return false;
    }
    return true;
  };
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const emit = (rc: Recipe, x: number, y: number, z: number, yaw: number) => {
    M.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S.set(1, 1, 1));
    for (const op of rc.ops) {
      L.compose(V.set(op.x, op.y, op.z), Q.setFromEuler(E.set(op.tilt, op.yaw, op.roll, 'YXZ')), S.set(op.sx, op.sy, op.sz));
      sink.proto(op.k, op.p, L.premultiply(M));
    }
  };
  /** Tries one kind at one spot (a few turns); places it if it fits. */
  const tryAt = (kind: string, where: string, x: number, z: number, yaw0: number, o2: { backed?: boolean; far?: boolean; spread?: number } = {}) => {
    if (left(kind) <= 0 || placed.length >= 24) return false;
    const far = !!o2.far, backed = !!o2.backed;
    for (const sc of placed) if (Math.hypot(sc.x - x, sc.z - z) < (sc.kind === kind ? 34 : 13)) return false;
    for (let t = 0; t < 3; t++) {
      const rc = new Recipe();
      KINDS[kind](rc, P, rnd, { backed, far });
      const yaw = yaw0 + (t === 0 ? 0 : (rnd() - 0.5) * (o2.spread ?? 0.8));
      const items = world(rc, x, z, yaw, far);
      if (!fits(items, far)) continue;
      let y = 0;
      if (far) { y = 1e9; for (const it of items) for (const [ox, oz] of [[0, 0], [it.r, 0], [-it.r, 0], [0, it.r], [0, -it.r]]) y = Math.min(y, land.height(it.x + ox - RING.x, it.z + oz - RING.z)); y -= 0.15; }
      emit(rc, x, y, z, yaw);
      placed.push({ kind, where, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), items: items.map((it) => ({ ...it, x: +it.x.toFixed(2), z: +it.z.toFixed(2) })) });
      used.set(kind, (used.get(kind) ?? 0) + 1);
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
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, d = 4.2 + rnd() * 2; if (tryAt('shrine', 'fork', x + Math.cos(a) * d, z + Math.sin(a) * d, rnd() * 6)) break; }
    }
  }
  // 2. By the places that suit them: pots at the tombs, a fight by the raiders and the forts, a rest or a caravan by the serai and the
  //    oasis, a second trench by the dig.
  const SUITS: Record<string, string[]> = { tombs: ['pots'], raiders: ['fight', 'grave'], fort: ['fight', 'grave'], gatehouse: ['fight'], serai: ['caravan', 'rest'], oasis: ['rest', 'well'], dig: ['dig'], ruins: ['sundial'], well: ['well'] };
  for (const pl of shuffle(look.places.slice())) {
    const want = SUITS[pl.kind ?? ''];
    if (!want) continue;
    for (const kind of want) {
      const needsBack = kind === 'pots';
      let done = false;
      for (let k = 0; k < 40 && !done; k++) {
        const a = rnd() * Math.PI * 2, d = pl.r + 4 + rnd() * 7, x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
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
  // 3. Along the roads, on the verge: one every 45 to 60 m of road.
  const ROADSIDE = ['caravan', 'fight', 'sundial', 'well', 'rest', 'grave', 'dig'];
  let since = 20 + rnd() * 20;
  for (const s of shuffle(roads.slice())) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (len || 1), uz = (s.bz - s.az) / (len || 1);
    for (let d = 3; d < len - 3; d += 3) {
      since += 3;
      if (since < 45 + rnd() * 15) continue;
      const side = rnd() < 0.5 ? 1 : -1, cx = s.ax + ux * d, cz = s.az + uz * d;
      for (const kind of pick(ROADSIDE)) {
        let ok = false;
        for (const extra of [0.6, 1.8]) {
          const rc = new Recipe(); KINDS[kind](rc, P, rnd, { backed: false, far: false });
          const off = 2.2 + rc.reach + extra, x = cx - uz * side * off, z = cz + ux * side * off;
          if (tryAt(kind, 'road', x, z, Math.atan2(ux, uz) + (rnd() - 0.5) * 0.6)) { ok = true; break; }
        }
        if (ok) { since = 0; break; }
      }
    }
  }
  // 4. Against the rocks: the tall stories stand right south of a rock (a jackal's head, a wagon in its drift, a cart, a lean-to).
  const rocks = shuffle(cover.filter((c) => c.r >= 0.9 && beyond(c.ax, c.az) < -4));
  let backedN = 0;
  for (const c of rocks) {
    if (backedN >= 5) break;
    const t = 0.2 + rnd() * 0.6, cx = c.ax + (c.bx - c.ax) * t, cz = c.az + (c.bz - c.az) * t;
    for (const kind of pick(['jackal', 'wagon', 'caravan', 'rest'])) {
      const back = kind === 'jackal' ? 2.0 : kind === 'wagon' ? 1.9 : kind === 'caravan' ? 1.6 : 0.8;
      if (tryAt(kind, 'backed', cx, cz + c.r + back, (rnd() - 0.5) * 0.4, { backed: true, spread: 0.3 })) { backedN++; break; }
    }
  }
  // 5. The open sand between the places (a few).
  const rmax = Math.max(...rim);
  for (let k = 0, open = 0; k < 900 && open < 4; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyond(x, z) > -8 || roadClear(x, z) < 7 || placeClear(x, z) < 6) continue;
    for (const kind of pick(['sundial', 'well', 'dig', 'grave', 'fight', 'caravan', 'rest'])) if (tryAt(kind, 'open', x, z, rnd() * 6)) { open++; break; }
  }
  // 6. Past the edge, stories in the background: a great beast's ribs, a jackal's head, a wagon in the dunes (never in the south).
  for (let k = 0, far = 0; k < 160 && far < 3; k++) {
    const a = rnd() * Math.PI * 2, b = 9 + rnd() * 10, rr = rimAt(rim, a) + b, x = RING.x + Math.cos(a) * rr, z = RING.z + Math.sin(a) * rr;
    const facing = Math.atan2(RING.x - x, RING.z - z); // the scene's +z towards the middle
    for (const kind of pick(['ribs', 'jackal', 'wagon'])) if (tryAt(kind, 'far', x, z, kind === 'ribs' ? facing + Math.PI / 2 : facing, { far: true, spread: 0.5 })) { far++; break; }
  }
  return { scenes: placed, ms: +(performance.now() - t0).toFixed(1) };
}
