// The navigator (src/nav.ts) against its old self (pipeline/tools/nav-old.ts, the navigator before its spatial index): on the maps the
// game builds, both are given the same walks, chases, dashes, plans and straight-line checks, and every answer must be the same to the
// last bit. Also the speed of the two side by side, and the frame times of the route bot on a Climb floor.
//
// Run by `python pipeline/tools/nav-same.py` (it opens the tool page of a running dev server). By hand, on the tool page:
//   eval(await (await fetch('/pipeline/tools/nav-same.js')).text());
//   await _navSame({ seed: 1 })                     // every map: { maps, steps, clears, plans, links, diffs, first }
//   await _navSpeed({ floors: [46, 11, 14] })        // the first long plan, a plan once its links exist, the Wood's first walk
//   await _navFrames({ floor: 46, seconds: 90 })     // the route bot's longest frames, and the navigator's share of them
//
// Maps: the Climb floors (default 1, 11, 14, 21, 26, 31, 35, 41, 46) as the world game builds them (the doors' walls in, both states of
// the Wood's roots), each for the player's navigator and the AI's (its own cover and bounds added); every arena exported by
// src/arenas (its cover in the duel ring); the nine duel arenas as a running duel has them (shifting floors, the AI's own cover).
(() => {
  const r2 = (x) => +x.toFixed(2);
  let V = null, mods = null;
  async function setup() {
    if (!window._world) eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
    if (!mods) {
      mods = {
        nav: await import('/src/nav.ts'),
        old: await import('/pipeline/tools/nav-old.ts'),
        floors: await import('/src/tower/world/floors/index.ts'),
        common: await import('/src/arenas/common.ts'),
        arenas: await import('/src/arenas/index.ts'),
        game: await import('/src/tower/world/game.ts'),
      };
      const names = ['battlefield', 'caldera', 'canyon', 'cavern', 'frost', 'glade', 'harbour', 'noonfall', 'skyruins', 'sunburst', 'suncourt', 'sunhall', 'sunkenHeart', 'temple', 'tower', 'twinpit', 'cinderpit'];
      mods.arenaFiles = {};
      for (const n of names) {
        try { mods.arenaFiles[n] = await import(`/src/arenas/${n}.ts`); } catch (e) { mods.arenaFiles[n] = { __err: String(e).slice(0, 200) }; }
      }
    }
    V = vfx.arena.caster.group.position.constructor;
  }
  const copyList = (l) => (l ?? []).map((o) => ({ ...o }));
  const copyB = (b) => (b ? { x: b.x, z: b.z, r: b.r } : null);

  /** A seeded stream of numbers in [0, 1) (mulberry32). */
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /**
   * Maps made for the test: symmetric ones where two ways round are the same length to the last bit (the plan's ties), a lattice of
   * pillars on round numbers, a room parted by walls of its own (`fixed`), and the smallest lists.
   */
  function madeMaps() {
    const P = (x, z, r = 0.85) => ({ ax: x, az: z, bx: x, bz: z, r, height: 4.2, kind: 'pillar' });
    const Wl = (ax, az, bx, bz, r = 0.35, fixed) => ({ ax, az, bx, bz, r, height: 2.3, kind: 'wall', ...(fixed ? { fixed: true } : {}) });
    const ring = { x: 0, z: 7, r: 12 };
    const lattice = [];
    for (let x = -16; x <= 16; x += 4) for (let z = -9; z <= 23; z += 4) if (x || z !== 7) lattice.push(P(x, z, x % 8 ? 0.85 : 1.25));
    const mirrored = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mirrored.push(Wl(sx * 3, 7 + sz * 2, sx * 3, 7 + sz * 6), Wl(sx * 6, 7 + sz * 1, sx * 9, 7 + sz * 4), P(sx * 5, 7 + sz * 5, 0.6), Wl(sx * 1, 7 + sz * 8, sx * 4, 7 + sz * 8));
    }
    const room = [Wl(-12, 7, -1.2, 7, 0.5, true), Wl(1.2, 7, 12, 7, 0.5, true), Wl(0, -5, 0, 3, 0.5, true), ...mirrored.slice(0, 8), P(4, 12), P(-4, 12), P(4, 2), P(-4, 2)];
    const sealed = [Wl(-12, 7, 12, 7, 0.5, true), ...lattice.slice(0, 20).map((q) => ({ ...q, ax: q.ax / 2, bx: q.bx / 2, az: 7 + (q.az - 7) / 2, bz: 7 + (q.bz - 7) / 2 }))];
    const big = [];
    for (let k = 0; k < 240; k++) {
      const a = (k * 137.5 * Math.PI) / 180, d = 6 + Math.sqrt(k) * 5.5, x = Math.sin(a) * d, z = 7 + Math.cos(a) * d;
      big.push(k % 3 ? P(x, z, 0.6 + (k % 5) * 0.3) : Wl(x, z, x + Math.cos(a) * (2 + (k % 7)), z - Math.sin(a) * (2 + (k % 7)), 0.35 + (k % 2) * 0.3));
    }
    return [
      { name: 'made: nothing', list: [], bounds: ring, variants: [] },
      { name: 'made: one pillar in the middle', list: [P(0, 7)], bounds: ring, variants: [[P(0, 7, 2)]] },
      { name: 'made: one wall, no ring', list: [Wl(-3, 7, 3, 7)], bounds: null, variants: [] },
      { name: 'made: lattice of pillars', list: lattice, bounds: { x: 0, z: 7, r: 20 }, variants: [lattice.filter((_, k) => k % 5)] },
      { name: 'made: mirrored walls', list: mirrored, bounds: ring, variants: [mirrored.slice(0, 12)] },
      { name: 'made: a room parted by its own walls', list: room, bounds: ring, variants: [] },
      { name: 'made: a room sealed in two', list: sealed, bounds: ring, variants: [] },
      { name: 'made: 240 pieces on a spiral', list: big, bounds: { x: 0, z: 7, r: 95 }, variants: [big.filter((_, k) => k % 9)] },
    ];
  }

  /** Every map: { name, list, bounds, variants?: [list...] } (a variant: the same place with other cover, switched to mid-walk). */
  window._navMaps = async (o = {}) => {
    await setup();
    const maps = o.made === false ? [] : madeMaps();
    const floors = o.floors ?? [1, 11, 14, 21, 26, 31, 35, 41, 46];
    for (const n of floors) {
      await window._world({ floor: n, hero: 'Lyra' });
      const a = vfx.arena, def = mods.floors.FLOORS[n];
      const list = copyList(a.obstacles), bounds = copyB(a.bounds);
      const variants = [];
      if (def.law?.kind === 'paths') {
        const isLaw = (q) => def.law.walls.some((w) => w.a.x === q.ax && w.a.z === q.az && w.b.x === q.bx && w.b.z === q.bz);
        const base = list.filter((q) => !isLaw(q));
        for (const s of [0, 1]) variants.push([...base, ...def.law.walls.filter((w) => w.set === s).map((w) => ({ kind: 'wall', ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r, height: w.height }))]);
      }
      maps.push({ name: `floor ${n}`, list, bounds, variants });
      maps.push({ name: `floor ${n} (AI)`, list: [...list, ...copyList(a.aiCover)], bounds: copyB(a.aiBounds ?? a.bounds), variants: variants.map((v) => [...v, ...copyList(a.aiCover)]) });
    }
    if (floors.length) window._world.end();
    if (o.arenas !== false) {
      const R = mods.common.RING;
      for (const [file, m] of Object.entries(mods.arenaFiles)) {
        for (const [key, def] of Object.entries(m)) {
          if (!def || typeof def !== 'object' || !Array.isArray(def.obstacles) || !def.obstacles.length) continue;
          maps.push({ name: `${file}.${key}`, list: copyList(def.obstacles), bounds: { x: R.x, z: R.z, r: def.ring ?? R.r }, variants: [] });
        }
        for (const [key, l] of Object.entries(m)) {
          if (!/OBSTACLES$|^PILLARS$/.test(key) || !Array.isArray(l) || !l.length) continue;
          maps.push({ name: `${file}.${key} (no ring)`, list: copyList(l), bounds: null, variants: [] });
        }
      }
    }
    if (o.duels !== false) {
      for (const def of mods.arenas.ARENAS) {
        vfx.setHeroMode(true);
        vfx.heroPickCtrl.setValue('Lyra');
        vfx.duel.opponentChoice = 'Bram';
        vfx.duel.arenaChoice = def.id;
        vfx.duel.start('run');
        const shots = [];
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < (k ? 1200 : 300); i++) vfx.step(1 / 60);
          const a = vfx.arena;
          if (!a.obstacles) continue;
          shots.push({ list: copyList(a.obstacles), bounds: copyB(a.bounds), ai: [...copyList(a.obstacles), ...copyList(a.aiCover)], aiBounds: copyB(a.aiBounds ?? a.bounds) });
        }
        if (!shots.length) continue;
        maps.push({ name: `duel ${def.id}`, list: shots[0].list, bounds: shots[0].bounds, variants: shots.slice(1).map((s) => s.list) });
        maps.push({ name: `duel ${def.id} (AI)`, list: shots[0].ai, bounds: shots[0].aiBounds, variants: shots.slice(1).map((s) => s.ai) });
      }
      vfx.duel.stop?.();
    }
    return maps;
  };

  const same = (a, b) => Object.is(a, b);
  /** The navigator's signature of a list (`sync` in src/nav.ts). */
  const sigOf = (list, bounds) => {
    let sig = list.length + (bounds?.r ?? 0);
    for (const o of list) sig = (sig * 31 + o.ax * 7 + o.az * 11 + o.bx * 13 + o.bz * 17 + o.r * 19) % 1000003;
    return sig;
  };
  const sameV = (p, q) => same(p.x, q.x) && same(p.y, q.y) && same(p.z, q.z);
  const samePath = (p, q) => p.length === q.length && p.every((v, i) => sameV(v, q[i]));

  /**
   * One map: seeded walkers (walking their routes, chasing each other, chasing a goal that drifts, ordered into cover, dashing), the cover
   * switched mid-walk (a variant, a wall falling in place, a fresh list by value as the AI's navigator gets), plus straight-line checks,
   * links and plans of the two navigators compared. Returns the counts and the first differences.
   */
  function oneMap(map, seed, o) {
    const rand = rng(seed), oldNav = new mods.old.OldNavigator(), newNav = new mods.nav.Navigator();
    const out = { name: map.name, cover: map.list.length, steps: 0, clears: 0, plans: 0, links: 0, nodes: 0, unseenEdits: 0, diffs: 0, first: [] };
    // The maps are shared between seeds: each run edits copies.
    map = { ...map, list: map.list.map((q) => ({ ...q })), variants: (map.variants ?? []).map((v) => v.map((q) => ({ ...q }))) };
    const diff = (what) => { out.diffs++; if (out.first.length < 5) out.first.push(what); };
    const b = map.bounds ?? (() => {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of map.list) { x0 = Math.min(x0, q.ax, q.bx); x1 = Math.max(x1, q.ax, q.bx); z0 = Math.min(z0, q.az, q.bz); z1 = Math.max(z1, q.az, q.bz); }
      return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.max(x1 - x0, z1 - z0) / 2 + 3 };
    })();
    const anywhere = () => { const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * b.r * 1.05; return new V(b.x + Math.sin(a) * d, 0, b.z + Math.cos(a) * d); };
    // Spots that matter: on cover's edge, at touching distance, inside it.
    const nearCover = (list) => {
      const q = list[Math.floor(rand() * list.length)];
      const t = rand(), cx = q.ax + (q.bx - q.ax) * t, cz = q.az + (q.bz - q.az) * t, a = rand() * Math.PI * 2;
      const pick = rand(), d = pick < 0.25 ? q.r + 0.47 : pick < 0.5 ? q.r + 0.5 : pick < 0.6 ? q.r * rand() : q.r + 0.5 + rand() * 2;
      return new V(cx + Math.sin(a) * d, 0, cz + Math.cos(a) * d);
    };
    let list = map.list;
    const lists = [map.list, ...(map.variants ?? [])];
    // A spot on round numbers (the lattice of the made maps, an index square's edge) now and then.
    const round = () => { const p = anywhere(); return new V(Math.round(p.x * 2) / 2, 0, Math.round(p.z * 2) / 2); };
    const spot = () => { const r = rand(); return r < 0.35 && list.length ? nearCover(list) : r < 0.45 ? round() : anywhere(); };
    const W = o.walkers ?? 6, T = o.ticks ?? 300;
    // Odd walkers hand over a fresh copy of the list each time (as the AI's navigator gets it); which one builds the graph first changes.
    const flip = seed % 2;
    const walkers = Array.from({ length: W }, (_, k) => ({ key: {}, pos: spot(), to: spot(), mode: k % 4, drift: new V(), aiStyle: (k + flip) % 2 === 1 }));

    const checkNodes = () => {
      const a = oldNav.nodes, c = newNav.nodes;
      if (a.length !== c.length || a.some((p, i) => !same(p.x, c[i].x) || !same(p.z, c[i].z))) diff(`nodes differ (${a.length} vs ${c.length})`);
      out.nodes = Math.max(out.nodes, a.length);
    };
    const compareLinks = (k) => {
      for (let n = 0; n < k; n++) {
        const N = oldNav.nodes.length;
        if (!N) return;
        const i = Math.floor(rand() * N), la = oldNav.linksOf(i), lb = newNav.linksOf(i);
        out.links++;
        if (la.length !== lb.length || la.some((l, j) => l.to !== lb[j].to || !same(l.cost, lb[j].cost))) diff(`links of point ${i} differ (${la.length} vs ${lb.length})`);
      }
    };
    const compareClears = (k) => {
      const nodes = oldNav.nodes;
      for (let n = 0; n < k; n++) {
        const r = rand();
        const pa = r < 0.4 && nodes.length ? nodes[Math.floor(rand() * nodes.length)] : spot();
        const r2 = rand();
        // The odd ones: no length, straight along x or z, far off the map, on round numbers.
        const pb = r < 0.2 && nodes.length ? nodes[Math.floor(rand() * nodes.length)]
          : r2 < 0.05 ? pa : r2 < 0.1 ? new V(pa.x, 0, pa.z + (rand() - 0.5) * 40) : r2 < 0.15 ? new V(pa.x + (rand() - 0.5) * 40, 0, pa.z)
          : r2 < 0.18 ? new V(pa.x + (rand() < 0.5 ? -1 : 1) * (300 + rand() * 300), 0, pa.z + (rand() - 0.5) * 600) : r2 < 0.25 ? round()
          : r2 < 0.45 ? new V(pa.x + (rand() - 0.5) * 6, 0, pa.z + (rand() - 0.5) * 6) : spot();
        const want = oldNav.clear(pa, pb), viaIndex = newNav.through(pa, pb), viaList = newNav.clear(pa, pb, list);
        out.clears++;
        if (want !== viaIndex || want !== viaList) diff(`clear (${pa.x}, ${pa.z}) -> (${pb.x}, ${pb.z}): old ${want}, index ${viaIndex}, list ${viaList}`);
      }
    };
    const comparePlans = (k) => {
      for (let n = 0; n < k; n++) {
        const from = spot(), goal = spot();
        const pa = oldNav.plan(from, goal), pb = newNav.plan(from, goal);
        out.plans++;
        if (!samePath(pa, pb)) diff(`plan (${from.x}, ${from.z}) -> (${goal.x}, ${goal.z}): ${pa.length} vs ${pb.length} points`);
      }
    };

    for (let t = 0; t < T; t++) {
      // The cover changes now and then: another state of the place, or a piece of it falls (edited in place, as the arena does).
      if (t > 0 && t % 97 === 0 && lists.length > 1) list = lists[(lists.indexOf(list) + 1) % lists.length];
      if (t > 0 && t % 151 === 0 && list.length > 3) { list = list.slice(); list.splice(Math.floor(rand() * list.length), 1); }
      if (t === Math.floor(T / 2) && list.length > 2) list.splice(Math.floor(rand() * list.length), 1); // in place
      if (t === Math.floor(T / 3) && list.length) {
        // An edit the signature does not see (as when two lists' signatures collide): a piece moved in place, and both navigators told
        // the signature they hold is the edited list's. The old one keeps its graph and asks the edited list; the new one must too.
        const q = list[Math.floor(rand() * list.length)];
        q.ax += 1.5; q.bx += 1.5; q.az -= 0.75; q.bz -= 0.75;
        for (const nav of [oldNav, newNav]) nav.signature = sigOf(list, map.bounds);
        out.unseenEdits++;
      }
      for (const w of walkers) {
        const r = rand();
        if (w.mode === 0 && r < 0.02) w.to = spot();
        if (w.mode === 1) { const other = walkers[(walkers.indexOf(w) + 1) % W]; w.to = other.pos.clone(); }
        if (w.mode === 2) {
          if (r < 0.05) w.drift.set((rand() - 0.5) * 0.9, 0, (rand() - 0.5) * 0.9);
          w.to = w.to.clone().add(w.drift);
        }
        if (w.mode === 3 && r < 0.05) w.to = rand() < 0.5 && list.length ? nearCover(list) : spot();
        if (r > 0.995) { oldNav.forget(w.key); newNav.forget(w.key); }
        const given = w.aiStyle ? [...list] : list;
        const sa = oldNav.step(w.key, w.pos.clone(), w.to.clone(), given, map.bounds);
        const sb = newNav.step(w.key, w.pos.clone(), w.to.clone(), given, map.bounds);
        out.steps++;
        if (!sameV(sa.point, sb.point) || !sameV(sa.goal, sb.goal)) diff(`step ${t} of a walker at (${w.pos.x}, ${w.pos.z}) to (${w.to.x}, ${w.to.z}): (${sa.point.x}, ${sa.point.z}) vs (${sb.point.x}, ${sb.point.z})`);
        // Walk on along the old one's answer; a dash or a shove now and then.
        const d = sa.point.clone().sub(w.pos).setY(0), len = d.length(), sp = 0.12 + rand() * 0.25;
        if (len > 1e-9) w.pos.add(d.multiplyScalar(Math.min(1, sp / len)));
        if (rand() < 0.01) w.pos = spot();
        if (rand() < 0.02) w.pos.add(new V((rand() - 0.5) * 2, 0, (rand() - 0.5) * 2));
      }
      if (t % 25 === 0) { checkNodes(); compareClears(o.clearsPerCheck ?? 40); compareLinks(2); }
      if (t % 60 === 0) comparePlans(map.list.length > 150 ? (o.bigPlans ?? 4) : (o.plans ?? 60));
    }
    return out;
  }

  window._navSame = async (o = {}) => {
    await setup();
    const t0 = performance.now();
    const maps = o.maps ?? (await window._navMaps(o));
    const rows = [];
    for (const seed of o.seeds ?? [o.seed ?? 1]) for (let k = 0; k < maps.length; k++) rows.push({ seed, ...oneMap(maps[k], seed * 1000 + k, o) });
    const sum = (f) => rows.reduce((n, r) => n + r[f], 0);
    return { maps: maps.length, runs: rows.length, steps: sum('steps'), clears: sum('clears'), plans: sum('plans'), links: sum('links'), unseenEdits: sum('unseenEdits'), diffs: sum('diffs'), seconds: r2((performance.now() - t0) / 1000), rows };
  };

  /**
   * The speed of the old and the new navigator on the same walks, the player's map and the AI's: making the graph (`build`), the first
   * long plan on a fresh map (the frame the route bot froze in), more long plans while links are still being found, the same plans again
   * once they are known, and on the Wood the roots changing (the graph made again) and the first long walk after it.
   */
  window._navSpeed = async (o = {}) => {
    await setup();
    const out = [];
    const ms = (f) => { const t = performance.now(); f(); return performance.now() - t; };
    for (const n of o.floors ?? [46, 11, 14]) {
      const maps = await window._navMaps({ floors: [n], arenas: false, duels: false, made: false });
      const def = mods.floors.FLOORS[n];
      // Far spots: the start and the packs; legs between them, the longest first.
      const spots = [def.start, ...def.packs.map((p) => p.named ? p.named.patrol[0] : p.at)].filter(Boolean).map((p) => new V(p.x, 0, p.z));
      const legs = [];
      for (const a of spots) for (const c of spots) if (a !== c) legs.push([a, c, a.distanceTo(c)]);
      legs.sort((p, q) => q[2] - p[2]);
      const pick = legs.filter((_, i) => i % 7 === 0).slice(0, 12);
      for (const map of maps) {
        const row = { map: map.name, cover: map.list.length, longestLegM: r2(pick[0][2]) };
        for (const [label, Make] of o.order === 'new-first' ? [['new', mods.nav.Navigator], ['old', mods.old.OldNavigator]] : [['old', mods.old.OldNavigator], ['new', mods.nav.Navigator]]) {
          const lists = map.variants.length ? map.variants : [map.list];
          const nav = new Make(), key = {};
          const res = {};
          // A walk that needs no plan: only the graph is made.
          res.buildMs = r2(ms(() => nav.step(key, pick[0][0], pick[0][0], lists[0], map.bounds)));
          res.firstPlanMs = r2(ms(() => nav.step({}, pick[0][0], pick[0][1], lists[0], map.bounds)));
          // The lists of links made (the new navigator keeps them as `rowTo` on a map with an index).
          const linked = () => (nav.rowTo?.some(Boolean) ? nav.rowTo : nav.links).filter(Boolean);
          res.pointsLinkedByFirst = linked().length;
          const cold = pick.map(([a, c]) => ms(() => nav.step({}, a, c, lists[0], map.bounds)));
          res.morePlansMs = r2(cold.reduce((x, y) => x + y, 0));
          const warm = pick.map(([a, c]) => ms(() => nav.plan(a, c)));
          res.planKnownMs = r2(warm.reduce((x, y) => x + y, 0) / warm.length);
          res.planKnownMaxMs = r2(Math.max(...warm));
          res.points = nav.nodes.length;
          res.pointsLinked = linked().length;
          res.linksPerPoint = r2(linked().reduce((s, l) => s + l.length, 0) / Math.max(1, linked().length));
          if (lists.length > 1) {
            // The Wood: the roots change (the graph is made again), then the first long walk.
            res.rootsRebuildMs = [];
            res.firstWalkAfterRootsMs = [];
            for (let k = 0; k < 4; k++) {
              const l = lists[(k + 1) % 2];
              res.rootsRebuildMs.push(r2(ms(() => nav.step(key, pick[k][0], pick[k][0], l, map.bounds))));
              res.firstWalkAfterRootsMs.push(r2(ms(() => nav.step({}, pick[k][0], pick[k][1], l, map.bounds))));
            }
          }
          row[label] = res;
        }
        out.push(row);
      }
    }
    return out;
  };

  /**
   * The route bot on a floor (`_worldRoute`) for `seconds` of game time: its longest frames, each with the time spent in the navigators
   * (`step`, of it `plan`, of it `linksOf`) and how many points' links were found in it.
   */
  window._navFrames = async (o = {}) => {
    await setup();
    // The new navigator makes a point's links in `row` (with an index); the old one in `linksOf`.
    const P = mods.nav.Navigator.prototype, links = P.row ? 'row' : 'linksOf', orig = { step: P.step, plan: P.plan, linksOf: P[links] };
    const cur = { step: 0, plan: 0, linksOf: 0, found: 0 };
    const wrap = (name) => function (...a) {
      if (name === 'linksOf' && (this.rowTo?.[a[0]] ?? this.links[a[0]])) return orig.linksOf.apply(this, a);
      const t = performance.now();
      try { return orig[name].apply(this, a); } finally {
        const d = performance.now() - t;
        cur[name] += d;
        if (name === 'linksOf') cur.found++;
      }
    };
    // Nested calls (plan inside step, linksOf inside plan) add into their own buckets: the share of each, not exclusive.
    P.step = wrap('step'); P.plan = wrap('plan'); P[links] = wrap('linksOf');
    // A frame: the game's step and the run's tick (not the bot's pauses for the page, which wait for whatever else the page does).
    const frames = [];
    const st = vfx.step, G = mods.game.WorldGame.prototype, tick = G.tick;
    let n = 0, inFrame = 0;
    const close = () => {
      if (inFrame > 0) frames.push({ frame: n++, ms: r2(inFrame), navStep: r2(cur.step), plan: r2(cur.plan), linksOf: r2(cur.linksOf), pointsLinked: cur.found });
      inFrame = 0;
      cur.step = cur.plan = cur.linksOf = cur.found = 0;
    };
    vfx.step = function (...a) {
      close();
      const t = performance.now();
      try { return st.apply(this, a); } finally { inFrame += performance.now() - t; }
    };
    G.tick = function (...a) {
      const t = performance.now();
      try { return tick.apply(this, a); } finally { inFrame += performance.now() - t; }
    };
    let report = null, err = null;
    try {
      report = await window._worldRoute({ floor: o.floor ?? 46, hero: o.hero ?? 'Lyra', maxSeconds: o.seconds ?? 90 });
    } catch (e) { err = String(e?.stack ?? e).slice(0, 300); } finally {
      close();
      vfx.step = st; G.tick = tick; P.step = orig.step; P.plan = orig.plan; P[links] = orig.linksOf;
      window._world.end?.();
    }
    const top = frames.slice().sort((p, q) => q.ms - p.ms).slice(0, o.top ?? 8);
    const ms = frames.map((f) => f.ms).sort((p, q) => p - q);
    const nav = frames.reduce((s, f) => s + f.navStep, 0);
    return { floor: o.floor ?? 46, frames: frames.length, medianMs: ms[Math.floor(ms.length / 2)], p99Ms: ms[Math.floor(ms.length * 0.99)], navMsTotal: r2(nav), top, err, ok: report?.ok };
  };
})();
