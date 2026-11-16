"""
The page of step 4 of the hero framework (docs/pipeline/hero-framework.md): the other 39 heroes moved into folders, batch by
batch, with each batch's proof.

    python pipeline/tools/hero-move-page.py

Reads docs/pipeline/hero-framework/progress.json (written by hand after each batch: the heroes, the checks' results, the
start size) and counts the lines of each moved hero's folder; writes docs/pipeline/hero-framework/progress.html.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "docs" / "pipeline" / "hero-framework"
DATA = DIR / "progress.json"
OUT = DIR / "progress.html"


def lines(p):
    return len(p.read_text(encoding="utf-8").splitlines())


def folder_lines(theme):
    d = ROOT / "src" / "heroes" / theme
    out = {}
    for f in sorted(d.rglob("*.ts")):
        out[f.relative_to(d).as_posix()] = lines(f)
    return out


def before_of(base, commit, theme):
    """The lines and files a hero had before its move: the files git sees renamed into its folder, counted at `base`."""
    import subprocess
    out = subprocess.run(["git", "diff", "--name-status", "-M30%", base, commit], cwd=str(ROOT),
                         capture_output=True, text=True, check=True).stdout
    n = files = 0
    for line in out.splitlines():
        parts = line.split("	")
        moved = parts[0].startswith("R") and parts[2].startswith(f"src/heroes/{theme}/")
        # a kit split into the card and its icons can be too changed for git to call it a rename
        if moved or (parts[0] == "D" and parts[1] == f"src/kits/{theme}.ts"):
            old = parts[1]
            text = subprocess.run(["git", "show", f"{base}:{old}"], cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", check=True).stdout
            n += len(text.splitlines())
            files += 1
    return n, files


def esc(s):
    return html.escape(str(s))


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    batches = data["batches"]
    moved = [h for b in batches for h in b["heroes"]]
    total = 40
    done = len(moved) + 1  # and Anka (step 3)
    blocks_spells = sum(h.get("blocks", 0) for h in moved)

    rows = []
    for b in batches:
        hero_cards = []
        for h in b["heroes"]:
            now = folder_lines(h["theme"]) if (ROOT / "src" / "heroes" / h["theme"]).exists() else {}
            after = sum(now.values())
            before, nfiles = before_of(b["base"], b["commit"], h["theme"])
            w = 100 * before / 3300
            w2 = 100 * after / 3300
            files = "".join(f"<li><code>{esc(k)}</code> {v}</li>" for k, v in now.items())
            hero_cards.append(f"""
<div class="hero">
  <div class="hname">{esc(h['name'])} <small>{esc(h['theme'])}/</small></div>
  <div class="bar"><span class="b0" style="width:{w:.0f}%"></span></div>
  <div class="bar"><span class="b1" style="width:{w2:.0f}%"></span></div>
  <div class="nums"><span>before {before:,} lines in {nfiles} files</span><span>after {after:,} lines in one folder</span></div>
  <div class="nums"><span>spells on the blocks: <b>{h.get('blocks', 0)} of 4</b></span></div>
  <details><summary>the folder</summary><ul class="fl">{files}</ul></details>
</div>""")
        checks = "".join(f"<li class=\"{'ok' if c['ok'] else 'bad'}\"><b>{esc(c['name'])}</b> {esc(c['result'])}</li>" for c in b["checks"])
        rows.append(f"""
<section class="card">
  <h2>{esc(b['title'])}</h2>
  <p class="sub">{esc(b['when'])} &middot; commit <code>{esc(b['commit'])}</code></p>
  <div class="heroes">{''.join(hero_cards)}</div>
  <h3>The proof</h3>
  <ul class="checks">{checks}</ul>
  {('<p>' + esc(b['note']) + '</p>') if b.get('note') else ''}
</section>""")

    size = data["size"]
    size_rows = "".join(
        f"<div class=\"srow\"><span>{esc(s['when'])}</span><div class=\"strack\"><span style=\"width:{100 * s['kb'] / 8000:.0f}%\"></span></div><b>{s['kb']:,} KB</b><small>{s['gz']:,} KB packed</small></div>"
        for s in size)
    found = "".join(f"<li>{esc(f)}</li>" for f in data.get("found", []))

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heroes into folders</title>
<style>
:root {{
  color-scheme: light;
  --bg: #f6f4ef; --card: #fffdf8; --ink: #1d1b17; --ink2: #57534b; --muted: #8a857a; --line: #e2ddd2;
  --old: #b9b2a3; --new: #2a78d6; --ok: #1f8a4c; --okbg: #e3f3e8; --warn: #b5530c; --warnbg: #fbeadc; --code: #f1ede3;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --bg: #15140f; --card: #1f1d18; --ink: #f0efec; --ink2: #c3c2b7; --muted: #8f8b80; --line: #34312a;
    --old: #5c574c; --new: #3987e5; --ok: #4cc27c; --okbg: #183022; --warn: #f0965a; --warnbg: #3a2416; --code: #26241e;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #15140f; --card: #1f1d18; --ink: #f0efec; --ink2: #c3c2b7; --muted: #8f8b80; --line: #34312a;
  --old: #5c574c; --new: #3987e5; --ok: #4cc27c; --okbg: #183022; --warn: #f0965a; --warnbg: #3a2416; --code: #26241e;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
main {{ max-width: 860px; margin: 0 auto; padding: 20px 16px 60px; }}
h1 {{ font-size: 26px; margin: 8px 0 4px; }}
h2 {{ font-size: 20px; margin: 0 0 4px; }}
h3 {{ font-size: 16px; margin: 16px 0 6px; }}
p {{ color: var(--ink2); margin: 6px 0 10px; }}
.sub {{ color: var(--muted); font-size: 14px; }}
.card {{ background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin: 14px 0; }}
.tiles {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 14px 0; }}
.tile {{ background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }}
.tile b {{ display: block; font-size: 28px; line-height: 1.1; }}
.tile span {{ color: var(--ink2); font-size: 14px; }}
.dots {{ display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0; }}
.dots i {{ width: 16px; height: 16px; border-radius: 50%; background: var(--line); display: inline-block; }}
.dots i.on {{ background: var(--new); }}
.heroes {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }}
.hero {{ border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }}
.hname {{ font-weight: 600; }}
.hname small {{ color: var(--muted); font-weight: 400; }}
.bar {{ height: 8px; margin: 4px 0; }}
.bar span {{ display: block; height: 100%; border-radius: 0 4px 4px 0; }}
.b0 {{ background: var(--old); }}
.b1 {{ background: var(--new); }}
.nums {{ display: flex; justify-content: space-between; gap: 6px; font-size: 12.5px; color: var(--ink2); flex-wrap: wrap; }}
details summary {{ cursor: pointer; font-size: 13px; color: var(--muted); }}
ul.fl {{ margin: 4px 0; padding-left: 16px; font-size: 12.5px; }}
ul.fl code {{ font-size: 12px; }}
ul.checks {{ list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }}
ul.checks li {{ padding: 6px 10px; border-radius: 8px; font-size: 14px; }}
ul.checks li.ok {{ background: var(--okbg); }}
ul.checks li.ok b {{ color: var(--ok); }}
ul.checks li.bad {{ background: var(--warnbg); }}
ul.checks li.bad b {{ color: var(--warn); }}
.legend {{ font-size: 13px; color: var(--ink2); display: flex; gap: 14px; flex-wrap: wrap; }}
.legend i {{ display: inline-block; width: 12px; height: 8px; border-radius: 2px; margin-right: 4px; }}
.srow {{ display: grid; grid-template-columns: minmax(90px, 30%) 1fr auto; gap: 8px; align-items: center; font-size: 14px; margin: 4px 0; }}
.srow small {{ grid-column: 3; color: var(--muted); font-size: 12px; text-align: right; }}
.strack span {{ display: block; height: 14px; background: var(--new); border-radius: 0 4px 4px 0; }}
code {{ background: var(--code); border-radius: 4px; padding: 0 3px; }}
ul.found li {{ color: var(--ink2); margin: 4px 0; }}
</style>
</head>
<body>
<main>
<p class="sub"><a href="index.html">The hero framework</a> &middot; <a href="anka.html">Anka, the sample</a></p>
<h1>Heroes into folders</h1>
<p>Each hero now lives in one folder (<code>src/heroes/&lt;name&gt;/</code>): its card, its passive, its four spells, its look parts and
its icons. The game finds the folders by itself. Moved in batches; after every batch all 80 fight prints must be the same.
The moves change no spell: each spell file moved as it was, so a hero's lines stay about the same (its card adds about 40).
The next step puts the spells onto the shared blocks, a spell at a time; that is where they get shorter.</p>

<div class="tiles">
  <div class="tile"><b>{done} of {total}</b><span>heroes in folders</span></div>
  <div class="tile"><b>{len(batches)}</b><span>batches done</span></div>
  <div class="tile"><b>{blocks_spells}</b><span>spells moved onto the blocks (besides Anka's 4)</span></div>
</div>
<div class="dots">{''.join('<i class="on"></i>' for _ in range(done))}{''.join('<i></i>' for _ in range(total - done))}</div>

<div class="legend"><span><i style="background:var(--old)"></i>lines before (spread over many folders)</span><span><i style="background:var(--new)"></i>lines after (one folder)</span></div>
{''.join(rows)}

<section class="card">
  <h2>The game's first download</h2>
  <p>The script a player waits for before the first picture. It must not grow.</p>
  {size_rows}
</section>

{('<section class="card"><h2>Found on the way</h2><p>Not changed (the moves change nothing); for later.</p><ul class="found">' + found + '</ul></section>') if found else ''}
</main>
</body>
</html>
"""
    OUT.write_text(page, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {done} of {total} heroes, {len(batches)} batches")


if __name__ == "__main__":
    main()
