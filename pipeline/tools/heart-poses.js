// The model review, round 2 (docs/models/review/round2/): the Heart of Noon in its own room (the Sunken Heart, a raid of one or two)
// through every move of its solo fight, cast for real through its link (so its body acts, its rings and its Heartbeat play as in a
// fight), its phases, a hit, kneeling and the fall. Two views a moment: the game's camera from where a hero stands, and from the side
// at the height of its middle. Numbers: the lowest point of each of its parts (rigid nodes, visible meshes only) against the floor.
//   python -I pipeline/tools/page-shots.py pipeline/tools/heart-poses.js <out folder> --port 5177 --json heart.json --timeout 400
// The party's own moves (Take the Blade, The Ring of Hands, the floor turning, the crust) are pictured by heart-phase-shots.py.
const { HEART_OF_NOON: def } = await import('/src/raid/heart.ts');
const { HEART_LIVE } = await import('/src/raid/bodies/heart.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'play');
vfx.heroPickCtrl.setValue('Kaia');
d.holdStart = false;
def.resize(1);
d.startBoss({ def, link: new LocalLink(def), seed: 'poses', mode: 'play' });
await d.whenReady();
await wait(1500);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => simMs;
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
d.boss.brain.pause = 1e9;
d.boss.brain.timedDone = 1e9;
d.countdown = -1;
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const H = d.foe.group.position.clone();
const V = H.constructor;
// The hero where a player fights it from: 9 m south of it, a little to the side.
a.caster.group.position.set(H.x + 2.5, 0, H.z + 9);
hm.setZoom(1.25);
step(0.8);
const cam = hm.host.camera;
const renderer = vfx.view.renderer ?? null;
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const W = 300, HH = 300;
const shots = [];
const metrics = [];
const PARTS = ['core', 'mask', 'crown', 'ringA', 'ringB', 'ringC', 'bladeL', 'bladeR', 'shards'];
const root = () => {
  let r = null;
  d.figure.group.traverse((o) => { if (!r && o.name === 'core' && o.visible) r = o.parent; });
  return r;
};
const lowOf = (node) => {
  let lo = 1e9, hi = -1e9;
  const v = new V();
  node.traverse((m) => {
    if (!m.isMesh) return;
    let vis = true;
    for (let p = m; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) return;
    const P = m.geometry.attributes.position;
    for (let k = 0; k < P.count; k += 2) { v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
  });
  return lo < 1e8 ? [+lo.toFixed(2), +hi.toFixed(2)] : null;
};
const measure = (label) => {
  const r = root();
  if (!r) return;
  r.updateMatrixWorld(true);
  const row = { label };
  for (const n of PARTS) { let node = null; r.traverse((o) => { if (!node && o.name === n) node = o; }); if (node) row[n] = lowOf(node); }
  metrics.push(row);
};
const grab = (label, view) => {
  const src = canvas();
  const c = document.createElement('canvas');
  c.width = W; c.height = HH;
  const g = c.getContext('2d');
  const k = view === 'side' ? 0.8 : 0.8, sw = src.height * k, sh = src.height * k;
  const cy = view === 'side' ? src.height * 0.45 : src.height * 0.36;
  g.drawImage(src, (src.width - sw) / 2, cy - sh / 2, sw, sh, 0, 0, W, HH);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(0, 0, W, 20);
  g.fillStyle = '#ffd27a';
  g.font = '600 13px sans-serif';
  g.fillText(label, 5, 15);
  return c;
};
// One moment: the game's camera, then the side at its middle's height (the camera put back on the next step).
const moment = (label) => {
  d.playerHp = d.playerMax;
  vfx.render();
  const game = grab(label, 'game');
  measure(label);
  cam.position.set(H.x + 13, 3.0, H.z + 13);
  cam.lookAt(H.x, 3.0, H.z);
  cam.updateMatrixWorld();
  vfx.render();
  const side = grab(label + ' (side)', 'side');
  shots.push([game, side]);
  step(1 / 60);
};
let seq = 7000;
const cast = (move, o = {}) => {
  const hero = a.caster.group.position;
  const c = { id: ++seq, move, step: o.step ?? 0, x: H.x, z: H.z, fx: hero.x, fz: hero.z, dir: Math.atan2(hero.x - H.x, hero.z - H.z), seed: 4242, target: 0 };
  d.boss.link.cast(c);
  return c.id;
};
try {
  moment('idle, phase 1');
  // [move, moments (s after the cast)]
  const PLAN = [
    ['sweep', [1.0, 1.65, 2.1]],
    ['fall', [1.2, 2.5, 3.3]],
    ['flare', [1.4, 2.35, 2.9]],
  ];
  const run = (plan) => {
    for (const [move, at] of plan) {
      cast(move);
      let t = 0;
      for (const s of at) { step(s - t); t = s; moment(`${move} ${s}s`); }
      step(3);
    }
  };
  run(PLAN);
  // A hit: the flinch.
  d.figure.hit?.(1);
  step(0.08);
  moment('hit');
  step(1);
  d.figure.setBodyPhase(1);
  step(1.8);
  moment('idle, phase 2');
  cast('rings');
  step(2.6); moment('rings 2.6s');
  step(1.6); moment('rings 4.2s');
  step(3); moment('rings 7.2s');
  for (const r of HEART_LIVE.rings) r.down = 1;
  step(0.5); moment('rings fully down');
  step(10);
  d.figure.setBodyPhase(2);
  step(1.8);
  moment('idle, phase 3');
  run([['corona', [1.3, 2.15, 2.7]]]);
  cast('heartbeat');
  step(5); moment('heartbeat 5s');
  step(4.8); moment('heartbeat 9.8s');
  step(0.4); moment('heartbeat struck');
  step(4);
  cast('still2');
  step(2); moment('hold still 2s');
  step(6);
  a.statusOf(d.foe).hold(4);
  step(1.5);
  moment('kneeling');
  step(3);
  for (const f of [0.25, 0.5, 0.75, 1]) { d.figure.fall(f); step(0.05); moment(`fall ${f}`); }
} catch (e) {
  metrics.push({ error: String(e?.stack ?? e).slice(0, 500) });
} finally {
  performance.now = realNow;
}
const cols = 4, rows = Math.ceil(shots.length / 2);
const sheets = {};
// Sheets of up to 6 moments (12 tiles), two moments to a row.
for (let s = 0; s * 6 < shots.length; s++) {
  const part = shots.slice(s * 6, s * 6 + 6);
  const sheet = document.createElement('canvas');
  sheet.width = cols * W;
  sheet.height = Math.ceil(part.length / 2) * HH;
  const g = sheet.getContext('2d');
  part.forEach(([gm, sd], i) => { g.drawImage(gm, (i % 2) * 2 * W, Math.floor(i / 2) * HH); g.drawImage(sd, ((i % 2) * 2 + 1) * W, Math.floor(i / 2) * HH); });
  sheets[`heart-${s + 1}`] = sheet.toDataURL('image/jpeg', 0.85);
}
return { ...sheets, metrics, moments: shots.length, room: d.currentArena?.id, at: [H.x, H.y, H.z], scale: d.foe.group.scale.x };
