// Paste into the VFX tool page under the dev server (browser javascript tool). Tests walking in the five duel arenas:
// clicks, the stick, pressing into cover, chasing, cover that changes mid-walk and whole AI fights. It steps time itself,
// so it works with the browser pane hidden, and it runs in the background, because a browser call stops after about 45 s.
//
//   eval(await (await fetch('/pipeline/tools/walk-test.js')).text());
//   _walk.start({ suites: ['click', 'stick'], seeds: [1, 2, 3], post: 'http://127.0.0.1:5199/walk.json' });
//   _walk.progress()   // tasks done, tasks left
//   _walk.table()      // one row per suite and seed, added up over the arenas
//
// The same seed gives the same routes, so two builds can be compared. `post` is optional: the results go there when done.
//
// What it counts per walk:
//   jitter   two sharp turns (over 69°) within 0.3 s, however small the moves
//   shuffle  the same, counting only moves you can see (over a quarter of a step): the hero shuffling
//   against  frames in which the hero moved against the way the stick pushes
//   inCover  frames inside the touching distance of an obstacle (should be 0)
//   pops     frames that moved over 1.4 times the walking speed (should be 0)
//   stuck    stick walks that made under 10% of the possible way along or round cover
//   maxTurn  the largest change of the drawn figure's facing in one frame (radians)
(() => {
  const ARENAS = ['temple', 'frost', 'caldera', 'glade', 'skyruins'];
  const SHARP = 1.2, JITTER_WINDOW = 0.3, DT = 1 / 60;
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const closest = (o, x, z) => { const sx = o.bx - o.ax, sz = o.bz - o.az, l = sx * sx + sz * sz, k = l > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * sx + (z - o.az) * sz) / l)) : 0; return { x: o.ax + sx * k, z: o.az + sz * k }; };
  const clearance = (o, x, z) => { const c = closest(o, x, z); return Math.hypot(x - c.x, z - c.z) - o.r; };

  /** Watches one moving position frame by frame. */
  function watcher(pos, r) {
    let lastX = pos.x, lastZ = pos.z, lastDir = null, lastSharp = -9, t = 0;
    let seenDir = null, seenSharp = -9;
    return (step, push) => {
      t += DT;
      const dx = pos.x - lastX, dz = pos.z - lastZ, m = Math.hypot(dx, dz);
      lastX = pos.x; lastZ = pos.z;
      r.frames++;
      if (step > 0 && m > step * 1.4 + 1e-4) r.pops++;
      if (m > 1e-4) {
        const dir = Math.atan2(dx, dz);
        if (lastDir !== null) {
          const turn = Math.abs(Math.atan2(Math.sin(dir - lastDir), Math.cos(dir - lastDir)));
          if (turn > SHARP) {
            r.sharp++;
            if (t - lastSharp < JITTER_WINDOW) r.jitter++;
            lastSharp = t;
          }
        }
        lastDir = dir;
        if (m > 0.015) {
          if (seenDir !== null && Math.abs(Math.atan2(Math.sin(dir - seenDir), Math.cos(dir - seenDir))) > SHARP) {
            if (t - seenSharp < JITTER_WINDOW) r.shuffle++;
            seenSharp = t;
          }
          seenDir = dir;
        }
        if (push && (dx * push.x + dz * push.z) / m < -0.1) r.against++;
      }
      for (const o of vfx.arena.obstacles) if (clearance(o, pos.x, pos.z) < 0.5 - 0.04) { r.inCover++; break; }
      return m;
    };
  }

  const blank = () => ({ walks: 0, frames: 0, jitter: 0, shuffle: 0, sharp: 0, against: 0, inCover: 0, pops: 0, stuck: 0, arrived: 0, failed: 0, onCover: 0, onCoverDone: 0, ratio: 0, progress: 0, maxTurn: 0, timeouts: 0, secs: 0, stopped: 0, checks: 0 });

  async function open(id, mode = 'play') {
    const d = vfx.duel;
    d.hazardsOn = false;
    vfx.view.paused = true;
    d.arenaChoice = id;
    vfx.heroPickCtrl.setValue('Lyra');
    d.opponentChoice = 'Kaia';
    if (!d.on) vfx.setDuel(true, mode);
    d.opponentChoice = 'Kaia';
    d.start(mode);
    if (mode === 'play') d.think = 1e9;
    for (let k = 0; k < 2000 && !vfx.heroMode.figure?.figure?.loaded; k++) await tick();
    return d;
  }
  const freePoint = (R) => { for (let i = 0; i < 500; i++) { const t = R() * 6.283, r = Math.sqrt(R()) * 10.8, x = Math.sin(t) * r, z = 7 + Math.cos(t) * r; if (vfx.arena.obstacles.every((o) => clearance(o, x, z) > 0.75)) return { x, z }; } return { x: 0, z: 13 }; };
  const yawOf = () => vfx.heroMode.figure?.figure?.root?.rotation.y;
  function turnWatch(r) {
    let last = yawOf();
    return () => {
      const y = yawOf();
      if (y === undefined) return;
      if (last !== undefined) r.maxTurn = Math.max(r.maxTurn, Math.abs(Math.atan2(Math.sin(y - last), Math.cos(y - last))));
      last = y;
    };
  }
  function place(p, x, z) {
    const hm = vfx.heroMode;
    p.set(x, 0, z);
    hm.moveTo = null;
    hm.steering = null;
    hm.pending = null;
    hm.rooted = 0;
    vfx.duel.playerHp = vfx.duel.playerMax;
    vfx.arena.nav.forget(vfx.arena.caster.group);
    for (let i = 0; i < 2; i++) vfx.step(DT);
  }

  const SUITES = {
    /** Clicks on open ground, and every fifth one on cover. */
    async click(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, p = vfx.arena.caster.group.position, R = rng(seed ^ hash(id));
      for (let i = 0; i < 40; i++) {
        const s = freePoint(R), onCover = i % 5 === 4;
        let g = freePoint(R);
        if (onCover) { const o = vfx.arena.obstacles[Math.floor(R() * vfx.arena.obstacles.length)]; g = { x: (o.ax + o.bx) / 2, z: (o.az + o.bz) / 2 }; }
        place(p, s.x, s.z);
        hm.moveTo = new p.constructor(g.x, 0, g.z);
        const w = watcher(p, r), tw = turnWatch(r);
        let f = 0, len = 0;
        while (hm.moveTo && f < 900) { vfx.step(DT); f++; len += w(hm.speed * DT); tw(); }
        r.walks++;
        if (onCover) { r.onCover++; if (!hm.moveTo) r.onCoverDone++; }
        else if (!hm.moveTo && Math.hypot(p.x - g.x, p.z - g.z) < 0.2) { r.arrived++; r.ratio += len / Math.max(0.5, Math.hypot(s.x - g.x, s.z - g.z)); }
        else r.failed++;
        hm.moveTo = null;
        await tick();
      }
    },
    /** The stick held one way from random spots. */
    async stick(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, p = vfx.arena.caster.group.position, R = rng(seed ^ hash(id) ^ 0x51);
      for (let i = 0; i < 40; i++) {
        const s = freePoint(R), a = R() * 6.283, push = new p.constructor(Math.sin(a), 0, Math.cos(a));
        place(p, s.x, s.z);
        hm.steering = push.clone();
        const w = watcher(p, r), tw = turnWatch(r);
        let moved = 0;
        for (let f = 0; f < 150; f++) { vfx.step(DT); moved += w(hm.speed * DT, push); tw(); }
        r.walks++;
        r.progress += moved / (hm.speed * DT * 150);
        hm.steering = null; hm.moveTo = null;
        await tick();
      }
    },
    /** The stick pressed at every obstacle from eight sides, straight on and at angles: the hard case for sliding. */
    async cover(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, p = vfx.arena.caster.group.position, R = rng(seed ^ hash(id) ^ 0x77);
      const obstacles = vfx.arena.obstacles.slice();
      for (const o of obstacles) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * 6.283 + R() * 0.4, mid = { x: (o.ax + o.bx) / 2, z: (o.az + o.bz) / 2 };
          const reach = Math.hypot(o.bx - o.ax, o.bz - o.az) / 2 + o.r + 1.3;
          const x = mid.x + Math.sin(a) * reach, z = mid.z + Math.cos(a) * reach;
          if (Math.hypot(x, z - 7) > 10.8 || obstacles.some((q) => clearance(q, x, z) < 0.65)) continue;
          const c = closest(o, x, z);
          for (const off of [0, 0.35, -0.35, 0.8, -0.8, 1.2, -1.2]) {
            const h = Math.atan2(c.x - x, c.z - z) + off, push = new p.constructor(Math.sin(h), 0, Math.cos(h));
            place(p, x, z);
            hm.steering = push.clone();
            const w = watcher(p, r);
            let moved = 0;
            for (let f = 0; f < 110; f++) { vfx.step(DT); moved += w(hm.speed * DT, push); }
            r.walks++;
            r.progress += moved / (hm.speed * DT * 110);
            if (moved < hm.speed * DT * 110 * 0.1) r.stuck++;
            hm.steering = null; hm.moveTo = null;
          }
          await tick();
        }
      }
    },
    /** The dead zone: the thumb back at the middle of the stick must stop the hero. */
    async deadzone(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, p = vfx.arena.caster.group.position, R = rng(seed ^ hash(id) ^ 0x33);
      for (let i = 0; i < 10; i++) {
        const s = freePoint(R);
        place(p, s.x, s.z);
        hm.steer(30, 10, 1);
        for (let f = 0; f < 20; f++) vfx.step(DT);
        hm.steer(1, 1, 0.05);
        for (let f = 0; f < 3; f++) vfx.step(DT);
        const a = p.clone();
        for (let f = 0; f < 30; f++) vfx.step(DT);
        r.checks++;
        if (Math.hypot(p.x - a.x, p.z - a.z) < 0.02) r.stopped++;
        hm.stopSteer();
        await tick();
      }
    },
    /** A walk order that follows a target walking round the arena: the route must not flip. */
    async chase(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, p = vfx.arena.caster.group.position, R = rng(seed ^ hash(id) ^ 0x91);
      for (let i = 0; i < 10; i++) {
        const s = freePoint(R), a0 = R() * 6.283, dir = R() < 0.5 ? 1 : -1, rad = 3 + R() * 6;
        place(p, s.x, s.z);
        const w = watcher(p, r);
        for (let f = 0; f < 300; f++) {
          const a = a0 + dir * f * DT * 0.45, to = new p.constructor(Math.sin(a) * rad, 0, 7 + Math.cos(a) * rad);
          hm.moveTo = to;
          vfx.step(DT);
          w(hm.speed * DT);
        }
        r.walks++;
        hm.moveTo = null;
        await tick();
      }
    },
    /** Cover raised across a walk, and cover that falls: the hero must still get there. */
    async reroute(id, seed, r) {
      const d = await open(id), hm = vfx.heroMode, arena = vfx.arena, p = arena.caster.group.position, R = rng(seed ^ hash(id) ^ 0xa3);
      for (let i = 0; i < 12; i++) {
        const s = freePoint(R), g = freePoint(R);
        if (Math.hypot(s.x - g.x, s.z - g.z) < 6) continue;
        place(p, s.x, s.z);
        hm.moveTo = new p.constructor(g.x, 0, g.z);
        const w = watcher(p, r);
        let f = 0;
        for (; f < 30; f++) { vfx.step(DT); w(hm.speed * DT); }
        // A wall across the way, 2 m ahead (a spell's temporary obstacle).
        const n = Math.hypot(g.x - p.x, g.z - p.z), ux = (g.x - p.x) / n, uz = (g.z - p.z) / n, cx = p.x + ux * 2, cz = p.z + uz * 2;
        const list = arena.obstacles;
        const temp = { ax: cx - uz * 1.6, az: cz + ux * 1.6, bx: cx + uz * 1.6, bz: cz - ux * 1.6, r: 0.35, height: 2.3, kind: 'wall' };
        list.push(temp);
        while (hm.moveTo && f < 900) { vfx.step(DT); f++; w(hm.speed * DT); }
        r.walks++;
        if (!hm.moveTo && Math.hypot(p.x - g.x, p.z - g.z) < 0.4) r.arrived++; else r.failed++;
        list.splice(list.indexOf(temp), 1);
        hm.moveTo = null;
        for (let k = 0; k < 2; k++) vfx.step(DT);
        await tick();
      }
    },
    /** Whole AI fights at Normal: both heroes walk with the AI's rules. */
    async ai(id, seed, r) {
      const d = await open(id, 'run'), arena = vfx.arena;
      const pairs = [['Lyra', 'Brannoc'], ['Vitriol', 'Kaia'], ['Mortis', 'Isolde']];
      const { CPU_NORMAL } = await import('/src/cpuLevels.ts');
      for (const [a, b] of pairs) {
        for (let k = 0; k < 2; k++) {
          d.arenaChoice = id;
          d.cpuLevel = CPU_NORMAL;
          vfx.heroPickCtrl.setValue(a);
          d.opponentChoice = b;
          d.start('run');
          const hero = watcher(arena.caster.group.position, r);
          const foe = watcher(d.foe.group.position, r);
          let f = 0;
          while (!d.result && f < 7200) { vfx.step(DT); f++; hero(0); foe(0); }
          r.walks++;
          if (d.result) r.secs += d.result.seconds; else r.timeouts++;
          await tick();
        }
      }
    },
  };

  const state = { tasks: [], results: {}, done: 0, total: 0, running: false, post: null, error: null };
  window._walk = {
    start({ suites = Object.keys(SUITES), seeds = [1, 2, 3], arenas = ARENAS, post = null } = {}) {
      if (state.running) return 'already running';
      state.tasks = [];
      state.results = {};
      for (const suite of suites) for (const seed of seeds) for (const id of arenas) state.tasks.push({ suite, seed, id });
      state.total = state.tasks.length;
      state.done = 0;
      state.post = post;
      state.running = true;
      state.error = null;
      (async () => {
        try {
          while (state.tasks.length) {
            const t = state.tasks.shift();
            const key = `${t.suite} #${t.seed}`;
            const r = (state.results[key] = state.results[key] ?? blank());
            await SUITES[t.suite](t.id, t.seed, r);
            state.done++;
            await tick();
          }
        } catch (e) {
          state.error = String(e?.stack ?? e);
        }
        vfx.heroMode.moveTo = null;
        vfx.heroMode.steering = null;
        state.running = false;
        if (state.post) await fetch(state.post, { method: 'POST', body: JSON.stringify({ table: window._walk.table(), error: state.error }, null, 1) });
      })();
      return `started ${state.total} tasks`;
    },
    progress: () => ({ done: state.done, total: state.total, running: state.running, error: state.error }),
    table: () => Object.entries(state.results).map(([key, r]) => {
      const row = { run: key, walks: r.walks, jitter: r.jitter, shuffle: r.shuffle, against: r.against, inCover: r.inCover, pops: r.pops, frames: r.frames };
      if (r.arrived || r.failed) { row.arrived = r.arrived; row.failed = r.failed; }
      if (r.ratio) row.pathRatio = +(r.ratio / Math.max(1, r.arrived)).toFixed(3);
      if (r.onCover) row.onCover = `${r.onCoverDone}/${r.onCover}`;
      if (r.progress) row.way = +(r.progress / Math.max(1, r.walks)).toFixed(3);
      if (r.stuck) row.stuck = r.stuck;
      if (r.maxTurn) row.maxTurn = +r.maxTurn.toFixed(2);
      if (r.checks) row.stopped = `${r.stopped}/${r.checks}`;
      if (r.secs) { row.avgSecs = +(r.secs / Math.max(1, r.walks)).toFixed(1); row.timeouts = r.timeouts; }
      return row;
    }),
  };
})();
