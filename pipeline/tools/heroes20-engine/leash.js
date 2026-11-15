// Leashes and a swap of places (Kessa). `t.mech.leashEnemy(r, seconds)` keeps the enemy within r of her as she moves; a dash
// breaks it when asked to (`breakOnDash`); `t.mech.swap(seconds)` trades the two heroes' places as her cast recorded them.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech;
const dist = () => a.caster.group.position.distanceTo(d.foe.group.position);
const out = {};

// 1. Isolde (a ranged CPU who keeps her distance) is leashed to Lyra at 4 m for 6 s, while both fight as the CPU does.
L.duel('Lyra', 'Isolde');
L.step(1.5);
let broke = null;
const l1 = m.views.hero.leashEnemy(4, 6, { slow: 0.3, onBreak: (why) => { broke = why; } });
let far = 0, atEnd = 0;
L.step(5.8, () => { const x = dist(); far = Math.max(far, x); if (x > 3.9) atEnd++; });
out.leashed = { far: +far.toFixed(2), framesAtTheEnd: atEnd };
// She walks too, and a knock may push past the end: the chain drags it back at 6 m/s, so it runs a step past at most.
L.check('a leashed CPU stays within 4 m of her for 6 s', far <= 4.25 && !!l1, out.leashed);
out.shot = L.shot();
L.step(0.4);
L.check('it ends at its time', broke === 'time' && !l1.alive, broke);

// 2. The player's own hero leashed the same way, kiting under the autopilot.
const l2 = m.leash('hero', () => ({ x: d.foe.group.position.x, z: d.foe.group.position.z }), 3.5, 5, { anchorSide: 'opponent' });
// A knock in the fight may push past the end for a moment; the chain drags back at 6 m/s.
far = 0;
let past = 0, frames = 0;
L.step(4.5, () => { const x = dist(); far = Math.max(far, x); frames++; if (x > 3.6) past++; });
out.heroLeashed = { far: +far.toFixed(2), pastTheEnd: +(past / frames).toFixed(3) };
L.check('the leash holds the player\'s own hero too', far <= 4.1 && past / frames < 0.1 && !!l2, out.heroLeashed);
l2.end();

// 3. A dash breaks a leash that says so; one that does not keeps the landing inside.
broke = null;
const l3 = m.views.hero.leashEnemy(4, 6, { breakOnDash: true, onBreak: (why) => { broke = why; } });
const p = d.foe.group.position, me = a.caster.group.position;
const away = p.clone().sub(me).setY(0).normalize();
a.moveFigure(d.foe, me.clone().addScaledVector(away, 8), 0.3);
L.step(0.5);
L.check('a dash breaks a breakable leash', broke === 'dash' && !l3.alive, broke);
const l4 = m.views.hero.leashEnemy(3, 6);
a.moveFigure(d.foe, me.clone().addScaledVector(away, 9), 0.3);
L.step(0.5);
L.check('a dash keeps inside one that holds', dist() <= 3.25, +dist().toFixed(2));
l4.end();

// 4. A swap of places, from the cast's own record: each hero lands where the other stood.
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.3);
const A = a.caster.group.position.clone(), B = d.foe.group.position.clone();
m.noteCast('hero', 2, A, B);
const ok = m.swap('hero', 0.35, 20);
L.step(0.6);
out.swap = { ok, hero: L.pos(a.caster), foe: L.pos(d.foe), was: { hero: [A.x, A.z], foe: [B.x, B.z] } };
L.check('a swap trades their places', ok && a.caster.group.position.distanceTo(B) < 0.15 && d.foe.group.position.distanceTo(A) < 0.15, out.swap);
L.check('a swap past its reach fails', !m.swap('hero', 0.35, 3), null);
// Her own chain holds through her swap (a dash breaks it; the swap is no dash).
let broken = null;
const chain = m.views.hero.leashEnemy(7, 6, { breakOnDash: true, onBreak: (why) => { broken = why; } });
m.noteCast('hero', 2, a.caster.group.position.clone(), d.foe.group.position.clone());
m.swap('hero', 0.35, 20);
L.step(0.6);
L.check('a swap does not break her own chain', chain.alive && broken === null, broken);
chain.end();
return L.done(out);
