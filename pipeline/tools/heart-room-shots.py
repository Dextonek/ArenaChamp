"""
Pictures of the Sunburst, the Heart of Noon's room for a party, from the game page, HUD and all (docs/raid/heartroom-*.jpg):
a headless Chrome as in heart-holdstill-shots.py, a raid started on /game with Kaia, the Heart's fight started again as a
party's (39 partners placed about the room by hand, the boss's brain held), each move cast by hand and stepped to its
moment, and the browser's own screenshot.

    python pipeline/tools/heart-room-shots.py docs/raid [--port 5198] [--only overview,phone]

It uses the simulator's dev server on that port (no hot reload: pipeline/sim/vite.sim.config.ts): one that is running is
used and left alone, else it starts one and stops it. Needs `pip install playwright` and Google Chrome.
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
async (BAND) => {
  const { HEART_OF_NOON: def } = await import('/src/raid/heart.ts');
  const { LocalLink } = await import('/src/raid/link.ts');
  const { HERO_KITS } = await import('/src/heroes.ts');
  const { burstAt } = await import('/src/arenas/sunburst.ts');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  game.raid.start({ hero: 'Kaia' });
  await wait(1500);
  game.raid.stage = 2;
  // No omen in the pictures (Long Night darkens the screen).
  game.raid.omens.list.length = 0;
  game.raid.upgrades.omens = [];
  // The run's own fight is one hero's: make its room a party's, then start the fight again with the party in it.
  const fit = def.resize;
  def.resize = () => fit(BAND);
  game.raid.fight();
  const api = game.api, d = api.duel, a = api.arena;
  let t0 = Date.now();
  while (!(d.boss && d.boss.def.id === 'heart' && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await wait(200);
  const names = HERO_KITS.map((k) => k.name).filter((n) => n !== 'Kaia').slice(0, BAND - 1);
  d.holdStart = false;
  d.startBoss({ def, link: new LocalLink(def), seed: 'room', mode: 'play', band: BAND, name: 'Kaia', party: names.map((n, i) => ({ side: i + 1, kit: HERO_KITS.find((k) => k.name === n), name: n })) });
  await Promise.race([d.whenReady?.() ?? wait(4000), wait(60000)]);
  await wait(3000);
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
  window.T = {
    burstAt, H,
    step(s) {
      for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; api.step(1 / 60); }
      api.render();
    },
    /** This screen's hero, and how far back the camera stands (the game allows 0.55 to 1.7; more is for a look at the whole room). */
    place(x, z, zoom = 1.25) {
      a.caster.group.position.set(x, 0, z);
      api.heroMode.zoom = zoom;
      api.heroMode.snapCamera = true;
    },
    /** The partners, in order, at these spots, each looking at the Heart; the rest stay where they are. */
    party(spots) {
      const list = [...d.party.values()];
      spots.forEach(([x, z], i) => {
        const p = list[i];
        if (!p) return;
        p.enemy.group.position.set(x, 0, z);
        p.enemy.group.rotation.y = Math.atan2(H.x - x, H.z - z);
      });
    },
    /** A group of `n` round a spot `along` ray `k` and `lat` across it. */
    group(k, along, lat, n, spread = 1.5) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const q = burstAt(k, along + Math.sin(i * 2.4) * spread, lat + Math.cos(i * 2.4) * spread);
        out.push([q.x, q.z]);
      }
      return out;
    },
    cast(move, o = {}) {
      const c = { id: ++seq, move, step: o.step ?? 0, x: o.x ?? 0, z: o.z ?? 7, fx: 0, fz: 7, dir: o.dir ?? 0, seed: o.seed ?? 4242, target: 0 };
      d.boss.link.cast(c);
      return c.id;
    },
    live(id) { return d.boss.script.active.find((x) => x.cast.id === id); },
    since(id) { return d.boss.script.clock - this.live(id).began; },
    done(id, part, side = 1) { d.boss.script.done(id, part, side); },
    phase(i) { d.figure.setBodyPhase(i); },
    heal() { d.playerHp = d.playerMax; },
    hp() { return d.playerHp / d.playerMax; },
    count() { return { party: d.party.size, room: d.currentArena?.id, obstacles: a.obstacles.length }; },
    /** A spot `r` from the Heart in one of the lanes of flare `id`, the one nearest the camera. */
    lane(id, r) {
      const th = this.live(id).played.threats[0];
      for (const deg of [22.5, -22.5, 67.5, -67.5]) {
        const x = H.x + Math.sin((deg * Math.PI) / 180) * r, z = H.z + Math.cos((deg * Math.PI) / 180) * r;
        if (!th.hits(x, z, th.at + (r - 2) / 5.5)) return [x, z];
      }
      return [H.x, H.z + r];
    },
  };
  // Where a party of forty stands when it is at work: a dozen at the Heart, the rest out in the rays in threes and fours.
  window.T.AT_WORK = () => [
    ...T.group(0, 7.5, 0, 5, 2.4), ...T.group(2, 8, 0, 4, 2.2), ...T.group(5, 8.5, 0, 4, 2.2), ...T.group(7, 11, 2, 3, 1.8),
    ...T.group(1, 22, -2, 4), ...T.group(2, 28, 2.5, 3), ...T.group(3, 21, -1, 3), ...T.group(4, 26, 0, 3),
    ...T.group(5, 30, -2, 3), ...T.group(6, 24, 1, 4), ...T.group(7, 27, -1.5, 3),
  ];
  return window.T.count();
}
"""

# Each scene: a name, a viewport, the band, and the steps (JS, run after SETUP) that bring the fight to the moment of the picture.
SCENES = {
    # The whole room from far above (a look no player has: the game's camera stops at 1.7): the sun, the party spread through it.
    "overview": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.place(0, 9.5, 4.6); T.step(0.6);
      return T.count();
    }"""),
    # As a player sees it, at the Heart in the well.
    "play": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.place(2.5, 17.5, 1.25); T.step(0.6);
      return T.count();
    }"""),
    # The way in: the party at the gate, at the far end of the south ray, as the fight begins.
    "gate": ((1280, 800), 40, """() => {
      T.step(0.6);
      return T.count();
    }"""),
    # Out in a ray, with the camera as far back as the game lets it go: the bay, its walls, the fallen armillary's piece.
    "ray": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      const q = T.burstAt(2, 25.5, -1.5);
      T.place(q.x, q.z, 1.7); T.step(0.6);
      return T.count();
    }"""),
    # Solar Flare: three rings running out, a gap in every ray.
    "flare": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.place(0, 12, 3.1); T.step(0.4);
      const id = T.cast('flare'); T.step(0.05);
      const th = T.live(id).played.threats, at = T.lane(id, 7);
      T.place(at[0], at[1], 3.1);
      T.step(th[2].at + 1.1 - T.since(id));
      return { rings: th.length, hp: T.hp() };
    }"""),
    # The same as a player sees it, from the mouth of the south ray.
    "flare-play": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.place(1.2, 23.5, 1.7); T.step(0.4);
      const id = T.cast('flare'); T.step(0.05);
      const th = T.live(id).played.threats, at = T.lane(id, 15.5);
      T.place(at[0], at[1], 1.7);
      T.step(th[1].at + 1.6 - T.since(id));
      return { rings: th.length, hp: T.hp() };
    }"""),
    # The Rings Turn: the beams run to the walls, one stopped at the fallen armillary's piece; a ring's row of gold spots down a ray.
    "beams": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.phase(1);
      T.place(0, 12, 3.1); T.step(0.4);
      const ids = [0, 1, 2].map((i) => T.cast('rings', { step: i }));
      T.step(0.05);
      const th = T.live(ids[0]).played.threats[0];
      T.step(th.at + 4.2);
      T.heal(); T.step(0.05);
      return { spots: ids.map((id) => T.live(id).played.objectives.length) };
    }"""),
    # The same from inside the ray whose spots lock ring A: one held, three to go.
    "lock": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.phase(1);
      const ids = [0, 1, 2].map((i) => T.cast('rings', { step: i }));
      T.step(0.05);
      const row = T.live(ids[0]).played.objectives, th = T.live(ids[0]).played.threats[0];
      const k = Math.round(((Math.atan2(row[0].x - T.H.x, row[0].z - T.H.z) * 180) / Math.PI + 360) / 45) % 8;
      T.party([[row[1].x, row[1].z], [row[2].x + 0.3, row[2].z], ...T.group(k, 20.5, -2.2, 2, 0.8)]);
      T.place(row[0].x, row[0].z + 0.2, 1.7);
      T.step(th.at + 0.4);
      T.done(ids[0], 0, 0);
      T.step(1.6);
      T.heal(); T.step(0.05);
      return { row: row.length, ray: k };
    }"""),
    # Heartbeat: eight plates, some raised; the floor turns orange, and only the pockets behind raised plates are gold.
    "plates": ((1280, 800), 40, """() => {
      T.phase(2);
      const id = T.cast('heartbeat', { dir: 0.2 }); T.step(1.2);
      const pl = T.live(id).played.objectives, at = T.live(id).played.threats[0].at;
      const behind = (o, n) => { const a = Math.atan2(o.x - T.H.x, o.z - T.H.z), out = []; for (let i = 0; i < n; i++) { const r = 13.6 + (i % 3) * 1.25, s = ((i % 2) - 0.5) * (0.9 + i * 0.12); out.push([T.H.x + Math.sin(a) * r + Math.cos(a) * s, T.H.z + Math.cos(a) * r - Math.sin(a) * s]); } return out; };
      T.party([...behind(pl[0], 4), ...behind(pl[1], 5), ...behind(pl[7], 5), ...behind(pl[2], 5), ...behind(pl[6], 5), ...T.group(4, 9, 0, 6, 2.5), ...T.group(3, 20, 0, 4), ...T.group(5, 21, 0, 5)]);
      for (const k of [0, 1, 7, 2, 6]) T.done(id, k, 1);
      T.place(pl[0].x + 0.4, pl[0].z + 0.9, 1.7);
      T.step(at - 1.3 - T.since(id));
      return { plates: pl.length };
    }"""),
    # The beat itself, a moment after it lands, five plates up: one flash, one ring, the plates still standing.
    "beat": ((1280, 800), 40, """() => {
      T.phase(2);
      const id = T.cast('heartbeat', { dir: 0.2 }); T.step(1.2);
      const pl = T.live(id).played.objectives, at = T.live(id).played.threats[0].at;
      const behind = (o, n) => { const a = Math.atan2(o.x - T.H.x, o.z - T.H.z), out = []; for (let i = 0; i < n; i++) { const r = 13.6 + (i % 3) * 1.25, s = ((i % 2) - 0.5) * (0.9 + i * 0.12); out.push([T.H.x + Math.sin(a) * r + Math.cos(a) * s, T.H.z + Math.cos(a) * r - Math.sin(a) * s]); } return out; };
      T.party([...behind(pl[0], 4), ...behind(pl[1], 5), ...behind(pl[7], 7), ...behind(pl[2], 5), ...behind(pl[6], 5), ...T.group(4, 9, 0, 6, 2.5), ...T.group(3, 20, 0, 3), ...T.group(5, 21, 0, 4)]);
      for (const k of [0, 1, 7, 2, 6]) T.done(id, k, 1);
      T.place(pl[0].x + 0.4, pl[0].z + 0.9, 1.7);
      T.step(at + 0.14 - T.since(id));
      return { plates: pl.length, hp: T.hp() };
    }"""),
    # The same from far above: where the eight plates fall, in front of the eight spurs.
    "plates-far": ((1280, 800), 40, """() => {
      T.phase(2);
      T.party(T.AT_WORK());
      const id = T.cast('heartbeat', { dir: 0.2 }); T.step(1.2);
      const pl = T.live(id).played.objectives, at = T.live(id).played.threats[0].at;
      for (const k of [0, 1, 2, 4, 6, 7]) T.done(id, k, 1);
      T.place(0, 10, 2.6);
      T.step(at - 1.3 - T.since(id));
      return { plates: pl.length };
    }"""),
    # The Crown of Rays: down four rays, then the four between.
    "crown": ((1280, 800), 40, """() => {
      T.party(T.AT_WORK());
      T.phase(2);
      T.place(0, 12, 3.1); T.step(0.4);
      const id = T.cast('corona', { dir: 0 }); T.step(0.05);
      T.step(T.live(id).played.threats[0].at - 0.25 - T.since(id));
      return { rays: T.live(id).played.threats.length };
    }"""),
    # A phone held upright: the Heart's flare from the well.
    "phone": ((390, 844), 40, """() => {
      T.party(T.AT_WORK());
      T.place(0.6, 17.2, 1.7); T.step(0.4);
      const id = T.cast('flare'); T.step(0.05);
      const th = T.live(id).played.threats, at = T.lane(id, 10.5);
      T.place(at[0], at[1], 1.7);
      T.step(th[1].at + 0.9 - T.since(id));
      return { rings: th.length, hp: T.hp() };
    }"""),
    # A phone, out in a ray at a ring's row of gold spots.
    "phone-lock": ((390, 844), 10, """() => {
      T.phase(1);
      const ids = [0, 1, 2].map((i) => T.cast('rings', { step: i }));
      T.step(0.05);
      const row = T.live(ids[0]).played.objectives, th = T.live(ids[0]).played.threats[0];
      T.place(row[0].x + 0.3, row[0].z + 2.6, 1.7);
      T.step(th.at + 3);
      T.heal(); T.step(0.05);
      return { row: row.length };
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
                (w, h), band, steps = SCENES[name]
                page = browser.new_page(viewport={"width": w, "height": h})
                logs = []
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.goto(f"http://localhost:{args.port}/game", wait_until="load", timeout=120000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
                print(name, page.evaluate(SETUP, band), page.evaluate(steps))
                page.wait_for_timeout(300)
                page.screenshot(path=str(out / f"heartroom-{name}.jpg"), type="jpeg", quality=88)
                if logs:
                    print("  page errors:", logs[:3])
                page.close()
            browser.close()
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    sys.exit(main())
