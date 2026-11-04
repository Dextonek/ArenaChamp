import * as THREE from 'three';
import type { GroundMark, Trait, TraitView } from './types';
import { BELL_TOP, BELL_X, DOOR_CSS, brokenLook, grandDoorLook, lobbyRingLook, pairDoorLook, threadLook } from '../effects/parts/door';
import type { MinionLook } from '../effects/parts/minion';
import type { BoltDoor } from '../effects/projectile';
import type { SummonUnit } from '../effects/summon';
import type { CastContext } from '../effects/targeting';

/** Key Toss (Q): damage, reach (m), speed (m/s), wind-up (s), the bolt's radius (m; the drawn line is `boltWidth(radius)`). */
export const KEY_DAMAGE = 66;
export const KEY_RANGE = 9;
export const KEY_SPEED = 22;
export const KEY_WIND = 0.3;
export const KEY_RADIUS = 0.3;

/** Door (W): reach (m), nearest spot to him (m), nearest spot to the other door (m), seconds it takes to rise and stands, HP, doors at once. */
export const DOOR_RANGE = 9;
export const DOOR_MIN = 1.2;
export const DOOR_APART = 3;
export const DOOR_RISE = 0.5;
export const DOOR_LIFE = 10;
export const DOOR_HP = 40;
export const DOOR_MAX = 2;
/** Door's two charges: one back every `DOOR_EVERY` s; `DOOR_GAP` s between two casts. */
export const DOOR_CHARGES = 2;
export const DOOR_EVERY = 4;
export const DOOR_GAP = 0.6;

/** A door takes whoever is within `DOOR_R` m of its middle (a Grand Lobby door: `LOBBY_R`), and a bolt that flies within it. */
export const DOOR_R = 0.8;
export const LOBBY_R = 1.1;
/** Seconds a hero is left alone after a trip; how far past the far door he is set down (m); how far inside the ring a Grand Lobby trip ends (m). */
export const TAKE_LOCK = 1;
export const EXIT_AHEAD = 1.4;
export const LOBBY_EXIT = 1.8;
/** A hero is "off the door" again at this many metres beyond its reach. */
const OFF_MARGIN = 0.3;

/** Slam (E): the reach of each door's slam (m), damage, stun (s) and the wait (s). */
export const SLAM_RADIUS = 1.5;
export const SLAM_DAMAGE = 55;
export const SLAM_STUN = 0.5;
export const SLAM_WIND = 0.7;

/** Grand Lobby (R): reach (m), the ring's radius (m), seconds it stands, the wait (s) and the doors in it. The gap between two doors is `LOBBY_GAP`. */
export const LOBBY_RANGE = 9;
export const LOBBY_RADIUS = 3;
export const LOBBY_LIFE = 4;
export const LOBBY_WIND = 0.8;
export const LOBBY_DOORS = 4;
export const LOBBY_GAP = Math.SQRT2 * LOBBY_RADIUS - 2 * LOBBY_R;

const WORDS = ['THIS WAY, PLEASE', 'IF YOU WOULD, SIR'];

/** One door. `bornAt` / `until` are `performance.now()` milliseconds: it stands from `bornAt` (after its rise) until `until`. */
export interface DoorRec {
  /** Unique per figure, the same on both screens (a count of the doors made at the casts, wrapping at 900): the break message names it. */
  id: number;
  kind: 'door' | 'lobby';
  x: number;
  z: number;
  /** The way it faces (a lobby door faces the middle of its ring). */
  yaw: number;
  /** The brass number it and its pair carry. */
  num: number;
  bornAt: number;
  until: number;
  gone: boolean;
  goneAt: number;
  /** It ended by a hit (not by time or by making room). */
  broke: boolean;
  /** The other screen has been told it broke (or told us). */
  told: boolean;
  /** The 40 HP unit that takes the hits (only where `ctx.summon` exists: the screen that decides hits). */
  unit: SummonUnit | null;
  /** The cast that made it: the unit and the bolt list are reached through it. */
  ctx: CastContext | null;
  /** A lobby door: the one opposite. */
  mate: DoorRec | null;
}

/** The Grand Lobby's ring. `bolts`: its two pairs (opposite doors) as the projectile system wants them. */
export interface LobbyRec {
  x: number;
  z: number;
  bornAt: number;
  until: number;
  gone: boolean;
  doors: DoorRec[];
  bolts: BoltDoor[];
}

/** What one hero is doing about doors: the doors he has been seen clear of (so he can be taken), the time he is left alone until, where he was. */
export interface Traveller {
  seen: Set<number>;
  lockUntil: number;
  lastX: number;
  lastZ: number;
  has: boolean;
}

/**
 * What Wick leaves behind, per figure (the effects play on both screens and the CPU reuses one effect per spell, so the doors live
 * here). `pair`: the one `BoltDoor` in the bolt list while his two doors stand. `list`: that list (`ctx.doors()`).
 * `cpuAt`: when the CPU last let him cast Door (`aiHold`). `self` / `foe`: the travellers on his own client / on the victim's screen.
 */
export interface DoorBook {
  seq: number;
  /** Rings made so far: each ring's doors get ids of their own, so a hero already inside a new door's reach is not taken by it. */
  rings: number;
  num: number;
  doors: DoorRec[];
  lobby: LobbyRec | null;
  pair: BoltDoor | null;
  pairIds: number[];
  list: BoltDoor[] | null;
  cpuAt: number;
  clock: number;
  self: Traveller;
  foe: Traveller;
}
export const doorBooks = new WeakMap<object, DoorBook>();

const newTraveller = (): Traveller => ({ seen: new Set(), lockUntil: 0, lastX: 0, lastZ: 0, has: false });

export function bookOf(who: object): DoorBook {
  let b = doorBooks.get(who);
  if (!b) {
    b = { seq: 0, rings: 0, num: 0, doors: [], lobby: null, pair: null, pairIds: [], list: null, cpuAt: 0, clock: 0, self: newTraveller(), foe: newTraveller() };
    doorBooks.set(who, b);
  }
  return b;
}

/** Takes the cast's bolt list (`ctx.doors()`), where there is one (not in the VFX tool). */
export function bindList(b: DoorBook, ctx: CastContext) {
  const l = ctx.doors?.();
  if (l) b.list = l;
}

/** Placed (rising or standing, not gone, not out of time), and standing (risen). */
export const placed = (d: DoorRec, now = performance.now()) => !d.gone && now < d.until;
export const standing = (d: DoorRec, now = performance.now()) => !d.gone && now >= d.bornAt && now < d.until;

/** His plain doors that are placed (oldest first), and that stand. */
export function placedDoors(b: DoorBook, now = performance.now()) {
  return b.doors.filter((d) => d.kind === 'door' && placed(d, now)).sort((a, c) => a.bornAt - c.bornAt);
}
export function standingDoors(b: DoorBook, now = performance.now()) {
  return b.doors.filter((d) => d.kind === 'door' && standing(d, now));
}

/** The summoned unit's look: nothing (the bell beside the door is drawn by the marks); only its HP bar, over the bell. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: BELL_TOP + 0.3 });

/** Ends a door now: the unit runs out. `broke`: a hit did it. Safe to call twice. */
export function dropDoor(d: DoorRec, broke: boolean) {
  if (d.gone) return;
  d.gone = true;
  d.broke = broke;
  d.goneAt = performance.now();
  if (d.unit?.alive) d.unit.left = 0;
}

/**
 * A door made at a cast: it stands after `rise` s for `life` s. Two at most: a third (the CPU, or a cast that raced) makes the oldest
 * go. The second door of a pair takes the first's brass number. Writes it to the book (both screens do, so the ids agree).
 */
export function newDoor(b: DoorBook, x: number, z: number, rise = DOOR_RISE, life = DOOR_LIFE): DoorRec {
  const now = performance.now();
  const live = placedDoors(b, now);
  while (live.length >= DOOR_MAX) dropDoor(live.shift()!, false);
  const lone = live[0];
  let num: number;
  if (lone) num = lone.num;
  else { b.num = (b.num % 9) + 1; num = b.num; }
  const bornAt = now + rise * 1000;
  const d: DoorRec = {
    id: (b.seq = (b.seq % 900) + 1), kind: 'door', x, z, yaw: 0, num, bornAt, until: bornAt + life * 1000,
    gone: false, goneAt: 0, broke: false, told: false, unit: null, ctx: null, mate: null,
  };
  b.doors = b.doors.filter((k) => !k.gone || now - k.goneAt < 1500);
  b.doors.push(d);
  return d;
}

/** Gives a risen door its 40 HP unit, where `ctx.summon` exists (the screen that decides hits), on the bell beside it. */
export function attachUnit(ctx: CastContext, d: DoorRec) {
  const now = performance.now();
  const sm = ctx.summon?.({
    kind: 'turret', at: new THREE.Vector3(d.x + BELL_X, 0, d.z), hp: DOOR_HP, seconds: Math.max(0.2, (d.until - now) / 1000 + 0.1),
    damage: 0, attackEvery: 999, range: 0.01, color: DOOR_CSS.brass, look: HIDDEN,
  });
  d.unit = sm?.units[0] ?? null;
  sm?.onDeath((u) => dropDoor(d, u.slain));
}

/** The door rises: its unit, and the bolt list it may go in. */
export function raiseDoor(ctx: CastContext, d: DoorRec) {
  d.ctx = ctx;
  if (d.kind === 'door' && !d.unit && !d.gone) attachUnit(ctx, d);
}

/**
 * The Grand Lobby: four doors on a ring of `LOBBY_RADIUS` round (`x`, `z`), the first at the angle `a0`, standing from `rise` s for `life` s.
 * They are not counted against the two-door limit and have no HP. Each is the other's mate across the ring.
 */
export function newLobby(b: DoorBook, x: number, z: number, a0: number, rise = LOBBY_WIND, life = LOBBY_LIFE): LobbyRec {
  const now = performance.now(), bornAt = now + rise * 1000, until = bornAt + life * 1000;
  if (b.lobby) endLobby(b);
  const doors: DoorRec[] = [];
  const base = 1000 + (b.rings = (b.rings + 1) % 1000) * LOBBY_DOORS;
  for (let k = 0; k < LOBBY_DOORS; k++) {
    const a = a0 + (k / LOBBY_DOORS) * Math.PI * 2, dx = x + Math.sin(a) * LOBBY_RADIUS, dz = z + Math.cos(a) * LOBBY_RADIUS;
    doors.push({
      id: base + k, kind: 'lobby', x: dx, z: dz, yaw: Math.atan2(x - dx, z - dz), num: 0, bornAt, until,
      gone: false, goneAt: 0, broke: false, told: false, unit: null, ctx: null, mate: null,
    });
  }
  doors.forEach((d, k) => { d.mate = doors[(k + LOBBY_DOORS / 2) % LOBBY_DOORS]; });
  const bolts: BoltDoor[] = [0, 1].map((k) => ({ ax: doors[k].x, az: doors[k].z, bx: doors[k + 2].x, bz: doors[k + 2].z, r: LOBBY_R }));
  b.lobby = { x, z, bornAt, until, gone: false, doors, bolts };
  b.doors = b.doors.filter((k) => k.kind !== 'lobby' || !k.gone).concat(doors);
  return b.lobby;
}

/** Ends the ring now (fizzled, or a new one). */
export function endLobby(b: DoorBook) {
  const L = b.lobby;
  if (!L) return;
  L.gone = true;
  for (const d of L.doors) dropDoor(d, false);
  syncBolts(b);
}

/**
 * Keeps the bolt list true to what stands: ONE `BoltDoor` for his two doors while both stand (the same object all that time, because a
 * bolt that came through remembers it), and the ring's two while it stands. Safe to call every frame, from either client.
 */
export function syncBolts(b: DoorBook, now = performance.now()) {
  const list = b.list;
  if (!list) return;
  const st = standingDoors(b, now);
  const ids = st.length === 2 ? st.map((d) => d.id).sort((a, c) => a - c) : [];
  const same = !!b.pair && ids.length === 2 && b.pairIds[0] === ids[0] && b.pairIds[1] === ids[1];
  if (!same) {
    if (b.pair) {
      const i = list.indexOf(b.pair);
      if (i >= 0) list.splice(i, 1);
      b.pair = null;
    }
    b.pairIds = [];
    if (ids.length === 2) {
      b.pair = { ax: st[0].x, az: st[0].z, bx: st[1].x, bz: st[1].z, r: DOOR_R };
      b.pairIds = ids;
      list.push(b.pair);
    }
  } else if (b.pair && !list.includes(b.pair)) list.push(b.pair);
  const L = b.lobby;
  const up = !!L && !L.gone && now >= L.bornAt && now < L.until;
  for (const bd of L?.bolts ?? []) {
    const at = list.indexOf(bd);
    if (up && at < 0) list.push(bd);
    else if (!up && at >= 0) list.splice(at, 1);
  }
}

/** A door that stands, with the door it leads to and its reach. */
interface Port { d: DoorRec; mate: DoorRec; r: number }

function portsOf(b: DoorBook, now: number): Port[] {
  const out: Port[] = [];
  const st = standingDoors(b, now);
  if (st.length === 2) out.push({ d: st[0], mate: st[1], r: DOOR_R }, { d: st[1], mate: st[0], r: DOOR_R });
  const L = b.lobby;
  if (L && !L.gone && now >= L.bornAt && now < L.until) for (const d of L.doors) if (d.mate) out.push({ d, mate: d.mate, r: LOBBY_R });
  return out;
}

/** The step that takes a hero at (`px`, `pz`) through a door, or null. Keeps that hero's `Traveller` up to date: call it every frame. */
function travel(b: DoorBook, tv: Traveller, px: number, pz: number, time: number, now: number, canMove: boolean) {
  const ports = portsOf(b, now);
  const mx = px - tv.lastX, mz = pz - tv.lastZ;
  tv.lastX = px;
  tv.lastZ = pz;
  const moved = tv.has;
  tv.has = true;
  let hit: Port | null = null;
  for (const p of ports) {
    const d = Math.hypot(px - p.d.x, pz - p.d.z);
    if (d > p.r + OFF_MARGIN) tv.seen.add(p.d.id);
    // He must have been seen clear of the door first (a door put down on him does not take him) and be past his lock.
    else if (d <= p.r && !hit && canMove && time >= tv.lockUntil && tv.seen.has(p.d.id)) hit = p;
  }
  if (tv.seen.size > 16) for (const id of [...tv.seen]) if (!b.doors.some((k) => k.id === id && !k.gone)) tv.seen.delete(id);
  if (!hit) return null;
  const { d, mate } = hit;
  let ex: number, ez: number;
  if (d.kind === 'lobby' && b.lobby) {
    // Set down inside the ring at the far side.
    const ix = b.lobby.x - mate.x, iz = b.lobby.z - mate.z, l = Math.hypot(ix, iz) || 1;
    ex = mate.x + (ix / l) * LOBBY_EXIT;
    ez = mate.z + (iz / l) * LOBBY_EXIT;
  } else {
    // Out of the far door, going the way he was going (else away from the door he walked into).
    let dx = mx, dz = mz, l = Math.hypot(dx, dz);
    if (!moved || l < 1e-4) { dx = px - d.x; dz = pz - d.z; l = Math.hypot(dx, dz); }
    if (l < 1e-4) { dx = 0; dz = 1; l = 1; }
    ex = mate.x + (dx / l) * EXIT_AHEAD;
    ez = mate.z + (dz / l) * EXIT_AHEAD;
  }
  tv.lockUntil = time + TAKE_LOCK;
  tv.seen.clear();
  return { dx: ex - px, dz: ez - pz };
}

/** A new round clears the book (the arena has already emptied the bolt list and the units). */
function newRound(b: DoorBook, time: number) {
  if (time + 0.5 < b.clock) {
    for (const d of b.doors) dropDoor(d, false);
    b.doors = [];
    b.lobby = null;
    b.pair = null;
    b.pairIds = [];
    b.self = newTraveller();
    b.foe = newTraveller();
  }
  b.clock = time;
}

const spot = new THREE.Vector3();

/** What both clients keep true each frame: doors that ran out, the bolt list. */
function maintain(b: DoorBook, now: number) {
  for (const d of b.doors) if (!d.gone && now >= d.until + 100) dropDoor(d, false);
  if (b.lobby && !b.lobby.gone && now >= b.lobby.until + 100) b.lobby.gone = true;
  syncBolts(b, now);
}

function booksOf(t: TraitView) {
  return doorBooks.get(t.self());
}

/**
 * Wick, the Doorman (controller, ranged). Passive This Way, Please: two doors at a time, placed with Door. Anyone who walks into one
 * leaves by the other, and a bolt of either side that flies into one comes out of the other, going the same way. A door has 40 HP.
 *
 * Where each rule runs. The doors are `doorBooks` records the spells write on BOTH screens at the cast (ids count the doors made), and
 * they stand after the rise: `marks` draws each on both screens, with the same brass number on the two of a pair. The bolt list
 * (`ctx.doors()`) gets one `BoltDoor` while two stand, kept up to date by `syncBolts` from every hook that runs. The enemy's trip is
 * decided where its position is decided: `victimTick` (the victim's screen) calls `carryEnemy`. His own trip is `tick` (his own
 * client) calling `carrySelf`. Each hero has a 1 s lock after a trip and must have been seen clear of a door's reach before it can take
 * him; a door put down on top of a hero does not take him until he has stepped off and back. A door's 40 HP is a hidden `turret` unit
 * on the bell beside it (made where `ctx.summon` exists: the victim's screen), so bolts that come out of a door do not hit it by
 * accident; its death is told to his own client with `noteOwner('broke')`. Doors are NOT obstacles: a hero walks into one.
 */
export const doorTrait: Trait = {
  meter: { name: 'DOORS', max: 2, value: (t) => { const b = booksOf(t); return b ? placedDoors(b).length : 0; } },
  passive: {
    name: 'This Way, Please',
    blurb: 'Two doors at a time (Door), standing 10 s, 40 HP each, with the same brass number on both. Anyone who walks into one leaves by the other, and a bolt that flies in comes out of the other, going the same way, whoever shot it. A hero is left alone for 1 s after a trip.',
  },
  twist: {
    name: 'A Door For Whom',
    blurb: 'A door put down to escape is not there to shoot through. Use his doors against him, or break the bell by one. Without them he is a weak old man.',
  },
  speed: 4,
  attack: { kind: 'ranged', range: 6, damage: 13, interval: 1.0, windup: 0.25, speed: 20, look: 'dart' },
  charges: { slot: 1, count: DOOR_CHARGES, every: DOOR_EVERY },
  canCast(t, slot) {
    const b = booksOf(t);
    const now = performance.now();
    if (slot === 1 && b && placedDoors(b, now).length >= DOOR_MAX) return 'Both doors stand';
    if (slot === 2 && (!b || standingDoors(b, now).length === 0)) return 'No door stands';
    return null;
  },
  afterCast(t, slot) {
    const sayAt = t.mem.sayAt ?? -99;
    if (slot === 0) t.say('ALLOW ME', DOOR_CSS.hot);
    else if (slot === 1 && t.time - sayAt > 4) { t.mem.sayAt = t.time; t.say('ONE MOMENT, SIR', DOOR_CSS.hot); }
    else if (slot === 2) t.say('MIND THE DOOR', DOOR_CSS.hot);
    else if (slot === 3) t.say('THE GRAND LOBBY', DOOR_CSS.hot);
  },
  /**
   * The CPU casts Door only with fewer than two doors standing. `cpuAt` tells the spell the CPU is casting (this runs just before its
   * cast), so the first door goes near him and the second where it aims, at the enemy. Slam only with a door of his within 1.5 m of the
   * enemy. The Grand Lobby only with the enemy within 9 m.
   */
  aiHold(t, slot, dist) {
    const b = booksOf(t);
    const now = performance.now();
    if (slot === 1) {
      if (b && placedDoors(b, now).length >= DOOR_MAX) return true;
      bookOf(t.self()).cpuAt = now;
      return false;
    }
    if (slot === 2) {
      const en = t.enemy();
      if (!b || !en) return true;
      const p = en.group.position;
      return !standingDoors(b, now).some((d) => Math.hypot(d.x - p.x, d.z - p.z) <= SLAM_RADIUS);
    }
    if (slot === 3) return dist > LOBBY_RANGE;
    return false;
  },
  /** The CPU's way out: an enemy within 3 m (the traits cannot see a kit's `melee`, so this stands for a melee enemy) and a door within 4 m of him that leads far from it: walk into it. */
  aiGoal(t) {
    const b = booksOf(t), en = t.enemy();
    if (!b || !en || t.enemyDistance() > 3) return null;
    const now = performance.now(), me = t.self().group.position, ep = en.group.position;
    if (t.time < b.self.lockUntil) return null;
    const here = Math.hypot(me.x - ep.x, me.z - ep.z);
    let best: Port | null = null, bd = 4;
    for (const p of portsOf(b, now)) {
      if (!b.self.seen.has(p.d.id)) continue;
      const d = Math.hypot(p.d.x - me.x, p.d.z - me.z);
      if (d >= bd) continue;
      if (Math.hypot(p.mate.x - ep.x, p.mate.z - ep.z) < Math.max(4, here + 2)) continue;
      best = p;
      bd = d;
    }
    return best && { x: best.d.x, z: best.d.z };
  },
  marks(t) {
    const b = booksOf(t);
    if (!b || b.doors.length === 0) return [];
    const now = performance.now(), out: GroundMark[] = [];
    const pair = standingDoors(b, now);
    const paired = pair.length === 2;
    for (const d of b.doors) {
      if (d.kind === 'door') {
        if (standing(d, now)) out.push({ x: d.x, z: d.z, kind: `${paired ? 'd' : 'l'}${d.num}`, age: (now - d.bornAt) / 1000, life: (d.until - d.bornAt) / 1000, yaw: 0 });
        else if (d.gone && d.broke && now >= d.bornAt && now - d.goneAt < 700) out.push({ x: d.x, z: d.z, kind: 'broken', age: (now - d.goneAt) / 1000, life: 0.7, yaw: 0 });
      } else if (standing(d, now)) out.push({ x: d.x, z: d.z, kind: 'grand', age: (now - d.bornAt) / 1000, life: (d.until - d.bornAt) / 1000, yaw: d.yaw });
    }
    if (paired) {
      const a = pair[0], c = pair[1], born = Math.max(a.bornAt, c.bornAt), end = Math.min(a.until, c.until);
      out.push({
        x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, kind: 'thread', age: (now - born) / 1000, life: Math.max(0.1, (end - born) / 1000),
        yaw: Math.atan2(c.x - a.x, c.z - a.z), length: Math.hypot(c.x - a.x, c.z - a.z),
      });
    }
    const L = b.lobby;
    if (L && !L.gone && now >= L.bornAt && now < L.until) out.push({ x: L.x, z: L.z, kind: 'lring', age: (now - L.bornAt) / 1000, life: (L.until - L.bornAt) / 1000 });
    return out;
  },
  markLook: (() => {
    const look: Record<string, () => THREE.Object3D> = { broken: brokenLook, thread: threadLook, grand: grandDoorLook, lring: () => lobbyRingLook(LOBBY_RADIUS, LOBBY_DOORS) };
    for (let n = 1; n <= 9; n++) { look[`d${n}`] = pairDoorLook(n, true); look[`l${n}`] = pairDoorLook(n, false); }
    return look;
  })(),
  /** His own client: his doors run out, and his own trip through one. */
  tick(t) {
    const b = booksOf(t);
    if (!b) return;
    newRound(b, t.time);
    maintain(b, performance.now());
    const me = t.self(), p = me.group.position;
    const step = travel(b, b.self, p.x, p.z, t.time, performance.now(), !t.status(me)?.cannotMove);
    if (!step) return;
    t.carrySelf(step.dx, step.dz);
    t.say(WORDS[0], DOOR_CSS.hot);
  },
  /** The screen that decides hits: the doors' units sit on their bells, doors run out, a break is told to his client, the enemy takes a trip. */
  victimTick(t) {
    const b = booksOf(t);
    if (!b) return;
    newRound(b, t.time);
    const now = performance.now();
    maintain(b, now);
    for (const d of b.doors) {
      if (d.kind !== 'door' || d.gone || now < d.bornAt) continue;
      if (!d.unit && d.ctx?.summon) attachUnit(d.ctx, d);
      if (d.unit?.alive) {
        d.unit.pos.copy(spot.set(d.x + BELL_X, 0, d.z));
        d.unit.knock.set(0, 0, 0);
      }
    }
    const broke = b.doors.find((k) => k.broke && !k.told && k.unit);
    if (broke) { broke.told = true; t.noteOwner('broke', broke.id); }
    const en = t.enemy();
    if (!en) return;
    const p = en.group.position;
    const step = travel(b, b.foe, p.x, p.z, t.time, now, !t.status(en)?.cannotMove);
    if (!step) return;
    t.carryEnemy(step.dx, step.dz);
    t.say(WORDS[Math.floor(t.time) % WORDS.length], DOOR_CSS.hot);
  },
  peerNote(t, name, n) {
    if (name !== 'broke') return;
    const d = booksOf(t)?.doors.find((k) => k.id === n && k.kind === 'door');
    if (d) { d.told = true; dropDoor(d, true); }
  },
  badge(t) {
    const b = booksOf(t);
    const n = b ? placedDoors(b).length : 0;
    return n > 0 ? String(n) : '';
  },
};
