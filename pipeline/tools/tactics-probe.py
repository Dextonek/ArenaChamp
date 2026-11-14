"""How the Climb's packs fight (src/tower/world/tactics.ts): every pack of a floor is woken and fought standing still (the worst case:
a hero who dodges nothing) for a fixed time, with the tactics on and off. Per pack: its kinds, the specials it started, the blows they
landed, the share of the hero's health it took, and whether a zone was left on the ground after it went.

    python pipeline/tools/tactics-probe.py <port> <floor> [hero] [seconds]
"""
import asyncio, json, sys

PORT, FLOOR = int(sys.argv[1]), int(sys.argv[2])
HERO = sys.argv[3] if len(sys.argv) > 3 else 'Bram'
SECS = float(sys.argv[4]) if len(sys.argv) > 4 else 12

JS = """async ([n, hero, secs, off]) => {
  globalThis.__noTactics = off;
  if (n !== 1) await _worldGen(n);
  await _world({ floor: n, hero, mode: 'play', persist: false });
  const g = _world.game(), z = g.zone, arena = vfx.arena, out = [];
  const zonesLeft = () => arena.group.children.filter((c) => c.name === 'tactics-zone').length;
  const max = vfx.duel.heroMax ?? vfx.duel.heroHp;
  for (const pk of [...z.packs.values()]) {
    if (pk.state === 'cleared') continue;
    const h = pk.home;
    _world.go(h.x + 6, h.z);
    _world.step(1);
    if (pk.state === 'unborn') pk.spawn(true);
    if (pk.state !== 'awake') pk.wake('probe');
    vfx.duel.heroHp = max;
    const at = arena.caster.group.position, stand = { x: at.x, z: at.z };
    let lost = 0, was = vfx.duel.heroHp, maxZones = 0;
    for (let s = 0; s < secs * 10; s++) {
      _world.go(stand.x, stand.z);
      _world.step(0.1);
      const hp = vfx.duel.heroHp;
      if (hp < was) lost += was - hp;
      if (hp <= max * 0.2) vfx.duel.heroHp = max; // it keeps standing (the share counts what was taken)
      was = vfx.duel.heroHp;
      maxZones = Math.max(maxZones, zonesLeft());
    }
    const kinds = pk.units.map((u) => pk.specOf(u)?.id).filter(Boolean);
    const stats = { ...pk.mind.stats };
    pk.off = true; pk.dispose();
    _world.step(0.2);
    out.push({ id: pk.id, kinds: [...new Set(kinds)].join(','), n: kinds.length, took: +(lost / max).toFixed(2), stats, maxZones, left: zonesLeft() });
  }
  return JSON.stringify(out);
}"""


async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--ignore-gpu-blocklist'])
        rows = {}
        for off in (False, True):
            pg = await b.new_page(viewport={'width': 960, 'height': 540})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
            await pg.goto(f'http://localhost:{PORT}/', wait_until='load', timeout=180000)
            await pg.wait_for_function('!!window.vfx && !!window.vfx.duel', timeout=180000)
            await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/world-tool.js')).text()); }")
            rows['off' if off else 'on'] = json.loads(await pg.evaluate(JS, [FLOOR, HERO, SECS, off]))
            if errs:
                print('errors', 'off' if off else 'on', errs[:3])
            await pg.close()
        await b.close()
    off = {r['id']: r for r in rows['off']}
    print(f'floor {FLOOR}, {HERO} standing still {SECS:.0f} s a pack; took = share of the hero\'s health')
    print(f"{'pack':<14}{'kinds':<34}{'took on':>8}{'took off':>9}  specials (on)                      zones max/left")
    for r in rows['on']:
        o = off.get(r['id'], {})
        print(f"{r['id']:<14}{r['kinds'][:33]:<34}{r['took']:>8}{o.get('took', '-'):>9}  {json.dumps(r['stats'])[:34]:<35}{r['maxZones']}/{r['left']}")
    ton = sum(r['took'] for r in rows['on']); toff = sum(r['took'] for r in rows['off'])
    print(f'total took: on {ton:.2f}, off {toff:.2f}')


asyncio.run(main())
