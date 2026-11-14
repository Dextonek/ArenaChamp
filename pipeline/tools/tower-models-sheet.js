// Pictures of the Climb's own people (blender/tower, docs/tower/models/README.md) drawn by the game's own figure code
// (HeroFigure: the pack's idle clip, held things held as in the camp), beside the heroes Sefu and Kaia at their true
// sizes. One chapter at a time: `window._towerChapter` ('sea', 'wood', 'sands', 'deep', 'war'; default 'sea'), set
// before the script runs (page-shots runs the file's body: prepend `window._towerChapter = 'wood';`), or a list of your
// own in `window._towerFigs`. Run headless through page-shots on a dev server that is up (or its own):
//
//   python pipeline/tools/page-shots.py pipeline/tools/tower-models-sheet.js docs/tower/models --port 5254
//
// It returns <chapter>-lineup-game (the game's high three-quarter camera), <chapter>-lineup-front, <chapter>-sheet
// (every figure alone; with `window._towerSet` = 'rulers' or 'enemies': <chapter>-rulers-game, -front, -sheet) and per figure <chapter>-<name> (front, back, the game camera, the face). The people are read
// from public/models/tower/<id>_v4.glb (blender/tower/build.py --out public/models/tower); a figure with `url` from there.
// `stand` is the hero whose way of holding the figure borrows (src/motion/real.ts REAL_STYLE: Sefu holds a staff
// upright in the left hand, Auriel a shield on the left arm, Brannoc strikes with the right); the game's people use the
// same (src/tower/world/people.ts). The Sea's docker and Admiral (an enemy and a ruler) are not in the game: their
// models are in docs/tower/models/glb when built, and are drawn with `window._towerFigs`.
const { TOWER_FOLK } = await import('/src/tower/world/folk.ts');
const CH0 = window._towerChapter ?? 'sea';
const FIGS = window._towerFigs ?? TOWER_FOLK.filter((f) => f.chapter === CH0).map((f) => ({ id: f.id, name: f.name, role: f.title.split(':')[0], stand: f.stand }));
// The hero stand's own renderer, scene and light (src/game/heroPreview.ts), so the page's one copy of three.js is used;
// its plinth and its own figure are hidden.
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const { HERO_KITS } = await import('/src/heroes.ts');
// the pictures are named after the chapter of the first figure: <chapter>-lineup-game, <chapter>-sheet, <chapter>-<name>
const CH = FIGS[0].id.split('_')[0];
// `window._towerSet` ('rulers', 'enemies'): the line-ups are named <chapter>-<set>-game, -front and -sheet (default 'lineup' and 'sheet').
const SET = window._towerSet ?? null;
const NAME = (what) => (SET ? `${CH}-${SET}-${what === 'sheet' ? 'sheet' : what}` : what === 'sheet' ? `${CH}-sheet` : `${CH}-lineup-${what}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kitOf = (n) => HERO_KITS.find((k) => k.name === n);
const pv = new HeroPreview();
const { renderer, scene, camera } = pv;
const V3 = pv.at.constructor;
for (const o of scene.children) if (o.isMesh) o.visible = false;
pv.figure.group.visible = false;
renderer.setPixelRatio(1);
renderer.setClearColor(0x15141a, 1);
camera.far = 200;

// Everyone in one scene, so sizes compare truly: Sefu, the new five, Kaia.
const row = [{ id: 'sefu', name: 'Sefu (hero)', url: 'models/heroes/sand_v4.glb', stand: 'Sefu' },
  ...FIGS.map((f) => ({ ...f, url: f.url ?? `models/tower/${f.id}_v4.glb` })),
  { id: 'kaia', name: 'Kaia (hero)', url: 'models/heroes/storm_v4.glb', stand: 'Kaia' }];
let x = 0;
for (const r of row) {
  const s = r.scale ?? 1;
  x += 0.95 * s;
  r.pos = new V3(x, 0, 0);
  x += 0.95 * s;
  r.fig = new HeroFigure();
  r.fig.atEase = true;
  scene.add(r.fig.group);
  r.fig.setModel(r.url, r.pos, kitOf(r.stand));
  r.fig.stand();
}
const mid = x / 2;
for (const r of row) r.pos.x -= mid;
const t0 = performance.now();
while (row.some((r) => !r.fig.loaded) && performance.now() - t0 < 60000) await sleep(50);
const missing = row.filter((r) => !r.fig.loaded).map((r) => r.id);
for (const r of row) if (r.scale) r.fig.setScale(r.scale);
const pose = (yaw, only) => {
  for (let k = 0; k < 90; k++) for (const r of row) {
    r.fig.group.visible = !only || r === only;
    r.fig.follow(1 / 60, r.pos, yaw);
  }
};
const shoot = (w, h, label) => {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h + (label ? 34 : 0);
  const g = c.getContext('2d');
  g.fillStyle = '#15141a';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(renderer.domElement, 0, 0);
  if (label) label(g, w, h);
  return c;
};
const names = (g, w, h) => {
  g.textAlign = 'center';
  for (const r of row) {
    const p = r.pos.clone().project(camera);
    const sx = (p.x + 1) / 2 * w;
    g.fillStyle = r.id === 'sefu' || r.id === 'kaia' ? '#9aa' : '#fc8';
    g.font = 'bold 15px sans-serif';
    g.fillText(r.name, sx, h + 15);
    g.fillStyle = '#999';
    g.font = '12px sans-serif';
    g.fillText(r.role ?? '', sx, h + 30);
  }
};
const out = {};
// the game's camera: high, from the south, looking down at about 50 degrees ((0, 7, 5) toward (0, 1, 0)), pulled back
pose(0.25);
const dir = new V3(0, 6, 5).normalize();
camera.fov = 30;
camera.position.copy(new V3(0, 1.4, 0).addScaledVector(dir, 13.8));
camera.lookAt(0, 1.4, 0);
// giants (a ruler is drawn 2.2 times a hero, a big enemy at its unit's size): the camera stands back as far as they are tall
const BIG = Math.max(1, ...row.map((r) => r.scale ?? 1)), K = 1 + (BIG - 1) * 0.55, WIDE = Math.max(1, x / 15);
camera.position.copy(new V3(0, 1.4 * K, 0).addScaledVector(dir, 13.8 * Math.max(K, WIDE)));
camera.lookAt(0, 1.4 * K, 0);
out[NAME('game')] = shoot(1800, Math.round(620 * Math.min(1.5, K)), names).toDataURL('image/jpeg', 0.9);
camera.position.set(0, 2.3 * K, 12.6 * Math.max(K, WIDE));
camera.lookAt(0, 2.15 * K, 0);
out[NAME('front')] = shoot(1800, Math.round(680 * Math.min(1.5, K)), names).toDataURL('image/jpeg', 0.9);

// each alone: front, back, the game camera, the face
const W = 300, H = 420;
const sheet = document.createElement('canvas');
sheet.width = 150 + W * 4;
sheet.height = 30 + H * FIGS.length;
const sg = sheet.getContext('2d');
sg.fillStyle = '#111';
sg.fillRect(0, 0, sheet.width, sheet.height);
sg.fillStyle = '#aaa';
sg.font = '15px sans-serif';
['front', 'back', 'game camera', 'face'].forEach((t, i) => sg.fillText(t, 150 + i * W + 8, 20));
for (let i = 0; i < FIGS.length; i++) {
  const r = row.find((q) => q.id === FIGS[i].id);
  const s = r.scale ?? 1, p = r.pos, cy = 1.25 * s;
  const tiles = [];
  pose(0.35, r);
  camera.fov = 30;
  camera.position.set(p.x, cy + 0.2 * s, 7.4 * s);
  camera.lookAt(p.x, cy, 0);
  tiles.push(shoot(W, H));
  pose(Math.PI - 0.5, r);
  tiles.push(shoot(W, H));
  pose(0.3, r);
  camera.position.copy(new V3(p.x, s, 0).addScaledVector(dir, 6.6 * s));
  camera.lookAt(p.x, s, 0);
  tiles.push(shoot(W, H));
  pose(0.25, r);
  const head = new V3();
  r.fig.group.updateMatrixWorld(true);
  const hb = [];
  r.fig.group.traverse((o) => { if (o.name === 'Head') hb.push(o); });
  if (hb[0]) hb[0].getWorldPosition(head); else head.set(p.x, 2.2 * s, 0);
  camera.position.set(head.x + 0.3 * s, head.y + 0.15 * s, head.z + 1.5 * s);
  camera.lookAt(head.x, head.y + 0.12 * s, head.z);
  tiles.push(shoot(W, H));
  tiles.forEach((t, k) => sg.drawImage(t, 150 + k * W, 30 + i * H));
  sg.fillStyle = '#fc8';
  sg.font = 'bold 16px sans-serif';
  sg.fillText(FIGS[i].name, 8, 30 + i * H + H / 2 - 8);
  sg.fillStyle = '#999';
  sg.font = '13px sans-serif';
  sg.fillText(FIGS[i].role, 8, 30 + i * H + H / 2 + 12);
  const one = document.createElement('canvas');
  one.width = W * 4;
  one.height = H;
  tiles.forEach((t, k) => one.getContext('2d').drawImage(t, k * W, 0));
  out[FIGS[i].id.replace(/_/g, '-')] = one.toDataURL('image/jpeg', 0.9);
}
for (const r of row) r.fig.group.visible = true;
out[NAME('sheet')] = sheet.toDataURL('image/jpeg', 0.88);
out.missing = missing;
return out;
