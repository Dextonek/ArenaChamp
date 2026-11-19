// Pictures of the Climb's roads in the game's own camera (2026-11-19, the user: "lets make road more cleanly and like put them into
// scenario"). Per floor, three spots on its roads: the middle of its longest straight, its sharpest bend, and where a road meets a place.
// One sheet (rows = floors). A body for page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/climb-roads.js docs/tower/roads/before --page /game --browser msedge --port 5182
//
// window.__roads = { floors: [..] } picks other floors (default: one generated floor a chapter, and floor 1).
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const { GEN_FLOORS } = await import('/src/tower/world/floors/gen/index.ts');
const FLOORS = window.__roads?.floors ?? [1, 4, 14, 24, 34, 44];
const W = 480, H = 300, COLS = 4;
const c = document.createElement('canvas');
c.width = W * COLS; c.height = H * FLOORS.length;
const g2 = c.getContext('2d');
g2.fillStyle = '#111'; g2.fillRect(0, 0, c.width, c.height);
const put = (row, col, label) => {
  api.render();
  const gl = api.renderer.domElement;
  const sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const x = col * W, y = row * H;
  g2.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  g2.font = '600 14px system-ui, sans-serif';
  g2.fillStyle = 'rgba(0,0,0,0.6)';
  g2.fillRect(x, y, g2.measureText(label).width + 14, 22);
  g2.fillStyle = '#fff';
  g2.fillText(label, x + 7, y + 16);
};
const out = { floors: {} };
let row = 0;
for (const n of FLOORS) {
  try {
    await _world({ floor: n, hero: 'Lyra', mode: 'play' });
    const g = _world.game(), def = g.floor, z = g.zone;
    try { z.hud.closeCard(); } catch (e) { /* none */ }
    for (const b of document.querySelectorAll('button')) if (/^(Begin|Go|Start|OK|Close|Continue|Onward)$/i.test(b.textContent.trim()) && b.offsetParent) b.click();
    z.setPacks(false);
    const paths = GEN_FLOORS[n]?.baked.look.paths ?? (await import('/src/tower/world/floors/gen/harbour-big.ts').then((m) => Object.values(m).find((v) => v?.look?.paths)?.look.paths).catch(() => null)) ?? [];
    const W0 = (p) => ({ x: p[0], z: p[1] + 7 });
    // the longest straight, the sharpest bend
    let best = null, bend = null;
    for (const pth of paths) for (let i = 1; i < pth.length; i++) {
      const a = pth[i - 1], b = pth[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!best || len > best.len) best = { len, at: W0([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) };
      if (i + 1 < pth.length) {
        const c3 = pth[i + 1];
        const t1 = Math.atan2(b[0] - a[0], b[1] - a[1]), t2 = Math.atan2(c3[0] - b[0], c3[1] - b[1]);
        let turn = Math.abs(t2 - t1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
        if (!bend || turn > bend.turn) bend = { turn, at: W0(b) };
      }
    }
    // where a road meets a place: a road's end nearest a place's rim (not the camp)
    let meet = null;
    for (const pth of paths) for (const e of [pth[0], pth[pth.length - 1]]) {
      const w = W0(e);
      for (const [k, p] of Object.entries(def.places ?? {})) {
        if (k === 'camp') continue;
        const d = Math.abs(Math.hypot(p.x - w.x, p.z - w.z) - (p.r ?? 8));
        if (!meet || d < meet.d) meet = { d, at: { x: w.x + (p.x - w.x) * 0.25, z: w.z + (p.z - w.z) * 0.25 }, k };
      }
    }
    const spots = [['straight', best?.at], ['bend', bend?.at], [`meets ${meet?.k ?? ''}`, meet?.at]];
    let col = 0;
    for (const [label, at] of spots) {
      if (at) { _world.go(at.x, at.z); _world.step(0.8); }
      put(row, col++, `${n} ${def.name}: ${label}`);
    }
    // a low view along the network from behind the bend
    const cam = api.heroMode.host?.camera ?? api.camera;
    const at = bend?.at ?? def.start;
    cam.position.set(at.x, 14, at.z + 22); cam.lookAt(at.x, 0, at.z - 6); cam.updateMatrixWorld();
    put(row, 3, `${n}: low, over the bend`);
    out.floors[n] = { name: def.name, paths: paths.length, segs: paths.reduce((s, p) => s + p.length - 1, 0), bendDeg: Math.round((bend?.turn ?? 0) * 57.3) };
  } catch (e) {
    out.floors[n] = { err: String(e).slice(0, 300) };
  }
  row++;
  try { _world.end(); } catch (e) { /* none */ }
}
out.roads = c.toDataURL('image/jpeg', 0.86);
return out;
