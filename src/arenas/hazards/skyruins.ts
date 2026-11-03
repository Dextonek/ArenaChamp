import * as THREE from 'three';
import { LightningArc } from '../../effects/parts/lightningArc';
import { ArenaHazard, CENTER, REACH, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, Sparks } from './fx';

const WARN = 1.25; // seconds before the first strike of a march
const GAP = 0.27; // seconds between strikes
const COUNT = 6; // strikes per march
const RADIUS = 1.75;
const HEIGHT = 20;

/**
 * Sky Ruins, "The storm strikes": two lines of lightning march across the platform from opposite edges, zigzagging,
 * one strike after another. Each strike shows its circle first; step out of the path or wait behind the march.
 */
export class StormStrikes extends ArenaHazard {
  readonly warning = 'The storm strikes';
  protected readonly zoneColor = 0x7a8cff;
  private arcs: LightningArc[] = [];
  private strength: number[] = [];
  private sparks = new Sparks(170, 0.13);
  private glows = new FloorGlows(12);
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private cursor = 0;

  constructor(seed: string) {
    super(seed);
    for (let i = 0; i < COUNT * 2; i++) {
      const arc = new LightningArc({ width: 0.8, segments: 16, jitter: 0.09, branches: 3, core: 0xcfdcff, glow: 0x4a68e0 });
      arc.mesh.frustumCulled = false;
      arc.mesh.renderOrder = 3;
      this.arcs.push(arc);
      this.strength.push(0);
      this.group.add(arc.mesh);
    }
    this.group.add(this.sparks.points, this.glows.group);
  }

  protected begin() {
    const angle = this.rng() * Math.PI * 2;
    const along = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3(along.z, 0, -along.x);
    const lane = 2 + this.rng() * 3;
    const step = (REACH * 2 - 3) / (COUNT - 1);
    for (let i = 0; i < COUNT; i++) {
      const u = -REACH + 1.5 + i * step;
      const zig = (i % 2 ? 1 : -1) * (0.6 + this.rng() * 1.1);
      const at = WARN + i * GAP;
      // The second march is the first one turned half round the centre.
      for (const side of [1, -1]) {
        const x = CENTER.x + (along.x * u + across.x * (lane + zig)) * side;
        const z = CENTER.z + (along.z * u + across.z * (lane + zig)) * side;
        this.threats.push({ shape: { kind: 'circle', x, z, radius: RADIUS }, at });
      }
    }
    this.duration = WARN + (COUNT - 1) * GAP + 0.3;
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#bcd0ff', from: CENTER };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'circle') return;
    const { x, z } = th.shape;
    const i = this.cursor = (this.cursor + 1) % this.arcs.length;
    this.a.set(x + (Math.random() - 0.5) * 3, HEIGHT, z + (Math.random() - 0.5) * 3);
    this.b.set(x, 0.05, z);
    this.arcs[i].setEnds(this.a, this.b);
    this.strength[i] = 1;
    this.sparks.emit(x, 0.2, z, 22, 5, 4, 0.5, 0xb0c4ff);
    this.glows.flash(x, z, RADIUS * 1.35, 0x5a78e0, 0.65, 0.65);
  }

  protected tick(dt: number, _t: number, _live: boolean, _world: HazardWorld) {
    this.sparks.update(dt);
    this.glows.update(dt);
    this.arcs.forEach((arc, i) => {
      this.strength[i] = Math.max(0, this.strength[i] - dt * 3.2);
      arc.opacity = this.strength[i];
      arc.update(dt);
    });
  }
}
