// Wards (Morwen's salt): a line or a circle no spell crosses, from either side; feet cross it freely.
//   bolts of both sides stop on it; a one-target spell aimed across it fails (its cooldown spent); an area spell's hit does not
//   reach past it; the CPU counts it as no sight for its bolts and one-target spells.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, hm = L.hm, m = d.mech;
const me = () => a.caster.group.position;
const place = (hx, hz, fx, fz) => {
  me().set(hx, 0, hz);
  const f = d.foe.group.position;
  a.moveFoe(d.foe, L.v(fx - f.x, fz - f.z));
};
const castFoe = (slot, point) => {
  const spell = d.opponentKit.spells[slot], spec = d.host.targeting(spell.label);
  d.cooldowns[slot] = 0;
  d.castSpell(slot, d.foe, d.foe.group.position, me(), spec, point);
};
// The temple has a pillar in its middle: the tests stand in the clear lane at x = 5.4.
const out = {};

// 1. Bolts, both ways: Lyra's Starfall Arrow at Isolde, Isolde's Icicle at Lyra, across a line between them.
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.2);
place(5.4, 12, 5.4, 3);
let ward = m.ward({ x: 2.5, z: 7.5 }, { x: 8.5, z: 7.5 }, 10);
const foe0 = a.hpOf(d.foe), me0 = d.playerHp;
hm.setCooldown(0, 0);
hm.autoCast(0, { point: d.foe.group.position.clone() });
castFoe(0, me().clone());
L.step(1.6);
out.boltsWarded = { foeLost: foe0 - a.hpOf(d.foe), heroLost: me0 - d.playerHp };
L.check('a ward stops bolts of both sides', out.boltsWarded.foeLost === 0 && out.boltsWarded.heroLost === 0, out.boltsWarded);
out.shot = L.shot();
ward.end();
L.step(0.1);
const foe1 = a.hpOf(d.foe), me1 = d.playerHp;
hm.setCooldown(0, 0);
hm.autoCast(0, { point: d.foe.group.position.clone() });
castFoe(0, me().clone());
L.step(1.6);
out.boltsOpen = { foeLost: foe1 - a.hpOf(d.foe), heroLost: me1 - d.playerHp };
L.check('without it the same bolts land', out.boltsOpen.foeLost > 0 && out.boltsOpen.heroLost > 0, out.boltsOpen);

// 2. A one-target spell aimed across one fails, and its cooldown is spent.
ward = m.ward({ x: 2.5, z: 7.5 }, { x: 8.5, z: 7.5 }, 10);
hm.setCooldown(3, 0);
const seq = a.castSeq, foe2 = a.hpOf(d.foe);
const went = hm.autoCast(3, { enemy: d.foe });
L.step(2.5);
out.targeted = { went, cooldown: +hm.cooldownOf(3).toFixed(1), casts: a.castSeq - seq, foeLost: foe2 - a.hpOf(d.foe) };
L.check('a one-target spell across it fails, its cooldown spent', !went && out.targeted.casts === 0 && out.targeted.cooldown > 0 && out.targeted.foeLost === 0, out.targeted);
L.check('the CPU does not see through it', !d.aiSees(d.foe.group.position, me(), d.heroRt) && a.lineOfSight(d.foe.group.position, me()), null);
ward.end();

// 3. An area spell: Pip's Fragile (a 2.5 m circle at 1 s) aimed beside Lyra, who stands inside a salt circle: the zone covers her, its
// centre lies outside the circle.
L.duel('Lyra', 'Pip', { still: true });
L.step(0.2);
place(5.4, 10, 5.4, 2);
const spec = d.host.targeting(d.opponentKit.spells[1].label);
out.rodRadius = spec.radius;
const aim = L.v(7.3, 10);
let hp0 = d.playerHp;
const circle = m.ward({ x: 5.4, z: 10 }, null, 10, { r: 1.4 });
castFoe(1, aim);
L.step(3);
out.areaWarded = hp0 - d.playerHp;
circle.end();
L.step(0.1);
hp0 = d.playerHp;
castFoe(1, aim);
L.step(3);
out.areaOpen = hp0 - d.playerHp;
L.check('an area spell does not reach past it', out.areaWarded === 0 && out.areaOpen > 0, { warded: out.areaWarded, open: out.areaOpen, radius: out.rodRadius });
// Feet cross freely.
const w2 = m.ward({ x: 2.5, z: 8 }, { x: 8.5, z: 8 }, 5);
for (let i = 0; i < 60; i++) { a.walk(L.v(0, -0.1)); L.step(1 / 60); }
L.check('feet cross it', me().z < 7.5, +me().z.toFixed(2));
w2.end();
return L.done(out);
