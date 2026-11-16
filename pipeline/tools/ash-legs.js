// The model review, round 3 (docs/models/review/round3/): Ash's legs against the floor. Two parts, in his own room (the Cinder Pit).
// 1. Each of his moves cast for real through the boss's link (so his body acts as in a fight: Ground Slam, the Charge's wind-up, Drag
//    Under, Knuckle Quake, Cinder Rock), the brain held; at the wind-up and the strike: the game's camera and the side at the floor's
//    height, and the lowest point of each leg and of the whole body (visible meshes only). Then kneeling and the fall.
// 2. A clip of the real fight (his brain choosing), 5 s to 17 s: the Charge's wind-up and run, the trail, the quake. Each frame is the
//    game's camera beside the side view. And where the Charge ends against the floor's edge (`edge`): his distance from the middle.
//   python -I pipeline/tools/page-shots.py pipeline/tools/ash-legs.js <out folder> --port 5182 --json ash.json --timeout 520
//   then: ffmpeg -framerate 15 -i <out>/clip_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 28 ash.mp4
// `window._part = 'poses' | 'clip'` for one part only.
const { ASH_AND_EMBER: def } = await import('/src/raid/ashEmber.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const { PIT_R } = await import('/src/arenas/cinderpit.ts');
const { RING } = await import('/src/arenas/common.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PART = window._part ?? 'both';
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const out = { PIT_R };
let simMs = performance.now();
const realNow = performance.now.bind(performance);
const start = async (seed) => {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'play');
  vfx.heroPickCtrl.setValue('Kaia');
  d.holdStart = false;
  d.startBoss({ def, link: new LocalLink(def), seed, mode: 'play' });
  await d.whenReady();
  await wait(2500);
  simMs = performance.now();
  performance.now = () => simMs;
  d.countdown = -1;
  d.hurtHero = () => {};
};
const step1 = () => { simMs += 1000 / 60; vfx.step(1 / 60); d.playerHp = d.playerMax; };
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) step1(); };
const visible = (m) => { for (let q = m; q && q !== d.figure.group; q = q.parent) if (!q.visible) return false; return true; };
const lowOf = (node, V) => {
  let lo = 1e9;
  const v = new V();
  node.traverse((m) => {
    if (!m.isMesh || !visible(m)) return;
    const P = m.geometry.attributes.position;
    for (let k = 0; k < P.count; k += 2) { v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
  });
  return lo < 1e8 ? +lo.toFixed(2) : null;
};
const measure = () => {
  const g = d.figure.group, V = g.position.constructor;
  g.updateMatrixWorld(true);
  const node = (n) => { let r = null; g.traverse((o) => { if (!r && o.name === n && visible(o)) r = o; }); return r; };
  const legL = node('legL'), legR = node('legR'), torso = node('torso');
  return { legL: legL ? lowOf(legL, V) : null, legR: legR ? lowOf(legR, V) : null, torso: torso ? lowOf(torso, V) : null };
};
const grab = (w, h, label, crop = 0.8, cy = 0.5) => {
  const src = canvas(), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sh = src.height * crop, sw = Math.min(src.width, sh * (w / h));
  g.drawImage(src, (src.width - sw) / 2, src.height * cy - sh / 2, sw, sh, 0, 0, w, h);
  if (label) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, w, 20);
    g.fillStyle = '#ffd27a'; g.font = '600 13px sans-serif'; g.fillText(label, 5, 15);
  }
  return c;
};
/** The game's camera, then the side at the floor's height, square to the way he faces. */
const twoViews = (w, h, label) => {
  vfx.render();
  const game = grab(w, h, label, 0.8, 0.45);
  const cam = hm.host.camera, b = d.foe.group.position, yaw = d.foe.group.rotation.y;
  const sx = Math.cos(yaw), sz = -Math.sin(yaw);
  cam.position.set(b.x + sx * 13, 0.5, b.z + sz * 13); cam.lookAt(b.x, 2.0, b.z); cam.updateMatrixWorld();
  vfx.render();
  const side = grab(w, h, label ? label + ' (side, floor height)' : '', 0.8, 0.5);
  return [game, side];
};
try {
  if (PART !== 'clip') {
    await start('legs');
    d.boss.brain.pause = 1e9;
    const H = d.foe.group.position.clone();
    a.placeFoe(d.foe, H);
    a.caster.group.position.set(H.x + 2, 0, H.z + 10);
    hm.setZoom(0.8);
    step(0.8);
    const tiles = [], metrics = [];
    const moment = (label) => { metrics.push({ label, ...measure() }); tiles.push(twoViews(300, 300, label)); step1(); };
    let seq = 9000;
    const cast = (move, s = 0) => {
      const hero = a.caster.group.position;
      d.boss.link.cast({ id: ++seq, move, step: s, x: hero.x, z: hero.z, fx: H.x, fz: H.z, dir: Math.atan2(hero.x - H.x, hero.z - H.z), seed: 4242, target: 0 });
    };
    moment('standing');
    for (const [move, label] of [['slam', 'Ground Slam'], ['charge', 'Charge (wind-up)'], ['drag', 'Drag Under'], ['quake', 'Knuckle Quake'], ['rock', 'Cinder Rock']]) {
      cast(move);
      let w = false, s = false;
      for (let i = 0; i < 600; i++) {
        step1();
        const c = d.figure.castNow;
        if (!c) { if (i > 30) break; continue; }
        if (!w && c.t >= c.dur * 0.6) { w = true; moment(`${label}: wind-up`); }
        if (!s && c.t >= c.dur + 0.05) { s = true; moment(`${label}: strike`); break; }
      }
      // the charge's wind-up only: it does not run (its second step is the brain's)
      d.boss.script?.active?.splice?.(0);
      step(2.5);
      a.placeFoe(d.foe, H);
      step(0.3);
    }
    a.statusOf(d.foe).hold(4);
    step(1.5);
    moment('kneeling');
    step(3);
    for (const f of [0.5, 1]) { d.figure.fall(f); step1(); moment(`fall ${f}`); }
    const sheet = document.createElement('canvas');
    sheet.width = 1200; sheet.height = Math.ceil(tiles.length / 2) * 300;
    const g = sheet.getContext('2d');
    tiles.forEach(([x, y], i) => { g.drawImage(x, (i % 2) * 600, Math.floor(i / 2) * 300); g.drawImage(y, (i % 2) * 600 + 300, Math.floor(i / 2) * 300); });
    out['ash-poses'] = sheet.toDataURL('image/jpeg', 0.85);
    out.poses = metrics;
    performance.now = realNow;
  }
  if (PART !== 'poses') {
    await start('look');
    const boss = () => d.foe.group.position, hero = a.caster.group.position, mid = boss().clone();
    const placeHero = () => {
      const b = boss(), dx = mid.x - b.x, dz = mid.z - b.z, L = Math.hypot(dx, dz);
      if (L < 4) hero.set(b.x + 2, 0, b.z + 8); else hero.set(b.x + (dx / L) * 8, 0, b.z + (dz / L) * 8);
    };
    placeHero();
    hm.setZoom(0.6);
    const V = boss().constructor;
    let n = 0, prevR = 0, edge = 0, edgeShot = false, low = { legs: 1e9, at: '' };
    for (let f = 0; f < 17 * 60; f++) {
      step1();
      if (f % 30 === 0) placeHero();
      const b = boss();
      hm.focus = new V(b.x + (hero.x - b.x) * 0.3, 0, b.z + (hero.z - b.z) * 0.3);
      const r = Math.hypot(b.x - RING.x, b.z - RING.z);
      edge = Math.max(edge, r);
      const was = prevR;
      prevR = r;
      if (f % 6 === 0) {
        const m = measure(), l = Math.min(m.legL ?? 1e9, m.legR ?? 1e9);
        if (l < low.legs) { const c = d.figure.castNow; low = { legs: l, at: `${(f / 60).toFixed(1)} s ${c ? c.style + ' ' + (c.t / c.dur).toFixed(2) : 'no cast'}` }; }
      }
      // where the Charge ends: the game's camera, and from the side across the floor's edge
      if (!edgeShot && r > PIT_R - 2 && Math.abs(r - was) < 1e-3) {
        edgeShot = true;
        const [x] = twoViews(480, 400, `the Charge's end: ${Math.hypot(boss().x - RING.x, boss().z - RING.z).toFixed(2)} m from the middle (the floor ends at ${PIT_R})`);
        // and from straight above him: where his body is against the floor's edge
        const cam = hm.host.camera, b2 = boss();
        cam.position.set(b2.x + 0.01, 16, b2.z); cam.up.set(0, 0, -1); cam.lookAt(b2.x, 0, b2.z); cam.updateMatrixWorld();
        vfx.render();
        cam.up.set(0, 1, 0);
        const y = grab(480, 400, 'from straight above', 0.8, 0.5);
        const c = document.createElement('canvas'); c.width = 960; c.height = 400;
        c.getContext('2d').drawImage(x, 0, 0); c.getContext('2d').drawImage(y, 480, 0);
        out['ash-charge-end'] = c.toDataURL('image/jpeg', 0.85);
      }
      if (f >= 5 * 60 && f % 4 === 0) {
        const [x, y] = twoViews(480, 400, '');
        const c = document.createElement('canvas'); c.width = 960; c.height = 400;
        const g = c.getContext('2d'); g.drawImage(x, 0, 0); g.drawImage(y, 480, 0);
        out[`clip_${String(n++).padStart(4, '0')}`] = c.toDataURL('image/jpeg', 0.72);
      }
    }
    out.fight = { edge: +edge.toFixed(2), lowestLeg: low };
  }
} catch (e) {
  out.error = String(e?.stack ?? e).slice(0, 600);
} finally {
  performance.now = realNow;
}
return out;
