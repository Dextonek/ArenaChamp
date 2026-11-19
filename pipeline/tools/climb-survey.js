// A look survey of the Climb's floors (2026-11-19, "more improvement to maps in tower"): per floor, the camp and two of its places in
// the game's own camera, and one view from low over the south edge. One sheet a chapter (rows = floors). A body for page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/page-shots.py pipeline/tools/climb-survey.js docs/tower/survey --page /game --browser msedge --port 5182
//
// window.__survey = { floors: [..] } before the run picks other floors (default: three a chapter).
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const FLOORS = window.__survey?.floors ?? [1, 4, 8, 11, 14, 18, 21, 24, 28, 31, 34, 38, 41, 44, 48];
const W = 480, H = 270, COLS = 4;
const out = { floors: {} };
const sheets = {};
const sheetFor = (ch) => {
  if (!sheets[ch]) {
    const c = document.createElement('canvas');
    c.width = W * COLS; c.height = H * 3;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    sheets[ch] = { c, g, row: 0 };
  }
  return sheets[ch];
};
const put = (s, col, label) => {
  api.render();
  const gl = api.renderer.domElement;
  const sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const x = col * W, y = s.row * H;
  s.g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  s.g.font = '600 14px system-ui, sans-serif';
  s.g.fillStyle = 'rgba(0,0,0,0.6)';
  s.g.fillRect(x, y, s.g.measureText(label).width + 14, 22);
  s.g.fillStyle = '#fff';
  s.g.fillText(label, x + 7, y + 16);
};
for (const n of FLOORS) {
  const ch = Math.floor((n - 1) / 10) + 1;
  const s = sheetFor(ch);
  try {
    await _world({ floor: n, hero: 'Lyra', mode: 'play' });
    const g = _world.game(), def = g.floor, z = g.zone;
    try { z.hud.closeCard(); } catch (e) { /* none */ }
    for (const b of document.querySelectorAll('button')) if (/^(Begin|Go|Start|OK|Close|Continue|Onward)$/i.test(b.textContent.trim()) && b.offsetParent) b.click();
    _world.step(1.5);
    put(s, 0, `${n} ${def.name}: camp`);
    const names = Object.keys(def.places ?? {});
    const far = names.map((k) => ({ k, p: def.places[k].stand ?? def.places[k] })).filter((o) => o.p && o.p.x !== undefined)
      .sort((a, b) => Math.hypot(b.p.x - def.start.x, b.p.z - def.start.z) - Math.hypot(a.p.x - def.start.x, a.p.z - def.start.z));
    const pick = [far[0], far[Math.floor(far.length / 2)]].filter(Boolean);
    let col = 1;
    for (const o of pick) {
      _world.go(o.p.x, o.p.z);
      _world.step(1.2);
      put(s, col++, `${n}: ${o.k}`);
    }
    const cam = api.heroMode.host?.camera ?? api.camera;
    const R0 = def.ring;
    cam.position.set(0, 30, 7 + R0 * 0.8); cam.lookAt(0, 0, 7 - R0 * 0.1); cam.updateMatrixWorld();
    put(s, 3, `${n}: from the south edge`);
    out.floors[n] = { name: def.name, ring: R0, places: names.length };
  } catch (e) {
    out.floors[n] = { err: String(e).slice(0, 200) };
  }
  s.row++;
  try { _world.end(); } catch (e) { /* none */ }
}
for (const [ch, s] of Object.entries(sheets)) out[`chapter-${ch}`] = s.c.toDataURL('image/jpeg', 0.85);
return out;
