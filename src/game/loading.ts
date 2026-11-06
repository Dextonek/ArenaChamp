import type { HeroKit } from '../heroes';

/**
 * The page between the menu and a fight: both heroes face each other over the arena's name, with a bar and a line that
 * says what it is waiting for. It stays up while the arena and the figures load and, online, until the other player is
 * ready too; the duel's 3-2-1 starts when it goes.
 */
export class LoadingScreen {
  private root = document.createElement('div');
  private arena = document.createElement('div');
  private line = document.createElement('div');
  private note = document.createElement('div');
  private duel = document.createElement('div');

  constructor() {
    this.root.className = 'loading';
    this.root.style.display = 'none';
    const box = document.createElement('div');
    box.className = 'loading-box';
    const bar = document.createElement('div');
    bar.className = 'loading-bar';
    bar.append(document.createElement('i'));
    this.arena.className = 'loading-arena';
    this.line.className = 'loading-line';
    this.note.className = 'loading-note';
    this.duel.className = 'loading-duel';
    box.append(this.duel, this.arena, this.note, bar, this.line);
    this.root.append(box);
    document.body.append(this.root);
  }

  /** Shows the page for `mine` against `theirs`, with the players' names under the heroes (online). `title` heads it; `note` says what changed for this round. */
  show(o: { mine?: HeroKit; theirs?: HeroKit; names?: [string, string]; title: string; line: string; note?: string }) {
    this.duel.replaceChildren(this.side(o.mine, o.names?.[0]), this.versus(), this.side(o.theirs, o.names?.[1]));
    this.arena.textContent = o.title;
    this.line.textContent = o.line;
    this.note.textContent = o.note ?? '';
    this.note.style.display = o.note ? '' : 'none';
    this.root.style.display = '';
  }

  /** The arena's name, once it is picked. */
  setArena(name: string) {
    this.arena.textContent = name;
  }

  /** What it is waiting for now. */
  setLine(text: string) {
    this.line.textContent = text;
  }

  hide() {
    this.root.style.display = 'none';
  }

  private versus() {
    const v = document.createElement('div');
    v.className = 'loading-vs';
    v.textContent = 'VS';
    return v;
  }

  private side(kit: HeroKit | undefined, name?: string) {
    const s = document.createElement('div');
    s.className = 'loading-side';
    const c = document.createElement('canvas');
    c.className = 'portrait loading-portrait';
    c.width = c.height = 192;
    if (kit) {
      kit.portrait(c.getContext('2d')!, 192);
      c.style.borderColor = kit.foil;
    }
    const n = document.createElement('div');
    n.className = 'kit-name';
    n.textContent = kit ? kit.name : '?';
    const who = document.createElement('div');
    who.className = 'muted small';
    who.textContent = name ?? kit?.title ?? '';
    s.append(c, n, who);
    return s;
  }
}

/** Resolves once the browser has painted what is on screen, even in a hidden tab (it does not wait for a frame there). */
export function nextPaint(): Promise<void> {
  return new Promise((ok) => {
    const done = () => setTimeout(ok, 0);
    requestAnimationFrame(done);
    setTimeout(ok, 150);
  });
}

export const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
