"""
One picture of each reworked hero in a CPU duel on the game page, HUD and all, at the moment its own rule shows
(docs/heroes/rework-<hero>.jpg): Brannoc at white heat, Cantor on the beat with a Crescendo, Vesper with the Price up.
A headless Chrome as heart-holdstill-shots.py launches it; the duel is started the way the game's own CPU screen starts
it, the hero is handed to the autopilot, and the fight is stepped by hand until the moment comes.

    python pipeline/tools/rework-shots.py docs/heroes [--port 5181] [--only brannoc,cantor]

It needs a dev server on that port (the simulator's: `node node_modules/vite/bin/vite.js --config
pipeline/sim/vite.sim.config.ts --port 5181`), `pip install playwright` and Google Chrome.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

# Starts the duel and leaves `window.T.until(test, seconds)`: steps the fight until `test(rt, duel)` is true.
SETUP = """
async ({ hero, foe }) => {
  game.cpu.start({ hero, foe, level: 3 });
  const api = game.api, d = api.duel;
  const t0 = Date.now();
  while (!(d.on && d.heroRt && d.foe && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 300));
  api.view.paused = true;
  let simMs = performance.now();
  performance.now = () => simMs;
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  // The hero plays itself, as in the simulator.
  d.autopilot = true;
  window.T = {
    until(test, seconds) {
      let f = 0;
      for (; f < seconds * 60 && !d.result; f++) {
        simMs += 1000 / 60;
        api.step(1 / 60);
        if (f > 30 && test(d.heroRt, d)) break;
      }
      api.render();
      return { time: +d.time.toFixed(2), res: Math.round(d.heroRt.res), hp: Math.round(d.playerHp), over: !!d.result };
    },
    step(s) {
      for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); }
      api.render();
    },
  };
  return { hero: api.duel.host.heroMode.currentKit.name, foe: d.opponentKit.name, arena: d.currentArena?.id };
}
"""

# Each picture: the hero, a foe, and the moment (JS run after SETUP; `rt` is the hero's trait runtime).
SCENES = {
    # The hammer white-hot: the Heat bar full, the white ring, the burn's numbers.
    "brannoc": ("Brannoc", "Sefu", """() => {
      const a = T.until((rt) => !!rt.mem.white, 40);
      T.step(1.15);
      return a;
    }"""),
    # A clean chord on the pulse with the Crescendo climbing.
    "cantor": ("Cantor", "Sefu", """async () => {
      const bard = await import('/src/traits/bard.ts');
      const a = T.until((rt, d) => rt.res >= 3 && bard.inTune(d.time) && rt.mem.beatCast === Math.round(d.time / bard.BEAT) + 1, 60);
      T.step(0.2);
      return a;
    }"""),
    # The Price run up by a burst of spells.
    "vesper": ("Vesper", "Sefu", """() => {
      const a = T.until((rt) => rt.res >= 38, 60);
      T.step(0.25);
      return a;
    }"""),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5181)
    ap.add_argument("--only", default="")
    ap.add_argument("--size", default="1280x800")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    w, h = (int(v) for v in args.size.lower().split("x"))
    names = [n for n in SCENES if not args.only or n in args.only.split(",")]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for name in names:
            hero, foe, steps = SCENES[name]
            page = browser.new_page(viewport={"width": w, "height": h})
            logs = []
            page.on("pageerror", lambda e: logs.append(str(e)))
            page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
            page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
            print(name, page.evaluate(SETUP, {"hero": hero, "foe": foe}), page.evaluate(steps))
            page.wait_for_timeout(300)
            page.screenshot(path=str(out / f"rework-{name}.jpg"), type="jpeg", quality=90)
            if logs:
                print("  page errors:", logs[:3])
            page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
