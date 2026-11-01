// Pose contact sheet for the hero figure (src/heroFigure.ts). Paste into the VFX tool page (browser javascript tool):
//
//   eval(await (await fetch('/pipeline/tools/pose-sheet.js')).text());
//   'NAME:isolde_poses|' + await _poseSheet('Isolde')   // a JPEG data URL: idle, walk, each cast style, attack, hit, ...
//
// Drives the player's figure by hand at the hero's spot with the view paused, frames each pose from a close camera
// and crops the canvas. The result is too big for the tool output: decode the saved result file with a script.
window._poseSheet = async (name, opts = {}) => {
  const hm = vfx.heroMode, F = hm.figure;
  if (!hm.enabled) vfx.setHeroMode(true);
  vfx.view.paused = true;
  vfx.heroPickCtrl.setValue(name);
  for (let k = 0; k < 80 && !F.figure?.loaded; k++) await new Promise((r) => setTimeout(r, 100));
  const cam = vfx.controls.object;
  const base = hm.host.arena.caster.group.position.clone();
  const pos = base.clone();
  const dt = 1 / 60;
  const cells = [];
  const W = opts.w ?? 170, H = opts.h ?? 230;
  const shot = (label) => {
    const p = F.figure.root.position;
    const yaw = opts.yawCam ?? 0.75;
    cam.position.set(p.x + Math.sin(yaw) * 4.6, 1.9, p.z + Math.cos(yaw) * 4.6);
    cam.lookAt(p.x, 1.25, p.z);
    vfx.render();
    const c = document.querySelector('canvas');
    const ch = c.height * 0.8, cw = ch * W / H;
    const g = document.createElement('canvas');
    g.width = W; g.height = H;
    g.getContext('2d').drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, W, H);
    cells.push([label, g]);
  };
  const run = (sec, state = {}, move = null, yaw = 0) => {
    for (let i = 0; i < Math.round(sec / dt); i++) {
      if (move) pos.addScaledVector(move, dt);
      F.follow(dt, pos, yaw, state);
    }
  };
  const fresh = () => { pos.copy(base); F.stand(); run(0.5); };
  const steps = opts.steps ?? ['idle', 'walk', 'thrust', 'slam', 'burst', 'raise', 'swing', 'lunge', 'attack', 'hit', 'stun', 'knockup', 'die'];
  for (const s of steps) {
    fresh();
    if (s === 'idle') { run(1.3); shot('idle'); }
    else if (s === 'walk') { const v = base.clone().set(0, 0, 4); run(0.55, {}, v); shot('walk'); run(0.17, {}, v); shot('walk 2'); }
    else if (s === 'attack') {
      const melee = F.melee;
      for (let i = 0; i < 20; i++) F.follow(dt, pos, 0, { attack: { wind: i / 19, release: 0, melee } });
      shot('attack wind');
      for (let i = 0; i < 3; i++) F.follow(dt, pos, 0, { attack: { wind: -1, release: 1 - i * 0.1, melee } });
      shot('attack hit');
    } else if (s === 'hit') { F.hit(1, '#ff5a3a', pos.clone().set(0, 0, 6)); run(0.07); shot('hit'); }
    else if (s === 'stun') { run(0.6, { status: { stunned: true, lift: 0, cannotMove: true } }); shot('stun'); }
    else if (s === 'knockup') { run(0.4, { status: { stunned: true, lift: 1.2, cannotMove: true } }); shot('knock-up'); }
    else if (s === 'die') { F.fall(0.35); shot('dying'); F.fall(1); shot('down'); F.stand(); }
    else {
      F.cast(s, 0.7, false);
      run(0.14); shot(s + ' windup');
      run(0.16); shot(s);
    }
  }
  const cols = opts.cols ?? 8, rows = Math.ceil(cells.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * W; sheet.height = rows * (H + 16);
  const g = sheet.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.font = '12px sans-serif'; g.fillStyle = '#ddd';
  cells.forEach(([label, c], i) => {
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 16);
    g.drawImage(c, x, y + 16);
    g.fillText(label, x + 4, y + 12);
  });
  F.stand();
  vfx.view.paused = false;
  return sheet.toDataURL('image/jpeg', 0.72);
};
