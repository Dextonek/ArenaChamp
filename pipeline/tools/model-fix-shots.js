// Before and after pictures of the Blender round of the model review (docs/models/review/blender-list.md; page
// docs/heroes/review/blender.html): the Tide Judge standing and walking with his glaive (the game's own figure in the hero
// stand's light), and the harbour's cannon in the arena as the game draws it, from the duel camera and low at the wall,
// with a hero standing where the game stops one at its back end. Run once before a rebuild and once after:
//   python pipeline/tools/page-shots.py pipeline/tools/model-fix-shots.js <out> --page "/game?arena=harbour" --port 5197
const t00 = performance.now();
while (!(window.game && game.api) && performance.now() - t00 < 120000) await new Promise((r) => setTimeout(r, 200));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

// 1. the Tide Judge: front three-quarter, his right side, from behind his right shoulder; standing, then walking
{
  const { HeroPreview } = await import('/src/game/heroPreview.ts');
  const pv = (window._v4pv ??= new HeroPreview());
  const fig = pv.figure, V = pv.at.constructor;
  const url = 'models/tower/sea_judge_v4.glb';
  fig.atEase = false;
  pv.shown = undefined;
  pv.show(url);
  const t0 = performance.now();
  while (!fig.loaded && performance.now() - t0 < 30000) await sleep(30);
  const W = 300, H = 420, views = [['front', 0.6], ['right side', -1.57], ['behind right', -2.4]];
  const c = document.createElement('canvas');
  c.width = W * views.length * 2;
  c.height = H + 22;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  [['standing', 0], ['walking', 1.6]].forEach(([what, speed], wi) => {
    fig.stand();
    fig.setModel(url, pv.at);
    const p = new V();
    for (let i = 0; i < 90; i++) { p.z += speed / 60; fig.group.rotation.y = 0; fig.follow(1 / 60, p, 0, {}); }
    const base = fig.real.root.getWorldPosition(new V());
    views.forEach(([label, yaw], k) => {
      pv.camera.position.set(base.x + Math.sin(yaw) * 5.6, base.y + 1.6, base.z + Math.cos(yaw) * 5.6);
      pv.camera.lookAt(base.x, base.y + 1.25, base.z);
      pv.renderer.setSize(W * 2, H * 2, false);
      pv.camera.aspect = W / H;
      pv.camera.updateProjectionMatrix();
      pv.renderer.render(pv.scene, pv.camera);
      const x = (wi * views.length + k) * W;
      g.drawImage(pv.canvas, x, 22, W, H);
      g.fillStyle = '#fc8';
      g.font = '13px sans-serif';
      g.fillText(`${what}, ${label}`, x + 4, 15);
    });
  });
  fig.stand();
  out.judge = c.toDataURL('image/jpeg', 0.86);
}

// 2. the harbour's cannon (cover 5: the wall from (7.3, 7.5) to (9.0, 8.4)) in a CPU duel's arena, the hero set at its back end
{
  game.cpu.start({ hero: 'Kaia', foe: 'Sefu', level: 3 });
  const api = game.api, d = api.duel;
  while (!(d.on && d.heroRt && d.foe && !d.waiting && d.countdown < 0) && performance.now() - t00 < 150000) await sleep(200);
  await sleep(1500);
  api.view.paused = true;
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  const cam = d.host.arena.camera, gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
  // the hero where the game stops it: 0.5 m off the wall's capsule (r 0.4), past its end at a, toward the fight
  const grp = d.host.arena.caster.group;
  const ax = 7.3, az = 7.5, bx = 9.0, bz = 8.4, L = Math.hypot(bx - ax, bz - az), ux = (ax - bx) / L, uz = (az - bz) / L;
  const hx = ax + ux * 0.2 - uz * 0.95, hz = az + uz * 0.2 + ux * 0.95;
  const views = [['the game camera', [hx, 15, hz + 10.5], [hx, 0.6, hz]], ['low, along the wall', [ax + ux * 4.2 - uz * 2.4, 1.6, az + uz * 4.2 + ux * 2.4], [ax + 0.5, 0.8, az + 0.2]], ['across, from the sea side', [ax + 1.0 + uz * 4.5, 2.4, az - ux * 4.5], [ax + 0.7, 0.8, az + 0.3]]];
  const W = 420, H = 300, c = document.createElement('canvas');
  c.width = W * views.length;
  c.height = H + 22;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  views.forEach(([label, from, at], k) => {
    grp.position.set(hx, grp.position.y, hz);
    d.host.heroMode.figure?.follow(0, grp.position, Math.atan2(-ux, -uz), {});
    cam.position.set(...from);
    cam.lookAt(...at);
    cam.updateMatrixWorld();
    api.render();
    const sw = gl.width, sh = gl.height, ar = W / H;
    let cw = sw, ch = sw / ar;
    if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, k * W, 22, W, H);
    g.fillStyle = '#fc8';
    g.font = '13px sans-serif';
    g.fillText(`harbour cannon: ${label}`, k * W + 4, 15);
  });
  cam.position.copy(keep.p);
  cam.quaternion.copy(keep.q);
  out.cannon = c.toDataURL('image/jpeg', 0.86);
}
return out;
