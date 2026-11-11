// Real fights, frame by frame, for the first seconds: where both heroes stand and what holds them.
//
//   python pipeline/tools/page-shots.py pipeline/rustfull/probe-frames.js pipeline/rustfull/data --json frames-frost.json --timeout 300
//
// Rows: [fight, seconds, hero x, hero z, opponent x, opponent z, hero rooted, opponent rooted, hero winding (1/0),
// opponent winding (1/0), hero slowed/stunned code, opponent code, hero HP, opponent HP].
const PROBE = window.PROBE ?? { a: 'Brannoc', b: 'Isolde', arena: 'frost', fights: 6, seconds: 9 };
(0, eval)(await (await fetch('/pipeline/sim/page.js')).text());
const d = vfx.duel, a = vfx.arena, hm = d.host.heroMode;
const P = Object.getPrototypeOf(d), update0 = P.update;
const rows = [];
let fightNo = 0;
const code = (st) => (st?.stunned ? 2 : 0) + (st?.has('slow') ? 1 : 0) + (st?.has('root') ? 4 : 0);
P.update = function (dt) {
  update0.call(this, dt);
  if (!this.foe || this.time > PROBE.seconds) return;
  const h = a.caster.group.position, o = this.foe.group.position;
  rows.push([fightNo, +this.time.toFixed(4), +h.x.toFixed(3), +h.z.toFixed(3), +o.x.toFixed(3), +o.z.toFixed(3), +hm.rooted.toFixed(3), +this.rooted.toFixed(3),
    hm.attackWinding ? 1 : 0, this.oppAttack.winding ? 1 : 0, code(hm.status), code(a.statusOf(this.foe)), Math.round(this.playerHp), Math.round(a.hpOf(this.foe))]);
};
const fights = [];
for (const [hero, foe] of [[PROBE.a, PROBE.b], [PROBE.b, PROBE.a]]) {
  for (let i = 0; i < PROBE.fights; i++) {
    const r = await window._simFight({ hero, foe, arena: PROBE.arena, events: false, maxSeconds: PROBE.seconds + 1 });
    fights.push({ n: fightNo, h: hero, f: foe });
    fightNo++;
  }
}
P.update = update0;
return { probe: PROBE, fights, rows };
