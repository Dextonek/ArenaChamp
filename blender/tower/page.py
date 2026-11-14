"""Writes docs/tower/models/index.html, the page of the Climb's 25 people chapter by chapter (names and roles from
src/tower/world/folk.ts, one line each from the first sentence of its Blender module's docstring). Run from the repo root:

    python blender/tower/page.py
"""
import re, ast, html, os
folk = open('src/tower/world/folk.ts', encoding='utf8').read()
rows = re.findall(r"\{ id: '(\w+)', chapter: '(\w+)', name: '([^']+)', title: '([^']+)', slot: '(\w+)'", folk)
CH = [('sea', 'The Sea', 'floors 1 to 10', 'navy and sea-green, the harbour\'s wine, sea-glass light'),
      ('wood', 'The Wood', 'floors 11 to 20', 'forest and moss greens, bark brown, amber light'),
      ('sands', 'The Sands', 'floors 21 to 30', 'night indigo, terracotta, turquoise and saffron'),
      ('deep', 'The Deep', 'floors 31 to 40', 'slate and violet, silver, cold mint and lavender light'),
      ('war', 'The War', 'floors 41 to 50', 'the two banners\' crimson and azure, iron grey, white')]
SLOT = {'keeper': 'Keeper (all ten floors, the main quest)', 'giver': 'Quest giver at the camp', 'village': 'Quest giver out in the land', 'trader': 'Trader'}
def doc(fid):
    ch, n = fid.split('_', 1)
    d = ast.get_docstring(ast.parse(open(f'blender/tower/{ch}/{"fisher" if n=="fisher" else n}.py', encoding='utf8').read()))
    d = ' '.join(d.split())
    first = d.split(': ', 1)[1] if ': ' in d.split('.')[0] else d
    s = first.split('. ')[0].rstrip('.') + '.'
    return s[0].upper() + s[1:]
out = []
for ch, title, floors, colours in CH:
    figs = [r for r in rows if r[1] == ch]
    trade = [r for r in figs if r[4] == 'trader']
    cards = []
    for fid, _, name, ttl, slot in figs:
        extra = ''
        if slot == 'trader':
            extra = ' Stands on the odd floors.' if fid == trade[0][0] else ' Stands on the even floors.'
        cards.append(f'''<figure class="card"><img loading="lazy" src="{fid.replace('_','-')}.jpg" alt="{html.escape(name)}: front, back, the game's camera and the face">
<figcaption><b>{html.escape(name)}</b><span class="role">{SLOT[slot]}{extra}</span><span>{html.escape(doc(fid))}</span></figcaption></figure>''')
    out.append(f'''<section id="{ch}"><h2>{title} <small>{floors} · {colours}</small></h2>
<div class="pair"><figure><img loading="lazy" src="{ch}-lineup-game.jpg" alt="{title}'s five beside Sefu and Kaia from the game's camera"><figcaption>From the game's camera, beside the heroes Sefu and Kaia</figcaption></figure>
<figure><img loading="lazy" src="{ch}-lineup-front.jpg" alt="{title}'s five beside Sefu and Kaia from the front"><figcaption>From the front</figcaption></figure></div>
<div class="cards">{''.join(cards)}</div>
<figure class="wide"><img loading="lazy" src="{ch}-ingame.jpg" alt="In the game: the camp of {title}'s first floor with its people and the keeper's card open"><figcaption>In the game: the camp of floor {CH.index((ch,title,floors,colours))*10+1}, the keeper's card open</figcaption></figure>
</section>''')
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Climb's People</title>
<style>
:root{{--bg:#f4f1ea;--fg:#1d1b21;--mute:#6a6470;--card:#fffdf8;--line:#ddd6c8;--gold:#9a7424}}
@media (prefers-color-scheme: dark){{:root{{--bg:#15141a;--fg:#ece6da;--mute:#a49eaa;--card:#1f1d25;--line:#34303c;--gold:#d2ae55}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:1200px;margin:auto;padding:16px}}
h1{{margin:.2em 0}} h2{{border-top:2px solid var(--gold);padding-top:.6em;margin-top:2em}} h2 small{{display:block;font-size:.6em;color:var(--mute);font-weight:400}}
nav a{{color:var(--gold);margin-right:1em}}
img{{width:100%;height:auto;display:block;border-radius:6px;background:#15141a}}
figure{{margin:0}} figcaption{{font-size:.9em;color:var(--mute);padding:.3em 0}}
.pair{{display:grid;grid-template-columns:1fr;gap:12px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin:14px 0}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px}}
.card b{{display:block;font-size:1.1em;color:var(--fg)}} .card span{{display:block}} .card .role{{color:var(--gold)}}
.wide{{margin-top:8px}}
p{{max-width:70ch}}
</style></head><body><main>
<h1>The Climb's people</h1>
<p>Twenty-five people of their own, five a chapter, in place of the heroes who used to stand in the camps (the user, 2026-11-14:
"make new models for npc, don't reuse them from heroes"). In each chapter the keeper stands on all ten floors; the quest giver at the
camp and the one out in the land each keep their own lines; the two traders take turns, odd floors and even floors. Rivals and
gatekeepers are still heroes: they are fights against a hero. Built like the heroes (the pack's body on the animation pack's
skeleton, blender/tower), each 450 to 550 KB.</p>
<nav>{''.join(f'<a href="#{c[0]}">{c[1]}</a>' for c in CH)}</nav>
{''.join(out)}
</main></body></html>'''
open('docs/tower/models/index.html', 'w', encoding='utf8').write(page)
print(len(rows), 'figures')
