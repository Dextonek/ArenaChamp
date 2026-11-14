// Bolts that bend into a point (Vela's lantern): `t.mech.attractor(x, z, r, seconds, onCatch)` catches the other side's bolts
// that pass within r: they turn into it and end there. Lyra's Starfall Arrow at Isolde, past a lantern of Isolde's 1.6 m off
// its line: caught; without the lantern it lands. Isolde's own bolts pass her lantern.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, hm = L.hm, m = d.mech;
L.duel('Lyra', 'Isolde', { still: true });
L.step(0.2);
const me = a.caster.group.position;
me.set(5.4, 0, 12);
const f = d.foe.group.position;
a.moveFoe(d.foe, L.v(5.4 - f.x, 2 - f.z));
let caught = 0;
const lantern = m.views.opponent.attractor(7.0, 7, 3, 10, () => { caught++; });
const hp0 = a.hpOf(d.foe);
hm.setCooldown(0, 0);
hm.autoCast(0, { point: f.clone() });
let near = 9;
L.step(1.4, () => { for (const p of a.projectiles.live) near = Math.min(near, Math.hypot(p.pos.x - 7, p.pos.z - 7)); });
const out = { caught, foeLost: hp0 - a.hpOf(d.foe), closest: +near.toFixed(2) };
L.check("the other side's bolt bends into it and ends there", caught === 1 && out.foeLost === 0 && near < 0.6, out);
// Her own bolt: Isolde's Icicle at Lyra passes her own lantern.
const me0 = d.playerHp;
const spell = d.opponentKit.spells[0];
d.cooldowns[0] = 0;
d.castSpell(0, d.foe, f, me, d.host.targeting(spell.label), me.clone());
L.step(1.4);
L.check('its own side\'s bolts pass it', d.playerHp < me0 && caught === 1, { lost: me0 - d.playerHp, caught });
lantern.end();
L.step(0.1);
const hp1 = a.hpOf(d.foe);
hm.setCooldown(0, 0);
hm.autoCast(0, { point: f.clone() });
L.step(1.4);
L.check('without it the bolt lands', hp1 - a.hpOf(d.foe) > 0, hp1 - a.hpOf(d.foe));
return L.done(out);
