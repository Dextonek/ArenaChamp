import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks, easeOut, smooth } from '../../../heroes/sheath/partsBig';
import { ZigBolt, fanGeometry, vertexMaterial } from './g7Parts';

/**
 * Art deco arc (gallery 7, pipeline/designs/gallery-20.md). A chain hit: a sure hit on the chosen enemy, then the bolt hops to
 * the nearest enemy not yet hit within 7.5 m of the last (the tool arena spaces its dummies 5 to 7 m), up to three more, one hop every 0.16 s. Each hop is a gold zigzag drawn
 * with a ruler and a sunburst fan opening on the one it strikes.
 * Answer: the first mark shows 1.0 m for 0.6 s: 0.25 + 1 / 4 = 0.5 s. The hops are sure hits (the range and sight were the check).
 * On the blocks: a `target` shape (windup 0.3 + delay 0.6), the hops in `on.frame` as chained `projectile` hits.
 */
const WIND = 0.3;
const DELAY = 0.6;
const HIT = WIND + DELAY; // the first hit
const HOP = 0.16;
const REACH = 7.5; // metres from the last one struck to the next (the tool arena spaces its dummies about 5 to 7 m apart)
const MAX = 4; // enemies struck in all
const DURATION = 3.0;
const BEAT = HIT - 0.2; // the hush
const Y = 1.2; // the bolt's height

const COLORS = {
  lacquer: '#0c0b10', // the dark layer: black lacquer
  gold: '#d6a53a', // the accent: gold
  goldD: '#7e5a14',
  chrome: '#e6edf0', // the foil: chrome
  hot: '#fff1c4', // the hot core: the strikes only
};

interface Chain {
  /** Enemies struck so far, where they stood and when. */
  n: number;
  px: number[];
  pz: number[];
  pt: number[];
  who: Enemy[];
  /** No one was left within reach: the chain ended. */
  over: boolean;
}

/** One struck place: a lacquer disc with a gold rim, a sunburst on the floor and a standing half-sun behind it. */
class Station {
  private disc: THREE.Mesh;
  private discMat = new THREE.MeshBasicMaterial({ color: COLORS.lacquer, transparent: true, opacity: 0, depthWrite: false });
  private rim = flatRing(new THREE.Color(COLORS.gold), 0.05, false, 3);
  private inner = flatRing(new THREE.Color(COLORS.chrome), 0.025, false, 3);
  private floor: THREE.Mesh;
  private stand: THREE.Mesh;
  private floorMat = vertexMaterial();
  private standMat = vertexMaterial();

  constructor(group: THREE.Group) {
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.discMat);
    this.disc.renderOrder = 2;
    this.disc.frustumCulled = false;
    this.floor = new THREE.Mesh(fanGeometry(24, Math.PI * 2, 0.6, 3.0, 1.9, 0.115, COLORS.hot, COLORS.gold, true), this.floorMat);
    this.floor.renderOrder = 4;
    this.floor.frustumCulled = false;
    this.stand = new THREE.Mesh(fanGeometry(13, Math.PI, 0.5, 3.3, 2.1, 0.14, COLORS.chrome, COLORS.gold, false), this.standMat);
    this.stand.renderOrder = 6;
    this.stand.frustumCulled = false;
    this.hide();
    group.add(this.disc, this.rim.mesh, this.inner.mesh, this.floor, this.stand);
  }

  hide() {
    this.disc.visible = this.floor.visible = this.stand.visible = false;
    this.rim.mesh.visible = this.inner.mesh.visible = false;
  }

  /**
   * At (x, z): `open` 0..1 how far the rays have grown, `fan` and `scorch` their opacities (the burst, the lacquer left), `yaw`
   * turns the standing half-sun to face the way the bolt came from; `stand` its size (0 leaves it out).
   */
  set(x: number, z: number, open: number, fan: number, scorch: number, yaw: number, stand: number, spin: number) {
    const on = scorch > 0.004 || fan > 0.004;
    this.disc.visible = this.rim.mesh.visible = this.inner.mesh.visible = on;
    this.floor.visible = fan > 0.004 && open > 0.01;
    this.stand.visible = fan > 0.004 && stand > 0.01;
    if (!on) return;
    this.disc.position.set(x, 0.03, z);
    this.disc.scale.set(1.0, 1, 1.0);
    this.discMat.opacity = 0.6 * scorch;
    this.rim.mesh.position.set(x, 0.05, z);
    this.rim.mesh.scale.set(1.0, 1, 1.0);
    this.rim.material.opacity = 0.95 * scorch;
    this.inner.mesh.position.set(x, 0.05, z);
    this.inner.mesh.scale.set(0.74, 1, 0.74);
    this.inner.material.opacity = 0.7 * scorch;
    this.floor.position.set(x, 0.06, z);
    this.floor.scale.setScalar(Math.max(open, 1e-3));
    this.floor.rotation.y = spin;
    this.floorMat.opacity = 0.9 * fan;
    this.stand.position.set(x, 0.05, z);
    this.stand.rotation.y = yaw;
    this.stand.scale.setScalar(Math.max(stand, 1e-3));
    this.standMat.opacity = 0.95 * fan;
  }
}

class ArcLook implements Look<Chain> {
  private stations: Station[] = [];
  private bolts: ZigBolt[] = [];
  private guide = new ZigBolt(COLORS.goldD, COLORS.gold);
  private charge = flatRing(new THREE.Color(COLORS.gold), 0.05, false, 3);
  private shock = flatRing(new THREE.Color(COLORS.chrome), 0.06, true, 5);
  private flecks = new Flecks(220, 0.18);
  private gold = new THREE.Color(COLORS.gold);
  private chrome = new THREE.Color(COLORS.chrome);
  private hot = new THREE.Color(COLORS.hot);
  private fx = 0;
  private fz = 0;
  private done = [false, false, false, false];

  constructor(group: THREE.Group) {
    for (let i = 0; i < MAX; i++) {
      this.stations.push(new Station(group));
      this.bolts.push(new ZigBolt(COLORS.gold, COLORS.hot));
    }
    for (const b of [...this.bolts, this.guide]) group.add(b.dark.mesh, b.gold.mesh, b.core.mesh);
    group.add(this.charge.mesh, this.shock.mesh, this.flecks.mesh);
  }

  reset() {
    this.done.fill(false);
    for (const s of this.stations) s.hide();
    this.charge.mesh.visible = this.shock.mesh.visible = false;
    for (const b of this.bolts) { b.dark.mesh.visible = b.gold.mesh.visible = b.core.mesh.visible = false; }
    this.guide.dark.mesh.visible = this.guide.gold.mesh.visible = this.guide.core.mesh.visible = false;
    this.flecks.clear();
  }

  cast(c: Cast<Chain>) {
    this.fx = c.from.x; this.fz = c.from.z;
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  frame(c: Cast<Chain>, t: number) {
    const s = c.state;
    const fadeAll = 1 - smooth((t - 2.5) / 0.45);
    const sx = c.spot.x, sz = c.spot.z;

    // anticipation: the caster's ring opens, a ruled line is drawn to the mark, the sunburst grows on the mark and, in the hush, draws in
    const draw = smooth((t - 0.05) / 0.5);
    const hush = smooth((t - BEAT) / 0.1);
    const pre = !c.impacted;
    this.charge.mesh.position.set(this.fx, 0.05, this.fz);
    const cr = 0.5 + 0.6 * smooth(t / 0.4) - 0.25 * hush;
    this.charge.mesh.scale.set(cr, 1, cr);
    this.charge.material.opacity = pre ? 0.85 * smooth(t / 0.2) : 0;
    this.charge.mesh.visible = this.charge.material.opacity > 0.01;
    this.guide.set(this.fx, this.fz, sx, sz, Y - 0.35, 0, pre ? draw : 1, 0, 0.07, pre ? 0.55 * (1 - 0.7 * hush) : 0, pre ? 0.4 * (1 - hush) : 0);

    if (pre) {
      // the first mark
      const open = (0.1 + 0.9 * draw) * (1 - 0.12 * hush) * 0.85;
      this.stations[0].set(sx, sz, open, 0.55 + 0.25 * Math.sin(t * 18) * (1 - hush), smooth(t / 0.3), Math.atan2(this.fx - sx, this.fz - sz), 0, t * 0.8);
    }

    // the strokes
    for (let i = 0; i < MAX; i++) {
      const st = this.stations[i], bolt = this.bolts[i];
      if (i >= s.n) {
        if (i > 0 || !pre) { bolt.set(0, 0, 0, 0, Y, 0, 0, 0, 0, 0, 0); st.hide(); }
        continue;
      }
      const a = t - s.pt[i];
      const ax = i === 0 ? this.fx : s.px[i - 1], az = i === 0 ? this.fz : s.pz[i - 1];
      const ay = Y;
      const race = easeOut(a / 0.09);
      // flash for a moment, then the gilding stays as a thin diagram until the end
      const keep = 0.3 + 0.7 * (1 - smooth(a / 0.35));
      const op = keep * fadeAll;
      bolt.set(ax, az, s.px[i], s.pz[i], ay, 0, race, 0.5, 0.26 * (1 - 0.3 * smooth(a / 0.4)), op, (1 - smooth(a / 0.22)) * fadeAll);
      const yaw = Math.atan2(ax - s.px[i], az - s.pz[i]);
      const open = easeOut(a / 0.28);
      const fan = (1 - smooth((a - 0.35) / 0.75)) * fadeAll;
      const scorch = smooth(a / 0.12) * fadeAll;
      st.set(s.px[i], s.pz[i], open, fan, scorch, yaw, 0.25 + 0.75 * easeOut(a / 0.3), 0.5 + a * 0.9);
      // the burst of this hit, once
      if (!this.done[i]) {
        this.done[i] = true;
        c.shake = Math.max(c.shake, i === 0 ? 0.2 : 0.12);
        this.flecks.burst(s.px[i], Y - 0.1, s.pz[i], 20, 4.4, 3.4, this.gold, 1.0, 7);
        this.flecks.burst(s.px[i], Y - 0.1, s.pz[i], 10, 3.4, 3.0, this.chrome, 0.9, 7);
        this.flecks.burst(s.px[i], Y, s.pz[i], 4, 1.2, 1.5, this.hot, 0.5, 4);
      }
    }
    // the ring where each hit lands expands once (chrome, thin)
    let shock = 0, shx = 0, shz = 0;
    for (let i = 0; i < s.n; i++) {
      const a = t - s.pt[i];
      if (a >= 0 && a < 0.45) { shock = 1 - a / 0.45; shx = s.px[i]; shz = s.pz[i]; }
    }
    this.shock.mesh.visible = shock > 0.01;
    if (shock > 0.01) {
      const r = 0.5 + 1.8 * easeOut(1 - shock);
      this.shock.mesh.position.set(shx, 0.06, shz);
      this.shock.mesh.scale.set(r, 1, r);
      this.shock.material.opacity = 0.8 * shock * shock;
    }
  }

  after(c: Cast<Chain>) {
    c.shake *= 0.84;
  }
}

export const artDecoArcModule = spell<Chain>({
  label: 'art deco arc',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  seconds: DURATION,
  state: () => ({ n: 0, px: [0, 0, 0, 0], pz: [0, 0, 0, 0], pt: [0, 0, 0, 0], who: [], over: false }),
  rules: {
    windup: WIND,
    delay: DELAY,
    shape: { kind: 'target', mark: 1.0 },
    hit: { damage: 40, knock: 0.4, color: '#d6a53a', projectile: true, from: 'caster' },
    on: {
      // the first strike lands: the chain starts where they stood
      impact(c, hit) {
        const tg = c.target;
        if (!hit || !tg) return;
        const p = tg.group.position, s = c.state;
        s.n = 1; s.px[0] = p.x; s.pz[0] = p.z; s.pt[0] = c.time; s.who.push(tg);
      },
      // one hop every HOP s: the nearest enemy not yet hit, within REACH of the last
      frame(c, t) {
        const s = c.state, ctx = c.ctx;
        if (!ctx || s.n === 0 || s.n >= MAX || s.over || t < s.pt[s.n - 1] + HOP) return;
        const lx = s.px[s.n - 1], lz = s.pz[s.n - 1];
        let best: Enemy | null = null, bd = REACH;
        for (const en of ctx.enemies?.() ?? ctx.targets) {
          if (s.who.includes(en)) continue;
          const d = Math.hypot(en.group.position.x - lx, en.group.position.z - lz);
          if (d < bd) { bd = d; best = en; }
        }
        if (!best) { s.over = true; return; }
        ctx.hit(best, { ...c.hitOptions(), projectile: true });
        const i = s.n++;
        s.px[i] = best.group.position.x; s.pz[i] = best.group.position.z; s.pt[i] = t; s.who.push(best);
      },
    },
  },
  look: ArcLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.85 },
  frame: 11,
  maxDamage: 120,
});
