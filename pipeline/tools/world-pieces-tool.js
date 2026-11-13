// Paste into the VFX tool page (http://localhost:5195/, browser javascript tool). The set pieces behind a floor's doors
// (pipeline/designs/tower-worlds-pieces.md, src/tower/world/pieces/): the ruler's fight, the gatekeeper's duel, the trial room and
// the rival's duel. The tool starts one by the engine's own `startPiece` and steps the simulation itself.
//
//   eval(await (await fetch('/pipeline/tools/world-pieces-tool.js')).text());
//   await _piece('ruler', { floor: 1, hero: 'Lyra', hp: 0.7, boons: ['tw-edge', 'tw-hide', 'tw-ward'], ally: 'Zephyr' })   // a person plays it
//   _piece.step(2)                                  // seconds of simulation (a hidden pane's frames are slow: step instead of waiting)
//   _piece.status()                                 // hero, boss, phase, the piece's notes, the outcome when it ended
//   _piece.out()                                    // { won, hp, seconds } once `done` was called, else null; `_piece.calls()` how often
//   await _piece('ruler', { floor: 1, hero: 'Lyra', mode: 'run' })   // the autopilot plays it (then _piece.step until _piece.out())
//   _pieceRun('ruler', { floor: 1, heroes: ['Lyra', 'Bram'], reps: 3, level: 3 })   // the autopilot fights it; runs in the background
//   await _pieceRun.wait()                          // waits (up to 40 s) for the run, then a short report
//   _pieceRun.done(); _pieceRun.show(); _pieceRun.errors()
//
// `_pieceRun` options: floor (1-5), heroes, reps, level (the autopilot's CPU level, 3 Normal stands in for a person), hp (a share, default
// 0.7), boons (ids, default three ordinary ones), ally, maxSeconds (default 240), both (also a second lap where the piece must be lost:
// not used here). It reports per heroes and in all: won of tried, seconds, health left on a win, what felled the hero, which moves hit.
(() => {
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let mod = null, api = null;
  let cur = null;
  let state = { done: true, tries: [], err: null, errors: [] };
  const DEFAULT_BOONS = ['tw-edge', 'tw-hide', 'tw-ward'];

  async function setup() {
    if (!mod) {
      mod = {
        pieces: await import('/src/tower/world/pieces/index.ts'), boons: await import('/src/tower/boons.ts'), heroes: await import('/src/heroes.ts'),
        cpu: await import('/src/cpuLevels.ts'),
      };
    }
    api = { arena: vfx.arena, heroMode: vfx.heroMode, duel: vfx.duel, kits: mod.heroes.HERO_KITS, setHeroMode: vfx.setHeroMode, setKit: (n) => vfx.heroPickCtrl.setValue(n), step: vfx.step, view: vfx.view };
  }

  const boonsOf = (ids) => {
    const b = new mod.boons.TowerBoons();
    for (const id of ids ?? DEFAULT_BOONS) b.add(id);
    return b;
  };

  /** Starts one piece. */
  window._piece = async (kind, o = {}) => {
    await setup();
    api.view.paused = true;
    if (cur?.handle && !cur.handle.over) cur.handle.cancel();
    const input = { floor: o.floor ?? 1, hero: o.hero ?? 'Lyra', hp: o.hp ?? 1, boons: boonsOf(o.boons), ally: o.ally, mode: o.mode ?? 'play' };
    cur = { kind, input, out: null, calls: 0, steps: 0 };
    api.duel.pilotLevel = mod.cpu.cpuLevel(o.level ?? 3);
    cur.handle = mod.pieces.startPiece(api, kind, input, (out) => { cur.calls++; cur.out = out; });
    if (input.mode === 'run') api.heroMode.focus = null;
    api.heroMode.snapCameraNow();
    for (let i = 0; i < 6; i++) api.step(1 / 60);
    return { ok: true, kind, floor: input.floor, hero: input.hero };
  };
  window._piece.step = (seconds = 1) => {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n && !cur.out; i++) {
      api.step(1 / 60);
      cur.steps++;
      cur.handle.pump();
    }
    return { out: cur.out, t: +(cur.steps / 60).toFixed(1) };
  };
  window._piece.out = () => cur?.out ?? null;
  window._piece.calls = () => cur?.calls ?? 0;
  window._piece.handle = () => cur?.handle;
  window._piece.go = (x, z) => { api.arena.caster.group.position.set(x, 0, z); api.heroMode.halt(); api.heroMode.snapCameraNow(); };
  window._piece.status = () => {
    const d = api.duel, p = api.arena.caster.group.position, b = d.boss;
    return {
      kind: cur?.kind, over: !!d.over, out: cur?.out ?? null, calls: cur?.calls ?? 0, t: +((cur?.steps ?? 0) / 60).toFixed(1),
      hero: { x: +p.x.toFixed(1), z: +p.z.toFixed(1), hp: Math.round(d.heroHp), max: Math.round(d.heroMax) },
      boss: b ? { left: +b.link.left.toFixed(2), phase: b.stats.phases, hits: { ...b.stats.hits }, kneels: b.stats.kneels } : null,
      notes: cur?.handle.report().note,
      units: { foes: api.arena.summons.alive('opponent').length, mine: api.arena.summons.alive('hero').length },
    };
  };

  /** The autopilot fights the piece: `reps` tries for each hero. */
  window._pieceRun = (kind, o = {}) => {
    if (!state.done) return 'already running';
    state = { done: false, tries: [], err: null, errors: [], kind, floor: o.floor ?? 1, level: o.level ?? 3 };
    (async () => {
      let simMs = performance.now();
      performance.now = () => simMs;
      const logError = console.error;
      let now = '';
      console.error = (...a) => {
        if (state.errors.length < 20) state.errors.push(`${now}: ${a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)}`);
        logError(...a);
      };
      const onError = (e) => { if (state.errors.length < 20) state.errors.push(`${now}: ${String(e.error?.stack ?? e.message).slice(0, 400)}`); };
      window.addEventListener('error', onError);
      try {
        await setup();
        api.view.paused = true;
        for (const hero of o.heroes ?? ['Lyra']) {
          for (let r = 0; r < (o.reps ?? 3); r++) {
            now = `${kind} floor ${state.floor}: ${hero} #${r + 1}`;
            const began = Date.now();
            api.duel.pilotLevel = mod.cpu.cpuLevel(o.level ?? 3);
            let calls = 0, out = null;
            const input = { floor: state.floor, hero, hp: o.hp ?? 0.7, boons: boonsOf(o.boons), ally: o.ally, mode: 'run' };
            const handle = mod.pieces.startPiece(api, kind, input, (x) => { calls++; out = x; });
            api.heroMode.focus = null;
            let f = 0;
            const max = (o.maxSeconds ?? 240) * 60;
            while (!out && f < max) {
              simMs += 1000 / 60;
              api.step(1 / 60);
              handle.pump();
              f++;
              if (f % 1800 === 0) await tick();
            }
            const rep = handle.report();
            const timedOut = !out;
            if (timedOut) handle.cancel();
            state.tries.push({ hero, won: !!out?.won, hp: out?.hp ?? 0, seconds: out?.seconds ?? +(f / 60).toFixed(1), calls, timedOut, by: rep.by, hits: rep.hits, phase: rep.phase, kneels: rep.kneels, wall: +((Date.now() - began) / 1000).toFixed(1), notes: rep.note.slice(0, 12) });
            await tick();
          }
        }
      } catch (e) {
        state.err = String(e?.stack ?? e);
      }
      window.removeEventListener('error', onError);
      delete performance.now;
      console.error = logError;
      state.done = true;
    })();
    return 'started';
  };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  window._pieceRun.done = () => state.done;
  window._pieceRun.errors = () => ({ err: state.err, errors: state.errors, badCalls: state.tries.filter((t) => t.calls !== 1 && !t.timedOut).length });
  window._pieceRun.tries = () => state.tries;
  /** Waits (at most `ms`) for the run to end, then says how it went in short: for a browser call that stops after about 45 s. */
  window._pieceRun.wait = async (ms = 40000) => {
    const t0 = Date.now();
    while (!state.done && Date.now() - t0 < ms) await new Promise((ok) => setTimeout(ok, 400));
    const s = window._pieceRun.show();
    return { done: state.done, ...s.all, heroes: Object.fromEntries(Object.entries(s.heroes).map(([h, r]) => [h, `${r.won} ${r.hpLeft}`])), errors: window._pieceRun.errors() };
  };
  window._pieceRun.show = () => {
    const by = {};
    for (const t of state.tries) (by[t.hero] ??= []).push(t);
    const row = (ts) => {
      const wins = ts.filter((t) => t.won), fell = {}, hits = {};
      for (const t of ts) {
        if (!t.won && t.by) fell[t.by] = (fell[t.by] || 0) + 1;
        for (const [m, n] of Object.entries(t.hits ?? {})) hits[m] = (hits[m] || 0) + n;
      }
      return {
        won: `${wins.length}/${ts.length}`, seconds: Math.round(mean(ts.map((t) => t.seconds))), hpLeft: `${Math.round(mean(wins.map((t) => t.hp)) * 100)}%`,
        fellTo: fell, timedOut: ts.filter((t) => t.timedOut).length, phases: +mean(ts.map((t) => t.phase)).toFixed(1), kneels: +mean(ts.map((t) => t.kneels)).toFixed(1),
        hits: Object.fromEntries(Object.entries(hits).map(([m, n]) => [m, +(n / ts.length).toFixed(1)])),
      };
    };
    return { kind: state.kind, floor: state.floor, level: state.level, all: row(state.tries), heroes: Object.fromEntries(Object.entries(by).map(([h, ts]) => [h, row(ts)])) };
  };
})();
