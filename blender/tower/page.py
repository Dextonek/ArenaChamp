"""Writes docs/tower/models/index.html, the page of the Climb's 25 people chapter by chapter (names and roles from
src/tower/world/folk.ts, one line each from the first sentence of its Blender module's docstring), then its rulers and its
enemies (FOES below: the same tables as src/tower/world/pieces/rulerModels.ts and src/tower/world/foeKinds.ts). Run from the
repo root:

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
# The rulers and the enemies: (id, name, where it stands). Kept by hand beside the game's tables.
FOES = {
    'rulers': [
        ('sea_admiral', 'The Drowned Admiral', 'floors 1 (the Drowned Captain), 2, 3'),
        ('sea_queen', 'The Drowned Queen', 'floors 4 (Mother of Wrecks), 6 (the Pearl Tyrant), 9 (the Gull Queen)'),
        ('sea_judge', 'The Bell Judge', 'floors 5 (the Tide Judge), 7 (the Bell Below), 8 (the Lantern Leviathan)'),
        ('wood_elder', 'The Elder Root', 'floors 11, 12 (the Moss Warden), 15 (the Hollow Elder)'),
        ('wood_briar', 'The Briar Queen', 'floors 13 (the Thorn Mother), 16 (the Briar Witch), 19 (the Mire Heart)'),
        ('wood_antler', 'The Antler King', 'floors 14, 17 (the Lantern Root), 18 (the Grey Oak)'),
        ('sands_scarab', 'The Scarab King', 'floors 21 (the Scarab Colossus), 22, 23 (the Dune Colossus)'),
        ('sands_sphinx', 'The Brass Sphinx', 'floors 24, 26 (the Mirage Lord), 29 (the Sun-Eater)'),
        ('sands_jackal', 'The Red Jackal', 'floors 25 (the Glass Serpent), 27 (the Sand Tyrant), 28'),
        ('deep_prism', 'The Prism Mother', 'floors 31, 32 (the Hollow Queen), 35 (Mother of Echoes)'),
        ('deep_lamp', 'The Lamp Warden', 'floors 33, 37 (the Blind Cantor), 39 (the Drowned Lantern)'),
        ('deep_seam', 'The Seam King', 'floors 34 (the Glass Abbot), 36, 38 (the Gem Tyrant)'),
        ('war_marshal', 'The Last Marshal', 'floors 41, 42 (the Iron Marshal), 45 (the Banner Knight)'),
        ('war_siege', 'The Siege Lord', 'floors 43, 44 (the Ashen General), 48 (the War Drummer)'),
        ('war_crow', 'The Crow King', 'floors 46, 47 (the Black Herald), 49 (the Grey Captain)'),
    ],
    'enemies': [
        ('sea_docker', 'Drowned docker', 'melee'), ('sea_netter', 'Net caster', 'caster: its net roots you'),
        ('sea_mate', 'The Harbourmaster’s Mate', 'the big one; Old Barnacle under a pale tint'),
        ('wood_giant', 'Moss giant', 'heavy melee'), ('wood_sprite', 'Thorn sprite', 'caster: throws thorns'), ('wood_oak', 'The Hollow Oak', 'named, the big one'),
        ('sands_raider', 'Raider', 'melee'), ('sands_slinger', 'Slinger', 'ranged: throws stones'),
        ('sands_chief', 'The Raider Chief', 'the big one; the rider and the Dune Mother under their tints'),
        ('deep_lurker', 'Lurker', 'melee: leaps from the dark'), ('deep_thief', 'The Lantern Thief', 'the big one'), ('deep_pale', 'The Pale One', 'named'),
        ('war_footman', 'Footman', 'melee: crimson, azure, or ash for those of neither army'), ('war_bowman', 'Bowman', 'ranged: crimson or azure'),
        ('war_knight', 'Knight', 'the big one: the armies’ knights; the Banner Bearer in black; the Deserter in grey'),
    ],
}


def foe_section(kind, head, intro):
    parts = [f'<section id="{kind}"><h2>{head}</h2><p>{intro}</p>']
    for ch, title, floors, colours in CH:
        figs = [f for f in FOES[kind] if f[0].startswith(ch + '_')]
        cards = []
        for fid, name, where in figs:
            cards.append(f"""<figure class="card"><img loading="lazy" src="{fid.replace('_', '-')}.jpg" alt="{html.escape(name)}: front, back, the game's camera and the face">
<figcaption><b>{html.escape(name)}</b><span class="role">{html.escape(where)}</span><span>{html.escape(doc(fid))}</span></figcaption></figure>""")
        what = 'pack fighting the hero' if kind == 'enemies' else "ruler's fight"
        pic = f'{ch}-{"pack" if kind == "enemies" else "ruler"}-ingame.jpg'
        size = ' (rulers drawn 2.2 times a hero; the floors draw them 2.1 to 2.9)' if kind == 'rulers' else " (each at its unit's size)"
        parts.append(f"""<h3>{title} <small>{floors}</small></h3>
<div class="pair"><figure><img loading="lazy" src="{ch}-{kind}-game.jpg" alt="{title}'s {kind} beside Sefu and Kaia from the game's camera"><figcaption>From the game's camera, beside the heroes Sefu and Kaia{size}</figcaption></figure>
<figure><img loading="lazy" src="{ch}-{kind}-front.jpg" alt="{title}'s {kind} from the front"><figcaption>From the front</figcaption></figure></div>
<div class="cards">{''.join(cards)}</div>
<figure class="wide"><img loading="lazy" src="{pic}" alt="In the game: a {what} in {title}"><figcaption>In the game: a {what}</figcaption></figure>""")
    parts.append('</section>')
    return ''.join(parts)


RULERS_INTRO = ("Each ruler stands on three floors of its chapter under that floor's own name, tint and size; the chapter's first floor "
                "has the first of them in its own colours. Built as giants, not heroes made big: broad and deep, a smaller head, big hands. "
                "The fights are the floors' own (same moves, health and timings); the model brings its look and its hit size. The crowns "
                "(floors 10, 20, 30, 40, 50) are Raid bosses. 350 to 610 KB and 13,500 to 28,800 faces each; one is loaded at a time.")
ENEMIES_INTRO = ("The common melee one, the ranged or casting one, the big one; a named enemy shares its kind's figure under a tint, and the "
                 "War's two armies share theirs in their own colours. They come in packs, so each is finished lighter: about 10,000 faces "
                 "and five or six draw calls (300 to 325 KB). The beasts stay drawn in code: the brine crab, the bark hound, the stag, the "
                 "shard mite, the crystal golem; so do the dust wraith (a spirit of the storm), the feeding root and the escorts. Decided here, "
                 "for the user to overrule: the Wood's three are the moss giant, the thorn sprite and the Hollow Oak (its pack fighter is the "
                 "hound); the Deep's are the lurker, the Lantern Thief and the Pale One (its caster is the golem).")


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
<title>The Climb's Figures</title>
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
.wide{{margin-top:8px}} h3{{margin-top:1.6em}} h3 small{{color:var(--mute);font-weight:400;font-size:.7em}}
p{{max-width:70ch}}
</style></head><body><main>
<h1>The Climb's people, rulers and enemies</h1>
<p>Twenty-five people of their own, five a chapter, in place of the heroes who used to stand in the camps (the user, 2026-11-14:
"make new models for npc, don't reuse them from heroes"). In each chapter the keeper stands on all ten floors; the quest giver at the
camp and the one out in the land each keep their own lines; the two traders take turns, odd floors and even floors. Rivals and
gatekeepers are still heroes: they are fights against a hero. Built like the heroes (the pack's body on the animation pack's
skeleton, blender/tower), each 450 to 550 KB.</p>
<nav>{''.join(f'<a href="#{c[0]}">{c[1]}</a>' for c in CH)}<a href="#rulers">Rulers</a><a href="#enemies">Enemies</a></nav>
{''.join(out)}
{foe_section('rulers', 'The rulers: fifteen giants, three a chapter', RULERS_INTRO)}
{foe_section('enemies', 'The enemies: three people-shaped kinds a chapter', ENEMIES_INTRO)}
</main></body></html>'''
open('docs/tower/models/index.html', 'w', encoding='utf8').write(page)
print(len(rows), 'figures')
