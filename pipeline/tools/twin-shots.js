// Pictures of Twin Flames' party fight from the game's own camera: the Twin Forge whole, each half in play, the floor cracked into
// islands, the flood and the last island, Lantern Chain, Seal the Vents, The Changing of the Flames (src/raid/twinForge.ts,
// src/arenas/twinpit.ts).
//
//   python pipeline/tools/page-shots.py pipeline/tools/twin-shots.js docs/raid --page /game --size 1280x800 --port 5212 --timeout 900
//   python pipeline/tools/page-shots.py pipeline/tools/twin-shots.js docs/raid --page /game --size 390x844 --port 5212 --timeout 900
//
// It is the body of an async function run in the game page (see page-shots.py). A raid alone is started, then its fight is begun again
// as a party's of twelve at the HP for forty, six in each half: eleven partners who only stand where they are put. Both brains are
// stopped; each move is cast by hand, what the hub would say (who took a vent, who is marked, who crossed) is said by hand, and the
// game is stepped to the moment. A wide page gives the twin-* pictures, a narrow one twin-phone-islands and twin-phone-flood.
const api = game.api, d = api.duel, hm = api.heroMode;
const { twinFlames } = await import('/src/raid/ashEmber.ts');
const { TwinLocalLink } = await import('/src/raid/twin.ts');
const { forge, FORGE, TWIN_LAYOUT, TWIN_BRIDGES, bridgeUp } = await import('/src/arenas/twinpit.ts');
const { CHAIN, VENTS, CHANGE } = await import('/src/raid/twinForge.ts');
const { RAID_TWIN } = await import('/server/protocol.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await game.raid.start({ hero: 'Kaia' });
await wait(300);
// No omen in the pictures (Long Night would darken them).
game.raid.upgrades.omens = [];
await game.raid.fight();
await wait(1500);
const a = api.arena, V = a.caster.group.position.constructor;
const gl = api.renderer.domElement;
const phone = innerWidth < 600;
const partners = api.kits.filter((k) => k.name !== 'Kaia').slice(0, 11).map((kit, i) => ({ side: i + 1, kit, name: kit.name }));
/** Seats 0, 2, 4... are in the west with Ash, the others in the east with Ember: as the hub deals them. */
const halves = Array.from({ length: 12 }, (_, i) => i % 2);
let simMs = performance.now();
const realNow = performance.now.bind(performance);
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); } };
const shot = () => { d.playerHp = d.playerMax; api.render(); return gl.toDataURL('image/jpeg', 0.9); };
let seq = 9000, link;
/** A cast of boss `which` (0 Ash, 1 Ember), from where it stands. */
const send = (which, c) => {
  const b = d.boss.which === which ? d.foe.group.position : d.twin.enemy.group.position;
  const cast = { id: ++seq + which * RAID_TWIN.ids, fx: b.x, fz: b.z, dir: 0, seed: 55, alone: false, target: 0, step: 0, x: 0, z: 0, which, ...c };
  link.on.cast(cast);
  return cast;
};
const boss = (x, z) => a.placeFoe(d.foe, new V(x, 0, z));
const other = (x, z) => d.twin.enemy.group.position.set(x, 0, z);
const me = (x, z) => a.caster.group.position.set(x, 0, z);
/** The partners, each to its spot: `spots[i]` is where side i + 1 stands. */
const stand = (spots) => { spots.forEach(([x, z], i) => d.partnerMove(i + 1, x, z, Math.atan2(-x, 7 - z), undefined)); };
const zoomTo = (z) => { hm.zoom = z; step(0.6); };
/** A new fight in the forge, whole, this screen's hero in `half`. */
const fresh = async (half = 0, band = 40) => {
  performance.now = realNow;
  d.holdStart = false;
  const def = twinFlames(half);
  link = new TwinLocalLink(def, band, half);
  // This screen's seat is 0: in the east it changes places with seat 1.
  const dealt = half ? halves.map((h) => 1 - h) : halves;
  d.startBoss({ def, link, seed: 'shots', mode: 'play', band, name: 'Kaia', party: partners, twin: { ...link.setup, halves: dealt } });
  await wait(2500);
  api.view.paused = true;
  simMs = performance.now();
  performance.now = () => simMs;
  d.boss.brain.pause = 1e9;
  step(3.6);
  return dealt;
};
/** Six heroes of each half round their boss: `west` and `east` are lists of [x, z]. */
const place = (dealt, west, east) => {
  const w = [...west], e = [...east];
  stand(dealt.slice(1).map((h) => (h ? e.shift() : w.shift()) ?? [h ? 6 : -6, 30]));
};
const WEST = [[-10, 12], [-17, 13], [-8, 3], [-19, 2], [-12, 16], [-5, 9]], EAST = [[9, 13], [18, 14], [7, 2], [20, 1], [13, 17], [5, 8]];
const out = {};

if (!phone) {
  // The forge whole, from far out, and each half in play.
  let dealt = await fresh(0);
  me(-11, 13);
  place(dealt, WEST.slice(1), EAST);
  zoomTo(4.6);
  out['twin-room'] = shot();
  send(0, { move: 'slam', x: -11, z: 13 });
  send(1, { move: 'fan', x: 9, z: 13, dir: Math.atan2(9 - 14, 13 - 7) });
  step(0.9);
  zoomTo(2.3);
  out['twin-west'] = shot();
  dealt = await fresh(1);
  me(9, 13);
  place(dealt, WEST, EAST.slice(1));
  send(1, { move: 'fan', x: 9, z: 13, dir: Math.atan2(9 - 14, 13 - 7) });
  send(0, { move: 'slam', x: -11, z: 13 });
  step(0.9);
  zoomTo(2.3);
  out['twin-east'] = shot();
}

performance.now = realNow;
return out;
