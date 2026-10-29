/**
 * game.html: the duel game. Main menu, login, profile, heroes overview, lobbies and matchmaking over the game
 * server (server/game-server.mjs), and network 1v1 matches in the existing duel ring (src/game/match.ts). The 3D
 * scene is the editor's own (src/main.ts in game mode: no panel, no editor hotkeys). Architecture:
 * docs/architecture/multiplayer.md.
 */
import './game.css';
import { gameApi } from '../main';
import type { HeroKit } from '../heroes';
import { NetClient, type LobbyState, type Profile } from '../net/client';
import { HeroPreview } from './heroPreview';
import { MatchController } from './match';

type Screen = 'login' | 'menu' | 'heroes' | 'profile' | 'lobbies' | 'lobby';

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
  heroView: kits[0].name,
  authError: '',
  authMode: 'login' as 'login' | 'register',
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

const kitOf = (name: string | null | undefined) => kits.find((k) => k.name === name);
const portrait = (kit: HeroKit, cls = 'portrait') => {
  const c = canvasOf(128, kit.portrait, cls);
  c.style.borderColor = kit.foil;
  return c;
};

// --- preferred hero (per account, this browser) ------------------------------------------------------------

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
  if (match.active) { root.style.display = 'none'; return; }
  root.style.display = '';
  if (!state.profile) { root.append(loginScreen()); return; }
  root.append(header());
  const body = el('main', { class: 'screen' });
  const s = state.screen;
  body.append(
    s === 'heroes' ? heroesScreen()
      : s === 'profile' ? profileScreen(state.profile)
        : s === 'lobbies' ? lobbiesScreen()
          : s === 'lobby' && state.lobby ? lobbyScreen(state.lobby)
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
    el('nav', {}, nav('Play', 'menu'), nav('Lobbies', state.lobby ? 'lobby' : 'lobbies'), nav('Heroes', 'heroes'), nav('Profile', 'profile')),
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
    el('div', { class: 'title' }, el('span', { class: 'sigil big' }, '⚔'), el('h1', {}, 'Arena of Kits'), el('p', { class: 'muted' }, '1v1 hero duels · click to move · Q W E R to cast')),
    el('div', { class: 'tabs' }, tab('login', 'Log in'), tab('register', 'Create account')),
    name, pass,
    el('button', { class: 'btn primary', type: 'submit', disabled: !state.connected }, state.authMode === 'login' ? 'Log in' : 'Create account'),
    el('div', { class: 'error' }, state.connected ? state.authError : 'Connecting to the game server…'),
    el('p', { class: 'fine' }, 'Local accounts on this machine only. Passwords are stored hashed in server/data/accounts.json.'),
  );
  setTimeout(() => name.focus());
  return el('div', { class: 'center' }, form, heroStrip());
}

/** The roster as a strip of portraits (login backdrop). */
function heroStrip() {
  return el('div', { class: 'strip' }, ...kits.map((k) => portrait(k, 'portrait sm')));
}

// --- menu / play ---------------------------------------------------------------------------------------------

function menuScreen() {
  const hero = preferredHero();
  const queued = state.queue.on;
  return el('div', { class: 'menu' },
    el('section', { class: 'card play' },
      el('h2', {}, 'Play'),
      el('p', { class: 'muted' }, 'Find a match pairs you with the next player in the queue (who picked a different hero). Or open a lobby and share its code.'),
      el('div', { class: 'chosen' }, portrait(hero, 'portrait lg'),
        el('div', {}, el('div', { class: 'kit-name' }, hero.name), el('div', { class: 'muted' }, hero.title),
          el('div', { class: 'spell-row' }, ...hero.spells.map((s) => canvasOf(64, s.icon, 'icon sm'))))),
      heroPicker(hero.name, [], (n) => { setPreferredHero(n); render(); }),
      el('div', { class: 'row' },
        queued
          ? el('button', { class: 'btn', onclick: () => net.send({ t: 'queue_leave' }) }, 'Cancel search')
          : el('button', { class: 'btn primary big', disabled: !!state.lobby, onclick: () => net.send({ t: 'queue_join', hero: hero.name }) }, `Find match as ${hero.name}`),
        el('button', { class: 'btn', disabled: queued, onclick: () => go(state.lobby ? 'lobby' : 'lobbies') }, state.lobby ? 'Back to lobby' : 'Lobbies'),
      ),
    ),
    el('section', { class: 'card side' },
      el('h3', {}, 'How to fight'),
      el('ul', { class: 'how' },
        el('li', {}, el('b', {}, 'Left click'), ' the ground to walk.'),
        el('li', {}, el('b', {}, 'Q W E R'), ' aim a spell, click to cast. R is the ultimate.'),
        el('li', {}, el('b', {}, 'Right click / Esc'), ' cancels the aim.'),
        el('li', {}, 'Red zones show where a spell lands: walk out before it hits to ', el('b', {}, 'dodge'), '.'),
        el('li', {}, 'Both heroes have 600 HP. Last one standing wins.'),
      ),
      statTiles(state.profile!),
    ),
  );
}

function heroPicker(selected: string, taken: string[], pick: (name: string) => void) {
  return el('div', { class: 'picker' }, ...kits.map((k) => {
    const off = taken.includes(k.name);
    const b = el('button', {
      class: `pick${k.name === selected ? ' on' : ''}`, disabled: off, title: off ? `${k.name} is taken` : `${k.name}, ${k.title}`,
      onclick: () => pick(k.name),
    }, portrait(k, 'portrait sm'), el('span', {}, k.name));
    b.style.setProperty('--accent', k.accent);
    return b;
  }));
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
  t.textContent = `Searching as ${preferredHero().name} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${state.queue.size} in queue`;
}
setInterval(() => state.queue.on && updateQueueText(), 500);

// --- heroes --------------------------------------------------------------------------------------------------

function heroesScreen() {
  const kit = kitOf(state.heroView) ?? kits[0];
  preview.show(kit.model);
  const list = el('div', { class: 'hero-list' }, ...kits.map((k) => {
    const b = el('button', { class: `hero-card${k.name === kit.name ? ' on' : ''}`, onclick: () => { state.heroView = k.name; render(); } },
      portrait(k), el('div', { class: 'kit-name' }, k.name), el('div', { class: 'muted small' }, k.title));
    b.style.setProperty('--accent', k.accent);
    return b;
  }));
  const spells = el('div', { class: 'spells' }, ...kit.spells.map((s) =>
    el('div', { class: `spell${s.key === 'R' ? ' ult' : ''}` },
      el('div', { class: 'icon-wrap' }, canvasOf(128, s.icon, 'icon'), el('span', { class: 'key' }, s.key)),
      el('div', {},
        el('div', { class: 'spell-name' }, s.name, s.key === 'R' ? el('span', { class: 'ult-tag' }, 'ULT') : null),
        el('div', { class: 'blurb' }, s.blurb),
        el('div', { class: 'muted small' }, `${s.range > 0 ? `range ${s.range}` : 'self'} · cooldown ${s.cooldown} s`),
      ),
    )));
  const mine = preferredHero().name === kit.name;
  const detail = el('section', { class: 'card hero-detail' },
    el('div', { class: 'hero-head' }, portrait(kit, 'portrait lg'),
      el('div', {}, el('h2', {}, kit.name), el('div', { class: 'muted' }, kit.title),
        el('button', { class: `btn${mine ? '' : ' primary'}`, disabled: mine, onclick: () => { setPreferredHero(kit.name); toast(`${kit.name} is your hero`); render(); } }, mine ? 'Your hero' : 'Pick this hero'))),
    el('div', { class: 'hero-body' }, el('div', { class: 'stage' }, preview.canvas), spells),
  );
  detail.style.setProperty('--accent', kit.accent);
  return el('div', { class: 'heroes' }, list, detail);
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
            return el('tr', {}, el('td', {}, k ? el('span', { class: 'fav' }, portrait(k, 'portrait xs'), name) : name),
              el('td', {}, String(s.played)), el('td', {}, String(s.wins)), el('td', {}, `${Math.round((s.wins / s.played) * 100)}%`));
          })) : el('p', { class: 'muted' }, 'No matches yet.')),
      el('section', { class: 'card' }, el('h3', {}, 'Recent matches'),
        p.history.length ? el('table', { class: 'tbl' },
          el('tr', {}, el('th', {}, ''), el('th', {}, 'Hero'), el('th', {}, 'Opponent'), el('th', {}, 'Time'), el('th', {}, 'When')),
          ...p.history.map((h) => el('tr', {},
            el('td', {}, el('span', { class: `res ${h.result}` }, h.result === 'win' ? 'WIN' : 'LOSS')),
            el('td', {}, h.hero), el('td', {}, `${h.foe} (${h.foeHero})`),
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
      heroPicker(me?.hero ?? '', other?.hero ? [other.hero] : [], (n) => { setPreferredHero(n); net.send({ t: 'lobby_pick', hero: n }); }),
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

const match = new MatchController(net, gameApi, {
  onEnter: () => render(),
  onExit: () => { state.screen = 'menu'; render(); net.send({ t: 'profile' }); },
  onProfile: (p) => { state.profile = p; },
  toast,
});

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
      const hero = preferredHero().name !== other ? preferredHero().name : kits.find((k) => k.name !== other)!.name;
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

// Console / automated checks: `game.state`, `game.net`, `game.match`.
(window as unknown as { game: unknown }).game = { state, net, match, api: gameApi, go };
