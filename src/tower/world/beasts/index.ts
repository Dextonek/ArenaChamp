import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  /** The file stem: models/tower/beasts/<id>.glb (or `url`). */
  id: string;
  /** Another file than the Climb's (the Raid's adds: models/raid/<id>.glb). */
  url?: string;
  /** How much bigger the rig is drawn than the model (the model is built at the code look's size: 1). */
  scale?: number;
  /** The health bar's height over the feet (m, at the model's size: `scale` and the unit's own are applied to it). */
  barY: number;
  /** Where its shots leave (m over the feet, at the model's size), for one that shoots. */
  shotY?: number;
  /** How far one stride carries it (m, before the unit's scale): its legs keep pace with how fast it goes. */
  stride?: number;
  pose(p: BodyParts, s: BeastState): void;
}

const URL_OF = (id: string) => `models/tower/beasts/${id}.glb`;
/** Where a beast's file is, by its key in `loads` (the id, or the url for one that has its own). */
const urls = new Map<string, string>();
const loads = new Map<string, Promise<THREE.Object3D | null>>();
const landed = new Map<string, THREE.Object3D>();
let loader: GLTFLoader | null = null;

/** Starts loading a beast's file (once); resolves when it has landed (or failed: null). */
export function preloadBeast(id: string, url?: string): Promise<THREE.Object3D | null> {
  if (url) urls.set(id, url);
  let p = loads.get(id);
  if (!p) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(urls.get(id) ?? URL_OF(id)).then((g) => {
      fewerDraws(g.scene);
      // As the people models (foeModels.ts `dress`): no shadow of their own, for a pack's frame on a phone.
      g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
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

/**
 * A model of rigid parts comes with one draw call for every material of every part (a hound 39, a crab 67, where a person of the Climb
 * is 5), and a pack is several of them. Once, as its file lands: within each part, the pieces of plain matte materials are merged
 * into one mesh coloured by vertex (one material for them all); a piece that glows or is metal keeps a mesh of its own, merged with
 * the part's others of the same kind. A hound comes to about 15.
 */
export function fewerDraws(scene: THREE.Object3D) {
  const plain = new Map<string, THREE.MeshStandardMaterial>();
  const groups: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.children.some((c) => (c as THREE.Mesh).isMesh)) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    if (meshes.length < 2) continue;
    // By kind: plain, metal, or a glow (its own material, so a pose's `glow` still finds it).
    const kinds = new Map<string, THREE.Mesh[]>();
    for (const m of meshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const glows = mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) * mat.emissiveIntensity > 0.01;
      const key = glows ? `glow:${mat.uuid}` : mat.metalness > 0.4 ? 'metal' : 'plain';
      kinds.set(key, [...(kinds.get(key) ?? []), m]);
    }
    for (const [key, list] of kinds) {
      if (list.length < 2 && !key.startsWith('plain') && !key.startsWith('metal')) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
        for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const c = (m.material as THREE.MeshStandardMaterial).color, n = geo.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
      });
      const merged = mergeGeometries(geos, false);
      for (const geo of geos) geo.dispose();
      if (!merged) continue;
      let mat = list[0].material as THREE.MeshStandardMaterial;
      if (key === 'plain' || key === 'metal') {
        let shared = plain.get(key);
        if (!shared) {
          const rough = list.reduce((a, m) => a + (m.material as THREE.MeshStandardMaterial).roughness, 0) / list.length;
          shared = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: key === 'metal' ? 0.4 : rough, metalness: key === 'metal' ? 0.7 : 0, flatShading: true });
          shared.name = `beast_${key}`;
          plain.set(key, shared);
        }
        mat = shared;
      } else {
        mat = mat.clone();
        mat.vertexColors = true;
        mat.color.setRGB(1, 1, 1);
      }
      const one = new THREE.Mesh(merged, mat);
      one.name = `${g.name}_${key.split(':')[0]}`;
      for (const m of list) { m.removeFromParent(); m.geometry.dispose(); }
      g.add(one);
    }
  }
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
  void preloadBeast(def.id, def.url);
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
      // The bar and the shots at the model's own size (`scale`), before the unit's.
      barY: def.barY * (def.scale ?? 1),
      shotY: def.shotY === undefined ? undefined : def.shotY * (def.scale ?? 1),
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
