"""Build docs/lore/index.html from docs/lore/LORE.md, and check the lore.

    python pipeline/tools/lore-page.py            # check, then write the page
    python pipeline/tools/lore-page.py --check    # check only

Checks: every hero is in exactly one faction (or among the loners) and the faction lists agree with the heroes' own lines;
every hero has two to four ties; every tie names two known heroes; every legend is 80 to 150 words; faction ties name known
factions. Since 2026-11-15, the peoples and the codex (docs/lore/codex/): 8 to 12 peoples, every hero of exactly one known people,
siblings of the same people; every codex link resolves; every hero has a codex page of the agreed shape (biography 600 to 1000
words, eight voice lines); every tie is on both heroes' pages and every tie on a page is answered on the other; every new name in
codex/names.md is listed once and is not already a name in the game; no codex page or LORE.md uses a name from the FRANCHISE list
(a list of well-known names from other games and stories, not a proof). `--partial` lists missing pages instead of failing.
A failed check prints why and exits with 1 (the page is not written).
"""
import html
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'lore' / 'LORE.md'
OUT = ROOT / 'docs' / 'lore' / 'index.html'

# Tie kinds that read differently from each side: A > B | kind  ->  under A: "<a> B", under B: "<b> A".
ASYM = {
    'teacher': ('teacher of', 'student of'),
    'owes': ('owes', 'is owed by'),
    'maker': ('maker of', 'made by'),
    'guardian': ('guardian of', 'ward of'),
}
SYM = {
    'sworn enemies': 'sworn enemy of', 'rivals': 'rival of', 'friends': 'friend of', 'old flames': 'old flame of',
    'siblings': 'sibling of', 'sisters': 'sister of', 'comrades': 'comrade of',
}

# --------------------------------------------------------------------------------------------------------------------------
# Parsing


def parse(text):
    lines = text.splitlines()
    # strip the front matter
    if lines and lines[0].strip() == '---':
        end = lines.index('---', 1)
        lines = lines[end + 1:]
    sections, cur = {}, None
    for ln in lines:
        if ln.startswith('## '):
            cur = ln[3:].strip()
            sections[cur] = []
        elif cur is not None:
            sections[cur].append(ln)
    return sections


def paragraphs(lines):
    out, buf = [], []
    for ln in lines:
        if ln.strip() == '':
            if buf:
                out.append(' '.join(s.strip() for s in buf))
                buf = []
        else:
            buf.append(ln)
    if buf:
        out.append(' '.join(s.strip() for s in buf))
    return out


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'\*(.+?)\*', r'<i>\1</i>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    return s


def blocks(lines, head):
    """Split a section into ### blocks: [(header fields, body lines)]."""
    out, cur = [], None
    for ln in lines:
        if ln.startswith(head):
            cur = ([p.strip() for p in ln[len(head):].split('|')], [])
            out.append(cur)
        elif cur is not None:
            cur[1].append(ln)
    return out


def read(path):
    sec = parse(path.read_text(encoding='utf-8'))
    lore = {'prose': {}, 'places': [], 'factions': {}, 'ftie': [], 'heroes': [], 'ties': [], 'peoples': {}}
    for name in ('The world', 'The Noonfall', 'Why heroes come to the Ring', 'The Tower and the Climb (a proposal)'):
        lore['prose'][name] = paragraphs(sec[name])
    for ln in sec['Places']:
        if ln.startswith('- '):
            pid, name, hour, fac, what = [p.strip() for p in ln[2:].split('|')]
            lore['places'].append({'id': pid, 'name': name, 'hour': float(hour), 'faction': fac, 'what': what})
    for head, body in blocks(sec['Factions'], '### '):
        fid, name = head
        f = {'id': fid, 'name': name, 'text': [], 'colours': [], 'members': []}
        rest = []
        for ln in body:
            m = re.match(r'- (\w+): (.*)', ln)
            if m and not rest:
                k, v = m.groups()
                if k == 'colours':
                    f['colours'] = [tuple(c.strip().split(' ', 1)) for c in v.split(',')]
                elif k == 'members':
                    f['members'] = [x.strip() for x in v.split(',')]
                else:
                    f[k] = v
            else:
                rest.append(ln)
        f['text'] = paragraphs(rest)
        lore['factions'][fid] = f
    # The peoples (since 2026-11-15): `### id | Name | kind` (kind: human, changed or other), `- key: value` lines, then the text.
    for head, body in blocks(sec.get('Peoples', []), '### '):
        pid, name, kind = head
        pe = {'id': pid, 'name': name, 'kind': kind, 'text': []}
        rest = []
        for ln in body:
            m = re.match(r'- (\w+): (.*)', ln)
            if m and not rest:
                pe[m.group(1)] = m.group(2).strip()
            else:
                rest.append(ln)
        pe['text'] = paragraphs(rest)
        lore['peoples'][pid] = pe
    for ln in sec['Faction ties']:
        if ln.startswith('- '):
            a, b, kind, what = [p.strip() for p in ln[2:].split('|')]
            lore['ftie'].append((a, b, kind, what))
    for head, body in blocks(sec['Heroes'], '### '):
        name, title, theme, fac, pron, status = head
        line = ''
        rest = []
        home, spot, age, people, kin = '', '', '', '', ''
        for ln in body:
            if ln.startswith('- people: '):
                bits = [x.strip() for x in ln[10:].split('|', 1)]
                people, kin = bits[0], (bits[1] if len(bits) > 1 else '')
            elif ln.startswith('- '):
                # any other `- key:` line is a fact, never part of the legend
                m = re.match(r'- (\w+): (.*)', ln)
                if m and m.group(1) == 'home':
                    home, spot = [x.strip() for x in m.group(2).split('|', 1)]
                elif m and m.group(1) == 'age':
                    age = m.group(2).strip()
                else:
                    raise SystemExit(f'{name}: unknown line in LORE.md: {ln}')
            elif ln.startswith('> '):
                line = ln[2:].strip()
            else:
                rest.append(ln)
        lore['heroes'].append({'name': name, 'title': title, 'theme': theme, 'faction': fac, 'pronoun': pron,
                               'status': status, 'line': line, 'legend': ' '.join(paragraphs(rest)),
                               'home': home, 'spot': spot, 'age': age, 'people': people, 'kin': kin})
    for ln in sec['Ties']:
        if not ln.startswith('- '):
            continue
        s = ln[2:].strip()
        strong = s.startswith('!')
        if strong:
            s = s[1:].strip()
        pair, kind, what = [p.strip() for p in s.split('|')]
        if ' ~ ' in pair:
            a, b = pair.split(' ~ ')
            sym = True
        else:
            a, b = pair.split(' > ')
            sym = False
        lore['ties'].append({'a': a.strip(), 'b': b.strip(), 'kind': kind, 'what': what, 'strong': strong, 'sym': sym})
    return lore

# --------------------------------------------------------------------------------------------------------------------------
# Checks


def check(lore):
    errs = []
    names = {h['name'] for h in lore['heroes']}
    if len(names) != len(lore['heroes']):
        errs.append('a hero is listed twice')
    facs = lore['factions']
    seen = {}
    for fid, f in facs.items():
        for m in f['members']:
            if m not in names:
                errs.append(f'faction {fid} lists unknown hero {m}')
            if m in seen:
                errs.append(f'{m} is in {seen[m]} and {fid}')
            seen[m] = fid
    for h in lore['heroes']:
        if h['faction'] not in facs:
            errs.append(f"{h['name']}: unknown faction {h['faction']}")
        elif seen.get(h['name']) != h['faction']:
            errs.append(f"{h['name']}: says {h['faction']}, the faction lists say {seen.get(h['name'])}")
        n = len(h['legend'].split())
        if not 80 <= n <= 150:
            errs.append(f"{h['name']}: legend has {n} words (80 to 150)")
        if not h['line']:
            errs.append(f"{h['name']}: no line")
    count = {n: 0 for n in names}
    pairs = set()
    for t in lore['ties']:
        for x in (t['a'], t['b']):
            if x not in names:
                errs.append(f"tie names unknown hero {x}")
            else:
                count[x] += 1
        key = frozenset((t['a'], t['b']))
        if key in pairs:
            errs.append(f"tie {t['a']} / {t['b']} is written twice")
        pairs.add(key)
        if t['sym'] and t['kind'] not in SYM:
            errs.append(f"tie kind '{t['kind']}' ({t['a']} ~ {t['b']}) is not a both-ways kind")
        if not t['sym'] and t['kind'] not in ASYM:
            errs.append(f"tie kind '{t['kind']}' ({t['a']} > {t['b']}) is not a one-way kind")
    for n, c in count.items():
        if not 2 <= c <= 4:
            errs.append(f'{n}: {c} ties (2 to 4)')
    for a, b, kind, _ in lore['ftie']:
        for x in (a, b):
            if x not in facs:
                errs.append(f'faction tie names unknown faction {x}')
    for p in lore['places']:
        if p['faction'] not in facs and p['faction'] != 'none':
            errs.append(f"place {p['id']}: unknown faction {p['faction']}")
    # Peoples: every hero has exactly one known people; siblings share one; a people's home is a place.
    peoples = lore['peoples']
    place_ids = {p['id'] for p in lore['places']}
    if not 8 <= len(peoples) <= 12:
        errs.append(f'{len(peoples)} peoples (8 to 12)')
    for pid, pe in peoples.items():
        if pe['kind'] not in ('human', 'changed', 'other'):
            errs.append(f"people {pid}: kind '{pe['kind']}' (human, changed or other)")
        if pe.get('home') not in place_ids:
            errs.append(f"people {pid}: home '{pe.get('home')}' is not a place")
        for k in ('look', 'life'):
            if not pe.get(k):
                errs.append(f'people {pid}: no {k}')
    for h in lore['heroes']:
        if not h['people']:
            errs.append(f"{h['name']}: no people")
        elif h['people'] not in peoples:
            errs.append(f"{h['name']}: unknown people {h['people']}")
    by = {h['name']: h for h in lore['heroes']}
    for t in lore['ties']:
        if t['kind'] in ('siblings', 'sisters') and t['a'] in by and t['b'] in by and by[t['a']]['people'] != by[t['b']]['people']:
            errs.append(f"{t['a']} and {t['b']} are {t['kind']} but of different peoples")
    return errs

# --------------------------------------------------------------------------------------------------------------------------
# Codex checks (docs/lore/codex/, since 2026-11-15): links, hero pages, ties both ways, names


CODEX = ROOT / 'docs' / 'lore' / 'codex'
# Run with --partial while the hero pages are being written: a missing page is listed, not an error.
PARTIAL = '--partial' in sys.argv
HERO_SECTIONS = ['Biography', 'People and appearance', 'Voice', 'Voice lines', 'Secrets', 'What * from the Tower', 'Ties']

# Names that belong to other games, books, films and shows: none may appear in the codex. A list, not a proof: it holds the
# well-known names of the big franchises a player is likely to know (checked by hand 2026-11-15); add to it when in doubt.
FRANCHISE = '''
Azeroth Arthas Sylvanas Thrall Jaina Illidan Stormwind Orgrimmar Lordaeron Kalimdor Northrend Dalaran Quel'Thalas Ragnaros
Runeterra Demacia Noxus Piltover Zaun Shurima Bilgewater Freljord Ahri Jinx Teemo Yasuo Thresh Kayle Morgana Ezreal Garen Katarina
Roshan Pudge Invoker Tracer Reinhardt Overwatch Tamriel Skyrim Whiterun Morrowind Oblivion-Gate Geralt Yennefer Ciri Novigrad
Kaer Hyrule Ganon Ganondorf Zelda Sephiroth Midgar Chocobo Lordran Anor Londo Gwyn Artorias Aldrich Lothric Godrick Malenia
Radahn Ranni Marika Limgrave Leyndell Hallownest Teyvat Mondstadt Liyue Inazuma Paimon Westeros Winterfell Lannister Targaryen
Hogwarts Voldemort Dumbledore Jedi Sith Tatooine Aslan Narnia Arrakis Atreides Harkonnen Fremen Shai-Hulud Ankh-Morpork
Zagreus Tyrael Deckard Tyria Dominaria Sigmar Nagash Faerun Waterdeep Drizzt Gandalf Frodo Mordor Gondor Rohan Rivendell
Lothlorien Eregion Hollin Pippin Bilbo Sauron Saruman Isengard Moria Smaug Concord Pikachu Kirby Hollow-Knight Sanctuary-Diablo
Ulduar Karazhan Ashenvale Darnassus Teldrassil Kirin Pandaria Vaelastrasz Deathwing Kel'Thuzad Mephisto Baal Diablo Lilith
Ixalan Kaladesh Ravnica Innistrad Theros Zendikar Kaldheim Strixhaven Eberron Ravenloft Greyhawk Dragonlance Krynn Raistlin
Elminster Mystra Xanathar Vecna Tiamat-Dragonlance Bahamut-FF Ifrit-FF Shiva-FF Cid Tifa Aerith Yuna Lightning-FF Noctis
Drakengard Nier Yorha Bayonetta Dante Vergil Kratos Atreus Ezio Altair Arno Lara Croft Nathan Drake Ellie Joel Aloy Senua Hornet-HK
Ori Celeste Hades-Supergiant Transistor Bastion Pyre Kassandra Eivor Thedas Ferelden Orlais Kirkwall Tevinter Shepard Normandy
Commonwealth Vault-Tec Brotherhood-Steel Gwent Velen Toussaint Skellige Rivia Witcher Planescape Torment Baldur Neverwinter
'''.split()
_COMMON = set('Bastion Torment Pyre Commonwealth Celeste Normandy Shepard Transistor Ori Dante Lara Croft Nathan Drake Ellie Joel Kirin Cid Kaer Baal Lilith Baldur Toussaint Altair Arno Atreus Kratos Vergil Mephisto Kirby Thrall Tracer Invoker'.split())
FRANCHISE = [w for w in FRANCHISE if ('-' not in w or w in ('Ankh-Morpork', 'Shai-Hulud')) and w not in _COMMON]


def _md_files():
    return sorted(CODEX.rglob('*.md'))


def _sections(text):
    """[(heading, [lines])] for the ## headings of a page."""
    out, cur = [], None
    for ln in text.splitlines():
        if ln.startswith('## '):
            cur = (ln[3:].strip(), [])
            out.append(cur)
        elif cur is not None:
            cur[1].append(ln)
    return out


def _game_names():
    """Names already used in the game: heroes, titles, spells, passives, factions, places, the Climb's people and rulers."""
    names = set()
    for f in list((ROOT / 'src' / 'kits').glob('*.ts')) + list((ROOT / 'src' / 'traits').glob('*.ts')):
        names |= set(re.findall(r"name: '([^']+)'", f.read_text(encoding='utf-8')))
    names |= set(re.findall(r"name: '([^']+)'", (ROOT / 'src' / 'tower' / 'world' / 'folk.ts').read_text(encoding='utf-8')))
    for f in (ROOT / 'src' / 'tower' / 'world' / 'floors').rglob('*.ts'):
        names |= set(re.findall(r'"name": "([^"]+)"', f.read_text(encoding='utf-8')))
    return {n.lower() for n in names}


def check_codex(lore):
    errs = []
    if not CODEX.is_dir():
        return ['docs/lore/codex/ is missing']
    files = _md_files()
    dangling = []
    # 1. every link inside the codex resolves to a file
    for f in files:
        for href in re.findall(r'\]\(([^)#\s]+\.md)(?:#[^)]*)?\)', f.read_text(encoding='utf-8')):
            if href.startswith('http'):
                continue
            if not (f.parent / href).resolve().exists():
                dangling.append(f'{f.relative_to(CODEX)}: link to {href} goes nowhere')
    if dangling and PARTIAL:
        print(f'  (partial) {len(dangling)} links to pages still to write')
    else:
        errs += dangling
    # 2. a page for every hero, of the agreed shape
    peoples = lore['peoples']
    heroes = {h['name']: h for h in lore['heroes']}
    pages, ties_on = {}, {}
    missing = []
    for name, h in heroes.items():
        p = CODEX / 'heroes' / f"{slug(name)[2:]}.md"
        if not p.exists():
            missing.append(name)
            continue
        text = p.read_text(encoding='utf-8')
        pages[name] = text
        where = f'heroes/{p.name}'
        if f'hero: {name}\n' not in text:
            errs.append(f'{where}: front matter has no "hero: {name}"')
        secs = _sections(text)
        got = [s for s, _ in secs]
        want = HERO_SECTIONS
        if len(got) != len(want) or any(not re.fullmatch(w.replace('*', '.+'), g) for w, g in zip(want, got)):
            errs.append(f'{where}: sections are {got}, want {want}')
            continue
        sec = dict(secs)
        bio = len(re.findall(r"[A-Za-z0-9’'-]+", ' '.join(sec['Biography'])))
        if not 600 <= bio <= 1000:
            errs.append(f'{where}: biography has {bio} words (600 to 1000)')
        lines = [ln for ln in sec['Voice lines'] if ln.startswith('- ')]
        if len(lines) != 8 or not all(re.match(r'- \*\*[^*]+:\*\* ', ln) for ln in lines):
            errs.append(f'{where}: {len(lines)} voice lines (eight, each "- **When:** line")')
        pe = peoples.get(h['people'])
        head = text.split('## Biography', 1)[0]
        if pe and pe['name'].replace('The ', '').lower() not in head.lower():
            errs.append(f"{where}: the line under the title does not name its people ({pe['name']})")
        ties_on[name] = set(re.findall(r'^- \*\*\[([^\]]+)\]', '\n'.join(sec['Ties']), re.M))
    if missing and not PARTIAL:
        errs.append(f'{len(missing)} heroes have no codex page: {", ".join(missing)}')
    elif missing:
        print(f'  (partial) {len(missing)} hero pages still to write')
    # 3. ties go both ways: every tie of LORE.md on both pages, and every tie on a page answered on the other
    for t in lore['ties']:
        for a, b in ((t['a'], t['b']), (t['b'], t['a'])):
            if a in ties_on and b not in ties_on[a]:
                errs.append(f'{a}: the tie with {b} (LORE.md) is not in the Ties of the codex page')
    for a, others in ties_on.items():
        for b in others:
            if b not in heroes:
                errs.append(f'{a}: the codex names a tie with {b}, who is not a hero')
            elif b in ties_on and a not in ties_on[b]:
                errs.append(f"{a}: lists {b} under Ties, but {b}'s page does not list {a}")
    # 4. names: every new name is listed once, is new to the game, and is not another franchise's
    names_md = CODEX / 'names.md'
    if names_md.exists():
        game = _game_names() | {n.lower() for n in heroes} | {h['title'].lower() for h in heroes.values()}
        game |= {f['name'].lower() for f in lore['factions'].values()} | {p['name'].lower() for p in lore['places']}
        text = names_md.read_text(encoding='utf-8')
        new = text.split('## Kept from the game', 1)[0]
        seen = set()
        for row in re.findall(r'^\| ([^|]+) \| [^|]+ \| [^|]+ \|$', new, re.M):
            n = row.strip()
            if n in ('Name', '---') or set(n) <= set('-: '):
                continue
            if n.lower() in seen:
                errs.append(f'names.md: {n} is listed twice')
            seen.add(n.lower())
            if n.lower() in game:
                errs.append(f'names.md: {n} is already a name in the game (move it to "Kept from the game" if that is meant)')
    elif not PARTIAL:
        errs.append('docs/lore/codex/names.md is missing')
    franchise = re.compile(r'(?<![A-Za-z])(' + '|'.join(re.escape(w) for w in FRANCHISE) + r')(?![A-Za-z])')
    for f in files + [SRC]:
        for w in sorted(set(franchise.findall(f.read_text(encoding='utf-8')))):
            errs.append(f'{f.relative_to(ROOT)}: "{w}" is a name from another game or story')
    return errs


# --------------------------------------------------------------------------------------------------------------------------
# Drawing


SIGILS = {
    'truce': '<circle r="20" fill="none" stroke="#f2f2f2" stroke-width="5"/><circle r="20" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>'
               '<rect x="-3.5" y="-27" width="7" height="54" rx="2" fill="#6a2a2a" stroke="#d9c27a" stroke-width="1.5"/><circle r="4" fill="#d9c27a"/>',
    'noonsworn': '<g stroke="#f2b83c" stroke-width="3.5" stroke-linecap="round">' + ''.join(
        f'<line x1="{19 * math.cos(a):.1f}" y1="{19 * math.sin(a):.1f}" x2="{26 * math.cos(a):.1f}" y2="{26 * math.sin(a):.1f}"/>'
        for a in [i * math.pi / 4 for i in range(8)]) + '</g>'
        '<circle r="14" fill="#efe6d2" stroke="#3a2408" stroke-width="2"/><path d="M-3 -14 L3 -5 L-3 2 L4 8 L0 14" fill="none" stroke="#e0a935" stroke-width="3" stroke-linejoin="round"/>',
    'dusk': '<rect x="-3" y="14" width="6" height="14" rx="2" fill="#cfe6ff" stroke="#121a2e" stroke-width="1.5"/>'
            '<ellipse rx="16" ry="20" cy="-3" fill="#121a2e" stroke="#cfe6ff" stroke-width="3.5"/>'
            '<path d="M5 -16 A12 12 0 1 0 5 10 A9 10 0 1 1 5 -16 Z" fill="#8c0f22" stroke="#ece4d0" stroke-width="1.5"/>',
    'greenwood': '<path d="M-10 -14 L-16 -26 M-13 -20 L-21 -21 M10 -14 L16 -26 M13 -20 L21 -21" stroke="#e8dcc0" stroke-width="3" stroke-linecap="round" fill="none"/>'
                 '<path d="M0 26 C-20 14 -20 -8 0 -16 C20 -8 20 14 0 26 Z" fill="#4caf50" stroke="#14260f" stroke-width="2"/>'
                 '<path d="M0 22 L0 2 C0 -6 8 -6 8 0 C8 6 2 6 2 2" fill="none" stroke="#f0b020" stroke-width="2.2" stroke-linecap="round"/>',
    'windward': '<path d="M-26 16 C-14 16 -12 4 -2 4 C8 4 10 14 2 16 C-4 17 -6 10 0 9" fill="none" stroke="#1f9fd6" stroke-width="4.5" stroke-linecap="round"/>'
                '<path d="M-18 -4 C-22 -18 -6 -26 2 -18 C8 -26 24 -20 20 -8 C28 -6 26 6 16 4" fill="#eef3f6" stroke="#4aa8ff" stroke-width="2.5" stroke-linejoin="round"/>'
                '<path d="M-26 22 L26 22" stroke="#7fe6c8" stroke-width="2.5" stroke-linecap="round"/>',
    'underforge': '<path d="M-22 4 L22 4 L16 12 L8 12 L10 22 L-10 22 L-8 12 L-16 12 Z" fill="#2a2f2c" stroke="#c9b48a" stroke-width="2" stroke-linejoin="round"/>'
                  '<path d="M-26 4 L-22 0 L22 0 L22 4 Z" fill="#d9773a"/>'
                  '<path d="M0 -26 L9 -12 L0 -4 L-9 -12 Z" fill="#ffcf5a" stroke="#ff5a12" stroke-width="2"/>',
    'dune': '<path d="M-27 18 C-14 8 -2 8 8 14 C16 18 22 16 27 12 L27 27 L-27 27 Z" fill="#c8913f"/>'
            '<path d="M-14 14 A14 14 0 0 1 14 14" fill="#e8d8b4" stroke="#2a1a0c" stroke-width="1.5"/>'
            '<path d="M-8 24 L10 -16 C12 -22 20 -22 21 -16 C22 -11 17 -9 15 -12" fill="none" stroke="#3fd4c8" stroke-width="3.5" stroke-linecap="round"/>',
    'hourkeepers': '<path d="M0 -27 L5 -5 L27 0 L5 5 L0 27 L-5 5 L-27 0 L-5 -5 Z" fill="#5a3fc0" opacity="0.85"/>'
                   '<path d="M-9 -15 L9 -15 L1 0 L9 15 L-9 15 L-1 0 Z" fill="#e8e0c8" stroke="#0c100a" stroke-width="1.5" stroke-linejoin="round"/>'
                   '<path d="M-5 11 L5 11 L0 4 Z" fill="#d4ff5a"/>',
    'loners': '<circle r="16" fill="none" stroke="#a89870" stroke-width="2.5" stroke-dasharray="4 4"/><circle r="4" fill="#a89870"/>',
}


def sigil(fid, size=52):
    return f'<svg viewBox="-30 -30 60 60" width="{size}" height="{size}" aria-hidden="true">{SIGILS.get(fid, "")}</svg>'


def main_colour(f):
    return f['colours'][0][0] if f.get('colours') else '#a89870'


def accent_of(f):
    # the faction's most readable colour on the dark page
    pick = {'truce': '#d9c27a', 'noonsworn': '#f2b83c', 'dusk': '#c88cff', 'greenwood': '#7ccf6a', 'windward': '#4aa8ff',
            'underforge': '#ff8a3a', 'dune': '#3fd4c8', 'hourkeepers': '#d4ff5a', 'loners': '#c8bca0'}
    return pick.get(f['id'], '#c8bca0')


def map_svg(lore):
    cx, cy, R = 180, 186, 148
    facs = lore['factions']
    out = [f'<svg class="map" viewBox="0 0 360 380" role="img" aria-label="Sketch map of the Dial">',
           '<defs><radialGradient id="land" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2a2318"/><stop offset="1" stop-color="#17130e"/></radialGradient></defs>',
           '<rect width="360" height="380" fill="#0b1520"/>']
    for i in range(14):  # a few sea strokes
        x, y = (i * 53) % 340 + 10, (i * 97) % 360 + 12
        if math.hypot(x - cx, y - cy) > R + 14:
            out.append(f'<path d="M{x} {y} q6 -4 12 0 t12 0" stroke="#1f3a52" stroke-width="1.4" fill="none"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#land)" stroke="#a89870" stroke-width="2"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{R - 6}" fill="none" stroke="#3a3242" stroke-width="1"/>')
    numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    for h in range(12):
        a = math.radians(h * 30 - 90)
        x1, y1 = cx + (R - 6) * math.cos(a), cy + (R - 6) * math.sin(a)
        x2, y2 = cx + R * math.cos(a), cy + R * math.sin(a)
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#a89870" stroke-width="1.5"/>')
        tx, ty = cx + (R + 11) * math.cos(a), cy + (R + 11) * math.sin(a) + 3
        out.append(f'<text x="{tx:.1f}" y="{ty:.1f}" class="num">{numerals[h]}</text>')
    # regions: wedges of the dial
    for p in lore['places']:
        if p['id'] == 'tower':
            continue
        f = facs.get(p['faction'])
        col = accent_of(f) if f else '#8a8a8a'
        h = p['hour']
        a0, a1 = math.radians((h - 0.62) * 30 - 90), math.radians((h + 0.62) * 30 - 90)
        r0, r1 = 50, R - 12
        d = (f'M{cx + r0 * math.cos(a0):.1f} {cy + r0 * math.sin(a0):.1f} L{cx + r1 * math.cos(a0):.1f} {cy + r1 * math.sin(a0):.1f} '
             f'A{r1} {r1} 0 0 1 {cx + r1 * math.cos(a1):.1f} {cy + r1 * math.sin(a1):.1f} '
             f'L{cx + r0 * math.cos(a1):.1f} {cy + r0 * math.sin(a1):.1f} A{r0} {r0} 0 0 0 {cx + r0 * math.cos(a0):.1f} {cy + r0 * math.sin(a0):.1f} Z')
        out.append(f'<path d="{d}" fill="{col}" fill-opacity="0.16" stroke="{col}" stroke-opacity="0.55" stroke-width="1"/>')
        am = math.radians(h * 30 - 90)
        rl = 100
        lx, ly = cx + rl * math.cos(am), cy + rl * math.sin(am)
        sub = f['name'].replace('The ', '') if f else 'no realm'
        out.append(f'<g transform="translate({lx:.1f},{ly:.1f})">'
                   f'<text y="-2" class="pl">{html.escape(p["name"].replace("The ", ""))}</text>'
                   f'<text y="9" class="fl" fill="{col}">{html.escape(sub)}</text></g>')
    # the Tower's stopped shadow, the crater, the Tower, the Tear
    sa = math.radians(4.2 * 30 - 90)
    out.append(f'<path d="M{cx} {cy} L{cx + 128 * math.cos(sa - 0.05):.1f} {cy + 128 * math.sin(sa - 0.05):.1f} '
               f'L{cx + 128 * math.cos(sa + 0.05):.1f} {cy + 128 * math.sin(sa + 0.05):.1f} Z" fill="#000" opacity="0.7" stroke="#cdb06a" stroke-width="0.8" stroke-dasharray="3 2"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="40" fill="#120e0a" stroke="#e8a040" stroke-width="1.5" stroke-dasharray="3 3"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="22" fill="none" stroke="#f2f2f2" stroke-width="2.5"/>')
    out.append(f'<path d="M{cx - 6} {cy + 8} L{cx - 3} {cy - 30} L{cx} {cy - 38} L{cx + 3} {cy - 30} L{cx + 6} {cy + 8} Z" fill="#cdb06a" stroke="#2a1a06" stroke-width="1"/>')
    out.append(f'<circle cx="{cx}" cy="{cy + 2}" r="5" fill="#ffb84a"/>')
    out.append(f'<path d="M{cx - 22} {cy - 52} L{cx - 12} {cy - 47} L{cx - 4} {cy - 55} L{cx + 5} {cy - 46} L{cx + 13} {cy - 53} L{cx + 22} {cy - 49}" '
               f'fill="none" stroke="#000" stroke-width="5"/><path d="M{cx - 22} {cy - 52} L{cx - 12} {cy - 47} L{cx - 4} {cy - 55} L{cx + 5} {cy - 46} '
               f'L{cx + 13} {cy - 53} L{cx + 22} {cy - 49}" fill="none" stroke="#ff3fa0" stroke-width="1.6"/>')
    out.append(f'<text x="{cx + 26}" y="{cy - 50}" class="fl" fill="#ff8ac8" style="text-anchor:start">the Tear</text>')
    out.append(f'<text x="{cx}" y="{cy + 33}" class="pl">the Ring</text>')
    out.append(f'<text x="{cx}" y="{cy + 50}" class="fl" fill="#ffb84a">Heart of Noon below</text>')
    out.append(f'<text x="{cx}" y="{cy - 60}" class="pl" fill="#cdb06a">the Tower</text>')
    out.append('<text x="14" y="372" class="fl" fill="#5a7a98" style="text-anchor:start">the Outer Sea</text>')
    out.append('<text x="346" y="372" class="fl" fill="#5a7a98" style="text-anchor:end">shadow: the hour it stopped</text>')
    out.append('</svg>')
    return '\n'.join(out)


def graph_svg(lore):
    facs = [f for f in lore['factions'].values() if f['id'] != 'loners']
    cx, cy, R = 180, 178, 122
    pos = {}
    for i, f in enumerate(facs):
        a = math.radians(i * 360 / len(facs) - 90)
        pos[f['id']] = (cx + R * math.cos(a), cy + R * math.sin(a))
    style = {'friends': ('#9fd08a', '', 2.4), 'rivals': ('#e8b84a', '6 4', 2.0), 'enemies': ('#c86ad8', '2 4', 3.2)}
    out = ['<svg class="graph" viewBox="0 0 360 372" role="img" aria-label="How the factions stand with each other">',
           '<rect width="360" height="372" fill="#120e10" rx="10"/>']
    for a, b, kind, _ in lore['ftie']:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        col, dash, w = style[kind]
        da = f' stroke-dasharray="{dash}"' if dash else ''
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{w}"{da} opacity="0.85"/>')
    for f in facs:
        x, y = pos[f['id']]
        out.append(f'<g transform="translate({x:.1f},{y:.1f})"><circle r="24" fill="#1b1517" stroke="{accent_of(f)}" stroke-width="2"/>'
                   f'<g transform="scale(0.68)">{SIGILS[f["id"]]}</g></g>')
        short = f['name'].replace('The ', '').replace(' of the Ring', '').replace(' Moot', '')
        ly = y + 36 if y >= cy - 5 else y - 30
        out.append(f'<text x="{x:.1f}" y="{ly:.1f}" class="gl" fill="{accent_of(f)}">{html.escape(short)}</text>')
    out.append(f'<text x="{cx}" y="{cy - 4}" class="gl" fill="#a89870">the Tower</text>'
               f'<text x="{cx}" y="{cy + 10}" class="fl" fill="#7a7060">every faction wants it</text>')
    lx = 18
    for kind, (col, dash, w) in style.items():
        da = f' stroke-dasharray="{dash}"' if dash else ''
        out.append(f'<line x1="{lx}" y1="356" x2="{lx + 26}" y2="356" stroke="{col}" stroke-width="{w}"{da}/>'
                   f'<text x="{lx + 32}" y="360" class="fl" fill="#c8bca0" style="text-anchor:start">{kind}</text>')
        lx += 112
    out.append('</svg>')
    return '\n'.join(out)


def ladder_svg(lore, fac_of):
    strong = [t for t in lore['ties'] if t['strong']]
    rowh, top = 30, 14
    h = top + rowh * len(strong) + 8
    out = [f'<svg class="ladder" viewBox="0 0 360 {h}" role="img" aria-label="The strongest ties between heroes">',
           f'<rect width="360" height="{h}" fill="#120e10" rx="10"/>']
    kcol = {'sworn enemies': '#c86ad8', 'rivals': '#e8b84a', 'old flames': '#ff9ec4', 'siblings': '#7fd8ff', 'sisters': '#7fd8ff'}
    for i, t in enumerate(strong):
        y = top + i * rowh + 12
        fa, fb = fac_of[t['a']], fac_of[t['b']]
        col = kcol.get(t['kind'], '#9fd08a')
        out.append(f'<circle cx="12" cy="{y - 4}" r="5" fill="{accent_of(fa)}"/>'
                   f'<text x="22" y="{y}" class="ln" style="text-anchor:start">{html.escape(t["a"])}</text>'
                   f'<line x1="136" y1="{y - 4}" x2="224" y2="{y - 4}" stroke="{col}" stroke-width="2.4"/>'
                   f'<text x="180" y="{y - 8}" class="kd" fill="{col}">{html.escape(t["kind"])}</text>'
                   f'<text x="338" y="{y}" class="ln" style="text-anchor:end">{html.escape(t["b"])}</text>'
                   f'<circle cx="348" cy="{y - 4}" r="5" fill="{accent_of(fb)}"/>')
    out.append('</svg>')
    return '\n'.join(out)

# --------------------------------------------------------------------------------------------------------------------------
# Page


def slug(name):
    return 'h-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


CSS = '''
table.plan{border-collapse:collapse;font-size:14px;width:100%}table.plan td,table.plan th{border-bottom:1px solid #3a3242;padding:5px 8px;text-align:left;vertical-align:top}tr.a-revamp td{background:rgba(255,120,60,.08)}tr.a-touch td{background:rgba(255,210,122,.04)}

:root { --bg: #0e0b0c; --card: #17120f; --line: #3a3242; --gold: #ffd27a; --gold-dim: #a89870; --text: #f2e6c8; --muted: #c8bca0; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
a { color: var(--gold); }
header, main, footer { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
header { padding-top: 28px; }
h1 { font: 700 30px ui-serif, Georgia, serif; letter-spacing: 2px; color: var(--gold); margin: 0 0 6px; }
h2 { font: 700 23px ui-serif, Georgia, serif; color: var(--gold); margin: 34px 0 10px; border-bottom: 1px solid #3a3030; padding-bottom: 6px; }
h3 { font: 700 19px ui-serif, Georgia, serif; margin: 0; color: var(--text); }
header p, .prose p { color: var(--muted); max-width: 820px; }
.prose p b { color: var(--text); }
.prose .note { border-left: 3px solid var(--gold); background: rgba(255,210,122,.07); padding: 8px 12px; border-radius: 0 8px 8px 0; }
nav.toc { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
nav.toc a { font-size: 13px; text-decoration: none; border: 1px solid var(--line); border-radius: 20px; padding: 3px 10px; color: var(--muted); }
.fig { max-width: 560px; margin: 8px 0 4px; }
.fig svg { width: 100%; height: auto; display: block; border-radius: 12px; }
.fig .cap { font-size: 13px; color: var(--muted); margin-top: 4px; }
svg .num { font: 700 9px ui-serif, Georgia, serif; fill: #a89870; text-anchor: middle; }
svg .pl { font: 700 10.5px ui-sans-serif, system-ui, sans-serif; fill: #f2e6c8; text-anchor: middle; }
svg .fl { font: 600 8.5px ui-sans-serif, system-ui, sans-serif; text-anchor: middle; }
svg .gl { font: 700 10.5px ui-sans-serif, system-ui, sans-serif; text-anchor: middle; }
svg .ln { font: 600 11.5px ui-sans-serif, system-ui, sans-serif; fill: #f2e6c8; }
svg .kd { font: 600 9px ui-sans-serif, system-ui, sans-serif; text-anchor: middle; }
.twocol { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 18px; align-items: start; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 14px; }
.card { background: var(--card); border: 1px solid #4a4032; border-radius: 14px; padding: 14px; position: relative; overflow: hidden; }
.card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 4px; background: var(--acc); }
.ftop { display: flex; gap: 12px; align-items: center; margin-bottom: 6px; }
.ftop svg { flex: none; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 6px 0; }
.chip { display: inline-flex; align-items: center; gap: 5px; }
.chip i { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 1px solid #000; }
dl { display: grid; grid-template-columns: 76px 1fr; gap: 4px 10px; margin: 8px 0; font-size: 14px; }
dt { color: var(--gold-dim); font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
dd { margin: 0; color: var(--muted); }
dd a { color: var(--text); text-decoration: none; border-bottom: 1px dotted var(--gold-dim); }
.ftext { font-size: 14px; color: var(--muted); }
.fhead { display: flex; gap: 10px; align-items: center; margin: 30px 0 10px; }
.fhead h2 { margin: 0; border: none; padding: 0; }
.hero .title { color: var(--acc); font: italic 600 14px ui-serif, Georgia, serif; }
.hero .badge { display: inline-block; font: 700 10.5px ui-sans-serif, system-ui; letter-spacing: .08em; text-transform: uppercase; color: #0e0b0c;
  background: var(--gold); border-radius: 20px; padding: 1px 8px; margin-left: 6px; vertical-align: 2px; }
.hero blockquote { margin: 8px 0; font: italic 500 15.5px/1.4 ui-serif, Georgia, serif; color: var(--text); border-left: 3px solid var(--acc); padding-left: 10px; }
.hero p { font-size: 14px; color: var(--muted); margin: 6px 0; }
.ties { list-style: none; padding: 0; margin: 8px 0 0; font-size: 13.5px; }
.ties li { padding: 4px 0; border-top: 1px solid #2a2226; color: var(--muted); }
.ties b { color: var(--text); font-weight: 600; }
.ties .k { color: var(--acc); font-weight: 700; }
.ties .s { color: var(--gold); }
.ties a { color: var(--text); }
.flist { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 13px; color: var(--muted); }
footer { padding: 20px 16px 48px; color: var(--muted); font-size: 14px; }
footer h3 { color: var(--gold); }
'''


def build(lore):
    facs = lore['factions']
    fac_of = {h['name']: facs[h['faction']] for h in lore['heroes']}
    heroes = {h['name']: h for h in lore['heroes']}
    ties_of = {h['name']: [] for h in lore['heroes']}
    for t in lore['ties']:
        if t['sym']:
            word = SYM[t['kind']]
            ties_of[t['a']].append((word, t['b'], t))
            ties_of[t['b']].append((word, t['a'], t))
        else:
            wa, wb = ASYM[t['kind']]
            ties_of[t['a']].append((wa, t['b'], t))
            ties_of[t['b']].append((wb, t['a'], t))
    rel = {fid: {'friends': [], 'rivals': [], 'enemies': []} for fid in facs}
    for a, b, kind, what in lore['ftie']:
        rel[a][kind].append((b, what))
        rel[b][kind].append((a, what))

    def hlink(n):
        return f'<a href="#{slug(n)}">{html.escape(n)}</a>'

    P = []
    P.append('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
             '<title>The Dial: Lore</title>'
             f'<style>{CSS}</style></head><body>')
    n_new = sum(1 for h in lore['heroes'] if h['status'] != 'roster')
    P.append('<header><h1>The Dial</h1>'
             f'<p>The world of Arena of Kits, its eight factions and five loners, and a legend for each of the {len(lore["heroes"])} heroes: '
             f'the 40 in the game and the {n_new} new ones on the cards (marked <i>new</i>), with the twelve peoples of the Dial and the plan to '
             'bring each hero\'s figure to its people. The source is <code>docs/lore/LORE.md</code>; this page is made from it by '
             '<code>python pipeline/tools/lore-page.py</code>. The depth (history, realms, the Climb, every hero in full) is the '
             '<a href="codex/README.md">codex</a>, which the game shows as its Codex screen.</p>'
             '<nav class="toc"><a href="#world">The world</a><a href="#map">Map</a><a href="#ring">Why the Ring</a><a href="#tower">The Tower</a>'
             '<a href="#peoples">Peoples</a><a href="#revamp">Revamp plan</a><a href="#codex">Codex</a>'
             '<a href="#factions">Factions</a><a href="#graph">Relations</a>'
             + ''.join(f'<a href="#f-{f["id"]}">{html.escape(f["name"].replace("The ", ""))}</a>' for f in facs.values())
             + '</nav></header><main>')

    # the world
    P.append('<section class="prose" id="world"><h2>The world</h2>')
    for p in lore['prose']['The world']:
        P.append(f'<p>{inline(p)}</p>')
    P.append(f'<div class="fig" id="map">{map_svg(lore)}<div class="cap">The Dial as a sundial: the realms sit at their hours round the Tower. '
             'Wedges are the realms in their faction\'s colour; the dark line is the Tower\'s shadow, stopped at the hour of the Fall.</div></div>')
    P.append('<h2>The Noonfall</h2>')
    for p in lore['prose']['The Noonfall']:
        P.append(f'<p>{inline(p)}</p>')
    P.append('<h2 id="ring">Why heroes come to the Ring</h2>')
    for p in lore['prose']['Why heroes come to the Ring']:
        P.append(f'<p>{inline(p)}</p>')
    P.append('<h2 id="tower">The Tower and the Climb <small style="font-size:14px;color:var(--muted)">(a proposal)</small></h2>')
    for i, p in enumerate(lore['prose']['The Tower and the Climb (a proposal)']):
        P.append(f'<p class="note">{inline(p.strip("*"))}</p>' if i == 0 else f'<p>{inline(p)}</p>')
    P.append('</section>')

    P.append(peoples_html(lore))
    P.append(revamp_html())
    P.append(codex_html())

    # factions
    P.append('<section id="factions"><h2>The factions</h2><div class="grid">')
    for f in facs.values():
        acc = accent_of(f)
        P.append(f'<article class="card" style="--acc:{acc}"><div class="ftop">{sigil(f["id"], 56)}<div><h3>{html.escape(f["name"])}</h3>'
                 f'<div style="font-size:13px;color:var(--muted)">{len(f["members"])} heroes</div></div></div>')
        if f.get('colours'):
            P.append('<div class="chips">' + ''.join(f'<span class="chip"><i style="background:{c}"></i>{html.escape(n)}</span>' for c, n in f['colours']) + '</div>')
        P.append('<dl>')
        if f.get('home'):
            P.append(f'<dt>Home</dt><dd>{inline(f["home"])}</dd>')
        if f.get('wants'):
            P.append(f'<dt>Wants</dt><dd>{inline(f["wants"])}</dd>')
        if f.get('sigil'):
            P.append(f'<dt>Sigil</dt><dd>{inline(f["sigil"])}</dd>')
        P.append(f'<dt>Members</dt><dd>{", ".join(hlink(m) for m in f["members"])}</dd>')
        for kind, label in (('friends', 'Friends'), ('rivals', 'Rivals'), ('enemies', 'Enemies')):
            if rel[f['id']][kind]:
                P.append(f'<dt>{label}</dt><dd>' + '; '.join(f'<b style="color:var(--text)">{html.escape(facs[o]["name"].replace("The ", ""))}</b>: {inline(w)}'
                                                             for o, w in rel[f['id']][kind]) + '</dd>')
        P.append('</dl>')
        for p in f['text']:
            P.append(f'<p class="ftext">{inline(p)}</p>')
        P.append('</article>')
    P.append('</div></section>')

    # relations
    P.append('<section id="graph"><h2>Relations</h2><div class="twocol">'
             f'<div class="fig">{graph_svg(lore)}<div class="cap">The eight factions and how they stand. The loners stand outside it.</div></div>'
             f'<div class="fig">{ladder_svg(lore, fac_of)}<div class="cap">The strongest ties between heroes; the dots are their factions\' colours. '
             'A duel between two of these is worth a line.</div></div></div></section>')

    # heroes by faction
    for f in facs.values():
        acc = accent_of(f)
        P.append(f'<section id="f-{f["id"]}"><div class="fhead">{sigil(f["id"], 40)}<h2>{html.escape(f["name"])}</h2></div><div class="grid">')
        for m in f['members']:
            h = heroes[m]
            badge = ''
            if h['status'] == 'next10':
                badge = '<a class="badge" href="../heroes/next10/index.html" style="text-decoration:none">new · card</a>'
            elif h['status'] == 'next20':
                badge = '<a class="badge" href="../heroes/next20/index.html" style="text-decoration:none">new · card</a>'
            P.append(f'<article class="card hero" id="{slug(m)}" style="--acc:{acc}"><h3>{html.escape(m)}{badge}</h3>'
                     f'<div class="title">{html.escape(h["title"])}</div>'
                     + f'<div class="title" style="font-style:normal;color:var(--muted)">People: <a href="#p-{h["people"]}">{html.escape(lore["peoples"][h["people"]]["name"])}</a>'
                     + (f', {html.escape(h["kin"])}' if h['kin'] else '') + f' · <a href="codex/heroes/{slug(m)[2:]}.md">full page</a></div>'
                     + (f'<div class="title" style="font-style:normal;color:var(--muted)">From: {html.escape(h["spot"])} · Age: {html.escape(h["age"])}</div>' if h.get('spot') else '')
                     + f'<blockquote>{inline(h["line"])}</blockquote><p>{inline(h["legend"])}</p><ul class="ties">')
            for word, other, t in ties_of[m]:
                star = '<span class="s">★ </span>' if t['strong'] else ''
                ofac = fac_of[other]['name'].replace('The ', '')
                P.append(f'<li>{star}<span class="k">{html.escape(word)}</span> {hlink(other)} <span style="font-size:12px">({html.escape(ofac)})</span>: '
                         f'{inline(t["what"])}</li>')
            P.append('</ul></article>')
        P.append('</div></section>')

    P.append('</main><footer><h3>What is yours to decide</h3>'
             '<p>Every name here is a first pick: the world (the Dial), the factions, the cities (Aubade, Tamerit, Gloaming, the Spires; Frostfall '
             'is the arena\'s own name), the Noonfall and why the sun fell (left open on purpose), the Noon-touched (why people who saw the Fall a '
             'hundred years ago are still young), whether the Tower "collects worlds" (a proposal; the Climb\'s story is still open), and who is a '
             'villain (here only Oblivion is; the Court of Dusk is an enemy with its reasons). Change any of it in <code>docs/lore/LORE.md</code> '
             'and run <code>python pipeline/tools/lore-page.py</code>.</p>'
             '<p>Names that meet names the game already has: Itzel is "the Obsidian Herald" and the War\'s keeper is "the Herald"; Ostrel is '
             '"the Ferryman" and the Deep\'s quest giver is "the Ferryman" (here they are two people who do not speak). Either title may '
             'change. The Ring\'s keepers are called the Truce, not the Concord, because a hero game is named Concord.</p></footer></body></html>')
    return '\n'.join(P)


def peoples_html(lore):
    """The twelve peoples as cards: kind, home, look, life, the text and the heroes of each."""
    places = {p['id']: p['name'] for p in lore['places']}
    by = {}
    for h in lore['heroes']:
        by.setdefault(h['people'], []).append(h)
    kinds = {'human': 'human', 'changed': 'human, changed by the Fall', 'other': 'not human'}
    P = ['<section id="peoples"><h2>The peoples</h2><p class="note">Twelve peoples live on the Dial (2026-11-15: the user found the heroes '
         '"all the same, like human"). Four are human, three are human peoples the Fall changed, five are not human. All are built the one way, '
         'on the pack\'s human body and clips: a people shows in skin, eyes, horns, an animal\'s head, bone, wings carried as a cloak, marks and '
         'dress, never in a body of another shape. Each has a full page in the <a href="codex/peoples/README.md">codex</a>.</p><div class="grid">']
    for pid, pe in lore['peoples'].items():
        members = ', '.join(f'<a href="#{slug(h["name"])}">{html.escape(h["name"])}</a>' + (' <i>(new)</i>' if h['status'] != 'roster' else '')
                            for h in by.get(pid, []))
        P.append(f'<article class="card" id="p-{pid}"><h3>{html.escape(pe["name"])}</h3>'
                 f'<div class="title">{kinds.get(pe["kind"], pe["kind"])} · {html.escape(places.get(pe.get("home"), ""))}</div><dl>'
                 f'<dt>Look</dt><dd>{inline(pe.get("look", ""))}</dd><dt>Life</dt><dd>{inline(pe.get("life", ""))}</dd>'
                 f'<dt>Heroes</dt><dd>{members}</dd></dl>'
                 + ''.join(f'<p class="ftext">{inline(t)}</p>' for t in pe['text'])
                 + f'<p class="ftext"><a href="codex/peoples/{pid}.md">The full page</a></p></article>')
    P.append('</div></section>')
    return ''.join(P)


def revamp_html():
    """The revamp plan's ranked table, read from docs/lore/codex/revamp.md."""
    src = CODEX / 'revamp.md'
    if not src.exists():
        return ''
    rows = []
    for ln in src.read_text(encoding='utf-8').splitlines():
        m = re.match(r'\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', ln)
        if m:
            rows.append([c.strip() for c in m.groups()])
    P = ['<section id="revamp"><h2>The revamp plan <small style="font-size:14px;color:var(--muted)">(for the user\'s yes)</small></h2>'
         '<p class="note">Each of the forty heroes in the game, its people, and whether its figure should change to show it: <b>no</b> (it already '
         'reads as its people), <b>touch</b> (a skin, eye or mark of its people), <b>revamp</b> (a new figure, kit and title kept). Ranked by how '
         'much the roster gains, the heroes that look most like another first. The first three to make: Opaline, Mr. Ledger, Kaia. The briefs, and '
         'the twenty new heroes\' look briefs, are in <a href="codex/revamp.md">the plan</a>. Nothing is built.</p>'
         '<div style="overflow-x:auto"><table class="plan"><tr><th>#</th><th>Hero</th><th>People</th><th>Answer</th><th>What changes</th></tr>']
    for n, hero, people, ans, what in rows:
        a = ans.strip('*')
        P.append(f'<tr class="a-{a}"><td>{n}</td><td><a href="#{slug(hero)}">{html.escape(hero)}</a></td><td>{html.escape(people)}</td>'
                 f'<td><b>{html.escape(a)}</b></td><td>{inline(what)}</td></tr>')
    P.append('</table></div></section>')
    return ''.join(P)


def codex_html():
    """Links into the codex."""
    links = [('README.md', 'The codex, its index'), ('world.md', 'The Dial'), ('tower-and-sun.md', 'The Tower and the Sun: the open questions'),
             ('history.md', 'History'), ('peoples/README.md', 'The peoples'), ('realms/README.md', 'The realms'), ('climb/README.md', 'The Climb'),
             ('climb/bestiary.md', 'The bestiary'), ('climb/rulers.md', 'The rulers'), ('factions/README.md', 'The factions'),
             ('heroes/README.md', 'The sixty heroes'), ('revamp.md', 'The revamp plan'), ('canon.md', 'The canon'), ('names.md', 'Names')]
    return ('<section id="codex"><h2>The codex</h2><p class="note">The depth of the lore, about ten times this page, one file a subject in '
            '<code>docs/lore/codex/</code>; the game shows it as its Codex screen (<code>python pipeline/tools/lore-codex.py</code>).</p><p>'
            + ' · '.join(f'<a href="codex/{h}">{html.escape(t)}</a>' for h, t in links) + '</p></section>')


def main():
    lore = read(SRC)
    errs = check(lore) + check_codex(lore)
    if errs:
        print('The lore does not check out:')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    counts = {fid: len(f['members']) for fid, f in lore['factions'].items()}
    print(f"{len(lore['heroes'])} heroes, {len(lore['ties'])} ties ({sum(t['strong'] for t in lore['ties'])} strongest), factions {counts}")
    if '--check' in sys.argv:
        return
    OUT.write_text(build(lore), encoding='utf-8')
    print('wrote', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
