// The model review, round 2 (docs/models/review/round2/): a Raid boss standing still in the middle of its room (its brain held), each of
// its named parts measured (its lowest point, visible meshes only), from the game's camera and from the side at the floor's height;
// then the same at the wind-up and strike of each cast style its body has. `window._who` = 'warden' | 'ash' (default 'ash').
//   python -I pipeline/tools/page-shots.py <a copy with window._who first> <out folder> --port 5177 --json parts.json
const who = window._who ?? 'ash';
const { SUN_WARDEN } = await import('/src/raid/sunWarden.ts');
const { ASH_AND_EMBER } = await import('/src/raid/ashEmber.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
const def = who === 'warden' ? SUN_WARDEN : ASH_AND_EMBER;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'play');
vfx.heroPickCtrl.setValue('Kaia');
d.holdStart = false;
d.startBoss({ def, link: new LocalLink(def), seed: 'parts', mode: 'play' });
await d.whenReady();
await wait(2500);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
performance.now = () => simMs;
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
d.boss.brain.pause = 1e9;
d.countdown = -1;
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const at = d.foe.group.position.clone();
const V = at.constructor;
a.placeFoe(d.foe, at);
a.caster.group.position.set(at.x + 3, 0, at.z + 9);
step(0.8);
const cam = hm.host.camera;
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const tiles = [];
const grab = (label) => {
  const src = canvas(), c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  const g = c.getContext('2d');
  const sh = src.height * 0.8, sw = sh * 4 / 3;
  g.drawImage(src, (src.width - sw) / 2, src.height * 0.05, sw, sh, 0, 0, 400, 300);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 400, 20);
  g.fillStyle = '#ffd27a'; g.font = '600 13px sans-serif'; g.fillText(label, 5, 15);
  tiles.push(c);
};
const visible = (m) => { for (let q = m; q && q !== d.figure.group; q = q.parent) if (!q.visible) return false; return true; };
const measure = () => {
  d.figure.group.updateMatrixWorld(true);
  const parts = {};
  const v = new V();
  d.figure.group.traverse((m) => {
    if (!m.isMesh || !visible(m)) return;
    // the part: the nearest named node over the mesh
    let p = m; while (p && !p.name && p.parent) p = p.parent;
    const P = m.geometry.attributes.position;
    let lo = 1e9;
    for (let k = 0; k < P.count; k += 2) { if (m.isSkinnedMesh) m.getVertexPosition(k, v); else v.fromBufferAttribute(P, k); v.applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
    const key = p?.name || '?';
    parts[key] = Math.min(parts[key] ?? 1e9, +lo.toFixed(2));
  });
  return Object.fromEntries(Object.entries(parts).sort((x, y) => x[1] - y[1]).slice(0, 8));
};
const side = (label) => {
  vfx.render(); grab(label);
  cam.position.set(at.x + 11, 0.6, at.z + 2); cam.lookAt(at.x, 1.6, at.z); cam.updateMatrixWorld();
  vfx.render(); grab(label + ' (side, at floor height)');
  step(1 / 60);
};
const out = { parts: {} };
try {
  out.parts.standing = measure(); side('standing');
  for (const style of who === 'warden' ? ['swing', 'raise', 'thrust'] : ['slam', 'lunge', 'channel']) {
    d.figure.cast(style, 1.6, false);
    step(1.0); out.parts[`${style} wind-up`] = measure(); side(`${style} wind-up`);
    step(0.65); out.parts[`${style} strike`] = measure(); side(`${style} strike`);
    step(1.0);
  }
} finally { performance.now = realNow; }
const sheet = document.createElement('canvas');
sheet.width = 800; sheet.height = Math.ceil(tiles.length / 2) * 300;
const g = sheet.getContext('2d');
tiles.forEach((c, i) => g.drawImage(c, (i % 2) * 400, Math.floor(i / 2) * 300));
out[`parts_${who}`] = sheet.toDataURL('image/jpeg', 0.85);
out.room = d.currentArena?.id;
return out;
