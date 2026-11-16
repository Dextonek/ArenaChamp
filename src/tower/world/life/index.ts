import * as THREE from 'three';
import type { ZoneCtx } from '../ctx';
import { GEN_FLOORS } from '../floors/gen';
import type { Law } from '../law';
import { HARBOUR } from '../floors/gen/harbour-big';
import type { SeaLook } from '../zone';
import { lifeTier, mulberry, quiet, type Life, type LifeEnv } from './core';
import { seaLife } from './sea';

/**
 * Builds a floor's life (core.ts says what it is and the rules it keeps), or null: the chapter has none yet, or it is switched off.
 * Called by the zone's fight when it starts (world.ts), beside the people and the scenery; updated in the zone's frame and put away
 * with it. Chapter I, the Sea, is the first (2026-11-16); the other four follow when the user has seen it.
 */
export function buildLife(c: ZoneCtx, law: Law | null): Life | null {
  const tier = lifeTier(c.api);
  if (!tier) return null;
  const n = c.def.n, chapter = Math.min(4, Math.max(0, Math.floor((n - 1) / 10)));
  if (chapter !== 0) return null;
  // (floor 1, the harbour, is the generator's too since it grew: floors/gen/harbour-big.ts)
  const look = ((n === 1 ? HARBOUR.look : GEN_FLOORS[n]?.baked.look) as unknown as SeaLook | undefined) ?? null;
  if (!look) return null;
  // Two streams of the life's own: one for its choices, one for three.js's ids (so the choices do not hang on how many objects three
  // makes), both from the floor's number: the same floor has the same life every time.
  const rnd = mulberry(0x51fe + n * 7919), ids = mulberry(0x1d5 + n * 104729);
  const group = new THREE.Group();
  group.name = 'life';
  const env: LifeEnv = { group, tier, rnd, time: { value: 0 }, own: [] };
  // What the land put past the edge (its depth's props and its scenes), read off the zone's drawing.
  let scenes: { kind: string; x: number; z: number; r: number; beyond: boolean }[] = [], marks: { x: number; z: number; r: number }[] = [];
  const root = c.api.duel.group.parent;
  root?.traverse((o) => {
    if (o.userData.seaScenes) scenes = o.userData.seaScenes;
    if (o.userData.depthMarks) marks = o.userData.depthMarks;
  });
  // A fight near (x, z): a unit of an awake pack within 12 m.
  const danger = (x: number, z: number) => {
    for (const k of c.packs.values()) if (k.state === 'awake') for (const u of k.units) if (Math.abs(u.pos.x - x) < 12 && Math.abs(u.pos.z - z) < 12 && Math.hypot(u.pos.x - x, u.pos.z - z) < 12) return true;
    return false;
  };
  let tideIn = false;
  const life = quiet(ids, () => seaLife(env, { def: c.def, look, scenes, marks, danger, tide: () => tideIn }, c.hero));
  c.p.group.add(group);
  (globalThis as { __lifeCounts?: unknown }).__lifeCounts = { floor: n, tier, ...life.counts };
  return {
    counts: life.counts,
    update(dt) {
      quiet(ids, () => {
        if (law) { const s = law.status(); tideIn = s.active || s.warn; }
        env.time.value += dt;
        life.update(dt);
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
          else mesh.geometry.dispose();
        });
      });
    },
  };
}
