"""
The Climb review's page (docs/tower/review/floors-01-30/index.html) and each floor's entry (fNN/README.md), from each floor's
`entry.json` (written by the reviewer) and the parts' JSON (climb-review-floor.py). Pictures named in an entry are copied from the raw
folder into the floor's folder, made 960 px wide (a phone picture 390), so the repo keeps only the chosen few.

    python -I pipeline/tools/climb-review-page.py [--raw <raw pictures folder>] [--group floors-01-30]

entry.json: { "floor": 1, "verdict": "...", "found": [{ "kind": "fixed" | "list" | "ok", "title": "...", "text": "...",
              "pics": [["file.jpg", "caption"], ...] }], "pictures": [["file.jpg", "caption"], ...], "left": ["..."],
              "notChecked": ["..."] }
"""
import argparse
import html
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CHAPTERS = {0: 'I. The Sea', 1: 'II. The Wood', 2: 'III. The Sands', 3: 'IV. The Deep', 4: 'V. The War'}


def load(folder, name):
    p = folder / f'{name}.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None


def copy_pic(raw, folder, name):
    dst = folder / name
    src = raw / folder.name / name if raw else None
    if src and src.exists():
        im = Image.open(src).convert('RGB')
        w = 390 if name.startswith('phone') or im.width < 600 else 960
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(dst, quality=74, optimize=True)
    return dst.exists()


def numbers(folder):
    """The floor's measured facts, as short lines."""
    s, r, sh = (load(folder, k) for k in ('static', 'route', 'shots'))
    rows = []
    if s:
        x = s['result']
        st = x['check']['states']
        cut = sum(len(q['unreachable']) for q in st)
        rows.append(f"Reachable from the camp: {', '.join(str(q['reachableM2']) + ' m²' for q in st)}; {x['check']['states'][0]['spots']} spots of the floor's data, {cut} cut off")
        c = x.get('props', {}).get('counts', {})
        if c:
            rows.append(f"Props probe: {c.get('float', 0)} float, {c.get('gap', 0)} gap, {c.get('buried', 0)} buried, {c.get('cover', 0)} in cover (sorted by kind; one or more of each kind looked at by eye)")
        steep = sum(k['over06'] for k in x.get('grass', {}).get('kinds', []))
        rows.append(f"Grass and small things on ground steeper than 31°: {steep}")
        rows.append(f"Packs table for the open world (server/climb-packs.mjs): {'matches' if x['packsTable'].get('same') else 'DIFFERS'}")
    if r and r['result'].get('route'):
        q = r['result']['route']
        rows.append(f"Route bot (Lyra): {'cleared' if q['floorCleared'] else 'NOT cleared'} in {round(q['seconds'])} game s, every checkpoint {'reached' if not q['notDone'] else 'reached but ' + ', '.join(q['notDone'])}; {q['kills']} kills, {q['falls']} falls, stars {''.join(str(v) for v in q['stars'])}; ruler tries {q['rulerTries']}, gate tries {q['gateTries']}; page errors {len(q['errors']) + len(r['errors'])}")
    if sh:
        x = sh['result']
        if x.get('ruler'):
            u = x['ruler']
            rows.append(f"Ruler: {u['name']} ({u['title']}), model {u['model'] or 'none (crown or stand-in)'}, loaded {'yes' if u['loaded'] else 'NO'} (its picture taken {u['wallMs']} ms of real time into the fight)")
        if x.get('frames'):
            f = x['frames']
            rows.append(f"Frame check at the busiest spot ({f['at'][0]}, {f['at'][1]}), {f['units']} units awake: median {', '.join(str(v['med']) for v in f['runs'])} ms, p95 {', '.join(str(v['p95']) for v in f['runs'])} ms (desktop, machine shared: rough)")
        rows.append(f"Console errors while taking the pictures: {len(sh['errors'])}")
    return rows


def esc(t):
    return html.escape(t, quote=True)


def dot(t):
    return t if t[-1:] in '.?!' else t + '.'


def build(group, raw):
    base = ROOT / 'docs' / 'tower' / 'review' / group
    floors = []
    for folder in sorted(base.glob('f[0-9][0-9]')):
        e = load(folder, 'entry')
        if not e:
            continue
        for item in e.get('found', []):
            for p in item.get('pics', []):
                copy_pic(raw, folder, p[0])
        for p in e.get('pictures', []):
            copy_pic(raw, folder, p[0])
        s = load(folder, 'static')
        e['_name'] = s['result']['texts']['name'] if s else ''
        e['_numbers'] = numbers(folder)
        e['_folder'] = folder.name
        floors.append(e)
        write_md(folder, e)
    write_html(base, group, floors)
    print(f'{len(floors)} floors on the page')


def write_md(folder, e):
    L = [f"# Floor {e['floor']}: {e['_name']}", '', e.get('verdict', ''), '', '## Measured', '']
    L += [f'- {r}' for r in e['_numbers']]
    L += ['', '## Found', '']
    for it in e.get('found', []):
        L.append(f"- **{it['kind']}: {dot(it['title'])}** {it.get('text', '')}")
        for p in it.get('pics', []):
            L.append(f"  - ![{p[1]}]({p[0]}) {p[1]}")
    if e.get('left'):
        L += ['', '## Left for the user', ''] + [f'- {x}' for x in e['left']]
    if e.get('notChecked'):
        L += ['', '## Not checked', ''] + [f'- {x}' for x in e['notChecked']]
    L += ['', '## Pictures', ''] + [f'![{p[1]}]({p[0]})  \n{p[1]}\n' for p in e.get('pictures', [])]
    (folder / 'README.md').write_text('\n'.join(L) + '\n', encoding='utf-8')


CSS = """
:root{--bg:#f6f1e7;--fg:#2a241c;--mut:#6b5f4f;--card:#fffaf0;--line:#e2d6bf;--gold:#a5781d;--ok:#2f7a45;--fix:#1f5e9e;--list:#a1402c}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){--bg:#17140f;--fg:#ede4d3;--mut:#a8997f;--card:#211c15;--line:#3a3124;--gold:#d8ae55;--ok:#6cc38a;--fix:#7fb4ea;--list:#ec8a73}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 Georgia,'Times New Roman',serif}
main{max-width:980px;margin:0 auto;padding:16px}h1{font-size:1.6em;margin:.4em 0}h2{font-size:1.25em;margin:1.6em 0 .3em;border-bottom:1px solid var(--line);padding-bottom:.2em}
h3{font-size:1.05em;margin:.9em 0 .2em}.mut{color:var(--mut)}.toc{display:flex;flex-wrap:wrap;gap:6px;margin:.6em 0}.toc a{padding:4px 9px;border:1px solid var(--line);border-radius:14px;text-decoration:none;color:var(--fg);background:var(--card);font-size:.9em}
.toc a.f{border-color:var(--fix)}.toc a.l{border-color:var(--list)}
section.floor{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}
.tag{display:inline-block;font:12px/1.6 system-ui,sans-serif;padding:0 7px;border-radius:9px;color:#fff;margin-right:6px}.tag.fixed{background:var(--fix)}.tag.list{background:var(--list)}.tag.ok{background:var(--ok)}
ul{padding-left:1.2em;margin:.3em 0}li{margin:.15em 0}.nums li{font-size:.92em}
.pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin:.5em 0}.pics figure{margin:0}.pics img{width:100%;border-radius:6px;border:1px solid var(--line);display:block}
.pics figure.ph img{max-width:200px}figcaption{font-size:.85em;color:var(--mut)}details summary{cursor:pointer;color:var(--gold)}
.sum{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
"""


def pics_html(folder, pics):
    out = ['<div class="pics">']
    for p in pics:
        cls = ' class="ph"' if p[0].startswith('phone') else ''
        out.append(f'<figure{cls}><a href="{folder}/{esc(p[0])}"><img loading="lazy" src="{folder}/{esc(p[0])}" alt="{esc(p[1])}"></a><figcaption>{esc(p[1])}</figcaption></figure>')
    out.append('</div>')
    return '\n'.join(out)


def span(group):
    a, b = group[7:].split('-')
    return f'{int(a)} to {int(b)}'


def write_html(base, group, floors):
    fixed = [(e['floor'], it) for e in floors for it in e.get('found', []) if it['kind'] == 'fixed']
    listed = [(e['floor'], it) for e in floors for it in e.get('found', []) if it['kind'] == 'list']
    H = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
         f'<title>Climb Review {span(group)}</title><style>{CSS}</style></head><body><main>',
         f'<h1>The Climb, floor by floor: {span(group)}</h1>',
         '<p class="mut">Each floor played in the real game (headless browser, time stepped by hand): the route bot from camp to gate, every person, '
         'pack, door and the ruler, the map, the phone view, the props probe, the texts against the lore. Faults that were clearly slips were fixed '
         '(blue); bigger ones or matters of taste are listed for you (red). The look was judged by eye against the art bible (mythic and elegant, never cartoon-goofy); the texts against the Codex Climb pages (docs/lore/codex/climb/). Times are rough: the machine was shared with other agents.</p>',
         f'<div class="sum"><b>{len(floors)} floors checked</b> · <b>{len(fixed)} fixed</b> · <b>{len(listed)} for you</b></div>']
    if listed:
        H.append('<h2>For you to decide</h2><ul>')
        for n, it in listed:
            H.append(f'<li><a href="#f{n:02d}">Floor {n}</a>: <b>{esc(dot(it["title"]))}</b> {esc(it.get("text", ""))}</li>')
        H.append('</ul>')
    if fixed:
        H.append('<h2>Fixed</h2><ul>')
        for n, it in fixed:
            H.append(f'<li><a href="#f{n:02d}">Floor {n}</a>: <b>{esc(dot(it["title"]))}</b> {esc(it.get("text", ""))}</li>')
        H.append('</ul>')
    H.append('<h2>Floors</h2><div class="toc">')
    for e in floors:
        k = ' f' if any(i['kind'] == 'fixed' for i in e.get('found', [])) else ''
        k += ' l' if any(i['kind'] == 'list' for i in e.get('found', [])) else ''
        H.append(f'<a class="{k.strip()}" href="#f{e["floor"]:02d}">{e["floor"]}</a>')
    H.append('</div>')
    last = None
    for e in floors:
        ch = (e['floor'] - 1) // 10
        if ch != last:
            H.append(f'<h2>{CHAPTERS[ch]}</h2>')
            last = ch
        H.append(f'<section class="floor" id="f{e["floor"]:02d}"><h3>Floor {e["floor"]}: {esc(e["_name"])}</h3><p>{esc(e.get("verdict", ""))}</p>')
        for it in e.get('found', []):
            H.append(f'<p><span class="tag {it["kind"]}">{it["kind"]}</span><b>{esc(dot(it["title"]))}</b> {esc(it.get("text", ""))}</p>')
            if it.get('pics'):
                H.append(pics_html(e['_folder'], it['pics']))
        H.append('<details><summary>What was measured</summary><ul class="nums">' + ''.join(f'<li>{esc(r)}</li>' for r in e['_numbers']) + '</ul>')
        if e.get('notChecked'):
            H.append('<p class="mut">Not checked: ' + esc('; '.join(e['notChecked'])) + '</p>')
        H.append('</details>')
        if e.get('pictures'):
            H.append(pics_html(e['_folder'], e['pictures']))
        H.append('</section>')
    H.append('</main></body></html>')
    (base / 'index.html').write_text('\n'.join(H), encoding='utf-8')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default='')
    ap.add_argument('--group', default='floors-01-30')
    a = ap.parse_args()
    build(a.group, Path(a.raw) if a.raw else None)
