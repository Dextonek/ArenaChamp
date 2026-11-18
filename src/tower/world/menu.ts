import type { GameApi } from '../../runtime';
import { boonById } from '../boons';
import { CHAPTERS, FLOORS, TOP_FLOOR, chapterOf, floorAtOrBelow, isCrown } from './floors';
import { WorldGame } from './game';
import { KEYS, WorldRun, nextFloor, read, sigils } from './state';
import type { WorldPresence } from '../../net/world';

/**
 * The Tower screen's "Climb" tab (the floors as worlds, pipeline/designs/tower-worlds.md) and the controller that runs a climb on the game
 * page. The game's menu (`src/game/main.ts`) draws the tab bar, the hero showcase and the hero picker and hands them in; the rest of
 * the screen is here: the 50 floors in five chapters of ten (pipeline/designs/tower-50.md), each a small tile (open when reached,
 * locked until then, "soon" while not made yet, the tenth a crown), the picked floor's name, law, stars and best time, the sigils kept,
 * and Start / Continue / Begin again. Plain DOM with its own styles (the look of the Trials tab's floor tiles), so the game's stylesheet
 * does not change. Nothing here writes the weekly Tower's keys (`tower.save`, `tower.best`) or its board: the climb has its own,
 * `tower.world.*` (state.ts).
 */

const STYLE_ID = 'world-menu-style';
const CSS = `
.wc-ch{margin:12px 0 4px}
.wc-ch-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 6px}
.wc-ch-h .k{font:800 10px ui-sans-serif,system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--gold,#c9a24a)}
.wc-ch-h b{font:700 15px var(--display,ui-serif,Georgia,serif);color:var(--text,#e9dcc6)}
.wc-ch-h .c{font-size:11px;color:var(--muted,#a89870);margin-left:auto}
.wc-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:5px}
.wc-t{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0;min-height:44px;padding:5px 2px 4px;border-radius:8px;border:1px solid var(--line,#3a3242);background:rgba(8,6,10,.5);color:inherit;font:inherit;cursor:pointer}
.wc-t b{font:700 15px var(--display,ui-serif,Georgia,serif);color:var(--text,#e9dcc6);line-height:1.1}
.wc-t span{max-width:100%;overflow:hidden;white-space:nowrap;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#a89870)}
.wc-t .st{letter-spacing:0;font-size:10px;color:var(--gold-hi,#ffd27a)}
.wc-t .st .off{color:#4a4032}
.wc-t svg{position:absolute;top:3px;right:4px;width:11px;height:9px;fill:var(--gold-hi,#ffd27a)}
.wc-t svg.lock{fill:var(--muted,#a89870);position:static;width:9px;height:10px}
.wc-t.crown{border-color:var(--line-gold,rgba(201,162,74,.38));background:linear-gradient(180deg,rgba(201,162,74,.2),rgba(201,162,74,.04))}
.wc-t.crown b{color:var(--gold-hi,#ffd27a)}
.wc-t.done{border-color:rgba(120,210,140,.5)}
.wc-t.done b{color:#9df0b4}
.wc-t.locked{cursor:default;opacity:.6}
.wc-t.soon{cursor:default;border-style:dashed;background:transparent;opacity:.42}
.wc-t.soon b{color:var(--muted,#a89870)}
.wc-t.on{box-shadow:0 0 0 2px var(--gold-hi,#ffd27a)}
.wc-pick{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:12px 0 4px;padding:10px 12px;border-radius:10px;border:1px solid var(--line-gold,rgba(201,162,74,.38));background:rgba(60,46,20,.35)}
.wc-pick .k{font:800 10px ui-sans-serif,system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#c9a24a);flex-basis:100%}
.wc-pick b{font:700 17px var(--display,ui-serif,Georgia,serif);color:var(--text,#e9dcc6)}
.wc-pick .law{font-size:12px;color:#8cc4ff}
.wc-pick .st{font-size:15px;letter-spacing:2px;color:var(--gold-hi,#ffd27a)}
.wc-pick .st .off{color:#4a4032}
.wc-pick .tm{font-size:12px;color:var(--muted,#a89870)}
.wc-pick p{flex-basis:100%;margin:2px 0 0;font-size:12px;color:var(--muted,#a89870)}
.wc-sig{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}
.wc-sig span{padding:3px 9px;border-radius:999px;border:1px solid var(--line-gold,#6a5a3a);font-size:12px;font-weight:600;color:var(--gold-hi,#ffd27a)}
@media (max-width:600px){.wc-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
`;
/** A small crown for the tenth floor of a chapter, and a padlock for a floor not reached. */
const CROWN = '<svg viewBox="0 0 12 10" aria-hidden="true"><path d="M0 2l3 3 3-5 3 5 3-3-1 8H1z"/></svg>';
const LOCK = '<svg class="lock" viewBox="0 0 9 10" aria-hidden="true"><path d="M2 4V3a2.5 2.5 0 015 0v1h1v6H1V4zm1 0h3V3a1.5 1.5 0 00-3 0z"/></svg>';
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starsOf = (got: number[] | undefined) => (got ?? [0, 0, 0, 0]).map((g) => (g ? '★' : '<span class="off">☆</span>')).join('');

/** A climb saved in this browser (`tower.world.run`) that can be continued: its floor exists and it was not finished. */
export function savedClimb(): { floor: number; hero: string; clock: number } | null {
  const r = WorldRun.from(read(KEYS.run));
  return r && !r.result && FLOORS[r.floor] ? { floor: r.floor, hero: r.hero, clock: r.clock } : null;
}

export interface ClimbDeps {
  /** The game's own element helper. */
  el: (tag: string, attrs?: Record<string, unknown>, ...children: (Node | string | null | undefined)[]) => HTMLElement;
  /** The two big tabs and the hero picker. */
  tabs: HTMLElement;
  picker: HTMLElement;
  /** The hero's name. */
  hero: string;
  back(): void;
  /** The icon of the big button. */
  icon: HTMLElement;
  /** Why the climb cannot begin now (a queue, a lobby, a locked hero), or ''. */
  blocked: string;
  /** Begins a climb. */
  start(o: { hero: string; floor: number; resume: boolean }): void;
  /** Draws the screen again (a tile was picked). */
  redraw(): void;
}

/** The selected floor of the tiles (kept while the screen is redrawn). */
let picked = 0;

/** The Climb tab: the card with the tab bar and the floors, and the bar along the bottom. */
export function climbPanel(d: ClimbDeps): { section: HTMLElement; bar: HTMLElement } {
  const { el } = d;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.append(st);
  }
  // Every floor that exists at or below the floor reached is open (who reached 21 may play 1 to 21, and 12 to 20 once they are made).
  const reached = Math.min(nextFloor(), TOP_FLOOR);
  const saved = savedClimb();
  const stars = read<Record<string, number[]>>(KEYS.stars) ?? {}, times = read<Record<string, number>>(KEYS.times) ?? {};
  const open = (n: number) => !!FLOORS[n] && n <= reached;
  // The floor a Start begins: the one picked (if it is open), else the furthest one reached that exists.
  const floor = open(picked) ? picked : floorAtOrBelow(reached);
  const tileOf = (n: number) => {
    const def = FLOORS[n], locked = !!def && n > reached, got = stars[n];
    const state = !def ? 'soon' : locked ? 'locked' : got?.[0] ? 'done' : 'open';
    const tile = el('button', {
      class: `wc-t ${state}${isCrown(n) ? ' crown' : ''}${n === floor ? ' on' : ''}`, type: 'button', 'data-floor': String(n), 'aria-disabled': String(!open(n)),
      'aria-label': `Floor ${n}${isCrown(n) ? ', a crown' : ''}: ${!def ? 'still being made' : locked ? 'locked' : def.name}`,
      title: !def ? `Floor ${n}${isCrown(n) ? ' (a crown)' : ''}: still being made` : locked ? `Floor ${n}: clear floor ${floorAtOrBelow(n - 1)} first` : `Floor ${n}: ${def.name}`,
    });
    const sub = !def ? 'soon' : locked ? LOCK : got ? `<span class="st">${starsOf(got)}</span>` : 'new';
    tile.innerHTML = `${isCrown(n) ? CROWN : ''}<b>${n}</b><span>${sub}</span>`;
    if (open(n)) tile.addEventListener('click', () => { picked = n; d.redraw(); });
    return tile;
  };
  const chapters = CHAPTERS.map((c, i) => {
    const nums = Array.from({ length: 10 }, (_, k) => 10 * i + k + 1);
    const made = nums.filter((n) => FLOORS[n]).length;
    return el('div', { class: 'wc-ch', 'data-chapter': c.id },
      el('div', { class: 'wc-ch-h' }, el('span', { class: 'k' }, `Chapter ${ROMAN[i]}`), el('b', {}, c.name),
        el('span', { class: 'c' }, `Floors ${nums[0]}–${nums[9]} · ${made === 10 ? 'all ten made' : `${made} of 10 made`}`)),
      el('div', { class: 'wc-grid' }, ...nums.map(tileOf)));
  });
  const def = FLOORS[floor], t = times[floor], ch = chapterOf(floor);
  const pick = el('div', { class: 'wc-pick', 'data-picked': String(floor) });
  pick.innerHTML = `<span class="k">Floor ${floor} · Chapter ${ROMAN[ch]}, ${CHAPTERS[ch].name}${isCrown(floor) ? ' · the crown' : ''}</span>`
    + `<b>${def.name}</b><span class="law">${def.law.name}</span><span class="st">${starsOf(stars[floor])}</span>`
    + `<span class="tm">${t ? `best ${clock(t)}` : 'not cleared'}</span><p>${def.blurb}</p>`;
  const sig = sigils().map((id) => boonById(id)).filter(Boolean);
  const section = el('section', { class: 'card hs-roster', 'data-keep-scroll': 'climb' },
    d.tabs,
    el('div', { class: 'hs-roster-head' }, el('h2', {}, 'Climb'), el('span', { class: 'muted small' }, 'Fifty floors in five chapters, each a place to walk through')),
    el('p', { class: 'muted' }, 'Each floor is a whole place: people with work for you, packs to fell, secrets to find, a rule of the place (the tide, the dark), a ruler behind a door and a gate up. Every tenth floor is a crown: a great boss, alone. Clear a floor for up to four stars and keep one boon as a sigil for every later climb. A fall costs a life; three lives a floor. Your floor is saved when you leave. Packs fight together: watch for the red on the ground.'),
    pick,
    ...chapters,
    el('h3', { class: 'gap' }, 'Sigils kept'),
    sig.length
      ? el('div', { class: 'wc-sig' }, ...sig.map((b) => el('span', { title: b!.blurb }, b!.name)))
      : el('p', { class: 'muted small' }, 'None yet: clear a floor and choose one boon to keep.'),
    el('h3', { class: 'gap' }, 'Your hero'),
    d.picker,
  );
  const pickedFloor = floor;
  const go = (resume: boolean) => d.start(resume && saved ? { hero: saved.hero, floor: saved.floor, resume: true } : { hero: d.hero, floor: pickedFloor, resume: false });
  const off = !!d.blocked;
  const bar = el('div', { class: 'hs-bar' },
    el('div', { class: `hs-note small ${off ? 'error' : 'muted'}` }, off ? d.blocked
      : saved ? `A climb is saved: floor ${saved.floor} with ${saved.hero}, ${clock(saved.clock)} in.`
        : `${d.hero || 'A random hero'} climbs alone. Floors and stars are kept in this browser.`),
    el('button', { class: 'btn', onclick: d.back }, 'Back'),
    saved ? el('button', { class: 'btn', disabled: off, 'data-act': 'again', onclick: () => go(false) }, `Begin floor ${pickedFloor} again`) : null,
    el('button', { class: 'btn primary big hs-find', disabled: off, 'data-act': 'start', onclick: () => go(true) }, d.icon, saved ? `Continue floor ${saved.floor}` : `Start floor ${pickedFloor}`));
  return { section, bar };
}

/**
 * The climb on the game page: what `TowerRun` is to the weekly Tower. It owns the `WorldGame` (the page's own loop runs it), a Leave
 * button (the floor is saved as it goes, so leaving keeps it) and the way back to the Tower screen.
 */
export class WorldClimb {
  active = false;
  game: WorldGame | null = null;
  private leave: HTMLButtonElement;

  /** `presence`: the game page's link to the hub for the open world (src/net/world.ts); none, and every climb is alone. */
  constructor(private api: GameApi, private ui: { onEnter(): void; onExit(): void }, private presence: WorldPresence | null = null) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit raid-leave tower-leave world-leave';
    this.leave.textContent = 'Leave';
    this.leave.title = 'Your floor is saved: Continue picks it up again';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => this.exit());
    document.body.appendChild(this.leave);
  }

  /** Begins (or continues, `resume`) a floor of the climb with `hero`. */
  start(o: { hero: string; floor: number; resume: boolean }) {
    this.game?.stop();
    this.active = true;
    this.ui.onEnter();
    const view = (this.api as unknown as { view?: { paused: boolean } }).view;
    if (view) view.paused = false;
    const g = new WorldGame(this.api, { hero: o.hero, floor: o.floor, mode: 'play', persist: true, presence: this.presence });
    g.ui = { next: (n) => this.start({ hero: o.hero, floor: n, resume: false }), back: () => this.exit() };
    this.game = g;
    g.start({ resume: o.resume });
    this.leave.style.display = '';
    (window as unknown as { _worldGame?: WorldGame })._worldGame = g;
  }

  /** Back to the Tower screen. The run is saved as it stands (a floor cleared has already wiped its own). */
  exit() {
    const g = this.game;
    this.game = null;
    if (g) {
      if (!g.finished) g.save();
      g.stop();
    }
    if (this.api.duel.on) this.api.duel.stop();
    this.leave.style.display = 'none';
    this.active = false;
    this.ui.onExit();
  }
}
