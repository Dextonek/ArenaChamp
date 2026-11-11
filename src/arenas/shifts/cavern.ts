import * as THREE from 'three';
import type { TelegraphShape } from '../../effects/telegraph';
import type { Obstacle } from '../../obstacles';
import type { HazardWorld } from '../hazards/base';
import { Sparks } from '../hazards/fx';
import { ArenaShift, REVEAL, type ShiftLook } from './base';
import { POOL_STYLES, PoolLook } from './pools';
import { beyond, stages } from './tables';

/**
 * Where the roof's slabs come down: two point-symmetric pairs in the gaps of `CAVERN_OBSTACLES`, across the wing lanes
 * beside the middle and beside the starts, 2 m or more from the cover there, from each other and from both starts'
 * clear 3 m (checked with pipeline/tools/arena-check.mjs on the thirteen pieces together). They are low: the camera
 * looks over them.
 */
const SLABS: Obstacle[] = [
  { kind: 'wall', ax: 4.25, az: 7.55, bx: 6.15, bz: 6.45, r: 0.4, height: 1.1 },
  { kind: 'wall', ax: -4.25, az: 6.45, bx: -6.15, bz: 7.55, r: 0.4, height: 1.1 },
  { kind: 'wall', ax: 3.3, az: 14.2, bx: 5.5, bz: 14.2, r: 0.4, height: 1.1 },
  { kind: 'wall', ax: -3.3, az: -0.2, bx: -5.5, bz: -0.2, r: 0.4, height: 1.1 },
];
/** What being under a slab costs. */
const SLAB_HIT = 45;
/**
 * How far round a slab's line its fall hurts (m). More than the 0.9 m a hero standing there is pushed out to when the
 * slab becomes cover, which happens just before the hit is decided.
 */
const SLAB_REACH = 1.15;
/** How long a slab is in the air (s) and how far it falls (m). */
const FALL = 0.5;
const DROP = 16;

/** A strip along a wall's line, `half` wide to each side and `past` longer at each end. */
function strip(o: Obstacle, half: number, past: number): TelegraphShape {
  const len = Math.hypot(o.bx - o.ax, o.bz - o.az), ux = (o.bx - o.ax) / len, uz = (o.bz - o.az) / len;
  return { kind: 'line', x1: o.ax - ux * past, z1: o.az - uz * past, x2: o.bx + ux * past, z2: o.bz + uz * past, width: half * 2 };
}

/** One slab: a long clean block standing on its edge, its top corners cut, lying along z round its middle. */
function slabMesh(o: Obstacle, material: THREE.Material) {
  const len = Math.hypot(o.bx - o.ax, o.bz - o.az) + 2 * o.r, w = o.r, h = o.height, cut = 0.2;
  const side = new THREE.Shape();
  side.moveTo(-w + 0.04, 0);
  side.lineTo(w - 0.04, 0);
  side.lineTo(w - 0.04, h - cut - 0.04);
  side.lineTo(w - cut, h - 0.04);
  side.lineTo(-w + cut, h - 0.04);
  side.lineTo(-w + 0.04, h - cut - 0.04);
  side.closePath();
  const geo = new THREE.ExtrudeGeometry(side, { depth: len - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, steps: 1 });
  geo.translate(0, 0, -(len - 0.08) / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.set((o.ax + o.bx) / 2, 0, (o.az + o.bz) / 2);
  m.rotation.y = Math.atan2(o.bx - o.ax, o.bz - o.az);
  m.castShadow = m.receiveShadow = true;
  m.visible = false;
  return m;
}

/**
 * The cave falling in: at stage 1 four clean slabs of the roof drop into the marked gaps as the stage lands and stand
 * there as walls; from stage 2 on the rubble's band comes in from the rim (`PoolLook`, held inside this look).
 */
class CaveInLook implements ShiftLook {
  readonly group = new THREE.Group();
  readonly drawsZones = true;
  private rubble = new PoolLook(POOL_STYLES.rubble, [{}, { edge: 9 }, { edge: 6.5 }]);
  private slabs: THREE.Mesh[];
  private dust = new Sparks(120, 0.14);
  /** The fight clock when stage 1 began: -1 before it, -2 until `update` has seen it. */
  private began = -1;
  private down = false;

  constructor(private cover: readonly Obstacle[]) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x494c60, roughness: 0.82, flatShading: true });
    this.slabs = cover.map((o) => slabMesh(o, stone));
    this.group.add(this.rubble.group, ...this.slabs, this.dust.points);
  }

  begin(index: number) {
    this.rubble.begin(index);
    if (index === 0) this.began = -2;
  }

  land(index: number) {
    if (index === 0) this.settle();
  }

  /** The slabs stand; the dust of their landing goes up along each. */
  private settle() {
    if (this.down) return;
    this.down = true;
    this.slabs.forEach((m, i) => {
      const o = this.cover[i];
      m.visible = true;
      m.position.y = 0;
      m.rotation.z = 0;
      for (let k = 0; k < 6; k++) {
        const t = Math.random();
        this.dust.emit(o.ax + (o.bx - o.ax) * t, 0.2, o.az + (o.bz - o.az) * t, 4, 3.4, 2.6, 0.8, 0x7f7a98, 7);
      }
    });
  }

  update(dt: number, clock: number, world: HazardWorld) {
    this.rubble.update(dt, clock, world);
    this.dust.update(dt);
    if (this.began === -2) this.began = clock;
    if (this.began < 0 || this.down) return;
    // out of the dark above in the stage's last half second, so that they stand when it lands
    const u = (clock - this.began - (REVEAL - FALL)) / FALL;
    if (u >= 1) {
      this.settle();
      return;
    }
    this.slabs.forEach((m, i) => {
      m.visible = u >= 0;
      m.position.y = DROP * (1 - u * u);
      m.rotation.z = (i % 2 ? 0.12 : -0.12) * (1 - u);
    });
  }
}

/**
 * Crystal Cavern, "The cave falls in": first four slabs of the roof come down and stand as new low walls in the gaps
 * (they hurt whoever is under one); then the rubble closes in from the rim, to 9 m and to 6.5 m.
 */
export function cavernShift() {
  const list = stages([], [beyond(9, 1)], [beyond(6.5, 2)]);
  list[0].adds = SLABS;
  // where each will stand, and the wider strip in which its fall hurts
  list[0].marks = SLABS.map((o) => strip(o, o.r + 0.1, o.r + 0.1));
  list[0].strikes = SLABS.map((o) => ({ damage: SLAB_HIT, shape: strip(o, SLAB_REACH, SLAB_REACH) }));
  return new ArenaShift('The cave falls in', 0xa890e8, '#cdbcff', list, new CaveInLook(SLABS));
}
