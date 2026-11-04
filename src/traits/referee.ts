import type * as THREE from 'three';
import type { GroundMark, Trait, TraitHit, TraitView } from './types';
import { REFEREE_CSS, cardLook, ringLook, wordLook } from '../effects/parts/referee';

/** Whistle Blast (Q): damage, range, speed, wind-up, bolt radius. */
export const WHISTLE_DAMAGE = 72;
export const WHISTLE_RANGE = 8;
export const WHISTLE_SPEED = 22;
export const WHISTLE_WIND = 0.3;
export const WHISTLE_RADIUS = 0.4;

/** No Running (W) and No Casting (E): the reach (the whistle's ring), the delay to the blast, and the seconds each rule runs. */
export const RULE_RANGE = 7;
export const RULE_DELAY = 0.5;
export const RUN_SECONDS = 3;
export const CAST_SECONDS = 2;

/** Show the Card (R): reach, delay, the size of the circle he points at, and the seconds of HANDS OFF that follow. */
export const CARD_RANGE = 9;
export const CARD_DELAY = 0.6;
export const CARD_RADIUS = 1.2;
export const HANDS_SECONDS = 3;

/** The red card: damage and the seconds of silence. */
export const RED_DAMAGE = 90;
export const RED_SILENCE = 1.5;

/**
 * Stepping 2 m or more in 0.2 s (10 m/s: no walk, even hasted, does it) within 1.3 s of a spell is a dash, blink or leap. The trait
 * cannot read the enemy's `HeroSpell.dash`, so it watches the enemy move instead.
 */
export const DASH_STEP = 2;
export const DASH_WINDOW = 0.2;
export const DASH_WATCH = 1.3;

/** How long a word over the enemy stays. */
export const WORD_LIFE = 1.6;
/** A mark that lives the whole round (the cards). */
const ROUND = 9999;

export type CardWord = 'yellow' | 'red';

/**
 * What Whistler keeps on the enemy, per figure (his): the spells and the trait share nothing else. Every screen keeps one: the
 * screen that decides the enemy's hits (offline the one screen, online the victim's) writes it and tells Whistler's own client with
 * `noteOwner` (`peerNote` writes it there), so both draw the cards. `now` is the round clock written by every reader, so a new round
 * (the clock goes back) clears it. `castN` counts the enemy's casts (`enemyCast`, both screens); `castSeen` is what `victimTick` has
 * judged. `hitSeen` is the count of hits on Whistler while HANDS OFF ran, shown by his own client (`show('hit')`).
 */
export interface RefBook {
  now: number;
  yellow: number;
  reds: number;
  /** `now` when the card count last changed: the cards pop in then. */
  since: number;
  words: { kind: CardWord; born: number }[];
  castN: number;
  castSeen: number;
  castAt: number;
  hitSeen: number;
  trail: { t: number; x: number; z: number }[];
}
export const refereeBooks = new WeakMap<object, RefBook>();

function blank(): RefBook {
  return { now: 0, yellow: 0, reds: 0, since: 0, words: [], castN: 0, castSeen: 0, castAt: -99, hitSeen: 0, trail: [] };
}

export function bookOf(who: object): RefBook {
  let b = refereeBooks.get(who);
  if (!b) { b = blank(); refereeBooks.set(who, b); }
  return b;
}

/** Reads the round clock: a clock that went back is a new round, and the cards are gone. */
function sync(b: RefBook, time: number) {
  if (time < b.now - 0.5) Object.assign(b, blank());
  b.now = time;
}

const WORD_ID: Record<CardWord, number> = { yellow: 1, red: 2 };
const WORD_NOTE: Record<number, CardWord> = { 1: 'yellow', 2: 'red' };

/** A word goes up over the enemy; a repeat within 0.3 s (the note coming back to the screen that decided it) is the same word. */
function pushWord(b: RefBook, kind: CardWord, time: number) {
  const last = b.words[b.words.length - 1];
  if (last && last.kind === kind && time - last.born < 0.3) return;
  b.words.push({ kind, born: time });
  if (b.words.length > 3) b.words.shift();
}

const cardsCode = (b: RefBook) => 1 + b.yellow + 2 * b.reds;

/** Ends a rule now (a card was given for it): no pop, no message beyond the stack's own. */
function endRule(t: TraitView, name: string) {
  t.addStacks(name, -1, 1, 1);
}

/**
 * Gives the enemy a card (the screen that decides their hits only). `rule`: the rule they broke, which ends with the card. A second
 * yellow is a red: 60 damage and silence, and the count goes back to no yellows.
 */
function giveCard(t: TraitView, rule?: string) {
  const b = bookOf(t.self());
  sync(b, t.time);
  if (rule) endRule(t, rule);
  let word: CardWord;
  if (b.yellow >= 1) {
    b.yellow = 0;
    b.reds++;
    word = 'red';
    t.hitEnemy({ damage: RED_DAMAGE, knock: 0, color: REFEREE_CSS.red, status: { kind: 'silence', seconds: RED_SILENCE } });
  } else {
    b.yellow = 1;
    word = 'yellow';
  }
  b.since = t.time;
  pushWord(b, word, t.time);
  t.noteOwner('cards', cardsCode(b));
  t.noteOwner('word', WORD_ID[word]);
}

/** The rule texts now running on the enemy (both screens read the same stacks). */
function rules(t: TraitView): string[] {
  const out: string[] = [];
  if (t.stacks('norun') > 0) out.push('NO RUNNING');
  if (t.stacks('nocast') > 0) out.push('NO CASTING');
  if (t.stacks('hands') > 0) out.push('HANDS OFF');
  return out;
}

const cardKinds: Record<string, () => THREE.Object3D> = {};
for (let y = 0; y <= 1; y++) for (let r = 0; r <= 3; r++) if (y + r > 0) cardKinds[`c${y}${r}`] = () => cardLook(y, r);

/**
 * Referee Whistler (controller). Passive By the Book: his rules show over the enemy's head (NO RUNNING 3 s, NO CASTING 2 s, HANDS
 * OFF 3 s). Breaking one is a yellow card; he never stops the break, he only cards it. Two yellows are a red: 60 damage, silenced
 * 1.5 s, a big RED CARD word and a short whistle ring, and the yellows go back to none. Cards last the round and hover over the
 * enemy's head (yellow in front, reds behind), so a player can always read the count.
 *
 * Where each rule runs (a network duel has two screens). The rules are stacks on the enemy (`norun`, `nocast`, `hands`), added in
 * `dealt` by W, E and R, so they live on the screen that decides the enemy's hits and reach his screen through `stacksChanged`; both
 * read them for the label. A card is decided only there, in `victimTick`: `enemyCast` (both screens) only counts the enemy's casts
 * in the book, and `victimTick` judges the new ones against NO CASTING; a dash is a step of 2 m in 0.2 s within 1.3 s of a cast
 * while NO RUNNING runs (the enemy's own position is real there); a hit on Whistler while HANDS OFF runs is decided on HIS client
 * (`taken`), which shows a counter (`show('hit')`) that reaches the deciding screen as `own('hit')`, as Mr. Ledger's payments do.
 * The cards live in `refereeBooks`: the deciding screen writes them and tells Whistler's client with `noteOwner` (`peerNote`), so
 * both screens draw the same cards (`marks`). Each rule ends with the card it gave, so one rule is never more than one card. The red
 * is `hitEnemy`, a 'trait' hit that no hook of his answers, so it cannot give a card itself.
 */
export const refereeTrait: Trait = {
  passive: {
    name: 'By the Book',
    blurb: 'A rule he calls shows over your head: NO RUNNING 3 s, NO CASTING 2 s, HANDS OFF 3 s. Break it and you get a yellow card; two yellows are a red: 60 damage and silenced 1.5 s. Cards last the round.',
  },
  twist: {
    name: 'Booked',
    blurb: 'Obey the rule, or take the card when the move is worth it. Your card count shows over your head.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 12, interval: 0.9, windup: 0.25, speed: 20, look: 'orb' },
  hiddenStacks: ['norun', 'nocast', 'hands'],

  // The CPU blows W and E only with the enemy in reach and no rule running; R only with the enemy inside 9 m.
  aiHold(t, slot, dist) {
    if (slot === 1 || slot === 2) return dist > RULE_RANGE || rules(t).length > 0;
    if (slot === 3) return dist > CARD_RANGE;
    return false;
  },

  enemyLabel(t) {
    const b = bookOf(t.self());
    sync(b, t.time);
    const r = rules(t);
    return r.length ? { text: r.join(' / '), color: REFEREE_CSS.hotYellow } : null;
  },

  badge(t) {
    const b = bookOf(t.self());
    sync(b, t.time);
    return `${b.yellow ? 'Y' : ''}${b.reds ? 'R' + b.reds : ''}`;
  },

  afterCast(t, slot) {
    if (slot === 1) t.say('NO RUNNING!', REFEREE_CSS.hotYellow);
    else if (slot === 2) t.say('NO CASTING!', REFEREE_CSS.hotYellow);
    else if (slot === 3) t.say('SHOW THE CARD', REFEREE_CSS.hotRed);
  },

  /** Both screens: the enemy cast. `victimTick`, where the enemy's hits are decided, judges it. */
  enemyCast(t) {
    const b = bookOf(t.self());
    sync(b, t.time);
    b.castN++;
    b.castAt = t.time;
  },

  /** His own client: a hit on him while HANDS OFF runs is counted and shown; the deciding screen gives the card. */
  taken(t, hit: TraitHit) {
    if (hit.blocked || hit.damage <= 0 || hit.kind === 'trait') return;
    if (t.stacks('hands') <= 0) return;
    t.show('hit', (t.mem.hitN = (t.mem.hitN ?? 0) + 1));
  },

  /** Where the hit is decided: W, E and R set a rule; R gives a yellow now. */
  dealt(t, hit: TraitHit) {
    if (hit.kind !== 'spell' || !hit.victimIsHero || hit.blocked) return;
    if (hit.slot === 1) {
      hit.damage = 0;
      t.addStacks('norun', 1, RUN_SECONDS, 1);
    } else if (hit.slot === 2) {
      hit.damage = 0;
      t.addStacks('nocast', 1, CAST_SECONDS, 1);
    } else if (hit.slot === 3) {
      hit.damage = 0;
      t.addStacks('hands', 1, HANDS_SECONDS, 1);
      giveCard(t);
    }
  },

  /** Where the enemy's hits are decided: the rules are judged. */
  victimTick(t) {
    const b = bookOf(t.self());
    sync(b, t.time);
    const e = t.enemy();
    if (!e) return;
    const p = e.group.position;
    b.trail.push({ t: t.time, x: p.x, z: p.z });
    while (b.trail.length > 2 && b.trail[0].t < t.time - 0.6) b.trail.shift();

    // NO CASTING: a spell cast while it runs is a yellow (the cast itself goes on).
    if (b.castN > b.castSeen) {
      b.castSeen = b.castN;
      if (t.stacks('nocast') > 0) giveCard(t, 'nocast');
    }

    // HANDS OFF: Whistler's client counted a hit while it ran.
    const n = t.own('hit');
    if (n > b.hitSeen) {
      b.hitSeen = n;
      if (t.stacks('hands') > 0) giveCard(t, 'hands');
    } else if (n < b.hitSeen) b.hitSeen = n;

    // NO RUNNING: a dash, blink or leap just after a cast moves the enemy far, fast.
    if (t.stacks('norun') > 0 && t.time - b.castAt < DASH_WATCH) {
      for (let i = b.trail.length - 1; i >= 0; i--) {
        const s = b.trail[i];
        if (t.time - s.t < DASH_WINDOW) continue;
        if (Math.hypot(p.x - s.x, p.z - s.z) >= DASH_STEP) { b.trail.length = 0; giveCard(t, 'norun'); }
        break;
      }
    }
  },

  /** Whistler's own client hears what the deciding screen decided. */
  peerNote(t, name, n) {
    const b = bookOf(t.self());
    sync(b, t.time);
    if (name === 'cards') {
      const yellow = (n - 1) % 2, reds = Math.floor((n - 1) / 2);
      if (yellow !== b.yellow || reds !== b.reds) b.since = t.time;
      b.yellow = yellow;
      b.reds = reds;
    } else if (name === 'word') {
      const kind = WORD_NOTE[n];
      if (kind) pushWord(b, kind, t.time);
    }
  },

  marks(t) {
    const b = bookOf(t.self());
    sync(b, t.time);
    const e = t.enemy();
    if (!e) return [];
    for (let i = b.words.length - 1; i >= 0; i--) if (b.now - b.words[i].born >= WORD_LIFE) b.words.splice(i, 1);
    const p = e.group.position, out: GroundMark[] = [];
    if (b.yellow + b.reds > 0) out.push({ x: p.x, z: p.z, kind: `c${b.yellow}${Math.min(3, b.reds)}`, age: Math.max(0, b.now - b.since), life: ROUND });
    for (const w of b.words) {
      const age = b.now - w.born;
      out.push({ x: p.x, z: p.z, kind: w.kind === 'red' ? 'wordred' : 'wordyellow', age, life: WORD_LIFE });
      if (w.kind === 'red') out.push({ x: p.x, z: p.z, kind: 'ringred', age, life: WORD_LIFE });
    }
    return out;
  },
  markLook: {
    ...cardKinds,
    wordred: () => wordLook('RED CARD', REFEREE_CSS.red),
    wordyellow: () => wordLook('YELLOW CARD', REFEREE_CSS.yellow, REFEREE_CSS.dark),
    ringred: () => ringLook(),
  },
};
