import * as THREE from 'three';
import type { Arena } from './arena';
import type { Enemy } from './effects/common';
import { TelegraphLayer, insideTelegraph, type TelegraphSpec } from './effects/telegraph';
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
const HP = 600;
const AI_SPEED = 6;
const DODGE_RADIUS = 1.6; // a hit still lands within this distance of where the cast aimed

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
  /** 'random' or a hero name. */
  opponentChoice = 'random';

  private opponentKit!: HeroKit;
  private foe: Enemy | null = null;
  private figure = new HeroFigure();
  private zones = new TelegraphLayer();
  private zoneClock = 0;
  private playerHp = HP;
  private cooldowns = [0, 0, 0, 0];
  private rooted = 0;
  private think = 0;
  private opponentAi = { strafe: 1, strafeT: 0 };
  private playerAi = { strafe: -1, strafeT: 0 };
  private playerThink = 0;
  /** Duel simulations: the player's hero is driven by the same AI as the opponent. */
  autopilot = false;
  /** 'play': the player against the AI. 'run': AI against AI to watch (the autopilot drives the player's hero). */
  mode: 'play' | 'run' = 'play';
  /** The last finished round (duel simulations read it). */
  result: { player: string; opponent: string; winner: string; seconds: number; playerHp: number; opponentHp: number; playerCasts: number; opponentCasts: number; playerDodges: number } | null = null;
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
  private peer: { pos: THREE.Vector3; yaw: number } | null = null;
  private hitBypass = false;
  private castSeq = 0;
  private countdown = -1;
  private bannerT = 0;

  // HUD.
  private hud: HTMLDivElement;
  private bars: { fill: HTMLDivElement; text: HTMLDivElement; name: HTMLDivElement; portrait: HTMLCanvasElement }[] = [];
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
    const picked = others.find((k) => k.name === this.opponentChoice);
    this.opponentKit = picked ?? others[Math.floor(Math.random() * others.length)];
    this.setup(PLAYER_START, OPPONENT_START);
    arena.hitFilter = (target, opts) => this.opponentHit(target, opts);
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
    this.peer = null;
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
    arena.maxHp = HP;
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
    this.playerHp = HP;
    this.round++;
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
    arena.hitFilter = null;
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

  /** The remote hero's position and facing (sent ~15 times a second). */
  peerMove(x: number, z: number, yaw: number) {
    this.peer = { pos: new THREE.Vector3(x, 0, z), yaw };
  }

  /** The remote hero cast a spell: play it here at this side's hero, with this side's dodge check. */
  peerCast(m: PeerCast) {
    if (!this.on || !this.net || this.over || !this.foe) return;
    const spell = this.opponentKit.spells[m.slot];
    const spec = spell && this.host.targeting(spell.label);
    if (!spec) return;
    const arena = this.host.arena, foe = this.foe;
    // Cast from where the caster stood on its own screen.
    const from = new THREE.Vector3(m.fx, 0, m.fz);
    arena.moveFoe(foe, new THREE.Vector3(from.x - foe.group.position.x, 0, from.z - foe.group.position.z));
    this.peer = { pos: from.clone(), yaw: this.peer?.yaw ?? foe.group.rotation.y };
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

  /** The remote hero eases toward its last reported position (snaps when far) and takes its facing. */
  private netFollow(dt: number, foe: Enemy, at: THREE.Vector3) {
    this.rooted = Math.max(0, this.rooted - dt);
    const p = this.peer;
    if (!p) return;
    const d = new THREE.Vector3(p.pos.x - at.x, 0, p.pos.z - at.z);
    const k = d.length() > 6 ? 1 : 1 - Math.exp(-14 * dt);
    if (d.lengthSq() > 1e-8) this.host.arena.moveFoe(foe, d.multiplyScalar(k));
    foe.group.rotation.y = p.yaw;
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
    if (this.rooted > 0 || this.think > 0) {
      this.face(foe, me);
      return;
    }
    const sees = this.host.arena.lineOfSight(at, me);
    const pick = this.pickSpell(this.opponentKit, (i) => this.cooldowns[i] > 0, flat(at, me), this.playerHp / HP, sees);
    if (pick) {
      this.castSpell(pick.i, foe, at, me, pick.spec);
      return;
    }
    const move = this.steer(this.opponentAi, this.opponentKit, at, me, dt, !sees);
    if (move.lengthSq() > 0) this.host.arena.moveFoe(foe, move.multiplyScalar(AI_SPEED * dt), true);
    this.face(foe, me);
  }

  /**
   * The spell to cast now, if any: the first ready one in the order R, E, W, Q that is in reach. R waits until the
   * other side is under 55% HP or the round is 20 s old; E (self) waits until the other side is inside its radius.
   * Without line of sight (`sees` false: a pillar or wall between them) only self spells can go.
   */
  private pickSpell(kit: HeroKit, cooling: (i: number) => boolean, d: number, otherHp: number, sees: boolean) {
    for (const i of [3, 2, 1, 0]) {
      if (cooling(i)) continue;
      const spell = kit.spells[i];
      const spec = this.host.targeting(spell.label);
      if (!spec) continue;
      const reach = spec.mode === 'self' ? (spec.radius ?? 5) - 0.6 : spell.range;
      if (d > reach || (spec.mode !== 'self' && !sees)) continue;
      if (i === 3 && otherHp > 0.55 && this.time < 20) continue;
      return { i, spec };
    }
    return null;
  }

  /**
   * A unit move: hold ~70% of Q's range from `other`, strafe around it, flip the strafe every 1.5–3.5 s. `blocked`
   * (no line of sight): close in to half that distance, so the strafe comes round the cover.
   */
  private steer(st: { strafe: number; strafeT: number }, kit: HeroKit, at: THREE.Vector3, other: THREE.Vector3, dt: number, blocked = false) {
    const d = flat(at, other);
    const want = kit.spells[0].range * (blocked ? 0.35 : 0.7);
    const to = new THREE.Vector3(other.x - at.x, 0, other.z - at.z);
    to.divideScalar(Math.max(to.length(), 1e-3));
    st.strafeT -= dt;
    if (st.strafeT <= 0) { st.strafe = -st.strafe; st.strafeT = 1.5 + Math.random() * 2; }
    const move = new THREE.Vector3();
    if (d > want + 1) move.add(to);
    else if (d < want - 2) move.sub(to);
    move.addScaledVector(new THREE.Vector3(-to.z, 0, to.x), 0.8 * st.strafe);
    return move.lengthSq() > 0 ? move.normalize() : move;
  }

  /** Autopilot: the player's hero fights with the same rules as the opponent (for duel simulations). */
  private pilot(dt: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3) {
    const hm = this.host.heroMode;
    this.playerThink = Math.max(0, this.playerThink - dt);
    if (hm.isRooted || this.playerThink > 0) return;
    const kit = hm.currentKit;
    const sees = this.host.arena.lineOfSight(me, at);
    const pick = this.pickSpell(kit, (i) => hm.cooldownOf(i) > 0, flat(me, at), this.host.arena.hpOf(foe) / HP, sees);
    if (pick) {
      const target = pick.spec.mode === 'enemy' || pick.spec.mode === 'enemies' ? { enemy: foe } : { point: pick.spec.mode === 'self' ? me.clone() : at.clone() };
      if (hm.autoCast(pick.i, target)) { this.stats.playerCasts++; return; }
    }
    const move = this.steer(this.playerAi, kit, me, at, dt, !sees);
    if (move.lengthSq() > 0) this.host.arena.walk(move.multiplyScalar(AI_SPEED * dt));
  }

  /** The opponent casts slot `i` from `at` at the player (`aim`: a network duel's aim point, else the player's feet). */
  private castSpell(i: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3, spec: TargetingSpec, aim?: THREE.Vector3, id = 0) {
    const arena = this.host.arena;
    const spell = this.opponentKit.spells[i];
    const player = arena.caster;
    const inside = (p: THREE.Vector3, r: number) => flat(p, me) <= r;
    let point: THREE.Vector3, targets: Enemy[] = [];
    if (spec.mode === 'self') {
      point = at.clone();
      if (inside(at, spec.radius ?? 5)) targets = [player];
    } else {
      point = (aim ?? me).clone();
      targets = [player];
    }
    this.face(foe, me);
    const record: EnemyCast = { id, round: this.round, zones: [], aimed: point.clone(), dodgedShown: false };
    const ctx = arena.contextFor({
      caster: foe,
      from: at,
      point,
      targets,
      targetPos: targets.map(() => me.clone()),
      hit: (_target, opts) => this.hitPlayer(record, opts),
    });
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
    const inZone = c.zones.some((z) => insideTelegraph(z.shape, me.x, me.z));
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
    this.playerHp = Math.max(0, this.playerHp - dmg);
    arena.say(String(dmg), opts.color ?? '#ff6a6a', me, dmg >= 40 ? 1.5 : 1);
    this.flash.style.opacity = String(Math.min(1, 0.35 + dmg / 120));
    const knock = Math.min(opts.knock ?? 0, 8);
    if (knock > 0) {
      const from = opts.from ?? this.foe?.group.position ?? me;
      const away = new THREE.Vector3(me.x - from.x, 0, me.z - from.z);
      if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
      me.addScaledVector(away.normalize(), knock * 0.18);
      arena.keepInside(me);
    }
  }

  /** The player just cast: remember its zones and where it aimed (the opponent's position at the cast). */
  private recordPlayerCast() {
    if (!this.foe) return;
    this.playerCastsRecent.push({ id: 0, round: this.round, zones: this.host.playerZones(), aimed: this.foe.group.position.clone(), dodgedShown: false, t: this.time });
    this.playerCastsRecent = this.playerCastsRecent.filter((c) => this.time - c.t < 4.5);
  }

  /** The player's hit on the opponent lands only if it is still in one of the recent casts' zones (or near their aim). */
  private opponentHit(target: Enemy, _opts: HitOptions) {
    if (!this.on || target !== this.foe) return true;
    const p = target.group.position;
    const recent = this.playerCastsRecent.filter((c) => this.time - c.t < 4.5);
    if (!recent.length) return true;
    const lands = recent.some((c) => c.zones.some((z) => insideTelegraph(z.shape, p.x, p.z)) || flat(p, c.aimed) <= DODGE_RADIUS);
    if (!lands) {
      const c = recent[recent.length - 1];
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
      const text = document.createElement('div');
      text.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 10px ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 2px #000;';
      barBg.append(fill, text);
      col.append(name, barBg);
      box.append(portrait, col);
      this.bars.push({ fill, text, name, portrait });
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
    const rows: [HeroKit, number][] = [[me, this.playerHp], [them, foeHp]];
    rows.forEach(([kit, hp], i) => {
      const b = this.bars[i];
      const label = this.net ? `${kit.name} · ${this.names[i]}` : this.mode === 'run' || i === 1 ? `${kit.name} · AI` : `${kit.name} · you`;
      if (b.name.textContent !== label) {
        b.name.textContent = label;
        const g = b.portrait.getContext('2d')!;
        g.clearRect(0, 0, 64, 64);
        kit.portrait(g, 64);
        b.fill.style.background = `linear-gradient(180deg, ${kit.accent}, color-mix(in srgb, ${kit.accent} 55%, #000))`;
      }
      b.fill.style.width = `${Math.max(0, (hp / HP) * 100)}%`;
      b.text.textContent = `${Math.ceil(hp)} / ${HP}`;
    });
  }
}

function flat(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
