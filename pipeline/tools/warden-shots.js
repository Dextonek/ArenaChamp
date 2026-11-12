// Pictures of the Sun Warden's party fight from the game's own camera: the hall breaking open, the sunfire, Branded, Carry the Sun,
// The Four Hours (src/raid/wardenHall.ts).
//
//   python pipeline/tools/page-shots.py pipeline/tools/warden-shots.js docs/raid --page /game --size 1280x800 --port 5200 --timeout 900
//   python pipeline/tools/page-shots.py pipeline/tools/warden-shots.js docs/raid --page /game --size 390x844 --port 5200 --timeout 900
//
// It is the body of an async function run in the game page (see page-shots.py). A raid alone is started, then its fight is begun again
// as a party's of twelve at the HP for forty: eleven partners who only stand where they are put. The brain is stopped; each move is
// cast by hand, what the hub would say of the partners (who took a shard) is said by hand, and the game is stepped to the moment.
// A wide page gives the warden-* pictures (thirteen), a narrow one warden-phone-open and warden-phone-sunfire.
const api = game.api, d = api.duel, hm = api.heroMode;
const { SUN_WARDEN } = await import('/src/raid/sunWarden.ts');
const { BREACH, SUNFIRE, BRAND, hallFight } = await import('/src/raid/wardenHall.ts');
const { LocalLink } = await import('/src/raid/link.ts');
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
let simMs = performance.now();
const realNow = performance.now.bind(performance);
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); } };
/** Many seconds on, with the hero kept alive. */
const run = (s) => { for (let i = 0; i < s; i++) { d.playerHp = d.playerMax; step(1); } };
const shot = () => { d.playerHp = d.playerMax; api.render(); return gl.toDataURL('image/jpeg', 0.9); };
let seq = 9000;
const send = (c) => d.boss.link.cast({ id: ++seq, fx: d.foe.group.position.x, fz: d.foe.group.position.z, dir: 0, seed: 55, alone: false, target: 0, step: 0, x: 0, z: 0, ...c });
const boss = (x, z) => a.placeFoe(d.foe, new V(x, 0, z));
const me = (x, z) => a.caster.group.position.set(x, 0, z);
/** The partners, each to its spot: `spots[i]` is where side i + 1 stands. */
const stand = (spots) => { spots.forEach(([x, z], i) => d.partnerMove(i + 1, x, z, Math.atan2(-x, 7 - z), undefined)); };
const zoomTo = (z) => { hm.zoom = z; step(0.6); };
/** A new fight in the hall, whole, with the party in it. */
const fresh = async () => {
  performance.now = realNow;
  d.holdStart = false;
  d.startBoss({ def: SUN_WARDEN, link: new LocalLink(SUN_WARDEN, 1), seed: 'shots', mode: 'play', band: 40, name: 'Kaia', party: partners });
  // The hall's own files, and the partners' models.
  await wait(2500);
  api.view.paused = true;
  simMs = performance.now();
  performance.now = () => simMs;
  d.boss.brain.pause = 1e9;
  step(3.6);
};
const ring = (n, r, x = 0, z = 7, turn = 0) => Array.from({ length: n }, (_, i) => [x + Math.sin(turn + (i / n) * 6.283) * r, z + Math.cos(turn + (i / n) * 6.283) * r]);
const out = {};

if (!phone) {
  // The Four Hours, from far out: a task in each arm.
  await fresh();
  boss(0, 4);
  me(2, 16);
  stand([...ring(3, 2.4, 0, 31), ...ring(3, 2.4, 24, 7), ...ring(3, 2.4, 0, -18), ...ring(2, 2.4, -24, 7)]);
  send({ move: 'four', x: 40, seed: 8 });
  step(7);
  zoomTo(4.6);
  out['warden-four-far'] = shot();
  me(-6, 26);
  zoomTo(2.3);
  out['warden-four'] = shot();

  // Carry the Sun: eight shards at the far ends; two carried home, a hero in the way of the ray that comes for a carrier.
  await fresh();
  boss(0, 11);
  me(4, 20);
  stand([[0, 27], [1.5, 18.5], [-9, 14], [8, 12], [-4, 22], [6, 27], [-7, 30], [9, 33], [-12, 8], [12, 4], [-3, 14]]);
  send({ move: 'carry', x: 8, seed: 31 });
  step(4.2);
  zoomTo(4.6);
  out['warden-carry-far'] = shot();
  d.boss.link.on.done(seq, 0, 1);
  d.boss.link.on.done(seq, 3, 5);
  step(0.3);
  send({ move: 'ray', x: 1.5, z: 18.5, target: 1, flag: true, dir: Math.atan2(1.5, 7.5) });
  zoomTo(1.9);
  step(1.95);
  out['warden-carry'] = shot();

  // Branded: three suns over three heads in the crowd, then one of them out in the open as it bursts.
  await fresh();
  boss(0, 12);
  me(3.5, 23);
  const crowd = [[0, 21], [-2.5, 23], [2, 25.5], [-4.5, 20], [5.5, 20.5], [-1, 26.5], [-6, 24.5], [6.5, 25], [0.5, 18.5], [-3.5, 17.5], [4, 17.5]];
  stand(crowd);
  zoomTo(1.7);
  [[2, crowd[1]], [5, crowd[4]], [9, crowd[8]]].forEach(([side, [x, z]], k) => send({ move: 'brand', step: k, x, z, target: side, seed: 77 }));
  step(3.6);
  out['warden-branded'] = shot();
  d.partnerMove(2, -10, 27, 0, undefined);
  d.partnerMove(5, 11, 17, 0, undefined);
  step(1.3);
  send({ move: 'brand', step: 5, x: -10, z: 27, target: 2, seed: 77 });
  send({ move: 'brand', step: 6, x: 11, z: 17, target: 5, seed: 77 });
  send({ move: 'brand', step: 7, x: crowd[8][0], z: crowd[8][1], target: 9, seed: 77 });
  step(BRAND.burst + 0.12);
  out['warden-branded-burst'] = shot();

  // The hall breaks open: cracking, falling, open.
  await fresh();
  boss(-3, 3);
  me(5, 9);
  stand([[-9, 12], [8, 15], [-6, 22], [4, 26], [18, 9], [-19, 5], [10, -4], [-8, -9], [2, -14], [-11.6, 20], [11.5, -6]]);
  zoomTo(2.6);
  send({ move: 'breach' });
  step(BREACH.warn - 1);
  out['warden-cracking'] = shot();
  step(1 + 1.25);
  out['warden-falling'] = shot();
  zoomTo(4.6);
  step(5);
  out['warden-open-far'] = shot();
  me(17, -7);
  boss(12, -12);
  zoomTo(1.5);
  out['warden-open'] = shot();

  // The Hour Strikes in the round court: three quarters and the crossing burn, the east quarter is the safe one.
  me(3, 13);
  boss(-4, 4);
  send({ move: 'strikes', seed: 1 });
  step(12);
  zoomTo(4.6);
  out['warden-hour-open-far'] = shot();
  d.boss.script.clear();

  // The sun comes down: two minutes on.
  me(2, 30);
  boss(-18, 26);
  stand([[-21, 29], [-24, 25], [-19, 22], [22, 27], [25, 23], [20, 31], [-23, -12], [-26, -8], [24, -11], [21, -15], [-2, 33]]);
  send({ move: 'sunfall' });
  run(120);
  zoomTo(4.6);
  out['warden-sunfire-far'] = shot();
  out.fire = hallFight.fire;
  me(4, 7 + hallFight.fire + 2.5);
  boss(-9, 7 + hallFight.fire + 4);
  stand([[-4, 7 + hallFight.fire + 5], [8, 7 + hallFight.fire + 4], [-13, 7 + hallFight.fire + 7], ...ring(8, 2.5, 26, 14)]);
  zoomTo(1.5);
  out['warden-sunfire'] = shot();
} else {
  await fresh();
  boss(-2, 3);
  me(3, 11);
  stand([[-7, 13], [7, 16], [-5, 22], [4, 26], [16, 9], [-17, 5], [9, -4], [-8, -9], [2, -14], [-11.6, 20], [11.5, -6]]);
  zoomTo(1.7);
  send({ move: 'breach' });
  step(BREACH.warn + 6);
  me(15, -5);
  boss(10, -11);
  step(0.6);
  out['warden-phone-open'] = shot();
  me(2, 22);
  boss(-6, 24);
  stand([[-4, 25], [6, 24], [-9, 27], ...ring(8, 2.5, 24, 16)]);
  send({ move: 'sunfall' });
  run(70);
  me(2, 7 + hallFight.fire + 2);
  step(0.6);
  out['warden-phone-sunfire'] = shot();
}
out.arena = d.currentArena?.id;
return out;
