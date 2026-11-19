// Pictures of the CPU's Wick placing his doors in a real CPU duel (2026-11-19: his first door now goes to his side, off his own line
// of fire). The body of an async function run in the tool page by page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python pipeline/tools/page-shots.py pipeline/tools/wick-door-shots.js docs/balance --browser msedge --port 5182
//
// A 'run' duel (both sides played by the balance CPU), Wick against Brannoc. One sheet: three moments of each of several fights, the
// first door standing, the pair standing, a key in flight. Also returns, for every first door of many fights in every arena, whether it
// landed in a wall and how far off his line of fire it stood (only doors 2.2 m from him: a second door aimed at the enemy while an
// old one runs out also leaves one door standing, and is not counted).
const D = await import('/src/heroes/door/trait.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const { fightNow } = await import('/src/fightClock.ts');
const d = vfx.duel, cam = vfx.controls.object;
const realNow = performance.now.bind(performance);
let simMs = realNow();
performance.now = () => simMs;
const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
const W = 520, H = 330;
const step = (n = 1) => { for (let i = 0; i < n; i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
const wait = async (ms) => { for (let k = 0; k < ms / 100; k++) { await new Promise((r) => setTimeout(r, 100)); simMs += 100; } };
const start = async (arena, foe = 'Brannoc', look = true) => {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  if (vfx.heroPickCtrl.getValue() !== 'Wick') vfx.heroPickCtrl.setValue('Wick');
  d.opponentChoice = foe;
  d.cpuLevel = CPU_BALANCE;
  d.arenaChoice = arena;
  d.hazardsInRuns = false;
  d.shiftsInRuns = false;
  d.start('run');
  if (look) {
    const t0 = realNow();
    while (!(vfx.heroMode.figure?.loaded && d.figure?.loaded) && realNow() - t0 < 20000) await wait(100);
    await wait(1500);
  }
};
const sheet = (cols, rows) => {
  const c = document.createElement('canvas');
  c.width = W * cols; c.height = H * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  return { c, g, n: 0, cols };
};
const shot = (s, label, mid) => {
  const keep = { p: cam.position.clone(), q: cam.quaternion.clone() };
  cam.position.set(mid[0], 9, mid[1] + 6.5);
  cam.lookAt(mid[0], 0.8, mid[1]);
  cam.updateMatrixWorld();
  vfx.render();
  const sw = gl.width, sh = gl.height, ar = W / H;
  let cw = sw, ch = sw / ar;
  if (ch > sh) { ch = sh; cw = sh * ar; }
  const x = (s.n % s.cols) * W, y = Math.floor(s.n / s.cols) * H;
  s.g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, W, H);
  s.g.font = '600 15px system-ui, sans-serif';
  s.g.fillStyle = 'rgba(0,0,0,0.6)';
  s.g.fillRect(x, y, s.g.measureText(label).width + 16, 24);
  s.g.fillStyle = '#fff';
  s.g.fillText(label, x + 8, y + 17);
  s.n++;
  cam.position.copy(keep.p); cam.quaternion.copy(keep.q);
};
const me = () => vfx.arena.caster.group.position;
const book = () => D.doorBooks.get(vfx.arena.caster);
const mid = (...ps) => [ps.reduce((a, p) => a + p.x, 0) / ps.length, ps.reduce((a, p) => a + p.z, 0) / ps.length];
const out = { fights: [], doors: [] };

// The sheet: three fights, three moments each.
const s = sheet(3, 3);
for (const arena of ['temple', 'battlefield', 'frost']) {
  await start(arena);
  const rec = { arena, first: null, pair: false, key: false };
  let f = 0, phase = 0, keyAt = -1;
  while (!d.result && f < 60 * 40 && phase < 3) {
    step(); f++;
    const b = book(), now = fightNow();
    // 0.4 s after a door rose: it stands up straight by then
    const st = b ? D.standingDoors(b, now).filter((k) => now - k.bornAt > 400) : [];
    if (phase === 0 && st.length >= 1) {
      const dr = st[0], e = d.foe.group.position, p = me();
      rec.first = { at: +(f / 60).toFixed(1), door: [+dr.x.toFixed(1), +dr.z.toFixed(1)], wick: [+p.x.toFixed(1), +p.z.toFixed(1)], foe: [+e.x.toFixed(1), +e.z.toFixed(1)] };
      shot(s, `${arena}: his first door, beside him`, mid(p, e, dr));
      phase = 1;
    } else if (phase === 1 && st.length === 2) {
      shot(s, `${arena}: the pair, the second at Brannoc`, mid(me(), d.foe.group.position, st[0], st[1]));
      rec.pair = true; phase = 2;
    } else if (phase === 2) {
      // A key thrown: Key Toss's cooldown jumps up; the key is in the air 0.3 s (wind-up) + 0.15 s later.
      const cd = d.heroRt?.cooldownLeft(0) ?? 0;
      if (cd > 3 && keyAt < 0) keyAt = f;
      if (keyAt >= 0 && f - keyAt === 27) {
        shot(s, `${arena}: a key thrown with the doors up`, mid(me(), d.foe.group.position));
        rec.key = true; phase = 3;
      }
    }
  }
  while (s.n % 3) shot(s, `${arena}: (fight ended first)`, mid(me(), d.foe.group.position));
  out.fights.push(rec);
}
out.sheet = s.c.toDataURL('image/jpeg', 0.88);

// Every first door of a few fights in every arena: in a wall? how far off the line from him to the enemy?
const { ARENAS } = await import('/src/arenas/index.ts');
for (const a of ARENAS.map((x) => x.id)) {
  for (const foe of ['Brannoc', 'Kaia']) {
    await start(a, foe, false);
    let f = 0, seen = 0;
    const firstIds = new Set();
    let lastCount = 0;
    while (!d.result && f < 60 * 30) {
      const p = me().clone(), e = d.foe.group.position.clone();
      step(); f++;
      const b = book();
      if (!b) continue;
      const doors = D.placedDoors(b, fightNow());
      if (doors.length === 1 && lastCount === 0 && !firstIds.has(doors[0].id)) {
        const dr = doors[0];
        firstIds.add(dr.id);
        const walls = vfx.arena.obstacles ?? [];
        const segD = (o) => { const lx = o.bx - o.ax, lz = o.bz - o.az, l2 = lx * lx + lz * lz || 1; const k = Math.max(0, Math.min(1, ((dr.x - o.ax) * lx + (dr.z - o.az) * lz) / l2)); return Math.hypot(o.ax + lx * k - dr.x, o.az + lz * k - dr.z); };
        const inWall = walls.some((o) => segD(o) < o.r + 0.3);
        // the angle between "him to the door" and "him to the enemy"
        const a1 = Math.atan2(dr.x - p.x, dr.z - p.z), a2 = Math.atan2(e.x - p.x, e.z - p.z);
        let off = Math.abs(a1 - a2) * 180 / Math.PI; if (off > 180) off = 360 - off;
        const b2 = vfx.arena.bounds;
        out.doors.push({ dd: +Math.hypot(dr.x - p.x, dr.z - p.z).toFixed(2), arena: a, foe, off: Math.round(off), inWall, outside: b2 ? Math.hypot(dr.x - b2.x, dr.z - b2.z) > b2.r : false });
        seen++;
      }
      lastCount = doors.length;
    }
  }
}
out.doors = out.doors.filter((x) => Math.abs(x.dd - 2.2) < 0.15);
out.summary = {
  firstDoors: out.doors.length,
  inWall: out.doors.filter((x) => x.inWall).length,
  outside: out.doors.filter((x) => x.outside).length,
  offLine: out.doors.filter((x) => x.off >= 60).length,
};
vfx.view.paused = false;
return out;
