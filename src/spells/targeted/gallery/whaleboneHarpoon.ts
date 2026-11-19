import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import { ShockRefraction } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { EtchedWaves, Rope, clamp01, easeOut, facetMaterial, harpoonGeometry, smooth } from './g5Parts';

/**
 * Whalebone harpoon (gallery 19, arctic scrimshaw: ivory, black etched lines, sea-grey rope, one teal inlay). An 11 m hook: she
 * draws a carved harpoon back for 0.55 s and throws it at 16 m/s (0.7 s to its reach). The first enemy it touches takes 38 and is
 * dragged 3.5 m toward her (`pull`, no knock; the engine stops it 1 m short of her). Where it stops it stays: in the enemy, which
 * carries it along, or in the ice at a wall or its reach.
 *
 * The look. 0-0.55: the harpoon appears in her hand, tip up, drawn back; it trembles still for the last 0.2 s (the dead beat) and a
 * pale glint runs along it. The throw: it flies level with its tail rope paying out behind, sagging and waving, taut by the end. The
 * bite: ivory chips, ink flecks and a ring of force; the rope snaps taut and ripples back toward her as the enemy is reeled in (the
 * shaft sinks into the body as it comes close); the ink waves are scratched into the ice where it bit (a wavy ring, a ring of
 * scallops, hatching, a dashed ring) by a pen that goes once round in 0.7 s, glowing teal while fresh. Then the harpoon lets go and is
 * hauled back along the rope into her hand (0.28 s) and is gone; the scrimshaw stays, then fades. Clean at 3.2 s.
 * Palette: black ink (dark layer), teal (accent, the inlay and the fresh lines), ivory (foil, beside every black), rope sea-grey.
 */
interface Harpoon { _?: never }

const WIND = 0.55;
const SPEED = 16;
const RANGE = 11;
const PULL = 3.5;
const FLY_Y = 1.1;
const S = 1.6; // the harpoon's scale
const TAIL = 1.55 * S; // from its tip to the eye of the tail
const PULL_T = 0.5; // after the bite: how long it hangs in the enemy while it is dragged
const REEL = 0.28; // then the harpoon is hauled back to her hand
const ICE_PITCH = 0.6; // how steeply it stands in the ice when it hit nothing

class HarpoonLook implements Look<Harpoon> {
  private mat = facetMaterial(false);
  private harpoon: THREE.Mesh;
  private rope = new Rope(36, 6, 0.09);
  private etch = new EtchedWaves(2.5);
  private flash = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#efe6cf', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  private flecks = new Flecks(260, 0.22);
  private shock = new ShockRefraction({ facing: 'ground' });
  private ivory = new THREE.Color('#efe6cf');
  private ink = new THREE.Color('#2a2830');
  private teal = new THREE.Color('#4fb3c4');
  private ice = new THREE.Color('#cfe6ee');
  private hand = new THREE.Vector3();
  private left = new THREE.Vector3(1, 0, 0);
  private tip = new THREE.Vector3();
  private d = new THREE.Vector3();
  private tail = new THREE.Vector3();
  private who: Enemy | null = null;
  private stopAt = -1;
  private sx = 0;
  private sz = 0;
  private glinted = false;
  private home = false;
  private dust = 0;
  private lastTip = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.harpoon = new THREE.Mesh(harpoonGeometry(), this.mat);
    this.harpoon.frustumCulled = false;
    this.harpoon.visible = false;
    this.flash.renderOrder = 3;
    this.flash.visible = false;
    group.add(this.etch.mesh, this.flash, this.rope.mesh, this.harpoon, this.flecks.mesh, this.shock.mesh);
  }

  reset(c: Cast<Harpoon>) {
    this.stopAt = -1;
    this.who = null;
    this.glinted = this.home = false;
    this.dust = 0;
    this.harpoon.visible = false;
    this.rope.mesh.visible = false;
    this.flash.visible = false;
    this.etch.set(0, 0, 0, 0, 0, 0);
    this.flecks.clear();
    this.shock.set(c.from, 0, 0);
  }

  cast(c: Cast<Harpoon>) {
    this.left.set(c.dir.z, 0, -c.dir.x);
    this.hand.copy(c.from).addScaledVector(c.dir, 0.3).addScaledVector(this.left, 0.3).setY(1.3);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  released(c: Cast<Harpoon>) {
    c.shake = 0.06;
  }

  stopped(c: Cast<Harpoon>, x: number, z: number, who: Enemy | null) {
    this.stopAt = c.time;
    this.sx = x;
    this.sz = z;
    this.who = who;
    const b = this.lastTip;
    const y = who ? FLY_Y - 0.1 : 0.45;
    this.flecks.burst(x, y, z, 14, 3.2, 3.4, this.ivory, 0.9, 8);
    this.flecks.burst(x, y, z, 9, 2.8, 3.8, this.ink, 0.9, 8);
    this.flecks.burst(x, y, z, 7, 2.4, 4.2, this.teal, 0.8, 8);
    this.flecks.burst(x, 0.1, z, 8, 3.4, 1.2, this.ice, 0.8, 6);
    this.flash.position.set(x, 0.05, z);
    this.flash.visible = true;
    c.shake = Math.max(c.shake, 0.18);
    b.set(x, y, z);
  }

  /** The harpoon with its tip at `tip`, along the unit vector `d`, its shaft `len` long (1 whole), `k` its size. Moves the rope's far end to its tail. */
  private place(tip: THREE.Vector3, d: THREE.Vector3, len: number, k: number) {
    const h = this.harpoon;
    h.visible = k > 0.01;
    h.position.copy(tip);
    h.scale.set(S * k, S * k, S * k * len);
    h.lookAt(tip.x + d.x, tip.y + d.y, tip.z + d.z);
    this.tail.copy(tip).addScaledVector(d, -TAIL * len * k);
  }

  /** Where the tip is held at the end of the wind-up, drawn back: near her hand, raised. */
  private heldTip(c: Cast<Harpoon>, out: THREE.Vector3, back: number) {
    return out.copy(this.hand).addScaledVector(c.dir, 1.0 - 0.6 * back).setY(this.hand.y + 0.3 * back);
  }

  frame(c: Cast<Harpoon>, t: number, dt: number) {
    this.mat.uniforms.uTime.value = t;
    if (this.stopAt >= 0) this.bite(c, t - this.stopAt);
    else if (t < WIND) this.windUp(c, t);
    else this.flight(c, t - WIND, dt);
  }

  /** 0-0.55: it appears in her hand and is drawn back, tip up; trembles still for the last 0.2 s. */
  private windUp(c: Cast<Harpoon>, t: number) {
    const back = smooth(t / 0.3);
    const pop = smooth(t / 0.12);
    const hold = clamp01((t - 0.35) / 0.2);
    const tr = Math.sin(t * 80) * 0.012 * hold;
    const tip = this.heldTip(c, this.tip, back);
    tip.x += this.left.x * tr; tip.z += this.left.z * tr;
    const p = 0.55 * back, cp = Math.cos(p);
    this.d.set(c.dir.x * cp, Math.sin(p), c.dir.z * cp);
    this.place(tip, this.d, 1, pop);
    this.mat.uniforms.uGlow.value = 0;
    this.rope.mesh.visible = false;
    if (t >= 0.5 && !this.glinted) {
      // a pale glint runs off the tip as the hold ends
      this.glinted = true;
      this.flecks.burst(tip.x + this.d.x * 0.1, tip.y + 0.1, tip.z + this.d.z * 0.1, 6, 0.7, 1.4, this.ice, 0.6, -1);
    }
    c.shake *= 0.9;
  }

  private flight(c: Cast<Harpoon>, ft: number, dt: number) {
    const b = c.bolt;
    if (!b || !b.alive) return;
    const flown = Math.min(RANGE, Math.hypot(b.pos.x - c.from.x, b.pos.z - c.from.z));
    const blend = 1 - smooth(flown / 1.5);
    const w = this.heldTip(c, this.lastTip, 1);
    const tip = this.tip.set(b.pos.x + (w.x - c.from.x) * blend, FLY_Y + (w.y - FLY_Y) * blend, b.pos.z + (w.z - c.from.z) * blend);
    const p = 0.55 * blend - 0.015, cp = Math.cos(p);
    this.d.set(c.dir.x * cp, Math.sin(p), c.dir.z * cp);
    this.place(tip, this.d, 1, 1);
    this.lastTip.copy(tip);
    // the rope pays out: sagging and waving at first, nearly taut at its reach
    const k = flown / RANGE;
    this.rope.set(this.hand.x, this.hand.y, this.hand.z, this.tail.x, this.tail.y, this.tail.z, 0, 1, 0.45 * (1 - k * 0.8) * smooth(flown / 2), 0.28 * Math.exp(-ft * 1.6) + 0.04, ft * 22);
    // ivory chips and, now and then, a teal glint fall from it
    this.dust += dt;
    while (this.dust > 0.035) {
      this.dust -= 0.035;
      const i = Math.floor((ft + this.dust) * 30);
      this.flecks.burst(tip.x - this.d.x * 0.6, tip.y - 0.1, tip.z - this.d.z * 0.6, 1, 0.5, 0.2, i % 5 === 0 ? this.teal : i % 2 ? this.ice : this.ivory, 0.7, 2.5);
    }
    c.shake *= 0.9;
  }

  /** `a` seconds after it stopped. */
  private bite(c: Cast<Harpoon>, a: number) {
    const who = this.who;
    const hx = this.hand.x, hz = this.hand.z;
    let tx = this.sx, ty = who ? FLY_Y - 0.1 : 0.45, tz = this.sz;
    if (who) { tx = who.group.position.x; tz = who.group.position.z; }
    let dx = tx - hx, dz = tz - hz;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist; dz /= dist;
    const hold = who ? PULL_T : 0.35;
    const reel = smooth((a - hold) / REEL);
    const pitch = who ? 0.02 : -ICE_PITCH;
    const cp = Math.cos(pitch);
    const q = Math.sin(a * 62) * 0.045 * Math.exp(-a * 9);
    this.d.set(dx * cp, Math.sin(pitch) + q, dz * cp).normalize();
    // the tip: in the enemy (live), or standing in the ice; hauled home to her hand at the end
    const tip = this.tip.set(tx, ty, tz);
    if (reel > 0) tip.lerp(this.hand, reel);
    // the shaft sinks into the body as the enemy comes close, and into her hand as it is hauled home
    const len = who ? THREE.MathUtils.clamp((dist - 0.55) / TAIL, 0.3, 1) : 1;
    const gone = 1 - smooth((reel - 0.85) / 0.15);
    this.place(tip, this.d, len, gone);
    // the rope: taut and rippling back toward her while he is dragged; a loose bow in the ice case until it takes up
    const slack = who ? 0.04 : 0.3 * Math.exp(-a * 4) * (1 - reel);
    this.rope.set(hx, this.hand.y, hz, this.tail.x, this.tail.y, this.tail.z, 0, 1, slack * 0.5 + 0.03, who ? 0.06 * (1 - reel) : slack * 0.5, who ? -a * 26 : a * 8);
    if (reel >= 1 && !this.home) {
      this.home = true;
      this.harpoon.visible = false;
      this.rope.mesh.visible = false;
      this.flecks.burst(hx, this.hand.y, hz, 8, 1.4, 1.8, this.ivory, 0.7, 5);
    }
    if (this.home) { this.harpoon.visible = false; this.rope.mesh.visible = false; }

    // the ink waves are scratched into the ice where it bit
    const start = Math.atan2(c.dir.z, c.dir.x);
    const fade = 1 - smooth((a - 1.35) / 0.55);
    this.etch.set(this.sx, this.sz, start, easeOut(a / 0.7), Math.exp(-a * 1.3), fade);

    // the flash and the ring of force at the bite
    const fl = Math.exp(-a * 10);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.5 * fl;
    this.flash.scale.setScalar(0.5 + a * 5);
    this.flash.visible = fl > 0.02;
    const sg = clamp01(a / 0.4);
    this.shock.set(this.d.set(this.sx, 0, this.sz), 0.3 + 1.9 * sg, 0.05 * (1 - sg) * (1 - sg));
    c.shake = Math.max(c.shake * 0.88, 0.16 * Math.exp(-a * 9));
  }

  after(c: Cast<Harpoon>) {
    c.shake *= 0.9;
  }
}

export const whaleboneHarpoonModule = spell<Harpoon>({
  label: 'whalebone harpoon',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 0.4 },
  seconds: 3.2,
  state: () => ({}),
  rules: {
    windup: WIND,
    shape: { kind: 'bolt', speed: SPEED, range: RANGE, radius: 0.4 },
    hit: { damage: 38, knock: 0, pull: PULL, color: '#7fc8d6' },
    warn: 0.02,
  },
  look: HarpoonLook,
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.9 },
  frame: 5,
  maxDamage: 100,
});
