import * as THREE from 'three';
import { CASTER_POS, Enemy, createCaster, createGround } from './effects/common';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import { yawTo } from './effects/targeting';
import { blocksSight, pushOut, steer, type Obstacle } from './obstacles';

/** Default enemy spots: a loose pack on the -Z side of the caster. */
const LAYOUT: [number, number][] = [
  [0, 0], [-5, -3], [5, -2], [-2.5, -8], [3.5, -9], [-7.5, 2.5], [7.5, 3], [0, -14], [-6, -12], [6.5, -13],
];
const MAX_HP = 100;

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
  hitFilter: ((target: Enemy, opts: HitOptions) => boolean) | null = null;
  /** A round play area (a duel ring): the caster and the enemies are kept inside it. Null = the open floor. */
  bounds: { x: number; z: number; r: number } | null = null;
  /** Solid pillars and walls (the duel ring): nobody walks through them, and they block line of sight. */
  obstacles: Obstacle[] | null = null;

  private foes: Foe[] = [];
  private selected: Foe[] = [];
  private groundPoint?: THREE.Vector3;
  private groundMarker: THREE.Mesh;
  private ground = createGround();
  private raycaster = new THREE.Raycaster();
  private v = new THREE.Vector3();
  private overlay: HTMLDivElement;
  private labels: { el: HTMLDivElement; t: number; pos: THREE.Vector3 }[] = [];

  constructor(private camera: THREE.Camera, private dom: HTMLElement, count = 6) {
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
    for (const f of this.foes) this.group.remove(f.figure.group, f.ring, f.bar);
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
    const f = target ? this.foes.find((x) => x.figure === target) : undefined;
    this.selected = f ? [f] : [];
    if (f) this.groundPoint = undefined;
  }

  /** Aims at a ground spot (null clears it). Clears the enemy selection. */
  setGroundPoint(p: THREE.Vector3 | null) {
    this.groundPoint = p ? p.clone().setY(0) : undefined;
    if (p) this.selected = [];
  }

  /** The enemies that are alive, with where they stand right now. */
  liveFoes(): { figure: Enemy; pos: THREE.Vector3 }[] {
    return this.foes.filter((f) => f.dead < 0).map((f) => ({ figure: f.figure, pos: f.figure.group.position }));
  }

  /** Everyone back to full HP, standing at home, no knockback or displacement. Selection stays. */
  reset() {
    this.caster.reset();
    for (const f of this.foes) {
      f.figure.reset();
      f.hp = this.maxHp;
      f.flash = 0;
      f.dead = -1;
      f.knock.set(0, 0, 0);
      f.offset.set(0, 0, 0);
      f.displaced.set(0, 0, 0);
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
    const pool = this.persist ? this.foes.filter((f) => f.dead < 0) : this.foes;
    const byDist = (p: THREE.Vector3) => [...pool].sort((a, b) => a.home.distanceTo(p) - b.home.distanceTo(p));
    // No enemy clicked: the one nearest the clicked ground spot, else the one nearest the caster.
    const primary = this.selected.find((f) => pool.includes(f)) ?? byDist(this.groundPoint ?? from)[0];
    let targets: Foe[] = [];
    let point: THREE.Vector3;

    switch (spec.mode) {
      case 'enemy':
        targets = primary ? [primary] : [];
        point = primary ? primary.home.clone() : from.clone().add(new THREE.Vector3(0, 0, -6));
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
        break;
      }
      case 'ground': {
        point = (this.groundPoint ?? primary?.home ?? from.clone().add(new THREE.Vector3(0, 0, -6))).clone();
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

    return {
      caster: this.caster,
      from,
      aim: yawTo(from, aimAt),
      targets: targets.map((f) => f.figure),
      targetPos: targets.map((f) => f.home.clone()),
      point,
      hit: (target, opts) => this.hit(target, opts),
      displace: (target, offset) => {
        const f = this.foes.find((x) => x.figure === target);
        if (f) f.displaced.copy(offset);
      },
    };
  }

  /** Hit reaction: flash, knockback, damage number, HP; dies at 0 HP. */
  hit(target: Enemy, opts: HitOptions = {}) {
    const f = this.foes.find((x) => x.figure === target);
    if (!f || f.dead >= 0) return;
    if (this.hitFilter && !this.hitFilter(target, opts)) return;
    const dmg = Math.round(opts.damage ?? THREE.MathUtils.randFloat(10, 20));
    f.hp = Math.max(0, f.hp - dmg);
    f.flash = 1;
    const big = dmg >= 40;
    // A tinted flash (the hit's colour, else warm orange), not white: white bloomed figures swallowed the hit VFX.
    f.flashTint.set(opts.color ?? (big ? '#ffb347' : '#ff8a4a'));
    this.hits++;
    const knock = opts.knock ?? 4;
    if (knock > 0) {
      const away = target.group.position.clone().sub(opts.from ?? this.caster.group.position).setY(0);
      if (away.lengthSq() < 1e-4) away.set(0, 0, -1);
      f.knock.add(away.normalize().multiplyScalar(knock));
    }
    this.say(String(dmg), opts.color ?? (big ? '#ffd24a' : '#fff1dc'), target.group.position, big ? 1.5 : 1);
    if (f.hp <= 0) {
      f.dead = 0;
      this.kills++;
    }
  }

  update(dt: number) {
    for (const f of this.foes) {
      f.offset.addScaledVector(f.knock, dt);
      f.knock.multiplyScalar(Math.exp(-dt * 7));
      if (this.bounds) {
        // Knockback can't push an enemy out of the ring: fold the overshoot back into the offset.
        const p = this.v.copy(f.home).add(f.offset);
        this.keepInside(p, 0.6);
        f.offset.copy(p).sub(f.home);
      }
      f.figure.group.position.copy(f.home).add(f.offset).add(f.displaced);
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
    if (move.lengthSq() < 1e-8) return;
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
    hit: (target: Enemy, opts?: HitOptions) => void;
    displace?: (target: Enemy, offset: THREE.Vector3) => void;
  }): CastContext {
    const from = o.from.clone().setY(0), point = o.point.clone().setY(0);
    return {
      caster: o.caster,
      from,
      aim: yawTo(from, point),
      targets: o.targets,
      targetPos: o.targetPos.map((p) => p.clone().setY(0)),
      point,
      hit: o.hit,
      displace: o.displace ?? (() => {}),
    };
  }

  private respawn(f: Foe) {
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
      displaced: new THREE.Vector3(), dead: -1, spawn: home.clone(), ring, bar, barFill,
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
