import { CLIMB_DOORS } from '../../../server/climb-packs.mjs';
import type { NetClient, ServerMsg } from '../../net/client';
import { NetLink } from '../../raid/net';
import type { BossDef } from '../../raid/types';
import type { GameApi } from '../../runtime';
import type { FloorDef } from './def';
import { doorRows } from './doorTable';
import type { SharedPiece } from './pieces/types';

/** How often this screen sends its hero's walk in a fight for two, and for more (the hub bundles a party's ten times a second). */
const MOVE_HZ = 20, PARTY_MOVE_HZ = 10;
/** This hero's HP goes to the partners' bars at most this often (ms). */
const HP_MS = 200;

type DoorStart = Extract<ServerMsg, { t: 'door_start' }>;

/**
 * A ruler's fight with others of the floor's shard, on this screen (the open world's stage 3, pipeline/designs/climb-open-world.md):
 * what `RaidController.stage` and its handlers do for a raid's fight (src/raid/coop.ts), for one door. The hub's `door_start` makes the
 * piece's `SharedPiece` (`begin`): a Raid `NetLink` for the ruler's def, the other heroes by seat. While it is on it hands the hub's
 * Raid messages to the fight (the ruler's casts and walk, its HP, phases, gauge and kneels, gold zones, objectives, walls, the partners'
 * walks, casts, bars, falls and revives, whose screen runs the brain) and sends this hero's walk, the ruler's walk when this screen runs
 * its brain (and a ping each second, so a brain that stands still keeps it), and this hero's HP. `door_end` says how it went (`end`).
 * Each handler acts only while a fight is on, so a raid's or a duel's messages on the same connection never reach it.
 */
export class DoorFight {
  active = false;
  private link: NetLink | null = null;
  private side = 0;
  private party: { side: number; name: string }[] = [];
  private timer = 0;
  private lastSent = '';
  private lastBoss = '';
  private lastHp = -1;
  private hpAt = 0;
  private pingAt = 0;
  private outcome: { won: boolean; hit: boolean } | null = null;
  /** What `door_start` and `boss_brain` said, for the two-tab test (`vfx.world.together.log`). */
  readonly log: string[] = [];
  /** The connection went mid-fight (a deploy drops every one): the fight ends here with nothing counted (no outcome: `none`). */
  private lost() {
    this.log.push(`${Math.round(performance.now())} connection lost`);
    this.outcome = null;
    this.link?.on.end('lose');
  }

  constructor(private net: NetClient, private api: GameApi) {
    const on = () => this.active;
    const fight = () => (this.active ? api.duel.boss : null);
    const who = (side?: number) => side ?? this.party[0]?.side ?? 1 - this.side;
    net.on('match_fight', (m) => { if (on()) api.duel.countdownFrom(m.countdown); });
    net.on('peer_move', (m) => { if (on()) api.duel.partnerMove(who(m.side), m.x, m.z, m.yaw, m.ts); });
    net.on('party_moves', (m) => {
      if (!on()) return;
      for (const [side, x, z, yaw, ts] of m.list) if (side !== this.side) api.duel.partnerMove(side, x, z, yaw, ts ?? undefined);
    });
    net.on('peer_cast', (m) => { if (on()) api.duel.partnerCast(who(m.side), m); });
    net.on('peer_attack', (m) => { if (on()) api.duel.partnerAttack(who(m.side)); });
    net.on('peer_form', (m) => { if (on()) api.duel.partnerForm(who(m.side), m.alt); });
    net.on('peer_debuff', (m) => { if (on()) api.duel.bossDebuff(m.kind, m.amount, m.seconds, m.which); });
    net.on('boss_cast', (m) => { if (on()) this.link?.on.cast(m); });
    net.on('boss_move', (m) => fight()?.bossMove(m.x, m.z, m.yaw, m.ts, m.which));
    net.on('boss_hp', (m) => { if (on()) this.link?.on.hp?.(m.hp, m.which); });
    net.on('boss_phase', (m) => { if (on()) this.link?.on.phase(m.phase, m.which); });
    net.on('boss_gauge', (m) => { if (on()) this.link?.on.stagger(m.value, m.which); });
    net.on('boss_kneel', (m) => { if (on()) this.link?.on.kneel(m.seconds, m.which); });
    net.on('boss_stood', (m) => { if (on()) this.link?.on.stood(m.id, m.part, m.count); });
    net.on('boss_done', (m) => { if (on()) this.link?.on.done(m.id, m.part, m.side); });
    net.on('peer_add', (m) => { if (on()) this.link?.on.addHit?.(m.id, m.part, m.amount); });
    net.on('boss_wall', (m) => { if (on()) this.link?.on.wall(m.index); });
    net.on('partner_hp', (m) => { if (on()) api.duel.partnerHp(who(m.side), m.hp, m.max); });
    net.on('peer_down', (m) => { if (on()) api.duel.raidDown(m.side); });
    net.on('revived', (m) => { if (on()) api.duel.raidRevived(m.side, m.hp, m.left); });
    net.on('partner_left', (m) => {
      if (!on()) return;
      const side = who(m.side);
      this.party = this.party.filter((p) => p.side !== side);
      api.duel.partnerLeft(side);
    });
    net.on('boss_brain', (m) => {
      if (!on()) return;
      this.log.push(`${Math.round(performance.now())} boss_brain ${m.side}`);
      fight()?.takeBrain(m.which);
    });
    net.on('brain_moved', (m) => {
      if (!on()) return;
      this.log.push(`${Math.round(performance.now())} brain_moved ${m.side}`);
      if (m.side !== this.side) fight()?.dropBrain(m.which);
    });
    net.on('socket', (m) => { if (!m.open && on()) this.lost(); });
  }

  /** The hub began a fight of the party behind a door: this screen's part in it, for `startPiece`. */
  begin(m: DoorStart): SharedPiece | null {
    const { api, net } = this;
    const party = m.party.filter((p) => p.side !== m.side).map((p) => ({ side: p.side, name: p.name, kit: api.kits.find((k) => k.name === p.hero) }));
    if (party.some((p) => !p.kit)) return null;
    this.stop();
    this.active = true;
    this.side = m.side;
    this.party = party.map((p) => ({ side: p.side, name: p.name }));
    this.outcome = null;
    this.lastSent = this.lastBoss = '';
    this.lastHp = -1;
    this.log.push(`${Math.round(performance.now())} door_start side ${m.side} of ${m.n}, brain ${m.brain}, hp ${m.hp}`);
    const hz = party.length > 1 ? PARTY_MOVE_HZ : MOVE_HZ;
    this.timer = window.setInterval(() => this.send(), 1000 / hz);
    return {
      link: (_def: BossDef) => (this.link = new NetLink(net, m.side, m.hp, m.brain === m.side, m.staggerMax)),
      party: party.map((p) => ({ side: p.side, name: p.name, kit: p.kit! })),
      name: m.you.name,
      n: m.n,
      dmg: m.dmg,
      loaded: (maxHp) => { if (this.active) net.send({ t: 'match_loaded', maxHp }); },
      result: () => this.outcome,
      stop: () => this.stop(true),
    };
  }

  /** The hub says the fight is over: its outcome for this player, then the fight's end on this screen. */
  end(m: Extract<ServerMsg, { t: 'door_end' }>) {
    if (!this.active) return;
    this.outcome = { won: m.result === 'won', hit: m.hit };
    this.log.push(`${Math.round(performance.now())} door_end ${m.result} hit ${m.hit}`);
    this.link?.on.end(m.result === 'won' ? 'win' : 'lose');
  }

  /** Off: no more sending, and nothing the hub says reaches the fight. `leave`: the hub is told this player left (it ended early here). */
  stop(leave = false) {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.timer);
    if (leave && !this.outcome && this.net.open) this.net.send({ t: 'match_leave' });
    this.link = null;
  }

  /** As `RaidController.sendMove`: this hero's walk, the ruler's when this screen runs its brain, a ping, this hero's HP. */
  private send() {
    if (!this.active) return;
    const { api, net, link } = this, c = api.arena.caster.group;
    const x = +c.position.x.toFixed(3), z = +c.position.z.toFixed(3), yaw = +c.rotation.y.toFixed(3), key = `${x},${z},${yaw}`;
    const ts = Math.round(performance.now());
    if (key !== this.lastSent) {
      this.lastSent = key;
      net.send({ t: 'move', x, z, yaw, ts });
    }
    // The hub moves the brain from a screen it hears nothing from for 4 s: a brain standing still says so once a second.
    if (link?.brain && ts - this.pingAt >= 1000) {
      this.pingAt = ts;
      net.send({ t: 'ping' });
    }
    const foe = api.duel.bossFigure;
    if (link?.brain && foe) {
      const bx = +foe.group.position.x.toFixed(3), bz = +foe.group.position.z.toFixed(3), byaw = +foe.group.rotation.y.toFixed(3), bkey = `${bx},${bz},${byaw}`;
      if (bkey !== this.lastBoss) {
        this.lastBoss = bkey;
        net.send({ t: 'boss_move', x: bx, z: bz, yaw: byaw, ts });
      }
    }
    const hp = Math.round(api.duel.heroHp);
    if (hp !== this.lastHp && ts - this.hpAt >= HP_MS) {
      this.lastHp = hp;
      this.hpAt = ts;
      link?.heroHp(hp);
    }
  }
}

/**
 * The ruler's doors this floor has, as the hub's table says (only those can be fought together). A crown floor's lair (a Raid boss) is
 * fought alone for now: its party fight was not played in two tabs.
 */
export function sharedDoors(floor: FloorDef) {
  const t = CLIMB_DOORS[floor.n];
  if (!t || t.ruler.crown || !t.ruler.hp) return new Set<string>();
  return new Set(t.doors.filter((d) => d[1] === 'ruler').map((d) => d[0]));
}

/** On the dev server: says in the console when the hub's table of this floor's doors and ruler is older than the floor. */
export function checkDoorTable(floor: FloorDef) {
  if (!import.meta.env.DEV) return;
  const now = JSON.stringify(doorRows(floor)), table = JSON.stringify(CLIMB_DOORS[floor.n] ?? null);
  if (now !== table) console.warn(`[climb] floor ${floor.n}'s doors or ruler differ from server/climb-packs.mjs: run node pipeline/tools/climb-packs.mjs`);
}
