// The small pieces: the enemy's HP in a trait (Nebet), facing (Lithea), a footprint trail (Arden), crossing a line and a strip
// that carries (Saga, Ostrel), an HP bar cut at given values (Ramet).
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech;
const { crosses, crossesCircle, stripStep, Trail, faces } = L.mech;
const out = {};

// The enemy's HP, both ways, through a fight.
L.duel('Lyra', 'Isolde', { trait: { barCuts: (t) => [Math.round(t.maxHp() / 3)] } });
let same = 0, n = 0;
L.step(8, (t) => {
  if (Math.round(t * 60) % 30) return;
  n++;
  same += d.heroRt.enemyHp() === a.hpOf(d.foe) && d.oppRt.enemyHp() === d.playerHp && d.heroRt.enemyMaxHp() === d.foeMax && d.oppRt.enemyMaxHp() === d.playerMax;
});
L.check("a trait reads the enemy's HP and max, both sides", same === n && n > 10, { same, n, hp: [d.playerHp, a.hpOf(d.foe)] });
// The bar cut at a third of Lyra's HP: drawn into her bar at the top (and over her head).
out.cuts = d.bars?.[0]?.chunks?.dataset?.cuts;
L.check('an HP bar cut at a given value', out.cuts === String(Math.round(d.playerMax / 3)), out.cuts);

// Facing: still figures turned by hand.
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.2);
const me = a.caster.group.position, f = d.foe.group.position;
me.set(5.4, 0, 12);
a.moveFoe(d.foe, L.v(5.4 - f.x, 4 - f.z));
d.foe.group.rotation.y = Math.atan2(me.x - f.x, me.z - f.z);
const facing = m.views.hero.faces('enemy', me, 70);
d.foe.group.rotation.y += Math.PI;
const away = m.views.hero.faces('enemy', me, 70);
d.foe.group.rotation.y -= Math.PI - (75 * Math.PI) / 180;
const side75 = m.views.hero.faces('enemy', me, 70);
L.check('facing: toward, away, 75 degrees off', facing && !away && !side75, { facing, away, side75 });
// A CPU faces where it walks: how often does a fighting CPU face its enemy?
L.duel('Lyra', 'Isolde');
let toward = 0, k = 0;
L.step(10, (t) => { if (t < 1.5) return; k++; toward += faces(d.foe.group.position, d.foe.group.rotation.y, a.caster.group.position, 70); });
out.cpuFacesItsEnemy = +(toward / k).toFixed(2);

// Lines and strips.
const P = (x, z) => ({ x, z });
L.check('crossing a line', crosses(P(0, 0), P(0, 2), P(-1, 1), P(1, 1)) && !crosses(P(0, 0), P(0, 0.9), P(-1, 1), P(1, 1)) && !crosses(P(-2, 1), P(2, 1), P(-1, 1), P(1, 1)), null);
L.check('crossing a circle', crossesCircle(P(0, 0), P(3, 0), P(0, 0), 2) && !crossesCircle(P(0, 0), P(1, 0), P(0, 0), 2), null);
L.duel('Lyra', 'Isolde', {
  still: true,
  trait: {
    // A river from (5.4, 2) to (5.4, 12), 2.5 m wide, carrying at 3 m/s: the enemy, where its walk is decided.
    victimTick(t, dt) { const e = t.enemy().group.position, s = stripStep(e, P(5.4, 2), P(5.4, 12), 2.5, 3, dt); if (s) t.carryEnemy(s.x, s.z); },
  },
});
L.step(0.2);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 3 - d.foe.group.position.z));
const z0 = d.foe.group.position.z;
L.step(2);
out.carried = +(d.foe.group.position.z - z0).toFixed(2);
L.check('a strip carries whoever stands on it', out.carried > 5.6 && out.carried < 6.2, out.carried);

// A trail: 4 m/s for 2 s, a stop, a jump, and the oldest prints fading after 4 s.
const tr = new Trail();
let t = 0, x = 0;
for (; t < 2; t += 1 / 60) { x += 4 / 60; tr.sample(t, x, 0); }
const walked = tr.prints.length;
for (; t < 3; t += 1 / 60) tr.sample(t, x, 0);
const still = tr.prints.length;
x += 6;
for (; t < 3.6; t += 1 / 60) { x += 4 / 60; tr.sample(t, x, 0); }
const gap = tr.prints.find((p) => p.gap);
for (; t < 7.5; t += 1 / 60) tr.sample(t, x, 0);
out.trail = { walked, still, gap: !!gap, left: tr.prints.length, scent: tr.scent().length };
// The sample that ends the walk still prints once.
L.check('a print every 0.25 s of walking, none standing', walked >= 7 && walked <= 8 && still - walked <= 1, out.trail);
L.check('a jump leaves a gap, and the scent starts after it', !!gap && out.trail.scent < tr.prints.length + 1, out.trail);
L.check('prints older than 4 s fade', out.trail.left <= 2, out.trail);
const tr2 = new Trail();
for (let s = 0, z = 0; s < 2; s += 1 / 60) { z += 4 / 60; tr2.sample(s, 0, z); }
out.along = +tr2.along(P(0, 0), P(0, 8)).toFixed(2);
L.check('how far a flight runs along the trail', out.along > 6.5 && tr2.along(P(3, 0), P(3, 8)) === 0, out.along);
return L.done(out);
