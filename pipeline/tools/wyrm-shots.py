"""
Pictures of the Eclipse Wyrm's fight from the game page, HUD and all (docs/bosses/wyrm-*.jpg): a headless browser as in
heart-room-shots.py, a raid started on /game with Kaia and moved on to its fourth boss, the brain held, each move cast by hand and
stepped to its moment, and the browser's own screenshot. `hall` is Noonfall's hall before the fourth fight, its gate up to the Roost
open.

    python pipeline/tools/wyrm-shots.py docs/bosses [--port 5198] [--only hall,breath] [--browser msedge]

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

HALL = """
async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  game.raid.start({ hero: 'Kaia' });
  await wait(1500);
  game.raid.stage = 3;
  game.raid.omens.list.length = 0;
  game.raid.upgrades.omens = [];
  game.raid.visit(null);
  await wait(6000);
  game.raid.hall.openGate?.();
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  const a = game.api.arena;
  a.caster.group.position.set(-4, 0, 3);
  await wait(2500);
  return 'hall';
}
"""

SETUP = """
async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  game.raid.start({ hero: 'Kaia' });
  await wait(1500);
  game.raid.stage = 3;
  game.raid.omens.list.length = 0;
  game.raid.upgrades.omens = [];
  game.raid.fight();
  const api = game.api, d = api.duel, a = api.arena;
  let t0 = Date.now();
  while (!(d.boss && d.boss.def.id === 'wyrm' && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await wait(200);
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
    "breath": ((1280, 800), """() => {
      T.place(2, 13.5);
      // Its fire glows where it will start (its left, the hero's right), then sweeps across.
      T.cast('breath', { x: 6, z: 11, dir: 0 });
      T.step(1.2);
      T.heal(); T.step(0.05);
      return 'breath';
    }"""),
    "breath-sweep": ((1280, 800), """() => {
      T.place(-6, 9);
      T.cast('breath', { x: 6, z: 11, dir: 0 });
      T.step(2.3);
      T.heal(); T.step(0.05);
      return 'sweep';
    }"""),
    "rake": ((1280, 800), """() => {
      T.place(1.2, 13);
      T.cast('rake', { dir: 0 });
      T.step(1.1);
      return 'rake';
    }"""),
    "tail": ((1280, 800), """() => {
      // Its back to the hero (it faces north, away from the camera): the sweep round its back, toward the hero.
      T.place(1.5, 12);
      T.face(Math.PI);
      T.cast('tail', { x: T.H.x, z: T.H.z, dir: Math.PI });
      T.step(1.0);
      return 'tail';
    }"""),
    "pin": ((1280, 800), """() => {
      T.place(4, 14);
      T.face(Math.PI);
      const id = T.cast('tail', { x: T.H.x, z: T.H.z, dir: Math.PI });
      T.step(0.05);
      const o = T.live(id).played.objectives[0];
      T.place(o.x + 0.2, o.z + 0.1);
      T.step(2.3);
      T.heal(); T.step(0.05);
      return 'pin';
    }"""),
    "shade": ((1280, 800), """() => {
      T.place(2.5, 9.6);
      T.cast('shade', { x: T.H.x, z: T.H.z });
      T.step(2.4);
      return 'shade';
    }"""),
    "stand": ((1280, 800), """() => {
      T.phase(1);
      T.step(3);
      T.place(0, 15, 1.5);
      T.cast('stand', { x: T.H.x, z: T.H.z });
      T.step(4.5);
      T.heal(); T.step(0.05);
      return 'stand';
    }"""),
    "rain": ((1280, 800), """() => {
      T.place(2, 13);
      T.cast('rain', { x: 2, z: 13 });
      T.step(0.9);
      T.cast('rain', { x: 4.5, z: 12, step: 1 });
      T.step(0.5);
      return 'rain';
    }"""),
    "roll": ((1280, 800), """() => {
      T.phase(2);
      T.step(3);
      T.place(3.2, 14);
      T.cast('roll', { x: 0, z: 18 });
      T.step(2.05);
      T.heal(); T.step(0.05);
      return 'roll';
    }"""),
    "phone": ((390, 844), """() => {
      T.place(2.5, 10, 1.6);
      T.cast('shade', { x: T.H.x, z: T.H.z });
      T.step(2.2);
      return 'phone';
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
    names = [n for n in ["hall", *SCENES] if not args.only or n in args.only.split(",")]
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
                size = (1280, 800) if name == "hall" else SCENES[name][0]
                page = browser.new_page(viewport={"width": size[0], "height": size[1]})
                logs = []
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.raid", timeout=60000)
                if name == "hall":
                    print(name, page.evaluate(HALL))
                else:
                    print(name, page.evaluate(SETUP), page.evaluate(SCENES[name][1]))
                page.wait_for_timeout(300)
                page.screenshot(path=str(out / f"wyrm-{name}.jpg"), type="jpeg", quality=88)
                if logs:
                    print("  errors:", logs[:3])
                page.close()
            browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    main()
