// The Climb review, part 2 (docs/tower/review/): the route bot plays the floor camp to gate (`_worldRoute`, world-tool.js) and, on the
// way, a canvas picture is kept of each set piece a few seconds in (the rival, the trial, the ruler, the gate: their own models?) and
// of the first fights with each pack. A body for climb-review.py:
//   python -I pipeline/tools/climb-review.py pipeline/tools/climb-review-route.js --floor 1 --out docs/tower/review/floors-01-30/f01
// `window.__review.maxSeconds` (game seconds, default 2400).
const R = window.__review;
const n = R.floor;
const out = (R.out = { floor: n });
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const api = window.game.api;
const grabs = [];
let lastPiece = null, pieceFrames = 0, packSeen = new Set(), frames = 0;
const grab = (name) => {
  try {
    api.render();
    grabs.push([name, api.renderer.domElement.toDataURL('image/jpeg', 0.8)]);
  } catch (e) { grabs.push([name + '-failed', String(e)]); }
};
// What a piece put in the scene: the units and their looks (a model or a stand-in), read a few seconds in.
const units = () => {
  const a = api.arena, list = [];
  const add = (u, side) => list.push({ side, name: u.name ?? u.kind ?? u.id ?? '?', model: u.look?.model ?? u.model ?? u.look?.id ?? undefined, hp: Math.round(u.hp ?? 0) });
  try { for (const u of a.summons.alive('opponent')) add(u, 'foe'); } catch (e) { /* not there */ }
  return list.slice(0, 20);
};
const pieceNotes = [];
const t0 = performance.now();
const res = await _worldRoute({
  floor: n, hero: R.hero ?? 'Lyra', maxSeconds: R.maxSeconds ?? 2400, persist: false,
  until: (g) => {
    frames++;
    if (g.piece !== lastPiece) { lastPiece = g.piece; pieceFrames = 0; }
    if (g.piece) {
      pieceFrames++;
      if (pieceFrames === 240 || pieceFrames === 900) {
        const d = api.duel, k = d?.opponentKit, fig = d?.figure;
        pieceNotes.push({ piece: g.piece, at: pieceFrames, clock: Math.round(g.run.clock), opponent: k?.name, title: k?.title, model: k?.model, loaded: fig?.loaded, real: !!fig?.real, scale: fig?.group?.scale?.x, units: units() });
        const nth = grabs.filter((x) => x[0].startsWith('route-' + g.piece)).length;
        grab(`route-${g.piece}-${nth}`);
      }
    } else if (g.zone && frames % 30 === 0) {
      for (const p of g.zone.packs.values()) if (p.state === 'awake' && !packSeen.has(p.id)) { packSeen.add(p.id); p.__grabAt = frames + 90; }
      for (const p of g.zone.packs.values()) if (p.__grabAt && frames >= p.__grabAt) { delete p.__grabAt; grab(`route-pack-${p.id}`); }
    }
    return false;
  },
});
out.route = { ...res, whyAll: undefined, wallSeconds: Math.round((performance.now() - t0) / 1000) };
out.whyAll = res.whyAll;
out.pieceNotes = pieceNotes;
// the run's packs at the end: which were cleared, which slept through
out.packsEnd = res.last?.packs;
for (const [name, url] of grabs) if (url.startsWith('data:')) await __save(name, url);
out.grabs = grabs.map((g) => g[0]);
_world.end();
return out;
