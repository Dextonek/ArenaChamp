// The War's scenes (src/tower/world/scenes/war.ts) as a player sees them: what share of the game camera's views show a scene. For
// floors 41 to 50, builds the zone, then stands the hero at points every 8 m along every road and on an 8 m grid over the walkable
// ground (off the cover) and puts the game's camera where heroMode.ts's `followCamera` puts it: offset (0, 15, 10.5) times the zoom,
// looking at (hero.x, 0.5, hero.z - 1.5), a vertical field of view of 50 degrees, a 16:9 screen. A view shows a scene when its main
// piece (the thing that tells the story: the cart, the catapult, the banner; at the scene's centre) is on screen, its centre inside the
// middle 92 % of the frame, AND big enough to read: its round (radius `mr`, logged by the build, or by kind below for the first pass's
// scenes) at least 6 % of the screen's height across (43 px of 720). Echo props between scenes (`trail`) do not count. Reported per
// floor and zoom: the share of road views and of all views that show at least one scene, and how many the average view shows.
//
//   python -I pipeline/tools/world-shots.py pipeline/tools/war-views-probe.js --page / --port <port>
const probe = async (floors = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50], zooms = [1.25, 1.7], aspect = 16 / 9) => {
  const fl = await import('/src/tower/world/floors/index.ts');
  const gen = await import('/src/tower/world/floors/gen/index.ts');
  const banners = await import('/src/tower/world/floors/banners-made.ts');
  const land = await import('/src/tower/world/land.ts');
  const C = { x: 0, z: 7 }; // RING
  const seg = (px, pz, ax, az, bx, bz) => {
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
    return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
  };
  const tanH = Math.tan((50 / 2) * Math.PI / 180), M = 0.92, MIN = 0.03;
  // The first pass's main pieces (its scenes logged no `mr`): the banner of an aftermath, the ring of a last stand, the satchel...
  const MAIN = {
    aftermath: 0.9, laststand: 2.1, cookfire: 0.85, smithy: 0.35, hospital: 1.3, engine: 1.7, graves: 1.6, depot: 0.9, stakes: 2.4,
    saddle: 0.9, satchel: 0.25, ladder: 0.9, farmhouse: 3.5, tents: 3.0, graveyard: 3.5, watchtower: 3.2,
  };
  /** Whether a main piece of radius mr at (qx, qy, qz) is on screen and big enough, with the hero at (px, pz) and the zoom z. */
  const seen = (px, pz, z, qx, qy, qz, mr) => {
    const cx = px, cy = 15 * z, cz = pz + 10.5 * z, tx = px, ty = 0.5, tz = pz - 1.5;
    let fx = tx - cx, fy = ty - cy, fz = tz - cz; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    // right = f x up(0,1,0) = (-fz, 0, fx) normalised; up' = right x f
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    const dx = qx - cx, dy = qy - cy, dz = qz - cz, zc = dx * fx + dy * fy + dz * fz;
    if (zc <= 0.1) return false;
    const xc = dx * rx + dz * rz, yc = dx * ux + dy * uy + dz * uz;
    return Math.abs(xc / (zc * tanH * aspect)) < M && Math.abs(yc / (zc * tanH)) < M && mr / (zc * tanH) >= MIN;
  };
  const out = { zooms, floors: [] };
  for (const n of floors) {
    const baked = n === 41 ? banners.BANNERS_41 : gen.GEN_FLOORS[n].baked, look = baked.look;
    const zone = fl.FLOORS[n].arena.build();
    const log = [...(globalThis.__warScenesLog ?? new Map()).values()].find((l) => l.seed === look.seed);
    zone.dispose();
    const scenes = log ? log.scenes.filter((s) => s.kind !== 'trail') : [];
    const beyond = (x, z) => Math.hypot(x - C.x, z - C.z) - land.rimAt(look.rim, Math.atan2(z - C.z, x - C.x));
    const inCover = (x, z) => look.pieces.some((p) => seg(x, z, p.o.ax, p.o.az, p.o.bx, p.o.bz) < p.o.r);
    const roadPts = [], gridPts = [];
    for (const p of look.paths) {
      let carry = 0;
      for (let i = 1; i < p.length; i++) {
        const ax = C.x + p[i - 1][0], az = C.z + p[i - 1][1], bx = C.x + p[i][0], bz = C.z + p[i][1], L = Math.hypot(bx - ax, bz - az);
        let s = carry;
        for (; s < L; s += 8) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L; if (beyond(x, z) < -0.5) roadPts.push([x, z]); }
        carry = s - L;
      }
    }
    const rmax = Math.max(...look.rim);
    for (let x = C.x - rmax; x <= C.x + rmax; x += 8) for (let z = C.z - rmax; z <= C.z + rmax; z += 8) if (beyond(x, z) < -0.5 && !inCover(x, z)) gridPts.push([x, z]);
    const mains = scenes.map((s) => ({ x: s.mx ?? s.x, z: s.mz ?? s.z, y: s.beyond ? 1.5 : 0.25, r: s.mr ?? MAIN[s.kind] ?? 1 }));
    const row = { floor: n, scenes: scenes.length, roadViews: roadPts.length, allViews: roadPts.length + gridPts.length };
    for (const z of zooms) {
      const count = (pts) => pts.map(([px, pz]) => mains.filter((m) => seen(px, pz, z, m.x, m.y, m.z, m.r)).length);
      const r = count(roadPts), g = count(gridPts), all = r.concat(g);
      row[`z${z}`] = {
        road: +(100 * r.filter((k) => k > 0).length / Math.max(1, r.length)).toFixed(1),
        all: +(100 * all.filter((k) => k > 0).length / Math.max(1, all.length)).toFixed(1),
        perView: +(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length)).toFixed(2),
      };
    }
    out.floors.push(row);
  }
  for (const z of zooms) {
    const k = `z${z}`;
    out[`mean ${k}`] = {
      road: +(out.floors.reduce((a, f) => a + f[k].road, 0) / out.floors.length).toFixed(1),
      all: +(out.floors.reduce((a, f) => a + f[k].all, 0) / out.floors.length).toFixed(1),
    };
  }
  return out;
};
return await probe();
