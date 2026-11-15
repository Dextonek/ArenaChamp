// The plain look of every piece at once, from the game's camera (each hero who uses one draws its own over it): a ward line and a
// ward circle, a crack only its maker crosses, a chain (Isolde leashed to Lyra), a sleeper's ring, a token over a head and one on
// the floor, and a lantern's pull.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech, v = m.views.hero;
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.2);
const me = a.caster.group.position;
me.set(3, 0, 11);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 6.5 - d.foe.group.position.z));
v.ward({ x: -2, z: 9 }, { x: 2, z: 7.5 }, 10);
v.ward({ x: -3.5, z: 4 }, null, 10, { r: 2 });
v.chasm({ ax: 0.5, az: 3, bx: 4.5, bz: 4.5, r: 0.5, height: 0, kind: 'wall' }, 10);
v.leashEnemy(6, 10);
m.sleep('opponent', 1.5);
v.token('a', 'hero');
v.token('b', null, { x: -1, z: 11.5 });
v.attractor(6.5, 10, 2.5, 10);
L.step(0.4);
return L.done({ looks: L.shot(1280, 800) });
