// The model review, round 2 (docs/models/review/round2/): does the drawn ground of a Climb floor lie where the game stands its hero?
// On each floor of `window._plan` the real hero (window._hero, default Sefu) is put at every place, person and pack home of the floor, and
// a little off each toward the floor's middle and away from it; at each spot: the hero's own height (the game's), the drawn ground under it
// (a ray down through the floor's meshes: the land, paths and plazas; props, figures and water left out) and the hero's lowest sole.
// On the game page:
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py pipeline/tools/ground-probe.js --page /game --port 5179 --out <folder>
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const PLAN = window._plan ?? [1, 11, 21, 31, 41];
const FOOTB = /foot|ball|toe/i;
const r2 = (x) => +x.toFixed(2);
const out = [];
for (const n of PLAN) {
  await _world({ floor: n, hero: window._hero ?? 'Sefu' });
  _world.packs(false);
  const g = _world.game(), z = g.zone, api = window.game?.api;
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 2000));
  const caster = api.arena.caster;
  let root = caster.group;
  while (root.parent) root = root.parent;
  const V = caster.group.position.constructor;
  // the ground: big meshes that are flat-ish (more wide than tall) and not part of a figure
  const ground = [];
  root.traverse((m) => {
    if (!m.isMesh || m.isSkinnedMesh || !m.visible) return;
    for (let q = m; q; q = q.parent) if (!q.visible) return;
    const P = m.geometry.attributes.position;
    if (!P || P.count < 200) return;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), h = bb.max.y - bb.min.y;
    if (w < 8 || h > w * 0.6) return;
    ground.push({ m, bb });
  });
  const a = new V(), b = new V(), c = new V();
  const below = (x, zz) => {
    let best = -1e9;
    for (const { m, bb } of ground) {
      if (x < bb.min.x || x > bb.max.x || zz < bb.min.z || zz > bb.max.z) continue;
      const P = m.geometry.attributes.position, I = m.geometry.index, tri = I ? I.count / 3 : P.count / 3;
      for (let t = 0; t < tri; t++) {
        const i0 = I ? I.getX(3 * t) : 3 * t, i1 = I ? I.getX(3 * t + 1) : 3 * t + 1, i2 = I ? I.getX(3 * t + 2) : 3 * t + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(P, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(m.matrixWorld);
        if (Math.max(a.x, b.x, c.x) < x || Math.min(a.x, b.x, c.x) > x || Math.max(a.z, b.z, c.z) < zz || Math.min(a.z, b.z, c.z) > zz) continue;
        const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (zz - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (zz - c.z)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * a.y + l2 * b.y + l3 * c.y;
        if (y < 4 && y > best) best = y;
      }
    }
    return best;
  };
  const sole = () => {
    const fig = api.heroMode.figure?.group ?? caster.group;
    fig.updateMatrixWorld(true);
    let lo = 1e9;
    const v = new V();
    fig.traverse((m) => {
      if (!m.isSkinnedMesh || !m.visible) return;
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
      for (let i = 0; i < m.geometry.attributes.position.count; i += 3) {
        let fw = 0; for (let k = 0; k < 4; k++) if (FOOTB.test(bones[si.getComponent(i, k)]?.name ?? '')) fw += sw.getComponent(i, k);
        if (fw < 0.5) continue;
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); lo = Math.min(lo, v.y);
      }
    });
    return lo;
  };
  // the spots: places, people, pack homes; and 3 m off each, toward the middle and away
  const spots = [];
  const places = g.floor.places ?? {};
  for (const [id, p] of Object.entries(places)) if (p?.stand) spots.push([id, p.stand.x, p.stand.z]);
  for (const p of g.floor.people ?? []) spots.push([`person ${p.id}`, p.at.x + Math.sin(p.face) * 2, p.at.z + Math.cos(p.face) * 2]);
  for (const p of z.packs.values()) if (p.home) spots.push([`pack ${p.id}`, p.home.x, p.home.z]);
  const mid = spots.reduce((s, q) => [s[0] + q[1] / spots.length, s[1] + q[2] / spots.length], [0, 0]);
  const more = [];
  for (const [id, x, zz] of spots) {
    const dx = x - mid[0], dz = zz - mid[1], L = Math.hypot(dx, dz) || 1;
    more.push([`${id} +3 out`, x + (dx / L) * 3, zz + (dz / L) * 3]);
  }
  const rows = [];
  for (const [id, x, zz] of [...spots, ...more]) {
    _world.go(x, zz);
    _world.step(0.35);
    const p = caster.group.position, gy = below(p.x, p.z);
    rows.push({ id, at: [r2(p.x), r2(p.z)], heroY: r2(p.y), ground: gy < -1e8 ? null : r2(gy), sole: r2(sole()), soleOverGround: gy < -1e8 ? null : r2(sole() - gy) });
  }
  const ok = rows.filter((r) => r.ground !== null);
  const off = ok.map((r) => r.soleOverGround).sort((x, y) => x - y);
  out.push({ floor: n, groundMeshes: ground.length, spots: rows.length, withGround: ok.length, heroY: [Math.min(...rows.map((r) => r.heroY)), Math.max(...rows.map((r) => r.heroY))], groundY: ok.length ? [Math.min(...ok.map((r) => r.ground)), Math.max(...ok.map((r) => r.ground))] : null, soleOverGround: off.length ? { min: off[0], median: off[Math.floor(off.length / 2)], max: off[off.length - 1] } : null, raised: ok.filter((r) => Math.abs(r.ground - r.heroY) > 0.05) });
  // the first spot where the drawn ground stands off the hero's height, from the game's camera and close from the side
  const up = ok.find((r) => Math.abs(r.ground - r.heroY) > 0.05);
  if (up) {
    _world.go(up.at[0], up.at[1]);
    _world.step(0.4);
    const hide = document.createElement('style');
    hide.textContent = 'body > *:not(#app){display:none!important}';
    document.head.append(hide);
    await __shot(`ground-f${n}-game`);
    const cam = api.heroMode.host.camera;
    cam.position.set(up.at[0] + 4, 1.6, up.at[1] + 4);
    cam.lookAt(up.at[0], 0.6, up.at[1]);
    cam.updateMatrixWorld();
    api.render();
    await __shot(`ground-f${n}-side`);
    hide.remove();
  }
  _world.end();
}
return out;
