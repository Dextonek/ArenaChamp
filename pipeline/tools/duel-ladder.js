// Paste into the VFX tool page (browser javascript tool). Measures the CPU levels (src/cpuLevels.ts): the player's
// hero is the autopilot, which always plays Normal, and the opponent plays the level, in AI-vs-AI run duels. It steps
// time itself, so it works with the browser pane hidden.
//
//   eval(await (await fetch('/pipeline/tools/duel-ladder.js')).text());
//   await _ladder(5, [['Lyra', 'Brannoc'], ['Vitriol', 'Kaia']], 8)   // level 5: each pair both ways, 8 fights each way
//   _ladderSum()   // -> per level: fights, cpuWinPct (the opponent's), avgSecs, casts and dodges per fight
//
// Results add up across calls; `_ladderReset()` clears them. A browser javascript call stops after about 45 s, which
// is about 48 fights: run one or two pairs per call. Normal against the Normal autopilot should come out near 50%.
// Needs the dev server (`npm run dev`): it imports /src/cpuLevels.ts, which a built page does not serve.
window._ladderAcc = window._ladderAcc ?? {};
window._ladderReset = () => { window._ladderAcc = {}; };
window._ladder = async (level, pairs, reps = 8) => {
  const { cpuLevel } = await import('/src/cpuLevels.ts');
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  const d = vfx.duel, lv = cpuLevel(level);
  const a = (window._ladderAcc[lv.name] = window._ladderAcc[lv.name] ?? { fights: 0, cpuWins: 0, timeouts: 0, secs: 0, cpuCasts: 0, pilotCasts: 0, dodged: 0 });
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  // Some rules time themselves with performance.now(): during a stepped fight it must follow the fight's own clock.
  let simMs = performance.now();
  performance.now = () => simMs;
  for (const [x, y] of pairs) {
    for (const [p, o] of [[x, y], [y, x]]) {
      vfx.heroPickCtrl.setValue(p);
      for (let r = 0; r < reps; r++) {
        d.cpuLevel = lv;
        d.opponentChoice = o;
        d.start('run');
        for (let k = 0; k < 60 && !vfx.heroMode.figure?.loaded; k++) await tick();
        let f = 0;
        while (!d.result && f < 60 * 120) { simMs += 1000 / 60; vfx.step(1 / 60); f++; }
        const res = d.result;
        if (!res) { a.timeouts++; continue; }
        a.fights++;
        a.secs += res.seconds;
        a.cpuCasts += res.opponentCasts;
        a.pilotCasts += res.playerCasts;
        a.dodged += res.opponentDodges;
        if (res.winner === o) a.cpuWins++;
        await tick();
      }
    }
  }
  delete performance.now;
  return window._ladderSum();
};
window._ladderSum = () => Object.entries(window._ladderAcc).map(([name, a]) => ({
  level: name, fights: a.fights, timeouts: a.timeouts,
  cpuWinPct: Math.round((100 * a.cpuWins) / Math.max(1, a.fights)),
  avgSecs: +(a.secs / Math.max(1, a.fights)).toFixed(1),
  cpuCasts: +(a.cpuCasts / Math.max(1, a.fights)).toFixed(1),
  pilotCasts: +(a.pilotCasts / Math.max(1, a.fights)).toFixed(1),
  dodgedPerFight: +(a.dodged / Math.max(1, a.fights)).toFixed(2),
}));
