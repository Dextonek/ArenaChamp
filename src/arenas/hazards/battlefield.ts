import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, Sparks } from './fx';

const WARN = 1.5; // seconds the strips show before the first pair's arrows land
const STEP = 0.6; // seconds between one pair and the next
const WIDTH = 1.7;
const HOLD = 0.25; // how long a strip hurts
const SPACING = [4.6, 0.6]; // metres from one strip to the next: at least, and how much more at most (lanes of about 3 m between them)
const FIRST = [1.8, 0.8]; // the first strip's distance from the centre line: a lane stays open through the middle
const MAX_ARROWS = 132;
const PER_STRIP = 22;
const LENGTH = 1.55; // an arrow, at the heroes' size and a little over: it must read from the game's camera
const DEPTH = 0.24; // how deep its point stands in the ground
const FALL = 0.3; // seconds an arrow is seen coming down
const SPEED = 44; // m/s
const STAND = 1.0; // seconds it stands
const SINK = 0.35; // seconds it takes to go
const LEAN = 0.34; // how far from upright the volley comes in (the tail's lean along the strip)

interface Arrow {
  x: number;
  z: number;
  /** From the point to the nock. */
  tail: THREE.Vector3;
  at: number;
}

/** One arrow, its point at the origin and its shaft up y: a pale shaft, a dark head, three blue feathers. */
function arrowGeometry() {
  const paint = (g: THREE.BufferGeometry, color: number) => {
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const parts = [
    paint(new THREE.CylinderGeometry(0.02, 0.02, LENGTH, 5, 1).translate(0, LENGTH / 2, 0), 0xb8a078),
    paint(new THREE.ConeGeometry(0.05, 0.22, 5, 1).rotateX(Math.PI).translate(0, 0.11, 0), 0x4a4e58),
  ];
  for (let k = 0; k < 3; k++) {
    // a feather: a thin leaf standing off the shaft near the nock
    const f = new THREE.BoxGeometry(0.085, 0.3, 0.012).translate(0.058, LENGTH - 0.21, 0).rotateY((k * Math.PI * 2) / 3);
    parts.push(paint(f, 0x3f66a8));
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * Fallen Battlefield, "Arrows fall": a volley comes down in six strips across the field, three on one side of the
 * centre line and their three twins turned half round the centre, one pair after another (from the middle outward or
 * from the rim inward). The strips show first; then the arrows land along them and stand in the ground for a moment.
 * Stand in the lanes between the strips. It hurts and does not slow.
 */
export class ArrowsFall extends ArenaHazard {
  readonly warning = 'Arrows fall';
  protected readonly zoneColor = 0x6f9fe0;
  private arrows: Arrow[] = [];
  private mesh: THREE.InstancedMesh;
  private sparks = new Sparks(110, 0.11);
  private glows = new FloorGlows(12);
  private dummy = new THREE.Object3D();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private last = 0;

  constructor(seed: string) {
    super(seed);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, emissive: 0x2a2620, emissiveIntensity: 0.6 });
    this.mesh = new THREE.InstancedMesh(arrowGeometry(), mat, MAX_ARROWS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.group.add(this.mesh, this.sparks.points, this.glows.group);
  }

  protected begin() {
    const angle = this.rng() * Math.PI * 2;
    const along = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3(along.z, 0, -along.x);
    const offsets = [FIRST[0] + this.rng() * FIRST[1]];
    for (let k = 1; k < 3; k++) offsets.push(offsets[k - 1] + SPACING[0] + this.rng() * SPACING[1]);
    const inward = this.rng() < 0.5;
    this.arrows = [];
    this.last = 0;
    offsets.forEach((offset, k) => {
      const at = WARN + (inward ? 2 - k : k) * STEP;
      const half = Math.sqrt(Math.max(1, REACH * REACH - offset * offset));
      for (const side of [1, -1]) {
        // the twin: the same strip turned half round the centre, its volley coming from the opposite side
        const mid = CENTER.clone().addScaledVector(across, offset * side);
        const a = mid.clone().addScaledVector(along, -half * side), dir = along.clone().multiplyScalar(side);
        const b = mid.clone().addScaledVector(along, half * side);
        this.threats.push({ shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: WIDTH }, at, to: at + HOLD });
        const n = Math.min(PER_STRIP, Math.round(half * 2 * 1.1));
        for (let i = 0; i < n && this.arrows.length < MAX_ARROWS; i++) {
          // one per stretch of the strip, so they stand evenly along it
          const u = ((i + this.rng()) / n) * half * 2, v = (this.rng() - 0.5) * WIDTH * 0.82;
          const p = a.clone().addScaledVector(dir, u).addScaledVector(across, v);
          const tail = new THREE.Vector3().copy(dir).multiplyScalar(-LEAN - 0.1 * this.rng()).addScaledVector(across, (this.rng() - 0.5) * 0.14);
          tail.y = 1;
          const land = at + this.rng() * 0.16;
          this.last = Math.max(this.last, land);
          this.arrows.push({ x: p.x, z: p.z, tail: tail.normalize(), at: land });
        }
      }
    });
    this.duration = this.last + STAND + SINK + 0.05;
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#bcd4ff', from: CENTER };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'line') return;
    const { x1, z1, x2, z2 } = th.shape;
    for (let k = 0; k < 4; k++) {
      const f = 0.14 + 0.24 * k, x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f;
      this.sparks.emit(x + (Math.random() - 0.5) * WIDTH * 0.6, 0.15, z + (Math.random() - 0.5) * WIDTH * 0.6, 4, 1.6, 2.2, 0.45, 0x8fa8d0);
    }
    this.glows.flash((x1 + x2) / 2, (z1 + z2) / 2, WIDTH * 1.1, 0x3f5f98, 0.5, 0.3);
  }

  protected tick(dt: number, t: number, _live: boolean, _world: HazardWorld) {
    this.sparks.update(dt);
    this.glows.update(dt);
    if (t < 0) {
      this.mesh.count = 0;
      return;
    }
    let n = 0;
    for (const a of this.arrows) {
      const age = t - a.at;
      if (age < -FALL || age > STAND + SINK) continue;
      // coming down its own line, then standing with its point in the ground, then drawn down into it
      const out = age < 0 ? -age * SPEED : age < STAND ? -DEPTH : -DEPTH - ((age - STAND) / SINK) * LENGTH;
      this.dummy.position.set(a.x, 0.02, a.z).addScaledVector(a.tail, out);
      this.dummy.quaternion.setFromUnitVectors(this.up, a.tail);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n++, this.dummy.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
