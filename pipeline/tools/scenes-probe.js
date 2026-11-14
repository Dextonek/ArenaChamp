// The scenes' overlap probe (src/tower/world/scenes/): builds each floor's zone as the game does and checks every placed scene's parts
// (their corners on the ground and their tops) against the floor's own data, not against what the placing code thought:
//   - the floor's spots (keep.ts floorKeep: start, camp, lore, people, packs and patrols, waystones, caches, doors, quest steps): 3 m;
//   - the roads' middles (the painted dirt, 1.75 m each side of the line);
//   - the cover (its radius; the outline's invisible edge walls are left out: the outline is checked on its own);
//   - the places' stands (their radius);
//   - the walkable outline: a ground scene must be inside it and low (0.55 m, knee height); a beach or sea scene must be past it.
// Run on the tool or game page (or with pipeline/tools/world-shots.py):
//   eval(await (await fetch('/pipeline/tools/scenes-probe.js')).text());
//   await _scenesProbe([1, 2, 3])        // -> [{ floor, scenes, kinds, hits: [...] }]
(() => {
  const segDist = (px, pz, ax, az, bx, bz) => {
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
    return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
  };
  window._scenesProbe = async (floors) => {
    const F = await import('/src/tower/world/floors/index.ts');
    const G = await import('/src/tower/world/floors/gen/index.ts');
    const K = await import('/src/tower/world/keep.ts');
    const land = await import('/src/tower/world/land.ts');
    const common = await import('/src/arenas/common.ts');
    const RING = common.RING;
    const looks = {};
    try { looks[1] = (await import('/src/tower/world/floors/gen/harbour-big.ts')).HARBOUR.look; } catch (e) { /* none */ }
    try { const w = await import('/src/tower/world/floors/woodGrown.ts'); for (const v of Object.values(w)) if (v && v.look && v.n) looks[v.n] = v.look; } catch (e) { /* none */ }
    const out = [];
    for (const n of floors) {
      const def = F.FLOORS[n];
      if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
      const look = G.GEN_FLOORS[n]?.baked.look ?? looks[n];
      if (!look) { out.push({ floor: n, error: 'no look' }); continue; }
      const t0 = performance.now();
      const z = def.arena.build();
      const buildMs = Math.round(performance.now() - t0);
      let scenes = null;
      z.group.traverse((o) => { if (o.userData?.seaScenes) scenes = o.userData.seaScenes; if (o.userData?.woodScenes) scenes = o.userData.woodScenes; });
      z.dispose();
      scenes = scenes ?? [];
      const keep = K.floorKeep(def);
      const roads = [];
      for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
      const cover = look.pieces.filter((p) => p.look !== 'edge').map((p) => p.o);
      const places = look.places;
      const hits = [], kinds = {};
      for (const s of scenes) {
        kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
        const where = `${s.kind} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`;
        if (!s.beyond && s.top > 0.55) hits.push(`${where}: ${s.top} m tall on the walkable ground`);
        let worst = {};
        for (const [x, zz] of s.pts) {
          for (const k of keep) { const d = Math.hypot(k.x - x, k.z - zz); if (d < 3) worst.keep = Math.min(worst.keep ?? 9, d); }
          for (const r of roads) { const d = segDist(x, zz, ...r); if (d < 1.75) worst.road = Math.min(worst.road ?? 9, d); }
          for (const c of cover) { const d = segDist(x, zz, c.ax, c.az, c.bx, c.bz) - c.r; if (d < 0) worst.cover = Math.min(worst.cover ?? 9, d); }
          for (const p of places) { const d = Math.hypot(p.x - x, p.z - zz) - p.r; if (d < 0) worst.place = `${p.id} ${d.toFixed(2)}`; }
          const b = Math.hypot(x - RING.x, zz - RING.z) - land.rimAt(look.rim ?? new Array(48).fill(48), Math.atan2(zz - RING.z, x - RING.x));
          if (!s.beyond && b > -0.5) worst.outline = Math.max(worst.outline ?? -9, b);
          if (s.beyond && b < 0.6) worst.inside = Math.min(worst.inside ?? 9, b);
        }
        for (const [k, v] of Object.entries(worst)) hits.push(`${where}: ${k} ${typeof v === 'number' ? v.toFixed(2) : v}`);
      }
      out.push({ floor: n, scenes: scenes.length, ground: scenes.filter((s) => !s.beyond).length, beyond: scenes.filter((s) => s.beyond).length, kinds, hits, buildMs });
    }
    return out;
  };
})();
