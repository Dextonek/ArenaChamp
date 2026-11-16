"""
Builds the heroes' model review page, docs/heroes/review/index.html, from what the review tools measured and drew:

    python pipeline/tools/hero-review-page.py [--import <scratch folder>]

`--import` first copies the measurements and pictures in (a folder with before/ and after/ review.json files from
pipeline/tools/hero-review.js, sheet_before/ and sheet_after/ from hero-review-sheet.js, duel/<Hero>/duel.jpg from
hero-review-duel.js, pairs/ from hero-review-close.js laid side by side, climb/<Hero>/horde.jpg from tower-shots.py),
recompressed for a phone: docs/heroes/review/<theme>/{before,after,duel}.jpg, docs/heroes/review/data/*.json.
Without it the page is only written again from what is already there. The words per hero are NOTES below.
"""
import argparse
import html
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "heroes" / "review"
HOLDERS = {"Vesper", "Isolde", "Kaia", "Sefu", "Fenna", "Mortis", "Cantor", "Opaline", "Shiori", "Tempo", "Silvane", "Mr. Ledger", "Gus",
           "Barry Cloudsley", "Bo", "The Great Zambini", "Wick", "Anka"}
HOLDS = {"Vesper": "scepter", "Isolde": "staff", "Kaia": "staff", "Sefu": "staff", "Fenna": "staff", "Mortis": "staff", "Cantor": "lyre",
         "Opaline": "wand", "Shiori": "brush", "Tempo": "staff", "Silvane": "mirror", "Mr. Ledger": "quill", "Gus": "broom",
         "Barry Cloudsley": "staff", "Bo": "crook", "The Great Zambini": "wand", "Wick": "lantern", "Anka": "fan"}
# what was seen per hero, beyond the three faults every hero shares (feet; hands in cloth; the staff on its side)
NOTES = {
    "Kaia": "Her right hand went 10 cm into the storm coat standing: now outside it (sprinting, and in a cast where the clip has the arms, the forearm still brushes the coat's edge). Her staff lay across her chest in every cast, crook at her right shoulder: now upright. Left: as she falls, the crook passes through her hair (death only).",
    "Marin": "Hands sank into the apron standing and sprinting: now in front of it. The flag left while backing off is her hand passing through her water ribbon (a stream, not cloth).",
    "The Great Zambini": "Wand on its side in every cast: now upright. The tailcoat flagged at the walk is the forearm brushing the coat's side, not inside it (checked by eye).",
    "Big Yoko": "Arms rested inside the rope and apron: now held over the rope (his arms stand out about 25 degrees, as a wrestler's would). Left: in his Charge (a lunge) his left forearm presses into his belly for a moment.",
    "Sefu": "Staff on its side in casts: now upright (a dash keeps the clip's hold: upright, the staff went through his apron as he bends). On the list: in Scarab Stride (the dash clip) his tall headdress cuts into his right shoulder for a moment.",
    "Mortis": "Staff on its side in casts: now upright. A hand in the robe while sprinting (10 cm) stays: the robe's sleeve, not the body.",
    "Wick": "His lantern lay on its side, flame sideways, in every cast: now it hangs upright.",
    "Cantor": "The lyre was turned flat like a tray in casts: now upright, strings to the front.",
    "Vesper": "Scepter on its side in casts: now upright. Left as it was: in Mist Waltz (a dash, which keeps the clip's hold) the scepter's foot dips into her skirt for a moment.",
    "Gus": "His broom lay across him in his attack (the staff push) and casts: now upright. Left as they were: in Mop Bucket (a dash) and when stunned the broom's foot passes through his robe for a moment.",
    "Shiori": "Brush on its side in casts: now upright, the ink tip down by her feet. Left: in Flowing Script (a lunge) the brush's foot touches her robe's hem.",
    "Fenna": "Staff on its side in casts: now upright. Left: walking and running, the staff's flower brushes her antlers and its foot the flaring robe (the pack's torch hold, a matter of the staff's length).",
    "Professor Puff": "On the list: he casts with his empty left hand (the pack's only push) while the brass nozzle in his right hangs down.",
    "Opaline": "Wand on its side in casts: now upright. Her right hand hung in the gown: now beside it.",
    "Silvane": "Her hand mirror is held out flat in casts, its face to the target: left as the clip has it (kept upright, as the staffs now are, it turned edge-on).",
    "Mr. Ledger": "Quill on its side in casts: now upright. A flag in the walk is the forearm against the robe's front panel.",
    "Barry Cloudsley": "Staff on its side in casts: now upright.",
    "Bo": "Crook on its side in casts: now upright.",
    "Tempo": "Staff on its side in casts: now upright. Left as it was: in Time Skip (a dash) the staff's foot passes his coat for a moment.",
    "Isolde": "Staff on its side in casts: now upright.",
    "Anka": "Her fan is held out open in casts, its face showing: left as the clip has it (kept upright, as the staffs now are, it turned edge-on).",
    "Oblivion": "Left: in Null Zone the greatsword's pommel sits behind his armour skirt (hidden, not seen).",
    "Sirix": "Left: in Barbed Stinger (a lunge) a claw passes his chest plate for a moment.",
    "Mabel": "Claws hung inside her skirt standing: now beside it.",
    "Grandma Ironknit": "Left: in Knitting Needle the right needle's tip passes her skirt.",
    "Mum": "Her stiff ribbon (as built, known) goes under the floor when she lies dead: not seen.",
    "Zephyr": "His stiff scarf (as built, known) goes under the floor when he lies dead: not seen.",
}


def jpeg(src, dst, width=None, quality=72):
    from PIL import Image
    im = Image.open(src).convert("RGB")
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, quality=quality, optimize=True)


def trim(results):
    """Per hero: the worst of each kind in the standing and moving states and in any state but the fall."""
    out = {}
    for theme, r in results.items():
        rows = r.get("rows", [])
        live = [x for x in rows if x["state"] != "death"]
        moving = [x for x in rows if x["state"] in ("idle", "walk", "run", "sprint", "back")]
        cast = [x for x in live if x["state"][:2] in ("Q ", "W ", "E ", "R ") or x["state"] == "attack"]

        def worst(k, xs):
            if not xs:
                return [0, ""]
            x = max(xs, key=lambda x: x[k])
            return [round(x[k] * 100), x["state"] if x[k] else ""]
        out[theme] = {"hero": r["hero"], "feet": round(rows[0]["below"] * 100) if rows else 0, "armIdle": round(rows[0]["arm"] * 100) if rows else 0,
                      "armMove": worst("arm", moving), "armAny": worst("arm", live), "heldCast": worst("held", cast), "heldAny": worst("held", live)}
    return out


def do_import(src):
    src = Path(src)
    data = OUT / "data"
    data.mkdir(parents=True, exist_ok=True)
    for side in ("before", "after"):
        res = {}
        for f in sorted((src / side).glob("*.json")):
            res.update(json.loads(f.read_text(encoding="utf-8"))["results"])
        (data / f"measure_{side}.json").write_text(json.dumps(trim(res), indent=1), encoding="utf-8")
    m = json.loads((data / "measure_after.json").read_text(encoding="utf-8"))
    for theme, r in m.items():
        jpeg(src / "sheet_before" / f"{theme}.jpg", OUT / theme / "before.jpg", 1500)
        jpeg(src / "sheet_after" / f"{theme}.jpg", OUT / theme / "after.jpg", 1500)
        duel = src / "duel" / r["hero"].replace(" ", "_").replace(".", "") / "duel.jpg"
        if duel.exists() and theme != "pom":
            jpeg(duel, OUT / theme / "duel.jpg", 1350)
    for f in (src / "pairs").glob("*.jpg"):
        jpeg(f, OUT / f"pair_{f.name}", 1400, 78)
    for f in (src / "climb").glob("*/horde.jpg"):
        jpeg(f, OUT / f"climb_{f.parent.name.lower()}.jpg", 1000, 75)


def page():
    data = OUT / "data"
    before = json.loads((data / "measure_before.json").read_text(encoding="utf-8"))
    after = json.loads((data / "measure_after.json").read_text(encoding="utf-8"))
    esc = html.escape
    heroes = sorted(after, key=lambda t: after[t]["hero"])
    cards = []
    for theme in heroes:
        a, b = after[theme], before.get(theme, after[theme])
        name = a["hero"] + (" (Pom)" if theme == "pom" else " (Pim)" if theme == "pim" else "")
        chips = [f"feet {b['feet']} → {a['feet']} cm"]
        if b["armIdle"] >= 4 or a["armIdle"] >= 4:
            chips.append(f"hand in cloth standing {b['armIdle']} → {a['armIdle']} cm")
        if a["hero"] in HOLDERS and a["hero"] not in ("Anka", "Silvane"):
            chips.append(f"{HOLDS[a['hero']]} upright in casts")
        rows = "".join(
            f"<tr><td>{esc(label)}</td><td>{b[k][0] if isinstance(b[k], list) else b[k]}</td><td>{a[k][0] if isinstance(a[k], list) else a[k]}</td>"
            f"<td class=dim>{esc(a[k][1] if isinstance(a[k], list) else '')}</td></tr>"
            for label, k in (("feet under the floor, standing", "feet"), ("hand in body or cloth, standing", "armIdle"),
                             ("hand in body or cloth, walking and running", "armMove"),
                             ("hand in body or cloth, any clip", "armAny"), ("held thing in body, blows and casts", "heldCast"),
                             ("held thing in body, any clip", "heldAny")))
        top = max(a["armAny"][0], a["heldAny"][0])
        where = a["armAny"][1] if a["armAny"][0] >= a["heldAny"][0] else a["heldAny"][1]
        note = NOTES.get(a["hero"], "Besides the feet, nothing measured over 5 cm in any clip." if top <= 5 else
                         f"Besides the feet: the deepest flag left is {top} cm, in {where.split(' (')[0] or 'one clip'}, for a moment; not drawn one by one.")
        duel = OUT / theme / "duel.jpg"
        duel_fig = (f'<figure><img loading="lazy" src="{theme}/duel.jpg" alt="{esc(name)} in a CPU duel"><figcaption>a CPU duel on the game page, '
                    "the game's camera close round the hero at each cast (as it strikes and 0.3 s later) and its attacks</figcaption></figure>") if duel.exists() else ""
        cards.append(f"""
<details id="{theme}"><summary><b>{esc(name)}</b> <span class=chips>{''.join(f'<span>{esc(c)}</span>' for c in chips)}</span></summary>
<p>{esc(note)}</p>
<table><tr><th>measured (cm, the game's size)</th><th>before</th><th>after</th><th>worst in</th></tr>{rows}</table>
<figure><img loading="lazy" src="{theme}/before.jpg" alt="{esc(name)} before: every clip"><figcaption><b>before</b>: standing, walking, sprinting, the attack at its hit, Q W E R at their strike, a hit, a stun, the fall; top close from the side, below the game's camera</figcaption></figure>
<figure class=after><img loading="lazy" src="{theme}/after.jpg" alt="{esc(name)} after: every clip"><figcaption><b>after</b>: the same moments</figcaption></figure>
{duel_fig}
</details>""")
    climbs = "".join(f'<figure><img loading="lazy" src="{p.name}" alt="{p.stem[6:]} on a Climb floor"><figcaption>{esc(p.stem[6:].title())} on floor 4 of the Climb</figcaption></figure>'
                     for p in sorted(OUT.glob("climb_*.jpg")))
    n = len(after)
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heroes' model review</title>
<style>
  :root {{ --bg: #110f14; --card: #1b1820; --line: #352e3c; --ink: #ece4d6; --dim: #b3a99a; --gold: #d2ae55; --before: #8f8a96; --after: #e8b84a; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  main {{ max-width: 1180px; margin: 0 auto; padding: 20px 16px 60px; }}
  h1 {{ font: 700 30px/1.2 Georgia, serif; color: var(--gold); margin: 10px 0 4px; }}
  h2 {{ font: 700 23px/1.3 Georgia, serif; color: var(--gold); margin: 36px 0 6px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }}
  p {{ margin: 8px 0; }}
  .sub, .dim {{ color: var(--dim); }}
  figure {{ margin: 10px 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }}
  figure img {{ display: block; width: 100%; height: auto; }}
  figcaption {{ padding: 6px 10px; font-size: 13.5px; color: var(--dim); }}
  figcaption b {{ color: var(--before); }}
  figure.after figcaption b {{ color: var(--after); }}
  details {{ background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin: 8px 0; }}
  summary {{ cursor: pointer; font-size: 16.5px; }}
  .chips span {{ display: inline-block; font-size: 12.5px; color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 0 8px; margin: 2px 0 2px 6px; }}
  table {{ border-collapse: collapse; font-size: 14px; margin: 8px 0; width: 100%; }}
  th, td {{ border-bottom: 1px solid var(--line); padding: 4px 6px; text-align: left; }}
  th {{ color: var(--dim); font-weight: 600; }}
  ol li, ul li {{ margin: 6px 0; }}
  code {{ font-size: 13.5px; color: var(--dim); }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }}
  @media (max-width: 760px) {{ .grid {{ grid-template-columns: 1fr; }} table {{ font-size: 13px; }} }}
</style>
</head>
<body>
<main>
<h1>The heroes' model review</h1>
<p class="sub">2026-11-16 · all {n} models of the fourth style (Pim and Pom are two) checked through every clip the game plays on them. Not pushed, not deployed.</p>

<h2>What was checked</h2>
<p>Every hero was posed by the game's own figure code through every clip it plays: standing, walking, running, sprinting, backing off,
the basic attack, each of its four spells (with the cast style the game picks), a hit, a stun, a knock-up and the fall. In each pose every
vertex was measured: a held thing (staff, blade, lantern) inside the body, the head, the robe or the cape; a forearm or hand inside the
chest, hips, legs or cloth; a leg coming out through a skirt; the feet under or above the floor. Every flag over a few centimetres was then
drawn with the offending points in red and looked at by eye. Each hero also got a sheet of all its clips (close and from the game's
camera, below in its entry) and a CPU duel on the game page, the {n} spread over all nine arenas, filmed at each cast and attack;
three on a Climb floor. Tools: <code>pipeline/tools/hero-review.js</code>, <code>hero-review-sheet.js</code>,
<code>hero-review-duel.js</code>, <code>hero-review-close.js</code>; this page <code>pipeline/tools/hero-review-page.py</code>.</p>

<h2>What was wrong, and is fixed</h2>
<p>Three faults ran through the whole roster. All three are fixed in the game's code (<code>src/motion/real.ts</code> and two lines in
<code>HeroFigure.followReal</code>): no model was rebuilt, no clip, timing or spell changed, and the fights are the same fights.</p>
<h3>1. Every hero stood sunk into the floor (all {n})</h3>
<p>3 to 12 cm, deepest on Mabel, Professor Puff and Oblivion: the soles and toes were cut off by the floor. The animation pack's own figure
stands exactly on the floor in its idle; our bodies' ankles sit a little lower in a longer leg, and the boots a little under the sole. Each
model is now raised as it loads, by just enough that its lowest sole stands on the floor through the idle. In a stride the big boots of the
heavy heroes rolled their toe or heel up to 13 cm under the floor (the pack's own figure dips 2 to 3): the model now rises by the difference
while that lasts and settles back after, so no sole goes more than about 4 cm under (measured on every hero walking, running, sprinting and
backing off).</p>
<figure><img loading="lazy" src="pair_feet.jpg" alt="Feet of Professor Puff, Mabel, Kaia and Big Yoko, before sunk into the floor, after standing on it"><figcaption><b>before</b> and after: Professor Puff, Mabel, Kaia, Big Yoko</figcaption></figure>
<h3>2. Hands went into coats, robes and aprons (most of the cloth-wearers)</h3>
<p>The pack's clips hang the hands close to a slim figure's hips; on a long coat or a flared robe they went inside it (Kaia's storm coat,
Marin's apron, Shiori's sleeves, Mabel's skirt; up to 15 cm). The older figures have had a fix for this since 2026-11-10 (you accepted it
then): the arm swings out from the shoulder just enough to clear the body's outline, the elbow keeping its bend. The fourth style now has
it too, eased so an arm does not flap in and out with each stride. It never acts during a blow, a cast or a knock-up, where the hands go
where the clip sends them.</p>
<figure><img loading="lazy" src="pair_coat.jpg" alt="Shiori, Zambini, Mabel and Kaia standing, before and after"><figcaption><b>before</b> and after: Shiori, Zambini, Mabel, Kaia (her right hand was inside the coat)</figcaption></figure>
<h3>3. Staffs, scepters, lyres and lanterns lay on their side in every cast (16 of the 18 who hold one in the left hand)</h3>
<p>The pack's push (the clip of every ranged attack and most casts) turns the palm to the front, and what the hand held turned with it:
every staff lay across the chest, its head at the hero's right shoulder and pointing away from the target; Wick's lantern lay on its side.
Now the hand keeps it upright through the blow or cast, as it is held standing: a short one (a scepter, a lyre, a lantern, a wand) leans
toward the target, a long staff stands straight or leans back a little so its foot stays out of the robe. Anka's fan and Silvane's hand mirror
are left as the clip holds them, held out flat: their face is what shows, and upright turned them edge-on. A dash, a slam or a swing
carries the item as its clip does (upright, a staff went through the robe of a hero bent deep into a dash).</p>
<figure><img loading="lazy" src="pair_staff.jpg" alt="Cantor, Vesper, Mortis, Wick, Gus and Kaia at a cast, before and after"><figcaption><b>before</b> and after, at the strike of a cast: Cantor, Vesper, Mortis, Wick, Gus (his attack), Kaia</figcaption></figure>

<h2>For you to decide (not changed)</h2>
<ol>
<li><b>The staffs upright in casts</b> (fix 3 above) changes how 16 heroes look while casting. The head pointed away from the target,
so it is treated as a fault, but it is also a look: if you liked the crosswise thrust better, it is one line to undo (in
<code>HeroFigure.followReal</code>, the line that calls <code>uprightHeld</code>).</li>
<li><b>Professor Puff casts with his empty left hand</b> while the brass nozzle hangs in his right (Q W E R and his attack): the pack has
no right-hand push. A nozzle in the left hand would be a model change (his look), so it is yours to say.</li>
<li><b>Sefu's headdress</b> cuts into his right shoulder for a moment in Scarab Stride (the pack's dash clip bends the head down): a lower
headdress or another clip for that spell would change his look or his motion.</li>
<li><b>Big Yoko's arms</b> now stand out over his rope about 25 degrees (they were inside it). If that reads too wide, the rope could be
built a little slimmer.</li>
<li><b>Fenna's staff</b> brushes her antlers and her robe's flare while she walks: a shorter staff or narrower antlers would change her look.</li>
<li>Small, seen only close and for a moment, left as they are: Kaia's crook through her hair as she falls; Big Yoko's forearm in his belly in
Charge; Gus's broom foot in his robe while stunned; Shiori's brush foot at her hem in Flowing Script; a claw past Sirix's chest in Barbed
Stinger; Grandma Ironknit's needle tip at her skirt in Knitting Needle.</li>
</ol>

<h2>The Blender round</h2>
<p>The other model review's two rebuilds (the Tide Judge's glaive, the harbour's cannons) are on <a href="blender.html">their own page</a>.</p>

<h2>On a Climb floor</h2>
<div class="grid">{climbs}</div>

<h2>Each hero</h2>
<p class="sub">Tap a name. The numbers are the deepest a part went inside another (cm at the game's size; 2 to 4 cm are skin against cloth
and can be ignored); "feet" is how far the soles were under the floor standing. The flags left standing (Zambini, Mortis, Marin, Mr. Ledger,
Referee Whistler, 6 to 14 cm) were drawn and looked at: a fist by a belt, a hand by a robe's front or an apron flap, Marin's hand through her
water ribbon; none is a hand inside cloth. Of the flags left while walking or sprinting, the six deepest
(8 to 11 cm by the measure: Zambini, Mortis, Kaia, Shiori, Mr. Ledger, Oblivion) were drawn and looked at: a forearm brushing a wide sleeve, a
belt, a coat's edge or a hip plate as the arm swings, not a hand inside the body. Vesper, Nyx, Big Yoko and Referee Whistler (6 to 7 cm) are
in the same range and were not drawn one by one. They stay.</p>
{''.join(cards)}
</main>
</body>
</html>
"""
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print(f"wrote {OUT / 'index.html'} ({n} heroes)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--import", dest="src", default="")
    args = ap.parse_args()
    if args.src:
        do_import(args.src)
    page()


if __name__ == "__main__":
    sys.exit(main())
