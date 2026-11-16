// The model review, round 2 (docs/models/review/round2/, "Where shots leave"): a Climb archer's or thrower's shot, seen from the side at
// the moment it leaves. On each [floor, pack, look] of `window._shots` the pack is woken beside the hero; the first time a unit of that look
// has just shot (its `shot` near 1) the camera is put to its side at a person's height and the frame is taken: where the bolt is
// drawn against the unit's hand. Also returned: the bolt's height and the unit's hand heights then.
//   MSYS_NO_PATHCONV=1 python -I pipeline/tools/world-shots.py pipeline/tools/shot-origin.js --page /game --port 5179 --out <folder>
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const SHOTS = window._shots ?? [[41, 'a-r', 'bowman-r'], [21, 'well1', 'slinger']];
const out = [];
const hide = document.createElement('style');
hide.textContent = 'body > *:not(#app){display:none!important}';
for (const [floor, packId, look] of SHOTS) {
  await _world({ floor, hero: 'Sefu' });
  _world.packs(false);
  const g = _world.game(), z = g.zone, api = window.game.api, cam = api.heroMode.host.camera;
  api.duel.hurtHero = () => {};
  _world.step(0.5);
  await new Promise((r) => setTimeout(r, 2500));
  const p = [...z.packs.values()].find((q) => q.id === packId);
  if (!p?.home) { out.push({ floor, packId, error: 'no pack' }); _world.end(); continue; }
  for (const u of api.arena.summons.alive('opponent')) api.arena.summons.dismiss(u);
  _world.go(p.home.x + 7, p.home.z + 2);
  _world.packs(true);
  _world.step(0.2);
  try { p.wake?.('probe'); } catch (e) { /* asleep is fine */ }
  const hero = api.arena.caster.group.position;
  let done = false;
  for (let k = 0; k < 600 && !done; k++) {
    _world.step(1 / 60);
    hero.set(p.home.x + 7, hero.y, p.home.z + 2);
    for (const u of api.arena.summons.alive('opponent')) {
      const s = (p.slots ?? []).find((q) => q.unit === u);
      if (s?.spec?.look !== look || !(u.shot > 0.93)) continue;
      const dx = hero.x - u.pos.x, dz = hero.z - u.pos.z, L = Math.hypot(dx, dz) || 1;
      // the side: across the line from the unit to the hero
      const sx = -dz / L, sz = dx / L;
      cam.position.set(u.pos.x + dx / L * 1.5 + sx * 5, 1.5, u.pos.z + dz / L * 1.5 + sz * 5);
      cam.lookAt(u.pos.x + dx / L * 1.5, 1.3, u.pos.z + dz / L * 1.5);
      cam.updateMatrixWorld();
      document.head.append(hide);
      api.render();
      await __shot(`shot-f${floor}-${look}`);
      hide.remove();
      const hands = {};
      u.figure.group.traverse((o) => { if (o.name === 'hand_r' || o.name === 'hand_l') hands[o.name] = +o.getWorldPosition(hero.clone()).y.toFixed(2); });
      out.push({ floor, look, hands, boltY: 1.1 });
      done = true;
      break;
    }
  }
  if (!done) out.push({ floor, look, error: 'no shot seen in 10 s' });
  _world.end();
}
return out;
