"""
Pictures and films of a showpiece (the /showpiece page, src/showpiece/), drawn frame by frame in a headless browser.

    python -I pipeline/tools/showpiece-shots.py stills <piece> <t1,t2,...> [--out DIR] [--sheet] [--ref CLIP]
    python -I pipeline/tools/showpiece-shots.py film <piece> [--fps 30] [--out DIR] [--name NAME]
    python -I pipeline/tools/showpiece-shots.py list

stills: one 1920x1080 JPEG a time, `<piece>-<t>.jpg`; with --sheet also `<piece>-sheet.jpg`, all of them in a grid; with
--ref (a video) each still sits beside that video's frame at the same time (a comparison sheet, never for git).
film:   every frame at --fps, put together with ffmpeg as `<name or piece>.mp4` (H.264, plays on phones).

It starts its own dev server (no hot reload: pipeline/tools/showpiece.vite.config.ts) on --port (default 5186) and stops it
at the end, so it runs beside the main dev server and beside other copies of itself on other ports. Frames are drawn by
the page's own `showpiece.draw(t)`, so they are exactly what the page shows at that time, however slow the machine.
Needs `pip install playwright`, Edge (--browser msedge, the default) or Chrome, and ffmpeg.
"""
import argparse
import asyncio
import base64
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ARGS = ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']


def server_up(port):
    try:
        with urllib.request.urlopen(f'http://localhost:{port}/showpiece.html', timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def start_server(port):
    if server_up(port):
        return None
    vite = ROOT / 'node_modules' / 'vite' / 'bin' / 'vite.js'
    proc = subprocess.Popen(['node', str(vite), '--config', str(HERE / 'showpiece.vite.config.ts'), '--port', str(port)],
                            cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if proc.poll() is not None:
            sys.exit(f'the dev server stopped at once (exit {proc.returncode}); is port {port} taken?')
        if server_up(port):
            return proc
        time.sleep(0.5)
    proc.terminate()
    sys.exit('the dev server did not answer within 60 s')


async def with_page(a, piece, job):
    from playwright.async_api import async_playwright
    errors = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=a.browser, headless=True, args=ARGS)
        page = await browser.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        page.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errors.append(m.text[:300]))
        page.on('pageerror', lambda e: errors.append(str(e)[:300]))
        q = f'?piece={piece}' if piece else ''
        await page.goto(f'http://localhost:{a.port}/showpiece.html{q}', wait_until='load', timeout=120000)
        await page.wait_for_function('!!window.showpiece', timeout=120000)
        await page.evaluate('async () => { await showpiece.ready; showpiece.pause(); showpiece.setSize(1920, 1080); }')
        result = await job(page)
        await browser.close()
    if errors:
        print('page errors:')
        for e in errors[:20]:
            print('  ', e)
    return result


async def grab(page, t, path, quality=0.9):
    url = await page.evaluate(f'(t) => {{ showpiece.draw(t); return showpiece.canvas.toDataURL("image/jpeg", {quality}); }}', t)
    path.write_bytes(base64.b64decode(url.split(',', 1)[1]))


def outdir(a):
    out = Path(a.out) if a.out else ROOT / 'docs' / 'showpiece'
    if not out.is_absolute():
        out = ROOT / out
    out.mkdir(parents=True, exist_ok=True)
    return out


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)


def sheet(files, out, cols=4, w=480):
    h = w * 9 // 16
    n = len(files)
    inputs = []
    for f in files:
        inputs += ['-i', str(f)]
    scale = ''.join(f'[{i}]scale={w}:{h}[v{i}];' for i in range(n))
    layout = '|'.join(f'{(i % cols) * w}_{(i // cols) * h}' for i in range(n))
    if n == 1:
        ffmpeg(*inputs, '-vf', f'scale={w}:{h}', '-q:v', '4', str(out))
    else:
        ffmpeg(*inputs, '-filter_complex', scale + ''.join(f'[v{i}]' for i in range(n)) + f'xstack=inputs={n}:layout={layout}', '-q:v', '4', str(out))


def cmd_stills(a):
    times = [float(x) for x in a.times.split(',') if x.strip()]
    out = outdir(a)

    async def job(page):
        files = []
        for t in times:
            f = out / f'{a.piece}-{t:.2f}.jpg'
            await grab(page, t, f)
            files.append(f)
            print('saved', f.name)
        return files

    proc = start_server(a.port)
    try:
        files = asyncio.run(with_page(a, a.piece, job))
    finally:
        if proc:
            proc.terminate()
    if a.ref:
        pairs = []
        tmp = Path(tempfile.mkdtemp())
        for t, f in zip(times, files):
            r = tmp / f'ref-{t:.2f}.jpg'
            ffmpeg('-ss', str(t), '-i', a.ref, '-frames:v', '1', str(r))
            pairs += [r, f]
        sheet(pairs, out / f'{a.piece}-compare.jpg', cols=2, w=640)
        print('saved', f'{a.piece}-compare.jpg (the reference on the left; do not commit it)')
    elif a.sheet:
        sheet(files, out / f'{a.piece}-sheet.jpg', cols=4 if len(files) > 4 else 2)
        print('saved', f'{a.piece}-sheet.jpg')


def cmd_film(a):
    out = outdir(a)
    frames = Path(tempfile.mkdtemp())

    async def job(page):
        dur = await page.evaluate('showpiece.duration')
        n = int(dur * a.fps)
        for i in range(n):
            await grab(page, i / a.fps, frames / f'f{i:05d}.jpg', 0.93)
            if i % 60 == 0:
                print(f'frame {i}/{n}')
        return n

    proc = start_server(a.port)
    try:
        asyncio.run(with_page(a, a.piece, job))
    finally:
        if proc:
            proc.terminate()
    name = a.name or a.piece
    ffmpeg('-framerate', str(a.fps), '-i', str(frames / 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19',
           '-preset', 'slow', '-movflags', '+faststart', str(out / f'{name}.mp4'))
    shutil.rmtree(frames, ignore_errors=True)
    print('saved', out / f'{name}.mp4')


def cmd_list(a):
    async def job(page):
        return await page.evaluate('showpiece.pieces')

    proc = start_server(a.port)
    try:
        print(asyncio.run(with_page(a, None, job)))
    finally:
        if proc:
            proc.terminate()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name in ('stills', 'film', 'list'):
        s = sub.add_parser(name)
        if name != 'list':
            s.add_argument('piece')
        if name == 'stills':
            s.add_argument('times')
            s.add_argument('--sheet', action='store_true')
            s.add_argument('--ref')
        if name == 'film':
            s.add_argument('--fps', type=int, default=30)
            s.add_argument('--name')
        s.add_argument('--out')
        s.add_argument('--port', type=int, default=5186)
        s.add_argument('--browser', default='msedge')
    a = p.parse_args()
    {'stills': cmd_stills, 'film': cmd_film, 'list': cmd_list}[a.cmd](a)


if __name__ == '__main__':
    main()
