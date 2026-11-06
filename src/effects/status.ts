/**
 * Status effects (crowd control) on a figure: the rules, kept apart from any figure or visual so the arena foes, the
 * duel opponent and the player hero all share them. See pipeline/designs/mechanics.md section 1.
 *
 * - Durations are capped per kind (`STATUS_CAPS`); re-applying a kind refreshes it, it never stacks.
 * - Stuns, knock-ups and roots in a row count as one lock, at most `LOCK_CAP` seconds however many land. When the lock
 *   ends, 0.5 s of immunity to all three follows, so there is no chain-lock.
 * - A knock-up is a stun that also lifts the figure about 1.2 m (`lift`).
 */
export type StatusKind = 'stun' | 'root' | 'slow' | 'silence' | 'blind' | 'knockup' | 'charm' | 'sealed';

export const STATUS_KINDS: StatusKind[] = ['stun', 'root', 'slow', 'silence', 'blind', 'knockup', 'charm', 'sealed'];

/**
 * Longest duration a single hit can give, in seconds. Charm: walks toward the enemy hero, cannot act (Cantor). Sealed: a
 * stun in which nothing can hit the figure, from either side (Sefu's sarcophagus).
 */
export const STATUS_CAPS: Record<StatusKind, number> = { stun: 1.2, knockup: 0.8, root: 1.5, slow: 2.5, silence: 1.5, blind: 2, charm: 1.2, sealed: 1.2 };

/** The floating word shown when a status lands. */
export const STATUS_WORD: Record<StatusKind, string> = {
  stun: 'STUNNED', root: 'ROOTED', slow: 'SLOWED', silence: 'SILENCED', blind: 'BLINDED', knockup: 'KNOCKED UP', charm: 'CHARMED', sealed: 'SEALED',
};

/** Colour of that word. */
export const STATUS_COLOR: Record<StatusKind, string> = {
  stun: '#ffd24a', root: '#b79cff', slow: '#8fb4e0', silence: '#c9a0ff', blind: '#b8b0c8', knockup: '#ffb36a', charm: '#ff9ad8', sealed: '#ffd98a',
};

export const SLOW_FACTOR = 0.6;
export const KNOCKUP_HEIGHT = 1.2;
export const CC_IMMUNITY = 0.5;
/** Stuns, knock-ups and roots in a row are one lock: it lasts at most this long (s), whatever lands during it. */
export const LOCK_CAP = 1.5;
/** Blind: a cast lands somewhere inside this radius round the aim point. */
export const BLIND_RADIUS = 2.5;

export type ApplyResult = 'applied' | 'refreshed' | 'immune';

/**
 * Buffs and debuffs: timed modifiers (not crowd control). `amount` is a fraction (0.2 = 20%), at most `BUFF_CAP`; a
 * new one of the same kind keeps the stronger amount and the longer time. Debuffs are given by hits
 * (`HitOptions.debuff`), buffs by the hero to itself (`HeroSpell.buff`, traits).
 * - haste: walks faster (x 1 + amount)        - might: deals more damage (x 1 + amount)
 * - armor: takes less damage (x 1 - amount)    - vulnerable: takes more damage (x 1 + amount)
 * - weaken: deals less damage (x 1 - amount)
 * - grounded: dashes, blinks and leaps go this much less far (Sefu's Judged: amount 0.5)
 */
export type BuffKind = 'haste' | 'might' | 'armor' | 'vulnerable' | 'weaken' | 'grounded';
export const BUFF_KINDS: BuffKind[] = ['haste', 'might', 'armor', 'vulnerable', 'weaken', 'grounded'];
/** Debuffs (bad for whoever has them); the rest are buffs. */
export const DEBUFFS: BuffKind[] = ['vulnerable', 'weaken', 'grounded'];
export const BUFF_CAP = 0.5;
export const BUFF_MAX_SECONDS = 6;
export const BUFF_WORD: Record<BuffKind, string> = {
  haste: 'HASTE', might: 'MIGHT', armor: 'ARMOR', vulnerable: 'VULNERABLE', weaken: 'WEAKENED', grounded: 'GROUNDED',
};
export const BUFF_COLOR: Record<BuffKind, string> = {
  haste: '#7dffd0', might: '#ff9a4a', armor: '#cfe0ff', vulnerable: '#ff6a8a', weaken: '#a89ab8', grounded: '#e0c070',
};
/** One-letter glyph for the small buff icons on the duel bars. */
export const BUFF_GLYPH: Record<BuffKind, string> = { haste: '»', might: '⚔', armor: '◆', vulnerable: '✚', weaken: '▼', grounded: '⚓' };

export class StatusSet {
  private left: Record<StatusKind, number> = { stun: 0, root: 0, slow: 0, silence: 0, blind: 0, knockup: 0, charm: 0, sealed: 0 };
  private immune = 0;
  /** Seconds the running lock (stun, knock-up, root) has held so far. */
  private lockAge = 0;
  private liftAge = 0;
  private liftTotal = 0;
  private buffs: Record<BuffKind, { amount: number; left: number }> = {
    haste: { amount: 0, left: 0 }, might: { amount: 0, left: 0 }, armor: { amount: 0, left: 0 },
    vulnerable: { amount: 0, left: 0 }, weaken: { amount: 0, left: 0 }, grounded: { amount: 0, left: 0 },
  };

  /** Gives a buff or debuff (see `BuffKind`). Returns 'applied' when it was not running, else 'refreshed'. */
  applyBuff(kind: BuffKind, amount: number, seconds: number): ApplyResult {
    const a = Math.min(BUFF_CAP, Math.max(0, amount)), sec = Math.min(BUFF_MAX_SECONDS, seconds);
    if (!(a > 0) || !(sec > 0)) return 'immune';
    const b = this.buffs[kind], was = b.left > 0;
    b.amount = was ? Math.max(b.amount, a) : a;
    b.left = Math.max(b.left, sec);
    return was ? 'refreshed' : 'applied';
  }

  /** The amount of a running buff (0 when none). */
  buff(kind: BuffKind) {
    const b = this.buffs[kind];
    return b.left > 0 ? b.amount : 0;
  }

  /** Seconds left of a buff. */
  buffLeft(kind: BuffKind) {
    return this.buffs[kind].left;
  }

  /** The running buffs and debuffs, for the bars. */
  activeBuffs() {
    return BUFF_KINDS.filter((k) => this.buffs[k].left > 0).map((k) => ({ kind: k, amount: this.buffs[k].amount, left: this.buffs[k].left }));
  }

  /** Any buff or debuff running. */
  get anyBuff() {
    return BUFF_KINDS.some((k) => this.buffs[k].left > 0);
  }

  /** Damage this figure deals is multiplied by this (might, weaken). */
  get dealtMul() {
    return (1 + this.buff('might')) * (1 - this.buff('weaken'));
  }

  /** Damage this figure takes is multiplied by this (armor, vulnerable). */
  get takenMul() {
    return (1 - this.buff('armor')) * (1 + this.buff('vulnerable'));
  }

  /**
   * Gives `kind` for `seconds` (capped). A stun, knock-up or root inside the 0.5 s immunity is refused, and one that
   * lands during a running lock only takes that lock up to `LOCK_CAP`.
   */
  apply(kind: StatusKind, seconds: number): ApplyResult {
    let sec = Math.min(seconds, STATUS_CAPS[kind]);
    if (!(sec > 0)) return 'immune';
    if (kind === 'stun' || kind === 'knockup' || kind === 'root' || kind === 'charm' || kind === 'sealed') {
      if (!this.locked && this.immune > 0) return 'immune';
      if (this.locked) sec = Math.min(sec, LOCK_CAP - this.lockAge);
      if (!(sec > 0)) return 'immune';
    }
    const was = this.left[kind] > 0;
    this.left[kind] = Math.max(this.left[kind], sec);
    if (kind === 'knockup') {
      if (!was) this.liftAge = 0;
      this.liftTotal = this.liftAge + this.left.knockup;
    }
    return was ? 'refreshed' : 'applied';
  }

  /** Holds the figure stunned for `seconds`, past every cap: a boss kneeling. Rules that look for a stunned target see it. */
  hold(seconds: number) {
    this.left.stun = Math.max(this.left.stun, seconds);
  }

  update(dt: number) {
    const wasLocked = this.locked;
    for (const k of STATUS_KINDS) this.left[k] = Math.max(0, this.left[k] - dt);
    for (const k of BUFF_KINDS) this.buffs[k].left = Math.max(0, this.buffs[k].left - dt);
    if (this.left.knockup > 0) this.liftAge += dt;
    if (wasLocked && this.locked) this.lockAge += dt;
    if (wasLocked && !this.locked) {
      this.immune = CC_IMMUNITY;
      this.lockAge = 0;
    } else this.immune = Math.max(0, this.immune - dt);
  }

  clear() {
    for (const k of STATUS_KINDS) this.left[k] = 0;
    for (const k of BUFF_KINDS) this.buffs[k].left = 0;
    this.immune = 0;
    this.lockAge = 0;
    this.liftAge = this.liftTotal = 0;
  }

  /** Seconds left of `kind`. */
  remaining(kind: StatusKind) {
    return this.left[kind];
  }

  has(kind: StatusKind) {
    return this.left[kind] > 0;
  }

  /** Any status running. */
  get any() {
    return STATUS_KINDS.some((k) => this.left[k] > 0);
  }

  /** Stunned, knocked up, sealed or charmed: no cast, no attack, and only a charm walks (toward the enemy). */
  get stunned() {
    return this.left.stun > 0 || this.left.knockup > 0 || this.left.sealed > 0 || this.left.charm > 0;
  }

  /** Charmed: walks toward the enemy hero on its own, cannot act. */
  get charmed() {
    return this.left.charm > 0;
  }

  /** Sealed: nothing can hit this figure. */
  get sealed() {
    return this.left.sealed > 0;
  }

  /** Any status that counts toward the lock cap is running. */
  get locked() {
    return this.stunned || this.left.root > 0;
  }

  get cannotMove() {
    return this.stunned || this.left.root > 0;
  }

  get cannotCast() {
    return this.stunned || this.left.silence > 0;
  }

  get blind() {
    return this.left.blind > 0;
  }

  /** 0.6 while slowed, else 1; times 1 + haste. */
  get speedMul() {
    return (this.left.slow > 0 ? SLOW_FACTOR : 1) * (1 + this.buff('haste'));
  }

  /** Height of a knock-up in metres right now (0 when none): up quickly, easing off at the top, then down. */
  get lift() {
    if (this.left.knockup <= 0 || this.liftTotal <= 0) return 0;
    return KNOCKUP_HEIGHT * Math.sin(Math.PI * Math.min(1, this.liftAge / this.liftTotal));
  }
}
