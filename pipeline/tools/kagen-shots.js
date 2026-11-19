// Review pictures of Kagen's kit (gate 4), taken in a real duel from above (the game camera's angle), one sheet per spell:
//
//   MSYS_NO_PATHCONV=1 python pipeline/tools/page-shots.py pipeline/tools/kagen-shots.js docs/spells/kagen --page "/?drafts=1" [--browser msedge] [--port 5181]
//
// The body of an async function run in the tool page (see page-shots.py); `?drafts=1` puts Kagen (a draft) on the roster.
// The duel is a 'play' duel in the Night Temple; Kagen's casts are made by hand (`heroMode.autoCast`) with his cooldowns
// cleared. The foe is Brannoc, held on a spot, silenced and played by a CPU that never casts, so each picture shows his spell.
// `window.KAGEN_ONLY` (set it at the top of a copy) limits it to some sheets: e.g. ['q', 'w'].
const ONLY = window.KAGEN_ONLY ?? ['marks', 'q', 'w', 'e', 'r'];
const { CPU_LEVELS } = await import('/src/cpuLevels.ts');
const STILL = { ...CPU_LEVELS[0], speed: 0.01, castGap: [999, 999], cooldown: 99 };
const d = vfx.duel, cam = vfx.controls.object;
const realNow = performance.now.bind(performance);
let simMs = realNow();
const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
const W = 560, H = 350;
const V = (x, y, z) => new (vfx.arena.caster.group.position.constructor)(x, y, z);
const me = () => vfx.arena.caster;
let pin = null, frames = 0;
const step = (sec) => {
  for (let i = 0; i < Math.round(sec * 60); i++) {
    simMs += 1000 / 60;
    if (pin) d.foe.group.position.set(pin[0], 0, pin[1]);
    if (d.foe && frames++ % 40 === 0) vfx.arena.applyStatus(d.foe, 'silence', 1.5);
    vfx.step(1 / 60);
    if (pin) d.foe.group.position.set(pin[0], 0, pin[1]);
  }
};
performance.now = () => simMs;
const wait = async (ms) => { for (let k = 0; k < ms / 100; k++) { await new Promise((r) => setTimeout(r, 100)); simMs += 100; } };
const start = async () => {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'play');
  vfx.heroPickCtrl.setValue('Kagen');
  d.opponentChoice = 'Brannoc';
  d.cpuLevel = STILL;
  d.arenaChoice = 'temple';
  d.hazardsInRuns = false;
  d.shiftsInRuns = false;
  d.start('play');
  const t0 = realNow();
  while (!(vfx.heroMode.figure?.loaded && d.figure?.loaded) && realNow() - t0 < 20000) await wait(100);
  await wait(1500);
  pin = null;
  frames = 0;
  // He stands at the middle (the arena's spawn is at z 13): the pictures' spots are laid out round (0, 0).
  me().group.position.set(0, 0, 0);
  step(0.3);
};
const sheet = (cols, rows) => {
  const c = document.createElement('canvas');
  c.width = W * cols;
  c.height = H * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  return { c, g, n: 0, cols };
};
const shot = (s, label, mid, far = 1) => {
  const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
  cam.position.set(mid[0], 10.5 * far, mid[1] + 7.5 * far);
  cam.lookAt(mid[0], 0.8, mid[1]);
  cam.updateMatrixWorld();
  vfx.render();
  const sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const x = (s.n % s.cols) * W, y = Math.floor(s.n / s.cols) * H;
  s.g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  if (label) {
    s.g.font = '600 16px system-ui, sans-serif';
    s.g.fillStyle = 'rgba(0,0,0,0.55)';
    s.g.fillRect(x, y, s.g.measureText(label).width + 16, 26);
    s.g.fillStyle = '#fff';
    s.g.fillText(label, x + 8, y + 18);
  }
  s.n++;
  cam.position.copy(keep.p);
  cam.quaternion.copy(keep.q);
};
const jpg = (s) => s.c.toDataURL('image/jpeg', 0.9);
const cast = (i, x, z) => { d.heroRt.setCooldown(i, 0); step(1 / 60); return vfx.heroMode.autoCast(i, { point: V(x, 0, z) }); };
const cuts = (n) => { d.heroRt.clearStacks('cut'); if (n) d.heroRt.addStacks('cut', n, 5, 4); };
const foeHp = () => Math.round(vfx.arena.hpOf(d.foe));
const out = { casts: {}, hp: {} };
try {
  if (ONLY.includes('marks')) {
    // The marks on the foe, one to four, close.
    await start();
    pin = [0, 3];
    const s = sheet(4, 1);
    for (let n = 1; n <= 4; n++) { cuts(n); step(0.3); shot(s, `${n} cut mark${n > 1 ? 's' : ''}`, [0, 3], 0.45); }
    out.marks = jpg(s);
  }
  if (ONLY.includes('q')) {
    // Q Issen: the line, the flash across it, where he stands after.
    await start();
    pin = [0, 3.5];
    const s = sheet(3, 2);
    out.hp.qBefore = foeHp();
    out.casts.q = cast(0, 0, 6);
    step(0.1); shot(s, 'Q Issen: the line shows', [0, 3]);
    step(0.25); shot(s, 'drawn back', [0, 3]);
    step(0.12); shot(s, 'the flash', [0, 3]);
    step(0.06); shot(s, '', [0, 3]);
    step(0.15); shot(s, 'he stands at the end', [0, 3]);
    step(0.4); shot(s, 'after: the mark on the foe', [0, 3]);
    out.hp.qAfter = foeHp();
    out.q = jpg(s);
  }
  if (ONLY.includes('w')) {
    // W Noto: three marks, the ring, the click, the marks open.
    await start();
    pin = [0, 2.2];
    cuts(3);
    step(0.2);
    const s = sheet(3, 2);
    out.hp.wBefore = foeHp();
    out.casts.w = cast(1, 0, 0);
    step(0.1); shot(s, 'W Noto: the blade slides home, the ring', [0, 1.2]);
    step(0.3); shot(s, 'almost', [0, 1.2]);
    step(0.12); shot(s, 'the click: the marks open', [0, 1.2]);
    step(0.08); shot(s, '', [0, 1.2]);
    step(0.2); shot(s, 'the parry window', [0, 1.2]);
    step(0.4); shot(s, 'after', [0, 1.2]);
    out.hp.wAfter = foeHp();
    out.w = jpg(s);
  }
  if (ONLY.includes('e')) {
    // E Senbon: the ring at the foe, three waves of swords.
    await start();
    pin = [0, 6];
    const s = sheet(3, 2);
    out.hp.eBefore = foeHp();
    out.casts.e = cast(2, 0, 6);
    step(0.4); shot(s, 'E Senbon: the ring is painted', [0, 5]);
    step(0.5); shot(s, 'the swords gather', [0, 5]);
    step(0.15); shot(s, 'wave 1', [0, 5]);
    step(0.4); shot(s, 'wave 2', [0, 5]);
    step(0.4); shot(s, 'wave 3', [0, 5]);
    step(0.5); shot(s, 'after', [0, 5]);
    out.hp.eAfter = foeHp();
    out.e = jpg(s);
  }
  if (ONLY.includes('r')) {
    // R Sekai-giri: the line, the still second, the tear; the foe off the line with four marks (they open anyway).
    await start();
    pin = [3.2, 6];
    cuts(4);
    step(0.2);
    const s = sheet(3, 2);
    out.hp.rBefore = foeHp();
    out.casts.r = cast(3, 0, 8);
    step(0.3); shot(s, 'R Sekai-giri: the cut is drawn', [0, 6], 1.15);
    step(0.5); shot(s, 'the world stands still', [0, 6], 1.15);
    step(0.45); shot(s, 'drawn back', [0, 6], 1.15);
    step(0.1); shot(s, 'the tear (the foe off the line: its marks open)', [0, 6], 1.15);
    step(0.1); shot(s, '', [0, 6], 1.15);
    step(0.6); shot(s, 'after', [0, 6], 1.15);
    out.hp.rAfter = foeHp();
    out.r = jpg(s);
  }
} catch (e) {
  out.err = e.message + ' | ' + (e.stack || '').split('\n').slice(0, 4).join(' / ');
}
performance.now = realNow;
return out;
