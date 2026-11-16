"""
A new hero in one go (docs/pipeline/new-hero.md; the hero framework, docs/pipeline/hero-framework.md section 13).

    python pipeline/tools/new-hero.py Selka                     # a brand-new hero: every file as a stub to fill
    python pipeline/tools/new-hero.py Morwen                    # a hero already planned in docs/lore/LORE.md (next10, next20):
                                                                # its title, theme, faction and pronoun come from there, and
                                                                # its spells and numbers from its kit sheet
                                                                # (pipeline/designs/kit-<theme>.md) where it has one
    python pipeline/tools/new-hero.py Selka --theme reed --title "the Reed Witch" --faction greenwood --pronoun she --role controller
    python pipeline/tools/new-hero.py Selka --dry               # say what it would write; write nothing
    python pipeline/tools/new-hero.py Selka --remove --yes      # take a DRAFT out again: its files and its lore stub

What it makes (it never overwrites a file, and stops if the hero's folder is there already):
  src/heroes/<theme>/hero.ts          the card, `draft: true`: off the roster, the shop, the CPU's picks and the Codex until
                                      its gates pass; it plays on the hero workbench (/workbench.html)
  src/heroes/<theme>/numbers.ts       its colours and every number of its kit (the card's tooltips are written from them)
  src/heroes/<theme>/spells/*.ts      the four spells, written on the spell blocks (a shape, numbers, timing) with the sketch
                                      look (src/heroes/framework/sketch.ts) until gate 4 draws their own
  src/heroes/<theme>/fight.ts         the spells the game registers
  src/heroes/<theme>/trait.ts         the passive's stub
  src/heroes/<theme>/icons.ts         canvas icons and a portrait in its colours (stand-ins until the VectorCraft icons)
  pipeline/icons/vectorcraft/draw/<stem>.py   the icon command-file stub (make.py turns it into public/icons/spells/)
  blender/heroes/real/<theme>.py      the model's build() stub on the realistic kit (blender/heroes/realkit.py)
  pipeline/designs/kit-<theme>.md     the kit sheet's stub (gate 1 card, gate 3 table), if there is none
  docs/lore/LORE.md                   its entry (status `draft`), its faction's member, its origin line: rule 0, the lore first
                                      (a hero already in LORE.md is left as it is)
  docs/lore/codex/heroes/<slug>.md    its codex page's stub, if there is none
  docs/heroes/new/<theme>.md          the checklist: docs/pipeline/new-hero.md's gates filled in for this hero

A draft's lore may be unfinished: the lore scripts list what it lacks as notes and still pass for everyone else
(pipeline/tools/lore-page.py, `drafts_apart`). Its checks: python pipeline/tools/hero-check.py <Name>.
Works in Windows PowerShell 5.1 (plain ASCII output; quote a name of two words: "Big Yoko").
"""
import argparse
import datetime
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HEROES = ROOT / 'src' / 'heroes'
LORE = ROOT / 'docs' / 'lore' / 'LORE.md'
CODEX = ROOT / 'docs' / 'lore' / 'codex' / 'heroes'
KINDS = ['vanguard', 'fighter', 'assassin', 'caster', 'controller', 'support']
# a sheet's role word -> the shop's kind
ROLE_KIND = {'tank': 'vanguard', 'vanguard': 'vanguard', 'juggernaut': 'fighter', 'fighter': 'fighter', 'bruiser': 'fighter',
             'assassin': 'assassin', 'mage': 'caster', 'caster': 'caster', 'marksman': 'caster', 'controller': 'controller',
             'support': 'support', 'summoner': 'controller'}
# the role budget (pipeline/designs/kit-common.md): a start HP by shop kind
ROLE_HP = {'vanguard': 840, 'fighter': 720, 'assassin': 640, 'caster': 580, 'controller': 610, 'support': 620}
# a kit sheet's shape word -> the block it starts on (None: no block fits yet; a circle stands in and the file says so)
SHAPE_BLOCK = {'LINE': 'bolt', 'LOB': 'circle', 'ZONE': 'circle', 'GROUND': 'circle', 'TRAP': 'circle', 'NOVA': 'nova',
               'SELF': 'nova', 'TGT': 'target', 'HOOK': 'target', 'LINK': 'target', 'CONE': 'cone', 'QUICK': 'cone',
               'DASH': 'dash', 'LEAP': 'dash', 'BLINK': 'dash', 'CARRY': 'dash'}
DEFAULT_SHAPES = {'Q': 'bolt', 'W': 'circle', 'E': 'dash', 'R': 'circle'}
DEFAULT_NAMES = {'Q': 'First Spell', 'W': 'Second Spell', 'E': 'Third Spell', 'R': 'Ultimate'}


def say(msg=''):
    """Plain ASCII on the console (Windows PowerShell 5.1 may not show other characters)."""
    print(msg.encode('ascii', 'replace').decode('ascii'))


def stem_of(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def camel(s):
    w = re.findall(r'[A-Za-z0-9]+', s)
    return (w[0].lower() + ''.join(x[:1].upper() + x[1:].lower() for x in w[1:])) if w else 'spell'


def ts_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def write_lore(text):
    """LORE.md written back with the line ends it had (a checkout on Windows has CRLF)."""
    nl = '\r\n' if b'\r\n' in LORE.read_bytes() else '\n'
    LORE.write_text(text, encoding='utf-8', newline=nl)


def lore_page():
    spec = importlib.util.spec_from_file_location('lorepage', ROOT / 'pipeline' / 'tools' / 'lore-page.py')
    lp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lp)
    return lp


def lore_heroes():
    """The `### Name | title | theme | faction | pronoun | status` heads of LORE.md, by name."""
    out = {}
    for m in re.finditer(r'^### (.+?) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \| (.+?)\s*$', LORE.read_text(encoding='utf-8'), re.M):
        out[m.group(1)] = dict(zip(['name', 'title', 'theme', 'faction', 'pronoun', 'status'], [g.strip() for g in m.groups()]))
    return out


def lore_people(name):
    m = re.search(r'^### ' + re.escape(name) + r' \|.*?\n- people: ([a-z]+)', LORE.read_text(encoding='utf-8'), re.M)
    return m.group(1) if m else ''


def num(s, default):
    m = re.search(r'(\d+(?:\.\d+)?)', s or '')
    return float(m.group(1)) if m else default


def read_sheet(theme):
    """What the kit sheet already says: role, HP, colours, and per slot its name, shape, cooldown, range, size, damage, rule."""
    f = ROOT / 'pipeline' / 'designs' / f'kit-{theme}.md'
    if not f.exists():
        return None
    t = f.read_text(encoding='utf-8')
    out = {'file': f.relative_to(ROOT).as_posix(), 'spells': {}}
    m = re.search(r'\*\*(\d+) HP\*\*', t)
    if m:
        out['hp'] = int(m.group(1))
    m = re.search(r'Accent `(#[0-9a-fA-F]{6})`, foil `(#[0-9a-fA-F]{6})`', t) or \
        re.search(r'Accent [^`]*`(#[0-9a-fA-F]{6})`, foil [^`]*`(#[0-9a-fA-F]{6})`', t)
    if m:
        out['accent'], out['foil'] = m.group(1).lower(), m.group(2).lower()
    m = re.search(r'^\| \*\*Role\*\* \| ([^|]+)\|', t, re.M)
    if m:
        out['role'] = m.group(1).strip()
    for row in re.finditer(r'^\| ([PQWER]) \| \*\*([^*]+)\*\* \| ([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)\|\s*$', t, re.M):
        key, name, shape, cd, rng, size, dmg, rule = [g.strip() for g in row.groups()]
        out['spells'][key] = {'name': name, 'shape': shape.upper(), 'cooldown': cd, 'range': rng, 'size': size, 'damage': dmg,
                              'rule': rule}
    return out


def roster_count():
    """The released heroes and the drafts already there (a new draft asks for the place after all of them)."""
    rel = drafts = 0
    for f in HEROES.glob('*/hero.ts'):
        if re.search(r'^\s*draft: true,', f.read_text(encoding='utf-8'), re.M):
            drafts += 1
        else:
            rel += 1
    return rel, drafts


def taken_labels():
    labels = set()
    for f in [*(ROOT / 'src').rglob('*.ts')]:
        for m in re.finditer(r"label: (['\"])(.+?)\1", f.read_text(encoding='utf-8', errors='replace')):
            labels.add(m.group(2).lower())
    return labels


# --------------------------------------------------------------------------------------------------------------------------
# The spells: numbers and rules on the blocks, by shape


def spell_numbers(key, shape, sheet_row):
    """A spell's starting numbers: the sheet's where it has them, else ones that pass rule 4's answers."""
    s = sheet_row or {}
    ult = key == 'R'
    cd = num(s.get('cooldown'), {'Q': 4, 'W': 10, 'E': 12, 'R': 24}[key])
    dmg = int(num(s.get('damage'), {'Q': 52, 'W': 50, 'E': 40, 'R': 120}[key]))
    rng = num(s.get('range'), 0)
    size = num(s.get('size'), 0)
    if shape == 'bolt':
        return dict(cooldown=cd, range=rng or 10, windup=0.25, speed=20, radius=size if 0.15 <= size <= 1 else 0.3, damage=dmg, knock=1)
    if shape == 'circle':
        r = size if 1 <= size <= 6 else (3.5 if ult else 2.2)
        # rule 4: a circle warns for at least 0.25 + radius / 4 seconds
        return dict(cooldown=cd, range=rng or (10 if ult else 9), windup=0.0, delay=round(max(0.25 + r / 4, 1.2 if ult else 0.8), 2),
                    radius=r, damage=dmg, knock=2)
    if shape == 'nova':
        r = size if 1 <= size <= 6 else 3
        return dict(cooldown=cd, range=0, windup=round(max(0.5, 0.25 + r / 8), 2), radius=r, damage=dmg, knock=2)
    if shape == 'cone':
        return dict(cooldown=cd, range=rng or 6, windup=0.5, angle=60, damage=dmg, knock=1)
    if shape == 'target':
        return dict(cooldown=cd, range=rng or 8, windup=0.3, delay=0.0, mark=1.2, damage=dmg, knock=0)
    if shape == 'dash':
        return dict(cooldown=cd, range=rng or 6, width=1.6, windup=0.3, seconds=0.4, damage=dmg, knock=2)
    raise ValueError(shape)


def fmt(v):
    return ('%g' % v) if isinstance(v, float) else str(v)


def spell_file(hero, theme, key, sp, n):
    """One spell's file on the blocks, with the sketch look."""
    shape, label, name = sp['shape'], sp['label'], sp['name']
    note = sp.get('note', '')
    rule = sp.get('rule', '')
    X = key
    if shape == 'bolt':
        what = 'a bolt down the aim; it hits the first enemy it touches and stops there, at a wall or at its reach'
        targeting = f"{{ mode: 'ground', radius: {X}.radius }}"
        rules = (f"    windup: {X}.windup,\n"
                 f"    shape: {{ kind: 'bolt', speed: {X}.speed, range: {X}.range, radius: {X}.radius }},\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent }},")
        seconds = f"{X}.windup + {X}.range / {X}.speed + 0.6"
    elif shape == 'circle':
        what = 'a circle at the aim that lands after its fuse; everyone inside it then is hit once'
        targeting = f"{{ mode: 'ground', radius: {X}.radius }}"
        rules = (f"    windup: {X}.windup,\n"
                 f"    shape: {{ kind: 'circle', radius: {X}.radius, at: (c) => [{{ x: c.ctx!.point.x, z: c.ctx!.point.z }}] }},\n"
                 f"    delay: {X}.delay,\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent }},\n"
                 f"    warn: 0,")
        seconds = f"{X}.windup + {X}.delay + 0.8"
    elif shape == 'nova':
        what = 'a circle round the hero, judged once at the end of the wind-up'
        targeting = f"{{ mode: 'self', radius: {X}.radius + 0.6 }}"
        rules = (f"    windup: {X}.windup,\n"
                 f"    shape: {{ kind: 'zone', area: (c) => ({{ kind: 'circle', x: c.from.x, z: c.from.z, radius: {X}.radius }}) }},\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent }},\n"
                 f"    warn: 0,")
        seconds = f"{X}.windup + 0.8"
    elif shape == 'cone':
        what = 'a cone the way the hero faces, judged once at the end of the wind-up'
        targeting = f"{{ mode: 'self', radius: {X}.range + 0.6 }}"
        rules = (f"    windup: {X}.windup,\n"
                 f"    facing: true,\n"
                 f"    shape: {{ kind: 'zone', area: (c) => ({{ kind: 'cone', x: c.from.x, z: c.from.z, radius: {X}.range, angle: {X}.angle, dir: c.yaw }}) }},\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent }},\n"
                 f"    warn: 0,")
        seconds = f"{X}.windup + 0.8"
    elif shape == 'target':
        what = 'a sure hit on the chosen enemy (the range and the sight are checked at the cast)'
        targeting = "{ mode: 'enemy' }"
        rules = (f"    windup: {X}.windup,\n"
                 f"    shape: {{ kind: 'target', mark: {X}.mark }},\n"
                 f"    delay: {X}.delay,\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent, projectile: true }},\n"
                 f"    warn: 0,")
        seconds = f"{X}.windup + {X}.delay + 0.8"
    else:  # dash
        what = 'a dash down the aim; whoever its front passes in the lane is hit once'
        targeting = f"{{ mode: 'ground', radius: {X}.width / 2 }}"
        rules = (f"    windup: {X}.windup,\n"
                 f"    shape: {{ kind: 'lane', length: {X}.range, width: {X}.width, late: 0.05 }},\n"
                 f"    hit: {{ damage: {X}.damage, knock: {X}.knock, color: C.accent }},\n"
                 f"    move: {{ at: 'release', to: 'end', seconds: {X}.seconds }},")
        seconds = f"{X}.windup + {X}.seconds + 0.8"
    var = camel(name) + 'Module'
    lines = [
        "import { sketch } from '../../framework/sketch';",
        "import { spell } from '../../framework/spell';",
        f"import {{ C, {X} }} from '../numbers';",
        '',
        '/**',
        f' * {name} ({hero}, {key}): {what}. A DRAFT made by pipeline/tools/new-hero.py.',
        ' *',
        f' * On the spell blocks (src/heroes/framework/blocks.ts): the rules below, numbers from ../numbers.ts. The look is the',
        f' * sketch (the hit\'s own shape in the accent) until gate 4 draws its own: a class told the moments it needs, as',
        f' * src/heroes/sumo/spells/stomp.ts. Hooks into the passive go in `rules.on` (cast, release, stop, impact, frame).',
    ]
    if rule:
        lines.append(f' * The kit sheet says: {rule}')
    if note:
        lines.append(f' * {note}')
    lines += [
        ' */',
        f'export const {var} = spell<null>({{',
        f'  label: {ts_str(label)},',
        f"  category: 'hero: {theme}',",
        f'  targeting: {targeting},',
        f'  seconds: {seconds},',
        '  state: () => null,',
        '  rules: {',
        rules,
        '  },',
        '  look: sketch<null>(C.accent, C.dark),',
        '  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },',
        f'  frame: {4 if key != "R" else 6},',
        '  maxDamage: 200,',
        '});',
        '',
    ]
    return var, '\n'.join(lines)


def blurb(key, sp):
    """The tooltip, written from the numbers (a template string: the number changes with numbers.ts)."""
    X, sh = key, sp['shape']
    if sh == 'bolt':
        return f"A bolt down the aim (${{{X}.range}} m, ${{{X}.windup}} s wind-up): ${{{X}.damage}} damage to the first enemy it touches."
    if sh == 'circle':
        return f"A circle of ${{{X}.radius}} m at the aim lands after ${{{X}.delay}} s: ${{{X}.damage}} damage to everyone inside."
    if sh == 'nova':
        return f"After ${{{X}.windup}} s, ${{{X}.damage}} damage to everyone within ${{{X}.radius}} m of the hero."
    if sh == 'cone':
        return f"After ${{{X}.windup}} s, ${{{X}.damage}} damage in a ${{{X}.angle}} degree cone ${{{X}.range}} m long the way the hero faces."
    if sh == 'target':
        return f"A sure hit on the chosen enemy within ${{{X}.range}} m (needs sight): ${{{X}.damage}} damage."
    return f"A dash of ${{{X}.range}} m down the aim (${{{X}.windup}} s wind-up): ${{{X}.damage}} damage to whoever it passes."


def kit_flags(key, sp):
    sh = sp['shape']
    if sh == 'bolt':
        return " aim: 'line',"
    if sh == 'dash':
        # the CPU casts a `dash` when the enemy is out of Q's reach: a Q that is itself the dash would never be cast so
        return " aim: 'line', overCover: true," if key == 'Q' else " dash: true, aim: 'line', overCover: true,"
    return ''


# --------------------------------------------------------------------------------------------------------------------------
# The files


def make_files(h):
    theme, hero, stem = h['theme'], h['name'], h['stem']
    files = {}
    today = datetime.date.today().isoformat()
    # numbers.ts
    nl = [
        '/**',
        f' * {hero}: its colours and every number of its kit, in one place (a DRAFT made by pipeline/tools/new-hero.py, {today}).',
        ' * The card\'s tooltips, the spells\' rules and the passive read them here: a number changed here changes its tooltip too.',
        ' * Rule 4 (docs/pipeline/new-hero.md): a hero walks 4 m/s and reacts in 0.25 s; a circle warns for at least',
        ' * 0.25 + radius / 4 seconds; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.',
        ' * The hero workbench (/workbench.html) changes them live, and lists what changed, to copy back here.',
        ' */',
        f"export const C = {{ accent: '{h['accent']}', foil: '{h['foil']}', dark: '#14100c' }};",
        '',
        f"/** The passive and the walk: {h['passive']}. */",
        'export const P = { speed: 4 };',
        '',
    ]
    for key in 'QWER':
        sp = h['spells'][key]
        nl.append(f"/** {key}, {sp['name']} ({sp['shape']}): seconds, metres, damage. */")
        nl.append(f'export const {key} = {{ ' + ', '.join(f'{k}: {fmt(v)}' for k, v in sp['n'].items()) + ' };')
    files[f'src/heroes/{theme}/numbers.ts'] = '\n'.join(nl) + '\n'
    # spells
    imports, mods = [], []
    for key in 'QWER':
        sp = h['spells'][key]
        var, text = spell_file(hero, theme, key, sp, sp['n'])
        fname = camel(sp['name'])
        files[f'src/heroes/{theme}/spells/{fname}.ts'] = text
        imports.append(f"import {{ {var} }} from './spells/{fname}';")
        mods.append(var)
    files[f'src/heroes/{theme}/fight.ts'] = '\n'.join(imports) + '\n\n' + \
        f'/** What a fight needs of {hero} beyond the card: the four spells (they bring their looks with them). */\n' + \
        f"export const spells = [{', '.join(mods)}];\n"
    # hero.ts
    sl = []
    for key in 'QWER':
        sp = h['spells'][key]
        rng = '0' if sp['shape'] in ('nova', 'cone') else f'{key}.range'
        sl += ['    {',
               f"      key: '{key}', label: {ts_str(sp['label'])}, name: {ts_str(sp['name'])}, range: {rng}, cooldown: {key}.cooldown,{kit_flags(key, sp)}",
               f"      blurb: `{blurb(key, sp)}`,",
               f'      icon: icons.{key},',
               '    },']
    card = [
        "import type { HeroKit } from '../../heroes';",
        "import type { HeroCard, HeroPointers } from '../framework/card';",
        "import { icons, portrait } from './icons';",
        "import { C, E, Q, R, W } from './numbers';",
        '',
        '/**',
        f" * {hero}, {h['title']}: the card (found by the game by itself, src/heroes/index.ts). A DRAFT made by",
        f' * pipeline/tools/new-hero.py on {today}: off the roster, the shop, the CPU\'s picks and the Codex until its gates pass',
        f' * (its checklist: docs/heroes/new/{theme}.md). It plays on the hero workbench (/workbench.html), and on the dev server on',
        ' * any page opened with ?drafts=1. Released at gate 6: delete the `draft` line, add its shop row to the server.',
        ' * The tooltips are written from numbers.ts.',
        ' */',
        'const kit: HeroKit = {',
        f'  name: {ts_str(hero)},',
        f"  maxHp: {h['hp']},",
    ]
    if h['melee']:
        card.append('  melee: true,')
    card += [
        f"  title: {ts_str(h['title'])},",
        '  accent: C.accent,',
        '  foil: C.foil,',
        '  portrait,',
        '  spells: [',
        *sl,
        '  ],',
        '};',
        '',
        'const card: HeroCard = {',
        f"  order: {h['order']},",
        '  kit,',
        "  // a stand-in until gate 2: a plain Coast-folk worker of the Climb, built the same realistic way. Its own model is",
        f"  // blender/heroes/real/{theme}.py -> 'models/heroes/{theme}_v4.glb'.",
        f"  model: 'models/tower/{'sea_dockhand' if h['pronoun'] == 'he' else 'sea_fishwife'}_v4.glb',",
        "  // the hit size, measured on the model at gate 2 (src/heroes.ts, HERO_BODIES, says how)",
        '  body: { radius: 0.42, height: 2.4 },',
        f"  shop: {{ kind: '{h['kind']}', shelf: 3 }},",
        f"  icons: '{stem}',",
        '  draft: true,',
        '};',
        '',
        'export default card;',
        '',
        '/** Where the rest of the hero lives (for people and tools; the game does not load it). */',
        'export const pointers: HeroPointers = {',
        f"  lore: 'docs/lore/LORE.md, the entry \"{hero} | {h['title']}\"',",
        f"  model: 'blender/heroes/real/{theme}.py',",
        f"  design: 'pipeline/designs/kit-{theme}.md',",
        '};',
        '',
    ]
    files[f'src/heroes/{theme}/hero.ts'] = '\n'.join(card)
    # trait.ts
    files[f'src/heroes/{theme}/trait.ts'] = '\n'.join([
        "import type { Trait } from '../../traits/types';",
        "import { P } from './numbers';",
        '',
        '/**',
        f" * {hero}'s passive, {h['passive']} (a DRAFT): written on the kit sheet at gate 3, built at gate 4. The hooks a passive",
        ' * may use are `Trait` in src/traits/types.ts; what runs on which screen: pipeline/designs/kit-build-brief.md, "The trait',
        ' * API" (rule 7: every stack, mark and timer shows on both screens; nothing both must agree on uses chance).',
        ' * Gate 5 (rule 8): tell the CPU when to hold each spell (`aiHold`) and where to walk (`aiGoal`, `enemyGoal`).',
        ' */',
        'const trait: Trait = {',
        f"  passive: {{ name: {ts_str(h['passive'])}, blurb: {ts_str(h['passive_blurb'])} }},",
        '  speed: P.speed,',
        '};',
        '',
        'export default trait;',
        '',
    ])
    # icons.ts
    glyph = {k: h['spells'][k]['shape'] for k in 'QWER'}
    files[f'src/heroes/{theme}/icons.ts'] = ICONS_TS.replace('__HERO__', hero).replace('__GLYPHS__', ', '.join(
        f"{k}: '{glyph[k]}'" for k in 'QWER'))
    # the icon command-file stub
    draw = stem.replace('-', '_')
    files[f'pipeline/icons/vectorcraft/draw/{draw}.py'] = DRAW_PY.replace('__HERO__', hero).replace('__STEM__', stem) \
        .replace('__FN__', draw).replace('__THEME__', theme).replace('__ACCENT__', h['accent']).replace('__FOIL__', h['foil']) \
        .replace('__NAMES__', '; '.join(f"{k} {h['spells'][k]['name']} ({h['spells'][k]['shape']})" for k in 'QWER'))
    # the model's build stub
    files[f'blender/heroes/real/{theme}.py'] = MODEL_PY.replace('__HERO__', hero).replace('__THEME__', theme) \
        .replace('__SEX__', 'm' if h['pronoun'] == 'he' else 'f').replace('__ACCENT__', h['accent']).replace('__FOIL__', h['foil'])
    if not (ROOT / 'pipeline' / 'designs' / f'kit-{theme}.md').exists():
        files[f'pipeline/designs/kit-{theme}.md'] = sheet_md(h)
    if not h['lore_existed'] and not (CODEX / f"{h['codex']}.md").exists():
        files[f"docs/lore/codex/heroes/{h['codex']}.md"] = codex_md(h)
    files[f'docs/heroes/new/{theme}.md'] = checklist_md(h, list(files) + [f'docs/heroes/new/{theme}.md'])
    return files


ICONS_TS = r"""import type { HeroKey } from '../../heroes';
import { C } from './numbers';

/**
 * __HERO__'s stand-in icons and portrait (canvas), made by pipeline/tools/new-hero.py: the shape of each spell's block in
 * the hero's colours. Gate 4 draws the real ones: the VectorCraft icons (pipeline/icons/vectorcraft/draw/), which the game
 * shows once the hero is released, and a portrait drawn from the agreed model (the same colours, held thing and hair).
 */
const GLYPH: Record<HeroKey, string> = { __GLYPHS__ };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, '#2a2420');
  r.addColorStop(1, C.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

function glyph(g: CanvasRenderingContext2D, s: number, kind: string) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = C.accent;
  g.fillStyle = C.accent;
  g.lineWidth = s * 0.07;
  const c = s / 2;
  g.beginPath();
  if (kind === 'bolt') {
    g.moveTo(s * 0.2, s * 0.8);
    g.lineTo(s * 0.62, s * 0.38);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.7, s * 0.3, s * 0.12, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'circle' || kind === 'nova') {
    g.ellipse(c, c * 1.1, s * 0.34, s * 0.22, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(c, c * 1.1, s * 0.07, 0, Math.PI * 2);
    g.fillStyle = C.foil;
    g.fill();
  } else if (kind === 'cone') {
    g.moveTo(s * 0.2, s * 0.78);
    g.lineTo(s * 0.86, s * 0.3);
    g.lineTo(s * 0.86, s * 0.78);
    g.closePath();
    g.globalAlpha = 0.85;
    g.fill();
  } else if (kind === 'target') {
    g.arc(c, c, s * 0.28, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(c, s * 0.12); g.lineTo(c, s * 0.34);
    g.moveTo(c, s * 0.66); g.lineTo(c, s * 0.88);
    g.moveTo(s * 0.12, c); g.lineTo(s * 0.34, c);
    g.moveTo(s * 0.66, c); g.lineTo(s * 0.88, c);
    g.stroke();
  } else {
    g.moveTo(s * 0.16, s * 0.62);
    g.lineTo(s * 0.7, s * 0.62);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.62, s * 0.44);
    g.lineTo(s * 0.86, s * 0.62);
    g.lineTo(s * 0.62, s * 0.8);
    g.closePath();
    g.fill();
  }
  g.restore();
}

const icon = (k: HeroKey) => (g: CanvasRenderingContext2D, s: number) => {
  ground(g, s);
  glyph(g, s, GLYPH[k]);
};

export const icons: Record<HeroKey, (g: CanvasRenderingContext2D, size: number) => void> = {
  Q: icon('Q'), W: icon('W'), E: icon('E'), R: icon('R'),
};

/** A stand-in portrait: a head and shoulders in the accent, the foil behind. */
export function portrait(g: CanvasRenderingContext2D, s: number) {
  ground(g, s);
  g.fillStyle = C.foil;
  g.globalAlpha = 0.25;
  g.beginPath();
  g.arc(s / 2, s * 0.45, s * 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = C.accent;
  g.beginPath();
  g.arc(s / 2, s * 0.4, s * 0.17, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(s / 2, s * 0.95, s * 0.34, s * 0.32, 0, Math.PI, 0);
  g.fill();
}
"""

DRAW_PY = '''"""__HERO__ (src/heroes/__THEME__/): its four spell icons, a STUB made by pipeline/tools/new-hero.py.

Gate 4: draw each spell as the hero's signature shape at work, in the family's rules (vclib.py: the frame, the ink, the
light from the upper left; one idea an icon, readable at 32 px), then
    python pipeline/icons/vectorcraft/make.py __STEM__
writes the command files (pipeline/icons/vectorcraft/__STEM__/) and exports public/icons/spells/__STEM__-q.svg ... and the
PNGs in docs/icons/new/. Look at them at 32 px: python pipeline/tools/hero-check.py "__HERO__" --only icons.
The spells: __NAMES__.
"""
from vclib import *  # noqa: F401,F403  the builder, the geometry and the rules
from vclib import PAL

# the palette row: core, hot, body (the accent), accent (the foil's partner), dark; as docs/ART_BIBLE.md's row for the hero
PAL["__STEM__"] = row("#fff6e8", "__FOIL__", "__ACCENT__", "__FOIL__", "#14100c")


def __FN___q(ic):
    """Q: a stand-in (a disc in the accent). Replace with the spell's picture."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def __FN___w(ic):
    """W: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def __FN___e(ic):
    """E: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


def __FN___r(ic):
    """R: a stand-in."""
    disc(ic, 32, 32, 14, ic.grad(ic.p["hot"], (1, ic.p["body"])))


ICONS = {"q": __FN___q, "w": __FN___w, "e": __FN___e, "r": __FN___r}
'''

MODEL_PY = '''"""__HERO__: the model, a STUB made by pipeline/tools/new-hero.py (gate 2, docs/pipeline/new-hero.md).

One continuous realistic body on the animation pack's skeleton (pipeline/designs/style-v4/README.md): the people's body,
then the costume and props from clean forms. A staff, wand or instrument in the LEFT hand, a weapon in the RIGHT. Colours
from the card (accent __ACCENT__, foil __FOIL__), gold on the edges; emissive at most 1. Its people shows in the figure
(docs/lore/LORE.md), never cartoon. Build and look (Blender: one agent at a time):
    blender --background --factory-startup --python blender/heroes/real_build.py -- __THEME__ --shots <folder>
It writes public/models/heroes/__THEME___v4.glb: 300-600 KB, about 25,000 triangles at most (hero-check.py measures it).
Shown between Sefu and Kaia before gate 2's yes (pipeline/tools/v4-sheet.js, `_v4lineup`).
"""
from realkit import Real


def build():
    R = Real("__THEME__", sex="__SEX__")
    z = R.z
    R.mat("cloth", "__ACCENT__", rough=0.62)
    R.mat("foil", "__FOIL__", rough=0.55)
    R.mat("deep", "#1c1814", rough=0.5)
    R.mat("leather", "#2a2018", rough=0.42, metal=0.1)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.hair("Hair_Long", "#1a1410", rough=0.42)

    R.fitted("Tunic", ["pelvis", "spine", "clavicle", "upperarm"], "cloth")
    R.fitted("Leggings", ["thigh", "calf", "pelvis"], "deep", offset=0.003)
    R.fitted("Boots", lambda i: R.dom[i].startswith(("foot_", "ball_")) or (R.dom[i].startswith(("calf_", "thigh_")) and R.world[i].z < z["knee"] + 0.09), "leather", offset=0.009)
    R.band("gold", z["waist"], height=0.05)
    # Gate 2: the costume, the held thing and the people's marks (see blender/heroes/real/astral.py, phoenix.py)
    return R
'''


def sheet_md(h):
    rows = '\n'.join(f"| {k} | **{h['spells'][k]['name']}** | {h['spells'][k]['shape'].upper()} | {fmt(h['spells'][k]['n']['cooldown'])} | "
                     f"{fmt(h['spells'][k]['n'].get('range', 0))} m | | {h['spells'][k]['n']['damage']} | (the rule, and its answer with the arithmetic) |"
                     for k in 'QWER')
    return f"""---
title: Kit sheet, {h['name']}
tags: [kit, design, draft]
updated: {datetime.date.today().isoformat()}
status: a stub made by pipeline/tools/new-hero.py; gate 1 and gate 3 to write
---

# {h['name']}, {h['title']}

## Gate 1: the card

| | |
|---|---|
| **Sentence** | (one sentence: the mythic role) |
| **Signature shape** | (a shape you can draw as a 64-pixel icon) |
| **Colours** | Accent `{h['accent']}`, foil `{h['foil']}` (not a neighbour of an existing hero's: docs/ART_BIBLE.md) |
| **Theme word** | `{h['theme']}` |
| **Role** | {h['kind'].capitalize()}, {'melee' if h['melee'] else 'ranged'} |
| **Faction** | {h['faction']} (docs/lore/LORE.md) |
| **The new thing** | (rule 2: what no hero has yet) |
| **The question** | (rule 3) |
| **The weakness** | (rule 3) |
| **The second decision** | (rule 3) |
| **How it looks** | (its people, its clothes, its held thing) |
| **Nearest heroes** | |

## Gate 3: the kit on paper

{h['name']}. Theme `{h['theme']}`. {h['kind'].capitalize()}, {'melee' if h['melee'] else 'ranged'}. **{h['hp']} HP**, 4.0 m/s. Accent `{h['accent']}`, foil `{h['foil']}`.

| Key | Spell | Shape | CD (s) | Range | Size | Damage | Rule |
|---|---|---|---:|---|---|---|---|
| P | **{h['passive']}** | PASSIVE | - | - | - | - | {h['passive_blurb']} |
{rows}
"""


def codex_md(h):
    return f"""---
title: {h['name']}, {h['title']}
hero: {h['name']}
---

# {h['name']}, {h['title']}

*(faction) · (people) · from (realm)* · [Heroes](README.md) · a draft, not in the game

## Biography

(To write at gate 1: 600 to 1000 words.)

## People and appearance

## Voice

## Voice lines

## Secrets

## What {h['pronoun'] if h['pronoun'] in ('he', 'she') else 'they'} {'want' if h['pronoun'] not in ('he', 'she') else 'wants'} from the Tower

## Ties
"""


def checklist_md(h, made):
    t, n = h['theme'], h['name']
    made_list = '\n'.join(f'- `{f}`' for f in made)
    lore_line = ('its entry was already in `docs/lore/LORE.md` (status `' + h['lore_status'] + '`): left as it is'
                 if h['lore_existed'] else
                 f'`docs/lore/LORE.md`: its entry (status `draft`), `{n}` in the members of `{h["faction"]}`, its line under Origins')
    return f"""---
title: New hero, {n}
tags: [heroes, new-hero, checklist]
updated: {datetime.date.today().isoformat()}
status: draft; gate 1 next
---

# {n}, {h['title']}: the gates

Made by `python pipeline/tools/new-hero.py "{n}"` on {datetime.date.today().isoformat()}. The rules and the gates:
[docs/pipeline/new-hero.md](../../pipeline/new-hero.md). Each gate ends in a picture and the user's yes; no work of a later
gate starts before it. A draft is not in the game (`draft: true` on its card): it plays on the hero workbench
(`/workbench.html` on the dev server, `npm run dev`), and the tools fight it with `--drafts`.

Theme `{t}`, icon stem `{h['stem']}`, faction `{h['faction']}`, {h['kind']}, {'melee' if h['melee'] else 'ranged'}, {h['hp']} HP, accent
`{h['accent']}`, foil `{h['foil']}`. The checks of one hero, all at once: `python pipeline/tools/hero-check.py "{n}"`.

## Gate 1: card (rule 0 first: the lore)
- [ ] Its lore: people, realm and home, faction, age, legend (80-150 words), line, two to four ties, its origin
      (`docs/lore/LORE.md`); its codex page (`docs/lore/codex/heroes/{h['codex']}.md`). `python pipeline/tools/lore-page.py --check`
      lists what a draft still lacks as notes.
- [ ] The card in `pipeline/designs/kit-{t}.md`: sentence, shape, colours, role, the new thing, question, weakness, second decision
      (rules 1 to 3).
- [ ] Name, title, spell names and theme word new (`python pipeline/tools/kits20.py` checks names taken).
- [ ] **The user's yes to the idea.**

## Gate 2: look
- [ ] `blender/heroes/real/{t}.py`, one `build()`; `public/models/heroes/{t}_v4.glb` 300-600 KB, at most about 25,000 triangles
      (`hero-check.py "{n}" --only model`).
- [ ] The card's `body` measured on the model; what it holds and how it strikes (`src/motion/real.ts`, `REAL_STYLE`).
- [ ] Pictures: front, face, back, walking, its attack at the hit, the game camera; the line-up between Sefu and Kaia.
- [ ] **The user's yes to the figure.**

## Gate 3: kit on paper
- [ ] The sheet's table: per spell its key, name, cooldown, rule, and the answer with its arithmetic (rule 4).
- [ ] Which block each spell is (`src/heroes/framework/blocks.ts`): bolt, circle, lane, sure hit, zone; and what is new code.
- [ ] What the CPU does with each spell, and against it.
- [ ] **The user's yes to the kit.**

## Gate 4: spells
- [ ] `numbers.ts` from the sheet; the spells on the blocks (`spells/`); the look of each (a class in place of the sketch).
- [ ] The passive (`trait.ts`); the icons (`pipeline/icons/vectorcraft/draw/{h['stem'].replace('-', '_')}.py`, `make.py {h['stem']}`); the portrait
      (`icons.ts`) drawn from the agreed model.
- [ ] On the workbench: every spell's reach and timing drawn on the floor match the sheet.
- [ ] `npx tsc --noEmit -p .` and `npm run build`.
- [ ] **One picture a spell from the game camera; the user's yes.**

## Gate 5: plays
- [ ] `aiHold`, `aiGoal`, `enemyGoal` in `trait.ts`.
- [ ] `python pipeline/tools/hero-check.py "{n}"`: the simulator 40-60% over at least 96 fights, the icons at 32 px, the model,
      the lore; no errors.
- [ ] The Raid's first boss (`_raid(['{n}', ...], 30)`, `pipeline/tools/raid-tool.js`).
- [ ] **A clip of a CPU duel; the user has played it once.**

## Gate 6: release
- [ ] Delete `draft: true` from `src/heroes/{t}/hero.ts`; its row in `HERO_SHOP` (`server/protocol.mjs`), `PROTOCOL` plus one.
- [ ] Its LORE.md status `roster`; `python pipeline/tools/lore-game.py` and `python pipeline/tools/lore-codex.py`.
- [ ] Its fight prints taken (`python pipeline/tools/hero-prints.py take "{n}"` and `take "{n}" --foe Brannoc`); then
      `hero-check.py "{n}"` again: the online pair check runs once the server knows it.
- [ ] Catalog page and row, palette row (`docs/ART_BIBLE.md`), the counts, `src/game/changelog.ts`, `docs/STATUS.md`.
- [ ] **The user asks for the push, then for the deploy.**

## Made by the command
{made_list}
- {lore_line}

To take the draft out again (its files and its lore stub): `python pipeline/tools/new-hero.py "{n}" --remove --yes`.
"""


# --------------------------------------------------------------------------------------------------------------------------
# LORE.md


def lore_add(h, text):
    """The entry (status `draft`), the faction's member, the origin line."""
    n = h['name']
    pron = h['pronoun']
    entry = (f"### {n} | {h['title']} | {h['theme']} | {h['faction']} | {pron} | draft\n"
             f"- people: {h['people']}\n"
             f"- home: (place) | (where exactly)\n"
             f"- age: (how old)\n"
             f"> \"(the line {pron} would say)\"\n\n"
             f"(The legend, 80 to 150 words, written at gate 1 from its place on the Dial: its people, its realm, its faction, its"
             f" ties to the heroes already there. A draft made by pipeline/tools/new-hero.py.)\n\n")
    i = text.index('\n## Ties\n')
    text = text[:i + 1] + entry + text[i + 1:]
    m = re.search(r'^(### ' + re.escape(h['faction']) + r' \|[^\n]*\n(?:- [^\n]*\n)*?- members: )([^\n]*)$', text, re.M)
    if not m:
        raise SystemExit(f"faction {h['faction']} has no members line in LORE.md")
    text = text[:m.end(2)] + f', {n}' + text[m.end(2):]
    i = text.index('\n## Origins\n')
    j = text.find('\n## ', i + 5)
    j = len(text) if j < 0 else j
    block = text[i:j].rstrip('\n')
    text = text[:i] + block + f"\n- {n} | dial | (where it comes from, in a few words; draft)\n" + text[j:]
    return text


def lore_remove(name, text):
    """Takes out what lore_add put in, for a hero whose entry is still a draft."""
    m = re.search(r'^### ' + re.escape(name) + r' \|[^\n]*\| draft\s*\n.*?(?=^### |^## )', text, re.M | re.S)
    if not m:
        return text, False
    text = text[:m.start()] + text[m.end():]
    text = re.sub(r'^(- members: .*?), ' + re.escape(name) + r'(?=,|$)', r'\1', text, flags=re.M)
    text = re.sub(r'^- ' + re.escape(name) + r' \| [a-z]+ \| [^\n]*draft\)\n', '', text, flags=re.M)
    return text, True


# --------------------------------------------------------------------------------------------------------------------------


def plan(args):
    name = args.name.strip()
    if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,30}", name):
        raise SystemExit('A hero name is letters, spaces, dots, dashes or apostrophes, 2 to 31 characters.')
    known = lore_heroes()
    lore = known.get(name)
    if lore and lore['status'] == 'roster':
        raise SystemExit(f'{name} is already in the game (LORE.md status roster).')
    theme = args.theme or (lore['theme'] if lore else re.sub(r'[^a-z]', '', name.split()[0].lower()))
    if not re.fullmatch(r'[a-z]{2,16}', theme):
        raise SystemExit(f"The theme word is one lower-case word: '{theme}'. Give it with --theme.")
    sheet = read_sheet(theme) or {}
    role = (args.role or sheet.get('role') or 'caster').lower()
    kind = ROLE_KIND.get(re.split(r'[ ,]', role)[0], 'caster')
    if kind not in KINDS:
        kind = 'caster'
    melee = 'melee' in role
    h = {
        'name': name, 'theme': theme, 'stem': stem_of(name), 'kind': kind, 'melee': melee,
        'title': args.title or (lore['title'] if lore else 'the Newcomer'),
        'faction': args.faction or (lore['faction'] if lore else 'loners'),
        'pronoun': args.pronoun or (lore['pronoun'] if lore else 'they'),
        'people': args.people or (lore_people(name) if lore else '') or '(people)',
        'hp': sheet.get('hp') or ROLE_HP[kind] + (60 if melee and kind in ('assassin', 'caster') else 0),
        'accent': args.accent or sheet.get('accent') or '#c08a4a', 'foil': args.foil or sheet.get('foil') or '#f2ead8',
        'lore_existed': bool(lore), 'lore_status': lore['status'] if lore else 'draft', 'sheet': sheet.get('file'),
    }
    lp = lore_page()
    h['codex'] = lp.slug(name)[2:]
    p = sheet.get('spells', {}).get('P')
    h['passive'] = p['name'] if p else 'Its Passive'
    h['passive_blurb'] = p['rule'] if p else '(What the passive does, in words a player can act on: rule 3.)'
    taken = taken_labels()
    h['spells'] = {}
    for key in 'QWER':
        row = sheet.get('spells', {}).get(key)
        word = row['shape'] if row else ''
        shape = SHAPE_BLOCK.get(word, DEFAULT_SHAPES[key] if not row else 'circle')
        sp = {'name': row['name'] if row else DEFAULT_NAMES[key], 'shape': shape, 'rule': row['rule'] if row else ''}
        if row and word not in SHAPE_BLOCK:
            sp['note'] = (f'The sheet\'s shape is {word or "(none)"}: no block fits it yet, so a circle stands in. Gate 3 decides '
                          'whether it is a new block or the spell\'s own code (as the spells that stayed code in the blocks trial).')
        label = sp['name'].lower()
        if label in taken or (name == DEFAULT_NAMES.get(key) or sp['name'] == DEFAULT_NAMES[key]):
            label = f"{stem_of(name).replace('-', ' ')} {sp['name'].lower()}"
        if label in taken:
            raise SystemExit(f"The spell label '{label}' is taken: rename the spell on the sheet.")
        taken.add(label)
        sp['label'] = label
        sp['n'] = spell_numbers(key, shape, row)
        h['spells'][key] = sp
    rel, drafts = roster_count()
    h['order'] = rel + drafts
    return h


def remove(args):
    name = args.name.strip()
    hits = [f for f in HEROES.glob('*/hero.ts') if re.search(r"^  name: " + re.escape(ts_str(name)) + r",", f.read_text(encoding='utf-8'), re.M)]
    if not hits:
        raise SystemExit(f'No hero folder has the card of {name}.')
    card = hits[0]
    if not re.search(r'^\s*draft: true,', card.read_text(encoding='utf-8'), re.M):
        raise SystemExit(f'{name} is not a draft ({card.relative_to(ROOT).as_posix()}): nothing is removed.')
    theme = card.parent.name
    check = ROOT / 'docs' / 'heroes' / 'new' / f'{theme}.md'
    listed = re.findall(r'^- `([^`]+)`$', check.read_text(encoding='utf-8'), re.M) if check.exists() else []
    targets = [ROOT / f for f in listed] or [p for p in card.parent.rglob('*') if p.is_file()]
    # what make.py wrote from the stub since (its command files; the SVGs and PNGs if it exported them)
    stem = stem_of(name)
    vc = ROOT / 'pipeline' / 'icons' / 'vectorcraft' / stem
    targets += [p for p in vc.glob('*.json') if re.fullmatch(r'[qwer](-a)?\.json', p.name)] if vc.is_dir() else []
    targets += [ROOT / 'public' / 'icons' / 'spells' / f'{stem}-{k}.svg' for k in 'qwer']
    targets += [ROOT / 'docs' / 'icons' / 'new' / f'{stem}-{k}.png' for k in 'qwer']
    say(f'{name}: the draft in src/heroes/{theme}/ and what new-hero.py made for it:')
    for t in targets:
        if t.exists():
            say(f'  delete {t.relative_to(ROOT).as_posix()}')
    text = LORE.read_text(encoding='utf-8')
    new, found = lore_remove(name, text)
    say('  LORE.md: its draft entry, its member and origin lines' if found else '  LORE.md: no draft entry (left as it is)')
    if not args.yes:
        say('Nothing was removed: run again with --yes.')
        return
    for t in targets:
        if t.exists():
            t.unlink()
    for d in sorted({t.parent for t in targets}, key=lambda p: -len(p.parts)):
        while d != ROOT and d.exists() and not any(d.iterdir()):
            d.rmdir()
            d = d.parent
    if found:
        write_lore(new)
    say('Removed.')


def main():
    ap = argparse.ArgumentParser(description='Make a new hero (a draft) in one go: docs/pipeline/new-hero.md.')
    ap.add_argument('name')
    ap.add_argument('--theme', help='one lower-case word (the folder, the model, the kit sheet)')
    ap.add_argument('--title')
    ap.add_argument('--faction', help='a faction id of LORE.md (truce, noonsworn, dusk, greenwood, windward, underforge, dune, hourkeepers, loners)')
    ap.add_argument('--pronoun', choices=['he', 'she', 'they'])
    ap.add_argument('--people', help='a people id of LORE.md (aubade, dune, gloaming, north, coast, kiln, wood, mole, ninefold, briar, longdead, fallborn)')
    ap.add_argument('--role', help='vanguard, fighter, assassin, caster, controller or support; add "melee" for a melee hero')
    ap.add_argument('--accent')
    ap.add_argument('--foil')
    ap.add_argument('--dry', action='store_true', help='say what would be written; write nothing')
    ap.add_argument('--remove', action='store_true', help='take a draft out again (with --yes)')
    ap.add_argument('--yes', action='store_true')
    args = ap.parse_args()
    if args.remove:
        return remove(args)
    h = plan(args)
    if (HEROES / h['theme']).exists():
        raise SystemExit(f"src/heroes/{h['theme']}/ is there already: pick another --theme, or remove that draft first.")
    if h['theme'] in {f.stem for f in (ROOT / 'blender' / 'heroes' / 'real').glob('*.py')}:
        raise SystemExit(f"blender/heroes/real/{h['theme']}.py is there already: pick another --theme.")
    files = make_files(h)
    clash = [f for f in files if (ROOT / f).exists()]
    if clash:
        raise SystemExit('These files are there already (nothing was written): ' + ', '.join(clash))
    say(f"{h['name']}, {h['title']}: theme {h['theme']}, {h['kind']}{' (melee)' if h['melee'] else ''}, {h['hp']} HP, "
        f"accent {h['accent']}, faction {h['faction']}, place {h['order']} once released"
        + (f", from {h['sheet']}" if h['sheet'] else ', no kit sheet yet'))
    for key in 'QWER':
        sp = h['spells'][key]
        say(f"  {key} {sp['name']}: {sp['shape']}" + (' (a stand-in: no block for the sheet\'s shape)' if sp.get('note') else ''))
    for f in files:
        say(f"  {'would write' if args.dry else 'write'} {f}")
    say(f"  {'would add' if args.dry else 'add'} to docs/lore/LORE.md: " + ('nothing (its entry is there)' if h['lore_existed'] else 'its draft entry, member and origin lines'))
    if args.dry:
        return
    for f, text in files.items():
        p = ROOT / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding='utf-8', newline='\n')
    if not h['lore_existed']:
        write_lore(lore_add(h, LORE.read_text(encoding='utf-8')))
    say()
    say('Next:')
    say(f"  1. Gate 1: its lore in docs/lore/LORE.md and its card in pipeline/designs/kit-{h['theme']}.md.")
    say(f"  2. Play it: npm run dev, then open http://localhost:5173/workbench.html and pick {h['name']}.")
    say(f"  3. Its checks: python pipeline/tools/hero-check.py \"{h['name']}\"")
    say(f"  The checklist: docs/heroes/new/{h['theme']}.md")


if __name__ == '__main__':
    main()
