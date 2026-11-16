// The model review, round 3 (docs/models/review/round3/): a Climb ruler in its real door fight, kneeling (stunned) and falling when the
// fight is won, from the game's camera and from the side at the floor's height, with the lowest point of its body (visible meshes only)
// against the floor. `window._floors = [21, 46]` first for others (21 the Scarab Colossus, 46 the Crow King).
//   python -I pipeline/tools/page-shots.py <a copy with window._floors first> <out folder> --port 5182 --json fall.json --timeout 500
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const FLOORS = window._floors ?? [21, 46];
const W = 360, H = 300;
const out = { metrics: {} };
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
for (const floor of FLOORS) {
  await _world({ floor, hero: 'Sefu', mode: 'play' });
  const g = _world.game(), def = g.floor, z = g.zone;
  const api = window.game?.api ?? { arena: vfx.arena, heroMode: vfx.heroMode, duel: vfx.duel, step: vfx.step };
  const door = def.doors.find((x) => x.piece === 'ruler');
  if (!door) { out.metrics[floor] = { error: 'no ruler door' }; continue; }
  z.setPacks(false);
  g.run.hp = 1;
  g.enterDoor(door);
  const t0 = performance.now();
  let i = 0;
  const frame = () => { api.step(1 / 60); g.tick(1 / 60); };
  while (performance.now() - t0 < 30000) {
    frame();
    if (++i % 4 === 0) await new Promise((ok) => setTimeout(ok, 16));
    if (g.piece === 'ruler' && api.duel?.figure?.loaded && i > 300) break;
  }
  const d = api.duel, a = api.arena, fig = d.figure, foe = d.foe.group.position;
  const V = foe.constructor;
  d.hurtHero = () => {};
  const at = foe.clone();
  // the hero 7 m to its south (the game's camera looks north, so the ruler is not behind the hero), a little to the west (out of the side view)
  a.caster.group.position.set(at.x - 4.5, 0, at.z + 7);
  api.heroMode.halt(); api.heroMode.snapCameraNow();
  const cam = api.heroMode.host?.camera;
  const render = () => (window.vfx ? vfx.render() : api.render());
  const visible = (m) => { for (let q = m; q && q !== fig.group; q = q.parent) if (!q.visible) return false; return true; };
  const v = new V();
  const low = () => {
    fig.group.updateMatrixWorld(true);
    let lo = 1e9;
    fig.group.traverse((m) => {
      if (!m.isMesh || !visible(m)) return;
      const P = m.geometry.attributes.position;
      for (let k = 0; k < P.count; k += 3) { if (m.isSkinnedMesh) m.getVertexPosition(k, v); else v.fromBufferAttribute(P, k); v.applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
    });
    return +(lo - foe.y).toFixed(2);
  };
  const height = (() => { fig.group.updateMatrixWorld(true); let hi = -1e9; fig.group.traverse((m) => { if (!m.isMesh || !visible(m)) return; const P = m.geometry.attributes.position; for (let k = 0; k < P.count; k += 7) { if (m.isSkinnedMesh) m.getVertexPosition(k, v); else v.fromBufferAttribute(P, k); v.applyMatrix4(m.matrixWorld); hi = Math.max(hi, v.y); } }); return hi - foe.y; })();
  const tiles = [];
  const grab = (label, crop) => {
    const src = canvas(), c = document.createElement('canvas');
    c.width = W; c.height = H;
    const gg = c.getContext('2d');
    const sh = src.height * crop, sw = sh * (W / H);
    gg.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
    gg.fillStyle = 'rgba(0,0,0,0.6)'; gg.fillRect(0, 0, W, 20);
    gg.fillStyle = '#ffd27a'; gg.font = '600 13px sans-serif'; gg.fillText(label, 5, 15);
    return c;
  };
  const m = { floor, name: d.opponentKit?.name, model: d.opponentKit?.model, height: +height.toFixed(2) };
  const moment = (label) => {
    render();
    const a1 = grab(label, 0.8);
    // from the south, inside the room (the hero's side of it), low over the floor: just over the barricades of the War's rooms
    const p = d.foe.group.position, R = Math.min(11, Math.max(6, height * 1.7));
    cam.position.set(p.x + R * 0.25, 1.6, p.z + R); cam.lookAt(p.x, 0.9, p.z); cam.updateMatrixWorld();
    render();
    const b1 = grab(label + ' (side, low)', 0.9);
    tiles.push([a1, b1]);
    m[label] = low();
    step();
  };
  // after the fight is won the piece shows it for a pause (`END_PAUSE`, real time) before the floor comes back: only the duel steps then
  let step = frame;
  for (let k = 0; k < 30; k++) frame();
  moment('standing');
  a.statusOf(d.foe).hold(3);
  for (let k = 0; k < 15; k++) frame();
  moment('kneel 0.25s');
  for (let k = 0; k < 75; k++) frame();
  moment('kneel 1.5s');
  for (let k = 0; k < 120; k++) frame();
  // the fight won (its health to nothing ends it the same way: duel.ts `finish('win')`); the duel lays it down (`figure.fall(overT / 0.6)`)
  a.setHp(d.foe, 0);
  if (!d.over) d.finish('win');
  m.over = d.over;
  step = () => api.step(1 / 60);
  let n = 0;
  const shots = [0.3, 0.6, 0.9, 1.2];
  for (const s of shots) {
    while (n < s * 60) { step(); n++; }
    moment(`fall ${s}s`);
  }
  out.metrics[floor] = m;
  // the sheet: two moments a row, each the game's camera then the side
  const sheet = document.createElement('canvas');
  sheet.width = 4 * W; sheet.height = Math.ceil(tiles.length / 2) * H;
  const gs = sheet.getContext('2d');
  tiles.forEach(([x, y], j) => { gs.drawImage(x, (j % 2) * 2 * W, Math.floor(j / 2) * H); gs.drawImage(y, ((j % 2) * 2 + 1) * W, Math.floor(j / 2) * H); });
  out[`fall-${floor}`] = sheet.toDataURL('image/jpeg', 0.85);
  _world.end();
}
return out;
