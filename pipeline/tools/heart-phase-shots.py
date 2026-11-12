"""
Pictures of what the Heart of Noon's party fight adds to its room, the Sunburst (docs/raid/heart-*.jpg): the floor that turns in its
second phase, the crust that falls in its last, Take the Blade and The Ring of Hands. From the game page, HUD and all, as
heart-room-shots.py takes its own (this uses its page set-up): a party of 39 partners placed by hand, the boss's brain held, each
move cast by hand and stepped to its moment, and the browser's own screenshot.

    python pipeline/tools/heart-phase-shots.py docs/raid [--port 5208] [--only rings,hands]

It uses the simulator's dev server on that port (no hot reload): one that is running is used and left alone, else it starts one
and stops it. Needs `pip install playwright` and Google Chrome.
"""
import argparse
import importlib.util
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("heart_room_shots", Path(__file__).with_name("heart-room-shots.py"))
room = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(room)

# What every scene here needs on top of the room's own helpers.
MORE = """
async () => {
  const { heartFight } = await import('/src/raid/heart.ts');
  const { burstFloor, turned } = await import('/src/arenas/sunburst.ts');
  T.heartFight = heartFight;
  T.burstFloor = burstFloor;
  /** A spot `r` m from the Heart at `deg` degrees from the south, toward the east. */
  T.polar = (deg, r) => [T.H.x + Math.sin((deg * Math.PI) / 180) * r, T.H.z + Math.cos((deg * Math.PI) / 180) * r];
  /** The floor turns, and has turned for `s` seconds past its warning. The partners on a ring are carried by hand, as their own screens would. */
  T.turn = (spots, s) => {
    const id = T.cast('turn');
    T.step(0.05);
    T.step(heartFight.warm + s);
    const ring = (x, z) => { const r = Math.hypot(x - T.H.x, z - T.H.z); return r < 6.9 || r >= 18 ? 0 : r < 12 ? burstFloor.mid : burstFloor.out; };
    T.party(spots.map(([x, z]) => { const q = turned(x, z, ring(x, z)); return [q.x, q.z]; }));
    return id;
  };
  /** The crust falls, on a floor at rest, and sectors `gone` are gone already. */
  T.crust = (gone = []) => {
    T.cast('crust', { x: 0, z: 0 });
    T.step(0.05);
    for (const k of gone) burstFloor.fall(k, true);
    T.step(0.1);
  };
  /** Where a party of forty stands once the crust falls: on the inner ring, on the spokes, in the rays `rays`. */
  T.ON_CRUST = (rays) => [
    ...T.group(0, 4.6, 0, 6, 1.4), ...T.group(4, 4.4, 0, 5, 1.4),
    ...[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].flatMap((deg, i) => [T.polar(deg, 9.5 + (i % 2)), T.polar(deg + 2, 13.5), T.polar(deg - 2, 15.8)]),
    ...rays.flatMap((k) => T.group(k, 23, 0, 2, 1.6)),
  ];
  return 1;
}
"""

# Each scene: a viewport, the band, and the steps that bring the fight to the moment of the picture.
SCENES = {
    # The floor turns, from far above (a look no player has): the seams, the arrowheads, the drawing turned off the rays, the beams against it.
    "rings": ((1280, 800), 40, """() => {
      T.phase(1);
      T.place(0, 12.6, 3.1); T.step(0.3);
      T.turn(T.AT_WORK(), 9.5);
      const ids = [0, 1, 2].map((i) => T.cast('rings', { step: i }));
      T.step(0.05);
      T.step(T.live(ids[0]).played.threats[0].at + 3.2);
      T.heal(); T.step(0.05);
      return { mid: +T.burstFloor.mid.toFixed(2), out: +T.burstFloor.out.toFixed(2) };
    }"""),
    # As it warns: the seams and the arrowheads light before anything moves.
    "rings-warn": ((1280, 800), 40, """() => {
      T.phase(1);
      T.party(T.AT_WORK());
      T.place(0, 12.6, 2.6); T.step(0.3);
      T.cast('turn'); T.step(3.3);
      return { mid: T.burstFloor.mid };
    }"""),
    # As a player sees it, standing on the outer ring.
    "rings-play": ((1280, 800), 40, """() => {
      T.phase(1);
      T.place(2.5, 22, 1.7); T.step(0.3);
      T.turn(T.AT_WORK(), 7);
      const ids = [0, 1, 2].map((i) => T.cast('rings', { step: i }));
      T.step(0.05);
      T.step(T.live(ids[0]).played.threats[0].at + 2.4);
      T.heal(); T.step(0.05);
      return { mid: +T.burstFloor.mid.toFixed(2) };
    }"""),
    # The crust falls, from far above: one sector gone, the next glowing along its cracks after the beat.
    "crust": ((1280, 800), 40, """() => {
      T.phase(2);
      T.crust([6]);
      T.party(T.ON_CRUST([0, 2, 3, 5, 7]));
      T.place(0, 12.6, 3.3); T.step(0.3);
      const id = T.cast('heartbeat', { x: 40, z: -2, dir: 0.2 }); T.step(1.2);
      for (let k = 0; k < 8; k++) T.done(id, k, 1);
      const at = T.live(id).played.threats[0].at;
      T.step(at + 6.2 - T.since(id));
      T.heal(); T.step(0.05);
      return { fallen: T.burstFloor.fallen, glow: +T.burstFloor.cracked(1).toFixed(2) };
    }"""),
    # A moment after a sector has gone: its slabs dropping into the sun.
    "crust-fall": ((1280, 800), 40, """() => {
      T.phase(2);
      T.crust([6]);
      T.party(T.ON_CRUST([0, 2, 3, 5, 7]));
      T.place(0, 12.6, 3.3); T.step(0.3);
      const id = T.cast('heartbeat', { x: 40, z: -2, dir: 0.2 }); T.step(1.2);
      for (let k = 0; k < 8; k++) T.done(id, k, 1);
      const fall = T.live(id).played.threats.find((th) => th.hits && th.at > 11);
      T.step(fall.at + 0.75 - T.since(id));
      T.heal(); T.step(0.02);
      return { fallen: T.burstFloor.fallen };
    }"""),
    # A long fight: five sectors gone, the party on the inner ring, the spokes and what is left.
    "crust-late": ((1280, 800), 40, """() => {
      T.phase(2);
      T.crust([1, 2, 5, 6, 7]);
      T.party(T.ON_CRUST([0, 3]));
      T.place(0, 12.6, 3.3); T.step(0.6);
      T.heal(); T.step(0.05);
      return { fallen: T.burstFloor.fallen };
    }"""),
    # As a player sees it: on a spoke, a pit to either side.
    "crust-play": ((1280, 800), 40, """() => {
      T.phase(2);
      T.crust([0, 7]);
      T.party(T.ON_CRUST([1, 2, 3, 5, 6]));
      const q = T.polar(-22.5, 13);
      T.place(q[0], q[1], 1.7); T.step(0.6);
      T.heal(); T.step(0.05);
      return { fallen: T.burstFloor.fallen };
    }"""),
    # Take the Blade, as a player sees it: a sun blade over this hero's head, a lance of light coming, a friend standing in it.
    "blade": ((1280, 800), 20, """() => {
      T.phase(1);
      T.party([...T.group(6, 7.5, 0, 4, 1.6), ...T.group(2, 7.5, 0, 4, 1.6), ...T.group(4, 9, 0, 3, 1.6), ...T.group(1, 21, 0, 3)]);
      T.place(-2, 19, 1.25); T.step(0.3);
      const id = T.cast('blade', { seed: 7 }); T.step(1.9);
      const o = T.live(id).played.objectives.filter((x) => x.part === 0 || x.part === 10).sort((p, q) => q.z - p.z)[0];
      T.place(o.x, o.z, 1.25); T.step(0.2);
      const me = [T.H.x + 9.5, T.H.z + 4.5], far = Math.hypot(me[0] - T.H.x, me[1] - T.H.z);
      const mid = [T.H.x + (me[0] - T.H.x) * (6.4 / far), T.H.z + (me[1] - T.H.z) * (6.4 / far)];
      T.place(me[0], me[1], 1.25);
      T.party([mid]);
      T.step(5);
      T.cast('blade', { seed: 7, step: 1, x: mid[0], z: mid[1], dir: Math.atan2(me[0] - T.H.x, me[1] - T.H.z) });
      T.step(1.0);
      T.heal(); T.step(0.02);
      return { carriers: [...T.heartFight.carriers] };
    }"""),
    # The same from above, both blades in sight: one over a hero's head, one still standing in the floor.
    "blade-far": ((1280, 800), 20, """() => {
      T.phase(1);
      T.party([...T.group(0, 6.5, 2, 5, 1.6), ...T.group(2, 7, 0, 4, 1.6), ...T.group(6, 8, 0, 4, 1.6), ...T.group(4, 9, 0, 3, 1.6), ...T.group(1, 21, 0, 3)]);
      T.place(-2, 16, 2.2); T.step(0.3);
      const id = T.cast('blade', { seed: 7 }); T.step(1.9);
      const o = T.live(id).played.objectives.filter((x) => x.part === 0 || x.part === 10).sort((p, q) => q.z - p.z)[0];
      T.place(o.x, o.z, 1.7); T.step(0.2);
      T.place(o.x * 1.5 - 3, T.H.z + (o.z - T.H.z) * 1.5 + 1.5, 1.7);
      T.step(4.5);
      T.heal(); T.step(0.02);
      return { carriers: [...T.heartFight.carriers] };
    }"""),
    # The Ring of Hands, from above: the raid on its gold spots round the Heart, one short.
    "hands": ((1280, 800), 40, """() => {
      T.phase(2);
      T.place(0, 13, 1.7); T.step(0.3);
      const id = T.cast('hands', { x: 40, z: 0 }); T.step(0.4);
      const spots = T.live(id).played.objectives, mine = [...spots].sort((p, q) => q.z - p.z)[0];
      T.party(spots.filter((o) => o !== mine).map((o) => [o.x, o.z]));
      T.place(mine.x, mine.z, 1.7);
      T.step(1.3);
      for (let i = 0, n = 0; i < 40 && n < 30; i++) if (spots[i] !== mine) { T.done(id, i, i + 1); n++; }
      T.step(4.5);
      T.heal(); T.step(0.05);
      return { spots: spots.length, mine: mine.done };
    }"""),
    # As a player sees it, in the ring.
    "hands-play": ((1280, 800), 40, """() => {
      T.phase(2);
      T.place(0, 13, 1.25); T.step(0.3);
      const id = T.cast('hands', { x: 40, z: 0 }); T.step(0.4);
      const spots = T.live(id).played.objectives, mine = [...spots].sort((p, q) => q.z - p.z)[0];
      T.party(spots.filter((o) => o !== mine).map((o) => [o.x, o.z]));
      T.place(mine.x, mine.z, 1.25);
      T.step(1.3);
      for (let i = 0, n = 0; i < 40 && n < 27; i++) if (spots[i] !== mine) { T.done(id, i, i + 1); n++; }
      T.step(4.5);
      T.heal(); T.step(0.05);
      return { spots: spots.length };
    }"""),
    # A phone held upright: on the outer ring as the floor turns.
    "phone-rings": ((390, 844), 40, """() => {
      T.phase(1);
      T.place(1.5, 21.5, 1.7); T.step(0.3);
      T.turn(T.AT_WORK(), 7);
      T.heal(); T.step(0.05);
      return { mid: +T.burstFloor.mid.toFixed(2) };
    }"""),
    # A phone: a sector glowing under the hero's feet, the one beside it gone.
    "phone-crust": ((390, 844), 40, """() => {
      T.phase(2);
      T.crust([7]);
      T.party(T.ON_CRUST([1, 2, 3, 5, 6]));
      const q = T.burstAt(0, 14.5, 1.5);
      T.place(q.x, q.z, 1.7); T.step(0.3);
      const id = T.cast('heartbeat', { x: 40, z: -1, dir: 0.2 }); T.step(1.2);
      for (let k = 0; k < 8; k++) T.done(id, k, 1);
      T.step(T.live(id).played.threats[0].at + 5.5 - T.since(id));
      T.heal(); T.step(0.05);
      return { fallen: T.burstFloor.fallen, glow: +T.burstFloor.cracked(0).toFixed(2) };
    }"""),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5208)
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = [n for n in SCENES if not args.only or n in args.only.split(",")]
    proc = None
    if not room.up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--config",
                                 str(ROOT / "pipeline" / "sim" / "vite.sim.config.ts"), "--port", str(args.port)],
                                cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if room.up(args.port):
                break
            time.sleep(0.5)
        else:
            proc.terminate()
            sys.exit("the dev server did not answer within 60 s")
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
            for name in names:
                (w, h), band, steps = SCENES[name]
                page = browser.new_page(viewport={"width": w, "height": h})
                logs = []
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
                page.evaluate(room.SETUP, band)
                page.evaluate(MORE)
                print(name, page.evaluate(steps))
                page.wait_for_timeout(300)
                page.screenshot(path=str(out / f"heart-{name}.jpg"), type="jpeg", quality=88)
                if logs:
                    print("  page errors:", logs[:3])
                page.close()
            browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    sys.exit(main())
