import * as THREE from 'three';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Blade } from '../../../heroes/sheath/parts';
import { Chips, clamp01, easeOut, glowTexture, hash, runeAtlas, runePlane, smooth, streakTexture } from './g2Parts';

/**
 * Runestone fall (gallery #14, Norse runestone). A ground circle of 3.6 m at the aim; a carved granite standing stone comes
 * down out of the clouds onto it. It lands at 1.4 s: 0.25 + 3.6 / 4 = 1.15 s of warning, shown 1.4 s. Everyone inside the
 * circle (live position) takes 120 once, at the landing. A tool spell: numbers are plausible, not balanced.
 *
 * The look. The palette is iron-grey granite and charcoal for the dark layer, frost blue as the one accent, rime white as
 * the foil beside every dark thing, and white only in the star of the landing. 0-1.4: a shadow grows on the floor under the
 * stone and a ring of eight runes is carved round the circle; the stone, a hexagonal pillar with two iron bands and eight
 * runes cut in it, tumbles down from 24 m and rights itself, a frost streak behind it, its runes kindling one by one (and
 * the floor's runes with them). The last 0.22 s is the dead beat: the streak is gone, the runes dim, the world darkens, the
 * stone falls plain and heavy. At 1.4: one dark impact frame (frost figures), it lands upright, sunk 0.4 m into the floor;
 * a ring of frost runs out to the rim, the floor cracks in dark seams edged with frost, granite chips and rime flakes are
 * thrown, a shake. The runes blaze; 0.45 s later the stone bursts, its runes fly off it in an arc and land on the floor ring,
 * and the seams cool and go dark. Clean by 3.2 s.
 */

const R = 3.6;
const T = 1.4; // the landing
const DURATION = 3.2;
const Y0 = 16; // where the stone starts
const H = 3.0;
const RB = 0.85; // its radius at the foot and at the top
const RT = 0.58; // its height
const SINK = 0.4;
const FLOOR_RING = 2.7;
const GLYPHS = 8;
const CRACKS = 10;

const COL = {
  dark: '#14161b',
  granite: '#5b5e67',
  iron: '#272a30',
  frost: '#59c6ff',
  rime: '#e6f4ff',
  core: '#ffffff',
};
export const RUNESTONE_CSS = COL.frost;

class FallLook implements Look<null> {
  readonly screen = createScreenFx();
  private atlas = runeAtlas();
  private glow = glowTexture();
  private shadow: THREE.Mesh;
  private flare: THREE.Mesh;
  private stone = new THREE.Group();
  private streakA: THREE.Mesh;
  private streakB: THREE.Mesh;
  private ringOuter: THREE.Mesh;
  private ringInner: THREE.Mesh;
  private shock: THREE.Mesh;
  private wave = new ShockRefraction({ facing: 'ground' });
  private star = new StarBurst({ points: 8, inner: 0.22, color: COL.frost, core: COL.core });
  private seams: Blade[] = [];
  private seamGlow: Blade[] = [];
  private seamDir: THREE.Vector3[] = [];
  private floorCarve: THREE.Mesh[] = [];
  private floorGlow: THREE.Mesh[] = [];
  private stoneGlow: THREE.Mesh[] = [];
  private flyers: THREE.Mesh[] = [];
  private rock: Chips;
  private frost: Chips;
  private spot = new THREE.Vector3();
  private v = new THREE.Vector3();
  private landed = false;
  private burst = false;
  private col = [new THREE.Color(COL.granite), new THREE.Color(COL.iron), new THREE.Color(COL.rime)];
  private frostCol = [new THREE.Color(COL.frost).multiplyScalar(0.8), new THREE.Color(COL.rime).multiplyScalar(0.62)];
  private drip = 0;

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(COL.frost);
    this.screen.tint.set('#6f7b8e');
    // the shadow, then the scorch
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.glow, color: COL.dark, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.shadow.renderOrder = 2;
    this.shadow.visible = false;
    const flat = (geo: THREE.BufferGeometry, color: string, add: boolean, order: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      m.renderOrder = order;
      m.frustumCulled = false;
      m.visible = false;
      return m;
    };
    const ring = (inner: number) => new THREE.RingGeometry(inner, 1, 96).rotateX(-Math.PI / 2);
    this.ringOuter = flat(ring(0.965), COL.frost, true, 4);
    this.ringInner = flat(ring(0.975), COL.rime, true, 4);
    this.shock = flat(ring(0.8), COL.frost, true, 4);

    // the stone: a hexagonal pillar, wider at the foot, its top cut at a slant; two iron bands
    const body = new THREE.CylinderGeometry(RT, RB, H, 6, 3);
    body.translate(0, H / 2, 0);
    const p = body.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > H - 0.01) p.setY(i, H + p.getX(i) * 0.22 + (hash(Math.round(p.getX(i) * 40) + 3) - 0.5) * 0.05);
      else if (p.getY(i) > 0.01) {
        const k = hash(i * 1.7) - 0.5;
        p.setX(i, p.getX(i) * (1 + k * 0.06));
        p.setZ(i, p.getZ(i) * (1 + k * 0.06));
      }
    }
    body.computeVertexNormals();
    const granite = new THREE.Mesh(body, new THREE.MeshLambertMaterial({ color: COL.granite, flatShading: true }));
    this.stone.add(granite);
    const bandMat = new THREE.MeshLambertMaterial({ color: COL.iron, flatShading: true });
    for (const y of [0.45, 2.1]) {
      const r = RB - ((RB - RT) * y) / H + 0.035;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.012, r + 0.012, 0.2, 6, 1), bandMat);
      band.position.y = y;
      this.stone.add(band);
    }
    // eight runes: a dark cut under a glowing one, on the stone's faces
    const carveMat = new THREE.MeshBasicMaterial({ map: this.atlas, color: COL.dark, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < GLYPHS; i++) {
      const face = i < 6 ? i : i === 6 ? 1 : 4;
      const y = i < 6 ? 1.25 : 2.5;
      const size = i < 6 ? 0.62 : 0.4;
      const th = ((face + 0.5) / 6) * Math.PI * 2;
      const r = (RB - ((RB - RT) * y) / H) * Math.cos(Math.PI / 6) + 0.012;
      const g = runePlane(i);
      const cut = new THREE.Mesh(g, carveMat);
      const lit = flat(g, COL.frost, true, 7) as THREE.Mesh;
      (lit.material as THREE.MeshBasicMaterial).map = this.atlas;
      (lit.material as THREE.MeshBasicMaterial).polygonOffset = true;
      (lit.material as THREE.MeshBasicMaterial).polygonOffsetFactor = -3;
      for (const m of [cut, lit]) {
        m.position.set(Math.sin(th) * (r + (m === lit ? 0.008 : 0)), y, Math.cos(th) * (r + (m === lit ? 0.008 : 0)));
        m.rotation.y = th;
        m.scale.setScalar(size);
        this.stone.add(m);
      }
      lit.visible = true;
      this.stoneGlow.push(lit);
    }
    this.stone.visible = false;
    this.stone.scale.set(1.8, 1.5, 1.8);

    // the streak: two crossed planes
    const sTex = streakTexture();
    const sm = () => new THREE.MeshBasicMaterial({ map: sTex, color: COL.frost, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const sg = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.streakA = new THREE.Mesh(sg, sm());
    this.streakB = new THREE.Mesh(sg, sm());
    this.streakB.rotation.y = Math.PI / 2;
    this.streakA.visible = this.streakB.visible = false;
    this.streakA.frustumCulled = this.streakB.frustumCulled = false;

    // the floor's runes
    for (let i = 0; i < GLYPHS; i++) {
      const g = runePlane(i);
      const cut = new THREE.Mesh(g.clone().rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.atlas, color: COL.dark, transparent: true, opacity: 0, depthWrite: false }));
      cut.renderOrder = 3;
      cut.visible = false;
      const lit = flat(g.clone().rotateX(-Math.PI / 2), COL.frost, true, 4);
      (lit.material as THREE.MeshBasicMaterial).map = this.atlas;
      this.floorCarve.push(cut);
      this.floorGlow.push(lit);
    }
    // the stone's runes in flight
    for (let i = 0; i < GLYPHS; i++) {
      const m = flat(runePlane(i).rotateX(-Math.PI / 2), COL.frost, true, 8);
      (m.material as THREE.MeshBasicMaterial).map = this.atlas;
      this.flyers.push(m);
    }
    // the seams of the cracked floor: dark, with a frost line in each
    for (let i = 0; i < CRACKS; i++) {
      const a = ((i + 0.3 * hash(i + 1)) / CRACKS) * Math.PI * 2;
      this.seamDir.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
      this.seams.push(new Blade(new THREE.Color(COL.dark), false, 3));
      this.seamGlow.push(new Blade(new THREE.Color(COL.frost), true, 4));
    }

    this.rock = new Chips(110, new THREE.BoxGeometry(0.2, 0.14, 0.17), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    this.frost = new Chips(260, new THREE.TetrahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));

    this.flare = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.glow, color: COL.frost, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.flare.renderOrder = 4;
    this.flare.visible = false;
    group.add(
      this.flare, this.shadow, this.ringOuter, this.ringInner, this.shock, this.stone, this.streakA, this.streakB,
      ...this.floorCarve, ...this.floorGlow, ...this.flyers, ...this.seams.map((b) => b.mesh), ...this.seamGlow.map((b) => b.mesh),
      this.rock.mesh, this.frost.mesh, this.star.mesh, this.wave.mesh,
    );
  }

  reset() {
    this.landed = this.burst = false;
    this.drip = 0;
    clearScreenFx(this.screen);
    this.rock.clear();
    this.frost.clear();
    this.shadow.visible = this.stone.visible = this.flare.visible = false;
    this.streakA.visible = this.streakB.visible = false;
    for (const m of [this.ringOuter, this.ringInner, this.shock, ...this.floorCarve, ...this.floorGlow, ...this.flyers]) m.visible = false;
    for (const b of this.seams) b.hide();
    for (const b of this.seamGlow) b.hide();
    this.star.set(this.v.set(0, 0, 0), 1e-3, 0);
    this.wave.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  cast(c: Cast<null>) {
    const ctx = c.ctx!;
    this.spot.set(c.centres[0].x, 0, c.centres[0].z);
    this.screen.silhouettes = [ctx.caster.group, ...(ctx.enemies?.() ?? ctx.targets).map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(0.8);
    for (let i = 0; i < GLYPHS; i++) {
      const a = (i / GLYPHS) * Math.PI * 2 + 0.2;
      for (const m of [this.floorCarve[i], this.floorGlow[i]]) {
        m.position.set(this.spot.x + Math.sin(a) * FLOOR_RING, 0.04, this.spot.z + Math.cos(a) * FLOOR_RING);
        m.scale.setScalar(0.8);
        m.rotation.y = a + Math.PI;
      }
    }
  }

  tick(dt: number) {
    this.rock.update(dt);
    this.frost.update(dt);
  }

  idle(dt: number) {
    this.rock.update(dt);
    this.frost.update(dt);
  }

  private mat(m: THREE.Mesh) {
    return m.material as THREE.MeshBasicMaterial;
  }

  private kindle(i: number, t: number) {
    const at = 0.35 + i * 0.11;
    return smooth((t - at) / 0.09);
  }

  frame(c: Cast<null>, t: number) {
    const sp = this.spot, fx = this.screen;
    const k = clamp01(t / T);
    const a = t - T;
    // ---- the fall ----
    if (a < 0) {
      const hush = smooth((t - (T - 0.22)) / 0.1);
      const y = Y0 * (1 - k * k);
      const right = 1 - smooth(k * 1.15);
      this.stone.visible = true;
      this.stone.position.set(sp.x, y - SINK * k * k * k, sp.z);
      this.stone.rotation.set(0.9 * right * right, 5.5 * right + 0.6, -0.5 * right * right);
      // the shadow grows as it comes
      this.shadow.visible = true;
      this.shadow.position.set(sp.x, 0.03, sp.z);
      this.shadow.scale.setScalar(0.9 + 1.5 * k * k);
      this.mat(this.shadow).opacity = 0.12 + 0.55 * k * k;
      // the circle and its runes, drawn
      this.ringOuter.visible = this.ringInner.visible = true;
      this.ringOuter.position.set(sp.x, 0.05, sp.z);
      this.ringInner.position.set(sp.x, 0.05, sp.z);
      this.ringOuter.scale.setScalar(R);
      this.ringInner.scale.setScalar(FLOOR_RING - 0.55);
      this.mat(this.ringOuter).opacity = (0.25 + 0.5 * smooth(t / 0.8)) * (1 - 0.5 * hush);
      this.mat(this.ringInner).opacity = 0.35 * smooth(t / 0.8) * (1 - hush);
      for (let i = 0; i < GLYPHS; i++) {
        const lit = this.kindle(i, t) * (1 - 0.6 * hush) * (0.85 + 0.15 * Math.sin(t * 17 + i * 2));
        const cm = this.mat(this.floorCarve[i]), gm = this.mat(this.floorGlow[i]);
        this.floorCarve[i].visible = this.floorGlow[i].visible = true;
        cm.opacity = 0.75 * smooth(t / 0.5);
        gm.opacity = lit * 0.9;
        const sg = this.stoneGlow[i].material as THREE.MeshBasicMaterial;
        sg.opacity = this.kindle(i, t) * (1 - 0.55 * hush) * (0.8 + 0.2 * Math.sin(t * 21 + i * 1.7));
      }
      // the streak
      const len = Math.min(11, 1.5 + 12 * k * k);
      const sOn = (1 - hush) * smooth((t - 0.1) / 0.3);
      this.streakA.visible = this.streakB.visible = sOn > 0.01;
      this.streakA.position.set(sp.x, y + H, sp.z);
      this.streakB.position.copy(this.streakA.position);
      this.streakA.scale.set(1.1, len, 1);
      this.streakB.scale.set(1.1, len, 1);
      this.mat(this.streakA).opacity = this.mat(this.streakB).opacity = 0.75 * sOn;
      // rime sheds off it as it falls
      if (t > 0.35 && hush < 0.5) {
        for (let j = 0; j < 2; j++) {
          const s = (this.drip++) * 1.37;
          this.frost.put(sp.x + (hash(s) - 0.5) * 0.9, y + H * hash(s + 4), sp.z + (hash(s + 1) - 0.5) * 0.9, (hash(s + 2) - 0.5) * 1.2, 1.5 + hash(s + 3) * 2, (hash(s + 5) - 0.5) * 1.2, this.frostCol[j % 2], 0.9 + 0.5 * hash(s + 6), 0.55, s, -1.5);
        }
      }
      fx.darken = 0.1 * smooth(t / 1.0) + 0.3 * hush;
      fx.impact = 0;
      fx.chroma = 0;
      return;
    }

    // ---- the landing ----
    if (!this.landed) {
      this.landed = true;
      c.shake = 0.7;
      this.shadow.scale.setScalar(2.4);
      for (let i = 0; i < 52; i++) {
        const s = i * 2.3 + 40, an = hash(s) * 6.283, v = 2.5 + 6 * hash(s + 1);
        this.rock.put(sp.x + Math.sin(an) * 0.7, 0.3, sp.z + Math.cos(an) * 0.7, Math.sin(an) * v, 3 + 6 * hash(s + 2), Math.cos(an) * v, this.col[i % 3 === 2 ? 1 : 0], 0.7 + 0.9 * hash(s + 3), 2.0, s, 14);
      }
      for (let i = 0; i < 34; i++) {
        const s = i * 1.9 + 200, an = hash(s) * 6.283, v = 1 + 5 * hash(s + 1);
        this.frost.put(sp.x + Math.sin(an) * 0.5, 0.15, sp.z + Math.cos(an) * 0.5, Math.sin(an) * v, 2 + 5 * hash(s + 2), Math.cos(an) * v, this.frostCol[i % 2], 1 + 0.8 * hash(s + 3), 1.4, s, 5);
      }
    }
    this.stone.position.set(sp.x, -SINK, sp.z);
    this.stone.rotation.set(0, 0.6, 0);
    this.streakA.visible = this.streakB.visible = false;
    const pulse = 0.8 + 0.2 * Math.sin(a * 30);
    // the stone stands, runes blazing, 0.45 s; then it bursts
    const bursting = a >= 0.45;
    if (bursting && !this.burst) {
      this.burst = true;
      c.shake = Math.max(c.shake, 0.3);
      this.stone.visible = false;
      for (let i = 0; i < 46; i++) {
        const s = i * 3.1 + 400, an = hash(s) * 6.283, v = 1.5 + 4 * hash(s + 1);
        this.rock.put(sp.x + Math.sin(an) * 0.3, 0.6 + 2 * hash(s + 4), sp.z + Math.cos(an) * 0.3, Math.sin(an) * v, 2 + 4 * hash(s + 2), Math.cos(an) * v, this.col[i % 2], 0.8 + 1.0 * hash(s + 3), 1.6, s, 11);
      }
      for (let i = 0; i < 26; i++) {
        const s = i * 2.7 + 600, an = hash(s) * 6.283, v = 1.5 + 3 * hash(s + 1);
        this.frost.put(sp.x, 0.5 + 2.2 * hash(s + 4), sp.z, Math.sin(an) * v, 1 + 4 * hash(s + 2), Math.cos(an) * v, this.frostCol[i % 2], 1.1, 1.3, s, 3);
      }
    }
    if (!bursting) {
      for (let i = 0; i < GLYPHS; i++) {
        (this.stoneGlow[i].material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.4 + a * 5) * pulse;
      }
    }
    // the ring of frost runs out to the rim
    const q = clamp01(a / 0.38), out = easeOut(q);
    this.shock.visible = a < 0.5;
    this.shock.position.set(sp.x, 0.06, sp.z);
    this.shock.scale.setScalar(0.4 + (R - 0.4) * out);
    this.mat(this.shock).opacity = 0.9 * (1 - q) * (1 - q);
    this.wave.set(this.v.set(sp.x, 0, sp.z), 0.4 + R * out, 0.05 * (1 - q) * (1 - q));
    this.flare.visible = a < 0.6;
    this.flare.position.set(sp.x, 0.07, sp.z);
    this.flare.scale.setScalar(R * (0.8 + 0.5 * out));
    this.mat(this.flare).opacity = 0.9 * (1 - clamp01(a / 0.6)) ** 2;
    const st = StarBurst.pop(a, 0.04, 0.12);
    this.star.set(this.v.set(sp.x, 1.2, sp.z), 2.3 * st.scale + 1e-3, st.opacity, 0.3);
    // the circle's edge lingers, then goes
    const gone = 1 - smooth((a - 0.5) / 1.1);
    this.ringOuter.visible = gone > 0.01;
    this.mat(this.ringOuter).opacity = 0.7 * gone * (1 - smooth(a / 0.25) * 0.2);
    this.ringInner.visible = false;
    // the seams: dark cracks edged in frost, growing fast, cooling slowly
    const grow = easeOut(a / 0.28), heat = 1 - smooth((a - 0.15) / 1.6);
    const seam = 1 - smooth((a - 1.7) / 1.0);
    for (let i = 0; i < CRACKS; i++) {
      const len = (1.3 + (R - 0.8) * (0.55 + 0.45 * hash(i + 11))) * grow;
      this.seams[i].set(sp, this.seamDir[i], 0.35, 0.35 + len, 0.22, 0.035, 0.85 * seam);
      this.seamGlow[i].set(sp, this.seamDir[i], 0.4, 0.4 + len * 0.96, 0.07, 0.045, 0.9 * heat * seam);
    }
    this.shadow.visible = true;
    this.mat(this.shadow).opacity = 0.6 * (1 - smooth((a - 1.7) / 1.1));
    // the floor runes blaze with the landing; the stone's runes fly off it in an arc and settle on the ring
    for (let i = 0; i < GLYPHS; i++) {
      const lit = (a < 0.45 ? 1 : 1 - 0.5 * smooth((a - 0.45) / 0.4)) * (1 - smooth((a - 1.5) / 0.9));
      this.floorGlow[i].visible = lit > 0.01;
      this.mat(this.floorGlow[i]).opacity = lit * pulse * 0.95;
      this.mat(this.floorCarve[i]).opacity = 0.75 * seam;
      const f = this.flyers[i];
      const p = clamp01((a - 0.45 - i * 0.03) / 0.55);
      f.visible = p > 0 && p < 1 || (p >= 1 && a < 1.6);
      if (f.visible) {
        const e = easeOut(p), an = (i / GLYPHS) * Math.PI * 2 + 0.2;
        f.position.set(sp.x + Math.sin(an) * FLOOR_RING * e, 0.05 + (1.5 + 0.4 * i * 0.1) * 4 * e * (1 - e) + 1.3 * (1 - e), sp.z + Math.cos(an) * FLOOR_RING * e);
        f.rotation.y = an + Math.PI;
        f.scale.setScalar(0.5 + 0.3 * e);
        this.mat(f).opacity = p < 1 ? 0.8 : 0.8 * (1 - smooth((a - 1.0) / 0.6));
      }
    }
    // one dark impact frame, the world lets go
    fx.impact = impactFrameAt(t, T, [1], 0.05);
    fx.chroma = chromaPulse(t, T, 0.5, 9);
    fx.darken = 0.4 * (1 - smooth(a / 0.6));
  }

  after(c: Cast<null>) {
    c.shake *= 0.88;
  }
}

export const runestoneFallModule = spell<null>({
  label: 'runestone fall',
  category: 'targeted',
  targeting: { mode: 'ground', radius: R },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: 0,
    delay: T,
    shape: { kind: 'circle', radius: R, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    hit: { damage: 120, knock: 5, color: COL.frost },
  },
  look: FallLook,
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.85 },
  frame: 11,
  maxDamage: 250,
});
