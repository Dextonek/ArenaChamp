import type { FloorDef, QuestDef } from './def';
import { PLAINS } from './plains-table';

/**
 * The hunting plains' quest (plains.ts has the plain itself): kept apart from the zone's code so that the floors' list (floors/index.ts)
 * and the tools that read it under node pull in no pack, no three.js.
 */

/** How many of them the hunt quest asks for. */
export const HUNT_N = 12;

/** The plain's kinds: those the floor's packs are made of (no named, no elite), the commonest first. */
export function plainKinds(floor: FloorDef) {
  const count = new Map<string, number>();
  for (const p of floor.packs) {
    if (p.named) continue;
    for (const m of p.mix) if (floor.enemies[m.kind] && m.kind !== p.elite) count.set(m.kind, (count.get(m.kind) ?? 0) + m.n);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * A floor with its hunting plain's quest: given by the floor's giver who gives the fewest (the giver's list gets it last), paying as
 * the floor's best side quest. Nothing when the floor has no plain or no giver. (floors/index.ts, after `withFolk`.)
 */
export function withPlain(n: number, def: FloorDef): FloorDef {
  const spot = PLAINS[n];
  if (!spot || def.quests.some((q) => q.id === 'hunt')) return def;
  const givers = def.people.filter((p) => p.role === 'giver');
  if (!givers.length || !plainKinds(def).length) return def;
  const giver = givers.slice().sort((a, b) => a.quests.length - b.quests.length)[0];
  const side = def.quests.filter((q) => !q.main).map((q) => q.reward.shards);
  const shards = side.length ? Math.max(...side) : 40;
  const place = spot.name.replace(/^The /, 'the ');
  const quest: QuestDef = {
    id: 'hunt', name: `The Hunt on ${spot.name.replace(/^The /, '')}`, giver: giver.id,
    intro: [`Out on ${place} the wild ones never stop coming. Fell ${HUNT_N} of them and the roads are safe for a day.`, 'They come back as fast as you fell them. Do not wait for the last one.'],
    steps: [{ verb: 'hunt', text: `Fell ${HUNT_N} on ${place}`, at: { x: spot.x, z: spot.z }, r: spot.r, n: HUNT_N }],
    outro: [`${HUNT_N}. That holds them a while. Take this.`],
    reward: { shards },
  };
  return {
    ...def,
    quests: [...def.quests, quest],
    people: def.people.map((p) => (p === giver ? { ...p, quests: [...p.quests, 'hunt'] } : p)),
  };
}
