import * as THREE from 'three';
import type { TelegraphSpec } from '../../effects/telegraph';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, GlowBeam, Sparks } from './fx';

const WARN = 1.5; // seconds the rifts show before the ice breaks
const WAVE = 15; // m/s the spikes run along a rift
const WIDTH = 2.1;
const STEP = 1.7; // one threat per this many metres
const SHARDS_PER_STEP = 3;
const MAX_SHARDS = 72;
const HOLD = 0.75; // seconds a spike stands
const RISE = 0.11;
const SINK = 0.3;

interface Rift {
  a: THREE.Vector3;
  b: THREE.Vector3;
  length: number;
}

interface Shard {
  x: number;
  z: number;
  height: number;
  turn: number;
  tilt: number;
  tiltDir: number;
  at: number;
}

/**
 * Frostfall Lake, "The ice splits": two parallel rifts open across the lake, then a wave of ice spikes runs down each,
 * from opposite ends. The spikes hurt and slow. Stand between the rifts or outside them.
 */
export class IceRift extends ArenaHazard {
  readonly warning = 'The ice splits';
  protected readonly zoneColor = 0x3aa8d8;
  private rifts: Rift[] = [];
  private shards: Shard[] = [];
  private mesh: THREE.InstancedMesh;
  private cracks = [new GlowBeam(0x8fe0ff, 0x1f6a9a, 0.5), new GlowBeam(0x8fe0ff, 0x1f6a9a, 0.5)];
  private sparks = new Sparks(170, 0.13);
  private glows = new FloorGlows(10);
  private dummy = new THREE.Object3D();
  private time = 0;

  constructor(seed: string) {
    super(seed);
    const geo = new THREE.ConeGeometry(0.3, 1, 5, 1).translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6fb4d8, emissive: 0x1a4e72, roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_SHARDS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh, this.sparks.points, this.glows.group, ...this.cracks.map((c) => c.mesh));
  }

  protected begin() {
    const angle = this.rng() * Math.PI * 2;
    const offset = 2.6 + this.rng() * 2.4;
    const along = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3(along.z, 0, -along.x);
    const half = Math.sqrt(REACH * REACH - offset * offset);
    this.rifts = [1, -1].map((side) => {
      // Opposite ends: the event is point-symmetric about the ring's centre.
      const mid = CENTER.clone().addScaledVector(across, offset * side);
      return {
        a: mid.clone().addScaledVector(along, -half * side),
        b: mid.clone().addScaledVector(along, half * side),
        length: half * 2,
      };
    });
    this.shards = [];
    for (const r of this.rifts) {
      const dir = r.b.clone().sub(r.a).normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      for (let d = 0; d < r.length; d += STEP) {
        const end = Math.min(r.length, d + STEP);
        const at = WARN + d / WAVE;
        const p0 = r.a.clone().addScaledVector(dir, d), p1 = r.a.clone().addScaledVector(dir, end);
        this.threats.push({ shape: { kind: 'line', x1: p0.x, z1: p0.z, x2: p1.x, z2: p1.z, width: WIDTH }, at, to: at + 0.25 });
        for (let k = 0; k < SHARDS_PER_STEP && this.shards.length < MAX_SHARDS; k++) {
          const u = d + this.rng() * STEP, v = (this.rng() - 0.5) * WIDTH * 0.8;
          const p = r.a.clone().addScaledVector(dir, u).addScaledVector(side, v);
          this.shards.push({
            x: p.x, z: p.z, height: (1 - Math.abs(v)) * 0.8 + 0.8 + this.rng() * 0.7, turn: this.rng() * 6.28,
            tilt: 0.05 + this.rng() * 0.3, tiltDir: this.rng() * 6.28, at: WARN + u / WAVE,
          });
        }
      }
    }
    this.duration = WARN + this.rifts[0].length / WAVE + HOLD + SINK + 0.1;
  }

  protected telegraphs(): TelegraphSpec[] {
    return this.rifts.map((r) => ({
      shape: { kind: 'line', x1: r.a.x, z1: r.a.z, x2: r.b.x, z2: r.b.z, width: WIDTH } as const,
      start: 0, impact: WARN, until: WARN + r.length / WAVE,
    }));
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#9fe0ff', from: CENTER, slow: 1.5 };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'line') return;
    const x = th.shape.x1, z = th.shape.z1;
    this.sparks.emit(x, 0.3, z, 7, 3, 4.2, 0.6, 0xa8e0ff);
    this.glows.flash(x, z, 2.1, 0x3a8cc0, 0.7, 0.5);
  }

  protected tick(dt: number, t: number, _live: boolean, world: HazardWorld) {
    this.time += dt;
    this.sparks.update(dt);
    this.glows.update(dt);
    if (t < 0) {
      this.mesh.count = 0;
      for (const c of this.cracks) c.mesh.visible = false;
      return;
    }
    // The cracks glow brighter until the ice breaks, then go out with the spikes.
    const glow = t < WARN ? 0.2 + 0.7 * (t / WARN) : Math.max(0, 0.9 - (t - WARN) * 1.1);
    this.rifts.forEach((r, i) => {
      r.a.y = r.b.y = 0.06;
      this.cracks[i].set(r.a, r.b, world.camera, this.time, glow, 0.5 + 0.25 * Math.sin(this.time * 18), true);
    });
    let n = 0;
    for (const s of this.shards) {
      const age = t - s.at;
      if (age < 0 || age > RISE + HOLD + SINK) continue;
      const up = age < RISE ? age / RISE : age < RISE + HOLD ? 1 : 1 - (age - RISE - HOLD) / SINK;
      this.dummy.position.set(s.x, 0, s.z);
      this.dummy.rotation.set(Math.sin(s.tiltDir) * s.tilt, s.turn, Math.cos(s.tiltDir) * s.tilt);
      this.dummy.scale.set(0.8 + up * 0.5, Math.max(0.001, s.height * up), 0.8 + up * 0.5);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n++, this.dummy.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
