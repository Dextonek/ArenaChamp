// Before and after pictures of Big Yoko textured with TextureCraft, drawn by the game's own figure code in the hero
// stand's light (HeroPreview, as pipeline/tools/v4-sheet.js does). Run from the repo root (PowerShell):
//
//   python pipeline/tools/page-shots.py pipeline/textures/texturecraft/sumo/shots.js docs/heroes/texturecraft-sample --page /game --port 5265 --timeout 400
//
// It loads the two GLBs from the sample folder (docs/heroes/texturecraft-sample: sumo_v4.glb, the game's model copied,
// and sumo_tc_v4.glb); the dev server serves the repo root, and a file name ending in _v4.glb is what makes the game
// load a model as a hero of the fourth style. Nothing in public/models is read for Yoko.
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const pv = new HeroPreview();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V = pv.at.constructor;
const DIR = 'docs/heroes/texturecraft-sample/';
const BEFORE = DIR + 'sumo_v4.glb', AFTER = DIR + 'sumo_tc_v4.glb';
const kitOf = (name) => game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k])).find((k) => k.name === name);
const yoko = kitOf('Big Yoko');

// one picture of `url` moving as `kit`, from view `v`, w x h
async function shot(url, kit, v, w, h) {
  pv.figure.atEase = v.ease ?? true;
  pv.shown = undefined;
  pv.show(url, kit);
  const t0 = performance.now();
  while (!pv.figure.loaded && performance.now() - t0 < 20000) await sleep(30);
  const melee = !!pv.figure.melee, pos = new V();
  for (const fr of v.frames ?? [{ n: 120 }]) for (let k = 0; k < fr.n; k++) {
    if (fr.walk) pos.z += fr.walk / 60;
    pv.figure.group.rotation.y = v.yaw;
    pv.figure.follow(1 / 60, pos, 0, fr.state ? fr.state(k, melee) : {});
  }
  const root = pv.figure.shown;
  if (root) { root.position.x = 0; root.position.z = 0; }
  if (v.bone && root) {
    // aimed at a bone, wherever this hero's build and pose put it; the camera on the bone's own side
    root.updateMatrixWorld(true);
    const p = root.getObjectByName(v.bone).getWorldPosition(new V());
    const side = Math.sign(p.x) || 1;
    pv.camera.position.set(p.x + side * v.off[0], p.y + v.off[1], p.z + v.off[2]);
    pv.camera.lookAt(p.x, p.y + (v.lift ?? 0), p.z);
  } else {
    pv.camera.position.set(...v.cam);
    pv.camera.lookAt(...v.look);
  }
  pv.renderer.setSize(w * 2, h * 2, false);
  pv.camera.aspect = w / h;
  pv.camera.updateProjectionMatrix();
  pv.renderer.render(pv.scene, pv.camera);
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  c.getContext('2d').drawImage(pv.canvas, 0, 0);
  return c;
}

// a grid: rows of [label, url, kit], columns of views; labels left and on top
async function grid(rows, views, w, h) {
  const left = 150, top = 34;
  const c = document.createElement('canvas');
  c.width = left + views.length * w * 2;
  c.height = top + rows.length * h * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#aaa'; g.font = '22px sans-serif';
  views.forEach((v, i) => g.fillText(v.t, left + i * w * 2 + 10, 24));
  for (let r = 0; r < rows.length; r++) {
    const [label, url, kit] = rows[r];
    g.fillStyle = '#fc8'; g.font = 'bold 22px sans-serif';
    label.split('\n').forEach((line, k) => g.fillText(line, 10, top + r * h * 2 + h + k * 26));
    for (let i = 0; i < views.length; i++) g.drawImage(await shot(url, kit, views[i], w, h), left + i * w * 2, top + r * h * 2);
  }
  return c.toDataURL('image/jpeg', 0.9);
}

const wind = (u) => ({ n: Math.max(1, Math.round(24 * u)), state: (k, m) => ({ attack: { wind: k / 24, release: 0, melee: m } }) });
const after = (s) => ({ n: Math.max(1, Math.round(60 * s)), state: () => ({ attack: { wind: -1, release: 10, melee: true } }) });
const body = [
  { t: 'front', yaw: 0.0, cam: [0, 1.35, 6.2], look: [0, 1.2, 0] },
  { t: 'three-quarter', yaw: 0.75, cam: [0, 1.35, 6.2], look: [0, 1.2, 0] },
  { t: 'back', yaw: Math.PI - 0.5, cam: [0, 1.35, 6.2], look: [0, 1.2, 0] },
];
const close = [
  { t: 'rope, stole and crest', yaw: 0.35, cam: [0, 1.45, 2.3], look: [0, 1.2, 0] },
  { t: 'fist: forearm guard', yaw: 0, bone: 'hand_r', off: [0.75, 0.2, 0.75], lift: 0.12 },
  { t: 'hips from behind', yaw: Math.PI + 0.45, cam: [0, 1.05, 2.3], look: [0, 0.95, 0] },
  { t: 'shoulder plate', yaw: 0, bone: 'upperarm_l', off: [0.45, 0.75, 0.8], lift: 0.08 },
];
const camera = [
  { t: 'game camera', yaw: 0.3, cam: [0, 7.0, 5.0], look: [0, 1.0, 0] },
  { t: 'game camera, from behind', yaw: Math.PI - 0.3, cam: [0, 7.0, 5.0], look: [0, 1.0, 0] },
];
const motion = [
  { t: 'walking', ease: false, yaw: 1.2, cam: [0, 1.35, 6.6], look: [0, 1.2, 0], frames: [{ n: 60 }, { n: 50, walk: 3.6 }] },
  { t: 'attack, at the hit', ease: false, yaw: 0.8, cam: [0, 1.35, 6.6], look: [0, 1.2, 0], frames: [{ n: 60 }, wind(1), after(0.03)] },
  { t: 'attack, the follow-through', ease: false, yaw: 0.8, cam: [0, 1.35, 6.6], look: [0, 1.2, 0], frames: [{ n: 60 }, wind(1), after(0.3)] },
];
const pair = [['before\n(game today)', BEFORE, yoko], ['after\n(TextureCraft)', AFTER, yoko]];
const out = {};
out.compare_body = await grid(pair, body, 300, 400);
out.compare_close = await grid(pair, close, 300, 340);
out.compare_game_camera = await grid(pair, camera, 300, 300);
out.motion_after = await grid(pair, motion, 300, 400);

// the line-up the art bible asks for: Yoko before and after between Sefu and Kaia, standing as in a fight
const lineup = [['Sefu', kitOf('Sefu')], ['Big Yoko\nbefore', yoko, BEFORE], ['Big Yoko\nafter', yoko, AFTER], ['Kaia', kitOf('Kaia')]];
{
  const W = 300, H = 440, c = document.createElement('canvas');
  c.width = W * 2 * lineup.length; c.height = H * 2 + 70;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < lineup.length; i++) {
    const [name, kit, url] = lineup[i];
    g.drawImage(await shot(url ?? kit.model, kit, { ease: false, yaw: 0.35, cam: [0, 1.45, 6.6], look: [0, 1.3, 0], frames: [{ n: 90 }] }, W, H), i * W * 2, 0);
    g.fillStyle = '#fc8'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
    name.split('\n').forEach((line, k) => g.fillText(line, i * W * 2 + W, H * 2 + 30 + k * 28));
  }
  out.lineup = c.toDataURL('image/jpeg', 0.9);
}
return out;
