// The Climb's saves, run 2 of 4 (README.md beside this file): after a reload, run 1's five-floor saves are in the 50-floor numbering.
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const fails = [];
const expect = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const keys = () => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('tower.world.')).map((k) => [k, localStorage.getItem(k)]));
const json = (k) => JSON.parse(localStorage.getItem(k) ?? 'null');
document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>');

localStorage.setItem('tower.tab', 'climb');
game.go('tower');
await wait(1500);
const after = keys();
expect('version', json('tower.world.version'), 2);
expect('floor reached', json('tower.world.floor'), 21);
expect('stars', json('tower.world.stars'), { 1: [1, 1, 1, 0], 11: [1, 0, 1, 1] });
expect('times', json('tower.world.times'), { 1: 512.3, 11: 777.7 });
expect('sigils', json('tower.world.sigils'), ['tw-edge']);
const run = json('tower.world.run');
expect('the run', run && { floor: run.floor, hero: run.hero, clock: run.clock, shards: run.shards, lives: run.lives, main: run.quests.main.step }, { floor: 21, hero: 'Lyra', clock: 123.4, shards: 55, lives: 2, main: 1 });

const cls = (n) => document.querySelector(`.wc-t[data-floor="${n}"]`)?.className.replace('wc-t ', '');
expect('floor 1 (cleared)', cls(1), 'done');
expect('floor 2 (made, below 21: open)', cls(2), 'open');
expect('floor 10', cls(10), 'open crown');
expect('floor 11 (the Wood, cleared as old 2)', cls(11), 'done');
expect('floor 12 (made, below 21: open)', cls(12), 'open');
expect('floor 42 (made, not reached)', cls(42), 'locked');
expect('floor 21 (picked: the furthest reached)', cls(21), 'open on');
expect('floor 31', cls(31), 'locked');
expect('continue button', document.querySelector('[data-act="start"]')?.textContent.trim(), 'Continue floor 21');
document.querySelector('.wc-pick').scrollIntoView({ block: 'start' });
await wait(300);
await __shot('climb-migrated-phone-1');
document.querySelector('.wc-ch[data-chapter="sands"]').scrollIntoView({ block: 'start' });
await wait(300);
await __shot('climb-migrated-phone-2');

// Continue: the Storm Canyon, with the run's quest step, shards, lives and clock.
document.querySelector('[data-act="start"]').click();
await wait(7000);
const g = game.world.game;
expect('continued', g && { n: g.floor.n, id: g.floor.id, hero: g.run.hero, main: g.run.q('main').step, shards: g.run.shards, lives: g.run.lives, clockAtLeast: g.run.clock >= 123.4 },
  { n: 21, id: 'canyon', hero: 'Lyra', main: 1, shards: 55, lives: 2, clockAtLeast: true });
await __shot('climb-migrated-phone-canyon');
game.world.exit();
await wait(500);
expect('left: the run saved on 21', json('tower.world.run')?.floor, 21);
return { ok: !fails.length, fails, migrated: after };
