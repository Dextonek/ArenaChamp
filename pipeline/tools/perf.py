"""
The performance tool: plays fixed scenes of the real game in a browser with the real graphics card, times every frame, and
measures what the game downloads before it can be played. How to read it: docs/pipeline/performance.md.

    python pipeline/tools/perf.py scenes --label baseline                    # every scene on every profile (about 25 min)
    python pipeline/tools/perf.py scenes --label try --profiles phone-4x --scenes duel-temple,raid-party
    python pipeline/tools/perf.py scenes --label whatif --scenes duel-temple --set "{\"pixelRatio\": 1}"
    python pipeline/tools/perf.py profile --scene raid-party --profile phone-4x   # where the processor's time goes
    python pipeline/tools/perf.py passes --scene duel-temple                 # what each step of drawing a frame costs the graphics card
    python pipeline/tools/perf.py parts --scene duel-temple                  # what each part of the picture costs it (hidden one at a time)
    python pipeline/tools/perf.py flips --scene raid-party                   # materials that make three look their shader up every frame
    python pipeline/tools/perf.py census --scene raid-party --profile phone  # who the draw calls belong to
    python pipeline/tools/perf.py load --label baseline                      # the built game: bytes, requests, the first fight
    python pipeline/tools/perf.py files                                      # the sizes of the built chunks and the models

`scenes` writes docs/perf/data/<label>.json (one row for each scene on each profile; an earlier file of the same label is
added to, a row measured again replaces the old one) and a picture of each scene in docs/perf/img/. `load` writes
docs/perf/data/<label>-load.json. The page that shows them: python pipeline/tools/perf-report.py.

A scene is one fresh browser: its first seconds are the cold start a player meets (shaders compile on first use). The
profiles: `desktop` (1920 x 1080), `phone` (844 x 390 at three pixels to a point, touch), each at the processor's own
speed and slowed 4 and 6 times (Chrome's CPU throttling). The graphics card is this computer's own: the result names
it, and says so if the browser fell back to software drawing.

A slowed profile does not force the wait for the graphics card after each frame: Chrome's throttle holds the page's
thread for three quarters of ALL time, a forced wait included, so such a frame came out far too slow (68 ms where 4 x
the processor's 3 ms plus the card's 22 ms is 34). Left alone, the wait comes by itself inside the draw calls (the
browser holds them back when the card is behind), and the frame's time is the slowed processor's work plus the card's
(40 ms for that frame). So on a slowed profile "draw" contains the card's time and there is no separate "card".

--root <folder> measures another checkout of the game (a git worktree of an earlier commit) with this checkout's tool: how
"before" is measured again beside "after", on the same day and the same computer. Give it its own --port.

`scenes` uses the simulator's dev server config (no hot reload) on its own port; `load` builds nothing: run `npm run build`
first, it serves dist/ itself with the live site's compression (text compressed, models and pictures as they are).
Needs `pip install playwright` and Chrome or Edge (--browser chrome|msedge; the default is whichever is installed).
"""
import argparse
import asyncio
import gzip
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "perf"

SCENES = {
    "menu": {"scene": "menu"},
    "duel-temple": {"scene": "duel", "hero": "Lyra", "foe": "Oblivion", "arena": "temple"},
    "duel-harbour": {"scene": "duel", "hero": "Anka", "foe": "Isolde", "arena": "harbour"},
    "raid-solo": {"scene": "raid", "hero": "Kaia", "boss": "sun"},
    "raid-party": {"scene": "raid", "hero": "Kaia", "boss": "sun", "party": 9, "band": 10},
    "tower-horde": {"scene": "tower", "hero": "Kaia"},
}

# More scenes, by name only (not part of a run of "every scene"): a duel in each arena and the other two bosses, for
# looking at one room (`parts`, `census`) and for the picture compare across every room.
MORE = {
    **{f"arena-{a}": {"scene": "duel", "hero": "Lyra", "foe": "Oblivion", "arena": a} for a in
       ("temple", "frost", "caldera", "glade", "skyruins", "harbour", "canyon", "cavern", "battlefield")},
    "raid-ash": {"scene": "raid", "hero": "Kaia", "boss": "ash"},
    "raid-heart": {"scene": "raid", "hero": "Kaia", "boss": "heart"},
    "raid-heart-party": {"scene": "raid", "hero": "Kaia", "boss": "heart", "party": 9, "band": 10},
    # The Tower's floors as worlds: the wide zone of each floor, the hero set down beside one pack after another. The names
    # are the five handmade floors' first numbers; since the Climb became 50 floors they are floors 1, 11, 21, 31 and 41.
    **{f"world-{i}": {"scene": "world", "floor": n, "hero": "Kaia"} for i, n in ((1, 1), (2, 11), (3, 21), (4, 31), (5, 41))},
}
ALL = {**SCENES, **MORE}

PROFILES = {
    "desktop": {"size": (1920, 1080), "dsf": 1, "mobile": False, "cpu": 1},
    "desktop-4x": {"size": (1920, 1080), "dsf": 1, "mobile": False, "cpu": 4},
    "phone": {"size": (844, 390), "dsf": 3, "mobile": True, "cpu": 1},
    "phone-4x": {"size": (844, 390), "dsf": 3, "mobile": True, "cpu": 4},
    "phone-6x": {"size": (844, 390), "dsf": 3, "mobile": True, "cpu": 6},
}

# The real graphics card, also without a window; exact memory numbers; no slowing of a page nobody looks at.
BROWSER_ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--enable-precise-memory-info",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]

PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"


def default_browser():
    chrome = [Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
              Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
              Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe"]
    return "chrome" if any(p.exists() for p in chrome) or sys.platform != "win32" else "msedge"


def up(port, path="/"):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}{path}", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def dev_server(port, root=""):
    """
    The no-hot-reload dev server on `port`: one that is there is used and left alone, else one is started (and returned, to
    stop). `root`: another checkout of the game to serve (a git worktree of an earlier commit, to measure "before" again).
    """
    if up(port):
        return None
    root = Path(root) if root else ROOT
    proc = subprocess.Popen(["node", str(root / "node_modules" / "vite" / "bin" / "vite.js"), "--config",
                             str(root / "pipeline" / "sim" / "vite.sim.config.ts"), "--port", str(port)],
                            cwd=str(root), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if up(port):
            return proc
        time.sleep(0.5)
    proc.terminate()
    sys.exit("the dev server did not answer within 60 s")


def git_head(root=""):
    """The commit of the checkout that is measured (`root`, or this one)."""
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(root or ROOT), capture_output=True, text=True).stdout.strip()
    except Exception:
        return ""


async def open_page(pw, args, prof, url):
    browser = await pw.chromium.launch(channel=args.browser, headless=not args.headed, args=BROWSER_ARGS, timeout=60000)
    w, h = prof["size"]
    ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=prof["dsf"], is_mobile=prof["mobile"],
                                    has_touch=prof["mobile"], **({"user_agent": PHONE_UA} if prof["mobile"] else {}))
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    return browser, page, cdp


async def run_scenes(args):
    data_file = OUT / "data" / f"{args.label}.json"
    img = OUT / "img"
    img.mkdir(parents=True, exist_ok=True)
    data_file.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(data_file.read_text(encoding="utf-8")) if data_file.exists() else {"label": args.label, "runs": []}
    data.update({"when": time.strftime("%Y-%m-%d %H:%M"), "commit": git_head(args.root), "frames": args.frames})
    script = (ROOT / "pipeline" / "tools" / "perf-page.js").read_text(encoding="utf-8")
    extra = json.loads(args.set) if args.set else None
    proc = dev_server(args.port, args.root)
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            for pname in args.profiles.split(","):
                prof = PROFILES[pname]
                for sname in args.scenes.split(","):
                    opts = {**ALL[sname], "frames": args.frames, "seed": args.seed}
                    if prof["cpu"] > 1:
                        opts["sync"] = False
                    if extra:
                        opts["set"] = extra
                    t0 = time.time()
                    browser, page, cdp = await open_page(pw, args, prof, "")
                    try:
                        await page.goto(f"http://localhost:{args.port}/game.html", wait_until="load", timeout=120000)
                        await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
                        await page.evaluate(script)
                        info = await page.evaluate("_perf.info()")
                        if prof["cpu"] > 1:
                            await cdp.send("Emulation.setCPUThrottlingRate", {"rate": prof["cpu"]})
                        res = await asyncio.wait_for(page.evaluate("(o) => _perf.run(o)", opts), timeout=args.timeout)
                        if prof["cpu"] > 1:
                            await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
                        if not res.get("crashed") and not args.no_pictures:
                            await page.evaluate("_perf.draw()")
                            await page.add_style_tag(content="*{animation:none!important;transition:none!important}")
                            await page.screenshot(path=str(img / f"{args.label}-{pname}-{sname}.jpg"), type="jpeg", quality=82)
                    finally:
                        await browser.close()
                    row = {"profile": pname, "id": sname, "gpu": info["gpu"], "ua": info["ua"], "quality": info.get("quality"), **res}
                    data["runs"] = [r for r in data["runs"] if not (r["profile"] == pname and r["id"] == sname)] + [row]
                    data["gpu"] = info["gpu"]
                    data_file.write_text(json.dumps(data), encoding="utf-8")
                    if res.get("crashed"):
                        print(f"{pname:11} {sname:13} CRASHED: {res['crashed'][:300]}", flush=True)
                        continue
                    f, wm = res["frame"], res["warm"]
                    soft = "  SOFTWARE DRAWING: the numbers mean nothing" if "SwiftShader" in info["gpu"] or "Basic Render" in info["gpu"] else ""
                    print(f"{pname:11} {sname:13} median {f['median']:6.2f} ms  p99 {f['p99']:6.1f}  longest {f['max']:6.1f}  warm p99 {wm['p99']:6.1f}  "
                          f"step {res['step']['median']:5.2f} draw {res['draw']['median']:5.2f} gpu {res['gpu']['median']:5.2f}  calls {res['drawCalls']['median']:4d}  "
                          f"tris {res['triangles']['median'] // 1000:4d}k  parts {res['particles']['max']:5d}  alloc {res['allocMBs']:5.2f} MB/s  print {res['printHash']}  "
                          f"({time.time() - t0:.0f} s){soft}", flush=True)
                    for e in res["errors"][:3]:
                        print("   error in the page: " + e[:200], flush=True)
    finally:
        if proc:
            proc.terminate()
    print(f"saved {data_file}")


# --- where the time goes ---------------------------------------------------------------------------------------------

def short(url):
    return url.split("/src/")[-1].split("?")[0] if "/src/" in url else url.split("/")[-1].split("?")[0]


async def one_scene(args, opts, before=None, after=None, call="run"):
    """Plays one scene in a fresh browser; `before(cdp, page)` and `after(cdp)` wrap the run. Returns (result, what `after` gave)."""
    script = (ROOT / "pipeline" / "tools" / "perf-page.js").read_text(encoding="utf-8")
    proc = dev_server(args.port, args.root)
    prof = PROFILES[args.profile]
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            browser, page, cdp = await open_page(pw, args, prof, "")
            await page.goto(f"http://localhost:{args.port}/game.html", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
            await page.evaluate(script)
            if prof["cpu"] > 1:
                await cdp.send("Emulation.setCPUThrottlingRate", {"rate": prof["cpu"]})
            if before:
                await before(cdp, page)
            res = await asyncio.wait_for(page.evaluate(f"(o) => _perf.{call}(o)", opts), timeout=args.timeout)
            extra = await after(cdp) if after else None
            await browser.close()
    finally:
        if proc:
            proc.terminate()
    if res.get("crashed"):
        sys.exit("the scene crashed: " + res["crashed"])
    return res, extra


async def run_profile(args):
    """One scene under Chrome's own profiler: the functions the processor spends its time in."""
    opts = {**ALL[args.scene], "frames": args.frames, "seed": args.seed, "profile": True}
    if args.set:
        opts["set"] = json.loads(args.set)

    async def before(cdp, page):
        await cdp.send("Profiler.enable")
        await cdp.send("Profiler.setSamplingInterval", {"interval": 200})

        # The profiler starts when the measured frames do (the page calls back), so loading is not in it.
        async def begin():
            await cdp.send("Profiler.start")
            # Every allocation counts, also what the garbage collector has already taken back: that is the garbage.
            await cdp.send("HeapProfiler.startSampling", {"samplingInterval": 8192, "includeObjectsCollectedByMajorGC": True, "includeObjectsCollectedByMinorGC": True})
        await cdp.send("HeapProfiler.enable")
        await page.expose_function("_perfBegin", begin)

    async def after(cdp):
        cpu = (await cdp.send("Profiler.stop"))["profile"]
        heap = (await cdp.send("HeapProfiler.stopSampling"))["profile"]
        return cpu, heap

    res, (cpu, heap) = await one_scene(args, opts, before, after)
    nodes = {n["id"]: n for n in cpu["nodes"]}
    own, by_file = {}, {}
    for node_id, dt in zip(cpu["samples"], cpu.get("timeDeltas", [])):
        f = nodes[node_id]["callFrame"]
        key = (f["functionName"] or "(anonymous)", short(f["url"]), f["lineNumber"] + 1)
        own[key] = own.get(key, 0) + dt / 1000
    for (name, url, line), ms in own.items():
        by_file[url or name] = by_file.get(url or name, 0) + ms
    frames = res["frames"]
    print(f"{args.scene} on {args.profile}: frame median {res['frame']['median']} ms (step {res['step']['median']}, draw {res['draw']['median']}, "
          f"wait for the card {res['gpu']['median']}), garbage {res['allocMBs']} MB a second")
    print(f"\nProcessor time by function, ms a frame (its own time, without what it calls; {sum(own.values()) / frames:.2f} ms a frame in all):")
    for (name, url, line), ms in sorted(own.items(), key=lambda kv: -kv[1])[:args.top]:
        print(f"  {ms / frames:6.3f}  {name[:44]:44} {url}:{line}")
    print("\nBy file, ms a frame:")
    for url, ms in sorted(by_file.items(), key=lambda kv: -kv[1])[:24]:
        print(f"  {ms / frames:6.3f}  {url}")
    # Memory asked for, by the function that asked and by the nearest function of the game's own up the stack.
    made, made_by = {}, {}

    def walk(node, owner):
        f = node["callFrame"]
        key = (f["functionName"] or "(anonymous)", short(f["url"]), f["lineNumber"] + 1)
        if "/src/" in f["url"]:
            owner = key
        if node["selfSize"]:
            made[key] = made.get(key, 0) + node["selfSize"]
            made_by[owner] = made_by.get(owner, 0) + node["selfSize"]
        for c in node.get("children", []):
            walk(c, owner)
    walk(heap["head"], ("(not the game's code)", "", 0))
    seconds = frames / 60
    print(f"\nMemory asked for, MB a second, by the function that asked ({sum(made.values()) / 1048576 / seconds:.1f} MB a second sampled in all):")
    for (name, url, line), size in sorted(made.items(), key=lambda kv: -kv[1])[:args.top // 2]:
        print(f"  {size / 1048576 / seconds:6.2f}  {name[:44]:44} {url}:{line}")
    print("\nThe same by the nearest function of the game's own code up the stack:")
    for (name, url, line), size in sorted(made_by.items(), key=lambda kv: -kv[1])[:args.top // 2]:
        print(f"  {size / 1048576 / seconds:6.2f}  {name[:44]:44} {url}:{line}")
    out = OUT / "data" / f"profile-{args.scene}-{args.profile}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"scene": args.scene, "profile": args.profile, "result": {k: v for k, v in res.items() if k != "line"},
                               "garbage": [[n, u, ln, round(sz / 1048576 / seconds, 3)] for (n, u, ln), sz in sorted(made.items(), key=lambda kv: -kv[1])[:100]],
                               "garbageBy": [[n, u, ln, round(sz / 1048576 / seconds, 3)] for (n, u, ln), sz in sorted(made_by.items(), key=lambda kv: -kv[1])[:100]],
                               "functions": [[n, u, ln, round(ms / frames, 4)] for (n, u, ln), ms in sorted(own.items(), key=lambda kv: -kv[1])[:200]],
                               "files": [[u, round(ms / frames, 4)] for u, ms in sorted(by_file.items(), key=lambda kv: -kv[1])[:60]]}), encoding="utf-8")
    print(f"saved {out}")


async def run_passes(args):
    """What each step of drawing a frame costs the graphics card (by its own timer), for one scene."""
    opts = {**ALL[args.scene], "frames": args.frames, "seed": args.seed, "passes": True}
    if args.set:
        opts["set"] = json.loads(args.set)
    res, _ = await one_scene(args, opts)
    print(f"{args.scene} on {args.profile}, canvas {res['canvas'][0]} x {res['canvas'][1]}: frame median {res['frame']['median']} ms, wait for the card {res['gpu']['median']} ms")
    print("The graphics card's own time for each step, ms a frame (median over the run):")
    for name, ms in (res.get("passes") or {}).items():
        print(f"  {ms:6.2f}  {name}")
    out = OUT / "data" / f"passes-{args.scene}-{args.profile}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({k: v for k, v in res.items() if k != "line"}), encoding="utf-8")
    print(f"saved {out}")


async def run_flips(args):
    """Materials that make three look their shader up again every frame, for one scene (see `flipWatch` in perf-page.js)."""
    opts = {**ALL[args.scene], "frames": args.frames, "seed": args.seed, "flips": True}
    res, _ = await one_scene(args, opts)
    f = res["flips"]
    print(f"{args.scene}: {len(f['shared'])} materials drawn by objects of two kinds; {f['markedAFrame']:.1f} materials a frame marked as changed")
    for row in f["shared"]:
        print(f"  shared by {' and '.join(row['kinds'])}: {row['material']}")
    for row in f["marked"]:
        print(f"  marked {row['timesAFrame']} times a frame: {row['material']}")


async def run_census(args):
    """Who the draw calls of one scene belong to (see `census` in perf-page.js), as it stands after the frames played."""
    opts = {**ALL[args.scene], "frames": args.frames, "seed": args.seed, "census": True}
    res, _ = await one_scene(args, opts)
    rows = res["census"]
    print(f"{args.scene} on {args.profile} after {args.frames} frames: {res['drawCalls']['median']} draw calls a frame (median), {sum(r['drawn'] for r in rows)} things drawn at the end, {sum(r['shadows'] for r in rows)} of them casting a shadow")
    print(f"  {'drawn':>5} {'+shadow':>7} {'rigged':>6} {'triangles':>9}  part")
    for r in rows[:args.top]:
        print(f"  {r['drawn']:5d} {r['shadows']:7d} {r['rigged']:6d} {r['triangles']:9d}  {r['part']}")


async def run_parts(args):
    """What each part of one scene's picture costs the graphics card: the frame drawn again with one part hidden at a time."""
    opts = {**ALL[args.scene], "seed": args.seed, "at": args.frames}
    if args.set:
        opts["set"] = json.loads(args.set)
    res, _ = await one_scene(args, opts, call="parts")
    print(f"{args.scene} on {args.profile}, canvas {res['canvas'][0]} x {res['canvas'][1]}, held at frame {args.frames}: one frame {res['frameMs']} ms (measured again at the end: {res['frameMsAgain']})")
    print("Faster by this many ms without it (parts under 0.3 ms left out):")
    for row in res["parts"]:
        if row["saves"] >= 0.3:
            print(f"  {row['saves']:6.2f}  {row['part']}  ({row['draws']} things drawn)")
    print("Switches:")
    for name, ms in res["switches"].items():
        print(f"  {ms:6.2f}  {name}")
    out = OUT / "data" / f"parts-{args.scene}-{args.profile}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"saved {out}")


# --- loading -------------------------------------------------------------------------------------------------------

TEXT = (".js", ".css", ".html", ".json", ".svg", ".txt")


class Dist(SimpleHTTPRequestHandler):
    """dist/ as the live site sends it: text compressed, models and pictures as they are, everything revalidated."""
    cache = {}
    root = ROOT

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/game", "/"):
            path = "/game.html"
        file = (Dist.root / "dist" / path.lstrip("/")).resolve()
        if not str(file).startswith(str((Dist.root / "dist").resolve())) or not file.is_file():
            self.send_error(404)
            return
        body = file.read_bytes()
        kind = mimetypes.guess_type(file.name)[0] or ("model/gltf-binary" if file.suffix == ".glb" else "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", kind)
        if file.suffix in TEXT and "gzip" in self.headers.get("Accept-Encoding", ""):
            key = (str(file), file.stat().st_mtime)
            body = Dist.cache.setdefault(key, gzip.compress(body, 6))
            self.send_header("Content-Encoding", "gzip")
        # The site's own rule for the file, if dist/_headers has one (the built chunks: kept for good), else as the live site: asked again every time.
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if path.startswith("/assets/") and (Dist.root / "dist" / "_headers").exists() else "public, max-age=0, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


async def run_load(args):
    Dist.root = Path(args.root) if args.root else ROOT
    if not (Dist.root / "dist" / "game.html").exists():
        sys.exit("no dist/: run `npm run build` first")
    server = ThreadingHTTPServer(("127.0.0.1", args.port + 1), Dist)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{args.port + 1}"
    out = {"label": args.label, "when": time.strftime("%Y-%m-%d %H:%M"), "commit": git_head(args.root), "runs": []}
    from playwright.async_api import async_playwright
    try:
        async with async_playwright() as pw:
            for pname in args.profiles.split(","):
                prof = PROFILES[pname]
                browser, page, cdp = await open_page(pw, args, prof, "")
                reqs = []
                await cdp.send("Network.enable")
                urls, sizes, kinds = {}, {}, {}
                cdp.on("Network.requestWillBeSent", lambda e: urls.__setitem__(e["requestId"], e["request"]["url"]))
                cdp.on("Network.responseReceived", lambda e: kinds.__setitem__(e["requestId"], e["response"].get("mimeType", "")))
                cdp.on("Network.loadingFinished", lambda e: sizes.__setitem__(e["requestId"], e["encodedDataLength"]))

                def taken(since=()):
                    rows = [{"url": urls[i].replace(base, ""), "bytes": int(sizes[i]), "type": kinds.get(i, "")} for i in sizes if i in urls and i not in since]
                    return rows
                if prof["cpu"] > 1:
                    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": prof["cpu"]})
                await page.add_init_script("""
                    window._long = [];
                    new PerformanceObserver((l) => { for (const e of l.getEntries()) window._long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] });
                """)
                t0 = time.time()
                await page.goto(f"{base}/game{('?' + args.query) if args.query else ''}", wait_until="load", timeout=180000)
                await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=180000)
                # The first frame after the game's own scripts ran: the menu is up and can be clicked.
                first = await page.evaluate("new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(performance.now()))))")
                nav = await page.evaluate("(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; })()")
                await page.wait_for_timeout(1500)
                menu = taken()
                seen = set(sizes)
                menu_long = await page.evaluate("window._long.splice(0)")
                # Into the first fight: the Play screen's CPU duel, as the button starts it.
                t1 = await page.evaluate("performance.now()")
                await page.evaluate("game.cpu.start({ hero: 'Lyra', foe: 'Oblivion', level: 3 })")
                await page.wait_for_function("document.querySelector('.loading') && document.querySelector('.loading').style.display === 'none'", timeout=180000)
                t2 = await page.evaluate("performance.now()")
                # The first 20 s of the fight in real time, as a player has it: how long the frames take while the first spells are cast.
                await cdp.send("Performance.enable")
                m0 = {m["name"]: m["value"] for m in (await cdp.send("Performance.getMetrics"))["metrics"]}
                frames = await page.evaluate("""
                    new Promise((ok) => {
                      game.api.duel.autopilot = true;
                      const list = []; let last = performance.now(); const end = last + 20000;
                      const step = (t) => { list.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else ok(list); };
                      requestAnimationFrame(step);
                    })
                """)
                m1 = {m["name"]: m["value"] for m in (await cdp.send("Performance.getMetrics"))["metrics"]}
                # The page's own work in those 20 s, by kind, as ms a frame: the script, and what the bars and numbers on the page cost.
                work = {k: round((m1[k] - m0[k]) * 1000 / max(1, len(frames)), 2) for k in ("ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration")}
                fight_long = await page.evaluate("window._long.splice(0)")
                state = await page.evaluate("(() => { const a = game.api, q = a.quality, c = a.renderer?.domElement ?? document.querySelector('#app canvas'); return { canvas: [c.width, c.height], quality: q ? { level: q.level, share: +q.share.toFixed(3), lean: q.lean, restMs: +q.restMs.toFixed(1) } : null }; })()")
                fight = taken(seen)
                frames = sorted(frames[2:])
                row = {
                    "profile": pname, "query": args.query, **state, "firstFrameMs": round(first), "domContentLoadedMs": round(nav["dcl"]), "loadMs": round(nav["load"]),
                    "menu": {"requests": len(menu), "bytes": sum(r["bytes"] for r in menu), "list": sorted(menu, key=lambda r: -r["bytes"]),
                             "longTasks": menu_long, "blockedMs": sum(d for _, d in menu_long)},
                    "fight": {"requests": len(fight), "bytes": sum(r["bytes"] for r in fight), "list": sorted(fight, key=lambda r: -r["bytes"]),
                              "toCountdownMs": round(t2 - t1), "longTasks": fight_long, "blockedMs": sum(d for _, d in fight_long),
                              "frames": len(frames), "medianMs": round(frames[len(frames) // 2], 1), "p99Ms": round(frames[int(len(frames) * 0.99)], 1),
                              "longestMs": round(frames[-1], 1), "over50": sum(1 for f in frames if f > 50), "over100": sum(1 for f in frames if f > 100),
                              "workMsAFrame": work},
                }
                out["runs"].append(row)
                await browser.close()
                m, f = row["menu"], row["fight"]
                print(f"{pname:11} menu: {m['requests']} requests, {m['bytes'] / 1e6:.2f} MB, first frame {row['firstFrameMs']} ms, blocked {m['blockedMs']} ms | "
                      f"first fight: +{f['requests']} requests, +{f['bytes'] / 1e6:.2f} MB, {f['toCountdownMs']} ms to the countdown, blocked {f['blockedMs']} ms, "
                      f"frames over 50 ms: {f['over50']}, longest {f['longestMs']} ms, median {f['medianMs']} ms; a frame's work: script {work['ScriptDuration']} ms, "
                      f"layout {work['LayoutDuration']} ms, styles {work['RecalcStyleDuration']} ms ({time.time() - t0:.0f} s)", flush=True)
    finally:
        server.shutdown()
    out["files"] = files(Dist.root)
    path = OUT / "data" / f"{args.label}-load.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"saved {path}")


def files(root=ROOT):
    """The built chunks (as they are and compressed) and the models, by folder."""
    chunks = []
    for f in sorted((root / "dist" / "assets").glob("*")):
        raw = f.read_bytes()
        chunks.append({"file": f.name, "bytes": len(raw), "gzip": len(gzip.compress(raw, 9))})
    models = {}
    for folder in ("heroes", "arenas", "bosses", "anim", "weapons", "figures"):
        all_files = sorted((root / "public" / "models" / folder).glob("*.glb"))
        used = [f for f in all_files if folder != "heroes" or f.stem.endswith("_v4")]
        models[folder] = {"files": len(all_files), "bytes": sum(f.stat().st_size for f in all_files),
                          "used": len(used), "usedBytes": sum(f.stat().st_size for f in used),
                          "largest": [[f.name, f.stat().st_size] for f in sorted(used, key=lambda f: -f.stat().st_size)[:5]]}
    dist = sum(f.stat().st_size for f in (root / "dist").rglob("*") if f.is_file()) if (root / "dist").exists() else 0
    return {"chunks": chunks, "models": models, "distBytes": dist}


def main():
    ap = argparse.ArgumentParser(description="Measure the game's frame times and its loading.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("scenes", "load"):
        p = sub.add_parser(name)
        p.add_argument("--label", default="run")
        p.add_argument("--profiles", default=",".join(PROFILES) if name == "scenes" else "desktop,phone-4x")
        p.add_argument("--browser", default=default_browser())
        p.add_argument("--headed", action="store_true", help="show the browser's window")
        p.add_argument("--port", type=int, default=5183)
        p.add_argument("--root", default="", help="another checkout of the game to measure (its own --port)")
    sub.choices["load"].add_argument("--query", default="", help="added to the game's address, for example quality=auto")
    s = sub.choices["scenes"]
    s.add_argument("--scenes", default=",".join(SCENES))
    s.add_argument("--frames", type=int, default=1500, help="frames of 1/60 s a scene is played for")
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--set", default="", help="a what-if as JSON, for example {\"pixelRatio\": 1} or {\"shadows\": false}")
    s.add_argument("--timeout", type=float, default=540, help="seconds one scene may take")
    s.add_argument("--no-pictures", action="store_true")
    sub.add_parser("files")
    for name in ("profile", "passes", "parts", "flips", "census"):
        p = sub.add_parser(name)
        p.add_argument("--scene", default="duel-temple")
        p.add_argument("--profile", default="desktop")
        p.add_argument("--frames", type=int, default=900)
        p.add_argument("--seed", type=int, default=7)
        p.add_argument("--set", default="")
        p.add_argument("--top", type=int, default=40)
        p.add_argument("--timeout", type=float, default=540)
        p.add_argument("--browser", default=default_browser())
        p.add_argument("--headed", action="store_true")
        p.add_argument("--port", type=int, default=5183)
        p.add_argument("--root", default="", help="another checkout of the game to measure (its own --port)")
    args = ap.parse_args()
    if args.cmd == "scenes":
        asyncio.run(run_scenes(args))
    elif args.cmd == "profile":
        asyncio.run(run_profile(args))
    elif args.cmd == "passes":
        asyncio.run(run_passes(args))
    elif args.cmd == "parts":
        asyncio.run(run_parts(args))
    elif args.cmd == "flips":
        asyncio.run(run_flips(args))
    elif args.cmd == "census":
        asyncio.run(run_census(args))
    elif args.cmd == "load":
        asyncio.run(run_load(args))
    else:
        print(json.dumps(files(), indent=1))


if __name__ == "__main__":
    main()
