// The Climb's beasts as models (src/tower/world/beasts/): each one's look, driven by the game's own code (beastLook and its pose),
// beside Sefu, through idle, two moments of its walk, its blow (wind-up, hit, after) or its shot (release, after); the code look it
// replaces first. Two views a frame: the game's high camera and the side. One sheet a beast, returned as `sheet_<id>`, and the
// lowest point of the model each frame (it must not go under the ground).
//
//   python -I pipeline/tools/page-shots.py pipeline/tools/beast-sheet.js <out folder> --port 5187 --browser msedge
//
// `window._only = ['hound'];` on a line before the file's text draws only those.
const { BEASTS } = await import('/src/tower/world/beasts/all.ts');
const { beastLook } = await import('/src/tower/world/beasts/index.ts');
const { codeLookOf } = await import('/src/tower/world/looks.ts');
const { escortLook } = await import('/src/tower/world/looksWild.ts');
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const { HERO_KITS } = await import('/src/heroes.ts');
// `window._beast = { key: 'crab', file: '/src/tower/world/beasts/crab.ts', name: 'CRAB' };` adds a beast not yet in all.ts (and draws only it).
if (window._beast) BEASTS[window._beast.key] = (await import(window._beast.file))[window._beast.name];
const ONLY = window._only ?? (window._beast ? [window._beast.key] : null);
// Each beast's unit (speed, scale, melee or not) from the floors' enemy specs; an escort has none.
const UNIT = {};
{
  const { FLOORS } = await import('/src/tower/world/floors/index.ts');
  for (const def of Object.values(FLOORS)) {
    if (!def) continue;
    for (const sp of Object.values(def.enemies ?? {})) if (BEASTS[sp.look] && !UNIT[sp.look]) UNIT[sp.look] = sp;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pv = new HeroPreview();
const { renderer, scene, camera } = pv;
const V3 = pv.at.constructor;
const plinth = scene.children.find((o) => o.isMesh && o.geometry.type === 'CylinderGeometry');
for (const o of scene.children) if (o.isMesh) o.visible = false;
plinth.visible = true;
plinth.scale.set(6, 1, 6);
plinth.material.color.setHex(0x55504a);
pv.figure.group.visible = false;
renderer.setPixelRatio(1);
renderer.setClearColor(0x2a2c30, 1);
camera.far = 300;
const kit = (n) => HERO_KITS.find((k) => k.name === n);
const sefu = new HeroFigure();
sefu.atEase = true;
scene.add(sefu.group);
const sefuPos = new V3(-1.6, 0, -1.2);
sefu.setModel('models/heroes/sand_v4.glb', sefuPos, kit('Sefu'));
sefu.stand();
const t0 = performance.now();
while (!sefu.loaded && performance.now() - t0 < 30000) await sleep(50);
for (let i = 0; i < 20; i++) sefu.follow(1 / 60, sefuPos, 0);
const Mat = scene.children.find((o) => o.isMesh).material.constructor;
const pal = () => {
  const m = new Mat({ color: 0x888888 });
  return { body: m, trim: m.clone(), eye: m.clone(), outline: m.clone() };
};
const W = 300, H = 300;
const shoot = (w, h) => {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return c;
};
const lowest = (root) => {
  root.updateMatrixWorld(true);
  let lo = 1e9;
  const v = new V3();
  root.traverse((m) => {
    if (!m.isMesh) return;
    for (let p = m; p; p = p.parent) if (!p.visible) return;
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y); }
  });
  return lo;
};
const out = { low: {} };
const keys = Object.keys(BEASTS).filter((k) => !ONLY || ONLY.includes(k));
for (const key of keys) {
  const def = BEASTS[key], sp = UNIT[key] ?? { speed: 2.5, scale: 1, melee: !def.shotY, look: key };
  const code = sp.id ? codeLookOf(sp) : escortLook(key);
  const s = sp.scale ?? 1, top = def.barY * s;
  const frames = [], lows = {};
  const views = (rig, label) => {
    const T = Math.max(2.0, top * 1.1);
    const dir = new V3(0, 6, 5).normalize(), c = new V3(-0.6, T * 0.35, -0.3);
    camera.fov = 30;
    camera.position.copy(c).addScaledVector(dir, 3.6 * T);
    camera.lookAt(c);
    const a = shoot(W, H);
    camera.position.set(0.3 + 2.6 * T, T * 0.45, 0.4);
    camera.lookAt(0.3, T * 0.38, 0);
    const b = shoot(W, H);
    frames.push({ label, a, b });
    lows[label] = +lowest(rig.root).toFixed(3);
  };
  // The code look it replaces, standing.
  {
    const rig = code('melee', pal());
    rig.root.scale.setScalar(s);
    rig.root.position.set(0.3, 0, 0);
    scene.add(rig.root);
    for (let i = 0; i < 30; i++) rig.animate(1 / 60, { time: i / 60, walk: 0, swing: -1, shot: 0 });
    views(rig, 'in code now');
    rig.root.removeFromParent();
    rig.dispose?.();
  }
  const look = beastLook(def, code, { speed: sp.speed ?? 2.5, scale: s });
  const rig = look('melee', pal());
  rig.root.scale.setScalar(s);
  rig.root.position.set(0.3, 0, 0);
  scene.add(rig.root);
  const pose = { time: 0, walk: 0, swing: -1, shot: 0 };
  const run = (secs, set) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { pose.time += 1 / 60; set?.(i / n); rig.animate(1 / 60, pose); } };
  for (let i = 0; i < 300; i++) { rig.animate(1 / 60, pose); if (rig.root.children.length === 1) break; await sleep(30); }
  run(1.2);
  views(rig, 'idle');
  pose.walk = 1;
  run(1.0);
  views(rig, 'walk');
  run(0.17);
  views(rig, 'walk, half a step on');
  pose.walk = 0;
  run(0.8);
  if (sp.melee !== false && !def.shotY) {
    pose.swing = 0;
    run(0.4, (k) => { pose.swing = k * 0.6; });
    views(rig, 'wind-up');
    run(0.12, (k) => { pose.swing = 0.6 + k * 0.4; });
    pose.swing = 1;
    rig.animate(1 / 60, pose);
    views(rig, 'hit');
    pose.swing = -1;
    run(0.25);
    views(rig, 'after');
  } else {
    pose.shot = 1;
    rig.animate(1 / 60, pose);
    run(0.08, (k) => { pose.shot = 1 - k * 0.3; });
    views(rig, 'shot');
    pose.shot = 0;
    run(0.4);
    views(rig, 'after');
  }
  rig.root.removeFromParent();
  rig.dispose?.();
  // The sheet: a row of frames, the game's camera over the side view.
  const c = document.createElement('canvas');
  c.width = W * frames.length;
  c.height = H * 2 + 26;
  const g = c.getContext('2d');
  g.fillStyle = '#16171a';
  g.fillRect(0, 0, c.width, c.height);
  frames.forEach((f, i) => {
    g.drawImage(f.a, i * W, 26);
    g.drawImage(f.b, i * W, 26 + H);
    g.fillStyle = '#ffd27a';
    g.font = '600 15px sans-serif';
    g.fillText(f.label, i * W + 8, 18);
  });
  out[`sheet_${key}`] = c.toDataURL('image/jpeg', 0.86);
  out.low[key] = lows;
}
return out;
