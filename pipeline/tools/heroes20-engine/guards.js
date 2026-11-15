// Three small pieces the sheets assumed: a dash that fizzles (Morwen's Hex Bundle), a hero no one-target spell can pick
// (Kohaku's Glamour), and a cleanse of one's own statuses (Nebet's Feather-Light: "free of slows").
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, hm = L.hm, m = d.mech;
const out = {};
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.2);
const me = a.caster.group.position;
me.set(5.4, 0, 12);
a.moveFoe(d.foe, L.v(5.4 - d.foe.group.position.x, 3 - d.foe.group.position.z));

// Hexed: the next dash goes nowhere, the one after goes; a hexed CPU holds its dashes.
m.views.hero.fizzleEnemyDash(4);
const sefu = d.host.kits.find((k) => k.name === 'Sefu');
out.cpuHoldsDash = sefu.spells.map((s, i) => d.mechHolds(sefu, i, 'opponent'));
const p0 = d.foe.group.position.clone();
a.moveFigure(d.foe, L.v(1, 3), 0.3);
L.step(0.5);
const first = +d.foe.group.position.distanceTo(p0).toFixed(2);
a.moveFigure(d.foe, L.v(1, 3), 0.3);
L.step(0.5);
const second = +d.foe.group.position.distanceTo(p0).toFixed(2);
L.check('a hexed dash fizzles, the next one goes', first < 0.05 && second > 3.5, { first, second });
L.check('a hexed CPU holds its dash spells (Sefu: E)', out.cpuHoldsDash.join() === 'false,false,true,false', out.cpuHoldsDash);

// Unseen: Lyra's Meteor Mark (one target) cannot pick Isolde; her key is not spent. The CPU does not try either.
m.unseen('opponent', 1.5);
hm.setCooldown(3, 0);
const seq = a.castSeq;
const went = hm.autoCast(3, { enemy: d.foe });
out.unseen = { went, casts: a.castSeq - seq, cooldown: hm.cooldownOf(3) };
L.check('no one-target spell picks an unseen hero, and the key is not spent', !went && out.unseen.casts === 0 && out.unseen.cooldown === 0, out.unseen);
m.unseen('hero', 1.5);
const lyra = hm.currentKit;
out.cpuHolds = d.host.kits.find((k) => k.name === 'Isolde').spells.map((s, i) => d.mechHolds(d.opponentKit, i, 'opponent'));
L.check('the CPU holds its one-target spells at an unseen hero (Isolde: W and R)', out.cpuHolds.join() === 'false,true,false,true', out.cpuHolds);
L.step(1.6);
const went2 = hm.autoCast(3, { enemy: d.foe });
L.check('once seen again it can be picked', went2, went2);

// A cleanse: a slow and a root on Lyra end; a stun is not asked for and stays.
a.applyStatus(a.caster, 'slow', 2);
const st = a.statusOf(a.caster);
const had = st.has('slow');
const gone = m.views.hero.cleanse(['slow', 'root']);
L.check('a cleanse ends the statuses named', had && gone && !st.has('slow'), { had, gone, slow: st.has('slow') });
return L.done(out);
