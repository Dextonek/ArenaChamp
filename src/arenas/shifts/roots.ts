import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Obstacle } from '../../obstacles';
import { seeded } from '../common';
import type { HazardWorld } from '../hazards/base';
import { Sparks } from '../hazards/fx';
import { REVEAL, type ShiftLook } from './base';

const STRANDS = 9;
const SPIKES = 7;

/** One root: a tube along `points`, darker toward the ground, tapering to a point at the far end. */
function strand(points: THREE.Vector3[], radius: number, rnd: () => number) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 16, radial = 6;
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Vector3();
  const bark = new THREE.Color(0x4a3320).lerp(new THREE.Color(0x2c2015), rnd());
  const moss = new THREE.Color(0x3e4f22);
  const tint = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const seg = Math.floor(i / (radial + 1)), t = seg / segs;
    curve.getPoint(t, c);
    // Tapers toward the far end, and knots along its length so it does not read as a pipe.
    const k = (1 - 0.72 * t * t) * (0.86 + 0.2 * Math.sin(t * 19 + radius * 40));
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    tint.copy(bark).multiplyScalar(0.62 + 0.55 * Math.min(1, c.y / 1.1));
    if (p.getY(i) > c.y + radius * 0.5 * k && Math.sin(t * 31 + radius * 90) > 0.2) tint.lerp(moss, 0.55);
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** A low tangle of roots along one wall, its base at y 0, built around the wall's middle so it can grow out of the ground. */
function rootWall(o: Obstacle, rnd: () => number) {
  const mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2;
  const len = Math.hypot(o.bx - o.ax, o.bz - o.az) + 2 * o.r;
  const along = new THREE.Vector3((o.bx - o.ax) / (len - 2 * o.r), 0, (o.bz - o.az) / (len - 2 * o.r));
  const across = new THREE.Vector3(along.z, 0, -along.x);
  const spot = (u: number, side: number, y: number) => new THREE.Vector3().addScaledVector(along, u * len * 0.5).addScaledVector(across, side * o.r).setY(y);
  const parts: THREE.BufferGeometry[] = [];
  // Long roots weaving along the wall, from the ground up and back down.
  for (let i = 0; i < STRANDS; i++) {
    const side = i % 2 ? 1 : -1, peak = 0.45 + rnd() * 0.65, start = -1 + rnd() * 0.25, end = 1 - rnd() * 0.25;
    const flip = rnd() < 0.5;
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const u = start + (end - start) * (flip ? 1 - t : t);
      const arch = Math.sin(t * Math.PI);
      return spot(u, side * (0.25 + rnd() * 0.75) * (t * 2 - 1 + (rnd() - 0.5)), -0.1 + arch * peak);
    });
    parts.push(strand(pts, 0.1 + rnd() * 0.08, rnd));
  }
  // Short ones rising out of the tangle, curling over: they make the top edge rough.
  for (let i = 0; i < SPIKES; i++) {
    const u = -0.85 + (i / (SPIKES - 1)) * 1.7 + (rnd() - 0.5) * 0.12, side = (rnd() - 0.5) * 1.2, top = 0.75 + rnd() * 0.4;
    const lean = (rnd() - 0.5) * 0.5;
    parts.push(strand([spot(u, side, -0.05), spot(u + lean * 0.1, side, top * 0.5), spot(u + lean * 0.3, side + lean, top), spot(u + lean * 0.42, side + lean * 1.6, top * 0.86)], 0.07 + rnd() * 0.05, rnd));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.position.set(mx, 0, mz);
  m.castShadow = m.receiveShadow = true;
  m.visible = false;
  return m;
}

/** Verdant Glade, stage 1: the roots grow out of the moss while the stage shows, and stand when it lands. */
export class RootLook implements ShiftLook {
  readonly group = new THREE.Group();
  private walls: THREE.Mesh[];
  private dirt = new Sparks(160, 0.12);
  private grow = -1;

  constructor(private cover: readonly Obstacle[]) {
    const rnd = seeded(7171);
    this.walls = cover.map((o) => rootWall(o, rnd));
    this.group.add(...this.walls, this.dirt.points);
  }

  begin(index: number) {
    if (index !== 0) return;
    this.grow = 0;
    for (const m of this.walls) {
      m.visible = true;
      m.scale.set(0.82, 0.001, 0.82);
    }
  }

  update(dt: number, _clock: number, _world: HazardWorld) {
    this.dirt.update(dt);
    if (this.grow < 0) return;
    this.grow += dt / REVEAL;
    const u = Math.min(1, this.grow);
    // Slowly at first, then a heave as it lands.
    const y = u * u * (3 - 2 * u);
    for (const m of this.walls) m.scale.set(0.82 + 0.18 * y, Math.max(0.001, y), 0.82 + 0.18 * y);
    if (u < 1) {
      for (const o of this.cover) {
        if (Math.random() < dt * 14) {
          const t = Math.random();
          this.dirt.emit(o.ax + (o.bx - o.ax) * t, 0.1, o.az + (o.bz - o.az) * t, 1, 1.6, 2.2, 0.7, 0x6a5232, 7);
        }
      }
    } else this.grow = -1;
  }
}
