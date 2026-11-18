// Sleep (Vela): `t.mech.sleepEnemy(seconds)` puts the enemy hero to sleep: it neither walks, casts nor attacks; any damage wakes
// it, and the waking hit deals 25% more (30 at most). Two CPU duels, Lyra (the test trait) against Isolde:
//   A: Lyra lets her sleep (holds her spells and attacks while she sleeps): the sleep runs its 1.5 s.
//   B: Lyra fights on: her next hit wakes Isolde early and is the bigger for it.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const base = L.traits.TRAITS.Lyra;
const d = L.d, a = L.a, m = d.mech;
const wakes = [];
const wh = m.wakingHit.bind(m);
m.wakingHit = (side, dmg) => { const x = wh(side, dmg); if (x > 0 || m.asleep(side)) wakes.push({ t: +d.time.toFixed(2), side, dmg: +dmg.toFixed(1), extra: +x.toFixed(1) }); return x; };

function run(hold) {
  let at = -1;
  L.duel('Lyra', 'Isolde', {
    trait: {
      tick(t, dt) { base.tick?.(t, dt); if (at < 0 && t.time > 2.5 && t.mech.sleepEnemy(1.5)) at = t.time; },
      aiHold(t, slot, dist) { return (hold && t.mech.enemyAsleep()) || !!base.aiHold?.(t, slot, dist); },
      aiHoldAttack(t) { return hold && t.mech.enemyAsleep(); },
    },
  });
  L.step(2.4);
  // Up close and still, so the test reads the sleep and not the CPU's walk.
  const rec = { slept: 0, moved: 0, casts: 0, asleepFor: 0, stunned: true, shot: null };
  let from = null, casts0 = 0;
  L.step(4, () => {
    if (at < 0) return;
    if (!from) { from = d.foe.group.position.clone(); casts0 = d.stats.opponentCasts; }
    if (m.asleep('opponent')) {
      rec.asleepFor += 1 / 60;
      rec.moved = Math.max(rec.moved, d.foe.group.position.distanceTo(from));
      rec.casts = d.stats.opponentCasts - casts0;
      rec.stunned &&= a.statusOf(d.foe).stunned;
      if (!rec.shot && rec.asleepFor > 0.5) rec.shot = L.shot();
    }
  });
  rec.slept = at;
  rec.asleepFor = +rec.asleepFor.toFixed(2);
  rec.moved = +rec.moved.toFixed(2);
  return rec;
}

const A = run(true);
L.check('A: she falls asleep', A.slept > 0, A.slept);
L.check('A: left alone she sleeps the full 1.5 s', A.asleepFor >= 1.45 && A.asleepFor <= 1.55, A.asleepFor);
L.check('A: asleep she neither walks nor casts', A.moved < 0.05 && A.casts === 0 && A.stunned, A);
const wakesA = wakes.length;
const B = run(false);
const woke = wakes.slice(wakesA).find((w) => w.extra > 0);
L.check('B: a hit wakes her early', B.asleepFor > 0 && B.asleepFor < 1.45, B.asleepFor);
L.check('B: the waking hit deals 25% more, 30 at most', !!woke && Math.abs(woke.extra - Math.min(30, woke.dmg * 0.25)) < 0.1, woke);
return L.done({ A: { ...A, shot: undefined }, B: { ...B, shot: undefined }, wakes, sleepA: A.shot });
