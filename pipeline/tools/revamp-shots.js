// Pictures of one hero of the fourth style for the revamp page (docs/heroes/revamp/): its sheet (front, three-quarter,
// back, the face), the line-up beside three others, and its motion (walking, a cast at its strike, the basic attack at
// its hit, the game's camera). Drawn by the game's own figure code in the hero stand's light (HeroPreview), as
// v4-sheet.js does. Run by pipeline/tools/revamp-shots.py, which passes `window._rv = { theme, beside: [names] }` and
// saves what this returns.
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { castStyle } = await import('/src/heroFigure.ts');
const pv = (window._v4pv ??= new HeroPreview());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V = pv.at.constructor;
const { theme, beside } = window._rv;
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
const kit = kits.find((k) => (k.model ?? '').includes(`/${theme}_`) || (k.model ?? '').includes(`/${theme}.`));
if (!kit) return { error: `no kit for ${theme}` };
const url = `models/heroes/${theme}_v4.glb`;

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, w, h);
  return [c, g];
};
const label = (g, s, x, y, w) => {
  g.fillStyle = '#fc8';
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'center';
  g.fillText(s, x + w / 2, y + 18);
  g.textAlign = 'left';
};
const load = async (u, k, ease) => {
  pv.figure.atEase = ease;
  pv.shown = undefined;
  pv.show(u, k);
  const t0 = performance.now();
  while (!pv.figure.loaded && performance.now() - t0 < 30000) await sleep(30);
};
const run = (frames, yaw) => {
  const melee = !!pv.figure.melee, pos = new V();
  for (const fr of frames) for (let k = 0; k < fr.n; k++) {
    if (fr.walk) pos.z += fr.walk / 60;
    if (fr.before && k === 0) fr.before();
    pv.figure.group.rotation.y = yaw;
    pv.figure.follow(1 / 60, pos, 0, fr.state ? fr.state(k, melee) : {});
  }
  const root = pv.figure.shown;
  root.position.x = 0;
  root.position.z = 0;
  return root;
};
const draw = (g, x, y, W, H, cam, look) => {
  pv.camera.position.set(...cam);
  pv.camera.lookAt(...look);
  pv.renderer.setSize(W * 2, H * 2, false);
  pv.camera.aspect = W / H;
  pv.camera.updateProjectionMatrix();
  pv.renderer.render(pv.scene, pv.camera);
  g.drawImage(pv.canvas, x, y, W, H);
};
const face = (g, x, y, W, H, root, side = 0.25) => {
  root.updateMatrixWorld(true);
  const head = root.getObjectByName('Head')?.getWorldPosition(new V()) ?? new V(0, 2, 0);
  draw(g, x, y, W, H, [head.x + side, head.y + 0.12, head.z + 1.3], [head.x, head.y + 0.1, head.z]);
};
const out = {};

// 1. the sheet: front, three-quarter, back, the face
{
  const W = 300, H = 420, L = 26;
  const views = [['front', 0], ['three-quarter', 0.7], ['back', Math.PI]];
  const [c, g] = canvas(W * 4, H + L);
  for (let i = 0; i < views.length; i++) {
    await load(url, kit, true);
    run([{ n: 120 }], views[i][1]);
    label(g, views[i][0], i * W, 0, W);
    draw(g, i * W, L, W, H, [0, 1.35, 6.2], [0, 1.2, 0]);
  }
  await load(url, kit, true);
  const root = run([{ n: 120 }], 0.25);
  label(g, 'face', 3 * W, 0, W);
  face(g, 3 * W, L, W, H, root);
  out.sheet = c.toDataURL('image/jpeg', 0.9);
}

// 2. the face, larger, front and three-quarter
{
  const W = 420, H = 420;
  const [c, g] = canvas(W * 2, H);
  await load(url, kit, true);
  let root = run([{ n: 120 }], 0);
  face(g, 0, 0, W, H, root, 0.0);
  await load(url, kit, true);
  root = run([{ n: 120 }], 0.6);
  face(g, W, 0, W, H, root, 0.3);
  out.face = c.toDataURL('image/jpeg', 0.9);
}

// 3. the line-up: Sefu, the hero, the second, and the hero it was most like; standing as in a fight, one camera for all;
// then the same from the game's camera, and in grey (the silhouette and value check)
{
  const W = 260, H = 380, L = 26;
  const names = [beside[0], kit.name, ...beside.slice(1)];
  const n = names.length;
  const kitOf = (i) => (i === 1 ? kit : kits.find((x) => x.name === names[i]));
  const [c, g] = canvas(W * n, H + L);
  const [c2, g2] = canvas(W * n, 300 + L);
  for (let i = 0; i < n; i++) {
    const k = kitOf(i);
    await load(i === 1 ? url : k.model, k, false);
    run([{ n: 90 }], 0.35);
    label(g, names[i], i * W, 0, W);
    draw(g, i * W, L, W, H, [0, 1.45, 6.6], [0, 1.3, 0]);
    label(g2, names[i], i * W, 0, W);
    draw(g2, i * W, L, W, 300, [0, 7.0, 5.0], [0, 1.0, 0]);
  }
  out.lineup = c.toDataURL('image/jpeg', 0.9);
  out.lineup_cam = c2.toDataURL('image/jpeg', 0.9);
  const [c3, g3] = canvas(W * n, H + L);
  g3.filter = 'grayscale(1)';
  g3.drawImage(c, 0, 0);
  out.lineup_grey = c3.toDataURL('image/jpeg', 0.9);
}

// 4. motion: walking, a cast at its strike, the basic attack at its hit, and the game's camera standing
{
  const W = 300, H = 400, L = 26;
  const spell = kit.spells[1] ?? kit.spells[0];
  const melee = !!kit.melee;
  const style = castStyle(spell, 1, true, melee, 0.6);
  const wind = { n: 24, state: (k, m) => ({ attack: { wind: k / 24, release: 0, melee: m } }) };
  const after = { n: 2, state: (k, m) => ({ attack: { wind: -1, release: 10, melee: m } }) };
  const views = [
    ['walking', 1.2, [{ n: 60 }, { n: 50, walk: 3.6 }], [0, 1.35, 6.6], [0, 1.2, 0]],
    [`casting (${style})`, 0.7, [{ n: 60 }, { n: 22, before: () => pv.figure.cast(style, 0.6) }], [0, 1.35, 6.6], [0, 1.2, 0]],
    ['attack', 0.8, [{ n: 60 }, wind, after], [0, 1.35, 6.6], [0, 1.2, 0]],
    ['game camera', 0.3, [{ n: 120 }], [0, 7.0, 5.0], [0, 1.0, 0]],
  ];
  const [c, g] = canvas(W * views.length, H + L);
  for (let i = 0; i < views.length; i++) {
    const [t, yaw, frames, cam, look] = views[i];
    await load(url, kit, false);
    run(frames, yaw);
    label(g, t, i * W, 0, W);
    draw(g, i * W, L, W, H, cam, look);
  }
  out.motion = c.toDataURL('image/jpeg', 0.9);
}
pv.camera.position.set(0, 1.55, 6.2);
pv.camera.lookAt(0, 1.2, 0);
out.hero = kit.name;
return out;
