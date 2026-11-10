// Frame strips of the hero figure's motion (src/heroFigure.ts), to lay beside frames of real footage. Paste into the VFX
// tool page (browser javascript tool):
//
//   eval(await (await fetch('/pipeline/tools/motion-strip.js')).text());
//   await _motionStrip('Oblivion', 'attack')            // 16 frames through the basic attack, from the hero's right side
//   await _motionStrip('Sefu', 'walk', { yawCam: 0 })   // 16 frames through one walk cycle, from the front
//   await _motionStrip('Kaia', 'cast:thrust')           // 16 frames through a cast style
//   window._ms                                          // the JPEG data URL (return it: the tool saves big results to a file)
//
// The attack is driven as the game drives it (`Attacker.motion`): `wind` 0..1 over the wind-up, then `release` 1..0.
// Options: yawCam (0 front, -PI/2 the hero's right side with forward to the right of the picture), frames, cols, w, h,
// windup and recover (seconds), dist (camera distance), melee (override), fit (true: the camera frames the hero by its
// own height, so a small hero fills its cell like a tall one).
window._motionStrip = async (name, what, o = {}) => {
  const hm = vfx.heroMode, F = hm.figure;
  if (!hm.enabled) vfx.setHeroMode(true);
  vfx.view.paused = true;
  vfx.heroPickCtrl.setValue(name);
  for (let k = 0; k < 100 && !F.figure?.loaded; k++) await new Promise((r) => setTimeout(r, 100));
  const cam = vfx.controls.object;
  const base = hm.host.arena.caster.group.position.clone(), pos = base.clone();
  const dt = 1 / 60, frames = o.frames ?? 16, cols = o.cols ?? 8, W = o.w ?? 150, H = o.h ?? 190;
  const yawCam = o.yawCam ?? -Math.PI / 2;
  // the hero's height: the head bone at rest, and a head more
  F.stand(); F.follow(dt, base, 0, {});
  F.figure.root.updateMatrixWorld(true);
  const head = F.figure.bones.get('head'), tall = head ? (head.getWorldPosition(base.clone()).y - F.figure.root.position.y) * 1.22 : 2.3;
  const fov = (cam.fov ?? 40) * Math.PI / 180;
  const dist = o.dist ?? (o.fit ? (2.3 * tall) / (0.86 * 2 * Math.tan(fov / 2)) : 5.2);
  const eye = o.fit ? 0.75 * tall : 1.7, look = o.fit ? 0.62 * tall : 1.35;
  const cells = [];
  const shot = (label) => {
    // where the hero stands, not where a lunge has carried its body
    const p = pos;
    cam.position.set(p.x + Math.sin(yawCam) * dist, eye, p.z + Math.cos(yawCam) * dist);
    cam.lookAt(p.x, look, p.z);
    vfx.render();
    const c = document.querySelector('canvas');
    const ch = c.height * 0.86, cw = ch * W / H;
    const g = document.createElement('canvas');
    g.width = W; g.height = H;
    g.getContext('2d').drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, W, H);
    cells.push([label, g]);
  };
  const step = (sec, state = {}, move = null) => {
    for (let i = 0; i < Math.max(1, Math.round(sec / dt)); i++) {
      if (move) pos.addScaledVector(move, dt);
      F.follow(dt, pos, 0, state);
    }
  };
  pos.copy(base); F.stand(); step(0.6);
  if (what === 'attack') {
    const melee = o.melee ?? F.melee, windup = o.windup ?? 0.3, recover = o.recover ?? 0.35;
    const total = windup + recover, per = total / frames;
    let t = 0;
    shot('guard');
    for (let i = 1; i < frames; i++) {
      // advance in small steps so springs and easing run as in the game
      const until = i * per;
      while (t < until - 1e-6) {
        t += dt;
        const state = t < windup ? { wind: t / windup, release: 0, melee } : { wind: -1, release: Math.max(0, 1 - (t - windup) / recover), melee };
        F.follow(dt, pos, 0, { attack: state });
      }
      shot(t < windup ? `wind ${(t / windup).toFixed(2)}` : `hit +${(t - windup).toFixed(2)}s`);
    }
  } else if (what === 'walk') {
    const v = base.clone().set(0, 0, o.speed ?? 4);
    step(0.8, {}, v);
    // one walk cycle (two steps): the phase runs at about 4.4 + 1.15 * speed rad/s
    const cycle = (2 * Math.PI) / (4.4 + 1.15 * (o.speed ?? 4));
    for (let i = 0; i < frames; i++) { step(cycle / frames, {}, v); shot(`walk ${i}`); }
  } else if (what.startsWith('cast:')) {
    const style = what.slice(5), dur = o.dur ?? 0.7;
    shot('before');
    F.cast(style, dur, false);
    for (let i = 1; i < frames; i++) { step((dur + 0.25) / frames); shot(`${style} ${i}`); }
  }
  const sheet = document.createElement('canvas');
  sheet.width = cols * W; sheet.height = Math.ceil(cells.length / cols) * (H + 14);
  const g = sheet.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.font = '11px sans-serif';
  cells.forEach(([label, c], i) => {
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 14);
    g.drawImage(c, x, y + 14);
    g.fillStyle = '#ff0';
    g.fillText(label, x + 3, y + 11);
  });
  F.stand();
  vfx.view.paused = false;
  window._ms = sheet.toDataURL('image/jpeg', 0.82);
  return `${name} ${what}: ${sheet.width}x${sheet.height}`;
};
