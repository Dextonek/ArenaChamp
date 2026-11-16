// The Climb's life (src/tower/world/life/): before and after pictures of a floor, the same spots with the life off and on.
// A body for world-shots.py; the first line of the script it runs sets `P`, e.g. (life-shots.py writes it):
//   const P = { floor: 12, spots: ['camp', 'v', [10, -40]], life: true, tier: 'full', tag: 'after', step: 4, hero: 'Lyra' };
//   python -I pipeline/tools/world-shots.py <that script> --page /game --port 5185 --out docs/tower/life/wood
// A spot is a place's id (the hero stands at its middle, offset `off` m south so the place is in view) or [x, z]. Packs are kept
// asleep (none wakes), so the two runs show the same floor. Returns the life's counts.
const st = document.createElement('style');
st.textContent = '*{animation:none!important;transition:none!important}';
document.head.append(st);
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
globalThis.__noLife = !P.life;
globalThis.__lifeTier = P.tier ?? undefined;
const api = window.game.api;
await _world({ floor: P.floor, hero: P.hero ?? 'Lyra', mode: 'play' });
const g = _world.game();
// the hero's figure and the floor's models load between frames: wait for them (at most 30 s), stepping a little
for (let i = 0; i < 300 && !api.heroMode.figureLoaded; i++) { _world.step(0.05); await new Promise((ok) => setTimeout(ok, 100)); }
for (let i = 0; i < 20; i++) { _world.step(0.05); await new Promise((ok) => setTimeout(ok, 100)); }
for (const b of document.querySelectorAll('button')) if (/^(Begin|Go|Start|OK|Close|Continue|Onward)$/i.test(b.textContent.trim()) && b.offsetParent) b.click();
try { g.zone.hud.closeCard(); } catch (e) { /* none */ }
g.zone.setPacks(false);
if (P.zoom) api.heroMode.setZoom(P.zoom);
const look = g.floor;
const out = { floor: P.floor, counts: globalThis.__lifeCounts ?? null, shots: [] };
const tick = () => new Promise((ok) => requestAnimationFrame(() => ok()));
// what the life left for the tools
// (the life comes into the scene a moment after the floor starts: index.ts)
let lifeGroup = null;
for (let i = 0; i < 60 && !lifeGroup; i++) { _world.step(0.05); await new Promise((ok) => setTimeout(ok, 50)); api.duel.group.parent?.traverse((o) => { if (o.name === 'life') lifeGroup = o; }); }
out.where = lifeGroup?.userData.where ?? null;
for (const s of P.spots) {
  let x, z, name;
  if (Array.isArray(s)) { [x, z] = s; name = s[2] ?? `${Math.round(x)}_${Math.round(z)}`; }
  else if (s.startsWith('@')) {
    // '@hinds.2:dx:dz': the life's own thing (`where`), the hero that far from it (m; +z is south, toward the camera)
    const m = /^@(\w+)\.(\d+):(-?[\d.]+):(-?[\d.]+)$/.exec(s);
    // (a walker where it is now; anything else where the life put it)
    const w = m && (m[1] === 'walkers' && lifeGroup?.userData.walkers ? lifeGroup.userData.walkers.snapshot()[+m[2]] : out.where?.[m[1]]?.[+m[2]]);
    if (!w) continue;
    x = w.x + +m[3]; z = w.z + +m[4]; name = `${m[1]}${m[2]}`;
  }
  else {
    const pl = s === 'camp' ? { x: look.start.x, z: look.start.z } : (look.places[s]?.stand ?? null);
    const lp = (P.look ?? []).find((p) => p.id === s);
    if (lp) { x = lp.x; z = lp.z + (P.off ?? 6); } else if (pl) { x = pl.x; z = pl.z; } else continue;
    name = s;
  }
  _world.go(x, z);
  if (P.zoom) { api.heroMode.setZoom(P.zoom); api.heroMode.snapCameraNow(); }
  // (a walker's model loads late, between frames: real time for it)
  for (let i = 0; i < 10; i++) { _world.step((P.step ?? 4) / 10); await new Promise((ok) => setTimeout(ok, 120)); }
  // a card that came up meanwhile (a law's choice, a greeting): closed, so the picture is the floor
  try { g.zone.hud.closeCard(); } catch (e) { /* none */ }
  api.render();
  await tick();
  api.render();
  const file = `f${P.floor}-${name}-${P.tag}`;
  await __shot(file);
  out.shots.push(file);
}
out.after = globalThis.__lifeCounts ?? null;
out.heroLoaded = !!api.heroMode.figureLoaded;
out.flock = lifeGroup?.userData.gulls?.snapshot?.().slice(0, 6) ?? null;
return out;
