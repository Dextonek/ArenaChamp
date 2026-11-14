import type { QuestDef, Step } from '../def';
import { RING, dist, roadRoute, r2, type V } from './core.ts';
import { makeSeaFloor } from './sea.ts';
import type { GenFloor } from './types';

/**
 * Floor 1, the Drowned Harbour, grown to the Climb's new size (the user, 2026-11-14: the maps five times larger, "it doesnt need to
 * have circular shape", and the handmade floors grow too). The sea's generator lays the floor out (floor 1's numbers, the sea to the
 * east, as the harbour always had it); this dresses it as the harbour: its names, its people (Gus, Anka, Pip, Zephyr), its quests and
 * their words, Old Barnacle, Tam the Net-Mender, Zephyr's race to the lighthouse, the Drowned Captain behind the lair's door.
 *
 * A run saved on the small harbour carries on: the ids it keeps are the old ones (the quests `main`, `bounty`, `anka-net`, `anka-tam`;
 * the packs `market`, `wreck`, `caves`, `barnacle`; the places `market`, `caves`, `lighthouse`, `wreck`). Its set pieces are floor 1's
 * own (pieces/floors.ts), not the generator's.
 */
export function makeHarbourFloor(o: { attempt?: number } = {}): GenFloor {
  // A layout whose main place is a market and whose key lies in a wreck, as the harbour's always did.
  let g: GenFloor | null = null;
  for (let a = o.attempt ?? 0; !g && a < (o.attempt ?? 0) + 60; a++) {
    try {
      const t = makeSeaFloor({ n: 1, attempt: a }), kind = (id: string) => (t.look.places as { id: string; kind?: string }[]).find((p) => p.id === id)?.kind;
      if (kind('a') === 'market' && kind('d') === 'wreck') g = t;
    } catch { /* no layout from this seed: the next */ }
  }
  if (!g) throw new Error('the harbour: no layout with a market and a wreck in sixty seeds');
  const f = g.floor;

  // --- ids: the small harbour's, so a saved run carries on ---------------------------------------------------------------------
  const PLACE: Record<string, string> = { a: 'market', b: 'caves', c: 'lighthouse', d: 'wreck' };
  const PACK: Record<string, string> = { a: 'market', d: 'wreck', b: 'caves', named1: 'barnacle' };
  const QUEST: Record<string, string> = { bounty1: 'bounty', g1: 'anka-net', g2: 'anka-tam' };
  const PERSON: Record<string, string> = { keeper: 'gus', giver: 'anka', trader: 'pip', rival: 'zephyr' };
  const names: Record<string, string> = { a: 'The fish market', b: 'The caves', c: 'The lighthouse', d: 'The wreck', e: 'The beacon' };
  f.places = Object.fromEntries(Object.entries(f.places).map(([k, p]) => {
    const id = PLACE[k] ?? k;
    return [id, { ...p, id, name: names[k] ?? p.name }];
  }));
  g.look.places = (g.look.places as { id: string }[]).map((p) => ({ ...p, id: PLACE[p.id] ?? p.id }));
  f.packs = f.packs.map((p) => ({ ...p, id: PACK[p.id] ?? p.id, ...(p.id === 'named1' && p.named ? { named: { ...p.named, name: 'Old Barnacle' } } : {}) }));
  f.enemies.named1 = { ...f.enemies.named1, name: 'Old Barnacle', blurb: 'Walks the harbour and strikes hard.' };
  f.enemies.mate = { ...f.enemies.mate, blurb: 'Guards the wreck.' };
  const renameStep = (s: Step): Step => {
    if (s.verb === 'fell') return { ...s, packs: s.packs.map((id) => PACK[id] ?? id) };
    if (s.verb === 'fell-named') return { ...s, pack: PACK[s.pack] ?? s.pack, text: s.pack === 'named1' ? 'Fell Old Barnacle' : s.text };
    if (s.verb === 'lead') return { ...s, name: 'Tam', text: 'Lead Tam from the caves to the camp' };
    return s;
  };
  const words: Record<string, Partial<QuestDef>> = {
    main: {
      name: 'The Captain’s Key',
      intro: ['Four things. Clear the fish market, where they gather. Light the lighthouse and the beacon, so the boats know the harbour lives. Last, the captain’s key lies in the wreck, and the Mate guards it: clear them, then bring the key to the winch by the camp.'],
      outro: ['The chain falls. The Drowned Captain’s door stands open, far in the north. Take your time, then go in.'],
    },
    bounty: { name: 'Old Barnacle', intro: ['Old Barnacle walks the middle of the harbour. A hundred tides on him. Fell him and the sea quietens a little.'], outro: ['A relic from a barnacle. Keep it.'] },
    'anka-net': { intro: ['My boat lies on the shore. My net lines are hauled from a spot far in the north: hold the place while I do.'] },
    'anka-tam': { name: 'Tam the Net-Mender', intro: ['Tam mends nets in the caves. He will not come out alone. Walk him back to the camp; stand close and he follows the road.'], outro: ['Tam is home. He pays in what he has.'] },
  };
  f.quests = f.quests.map((q) => {
    const id = QUEST[q.id] ?? q.id;
    return { ...q, id, giver: PERSON[q.giver] ?? q.giver, steps: q.steps.map(renameStep), ...(words[id] ?? {}) };
  });
  const greet: Record<string, string> = {
    gus: 'Another climber. The tide took the last ones, and the market is overrun. The Drowned Captain sits in his lair far to the north, behind a chain only the captain’s key will lift. The coast is long: take the roads.',
    anka: 'The sea washed me up here. I keep losing things to it. Perhaps you can fetch them.',
    pip: 'Shards for what you need. Prices are fixed; the sea does not haggle either.',
  };
  const hero: Record<string, string> = { gus: 'Gus', anka: 'Anka', pip: 'Pip', zephyr: 'Zephyr', villager: 'Mabel' };
  f.people = f.people.map((p) => {
    const id = PERSON[p.id] ?? p.id;
    return { ...p, id, hero: hero[id] ?? p.hero, name: hero[id] ?? p.name, greet: greet[id] ? [greet[id]] : p.greet, quests: p.quests.map((q) => QUEST[q] ?? q) };
  });

  // --- Zephyr's race to the lighthouse, as on the small harbour ----------------------------------------------------------------------
  // The runner goes by the roads; a person who goes straight should win by a few seconds (on the small harbour: 15 s against 9 to 12).
  const zephyr = f.people.find((p) => p.id === 'zephyr')!, light = f.places.lighthouse.stand;
  const roads = (g.look.paths as [number, number][][]).map((r) => r.map(([dx, dz]): V => ({ x: RING.x + dx, z: RING.z + dz })));
  const route = [zephyr.at, ...roadRoute(roads, zephyr.at, light), light].map((p) => ({ x: r2(p.x), z: r2(p.z) }));
  const runLen = route.slice(1).reduce((s, p, i) => s + dist(route[i], p), 0), straight = dist(zephyr.at, light);
  const pace = r2(Math.min(0.95, runLen / (straight + 6 * 4))); // the runner takes about 6 s more than a straight walk at 4 m/s
  f.rival = {
    hero: 'Zephyr', goal: 'the lighthouse', mode: 'race', at: zephyr.at, to: light, r: 3, pace, route, boon: true,
    lines: ['Another climber? I am Zephyr, and I am faster. To the lighthouse: whoever touches its foot first. Care to try?'],
  };
  f.doors = f.doors.filter((d) => d.piece !== 'rival').map((d) => {
    if (d.piece === 'ruler') return { ...d, name: 'The Drowned Captain’s lair', locked: 'A chain holds the lair shut. Gus has a quest about a key.' };
    if (d.piece === 'trial') return { ...d, name: 'The Flooded Vault' };
    if (d.piece === 'gate') return { ...d, locked: 'The gate is sealed. Its warden answers only once the Drowned Captain has fallen.' };
    return d;
  });

  // --- the floor itself ------------------------------------------------------------------------------------------------------------
  f.id = 'harbour';
  f.name = 'The Drowned Harbour';
  f.blurb = 'A harbour town the sea keeps taking back, tide by tide.';
  delete f.tunedAs;
  f.lore = { ...f.lore, name: 'The tide stone', text: ['The sea came in once and kept what it liked.', 'Those who swore to the harbour still stand watch, drowned, at their posts.'] };
  return g;
}
