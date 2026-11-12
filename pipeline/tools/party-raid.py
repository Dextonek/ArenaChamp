"""
A raid for a party, played by bots through the real hub: N headless pages of the game, each its own throwaway account,
one public raid room, the host starts, every screen's autopilot plays. To find what only breaks with many screens.

    python pipeline/tools/party-raid.py <out folder> [--players 6] [--seconds 150] [--port 5196] [--boss sun]
                                        [--boost 0] [--twin] [--phone] [--hall] [--burst]

--boss   the boss the run starts at (sun, ash, heart): the lobby's `raid`. A party at `ash` fights Twin Flames.
--boost  every bot also takes this much HP a second off the boss it fights, through the hub (under its caps), so a fight
         ends in the time given: six bots at the HP for ten are slow.
--twin   Twin Flames' own test (with --boss ash): the boost is steered so that the west half gets far ahead (Ember grows
         furious), the east catches up (she calms), both fall low together, Ash falls first (the wall goes out) and then
         Ember. Pictures at each of those moments; a check that all screens agree on both HP bars and that every bot
         stayed in its own half while the wall stood.
--phone  the last player's screen is a phone held upright (390 x 844).
--hall   the Sun Warden's hall (with --boss sun and three or more players): every second each screen says whether its hall
         has broken open, how far its sunfire has come, and how much cover stands. Prints when the hall broke on each screen
         (the fight's own clock), whether the screens agree on cover each second, and which of his moves each screen saw;
         pictures as the hall breaks and of the sunfire. With more than ten players the boost stops when High Noon begins,
         so Carry the Sun is played unhelped (sixteen players are a fight tuned for twenty).

--burst  the Heart's room (with --boss heart and three or more players): every second each screen says how far its two rings
         have turned and when its floor's cast began (by this computer's clock), where its own hero stands and where it
         sees the others, which sectors have fallen and when. Prints how far apart the screens' floors are (as time, and as
         metres on the outer ring), how far a hero stands on the others' screens from where its own has it, when each sector
         fell on each screen, and which of its moves each screen saw; pictures as the floor turns and as the crust falls.
         The boost stops when The Rings Turn begins, so the turning floor and the falling crust are played unhelped.

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


HALL_JS = """async () => {
  const H = await import('/src/arenas/sunhall.ts'), W = await import('/src/raid/wardenHall.ts'), d = window.game.api.duel;
  if (!d.boss) return null;
  // The moment the hall broke on this screen, by the computer's clock (every screen is on this computer), looked for 50 times a second.
  window._hallWatch ??= setInterval(() => { if (H.hallBreak.open && !window._hallOpenAt) window._hallOpenAt = Date.now(); }, 20);
  window._hallSeen ??= {};
  for (const x of d.boss.script.active) window._hallSeen[x.cast.move] = (window._hallSeen[x.cast.move] ?? new Set()).add(x.cast.id);
  return { t: +d.time.toFixed(1), open: H.hallBreak.open, at: window._hallOpenAt ?? 0, fire: +W.hallFight.fire.toFixed(1), cover: window.game.api.arena.obstacles?.length ?? 0,
    phase: d.boss.stats.phases, seen: Object.fromEntries(Object.entries(window._hallSeen).map(([k, v]) => [k, v.size])) };
}"""


BURST_JS = """async () => {
  const A = await import('/src/arenas/sunburst.ts'), F = await import('/src/raid/heart.ts'), d = window.game.api.duel;
  if (!d.boss) return null;
  const hf = F.heartFight, bf = A.burstFloor;
  // When each sector fell on this screen, by the computer's clock (every screen is on this computer), looked for 50 times a second.
  window._burstFell ??= {};
  window._burstWatch ??= setInterval(() => { for (let k = 0; k < 8; k++) if (bf.gone(k) && !window._burstFell[k]) window._burstFell[k] = Date.now(); }, 20);
  window._burstSeen ??= {};
  for (const x of d.boss.script.active) window._burstSeen[x.cast.move] = (window._burstSeen[x.cast.move] ?? new Set()).add(x.cast.id);
  const me = window.game.api.arena.caster.group.position, now = Date.now();
  return { t: +d.time.toFixed(1), now, phase: d.boss.stats.phases, turning: hf.turning, began: hf.turning ? now - hf.clock * 1000 : 0, sense: hf.sense,
    mid: bf.mid, out: bf.out, rests: hf.clock >= hf.restAt, crust: hf.crust, fell: { ...window._burstFell }, fallen: bf.fallen,
    side: d.boss.link.side, me: [me.x, me.z], down: d.playerHp <= 0, ring: A.ringOf(me.x, me.z), over: bf.lost(me.x, me.z),
    party: [...d.party].map(([side, p]) => [side, p.pos.x, p.pos.z]), cover: window.game.api.arena.obstacles?.length ?? 0,
    seen: Object.fromEntries(Object.entries(window._burstSeen).map(([k, v]) => [k, v.size])) };
}"""


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
            # The Warden's hall: when each screen's broke open (the fight's clock), seconds on which the screens' cover differed.
            broke, fire_most, hall_last, cover_apart, hall_shots = {}, {}, [], [], set()
            boost_off = False
            # The Heart's room: each second's reports, how far apart the floors' clocks were, how far a hero stood from where the others saw it.
            burst_last, clock_apart, seen_apart, burst_shots, rode, over_sun = [], [], {"still": [], "turning": []}, set(), 0, 0
            while time.time() - t0 < args.seconds:
                await asyncio.sleep(1 if args.boss == "ash" or args.hall or args.burst else 5)
                t = time.time() - t0
                now = [await pg.evaluate("() => _botRaid()") for pg in pages]
                if args.hall:
                    # More than ten players (Carry the Sun, The Four Hours): the boost only brings High Noon on, then the bots play unhelped.
                    if args.boost and args.players > 10 and not boost_off and all(s.get("phase", 0) >= 1 for s in now):
                        boost_off = True
                        for pg in pages:
                            await pg.evaluate("() => { window._botBoost = 0; }")
                        print(f"      boost off at {t:.0f} s: High Noon has begun")
                    hall = [await pg.evaluate(HALL_JS) for pg in pages]
                    if all(hall):
                        hall_last = hall
                        for i, h in enumerate(hall):
                            if h["at"] and i not in broke:
                                broke[i] = h["at"]
                            fire_most[i] = max(fire_most.get(i, 0), h["fire"])
                        if len({h["cover"] for h in hall}) > 1:
                            cover_apart.append((round(t), [h["cover"] for h in hall]))
                        if any("carry" in h["seen"] for h in hall) and "hall-carry" not in hall_shots:
                            hall_shots.add("hall-carry")
                            await asyncio.sleep(9)
                            await shot(pages[0], out / "hall-carry.png")
                            await shot(pages[-1], out / "hall-carry-last.png")
                        for name, when in (("hall-breaking", any("breach" in h["seen"] for h in hall) and not any(h["open"] for h in hall)),
                                           ("hall-open", all(h["open"] for h in hall)), ("hall-sunfire", min(h["fire"] for h in hall) > 9)):
                            if when and name not in hall_shots:
                                hall_shots.add(name)
                                await shot(pages[0], out / f"{name}.png")
                                await shot(pages[-1], out / f"{name}-last.png")
                if args.burst:
                    if args.boost and not boost_off and all(s.get("phase", 0) >= 1 for s in now):
                        boost_off = True
                        for pg in pages:
                            await pg.evaluate("() => { window._botBoost = 0; }")
                        print(f"      boost off at {t:.0f} s: The Rings Turn has begun")
                    burst = [await pg.evaluate(BURST_JS) for pg in pages]
                    if all(burst):
                        burst_last = burst
                        moving = all(b["turning"] for b in burst) and not all(b["rests"] for b in burst)
                        if all(b["turning"] for b in burst):
                            began = [b["began"] for b in burst]
                            clock_apart.append(max(began) - min(began))
                        # Each hero where its own screen has it, against where every other screen draws it, at the same moment.
                        own = {b["side"]: b["me"] for b in burst if not b["down"]}
                        for b in burst:
                            for side, x, z in b["party"]:
                                if side in own:
                                    seen_apart["turning" if moving else "still"].append(((x - own[side][0]) ** 2 + (z - own[side][1]) ** 2) ** 0.5)
                        rode += sum(1 for b in burst if moving and b["ring"] and not b["down"])
                        over_sun += sum(1 for b in burst if b["over"] and not b["down"])
                        for name, when in (("heart-party-turning", moving and max(abs(b["mid"]) for b in burst) > 0.8),
                                           ("heart-party-crust", all(b["crust"] for b in burst) and any(b["fallen"] for b in burst))):
                            if when and name not in burst_shots:
                                burst_shots.add(name)
                                await shot(pages[0], out / f"{name}.png")
                                await shot(pages[-1], out / f"{name}-last.png")
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
            if args.hall and hall_last:
                apart = f"{max(broke.values()) - min(broke.values())} ms apart" if len(broke) == len(pages) else f"only on {len(broke)} of {len(pages)} screens"
                print(f"hall: broke open on every screen within {apart}; the sunfire came as far as {[fire_most.get(i, 0) for i in range(len(pages))]} m; "
                      f"cover at the end {[h['cover'] for h in hall_last]}; seconds with cover apart: {len(cover_apart)} {cover_apart[:6]}")
                print(f"hall: kneels {[s.get('kneels') for s in now]}; hits by Carry the Sun's Noon {[s.get('hits', {}).get('carry', 0) for s in now]}; down {[bool(s.get('down')) for s in now]}")
                for i, h in enumerate(hall_last):
                    print(f"hall: screen {i} saw {h['seen']}")
            if args.burst and burst_last:
                med = lambda v: sorted(v)[len(v) // 2] if v else 0
                print(f"burst: the floor turned on {sum(1 for b in burst_last if b['turning'])} of {len(pages)} screens, the same way on all: {len({b['sense'] for b in burst_last}) == 1}; "
                      f"their floors' clocks apart by {med(clock_apart)} ms (median), {max(clock_apart, default=0)} ms at most: "
                      f"{max(clock_apart, default=0) / 1000 * 6 * 3.14159 / 180 * 15:.2f} m on the outer ring")
                print(f"burst: rings at the end, by screen: middle {[round(b['mid'], 3) for b in burst_last]}, outer {[round(b['out'], 3) for b in burst_last]}, at rest {[b['rests'] for b in burst_last]}")
                for key in ("still", "turning"):
                    v = seen_apart[key]
                    print(f"burst: a hero on another screen against its own, floor {key}: median {med(v):.2f} m, nine in ten under {sorted(v)[int(len(v) * 0.9)] if v else 0:.2f} m, most {max(v, default=0):.2f} m ({len(v)} looks)")
                fell = sorted({k for b in burst_last for k in b["fell"]})
                for k in fell:
                    when = [b["fell"].get(k, 0) for b in burst_last]
                    print(f"burst: sector {k} fell on {sum(1 for w in when if w)} of {len(pages)} screens, {max(when) - min(w for w in when if w)} ms apart")
                print(f"burst: seconds a hero rode a turning ring {rode}; seconds a hero stood over the sun {over_sun}; cover at the end {[b['cover'] for b in burst_last]}")
                for i, b in enumerate(burst_last):
                    print(f"burst: screen {i} saw {b['seen']}")
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
    ap.add_argument("--hall", action="store_true")
    ap.add_argument("--burst", action="store_true")
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--height", type=int, default=600)
    a = ap.parse_args()
    asyncio.run(run(a))
