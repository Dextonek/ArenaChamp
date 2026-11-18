// The scenes' overlap probe (src/tower/world/scenes/): builds each floor's zone as the game does and checks every placed scene's parts
// (their corners on the ground and their tops) against the floor's own data, not against what the placing code thought:
//   - the floor's spots (keep.ts floorKeep: start, camp, lore, people, packs and patrols, waystones, caches, doors, quest steps): 3 m;
//   - the roads' middles (the painted dirt, 1.75 m each side of the line);
//   - the cover (its radius; the outline's invisible edge walls are left out: the outline is checked on its own); the Wood's roots
//     (its law's walls, both ways: 0.3 m);
//   - the places' stands (their radius); the tidal flats as drawn; the depth's props (their reach), the harbour file's props (half their
//     length and their radius), the Wood's brooks (0.9 m);
// Each part's footprint is sampled every 0.5 m (its corners and middle come from the scene's record).
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
    const RING = common.RING, HO = (await import('/src/arenas/harbour.ts')).HARBOUR_OBSTACLES;
    const looks = {};
    try { looks[1] = (await import('/src/tower/world/floors/gen/harbour-big.ts')).HARBOUR.look; } catch (e) { /* none */ }
    try { const w = await import('/src/tower/world/floors/woodGrown.ts'); if (w.WOOD_11) looks[11] = w.WOOD_11.look; } catch (e) { /* none */ }
    try { const sea = await import('/src/tower/world/scenes/sea.ts'); window.__sceneKinds = [...(floors.some((n) => n <= 10) ? sea.SEA_SCENE_KINDS : [])]; } catch (e) { window.__sceneKinds = []; }
    try { const wood = await new Function('p', 'return import(p)')('/src/tower/world/scenes/wood.ts'); /* not seen by the dev server: the file may not exist yet */ if (floors.some((n) => n > 10 && n <= 20)) window.__sceneKinds.push(...wood.WOOD_SCENE_KINDS); } catch (e) { /* not yet */ }
    const out = [];
    for (const n of floors) {
      const def = F.FLOORS[n];
      if (!def) { out.push({ floor: n, error: 'no floor' }); continue; }
      const look = G.GEN_FLOORS[n]?.baked.look ?? looks[n];
      if (!look) { out.push({ floor: n, error: 'no look' }); continue; }
      const t0 = performance.now();
      const z = def.arena.build();
      const buildMs = Math.round(performance.now() - t0);
      let scenes = null, marks = [], brooks = [];
      z.group.traverse((o) => { if (o.userData?.seaScenes) scenes = o.userData.seaScenes; if (o.userData?.woodScenes) scenes = o.userData.woodScenes; if (o.userData?.depthMarks) marks = o.userData.depthMarks; if (o.userData?.depth?.brooks) brooks = o.userData.depth.brooks.flatMap((b) => b.pts ?? []); });
      z.dispose();
      scenes = scenes ?? [];
      const keep = K.floorKeep(def);
      const roads = [];
      for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
      const cover = look.pieces.filter((p) => p.look !== 'edge').map((p) => p.o);
      // the roots that rise and fall (the Wood's law), both ways
      const walls = (def.law?.walls ?? []).map((w) => ({ ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r }));
      const places = look.places;
      const hits = [], kinds = {};
      for (const s of scenes) {
        kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
        const where = `${s.kind} at (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`;
        if (!s.beyond && s.top > 0.55) hits.push(`${where}: ${s.top} m tall on the walkable ground`);
        let worst = {};
        // each part is its four ground corners and its middle (scenes/*.ts): sample its footprint every 0.5 m, not just the corners
        const pts = [];
        for (let i = 0; i + 4 < s.pts.length + 1; i += 5) {
          const [c0, c1, c2, c3] = s.pts.slice(i, i + 4);
          const n1 = Math.max(1, Math.ceil(Math.max(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), Math.hypot(c3[0] - c2[0], c3[1] - c2[1])) / 0.5));
          const n2 = Math.max(1, Math.ceil(Math.max(Math.hypot(c2[0] - c0[0], c2[1] - c0[1]), Math.hypot(c3[0] - c1[0], c3[1] - c1[1])) / 0.5));
          for (let a = 0; a <= n1; a++) for (let b = 0; b <= n2; b++) {
            const u = a / n1, w = b / n2;
            pts.push([(1 - u) * (1 - w) * c0[0] + u * (1 - w) * c1[0] + (1 - u) * w * c2[0] + u * w * c3[0], (1 - u) * (1 - w) * c0[1] + u * (1 - w) * c1[1] + (1 - u) * w * c2[1] + u * w * c3[1]]);
          }
        }
        for (const [x, zz] of pts) {
          for (const [bx, bz] of brooks) if (Math.hypot(bx - x, bz - zz) < 0.9) worst.brook = 'in a brook';
          for (const k of keep) { const d = Math.hypot(k.x - x, k.z - zz); if (d < 3) worst.keep = Math.min(worst.keep ?? 9, d); }
          for (const r of roads) { const d = segDist(x, zz, ...r); if (d < 1.75) worst.road = Math.min(worst.road ?? 9, d); }
          for (const c of cover) { const d = segDist(x, zz, c.ax, c.az, c.bx, c.bz) - c.r; if (d < 0) worst.cover = Math.min(worst.cover ?? 9, d); }
          for (const c of walls) { const d = segDist(x, zz, c.ax, c.az, c.bx, c.bz) - c.r; if (d < 0.3) worst.roots = Math.min(worst.roots ?? 9, d); }
          for (const p of places) { const d = Math.hypot(p.x - x, p.z - zz) - p.r; if (d < 0) worst.place = `${p.id} ${d.toFixed(2)}`; }
          for (const m of marks) if (m.r < 25 && Math.hypot(m.x - x, m.z - zz) < m.r) worst.depthProp = `a depth prop ${Math.hypot(m.x - x, m.z - zz).toFixed(2)} from its middle (its reach ${m.r.toFixed(2)})`;
          for (const pr of look.props ?? []) { const o = HO[pr.i], d = Math.hypot(RING.x + pr.dx - x, RING.z + pr.dz - zz), reach = o ? Math.hypot(o.bx - o.ax, o.bz - o.az) / 2 + o.r : 1.2; if (d < reach) worst.prop = `a harbour prop ${d.toFixed(2)} (its reach ${reach.toFixed(2)})`; }
          for (const f of look.flats ?? []) {
            const c = Math.cos(f.rot ?? 0), sn = Math.sin(f.rot ?? 0), dx = x - f.x, dz = zz - f.z, u = dx * c + dz * sn, w = -dx * sn + dz * c, R = f.rx + 2;
            if (!s.beyond && Math.hypot(u / R, w / (R * f.rz / f.rx)) < 1) worst.flat = 'in a tidal flat';
          }
          const b = Math.hypot(x - RING.x, zz - RING.z) - land.rimAt(look.rim ?? new Array(48).fill(48), Math.atan2(zz - RING.z, x - RING.x));
          if (!s.beyond && b > -0.5) worst.outline = Math.max(worst.outline ?? -9, b);
          if (s.beyond && b < 0.6) worst.inside = Math.min(worst.inside ?? 9, b);
        }
        for (const [k, v] of Object.entries(worst)) hits.push(`${where}: ${k} ${typeof v === 'number' ? v.toFixed(2) : v}`);
      }
      out.push({ floor: n, scenes: scenes.length, ground: scenes.filter((s) => !s.beyond).length, beyond: scenes.filter((s) => s.beyond).length, kinds, hits, buildMs });
    }
    // every kind's count over the floors asked, and the kinds that never placed (a silent reject shows up here)
    const totals = {};
    for (const r of out) for (const [k, v] of Object.entries(r.kinds ?? {})) totals[k] = (totals[k] ?? 0) + v;
    out.totals = totals;
    out.never = (window.__sceneKinds ?? []).filter((k) => !totals[k]);
    return out;
  };
})();

// The views probe (2026-11-14, "continue more refine"): how often the game's camera shows a scene. The hero stands at points every 8 m
// along every road and on an 8 m grid over the walkable ground; the camera is the game's own (heroMode.ts followCamera: the hero plus
// (0, 15, 10.5) x zoom, looking at 0.5 m up, 1.5 m ahead; a vertical field of view of 50 degrees, 16:9). A view shows a scene when the
// scene's main piece (its `main`, else its middle) lands in the picture outside the HUD's bottom bar (NDC x within 0.92, y from -0.6 to
// 0.9). Reports per floor the share of road views and of all views that show at least one scene, and the scenes seen per view; and,
// stricter, the share where a scene reads (`roadRead`, `allRead`): its largest part is at least 60 px across (of 1280 x 720) and stands in
// the middle of the picture (x 160 to 1120, y 72 to 540 px). Echo props (`echo` in the record) are left out.
//   await _scenesViews([1, 2, 3], { zoom: 1.25 })
(() => {
  window._scenesViews = async (floors, opt = {}) => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const F = await import('/src/tower/world/floors/index.ts');
    const G = await import('/src/tower/world/floors/gen/index.ts');
    const land = await import('/src/tower/world/land.ts');
    const RING = (await import('/src/arenas/common.ts')).RING;
    const looks = {};
    try { looks[1] = (await import('/src/tower/world/floors/gen/harbour-big.ts')).HARBOUR.look; } catch (e) { /* none */ }
    try { const w = await import('/src/tower/world/floors/woodGrown.ts'); if (w.WOOD_11) looks[11] = w.WOOD_11.look; } catch (e) { /* none */ }
    const zoom = opt.zoom ?? 1.25, step = opt.step ?? 8;
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
    const v = new THREE.Vector3();
    const out = [];
    for (const n of floors) {
      const def = F.FLOORS[n];
      const look = G.GEN_FLOORS[n]?.baked.look ?? looks[n];
      if (!def || !look) { out.push({ floor: n, error: 'no floor' }); continue; }
      const z = def.arena.build();
      let scenes = [];
      z.group.traverse((o) => { if (o.userData?.seaScenes) scenes = o.userData.seaScenes; if (o.userData?.woodScenes) scenes = o.userData.woodScenes; });
      z.dispose();
      const rim = look.rim ?? new Array(48).fill(48);
      const inside = (x, zz) => Math.hypot(x - RING.x, zz - RING.z) - land.rimAt(rim, Math.atan2(zz - RING.z, x - RING.x)) < -1;
      // Echo props (a dropped crate between two scenes) are not scenes: left out here.
      const real = scenes.filter((s) => !s.echo);
      const mains = real.map((s) => (s.main ? { x: s.main[0], z: s.main[1] } : { x: s.x, z: s.z }));
      // Each scene's largest part (its four ground corners, from the record: parts are 4 corners and a middle), for the strict count.
      const bigs = real.map((s) => {
        let best = null, area = 0;
        for (let i = 0; i + 4 < s.pts.length + 1; i += 5) {
          const [a, b, c, d] = s.pts.slice(i, i + 4);
          const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
          if (ar > area) { area = ar; best = [a, b, c, d]; }
        }
        return best;
      });
      const px = (x, y, zz) => { v.set(x, y, zz).project(cam); return [(v.x + 1) * 640, (1 - v.y) * 360, v.z]; };
      /** [scenes whose main piece is in frame, scenes that read: their largest part at least 60 px across in the middle of the picture] */
      const sees = (x, zz) => {
        cam.position.set(x, 15 * zoom, zz + 10.5 * zoom);
        cam.lookAt(x, 0.5, zz - 1.5);
        cam.updateMatrixWorld();
        let k = 0, rd = 0;
        for (let i = 0; i < mains.length; i++) {
          const m = mains[i];
          if (Math.abs(m.x - x) > 40 || m.z - zz > 10 || zz - m.z > 45) continue;
          v.set(m.x, 0.3, m.z).project(cam);
          if (!(v.z < 1 && Math.abs(v.x) < 0.92 && v.y > -0.6 && v.y < 0.9)) continue;
          k++;
          const q = bigs[i];
          if (!q) continue;
          const c = q.map(([a, b]) => px(a, 0.1, b));
          const cx = (c[0][0] + c[3][0]) / 2, cy = (c[0][1] + c[3][1]) / 2;
          const span = Math.max(Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]), Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]));
          if (span >= 60 && cx > 160 && cx < 1120 && cy > 72 && cy < 540) rd++;
        }
        return [k, rd];
      };
      let roadN = 0, roadHit = 0, allN = 0, allHit = 0, seen = 0, roadRead = 0, allRead = 0;
      for (const p of look.paths) for (let i = 1; i < p.length; i++) {
        const ax = RING.x + p[i - 1][0], az = RING.z + p[i - 1][1], bx = RING.x + p[i][0], bz = RING.z + p[i][1], L = Math.hypot(bx - ax, bz - az);
        for (let d = 0; d < L; d += step) {
          const x = ax + ((bx - ax) * d) / L, zz = az + ((bz - az) * d) / L;
          if (!inside(x, zz)) continue;
          const [k, rd] = sees(x, zz);
          roadN++; if (k) roadHit++; if (rd) roadRead++;
        }
      }
      const R = Math.max(...rim) + 2;
      for (let x = RING.x - R; x <= RING.x + R; x += step) for (let zz = RING.z - R; zz <= RING.z + R; zz += step) {
        if (!inside(x, zz)) continue;
        const [k, rd] = sees(x, zz);
        allN++; if (k) allHit++; if (rd) allRead++; seen += k;
      }
      out.push({ floor: n, scenes: real.length, echoes: scenes.length - real.length, road: +(roadHit / Math.max(1, roadN)).toFixed(3), all: +(allHit / Math.max(1, allN)).toFixed(3), roadRead: +(roadRead / Math.max(1, roadN)).toFixed(3), allRead: +(allRead / Math.max(1, allN)).toFixed(3), perView: +(seen / Math.max(1, allN)).toFixed(2), roadViews: roadN, views: allN });
    }
    return out;
  };
})();
