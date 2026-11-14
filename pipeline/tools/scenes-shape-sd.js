// The scenes' shape check for the Sands and the Deep (src/tower/world/scenes/sands.ts, deep.ts): the overlap probe trusts each part's
// declared footprint (a circle and a height); this measures the parts themselves. For every kind, every way of being (open ground and
// against a rock) and many draws of its random choices, every vertex of every part is put in the scene's frame and checked: inside one
// of the scene's footprint circles (2 cm slack), and no higher than the knee (0.56 m) unless a circle it stands in is declared as tall.
// The footprint is the one the planner uses: the declared circles and those `autoCover` adds round the parts that reach past them.
// `openTall`: the highest point of any part of a scene on open ground (no rock behind it), which must stay under the knee.
// A body for world-shots.py: python -I pipeline/tools/world-shots.py pipeline/tools/scenes-shape-sd.js --page /game --port 5246
// Returns per chapter and kind: the draws checked, the vertices outside every circle (and how far out at most) and the vertices taller
// than declared (and by how much at most). Both should be 0. The background scenes (`far`) are not checked: they stand past the edge.
const KNEE = 0.56;
const mods = { sands: await import('/src/tower/world/scenes/sands.ts'), deep: await import('/src/tower/world/scenes/deep.ts') };
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const out = {};
for (const [chapter, m] of Object.entries(mods)) {
  const { KINDS, ECHOES, Recipe, autoCover, shapes } = m.__shapes;
  const P = shapes();
  const res = {};
  const check = (name, make, backed) => {
    const r = (res[name] ??= { draws: 0, verts: 0, outside: 0, outsideBy: 0, tall: 0, tallBy: 0, openTall: 0, where: '' });
    for (let d = 0; d < 40; d++) {
      const rc = new Recipe();
      make(rc, P, rnd, { backed, far: false });
      autoCover(rc); // the footprint as the planner sees it
      r.draws++;
      for (const op of rc.ops) {
        const cy = Math.cos(op.yaw), sy = Math.sin(op.yaw), cx = Math.cos(op.tilt), sx = Math.sin(op.tilt), cz = Math.cos(op.roll), sz = Math.sin(op.roll);
        // three.js Euler 'YXZ': R = Ry * Rx * Rz
        const R = [
          cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
          cx * sz, cx * cz, -sx,
          -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
        ];
        const parts = op.p.pos ? [op.p] : Object.values(op.p);
        for (const p of parts) {
          const A = p.pos;
          for (let i = 0; i < A.length; i += 3) {
            const vx = A[i] * op.sx, vy = A[i + 1] * op.sy, vz = A[i + 2] * op.sz;
            const x = op.x + R[0] * vx + R[1] * vy + R[2] * vz, y = op.y + R[3] * vx + R[4] * vy + R[5] * vz, z = op.z + R[6] * vx + R[7] * vy + R[8] * vz;
            r.verts++;
            if (!backed && y > r.openTall) r.openTall = +y.toFixed(2);
            let inside = false, tallOk = y <= KNEE + 0.005, near = 1e9;
            for (const it of rc.items) {
              const dd = Math.hypot(x - it.x, z - it.z) - it.r;
              near = Math.min(near, dd);
              if (dd <= 0.02) { inside = true; if (it.h >= y - 0.02) tallOk = true; }
            }
            if (!inside) { r.outside++; if (near > r.outsideBy) { r.outsideBy = +near.toFixed(2); r.where = `${backed ? 'backed' : 'open'} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`; } }
            if (!tallOk) { r.tall++; const e = y - KNEE; if (e > r.tallBy) { r.tallBy = +e.toFixed(2); r.where = `${backed ? 'backed' : 'open'} tall (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`; } }
          }
        }
      }
    }
  };
  for (const [k, make] of Object.entries(KINDS)) {
    if (k === 'ribs' || k === 'wreck') continue; // past the edge only
    check(k, make, false);
    check(k, make, true);
  }
  for (const [k, make] of Object.entries(ECHOES)) check(`echo:${k}`, (rc, P2, r) => make(rc, P2, r), false);
  // a kind meant for open ground (its open way has no part past the knee) must stay under it; the backed-only kinds declare their height
  const bad = (v) => v.outside || v.tall;
  out[chapter] = Object.fromEntries(Object.entries(res).filter(([, v]) => bad(v)));
  out[chapter + 'Clean'] = Object.entries(res).filter(([, v]) => !bad(v)).map(([k, v]) => `${k}(${v.openTall})`).join(' ');
}
return JSON.stringify(out, null, 1);
