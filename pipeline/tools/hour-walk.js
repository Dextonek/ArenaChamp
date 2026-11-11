// How long the way to the safe arm is, for The Hour Strikes' time (the Sun Warden, the Hall of Noon):
//
//   python pipeline/tools/page-shots.py pipeline/tools/hour-walk.js <out folder> --json hour-walk.json --timeout 600 --port 5195
//
// It is the body of an async function run in the tool page (see page-shots.py). The autopilot (3.5 m/s: a slow hero, or any hero
// under Heavy Air) is put at the far end of each arm of the hall, in its middle and in a corner, the hour is called for each other
// arm, and the seconds until it stands in that arm are taken (`in`: past the crossing's edge, where the bell no longer hits). The
// boss stands at the Sun Well and does nothing else. `worst` is what the move's `least` must cover.
const d = vfx.duel, a = vfx.arena;
const { SUN_WARDEN: def, HOUR } = await import('/src/raid/sunWarden.ts');
const { HALL_ARMS, inArm } = await import('/src/arenas/sunhall.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const V = a.caster.group.position.constructor;
let simMs = performance.now();
performance.now = () => simMs;
const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
const hero = 'Lyra';
vfx.heroPickCtrl.setValue(hero);
// The far end of each arm: its middle, and one corner. The nave's middle is in the gate's passage, as far as the floor goes.
const ENDS = [
  [[0, 52], [10.5, 46.5]],
  [[32.4, 7], [32.2, 12]],
  [[0, -31.4], [-11, -28.5]],
  [[-32.4, 7], [-32.2, 2]],
];
const rows = [];
let seq = 7000, worst = 0;
for (let from = 0; from < 4; from++) {
  for (let to = 0; to < 4; to++) {
    if (to === from) continue;
    for (const [k, spot] of ENDS[from].entries()) {
      d.startBoss({ def, link: new LocalLink(def), seed: `walk-${from}-${to}`, mode: 'run', band: 5 });
      d.boss.brain.pause = 1e9;
      a.placeFoe(d.foe, new V(0, 0, 3.5));
      a.caster.group.position.set(spot[0], 0, spot[1]);
      for (let i = 0; i < 6; i++) { simMs += 1000 / 60; vfx.step(1 / 60); }
      const me = a.caster.group.position, b = d.foe.group.position;
      d.boss.link.cast({ id: ++seq, move: 'strikes', step: 0, x: 0, z: 7, fx: b.x, fz: b.z, dir: 0, seed: to, target: 0 });
      let t = 0, inAt = -1, walked = 0, px = me.x, pz = me.z;
      while (t < 40 && inAt < 0) {
        simMs += 1000 / 60;
        vfx.step(1 / 60);
        t += 1 / 60;
        walked += Math.hypot(me.x - px, me.z - pz);
        px = me.x; pz = me.z;
        if (inArm(to, me.x, me.z)) inAt = t;
      }
      rows.push({ from: HALL_ARMS[from].name, to: HALL_ARMS[to].name, start: k ? 'corner' : 'middle', in: +inAt.toFixed(1), metres: +walked.toFixed(1), speed: +(walked / Math.max(0.1, inAt)).toFixed(2), hp: +(d.playerHp / d.playerMax).toFixed(2) });
      worst = Math.max(worst, inAt < 0 ? 99 : inAt);
      await tick();
    }
  }
}
delete performance.now;
return { hero, worst: +worst.toFixed(1), seconds: HOUR.seconds, least: HOUR.least, rows };
