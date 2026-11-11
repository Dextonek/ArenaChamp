import * as THREE from 'three';
import type { Obstacle } from '../../obstacles';
import layout from '../real/cavern.json';
import { ArenaHazard, CENTER, type HazardHit, type HazardThreat, type HazardWorld } from './base';
import { FloorGlows, Sparks } from './fx';

const FIRST_ROCK = 1.5; // seconds before the first pair lands
const ROCK_GAP = 0.22; // seconds between pairs
const RADIUS = 2;
const FALL = 0.55; // seconds a rock is in the air
const DROP = 17; // metres it falls
const ROCK = 0.62; // its size
const SHARDS = 5; // pieces a rock bursts into
const SHARD_LIFE = 0.6;
/** The cavern's cover as it starts: a rock is not sent into the middle of a piece of it. */
const COVER = (layout as { obstacles: Obstacle[] }).obstacles;

interface Rock {
  x: number;
  z: number;
  at: number;
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
}

/** One piece of a burst rock: where it is, how it flies and turns, how long it has left. */
interface Shard {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  size: number;
  left: number;
}

/** Whether (x, z) lies in a piece of cover, or within `pad` of it. */
function covered(x: number, z: number, pad: number) {
  return COVER.some((o) => {
    const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / l2)) : 0;
    return Math.hypot(x - (o.ax + dx * t), z - (o.az + dz * t)) < o.r + pad;
  });
}

/**
 * Crystal Cavern, "The roof gives": eight rocks come down from the dark above, in four point-symmetric pairs one after
 * another. Each shows its circle first, with a shadow in it that tightens and darkens as the rock nears, then a clean
 * faceted rock falls into it and bursts into pieces. Leave the circles.
 */
export class RoofGives extends ArenaHazard {
  readonly warning = 'The roof gives';
  protected readonly zoneColor = 0xa890e8;
  private rocks: Rock[] = [];
  private pool: { mesh: THREE.Mesh; shadow: THREE.Mesh }[] = [];
  private sparks = new Sparks(200, 0.18);
  private glows = new FloorGlows(8);
  /** The pieces of the burst rocks, all in one mesh. */
  private shards: THREE.InstancedMesh;
  private pieces: Shard[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();

  constructor(seed: string) {
    super(seed);
    // twelve flat faces: a clean cut stone, a little taller than wide
    const geo = new THREE.DodecahedronGeometry(ROCK, 0).scale(1, 1.25, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5d74, roughness: 0.8, flatShading: true });
    const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const dark = new THREE.MeshBasicMaterial({ color: 0x030206, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      mesh.castShadow = true;
      mesh.visible = false;
      const shadow = new THREE.Mesh(disc.clone(), dark.clone());
      shadow.renderOrder = 1;
      shadow.visible = false;
      this.pool.push({ mesh, shadow });
      this.group.add(mesh, shadow);
    }
    this.shards = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2, 0), mat.clone(), 8 * SHARDS);
    this.shards.frustumCulled = false;
    this.shards.castShadow = true;
    for (let i = 0; i < 8 * SHARDS; i++) this.pieces.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), size: 1, left: 0 });
    this.placeShards(0);
    geo.dispose();
    mat.dispose();
    disc.dispose();
    dark.dispose();
    this.group.add(this.shards, this.sparks.points, this.glows.group);
  }

  protected begin() {
    this.rocks = [];
    for (let i = 0; i < 4; i++) {
      let x = 0, z = 0;
      // a few tries from the seed for a spot that is not inside cover (both screens have the same cover)
      for (let tries = 0; tries < 6; tries++) {
        const angle = (i / 4) * Math.PI + this.rng() * 0.7, r = 2.8 + this.rng() * 7;
        x = Math.sin(angle) * r;
        z = Math.cos(angle) * r;
        if (!covered(CENTER.x + x, CENTER.z + z, 0.35)) break;
      }
      const at = FIRST_ROCK + i * ROCK_GAP;
      for (const side of [1, -1]) {
        const p = this.pool[this.rocks.length];
        const rock: Rock = { x: CENTER.x + x * side, z: CENTER.z + z * side, at, mesh: p.mesh, shadow: p.shadow };
        this.threats.push({ shape: { kind: 'circle', x: rock.x, z: rock.z, radius: RADIUS }, at });
        rock.shadow.position.set(rock.x, 0.045, rock.z);
        rock.mesh.rotation.set(this.rocks.length * 1.3, this.rocks.length * 2.1, 0);
        this.rocks.push(rock);
      }
    }
    this.duration = FIRST_ROCK + 3 * ROCK_GAP + 0.7;
  }

  protected hitOf(): HazardHit {
    return { damage: 45, color: '#cdbcff', from: CENTER };
  }

  protected landed(th: HazardThreat) {
    if (th.shape.kind !== 'circle') return;
    const { x, z, radius } = th.shape;
    // the rock bursts: its pieces fly, stone dust, a few chips of crystal (looks only, so `Math.random`)
    for (let k = 0; k < SHARDS; k++) {
      const sh = this.pieces[this.cursor = (this.cursor + 1) % this.pieces.length];
      const a = ((k + Math.random() * 0.7) / SHARDS) * Math.PI * 2, out = 2.2 + Math.random() * 2.4;
      sh.pos.set(x, 0.45, z);
      sh.vel.set(Math.sin(a) * out, 3.4 + Math.random() * 2.6, Math.cos(a) * out);
      sh.spin.set(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5);
      sh.size = 0.8 + Math.random() * 0.9;
      sh.left = SHARD_LIFE;
    }
    this.sparks.emit(x, 0.35, z, 16, 4.4, 4.2, 0.75, 0x7f7a98);
    this.sparks.emit(x, 0.45, z, 7, 3, 5.6, 0.85, 0x8050d8);
    this.glows.flash(x, z, radius * 1.15, 0x4e4478, 0.6, 0.4);
  }

  /** Moves the burst rocks' pieces: they fly out, fall and shrink away. */
  private placeShards(dt: number) {
    const d = this.dummy;
    this.pieces.forEach((sh, i) => {
      if (sh.left > 0) {
        sh.left -= dt;
        sh.vel.y -= 16 * dt;
        sh.pos.addScaledVector(sh.vel, dt);
        if (sh.pos.y < 0.12) {
          sh.pos.y = 0.12;
          sh.vel.set(0, 0, 0);
        }
      }
      const k = Math.max(0, sh.left / SHARD_LIFE);
      d.position.copy(sh.pos);
      d.rotation.set(sh.spin.x * k, sh.spin.y * k, sh.spin.z * k);
      d.scale.setScalar(sh.left > 0 ? sh.size * Math.min(1, k * 2.5) : 0);
      d.updateMatrix();
      this.shards.setMatrixAt(i, d.matrix);
    });
    this.shards.instanceMatrix.needsUpdate = true;
  }

  protected tick(dt: number, t: number, _live: boolean, _world: HazardWorld) {
    this.sparks.update(dt);
    this.glows.update(dt);
    this.placeShards(dt);
    for (const p of this.pool) p.mesh.visible = p.shadow.visible = false;
    if (t < 0) return;
    for (const b of this.rocks) {
      const mat = b.shadow.material as THREE.MeshBasicMaterial;
      if (t < b.at) {
        // the shadow: wide and faint while the rock is high, tight and dark as it arrives
        const k = t / b.at, near = k * k;
        b.shadow.visible = true;
        b.shadow.scale.setScalar(RADIUS * 0.92 + (ROCK * 1.25 - RADIUS * 0.92) * near);
        mat.opacity = 0.14 + 0.5 * near;
      } else if (t < b.at + 0.3) {
        b.shadow.visible = true;
        b.shadow.scale.setScalar(ROCK * 1.25);
        mat.opacity = 0.64 * (1 - (t - b.at) / 0.3);
      }
      const u = (t - (b.at - FALL)) / FALL;
      if (u < 0 || u >= 1) continue;
      b.mesh.visible = true;
      b.mesh.position.set(b.x, ROCK + DROP * (1 - u * u), b.z);
      b.mesh.rotation.x += dt * 2.2;
      b.mesh.rotation.z += dt * 1.4;
    }
  }
}
