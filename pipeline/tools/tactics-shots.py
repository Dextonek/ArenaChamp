"""Pictures of the Climb's packs' specials from the game's camera (src/tower/world/tactics.ts): a pack with a unit of the kind is woken
with the hero at `dist` m, the game runs until that kind's zone is on the ground, and a picture is taken mid wind-up.

    python pipeline/tools/tactics-shots.py <port> <out folder> <floor>:<kind id prefix>:<dist> [...]
    e.g. python pipeline/tools/tactics-shots.py 5248 docs/tower/tactics 2:crab:3 46:knight:9 35:lurker:7
"""
import asyncio, base64, os, sys

PORT, OUT = int(sys.argv[1]), sys.argv[2]
JOBS = [a.split(':') for a in sys.argv[3:]]

JS = """async ([n, kind, dist]) => {
  if (n !== 1) await _worldGen(n);
  await _world({ floor: n, hero: 'Bram', mode: 'play', persist: false });
  const g = _world.game(), z = g.zone, arena = vfx.arena;
  const zones = () => arena.group.children.filter((c) => c.name === 'tactics-zone');
  const max = vfx.duel.heroMax ?? vfx.duel.heroHp;
  for (const pk of [...z.packs.values()]) {
    if (!pk.def.mix.some((m) => m.kind.startsWith(kind)) && !(pk.def.elite ?? '').startsWith(kind)) continue;
    const h = pk.home;
    _world.go(h.x + dist, h.z);
    _world.step(1.2);
    if (pk.state === 'unborn') pk.spawn(true);
    // the other packs keep still
    for (const o of z.packs.values()) if (o !== pk) o.off = true;
    if (pk.state !== 'awake') pk.wake('shot');
    const at = arena.caster.group.position, stand = { x: at.x, z: at.z };
    for (let s = 0; s < 400; s++) {
      vfx.duel.heroHp = max;
      _world.go(stand.x, stand.z);
      _world.step(0.05);
      const zs = zones();
      if (zs.length) {
        for (let k = 0; k < 9; k++) { _world.go(stand.x, stand.z); _world.step(0.05); }
        return pk.id;
      }
    }
    return 'no zone: ' + pk.id;
  }
  return 'no pack';
}"""


async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--ignore-gpu-blocklist'])
        for n, kind, dist in JOBS:
            pg = await b.new_page(viewport={'width': 1280, 'height': 720})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
            await pg.goto(f'http://localhost:{PORT}/', wait_until='load', timeout=180000)
            await pg.wait_for_function('!!window.vfx && !!window.vfx.duel', timeout=180000)
            await pg.add_style_tag(content='*{animation:none!important}')
            await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/world-tool.js')).text()); }")
            r = await pg.evaluate(JS, [int(n), kind, float(dist)])
            path = os.path.join(OUT, f'f{int(n):02d}-{kind}.jpg')
            await pg.screenshot(path=path, type='jpeg', quality=85)
            print(n, kind, r, path, errs[:2])
            await pg.close()
        await b.close()


asyncio.run(main())
