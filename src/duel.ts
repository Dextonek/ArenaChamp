import * as THREE from 'three';
import type { Arena } from './arena';
import type { Enemy } from './effects/common';
import { TelegraphLayer, insideTelegraph, type TelegraphSpec } from './effects/telegraph';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import type { HeroKit } from './heroes';
import { HeroFigure } from './heroFigure';
import type { HeroMode } from './heroMode';

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

const RING = { x: 0, z: 7, r: 12 };
const PLAYER_START = new THREE.Vector3(0, 0, 13);
const OPPONENT_START = new THREE.Vector3(0, 0, 1);
const HP = 600;
const AI_SPEED = 6;
const DODGE_RADIUS = 1.6; // a hit still lands within this distance of where the cast aimed

interface EnemyCast {
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

  // HUD.
  private hud: HTMLDivElement;
  private bars: { fill: HTMLDivElement; text: HTMLDivElement; name: HTMLDivElement; portrait: HTMLCanvasElement }[] = [];
  private card: HTMLDivElement;
  private cardTitle: HTMLDivElement;
  private cardText: HTMLDivElement;
  private flash: HTMLDivElement;

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
    document.body.append(this.card, this.flash);
  }

  /** main.ts: what "Leave duel" does (turns the duel off and syncs the panel). */
  onLeave?: () => void;

  /** Starts (or restarts) a round against `opponentChoice`, never the player's own kit. */
  start(mode: 'play' | 'run' = this.mode) {
    this.mode = mode;
    const arena = this.host.arena, hm = this.host.heroMode;
    const run = mode === 'run';
    this.autopilot = run;
    hm.spectate = run;
    hm.focus = run ? new THREE.Vector3(RING.x, 0, RING.z) : null;
    const player = hm.currentKit;
    const others = this.host.kits.filter((k) => k.name !== player.name);
    const picked = others.find((k) => k.name === this.opponentChoice);
    this.opponentKit = picked ?? others[Math.floor(Math.random() * others.length)];

    if (!this.on) this.savedCount = arena.count;
    this.on = true;
    arena.maxHp = HP;
    arena.respawnAfter = Infinity;
    arena.bounds = RING;
    arena.setCount(1);
    this.foe = arena.liveFoes()[0]?.figure ?? null;
    if (this.foe) arena.placeFoe(this.foe, OPPONENT_START);
    arena.caster.setHome(PLAYER_START);
    arena.caster.reset();
    arena.clearSelection();

    if (this.foe) {
      for (const c of this.foe.group.children) c.visible = false;
      this.foe.group.rotation.y = 0;
    }
    this.figure.setModel(this.opponentKit.model, OPPONENT_START);
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
    arena.hitFilter = (target, opts) => this.opponentHit(target, opts);
    hm.onCast = () => this.recordPlayerCast();
    this.time = 0;
    this.over = null;
    this.overT = 0;
    this.zones.set([]);
    this.group.visible = true;
    this.hud.style.display = 'flex';
    this.card.style.display = 'none';
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
    this.autopilot = false;
    this.host.heroMode.resetRound();
  }

  update(dt: number) {
    if (!this.on) return;
    const arena = this.host.arena, hm = this.host.heroMode;
    const me = arena.caster.group.position;
    this.time += dt;
    this.zoneClock += dt;
    this.zones.update(this.zoneClock);
    this.flash.style.opacity = String(Math.max(0, Number(this.flash.style.opacity || 0) - dt * 2.5));

    const foe = this.foe;
    const foePos = foe ? foe.group.position : OPPONENT_START;
    if (foe) this.figure.follow(dt, foePos, foe.group.rotation.y, this.rooted > 0);

    if (this.over) {
      this.overT += dt;
      if (this.over === 'lose') hm.fallHero(this.overT / 0.6);
      else this.figure.fall(this.overT / 0.6);
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
    const pick = this.pickSpell(this.opponentKit, (i) => this.cooldowns[i] > 0, flat(at, me), this.playerHp / HP);
    if (pick) {
      this.castSpell(pick.i, foe, at, me, pick.spec);
      return;
    }
    const move = this.steer(this.opponentAi, this.opponentKit, at, me, dt);
    if (move.lengthSq() > 0) this.host.arena.moveFoe(foe, move.multiplyScalar(AI_SPEED * dt));
    this.face(foe, me);
  }

  /**
   * The spell to cast now, if any: the first ready one in the order R, E, W, Q that is in reach. R waits until the
   * other side is under 55% HP or the round is 20 s old; E (self) waits until the other side is inside its radius.
   */
  private pickSpell(kit: HeroKit, cooling: (i: number) => boolean, d: number, otherHp: number) {
    for (const i of [3, 2, 1, 0]) {
      if (cooling(i)) continue;
      const spell = kit.spells[i];
      const spec = this.host.targeting(spell.label);
      if (!spec) continue;
      const reach = spec.mode === 'self' ? (spec.radius ?? 5) - 0.6 : spell.range;
      if (d > reach) continue;
      if (i === 3 && otherHp > 0.55 && this.time < 20) continue;
      return { i, spec };
    }
    return null;
  }

  /** A unit move: hold ~70% of Q's range from `other`, strafe around it, flip the strafe every 1.5–3.5 s. */
  private steer(st: { strafe: number; strafeT: number }, kit: HeroKit, at: THREE.Vector3, other: THREE.Vector3, dt: number) {
    const d = flat(at, other);
    const want = kit.spells[0].range * 0.7;
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
    const pick = this.pickSpell(kit, (i) => hm.cooldownOf(i) > 0, flat(me, at), this.host.arena.hpOf(foe) / HP);
    if (pick) {
      const target = pick.spec.mode === 'enemy' || pick.spec.mode === 'enemies' ? { enemy: foe } : { point: pick.spec.mode === 'self' ? me.clone() : at.clone() };
      if (hm.autoCast(pick.i, target)) { this.stats.playerCasts++; return; }
    }
    const move = this.steer(this.playerAi, kit, me, at, dt);
    if (move.lengthSq() > 0) this.host.arena.walk(move.multiplyScalar(AI_SPEED * dt));
  }

  private castSpell(i: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3, spec: TargetingSpec) {
    const arena = this.host.arena;
    const spell = this.opponentKit.spells[i];
    const player = arena.caster;
    const inside = (p: THREE.Vector3, r: number) => flat(p, me) <= r;
    let point: THREE.Vector3, targets: Enemy[] = [];
    if (spec.mode === 'self') {
      point = at.clone();
      if (inside(at, spec.radius ?? 5)) targets = [player];
    } else if (spec.mode === 'ground') {
      point = me.clone();
      targets = [player];
    } else {
      point = me.clone();
      targets = [player];
    }
    this.face(foe, me);
    const record: EnemyCast = { round: this.round, zones: [], aimed: point.clone(), dodgedShown: false };
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
      }
      return;
    }
    const dmg = Math.round(opts.damage ?? 15);
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
    this.playerCastsRecent.push({ round: this.round, zones: this.host.playerZones(), aimed: this.foe.group.position.clone(), dodgedShown: false, t: this.time });
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
    g.add(disc, band, rim, centre);
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
      const label = this.mode === 'run' || i === 1 ? `${kit.name} · AI` : `${kit.name} · you`;
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
