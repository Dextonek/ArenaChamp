// Close pictures for the heroes' model review (docs/heroes/review/), run once on the code before and once after
// (two dev servers), so the page can show each fix side by side: the feet on the stand's floor, a hand by a coat or a
// robe, a staff at a cast's strike. The game's own figure in the hero stand's light (HeroPreview), as hero-review-sheet.js.
//   python pipeline/tools/page-shots.py pipeline/tools/hero-review-close.js <out> --page /game --port 5197
// Returns one picture per [kind, theme] in SHOTS below: <kind>_<theme>.jpg.
const t00 = performance.now();
while (!(window.game && game.api) && performance.now() - t00 < 120000) await new Promise((r) => setTimeout(r, 200));
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { castStyle } = await import('/src/heroFigure.ts');
const pv = (window._v4pv ??= new HeroPreview());
const fig = pv.figure, V = pv.at.constructor;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
// [kind, theme, what the hero does, camera yaw round it, camera distance, look-at height, camera height]
const SHOTS = [
  ['feet', 'mole', 'idle', 1.4, 1.5, 0.12, 0.2], ['feet', 'sumo', 'idle', 1.4, 1.5, 0.12, 0.2], ['feet', 'balloon', 'idle', 1.4, 1.5, 0.12, 0.2],
  ['feet', 'storm', 'idle', 1.4, 1.5, 0.12, 0.2],
  ['coat', 'storm', 'idle', -0.9, 2.2, 1.0, 1.25], ['coat', 'magic', 'idle', -0.6, 2.2, 1.0, 1.25], ['coat', 'ink', 'idle', -0.9, 2.2, 1.0, 1.25],
  ['coat', 'mole', 'idle', -0.6, 2.4, 0.9, 1.2],
  ['staff', 'bone', 'cast', 0.5, 4.6, 1.3, 1.6], ['staff', 'door', 'cast', 0.5, 4.2, 1.3, 1.6], ['staff', 'bard', 'cast', 0.5, 4.2, 1.3, 1.6],
  ['staff', 'storm', 'cast', 0.5, 4.6, 1.3, 1.6], ['staff', 'janitor', 'attack', 0.5, 4.6, 1.3, 1.6], ['staff', 'blood', 'cast', 0.5, 4.2, 1.3, 1.6],
];
const out = {};
for (const [kind, theme, what, yaw, dist, lookY, camY] of SHOTS) {
  const k = kits.find((x) => (x.model ?? '').includes(`/${theme}_v4`));
  if (!k) continue;
  fig.atEase = false;
  pv.shown = undefined;
  pv.show(k.model, k);
  const t0 = performance.now();
  while (!fig.loaded && performance.now() - t0 < 30000) await sleep(30);
  fig.stand();
  fig.setModel(k.model, pv.at, k);
  const melee = !!k.melee, p = new V();
  const frames = what === 'cast' ? [{ n: 60 }, { n: 16, before: () => fig.cast(castStyle(k.spells[0], 0, true, melee, 0.6), 0.6, false) }]
    : what === 'attack' ? [{ n: 60 }, { n: 24, state: (i) => ({ attack: { wind: i / 24, release: 0, melee } }) }, { n: 2, state: () => ({ attack: { wind: -1, release: 10, melee } }) }]
    : [{ n: 120 }];
  for (const fr of frames) for (let j = 0; j < fr.n; j++) {
    if (fr.before && j === 0) fr.before();
    fig.group.rotation.y = 0;
    fig.follow(1 / 60, p, 0, fr.state ? fr.state(j) : {});
  }
  const W = 420, H = kind === 'staff' ? 520 : 420;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  pv.camera.position.set(Math.sin(yaw) * dist, camY, Math.cos(yaw) * dist);
  pv.camera.lookAt(0, lookY, 0);
  pv.renderer.setSize(W * 2, H * 2, false);
  pv.camera.aspect = W / H;
  pv.camera.updateProjectionMatrix();
  pv.renderer.render(pv.scene, pv.camera);
  c.getContext('2d').drawImage(pv.canvas, 0, 0, W, H);
  out[`${kind}_${theme}`] = c.toDataURL('image/jpeg', 0.88);
}
fig.stand();
return out;
