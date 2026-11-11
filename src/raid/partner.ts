import * as THREE from 'three';
import type { Arena } from '../arena';
import { AttackFx, Attacker, attackFor, type AttackSpec } from '../attacks';
import { Enemy } from '../effects/common';
import type { HeroKit } from '../heroes';
import { HeroFigure } from '../heroFigure';
import { LightPillar } from './fx';
import { STAND_COLOR } from './script';

/** Someone reported this way is drawn this far in the past (ms, two send intervals at 20 Hz), so there is always a next report to move toward. */
const DELAY = 100;
const STEP = 50;
/** A gap longer than this means it stood still. */
const GAP = 120;
/** A jump of more than this in one report is not a walk: it snaps. */
const JUMP = 4;

/**
 * A far partner in a big party (pipeline/designs/raid-party.md): only the nearest are drawn in full, the rest as this light stand-in, a
 * slim figure of the hero's colour, because drawing 39 heroes in full costs a phone most of its frame.
 */
const LITE_BODY = new THREE.CylinderGeometry(0.16, 0.3, 1.2, 7).translate(0, 0.6, 0);
const LITE_HEAD = new THREE.IcosahedronGeometry(0.2, 0).translate(0, 1.42, 0);
const LITE_RING = new THREE.RingGeometry(0.45, 0.55, 24).rotateX(-Math.PI / 2).translate(0, 0.04, 0);

/** How close (m) and how long (s) a hero stands by a fallen partner to get them up. */
export const REVIVE_REACH = 2.5;
export const REVIVE_TIME = 3;

/**
 * A figure's reported positions on this screen's clock, played back a little late, so it moves smoothly at an even speed;
 * past the newest report it holds still instead of guessing. The same rules a duel uses for the other player's hero, for
 * anything that is walked from reports: the partner, and the boss on the screen that doesn't run its brain.
 */
export class Track {
  private list: { at: number; x: number; z: number; yaw: number }[] = [];
  private clock: number | null = null;

  push(x: number, z: number, yaw: number, ts?: number) {
    const now = performance.now();
    let at = now;
    if (ts !== undefined) {
      this.clock = this.clock === null ? now - ts : Math.min(this.clock, now - ts);
      at = ts + this.clock;
    }
    const list = this.list, last = list[list.length - 1];
    if (last && Math.hypot(x - last.x, z - last.z) > JUMP) list.length = 0;
    else if (last) {
      at = Math.max(at, last.at + 1);
      if (at - last.at > GAP) list.push({ ...last, at: at - STEP });
    }
    list.push({ at, x, z, yaw });
    while (list.length > 2 && list[1].at < now - 1000) list.shift();
  }

  /** Where it is drawn now, or null before the first report. */
  sample() {
    const list = this.list;
    if (!list.length) return null;
    const t = performance.now() - DELAY;
    let i = 0;
    while (i < list.length - 1 && list[i + 1].at <= t) i++;
    const a = list[i], b = list[Math.min(i + 1, list.length - 1)];
    const k = b.at > a.at ? THREE.MathUtils.clamp((t - a.at) / (b.at - a.at), 0, 1) : 1;
    const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + turn * k };
  }
}

/**
 * The other player's hero on this screen: a third body the duel only draws. It is never in `liveFoes`, so nothing of this
 * hero's can target or hit it, and nothing it does here counts: its own screen decides its hits, its HP and its marks.
 */
export class Partner {
  readonly group = new THREE.Group();
  /** A figure with no meshes: effects read where it stands, and the model is `figure`. */
  readonly enemy = new Enemy({ bare: true });
  readonly figure = new HeroFigure();
  readonly track = new Track();
  readonly attacker: Attacker;
  private attackFx = new AttackFx();
  private spec: AttackSpec;
  hp: number;
  max: number;
  down = false;
  left = false;
  /** How long this hero has stood by it, fallen, and how many times it can still get up. */
  revive = 0;
  revivesLeft = 2;
  private downT = 0;
  private light: LightPillar;
  private ring: THREE.Mesh;
  /** Drawn as the light stand-in (far away in a big party). */
  lite = false;
  private liteGroup = new THREE.Group();
  private liteMat: THREE.MeshStandardMaterial;
  private liteRingMat: THREE.MeshBasicMaterial;

  constructor(public kit: HeroKit, readonly name: string, at: THREE.Vector3, arena: Arena, foe: () => Enemy | null) {
    this.max = this.hp = kit.maxHp ?? 600;
    this.spec = attackFor(kit);
    this.enemy.body = null;
    this.enemy.group.position.copy(at);
    this.figure.setModel(kit.model, at, kit);
    this.figure.stand();
    this.attacker = new Attacker({
      arena,
      fx: this.attackFx,
      self: () => this.enemy,
      spec: () => this.spec,
      // Its own screen counts the hit.
      land: () => {},
      posOf: (t) => (t === foe() ? t.group.position : null),
    });
    this.light = new LightPillar(0, 0, REVIVE_REACH, 6, STAND_COLOR);
    this.light.opacity = 0;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(REVIVE_REACH - 0.08, REVIVE_REACH, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: STAND_COLOR, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.liteMat = new THREE.MeshStandardMaterial({ color: kit.accent, roughness: 0.55, metalness: 0.2, emissive: kit.accent, emissiveIntensity: 0.25, flatShading: true });
    this.liteRingMat = new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: 0.6, depthWrite: false });
    this.liteGroup.add(new THREE.Mesh(LITE_BODY, this.liteMat), new THREE.Mesh(LITE_HEAD, this.liteMat), new THREE.Mesh(LITE_RING, this.liteRingMat));
    this.liteGroup.visible = false;
    this.group.add(this.figure.group, this.attackFx.group, this.light.mesh, this.ring, this.liteGroup);
  }

  /** Full figure or light stand-in. */
  setLite(on: boolean) {
    this.lite = on;
  }

  get pos() {
    return this.enemy.group.position;
  }

  /** A two-kit hero: its other half came in, with its own model, spells and attack. */
  useForm(alt: boolean) {
    const base = this.kit.base ?? this.kit, kit = alt ? base.alt ?? base : base;
    if (kit === this.kit) return;
    this.kit = kit;
    this.spec = attackFor(kit);
    this.figure.setModel(kit.model, this.pos, kit);
    if (!this.down) this.figure.stand();
  }

  /** It fell: it lies where it fell, with a gold ring to come and stand in. */
  fall() {
    this.down = true;
    this.hp = 0;
    this.downT = 0;
    this.revive = 0;
  }

  /** It got up. */
  rise(hp: number, left: number) {
    this.down = false;
    this.hp = hp;
    this.revive = 0;
    this.revivesLeft = left;
    this.figure.stand();
  }

  update(dt: number) {
    const s = this.left ? null : this.track.sample();
    // A fallen hero stays put: its screen sends nothing new, and a late report must not slide it.
    if (s && !this.down) {
      this.enemy.group.position.set(s.x, 0, s.z);
      this.enemy.group.rotation.y = s.yaw;
    }
    this.attacker.update(dt);
    this.attackFx.update(dt);
    this.figure.group.visible = !this.left && !this.lite;
    this.liteGroup.visible = !this.left && this.lite;
    if (this.lite) {
      // The stand-in: where it is, lying down when fallen; no animation to play.
      this.liteGroup.position.copy(this.pos);
      this.liteGroup.rotation.set(this.down ? Math.PI / 2 : 0, this.enemy.group.rotation.y, 0);
    } else this.figure.follow(dt, this.pos, this.enemy.group.rotation.y, { attack: this.attacker.motion });
    const can = this.down && !this.left && this.revivesLeft > 0;
    if (this.down) {
      this.downT += dt;
      if (!this.lite) this.figure.fall(Math.min(1, this.downT / 0.6));
    }
    this.ring.visible = can;
    this.light.opacity = can ? 0.25 + 0.5 * (this.revive / REVIVE_TIME) : 0;
    if (can) {
      this.ring.position.set(this.pos.x, 0.05, this.pos.z);
      this.light.mesh.position.set(this.pos.x, 0.04, this.pos.z);
    }
  }

  dispose() {
    this.figure.setModel(undefined);
    this.attacker.reset();
    this.attackFx.clear();
    this.light.dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.liteMat.dispose();
    this.liteRingMat.dispose();
    this.group.removeFromParent();
  }
}
