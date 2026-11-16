import * as THREE from 'three';
import type { TelegraphShape, TelegraphSpec } from '../effects/telegraph';

/** The four slots' colours on the floor and in the timing panel (Q W E R). */
export const SLOT_COLORS = ['#6fd3ff', '#9be86b', '#ffd25e', '#ff7ad1'];

const Y = 0.05;

/** A closed outline of a ground shape, as points a hair above the floor. */
function outline(s: TelegraphShape): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const arc = (x: number, z: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector3(x + Math.sin(a) * r, Y, z + Math.cos(a) * r));
    }
  };
  switch (s.kind) {
    case 'circle':
      arc(s.x, s.z, s.radius, 0, Math.PI * 2, 64);
      break;
    case 'ring':
      arc(s.x, s.z, s.outer, 0, Math.PI * 2, 64);
      pts.push(pts[0].clone());
      arc(s.x, s.z, s.inner, 0, Math.PI * 2, 48);
      break;
    case 'cone': {
      const half = THREE.MathUtils.degToRad(s.angle) / 2;
      pts.push(new THREE.Vector3(s.x, Y, s.z));
      arc(s.x, s.z, s.radius, s.dir - half, s.dir + half, 32);
      pts.push(new THREE.Vector3(s.x, Y, s.z));
      break;
    }
    case 'line': {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1, len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * (s.width / 2), nz = (dx / len) * (s.width / 2);
      pts.push(new THREE.Vector3(s.x1 + nx, Y, s.z1 + nz), new THREE.Vector3(s.x2 + nx, Y, s.z2 + nz),
        new THREE.Vector3(s.x2 - nx, Y, s.z2 - nz), new THREE.Vector3(s.x1 - nx, Y, s.z1 - nz), new THREE.Vector3(s.x1 + nx, Y, s.z1 + nz));
      break;
    }
  }
  return pts;
}

/**
 * What the workbench draws on the floor: each spell's reach as a ring round the hero (its cast range), and each spell's last
 * cast as the engine's own danger zones (`module.telegraphs`, the shapes the hit is judged with), outlined in the slot's
 * colour and left lying until that spell is cast again. Lines only (no fill), so the fight stays readable.
 */
export class Floor {
  readonly group = new THREE.Group();
  private rings: THREE.LineLoop[] = [];
  private ghosts: THREE.Group[] = [];
  private mats: THREE.LineBasicMaterial[];
  private dashed: THREE.LineDashedMaterial[];

  constructor() {
    this.group.name = 'workbench floor';
    this.mats = SLOT_COLORS.map((c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false }));
    this.dashed = SLOT_COLORS.map((c) => new THREE.LineDashedMaterial({ color: c, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.8, depthWrite: false }));
    for (let i = 0; i < 4; i++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
      }
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), this.dashed[i]);
      ring.computeLineDistances();
      ring.renderOrder = 5;
      this.rings.push(ring);
      const g = new THREE.Group();
      this.ghosts.push(g);
      this.group.add(ring, g);
    }
  }

  /** The reach rings round the hero: `ranges[i]` metres (0 or less: no ring). */
  reach(at: THREE.Vector3, ranges: number[], show: boolean) {
    this.rings.forEach((r, i) => {
      const m = ranges[i] ?? 0;
      r.visible = show && m > 0.05;
      if (!r.visible) return;
      r.position.set(at.x, Y + 0.01 * i, at.z);
      r.scale.set(m, 1, m);
      // the dashes keep their length in metres whatever the ring's size
      (r.material as THREE.LineDashedMaterial).dashSize = 0.35 / m;
      (r.material as THREE.LineDashedMaterial).gapSize = 0.25 / m;
    });
  }

  /** A spell's last cast: its danger zones' shapes, in its slot's colour, until it is cast again. */
  lastCast(slot: number, zones: TelegraphSpec[]) {
    const g = this.ghosts[slot];
    for (const c of [...g.children]) {
      g.remove(c);
      (c as THREE.Line).geometry.dispose();
    }
    for (const z of zones) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline(z.shape)), this.mats[slot]);
      line.renderOrder = 5;
      g.add(line);
    }
  }

  showCasts(on: boolean) {
    for (const g of this.ghosts) g.visible = on;
  }

  clearCasts() {
    for (let i = 0; i < 4; i++) this.lastCast(i, []);
  }
}
