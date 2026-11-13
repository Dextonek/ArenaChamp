import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, seeded } from '../../../arenas/common';
import { pillar, wall, type Obstacle } from '../../../obstacles';
import type { Spot } from '../def';

/**
 * What the zone drawings of floors 4 and 5 share (the harbour's `../zone.ts` keeps its own copy of the same ideas and is not touched):
 * a kit that collects dressing as geometry and merges it per material and per square of ground, so a zone is a few draw calls and
 * a square out of the camera's view is not drawn; the cover pieces and how they are written; a scatter of filler that keeps off the
 * paths and the places so that cover is where a way has to bend and not where a way has to go.
 */

export const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });
export const px = (x: number, c: number, ppm: number) => c + (x - RING.x) * ppm;
export const pz = (z: number, c: number, ppm: number) => c + (z - RING.z) * ppm;

export interface Piece { o: Obstacle; look: string }
/** A pillar piece at an offset from the middle: radius r, height h. */
export const P = (look: string, dx: number, dz: number, r: number, h: number): Piece => ({ look, o: { ...pillar(RING.x + dx, RING.z + dz, r), height: h } });
/** A wall piece between two offsets: half width r, height h. */
export const W = (look: string, ax: number, az: number, bx: number, bz: number, r = 0.35, h = 2.3): Piece => ({ look, o: { ...wall(RING.x + ax, RING.z + az, RING.x + bx, RING.z + bz), r, height: h } });

export type Path = [number, number][];

/** Distance from a point (offsets) to the nearest of a set of polylines (offsets). */
export function nearPath(paths: Path[], x: number, z: number) {
  let best = 1e9;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

/**
 * Filler cover: `n` pieces drawn by `make(rnd, dx, dz)` at random spots (offsets) inside `ring - rim`, at least `clear` from every path, and
 * not inside any place's plaza (`places`: offsets and radius), nor within `gap` of another filler piece or of `keep` (offsets, with a radius).
 */
export function scatter(o: { seed: number; n: number; ring: number; rim: number; paths: Path[]; clear: number; places: { dx: number; dz: number; r: number }[]; keep?: { dx: number; dz: number; r: number }[]; gap: number; make: (rnd: () => number, dx: number, dz: number) => Piece }): Piece[] {
  const rnd = seeded(o.seed), out: { dx: number; dz: number; p: Piece }[] = [];
  for (let tries = 0; out.length < o.n && tries < o.n * 80; tries++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (o.ring - o.rim), dx = Math.sin(a) * d, dz = Math.cos(a) * d;
    if (nearPath(o.paths, dx, dz) < o.clear) continue;
    if ([...o.places, ...(o.keep ?? [])].some((pl) => Math.hypot(dx - pl.dx, dz - pl.dz) < pl.r)) continue;
    if (out.some((q) => Math.hypot(q.dx - dx, q.dz - dz) < o.gap)) continue;
    out.push({ dx, dz, p: o.make(rnd, dx, dz) });
  }
  return out.map((q) => q.p);
}

/** The dressing, collected as geometry and merged per material and per square of ground `CELL` m across. */
const CELL = 24;
export class Kit {
  private cells = new Map<string, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private m = new THREE.Matrix4();
  private put(mat: THREE.Material, g: THREE.BufferGeometry) {
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3()), key = `${Math.floor(c.x / CELL)}:${Math.floor(c.z / CELL)}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, (cell = new Map()));
    let bin = cell.get(mat);
    if (!bin) cell.set(mat, (bin = []));
    bin.push(g);
  }
  private clean(geo: THREE.BufferGeometry) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  }
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) {
    const g = this.clean(geo);
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, roll, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.put(mat, g);
    return this;
  }
  build(into: THREE.Group, own: { dispose(): void }[]) {
    for (const cell of this.cells.values()) {
      for (const [mat, geos] of cell) {
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        into.add(mesh);
        own.push(merged);
      }
    }
    this.cells.clear();
  }
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
export const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);

/** What a piece is, the geometry in `Kit` terms: its yaw along a wall, its length, its middle. */
export function frame(o: Obstacle) {
  return { yaw: Math.atan2(o.bx - o.ax, o.bz - o.az), len: Math.hypot(o.bx - o.ax, o.bz - o.az), mx: (o.ax + o.bx) / 2, mz: (o.az + o.bz) / 2, r: o.r, h: o.height };
}
