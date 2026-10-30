import * as THREE from 'three';

/** A homing bolt in flight. */
interface Bolt {
  mesh: THREE.Mesh;
  trail: THREE.Mesh;
  pos: THREE.Vector3;
  aim: () => THREE.Vector3 | null;
  speed: number;
  arrive: () => void;
  last: THREE.Vector3;
}

/** A melee swing arc fading out. */
interface Slash {
  mesh: THREE.Mesh;
  t: number;
}

const SLASH_LIFE = 0.2;
const HIT_HEIGHT = 1.05;

/**
 * Generic basic-attack visuals, coloured per kit: a small glowing homing bolt with a short trail (ranged) and a quick
 * crescent swipe in front of the attacker (melee). Pooled; add `group` to the scene and call `update` every frame.
 */
export class AttackFx {
  readonly group = new THREE.Group();
  private bolts: Bolt[] = [];
  private slashes: Slash[] = [];
  private boltGeo = new THREE.IcosahedronGeometry(0.13, 1);
  private trailGeo = new THREE.CylinderGeometry(0.06, 0.005, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
  private slashGeo = new THREE.RingGeometry(1.1, 1.75, 24, 1, -Math.PI * 0.42, Math.PI * 0.84);

  /** A homing bolt from `from` to wherever `aim()` says the target is; `arrive` runs on contact (not when it is gone). */
  bolt(from: THREE.Vector3, aim: () => THREE.Vector3 | null, speed: number, color: string, arrive: () => void) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.boltGeo, mat);
    const trail = new THREE.Mesh(this.trailGeo, mat.clone());
    (trail.material as THREE.MeshBasicMaterial).opacity = 0.5;
    mesh.position.copy(from);
    this.group.add(mesh, trail);
    this.bolts.push({ mesh, trail, pos: from.clone(), aim, speed, arrive, last: from.clone() });
  }

  /** A crescent swipe in front of a figure at `at` facing `yaw`. */
  slash(at: THREE.Vector3, yaw: number, color: string) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.slashGeo, mat);
    // RingGeometry's arc is centred on +X in its XY plane: turn it to +Y, then lay it nearly flat facing forward (+Z).
    mesh.rotation.set(Math.PI / 2 - 0.25, 0, Math.PI / 2);
    const holder = new THREE.Group();
    holder.position.set(at.x, 1.0, at.z);
    holder.rotation.y = yaw;
    holder.add(mesh);
    this.group.add(holder);
    this.slashes.push({ mesh, t: 0 });
  }

  update(dt: number) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const at = b.aim();
      if (!at) {
        this.dropBolt(i);
        continue;
      }
      const goal = new THREE.Vector3(at.x, HIT_HEIGHT, at.z);
      const d = goal.clone().sub(b.pos);
      const step = b.speed * dt;
      b.last.copy(b.pos);
      if (d.length() <= step + 0.15) {
        b.arrive();
        this.dropBolt(i);
        continue;
      }
      b.pos.addScaledVector(d.normalize(), step);
      b.mesh.position.copy(b.pos);
      const len = Math.min(1.2, 0.35 + b.speed * 0.04);
      b.trail.position.copy(b.pos);
      b.trail.lookAt(b.pos.clone().add(d));
      b.trail.scale.set(1, 1, len);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t += dt;
      const k = s.t / SLASH_LIFE;
      const m = s.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.85 * (1 - k);
      s.mesh.scale.setScalar(0.85 + 0.25 * k);
      if (k >= 1) {
        const holder = s.mesh.parent!;
        this.group.remove(holder);
        m.dispose();
        this.slashes.splice(i, 1);
      }
    }
  }

  /** Removes every bolt and slash (a new round). */
  clear() {
    for (let i = this.bolts.length - 1; i >= 0; i--) this.dropBolt(i);
    for (const s of this.slashes) {
      this.group.remove(s.mesh.parent!);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.slashes = [];
  }

  private dropBolt(i: number) {
    const b = this.bolts[i];
    this.group.remove(b.mesh, b.trail);
    (b.mesh.material as THREE.Material).dispose();
    (b.trail.material as THREE.Material).dispose();
    this.bolts.splice(i, 1);
  }
}
