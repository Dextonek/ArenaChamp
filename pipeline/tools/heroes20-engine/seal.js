// A sealed key (Kohaku): `t.mech.sealEnemy(slot, seconds)` closes one of the enemy's keys whatever its cooldown. Its own client
// refuses it (the player's key shows a lock and its seconds), and its CPU counts it as cooling. A CPU duel, Lyra against
// Isolde: at 1 s both heroes' Q is sealed for 4 s; nobody casts Q until 5 s, and both cast it again after.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, hm = L.hm, m = d.mech;
const casts = [];
L.duel('Lyra', 'Isolde');
const proto = Object.getPrototypeOf(d.heroRt);
const cast0 = proto.cast;
proto.cast = function (slot, ...rest) { casts.push({ side: this.side, slot, t: +d.time.toFixed(2) }); return cast0.call(this, slot, ...rest); };
let lock = '', refused = null;
try {
  L.step(1);
  m.seal('opponent', 0, 4);
  m.seal('hero', 0, 4);
  L.step(0.2);
  lock = hm.slotEls?.[0]?.secs?.textContent ?? '';
  refused = { ready: hm.ready(0), cast: hm.autoCast(0, { point: d.foe.group.position.clone() }) };
  L.step(10.8);
} finally {
  proto.cast = cast0;
}
const q = (side, from, to) => casts.filter((c) => c.side === side && c.slot === 0 && c.t >= from && c.t < to).length;
const out = { during: { hero: q('hero', 1, 5), opponent: q('opponent', 1, 5) }, after: { hero: q('hero', 5.05, 12), opponent: q('opponent', 5.05, 12) }, lock, refused };
L.check('no sealed Q is cast while it is sealed', out.during.hero === 0 && out.during.opponent === 0, out.during);
L.check('both cast it again once it opens', out.after.hero > 0 && out.after.opponent > 0, out.after);
L.check("the player's key shows a lock and its seconds", lock.startsWith('🔒'), lock);
L.check("the player's own client refuses it", refused && !refused.ready && !refused.cast, refused);
// The kinds a copy is made by (the full list: spell-kinds.js).
const { spellShape } = L.mech;
const kit = (n) => d.host.kits.find((k) => k.name === n);
const kinds = ['Lyra', 'Isolde', 'Zephyr', 'Sir Whiskers'].map((n) => kit(n).spells.map((s) => spellShape(s, d.host.targeting(s.label)?.mode)).join(' '));
out.kinds = kinds;
L.check('a spell has a kind for a copy', kinds[0] === 'bolt shield bolt bolt' && kinds[3].split(' ')[3] === 'shield', kinds);
return L.done(out);
