"""
Pictures of the hero shop, the raid ranks and the week's boards (pipeline/designs/hero-shop.md), taken from the real game
page against the real hub, and a check that the page logs no errors on the way.

    python pipeline/tools/shop-shots.py [out folder, default docs/shop] [--port 5206]

What it does:
1. Starts its own dev server on the port (the game's hub lives in it) and stops it by its PID; one already there is used
   and left alone.
2. Seven socket bots with throwaway accounts play through the hub, so that there is something true to show: a duel of
   over half a minute (obols, a match in the history), a raid for two through all three bosses (the rank Ash, obols, the
   week's raid board), two smaller raids (other ranks, more rows) and a floor each for the Tower's board.
3. A headless browser logs in as the first of them and takes the pictures: the Shop without an account and with one, a
   hero's page, the question before buying, the hero bought, the Play screen with a locked hero ("Try against the CPU"),
   the profile with obols and rank, the Raid screen's board, the Tower's board, a raid room with ranks beside the names;
   then the Shop and a picker on a phone held upright (390 x 844).

The bots' accounts are local (server/data/, git-ignored): delete that file after (this worktree had none before). Their
passwords are random, kept in memory and never printed. Needs `pip install playwright websockets` and Google Chrome.
"""
import argparse
import asyncio
import json
import re
import secrets
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = int(re.search(r"export const PROTOCOL = (\d+)", (ROOT / "server" / "protocol.mjs").read_text(encoding="utf-8")).group(1))
# The bosses' HP for two, and how long a boss must be fought to count (server/protocol.mjs: RAID_BOSSES, SHOP.minBossS).
MIN_BOSS_S = 20
MIN_DUEL_S = 30


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


class Bot:
    """One player over a socket, as the page's own client talks to the hub."""

    def __init__(self, ws, name, password):
        self.ws, self.name, self.password = ws, name, password
        self.box = defaultdict(asyncio.Queue)
        self.task = asyncio.create_task(self.pump())
        self.profile = None

    async def pump(self):
        try:
            async for text in self.ws:
                m = json.loads(text)
                self.box[m["t"]].put_nowait(m)
        except Exception:
            pass

    async def send(self, **m):
        await self.ws.send(json.dumps(m))

    async def next(self, t, timeout=12):
        return await asyncio.wait_for(self.box[t].get(), timeout)

    def has(self, t):
        return not self.box[t].empty()

    def forget(self, *types):
        for t in types:
            while not self.box[t].empty():
                self.box[t].get_nowait()

    async def close(self):
        await self.ws.close()
        self.task.cancel()


async def enter(port, name):
    """A new account over a socket. A name already taken (an earlier run's) gets a number."""
    import websockets
    for n in range(20):
        ws = await websockets.connect(f"ws://localhost:{port}/ws")
        bot = Bot(ws, name if n == 0 else f"{name}{n}", secrets.token_hex(8))
        await bot.send(t="register", name=bot.name, password=bot.password, v=PROTOCOL)
        done, waiting = await asyncio.wait([asyncio.create_task(bot.next("session")), asyncio.create_task(bot.next("auth_error"))], return_when=asyncio.FIRST_COMPLETED)
        for task in waiting:
            task.cancel()
        m = done.pop().result()
        if m["t"] == "session":
            bot.profile = m["profile"]
            return bot
        await bot.close()
    sys.exit(f"could not register {name}")


async def duel(x, y, hx, hy):
    """`x` beats `y` two rounds to none in a lobby duel that lasts longer than the least a duel must to pay."""
    await x.send(t="lobby_create")
    code = (await x.next("lobby"))["lobby"]["code"]
    await y.send(t="lobby_join", code=code)
    await x.send(t="lobby_pick", hero=hx)
    await x.send(t="lobby_ready", ready=True)
    await asyncio.sleep(0.2)
    await y.send(t="lobby_pick", hero=hy)
    await y.send(t="lobby_ready", ready=True)
    await x.next("match_start")
    await y.next("match_start")
    for rnd, hold in ((1, MIN_DUEL_S + 0.5), (2, 0)):
        await x.send(t="match_loaded")
        await y.send(t="match_loaded")
        await x.next("match_fight")
        await y.next("match_fight")
        await asyncio.sleep(3.2 + hold)
        await x.send(t="cast", id=rnd, slot=3, x=0, z=1, fx=0, fz=13, enemy=True)
        await y.next("peer_cast")
        for _ in range(3):
            await y.send(t="took_hit", id=rnd, damage=250)
        if rnd == 1:
            await x.next("round_start")
            await y.next("round_start")
    end = await x.next("match_end")
    await y.next("match_end")
    for b in (x, y):
        b.forget("lobby", "lobbies")
    return end


async def raid(bots, heroes, bosses):
    """A party beats this many bosses in a private raid room, each in a fight long enough to count, then leaves."""
    host = bots[0]
    for b in bots:
        b.forget("lobby", "raid_offer", "raid_gate", "raid_stage", "match_fight", "raid_won")
    await host.send(t="lobby_create", raid="sun", open=False)
    code = (await host.next("lobby"))["lobby"]["code"]
    for b in bots[1:]:
        await b.send(t="lobby_join", code=code)
    for b, hero in zip(bots, heroes):
        await b.send(t="lobby_pick", hero=hero)
    await asyncio.sleep(0.6)
    await host.send(t="raid_go")
    for b in bots:
        await b.next("raid_start")
    for _ in range(bosses):
        for b in bots:
            await b.next("raid_offer", 15)
        for b in bots:
            await b.send(t="raid_pick")
        for b in bots:
            await b.next("raid_gate")
        for b in bots:
            await b.send(t="raid_enter")
        for b in bots:
            await b.next("raid_stage")
        for b in bots:
            await b.send(t="match_loaded", maxHp=600)
        for b in bots:
            await b.next("match_fight")
        await asyncio.sleep(3.2 + MIN_BOSS_S + 0.4)
        # Every screen hits as hard as the hub lets one (1,200 a second) until the boss falls.
        for _ in range(60):
            if host.has("raid_won"):
                break
            for b in bots:
                for _ in range(2):
                    await b.send(t="boss_damage", amount=600)
            await asyncio.sleep(1.05)
        for b in bots:
            await b.next("raid_won")
    for b in bots:
        await b.send(t="match_leave")
    await asyncio.sleep(0.4)


async def seed(port):
    """The bots' evening: what the pictures then show. Returns the first bot (the page logs in as it) and the others."""
    names = ["Mira", "Tobin", "Ashka", "Dorn", "Selwyn", "Ilya", "Quill"]
    mira, tobin, ashka, dorn, selwyn, ilya, quill = [await enter(port, n) for n in names]
    week = (await mira.next("shop"))["week"]

    async def two():
        end = await duel(mira, tobin, "Kaia", "Brannoc")
        print(f"  a duel of {end['seconds']} s: {mira.name} earned {end.get('earned')} obols")
        await raid([mira, tobin], ["Kaia", "Brannoc"], 3)

    await asyncio.gather(two(), raid([ashka, dorn, selwyn], ["Nyx", "Sefu", "Auriel"], 1), raid([ilya, quill], ["Lyra", "Isolde"], 2))
    floors = [(mira, 14, "Kaia"), (tobin, 9, "Brannoc"), (ashka, 23, "Nyx"), (dorn, 6, "Sefu"), (selwyn, 17, "Auriel"), (ilya, 11, "Lyra"), (quill, 4, "Isolde")]
    for b, floor, hero in floors:
        await b.send(t="tower_report", floor=floor, hero=hero, week=week)
        await b.next("boards")
    await mira.send(t="boards")
    board = None
    while mira.has("boards") or board is None:
        board = await mira.next("boards")
    print(f"  the week's raid board: {[(r['bosses'], r['names']) for r in board['raid']]}")
    print(f"  the week's Tower board: {[(r['name'], r['floor']) for r in board['tower']]}")
    return mira, [tobin, ashka, dorn, selwyn, ilya, quill]


async def pictures(port, out, mira, others):
    from playwright.async_api import async_playwright
    logs = []

    def watch(page, who):
        page.on("console", lambda m: logs.append(f"{who}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: logs.append(f"{who}: {e}"))

    async def open_game(ctx, who):
        pg = await ctx.new_page()
        watch(pg, who)
        await pg.goto(f"http://localhost:{port}/game", wait_until="load", timeout=120000)
        await pg.wait_for_function("!!window.game && window.game.state.connected", timeout=120000)
        return pg

    async def shot(pg, name, wait=1.3):
        await asyncio.sleep(wait)
        await pg.screenshot(path=str(out / f"{name}.jpg"), type="jpeg", quality=88)
        print(f"  picture {name}.jpg")

    async def login(pg):
        # The password goes from this script's memory into the page's own message: it is never printed or stored.
        await pg.evaluate("([n, p]) => game.net.send({ t: 'login', name: n, password: p })", [mira.name, mira.password])
        await pg.wait_for_function("!!game.state.profile", timeout=20000)

    go = "(s) => game.go(s)"
    # Scrolls the screen (or the pane that scrolls inside it) so that this element is near the top.
    into = """(sel) => { const e = document.querySelector(sel); if (!e) return false;
      let p = e.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
      if (p) p.scrollTop += e.getBoundingClientRect().top - p.getBoundingClientRect().top - 12; return true; }"""

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        desk = await browser.new_context(viewport={"width": 1280, "height": 800})
        pg = await open_game(desk, "desktop")

        # Without an account: the Shop is open to look at.
        await pg.evaluate(go, "shop")
        await shot(pg, "shop-guest")

        await login(pg)
        await pg.evaluate(go, "shop")
        await shot(pg, "shop")
        await pg.evaluate(into, ".shop-grid-head")
        await shot(pg, "shop-heroes", 0.6)

        # A hero's page: the cheapest hero that is locked for this account.
        hero = await pg.evaluate("""async () => { const p = await import('/server/protocol.mjs'), s = game.state;
          return Object.keys(p.HERO_SHOP).filter((h) => !s.profile.owned.includes(h) && !s.shop.free.includes(h)).sort((a, b) => p.heroPrice(a) - p.heroPrice(b))[0]; }""")
        await pg.evaluate("(h) => [...document.querySelectorAll('.shop-card')].find((c) => c.querySelector('.shop-name').textContent === h).click()", hero)
        await shot(pg, "shop-hero", 2.5)
        before = await pg.evaluate("() => game.state.profile.obols")
        await pg.click(".shop-page .btn.primary.big")
        await shot(pg, "shop-ask", 0.5)
        await pg.click(".shop-ask .btn.primary")
        await pg.wait_for_function("(h) => game.state.profile.owned.includes(h)", arg=hero, timeout=10000)
        after = await pg.evaluate("() => game.state.profile.obols")
        print(f"  bought {hero}: {before} obols before, {after} after")
        await shot(pg, "shop-bought", 0.6)

        # The Play screen, online: a locked hero can be looked at and tried against the CPU, not taken online.
        await pg.evaluate(go, "menu")
        await pg.evaluate("() => { const t = document.querySelector('.modes .mode'); if (!t.classList.contains('on')) t.click(); }")
        await pg.evaluate("() => document.querySelector('.pick.locked').click()")
        await shot(pg, "play-locked", 2.5)
        await pg.click(".hs-bar .hs-find")
        await shot(pg, "play-try", 1.5)

        await pg.evaluate(go, "profile")
        await shot(pg, "profile")

        # The Raid screen: the rank, and this week's best runs.
        await pg.evaluate(go, "raid")
        await pg.evaluate("() => [...document.querySelectorAll('.pick')].find((b) => b.textContent.startsWith('Kaia')).click()")
        await asyncio.sleep(0.5)
        await pg.evaluate(into, ".rank-line")
        await shot(pg, "raid-board", 2.0)

        # The Tower's board. First the page's own report, at the end of a real climb: Start is pressed, the climb begins,
        # the browser's best floor of the week is raised to 16 while it is on (the Tower keeps it in localStorage, and a
        # climb that clears a floor writes it there), and the climb is left. The page must then send the floor with the
        # climb's hero, and the board must answer with the row.
        await pg.evaluate(go, "tower")
        await asyncio.sleep(0.6)
        await pg.click(".hs-bar .hs-find")
        await pg.wait_for_function("game.tower.active", timeout=60000)
        await asyncio.sleep(2.0)
        await pg.evaluate("""async () => { const w = (await import('/src/tower/week.ts')).isoWeek().id;
          localStorage.setItem('tower.best', JSON.stringify({ [w]: 16 })); game.tower.exit(); }""")
        await pg.wait_for_function("(n) => (game.state.boards?.tower ?? []).some((r) => r.name === n && r.floor === 16 && r.hero === 'Kaia')", arg=mira.name, timeout=15000)
        print("  a climb ended on floor 16: the page sent it, and the week's Tower board has the row")
        await pg.wait_for_function("!game.tower.active && game.state.screen === 'tower'", timeout=15000)
        await asyncio.sleep(0.5)
        await pg.evaluate(into, ".board")
        await shot(pg, "tower-board", 2.0)
        await pg.evaluate("() => { localStorage.removeItem('tower.best'); localStorage.removeItem('tower.hero'); }")

        # A raid room: the ranks beside the names; a locked hero is refused there with a word.
        await pg.evaluate(go, "raid")
        await pg.evaluate("() => game.net.send({ t: 'lobby_create', raid: 'sun', open: true })")
        await pg.wait_for_function("!!game.state.lobby", timeout=10000)
        code = await pg.evaluate("() => game.state.lobby.code")
        for b, hero_of in zip(others[:4], ["Brannoc", "Nyx", "Sefu", "Auriel"]):
            b.forget("lobby")
            await b.send(t="lobby_join", code=code)
            await b.send(t="lobby_pick", hero=hero_of)
        await asyncio.sleep(0.8)
        await pg.evaluate("() => document.querySelector('.pick.locked').click()")
        await shot(pg, "raid-room", 0.8)
        await pg.evaluate("() => game.net.send({ t: 'lobby_leave' })")
        for b in others[:4]:
            await b.send(t="lobby_leave")
        await desk.close()

        # A phone held upright: the Shop, a hero's page, and the picker with its locks.
        phone = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        ph = await open_game(phone, "phone")
        await login(ph)
        await ph.evaluate(go, "shop")
        await shot(ph, "phone-shop")
        await ph.evaluate(into, ".shop-grid-head")
        await shot(ph, "phone-shop-heroes", 0.6)
        await ph.evaluate("() => document.querySelector('.shop-card.locked').click()")
        await shot(ph, "phone-shop-hero", 2.5)
        await ph.evaluate(go, "menu")
        await ph.evaluate("() => { const t = document.querySelector('.modes .mode'); if (!t.classList.contains('on')) t.click(); }")
        await ph.evaluate("() => document.querySelector('.pick.locked').click()")
        await shot(ph, "phone-play-locked", 2.5)
        await ph.evaluate(into, ".hs-roster-head")
        await shot(ph, "phone-picker", 0.6)
        await phone.close()
        await browser.close()
    return logs


async def run(args):
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(args.port), "--strictPort"],
                                cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if up(args.port):
                break
            time.sleep(0.5)
        else:
            proc.terminate()
            sys.exit("the dev server did not answer within 60 s")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        print("the bots play (about two and a half minutes)")
        mira, others = await seed(args.port)
        print("the pictures")
        logs = await pictures(args.port, out, mira, others)
        for b in [mira, *others]:
            await b.close()
    finally:
        if proc:
            proc.terminate()
    print(f"{len(logs)} errors in the page's console")
    for line in logs[:12]:
        print("  " + line[:300])
    print("the bots' accounts are in server/data/accounts.json: delete them")


def main():
    ap = argparse.ArgumentParser(description="Pictures of the hero shop, the raid ranks and the week's boards.")
    ap.add_argument("out", nargs="?", default=str(ROOT / "docs" / "shop"))
    ap.add_argument("--port", type=int, default=5206)
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
