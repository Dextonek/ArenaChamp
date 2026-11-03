import * as THREE from 'three';
import { ArenaHazard, CENTER, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, GlowBeam, Sparks } from './fx';

const VENT_AT = 1.4; // seconds before the vent itself erupts
const VENT_RADIUS = 3;
const FIRST_BOMB = 1.8;
const BOMB_GAP = 0.2;
const FLIGHT = 1.1;
const BOMB_RADIUS = 2;
const ARC = 7; // metres a bomb climbs

interface Bomb {
  x: number;
  z: number;
  at: number;
  mesh: THREE.Mesh;
}

/**
 * Ember Caldera, "The vent erupts": the lava vent in the open middle blows, then throws eight lava bombs in
 * point-symmetric pairs. Leave the middle, then the circles on the floor.
 */
export class VentEruption extends ArenaHazard {
  readonly warning = 'The vent erupts';
  protected readonly zoneColor = 0xe0601a;
  private bombs: Bomb[] = [];
  private pool: THREE.Mesh[] = [];
  private column = new GlowBeam(0xffa850, 0xc0400c, 3.4);
  private sparks = new Sparks(260, 0.17);
  private glows = new FloorGlows(10);
  private time = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor(seed: string) {
    super(seed);
    const geo = new THREE.IcosahedronGeometry(0.34, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8641c });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo.clone(), mat.clone());
      m.visible = false;
      this.pool.push(m);
      this.group.add(m);
    }
    geo.dispose();
    mat.dispose();
    this.group.add(this.column.mesh, this.sparks.points, this.glows.group);
  }

  protected begin() {
    this.threats.push({ shape: { kind: 'circle', x: CENTER.x, z: CENTER.z, radius: VENT_RADIUS }, at: VENT_AT });
    this.bombs = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI + this.rng() * 0.7;
      const r = 4.6 + this.rng() * 5.4;
      const at = FIRST_BOMB + i * BOMB_GAP;
      for (const side of [1, -1]) {
        const x = CENTER.x + Math.sin(angle) * r * side, z = CENTER.z + Math.cos(angle) * r * side;
        this.threats.push({ shape: { kind: 'circle', x, z, radius: BOMB_RADIUS }, at });
        this.bombs.push({ x, z, at, mesh: this.pool[this.bombs.length] });
      }
    }
    this.duration = FIRST_BOMB + 3 * BOMB_GAP + 0.5;
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#ff8a40', from: CENTER };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'circle') return;
    const { x, z, radius } = th.shape;
    const vent = radius === VENT_RADIUS;
    this.sparks.emit(x, 0.3, z, vent ? 70 : 26, vent ? 5 : 4.5, vent ? 9 : 5.5, vent ? 1.2 : 0.8, 0xf08030);
    this.glows.flash(x, z, radius * 1.3, 0xc8500f, vent ? 1.4 : 1.1, 0.6);
  }

  protected tick(dt: number, t: number, _live: boolean, world: HazardWorld) {
    this.time += dt;
    this.sparks.update(dt);
    this.glows.update(dt);
    // The vent's column: a rising glow before it blows, a tall burst when it does.
    const burst = t >= VENT_AT ? Math.max(0, 1 - (t - VENT_AT) / 0.9) : 0;
    const build = t >= 0 && t < VENT_AT ? (t / VENT_AT) * 0.35 : 0;
    this.a.set(CENTER.x, 0, CENTER.z);
    this.b.set(CENTER.x, 2 + burst * 9 + build * 4, CENTER.z);
    this.column.set(this.a, this.b, world.camera, this.time, Math.max(burst, build), 2 + burst * 1.6);
    if (t >= 0 && t < VENT_AT && Math.random() < dt * 30) this.sparks.emit(CENTER.x, 0.2, CENTER.z, 2, 1.4, 4, 0.7, 0xe07020);
    for (const m of this.pool) m.visible = false;
    if (t < 0) return;
    for (const b of this.bombs) {
      const u = (t - (b.at - FLIGHT)) / FLIGHT;
      if (u < 0 || u >= 1) continue;
      b.mesh.visible = true;
      b.mesh.position.set(CENTER.x + (b.x - CENTER.x) * u, 0.5 + 4 * ARC * u * (1 - u) - 0.5 * u, CENTER.z + (b.z - CENTER.z) * u);
      b.mesh.rotation.x += dt * 6;
      if (Math.random() < dt * 40) this.sparks.emit(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 1, 0.3, 0.2, 0.45, 0xd86018, 2);
    }
  }
}
