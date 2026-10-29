import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * The weapon wielder: a rigged humanoid (`public/models/figures/hero.glb`, the Azure Cloud disciple from the Dao
 * Archive, made in Blender with the Dao rig) scaled to the arena figures' height. Feet at the root's origin,
 * facing +Z. Pose it every frame: `resetPose()`, then `rot(bone, axis, angle)` with axes in the figure's own
 * space (X = its left, Y = up, Z = forward), then `updateGrip()` to move the held weapon with the right hand.
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const scenes = new Map<string, Promise<THREE.Group>>();

export interface HeroOptions {
  /** Model under `public/` (default the Azure Cloud disciple). Any figure on the Dao rig works. */
  url?: string;
  /** Base-colour multiplier (the disciple's white robe needs 0.45 under bloom; dark costumes less). */
  shade?: number;
  /** Cap on the material emissive intensity (glowing props). */
  maxEmissive?: number;
  /**
   * Tint the cloth sheen with the cloth's own colour. The kit exports white sheen, which turns dark robes near-white
   * from the high gameplay camera.
   */
  tintSheen?: boolean;
}

/** The arena capsules are about 2.3 tall; the figure is 1.75 m. Hero and weapon both use this scale. */
export const HERO_SCALE = 1.3;

export type BoneName = 'pelvis' | 'chest' | 'neck' | 'head' | 'armR' | 'foreR' | 'handR' | 'armL' | 'foreL' | 'handL'
  | 'thighR' | 'shinR' | 'thighL' | 'shinL';

// glTF names ("upper_arm.R") lose their dots in three (PropertyBinding sanitises them): match loosely.
const NAMES: Record<BoneName, string> = {
  pelvis: 'pelvis', chest: 'chest', neck: 'neck', head: 'head',
  armR: 'upperarmr', foreR: 'forearmr', handR: 'handr', armL: 'upperarml', foreL: 'forearml', handL: 'handl',
  thighR: 'thighr', shinR: 'shinr', thighL: 'thighl', shinL: 'shinl',
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export class Hero {
  /** Feet at the origin, facing +Z; move and turn this. */
  readonly root = new THREE.Group();
  /** The held weapon's frame: weapon space (grip at origin, blade +Y, face +Z) at hero scale. Add the weapon here. */
  readonly grip = new THREE.Group();
  loaded = false;
  private bones = new Map<BoneName, THREE.Bone>();
  private rest = new Map<BoneName, THREE.Quaternion>();
  /** Hand-local rotation that turns the hand's frame into the weapon frame (calibrated on load). */
  private gripOffset = new THREE.Quaternion();
  private gripPoint = new THREE.Vector3(0, 0.07, 0);
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private v = new THREE.Vector3();

  constructor(opts: HeroOptions = {}) {
    this.root.scale.setScalar(HERO_SCALE);
    this.grip.scale.setScalar(HERO_SCALE);
    const url = opts.url ?? 'models/figures/hero.glb';
    const shade = opts.shade ?? 0.45, maxEmissive = opts.maxEmissive ?? 0.3;
    let load = scenes.get(url);
    if (!load) {
      load = loader.loadAsync(`${import.meta.env.BASE_URL}${url}`).then((g) => g.scene);
      scenes.set(url, load);
    }
    load.then((src) => {
      // SkeletonUtils.clone: each hero gets its own skeleton
      const scene = cloneSkinned(src);
      scene.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh;
        if (mesh.isMesh) {
          // the white robe blows out under the effects' bloom: a mid-tone figure reads better next to the glow
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
            const c = m.clone() as THREE.MeshStandardMaterial;
            if (c.color) c.color.multiplyScalar(shade);
            const phys = c as unknown as THREE.MeshPhysicalMaterial;
            if (opts.tintSheen && phys.isMeshPhysicalMaterial && phys.sheen > 0) {
              phys.sheenColor.copy(c.color).multiplyScalar(1.6);
              phys.sheen = 0.5;
            }
            if (c.emissiveIntensity !== undefined) c.emissiveIntensity = Math.min(c.emissiveIntensity, maxEmissive);
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
        }
        if (mesh.isSkinnedMesh) o.frustumCulled = false;
        if ((o as THREE.Bone).isBone) {
          const n = norm(o.name);
          for (const [k, want] of Object.entries(NAMES) as [BoneName, string][]) if (n === want) this.bones.set(k, o as THREE.Bone);
        }
      });
      for (const [k, b] of this.bones) this.rest.set(k, b.quaternion.clone());
      this.root.add(scene);
      this.calibrate();
      this.loaded = true;
    }).catch((e) => console.error('hero figure failed to load', e));
  }

  /** The weapon frame at rest (arm hanging): blade forward and 35° up, its face turned outward (-X). */
  private calibrate() {
    const hand = this.bones.get('handR');
    if (!hand) return;
    const saved = { p: this.root.position.clone(), q: this.root.quaternion.clone() };
    this.root.position.set(0, 0, 0);
    this.root.quaternion.identity();
    this.root.updateMatrixWorld(true);
    const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
    const y = new THREE.Vector3(0, Math.sin(0.6), Math.cos(0.6));
    const z = new THREE.Vector3(-1, 0, 0);
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    z.crossVectors(x, y).normalize();
    const want = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.gripOffset.copy(handQ).invert().multiply(want);
    this.root.position.copy(saved.p);
    this.root.quaternion.copy(saved.q);
  }

  bone(name: BoneName) {
    return this.bones.get(name);
  }

  /** Back to the rest pose (call first every frame, then layer rotations). */
  resetPose() {
    for (const [k, b] of this.bones) b.quaternion.copy(this.rest.get(k)!);
  }

  /**
   * Rotates a bone by `angle` about `axis` given in the figure's own space (X left, Y up, Z forward), on top of
   * its current pose. Apply parents before children.
   */
  rot(name: BoneName, axis: THREE.Vector3, angle: number) {
    const b = this.bones.get(name);
    if (!b || !b.parent || !angle) return;
    // parent's rotation relative to the root → the axis in the parent's space
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(this.q);
    this.root.getWorldQuaternion(this.q2);
    this.q.premultiply(this.q2.invert());
    this.v.copy(axis).applyQuaternion(this.q.invert()).normalize();
    b.quaternion.premultiply(this.q2.setFromAxisAngle(this.v, angle));
  }

  /** Moves `grip` to the right hand (world space of the root's parent). Call after posing. */
  updateGrip() {
    const hand = this.bones.get('handR');
    if (!hand) return;
    this.root.updateMatrixWorld(true);
    hand.getWorldQuaternion(this.q);
    this.grip.quaternion.copy(this.q).multiply(this.gripOffset);
    this.grip.position.copy(this.gripPoint).applyMatrix4(hand.matrixWorld);
    // into the space of the grip's parent
    const parent = this.grip.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(this.grip.position);
      parent.getWorldQuaternion(this.q2);
      this.grip.quaternion.premultiply(this.q2.invert());
    }
  }

  /** World position of a bone (e.g. the hand, for trails). */
  boneWorld(name: BoneName, out = new THREE.Vector3()) {
    const b = this.bones.get(name);
    return b ? b.getWorldPosition(out) : this.root.getWorldPosition(out);
  }
}
