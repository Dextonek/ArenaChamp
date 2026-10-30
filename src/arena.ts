import * as THREE from 'three';
import { CASTER_POS, Enemy, createCaster, createGround } from './effects/common';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import { yawTo } from './effects/targeting';
import { blocksSight, pushOut, steer, type Obstacle } from './obstacles';
import { StatusSet, STATUS_COLOR, STATUS_WORD, BLIND_RADIUS, type StatusKind } from './effects/status';
import { StatusFx, StatusFxPool } from './effects/parts/status';
import { ShieldFx, ShieldFxPool } from './effects/parts/shield';
import { ProjectileSystem, type Projectile, type ProjectileOptions } from './effects/projectile';
import { SummonSystem, type SummonWorld } from './effects/summon';

/** Default enemy spots: a loose pack on the -Z side of the caster. */
const LAYOUT: [number, number][] = [
  [0, 0], [-5, -3], [5, -2], [-2.5, -8], [3.5, -9], [-7.5, 2.5], [7.5, 3], [0, -14], [-6, -12], [6.5, -13],
];
const MAX_HP = 100;

/** A figure's status effects and the visuals that show them (held only while something is running or fading). */
interface StatusSlot {
  set: StatusSet;
  fx: StatusFx | null;
  /** Colour of the last hit that gave a status (tints the root clamps). */
  tint: string;
  /** The figure was lifted by a knock-up last frame (so the lift is put back to 0 once). */
  lifted: boolean;
  /** A shield that absorbs damage before HP (`shieldFigure`), and its bubble (held while it is up or fading). */
  shield: { amount: number; max: number; left: number; color: string } | null;
  sfx: ShieldFx | null;
  /** A dash in progress (`moveFigure`): nothing else moves the figure until it lands. */
  dash: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null;
}

const newSlot = (): StatusSlot => ({ set: new StatusSet(), fx: null, tint: '', lifted: false, shield: null, sfx: null, dash: null });

/** Something a spell can pick as a target: an enemy figure and where it stands (`home` follows a unit live). */
interface Body {
  figure: Enemy;
  home: THREE.Vector3;
}

interface Foe {
  figure: Enemy;
  home: THREE.Vector3;
  hp: number;
  flash: number;
  /** Tint of the hit flash: the hit's colour, kept below the bloom threshold by `setFlash`. */
  flashTint: THREE.Color;
  knock: THREE.Vector3;
  offset: THREE.Vector3;
  displaced: THREE.Vector3;
  dead: number; // seconds since death, -1 = alive
  /** Where it stood when the pack was built (hero mode respawns it here). */
  spawn: THREE.Vector3;
  ring: THREE.Mesh;
  bar: THREE.Group;
  barFill: THREE.Mesh;
  st: StatusSlot;
}

/**
 * The shared playground for targeted effects: the caster, a pack of clickable enemies with HP, and the
 * selection. Click an enemy to target it (shift-click to add more), click the ground to aim at a spot.
 * main.ts shows it only while a targeted effect is active and builds a `CastContext` from it on every play.
 */
export class Arena {
  readonly group = new THREE.Group();
  readonly caster = createCaster();
  hits = 0;
  kills = 0;
  /** Called after a click changed the selection (main replays the effect). */
  onPick?: () => void;
  /** Clicks pick targets. Hero mode turns this off and sets targets through `setTarget` / `setGroundPoint`. */
  pickEnabled = true;
  /**
   * Hero mode: HP, deaths and knockback carry over from cast to cast (no reset in `context`), and dead enemies
   * respawn at their spawn spot after `respawnAfter` seconds.
   */
  persist = false;
  respawnAfter = 4;
  /** Enemy HP (100; a duel opponent has more). */
  maxHp = MAX_HP;
  /** Optional veto on hits (a duel: the opponent dodges by leaving the zone). Return false to drop the hit. */
  hitFilter: ((target: Enemy, opts: HitOptions, cast?: number) => boolean) | null = null;
  /** Counts the casts `context()` has built; a hit from that context carries its number to `hitFilter`. */
  castSeq = 0;
  /** A round play area (a duel ring): the caster and the enemies are kept inside it. Null = the open floor. */
  bounds: { x: number; z: number; r: number } | null = null;
  /** Solid pillars and walls (the duel ring): nobody walks through them, and they block line of sight. */
  obstacles: Obstacle[] | null = null;
  /**
   * A blinded caster's miss: the next `context()` moves the aim point (and, for single-target spells, the target
   * positions) by this offset on the ground plane. Hero mode sets it around a cast and clears it again.
   */
  aimOffset: THREE.Vector3 | null = null;
  /**
   * The player hero has no HP of its own here (the duel keeps it): this adds `amount` to it and returns what was
   * really healed. Null outside a duel (a heal then only shows its number).
   */
  casterHeal: ((amount: number) => number) | null = null;
  /** Called when the caster gets a shield (a network duel tells the other side). */
  casterShield: ((amount: number, seconds: number, color: string) => void) | null = null;

  private foes: Foe[] = [];
  private selected: Body[] = [];
  private groundPoint?: THREE.Vector3;
  private groundMarker: THREE.Mesh;
  private ground = createGround();
  private raycaster = new THREE.Raycaster();
  private v = new THREE.Vector3();
  private overlay: HTMLDivElement;
  private labels: { el: HTMLDivElement; t: number; pos: THREE.Vector3 }[] = [];
  private fxPool = new StatusFxPool(this.group);
  private shieldPool = new ShieldFxPool(this.group);
  private casterSt = newSlot();
  /** Skillshots in flight: ticked in `update`, cleared with the pack. */
  readonly projectiles = new ProjectileSystem();
  /** Summoned units of both sides (hero mode and the duel): ticked in `update`, cleared with the pack. */
  readonly summons: SummonSystem;
  /** The hero's side: its units fight the foes and the duel opponent's units. */
  private heroWorld: SummonWorld;

  constructor(private camera: THREE.Camera, private dom: HTMLElement, count = 6) {
    this.summons = new SummonSystem(this.group, {
      camera,
      say: (text, color, at, scale) => this.say(text, color, at, scale),
      place: (p) => { this.keepInside(p, 0.5); },
      slide: (from, dir) => (this.obstacles ? steer(from, dir, this.obstacles) : dir),
      sees: (a, b) => this.lineOfSight(a, b),
    });
    this.heroWorld = {
      side: 'hero',
      victims: () => this.liveFoes(),
      hit: (t, h) => this.hit(t, h),
      fire: (po) => this.fire(po, 'hero-unit', () => this.liveFoes(), (t, h) => this.hit(t, h)),
    };
    this.group.add(this.ground, this.caster.group);
    this.groundMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.75, 4),
      new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.groundMarker.rotation.x = -Math.PI / 2;
    this.groundMarker.visible = false;
    this.group.add(this.groundMarker);
    this.group.visible = false;
    this.setCount(count);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:800 17px ui-sans-serif,system-ui;';
    document.body.appendChild(this.overlay);

    // A click (not an orbit drag) picks: enemy → target it, ground → aim there.
    let down: { x: number; y: number } | undefined;
    dom.addEventListener('pointerdown', (e) => { down = e.button === 0 ? { x: e.clientX, y: e.clientY } : undefined; });
    dom.addEventListener('pointerup', (e) => {
      if (!down || !this.group.visible || !this.pickEnabled) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = undefined;
      if (moved < 5) this.pick(e.clientX, e.clientY, e.shiftKey);
    });
  }

  get count() {
    return this.foes.length;
  }

  /** Rebuilds the pack with `n` enemies at the default spots. */
  setCount(n: number) {
    this.projectiles.clear();
    this.summons.clear();
    for (const f of this.foes) {
      this.group.remove(f.figure.group, f.ring, f.bar);
      this.clearSlot(f.st);
    }
    this.foes = [];
    this.selected = [];
    const n2 = THREE.MathUtils.clamp(Math.round(n), 1, LAYOUT.length);
    for (let i = 0; i < n2; i++) this.foes.push(this.makeFoe(new THREE.Vector3(LAYOUT[i][0], 0, LAYOUT[i][1])));
  }

  /** Moves every enemy to a random spot in front of the caster (keeps them apart). */
  shuffle() {
    const placed: THREE.Vector3[] = [];
    for (const f of this.foes) {
      let p = new THREE.Vector3();
      for (let tries = 0; tries < 40; tries++) {
        p = new THREE.Vector3(THREE.MathUtils.randFloatSpread(18), 0, THREE.MathUtils.randFloat(-15, 4));
        if (placed.every((q) => q.distanceTo(p) > 3.2)) break;
      }
      placed.push(p);
      f.home.copy(p);
      f.spawn.copy(p);
      f.figure.setHome(p);
    }
    this.reset();
  }

  clearSelection() {
    this.selected = [];
    this.groundPoint = undefined;
  }

  /** Makes `target` the only selected enemy (null clears the selection). */
  setTarget(target: Enemy | null) {
    const f: Body | undefined = target ? this.foes.find((x) => x.figure === target) ?? this.summons.unitOf(target)?.body : undefined;
    this.selected = f ? [f] : [];
    if (f) this.groundPoint = undefined;
  }

  /** Aims at a ground spot (null clears it). Clears the enemy selection. */
  setGroundPoint(p: THREE.Vector3 | null) {
    this.groundPoint = p ? p.clone().setY(0) : undefined;
    if (p) this.selected = [];
  }

  /** The enemies that are alive, with where they stand right now: the pack, then the duel opponent's summoned units. */
  liveFoes(): { figure: Enemy; pos: THREE.Vector3 }[] {
    return [
      ...this.foes.filter((f) => f.dead < 0).map((f) => ({ figure: f.figure, pos: f.figure.group.position })),
      ...this.summons.alive('opponent').map((u) => ({ figure: u.figure, pos: u.pos })),
    ];
  }

  /** Shows or hides the slab floor (a duel arena with its own floor or a floating platform hides it). */
  showGround(on: boolean) {
    this.ground.visible = on;
  }

  /** Everyone back to full HP, standing at home, no knockback or displacement. Selection stays. */
  reset() {
    this.projectiles.clear();
    this.summons.clear();
    this.caster.reset();
    this.clearSlot(this.casterSt);
    for (const f of this.foes) {
      f.figure.reset();
      f.hp = this.maxHp;
      f.flash = 0;
      f.dead = -1;
      f.knock.set(0, 0, 0);
      f.offset.set(0, 0, 0);
      f.displaced.set(0, 0, 0);
      this.clearSlot(f.st);
    }
  }

  /** Resets the pack and builds who/where to hit for one cast. Deterministic when nothing is selected. */
  context(spec: TargetingSpec): CastContext {
    // Cast from wherever the caster stands now (it can be walked around in play mode).
    const from = this.caster.group.position.clone().setY(0);
    this.caster.setHome(from);
    if (this.persist) {
      // Keep HP and deaths; fold the knockback into the home spot so `targetPos` is where they stand now.
      this.caster.reset();
      for (const f of this.foes) {
        f.home.add(f.offset).setY(0);
        f.offset.set(0, 0, 0);
        f.displaced.set(0, 0, 0);
        f.figure.setHome(f.home);
      }
    } else this.reset();
    // The duel opponent's summoned units are enemies too: a spell sees them in `targets` like the pack.
    const pool: Body[] = [...(this.persist ? this.foes.filter((f) => f.dead < 0) : this.foes), ...this.summons.alive('opponent').map((u) => u.body)];
    const byDist = (p: THREE.Vector3) => [...pool].sort((a, b) => a.home.distanceTo(p) - b.home.distanceTo(p));
    // No enemy clicked: the one nearest the clicked ground spot, else the one nearest the caster.
    const primary = this.selected.find((f) => pool.includes(f)) ?? byDist(this.groundPoint ?? from)[0];
    let targets: Body[] = [];
    let point: THREE.Vector3;
    // A blinded caster (`aimOffset`): the spell lands off the aim point. Self spells are not aimed, so they stay put.
    const miss = spec.mode === 'self' ? null : this.aimOffset;

    switch (spec.mode) {
      case 'enemy':
        targets = primary ? [primary] : [];
        point = primary ? primary.home.clone() : from.clone().add(new THREE.Vector3(0, 0, -6));
        if (miss) point.add(miss);
        break;
      case 'enemies': {
        const max = spec.maxTargets ?? 5;
        if (this.selected.length > 1) targets = this.selected.slice(0, max);
        else {
          // Nearest-neighbour chain from the primary target.
          targets = primary ? [primary] : [];
          const rest = pool.filter((f) => f !== primary);
          while (targets.length < max && rest.length) {
            const last = targets[targets.length - 1].home;
            rest.sort((a, b) => a.home.distanceTo(last) - b.home.distanceTo(last));
            targets.push(rest.shift()!);
          }
        }
        point = targets[0] ? targets[0].home.clone() : from.clone().add(new THREE.Vector3(0, 0, -6));
        if (miss) point.add(miss);
        break;
      }
      case 'ground': {
        point = (this.groundPoint ?? primary?.home ?? from.clone().add(new THREE.Vector3(0, 0, -6))).clone();
        if (miss) point.add(miss);
        const r = spec.radius ?? 5;
        targets = byDist(point).filter((f) => f.home.distanceTo(point) <= r);
        break;
      }
      case 'self': {
        point = from.clone();
        const r = spec.radius ?? 5;
        targets = byDist(from).filter((f) => f.home.distanceTo(from) <= r);
        break;
      }
    }
    point.y = 0;
    const aimAt = spec.mode === 'self' ? primary?.home ?? point.clone().add(new THREE.Vector3(0, 0, -1)) : point;
    this.caster.group.rotation.y = yawTo(from, aimAt);

    const cast = ++this.castSeq;
    return {
      caster: this.caster,
      from,
      aim: yawTo(from, aimAt),
      targets: targets.map((f) => f.figure),
      // Single-target spells aim at the target's spot: a blind caster's miss moves it too (the enemy stays the target).
      targetPos: targets.map((f) => (miss && spec.mode !== 'ground' ? f.home.clone().add(miss) : f.home.clone())),
      point,
      hit: (target, opts) => this.hit(target, opts, cast),
      displace: (target, offset) => {
        const f = this.foes.find((x) => x.figure === target);
        if (f) f.displaced.copy(offset);
      },
      ...this.selfFx(this.caster),
      projectile: (po) => this.fire(po, 'hero', () => this.liveFoes(), (t, h) => this.hit(t, h, cast)),
      summon: (so) => this.summons.spawn(this.heroWorld, so),
    };
  }

  /** Hit reaction: flash, knockback, damage number, HP; dies at 0 HP. */
  hit(target: Enemy, opts: HitOptions = {}, cast?: number) {
    const f = this.foes.find((x) => x.figure === target);
    if (!f) {
      // A summoned unit: the same filter, then its own hit reaction (no statuses).
      const u = this.summons.unitOf(target);
      if (!u?.alive || (this.hitFilter && !this.hitFilter(target, opts, cast))) return;
      this.hits++;
      this.summons.hurt(u, opts);
      return;
    }
    if (f.dead >= 0) return;
    if (this.hitFilter && !this.hitFilter(target, opts, cast)) return;
    const dmg = Math.round(opts.damage ?? THREE.MathUtils.randFloat(10, 20));
    // A shield takes the damage first; only what is left comes off HP.
    const soaked = this.soak(f.st, target, dmg);
    const dealt = dmg - soaked;
    f.hp = Math.max(0, f.hp - dealt);
    f.flash = dealt > 0 ? 1 : 0.35;
    const big = dealt >= 40;
    // A tinted flash (the hit's colour, else warm orange), not white: white bloomed figures swallowed the hit VFX.
    f.flashTint.set(dealt > 0 ? opts.color ?? (big ? '#ffb347' : '#ff8a4a') : '#9cc4ec');
    this.hits++;
    const knock = opts.knock ?? 4;
    if (knock > 0) {
      const away = target.group.position.clone().sub(opts.from ?? this.caster.group.position).setY(0);
      if (away.lengthSq() < 1e-4) away.set(0, 0, -1);
      f.knock.add(away.normalize().multiplyScalar(knock));
    }
    if (opts.pull && opts.pull > 0) {
      // The knock velocity decays as exp(-7t), so a push of v moves the figure v / 7 metres in all.
      const to = (opts.from ?? this.caster.group.position).clone().sub(target.group.position).setY(0);
      const m = Math.min(opts.pull, 4, Math.max(0, to.length() - 1));
      if (m > 0) f.knock.add(to.normalize().multiplyScalar(m * 7));
    }
    if (soaked > 0) this.say(String(soaked), '#cfe6ff', target.group.position, 0.9);
    if (dealt > 0) this.say(String(dealt), opts.color ?? (big ? '#ffd24a' : '#fff1dc'), target.group.position, big ? 1.5 : 1);
    if (opts.status && f.hp > 0) this.applyStatus(target, opts.status.kind, opts.status.seconds, opts.color);
    if (f.hp <= 0) {
      f.dead = 0;
      this.kills++;
    }
  }

  /**
   * Gives a status to a foe or to the caster figure (caps, refresh and stun immunity: `StatusSet`). Shows the
   * floating word when it starts. Returns false when the target is unknown or immune.
   */
  applyStatus(target: Enemy, kind: StatusKind, seconds: number, color = ''): boolean {
    const st = this.slotOf(target);
    if (!st) return false;
    const r = st.set.apply(kind, seconds);
    const at = target.group.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    if (r === 'immune') this.say('IMMUNE', '#9a93a6', at, 0.8);
    else {
      st.tint = color;
      if (r === 'applied') this.say(STATUS_WORD[kind], STATUS_COLOR[kind], at, 1.1);
    }
    return r !== 'immune';
  }

  /** The status effects running on a foe or on the caster figure (the AI and hero mode obey them). */
  statusOf(target: Enemy): StatusSet | undefined {
    return this.slotOf(target)?.set;
  }

  /** Ends every status on one figure, or on all of them. */
  clearStatuses(target?: Enemy) {
    if (target) {
      const st = this.slotOf(target);
      if (st) this.clearSlot(st);
    } else {
      this.clearSlot(this.casterSt);
      for (const f of this.foes) this.clearSlot(f.st);
    }
  }

  /**
   * Gives a figure (a foe, the duel opponent or the caster) a shield of `amount` HP for `seconds`. It absorbs damage
   * before HP, breaks with "SHIELD BROKEN" and a shard pop, or expires. A second shield keeps the larger amount and
   * restarts the clock.
   */
  shieldFigure(target: Enemy, amount: number, seconds: number, color = '') {
    const st = this.slotOf(target);
    if (!st || !(amount > 0) || !(seconds > 0)) return;
    const keep = st.shield && st.shield.amount > amount ? st.shield.amount : amount;
    st.shield = { amount: keep, max: keep, left: seconds, color: color || st.shield?.color || '' };
    if (target === this.caster) this.casterShield?.(keep, seconds, st.shield.color);
  }

  /** Drops a figure's shield at once (a network duel: the other client says it broke). */
  clearShield(target: Enemy) {
    const st = this.slotOf(target);
    if (st) st.shield = null;
  }

  /** The shield on a figure now (`amount` left of `max`, css `color`), or null. */
  shieldOf(target: Enemy) {
    const sh = this.slotOf(target)?.shield;
    return sh ? { amount: sh.amount, max: sh.max, color: sh.color } : null;
  }

  /**
   * Lets a shield on `target` take `damage` first (the duel's hits on the player hero). Returns the damage left for
   * HP and shows the absorbed part as a pale number.
   */
  absorb(target: Enemy, damage: number): number {
    const st = this.slotOf(target);
    const soaked = st ? this.soak(st, target, damage) : 0;
    if (soaked > 0) this.say(String(soaked), '#cfe6ff', target.group.position, 0.9);
    return damage - soaked;
  }

  /** Heals a figure by `amount` (capped at max HP) with a green number. Returns what was really healed. */
  healFigure(target: Enemy, amount: number): number {
    let healed = 0;
    if (target === this.caster) healed = this.casterHeal ? this.casterHeal(amount) : amount;
    else {
      const f = this.foes.find((x) => x.figure === target);
      if (!f || f.dead >= 0) return 0;
      healed = Math.max(0, Math.min(amount, this.maxHp - f.hp));
      f.hp += healed;
    }
    this.say(`+${Math.round(healed)}`, '#6aff9a', target.group.position, 1.1);
    return healed;
  }

  /**
   * Slides a figure to `to` (clamped into the bounds) over `seconds`, easing out. Until it lands nothing else moves
   * it: `walk` and knockback do nothing, and `isDashing` is true for the AI and hero mode. Returns the real spot.
   */
  moveFigure(target: Enemy, to: THREE.Vector3, seconds: number): THREE.Vector3 {
    const end = to.clone().setY(0);
    this.keepInside(end);
    const st = this.slotOf(target);
    if (!st) return end;
    st.dash = { from: target.group.position.clone().setY(0), to: end, t: 0, dur: Math.max(0.05, seconds) };
    return end.clone();
  }

  /** True while a figure is mid-dash. */
  isDashing(target: Enemy) {
    return !!this.slotOf(target)?.dash;
  }

  /** A random spot inside a circle of radius `BLIND_RADIUS` (a blind caster's miss), on the ground plane. */
  blindOffset() {
    const a = Math.random() * Math.PI * 2, r = BLIND_RADIUS * Math.sqrt(Math.random());
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  update(dt: number) {
    this.projectiles.update(dt);
    this.summons.update(dt);
    this.tickStatus(this.casterSt, this.caster, dt);
    if (this.stepDash(this.casterSt, dt, this.v)) this.caster.group.position.set(this.v.x, this.caster.group.position.y, this.v.z);
    this.tickShield(this.casterSt, this.caster, dt);
    for (const f of this.foes) {
      if (f.dead < 0 && this.stepDash(f.st, dt, f.home)) {
        f.offset.set(0, 0, 0);
        f.knock.set(0, 0, 0);
        f.figure.setHome(f.home);
      }
      f.offset.addScaledVector(f.knock, dt);
      f.knock.multiplyScalar(Math.exp(-dt * 7));
      if (this.bounds) {
        // Knockback can't push an enemy out of the ring: fold the overshoot back into the offset.
        const p = this.v.copy(f.home).add(f.offset);
        this.keepInside(p, 0.6);
        f.offset.copy(p).sub(f.home);
      }
      f.figure.group.position.copy(f.home).add(f.offset).add(f.displaced);
      if (f.dead >= 0) this.clearSlot(f.st);
      else {
        this.tickStatus(f.st, f.figure, dt);
        f.figure.group.position.y += f.st.set.lift;
        this.tickShield(f.st, f.figure, dt);
      }
      f.flash *= Math.exp(-dt * 7);
      if (f.flash > 0.002) f.figure.setFlash(f.flash, f.flashTint);
      else if (f.flash > 0) { f.flash = 0; f.figure.setFlash(0); }
      // Death: topple back and sink into the ground.
      if (f.dead >= 0) {
        f.dead += dt;
        const k = Math.min(1, f.dead / 0.6);
        f.figure.group.rotation.x = -k * 1.4;
        f.figure.group.position.y -= Math.max(0, f.dead - 0.5) * 1.5;
        f.figure.group.visible = f.dead < 1.8;
        if (this.persist && f.dead > this.respawnAfter) this.respawn(f);
      }
      f.ring.position.set(f.figure.group.position.x, 0.05, f.figure.group.position.z);
      f.ring.visible = this.selected.includes(f) && f.figure.group.visible;
      (f.ring.material as THREE.MeshBasicMaterial).opacity = this.selected[0] === f ? 0.9 : 0.55;
      f.bar.position.copy(f.figure.group.position).add(new THREE.Vector3(0, 2.75, 0));
      f.bar.quaternion.copy(this.camera.quaternion);
      f.bar.visible = f.figure.group.visible && f.hp < this.maxHp;
      f.barFill.scale.x = Math.max(0.001, f.hp / this.maxHp);
      f.barFill.position.x = -0.6 * (1 - f.hp / this.maxHp);
    }
    if (this.groundPoint) {
      this.groundMarker.position.set(this.groundPoint.x, 0.05, this.groundPoint.z);
      this.groundMarker.rotation.z += dt;
    }
    this.groundMarker.visible = !!this.groundPoint && this.pickEnabled;
    this.updateLabels(dt);
  }

  /** Play mode: walks the caster by `move` (world units, ground plane) and turns it to face the way it goes. */
  walk(move: THREE.Vector3) {
    if (move.lengthSq() < 1e-8 || this.casterSt.dash) return;
    if (this.obstacles) {
      // Slide round a pillar or wall in the way instead of walking into it.
      const len = move.length();
      move = steer(this.caster.group.position, move.clone().divideScalar(len), this.obstacles).multiplyScalar(len);
    }
    const p = this.caster.group.position.add(move);
    p.x = THREE.MathUtils.clamp(p.x, -55, 55);
    p.z = THREE.MathUtils.clamp(p.z, -55, 55);
    this.keepInside(p);
    this.caster.group.rotation.y = Math.atan2(move.x, move.z);
  }

  /** Yaw from the caster toward the selected / clicked / nearest target, without resetting anything. */
  aimYaw(): number {
    const from = this.caster.group.position;
    const at = this.selected[0]?.home ?? this.groundPoint
      ?? [...this.foes].sort((a, b) => a.home.distanceTo(from) - b.home.distanceTo(from))[0].home;
    return yawTo(from, at);
  }

  /** Back to the starting spot (0, 0, 14) facing the pack. */
  homeCaster() {
    this.caster.setHome(CASTER_POS);
    this.caster.reset();
  }

  setVisible(on: boolean) {
    this.group.visible = on;
    this.overlay.style.display = on ? '' : 'none';
  }

  /** Moves `p` (y ignored) back inside `bounds`, `margin` from the edge, and out of the obstacles. */
  keepInside(p: THREE.Vector3, margin = 0.6) {
    if (this.obstacles) pushOut(p, this.obstacles);
    const b = this.bounds;
    if (!b) return p;
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), r = b.r - margin;
    if (d > r) { p.x = b.x + (dx / d) * r; p.z = b.z + (dz / d) * r; }
    return p;
  }

  /** True when no obstacle stands between `a` and `b` (always true without obstacles). */
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3) {
    return !this.obstacles || !blocksSight(a, b, this.obstacles);
  }

  /**
   * Walks an enemy by `move` (ground plane), keeps it inside the bounds and turns it to face the way it goes.
   * `slide`: turn round obstacles in the way (an AI walking); off for a network position update.
   */
  moveFoe(target: Enemy, move: THREE.Vector3, slide = false) {
    const f = this.foes.find((x) => x.figure === target);
    if (!f || f.dead >= 0) return;
    if (slide && this.obstacles && move.lengthSq() > 1e-10) {
      const len = move.length();
      move = steer(f.home, move.clone().divideScalar(len), this.obstacles).multiplyScalar(len);
    }
    f.home.add(move).setY(0);
    this.keepInside(f.home);
    f.figure.setHome(f.home);
    if (move.lengthSq() > 1e-8) f.figure.group.rotation.y = Math.atan2(move.x, move.z);
  }

  /** Puts an enemy at `p` (home and spawn), full HP, alive. */
  placeFoe(target: Enemy, p: THREE.Vector3) {
    const f = this.foes.find((x) => x.figure === target);
    if (!f) return;
    f.spawn.copy(p).setY(0);
    this.respawn(f);
  }

  /** Sets an enemy's HP (a network duel: the server's number wins); 0 starts its death. */
  setHp(target: Enemy, hp: number) {
    const f = this.foes.find((x) => x.figure === target);
    if (!f || f.dead >= 0) return;
    f.hp = Math.max(0, Math.min(this.maxHp, hp));
    if (f.hp <= 0) { f.dead = 0; this.kills++; }
  }

  /** HP of an enemy (0 when dead or unknown). */
  hpOf(target: Enemy) {
    const f = this.foes.find((x) => x.figure === target);
    return f && f.dead < 0 ? f.hp : 0;
  }

  /**
   * A cast context for any caster (a duel opponent casting at the player): the same shape `context()` builds, with
   * the caller's own targets, `hit` and `displace`. Nothing in the arena is reset.
   */
  contextFor(o: {
    caster: Enemy;
    from: THREE.Vector3;
    point: THREE.Vector3;
    targets: Enemy[];
    targetPos: THREE.Vector3[];
    /** Which way the cast goes (default: from `from` toward `point`). */
    aim?: number;
    /** The enemy hero the caster's bolts and units fight (default: the first target). */
    enemy?: Enemy;
    /** Delivers a hit on the hero or on one of the hero side's summoned units (`isUnit`). */
    hit: (target: Enemy, opts?: HitOptions) => void;
    displace?: (target: Enemy, offset: THREE.Vector3) => void;
  }): CastContext {
    const from = o.from.clone().setY(0), point = o.point.clone().setY(0);
    const enemy = o.enemy ?? o.targets[0];
    // What the caster's bolts and units can hit: the enemy hero, and the units the hero summoned.
    const victims = () => [
      ...(enemy ? [{ figure: enemy, pos: enemy.group.position }] : []),
      ...this.summons.alive('hero').map((u) => ({ figure: u.figure, pos: u.pos })),
    ];
    const deliver = (t: Enemy, h: HitOptions) => o.hit(t, h);
    return {
      caster: o.caster,
      from,
      aim: o.aim ?? yawTo(from, point),
      targets: o.targets,
      targetPos: o.targetPos.map((p) => p.clone().setY(0)),
      point,
      hit: o.hit,
      displace: o.displace ?? (() => {}),
      ...this.selfFx(o.caster),
      // The bolt flies at this cast's targets (the player hero), and its hits go the same way the spell's own do.
      projectile: (po) => this.fire(po, 'opponent', victims, deliver),
      summon: (so) => this.summons.spawn({
        side: 'opponent', victims, hit: deliver, fire: (po) => this.fire(po, 'opponent-unit', victims, deliver),
      }, so),
    };
  }

  /** True when `figure` is a summoned unit (alive or fading). */
  isUnit(figure: Enemy) {
    return !!this.summons.unitOf(figure);
  }

  /** Starts a bolt for a cast context: `victims` are what it can hit, `hit` delivers it. */
  private fire(
    po: ProjectileOptions,
    tag: string,
    victims: () => { figure: Enemy; pos: THREE.Vector3 }[],
    hit: (target: Enemy, opts: HitOptions) => void,
  ): Projectile {
    return this.projectiles.spawn({
      tag, victims, hit,
      blocked: (a, b) => !!this.obstacles && blocksSight(a, b, this.obstacles),
    }, po);
  }

  /** The caster-side mechanics of a cast context, bound to the figure that casts (the hero, or a duel opponent). */
  private selfFx(who: Enemy): Pick<CastContext, 'shieldSelf' | 'healSelf' | 'moveCaster'> {
    return {
      shieldSelf: (amount, seconds, color) => this.shieldFigure(who, amount, seconds, color),
      healSelf: (amount) => { this.healFigure(who, amount); },
      moveCaster: (to, seconds) => this.moveFigure(who, to, seconds),
    };
  }

  /** Takes up to `damage` off a figure's shield; returns the amount absorbed. Breaks the shield at 0. */
  private soak(st: StatusSlot, figure: Enemy, damage: number): number {
    const sh = st.shield;
    if (!sh || !(damage > 0)) return 0;
    const soaked = Math.min(sh.amount, damage);
    sh.amount -= soaked;
    if (!st.sfx) st.sfx = this.shieldPool.acquire();
    if (sh.amount <= 0) {
      st.sfx.burst(figure.group.position);
      st.shield = null;
      this.say('SHIELD BROKEN', '#e6f0ff', figure.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 1.1);
    } else st.sfx.flare();
    return soaked;
  }

  /** Counts a shield down and keeps its bubble on the figure (and fades it out after). */
  private tickShield(st: StatusSlot, figure: Enemy, dt: number) {
    if (st.shield) {
      st.shield.left -= dt;
      if (st.shield.left <= 0) st.shield = null;
    }
    if (!st.shield && !st.sfx) return;
    if (!st.sfx) st.sfx = this.shieldPool.acquire();
    const sh = st.shield;
    st.sfx.update(dt, !!sh, sh ? sh.amount / sh.max : 0, sh ? sh.left : 9, figure.group.position, sh?.color);
    st.sfx.group.visible = figure.group.visible;
    if (!sh && st.sfx.settled) { this.shieldPool.release(st.sfx); st.sfx = null; }
  }

  /** Moves a dash on: writes where the figure is now into `out` (y = 0) and returns true; false when none runs. */
  private stepDash(st: StatusSlot, dt: number, out: THREE.Vector3): boolean {
    const d = st.dash;
    if (!d) return false;
    d.t = Math.min(d.dur, d.t + dt);
    const k = d.t / d.dur;
    out.lerpVectors(d.from, d.to, 1 - (1 - k) ** 3).setY(0);
    this.keepInside(out);
    if (d.t >= d.dur) st.dash = null;
    return true;
  }

  private slotOf(target: Enemy): StatusSlot | undefined {
    if (target === this.caster) return this.casterSt;
    return this.foes.find((x) => x.figure === target)?.st;
  }

  private clearSlot(st: StatusSlot) {
    st.set.clear();
    st.shield = null;
    st.dash = null;
    if (st.fx) { this.fxPool.release(st.fx); st.fx = null; }
    if (st.sfx) { this.shieldPool.release(st.sfx); st.sfx = null; }
  }

  /** Ticks one figure's statuses, keeps its visuals on it (and fades them out after), and lifts the caster for a knock-up. */
  private tickStatus(st: StatusSlot, figure: Enemy, dt: number) {
    const s = st.set;
    s.update(dt);
    if (figure === this.caster) {
      // Foes get their lift where their position is rebuilt; the caster's y is only touched while it is lifted.
      if (s.lift > 0 || st.lifted) figure.group.position.y = s.lift;
      st.lifted = s.lift > 0;
    }
    if (!s.any && !st.fx) return;
    if (!st.fx) st.fx = this.fxPool.acquire();
    st.fx.update(dt, s, figure.group.position, figure.group.rotation.y, this.camera, st.tint);
    st.fx.group.visible = figure.group.visible;
    if (!s.any && st.fx.settled) { this.fxPool.release(st.fx); st.fx = null; }
  }

  private respawn(f: Foe) {
    this.clearSlot(f.st);
    f.home.copy(f.spawn);
    f.figure.setHome(f.spawn);
    f.figure.reset();
    f.hp = this.maxHp;
    f.flash = 0;
    f.dead = -1;
    f.knock.set(0, 0, 0);
    f.offset.set(0, 0, 0);
    f.displaced.set(0, 0, 0);
    this.selected = this.selected.filter((x) => x !== f);
  }

  private makeFoe(home: THREE.Vector3): Foe {
    const figure = new Enemy().setHome(home);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.05, 48),
      new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a0c0c, depthTest: false }));
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.09), new THREE.MeshBasicMaterial({ color: 0xd83a2a, depthTest: false }));
    barFill.position.z = 0.001;
    bg.renderOrder = barFill.renderOrder = 10;
    bar.add(bg, barFill);
    this.group.add(figure.group, ring, bar);
    return {
      figure, home: home.clone(), hp: this.maxHp, flash: 0, flashTint: new THREE.Color(), knock: new THREE.Vector3(), offset: new THREE.Vector3(),
      displaced: new THREE.Vector3(), dead: -1, spawn: home.clone(), ring, bar, barFill, st: newSlot(),
    };
  }

  private pick(x: number, y: number, add: boolean) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.foes.map((f) => f.figure.group), true)[0];
    if (hit) {
      const foe = this.foes.find((f) => f.figure.group === hit.object.parent || f.figure.group === hit.object);
      if (!foe) return;
      if (add) {
        const i = this.selected.indexOf(foe);
        if (i >= 0) this.selected.splice(i, 1);
        else this.selected.push(foe);
      } else this.selected = [foe];
      this.groundPoint = undefined;
    } else {
      const p = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
      this.groundPoint = p.setY(0);
      if (!add) this.selected = [];
    }
    this.onPick?.();
  }

  /** A floating label over `at` (damage numbers, DODGED...). */
  say(text: string, color: string, at: THREE.Vector3, scale = 1) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;color:${color};text-shadow:0 2px 6px #000;transform:translate(-50%,-50%) scale(${scale});`;
    this.overlay.appendChild(el);
    const jitter = new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.8), 0, THREE.MathUtils.randFloatSpread(0.8));
    this.labels.push({ el, t: 0, pos: at.clone().add(new THREE.Vector3(0, 2.6, 0)).add(jitter) });
  }

  private updateLabels(dt: number) {
    const v = new THREE.Vector3();
    this.labels = this.labels.filter((l) => {
      l.t += dt;
      if (l.t > 1) { l.el.remove(); return false; }
      v.copy(l.pos).add(new THREE.Vector3(0, l.t * 1.4, 0)).project(this.camera);
      l.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      l.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
      l.el.style.opacity = String(1 - l.t * l.t);
      return true;
    });
  }
}
