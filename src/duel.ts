import * as THREE from 'three';
import type { Arena } from './arena';
import type { Enemy } from './effects/common';
import { TelegraphLayer, insideTelegraph, type TelegraphSpec } from './effects/telegraph';
import { BODY_RADIUS } from './effects/projectile';
import { MAX_UNITS, type SummonSide, type SummonStats } from './effects/summon';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import type { HeroKit } from './heroes';
import { HeroFigure } from './heroFigure';
import { DUEL_OBSTACLES, buildObstacleMeshes } from './obstacles';
import type { HeroMode, Target } from './heroMode';

/** What the duel needs from main.ts. */
export interface DuelHost {
  arena: Arena;
  heroMode: HeroMode;
  kits: HeroKit[];
  /** The danger zones of the player's spell that was cast last (main.ts `zones`). */
  playerZones(): TelegraphSpec[];
  /** Plays a targeted effect for another caster (main.ts `castAs`); returns its danger zones. */
  castAs(label: string, ctx: CastContext): TelegraphSpec[];
  targeting(label: string): TargetingSpec | undefined;
}

/**
 * A network duel's link to the server (src/game/match.ts): the local hero's casts go out, and so do the hits and
 * dodges this side takes (each side decides the hits on its own hero, where it really stood at impact).
 */
export interface DuelNet {
  cast(msg: { id: number; slot: number; x: number; z: number; fx: number; fz: number; enemy: boolean }): void;
  tookHit(id: number, damage: number, color?: string): void;
  dodged(id: number): void;
}

/** A cast of the remote hero, as the server relays it. */
export interface PeerCast {
  id: number;
  slot: number;
  /** Aim point (ground spells) or where the target stood (single-target spells). */
  x: number;
  z: number;
  /** Where the caster stood. */
  fx: number;
  fz: number;
  /** Aimed at this side's hero (enemy / enemies spells). */
  enemy: boolean;
}

const RING = { x: 0, z: 7, r: 12 };
const PLAYER_START = new THREE.Vector3(0, 0, 13);
const OPPONENT_START = new THREE.Vector3(0, 0, 1);
const HP = 600; // default max HP (`HeroKit.maxHp` overrides it per side)
const AI_SPEED = 3.5;
// Network duel: the remote hero is drawn this far in the past (ms, two send intervals at 20 Hz) so there is always a
// next report to move toward; a gap longer than PEER_GAP means it stood still; casts snap it beyond PEER_SNAP (m).
const PEER_DELAY = 100;
const PEER_STEP = 50;
const PEER_GAP = 120;
const PEER_SNAP = 3;
const MELEE_GAP = 2; // a melee AI closes to about this distance (m)
const DODGE_RADIUS = 1.6; // a hit still lands within this distance of where the cast aimed
const BOLT_WINDOW = 0.6; // the AI reacts to a bolt that will cross its position within this many seconds (s)
const BOLT_DODGE_CHANCE = 0.65; // how often it really steps aside (a skillshot must still land sometimes)
const BOLT_REACTION = 0.12; // seconds between seeing the bolt and moving
const SUMMON_REACH = 10; // the AI casts a summon spell when the enemy is within this distance (m)
const UNIT_BLOCK = 2.5; // an enemy unit this close is shot at when nothing can be cast at the hero (m)

interface BoltDodge {
  /** The roll came up: this side steps off the bolt's line. */
  react: boolean;
  /** Which side of the line to step to (+1 / -1 along the line's left normal). */
  side: number;
  /** Duel time when it starts to move. */
  at: number;
}

interface EnemyCast {
  /** The remote caster's cast id (network duel). */
  id: number;
  /** The round it was cast in: hits from an earlier round's spells (still playing at a rematch) are ignored. */
  round: number;
  zones: TelegraphSpec[];
  aimed: THREE.Vector3;
  dodgedShown: boolean;
}

/**
 * A 1 vs 1 duel in hero mode: the player's hero against an AI hero of another kit, in a small ring. Both have 600
 * HP. The opponent walks, keeps its distance, strafes and casts its kit's spells on cooldown at the player; its
 * danger zones show before each hit, and a hit only lands if the player is still inside that cast's zones (or
 * close to where it aimed) when it lands, so walking out dodges it. Ends with a victory or defeat card and a
 * rematch. The two kits must differ (one effect instance per spell label).
 */
export class Duel {
  on = false;
  readonly group = new THREE.Group();
  /** 'random', a hero name, or a kit object (a hidden test kit that is not in `host.kits`). */
  opponentChoice: string | HeroKit = 'random';

  private opponentKit!: HeroKit;
  private foe: Enemy | null = null;
  private figure = new HeroFigure();
  private zones = new TelegraphLayer();
  private zoneClock = 0;
  private playerHp = HP;
  private playerMax = HP;
  private foeMax = HP;
  private cooldowns = [0, 0, 0, 0];
  private rooted = 0;
  private think = 0;
  private opponentAi = { strafe: 1, strafeT: 0 };
  private playerAi = { strafe: -1, strafeT: 0 };
  private playerThink = 0;
  /** Skillshot dodges: bolt id -> whether this side reacts, which way, and when it starts moving. */
  private opponentDodge = new Map<number, BoltDodge>();
  private playerDodge = new Map<number, BoltDodge>();
  /** Duel simulations: the player's hero is driven by the same AI as the opponent. */
  autopilot = false;
  /** 'play': the player against the AI. 'run': AI against AI to watch (the autopilot drives the player's hero). */
  mode: 'play' | 'run' = 'play';
  /** The last finished round (duel simulations read it). */
  result: { player: string; opponent: string; winner: string; seconds: number; playerHp: number; opponentHp: number; playerCasts: number; opponentCasts: number; playerDodges: number; units: Record<string, SummonStats> } | null = null;
  private stats = { playerCasts: 0, opponentCasts: 0, playerDodges: 0, opponentDodges: 0 };
  /** The player's recent casts (zones and aim), for the opponent's dodge check. */
  private playerCastsRecent: (EnemyCast & { t: number })[] = [];
  private time = 0;
  private over: 'win' | 'lose' | null = null;
  private overT = 0;
  private savedCount = 6;
  private round = 0;
  /** Network duel: the server link (null in the AI duel), the two player names, and the remote hero's last state. */
  net: DuelNet | null = null;
  private names: [string, string] = ['', ''];
  /** The remote hero's reported positions on this side's clock (ms, oldest first); drawn `PEER_DELAY` behind. */
  private peerTrack: { at: number; x: number; z: number; yaw: number }[] = [];
  /** This side's clock minus the sender's, from the quickest message so far (null: no sender clock yet). */
  private peerClock: number | null = null;
  private hitBypass = false;
  private castSeq = 0;
  private countdown = -1;
  private bannerT = 0;

  // HUD.
  private hud: HTMLDivElement;
  private bars: { fill: HTMLDivElement; shield: HTMLDivElement; text: HTMLDivElement; name: HTMLDivElement; portrait: HTMLCanvasElement }[] = [];
  private card: HTMLDivElement;
  private cardTitle: HTMLDivElement;
  private cardText: HTMLDivElement;
  private flash: HTMLDivElement;
  private banner: HTMLDivElement;
  private rematchButton!: HTMLButtonElement;
  private leaveButton!: HTMLButtonElement;

  constructor(private host: DuelHost) {
    this.group.add(this.buildRing(), this.zones.group, this.figure.group);
    this.group.visible = false;
    this.hud = this.buildHud();
    this.card = document.createElement('div');
    this.card.style.cssText =
      'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:9;display:none;flex-direction:column;' +
      'align-items:center;gap:10px;padding:22px 34px;border-radius:14px;background:rgba(8,6,10,0.92);' +
      'border:1px solid #6a5a3a;box-shadow:0 10px 40px rgba(0,0,0,0.7);font:600 13px ui-sans-serif,system-ui;color:#e9dcc6;';
    this.cardTitle = document.createElement('div');
    this.cardTitle.style.cssText = 'font:700 34px ui-serif,Georgia,serif;letter-spacing:3px;';
    this.cardText = document.createElement('div');
    this.cardText.style.cssText = 'opacity:0.8;';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;margin-top:6px;';
    const button = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      if (label === 'Rematch') this.rematchButton = b;
      else this.leaveButton = b;
      b.textContent = label;
      b.style.cssText =
        'padding:7px 16px;border-radius:7px;border:1px solid #8a7a52;background:#1e1a14;color:#f2e6c8;' +
        'font:600 13px ui-sans-serif,system-ui;cursor:pointer;';
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    };
    button('Rematch', () => this.start());
    button('Leave duel', () => this.onLeave?.());
    this.card.append(this.cardTitle, this.cardText, buttons);
    this.flash = document.createElement('div');
    this.flash.style.cssText =
      'position:fixed;inset:0;z-index:8;pointer-events:none;opacity:0;' +
      'box-shadow:inset 0 0 120px 30px rgba(220,30,40,0.85);';
    this.banner = document.createElement('div');
    this.banner.style.cssText =
      'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;display:none;' +
      'font:800 54px ui-serif,Georgia,serif;letter-spacing:4px;color:#ffd27a;text-shadow:0 4px 18px #000;';
    document.body.append(this.card, this.flash, this.banner);
  }

  /** main.ts: what "Leave duel" does (turns the duel off and syncs the panel). */
  onLeave?: () => void;

  /**
   * Console recipe, N AI fights with kit objects on either side (`vfx.testKits.melee` is a kit object):
   *   const v = vfx, K = v.testKits.melee; let w = 0;
   *   for (let i = 0; i < 10; i++) {
   *     v.heroMode.setKit(K);               // player side: a kit object (or v.heroPickCtrl.setValue('Lyra') for a hero)
   *     v.duel.opponentChoice = 'Lyra';     // opponent side: a hero name or a kit object
   *     v.duel.start('run');                // not v.setDuel(): it overwrites opponentChoice with the panel's string
   *     while (!v.duel.result) v.step(1 / 60);
   *     w += v.duel.result.winner === K.name;
   *   }
   */

  /** Starts (or restarts) a round against `opponentChoice`, never the player's own kit. */
  start(mode: 'play' | 'run' = this.mode) {
    this.mode = mode;
    this.net = null;
    const arena = this.host.arena, hm = this.host.heroMode;
    const run = mode === 'run';
    this.autopilot = run;
    hm.spectate = run;
    hm.focus = run ? new THREE.Vector3(RING.x, 0, RING.z) : null;
    const player = hm.currentKit;
    const others = this.host.kits.filter((k) => k.name !== player.name);
    const choice = this.opponentChoice;
    const picked = typeof choice === 'string' ? others.find((k) => k.name === choice) : choice;
    this.opponentKit = picked ?? others[Math.floor(Math.random() * others.length)];
    this.setup(PLAYER_START, OPPONENT_START);
    arena.hitFilter = (target, opts, cast) => this.opponentHit(target, opts, cast);
    arena.casterHeal = (amount) => this.healPlayer(amount);
    hm.onCast = () => this.recordPlayerCast();
  }

  /**
   * Starts a network duel against another player (src/game/match.ts): `opponent` is the other player's hero, `side`
   * 0 starts at the +Z end (like the AI duel), side 1 at the -Z end with the camera turned round. The hero stays
   * locked until `countdownFrom` runs out; the remote hero moves and casts from `peerMove` / `peerCast`.
   */
  startNet(o: { opponent: HeroKit; side: 0 | 1; names: [string, string]; net: DuelNet }) {
    const arena = this.host.arena, hm = this.host.heroMode;
    this.mode = 'play';
    this.autopilot = false;
    hm.spectate = false;
    hm.focus = null;
    this.opponentKit = o.opponent;
    const [mine, theirs] = o.side === 0 ? [PLAYER_START, OPPONENT_START] : [OPPONENT_START, PLAYER_START];
    this.setup(mine, theirs);
    this.net = o.net;
    this.names = o.names;
    this.peerTrack = [];
    this.peerClock = null;
    this.castSeq = 0;
    this.think = Infinity; // no AI: the other player drives the opponent
    hm.flipCamera = o.side === 1;
    hm.snapCameraNow();
    hm.locked = true;
    // Hits on the remote hero only count when its own client reports them (`peerHit`).
    arena.hitFilter = (target) => target !== this.foe || this.hitBypass;
    hm.onCast = (_label, slot, target) => this.sendCast(slot, target);
    this.rematchButton.style.display = 'none';
    this.leaveButton.textContent = 'Back to menu';
    this.showBanner('Waiting for opponent', 999);
    this.banner.style.fontSize = '28px';
    this.renderHud();
  }

  /** Common round setup: the ring, one foe at `theirs` under the opponent's figure, the hero at `mine`. */
  private setup(mine: THREE.Vector3, theirs: THREE.Vector3) {
    const arena = this.host.arena, hm = this.host.heroMode;
    if (!this.on) this.savedCount = arena.count;
    this.on = true;
    this.playerMax = hm.currentKit.maxHp ?? HP;
    this.foeMax = this.opponentKit.maxHp ?? HP;
    arena.maxHp = this.foeMax;
    arena.respawnAfter = Infinity;
    arena.bounds = RING;
    arena.obstacles = DUEL_OBSTACLES;
    arena.setCount(1);
    this.foe = arena.liveFoes()[0]?.figure ?? null;
    if (this.foe) arena.placeFoe(this.foe, theirs);
    arena.caster.setHome(mine);
    arena.caster.reset();
    arena.caster.group.rotation.y = Math.atan2(theirs.x - mine.x, theirs.z - mine.z);
    arena.clearSelection();

    if (this.foe) {
      for (const c of this.foe.group.children) c.visible = false;
      this.foe.group.rotation.y = Math.atan2(mine.x - theirs.x, mine.z - theirs.z);
    }
    this.figure.setModel(this.opponentKit.model, theirs);
    this.figure.stand();
    hm.locked = false;
    hm.resetRound();
    this.playerHp = this.playerMax;
    this.round++;
    arena.projectiles.clear();
    arena.summons.resetStats();
    this.opponentDodge.clear();
    this.playerDodge.clear();
    this.cooldowns.fill(0);
    this.rooted = 0;
    this.think = 1.2; // a beat before the opponent moves
    this.playerThink = 1.2;
    this.stats = { playerCasts: 0, opponentCasts: 0, playerDodges: 0, opponentDodges: 0 };
    this.result = null;
    this.playerCastsRecent = [];
    this.time = 0;
    this.over = null;
    this.overT = 0;
    this.zones.set([]);
    this.group.visible = true;
    this.hud.style.display = 'flex';
    this.card.style.display = 'none';
    this.banner.style.display = 'none';
    this.countdown = -1;
    this.renderHud();
  }

  stop() {
    if (!this.on) return;
    const arena = this.host.arena;
    this.on = false;
    this.round++;
    arena.projectiles.clear();
    arena.hitFilter = null;
    arena.casterHeal = null;
    this.host.heroMode.onCast = undefined;
    arena.maxHp = 100;
    arena.respawnAfter = 4;
    arena.bounds = null;
    arena.obstacles = null;
    arena.setCount(this.savedCount);
    arena.caster.setHome(PLAYER_START.clone().setZ(14));
    arena.caster.reset();
    this.figure.setModel(undefined);
    this.foe = null;
    this.zones.set([]);
    this.group.visible = false;
    this.hud.style.display = 'none';
    this.card.style.display = 'none';
    this.host.heroMode.locked = false;
    this.host.heroMode.spectate = false;
    this.host.heroMode.focus = null;
    this.host.heroMode.flipCamera = false;
    this.autopilot = false;
    this.net = null;
    this.banner.style.display = 'none';
    this.rematchButton.style.display = '';
    this.leaveButton.textContent = 'Leave duel';
    this.host.heroMode.resetRound();
  }

  // --- network duel ---------------------------------------------------------------------------------------

  /** The server's countdown before the fight: the hero is locked until it runs out. */
  countdownFrom(seconds: number) {
    this.countdown = seconds;
    this.host.heroMode.locked = true;
    this.banner.style.fontSize = '';
  }

  /**
   * The remote hero's position and facing (sent 20 times a second while it moves). `ts` is the sender's clock: the
   * sample is placed at the moment it was true, so uneven delivery does not make the hero stutter.
   */
  peerMove(x: number, z: number, yaw: number, ts?: number) {
    const now = performance.now();
    let at = now;
    if (ts !== undefined) {
      this.peerClock = this.peerClock === null ? now - ts : Math.min(this.peerClock, now - ts);
      at = ts + this.peerClock;
    }
    const track = this.peerTrack, last = track[track.length - 1];
    if (last) {
      at = Math.max(at, last.at + 1);
      // It stood still (nothing is sent then): hold the old spot until just before this sample instead of gliding.
      if (at - last.at > PEER_GAP) track.push({ ...last, at: at - PEER_STEP });
    }
    track.push({ at, x, z, yaw });
    while (track.length > 2 && track[1].at < now - 1000) track.shift();
  }

  /** The remote hero cast a spell: play it here at this side's hero, with this side's dodge check. */
  peerCast(m: PeerCast) {
    if (!this.on || !this.net || this.over || !this.foe) return;
    const spell = this.opponentKit.spells[m.slot];
    const spec = spell && this.host.targeting(spell.label);
    if (!spec) return;
    const arena = this.host.arena, foe = this.foe;
    // Cast from where the hero is drawn (a little behind its own screen, see netFollow) so it does not jump; only the
    // look depends on it, hits are decided by the side that takes them. Far off (a lost update): snap to its spot.
    const from = foe.group.position.clone().setY(0);
    const told = new THREE.Vector3(m.fx, 0, m.fz);
    if (from.distanceTo(told) > PEER_SNAP) {
      arena.moveFoe(foe, told.clone().sub(from));
      from.copy(told);
    }
    const me = arena.caster.group.position;
    const point = spec.mode === 'self' ? from.clone() : m.enemy ? me.clone() : new THREE.Vector3(m.x, 0, m.z);
    this.castSpell(m.slot, foe, from, me, spec, point, m.id);
  }

  /** The remote side took a hit from this side's spell (its own client decided): number, flash, HP from the server. */
  peerHit(damage: number, hp: number, color?: string) {
    if (!this.foe || !this.on) return;
    this.hitBypass = true;
    this.host.arena.hit(this.foe, { damage, knock: 0, color });
    this.hitBypass = false;
    this.host.arena.setHp(this.foe, hp);
  }

  peerDodged() {
    if (this.foe && this.on) this.host.arena.say('DODGED', '#7dffb0', this.foe.group.position, 1.2);
  }

  /** This side's HP as the server counts it. */
  setPlayerHp(hp: number) {
    this.playerHp = hp;
  }

  /** The server ended the match: the victory or defeat card with `text`. */
  netEnd(result: 'win' | 'loss', text: string) {
    if (!this.on) return;
    this.countdown = -1;
    this.banner.style.display = 'none';
    if (!this.over) this.finish(result === 'win' ? 'win' : 'lose');
    this.cardText.textContent = text;
  }

  private sendCast(slot: number, target: Target) {
    const me = this.host.arena.caster.group.position;
    const p = 'enemy' in target ? target.enemy.group.position : target.point;
    this.net?.cast({ id: ++this.castSeq, slot, x: p.x, z: p.z, fx: me.x, fz: me.z, enemy: 'enemy' in target });
  }

  /**
   * The remote hero is drawn `PEER_DELAY` ms in the past, between the two reports around that moment, so it moves
   * smoothly at an even speed; past the newest report it holds still instead of guessing.
   */
  private netFollow(dt: number, foe: Enemy, at: THREE.Vector3) {
    this.rooted = Math.max(0, this.rooted - dt);
    const track = this.peerTrack;
    if (!track.length) return;
    const t = performance.now() - PEER_DELAY;
    let i = 0;
    while (i < track.length - 1 && track[i + 1].at <= t) i++;
    const a = track[i], b = track[Math.min(i + 1, track.length - 1)];
    const k = b.at > a.at ? THREE.MathUtils.clamp((t - a.at) / (b.at - a.at), 0, 1) : 1;
    const d = new THREE.Vector3(a.x + (b.x - a.x) * k - at.x, 0, a.z + (b.z - a.z) * k - at.z);
    if (d.lengthSq() > 1e-8) this.host.arena.moveFoe(foe, d);
    const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    foe.group.rotation.y = a.yaw + turn * k;
  }

  private showBanner(text: string, seconds: number) {
    this.banner.textContent = text;
    this.banner.style.display = 'block';
    this.banner.style.opacity = '1';
    this.bannerT = seconds;
  }

  private updateBanner(dt: number) {
    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = -1;
        this.host.heroMode.locked = false;
        this.showBanner('FIGHT', 0.9);
      } else if (this.banner.textContent !== String(Math.ceil(this.countdown))) {
        this.showBanner(String(Math.ceil(this.countdown)), 999);
      }
      return;
    }
    if (this.banner.style.display === 'none') return;
    this.bannerT -= dt;
    this.banner.style.opacity = String(Math.min(1, Math.max(0, this.bannerT * 2.5)));
    if (this.bannerT <= 0) this.banner.style.display = 'none';
  }

  update(dt: number) {
    if (!this.on) return;
    const arena = this.host.arena, hm = this.host.heroMode;
    const me = arena.caster.group.position;
    this.time += dt;
    this.zoneClock += dt;
    this.zones.update(this.zoneClock);
    this.flash.style.opacity = String(Math.max(0, Number(this.flash.style.opacity || 0) - dt * 2.5));
    this.updateBanner(dt);

    const foe = this.foe;
    const foePos = foe ? foe.group.position : OPPONENT_START;
    if (foe) this.figure.follow(dt, foePos, foe.group.rotation.y, this.rooted > 0);

    if (this.over) {
      this.overT += dt;
      if (this.over === 'lose') hm.fallHero(this.overT / 0.6);
      else this.figure.fall(this.overT / 0.6);
      return;
    }
    // Network duel: the server declares the winner (`netEnd`); the opponent is the other player.
    if (this.net) {
      if (foe) this.netFollow(dt, foe, foePos);
      this.renderHud();
      return;
    }
    if (!foe || arena.hpOf(foe) <= 0) return this.finish('win');
    if (this.playerHp <= 0) return this.finish('lose');

    this.ai(dt, foe, foePos, me);
    if (this.autopilot) this.pilot(dt, foe, foePos, me);
    this.renderHud();
  }

  // --- the opponent ---------------------------------------------------------------------------------------

  private ai(dt: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3) {
    for (let i = 0; i < 4; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.rooted = Math.max(0, this.rooted - dt);
    this.think = Math.max(0, this.think - dt);
    // Statuses on the opponent: stun / knock-up = no move, no cast; root = no move; slow = x0.6; silence = no cast.
    const st = this.host.arena.statusOf(foe);
    if (st?.stunned || this.host.arena.isDashing(foe)) return;
    if (this.rooted > 0 || this.think > 0) {
      this.face(foe, me);
      return;
    }
    // A skillshot on its way: step off its line before casting or walking on (if the roll says so).
    const side = st?.cannotMove ? null : this.dodgeBolt(this.opponentDodge, foe, at);
    if (side) {
      this.host.arena.moveFoe(foe, side.multiplyScalar(AI_SPEED * (st?.speedMul ?? 1) * dt), true);
      this.face(foe, me);
      return;
    }
    const sees = this.host.arena.lineOfSight(at, me);
    if (!st?.cannotCast) {
      const mine = this.host.heroMode.status;
      // A unit of the hero's that stands in the way is shot at first; otherwise the hero.
      const full = this.host.arena.summons.alive('opponent').length >= MAX_UNITS;
      const cooling = (i: number) => this.cooldowns[i] > 0;
      const held = mine.stunned || mine.has('root');
      // The hero first; a unit only when nothing can be cast at the hero (out of range or sight) and a unit is within 2.5 m.
      let pick = this.pickSpell(this.opponentKit, cooling, flat(at, me), this.playerHp / this.playerMax, sees, held, flat(at, me), full);
      let unit: ReturnType<Duel['blocker']> = null;
      if (!pick && (unit = this.blocker('hero', at, me))) {
        pick = this.pickSpell(this.opponentKit, cooling, flat(at, unit.pos), this.playerHp / this.playerMax,
          this.host.arena.lineOfSight(at, unit.pos), held, flat(at, me), full);
      }
      if (pick) {
        this.castSpell(pick.i, foe, at, me, pick.spec, this.opponentKit.spells[pick.i].summon ? this.summonSpot(at, me) : undefined, 0, unit?.figure);
        return;
      }
    }
    if (st?.cannotMove) {
      this.face(foe, me);
      return;
    }
    const move = this.steer(this.opponentAi, this.opponentKit, at, me, dt, !sees, 'hero');
    if (move.lengthSq() > 0) this.host.arena.moveFoe(foe, move.multiplyScalar(AI_SPEED * (st?.speedMul ?? 1) * dt), true);
    this.face(foe, me);
  }

  /**
   * The spell to cast now, if any: the first ready one in the order R, E, W, Q that is in reach. R waits until the
   * other side is under 55% HP or the round is 20 s old; E (self) waits until the other side is inside its radius.
   * Without line of sight (`sees` false: a pillar or wall between them) only self spells can go.
   * A crowd-control spell (`cc`: stun or root) goes first when it is in reach, unless the other side is held already
   * (`otherHeld`).
   * `d` is the distance to what it shoots at (the hero, or a unit in the way); `dHero` the distance to the hero, which a
   * summon spell goes by (ready and the hero within `SUMMON_REACH`, unless `full`: the side has the most units).
   */
  private pickSpell(kit: HeroKit, cooling: (i: number) => boolean, d: number, otherHp: number, sees: boolean, otherHeld = false, dHero = d, full = false) {
    const ready = (i: number) => {
      if (cooling(i)) return null;
      const spell = kit.spells[i];
      const spec = this.host.targeting(spell.label);
      if (!spec) return null;
      if (spell.summon) return full || dHero > SUMMON_REACH ? null : { i, spec };
      const reach = spec.mode === 'self' ? (spec.radius ?? 5) - 0.6 : spell.range;
      if (d > reach || (spec.mode !== 'self' && !sees)) return null;
      // A gap closer only when the target is out of Q's range (it would waste the dash otherwise).
      if (spell.dash && d <= kit.spells[0].range + 0.5) return null;
      if (i === 3 && otherHp > 0.55 && this.time < 20) return null;
      return { i, spec };
    };
    if (!otherHeld) {
      for (const i of [3, 2, 1, 0]) {
        const pick = kit.spells[i].cc ? ready(i) : null;
        if (pick) return pick;
      }
    }
    for (const i of [3, 2, 1, 0]) {
      const pick = ready(i);
      if (pick) return pick;
    }
    return null;
  }

  /**
   * A unit move: hold ~70% of Q's range from `other`, strafe around it, flip the strafe every 1.5–3.5 s. `blocked`
   * (no line of sight): close in to half that distance, so the strafe comes round the cover. A melee kit closes to
   * about 2 m instead, never backs off, strafes only a little, and so keeps chasing a target that retreats.
   */
  private steer(st: { strafe: number; strafeT: number }, kit: HeroKit, at: THREE.Vector3, other: THREE.Vector3, dt: number, blocked = false, foeSide?: SummonSide) {
    const d = flat(at, other);
    const melee = !!kit.melee;
    const want = melee ? MELEE_GAP : kit.spells[0].range * (blocked ? 0.35 : 0.7);
    const to = new THREE.Vector3(other.x - at.x, 0, other.z - at.z);
    to.divideScalar(Math.max(to.length(), 1e-3));
    st.strafeT -= dt;
    if (st.strafeT <= 0) { st.strafe = -st.strafe; st.strafeT = 1.5 + Math.random() * 2; }
    const move = new THREE.Vector3();
    if (d > want + (melee ? 0.3 : 1)) move.add(to);
    else if (!melee && d < want - 2) move.sub(to);
    move.addScaledVector(new THREE.Vector3(-to.z, 0, to.x), (melee ? 0.3 : 0.8) * st.strafe);
    // Step away from enemy melee units in contact, so they do not hit for free.
    if (foeSide && !melee) {
      for (const u of this.host.arena.summons.alive(foeSide)) {
        const ud = flat(u.pos, at);
        if (u.kind === 'melee' && ud < 2.4) move.add(new THREE.Vector3(at.x - u.pos.x, 0, at.z - u.pos.z).divideScalar(Math.max(ud, 0.2)).multiplyScalar(1.6));
      }
    }
    return move.lengthSq() > 0 ? move.normalize() : move;
  }

  /** Autopilot: the player's hero fights with the same rules as the opponent (for duel simulations). */
  private pilot(dt: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3) {
    const hm = this.host.heroMode;
    this.playerThink = Math.max(0, this.playerThink - dt);
    // The autopilot obeys the player's statuses like the opponent's AI does.
    const st = hm.status;
    if (hm.isRooted || this.playerThink > 0 || st.stunned || this.host.arena.isDashing(this.host.arena.caster)) return;
    const kit = hm.currentKit;
    const side = st.cannotMove ? null : this.dodgeBolt(this.playerDodge, this.host.arena.caster, me);
    if (side) {
      this.host.arena.walk(side.multiplyScalar(AI_SPEED * st.speedMul * dt));
      return;
    }
    const sees = this.host.arena.lineOfSight(me, at);
    const theirs = this.host.arena.statusOf(foe);
    if (!st.cannotCast) {
      const full = this.host.arena.summons.alive('hero').length >= MAX_UNITS;
      const cooling = (i: number) => hm.cooldownOf(i) > 0;
      const held = !!theirs && (theirs.stunned || theirs.has('root'));
      const foeHp = this.host.arena.hpOf(foe) / this.foeMax;
      // The hero first; a unit only when nothing can be cast at the hero and a unit is within 2.5 m.
      let pick = this.pickSpell(kit, cooling, flat(me, at), foeHp, sees, held, flat(me, at), full);
      let unit: ReturnType<Duel['blocker']> = null;
      if (!pick && (unit = this.blocker('opponent', me, at))) {
        pick = this.pickSpell(kit, cooling, flat(me, unit.pos), foeHp, this.host.arena.lineOfSight(me, unit.pos), held, flat(me, at), full);
      }
      const tpos = unit ? unit.pos : at;
      if (pick) {
        const spell = kit.spells[pick.i];
        const target = pick.spec.mode === 'enemy' || pick.spec.mode === 'enemies' ? { enemy: unit?.figure ?? foe }
          : {
            point: pick.spec.mode === 'self' ? me.clone() : spell.summon ? this.summonSpot(me, at) : spell.dash ? dashAim(me, at, spell.range)
              : unit ? tpos.clone() : bestSpot(at, pick.spec.radius ?? 5, this.host.arena.summons.alive('opponent').map((u) => u.pos)),
          };
        if (hm.autoCast(pick.i, target)) { this.stats.playerCasts++; return; }
      }
    }
    if (st.cannotMove) return;
    const move = this.steer(this.playerAi, kit, me, at, dt, !sees, 'opponent');
    if (move.lengthSq() > 0) this.host.arena.walk(move.multiplyScalar(AI_SPEED * st.speedMul * dt));
  }

  /**
   * Skillshot dodge for an AI-driven figure `who` standing at `at`: returns a unit step across the line of the first
   * bolt that will cross its position within `BOLT_WINDOW`, or null. Each bolt is rolled once (`BOLT_DODGE_CHANCE`) when
   * it first threatens, and a successful roll starts moving `BOLT_REACTION` later, so a dodge is imperfect.
   */
  private dodgeBolt(memory: Map<number, BoltDodge>, who: Enemy, at: THREE.Vector3): THREE.Vector3 | null {
    const threats = this.host.arena.projectiles.threats(who);
    const ids = new Set(threats.map((t) => t.id));
    for (const id of memory.keys()) if (!ids.has(id)) memory.delete(id);
    let step: THREE.Vector3 | null = null;
    for (const t of threats) {
      const rx = at.x - t.pos.x, rz = at.z - t.pos.z;
      const ahead = rx * t.dir.x + rz * t.dir.z;
      const lateral = -rx * t.dir.z + rz * t.dir.x;
      const need = t.radius + BODY_RADIUS + 0.15;
      if (ahead < -need || ahead > t.rangeLeft + need || ahead / t.speed > BOLT_WINDOW || Math.abs(lateral) > need) {
        // Not a threat (yet): a decided dodge stays decided while it is still ahead and close to the line.
        if (ahead < -need) memory.delete(t.id);
        continue;
      }
      let m = memory.get(t.id);
      if (!m) {
        m = { react: Math.random() < BOLT_DODGE_CHANCE, side: lateral >= 0 ? 1 : -1, at: this.time + BOLT_REACTION };
        memory.set(t.id, m);
      }
      if (m.react && this.time >= m.at && !step) step = new THREE.Vector3(-t.dir.z * m.side, 0, t.dir.x * m.side);
    }
    return step;
  }

  /**
   * The opponent casts slot `i` from `at` at the player (`aim`: a network duel's aim point or a summon's spot, else the
   * player's feet). `unit`: a unit of the hero's it shoots at instead (one in the way). The hero's units inside an area
   * (or next in a chain) are targets too; the zones decide at impact who is hit.
   */
  private castSpell(i: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3, spec: TargetingSpec, aim?: THREE.Vector3, id = 0, unit?: Enemy) {
    const arena = this.host.arena;
    const spell = this.opponentKit.spells[i];
    const player = arena.caster;
    const focus = unit ? unit.group.position : me;
    const inside = (p: THREE.Vector3, r: number) => flat(p, me) <= r;
    const minions = arena.summons.alive('hero');
    let point: THREE.Vector3, targets: Enemy[] = [];
    // Blind: the aim point is rolled off the player now, so the telegraph is drawn at the offset spot (self spells aren't aimed).
    const miss = spec.mode !== 'self' && arena.statusOf(foe)?.blind ? arena.blindOffset() : null;
    if (spec.mode === 'self') {
      point = at.clone();
      if (inside(at, spec.radius ?? 5)) targets = [player];
      for (const u of minions) if (flat(u.pos, at) <= (spec.radius ?? 5)) targets.push(u.figure);
    } else {
      // An area spell picks the spot that also catches the most of the hero's units while still covering the hero.
      point = (aim ?? (spell.dash ? dashAim(at, focus, spell.range)
        : spec.mode === 'ground' && !unit ? bestSpot(me, spec.radius ?? 5, minions.map((u) => u.pos)) : focus)).clone();
      if (miss) point.add(miss);
      targets = [unit ?? player];
      const extra = minions.filter((u) => u.figure !== unit);
      if (spec.mode === 'ground') for (const u of extra) if (flat(u.pos, point) <= (spec.radius ?? 5)) targets.push(u.figure);
      if (spec.mode === 'enemies') {
        for (const u of extra.sort((a, b) => flat(a.pos, focus) - flat(b.pos, focus))) {
          if (targets.length < (spec.maxTargets ?? 5) && flat(u.pos, focus) <= 8) targets.push(u.figure);
        }
      }
    }
    this.face(foe, focus);
    const record: EnemyCast = { id, round: this.round, zones: [], aimed: point.clone(), dodgedShown: false };
    const ctx = arena.contextFor({
      caster: foe,
      from: at,
      point,
      targets,
      enemy: player,
      targetPos: targets.map((t) => {
        const p = t === player ? me.clone() : t.group.position.clone();
        return miss && spec.mode !== 'ground' ? p.add(miss) : p;
      }),
      hit: (target, opts) => (target === player ? this.hitPlayer(record, opts) : this.hitUnit(record, target, opts)),
    });
    // A network duel ignores shields, heals, dashes, skillshots and summons (the server and the peer's own movement decide).
    if (this.net) ctx.shieldSelf = ctx.healSelf = ctx.moveCaster = ctx.projectile = ctx.summon = undefined;
    record.zones = this.host.castAs(spell.label, ctx);
    this.zones.set(record.zones);
    this.zoneClock = 0;
    const impact = record.zones.length ? Math.max(...record.zones.map((z) => z.impact)) : 0.5;
    this.rooted = Math.min(impact, 2.5);
    this.cooldowns[i] = spell.cooldown;
    this.stats.opponentCasts++;
  }

  /** An enemy spell's hit on the player: lands only if the player is still in its zones (or near where it aimed). */
  private hitPlayer(c: EnemyCast, opts: HitOptions = {}) {
    if (this.over || c.round !== this.round || !this.on) return;
    const arena = this.host.arena;
    const me = arena.caster.group.position;
    // A skillshot already touched the hero: that was the dodge check, so the zones do not decide.
    const inZone = opts.projectile || c.zones.some((z) => insideTelegraph(z.shape, me.x, me.z));
    if (!inZone && flat(me, c.aimed) > DODGE_RADIUS) {
      if (!c.dodgedShown) {
        c.dodgedShown = true;
        this.stats.playerDodges++;
        arena.say('DODGED', '#7dffb0', me, 1.2);
        this.net?.dodged(c.id);
      }
      return;
    }
    const dmg = Math.round(opts.damage ?? 15);
    this.net?.tookHit(c.id, dmg, opts.color);
    // A shield on the hero takes the damage first (a network duel ignores shields: the server counts HP alone).
    const left = this.net ? dmg : arena.absorb(arena.caster, dmg);
    this.playerHp = Math.max(0, this.playerHp - left);
    if (left > 0) {
      arena.say(String(left), opts.color ?? '#ff6a6a', me, left >= 40 ? 1.5 : 1);
      this.flash.style.opacity = String(Math.min(1, 0.35 + left / 120));
    }
    const knock = Math.min(opts.knock ?? 0, 8);
    if (knock > 0) {
      const from = opts.from ?? this.foe?.group.position ?? me;
      const away = new THREE.Vector3(me.x - from.x, 0, me.z - from.z);
      if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
      me.addScaledVector(away.normalize(), knock * 0.18);
      arena.keepInside(me);
    }
    if (opts.pull && opts.pull > 0 && !this.net) {
      const from = opts.from ?? this.foe?.group.position ?? me;
      const to = new THREE.Vector3(from.x - me.x, 0, from.z - me.z);
      const m = Math.min(opts.pull, 4, Math.max(0, to.length() - 1));
      if (m > 0) me.addScaledVector(to.normalize(), m);
      arena.keepInside(me);
    }
    // A network duel ignores statuses: the server does not carry them yet.
    if (opts.status && !this.net) this.host.heroMode.applyStatus(opts.status.kind, opts.status.seconds, opts.color);
  }

  /**
   * An enemy spell's hit on one of the hero's summoned units: lands inside the cast's zones or near where it aimed
   * (units do not dodge), or at once for a bolt or a unit's own attack (`opts.projectile`: the touch was the check).
   */
  private hitUnit(c: EnemyCast, target: Enemy, opts: HitOptions = {}) {
    if (this.over || c.round !== this.round || !this.on) return;
    const p = target.group.position;
    if (opts.projectile || c.zones.some((z) => insideTelegraph(z.shape, p.x, p.z)) || flat(p, c.aimed) <= DODGE_RADIUS) this.host.arena.hit(target, opts);
  }

  /** The nearest alive unit of `side` within `UNIT_BLOCK` of `from` and closer than the hero at `other`, if any. */
  private blocker(side: SummonSide, from: THREE.Vector3, other: THREE.Vector3) {
    const limit = Math.min(UNIT_BLOCK, flat(from, other));
    let best: ReturnType<Arena['summons']['alive']>[number] | null = null, bd = limit;
    for (const u of this.host.arena.summons.alive(side)) {
      const d = flat(u.pos, from);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  /** Where a summon spell puts its units: 3 m from `from` toward `toward`. */
  private summonSpot(from: THREE.Vector3, toward: THREE.Vector3) {
    const d = new THREE.Vector3(toward.x - from.x, 0, toward.z - from.z);
    d.divideScalar(Math.max(d.length(), 1e-3));
    return this.host.arena.keepInside(from.clone().setY(0).addScaledVector(d, 3), 0.8);
  }

  /** A heal on the player hero (`arena.casterHeal`): HP up to the cap; returns what was added. */
  private healPlayer(amount: number) {
    const healed = Math.max(0, Math.min(amount, this.playerMax - this.playerHp));
    this.playerHp += healed;
    return healed;
  }

  /** The player just cast: remember its zones and where it aimed (the opponent's position at the cast). */
  private recordPlayerCast() {
    if (!this.foe) return;
    // `id` is the arena's cast number: the hits of that cast carry it to `opponentHit`.
    this.playerCastsRecent.push({ id: this.host.arena.castSeq, round: this.round, zones: this.host.playerZones(), aimed: this.foe.group.position.clone(), dodgedShown: false, t: this.time });
    this.playerCastsRecent = this.playerCastsRecent.filter((c) => this.time - c.t < 4.5);
  }

  /**
   * The player's hit on the opponent lands only if the opponent is still inside THAT cast's zones (or near where it
   * aimed), as `hitPlayer` does for the opponent's casts. `cast` is the arena's cast number from the hit's context.
   */
  private opponentHit(target: Enemy, opts: HitOptions, cast?: number) {
    if (!this.on || opts.projectile) return true;
    // The opponent's summoned units are checked against the zones like the opponent is (the hero's own units are not).
    if (target !== this.foe && this.host.arena.summons.unitOf(target)?.side !== 'opponent') return true;
    const p = target.group.position;
    const c = this.playerCastsRecent.find((r) => r.id === cast && this.time - r.t < 4.5);
    if (!c) return true;
    const lands = c.zones.some((z) => insideTelegraph(z.shape, p.x, p.z)) || flat(p, c.aimed) <= DODGE_RADIUS;
    if (!lands && target === this.foe) {
      if (!c.dodgedShown) {
        c.dodgedShown = true;
        this.stats.opponentDodges++;
        this.host.arena.say('DODGED', '#7dffb0', p, 1.2);
      }
    }
    return lands;
  }

  private face(foe: Enemy, me: THREE.Vector3) {
    const p = foe.group.position;
    foe.group.rotation.y = Math.atan2(me.x - p.x, me.z - p.z);
  }

  private finish(result: 'win' | 'lose') {
    this.result = {
      player: this.host.heroMode.currentKit.name, opponent: this.opponentKit.name,
      winner: result === 'win' ? this.host.heroMode.currentKit.name : this.opponentKit.name,
      seconds: +this.time.toFixed(1), playerHp: this.playerHp, opponentHp: this.foe ? this.host.arena.hpOf(this.foe) : 0,
      ...this.stats,
      units: structuredClone(this.host.arena.summons.stats),
    };
    this.over = result;
    this.overT = 0;
    this.host.heroMode.locked = true;
    this.zones.set([]);
    const me = this.host.heroMode.currentKit, them = this.opponentKit;
    const winner = result === 'win' ? me : them, loser = result === 'win' ? them : me;
    if (this.mode === 'run') {
      this.cardTitle.textContent = `${winner.name.toUpperCase()} WINS`;
      this.cardTitle.style.color = winner.accent;
      this.cardText.textContent = `${loser.name} falls after ${this.time.toFixed(1)} s · ${winner.name} keeps ${Math.ceil(result === 'win' ? this.playerHp : this.foe ? this.host.arena.hpOf(this.foe) : 0)} HP.`;
      this.card.style.display = 'flex';
      this.renderHud();
      return;
    }
    this.cardTitle.textContent = result === 'win' ? 'VICTORY' : 'DEFEAT';
    this.cardTitle.style.color = result === 'win' ? '#ffd27a' : '#ff6a6a';
    this.cardText.textContent = result === 'win' ? `${them.name} falls.` : `${me.name} falls to ${them.name}.`;
    this.card.style.display = 'flex';
    this.renderHud();
  }

  // --- ring and HUD ---------------------------------------------------------------------------------------

  private buildRing() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(RING.r, 96),
      new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.88 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(RING.x, 0.012, RING.z);
    const flatRing = (inner: number, outer: number, color: number, opacity: number, y: number) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 128),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(RING.x, y, RING.z);
      return m;
    };
    // One thin gold rim, one soft glowing band inside it, and a faint centre line between the two starts.
    const rim = flatRing(RING.r - 0.12, RING.r, 0xc9a24a, 0.95, 0.02);
    const band = flatRing(RING.r - 0.9, RING.r - 0.2, 0x6a4a9a, 0.22, 0.018);
    const centre = flatRing(1.1, 1.18, 0xc9a24a, 0.35, 0.02);
    g.add(disc, band, rim, centre, buildObstacleMeshes(DUEL_OBSTACLES));
    return g;
  }

  private buildHud() {
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:6;display:none;align-items:center;gap:18px;' +
      'padding:8px 14px;border-radius:12px;background:rgba(8,6,10,0.82);border:1px solid #3a3242;' +
      'font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;user-select:none;';
    const side = (right: boolean) => {
      const box = document.createElement('div');
      box.style.cssText = `display:flex;align-items:center;gap:10px;flex-direction:${right ? 'row-reverse' : 'row'};`;
      const portrait = document.createElement('canvas');
      portrait.width = portrait.height = 64;
      portrait.style.cssText = 'width:42px;height:42px;border-radius:50%;border:2px solid #8a7a52;';
      const col = document.createElement('div');
      col.style.cssText = `display:flex;flex-direction:column;gap:4px;align-items:${right ? 'flex-end' : 'flex-start'};`;
      const name = document.createElement('div');
      name.style.cssText = 'font:700 13px ui-serif,Georgia,serif;';
      const barBg = document.createElement('div');
      barBg.style.cssText = 'position:relative;width:220px;height:12px;border-radius:6px;background:#2a1a1e;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = `position:absolute;top:0;bottom:0;${right ? 'right' : 'left'}:0;width:100%;border-radius:6px;transition:width 0.15s;`;
      const shield = document.createElement('div');
      shield.style.cssText = 'position:absolute;top:0;bottom:0;display:none;border-radius:6px;opacity:0.85;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.7);';
      const text = document.createElement('div');
      text.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 10px ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 2px #000;';
      barBg.append(fill, shield, text);
      col.append(name, barBg);
      box.append(portrait, col);
      this.bars.push({ fill, shield, text, name, portrait });
      return box;
    };
    const vs = document.createElement('div');
    vs.textContent = 'VS';
    vs.style.cssText = 'font:800 16px ui-serif,Georgia,serif;color:#c9a24a;letter-spacing:2px;';
    root.append(side(false), vs, side(true));
    document.body.appendChild(root);
    return root;
  }

  private renderHud() {
    const me = this.host.heroMode.currentKit, them = this.opponentKit;
    const foeHp = this.foe ? this.host.arena.hpOf(this.foe) : 0;
    const arena = this.host.arena;
    const rows: [HeroKit, number, number, ReturnType<Arena['shieldOf']>][] = [
      [me, this.playerHp, this.playerMax, arena.shieldOf(arena.caster)],
      [them, foeHp, this.foeMax, this.foe ? arena.shieldOf(this.foe) : null],
    ];
    rows.forEach(([kit, hp, max, shield], i) => {
      const b = this.bars[i];
      const label = this.net ? `${kit.name} · ${this.names[i]}` : this.mode === 'run' || i === 1 ? `${kit.name} · AI` : `${kit.name} · you`;
      if (b.name.textContent !== label) {
        b.name.textContent = label;
        const g = b.portrait.getContext('2d')!;
        g.clearRect(0, 0, 64, 64);
        kit.portrait(g, 64);
        b.fill.style.background = `linear-gradient(180deg, ${kit.accent}, color-mix(in srgb, ${kit.accent} 55%, #000))`;
      }
      b.fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
      // A shield is a pale segment after the HP (a strong one is pushed back inside the bar).
      const sh = shield ? Math.min(1, shield.amount / max) : 0;
      b.shield.style.display = sh > 0 ? '' : 'none';
      if (sh > 0) {
        b.shield.style[i === 1 ? 'right' : 'left'] = `${Math.min(Math.max(0, hp / max), 1 - sh) * 100}%`;
        b.shield.style.width = `${sh * 100}%`;
        b.shield.style.background = `color-mix(in srgb, ${shield!.color || '#ffffff'} 30%, #eef6ff)`;
      }
      b.text.textContent = `${Math.ceil(hp)} / ${max}` + (shield ? `  +${Math.ceil(shield.amount)}` : '');
    });
  }
}

/** Where a dash from `from` toward `to` should end: about 1.8 m short of the target, within the spell's range. */
function dashAim(from: THREE.Vector3, to: THREE.Vector3, range: number) {
  const d = Math.max(0, flat(from, to) - 1.8);
  const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
  return from.clone().setY(0).addScaledVector(dir, Math.min(d, range));
}

/**
 * Where to aim an area of radius `r` at a hero standing at `hero`: the hero's own spot, or a spot between the hero and
 * one of the `units` that still covers the hero and catches more of them.
 */
function bestSpot(hero: THREE.Vector3, r: number, units: THREE.Vector3[]) {
  const count = (p: THREE.Vector3) => units.filter((u) => flat(u, p) <= r).length;
  let best = hero.clone().setY(0), bestN = count(best);
  if (r < 1.5) return best;
  for (const u of units) {
    for (const c of [hero.clone().lerp(u, 0.5), u.clone()]) {
      c.y = 0;
      if (flat(c, hero) > r - 1) continue;
      const n = count(c);
      if (n > bestN) { best = c.clone(); bestN = n; }
    }
  }
  return best;
}

function flat(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
