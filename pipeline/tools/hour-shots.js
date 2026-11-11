// Pictures of The Hour Strikes (the Sun Warden's move in the Hall of Noon) from the game's own camera:
//
//   python pipeline/tools/page-shots.py pipeline/tools/hour-shots.js docs/raid --page /game --size 1280x800 --port 5195
//   python pipeline/tools/page-shots.py pipeline/tools/hour-shots.js docs/raid --page /game --size 390x844 --port 5195
//
// It is the body of an async function run in the game page (see page-shots.py). A raid alone is started and its fight made a party's
// (the Hall of Noon); the brain is stopped, the move cast by hand with a seed that picks the arm, and the game stepped to the moment.
// A wide page gives hour-called, hour-called-far, hour-bell, hour-bell-far; a narrow one hour-phone and hour-phone-bell.
const api = game.api, d = api.duel, hm = api.heroMode;
const { SUN_WARDEN, HOUR } = await import('/src/raid/sunWarden.ts');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rz = SUN_WARDEN.resize;
SUN_WARDEN.resize = () => rz(40);
await game.raid.start({ hero: 'Kaia' });
await wait(300);
// No omen in the pictures (Long Night would darken them).
game.raid.upgrades.omens = [];
await game.raid.fight();
SUN_WARDEN.resize = rz;
// The hall's own files.
await wait(4000);
api.view.paused = true;
let simMs = performance.now();
performance.now = () => simMs;
const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); } };
step(3.4);
const a = api.arena, V = a.caster.group.position.constructor;
const gl = api.renderer.domElement;
const shot = () => { api.render(); return gl.toDataURL('image/jpeg', 0.9); };
const phone = innerWidth < 600;
let seq = 9000;
/** A fresh hour: he stands at `boss`, the hero at `me`, arm `arm` is the safe one, and the game runs `t` seconds on. */
const hour = (arm, boss, me, t) => {
  d.boss.script.clear();
  d.boss.brain.pause = 1e9;
  d.playerHp = d.playerMax;
  a.placeFoe(d.foe, new V(boss[0], 0, boss[1]));
  a.caster.group.position.set(me[0], 0, me[1]);
  const m = SUN_WARDEN.moves.strikes;
  const aim = m.aim({ boss: { x: boss[0], z: boss[1] }, ring: { x: boss[0], z: boss[1] }, target: { x: me[0], z: me[1] }, step: 0, seed: arm });
  d.foe.group.rotation.y = aim.dir;
  d.boss.link.cast({ id: ++seq, move: 'strikes', step: 0, x: aim.x, z: aim.z, fx: boss[0], fz: boss[1], dir: aim.dir, seed: arm, target: 0 });
  step(t);
};
const zoomTo = (z) => { hm.zoom = z; step(0.5); };
const out = { arena: d.currentArena?.id, at: HOUR.seconds };
if (!phone) {
  // The call, into the choir (north): the hero in the crossing, which burns, the road lit ahead.
  zoomTo(1.25);
  hour(2, [-3.5, 2], [3, 3.5], HOUR.call + 0.4);
  out['hour-called'] = shot();
  zoomTo(4.6);
  out['hour-called-far'] = shot();
  // The bell, the nave (south) safe: the hero just inside it, the crossing and the three arms going up.
  zoomTo(1.25);
  hour(0, [-2.5, 3], [2.5, 23], HOUR.seconds + 0.18);
  out['hour-bell'] = shot();
  zoomTo(4.6);
  hour(0, [-2.5, 3], [2.5, 23], HOUR.seconds + 0.3);
  out['hour-bell-far'] = shot();
  // Late in the count, play zoom: the sunfire high, the road bright.
  zoomTo(1.25);
  hour(1, [-2, 6], [9, 9], HOUR.seconds - 2.5);
  out['hour-late'] = shot();
} else {
  zoomTo(1.7);
  hour(2, [-2.5, 0], [2, 3.5], HOUR.call + 0.4);
  out['hour-phone'] = shot();
  hour(0, [-2, 4], [1.5, 23], HOUR.seconds + 0.18);
  out['hour-phone-bell'] = shot();
}
out.hp = d.playerHp / d.playerMax;
return out;
