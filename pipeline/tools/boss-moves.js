// The model review, round 2 (docs/models/review/round2/): a Raid boss's moves cast by hand through its link (as its brain would), each
// pictured from the game's camera near its wind-up and at its strike, and the body's lowest point (visible meshes only) at each; for the
// moves a run of its fight did not bring. `window._who` = 'warden' (its later phases' moves) | 'ember' (tagged in first, her own moves).
//   python -I pipeline/tools/page-shots.py <a copy with window._who first> <out folder> --port 5177 --json moves.json --timeout 400
const who = window._who ?? 'warden';
const { SUN_WARDEN } = await import('/src/raid/sunWarden.ts');
const { ASH_AND_EMBER } = await import('/src/raid/ashEmber.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const def = who === 'warden' ? SUN_WARDEN : ASH_AND_EMBER;
const MOVES = window._moves ?? (who === 'warden' ? ['order', 'eclipse', 'strikes', 'noon', 'hour', 'burden', 'anchors', 'walking'] : ['fan', 'marked', 'lanterns', 'bombs', 'wave', 'star']);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'play');
vfx.heroPickCtrl.setValue('Kaia');
d.holdStart = false;
d.startBoss({ def, link: new LocalLink(def), seed: 'moves', mode: 'play' });
await d.whenReady();
if (who === 'ember') d.figure.preload('models/bosses/ember.glb');
await wait(2500);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => simMs;
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); d.playerHp = d.playerMax; } };
d.hurtHero = () => {};
d.boss.brain.pause = 1e9;
d.boss.brain.timedDone = 1e9;
d.countdown = -1;
if (who === 'ember') { d.bossWorld().tag(1, 0, 3, 0, -9.4); }
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
step(1);
const B = () => d.foe.group.position;
const V = B().constructor;
const hero = a.caster.group.position;
hero.set(B().x + 2, 0, B().z + 8);
hm.setZoom(0.6);
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const tiles = [];
const grab = (label) => {
  hm.focus = new V(B().x + (hero.x - B().x) * 0.3, 0, B().z + (hero.z - B().z) * 0.3);
  step(1 / 60);
  vfx.render();
  const src = canvas(), c = document.createElement('canvas');
  c.width = 320; c.height = 300;
  const g = c.getContext('2d');
  const sh = src.height * 0.85, sw = sh * 320 / 300;
  g.drawImage(src, (src.width - sw) / 2, src.height * 0.02, sw, sh, 0, 0, 320, 300);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 320, 20);
  g.fillStyle = '#ffd27a'; g.font = '600 13px sans-serif'; g.fillText(label, 5, 15);
  tiles.push(c);
};
const low = () => {
  let lo = 1e9; const v = new V();
  d.figure.group.updateMatrixWorld(true);
  d.figure.group.traverse((m) => {
    if (!m.isMesh) return;
    for (let q = m; q && q !== d.figure.group; q = q.parent) if (!q.visible) return;
    const P = m.geometry.attributes.position;
    for (let k = 0; k < P.count; k += 3) { if (m.isSkinnedMesh) m.getVertexPosition(k, v); else v.fromBufferAttribute(P, k); v.applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
  });
  return +lo.toFixed(2);
};
let seq = 8000;
const res = {};
try {
  for (const move of MOVES) {
    const mv = def.moves[move];
    if (!mv) { res[move] = 'no such move'; continue; }
    const charge = Math.max(0.6, mv.charge || 1);
    const c = { id: ++seq, move, step: 0, x: B().x, z: B().z, fx: hero.x, fz: hero.z, dir: Math.atan2(hero.x - B().x, hero.z - B().z), seed: 4242, target: 0 };
    try { d.boss.link.cast(c); } catch (e) { res[move] = 'cast failed: ' + String(e).slice(0, 120); continue; }
    step(charge * 0.6); const w = low(); grab(`${move}: wind-up`);
    step(charge * 0.4); const s = low(); grab(`${move}: strike`);
    res[move] = { windLow: w, strikeLow: s };
    step(Math.max(2, (mv.lock ?? 2) + 1.5));
    hero.set(B().x + 2, 0, B().z + 8);
  }
} catch (e) { res.error = String(e?.stack ?? e).slice(0, 400); } finally { performance.now = realNow; }
const sheet = document.createElement('canvas');
sheet.width = 4 * 320; sheet.height = Math.ceil(tiles.length / 4) * 300;
const g = sheet.getContext('2d');
tiles.forEach((t, i) => g.drawImage(t, (i % 4) * 320, Math.floor(i / 4) * 300));
return { [`moves_${who}`]: sheet.toDataURL('image/jpeg', 0.85), res };
