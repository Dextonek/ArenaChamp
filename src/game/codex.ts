/**
 * The Codex screen: the deep lore of the Dial (docs/lore/codex/), reached from the menu and from a hero's Lore panel
 * ("More about …"). Its pages are made by pipeline/tools/lore-codex.py: codex-index.ts (every page's title and line) comes
 * with this module, and each book's pages (codex-<book>.ts) are loaded the first time one of them is opened. main.ts loads
 * this module itself on first need, so the start of the page does not grow.
 *
 * A page is a list of blocks: ['h', level, text], ['p', text], ['ul', items], ['q', text], ['t', header, rows], ['svg', markup].
 * Text carries **bold**, *italic* and [links](book/page) to other codex pages.
 */
import { CODEX_BOOKS, CODEX_INDEX, type CodexEntry } from './codex-index';
import './codex.css';

export type CodexBlock =
  | ['h', number, string]
  | ['p', string]
  | ['ul', string[]]
  | ['q', string]
  | ['t', string[], string[][]]
  | ['svg', string];
export interface CodexPage { title: string; sub: string; blocks: CodexBlock[] }

/** What the screen needs from the game page: a redraw, and (optional) a way to show a hero's kit. */
export interface CodexHost {
  rerender(): void;
  /** Opens the hero on the Heroes screen (null when that screen is not open to this player). */
  showHero?: ((name: string) => void) | null;
}

const LOADERS: Record<string, () => Promise<{ PAGES: Record<string, CodexPage> }>> = {
  world: () => import('./codex-world'),
  peoples: () => import('./codex-peoples'),
  realms: () => import('./codex-realms'),
  factions: () => import('./codex-factions'),
  heroes: () => import('./codex-heroes'),
  story: () => import('./codex-story'),
};

const byId = new Map(CODEX_INDEX.map((e) => [e.id, e]));
const books = new Map<string, Record<string, CodexPage>>();
const asked = new Set<string>();
/** The page on show ('' the Codex's front), the book whose list is open on the front, and the filter typed there. */
const view = { page: '', book: 'peoples', filter: '' };

/** The codex page of a hero, by its name (`heroes/<name as a slug>`), or '' if it has none. */
export function heroPageId(name: string) {
  const id = `heroes/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return byId.has(id) ? id : '';
}

/** Open the Codex at a page ('' its front). The caller then shows the Codex screen. */
export function openAt(id: string) {
  view.page = byId.has(id) ? id : '';
  if (view.page) view.book = byId.get(view.page)!.book;
}

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function load(book: string, host: CodexHost) {
  if (books.has(book) || asked.has(book)) return;
  asked.add(book);
  LOADERS[book]?.()
    .then((m) => { books.set(book, m.PAGES); host.rerender(); })
    .catch(() => { asked.delete(book); });
}

/** Text with **bold**, *italic*, `code` and [links](page) as nodes; a link opens that page here. */
function inline(text: string, host: CodexHost): Node[] {
  const out: Node[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push(document.createTextNode(text.slice(at, m.index)));
    if (m[1] !== undefined) out.push(el('b', {}, ...inline(m[1], host)));
    else if (m[2] !== undefined) out.push(el('i', {}, ...inline(m[2], host)));
    else if (m[3] !== undefined) out.push(el('code', {}, m[3]));
    else {
      const id = m[5];
      out.push(byId.has(id)
        ? el('a', { class: 'cx-link', href: `#codex/${id}`, onclick: (e: Event) => { e.preventDefault(); go(id, host); } }, ...inline(m[4], host))
        : document.createTextNode(m[4]));
    }
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(document.createTextNode(text.slice(at)));
  return out;
}

function go(id: string, host: CodexHost) {
  openAt(id);
  host.rerender();
  document.querySelector('.ui')?.scrollTo({ top: 0 });
}

function block(b: CodexBlock, host: CodexHost): Node {
  switch (b[0]) {
    case 'h': return el(b[1] <= 2 ? 'h2' : 'h3', { class: 'cx-h' }, ...inline(b[2], host));
    case 'p': return el('p', {}, ...inline(b[1], host));
    case 'q': return el('blockquote', { class: 'cx-q' }, ...inline(b[1], host));
    case 'ul': return el('ul', { class: 'cx-ul' }, ...b[1].map((i) => el('li', {}, ...inline(i, host))));
    case 't': return el('div', { class: 'cx-table' }, el('table', {},
      el('thead', {}, el('tr', {}, ...b[1].map((c) => el('th', {}, ...inline(c, host))))),
      el('tbody', {}, ...b[2].map((r) => el('tr', {}, ...r.map((c) => el('td', {}, ...inline(c, host))))))));
    case 'svg': {
      const d = el('div', { class: 'cx-map' });
      d.innerHTML = b[1];
      return d;
    }
  }
}

const bookName = (book: string) => CODEX_BOOKS.find(([b]) => b === book)?.[1] ?? book;

/** One page, with the way back, its place in its book and the next and previous pages. */
function pageView(entry: CodexEntry, host: CodexHost) {
  const pages = books.get(entry.book);
  if (!pages) {
    load(entry.book, host);
    return el('section', { class: 'card cx-page' }, el('p', { class: 'muted' }, `Opening ${entry.title}…`));
  }
  const p = pages[entry.id];
  const inBook = CODEX_INDEX.filter((e) => e.book === entry.book);
  const i = inBook.indexOf(entry);
  const step = (e: CodexEntry | undefined, label: string) => e
    ? el('button', { class: 'cx-step', onclick: () => go(e.id, host) }, el('span', { class: 'muted small' }, label), el('b', {}, e.title))
    : el('span', {});
  return el('article', { class: 'card cx-page' },
    el('nav', { class: 'cx-crumbs' },
      el('button', { class: 'cx-crumb', onclick: () => go('', host) }, 'Codex'), el('span', { 'aria-hidden': 'true' }, '›'),
      el('button', { class: 'cx-crumb', onclick: () => { view.book = entry.book; go('', host); } }, bookName(entry.book))),
    el('h1', { class: 'cx-title' }, p.title),
    p.sub ? el('div', { class: 'cx-sub' }, ...inline(p.sub, host)) : null,
    entry.hero && host.showHero ? el('button', { class: 'btn small cx-kit', onclick: () => host.showHero?.(entry.hero) }, `${entry.hero}'s kit →`) : null,
    el('div', { class: 'cx-body' }, ...p.blocks.map((b) => block(b, host))),
    el('div', { class: 'cx-steps' }, step(inBook[i - 1], '← Before'), step(inBook[i + 1], 'Next →')));
}

/** The front: the books as tabs, a filter, and the open book's pages. */
function frontView(host: CodexHost) {
  const filter = el('input', { class: 'cx-filter', type: 'search', placeholder: 'Find a page: a hero, a people, a place…', value: view.filter }) as HTMLInputElement;
  const list = el('div', { class: 'cx-list' });
  const fill = () => {
    const q = view.filter.trim().toLowerCase();
    const shown = CODEX_INDEX.filter((e) => (q ? `${e.title} ${e.sub}`.toLowerCase().includes(q) : e.book === view.book));
    list.replaceChildren(...shown.map((e) => el('button', { class: 'cx-entry', onclick: () => go(e.id, host) },
      el('b', {}, e.title), e.sub ? el('span', { class: 'muted small' }, e.sub) : null,
      q ? el('i', { class: 'cx-book' }, bookName(e.book)) : null)));
    if (!shown.length) list.append(el('p', { class: 'muted' }, 'Nothing by that name.'));
  };
  filter.addEventListener('input', () => { view.filter = filter.value; fill(); });
  fill();
  return el('div', { class: 'cx-front' },
    el('div', { class: 'cx-head' },
      el('h1', {}, 'Codex'),
      el('p', { class: 'muted' }, 'The world of the Dial: its peoples and realms, the factions, a hundred years of history, the Climb, every hero in full, and the whole story, from before the Fall to the top of the Tower.')),
    el('div', { class: 'cx-books', role: 'tablist' }, ...CODEX_BOOKS.map(([b, name]) => el('button', {
      class: `cx-bookbtn${view.book === b && !view.filter ? ' on' : ''}`, role: 'tab',
      onclick: () => { view.book = b; view.filter = ''; host.rerender(); },
    }, name, el('span', { class: 'cx-count' }, String(CODEX_INDEX.filter((e) => e.book === b).length))))),
    filter,
    el('section', { class: 'card cx-listcard' }, list));
}

/** The Codex screen as it stands: the front, or the open page. */
export function codexView(host: CodexHost) {
  const entry = view.page ? byId.get(view.page) : undefined;
  return el('div', { class: 'codex' }, entry ? pageView(entry, host) : frontView(host));
}
