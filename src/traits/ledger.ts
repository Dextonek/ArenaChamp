import type { GroundMark, Trait, TraitHit, TraitView } from './types';
import { LEDGER_CSS, wordLook } from '../effects/parts/ledger';

/** Invoice (Q): damage (it goes on the tab), range, speed, wind-up, bolt radius. */
export const INVOICE_DAMAGE = 50;
export const INVOICE_RANGE = 9;
export const INVOICE_SPEED = 20;
export const INVOICE_WIND = 0.25;
export const INVOICE_RADIUS = 0.35;

/** Late Fee (W): damage (on the tab), reach, delay, radius, slow seconds. */
export const FEE_DAMAGE = 40;
export const FEE_RANGE = 9;
export const FEE_DELAY = 1.0;
export const FEE_RADIUS = 2.5;
export const FEE_SLOW = 1.5;

/** Call It In (E): seconds from the cast to the tab coming due (the book is shut on the enemy). */
export const CALL_DELAY = 0.5;

/** Foreclosure (R): reach, delay, radius, the share of the tab it takes, the damage the victim then takes from him, and for how long. */
export const STAMP_RANGE = 9;
export const STAMP_DELAY = 0.8;
export const STAMP_RADIUS = 2.2;
export const STAMP_MUL = 1.6;
export const STAMP_EXPOSE = 0.2;
export const STAMP_EXPOSE_SECONDS = 3;

/** On Your Tab: seconds from the last charge to it coming due, the interest, and what each hit on him pays off. */
export const DUE_SECONDS = 3;
export const DUE_MUL = 1.3;
export const PAY_OFF = 3;
/** The tab's own stack timer is only a backstop: it must outlive DUE_SECONDS. */
const TAB_BACKSTOP = 8;
const TAB_MAX = 999;

/** How long a word over the victim stays (it shrinks away in the last second). */
export const WORD_LIFE = 2.4;

export type WordKind = 'pastdue' | 'final' | 'called';

/**
 * The words over a victim, per figure (Ledger's): a spell and the trait share nothing else. Both screens keep it: the screen that
 * decides the due writes it from `victimTick` / `dealt`, and tells Ledger's own client with `noteOwner` (`peerNote` writes it
 * there). `now` is the round clock written by `marks`, so a new round (the clock goes back) clears it.
 */
export interface LedgerBook { now: number; words: { kind: WordKind; born: number }[] }
export const ledgerBooks = new WeakMap<object, LedgerBook>();

export function bookOf(who: object): LedgerBook {
  let b = ledgerBooks.get(who);
  if (!b) { b = { now: 0, words: [] }; ledgerBooks.set(who, b); }
  return b;
}

const WORD_NOTE: Record<number, WordKind> = { 1: 'pastdue', 2: 'final', 3: 'called' };
const WORD_ID: Record<WordKind, number> = { pastdue: 1, final: 2, called: 3 };

function say(t: TraitView, kind: WordKind) {
  const b = bookOf(t.self());
  b.words.push({ kind, born: t.time });
  if (b.words.length > 4) b.words.shift();
  t.noteOwner('word', WORD_ID[kind]);
}

/** The next value of a counter shown to the other screen (1..900: 0 would hide it). */
const bump = (n: number | undefined) => ((n ?? 0) % 900) + 1;

/** Hits counted since `seen`, for a counter that wraps. */
const since = (n: number, seen: number) => (n > seen ? n - seen : 1);

/**
 * Mr. Ledger (controller). Passive On Your Tab: his Invoice and Late Fee do no damage now. The damage goes on the enemy's tab, a
 * number over their head (`enemyLabel`, read from the `tab` stacks). 4 s after the last charge the tab comes due at +30%, in
 * one hit, with the word PAST DUE. An attack the enemy lands on him pays off 3 of it, a spell 15. Call It In (E) brings the tab due now
 * without the interest; Foreclosure (R) takes the whole tab at +60% and makes the enemy take +20% from him for 3 s.
 *
 * Where each rule runs (a network duel has two screens). The tab lives on the screen that decides the enemy's hits: offline the
 * one screen, online the victim's. There `dealt` turns Invoice's and Late Fee's damage into `addStacks('tab', ...)` (the stack
 * reaches Ledger's screen through `stacksChanged`, where it only feeds the number over the head and the badge), and
 * `victimTick` brings it due with `hitEnemy`, a `'trait'` hit that `dealt` ignores, so it cannot charge the tab again. Paying
 * it off is decided on Ledger's own client, where the hits on him are decided: `taken` counts them into `show('paid', n)`, a
 * counter that reaches the other screen as `own('paid')` and is read there in `victimTick` (offline the same value, read in the same
 * place), which takes 20 off per hit. Call It In does the same with `show('call', n)` from `afterCast`. Foreclosure's hit is a
 * normal spell hit; its `dealt` replaces the damage by the tab x 1.6 and empties it. The words are `bookOf` records both screens
 * draw as ground marks over the victim. A new round clears the stacks, `mem` and the shown values, and the clock in `marks`
 * clears the words.
 */
export const ledgerTrait: Trait = {
  passive: {
    name: 'On Your Tab',
    blurb: 'His spell damage does not hurt now: it goes on your tab, a number over your head. It comes due 3 s after the last charge, at +30%. Each attack you land on him pays off 3 and each spell 15: pays off 20.',
  },
  twist: {
    name: 'Interest',
    blurb: 'Bill you now, or let the interest grow? Hit him to pay your tab down. Running away makes it worse.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 8, interval: 0.8, windup: 0.25, speed: 20, look: 'spark' },
  hiddenStacks: ['tab'],
  enemyLabel(t) {
    const n = Math.round(t.stacks('tab'));
    if (n <= 0) return null;
    return { text: '$' + n, color: n >= 120 ? '#ff6a52' : LEDGER_CSS.gold };
  },
  badge(t) {
    const n = Math.round(t.stacks('tab'));
    return n > 0 ? '$' + n : '';
  },
  // The CPU keeps E for a tab worth calling in, and R for a bigger one it can stamp.
  aiHold(t, slot, dist) {
    const tab = t.stacks('tab');
    if (slot === 2) return tab < 90 || (tab >= 120 && dist <= STAMP_RANGE && t.cooldownLeft(3) <= 0.05);
    if (slot === 3) return tab < 120;
    return false;
  },
  canCast(t, slot) {
    if (slot === 2 && t.stacks('tab') <= 0) return 'Nothing on the tab';
    return null;
  },
  afterCast(t, slot) {
    if (slot === 2) t.show('call', (t.mem.callN = bump(t.mem.callN)));
  },
  /** Where the hit is decided: his Invoice and Late Fee go on the tab; Foreclosure takes it. */
  dealt(t, hit: TraitHit) {
    if (hit.kind !== 'spell' || !hit.victimIsHero || hit.blocked) return;
    if (hit.slot === 0 || hit.slot === 1) {
      if (hit.damage <= 0) return;
      t.addStacks('tab', Math.round(hit.damage), TAB_BACKSTOP, TAB_MAX);
      t.mem.tabAt = t.time;
      hit.damage = 0;
    } else if (hit.slot === 3) {
      const tab = t.stacks('tab');
      hit.damage = Math.round(tab * STAMP_MUL);
      if (tab > 0) {
        t.clearStacks('tab');
        t.mem.tabAt = 0;
        say(t, 'final');
      }
    }
  },
  /** His own client: a hit on him pays the enemy's tab down. */
  taken(t, hit: TraitHit) {
    if (hit.blocked || hit.damage <= 0 || t.stacks('tab') <= 0) return;
    // An attack pays off one step, a spell five.
    for (let i = hit.kind === 'spell' ? 5 : 1; i > 0; i--) t.mem.paid = bump(t.mem.paid);
    t.show('paid', t.mem.paid);
  },
  /** Where the enemy's hits are decided: payments, a called-in tab, and a tab coming due. */
  victimTick(t) {
    let tab = t.stacks('tab');
    if (tab <= 0) { t.mem.tabAt = 0; t.mem.callAt = 0; t.mem.callSeen = t.own('call'); t.mem.paidSeen = t.own('paid'); return; }
    if (!t.mem.tabAt) t.mem.tabAt = t.time;

    const paid = t.own('paid');
    if (paid !== (t.mem.paidSeen ?? 0)) {
      const n = since(paid, t.mem.paidSeen ?? 0);
      t.mem.paidSeen = paid;
      tab = t.addStacks('tab', -PAY_OFF * n, TAB_BACKSTOP, TAB_MAX);
      if (tab <= 0) { t.clearStacks('tab'); t.mem.tabAt = 0; return; }
    }

    const call = t.own('call');
    if (call !== (t.mem.callSeen ?? 0)) {
      t.mem.callSeen = call;
      t.mem.callAt = t.time + CALL_DELAY;
    }
    if (t.mem.callAt && t.time >= t.mem.callAt) {
      t.mem.callAt = 0;
      t.clearStacks('tab');
      t.mem.tabAt = 0;
      t.hitEnemy({ damage: Math.round(tab), knock: 0, color: LEDGER_CSS.gold });
      say(t, 'called');
      return;
    }

    if (t.time >= t.mem.tabAt + DUE_SECONDS) {
      t.clearStacks('tab');
      t.mem.tabAt = 0;
      t.hitEnemy({ damage: Math.round(tab * DUE_MUL), knock: 0, color: '#ff6a52' });
      say(t, 'pastdue');
    }
  },
  /** Ledger's own client hears the word the other screen put up. */
  peerNote(t, name, n) {
    if (name !== 'word') return;
    const kind = WORD_NOTE[n];
    if (!kind) return;
    const b = bookOf(t.self());
    b.words.push({ kind, born: t.time });
    if (b.words.length > 4) b.words.shift();
  },
  marks(t) {
    const b = bookOf(t.self());
    // A new round restarts the clock: last round's words are gone.
    if (t.time < b.now - 0.5) b.words.length = 0;
    b.now = t.time;
    for (let i = b.words.length - 1; i >= 0; i--) if (b.now - b.words[i].born >= WORD_LIFE) b.words.splice(i, 1);
    const e = t.enemy();
    if (!e || b.words.length === 0) return [];
    const out: GroundMark[] = [];
    for (const w of b.words) out.push({ x: e.group.position.x, z: e.group.position.z, kind: w.kind, age: b.now - w.born, life: WORD_LIFE });
    return out;
  },
  markLook: {
    pastdue: () => wordLook('PAST DUE'),
    final: () => wordLook('FINAL NOTICE'),
    called: () => wordLook('CALLED IN', LEDGER_CSS.brass),
  },
};
