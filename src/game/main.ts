/**
 * game.html: the duel game. Main menu, login, profile, heroes overview, lobbies and matchmaking over the game
 * server (server/game-server.mjs), and network 1v1 matches in the duel ring (src/game/match.ts). The 3D scene is the
 * shared runtime (src/runtime.ts) with only the spell effects; none of the VFX tool (src/tool/) is in this page.
 * Architecture: docs/architecture/multiplayer.md.
 */
import './game.css';
import { createRuntime, type GameApi } from '../runtime';
import { targetedModules } from '../spells/targeted';
import type { HeroKit } from '../heroes';
import { NetClient, type LobbyState, type Profile } from '../net/client';
import { HeroPreview } from './heroPreview';
import { LoadingScreen } from './loading';
import { traitFor } from '../traits';
import { MatchController, type PickOffer } from './match';
import { ARENAS } from '../arenas';
import { CpuMatch } from './cpu';
import { CPU_LEVELS, cpuLevel } from '../cpuLevels';
import { TOUCH } from '../touch';
import { RaidController } from '../raid/coop';
import { RaidRun, scoreText } from '../raid/run';
import { SUN_WARDEN } from '../raid/sunWarden';
import { LIVES, TowerRun, towerBest, towerSaved } from '../tower/run';
import { KIND_NAME, TWISTS, isoWeek, towerFor, untilNext, weekBefore } from '../tower/week';
import { heightName } from '../arenas/tower';
import { CHANGELOG, type NewsItem, type Release } from './changelog';

type Screen = 'login' | 'menu' | 'heroes' | 'profile' | 'lobbies' | 'lobby' | 'cpu' | 'raid' | 'tower' | 'news';

// The scene keeps stepping in a hidden tab: a network duel must go on.
// The console hook `game.api` (at the end of this file) is this runtime.
const gameApi: GameApi = createRuntime({ modules: targetedModules, background: true });

const kits = gameApi.kits;
const net = new NetClient();
const state = {
  screen: 'login' as Screen,
  connected: false,
  profile: null as Profile | null,
  lobbies: [] as { code: string; host: string; hostHero: string | null }[],
  /** Open raids anyone can join (pipeline/designs/raid-party.md). */
  raids: [] as { code: string; host: string; count: number; raid: string }[],
  lobby: null as LobbyState | null,
  lobbySeat: 0,
  queue: { on: false, since: 0, size: 0 },
  /** The hero the queue was joined with (a random pick is drawn then). */
  queueHero: '',
  /** The open row of the heroes table ('' when none). */
  heroView: '',
  authError: '',
  authMode: 'login' as 'login' | 'register',
  /** This page is older than the server's rules: what to tell the player. */
  outdated: '',
};

// --- DOM helpers ---------------------------------------------------------------------------------------------

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (k === 'style') e.style.cssText = String(v);
    else if (k in e && typeof v !== 'string') (e as unknown as Record<string, unknown>)[k] = v;
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function canvasOf(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, cls: string) {
  const c = el('canvas', { class: cls });
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}

/** Heroes renamed since an account last saved its choice or its match history. */
const OLD_NAMES: Record<string, string> = { Vex: 'Vitriol' };
const kitOf = (name: string | null | undefined) => {
  const now = name ? OLD_NAMES[name] ?? name : name;
  return kits.find((k) => k.name === now);
};
const portrait = (kit: HeroKit, cls = 'portrait') => {
  const c = canvasOf(128, kit.portrait, cls);
  c.style.borderColor = kit.foil;
  return c;
};

// --- line icons ----------------------------------------------------------------------------------------------

/** Small line icons (24 x 24, drawn in the text colour) for the tabs, the login's two doors and the empty states. */
const ICONS = {
  play: '<path d="M8 16L20 4M20 4v4M20 4h-4M6 14l4 4M8 16l-4 4M16 16L4 4M4 4v4M4 4h4M18 14l-4 4M16 16l4 4"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  raid: '<path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.5.2 2 1 3 2 3 .3-3-1-5.5 1-9z"/>',
  tower: '<path d="M7 21V9l-1.5-2V3.5h2.6V5h2.3V3.5h2.6V5h2.3V3.5H17V7l-1.5 2v12M4.5 21h15M10.2 21v-4a1.8 1.8 0 0 1 3.6 0v4M10.5 11.5h3"/>',
  lobbies: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.1c2.6.4 4.5 2.8 4.5 5.9"/>',
  heroes: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M12 8v8M9 11h6"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  login: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l4 4-4 4M14 12H4"/>',
  news: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 12h7M8.5 16h7"/>',
} as const;
function icon(name: keyof typeof ICONS) {
  const s = el('span', { class: 'ic', 'aria-hidden': 'true' });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return s;
}

// --- random pick ---------------------------------------------------------------------------------------------

/** The picker's choice that stands for "any hero": it becomes a real hero when the match or fight starts. */
const RANDOM = 'random';
const randomKit = (except: (string | null | undefined)[] = []) => {
  const open = kits.filter((k) => !except.includes(k.name));
  return open[Math.floor(Math.random() * open.length)] ?? kits[0];
};

/** The Random tile's icon: a gold question mark inside a ring of one dot per hero, in each hero's colour. */
function randomPortrait(cls: string) {
  const c = canvasOf(128, (g, s) => {
    const m = s / 2;
    const bg = g.createRadialGradient(m, m * 0.8, s * 0.05, m, m, m);
    bg.addColorStop(0, '#3a2a58');
    bg.addColorStop(1, '#0d0a16');
    g.fillStyle = bg;
    g.fillRect(0, 0, s, s);
    kits.forEach((k, i) => {
      const a = (i / kits.length) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = k.accent;
      g.beginPath();
      g.arc(m + Math.cos(a) * s * 0.4, m + Math.sin(a) * s * 0.4, s * 0.032, 0, Math.PI * 2);
      g.fill();
    });
    const gold = g.createLinearGradient(0, s * 0.2, 0, s * 0.8);
    gold.addColorStop(0, '#ffe7a8');
    gold.addColorStop(1, '#c9902e');
    g.font = `700 ${s * 0.56}px ui-serif, Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = s * 0.04;
    g.strokeStyle = '#1a1206';
    g.strokeText('?', m, m + s * 0.02);
    g.fillStyle = gold;
    g.fillText('?', m, m + s * 0.02);
  }, cls);
  c.style.borderColor = '#c9a24a';
  return c;
}

// --- preferred hero (per account, this browser) ------------------------------------------------------------

/** The account's choice: a hero's name, or `RANDOM`. */
function heroChoice() {
  if (!state.profile) return RANDOM;
  return safeGet(`duel.hero.${state.profile.name}`) === RANDOM ? RANDOM : preferredHero().name;
}
function preferredHero(): HeroKit {
  const name = state.profile ? safeGet(`duel.hero.${state.profile.name}`) : null;
  return kitOf(name) ?? kitOf(state.profile?.favourite) ?? kits[0];
}
function setPreferredHero(name: string) {
  if (state.profile) safeSet(`duel.hero.${state.profile.name}`, name);
}
function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

// --- shell ---------------------------------------------------------------------------------------------------

const root = el('div', { class: 'ui' });
const toastEl = el('div', { class: 'toast' });
document.body.append(root, toastEl);
const preview = new HeroPreview();
let toastTimer = 0;

function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2600);
}

function go(screen: Screen) {
  state.screen = screen;
  if (screen === 'lobbies') net.send({ t: 'lobbies' });
  if (screen === 'profile') net.send({ t: 'profile' });
  render();
}

/** A new screen starts at its top; a re-render of the same one (a hero picked) stays where it was. */
let shownScreen: Screen | null = null;

function render() {
  // A pane that scrolls inside itself (the Play screen's roster) keeps its place when the same screen is drawn again.
  const kept = new Map<string, number>();
  if (state.screen === shownScreen) root.querySelectorAll<HTMLElement>('[data-keep-scroll]').forEach((e) => kept.set(e.dataset.keepScroll!, e.scrollTop));
  root.replaceChildren();
  // With an account the CPU duel is a mode of the Play screen (a finished CPU fight comes back here as 'cpu').
  if (state.profile && state.screen === 'cpu') {
    state.screen = 'menu';
    playMode = 'cpu';
    safeSet('play.mode', 'cpu');
  }
  // A screen that was not on show a moment ago comes in with a short rise (`.screen.enter`); a redraw does not.
  const fresh = state.screen !== shownScreen;
  if (fresh) {
    shownScreen = state.screen;
    root.scrollTop = 0;
  }
  if (match.active || cpu.active || raid.active || coop.active || tower.active) { root.style.display = 'none'; shownScreen = null; return; }
  root.style.display = '';
  const keepScroll = () => root.querySelectorAll<HTMLElement>('[data-keep-scroll]').forEach((e) => { const top = kept.get(e.dataset.keepScroll!); if (top) e.scrollTop = top; });
  // Without an account: the login screen, or the CPU, Raid or Tower screen (an offline fight needs no account).
  if (!state.profile) {
    if (state.screen !== 'cpu' && state.screen !== 'raid' && state.screen !== 'tower' && state.screen !== 'news') { root.append(loginScreen()); return; }
    root.append(header(), state.screen === 'news'
      ? el('main', { class: `screen${fresh ? ' enter' : ''}` }, newsScreen())
      : el('main', { class: `screen wide${fresh ? ' enter' : ''}` }, state.screen === 'cpu' ? menuScreen() : state.screen === 'tower' ? towerScreen() : raidScreen()));
    keepScroll();
    return;
  }
  root.append(header());
  const s = state.screen;
  const body = el('main', { class: `screen${fresh ? ' enter' : ''}` });
  body.append(
    s === 'heroes' ? heroesScreen()
      : s === 'profile' ? profileScreen(state.profile)
        : s === 'lobbies' ? lobbiesScreen()
          : s === 'lobby' && state.lobby ? lobbyScreen(state.lobby)
            : s === 'raid' ? raidScreen()
              : s === 'tower' ? towerScreen()
                : s === 'news' ? newsScreen()
                  : menuScreen(),
  );
  root.append(body);
  // The Play screen (also shown for a lobby that has closed) is wider, and shows the search in its own bar.
  const play = !!body.querySelector(':scope > .hs');
  body.classList.toggle('wide', play);
  if (state.queue.on && !play) root.append(queueBar());
  keepScroll();
  if (scrollToHero) {
    scrollToHero = false;
    // Just under the header, which wraps to three lines on a phone.
    const row = root.querySelector<HTMLElement>('.hero-row.on');
    const head = root.querySelector<HTMLElement>('header.top');
    if (row) root.scrollTop += row.getBoundingClientRect().top - (head?.offsetHeight ?? 0) - 8;
  }
}

/** Set by the Play screen's "full kit" link: the Heroes screen opens scrolled to that hero's row. */
let scrollToHero = false;

/** The bar along the top (on a phone its tabs sit along the bottom). Without an account: the two offline screens and a way to log in. */
function header() {
  const p = state.profile;
  const nav = (label: string, screen: Screen, ic: keyof typeof ICONS) =>
    el('button', { class: `nav${state.screen === screen ? ' on' : ''}`, onclick: () => go(screen) }, icon(ic), el('span', {}, label));
  if (!p) {
    return el('header', { class: 'top' },
      el('div', { class: 'brand', onclick: () => go('login') }, el('span', { class: 'sigil' }, '⚔'), 'Arena of Kits'),
      el('nav', {}, nav('Play', 'cpu', 'play'), nav('Raid', 'raid', 'raid'), nav('Tower', 'tower', 'tower'), nav('News', 'news', 'news')),
      el('div', { class: 'who' }, el('button', { class: 'btn small', onclick: () => go('login') }, icon('login'), 'Log in')));
  }
  return el('header', { class: 'top' },
    el('div', { class: 'brand', onclick: () => go('menu') }, el('span', { class: 'sigil' }, '⚔'), 'Arena of Kits'),
    el('nav', {}, nav('Play', 'menu', 'play'), nav('Raid', 'raid', 'raid'), nav('Tower', 'tower', 'tower'), nav('Lobbies', state.lobby ? 'lobby' : 'lobbies', 'lobbies'), nav('Heroes', 'heroes', 'heroes'), nav('Profile', 'profile', 'profile'), nav('News', 'news', 'news')),
    el('div', { class: 'who' },
      el('span', { class: `dot${state.connected ? ' on' : ''}`, title: state.connected ? 'connected' : 'offline' }),
      el('b', {}, p.name),
      el('span', { class: 'muted' }, `${p.wins} W · ${p.losses} L`),
      el('button', { class: 'btn ghost small', onclick: () => net.send({ t: 'logout' }) }, 'Log out'),
    ),
  );
}

// --- login ---------------------------------------------------------------------------------------------------

function loginScreen() {
  const name = el('input', { placeholder: 'name', autocomplete: 'username', maxlength: 16 }) as HTMLInputElement;
  const pass = el('input', { placeholder: 'password', type: 'password', autocomplete: state.authMode === 'login' ? 'current-password' : 'new-password', maxlength: 64 }) as HTMLInputElement;
  const submit = (e: Event) => {
    e.preventDefault();
    state.authError = '';
    net.send({ t: state.authMode, name: name.value.trim(), password: pass.value });
  };
  const tab = (mode: 'login' | 'register', label: string) =>
    el('button', { type: 'button', class: `tab${state.authMode === mode ? ' on' : ''}`, onclick: () => { state.authMode = mode; state.authError = ''; render(); } }, label);
  const form = el('form', { class: 'card login', onsubmit: submit },
    el('div', { class: 'title' }, el('span', { class: 'sigil big' }, '⚔'), el('h1', {}, 'Arena of Kits'), el('p', { class: 'muted' }, TOUCH ? '1v1 hero duels · stick to move · drag a spell to aim' : '1v1 hero duels · click to move · Q W E R to cast')),
    // The quickest way in comes first: three ways to play that need no account.
    el('div', { class: 'guest three' },
      el('button', { class: 'door', type: 'button', onclick: () => go('cpu') }, icon('play'), el('b', {}, 'Duel the CPU'), el('span', { class: 'muted' }, 'Play now · no account')),
      el('button', { class: 'door', type: 'button', onclick: () => go('raid') }, icon('raid'), el('b', {}, 'Raid the bosses'), el('span', { class: 'muted' }, 'Play now · no account')),
      el('button', { class: 'door', type: 'button', onclick: () => go('tower') }, icon('tower'), el('b', {}, 'Climb the Tower'), el('span', { class: 'muted' }, 'Play now · no account'))),
    el('div', { class: 'or' }, 'or play online'),
    el('div', { class: 'tabs' }, tab('login', 'Log in'), tab('register', 'Create account')),
    name, pass,
    el('button', { class: 'btn primary', type: 'submit', disabled: !state.connected }, state.authMode === 'login' ? 'Log in' : 'Create account'),
    el('div', { class: 'error' }, state.outdated || (state.connected ? state.authError : 'Connecting to the game server…')),
    el('p', { class: 'fine' }, 'Your name and record are kept on the game server. Passwords are stored hashed.'),
    el('button', { class: 'hs-more news-link', type: 'button', onclick: () => go('news') }, `What's new: ${CHANGELOG[0].title} →`),
  );
  // A keyboard on a desktop goes straight to the name; a phone keeps its keyboard down until the field is tapped.
  if (!TOUCH) setTimeout(() => name.focus());
  return el('div', { class: 'center login-screen' }, form, heroStrip());
}

/** The roster as a strip of portraits (login backdrop). */
function heroStrip() {
  // The roster twice, end to end: the track slides half its own width and starts over without a seam.
  const row = () => kits.map((k) => { const c = portrait(k, 'portrait sm'); c.title = `${k.name}, ${k.title}`; return c; });
  return el('div', { class: 'strip' }, el('div', { class: 'strip-track' }, ...row(), ...row()));
}

// --- menu / play ---------------------------------------------------------------------------------------------

/** The Play screen's two ways to fight: a match against a player, or an offline duel against the computer. */
type PlayMode = 'online' | 'cpu';
let playMode: PlayMode = safeGet('play.mode') === 'cpu' ? 'cpu' : 'online';

/**
 * Play: a hero select. The chosen hero on the left (its turning model, HP, melee or ranged, the passive and Q W E R),
 * the choices on the right, and one bar along the bottom with the button that starts the fight (user, 2026-11-09:
 * "can u remade this so it will be better"). Two modes share it, picked by the two big tabs over the roster: an online
 * match, or a duel against the CPU with its level and opponent (user, 2026-11-10: "lets move the cpu page into play").
 * Without an account only the CPU duel is open, and the online tab leads to the login.
 */
function menuScreen() {
  const guest = !state.profile;
  // A search or a lobby would take the scene over: while one is on, the online side is the one in use.
  const busy = state.queue.on || !!state.lobby;
  const mode: PlayMode = guest ? 'cpu' : busy ? 'online' : playMode;
  const choice = cpuChoice(), hero = kitOf(choice);
  preview.show(hero?.model, hero);
  const tab = (m: PlayMode, ic: keyof typeof ICONS, title: string, sub: string) => el('button', {
    class: `mode${mode === m ? ' on' : ''}`, disabled: m === 'cpu' && busy, title: m === 'cpu' && busy ? 'Leave the queue or your lobby first' : '',
    onclick: () => {
      if (m === 'online' && guest) return go('login');
      if (m === mode) return;
      playMode = m;
      safeSet('play.mode', m);
      render();
    },
  }, icon(ic), el('span', {}, el('b', {}, title), el('small', {}, sub)));
  return el('div', { class: 'hs' },
    heroShowcase(hero),
    el('section', { class: 'card hs-roster', 'data-keep-scroll': 'roster' },
      el('div', { class: 'modes' },
        tab('online', 'play', 'Online match', guest ? 'Log in to fight a real player' : 'Against the next player in the queue'),
        tab('cpu', 'cpu', 'CPU duel', 'Offline practice, five levels')),
      mode === 'cpu' ? cpuOptions(choice) : null,
      el('div', { class: 'hs-roster-head' }, el('h2', {}, 'Choose your hero'), el('span', { class: 'muted small' }, `${kits.length} heroes`)),
      heroPicker(choice, [], (n) => { setCpuHero(n); render(); }),
      howToFight(),
    ),
    mode === 'cpu' ? cpuBar(hero, choice) : playBar(hero),
  );
}

/** The showcase's open slot: 0 the passive, 1-4 Q W E R. It stays on the same slot from hero to hero, to compare them. */
let shownSlot = 0;

/** The Play screen's chosen hero: the turning model (the big portrait when there is none), then the kit. */
function heroShowcase(hero: HeroKit | undefined) {
  const card = el('section', { class: 'card hs-show' });
  card.style.setProperty('--accent', hero?.accent ?? '#c9a24a');
  const stage = el('div', { class: 'hs-stage' },
    hero?.model ? preview.canvas : hero ? portrait(hero, 'portrait hs-big') : randomPortrait('portrait hs-big'));
  if (!hero) {
    card.append(stage, el('div', { class: 'hs-info' },
      el('div', { class: 'hs-name' }, 'Random hero'),
      el('div', { class: 'hs-title' }, `One of the ${kits.length} heroes, drawn when the fight starts`)));
    return card;
  }
  const passive = traitFor(hero.name)?.passive;
  const slots = [
    { key: 'P', name: passive?.name ?? 'Passive', blurb: passive?.blurb ?? '', meta: 'Passive', ult: false, icon: portrait(hero, 'icon') },
    ...hero.spells.map((s) => ({
      key: s.key, name: s.name, blurb: s.blurb, ult: s.key === 'R', icon: canvasOf(96, s.icon, 'icon'),
      meta: `${s.range > 0 ? `range ${s.range}` : 'self'} · cooldown ${s.cooldown} s`,
    })),
  ];
  // On a phone the text is cut to three lines: a tap on it shows the rest.
  const detail = el('div', { class: 'hs-detail', onclick: () => detail.classList.toggle('full') });
  const paint = (i: number) => {
    const s = slots[i];
    detail.replaceChildren(
      el('div', { class: 'hs-detail-head' },
        el('span', { class: 'hs-key' }, s.key), el('b', {}, s.name), s.ult ? el('span', { class: 'ult-tag' }, 'ULT') : null,
        el('span', { class: 'muted small' }, s.meta)),
      el('div', { class: 'blurb' }, s.blurb));
    buttons.forEach((b, j) => b.classList.toggle('on', j === i));
  };
  // A mouse shows a slot while it points at it; a click or a tap keeps it open.
  const buttons = slots.map((s, i) => el('button', {
    class: `hs-ab${s.ult ? ' ult' : ''}`, title: s.name, 'aria-label': `${s.key}: ${s.name}`,
    onmouseenter: () => paint(i), onmouseleave: () => paint(shownSlot),
    onclick: () => { shownSlot = i; paint(i); },
  }, s.icon, el('span', { class: 'key' }, s.key)));
  paint(shownSlot);
  // Pim and Pom: one half fights up close, the other from range.
  const reach = hero.alt && !!hero.alt.melee !== !!hero.melee ? 'Melee and ranged' : hero.melee ? 'Melee' : 'Ranged';
  card.append(stage,
    el('div', { class: 'hs-info' },
      el('div', { class: 'hs-name' }, hero.name),
      el('div', { class: 'hs-title' }, hero.title),
      el('div', { class: 'hs-chips' }, el('span', { class: 'chip' }, `${hero.maxHp ?? 600} HP`), el('span', { class: 'chip' }, reach))),
    el('div', { class: 'hs-abilities' }, ...buttons),
    detail,
    el('button', { class: 'hs-more', onclick: () => { state.heroView = hero.name; scrollToHero = true; go('heroes'); } }, `${hero.name}'s full kit →`));
  return card;
}

/** Along the bottom of the Play screen in its online mode: Lobbies and Find match, or the search while queued. */
function playBar(hero: HeroKit | undefined) {
  const queued = state.queue.on;
  const find = queued
    ? el('div', { class: 'hs-search' },
      el('span', { class: 'spinner' }), el('span', { class: 'qtext' }, ''),
      el('button', { class: 'btn small', onclick: () => net.send({ t: 'queue_leave' }) }, 'Cancel'))
    : el('button', {
      class: 'btn primary big hs-find', disabled: !!state.lobby,
      onclick: () => {
        const name = hero?.name ?? randomKit().name;
        state.queueHero = name;
        if (!hero) toast(`Random pick: ${name}`);
        net.send({ t: 'queue_join', hero: name });
      },
    }, hero ? `Find match as ${hero.name}` : 'Find match as a random hero');
  const bar = el('div', { class: 'hs-bar' },
    el('div', { class: 'hs-note muted small' }, state.lobby
      ? 'You are in a lobby: go back to it, or leave it to search.'
      : 'Find match pairs you with the next player in the queue who picked a different hero. Or open a lobby and share its code.'),
    el('button', { class: 'btn', disabled: queued, onclick: () => go(state.lobby ? 'lobby' : 'lobbies') }, state.lobby ? 'Back to lobby' : 'Lobbies'),
    find);
  if (queued) updateQueueText(bar);
  return bar;
}

/** Whether "How to fight" is open: it stays as it was when a hero is picked. */
let howOpen = false;

function howToFight() {
  const how = TOUCH ? el('ul', { class: 'how' },
    el('li', {}, 'The ', el('b', {}, 'stick'), ' on the left walks; tap the ground to walk there, tap the enemy to attack.'),
    el('li', {}, el('b', {}, 'Tap a spell'), ' to cast it at the enemy, or ', el('b', {}, 'drag'), ' it to aim and let go to cast. The big gold one is the ultimate.'),
    el('li', {}, 'Drag back onto the spell to cancel. The ', el('b', {}, '⚔'), ' button attacks; pinch to zoom.'),
    el('li', {}, 'Red zones show where a spell lands: walk out before it hits to ', el('b', {}, 'dodge'), '.'),
    el('li', {}, 'Last one standing wins the round. Each hero\'s HP is on its card.'),
    el('li', {}, 'Best of three: the first to win two rounds takes the match.'),
  ) : el('ul', { class: 'how' },
    el('li', {}, el('b', {}, 'Right click'), ' the ground to walk (hold to keep walking), or an enemy to attack it.'),
    el('li', {}, el('b', {}, 'A then click'), ' attack-moves: it hits the enemy you click near, or walks there and attacks whoever comes in range. ', el('b', {}, 'S'), ' stops.'),
    el('li', {}, el('b', {}, 'Q W E R'), ' aim a spell, click to cast. R is the ultimate.'),
    el('li', {}, el('b', {}, 'Right click / Esc'), ' cancels the aim.'),
    el('li', {}, 'Red zones show where a spell lands: walk out before it hits to ', el('b', {}, 'dodge'), '.'),
    el('li', {}, 'Last one standing wins the round. Each hero\'s HP is on its card.'),
    el('li', {}, 'Best of three: the first to win two rounds takes the match.'),
  );
  const d = el('details', { class: 'hs-how' }, el('summary', {}, 'How to fight'), how);
  d.open = howOpen;
  d.addEventListener('toggle', () => { howOpen = d.open; });
  return d;
}

/** The hero grid. Random comes first; `pick` gets `RANDOM` for it. */
function heroPicker(selected: string, taken: string[], pick: (name: string) => void) {
  const random = el('button', {
    class: `pick${selected === RANDOM ? ' on' : ''}`, title: 'A random hero', onclick: () => pick(RANDOM),
  }, randomPortrait('portrait sm'), el('span', {}, 'Random'));
  random.style.setProperty('--accent', '#c9a24a');
  return el('div', { class: 'picker' }, random, ...kits.map((k, i) => {
    const off = taken.includes(k.name);
    const b = el('button', {
      class: `pick${k.name === selected ? ' on' : ''}`, disabled: off, title: off ? `${k.name} is taken` : `${k.name}, ${k.title}`,
      onclick: () => pick(k.name),
    }, portrait(k, 'portrait sm'), el('span', {}, k.name));
    b.style.setProperty('--accent', k.accent);
    // its place in the deal when the screen opens (game.css, tile-in)
    b.style.setProperty('--i', String(i + 1));
    return b;
  }));
}

// --- a round's loser picks ---------------------------------------------------------------------------------

let pickPanel: HTMLElement | null = null;
let pickClock = 0;

function hidePick() {
  clearInterval(pickClock);
  pickPanel?.remove();
  pickPanel = null;
}

/** Over the frozen fight (the menu's root is hidden during a match). One tap decides: the time is short. */
function showPick(o: PickOffer) {
  hidePick();
  const until = Date.now() + o.seconds * 1000;
  const clock = el('b', { class: 'pick-clock' }, String(o.seconds));
  pickClock = window.setInterval(() => { clock.textContent = String(Math.max(0, Math.ceil((until - Date.now()) / 1000))); }, 250);
  const choose = (c: { hero?: string; arena?: string }) => { hidePick(); o.choose(c); };
  pickPanel = el('div', { class: 'ui pick-panel' },
    el('section', { class: 'card pick-card' },
      el('div', { class: 'pick-head' }, el('h2', {}, 'You lost the round: your pick'), clock),
      el('p', { class: 'muted' }, `Against ${o.foeHero}. Choose one, or the next round starts as it is.`),
      el('button', { class: 'btn primary pick-keep', onclick: () => choose({}) }, `Keep ${o.myHero} and ${o.nextArena.name}`),
      el('h3', { class: 'gap' }, 'Choose the next arena'),
      el('div', { class: 'arena-row' }, ...ARENAS.filter((a) => a !== o.nextArena).map((a) => el('button', { class: 'btn', onclick: () => choose({ arena: a.id }) }, a.name))),
      el('h3', { class: 'gap' }, 'Or swap hero'),
      heroPicker(o.myHero, [o.foeHero], (n) => {
        if (n === o.myHero) return choose({});
        choose({ hero: n === RANDOM ? randomKit([o.myHero, o.foeHero]).name : n });
      }),
    ));
  document.body.append(pickPanel);
}

function queueBar() {
  const bar = el('div', { class: 'queue-bar' },
    el('span', { class: 'spinner' }),
    el('span', { class: 'qtext' }, ''),
    el('button', { class: 'btn small', onclick: () => net.send({ t: 'queue_leave' }) }, 'Cancel'),
  );
  updateQueueText(bar);
  return bar;
}
/** The search text, in the queue bar or the Play screen's own bar. */
function updateQueueText(scope: ParentNode = root) {
  const t = scope.querySelector('.qtext');
  if (!t) return;
  const s = Math.max(0, Math.floor((Date.now() - state.queue.since) / 1000));
  t.textContent = `Searching as ${state.queueHero || preferredHero().name} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${state.queue.size} in queue`;
}
setInterval(() => state.queue.on && updateQueueText(), 500);

// --- play vs CPU ---------------------------------------------------------------------------------------------

// The CPU screen's choices, kept in this browser: an offline fight needs no account.
const cpuPick = { level: cpuLevel(Number(safeGet('cpu.level'))).id, foe: safeGet('cpu.foe') ?? 'random' };
const cpuWonKey = () => `cpu.won.${state.profile?.name ?? 'guest'}`;
/** The CPU levels beaten so far (with any hero), as level ids. */
const cpuWon = () => new Set((safeGet(cpuWonKey()) ?? '').split('').map(Number).filter((n) => n > 0));

/** The choice for a CPU fight: the account's, or this browser's last pick without an account (a name or `RANDOM`). */
function cpuChoice() {
  if (state.profile) return heroChoice();
  const saved = safeGet('cpu.hero');
  return saved === RANDOM ? RANDOM : (kitOf(saved) ?? kits[0]).name;
}
function setCpuHero(name: string) {
  if (state.profile) setPreferredHero(name);
  else safeSet('cpu.hero', name);
}

/** The opponent picked for a CPU duel, or undefined for a random one (also when it is the player's own hero). */
const cpuFoe = (choice: string) => (cpuPick.foe !== choice ? kitOf(cpuPick.foe) : undefined);

/** The Play screen's CPU mode, over the roster: the five levels and the opponent. */
function cpuOptions(choice: string) {
  const level = cpuLevel(cpuPick.level);
  const foeKit = cpuFoe(choice);
  const won = cpuWon();
  const levels = el('div', { class: 'levels' }, ...CPU_LEVELS.map((l) => el('button', {
    class: `level lv-${l.id}${l.id === level.id ? ' on' : ''}`, title: l.blurb,
    onclick: () => { cpuPick.level = l.id; safeSet('cpu.level', String(l.id)); render(); },
  }, el('span', { class: 'pips' }, '◆'.repeat(l.id)), el('b', {}, l.name, won.has(l.id) ? el('span', { class: 'won', title: 'beaten' }, '✓') : null))));
  const foeSelect = el('select', {
    class: 'foe-select',
    onchange: (e: Event) => { cpuPick.foe = (e.target as HTMLSelectElement).value; safeSet('cpu.foe', cpuPick.foe); render(); },
  },
  el('option', { value: 'random', selected: !foeKit }, 'A random hero'),
  ...kits.filter((k) => k.name !== choice).map((k) => el('option', { value: k.name, selected: k === foeKit }, `${k.name}, ${k.title}`)));
  return el('div', { class: 'cpu-opts' },
    el('div', {},
      el('h3', {}, 'Difficulty'),
      levels,
      el('p', { class: 'level-blurb muted small' }, el('b', {}, `${level.name}: `), level.blurb)),
    el('div', {},
      el('h3', {}, 'Opponent'),
      el('div', { class: 'foe-row' }, foeKit ? portrait(foeKit, 'portrait sm') : randomPortrait('portrait sm'), foeSelect),
      el('p', { class: 'level-blurb muted small' }, 'One round in a random arena. It does not count on your record.')));
}

/** Along the bottom of the Play screen in its CPU mode: the fight button (and the way to the login without an account). */
function cpuBar(hero: HeroKit | undefined, choice: string) {
  const level = cpuLevel(cpuPick.level);
  const foeKit = cpuFoe(choice);
  return el('div', { class: 'hs-bar' },
    el('div', { class: 'hs-note small muted' }, `${hero ? hero.name : 'A random hero'} against ${foeKit ? foeKit.name : 'a random hero'} on ${level.name}.`),
    state.profile ? null : el('button', { class: 'btn', onclick: () => go('login') }, icon('login'), 'Log in'),
    el('button', {
      class: 'btn primary big hs-find',
      onclick: () => void cpu.start({ hero: hero?.name ?? randomKit([foeKit?.name]).name, foe: foeKit?.name ?? 'random', level: level.id }),
    }, `Fight ${foeKit ? foeKit.name : 'a random hero'} · ${level.name}`));
}

// --- raid ----------------------------------------------------------------------------------------------------

/** What an account has done in raids for two. */
function raidLine(p: Profile) {
  const r = p.raids;
  if (!r) return '';
  return `Raids with a friend: ${r.played} played, ${r.cleared} cleared.${r.bosses ? ` Best: ${scoreText({ tier: r.tier ?? 1, bosses: r.bosses, seconds: r.best })}` : ''}`;
}

function raidScreen() {
  if (state.profile && !raidListAsked) { raidListAsked = true; net.send({ t: 'lobbies' }); }
  const choice = cpuChoice(), hero = kitOf(choice);
  const busy = state.queue.on || !!state.lobby;
  const boss = SUN_WARDEN;
  const code = el('input', { placeholder: 'CODE', maxlength: 4, class: 'code-in' }) as HTMLInputElement;
  preview.show(hero?.model, hero);
  return el('div', { class: 'hs' },
    heroShowcase(hero),
    el('section', { class: 'card hs-roster', 'data-keep-scroll': 'raid' },
      el('div', { class: 'hs-roster-head' }, el('h2', {}, 'Raid'), raid.best ? el('span', { class: 'muted small' }, `Your best alone: ${scoreText(raid.best)}`) : null),
      el('p', { class: 'muted' }, 'Take an upgrade before each boss. Beat them all and the next tier is harder, and you keep your upgrades. One loss ends the run. Pale orange means leave, gold means stand here. Hard control does not hold a boss: it fills a gauge, and a full gauge makes it kneel.'),
      el('h3', { class: 'gap' }, 'Your hero'),
      heroPicker(choice, [], (n) => { setCpuHero(n); render(); }),
      el('h3', { class: 'gap' }, 'With others: up to 40'),
      state.profile
        ? el('div', {},
          el('p', { class: 'muted' }, 'Open a raid for anyone to join, or a private one for friends with its code. The boss is set for how many you are: 2, 5, 10, 15, 20, 30 or 40. A fallen hero lies where it fell until another stands by it. If all are down, the raid is over.'),
          el('div', { class: 'row' },
            el('button', { class: 'btn', disabled: busy, onclick: () => net.send({ t: 'lobby_create', raid: boss.id, open: true }) }, icon('lobbies'), 'Open a public raid'),
            el('button', { class: 'btn', disabled: busy, onclick: () => net.send({ t: 'lobby_create', raid: boss.id, open: false }) }, 'Private raid'),
            el('form', { class: 'row', onsubmit: (e: Event) => { e.preventDefault(); net.send({ t: 'lobby_join', code: code.value }); } },
              code, el('button', { class: 'btn', type: 'submit', disabled: busy }, 'Join by code'))),
          el('h3', { class: 'gap' }, 'Open raids'),
          state.raids.length
            ? el('div', { class: 'lobby-list' }, ...state.raids.map((r) => el('div', { class: 'raid-row' },
              el('div', { class: 'code' }, r.code),
              el('div', {}, el('div', { class: 'kit-name' }, `${r.host}'s raid`), el('div', { class: 'muted small' }, `${r.count} of 40 · set for ${bandOf(r.count)}`)),
              el('button', { class: 'btn', disabled: busy || r.count >= 40, onclick: () => net.send({ t: 'lobby_join', code: r.code }) }, 'Join'))))
            : el('p', { class: 'muted small' }, 'No open raids right now. Open one, and others can join it from here.'),
          state.profile.raids?.played ? el('p', { class: 'muted small' }, raidLine(state.profile)) : null)
        : el('p', { class: 'muted' }, 'Log in to raid with others.'),
    ),
    el('div', { class: 'hs-bar' },
      el('div', { class: `hs-note small ${busy ? 'error' : 'muted'}` }, busy
        ? 'Leave the matchmaking queue or your lobby to start a raid.'
        : `${hero ? hero.name : 'A random hero'} against the bosses, one after another.`),
      el('button', { class: 'btn', onclick: () => go(state.profile ? 'menu' : 'login') }, 'Back'),
      el('button', { class: 'btn primary big hs-find', disabled: busy, onclick: () => void raid.start({ hero: hero?.name ?? randomKit().name }) }, icon('raid'), 'Start alone')),
  );
}

// --- tower ---------------------------------------------------------------------------------------------------

/**
 * The Tower (pipeline/designs/tower.md): the hero, this week's Tower floor by floor, the best floor reached, and Start. One
 * player, offline, no account, as the Raid alone is.
 */
function towerScreen() {
  const choice = cpuChoice(), hero = kitOf(choice);
  const busy = state.queue.on || !!state.lobby;
  const week = isoWeek().id, best = towerBest(week), last = towerBest(weekBefore(week)), from = towerSaved(week);
  // The floors in sight: the first thirty, and on past the best one reached.
  const floors = towerFor(week, Math.max(30, Math.ceil((best + 5) / 10) * 10));
  preview.show(hero?.model, hero);
  const tile = (f: (typeof floors)[number]) => {
    const twist = f.twist ? TWISTS[f.twist] : null;
    const what = [KIND_NAME[f.kind], f.foe ? (f.kind === 'guardian' ? `the echo of ${f.foe}` : `an echo of ${f.foe}`) : '', f.mix ? `mixed with ${KIND_NAME[f.mix]}` : '', twist ? `${twist.name}: ${twist.blurb}` : ''].filter(Boolean).join(' · ');
    return el('div', { class: `tf k-${f.kind}${f.n <= best ? ' done' : ''}${f.n === from && from > 1 ? ' from' : ''}`, title: `Floor ${f.n}: ${what}` },
      el('b', {}, String(f.n)), el('span', {}, KIND_NAME[f.kind]), f.twist || f.mix ? el('i', { 'aria-hidden': 'true' }, '✦') : null);
  };
  const start = (resume: boolean) => void tower.start({ hero: hero?.name ?? randomKit().name, resume });
  return el('div', { class: 'hs' },
    heroShowcase(hero),
    el('section', { class: 'card hs-roster', 'data-keep-scroll': 'tower' },
      el('div', { class: 'hs-roster-head' }, el('h2', {}, 'The Tower'),
        el('span', { class: 'muted small' }, `This week's Tower · a new one in ${untilNext()}`)),
      el('div', { class: 'tower-best' },
        el('div', { class: 'tile' }, el('div', { class: 'tile-v' }, best ? String(best) : '–'), el('div', { class: 'tile-l' }, 'your highest floor this week')),
        el('div', { class: 'tile' }, el('div', { class: 'tile-v' }, last ? String(last) : '–'), el('div', { class: 'tile-l' }, 'last week')),
        el('div', { class: 'tile' }, el('div', { class: 'tile-v hearts' }, '♥'.repeat(LIVES)), el('div', { class: 'tile-l' }, 'lives a climb'))),
      el('p', { class: 'muted' }, 'Climb floor by floor. Each floor is one short room: clear it, take one of three boons, and walk up the stairs. Your health carries over from floor to floor. A fall costs a life and starts the floor again. Every tenth floor is a guardian, and beating it saves your climb. Pale orange means leave, gold means stand here.'),
      el('h3', { class: 'gap' }, `The floors, ${heightName(1)} to ${heightName(floors.length)}`),
      el('div', { class: 'tower-floors' }, ...floors.map(tile)),
      el('p', { class: 'muted small' }, 'The same Tower for everyone this week. ✦ marks a floor with a twist: point at it to see what.'),
      el('h3', { class: 'gap' }, 'Your hero'),
      heroPicker(choice, [], (n) => { setCpuHero(n); render(); }),
    ),
    el('div', { class: 'hs-bar' },
      el('div', { class: `hs-note small ${busy ? 'error' : 'muted'}` }, busy
        ? 'Leave the matchmaking queue or your lobby to climb.'
        : `${hero ? hero.name : 'A random hero'} climbs alone. Your best floor is kept in this browser.`),
      el('button', { class: 'btn', onclick: () => go(state.profile ? 'menu' : 'login') }, 'Back'),
      from > 1 ? el('button', { class: 'btn', disabled: busy, onclick: () => start(false) }, 'From floor 1') : null,
      el('button', { class: 'btn primary big hs-find', disabled: busy, onclick: () => start(from > 1) }, icon('tower'), from > 1 ? `Climb from floor ${from}` : 'Start the climb')),
  );
}

// --- heroes --------------------------------------------------------------------------------------------------

/** Every hero in one table, one row each. A click opens a row under itself (the turning model, every spell in full, the pick button) and closes it again. */
function heroesScreen() {
  const open = kitOf(state.heroView);
  preview.show(open?.model, open);
  const head = el('tr', {},
    el('th', {}, ''), el('th', {}, 'Hero'), el('th', { class: 'opt' }, 'HP'), el('th', { class: 'opt' }, 'Passive'),
    ...['Q', 'W', 'E', 'R'].map((k) => el('th', { class: 'icon-col' }, k)));
  const rows = kits.flatMap((k) => {
    const on = k.name === open?.name;
    const row = el('tr', { class: `hero-row${on ? ' on' : ''}`, onclick: () => { state.heroView = on ? '' : k.name; render(); } },
      el('td', {}, portrait(k, 'portrait sm')),
      el('td', {}, el('div', { class: 'kit-name' }, k.name), el('div', { class: 'muted small' }, k.title)),
      el('td', { class: 'opt' }, String(k.maxHp ?? 600)),
      el('td', { class: 'opt' }, traitFor(k.name)?.passive.name ?? ''),
      ...k.spells.map((s) => el('td', { class: 'icon-col', title: `${s.name}: ${s.blurb}` }, canvasOf(64, s.icon, 'icon sm'))));
    row.style.setProperty('--accent', k.accent);
    return on ? [row, heroDetail(k)] : [row];
  });
  return el('section', { class: 'card hero-table-card' }, el('table', { class: 'hero-table' }, head, ...rows));
}

/** The open row of the heroes table. */
function heroDetail(kit: HeroKit) {
  const spells = el('div', { class: 'spells' },
    el('div', { class: 'spell passive' },
      el('div', { class: 'icon-wrap' }, portrait(kit, 'icon')),
      el('div', {}, el('div', { class: 'spell-name' }, traitFor(kit.name)?.passive.name ?? ''), el('div', { class: 'blurb' }, traitFor(kit.name)?.passive.blurb ?? ''))),
    ...kit.spells.map((s) =>
      el('div', { class: `spell${s.key === 'R' ? ' ult' : ''}` },
        el('div', { class: 'icon-wrap' }, canvasOf(128, s.icon, 'icon'), el('span', { class: 'key' }, s.key)),
        el('div', {},
          el('div', { class: 'spell-name' }, s.name, s.key === 'R' ? el('span', { class: 'ult-tag' }, 'ULT') : null),
          el('div', { class: 'blurb' }, s.blurb),
          el('div', { class: 'muted small' }, `${s.range > 0 ? `range ${s.range}` : 'self'} · cooldown ${s.cooldown} s`),
        ),
      )));
  const mine = heroChoice() === kit.name;
  const cell = el('td', { colSpan: 8 },
    el('div', { class: 'hero-body' },
      el('div', { class: 'hero-side' },
        el('div', { class: 'stage' }, preview.canvas),
        el('button', { class: `btn${mine ? '' : ' primary'}`, disabled: mine, onclick: () => { setPreferredHero(kit.name); toast(`${kit.name} is your hero`); render(); } }, mine ? 'Your hero' : 'Pick this hero')),
      spells));
  const row = el('tr', { class: 'hero-open' }, cell);
  row.style.setProperty('--accent', kit.accent);
  return row;
}

// --- profile -------------------------------------------------------------------------------------------------

function statTiles(p: Profile) {
  const fav = kitOf(p.favourite);
  const rate = p.matches ? Math.round((p.wins / p.matches) * 100) : 0;
  const tile = (label: string, value: Child, extra?: Child) => el('div', { class: 'tile' }, el('div', { class: 'tile-v' }, value), el('div', { class: 'tile-l' }, label), extra);
  return el('div', { class: 'tiles' },
    tile('matches', String(p.matches)),
    tile('wins', String(p.wins)),
    tile('losses', String(p.losses)),
    tile('win rate', p.matches ? `${rate}%` : '–'),
    tile('favourite hero', fav ? el('span', { class: 'fav' }, portrait(fav, 'portrait xs'), fav.name) : '–'),
  );
}

function profileScreen(p: Profile) {
  const rows = Object.entries(p.heroes).sort((a, b) => b[1].played - a[1].played);
  const date = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  return el('div', { class: 'profile' },
    el('section', { class: 'card' },
      el('h2', {}, p.name), el('div', { class: 'muted' }, `Playing since ${new Date(p.created).toLocaleDateString()}`),
      statTiles(p),
      p.raids?.played ? el('p', { class: 'muted small' }, raidLine(p)) : null),
    el('div', { class: 'cols' },
      el('section', { class: 'card' }, el('h3', {}, 'Heroes played'),
        rows.length ? el('table', { class: 'tbl' },
          el('tr', {}, el('th', {}, 'Hero'), el('th', {}, 'Played'), el('th', {}, 'Wins'), el('th', {}, 'Win rate')),
          ...rows.map(([name, s]) => {
            const k = kitOf(name);
            return el('tr', {}, el('td', {}, k ? el('span', { class: 'fav' }, portrait(k, 'portrait xs'), k.name) : name),
              el('td', {}, String(s.played)), el('td', {}, String(s.wins)), el('td', {}, `${Math.round((s.wins / s.played) * 100)}%`));
          })) : el('p', { class: 'muted' }, 'No matches yet.')),
      el('section', { class: 'card' }, el('h3', {}, 'Recent matches'),
        p.history.length ? el('table', { class: 'tbl' },
          el('tr', {}, el('th', {}, ''), el('th', {}, 'Hero'), el('th', {}, 'Opponent'), el('th', {}, 'Time'), el('th', {}, 'When')),
          ...p.history.map((h) => el('tr', {},
            el('td', {}, el('span', { class: `res ${h.result}` }, h.result === 'win' ? 'WIN' : 'LOSS')),
            el('td', {}, h.from ? `${h.from} → ${h.hero}` : h.hero), el('td', {}, `${h.foe} (${h.foeHero})`),
            el('td', {}, `${h.seconds} s${h.reason !== 'ko' ? ` · ${h.reason}` : ''}`), el('td', { class: 'muted' }, date(h.at))))) : el('p', { class: 'muted' }, 'No matches yet.')),
    ),
  );
}

// --- news ----------------------------------------------------------------------------------------------------

/**
 * News: the change log (`changelog.ts`), newest first, one card a release (user, 2026-11-10: "Make also new page with
 * the change log and fill it out"). Open without an account too. A release not deployed yet is marked "Coming next";
 * the newest one that is out, "Live now". Clips do not load or play until asked.
 */
function newsScreen() {
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const newestLive = CHANGELOG.find((r) => r.live);
  // A clip waits for its play button: nothing loads but its poster, and nothing moves unasked.
  const video = (clip: string, poster: string | undefined, alt: string) => {
    const v = el('video', { class: 'news-media', src: clip, poster: poster ?? '', preload: 'none', 'aria-label': alt }) as HTMLVideoElement;
    v.muted = true; v.loop = true; v.playsInline = true; v.controls = true;
    return v;
  };
  const media = (it: NewsItem) => {
    if (it.clip) return video(it.clip, it.poster, it.alt ?? it.title);
    // a picture opens at full size in its own tab
    return it.image ? el('a', { class: 'news-pic', href: it.image, target: '_blank', rel: 'noopener' }, el('img', { class: 'news-media', src: it.image, alt: it.alt ?? '', loading: 'lazy' })) : null;
  };
  const item = (it: NewsItem) => el('li', { class: `news-item${it.clip || it.image ? ' has-media' : ''}` },
    el('div', { class: 'news-text' }, el('span', { class: `news-tag t-${it.tag.toLowerCase()}` }, it.tag), el('b', {}, it.title), el('p', {}, it.text)),
    media(it));
  const release = (r: Release) => el('section', { class: `card news-release${r.live ? '' : ' next'}` },
    el('div', { class: 'news-when' },
      el('span', { class: 'news-date' }, day(r.date)),
      !r.live ? el('span', { class: 'news-badge next' }, 'Coming next') : r === newestLive ? el('span', { class: 'news-badge live' }, 'Live now') : null),
    el('h2', {}, r.title),
    r.lead ? el('div', { class: 'news-lead' }, video(r.lead.clip, r.lead.poster, r.lead.alt)) : null,
    el('ul', { class: 'news-items' }, ...r.items.map(item)));
  return el('div', { class: 'news' },
    el('div', { class: 'news-head' }, el('h1', {}, 'News'), el('p', { class: 'muted' }, 'What changed in Arena of Kits, newest first.')),
    ...CHANGELOG.map(release));
}

// --- lobbies -------------------------------------------------------------------------------------------------

function lobbiesScreen() {
  const code = el('input', { placeholder: 'CODE', maxlength: 4, class: 'code-in' }) as HTMLInputElement;
  const busy = state.queue.on;
  return el('div', { class: 'lobbies' },
    el('section', { class: 'card' },
      el('h2', {}, 'Lobbies'),
      el('p', { class: 'muted' }, 'Create a 1v1 lobby and give its code to a friend, or join an open one. Both pick a hero (not the same one) and ready up; the duel starts when both are ready.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', disabled: busy, onclick: () => net.send({ t: 'lobby_create' }) }, icon('lobbies'), 'Create lobby'),
        el('form', { class: 'row', onsubmit: (e: Event) => { e.preventDefault(); net.send({ t: 'lobby_join', code: code.value }); } },
          code, el('button', { class: 'btn', type: 'submit', disabled: busy }, 'Join by code')),
      ),
      busy ? el('p', { class: 'error' }, 'Leave the matchmaking queue to use lobbies.') : null,
    ),
    el('section', { class: 'card' },
      el('h3', {}, `Open lobbies (${state.lobbies.length})`),
      state.lobbies.length
        ? el('div', { class: 'lobby-list' }, ...state.lobbies.map((l) => {
          const k = kitOf(l.hostHero);
          return el('div', { class: 'lobby-row' },
            el('span', { class: 'code' }, l.code),
            k ? portrait(k, 'portrait xs') : el('span', { class: 'portrait xs empty' }),
            el('span', {}, el('b', {}, l.host), k ? ` · ${k.name}` : ' · picking'),
            el('button', { class: 'btn small', disabled: busy || l.host === state.profile?.name, onclick: () => net.send({ t: 'lobby_join', code: l.code }) }, 'Join'));
        }))
        : el('div', { class: 'empty-state' }, icon('lobbies'), el('b', {}, 'No open lobbies yet'),
          el('span', {}, 'Create one and send its code to a friend, or find a match from the Play screen.')),
    ),
  );
}

/** The open raids were asked for once since the raid screen opened (the hub then keeps the list fresh). */
let raidListAsked = false;

/** How many a raid's boss is set for, from how many are in it (pipeline/designs/raid-party.md). */
function bandOf(n: number) {
  return n <= 2 ? 2 : n <= 5 ? 5 : n <= 10 ? 10 : n <= 15 ? 15 : n <= 20 ? 20 : n <= 30 ? 30 : 40;
}

/** A raid room for up to 40: everyone's hero, the band, and the host's Start. */
function raidLobbyScreen(l: LobbyState) {
  const me = l.seats[state.lobbySeat];
  const host = state.lobbySeat === 0;
  const picked = l.seats.filter((s) => s.hero).length;
  const band = l.band ?? bandOf(l.seats.length);
  const max = l.max ?? 40;
  return el('div', { class: 'lobby' },
    el('section', { class: 'card' },
      el('div', { class: 'lobby-head' },
        el('div', {}, el('div', { class: 'muted small' }, l.open ? 'PUBLIC RAID · CODE' : 'PRIVATE RAID · CODE'), el('div', { class: 'code big' }, l.code)),
        el('button', { class: 'btn ghost', onclick: () => net.send({ t: 'lobby_leave' }) }, 'Leave raid')),
      el('p', { class: 'muted' }, `${l.seats.length} of ${max} in the raid. The boss is set for ${band}.`),
      el('div', { class: 'party-seats' }, ...l.seats.map((s, i) => {
        const k = kitOf(s.hero);
        const row = el('div', { class: `party-seat${i === state.lobbySeat ? ' mine' : ''}` },
          k ? portrait(k, 'portrait sm') : el('div', { class: 'portrait sm empty' }, '?'),
          el('div', {}, el('div', { class: 'kit-name' }, `${s.name}${i === 0 ? ' · host' : ''}`), el('div', { class: 'muted small' }, k ? k.name : 'picking a hero')));
        if (k) row.style.setProperty('--accent', k.accent);
        return row;
      })),
      el('h3', {}, 'Pick your hero'),
      el('p', { class: 'muted small' }, 'Anyone can take any hero, the same one too.'),
      heroPicker(me?.hero ?? '', [], (n) => {
        const name = n === RANDOM ? randomKit().name : n;
        if (n === RANDOM) toast(`Random pick: ${name}`);
        else setPreferredHero(name);
        net.send({ t: 'lobby_pick', hero: name });
      }),
      el('div', { class: 'row' },
        host
          ? el('button', { class: 'btn primary big', disabled: picked < l.seats.length, onclick: () => net.send({ t: 'raid_go' }) }, icon('raid'), 'Start the raid')
          : null,
        el('span', { class: 'muted' }, host
          ? picked < l.seats.length ? `Waiting for ${l.seats.length - picked} to pick a hero.` : 'Everyone has a hero. Start when you are ready; more can still join until then.'
          : `Waiting for ${l.seats[0]?.name ?? 'the host'} to start.`)),
    ),
  );
}

function lobbyScreen(l: LobbyState) {
  if (l.raid) return raidLobbyScreen(l);
  const me = l.seats[state.lobbySeat];
  const other = l.seats[1 - state.lobbySeat];
  const seat = (s: LobbyState['seats'][number] | undefined, mine: boolean) => {
    const k = kitOf(s?.hero);
    return el('div', { class: `seat${s?.ready ? ' ready' : ''}${mine ? ' mine' : ''}` },
      k ? portrait(k, 'portrait lg') : el('div', { class: 'portrait lg empty' }, s ? '?' : '…'),
      el('div', { class: 'kit-name' }, s ? s.name : 'Waiting for a player'),
      el('div', { class: 'muted' }, s ? (k ? `${k.name}, ${k.title}` : 'picking a hero') : `share the code ${l.code}`),
      el('div', { class: `badge${s?.ready ? ' on' : ''}` }, s ? (s.ready ? 'READY' : 'not ready') : 'empty'),
    );
  };
  return el('div', { class: 'lobby' },
    el('section', { class: 'card' },
      el('div', { class: 'lobby-head' },
        el('div', {}, el('div', { class: 'muted small' }, l.raid ? 'RAID ROOM CODE' : 'LOBBY CODE'), el('div', { class: 'code big' }, l.code)),
        el('button', { class: 'btn ghost', onclick: () => net.send({ t: 'lobby_leave' }) }, l.raid ? 'Leave room' : 'Leave lobby')),
      el('div', { class: 'seats' }, seat(me, true), el('div', { class: 'vs' }, l.raid ? '&' : 'VS'), seat(other, false)),
      el('h3', {}, 'Pick your hero'),
      heroPicker(me?.hero ?? '', other?.hero ? [other.hero] : [], (n) => {
        // Random is drawn at once here: the other player sees the hero and can't pick it.
        const name = n === RANDOM ? randomKit([other?.hero, me?.hero]).name : n;
        if (n === RANDOM) toast(`Random pick: ${name}`);
        else setPreferredHero(name);
        net.send({ t: 'lobby_pick', hero: name });
      }),
      el('div', { class: 'row' },
        el('button', {
          class: `btn ${me?.ready ? '' : 'primary'} big`, disabled: !me?.hero,
          onclick: () => net.send({ t: 'lobby_ready', ready: !me?.ready }),
        }, me?.ready ? 'Not ready' : 'Ready'),
        el('span', { class: 'muted' }, l.seats.length < 2 ? 'Waiting for a second player…' : other?.ready ? `${other.name} is ready.` : `Waiting for ${other?.name} to ready up.`)),
    ),
  );
}

// --- network events ----------------------------------------------------------------------------------------

const loading = new LoadingScreen();
const match = new MatchController(net, gameApi, loading, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'menu'; render(); net.send({ t: 'profile' }); },
  onProfile: (p) => { state.profile = p; },
  toast,
  pick: showPick,
  hidePick,
});
const cpu = new CpuMatch(gameApi, loading, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'cpu'; render(); },
  onWin: (level) => safeSet(cpuWonKey(), [...cpuWon().add(level)].sort().join('')),
});
const raid = new RaidRun(gameApi, loading, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'raid'; render(); },
});
const tower = new TowerRun(gameApi, loading, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'tower'; render(); },
});
const coop = new RaidController(net, gameApi, loading, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'raid'; render(); net.send({ t: 'profile' }); },
  onProfile: (p) => { state.profile = p; },
  toast,
});
// The duel card's "Leave duel" / "Back to menu": ends whichever fight is on.
gameApi.duel.onLeave = () => (tower.active ? tower.exit() : raid.active ? raid.exit() : coop.active ? coop.exit() : cpu.active ? cpu.exit() : match.exit());

net.on('socket', (m) => {
  state.connected = m.open;
  if (!m.open) { state.queue.on = false; state.lobby = null; }
  render();
});
net.on('session', (m) => {
  state.profile = m.profile;
  if (state.screen === 'login') state.screen = 'menu';
  render();
});
net.on('auth_error', (m) => {
  state.profile = null;
  // A message sent just before being signed out gets this answer: it must not replace the reason.
  if (m.error !== 'Please log in' || !state.authError) state.authError = m.error;
  render();
});
net.on('update_required', (m) => {
  state.outdated = m.error;
  // On top of everything: a CPU fight goes on underneath, but nothing online works from this page any more.
  document.body.append(el('div', { class: 'update-bar' }, el('span', {}, m.error), el('button', { class: 'btn small primary', onclick: () => location.reload() }, 'Reload')));
  render();
});
net.on('logged_out', (m) => {
  // First: leaving goes back to the screen the raid started from, and this one is the login.
  if (coop.active) coop.exit(true);
  state.profile = null;
  state.lobby = null;
  state.queue.on = false;
  state.screen = 'login';
  state.authError = m.reason;
  if (match.active) match.exit();
  render();
});
net.on('profile', (m) => { state.profile = m.profile; if (!match.active) render(); });
net.on('error', (m) => toast(m.error));
net.on('lobbies', (m) => {
  state.lobbies = m.list;
  state.raids = m.raids ?? [];
  if ((state.screen === 'lobbies' || state.screen === 'raid') && !match.active && !coop.active && !raid.active) render();
});
net.on('lobby', (m) => {
  const had = !!state.lobby, wasRaid = !!state.lobby?.raid;
  state.lobby = m.lobby;
  if (m.you !== undefined) state.lobbySeat = m.you;
  if (m.lobby && !had) {
    state.screen = 'lobby';
    // Start with the hero this player last used.
    if (!m.lobby.seats[state.lobbySeat]?.hero) {
      const other = m.lobby.seats[1 - state.lobbySeat]?.hero;
      const hero = heroChoice() === RANDOM ? randomKit([other]).name
        : preferredHero().name !== other ? preferredHero().name : kits.find((k) => k.name !== other)!.name;
      net.send({ t: 'lobby_pick', hero });
    }
  }
  if (!m.lobby && state.screen === 'lobby') state.screen = wasRaid ? 'raid' : 'lobbies';
  if (!match.active) render();
});
net.on('queue', (m) => {
  state.queue = { on: m.on, since: m.since, size: m.size };
  if (!match.active) render();
});

net.connect();
render();

// Console / automated checks: `game.state`, `game.net`, `game.match`, `game.cpu`, `game.tower`.
(window as unknown as { game: unknown }).game = { state, net, match, cpu, raid, coop, tower, api: gameApi, go, render };
