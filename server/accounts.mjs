// Local accounts for the duel game: one JSON file (server/data/accounts.json, git-ignored), scrypt password
// hashes, and the stats the profile page shows. No external auth, no e-mail, nothing leaves this machine.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const NAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
const HISTORY = 20;

/**
 * @typedef {{ played: number, wins: number }} HeroStats
 * @typedef {{ at: string, hero: string, foe: string, foeHero: string, result: 'win' | 'loss', seconds: number, reason: string }} MatchRecord
 * @typedef {{ name: string, salt: string, hash: string, created: string, wins: number, losses: number, matches: number,
 *   heroes: Record<string, HeroStats>, history: MatchRecord[] }} Account
 */

export class Accounts {
  /** @param {string} file */
  constructor(file) {
    this.file = file;
    /** @type {Record<string, Account>} keyed by lower-case name */
    this.users = {};
    if (existsSync(file)) {
      try { this.users = JSON.parse(readFileSync(file, 'utf8')).users ?? {}; }
      catch (e) { console.error(`[game] could not read ${file}, starting empty`, e); }
    }
  }

  save() {
    mkdirSync(dirname(this.file), { recursive: true });
    // Several servers can share one file (the dev server, a second dev port, the standalone one): keep accounts
    // another server added since we loaded. Accounts this server knows are written as it has them.
    if (existsSync(this.file)) {
      try {
        const disk = JSON.parse(readFileSync(this.file, 'utf8')).users ?? {};
        for (const [key, account] of Object.entries(disk)) if (!this.users[key]) this.users[key] = /** @type {Account} */ (account);
      } catch { /* unreadable: overwrite with what we have */ }
    }
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ users: this.users }, null, 2));
    renameSync(tmp, this.file);
  }

  /** @param {string} name @param {string} password @returns {{ account?: Account, error?: string }} */
  register(name, password) {
    if (typeof name !== 'string' || !NAME_RE.test(name)) return { error: 'Name: 3-16 letters, digits, _ or -' };
    if (typeof password !== 'string' || password.length < 4 || password.length > 64) return { error: 'Password: 4-64 characters' };
    const key = name.toLowerCase();
    if (this.users[key]) return { error: 'That name is taken' };
    const salt = randomBytes(16).toString('hex');
    /** @type {Account} */
    const account = {
      name, salt, hash: hash(password, salt), created: new Date().toISOString(),
      wins: 0, losses: 0, matches: 0, heroes: {}, history: [],
    };
    this.users[key] = account;
    this.save();
    return { account };
  }

  /** @param {string} name @param {string} password @returns {{ account?: Account, error?: string }} */
  login(name, password) {
    const account = typeof name === 'string' ? this.users[name.toLowerCase()] : undefined;
    if (!account || typeof password !== 'string') return { error: 'Wrong name or password' };
    const a = Buffer.from(account.hash, 'hex'), b = Buffer.from(hash(password, account.salt), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'Wrong name or password' };
    return { account };
  }

  /** @param {string} name */
  get(name) {
    return this.users[name.toLowerCase()];
  }

  /**
   * Records one finished match for a player.
   * @param {string} name @param {MatchRecord} rec
   */
  record(name, rec) {
    const a = this.get(name);
    if (!a) return;
    a.matches++;
    if (rec.result === 'win') a.wins++; else a.losses++;
    const h = (a.heroes[rec.hero] ??= { played: 0, wins: 0 });
    h.played++;
    if (rec.result === 'win') h.wins++;
    a.history.unshift(rec);
    a.history.length = Math.min(a.history.length, HISTORY);
  }

  /** What the client sees (no hash or salt). @param {Account} a */
  profile(a) {
    let favourite = null, best = { played: 0, wins: -1 };
    for (const [hero, s] of Object.entries(a.heroes)) {
      if (s.played > best.played || (s.played === best.played && s.wins > best.wins)) { favourite = hero; best = s; }
    }
    return {
      name: a.name, created: a.created, wins: a.wins, losses: a.losses, matches: a.matches,
      favourite, heroes: a.heroes, history: a.history,
    };
  }
}

/** @param {string} password @param {string} salt */
function hash(password, salt) {
  return scryptSync(password, salt, 32).toString('hex');
}
