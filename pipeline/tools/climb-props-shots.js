// Pictures of the Climb's props in place (2026-11-14, the props pass: docs/tower/props/). A body for world-shots.py on the game page:
// put a plan in front of it, e.g. from a script file that starts
//   const PLAN = [{ floor: 22, shots: [{ name: 's22-lantern', x: 85.6, z: -6.6 }, { name: 's22-lantern-low', x: 85.6, z: -6.6, low: 3 }] }];
// followed by this file's text, and run it:
//   python -I pipeline/tools/world-shots.py <that file> --page /game --port 5252 --out docs/tower/props/sands --size 960x540
// A shot looks at (x, z):
// - from the game's own camera (`zoom` 0.55 to 1.7 as a player can, 0.55 the default: the closest), the hero standing beside the spot
//   (`hero: [x, z]`, else 1.8 m east of it) for size;
// - or, with `low: d`, from low beside it: the camera `d` m off (south-west, or `from: [dx, dy, dz]` from the spot), `y` m above the
//   spot's own height `sy` (default 0; null: the drawn ground's height there) by `y` (default 0.9), looking at the spot `at` m above `sy` (default 0.3); the hero still beside
//   it (or, past the edge, 2.5 m inside the walkable outline).
// `cam: [x, y, z, lx, ly, lz]` puts the camera anywhere (world coordinates, looking at (lx, ly, lz)).
// The packs sleep and are sent away; the law's card is closed; CSS animations are off. `off: true` builds the floor without the scenes.
eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const done = [];
for (const f of PLAN) {
  globalThis.__noScenes = !!f.off;
  await _world({ floor: f.floor, hero: f.heroName ?? 'Lyra' });
  _world.packs(false);
  const api = window.game?.api ?? { heroMode: vfx.heroMode };
  const cam = api.heroMode.host?.camera ?? api.camera;
  // the walkable outline (the floor's invisible edge walls): a hero beside a spot past the edge stands 2.5 m inside it instead
  const def = _world.game().floor, edges = (def.cover ?? []).filter((c) => c.fixed), poly = edges.map((c) => [c.ax, c.az]);
  const inside = (x, z) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) k = !k; } return k; };
  const inward = (x, z) => { if (poly.length < 3) return [x, z]; const d = Math.hypot(x, z - 7) || 1; let t = 0; while (t < d && !inside(x - (x / d) * t, z - ((z - 7) / d) * t)) t += 0.5; t += 2.5; return [x - (x / d) * t, z - ((z - 7) / d) * t]; };
  // the ground as drawn (the scene's biggest PlaneGeometry, its own triangles), for `sy: null`: the spot's own ground height
  let root = api.arena.caster.group; while (root.parent) root = root.parent;
  let gm = null;
  root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.geometry.attributes.position.count > 1000 && (!gm || o.geometry.attributes.position.count > gm.geometry.attributes.position.count)) gm = o; });
  const groundAt = (px, pz) => {
    if (!gm) return 0;
    gm.updateMatrixWorld(true);
    const P = gm.geometry.parameters, A = gm.geometry.attributes.position, e = gm.matrixWorld.elements, W = P.widthSegments + 1;
    const lx = px - e[12], lz = pz - e[14], cw = P.width / P.widthSegments, ch = P.height / P.heightSegments;
    const ix = Math.max(0, Math.min(P.widthSegments - 1, Math.floor((lx + P.width / 2) / cw))), iz = Math.max(0, Math.min(P.heightSegments - 1, Math.floor((lz + P.height / 2) / ch)));
    const fx = (lx + P.width / 2) / cw - ix, fz = (lz + P.height / 2) / ch - iz;
    const h = (i, j) => A.getY(i + W * j);
    return e[13] + (1 - fx) * (1 - fz) * h(ix, iz) + fx * (1 - fz) * h(ix + 1, iz) + (1 - fx) * fz * h(ix, iz + 1) + fx * fz * h(ix + 1, iz + 1);
  };
  for (const s of f.shots ?? []) {
    if (s.sy === null) s.sy = groundAt(s.x, s.z);
    api.heroMode.setZoom(s.zoom ?? 0.55);
    const [hx, hz] = s.hero ?? inward(s.x + 1.8, s.z);
    _world.go(hx, hz);
    _world.step(0.6);
    _world.step(0.1);
    for (const d of document.querySelectorAll('body > div')) if (/Choose a side|Two banners|KEEPER|Take:/.test(d.textContent ?? '') && !/Lyra|Bram/.test(d.textContent ?? '')) d.style.display = 'none';
    if (s.low || s.cam) {
      if (s.cam) { cam.position.set(s.cam[0], s.cam[1], s.cam[2]); cam.lookAt(s.cam[3], s.cam[4], s.cam[5]); }
      else {
        const [dx, dy, dz] = s.from ?? [-s.low * 0.6, s.y ?? 0.9, s.low * 0.8];
        cam.position.set(s.x + dx, (s.sy ?? 0) + dy, s.z + dz);
        cam.lookAt(s.x, (s.sy ?? 0) + (s.at ?? 0.3), s.z);
      }
      cam.updateMatrixWorld();
      api.render();
    }
    await __shot(s.name);
    done.push(s.name);
  }
}
globalThis.__noScenes = false;
_world.end();
return done;
