import * as THREE from 'three';
import { ArenaHazard, CENTER, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, Sparks } from './fx';

const WARN = 1.7; // seconds the pods swell before they burst
const CLOUD = 1.5; // seconds a burst's cloud keeps hurting
const RADIUS = 2.4;
const PAIRS = 3;

interface Pod {
  x: number;
  z: number;
  mesh: THREE.Mesh;
}

/**
 * Verdant Glade, "Spores rise": three point-symmetric pairs of spore pods swell out of the moss and burst into clouds
 * that hurt and slow anyone inside while they last.
 */
export class SporeBurst extends ArenaHazard {
  readonly warning = 'Spores rise';
  protected readonly zoneColor = 0x9ac030;
  private pods: Pod[] = [];
  private pool: THREE.Mesh[] = [];
  private cloud = new Sparks(220, 1.5);
  private motes = new Sparks(120, 0.1);
  private glows = new FloorGlows(6);
  private time = 0;

  constructor(seed: string) {
    super(seed);
    const geo = new THREE.IcosahedronGeometry(0.62, 2);
    // Lumps, so a pod does not read as a ball.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + 0.12 * Math.sin(p.getX(i) * 9) * Math.cos(p.getZ(i) * 8) + 0.08 * Math.sin(p.getY(i) * 12);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    for (let i = 0; i < PAIRS * 2; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6d8a2c, emissive: 0x4a6a10, roughness: 0.55, flatShading: true }));
      m.visible = false;
      this.pool.push(m);
      this.group.add(m);
    }
    this.group.add(this.cloud.points, this.motes.points, this.glows.group);
  }

  protected begin() {
    this.pods = [];
    for (let i = 0; i < PAIRS; i++) {
      const angle = (i / PAIRS) * Math.PI + this.rng() * 0.8;
      const r = 3 + this.rng() * 6.8;
      for (const side of [1, -1]) {
        const x = CENTER.x + Math.sin(angle) * r * side, z = CENTER.z + Math.cos(angle) * r * side;
        this.threats.push({ shape: { kind: 'circle', x, z, radius: RADIUS }, at: WARN, to: WARN + CLOUD });
        this.pods.push({ x, z, mesh: this.pool[this.pods.length] });
      }
    }
    this.duration = WARN + CLOUD + 0.1;
  }

  protected hitOf(): HazardHit {
    return { damage: 35, color: '#b6e05a', from: CENTER, slow: 1.5 };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'circle') return;
    const { x, z } = th.shape;
    this.cloud.emit(x, 0.5, z, 22, 2.2, 0.8, CLOUD + 0.6, 0x7aa02c, -0.2);
    this.motes.emit(x, 0.5, z, 18, 3, 4, 1.1, 0xb8d860, 4);
    this.glows.flash(x, z, RADIUS * 1.25, 0x5a7a18, CLOUD + 0.5, 0.42);
  }

  protected tick(dt: number, t: number, _live: boolean, _world: HazardWorld) {
    this.time += dt;
    this.cloud.update(dt);
    this.motes.update(dt);
    this.glows.update(dt);
    for (const m of this.pool) m.visible = false;
    if (t < 0) return;
    if (t < WARN) {
      const u = t / WARN;
      for (const pod of this.pods) {
        const m = pod.mesh;
        m.visible = true;
        const pulse = 1 + (0.03 + 0.09 * u) * Math.sin(this.time * (8 + 14 * u));
        const s = (0.25 + 0.95 * u * u) * pulse;
        m.scale.setScalar(s);
        m.position.set(pod.x, 0.42 * s, pod.z);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + u * 1.1;
        if (Math.random() < dt * 5) this.motes.emit(pod.x, 0.7 * s, pod.z, 1, 0.5, 1.5, 0.9, 0x9ac040, 0.5);
      }
    } else {
      // The cloud keeps feeding while it hurts.
      for (const pod of this.pods) {
        if (t < WARN + CLOUD - 0.4 && Math.random() < dt * 8) this.cloud.emit(pod.x, 0.4, pod.z, 1, 1.8, 0.7, 1.2, 0x6a9024, -0.2);
      }
    }
  }
}
