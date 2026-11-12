// One CPU duel written down as it goes: every cast, every hit and, each half second, where the two stand. For finding out
// WHY a pairing is one-sided (the simulator says how often; this says what happened). The body of an async function for
// pipeline/tools/page-shots.py; the pairing comes from the address, so no file needs editing:
//
//   python pipeline/tools/page-shots.py pipeline/tools/duel-trace.js <out folder> --json trace.json --timeout 300 --port 5211 --page "/?hero=Vesper&foe=Oblivion&fights=2"
//
// `hero` is the player's side, `foe` the opponent's (both played by the CPU, as in the simulator); `fights` (default 1).
// It returns { fights: [{ winner, seconds, lines: [...] }] }; a line is "12.4 hero Q", "12.7 hero Q hit 33 -> foe 512",
// or "12.5 d 4.2 hero 430 (res 30) foe 512 [silenced]".
const q = new URLSearchParams(location.search);
const HERO = q.get('hero') || 'Vesper', FOE = q.get('foe') || 'Oblivion', FIGHTS = +(q.get('fights') || 1);
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const d = vfx.duel, a = vfx.arena;
let simMs = performance.now();
performance.now = () => simMs;
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
const out = [];
for (let n = 0; n < FIGHTS; n++) {
  const lines = [];
  let now = 0;
  const say = (s) => lines.push(`${now.toFixed(1)} ${s}`);
  d.cpuLevel = CPU_BALANCE;
  d.opponentChoice = FOE;
  d.arenaChoice = q.get('arena') || 'random';
  d.hazardsInRuns = d.shiftsInRuns = false;
  if (vfx.heroPickCtrl.getValue() !== HERO) vfx.heroPickCtrl.setValue(HERO);
  const resolve = Object.getPrototypeOf(d).resolve;
  d.resolve = function (dealer, victim, opts, mods, kind, slot, cast) {
    const o = resolve.call(this, dealer, victim, opts, mods, kind, slot, cast);
    const what = kind === 'spell' ? 'QWER'[slot ?? 0] : kind;
    const st = opts?.status ? ` +${opts.status.kind} ${opts.status.seconds}` : mods?.status ? ` +${mods.status.kind} ${mods.status.seconds}` : '';
    if (o.damage || st) say(`${dealer} ${what} hit ${Math.round(o.damage || 0)}${st}${o.blocked ? ' (blocked)' : ''}`);
    return o;
  };
  d.start('run');
  const rt = d.heroRt ?? d.oppRt, proto = rt && Object.getPrototypeOf(rt);
  if (proto && !proto._traced) {
    const cast0 = proto.cast;
    proto._traced = true;
    proto.cast = function (slot, ...rest) {
      window._traceSay?.(`${this.side} ${'QWER'[slot]}`);
      return cast0.call(this, slot, ...rest);
    };
  }
  window._traceSay = say;
  const flags = (st) => !st ? '' : ['stunned', 'cannotCast', 'cannotMove', 'charmed', 'blind'].filter((k) => st[k]).join(',');
  let f = 0;
  while (!d.result && f < 120 * 60) {
    simMs += 1000 / 60;
    vfx.step(1 / 60);
    f++;
    now = f / 60;
    if (f % 30 === 0) {
      const h = a.caster.group.position, o = d.foe.group.position;
      const hs = flags(vfx.heroMode?.status ?? d.host?.heroMode?.status), fs = flags(a.statusOf(d.foe));
      say(`d ${Math.hypot(h.x - o.x, h.z - o.z).toFixed(1)} hero ${Math.round(d.playerHp)} (res ${Math.round(d.heroRt?.res ?? 0)})${hs ? ' [' + hs + ']' : ''} foe ${Math.round(a.hpOf(d.foe))} (res ${Math.round(d.oppRt?.res ?? 0)})${fs ? ' [' + fs + ']' : ''}`);
    }
  }
  delete d.resolve;
  out.push({ hero: HERO, foe: FOE, arena: d.currentArena?.id ?? null, winner: d.result?.winner ?? null, seconds: d.result?.seconds ?? f / 60, lines });
  await new Promise((ok) => setTimeout(ok, 0));
}
return { fights: out };
