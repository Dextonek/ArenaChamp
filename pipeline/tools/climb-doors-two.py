"""
The Climb's open world, stage 3 (doors together): the two-tab test. Two real tabs (two separate headless Chrome sessions) on the local
dev server, each signed in with a new throwaway account made in the page (its password made by `crypto.randomUUID()` in the page,
never printed or kept here: the accounts land in the git-ignored server/data/; names start with v5bot).

    python -I pipeline/tools/climb-doors-two.py <out folder> [--port 5267] [--floor 1] [--floor2 2]

Run 1 (floor --floor): both climb the floor, the lair's door is opened on both, A walks in (the door is held: pictures of A's line and
B's invitation), B walks in, the ruler's fight starts on both. Both heroes fight with the game's autopilot. Every 100 ms each screen
notes the ruler's place and health, its own hero's place, where it draws the other, who runs the brain, and the casts it plays. B's
hero is struck down and A gets it up. A's page is frozen for 5.5 s (a tab put away): the brain goes to B, and comes back to nobody
when A wakes (A follows again). Then both screens add damage through the hub until the ruler falls; both come out in front of the door,
in the same shard, the lair won on both runs.
Run 2 (floor --floor2): the same up to the fight, then A's tab is closed mid-fight: B takes the brain over and wins alone.
--drop (floor --floor alone): the same up to the fight, then both pages' connections drop (their sockets are closed, as a deploy
drops them): both must come out in front of the door with nothing counted and no life lost. Writes drop.json and drop-*.jpg instead.

It starts its own dev server on --port with the hero shop off and stops it by its PID (one already there is used and left alone).
Writes run.json and the pictures into the out folder, and prints a summary.
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

HELPER = r"""
(() => {
  if (window._d3) return;
  const S = window._d3 = { samples: [], errors: [], dealt: 0, boost: 0, hooked: null, casts: {} };
  const oe = console.error;
  console.error = (...a) => { if (S.errors.length < 30) S.errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); oe(...a); };
  window.addEventListener('error', (e) => { if (S.errors.length < 30) S.errors.push('ERR ' + String(e.error?.stack ?? e.message).slice(0, 400)); });
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important;transition:none!important}';
  document.head.append(st);
  setInterval(() => {
    const api = window.game?.api, d = api?.duel, g = window._worldGame;
    if (!d) return;
    const b = d.boss;
    if (b && S.hooked !== b) {
      // This screen's own hits on the ruler (not the test's added damage, which goes to the hub directly).
      S.hooked = b;
      const L = b.link, f = L.damage.bind(L);
      L.damage = (a) => { S.dealt += a; f(a); };
    }
    if (b && !d.autopilot && g?.piece && S.pilot !== false) d.autopilot = true;
    const live = b && !d.waiting && d.countdown < 0 && !d.isOver;
    if (live && S.boost > 0) window.game.net.send({ t: 'boss_damage', amount: Math.round(S.boost / 10) });
    if (!b || !g?.piece) return;
    const me = api.arena.caster.group.position, foe = d.bossFigure?.group.position;
    for (const x of b.script?.active ?? []) S.casts[x.cast.id] ??= { move: x.cast.move, at: Date.now() };
    S.samples.push({
      t: Date.now(), live: !!live, brain: !!b.link.brain, side: b.link.side, me: [+me.x.toFixed(3), +me.z.toFixed(3)], down: d.heroHp <= 0,
      boss: foe ? [+foe.x.toFixed(3), +foe.z.toFixed(3)] : null, hp: d.foe ? Math.round(api.arena.hpOf(d.foe)) : null, max: b.link.maxHp,
      party: [...d.party].map(([side, p]) => [side, +p.pos.x.toFixed(3), +p.pos.z.toFixed(3), !!p.down]),
      phase: b.stats.phases, active: (b.script?.active ?? []).map((x) => x.cast.id),
    });
    if (S.samples.length > 6000) S.samples.splice(0, 1000);
  }, 100);
})();
"""

STATE = """() => {
  const g = window._worldGame, d = window.game.api.duel, p = g?.presence, run = g?.run;
  const me = window.game.api.arena.caster.group.position;
  return { zone: !!g?.zone, piece: g?.piece ?? null, you: p?.you ?? 0, shard: p?.shard ?? '', others: g?.others.count ?? 0,
    asking: g?.asking ? { held: g.asking.held, names: g.asking.names, first: g.asking.first } : null, invite: g?.invite ? g.invite.door : null,
    boss: !!d.boss, live: !!d.boss && !d.waiting && d.countdown < 0 && !d.isOver, over: !!d.isOver, hp: d.heroHp, max: d.heroMax,
    brain: d.boss ? !!d.boss.link.brain : null, me: [me.x, me.z], won: run ? [...run.won] : [], shards: run?.shards ?? 0, lives: run?.lives ?? 0,
    log: g ? g.log.slice(-6) : [], fightLog: g?.together ? g.together.log.slice(-12) : [], errors: window._d3?.errors ?? [],
    dealt: window._d3 ? Math.round(window._d3.dealt) : 0, finished: !!g?.finished };
}"""


def up(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


async def wait_for(pg, js, seconds, what):
    t0 = time.time()
    while time.time() - t0 < seconds:
        try:
            if await pg.evaluate(js):
                return True
        except Exception:
            pass
        await asyncio.sleep(0.25)
    print(f"      timed out ({seconds} s): {what}")
    return False


async def shot(pg, path):
    await pg.screenshot(path=str(path), type="jpeg", quality=82)
    print(f"      picture {path.name}")


async def tab(browser, port, size):
    ctx = await browser.new_context(viewport={"width": size[0], "height": size[1]})
    pg = await ctx.new_page()
    await pg.goto(f"http://localhost:{port}/game", wait_until="load", timeout=120000)
    await pg.wait_for_function("!!window.game && window.game.state.connected", timeout=90000)
    await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); }")
    await pg.evaluate(HELPER)
    return ctx, pg


async def climb(pg, hero, floor):
    await pg.evaluate(f"() => window.game.world.start({{ hero: '{hero}', floor: {floor}, resume: false }})")
    await wait_for(pg, "() => !!window._worldGame?.zone && window._worldGame.presence?.you > 0", 120, f"{hero} on floor {floor}")


async def to_door(a, b, out, tag):
    """Both stand before the lair (opened on both), A walks in, then B: the shared fight starts. Returns the door."""
    door = None
    for pg in (a, b):
        door = await pg.evaluate("""() => { const g = window._worldGame, d = g.floor.doors.find((x) => x.id === 'lair');
          if (!g.run.opened.includes('lair')) g.zone.ctx.openDoor('lair'); const f = g.inFront(d); return { at: d.at, r: d.r, front: f, name: d.name }; }""")
    f = door["front"]
    await a.evaluate(f"() => window._world_go({f['x'] + 1.2}, {f['z']})")
    await b.evaluate(f"() => window._world_go({f['x'] - 1.6}, {f['z'] + 0.8})")
    await wait_for(a, "() => window._worldGame.others.count > 0", 20, "A sees B")
    await asyncio.sleep(1.5)
    await a.evaluate(f"() => window._world_go({door['at']['x']}, {door['at']['z']})")
    held = await wait_for(a, "() => !!window._worldGame.asking?.held", 10, "the door held on A")
    await wait_for(b, "() => !!window._worldGame.invite", 5, "B's invitation")
    await asyncio.sleep(0.6)
    if held:
        await shot(a, out / f"{tag}a-door-held.jpg")
        await shot(b, out / f"{tag}b-invited.jpg")
    t_in = time.time()
    await b.evaluate(f"() => window._world_go({door['at']['x'] + 0.3}, {door['at']['z']})")
    ok = all([await wait_for(pg, "() => window._worldGame.piece === 'ruler' && !!window.game.api.duel.boss", 30, "the shared fight") for pg in (a, b)])
    ok = ok and all([await wait_for(pg, "() => { const d = window.game.api.duel; return !!d.boss && !d.waiting && d.countdown < 0; }", 60, "the countdown") for pg in (a, b)])
    return door, ok, round(time.time() - t_in, 2), held


def nearest(samples, t, within=60):
    best = None
    for s in samples:
        if abs(s["t"] - t) <= within and (best is None or abs(s["t"] - t) < abs(best["t"] - t)):
            best = s
    return best


def pct(values, q):
    if not values:
        return None
    v = sorted(values)
    return round(v[min(len(v) - 1, int(q * (len(v) - 1) + 0.5))], 3)


def agree(sa, sb, since=0, until=1e18):
    """How the two screens agree: the ruler's place (the follower against the brain, raw and 100 ms back), each hero where the other
    draws it against where its own screen has it (raw and 100 ms back), the ruler's health share."""
    boss_raw, boss_late, hero_raw, hero_late, hp = [], [], [], [], []
    pairs = 0
    for x in sa:
        if not (since <= x["t"] <= until) or not x["live"]:
            continue
        y = nearest(sb, x["t"], 50)
        if not y or not y["live"]:
            continue
        pairs += 1
        if x["boss"] and y["boss"] and x["brain"] != y["brain"]:
            brain, follow = (x, y) if x["brain"] else (y, x)
            boss_raw.append(((brain["boss"][0] - follow["boss"][0]) ** 2 + (brain["boss"][1] - follow["boss"][1]) ** 2) ** 0.5)
            back = nearest(sb if brain is y else sa, follow["t"] - 100, 50)
            if back and back["boss"]:
                boss_late.append(((back["boss"][0] - follow["boss"][0]) ** 2 + (back["boss"][1] - follow["boss"][1]) ** 2) ** 0.5)
        for own, other, other_list in ((x, y, sb), (y, x, sa)):
            for side, px, pz, down in other["party"]:
                if side != own["side"] or own["down"]:
                    continue
                hero_raw.append(((own["me"][0] - px) ** 2 + (own["me"][1] - pz) ** 2) ** 0.5)
                own_list = sa if own is x else sb
                back = nearest(own_list, other["t"] - 100, 50)
                if back:
                    hero_late.append(((back["me"][0] - px) ** 2 + (back["me"][1] - pz) ** 2) ** 0.5)
        if x["hp"] is not None and y["hp"] is not None and x["max"]:
            hp.append(abs(x["hp"] - y["hp"]) / x["max"])
    stat = lambda v: {"n": len(v), "median": pct(v, 0.5), "p95": pct(v, 0.95), "max": round(max(v), 3) if v else None}
    return {"pairs": pairs, "boss_raw_m": stat(boss_raw), "boss_100ms_back_m": stat(boss_late), "hero_raw_m": stat(hero_raw),
            "hero_100ms_back_m": stat(hero_late), "hp_share_apart": stat(hp)}


async def run(args):
    from playwright.async_api import async_playwright
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    proc = None
    if not up(args.port):
        proc = subprocess.Popen(["node", str(ROOT / "node_modules" / "vite" / "bin" / "vite.js"), "--port", str(args.port), "--strictPort"], cwd=ROOT,
                                env={**os.environ, "SHOP": "off"}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(120):
            if up(args.port):
                break
            time.sleep(0.5)
    report = {"floor": args.floor, "floor2": args.floor2}
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist", "--disable-renderer-backgrounding",
                                                                     "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
            size = (args.width, args.height)
            (ca, a), (cb, b) = await tab(browser, args.port, size), await tab(browser, args.port, size)
            go = "() => { window._world_go = (x, z) => { const api = window.game.api, h = api.arena.caster.group.position; h.set(x, 0, z); api.heroMode.halt(); api.heroMode.snapCameraNow(); }; }"
            for pg in (a, b):
                await pg.evaluate(go)

            if args.drop:
                print(f"drop: floor {args.floor}")
                await climb(a, "Kaia", args.floor)
                await climb(b, "Lyra", args.floor)
                before = {"a": await a.evaluate(STATE), "b": await b.evaluate(STATE)}
                door, ok, took, held = await to_door(a, b, out, "drop-")
                report["drop_started"] = ok
                await asyncio.sleep(6)
                await asyncio.gather(shot(a, out / "drop-a-fight.jpg"), shot(b, out / "drop-b-fight.jpg"))
                for pg in (a, b):
                    await pg.evaluate("() => window.game.net.ws?.close()")
                back = all([await wait_for(pg, "() => !!window._worldGame.zone && window._worldGame.piece === null", 30, "back on the floor after the drop") for pg in (a, b)])
                await asyncio.sleep(3)
                after = {"a": await a.evaluate(STATE), "b": await b.evaluate(STATE)}
                await asyncio.gather(shot(a, out / "drop-a-out.jpg"), shot(b, out / "drop-b-out.jpg"))
                report["drop"] = {"back": back, "before": {k: {f: v[f] for f in ("won", "shards", "lives")} for k, v in before.items()},
                                  "after": {k: {f: v[f] for f in ("won", "shards", "lives", "me", "log", "fightLog", "errors", "shard", "others")} for k, v in after.items()}}
                (out / "drop.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf8")
                print(json.dumps(report["drop"], indent=1, default=str)[:4000])
                await browser.close()
                return

            # --- run 1 -----------------------------------------------------------------------------------------------------
            print(f"run 1: floor {args.floor}")
            await climb(a, "Kaia", args.floor)
            await climb(b, "Lyra", args.floor)
            sa0, sb0 = await a.evaluate(STATE), await b.evaluate(STATE)
            report["run1_start"] = {"a": {k: sa0[k] for k in ("shard", "you", "won", "shards", "lives")}, "b": {k: sb0[k] for k in ("shard", "you", "won", "shards", "lives")}}
            door, ok, took, held = await to_door(a, b, out, "")
            report["door"] = door
            report["run1_held"] = held
            report["run1_started"] = ok
            report["run1_start_s"] = took
            print(f"      fight started on both: {ok} ({took} s after B walked in)")
            if not ok:
                report["a"], report["b"] = await a.evaluate(STATE), await b.evaluate(STATE)
                raise RuntimeError("the shared fight did not start")
            report["run1_fight"] = {"a": await a.evaluate(STATE), "b": await b.evaluate(STATE)}
            t_fight = time.time() * 1000
            # Pictures with a red zone on both screens: the same cast playing on both.
            zone_shot = False
            for _ in range(80):
                ida = set(await a.evaluate("() => (window.game.api.duel.boss?.script?.active ?? []).filter((x) => x.cast.move !== 'floor').map((x) => x.cast.id)"))
                idb = set(await b.evaluate("() => (window.game.api.duel.boss?.script?.active ?? []).filter((x) => x.cast.move !== 'floor').map((x) => x.cast.id)"))
                if ida & idb:
                    await asyncio.sleep(0.35)
                    await asyncio.gather(shot(a, out / "a-fight-zone.jpg"), shot(b, out / "b-fight-zone.jpg"))
                    zone_shot = True
                    break
                await asyncio.sleep(0.25)
            report["zone_shot"] = zone_shot
            await asyncio.sleep(4)
            await asyncio.gather(shot(a, out / "a-fight.jpg"), shot(b, out / "b-fight.jpg"))

            # The fall and the revive: B's hero is struck down; A (not the autopilot: it walks to the fallen) stands by it.
            await b.evaluate("() => { window._d3.pilot = false; const d = window.game.api.duel; d.autopilot = false; d.setPlayerHp(0); }")
            await wait_for(a, "() => [...window.game.api.duel.party.values()].some((p) => p.down)", 10, "A sees B down")
            await asyncio.sleep(0.8)
            await asyncio.gather(shot(a, out / "a-partner-down.jpg"), shot(b, out / "b-down.jpg"))
            t_down = time.time()
            revived = await wait_for(b, "() => window.game.api.duel.heroHp > 0", 25, "B got up by A's autopilot")
            if not revived:
                bpos = await a.evaluate("() => { const p = [...window.game.api.duel.party.values()][0]; return [p.pos.x, p.pos.z]; }")
                await a.evaluate(f"() => {{ window._d3.pilot = false; window.game.api.duel.autopilot = false; window._world_go({bpos[0] + 0.8}, {bpos[1]}); }}")
                revived = await wait_for(b, "() => window.game.api.duel.heroHp > 0", 12, "B got up (A placed beside it)")
                report["revive_by"] = "A placed beside B"
            else:
                report["revive_by"] = "A's autopilot"
            report["revived"] = revived
            report["revive_s"] = round(time.time() - t_down, 1)
            await asyncio.sleep(0.6)
            await shot(b, out / "b-revived.jpg")
            for pg in (a, b):
                await pg.evaluate("() => { window._d3.pilot = true; }")

            # The brain's tab goes quiet for 5.5 s (frozen): the hub gives the brain to B; A follows again when it wakes.
            before = await b.evaluate(STATE)
            t_quiet = time.time() * 1000
            freeze = asyncio.create_task(a.evaluate("() => { const t = Date.now() + 5500; while (Date.now() < t) {} return 1; }"))
            took_over = await wait_for(b, "() => !!window.game.api.duel.boss?.link.brain", 9, "B takes the brain from a quiet A")
            t_took = time.time() * 1000
            await freeze
            await asyncio.sleep(1.5)
            sa_now, sb_now = await a.evaluate(STATE), await b.evaluate(STATE)
            report["quiet"] = {"b_brain_before": before["brain"], "b_took_over": took_over, "after_ms": round(t_took - t_quiet), "a_brain_after": sa_now["brain"],
                               "b_brain_after": sb_now["brain"], "a_log": sa_now["fightLog"], "b_log": sb_now["fightLog"]}
            await shot(b, out / "b-runs-brain.jpg")
            await asyncio.sleep(3)

            # The rest of the fight: both add damage through the hub (the autopilots fight on) until the ruler falls.
            for pg in (a, b):
                await pg.evaluate("() => { window._d3.boost = 400; }")
            t_end0 = time.time()
            ended = all([await wait_for(pg, "() => (window._worldGame.together?.log ?? []).some((l) => l.includes('door_end'))", 90, "the ruler falls") for pg in (a, b)])
            await asyncio.sleep(0.5)
            await asyncio.gather(shot(a, out / "a-ruler-falls.jpg"), shot(b, out / "b-ruler-falls.jpg"))
            for pg in (a, b):
                await pg.evaluate("() => { window._d3.boost = 0; }")
            report["run1_ended"] = ended
            report["run1_end_s"] = round(time.time() - t_end0, 1)
            back = all([await wait_for(pg, "() => !!window._worldGame.zone && window._worldGame.piece === null && window._worldGame.others.count > 0", 40, "back on the floor") for pg in (a, b)])
            await asyncio.sleep(2.5)
            sa1, sb1 = await a.evaluate(STATE), await b.evaluate(STATE)
            report["run1_out"] = {"back": back, "a": sa1, "b": sb1}
            await asyncio.gather(shot(a, out / "a-out-together.jpg"), shot(b, out / "b-out-together.jpg"))
            samples_a = await a.evaluate("() => window._d3.samples")
            samples_b = await b.evaluate("() => window._d3.samples")
            report["run1_agree"] = agree(samples_a, samples_b, t_fight, t_quiet)
            report["run1_agree_after_quiet"] = agree(samples_a, samples_b, t_quiet + 7000)
            report["run1_casts"] = {"a": len(await a.evaluate("() => Object.keys(window._d3.casts)")), "b": len(await b.evaluate("() => Object.keys(window._d3.casts)")),
                                    "both": len(set(await a.evaluate("() => Object.keys(window._d3.casts)")) & set(await b.evaluate("() => Object.keys(window._d3.casts)")))}
            report["run1_dealt"] = {"a": sa1["dealt"], "b": sb1["dealt"]}
            print(f"      out together: {back}; A won {sa1['won']} shards {sa1['shards']}, B won {sb1['won']} shards {sb1['shards']}; shards {sa1['shard']} {sb1['shard']}")

            # --- run 2: the brain's tab closes mid-fight -------------------------------------------------------------------
            print(f"run 2: floor {args.floor2}")
            for pg in (a, b):
                await pg.evaluate("() => { window._d3.samples = []; window._d3.casts = {}; window._d3.dealt = 0; window._d3.hooked = null; }")
            await climb(a, "Kaia", args.floor2)
            await climb(b, "Lyra", args.floor2)
            door2, ok2, took2, held2 = await to_door(a, b, out, "run2-")
            report["run2_started"] = ok2
            if ok2:
                await asyncio.sleep(8)
                await shot(b, out / "b-before-a-closes.jpg")
                bstate = await b.evaluate(STATE)
                t_close = time.time() * 1000
                await ca.close()
                took = await wait_for(b, "() => !!window.game.api.duel.boss?.link.brain", 10, "B takes the brain over")
                t_took2 = time.time() * 1000
                await asyncio.sleep(3)
                await shot(b, out / "b-took-over.jpg")
                after = await b.evaluate("() => window._d3.samples")
                steps = []
                prev = None
                for s in after:
                    if s["t"] < t_close - 3000 or not s["boss"]:
                        continue
                    if prev:
                        steps.append({"t": s["t"] - t_close, "step": round(((s["boss"][0] - prev["boss"][0]) ** 2 + (s["boss"][1] - prev["boss"][1]) ** 2) ** 0.5, 3), "brain": s["brain"]})
                    prev = s
                around = [x["step"] for x in steps if -1500 <= x["t"] <= 2500]
                before_steps = [x["step"] for x in steps if x["t"] < -200]
                await b.evaluate("() => { window._d3.boost = 500; }")
                ended2 = await wait_for(b, "() => (window._worldGame.together?.log ?? []).filter((l) => l.includes('door_end')).length >= 2", 60, "B wins alone")
                await b.evaluate("() => { window._d3.boost = 0; }")
                back2 = await wait_for(b, "() => !!window._worldGame.zone && window._worldGame.piece === null", 40, "B back on the floor")
                await asyncio.sleep(2)
                sb2 = await b.evaluate(STATE)
                await shot(b, out / "b-out-alone.jpg")
                report["run2"] = {"b_brain_before": bstate["brain"], "took_over": took, "after_ms": round(t_took2 - t_close), "largest_step_around_m": max(around) if around else None,
                                  "largest_step_before_m": max(before_steps) if before_steps else None, "ended": ended2, "back": back2, "b": sb2}
                print(f"      B took the brain {round(t_took2 - t_close)} ms after A's tab closed; won {sb2['won']}")
            report["errors"] = {"b": (await b.evaluate("() => window._d3.errors"))}
            await cb.close()
            await browser.close()
    finally:
        if not args.drop:
            (out / "run.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf8")
        if proc:
            proc.terminate()
            try:
                proc.wait(10)
            except Exception:
                proc.kill()
    print(json.dumps({k: report.get(k) for k in ("run1_started", "zone_shot", "revived", "revive_by", "quiet", "run1_ended", "run1_agree", "run1_dealt", "run1_casts", "run2")}, indent=1, default=str)[:6000])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5267)
    ap.add_argument("--floor", type=int, default=1)
    ap.add_argument("--floor2", type=int, default=2)
    ap.add_argument("--drop", action="store_true", help="both connections drop mid-fight (one floor)")
    ap.add_argument("--width", type=int, default=1100)
    ap.add_argument("--height", type=int, default=680)
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    main()
