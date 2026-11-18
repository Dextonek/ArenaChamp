// The model review, round 2 (docs/models/review/round2/): the Climb enemies' health bars in their own floors, as a player sees them.
// For each look of `window._looks` (default: the 16 whose bars the first round set from measurements), the first pack on the floors
// of `window._floors` that has it is woken beside the hero; for 3 s each unit of that look is measured every few frames: the top of
// its figure (visible meshes, the bar left out) against the bar's height. A shot from the game's camera (the hero's own zoom) and a
// close one. On the game page, at a phone's size:
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py pipeline/tools/bar-probe.js --page /game --port 5179 --size 844x390 --out <folder>
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const LOOKS = window._looks ?? ['mate', 'barnacle', 'oak', 'raider', 'chief', 'thief', 'pale', 'footman-r', 'footman-b', 'ashen', 'bowman-r', 'bowman-b', 'knight-r', 'knight-b', 'bearer', 'deserter'];
const FLOORS = window._floors ?? [2, 3, 5, 11, 12, 15, 21, 22, 25, 31, 32, 35, 41, 42, 43, 45, 47, 49];
const left = new Set(LOOKS);
const res = [];
const r2 = (x) => +x.toFixed(2);
for (const floor of FLOORS) {
  if (!left.size) break;
  await _world({ floor, hero: 'Sefu' });
  const g = _world.game(), z = g.zone, api = window.game?.api;
  const cam = api.heroMode.host?.camera;
  // The hero takes nothing: the packs fight on.
  api.duel.hurtHero = () => {};
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 3000));
  for (const p of z.packs.values()) {
    const looks = [...new Set((p.slots ?? []).map((s) => s.spec?.look).filter((l) => left.has(l)))];
    if (!looks.length) continue;
    _world.packs(false);
    // the last pack's units out of the way: the summon cap holds them, and a new pack would not come
    for (const u of api.arena.summons.alive('opponent')) api.arena.summons.dismiss(u);
    _world.step(0.3);
    const home = p.home;
    if (!home) continue;
    _world.go(home.x + 6, home.z + 3);
    _world.packs(true);
    _world.step(0.2);
    try { p.wake?.('probe'); } catch (e) { /* asleep is fine */ }
    const rows = new Map();
    const hero = api.arena.caster.group.position;
    for (let k = 0; k < 90; k++) {
      _world.step(2 / 60);
      hero.set(home.x + 6, hero.y, home.z + 3);
      if (k % 3) continue;
      for (const u of api.arena.summons.alive('opponent')) {
        const fig = u.figure, look = (p.slots ?? []).find((s) => s.unit === u)?.spec?.look;
        const bar = fig.bar;
        if (!bar || !look) continue;
        fig.group.updateMatrixWorld(true);
        let top = -1e9;
        const v = hero.clone();
        fig.group.traverse((m) => {
          if (!m.isMesh) return;
          for (let q = m; q; q = q.parent) { if (q === bar || !q.visible) return; if (q === fig.group) break; }
          const P = m.geometry.attributes.position;
          for (let i = 0; i < P.count; i += 3) { if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(P, i); v.applyMatrix4(m.matrixWorld); top = Math.max(top, v.y); }
        });
        const key = u;
        const row = rows.get(key) ?? { look: look ?? null, tops: [], bar: 0, ground: fig.group.position.y };
        row.tops.push(top);
        row.bar = bar.position.y;
        row.ground = fig.group.position.y;
        rows.set(key, row);
      }
      if (k === 45) {
        api.heroMode.setZoom(1.25);
        _world.step(1 / 60);
        await __shot(`bars-f${floor}-${p.id}-game`);
      }
    }
    const us = api.arena.summons.alive('opponent');
    if (us.length) {
      const c = us.reduce((a, u) => a.add(u.pos), us[0].pos.clone().multiplyScalar(0)).multiplyScalar(1 / us.length);
      const tall = Math.max(...[...rows.values()].map((r) => Math.max(...r.tops) - r.ground), 2);
      // from the hero's side, a little above the bars, the page's own panels hidden
      const hx = hero.x - c.x, hz = hero.z - c.z, hl = Math.hypot(hx, hz) || 1;
      cam.position.set(c.x + (hx / hl) * tall * 2.6, c.y + tall * 1.25, c.z + (hz / hl) * tall * 2.6);
      cam.lookAt(c.x, c.y + tall * 0.75, c.z);
      cam.updateMatrixWorld();
      const hide = document.createElement('style');
      hide.textContent = 'body > *:not(#app){display:none!important}';
      document.head.append(hide);
      api.render?.();
      await __shot(`bars-f${floor}-${p.id}-close`);
      hide.remove();
    }
    for (const r of rows.values()) {
      const s = r.tops.slice().sort((a, b) => a - b);
      res.push({ floor, pack: p.id, look: r.look, barOverGround: r2(r.bar - r.ground), topMedian: r2(s[Math.floor(s.length / 2)] - r.ground), topMax: r2(s[s.length - 1] - r.ground), gapMedian: r2(r.bar - s[Math.floor(s.length / 2)]), gapMin: r2(r.bar - s[s.length - 1]) });
    }
    for (const l of looks) left.delete(l);
    _world.packs(false);
  }
  _world.end();
}
return { res, notFound: [...left] };
