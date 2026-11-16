"""
A batch's review page: docs/icons/batch-<n>/index.html, like the sample's (docs/icons/sample/): each spell's icon today
beside the new one at 64, 48 and 32 px on the bar's dark background, the new one in grey, a 32 px sheet (zoom32.png,
also under the key letter and in the phone's round slot), each hero's palette row, and the spell bar on desktop and phone.

    python -I pipeline/icons/vectorcraft/page.py 1

The batches, their heroes and the notes written after judging each one are in batches.json (beside this file): it is
also the record of the work's progress. Needs the pictures: docs/icons/old (old-icons.js), docs/icons/new (make.py),
docs/icons/batch-<n>/bar (bar-shots.py), and docs/icons/spells.json (spells.js).
"""
import html
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[2]
DOCS = ROOT / "docs" / "icons"

CSS = """
:root { --bg: #0e0c12; --panel: #17141d; --line: #2c2735; --ink: #ece6da; --muted: #a39cab; --gold: #c9a24a; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 60px; }
h1 { font: 700 26px/1.2 Georgia, serif; margin: 0 0 6px; color: #f4dc94; }
h2 { font: 700 21px/1.3 Georgia, serif; margin: 34px 0 6px; color: #f4dc94; border-top: 1px solid var(--line); padding-top: 20px; }
h3 { margin: 18px 0 8px; font-size: 16px; }
.muted { color: var(--muted); }
.note { background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
.row { display: grid; grid-template-columns: 220px 1fr 1fr; gap: 14px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
.row .name b { display: block; }
.row .name span { color: var(--muted); font-size: 13px; }
.key { display: inline-block; min-width: 20px; padding: 0 5px; margin-right: 6px; border-radius: 4px; border: 1px solid var(--gold); color: #ffd27a; font: 800 12px/18px ui-sans-serif; text-align: center; }
.set { background: #08070b; border-radius: 10px; padding: 10px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.slot { display: block; border-radius: 9px; border: 2px solid #4a3a2a; overflow: hidden; background: #000; }
.slot img { display: block; width: 100%; height: 100%; }
.s64 { width: 64px; height: 64px; } .s48 { width: 48px; height: 48px; border-radius: 7px; } .s32 { width: 32px; height: 32px; border-radius: 5px; border-width: 1px; }
.grey img { filter: grayscale(1); }
.colhead { display: grid; grid-template-columns: 220px 1fr 1fr; gap: 14px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; margin-top: 10px; }
.pal { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.pal span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }
.pal i { width: 20px; height: 20px; border-radius: 5px; border: 1px solid #0006; display: inline-block; }
img.wide { max-width: 100%; border-radius: 8px; border: 1px solid var(--line); display: block; }
.bars { display: grid; grid-template-columns: 2.6fr 1fr; gap: 10px; align-items: start; margin-top: 10px; }
figure { margin: 0; } figcaption { color: var(--muted); font-size: 13px; margin-top: 4px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
code { background: #221e29; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
@media (max-width: 720px) {
  .row, .colhead { grid-template-columns: 1fr; } .colhead { display: none; }
  .bars { grid-template-columns: 1fr; }
}
"""


def sizes(stems):
    import gzip
    out = []
    for stem in stems:
        for f in sorted((ROOT / "public" / "icons" / "spells").glob(f"{stem}-*.svg")):
            b = f.read_bytes()
            out.append((f.stem, len(b), len(gzip.compress(b, 9))))
    return out


def main():
    n = sys.argv[1]
    batches = json.loads((HERE / "batches.json").read_text(encoding="utf-8"))
    batch = batches[n]
    stems = batch["stems"]
    spells = {k["stem"]: k for k in json.loads((DOCS / "spells.json").read_text(encoding="utf-8"))["kits"]}
    import make
    make.heroes()  # loads every hero's module, so PAL holds its row
    from vclib import PAL
    out = DOCS / f"batch-{n}"
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, "-I", str(HERE / "sheet.py"), "pair", str(out / "zoom32.png"), *stems, "--zoom", "2"],
                   check=True, capture_output=True)
    e = html.escape
    parts = [f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
             f"<title>Spell icons, batch {n}</title><style>{CSS}</style></head><body><main>",
             f"<h1>Spell icons, batch {n}: {e(', '.join(spells[s]['name'] if s != 'pom' else 'Pom' for s in stems))}</h1>",
             f"<p class='muted'>{e(batch.get('date', ''))} · drawn with VectorCraft in the family of the sample (docs/icons/sample), "
             "version B (the picture at 118%, over the octagon's edge). Today's icon on the left, the new one on the right, "
             "each drawn the way the game draws it: a 128 px picture brought down to 64, 48 and 32 px. The last of each set "
             "is the new one in grey.</p>"]
    if batch.get("notes"):
        parts.append("<div class='note'><b>What I see</b><ul>" + "".join(f"<li>{e(x)}</li>" for x in batch["notes"]) + "</ul></div>")
    parts.append("<h2>At 32 px</h2><p class='muted'>Each spell: today · new · new in grey · new under the desktop bar's key "
                 "letter · new in the phone's round slot; brought down to 32 px, then shown twice larger.</p>"
                 "<img class='wide' src='zoom32.png' alt='32 px sheet'>")
    for stem in stems:
        k = spells[stem]
        pal = PAL.get(stem, {})
        parts.append(f"<h2 id='{stem}'>{e(k['name'] if stem != 'pom' else 'Pom')} <span class='muted' style='font-size:15px'>{e(k['title'])}</span></h2>")
        if stem in batch.get("rows", {}):
            parts.append(f"<p class='muted'>{e(batch['rows'][stem])}</p>")
        parts.append("<div class='pal'>" + "".join(f"<span><i style='background:{pal[r]}'></i>{r}</span>"
                                                   for r in ("core", "hot", "body", "accent", "dark") if r in pal) + "</div>")
        parts.append("<div class='colhead'><span>Spell</span><span>Today</span><span>New</span></div>")
        for s in k["spells"]:
            slot = s["key"].lower()
            src = stem if (DOCS / "new" / f"{stem}-{slot}.png").exists() else "pim"
            if not (DOCS / "new" / f"{src}-{slot}.png").exists():
                continue
            def sset(folder, grey=False):
                imgs = "".join(f"<span class='slot s{px}'><img src='../{folder}/{src}-{slot}.png' alt=''></span>" for px in (64, 48, 32))
                if grey:
                    imgs += f"<span class='slot s64 grey'><img src='../{folder}/{src}-{slot}.png' alt=''></span>"
                return f"<div class='set'>{imgs}</div>"
            parts.append(f"<div class='row'><div class='name'><b><span class='key'>{s['key']}</span>{e(s['name'])}</b>"
                         f"<span>{e(s['blurb'])}</span></div>{sset('old')}{sset('new', True)}</div>")
        bar = out / "bar"
        if (bar / f"{stem}-desktop.jpg").exists():
            parts.append(f"<div class='bars'><figure><img class='wide' src='bar/{stem}-desktop.jpg' alt=''><figcaption>The spell bar, "
                         f"desktop (1280 wide)</figcaption></figure><figure><img class='wide' src='bar/{stem}-phone.jpg' alt=''>"
                         f"<figcaption>Phone (375 wide)</figcaption></figure></div>")
    rows = sizes(stems)
    if rows:
        tot, totz = sum(r[1] for r in rows), sum(r[2] for r in rows)
        parts.append("<h2>File sizes</h2><p class='muted'>The SVGs the game loads (public/icons/spells/), only when a hero's "
                     "slots are first drawn.</p><table><tr><th>Icon</th><th>SVG</th><th>gzipped</th></tr>"
                     + "".join(f"<tr><td>{a}</td><td class='n'>{b / 1024:.1f} KB</td><td class='n'>{c / 1024:.1f} KB</td></tr>" for a, b, c in rows)
                     + f"<tr><th>All {len(rows)}</th><th class='n'>{tot / 1024:.1f} KB</th><th class='n'>{totz / 1024:.1f} KB</th></tr></table>")
    parts.append("<p class='muted' style='margin-top:30px'>Files: the drawings pipeline/icons/vectorcraft/draw/&lt;hero&gt;.py, "
                 "the shared rules vclib.py, the runner make.py, this page page.py (batches.json holds the notes).</p></main></body></html>")
    (out / "index.html").write_text("\n".join(parts), encoding="utf-8")
    print(f"saved {out / 'index.html'}")


if __name__ == "__main__":
    main()
