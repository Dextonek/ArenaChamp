"""Two screens online: Anka on one, Kaia on the other, two bots (pipeline/tools/online-bot.js) through this repo's own
dev server. Reads what each screen saw of her embers, her HP and her rise ten times a second and lays the two records over
each other by the wall clock; `read_online.py` prints how far apart the two screens put her embers. Written for Anka: the
sampler reads her EMBERS meter and her marks.

    python pipeline/tools/hero-gate5/online.py 1            every spell (her spells run into each other's wind-ups)
    python pipeline/tools/hero-gate5/online.py 2 quills     she keeps her embers, so she falls with a nest burning
    python pipeline/tools/hero-gate5/online.py 3 strafe     Kaia keeps 7 m away and steps from side to side, as a person does
    python pipeline/tools/hero-gate5/read_online.py 1 2 3

The bots' accounts are throwaway ones in server/data/ (git-ignored): delete them afterwards. Output: pipeline/sim/out/gate5/.
"""
import asyncio
import json
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

from srv import ARGS, OUT, PORT, Server

HERE = Path(__file__).parent
SAMPLER = r"""
(() => {
  window._samp = [];
  window._casts = [];
  { const hm = window.game.api.heroMode, ac = hm.autoCast.bind(hm); hm.autoCast = (i, target) => { const ok = ac(i, target); if (ok) { const d = window.game.api.duel, m = window.game.api.arena.caster.group.position, tp = target.point ?? target.enemy.group.position; window._casts.push({ w: Date.now(), t: +d.time.toFixed(2), slot: i, me: [+m.x.toFixed(1), +m.z.toFixed(1)], at: [+tp.x.toFixed(1), +tp.z.toFixed(1)] }); } return ok; }; }
  setInterval(() => {
    const { api, match } = window.game; const d = api.duel, a = api.arena;
    if (!match.active || !d.on || !d.foe) return;
    const rt = d.heroRt, ot = d.oppRt;
    const mine = rt?.trait?.meter?.name === 'EMBERS';
    const r = mine ? rt : ot;
    if (!r || r.trait?.meter?.name !== 'EMBERS') return;
    const p = r.self().group.position;
    const marks = r.trait.marks(r).filter((m) => m.kind === 'ember' || m.kind === 'nest' || m.kind === 'egg').map((m) => `${m.kind[0]}${m.x.toFixed(1)},${m.z.toFixed(1)}`).sort().join(' ');
    window._samp.push({ w: Date.now(), round: d.round, t: +d.time.toFixed(2), anka: mine ? Math.round(d.playerHp) : Math.round(a.hpOf(d.foe)), kaia: mine ? Math.round(a.hpOf(d.foe)) : Math.round(d.playerHp),
      embers: r.trait.meter.value(r), ash: r.own('ash') > 0 ? 1 : 0, hidden: r.trait.figureHidden(r) ? 1 : 0, marks, x: +p.x.toFixed(1), z: +p.z.toFixed(1), kx: +(mine ? d.foe : a.caster).group.position.x.toFixed(1), kz: +(mine ? d.foe : a.caster).group.position.z.toFixed(1), over: d.isOver ? 1 : 0 });
  }, 100);
})();
"""


async def open_page(pw, name, errors):
    browser = await pw.chromium.launch(channel="chrome", headless=True, args=ARGS)
    ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
    page = await ctx.new_page()
    page.on("console", lambda m: errors.append(f"{name}: {m.text[:300]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{name}: PAGEERROR {str(e)[:300]}"))
    await page.goto(f"http://localhost:{PORT}/game", wait_until="load", timeout=120000)
    await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
    await page.add_style_tag(content="*{animation:none!important}")
    await page.evaluate("(async () => { eval(await (await fetch('/pipeline/tools/online-bot.js')).text()); await _botLogin(); })()")
    await page.evaluate(SAMPLER)
    return browser, page


def rises(samples):
    """Each stretch of `ash` in one screen's samples: when it began and ended, her HP before, at its lowest and after."""
    out, i = [], 0
    while i < len(samples):
        if samples[i]["ash"]:
            j = i
            while j + 1 < len(samples) and samples[j + 1]["ash"]:
                j += 1
            before = samples[i - 1] if i else samples[i]
            after = samples[min(len(samples) - 1, j + 3)]
            egg = [m for m in samples[i]["marks"].split() if m.startswith("e")]
            out.append({"round": samples[i]["round"], "from": samples[i]["w"], "to": samples[j]["w"], "seconds": round((samples[j]["w"] - samples[i]["w"]) / 1000, 2),
                        "hpBefore": before["anka"], "hpLow": min(s["anka"] for s in samples[i:j + 1]), "hpAfter": after["anka"], "egg": egg[0] if egg else None,
                        "rosePos": [after["x"], after["z"]], "hiddenAll": all(s["hidden"] for s in samples[i:j + 1]), "hiddenAfter": after["hidden"], "embersAfter": after["embers"]})
            i = j + 1
        else:
            i += 1
    return out


def compare(a, b):
    """Samples of the two screens laid over each other by wall clock (the nearest within 80 ms)."""
    n = same_embers = same_marks = 0
    hp_diffs, kaia_diffs = [], []
    k = 0
    worst = []
    for s in a:
        if s["over"]:
            continue
        while k + 1 < len(b) and abs(b[k + 1]["w"] - s["w"]) <= abs(b[k]["w"] - s["w"]):
            k += 1
        o = b[k] if b else None
        if not o or abs(o["w"] - s["w"]) > 80 or o["round"] != s["round"] or o["over"]:
            continue
        n += 1
        same_embers += s["embers"] == o["embers"]
        same_marks += s["marks"] == o["marks"]
        hp_diffs.append(abs(s["anka"] - o["anka"]))
        kaia_diffs.append(abs(s["kaia"] - o["kaia"]))
        if s["embers"] != o["embers"] and len(worst) < 6:
            worst.append({"round": s["round"], "t": s["t"], "hers": s["marks"], "theirs": o["marks"]})
    hp_diffs.sort()
    kaia_diffs.sort()
    pct = lambda v, q: v[min(len(v) - 1, int(len(v) * q))] if v else None
    return {"paired": n, "embersSame": round(same_embers / n, 3) if n else None, "marksSame": round(same_marks / n, 3) if n else None,
            "ankaHpDiff": {"median": pct(hp_diffs, 0.5), "p90": pct(hp_diffs, 0.9), "max": hp_diffs[-1] if hp_diffs else None, "share0": round(sum(1 for v in hp_diffs if v == 0) / n, 3) if n else None},
            "kaiaHpDiff": {"median": pct(kaia_diffs, 0.5), "p90": pct(kaia_diffs, 0.9), "max": kaia_diffs[-1] if kaia_diffs else None},
            "emberMismatches": worst}


async def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "1"
    limit = 500
    errors = []
    with Server():
        async with async_playwright() as pw:
            ba, pa = await open_page(pw, "anka", errors)
            bk, pk = await open_page(pw, "kaia", errors)
            if len(sys.argv) > 2 and sys.argv[2] == "strafe":
                # The case a person makes: Kaia keeps 7 m away and steps from side to side, so quills fly long enough to be dodged.
                hold = "(() => { const a = game.api.arena, walk = a.walk.bind(a); window._walk = walk; const dist = () => { const f = game.api.duel.foe; if (!f) return 99; const m = a.caster.group.position, p = f.group.position; return Math.hypot(m.x - p.x, m.z - p.z); }; a.walk = (v, ...r) => (dist() < KEEP ? undefined : walk(v, ...r)); })()"
                await pa.evaluate(hold.replace("KEEP", "8"))
                await pk.evaluate(hold.replace("KEEP", "7"))
                await pa.evaluate("(() => { const hm = game.api.heroMode, ac = hm.autoCast; hm.autoCast = (i, target) => (i === 1 || i === 2 ? false : ac(i, target)); })()")
                await pk.evaluate("(() => { const a = game.api.arena; let side = 1, t0 = performance.now(); setInterval(() => { const d = game.api.duel, f = d.foe; if (!d.on || d.isOver || !f || d.waiting || d.countdown > 0 || game.api.heroMode.locked) return; if (performance.now() - t0 > 700) { side = -side; t0 = performance.now(); } const m = a.caster.group.position, p = f.group.position, dx = p.x - m.x, dz = p.z - m.z, L = Math.hypot(dx, dz) || 1; window._walk(new p.constructor((-dz / L) * 0.4 * side, 0, (dx / L) * 0.4 * side), Infinity, true); }, 100); })()")
            if len(sys.argv) > 2 and sys.argv[2] == "quills":
                # Her bot keeps its embers (no Fan the Flames, no Ember Flight), so she falls with a nest burning.
                await pa.evaluate("(() => { const hm = game.api.heroMode, ac = hm.autoCast; hm.autoCast = (i, target) => (i === 1 || i === 2 ? false : ac(i, target)); })()")
            for pg in (pa, pk):
                await pg.evaluate("(() => { const n = game.net, send = n.send.bind(n); window._sent = []; window._got = []; n.send = (m) => { if (m.t === 'stacks' && m.name[0] === '!') window._sent.push([Date.now(), m.name, m.n]); return send(m); }; n.on('peer_stacks', (m) => { if (m.name[0] === '!') window._got.push([Date.now(), m.name, m.n]); }); })()")
            await pa.evaluate("_botQueue('Anka')")
            await pk.evaluate("_botQueue('Kaia')")
            end = time.time() + limit
            shot = False
            ended = False
            while time.time() < end:
                la = json.loads(await pa.evaluate("_botLog()"))
                lk = json.loads(await pk.evaluate("_botLog()"))
                if not shot and len(la["samples"]) >= 3 and not la["samples"][-1]["over"]:
                    shot = True
                    await pa.screenshot(path=str(OUT / f"online-{tag}-anka.jpg"), type="jpeg", quality=82)
                    await pk.screenshot(path=str(OUT / f"online-{tag}-kaia.jpg"), type="jpeg", quality=82)
                over_a = await pa.evaluate("(() => { const d = game.api.duel; return !game.match.active || (d.isOver && !!d.result); })()")
                done_a = await pa.evaluate("(() => { const el = [...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent === 'Back to menu'); return !!el; })()")
                if la.get("ended") or lk.get("ended") or done_a:
                    ended = True
                    break
                await asyncio.sleep(1)
            la = json.loads(await pa.evaluate("_botLog()"))
            lk = json.loads(await pk.evaluate("_botLog()"))
            sa = await pa.evaluate("_samp")
            sk = await pk.evaluate("_samp")
            await_casts = {"anka": await pa.evaluate("_casts"), "kaia": await pk.evaluate("_casts")}
            notes = {"kaiaSent": await pk.evaluate("_sent"), "ankaGot": await pa.evaluate("_got"), "ankaSent": await pa.evaluate("_sent"), "kaiaGot": await pk.evaluate("_got")}
            (OUT / f"online-{tag}-notes.json").write_text(json.dumps(notes), encoding="utf-8")
            card_a = await pa.evaluate("(() => { const d = game.api.duel; return { title: d.cardTitle?.textContent, text: d.cardText?.textContent, result: d.result?.winner ?? null }; })()")
            card_k = await pk.evaluate("(() => { const d = game.api.duel; return { title: d.cardTitle?.textContent, text: d.cardText?.textContent, result: d.result?.winner ?? null }; })()")
            await pa.screenshot(path=str(OUT / f"online-{tag}-end-anka.jpg"), type="jpeg", quality=70)
            await pa.evaluate("_botStop()")
            await pk.evaluate("_botStop()")
            await ba.close()
            await bk.close()
    out = {
        "ended": ended, "errors": errors,
        "anka": {k: la.get(k) for k in ("name", "hero", "foe", "casts", "attacks", "rounds", "errors", "ended")},
        "kaia": {k: lk.get(k) for k in ("name", "hero", "foe", "casts", "attacks", "rounds", "errors", "ended")},
        "lastSamples": {"anka": la["samples"][-4:], "kaia": lk["samples"][-4:]},
        "cards": {"anka": card_a, "kaia": card_k},
        "samples": {"anka": len(sa), "kaia": len(sk)},
        "risesOnHerScreen": rises(sa), "risesOnKaiasScreen": rises(sk),
        "agree": compare(sa, sk),
    }
    for k in ("anka", "kaia"):
        out[k].pop("name", None)
    (OUT / f"online-{tag}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    ca = await_casts
    (OUT / f"online-{tag}-samples.json").write_text(json.dumps({"anka": sa, "kaia": sk, "casts": ca}), encoding="utf-8")
    print(json.dumps(out, indent=1)[:7000])


asyncio.run(main())
