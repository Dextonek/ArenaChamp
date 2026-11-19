import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { MinionLook, MinionPalette, MinionPose, MinionRig } from '../../../effects/parts/minion';
import { BodyParts } from '../../../raid/bodies/look';

/**
 * The Climb's beasts and spirits as models of their own (the user, 2026-11-19: "lets make more models even for the tower", then "Yes,
 * do them all"; docs/tower/beasts/README.md). Until now they were drawn in code from a few cones and cylinders (looksWild.ts, looks.ts,
 * f45/looks.ts). Each is built like the Raid's bosses (blender/tower/beasts/<id>.py with the boss toolkit): rigid parts in a named
 * hierarchy, no skeleton, every part's origin the point it turns about. Here each is posed in code by its own `pose` (one file a beast
 * in this folder), through the bosses' `BodyParts` (src/raid/bodies/look.ts): every part starts each frame at rest, the pose says what
 * differs.
 *
 * A beast look is a `MinionLook` like the code ones, so the packs, the tactics and the other players' copies are unchanged:
 * - The code look is built in any case (it draws on the game's random numbers, which the perf scenes and the route bot replay) and
 *   shown until the file has landed; then it goes.
 * - The file is loaded once; each unit clones its scene, with materials of its own (a part's glow and the hit flash are the unit's).
 * - The hit flash follows the arena's palette, as the people models' does (foeModels.ts).
 * - `globalThis.__codeFoes = true` before a floor starts draws them in code again (the A/B), as the people.
 */

/** What a beast's pose reads each frame. */
export interface BeastState {
  dt: number;
  /** Seconds this unit has lived. */
  time: number;
  pose: MinionPose;
  /** Its walk, eased (0 standing, 1 at full speed), and how far round its gait has come (radians: one stride is 2 pi). */
  gait: number;
  stride: number;
  /** Seconds since its last shot left, or a large number. */
  sinceShot: number;
  /** A number of its own, 0..1, so a pack's units are out of step. */
  seed: number;
  /** Values a pose keeps from frame to frame (eased ones). */
  mem: Record<string, number>;
}

export interface BeastDef {
  /** The file stem: models/tower/beasts/<id>.glb. */
  id: string;
  /** How much bigger the rig is drawn than the model (the model is built at the code look's size: 1). */
  scale?: number;
  /** The health bar's height over the feet (m, before the unit's scale). */
  barY: number;
  /** Where its shots leave (m over the feet), for one that shoots. */
  shotY?: number;
  /** How far one stride carries it (m, before the unit's scale): its legs keep pace with how fast it goes. */
  stride?: number;
  pose(p: BodyParts, s: BeastState): void;
}

const URL_OF = (id: string) => `models/tower/beasts/${id}.glb`;
const loads = new Map<string, Promise<THREE.Object3D | null>>();
const landed = new Map<string, THREE.Object3D>();
let loader: GLTFLoader | null = null;

/** Starts loading a beast's file (once); resolves when it has landed (or failed: null). */
export function preloadBeast(id: string): Promise<THREE.Object3D | null> {
  let p = loads.get(id);
  if (!p) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(URL_OF(id)).then((g) => {
      g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      landed.set(id, g.scene);
      return g.scene;
    }).catch((e) => {
      console.warn(`The beast model ${id} did not load; it stays drawn in code.`, e);
      return null;
    });
    loads.set(id, p);
  }
  return p;
}

/** The scene a unit clones, with materials of its own (and the colours it loaded with, for the hit flash). */
function cloneOf(src: THREE.Object3D) {
  const root = src.clone(true);
  const mats = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const one = (m: THREE.Material) => {
      let c = mats.get(m);
      if (!c) mats.set(m, (c = (m as THREE.MeshStandardMaterial).clone()));
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
  });
  const list = [...mats.values()].map((m) => ({ m, color: m.color.clone(), emissive: m.emissive.clone() }));
  return { root, list };
}

let made = 0;

/** A `MinionLook` drawn from a beast's model; `fallback` is its code look, shown until the file has landed. */
export function beastLook(def: BeastDef, fallback: MinionLook, unit: { speed: number; scale?: number }): MinionLook {
  void preloadBeast(def.id);
  return (kind, p: MinionPalette): MinionRig => {
    const code = fallback(kind, p);
    const root = new THREE.Group(), holder = new THREE.Group();
    holder.scale.setScalar(def.scale ?? 1);
    holder.visible = false;
    root.add(code.root, holder);
    const seed = (made++ * 0.618034) % 1;
    const s: BeastState = { dt: 0, time: seed * 5, pose: { time: 0, walk: 0, swing: -1, shot: 0 }, gait: 0, stride: seed * Math.PI * 2, sinceShot: 99, seed, mem: {} };
    let model: { root: THREE.Object3D; list: { m: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color }[] } | null = null;
    let parts: BodyParts | null = null;
    const tint = new THREE.Color();
    const dress = () => {
      const src = landed.get(def.id);
      if (!src || model) return;
      model = cloneOf(src);
      holder.add(model.root);
      parts = new BodyParts(model.root);
      // The code look has stood in until now: it goes, and frees what it made.
      code.root.visible = false;
      root.remove(code.root);
      code.dispose?.();
      holder.visible = true;
    };
    dress();
    return {
      root,
      barY: def.barY,
      shotY: def.shotY,
      animate(dt: number, pose: MinionPose) {
        if (!model) {
          dress();
          if (!model) {
            code.animate(dt, pose);
            return;
          }
        }
        s.dt = Math.min(dt, 0.1);
        s.time += dt;
        s.pose = pose;
        s.gait += (pose.walk - s.gait) * Math.min(1, dt * 8);
        // The legs keep pace with how fast it goes: one stride carries it `stride` metres at its size.
        const size = (def.scale ?? 1) * (unit.scale ?? 1), m = (def.stride ?? 1) * size;
        s.stride += (dt * unit.speed * pose.walk * Math.PI * 2) / Math.max(0.2, m) + dt * 0.4 * (1 - s.gait);
        s.sinceShot = pose.shot > 0.95 ? 0 : s.sinceShot + dt;
        parts!.reset();
        def.pose(parts!, s);
        // The hit flash: the arena drives the palette's body (tinted or white); the model's materials follow it.
        const e = p.body.emissive, k = Math.max(e.r, e.g, e.b), f = Math.min(1, k / 0.45);
        if (k > 0.01) tint.setRGB(e.r / k, e.g / k, e.b / k);
        for (const { m: mat, color, emissive } of model.list) {
          mat.color.copy(color);
          const glowBy = mat.emissiveIntensity;
          mat.emissive.copy(emissive);
          if (f > 0) {
            if (k > 1.2) mat.emissive.addScalar((0.3 * f) / Math.max(0.1, glowBy));
            else {
              mat.color.lerp(tint, 0.08 * f);
              mat.emissive.r += (tint.r * 0.1 * f) / Math.max(0.1, glowBy);
              mat.emissive.g += (tint.g * 0.1 * f) / Math.max(0.1, glowBy);
              mat.emissive.b += (tint.b * 0.1 * f) / Math.max(0.1, glowBy);
            }
          }
        }
      },
      dispose() {
        code.dispose?.();
        if (model) {
          model.root.removeFromParent();
          for (const { m } of model.list) m.dispose();
        }
      },
    };
  };
}

/** Eases `key` in `s.mem` toward `to` at `rate` a second, and returns it. */
export function ease(s: BeastState, key: string, to: number, rate: number) {
  const v = s.mem[key] ?? to;
  return (s.mem[key] = v + (to - v) * Math.min(1, s.dt * rate));
}

/** A melee blow's shape over `pose.swing` (0 wind-up starts, 1 lands): `w` the wind-up, `k` the strike, both 0..1; nothing when not swinging. */
export function blow(swing: number, windUp = 0.65) {
  if (swing < 0) return { w: 0, k: 0 };
  if (swing < windUp) { const x = swing / windUp; return { w: x * x * (3 - 2 * x), k: 0 }; }
  const x = (swing - windUp) / (1 - windUp);
  return { w: 1 - x, k: Math.min(1, x * 1.6) };
}
