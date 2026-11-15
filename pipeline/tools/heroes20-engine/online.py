"""Two screens online for the engine pieces (pipeline/designs/heroes20-engine.md): two bots (pipeline/tools/online-bot.js) in two
headless game pages on one dev server, a test layer on both (online-case.js) that uses every engine message, and each screen's
view of the pieces read ten times a second and laid over the other's by the wall clock.

    python pipeline/tools/heroes20-engine/online.py mech       Lyra and Isolde with the test layer; Isolde keeps 7 m away and sidesteps
    python pipeline/tools/heroes20-engine/online.py crystal    Opaline and Brannoc as they are: does Opaline's crystal (a placed
                                                               thing with HP) stand and break alike on both screens?
    python pipeline/tools/heroes20-engine/online.py placed     the same with the crystal registered as a placed thing (src/mech
                                                               `placed`), and hit on Brannoc's screen alone every 1.5 s (as a
                                                               basic attack on a unit is): Opaline's screen must follow

It starts the dev server on 5262 (the game page with its WebSocket hub, the hero shop off) and stops it; it refuses to run when
something already answers there. Ends by itself within 9 minutes. The bots' throwaway accounts are written to server/data/
(git-ignored): delete them afterwards. Output: pipeline/sim/out/heroes20-engine/online-<case>.json.
"""
import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
OUT = ROOT / "pipeline" / "sim" / "out" / "heroes20-engine"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 5262
ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows"]
STRAFE = r"""(() => { const a = game.api.arena, walk = a.walk.bind(a); window._walk = walk;
  const dist = () => { const f = game.api.duel.foe; if (!f) return 99; const m = a.caster.group.position, p = f.group.position; return Math.hypot(m.x - p.x, m.z - p.z); };
  a.walk = (v, ...r) => (dist() < 7 ? undefined : walk(v, ...r));
  let side = 1, t0 = performance.now();
  setInterval(() => { const d = game.api.duel, f = d.foe; if (!d.on || d.over || !f || d.waiting || d.countdown > 0 || game.api.heroMode.locked) return;
    if (performance.now() - t0 > 700) { side = -side; t0 = performance.now(); }
    const m = a.caster.group.position, p = f.group.position, dx = p.x - m.x, dz = p.z - m.z, L = Math.hypot(dx, dz) || 1;
    window._walk(new p.constructor((-dz / L) * 0.4 * side, 0, (dx / L) * 0.4 * side), Infinity, true); }, 100); })()"""
HIT_UNITS = r"""(() => { const a = game.api.arena, hm = game.api.heroMode, d = game.api.duel;
  setInterval(() => { if (!d.on || d.over || !d.foe || hm.locked) return; const u = a.summons.alive('opponent').find((x) => x.kind === 'turret');
    if (!u) return; const m = a.caster.group.position, dx = u.pos.x - m.x, dz = u.pos.z - m.z, L = Math.hypot(dx, dz);
    if (L > 2.2) a.walk(new m.constructor((dx / L) * 0.4, 0, (dz / L) * 0.4), Infinity, true); else if (!hm.attackWinding) hm.autoAttack(u.figure); }, 100); })()"""
PLACED = r"""(() => { const d = game.api.duel, a = game.api.arena, hm = game.api.heroMode, spawn = a.summons.spawn.bind(a.summons);
  a.summons.spawn = (world, so) => { const h = spawn(world, so); const name = world.side === 'hero' ? hm.currentKit.name : d.opponentKit.name;
    if (so.kind === 'turret' && name === 'Opaline') d.mech.placed(world.side, h); return h; }; })()"""
CHIP = r"""(() => { const d = game.api.duel, a = game.api.arena; setInterval(() => { if (!d.on || d.over || !d.foe) return;
  const u = a.summons.alive('opponent').find((x) => x.kind === 'turret'); if (u) a.hit(u.figure, { damage: 25, knock: 0 }); }, 1500); })()"""
UNITS = r"""(() => { window._units = []; const d = game.api.duel, a = game.api.arena, hm = game.api.heroMode;
  setInterval(() => { if (!game.match.active || !d.on || !d.foe || d.over) return;
    const name = (side) => (side === 'hero' ? hm.currentKit.name : d.opponentKit.name);
    const units = ['hero', 'opponent'].flatMap((s) => a.summons.alive(s).map((u) => `${name(s)}:${u.kind}:${Math.round(u.hp)}@${u.pos.x.toFixed(0)},${u.pos.z.toFixed(0)}`)).sort().join(' ');
    window._units.push({ w: Date.now(), round: d.round, t: +d.time.toFixed(2), units, n: units ? units.split(' ').length : 0 }); }, 100); })()"""


def up():
    try:
        with urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


async def open_page(pw, name, errors, case):
    browser = await pw.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = await (await browser.new_context(viewport={"width": 1280, "height": 800})).new_page()
    page.on("console", lambda m: errors.append(f"{name}: {m.text[:300]}") if m.type == "error" and "404" not in m.text else None)
    page.on("pageerror", lambda e: errors.append(f"{name}: PAGEERROR {str(e)[:300]}"))
    await page.goto(f"http://localhost:{PORT}/game", wait_until="load", timeout=120000)
    await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
    await page.add_style_tag(content="*{animation:none!important}")
    await page.evaluate("(async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); })()")
    if case == "mech":
        await page.evaluate((HERE / "online-case.js").read_text(encoding="utf-8"))
        await page.wait_for_function("Array.isArray(window._mech)", timeout=30000)
    else:
        await page.evaluate(UNITS)
    return browser, page


def pair(a, b, keys):
    """Each sample of screen a with screen b's nearest one by wall clock (within 80 ms, same round): how often each field agrees."""
    n, same, k, worst = 0, {key: 0 for key in keys}, 0, []
    for s in a:
        while k + 1 < len(b) and abs(b[k + 1]["w"] - s["w"]) <= abs(b[k]["w"] - s["w"]):
            k += 1
        o = b[k] if b else None
        if not o or abs(o["w"] - s["w"]) > 80 or o["round"] != s["round"]:
            continue
        n += 1
        for key in keys:
            if s[key] == o[key]:
                same[key] += 1
            elif len(worst) < 12:
                worst.append({"key": key, "t": s["t"], "here": s[key], "there": o[key]})
    return {"paired": n, "agree": {key: round(same[key] / n, 3) if n else None for key in keys}, "differences": worst}


def swaps(a, b):
    """Each swap as both screens saw it, paired in order within a round: how far apart the two screens put each hero 0.45 s on,
    and how far each landed from where the cast said (Lyra: where she saw Isolde; Isolde: where Lyra stood)."""
    out, rows = [], []
    for s in a:
        o = next((x for x in b if x["round"] == s["round"] and abs(x["w"] - s["w"]) < 600), None)
        if not o:
            continue
        d = lambda p, q: round(((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5, 2)
        rows.append({"lyraApart": d(s["lyra"], o["lyra"]), "isoldeApart": d(s["isolde"], o["isolde"]),
                     "lyraFromPoint": d(s["lyra"], s["point"]), "isoldeFromFrom": d(o["isolde"], o["from"])})
    if rows:
        out = {"swaps": len(rows), "maxApart": max(max(r["lyraApart"], r["isoldeApart"]) for r in rows), "rows": rows}
    return out or {"swaps": 0}


def changes(samples, key):
    out, last = [], None
    for s in samples:
        if s[key] != last:
            out.append((s["w"], s[key], s["round"]))
            last = s[key]
    return out[1:]


def lags(a, b, key):
    """For each change of `key` on screen a, how long until screen b shows the same value (ms): one screen decides, the other follows."""
    ca, cb, out = changes(a, key), changes(b, key), []
    for w, v, r in ca:
        later = [w2 for w2, v2, r2 in cb if v2 == v and r2 == r and w - 300 <= w2 <= w + 2000]
        if later:
            out.append(min(later) - w)
    out.sort()
    return {"changes": len(ca), "followed": len(out), "median_ms": out[len(out) // 2] if out else None, "max_ms": out[-1] if out else None}


async def main():
    case = sys.argv[1] if len(sys.argv) > 1 else "mech"
    heroes = ("Lyra", "Isolde") if case == "mech" else ("Opaline", "Brannoc")
    if up():
        sys.exit(f"something already answers on {PORT}: not mine, stopping")
    srv = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(PORT), "--strictPort"],
                           cwd=str(ROOT), env={**os.environ, "SHOP": "off"}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    errors, out = [], {"case": case, "heroes": heroes}
    try:
        for _ in range(120):
            if up():
                break
            time.sleep(0.5)
        async with async_playwright() as pw:
            ba, pa = await open_page(pw, heroes[0], errors, case)
            bb, pb = await open_page(pw, heroes[1], errors, case)
            if case == "mech":
                await pb.evaluate(STRAFE)
            elif case == "placed":
                await pa.evaluate(PLACED)
                await pb.evaluate(PLACED)
                await pb.evaluate(CHIP)
            else:
                # Brannoc goes for the crystal whenever one stands: a basic attack on a unit stays on the attacker's screen.
                await pb.evaluate(HIT_UNITS)
            await pa.evaluate(f"_botQueue('{heroes[0]}')")
            await pb.evaluate(f"_botQueue('{heroes[1]}')")
            end = time.time() + 400
            while time.time() < end:
                la = json.loads(await pa.evaluate("_botLog()"))
                lb = json.loads(await pb.evaluate("_botLog()"))
                if la.get("ended") or lb.get("ended") or len(la.get("rounds", [])) >= 3:
                    break
                await asyncio.sleep(1)
            await pa.screenshot(path=str(OUT / f"online-{case}-{heroes[0]}.jpg"), type="jpeg", quality=80)
            await pb.screenshot(path=str(OUT / f"online-{case}-{heroes[1]}.jpg"), type="jpeg", quality=80)
            var = "_mech" if case == "mech" else "_units"
            sa, sb = await pa.evaluate(var), await pb.evaluate(var)
            if case == "mech":
                out["messages"] = {heroes[0]: await pa.evaluate("_msgs"), heroes[1]: await pb.evaluate("_msgs")}
                out["tries"] = {heroes[0]: await pa.evaluate("_tries"), heroes[1]: await pb.evaluate("_tries")}
                sw = {heroes[0]: await pa.evaluate("_swaps"), heroes[1]: await pb.evaluate("_swaps")}
                out["swaps"] = swaps(sw[heroes[0]], sw[heroes[1]])
            out["bots"] = {heroes[0]: {k: la.get(k) for k in ("casts", "attacks", "rounds", "errors", "ended")},
                           heroes[1]: {k: lb.get(k) for k in ("casts", "attacks", "rounds", "errors", "ended")}}
            await pa.evaluate("_botStop()")
            await pb.evaluate("_botStop()")
            await ba.close()
            await bb.close()
    finally:
        srv.terminate()
        try:
            srv.wait(10)
        except Exception:
            srv.kill()
    keys = ["asleep", "sealed", "holder", "leash", "cover", "wards", "lyra", "isolde"] if case == "mech" else ["units", "n"]
    out["samples"] = {heroes[0]: len(sa), heroes[1]: len(sb)}
    out["agree"] = pair(sa, sb, keys)
    if case == "mech":
        out["lags"] = {
            "sleep (Isolde's screen decides)": lags(sb, sa, "asleep"),
            "seal (Lyra's screen decides)": lags(sa, sb, "sealed"),
            "leash (Isolde's screen decides)": lags(sb, sa, "leash"),
            "cover (Isolde's client decides)": lags(sb, sa, "cover"),
            "token, as Isolde's screen saw it": lags(sb, sa, "holder"),
            "token, as Lyra's screen saw it": lags(sa, sb, "holder"),
            "wards (both build them)": lags(sa, sb, "wards"),
        }
        msgs = out.pop("messages")
        out["messageCount"] = {k: len(v) for k, v in msgs.items()}
        out["longestName"] = max((len(m[2]) for v in msgs.values() for m in v), default=0)
        (OUT / f"online-{case}-messages.json").write_text(json.dumps(msgs), encoding="utf-8")
    out["errors"] = errors
    (OUT / f"online-{case}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    (OUT / f"online-{case}-samples.json").write_text(json.dumps({heroes[0]: sa, heroes[1]: sb}), encoding="utf-8")
    print(json.dumps(out, indent=1)[:6000])


asyncio.run(main())
