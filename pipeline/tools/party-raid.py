"""
A raid for a party, played by bots through the real hub: N headless pages of the game, each its own throwaway account,
one public raid room, the host starts, every screen's autopilot plays. To find what only breaks with many screens.

    python pipeline/tools/party-raid.py <out folder> [--players 6] [--seconds 150] [--port 5196] [--boss sun]
                                        [--boost 0] [--twin] [--phone]

--boss   the boss the run starts at (sun, ash, heart): the lobby's `raid`. A party at `ash` fights Twin Flames.
--boost  every bot also takes this much HP a second off the boss it fights, through the hub (under its caps), so a fight
         ends in the time given: six bots at the HP for ten are slow.
--twin   Twin Flames' own test (with --boss ash): the boost is steered so that the west half gets far ahead (Ember grows
         furious), the east catches up (she calms), both fall low together, Ash falls first (the wall goes out) and then
         Ember. Pictures at each of those moments; a check that all screens agree on both HP bars and that every bot
         stayed in its own half while the wall stood.
--phone  the last player's screen is a phone held upright (390 x 844).

It starts its own dev server (the game's hub lives in it) on the port and stops it by its PID; one already there is used
and left alone. Its own server runs with the hero shop off (SHOP=off; pipeline/designs/hero-shop.md): the bots' accounts
are new, and with the shop on a new account may only take the starters and the week's free heroes into a raid room. On
a server that is already there with the shop on, a bot whose hero is locked gets none, and the raid does not start. The bots' accounts are local (server/data/, git-ignored): delete them after (names start with v5bot). It
writes party.json (what each screen saw each second) and pictures, and prints a summary: whether the screens agree on
the boss's HP, how far out heroes walked, errors.
"""
import argparse
import asyncio
import json
import os
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


async def shot(pg, path):
    """A picture of the game as it is, with the page's animations held (they freeze a headless page's screenshot)."""
    await pg.screenshot(path=str(path))
    print(f"      picture {path.name}")


class TwinPlan:
    """
    Steers the bots' boost through Twin Flames, from what screen 0 sees of both HP bars, and takes the pictures.
    Stages: wait (the fight as the bots play it, 14 s), lead (the west half gets ahead until Ember is furious), level
    (the east catches up until she calms), both (both halves, until they are under a third), ash (the west only, until
    he falls and the wall goes out), ember (everyone on her), done.
    """

    def __init__(self, pages, out, boost):
        self.pages, self.out, self.boost = pages, out, max(40, boost)
        self.stage = "wait"
        self.seen = set()
        self.notes = []
        self.live = None
        self.since = 0.0

    async def set(self, west, east, halves):
        for pg, half in zip(self.pages, halves):
            await pg.evaluate(f"() => {{ window._botBoost = {west if half == 0 else east}; }}")

    async def once(self, name, pg):
        if name in self.seen:
            return
        self.seen.add(name)
        await shot(pg, self.out / f"twin-{name}.png")

    async def step(self, t, now):
        tw = now[0].get("twin")
        if not tw:
            return
        halves = [s.get("twin", {}).get("half", 0) for s in now]
        share = [tw["hp"][i] / tw["max"][i] for i in (0, 1)]
        gap = share[0] - share[1]
        west = next((pg for pg, h in zip(self.pages, halves) if h == 0), self.pages[0])
        east = next((pg for pg, h in zip(self.pages, halves) if h == 1), self.pages[-1])
        b = self.boost
        was = self.stage
        # The fight is on from the first hit on either of them.
        if self.live is None and min(share) < 1:
            self.live = t
        if self.stage == "wait":
            if self.live is not None and t - self.live > 12:
                await self.once("west", west)
                await self.once("east", east)
                if len(self.pages) > 2:
                    await self.once("phone", self.pages[-1])
                self.stage = "lead"
        elif self.stage == "lead":
            await self.set(b * 3, 0, halves)
            if tw["furious"] == 1:
                await asyncio.sleep(0.6)
                await self.once("furious-east", east)
                await self.once("furious-seen-from-west", west)
                # A second look: a hero's own spell can fill the first.
                await asyncio.sleep(2.5)
                await self.once("furious-east-2", east)
                self.stage = "level"
        elif self.stage == "level":
            await self.set(0, b * 3, halves)
            if tw["furious"] < 0 and abs(gap) <= 0.06:
                self.stage = "both"
        elif self.stage == "both":
            # Level again and falling together: more on whichever is behind.
            await self.set(b * (2 if gap > 0 else 1), b * (2 if gap < 0 else 1), halves)
            if min(share) < 0.33:
                await self.once("together", west)
                self.stage = "ash"
        elif self.stage == "ash":
            await self.set(b * 4, 0, halves)
            if tw["dead"][0]:
                await self.set(0, 0, halves)
                await self.once("wall-out-east", east)
                await self.once("wall-out-west", west)
                await asyncio.sleep(2.5)
                await self.once("wall-gone", west)
                self.stage = "ember"
                self.since = t
        elif self.stage == "ember":
            # A while with no boost, so the west half walks over to her; then everyone ends it.
            if t - self.since > 14:
                await self.once("last-one", west)
                await self.set(b * 3, b * 3, halves)
            if tw["dead"][1] or now[0].get("over"):
                await self.once("won", west)
                self.stage = "done"
                self.since = t
        if self.stage != was:
            self.notes.append((round(t), self.stage, round(share[0] * 100), round(share[1] * 100)))
            print(f"      twin: {was} -> {self.stage} at {t:.0f} s, Ash {share[0] * 100:.0f} %, Ember {share[1] * 100:.0f} %")


async def run(args):
    from playwright.async_api import async_playwright
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(args.port), "--strictPort"], cwd=ROOT,
                                env={**os.environ, "SHOP": "off"}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
                phone = args.phone and i == args.players - 1
                ctx = await browser.new_context(**({"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2}
                                                   if phone else {"viewport": {"width": args.width, "height": args.height}}))
                pg = await ctx.new_page()
                await pg.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                await pg.wait_for_function("!!window.game && window.game.state.connected", timeout=60000)
                await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); }")
                pages.append(pg)
            code = await pages[0].evaluate(f"() => _botParty('{HEROES[0]}', undefined, '{args.boss}')")
            for i, pg in enumerate(pages[1:], 1):
                await pg.evaluate(f"() => _botParty('{HEROES[i % len(HEROES)]}', '{code}')")
            await asyncio.sleep(1.5)
            seats = await pages[0].evaluate("() => _botGo()")
            print(f"room {code}: {seats} seats, started at {args.boss}")
            if args.boost and not args.twin:
                for pg in pages:
                    await pg.evaluate(f"() => {{ window._botBoost = {args.boost}; }}")
            plan = TwinPlan(pages, out, args.boost) if args.twin else None
            t0 = time.time()
            taken = False
            last = 0.0
            spread = 0.0
            crossed = 0
            twin_seen = False
            while time.time() - t0 < args.seconds:
                await asyncio.sleep(1 if args.boss == "ash" else 5)
                t = time.time() - t0
                now = [await pg.evaluate("() => _botRaid()") for pg in pages]
                if all(s.get("twin") for s in now):
                    twin_seen = True
                    if plan:
                        await plan.step(t, now)
                    # Every screen's two HP bars against screen 0's, as a share of a bar; and nobody across the wall while it stands.
                    for s in now[1:]:
                        for i in (0, 1):
                            spread = max(spread, abs(s["twin"]["hp"][i] - now[0]["twin"]["hp"][i]) / s["twin"]["max"][i])
                    for s in now:
                        if s["twin"]["wall"] and s.get("me") and (s["me"][0] < 0) != (s["twin"]["half"] == 0):
                            crossed += 1
                    # The planned fight is over: no need to play on into the next boss.
                    if plan and plan.stage == "done" and t - plan.since > 3:
                        break
                if t - last >= 5:
                    last = t
                    if now[0].get("twin"):
                        line = " | ".join(f"{s['twin']['name'][:3]} {s['twin']['hp'][0]}/{s['twin']['hp'][1]} hp {s.get('hp', '-')}{'D' if s.get('down') else ''}" if s.get("twin") else "-" for s in now)
                    else:
                        line = " | ".join(f"{s.get('boss', '-')}/{s.get('hp', '-')}{'D' if s.get('down') else ''}" for s in now)
                    print(f"{t:5.0f}s  {line}")
                if not taken and not plan and all(s.get("boss") for s in now) and t > (60 if twin_seen else 40):
                    taken = True
                    await pages[0].screenshot(path=str(out / "party-first.png"))
                    await pages[-1].screenshot(path=str(out / "party-last.png"))
                if all(s.get("over") for s in now if "over" in s) and any("over" in s for s in now):
                    if plan and plan.stage != "done":
                        await plan.once("end", pages[0])
                    break
            logs = [await pg.evaluate("() => ({ raid: _botRaidLog(), log: JSON.parse(_botLog()) })") for pg in pages]
            (out / "party.json").write_text(json.dumps(logs, indent=1), encoding="utf-8")
            for i, l in enumerate(logs):
                s = l["raid"]["samples"]
                last_s = s[-1] if s else {}
                far = max((abs(x["me"][0]) + abs(x["me"][1] - 7) for x in s if x.get("me")), default=0)
                tw = last_s.get("twin")
                twin = f", half {tw['half']}, enemy {tw['name']}, bars {tw['hp']}, furious {tw['furious']}, dead {tw['dead']}" if tw else ""
                print(f"screen {i}: samples {len(s)}, room {last_s.get('room')}, gauge {last_s.get('gauge')}, party {last_s.get('party')}, boss {last_s.get('boss')}, phase {last_s.get('phase')}, "
                      f"hp {last_s.get('hp')}, far {far:.0f}, over {last_s.get('over')}{twin}, errors {len(l['log']['errors'])} {l['log']['errors'][:2]}")
            if twin_seen:
                events = logs[0]["raid"].get("events", [])
                if plan:
                    print(f"twin: stages {plan.notes}")
                print(f"twin: screens apart by at most {spread * 100:.2f} % of a bar; samples with a bot across the standing wall: {crossed}; "
                      f"screen 0 saw {[(e['t'], e['furious'], e['dead'], e['over']) for e in events]}")
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
    ap.add_argument("--boss", default="sun", choices=["sun", "ash", "heart"])
    ap.add_argument("--boost", type=int, default=0)
    ap.add_argument("--twin", action="store_true")
    ap.add_argument("--phone", action="store_true")
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--height", type=int, default=600)
    a = ap.parse_args()
    asyncio.run(run(a))
