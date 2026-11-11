// Review pictures of Anka's kit, taken in a real duel from above (the game camera's angle), one sheet per spell:
//
//   python pipeline/tools/page-shots.py pipeline/tools/anka-shots.js docs/spells/anka
//
// It is the body of an async function run in the tool page (see page-shots.py). The duel is a 'play' duel against Kaia
// in the Night Temple; Anka's casts are made by hand (`heroMode.autoCast`) with her cooldowns cleared. The foe is
// Brannoc, held on a spot, silenced and played by a CPU that never casts, so each picture shows her spell and nothing else.
const P = await import('/src/traits/phoenix.ts');
const { CPU_LEVELS } = await import('/src/cpuLevels.ts');
const STILL = { ...CPU_LEVELS[0], speed: 0.01, castGap: [999, 999], cooldown: 99 };   // its damage stays: the killing hit of the Ashborn sheet is dealt in its name
const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
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
// The game's clock is ours from here on and only ever goes forward. Letting it fall back to the real clock between
// rounds (the fight's clock runs ahead of it) once turned whole rounds white: the screen's hit flash fades by the time
// that passed, and a negative time makes it grow without end (`Finish.update` in src/post.ts).
performance.now = () => simMs;
const wait = async (ms) => { for (let k = 0; k < ms / 100; k++) { await new Promise((r) => setTimeout(r, 100)); simMs += 100; } };
const start = async () => {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'play');
  vfx.heroPickCtrl.setValue('Anka');
  d.opponentChoice = 'Brannoc';
  d.cpuLevel = STILL;
  d.arenaChoice = 'temple';
  d.hazardsInRuns = false;
  d.shiftsInRuns = false;
  d.start('play');
  const t0 = realNow();
  while (!(vfx.heroMode.figure?.loaded && d.figure?.loaded) && realNow() - t0 < 20000) await wait(100);
  await wait(1500);   // the arena's own files
  pin = null;
  frames = 0;   // the foe is silenced from this round's first step
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
const out = { casts: {} };
try {
  // Q: the quill, and the embers it leaves
  await start();
  pin = [0, 6];
  let s = sheet(3, 2);
  out.casts.q1 = cast(0, 0, 6);
  step(0.16); shot(s, 'Q Ember Quill: the flick', [0, 9.5]);
  step(0.2); shot(s, 'the quill flies', [0, 9.5]);
  step(0.3); shot(s, 'it hits and sticks', [0, 9.5]);
  step(0.8);
  out.casts.q2 = cast(0, 4.5, 9);
  step(1.0); shot(s, 'two embers: the newest is the nest', [1.5, 9]);
  step(0.3); shot(s, 'close: the ember in the foe, the nest on the right', [2.2, 7.6], 0.5);
  out.embers = P.embersOf(me()).map((e) => [+e.x.toFixed(1), +e.z.toFixed(1)]);
  out.q = jpg(s);
  // W: every ember flares (the foe stands in one ring, outside the stamp ring)
  const e0 = P.embersOf(me())[0];
  if (e0) pin = [e0.x + 1.5, e0.z];
  step(0.2);
  s = sheet(4, 1);
  out.casts.w = cast(1, 0, 0);
  step(0.25); shot(s, 'W Fan the Flames: the rings fill', [1.5, 8.5]);
  step(0.4); shot(s, 'almost', [1.5, 8.5]);
  step(0.2); shot(s, 'the flare', [1.5, 8.5]);
  step(0.3); shot(s, 'the embers are burnt out', [1.5, 8.5]);
  out.w = jpg(s);
  // E: she flies to an ember
  await start();
  pin = [-4, 6.5];
  out.casts.eq = cast(0, -4, 8);
  step(1.2);
  s = sheet(4, 1);
  out.casts.e = cast(2, -4, 8);
  step(0.12); shot(s, 'E Ember Flight: she breaks into feathers', [-2, 10]);
  step(0.3); shot(s, 'in the air', [-2, 10]);
  step(0.3); shot(s, 'she lands in a burst', [-2, 10]);
  step(0.35); shot(s, 'after', [-2, 10]);
  out.e = jpg(s);
  // R: the firebird
  await start();
  pin = [0, 6];
  s = sheet(3, 2);
  out.casts.r = cast(3, 0, 6);
  step(0.5); shot(s, 'R Firebird: the wings spread, the lane shows', [0, 8.5], 1.1);
  step(0.45); shot(s, 'drawn back', [0, 8.5], 1.1);
  step(0.15); shot(s, 'it crosses', [0, 8.5], 1.1);
  step(0.15); shot(s, '', [0, 8.5], 1.1);
  step(0.25); shot(s, 'she lands at the far end', [0, 8.5], 1.1);
  step(0.9); shot(s, 'an ember is left where she took off', [0, 8.5], 1.1);
  out.r = jpg(s);
  // Ashborn: a hit that would fell her, with a nest burning
  await start();
  pin = [0, 8];
  out.casts.aq = cast(0, 5, 12);
  step(1.3);
  s = sheet(4, 1);
  shot(s, 'Ashborn: her nest burns', [2, 11.5]);
  d.damagePlayer(d.resolve('opponent', me(), { damage: 9999, knock: 0 }, { power: 1 }, 'spell', 0, 950));
  step(0.35); shot(s, 'a killing hit: ash, and an egg at the nest', [2, 11.5]);
  step(0.6); shot(s, 'the egg glows', [2, 11.5]);
  step(0.4); shot(s, 'she rises with 30% HP', [2, 11.5]);
  out.hpAfterRise = Math.round(d.playerHp);
  out.ashborn = jpg(s);
} catch (e) {
  out.err = e.message + ' | ' + (e.stack || '').split('\n').slice(0, 4).join(' / ');
}
performance.now = realNow;
return out;
