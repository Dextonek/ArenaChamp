// Pictures of a duel arena as the game draws it, with two heroes fighting in it: the game's own camera, an overview, a
// low view across the floor and a view from the far side. Paste into the VFX tool page (browser javascript tool), with
// the frame sink running (node pipeline/tools/frame-sink.mjs <folder>):
//
//   eval(await (await fetch('/pipeline/tools/arena-shot.js')).text());
//   await _arenaShot('harbour.jpg', ['harbour', 'temple'], { hero: 'Hank', foe: 'Isolde', seconds: 5 })
//
// One row per arena, so a new arena can be judged beside an old one at the same cameras. `seconds` of an AI fight run
// first (events and closing stages off, unless `o.shift` gives a fight clock to jump to, e.g. 90 for stage 3).
// On the game page it returns the draw calls and triangles of the game camera's frame per arena.
window._arenaShot = async (file, arenas, o = {}) => {
  const { hero = 'Hank', foe = 'Isolde', seconds = 5, shift = null, W = 640, H = 400 } = o;
  const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
  const tick = (ms = 30) => new Promise((ok) => setTimeout(ok, ms));
  const d = vfx.duel, cam = vfx.controls.object;
  const views = [
    ['game camera', null],
    ['overview', [0, 25, 33], [0, 0, 7]],
    ['low', [10, 4.2, 20], [-1, 1.4, 6]],
    ['far side', [-17, 9, -9], [0, 1, 7]],
  ];
  const out = document.createElement('canvas');
  out.width = W * views.length;
  out.height = H * arenas.length;
  const g = out.getContext('2d');
  const gl = [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height)[0], info = [];
  const rinfo = (window.game?.api ?? vfx).renderer?.info;   // the game page exposes its renderer; the tool page does not
  const realNow = performance.now.bind(performance);
  for (let r = 0; r < arenas.length; r++) {
    vfx.view.paused = true;
    if (!d.on) vfx.setDuel(true, 'run');
    vfx.heroPickCtrl.setValue(hero);
    d.cpuLevel = CPU_BALANCE;
    d.opponentChoice = foe;
    d.arenaChoice = arenas[r];
    d.hazardsInRuns = shift !== null;
    d.shiftsInRuns = shift !== null;
    d.shiftOffset = shift ?? 0;
    d.start('run');
    for (let k = 0; k < 200 && !vfx.heroMode.figure?.loaded; k++) await tick();
    await tick(1500);   // the arena's own files
    let simMs = realNow();
    performance.now = () => simMs;
    for (let f = 0; f < seconds * 60 && !d.result; f++) { simMs += 1000 / 60; vfx.step(1 / 60); }
    performance.now = realNow;
    for (let i = 0; i < views.length; i++) {
      const [name, pos, look] = views[i];
      const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
      if (pos) { cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(); }
      vfx.render();
      if (!pos && rinfo) info.push(`${arenas[r]}: ${rinfo.render.calls} calls, ${rinfo.render.triangles} triangles`);
      const sw = gl.width, sh = gl.height, ar = W / H;
      let cw = sw, ch = sw / ar;
      if (ch > sh) { ch = sh; cw = sh * ar; }
      g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, i * W, r * H, W, H);
      g.fillStyle = '#fff';
      g.font = '15px sans-serif';
      g.fillText(`${d.currentArena?.name ?? arenas[r]} · ${name}`, i * W + 8, r * H + 20);
      cam.position.copy(keep.p);
      cam.quaternion.copy(keep.q);
    }
  }
  const url = out.toDataURL('image/jpeg', 0.88), bin = atob(url.split(',')[1]), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  await fetch('http://127.0.0.1:5199/' + file, { method: 'PUT', body: buf });
  return info;
};
