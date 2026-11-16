// The model review (docs/models/review/): enemies in their own floors. Each floor of `window._plan` ([{ floor, packs: [ids] } or
// { floor, n }]) is started, its packs woken one at a time beside the hero, and for five seconds every unit is sampled: how far its
// facing is from the way it moves (`moveOff`), from the hero while it fights (`heroOff`), and how far the body's own hips are turned
// from the way it moves (`bodyOff`; `sideways` is the share over 50 degrees: a forward walk played sideways). A shot from the game's
// camera per pack. On the game page:
//
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py <a copy with window._plan=[...] first> --page /game --port 5195 --out <folder>
// In the world: each floor of PLAN, its packs woken one at a time near the hero; game-camera shots and a closer one; per unit:
// its facing against where it goes / its target, its top, its feet.
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const PLAN = window._plan ?? [{ floor: 2 }];
const res = [];
const deg = (r) => Math.round(r * 180 / Math.PI);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
for (const f of PLAN) {
  await _world({ floor: f.floor, hero: f.hero ?? 'Sefu' });
  const g = _world.game(), z = g.zone, api = window.game?.api ?? { heroMode: vfx.heroMode, arena: vfx.arena, render: () => vfx.step(0) };
  const cam = api.heroMode.host?.camera ?? api.camera;
  // the fight's files load when it begins
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 4000));
  const packs = [...z.packs.values()];
  const want = f.packs ? packs.filter((p) => f.packs.includes(p.id)) : packs.slice(0, f.n ?? 3);
  for (const p of want) {
    _world.packs(false);
    _world.step(0.3);
    const home = p.home;
    const at = home ? { x: home.x, z: home.z } : null;
    if (!at) { res.push({ floor: f.floor, pack: p.id, error: 'no home' }); continue; }
    _world.go(at.x + 7, at.z + 2);
    _world.packs(true);
    _world.step(0.2);
    try { p.wake?.("probe"); } catch (e) {}
    // run a little, sampling the units' facing against their motion and their target (the hero)
    const hero = api.arena.caster.group.position;
    const samples = [];
    const last = new Map();
    for (let k = 0; k < 150; k++) {
      _world.step(1 / 60 * 2);
      // keep the hero alive and still
      api.duel && (api.duel.heroHp = api.duel.heroMax);
      for (const u of api.arena.summons.alive('opponent')) {
        const pos = u.pos, prev = last.get(u);
        last.set(u, pos.clone());
        if (!prev) continue;
        const dx = pos.x - prev.x, dz = pos.z - prev.z, sp = Math.hypot(dx, dz) * 30;
        const yaw = u.figure.group.rotation.y;
        const toHero = Math.atan2(hero.x - pos.x, hero.z - pos.z);
        // the body's own facing: the hips' left-to-right line turned a quarter
        let body = null;
        { let tl = null, tr = null; u.figure.group.traverse((o) => { if (o.name === 'thigh_l') tl = o; if (o.name === 'thigh_r') tr = o; });
          if (tl && tr) { const a = tl.getWorldPosition(prev.clone()), b = tr.getWorldPosition(prev.clone()); const lx = a.x - b.x, lz = a.z - b.z; body = Math.atan2(-lz, lx); } }
        const mv = Math.atan2(dx, dz), bo = body === null ? null : Math.abs(deg(wrap(body - mv)));
        samples.push({ bodyOff: sp > 0.6 ? bo : null, moving: sp > 0.6, off: sp > 0.6 ? deg(wrap(yaw - Math.atan2(dx, dz))) : null, offHero: deg(wrap(yaw - toHero)), swing: u.swing, shot: u.shot, d: Math.hypot(hero.x - pos.x, hero.z - pos.z) });
      }
      if (k === 40) { api.heroMode.setZoom(0.55); _world.step(1 / 60); await __shot(`f${f.floor}-${p.id}-game`); }
    }
    // a closer view at the units
    const us = api.arena.summons.alive('opponent');
    if (us.length) {
      const c = us.reduce((a, u) => a.add(u.pos), us[0].pos.clone().multiplyScalar(0)).multiplyScalar(1 / us.length);
      const tall = Math.max(...us.map((u) => { u.figure.group.updateMatrixWorld(true); let top = 0; u.figure.group.traverse((o) => { if (o.isSkinnedMesh) { o.geometry.computeBoundingBox?.(); } }); return u.figure.group.scale.y; }));
      cam.position.set(c.x + 3.5, 2.6, c.z + 6.5);
      cam.lookAt(c.x, 1.0, c.z);
      cam.updateMatrixWorld();
      api.render?.();
      await __shot(`f${f.floor}-${p.id}-close`);
    }
    const mv = samples.filter((s) => s.moving).map((s) => Math.abs(s.off));
    const fight = samples.filter((s) => !s.moving && s.d < 12).map((s) => Math.abs(s.offHero));
    const pct = (a, q) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)] : null);
    const bo = samples.filter((s) => s.bodyOff !== null).map((s) => s.bodyOff);
    const side = bo.filter((x) => x > 50 && x < 130).length;
    res.push({ bodyN: bo.length, sideways: bo.length ? +(side / bo.length).toFixed(2) : null, bodyMed: pct(bo, 0.5), floor: f.floor, pack: p.id, units: us.length, movingN: mv.length, moveOffMed: pct(mv, 0.5), moveOff90: pct(mv, 0.9), fightN: fight.length, heroOffMed: pct(fight, 0.5), heroOff90: pct(fight, 0.9) });
    _world.packs(false);
  }
  _world.end();
}
return res;
