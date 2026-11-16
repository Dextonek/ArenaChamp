import * as THREE from 'three';
import type { ZoneCtx } from '../ctx';
import { GEN_FLOORS } from '../floors/gen';
import type { Law } from '../law';
import { HARBOUR } from '../floors/gen/harbour-big';
import { WOOD_11 } from '../floors/woodGrown';
import { CANYON_21 } from '../floors/canyon-made';
import { DEEP_HOME } from '../floors/deep-home';
import { BANNERS_41 } from '../floors/banners-made';
import type { ChapterLook } from '../gen/types';
import type { SeaLook } from '../zone';
import { lifeTier, mulberry, quiet, type Life, type LifeEnv } from './core';
import { seaLife } from './sea';
import { woodLife } from './wood';

/** The look a floor is drawn from (its places, paths, cover...): the generator's, or the chapter's handmade first floor's. */
export function lifeLook(n: number): ChapterLook | null {
  const hand: Record<number, ChapterLook> = { 1: HARBOUR.look as unknown as ChapterLook, 11: WOOD_11.look, 21: CANYON_21.look, 31: DEEP_HOME.look as unknown as ChapterLook, 41: BANNERS_41.look };
  return hand[n] ?? (GEN_FLOORS[n]?.baked.look as ChapterLook | undefined) ?? null;
}

/** What each chapter's life gets besides the env: the floor and its look, what the land left past the edge, and the fights. */
export interface LifeIn {
  c: ZoneCtx;
  look: ChapterLook;
  /** The zone's drawing (the arena's group): what the land and the depth left in `userData`. */
  root: THREE.Object3D | null;
  /** A fight near (x, z): a unit of an awake pack within 12 m. */
  danger(x: number, z: number): boolean;
  /** The law is on or about to be (the tide comes, the storm crosses...). */
  law(): boolean;
  /** What the zone's depth and scenes put on the ground (props, scenes: x, z, reach), to keep off. */
  marks: { x: number; z: number; r: number }[];
}

/** What the zone's depth and scenes left in `userData` (each chapter's under its own names): every prop and scene, with its reach. */
function marksOf(root: THREE.Object3D | null) {
  const out: { x: number; z: number; r: number }[] = [];
  const add = (list: unknown) => {
    if (Array.isArray(list)) for (const m of list as { x?: unknown; z?: unknown; r?: unknown }[]) if (typeof m?.x === 'number' && typeof m.z === 'number') out.push({ x: m.x, z: m.z, r: typeof m.r === 'number' ? m.r : 1 });
  };
  root?.traverse((o) => {
    const u = o.userData;
    add(u.depthMarks);
    add(u.woodScenes);
    add(u.seaScenes);
    add(u.scenes);
    add(u.props);
    if (u.depth) { add(u.depth.solids); add(u.depth.scenes); }
  });
  return out;
}

type ChapterLife = (env: LifeEnv, inp: LifeIn, hero: THREE.Vector3) => Life;
/** One a chapter, in order: the Sea, the Wood, the Sands, the Deep, the War. A chapter without one has no life yet. */
const CHAPTERS: (ChapterLife | null)[] = [
  (env, inp, hero) => {
    // what the land put past the edge (its depth's props and its scenes, its houses and boats), read off the zone's drawing
    let scenes: { kind: string; x: number; z: number; r: number; beyond: boolean }[] = [], marks: { x: number; z: number; r: number }[] = [];
    let land: SeaLand | null = null;
    inp.root?.traverse((o) => {
      if (o.userData.seaScenes) scenes = o.userData.seaScenes;
      if (o.userData.depthMarks) marks = o.userData.depthMarks;
      if (o.userData.landLife) land = o.userData.landLife;
    });
    return seaLife(env, { def: inp.c.def, look: inp.look as unknown as SeaLook, scenes, marks, land, danger: inp.danger, tide: inp.law }, hero);
  },
  woodLife,
  null,
  null,
  null,
];

/** What the Sea's land drew (land.ts `landLife`): its houses with their chimneys' tops, its boats, its jetties (world). */
export interface SeaLand {
  homes: { x: number; z: number; r: number; chimney?: { x: number; z: number; top: number } }[];
  boats: { x: number; z: number }[];
  jetties: { x: number; z: number; yaw: number; len: number }[];
}

/**
 * Builds a floor's life (core.ts says what it is and the rules it keeps), or null: the chapter has none yet, or it is switched off.
 * Called by the zone's fight when it starts (world.ts), beside the people and the scenery; updated in the zone's frame and put away
 * with it. Chapter I, the Sea, was the first (2026-11-16); the others follow it, one file a chapter.
 */
export function buildLife(c: ZoneCtx, law: Law | null): Life | null {
  const tier = lifeTier(c.api);
  if (!tier) return null;
  const n = c.def.n, chapter = Math.min(4, Math.max(0, Math.floor((n - 1) / 10)));
  const make = CHAPTERS[chapter];
  if (!make) return null;
  const look = lifeLook(n);
  if (!look) return null;
  // Two streams of the life's own: one for its choices, one for three.js's ids (so the choices do not hang on how many objects three
  // makes), both from the floor's number: the same floor has the same life every time.
  const rnd = mulberry(0x51fe + n * 7919), ids = mulberry(0x1d5 + n * 104729);
  const group = new THREE.Group();
  group.name = 'life';
  const env: LifeEnv = { group, tier, rnd, time: { value: 0 }, own: [] };
  const root = c.api.duel.group.parent;
  // A fight near (x, z): a unit of an awake pack within 12 m.
  const danger = (x: number, z: number) => {
    for (const k of c.packs.values()) if (k.state === 'awake') for (const u of k.units) if (Math.abs(u.pos.x - x) < 12 && Math.abs(u.pos.z - z) < 12 && Math.hypot(u.pos.x - x, u.pos.z - z) < 12) return true;
    return false;
  };
  let lawOn = false;
  const life = quiet(ids, () => make(env, { c, look, root, danger, law: () => lawOn, marks: marksOf(root) }, c.hero));
  c.p.group.add(group);
  (globalThis as { __lifeCounts?: unknown }).__lifeCounts = { floor: n, tier, ...life.counts };
  return {
    counts: life.counts,
    update(dt) {
      quiet(ids, () => {
        if (law) { const s = law.status(); lawOn = s.active || s.warn; }
        env.time.value += dt;
        // (`globalThis.__lifeMs`: the tools add up the update's time there)
        const g = globalThis as { __lifeMs?: number };
        if (g.__lifeMs === undefined) life.update(dt);
        else { const t0 = performance.now(); life.update(dt); g.__lifeMs += performance.now() - t0; }
      });
    },
    dispose() {
      quiet(ids, () => {
        life.dispose();
        group.removeFromParent();
        for (const o of env.own) o.dispose();
        // (a walker's figure shares its geometry with the model's cache, which the floor's people use too: only its own materials go)
        group.traverse((o) => {
          const mesh = o as THREE.SkinnedMesh;
          if (!mesh.isMesh) return;
          if (mesh.isSkinnedMesh) { for (const mt of [mesh.material].flat()) mt.dispose(); mesh.skeleton?.dispose(); }
          else {
            mesh.geometry.dispose();
            if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); // its instance buffers
          }
        });
      });
    },
  };
}
