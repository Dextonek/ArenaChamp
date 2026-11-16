// One sheet per hero for the heroes' model review (docs/heroes/review/): the game's own figure (HeroFigure, as in a fight)
// through every clip it plays, each at its telling moment: standing, walking, sprinting, the basic attack at its hit,
// each spell's cast at its strike (Q W E R, the cast style the game picks), a hit, a stun and the fall. Top row from the
// side and close, bottom row from the game's camera. In the hero stand's light (HeroPreview), like revamp-shots.js.
//   python pipeline/tools/page-shots.py pipeline/tools/hero-review-sheet.js <out> --page "/game?only=astral,storm" --port 5197
// Every hero named in `only` (theme names; all when left out) comes back as <theme>.jpg.
const t00 = performance.now();
while (!(window.game && game.api) && performance.now() - t00 < 120000) await new Promise((r) => setTimeout(r, 200));
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { castStyle } = await import('/src/heroFigure.ts');
const pv = (window._v4pv ??= new HeroPreview());
const fig = pv.figure;
const V = pv.at.constructor;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search);
const only = (q.get('only') ?? '').split(',').filter(Boolean);
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
const themeOf = (k) => /models\/heroes\/([a-z]+)_v4\.glb$/.exec(k.model ?? '')?.[1];
const list = kits.filter((k) => themeOf(k) && (!only.length || only.includes(themeOf(k))));
const out = {};
for (const k of list) {
  fig.atEase = false;
  pv.shown = undefined;
  pv.show(k.model, k);
  const t0 = performance.now();
  while (!fig.loaded && performance.now() - t0 < 30000) await sleep(30);
  const melee = !!k.melee;
  const wind = (n) => ({ n, state: (i) => ({ attack: { wind: Math.min(1, i / n), release: 0, melee } }) });
  const cols = [
    ['idle', [{ n: 120 }]],
    ['walk', [{ n: 70, walk: 1.6 }]],
    ['sprint', [{ n: 70, walk: 7.5 }]],
    ['attack', [{ n: 60 }, wind(24), { n: 2, state: () => ({ attack: { wind: -1, release: 10, melee } }) }]],
    ...k.spells.map((sp, i) => {
      const style = castStyle(sp, i, true, melee, 0.6);
      return [`${'QWER'[i]} ${style}`, [{ n: 60 }, { n: 16, before: () => fig.cast(style, 0.6, i === 3) }]];
    }),
    ['hit', [{ n: 60 }, { n: 12, before: () => fig.hit(1) }]],
    ['stun', [{ n: 50, state: () => ({ status: { stunned: true } }) }]],
    ['death', [{ n: 30 }, { n: 1, before: () => fig.fall(0.95) }]],
  ];
  const W = 170, H = 230, L = 18;
  const c = document.createElement('canvas');
  c.width = W * cols.length;
  c.height = 2 * (H + L) + 26;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fc8';
  g.font = 'bold 16px sans-serif';
  g.fillText(k.name, 8, 19);
  cols.forEach(([label, frames], ci) => {
    fig.stand();
    fig.setModel(k.model, pv.at, k);
    const p = new V();
    for (const fr of frames) for (let j = 0; j < fr.n; j++) {
      if (fr.before && j === 0) fr.before();
      if (fr.walk) p.z += fr.walk / 60;
      fig.group.rotation.y = 0;
      fig.follow(1 / 60, p, 0, fr.state ? fr.state(j) : {});
    }
    const real = fig.real;
    const base = real.root.getWorldPosition(new V());
    [[0.75, [5.4, 1.2, 0]], [0.3, [5.6, 7.0 / 5.0, 0.0]]].forEach(([yaw, [d, hk, lk]], row) => {
      // row 0: close from the side; row 1: the game's camera (7 m up, 5 m back, as in a duel)
      const look = base.clone().setY(base.y + (row ? 1.0 : 1.2));
      if (row) pv.camera.position.set(base.x + Math.sin(yaw) * 5.0, base.y + 7.0, base.z + Math.cos(yaw) * 5.0);
      else pv.camera.position.set(base.x + Math.sin(yaw) * d, base.y + 1.5, base.z + Math.cos(yaw) * d);
      pv.camera.lookAt(look);
      pv.camera.fov = row ? 24 : 30;
      pv.renderer.setSize(W * 2, H * 2, false);
      pv.camera.aspect = W / H;
      pv.camera.updateProjectionMatrix();
      pv.renderer.render(pv.scene, pv.camera);
      const y = 26 + row * (H + L);
      g.drawImage(pv.canvas, ci * W, y + L, W, H);
      g.fillStyle = '#fc8';
      g.font = '12px sans-serif';
      if (!row) g.fillText(label, ci * W + 4, y + 13);
    });
  });
  fig.stand();
  out[themeOf(k)] = c.toDataURL('image/jpeg', 0.85);
}
pv.camera.fov = 30;
pv.camera.updateProjectionMatrix();
return out;
