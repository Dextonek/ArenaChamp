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
  // The page's clock never goes back: a fight stepped for two minutes is ahead of the computer's.
  simMs = Math.max(simMs, realNow());
  performance.now = () => simMs;
  d.holdStart = false;
  const def = twinFlames(half);
  link = new TwinLocalLink(def, band, half);
  // This screen's seat is 0: in the east it changes places with seat 1.
  const dealt = half ? halves.map((h) => 1 - h) : halves;
  d.startBoss({ def, link, seed: 'shots', mode: 'play', band, name: 'Kaia', party: partners, twin: { ...link.setup, halves: dealt } });
  await wait(2500);
  api.view.paused = true;
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
/** Many seconds on, with the hero kept alive. */
const run = (s) => { for (let i = 0; i < s; i++) { d.playerHp = d.playerMax; step(1); } };
/** Both halves' floors crack, and the lava is open. */
const cracked = () => {
  send(0, { move: 'crack', seed: 5 });
  send(1, { move: 'crack', seed: 8 });
  run(Math.ceil(FORGE.warn) + 3);
};
/** The seats of half `h` among the partners (never seat 0, this screen's). */
const seats = (dealt, h) => dealt.map((x, i) => (x === h && i ? i : -1)).filter((i) => i > 0);
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

  // The floor cracks: the warning along the channels, then the islands and their bridges, from far out and in play.
  dealt = await fresh(0);
  me(-11, 13);
  place(dealt, WEST.slice(1), EAST);
  send(0, { move: 'crack', seed: 5 });
  send(1, { move: 'crack', seed: 8 });
  run(3);
  zoomTo(4.6);
  out['twin-crack'] = shot();
  run(Math.ceil(FORGE.warn) + 1);
  zoomTo(4.6);
  out['twin-islands-far'] = shot();
  // A bridge that is about to sink, with this hero before it.
  const glowing = TWIN_BRIDGES.filter((b) => b.half === 0 && b.channel === 2 && !b.alone);
  for (let i = 0; i < 40 && !glowing.some((b) => bridgeUp(b.i) && !bridgeUp(b.i, forge.clock + 2.5)); i++) run(1);
  const gb = glowing.find((b) => bridgeUp(b.i) && !bridgeUp(b.i, forge.clock + 2.5)) ?? glowing[0];
  me(gb.x + 1.5, gb.z - 4.5);
  place(dealt, [[gb.x - 1, gb.z + 4], [-17, 12], [-9, 3], [-19, 2], [-12, 24]], EAST);
  boss(-13, 9);
  send(0, { move: 'slam', x: gb.x, z: gb.z - 4 });
  step(0.7);
  zoomTo(2.3);
  out['twin-islands'] = shot();

  // The pit floods: the wall of fire out, the lava half way in, and the last island with both of them and both teams on it.
  dealt = await fresh(0);
  me(-6, 10);
  place(dealt, [[-9, 5], [-7, 14], [-4, 3], [-11, 9], [-3, 12]], [[8, 6], [6, 13], [4, 2], [10, 10], [3, 9], [7, 16]]);
  cracked();
  send(1, { move: 'flood' });
  run(Math.ceil(FORGE.floodWarn) + 50);
  zoomTo(4.6);
  out['twin-flood-far'] = shot();
  run(75);
  boss(-4.5, 6);
  other(4.5, 8);
  me(-5.5, 11);
  place(dealt, [[-7, 4], [-2, 13], [-8, 9], [-3, 1], [-1, 6]], [[7, 4], [2, 13], [8, 10], [3, 1], [6, 13], [1, 9]]);
  send(0, { move: 'slam', x: -5.5, z: 11 });
  send(1, { move: 'fan', x: 2, z: 13, dir: Math.atan2(2 - 4.5, 13 - 8) });
  step(0.9);
  zoomTo(4.6);
  out['twin-island-far'] = shot();
  zoomTo(2.6);
  out['twin-island'] = shot();

  // Lantern Chain: this hero chained to another, the chain pulled long, and Ash's rocks falling on the line through the two.
  dealt = await fresh(0);
  me(-10, 15);
  place(dealt, [[-4, 13.5], [-17, 13], [-8, 3], [-19, 2], [-12, 20]], EAST);
  const mate = seats(dealt, 0)[0];
  send(0, { move: 'chain', x: -7, z: 14.2, target: 0, mate });
  send(1, { move: 'chain', x: 9, z: 12, target: seats(dealt, 1)[0], mate: seats(dealt, 1)[1] });
  run(2);
  send(0, { move: 'chain', step: CHAIN.most, x: -7, z: 14.2, dir: Math.atan2(6, -1.5), target: 0, mate });
  step(0.8);
  zoomTo(2.3);
  out['twin-chain'] = shot();

  // Seal the Vents: the pit floods, each twin opens four vents, and heroes stand on some of them.
  dealt = await fresh(0);
  me(-6, 10);
  place(dealt, WEST.slice(1), EAST);
  send(1, { move: 'flood' });
  run(Math.ceil(FORGE.floodWarn) + 6);
  const vw = send(0, { move: 'ventsw', x: 4, seed: 2 }), ve = send(1, { move: 'ventse', x: 4, seed: 6 });
  step(0.4);
  const spotsOf = (which, id) => d.boss.twin.scripts[which].active.find((x) => x.cast.id === id).played.objectives;
  const sw = spotsOf(0, vw.id), se = spotsOf(1, ve.id);
  me(sw[0].x, sw[0].z);
  place(dealt, [[sw[1].x, sw[1].z], [sw[2].x + 3, sw[2].z + 2], [-12, 9], [-15, 4], [-9, 12]], [[se[0].x, se[0].z], [se[1].x, se[1].z], [se[2].x - 4, se[2].z], [12, 10], [15, 5], [10, 3]]);
  run(3);
  link.on.done(ve.id, 0, seats(dealt, 1)[0]);
  step(0.5);
  zoomTo(4.6);
  out['twin-vents-far'] = shot();
  zoomTo(2.4);
  out['twin-vents'] = shot();

  // The Changing of the Flames: the gates open, the marked have a gold ring; two have stepped through, this hero is at a gate.
  dealt = await fresh(0);
  me(-7, 9);
  place(dealt, [[-5, 5], [-9, 24], [-16, 10], [-8, 2], [-13, 16]], [[5, 9], [8, 22], [15, 10], [7, 3], [12, 15], [4, 12]]);
  const cg = send(0, { move: 'change' });
  step(0.3);
  const west = seats(dealt, 0), east = seats(dealt, 1);
  for (const side of [west[0], west[1], east[0], east[1], east[2]]) link.on.done(cg.id, RAID_TWIN.change.mark + side, side);
  run(Math.ceil(CHANGE.warn) + 1);
  // Two of the marked go through the middle gate, one each way; this hero walks up to it.
  const at = (side, x, z) => d.partnerMove(side, x, z, 0, undefined);
  at(west[0], 2.2, 7.6);
  at(east[0], -2.2, 6.4);
  link.on.done(cg.id, RAID_TWIN.change.cross + west[0], west[0]);
  link.on.done(cg.id, RAID_TWIN.change.cross + east[0], east[0]);
  at(west[1], -3.4, 25);
  at(east[1], 3.2, 25.6);
  me(-3.6, 7.2);
  step(0.5);
  zoomTo(4.6);
  out['twin-change-far'] = shot();
  zoomTo(2.3);
  out['twin-change'] = shot();
} else {
  // A phone held upright: the islands, and the last island.
  const dealt = await fresh(0);
  me(-11, 13);
  place(dealt, WEST.slice(1), EAST);
  cracked();
  boss(-13, 8);
  send(0, { move: 'slam', x: -11, z: 13 });
  step(0.8);
  out['twin-phone-islands'] = shot();
  send(1, { move: 'flood' });
  run(Math.ceil(FORGE.floodWarn) + 125);
  boss(-4.5, 6);
  other(4.5, 8);
  me(-5.5, 11);
  place(dealt, [[-7, 4], [-2, 13], [-8, 9], [-3, 1], [-1, 6]], [[7, 4], [2, 13], [8, 10], [3, 1], [6, 13], [1, 9]]);
  send(1, { move: 'fan', x: 2, z: 13, dir: Math.atan2(2 - 4.5, 13 - 8) });
  step(0.9);
  out['twin-phone-flood'] = shot();
}

performance.now = realNow;
return out;
