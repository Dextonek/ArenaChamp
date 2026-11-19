import * as THREE from 'three';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { C, W } from '../numbers';
import { Flecks, GOLD, INK, PAPER, STEEL, Slit, clamp01, easeOut, flatRing } from '../parts';

/**
 * Noto, The Click (Kagen's W). No aim: he slides the blade home. A ring of 3.5 m shows round where he stands for 0.5 s, then
 * the click. The click itself deals nothing (`none`): every enemy inside the ring then is "hit" for 0, and the passive turns
 * that hit into his cut marks opening, 24 each (`dealt`, slot 1, on the screen that decides the enemy's hits). For 0.4 s after
 * the click, the next attack or spell that hits him is parried (`taken`, his own client).
 * Answer: step out of the ring, 0.9 m from his sword's reach to its edge: 0.25 + 0.9 / 4 = 0.48 s; it shows 0.5 s.
 * On the blocks: a zone round him, judged once.
 *
 * The look (the danger zone is the engine's, exactly the ring; his own lies inside it). 0-0.5 the sheath slides home: a thin
 * rice-paper ring just inside the zone's edge, with 36 tick marks that are laid one after another round it (the hand drawing the
 * blade in) and drift in a hand's breadth as they come, a gold glint pulsing at the sheath's mouth on his left hip. 0.5 the click:
 * one frame of ink (black, the figures in cinnabar), a sharp pale ring pulse out of the ring and a refraction ring, a gold star
 * at the hip, and on every enemy inside, three cinnabar almonds that open and close over the body (a burning almond), a few
 * rice-paper flecks. 0.5-0.9 (the parry window) a faint pale guard arc lies in front of him, fading as the window ends.
 * Clean by about 1.3 s.
 */
const CLICK_T = W.windup;
const GUARD_END = CLICK_T + W.parry;
const DONE_T = 1.3;
const TICKS = 36;
const MAX_FOES = 6;
const BURST_T = 0.42;
const R_OUT = W.radius - 0.1;
// the three almonds on a foe: [angle, height, sideways, length]
const ALMONDS: readonly (readonly [number, number, number, number])[] = [
  [0.65, 1.3, -0.12, 0.95], [-0.6, 1.0, 0.16, 0.9], [0.1, 0.75, -0.1, 0.8],
];

class NotoLook implements Look<null> {
  readonly screen = createScreenFx();
  private ring = flatRing(PAPER, 0.018, false, 4);
  private under = flatRing(INK, 0.05, false, 3);
  private pulse = flatRing(PAPER, 0.03, true, 5);
  private guard = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.17, 40, 1, -1.15, 2.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAPER.clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  private tickMat = new THREE.MeshBasicMaterial({ color: PAPER.clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private ticks = new THREE.Group();
  private hip = new StarBurst({ points: 4, inner: 0.14, color: GOLD, core: STEEL, additive: false });
  private clickStar = new StarBurst({ points: 8, inner: 0.25, color: GOLD, core: STEEL, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private flecks = new Flecks(14);
  private foes: { slits: Slit[]; holder: THREE.Group; who: Enemy | null }[] = [];
  private left = new THREE.Vector3();
  private body = new THREE.Vector3();
  private yaw = 0;
  private clicked = false;
  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(C.accent);
    this.screen.edgeTint.set(C.accent);
    this.ring.mesh.renderOrder = 4;
    this.guard.renderOrder = 4;
    this.guard.visible = false;
    this.guard.frustumCulled = false;
    const tg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < TICKS; i++) {
      const m = new THREE.Mesh(tg, this.tickMat);
      const a = (i / TICKS) * Math.PI * 2;
      m.position.set(Math.cos(a), 0, -Math.sin(a));
      m.rotation.set(-Math.PI / 2, 0, a - Math.PI / 2);
      m.scale.set(0.035 / 3.4, 0.2 / 3.4, 1);
      m.renderOrder = 4;
      m.visible = false;
      this.ticks.add(m);
    }
    this.ticks.visible = false;
    group.add(this.under.mesh, this.ring.mesh, this.ticks, this.guard, this.pulse.mesh, this.hip.mesh, this.clickStar.mesh, this.shock.mesh, this.flecks.group);
    for (let f = 0; f < MAX_FOES; f++) {
      const holder = new THREE.Group();
      holder.visible = false;
      const slits = ALMONDS.map(([ang, y, side, len]) => {
        const s = new Slit(len, 0.12, ang, 0.035);
        s.group.position.set(side, y, 0.36);
        s.group.rotation.x = -0.45;
        holder.add(s.group);
        return s;
      });
      this.foes.push({ slits, holder, who: null });
      group.add(holder);
    }
  }

  reset(c: Cast<null>) {
    clearScreenFx(this.screen);
    this.clicked = false;
    for (const m of [this.ring, this.under, this.pulse]) m.mesh.visible = false;
    this.ticks.visible = false;
    this.guard.visible = false;
    this.hip.set(c.from, 0, 0);
    this.clickStar.set(c.from, 0, 0);
    this.shock.set(c.from, 0, 0);
    this.flecks.reset();
    for (const f of this.foes) { f.holder.visible = false; f.who = null; }
  }

  cast(c: Cast<null>) {
    const ctx = c.ctx!;
    this.yaw = ctx.caster.group.rotation.y;
    // His left, and the hip the sheath hangs at.
    this.left.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.body.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.screen.silhouettes = [ctx.caster.group];
    this.screen.focus.copy(c.from).setY(1.2);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  frame(c: Cast<null>, t: number) {
    const from = c.from;
    // the sheath's mouth: at his left hip, a little behind
    this.v1.copy(from).addScaledVector(this.left, 0.3).addScaledVector(this.body, -0.18).setY(0.95);
    if (t < CLICK_T) {
      const k = t / CLICK_T, e = easeOut(k);
      // The ring: pale, just inside the zone's edge, closing a hand's breadth.
      const r = R_OUT - 0.12 * e;
      this.under.mesh.visible = this.ring.mesh.visible = true;
      this.under.mesh.position.set(from.x, 0.045, from.z);
      this.ring.mesh.position.set(from.x, 0.05, from.z);
      this.under.mesh.scale.setScalar(r);
      this.ring.mesh.scale.setScalar(r);
      this.under.material.opacity = 0.3 * Math.min(1, k * 4);
      this.ring.material.opacity = 0.35 + 0.5 * k;
      // The ticks: laid one after another round the ring, drifting in as they come.
      this.ticks.visible = true;
      this.ticks.position.set(from.x, 0.055, from.z);
      this.ticks.scale.setScalar(r);
      const shown = Math.floor(TICKS * Math.min(1, k * 1.15));
      for (let i = 0; i < TICKS; i++) this.ticks.children[i].visible = i < shown;
      this.tickMat.opacity = 0.35 + 0.6 * k;
      // The gold glint at the sheath's mouth, pulsing faster as he nears the click.
      const pl = 0.5 + 0.5 * Math.sin(t * (14 + 22 * k));
      this.hip.set(this.v1, 0.18 + 0.2 * k + 0.1 * pl, 0.5 + 0.5 * k, t * 2);
      return;
    }
    const a = t - CLICK_T;
    if (!this.clicked) {
      this.clicked = true;
      this.flecks.reset();
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + 0.3;
        this.v1.set(from.x + Math.cos(ang) * (W.radius - 0.4), 0.2, from.z + Math.sin(ang) * (W.radius - 0.4));
        this.flecks.put(this.v1, -Math.cos(ang), -Math.sin(ang), 1.0, 0.8, 0.8, i);
      }
    }
    // the click: the ring pulses out of its line, the refraction ring runs
    const q = easeOut(a / 0.3);
    this.pulse.mesh.visible = a < 0.3;
    this.pulse.mesh.position.set(from.x, 0.06, from.z);
    this.pulse.mesh.scale.setScalar(R_OUT + 0.15 + 0.7 * q);
    this.pulse.material.opacity = 0.85 * (1 - q) * (1 - q);
    this.shock.set(this.v1.set(from.x, 0, from.z), 0.8 + (W.radius + 0.4) * q, 0.05 * (1 - q) * (1 - q));
    // the ring settles back and goes out
    const go = 1 - clamp01(a / 0.25);
    this.ring.mesh.visible = this.under.mesh.visible = go > 0.01;
    this.ring.material.opacity = 0.85 * go;
    this.under.material.opacity = 0.3 * go;
    this.ring.mesh.scale.setScalar(R_OUT);
    this.under.mesh.scale.setScalar(R_OUT);
    this.ticks.visible = go > 0.01;
    this.ticks.scale.setScalar(R_OUT);
    this.tickMat.opacity = 0.95 * go;
    // the gold star at the sheath's mouth
    this.v1.copy(from).addScaledVector(this.left, 0.3).addScaledVector(this.body, -0.18).setY(0.95);
    const sp = StarBurst.pop(a, 0.05, 0.18);
    this.clickStar.set(this.v1, 1.5 * sp.scale + 1e-3, sp.opacity, a * 5);
    this.hip.set(this.v1, 0, 0);
    // the guard: a faint pale arc in front of him for the parry window
    const gk = clamp01((t - CLICK_T) / W.parry);
    this.guard.visible = t < GUARD_END + 0.1;
    this.guard.position.set(from.x, 0.07, from.z);
    this.guard.rotation.y = this.yaw - Math.PI / 2;
    (this.guard.material as THREE.MeshBasicMaterial).opacity = 0.42 * easeOut(a / 0.06) * (1 - gk * gk) * (t < GUARD_END + 0.1 ? 1 : 0);
    this.guard.scale.setScalar(0.85 + 0.15 * easeOut(a / 0.12));
    // the cuts on every enemy inside: almonds that open and close
    for (const f of this.foes) {
      if (!f.who) continue;
      const p = f.who.group.position;
      f.holder.position.set(p.x, 0.02, p.z);
      const open = a < BURST_T ? Math.sin(Math.PI * clamp01(a / BURST_T)) ** 0.6 : 0;
      f.holder.visible = open > 0.01;
      f.slits.forEach((s, i) => s.open(Math.max(0, open - 0.12 * i) / (1 - 0.12 * i), 1 - clamp01((a - 0.3) / 0.12)));
    }
  }

  impact(c: Cast<null>) {
    this.screen.silhouettes = [c.ctx!.caster.group, ...c.caught.map((e) => e.group)];
    this.foes.forEach((f, i) => { f.who = c.caught[i] ?? null; });
    c.shake = 0.35;
  }

  after(c: Cast<null>, t: number) {
    // One frame of ink at the click: black, he and the cut ones in cinnabar.
    this.screen.impact = impactFrameAt(t, CLICK_T, [1], 0.035);
    this.screen.chroma = t >= CLICK_T ? 0.45 * Math.exp(-(t - CLICK_T) * 12) : 0;
    c.shake *= 0.85;
    if (t >= DONE_T) {
      this.guard.visible = false;
      for (const f of this.foes) f.holder.visible = false;
    }
  }
}

export const notoModule = spell<null>({
  label: 'noto',
  category: 'hero: sheath',
  targeting: { mode: 'self', radius: W.radius },
  seconds: W.windup + 0.9,
  state: () => null,
  rules: {
    windup: W.windup,
    shape: { kind: 'zone', area: (c) => ({ kind: 'circle', x: c.from.x, z: c.from.z, radius: W.radius }) },
    hit: { damage: 0, none: true, knock: 0, color: C.accent },
  },
  look: NotoLook,
  noDamage: true,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 1,
});
