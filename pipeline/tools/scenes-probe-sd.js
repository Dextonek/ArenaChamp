// The scenes' overlap probe for the Sands (floors 21 to 30) and the Deep (31 to 40): src/tower/world/scenes/sands.ts, deep.ts.
// A body for world-shots.py (python -I pipeline/tools/world-shots.py pipeline/tools/scenes-probe-sd.js --page /game --port 5246):
// set `window.__probeFloors` first to probe other floors. Builds each floor's zone (no fight), reads every scene's parts from
// `group.userData.depth.scenes` (Sands) or the Deep depth group's `userData.scenes`, and checks each part against the floor's own data,
// not the planner's: the floor's spots (keep.ts floorKeep: 3 m from the part's edge), the roads' middles (2 m), the cover (the floor's
// `cover`, no overlap), the places' courts and stands (3 m from a stand), the walkable outline (inside, or well past it for the
// scenes meant to stand in the background) and knee height (a part taller than 0.56 m stands right beside cover or past the outline).
// Echoes (`echo: true`, single props dropped between the scenes) are checked like any part but not counted as scenes or in the views.
// Returns per floor: the scene count, the kinds, the build time of the scenes and the hits (should be none).
// The views probe (2026-11-14, the refinement): the game's camera (heroMode.ts: offset (0, 15, 10.5) times the zoom 1.25, looking at the
// hero's feet 1.5 m north and 0.5 m up, a vertical field of 50 degrees, a 16:9 screen) put with the hero at a point every 8 m along every
// road and on an 8 m grid over the walkable ground; a view counts when a scene's main piece (`main`, else its first part) is in frame.
// `roadViews`, `allViews`: the shares of those views that show at least one scene; `perView`: scenes in frame per view on average;
// `roadInner`, `allInner`: the same with only the screen's inner 80% counted (a scene at the very edge of the screen, 40 m off at the
// top corners, is in frame but not seen at a glance).
const floors = window.__probeFloors ?? [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
const F = await import('/src/tower/world/floors/index.ts');
const K = await import('/src/tower/world/keep.ts');
const { rimAt } = await import('/src/tower/world/land.ts');
const RING = { x: 0, z: 7 };
const segDist = (px, pz, ax, az, bx, bz) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};
const out = [];
for (const n of floors) {
  const def = F.FLOORS[n];
  if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
  const t0 = performance.now();
  const z = def.arena.build();
  const buildMs = Math.round(performance.now() - t0);
  let scenes = null, look = null, ms = null;
  if (z.group.userData.depth?.look) { scenes = z.group.userData.depth.scenes; look = z.group.userData.depth.look; ms = z.group.userData.depth.scenesMs; }
  z.group.traverse((o) => { if (o.userData?.scenes && o.userData?.sceneLook) { scenes = o.userData.scenes; look = o.userData.sceneLook; ms = o.userData.scenesMs; } });
  z.dispose();
  if (!scenes || !look) { out.push({ floor: n, error: 'no scenes found' }); continue; }
  const keep = K.floorKeep(def);
  const roads = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
  const stands = Object.values(def.places).map((p) => p.stand);
  const beyond = (x, zz) => Math.hypot(x - RING.x, zz - RING.z) - rimAt(look.rim, Math.atan2(zz - RING.z, x - RING.x));
  const coverClear = (x, zz) => { let m = 1e9; for (const c of def.cover) m = Math.min(m, segDist(x, zz, c.ax, c.az, c.bx, c.bz) - c.r); return m; };
  const hits = [];
  const kinds = {}, where = {};
  let parts = 0, echoes = 0;
  scenes.forEach((sc, si) => {
    if (sc.echo) echoes++; // a single prop between the scenes: checked like the scenes' parts, not counted as a scene
    else { kinds[sc.kind] = (kinds[sc.kind] ?? 0) + 1; where[sc.where] = (where[sc.where] ?? 0) + 1; }
    for (const it of sc.items) {
      parts++;
      const tag = `${si}:${sc.kind}@${it.x},${it.z} r${it.r} h${it.h}`;
      for (const k of keep) { const d = Math.hypot(it.x - k.x, it.z - k.z) - it.r; if (d < 3) hits.push(`${tag} keep ${d.toFixed(2)} m`); }
      for (const s of stands) { const d = Math.hypot(it.x - s.x, it.z - s.z) - it.r; if (d < 3) hits.push(`${tag} stand ${d.toFixed(2)} m`); }
      for (const p of look.places) { const d = Math.hypot(it.x - p.x, it.z - p.z) - it.r - p.r; if (d < 0) hits.push(`${tag} court ${p.id} ${d.toFixed(2)} m`); }
      for (const [ax, az, bx, bz] of roads) { const d = segDist(it.x, it.z, ax, az, bx, bz) - it.r; if (d < 2) { hits.push(`${tag} road middle ${d.toFixed(2)} m`); break; } }
      const cc = coverClear(it.x, it.z), b = beyond(it.x, it.z);
      if (it.far) {
        if (b - it.r < 3) hits.push(`${tag} far scene inside or at the outline (${(b - it.r).toFixed(2)} m past)`);
      } else {
        if (b + it.r > -0.8) hits.push(`${tag} outside or on the outline (${(b + it.r).toFixed(2)} m)`);
        if (cc - it.r < 0) hits.push(`${tag} on cover ${(cc - it.r).toFixed(2)} m`);
        if (it.h > 0.56 && cc - it.r > 1.2) hits.push(`${tag} taller than the knee, ${(cc - it.r).toFixed(2)} m from cover`);
      }
    }
  });
  // --- the views
  const Z = 1.25, cam = { y: 15 * Z, dz: 10.5 * Z }, tv = Math.tan((50 / 2) * Math.PI / 180), th = tv * 16 / 9;
  const fy = 0.5 - cam.y, fz = -1.5 - cam.dz, fl = Math.hypot(fy, fz), FW = [0, fy / fl, fz / fl], U = [0, -FW[2], FW[1]]; // up: perpendicular to forward in the y-z plane
  if (U[1] < 0) { U[1] = -U[1]; U[2] = -U[2]; }
  const mains = scenes.filter((sc) => !sc.echo).map((sc) => sc.main ?? sc.items[0]);
  const seen = (hx, hz, f = 1) => {
    let k = 0;
    for (const m of mains) {
      const dx = m.x - hx, dy = 0.3 - cam.y, dz = m.z - (hz + cam.dz);
      const cz = dy * FW[1] + dz * FW[2], cy = dy * U[1] + dz * U[2];
      if (cz > 0 && Math.abs(dx / cz) < th * f && Math.abs(cy / cz) < tv * f) k++;
    }
    return k;
  };
  const walk = (x, zz) => beyond(x, zz) < -1 && coverClear(x, zz) > 0.3;
  let roadN = 0, roadHit = 0, allN = 0, allHit = 0, sum = 0, roadIn = 0, allIn = 0;
  for (const [ax, az, bx, bz] of roads) {
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < len; d += 8) { const x = ax + ((bx - ax) * d) / len, zz = az + ((bz - az) * d) / len; if (!walk(x, zz)) continue; roadN++; if (seen(x, zz)) roadHit++; if (seen(x, zz, 0.8)) roadIn++; }
  }
  const rmax = Math.max(...look.rim);
  for (let x = RING.x - rmax; x <= RING.x + rmax; x += 8) for (let zz = RING.z - rmax; zz <= RING.z + rmax; zz += 8) {
    if (!walk(x, zz)) continue;
    allN++; const k = seen(x, zz); sum += k; if (k) allHit++; if (seen(x, zz, 0.8)) allIn++;
  }
  const views = { roadViews: +(roadHit / Math.max(1, roadN)).toFixed(3), allViews: +(allHit / Math.max(1, allN)).toFixed(3), perView: +(sum / Math.max(1, allN)).toFixed(2), roadInner: +(roadIn / Math.max(1, roadN)).toFixed(3), allInner: +(allIn / Math.max(1, allN)).toFixed(3), roadN, allN };
  out.push({ floor: n, scenes: scenes.length - echoes, echoes, parts, kinds, where, scenesMs: ms, zoneBuildMs: buildMs, views, hits: hits.length, list: hits.slice(0, 12) });
}
const total = out.reduce((s, r) => s + (r.hits ?? 0), 0);
if (window.__probeBrief) return { totalHits: total, floors: out.map((r) => ({ floor: r.floor, scenes: r.scenes, echoes: r.echoes, views: r.views, hits: r.hits, list: r.list, scenesMs: r.scenesMs, where: r.where, kinds: r.kinds })) };
return { totalHits: total, floors: out };
