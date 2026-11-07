import * as THREE from 'three';
import type { CastStyle } from '../../heroFigure';

/** What a boss's body is doing this frame (`HeroFigure.follow`). */
export interface BodyState {
  dt: number;
  /** Seconds this figure has run. */
  time: number;
  /** Its walk (m/s): along its facing, to its left, and in all. */
  fwd: number;
  side: number;
  speed: number;
  moving: boolean;
  /** The move it is casting: `t` seconds in, of `dur`, then 0.3 s to settle. */
  cast: { style: CastStyle; t: number; dur: number; big: boolean } | null;
  /** The flinch from the last hit, about -0.3..0.3, springing back to 0. */
  hit: number;
  /** It kneels: the gauge filled, or a mechanic put it down. */
  kneeling: boolean;
  /** Which of its fight's phases this is, from 0. */
  phase: number;
  /** The fight is over and it falls, 0..1, or -1. */
  fall: number;
}

/** Poses a boss's rigid parts for one frame. Parts start each frame at rest, so a look only says what differs. */
export type BodyLook = (s: BodyState, parts: BodyParts) => void;

const EULER = new THREE.Euler();
const TURN = new THREE.Quaternion();

/** A boss model's named parts, each a rigid node with its pivot where it should turn. A name the model lacks is simply skipped. */
export class BodyParts {
  private nodes = new Map<string, { node: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; mats: THREE.MeshStandardMaterial[]; glow: number[] }>();

  constructor(root: THREE.Object3D) {
    root.traverse((o) => {
      if (!o.name || this.nodes.has(o.name)) return;
      const mats: THREE.MeshStandardMaterial[] = [];
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.isMeshStandardMaterial && std.emissiveIntensity !== undefined) mats.push(std);
        }
      });
      this.nodes.set(o.name, { node: o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), mats, glow: mats.map((m) => m.emissiveIntensity) });
    });
  }

  /** Every part back at rest, and its glow as it loaded. */
  reset() {
    for (const n of this.nodes.values()) {
      n.node.position.copy(n.p);
      n.node.quaternion.copy(n.q);
      n.node.scale.copy(n.s);
      n.mats.forEach((m, i) => { m.emissiveIntensity = n.glow[i]; });
    }
  }

  /** The node itself, for what these calls can't say. */
  node(name: string) {
    return this.nodes.get(name)?.node;
  }

  /** Moves a part this far from rest, in its parent's space (metres: x its left, y up, z its front). */
  move(name: string, x: number, y: number, z: number) {
    this.nodes.get(name)?.node.position.add(new THREE.Vector3(x, y, z));
  }

  /** Turns a part on top of its rest pose (radians), about its own axes. */
  turn(name: string, x: number, y: number, z: number) {
    const n = this.nodes.get(name);
    if (n) n.node.quaternion.multiply(TURN.setFromEuler(EULER.set(x, y, z)));
  }

  /** Scales a part from rest, or hides it at 0. */
  size(name: string, s: number) {
    const n = this.nodes.get(name);
    if (!n) return;
    n.node.scale.copy(n.s).multiplyScalar(s);
    n.node.visible = s > 0;
  }

  /** Multiplies the glow of a part's materials (and of the parts under it) by this, from how it loaded. */
  glow(name: string, by: number) {
    const n = this.nodes.get(name);
    if (n) n.mats.forEach((m, i) => { m.emissiveIntensity = n.glow[i] * by; });
  }
}
