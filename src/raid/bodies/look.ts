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
  /**
   * What a move does with the body itself, besides its cast pose (`BossMove.act`): fists flying out, lanterns thrown. `x`, `z` are where
   * it lands, in the body's own space (x its left, z its front), and `wx`, `wz` in the world, where the body stands at `bx`, `bz`. `t` seconds
   * since that step, `dur` until it lands.
   */
  act: BodyAct | null;
  /** Every action still playing, oldest first: a move's steps overlap (Pillar Fall's second stone is called before the first lands). */
  acts: readonly BodyAct[];
}

/** One body action: what a move's step does with the body (see `BodyState.act`). `yaw`: which way the body faces in the world. */
export interface BodyAct { name: string; step: number; t: number; dur: number; x: number; z: number; wx: number; wz: number; bx: number; bz: number; yaw: number }

/**
 * Of the actions that pass `test` (one fist's steps, say), the one to show: one striking or just struck, until `hold` after its impact,
 * wins over a newer one still winding up; otherwise the newest.
 */
export function lead(acts: readonly BodyAct[], test: (a: BodyAct) => boolean, hold = 0.3) {
  let best: BodyAct | null = null;
  for (const a of acts) {
    if (!test(a)) continue;
    if (a.t >= a.dur - STRIKE && a.t <= a.dur + hold) return a;
    if (!best || a.t < best.t) best = a;
  }
  return best;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
/** How long a strike takes to come down, how long it holds where it landed, and how long it takes to settle (s). */
const STRIKE = 0.18;
const HOLD = 0.15;
const SETTLE = 0.35;

/**
 * The wind-up and the strike of a cast, timed so the strike lands at its end, when the move's zone lands: `a` swells until just before,
 * `k` comes down over the last `STRIKE` seconds, holds and settles.
 */
export function beat(c: NonNullable<BodyState['cast']>) {
  const ta = Math.max(c.dur * 0.5, c.dur - STRIKE);
  const a = c.t < ta ? smooth(c.t / ta) : Math.max(0, 1 - (c.t - ta) / 0.1);
  const k = c.t < ta ? 0 : c.t < c.dur ? Math.min(1, (c.t - ta) / (c.dur - ta)) : c.t < c.dur + HOLD ? 1 : Math.max(0, 1 - (c.t - c.dur - HOLD) / SETTLE);
  return { a, k };
}

/**
 * A body action's timing, its impact at `dur`: `w` the wind-up (1 from just before the impact), `s` the strike coming down (0 to 1 over
 * the last `strike` seconds, 1 after), `r` how much of the action still shows (1 until `hold` after the impact, then down to 0).
 */
export function actBeat(act: BodyAct, strike = STRIKE, hold = 0.25, settle = 0.7) {
  const ta = Math.max(act.dur * 0.5, act.dur - strike);
  const w = act.t < ta ? smooth(act.t / ta) : 1;
  const s = act.t < ta ? 0 : act.t < act.dur ? smooth((act.t - ta) / (act.dur - ta)) : 1;
  const r = act.t < act.dur + hold ? 1 : 1 - smooth((act.t - act.dur - hold) / settle);
  return { w, s, r };
}

/** Which way a body faces in the world, and its left: an action that sweeps across its front needs them. */
export function facing(act: BodyAct) {
  const fx = Math.sin(act.yaw), fz = Math.cos(act.yaw);
  return { fx, fz, lx: fz, lz: -fx };
}

/** Poses a boss's rigid parts for one frame. Parts start each frame at rest, so a look only says what differs. */
export type BodyLook = (s: BodyState, parts: BodyParts) => void;

const EULER = new THREE.Euler();
/** The enrage's red, and how bright a part with no light of its own glows in it. */
const RAGE_RED = new THREE.Color(0xff2a10);
const RAGE_GLOW = 0.15;
const RAGE_TO = new THREE.Color();
const TURN = new THREE.Quaternion();
const AT = new THREE.Vector3();
const UP0 = new THREE.Vector3();
const UP1 = new THREE.Vector3();

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
    const seen = new Set<THREE.Material>();
    root.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial || seen.has(std)) continue;
        seen.add(std);
        this.all.push({ m: std, e: std.emissive.clone() });
      }
    });
  }

  /** Every material once, with the light colour it loaded with: what the enrage reddens. */
  private all: { m: THREE.MeshStandardMaterial; e: THREE.Color }[] = [];

  /**
   * Enraged, 0..1, called every frame after the look: a part's own light turns red at its own brightness, and a part with none takes a dim
   * red glow. It shifts the light the figure set this frame (its hit flash included, which puts each colour back first), so at 0 it
   * touches nothing.
   */
  rage(k: number) {
    if (k <= 0.001) return;
    for (const a of this.all) {
      const bright = Math.max(a.e.r, a.e.g, a.e.b);
      if (bright > 0.02) a.m.emissive.lerp(RAGE_TO.copy(RAGE_RED).multiplyScalar(bright), k);
      else a.m.emissive.lerp(RAGE_TO.copy(RAGE_RED).multiplyScalar(RAGE_GLOW / Math.max(0.05, a.m.emissiveIntensity)), k);
    }
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

  /**
   * Moves a part `k` of the way to a point in the world, and `up` metres above that in the world: to send a fist or a lantern somewhere.
   * A model's own nodes may be turned (Blender's z up), so this works in the world, not in the part's own axes.
   */
  toward(name: string, x: number, y: number, z: number, k: number, up = 0) {
    const n = this.nodes.get(name)?.node, parent = n?.parent;
    if (!n || !parent) return;
    parent.updateWorldMatrix(true, false);
    n.position.lerp(parent.worldToLocal(AT.set(x, y, z)), k);
    if (up) n.position.add(parent.worldToLocal(UP1.set(0, up, 0)).sub(parent.worldToLocal(UP0.set(0, 0, 0))));
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
