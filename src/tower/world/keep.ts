import type { FloorDef } from './def';

/**
 * A floor's spots that the depth passes' props keep clear of (depth.ts through `LandSpec.keep`, woodDepth.ts, sandsDepth.ts, deepDepth.ts, warDepth.ts): the start and the camp, the lore stone,
 * people, packs and their patrols, waystones, caches, doors and every quest step's spots. Only for the looks: the zone builders see the
 * floor's look, not its people and quests, so the arena is handed these when it is made (floors/gen/arenas.ts).
 */
export function floorKeep(f: Omit<FloorDef, 'arena' | 'cover'>) {
  type Pt = { x: number; z: number };
  const out: Pt[] = [];
  const add = (p?: Pt) => { if (p) out.push({ x: p.x, z: p.z }); };
  add(f.start); add(f.camp); add(f.lore.at);
  for (const p of f.people) add(p.at);
  for (const p of f.packs) { add(p.at); p.named?.patrol.forEach(add); }
  for (const w of f.waystones) add(w.at);
  for (const c of f.caches) add(c.at);
  for (const d of f.doors) add(d.at);
  for (const q of f.quests) for (const st of q.steps) {
    const s = st as { at?: Pt; from?: Pt; to?: Pt; things?: { at: Pt }[]; path?: Pt[] }; // a step's spots, whatever its verb
    add(s.at); add(s.from); add(s.to); s.things?.forEach((t) => add(t.at)); s.path?.forEach(add);
  }
  return out;
}
