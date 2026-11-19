// Which way the Climb's figures face, as the game places them (2026-11-19, the user: "correct the directional", "models facing wrong").
// A body for page-shots.py on the game page:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/climb-facing.js docs/tower/facing --page /game --browser msedge --port 5182 --json facing.json
//
// - enemies: every enemy kind of the Climb (one floor where it lives), as a pack of one walking a straight loop north-south; pictured
//   from in front at the moment it walks south (towards the camera). Its face should be towards you.
// - people: every person of the chapters' first floors, from the side its `face` says it faces (4.5 m out). Its face should be towards you.
// window.__facing = { floors: [...] } picks the floors for people (default 1, 11, 21, 31, 41).
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const { FLOORS } = await import('/src/tower/world/floors/index.ts');
const { Pack } = await import('/src/tower/world/packs.ts');
const W = 240, H = 260;
const sheets = {};
const sheetOf = (name, n) => (sheets[name] ??= (() => { const c = document.createElement('canvas'); c.width = W * 8; c.height = H * Math.ceil(n / 8); const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height); return { c, g, k: 0 }; })());
const cam = () => api.heroMode.host?.camera ?? api.camera;
const shoot = (sheet, at, from, label) => {
  const c = cam();
  c.position.set(from.x, from.y, from.z); c.lookAt(at.x, at.y, at.z); c.updateMatrixWorld();
  api.render();
  const gl = api.renderer.domElement, sw = gl.width, sh = gl.height, side = Math.min(sw, sh) * 0.6, ar = W / H;
  const cw = side * ar, ch = side;
  const x = (sheet.k % 8) * W, y = Math.floor(sheet.k / 8) * H;
  sheet.g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  sheet.g.font = '600 12px system-ui, sans-serif';
  sheet.g.fillStyle = 'rgba(0,0,0,0.65)'; sheet.g.fillRect(x, y, sheet.g.measureText(label).width + 10, 18);
  sheet.g.fillStyle = '#fff'; sheet.g.fillText(label, x + 5, y + 13);
  sheet.k++;
};
const out = { enemies: [], people: [] };

// --- every enemy kind, walking towards the camera -----------------------------------------------------------------------------------
const kinds = new Map();
for (const n of Object.keys(FLOORS).map(Number).sort((a, b) => a - b)) {
  const f = FLOORS[n];
  for (const [k, e] of Object.entries(f.enemies)) if (!kinds.has(k) && !e.named && !/^named/.test(k)) kinds.set(k, n);
}
const es = sheetOf('enemies', kinds.size);
let floorNow = -1;
for (const [kind, n] of kinds) {
  const rec = { kind, floor: n };
  try {
    if (floorNow !== n) { try { _world.end(); } catch (e) { /* none */ } await _world({ floor: n, hero: 'Lyra', mode: 'play' }); floorNow = n; }
    const g = _world.game(), z = g.zone, def = g.floor;
    z.setPacks(false);
    const env = [...z.packs.values()][0].env;
    const x = def.start.x + 14, zz = def.start.z - 18;
    const pack = new Pack({ id: `facing-${kind}`, at: { x, z: zz - 8 }, mix: [{ kind, n: 1 }], roam: { patrol: [{ x, z: zz - 8 }, { x, z: zz + 8 }], speed: 1.2 } }, env);
    pack.wild = true;
    z.packs.set(pack.id, pack);
    _world.go(x + 13, zz);
    let ok = false;
    for (let i = 0; i < 200 && !ok; i++) {
      _world.step(0.1);
      const u = pack.units[0];
      if (u && pack.state === 'asleep') { const yaw = pack.patrolAt(def ? g.run.clock : 0).yaw; if (Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) < 0.2) ok = true; }
    }
    // its model loads in the background: real time, the patrol held still meanwhile is fine (it is asleep, walking its loop)
    for (let i = 0; i < 25 && !(pack.units[0]?.figure?.loaded ?? true); i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 200; i++) { const yaw = pack.patrolAt(g.run.clock).yaw; if (Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) < 0.2) break; _world.step(0.1); }
    const u = pack.units[0];
    if (u) {
      const fy = u.figure.group.rotation.y;
      shoot(es, { x: u.pos.x, y: 1.1, z: u.pos.z }, { x: u.pos.x, y: 2.6, z: u.pos.z + 6.5 }, `${kind} (${n})`);
      rec.yaw = +fy.toFixed(2);
    } else rec.err = 'no unit';
    pack.dispose(); z.packs.delete(pack.id);
  } catch (e) { rec.err = String(e).slice(0, 200); }
  out.enemies.push(rec);
}

// --- the people, from the side they face ---------------------------------------------------------------------------------------------
const PF = window.__facing?.floors ?? [1, 11, 21, 31, 41];
const total = PF.reduce((s, n) => s + FLOORS[n].people.length, 0);
const ps = sheetOf('people', total);
for (const n of PF) {
  try { _world.end(); } catch (e) { /* none */ }
  await _world({ floor: n, hero: 'Lyra', mode: 'play' });
  const g = _world.game(), def = g.floor;
  g.zone.setPacks(false);
  _world.go(def.start.x + 40, def.start.z - 40);
  _world.step(1.5);
  // the people's models load in the background
  const figs = g.zone.people?.figs;
  for (let i = 0; i < 150 && figs && [...figs.values()].some((f) => !f.fig.loaded || !f.fig.group.visible); i++) { _world.step(0.1); await new Promise((r) => setTimeout(r, 100)); }
  for (const p of def.people) {
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    shoot(ps, { x: p.at.x, y: 1.2, z: p.at.z }, { x: p.at.x + fx * 5, y: 2.3, z: p.at.z + fz * 5 }, `${n} ${p.name}`);
    out.people.push({ floor: n, id: p.id, name: p.name, face: p.face });
  }
}
try { _world.end(); } catch (e) { /* none */ }
for (const [k, s] of Object.entries(sheets)) out[k] = s.c.toDataURL('image/jpeg', 0.86);
return out;
