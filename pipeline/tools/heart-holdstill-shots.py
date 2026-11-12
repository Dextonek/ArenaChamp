"""
Pictures of the Heart of Noon's Hold Still from the game page, HUD and all (docs/bosses/heart-holdstill-*.jpg): a headless
Chrome launched as page-shots.py does, a raid started on /game with Kaia, the Heart's fight stepped by hand to each moment,
and the browser's own screenshot (page-shots.py saves only what a script returns, which leaves the HUD out).

    python pipeline/tools/heart-holdstill-shots.py docs/bosses [--port 5181] [--only announce,phone]

It needs a dev server on that port (the simulator's: `node node_modules/vite/bin/vite.js --config
pipeline/sim/vite.sim.config.ts --port 5181`), `pip install playwright` and Google Chrome.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

SETUP = """
async () => {
  game.raid.start({ hero: 'Kaia' });
  await new Promise((r) => setTimeout(r, 1500));
  game.raid.stage = 2;
  // No omen in the pictures (Long Night darkens the screen).
  game.raid.omens.list.length = 0;
  game.raid.upgrades.omens = [];
  game.raid.fight();
  const api = game.api, d = api.duel, a = api.arena;
  const t0 = Date.now();
  while (!(d.boss && d.boss.def.id === 'heart' && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 400));
  api.view.paused = true;
  let simMs = performance.now();
  performance.now = () => simMs;
  d.boss.brain.pause = 1e9;
  d.boss.brain.timedDone = 1e9;
  const V = a.caster.group.position.constructor;
  let seq = 9000;
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  window.T = {
    step(s, walk) {
      for (let i = 0; i < Math.round(s * 60); i++) {
        simMs += 1000 / 60;
        if (walk) a.walk(new V(walk[0], 0, walk[1]));
        api.step(1 / 60);
      }
      api.render();
    },
    place(x, z) { a.caster.group.position.set(x, 0, z); },
    cast(move, o = {}) {
      const c = { id: ++seq, move, step: o.step ?? 0, x: o.x ?? 0, z: o.z ?? 7, fx: 0, fz: 7, dir: o.dir ?? 0, seed: o.seed ?? 4242, target: 0 };
      d.boss.link.cast(c);
      return c.id;
    },
    /** Steps to `before` seconds ahead of beat `n` of cast `id` (after it, when negative). */
    until(id, n, before, walk) {
      const act = d.boss.script.active.find((x) => x.cast.id === id);
      this.step(act.played.threats[n].at - (d.boss.script.clock - act.began) - before, walk);
    },
    phase(i) { d.figure.setBodyPhase(i); },
    heal() { d.playerHp = d.playerMax; },
    hp() { return d.playerHp / d.playerMax; },
    spots() { return d.boss.script.goldSpots(); },
  };
  return { boss: d.boss.def.id, at: [a.caster.group.position.x, a.caster.group.position.z] };
}
"""

# Each scene: a name, a viewport, and the steps (JS, run after SETUP) that bring the fight to the moment of the picture.
SCENES = {
    # The beat announced: white light running in along the floor's joints, the ring closing at the hero's feet.
    "announce": ((1280, 800), """() => {
      T.place(2.2, 13.2); T.step(0.5);
      const id = T.cast('still'); T.until(id, 1, 0.75);
      return { hp: T.hp() };
    }"""),
    # The moment to stand still: the last quarter second before the beat.
    "now": ((1280, 800), """() => {
      T.place(2.2, 13.2); T.step(0.5);
      const id = T.cast('still'); T.until(id, 1, 0.12);
      return { hp: T.hp() };
    }"""),
    # The beat strikes a hero that stood still: nothing.
    "still": ((1280, 800), """() => {
      T.place(2.2, 13.2); T.step(0.5);
      const id = T.cast('still'); T.until(id, 1, -0.07);
      return { hp: T.hp() };
    }"""),
    # The beat strikes a hero that was walking: burnt.
    "strike": ((1280, 800), """() => {
      T.place(0.4, 13.2); T.step(0.5);
      const id = T.cast('still'); T.until(id, 1, 0.5); T.until(id, 1, -0.07, [0.06, 0]);
      return { hp: T.hp() };
    }"""),
    # In The Rings Turn: beams turning, a gold lock spot in view, and the beat coming.
    "rings": ((1280, 800), """() => {
      T.phase(1);
      T.place(-2.5, 13.5); T.step(0.5);
      for (let i = 0; i < 3; i++) T.cast('rings', { step: i });
      T.step(4);
      const id = T.cast('stillb'); T.until(id, 1, 0.7); T.heal(); T.step(0.1);
      return { hp: T.hp(), spots: T.spots() };
    }"""),
    # A phone held upright, the beat coming, a gold spot in view: white against gold.
    "phone": ((390, 844), """() => {
      T.phase(1);
      T.place(-1.5, 13.5); T.step(0.5);
      for (let i = 0; i < 3; i++) T.cast('rings', { step: i });
      T.step(4);
      const id = T.cast('stillb'); T.until(id, 1, 0.7); T.heal(); T.step(0.1);
      return { hp: T.hp(), spots: T.spots() };
    }"""),
    "phone-strike": ((390, 844), """() => {
      T.place(0.4, 14); T.step(0.5);
      const id = T.cast('still'); T.until(id, 1, 0.5); T.until(id, 1, -0.07, [0.06, 0]);
      return { hp: T.hp() };
    }"""),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5181)
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = [n for n in SCENES if not args.only or n in args.only.split(",")]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for name in names:
            (w, h), steps = SCENES[name]
            page = browser.new_page(viewport={"width": w, "height": h})
            logs = []
            page.on("pageerror", lambda e: logs.append(str(e)))
            page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
            page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
            print(name, page.evaluate(SETUP), page.evaluate(steps))
            page.wait_for_timeout(300)
            page.screenshot(path=str(out / f"heart-holdstill-{name}.jpg"), type="jpeg", quality=90)
            if logs:
                print("  page errors:", logs[:3])
            page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
