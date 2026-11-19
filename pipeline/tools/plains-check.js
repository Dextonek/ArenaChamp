// The hunting plains played (2026-11-19, plains.ts): per floor, the hunt quest taken, the hero set down by the plain and the autopilot
// sent at the nearest wild one until twelve have fallen (at most `maxS` game seconds). Counts how many wild ones stand at once, how many
// came back, the falls; takes pictures (the plain as the hero walks up, the fight, from above). A body for page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/plains-check.js docs/tower/hunting --page /game --browser msedge --port 5182 --json plains-check.json
//
// window.__plains = { floors: [...], maxS } picks other floors.
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const { PLAINS } = await import('/src/tower/world/plains-table.ts');
const FLOORS = window.__plains?.floors ?? [4, 14, 24, 34, 44];
const maxS = window.__plains?.maxS ?? 300;
const W = 480, H = 300, COLS = 3;
const sheet = document.createElement('canvas');
sheet.width = W * COLS; sheet.height = H * FLOORS.length;
const g2 = sheet.getContext('2d');
g2.fillStyle = '#111'; g2.fillRect(0, 0, sheet.width, sheet.height);
const put = (row, col, label) => {
  api.render();
  const gl = api.renderer.domElement, sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  g2.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, col * W, row * H, W, H);
  g2.font = '600 14px system-ui, sans-serif';
  g2.fillStyle = 'rgba(0,0,0,0.6)'; g2.fillRect(col * W, row * H, g2.measureText(label).width + 14, 22);
  g2.fillStyle = '#fff'; g2.fillText(label, col * W + 7, row * H + 16);
};
const out = { floors: {} };
let row = 0;
for (const n of FLOORS) {
  const rec = {};
  try {
    const plain = PLAINS[n];
    await _world({ floor: n, hero: 'Lyra', mode: 'run', manual: true });
    const g = _world.game(), z = g.zone, def = g.floor, run = g.run;
    const quest = def.quests.find((q) => q.id === 'hunt');
    const giver = def.people.find((p) => p.quests.includes('hunt'));
    rec.plain = plain; rec.quest = quest ? { name: quest.name, giver: giver?.name, step: quest.steps[0].text, reward: quest.reward.shards } : null;
    const wild = () => [...z.packs.values()].filter((p) => p.wild);
    rec.wildMade = wild().length;
    rec.kinds = [...new Set(wild().map((p) => p.def.mix[0].kind))];
    z.quests.take('hunt');
    // set down on the plain's inward side (towards the floor's middle): its outer side may be past the outline
    const ux = 0 - plain.x, uz = 7 - plain.z, ul = Math.hypot(ux, uz) || 1;
    _world.go(plain.x + (ux / ul) * (plain.r + 8), plain.z + (uz / ul) * (plain.r + 8));
    _world.step(1.5);
    put(row, 0, `${n} ${plain.name}: walking up`);
    let maxUnits = 0, maxAwake = 0, shot = false, t = 0, ids = new Set();
    const s0 = run.shards, k0 = run.kills;
    while (t < maxS && !run.q('hunt').done) {
      const tg = z.quests.target();
      z.bot.goal(tg);
      _world.step(0.5); t += 0.5;
      const w = wild();
      for (const p of w) ids.add(p.id);
      const units = w.reduce((a, p) => a + p.units.length, 0), awake = w.filter((p) => p.state === 'awake').length;
      maxUnits = Math.max(maxUnits, units); maxAwake = Math.max(maxAwake, awake);
      if (!shot && awake >= 3) {
        shot = true;
        put(row, 1, `${n}: the hunt (${awake} awake)`);
      }
      if (Math.floor(t) % 20 === 0) await new Promise((ok) => setTimeout(ok, 0));
    }
    if (!shot) put(row, 1, `${n}: the hunt`);
    const cam = api.heroMode.host?.camera ?? api.camera;
    const hi = n > 30 && n <= 40 ? 13 : 26; // the Deep has a roof
    cam.position.set(plain.x, hi, plain.z + hi * 0.85); cam.lookAt(plain.x, 0, plain.z); cam.updateMatrixWorld();
    put(row, 2, `${n}: from above`);
    // the big map (M), with the plain's ring and name: its own canvas
    if (row === 0) {
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
      _world.step(0.2);
      const big = [...document.querySelectorAll('canvas')].filter((c) => c.width > 300 && c !== api.renderer.domElement && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0).sort((a, b) => b.width - a.width)[0];
      if (big) out.map = big.toDataURL('image/jpeg', 0.88);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
    }
    const q = run.q('hunt');
    Object.assign(rec, {
      done: q.done, progress: q.progress, seconds: t, kills: run.kills - k0, shardsFromKills: run.shards - s0, falls: z.falls,
      maxUnitsAtOnce: maxUnits, maxAwake, wildIdsSeen: ids.size, cameBack: ids.size - rec.wildMade, cap: api.arena.summons.cap,
    });
  } catch (e) {
    rec.err = String(e?.stack ?? e).slice(0, 400);
  }
  out.floors[n] = rec;
  row++;
  try { _world.end(); } catch (e) { /* none */ }
}
out.sheet = sheet.toDataURL('image/jpeg', 0.86);
return out;
