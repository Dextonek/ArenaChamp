// Clans and their chat rooms (docs/architecture/multiplayer.md, "Leaderboards and clans"): the rules, and what is kept. The hub
// (hub.mjs) decides who hears what; this file only knows clans, members and lines.
//
// Kept in the accounts' store, as its small records (`getMeta` / `putMeta`, so a Durable Object's SQLite storage and the Node JSON
// file both hold them with no change to either host): `clans`, the list of clan ids; `clan:<id>`, one clan; `chat:<id>`, its room's
// last `CLAN.chat.keep` lines. A clan that is gone has its two records written as null. Membership is kept in the clan only; who is
// in which clan is worked out in memory when the store is opened.
import { hex } from './accounts.mjs';
import { clean, dirty } from './filter.mjs';
import { CLAN, CLAN_NAME_RE, CLAN_TAG_RE, clanName } from './protocol.mjs';

/** Invite codes: six of these (no 0/O, 1/I). */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

/**
 * @typedef {{ id: string, name: string, tag: string, leader: string, members: string[], code: string, asks: string[],
 *   silenced: Record<string, number>, created: string, seq: number }} Clan
 *   `members`: account names as registered, the founder first, then in the order they came. `asks`: who asked to join from the clan's
 *   page, for the leader to answer. `silenced`: lower-case name → until when (ms) the leader muted that member in the room. `seq`: the
 *   number of the room's last line.
 * @typedef {{ n: number, at: string, kind: 'say' | 'found' | 'join' | 'leave' | 'remove' | 'lead' | 'silence' | 'unsilence', name: string,
 *   text?: string, by?: string }} ChatLine
 *   One line of a room: a message (`say`, with its `text`), or what happened to `name` (`by`: the leader who did it).
 * @typedef {{ error: string } | { clan: Clan, lines: ChatLine[] }} Result
 */

export class Clans {
  /** @param {import('./accounts.mjs').Accounts} accounts */
  constructor(accounts) {
    this.accounts = accounts;
    /** @type {Map<string, Clan>} */
    this.byId = new Map();
    /** lower-case member name → clan @type {Map<string, Clan>} */
    this.byMember = new Map();
    /** @type {Map<string, Clan>} */
    this.byCode = new Map();
    /** The rooms' lines, read from the store once each. @type {Map<string, ChatLine[]>} */
    this.chats = new Map();
    /** When each sender's last messages went out (ms), for the rate limit. In memory only. @type {Map<string, number[]>} */
    this.sent = new Map();
    for (const id of accounts.meta('clans') ?? []) {
      const c = accounts.meta(`clan:${id}`);
      if (c?.members?.length) this.index(c);
    }
    // The boards and the profile show a member's clan.
    accounts.clanOf = (name) => this.of(name);
  }

  /** @param {Clan} c */
  index(c) {
    this.byId.set(c.id, c);
    this.byCode.set(c.code, c);
    for (const m of c.members) this.byMember.set(m.toLowerCase(), c);
  }

  /** The clan a player is in, or null. @param {string} name */
  of(name) {
    return this.byMember.get(name.toLowerCase()) ?? null;
  }

  /** @param {unknown} id */
  get(id) {
    return this.byId.get(String(id)) ?? null;
  }

  all() {
    return [...this.byId.values()];
  }

  /** @param {Clan} c */
  save(c) {
    this.accounts.setMeta(`clan:${c.id}`, c);
  }

  saveIndex() {
    this.accounts.setMeta('clans', [...this.byId.keys()]);
  }

  /** A room's lines, oldest first. @param {string} id @returns {ChatLine[]} */
  history(id) {
    let lines = this.chats.get(id);
    if (!lines) this.chats.set(id, (lines = this.accounts.meta(`chat:${id}`) ?? []));
    return lines;
  }

  /**
   * A line onto a clan's room, kept: the room holds its last `CLAN.chat.keep`.
   * @param {Clan} c @param {ChatLine['kind']} kind @param {string} name @param {{ text?: string, by?: string }} [more] @param {number} [now]
   */
  line(c, kind, name, more = {}, now = Date.now()) {
    c.seq = (c.seq ?? 0) + 1;
    /** @type {ChatLine} */
    const l = { n: c.seq, at: new Date(now).toISOString(), kind, name, ...more };
    const lines = [...this.history(c.id), l].slice(-CLAN.chat.keep);
    this.chats.set(c.id, lines);
    this.accounts.setMeta(`chat:${c.id}`, lines);
    return l;
  }

  /** A member's name as the clan keeps it, or null. @param {Clan} c @param {unknown} name */
  member(c, name) {
    return typeof name === 'string' ? c.members.find((m) => m.toLowerCase() === name.toLowerCase()) ?? null : null;
  }

  /** @param {string} name @param {unknown} rawName @param {unknown} rawTag @returns {Result} */
  create(name, rawName, rawTag) {
    if (this.of(name)) return { error: 'You are in a clan already: leave it first' };
    const title = clanName(rawName), tag = typeof rawTag === 'string' ? rawTag.trim().toUpperCase() : '';
    if (!CLAN_NAME_RE.test(title)) return { error: `Clan name: ${CLAN.nameMin}-${CLAN.nameMax} letters, digits and spaces` };
    if (!CLAN_TAG_RE.test(tag)) return { error: `Tag: ${CLAN.tagMin}-${CLAN.tagMax} letters or digits` };
    if (dirty(title) || dirty(tag)) return { error: 'Choose another name' };
    for (const o of this.byId.values()) {
      if (o.name.toLowerCase() === title.toLowerCase()) return { error: 'That clan name is taken' };
      if (o.tag === tag) return { error: `The tag [${tag}] is taken` };
    }
    let id = hex(crypto.getRandomValues(new Uint8Array(4)));
    while (this.byId.has(id)) id = hex(crypto.getRandomValues(new Uint8Array(4)));
    let code = newCode();
    while (this.byCode.has(code)) code = newCode();
    /** @type {Clan} */
    const c = { id, name: title, tag, leader: name, members: [name], code, asks: [], silenced: {}, created: new Date().toISOString(), seq: 0 };
    this.unask(name);
    this.index(c);
    this.save(c);
    this.saveIndex();
    return { clan: c, lines: [this.line(c, 'found', name)] };
  }

  /** In, by the clan's invite code. @param {string} name @param {unknown} code @returns {Result} */
  join(name, code) {
    if (this.of(name)) return { error: 'You are in a clan already: leave it first' };
    const c = typeof code === 'string' ? this.byCode.get(code.trim().toUpperCase()) : undefined;
    if (!c) return { error: 'No clan has that code' };
    if (c.members.length >= CLAN.max) return { error: `${c.name} is full (${CLAN.max})` };
    return this.add(c, name);
  }

  /** @param {Clan} c @param {string} name @returns {Result} */
  add(c, name) {
    c.members.push(name);
    this.byMember.set(name.toLowerCase(), c);
    this.unask(name);
    this.save(c);
    return { clan: c, lines: [this.line(c, 'join', name)] };
  }

  /** A player's asks to join, out of every clan (it joined one). @param {string} name */
  unask(name) {
    const low = name.toLowerCase();
    for (const c of this.byId.values()) {
      if (!c.asks.some((a) => a.toLowerCase() === low)) continue;
      c.asks = c.asks.filter((a) => a.toLowerCase() !== low);
      this.save(c);
    }
  }

  /** Asks to join from the clan's page; the leader answers. @param {string} name @param {unknown} id @returns {{ error?: string, clan?: Clan }} */
  ask(name, id) {
    if (this.of(name)) return { error: 'You are in a clan already: leave it first' };
    const c = this.get(id);
    if (!c) return { error: 'That clan is gone' };
    if (c.members.length >= CLAN.max) return { error: `${c.name} is full (${CLAN.max})` };
    if (c.asks.some((a) => a.toLowerCase() === name.toLowerCase())) return { clan: c };
    if (c.asks.length >= CLAN.asks) return { error: `${c.name} has too many asks waiting: try its invite code` };
    c.asks.push(name);
    this.save(c);
    return { clan: c };
  }

  /** The leader lets an asker in, or not. @param {string} leader @param {unknown} who @param {boolean} yes @returns {{ error: string } | { clan: Clan, lines: ChatLine[] }} */
  answer(leader, who, yes) {
    const c = this.led(leader);
    if (!c) return { error: 'Only the leader can answer' };
    const asker = typeof who === 'string' ? c.asks.find((a) => a.toLowerCase() === who.toLowerCase()) : undefined;
    if (!asker) return { error: 'Nobody of that name is asking' };
    c.asks = c.asks.filter((a) => a !== asker);
    this.save(c);
    if (!yes) return { clan: c, lines: [] };
    if (this.of(asker)) return { error: `${asker} is in a clan now` };
    if (c.members.length >= CLAN.max) return { error: `The clan is full (${CLAN.max})` };
    return this.add(c, asker);
  }

  /** The clan this player leads, or null. @param {string} name */
  led(name) {
    const c = this.of(name);
    return c && c.leader.toLowerCase() === name.toLowerCase() ? c : null;
  }

  /**
   * Out of its clan. A leader who leaves hands the lead to the member who has been in longest; the last one out ends the clan.
   * @param {string} name @returns {{ error: string } | { clan: Clan, lines: ChatLine[], gone: boolean }}
   */
  leave(name) {
    const c = this.of(name);
    if (!c) return { error: 'You are in no clan' };
    return this.out(c, name, 'leave');
  }

  /** @param {Clan} c @param {string} name @param {'leave' | 'remove'} kind @param {string} [by] */
  out(c, name, kind, by) {
    const low = name.toLowerCase();
    c.members = c.members.filter((m) => m.toLowerCase() !== low);
    this.byMember.delete(low);
    delete c.silenced[low];
    if (!c.members.length) {
      this.end(c);
      return { clan: c, lines: [], gone: true };
    }
    const lines = [this.line(c, kind, name, by ? { by } : {})];
    if (c.leader.toLowerCase() === low) {
      c.leader = c.members[0];
      lines.push(this.line(c, 'lead', c.leader));
    }
    this.save(c);
    return { clan: c, lines, gone: false };
  }

  /** A clan with no members is gone, its room with it. @param {Clan} c */
  end(c) {
    this.byId.delete(c.id);
    this.byCode.delete(c.code);
    this.chats.delete(c.id);
    this.accounts.setMeta(`clan:${c.id}`, null);
    this.accounts.setMeta(`chat:${c.id}`, null);
    this.saveIndex();
  }

  /** The leader puts a member out. @param {string} leader @param {unknown} who */
  remove(leader, who) {
    const c = this.led(leader);
    if (!c) return { error: 'Only the leader can remove a member' };
    const m = this.member(c, who);
    if (!m || m === c.leader) return { error: 'No such member' };
    return this.out(c, m, 'remove', c.leader);
  }

  /** The leader hands the lead to another member. @param {string} leader @param {unknown} who @returns {Result} */
  lead(leader, who) {
    const c = this.led(leader);
    if (!c) return { error: 'Only the leader can hand the lead on' };
    const m = this.member(c, who);
    if (!m || m === c.leader) return { error: 'No such member' };
    c.leader = m;
    this.save(c);
    return { clan: c, lines: [this.line(c, 'lead', m, { by: leader })] };
  }

  /** A new invite code: the old one stops working. @param {string} leader @returns {{ error: string } | { clan: Clan }} */
  recode(leader) {
    const c = this.led(leader);
    if (!c) return { error: 'Only the leader can make a new code' };
    this.byCode.delete(c.code);
    let code = newCode();
    while (this.byCode.has(code)) code = newCode();
    c.code = code;
    this.byCode.set(code, c);
    this.save(c);
    return { clan: c };
  }

  /**
   * The leader mutes a member in the room for `CLAN.silenceH` hours, or lets it speak again.
   * @param {string} leader @param {unknown} who @param {boolean} on @param {number} [now] @returns {Result}
   */
  silence(leader, who, on, now = Date.now()) {
    const c = this.led(leader);
    if (!c) return { error: 'Only the leader can mute a member in the room' };
    const m = this.member(c, who);
    if (!m || m === c.leader) return { error: 'No such member' };
    if (on) c.silenced[m.toLowerCase()] = now + CLAN.silenceH * 3600000;
    else delete c.silenced[m.toLowerCase()];
    this.save(c);
    return { clan: c, lines: [this.line(c, on ? 'silence' : 'unsilence', m, { by: leader }, now)] };
  }

  /** Until when (ms) the leader muted this member, or 0. @param {Clan} c @param {string} name @param {number} [now] */
  silencedUntil(c, name, now = Date.now()) {
    const until = c.silenced?.[name.toLowerCase()] ?? 0;
    return until > now ? until : 0;
  }

  /**
   * A message into the clan's room: plain text, at most `CLAN.chat.max` characters, the listed words starred, and not faster than
   * one a second and ten in 20 s from one sender (a refused one does not count).
   * @param {string} name @param {unknown} raw @param {number} [now] @returns {{ error: string } | { clan: Clan, lines: ChatLine[] }}
   */
  say(name, raw, now = Date.now()) {
    const c = this.of(name);
    if (!c) return { error: 'You are in no clan' };
    // Plain text on one line: control characters become spaces.
    const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (!text) return { error: 'Nothing to send' };
    if (text.length > CLAN.chat.max) return { error: `At most ${CLAN.chat.max} characters` };
    const until = this.silencedUntil(c, name, now);
    if (until) return { error: `The leader muted you in this room until ${new Date(until).toISOString().slice(11, 16)} UTC` };
    const low = name.toLowerCase(), r = CLAN.chat;
    const times = (this.sent.get(low) ?? []).filter((t) => t > now - r.windowMs);
    this.sent.set(low, times);
    if (times.length && now - times[times.length - 1] < r.gapMs) return { error: 'Slow down: one message a second' };
    if (times.length >= r.inWindow) return { error: `Slow down: at most ${r.inWindow} messages in ${r.windowMs / 1000} seconds` };
    times.push(now);
    return { clan: c, lines: [this.line(c, 'say', name, { text: clean(text) }, now)] };
  }
}
