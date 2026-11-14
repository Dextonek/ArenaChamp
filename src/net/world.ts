/**
 * The Climb's open world on the page's one connection (pipeline/designs/climb-open-world.md, stage 1: presence). A signed-in player
 * who walks a Climb floor is put in one of its shards on the hub and sees the others there: their heroes walk, cast (the look only),
 * fall and leave. This is the wire: it joins and leaves, sends this hero's place and casts, and hands what the hub says to whoever
 * draws the others (`WorldSink`, src/tower/world/others.ts). Not signed in, or with no connection, it does nothing and the Climb plays
 * alone as before. The messages are in docs/architecture/multiplayer.md ("The Climb's open world, stage 1").
 */

import { WORLD } from '../../server/protocol.mjs';
import type { NetClient } from './client';

/** Another player in this floor's shard, as the hub says it. `hp`: the share of its health, 0 when it has fallen. */
export interface WorldPlayer {
  id: number;
  name: string;
  hero: string;
  x: number;
  z: number;
  yaw: number;
  walk?: boolean;
  hp?: number;
}

/** Who draws the others: what the hub says, as it comes. */
export interface WorldSink {
  /** The shard as it is now (on joining, and on joining again after a drop): everyone else in it. */
  roster(shard: string, players: WorldPlayer[]): void;
  /** Someone came in, or changed hero. */
  joined(p: WorldPlayer): void;
  moved(id: number, x: number, z: number, yaw: number, walk: boolean, hp: number, ts?: number): void;
  cast(id: number, label: string, x: number, z: number, tx: number, tz: number): void;
  left(id: number): void;
  /** No shard any more (left, signed out, connection lost): everyone else goes. */
  clear(): void;
}

/** What the Climb needs of the open world: the floor it is on, its hero's place and casts. */
export interface WorldPresence {
  /** Signed in and connected now: a floor joined is shared. */
  readonly online: boolean;
  /** Where the hub's news goes (the Climb's drawing of the others), or null. */
  sink: WorldSink | null;
  join(floor: number, hero: string, x: number, z: number, yaw: number): void;
  leave(): void;
  /** This hero's place, as often as the page likes: it goes out `WORLD.sendHz` times a second at most, and only when it changed. */
  move(x: number, z: number, yaw: number, walk: boolean, hp: number): void;
  cast(label: string, x: number, z: number, tx: number, tz: number): void;
}

/** A place is the same to the centimetre; a facing to a hundredth of a radian; health to a hundredth. */
const SAME_M = 0.01, SAME_YAW = 0.01, SAME_HP = 0.01;

export class WorldLink implements WorldPresence {
  sink: WorldSink | null = null;
  private signedIn = false;
  private connected = false;
  /** The floor and hero the Climb is on, kept so a connection that comes back joins again. */
  private want: { floor: number; hero: string } | null = null;
  private joined = false;
  /** The shard as the hub named it, and how many others are in it. */
  shard = '';
  private last = { x: NaN, z: NaN, yaw: NaN, walk: false, hp: NaN, at: -Infinity };

  constructor(private net: NetClient) {
    net.on('session', () => {
      this.signedIn = true;
      this.connected = true;
      // Signed in again after a drop (a deploy, a sleep): back on the floor.
      if (this.want) this.sendJoin();
    });
    net.on('logged_out', () => { this.signedIn = false; this.lost(); });
    net.on('auth_error', (m) => { if (!m.error) { this.signedIn = false; this.lost(); } });
    net.on('socket', (m) => {
      this.connected = m.open;
      // The hub dropped this connection from its shard; a resume signs in again (`session`) and joins.
      if (!m.open) { this.signedIn = false; this.lost(); }
    });
    net.on('world_roster', (m) => {
      if (!this.want || m.floor !== this.want.floor) return;
      this.shard = m.shard;
      this.sink?.roster(m.shard, m.players);
    });
    net.on('world_joined', (m) => { if (this.joined) this.sink?.joined(m); });
    net.on('world_moved', (m) => { if (this.joined) this.sink?.moved(m.id, m.x, m.z, m.yaw, !!m.walk, m.hp ?? 1, m.ts); });
    net.on('world_cast', (m) => { if (this.joined) this.sink?.cast(m.id, m.label, m.x, m.z, m.tx, m.tz); });
    net.on('world_left', (m) => { if (this.joined) this.sink?.left(m.id); });
  }

  get online() {
    return this.signedIn && this.connected && this.net.open;
  }

  join(floor: number, hero: string, x: number, z: number, yaw: number) {
    const same = this.want && this.want.floor === floor && this.want.hero === hero && this.joined;
    this.want = { floor, hero };
    this.last.x = x;
    this.last.z = z;
    this.last.yaw = yaw;
    if (!same) this.sendJoin();
  }

  leave() {
    const was = this.joined;
    this.want = null;
    this.joined = false;
    this.shard = '';
    this.sink?.clear();
    if (was && this.online) this.net.send({ t: 'world_leave' });
  }

  move(x: number, z: number, yaw: number, walk: boolean, hp: number) {
    if (!this.joined || !this.online) return;
    const l = this.last, now = performance.now();
    if (now - l.at < 1000 / WORLD.sendHz - 2) return;
    if (Math.abs(x - l.x) < SAME_M && Math.abs(z - l.z) < SAME_M && Math.abs(Math.atan2(Math.sin(yaw - l.yaw), Math.cos(yaw - l.yaw))) < SAME_YAW
      && walk === l.walk && Math.abs(hp - l.hp) < SAME_HP) return;
    l.x = x; l.z = z; l.yaw = yaw; l.walk = walk; l.hp = hp; l.at = now;
    this.net.send({ t: 'world_move', x: mm(x), z: mm(z), yaw: mm(yaw), walk, hp: Math.round(hp * 100) / 100, ts: Math.round(now) });
  }

  cast(label: string, x: number, z: number, tx: number, tz: number) {
    if (!this.joined || !this.online) return;
    this.net.send({ t: 'world_cast', label, x: mm(x), z: mm(z), tx: mm(tx), tz: mm(tz) });
  }

  private sendJoin() {
    const w = this.want;
    if (!w || !this.online) return;
    this.joined = true;
    this.net.send({ t: 'world_join', floor: w.floor, hero: w.hero, x: mm(this.last.x || 0), z: mm(this.last.z || 0), yaw: mm(this.last.yaw || 0) });
    // The next place goes out at once.
    this.last.at = -Infinity;
    this.last.hp = NaN;
  }

  /** The connection or the session went: nobody else is drawn, and a join waits for the next session. */
  private lost() {
    this.joined = false;
    this.shard = '';
    this.sink?.clear();
  }
}

/** To the millimetre, as the duels send places. */
const mm = (v: number) => Math.round(v * 1000) / 1000;
