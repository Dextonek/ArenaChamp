// A CPU duel for the heroes' model review (docs/heroes/review/), filmed from the game's own camera at the moments that
// tell whether a hero faces where it casts and its spells leave from its hand or weapon: each cast (two frames: as it
// strikes and 0.3 s later, when a bolt is on its way) and each basic attack, close round the hero.
//   python pipeline/tools/page-shots.py pipeline/tools/hero-review-duel.js <out> --page "/game?arena=temple&hero=Kaia&foe=Sefu" --port 5197
// It returns `duel` (one strip of up to 12 close frames) and `wide` (the whole arena at the first cast).
const q = new URLSearchParams(location.search);
const hero = q.get('hero'), foe = q.get('foe') ?? 'Sefu', seconds = +(q.get('sec') ?? 24);
const t00 = performance.now();
while (!(window.game && game.api) && performance.now() - t00 < 120000) await new Promise((r) => setTimeout(r, 200));
game.cpu.start({ hero, foe, level: 3 });
const api = game.api, d = api.duel;
while (!(d.on && d.heroRt && d.foe && !d.waiting && d.countdown < 0) && performance.now() - t00 < 150000) await new Promise((r) => setTimeout(r, 200));
await new Promise((r) => setTimeout(r, 300));
api.view.paused = true;
let simMs = performance.now();
performance.now = () => simMs;
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
d.autopilot = true;
const fig = d.host.heroMode.figure;
const events = [];
let f = 0;
const cast = fig.cast.bind(fig);
fig.cast = (style, s, big) => { events.push({ at: f + 7, label: `${style}${big ? ' (R)' : ''}` }, { at: f + 24, label: `${style} +0.3 s` }); events.sort((a, b) => a.at - b.at); return cast(style, s, big); };
const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
const C = 300, N = 12, strip = document.createElement('canvas');
strip.width = C * 6;
strip.height = (C + 18) * 2;
const g = strip.getContext('2d');
g.fillStyle = '#111';
g.fillRect(0, 0, strip.width, strip.height);
let shots = 0, wide = null, lastRel = 0, attacks = 0;
const grab = (label) => {
  api.render();
  const grp = d.host.arena.caster.group, cam = d.host.arena.camera;
  const p = grp.getWorldPosition(grp.position.clone());
  p.y += 1.2;
  p.project(cam);
  const sx = ((p.x + 1) / 2) * gl.width, sy = ((1 - p.y) / 2) * gl.height, s = gl.height * 0.3;
  const x = (shots % 6) * C, y = Math.floor(shots / 6) * (C + 18);
  g.drawImage(gl, sx - s / 2, sy - s * 0.55, s, s, x, y + 18, C, C);
  g.fillStyle = '#fc8';
  g.font = '13px sans-serif';
  g.fillText(`${(f / 60).toFixed(1)} s ${label}`, x + 4, y + 13);
  if (!wide) {
    const w = document.createElement('canvas');
    w.width = 960;
    w.height = (960 * gl.height) / gl.width;
    w.getContext('2d').drawImage(gl, 0, 0, w.width, w.height);
    wide = w.toDataURL('image/jpeg', 0.85);
  }
  shots++;
};
try {
  for (; f < 60 * seconds && shots < N && !d.result; f++) {
    simMs += 1000 / 60;
    api.step(1 / 60);
    const m = d.heroRt?.attacker?.motion ?? d.host.heroMode.attacker?.motion;
    const rel = m?.release ?? 0;
    if (rel > 0 && lastRel <= 0 && attacks < 2 && !events.length) { attacks++; events.push({ at: f + 2, label: 'attack' }); }
    lastRel = rel;
    while (events.length && events[0].at <= f && shots < N) grab(events.shift().label);
  }
} finally {
  delete performance.now;
}
return { duel: strip.toDataURL('image/jpeg', 0.85), wide, hero, foe, shots, time: +(f / 60).toFixed(1), over: !!d.result };
