"""
Pictures of the Tower from the game page, HUD and all (docs/tower/*.jpg): its menu screen, one floor of each kind, and the
boon pick on a landing, at 1280x800, and three at 390x844 (a phone held upright). A headless Chrome as page-shots.py launches
it; a climb is started on /game on the floor wanted, the hero is played by the autopilot for a few seconds with time stepped
by hand, and the browser's own screenshot is taken (page-shots.py saves only what a script returns, which leaves the HUD out).

    python pipeline/tools/tower-shots.py docs/tower [--port 5199] [--only horde,phone-boons] [--week 2026-W46] [--hero Kaia]

It uses the simulator's dev server (pipeline/sim/vite.sim.config.ts, no hot reload): one that is running on the port is used
and left alone, else it starts one and stops it again. Needs `pip install playwright` and Google Chrome.
"""
import argparse
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

# Starts a climb on the first floor of `kind` in the week's Tower and waits until the hero stands in it.
SETUP = """
async ([hero, week, kind]) => {
  const { towerFor } = await import('/src/tower/week.ts');
  const plan = towerFor(week, 40).find((p) => p.kind === kind);
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  // A climb for a picture leaves no best floor behind.
  localStorage.clear();
  await game.tower.start({ hero, week, from: plan.n });
  const api = game.api, d = api.duel, a = api.arena;
  const t0 = Date.now();
  while (!(d.boss && d.figure && (d.figure.loaded || !d.opponentKit.model) && api.heroMode.figureLoaded) && Date.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 900));
  api.view.paused = true;
  let simMs = performance.now();
  performance.now = () => simMs;
  window.T = {
    /** `seconds` of the floor, the hero played by the autopilot when `pilot`. */
    step(seconds, pilot = true) {
      d.autopilot = pilot;
      for (let i = 0; i < Math.round(seconds * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); }
      d.autopilot = false;
      // The floor's name has long faded by now (its clock is the page's, which this stepping does not run).
      game.tower.hud.update(10);
      api.render();
    },
    heal() { d.setPlayerHp(d.heroMax); },
    place(x, z) { a.caster.group.position.set(x, 0, z); },
    win() { game.tower.now.link.win(); },
  };
  return { floor: plan.n, kind: plan.kind, mix: plan.mix, twist: plan.twist, foe: plan.foe, def: d.boss.def.id };
}
"""

# After a floor is won: the landing comes after a moment of real time; then its altars rise.
LANDING = """
async () => {
  T.win();
  delete performance.now;
  const d = game.api.duel, t0 = Date.now();
  while (d.boss?.def.id !== 'tower-landing' && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 100));
  let simMs = performance.now();
  performance.now = () => simMs;
  for (let i = 0; i < 100; i++) { simMs += 1000 / 60; game.api.step(1 / 60); }
  game.tower.hud.update(10);
  game.api.render();
  return { def: d.boss?.def.id, cards: document.querySelectorAll('.tower-boon').length };
}
"""

# Each picture: the viewport, the kind of floor to start on (None: the menu), and what to do before the shot.
SCENES = {
    "menu": ((1280, 800), None, None),
    "gauntlet": ((1280, 800), "gauntlet", "() => { T.step(7.5); T.heal(); T.step(0.4); }"),
    "horde": ((1280, 800), "horde", "() => { T.step(7); T.heal(); T.step(0.6); }"),
    "duel": ((1280, 800), "duel", "() => { T.step(5.2); T.heal(); T.step(0.5); }"),
    "break": ((1280, 800), "break", "() => { T.step(7); T.heal(); T.step(0.5); }"),
    "hold": ((1280, 800), "hold", "() => { T.step(9.2); T.heal(); T.step(0.4); }"),
    "guardian": ((1280, 800), "guardian", "() => { T.step(6.4); T.heal(); T.step(0.5); }"),
    "boons": ((1280, 800), "horde", LANDING),
    "phone-menu": ((390, 844), None, None),
    "phone-hold": ((390, 844), "hold", "() => { T.step(9.2); T.heal(); T.step(0.4); }"),
    "phone-boons": ((390, 844), "break", LANDING),
}


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5199)
    ap.add_argument("--only", default="")
    ap.add_argument("--week", default="2026-W46")
    ap.add_argument("--hero", default="Kaia")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = [n for n in SCENES if not args.only or n in args.only.split(",")]
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--config",
                                 str(ROOT / "pipeline" / "sim" / "vite.sim.config.ts"), "--port", str(args.port)],
                                cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if up(args.port):
                break
            time.sleep(0.5)
        else:
            proc.terminate()
            sys.exit("the dev server did not answer within 60 s")
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
            for name in names:
                (w, h), kind, steps = SCENES[name]
                # A phone: a touch screen, so the game lays itself out as on one.
                page = browser.new_page(viewport={"width": w, "height": h}, has_touch=w < 600, is_mobile=w < 600)
                logs = []
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
                page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
                if kind is None:
                    page.evaluate("() => { localStorage.setItem('cpu.hero', 'Kaia'); game.go('tower'); }")
                    page.wait_for_timeout(1800)
                    print(name)
                else:
                    print(name, page.evaluate(SETUP, [args.hero, args.week, kind]), page.evaluate(steps))
                    page.wait_for_timeout(300)
                page.screenshot(path=str(out / f"{name}.jpg"), type="jpeg", quality=88)
                if logs:
                    print("  page errors:", logs[:3])
                page.close()
            browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    sys.exit(main())
