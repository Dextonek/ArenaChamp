// The props probe (2026-11-14, "lets look at all props one by one and make the correct"): records every prop part a Sea or Wood floor
// places as it is placed (land.ts `Dress.add`, zone.ts `Kit.add`/`addMesh`, woodZone.ts `Props.add`, and each part of a scene through the
// scenes' `__propPart` hook), with its shape, its transform and the line of code that placed it, then checks what a player would see as
// a mistake:
//   - float:   a prop (its parts that touch each other) that does not reach the ground (or the sea) anywhere;
//   - side:    a part standing on a slope with one side of its foot in the air;
//   - buried:  a prop wholly under the ground, or a part more than half sunk into it;
//   - apart:   a part of a prop that touches none of the others and floats (a lantern beside its arm, a sail beside its mast);
//   - overlap: two parts of different props inside each other (by more than 8 cm), or a part inside a tree's trunk;
//   - cover:   a part (not the cover's own drawing) inside the zone's cover or the Wood's roots;
//   - road:    a part taller than 0.3 m on a road's middle (1.2 m of the line) inside the walkable ground;
//   - spot:    a part taller than 0.4 m within 1 m of one of the floor's spots (keep.ts: people, packs, caches, waystones, doors, quests).
// "A prop" here is a run of parts placed one after the other by the same code within 5 m (a scene is one prop); the ground is the drawn
// ground mesh itself (its triangles), the sea's level where the sea is.
//
// Run on the tool page (or with pipeline/tools/world-shots.py):
//   eval(await (await fetch('/pipeline/tools/props-probe.js')).text());
//   await _propsProbe(2)                 // builds floor 2 in the game (world-tool.js `_world`) and returns { floor, parts, props, sites, faults }
//   _propsProbe.parts / .props           // the last floor's records (for the sheets: props-sheet.js)
(() => {
  const segDist = (px, pz, ax, az, bx, bz) => {
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
    return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
  };
  const SINKS = /^(Dress\.add|Kit\.add|Kit\.addMesh|Props\.add|Object\.add|add|rec|window\.__propPart|globalThis\.__propPart|__propPart)$/;
  let rec = null; // the list being recorded
  let depthIn = 0; // inside a Dress.add (its gold goes on to Kit.add: recorded once)
  /** The code that placed a part: the first frame past the sinks and this file ("fn file:line"). */
  const site = () => {
    const lines = (new Error().stack ?? '').split('\n').slice(2);
    for (const l of lines) {
      const m = l.match(/at (?:(\S+) )?\(?(?:.*\/)?([\w.-]+\.ts)(?:\?[^:]*)?:(\d+):\d+\)?/);
      if (!m) continue;
      const fn = m[1] ?? '?';
      if (SINKS.test(fn) && /land\.ts|zone\.ts|woodZone\.ts|depth\.ts|woodDepth\.ts/.test(m[2]) && /add/.test(fn)) continue;
      if (/^(Object\.)?put$/.test(fn) && /woodDepth\.ts/.test(m[2])) continue; // the Wood depth's own helper: who called it
      return `${fn} ${m[2]}:${m[3]}`;
    }
    return '?';
  };
  let THREE = null;
  const wraps = new Map();
  const push = (src, key, geo, M, s) => {
    if (!rec) return;
    if (!geo.boundingBox) geo.computeBoundingBox();
    rec.push({ i: rec.length, src, key, geo, m: M.clone(), site: s ?? site() });
  };
  async function patch() {
    if (window.__propsPatched) return;
    THREE = await import('/node_modules/three/build/three.module.js');
    const land = await import('/src/tower/world/land.ts');
    const zone = await import('/src/tower/world/zone.ts');
    const wz = await import('/src/tower/world/woodZone.ts');
    const mat = (x, y, z, yaw, sx, sy, sz, tilt) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    const wrapAdd = (proto, src, keyOf) => {
      const orig = proto.add;
      proto.add = function (key, geo, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) {
        // a scene's baked colour (one geometry at the origin): its parts came through the hook
        const baked = x === 0 && y === 0 && z === 0 && yaw === 0 && !geo.index && rec && /commit/.test(new Error().stack ?? '');
        if (!baked && depthIn === 0) push(src, keyOf(key), geo, mat(x, y, z, yaw, sx, sy, sz, tilt));
        depthIn++;
        try { return orig.call(this, key, geo, x, y, z, yaw, sx, sy, sz, tilt); } finally { depthIn--; }
      };
    };
    const colourOf = (m) => (m?.color ? '#' + m.color.getHexString() : String(m?.type ?? m));
    wrapAdd(land.Dress.prototype, 'dress', (k) => k);
    wrapAdd(zone.Kit.prototype, 'kit', colourOf);
    if (wz.Props) wrapAdd(wz.Props.prototype, 'props', colourOf); // (not exported before the props pass: a Wood floor's own props go unrecorded there)
    const addMesh = zone.Kit.prototype.addMesh;
    zone.Kit.prototype.addMesh = function (mesh) {
      mesh.updateWorldMatrix(true, false);
      // one prop a placed copy (its wrapper, the top of its tree): `harbour-file#n`
      let top = mesh;
      while (top.parent) top = top.parent;
      if (!wraps.has(top)) wraps.set(top, wraps.size);
      push('mesh', colourOf(mesh.material), mesh.geometry, mesh.matrixWorld, `harbour-file#${wraps.get(top)} ${mesh.name}`);
      return addMesh.call(this, mesh);
    };
    window.__propPart = (s, key, g, M) => push('scene', key, g, M, s);
    window.__propsPatched = true;
  }

  // --- geometry --------------------------------------------------------------------------------------------------------------
  /** A part's world box: middle and three half-axes (its shape's box carried by its transform). */
  const obb = (p) => {
    if (p.ob) return p.ob;
    const b = p.geo.boundingBox, e = p.m.elements;
    const lc = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2], h = [(b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2, (b.max.z - b.min.z) / 2];
    const c = [e[0] * lc[0] + e[4] * lc[1] + e[8] * lc[2] + e[12], e[1] * lc[0] + e[5] * lc[1] + e[9] * lc[2] + e[13], e[2] * lc[0] + e[6] * lc[1] + e[10] * lc[2] + e[14]];
    const ax = [0, 1, 2].map((k) => [e[k * 4] * h[k], e[k * 4 + 1] * h[k], e[k * 4 + 2] * h[k]]);
    const ext = [0, 1, 2].map((d) => Math.abs(ax[0][d]) + Math.abs(ax[1][d]) + Math.abs(ax[2][d]));
    p.ob = { c, ax, min: c.map((v, d) => v - ext[d]), max: c.map((v, d) => v + ext[d]) };
    return p.ob;
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** How far two boxes reach into each other (negative: the gap between them along the best axis). */
  const overlap = (A, B) => {
    const T = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
    const axes = [...A.ax, ...B.ax];
    for (const a of A.ax) for (const b of B.ax) axes.push(cross(a, b));
    let best = 1e9;
    for (const L of axes) {
      const n = Math.hypot(L[0], L[1], L[2]);
      if (n < 1e-6) continue;
      const u = [L[0] / n, L[1] / n, L[2] / n];
      let ra = 0, rb = 0;
      for (const a of A.ax) ra += Math.abs(dot(a, u));
      for (const b of B.ax) rb += Math.abs(dot(b, u));
      best = Math.min(best, ra + rb - Math.abs(dot(T, u)));
    }
    return best;
  };
  /** A part's vertices in the world (every third of a big shape). */
  const verts = (p) => {
    if (p.v) return p.v;
    const P = p.geo.attributes.position, e = p.m.elements, step = P.count > 600 ? 3 : 1, out = [];
    for (let i = 0; i < P.count; i += step) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      out.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14], y]);
    }
    p.v = out;
    return out;
  };

  /** The drawn ground's height at (x, z): its own triangles (a PlaneGeometry grid laid flat). */
  function groundOf(group) {
    let mesh = null;
    group.traverse((o) => { if (!mesh && o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.widthSegments > 50) mesh = o; });
    if (!mesh) return () => 0;
    const { width, height, widthSegments: nx, heightSegments: nz } = mesh.geometry.parameters, P = mesh.geometry.attributes.position, ox = mesh.position.x, oz = mesh.position.z;
    const sx = width / nx, sz = height / nz, row = nx + 1;
    return (x, z) => {
      const fx = (x - ox + width / 2) / sx, fz = (z - oz + height / 2) / sz;
      const ix = Math.max(0, Math.min(nx - 1, Math.floor(fx))), iz = Math.max(0, Math.min(nz - 1, Math.floor(fz))), u = fx - ix, w = fz - iz;
      const ha = P.getY(iz * row + ix), hb = P.getY((iz + 1) * row + ix), hc = P.getY((iz + 1) * row + ix + 1), hd = P.getY(iz * row + ix + 1);
      return u + w <= 1 ? ha + (hd - ha) * u + (hb - ha) * w : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - w);
    };
  }

  window._propsProbe = async (floor, o = {}) => {
    await patch();
    if (!window._world) eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
    const F = await import('/src/tower/world/floors/index.ts');
    const G = await import('/src/tower/world/floors/gen/index.ts');
    const K = await import('/src/tower/world/keep.ts');
    const land = await import('/src/tower/world/land.ts');
    const RING = (await import('/src/arenas/common.ts')).RING;
    const def = F.FLOORS[floor];
    let look = G.GEN_FLOORS[floor]?.baked.look;
    if (!look && floor === 1) look = (await import('/src/tower/world/floors/gen/harbour-big.ts')).HARBOUR.look;
    if (!look && floor === 11) look = (await import('/src/tower/world/floors/woodGrown.ts')).WOOD_11.look;
    rec = [];
    const t0 = performance.now();
    await _world({ floor, hero: o.hero ?? 'Lyra' });
    _world.packs(false);
    // the harbour file's props load after the zone
    await new Promise((ok) => setTimeout(ok, o.wait ?? 2500));
    const parts = rec;
    rec = null;
    // the zone's group: the one holding the ground mesh (from the scene's root)
    let root = (window.game?.api ?? vfx).arena.caster.group, group = null;
    while (root.parent) root = root.parent;
    root.traverse((x) => { if (!group && x.isMesh && x.geometry?.type === 'PlaneGeometry' && x.geometry.parameters.widthSegments > 50) group = x.parent; });
    const ground = groundOf(group ?? new THREE.Group());
    const sea = floor <= 10 ? land.WATER : -1e9;
    const support = (x, z) => Math.max(ground(x, z), sea);
    const rim = look.rim ?? new Array(48).fill(48);
    const beyond = (x, z) => Math.hypot(x - RING.x, z - RING.z) - land.rimAt(rim, Math.atan2(z - RING.z, x - RING.x));
    // trees (instanced, with a trunk): sea land's pines and broadleaves; the Wood's forest kinds 0, 1, 2, 4
    const trunks = [];
    group?.traverse((x) => {
      if (!x.isInstancedMesh) return;
      const bb = (x.geometry.computeBoundingBox(), x.geometry.boundingBox), tall = bb.max.y > 3;
      if (!tall) return;
      const m = new THREE.Matrix4();
      for (let i = 0; i < x.count; i++) {
        x.getMatrixAt(i, m);
        const e = m.elements, s = Math.hypot(e[0], e[1], e[2]);
        trunks.push({ x: e[12], y: e[13], z: e[14], r: 0.32 * s, h: 2.6 * Math.hypot(e[4], e[5], e[6]) });
      }
    });

    // --- props: runs of parts from the same code within 5 m -------------------------------------------------------------------
    const props = [];
    let cur = null;
    for (const p of parts) {
      const b = obb(p), fn = p.site.split(' ')[0], file = p.src === 'mesh' ? '' : (p.site.split(' ')[1] ?? '').split(':')[0];
      if (!cur || cur.fn !== fn || cur.file !== file || Math.hypot(b.c[0] - cur.x, b.c[2] - cur.z) > (p.src === 'scene' ? 12 : 5)) {
        cur = { id: props.length, site: p.site, fn, file, x: b.c[0], z: b.c[2], parts: [] };
        props.push(cur);
      }
      p.prop = cur.id;
      cur.parts.push(p);
    }
    // a scene is one commit: split runs where the hook's scene changes position by more than its size
    const faults = [];
    const F_ = (kind, p, msg, extra = {}) => { const b = obb(p); faults.push({ kind, site: p.site, key: p.key, x: +b.c[0].toFixed(2), y: +b.c[1].toFixed(2), z: +b.c[2].toFixed(2), prop: p.prop, part: p.i, msg, ...extra }); };
    // the zone builders draw the cover (and a few lanterns): their parts are the cover's own look
    const isCover = (p) => /\b(zone|woodZone)\.ts:/.test(p.site);
    // the cover pieces as capsules; the Wood's roots
    const cover = (look.pieces ?? []).filter((q) => q.look !== 'edge').map((q) => q.o);
    const roots = (def.law?.walls ?? []).map((w) => ({ ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r }));
    const roads = [];
    for (const pth of look.paths ?? []) for (let i = 1; i < pth.length; i++) roads.push([RING.x + pth[i - 1][0], RING.z + pth[i - 1][1], RING.x + pth[i][0], RING.z + pth[i][1]]);
    const keep = K.floorKeep(def);

    for (const pr of props) {
      // the parts that touch (4 cm) as groups
      const n = pr.parts.length, up = [...Array(n).keys()];
      const find = (i) => (up[i] === i ? i : (up[i] = find(up[i])));
      if (n <= 400) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (overlap(obb(pr.parts[i]), obb(pr.parts[j])) > -0.04) up[find(i)] = find(j);
      const groups = new Map();
      pr.parts.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
      let lowest = Infinity;
      pr.groundGap = Infinity;
      const gaps = [];
      for (const gp of groups.values()) {
        let clear = Infinity, top = -Infinity, sunkTop = Infinity;
        for (const p of gp) for (const v of verts(p)) { const s = support(v[0], v[2]); clear = Math.min(clear, v[1] - s); top = Math.max(top, v[1] - s); }
        gaps.push({ gp, clear, top });
        lowest = Math.min(lowest, clear);
      }
      pr.groundGap = lowest;
      for (const { gp, clear, top } of gaps) {
        if (top < -0.01) { for (const p of gp.slice(0, 1)) F_('buried', p, `all ${gp.length} part(s) under the ground (top ${top.toFixed(2)} m)`); continue; }
        if (clear > 0.05) {
          if (groups.size === 1) F_('float', gp[0], `the prop never reaches the ground: ${clear.toFixed(2)} m above it`, { gap: +clear.toFixed(2) });
          else F_('apart', gp[0], `${gp.length} part(s) touch nothing of the prop and float ${clear.toFixed(2)} m up`, { gap: +clear.toFixed(2), keys: gp.map((p) => p.key).join(',') });
        }
      }
      // a part on a slope: the bottom of its shape, how far above the ground each of its corners is
      for (const p of pr.parts) {
        const b = p.geo.boundingBox, hgt = b.max.y - b.min.y;
        if (hgt < 0.02) continue;
        let lo = Infinity, hi = -Infinity, cnt = 0, minY = Infinity, maxY = -Infinity, deep = -Infinity;
        for (const v of verts(p)) {
          minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
          if (v[3] > b.min.y + 0.02 * hgt + 0.005) continue;
          const c = v[1] - support(v[0], v[2]);
          lo = Math.min(lo, c); hi = Math.max(hi, c); cnt++;
        }
        const s = support(obb(p).c[0], obb(p).c[2]);
        if (cnt >= 2 && lo < 0.03 && hi > 0.18 && Math.abs(s - ground(obb(p).c[0], obb(p).c[2])) < 1e-6) {
          const slope = Math.abs(ground(obb(p).c[0] + 0.5, obb(p).c[2]) - ground(obb(p).c[0] - 0.5, obb(p).c[2])) + Math.abs(ground(obb(p).c[0], obb(p).c[2] + 0.5) - ground(obb(p).c[0], obb(p).c[2] - 0.5));
          if (slope > 0.02) F_('side', p, `on a slope one side of its foot is ${hi.toFixed(2)} m in the air`, { gap: +hi.toFixed(2) });
        }
        const gnd = ground(obb(p).c[0], obb(p).c[2]);
        if (maxY - minY > 0.25 && (gnd - minY) / (maxY - minY) > 0.5 && maxY > gnd && gnd > sea + 0.05) {
          const under = gnd - minY;
          if (under > 0.2) F_('sunk', p, `${Math.round((100 * under) / (maxY - minY))} % of its height in the ground`, { gap: +under.toFixed(2) });
        }
      }
    }

    // --- across props: overlaps, trunks, cover, roads, spots ------------------------------------------------------------------------
    const CELL = 3, hash = new Map();
    const key = (i, j) => i * 100003 + j;
    for (const p of parts) {
      const b = obb(p);
      for (let i = Math.floor(b.min[0] / CELL); i <= Math.floor(b.max[0] / CELL); i++) for (let j = Math.floor(b.min[2] / CELL); j <= Math.floor(b.max[2] / CELL); j++) {
        const k = key(i, j);
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(p);
      }
    }
    const seen = new Set(), pairs = new Map();
    const thin = (p) => { const b = p.geo.boundingBox; return Math.min(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) * 1 < 0.025; };
    for (const list of hash.values()) for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) {
      const p = list[a], q = list[c];
      if (p.prop === q.prop) continue;
      const id = p.i < q.i ? `${p.i}:${q.i}` : `${q.i}:${p.i}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const A = obb(p), B = obb(q);
      if (A.max[0] < B.min[0] || B.max[0] < A.min[0] || A.max[2] < B.min[2] || B.max[2] < A.min[2] || A.max[1] < B.min[1] || B.max[1] < A.min[1]) continue;
      const d = overlap(A, B);
      if (d < 0.08) continue;
      if (isCover(p) && isCover(q)) continue;
      // one fault a pair of props, the deepest
      const pk = `${Math.min(p.prop, q.prop)}:${Math.max(p.prop, q.prop)}`, prev = pairs.get(pk);
      if (!prev || prev.d < d) pairs.set(pk, { p, q, d });
    }
    for (const { p, q, d } of pairs.values()) F_('overlap', p, `inside ${q.site} (${q.key}) by ${d.toFixed(2)} m`, { other: q.site, otherProp: q.prop, depth: +d.toFixed(2), thin: thin(p) || thin(q) });
    const byProp = new Map();
    for (const p of parts) {
      const b = obb(p), cx = b.c[0], cz = b.c[2], s = support(cx, cz), top = b.max[1] - s;
      const inside = beyond(cx, cz) < 0;
      for (const t of trunks) {
        if (Math.abs(t.x - cx) > 3 || Math.abs(t.z - cz) > 3) continue;
        // the part's box against the trunk's line: the box's nearest point to the trunk's axis
        const dxz = Math.max(0, Math.abs(t.x - cx) - (b.max[0] - b.min[0]) / 2) ** 2 + Math.max(0, Math.abs(t.z - cz) - (b.max[2] - b.min[2]) / 2) ** 2;
        if (Math.sqrt(dxz) < t.r - 0.1 && b.min[1] < t.y + t.h && !thin(p)) { const k2 = `tree${p.prop}`; if (!byProp.has(k2)) { byProp.set(k2, 1); F_('tree', p, `in a tree's trunk (tree at ${t.x.toFixed(1)}, ${t.z.toFixed(1)})`); } }
      }
      if (!isCover(p) && top > 0.15) {
        for (const c of [...cover, ...roots]) {
          const dd = segDist(cx, cz, c.ax, c.az, c.bx, c.bz) - c.r;
          if (dd < -0.15) { const k2 = `cover${p.prop}`; if (!byProp.has(k2)) { byProp.set(k2, 1); F_('cover', p, `${(-dd).toFixed(2)} m inside cover`, { depth: +(-dd).toFixed(2) }); } break; }
        }
      }
      if (inside && top > 0.3) {
        for (const r of roads) {
          if (segDist(cx, cz, ...r) < 1.2) { const k2 = `road${p.prop}`; if (!byProp.has(k2)) { byProp.set(k2, 1); F_('road', p, `${top.toFixed(2)} m tall on a road's middle`); } break; }
        }
      }
      if (top > 0.4) for (const k of keep) {
        if (Math.hypot(k.x - cx, k.z - cz) < 1.0) { const k2 = `spot${p.prop}`; if (!byProp.has(k2)) { byProp.set(k2, 1); F_('spot', p, `${top.toFixed(2)} m tall on a floor spot (${k.x.toFixed(1)}, ${k.z.toFixed(1)})`); } break; }
      }
    }

    // the kinds: each site's props
    const sites = {};
    for (const pr of props) {
      const s = sites[pr.site] ?? (sites[pr.site] = { n: 0, parts: 0, first: [+pr.x.toFixed(1), +pr.z.toFixed(1)] });
      s.n++; s.parts += pr.parts.length;
    }
    window._propsProbe.parts = parts;
    window._propsProbe.props = props;
    window._propsProbe.faults = faults;
    window._propsProbe.ground = ground;
    const count = {};
    for (const f of faults) count[f.kind] = (count[f.kind] ?? 0) + 1;
    // `o.boxes`: every part's site and its box on the ground (for laying a changed square of props-same.js against what is in it)
    const boxes = o.boxes ? parts.map((p) => { const b = obb(p); return [p.site.replace(/harbour-file#\d+/, 'harbour-file'), +b.min[0].toFixed(2), +b.min[2].toFixed(2), +b.max[0].toFixed(2), +b.max[2].toFixed(2)]; }) : undefined;
    return { boxes, floor, ms: Math.round(performance.now() - t0), parts: parts.length, props: props.length, trunks: trunks.length, count, sites, faults: o.all ? faults : faults.slice(0, o.max ?? 400) };
  };
})();
