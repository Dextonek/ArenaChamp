// The Climb's saves, run 4 of 4 (README.md beside this file): saves already in the new numbering stay where they are after a reload;
// floor 2 (a made floor of the sea) is started from the menu.
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const fails = [];
const expect = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const json = (k) => JSON.parse(localStorage.getItem(k) ?? 'null');
document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>');

localStorage.setItem('tower.tab', 'climb');
game.go('tower');
await wait(1500);
expect('floor reached', json('tower.world.floor'), 6);
expect('stars', json('tower.world.stars'), { 1: [1, 1, 1, 1], 2: [1, 1, 0, 0], 3: [1, 0, 0, 1], 4: [1, 1, 1, 0], 5: [1, 0, 1, 0] });
expect('times', json('tower.world.times'), { 1: 400, 2: 500, 3: 600, 4: 700, 5: 800 });
expect('the run', json('tower.world.run')?.floor, 3);
const cls = (n) => document.querySelector(`.wc-t[data-floor="${n}"]`)?.className.replace('wc-t ', '');
expect('floor 6', cls(6), 'open on');
expect('floor 7', cls(7), 'locked');
expect('continue', document.querySelector('[data-act="start"]')?.textContent.trim(), 'Continue floor 3');

// Floor 2 picked and begun again from the menu (not the saved run on 3).
document.querySelector('.wc-t[data-floor="2"]').click();
await wait(400);
expect('picked', document.querySelector('.wc-pick')?.dataset.picked, '2');
expect('again button', document.querySelector('[data-act="again"]')?.textContent.trim(), 'Begin floor 2 again');
await __shot('climb-new-desktop-picked2');
document.querySelector('[data-act="again"]').click();
await wait(7000);
const g = game.world.game;
expect('started floor 2', g && { n: g.floor.n, id: g.floor.id }, { n: 2, id: 'sea-02' });
await __shot('climb-new-desktop-floor2');
game.world.exit();
await wait(500);
return { ok: !fails.length, fails, floor2: g && { name: g.floor.name, id: g.floor.id } };
