// Paste into the game page or the VFX tool page under the dev server (browser javascript tool), or run it headless with
// pipeline/tools/page-shots.py (pipeline/tools/tower-climbs.js). The autopilot climbs the week's Tower (src/tower/run.ts,
// `mode: 'run'`): the same run a person plays, with no fades and no waits, stepping time itself. It runs in the background
// (a browser call stops after about 45 s):
//
//   eval(await (await fetch('/pipeline/tools/tower-tool.js')).text());
//   _tower(['Lyra', 'Bram'], 2)                    // two climbs each of this week's Tower, at the balance AI's level
//   _tower(names, 1, { week: '2026-W47' })         // another week's Tower
//   _tower(names, 1, { level: 3 })                 // CPU level 3 (Normal) as a stand-in for a person's reactions
//   _tower(names, 1, { from: 9, boons: ['tw-edge', 'tw-edge'] })   // from a floor, with boons already taken
//   _tower(names, 1, { upTo: 12 })                 // stop once floor 12 is cleared
//   _tower.done()
//   _tower.show()                                  // per hero: the floor each climb ended on; per kind: cleared, seconds, health lost
//   _tower.floors()                                // the same per floor
//   _tower.errors()                                // errors in a run are bugs to fix; `stuck`: a floor that ran 5 minutes
//
// It measures how high the autopilot gets and what each floor costs it. It can't tell whether a floor is fun: a person has to play it.
(() => {
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let state = { done: true, climbs: [], err: null, errors: [], stuck: [] };
  window._tower = (heroes, reps = 2, opts = {}) => {
    if (!state.done) return 'already running';
    state = { done: false, climbs: [], err: null, errors: [], stuck: [] };
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
        let api, tower;
        if (window.game?.tower) {
          // The game page: its own climb.
          api = window.game.api;
          tower = window.game.tower;
        } else {
          // The tool page: a climb of its own on the tool's duel.
          const { TowerRun } = await import('/src/tower/run.ts');
          const { HERO_KITS } = await import('/src/heroes.ts');
          api = { arena: vfx.arena, heroMode: vfx.heroMode, duel: vfx.duel, kits: HERO_KITS, setHeroMode: vfx.setHeroMode, setKit: (n) => vfx.heroPickCtrl.setValue(n), step: vfx.step, view: vfx.view };
          tower = window._towerRun ??= new TowerRun(api, null, { onEnter() {}, onExit() {} });
          if (!vfx.duel.on) vfx.setDuel(true, 'run');
        }
        const { CPU_BALANCE, cpuLevel } = await import('/src/cpuLevels.ts');
        const d = api.duel;
        api.view.paused = true;
        d.pilotLevel = opts.level ? cpuLevel(opts.level) : CPU_BALANCE;
        for (const hero of heroes) {
          for (let r = 0; r < reps; r++) {
            now = `${hero} #${r + 1}`;
            const began = Date.now();
            await tower.start({ hero, mode: 'run', week: opts.week, from: opts.from });
            for (const id of opts.boons ?? []) tower.boons.add(id);
            let f = 0, since = 0, seen = 0, at = tower.floor, stuck = false;
            while (!tower.ended && f < 60 * 60 * 60) {
              simMs += 1000 / 60;
              api.step(1 / 60);
              tower.pump();
              f++;
              since++;
              if (tower.log.length !== seen || tower.floor !== at) { seen = tower.log.length; at = tower.floor; since = 0; }
              now = `${hero} #${r + 1}, floor ${tower.floor}`;
              // A floor (or its landing) that runs five minutes is stuck: the climb is given up, and says so.
              if (since > 60 * 300) { stuck = true; break; }
              if (opts.upTo && tower.floor > opts.upTo) break;
              if (f % 1800 === 0) await tick();
            }
            if (stuck) state.stuck.push({ hero, floor: tower.floor, hp: Math.round(d.heroHp), goal: tower.now?.plan.kind });
            state.climbs.push({
              hero, floor: tower.floor, lives: tower.lives, stuck, ended: tower.ended, minutes: +(f / 3600).toFixed(1), wall: +((Date.now() - began) / 1000).toFixed(1),
              boons: tower.boons.list().map(([id, n]) => (n > 1 ? `${id} x${n}` : id)), log: tower.log.map((x) => ({ ...x })),
            });
            tower.exit();
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
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  const rows = (key) => {
    const by = {};
    for (const c of state.climbs) {
      for (const x of c.log) {
        const row = (by[key(x)] ??= { kind: x.kind, tries: 0, cleared: 0, secs: [], lost: [], by: {}, hits: {} });
        row.tries++;
        for (const [m, n] of Object.entries(x.hits ?? {})) row.hits[m] = (row.hits[m] || 0) + n;
        if (x.cleared) { row.cleared++; row.secs.push(x.seconds); row.lost.push(x.lost); } else if (x.by) row.by[x.by] = (row.by[x.by] || 0) + 1;
      }
    }
    return Object.fromEntries(Object.entries(by).map(([k, r]) => [k, {
      kind: r.kind, cleared: `${r.cleared}/${r.tries}`, seconds: Math.round(mean(r.secs)), lost: `${Math.round(mean(r.lost) * 100)}%`, fellTo: r.by,
      // How often each move hit, for each time the floor was tried.
      hits: Object.fromEntries(Object.entries(r.hits).map(([m, n]) => [m, +(n / r.tries).toFixed(1)])),
    }]));
  };
  window._tower.done = () => state.done;
  window._tower.errors = () => ({ err: state.err, errors: state.errors, stuck: state.stuck });
  window._tower.climbs = () => state.climbs;
  /** Per hero: the floor each climb ended on (it cleared one fewer). Per kind: floors cleared of those tried, seconds, and health lost on a cleared one. */
  window._tower.show = () => {
    const heroes = {};
    for (const c of state.climbs) (heroes[c.hero] ??= []).push(c.stuck ? `${c.floor} (stuck)` : c.ended ? c.floor : `${c.floor}+`);
    return { heroes, kinds: rows((x) => x.kind) };
  };
  window._tower.floors = () => rows((x) => x.n);
})();
