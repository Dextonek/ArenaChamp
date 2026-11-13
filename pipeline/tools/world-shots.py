"""
Runs a script in a headless browser on the game or tool page and saves pictures of the whole page (the 3D view AND the page's own
HUD, the dark layer, the cards), which a canvas grab does not hold.

    python -I pipeline/tools/world-shots.py <script.js> [--page /] [--size 1280x720] [--port 5194] [--out docs/tower/worlds]
                                            [--browser msedge] [--touch] [--timeout 900]

The script is the body of an async function. It may `await`, and call `await __shot('name')`, which saves <out>/<name>.jpg (the page as it
is now), and `__log(...)`. What it returns is printed as JSON. The page's console errors are listed at the end (the favicon 404 aside).
Needs `pip install playwright` and Edge or Chrome. Written for the Tower's floors as worlds (stage 2b), where a hidden browser pane freezes
CSS animations and slows time: a headless page does not.
"""
import argparse
import asyncio
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


async def run(a):
    from playwright.async_api import async_playwright

    w, h = (int(v) for v in a.size.lower().split('x'))
    body = Path(a.script).read_text(encoding='utf-8')
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=a.browser, headless=True, args=['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        ctx = await browser.new_context(viewport={'width': w, 'height': h}, has_touch=a.touch, is_mobile=a.touch, device_scale_factor=1)
        page = await ctx.new_page()

        def on_console(m):
            if m.type == 'error' and 'favicon' not in (m.location.get('url', '') if m.location else '') and 'favicon' not in m.text:
                errors.append(m.text[:300])

        page.on('console', on_console)
        page.on('pageerror', lambda e: errors.append(str(e)[:300]))

        async def shot(name):
            await page.screenshot(path=str(out / f'{name}.jpg'), type='jpeg', quality=82)
            print('saved', name)
            return name

        async def log(*args):
            print(*args)

        await page.expose_function('__shot', shot)
        await page.expose_function('__log', log)
        await page.goto(f'http://localhost:{a.port}{a.page}', wait_until='load', timeout=120000)
        await page.wait_for_function("typeof vfx !== 'undefined' || (typeof game !== 'undefined' && !!game.api)", timeout=120000)
        result = await asyncio.wait_for(page.evaluate(f'(async () => {{\n{body}\n}})()'), timeout=a.timeout)
        await browser.close()
    print(json.dumps(result, indent=1)[:12000])
    if errors:
        print(f'{len(errors)} errors in the page; the first:')
        for e in errors[:10]:
            print('  ' + e)
    else:
        print('no console errors')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--page', default='/')
    ap.add_argument('--size', default='1280x720')
    ap.add_argument('--port', type=int, default=5194)
    ap.add_argument('--out', default='docs/tower/worlds')
    ap.add_argument('--browser', default='msedge')
    ap.add_argument('--touch', action='store_true')
    ap.add_argument('--timeout', type=float, default=900)
    asyncio.run(run(ap.parse_args()))


if __name__ == '__main__':
    main()
