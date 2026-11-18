// The model review, round 2 (docs/models/review/round2/): every hero on a Climb floor beside the floor's own people. On each floor of
// `window._plan` (default the chapters' first floors), beside each of its first four people, a row of ten heroes with Sefu and Kaia at
// its head (the art bible's yardstick), each stood where the game stands a hero (y 0) through the hero figure code; measured: the
// ground under each (the drawn land, found by a ray down through its triangles), the soles against it, the top. Pictures from the
// front at eye height and from the game's camera. On the game page:
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py pipeline/tools/climb-lineup.js --page /game --port 5179 --size 1600x800 --out <folder>
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const { HERO_KITS } = await import('/src/heroes.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const PLAN = window._plan ?? [1, 11, 21, 31, 41];
const NAMES = HERO_KITS.map((k) => k.name).filter((n) => n !== 'Sefu' && n !== 'Kaia');
const kitOf = (n) => HERO_KITS.find((k) => k.name === n);
const FOOTB = /foot|ball|toe/i;
const r2 = (x) => +x.toFixed(2);
const res = [];
// The lowest sole, the lowest of the rest and the top of a figure's visible skinned meshes.
const measure = (root, v) => {
  root.updateMatrixWorld(true);
  let foot = 1e9, top = -1e9;
  root.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    for (let q = m; q && q !== root; q = q.parent) if (!q.visible) return;
    const n = m.geometry.attributes.position.count, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
    for (let i = 0; i < n; i += 3) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      let fw = 0; for (let k = 0; k < 4; k++) if (FOOTB.test(bones[si.getComponent(i, k)]?.name ?? '')) fw += sw.getComponent(i, k);
      if (fw > 0.5) foot = Math.min(foot, v.y);
      top = Math.max(top, v.y);
    }
  });
  return { foot, top };
};
for (const n of PLAN) {
  await _world({ floor: n, hero: 'Sefu' });
  _world.packs(false);
  const g = _world.game(), z = g.zone, api = window.game?.api;
  const cam = api.heroMode.host?.camera;
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 2500));
  for (const d of document.querySelectorAll('body > div')) if (/Choose a side|Two banners|Take:/.test(d.textContent ?? '')) d.style.display = 'none';
  const people = g.floor.people.filter((p) => z.people.figs.get(p.id)).slice(0, 4);
  const scene = api.arena.caster.group.parent;
  const v = api.arena.caster.group.position.clone();
  const V = v.constructor;
  // The drawn ground: every mesh of the floor that is not a figure, with its triangles, for the rays down.
  const ground = [];
  scene.traverse((m) => {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || !m.visible) return;
    const P = m.geometry.attributes.position;
    if (!P || P.count < 300) return;
    m.geometry.computeBoundingBox();
    ground.push(m);
  });
  const below = (x, zz) => {
    let best = -1e9;
    const a = new V(), b = new V(), c = new V();
    for (const m of ground) {
      const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      if (x < bb.min.x || x > bb.max.x || zz < bb.min.z || zz > bb.max.z) continue;
      const P = m.geometry.attributes.position, I = m.geometry.index, tri = I ? I.count / 3 : P.count / 3;
      for (let t = 0; t < tri; t++) {
        const i0 = I ? I.getX(3 * t) : 3 * t, i1 = I ? I.getX(3 * t + 1) : 3 * t + 1, i2 = I ? I.getX(3 * t + 2) : 3 * t + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(P, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(m.matrixWorld);
        const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (zz - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (zz - c.z)) / d, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const y = l1 * a.y + l2 * b.y + l3 * c.y;
        if (y < 6 && y > best) best = y;
      }
    }
    return best;
  };
  for (const [gi, p] of people.entries()) {
    const f = z.people.figs.get(p.id);
    // a row along the person's left, ten heroes after Sefu and Kaia, 1.3 m apart, facing the way the person faces
    const lx = Math.cos(p.face), lz = -Math.sin(p.face);
    const row = ['Sefu', 'Kaia', ...NAMES.slice(gi * 10, gi * 10 + 10)].filter(Boolean);
    const figs = [];
    row.forEach((name, i) => {
      const kit = kitOf(name);
      const fig = new HeroFigure();
      fig.atEase = true;
      scene.add(fig.group);
      const pos = new V(p.at.x + lx * 1.3 * (i + 1), 0, p.at.z + lz * 1.3 * (i + 1));
      fig.setModel(kit.model, pos, kit);
      figs.push({ name, fig, pos });
    });
    for (let k = 0; k < 120 && figs.some((x) => !x.fig.loaded); k++) await new Promise((r) => setTimeout(r, 250));
    for (let k = 0; k < 40; k++) for (const x of figs) x.fig.follow(1 / 60, x.pos, p.face, {});
    _world.go(p.at.x + Math.sin(p.face) * 5 + lx * 7, p.at.z + Math.cos(p.face) * 5 + lz * 7);
    _world.step(0.05);
    for (let k = 0; k < 6; k++) for (const x of figs) x.fig.follow(1 / 60, x.pos, p.face, {});
    const pm = measure(f.fig.group, v);
    const pg = below(p.at.x, p.at.z);
    res.push({ floor: n, who: p.id, kind: 'person', ground: r2(pg), sole: r2(pm.foot - pg), height: r2(pm.top - pg) });
    for (const x of figs) {
      const m = measure(x.fig.group, v), gy = below(x.pos.x, x.pos.z);
      res.push({ floor: n, who: x.name, kind: 'hero', ground: r2(gy), sole: r2(m.foot - gy), height: r2(m.top - gy) });
    }
    // from the front at eye height, the whole row; then the game's camera over its middle
    const mx = p.at.x + lx * 1.3 * (row.length / 2), mz = p.at.z + lz * 1.3 * (row.length / 2);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    cam.position.set(mx + fx * 13, 1.6, mz + fz * 13);
    cam.lookAt(mx, 1.2, mz);
    cam.fov = 50; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    api.render();
    await __shot(`lineup-f${n}-${gi}-front`);
    api.heroMode.setZoom(1.25);
    _world.go(mx + fx * 2, mz + fz * 2);
    _world.step(0.05);
    for (const x of figs) x.fig.follow(1 / 60, x.pos, p.face, {});
    api.render();
    await __shot(`lineup-f${n}-${gi}-game`);
    for (const x of figs) x.fig.group.removeFromParent();
  }
  _world.end();
}
return res;
