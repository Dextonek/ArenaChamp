// Real fights, event by event, to find where the Rust port (pipeline/rustfull) differs from the game:
//
//   python pipeline/tools/page-shots.py pipeline/rustfull/probe.js pipeline/rustfull/data --json probe-frost.json --timeout 540
//
// The body of an async function run in the tool page. It plays PROBE.fights fights each way round between two heroes
// with the simulator's own page half (pipeline/sim/page.js) and logs every cast and every resolved hit:
//   [fight, side (0 the player's, 1 the opponent's), 'c', slot, seconds, 1 if it was the free recast]
//   [fight, side, 'h', slot or kind, seconds, damage, 1 if swallowed, the status it carries]
// plus, every half second, where both stand: [fight, 0, 'p', 0, seconds, x, z, x, z].
const PROBE = window.PROBE ?? { a: 'Brannoc', b: 'Isolde', arena: 'frost', fights: 30 };
(0, eval)(await (await fetch('/pipeline/sim/page.js')).text());
const { TraitRuntime } = await import('/src/traits/runtime.ts');
const d = vfx.duel, a = vfx.arena;
const log = [];
let fightNo = 0;
const cast0 = TraitRuntime.prototype.cast;
TraitRuntime.prototype.cast = function (slot, ...rest) {
  log.push([fightNo, this.side === 'hero' ? 0 : 1, 'c', slot, +this.time.toFixed(3), this.canRecast(slot) ? 1 : 0]);
  return cast0.call(this, slot, ...rest);
};
const P = Object.getPrototypeOf(d), resolve0 = P.resolve;
P.resolve = function (dealer, victim, opts, mods, kind, slot, cast) {
  const seen = this.resolved.has(opts);
  const o = resolve0.call(this, dealer, victim, opts, mods, kind, slot, cast);
  if (!seen) log.push([fightNo, dealer === 'hero' ? 0 : 1, 'h', kind === 'spell' ? slot : kind, +this.time.toFixed(3), o.damage ?? 0, o.blocked !== undefined ? 1 : 0, o.status?.kind ?? '']);
  return o;
};
const update0 = P.update;
let lastP = -1;
P.update = function (dt) {
  update0.call(this, dt);
  if (this.foe && !this.over && this.time - lastP >= 0.5) {
    lastP = this.time;
    const h = a.caster.group.position, o = this.foe.group.position;
    log.push([fightNo, 0, 'p', 0, +this.time.toFixed(3), +h.x.toFixed(2), +h.z.toFixed(2), +o.x.toFixed(2), +o.z.toFixed(2)]);
  }
};
const fights = [];
for (const [hero, foe] of [[PROBE.a, PROBE.b], [PROBE.b, PROBE.a]]) {
  for (let i = 0; i < PROBE.fights; i++) {
    lastP = -1;
    const r = await window._simFight({ hero, foe, arena: PROBE.arena, events: false });
    fights.push({ n: fightNo, h: r.hero, f: r.foe, w: r.winner, s: r.seconds, hp: [r.heroHp, r.foeHp], errors: r.errors });
    fightNo++;
  }
}
TraitRuntime.prototype.cast = cast0;
P.resolve = resolve0;
P.update = update0;
return { probe: PROBE, fights, log };
