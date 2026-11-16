// The Climb review, part 3 (docs/tower/review/): pictures of a floor as a player sees it (HUD, minimap, cards and all) and a frame check.
// A body for climb-review.py:
//   python -I pipeline/tools/climb-review.py pipeline/tools/climb-review-shots.js --floor 1 --out docs/tower/review/floors-01-30/f01
//   ... --size 390x844 --touch --json phone      (the phone: fewer pictures, prefixed `phone-`)
// Pictures: the start (with the floor's card), the camp, the M map, every person with their card open, every pack at home (awake, so
// they stand as in a fight), every door, the lore stone, a view from high over the floor, and the worst props the static part flagged
// (it reads static.json beside it). The frame check: the hero at the floor's busiest spot (most units within 18 m), every pack near it
// awake, 240 frames of step + tick + render (gl.finish), three times. The machine is shared: treat times as rough.
const R = window.__review;
const n = R.floor;
const out = (R.out = { floor: n, shots: [] });
const phone = !!R.phone;
const pre = phone ? 'phone-' : '';
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
const api = window.game.api;
const r1 = (v) => Math.round(v * 10) / 10;
await _world({ floor: n, hero: R.hero ?? 'Lyra', mode: 'play' });
const g = _world.game(), def = g.floor, z = g.zone;
const cam = api.heroMode.host?.camera ?? api.camera;
const shot = async (name) => { await new Promise((ok) => requestAnimationFrame(() => ok())); api.render(); await __shot(pre + name); out.shots.push(pre + name); };
const settle = (s = 0.5) => { _world.step(s); api.render(); };
const closeCards = () => { try { z.hud.closeCard(); } catch (e) { /* none */ } for (const b of document.querySelectorAll('button')) if (/^(Begin|Go|Start|OK|Close|Continue|Onward)$/i.test(b.textContent.trim()) && b.offsetParent) b.click(); };
let staticData = null;
try { staticData = (await (await fetch(`/docs/tower/review/floors-01-30/f${String(n).padStart(2, '0')}/static.json`)).json()).result; } catch (e) { /* not there */ }

// 1. the start, as it opens
settle(1.2);
await shot('start');
closeCards();
settle(0.4);
await shot('camp');
// 2. the map (M; on a phone, a tap on the minimap)
// the minimap shows once the zone's first frames are drawn (map.ts `setZone`): wait for it (at most 10 s)
for (let i = 0; i < 100 && !g.map?.shown; i++) { settle(0.1); await new Promise((ok) => setTimeout(ok, 100)); }
out.minimapShown = !!g.map?.shown;
dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
settle(0.2);
out.mapOpened = !!g.map?.isOpen;
await shot('map');
if (g.map?.isOpen) g.map.toggle(false);
settle(0.2);
// 3. every person, standing in front of them, the card open
z.setPacks(false);
for (const p of def.people) {
  _world.go(p.at.x + Math.sin(p.face) * 2.2, p.at.z + Math.cos(p.face) * 2.2);
  settle(0.6);
  try { z.people.talk(p.id); } catch (e) { out[`talk-${p.id}`] = String(e); }
  settle(0.2);
  await shot(`person-${p.id}`);
  closeCards();
  if (phone) break;
}
if (!phone) {
  // 4. every pack at home, awake (standing as they fight), the hero 9 m off
  z.setPacks(true);
  for (const p of def.packs) {
    const h = p.named ? p.named.patrol[0] : p.at;
    _world.go(h.x + 7, h.z + 6);
    settle(1.2);
    await shot(`pack-${p.id}`);
    _world.go(def.start.x, def.start.z);
    settle(2.5);
  }
  z.setPacks(false);
  // 5. the doors and the lore stone
  for (const d of def.doors) { _world.go(d.at.x + 3, d.at.z + 3); settle(0.6); await shot(`door-${d.id}`); closeCards(); }
  _world.go(def.lore.at.x + 2.5, def.lore.at.z + 2.5); settle(0.6); await shot('lore'); closeCards();
  // 6. the floor from the south edge, low (the fog hides a view from high)
  const R0 = def.ring;
  cam.position.set(0, 38, 7 + R0 * 0.75); cam.lookAt(0, 0, 7 - R0 * 0.1); cam.updateMatrixWorld(); api.render();
  await __save(`${pre}overview`, api.renderer.domElement.toDataURL('image/jpeg', 0.82)); out.shots.push(`${pre}overview`);
  // 7. the props the static part flagged worst (float and gap), from low beside them
  const hits = [];
  for (const kind of ['float', 'gap', 'cover']) for (const h of (staticData?.props?.[kind] ?? []).slice(0, kind === 'gap' ? 3 : 4)) {
    const m = /^(-?[\d.]+),(-?[\d.]+) y(-?[\d.]+)/.exec(h);
    if (m) hits.push({ kind, x: +m[1], z: +m[2], y: +m[3], text: h });
  }
  let k = 0;
  for (const h of hits) {
    cam.position.set(h.x - 6, h.y + 3, h.z + 8); cam.lookAt(h.x, h.y, h.z); cam.updateMatrixWorld(); api.render();
    const name = `${pre}probe-${h.kind}-${k++}`;
    await __save(name, api.renderer.domElement.toDataURL('image/jpeg', 0.82)); out.shots.push(name);
    out[name] = h.text;
  }
  // 8. the frame check at the busiest spot
  const spot = staticData?.check?.mostUnitsNear?.at;
  if (spot) {
    _world.go(spot[0], spot[1]);
    z.setPacks(true);
    settle(0.5);
    for (const p of z.packs.values()) { const h = p.def?.at ?? p.at ?? p.home; if (!h || Math.hypot(h.x - spot[0], h.z - spot[1]) < 20) try { p.wake?.(); } catch (e) { /* asleep */ } }
    try { z.wakeAll?.(); } catch (e) { /* none */ }
    settle(1);
    await shot('busy');
    const gl = api.renderer.getContext();
    const runs = [];
    for (let r = 0; r < 3; r++) {
      const whole = [];
      for (let i = 0; i < 240; i++) {
        const t0 = performance.now();
        api.step(1 / 60); g.tick(1 / 60); api.render(); gl.finish();
        whole.push(performance.now() - t0);
        if (i % 60 === 59) await new Promise((ok) => setTimeout(ok, 0));
      }
      whole.sort((a, b) => a - b);
      runs.push({ med: r1(whole[120]), p95: r1(whole[228]), worst: r1(whole[239]) });
    }
    out.frames = { at: spot, units: api.arena.summons.alive('opponent').length, runs };
  }
  // 9. the ruler's piece in real time: does its own model load, and how long does it take?
  const door = def.doors.find((d) => d.piece === 'ruler');
  if (door) {
    z.setPacks(false);
    g.enterDoor(door);
    const t0 = performance.now();
    let i = 0;
    while (performance.now() - t0 < 25000) {
      api.step(1 / 60); g.tick(1 / 60);
      if (++i % 4 === 0) await new Promise((ok) => setTimeout(ok, 16));
      const fig = api.duel?.figure;
      if (g.piece === 'ruler' && fig?.loaded && i > 480) break;
    }
    const k = api.duel?.opponentKit, fig = api.duel?.figure;
    out.ruler = { name: k?.name, title: k?.title, model: k?.model, loaded: !!fig?.loaded, real: !!fig?.real, wallMs: Math.round(performance.now() - t0), frames: i };
    api.render();
    await shot('ruler');
  }
} else {
  // the phone: a fight (the nearest pack awake) and the HUD over it
  z.setPacks(true);
  const p = def.packs[0], h = p.named ? p.named.patrol[0] : p.at;
  _world.go(h.x + 5, h.z + 4);
  settle(3);
  await shot('fight');
}
out.status = _world.status();
_world.end();
return out;
