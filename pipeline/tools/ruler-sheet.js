// The model review (docs/models/review/rulers.md): the Climb's rulers through HeroFigure, at their first floor's size and stand-in.
//   python -I pipeline/tools/page-shots.py pipeline/tools/ruler-sheet.js <out folder> --port 5195 --json metrics.json   (window._only = ['wood_elder'] first for some)
// The model review: the Climb's fifteen rulers through the hero figure code they fight with (HeroFigure, the stand-in hero's way of
// striking, the ruler's hold), beside Sefu at their floor's size: standing, walking, the basic attack (wind-up, hit, after) and each
// cast style; three views a frame and the numbers (feet, lowest other point, top, the hands).
const { piecesOf } = await import('/src/tower/world/pieces/floors.ts');
const { withRulerModel, RULER_OF } = await import('/src/tower/world/pieces/rulerModels.ts');
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const { HERO_KITS } = await import('/src/heroes.ts');
const { REAL_STYLE } = await import('/src/motion/real.ts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firsts = {};
for (const [f, id] of Object.entries(RULER_OF)) if (!firsts[id]) firsts[id] = +f;
const ONLY = window._only ?? null;
const pv = new HeroPreview();
const { renderer, scene, camera } = pv;
const C = pv.at.constructor;
const plinth = scene.children.find((o) => o.isMesh && o.geometry.type === 'CylinderGeometry');
for (const o of scene.children) if (o.isMesh) o.visible = false;
plinth.visible = true; plinth.scale.set(8, 1, 8); plinth.material.color.setHex(0x55504a);
pv.figure.group.visible = false;
renderer.setPixelRatio(1);
renderer.setClearColor(0x2a2c30, 1);
camera.far = 300;
const kit = (n) => HERO_KITS.find((k) => k.name === n);
const sefu = new HeroFigure();
sefu.atEase = true;
scene.add(sefu.group);
const sefuPos = new C(-2.2, 0, -2.4);
sefu.setModel('models/heroes/sand_v4.glb', sefuPos, kit('Sefu'));
const FOOTB = /foot|ball|toe/i;
const low = (root) => {
  root.updateMatrixWorld(true);
  let lo = 1e9, foot = 1e9, top = -1e9;
  const v = new C();
  root.traverse((m) => {
    if (!m.isSkinnedMesh || !m.visible) return;
    const n = m.geometry.attributes.position.count, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
    for (let i = 0; i < n; i += 3) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      let fw = 0; for (let k = 0; k < 4; k++) if (FOOTB.test(bones[si.getComponent(i, k)]?.name ?? '')) fw += sw.getComponent(i, k);
      if (fw > 0.5) foot = Math.min(foot, v.y); else lo = Math.min(lo, v.y);
      top = Math.max(top, v.y);
    }
  });
  return { foot: +foot.toFixed(3), lo: +lo.toFixed(3), top: +top.toFixed(2) };
};
const W = 250, H = 330;
const shoot = (w, h) => {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return c;
};
const out = { metrics: {} };
for (let i = 0; i < 400 && !sefu.loaded; i++) await sleep(50);
for (let i = 0; i < 20; i++) sefu.follow(1 / 60, sefuPos, 0);
for (const [id, floor] of Object.entries(firsts)) {
  if (ONLY && !ONLY.includes(id)) continue;
  const p = withRulerModel(piecesOf(floor));
  const r = p.ruler, stand = kit(r.stand);
  const name = r.name;
  const k = { ...stand, name, model: r.model };
  const fig = new HeroFigure();
  scene.add(fig.group);
  const pos = new C(0.6, 0, 0);
  fig.setModel(r.model, pos, k);
  for (let i = 0; i < 400 && !fig.loaded; i++) await sleep(50);
  fig.setScale(r.scale);
  const frames = [], m = { id, floor, name, stand: r.stand, scale: r.scale, hold: REAL_STYLE[name]?.hold ?? null, melee: !!stand.melee };
  const hgt = 2.34 * r.scale;
  const T = hgt * 1.1;
  const run = (secs, state = () => ({}), move = null) => { for (let i = 0; i < Math.round(secs * 60); i++) { if (move) move(i / 60); fig.follow(1 / 60, pos, yaw, state(i / Math.round(secs * 60))); sefu.follow(1 / 60, sefuPos, 0); } };
  let yaw = 0;
  const views = (label) => {
    const dir = new C(0, 6, 5).normalize();
    const c = new C(pos.x - 0.6, T * 0.42, pos.z - 0.4);
    camera.fov = 30;
    camera.position.copy(c).addScaledVector(dir, 3.9 * T);
    camera.lookAt(c);
    const a = shoot(W, H);
    camera.position.set(pos.x + 2.4 * T, T * 0.5, pos.z + 0.3);
    camera.lookAt(pos.x, T * 0.47, pos.z);
    const b = shoot(W, H);
    camera.position.set(pos.x - 1.6 * T, T * 0.55, pos.z + 1.8 * T);
    camera.lookAt(pos.x, T * 0.47, pos.z);
    const c3 = shoot(W, H);
    frames.push({ label, a, b, c: c3 });
    const hr = [], hl = [];
    fig.group.traverse((o) => { if (o.name === 'hand_r') hr.push(o); if (o.name === 'hand_l') hl.push(o); });
    m[label] = { ...low(fig.group), handR: hr[0] ? hr[0].getWorldPosition(new C()).toArray().map((x) => +x.toFixed(2)) : null, handL: hl[0] ? hl[0].getWorldPosition(new C()).toArray().map((x) => +x.toFixed(2)) : null };
  };
  run(1.0); views('idle');
  run(1.0, () => ({}), (t) => { pos.z += 2.2 / 60; }); views('walk');
  pos.z = 0; run(0.6);
  const att = (w, rel) => ({ attack: { wind: w, release: rel, melee: !!stand.melee } });
  run(0.25, (q) => att(q * 0.6, 0)); views('attack wind');
  run(0.12, (q) => att(0.6 + 0.4 * q, 0)); run(1 / 60, () => att(-1, 1)); views('attack hit');
  run(0.25, () => att(-1, 1)); views('attack after');
  run(0.8, () => att(-1, 0));
  for (const style of ['thrust', 'swing', 'slam', 'lunge', 'raise']) {
    fig.cast(style, 1.2, true);
    run(0.32); views(style);
    run(1.4);
  }
  // the sheet row: three views a frame
  const row = document.createElement('canvas');
  row.width = 170 + frames.length * W; row.height = H * 3;
  const g = row.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, row.width, row.height);
  frames.forEach((fr, i) => { g.drawImage(fr.a, 170 + i * W, 0); g.drawImage(fr.b, 170 + i * W, H); g.drawImage(fr.c, 170 + i * W, 2 * H); g.fillStyle = '#fc8'; g.font = 'bold 14px sans-serif'; g.fillText(fr.label, 170 + i * W + 8, 18); });
  g.fillStyle = '#fc8'; g.font = 'bold 15px sans-serif'; g.fillText(id, 8, H);
  g.fillStyle = '#aaa'; g.font = '12px sans-serif';
  [`floor ${floor}`, name.slice(0, 22), `stand-in ${r.stand}`, `x${r.scale} ${m.hold ?? ''} ${m.melee ? 'melee' : 'ranged'}`].forEach((t, j) => g.fillText(t, 8, H + 20 + 16 * j));
  out['ruler-' + id] = row.toDataURL('image/jpeg', 0.82);
  out.metrics[id] = m;
  fig.group.removeFromParent();
}
return out;
