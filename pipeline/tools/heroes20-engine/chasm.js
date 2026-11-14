// One-sided ground (Itzel): `t.mech.chasm(obstacle, seconds)` is ground the enemy cannot walk across (a dash crosses), no wall to
// sight, to bolts or to its maker. Brannoc (a melee CPU) chases Lyra across a crack she made: he must go round it, and does.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech;
const { crosses } = L.mech;
L.duel('Lyra', 'Brannoc', { still: true });
L.step(0.2);
const me = a.caster.group.position;
me.set(5.4, 0, 12);
const f = d.foe.group.position;
a.moveFoe(d.foe, L.v(5.4 - f.x, 4 - f.z));
// A crack across his way, 8 m long and 1 m wide (an obstacle shape: a capsule).
const crack = { ax: 1.6, az: 8, bx: 9.6, bz: 8, r: 0.5, height: 0, kind: 'wall' };
m.views.hero.chasm(crack, 12);
const out = {};
L.check('it is no wall to sight', a.lineOfSight(f, me), null);
d.think = 0;
let crossed = 0, last = f.clone(), reached = -1;
L.step(9, (t) => {
  const now = d.foe.group.position;
  if (crosses(last, now, { x: crack.ax, z: crack.az }, { x: crack.bx, z: crack.bz })) crossed++;
  last = now.clone();
  if (reached < 0 && now.distanceTo(me) < 3) reached = t;
  me.set(5.4, 0, 12);
});
out.chase = { crossed, reached: +reached.toFixed(2), at: L.pos(d.foe) };
L.check('the CPU never walks across it', crossed === 0, out.chase);
L.check('and goes round it to reach her', reached > 0, out.chase);
out.shot = L.shot();
// Its maker walks across; a dash crosses it.
d.think = 1e9;
me.set(5.4, 0, 9.5);
for (let i = 0; i < 40; i++) { a.walk(L.v(0, -0.08)); L.step(1 / 60); }
L.check('its maker walks across', me.z < 7.2, +me.z.toFixed(2));
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 9.5 - d.foe.group.position.z));
a.moveFigure(d.foe, L.v(5.4, 6.2), 0.3);
L.step(0.5);
L.check('a dash crosses it', d.foe.group.position.z < 7.2, L.pos(d.foe));
return L.done(out);
