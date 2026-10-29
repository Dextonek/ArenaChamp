import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { SummonKind } from '../../effects/summon';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Summon tests (mechanics): a short ground circle where the spell lands, then `ctx.summon` makes the units. Melee units
 * walk up and hit, ranged units keep their distance and shoot dodgeable bolts, a turret stands and shoots. The units,
 * their HP bars, their attacks and their death puff all come from the engine (`effects/summon.ts`, `parts/minion.ts`);
 * this effect only draws the circle. Tools for checking summons, not hero spells.
 */
export interface SummonTestSettings {
  count: number;
  hp: number;
  seconds: number;
  damage: number;
  attackEvery: number;
  range: number;
}

interface SummonTestConfig extends SummonTestSettings {
  label: string;
  kind: SummonKind;
  /** The units' colour (css). */
  color: string;
}

const WINDUP = 0.35;
const DURATION = 1.0;
const MOTES = 7;

export class SummonTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SummonTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private done = false;
  private at = new THREE.Vector3();
  private ring: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private motes: { mesh: THREE.Mesh; a: number; r: number }[] = [];

  constructor(private cfg: SummonTestConfig) {
    this.settings = { count: cfg.count, hp: cfg.hp, seconds: cfg.seconds, damage: cfg.damage, attackEvery: cfg.attackEvery, range: cfg.range };
    this.mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), this.mat);
    this.ring.visible = false;
    this.group.add(this.ring);
    const moteGeo = new THREE.OctahedronGeometry(0.09, 0);
    for (let i = 0; i < MOTES; i++) {
      const mesh = new THREE.Mesh(moteGeo, this.mat);
      mesh.visible = false;
      this.motes.push({ mesh, a: (i / MOTES) * Math.PI * 2, r: 0.55 + (i % 3) * 0.2 });
      this.group.add(mesh);
    }
  }

  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.at.copy(ctx.point).setY(0);
  }

  play() {
    this.time = 0;
    this.done = false;
    this.playing = true;
    this.ring.visible = true;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (!this.done && this.time >= WINDUP) {
      this.done = true;
      const s = this.settings;
      // A network duel has no summons (the context leaves `summon` out): the spell then shows only the circle.
      this.ctx?.summon?.({
        kind: this.cfg.kind, at: this.at.clone(), count: Math.round(s.count), hp: s.hp, seconds: s.seconds, damage: s.damage,
        attackEvery: s.attackEvery, range: s.range, color: this.cfg.color,
      });
    }
    if (this.time >= DURATION) {
      this.playing = false;
      this.ring.visible = false;
      for (const m of this.motes) m.mesh.visible = false;
      return;
    }
    const k = this.time / DURATION;
    this.ring.position.set(this.at.x, 0.06, this.at.z);
    this.ring.scale.setScalar(0.8 + 1.1 * (1 - (1 - k) ** 2));
    this.mat.opacity = 0.85 * (1 - k * k);
    for (const m of this.motes) {
      m.mesh.visible = true;
      m.mesh.position.set(this.at.x + Math.cos(m.a + k * 3) * m.r, 0.1 + k * 1.4 * (0.6 + m.r), this.at.z + Math.sin(m.a + k * 3) * m.r);
      m.mesh.scale.setScalar(Math.max(0.01, 1 - k));
      m.mesh.rotation.y += dt * 4;
    }
  }
}

function makeModule(cfg: SummonTestConfig): EffectModule {
  return {
    label: cfg.label,
    category: 'test: mechanics',
    // The units appear at the aimed spot; `radius` only sizes the aim marker.
    targeting: { mode: 'ground', radius: 1.5 },
    create: () => new SummonTest(cfg),
    bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
    frameCamera(camera, controls, effect) {
      const e = effect as SummonTest;
      if (e.ctx) frameCast(camera, controls, e.ctx, 3);
    },
    buildGui(f, effect) {
      const s = (effect as SummonTest).settings;
      f.add(s, 'count', 1, 6, 1);
      f.add(s, 'hp', 10, 400, 5);
      f.add(s, 'seconds', 2, 20, 0.5);
      f.add(s, 'damage', 1, 60, 1);
      f.add(s, 'attackEvery', 0.3, 4, 0.1);
      f.add(s, 'range', 3, 14, 0.5);
    },
  };
}

export const summonMeleeTestModule = makeModule({
  label: 'summon melee test', kind: 'melee', color: '#8fb4e8', count: 2, hp: 40, seconds: 6, damage: 6, attackEvery: 1, range: 0,
});

export const summonRangedTestModule = makeModule({
  label: 'summon ranged test', kind: 'ranged', color: '#c49cff', count: 2, hp: 35, seconds: 6, damage: 8, attackEvery: 1.5, range: 9,
});

export const turretTestModule = makeModule({
  label: 'turret test', kind: 'turret', color: '#e8c86a', count: 1, hp: 80, seconds: 6, damage: 10, attackEvery: 1.4, range: 8,
});
