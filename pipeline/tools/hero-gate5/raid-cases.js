// The edge cases again, with the boss's hit given inside the game's own frame (after the trait's tick, before the check for a
// fallen hero), as a real move's hit is.
const d = vfx.duel;
let simMs = performance.now();
performance.now = () => simMs;
const errors = [];
const logError = console.error;
console.error = (...a) => { if (errors.length < 30) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); logError(...a); };
const { BOSSES } = await import('/src/raid/bosses.ts');
const { LocalLink } = await import('/src/raid/link.ts');
const { RunUpgrades } = await import('/src/raid/upgrades.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const ph = await import('/src/traits/phoenix.ts');
vfx.view.paused = true;
if (!d.on) vfx.setDuel(true, 'run');
d.pilotLevel = CPU_BALANCE;
vfx.heroPickCtrl.setValue('Anka');
let queued = [];
const start = (ups = []) => {
  const def = BOSSES.sun;
  const link = new LocalLink(def, 1);
  const upgrades = new RunUpgrades();
  for (const id of ups) upgrades.add(id);
  d.startBoss({ def, link, seed: `probe2-${Math.random()}`, mode: 'run', tier: 1, upgrades });
  const b = d.boss, update = b.update.bind(b);
  b.update = (...a) => { update(...a); for (const h of queued.splice(0)) b.world.hitMe(h); };
};
const step = () => { simMs += 1000 / 60; vfx.step(1 / 60); };
const run = (secs) => { for (let i = 0; i < secs * 60 && !d.result; i++) step(); };
const state = () => { const rt = d.heroRt, p = rt.self().group.position; return { hp: Math.round(d.playerHp), max: Math.round(d.playerMax), reborn: rt.mem.reborn ? 1 : 0, ash: rt.mem.ash ? 1 : 0, embers: ph.embersOf(rt.self()).length, hidden: rt.trait.figureHidden(rt) ? 1 : 0, down: d.boss?.meDown ? 1 : 0, over: d.result ? d.result.winner : null }; };
const nest = () => { const rt = d.heroRt, p = rt.self().group.position; ph.layEmber(rt.self(), p.x + 3, p.z); return p; };
const ordinary = (p) => ({ share: 5, from: { x: p.x - 1, z: p.z }, move: 'probe' });
const lethal = (p) => ({ share: 1, lethal: true, knock: 3, from: { x: p.x - 1, z: p.z }, move: 'probe-lethal' });
const cases = {};
// B: a lethal hit, a nest burning.
{
  start(); run(3); const p = nest();
  queued.push(lethal(p)); step();
  const at = state(); run(1.5);
  cases.lethalWithNest = { at, after: state() };
}
// C: a lethal hit while she is the egg.
{
  start(); run(3); const p = nest();
  queued.push(ordinary(p)); step(); run(0.4);
  const egg = state();
  queued.push(lethal(p)); step();
  const at = state(); run(2);
  cases.lethalInEgg = { egg, at, after: state() };
}
// The next fight after a death in the egg starts clean.
{
  start(); run(1);
  cases.cleanAfterEggDeath = state();
}
// Blood Pact (nothing heals): what her rise leaves her with.
{
  start(['blood']); run(3); const p = nest();
  queued.push(ordinary(p)); step(); run(1.5);
  cases.riseWithBloodPact = state();
}
// Stubborn and Phoenix Heart beside Ashborn: which goes first, and what is left for the next killing blow.
for (const up of ['stubborn', 'phoenix']) {
  start([up]); run(3); let p = nest();
  queued.push(ordinary(p)); step();
  const first = state(); run(1.5);
  const risen = state();
  p = d.heroRt.self().group.position;
  queued.push(ordinary(p)); step();
  const second = state(); run(0.5);
  p = d.heroRt.self().group.position;
  queued.push(ordinary(p)); step();
  const third = state(); run(0.5);
  cases['with_' + up] = { first, risen, second, third, after: state() };
}
delete performance.now;
console.error = logError;
return { cases, errors };
