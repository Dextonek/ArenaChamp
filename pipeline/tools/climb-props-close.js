// The Climb's props up close (2026-11-19, the user: "make it more details", the floors' props): on one floor, the first piece of each
// kind of cover the floor draws, from the game camera's side and closer. A body for page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/climb-props-close.js docs/tower/props/detail/before --page /game --browser msedge --port 5182
//
// window.__props = { floor, kinds } picks another floor (default 4) or only some kinds.
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const { GEN_FLOORS } = await import('/src/tower/world/floors/gen/index.ts');
const n = window.__props?.floor ?? 4;
const look = GEN_FLOORS[n].baked.look;
await _world({ floor: n, hero: 'Lyra', mode: 'play' });
const g = _world.game();
g.zone.setPacks(false);
_world.go(g.floor.start.x + 60, g.floor.start.z + 60);
_world.step(1);
await new Promise((r) => setTimeout(r, 1500)); // the harbour file's props load in the background
const kinds = new Map();
look.pieces.forEach((p, i) => { const k = (look.kinds?.[i]) ?? p.look; if (k !== 'edge' && !kinds.has(k)) kinds.set(k, p); });
// the camp's own pieces first (fire, tents, crates), as they stand together
const want = window.__props?.kinds;
const list = [...kinds.entries()].filter(([k]) => !want || want.includes(k));
const W = 400, H = 300, COLS = 4;
const c = document.createElement('canvas');
c.width = W * COLS; c.height = H * Math.ceil((list.length + 1) / COLS);
const g2 = c.getContext('2d');
g2.fillStyle = '#111'; g2.fillRect(0, 0, c.width, c.height);
const cam = api.heroMode.host?.camera ?? api.camera;
let k = 0;
const shoot = (at, dist, height, label) => {
  cam.position.set(at.x + dist * 0.35, height, at.z + dist); cam.lookAt(at.x, height * 0.25, at.z); cam.updateMatrixWorld();
  api.render();
  const gl = api.renderer.domElement, sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const x = (k % COLS) * W, y = Math.floor(k / COLS) * H;
  g2.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  g2.font = '600 13px system-ui, sans-serif';
  g2.fillStyle = 'rgba(0,0,0,0.65)'; g2.fillRect(x, y, g2.measureText(label).width + 10, 19);
  g2.fillStyle = '#fff'; g2.fillText(label, x + 5, y + 14);
  k++;
};
// the camp, whole
shoot({ x: g.floor.start.x, z: g.floor.start.z - 4 }, 11, 7, `${n}: the camp`);
for (const [kind, p] of list) {
  const o = p.o, mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, size = Math.max(o.r * 2, Math.hypot(o.bx - o.ax, o.bz - o.az) + o.r * 2, o.height ?? 1);
  shoot({ x: mx, z: mz }, Math.max(4, size * 1.8), Math.max(2.4, size * 1.1), `${n}: ${kind}`);
}
return { kinds: list.map(([kk]) => kk), sheet: c.toDataURL('image/jpeg', 0.88) };
