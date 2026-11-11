"""
Runs a script in the tool page or the game page in a headless browser and saves the pictures it returns. For review
pictures taken by the game's own renderer without the browser pane: a hidden pane slows timers and messages to a
crawl, a headless page does not.

    python pipeline/tools/page-shots.py pipeline/tools/anka-shots.js docs/spells/anka
    python pipeline/tools/page-shots.py <script.js> <out folder> [--page /game] [--size 1280x800] [--port 5181]

The script file is the body of an async function. It returns an object: every value that is a `data:image/...` URL is
saved as <key>.jpg or <key>.png in the out folder, everything else is printed as JSON (or saved whole with --json NAME). It may use `await`, `vfx` (tool
page) or `game` (game page), and `import('/src/...')`.

It uses the simulator's dev server (port 5181, no hot reload: pipeline/sim/vite.sim.config.ts): one that is running
is used and left alone, else it starts one and stops it. Needs `pip install playwright` and Google Chrome.
"""
import argparse
import asyncio
import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


async def run(args):
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--config",
                                 str(ROOT / "pipeline" / "sim" / "vite.sim.config.ts"), "--port", str(args.port)],
                                cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if up(args.port):
                break
            time.sleep(0.5)
        else:
            proc.terminate()
            sys.exit("the dev server did not answer within 60 s")
    w, h = (int(v) for v in args.size.lower().split("x"))
    body = Path(args.script).read_text(encoding="utf-8")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(channel=args.browser, headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
            page = await browser.new_page(viewport={"width": w, "height": h})
            logs = []
            page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: logs.append(str(e)))
            await page.goto(f"http://localhost:{args.port}{args.page}", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof vfx !== 'undefined' || (typeof game !== 'undefined' && !!game.api)", timeout=120000)
            result = await asyncio.wait_for(page.evaluate(f"(async () => {{\n{body}\n}})()"), timeout=args.timeout)
            await browser.close()
    finally:
        if proc:
            proc.terminate()
    rest = {}
    for key, value in (result or {}).items():
        if isinstance(value, str) and value.startswith("data:image/"):
            head, data = value.split(",", 1)
            ext = "png" if "png" in head else "jpg"
            (out / f"{key}.{ext}").write_bytes(base64.b64decode(data))
            print(f"saved {out / (key + '.' + ext)}")
        else:
            rest[key] = value
    if rest:
        if args.json:
            (out / args.json).write_text(json.dumps(rest, indent=1), encoding="utf-8")
            print(f"saved {out / args.json}")
        else:
            print(json.dumps(rest, indent=1)[:6000])
    if logs:
        print(f"{len(logs)} errors in the page; the first:")
        for line in logs[:8]:
            print("  " + line[:300])


def main():
    ap = argparse.ArgumentParser(description="Run a script in a headless game page and save the pictures it returns.")
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--page", default="/")
    ap.add_argument("--size", default="1280x800")
    ap.add_argument("--port", type=int, default=5181)
    ap.add_argument("--browser", default="chrome")
    ap.add_argument("--timeout", type=float, default=240, help="seconds the script may run")
    ap.add_argument("--json", default="", help="save what is not a picture to this file in the out folder, in full (else it is printed, cut at 6,000 characters)")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
