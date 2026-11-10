// Films a short clip of a real AI-vs-AI duel, frame by frame, for the News page (public/news/) or to show someone.
// The fight is stepped by hand (two 1/60 s steps a frame), so the clip plays at true speed at 30 frames a second however
// slowly the page renders. Frames go out as JPEGs to a local sink, because a clip is too big to hand back as text:
//
//   node pipeline/tools/frame-sink.mjs <folder>     (PUT /<name> -> <folder>/<name>, port 5199; stops itself after 9 min)
//
// Paste into the VFX tool page (browser javascript tool):
//
//   eval(await (await fetch('/pipeline/tools/clip-film.js')).text());
//   await _clip('attack', 'Hank', 'Big Yoko', { frames: 120, when: (dist) => dist < 3.5 })   // from the first time they close
//   await _clip('run', 'Sir Whiskers', 'Vesper', { frames: 75, from: 0.2, on: 'hero', side: 1 })
//
// then, where the frames landed:  ffmpeg -framerate 30 -i attack_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 27 -movflags +faststart attack.mp4
//
// Options: frames; from (fight seconds before filming may start); when(dist, duel, t) => boolean (filming starts the first
// time it is true); on ('both': the camera holds the two heroes, 'hero': it follows the first one); far (camera distance
// in metres, else by how far apart they are); height (camera height as a share of `far`); side (the camera looks across
// the line between the two heroes; this swings it round toward one end, in shares of `far`); arena (an arena's name); w, h (frame size); sink (the sink's address).
window._clip = async (name, hero, foe, o = {}) => {
  const { frames = 90, from = 0, when = null, on = 'both', w: W = 640, h: H = 360, sink = 'http://127.0.0.1:5199' } = o;
  const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
  const tick = () => new Promise((ok) => setTimeout(ok, 30));
  const d = vfx.duel;
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  vfx.heroPickCtrl.setValue(hero);
  d.cpuLevel = CPU_BALANCE;
  d.opponentChoice = foe;
  d.hazardsInRuns = false;
  if (o.arena && vfx.arenaPickCtrl) vfx.arenaPickCtrl.setValue(o.arena);
  d.start('run');
  for (let k = 0; k < 200 && !vfx.heroMode.figure?.figure?.loaded; k++) await tick();
  const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d'), cam = vfx.controls.object;
  let simMs = performance.now();
  // rules timed with performance.now() follow the fight's clock (an own property over the real one, deleted at the end)
  performance.now = () => simMs;
  let t = 0, shot = 0, rolling = false, cx = null, cz = 0, cf = 0, nx = 0, nz = 1;
  const sent = [];
  try {
    for (let f = 0; f < 3600 && shot < frames && !(d.result && !rolling); f++) {
      for (let k = 0; k < 2; k++) { simMs += 1000 / 60; vfx.step(1 / 60); t += 1 / 60; }
      const a = vfx.arena.caster.group.position, b = d.foe?.group.position ?? a;
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      if (!rolling && t >= from && (!when || when(dist, d, t))) rolling = true;
      // the camera eases after what it watches, so a dash does not jerk the picture
      const tx = on === 'hero' ? a.x : (a.x + b.x) / 2, tz = on === 'hero' ? a.z : (a.z + b.z) / 2;
      const tf = o.far ?? Math.max(8, dist * 1.1 + 4);
      // from the side: across the line between the two heroes, on the side nearer the usual view (from +z)
      let px = -(b.z - a.z), pz = b.x - a.x;
      const pl = Math.hypot(px, pz);
      if (pl > 0.5) { px /= pl; pz /= pl; if (pz < 0) { px = -px; pz = -pz; } } else { px = nx; pz = nz; }
      if (cx === null) { cx = tx; cz = tz; cf = tf; nx = px; nz = pz; }
      cx += (tx - cx) * 0.12; cz += (tz - cz) * 0.12; cf += (tf - cf) * 0.06;
      nx += (px - nx) * 0.04; nz += (pz - nz) * 0.04;
      if (!rolling) continue;
      const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
      const nl = Math.hypot(nx, nz) || 1, round = o.side ?? 0.25;
      // `side` swings it a little round toward one end of that line, so the two do not stand flat in a row
      cam.position.set(cx + (nx / nl - round * nz / nl) * cf, cf * (o.height ?? 0.55), cz + (nz / nl + round * nx / nl) * cf);
      cam.lookAt(cx, 1.1, cz);
      cam.updateMatrixWorld();
      vfx.render();
      cam.position.copy(keep.p);
      cam.quaternion.copy(keep.q);
      const sw = gl.width, sh = gl.height, ar = W / H;
      let cw = sw, ch = sw / ar;
      if (ch > sh) { ch = sh; cw = sh * ar; }
      g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
      // encoded and sent without waiting: a hidden page's timers run once a second, and a wait a frame would crawl
      const bin = atob(out.toDataURL('image/jpeg', 0.92).split(',')[1]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      sent.push(fetch(`${sink}/${name}_${String(shot).padStart(4, '0')}.jpg`, { method: 'PUT', body: bytes }));
      shot++;
    }
  } finally {
    delete performance.now;
  }
  await Promise.all(sent);
  return `${name}: ${shot} frames of ${hero} vs ${foe}, filmed from fight second ${(t - shot / 30).toFixed(1)}, canvas ${gl.width}x${gl.height}${d.result ? ', the fight ended' : ''}`;
};

// A clean showcase of one hero's motion on the tool page's own floor, no fight round it (the hero figure is driven as
// the game drives it, like pipeline/tools/motion-strip.js):
//
//   await _showClip('attack', 'Hank', 'attack', { swings: 2 })     // basic attacks, with a breath between
//   await _showClip('run', 'Sir Whiskers', 'run', { rounds: 3 })   // whole rounds of the run, so the clip loops
//   await _showClip('stand', 'Oblivion', 'idle', { sec: 3 })
//
// Options: yawCam (0 the hero's front, -Math.PI / 2 its right side), room (how many hero heights the picture holds),
// speed (m/s), windup, recover, rest (seconds), w, h, sink.
window._showClip = async (name, hero, what, o = {}) => {
  const { w: W = 640, h: H = 360, sink = 'http://127.0.0.1:5199' } = o;
  const hm = vfx.heroMode, F = hm.figure;
  if (!hm.enabled) vfx.setHeroMode(true);
  vfx.view.paused = true;
  vfx.heroPickCtrl.setValue(hero);
  for (let k = 0; k < 100 && !F.figure?.loaded; k++) await new Promise((r) => setTimeout(r, 100));
  const cam = vfx.controls.object, dt = 1 / 60;
  const base = hm.host.arena.caster.group.position.clone(), pos = base.clone();
  F.stand(); F.follow(dt, pos, 0, {});
  F.figure.root.updateMatrixWorld(true);
  const head = F.figure.bones.get('head'), tall = head ? (head.getWorldPosition(base.clone()).y - F.figure.root.position.y) * 1.22 : 2.3;
  const fov = ((cam.fov ?? 40) * Math.PI) / 180, yawCam = o.yawCam ?? -1.0;
  const dist = ((o.room ?? 2.2) * tall) / (2 * Math.tan(fov / 2));
  const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d'), sent = [], keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
  let shot = 0;
  const frame = (state, move) => {
    for (let k = 0; k < 2; k++) { if (move) pos.addScaledVector(move, dt); F.follow(dt, pos, 0, state()); }
    cam.position.set(pos.x + Math.sin(yawCam) * dist, 0.62 * tall, pos.z + Math.cos(yawCam) * dist);
    cam.lookAt(pos.x, 0.55 * tall, pos.z);
    cam.updateMatrixWorld();
    vfx.render();
    const sw = gl.width, sh = gl.height, ar = W / H;
    let cw = sw, ch = sw / ar;
    if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
    const bin = atob(out.toDataURL('image/jpeg', 0.92).split(',')[1]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    sent.push(fetch(`${sink}/${name}_${String(shot).padStart(4, '0')}.jpg`, { method: 'PUT', body: bytes }));
    shot++;
  };
  for (let i = 0; i < 40; i++) F.follow(dt, pos, 0, {});
  if (what === 'attack') {
    const melee = o.melee ?? F.melee, windup = o.windup ?? 0.3, recover = o.recover ?? 0.55, rest = o.rest ?? 0.45;
    let t = 0;
    const at = () => (t < rest ? {} : { attack: t - rest < windup ? { wind: (t - rest) / windup, release: 0, melee } : { wind: -1, release: Math.max(0, 1 - (t - rest - windup) / 0.18), melee } });
    for (let s = 0; s < (o.swings ?? 2); s++) for (t = 0; t < rest + windup + recover; ) { frame(() => { t += dt; return at(); }); }
    for (let i = 0; i < 12; i++) frame(() => ({}));
  } else if (what === 'run') {
    const v = base.clone().set(0, 0, o.speed ?? 4.2);
    for (let i = 0; i < 60; i++) { pos.addScaledVector(v, dt); F.follow(dt, pos, 0, {}); }
    const from = F.walkPhase, rounds = o.rounds ?? 3;
    for (let k = 0; k < 600 && F.walkPhase < from + 2 * Math.PI * rounds - 0.1; k++) frame(() => ({}), v);
  } else {
    for (let i = 0; i < Math.round((o.sec ?? 3) * 30); i++) frame(() => ({}));
  }
  cam.position.copy(keep.p);
  cam.quaternion.copy(keep.q);
  F.stand();
  vfx.view.paused = false;
  await Promise.all(sent);
  return `${name}: ${shot} frames of ${hero} (${what}), ${(shot / 30).toFixed(2)} s`;
};
