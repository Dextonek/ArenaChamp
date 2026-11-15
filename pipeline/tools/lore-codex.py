"""Check the codex (docs/lore/codex/*.md) and write the game's Codex data from it.

    python pipeline/tools/lore-codex.py            # check, then write src/game/codex-index.ts and src/game/codex-<book>.ts
    python pipeline/tools/lore-codex.py --check    # check only
    python pipeline/tools/lore-codex.py --words    # the word counts of LORE.md and the codex, by folder

The codex is the depth of the lore; docs/lore/LORE.md stays the short source (lore-page.py, lore-game.py). The checks are
lore-page.py's `check_codex` (every link resolves, every hero has a page of the agreed shape, ties go both ways, every new
name is listed and new). The game's Codex screen (src/game/codex.ts) loads codex-index.ts with itself and each book's
pages on first need, so the page's start does not grow.

A page is turned into blocks the screen draws: ['h', level, text], ['p', text], ['ul', [items]], ['q', text],
['t', header, rows], ['svg', markup]. Text keeps **bold**, *italic* and [links](book/page); a link to anything outside the
codex keeps its words and loses the link.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODEX = ROOT / 'docs' / 'lore' / 'codex'
spec = importlib.util.spec_from_file_location('lorepage', ROOT / 'pipeline' / 'tools' / 'lore-page.py')
lp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lp)

# The game's books, in the order the screen shows them, and the folders or files each takes its pages from.
BOOKS = [
    ('world', 'The world', ['world.md', 'history.md']),
    ('peoples', 'Peoples', ['peoples/']),
    ('realms', 'Realms', ['realms/', 'climb/']),
    ('factions', 'Factions', ['factions/']),
    ('heroes', 'Heroes', ['heroes/']),
]

# What players see is the lore, not the team's notes. Left out of the game: the open questions for the user
# (tower-and-sun.md), the team's index of heroes with the revamp column, and the heroes not in the game yet (LORE.md status
# other than `roster`: their pages stay in docs/ until they ship). Inside a page: spans fenced with <!-- team --> ...
# <!-- /team -->, whole sections with a TEAM_SECTIONS heading, and in a hero's appearance the sentences about the figure's
# build (TEAM_SENTENCE). `check_game_text` then fails on any TEAM_WORDS left in what the game would show.
SKIP_PAGES = {'heroes/README'}
TEAM_SECTIONS = {'In the figure', 'The one style, and what a people can be in it'}
TEAM_SENTENCE = re.compile(r'revamp plan|not built yet|card drew|^Today ')
TEAM_WORDS = re.compile(r'revamp|the user|pipeline/|\.py\b|not built|the pack\b|on the cards|style-v4', re.I)


def page_files():
    """[(book, codex id, path)] in the books' order; a folder's README comes first."""
    out = []
    for book, _, parts in BOOKS:
        for part in parts:
            if part.endswith('/'):
                d = CODEX / part
                if not d.is_dir():
                    continue
                files = sorted(d.glob('*.md'), key=lambda p: (p.stem != 'README', p.stem))
                out += [(book, f'{part}{p.stem}', p) for p in files
                        if f'{part}{p.stem}' not in SKIP_PAGES and not (part == 'heroes/' and p.stem in UNRELEASED)]
            elif (CODEX / part).exists():
                out.append((book, part[:-3], CODEX / part))
    return out


def link_target(src_id, href):
    """A codex id for a link written in page `src_id`, or None if it leaves the codex."""
    if href.startswith(('http:', 'https:', '#', 'mailto:')):
        return None
    href = href.split('#', 1)[0]
    if not href.endswith('.md'):
        return None
    base = src_id.split('/')[:-1]
    for bit in href[:-3].split('/'):
        if bit == '..':
            if not base:
                return None
            base.pop()
        elif bit not in ('', '.'):
            base.append(bit)
    return '/'.join(base)


def fix_links(src_id, text, known):
    def sub(m):
        t = link_target(src_id, m.group(2))
        return f'[{m.group(1)}]({t})' if t and t in known else m.group(1)
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', sub, text)


def to_blocks(src_id, body, known, svgs):
    blocks, para, items, table = [], [], None, None

    def flush():
        nonlocal para, items, table
        if para:
            text = ' '.join(s.strip() for s in para)
            if text.startswith('> '):
                blocks.append(['q', fix_links(src_id, text[2:], known)])
            else:
                blocks.append(['p', fix_links(src_id, text, known)])
            para = []
        if items is not None:
            blocks.append(['ul', [fix_links(src_id, i, known) for i in items]])
            items = None
        if table is not None:
            head, rows = table[0], [r for r in table[1:] if not re.match(r'^\s*:?-{2,}', r[0] if r else '')]
            blocks.append(['t', [fix_links(src_id, c, known) for c in head], [[fix_links(src_id, c, known) for c in r] for r in rows]])
            table = None

    for ln in body:
        s = ln.rstrip()
        if s.strip() == '<!-- map -->':
            flush()
            blocks.append(['svg', svgs['map']])
        elif s.startswith('#'):
            flush()
            m = re.match(r'(#+)\s+(.*)', s)
            blocks.append(['h', len(m.group(1)), fix_links(src_id, m.group(2), known)])
        elif s.startswith('|'):
            if para or items is not None:
                flush()
            cells = [c.strip() for c in s.strip().strip('|').split('|')]
            table = (table or []) + [cells]
        elif re.match(r'^\s*- ', s):
            if para or table is not None:
                flush()
            items = (items or []) + [s.strip()[2:]]
        elif s.strip() == '':
            flush()
        elif items is not None and s.startswith('  '):
            items[-1] += ' ' + s.strip()
        else:
            if items is not None or table is not None:
                flush()
            para.append(s)
    flush()
    return blocks


def strip_team(text, hero_page):
    """The page as players see it: fenced spans, team sections and, on a hero page, the figure's build notes taken out."""
    text = re.sub(r'<!-- team -->.*?<!-- /team -->', '', text, flags=re.S)
    out, skip = [], False
    for ln in text.splitlines():
        if ln.startswith('## '):
            skip = ln[3:].strip() in TEAM_SECTIONS
        if not skip:
            out.append(ln)
    text = '\n'.join(out)
    if hero_page:
        head, sep, rest = text.partition('## People and appearance')
        if sep:
            body, sep2, tail = rest.partition('\n## ')
            paras = body.split('\n\n')
            keep = []
            for para in paras:
                flat = ' '.join(x.strip() for x in para.splitlines())
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z\[*(])', flat)
                kept = [x for x in sentences if not TEAM_SENTENCE.search(x)]
                keep.append(' '.join(kept))
            text = head + sep + '\n\n'.join(keep) + sep2 + tail
    return text


def read_page(book, pid, path, known, svgs):
    text = strip_team(path.read_text(encoding='utf-8'), pid.startswith('heroes/'))
    lines = text.splitlines()
    meta = {}
    if lines and lines[0].strip() == '---':
        end = lines.index('---', 1)
        for ln in lines[1:end]:
            if ':' in ln:
                k, v = ln.split(':', 1)
                meta[k.strip()] = v.strip()
        lines = lines[end + 1:]
    title, sub, body = meta.get('title', pid), '', []
    i = 0
    while i < len(lines) and not lines[i].startswith('# '):
        i += 1
    if i < len(lines):
        title = lines[i][2:].strip()
        i += 1
    # the line under the title in italics: what the page is (its navigation links are dropped)
    while i < len(lines) and lines[i].strip() == '':
        i += 1
    if i < len(lines) and lines[i].startswith('*'):
        sub_line = lines[i]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '-', '|')):
            sub_line += ' ' + lines[i].strip()
            i += 1
        m = re.match(r'\*(.+?)\*', sub_line)
        sub = fix_links(pid, m.group(1), known) if m else ''
    body = lines[i:]
    return {'id': pid, 'book': book, 'title': title, 'sub': sub, 'hero': meta.get('hero', ''),
            'blocks': to_blocks(pid, body, known, svgs)}


def _unreleased():
    lore = lp.read(lp.SRC)
    return {re.sub(r'[^a-z0-9]+', '-', h['name'].lower()).strip('-') for h in lore['heroes'] if h['status'] != 'roster'}


UNRELEASED = _unreleased()


def check_game_text(pages):
    """No team notes in what players see."""
    errs = []
    for p in pages:
        for t in [p['title'], p['sub']] + [str(b) for b in p['blocks'] if b[0] != 'svg']:
            m = TEAM_WORDS.search(t)
            if m:
                errs.append(f"{p['id']}: the game would show a team note ({m.group(0)!r}): {t[max(0, m.start() - 50):m.end() + 40]!r}")
                break
    return errs


def words(path):
    return len(re.findall(r"[A-Za-z0-9’'-]+", path.read_text(encoding='utf-8')))


def word_report():
    total = 0
    by = {}
    for p in sorted(CODEX.rglob('*.md')):
        n = words(p)
        total += n
        key = p.parent.name if p.parent != CODEX else '(top)'
        by[key] = by.get(key, 0) + n
    lore = words(lp.SRC)
    print(f'LORE.md: {lore} words')
    for k, n in sorted(by.items()):
        print(f'  codex/{k}: {n}')
    print(f'codex: {total} words; with LORE.md {total + lore} ({(total + lore) / lore:.1f} times LORE.md)')


def main():
    if '--words' in sys.argv:
        word_report()
        return
    lore = lp.read(lp.SRC)
    errs = lp.check(lore) + lp.check_codex(lore)
    if errs:
        print('The codex does not check out:')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    files = page_files()
    known = {pid for _, pid, _ in files}
    svgs = {'map': lp.map_svg(lore)}
    pages = [read_page(b, pid, p, known, svgs) for b, pid, p in files]
    errs = check_game_text(pages)
    if errs:
        print('The game\'s Codex would show team notes:')
        for e in errs:
            print('  -', e)
        sys.exit(1)
    print(f'codex: {len(files)} pages in the game\'s books (the {len(UNRELEASED)} heroes not in the game stay in docs/), checks passed')
    if '--check' in sys.argv:
        return
    gen = ROOT / 'src' / 'game'
    head = ('// Made by pipeline/tools/lore-codex.py from docs/lore/codex/: edit the codex there and run the script again.\n')
    index = [{'id': p['id'], 'book': p['book'], 'title': p['title'], 'sub': re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', p['sub']),
              'hero': p['hero']} for p in pages]
    (gen / 'codex-index.ts').write_text(
        head + '// Every page of the Codex: its id, book, title and line (the pages themselves are in codex-<book>.ts, loaded on first need).\n\n'
        'export interface CodexEntry { id: string; book: string; title: string; sub: string; hero: string }\n'
        f'export const CODEX_BOOKS: [string, string][] = {json.dumps([[b, t] for b, t, _ in BOOKS], ensure_ascii=False)};\n'
        f'export const CODEX_INDEX: CodexEntry[] = {json.dumps(index, ensure_ascii=False, indent=0)};\n', encoding='utf-8')
    for book, _, _ in BOOKS:
        mine = {p['id']: {'title': p['title'], 'sub': p['sub'], 'blocks': p['blocks']} for p in pages if p['book'] == book}
        (gen / f'codex-{book}.ts').write_text(
            head + f'// The Codex book "{book}": each page as blocks (see lore-codex.py).\n\n'
            'import type { CodexPage } from \'./codex\';\n\n'
            f'export const PAGES: Record<string, CodexPage> = {json.dumps(mine, ensure_ascii=False)};\n', encoding='utf-8')
    sizes = ', '.join(f"{b} {(gen / f'codex-{b}.ts').stat().st_size // 1024} KB" for b, _, _ in BOOKS)
    print(f'wrote src/game/codex-index.ts and the books: {sizes}')


if __name__ == '__main__':
    main()
