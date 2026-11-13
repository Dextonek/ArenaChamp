import type { GameApi } from '../../runtime';
import { boonById } from '../boons';
import { FLOORS } from './floors';
import { WorldGame } from './game';
import { KEYS, WorldRun, nextFloor, read, sigils } from './state';

/**
 * The Tower screen's "Climb" tab (the floors as worlds, pipeline/designs/tower-worlds.md) and the controller that runs a climb on the game
 * page. The game's menu (`src/game/main.ts`) draws the tab bar, the hero showcase and the hero picker and hands them in; the rest of
 * the screen is here: a tile per floor (name, law, stars, best time, locked until reached), the sigils kept, and Start / Continue /
 * Begin again. Plain DOM with its own styles, so the game's stylesheet does not change. Nothing here writes the weekly Tower's keys
 * (`tower.save`, `tower.best`) or its board: the climb has its own, `tower.world.*` (state.ts).
 */

/** The floors the design has: the tiles show this many, those not yet built say so. */
const FLOORS_SHOWN = 5;
const STYLE_ID = 'world-menu-style';
const CSS = `
.wc-floors{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0 12px}
.wc-tile{position:relative;display:flex;flex-direction:column;gap:2px;text-align:left;padding:9px 10px 8px;border-radius:10px;border:1px solid var(--line,#3a3242);background:rgba(8,6,10,.5);color:inherit;font:inherit;cursor:pointer;min-width:0;min-height:44px}
.wc-tile b{font:700 15px var(--display,ui-serif,Georgia,serif);color:var(--text,#e9dcc6)}
.wc-tile .n{font:700 10px ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#a89870)}
.wc-tile .law{font-size:11px;color:#8cc4ff}
.wc-tile .st{font-size:15px;letter-spacing:2px;color:var(--gold-hi,#ffd27a)}
.wc-tile .st .off{color:#4a4032}
.wc-tile .tm{font-size:11px;color:var(--muted,#a89870)}
.wc-tile.on{border-color:var(--gold-hi,#ffd27a);background:rgba(60,46,20,.55)}
.wc-tile.locked{opacity:.5;cursor:default}
.wc-sig{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}
.wc-sig span{padding:3px 9px;border-radius:999px;border:1px solid var(--line-gold,#6a5a3a);font-size:12px;font-weight:600;color:var(--gold-hi,#ffd27a)}
`;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
  const reached = Math.min(nextFloor(), FLOORS_SHOWN);
  const saved = savedClimb();
  const stars = read<Record<string, number[]>>(KEYS.stars) ?? {}, times = read<Record<string, number>>(KEYS.times) ?? {};
  const built = (n: number) => !!FLOORS[n];
  // The floor a Start begins: the one picked (if it is open), else the furthest one reached that exists.
  let floor = picked && built(picked) && picked <= reached ? picked : Math.min(reached, Math.max(...Object.keys(FLOORS).map(Number)));
  if (!built(floor)) floor = 1;
  const tiles = Array.from({ length: FLOORS_SHOWN }, (_, i) => i + 1).map((n) => {
    const def = FLOORS[n], locked = n > reached, got = stars[n], t = times[n];
    const star = got ? got.map((g) => (g ? '★' : '<span class="off">☆</span>')).join('') : '';
    const tile = el('button', {
      class: `wc-tile${n === floor ? ' on' : ''}${locked || !def ? ' locked' : ''}`, type: 'button', 'data-floor': String(n), 'aria-disabled': String(locked || !def),
      title: !def ? `Floor ${n}: still being built` : locked ? `Floor ${n}: clear floor ${n - 1} first` : `Floor ${n}: ${def.name}`,
    });
    tile.innerHTML = def
      ? `<span class="n">Floor ${n}${locked ? ' · locked' : ''}</span><b>${def.name}</b><span class="law">${def.law.name}</span><span class="st">${star || (locked ? '' : '<span class="off">☆☆☆☆</span>')}</span><span class="tm">${t ? `best ${clock(t)}` : locked ? 'not reached' : 'not cleared'}</span>`
      : `<span class="n">Floor ${n} · locked</span><b>Still being built</b><span class="tm">Not reached</span>`;
    if (def && !locked) tile.addEventListener('click', () => { picked = n; d.redraw(); });
    return tile;
  });
  const sig = sigils().map((id) => boonById(id)).filter(Boolean);
  const section = el('section', { class: 'card hs-roster', 'data-keep-scroll': 'climb' },
    d.tabs,
    el('div', { class: 'hs-roster-head' }, el('h2', {}, 'Climb'), el('span', { class: 'muted small' }, 'Five floors, each a place to walk through')),
    el('p', { class: 'muted' }, 'Each floor is a whole place: people with work for you, packs to fell, secrets to find, a rule of the place (the tide, the dark), a ruler behind a door and a gate up. Clear it for up to four stars and keep one boon as a sigil for every later climb. A fall costs a life; three lives a floor. Your floor is saved when you leave.'),
    el('div', { class: 'wc-floors' }, ...tiles),
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

  constructor(private api: GameApi, private ui: { onEnter(): void; onExit(): void }) {
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
    const g = new WorldGame(this.api, { hero: o.hero, floor: o.floor, mode: 'play', persist: true });
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
