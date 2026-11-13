// Paste into the VFX tool page (http://localhost:5194/, browser javascript tool). Stage 0 of the Tower's floors as worlds
// (pipeline/designs/tower-worlds-build.md, src/tower/world/): one walking zone of about 48 m radius with packs of keepers that
// appear when the hero comes near. The hero is under the player's control; the tool walks it by the engine's own orders
// (`heroMode.walkTo`, which finds its way round the cover with src/nav.ts) and steps the simulation with `vfx.step`.
//
//   eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
//   await _world({ floor: 1, hero: 'Lyra' })       // start the zone (mode: 'run' lets the duel's autopilot play the hero)
//   await _worldWalk(['market', 'caves', 'lighthouse', 'wreck', 'camp'])        // places by name, or [x, z] points
//   await _worldWalk([[0, 90]])                     // what the rim does: where the hero ends (opts: maxSeconds, heal: keep the hero at full health)
//   _world.status()                                 // packs, hero, falls, the log of what happened
//   _world.packs(false)                             // packs off (a bare zone); _world.wakeAll() forces them awake
//   await _worldBench('zone', 240)                  // CPU time of vfx.step + vfx.render() per frame, GL draw calls, triangles
//   _worldBench.duel()                              // an ordinary duel arena with two heroes, the baseline
//   _worldPath()                                    // the time of one path across the whole zone
//
// The numbers are CPU time per frame on this machine (the page's JavaScript and the GL calls it makes), with and without a
// gl.finish() after the render so the GPU's share shows too. They are not a frame rate on a phone.
(() => {
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let api = null, mod = null, world = null;
  const gl = document.querySelector('#app canvas')?.getContext('webgl2');

  // GL counters: draw calls and triangles, summed over every pass of a frame (shadows, the sea, post).
  const counts = { calls: 0, tris: 0 };
  if (!window.__glCounted) {
    window.__glCounted = true;
    const P = WebGL2RenderingContext.prototype;
    const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
    for (const [name, nIdx, instIdx] of [['drawElements', 1, -1], ['drawArrays', 2, -1], ['drawElementsInstanced', 1, 4], ['drawArraysInstanced', 2, 3], ['drawRangeElements', 3, -1]]) {
      const orig = P[name];
      P[name] = function (...a) {
        const c = window.__glCounts;
        if (c) { c.calls++; c.tris += tri(a[0], a[nIdx]) * (instIdx >= 0 ? a[instIdx] : 1); }
        return orig.apply(this, a);
      };
    }
  }
  window.__glCounts = counts;

  const sorted = (xs) => xs.slice().sort((a, b) => a - b);
  const median = (xs) => sorted(xs)[Math.floor(xs.length / 2)] ?? 0;
  const r2 = (x) => +x.toFixed(2);

  async function setup() {
    if (!mod) {
      mod = { world: await import('/src/tower/world/world.ts'), zone: await import('/src/tower/world/zone.ts'), heroes: await import('/src/heroes.ts') };
    }
    api = { arena: vfx.arena, heroMode: vfx.heroMode, duel: vfx.duel, kits: mod.heroes.HERO_KITS, setHeroMode: vfx.setHeroMode, setKit: (n) => vfx.heroPickCtrl.setValue(n), step: vfx.step, view: vfx.view };
  }

  const spot = (p) => {
    if (typeof p === 'string') return { ...mod.zone.PLACES[p].stand };
    return Array.isArray(p) ? { x: p[0], z: p[1] } : p;
  };

  /** Starts the zone. Returns what it is. */
  window._world = async (o = {}) => {
    await setup();
    api.view.paused = true;
    if (world) { world = null; }
    world = mod.world.startWorld(api, { hero: o.hero ?? 'Lyra', mode: o.mode ?? 'play' });
    // The autopilot's camera is fixed on the arena's middle; a zone this wide has to follow the hero.
    if (o.mode === 'run') api.heroMode.focus = null;
    api.heroMode.snapCameraNow();
    for (let i = 0; i < 10; i++) api.step(1 / 60);
    window._worldState = world;
    return { ok: true, floor: o.floor ?? 1, hero: o.hero ?? 'Lyra', packs: world.packs.map((p) => `${p.id}:${p.total}`), ring: mod.zone.ZONE_R, cover: mod.zone.ZONE_COVER.length };
  };
  window._world.status = () => ({
    clock: r2(world.clock), hero: { x: r2(api.arena.caster.group.position.x), z: r2(api.arena.caster.group.position.z), hp: Math.round(api.duel.heroHp), max: Math.round(api.duel.heroMax) },
    falls: world.falls, over: !!api.duel.over, packs: world.packs.map((p) => ({ id: p.id, state: p.state, left: p.left, total: p.total, seen: { ...p.seen } })),
    liveUnits: api.arena.summons.alive('opponent').length, log: world.log.slice(-30),
  });
  window._world.packs = (on) => world.setPacks(on);
  window._world.wakeAll = () => world.wakeAll();
  window._world.go = (x, z) => { api.arena.caster.group.position.set(x, 0, z); api.heroMode.halt(); api.heroMode.snapCameraNow(); };
  window._world.place = (name) => mod.zone.PLACES[name];

  /** Walks the hero through `points`, one after the other, by walk orders, stepping the simulation. */
  window._worldWalk = async (points, opts = {}) => {
    if (!world) throw new Error('_world() first');
    const hm = api.heroMode, hero = api.arena.caster.group.position, maxSec = opts.maxSeconds ?? 90;
    api.view.paused = true;
    const out = { legs: [], events: [], falls: 0, unitStuck: [], minHp: api.duel.heroHp, seconds: 0 };
    const log0 = world.log.length, falls0 = world.falls;
    const lastUnit = new Map();
    for (const raw of points) {
      const to = spot(raw), t0 = performance.now();
      hm.walkTo(to.x, to.z);
      let f = 0, still = 0, result = 'timeout';
      const last = hero.clone(), start = hero.clone(), f0 = world.falls;
      while (f < maxSec * 60) {
        api.step(1 / 60);
        f++;
        out.minHp = Math.min(out.minHp, api.duel.heroHp);
        if (opts.heal && api.duel.heroHp > 0) api.duel.setPlayerHp(api.duel.heroMax);
        if (world.falls !== f0) { result = 'fell'; break; }
        const d = Math.hypot(hero.x - to.x, hero.z - to.z);
        if (d < 1) { result = 'reached'; break; }
        if (f % 30 === 0) {
          still = hero.distanceTo(last) < 0.1 ? still + 1 : 0;
          last.copy(hero);
          // The walk order was given up (nothing moves it) or the order ended short of the spot (it lay in cover, or past the rim).
          if (!hm.moveTo && d >= 1) { result = d < 3 ? 'ended near' : 'ended far'; break; }
          if (still >= 4) { result = 'stuck'; break; }
        }
        // Units that chase and do not move: a unit awake, far from the hero, that has stayed put for two seconds.
        if (f % 120 === 0) {
          for (const p of world.packs) {
            if (p.state !== 'awake') continue;
            for (const u of p.units) {
              const prev = lastUnit.get(u);
              if (prev && Math.hypot(u.pos.x - prev.x, u.pos.z - prev.z) < 0.1 && Math.hypot(u.pos.x - hero.x, u.pos.z - hero.z) > 3) out.unitStuck.push({ pack: p.id, x: r2(u.pos.x), z: r2(u.pos.z), t: r2(world.clock) });
              lastUnit.set(u, u.pos.clone());
            }
          }
        }
        if (f % 600 === 0) await tick();
      }
      out.legs.push({ to: typeof raw === 'string' ? raw : [r2(to.x), r2(to.z)], result, seconds: r2(f / 60), from: [r2(start.x), r2(start.z)], at: [r2(hero.x), r2(hero.z)], off: r2(Math.hypot(hero.x - to.x, hero.z - to.z)), radius: r2(Math.hypot(hero.x, hero.z - 7)), wallMs: r2(performance.now() - t0) });
      out.seconds += f / 60;
      if (result === 'fell') {
        // The hero lies, then stands at the camp: let that happen, then go on.
        for (let i = 0; i < 150; i++) api.step(1 / 60);
      }
    }
    out.falls = world.falls - falls0;
    out.events = world.log.slice(log0);
    out.seconds = r2(out.seconds);
    out.unitStuck = out.unitStuck.slice(0, 10);
    return out;
  };

  /** Every pack that is not asleep or cleared, how many units live. */
  const mix = () => world.packs.map((p) => `${p.id}:${p.state}`).join(' ');

  /**
   * CPU time per frame of `frames` frames of vfx.step plus vfx.render(), three times if `runs` is 3: for each run the median, the
   * mean and the worst of the frame, and the same with gl.finish() after the render. Draw calls and triangles are per frame.
   */
  window._worldBench = async (label, frames = 240, opts = {}) => {
    const runs = [];
    for (let r = 0; r < (opts.runs ?? 3); r++) {
      const step = [], render = [], whole = [], fin = [], calls = [], tris = [];
      for (let i = 0; i < frames; i++) {
        if (opts.before) opts.before(i);
        window.__glCounts = { calls: 0, tris: 0 };
        const t0 = performance.now();
        api.step(1 / 60);
        const t1 = performance.now();
        vfx.render();
        const t2 = performance.now();
        gl?.finish();
        const t3 = performance.now();
        step.push(t1 - t0);
        render.push(t2 - t1);
        whole.push(t2 - t0);
        fin.push(t3 - t0);
        calls.push(window.__glCounts.calls);
        tris.push(window.__glCounts.tris);
        if (i % 120 === 119) await tick();
      }
      runs.push({ stepMed: r2(median(step)), renderMed: r2(median(render)), medMs: r2(median(whole)), meanMs: r2(whole.reduce((a, b) => a + b, 0) / whole.length), worstMs: r2(Math.max(...whole)), p95Ms: r2(sorted(whole)[Math.floor(frames * 0.95)]), finishMedMs: r2(median(fin)), calls: Math.round(median(calls)), tris: Math.round(median(tris)) });
    }
    window.__glCounts = counts;
    return { label, frames, runs, packs: world ? mix() : '' };
  };

  /** The baseline: an ordinary duel arena (the harbour's, 12 m) with two heroes, the player's and a CPU's, both on the autopilot. */
  window._worldBench.duel = async (o = {}) => {
    await setup();
    api.view.paused = true;
    if (api.duel.on) api.duel.stop();
    world = null;
    vfx.setHeroMode(true);
    vfx.heroPickCtrl.setValue('Lyra');
    vfx.duel.opponentChoice = 'Bram';
    vfx.duel.arenaChoice = o.arena ?? 'harbour';
    vfx.duel.start('run');
    for (let i = 0; i < 360; i++) api.step(1 / 60);
    return window._worldBench(`duel on ${o.arena ?? 'harbour'}`, o.frames ?? 240, o);
  };

  /** The time of one path across the zone, with a new walker each time (a plan from nothing), and the first one (the graph built). */
  window._worldPath = () => {
    const arena = api.arena, from = new (arena.caster.group.position.constructor)(), to = new (arena.caster.group.position.constructor)();
    const legs = [['camp', 'caves'], ['market', 'lighthouse'], ['wreck', 'caves'], ['camp', 'lighthouse'], ['lighthouse', 'market'], ['caves', 'wreck']];
    const out = [];
    for (const [a, b] of legs) {
      const A = mod.zone.PLACES[a], B = mod.zone.PLACES[b];
      from.set(A.x, 0, A.z);
      to.set(B.x, 0, B.z);
      const times = [];
      for (let k = 0; k < 3; k++) {
        const key = {};
        const t0 = performance.now();
        arena.route(key, from, to);
        times.push(performance.now() - t0);
      }
      // The path's length: walk the planned points.
      const key = {}, p = from.clone();
      let len = 0, steps = 0;
      while (steps++ < 400) {
        const s = arena.route(key, p, to);
        const d = Math.hypot(s.point.x - p.x, s.point.z - p.z);
        if (d < 0.05) break;
        const m = Math.min(d, 1.5);
        p.x += ((s.point.x - p.x) / d) * m;
        p.z += ((s.point.z - p.z) / d) * m;
        len += m;
        if (Math.hypot(to.x - p.x, to.z - p.z) < 0.3) break;
      }
      out.push({ leg: `${a} -> ${b}`, straight: r2(from.distanceTo(to)), walked: r2(len), msFirst3: times.map(r2) });
    }
    // The same path with the 50 pieces of cover, planned again each frame for a walker that moves (what a unit does).
    return out;
  };
})();
