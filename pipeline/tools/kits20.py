"""Check the twenty new heroes' kits and write their sheets and pages.

    python pipeline/tools/kits20.py            # check, then write
    python pipeline/tools/kits20.py --check    # check only

Reads pipeline/tools/kits20_data/ (the cards and kits as data). Writes:
  pipeline/designs/kit-<theme>.md        one gate-3 sheet per hero (20)
  docs/heroes/next20/index.html          the gate-1 cards of heroes 11 to 20
  docs/heroes/kits20/index.html          the twenty kits as tables, and the build order

The checks are docs/pipeline/new-hero.md rule 4 and pipeline/designs/kit-common.md: a bolt reaches 6 m no sooner than 0.5 s;
a circle warns at least 0.25 + radius / 4 s; a lane at least 0.25 + half width / 4 s; the ultimate never lands at the cast
(1.0 s at least); a spell's hits land within 4.2 s unless the effect is a lasting mark; knock-ups 0.4 s on a W and 0.5 s
elsewhere at most; pulls 4 m; heals 15 a spell and 50 on an R; a lock 1.5 s; six units; HP inside the role's range; no
two kits with the same four shapes (against the roster in docs/catalog/heroes/README.md and each other); names and theme
words not taken in src/kits/ or src/spells/targeted/.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kits20_data import HEROES  # noqa: E402

DATE = '2026-11-14'
ROLE_HP = {'assassin': (600, 720), 'tank': (780, 840), 'juggernaut': (620, 780), 'bruiser': (700, 800), 'mage': (460, 600),
           'marksman': (520, 620), 'support': (600, 680), 'controller': (600, 650), 'summoner': (580, 640), 'engineer': (550, 600),
           'skirmisher': (600, 640)}
SIZES = ['none', 'small', 'medium', 'large']
BUILD = ['Nebet', 'Campana', 'Ostrel', 'Saga', 'Sahar', 'Lithea', 'Arden', 'Lian', 'Ramet', 'Asenet', 'Kessa', 'Kohaku', 'Vela',
         'Itzel', 'Orren', 'Morwen', 'Corbel', 'Hesk', 'Tova', 'Thessa']
# Accents and bodies of the forty (from src/effects/parts/*.ts and docs/ART_BIBLE.md), to keep the new accents apart.
REF_COLOURS = {
    'Vesper': '#ff3b4e', 'Vesper body': '#8c0f22', 'Brannoc': '#ff5a12', 'Isolde': '#4fb4e8', 'Lyra': '#5a3fc0', 'Vitriol': '#4fbf2a',
    'Kaia': '#4aa8ff', 'Sefu': '#c8913f', 'Sefu accent': '#3fd4c8', 'Nyx': '#6a2ec0', 'Fenna': '#4caf50', 'Fenna accent': '#ff7ab8',
    'Auriel': '#f2b83c', 'Marin': '#1f9fd6', 'Marin accent': '#ff9a6a', 'Zephyr': '#7fe6c8', 'Zephyr accent': '#ff8fb0',
    'Mortis': '#3fd8b8', 'Ada': '#d9773a', 'Ada accent': '#6affea', 'Opaline': '#b8b0ff', 'Sirix': '#f0b020', 'Sirix accent': '#7aff5a',
    'Cantor': '#e04aa8', 'Oblivion': '#ff2a55', 'Oblivion accent': '#7affff', 'Shiori': '#3a5ae8', 'Shiori accent': '#ff4a2a',
    'Tempo': '#d4ff5a', 'Silvane': '#cfe6ff', 'Silvane violet': '#d9b8ff', 'Bram': '#c9b48a', 'Hank': '#b5763a', 'Hank pine': '#3f6b3a',
    'Professor Puff': '#ff8fb8', 'Mr. Ledger': '#d9c27a', 'Big Yoko': '#e63a3a', 'Referee Whistler': '#f2f2f2', 'Madame Cleaver': '#d84a3a',
    'Pip': '#ffd24a', 'Pip foil': '#3a6ac8', 'Gus': '#ffd23a', 'Gus foil': '#3a6a8a', 'Grandma Ironknit': '#ff9cc4', 'Barry Cloudsley': '#6ac8ff',
    'Barry foil': '#f4e65a', 'Bo': '#f0ead6', 'The Great Zambini': '#b05aff', 'Wick': '#b08a4a', 'Wick red': '#6a2a2a', 'Pim': '#ffb04a',
    'Pom': '#6ac8ff', 'Anka': '#ff7b3a', 'Mabel': '#8a6a4a', 'Sir Whiskers': '#e8a13a', 'Mum': '#f7f7f2', 'Mum dark': '#20202a',
}
NEAR = 12  # a Lab distance under this reads as the same colour


def lab(hexc):
    h = hexc.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    r, g, b = lin
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = [v ** (1 / 3) if v > 0.008856 else 7.787 * v + 16 / 116 for v in (x, y, z)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def dist(a, b):
    return sum((p - q) ** 2 for p, q in zip(lab(a), lab(b))) ** 0.5


def luminance(hexc):
    h = hexc.lstrip('#')
    lin = [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def nearest_colours(h, heroes):
    others = dict(REF_COLOURS)
    for o in heroes:
        if o['name'] != h['name']:
            others[o['name']] = o['accent'][0]
    return sorted((dist(h['accent'][0], c), n) for n, c in others.items())[:2]


def colour_proposal(h, heroes):
    """A colour near the accent that keeps NEAR + 2 from every other, for a card whose accent sits on another hero's."""
    import colorsys
    base = h['accent'][0]
    pool = dict(REF_COLOURS)
    pool.update({o['name']: o['accent'][0] for o in heroes if o['name'] != h['name']})
    h0, _, _ = colorsys.rgb_to_hsv(*[int(base[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    best = None
    for dh in range(-40, 41, 4):
        for s in (0.45, 0.6, 0.75, 0.9):
            for v in (0.55, 0.7, 0.85, 1.0):
                r, g, b = colorsys.hsv_to_rgb(((h0 * 360 + dh) % 360) / 360, s, v)
                c = '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
                if min(dist(c, w) for w in pool.values()) >= NEAR + 2:
                    key = dist(c, base)
                    if best is None or key < best[0]:
                        best = (key, c)
    return best[1] if best else None


def clash_note(h, heroes):
    d, n = nearest_colours(h, heroes)[0]
    if d >= NEAR:
        return ''
    prop = colour_proposal(h, heroes)
    return (f"Colour clash: the card's accent `{h['accent'][0]}` is {d:.0f} from {n}'s colour (under {NEAR} reads as the same). "
            + (f"A nearby colour that keeps apart: `{prop}`. " if prop else '')
            + 'Or keep it and let the figure tell them apart; to decide at the look.')


def dark_note(h):
    if luminance(h['accent'][0]) < 0.12:
        return (f"The accent {h['accent'][1]} is dark on the game's dark floor: its energy needs a lighter shade of it and the pale "
                f"{h['foil'][1]} beside it (rule 6); settle it at the look.")
    return ''


NORM = {'SHOT': 'LINE', 'BOLT': 'LINE', 'TARGET': 'TGT', 'TARGETED': 'TGT', 'GROUND': 'ZONE', 'QUICK': 'CONE', 'FAN': 'CONE',
        'LEAP': 'DASH', 'BLINK': 'DASH', 'ESCAPE': 'DASH', 'AURA': 'SELF', 'NOVA': 'SELF', 'BUFF': 'SELF', 'CHANNEL': 'SELF',
        'GLOBAL': 'ZONE', 'WALL': 'TERRAIN', 'BOX': 'TERRAIN', 'DOOR': 'TERRAIN', 'TRAP': 'ZONE', 'FUSE': 'ZONE', 'LOB': 'ZONE',
        'TRAIL': 'LINE', 'TURRET': 'SUMMON', 'SWAP': 'SELF'}

# --------------------------------------------------------------------------------------------------------------------------
# Checks


def arith(c):
    """(ok, text) for one answer check."""
    k = c['k']
    if k == 'bolt':
        t = c['windup'] + 6 / c['speed']
        return t >= 0.5 - 1e-9, f"bolt: {c['windup']:g} + 6/{c['speed']:g} = {t + 1e-9:.2f} s to 6 m (at least 0.5)"
    if k == 'circle':
        need = 0.25 + c['r'] / 4
        return c['warn'] >= need - 0.005, f"circle {c['r']:g} m: 0.25 + {c['r']:g}/4 = {need + 1e-9:.2f} s needed, warned {c['warn']:g} s"
    if k == 'lane':
        need = 0.25 + c['half'] / 4
        return c['warn'] >= need - 0.005, f"lane {2 * c['half']:g} m wide: 0.25 + {c['half']:g}/4 = {need + 1e-9:.2f} s needed, warned {c['warn']:g} s"
    if k == 'react':
        need = 0.25 + c['need']
        return c['warn'] >= need - 0.005, f"reaction: 0.25 + {c['need']:g} = {need + 1e-9:.2f} s needed, given {c['warn']:g} s"
    if k == 'reach':
        return True, 'spacing: stand outside its reach (no reaction can beat a blow up close)'
    return True, ''


def first_word(cell):
    m = re.match(r'\s*([A-Za-z]+)', cell)
    return m.group(1).upper() if m else ''


def norm(s):
    s = s.upper()
    return NORM.get(s, s)


def roster_tuples():
    text = (ROOT / 'docs' / 'catalog' / 'heroes' / 'README.md').read_text(encoding='utf-8').splitlines()
    out, on = {}, False
    for ln in text:
        if ln.startswith('| Hero | Role | Signature | Q | W | E | R |'):
            on = True
            continue
        if on:
            if not ln.startswith('|'):
                break
            cells = [c.strip() for c in ln.strip('|').split('|')]
            if cells[0].startswith('---'):
                continue
            name = cells[0]
            t = tuple(norm(first_word(c)) for c in cells[3:7])
            if all(t) and 'PIM' not in t:
                out[name] = t
    return out


def taken_names():
    names, files = set(), set()
    # a hero in a folder of its own (src/heroes/<theme>/): its spells in spells/, its card in hero.ts
    for f in [*(ROOT / 'src' / 'spells' / 'targeted').glob('*.ts'), *(ROOT / 'src' / 'heroes').glob('*/spells/*.ts')]:
        files.add(f.stem.lower())
        for m in re.finditer(r"label: '([^']+)'", f.read_text(encoding='utf-8')):
            names.add(m.group(1).lower())
    for f in [*(ROOT / 'src' / 'kits').glob('*.ts'), *(ROOT / 'src' / 'heroes').glob('*/hero.ts')]:
        files.add(f.parent.name.lower() if f.name == 'hero.ts' else f.stem.lower())
        for m in re.finditer(r"(?:name|title|label): '([^']+)'", f.read_text(encoding='utf-8')):
            names.add(m.group(1).lower())
    return names, files


def camel(name):
    words = re.sub(r"[^A-Za-z ]", ' ', name.replace("'", '')).split()
    return words[0].lower() + ''.join(w.capitalize() for w in words[1:])


def lore_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location('lore_page', Path(__file__).resolve().parent / 'lore-page.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def read_lore():
    return lore_module().read(ROOT / 'docs' / 'lore' / 'LORE.md')


def ties_for(name, lore):
    mod = lore_module()
    out = []
    for t in lore['ties']:
        if name not in (t['a'], t['b']):
            continue
        other = t['b'] if t['a'] == name else t['a']
        if t['sym']:
            word = mod.SYM[t['kind']]
        else:
            word = mod.ASYM[t['kind']][0 if t['a'] == name else 1]
        out.append((word, other, t['what'], t['strong']))
    return out


def kit_tuple(h):
    by = {s['k']: s for s in h['spells']}
    return tuple(norm(by[k]['shape']) for k in ('Q', 'W', 'E', 'R'))


def check(heroes):
    errs = []
    names, files = taken_names()
    roster = roster_tuples()
    if len(roster) < 30:
        errs.append(f'the roster table gave only {len(roster)} kits')
    themes = {f.stem for f in (ROOT / 'src' / 'kits').glob('*.ts')} | {f.parent.name for f in (ROOT / 'src' / 'heroes').glob('*/hero.ts')}
    seen_t = {}
    for h in heroes:
        who = h['name']
        lo, hi = ROLE_HP[h['role']]
        if not lo <= h['hp'] <= hi:
            errs.append(f"{who}: {h['hp']} HP is outside the {h['role']} range {lo}-{hi}")
        if h['theme'] in themes:
            errs.append(f"{who}: theme word {h['theme']} is taken")
        if h['engine_size'] not in SIZES:
            errs.append(f"{who}: engine size {h['engine_size']}")
        t = kit_tuple(h)
        for other, ot in roster.items():
            if ot == t:
                errs.append(f'{who}: four shapes {t} are the same as {other}\'s')
        if t in seen_t:
            errs.append(f'{who}: four shapes {t} are the same as {seen_t[t]}\'s')
        seen_t[t] = who
        for s in h['spells']:
            tag = f"{who} {s['k']} {s['name']}"
            if s['name'].lower() in names:
                errs.append(f'{tag}: the name is taken')
            if s['k'] != 'P' and camel(s['name']).lower() in files:
                errs.append(f'{tag}: the file name {camel(s["name"])}.ts is taken')
            for key in ('ans', 'fx', 'eng', 'scr', 'cpu', 'rule'):
                if not s.get(key):
                    errs.append(f'{tag}: no {key}')
            for ck in ('chk', 'chk2'):
                if ck in s:
                    ok, txt = arith(s[ck])
                    if not ok:
                        errs.append(f'{tag}: answer fails: {txt}')
            land = s.get('land')
            if s['k'] == 'R' and (land is None or land < 1.0):
                errs.append(f'{tag}: the ultimate lands at {land} s (at least 1.0)')
            last = s.get('last', land)
            if last is not None and last > 4.2 and not s.get('lasting'):
                errs.append(f'{tag}: its last hit lands at {last} s, past 4.2 s, and it is not a lasting mark')
            ku = s.get('knockup', 0)
            if ku > (0.4 if s['k'] == 'W' else 0.5):
                errs.append(f'{tag}: knock-up {ku} s')
            if s.get('pull', 0) > 4:
                errs.append(f'{tag}: pull {s["pull"]} m')
            heal = s.get('heal', 0)
            if heal > (50 if s['k'] == 'R' else 15):
                errs.append(f'{tag}: heal {heal}')
            if s.get('lock', 0) > 1.5:
                errs.append(f'{tag}: lock {s["lock"]} s')
            if s.get('units', 0) > 6:
                errs.append(f'{tag}: {s["units"]} units')
    for h in heroes:
        d, n = nearest_colours(h, heroes)[0]
        if d < NEAR and h['n'] > 10:
            errs.append(f"{h['name']}: accent {h['accent'][0]} is {d:.0f} from {n} (under {NEAR})")
        elif d < NEAR:
            print(f"  note: {h['name']}'s card accent {h['accent'][0]} is {d:.0f} from {n}: marked on the sheet with a proposal")
        if dist(h['accent'][0], h['foil'][0]) < 20:
            errs.append(f"{h['name']}: accent and foil are too close")
    lore = read_lore()
    lf = {x['name']: x['faction'] for x in lore['heroes']}
    names_of = {fid: f['name'] for fid, f in lore['factions'].items()}
    for h in heroes:
        fid = lf.get(h['name'])
        if fid is None:
            errs.append(f"{h['name']}: not in docs/lore/LORE.md")
            continue
        want = 'a loner' if fid == 'loners' else names_of[fid]
        if want != h['faction']:
            errs.append(f"{h['name']}: faction {h['faction']} here, {want} in the lore")
    order = [next(h for h in heroes if h['name'] == n) for n in BUILD]
    if sorted(BUILD) != sorted(h['name'] for h in heroes):
        errs.append('the build order does not list the twenty')
    sizes = [SIZES.index(h['engine_size']) for h in order]
    if sizes != sorted(sizes):
        errs.append('the build order does not put the smaller engine work first')
    return errs

# --------------------------------------------------------------------------------------------------------------------------
# The sheets


def md_cell(s):
    return str(s).replace('|', '/').replace('\n', ' ')


def sheet(h):
    by_key = h['spells']
    rank = BUILD.index(h['name']) + 1
    page = 'next10' if h['n'] <= 10 else 'next20'
    L = []
    L.append('---')
    L.append(f"title: {h['name']}, {h['title']} (new hero {h['n']} of 20)")
    L.append(f"tags: [design, heroes, kits, {h['theme']}]")
    L.append(f'updated: {DATE}')
    L.append('status: gate 1 card and gate 3 on paper, written before the look (gate 2); the numbers may move after the look; nothing is built')
    L.append('---')
    L.append('')
    L.append(f"# {h['name']}, {h['title']}")
    L.append('')
    L.append(f"New hero {h['n']} of the twenty ([the cards](../../docs/heroes/{page}/index.html), [all twenty kits](../../docs/heroes/kits20/index.html), "
             f"[the lore](../../docs/lore/index.html)). Made by `python pipeline/tools/kits20.py` from `pipeline/tools/kits20_data/` on {DATE}; "
             'until the user\'s yes, change the data and run it again. After the yes this sheet is edited by hand, as `kit-phoenix.md` was.')
    L.append('')
    L.append('**The order of the gates.** [The rules](../../docs/pipeline/new-hero.md) put the look (gate 2) before this sheet. The user asked '
             'for the full design of all twenty now, so this sheet comes first, and its numbers may move once the look is agreed.')
    L.append('')
    L.append('## Gate 1: the card')
    L.append('')
    L.append('| | |')
    L.append('|---|---|')
    rows = [('Sentence', h['sentence']), ('Shape', h['shape']),
            ('Colours', f"Accent {h['accent'][1]} `{h['accent'][0]}`, foil {h['foil'][1]} `{h['foil'][0]}`. Nearest colours: "
                        + ', '.join(f'{n} ({d:.0f})' for d, n in nearest_colours(h, HEROES)) + ' (Lab distance; under 12 reads as the same). '
                        + dark_note(h) + ' ' + clash_note(h, HEROES)),
            ('Theme word', f"`{h['theme']}`"), ('Role', f"{h['role'].capitalize()}, {h['range']}"),
            ('Faction', f"{h['faction']} (lore: {h['legend']})"),
            ('The new thing', h['new']), ('The question', h['question']), ('The weakness', h['weakness']),
            ('The second decision', h['choice']), ('How it looks', h['look']), ('Nearest heroes', h['nearest'])]
    for k, v in rows:
        L.append(f'| **{k}** | {md_cell(v)} |')
    L.append('')
    if h.get('changes'):
        L.append(f"**Changed from the card shown on {DATE}:** {h['changes']}")
        L.append('')
    L.append('## Gate 3: the kit on paper')
    L.append('')
    L.append(f"{h['name']}. Theme `{h['theme']}`. {h['role'].capitalize()}, {h['range']}. **{h['hp']} HP**, {h['speed']}, basic attack "
             f"{h['attack']}. Accent `{h['accent'][0]}`, foil `{h['foil'][0]}`.")
    L.append('')
    L.append('| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |')
    L.append('|---|---|---|---:|---|---|---|---|')
    for s in by_key:
        L.append(f"| {s['k']} | **{md_cell(s['name'])}** | {s['shape']} | {s['cd']} | {md_cell(s['rng'])} | {md_cell(s['size'])} | "
                 f"{md_cell(s['dmg'])} | {md_cell(s['rule'])} |")
    L.append('')
    L.append('### The answers, checked (rule 4)')
    L.append('')
    L.append('A hero walks 4 m/s and reacts in 0.25 s; a circle warns at least 0.25 + radius / 4 s; a bolt reaches 6 m no sooner than '
             '0.5 s; the ultimate never lands the moment it is cast.')
    L.append('')
    for s in by_key:
        nums = []
        for ck in ('chk', 'chk2'):
            if ck in s:
                ok, txt = arith(s[ck])
                if txt:
                    nums.append(txt + (' OK' if ok and s[ck]['k'] != 'reach' else ''))
        if s.get('land') is not None:
            nums.append(f"first hit {s['land']:g} s after the cast" + (f", last {s['last']:g} s" if s.get('last') else '')
                        + (' (a lasting mark after that)' if s.get('lasting') else ''))
        tail = f" *({'; '.join(nums)})*" if nums else ''
        L.append(f"- **{s['k']} {s['name']}.** {s['ans']}{tail}")
    L.append('')
    L.append('### The question, the weakness, the second decision')
    L.append('')
    L.append(f"- **Question:** {h['question']}")
    L.append(f"- **Weakness:** {h['weakness']}")
    L.append(f"- **Second decision:** {h['choice']}")
    L.append('')
    L.append('### Budget')
    L.append('')
    L.append(h['budget'] + ' The balance runs at gate 5 decide the final numbers ([kit-common.md](kit-common.md), 40-60% wins).')
    L.append('')
    L.append('### What the engine needs, and on which screen it is decided')
    L.append('')
    L.append(f"**Engine work: {h['engine_size']}.** {h['engine']} Build order: {rank} of 20 ([the kits page](../../docs/heroes/kits20/index.html)); "
             'the engine sizes come from reading the docs (`docs/architecture/mechanics.md`, `pipeline/designs/kit-build-brief.md`), not '
             '`src/traits/types.ts`, so the order is to be confirmed by whoever reads the code first.')
    if h.get('risk'):
        L.append('')
        L.append(f"**Risk:** {h['risk']}")
    L.append('')
    L.append('| Key | Needs | Decided on |')
    L.append('|---|---|---|')
    for s in by_key:
        L.append(f"| {s['k']} {md_cell(s['name'])} | {md_cell(s['eng'])} | {md_cell(s['scr'])} |")
    L.append('')
    L.append('### What the CPU does')
    L.append('')
    L.append(f"**As {h['name']}** (`aiHold`, `aiGoal`):")
    L.append('')
    for x in h['cpu_as']:
        L.append(f'- {x}')
    L.append('')
    L.append(f"**Against {h['name']}** (`enemyGoal`):")
    L.append('')
    for x in h['cpu_vs']:
        L.append(f'- {x}')
    L.append('')
    L.append('### The effects, part by part')
    L.append('')
    L.append(f"In her palette: accent {h['accent'][1]} with a pale {h['foil'][1]} foil beside every dark part, a dark layer under the "
             "brightest, nothing in the enemy's red, every shape at least 0.15 m thick from the play camera; what the opponent must read "
             "(the wind-up, the circle, the line) is the best-drawn part, and the drawn shape is exactly what hits."
             .replace('her palette', 'the hero\'s palette'))
    L.append('')
    for s in by_key:
        L.append(f"- **{s['k']} {s['name']}:** {s['fx']}")
    L.append('')
    L.append(f'### Names and files (checked free on {DATE})')
    L.append('')
    spells = [s for s in by_key if s['k'] != 'P']
    L.append('Labels: ' + ', '.join(f"'{s['name'].lower()}'" for s in spells) + '. Files: '
             + ', '.join(f"`src/spells/targeted/{camel(s['name'])}.ts`" for s in spells)
             + f"; `src/effects/parts/{h['theme']}.ts`, `src/kits/{h['theme']}.ts`, `src/traits/{h['theme']}.ts`. Checked against "
             '`src/kits/` and the labels and file names in `src/spells/targeted/` by the script.')
    L.append('')
    return '\n'.join(L)

# --------------------------------------------------------------------------------------------------------------------------
# Pages


CARD_CSS = '''
:root { --bg: #0e0b0c; --card: #17120f; --line: #3a3242; --gold: #ffd27a; --gold-dim: #a89870; --text: #f2e6c8; --muted: #c8bca0; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; }
a { color: var(--gold); }
header { padding: 28px 16px 8px; max-width: 1180px; margin: 0 auto; }
h1 { font: 700 30px ui-serif, Georgia, serif; letter-spacing: 2px; color: var(--gold); margin: 0 0 6px; }
header p { color: var(--muted); margin: 4px 0; max-width: 820px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 16px; padding: 16px; max-width: 1180px; margin: 0 auto; }
@media (max-width: 560px) { .grid { padding: 10px; } }
.card { background: var(--card); border: 1px solid #4a4032; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden; }
.card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 4px; background: var(--acc); }
.top { display: flex; gap: 14px; align-items: center; }
.icon { flex: none; width: 72px; height: 72px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #2a2026, #0c090a); border: 2px solid var(--acc); display: flex; align-items: center; justify-content: center; }
.icon svg { width: 52px; height: 52px; }
.num { font: 700 12px ui-sans-serif, system-ui; color: var(--gold-dim); letter-spacing: .1em; }
h2 { font: 700 22px ui-serif, Georgia, serif; margin: 0; color: var(--text); }
.title { color: var(--acct, var(--acc)); font: 600 14px ui-serif, Georgia, serif; font-style: italic; }
.role { display: inline-block; margin-top: 4px; font: 700 11px ui-sans-serif, system-ui; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--line); border-radius: 20px; padding: 2px 9px; }
.sentence { font: 500 16px/1.4 ui-serif, Georgia, serif; color: var(--text); }
.new { background: rgba(255, 210, 122, 0.08); border-left: 3px solid var(--gold); border-radius: 0 8px 8px 0; padding: 7px 10px; }
.new b { color: var(--gold); }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 4px 10px; margin: 0; font-size: 14px; }
@media (max-width: 420px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 4px; } }
dt { color: var(--gold-dim); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
dd { margin: 0; color: var(--muted); }
.chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.chip { display: inline-flex; align-items: center; gap: 5px; }
.chip i { display: inline-block; width: 16px; height: 16px; border-radius: 4px; border: 1px solid #000; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
td { padding: 6px 6px; border-top: 1px solid #2a2226; vertical-align: top; }
td.k { width: 30px; font: 700 13px ui-sans-serif, system-ui; color: var(--bg); text-align: center; }
td.k span { display: inline-block; min-width: 24px; padding: 2px 0; border-radius: 5px; background: var(--acct, var(--acc)); }
td .n { color: var(--text); font-weight: 700; }
td .fx { color: #9fb6c8; font-style: italic; }
.look { font-size: 13.5px; color: var(--muted); }
.look b { color: var(--text); }
.lore { font-size: 13.5px; color: var(--muted); border-top: 1px solid #2a2226; padding-top: 8px; }
.lore b { color: var(--gold); }
footer { max-width: 1180px; margin: 0 auto; padding: 8px 16px 40px; color: var(--muted); font-size: 14px; }
footer h3 { color: var(--gold); font: 700 18px ui-serif, Georgia, serif; }
code { font-size: .92em; color: #e8dcc0; background: #241c1a; border-radius: 4px; padding: 0 3px; }
'''


def light(hexc, k=0.45):
    """The accent mixed with white, for text and key badges on the dark page."""
    h = hexc.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % tuple(round(c + (255 - c) * k) for c in (r, g, b))


def esc(s):
    return re.sub(r'`([^`]+)`', r'<code></code>', html.escape(str(s), quote=False))


def first_sentence(s):
    m = re.match(r'(.+?\.)(\s|$)', s)
    return m.group(1) if m else s


def slug(name):
    return 'h-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def cards_page(heroes):
    P = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
         f'<title>Ten More Heroes</title><style>{CARD_CSS}</style></head><body>']
    P.append('<header><h1>Ten more heroes</h1>'
             '<p>Gate 1 cards for heroes 11 to 20 of the new twenty, made for the world of the Dial (<a href="../../lore/index.html">the lore</a>): '
             'they fill the thin factions (two more for the Dune Throne, one each for the Noonsworn, the Greenwood, the Court of Dusk, the '
             'Hourkeepers and the Underforge, one more loner), give the strongest rivalries their missing side (Sefu and his sister Asenet, Nyx and '
             'the Huntmaster, Vesper and the Sunbearer, Oblivion and the Sky-Stitcher), and spread the roles (two tanks, two juggernauts, two '
             'marksmen, an assassin, a summoner, an engineer, a support).</p>'
             '<p>Each brings <b>one thing the game does not have yet</b>, not shared with the forty or with <a href="../next10/index.html">the first ten</a>. '
             'The full kit of each, every number and answer, is on <a href="../kits20/index.html">the kits page</a> and in its sheet. Nothing here is '
             'built; each picked hero goes through the look first.</p></header><div class="grid">')
    for h in heroes:
        acc = h['accent'][0]
        P.append(f'<section class="card" style="--acc:{acc};--acct:{light(acc)}">')
        P.append(f'<div class="top"><div class="icon"><svg viewBox="-30 -30 60 60">{h["icon"]}</svg></div>'
                 f'<div><div class="num">{h["n"]} · {esc(h["theme"])}</div><h2>{esc(h["name"])}</h2><div class="title">{esc(h["title"])}</div>'
                 f'<span class="role">{esc(h["role"])} · {esc(h["range"])}</span></div></div>')
        P.append(f'<div class="sentence">{esc(h["sentence"])}</div>')
        P.append(f'<div class="new"><b>New:</b> {esc(h["new"])}</div>')
        P.append(f'<dl><dt>Question</dt><dd>{esc(h["question"])}</dd><dt>Weakness</dt><dd>{esc(h["weakness"])}</dd>'
                 f'<dt>{"His" if h["pron"] == "he" else "Her"} choice</dt><dd>{esc(h["choice"])}</dd></dl>')
        P.append('<table>')
        for s in h['spells']:
            k = s['k'][0] + ('′' if len(s['k']) > 1 else '')
            P.append(f'<tr><td class="k"><span>{k}</span></td><td><span class="n">{esc(s["name"])}</span> ({esc(s["shape"].lower())}). '
                     f'{esc(first_sentence(s["rule"]))} <span class="fx">{esc(first_sentence(s["fx"]))}</span></td></tr>')
        P.append('</table>')
        P.append(f'<div class="chips"><span class="chip"><i style="background:{acc}"></i>{esc(h["accent"][1])}</span>'
                 f'<span class="chip"><i style="background:{h["foil"][0]}"></i>{esc(h["foil"][1])}</span><span>· nearest: {esc(h["nearest"])}</span></div>')
        P.append(f'<div class="look"><b>Look:</b> {esc(h["look"])}</div>')
        if dark_note(h):
            P.append(f'<div class="look"><b>Colour:</b> {esc(dark_note(h))}</div>')
        ties = ties_for(h['name'], LORE)
        if ties:
            P.append('<div class="lore"><b>Ties:</b> ' + '; '.join(
                f'{"★ " if s else ""}<b style="color:var(--acct)">{esc(w)}</b> <a href="../../lore/index.html#{slug(o)}">{esc(o)}</a>: {esc(x)}'
                for w, o, x, s in ties) + '</div>')
        P.append(f'<div class="lore"><b>Faction:</b> {esc(h["faction"])}. <b>Legend:</b> {esc(h["legend"])} '
                 f'<a href="../../lore/index.html#{slug(h["name"])}">Lore</a> · <a href="../../../pipeline/designs/kit-{h["theme"]}.md">Kit sheet</a></div>')
        P.append('</section>')
    P.append('</div><footer><h3>What happens next</h3><p>Pick any (or change them while they are words). Each picked hero goes through the '
             'gates one at a time: the look first (the model beside Sefu and Kaia), then the kit sheet\'s numbers looked at again, then the '
             'spells, the CPU and balance (40-60%), then release. <a href="../kits20/index.html">The kits page</a> says which to build first.</p>'
             '</footer></body></html>')
    return '\n'.join(P)


KITS_CSS = CARD_CSS + '''
main { max-width: 1180px; margin: 0 auto; padding: 0 16px 20px; }
h3.s { font: 700 22px ui-serif, Georgia, serif; color: var(--gold); margin: 30px 0 8px; border-bottom: 1px solid #3a3030; padding-bottom: 6px; }
.wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #2a2226; border-radius: 10px; background: var(--card); }
.wrap table { min-width: 720px; }
th { text-align: left; font: 700 11.5px ui-sans-serif, system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--gold-dim); padding: 7px 6px; background: #1d1714; }
.kit { margin: 18px 0 26px; }
.kit .head { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.kit .head .icon { width: 56px; height: 56px; }
.kit .head .icon svg { width: 40px; height: 40px; }
.kit .meta { font-size: 13.5px; color: var(--muted); }
.kit h4 { margin: 0; font: 700 20px ui-serif, Georgia, serif; }
.ok { color: #9fd08a; font-weight: 700; }
.size { display: inline-block; font: 700 11px ui-sans-serif, system-ui; letter-spacing: .06em; text-transform: uppercase; border-radius: 20px; padding: 2px 8px; color: #0e0b0c; }
.size.none { background: #9fd08a; } .size.small { background: #d4e86a; } .size.medium { background: #e8b84a; } .size.large { background: #e88a6a; }
.order td { font-size: 13.5px; }
.note { font-size: 13px; color: var(--muted); }
@media (max-width: 640px) {
  .wrap.stack table { min-width: 0; }
  .wrap.stack tr:first-child { display: none; }
  .wrap.stack tr, .wrap.stack td { display: block; }
  .wrap.stack tr { border-top: 1px solid #3a3030; padding: 8px 4px; }
  .wrap.stack td { border: none; padding: 2px 6px; }
  .wrap.stack td.k, .wrap.stack td.nm { display: inline-block; width: auto; }
  .wrap.stack td[data-l]::before { content: attr(data-l) ': '; color: var(--gold-dim); font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; }
}
'''


def kits_page(heroes):
    byname = {h['name']: h for h in heroes}
    P = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
         f'<title>Twenty New Kits</title><style>{KITS_CSS}</style></head><body>']
    P.append('<header><h1>Twenty new kits</h1>'
             '<p>Gate 3 on paper for all twenty new heroes (<a href="../next10/index.html">cards 1-10</a>, <a href="../next20/index.html">cards 11-20</a>): '
             'role, HP, speed and attack from the role budget; every spell with its cooldown, range, size, damage and rule; every answer checked '
             'with the game\'s numbers (a hero walks 4 m/s, reacts in 0.25 s; a circle warns 0.25 + radius / 4 s; a bolt reaches 6 m no sooner '
             'than 0.5 s; the ultimate never lands at the cast). The checks are run by <code>python pipeline/tools/kits20.py</code>, which also '
             'writes each hero\'s sheet (<code>pipeline/designs/kit-&lt;theme&gt;.md</code>): engine needs, the screen that decides each rule, '
             'the CPU, and the effects part by part.</p>'
             '<p><b>Written before the look.</b> The rules put the look (gate 2) first; the user asked for the full design now, so every number '
             'here may move once a hero\'s look is agreed.</p></header><main>')
    P.append('<h3 class="s">The build order</h3><p class="note">Heroes that need no new engine work first, then small, medium and large. '
             'One hero at a time goes through gates 2 to 5. The sizes come from reading the docs, not the trait code, so the order is to be '
             'confirmed by whoever reads <code>src/traits/types.ts</code> first.</p><div class="wrap stack"><table class="order"><tr><th>#</th><th>Hero</th><th>Role</th>'
             '<th>Faction</th><th>Engine</th><th>What is new for the engine</th></tr>')
    for i, n in enumerate(BUILD, 1):
        h = byname[n]
        P.append(f'<tr><td class="nm">{i}.</td><td class="nm"><a href="#{slug(n)}" style="color:var(--text)"><b>{esc(n)}</b></a><br><span class="note">{esc(h["title"])}</span></td>'
                 f'<td data-l="Role">{esc(h["role"])}</td><td data-l="Faction">{esc(h["faction"])}</td><td data-l="Engine"><span class="size {h["engine_size"]}">{h["engine_size"]}</span></td>'
                 f'<td class="note" data-l="New for the engine">{esc(h["engine"])}'
                 + (f'<br><b style="color:#e8b84a">Risk:</b> {esc(h["risk"])}' if h.get('risk') else '') + '</td></tr>')
    P.append('</table></div>')
    for n in BUILD:
        h = byname[n]
        acc = h['accent'][0]
        P.append(f'<section class="kit" id="{slug(n)}" style="--acc:{acc};--acct:{light(acc)}"><div class="head"><div class="icon"><svg viewBox="-30 -30 60 60">{h["icon"]}</svg></div>'
                 f'<div><h4>{esc(n)} <span class="title">{esc(h["title"])}</span></h4><div class="meta">#{BUILD.index(n) + 1} to build · '
                 f'{esc(h["role"])}, {esc(h["range"])} · <b style="color:var(--text)">{h["hp"]} HP</b> · {esc(h["speed"])} · attack {esc(h["attack"])} · '
                 f'<span class="size {h["engine_size"]}">engine: {h["engine_size"]}</span> · <a href="../../../pipeline/designs/kit-{h["theme"]}.md">sheet</a></div></div></div>')
        P.append(f'<div class="new" style="margin-bottom:8px"><b>New:</b> {esc(h["new"])}</div>')
        P.append('<div class="wrap stack"><table><tr><th>Key</th><th>Spell</th><th>Shape</th><th>CD</th><th>Range</th><th>Size</th><th>Damage</th>'
                 '<th>Rule</th><th>Answer, checked</th></tr>')
        for s in h['spells']:
            nums = []
            for ck in ('chk', 'chk2'):
                if ck in s and s[ck]['k'] not in ('none', 'reach'):
                    ok, txt = arith(s[ck])
                    nums.append(f'{esc(txt)} <span class="ok">{"OK" if ok else "FAILS"}</span>')
                elif ck in s and s[ck]['k'] == 'reach':
                    nums.append('spacing')
            k = s['k'][0] + ('′' if len(s['k']) > 1 else '')
            P.append(f'<tr><td class="k"><span>{k}</span></td><td class="nm"><span class="n">{esc(s["name"])}</span></td><td data-l="Shape">{esc(s["shape"])}</td>'
                     f'<td data-l="Cooldown">{esc(s["cd"])}</td><td data-l="Range">{esc(s["rng"])}</td><td data-l="Size">{esc(s["size"])}</td>'
                     f'<td data-l="Damage">{esc(s["dmg"])}</td><td data-l="Rule">{esc(s["rule"])}</td>'
                     f'<td data-l="Answer">{esc(s["ans"])}' + (f'<br><span class="note">{"; ".join(nums)}</span>' if nums else '') + '</td></tr>')
        P.append('</table></div>')
        if h.get('changes'):
            P.append(f'<p class="note"><b style="color:var(--gold)">Changed from the card:</b> {esc(h["changes"])}</p>')
        P.append('</section>')
    P.append('</main><footer><h3>Before any of these is built</h3><p>Each hero passes the look first (gate 2), then this sheet is looked at again '
             'with the user, then the spells, the CPU and the balance runs (40-60% over 96 fights). The engine work named here is built first, by one '
             'writer, for the hero that needs it.</p></footer></body></html>')
    return '\n'.join(P)


LORE = None


def main():
    global LORE
    LORE = read_lore()
    heroes = sorted(HEROES, key=lambda h: h['n'])
    errs = check(heroes)
    if errs:
        print('The kits do not check out:')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    n_sp = sum(len(h['spells']) for h in heroes)
    print(f'{len(heroes)} heroes, {n_sp} spells: every answer, budget, shape and name checks out')
    if '--check' in sys.argv:
        return
    for h in heroes:
        p = ROOT / 'pipeline' / 'designs' / f'kit-{h["theme"]}.md'
        p.write_text(sheet(h), encoding='utf-8')
    out = ROOT / 'docs' / 'heroes' / 'next20'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(cards_page([h for h in heroes if h['n'] > 10]), encoding='utf-8')
    out = ROOT / 'docs' / 'heroes' / 'kits20'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(kits_page(heroes), encoding='utf-8')
    print('wrote 20 sheets, docs/heroes/next20/index.html, docs/heroes/kits20/index.html')


if __name__ == '__main__':
    main()
