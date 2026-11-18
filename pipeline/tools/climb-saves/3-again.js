// The Climb's saves, run 3 of 4 (README.md beside this file): a second reload moves nothing again, nor does the migration called
// by hand; then saves in the new numbering on floors 2 to 5 (the sea's made floors) are written for run 4.
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const fails = [];
const expect = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const keys = () => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('tower.world.')).map((k) => [k, localStorage.getItem(k)]));
const json = (k) => JSON.parse(localStorage.getItem(k) ?? 'null');
document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>');

localStorage.setItem('tower.tab', 'climb');
game.go('tower');
await wait(1500);
expect('version', json('tower.world.version'), 2);
expect('floor reached', json('tower.world.floor'), 21);
expect('stars', json('tower.world.stars'), { 1: [1, 1, 1, 0], 11: [1, 0, 1, 1] });
expect('times', json('tower.world.times'), { 1: 512.3, 11: 777.7 });
expect('the run', json('tower.world.run')?.floor, 21);
const before = keys();
const state = await import('/src/tower/world/state.ts');
state.migrateSaves();
expect('the migration again by hand changes nothing', keys(), before);
document.querySelector('.wc-pick').scrollIntoView({ block: 'start' });
await wait(300);
await __shot('climb-migrated-desktop');

// Saves in the new numbering on the sea's floors 2 to 5, the version set: run 4 must find them where they are.
localStorage.setItem('tower.world.floor', '6');
localStorage.setItem('tower.world.stars', JSON.stringify({ 1: [1, 1, 1, 1], 2: [1, 1, 0, 0], 3: [1, 0, 0, 1], 4: [1, 1, 1, 0], 5: [1, 0, 1, 0] }));
localStorage.setItem('tower.world.times', JSON.stringify({ 1: 400, 2: 500, 3: 600, 4: 700, 5: 800 }));
const run = json('tower.world.run');
localStorage.setItem('tower.world.run', JSON.stringify({ ...run, floor: 3 }));
return { ok: !fails.length, fails };
