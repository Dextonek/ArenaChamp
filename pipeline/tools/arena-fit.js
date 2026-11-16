// The model review (docs/models/review/arenas.md): each arena of the heroes' style (src/arenas/real/<id>.json and
// public/models/arenas/<id>.glb) laid against its cover: how far each prop's mesh reaches past its obstacle's capsule, measured
// vertex by vertex (`over`; `overLow` below 2.2 m, where a hero is): a hero's centre is kept 0.5 m off the capsule (`pushOut`), so past
// about 0.5 m a hero stands in the mesh. The rooms' fixed walls have no mesh of their own (the backdrop draws them) and are skipped.
// A top-down picture of each prop more than 0.3 m past its cover (fit-<arena>-<i>). pipeline/tools/arena-check.mjs checks the layout.
//   python -I pipeline/tools/page-shots.py pipeline/tools/arena-fit.js <out folder> --port 5195 --json fit.json
const { realProps } = await import('/src/arenas/real.ts');
const out = { rows: {} };
const segD = (px, pz, o) => { const dx = o.bx - o.ax, dz = o.bz - o.az, L = dx * dx + dz * dz || 1e-9; let t = ((px - o.ax) * dx + (pz - o.az) * dz) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - o.ax - t * dx, pz - o.az - t * dz) - o.r; };
for (const id of window._arenas ?? ['harbour', 'battlefield', 'canyon', 'cavern', 'sunburst', 'sunhall', 'twinforge']) {
  const lay = await (await fetch(`/src/arenas/real/${id}.json`)).json();
  const obs = lay.obstacles;
  const p = await realProps(id, obs.length);
  const rows = [];
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i], c = p.cover[i];
    if (!c) continue;
    c.updateMatrixWorld(true);
    const pts = [];
    const v = c.position.clone();
    c.traverse((m) => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let k = 0; k < P.count; k += 2) { v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); if (v.y > 0.05) pts.push([v.x, v.z, v.y]); } });
    let over = -1e9, at = null;
    let atY = 0, overLow = -1e9;
    for (const [x, z, y] of pts) { const d = segD(x, z, o); if (d > over) { over = d; at = [x, z]; atY = y; } if (y < 2.2 && d > overLow) overLow = d; }
    // air: points round the capsule's edge, each as far as the nearest part of the mesh (in the ground plane)
    let air = 0;
    const L = Math.hypot(o.bx - o.ax, o.bz - o.az), ux = L ? (o.bx - o.ax) / L : 1, uz = L ? (o.bz - o.az) / L : 0;
    const ring = [];
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; for (const [cx, cz] of [[o.ax, o.az], [o.bx, o.bz]]) { const x = cx + Math.cos(a) * o.r, z = cz + Math.sin(a) * o.r; if (segD(x, z, o) > -1e-3) ring.push([x, z]); } }
    for (let t = 0; t <= 1; t += 0.1) for (const s of [1, -1]) ring.push([o.ax + (o.bx - o.ax) * t - uz * o.r * s, o.az + (o.bz - o.az) * t + ux * o.r * s]);
    for (const [x, z] of ring) { let best = 1e9; for (const [px, pz] of pts) { const d = Math.hypot(px - x, pz - z); if (d < best) best = d; } if (best > air) air = best; }
    const r2 = (x) => +x.toFixed(2);
    const row = { i, kind: o.kind, fixed: !!o.fixed, over: r2(over), atY: r2(atY), overLow: r2(overLow), at: at && at.map(r2) };
    rows.push(row);
    if (over > 0.3) {
      // a top-down picture: the mesh's points, the capsule (red) and the hero's 0.5 m keep-off (dashed)
      const xs = pts.map((q) => q[0]).concat([o.ax - o.r - 0.6, o.bx + o.r + 0.6, o.ax + o.r + 0.6, o.bx - o.r - 0.6]);
      const zs = pts.map((q) => q[1]).concat([o.az - o.r - 0.6, o.bz + o.r + 0.6, o.az + o.r + 0.6, o.bz - o.r - 0.6]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), S = 380 / Math.max(x1 - x0, z1 - z0);
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 430; const g = cv.getContext('2d');
      g.fillStyle = '#16151b'; g.fillRect(0, 0, 400, 430);
      const X = (x) => 10 + (x - x0) * S, Z = (z) => 40 + (z - z0) * S;
      g.strokeStyle = '#2c2a33'; for (let gx = Math.ceil(x0); gx <= x1; gx++) { g.beginPath(); g.moveTo(X(gx), 40); g.lineTo(X(gx), 430); g.stroke(); } for (let gz = Math.ceil(z0); gz <= z1; gz++) { g.beginPath(); g.moveTo(0, Z(gz)); g.lineTo(400, Z(gz)); g.stroke(); }
      g.fillStyle = 'rgba(200,190,170,0.5)'; for (const [x, z] of pts) g.fillRect(X(x) - 1, Z(z) - 1, 2, 2);
      const cap = (rr, dash, col) => { g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); const n = 64; const pp = []; for (let k = 0; k <= n; k++) { const a = Math.atan2(uz, ux) + Math.PI / 2 + (k / n) * Math.PI; pp.push([o.ax + Math.cos(a) * rr, o.az + Math.sin(a) * rr]); } for (let k = 0; k <= n; k++) { const a = Math.atan2(uz, ux) - Math.PI / 2 + (k / n) * Math.PI; pp.push([o.bx + Math.cos(a) * rr, o.bz + Math.sin(a) * rr]); } pp.push(pp[0]); pp.forEach(([x, z], k) => (k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); g.setLineDash([]); };
      cap(o.r, [], '#ff5a4a'); cap(o.r + 0.5, [6, 5], '#ffb070');
      if (at) { g.fillStyle = '#7fd0ff'; g.beginPath(); g.arc(X(at[0]), Z(at[1]), 5, 0, 7); g.fill(); }
      g.fillStyle = '#fc8'; g.font = 'bold 14px sans-serif'; g.fillText(`${id} cover${i}: ${r2(over)} m past its cover, at ${r2(atY)} m up`, 8, 18);
      g.fillStyle = '#aaa'; g.font = '12px sans-serif'; g.fillText('red: the cover; dashed: where a hero\'s centre stops; blue: the farthest point; 1 m grid', 8, 34);
      out[`fit-${id}-${i}`] = cv.toDataURL('image/jpeg', 0.85);
    }
  }
  out.rows[id] = rows;
}
return out;
