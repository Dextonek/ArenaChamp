import * as THREE from 'three';
import { CASTER_POS, Enemy, createCaster, createGround } from './effects/common';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import { yawTo } from './effects/targeting';

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
  knock: THREE.Vector3;
  offset: THREE.Vector3;
  displaced: THREE.Vector3;
  dead: number; // seconds since death, -1 = alive
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

  private foes: Foe[] = [];
  private selected: Foe[] = [];
  private groundPoint?: THREE.Vector3;
  private groundMarker: THREE.Mesh;
  private ground = createGround();
  private raycaster = new THREE.Raycaster();
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
      if (!down || !this.group.visible) return;
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
      f.figure.setHome(p);
    }
    this.reset();
  }

  clearSelection() {
    this.selected = [];
    this.groundPoint = undefined;
  }

  /** Everyone back to full HP, standing at home, no knockback or displacement. Selection stays. */
  reset() {
    this.caster.reset();
    for (const f of this.foes) {
      f.figure.reset();
      f.hp = MAX_HP;
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
    this.reset();
    const byDist = (p: THREE.Vector3) => [...this.foes].sort((a, b) => a.home.distanceTo(p) - b.home.distanceTo(p));
    // No enemy clicked: the one nearest the clicked ground spot, else the one nearest the caster.
    const primary = this.selected[0] ?? byDist(this.groundPoint ?? from)[0];
    let targets: Foe[] = [];
    let point: THREE.Vector3;

    switch (spec.mode) {
      case 'enemy':
        targets = [primary];
        point = primary.home.clone();
        break;
      case 'enemies': {
        const max = spec.maxTargets ?? 5;
        if (this.selected.length > 1) targets = this.selected.slice(0, max);
        else {
          // Nearest-neighbour chain from the primary target.
          targets = [primary];
          const rest = this.foes.filter((f) => f !== primary);
          while (targets.length < max && rest.length) {
            const last = targets[targets.length - 1].home;
            rest.sort((a, b) => a.home.distanceTo(last) - b.home.distanceTo(last));
            targets.push(rest.shift()!);
          }
        }
        point = targets[0].home.clone();
        break;
      }
      case 'ground': {
        point = (this.groundPoint ?? primary.home).clone();
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
    const aimAt = spec.mode === 'self' ? primary.home : point;
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
    const dmg = Math.round(opts.damage ?? THREE.MathUtils.randFloat(10, 20));
    f.hp = Math.max(0, f.hp - dmg);
    f.flash = 1;
    this.hits++;
    const knock = opts.knock ?? 4;
    if (knock > 0) {
      const away = target.group.position.clone().sub(opts.from ?? this.caster.group.position).setY(0);
      if (away.lengthSq() < 1e-4) away.set(0, 0, -1);
      f.knock.add(away.normalize().multiplyScalar(knock));
    }
    const big = dmg >= 40;
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
      f.figure.group.position.copy(f.home).add(f.offset).add(f.displaced);
      f.flash *= Math.exp(-dt * 7);
      if (f.flash > 0.002) f.figure.setFlash(f.flash);
      else if (f.flash > 0) { f.flash = 0; f.figure.setFlash(0); }
      // Death: topple back and sink into the ground.
      if (f.dead >= 0) {
        f.dead += dt;
        const k = Math.min(1, f.dead / 0.6);
        f.figure.group.rotation.x = -k * 1.4;
        f.figure.group.position.y -= Math.max(0, f.dead - 0.5) * 1.5;
        f.figure.group.visible = f.dead < 1.8;
      }
      f.ring.position.set(f.figure.group.position.x, 0.05, f.figure.group.position.z);
      f.ring.visible = this.selected.includes(f) && f.figure.group.visible;
      (f.ring.material as THREE.MeshBasicMaterial).opacity = this.selected[0] === f ? 0.9 : 0.55;
      f.bar.position.copy(f.figure.group.position).add(new THREE.Vector3(0, 2.75, 0));
      f.bar.quaternion.copy(this.camera.quaternion);
      f.bar.visible = f.figure.group.visible && f.hp < MAX_HP;
      f.barFill.scale.x = Math.max(0.001, f.hp / MAX_HP);
      f.barFill.position.x = -0.6 * (1 - f.hp / MAX_HP);
    }
    if (this.groundPoint) {
      this.groundMarker.position.set(this.groundPoint.x, 0.05, this.groundPoint.z);
      this.groundMarker.rotation.z += dt;
    }
    this.groundMarker.visible = !!this.groundPoint;
    this.updateLabels(dt);
  }

  /** Play mode: walks the caster by `move` (world units, ground plane) and turns it to face the way it goes. */
  walk(move: THREE.Vector3) {
    if (move.lengthSq() < 1e-8) return;
    const p = this.caster.group.position.add(move);
    p.x = THREE.MathUtils.clamp(p.x, -55, 55);
    p.z = THREE.MathUtils.clamp(p.z, -55, 55);
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
      figure, home: home.clone(), hp: MAX_HP, flash: 0, knock: new THREE.Vector3(), offset: new THREE.Vector3(),
      displaced: new THREE.Vector3(), dead: -1, ring, bar, barFill,
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

  private say(text: string, color: string, at: THREE.Vector3, scale: number) {
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
