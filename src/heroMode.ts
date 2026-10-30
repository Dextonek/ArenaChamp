import * as THREE from 'three';
import type { Arena } from './arena';
import type { Enemy } from './effects/common';
import type { TargetingSpec } from './effects/targeting';
import type { StatusKind, StatusSet } from './effects/status';
import type { HeroKit, HeroSpell } from './heroes';
import { HeroFigure } from './heroFigure';
import { AttackFx, Attacker, attackFor, type AttackSpec } from './attacks';

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
const HOVER_PICK = 2.2; // how close to the cursor an enemy counts as hovered

export type Target = { enemy: Enemy } | { point: THREE.Vector3 };

/**
 * A MOBA-style test mode for a hero kit: click the ground to walk there, Q/W/E/R to aim a spell (a range ring at
 * the hero, a line for single-target spells, the area circle for ground spells), click to cast, right-click or Esc
 * to cancel. Self-cast spells go off at once. Out-of-range targets: the hero walks into range, then casts. A fixed
 * top-down camera follows the hero (wheel zooms). Enemies keep their HP between casts and respawn.
 */
export class HeroMode {
  enabled = false;
  readonly group = new THREE.Group();

  private kit: HeroKit;
  private cooldowns = [0, 0, 0, 0];
  private rooted = 0;
  private aiming = -1;
  private moveTo: THREE.Vector3 | null = null;
  private pending: { slot: number; target: Target } | null = null;
  private zoom = 1.25;
  private snapCamera = false;
  private mouse = new THREE.Vector2(2, 2);
  private cursor = new THREE.Vector3();
  private hovered: Enemy | null = null;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Indicators.
  private rangeRing: THREE.Mesh;
  private areaRing: THREE.Mesh;
  private areaFill: THREE.Mesh;
  private aimLine: THREE.Mesh;
  /** The arrow head at the end of a skillshot's aim strip (`HeroSpell.aim: 'line'`). */
  private aimTip: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private moveMarker: THREE.Mesh;
  private moveMarkerT = 1;

  // The hero's figure (stands in for the arena's capsule caster while hero mode is on).
  private figure = new HeroFigure();
  /** Basic attacks (src/attacks): the enemy being attacked, an attack-move point, and whether A armed attack-move. */
  private attacker: Attacker;
  private attackFx = new AttackFx();
  private attackSpec: AttackSpec;
  private attackTarget: Enemy | null = null;
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
  /** A basic attack on `target` was released (a network duel tells the other side). */
  onAttack?: (target: Enemy) => void;
  /**
   * Network duel, the side that starts at the -Z end of the ring: the camera looks from -Z toward +Z, so the
   * opponent is in front of the camera instead of behind it.
   */
  flipCamera = false;

  // HUD.
  private hud: HTMLDivElement;
  private slotEls: { box: HTMLDivElement; shade: HTMLDivElement; secs: HTMLDivElement }[] = [];
  private tip: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastT = 0;
  /** Blind: a dark screen vignette, faded in and out with the status. */
  private vignette: HTMLDivElement;
  private vignetteA = 0;

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
      released: (target) => this.onAttack?.(target),
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
    this.rangeRing = flat(new THREE.RingGeometry(0.985, 1, 96), kit.foil, 0.45);
    this.areaRing = flat(new THREE.RingGeometry(0.95, 1, 72), kit.accent, 0.85);
    this.areaFill = flat(new THREE.CircleGeometry(1, 72), kit.accent, 0.12);
    // Unit-length strip along +Y in the ring plane; after the flat rotation it points along -Z, scaled per frame.
    this.aimLine = flat(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), kit.accent, 0.28);
    // A triangle with its base on the origin and its tip at +Y 1 (same plane trick as the strip).
    this.aimTip = flat(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)])), kit.accent, 0.5);
    this.hoverRing = flat(new THREE.RingGeometry(0.95, 1.2, 48), kit.accent, 0.95);
    this.moveMarker = flat(new THREE.RingGeometry(0.3, 0.42, 32), kit.foil, 0.9);
    this.group.add(this.figure.group);
    this.group.visible = false;

    this.hud = this.buildHud();
    this.tip = document.createElement('div');
    this.tip.style.cssText =
      'position:fixed;z-index:7;max-width:260px;padding:8px 10px;border-radius:6px;display:none;pointer-events:none;' +
      `background:rgba(12,6,8,0.94);border:1px solid #4a1a22;color:#e9dcc6;font:12px/1.35 ui-sans-serif,system-ui;`;
    this.toast = document.createElement('div');
    this.toast.style.cssText =
      'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:7;pointer-events:none;opacity:0;' +
      'font:700 14px ui-sans-serif,system-ui;color:#ffb0b8;text-shadow:0 2px 6px #000;';
    this.vignette = document.createElement('div');
    this.vignette.style.cssText =
      'position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0;display:none;' +
      'background:radial-gradient(ellipse at center,rgba(4,2,8,0) 22%,rgba(4,2,8,0.55) 52%,rgba(4,2,8,0.96) 88%);';
    document.body.append(this.tip, this.toast, this.vignette);

    const dom = host.dom;
    dom.addEventListener('pointermove', (e) => this.setMouse(e));
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      // The click itself says where the cursor is (a click can come without a move before it).
      this.setMouse(e);
      this.updateCursor();
      if (e.button === 0) {
        if (this.aiming >= 0) this.confirm();
        else if (this.attackArmed) this.attackClick();
        else this.order();
      } else if (e.button === 2) {
        if (this.aiming >= 0) this.cancelAim();
        else if (this.attackArmed) this.disarm();
        else {
          // MOBA right-click: on an enemy, attack it; on the ground, walk there.
          const enemy = this.enemyNearCursor();
          if (enemy && this.attacksEnabled) this.attackOrder(enemy);
          else this.order();
        }
      }
    });
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

  /** Clears cooldowns, aim and orders (a new duel round). */
  resetRound() {
    this.cooldowns.fill(0);
    this.rooted = 0;
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

  /** Switches the hero: new bar, indicator colours from the kit, cooldowns and aim cleared. */
  setKit(kit: HeroKit) {
    this.kit = kit;
    this.attackSpec = attackFor(kit);
    this.clearAttack();
    this.attacker.reset();
    const color = (m: THREE.Mesh, c: string) => (m.material as THREE.MeshBasicMaterial).color.set(c);
    color(this.rangeRing, kit.foil);
    color(this.moveMarker, kit.foil);
    for (const m of [this.areaRing, this.areaFill, this.aimLine, this.aimTip, this.hoverRing]) color(m, kit.accent);
    const shown = this.hud.style.display;
    this.hud.remove();
    this.slotEls = [];
    this.hud = this.buildHud();
    this.hud.style.display = shown;
    this.tip.style.display = 'none';
    this.cancelAim();
    this.pending = null;
    this.cooldowns.fill(0);
    this.showFigure();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
    this.hud.style.display = on ? 'flex' : 'none';
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

    this.followCamera(hero, dt);
    this.updateCursor();

    if (this.locked) { this.pending = null; this.moveTo = null; this.clearAttack(); if (this.aiming >= 0) this.cancelAim(); }
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
        this.castNow(p.slot, p.target);
      } else this.moveTo = at.clone();
    }
    const status = this.status;
    if (this.moveTo && this.rooted <= 0 && !this.attacker.winding && !status.cannotMove && !arena.isDashing(arena.caster)) {
      const d = new THREE.Vector3(this.moveTo.x - hero.x, 0, this.moveTo.z - hero.z);
      const len = d.length();
      if (len < 0.05) this.moveTo = null;
      else arena.walk(d.multiplyScalar(Math.min(1, (HERO_SPEED * status.speedMul * dt) / len)));
    }

    this.updateIndicators(dt, hero);
    this.updateHud(dt);
    const caster = arena.caster.group;
    this.figure.follow(dt, hero, caster.rotation.y, this.rooted > 0 || this.attacker.posing);
  }

  // --- figure -------------------------------------------------------------------------------------------

  /** Shows the current kit's figure and hides the capsule caster (or restores the capsule when off). */
  private showFigure() {
    const capsule = this.host.arena.caster.group;
    const shown = this.figure.setModel(this.enabled ? this.kit.model : undefined, capsule.position);
    for (const c of capsule.children) c.visible = !shown;
  }


  private setMouse(e: PointerEvent) {
    const r = this.host.dom.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
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
    this.moveMarker.position.set(this.cursor.x, 0.06, this.cursor.z);
    this.moveMarkerT = 0;
  }

  private beginAim(i: number) {
    if (this.locked || this.spectate) return;
    const spell = this.kit.spells[i];
    if (this.status.cannotCast) { this.say(this.status.stunned ? 'Stunned' : 'Silenced'); return; }
    if (this.cooldowns[i] > 0) { this.say(`${spell.name} is on cooldown`); return; }
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
    this.moveMarker.position.set(this.cursor.x, 0.06, this.cursor.z);
    this.moveMarkerT = 0;
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
      let best: Enemy | null = null, bd = this.attackSpec.range;
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

  /** The hero's basic attack (range, damage, timing). */
  get attack(): AttackSpec {
    return this.attackSpec;
  }

  private cancelAim() {
    this.aiming = -1;
    this.host.dom.style.cursor = '';
  }

  private confirm() {
    const i = this.aiming;
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
    const sees = this.host.arena.lineOfSight(hero, at);
    if (flatDist(hero, at) <= spell.range + 1e-3 && sees) this.castNow(i, target);
    else {
      // Out of range or behind a pillar / wall: walk toward the target and cast once it is in range and in sight.
      if (!sees) this.say('No line of sight');
      this.pending = { slot: i, target };
      this.moveTo = at.clone();
    }
  }

  private castNow(i: number, target: Target) {
    const spell = this.kit.spells[i];
    if (this.cooldowns[i] > 0 || this.status.cannotCast) return;
    const arena = this.host.arena;
    if ('enemy' in target) arena.setTarget(target.enemy);
    else arena.setGroundPoint(target.point);
    this.moveTo = null;
    this.attacker.cancel();
    // Blind: the cast point is rolled now and the effect (its danger zones too) is played at the offset spot.
    arena.aimOffset = this.status.blind ? arena.blindOffset() : null;
    this.rooted = this.host.cast(spell.label);
    arena.aimOffset = null;
    this.cooldowns[i] = spell.cooldown;
    this.onCast?.(spell.label, i, target);
    this.flashSlot(i);
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
    if (this.locked || this.cooldowns[i] > 0 || this.status.cannotCast) return false;
    this.castNow(i, target);
    return this.cooldowns[i] > 0;
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
    const want = hero.clone().setY(0).addScaledVector(offset, this.focus ? this.focusZoom : this.zoom);
    cam.position.lerp(want, this.snapCamera ? 1 : 1 - Math.exp(-12 * dt));
    this.snapCamera = false;
    cam.lookAt(hero.x, 0.5, hero.z - 1.5 * flip);
  }

  private updateIndicators(dt: number, hero: THREE.Vector3) {
    const aiming = this.aiming >= 0;
    const spell = aiming ? this.kit.spells[this.aiming] : null;
    const spec = spell ? this.host.targeting(spell.label) : undefined;
    const single = spec?.mode === 'enemy' || spec?.mode === 'enemies';
    // A skillshot (`aim: 'line'`): a strip and an arrow of the spell's range and width toward the cursor, no ground circle.
    const line = aiming && !single && spell?.aim === 'line';

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
      (this.hoverRing.material as THREE.MeshBasicMaterial).color.set(castable ? this.kit.accent : this.kit.foil);
    }

    // Single target: a strip from the hero to the hovered enemy (else toward the cursor), clamped to range.
    this.aimLine.visible = aiming && (single || line);
    this.aimTip.visible = line;
    if (line && spell) {
      const d = new THREE.Vector3(this.cursor.x - hero.x, 0, this.cursor.z - hero.z);
      if (d.lengthSq() < 1e-4) d.set(Math.sin(this.host.arena.caster.group.rotation.y), 0, Math.cos(this.host.arena.caster.group.rotation.y));
      d.normalize();
      const width = Math.max(0.3, (spec?.radius ?? 0.4) * 2);
      const tip = Math.min(1.4, width * 1.5 + 0.5);
      const turn = Math.atan2(-d.x, -d.z);
      this.aimLine.position.set(hero.x, 0.055, hero.z);
      this.aimLine.rotation.set(-Math.PI / 2, 0, turn);
      this.aimLine.scale.set(width, Math.max(0.01, spell.range - tip), 1);
      this.aimTip.position.set(hero.x + d.x * (spell.range - tip), 0.056, hero.z + d.z * (spell.range - tip));
      this.aimTip.rotation.set(-Math.PI / 2, 0, turn);
      this.aimTip.scale.set(width + 0.7, tip, 1);
    } else if (this.aimLine.visible && spell) {
      const to = this.hovered ? this.hovered.group.position : this.cursor;
      const end = clampToRange(hero, to, spell.range);
      const len = Math.max(0.01, flatDist(hero, end));
      this.aimLine.position.set(hero.x, 0.055, hero.z);
      // Rx(-90°)·Rz(θ) takes local +Y to (-sin θ, 0, -cos θ): solve for the direction to `end`.
      this.aimLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-(end.x - hero.x), -(end.z - hero.z)));
      this.aimLine.scale.set(0.8, len, 1);
    }

    // Ground spell: its area circle at the cursor, clamped to range.
    const area = aiming && !single && !line;
    this.areaRing.visible = this.areaFill.visible = area;
    if (area && spell) {
      const c = clampToRange(hero, this.cursor, spell.range);
      const r = spec?.radius ?? 5;
      // A spot behind a pillar or wall can't be targeted: the area shows in the pale foil colour.
      const seen = this.host.arena.lineOfSight(hero, c);
      for (const m of [this.areaRing, this.areaFill]) (m.material as THREE.MeshBasicMaterial).color.set(seen ? this.kit.accent : this.kit.foil);
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

  // --- HUD ----------------------------------------------------------------------------------------------

  private buildHud() {
    const kit = this.kit;
    // Panel tints come from the kit's accent, so each hero's bar takes its colour.
    const tint = (pct: number, base = '#060608') => `color-mix(in srgb, ${kit.accent} ${pct}%, ${base})`;
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:6;display:none;align-items:flex-end;' +
      'gap:14px;padding:10px 16px 12px;border-radius:14px;user-select:none;' +
      `background:linear-gradient(180deg,${tint(14)},${tint(5)});border:1px solid ${tint(32)};opacity:0.97;` +
      'box-shadow:0 8px 28px rgba(0,0,0,0.6);font:600 12px ui-sans-serif,system-ui;color:' + kit.foil + ';';

    // Portrait and name plate.
    const plate = document.createElement('div');
    plate.style.cssText = 'display:flex;align-items:center;gap:10px;padding-right:6px;';
    const portrait = canvasIcon(64, kit.portrait);
    portrait.style.cssText = `width:64px;height:64px;border-radius:50%;border:2px solid ${kit.foil};box-shadow:0 0 0 2px ${tint(18)};`;
    const names = document.createElement('div');
    names.innerHTML = `<div style="font:700 16px ui-serif,Georgia,serif;letter-spacing:0.5px">${kit.name}</div>` +
      `<div style="font:500 11px ui-sans-serif,system-ui;opacity:0.7">${kit.title}</div>` +
      `<div style="margin-top:6px;font:500 10px ui-sans-serif,system-ui;opacity:0.55;line-height:1.4">click: move · Q W E R: aim<br>click: cast · right-click / Esc: cancel</div>`;
    if (this.host.nextKit) {
      portrait.style.cursor = 'pointer';
      portrait.title = 'next hero';
      portrait.addEventListener('click', () => this.host.nextKit?.());
    }
    plate.append(portrait, names);
    root.appendChild(plate);

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
        `background:${tint(8)};border:1px solid ${ult ? '#c9a24a' : tint(55)};color:${ult ? '#ffd27a' : kit.foil};` +
        'font:800 11px ui-sans-serif,system-ui;display:flex;align-items:center;justify-content:center;';
      box.append(icon, shade, secs, key);
      box.addEventListener('click', () => this.beginAim(i));
      box.addEventListener('mouseenter', () => this.showTip(box, spell));
      box.addEventListener('mouseleave', () => (this.tip.style.display = 'none'));
      const label = document.createElement('div');
      label.textContent = ult ? `${spell.name} · ULT` : spell.name;
      label.style.cssText = `font:600 10px ui-sans-serif,system-ui;color:${ult ? '#e8c66a' : kit.foil};opacity:0.85;white-space:nowrap;`;
      col.append(box, label);
      root.appendChild(col);
      this.slotEls.push({ box, shade, secs });
    });
    document.body.appendChild(root);
    return root;
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
      box.style.outline = this.aiming === i ? `2px solid ${this.kit.foil}` : '';
      box.style.outlineOffset = '2px';
    });
    this.toastT = Math.max(0, this.toastT - dt);
    this.toast.style.opacity = String(Math.min(1, this.toastT * 3));
    // Silence and stun grey out the QWER bar; blind darkens the screen edges.
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
