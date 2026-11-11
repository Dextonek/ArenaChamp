"""
A raid for a party, played by bots through the real hub: N headless pages of the game, each its own throwaway account,
one public raid room, the host starts, every screen's autopilot plays. To find what only breaks with many screens.

    python pipeline/tools/party-raid.py <out folder> [--players 6] [--seconds 150] [--port 5196]

It starts its own dev server (the game's hub lives in it) on the port and stops it by its PID; one already there is used
and left alone. The bots' accounts are local (server/data/, git-ignored): delete them after. It writes party.json (what
each screen saw each second) and a picture from the first and the last screen, and prints a summary: whether the screens
agree on the boss's HP, how far out heroes walked, errors.
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
HEROES = ["Lyra", "Bram", "Kaia", "Brannoc", "Isolde", "Sefu", "Auriel", "Cantor", "Nyx", "Hank", "Kaia", "Lyra"]


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


async def run(args):
    from playwright.async_api import async_playwright
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(args.port), "--strictPort"], cwd=ROOT,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            if up(args.port):
                break
            time.sleep(0.5)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
            pages = []
            for i in range(args.players):
                ctx = await browser.new_context(viewport={"width": 900, "height": 600})
                pg = await ctx.new_page()
                await pg.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                await pg.wait_for_function("!!window.game && window.game.state.connected", timeout=60000)
                await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); }")
                pages.append(pg)
            code = await pages[0].evaluate(f"() => _botParty('{HEROES[0]}')")
            for i, pg in enumerate(pages[1:], 1):
                await pg.evaluate(f"() => _botParty('{HEROES[i % len(HEROES)]}', '{code}')")
            await asyncio.sleep(1.5)
            seats = await pages[0].evaluate("() => _botGo()")
            print(f"room {code}: {seats} seats, started")
            t0 = time.time()
            shot = False
            while time.time() - t0 < args.seconds:
                await asyncio.sleep(5)
                now = [await pg.evaluate("() => _botRaid()") for pg in pages]
                line = " | ".join(f"{s.get('boss', '-')}/{s.get('hp', '-')}{'D' if s.get('down') else ''}" for s in now)
                print(f"{time.time() - t0:5.0f}s  {line}")
                if not shot and all(s.get("boss") for s in now) and time.time() - t0 > 40:
                    shot = True
                    await pages[0].screenshot(path=str(out / "party-first.png"))
                    await pages[-1].screenshot(path=str(out / "party-last.png"))
                if all(s.get("over") for s in now if "over" in s) and any("over" in s for s in now):
                    break
            logs = [await pg.evaluate("() => ({ raid: _botRaidLog(), log: JSON.parse(_botLog()) })") for pg in pages]
            (out / "party.json").write_text(json.dumps(logs, indent=1), encoding="utf-8")
            for i, l in enumerate(logs):
                s = l["raid"]["samples"]
                last = s[-1] if s else {}
                far = max((abs(x["me"][0]) + abs(x["me"][1] - 7) for x in s if x.get("me")), default=0)
                print(f"screen {i}: samples {len(s)}, room {last.get('room')}, gauge {last.get('gauge')}, party {last.get('party')}, boss {last.get('boss')}, phase {last.get('phase')}, "
                      f"hp {last.get('hp')}, far {far:.0f}, over {last.get('over')}, errors {len(l['log']['errors'])} {l['log']['errors'][:2]}")
            await browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--players", type=int, default=6)
    ap.add_argument("--seconds", type=int, default=150)
    ap.add_argument("--port", type=int, default=5196)
    a = ap.parse_args()
    asyncio.run(run(a))
