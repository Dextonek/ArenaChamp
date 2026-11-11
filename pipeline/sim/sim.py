"""
The fight simulator: plays CPU duels with the game's own code in many hidden browsers at once and writes the results as
a page. Nothing is re-implemented: each browser loads the tool page and steps real duels (pipeline/sim/page.js), so a new
hero, a changed number or a new arena is in the next run without touching this file.

    python pipeline/sim/sim.py hero Anka                 one hero against the six benchmark foes, 16 fights each
    python pipeline/sim/sim.py hero Anka Lyra --fights 32 --sides both
    python pipeline/sim/sim.py duel Anka Brannoc --fights 40   one pairing, both ways round
    python pipeline/sim/sim.py all --reps 2              every hero against every other, both ways round
    python pipeline/sim/sim.py all --heroes Anka Kaia Sefu Hank --reps 6
    python pipeline/sim/sim.py page <name>               a run's page again from its .json

Common options: --arena random|<id> (default random), --events (the arenas' events and closing stages on), --workers N
(browsers at once; default: half the machine's cores, so the computer stays usable), --out NAME, --open (show the page
when done).

It writes pipeline/sim/out/<name>.json and <name>.html (and latest.html beside them) and prints the table. A fight is a
'run' duel at the balance CPU level: the hero on the player's side, the foe on the opponent's, both played by the CPU, as
pipeline/tools/kit-balance.js runs them. A kit's target is 40-60% against the benchmark foes.

Needs: Python 3.10+, `pip install playwright`, Google Chrome (or --browser msedge), Node with the repo's node_modules.
It starts its own dev server (port 5181, no hot reload: pipeline/sim/vite.sim.config.ts) and stops it at the end; one
already running there is used and left alone. Every wait ends by itself: a fight has 120 simulated seconds and
--fight-timeout real ones (default 90), the whole run --max-minutes (default 60).
"""
import argparse
import asyncio
import datetime
import json
import math
import os
import random
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "out"
BENCH = ["Brannoc", "Kaia", "Isolde", "Sirix", "Cantor", "Oblivion"]
SOURCES = ["Q", "W", "E", "R", "attack", "unit", "trait"]
# No rendering happens in a fight (the duel is stepped, never drawn), so the graphics card does not matter.
CHROME_ARGS = ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--mute-audio"]


def server_up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def start_server(port):
    """The simulator's own dev server, or None when one already answers on the port."""
    if server_up(port):
        return None
    vite = ROOT / "node_modules" / "vite" / "bin" / "vite.js"
    if not vite.exists():
        sys.exit("node_modules is missing: run `npm install` in the repo first")
    proc = subprocess.Popen(["node", str(vite), "--config", str(HERE / "vite.sim.config.ts"), "--port", str(port)],
                            cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if proc.poll() is not None:
            sys.exit(f"the dev server stopped at once (exit {proc.returncode}); is port {port} taken?")
        if server_up(port):
            return proc
        time.sleep(0.5)
    proc.terminate()
    sys.exit("the dev server did not answer within 60 s")


async def open_page(pw, args, url):
    """A browser with the game loaded and the simulator's script in it. Three tries: a source file saved half-way
    through an edit breaks one load, not the run."""
    last = None
    for attempt in range(3):
        browser = await pw.chromium.launch(channel=args.browser, headless=True, args=CHROME_ARGS)
        try:
            page = await browser.new_page(viewport={"width": 640, "height": 400})
            await page.goto(url, wait_until="load", timeout=60000)
            await page.wait_for_function("typeof vfx !== 'undefined' && !!vfx.duel && !!vfx.heroPickCtrl", timeout=60000)
            await page.add_script_tag(path=str(HERE / "page.js"))
            return browser, page
        except Exception as e:
            last = e
            try:
                await asyncio.wait_for(browser.close(), timeout=10)
            except Exception:
                pass
            await asyncio.sleep(3)
    raise RuntimeError(f"the game page did not load in three tries: {last}")


async def worker(pw, args, url, opened, jobs, results, state):
    browser, page = opened
    try:
        while time.time() < state["deadline"]:
            try:
                job = jobs.get_nowait()
            except asyncio.QueueEmpty:
                break
            try:
                r = await asyncio.wait_for(page.evaluate("(job) => _simFight(job)", job), timeout=args.fight_timeout)
            except Exception as e:  # a stuck or crashed page: note the fight, start a fresh browser
                r = {"hero": job["hero"], "foe": job["foe"], "arena": None, "winner": None, "seconds": 0, "heroHp": 0, "foeHp": 0,
                     "dealt": {}, "taken": {}, "crashed": True,
                     "errors": [f"{job['hero']} vs {job['foe']}: {type(e).__name__}: {str(e)[:200]}"]}
                try:
                    await asyncio.wait_for(browser.close(), timeout=10)
                except Exception:
                    pass
                browser, page = await open_page(pw, args, url)
            results.append(r)
    finally:
        try:
            await asyncio.wait_for(browser.close(), timeout=10)
        except Exception:
            pass


async def progress(results, total, state):
    t0 = time.time()
    while not state["done"]:
        await asyncio.sleep(5)
        n = len(results)
        rate = n / max(1e-6, time.time() - t0)
        left = (total - n) / rate if rate > 0 else 0
        print(f"  {n}/{total} fights, {rate:.1f} a second, about {left:.0f} s left", flush=True)


def match(name, heroes):
    """A hero by its name, whatever the case, or by the start of it."""
    low = name.lower()
    for h in heroes:
        if h.lower() == low:
            return h
    starts = [h for h in heroes if h.lower().startswith(low)]
    if len(starts) == 1:
        return starts[0]
    sys.exit(f"no hero called {name!r}. Heroes: {', '.join(heroes)}")


def build_jobs(args, info):
    heroes = info["heroes"]
    base = {"arena": args.arena, "events": args.events}
    jobs, subjects, foes = [], [], []
    if args.mode == "hero":
        subjects = [match(n, heroes) for n in args.names]
        foes = [match(n, heroes) for n in (args.foes or BENCH)]
        for s in subjects:
            for f in foes:
                if f == s:
                    continue
                jobs += [{**base, "hero": s, "foe": f}] * args.fights
                if args.sides == "both":
                    jobs += [{**base, "hero": f, "foe": s}] * args.fights
    elif args.mode == "duel":
        a, b = match(args.names[0], heroes), match(args.names[1], heroes)
        subjects, foes = [a, b], [a, b]
        jobs += [{**base, "hero": a, "foe": b}] * args.fights + [{**base, "hero": b, "foe": a}] * args.fights
    else:
        subjects = [match(n, heroes) for n in args.heroes] if args.heroes else list(heroes)
        foes = subjects
        for a in subjects:
            for b in subjects:
                if a != b:
                    jobs += [{**base, "hero": a, "foe": b}] * args.reps
    jobs = [dict(j) for j in jobs]
    random.shuffle(jobs)
    return jobs, subjects, foes


def summarise(args, info, results, subjects, foes, wall):
    rows = []
    for s in subjects:
        n = w = none = 0
        secs = taken = 0.0
        dealt = {k: 0.0 for k in SOURCES}
        by = {}
        for r in results:
            if r.get("crashed") or s not in (r["hero"], r["foe"]):
                continue
            mine = r["hero"] == s
            other = r["foe"] if mine else r["hero"]
            if args.mode == "hero" and other not in foes:
                continue
            cell = by.setdefault(other, [0, 0])
            n += 1
            cell[1] += 1
            secs += r["seconds"]
            if r["winner"] == s:
                w += 1
                cell[0] += 1
            elif r["winner"] is None:
                none += 1
            d, t = (r["dealt"], r["taken"]) if mine else (r["taken"], r["dealt"])
            for k, v in d.items():
                dealt[k if k in dealt else "trait"] += v
            taken += sum(t.values())
        p = w / n if n else 0.0
        rows.append({
            "name": s, "n": n, "w": w, "pct": round(100 * p, 1), "ci": round(100 * 1.96 * math.sqrt(p * (1 - p) / n), 1) if n else 0,
            "avgSecs": round(secs / n, 1) if n else 0, "none": none,
            "dps": {k: round(v / secs, 2) if secs else 0 for k, v in dealt.items()},
            "takenDps": round(taken / secs, 2) if secs else 0,
            "by": {k: v for k, v in by.items()},
        })
    errors, standing = [], []
    for r in results:
        errors += r.get("errors") or []
        if r["winner"] is None and not r.get("crashed"):
            standing.append({"hero": r["hero"], "foe": r["foe"], "arena": r.get("arena"), "hp": [r["heroHp"], r["foeHp"]], **(r.get("standing") or {})})
    arenas = {}
    for r in results:
        if r.get("arena"):
            arenas[r["arena"]] = arenas.get(r["arena"], 0) + 1
    if args.mode == "hero":
        what = f"{', '.join(subjects)} against {', '.join(foes)}"
    elif args.mode == "duel":
        what = f"{subjects[0]} against {subjects[1]}"
    else:
        what = f"{len(subjects)} heroes, each against every other"
    return {
        "meta": {
            "mode": args.mode, "what": what, "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "fights": len(results), "crashed": sum(1 for r in results if r.get("crashed")),
            "simSeconds": round(sum(r["seconds"] for r in results)), "wallSeconds": round(wall, 1), "workers": args.workers,
            "arena": args.arena, "events": args.events, "sides": getattr(args, "sides", "both") if args.mode == "hero" else "both",
            "perCell": args.fights if args.mode != "all" else args.reps * 2, "command": " ".join(["python", "pipeline/sim/sim.py"] + sys.argv[1:]),
        },
        "rows": rows, "foes": foes, "arenas": arenas, "errors": errors[:40], "errorCount": len(errors), "standing": standing[:40],
    }


def write_report(name, data):
    OUT.mkdir(exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    page = (HERE / "report.html").read_text(encoding="utf-8").replace("/*__DATA__*/null", json.dumps(data).replace("</", "<\\/"))
    for f in (OUT / f"{name}.html", OUT / "latest.html"):
        f.write_text(page, encoding="utf-8")
    return OUT / f"{name}.html"


def print_table(data):
    print()
    print(f"{'hero':<20}{'win %':>7}{'+-':>6}{'fights':>8}{'secs':>7}{'no winner':>11}   damage a second by source")
    for r in sorted(data["rows"], key=lambda x: -x["pct"]):
        dps = "  ".join(f"{k} {v:.1f}" for k, v in r["dps"].items() if v > 0.05)
        flag = "" if 40 <= r["pct"] <= 60 else ("  <- strong" if r["pct"] > 60 else "  <- weak")
        print(f"{r['name']:<20}{r['pct']:>7.1f}{r['ci']:>6.1f}{r['n']:>8}{r['avgSecs']:>7.1f}{r['none']:>11}   {dps}{flag}")
    if data["errorCount"]:
        print(f"\n{data['errorCount']} errors in the fights (bugs to fix); the first:")
        for e in data["errors"][:5]:
            print("  " + e)


async def run(args):
    port = args.port
    url = f"http://localhost:{port}/"
    proc = start_server(port)
    t0 = time.time()
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            # every browser loads the game at once; the first one says which heroes and arenas there are
            opened = await asyncio.gather(*[open_page(pw, args, url) for _ in range(max(1, args.workers))])
            info = await opened[0][1].evaluate("() => _simInfo()")
            if args.arena != "random" and args.arena not in info["arenas"]:
                sys.exit(f"no arena {args.arena!r}. Arenas: {', '.join(info['arenas'])}")
            jobs, subjects, foes = build_jobs(args, info)
            total = len(jobs)
            workers = len(opened)
            args.workers = workers
            print(f"{total} fights in {workers} browsers ({args.mode}; arena {args.arena}; events {'on' if args.events else 'off'}); loaded in {time.time() - t0:.0f} s", flush=True)
            queue = asyncio.Queue()
            for j in jobs:
                queue.put_nowait(j)
            results, state = [], {"done": False, "deadline": time.time() + args.max_minutes * 60}
            ticker = asyncio.create_task(progress(results, total, state))
            await asyncio.gather(*[worker(pw, args, url, o, queue, results, state) for o in opened])
            state["done"] = True
            ticker.cancel()
            if len(results) < total:
                print(f"stopped at the time limit with {len(results)} of {total} fights", flush=True)
    finally:
        if proc:
            proc.terminate()
    data = summarise(args, info, results, subjects, foes, time.time() - t0)
    stamp = datetime.datetime.now().strftime("%m%d-%H%M")
    name = args.out or f"{args.mode}-{'-'.join(s.replace(' ', '') for s in subjects[:3])}{'-etc' if len(subjects) > 3 else ''}-{stamp}"
    path = write_report(name, data)
    print_table(data)
    print(f"\n{data['meta']['fights']} fights ({data['meta']['simSeconds']} s of fighting) in {data['meta']['wallSeconds']} s")
    print(f"page: {path}")
    if args.open:
        webbrowser.open(path.as_uri())


def main():
    cores = os.cpu_count() or 4
    ap = argparse.ArgumentParser(description="CPU duels on the game's own code, many at once; results as a page.")
    sub = ap.add_subparsers(dest="mode", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--arena", default="random")
    common.add_argument("--events", action="store_true", help="the arenas' events and closing stages on")
    # Half the machine by default: with every core busy the computer is barely usable while a long run goes.
    common.add_argument("--workers", type=int, default=max(1, cores // 2), help="browsers at once (default: half the cores)")
    common.add_argument("--out", default="")
    common.add_argument("--open", action="store_true")
    common.add_argument("--port", type=int, default=5181)
    common.add_argument("--browser", default="chrome", help="chrome or msedge")
    common.add_argument("--fight-timeout", type=float, default=90, help="real seconds one fight may take")
    common.add_argument("--max-minutes", type=float, default=60)
    h = sub.add_parser("hero", parents=[common], help="heroes against the benchmark foes")
    h.add_argument("names", nargs="+")
    h.add_argument("--fights", type=int, default=16, help="per foe (and per side with --sides both)")
    h.add_argument("--foes", nargs="*")
    h.add_argument("--sides", choices=["hero", "both"], default="hero", help="hero: only as the player's side, as kit-balance.js does")
    d = sub.add_parser("duel", parents=[common], help="one pairing, both ways round")
    d.add_argument("names", nargs=2)
    d.add_argument("--fights", type=int, default=20, help="each way round")
    a = sub.add_parser("all", parents=[common], help="every hero against every other, both ways round")
    a.add_argument("--heroes", nargs="*")
    a.add_argument("--reps", type=int, default=1, help="fights per ordered pairing")
    pg = sub.add_parser("page", help="write a run's page again from its .json (after the page's template changed)")
    pg.add_argument("name")
    args = ap.parse_args()
    if args.mode == "page":
        print(f"page: {write_report(args.name, json.loads((OUT / (args.name + '.json')).read_text(encoding='utf-8')))}")
        return
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
