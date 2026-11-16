// Close-ups of the small marks of the hero touches (docs/heroes/touch/): the game's own figure in the hero stand's light
// (HeroPreview, as revamp-shots.js), the camera aimed at one bone. Run with pipeline/tools/page-shots.py:
//   python pipeline/tools/page-shots.py pipeline/tools/touch-close.js docs/heroes/touch/close --page /game --port 5284
// `window._close` may name the heroes to draw (theme names); every value returned is one picture per hero.
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const t0 = performance.now();
while (!(window.game && game.api) && performance.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 200));
const pv = (window._v4pv ??= new HeroPreview());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V = pv.at.constructor;
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
// theme: [[label, bone, yaw of the figure, camera offset (x, y, z) from the bone, look offset]]
const SHOTS = {
  door: [['jaw', 'Head', 0.9, [0, 0.0, 0.55], [0, 0.0, 0]], ['braids', 'Head', Math.PI, [0, 0.0, 0.7], [0, -0.05, 0]]],
  chrono: [['jaw', 'Head', 0.9, [0, 0.0, 0.55], [0, 0.0, 0]]],
  chef: [['kohl', 'Head', 0.2, [0, 0.05, 0.42], [0, 0.04, 0]], ['henna', 'hand_r', 0, [0, 0.35, 0.25], [0, 0, 0]]],
  weather: [['forearm', 'lowerarm_l', -1.2, [0, 0.1, 0.6], [0, 0, 0]]],
  sky: [['forearm', 'lowerarm_l', -1.2, [0, 0.1, 0.6], [0, 0, 0]], ['ear', 'Head', -1.2, [0, 0, 0.5], [0, 0, 0]]],
  tide: [['forearm', 'lowerarm_l', -1.2, [0, 0.1, 0.6], [0, 0, 0]], ['feet', 'foot_l', 0.3, [0, 0.35, 0.9], [-0.1, 0, 0]], ['hair', 'Head', Math.PI * 0.8, [0, 0.1, 0.7], [0, 0, 0]]],
  ink: [['hand', 'hand_l', -1.0, [0, 0.25, 0.4], [0, 0, 0]], ['hand', 'hand_r', 1.0, [0, 0.25, 0.4], [0, 0, 0]]],
  clockwork: [['knuckles', 'hand_l', -1.0, [0, 0.25, 0.4], [0, 0, 0]]],
  bard: [['face', 'Head', 0.3, [0, -0.02, 0.6], [0, 0.0, 0]]],
  courier: [['face', 'Head', 0.3, [0, 0.03, 0.55], [0, 0.03, 0]]],
  magic: [['ears', 'Head', 0.5, [0, 0.05, 0.6], [0, 0.04, 0]]],
  phoenix: [['face', 'Head', -0.8, [0, 0.04, 0.55], [0, 0.04, 0]], ['hand', 'hand_r', 0.6, [0, 0.2, 0.45], [0, 0, 0]]],
  sumo: [['hips behind', 'pelvis', Math.PI + 0.5, [0, 0.15, 1.3], [0, -0.05, 0]], ['hips side', 'pelvis', 1.4, [0, 0.15, 1.3], [0, -0.05, 0]]],
  mirror: [['face', 'Head', 0.2, [0, 0.03, 0.55], [0, 0.03, 0]]],
  blood: [['face', 'Head', 0.2, [0, 0.03, 0.55], [0, 0.03, 0]]],
  mason: [['face', 'Head', 0.4, [0, 0.03, 0.6], [0, 0.03, 0]]],
  referee: [['face', 'Head', 0.4, [0, 0.03, 0.6], [0, 0.03, 0]]],
};
const only = window._close ?? Object.keys(SHOTS);
const W = 360, H = 360;
const out = {};
for (const theme of only) {
  const kit = kits.find((k) => (k.model ?? '').includes(`/${theme}_`) || (k.model ?? '').includes(`/${theme}.`));
  if (!kit) continue;
  const shots = SHOTS[theme];
  const c = document.createElement('canvas');
  c.width = W * shots.length;
  c.height = H + 24;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < shots.length; i++) {
    const [label, bone, yaw, cam, look] = shots[i];
    pv.figure.atEase = true;
    pv.shown = undefined;
    pv.show(`models/heroes/${theme}_v4.glb`, kit);
    const t1 = performance.now();
    while (!pv.figure.loaded && performance.now() - t1 < 30000) await sleep(30);
    for (let k = 0; k < 120; k++) {
      pv.figure.group.rotation.y = yaw;
      pv.figure.follow(1 / 60, new V(), 0, {});
    }
    const root = pv.figure.shown;
    root.position.x = 0;
    root.position.z = 0;
    root.updateMatrixWorld(true);
    const b = root.getObjectByName(bone)?.getWorldPosition(new V()) ?? new V(0, 1, 0);
    pv.camera.position.set(b.x + cam[0], b.y + cam[1], b.z + cam[2]);
    pv.camera.lookAt(b.x + look[0], b.y + look[1], b.z + look[2]);
    pv.renderer.setSize(W * 2, H * 2, false);
    pv.camera.aspect = W / H;
    pv.camera.updateProjectionMatrix();
    pv.renderer.render(pv.scene, pv.camera);
    g.drawImage(pv.canvas, i * W, 24, W, H);
    g.fillStyle = '#fc8';
    g.font = 'bold 14px sans-serif';
    g.fillText(`${kit.name}: ${label}`, i * W + 6, 17);
  }
  out[theme] = c.toDataURL('image/jpeg', 0.9);
}
return out;
