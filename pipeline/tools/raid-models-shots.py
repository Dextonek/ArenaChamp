"""
Pictures of the Raid's fight models in their fights, from the game page, HUD and all (docs/raid/models/fight-*.jpg; the user,
2026-11-19: "lets make more models for the raid too"): the stages' adds (the Hour Stones, the Coal Hearts, the Cast shades) and the
fights' objects (the falling sun-stones, the sun shards, Ash's cinder rocks, the Heart's crust plates). A raid started on /game with
Kaia and moved on to the boss of each scene, the brain held, the move cast by hand and stepped to its moment, and the browser's own
screenshot. Made from wyrm-shots.py.

    python pipeline/tools/raid-models-shots.py docs/raid/models [--port 5198] [--only hour,noon] [--browser msedge]

It uses the simulator's dev server on that port (no hot reload: pipeline/sim/vite.sim.config.ts): one that is running is
used and left alone, else it starts one and stops it. Needs `pip install playwright` and Chrome or Edge.
"""
import argparse
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

SETUP = """
async ([stage, boss]) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  game.raid.start({ hero: 'Kaia' });
  await wait(1500);
  game.raid.stage = stage;
  game.raid.omens.list.length = 0;
  game.raid.upgrades.omens = [];
  game.raid.fight();
  const api = game.api, d = api.duel, a = api.arena;
  let t0 = Date.now();
  while (!(d.boss && d.boss.def.id === boss && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await wait(200);
  await wait(2500);
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
  const H = { x: 0, z: 7 };
  a.placeFoe(d.foe, new V(H.x, 0, H.z));
  window.T = {
    H,
    step(s) {
      for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); }
      api.render();
    },
    place(x, z, zoom = 1.2) {
      a.caster.group.position.set(x, 0, z);
      api.heroMode.zoom = zoom;
      api.heroMode.snapCamera = true;
    },
    /** The boss, turned to face yaw `dir`. */
    face(dir) { d.foe.group.rotation.y = dir; },
    cast(move, o = {}) {
      const me = a.caster.group.position, x = o.x ?? me.x, z = o.z ?? me.z;
      const c = { id: ++seq, move, step: o.step ?? 0, x, z, fx: H.x, fz: H.z, dir: o.dir ?? Math.atan2(x - H.x, z - H.z), seed: o.seed ?? 4242, target: 0 };
      d.boss.link.cast(c);
      return c.id;
    },
    live(id) { return d.boss.script.active.find((x) => x.cast.id === id); },
    heal() { d.playerHp = d.playerMax; },
    phase(i) { d.boss.link.on.phase(i); },
  };
  T.place(1.5, 15);
  // What the brain cast before it was held plays out first.
  T.step(5);
  T.heal();
  return 'ready';
}
"""

# (viewport, steps): each scene runs in a fresh page after SETUP.
SCENES = {
    # The Sun Warden (stage 0): his stage's Hour Stones, Pillar Fall's sun-stones, Gathering Noon's shards.
    "hour": ((1280, 800), 0, "sun", """() => {
      T.phase(2);
      T.step(3);
      T.place(0, 15, 1.5);
      T.cast('hour', { x: T.H.x, z: T.H.z - 2.4 });
      T.step(5);
      T.heal(); T.step(0.05);
      return 'hour';
    }"""),
    "pillars": ((1280, 800), 0, "sun", """() => {
      T.place(2.5, 13.5, 1.3);
      T.cast('pillars', { x: 1, z: 12 });
      T.step(0.7);
      T.cast('pillars', { x: 3.5, z: 13, step: 1 });
      T.step(0.7);
      T.cast('pillars', { x: -1.5, z: 14, step: 2 });
      T.step(2.6);
      T.heal(); T.step(0.05);
      return 'pillars';
    }"""),
    "noon": ((1280, 800), 0, "sun", """() => {
      T.phase(1);
      T.step(3);
      T.place(4, 12, 1.4);
      T.cast('noon', { x: T.H.x, z: T.H.z });
      T.step(3.5);
      T.heal(); T.step(0.05);
      return 'noon';
    }"""),
    # Ash and Ember (stage 1): their stage's Coal Hearts and Ash's cinder rocks.
    "eruption": ((1280, 800), 1, "ash", """() => {
      T.phase(2);
      T.step(3);
      T.place(0, 15, 1.5);
      T.cast('eruption', { x: T.H.x, z: T.H.z });
      T.step(5);
      T.heal(); T.step(0.05);
      return 'eruption';
    }"""),
    "rock": ((1280, 800), 1, "ash", """() => {
      T.place(2, 13, 1.3);
      T.cast('rock', { x: 1, z: 12 });
      T.step(0.9);
      T.cast('rock', { x: 3.5, z: 13.5, step: 1 });
      T.step(2.2);
      T.heal(); T.step(0.05);
      return 'rock';
    }"""),
    # The Heart (stage 2): the crust plates its Heartbeat throws.
    "plates": ((1280, 800), 2, "heart", """() => {
      T.phase(2);
      T.step(3);
      T.place(0, 14.5, 1.4);
      T.cast('heartbeat', { x: T.H.x, z: T.H.z });
      T.step(4);
      T.heal(); T.step(0.05);
      return 'plates';
    }"""),
    # The Eclipse Wyrm (stage 3): its stage's Cast shades.
    "stand": ((1280, 800), 3, "wyrm", """() => {
      T.phase(1);
      T.step(3);
      T.place(0, 15, 1.5);
      T.cast('stand', { x: T.H.x, z: T.H.z });
      T.step(4.5);
      T.heal(); T.step(0.05);
      return 'stand';
    }"""),
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
    ap.add_argument("--port", type=int, default=5198)
    ap.add_argument("--only", default="")
    ap.add_argument("--browser", default="chrome", help="chrome or msedge")
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
            browser = pw.chromium.launch(channel=args.browser, headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
            for name in names:
                size, stage, boss, steps = SCENES[name]
                page = browser.new_page(viewport={"width": size[0], "height": size[1]})
                logs = []
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.raid", timeout=60000)
                print(name, page.evaluate(SETUP, [stage, boss]), page.evaluate(steps))
                page.wait_for_timeout(300)
                page.screenshot(path=str(out / f"fight-{name}.jpg"), type="jpeg", quality=88)
                if logs:
                    print("  errors:", logs[:3])
                page.close()
            browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    main()
