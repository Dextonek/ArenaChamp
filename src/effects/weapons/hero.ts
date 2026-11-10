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

const VEIL_DARK = new THREE.Color('#150a28');
/**
 * How much of a figure goes at full fade. It blends in linear light, where a bright figure outweighs a dark hero behind it: at
 * 40 % it still looks solid and hides the hero. At 10 % the hero is clear and the boss still reads (checked by eye).
 */
const FADE_MOST = 0.9;

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
  | 'thighR' | 'shinR' | 'thighL' | 'shinL' | 'footR' | 'footL';

/**
 * What a hand holds, read from the mesh when the model loads: the vertices that follow only that hand bone and lie
 * beyond the hand itself (a staff, a sword, a lantern). Lengths in metres at the figure's own size.
 */
export interface Held {
  /** From the hand to the item's far end. */
  len: number;
  /** The far end's direction in the figure's frame at rest (X its left, Y up, Z forward). */
  dir: THREE.Vector3;
  /** How far the item reaches the other way from the hand (a staff's foot). */
  back: number;
  /**
   * A tall staff is modelled in a hanging hand with its foot on the floor. People hold one higher, with the elbow bent
   * (the tip on the ground beside the foot, the forearm about level), so at load the staff is slid down through the
   * fist by this much: with the hand raised by `raise` the foot stands on the floor again. 0 for anything else.
   */
  raise: number;
}

/** An arm at rest, in the figure's frame at the figure's own size: where the hand hangs and how long the arm is. */
export interface Arm {
  hand: THREE.Vector3;
  shoulder: THREE.Vector3;
  length: number;
}

/** A tall upright staff with its foot near the floor (a staff, a spear, a long axe), as `Held` measures it. */
export const isStaff = (h: Held | null) => !!h && h.dir.y > 0.5 && h.len + h.raise >= 1 && h.back - h.raise > 0.5;

/** Per model file: what its hands hold. Measured (and its staffs slid down) once, since every copy shares the geometry. */
const heldCache = new Map<string, { R: Held | null; L: Held | null }>();
/** The hand of a staff is raised by this share of the arm's length (the elbow comes to about a right angle). */
const STAFF_RAISE = 0.4;

const AXIS_X = new THREE.Vector3(1, 0, 0);

/** A chain of `sway_*` bones (hair, sash, robe tail), root first, with each link's rest rotation. */
export interface SwayChain {
  name: string;
  links: THREE.Bone[];
  rest: THREE.Quaternion[];
}

// glTF names ("upper_arm.R") lose their dots in three (PropertyBinding sanitises them): match loosely.
const NAMES: Record<BoneName, string> = {
  pelvis: 'pelvis', chest: 'chest', neck: 'neck', head: 'head',
  armR: 'upperarmr', foreR: 'forearmr', handR: 'handr', armL: 'upperarml', foreL: 'forearml', handL: 'handl',
  thighR: 'thighr', shinR: 'shinr', thighL: 'thighl', shinL: 'shinl', footR: 'footr', footL: 'footl',
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
  /** The model's `sway_*` chains (none on a model without them). */
  readonly sway: SwayChain[] = [];
  /**
   * 0..1, how much of the figure below the knees hangs from the thighs: a long robe or skirt (1) rather than legs in
   * trousers (0). A robe tears open on a long stride, so the walk shortens it.
   */
  robe = 0;
  /** Every material with its loaded colour and emissive, for `setFlash`. */
  /** Each material with its loaded colour, emissive and see-through (a wing, a veil of glass: `applyVeil` keeps them). */
  private mats: { m: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color; opacity: number; transparent: boolean }[] = [];
  /** Hand-local rotation that turns the hand's frame into the weapon frame (calibrated on load). */
  private gripOffset = new THREE.Quaternion();
  private gripPoint = new THREE.Vector3(0, 0.07, 0);
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private q3 = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  /** What each hand holds (null: nothing beyond the hand itself). Set once the model has loaded. */
  readonly held: { R: Held | null; L: Held | null } = { R: null, L: null };
  /** Each arm at rest (null until the model has loaded, or without arm bones). */
  readonly arm: { R: Arm | null; L: Arm | null } = { R: null, L: null };
  /** Each bone's orientation in the figure's frame at rest (`turnBone`). */
  private restFig = new Map<BoneName, THREE.Quaternion>();
  /** A leg's length at rest (hip to ankle), at the figure's own size. */
  legLength = 0.8;
  /** How far each upper arm hangs out from the side at rest (rad): the modeller's clearance of the body (`HeroFigure`). */
  readonly armOut = { R: 0.2, L: 0.2 };
  /** The thigh's share of `legLength` (the rest is the shin): the clips' feet are placed by it (`HeroFigure`). */
  thighPart = 0.5;
  /** Each hand's orientation in the figure's frame at rest (`steadyHand`). */
  private handRest: { R: THREE.Quaternion | null; L: THREE.Quaternion | null } = { R: null, L: null };
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private v5 = new THREE.Vector3();

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
            if (c.color && c.emissive) this.mats.push({ m: c, color: c.color.clone(), emissive: c.emissive.clone(), opacity: c.opacity, transparent: c.transparent });
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
      this.collectSway(scene);
      this.robe = this.measureRobe(scene);
      this.root.add(scene);
      this.calibrate(url);
      this.loaded = true;
    }).catch((e) => console.error('hero figure failed to load', e));
  }

  /** The weapon frame at rest (arm hanging): blade forward and 35° up, its face turned outward (-X). */
  private calibrate(url: string) {
    const hand = this.bones.get('handR');
    // Keep the Euler angles: restoring the quaternion would rebuild them, and a figure loaded facing -Z comes back as
    // (π, 0, π), which turns upside down once `rotation.y` / `rotation.x` are set on their own (HeroFigure.follow, fall).
    const saved = { p: this.root.position.clone(), r: this.root.rotation.clone() };
    this.root.position.set(0, 0, 0);
    this.root.quaternion.identity();
    this.root.updateMatrixWorld(true);
    this.measureHeld(url);
    for (const [k, b] of this.bones) this.restFig.set(k, b.getWorldQuaternion(new THREE.Quaternion()));
    const thigh = this.bones.get('thighL'), shin = this.bones.get('shinL'), foot = this.bones.get('footL');
    if (thigh && shin && foot) {
      const a = thigh.getWorldPosition(new THREE.Vector3()), b = shin.getWorldPosition(new THREE.Vector3()), c = foot.getWorldPosition(new THREE.Vector3());
      this.legLength = (a.distanceTo(b) + b.distanceTo(c)) / (this.root.scale.x || 1);
      this.thighPart = a.distanceTo(b) / Math.max(1e-6, a.distanceTo(b) + b.distanceTo(c));
    }
    if (hand) {
      const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
      const y = new THREE.Vector3(0, Math.sin(0.6), Math.cos(0.6));
      const z = new THREE.Vector3(-1, 0, 0);
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      z.crossVectors(x, y).normalize();
      const want = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      this.gripOffset.copy(handQ).invert().multiply(want);
    }
    this.root.position.copy(saved.p);
    this.root.rotation.copy(saved.r);
  }

  /** Fills `held`, `arm` and the hands' rest orientations. The root stands at the origin, unturned, at rest (`calibrate`). */
  private measureHeld(url: string) {
    const scale = this.root.scale.x || 1, v = new THREE.Vector3(), at = new THREE.Vector3();
    const meshes: THREE.SkinnedMesh[] = [];
    this.root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.skeleton.update();
      meshes.push(mesh);
    });
    const known = heldCache.get(url);
    const found: { R: Held | null; L: Held | null } = { R: null, L: null };
    for (const side of ['R', 'L'] as const) {
      const hand = this.bones.get(side === 'R' ? 'handR' : 'handL');
      const upper = this.bones.get(side === 'R' ? 'armR' : 'armL'), fore = this.bones.get(side === 'R' ? 'foreR' : 'foreL');
      if (!hand) continue;
      this.handRest[side] = hand.getWorldQuaternion(new THREE.Quaternion());
      hand.getWorldPosition(at);
      if (upper && fore) {
        const sh = upper.getWorldPosition(new THREE.Vector3()), el = fore.getWorldPosition(new THREE.Vector3());
        this.arm[side] = { hand: at.clone().divideScalar(scale), shoulder: sh.clone().divideScalar(scale), length: (sh.distanceTo(el) + el.distanceTo(at)) / scale };
        // how far the modeller hung the upper arm out from the side, clear of the body (the clips are fitted to it)
        this.armOut[side] = Math.atan2(Math.abs(el.x - sh.x), Math.max(1e-6, sh.y - el.y));
      }
      if (known) continue;
      const pts: THREE.Vector3[] = [];
      let far: THREE.Vector3 | null = null;
      for (const mesh of meshes) {
        const bi = mesh.skeleton.bones.indexOf(hand);
        const si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight');
        if (bi < 0 || !si || !sw) continue;
        for (let i = 0; i < si.count; i++) {
          let w = 0;
          for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k);
          if (w < 0.9) continue;
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).sub(at).divideScalar(scale);
          // the hand itself (a fist, a glove) is not something held
          if (v.lengthSq() < 0.16 * 0.16) continue;
          const pt = v.clone();
          pts.push(pt);
          if (!far || pt.lengthSq() > far.lengthSq()) far = pt;
        }
      }
      if (!far) continue;
      const dir = far.clone().normalize();
      let back = 0;
      for (const pt of pts) back = Math.max(back, -pt.dot(dir));
      const held: Held = { len: far.length(), dir, back, raise: 0 };
      // A staff: slid down through the fist, so the hand can hold it with a bent elbow and its foot still stands on the floor.
      const arm = this.arm[side];
      if (arm && isStaff(held)) {
        const raise = STAFF_RAISE * arm.length;
        if (this.slideItem(meshes, hand, at, scale, dir.clone().multiplyScalar(-raise * scale))) {
          held.raise = raise;
          held.len -= raise;
          held.back += raise;
        }
      }
      found[side] = held;
    }
    const all = known ?? found;
    if (!known) heldCache.set(url, found);
    for (const side of ['R', 'L'] as const) {
      const h = all[side];
      this.held[side] = h ? { len: h.len, dir: h.dir.clone(), back: h.back, raise: h.raise } : null;
    }
  }

  /**
   * Moves what `hand` holds by `shift` (world, at rest) in the shared geometry: every connected piece of the mesh that
   * follows only that hand and reaches beyond it (the shaft, its bands, its head), but not the hand's own shapes.
   * Returns whether anything moved.
   */
  private slideItem(meshes: THREE.SkinnedMesh[], hand: THREE.Bone, at: THREE.Vector3, scale: number, shift: THREE.Vector3) {
    const v = new THREE.Vector3();
    let any = false;
    for (const mesh of meshes) {
      const geo = mesh.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute, index = geo.index;
      const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
      const bi = mesh.skeleton.bones.indexOf(hand);
      if (bi < 0 || !index || !si || !sw || !(pos.array instanceof Float32Array) || (pos as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) continue;
      const n = pos.count, rigid = new Uint8Array(n), far = new Uint8Array(n), root = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        root[i] = i;
        let w = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k);
        if (w < 0.9) continue;
        rigid[i] = 1;
        if (mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).sub(at).lengthSq() > (0.16 * scale) ** 2) far[i] = 1;
      }
      const find = (i: number) => {
        while (root[i] !== i) i = root[i] = root[root[i]];
        return i;
      };
      for (let t = 0; t < index.count; t += 3) {
        const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
        if (!rigid[a] || !rigid[b] || !rigid[c]) continue;
        root[find(b)] = find(a);
        root[find(c)] = find(a);
      }
      const reaches = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (far[i]) reaches[find(i)] = 1;
      // the shift in the mesh's own space (the bind pose is the rest pose: these models carry no animation)
      const local = shift.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).invert());
      for (let i = 0; i < n; i++) {
        if (!rigid[i] || !reaches[find(i)]) continue;
        pos.setXYZ(i, pos.getX(i) + local.x, pos.getY(i) + local.y, pos.getZ(i) + local.z);
        any = true;
      }
      if (any) pos.needsUpdate = true;
    }
    return any;
  }

  /**
   * Bends an arm so its hand comes to `target` (the figure's frame, metres at the figure's own size: X its left, Y up,
   * Z forward), the elbow pointing back, down and out. `weight` 0..1 blends from the pose the arm already has. Call
   * after the frame's other arm rotations and before `steadyHand`.
   * `keepElbow`: the elbow stays on the side it is on now, instead of back, down and out.
   */
  reachHand(side: 'R' | 'L', target: THREE.Vector3, weight = 1, keepElbow = false) {
    const upper = this.bones.get(side === 'R' ? 'armR' : 'armL'), fore = this.bones.get(side === 'R' ? 'foreR' : 'foreL');
    const hand = this.bones.get(side === 'R' ? 'handR' : 'handL');
    if (!upper || !fore || !hand || !upper.parent || weight <= 0) return;
    const keepU = this.q3.copy(upper.quaternion), keepF = fore.quaternion.clone();
    this.root.updateWorldMatrix(true, false);
    const T = this.v3.copy(target).applyMatrix4(this.root.matrixWorld);
    upper.parent.updateWorldMatrix(true, false);
    upper.updateWorldMatrix(false, true);
    const S = upper.getWorldPosition(this.v4), E = fore.getWorldPosition(this.v5), W = hand.getWorldPosition(this.v);
    const a = S.distanceTo(E), b = E.distanceTo(W);
    const toT = this.v2.copy(T).sub(S);
    const d = Math.min(Math.max(toT.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3);
    toT.normalize();
    // the elbow: on the circle round the shoulder-to-hand line, on the side that points back, down and out
    const along = (a * a - b * b + d * d) / (2 * d), out = Math.sqrt(Math.max(0, a * a - along * along));
    const pole = new THREE.Vector3(side === 'R' ? -0.45 : 0.45, -0.6, -0.65).transformDirection(this.root.matrixWorld);
    pole.addScaledVector(toT, -pole.dot(toT)).normalize();
    if (keepElbow) {
      // ...or on the side the elbow is on now (an arm a clip has posed keeps its bend)
      const now = new THREE.Vector3().copy(E).sub(S);
      now.addScaledVector(toT, -now.dot(toT));
      if (now.lengthSq() > 1e-4) pole.copy(now.normalize());
    }
    const elbow = new THREE.Vector3().copy(S).addScaledVector(toT, along).addScaledVector(pole, out);
    const aim = (bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3, at: THREE.Vector3) => {
      // turn `bone` (in the world) so the direction from its joint to `from` points at `to`
      const cur = new THREE.Vector3().copy(from).sub(at).normalize(), want = new THREE.Vector3().copy(to).sub(at).normalize();
      const turn = new THREE.Quaternion().setFromUnitVectors(cur, want);
      const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(turn);
      const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(parent.invert().multiply(world));
      bone.updateWorldMatrix(false, true);
    };
    aim(upper, E, elbow, S);
    fore.getWorldPosition(E);
    hand.getWorldPosition(W);
    const wrist = new THREE.Vector3().copy(E).addScaledVector(new THREE.Vector3().copy(S).addScaledVector(toT, d).sub(E).normalize(), b);
    aim(fore, W, wrist, E);
    if (weight < 1) {
      upper.quaternion.copy(keepU.slerp(upper.quaternion, weight));
      fore.quaternion.copy(keepF.slerp(fore.quaternion, weight));
    }
  }

  /**
   * Turns a bone to `delta` from its rest, both in the figure's frame (X its left, Y up, Z forward), whatever its
   * parents are doing: a chest leaning 20° forward is `delta` = 20° about X. `weight` 0..1 blends from the pose it has.
   * For replaying a clip made on another rig (`src/motion/clips.ts`): call parents before children.
   */
  turnBone(name: BoneName, delta: THREE.Quaternion, weight = 1) {
    const b = this.bones.get(name), rest = this.restFig.get(name);
    if (!b || !rest || !b.parent || weight <= 0) return;
    b.parent.updateWorldMatrix(true, false);
    b.parent.matrixWorld.decompose(this.v, this.q, this.v2);
    this.root.matrixWorld.decompose(this.v, this.q2, this.v2);
    this.q2.multiply(delta).multiply(rest);
    this.q.invert().multiply(this.q2);
    if (weight >= 1) b.quaternion.copy(this.q);
    else b.quaternion.slerp(this.q, weight);
  }

  /**
   * Turns a bone so that the line from its joint to `child`'s joint points along `dir` (the figure's frame): an upper
   * arm toward its elbow, a shin toward its ankle. `weight` 0..1 blends from the pose it has. Parents before children.
   */
  pointBone(name: BoneName, child: BoneName, dir: THREE.Vector3, weight = 1) {
    const b = this.bones.get(name), c = this.bones.get(child);
    if (!b || !c || !b.parent || weight <= 0) return;
    b.parent.updateWorldMatrix(true, false);
    b.updateWorldMatrix(false, true);
    const from = b.getWorldPosition(this.v4), cur = c.getWorldPosition(this.v5).sub(from).normalize();
    const want = this.v3.copy(dir).transformDirection(this.root.matrixWorld);
    // in the world: the turn from where it points to where it should, over the bone's own orientation
    b.matrixWorld.decompose(this.v, this.q2, this.v2);
    this.q2.premultiply(this.q3.setFromUnitVectors(cur, want));
    b.parent.matrixWorld.decompose(this.v, this.q, this.v2);
    this.q.invert().multiply(this.q2);
    if (weight >= 1) b.quaternion.copy(this.q);
    else b.quaternion.slerp(this.q, weight);
  }

  /** Where a shoulder is now, in the figure's frame at the figure's own size (after the frame's rotations so far). */
  shoulderAt(side: 'R' | 'L', out = new THREE.Vector3()) {
    const upper = this.bones.get(side === 'R' ? 'armR' : 'armL');
    if (!upper) return out.set(0, 0, 0);
    upper.updateWorldMatrix(true, false);
    return this.root.worldToLocal(upper.getWorldPosition(out));
  }

  /** Where a hand is now, in the figure's frame at the figure's own size (after the frame's rotations so far). */
  handAt(side: 'R' | 'L', out = new THREE.Vector3()) {
    const hand = this.bones.get(side === 'R' ? 'handR' : 'handL');
    if (!hand) return out.set(0, 0, 0);
    hand.updateWorldMatrix(true, false);
    return this.root.worldToLocal(hand.getWorldPosition(out));
  }

  /**
   * Turns a hand so that what it holds points along `aim` in the figure's frame (X its left, Y up, Z forward), or keeps
   * the direction it was modelled in when `aim` is left out, whatever the arm does (a staff stays upright while the arm
   * moves); then tipped forward by `tilt` radians (a sword cocked back, then brought down). `weight` 0..1 blends from
   * the pose's own hand. Call after every other rotation of the frame.
   */
  steadyHand(side: 'R' | 'L', weight: number, tilt = 0, aim?: THREE.Vector3) {
    const hand = this.bones.get(side === 'R' ? 'handR' : 'handL'), rest = this.handRest[side], held = this.held[side];
    if (!hand || !rest || !hand.parent || weight <= 0) return;
    hand.parent.updateWorldMatrix(true, false);
    hand.parent.matrixWorld.decompose(this.v, this.q, this.v2);
    this.root.matrixWorld.decompose(this.v, this.q2, this.v2);
    // the hand's orientation in the world: the figure's, the tip forward, the turn to `aim`, then its own at rest
    this.q2.multiply(this.q3.setFromAxisAngle(AXIS_X, tilt));
    if (aim && held) this.q2.multiply(this.q3.setFromUnitVectors(held.dir, this.v.copy(aim).normalize()));
    this.q2.multiply(rest);
    this.q.invert().multiply(this.q2);
    if (weight >= 1) hand.quaternion.copy(this.q);
    else hand.quaternion.slerp(this.q, weight);
  }

  /** Share of the skinned vertices below the knees that mostly follow a thigh (see `robe`). */
  private measureRobe(scene: THREE.Object3D) {
    const thighs = [this.bones.get('thighL'), this.bones.get('thighR')], shin = this.bones.get('shinL');
    if (!thighs[0] || !thighs[1] || !shin) return 0;
    scene.updateMatrixWorld(true);
    const kneeY = shin.getWorldPosition(new THREE.Vector3()).y, v = new THREE.Vector3();
    let below = 0, onThigh = 0;
    scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const pos = mesh.geometry.getAttribute('position'), si = mesh.geometry.getAttribute('skinIndex');
      const sw = mesh.geometry.getAttribute('skinWeight');
      if (!pos || !si || !sw) return;
      const ids = thighs.map((b) => mesh.skeleton.bones.indexOf(b!));
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (v.y > kneeY - 0.05) continue;
        below++;
        let w = 0;
        for (let k = 0; k < 4; k++) if (ids.includes(si.getComponent(i, k))) w += sw.getComponent(i, k);
        if (w > 0.4) onThigh++;
      }
    });
    return below ? Math.min(1, Math.max(0, (onThigh / below - 0.1) / 0.3)) : 0;
  }

  /** Groups the `sway_<chain>_<n>` bones into chains ordered by `n` (root first). */
  private collectSway(scene: THREE.Object3D) {
    const chains = new Map<string, { n: number; b: THREE.Bone }[]>();
    scene.traverse((o) => {
      const m = (o as THREE.Bone).isBone ? /^sway_(.+)_(\d+)$/.exec(o.name) : null;
      if (!m) return;
      const list = chains.get(m[1]) ?? [];
      list.push({ n: Number(m[2]), b: o as THREE.Bone });
      chains.set(m[1], list);
    });
    for (const [name, list] of chains) {
      list.sort((a, b) => a.n - b.n);
      this.sway.push({ name, links: list.map((x) => x.b), rest: list.map((x) => x.b.quaternion.clone()) });
    }
  }

  /**
   * Hit flash on the model: 0 is the loaded look; up to 1 the colour leans toward `tint` and glows a little (kept
   * under the bloom threshold, like the capsule figures' flash).
   */
  setFlash(v: number, tint?: THREE.Color) {
    const f = Math.min(Math.max(0, v), 1);
    for (const { m, color, emissive } of this.mats) {
      m.color.copy(color);
      m.emissive.copy(emissive);
      if (f <= 0) continue;
      if (tint) {
        m.color.lerp(tint, 0.08 * f);
        m.emissive.r += tint.r * 0.1 * f;
        m.emissive.g += tint.g * 0.1 * f;
        m.emissive.b += tint.b * 0.1 * f;
      } else m.emissive.addScalar(0.3 * f);
    }
    this.applyVeil();
  }

  /**
   * Veil 0..1 (Nyx fading): the figure goes dark and see-through, with a faint violet glow, but never vanishes: at 1 it is
   * still plain to see on any floor. Layered over the flash, so a hit still shows.
   */
  setVeil(v: number) {
    this.veil = Math.min(Math.max(0, v), 1);
    this.applyVeil();
  }

  /** Fade 0..1 (a boss with a hero behind it): what stands behind the figure shows through. Its colours stay. */
  setFade(v: number) {
    this.fade = Math.min(Math.max(0, v), 1);
    this.applyVeil();
  }

  private veil = 0;
  private fade = 0;
  private applyVeil() {
    const v = this.veil;
    for (const { m, opacity, transparent } of this.mats) {
      const on = v > 0.01 || this.fade > 0.01;
      // a part the model made see-through (Sirix's wings) stays so
      if (m.transparent !== (on || transparent)) {
        m.transparent = on || transparent;
        m.needsUpdate = true;
      }
      m.opacity = opacity * (on ? (1 - 0.55 * v) * (1 - FADE_MOST * this.fade) : 1);
      if (!on) continue;
      m.color.lerp(VEIL_DARK, 0.75 * v);
      m.emissive.r += 0.1 * v;
      m.emissive.g += 0.03 * v;
      m.emissive.b += 0.18 * v;
    }
  }

  bone(name: BoneName) {
    return this.bones.get(name);
  }

  /** Back to the rest pose (call first every frame, then layer rotations). */
  resetPose() {
    for (const [k, b] of this.bones) b.quaternion.copy(this.rest.get(k)!);
    for (const c of this.sway) c.links.forEach((b, i) => b.quaternion.copy(c.rest[i]));
  }

  /** Like `rot`, for any bone (a sway link). */
  rotBone(b: THREE.Bone, axis: THREE.Vector3, angle: number) {
    if (!b.parent || !angle) return;
    // parent's rotation relative to the root → the axis in the parent's space
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(this.q);
    this.root.getWorldQuaternion(this.q2);
    this.q.premultiply(this.q2.invert());
    this.v.copy(axis).applyQuaternion(this.q.invert()).normalize();
    b.quaternion.premultiply(this.q2.setFromAxisAngle(this.v, angle));
  }

  /**
   * Rotates a bone by `angle` about `axis` given in the figure's own space (X left, Y up, Z forward), on top of
   * its current pose. Apply parents before children.
   */
  rot(name: BoneName, axis: THREE.Vector3, angle: number) {
    const b = this.bones.get(name);
    if (b) this.rotBone(b, axis, angle);
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
