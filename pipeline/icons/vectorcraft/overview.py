"""
The overview of all 40 heroes' spell icons for the user: docs/icons/index.html. Each hero's four new icons at 64 and
32 px beside today's at 32, in the order of the heroes' list, with its batch page one tap away; then what is weakest,
the palette rows added to the art bible, the sizes and how the game loads them.

    python -I pipeline/icons/vectorcraft/overview.py

Reads batches.json (the batches and their notes), docs/icons/spells.json, docs/icons/new and docs/icons/old.
"""
import gzip
import html
import json
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
h1 { font: 700 27px/1.2 Georgia, serif; margin: 0 0 6px; color: #f4dc94; }
h2 { font: 700 21px/1.3 Georgia, serif; margin: 34px 0 8px; color: #f4dc94; border-top: 1px solid var(--line); padding-top: 20px; }
a { color: #f4dc94; }
.muted { color: var(--muted); }
.note { background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px; }
.hero { background: #08070b; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.hero .who { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.hero .who b { font: 700 16px Georgia, serif; }
.hero .who span { color: var(--muted); font-size: 12px; }
.icons { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.icons img { display: block; border-radius: 8px; border: 2px solid #4a3a2a; background: #000; }
.i64 { width: 64px; height: 64px; }
.i32 { width: 32px; height: 32px; border-radius: 5px !important; border-width: 1px !important; }
.small { display: flex; gap: 4px; margin-top: 6px; align-items: center; font-size: 11px; color: var(--muted); }
.small .lab { width: 42px; }
img.wide { max-width: 100%; border-radius: 8px; border: 1px solid var(--line); display: block; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
code { background: #221e29; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
ul { padding-left: 20px; } li { margin: 4px 0; }
"""


def main():
    batches = json.loads((HERE / "batches.json").read_text(encoding="utf-8"))
    kits = json.loads((DOCS / "spells.json").read_text(encoding="utf-8"))["kits"]
    where = {}
    for n, b in batches.items():
        if n.isdigit():
            for s in b["stems"]:
                where[s] = f"batch-{n}/index.html#{s}"
    where.setdefault("anka", "sample/index.html")
    where.setdefault("mum", "sample/index.html")
    e = html.escape
    svgs = sorted((ROOT / "public" / "icons" / "spells").glob("*.svg"))
    raw = sum(f.stat().st_size for f in svgs)
    gz = sum(len(gzip.compress(f.read_bytes(), 9)) for f in svgs)
    out = [f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
           f"<title>Spell icons, all forty</title><style>{CSS}</style></head><body><main>",
           "<h1>Spell icons: all forty heroes</h1>",
           f"<p class='muted'>2026-11-16 · {len(svgs)} icons drawn with VectorCraft in one family, version B (the picture at 118%, "
           "its big shapes over the octagon's edge). Each hero below: the four new icons at 64 px, then at 32 px, and today's "
           "at 32 px under them. Tap a hero for its batch page (bigger, in grey, in the real spell bar on desktop and phone).</p>",
           "<div class='note'><b>The rules of the family:</b> one octagon medallion with a thin gold edge on the hero's dark ground; "
           "light from the upper left; one ink outline; the hero's palette row from the art bible; gold only on edges and small "
           "details; one sign of the hero in all four icons; the lower left kept quiet for the key letter. Pim and Pom count as "
           "one hero with seven icons: Tag Out is one spell for both twins.</div>",
           "<h2>The forty</h2><div class='grid'>"]
    seen = set()
    for k in kits:
        stem = k["stem"]
        if stem in seen:
            continue
        seen.add(stem)
        name = "Pom" if stem == "pom" else ("Pim" if stem == "pim" else k["name"])
        slots = [s["key"].lower() for s in k["spells"] if (DOCS / "new" / f"{stem}-{s['key'].lower()}.png").exists()]
        big = "".join(f"<img class='i64' src='new/{stem}-{s}.png' alt='{e(name)} {s.upper()}'>" for s in slots)
        small = "".join(f"<img class='i32' src='new/{stem}-{s}.png' alt=''>" for s in slots)
        old = "".join(f"<img class='i32' src='old/{stem}-{s}.png' alt=''>" for s in slots)
        out.append(f"<div class='hero'><div class='who'><a href='{where.get(stem, '#')}'><b>{e(name)}</b></a><span>{e(k['title'])}</span></div>"
                   f"<div class='icons'>{big}</div><div class='small'><span class='lab'>new</span>{small}</div>"
                   f"<div class='small'><span class='lab'>today</span>{old}</div></div>")
    out.append("</div>")
    out.append("<h2>All of them at 32 px</h2><p class='muted'>The size of the smallest slot, as a browser draws them.</p>"
               "<img class='wide' src='all-32.png' alt='Every new icon at 32 px'>")
    out.append("<h2>What I would look at first</h2><ul>")
    for n in sorted(k for k in batches if k.isdigit()):
        for note in batches[n].get("notes", []):
            if note.startswith(("Weakest", "A taste call")):
                out.append(f"<li><a href='batch-{n}/index.html'>Batch {n}</a>: {e(note)}</li>")
    out.append("</ul>")
    out.append("<h2>Palette rows added to the art bible</h2><p class='muted'>Section 2 of docs/ART_BIBLE.md had no row for "
               "the newer heroes; each got one from its kit's own colours (the others use the rows already there).</p><table>"
               "<tr><th>Row</th><th>Hero</th><th>Batch</th></tr><tr><td>Dusk / chalk</td><td>Mum</td><td>the sample</td></tr>")
    for n in sorted(k for k in batches if k.isdigit()):
        for stem, (row, foils) in batches[n].get("bible", {}).items():
            out.append(f"<tr><td>{e(row)}</td><td>{e(foils.split(';')[0])}</td><td>{n}</td></tr>")
    out.append("</table>")
    out.append(f"<h2>Sizes and loading</h2><ul><li>{len(svgs)} SVG files in <code>public/icons/spells/</code>: {raw / 1024:.0f} KB, "
               f"{gz / 1024:.0f} KB as sent (gzipped), about {gz / 1024 / 41:.1f} KB a hero.</li>"
               "<li>Nothing is fetched when the page opens: a hero's four files are asked for the first time one of its slots is "
               "drawn (the spell bar, the Play screen, the Heroes table, the Shop). Until they arrive, or if one fails, the old "
               "canvas icon is drawn, and the new picture replaces it in the same place.</li>"
               "<li>The page's start grows by about half a kilobyte (the list of drawn heroes and the loader).</li>"
               "<li>The code: <code>src/icons/vc.ts</code> (the loader) and two lines in <code>src/heroes.ts</code> that call it. "
               "Nothing else in the game changed.</li></ul>")
    out.append("<h2>Remaking an icon</h2><p>Each hero's drawing is <code>pipeline/icons/vectorcraft/draw/&lt;hero&gt;.py</code>; "
               "the shared rules are in <code>vclib.py</code>. <code>python pipeline/icons/vectorcraft/make.py &lt;hero&gt; [slot]</code> "
               "writes the command file and runs VectorCraft, and adds the hero to the game's list. "
               "<code>page.py &lt;batch&gt;</code> remakes a batch page, <code>overview.py</code> this one.</p>")
    out.append("</main></body></html>")
    (DOCS / "index.html").write_text("\n".join(out), encoding="utf-8")
    print(f"saved {DOCS / 'index.html'}")


if __name__ == "__main__":
    main()
