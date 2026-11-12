"""
Writes docs/balance/rework-1a-tuning.html: the tuning of the three heroes reworked in wave 1a (Cantor, Brannoc, Vesper),
every pairing before and after as two small bars, with what was wrong and what was changed. The numbers come from the
simulator's kept runs in pipeline/sim/out (not in git): t0-base (before), t14-final (after: Brannoc, Vesper), t15-cantor
(after: Cantor), t18-roster (the six bystanders). The sentences are written here.

    python pipeline/tools/rework-1a-page.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "pipeline" / "sim" / "out"
BENCH = ["Brannoc", "Kaia", "Isolde", "Sirix", "Cantor", "Oblivion"]
ORDER = BENCH + ["Vesper", "Auriel", "Lyra"]


def fights(name):
    return json.loads((OUT / f"{name}.json").read_text(encoding="utf-8"))["fights"]


def cells(fs, hero):
    out = {}
    for f in fs:
        if hero not in (f["h"], f["f"]):
            continue
        mine = f["h"] == hero
        c = out.setdefault(f["f"] if mine else f["h"], {"hero": [0, 0], "opp": [0, 0]})
        side = c["hero" if mine else "opp"]
        side[1] += 1
        side[0] += f["w"] == hero
    return out


def mirror(c):
    """A pairing seen from the other hero: its wins are the fights this one lost, its sides the other way round."""
    return {"hero": [c["opp"][1] - c["opp"][0], c["opp"][1]], "opp": [c["hero"][1] - c["hero"][0], c["hero"][1]]}


def totals(cs, key=None):
    w = n = 0
    for foe, c in cs.items():
        if foe not in BENCH:
            continue
        for k in ("hero", "opp"):
            if key in (None, k):
                w += c[k][0]
                n += c[k][1]
    return 100 * w / n if n else 0


before = fights("t0-base")
after = fights("t14-final")
cantor_after = cells(fights("t15-cantor"), "Cantor")
B = {h: cells(before, h) for h in ("Cantor", "Brannoc", "Vesper")}
A = {"Cantor": cantor_after, "Brannoc": cells(after, "Brannoc"), "Vesper": cells(after, "Vesper")}
# Cantor's last change (9% a step) came after the run of all three: his pairings with the other two are the later run's.
for other in ("Brannoc", "Vesper"):
    A[other]["Cantor"] = mirror(cantor_after[other])

# What was wrong in each pairing, and what was done: one plain sentence each.
WHY = {
    "Cantor": {
        "Brannoc": "Whoever was the computer's opponent won (0 of 32 one way, 31 of 32 the other): Brannoc's fault, see his first row.",
        "Kaia": "His chord cannot be dodged and came every beat with 740 HP behind it: a 12 to 17% edge, and in a fight with no chance in it that wins every time. The chord went 25 to 22, a step of Crescendo 12% to 9%, his HP 740 to 720.",
        "Isolde": "The same edge as against Kaia; the same numbers fixed it.",
        "Sirix": "The computer walked him to 2.6 m from everyone, into every swing. Against a brawler it now keeps the far end of the chord, 4.3 m off.",
        "Oblivion": "At 2.6 m he stood inside every Gravity Slam (7 hits of 7 casts) and the Null Zone, and could not cast a quarter of the fight. The same stand-off cured it.",
        "Auriel": "The same edge as against Kaia. Still his best pairing.",
        "Lyra": "She out-ranges his whole kit (her arrow 14 m, his chord 5 m) and backs away at his speed: half his chords miss. The computer now sings the Siren Song at her from 3 Crescendo to walk her in. Still her fight: a hard counter.",
        "Vesper": "Her curse charged him for a spell every beat: a fifth of her damage on him. It costs 15 a spell now, not 20; she still out-trades him.",
    },
    "Brannoc": {
        "Kaia": "Not made by the rework (he won 32 of 32 before it too): she has 580 HP and, dragged in by the chain, nothing of his can be dodged. The chain hits a sixth softer now (40 to 34); it is still his fight nine times in ten.",
        "Isolde": "Was inside the band; stays there.",
        "Sirix": "Was inside the band; stays there.",
        "Cantor": "1 of 32 as the player's hero, 32 of 32 as the opponent. On the player's side a cast drops a hammer swing in its wind-up, on the opponent's it does not: his computer cast into its own swings and lost a third of them. It now casts as a swing lands.",
        "Oblivion": "Two faults. White-hot and under half HP his computer stopped casting and would not Quench unless the enemy stood within 2.5 m, while the enemy's computer steps back from white heat: he stood and burned. Fixed. The other is not his: Oblivion's Black Hole lands on the opponent's Brannoc every fight and on the player's Brannoc one fight in five (1 of 32 against 21 of 32).",
        "Vesper": "Her computer waltzed away from him three times a fight, out of her own needle's reach each time, and threw 0.2 needles a fight. Her fault; fixed on her side.",
        "Auriel": "Was inside the band; stays there.",
        "Lyra": "Was inside the band at 75%; with the softer chain (his only reach on an archer) it is her fight now, inside the band.",
    },
    "Vesper": {
        "Brannoc": "See his row: she never threw a needle at a brawler. She does now, and her Hungry drink (65% of a hit, was 50%) lets her last against him.",
        "Kaia": "Turned right over. The Feast was 190 damage and 60 HP back on a 580 HP hero; with the Feast cut (35, 35, 40 to 18, 18, 24; 45 back) and the curse cheaper, Kaia wins. This pairing flips with every small number: 100%, 81%, 22%, 9% in four steps.",
        "Isolde": "Inside the band now.",
        "Sirix": "He has to walk to her and has 640 HP; she out-damages him and steps back between shots. Also 4 of 4 for her before the rework. Not solved.",
        "Cantor": "Her curse (see his row). Inside the band, at its edge.",
        "Oblivion": "His Null Zone swallows her bolts and her spells for 3 s in every 12, and he pulls her in. He won 3 of 4 before the rework too. Not solved: the cause is his kit, and neither waltzing nor stepping back gets her out.",
        "Auriel": "The computer started the Feast only within 4 m, so against anyone with a ranged attack it never cast it (0.1 Feasts a fight): she lost. Started from 5.5 m she wins nearly every time. Turned over rather than evened.",
        "Lyra": "520 HP and arrows she can step out of: she kills Lyra in 19 s. Softer after the cuts, not solved.",
    },
}

CHANGED = {
    "Cantor": [
        "Resounding Chord 25 to 22; each step of Crescendo +12% to +9% (the release at 5: 40 to 32); HP 740 to 720.",
        "The computer keeps 4.3 m from a brawler (it used to stand at 2.6 m from everyone) and steps back when they close in.",
        "The computer sings the Siren Song from 3 Crescendo at an enemy who stays past the chord's reach.",
        "New, for the Raid: a charm or silence of his that cannot take hold strikes instead, 36 for each step of Crescendo behind it. A boss can be neither charmed nor silenced; in a duel a silence always holds.",
    ],
    "Brannoc": [
        "Chain Hammer 40 to 34 (19 cold to 39 white-hot; it was 22 to 46). Nothing else of his numbers.",
        "In reach of his hammer the computer casts as a swing lands, not into the next swing's wind-up.",
        "White-hot with the enemy out of reach, the computer drags them back with the chain, and after 5 s it Quenches anyway.",
    ],
    "Vesper": [
        "Lancet 33 to 30, the Rip 24 to 22; Sanguine Feast 35, 35, 40 to 18, 18, 24 (plus 20% of the missing HP, as before) and 60 to 45 HP back; HP 660 to 640.",
        "The drink: 25% to 15% of a spell hit, and 50% to 65% while Hungry (under 45% HP): less for the one who is ahead, more for the one who is behind.",
        "Hemocurse costs the enemy 15 a spell (was 20) and heals her 20 when Hungry (was 15).",
        "The computer throws the needle before it waltzes away, starts the Feast from 5.5 m (was 4 m), pays up to 40 a spell while Hungry, and steps back from a brawler between shots.",
    ],
}

GREEDY = {"Cantor": ("never spends the Crescendo", "40%", "38%"), "Brannoc": ("no pause between spells", "44%", "25%"),
          "Vesper": ("needle and Rip only, at any Price", "14%", "0%")}

# The six bystanders against the six benchmark heroes, both sides (t18-roster), beside the last whole-roster run.
ROSTER_BEFORE = {  # docs/balance/roster-2026-11-11-after.html: against all 39 (156 fights), and against the six in that run (20 or 24 fights)
    "Kaia": (49.4, 50.0), "Auriel": (31.4, 33.3), "Lyra": (54.5, 58.3), "Isolde": (49.4, 40.0), "Sirix": (42.3, 60.0), "Oblivion": (51.9, 50.0),
}
ROSTER_NOTE = {
    "Kaia": "Down about 11. Loses to Brannoc (2 of 32, as before the rework), Oblivion and now Cantor (31%); she had fallen to 28% before this tuning. The benchmark changed, she did not: listed, not retuned.",
    "Auriel": "Up about 24, and not from this tuning: the engine fix of the night (the computer's opponent aims First Light) is most of it. Against Cantor 28% (it was 0 of 32).",
    "Lyra": "Where she was.",
    "Isolde": "Where she was (inside the noise of the old run's 20 fights).",
    "Sirix": "Where he was.",
    "Oblivion": "Up about 11: he beats the opponent's Brannoc 16 of 16 (the Black Hole) and Kaia 55 of 64. The benchmark changed, he did not: listed, not retuned.",
}


def pct(w, n):
    return 100 * w / n if n else 0


def bar(p, cls):
    return f'<div class="track"><div class="band"></div><div class="mid"></div><div class="fill {cls}" style="width:{p:.1f}%"></div></div>'


def hero_block(hero):
    b, a = B[hero], A[hero]
    rows = []
    for foe in ORDER:
        if foe == hero or foe not in b or foe not in a:
            continue
        bw, bn = b[foe]["hero"][0] + b[foe]["opp"][0], b[foe]["hero"][1] + b[foe]["opp"][1]
        aw, an = a[foe]["hero"][0] + a[foe]["opp"][0], a[foe]["hero"][1] + a[foe]["opp"][1]
        bp, ap = pct(bw, bn), pct(aw, an)
        off_b = not 20 <= bp <= 80
        off_a = not 20 <= ap <= 80
        rows.append(f"""<tr>
<td class="foe">{foe}{'' if foe in BENCH else '<span class="dim"> *</span>'}</td>
<td class="bars">{bar(bp, 'old')}{bar(ap, 'new bad' if off_a else 'new')}</td>
<td class="num"><span class="{'bad' if off_b else 'dim'}">{bp:.0f}%</span><br><b class="{'bad' if off_a else 'ok'}">{ap:.0f}%</b></td>
<td class="num dim">{b[foe]['hero'][0]}/{b[foe]['hero'][1]} &middot; {b[foe]['opp'][0]}/{b[foe]['opp'][1]}<br>{a[foe]['hero'][0]}/{a[foe]['hero'][1]} &middot; {a[foe]['opp'][0]}/{a[foe]['opp'][1]}</td>
<td class="why">{html.escape(WHY[hero].get(foe, ''))}</td></tr>""")
    changed = "".join(f"<li>{html.escape(c)}</li>" for c in CHANGED[hero])
    g = GREEDY[hero]
    return f"""<h2>{hero}</h2>
<p class="lead">Against the six benchmark heroes, both sides: <span class="dim">{totals(b):.0f}%</span> &rarr; <b>{totals(a):.0f}%</b>.
As the player's hero alone: <span class="dim">{totals(b, 'hero'):.0f}%</span> &rarr; <b>{totals(a, 'hero'):.0f}%</b>.
As the opponent: <span class="dim">{totals(b, 'opp'):.0f}%</span> &rarr; <b>{totals(a, 'opp'):.0f}%</b>.
The greedy line ({g[0]}): <span class="dim">{g[1]}</span> &rarr; <b>{g[2]}</b>.</p>
<table><tr><th>Against</th><th>{hero} wins: before (grey), after</th><th></th><th>as hero &middot; as opponent</th><th>What was wrong, what was done</th></tr>
{''.join(rows)}</table>
<h3>What was changed</h3><ul>{changed}</ul>"""


def roster_block():
    fs = fights("t18-roster")
    rows = []
    for h in ("Kaia", "Auriel", "Lyra", "Isolde", "Sirix", "Oblivion"):
        cs = cells(fs, h)
        now = totals(cs)
        allp, six = ROSTER_BEFORE[h]
        moved = now - six
        per = " ".join(f"{f[:3]} {pct(c['hero'][0] + c['opp'][0], c['hero'][1] + c['opp'][1]):.0f}" for f, c in ((f, cs[f]) for f in BENCH if f in cs))
        rows.append(f"<tr><td class='foe'>{h}</td><td class='num'>{allp:.0f}%</td><td class='num'>{six:.0f}%</td><td class='num'><b class=\"{'bad' if abs(moved) > 10 else 'ok'}\">{now:.0f}%</b></td>"
                    f"<td class='num dim'>{per}</td><td class='why'>{html.escape(ROSTER_NOTE[h])}</td></tr>")
    return "".join(rows)


def count_off(table):
    return sum(1 for foe, c in table.items() if not 20 <= pct(c["hero"][0] + c["opp"][0], c["hero"][1] + c["opp"][1]) <= 80)


summary = "".join(
    f"<tr><td class='foe'>{h}</td><td class='num'><span class='dim'>{totals(B[h]):.0f}%</span> &rarr; <b>{totals(A[h]):.0f}%</b></td>"
    f"<td class='num'><span class='dim'>{totals(B[h], 'hero'):.0f}%</span> &rarr; <b>{totals(A[h], 'hero'):.0f}%</b></td>"
    f"<td class='num'><span class='dim'>{count_off(B[h])} of 8</span> &rarr; <b>{count_off(A[h])} of 8</b></td>"
    f"<td class='num'><span class='dim'>{GREEDY[h][1]}</span> &rarr; <b>{GREEDY[h][2]}</b></td></tr>"
    for h in ("Cantor", "Brannoc", "Vesper"))

PAGE = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wave 1a tuning: Cantor, Brannoc, Vesper</title>
<style>
body {{ background:#14121a; color:#e8e2d6; font:15px/1.5 system-ui, sans-serif; margin:0; padding:20px 16px 60px; }}
main {{ max-width:1080px; margin:0 auto; }}
h1 {{ font-size:24px; margin:0 0 6px; }} h2 {{ font-size:20px; margin:34px 0 4px; color:#ffd24a; }} h3 {{ font-size:15px; margin:16px 0 4px; color:#b9b1a4; }}
p {{ margin:6px 0 10px; }} .lead {{ color:#cfc8ba; }} .dim {{ color:#8d8698; }} .ok {{ color:#8fd694; }} .bad {{ color:#ff7a6b; }}
table {{ border-collapse:collapse; width:100%; margin:8px 0; }} th {{ text-align:left; font-weight:600; color:#8d8698; font-size:12px; padding:4px 8px; border-bottom:1px solid #2c2836; }}
td {{ padding:6px 8px; border-bottom:1px solid #221f2b; vertical-align:top; }} td.foe {{ white-space:nowrap; font-weight:600; }} td.num {{ white-space:nowrap; text-align:right; font-variant-numeric:tabular-nums; }}
td.bars {{ width:230px; min-width:150px; }} td.why {{ color:#cfc8ba; font-size:14px; }}
.track {{ position:relative; height:9px; background:#221f2b; border-radius:3px; margin:4px 0 5px; overflow:hidden; }}
.band {{ position:absolute; left:20%; width:60%; top:0; bottom:0; background:#2f2b3b; }} .mid {{ position:absolute; left:50%; width:1px; top:0; bottom:0; background:#5a546a; }}
.fill {{ position:absolute; left:0; top:0; bottom:0; border-radius:3px; }} .fill.old {{ background:#77708a; opacity:.8; }} .fill.new {{ background:#8fd694; }} .fill.new.bad {{ background:#ff7a6b; }}
ul {{ margin:4px 0 10px 20px; padding:0; }} li {{ margin:3px 0; }} .box {{ background:#1b1823; border:1px solid #2c2836; border-radius:8px; padding:10px 14px; margin:14px 0; }}
.scroll {{ overflow-x:auto; }}
</style></head><body><main>
<h1>Wave 1a tuning: Cantor, Brannoc, Vesper</h1>
<p class="lead">2026-11-12. The three heroes rebuilt last night, tuned until each wins about half its duels on either side. Every number is from the fight
simulator (the computer playing both heroes, on the game's own code). Before: 32 fights a pairing (64 where both are of the three). After: 64 a pairing.
A bar is how often the hero wins that pairing; the lighter strip is 20 to 80%, the aim. <span class="dim">* not one of the six benchmark heroes.</span></p>

<div class="box"><b>In short.</b> All three now sit inside the band, both sides together and as the player's hero alone. Cantor has no pairing past 78 to 22
(he had five). Brannoc has one, Kaia, which is older than his rework. Vesper is even overall but her pairings are still far apart: five of eight
are one-sided, some of them the other way round than before. Three faults were in how the computer played them, not in their numbers, and one is in
the engine and is not fixed here (the two computer players do not treat a basic attack alike).</div>

<div class="scroll"><table><tr><th>Hero</th><th>Against the six, both sides</th><th>As the player's hero alone</th><th>Pairings past 80 to 20</th><th>The greedy line</th></tr>{summary}</table></div>

<h3>Why so many pairings were 32 of 32</h3>
<p>A duel between two computers is close to a race with no chance in it: the same casts, the same hits, fight after fight. A hero who is 12% ahead at the end
wins every time, so a small edge reads as 100%. The older heroes miss with skillshots, which puts chance back in; these three hit with almost everything
(a cone, a targeted needle, a hammer in melee). That is why a few points of damage turned Cantor against Kaia from 32 of 32 to even, and why some of Vesper's
pairings flip with every small change. The same shows among the older heroes: Kaia beats Isolde 57 of 64 and loses to Lyra's side 4 of 32 with nothing of theirs changed.</p>

<div class="scroll">{hero_block('Cantor')}</div>
<div class="scroll">{hero_block('Brannoc')}</div>
<div class="scroll">{hero_block('Vesper')}</div>

<h2>The roster's view</h2>
<p class="lead">The six bystanders against the six benchmark heroes, both sides, 32 fights a pairing (64 where both are benchmark heroes), beside the last whole-roster run
(<a style="color:#9ecbff" href="roster-2026-11-11-after.html">roster-2026-11-11-after</a>: 4 fights a pairing, so its "against the six" is only 20 fights and swings by 20 points).</p>
<div class="scroll"><table><tr><th>Hero</th><th>Then, against all 39</th><th>Then, against the six</th><th>Now, against the six</th><th>Now, each pairing (win %)</th><th>What moved it</th></tr>{roster_block()}</table></div>

<h2>The Raid (against the Sun Warden, the autopilot)</h2>
<div class="scroll"><table><tr><th>Hero</th><th>Before the rework</th><th>After the rework</th><th>After the tuning</th><th></th></tr>
<tr><td class="foe">Cantor</td><td class="num">3 of 3, 27 a second</td><td class="num">1 of 3, 19 to 20</td><td class="num"><b class="ok">3 of 4, 28 a second</b></td><td class="why">A boss cannot be charmed or silenced, so his song and his release did nothing but stagger it. Now such a charm or silence strikes instead: 36 for each step of Crescendo. With 16 a step: 1 of 3 and 20; with 24: 3 of 4 and 21.</td></tr>
<tr><td class="foe">Vesper</td><td class="num">2 of 3, 25</td><td class="num">3 of 6, 22</td><td class="num">2 of 3, 24</td><td class="why">Where she was.</td></tr>
<tr><td class="foe">Brannoc</td><td class="num">0 of 3, 21</td><td class="num">0 of 3, 22</td><td class="num">0 of 3, 21</td><td class="why">Where he was: he does not clear, before or after. Not looked into.</td></tr>
</table></div>
<p class="dim">Three or four fights say little about clears; the damage a second is the steadier number.</p>

<h2>Still off, and not checked</h2>
<ul>
<li><b>Vesper's pairings.</b> Oblivion (5%), Kaia (9%), Sirix (97%), Auriel (92%), Lyra (86%). Oblivion and Sirix went the same way before her rework. She is the one of the three whose fights swing most on a single number.</li>
<li><b>Brannoc against Kaia</b> (91%) and <b>Cantor against Lyra</b> (31% in one run of 64, 12% in another of 32): both older than the rework, both a matter of reach.</li>
<li><b>The engine, not fixed here</b> (it is not this job's to edit): on the player's side a cast drops a basic attack in its wind-up, on the computer's opponent's side the swing lands anyway. Any hero who casts often is weaker as the player's hero for it. The computers of these three now play round it; the next reworked heroes will meet it again.</li>
<li><b>Oblivion's Black Hole</b> lands on the opponent's Brannoc every fight and on the player's one in five. It is most of what is left of Brannoc's gap in that pairing.</li>
<li>No person has played the three since the tuning, and no network duel was played. The raid was run once with the last numbers (Cantor twice more while the strike was sized).</li>
</ul>
</main></body></html>
"""

path = ROOT / "docs" / "balance" / "rework-1a-tuning.html"
path.write_text(PAGE, encoding="utf-8")
print(f"wrote {path}")
for h in ("Cantor", "Brannoc", "Vesper"):
    print(h, f"both {totals(B[h]):.1f} -> {totals(A[h]):.1f}", f"hero {totals(B[h], 'hero'):.1f} -> {totals(A[h], 'hero'):.1f}", f"opp {totals(B[h], 'opp'):.1f} -> {totals(A[h], 'opp'):.1f}", f"off {count_off(B[h])} -> {count_off(A[h])}",
          " ".join(f"{f[:3]} {pct(B[h][f]['hero'][0] + B[h][f]['opp'][0], B[h][f]['hero'][1] + B[h][f]['opp'][1]):.0f}>{pct(A[h][f]['hero'][0] + A[h][f]['opp'][0], A[h][f]['hero'][1] + A[h][f]['opp'][1]):.0f}" for f in ORDER if f != h))
