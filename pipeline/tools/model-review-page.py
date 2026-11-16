"""
Builds docs/models/review/index.html, the model review's page for a phone, from its Markdown entries (summary first, then one section
per group: enemies, rulers, people, bosses, arenas, the Blender list, the floor reviewers' list).

    python -I pipeline/tools/model-review-page.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "docs" / "models" / "review"
ORDER = ["summary", "enemies", "rulers", "people", "bosses", "arenas", "blender-list", "floor-placements"]


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<a href="\2"><img src="\2" alt="\1" loading="lazy"></a>', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def md(text):
    out, para, lst, table = [], [], None, []

    def flush():
        nonlocal para, lst, table
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para = []
        if lst:
            tag = lst[0]
            out.append(f"<{tag}>" + "".join(f"<li>{inline(i)}</li>" for i in lst[1]) + f"</{tag}>")
            lst = None
        if table:
            rows = [r for r in table if not re.match(r"^\|[-| ]+\|$", r)]
            cells = [[c.strip() for c in r.strip("|").split("|")] for r in rows]
            h = "".join(f"<th>{inline(c)}</th>" for c in cells[0])
            b = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in cells[1:])
            out.append(f'<div class="tw"><table><tr>{h}</tr>{b}</table></div>')
            table = []

    for line in text.splitlines():
        if line.startswith("|"):
            if para or lst:
                flush()
            table.append(line.strip())
            continue
        if table:
            flush()
        m = re.match(r"^(#{1,3}) (.*)", line)
        if m:
            flush()
            n = len(m.group(1)) + 1
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
            continue
        m = re.match(r"^(\d+\.|-) (.*)", line)
        if m:
            if para:
                flush()
            kind = "ol" if m.group(1)[0].isdigit() else "ul"
            if not lst or lst[0] != kind:
                flush()
                lst = (kind, [])
            lst[1].append(m.group(2))
            continue
        if line.startswith("   ") or line.startswith("  ") and lst:
            if lst:
                lst[1][-1] += " " + line.strip()
                continue
        if not line.strip():
            flush()
            continue
        if lst:
            flush()
        para.append(line.strip())
    flush()
    return "\n".join(out)


def main():
    parts = []
    for name in ORDER:
        p = DIR / f"{name}.md"
        if p.exists():
            parts.append(f'<section id="{name}">' + md(p.read_text(encoding="utf-8")) + "</section>")
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model review</title>
<style>
:root {{ --bg:#15141a; --fg:#e8e2d4; --dim:#a59f92; --gold:#d2ae55; --card:#1f1d25; }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, sans-serif; }}
main {{ max-width:980px; margin:0 auto; padding:16px; }}
h1 {{ color:var(--gold); font-size:1.6em; margin:0.4em 0; }}
h2 {{ color:var(--gold); border-top:1px solid #333; padding-top:0.8em; margin-top:1.6em; }}
h3 {{ color:#e8c87a; }}
a {{ color:#9fd0ff; }}
code {{ background:#2a2733; padding:0 4px; border-radius:3px; font-size:0.88em; word-break:break-word; }}
img {{ max-width:100%; height:auto; display:block; margin:8px 0; border-radius:6px; }}
.tw {{ overflow-x:auto; }}
table {{ border-collapse:collapse; font-size:0.85em; margin:8px 0; }}
td, th {{ border:1px solid #3a3644; padding:4px 6px; vertical-align:top; }}
th {{ background:var(--card); }}
section {{ margin-bottom:1em; }}
li {{ margin:0.3em 0; }}
</style></head><body><main>
<h1>The model review, 2026-11-16</h1>
{''.join(parts)}
</main></body></html>
"""
    (DIR / "index.html").write_text(page, encoding="utf-8")
    print("wrote", DIR / "index.html")


if __name__ == "__main__":
    main()
