import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { HERO_SCALE, bodyReach, type BodyShape } from '../effects/weapons/hero';

/**
 * Heroes of the fourth style (user, 2026-11-10: "make them look real, a continuous body", then "make all heroes like
 * that"): a realistic body on the 65-bone skeleton of Quaternius' Universal Base Characters, moved by the clips of his
 * Universal Animation Library as they are (both CC0). No fitting: the bodies and the clips were made for each other.
 * Models: `public/models/heroes/*_v4.glb` (blender/heroes/realkit.py, one file per hero in blender/heroes/real/); clips: `public/models/anim/ual.glb`
 * (pipeline/tools/strip-anim.mjs). `HeroFigure` owns one `RealHero` per such model and tells it each frame which clips
 * to show (`pose`); the older heroes and the bosses keep the 16-bone path in `effects/weapons/hero.ts`.
 * Design: pipeline/designs/style-v4/README.md.
 */

/** True for a model of the fourth style. The marker is the file name, never "its bones were found". */
export const isRealModel = (url: string | undefined) => !!url && /_v4\.glb$/.test(url);

/** The body in four parts, so a blow can take the arms while the legs keep walking. */
export type Part = 'legs' | 'torso' | 'armR' | 'armL';
const PARTS: Part[] = ['legs', 'torso', 'armR', 'armL'];
const LEG = /^(root|pelvis|thigh|calf|foot|ball)/;
const partOf = (bone: string): Part => (LEG.test(bone) ? 'legs' : /_l$/.test(bone) ? 'armL' : /_r$/.test(bone) ? 'armR' : 'torso');

/** One clip shown this frame: where in it (seconds) and how much of each part of the body is its own (0..1). */
export interface Layer { clip: string; t: number; loop?: boolean; legs?: number; torso?: number; armR?: number; armL?: number }

/**
 * The moment the blow lands in a clip (seconds), measured as the hand furthest forward of the hips; the spell's push is
 * set by eye (the hand ends forward and stays there).
 */
const HIT: Record<string, number> = {
  Sword_Attack: 0.43, Sword_Regular_A: 0.23, Sword_Regular_B: 0.25, Sword_Regular_C: 0.5, Punch_Jab: 0.2, Punch_Cross: 0.3,
  Melee_Hook: 0.27, Zombie_Scratch: 0.62, Spell_Simple_Shoot: 0.25, OverhandThrow: 0.38, TreeChopping_Loop: 0.15, Sword_Dash: 0.32,
  Jump_Land: 0.4,
};

/**
 * How much of the legs a blow may take (the rest stays with the stand). The pack's sword blows, its hook and its throw
 * are big lunges: played whole, a hero drops to the floor and travels a metre from where the game has it (measured
 * 2026-11-10 against the pack's own figure: the copy was exact, and wrong for an arena seen from above). A third of
 * them keeps the step into the blow and the hero on its feet. Clips not listed take the legs whole.
 */
const LEGS: Record<string, number> = {
  Sword_Attack: 0.35, Sword_Regular_A: 0.35, Sword_Regular_B: 0.35, Sword_Regular_C: 0.35, Sword_Dash: 0.35, Melee_Hook: 0.35,
  OverhandThrow: 0.35,
};

/**
 * How a hero of this style attacks and what it carries, where that is not what its kit already says (a melee hero
 * swings a blade, or a heavy weapon if its attack is a smash or a cleave; a ranged one pushes a spell):
 * - `attack`: `fist` (bare hands, in turn), `claw` (a hooking swipe), `throw` (overhand), `chop` (Hank's axe), `spell`
 *   on a melee hero whose weapon is the staff in its left hand (Gus): the pack's push is a left-hand one, so the staff
 *   is thrust at the enemy.
 * - `hold`: what an arm does whenever it is not striking or casting, from the pack's own holding clips: `torch` (a
 *   staff, scepter, spear or wand upright in the LEFT hand), `lantern` (something hung from the raised RIGHT hand),
 *   `shield` (the LEFT arm up). The pack has no other hands for these, so the models are built to match.
 */
export interface RealStyle {
  attack?: 'blade' | 'heavy' | 'fist' | 'claw' | 'throw' | 'chop' | 'spell';
  hold?: 'torch' | 'lantern' | 'shield';
}
export const REAL_STYLE: Record<string, RealStyle> = {
  // a staff, scepter, spear, wand, lyre, mirror, brush or lantern upright in the left hand
  Vesper: { hold: 'torch' }, Isolde: { hold: 'torch' }, Kaia: { hold: 'torch' }, Sefu: { hold: 'torch' }, Fenna: { hold: 'torch' },
  Mortis: { hold: 'torch' }, Cantor: { hold: 'torch' }, Opaline: { hold: 'torch' }, Shiori: { hold: 'torch' }, Tempo: { hold: 'torch' },
  Silvane: { hold: 'torch' }, 'Mr. Ledger': { hold: 'torch' }, Gus: { hold: 'torch', attack: 'spell' }, 'Barry Cloudsley': { hold: 'torch' }, Bo: { hold: 'torch' },
  'The Great Zambini': { hold: 'torch' }, Wick: { hold: 'torch' }, Anka: { hold: 'torch' },
  Auriel: { hold: 'shield' },
  // how they strike
  Vitriol: { attack: 'throw' }, Pip: { attack: 'throw' }, Sirix: { attack: 'claw' }, Mabel: { attack: 'claw' }, Hank: { attack: 'chop' },
  'Big Yoko': { attack: 'fist' }, Mum: { attack: 'fist' },
};
/** The clip and the arm of each hold. */
export const HOLD: Record<NonNullable<RealStyle['hold']>, [string, 'armL' | 'armR']> = {
  torch: ['Idle_Torch_Loop', 'armL'], lantern: ['Idle_Lantern_Loop', 'armR'], shield: ['Idle_Shield_Loop', 'armL'],
};

interface Library {
  /** Per clip, its tracks by body part (the pelvis' position among the legs'). */
  tracks: Map<string, Record<Part, THREE.KeyframeTrack[]>>;
  dur: Map<string, number>;
  /** Where the pelvis rests in the clips' own skeleton (its parent's frame). */
  pelvisRest: THREE.Vector3;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let library: Promise<Library> | null = null;
let libraryNow: Library | null = null;

function loadLibrary(): Promise<Library> {
  library ??= loader.loadAsync(`${import.meta.env.BASE_URL}models/anim/ual.glb`).then((g) => {
    const lib: Library = { tracks: new Map(), dur: new Map(), pelvisRest: g.scene.getObjectByName('pelvis')?.position.clone() ?? new THREE.Vector3(0, 0, 0.92) };
    for (const clip of g.animations) {
      const by: Record<Part, THREE.KeyframeTrack[]> = { legs: [], torso: [], armR: [], armL: [] };
      for (const t of clip.tracks) by[partOf(t.name.split('.')[0])].push(t);
      lib.tracks.set(clip.name, by);
      lib.dur.set(clip.name, clip.duration);
    }
    libraryNow = lib;
    return lib;
  });
  return library;
}

/** Starts loading the clips now (the game does, a moment after its menu is up), so the first fight does not wait for them. */
export function preloadClips() {
  void loadLibrary().catch(() => undefined);
}

/**
 * A clip's length and the moment its blow lands (seconds; 1 s and its middle until the clips have loaded), and the
 * share of the legs it may take (`LEGS`).
 */
export function realClipInfo(name: string) {
  const dur = libraryNow?.dur.get(name) ?? 1;
  return { dur, hit: HIT[name] ?? dur * 0.5, legs: LEGS[name] ?? 1 };
}

const scenes = new Map<string, Promise<THREE.Group>>();
/** What counts as body for the arms' outline: the hips, the spine and the legs, and what is bound to them. */
const BODY = /^(pelvis|spine_0[123]|thigh_|calf_)/;
const OUTLINE_STEP = 0.04, OUTLINE_SECTORS = 24;
/**
 * How far outside the outline a forearm and hand stay (model units), the most an arm is swung out (rad), and the points
 * checked: the middle of the forearm, the wrist and the knuckles (5 cm past the wrist; fingertips may brush a hem).
 */
const ARM_MARGIN = 0.02, ARM_MOST = 0.45;
const ARM_POINTS: [number, number][] = [[0.5, 0], [1, 0], [1, 0.05]];
const FORWARD = new THREE.Vector3(0, 0, 1);
/**
 * How far a held item leans toward the target in a blow or a cast (rad from upright), at most. A staff that reaches below
 * the hand leans less where its foot would go into the robe or the legs: as far back as `HELD_BACK` (its head toward
 * the hero), in steps of `HELD_STEP`, until its foot and the lower half of its shaft are outside the body's outline.
 */
const HELD_LEAN = 0.6, HELD_BACK = -0.45, HELD_STEP = 0.06;
const VEIL_DARK = new THREE.Color('#150a28');
const FADE_MOST = 0.9;

export class RealHero {
  /** Feet at the origin, facing +Z; move and turn this. */
  readonly root = new THREE.Group();
  loaded = false;
  /** A leg's length at rest (hip to ankle), at the model's own size. */
  legLength = 0.83;
  private mixer: THREE.AnimationMixer | null = null;
  private lib: Library | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private live = new Set<THREE.AnimationAction>();
  private pelvis: THREE.KeyframeTrack[] = [];
  private pelvisRest = new THREE.Vector3();
  private pelvisScale = 1;
  private mats: { m: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color; opacity: number; transparent: boolean }[] = [];
  private veil = 0;
  private fade = 0;
  /** The body's outline in the idle (`measure`), for `clearArms`. */
  private body: BodyShape | null = null;
  private arms: { upper: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D }[] = [];
  /** What the left hand holds (`measureHeld`, `uprightHeld`). */
  private heldHand: THREE.Object3D | null = null;
  private heldAxis: THREE.Vector3 | null = null;
  /** How far it reaches below the hand along that axis (model units). */
  private heldBelow = 0;
  private armS = new THREE.Vector3();
  private armE = new THREE.Vector3();
  private armH = new THREE.Vector3();
  private armP = new THREE.Vector3();
  private armD = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private qc = new THREE.Quaternion();
  private qd = new THREE.Quaternion();

  constructor(url: string, shade = 0.9) {
    this.root.scale.setScalar(HERO_SCALE);
    let load = scenes.get(url);
    if (!load) {
      load = loader.loadAsync(`${import.meta.env.BASE_URL}${url}`).then((g) => g.scene);
      scenes.set(url, load);
    }
    Promise.all([load, loadLibrary()]).then(([src, lib]) => {
      const scene = cloneSkinned(src);
      scene.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isMesh) return;
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if (c.color) c.color.multiplyScalar(shade);
          if (c.emissiveIntensity !== undefined) c.emissiveIntensity = Math.min(c.emissiveIntensity, 1);
          if (c.color && c.emissive) this.mats.push({ m: c, color: c.color.clone(), emissive: c.emissive.clone(), opacity: c.opacity, transparent: c.transparent });
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
        if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
      });
      this.root.add(scene);
      this.root.updateMatrixWorld(true);
      const at = (n: string) => scene.getObjectByName(n)?.getWorldPosition(new THREE.Vector3());
      const hip = at('thigh_l'), knee = at('calf_l'), ankle = at('foot_l');
      if (hip && knee && ankle) this.legLength = (hip.distanceTo(knee) + knee.distanceTo(ankle)) / (this.root.scale.x || 1);
      // The clips carry the pelvis' place on their own figure: here it becomes this hero's own, moved by as much, in
      // proportion to its height.
      const pelvis = scene.getObjectByName('pelvis');
      if (pelvis) {
        this.pelvisRest.copy(pelvis.position);
        this.pelvisScale = pelvis.position.length() / Math.max(1e-6, lib.pelvisRest.length());
      }
      this.lib = lib;
      this.mixer = new THREE.AnimationMixer(scene);
      this.measure(scene);
      this.loaded = true;
    }).catch((e) => console.error('hero model failed to load', url, e));
  }

  /**
   * Measures the model in the pack's idle, once at load, and sets it on the floor. (1) The soles: the pack's own figure
   * stands at 0 in its idle; ours were built on the base characters' bodies, whose ankles sit lower in a longer leg, and
   * on boots a little under the sole, so the clips set them 3 to 12 cm into the ground (measured 2026-11-16 in the heroes'
   * model review, docs/heroes/review/). The lowest foot or boot vertex over the idle's loop is set on the floor. (2) The
   * body's outline for `clearArms`: per 4 cm of height and 15 degrees round the upright axis, the furthest vertex of the
   * hips, chest, legs and what hangs from them (robes, coats, aprons; see-through things like wings left out).
   */
  private measure(scene: THREE.Object3D) {
    const feet: [THREE.SkinnedMesh, number[]][] = [], body: [THREE.SkinnedMesh, number[]][] = [];
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const mat = m.material as THREE.Material;
      const solid = !(mat.transparent && mat.opacity < 0.99);
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, f: number[] = [], b: number[] = [];
      for (let i = 0; i < si.count; i++) {
        let d = 0;
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, d)) d = j;
        const name = m.skeleton.bones[si.getComponent(i, d)]?.name ?? '';
        if (/^(foot|ball)_/.test(name)) f.push(i);
        else if (solid && BODY.test(name)) b.push(i);
      }
      if (f.length) feet.push([m, f]);
      if (b.length) body.push([m, b]);
    });
    const v = new THREE.Vector3(), dur = this.lib?.dur.get('Idle_Loop') ?? 1;
    const each = (list: [THREE.SkinnedMesh, number[]][], fn: (p: THREE.Vector3) => void) => {
      this.root.updateMatrixWorld(true);
      for (const [m, ids] of list) {
        m.skeleton.update();
        for (const i of ids) fn(this.root.worldToLocal(m.applyBoneTransform(i, v.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld)));
      }
    };
    const idle = (k: number) => this.pose([{ clip: 'Idle_Loop', t: (dur * k) / 6, loop: true, legs: 1, torso: 1, armR: 1, armL: 1 }]);
    let low = Infinity;
    for (let k = 0; k < 6; k++) {
      idle(k);
      each(feet, (p) => { low = Math.min(low, p.y); });
    }
    if (Number.isFinite(low)) scene.position.y += Math.min(0.15, Math.max(-0.15, -low));
    // the outline, in the root's own frame (model units), with the model on the floor
    const pts: number[] = [];
    let y0 = Infinity, y1 = -Infinity;
    idle(0);
    each(body, (p) => {
      pts.push(p.x, p.y, p.z);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    });
    for (const side of ['l', 'r']) {
      const upper = scene.getObjectByName(`upperarm_${side}`), fore = scene.getObjectByName(`lowerarm_${side}`), hand = scene.getObjectByName(`hand_${side}`);
      if (upper && fore && hand) this.arms.push({ upper, fore, hand });
    }
    this.measureHeld(scene);
    if (!pts.length) return;
    const rows = Math.ceil((y1 - y0) / OUTLINE_STEP) + 1;
    const shape: BodyShape = { y0, step: OUTLINE_STEP, rows, sectors: OUTLINE_SECTORS, r: new Float32Array(rows * OUTLINE_SECTORS) };
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2];
      const c = Math.floor((y - y0) / OUTLINE_STEP) * OUTLINE_SECTORS + (Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * OUTLINE_SECTORS) % OUTLINE_SECTORS);
      shape.r[c] = Math.max(shape.r[c], Math.hypot(x, z));
    }
    this.body = shape;
  }

  /**
   * The long axis of what the left hand holds (a staff, a scepter, a lyre, a lantern), in the hand's own frame, pointing
   * to the end that is up in the pack's torch hold; and whether it reaches well below the hand (a long staff held at its
   * middle). From the vertices bound to the hand alone, more than 13 cm from the wrist.
   */
  private measureHeld(scene: THREE.Object3D) {
    const hand = scene.getObjectByName('hand_l');
    if (!hand) return;
    const pts: THREE.Vector3[] = [], v = new THREE.Vector3();
    this.pose([{ clip: 'Idle_Torch_Loop', t: 0, loop: true, legs: 1, torso: 1, armR: 1, armL: 1 }]);
    this.root.updateMatrixWorld(true);
    const at = hand.getWorldPosition(new THREE.Vector3());
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const k = m.skeleton.bones.indexOf(hand as THREE.Bone);
      if (k < 0) return;
      m.skeleton.update();
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      for (let i = 0; i < si.count; i++) {
        let d = 0;
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, d)) d = j;
        if (si.getComponent(i, d) !== k || sw.getComponent(i, d) < 0.98) continue;
        m.applyBoneTransform(i, v.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld);
        if (v.distanceTo(at) > 0.13 * this.root.scale.x) pts.push(v.clone());
      }
    });
    if (pts.length < 12) return;
    // the principal axis (power iteration on the spread), then turned to point up in the hold
    const c = new THREE.Vector3();
    for (const p of pts) c.add(p);
    c.multiplyScalar(1 / pts.length);
    let ax = new THREE.Vector3(0, 1, 0);
    for (let it = 0; it < 12; it++) {
      const n = new THREE.Vector3();
      for (const p of pts) {
        const d = v.copy(p).sub(c);
        n.addScaledVector(d, d.dot(ax));
      }
      if (n.lengthSq() < 1e-12) return;
      ax = n.normalize();
    }
    if (ax.y < 0) ax.negate();
    let below = 0;
    for (const p of pts) below = Math.max(below, -v.copy(p).sub(at).dot(ax));
    this.heldBelow = below / this.root.scale.x;
    this.heldAxis = ax.applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.heldHand = hand;
  }

  /**
   * Keeps what the left hand holds upright through a blow or a cast, its head leaning toward the target, as it stands in
   * the torch hold (the model review, 2026-11-16). The pack's push (`Spell_Simple_Shoot`) turns the palm to the front,
   * which laid every staff, scepter, lyre and lantern on its side across the chest, its head pointing at the hero's right
   * shoulder. The hand alone is turned, by the least turn from where the clip has the item to upright, times `weight`
   * (the share of the blow or cast). A long staff held at its middle leans less (or back), so its foot stays out of the
   * robe and the legs.
   */
  uprightHeld(weight: number) {
    const hand = this.heldHand, ax = this.heldAxis;
    if (!hand || !ax || weight <= 0.01) return;
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(this.qa);
    const handQ = hand.getWorldQuaternion(this.qd);
    // where the item points now, and where it should, in the root's frame
    const now = this.armP.copy(ax).applyQuaternion(handQ).applyQuaternion(this.qb.copy(rootQ).invert());
    const want = this.armD;
    // the hand in the root's frame, and the most lean whose foot and lower shaft are clear of the body
    const H = this.root.worldToLocal(hand.getWorldPosition(this.armH)), b = this.body, below = this.heldBelow;
    const clear = () => {
      if (!b || below < 0.25) return true;
      for (const k of [0.5, 0.75, 1]) {
        const x = H.x - want.x * below * k, y = H.y - want.y * below * k, z = H.z - want.z * below * k;
        if (Math.hypot(x, z) < bodyReach(b, x, y, z) + ARM_MARGIN) return false;
      }
      return true;
    };
    for (let lean = HELD_LEAN; ; lean -= HELD_STEP) {
      want.set(0, Math.cos(lean), Math.sin(lean));
      if (lean <= HELD_BACK || clear()) break;
    }
    const turn = this.qc.setFromUnitVectors(now, want);
    turn.slerp(this.qb.identity(), 1 - Math.min(1, weight));
    turn.premultiply(rootQ).multiply(rootQ.invert());
    const parentQ = hand.parent!.getWorldQuaternion(this.qb);
    hand.quaternion.copy(parentQ.invert().multiply(turn).multiply(handQ));
    hand.updateMatrixWorld(true);
  }

  /** How far the last `clearArms` swung each arm out (rad; left, right): for the model review's tool. */
  readonly armsOut = [0, 0];

  /**
   * Keeps each forearm and hand out of the body (docs/knowledge/retargeting-arms.md: the push-out the older figures have
   * had since 2026-11-10, here on the fourth style). The pack's clips hang the hands close to a slim figure's hips; on a
   * hero in a flared robe, a long coat, an apron or a round belly they went inside it (the model review, 2026-11-16:
   * Zambini's tailcoat, Marin's apron, Kaia's storm coat, up to 15 cm). An arm whose middle of the forearm, wrist or
   * fingers is inside the outline (`measure`) is swung out from the shoulder, the elbow keeping its bend, by the least
   * angle that clears it, times `weight` (the caller gives none during a blow, a cast or a knock-up: there the hands go
   * where the clip sends them). Call after `pose`.
   */
  clearArms(weight: number) {
    this.armsOut[0] = this.armsOut[1] = 0;
    const b = this.body;
    if (!b || weight <= 0.01) return;
    this.root.updateMatrixWorld(true);
    const S = this.armS, E = this.armE, H = this.armH, P = this.armP, D = this.armD;
    for (let n = 0; n < this.arms.length; n++) {
      const arm = this.arms[n];
      this.root.worldToLocal(arm.upper.getWorldPosition(S));
      this.root.worldToLocal(arm.fore.getWorldPosition(E)).sub(S);
      this.root.worldToLocal(arm.hand.getWorldPosition(H)).sub(S);
      const out = Math.sign(S.x) || 1;
      D.copy(H).sub(E).normalize();
      const clear = (a: number) => {
        const c = Math.cos(a * out), s = Math.sin(a * out);
        for (const [k, extra] of ARM_POINTS) {
          P.lerpVectors(E, H, k).addScaledVector(D, extra);
          const x = P.x * c - P.y * s + S.x, y = P.x * s + P.y * c + S.y, z = P.z + S.z;
          if (Math.hypot(x, z) < bodyReach(b, x, y, z) + ARM_MARGIN) return false;
        }
        return true;
      };
      if (clear(0)) continue;
      let a = 0.03;
      while (a < ARM_MOST && !clear(a)) a += 0.03;
      a = Math.min(a, ARM_MOST) * weight;
      this.armsOut[n] = a;
      // the turn about the root's forward axis at the shoulder, as a turn of the upper arm in its parent's frame
      const rootQ = this.root.getWorldQuaternion(this.qa);
      const turn = this.qb.setFromAxisAngle(FORWARD, a * out);
      turn.premultiply(rootQ).multiply(rootQ.invert());
      const parentQ = arm.upper.parent!.getWorldQuaternion(this.qc);
      const upperQ = arm.upper.getWorldQuaternion(this.qd);
      arm.upper.quaternion.copy(parentQ.invert().multiply(turn).multiply(upperQ));
      arm.upper.updateMatrixWorld(true);
    }
  }

  private action(clip: string, part: Part) {
    const key = `${clip}:${part}`;
    let a = this.actions.get(key);
    if (a || !this.lib || !this.mixer) return a;
    const tracks = this.lib.tracks.get(clip)?.[part];
    if (!tracks?.length) return undefined;
    const own = tracks.map((t) => {
      if (t.name !== 'pelvis.position') return t;
      const v = new Float32Array(t.values.length), r = this.lib!.pelvisRest, h = this.pelvisRest, k = this.pelvisScale;
      for (let i = 0; i < v.length; i += 3) {
        v[i] = h.x + (t.values[i] - r.x) * k;
        v[i + 1] = h.y + (t.values[i + 1] - r.y) * k;
        v[i + 2] = h.z + (t.values[i + 2] - r.z) * k;
      }
      const moved = new THREE.VectorKeyframeTrack(t.name, t.times, v);
      this.pelvis.push(moved);
      return moved;
    });
    a = this.mixer.clipAction(new THREE.AnimationClip(key, this.lib.dur.get(clip) ?? -1, own));
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.play();
    a.setEffectiveWeight(0);
    this.actions.set(key, a);
    return a;
  }

  /**
   * Shows these clips this frame. Per part of the body the weights are a share each (they are scaled to sum to 1, so no
   * part falls back to the model's T-pose); a clip is set to its moment, not played on.
   */
  pose(layers: Layer[]) {
    if (!this.mixer || !this.lib) return;
    for (const a of this.live) a.setEffectiveWeight(0);
    this.live.clear();
    for (const part of PARTS) {
      let sum = 0;
      for (const l of layers) sum += Math.max(0, l[part] ?? 0);
      if (sum <= 1e-4) continue;
      for (const l of layers) {
        const w = Math.max(0, l[part] ?? 0);
        if (w <= 1e-4) continue;
        const a = this.action(l.clip, part);
        if (!a) continue;
        const dur = this.lib.dur.get(l.clip) ?? 1;
        a.time = l.loop ? ((l.t % dur) + dur) % dur : Math.min(dur - 1e-3, Math.max(0, l.t));
        a.setEffectiveWeight(w / sum);
        this.live.add(a);
      }
    }
    this.mixer.update(0);
  }

  /** Hit flash 0..1 in `tint` (as `Hero.setFlash`). */
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

  /** Veil 0..1 (Nyx fading): dark and see-through, never gone (as `Hero.setVeil`). */
  setVeil(v: number) {
    this.veil = Math.min(Math.max(0, v), 1);
    this.applyVeil();
  }

  /** Fade 0..1: what stands behind shows through (as `Hero.setFade`). */
  setFade(v: number) {
    this.fade = Math.min(Math.max(0, v), 1);
    this.applyVeil();
  }

  private applyVeil() {
    const v = this.veil, on = v > 0.01 || this.fade > 0.01;
    for (const { m, opacity, transparent } of this.mats) {
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
}
