/**
 * Status effects (crowd control) on a figure: the rules, kept apart from any figure or visual so the arena foes, the
 * duel opponent and the player hero all share them. See pipeline/designs/mechanics.md section 1.
 *
 * - Durations are capped per kind (`STATUS_CAPS`); re-applying a kind refreshes it, it never stacks.
 * - After a stun or knock-up ends, 0.5 s of immunity to both follows, so there is no chain-lock.
 * - A knock-up is a stun that also lifts the figure about 1.2 m (`lift`).
 */
export type StatusKind = 'stun' | 'root' | 'slow' | 'silence' | 'blind' | 'knockup';

export const STATUS_KINDS: StatusKind[] = ['stun', 'root', 'slow', 'silence', 'blind', 'knockup'];

/** Longest duration a single hit can give, in seconds. */
export const STATUS_CAPS: Record<StatusKind, number> = { stun: 1.2, knockup: 0.8, root: 1.5, slow: 2.5, silence: 1.5, blind: 2 };

/** The floating word shown when a status lands. */
export const STATUS_WORD: Record<StatusKind, string> = {
  stun: 'STUNNED', root: 'ROOTED', slow: 'SLOWED', silence: 'SILENCED', blind: 'BLINDED', knockup: 'KNOCKED UP',
};

/** Colour of that word. */
export const STATUS_COLOR: Record<StatusKind, string> = {
  stun: '#ffd24a', root: '#b79cff', slow: '#8fb4e0', silence: '#c9a0ff', blind: '#b8b0c8', knockup: '#ffb36a',
};

export const SLOW_FACTOR = 0.6;
export const KNOCKUP_HEIGHT = 1.2;
export const CC_IMMUNITY = 0.5;
/** Blind: a cast lands somewhere inside this radius round the aim point. */
export const BLIND_RADIUS = 2.5;

export type ApplyResult = 'applied' | 'refreshed' | 'immune';

export class StatusSet {
  private left: Record<StatusKind, number> = { stun: 0, root: 0, slow: 0, silence: 0, blind: 0, knockup: 0 };
  private immune = 0;
  private liftAge = 0;
  private liftTotal = 0;

  /** Gives `kind` for `seconds` (capped). A stun or knock-up inside the 0.5 s immunity is refused. */
  apply(kind: StatusKind, seconds: number): ApplyResult {
    const sec = Math.min(seconds, STATUS_CAPS[kind]);
    if (!(sec > 0)) return 'immune';
    const hard = kind === 'stun' || kind === 'knockup';
    if (hard && !this.stunned && this.immune > 0) return 'immune';
    const was = this.left[kind] > 0;
    this.left[kind] = Math.max(this.left[kind], sec);
    if (kind === 'knockup') {
      if (!was) this.liftAge = 0;
      this.liftTotal = this.liftAge + this.left.knockup;
    }
    return was ? 'refreshed' : 'applied';
  }

  update(dt: number) {
    const wasStunned = this.stunned;
    for (const k of STATUS_KINDS) this.left[k] = Math.max(0, this.left[k] - dt);
    if (this.left.knockup > 0) this.liftAge += dt;
    if (wasStunned && !this.stunned) this.immune = CC_IMMUNITY;
    else this.immune = Math.max(0, this.immune - dt);
  }

  clear() {
    for (const k of STATUS_KINDS) this.left[k] = 0;
    this.immune = 0;
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

  /** Stunned or knocked up: no move, no cast. */
  get stunned() {
    return this.left.stun > 0 || this.left.knockup > 0;
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

  /** 0.6 while slowed, else 1. */
  get speedMul() {
    return this.left.slow > 0 ? SLOW_FACTOR : 1;
  }

  /** Height of a knock-up in metres right now (0 when none): up quickly, easing off at the top, then down. */
  get lift() {
    if (this.left.knockup <= 0 || this.liftTotal <= 0) return 0;
    return KNOCKUP_HEIGHT * Math.sin(Math.PI * Math.min(1, this.liftAge / this.liftTotal));
  }
}
