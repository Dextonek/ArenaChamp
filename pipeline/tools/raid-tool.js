// Paste into the VFX tool page under the dev server (browser javascript tool). Runs the autopilot against a boss, in the
// background (a browser call stops after about 45 s), stepping time itself:
//
//   eval(await (await fetch('/pipeline/tools/raid-tool.js')).text());
//   _raid(['Lyra', 'Bram'], 4)              // 4 fights each against the Sun Warden at the balance AI's level
//   _raid(names, 2, { level: 3 })           // CPU level 3 (Normal) as a stand-in for a person's reactions
//   _raid(names, 1, { boss: 'ash', tier: 2, upgrades: ['glass', 'stubborn'] })   // the second boss, a higher tier, upgrades on
//   _raid.show()                            // per hero: clears, seconds, boss HP left, damage per second, which move killed
//   _raid.errors()                          // errors in a run are bugs to fix, with the fight they came from
//
// It can't tell whether the fight is fun: a person has to play it.
(() => {
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let state = { done: true, rows: {}, err: null, errors: [], none: [] };
  window._raid = (heroes, reps = 4, opts = {}) => {
    if (!state.done) return 'already running';
    state = { done: false, rows: {}, err: null, errors: [], none: [] };
    (async () => {
      const d = vfx.duel;
      let simMs = performance.now();
      performance.now = () => simMs;
      const logError = console.error;
      let now = '';
      console.error = (...a) => {
        if (state.errors.length < 20) state.errors.push(`${now}: ${a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)}`);
        logError(...a);
      };
      try {
        const { BOSSES } = await import('/src/raid/bosses.ts');
        const { LocalLink } = await import('/src/raid/link.ts');
        const { RunUpgrades } = await import('/src/raid/upgrades.ts');
        const { CPU_BALANCE, cpuLevel } = await import('/src/cpuLevels.ts');
        const def = BOSSES[opts.boss ?? 'sun'];
        vfx.view.paused = true;
        if (!d.on) vfx.setDuel(true, 'run');
        d.pilotLevel = opts.level ? cpuLevel(opts.level) : CPU_BALANCE;
        for (const hero of heroes) {
          const row = (state.rows[hero] = { w: 0, n: 0, secs: 0, left: 0, killedBy: {}, hits: {}, kneels: 0, dealt: 0, phase: [0, 0, 0] });
          vfx.heroPickCtrl.setValue(hero);
          for (let r = 0; r < reps; r++) {
            now = hero;
            const link = new LocalLink(def, opts.tier ?? 1);
            const upgrades = new RunUpgrades();
            for (const id of opts.upgrades ?? []) upgrades.add(id);
            d.startBoss({ def, link, seed: `${hero}-${r}-${Math.random()}`, mode: 'run', tier: opts.tier ?? 1, upgrades });
            const foe = d.foe;
            let dealt = 0;
            const count = vfx.arena.onFoeDamage;
            vfx.arena.onFoeDamage = (t, n) => { dealt += n; count(t, n); };
            let f = 0;
            while (!d.result && f < 60 * 420) { simMs += 1000 / 60; vfx.step(1 / 60); f++; }
            if (d.result) {
              const b = d.result.boss;
              row.n++;
              row.secs += d.result.seconds;
              row.dealt += dealt;
              row.kneels += b?.kneels ?? 0;
              row.phase[b?.phase ?? 0]++;
              if (d.result.winner === hero) row.w++;
              else {
                row.left += vfx.arena.hpOf(foe) / link.maxHp;
                if (b?.killedBy) row.killedBy[b.killedBy] = (row.killedBy[b.killedBy] || 0) + 1;
              }
              for (const [k, v] of Object.entries(b?.hits ?? {})) row.hits[k] = (row.hits[k] || 0) + v;
            } else state.none.push({ hero, hp: Math.round(d.playerHp), boss: vfx.arena.hpOf(foe) });
            await tick();
          }
        }
      } catch (e) {
        state.err = String(e?.stack ?? e);
      }
      delete performance.now;
      console.error = logError;
      state.done = true;
    })();
    return 'started';
  };
  window._raid.done = () => state.done;
  window._raid.errors = () => ({ err: state.err, errors: state.errors, none: state.none });
  window._raid.show = () => Object.fromEntries(Object.entries(state.rows).map(([hero, r]) => [hero, {
    clears: `${r.w}/${r.n}`,
    seconds: r.n ? Math.round(r.secs / r.n) : 0,
    dps: r.secs ? Math.round(r.dealt / r.secs) : 0,
    leftOnLoss: r.n - r.w ? `${Math.round((r.left / (r.n - r.w)) * 100)}%` : '-',
    reached: r.phase.join('/'),
    kneels: r.n ? +(r.kneels / r.n).toFixed(1) : 0,
    killedBy: r.killedBy,
    hits: r.hits,
  }]));
})();
