"""
The roster as the game page sees it, to prove a move of heroes into folders changes nothing the game reads
(docs/pipeline/hero-framework.md, the moves of steps 3 and 4).

    python pipeline/tools/hero-roster.py take before.json            # the roster now, into a file
    python pipeline/tools/hero-roster.py diff before.json after.json # what differs (exit 1 if anything does)
    python pipeline/tools/hero-roster.py selftest out.json [labels]  # the tool page's self test of spells (default: the
                                                                     # ones the fight prints never cast)

`take` opens /game.html on a dev server of this checkout and runs pipeline/tools/hero-roster.js there: every kit field by field
(Pim and Pom's other half too), the tooltips letter for letter, models, bodies, the passives' fields, a pixel hash of every
canvas icon and portrait, the SVG each slot asks for, and every spell the game registers (targeting, bloom, settings, length).
The order of the game's list of spells is shown by `diff` but is not a difference: a moved hero's spells join its end.

`selftest` opens the tool page (/) and runs `vfx.selfTest(label)` for each spell (shake, zones, hits, emitters, errors).

It starts the fight prints' own dev server (pipeline/tools/hero-prints.vite.config.ts) on --port (default 5195) and stops it
at the end; one already answering there is used and left alone. Needs `pip install playwright` and Chrome or Edge.
"""
import argparse
import asyncio
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEVER_CAST = ["scarab stride", "time skip", "call it in", "foreclosure", "final delivery"]
BROWSER_ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"]


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/game.html", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def dev_server(port):
    if up(port):
        return None
    proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--config",
                             str(ROOT / "pipeline" / "tools" / "hero-prints.vite.config.ts"), "--port", str(port)],
                            cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if up(port):
            return proc
        time.sleep(0.5)
    proc.terminate()
    sys.exit("the dev server did not answer within 60 s")


async def take(args):
    from playwright.async_api import async_playwright
    script = (ROOT / "pipeline" / "tools" / "hero-roster.js").read_text(encoding="utf-8")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=args.browser, headless=True, args=BROWSER_ARGS, timeout=60000)
        try:
            page = await browser.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(f"http://localhost:{args.port}/game.html", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
            out = await page.evaluate(script)
            out["pageErrors"] = errors
            return out
        finally:
            await browser.close()


async def selftest(args, labels):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=args.browser, headless=True, args=BROWSER_ARGS, timeout=60000)
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            await page.goto(f"http://localhost:{args.port}/", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof vfx !== 'undefined' && !!vfx.selfTest", timeout=120000)
            out = {}
            for label in labels:
                out[label] = await page.evaluate("(l) => { const r = vfx.selfTest(l); r.duration = vfx.effect && vfx.effect.duration; return r; }", label)
            return out
        finally:
            await browser.close()


def diff(a, b, path=""):
    """Every place two plain values differ, as lines."""
    if type(a) is not type(b):
        return [f"{path}: {json.dumps(a)[:160]} -> {json.dumps(b)[:160]}"]
    if isinstance(a, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a:
                out.append(f"{path}.{k}: (none) -> {json.dumps(b[k])[:160]}")
            elif k not in b:
                out.append(f"{path}.{k}: {json.dumps(a[k])[:160]} -> (none)")
            else:
                out += diff(a[k], b[k], f"{path}.{k}")
        return out
    if isinstance(a, list):
        if len(a) != len(b):
            return [f"{path}: {len(a)} items -> {len(b)} items"] + [l for i, (x, y) in enumerate(zip(a, b)) for l in diff(x, y, f"{path}[{i}]")]
        return [l for i, (x, y) in enumerate(zip(a, b)) for l in diff(x, y, f"{path}[{i}]")]
    return [] if a == b else [f"{path}: {json.dumps(a)[:160]} -> {json.dumps(b)[:160]}"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["take", "diff", "selftest"])
    ap.add_argument("files", nargs="+")
    ap.add_argument("--port", type=int, default=5195)
    ap.add_argument("--browser", default="chrome")
    args = ap.parse_args()
    if args.cmd == "diff":
        a = json.loads(Path(args.files[0]).read_text(encoding="utf-8"))
        b = json.loads(Path(args.files[1]).read_text(encoding="utf-8"))
        order_a, order_b = a.pop("gameOrder", []), b.pop("gameOrder", [])
        if sorted(order_a) != sorted(order_b):
            print("the game's list of spells holds other labels:", sorted(set(order_a) ^ set(order_b)))
        elif order_a != order_b:
            print(f"(the game's list of spells is in another order: {len(order_a)} the same labels)")
        lines = diff(a, b)
        for l in lines:
            print(" ", l)
        print(f"{len(lines)} differences" if lines else "identical")
        if b.get("missing"):
            print("labels a kit names that the game does not register:", b["missing"])
        sys.exit(1 if lines or sorted(order_a) != sorted(order_b) else 0)
    proc = dev_server(args.port)
    try:
        if args.cmd == "take":
            out = asyncio.run(take(args))
        else:
            out = asyncio.run(selftest(args, args.files[1].split(",") if len(args.files) > 1 else NEVER_CAST))
    finally:
        if proc:
            proc.terminate()
    Path(args.files[0]).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    if args.cmd == "take":
        print(f"{len(out['roster'])} heroes, {len(out['modules'])} spells; missing labels: {out['missing']}; page errors: {len(out['pageErrors'])}")
    else:
        for l, r in out.items():
            print(f"  {l:16} ok={r.get('ok')} shake={r.get('maxShake')} zones={r.get('zones')} hits={r.get('arenaHits')} emitters={r.get('emitters')} duration={r.get('duration')} errors={r.get('errors')}")


if __name__ == "__main__":
    main()
