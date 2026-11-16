// A clip of the Climb's life (src/tower/world/life/): the hero walks from one spot to another in the game's own camera, the world
// stepped at true speed (two 1/60 s steps a frame, 30 frames a second), each frame a JPEG to the frame sink:
//   node pipeline/tools/frame-sink.mjs <folder> 5207
//   python -I pipeline/tools/world-shots.py <script> --page /game --port 5185      (the script: `const C = {...};` then this file)
//   ffmpeg -framerate 30 -i <name>_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 27 -movflags +faststart <name>.mp4
// C = { floor, name, from: [x, z] or '@kind.i:dx:dz', to: [x, z] or '@kind.i:dx:dz', frames, wait (frames standing first),
//       zoom, sink: 'http://127.0.0.1:5207', w, h, tier }
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
globalThis.__lifeTier = C.tier ?? undefined;
const api = window.game.api;
await _world({ floor: C.floor, hero: C.hero ?? 'Lyra', mode: 'play' });
const g = _world.game();
for (let i = 0; i < 300 && !api.heroMode.figureLoaded; i++) { _world.step(0.05); await new Promise((ok) => setTimeout(ok, 100)); }
for (const b of document.querySelectorAll('button')) if (/^(Begin|Go|Start|OK|Close|Continue|Onward)$/i.test(b.textContent.trim()) && b.offsetParent) b.click();
try { g.zone.hud.closeCard(); } catch (e) { /* none */ }
g.zone.setPacks(false);
// (the life comes into the scene a moment after the floor starts: index.ts)
let lifeGroup = null;
for (let i = 0; i < 60 && !lifeGroup; i++) { _world.step(0.05); await new Promise((ok) => setTimeout(ok, 50)); api.duel.group.parent?.traverse((o) => { if (o.name === 'life') lifeGroup = o; }); }
const where = lifeGroup?.userData.where ?? {};
const spot = (s) => {
  if (Array.isArray(s)) return { x: s[0], z: s[1] };
  const m = /^@(\w+)\.(\d+):(-?[\d.]+):(-?[\d.]+)$/.exec(s), w = m && (m[1] === 'walkers' && lifeGroup?.userData.walkers ? lifeGroup.userData.walkers.snapshot()[+m[2]] : where[m[1]]?.[+m[2]]);
  return w ? { x: w.x + +m[3], z: w.z + +m[4] } : null;
};
const from = spot(C.from), to = C.to ? spot(C.to) : null;
if (!from) return { error: 'no spot', where };
_world.go(from.x, from.z);
if (C.zoom) { api.heroMode.setZoom(C.zoom); api.heroMode.snapCameraNow(); }
// let the walkers' models come in (real time) and the place settle
for (let i = 0; i < 30; i++) { _world.step(0.1); await new Promise((ok) => setTimeout(ok, 60)); }
const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
const W = C.w ?? 960, H = C.h ?? 540, out = document.createElement('canvas');
out.width = W; out.height = H;
const cx = out.getContext('2d');
const sink = C.sink ?? 'http://127.0.0.1:5207';
let sent = 0;
for (let f = 0; f < (C.frames ?? 180); f++) {
  if (f === (C.wait ?? 15) && to) api.heroMode.walkTo(to.x, to.z);
  _world.step(1 / 30);
  api.render();
  // the page as drawn: the canvas (the HUD is the page's own, not in it)
  const sw = gl.width, sh = gl.height, k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;
  cx.drawImage(gl, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const blob = await new Promise((ok) => out.toBlob(ok, 'image/jpeg', 0.86));
  await fetch(`${sink}/${C.name}_${String(f).padStart(4, '0')}.jpg`, { method: 'PUT', body: blob });
  sent++;
}
return { sent, from, to, counts: globalThis.__lifeCounts };
