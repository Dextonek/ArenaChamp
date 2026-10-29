import * as THREE from 'three';
import { Hero } from './effects/weapons/hero';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/**
 * A hero's rigged figure standing in for a capsule figure (the player's caster in hero mode, the opponent in a
 * duel): `setModel(url)` swaps the model (cached per url), `follow(...)` every frame places it and poses it with a
 * walk cycle while it moves, the casting arm while it is rooted, and a slow breath at rest. Add `group` to the scene.
 */
export class HeroFigure {
  readonly group = new THREE.Group();
  private figures = new Map<string, Hero>();
  private figure: Hero | null = null;
  private walkPhase = 0;
  private walkAmount = 0;
  private castAmount = 0;
  private last = new THREE.Vector3();
  private clock = 0;

  /** True while a model is shown. */
  get active() {
    return !!this.figure;
  }

  /** Shows the model at `url` (undefined hides the figure). Returns whether one is shown. */
  setModel(url: string | undefined, at?: THREE.Vector3) {
    for (const f of this.figures.values()) f.root.visible = false;
    this.figure = null;
    if (url) {
      let f = this.figures.get(url);
      if (!f) {
        f = new Hero({ url, shade: 0.9, maxEmissive: 1, tintSheen: true });
        this.figures.set(url, f);
        this.group.add(f.root);
      }
      f.root.visible = true;
      this.figure = f;
    }
    if (at) this.last.copy(at);
    return !!this.figure;
  }

  /** Places the figure at `pos` facing `yaw`; `casting` raises the casting arm. Speed comes from the position change. */
  follow(dt: number, pos: THREE.Vector3, yaw: number, casting: boolean) {
    const f = this.figure;
    if (!f) return;
    this.clock += dt;
    const speed = Math.hypot(pos.x - this.last.x, pos.z - this.last.z) / Math.max(dt, 1e-4);
    this.last.copy(pos);
    const k = 1 - Math.exp(-dt * 12);
    this.walkAmount += ((speed > 0.5 ? 1 : 0) - this.walkAmount) * k;
    this.castAmount += ((casting ? 1 : 0) - this.castAmount) * (1 - Math.exp(-dt * 16));
    this.walkPhase += dt * 9 * this.walkAmount;
    f.root.position.set(pos.x, pos.y + Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.walkAmount, pos.z);
    f.root.rotation.y = yaw;
    if (!f.loaded) return;
    f.resetPose();
    const X = AXIS_X, w = this.walkAmount, s = Math.sin(this.walkPhase);
    f.rot('thighL', X, -0.55 * s * w);
    f.rot('thighR', X, 0.55 * s * w);
    f.rot('shinL', X, 0.7 * Math.max(0, s) * w);
    f.rot('shinR', X, 0.7 * Math.max(0, -s) * w);
    f.rot('armL', X, 0.35 * s * w);
    f.rot('armR', X, -0.35 * s * w * (1 - this.castAmount));
    f.rot('chest', X, -0.04 * w + 0.015 * Math.sin(this.clock * 1.8));
    // Casting: the right arm thrown forward toward the target, the chest turning into it.
    const c = this.castAmount;
    f.rot('armR', X, -1.35 * c);
    f.rot('foreR', X, -0.25 * c);
    f.rot('chest', AXIS_Y, -0.25 * c);
  }

  /** Falls over (a defeated hero): tips the figure back over `t` 0..1. */
  fall(t: number) {
    if (this.figure) this.figure.root.rotation.x = -1.35 * Math.min(1, t);
  }

  /** Stands the figure back up (after `fall`). */
  stand() {
    if (this.figure) this.figure.root.rotation.x = 0;
  }
}
