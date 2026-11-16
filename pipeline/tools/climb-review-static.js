// The Climb review, part 1 (docs/tower/review/): a floor's data and its static checks, no fight. A body for climb-review.py:
//   python -I pipeline/tools/climb-review.py pipeline/tools/climb-review-static.js --floor 1 --out docs/tower/review/floors-01-30/f01
// - texts: every word a player reads on the floor (name, blurb, people's lines, quests, doors, the rival, the lore stone, the law, the
//   enemies, the ruler and the gatekeeper), as the game has them (after `withFolk` and `withRulerModel`);
// - check: `_worldCheck` (a flood fill from the camp: every spot of the floor's data reachable?) and every person standing clear of cover;
// - props: climb-props-probe.js on this floor (float, gap, buried, cover);
// - grass: climb-grass-probe.js on this floor (small things on steep ground);
// - packs: whether server/climb-packs.mjs has this floor's packs as they are.
const R = window.__review;
const n = R.floor;
const out = (R.out = { floor: n });
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const F = await import('/src/tower/world/floors/index.ts');
const P = await import('/src/tower/world/pieces/floors.ts');
const def = F.FLOORS[n];
const pc = P.piecesOf(n);
const r1 = (v) => Math.round(v * 10) / 10;
const spot = (p) => (p ? [r1(p.x), r1(p.z)] : null);
out.texts = {
  id: def.id, name: def.name, blurb: def.blurb, ring: def.ring, par: def.par, shop: def.shop,
  law: { kind: def.law.kind, name: def.law.name, text: def.law.text ?? def.law.card ?? def.law.lines, raw: Object.fromEntries(Object.entries(def.law).filter(([k, v]) => typeof v === 'string' || (Array.isArray(v) && typeof v[0] === 'string'))) },
  people: def.people.map((p) => ({ id: p.id, name: p.name, role: p.role, hero: p.hero, figure: p.figure, at: spot(p.at), face: r1(p.face), greet: p.greet, quests: p.quests })),
  quests: def.quests.map((q) => ({ id: q.id, name: q.name, giver: q.giver, main: !!q.main, intro: q.intro, outro: q.outro, reward: q.reward, steps: q.steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v === 'string' || typeof v === 'number' || (Array.isArray(v) && typeof v[0] === 'string')))) })),
  doors: def.doors.map((d) => ({ id: d.id, piece: d.piece, name: d.name, at: spot(d.at), locked: d.locked, needs: d.needs, wall: !!d.wall })),
  rival: { hero: def.rival.hero, mode: def.rival.mode, goal: def.rival.goal, lines: def.rival.lines },
  lore: Object.fromEntries(Object.entries(def.lore).filter(([k, v]) => k !== 'at')),
  caches: def.caches.map((c) => ({ id: c.id, at: spot(c.at), ...Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v === 'string' && k !== 'id')) })),
  waystones: def.waystones.map((w) => ({ id: w.id, at: spot(w.at), name: w.name })),
  enemies: Object.fromEntries(Object.entries(def.enemies).map(([k, e]) => [k, { name: e.name, blurb: e.blurb, look: e.look, model: e.model }])),
  packs: def.packs.map((p) => ({ id: p.id, at: spot(p.at), mix: p.mix.map((m) => `${m.n}x${m.kind}`).join(' '), elite: p.elite, named: p.named ? { name: p.named.name, bounty: p.named.bounty } : undefined })),
  places: Object.fromEntries(Object.entries(def.places).map(([k, v]) => [k, { name: v.name, at: spot(v.stand ?? v) }])),
  pieces: pc ? JSON.parse(JSON.stringify(pc, (k, v) => (k === 'moves' || k === 'phases' || k === 'spots' ? undefined : v))) : null,
};
await __log(`texts done: ${def.name}`);
out.check = await _worldCheck({ floor: n });
// every person stands clear of cover (a person in a rock or a wall)
out.peopleInCover = [];
for (const p of def.people) for (const c of def.cover) {
  const ex = c.bx - c.ax, ez = c.bz - c.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((p.at.x - c.ax) * ex + (p.at.z - c.az) * ez) / l2)) : 0;
  const d = Math.hypot(p.at.x - (c.ax + ex * t), p.at.z - (c.az + ez * t));
  if (d < c.r + 0.3) out.peopleInCover.push({ person: p.id, d: r1(d), r: c.r, cover: [r1(c.ax), r1(c.az), r1(c.bx), r1(c.bz)], fixed: !!c.fixed });
}
await __log('check done');
const run = async (file, vars) => {
  Object.assign(window, vars);
  const text = await (await fetch(file)).text();
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(text)();
};
try { out.props = (await run('/pipeline/tools/climb-props-probe.js', { __probeFloors: [n], __probeAll: true }))[0]; } catch (e) { out.props = { error: String(e?.stack ?? e).slice(0, 400) }; }
await __log('props done');
try { out.grass = (await run('/pipeline/tools/climb-grass-probe.js', { __grassFloors: [n] }))[0]; } catch (e) { out.grass = { error: String(e?.stack ?? e).slice(0, 400) }; }
await __log('grass done');
try {
  const tab = await import('/server/climb-packs.mjs');
  const rows = tab.CLIMB_PACKS?.[n] ?? tab.default?.[n] ?? Object.values(tab).find((v) => v && typeof v === 'object' && v[n])?.[n];
  const want = def.packs.map((p) => [p.id, r1(p.at.x), r1(p.at.z)]);
  out.packsTable = { has: !!rows, same: JSON.stringify(rows?.map?.((r) => [r[0], r[1], r[2]])) === JSON.stringify(want), table: rows?.length ?? null, floor: want.length };
} catch (e) { out.packsTable = { error: String(e).slice(0, 200) }; }
return out;
