// Anka's second life against a boss: the raid tool's loop, with her embers and her passive sampled every step.
const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
const d = vfx.duel;
let simMs = performance.now();
performance.now = () => simMs;
const errors = [];
const logError = console.error;
console.error = (...a) => { if (errors.length < 30) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); logError(...a); };
window.addEventListener('error', (e) => { if (errors.length < 30) errors.push('ERR ' + e.message); });
const { BOSSES } = await import('/src/raid/bosses.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const { RunUpgrades } = await import('/src/raid/upgrades.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const ph = await import('/src/traits/phoenix.ts');
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
d.pilotLevel = CPU_BALANCE;
vfx.heroPickCtrl.setValue('Anka');
const N = 6;
const fights = [];
let sameModule = null;
const start = (bossId, r) => {
  const def = BOSSES[bossId];
  const link = new LocalLink(def, 1);
  d.startBoss({ def, link, seed: `probe-${bossId}-${r}-${Math.random()}`, mode: 'run', tier: 1, upgrades: new RunUpgrades() });
  return { def, link };
};
const step = () => { simMs += 1000 / 60; vfx.step(1 / 60); };
for (const bossId of ['sun', 'ash']) for (let r = 0; r < N; r++) {
  const { link } = start(bossId, r);
  const rt0 = d.heroRt;
  if (sameModule === null) sameModule = rt0?.trait === ph.phoenixTrait;
  const rec = { boss: bossId, laid: 0, stamped: 0, burnt: 0, other: 0, withEmber: 0, steps: 0, rose: null, death: null };
  let lastMove = '', lastMoveAt = 0;
  const b = d.boss, count = b.countHit.bind(b);
  b.countHit = (m) => { lastMove = m; lastMoveAt = d.heroRt?.time ?? 0; count(m); };
  let foeDmg = [];
  const cnt = vfx.arena.onFoeDamage;
  vfx.arena.onFoeDamage = (t, n) => { foeDmg.push([d.heroRt?.time ?? 0, n]); cnt(t, n); };
  let ids = new Map(), prev = null, f = 0;
  const puffs = new Set();
  while (!d.result && f < 60 * 420) {
    step(); f++;
    const rt = d.heroRt;
    if (!rt) continue;
    const fig = rt.self(), now = rt.time;
    const embers = ph.embersOf(fig);
    const marks = rt.trait.marks(rt);
    const fresh = { stamp: 0, burn: 0 };
    for (const m of marks) if (m.kind === 'stamp' || m.kind === 'burn') {
      const key = `${m.kind}:${m.x.toFixed(2)}:${m.z.toFixed(2)}:${(now - m.age).toFixed(2)}`;
      if (!puffs.has(key)) { puffs.add(key); fresh[m.kind]++; }
    }
    const cur = new Map(embers.map((e) => [e.id + ':' + e.born.toFixed(3), e]));
    for (const k of cur.keys()) if (!ids.has(k)) rec.laid++;
    let gone = 0;
    for (const k of ids.keys()) if (!cur.has(k)) gone++;
    rec.stamped += fresh.stamp; rec.burnt += fresh.burn; rec.other += Math.max(0, gone - fresh.stamp - fresh.burn);
    ids = cur;
    rec.steps++;
    if (embers.length) rec.withEmber++;
    const p = fig.group.position;
    const snap = { t: +now.toFixed(2), hp: Math.round(d.playerHp), embers: embers.length, ash: rt.mem.ash ? 1 : 0, inAsh: now < (rt.mem.ashUntil ?? 0) ? 1 : 0, reborn: rt.mem.reborn ? 1 : 0, x: +p.x.toFixed(1), z: +p.z.toFixed(1), hidden: rt.trait.figureHidden(rt) ? 1 : 0 };
    if (prev && !prev.reborn && snap.reborn) {
      const nest = ph.nestOf(fig);
      rec.rose = { at: snap.t, move: lastMove, moveAgo: +(now - lastMoveAt).toFixed(2), hpBefore: prev.hp, hpAt: snap.hp, embersBefore: prev.embers, nest: nest ? [+nest.x.toFixed(1), +nest.z.toFixed(1)] : null, from: [prev.x, prev.z], minHpInAsh: snap.hp, hpEnd: null, endAt: null, endPos: null, flare: 0 };
    }
    if (rec.rose && rec.rose.endAt === null) {
      if (snap.inAsh || snap.ash) rec.rose.minHpInAsh = Math.min(rec.rose.minHpInAsh, snap.hp);
      if (prev && prev.ash && !snap.ash) { rec.rose.endAt = snap.t; rec.rose.hpEnd = snap.hp; rec.rose.endPos = [snap.x, snap.z]; rec.rose.hiddenAfter = snap.hidden; rec.rose.embersAfter = snap.embers; rec.rose.flare = foeDmg.filter(([t]) => Math.abs(t - snap.t) < 0.1).reduce((s, [, n]) => s + n, 0); }
    }
    prev = snap;
  }
  vfx.arena.onFoeDamage = cnt;
  if (d.result) {
    rec.winner = d.result.winner; rec.seconds = Math.round(d.result.seconds);
    if (d.result.winner !== 'Anka') rec.death = { killedBy: d.result.boss?.killedBy, last: prev, bossLeft: Math.round(100 * vfx.arena.hpOf(d.foe) / link.maxHp) + '%' };
  } else rec.none = true;
  rec.share = +(rec.withEmber / Math.max(1, rec.steps)).toFixed(2);
  delete rec.withEmber; delete rec.steps;
  fights.push(rec);
  await tick();
}

// The cases, by hand. Each: a fresh fight against the Sun Warden, let it run 3 s, then hit her through the boss's own door.
const world = () => d.boss.world;
const cases = {};
const run = (secs) => { for (let i = 0; i < secs * 60 && !d.result; i++) step(); };
const state = () => { const rt = d.heroRt, p = rt.self().group.position; return { hp: Math.round(d.playerHp), reborn: rt.mem.reborn ? 1 : 0, ash: rt.mem.ash ? 1 : 0, inAsh: rt.time < (rt.mem.ashUntil ?? 0) ? 1 : 0, embers: ph.embersOf(rt.self()).length, hidden: rt.trait.figureHidden(rt) ? 1 : 0, over: d.result ? d.result.winner : null, pos: [+p.x.toFixed(1), +p.z.toFixed(1)] }; };
const setup = (bossId) => {
  start(bossId, 99); run(3);
  const rt = d.heroRt, p = rt.self().group.position;
  const e = ph.layEmber(rt.self(), p.x + 3, p.z);
  return { rt, p, e };
};
// A: an ordinary boss hit that would fell her, a nest burning.
{
  const { p } = setup('sun');
  const before = state();
  world().hitMe({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
  const at = state(); run(0.6); const mid = state(); run(0.8); const after = state();
  cases.ordinaryHitWithNest = { before, at, mid, after };
}
// A2: an ordinary boss hit that would fell her, no ember.
{
  start('sun', 98); run(3);
  const rt = d.heroRt, p = rt.self().group.position;
  ph.burnOut(rt.self());
  const before = state();
  world().hitMe({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
  const at = state(); run(0.3);
  cases.ordinaryHitNoEmber = { before, at, after: state() };
}
// B: a lethal hit (Ash's charge is the only one), a nest burning.
{
  const { p } = setup('sun');
  const before = state();
  world().hitMe({ share: 1, lethal: true, knock: 3, from: { x: p.x - 1, z: p.z }, move: 'probe-lethal' });
  const at = state(); run(0.3);
  cases.lethalHitWithNest = { before, at, after: state() };
}
// C: an ordinary hit while she is the egg, then a lethal one.
{
  const { p } = setup('sun');
  world().hitMe({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
  run(0.4);
  const egg = state();
  world().hitMe({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
  const ordinaryInEgg = state();
  world().hitMe({ share: 1, lethal: true, knock: 3, from: { x: p.x - 1, z: p.z }, move: 'probe-lethal' });
  const at = state(); run(0.3);
  cases.hitsInEgg = { egg, ordinaryInEgg, lethalInEgg: at, after: state() };
}
// D: after a death in the egg, the next fight starts clean.
{
  start('sun', 97); run(1);
  cases.nextFightClean = state();
}
// E: a second killing hit in the same fight after she has risen.
{
  const { p } = setup('sun');
  world().hitMe({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
  run(1.5);
  const risen = state();
  const rt = d.heroRt, q = rt.self().group.position;
  ph.layEmber(rt.self(), q.x + 3, q.z);
  world().hitMe({ share: 5, from: { x: q.x - 1, z: q.z }, move: 'probe' });
  const at = state(); run(0.3);
  cases.secondKillingHit = { risen, at, after: state() };
}
delete performance.now;
console.error = logError;
return { sameModule, fights, cases, errors };
