import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine } from '../../effects/parts/grove';
import { defaultLook, type MinionLook, type MinionPalette, type MinionRig } from '../../effects/parts/minion';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Verdant Ward (grove kit, E: turret). Three spiral vines rise round the chosen spot and a flower opens on each; at 0.5 s
 * a flowering vine is summoned there (`ctx.summon`, a green stalk with a pink blossom, see `blossomLook`) that stands for
 * 6 s and fires petal bolts at whatever comes within 8 m; the three vines then wither away under it. The spell's own
 * visual is clean by 1.6 s. See pipeline/designs/kit-grove.md.
 */
export interface VerdantWardSettings {
  hp: number;
  seconds: number;
  damage: number;
  attackEvery: number;
  range: number;
  loop: boolean;
}

export const defaultVerdantWard = (): VerdantWardSettings => ({ hp: 80, seconds: 6, damage: 12, attackEvery: 1.4, range: 8, loop: false });

// Timeline (seconds).
const RISE_T = 0.3;
const SUMMON_T = 0.5; // the vine stands and the turret is summoned
const WITHER_T = 0.9;
const DURATION = 1.6;

const RADIUS = 1.5;
const FLOWERS = 3;
const RING_R = 0.9;

// --- The blossom turret: a green stalk with a pink flower head that turns and kicks when it fires. ---
const shared: Record<string, THREE.BufferGeometry> = {};
const geo = (key: string, make: () => THREE.BufferGeometry) => (shared[key] ??= make());

function blossomRig(p: MinionPalette): MinionRig {
  const root = new THREE.Group();
  const cream = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  const pink = new THREE.MeshBasicMaterial({ color: 0xff7ab8 });
  const part = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  // A thick trunk of tilted segments that wind round the axis like a spiral vine (about 1.35 m).
  const SEG = 7;
  for (let i = 0; i < SEG; i++) {
    const k = i / SEG, a = i * 1.1;
    const w = 0.17 - 0.07 * k;
    const seg = part(geo('bSeg', () => new THREE.CylinderGeometry(0.8, 1, 0.3, 7)), p.body, Math.cos(a) * 0.09 * (1 - k * 0.4), 0.15 + i * 0.19, Math.sin(a) * 0.09 * (1 - k * 0.4));
    seg.scale.set(w, 1, w);
    seg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    root.add(seg);
  }
  // Leaf pairs up the trunk.
  for (let j = 0; j < 3; j++) {
    for (const s of [-1, 1]) {
      const l = part(geo('bLeaf', () => new THREE.ConeGeometry(0.12, 0.55, 4)), p.body, s * 0.2, 0.3 + j * 0.38, 0);
      l.rotation.set(0, j * 0.9, -s * 1.1);
      l.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), j * 0.9);
      l.position.y = 0.3 + j * 0.38;
      root.add(l);
    }
  }
  // Open flower head: ten cream petals with a pink rim, a pale heart.
  const head = new THREE.Group();
  head.position.y = 1.45;
  const petals: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pt = part(geo('bPetal', () => new THREE.BoxGeometry(0.2, 0.04, 0.42)), cream, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    const rim = part(geo('bRim', () => new THREE.BoxGeometry(0.22, 0.045, 0.1)), pink, 0, 0.005, 0.24);
    pt.add(rim);
    pt.rotation.y = -a + Math.PI / 2;
    pt.rotation.x = -0.25;
    petals.push(pt);
    head.add(pt);
  }
  const core = part(geo('bCore', () => new THREE.SphereGeometry(0.15, 10, 8)), p.eye, 0, 0.03, 0);
  core.castShadow = false;
  head.add(core);
  head.rotation.x = 1.0; // the flower faces forward (+Z), tipped toward its target
  root.add(head);
  return {
    root,
    barY: 2.15,
    animate(_dt, pose) {
      // Grows out of the ground in about half a second.
      const g = Math.min(1, pose.time / 0.5);
      root.scale.set(1, Math.max(0.05, 1 - (1 - g) * (1 - g)), 1);
      head.rotation.y = Math.sin(pose.time * 1.1) * 0.3;
      core.scale.setScalar(1 + Math.sin(pose.time * 4) * 0.1 + pose.shot * 0.7);
      petals.forEach((pt, i) => { pt.rotation.x = -0.25 + pose.shot * 0.4 * (i % 2 ? 1 : 0.7); });
    },
    dispose() {
      cream.dispose();
      pink.dispose();
    },
  };
}

/** The look passed to `ctx.summon`: the blossom for the turret kind. */
export const blossomLook: MinionLook = (kind, palette) => (kind === 'turret' ? blossomRig(palette) : defaultLook(kind, palette));

export class VerdantWard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VerdantWardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, 14);
  private angles = [0, 0, 0];

  // Event flags.
  private flags = { open: false, summoned: false, wither: false };

  // Parts.
  private roots = new RootRing();
  private vines: SpiralVine[] = [];
  private blooms: Bloom[] = [];
  private tips: THREE.Vector3[] = [];
  private petals = new Petals(24);
  private pollen = new Pollen(40);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: VerdantWardSettings = defaultVerdantWard()) {
    this.settings = settings;
    this.petals.life = 0.9;
    for (let i = 0; i < FLOWERS; i++) {
      this.vines.push(new SpiralVine(30, 6, 5));
      this.blooms.push(new Bloom());
      this.tips.push(new THREE.Vector3());
    }
    this.group.add(
      this.roots.mesh, ...this.vines.map((v) => v.mesh), ...this.blooms.map((b) => b.mesh), this.petals.mesh, this.pollen.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SUMMON_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    for (let i = 0; i < FLOWERS; i++) this.angles[i] = (i / FLOWERS) * Math.PI * 2 + 0.5;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.v1.copy(this.point).setY(1.0));
  }

  play() {
    this.reset();
    this.playing = true;
    this.roots.spread(this.point, 1.6, 0.3);
    for (let i = 0; i < FLOWERS; i++) {
      const a = this.angles[i];
      this.v1.set(this.point.x + Math.cos(a) * RING_R, 0.05, this.point.z + Math.sin(a) * RING_R);
      this.vines[i].grow(this.v1, this.v2.set(0, 1, 0), 2.0, 2.0, 0.22, RISE_T, { coilRadius: 0.26, phase: a, delay: i * 0.03 });
      this.vines[i].pointAt(1, this.tips[i]);
      this.tips[i].y += 0.08;
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.open = this.flags.summoned = this.flags.wither = false;
    clearScreenFx(this.screen);
    this.roots.reset();
    for (const v of this.vines) v.reset();
    for (const b of this.blooms) b.reset();
    this.petals.reset();
    this.pollen.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.roots.update(dt);
    for (const v of this.vines) v.update(dt);
    for (const b of this.blooms) b.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.open && t >= RISE_T + 0.02) {
      f.open = true;
      this.blooms.forEach((b, i) => b.open(this.tips[i], 0.7, 0.3));
    }
    if (!f.summoned && t >= SUMMON_T) {
      f.summoned = true;
      this.v1.copy(this.point).setY(0.6);
      this.petals.burst(this.v1, 8, 3.6);
      this.pollen.puff(this.v1, 6);
      this.shake = 0.12;
      // A network duel has no summons (the context leaves `summon` out): the spell then shows only the vines.
      if (ctx?.summon) {
        const s = this.settings;
        ctx.summon({
          kind: 'turret', at: this.point.clone(), hp: s.hp, seconds: s.seconds, damage: s.damage, attackEvery: s.attackEvery, range: s.range,
          color: GROVE_CSS.body, look: blossomLook,
        });
      }
    }
    if (!f.wither && t >= WITHER_T) {
      f.wither = true;
      this.blooms.forEach((b, i) => b.shed(0.4 + i * 0.03));
      this.vines.forEach((v, i) => v.wither(0.4, i * 0.03));
      this.roots.fade(0.3, 0);
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const verdantWardModule: EffectModule = {
  label: 'verdant ward',
  category: 'hero: grove',
  // The blossom is planted at the aim point (ground mode, like the clockwork turret).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new VerdantWard(),
  telegraphs(effect) {
    const e = effect as VerdantWard;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: SUMMON_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VerdantWard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as VerdantWard).settings;
    f.add(s, 'loop');
    f.add(s, 'hp', 10, 200, 5);
    f.add(s, 'seconds', 2, 12, 0.5);
    f.add(s, 'damage', 1, 40, 1);
    f.add(s, 'attackEvery', 0.4, 3, 0.1);
    f.add(s, 'range', 4, 12, 0.5);
  },
};
