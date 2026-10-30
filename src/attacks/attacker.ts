import * as THREE from 'three';
import type { Arena } from '../arena';
import type { Enemy } from '../effects/common';
import type { HitOptions } from '../effects/targeting';
import type { AttackSpec } from './index';
import type { AttackFx } from './fx';

/** What an `Attacker` needs from whoever drives it (hero mode for the player, the duel for the AI opponent). */
export interface AttackOwner {
  arena: Arena;
  fx: AttackFx;
  /** The attacking figure. */
  self(): Enemy;
  spec(): AttackSpec;
  /** Delivers a hit (hero mode: `arena.hit`; the duel: the player's HP for the opponent's attacks). */
  land(target: Enemy, opts: HitOptions): void;
  /** Where `target` stands now, or null when it is gone (dead, despawned). */
  posOf(target: Enemy): THREE.Vector3 | null;
  /** The attack on `target` was just released (a network duel tells the other side). */
  released?(target: Enemy): void;
}

/** How far past its range a wind-up survives the target walking away (m). */
const LEASH = 0.8;

/**
 * One figure's basic attack: the cooldown, the wind-up of the current attack, and its release (a melee hit or a
 * homing bolt). The owner decides when to attack (`inRange`, `start`) and moves the figure itself; `cancel` drops a
 * wind-up (the figure moved or cast) and keeps the cooldown.
 */
export class Attacker {
  private cd = 0;
  private wind = -1;
  private target: Enemy | null = null;
  /** A short pose pulse after a release, for the figure's attack arm. */
  private pose = 0;

  constructor(private owner: AttackOwner) {}

  /** In the middle of a wind-up (the figure should stand and face the target). */
  get winding() {
    return this.wind >= 0;
  }

  /** Raise the attack arm (wind-up or just released). */
  get posing() {
    return this.wind >= 0 || this.pose > 0;
  }

  /** The target of the wind-up, if any. */
  get aiming() {
    return this.wind >= 0 ? this.target : null;
  }

  /** Close enough to attack `to` from `from` (ranged also needs line of sight). */
  inRange(from: THREE.Vector3, to: THREE.Vector3) {
    const s = this.owner.spec();
    if (Math.hypot(to.x - from.x, to.z - from.z) > s.range) return false;
    return s.kind === 'melee' || this.owner.arena.lineOfSight(from, to);
  }

  /** Starts an attack on `target` if the last one has recovered. Returns true when a wind-up began. */
  start(target: Enemy) {
    if (this.wind >= 0 || this.cd > 0) return false;
    if (this.owner.arena.statusOf(this.owner.self())?.stunned) return false;
    this.target = target;
    this.wind = this.owner.spec().windup;
    return true;
  }

  /**
   * Releases an attack on `target` now, without a wind-up or a cooldown check: the other player's attack in a network
   * duel (its own client already wound it up). Blind comes from the attacker's status here.
   */
  releaseNow(target: Enemy) {
    const st = this.owner.arena.statusOf(this.owner.self());
    const me = this.owner.self().group.position, at = this.owner.posOf(target);
    if (at) this.owner.self().group.rotation.y = Math.atan2(at.x - me.x, at.z - me.z);
    this.pose = 0.18;
    this.release(target, this.owner.spec(), !!st?.blind);
  }

  /** Drops the current wind-up (no hit); the cooldown stays as it was. */
  cancel() {
    this.wind = -1;
  }

  /** Forgets everything (a new round). */
  reset() {
    this.wind = -1;
    this.cd = 0;
    this.pose = 0;
    this.target = null;
  }

  update(dt: number) {
    this.cd = Math.max(0, this.cd - dt);
    this.pose = Math.max(0, this.pose - dt);
    if (this.wind < 0 || !this.target) return;
    const me = this.owner.self();
    const st = this.owner.arena.statusOf(me);
    const at = this.owner.posOf(this.target);
    const s = this.owner.spec();
    if (!at || st?.stunned || Math.hypot(at.x - me.group.position.x, at.z - me.group.position.z) > s.range + LEASH) {
      this.wind = -1;
      return;
    }
    const p = me.group.position;
    me.group.rotation.y = Math.atan2(at.x - p.x, at.z - p.z);
    this.wind -= dt;
    if (this.wind > 0) return;
    this.wind = -1;
    this.cd = Math.max(0, s.interval - s.windup);
    this.pose = 0.18;
    this.owner.released?.(this.target);
    this.release(this.target, s, !!st?.blind);
  }

  private release(target: Enemy, s: AttackSpec, blind: boolean) {
    const me = this.owner.self();
    const color = s.color ?? '#ffffff';
    const opts: HitOptions = { damage: s.damage, knock: s.kind === 'melee' ? 0.8 : 0.3, color, from: me.group.position.clone(), attack: true };
    const miss = () => this.owner.arena.say('MISS', '#cfc6dc', this.owner.posOf(target) ?? me.group.position, 0.9);
    if (s.kind === 'melee') {
      this.owner.fx.slash(me.group.position, me.group.rotation.y, color);
      if (blind) miss();
      else this.owner.land(target, opts);
      return;
    }
    const yaw = me.group.rotation.y;
    const from = me.group.position.clone().add(new THREE.Vector3(Math.sin(yaw) * 0.45, 1.3, Math.cos(yaw) * 0.45));
    this.owner.fx.bolt(from, () => this.owner.posOf(target), s.speed, color, () => {
      if (blind) miss();
      else this.owner.land(target, opts);
    });
  }
}
