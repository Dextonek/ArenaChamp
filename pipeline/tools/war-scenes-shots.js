// Pictures of the War's scenes (src/tower/world/scenes/war.ts) from the game's own camera, on the game page through world-tool.js.
// The body of a shots script: put a plan in front of it and run it with the shots runner, e.g. from a script file that starts
//   const PLAN = [{ floor: 46, list: true, shots: [{ name: 'f46-close-ram-after', x: 12, z: 30, zoom: 0.8 }] }];
// followed by this file's text:
//   python -I pipeline/tools/world-shots.py <that file> --page /game --port <port> --out docs/tower/climb50/war/scenes/refine
// Each shot stands the hero at (x, z) with the packs asleep and away, sets the camera's zoom (0.55 to 1.7 as a player can; above that
// `lift` raises it past the player's limit, for a wide picture only), closes the law's card ("Two banners"), lets the camera settle and
// saves the page as <name>.jpg.
// `list: true` returns the floor's scenes (kind, layout, centre, radius, main piece) and the start, to choose the spots from.
// `off: true` builds the floor without the scenes (for a "before" of the same spot; scenes/off.ts's switch).
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const out = [];
for (const f of PLAN) {
  globalThis.__noScenes = !!f.off;
  await _world({ floor: f.floor, hero: f.hero ?? 'Lyra' });
  _world.packs(false);
  const api = window.game?.api ?? { heroMode: vfx.heroMode };
  if (f.list) {
    const log = [...(globalThis.__warScenesLog ?? new Map()).values()].find((l) => l.floor === f.floor);
    out.push({
      floor: f.floor,
      // one line a story (the echo props left out): kind, layout, x, z, footprint, main piece, side, past the edge
      scenes: (log?.scenes ?? []).filter((s) => s.kind !== 'trail').map((s) => `${s.kind} ${s.v} ${s.x.toFixed(1)} ${s.z.toFixed(1)} ${s.R} ${s.mr} ${s.side}${s.beyond ? ' beyond' : ''}`),
      start: _world.game().floor.start,
    });
  }
  for (const s of f.shots ?? []) {
    if (s.lift) api.heroMode.zoom = s.lift; else api.heroMode.setZoom(s.zoom ?? 1.25);
    _world.go(s.x, s.z);
    _world.step(0.6);
    _world.step(0.1);
    for (const d of document.querySelectorAll('body > div')) if (d.textContent?.includes('Choose a side')) d.style.display = 'none';
    await __shot(s.name);
  }
}
globalThis.__noScenes = false;
_world.end();
return out;
