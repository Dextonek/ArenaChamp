"""
The heroes' fight prints (docs/pipeline/hero-framework.md, "The fight prints"): one fixed scripted duel per hero, whose
print must stay the same while heroes are moved into the hero framework.

    python pipeline/tools/hero-prints.py take                 # all 40, each twice: the reference (about 25 min)
    python pipeline/tools/hero-prints.py take Anka,Kaia       # only these (added to the reference file)
    python pipeline/tools/hero-prints.py check                # every hero once more, against the reference
    python pipeline/tools/hero-prints.py check Anka           # one hero (about a minute)
    python pipeline/tools/hero-prints.py show                 # the reference as a table

The duel: the hero (the autopilot at its keys) against FOE on ARENA (FOE itself against FOE_SELF), both at the CPU's balance level, the arena's hazards and
shifts on, the dice seeded (7) and the clock the performance tool's own (pipeline/tools/perf-page.js, scene `hero`), FRAMES
frames of a 60th of a second; a round that ends begins again. Every half second the print notes both heroes' health (to a
tenth), places (to a hundredth of a metre), the four cooldowns of each (so every cast shows), the units alive on each side
and whether the round has ended. Its hash is the fight's fingerprint: the same code gives the same hash every run.

`take` runs each hero `--runs` times (default 2) and says whether the runs agree; it writes docs/perf/data/hero-prints.json
(heroes taken again replace their old entry). `check` runs each hero once and compares it with that file: SAME, or
ANOTHER FIGHT with the first moment the two part and what differs there. It exits with 1 if any hero differs.

It starts its own dev server on --port (5191; pipeline/tools/hero-prints.vite.config.ts, no hot reload) and stops it at
the end; one already answering there is used and left alone. While it runs, do not edit src/: a page that loads the
edited code plays another fight. Needs `pip install playwright` and Chrome or Edge (as pipeline/tools/perf.py).
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
DATA = ROOT / "docs" / "perf" / "data" / "hero-prints.json"
FOE = "Isolde"
# The foe's own print: the duel never puts a hero against itself, so Isolde fights this one.
FOE_SELF = "Brannoc"
ARENA = "harbour"
FRAMES = 3600
SEED = 7
BROWSER_ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]
FIELDS = ["hero hp", "foe hp", "hero x", "hero z", "foe x", "foe z", "hero cooldowns", "foe cooldowns", "hero units", "foe units", "round over"]


def default_browser():
    chrome = [Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
              Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
              Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe"]
    return "chrome" if any(p.exists() for p in chrome) or sys.platform != "win32" else "msedge"


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/game.html", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def dev_server(port):
    """This checkout's no-hot-reload dev server on `port`: one that answers is used, else one is started (returned, to stop)."""
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


def git_head():
    try:
        head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(ROOT), capture_output=True, text=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", "src"], cwd=str(ROOT), capture_output=True, text=True).stdout.strip()
        return head + (" + changes in src/" if dirty else "")
    except Exception:
        return ""


async def one(pw, args, script, hero):
    """One fresh browser, one duel; returns the run's print, its hash and its errors (or a crash)."""
    browser = await pw.chromium.launch(channel=args.browser, headless=not args.headed, args=BROWSER_ARGS, timeout=60000)
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await page.goto(f"http://localhost:{args.port}/game.html", wait_until="load", timeout=120000)
        await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
        await page.evaluate(script)
        opts = {"scene": "hero", "hero": hero, "foe": foe_of(args, hero), "arena": args.arena, "frames": args.frames, "seed": SEED, "sync": False}
        t0 = time.time()
        res = await asyncio.wait_for(page.evaluate("(o) => _perf.run(o)", opts), timeout=args.timeout)
        if res.get("crashed"):
            return {"crashed": res["crashed"], "errors": res.get("errors", [])}
        return {"hash": res["printHash"], "print": res["print"], "errors": res.get("errors", []), "seconds": round(time.time() - t0, 1)}
    except Exception as e:  # a page that hangs or dies is a result too
        return {"crashed": f"{type(e).__name__}: {str(e)[:300]}"}
    finally:
        await browser.close()


async def run_all(args, jobs):
    """Runs (hero, k) jobs, `args.jobs` browsers at a time; returns {hero: [result, ...]} in run order."""
    script = (ROOT / "pipeline" / "tools" / "perf-page.js").read_text(encoding="utf-8")
    out = {}
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        sem = asyncio.Semaphore(args.jobs)

        async def go(hero, k):
            async with sem:
                r = await one(pw, args, script, hero)
                tag = r.get("hash") or "CRASHED " + r.get("crashed", "")[:120]
                print(f"  {hero:18} run {k + 1}: {tag}" + (f"  ({r['seconds']} s)" if "seconds" in r else ""), flush=True)
                return hero, k, r

        for hero, k, r in sorted(await asyncio.gather(*(go(h, k) for h, k in jobs)), key=lambda x: x[1]):
            out.setdefault(hero, []).append(r)
    return out


def foe_of(args, hero):
    return FOE_SELF if hero == args.foe else args.foe


def first_part(a, b):
    """The first half second where two prints differ, and which fields differ there."""
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            diff = [f"{FIELDS[j] if j < len(FIELDS) else j}: {x[j]} -> {y[j]}" for j in range(min(len(x), len(y))) if x[j] != y[j]]
            return f"they part at {(i + 1) / 2:.1f} s: " + "; ".join(diff)
    if len(a) != len(b):
        return f"one print is longer ({len(a)} against {len(b)} samples)"
    return "same samples, different hash"


def heroes_of(args):
    if args.heroes:
        return [h.strip() for h in args.heroes.split(",") if h.strip()]
    return None  # every hero in the game, in the game's order (src/heroes.ts HERO_KITS), as the page lists them


async def roster(args):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=args.browser, headless=True, args=BROWSER_ARGS, timeout=60000)
        try:
            page = await browser.new_page()
            await page.goto(f"http://localhost:{args.port}/game.html", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
            return await page.evaluate("game.api.kits.map((k) => k.name)")
        finally:
            await browser.close()


def load():
    if DATA.exists():
        return json.loads(DATA.read_text(encoding="utf-8"))
    return {"heroes": {}}


def show(data):
    print(f"foe {data.get('foe')}, arena {data.get('arena')}, {data.get('frames')} frames, seed {data.get('seed')}; taken {data.get('when')} on {data.get('commit')}")
    for name, h in data["heroes"].items():
        runs = ", ".join(h["runs"])
        print(f"  {name:18} {h['hash'] or '-':9} {'repeats' if h['repeats'] else 'DOES NOT REPEAT'}  ({runs})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["take", "check", "show"])
    ap.add_argument("heroes", nargs="?", default="", help="names, comma separated (default: every hero)")
    ap.add_argument("--runs", type=int, default=2, help="take: runs per hero")
    ap.add_argument("--jobs", type=int, default=4, help="browsers at once")
    ap.add_argument("--port", type=int, default=5191)
    ap.add_argument("--timeout", type=float, default=300, help="seconds one duel may take")
    ap.add_argument("--browser", default=default_browser())
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--foe", default=FOE)
    ap.add_argument("--arena", default=ARENA)
    ap.add_argument("--frames", type=int, default=FRAMES)
    args = ap.parse_args()
    data = load()
    if args.cmd == "show":
        show(data)
        return
    proc = dev_server(args.port)
    try:
        names = heroes_of(args) or asyncio.run(roster(args))
        if args.cmd == "take":
            t0 = time.time()
            results = asyncio.run(run_all(args, [(h, k) for k in range(args.runs) for h in names]))
            if (data.get("foe"), data.get("arena"), data.get("frames")) != (args.foe, args.arena, args.frames):
                data = {"heroes": {}}
            data.update({"foe": args.foe, "arena": args.arena, "frames": args.frames, "seed": SEED, "fields": FIELDS,
                         "every": "half a second", "when": time.strftime("%Y-%m-%d %H:%M"), "commit": git_head()})
            bad = []
            for name in names:
                rs = results.get(name, [])
                hashes = [r.get("hash") or "crashed" for r in rs]
                ok = bool(rs) and all(r.get("hash") for r in rs) and len(set(hashes)) == 1
                entry = {"foe": foe_of(args, name), "hash": hashes[0] if ok else None, "repeats": ok, "runs": hashes,
                         "print": rs[0].get("print") if rs and rs[0].get("hash") else None,
                         "errors": sorted({e for r in rs for e in r.get("errors", [])})[:5]}
                if not ok:
                    bad.append(name)
                    entry["prints"] = [r.get("print") for r in rs]
                    if len(rs) > 1 and rs[0].get("print") and rs[1].get("print"):
                        entry["parts"] = first_part(rs[0]["print"], rs[1]["print"])
                    entry["crashes"] = [r["crashed"] for r in rs if r.get("crashed")]
                data["heroes"][name] = entry
            DATA.write_text(json.dumps(data, indent=None, separators=(",", ":")), encoding="utf-8")
            print(f"\n{len(names) - len(bad)} of {len(names)} heroes repeat ({round(time.time() - t0)} s). Written: {DATA.relative_to(ROOT)}")
            for name in bad:
                print(f"  DOES NOT REPEAT: {name}: {data['heroes'][name].get('parts') or data['heroes'][name].get('crashes')}")
        else:
            if (data.get("foe"), data.get("arena"), data.get("frames")) != (args.foe, args.arena, args.frames):
                sys.exit("the reference was taken with another foe, arena or length: take it again first")
            results = asyncio.run(run_all(args, [(h, 0) for h in names]))
            bad = 0
            for name in names:
                ref = data["heroes"].get(name)
                r = results[name][0]
                if not ref or not ref.get("hash"):
                    print(f"  {name:18} no reference print"); bad += 1
                elif r.get("hash") == ref["hash"]:
                    print(f"  {name:18} SAME ({r['hash']})")
                else:
                    bad += 1
                    why = first_part(ref["print"], r["print"]) if r.get("print") else r.get("crashed")
                    print(f"  {name:18} ANOTHER FIGHT ({ref['hash']} -> {r.get('hash')}): {why}")
            print(f"\n{len(names) - bad} of {len(names)} the same.")
            if bad:
                sys.exit(1)
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    main()
