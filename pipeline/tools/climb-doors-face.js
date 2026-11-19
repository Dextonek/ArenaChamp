// The Climb's arches, lore stones and chests: which way they face (2026-11-19, the user: "correct the directional"). Per floor, every
// arch (a door with no wall) from above with its road, the lore stone and the first cache from the game's own camera side. A body for
// page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/climb-doors-face.js docs/tower/facing/after --page /game --browser msedge --port 5182
//
// window.__doorFloors = [...] picks the floors (default 4, 14, 24, 34, 44).
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const FLOORS = window.__doorFloors ?? [4, 14, 24, 34, 44];
const W = 320, H = 240, COLS = 6;
const c = document.createElement('canvas');
c.width = W * COLS; c.height = H * FLOORS.length;
const g2 = c.getContext('2d');
g2.fillStyle = '#111'; g2.fillRect(0, 0, c.width, c.height);
const cam = () => api.heroMode.host?.camera ?? api.camera;
const shoot = (row, col, at, from, label) => {
  const k = cam();
  k.position.set(from.x, from.y, from.z); k.lookAt(at.x, at.y, at.z); k.updateMatrixWorld();
  api.render();
  const gl = api.renderer.domElement, sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  g2.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, col * W, row * H, W, H);
  g2.font = '600 12px system-ui, sans-serif';
  g2.fillStyle = 'rgba(0,0,0,0.65)'; g2.fillRect(col * W, row * H, g2.measureText(label).width + 10, 18);
  g2.fillStyle = '#fff'; g2.fillText(label, col * W + 5, row * H + 13);
};
const out = { floors: {} };
let row = 0;
for (const n of FLOORS) {
  try { _world.end(); } catch (e) { /* none */ }
  await _world({ floor: n, hero: 'Lyra', mode: 'play' });
  const g = _world.game(), def = g.floor;
  g.zone.setPacks(false);
  _world.go(def.start.x + 30, def.start.z + 30);
  _world.step(1);
  let col = 0;
  const rec = [];
  for (const d of def.doors.filter((x) => !x.wall).slice(0, 4)) {
    shoot(row, col++, { x: d.at.x, y: 0, z: d.at.z }, { x: d.at.x, y: 16, z: d.at.z + 7 }, `${n} ${d.piece} (from above)`);
    rec.push(d.id);
  }
  const l = def.lore.at;
  shoot(row, col++, { x: l.x, y: 1.2, z: l.z }, { x: l.x, y: 6, z: l.z + 7 }, `${n} lore stone`);
  const ch = def.caches[0];
  if (ch) shoot(row, col++, { x: ch.at.x, y: 0.6, z: ch.at.z }, { x: ch.at.x, y: 4.5, z: ch.at.z + 5 }, `${n} cache`);
  out.floors[n] = rec;
  row++;
}
try { _world.end(); } catch (e) { /* none */ }
out.doors = c.toDataURL('image/jpeg', 0.86);
return out;
