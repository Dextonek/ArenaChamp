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

type Screen = 'login' | 'menu' | 'heroes' | 'profile' | 'lobbies' | 'lobby' | 'cpu';

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

function render() {
  root.replaceChildren();
  if (match.active || cpu.active) { root.style.display = 'none'; return; }
  root.style.display = '';
  // Without an account: the login screen, or the CPU screen (an offline fight needs no account).
  if (!state.profile) {
    root.append(state.screen === 'cpu' ? el('main', { class: 'screen' }, cpuScreen()) : loginScreen());
    return;
  }
  root.append(header());
  const body = el('main', { class: 'screen' });
  const s = state.screen;
  body.append(
    s === 'heroes' ? heroesScreen()
      : s === 'profile' ? profileScreen(state.profile)
        : s === 'lobbies' ? lobbiesScreen()
          : s === 'lobby' && state.lobby ? lobbyScreen(state.lobby)
            : s === 'cpu' ? cpuScreen()
              : menuScreen(),
  );
  root.append(body);
  if (state.queue.on) root.append(queueBar());
}

function header() {
  const p = state.profile!;
  const nav = (label: string, screen: Screen) =>
    el('button', { class: `nav${state.screen === screen ? ' on' : ''}`, onclick: () => go(screen) }, label);
  return el('header', { class: 'top' },
    el('div', { class: 'brand', onclick: () => go('menu') }, el('span', { class: 'sigil' }, '⚔'), 'Arena of Kits'),
    el('nav', {}, nav('Play', 'menu'), nav('vs CPU', 'cpu'), nav('Lobbies', state.lobby ? 'lobby' : 'lobbies'), nav('Heroes', 'heroes'), nav('Profile', 'profile')),
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
    el('div', { class: 'tabs' }, tab('login', 'Log in'), tab('register', 'Create account')),
    name, pass,
    el('button', { class: 'btn primary', type: 'submit', disabled: !state.connected }, state.authMode === 'login' ? 'Log in' : 'Create account'),
    el('div', { class: 'error' }, state.outdated || (state.connected ? state.authError : 'Connecting to the game server…')),
    el('p', { class: 'fine' }, 'Your name and record are kept on the game server. Passwords are stored hashed.'),
    el('div', { class: 'or' }, 'or'),
    el('button', { class: 'btn ghost', type: 'button', onclick: () => go('cpu') }, 'Play vs CPU · no account needed'),
  );
  setTimeout(() => name.focus());
  return el('div', { class: 'center login-screen' }, form, heroStrip());
}

/** The roster as a strip of portraits (login backdrop). */
function heroStrip() {
  return el('div', { class: 'strip' }, ...kits.map((k) => portrait(k, 'portrait sm')));
}

// --- menu / play ---------------------------------------------------------------------------------------------

function menuScreen() {
  const choice = heroChoice(), hero = kitOf(choice);
  const queued = state.queue.on;
  return el('div', { class: 'menu' },
    el('section', { class: 'card play' },
      el('h2', {}, 'Play'),
      el('p', { class: 'muted' }, 'Find a match pairs you with the next player in the queue (who picked a different hero). Or open a lobby and share its code.'),
      chosenHero(hero),
      heroPicker(choice, [], (n) => { setPreferredHero(n); render(); }),
      el('div', { class: 'row play-actions three' },
        queued
          ? el('button', { class: 'btn', onclick: () => net.send({ t: 'queue_leave' }) }, 'Cancel search')
          : el('button', {
            class: 'btn primary big', disabled: !!state.lobby,
            onclick: () => {
              const name = hero?.name ?? randomKit().name;
              state.queueHero = name;
              if (!hero) toast(`Random pick: ${name}`);
              net.send({ t: 'queue_join', hero: name });
            },
          }, hero ? `Find match as ${hero.name}` : 'Find match as a random hero'),
        el('button', { class: 'btn', disabled: queued, onclick: () => go(state.lobby ? 'lobby' : 'lobbies') }, state.lobby ? 'Back to lobby' : 'Lobbies'),
        el('button', { class: 'btn', disabled: queued || !!state.lobby, onclick: () => go('cpu') }, 'Play vs CPU'),
      ),
    ),
    el('section', { class: 'card side' },
      el('h3', {}, 'How to fight'),
      TOUCH ? el('ul', { class: 'how' },
        el('li', {}, 'The ', el('b', {}, 'stick'), ' on the left walks; tap the ground to walk there, tap the enemy to attack.'),
        el('li', {}, el('b', {}, 'Tap a spell'), ' to cast it at the enemy, or ', el('b', {}, 'drag'), ' it to aim and let go to cast. The big gold one is the ultimate.'),
        el('li', {}, 'Drag back onto the spell to cancel. The ', el('b', {}, '⚔'), ' button attacks; pinch to zoom.'),
        el('li', {}, 'Red zones show where a spell lands: walk out before it hits to ', el('b', {}, 'dodge'), '.'),
        el('li', {}, 'Both heroes have 600 HP. Last one standing wins.'),
        el('li', {}, 'Best of three: the first to win two rounds takes the match.'),
      ) : el('ul', { class: 'how' },
        el('li', {}, el('b', {}, 'Right click'), ' the ground to walk (hold to keep walking), or an enemy to attack it.'),
        el('li', {}, el('b', {}, 'Q W E R'), ' aim a spell, click to cast. R is the ultimate.'),
        el('li', {}, el('b', {}, 'Right click / Esc'), ' cancels the aim.'),
        el('li', {}, 'Red zones show where a spell lands: walk out before it hits to ', el('b', {}, 'dodge'), '.'),
        el('li', {}, 'Both heroes have 600 HP. Last one standing wins.'),
        el('li', {}, 'Best of three: the first to win two rounds takes the match.'),
      ),
      statTiles(state.profile!),
    ),
  );
}

/** The chosen hero with its spells, or the Random tile's icon when it is still to be drawn. */
function chosenHero(hero: HeroKit | undefined) {
  if (!hero) {
    return el('div', { class: 'chosen' }, randomPortrait('portrait lg'),
      el('div', {}, el('div', { class: 'kit-name' }, 'Random hero'), el('div', { class: 'muted' }, 'Drawn when the fight starts')));
  }
  return el('div', { class: 'chosen' }, portrait(hero, 'portrait lg'),
    el('div', {}, el('div', { class: 'kit-name' }, hero.name), el('div', { class: 'muted' }, hero.title),
      el('div', { class: 'spell-row' }, ...hero.spells.map((s) => canvasOf(64, s.icon, 'icon sm')))));
}

/** The hero grid. Random comes first; `pick` gets `RANDOM` for it. */
function heroPicker(selected: string, taken: string[], pick: (name: string) => void) {
  const random = el('button', {
    class: `pick${selected === RANDOM ? ' on' : ''}`, title: 'A random hero', onclick: () => pick(RANDOM),
  }, randomPortrait('portrait sm'), el('span', {}, 'Random'));
  random.style.setProperty('--accent', '#c9a24a');
  return el('div', { class: 'picker' }, random, ...kits.map((k) => {
    const off = taken.includes(k.name);
    const b = el('button', {
      class: `pick${k.name === selected ? ' on' : ''}`, disabled: off, title: off ? `${k.name} is taken` : `${k.name}, ${k.title}`,
      onclick: () => pick(k.name),
    }, portrait(k, 'portrait sm'), el('span', {}, k.name));
    b.style.setProperty('--accent', k.accent);
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
function updateQueueText(bar = root.querySelector('.queue-bar')) {
  const t = bar?.querySelector('.qtext');
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

function cpuScreen() {
  const choice = cpuChoice(), hero = kitOf(choice);
  const level = cpuLevel(cpuPick.level);
  const foeKit = cpuPick.foe !== choice ? kitOf(cpuPick.foe) : undefined;
  const won = cpuWon();
  // A match from the queue or a lobby would take the scene over: those come first.
  const busy = state.queue.on || !!state.lobby;
  const levels = el('div', { class: 'levels' }, ...CPU_LEVELS.map((l) => el('button', {
    class: `level${l.id === level.id ? ' on' : ''}`, title: l.blurb,
    onclick: () => { cpuPick.level = l.id; safeSet('cpu.level', String(l.id)); render(); },
  }, el('span', { class: 'pips' }, '◆'.repeat(l.id)), el('b', {}, l.name, won.has(l.id) ? el('span', { class: 'won', title: 'beaten' }, '✓') : null))));
  const foeSelect = el('select', {
    class: 'foe-select',
    onchange: (e: Event) => { cpuPick.foe = (e.target as HTMLSelectElement).value; safeSet('cpu.foe', cpuPick.foe); render(); },
  },
  el('option', { value: 'random', selected: !foeKit }, 'A random hero'),
  ...kits.filter((k) => k.name !== choice).map((k) => el('option', { value: k.name, selected: k === foeKit }, `${k.name}, ${k.title}`)));
  return el('div', { class: 'cpu' },
    el('section', { class: 'card' },
      el('h2', {}, 'Play vs CPU'),
      el('p', { class: 'muted' }, 'An offline duel against the computer in a random arena. No account or server needed; it does not count on your profile.'),
      el('h3', {}, 'Difficulty'),
      levels,
      el('p', { class: 'level-blurb' }, el('b', {}, `${level.name}: `), level.blurb),
      el('h3', {}, 'Your hero'),
      chosenHero(hero),
      heroPicker(choice, [], (n) => { setCpuHero(n); render(); }),
      el('h3', { class: 'gap' }, 'Opponent'),
      el('div', { class: 'foe-row' }, foeKit ? portrait(foeKit, 'portrait sm') : randomPortrait('portrait sm'), foeSelect),
      el('div', { class: 'row play-actions' },
        el('button', { class: 'btn primary big', disabled: busy, onclick: () => void cpu.start({ hero: hero?.name ?? randomKit([foeKit?.name]).name, foe: foeKit?.name ?? 'random', level: level.id }) },
          `Fight ${foeKit ? foeKit.name : 'a random hero'} · ${level.name}`),
        el('button', { class: 'btn', onclick: () => go(state.profile ? 'menu' : 'login') }, 'Back')),
      busy ? el('p', { class: 'error' }, 'Leave the matchmaking queue or your lobby to fight the CPU.') : null,
    ),
  );
}

// --- heroes --------------------------------------------------------------------------------------------------

/** Every hero in one table, one row each. A click opens a row under itself (the turning model, every spell in full, the pick button) and closes it again. */
function heroesScreen() {
  const open = kitOf(state.heroView);
  preview.show(open?.model);
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
      statTiles(p)),
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

// --- lobbies -------------------------------------------------------------------------------------------------

function lobbiesScreen() {
  const code = el('input', { placeholder: 'CODE', maxlength: 4, class: 'code-in' }) as HTMLInputElement;
  const busy = state.queue.on;
  return el('div', { class: 'lobbies' },
    el('section', { class: 'card' },
      el('h2', {}, 'Lobbies'),
      el('p', { class: 'muted' }, 'Create a 1v1 lobby and give its code to a friend, or join an open one. Both pick a hero (not the same one) and ready up; the duel starts when both are ready.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', disabled: busy, onclick: () => net.send({ t: 'lobby_create' }) }, 'Create lobby'),
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
        : el('p', { class: 'muted' }, 'No open lobbies. Create one!'),
    ),
  );
}

function lobbyScreen(l: LobbyState) {
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
        el('div', {}, el('div', { class: 'muted small' }, 'LOBBY CODE'), el('div', { class: 'code big' }, l.code)),
        el('button', { class: 'btn ghost', onclick: () => net.send({ t: 'lobby_leave' }) }, 'Leave lobby')),
      el('div', { class: 'seats' }, seat(me, true), el('div', { class: 'vs' }, 'VS'), seat(other, false)),
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
// The duel card's "Leave duel" / "Back to menu": ends whichever fight is on.
gameApi.duel.onLeave = () => (cpu.active ? cpu.exit() : match.exit());

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
  state.authError = m.error;
  render();
});
net.on('update_required', (m) => {
  state.outdated = m.error;
  // On top of everything: a CPU fight goes on underneath, but nothing online works from this page any more.
  document.body.append(el('div', { class: 'update-bar' }, el('span', {}, m.error), el('button', { class: 'btn small primary', onclick: () => location.reload() }, 'Reload')));
  render();
});
net.on('logged_out', (m) => {
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
  if (state.screen === 'lobbies' && !match.active) render();
});
net.on('lobby', (m) => {
  const had = !!state.lobby;
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
  if (!m.lobby && state.screen === 'lobby') state.screen = 'lobbies';
  if (!match.active) render();
});
net.on('queue', (m) => {
  state.queue = { on: m.on, since: m.since, size: m.size };
  if (!match.active) render();
});

net.connect();
render();

// Console / automated checks: `game.state`, `game.net`, `game.match`, `game.cpu`.
(window as unknown as { game: unknown }).game = { state, net, match, cpu, api: gameApi, go, render };
