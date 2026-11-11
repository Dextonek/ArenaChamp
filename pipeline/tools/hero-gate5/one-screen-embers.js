// On one screen (a CPU duel) the quill-end message must change nothing: count the embers that move after they were laid.
// Anka as the player's hero, then as the computer's hero.
const d = vfx.duel;
let simMs = performance.now();
performance.now = () => simMs;
const errors = [];
const logError = console.error;
console.error = (...a) => { if (errors.length < 30) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); logError(...a); };
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const ph = await import('/src/traits/phoenix.ts');
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
d.cpuLevel = CPU_BALANCE;
const out = [];
for (const [hero, foe] of [['Anka', 'Kaia'], ['Kaia', 'Anka'], ['Anka', 'Isolde'], ['Brannoc', 'Anka']]) {
  const rec = { hero, foe, fights: 0, laid: 0, quillEmbers: 0, moved: 0, biggest: 0, rises: 0, wins: 0 };
  for (let r = 0; r < 4; r++) {
    vfx.heroPickCtrl.setValue(hero);
    d.opponentChoice = foe;
    d.start('run');
    const seen = new Map();
    let f = 0, reborn = 0;
    while (!d.result && f < 60 * 120) {
      simMs += 1000 / 60; vfx.step(1 / 60); f++;
      const rt = hero === 'Anka' ? d.heroRt : d.oppRt;
      if (!rt) continue;
      if (rt.mem.reborn && !reborn) { reborn = 1; rec.rises++; }
      for (const e of ph.embersOf(rt.self())) {
        const key = e.seq, was = seen.get(key);
        if (!was) { seen.set(key, [e.x, e.z]); rec.laid++; if (e.aim) rec.quillEmbers++; }
        else {
          const m = Math.hypot(e.x - was[0], e.z - was[1]);
          if (m > 1e-6) { rec.moved++; rec.biggest = Math.max(rec.biggest, +m.toFixed(2)); seen.set(key, [e.x, e.z]); }
        }
      }
    }
    rec.fights++;
    if (d.result?.winner === 'Anka') rec.wins++;
  }
  out.push(rec);
}
delete performance.now;
console.error = logError;
return { out, errors };
