// In the Raid (one screen) the quill-end message must change nothing either: count the embers that move after they were laid.
const d = vfx.duel;
let simMs = performance.now();
performance.now = () => simMs;
const errors = [];
const logError = console.error;
console.error = (...a) => { if (errors.length < 30) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); logError(...a); };
const { BOSSES } = await import('/src/raid/bosses.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const { RunUpgrades } = await import('/src/raid/upgrades.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const ph = await import('/src/traits/phoenix.ts');
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
d.pilotLevel = CPU_BALANCE;
vfx.heroPickCtrl.setValue('Anka');
const out = [];
for (const bossId of ['sun', 'ash']) {
  const rec = { boss: bossId, fights: 0, laid: 0, quillEmbers: 0, moved: 0, biggest: 0, offLine: 0, rises: 0 };
  for (let r = 0; r < 4; r++) {
    const def = BOSSES[bossId];
    d.startBoss({ def, link: new LocalLink(def, 1), seed: `probe5-${bossId}-${r}-${Math.random()}`, mode: 'run', tier: 1, upgrades: new RunUpgrades() });
    const seen = new Map();
    let f = 0, reborn = 0;
    while (!d.result && f < 60 * 420) {
      simMs += 1000 / 60; vfx.step(1 / 60); f++;
      const rt = d.heroRt;
      if (!rt) continue;
      if (rt.mem.reborn && !reborn) { reborn = 1; rec.rises++; }
      for (const e of ph.embersOf(rt.self())) {
        const was = seen.get(e.seq);
        if (!was) {
          seen.set(e.seq, [e.x, e.z]); rec.laid++;
          if (e.aim) {
            rec.quillEmbers++;
            // how far the ember lies from its quill's line
            const off = Math.abs((e.x - e.aim.fx) * e.aim.dz - (e.z - e.aim.fz) * e.aim.dx);
            rec.offLine = Math.max(rec.offLine, +off.toFixed(2));
          }
        } else {
          const m = Math.hypot(e.x - was[0], e.z - was[1]);
          if (m > 1e-6) { rec.moved++; rec.biggest = Math.max(rec.biggest, +m.toFixed(2)); seen.set(e.seq, [e.x, e.z]); }
        }
      }
    }
    rec.fights++;
  }
  out.push(rec);
}
delete performance.now;
console.error = logError;
return { out, errors };
