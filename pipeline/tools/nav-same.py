"""The navigator against its old self, its speed, and the route bot's frames (pipeline/tools/nav-same.js), from the command line.

Needs a running dev server (the tool page) and `pip install playwright`.

    python pipeline/tools/nav-same.py same  [--url http://localhost:5173/] [--seeds 1,2,3] [--out result.json]
    python pipeline/tools/nav-same.py speed [--floors 46,11,14]
    python pipeline/tools/nav-same.py frames [--floor 46] [--seconds 90] [--old]

`frames` also plays the run's slowest plan again on a fresh old and new navigator, at full speed and with the processor slowed 4
times (Chrome's throttle, about a phone).

`same` exits with 1 when the old and the new navigator gave any different answer.
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('what', choices=['same', 'speed', 'frames'])
    ap.add_argument('--url', default='http://localhost:5173/')
    ap.add_argument('--seeds', default='1,2,3')
    ap.add_argument('--ticks', type=int, default=300)
    ap.add_argument('--floors', default='')
    ap.add_argument('--floor', type=int, default=46)
    ap.add_argument('--seconds', type=float, default=90)
    ap.add_argument('--browser', default='chrome')
    ap.add_argument('--out', default='')
    ap.add_argument('--order', default='old-first', choices=['old-first', 'new-first'], help='speed: which navigator is timed first')
    ap.add_argument('--old', action='store_true', help='frames: the old navigator in the arena for the run')
    a = ap.parse_args()
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=a.browser, headless=True, args=['--use-angle=d3d11', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        page.set_default_timeout(0)
        await page.goto(a.url)
        await page.wait_for_function('() => !!(window.vfx && window.vfx.arena && window.vfx.step)', timeout=120000)
        # Every file of src/arenas, as it is on disk: the page reports each one that gave no map, and why.
        files = sorted(f.stem for f in (ROOT / 'src' / 'arenas').glob('*.ts'))
        await page.evaluate("async (files) => { window.__arenaFiles = files; eval(await (await fetch('/pipeline/tools/nav-same.js')).text()); }", files)
        floors = [int(x) for x in a.floors.split(',') if x.strip()]
        if a.what == 'same':
            opts = {'seeds': [int(x) for x in a.seeds.split(',')], 'ticks': a.ticks}
            if floors:
                opts['floors'] = floors
            res = await page.evaluate('(o) => _navSame(o)', opts)
        elif a.what == 'speed':
            res = await page.evaluate('(o) => _navSpeed(o)', {**({'floors': floors} if floors else {}), 'order': a.order})
        else:
            res = await page.evaluate('(o) => _navFrames(o)', {'floor': a.floor, 'seconds': a.seconds, 'old': a.old})
            res['replay'] = await page.evaluate('() => _navReplay()')
            cdp = await page.context.new_cdp_session(page)
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
            res['replay4x'] = await page.evaluate('() => _navReplay()')
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        await browser.close()
    text = json.dumps(res, indent=1)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(text)
    if a.what == 'same':
        for f, why in res['arenaFiles'].items():
            print(f"src/arenas/{f}.ts: {why}")
        print()
        for r in res['rows']:
            print(f"seed {r['seed']}  {r['name']:<44} slices {r['fill']:<12}  cover {r['cover']:>4}  points {r['nodes']:>5}  steps {r['steps']:>5}  clears {r['clears']:>5}  plans {r['plans']:>3}  links {r['links']:>3}  unseen edits {r['unseenEdits']}  diffs {r['diffs']}" + (f"  first: {r['first'][0]}" if r['first'] else ''))
        print(f"\n{res['maps']} maps, {res['runs']} runs: {res['steps']} steps, {res['clears']} straight-line checks, {res['plans']} plans, {res['links']} points' links, {res['unseenEdits']} edits the signature missed; "
              f"{res['diffs']} differences ({res['seconds']} s)")
        sys.exit(1 if res['diffs'] else 0)
    print(text)


asyncio.run(main())
