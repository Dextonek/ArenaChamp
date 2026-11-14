// The arena's cover broken (Tova): `t.mech.hurtCover(i, damage)` takes HP off one of the arena's own pillars or walls (150 a
// round); at 0 it falls and is gone for the round: sight, bolts and routes go through, and the next round stands it again.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech;
L.duel('Lyra', 'Isolde', { arena: 'temple', still: true });
L.step(0.2);
// The temple's middle pillar is cover 0, at (0, 7); the heroes stand on either side of it.
const me = a.caster.group.position;
me.set(0, 0, 12);
const f = d.foe.group.position;
a.moveFoe(d.foe, L.v(0 - f.x, 2 - f.z));
const pillar = d.currentArena.obstacles[0];
const out = { before: { sight: a.lineOfSight(me, f), standing: a.obstacles.includes(pillar) } };
const hp1 = m.views.hero.hurtCover(0, 100, { x: 0, z: 12 });
out.after100 = { hp: hp1, standing: a.obstacles.includes(pillar), sight: a.lineOfSight(me, f) };
const near = m.views.hero.coverNear({ x: 0, z: 9 }, 1.5);
const hp2 = m.views.hero.hurtCover(0, 60, { x: 0, z: 12 });
L.step(0.7);
out.after160 = { hp: hp2, standing: a.obstacles.includes(pillar), sight: a.lineOfSight(me, f), left: m.coverLeft(0) };
out.shot = L.shot();
L.check('cover blocks sight at first', !out.before.sight && out.before.standing, out.before);
L.check('100 of 150 leaves it standing', hp1 === 50 && out.after100.standing && !out.after100.sight, out.after100);
L.check('a blast finds the cover near it', near.includes(0), near);
L.check('at 0 it falls: sight goes through', hp2 === 0 && !out.after160.standing && out.after160.sight, out.after160);
L.check('a path goes straight through where it stood', a.pathClear(me, f), null);
L.check('no more damage to what is gone', m.views.hero.hurtCover(0, 50) === -1, null);
d.start('run');
L.step(0.2);
L.check('the next round stands it again', a.obstacles.includes(pillar) && m.coverLeft(0) === 150, null);
return L.done(out);
