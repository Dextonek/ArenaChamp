"""
Runs a props script (the body of an async function) in a headless browser on the tool page and saves what it returns as JSON, and its
pictures: `await __shot(name)` saves the page; `await __save(name, dataUrl)` saves a data URL (a sheet drawn in the page) as <out>/<name>.jpg.

    python -I pipeline/tools/props-run.py <script.js> --port 5251 --out <folder> [--json result.json] [--size 1280x720] [--timeout 900]

Written for the props pass (pipeline/tools/props-probe.js, props-sheet.js); world-shots.py is the same without __save and the JSON file.
"""
import argparse
import asyncio
import base64
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
        ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        page = await ctx.new_page()

        def on_console(m):
            if m.type == 'error' and 'favicon' not in m.text:
                errors.append(m.text[:300])

        page.on('console', on_console)
        page.on('pageerror', lambda e: errors.append(str(e)[:300]))

        async def shot(name):
            await page.screenshot(path=str(out / f'{name}.jpg'), type='jpeg', quality=80)
            return name

        async def save(name, data):
            raw = base64.b64decode(data.split(',', 1)[1])
            (out / f'{name}.jpg').write_bytes(raw)
            return len(raw)

        async def log(*args):
            print(*args, flush=True)

        await page.expose_function('__shot', shot)
        await page.expose_function('__save', save)
        await page.expose_function('__log', log)
        await page.goto(f'http://localhost:{a.port}{a.page}', wait_until='load', timeout=120000)
        await page.wait_for_function("typeof vfx !== 'undefined' || (typeof game !== 'undefined' && !!game.api)", timeout=120000)
        result = await asyncio.wait_for(page.evaluate(f'(async () => {{\n{body}\n}})()'), timeout=a.timeout)
        await browser.close()
    if a.json:
        Path(a.json).write_text(json.dumps(result, indent=1), encoding='utf-8')
        print('saved', a.json)
    else:
        print(json.dumps(result, indent=1)[:8000])
    print(f'{len(errors)} console errors' + (':' if errors else ''))
    for e in errors[:10]:
        print('  ' + e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--page', default='/')
    ap.add_argument('--size', default='1280x720')
    ap.add_argument('--port', type=int, default=5251)
    ap.add_argument('--out', default='docs/tower/props')
    ap.add_argument('--json', default='')
    ap.add_argument('--browser', default='msedge')
    ap.add_argument('--timeout', type=float, default=900)
    asyncio.run(run(ap.parse_args()))


if __name__ == '__main__':
    main()
