// Paste into the VFX tool page under the dev server (browser javascript tool). Measures heroes against the benchmark
// foes in AI-vs-AI run duels at Normal, in the background (a browser call stops after about 45 s), stepping time itself:
//
//   eval(await (await fetch('/pipeline/tools/kit-balance.js')).text());
//   _balance(['Marin', 'Zephyr'], 16)   // 16 fights against each of the six foes
//   _balance.show()   // per hero: win %, fights, average seconds, wins per foe, damage per second by source, taken
//
// Noise is about ±14 points at 48 fights and ±10 at 96. A kit's target is 40-60%.
(() => {
  const FOES = ['Brannoc', 'Kaia', 'Isolde', 'Sirix', 'Cantor', 'Oblivion'];
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let state = { done: true, rows: {}, err: null, errors: [] };
  window._balance = (heroes, reps = 8, foes = FOES) => {
    if (!state.done) return 'already running';
    state = { done: false, rows: {}, err: null, errors: [] };
    (async () => {
      const d = vfx.duel, proto = Object.getPrototypeOf(d), resolve = proto.resolve;
      // Some rules time themselves with performance.now(): during a stepped fight it must follow the fight's own clock.
      let simMs = performance.now();
      performance.now = () => simMs;
      // Errors in a run are bugs to fix, not noise: keep the first few, with the fight they came from.
      const logError = console.error;
      let now = '';
      console.error = (...a) => {
        if (state.errors.length < 12) state.errors.push(`${now}: ${a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)}`);
        logError(...a);
      };
      try {
        const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
        d.hazardsInRuns = false;
        d.arenaChoice = 'random';
        vfx.view.paused = true;
        if (!d.on) vfx.setDuel(true, 'run');
        for (const hero of heroes) {
          const row = (state.rows[hero] = { w: 0, n: 0, secs: 0, by: {}, dealt: {}, taken: 0 });
          d.resolve = function (dealer, victim, opts, mods, kind, slot, cast) {
            const o = resolve.call(this, dealer, victim, opts, mods, kind, slot, cast);
            if (dealer === 'hero' && victim === this.foe && o.damage) {
              const k = kind === 'spell' ? 'QWER'[slot ?? 0] : kind;
              row.dealt[k] = (row.dealt[k] || 0) + o.damage;
            }
            if (dealer === 'opponent' && o.damage) row.taken += o.damage;
            return o;
          };
          vfx.heroPickCtrl.setValue(hero);
          for (const foe of foes) {
            row.by[foe] = 0;
            for (let r = 0; r < reps; r++) {
              d.cpuLevel = CPU_BALANCE;
              d.opponentChoice = foe;
              now = `${hero} vs ${foe}`;
              d.start('run');
              let f = 0;
              while (!d.result && f < 7200) { simMs += 1000 / 60; vfx.step(1 / 60); f++; }
              if (d.result) {
                row.n++;
                row.secs += d.result.seconds;
                if (d.result.winner === hero) { row.w++; row.by[foe]++; }
              }
              await tick();
            }
          }
        }
      } catch (e) {
        state.err = String(e?.stack ?? e);
      }
      delete d.resolve;
      delete performance.now;
      console.error = logError;
      state.done = true;
    })();
    return 'started';
  };
  window._balance.done = () => state.done;
  window._balance.show = () => ({
    done: state.done, err: state.err, errors: state.errors,
    rows: Object.fromEntries(Object.entries(state.rows).map(([k, r]) => [k, {
      pct: Math.round((100 * r.w) / Math.max(1, r.n)), n: r.n, avgSecs: +(r.secs / Math.max(1, r.n)).toFixed(1),
      byFoe: Object.values(r.by).join(' '),
      dps: Object.fromEntries(Object.entries(r.dealt).map(([s, v]) => [s, +(v / Math.max(1, r.secs)).toFixed(1)])),
      takenDps: +(r.taken / Math.max(1, r.secs)).toFixed(1),
    }])),
  });
})();
