"""The packs' runs (a charge, a lunge, a pounce: src/tower/world/tactics.ts) against walls and edges. On a floor, for many pieces of cover
(the outline's edge walls, the Wood's walls of roots, the rest), the hero stands with its back to the piece and one unit of a kind with a
run special is set a run's length in front, woken and made ready; the probe follows the special to its end and reports each run that ends

- inside cover (the unit's middle inside a piece),
- outside the walkable ground (not in a flood fill from the camp over the cover as it stands at that moment),
- across a piece (the straight way from where the run began to where it ended crosses a piece's core, and the two do not see each other),
- more than 1 m from where `arena.keepInside` would put it.

The Wood's roots: `--pin 0` / `--pin 1` holds one state; `--flip <s>` changes them every <s> seconds during the trials (a wall that rises
under a run).

    python pipeline/tools/tactics-walls.py <port> <floor> [--pin 0|1 | --flip 2.5] [--trials 120] [--hero Bram] [--tactics off]
"""
import argparse, asyncio, json

JS = r"""async ([n, pin, flip, hero, trials]) => {
  const F = await import('/src/tower/world/floors/index.ts');
  const T = await import('/src/tower/world/tactics.ts');
  const P = await import('/src/tower/world/packs.ts');
  const O = await import('/src/obstacles.ts');
  await _worldGen(n);
  const was = F.FLOORS[n];
  if (was.law?.kind === 'paths' && (pin !== null || flip)) F.FLOORS[n] = { ...was, law: { ...was.law, every: flip || 1e9, first: flip ? 0 : pin, warn: 0 } };
  try { await _world({ floor: n, hero, mode: 'play', persist: false }); } finally { F.FLOORS[n] = was; }
  const g = _world.game(), z = g.zone, arena = vfx.arena, def = g.floor;
  const packs = [...z.packs.values()];
  for (const pk of packs) { pk.off = true; pk.dispose(); }
  const env = packs[0].env;
  const runners = Object.values(env.enemies).filter((s) => ['charger', 'hunter', 'pouncer', 'warden'].includes(T.roleOf(s)));
  if (!runners.length) return JSON.stringify({ error: 'no kind with a run special', kinds: Object.keys(env.enemies) });
  const max = vfx.duel.heroMax ?? vfx.duel.heroHp;
  const V = (x, z) => new THREE_V(x, z);
  function THREE_V(x, z) { const p = arena.caster.group.position.clone(); p.set(x, 0, z); return p; }
  const roots = new Set((def.law?.kind === 'paths' ? [] : []));
  const lawWalls = def.law?.kind === 'paths' ? def.law.walls.map((w) => ({ ax: w.a.x, az: w.a.z, bx: w.b.x, bz: w.b.z, r: w.r, name: w.name, set: w.set })) : [];
  const isRoot = (o) => lawWalls.some((w) => Math.abs(w.ax - o.ax) < 1e-6 && Math.abs(w.az - o.az) < 1e-6 && Math.abs(w.bx - o.bx) < 1e-6 && Math.abs(w.bz - o.bz) < 1e-6);
  const cat = (o) => (isRoot(o) ? 'roots' : o.fixed && o.r === 0.6 && o.height === 3 ? 'edge' : 'cover');
  const distTo = (o, x, z) => {
    const ex = o.bx - o.ax, ez = o.bz - o.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - o.ax) * ex + (z - o.az) * ez) / l2)) : 0;
    return Math.hypot(x - (o.ax + ex * t), z - (o.az + ez * t));
  };
  const segDist = (o, a, b) => { // the least distance from the piece's axis to the segment a-b (sampled)
    let best = Infinity;
    for (let k = 0; k <= 24; k++) { const t = k / 24; best = Math.min(best, distTo(o, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)); }
    return best;
  };
  // The walkable ground now: a flood fill from the camp over the cover as it stands (0.5 m grid, a body of 0.3 m).
  const R = def.ring, C = { x: 0, z: 7 }, step = 0.5, N = Math.ceil((2 * R) / step);
  let grid = null, gridKey = '';
  const ground = () => {
    const obs = arena.obstacles ?? [];
    const key = String(obs.length) + ':' + obs.filter(isRoot).map((o) => o.ax).join(',');
    if (grid && key === gridKey) return grid;
    gridKey = key;
    const blocked = (x, z) => { for (const o of obs) if (distTo(o, x, z) < o.r + 0.3) return true; return false; };
    const seen = new Uint8Array(N * N), q = [];
    const ix = (x) => Math.round((x - (C.x - R)) / step), iz = (z) => Math.round((z - (C.z - R)) / step);
    const s0 = [ix(def.start.x), iz(def.start.z)];
    seen[s0[1] * N + s0[0]] = 1; q.push(s0);
    while (q.length) {
      const [i, j] = q.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N || seen[b * N + a]) continue;
        const x = C.x - R + a * step, zz = C.z - R + b * step;
        if (Math.hypot(x - C.x, zz - C.z) > R - 0.7 || blocked(x, zz)) continue;
        seen[b * N + a] = 1; q.push([a, b]);
      }
    }
    grid = { on: (x, zz) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const i = ix(x) + a, j = iz(zz) + b; if (i >= 0 && j >= 0 && i < N && j < N && seen[j * N + i]) return true; } return false; } };
    return grid;
  };
  const free = (p) => { const q = p.clone(); arena.keepInside(q, 0.5); return Math.hypot(q.x - p.x, q.z - p.z) < 0.05 && ground().on(p.x, p.z); };

  // The pieces to try: every root wall, then the edge and the rest spread over the list.
  const obs0 = arena.obstacles ?? [];
  const allRoots = lawWalls.map((w) => ({ ...w, height: 3 }));
  const edges = obs0.filter((o) => cat(o) === 'edge'), other = obs0.filter((o) => cat(o) === 'cover');
  const spread = (xs, k) => (xs.length <= k ? xs : Array.from({ length: k }, (_, i) => xs[Math.floor((i * xs.length) / k)]));
  const pieces = [...allRoots.map((o) => ['roots', o]), ...spread(edges, Math.ceil(trials / 2)).map((o) => ['edge', o]), ...spread(other, trials).map((o) => ['cover', o])];
  const RUN = { charger: 8, warden: 8, pouncer: 7, hunter: 4 };
  const out = { floor: n, pin, flip, kinds: runners.map((s) => s.id), trials: 0, runs: 0, byKind: {}, faults: [], skipped: 0 };
  let k = 0, lastRoots = '';
  out.flipsMidRun = 0;
  for (const [what, o] of pieces) {
    if (out.trials >= trials) break;
    const mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, ex = o.bx - o.ax, ez = o.bz - o.az, l = Math.hypot(ex, ez);
    const normals = l > 1e-3 ? [[-ez / l, ex / l], [ez / l, -ex / l]] : [[(C.x - mx) / (Math.hypot(C.x - mx, C.z - mz) || 1), (C.z - mz) / (Math.hypot(C.x - mx, C.z - mz) || 1)]];
    for (const [nx, nz] of normals) {
      for (const turn of [0, 0.6, -0.6]) {
        if (out.trials >= trials) break;
        const spec = runners[k % runners.length];
        const role = T.roleOf(spec), d = RUN[role];
        const H = V(mx + nx * (o.r + 1.1), mz + nz * (o.r + 1.1));
        const c = Math.cos(turn), s = Math.sin(turn), ux = nx * c - nz * s, uz = nx * s + nz * c;
        const U = V(H.x + ux * d, H.z + uz * d);
        if (!free(H) || !free(U) || !arena.lineOfSight(U, H)) { out.skipped++; continue; }
        k++;
        out.trials++;
        const pk = new P.Pack({ id: 'probe', at: { x: U.x, z: U.z }, leash: 1e9, mix: [{ kind: spec.id, n: 1 }] }, env);
        _world.go(H.x, H.z);
        if (!pk.spawn()) { out.skipped++; continue; }
        pk.wake('probe');
        const unit = pk.units[0], mind = pk.mind, mm = mind.minds.get(unit);
        if (mm) mm.ready = 0;
        let began = null, ended = null;
        const b0 = mind.begin.bind(mind), e0 = mind.end.bind(mind);
        let lane = 0, prev = null, through = null;
        mind.begin = (u, m, kind, tgt, dist) => {
          const ok = b0(u, m, kind, tgt, dist);
          if (ok) {
            began = { kind, x: u.pos.x, z: u.pos.z, len: m.sp.len, shape: { ...m.sp.shape } };
            if (m.sp.shape.kind === 'line') {
              const sh = m.sp.shape, hit = O.sweepHit(V(sh.x1, sh.z1), V(sh.x2, sh.z2), 0.45, arena.obstacles ?? []);
              began.through = hit ? cat(hit.obstacle) : null;
            }
          }
          return ok;
        };
        mind.end = (u, m, rest) => { if (!ended && m.sp && m.sp.kind !== 'slam') ended = { x: u.pos.x, z: u.pos.z, went: m.sp.went, t: m.sp.t }; return e0(u, m, rest); };
        for (let f = 0; f < 60 * 4 && !ended; f++) {
          _world.go(H.x, H.z);
          vfx.duel.heroHp = max;
          _world.step(1 / 60);
          pk.update(1 / 60, arena.caster.group.position);
          if (!unit.alive) break;
          const rk = (arena.obstacles ?? []).filter(isRoot).length + ':' + (arena.obstacles ?? []).filter(isRoot).map((o) => o.ax).join(',');
          if (began && rk !== lastRoots) out.flipsMidRun++;
          // Through a wall that stands at that moment: the step from last frame's place to this one crosses a piece's core.
          if (began && !ended && prev) {
            for (const o of arena.obstacles ?? []) {
              if (O.segDist(o.ax, o.az, o.bx, o.bz, prev.x, prev.z, unit.pos.x, unit.pos.z) < o.r * 0.5 && distTo(o, prev.x, prev.z) > o.r && distTo(o, unit.pos.x, unit.pos.z) > o.r) { through = cat(o); }
            }
          }
          prev = began && !ended ? unit.pos.clone() : null;
          if (began && !ended && began.shape.kind === 'line') {
            const sh = began.shape, ex = sh.x2 - sh.x1, ez = sh.z2 - sh.z1, l2 = ex * ex + ez * ez || 1;
            const t = Math.max(0, Math.min(1, ((unit.pos.x - sh.x1) * ex + (unit.pos.z - sh.z1) * ez) / l2));
            lane = Math.max(lane, Math.hypot(unit.pos.x - (sh.x1 + ex * t), unit.pos.z - (sh.z1 + ez * t)) - sh.width / 2);
          }
          lastRoots = rk;
          if (began && began.kind === 'slam') break;
        }
        if (began && ended) {
          out.runs++;
          const kk = (out.byKind[`${spec.id}:${began.kind}`] ??= { runs: 0, short: 0 });
          kk.runs++;
          // Where it stands once the frame is over (a rising wall sets units aside after the summons have moved).
          const p = unit.alive ? unit.pos.clone() : V(ended.x, ended.z), q = p.clone();
          arena.keepInside(q, 0.5);
          const off = Math.hypot(q.x - p.x, q.z - p.z);
          const obs = arena.obstacles ?? [];
          const inside = obs.filter((x) => distTo(x, p.x, p.z) < x.r).map(cat);
          const a = { x: began.x, z: began.z };
          const crossed = obs.filter((x) => segDist(x, a, p) < x.r * 0.6).map(cat);
          const sees = arena.lineOfSight(V(a.x, a.z), p);
          const onGround = ground().on(p.x, p.z);
          const why = [];
          if (inside.length) why.push(`inside ${inside.join('+')}`);
          if (!onGround && !inside.length) why.push('off the walkable ground');
          if (through) why.push(`through ${through} (a step crossed it while it stood)`);
          else if (crossed.length && !sees && began.through) why.push(`across ${crossed.join('+')}`);
          if (off > 1) why.push(`${off.toFixed(2)} m from keepInside`);
          if (ended.went < began.len * 0.5) kk.short++;
          if (began.through) { why.push(`its line drawn through ${began.through}`); kk.through = (kk.through ?? 0) + 1; }
          if (lane > 0.5) { why.push(`left its lane by ${lane.toFixed(2)} m`); kk.lane = (kk.lane ?? 0) + 1; }
          if (why.some((w) => !w.startsWith('its line') && !w.startsWith('left its lane'))) kk.bad = (kk.bad ?? 0) + 1;
          if (why.length) out.faults.push({ piece: what, kind: spec.id, special: began.kind, from: [+a.x.toFixed(1), +a.z.toFixed(1)], to: [+p.x.toFixed(1), +p.z.toFixed(1)], len: +began.len.toFixed(1), went: +ended.went.toFixed(1), why: why.join(', ') });
        }
        pk.off = true; pk.dispose();
        _world.step(0.05);
      }
    }
  }
  out.rootsUp = (arena.obstacles ?? []).filter(isRoot).map((o) => lawWalls.find((w) => w.ax === o.ax && w.az === o.az)?.set).join('');
  out.rootsUpAtStart = obs0.filter(isRoot).map((o) => lawWalls.find((w) => w.ax === o.ax && w.az === o.az)?.set).join('');
  out.law = def.law?.kind;
  out.zonesLeft = arena.group.children.filter((c) => c.name === 'tactics-zone').length;
  out.zonesLive = T.Zones.live;
  return JSON.stringify(out);
}"""


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('port', type=int)
    ap.add_argument('floor', type=int)
    ap.add_argument('--pin', type=int, default=None)
    ap.add_argument('--flip', type=float, default=0)
    ap.add_argument('--trials', type=int, default=120)
    ap.add_argument('--hero', default='Bram')
    ap.add_argument('--tactics', default='on')
    a = ap.parse_args()
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 960, 'height': 540})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto(f'http://localhost:{a.port}/', wait_until='load', timeout=180000)
        await pg.wait_for_function('!!window.vfx && !!window.vfx.duel', timeout=180000)
        await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/world-tool.js')).text()); }")
        await pg.evaluate(f'() => {{ globalThis.__noTactics = {"true" if a.tactics == "off" else "false"}; }}')
        r = json.loads(await pg.evaluate(JS, [a.floor, a.pin, a.flip, a.hero, a.trials]))
        await b.close()
    if 'error' in r:
        print(r)
        return
    mode = f'roots held {a.pin}' if a.pin is not None else f'roots change every {a.flip} s' if a.flip else ''
    print(f"floor {r['floor']} {mode}: {r['trials']} trials ({r['skipped']} spots skipped), {r['runs']} runs ({r['flipsMidRun']} with the roots changing mid-run), kinds {','.join(r['kinds'])}; "
          f"zones left {r['zonesLeft']}, live {r['zonesLive']}; law {r['law']}, root walls up (their sets) at start {r['rootsUpAtStart'] or '-'}, at end {r['rootsUp'] or '-'}; page errors {errs[:3] or 'none'}")
    for k, v in sorted(r['byKind'].items()):
        print(f'  {k:<24} {v["runs"]:>4} runs, {v["short"]:>3} stopped before half their line; ended inside cover / off the ground / across / off keepInside: {v.get("bad", 0)}; line through cover: {v.get("through", 0)}; left the lane: {v.get("lane", 0)}')
    print(f"faults: {len(r['faults'])}")
    for f in r['faults'][:12]:
        print('  ', json.dumps(f))


asyncio.run(main())
