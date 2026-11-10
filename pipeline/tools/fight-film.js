// Paste into the VFX tool page (browser javascript tool). Films one AI-vs-AI duel into a contact sheet, so what only exists in a
// real fight shows (a trait's ground marks, words, statuses), unlike `_multi`, which plays one spell alone.
//
//   eval(await (await fetch('/pipeline/tools/fight-film.js')).text());
//   await _film('Hank', 'Brannoc', { from: 4, every: 1.5, frames: 12 })   // shows the sheet in the page; a screenshot reads it
//   _filmOff()   // removes it
//
// `from` and `every` are fight seconds. `when`: optional (duel) => boolean; frames are then only taken while it is true.
window._filmOff = () => document.getElementById('_sheetview')?.remove();
window._film = async (hero, foe, o = {}) => {
  const { from = 3, every = 1.5, frames = 12, when = null } = o;
  window._filmOff(); // a sheet left over the canvas can make the next film read black
  await new Promise((ok) => setTimeout(ok, 200));
  const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
  const tick = () => new Promise((ok) => setTimeout(ok, 30));
  const d = vfx.duel;
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  vfx.heroPickCtrl.setValue(hero);
  d.cpuLevel = CPU_BALANCE;
  d.opponentChoice = foe;
  d.hazardsInRuns = false;
  d.start('run');
  for (let k = 0; k < 200 && !vfx.heroMode.figure?.loaded; k++) await tick();
  await tick();
  const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const W = 640, H = 400, cols = 2, out = document.createElement('canvas');
  out.width = W * cols;
  out.height = H * Math.ceil(frames / cols);
  const g = out.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, out.width, out.height);
  // Rules timed with performance.now() follow the fight's clock, as in the balance tools.
  let simMs = performance.now();
  performance.now = () => simMs;
  let t = 0, next = from, shot = 0, f = 0;
  while (shot < frames && !d.result && f < 7200) {
    simMs += 1000 / 60;
    vfx.step(1 / 60);
    t += 1 / 60;
    f++;
    if (t >= next && (!when || when(d))) {
      next = t + every;
      // `close`: the camera near the two heroes for this frame, at about the height a player sees them from.
      if (o.close) {
        const a = vfx.arena.caster.group.position, b = d.foe?.group.position ?? a, cam = vfx.controls.object;
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, far = Math.max(6, Math.hypot(a.x - b.x, a.z - b.z) * 0.9);
        const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
        cam.position.set(mx, far * 1.15, mz + far);
        cam.lookAt(mx, 1, mz);
        cam.updateMatrixWorld();
        vfx.render();
        cam.position.copy(keep.p);
        cam.quaternion.copy(keep.q);
      } else vfx.render();
      const sw = gl.width, sh = gl.height, ar = W / H;
      let cw = sw, ch = sw / ar;
      if (ch > sh) { ch = sh; cw = sh * ar; }
      const x = (shot % cols) * W, y = Math.floor(shot / cols) * H;
      g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
      g.fillStyle = '#fff';
      g.font = '20px sans-serif';
      g.fillText(`${hero} vs ${foe} t=${t.toFixed(1)}`, x + 8, y + 24);
      shot++;
    }
  }
  delete performance.now;
  let im = document.getElementById('_sheetview');
  if (!im) {
    im = document.createElement('img');
    im.id = '_sheetview';
    im.style.cssText = 'position:fixed;inset:0;z-index:99999;width:100vw;height:100vh;object-fit:contain;background:#000';
    document.body.append(im);
  }
  im.src = out.toDataURL('image/jpeg', 0.82);
  await new Promise((ok) => { im.onload = ok; });
  // Return this from a browser call to save the sheet: the tool writes a large result to a file, and decode-sheets.py reads it.
  window._filmSheet = `NAME:${`${hero}-vs-${foe}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')}|${im.src} `;
  return { shot, seconds: +t.toFixed(1), result: d.result?.winner ?? null };
};
