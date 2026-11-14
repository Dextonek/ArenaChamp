"""A warden (the named and the guards: src/tower/world/tactics.ts) with its back to cover, the hero 2 m in front, its charge due: it must
still land a blow (it falls back once for the charge; with no room, or the charge refused, it slams). For each floor, up to <trials> pieces
of cover; prints the trials that land no blow in 8 s (`never`), the first blow's median and slowest time, and the specials used.

    python pipeline/tools/tactics-pinned.py <port> <floors, comma> [trials]
"""
import asyncio, json, sys
PORT = int(sys.argv[1]); FLOORS = [int(x) for x in sys.argv[2].split(",")]; TRIALS = int(sys.argv[3]) if len(sys.argv) > 3 else 40
JS = """async ([n, trials]) => {
  const T = await import('/src/tower/world/tactics.ts'), P = await import('/src/tower/world/packs.ts');
  await _worldGen(n);
  await _world({ floor: n, hero: 'Bram', mode: 'play', persist: false });
  const g = _world.game(), z = g.zone, arena = vfx.arena, max = vfx.duel.heroMax ?? vfx.duel.heroHp;
  const packs = [...z.packs.values()]; for (const p of packs) { p.off = true; p.dispose(); }
  const env = packs[0].env;
  const wardens = Object.values(env.enemies).filter((s) => T.roleOf(s) === 'warden');
  const V = (x, zz) => { const p = arena.caster.group.position.clone(); p.set(x, 0, zz); return p; };
  const free = (p) => { const q = p.clone(); arena.keepInside(q, 0.5); return Math.hypot(q.x - p.x, q.z - p.z) < 0.05; };
  let hits = 0, by = '';
  const hurt0 = vfx.duel.hurtHero.bind(vfx.duel);
  vfx.duel.hurtHero = (o) => { if (o?.move === by) hits++; return hurt0(o); };
  const obs = (arena.obstacles ?? []).filter((o) => o.r < 3), out = { trials: 0, never: [], firstBlow: [], specials: {} };
  for (let i = 0; i < obs.length && out.trials < trials; i += Math.max(1, Math.floor(obs.length / trials))) {
    const o = obs[i], mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, ex = o.bx - o.ax, ez = o.bz - o.az, l = Math.hypot(ex, ez);
    const [nx, nz] = l > 1e-3 ? [-ez / l, ex / l] : [1, 0];
    const U = V(mx + nx * (o.r + 0.55), mz + nz * (o.r + 0.55)), H = V(U.x + nx * 2, U.z + nz * 2);
    if (!free(U) || !free(H)) continue;
    const spec = wardens[out.trials % wardens.length]; g.run.lives = 9;
    out.trials++;
    const pk = new P.Pack({ id: 'pin', at: { x: U.x, z: U.z }, leash: 1e9, mix: [{ kind: spec.id, n: 1 }] }, env);
    _world.go(H.x, H.z);
    if (!pk.spawn()) continue;
    pk.wake('probe');
    const u = pk.units[0], m = pk.mind.minds.get(u);
    m.i = 1; m.ready = 0; u.cd = 0;
    hits = 0; by = spec.name;
    let first = -1;
    for (let f = 0; f < 60 * 8; f++) { _world.go(H.x, H.z); vfx.duel.heroHp = max; _world.step(1 / 60); pk.update(1 / 60, arena.caster.group.position); if (hits && first < 0) first = f / 60; }
    if (first < 0) out.never.push({ kind: spec.id, at: [+U.x.toFixed(1), +U.z.toFixed(1)], stats: { ...pk.mind.stats }, fade: m.fade, backed: m.backed, victims: u.summon.world.victims().length, d: +Math.hypot(u.pos.x - H.x, u.pos.z - H.z).toFixed(2), hp: vfx.duel.heroHp, focus: !!pk.mind.focus, piece: g.piece ?? null, log: (g.log ?? []).slice(-2) });
    else out.firstBlow.push(+first.toFixed(1));
    for (const [k, v] of Object.entries(pk.mind.stats)) out.specials[k] = (out.specials[k] ?? 0) + v;
    pk.off = true; pk.dispose(); _world.step(0.05);
  }
  out.firstBlow.sort((a, b) => a - b);
  return JSON.stringify({ floor: n, kinds: wardens.map((w) => w.id), trials: out.trials, never: out.never.slice(0, 8), nNever: out.never.length, firstBlowMedian: out.firstBlow[Math.floor(out.firstBlow.length / 2)], firstBlowMax: out.firstBlow[out.firstBlow.length - 1], specials: out.specials });
}"""
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio'])
        for n in FLOORS:
            pg = await b.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
            await pg.goto(f'http://localhost:{PORT}/', wait_until='load')
            await pg.wait_for_function('!!window.vfx && !!window.vfx.duel', timeout=180000)
            await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/world-tool.js')).text()); }")
            print(await pg.evaluate(JS, [n, TRIALS]), errs[:2] or '', flush=True)
            await pg.close()
        await b.close()
asyncio.run(main())
