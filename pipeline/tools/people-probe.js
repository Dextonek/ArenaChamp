// Run on the game page:  MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py pipeline/tools/people-probe.js --page /game --port 5195 --out <folder>
// (`window._plan = [42, 43];` on a line before the file's text for other floors). Saves p<floor>-<id>-game and -close; returns the numbers.
// The model review: the Climb's people in their floors. For each floor of `window._plan` (default the chapters' first two), every
// person: a shot from the game's camera with the hero 6 m in front of them, a close one from in front at eye height, and numbers:
// the lowest vertex of the feet and of everything else (a staff's foot, a hem), its top, and what the person faces.
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const PLAN = window._plan ?? [1, 2, 11, 12, 21, 22, 31, 32, 41, 42];
const res = [];
const FOOTB = /foot|ball|toe/i;
const low = (root) => {
  root.updateMatrixWorld(true);
  let lo = 1e9, foot = 1e9, top = -1e9;
  const v = root.position.clone();
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
for (const n of PLAN) {
  await _world({ floor: n, hero: 'Sefu' });
  _world.packs(false);
  const g = _world.game(), z = g.zone, api = window.game?.api;
  const cam = api.heroMode.host?.camera ?? api.camera;
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 2500));
  for (const p of g.floor.people) {
    const f = z.people.figs.get(p.id);
    if (!f) continue;
    _world.go(p.at.x + Math.sin(p.face) * 6, p.at.z + Math.cos(p.face) * 6);
    for (let i = 0; i < 4 && !f.fig.loaded; i++) await new Promise((r) => setTimeout(r, 1000));
    _world.step(1.2);
    for (const d of document.querySelectorAll('body > div')) if (/Choose a side|Two banners|Take:/.test(d.textContent ?? '')) d.style.display = 'none';
    api.heroMode.setZoom(0.55);
    _world.step(0.05);
    await __shot(`p${n}-${p.id}-game`);
    const m = low(f.fig.group);
    const h = Math.max(2.2, m.top);
    cam.position.set(p.at.x + Math.sin(p.face) * 3.6 * h / 2.3 + Math.cos(p.face) * 1.2, h * 0.62, p.at.z + Math.cos(p.face) * 3.6 * h / 2.3 - Math.sin(p.face) * 1.2);
    cam.lookAt(p.at.x, h * 0.5, p.at.z);
    cam.updateMatrixWorld();
    api.render();
    await __shot(`p${n}-${p.id}-close`);
    res.push({ n, id: p.id, role: p.role, fig: p.figure ?? p.hero, ...m, yaw: +f.yaw.toFixed(2), face: +p.face.toFixed(2) });
  }
  _world.end();
}
return res;
