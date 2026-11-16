// The model review, round 2 (docs/models/review/round2/): the older arenas' backdrops (temple, frost, caldera, glade, sky ruins: the
// five not yet in the heroes' style). For each: the game's camera in a player's duel (it follows the hero) with the hero at the ring's
// four edges at both zoom limits (0.55 and 1.7, what a player can see; --size 844x390 for a phone), a view from high above, and four low views from the rim outward. Numbers from the arena's own meshes
// (instances one by one): pieces whose lowest point stands over 0.4 m above the ground outside the ring (floating), and points of
// meshes inside the ring between 0.3 and 4 m high that are not within 0.6 m of a piece of cover (something in the play area).
//   python -I pipeline/tools/page-shots.py pipeline/tools/arena-backdrop.js <out folder> --port 5177 --json backdrop.json --timeout 400
//   (window._arenas = ['frost'] on a line before the file's text for some)
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const tick = (ms = 30) => new Promise((ok) => setTimeout(ok, ms));
const d = vfx.duel, hm = vfx.heroMode, a = vfx.arena;
const RING = { x: 0, z: 7, r: 12 };
const ARENAS = window._arenas ?? ['temple', 'frost', 'caldera', 'glade', 'skyruins'];
const st = document.createElement('style');
st.textContent = '*{animation:none!important}';
document.head.append(st);
const out = { rows: {} };
const canvas = () => document.querySelector('#app canvas') ?? document.querySelector('canvas');
const W = 400, H = 250;
const realNow = performance.now.bind(performance);
const segD = (px, pz, o) => {
  const dx = o.bx - o.ax, dz = o.bz - o.az, L = dx * dx + dz * dz || 1e-9;
  let t = ((px - o.ax) * dx + (pz - o.az) * dz) / L; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - o.ax - t * dx, pz - o.az - t * dz) - o.r;
};
for (const id of ARENAS) {
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'play');
  vfx.heroPickCtrl.setValue('Sefu');
  d.cpuLevel = CPU_BALANCE;
  d.opponentChoice = 'Kaia';
  d.arenaChoice = id;
  d.hazardsInRuns = false;
  d.shiftsInRuns = false;
  // a player's duel: the camera follows the hero (a CPU duel, 'run', holds it over the ring)
  d.start('play');
  for (let k = 0; k < 200 && !hm.figure?.loaded; k++) await tick();
  await tick(3500);
  let simMs = realNow();
  performance.now = () => simMs;
  const step = (s) => { for (let f = 0; f < Math.round(s * 60); f++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
  step(0.5);
  const tiles = [];
  const grab = (label) => {
    vfx.render();
    const src = canvas();
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, 18);
    g.fillStyle = '#ffd27a'; g.font = '600 12px sans-serif'; g.fillText(`${id}: ${label}`, 5, 13);
    tiles.push(c);
  };
  const hero = a.caster.group.position;
  // The hero at the ring's edges (11 m out), both zoom limits.
  for (const [name, ang] of [['north edge', Math.PI], ['east edge', Math.PI / 2], ['south edge', 0], ['west edge', -Math.PI / 2]]) {
    for (const z of [0.55, 1.7]) {
      hero.set(RING.x + Math.sin(ang) * 11, hero.y, RING.z + Math.cos(ang) * 11);
      d.foe && a.placeFoe?.(d.foe, new hero.constructor(RING.x, 0, RING.z));
      hm.setZoom(z);
      hm.focus = null;
      hm.snapCameraNow?.();
      step(2 / 60);
      d.playerHp = d.playerMax;
      grab(`${name}, zoom ${z}`);
    }
  }
  const cam = hm.host.camera;
  const look = (p, t, label, fov = 50) => { const f0 = cam.fov; cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(...p); cam.lookAt(...t); cam.updateMatrixWorld(); grab(label); cam.fov = f0; cam.updateProjectionMatrix(); step(1 / 60); };
  look([0, 70, 60], [0, 0, 5], 'high above');
  for (const [name, ang] of [['out north', Math.PI], ['out east', Math.PI / 2], ['out south', 0], ['out west', -Math.PI / 2]]) {
    const ex = RING.x + Math.sin(ang) * 10, ez = RING.z + Math.cos(ang) * 10;
    look([ex, 3, ez], [RING.x + Math.sin(ang) * 40, 4, RING.z + Math.cos(ang) * 40], name, 70);
  }
  performance.now = realNow;
  // numbers
  const grp = d.arenaScene?.group;
  const obs = d.currentArena?.obstacles ?? [];
  const floating = [], inRing = [];
  if (grp) {
    grp.updateMatrixWorld(true);
    const v = hero.clone();
    const M = new (cam.matrixWorld.constructor)();
    grp.traverse((m) => {
      if (!m.isMesh) return;
      for (let q = m; q && q !== grp; q = q.parent) if (!q.visible) return;
      const P = m.geometry.attributes.position;
      const n = m.isInstancedMesh ? m.count : 1;
      const stepV = Math.max(1, Math.floor(P.count / 400));
      for (let k = 0; k < n; k++) {
        if (m.isInstancedMesh) { m.getMatrixAt(k, M); M.premultiply(m.matrixWorld); } else M.copy(m.matrixWorld);
        let lo = 1e9, cx = 0, cz = 0, cnt = 0, hi = -1e9;
        for (let i = 0; i < P.count; i += stepV) {
          v.fromBufferAttribute(P, i).applyMatrix4(M);
          lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); cx += v.x; cz += v.z; cnt++;
          const r = Math.hypot(v.x - RING.x, v.z - RING.z);
          if (r < RING.r - 0.3 && v.y > 0.3 && v.y < 4 && !obs.some((o) => segD(v.x, v.z, o) < 0.6)) inRing.push([+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1), m.name || m.parent?.name || '']);
        }
        cx /= cnt; cz /= cnt;
        const r = Math.hypot(cx - RING.x, cz - RING.z);
        if (lo > 0.4 && r > RING.r && hi - lo < 40) floating.push({ name: m.name || m.parent?.name || '', inst: m.isInstancedMesh ? k : undefined, at: [+cx.toFixed(1), +cz.toFixed(1)], r: +r.toFixed(1), lo: +lo.toFixed(2), tall: +(hi - lo).toFixed(1) });
      }
    });
  }
  const sheet = document.createElement('canvas');
  sheet.width = 4 * W; sheet.height = Math.ceil(tiles.length / 4) * H;
  const g = sheet.getContext('2d');
  tiles.forEach((c, i) => g.drawImage(c, (i % 4) * W, Math.floor(i / 4) * H));
  out[`backdrop-${id}`] = sheet.toDataURL('image/jpeg', 0.84);
  // in-ring points grouped to 1 m cells
  const cells = {};
  for (const [x, y, z, nm] of inRing) { const key = `${Math.round(x)},${Math.round(z)}`; (cells[key] ??= { n: 0, top: 0, name: nm }).n++; cells[key].top = Math.max(cells[key].top, y); }
  out.rows[id] = { floating: floating.sort((p, q) => q.lo - p.lo).slice(0, 30), floatingN: floating.length, inRingCells: Object.entries(cells).sort((p, q) => q[1].n - p[1].n).slice(0, 25) };
  d.stop?.();
}
return out;
