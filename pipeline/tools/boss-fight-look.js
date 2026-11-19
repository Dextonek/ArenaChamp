// The model review, round 2 (docs/models/review/round2/): a Raid boss in a real fight in its own room, its brain choosing its moves,
// seen from the game's camera. The hero stands 8 m off and takes nothing; the boss's health is cut at 30 % and 60 % of the run so its later
// phases come. Each move the body casts is pictured at its wind-up and its strike (the first time it comes), a clip of 12 s is
// filmed (15 frames a second), and the body is measured all through: its lowest point (visible meshes only) and how far it reaches
// out from its middle below 2.5 m, against its hit circle (`body.radius`).
//   window._who = 'warden' | 'ash' | 'ember' | any raid boss's id ('heart', 'wyrm') on a line before this file's text, then
//   python -I pipeline/tools/page-shots.py <that script> <out folder> --port 5177 --json look.json --timeout 400
// The clip comes back as frames clip_0000.jpg...: ffmpeg -framerate 15 -i clip_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 28 <who>.mp4
const who = window._who ?? 'warden';
const { SUN_WARDEN } = await import('/src/raid/sunWarden.ts');
const { ASH_AND_EMBER } = await import('/src/raid/ashEmber.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { BOSSES } = await import('/src/raid/bosses.ts');
const def = who === 'warden' ? SUN_WARDEN : who === 'ash' || who === 'ember' ? ASH_AND_EMBER : BOSSES[who];
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'play');
vfx.heroPickCtrl.setValue('Kaia');
d.holdStart = false;
d.startBoss({ def, link: new LocalLink(def), seed: 'look', mode: 'play' });
await d.whenReady();
if (who === 'ember') d.figure.preload('models/bosses/ember.glb');
await wait(2500);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => simMs;
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
d.countdown = -1;
// The hero takes nothing (a crush would end the fight): the boss goes on casting through every phase.
d.hurtHero = () => {};
if (who === 'ember') { d.bossWorld().tag(1, 0, 3, 0, -9.4); }
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const boss = () => d.foe.group.position;
const V = boss().constructor;
const hero = a.caster.group.position;
// The room's middle is where the boss starts: the hero stands 8 m from the boss toward it (or south of it in the middle).
const mid = boss().clone();
const placeHero = () => {
  const b = boss(), dx = mid.x - b.x, dz = mid.z - b.z, L = Math.hypot(dx, dz);
  if (L < 4) hero.set(b.x + 2, 0, b.z + 8); else hero.set(b.x + (dx / L) * 8, 0, b.z + (dz / L) * 8);
};
placeHero();
// As near as the game lets a player zoom in (0.55 to 1.7), so the body can be judged.
hm.setZoom(window._zoom ?? 0.6);
const radius = def.body?.radius ?? 1;
const W = 320, H = 300;
const tiles = [];
const clip = {};
let nClip = 0;
const grab = (label) => {
  const src = canvas();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sh = src.height * 0.85, sw = sh * (W / H);
  g.drawImage(src, (src.width - sw) / 2, src.height * 0.02, sw, sh, 0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(0, 0, W, 20);
  g.fillStyle = '#ffd27a';
  g.font = '600 13px sans-serif';
  g.fillText(label, 5, 15);
  tiles.push(c);
};
const film = () => {
  const src = canvas();
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  c.getContext('2d').drawImage(src, 0, 0, 640, 400);
  clip[`clip_${String(nClip++).padStart(4, '0')}`] = c.toDataURL('image/jpeg', 0.72);
};
// The lowest point of what is drawn of the boss, and its reach out from its middle below 2.5 m.
const v = new V();
const measure = () => {
  const b = boss();
  let lo = 1e9, reach = 0;
  d.figure.group.updateMatrixWorld(true);
  d.figure.group.traverse((m) => {
    if (!m.isMesh) return;
    for (let p = m; p && p !== d.figure.group; p = p.parent) if (!p.visible) return;
    const P = m.geometry.attributes.position;
    for (let k = 0; k < P.count; k += 3) {
      if (m.isSkinnedMesh) m.getVertexPosition(k, v); else v.fromBufferAttribute(P, k);
      v.applyMatrix4(m.matrixWorld);
      lo = Math.min(lo, v.y);
      if (v.y < 2.5) reach = Math.max(reach, Math.hypot(v.x - b.x, v.z - b.z));
    }
  });
  return { lo, reach };
};
const seen = new Set();
const lows = [], reaches = [];
let deepest = { lo: 1e9, at: '' };
let lastCast = null, phase = 0;
const moves = [];
const fig = d.figure;
const T = window._secs ?? 90;
try {
  for (let f = 0; f < T * 60; f++) {
    simMs += 1000 / 60;
    vfx.step(1 / 60);
    d.playerHp = d.playerMax;
    if (f % 30 === 0) placeHero();
    const t = f / 60;
    if (f === Math.round(T * 0.3) * 60) a.setHp(d.foe, d.foeMax * 0.6);
    if (f === Math.round(T * 0.6) * 60) a.setHp(d.foe, d.foeMax * 0.3);
    // the camera a third of the way from the boss to the hero
    const b = boss();
    hm.focus = new V(b.x + (hero.x - b.x) * 0.3, 0, b.z + (hero.z - b.z) * 0.3);
    const c = fig.castNow;
    const act = d.boss?.script?.active ?? [];
    const name = act.length ? act[act.length - 1].cast.move : '';
    if (c && c !== lastCast) { lastCast = c; moves.push(`${t.toFixed(1)} ${name} (${c.style})`); c._name = name; }
    if (c && c._name && !seen.has(c._name + c.style)) {
      if (!c._w && c.t >= c.dur * 0.6) { c._w = 1; vfx.render(); grab(`${c._name}: wind-up`); }
      if (!c._s && c.t >= c.dur) { c._s = 1; vfx.render(); grab(`${c._name}: strike`); seen.add(c._name + c.style); }
    }
    if (f % 4 === 0 && t >= 6 && t < 18) { vfx.render(); film(); }
    if (f % 6 === 0) {
      const m = measure();
      lows.push(m.lo); reaches.push(m.reach);
      if (m.lo < deepest.lo) deepest = { lo: m.lo, at: `${t.toFixed(1)} s ${c ? c._name + ' ' + c.style + ' ' + (c.t / c.dur).toFixed(2) : 'no cast'}` };
    }
  }
  // kneeling and the fall
  a.statusOf(d.foe).hold(4);
  for (let i = 0; i < 90; i++) { simMs += 1000 / 60; vfx.step(1 / 60); }
  vfx.render(); grab('kneeling');
  const mk = measure();
  for (const k of [0.5, 1]) { fig.fall(k); simMs += 1000 / 60; vfx.step(1 / 60); vfx.render(); grab(`fall ${k}`); }
  const mf = measure();
  deepest.kneel = +mk.lo.toFixed(2); deepest.fallen = +mf.lo.toFixed(2);
} finally {
  performance.now = realNow;
}
const q = (xs, p) => { const s = xs.slice().sort((x, y) => x - y); return +s[Math.floor((s.length - 1) * p)].toFixed(2); };
const cols = 4;
const sheet = document.createElement('canvas');
sheet.width = cols * W;
sheet.height = Math.ceil(tiles.length / cols) * H;
const g = sheet.getContext('2d');
tiles.forEach((c, i) => g.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H));
return {
  [`sheet_${who}`]: sheet.toDataURL('image/jpeg', 0.85), ...clip,
  who, radius, moves, low: { p05: q(lows, 0.05), median: q(lows, 0.5), min: +deepest.lo.toFixed(2), at: deepest.at, kneel: deepest.kneel, fallen: deepest.fallen },
  reach: { median: q(reaches, 0.5), p95: q(reaches, 0.95), max: q(reaches, 1) }, room: d.currentArena?.id,
};
