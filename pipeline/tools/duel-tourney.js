// Paste into the VFX tool page (browser javascript tool). Runs every hero against every other hero as AI vs AI
// duels (run-duel mode), stepping time itself so it works with the browser pane hidden, and tallies the results:
//
//   eval(await (await fetch('/pipeline/tools/duel-tourney.js')).text());
//   JSON.stringify(await _tourney(3))   // 3 fights per ordered pairing, every hero against every other
//   JSON.stringify(await _tourney(3, ['Vesper', 'Kaia']))   // only these heroes
//   -> { wins: { Vesper: n, ... } (out of 2 x (heroes - 1) x reps), h2h: { 'A vs B': { A: n, B: m } }, fights, avgSeconds,
//        avgWinnerHp, timeouts }
//
// A fight that is not over after 120 s counts as a timeout. Results vary run to run (the AI's strafe flips are
// random), so judge balance with 5+ fights per pairing.
window._tourney = async (reps = 3, names = null) => {
  // Every hero in the panel's hero dropdown (HERO_KITS), or the names passed in.
  const H = names ?? [...vfx.heroPickCtrl.$select.options].map((o) => o.textContent), d = vfx.duel, res = [];
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  for (const p of H) {
    vfx.heroPickCtrl.setValue(p);
    for (const o of H) {
      if (o === p) continue;
      for (let r = 0; r < reps; r++) {
        d.opponentChoice = o;
        d.start('run');
        for (let k = 0; k < 60 && !vfx.heroMode.figure?.figure?.loaded; k++) await new Promise((ok) => setTimeout(ok, 50));
        let f = 0;
        while (!d.result && f < 60 * 120) { vfx.step(1 / 60); f++; }
        const r2 = d.result;
        res.push(r2 ? [p, o, r2.winner, r2.seconds, r2.winner === p ? r2.playerHp : r2.opponentHp] : [p, o, 'timeout', 120, 0]);
      }
    }
  }
  const wins = {}, h2h = {};
  for (const h of H) wins[h] = 0;
  for (const [p, o, w] of res) {
    if (wins[w] !== undefined) wins[w]++;
    const k = [p, o].sort().join(' vs ');
    h2h[k] = h2h[k] || {};
    h2h[k][w] = (h2h[k][w] || 0) + 1;
  }
  return {
    wins, h2h, fights: res.length,
    avgSeconds: (res.reduce((a, r) => a + r[3], 0) / res.length).toFixed(1),
    avgWinnerHp: (res.reduce((a, r) => a + r[4], 0) / res.length).toFixed(0),
    timeouts: res.filter((r) => r[2] === 'timeout').length,
  };
};
