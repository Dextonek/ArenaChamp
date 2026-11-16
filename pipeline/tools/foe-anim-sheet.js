// The model review (docs/models/review/): every enemy model look of the Climb (src/tower/world/foeKinds.ts FOE_MODELS) driven by the
// game's own pose code (foeModels.ts modelLook) through idle, walk, its blow (wind-up, hit, follow, a second blow) or its shot
// (release, after) and a walk to the west, beside Sefu; three views a frame (the game's high camera, from the side, the feet at
// ground level) and measurements a frame: the lowest vertex of the feet (`foot`) and of everything else (`lo`), the top, which way
// the feet point (`face`, degrees from +Z), where the hands are. Three heroes run through the same code as the yardstick.
//
//   python -I pipeline/tools/page-shots.py pipeline/tools/foe-anim-sheet.js <out folder> --port 5195 --json metrics.json
//
// `window._only = ['bowman-r', 'pale'];` on a line before the file's text draws only those.
// Every enemy model look through its game pose driver (modelLook), beside Sefu, frames of idle/walk/jog/strike/shot,
// with measurements: lowest vertex (ground), foot direction vs +Z (facing), hand bones.
const { FOE_MODELS } = await import('/src/tower/world/foeKinds.ts');
const { modelLook } = await import('/src/tower/world/foeModels.ts');
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const { HERO_KITS } = await import('/src/heroes.ts');
const ONLY = window._only ?? null;
const UNIT = {};
{ const { FLOORS } = await import('/src/tower/world/floors/index.ts');
  for (const def of Object.values(FLOORS)) { if (!def) continue; for (const sp of Object.values(def.enemies ?? {})) if (FOE_MODELS[sp.look] && !UNIT[sp.look]) UNIT[sp.look] = { speed: sp.speed, scale: sp.scale ?? 1 }; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pv = new HeroPreview();
const { renderer, scene, camera } = pv;
const V3 = pv.at.constructor;
const plinth = scene.children.find((o) => o.isMesh && o.geometry.type === 'CylinderGeometry');
for (const o of scene.children) if (o.isMesh) o.visible = false;
plinth.visible = true; plinth.scale.set(6, 1, 6); plinth.material.color.setHex(0x55504a);
pv.figure.group.visible = false;
renderer.setPixelRatio(1);
renderer.setClearColor(0x2a2c30, 1);
camera.far = 300;
FOE_MODELS['hero-sefu'] = { id: '../heroes/sand', height: 2.34, strike: 'blade', hold: 'torch' };
FOE_MODELS['hero-kaia'] = { id: '../heroes/storm', height: 2.34, shot: 'spell', hold: 'torch' };
FOE_MODELS['hero-brannoc'] = { id: '../heroes/forge', height: 2.34, strike: 'heavy' };
const keys = Object.keys(FOE_MODELS).filter((k) => !ONLY || ONLY.includes(k));
const kit = (n) => HERO_KITS.find((k) => k.name === n);
const sefu = new HeroFigure();
sefu.atEase = true;
scene.add(sefu.group);
const sefuPos = new V3(-1.4, 0, -1.6);
sefu.setModel('models/heroes/sand_v4.glb', sefuPos, kit('Sefu'));
sefu.stand();
const C = pv.at.constructor; // Vector3
const colorOf = (sc) => sc;
const pal = () => {
  const m = new (scene.children.find((o) => o.isMesh).material.constructor)();
  return { body: m, trim: m.clone(), eye: m.clone(), outline: m.clone() };
};
const dummy = () => ({ root: new (sefu.group.constructor)(), animate() {}, dispose() {} });
const out = { metrics: {} };
const W = 260, H = 330;
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
const t0 = performance.now();
while (!sefu.loaded && performance.now() - t0 < 30000) await sleep(50);
for (let i = 0; i < 20; i++) sefu.follow(1 / 60, sefuPos, 0);
const skinned = (root) => { const a = []; root.traverse((o) => { if (o.isSkinnedMesh) a.push(o); }); return a; };
const FOOTB = /foot|ball|toe/i;
const lowest = (root) => {
  root.updateMatrixWorld(true);
  let min = 1e9, max = -1e9, foot = 1e9; const v = new C();
  for (const m of skinned(root)) {
    if (!m.visible) continue;
    const n = m.geometry.attributes.position.count, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
    for (let i = 0; i < n; i += 3) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      let fw = 0; for (let k = 0; k < 4; k++) if (FOOTB.test(bones[si.getComponent(i, k)]?.name ?? '')) fw += sw.getComponent(i, k);
      if (fw > 0.5) { if (v.y < foot) foot = v.y; } else if (v.y < min) min = v.y;
      if (v.y > max) max = v.y;
    }
  }
  return [min, max, foot];
};
const bone = (root, n) => { let b = null; root.traverse((o) => { if (!b && o.name === n) b = o; }); return b; };
const wp = (o) => o.getWorldPosition(new C());
const sheetRows = [];
for (const key of keys) {
  const f = FOE_MODELS[key], u = UNIT[key] ?? { speed: 3, scale: 1 };
  const look = modelLook(f, () => dummy(), u);
  const rig = look('melee', pal());
  rig.root.scale.multiplyScalar(u.scale ?? 1);
  scene.add(rig.root);
  rig.root.position.set(0.4, 0, 0);
  const pose = { time: 0, walk: 0, swing: -1, shot: 0 };
  const tl = performance.now();
  // let it load
  for (let i = 0; i < 400; i++) { rig.animate(1 / 60, pose); if (rig.root.children.find((c) => c.visible && c.children.length)) break; await sleep(30); }
  for (let i = 0; i < 6; i++) rig.animate(1 / 60, pose);
  const hero = rig.root.children[rig.root.children.length - 1].children[0];
  const run = (secs, set) => { for (let i = 0; i < Math.round(secs * 60); i++) { pose.time += 1 / 60; set?.(i / Math.round(secs * 60)); rig.animate(1 / 60, pose); } rig.animate(1 / 60, pose); rig.animate(1 / 30, pose); };
  const s = (u.scale ?? 1), hgt = f.height * s;
  const frames = [], m = { key, id: f.id, scale: s, height: f.height };
  const measure = (label) => {
    const [lo, hi, foot] = lowest(rig.root);
    const fl = bone(hero, 'foot_l'), bl = bone(hero, 'ball_l'), fr = bone(hero, 'foot_r'), br = bone(hero, 'ball_r');
    let face = null;
    if (fl && bl && fr && br) {
      const d = wp(bl).sub(wp(fl)).add(wp(br).sub(wp(fr)));
      face = +(Math.atan2(d.x, d.z) * 180 / Math.PI).toFixed(0);
    }
    const hr = bone(hero, 'hand_r'), hl = bone(hero, 'hand_l');
    m[label] = { foot: +foot.toFixed(3), lo: +lo.toFixed(3), top: +hi.toFixed(2), face, handR: hr ? wp(hr).toArray().map((x) => +x.toFixed(2)) : null, handL: hl ? wp(hl).toArray().map((x) => +x.toFixed(2)) : null };
  };
  const views = (label) => {
    // game camera: high from the south, looking down ~50 deg
    const dir = new C(0, 6, 5).normalize();
    const T = Math.max(2.3, hgt * 1.15);
    const c = new C(-0.3, T * 0.42, -0.4);
    camera.fov = 30;
    camera.position.copy(c).addScaledVector(dir, 3.9 * T);
    camera.lookAt(c);
    const a = shoot(W, H);
    // side close-up, from the figure's right (east), low
    camera.position.set(0.4 + 2.4 * T, T * 0.5, 0.3);
    camera.lookAt(0.4, T * 0.47, 0);
    const b = shoot(W, H);
    // the feet, from low and close (ground level, from the south-east)
    camera.position.set(0.4 + 0.9 * Math.max(1, hgt / 2.3), 0.12, 1.5 * Math.max(1, hgt / 2.3));
    camera.lookAt(0.4, 0.15, 0);
    const c3 = shoot(W, Math.round(H * 0.55));
    frames.push({ label, a, b, c: c3 });
    measure(label);
  };
  run(1.0);
  views('idle');
  pose.walk = 1; run(1.2); views('walk');
  // jog: the unit's speed is what it is; idle-walk-jog blend depends on legSpeed
  pose.walk = 0; run(0.6);
  // strike: wind-up then land
  if (!f.shot) {
    pose.swing = 0; run(0.15, (k) => { pose.swing = k * 0.5; }); views('wind-up');
    run(0.15, (k) => { pose.swing = 0.5 + k * 0.5; }); pose.swing = 1; rig.animate(1 / 60, pose); views('hit');
    pose.swing = -1; run(0.18); views('follow');
    run(0.6);
    pose.swing = 0; run(0.3, (k) => { pose.swing = k; }); pose.swing = 1; rig.animate(1 / 60, pose); views('hit-2');
    pose.swing = -1; run(0.6);
  } else {
    pose.shot = 1; run(0.1, (k) => { pose.shot = 1 - k * 0.4; }); views('release');
    run(0.15, (k) => { pose.shot = 0.6 - k * 0.6; }); pose.shot = 0; views('after');
    run(0.6);
  }
  // facing check while walking toward -X (turn the root as the summon system does: yaw = atan2(dx, dz))
  rig.root.rotation.y = Math.atan2(-1, 0); pose.walk = 1; run(0.8); views('walk-west');
  rig.root.rotation.y = 0; pose.walk = 0; run(0.5);
  // sheet row
  const row = document.createElement('canvas');
  row.width = 150 + frames.length * W; row.height = H * 2 + Math.round(H * 0.55);
  const g = row.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, row.width, row.height);
  frames.forEach((fr, i) => { g.drawImage(fr.a, 150 + i * W, 0); g.drawImage(fr.b, 150 + i * W, H); g.drawImage(fr.c, 150 + i * W, 2 * H); g.fillStyle = '#fc8'; g.font = 'bold 14px sans-serif'; g.fillText(fr.label, 150 + i * W + 8, 18); });
  g.fillStyle = '#fc8'; g.font = 'bold 16px sans-serif'; g.fillText(key, 8, H - 10);
  g.fillStyle = '#aaa'; g.font = '12px sans-serif'; g.fillText(`${f.id} h${f.height} x${s}`, 8, H + 10);
  out['row-' + key] = row.toDataURL('image/jpeg', 0.85);
  out.metrics[key] = m;
  rig.dispose?.();
  rig.root.removeFromParent();
}
return out;
