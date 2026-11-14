// Local accounts for the duel game and the stats the profile page shows. Storage is pluggable so the same code runs
// in Node (a JSON file, `fileStore` in game-server.mjs) and in a Cloudflare Durable Object (its SQLite storage,
// worker/index.mjs). Passwords: PBKDF2-SHA256 through Web Crypto (in both runtimes), per-user salt. No external auth.
// Also here: the hero shop's side of an account (obols, the heroes it owns, the founders; pipeline/designs/hero-shop.md)
// and the week's boards. Both stores keep a few small records beside the accounts (`getMeta` / `putMeta`): the day the
// shop arrived, and the boards.
import { BOARD_SIZE, CLIMB_FLOORS, ELO, HERO_SHOP, LEADER_SIZE, RAID_RUN, SHOP, STARTERS, heroPrice, isoWeek, raidRank, shopRotation } from './protocol.mjs';

const NAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
const HISTORY = 20;
// Workers cap PBKDF2 at 100 000 iterations.
const ITERATIONS = 100000;

/**
 * @typedef {{ played: number, wins: number }} HeroStats
 * @typedef {{ at: string, hero: string, from?: string, foe: string, foeHero: string, result: 'win' | 'loss', seconds: number, reason: string,
 *   rounds?: number[] }} MatchRecord
 * @typedef {{ name: string, salt: string, hash: string, algo?: 'pbkdf2' | 'scrypt', created: string, wins: number, losses: number,
 *   matches: number, heroes: Record<string, HeroStats>, history: MatchRecord[],
 *   raids?: { played: number, cleared: number, bosses?: number, tier?: number, best: number, others?: number },
 *   obols?: number, owned?: string[], firstWin?: string, tower?: { week: string, floor: number, hero: string },
 *   rating?: number, rated?: number, duelWeek?: { week: string, wins: number, losses: number }, climb?: { floor: number, stars: number, at: string },
 *   mutes?: string[] }} Account
 *   `raids.others`: the most bosses beaten in one run with others (the raid rank comes from it). `obols`: the shop's currency
 *   (an account from before the shop has none stored and counts as `SHOP.start`). `owned`: heroes bought. `firstWin`: the UTC
 *   day the first win of a day was last paid. `tower`: the highest floor this account reported in a week.
 *   Since the leaderboards (PROTOCOL 17), each read with a default, as older accounts have none: `rating` (Elo, `ELO.start`) and
 *   `rated` (the duels that moved it); `duelWeek`: the duels that counted in one week; `climb`: the highest Climb floor cleared and the
 *   stars of all floors, as the page reported them; `mutes`: the lower-case names whose clan-chat lines this player does not get.
 * @typedef {{ load(): Record<string, Account>, put(key: string, account: Account): void,
 *   getMeta?(key: string): any, putMeta?(key: string, value: any): void }} AccountStore
 *   `getMeta` / `putMeta`: small records beside the accounts, by name. A store without them keeps them in memory only.
 * @typedef {{ bosses: number, tier: number, seconds: number, names: string[], at: string }} RaidRow
 * @typedef {{ name: string, floor: number, hero: string, at: string }} TowerRow
 * @typedef {{ week: string, raid: RaidRow[], tower: TowerRow[] }} Boards
 * @typedef {{ name: string, wins: number, losses: number, at: string }} WeekRow
 * @typedef {{ name: string, floor: number, stars: number, at: string }} ClimbRow
 */

export class Accounts {
  /** @param {AccountStore} store */
  constructor(store) {
    this.store = store;
    /** @type {Record<string, Account>} keyed by lower-case name */
    this.users = store.load();
    /** The store's small records, read once each. @type {Map<string, any>} */
    this.metas = new Map();
    /** Whether heroes are locked behind the shop (the hub's `shop` switch): off, every account plays every hero. */
    this.shop = false;
    /** The accounts with a duel rating, highest first: built once from the accounts, then kept in order as duels end. @type {Account[] | null} */
    this.ratedList = null;
    /** The clan a player is in (set by clans.mjs). @type {(name: string) => { id: string, name: string, tag: string } | null} */
    this.clanOf = (/** @type {string} */ _name) => null;
  }

  /**
   * A small record beside the accounts. `fresh`: read from the store again (the boards: two dev servers may share one file).
   * @param {string} key @param {boolean} [fresh]
   */
  meta(key, fresh = false) {
    if (!this.metas.has(key) || (fresh && this.store.getMeta)) this.metas.set(key, this.store.getMeta?.(key) ?? this.metas.get(key) ?? null);
    return this.metas.get(key);
  }

  /** @param {string} key @param {any} value */
  setMeta(key, value) {
    this.metas.set(key, value);
    this.store.putMeta?.(key, value);
  }

  // --- the hero shop --------------------------------------------------------------------------------------------

  /**
   * The shop is on in this hub. The first time a store is opened with it on, the moment is written down, with the heroes
   * there were: every account made before it is a founder, and owns all of those (they have been playing them). Written once,
   * never moved: a later hero is not a founder's by right.
   * @param {number} [now] ms
   */
  openShop(now = Date.now()) {
    this.shop = true;
    if (!this.meta('shop')) this.setMeta('shop', { since: new Date(now).toISOString(), heroes: Object.keys(HERO_SHOP) });
  }

  /** An account from before the shop arrived. @param {Account} a */
  founder(a) {
    const mark = this.meta('shop');
    return !!mark && a.created < mark.since;
  }

  /** The heroes an account owns for good: the starters, what it bought, and a founder's first roster. @param {Account} a @returns {string[]} */
  owned(a) {
    return [...new Set([...STARTERS, ...(this.founder(a) ? this.meta('shop').heroes : []), ...(a.owned ?? [])])];
  }

  /** @param {Account} a */
  obols(a) {
    return a.obols ?? SHOP.start;
  }

  /**
   * Why this account may not take this hero into a fight with others now, or '' when it may: with the shop on, a hero must be
   * in the table, and owned or one of the week's free six.
   * @param {Account} a @param {string} hero @param {number} [now] ms
   */
  locked(a, hero, now = Date.now()) {
    if (!this.shop) return '';
    if (!Object.hasOwn(HERO_SHOP, hero)) return `${hero} is not a hero`;
    if (this.owned(a).includes(hero) || shopRotation(isoWeek(now).id).includes(hero)) return '';
    return `${hero} is locked: buy it in the Shop, or try it against the CPU`;
  }

  /**
   * Buys a hero with the account's obols. It cannot be undone.
   * @param {Account} a @param {unknown} hero @param {number} [now] ms @returns {{ error?: string, price?: number }}
   */
  buy(a, hero, now = Date.now()) {
    if (!this.shop) return { error: 'The shop is closed: every hero is free' };
    if (typeof hero !== 'string' || !Object.hasOwn(HERO_SHOP, hero)) return { error: 'No such hero in the shop' };
    if (this.owned(a).includes(hero)) return { error: `You already own ${hero}` };
    const price = heroPrice(hero, now), have = this.obols(a);
    if (have < price) return { error: `Not enough obols: ${hero} costs ${price}, you have ${have}` };
    a.obols = have - price;
    a.owned = [...(a.owned ?? []), hero];
    this.save(a);
    return { price };
  }

  /** Pays obols to an account; its new total. @param {string} name @param {number} amount */
  pay(name, amount) {
    const a = this.get(name);
    if (!a || !(amount > 0)) return a ? this.obols(a) : 0;
    a.obols = this.obols(a) + Math.round(amount);
    this.save(a);
    return a.obols;
  }

  /**
   * The first win of the server's UTC day: true once a day for an account, and that day is then written down (the caller
   * pays, and so saves).
   * @param {string} name @param {string} day "2026-11-12"
   */
  firstWin(name, day) {
    const a = this.get(name);
    if (!a || a.firstWin === day) return false;
    a.firstWin = day;
    return true;
  }

  // --- the Raid's ranks and the week's boards -----------------------------------------------------------------

  /**
   * The most bosses an account has beaten in one run with others. Before raids for a party every raid through the hub was for
   * two, so a founder's older best counts.
   * @param {Account} a
   */
  withOthers(a) {
    return a.raids?.others ?? (this.founder(a) ? a.raids?.bosses ?? 0 : 0);
  }

  /** A boss fell to a party this player is in: its bosses with others so far in this run. @param {string} name @param {number} bosses */
  raidWith(name, bosses) {
    const a = this.get(name);
    if (!a || bosses <= this.withOthers(a)) return;
    const r = (a.raids ??= { played: 0, cleared: 0, bosses: 0, tier: 0, best: 0 });
    r.others = bosses;
    this.save(a);
  }

  /** This week's boards, as kept: a new week starts them empty. @param {string} week @returns {Boards} */
  boards(week) {
    const b = this.meta('boards', true);
    return b && b.week === week ? b : { week, raid: [], tower: [] };
  }

  /**
   * A run with others ended: onto the week's raid board if it is among the best (bosses beaten, then the time). One party
   * holds one row, its best.
   * @param {string} week @param {RaidRow} row
   */
  boardRaid(week, row) {
    const b = this.boards(week), party = (/** @type {RaidRow} */ r) => [...r.names].sort().join('|');
    const better = (/** @type {RaidRow} */ x, /** @type {RaidRow} */ y) => y.bosses - x.bosses || x.seconds - y.seconds;
    const old = b.raid.find((r) => party(r) === party(row));
    if (old && better(old, row) <= 0) return;
    b.raid = [...b.raid.filter((r) => r !== old), row].sort(better).slice(0, BOARD_SIZE);
    this.setMeta('boards', b);
  }

  /**
   * A logged-in player's own report of the floor it reached in the week's Tower. NOT VERIFIED: the Tower runs in the page
   * with no server, so this is the page's word, and nothing is earned by it. Only a higher floor than the account's last
   * report this week counts; true when it did.
   * @param {string} name @param {string} week @param {number} floor @param {string} hero @param {number} [now] ms
   */
  boardTower(name, week, floor, hero, now = Date.now()) {
    const a = this.get(name);
    if (!a || (a.tower?.week === week && a.tower.floor >= floor)) return false;
    a.tower = { week, floor, hero };
    this.save(a);
    const b = this.boards(week);
    b.tower = [...b.tower.filter((r) => r.name !== a.name), { name: a.name, floor, hero, at: new Date(now).toISOString() }]
      .sort((x, y) => y.floor - x.floor || x.at.localeCompare(y.at)).slice(0, BOARD_SIZE);
    this.setMeta('boards', b);
    return true;
  }

  // --- the duel rating, the week's duel wins and the Climb (the Leaderboards screen) -----------------------------

  /** @param {Account} a */
  rating(a) {
    return a.rating ?? ELO.start;
  }

  /** The duels that counted for an account in a week. @param {Account} a @param {string} week */
  weekOf(a, week) {
    return a.duelWeek?.week === week ? a.duelWeek : { week, wins: 0, losses: 0 };
  }

  /** The rated accounts, highest first (the first call builds the list: one pass over the accounts, then never again). */
  rated() {
    if (!this.ratedList) this.ratedList = Object.values(this.users).filter((a) => (a.rated ?? 0) > 0).sort(byRating);
    return this.ratedList;
  }

  /**
   * A duel that counts (as it would pay: long enough) moves both ratings (Elo, K `ELO.k`) and goes on the week's wins. Both accounts
   * are stored here. Returns the change for the winner (the loser's is the same, taken off).
   * @param {string} winner @param {string} loser @param {string} week @param {number} [now] ms
   */
  rateDuel(winner, loser, week, now = Date.now()) {
    const w = this.get(winner), l = this.get(loser);
    if (!w || !l) return 0;
    const expect = 1 / (1 + 10 ** ((this.rating(l) - this.rating(w)) / 400));
    const change = Math.round(ELO.k * (1 - expect));
    const list = this.rated();
    for (const [a, d] of /** @type {[Account, number][]} */ ([[w, change], [l, -change]])) {
      if (!(a.rated ?? 0)) list.push(a);
      a.rating = this.rating(a) + d;
      a.rated = (a.rated ?? 0) + 1;
      const wk = this.weekOf(a, week);
      a.duelWeek = { week, wins: wk.wins + (a === w ? 1 : 0), losses: wk.losses + (a === l ? 1 : 0) };
      this.save(a);
    }
    list.sort(byRating);
    // The week's board by wins: kept, as wins only grow in a week (a new week starts it empty).
    const b = this.weekBoard(week), at = new Date(now).toISOString();
    for (const a of [w, l]) {
      const old = b.rows.find((r) => r.name === a.name), wk = this.weekOf(a, week);
      if (old) Object.assign(old, { wins: wk.wins, losses: wk.losses, at: a === w ? at : old.at });
      else if (a === w) b.rows.push({ name: a.name, wins: wk.wins, losses: wk.losses, at });
    }
    b.rows = b.rows.sort((x, y) => y.wins - x.wins || x.at.localeCompare(y.at)).slice(0, LEADER_SIZE);
    this.setMeta('duelweek', b);
    return change;
  }

  /** The week's duel wins board, as kept. @param {string} week @returns {{ week: string, rows: WeekRow[] }} */
  weekBoard(week) {
    const b = this.meta('duelweek');
    return b && b.week === week ? b : { week, rows: [] };
  }

  /** The all-time Climb board, as kept. @returns {ClimbRow[]} */
  climbBoard() {
    return this.meta('climb') ?? [];
  }

  /**
   * A signed-in page's own report of the Climb: the highest floor cleared and the stars of all floors. NOT VERIFIED (the Climb runs in
   * the page) and it pays nothing. Each only grows. True when it changed anything.
   * @param {string} name @param {unknown} floor @param {unknown} stars @param {number} [now] ms
   */
  reportClimb(name, floor, stars, now = Date.now()) {
    const a = this.get(name);
    if (!a || !Number.isInteger(floor) || !Number.isInteger(stars)) return false;
    const f = /** @type {number} */ (floor), st = /** @type {number} */ (stars);
    if (f < 1 || f > CLIMB_FLOORS || st < 0 || st > 4 * f) return false;
    const old = a.climb ?? { floor: 0, stars: 0, at: '' };
    if (f <= old.floor && st <= old.stars) return false;
    a.climb = { floor: Math.max(f, old.floor), stars: Math.max(st, old.stars), at: new Date(now).toISOString() };
    this.save(a);
    const rows = [...this.climbBoard().filter((r) => r.name !== a.name), { name: a.name, ...a.climb }]
      .sort((x, y) => y.floor - x.floor || y.stars - x.stars || x.at.localeCompare(y.at)).slice(0, LEADER_SIZE);
    this.setMeta('climb', rows);
    return true;
  }

  /** A player's own clan-chat mutes (lower-case names). @param {Account} a */
  mutes(a) {
    return a.mutes ?? [];
  }

  /** Mutes or unmutes a name in this player's clan chat, kept on its account. @param {Account} a @param {string} who @param {boolean} on */
  mute(a, who, on) {
    const low = who.toLowerCase(), rest = this.mutes(a).filter((m) => m !== low);
    a.mutes = on ? [...rest, low] : rest;
    this.save(a);
  }

  /** The hero an account has played most (then won most with). @param {Account} a */
  favourite(a) {
    let favourite = null, best = { played: 0, wins: -1 };
    for (const [hero, s] of Object.entries(a.heroes ?? {})) {
      if (s.played > best.played || (s.played === best.played && s.wins > best.wins)) { favourite = hero; best = s; }
    }
    return favourite;
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
      wins: 0, losses: 0, matches: 0, heroes: {}, history: [], obols: SHOP.start, owned: [],
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

  /**
   * Records one finished run. It does not count as a win or a loss: the profile's record stays about duels with people. The best
   * run is the most bosses beaten, then the fastest.
   * @param {string} name @param {{ tier: number, bosses: number, seconds: number, result: 'cleared' | 'lost' | 'left' }} rec
   */
  recordRaid(name, rec) {
    const a = this.get(name);
    if (!a) return;
    const r = (a.raids ??= { played: 0, cleared: 0, bosses: 0, tier: 0, best: 0 });
    r.played++;
    // Beating every boss of a tier is a clear, also when the next tier then ended the run.
    if (rec.bosses >= RAID_RUN.length) r.cleared++;
    if (rec.bosses > (r.bosses ?? 0) || (rec.bosses > 0 && rec.bosses === r.bosses && rec.seconds < r.best)) {
      r.bosses = rec.bosses;
      r.tier = rec.tier;
      r.best = rec.seconds;
    }
    this.save(a);
  }

  /** What the client sees (no hash or salt). @param {Account} a */
  profile(a) {
    const favourite = this.favourite(a);
    const others = this.withOthers(a), clan = this.clanOf(a.name);
    return {
      name: a.name, created: a.created, wins: a.wins, losses: a.losses, matches: a.matches,
      favourite, heroes: a.heroes, history: a.history,
      raids: { ...(a.raids ?? { played: 0, cleared: 0, bosses: 0, tier: 0, best: 0 }), others },
      // The shop: with it off every hero in the table is the account's to play.
      obols: this.obols(a), owned: this.shop ? this.owned(a) : Object.keys(HERO_SHOP), founder: this.founder(a),
      rank: raidRank(others)?.id ?? null, tower: a.tower ?? null,
      // The leaderboards and clans (PROTOCOL 17).
      rating: this.rating(a), rated: a.rated ?? 0, climb: a.climb ?? null, mutes: this.mutes(a),
      clan: clan ? { id: clan.id, name: clan.name, tag: clan.tag } : null,
    };
  }
}

/** Highest rating first, then the name. @param {Account} x @param {Account} y */
const byRating = (x, y) => (y.rating ?? ELO.start) - (x.rating ?? ELO.start) || x.name.localeCompare(y.name);

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
