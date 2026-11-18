// What the CPU is told: `Trait.enemyAvoid` (ground the enemy CPU plans round, and with `sight` believes it cannot see through:
// a mirage), `Trait.castOrigin` (a slot cast from somewhere else: Lian's kite, the reach is from there), `Trait.aiHoldAttack`.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, hm = L.hm;
const { crosses } = L.mech;
const out = {};

// 1. Brannoc chases Lyra across a curtain of hers that is no wall at all: he walks round it, as told.
const curtain = { ax: 1.6, az: 8, bx: 9.6, bz: 8, r: 0.4, height: 2, kind: 'wall' };
L.duel('Lyra', 'Brannoc', { still: true, trait: { enemyAvoid: () => [{ o: curtain }] } });
L.step(0.2);
const me = a.caster.group.position;
me.set(5.4, 0, 12);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 4 - d.foe.group.position.z));
d.think = 0;
let crossed = 0, last = d.foe.group.position.clone(), reached = -1;
L.step(9, (t) => {
  const now = d.foe.group.position;
  if (crosses(last, now, { x: curtain.ax, z: curtain.az }, { x: curtain.bx, z: curtain.bz })) crossed++;
  last = now.clone();
  if (reached < 0 && now.distanceTo(me) < 3) reached = t;
  me.set(5.4, 0, 12);
});
out.avoid = { crossed, reached: +reached.toFixed(2) };
L.check('a CPU walks round what the enemy asks it to', crossed === 0 && reached > 0, out.avoid);

// 2. A mirage: no obstacle, but the CPU believes it blocks its sight.
const mirage = { ax: 4.4, az: 8, bx: 6.4, bz: 8, r: 0.4, height: 3, kind: 'wall' };
L.duel('Lyra', 'Isolde', { still: true, trait: { enemyAvoid: () => [{ o: mirage, sight: true }] } });
L.step(0.2);
me.set(5.4, 0, 12);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 4 - d.foe.group.position.z));
out.mirage = { realSight: a.lineOfSight(d.foe.group.position, me), cpuSees: d.aiSees(d.foe.group.position, me, d.heroRt) };
L.check('a CPU takes a mirage for cover', out.mirage.realSight && !out.mirage.cpuSees, out.mirage);

// 3. A cast origin: Lyra's Q cast from a point 2 m from Isolde, while Lyra stands 18 m away.
const origin = { x: 5.4, z: -1 };
L.duel('Lyra', 'Isolde', { still: true, trait: { castOrigin: (t, slot) => (slot === 0 ? origin : null) } });
L.step(0.2);
me.set(5.4, 0, 15.6);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 1 - d.foe.group.position.z));
const far = me.distanceTo(d.foe.group.position);
const dist = d.reachFrom(d.heroRt, d.foe.group.position);
const kit = hm.currentKit;
const onlyQ = (i) => i !== 0;
const withOrigin = d.pickSpell(kit, onlyQ, far, 1, true, false, far, false, 1, { parry: false, barrier: false }, undefined, dist);
const without = d.pickSpell(kit, onlyQ, far, 1, true, false, far, false, 1, { parry: false, barrier: false });
out.origin = { far: +far.toFixed(1), fromOrigin: +dist(0).toFixed(1), withOrigin: withOrigin?.i ?? null, without: without?.i ?? null, aimFrom: L.pos({ group: { position: hm.originOf(0, me) } }) };
L.check('the CPU casts a slot when its origin is in reach', withOrigin?.i === 0 && without === null, out.origin);
L.check('the aim and reach of the player are measured from it', out.origin.aimFrom[0] === origin.x && out.origin.aimFrom[1] === origin.z, out.origin.aimFrom);

// 4. aiHoldAttack: a CPU told to hold its attacks lands none.
L.duel('Lyra', 'Brannoc', { foeTrait: { aiHoldAttack: () => true } });
let attacks = 0;
const hit0 = d.resolve;
d.resolve = function (dealer, victim, opts, mods, kind, ...r) { if (dealer === 'opponent' && kind === 'attack') attacks++; return hit0.call(this, dealer, victim, opts, mods, kind, ...r); };
L.step(10);
d.resolve = hit0;
L.check('a CPU holding its attacks makes none', attacks === 0, attacks);
return L.done(out);
