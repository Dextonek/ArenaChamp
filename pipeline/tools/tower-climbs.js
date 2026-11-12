// The Tower's measurement, headless: ten heroes climb this week's Tower twice each on the autopilot, then three of them climb
// two other weeks' Towers once, so the numbers are not tuned to one Tower only. About three minutes.
//
//   python pipeline/tools/page-shots.py pipeline/tools/tower-climbs.js <out folder> --page /game --timeout 590 --port 5199 --json tower-climbs.json
//
// (In Git Bash put MSYS_NO_PATHCONV=1 before it, or `/game` is rewritten into a path.) What it returns: per hero the floor each
// climb ended on, per kind and per floor what it cost (pipeline/tools/tower-tool.js), and every error in the page.
eval(await (await fetch('/pipeline/tools/tower-tool.js')).text());
const { isoWeek } = await import('/src/tower/week.ts');
const wait = async () => { const t0 = Date.now(); while (!_tower.done() && Date.now() - t0 < 400000) await new Promise((r) => setTimeout(r, 500)); };
const t0 = Date.now();
const week = isoWeek().id;
_tower(['Lyra', 'Bram', 'Kaia', 'Sefu', 'Vesper', 'Brannoc', 'Isolde', 'Nyx', 'Mortis', 'Auriel'], 2);
await wait();
const main = { week, done: _tower.done(), show: _tower.show(), floors: _tower.floors(), errors: _tower.errors() };
// The two weeks after this one.
const other = {};
for (const days of [7, 14]) {
  const next = isoWeek(new Date(Date.now() + days * 86400000)).id;
  _tower(['Kaia', 'Brannoc', 'Sefu'], 1, { week: next });
  await wait();
  other[next] = { show: _tower.show(), floors: _tower.floors(), errors: _tower.errors() };
}
return { ...main, other, wall: (Date.now() - t0) / 1000 };
