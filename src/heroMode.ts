import * as THREE from 'three';
import type { Arena } from './arena';
import type { Enemy } from './effects/common';
import type { TargetingSpec } from './effects/targeting';
import type { StatusKind, StatusSet } from './effects/status';
import type { HeroKit, HeroSpell } from './heroes';
import { HeroFigure, castStyle } from './heroFigure';
import { AttackFx, Attacker, attackFor, type AttackSpec } from './attacks';
import { traitFor, type TraitRuntime } from './traits';
import { BUFF_COLOR, BUFF_GLYPH, DEBUFFS } from './effects/status';
import { arcBendFor, arcPoints } from './effects/projectile';
import { TOUCH, Joystick, aimButton, pinchZoom, type TouchTarget } from './touch';
import { bankPath, stopsAtCover, type Obstacle } from './obstacles';
import { isOwnWall } from './traits/mime';

/** What hero mode needs from main.ts. */
export interface HeroModeHost {
  arena: Arena;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  /** Targeting of a registered effect, undefined if the label is unknown or not targeted. */
  targeting(label: string): TargetingSpec | undefined;
  /** Casts the effect with the arena's current target; returns the seconds the hero is rooted (to the impact). */
  cast(label: string): number;
  /** Click on the portrait: switch to the next hero (main owns the kit list). */
  nextKit?(): void;
}

const HERO_SPEED = 4;
const GREY_SLOT = 'grayscale(1) brightness(0.5)';
const CAM_OFFSET = new THREE.Vector3(0, 15, 10.5);
const ARC_SEGS = 24;
const HOVER_PICK = TOUCH ? 3.2 : 2.2; // how close to the cursor an enemy counts as hovered (a fingertip is wider)
const BODY_PICK = 0.85; // how close to a figure's upright body the mouse ray must pass for the mouse to be on it (m)
const BODY_HEIGHT = 2.3;
const MOVE_MARK = '#5dff9a'; // the order marker: green on the ground, red on an enemy
const ATTACK_MARK = '#ff4a3a';
const AIM_PALE = '#e6e1d6'; // the range ring and, on a coloured kit, whatever cover blocks
const AIM_GREY = '#8d8a86'; // what cover blocks on a kit whose own colour is pale already

/** How light a colour looks on screen, 0..1. THREE.Color holds linear values, so it has to be asked for sRGB. */
function lightness(color: string) {
  return new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).l;
}

/** A kit's foil for HUD text and rims: on some kits it is a dark trim colour, unreadable on the dark panel. */
function hudInk(kit: HeroKit) {
  return lightness(kit.foil) < 0.55 ? AIM_PALE : kit.foil;
}

/** The colour of an aim mark that cover blocks: it has to differ from the kit's accent and show on the dark floor. */
function blockedTint(accent: string) {
  return lightness(accent) > 0.8 ? AIM_GREY : AIM_PALE;
}

export type Target = { enemy: Enemy } | { point: THREE.Vector3 };

let swordCursor = '';
/** The cursor on an enemy, as in League: a small red sword, drawn once. */
function attackCursor() {
  if (swordCursor) return swordCursor;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  for (const [color, width] of [['#2a0604', 7], ['#ff4a3a', 3.5]] as const) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath(); g.moveTo(4, 4); g.lineTo(24, 24); g.stroke();
    g.beginPath(); g.moveTo(17, 26); g.lineTo(26, 17); g.stroke();
  }
  swordCursor = `url(${c.toDataURL()}) 4 4, pointer`;
  return swordCursor;
}

/**
 * A MOBA-style test mode for a hero kit: click the ground to walk there, Q/W/E/R to aim a spell (a range ring at
 * the hero, a line for single-target spells, the area circle for ground spells), click to cast, right-click or Esc
 * to cancel. Self-cast spells go off at once. Out-of-range targets: the hero walks into range, then casts. A fixed
 * top-down camera follows the hero (wheel zooms). Enemies keep their HP between casts and respawn.
 */
export class HeroMode implements TouchTarget {
  enabled = false;
  readonly group = new THREE.Group();

  private kit: HeroKit;
  private cooldowns = [0, 0, 0, 0];
  private rooted = 0;
  /** A trait's hold set during the cast's rules (`holdStill`), applied after the spell's own root. */
  private holdFloor = 0;
  private aiming = -1;
  private moveTo: THREE.Vector3 | null = null;
  /** Seconds the walk has made next to no way. */
  private walkStuck = 0;
  /** A cast walking into range or sight. `atSpot`: it follows an enemy, and flies at the spot where the enemy stands when it goes. */
  private pending: { slot: number; target: Target; atSpot?: boolean } | null = null;
  private zoom = 1.25;
  private snapCamera = false;
  private mouse = new THREE.Vector2(2, 2);
  private cursor = new THREE.Vector3();
  private hovered: Enemy | null = null;
  /** The enemy the mouse is on, aiming or not (src/duel.ts outlines it). */
  private hoverFoe: Enemy | null = null;
  private shownCursor = '';
  /** A mouse button held since a walk order: the hero keeps walking at the cursor. */
  private heldOrder = false;
  /** The mouse came onto an enemy, or left it (null). */
  onHover?: (enemy: Enemy | null) => void;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Indicators.
  private rangeRing: THREE.Mesh;
  private areaRing: THREE.Mesh;
  private areaFill: THREE.Mesh;
  private aimLine: THREE.Mesh;
  /** The arrow head at the end of a skillshot's aim strip (`HeroSpell.aim: 'line'`). */
  private aimTip: THREE.Mesh;
  private aimBounce: THREE.Mesh;
  /** The flat end of a strip that cover cuts: an arrow flies on, this says the spell stops here. */
  private aimStop: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private moveMarker: THREE.Mesh;
  private moveMarkerT = 1;
  /** The curved strip of an arc aim (`HeroSpell.aim: 'arc'`): a ribbon along the arc from the hero to the cursor. */
  private aimArc: THREE.Mesh;
  /** The side an arc aimed straight at the enemy bows to (+1 right, -1 left): flips after every arc cast. */
  private arcRest = 1;
  /** Shift held: the arc bows the other way. */
  private arcFlip = false;
  /** The bend of the cast that just went out (0 unless it was an arc aim): a network duel sends it with the cast. */
  castBend = 0;

  // The hero's figure (stands in for the arena's capsule caster while hero mode is on).
  private figure = new HeroFigure();
  /** Seconds the hero stays frozen solid (a trait's hold): the figure's pose stops too. */
  private heldFor = 0;
  /** Camera shake from hits on the hero (read by the render loop), decays on its own. */
  hitShake = 0;
  /** Basic attacks (src/attacks): the enemy being attacked, an attack-move point, and whether A armed attack-move. */
  private attacker: Attacker;
  private attackFx = new AttackFx();
  private attackSpec: AttackSpec;
  private attackTarget: Enemy | null = null;
  /** The aim is a phone's press with no drag: it means the nearest enemy, and the player has not looked at a strip. */
  private autoAimed = false;
  private attackMove: THREE.Vector3 | null = null;
  private attackArmed = false;
  /** Basic attacks on (off in a network duel: the server does not relay them yet). */
  attacksEnabled = true;
  /** Duel: no orders or casts (the hero is down, or the round is over). */
  locked = false;
  /** Run duel (AI vs AI): the mouse and keys don't control the hero; the autopilot does. */
  spectate = false;
  /** Run duel: the camera looks here instead of following the hero (the ring's centre), at `focusZoom`. */
  focus: THREE.Vector3 | null = null;
  focusZoom = 1.5;
  /** Duel: called after every cast the player makes (slot 0-3 and what it was aimed at). */
  onCast?: (label: string, slot: number, target: Target) => void;
  /**
   * A basic attack on `target` was released (a network duel tells the other side). `echo` is 0 for a normal attack
   * and the trait's echo share (0..1) for the echo's second hit (see `Trait.attackEcho`).
   */
  onAttack?: (target: Enemy, echo: number) => void;
  /** The duel says an echo against `target` is not played as a second hit (online: against the other hero it is folded into the first). */
  skipEcho?: (target: Enemy) => boolean;
  /**
   * The duel's rules for this hero's identity layer (src/traits): ammo, recast, hold charge, cooldown changes, the
   * resource and the passive's badge. Null outside a duel (plain hero mode plays the kit as is).
   */
  traits: TraitRuntime | null = null;
  /** The duel turns a cast's charge and the trait's rules into the cooldown (and remembers the cast's mods). */
  castRules?: (slot: number, base: number, charge: number) => number;
  /** When the current aim started (performance.now()), for hold-to-charge slots. */
  private aimStart = 0;
  /**
   * Network duel, the side that starts at the -Z end of the ring: the camera looks from -Z toward +Z, so the
   * opponent is in front of the camera instead of behind it.
   */
  flipCamera = false;

  // HUD.
  private hud: HTMLDivElement;
  private slotEls: { box: HTMLDivElement; shade: HTMLDivElement; secs: HTMLDivElement }[] = [];
  /** The passive slot (badge), the resource bar and the buff row. */
  private passiveEls: { badge: HTMLDivElement; resFill: HTMLDivElement; resText: HTMLDivElement; resBox: HTMLDivElement; buffs: HTMLDivElement } | null = null;
  private tip: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastT = 0;
  /** Blind: a dark screen vignette, faded in and out with the status. */
  private vignette: HTMLDivElement;
  private vignetteA = 0;

  // Touch (src/touch.ts): the joystick's walk direction on the ground, whether a slot button is aiming (the aim
  // point then comes from the drag, not the mouse), the camera's lead toward the walk, and fingers on the scene.
  private joystick: Joystick | null = null;
  private steering: THREE.Vector3 | null = null;
  private touchAiming = false;
  private lead = new THREE.Vector3();
  private fingers: () => number = () => 0;
  private attackBtn: HTMLDivElement | null = null;
  private tipTimer = 0;

  constructor(private host: HeroModeHost, kit: HeroKit) {
    this.kit = kit;
    this.attackSpec = attackFor(kit);
    this.attacker = new Attacker({
      arena: host.arena,
      fx: this.attackFx,
      self: () => host.arena.caster,
      spec: () => this.attackSpec,
      land: (target, opts) => host.arena.hit(target, opts),
      posOf: (target) => this.targetPos({ enemy: target }),
      released: (target, echo) => this.onAttack?.(target, echo),
      reach: () => this.traits?.attackReach() ?? 0,
      echo: (target) => (this.traits && !this.skipEcho?.(target) ? this.traits.attackEcho() : 0),
    });
    this.group.add(this.attackFx.group);
    const flat = (geo: THREE.BufferGeometry, color: string, opacity: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 5;
      m.visible = false;
      this.group.add(m);
      return m;
    };
    this.rangeRing = flat(new THREE.RingGeometry(0.985, 1, 96), AIM_PALE, 0.45);
    this.areaRing = flat(new THREE.RingGeometry(0.95, 1, 72), kit.accent, 0.85);
    this.areaFill = flat(new THREE.CircleGeometry(1, 72), kit.accent, 0.12);
    // Unit-length strip along +Y in the ring plane; after the flat rotation it points along -Z, scaled per frame.
    this.aimLine = flat(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), kit.accent, 0.28);
    // A triangle with its base on the origin and its tip at +Y 1 (same plane trick as the strip).
    this.aimTip = flat(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)])), kit.accent, 0.5);
    this.hoverRing = flat(new THREE.RingGeometry(0.95, 1.2, 48), kit.accent, 0.95);
    // The first bounce of a bank shot (`HeroSpell.bank`), a fainter strip of the same shape.
    this.aimBounce = flat(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), kit.accent, 0.18);
    this.aimBounce.visible = false;
    this.aimStop = flat(new THREE.PlaneGeometry(1, 1), kit.accent, 0.9);
    // A ribbon of ARC_SEGS segments in world coordinates (positions rewritten every frame while an arc is aimed).
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_SEGS + 1) * 6), 3));
    const idx: number[] = [];
    for (let i = 0; i < ARC_SEGS; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    ribbon.setIndex(idx);
    this.aimArc = new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.aimArc.renderOrder = 5;
    this.aimArc.frustumCulled = false;
    this.aimArc.visible = false;
    this.group.add(this.aimArc);
    this.moveMarker = flat(new THREE.RingGeometry(0.3, 0.42, 32), MOVE_MARK, 0.9);
    this.group.add(this.figure.group);
    this.group.visible = false;

    this.hud = this.buildHud();
    this.tip = document.createElement('div');
    this.tip.style.cssText =
      'position:fixed;z-index:7;max-width:260px;padding:8px 10px;border-radius:6px;display:none;pointer-events:none;' +
      `background:rgba(12,6,8,0.94);border:1px solid #4a1a22;color:#e9dcc6;font:12px/1.35 ui-sans-serif,system-ui;`;
    this.toast = document.createElement('div');
    this.toast.style.cssText =
      `position:fixed;left:50%;${TOUCH ? 'top:30%' : 'bottom:150px'};transform:translateX(-50%);z-index:7;pointer-events:none;opacity:0;` +
      'font:700 14px ui-sans-serif,system-ui;color:#ffb0b8;text-shadow:0 2px 6px #000;';
    this.vignette = document.createElement('div');
    this.vignette.style.cssText =
      'position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0;display:none;' +
      'background:radial-gradient(ellipse at center,rgba(4,2,8,0) 22%,rgba(4,2,8,0.55) 52%,rgba(4,2,8,0.96) 88%);';
    document.body.append(this.tip, this.toast, this.vignette);
    window.addEventListener('resize', () => this.fitHud());

    const dom = host.dom;
    dom.addEventListener('pointermove', (e) => this.setMouse(e));
    if (TOUCH) this.fingers = pinchZoom(dom, this);
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (TOUCH) { if (this.fingers() <= 1) this.tapAt(e.clientX, e.clientY); return; }
      // The click itself says where the cursor is (a click can come without a move before it).
      this.setMouse(e);
      this.updateCursor();
      if (e.button === 0) {
        if (this.aiming >= 0) this.confirm();
        else if (this.attackArmed) this.attackClick();
        else {
          this.order();
          this.heldOrder = true;
        }
      } else if (e.button === 2) {
        if (this.aiming >= 0) this.cancelAim();
        else if (this.attackArmed) this.disarm();
        else {
          // As in League: right-click on an enemy attacks it; on the ground it walks, and held it keeps walking.
          const enemy = this.enemyUnderMouse();
          if (enemy && this.attacksEnabled) this.attackOrder(enemy);
          else {
            this.order();
            this.heldOrder = true;
          }
        }
      }
    });
    window.addEventListener('pointerup', () => { this.heldOrder = false; });
    window.addEventListener('blur', () => { this.heldOrder = false; });
    dom.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.001), 0.55, 1.7);
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const i = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].indexOf(e.code);
      if (i >= 0) { e.preventDefault(); this.disarm(); this.beginAim(i); }
      if (e.code === 'KeyA' && this.attacksEnabled && !this.locked && !this.spectate) {
        this.cancelAim();
        this.attackArmed = true;
        this.host.dom.style.cursor = 'crosshair';
      }
      if (e.code === 'KeyS') this.stop();
      if (e.code === 'Escape') { this.cancelAim(); this.disarm(); }
    });
  }

  /** Walk speed in m/s: the hero's own (its trait), else the default. */
  get speed() {
    return traitFor(this.kit.name)?.speed ?? HERO_SPEED;
  }

  /** Sets a slot's cooldown (a trait refund or reset). */
  setCooldown(i: number, seconds: number) {
    this.cooldowns[i] = Math.max(0, seconds);
  }

  get kitName() {
    return this.kit.name;
  }

  get currentKit(): HeroKit {
    return this.kit;
  }

  /** The hero's status effects (stun, root, slow, silence, blind, knock-up), kept by the arena on the caster figure. */
  get status(): StatusSet {
    return this.host.arena.statusOf(this.host.arena.caster)!;
  }

  /**
   * A status on the hero (the duel: an enemy hit landed). Same rules as everywhere: caps, refresh, stun immunity.
   * Stun / knock-up / root stop walking, stun / knock-up / silence stop casting, slow walks at x0.6, blind makes the
   * next casts land off the aim point. Returns false when the hero is immune.
   */
  applyStatus(kind: StatusKind, seconds: number, color?: string) {
    return this.host.arena.applyStatus(this.host.arena.caster, kind, seconds, color);
  }

  /** How veiled the hero's figure looks, 0..1 (Nyx). */
  setFigureVeil(v: number) {
    this.figure.setVeil(v);
  }

  /** Not drawn at all (`Trait.figureHidden`). */
  setFigureHidden(hidden: boolean) {
    if (this.figure.shown) this.figure.shown.visible = !hidden;
  }

  /** The hero's figure has loaded (or it has none to load). */
  get figureLoaded() {
    return this.figure.loaded;
  }

  /** Ends a hold or a cast's root early (a broken channel). */
  release() {
    this.rooted = 0;
    this.heldFor = 0;
  }

  /** The hero stands still and does not attack for `seconds` (a trait's self-lock: Isolde's ice block). */
  holdStill(seconds: number) {
    this.rooted = Math.max(this.rooted, seconds);
    // A trait holds inside the cast's rules, before the spell sets its own root: keep the longer of the two then.
    this.holdFloor = Math.max(this.holdFloor, seconds);
    this.heldFor = Math.max(this.heldFor, seconds);
    this.moveTo = null;
    this.clearAttack();
  }

  /** Clears cooldowns, aim and orders (a new duel round). */
  resetRound() {
    this.cooldowns.fill(0);
    this.rooted = 0;
    this.heldFor = 0;
    this.host.arena.clearStatuses(this.host.arena.caster);
    this.pending = null;
    this.moveTo = null;
    this.cancelAim();
    this.clearAttack();
    this.attacker.reset();
    this.attackFx.clear();
    this.figure.stand();
  }

  /** Jumps the camera to the hero on the next frame (no lerp). */
  snapCameraNow() {
    this.snapCamera = true;
  }

  /** Tips the hero's figure over (defeat), `t` 0..1. */
  fallHero(t: number) {
    this.figure.fall(t);
  }

  /** Stands the fallen hero up again (a partner got it up in a raid). */
  standHero() {
    this.figure.stand();
  }

  /**
   * A hit landed on the hero (the duel): the figure flinches away from `from` and flashes in the hit's colour, and the
   * camera shakes a little on big hits. `damage` is what got through; a fully shielded hit only flashes.
   */
  figureHit(damage: number, color?: string, from?: THREE.Vector3) {
    const strength = Math.min(1, damage / 60);
    this.figure.hit(damage > 0 ? 0.25 + 0.75 * strength : 0.1, damage > 0 ? color : '#9cc4ec', from);
    if (damage >= 25) this.hitShake = Math.max(this.hitShake, 0.04 + 0.1 * strength);
  }

  /** Switches the hero: new bar, indicator colours from the kit, cooldowns and aim cleared. */
  setKit(kit: HeroKit) {
    this.kit = kit;
    this.attackSpec = attackFor(kit);
    this.clearAttack();
    this.attacker.reset();
    const color = (m: THREE.Mesh, c: string) => (m.material as THREE.MeshBasicMaterial).color.set(c);
    for (const m of [this.areaRing, this.areaFill, this.aimLine, this.aimTip, this.aimBounce, this.aimArc, this.hoverRing]) color(m, kit.accent);
    const shown = this.hud.style.display;
    this.hud.remove();
    this.joystick?.el.remove();
    this.slotEls = [];
    this.hud = this.buildHud();
    this.hud.style.display = shown;
    this.tip.style.display = 'none';
    this.cancelAim();
    this.pending = null;
    this.cooldowns.fill(0);
    this.showFigure();
  }

  /** The other half of a two-kit hero comes in (`HeroKit.alt`): new bar and model, the cooldowns stay per slot. */
  swapKit(kit: HeroKit) {
    const left = [...this.cooldowns];
    this.setKit(kit);
    left.forEach((c, i) => { this.cooldowns[i] = c; });
  }

  preloadFigure(url: string) {
    this.figure.preload(url);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
    this.hud.style.display = on ? 'flex' : 'none';
    if (this.joystick) { this.joystick.release(); this.joystick.el.style.display = on ? '' : 'none'; }
    this.steering = null;
    this.touchAiming = false;
    this.host.arena.pickEnabled = !on;
    this.host.arena.persist = on;
    this.host.dom.style.cursor = '';
    this.aiming = -1;
    this.moveTo = null;
    this.pending = null;
    this.clearAttack();
    this.attacker.reset();
    this.attackFx.clear();
    this.cooldowns.fill(0);
    this.rooted = 0;
    this.host.arena.clearStatuses(this.host.arena.caster);
    if (!on) { this.vignetteA = 0; this.vignette.style.display = 'none'; }
    if (on) { this.host.arena.clearSelection(); this.snapCamera = true; }
    this.showFigure();
  }

  update(dt: number) {
    if (!this.enabled) return;
    const arena = this.host.arena;
    const hero = arena.caster.group.position;
    for (let i = 0; i < 4; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.rooted = Math.max(0, this.rooted - dt);
    this.heldFor = Math.max(0, this.heldFor - dt);
    this.hitShake = Math.max(0, this.hitShake - dt * 0.5);

    this.followCamera(hero, dt);
    if (!this.touchAiming) this.updateCursor();
    if (!TOUCH) this.updateHover();

    if (this.locked) { this.pending = null; this.moveTo = null; this.clearAttack(); if (this.aiming >= 0) this.cancelAim(); }
    // The joystick: keep a walk order a step ahead in its direction (drops the attack, like a click). A cast that
    // walks into range or sight first goes on: the stick takes over again once it fires.
    if (this.steering && !this.pending && !this.locked && !this.spectate && !arena.isDashing(arena.caster)) {
      this.clearAttack();
      this.moveTo = hero.clone().addScaledVector(this.steering, 1.5);
    }
    if (this.heldOrder && !this.pending && this.aiming < 0 && !this.locked && !this.spectate && !arena.isDashing(arena.caster)) {
      this.moveTo = this.cursor.clone();
    }
    this.attacker.update(dt);
    this.attackFx.update(dt);
    if (!this.pending && !this.spectate) this.updateAttack(hero);
    // Walk toward the order (or into range of a pending cast).
    if (this.pending) {
      const spell = this.kit.spells[this.pending.slot];
      const at = this.targetPos(this.pending.target);
      if (!at) this.pending = null;
      else if (flatDist(hero, at) <= spell.range && arena.lineOfSight(hero, at)) {
        const p = this.pending;
        this.pending = null;
        this.castNow(p.slot, p.atSpot ? { point: at.clone().setY(0) } : p.target);
      } else this.moveTo = at.clone();
    }
    const status = this.status;
    // Charmed: the hero walks to whoever charmed it, whatever the player orders.
    if (status.charmed && !arena.isDashing(arena.caster)) {
      this.moveTo = null;
      const foe = arena.liveFoes()[0];
      if (foe) {
        const d = new THREE.Vector3(foe.pos.x - hero.x, 0, foe.pos.z - hero.z);
        const len = d.length();
        if (len > 1.2) arena.walk(d.multiplyScalar(this.speed * status.speedMul * dt / len), len, true);
      }
    }
    if (this.moveTo && this.rooted <= 0 && !this.attacker.winding && !status.cannotMove && !arena.isDashing(arena.caster)) {
      // A click finds its way round the cover (src/nav.ts); the stick walks where it points and slides along cover.
      const stick = !!this.steering;
      const way = stick ? null : arena.route(arena.caster.group, hero, this.moveTo);
      const next = way ? way.point : this.moveTo;
      const d = new THREE.Vector3(next.x - hero.x, 0, next.z - hero.z);
      const len = d.length();
      if (flatDist(hero, way ? way.goal : this.moveTo) < 0.05) {
        this.moveTo = null;
        // As far as the ground goes, and the cast above still could not go: it never will from here.
        if (this.pending) { this.pending = null; this.say('No line of sight'); }
      } else if (len > 1e-4) {
        const before = hero.clone();
        const step = this.speed * status.speedMul * dt;
        arena.walk(d.multiplyScalar(Math.min(1, step / len)), len, stick);
        // Something the route did not know holds the hero back (a wall just raised, a shove): give the order up.
        this.walkStuck = flatDist(hero, before) < Math.min(step, len) * 0.25 ? this.walkStuck + dt : 0;
        if (this.walkStuck > 0.6) { this.moveTo = null; this.walkStuck = 0; }
      }
    }

    this.updateIndicators(dt, hero);
    this.updateHud(dt);
    const caster = arena.caster.group;
    this.figure.follow(dt, hero, caster.rotation.y, { attack: this.attacker.motion, status: this.status, held: this.heldFor > 0 });
  }

  // --- touch (TouchTarget) -----------------------------------------------------------------------------

  /** A screen direction (px right, px down) as a unit ground direction, relative to how the camera looks. */
  private screenToGround(dx: number, dy: number) {
    const fwd = this.host.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return right.multiplyScalar(dx).addScaledVector(fwd, -dy).normalize();
  }

  steer(dx: number, dy: number, push: number) {
    if (!this.enabled) return;
    // The thumb back at the middle of the stick: stand still, not on in the old direction.
    if (push < 0.15) {
      this.stopSteer();
      return;
    }
    this.steering = this.screenToGround(dx, dy);
  }

  stopSteer() {
    if (this.steering) this.moveTo = null;
    this.steering = null;
  }

  tapAt(x: number, y: number) {
    // A tap with another finger mid-aim would move the aim point (the cursor) and drop the cast: ignore it.
    if (!this.enabled || this.touchAiming) return;
    const r = this.host.dom.getBoundingClientRect();
    this.mouse.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.updateCursor();
    // No right button on a phone: a tap on an enemy attacks it, a tap on the ground walks there.
    const enemy = this.enemyNearCursor();
    if (enemy && this.attacksEnabled) this.attackOrder(enemy);
    else this.order();
  }

  aimPress(i: number) {
    if (!this.enabled) return false;
    this.disarm();
    this.aiming = -1; // beginAim toggles: start fresh
    this.beginAim(i);
    this.touchAiming = this.aiming === i;
    if (this.touchAiming) this.say(this.kit.spells[i].name);
    return this.touchAiming;
  }

  /** Aims at the nearest live enemy (a press without a drag), else a little ahead of the hero. */
  aimAuto() {
    if (this.aiming < 0) return;
    this.autoAimed = true;
    const hero = this.host.arena.caster.group.position;
    const foe = this.nearestFoe();
    if (foe) this.cursor.set(foe.pos.x, 0, foe.pos.z);
    else {
      const yaw = this.host.arena.caster.group.rotation.y, r = this.kit.spells[this.aiming].range * 0.6;
      this.cursor.set(hero.x + Math.sin(yaw) * r, 0, hero.z + Math.cos(yaw) * r);
    }
  }

  aimDrag(dx: number, dy: number, f: number) {
    if (this.aiming < 0) return;
    this.autoAimed = false;
    const hero = this.host.arena.caster.group.position;
    const d = this.screenToGround(dx, dy).multiplyScalar(Math.max(0.5, this.kit.spells[this.aiming].range * f));
    this.cursor.set(hero.x + d.x, 0, hero.z + d.z);
  }

  aimEnd(cancel: boolean) {
    this.touchAiming = false;
    if (this.aiming < 0) return;
    if (cancel) { this.cancelAim(); return; }
    this.confirm();
    // A single-target spell released away from any enemy: drop the aim (a finger can't hover to finish it).
    if (this.aiming >= 0) this.cancelAim();
  }

  zoomBy(f: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.55, 1.7);
  }

  private nearestFoe() {
    const hero = this.host.arena.caster.group.position;
    let best: ReturnType<Arena['liveFoes']>[number] | null = null, bd = Infinity;
    for (const f of this.host.arena.liveFoes()) {
      const d = flatDist(hero, f.pos);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /** The attack button: attack the nearest live enemy until another order. */
  private attackNearest() {
    if (!this.enabled) return;
    const foe = this.nearestFoe();
    if (!foe) { this.say('No enemy'); return; }
    if (this.attacksEnabled) this.attackOrder(foe.figure);
  }

  // --- figure -------------------------------------------------------------------------------------------

  /** Shows the current kit's figure and hides the capsule caster (or restores the capsule when off). */
  private showFigure() {
    const capsule = this.host.arena.caster.group;
    const shown = this.figure.setModel(this.enabled ? this.kit.model : undefined, capsule.position, this.kit);
    for (const c of capsule.children) c.visible = !shown;
  }


  private setMouse(e: PointerEvent) {
    const r = this.host.dom.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.arcFlip = e.shiftKey;
  }

  /**
   * The bend of an arc aim at `point` (see `arcBendFor`): the axis is the line toward the nearest enemy (else the
   * way the hero faces). The mouse and a touch drag give the point the same way, so the rule is the same on a phone.
   */
  private arcBend(hero: THREE.Vector3, point: THREE.Vector3) {
    const foe = this.nearestFoe();
    const yaw = this.host.arena.caster.group.rotation.y;
    const axis = foe ? new THREE.Vector3(foe.pos.x - hero.x, 0, foe.pos.z - hero.z) : new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    if (axis.lengthSq() < 1e-6) axis.set(Math.sin(yaw), 0, Math.cos(yaw));
    return arcBendFor(hero, point, axis.normalize(), this.arcRest, this.arcFlip);
  }

  /** Ground point under the mouse (the hero's feet if the ray misses the ground). */
  private updateCursor() {
    const cam = this.host.camera;
    cam.updateMatrixWorld();
    this.raycaster.setFromCamera(this.mouse, cam);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.cursor)) this.cursor.copy(this.host.arena.caster.group.position);
    this.cursor.y = 0;
  }

  // --- orders -------------------------------------------------------------------------------------------

  /** Click on the ground (not aiming): walk there, and forget a pending cast. */
  private order() {
    if (this.locked || this.spectate || this.host.arena.isDashing(this.host.arena.caster)) return;
    this.pending = null;
    this.clearAttack();
    this.moveTo = this.cursor.clone();
    this.mark(this.cursor, MOVE_MARK);
  }

  /** The order marker at `at`. */
  private mark(at: THREE.Vector3, color: string) {
    this.moveMarker.position.set(at.x, 0.06, at.z);
    (this.moveMarker.material as THREE.MeshBasicMaterial).color.set(color);
    this.moveMarkerT = 0;
  }

  private beginAim(i: number) {
    if (this.locked || this.spectate) return;
    const spell = this.kit.spells[i];
    if (this.status.cannotCast) { this.say(this.status.stunned ? 'Stunned' : 'Silenced'); return; }
    const recast = !!this.traits?.canRecast(i);
    if (this.cooldowns[i] > 0 && !recast) { this.say(`${spell.name} is on cooldown`); return; }
    const why = recast ? null : this.traits?.blocked(i);
    if (why) { this.say(why); return; }
    this.aimStart = performance.now();
    // A recast that only acts (`recast.replay: false`) has nothing to aim: it goes off at once.
    if (recast && this.traits?.recastOf(i)?.replay === false) {
      this.aiming = -1;
      this.castNow(i, { point: this.host.arena.caster.group.position.clone() });
      return;
    }
    const spec = this.host.targeting(spell.label);
    if (!spec) { this.say(`${spell.label}: not a targeted effect`); return; }
    if (spec.mode === 'self') {
      this.aiming = -1;
      this.castNow(i, { point: this.host.arena.caster.group.position.clone() });
      return;
    }
    this.aiming = this.aiming === i ? -1 : i; // pressing the key again cancels
    this.host.dom.style.cursor = this.aiming >= 0 ? 'crosshair' : '';
  }

  // --- basic attacks -------------------------------------------------------------------------------------

  /** Right-click on an enemy: walk into range and keep attacking it until another order. */
  private attackOrder(enemy: Enemy) {
    if (this.locked || this.spectate || this.host.arena.isDashing(this.host.arena.caster)) return;
    this.pending = null;
    this.attackMove = null;
    this.attackTarget = enemy;
    this.host.arena.setTarget(enemy);
    this.mark(enemy.group.position, ATTACK_MARK);
  }

  /** A left-click after A: attack the enemy under the cursor, else walk there attacking the first enemy in range. */
  private attackClick() {
    const enemy = this.enemyNearCursor();
    this.disarm();
    if (enemy) { this.attackOrder(enemy); return; }
    if (this.locked || this.spectate) return;
    this.pending = null;
    this.attackTarget = null;
    this.attackMove = this.cursor.clone();
    this.moveTo = this.cursor.clone();
    this.mark(this.cursor, ATTACK_MARK);
  }

  /** S: stand still (drops the walk, the attack and a pending cast). */
  private stop() {
    if (this.locked || this.spectate) return;
    this.pending = null;
    this.moveTo = null;
    this.clearAttack();
  }

  private disarm() {
    if (!this.attackArmed) return;
    this.attackArmed = false;
    if (this.aiming < 0) this.host.dom.style.cursor = '';
  }

  private clearAttack() {
    this.attackTarget = null;
    this.attackMove = null;
    this.attacker.cancel();
  }

  /** Each frame: chase the attack target and attack it in range; on an attack-move, pick up the first enemy in range. */
  private updateAttack(hero: THREE.Vector3) {
    if (!this.attacksEnabled) { this.clearAttack(); return; }
    if (this.attackMove && !this.attackTarget) {
      let best: Enemy | null = null, bd = this.attacker.range;
      for (const f of this.host.arena.liveFoes()) {
        const d = flatDist(hero, f.pos);
        if (d <= bd && this.attacker.inRange(hero, f.pos)) { bd = d; best = f.figure; }
      }
      if (best) { this.attackTarget = best; this.attackMove = null; }
      else if (!this.moveTo) this.attackMove = null;
    }
    if (!this.attackTarget) return;
    const at = this.targetPos({ enemy: this.attackTarget });
    if (!at) { this.attackTarget = null; return; }
    if (this.attacker.inRange(hero, at)) {
      this.moveTo = null;
      if (this.rooted <= 0) this.attacker.start(this.attackTarget);
    } else if (!this.attacker.winding) this.moveTo = at.clone();
  }

  /** Autopilot: attacks `enemy` now if it is in range and the last attack has recovered. */
  autoAttack(enemy: Enemy) {
    if (this.locked || !this.attacksEnabled || this.rooted > 0) return false;
    const at = this.targetPos({ enemy });
    if (!at || !this.attacker.inRange(this.host.arena.caster.group.position, at)) return false;
    return this.attacker.start(enemy);
  }

  /** The hero is in the middle of an attack's wind-up (the autopilot should not walk). */
  get attackWinding() {
    return this.attacker.winding;
  }

  /** The hero's basic attack (range, damage, timing). `range` here is the base: see `attackRange`. */
  get attack(): AttackSpec {
    return this.attackSpec;
  }

  /** The basic attack's reach now: the base range plus the trait's `attackReach` (m). */
  get attackRange() {
    return this.attacker.range;
  }

  /** The basic attack is ready at once (a trait's `resetAttack`). */
  resetAttack() {
    this.attacker.ready();
  }

  private cancelAim() {
    this.aiming = -1;
    this.autoAimed = false;
    this.host.dom.style.cursor = '';
  }

  private confirm() {
    const i = this.aiming, tapped = this.autoAimed;
    const spell = this.kit.spells[i];
    const spec = this.host.targeting(spell.label)!;
    const hero = this.host.arena.caster.group.position;
    let target: Target;
    if (spec.mode === 'enemy' || spec.mode === 'enemies') {
      const enemy = this.enemyNearCursor();
      if (!enemy) { this.say('No enemy there'); return; }
      target = { enemy };
    } else {
      target = { point: clampToRange(hero, this.cursor, spell.range) };
    }
    this.cancelAim();
    const at = this.targetPos(target)!;
    // A skillshot flies along its aim at once: its strip has shown where cover stops it, and a bank shot wants the wall.
    // A tap on a phone has shown no strip and means the enemy, so it walks into sight first, unless the spell passes over cover.
    const fires = spell.aim === 'line' && 'point' in target && (!tapped || !!spell.overCover);
    const sees = fires || this.host.arena.lineOfSight(hero, at);
    if (flatDist(hero, at) <= spell.range + 1e-3 && sees) this.castNow(i, target);
    else {
      // Out of range or behind a pillar / wall: walk toward the target and cast once it is in range and in sight.
      if (!sees) this.say('No line of sight');
      const foe = tapped && spell.aim === 'line' ? this.nearestFoe() : null;
      this.pending = foe ? { slot: i, target: { enemy: foe.figure }, atSpot: true } : { slot: i, target };
      this.moveTo = at.clone();
    }
  }

  private castNow(i: number, target: Target) {
    const spell = this.kit.spells[i];
    if (this.status.cannotCast || !this.ready(i)) return;
    const arena = this.host.arena;
    const rt = this.traits;
    // A targeted spell (one enemy, or a chain from it) needs sight of its target, whoever casts it.
    if ('enemy' in target) {
      const mode = this.host.targeting(spell.label)?.mode;
      const at = this.targetPos(target);
      if ((mode === 'enemy' || mode === 'enemies') && at && !arena.lineOfSight(arena.caster.group.position, at)) { this.say('No line of sight'); return; }
    }
    if (rt?.canRecast(i) && rt.recastOf(i)?.replay === false) {
      // A recast that only acts: the trait's `recastAct` runs in the rules and moves the hero; no effect plays and no
      // cast is sent. The first cast's cooldown keeps running.
      this.moveTo = null;
      this.attacker.cancel();
      this.castRules?.(i, spell.cooldown, 1);
      this.rooted = Math.max(this.rooted, this.holdFloor);
      this.holdFloor = 0;
      this.flashSlot(i);
      return;
    }
    if ('enemy' in target) arena.setTarget(target.enemy);
    else arena.setGroundPoint(target.point);
    this.moveTo = null;
    this.attacker.cancel();
    // Blind: the cast point is rolled now and the effect (its danger zones too) is played at the offset spot.
    arena.aimOffset = this.status.blind ? arena.blindOffset() : null;
    // A hold slot charges while it is aimed (each slot on its own); a recast and the autopilot cast at full charge.
    const charge = rt && !this.spectate && !rt.canRecast(i) ? rt.charge(i, (performance.now() - this.aimStart) / 1000) : 1;
    // An arc aim bends toward a side the player sees in the strip; the cast carries it (CastContext.bend).
    let bend = 0;
    if (spell.aim === 'arc' && 'point' in target) {
      bend = this.arcBend(arena.caster.group.position, target.point);
      this.arcRest = -this.arcRest;
    }
    this.castBend = bend;
    arena.aimBend = bend;
    // The rules run before the effect plays: the cast's mods must be ready for hits that land at once.
    const cooldown = this.castRules ? this.castRules(i, spell.cooldown, charge) : spell.cooldown;
    this.rooted = Math.max(this.host.cast(spell.label), this.holdFloor);
    this.holdFloor = 0;
    arena.aimBend = 0;
    this.figure.cast(castStyle(spell, i, 'enemy' in target, this.attacker.motion.melee, this.rooted), this.rooted, i === 3);
    arena.aimOffset = null;
    if (cooldown >= 0) this.cooldowns[i] = cooldown;
    this.onCast?.(spell.label, i, target);
    this.flashSlot(i);
  }

  /** Slot `i` can be cast now: off cooldown (or its recast window is open) and not held back by the hero's rules. */
  ready(i: number) {
    if (this.traits?.canRecast(i)) return true;
    return this.cooldowns[i] <= 0 && !this.traits?.blocked(i);
  }

  /** Autopilot (duel simulations): cooldown left on slot `i`, and whether the hero is rooted by a cast. */
  cooldownOf(i: number) {
    return this.cooldowns[i];
  }

  get isRooted() {
    return this.rooted > 0;
  }

  /** Autopilot: the hero cannot walk (rooted by a cast, or a stun / root / knock-up). */
  get cannotMove() {
    return this.rooted > 0 || this.status.cannotMove;
  }

  /** Autopilot: casts slot `i` at an enemy or a ground point if it is off cooldown (no range check). */
  autoCast(i: number, target: { enemy: Enemy } | { point: THREE.Vector3 }) {
    if (this.locked || this.status.cannotCast || !this.ready(i)) return false;
    const before = this.host.arena.castSeq;
    this.castNow(i, target);
    return this.host.arena.castSeq !== before;
  }

  /** The live enemy nearest the cursor, if one is within reach of it. */
  private enemyNearCursor(): Enemy | null {
    let best = HOVER_PICK, found: Enemy | null = null;
    for (const f of this.host.arena.liveFoes()) {
      const d = flatDist(f.pos, this.cursor);
      if (d < best) { best = d; found = f.figure; }
    }
    return found;
  }

  /** The live enemy whose upright body the mouse is on, if any: the mouse ray, not the ground point behind it. */
  private enemyUnderMouse() {
    const ray = this.raycaster.ray, foot = new THREE.Vector3(), head = new THREE.Vector3();
    let best = BODY_PICK * BODY_PICK, found: Enemy | null = null;
    for (const f of this.host.arena.liveFoes()) {
      foot.set(f.pos.x, 0, f.pos.z);
      head.set(f.pos.x, f.figure.body?.height ?? BODY_HEIGHT, f.pos.z);
      const d = ray.distanceSqToSegment(foot, head);
      if (d < best) { best = d; found = f.figure; }
    }
    return found;
  }

  /** Each frame: tells who the mouse is on (an outline, in the duel) and shows the attack cursor on an enemy. */
  private updateHover() {
    const on = this.spectate || this.locked ? null : this.enemyUnderMouse();
    if (on !== this.hoverFoe) {
      this.hoverFoe = on;
      this.onHover?.(on);
    }
    const want = this.aiming >= 0 || this.attackArmed ? 'crosshair' : on ? attackCursor() : '';
    if (want !== this.shownCursor) {
      this.shownCursor = want;
      this.host.dom.style.cursor = want;
    }
  }

  private targetPos(t: Target): THREE.Vector3 | null {
    if ('point' in t) return t.point;
    const live = this.host.arena.liveFoes().find((f) => f.figure === t.enemy);
    return live ? live.pos : null;
  }

  // --- camera and indicators ----------------------------------------------------------------------------

  private followCamera(hero: THREE.Vector3, dt: number) {
    const cam = this.host.camera;
    if (this.focus) hero = this.focus;
    const flip = this.flipCamera ? -1 : 1;
    const offset = CAM_OFFSET.clone().setZ(CAM_OFFSET.z * flip);
    // The field of view is vertical: a tall screen (a phone held upright) sees little to the sides, so pull back,
    // and look further ahead so more of the ring in front of the hero is in view.
    const fit = cam.aspect < 1.25 ? 1 + (1.25 - cam.aspect) * 0.6 : 1;
    // Touch: the camera leads a little toward where the joystick walks.
    this.lead.lerp(this.steering && !this.focus ? this.steering.clone().multiplyScalar(1.6) : new THREE.Vector3(), 1 - Math.exp(-3 * dt));
    const at = hero.clone().setY(0).add(this.lead);
    const want = at.clone().addScaledVector(offset, (this.focus ? this.focusZoom : this.zoom) * fit);
    cam.position.lerp(want, this.snapCamera ? 1 : 1 - Math.exp(-12 * dt));
    this.snapCamera = false;
    cam.lookAt(at.x, 0.5, at.z - (1.5 + (fit - 1) * 4) * flip);
  }

  private updateIndicators(dt: number, hero: THREE.Vector3) {
    const aiming = this.aiming >= 0;
    const spell = aiming ? this.kit.spells[this.aiming] : null;
    const spec = spell ? this.host.targeting(spell.label) : undefined;
    const single = spec?.mode === 'enemy' || spec?.mode === 'enemies';
    // A skillshot (`aim: 'line'`): a strip and an arrow of the spell's range and width toward the cursor, no ground circle.
    const line = aiming && !single && spell?.aim === 'line';
    // A curving skillshot (`aim: 'arc'`): the strip bends from the hero to the cursor, the way the cast will fly.
    const arc = aiming && !single && spell?.aim === 'arc';

    this.rangeRing.visible = aiming;
    if (spell) {
      this.rangeRing.position.set(hero.x, 0.05, hero.z);
      this.rangeRing.scale.setScalar(spell.range);
    }

    this.hovered = aiming && single ? this.enemyNearCursor() : null;
    this.hoverRing.visible = !!this.hovered;
    if (this.hovered) {
      const p = this.hovered.group.position;
      this.hoverRing.position.set(p.x, 0.07, p.z);
      const inRange = spell ? flatDist(hero, p) <= spell.range : true;
      const castable = inRange && this.host.arena.lineOfSight(hero, p);
      (this.hoverRing.material as THREE.MeshBasicMaterial).color.set(castable ? this.kit.accent : blockedTint(this.kit.accent));
    }

    // Single target: a strip from the hero to the hovered enemy (else toward the cursor), clamped to range.
    this.aimLine.visible = aiming && (single || line);
    this.aimStop.visible = false;
    this.tintStrip(false);
    if (!line) this.aimBounce.visible = false;
    this.aimTip.visible = line;
    if (line && spell) {
      const d = new THREE.Vector3(this.cursor.x - hero.x, 0, this.cursor.z - hero.z);
      if (d.lengthSq() < 1e-4) d.set(Math.sin(this.host.arena.caster.group.rotation.y), 0, Math.cos(this.host.arena.caster.group.rotation.y));
      d.normalize();
      const width = Math.max(0.3, (spec?.radius ?? 0.4) * 2);
      // Cover stops a bolt: the strip ends flat at the wall, in the blocked colour, with no arrow.
      const arena = this.host.arena, ownWalls = spell.passesOwnWalls ? (o: Obstacle) => isOwnWall(arena.caster, o) : undefined;
      // A recast flies no bolt (a leap, a burst where the first one stuck): cover does not end its strip.
      const stop = stopsAtCover(spell) && !this.traits?.canRecast(this.aiming) ? arena.coverStop(hero, { x: hero.x + d.x * spell.range, z: hero.z + d.z * spell.range }, ownWalls) : 1;
      const reach = spell.range * stop;
      const cut = stop < 1;
      this.tintStrip(cut);
      const tip = cut ? 0 : Math.min(1.4, width * 1.5 + 0.5, reach);
      const turn = Math.atan2(-d.x, -d.z);
      if (cut) { this.aimTip.visible = false; this.capStrip(hero, d.x, d.z, reach, turn, width); }
      this.aimLine.position.set(hero.x, 0.055, hero.z);
      this.aimLine.rotation.set(-Math.PI / 2, 0, turn);
      this.aimLine.scale.set(width, Math.max(0.01, reach - tip), 1);
      this.aimTip.position.set(hero.x + d.x * (reach - tip), 0.056, hero.z + d.z * (reach - tip));
      this.aimTip.rotation.set(-Math.PI / 2, 0, turn);
      this.aimTip.scale.set(width + 0.7, tip, 1);
      // A bank shot: the strip ends at the wall and a second one shows the first bounce.
      const path = spell.bank ? bankPath(hero, d, spell.range, 1, this.host.arena.obstacles ?? []) : null;
      if (path && path.length > 2) {
        const first = Math.hypot(path[1].x - hero.x, path[1].z - hero.z);
        this.aimLine.scale.set(width, Math.max(0.01, first), 1);
        this.aimTip.visible = false;
        const bx = path[2].x - path[1].x, bz = path[2].z - path[1].z;
        this.aimBounce.position.set(path[1].x, 0.055, path[1].z);
        this.aimBounce.rotation.set(-Math.PI / 2, 0, Math.atan2(-bx, -bz));
        this.aimBounce.scale.set(width, Math.max(0.01, Math.hypot(bx, bz)), 1);
        this.aimBounce.visible = true;
      } else this.aimBounce.visible = false;
    } else if (this.aimLine.visible && spell) {
      const to = this.hovered ? this.hovered.group.position : this.cursor;
      const end = clampToRange(hero, to, spell.range);
      // The strip ends at the cover in the way, unless the enemy itself is in sight (a unit standing in its own crystal is).
      const stop = this.hovered && this.host.arena.lineOfSight(hero, to) ? 1 : this.host.arena.coverStop(hero, end);
      this.tintStrip(stop < 1);
      const whole = flatDist(hero, end), len = Math.max(0.01, whole * stop);
      this.aimLine.position.set(hero.x, 0.055, hero.z);
      // Rx(-90°)·Rz(θ) takes local +Y to (-sin θ, 0, -cos θ): solve for the direction to `end`.
      const turn = Math.atan2(-(end.x - hero.x), -(end.z - hero.z));
      this.aimLine.rotation.set(-Math.PI / 2, 0, turn);
      if (stop < 1) this.capStrip(hero, (end.x - hero.x) / whole, (end.z - hero.z) / whole, len, turn, 0.8);
      this.aimLine.scale.set(0.8, len, 1);
    }

    // Ground spell: its area circle at the cursor, clamped to range.
    this.aimArc.visible = arc;
    if (arc && spell) this.drawArc(hero, clampToRange(hero, this.cursor, spell.range), Math.max(0.3, (spec?.radius ?? 0.4) * 2));
    const area = aiming && !single && !line && !arc;
    this.areaRing.visible = this.areaFill.visible = area;
    if (area && spell) {
      const c = clampToRange(hero, this.cursor, spell.range);
      const r = spec?.radius ?? 5;
      // A spot behind a pillar or wall can't be targeted: the area shows in the blocked colour.
      const seen = this.host.arena.lineOfSight(hero, c);
      for (const m of [this.areaRing, this.areaFill]) (m.material as THREE.MeshBasicMaterial).color.set(seen ? this.kit.accent : blockedTint(this.kit.accent));
      for (const m of [this.areaRing, this.areaFill]) {
        m.position.set(c.x, 0.06, c.z);
        m.scale.setScalar(r);
      }
    }

    // Move order marker: shrinks and fades.
    this.moveMarkerT = Math.min(1, this.moveMarkerT + dt / 0.45);
    this.moveMarker.visible = this.moveMarkerT < 1;
    this.moveMarker.scale.setScalar(1.4 - this.moveMarkerT * 0.8);
    (this.moveMarker.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - this.moveMarkerT);
  }

  /** The aim strip's colour: the kit's accent, or the blocked colour when cover cuts it. */
  private tintStrip(cut: boolean) {
    const c = cut ? blockedTint(this.kit.accent) : this.kit.accent;
    for (const m of [this.aimLine, this.aimTip, this.aimStop]) (m.material as THREE.MeshBasicMaterial).color.set(c);
  }

  /** The flat end of a strip that cover cuts, `reach` metres along direction (`dx`, `dz`) from the hero. */
  private capStrip(hero: THREE.Vector3, dx: number, dz: number, reach: number, turn: number, width: number) {
    this.aimStop.visible = true;
    this.aimStop.position.set(hero.x + dx * reach, 0.057, hero.z + dz * reach);
    this.aimStop.rotation.set(-Math.PI / 2, 0, turn);
    this.aimStop.scale.set(width + 0.5, 0.18, 1);
  }

  /** Writes the arc strip: a ribbon of `width` along the arc from `hero` to `end`, with the arrow head at its end. */
  private drawArc(hero: THREE.Vector3, end: THREE.Vector3, width: number) {
    const bend = this.arcBend(hero, end);
    const pts = arcPoints(hero, end, bend, ARC_SEGS);
    const pos = (this.aimArc.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= ARC_SEGS; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(ARC_SEGS, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      const nx = (dz / l) * width * 0.5, nz = (-dx / l) * width * 0.5;
      pos.setXYZ(i * 2, pts[i].x + nx, 0.055, pts[i].z + nz);
      pos.setXYZ(i * 2 + 1, pts[i].x - nx, 0.055, pts[i].z - nz);
    }
    pos.needsUpdate = true;
    const tail = pts[ARC_SEGS - 1], tip = pts[ARC_SEGS], d = new THREE.Vector3(tip.x - tail.x, 0, tip.z - tail.z).normalize();
    this.aimTip.visible = true;
    this.aimTip.position.set(tip.x, 0.056, tip.z);
    this.aimTip.rotation.set(-Math.PI / 2, 0, Math.atan2(-d.x, -d.z));
    this.aimTip.scale.set(width + 0.7, Math.min(1.4, width * 1.5 + 0.5), 1);
  }

  // --- HUD ----------------------------------------------------------------------------------------------

  private hudPlate: HTMLElement | null = null;

  private fitHud() {
    if (this.hudPlate) this.hudPlate.style.display = window.innerWidth < 860 ? 'none' : 'flex';
  }

  private buildHud() {
    if (TOUCH) return this.buildTouchHud();
    const kit = this.kit;
    // Panel tints come from the kit's accent, so each hero's bar takes its colour.
    const tint = (pct: number, base = '#060608') => `color-mix(in srgb, ${kit.accent} ${pct}%, ${base})`;
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);width:max-content;z-index:6;display:none;align-items:flex-end;' +
      'gap:14px;padding:10px 16px 12px;border-radius:14px;user-select:none;' +
      `background:linear-gradient(180deg,${tint(14)},${tint(5)});border:1px solid ${tint(32)};opacity:0.97;` +
      'box-shadow:0 8px 28px rgba(0,0,0,0.6);font:600 12px ui-sans-serif,system-ui;color:' + hudInk(kit) + ';';

    // Portrait and name plate.
    const plate = document.createElement('div');
    plate.style.cssText = 'display:flex;align-items:center;gap:10px;padding-right:6px;';
    const portrait = canvasIcon(64, kit.portrait);
    portrait.style.cssText = `width:64px;height:64px;border-radius:50%;border:2px solid ${hudInk(kit)};box-shadow:0 0 0 2px ${tint(18)};`;
    const names = document.createElement('div');
    names.innerHTML = `<div style="font:700 16px ui-serif,Georgia,serif;letter-spacing:0.5px">${kit.name}</div>` +
      `<div style="font:500 11px ui-sans-serif,system-ui;opacity:0.7">${kit.title}</div>` +
      `<div style="margin-top:6px;font:500 10px ui-sans-serif,system-ui;opacity:0.55;line-height:1.4">right-click: walk / attack · Q W E R: aim<br>click: cast · right-click / Esc: cancel</div>`;
    if (this.host.nextKit) {
      portrait.style.cursor = 'pointer';
      portrait.title = 'next hero';
      portrait.addEventListener('click', () => this.host.nextKit?.());
    }
    plate.append(portrait, names);
    root.appendChild(plate);
    // A narrow window drops the name plate, or the bar runs off the screen and hides R.
    this.hudPlate = plate;
    this.fitHud();
    this.passiveEls = this.buildPassive(root, tint);

    kit.spells.forEach((spell, i) => {
      const ult = spell.key === 'R';
      const size = ult ? 74 : 60;
      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
      const box = document.createElement('div');
      box.style.cssText =
        `position:relative;width:${size}px;height:${size}px;border-radius:${ult ? 12 : 9}px;overflow:hidden;cursor:pointer;` +
        `border:2px solid ${ult ? '#c9a24a' : tint(40)};` +
        (ult ? 'box-shadow:0 0 0 1px #2a1a06,0 0 14px rgba(201,162,74,0.35);' : `box-shadow:0 0 0 1px ${tint(10)};`);
      const icon = canvasIcon(128, spell.icon);
      icon.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
      const shade = document.createElement('div');
      shade.style.cssText = 'position:absolute;inset:0;';
      const secs = document.createElement('div');
      secs.style.cssText =
        `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 ${ult ? 22 : 18}px ` +
        'ui-sans-serif,system-ui;color:#fff1e6;text-shadow:0 1px 4px #000;';
      const key = document.createElement('div');
      key.textContent = spell.key;
      key.style.cssText =
        'position:absolute;left:3px;bottom:3px;min-width:16px;height:16px;padding:0 3px;border-radius:4px;' +
        `background:${tint(8)};border:1px solid ${ult ? '#c9a24a' : tint(55)};color:${ult ? '#ffd27a' : hudInk(kit)};` +
        'font:800 11px ui-sans-serif,system-ui;display:flex;align-items:center;justify-content:center;';
      box.append(icon, shade, secs, key);
      box.addEventListener('click', () => this.beginAim(i));
      box.addEventListener('mouseenter', () => this.showTip(box, spell));
      box.addEventListener('mouseleave', () => (this.tip.style.display = 'none'));
      const label = document.createElement('div');
      label.textContent = ult ? `${spell.name} · ULT` : spell.name;
      label.style.cssText = `font:600 10px ui-sans-serif,system-ui;color:${ult ? '#e8c66a' : hudInk(kit)};opacity:0.85;white-space:nowrap;`;
      col.append(box, label);
      root.appendChild(col);
      this.slotEls.push({ box, shade, secs });
    });
    document.body.appendChild(root);
    return root;
  }

  /**
   * The phone layout: the portrait and passive small in the top-left corner, under the duel bar; the slots in an arc
   * around a round attack button in the bottom-right (thumb reach); the joystick on the left (src/touch.ts).
   */
  private buildTouchHud() {
    const kit = this.kit;
    const tint = (pct: number, base = '#060608') => `color-mix(in srgb, ${kit.accent} ${pct}%, ${base})`;
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;inset:0;z-index:6;display:none;pointer-events:none;user-select:none;-webkit-user-select:none;' +
      `-webkit-touch-callout:none;font:600 12px ui-sans-serif,system-ui;color:${hudInk(kit)};`;

    const plate = document.createElement('div');
    plate.style.cssText =
      'position:absolute;left:calc(8px + env(safe-area-inset-left, 0px));top:calc(78px + env(safe-area-inset-top, 0px));' +
      `display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:12px;pointer-events:auto;` +
      `background:linear-gradient(180deg,${tint(14)}cc,${tint(5)}cc);border:1px solid ${tint(32)};`;
    const portrait = canvasIcon(64, kit.portrait);
    portrait.style.cssText = `width:40px;height:40px;border-radius:50%;border:2px solid ${hudInk(kit)};`;
    if (this.host.nextKit) portrait.addEventListener('click', () => this.host.nextKit?.());
    plate.appendChild(portrait);
    this.passiveEls = this.buildPassive(plate, tint);
    root.appendChild(plate);

    // The cluster's anchor is the attack button's centre.
    const cluster = document.createElement('div');
    cluster.style.cssText =
      'position:absolute;width:0;height:0;right:calc(56px + env(safe-area-inset-right, 0px));' +
      'bottom:calc(56px + env(safe-area-inset-bottom, 0px));';
    const at = (el: HTMLElement, dx: number, dy: number, size: number) => {
      el.style.position = 'absolute';
      el.style.left = `${dx - size / 2}px`;
      el.style.top = `${-dy - size / 2}px`;
    };
    const attack = document.createElement('div');
    attack.style.cssText =
      `width:80px;height:80px;border-radius:50%;pointer-events:auto;touch-action:none;display:flex;align-items:center;` +
      `justify-content:center;font:700 34px ui-serif,Georgia,serif;color:${hudInk(kit)};` +
      `background:radial-gradient(circle at 50% 38%, ${tint(55)}, ${tint(18)});border:2px solid ${hudInk(kit)};` +
      'box-shadow:0 4px 16px rgba(0,0,0,0.6);';
    attack.textContent = '⚔';
    at(attack, 0, 0, 80);
    attack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.attackNearest();
      attack.animate([{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 160 });
    });
    cluster.appendChild(attack);
    this.attackBtn = attack;

    // Q, W, E on an arc around the attack button, R further out (dx right, dy up from the anchor).
    const spots = [[-104, -16], [-86, 62], [-18, 104], [-162, 76]];
    kit.spells.forEach((spell, i) => {
      const ult = spell.key === 'R';
      const size = ult ? 64 : 56;
      const box = document.createElement('div');
      box.style.cssText =
        `width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;pointer-events:auto;` +
        `border:2px solid ${ult ? '#c9a24a' : tint(55)};box-shadow:0 3px 12px rgba(0,0,0,0.55)` +
        (ult ? ',0 0 14px rgba(201,162,74,0.35);' : ';');
      at(box, spots[i][0], spots[i][1], size);
      const icon = canvasIcon(128, spell.icon);
      icon.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
      const shade = document.createElement('div');
      shade.style.cssText = 'position:absolute;inset:0;';
      const secs = document.createElement('div');
      secs.style.cssText =
        `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 ${ult ? 20 : 17}px ` +
        'ui-sans-serif,system-ui;color:#fff1e6;text-shadow:0 1px 4px #000;';
      box.append(icon, shade, secs);
      aimButton(box, i, this);
      cluster.appendChild(box);
      this.slotEls.push({ box, shade, secs });
    });
    root.appendChild(cluster);
    document.body.appendChild(root);

    this.joystick = new Joystick(this, kit.accent);
    this.joystick.el.style.display = this.enabled ? '' : 'none';
    document.body.appendChild(this.joystick.el);
    return root;
  }

  /** The passive slot (its name and badge, the twist in the tooltip), the resource bar and the buff row. */
  private buildPassive(root: HTMLDivElement, tint: (pct: number, base?: string) => string) {
    const trait = traitFor(this.kit.name);
    if (!trait) return null;
    const kit = this.kit;
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
    const box = document.createElement('div');
    box.style.cssText =
      `position:relative;width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid ${tint(55)};` +
      `background:radial-gradient(circle at 50% 40%, ${tint(45)}, ${tint(10)});display:flex;align-items:center;justify-content:center;`;
    const glyph = document.createElement('div');
    glyph.textContent = trait.passive.name.slice(0, 1);
    glyph.style.cssText = `font:700 20px ui-serif,Georgia,serif;color:${hudInk(kit)};opacity:0.9;`;
    const badge = document.createElement('div');
    badge.style.cssText =
      'position:absolute;right:1px;bottom:1px;min-width:14px;padding:0 3px;border-radius:7px;background:#000a;' +
      `color:#fff1e6;font:800 10px ui-sans-serif,system-ui;text-align:center;`;
    box.append(glyph, badge);
    // Touch: a tap shows the tooltip under the badge (the phone plate is at the top) for a few seconds.
    box.addEventListener(TOUCH ? 'click' : 'mouseenter', () => {
      const r = box.getBoundingClientRect();
      this.tip.innerHTML = `<div style="font:700 13px ui-sans-serif,system-ui;margin-bottom:3px">${trait.passive.name} ` +
        `<span style="opacity:0.6;font-weight:600">[passive]</span></div>${trait.passive.blurb}` +
        (trait.twist ? `<div style="margin-top:6px;font-weight:700">${trait.twist.name}</div>${trait.twist.blurb}` : '');
      this.tip.style.display = 'block';
      this.tip.style.left = `${Math.max(8, r.left + r.width / 2 - 130)}px`;
      this.tip.style.top = TOUCH ? `${r.bottom + 10}px` : `${r.top - this.tip.offsetHeight - 10}px`;
      if (TOUCH) { clearTimeout(this.tipTimer); this.tipTimer = window.setTimeout(() => (this.tip.style.display = 'none'), 4000); }
    });
    if (!TOUCH) box.addEventListener('mouseleave', () => (this.tip.style.display = 'none'));
    const label = document.createElement('div');
    label.textContent = trait.passive.name;
    label.style.cssText = `font:600 10px ui-sans-serif,system-ui;color:${hudInk(kit)};opacity:0.85;white-space:nowrap;`;
    // The resource bar and the buff row sit under the passive.
    const resBox = document.createElement('div');
    resBox.style.cssText = `position:relative;width:64px;height:8px;border-radius:4px;background:#0008;overflow:hidden;display:${trait.resource ? '' : 'none'};`;
    const resFill = document.createElement('div');
    resFill.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:0;background:${trait.resource?.color ?? kit.accent};`;
    const resText = document.createElement('div');
    resText.style.cssText = 'font:600 9px ui-sans-serif,system-ui;opacity:0.75;white-space:nowrap;';
    resText.style.display = trait.resource ? '' : 'none';
    resBox.appendChild(resFill);
    const buffs = document.createElement('div');
    buffs.style.cssText = 'display:flex;gap:3px;min-height:14px;';
    col.append(box, label, resBox, resText, buffs);
    root.appendChild(col);
    return { badge, resFill, resText, resBox, buffs };
  }

  private showTip(box: HTMLDivElement, spell: HeroSpell) {
    const r = box.getBoundingClientRect();
    const range = spell.range > 0 ? `range ${spell.range}` : 'self';
    this.tip.innerHTML = `<div style="font:700 13px ui-sans-serif,system-ui;margin-bottom:3px">${spell.name} ` +
      `<span style="opacity:0.6;font-weight:600">[${spell.key}]</span></div>${spell.blurb}` +
      `<div style="margin-top:5px;opacity:0.6">${range} · cooldown ${spell.cooldown} s</div>`;
    this.tip.style.display = 'block';
    this.tip.style.left = `${Math.max(8, r.left + r.width / 2 - 130)}px`;
    this.tip.style.top = `${r.top - this.tip.offsetHeight - 10}px`;
  }

  private flashSlot(i: number) {
    const box = this.slotEls[i].box;
    box.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 260 });
  }

  private updateHud(dt: number) {
    this.kit.spells.forEach((spell, i) => {
      const { box, shade, secs } = this.slotEls[i];
      const cd = this.cooldowns[i];
      const f = cd / spell.cooldown;
      shade.style.background = cd > 0
        ? `conic-gradient(rgba(6,2,3,0.78) ${f * 360}deg, rgba(6,2,3,0.25) 0deg)`
        : '';
      secs.textContent = cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      const t = this.traits;
      if (t?.trait?.charges?.slot === i) secs.textContent = `${t.ammo}` + (t.ammo < t.trait.charges.count ? ` · ${Math.ceil(t.ammoWait)}` : '');
      if (t?.canRecast(i)) { secs.textContent = 'RE'; shade.style.background = 'rgba(255,230,160,0.25)'; }
      // A hold slot being aimed shows its charge: a gold wedge and the percentage.
      else if (t?.holdOf(i) && this.aiming === i) {
        const c = t.charge(i, (performance.now() - this.aimStart) / 1000);
        secs.textContent = `${Math.round(c * 100)}%`;
        shade.style.background = `conic-gradient(rgba(255,226,140,0.5) ${c * 360}deg, rgba(6,2,3,0.15) 0deg)`;
      }
      box.style.outline = this.aiming === i ? `2px solid ${hudInk(this.kit)}` : '';
      box.style.outlineOffset = '2px';
    });
    const pe = this.passiveEls, t = this.traits;
    if (pe) {
      pe.badge.textContent = t?.badge() ?? '';
      pe.badge.style.display = pe.badge.textContent ? '' : 'none';
      const r = t?.trait?.resource;
      if (r && t) {
        pe.resFill.style.width = `${(100 * t.res) / r.max}%`;
        pe.resText.textContent = `${r.name} ${Math.round(t.res)}/${r.max}`;
      }
      const list = this.status.activeBuffs();
      const key = list.map((b) => b.kind + Math.ceil(b.left)).join();
      if (pe.buffs.dataset.key !== key) {
        pe.buffs.dataset.key = key;
        pe.buffs.innerHTML = list.map((b) =>
          `<div title="${b.kind} ${Math.round(b.amount * 100)}%" style="width:14px;height:14px;border-radius:3px;font:700 10px/14px ui-sans-serif;text-align:center;` +
          `background:${DEBUFFS.includes(b.kind) ? '#3a0a14' : '#0a2a1e'};color:${BUFF_COLOR[b.kind]};border:1px solid ${BUFF_COLOR[b.kind]}">${BUFF_GLYPH[b.kind]}</div>`).join('');
      }
    }
    this.toastT = Math.max(0, this.toastT - dt);
    this.toast.style.opacity = String(Math.min(1, this.toastT * 3));
    // Silence and stun grey out the QWER bar; blind darkens the screen edges.
    if (this.attackBtn) this.attackBtn.style.display = this.attacksEnabled ? 'flex' : 'none';
    const grey = this.status.cannotCast;
    for (const { box } of this.slotEls) box.style.filter = grey ? GREY_SLOT : '';
    this.vignetteA += ((this.status.blind ? 1 : 0) - this.vignetteA) * (1 - Math.exp(-dt * 8));
    this.vignette.style.display = this.vignetteA > 0.01 ? '' : 'none';
    this.vignette.style.opacity = this.vignetteA.toFixed(3);
  }

  private say(text: string) {
    this.toast.textContent = text;
    this.toastT = 1.2;
  }
}

function flatDist(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** `to` moved toward `from` so it is at most `range` away on the ground plane (y = 0). */
function clampToRange(from: THREE.Vector3, to: THREE.Vector3, range: number) {
  const d = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  if (d.length() > range) d.setLength(range);
  return new THREE.Vector3(from.x + d.x, 0, from.z + d.z);
}

function canvasIcon(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}
