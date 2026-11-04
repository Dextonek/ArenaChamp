import * as THREE from 'three';
import type { GroundMark, Trait, TraitHit, TraitView } from './types';
import { WEATHER_CSS, WEATHER_CSS_OF, WEATHER_WORDS, cardLook, driveWeather, rainLook, sunLook, windLook } from '../effects/parts/weather';

/** Weather is an index: 0 rain, 1 sun, 2 wind. */
export const RAIN = 0;
export const SUN = 1;
export const WIND = 2;
export type Weather = 0 | 1 | 2;

/** The arena's centre (`RING` in duel.ts): the weather layer is one big mark here. */
export const ARENA_X = 0;
export const ARENA_Z = 7;

/** And Now the Weather (P): seconds a weather lasts, the seconds the forecast is shown, and the one in five that is wrong. */
export const STEP = 8;
export const FORECAST_SHOW = 3;
export const WRONG_IN = 5;
/** Rain: the slow's length, and how often it is renewed. Sun: HP a second and the size of each heal. Wind: metres a second. */
export const RAIN_SECONDS = 0.6;
export const RAIN_RENEW = 0.3;
export const SUN_HEAL = 4;
export const SUN_EVERY = 1;
export const WIND_PUSH = 1;
/** His own bonus in the weather he called: damage share, and how long each renewal lasts. */
export const MIGHT = 0.2;
export const MIGHT_SECONDS = 0.7;
export const MIGHT_RENEW = 0.35;

/** Cold Front (Q): damage, range, speed, wind-up, bolt radius; in Rain it slows this long, in Wind it knocks this much further. */
export const COLD_DAMAGE = 50;
export const COLD_RANGE = 9;
export const COLD_SPEED = 20;
export const COLD_WIND = 0.25;
export const COLD_RADIUS = 0.4;
export const COLD_KNOCK = 2;
export const COLD_RAIN_SLOW = 1.5;
/** The engine's knock caps at 8 and is 0.18 m per point on a player: this is about 1.4 m there, about 1.1 m on a CPU. */
export const COLD_WIND_KNOCK = 6;

/** Lightning Risk (W): damage, reach, delay, radius. */
export const BOLT_DAMAGE = 45;
export const BOLT_RANGE = 9;
export const BOLT_DELAY = 0.8;
export const BOLT_RADIUS = 1.5;

/** Forecast Update (E): it cannot be cast this close to a change (so both screens count it before the step turns), and it spends Cold Front. */
export const UPDATE_LOCK = 0.6;
export const UPDATE_COST = 6;

/** Severe Warning (R): reach, warning, how long it walks, its speed, damage a second, hit radius. */
export const TORNADO_RANGE = 9;
export const TORNADO_WARN = 1.0;
export const TORNADO_WALK = 4;
export const TORNADO_SPEED = 2.5;
export const TORNADO_DPS = 25;
export const TORNADO_RADIUS = 2;
/** The hits come every 0.25 s: 6, 6, 6, 7. */
const TORNADO_BEAT = 0.25;

/** The tornado, as the effect leaves it for the trait (both screens play the effect and write the same). */
export interface TornadoRec { x: number; z: number; live: boolean }

/**
 * What Barry's weather keeps, per figure (the effects play on both screens and the CPU reuses one effect per label, so the state
 * lives here and not in an effect). It is a pure function of the round time and the Update count, so both screens agree without a
 * message: `step` is the step now, `cur` its weather (latched when the step began), `shown` what had been forecast for it, `wrong`
 * that the two differ. `fAct`, `fShown`, `fWrong` are the next step's real weather and what the forecast says of it now.
 */
export interface WeatherBook {
  clock: number;
  step: number;
  uSeen: number;
  cur: Weather;
  prev: Weather;
  shown: Weather;
  wrong: boolean;
  dirX: number;
  dirZ: number;
  stepAt: number;
  fAct: Weather;
  fShown: Weather;
  fWrong: boolean;
  toChange: number;
  tornado: TornadoRec | null;
  // Pooled output: nothing is allocated per frame.
  list: GroundMark[];
  fieldA: GroundMark;
  fieldB: GroundMark;
  card: GroundMark;
  fades: number[];
  ringObj: { radius: number; color: string; fill: number; opacity: number };
}
export const weatherBooks = new WeakMap<object, WeatherBook>();

function makeBook(): WeatherBook {
  const mk = (): GroundMark => ({ x: ARENA_X, z: ARENA_Z, kind: 'rain', age: 99, life: 999 });
  return {
    clock: 0, step: -1, uSeen: 0, cur: RAIN, prev: RAIN, shown: RAIN, wrong: false, dirX: 1, dirZ: 0, stepAt: 0, fAct: RAIN, fShown: RAIN, fWrong: false,
    toChange: STEP, tornado: null, list: [], fieldA: mk(), fieldB: mk(), card: mk(), fades: [0, 0, 0], ringObj: { radius: 1.15, color: WEATHER_CSS.rain, fill: 1, opacity: 0.55 },
  };
}

export function bookOf(who: object): WeatherBook {
  let b = weatherBooks.get(who);
  if (!b) { b = makeBook(); weatherBooks.set(who, b); }
  return b;
}

/** Integer mix (a seeded hash): no `Math.random`, so every screen gets the same weather. */
export function mix(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** The weather the first step gets. */
const firstWeather = () => (mix(0) % 3) as Weather;

/**
 * The forecast for step `next` when `cur` is the weather now and `ups` Updates have been cast: the real weather (never the one now,
 * and an Update always turns it to the other of the two) and what the forecast says (one time in five, another weather). It is
 * written into the book's `f*` fields. The seed is the step plus the Updates: `mix(next)` for the step, the parity of `ups`.
 */
function forecastInto(b: WeatherBook, next: number, ups: number, cur: Weather) {
  const act = ((cur + 1 + ((mix(next) & 1) ^ (ups & 1))) % 3) as Weather;
  const wrong = mix(next * 31 + ups * 17 + 7) % WRONG_IN === 0;
  b.fAct = act;
  b.fWrong = wrong;
  b.fShown = wrong ? (((act + 1 + (mix(next * 13 + ups) & 1)) % 3) as Weather) : act;
}

function resetBook(b: WeatherBook) {
  b.step = -1;
  b.clock = 0;
  b.uSeen = 0;
  b.tornado = null;
}

function enter(b: WeatherBook, step: number, ups: number) {
  b.prev = b.cur;
  if (step === 0) {
    b.cur = firstWeather();
    b.shown = b.cur;
    b.wrong = false;
  } else {
    forecastInto(b, step, ups, b.cur);
    b.cur = b.fAct;
    b.shown = b.fShown;
    b.wrong = b.fWrong;
  }
  b.step = step;
  b.stepAt = step * STEP;
  // The wind's direction: eight ways, by the step only.
  const a = (mix(step * 7 + 3) % 8) * (Math.PI / 4) + Math.PI / 8;
  b.dirX = Math.cos(a);
  b.dirZ = Math.sin(a);
}

/**
 * Brings the book up to now: reads the round clock and the shown count of Updates (`own('upd')`, the same on both screens), latches
 * each new step's weather, and works out the next step's forecast. A new round (the clock or the count goes back) starts over.
 * Cheap, idempotent, allocation-free: every hook calls it.
 */
export function sync(t: TraitView): WeatherBook {
  const b = bookOf(t.self());
  const time = Math.max(0, t.time), ups = t.own('upd');
  if (time < b.clock - 0.5 || ups < b.uSeen) resetBook(b);
  b.clock = time;
  b.uSeen = ups;
  const s = Math.floor(time / STEP);
  while (b.step < s) enter(b, b.step + 1, ups);
  forecastInto(b, b.step + 1, ups, b.cur);
  b.toChange = (b.step + 1) * STEP - time;
  return b;
}

/** The weather now on a figure's book (for the effects: what Cold Front flies in). */
export function weatherOf(who: object): Weather {
  return weatherBooks.get(who)?.cur ?? RAIN;
}

const FIELD_KIND = ['rain', 'sun', 'wind'];
const LABELS: string[][] = WEATHER_WORDS.map((w) => [0, 1, 2, 3].map((n) => `${w} IN ${n}`));
const PREFIX = ['next', 'now', 'sorry', 'update'] as const;

const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

function cardLooks(): Record<string, () => THREE.Object3D> {
  const out: Record<string, () => THREE.Object3D> = {};
  for (const p of PREFIX) for (let w = 0; w < 3; w++) out[`${p}_${w}`] = () => cardLook(p, w);
  return out;
}

/** Each seed of 'AI': allow Update when this step was a surprise, or on every third step by the seed. */
const aiLikes = (b: WeatherBook) => b.wrong || mix(b.step * 5 + 1) % 3 === 0;

/**
 * Barry Cloudsley (mage). Passive And Now the Weather: every 8 s the arena's weather changes (Rain, Sun or Wind) and it hits both
 * heroes. Rain slows both; Sun heals both 4 a second; Wind pushes both 1 m/s across the arena. The next one is shown 3 s ahead on
 * both screens, but one forecast in five is wrong. He is +20% in a weather he forecast right (a might buff renewed while it lasts,
 * which the engine multiplies into every cast and attack, so `castMods` needs nothing).
 *
 * Where each rule runs. The weather is a pure function of the round time and the number of Updates cast (`sync`, `mix`): `ups` is
 * `show('upd')`, so it reaches the other screen with the cast and `own('upd')` reads it on both, and each screen latches the
 * weather of a step as it begins. Nothing is ever sent for the weather itself and nothing uses chance. Each client applies it to
 * its own hero: `tick` for him (his own client: a slow, a heal or a push on himself) and `victimTick` for the enemy (the screen that
 * decides the enemy's position: the slow, the heal and the push are renewed there). Cold Front's rain slow and wind knock are put
 * on the hit in `dealt`, where the hit is decided. Severe Warning's tornado is an effect on both screens that writes its place in
 * `tornado`; `victimTick` hits the enemy from it while it is within 2 m. The cards, the ring and the label are read from the book
 * every frame on both screens (`marks`, `ring`, `enemyLabel`), and the arena-wide weather is one mark centred on the arena.
 */
export const weatherTrait: Trait = {
  passive: {
    name: 'And Now the Weather',
    blurb: 'Every 8 s the arena\'s weather changes: Rain (everyone slower), Sun (everyone heals 4 a second) or Wind (a push of 1 m/s across). The next one is shown for 3 s before, but one forecast in five is wrong. He is +20% in a weather he called right.',
  },
  twist: {
    name: 'Forecast',
    blurb: 'Change the forecast, or trust it? Everyone sees it, and the weather hits both. An Update costs his Cold Front.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 20, look: 'drop' },
  // The CPU: Update when the weather was a surprise or by the step; Severe Warning only inside its reach.
  aiHold(t, slot, dist) {
    if (slot === 3) return dist > TORNADO_RANGE;
    if (slot === 2) {
      const b = sync(t);
      return b.toChange < UPDATE_LOCK + 0.4 || !aiLikes(b);
    }
    return false;
  },
  canCast(t, slot) {
    if (slot === 2 && sync(t).toChange < UPDATE_LOCK) return 'The weather is about to change';
    return null;
  },
  afterCast(t, slot) {
    if (slot !== 2) return;
    // An Update turns the forecast: both screens read the new count with the cast.
    const n = (t.mem.upd = Math.min(900, (t.mem.upd ?? 0) + 1));
    t.show('upd', n);
    // It spends his damage spell.
    t.setCooldown(0, Math.max(t.cooldownLeft(0), UPDATE_COST));
    t.say('AND NOW THE WEATHER', WEATHER_CSS.foil);
  },
  /** Where Cold Front's hit is decided: rain slows it, wind carries it further. */
  dealt(t, hit: TraitHit) {
    if (hit.kind !== 'spell' || hit.slot !== 0 || !hit.victimIsHero || hit.blocked) return;
    const w = sync(t).cur;
    if (w === RAIN) hit.opts = { ...hit.opts, status: { kind: 'slow', seconds: COLD_RAIN_SLOW } };
    else if (w === WIND) hit.opts = { ...hit.opts, knock: (hit.opts.knock ?? 0) + COLD_WIND_KNOCK };
  },
  /** His own client: the weather on him, and his bonus. */
  tick(t, dt) {
    const b = sync(t);
    const m = t.mem;
    if (b.cur === RAIN) {
      m.selfRain = (m.selfRain ?? 0) - dt;
      if (m.selfRain <= 0) { m.selfRain = RAIN_RENEW; t.status(t.self())?.apply('slow', RAIN_SECONDS); }
    } else if (b.cur === SUN) {
      m.selfSun = (m.selfSun ?? 0) + dt;
      if (m.selfSun >= SUN_EVERY) {
        m.selfSun = 0;
        if (t.hp() < t.maxHp()) t.heal(SUN_HEAL * SUN_EVERY);
      }
    } else t.carrySelf(b.dirX * WIND_PUSH * dt, b.dirZ * WIND_PUSH * dt);
    // +20% for as long as the weather is the one he called.
    if (!b.wrong) {
      m.selfMight = (m.selfMight ?? 0) - dt;
      if (m.selfMight <= 0) { m.selfMight = MIGHT_RENEW; t.buff('might', MIGHT, MIGHT_SECONDS); }
    }
  },
  /** The screen that decides the enemy's position: the same weather on them, and the tornado's hits. */
  victimTick(t, dt) {
    const e = t.enemy();
    if (!e) return;
    const b = sync(t);
    const m = t.mem;
    if (b.cur === RAIN) {
      m.foeRain = (m.foeRain ?? 0) - dt;
      if (m.foeRain <= 0) { m.foeRain = RAIN_RENEW; t.status(e)?.apply('slow', RAIN_SECONDS); }
    } else if (b.cur === SUN) {
      m.foeSun = (m.foeSun ?? 0) + dt;
      if (m.foeSun >= SUN_EVERY) { m.foeSun = 0; t.healEnemy(SUN_HEAL * SUN_EVERY); }
    } else t.carryEnemy(b.dirX * WIND_PUSH * dt, b.dirZ * WIND_PUSH * dt);

    const tw = b.tornado;
    if (tw && tw.live && Math.hypot(e.group.position.x - tw.x, e.group.position.z - tw.z) <= TORNADO_RADIUS) {
      m.twAcc = (m.twAcc ?? 0) + dt;
      while (m.twAcc >= TORNADO_BEAT) {
        m.twAcc -= TORNADO_BEAT;
        m.twN = (m.twN ?? 0) + 1;
        // 25 a second in four beats: 6, 6, 6, 7.
        const dmg = Math.floor(TORNADO_DPS * TORNADO_BEAT) + (m.twN % 4 === 0 ? 1 : 0);
        t.hitEnemy({ damage: dmg, knock: 0, color: '#dfe8f4' });
      }
    } else m.twAcc = 0;
  },
  badge(t) {
    return WEATHER_WORDS[sync(t).cur];
  },
  /** A ring at his feet in the colour of the weather, filling with the time left in it. */
  ring(t) {
    const b = sync(t);
    b.ringObj.color = WEATHER_CSS_OF[b.cur];
    b.ringObj.fill = Math.max(0, Math.min(1, b.toChange / STEP));
    return b.ringObj;
  },
  /** The word over the enemy for the 3 s before a change: the forecast, with its countdown. */
  enemyLabel(t) {
    const b = sync(t);
    if (b.toChange > FORECAST_SHOW) return null;
    return { text: LABELS[b.fShown][Math.min(3, Math.ceil(b.toChange))], color: WEATHER_CSS_OF[b.fShown] };
  },
  marks(t) {
    const b = sync(t);
    const out = b.list;
    out.length = 0;
    const age = b.clock - b.stepAt;
    // The weather across the arena: the new one fades in over a second while the last fades out.
    const k = smooth(age / 1.2);
    b.fades[0] = b.fades[1] = b.fades[2] = 0;
    b.fades[b.cur] = k;
    b.fieldA.kind = FIELD_KIND[b.cur];
    out.push(b.fieldA);
    if (k < 1 && b.step > 0 && b.prev !== b.cur) {
      b.fades[b.prev] = 1 - k;
      b.fieldB.kind = FIELD_KIND[b.prev];
      out.push(b.fieldB);
    }
    driveWeather(b.clock, b.dirX, b.dirZ, b.fades);
    // The card over Barry: the forecast in its last 3 s, then the change for a moment (or SORRY FOLKS).
    const p = t.self().group.position;
    const c = b.card;
    c.x = p.x;
    c.z = p.z;
    if (b.toChange <= FORECAST_SHOW) {
      c.kind = `next_${b.fShown}`;
      c.age = FORECAST_SHOW - b.toChange;
      c.life = c.age + 4;
      out.push(c);
    } else if (age < 2.4) {
      c.kind = `${b.wrong ? 'sorry' : 'now'}_${b.cur}`;
      c.age = age;
      c.life = 2.4;
      out.push(c);
    }
    return out;
  },
  markLook: { rain: rainLook, sun: sunLook, wind: windLook, ...cardLooks() },
};
