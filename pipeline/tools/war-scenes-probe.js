// The War's scenes (src/tower/world/scenes/war.ts), checked on every floor of the chapter (41 to 50). Builds each floor's zone, reads
// every scene's footprint as measured from its built vertices (centre, radius, height), and checks it with this file's own maths
// against the floor's data: the floor's spots (keep.ts `floorKeep`, 3 m), the roads' middles (the paved band, 1.4 m either side of the
// line), the cover's bodies, the places' rounds, the walkable outline (inside it, or past the stake hedge for the scenes meant to stand
// beyond), the siege line's far side, the depth's own big props (as warDepth.ts recorded them), each other, and knee height (0.6 m) in
// the walkable ground. A scene leaning on a wall (a ladder) may touch its own wall only: what rises above the knee stays within 0.5 m
// of the wall's own radius (the band a hero cannot enter), and nothing of it is inside any other cover.
//
// Run it with the shots runner (it prints the JSON it returns), against a dev server:
//   python -I pipeline/tools/world-shots.py pipeline/tools/war-scenes-probe.js --page / --port <port>
const probe = async (floors = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]) => {
  const fl = await import('/src/tower/world/floors/index.ts');
  const gen = await import('/src/tower/world/floors/gen/index.ts');
  const banners = await import('/src/tower/world/floors/banners-made.ts');
  const land = await import('/src/tower/world/land.ts');
  const keepOf = (await import('/src/tower/world/keep.ts')).floorKeep;
  const C = { x: 0, z: 7 }; // the middle every outline is drawn round (RING in src/arenas/common.ts)
  const seg = (px, pz, ax, az, bx, bz) => {
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
    return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
  };
  const out = { floors: [], totalScenes: 0, totalHits: 0 };
  for (const n of floors) {
    const baked = n === 41 ? banners.BANNERS_41 : gen.GEN_FLOORS[n].baked, look = baked.look, keep = keepOf(baked.floor);
    const was = globalThis.__warScenes;
    globalThis.__warScenes = true;
    const zone = fl.FLOORS[n].arena.build();
    globalThis.__warScenes = was;
    const log = [...(globalThis.__warScenesLog ?? new Map()).values()].find((l) => l.seed === look.seed);
    zone.dispose();
    if (!log) { out.floors.push({ floor: n, error: 'no scenes were built' }); continue; }
    const beyond = (x, z) => Math.hypot(x - C.x, z - C.z) - land.rimAt(look.rim, Math.atan2(z - C.z, x - C.x));
    const roads = [];
    for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([C.x + p[i - 1][0], C.z + p[i - 1][1], C.x + p[i][0], C.z + p[i][1]]);
    const hits = [], kinds = {}, reach = {};
    log.scenes.forEach((s, i) => {
      kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
      reach[s.kind] = Math.max(reach[s.kind] ?? 0, +(s.r - s.R).toFixed(2)); // how far the built footprint passed the planned one
      const name = `${i} ${s.kind}${s.beyond ? ' (beyond)' : ''} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) r ${s.r}`;
      const hit = (what) => hits.push(`${name}: ${what}`);
      for (const k of keep) { const d = Math.hypot(s.x - k.x, s.z - k.z) - s.r; if (d < 3) hit(`keep spot (${k.x.toFixed(1)}, ${k.z.toFixed(1)}) at ${d.toFixed(2)} m`); }
      if (!s.beyond) for (const r of roads) { const d = seg(s.x, s.z, ...r) - s.r; if (d < 1.4) { hit(`road's middle at ${d.toFixed(2)} m`); break; } }
      look.pieces.forEach((p, j) => {
        const o = p.o;
        if (j === s.host) {
          if (seg(s.x, s.z, o.ax, o.az, o.bx, o.bz) < o.r) hit('its centre inside its own wall');
          return;
        }
        const d = seg(s.x, s.z, o.ax, o.az, o.bx, o.bz) - o.r;
        // a leaning scene's footprint reaches its own wall, and so the wall's next pieces on the same line: those are judged by its
        // centre here and by its built vertices below (`gap`)
        if (s.host !== undefined ? d < 0.5 : d - s.r < 0) hit(`cover ${j} (${p.look}) ${s.host !== undefined ? `centre ${d.toFixed(2)} m from it` : `overlap ${(s.r - d).toFixed(2)} m`}`);
      });
      if (s.host !== undefined && !(s.tallReach <= 0.5)) hit(`leans ${s.tallReach} m past its wall's band (0.5)`);
      if (s.host !== undefined && s.gap < 0.3) hit(`a vertex ${s.gap} m from other cover`);
      for (const p of look.places) { const d = Math.hypot(s.x - p.x, s.z - p.z) - p.r - s.r; if (d < 0) hit(`place ${p.id} (${p.kind}) overlap ${(-d).toFixed(2)} m`); }
      const b = beyond(s.x, s.z);
      if (s.beyond ? b - s.r < 2.5 : b + s.r > -0.5) hit(`outline: ${s.beyond ? 'not past the stake hedge' : 'not inside'} (centre ${b.toFixed(2)} m from it)`);
      if (!s.beyond && s.z - s.r < look.line.z + 1 && s.x > look.line.w - 2 && s.x < look.line.e + 2 && s.host === undefined) hit('behind the siege line');
      for (const t of log.taken) { const d = Math.hypot(s.x - t.x, s.z - t.z) - t.r - s.r; if (d < 0) hit(`depth prop at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) overlap ${(-d).toFixed(2)} m`); }
      log.scenes.forEach((q, k) => { if (k > i && Math.hypot(s.x - q.x, s.z - q.z) < s.r + q.r) hit(`scene ${k} ${q.kind} overlaps`); });
      if (!s.beyond && s.host === undefined && s.h > 0.6) hit(`${s.h} m tall in the walkable ground`);
    });
    out.floors.push({
      floor: n, scenes: log.scenes.length, open: log.scenes.filter((s) => !s.beyond && s.host === undefined).length,
      leaning: log.scenes.filter((s) => s.host !== undefined).length, beyond: log.scenes.filter((s) => s.beyond).length,
      tallestOpen: Math.max(...log.scenes.filter((s) => !s.beyond && s.host === undefined).map((s) => s.h)), keepSpots: keep.length,
      buildMs: log.ms, planMs: log.planMs, paintMs: log.paintMs, smokes: log.smokes, triangles: log.tris, kinds, reach, hits,
    });
    out.totalScenes += log.scenes.length; out.totalHits += hits.length;
  }
  return out;
};
return await probe();
