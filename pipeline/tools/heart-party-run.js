// The autopilot against the Heart of Noon in its party room (the Sunburst), with what the plain raid tool does not count: whether
// the floor turned and the hero rode it, how many sectors fell, how long the hero stood over the sun, which of the party's
// mechanics came and how they ended. One hero, the boss's HP for one (as `_raid` in raid-tool.js). The body of an async function
// for page-shots.py:
//
//   python pipeline/tools/page-shots.py pipeline/tools/heart-party-run.js <out folder> --timeout 1500 --port 5208
//
// `window.HEART_RUN = { bands: [5, 10], heroes: ['Lyra'], reps: 2 }` before it changes what it runs (else every band, six heroes, one fight each).
const opts = window.HEART_RUN ?? {};
const bands = opts.bands ?? [5, 10, 20, 40], heroes = opts.heroes ?? ['Lyra', 'Kaia', 'Sefu', 'Isolde', 'Brannoc', 'Bram'], reps = opts.reps ?? 1;
const { BOSSES } = await import('/src/raid/bosses.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const { RunUpgrades } = await import('/src/raid/upgrades.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const { heartFight } = await import('/src/raid/heart.ts');
const { burstFloor, ringOf } = await import('/src/arenas/sunburst.ts');
const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
const d = vfx.duel, def = BOSSES.heart;
let simMs = performance.now();
performance.now = () => simMs;
const errors = [], logError = console.error;
let now = '';
console.error = (...a) => { if (errors.length < 20) errors.push(`${now}: ${a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 300)}`); logError(...a); };
const out = {};
try {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  d.pilotLevel = CPU_BALANCE;
  for (const band of bands) {
    const row = (out[`band ${band}`] = { fights: 0, clears: 0, seconds: 0, reached: [0, 0, 0], turned: 0, rodeSeconds: 0, sectors: 0, overSunSeconds: 0, never: 0, kneels: 0, hits: {}, killedBy: {}, moves: {} });
    for (const hero of heroes) {
      vfx.heroPickCtrl.setValue(hero);
      for (let r = 0; r < reps; r++) {
        now = `band ${band} ${hero}`;
        const link = new LocalLink(def, 1), cast0 = link.cast.bind(link);
        link.cast = (c) => { if (c.step === 0) row.moves[c.move] = (row.moves[c.move] ?? 0) + 1; return cast0(c); };
        d.startBoss({ def, link, seed: `${hero}-${band}-${r}`, mode: 'run', tier: 1, upgrades: new RunUpgrades(), band });
        const me = vfx.arena.caster.group.position;
        let f = 0, rode = 0, over = 0, fell = 0;
        while (!d.result && f < 60 * 420) {
          simMs += 1000 / 60;
          vfx.step(1 / 60);
          f++;
          if (f % 15) continue;
          // Carried: on a ring while it moves. Over the sun: on a sector that has fallen.
          if (heartFight.turning && heartFight.clock > heartFight.warm && heartFight.clock < heartFight.restAt && ringOf(me.x, me.z)) rode += 0.25;
          if (burstFloor.lost(me.x, me.z)) over += 0.25;
          fell = Math.max(fell, burstFloor.fallen);
        }
        row.fights++;
        if (!d.result) { row.never++; await tick(); continue; }
        const b = d.result.boss;
        row.seconds += d.result.seconds;
        row.reached[b?.phase ?? 0]++;
        row.kneels += b?.kneels ?? 0;
        row.turned += heartFight.turning ? 1 : 0;
        row.rodeSeconds += rode;
        row.overSunSeconds += over;
        row.sectors += fell;
        if (d.result.winner === hero) row.clears++;
        else if (b?.killedBy) row.killedBy[b.killedBy] = (row.killedBy[b.killedBy] ?? 0) + 1;
        for (const [k, v] of Object.entries(b?.hits ?? {})) row.hits[k] = (row.hits[k] ?? 0) + v;
        await tick();
      }
    }
    row.seconds = row.fights - row.never ? Math.round(row.seconds / (row.fights - row.never)) : 0;
    row.rodeSeconds = +(row.rodeSeconds / row.fights).toFixed(1);
    row.overSunSeconds = +(row.overSunSeconds / row.fights).toFixed(2);
    row.sectors = +(row.sectors / row.fights).toFixed(1);
  }
} catch (e) {
  errors.push(String(e?.stack ?? e));
}
delete performance.now;
console.error = logError;
def.resize?.(2);
return { errors, ...out };
