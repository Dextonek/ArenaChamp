// The model review (docs/models/review/arenas.md): each arena of the heroes' style (src/arenas/real/<id>.json and
// public/models/arenas/<id>.glb) laid against its cover: how far each prop's mesh reaches past its obstacle's capsule (`over`: a hero
// walks into it past 0.5 m, the body's own radius) and how far the capsule reaches past the mesh (`air`: a hero stops short of it).
// The missing ones are the rooms' fixed walls, drawn by the backdrop. pipeline/tools/arena-check.mjs checks the layout; this, the meshes.
//   python -I pipeline/tools/page-shots.py pipeline/tools/arena-fit.js <out folder> --port 5195 --json fit.json
const { realProps } = await import('/src/arenas/real.ts');
const out = {};
for (const id of ['harbour', 'battlefield', 'canyon', 'cavern', 'sunburst', 'sunhall', 'twinforge']) {
  const lay = await (await fetch(`/src/arenas/real/${id}.json`)).json();
  const obs = lay.obstacles;
  const p = await realProps(id, obs.length);
  const rows = [];
  obs.forEach((o, i) => {
    const c = p.cover[i];
    if (!c) { rows.push({ i, missing: true, kind: o.kind }); return; }
    c.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
    const v = c.position.clone();
    c.traverse((m) => {
      if (!m.isMesh) return;
      const P = m.geometry.attributes.position;
      for (let k = 0; k < P.count; k += 2) { v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    });
    const ox0 = Math.min(o.ax, o.bx) - o.r, ox1 = Math.max(o.ax, o.bx) + o.r, oz0 = Math.min(o.az, o.bz) - o.r, oz1 = Math.max(o.az, o.bz) + o.r;
    const r2 = (x) => +x.toFixed(2);
    rows.push({ i, kind: o.kind, obs: [r2(ox0), r2(ox1), r2(oz0), r2(oz1)], mesh: [r2(x0), r2(x1), r2(z0), r2(z1)], y: [r2(y0), r2(y1)], h: o.height,
      // how far the mesh reaches past the obstacle (a hero walks into it) and how far the obstacle reaches past the mesh (blocked by air)
      over: r2(Math.max(ox0 - x0, x1 - ox1, oz0 - z0, z1 - oz1)), air: r2(Math.max(x0 - ox0, ox1 - x1, z0 - oz0, oz1 - z1)) });
  });
  out[id] = rows;
}
return out;
