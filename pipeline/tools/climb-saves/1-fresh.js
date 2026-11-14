// The Climb's saves, run 1 of 4 (README.md beside this file): a fresh browser, the menu, floor 1 from the menu; then the saves of
// the five-floor Climb are written for run 2 to find after a reload.
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const fails = [];
const expect = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const keys = () => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('tower.world.')).map((k) => [k, localStorage.getItem(k)]));
document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>');

expect('fresh: no climb saves', Object.keys(keys()).filter((k) => k !== 'tower.world.version'), []);
localStorage.setItem('tower.tab', 'climb');
game.go('tower');
await wait(1500);
const tiles = [...document.querySelectorAll('.wc-t')];
expect('tiles', tiles.length, 50);
const cls = (n) => document.querySelector(`.wc-t[data-floor="${n}"]`)?.className.replace('wc-t ', '');
expect('floor 1', cls(1), 'open on');
expect('floor 2 (made, not reached)', cls(2), 'locked');
expect('floor 10 (the crown)', cls(10), 'locked crown');
expect('floor 11 (the Wood)', cls(11), 'locked');
expect('floor 12 (not made)', cls(12), 'soon');
expect('floor 20', cls(20), 'soon crown');
expect('chapters', [...document.querySelectorAll('.wc-ch-h b')].map((b) => b.textContent), ['The Sea', 'The Wood', 'The Sands', 'The Deep', 'The War']);
expect('start button', document.querySelector('[data-act="start"]')?.textContent.trim(), 'Start floor 1');
const fl = await import('/src/tower/world/floors/index.ts');
expect('next floor that exists', [1, 9, 10, 11, 21, 31, 39, 40, 41].map(fl.floorAbove), [2, 10, 11, 21, 31, 32, 40, 41, null]);
expect('floors that exist', fl.builtFloors(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]);
expect('ids', [11, 21, 31, 41].map((n) => fl.FLOORS[n].id), ['wood', 'canyon', 'deep', 'banners']);
document.querySelector('.wc-pick').scrollIntoView({ block: 'start' });
await wait(300);
await __shot('climb-fresh-phone-1');
document.querySelector('.wc-ch[data-chapter="deep"]').scrollIntoView({ block: 'start' });
await wait(300);
await __shot('climb-fresh-phone-2');

// Floor 1 from the menu's Start button.
document.querySelector('[data-act="start"]').click();
await wait(6000);
const g = game.world.game;
expect('started from the menu', g && { n: g.floor.n, id: g.floor.id }, { n: 1, id: 'harbour' });
await __shot('climb-fresh-phone-floor1');
game.world.exit();
await wait(500);

// The saves as the five-floor Climb left them: floor 3 may be begun (floors 1 and 2 cleared), a climb in progress on floor 3.
for (const k of Object.keys(keys())) localStorage.removeItem(k);
localStorage.setItem('tower.world.floor', '3');
localStorage.setItem('tower.world.stars', JSON.stringify({ 1: [1, 1, 1, 0], 2: [1, 0, 1, 1] }));
localStorage.setItem('tower.world.times', JSON.stringify({ 1: 512.3, 2: 777.7 }));
localStorage.setItem('tower.world.sigils', JSON.stringify(['tw-edge']));
localStorage.setItem('tower.world.run', JSON.stringify({
  floor: 3, hero: 'Lyra', lives: 2, shards: 55, boons: [['tw-edge', 1]], arrived: { boons: [['tw-edge', 1]], shards: 0 }, hp: 0.8,
  quests: { main: { taken: true, step: 1, progress: 0, done: false, handedIn: false } }, packsCleared: [], caches: [], lore: [], waystones: [],
  lastWaystone: null, rival: 'none', clock: 123.4, won: [], relics: [], carry: null, opened: [], lit: [], hintShown: [], falls: 1, trialLost: 0,
  bought: [], result: null, kills: 7,
}));
return { ok: !fails.length, fails, written: keys() };
