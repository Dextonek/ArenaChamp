/**
 * The game page's Leaderboards and Clan screens (docs/architecture/multiplayer.md, "Leaderboards and clans"; user, 2026-11-14:
 * "also make like online leaderboards", "let's make like clans, groups, so that people can chat while being in one clan").
 *
 * Leaderboards: tabs for the duel rating (all time, and the week's wins), the week's Raid and Tower boards, the Climb, and the clans.
 * Everything comes from the hub's `leaderboards` message; the player's own row stands under a list it is not on.
 *
 * Clan: with no clan, found one, join with a code, or look through the clans with room and ask to join one. In a clan: its members
 * with their dots, the invite code and the asks for the leader, the room's chat, and Leave. Every word of the chat is put in with
 * textContent (never as HTML). The parts that change while the screen is up (the members, the chat, the list of clans) are kept
 * elements filled in place: a new line or a dot never redraws the screen, so a message half typed stays where it is.
 */
import type { ChatLine, ClanRow, ClanState, ClanView, Leaderboards, NetClient } from '../net/client';
import { CLAN, SHOP } from '../../server/protocol.mjs';

type Child = Node | string | null | undefined | false;
type El = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, unknown>, ...children: Child[]) => HTMLElementTagNameMap[K];

/** What the screens need of the page (src/game/main.ts). */
export interface SocialHost {
  el: El;
  net: NetClient;
  toast(text: string): void;
  /** The signed-in name, or null. */
  me(): string | null;
  /** A small portrait of a hero, or null for none. */
  heroIcon(name: string | null): HTMLElement | null;
  /** Draws the screen again (switching between "no clan" and "in a clan", a new tab). */
  render(): void;
  /** Which of the two screens is on show now, with no fight over it. */
  shown(): 'boards' | 'clan' | null;
  /** Days and hours to the next week. */
  untilWeek(): string;
  /** A time as m:ss. */
  clock(seconds: number): string;
}

type BoardTab = 'duels' | 'raid' | 'tower' | 'climb' | 'clans';

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function createSocial(host: SocialHost) {
  const { el, net } = host;

  // --- state ---------------------------------------------------------------------------------------------------------
  let boards: Leaderboards | null = null;
  let tab: BoardTab = (['duels', 'raid', 'tower', 'climb', 'clans'] as const).find((t) => t === safeGet('boards.tab')) ?? 'duels';
  let span: 'all' | 'week' = safeGet('boards.span') === 'week' ? 'week' : 'all';
  /** The player's clan, once the hub has said (undefined: not yet). */
  let clan: ClanState | null | undefined;
  let mutes = new Set<string>();
  let lines: ChatLine[] = [];
  let list: ClanRow[] = [];
  let view: ClanView | null = null;
  /** The member whose actions are open (the leader's, and a mute). */
  let openMember = '';
  let leaveAsk = false;

  const readKey = () => `clan.read.${host.me() ?? ''}.${clan?.id ?? ''}`;
  const lastRead = () => Number(safeGet(readKey())) || 0;
  /** Messages from others this player has not seen on the Clan screen yet. */
  const unread = () => {
    if (!clan) return 0;
    const me = host.me()?.toLowerCase(), read = lastRead();
    return lines.filter((l) => l.kind === 'say' && l.n > read && l.name.toLowerCase() !== me && !mutes.has(l.name.toLowerCase())).length;
  };
  /** On the Clan screen with no fight over it: everything shown counts as read. */
  const markRead = () => {
    if (host.shown() !== 'clan' || !clan || !lines.length) return;
    safeSet(readKey(), String(lines[lines.length - 1].n));
    badges();
  };
  /** The unread count on the Clan tab, in place (the bar is not drawn again for it). */
  const badges = () => {
    const n = unread();
    document.querySelectorAll<HTMLElement>('.nav-unread').forEach((b) => { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; });
  };

  const tagged = (name: string, tag?: string) => el('span', { class: 'who-tag' }, tag ? el('span', { class: 'tag' }, `[${tag}]`) : null, el('span', { class: 'board-name' }, name));
  const tagOf = (name: string) => boards?.tags[name];
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  // --- the Leaderboards screen ---------------------------------------------------------------------------------------------

  /** One row: the place, who, and the score. */
  const row = (n: number | string, who: Node, score: Node, mine: boolean, cls = '') =>
    el('li', { class: `board-row${mine ? ' mine' : ''}${cls ? ` ${cls}` : ''}` }, el('span', { class: 'board-n' }, String(n)), el('span', { class: 'board-who' }, who), el('span', { class: 'board-score' }, score));
  const score = (main: string, rest = '') => el('span', {}, el('b', {}, main), rest ? el('span', { class: 'muted' }, ` · ${rest}`) : null);
  const record = (w: number, l: number) => `${w} W · ${l} L`;
  const empty = (text: string) => el('p', { class: 'muted small' }, boards ? text : 'The boards appear here once the game server answers.');

  function duelsTab(b: Leaderboards, me: string | null) {
    const sub = (s: typeof span, label: string) => el('button', { class: `tab${span === s ? ' on' : ''}`, onclick: () => { span = s; safeSet('boards.span', s); host.render(); } }, label);
    const you = b.you;
    const head = el('div', { class: 'tabs small' }, sub('all', 'Rating, all time'), sub('week', 'Wins this week'));
    if (span === 'all') {
      const rows = b.duels.map((r, i) => row(i + 1, el('span', { class: 'board-who' }, host.heroIcon(r.hero), tagged(r.name, tagOf(r.name))), score(String(r.rating), record(r.wins, r.losses)), r.name === me));
      const own = you && !you.rank ? row('–', el('span', { class: 'board-who' }, host.heroIcon(you.hero), tagged(you.name, tagOf(you.name))),
        score(String(you.rating), you.rated ? record(you.wins, you.losses) : 'no duel counted yet'), true, 'own') : null;
      return el('div', {}, head,
        rows.length || own ? el('ol', { class: 'board-list' }, ...rows, own) : empty('No duel has counted yet. Win one online that lasts 30 seconds and you stand here.'),
        el('p', { class: 'muted small' }, `An Elo rating from online duels: everyone starts at 1000, and a duel moves it at most 32. A duel shorter than ${SHOP.minDuelS} seconds does not count; leaving a duel loses it.`));
    }
    const rows = b.weekly.map((r, i) => row(i + 1, tagged(r.name, tagOf(r.name)), score(`${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`, `${r.losses} L`), r.name === me));
    const own = you && !you.week.rank ? row('–', tagged(you.name, tagOf(you.name)), score(`${you.week.wins} ${you.week.wins === 1 ? 'win' : 'wins'}`, `${you.week.losses} L`), true, 'own') : null;
    return el('div', {}, head,
      rows.length || own ? el('ol', { class: 'board-list' }, ...rows, own) : empty('Nobody has won a duel that counts this week yet.'),
      el('p', { class: 'muted small' }, `The most online duels won this week, Monday to Monday (UTC). A new week in ${host.untilWeek()}.`));
  }

  function raidTab(b: Leaderboards, me: string | null) {
    const names = (n: string[]) => (n.length > 4 ? `${n.slice(0, 4).map((x) => (tagOf(x) ? `[${tagOf(x)}] ${x}` : x)).join(', ')} and ${n.length - 4} more` : n.map((x) => (tagOf(x) ? `[${tagOf(x)}] ${x}` : x)).join(', '));
    return el('div', {},
      b.raid.length ? el('ol', { class: 'board-list' }, ...b.raid.map((r, i) => row(i + 1, el('span', { class: 'board-name', title: r.names.join(', ') }, names(r.names)),
        score(`${r.bosses} ${r.bosses === 1 ? 'boss' : 'bosses'}`, `tier ${r.tier} · ${host.clock(r.seconds)}`), !!me && r.names.includes(me))))
        : empty('No raid with others has beaten a boss yet this week.'),
      el('p', { class: 'muted small' }, `The best raid runs with others this week: most bosses beaten, then the fastest. The same board is on the Raid screen. A new week in ${host.untilWeek()}.`));
  }

  function towerTab(b: Leaderboards, me: string | null) {
    return el('div', {},
      b.tower.length ? el('ol', { class: 'board-list' }, ...b.tower.map((r, i) => row(i + 1, el('span', { class: 'board-who' }, host.heroIcon(r.hero), tagged(r.name, tagOf(r.name))), score(`floor ${r.floor}`, r.hero), r.name === me)))
        : empty('Nobody has reported a floor of this week\'s Tower yet.'),
      el('p', { class: 'muted small' }, 'The highest floors of this week\'s Tower (the Trials). Floors are as each player\'s own game reported them; the Tower is climbed in the browser, so they earn nothing.'));
  }

  function climbTab(b: Leaderboards, me: string | null) {
    const you = b.you;
    const rows = b.climb.map((r, i) => row(i + 1, tagged(r.name, tagOf(r.name)), score(`floor ${r.floor}`, `${r.stars} ★`), r.name === me));
    const own = you && you.climb && !you.climb.rank ? row('–', tagged(you.name, tagOf(you.name)), score(`floor ${you.climb.floor}`, `${you.climb.stars} ★`), true, 'own') : null;
    return el('div', {},
      rows.length || own ? el('ol', { class: 'board-list' }, ...rows, own) : empty('Nobody has reported a floor of the Climb yet.'),
      el('p', { class: 'muted small' }, 'The Climb\'s 50 floors, all time: the highest floor cleared, then the stars of all floors (four a floor). As each player\'s own game reported it: the Climb is played in the browser, so this earns nothing. Log in and your floors are sent when you clear one.'));
  }

  function clansTab(b: Leaderboards) {
    const mine = b.you?.clan;
    return el('div', {},
      b.clans.length ? el('ol', { class: 'board-list' }, ...b.clans.map((r, i) => row(i + 1,
        el('span', { class: 'board-two' }, tagged(r.name, r.tag), el('small', { class: 'muted' }, `${r.members} of ${CLAN.max} members · rating ${r.rating} on average`)),
        score(`${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`), r.id === mine)))
        : empty('No clan has been founded yet. Found one on the Clan screen.'),
      el('p', { class: 'muted small' }, 'Clans by their members\' duel wins this week, then by the average of their ratings.'));
  }

  function boardsScreen() {
    const me = host.me();
    const t = (id: BoardTab, label: string) => el('button', { class: `mode${tab === id ? ' on' : ''}`, 'data-tab': id, onclick: () => { tab = id; safeSet('boards.tab', id); host.render(); } }, el('span', {}, el('b', {}, label)));
    const b = boards;
    return el('div', { class: 'boards-screen' },
      el('section', { class: 'card' },
        el('div', { class: 'hs-roster-head' }, el('h2', {}, 'Leaderboards'), el('span', { class: 'muted small' }, b ? `Week ${b.week.slice(-2)} · a new one in ${host.untilWeek()}` : '')),
        el('div', { class: 'modes boards-tabs' }, t('duels', 'Duels'), t('raid', 'Raid'), t('tower', 'Tower'), t('climb', 'Climb'), t('clans', 'Clans')),
        !b ? empty('') : tab === 'duels' ? duelsTab(b, me) : tab === 'raid' ? raidTab(b, me) : tab === 'tower' ? towerTab(b, me) : tab === 'climb' ? climbTab(b, me) : clansTab(b),
        me ? null : el('p', { class: 'muted small' }, 'Log in to stand on the boards.')));
  }

  // --- the Clan screen: no clan ----------------------------------------------------------------------------------------------

  const listBox = el('div', { class: 'clan-list' });
  const viewBox = el('div', { class: 'clan-view' });
  const nameIn = el('input', { placeholder: 'Clan name', maxlength: CLAN.nameMax, autocomplete: 'off' }) as HTMLInputElement;
  const tagIn = el('input', { placeholder: 'TAG', maxlength: CLAN.tagMax, class: 'code-in', autocomplete: 'off' }) as HTMLInputElement;
  const codeIn = el('input', { placeholder: 'CODE', maxlength: 6, class: 'code-in', autocomplete: 'off' }) as HTMLInputElement;
  const noClanNote = el('div', { class: 'error small' });
  const noClan = el('div', { class: 'clan-none' },
    el('section', { class: 'card' },
      el('h2', {}, 'Clan'),
      el('p', { class: 'muted' }, `A clan is up to ${CLAN.max} players with a tag before their names and a chat of their own. Found one and send its code to your friends, or ask to join one below.`),
      el('div', { class: 'clan-forms' },
        el('form', { class: 'clan-form', onsubmit: (e: Event) => { e.preventDefault(); noClanNote.textContent = ''; net.send({ t: 'clan_create', name: nameIn.value, tag: tagIn.value }); } },
          el('h3', {}, 'Found a clan'),
          el('div', { class: 'row' }, nameIn, tagIn, el('button', { class: 'btn primary', type: 'submit' }, 'Found')),
          el('p', { class: 'muted small' }, `Name: ${CLAN.nameMin}-${CLAN.nameMax} letters, digits and spaces. Tag: ${CLAN.tagMin}-${CLAN.tagMax} letters or digits.`)),
        el('form', { class: 'clan-form', onsubmit: (e: Event) => { e.preventDefault(); noClanNote.textContent = ''; net.send({ t: 'clan_join', code: codeIn.value }); } },
          el('h3', {}, 'Join with a code'),
          el('div', { class: 'row' }, codeIn, el('button', { class: 'btn', type: 'submit' }, 'Join')))),
      noClanNote),
    el('section', { class: 'card' }, el('h3', {}, 'Clans looking for members'), listBox, viewBox));

  function fillList() {
    listBox.replaceChildren(list.length
      ? el('ol', { class: 'board-list' }, ...list.map((r, i) => el('li', { class: `board-row clan-row${view?.id === r.id ? ' mine' : ''}` },
        el('span', { class: 'board-n' }, String(i + 1)),
        el('button', { class: 'board-who linkish', onclick: () => net.send({ t: 'clan_view', id: r.id }) }, tagged(r.name, r.tag)),
        el('span', { class: 'board-score' }, el('b', {}, `${r.members}/${CLAN.max}`), el('span', { class: 'muted' }, ` · ${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`), r.asked ? el('span', { class: 'muted' }, ' · asked') : null))))
      : el('p', { class: 'muted small' }, 'No clan has room right now. Found the first one.'));
  }

  function fillView() {
    if (!view) { viewBox.replaceChildren(); return; }
    const v = view;
    viewBox.replaceChildren(el('div', { class: 'clan-page' },
      el('div', { class: 'clan-page-head' }, el('h3', {}, el('span', { class: 'tag' }, `[${v.tag}]`), ` ${v.name}`),
        el('button', { class: 'btn ghost small', onclick: () => { view = null; fillView(); fillList(); } }, 'Close')),
      el('p', { class: 'muted small' }, `${v.members} of ${v.max} members · ${v.wins} duel ${v.wins === 1 ? 'win' : 'wins'} this week · rating ${v.rating} on average`),
      el('ul', { class: 'member-list' }, ...v.list.map((m) => el('li', { class: 'member' },
        el('span', { class: 'm-name' }, m.name), m.role === 'leader' ? el('span', { class: 'role' }, 'Leader') : null, el('span', { class: 'm-num muted' }, String(m.rating))))),
      el('button', { class: 'btn primary', disabled: v.asked || v.members >= v.max, onclick: () => net.send({ t: 'clan_ask', id: v.id }) },
        v.asked ? 'Asked: the leader decides' : v.members >= v.max ? 'Full' : 'Ask to join')));
  }

  // --- the Clan screen: in a clan --------------------------------------------------------------------------------------------

  const headBox = el('div', { class: 'clan-head' });
  const membersBox = el('div', { class: 'clan-members' });
  const chatList = el('ol', { class: 'chat-list', 'aria-live': 'polite' });
  const chatIn = el('input', { placeholder: 'Message your clan', maxlength: CLAN.chat.max, autocomplete: 'off', enterkeyhint: 'send' }) as HTMLInputElement;
  const chatNote = el('div', { class: 'chat-note small' });
  const chatForm = el('form', {
    class: 'chat-form',
    onsubmit: (e: Event) => {
      e.preventDefault();
      const text = chatIn.value.trim();
      if (!text) return;
      net.send({ t: 'clan_say', text });
      chatIn.value = '';
      chatNote.textContent = '';
    },
  }, chatIn, el('button', { class: 'btn primary', type: 'submit' }, 'Send'));
  const inClan = el('div', { class: 'clan-in' },
    el('section', { class: 'card clan-side' }, headBox, membersBox),
    el('section', { class: 'card clan-chat' }, el('h3', {}, 'Clan chat'), chatList, chatForm, chatNote,
      el('p', { class: 'muted small' }, 'Plain words, 200 characters, one message a second. Tap a name to mute it for yourself; Report sends a message to the game\'s keeper.')));

  /** One line of the room, every word through textContent. */
  function lineEl(l: ChatLine) {
    const me = host.me();
    const when = el('span', { class: 'chat-time muted' }, time(l.at));
    if (l.kind !== 'say') {
      const what: Record<string, string> = {
        found: 'founded the clan', join: 'joined the clan', leave: 'left the clan', remove: `was removed by ${l.by}`,
        lead: l.by ? `leads the clan now (handed on by ${l.by})` : 'leads the clan now', silence: `was muted in the room for ${CLAN.silenceH} h by ${l.by}`,
        unsilence: `may speak again (${l.by})`,
      };
      return el('li', { class: 'chat-line event', 'data-n': l.n }, when, el('span', {}, `${l.name} ${what[l.kind] ?? ''}`));
    }
    const muted = mutes.has(l.name.toLowerCase());
    const li = el('li', { class: `chat-line${l.name === me ? ' own' : ''}`, 'data-n': l.n, 'data-from': l.name.toLowerCase(), hidden: muted },
      when, el('b', { class: 'chat-from' }, l.name), el('span', { class: 'chat-text' }, l.text ?? ''),
      l.name !== me ? el('button', {
        class: 'chat-report', title: 'Report this message', onclick: (e: Event) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.disabled = true;
          net.send({ t: 'clan_report', n: l.n });
        },
      }, 'Report') : null);
    return li;
  }

  /** The room from its lines, scrolled to the newest. */
  function fillChat() {
    chatList.replaceChildren(...lines.map(lineEl));
    if (!lines.length) chatList.append(el('li', { class: 'chat-line event muted' }, 'No messages yet. Say hello.'));
    chatList.scrollTop = chatList.scrollHeight;
  }

  /** The clan's name, numbers, the code and the asks (the leader), and the members with their dots and actions. */
  function fillMembers() {
    const c = clan;
    if (!c) return;
    const me = host.me() ?? '', leads = c.leader === me;
    const parts: Child[] = [
      el('h2', {}, el('span', { class: 'tag' }, `[${c.tag}]`), ` ${c.name}`),
      el('p', { class: 'muted small' }, `${c.members.length} of ${c.max} members · ${c.members.filter((m) => m.online).length} online · ${c.wins} duel ${c.wins === 1 ? 'win' : 'wins'} this week`),
      leads && c.code ? el('div', { class: 'clan-code' },
        el('span', { class: 'muted small' }, 'Invite code'), el('b', { class: 'code' }, c.code),
        el('button', { class: 'btn ghost small', onclick: () => { void navigator.clipboard?.writeText(c.code ?? '').then(() => host.toast('Code copied'), () => undefined); } }, 'Copy'),
        el('button', { class: 'btn ghost small', onclick: () => net.send({ t: 'clan_code' }) }, 'New code')) : null,
      leads && c.asks?.length ? el('div', { class: 'clan-asks' }, el('h3', {}, 'Asking to join'),
        ...c.asks.map((a) => el('div', { class: 'ask-row' }, el('span', { class: 'm-name' }, a),
          el('button', { class: 'btn small primary', onclick: () => net.send({ t: 'clan_answer', name: a, yes: true }) }, 'Accept'),
          el('button', { class: 'btn small ghost', onclick: () => net.send({ t: 'clan_answer', name: a, yes: false }) }, 'Decline')))) : null];
    headBox.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    const act = (label: string, msg: Record<string, unknown>, cls = 'ghost') => el('button', { class: `btn small ${cls}`, onclick: () => { openMember = ''; net.send(msg as { t: string }); } }, label);
    membersBox.replaceChildren(
      el('h3', {}, 'Members'),
      el('ul', { class: 'member-list' }, ...c.members.map((m) => {
        const self = m.name === me, muted = mutes.has(m.name.toLowerCase()), open = openMember === m.name && !self;
        return el('li', { class: `member${open ? ' open' : ''}` },
          el('button', { class: 'member-main', disabled: self, title: self ? '' : 'More', onclick: () => { openMember = open ? '' : m.name; fillMembers(); } },
            el('span', { class: `dot${m.online ? ' on' : ''}`, title: m.online ? 'online' : 'offline' }),
            el('span', { class: 'm-name' }, m.name),
            m.role === 'leader' ? el('span', { class: 'role' }, 'Leader') : null,
            muted ? el('span', { class: 'role off' }, 'muted by you') : null,
            m.silenced ? el('span', { class: 'role off' }, 'muted in the room') : null,
            el('span', { class: 'm-num' }, String(m.rating)), el('span', { class: 'm-num muted' }, `${m.wins} W`)),
          open ? el('div', { class: 'member-acts' },
            act(muted ? 'Unmute for me' : 'Mute for me', { t: 'clan_mute', name: m.name, on: !muted }),
            leads ? act(m.silenced ? 'Let speak' : `Mute in room ${CLAN.silenceH} h`, { t: 'clan_silence', name: m.name, on: !m.silenced }) : null,
            leads ? act('Make leader', { t: 'clan_lead', name: m.name }) : null,
            leads ? act('Remove', { t: 'clan_remove', name: m.name }, 'danger') : null) : null);
      })),
      el('div', { class: 'row clan-leave' }, leaveAsk
        ? el('span', { class: 'row' }, el('span', { class: 'small' }, leads && c.members.length > 1 ? 'Leave? The lead passes to the longest member.' : c.members.length === 1 ? 'Leave? The clan ends with you.' : 'Leave the clan?'),
          el('button', { class: 'btn small danger', onclick: () => { leaveAsk = false; net.send({ t: 'clan_leave' }); } }, 'Leave'),
          el('button', { class: 'btn small ghost', onclick: () => { leaveAsk = false; fillMembers(); } }, 'Stay'))
        : el('button', { class: 'btn small ghost', onclick: () => { leaveAsk = true; fillMembers(); } }, 'Leave the clan')));
  }

  function clanScreen() {
    if (clan === undefined) return el('section', { class: 'card' }, el('h2', {}, 'Clan'), el('p', { class: 'muted' }, 'Asking the game server…'));
    if (!clan) {
      fillList();
      fillView();
      return noClan;
    }
    fillMembers();
    queueMicrotask(() => { chatList.scrollTop = chatList.scrollHeight; markRead(); });
    return inClan;
  }

  // --- the hub's messages ------------------------------------------------------------------------------------------------

  net.on('leaderboards', (m) => {
    boards = m;
    if (host.shown() === 'boards') host.render();
  });
  net.on('clan', (m) => {
    const was = clan === undefined ? undefined : clan?.id ?? null;
    clan = m.clan;
    mutes = new Set(m.mutes);
    if ((clan?.id ?? null) !== was) {
      // Into a clan, out of one, or another: the room starts empty until its history comes; no clan, the list is asked for.
      lines = [];
      leaveAsk = false;
      openMember = '';
      fillChat();
      if (!clan) net.send({ t: 'clan_list' });
      if (host.shown() === 'clan') host.render();
    } else if (host.shown() === 'clan') {
      fillMembers();
      // A mute changed: lines show or hide.
      chatList.querySelectorAll<HTMLElement>('.chat-line[data-from]').forEach((li) => { li.hidden = mutes.has(li.dataset.from ?? ''); });
    }
    badges();
  });
  net.on('clan_history', (m) => {
    if (m.id !== clan?.id) return;
    lines = m.lines;
    fillChat();
    markRead();
    badges();
  });
  net.on('clan_chat', (m) => {
    if (m.id !== clan?.id) return;
    lines = [...lines, m.line].slice(-CLAN.chat.keep);
    const near = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 60;
    chatList.querySelector('.chat-line.event.muted:not([data-n])')?.remove();
    chatList.append(lineEl(m.line));
    while (chatList.children.length > CLAN.chat.keep) chatList.firstElementChild?.remove();
    if (near || m.line.name === host.me()) chatList.scrollTop = chatList.scrollHeight;
    markRead();
    badges();
  });
  net.on('clan_list', (m) => {
    list = m.clans;
    if (view) view = { ...view, asked: list.find((r) => r.id === view?.id)?.asked ?? view.asked };
    fillList();
    fillView();
  });
  net.on('clan_view', (m) => {
    view = m.clan;
    fillView();
    fillList();
  });
  net.on('clan_error', (m) => {
    if (host.shown() === 'clan' && clan) chatNote.textContent = m.error;
    else if (host.shown() === 'clan') noClanNote.textContent = m.error;
    else host.toast(m.error);
  });
  net.on('clan_notice', (m) => host.toast(m.text));
  net.on('session', () => { clan = undefined; net.send({ t: 'clan_get' }); });
  net.on('logged_out', () => { clan = undefined; lines = []; list = []; view = null; badges(); });

  return {
    boardsScreen,
    clanScreen,
    unread,
    /** The screen opened: what it shows, asked for again. */
    opened(screen: 'boards' | 'clan') {
      if (screen === 'boards') net.send({ t: 'leaderboards' });
      else if (host.me()) {
        net.send({ t: 'clan_get' });
        if (!clan) net.send({ t: 'clan_list' });
      }
    },
    /** Back on the menus after a fight: the count of what came meanwhile. */
    badges,
    markRead,
  };
}
