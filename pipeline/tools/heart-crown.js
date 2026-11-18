// The model review, round 3 (docs/models/review/round3/): the Heart of Noon's crown of rays against the floor in its last phase (Noon Falls),
// in its own room (the Sunken Heart, a raid of one), the brain held, the body in phase 3.
// 1. `sweep`: how low the crown reaches when it is turned by more about its front, either way, standing and kneeling (to know how far it may turn).
// 2. Two minutes of the last phase at rest, the crown's lowest point every 0.1 s, a picture every 15 s (the game's camera and the side at
//    its middle's height); then the Crown of Rays cast and the kneel, pictured.
// 3. A clip of 10 s at 60 s into the phase (where the old turn had brought the long rays round underneath): a Crown of Rays, the game's
//    camera beside the side view.
//   python -I pipeline/tools/page-shots.py pipeline/tools/heart-crown.js <out folder> --port 5182 --json heart.json --timeout 520
//   then: ffmpeg -framerate 15 -i <out>/clip_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 28 heart.mp4
const { HEART_OF_NOON: def } = await import('/src/raid/heart.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'play');
vfx.heroPickCtrl.setValue('Kaia');
d.holdStart = false;
def.resize(1);
d.startBoss({ def, link: new LocalLink(def), seed: 'crown', mode: 'play' });
await d.whenReady();
await wait(1500);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => simMs;
const step1 = () => { simMs += 1000 / 60; vfx.step(1 / 60); d.playerHp = d.playerMax; };
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) step1(); };
d.boss.brain.pause = 1e9;
d.boss.brain.timedDone = 1e9;
d.countdown = -1;
d.hurtHero = () => {};
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const H = d.foe.group.position.clone();
const V = H.constructor;
a.caster.group.position.set(H.x + 2.5, 0, H.z + 9);
hm.setZoom(1.25);
step(0.8);
const cam = hm.host.camera;
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const crown = () => { let r = null; d.figure.group.traverse((o) => { if (!r && o.name === 'crown' && o.visible) r = o; }); return r; };
const v = new V();
const lowOf = (node) => {
  node.updateMatrixWorld(true);
  let lo = 1e9;
  node.traverse((m) => {
    if (!m.isMesh) return;
    for (let p = m; p; p = p.parent) if (!p.visible) return;
    const P = m.geometry.attributes.position;
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
  });
  return +lo.toFixed(2);
};
const grab = (w, h, label, cy) => {
  const src = canvas(), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sh = src.height * 0.8, sw = Math.min(src.width, sh * (w / h));
  g.drawImage(src, (src.width - sw) / 2, src.height * cy - sh / 2, sw, sh, 0, 0, w, h);
  if (label) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, w, 20);
    g.fillStyle = '#ffd27a'; g.font = '600 13px sans-serif'; g.fillText(label, 5, 15);
  }
  return c;
};
const twoViews = (w, h, label) => {
  vfx.render();
  const game = grab(w, h, label, 0.36);
  cam.position.set(H.x + 13, 1.2, H.z + 13); cam.lookAt(H.x, 2.6, H.z); cam.updateMatrixWorld();
  vfx.render();
  const side = grab(w, h, label ? label + ' (side)' : '', 0.45);
  return [game, side];
};
const out = {};
const tiles = [];
const moment = (label) => { const lo = lowOf(crown()); tiles.push(twoViews(300, 300, `${label}: crown ${lo} m`)); step1(); return lo; };
let seq = 7000;
const cast = (move) => {
  const hero = a.caster.group.position;
  d.boss.link.cast({ id: ++seq, move, step: 0, x: H.x, z: H.z, fx: hero.x, fz: hero.z, dir: Math.atan2(hero.x - H.x, hero.z - H.z), seed: 4242, target: 0 });
};
try {
  d.figure.setBodyPhase(2);
  step(2);
  // 1. the crown turned by more about its front: its lowest point
  const sweep = { standing: [], kneeling: [] };
  const turn = (ang) => { const c = crown(); c.rotateZ(ang); return lowOf(c); };
  for (let k = -8; k <= 16; k++) { step1(); sweep.standing.push([+(k * 0.2).toFixed(1), turn(k * 0.2)]); }
  a.statusOf(d.foe).hold(3);
  step(1.5);
  for (let k = -8; k <= 16; k++) { step1(); sweep.kneeling.push([+(k * 0.2).toFixed(1), turn(k * 0.2)]); }
  step(3);
  out.sweep = sweep;
  // 2. two minutes of the last phase at rest (the clip, 3., is taken inside it at 60 s)
  const series = [];
  let lowest = { lo: 1e9, at: 0 }, n = 0;
  for (let f = 0; f < 120 * 60; f++) {
    const t = f / 60;
    if (f === 60 * 60) cast('corona');
    if (f >= 60 * 60 && f < 70 * 60 && f % 4 === 0) {
      const [x, y] = twoViews(480, 400, '');
      const c = document.createElement('canvas'); c.width = 960; c.height = 400;
      const g = c.getContext('2d'); g.drawImage(x, 0, 0); g.drawImage(y, 480, 0);
      out[`clip_${String(n++).padStart(4, '0')}`] = c.toDataURL('image/jpeg', 0.72);
    }
    if (f % 6 === 0) {
      const lo = lowOf(crown());
      if (f % 60 === 0) series.push([Math.round(t), lo]);
      if (lo < lowest.lo) lowest = { lo, at: +t.toFixed(1) };
    }
    if (f > 0 && f % (15 * 60) === 0) moment(`${Math.round(t)} s into the phase`);
    step1();
  }
  out.series = series;
  out.lowest = lowest;
  cast('corona');
  const at = [1.3, 2.15, 2.7];
  let t0 = 0;
  out.corona = [];
  for (const s of at) { step(s - t0); t0 = s; out.corona.push(moment(`Crown of Rays ${s}s`)); }
  step(3);
  a.statusOf(d.foe).hold(4);
  step(1.5);
  out.kneel = moment('kneeling');
} catch (e) {
  out.error = String(e?.stack ?? e).slice(0, 600);
} finally {
  performance.now = realNow;
}
const sheet = document.createElement('canvas');
sheet.width = 1200; sheet.height = Math.ceil(tiles.length / 2) * 300;
const g = sheet.getContext('2d');
tiles.forEach(([x, y], i) => { g.drawImage(x, (i % 2) * 600, Math.floor(i / 2) * 300); g.drawImage(y, (i % 2) * 600 + 300, Math.floor(i / 2) * 300); });
out['heart-crown'] = sheet.toDataURL('image/jpeg', 0.85);
return out;
