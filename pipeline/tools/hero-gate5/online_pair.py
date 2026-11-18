"""Two screens online, any two heroes: two bots (pipeline/tools/online-bot.js) through this repo's own dev server
(srv.py: GATE5_PORT, shop off), each the autopilot at its hero's keys. Ten times a second each screen notes both heroes'
HP and places; the two records are laid over each other by the wall clock, and the result says how often the two screens
agree. Written for the hero framework's moves (docs/pipeline/hero-framework.md): the screens must agree as before.

    python pipeline/tools/hero-gate5/online_pair.py Sefu Cantor [seconds]

The bots' accounts are throwaway ones in server/data/ (git-ignored): delete them afterwards. Output: pipeline/sim/out/gate5/.
"""
import asyncio
import json
import sys
import time

from playwright.async_api import async_playwright

from srv import ARGS, OUT, PORT, Server

SAMPLER = r"""
(() => {
  window._samp = [];
  setInterval(() => {
    const { api, match } = window.game; const d = api.duel, a = api.arena;
    if (!match.active || !d.on || !d.foe) return;
    const me = a.caster.group.position, foe = d.foe.group.position;
    window._samp.push({ w: Date.now(), round: d.round, t: +d.time.toFixed(2), over: d.isOver ? 1 : 0,
      myHp: Math.round(d.playerHp), foeHp: Math.round(a.hpOf(d.foe)),
      me: [+me.x.toFixed(2), +me.z.toFixed(2)], foe: [+foe.x.toFixed(2), +foe.z.toFixed(2)] });
  }, 100);
})();
"""


async def open_page(pw, name, errors):
    browser = await pw.chromium.launch(channel="chrome", headless=True, args=ARGS)
    ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
    page = await ctx.new_page()
    page.on("console", lambda m: errors.append(f"{name}: {m.text[:300]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{name}: PAGEERROR {str(e)[:300]}"))
    await page.goto(f"http://localhost:{PORT}/game", wait_until="load", timeout=120000)
    await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
    await page.add_style_tag(content="*{animation:none!important}")
    await page.evaluate("(async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); })()")
    await page.evaluate(SAMPLER)
    return browser, page


def compare(a, b):
    """A's screen against B's: B's own hero is A's foe. Paired by wall clock (nearest within 80 ms), same round, not over."""
    n = 0
    same_a = same_b = 0
    far_a, far_b = [], []
    k = 0
    for s in a:
        if s["over"]:
            continue
        while k + 1 < len(b) and abs(b[k + 1]["w"] - s["w"]) <= abs(b[k]["w"] - s["w"]):
            k += 1
        o = b[k] if b else None
        if not o or abs(o["w"] - s["w"]) > 80 or o["round"] != s["round"] or o["over"]:
            continue
        n += 1
        same_a += abs(s["myHp"] - o["foeHp"]) <= 0
        same_b += abs(s["foeHp"] - o["myHp"]) <= 0
        far_a.append(((s["me"][0] - o["foe"][0]) ** 2 + (s["me"][1] - o["foe"][1]) ** 2) ** 0.5)
        far_b.append(((s["foe"][0] - o["me"][0]) ** 2 + (s["foe"][1] - o["me"][1]) ** 2) ** 0.5)
    far_a.sort()
    far_b.sort()
    q = lambda v, x: round(v[min(len(v) - 1, int(len(v) * x))], 2) if v else None
    return {"paired": n, "hpSameA": round(same_a / n, 3) if n else None, "hpSameB": round(same_b / n, 3) if n else None,
            "placeApartA": {"median": q(far_a, 0.5), "p90": q(far_a, 0.9), "max": q(far_a, 1)},
            "placeApartB": {"median": q(far_b, 0.5), "p90": q(far_b, 0.9), "max": q(far_b, 1)}}


async def main():
    hero_a, hero_b = sys.argv[1], sys.argv[2]
    limit = float(sys.argv[3]) if len(sys.argv) > 3 else 300
    errors = []
    with Server():
        async with async_playwright() as pw:
            ba, pa = await open_page(pw, hero_a, errors)
            bb, pb = await open_page(pw, hero_b, errors)
            await pa.evaluate(f"_botQueue({json.dumps(hero_a)})")
            await pb.evaluate(f"_botQueue({json.dumps(hero_b)})")
            end = time.time() + limit
            ended = False
            while time.time() < end:
                la = json.loads(await pa.evaluate("_botLog()"))
                lb = json.loads(await pb.evaluate("_botLog()"))
                if la.get("ended") or lb.get("ended"):
                    ended = True
                    break
                await asyncio.sleep(1)
            la = json.loads(await pa.evaluate("_botLog()"))
            lb = json.loads(await pb.evaluate("_botLog()"))
            sa = await pa.evaluate("_samp")
            sb = await pb.evaluate("_samp")
            await pa.screenshot(path=str(OUT / f"pair-{hero_a}-{hero_b}-a.jpg"), type="jpeg", quality=70)
            await pb.screenshot(path=str(OUT / f"pair-{hero_a}-{hero_b}-b.jpg"), type="jpeg", quality=70)
            await pa.evaluate("_botStop()")
            await pb.evaluate("_botStop()")
            await ba.close()
            await bb.close()
    keys = ("hero", "foe", "casts", "attacks", "rounds", "errors", "ended")
    out = {"ended": ended, "errors": errors, "a": {k: la.get(k) for k in keys}, "b": {k: lb.get(k) for k in keys},
           "samples": [len(sa), len(sb)], "agree": compare(sa, sb)}
    (OUT / f"pair-{hero_a}-{hero_b}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(json.dumps(out, indent=1)[:4000])


asyncio.run(main())
