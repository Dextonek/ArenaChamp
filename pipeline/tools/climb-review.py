"""
The Climb review's runner (docs/tower/review/): runs one part of a floor's check in a headless browser on the game page and keeps
everything it finds. Like world-shots.py (pictures of the whole page, HUD and all; `await __shot(name)`; `await __save(name, dataUrl)` keeps a canvas grab), but it saves the WHOLE
result as JSON (world-shots prints only its start), sets `window.__review = { floor, hero, out }` before the body runs, and stops
itself within 590 s.

    python -I pipeline/tools/climb-review.py <part.js> --floor 1 --out docs/tower/review/floors-01-30/f01 [--port 5196]
                                             [--size 1280x720] [--touch] [--hero Lyra] [--json static] [--pics <folder>] [--timeout 590]

Parts: climb-review-static.js (texts, reachability, props and grass probes), climb-review-route.js (the route bot, pictures of the
pieces), climb-review-shots.js (pictures, the map, a frame check; with --size 390x844 --touch: the phone).
The dev server must be running (pipeline/tools/vite.review.config.ts). Needs `pip install playwright` and Edge or Chrome.
"""
import argparse
import asyncio
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


async def run(a):
    from playwright.async_api import async_playwright

    w, h = (int(v) for v in a.size.lower().split('x'))
    body = Path(a.script).read_text(encoding='utf-8')
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)
    pics = Path(a.pics) if a.pics else out
    pics.mkdir(parents=True, exist_ok=True)
    errors, warns = [], []
    t0 = time.time()
    async with async_playwright() as pw:
        args = ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
        browser = await pw.chromium.launch(channel=a.browser, headless=True, args=args)
        ctx = await browser.new_context(viewport={'width': w, 'height': h}, has_touch=a.touch, is_mobile=a.touch, device_scale_factor=1)
        page = await ctx.new_page()

        def on_console(m):
            loc = m.location.get('url', '') if m.location else ''
            if 'favicon' in loc or 'favicon' in m.text:
                return
            if m.type == 'error':
                errors.append(m.text[:400])
            elif m.type == 'warning' and len(warns) < 40:
                warns.append(m.text[:300])

        page.on('console', on_console)
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:400]))
        page.on('requestfailed', lambda r: errors.append('requestfailed: ' + r.url[:200]))

        async def on_response(r):
            if r.status >= 400 and 'favicon' not in r.url:
                errors.append(f'http {r.status}: {r.url[:200]}')

        page.on('response', on_response)

        async def shot(name):
            await page.screenshot(path=str(pics / f'{name}.jpg'), type='jpeg', quality=80)
            print('saved', name, flush=True)
            return name

        async def log(*args):
            print(*args, flush=True)

        async def save(name, data_url):
            import base64
            (pics / f'{name}.jpg').write_bytes(base64.b64decode(data_url.split(',', 1)[1]))
            print('saved', name, flush=True)
            return name

        await page.expose_function('__save', save)
        await page.expose_function('__shot', shot)
        await page.expose_function('__log', log)
        await page.goto(f'http://localhost:{a.port}{a.page}', wait_until='load', timeout=120000)
        await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
        pre = f'window.__review = {{ floor: {a.floor}, hero: {json.dumps(a.hero)}, phone: {json.dumps(a.touch)} }};\n'
        try:
            result = await asyncio.wait_for(page.evaluate(f'(async () => {{\n{pre}{body}\n}})()'), timeout=a.timeout)
        except Exception as e:  # a timeout or an error in the body: keep what is known
            result = {'failed': str(e)[:600]}
            try:
                result['partial'] = await page.evaluate('window.__review && window.__review.out')
            except Exception:
                pass
        await browser.close()
    result = {'floor': a.floor, 'part': Path(a.script).stem, 'wallSeconds': round(time.time() - t0, 1), 'errors': errors, 'warnings': warns, 'result': result}
    name = a.json or Path(a.script).stem.replace('climb-review-', '')
    (out / f'{name}.json').write_text(json.dumps(result, indent=1), encoding='utf-8')
    print(f'{name}.json written; {len(errors)} errors; {result["wallSeconds"]} s')
    for e in errors[:12]:
        print('  ERR ' + e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--floor', type=int, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--page', default='/game')
    ap.add_argument('--size', default='1280x720')
    ap.add_argument('--port', type=int, default=5196)
    ap.add_argument('--browser', default='msedge')
    ap.add_argument('--hero', default='Lyra')
    ap.add_argument('--json', default='')
    ap.add_argument('--pics', default='', help='where the pictures go (default: --out); the review keeps the raw ones outside the repo')
    ap.add_argument('--touch', action='store_true')
    ap.add_argument('--timeout', type=float, default=590)
    asyncio.run(run(ap.parse_args()))


if __name__ == '__main__':
    main()
