// Local accounts for the duel game and the stats the profile page shows. Storage is pluggable so the same code runs
// in Node (a JSON file, `fileStore` in game-server.mjs) and in a Cloudflare Durable Object (its SQLite storage,
// worker/index.mjs). Passwords: PBKDF2-SHA256 through Web Crypto (in both runtimes), per-user salt. No external auth.

const NAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
const HISTORY = 20;
// Workers cap PBKDF2 at 100 000 iterations.
const ITERATIONS = 100000;

/**
 * @typedef {{ played: number, wins: number }} HeroStats
 * @typedef {{ at: string, hero: string, foe: string, foeHero: string, result: 'win' | 'loss', seconds: number, reason: string }} MatchRecord
 * @typedef {{ name: string, salt: string, hash: string, algo?: 'pbkdf2' | 'scrypt', created: string, wins: number, losses: number,
 *   matches: number, heroes: Record<string, HeroStats>, history: MatchRecord[] }} Account
 * @typedef {{ load(): Record<string, Account>, put(key: string, account: Account): void }} AccountStore
 */

export class Accounts {
  /** @param {AccountStore} store */
  constructor(store) {
    this.store = store;
    /** @type {Record<string, Account>} keyed by lower-case name */
    this.users = store.load();
  }

  /** @param {Account} a */
  save(a) {
    this.store.put(a.name.toLowerCase(), a);
  }

  /** @param {string} name @param {string} password @returns {Promise<{ account?: Account, error?: string }>} */
  async register(name, password) {
    if (typeof name !== 'string' || !NAME_RE.test(name)) return { error: 'Name: 3-16 letters, digits, _ or -' };
    if (typeof password !== 'string' || password.length < 4 || password.length > 64) return { error: 'Password: 4-64 characters' };
    const key = name.toLowerCase();
    if (this.users[key]) return { error: 'That name is taken' };
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    /** @type {Account} */
    const account = {
      name, salt, hash: await pbkdf2(password, salt), algo: 'pbkdf2', created: new Date().toISOString(),
      wins: 0, losses: 0, matches: 0, heroes: {}, history: [],
    };
    if (this.users[key]) return { error: 'That name is taken' }; // registered while we hashed
    this.users[key] = account;
    this.save(account);
    return { account };
  }

  /** @param {string} name @param {string} password @returns {Promise<{ account?: Account, error?: string }>} */
  async login(name, password) {
    const account = typeof name === 'string' ? this.users[name.toLowerCase()] : undefined;
    if (!account || typeof password !== 'string') return { error: 'Wrong name or password' };
    if (account.algo === 'pbkdf2') {
      if (!same(account.hash, await pbkdf2(password, account.salt))) return { error: 'Wrong name or password' };
      return { account };
    }
    // Accounts made before the Cloudflare port used Node's scrypt: check it (Node only), then re-hash with PBKDF2.
    const legacy = await scrypt(password, account.salt);
    if (!legacy || !same(account.hash, legacy)) return { error: legacy ? 'Wrong name or password' : 'This account needs a new password' };
    account.salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    account.hash = await pbkdf2(password, account.salt);
    account.algo = 'pbkdf2';
    this.save(account);
    return { account };
  }

  /** @param {string} name */
  get(name) {
    return this.users[name.toLowerCase()];
  }

  /** Records one finished match for a player and stores the account. @param {string} name @param {MatchRecord} rec */
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
    this.save(a);
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

/** @param {Uint8Array} bytes */
export function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} password @param {string} salt */
async function pbkdf2(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(new Uint8Array(bits));
}

/** Node's scrypt for accounts from before the port; null where node:crypto has no scrypt. @param {string} password @param {string} salt */
async function scrypt(password, salt) {
  try {
    const { scryptSync } = await import('node:crypto');
    return scryptSync(password, salt, 32).toString('hex');
  } catch {
    return null;
  }
}

/** Constant-time compare of two hex strings. @param {string} a @param {string} b */
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
