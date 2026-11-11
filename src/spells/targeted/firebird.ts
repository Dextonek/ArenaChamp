import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BIRD_HEAD, FeatherFlock, FireBird, PHOENIX, PHOENIX_CSS, nestLook, softDisc } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';
import { BIRD_AIR, BIRD_DAMAGE, BIRD_LENGTH, BIRD_WIDTH, BIRD_WIND, STAMP_R, emberLive, layEmber } from '../../traits/phoenix';

/**
 * Firebird (phoenix kit, R: the ultimate). Anka spreads wings of fire for 1.0 s, rooted, while the lane shows: 12 m along
 * the aim from her feet, 3 m wide. Then she crosses it as a great firebird in 0.5 s (`ctx.moveCaster`) and lands at its far
 * end (or where the ring or a wall stops her). Everyone the bird's front passes inside the lane, on their LIVE position,
 * takes 120, once. An ember is left where she took off and becomes her nest (`layEmber`, both screens), so Ember Flight can
 * take her back. The lane is the telegraph (impact 1.0 s, until 1.5 s) and the hit shape: 1.5 m to the side takes 0.63 s
 * with a reaction, and she warns 1.0 s. Under the gameplay camera, no cinematic. Clean by 2.4 s.
 * Network duels: the other screen has no `moveCaster` (her client streams the move); the lane is built from `sentFrom`.
 *
 * The look, the biggest of her four. The wind-up (0-1.0): a great firebird forms over her out of small feathers and grows,
 * head and long neck toward the aim, a three-feather crest, two wings in rows (red primaries with gold tips, flame coverts)
 * that spread and rise high over her, a train of five long tail feathers with eyes; a pool of gold light lies under her.
 * On the floor the lane's two edges are laid in feathers, one after another from her feet to its far end, over a faint wash
 * of flame (their tips stay inside the 3 m). For the last fifth it holds, drawn back: the dead beat. The take-off (1.0):
 * one impact frame in gold, a star, a ring of force, feathers flung up where she stood. The flight (1.0-1.5): the bird,
 * about 6 m from wing tip to wing tip and 2 to 3 m up, crosses the lane with her as its head (its beak just ahead of her,
 * never behind the hit's front, so a hit lands as its wings and train pass over), beating its wings twice, shedding a short
 * trail of falling feathers and blowing the lane's edge feathers away as it passes. The end (1.5):
 * it bursts into feathers where she lands; they are down by 2.3 s.
 * Timeline: wind-up 0-1.0 (dead beat from 0.78), take-off 1.0, flight to 1.5, feathers settle, clean by 2.4 s.
 * Without a trait (the VFX tool) the effect shows the nest she leaves at the take-off itself.
 */
export interface FirebirdSettings {
  damage: number;
  loop: boolean;
}

export const defaultFirebird = (): FirebirdSettings => ({ damage: BIRD_DAMAGE, loop: false });

const GO_T = BIRD_WIND;
const END_T = GO_T + BIRD_AIR;
const DURATION = END_T + 0.9;
// The look only.
const BIRD_S = 0.8; // the bird's size: about 6 m from wing tip to wing tip
const HEAD = BIRD_HEAD * BIRD_S; // its beak, ahead of its middle
const EDGE = 14; // feathers along each edge of the lane
const EDGE_X = 1.0; // their quills, this far from the lane's middle (their tips reach its edge)
const UP = new THREE.Vector3(0, 1, 0);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class Firebird implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FirebirdSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly from = new THREE.Vector3();
  readonly dir = new THREE.Vector3(0, 0, -1);
  private end = new THREE.Vector3();
  private reach = BIRD_LENGTH;
  private time = 0;
  private gone = false;
  private struck = new Set<Enemy>();

  // The look.
  readonly screen = createScreenFx();
  private left = new THREE.Vector3(1, 0, 0);
  /** No trait draws the embers on this screen (the VFX tool): the effect shows the nest she leaves itself. */
  private own = false;
  private offDone = false;
  private endDone = false;
  private shed = 0;
  private blown: boolean[] = new Array(EDGE * 2).fill(false);
  private birdPos = new THREE.Vector3();
  private lane = new THREE.Mesh(new THREE.PlaneGeometry(BIRD_WIDTH, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PHOENIX.body, transparent: true, opacity: 0, depthWrite: false }));
  private glow = softDisc(2, PHOENIX.hot, 0, 0.04, 3);
  private bird = new FireBird();
  private plumes = new FeatherFlock('eye', 170);
  private flames = new FeatherFlock('flame', 230);
  private star = new StarBurst({ points: 12, inner: 0.28, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
  private endStar = new StarBurst({ points: 9, inner: 0.3, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private local: THREE.Object3D | null = null;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: FirebirdSettings = defaultFirebird()) {
    this.settings = settings;
    this.lane.renderOrder = 2;
    this.lane.frustumCulled = false;
    this.screen.impactColor.set(PHOENIX.hot);
    this.screen.edgeTint.set(PHOENIX.body);
    this.group.add(this.lane, this.glow, this.bird.mesh, this.plumes.mesh, this.flames.mesh, this.star.mesh, this.endStar.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GO_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.end.copy(this.from).addScaledVector(this.dir, BIRD_LENGTH);
    this.reach = BIRD_LENGTH;
    // The look: her left, the figures an impact frame cuts out, and whether the nest she leaves is ours to draw.
    this.left.set(this.dir.z, 0, -this.dir.x);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.5);
    this.own = !emberLive(ctx.caster);
    if (this.own && !this.local) {
      this.local = nestLook(STAMP_R);
      this.local.visible = false;
      this.group.add(this.local);
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.gone = false;
    this.struck.clear();
    this.offDone = false;
    this.endDone = false;
    this.shed = 0;
    this.blown.fill(false);
    clearScreenFx(this.screen);
    this.plumes.reset();
    this.flames.reset();
    this.bird.hide();
    this.lane.visible = this.glow.visible = false;
    if (this.local) this.local.visible = false;
    this.star.set(this.from, 0, 0);
    this.endStar.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  /**
   * The lane's two edges, laid in feathers from her feet out to `reveal` m, pointing down the lane with their tips on its
   * edge. Once the bird's middle (`front` m along the lane; -1 before it flies) has passed one, it is blown away. `fade` shrinks
   * what is left.
   */
  private drawEdges(reveal: number, front: number, t: number, fade = 1) {
    for (let j = 0; j < EDGE; j++) {
      for (let s = 0; s < 2; s++) {
        const idx = j * 2 + s, sd = s ? -1 : 1;
        const along = 0.5 + ((j + 0.6 * hash(idx + 1)) * (BIRD_LENGTH - 1.6)) / EDGE;
        if (along > reveal || this.blown[idx]) continue;
        const flame = (j + s) % 2 === 1;
        const size = (0.85 + 0.25 * hash(idx + 7)) * Math.min(1, (reveal - along) / 1.2) * fade * (flame ? 1 + 0.1 * Math.sin(t * 12 + idx) : 1);
        this.v1.copy(this.from).addScaledVector(this.dir, along).addScaledVector(this.left, sd * EDGE_X).setY(0.08);
        if (front >= 0 && along < front + 0.8) {
          this.blown[idx] = true;
          (flame ? this.flames : this.plumes).burst(this.v1.setY(0.3), 1, 4, size * 0.85, 0.5);
          continue;
        }
        this.v2.copy(this.dir).addScaledVector(this.left, sd * 0.32).addScaledVector(UP, 0.1);
        (flame ? this.flames : this.plumes).put(this.v1, this.v2, size, sd * 0.25, 1.15);
      }
    }
  }

  private takeOff() {
    const ctx = this.ctx;
    if (!ctx) return;
    // The ember where she took off: her nest, and the way back.
    layEmber(ctx.caster, this.from.x, this.from.z);
    if (ctx.moveCaster) {
      this.end.copy(ctx.moveCaster(this.end, BIRD_AIR)).setY(0);
      this.reach = Math.max(0.5, this.end.distanceTo(this.from));
    }
    this.shake = 0.3;
  }

  /** The bird's front is `front` m along the lane: everyone it has passed inside the lane is struck, once. */
  private sweep(front: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const en of ctx.enemies?.() ?? ctx.targets) {
      if (this.struck.has(en)) continue;
      const dx = en.group.position.x - this.from.x, dz = en.group.position.z - this.from.z;
      const along = dx * this.dir.x + dz * this.dir.z;
      const perp = Math.abs(dx * this.dir.z - dz * this.dir.x);
      if (along < 0 || along > Math.min(front, BIRD_LENGTH) || perp > BIRD_WIDTH / 2) continue;
      this.struck.add(en);
      ctx.hit(en, { damage: this.settings.damage, knock: 5, from: this.from.clone(), color: PHOENIX_CSS.body });
      this.shake = 0.5;
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.plumes.update(dt);
    this.flames.update(dt);
    this.time += dt;
    const t = this.time;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const mat = this.lane.material as THREE.MeshBasicMaterial;
    // the lane on the floor: a faint wash of flame between its two edges of feathers
    this.lane.visible = t < END_T + 0.3;
    this.lane.position.copy(this.from).addScaledVector(this.dir, BIRD_LENGTH / 2).setY(0.03);
    this.lane.rotation.y = yaw;
    this.lane.scale.set(1, 1, BIRD_LENGTH);
    mat.opacity = t < GO_T ? 0.06 + 0.16 * (t / GO_T) : 0.22 * Math.max(0, 1 - (t - GO_T) / (BIRD_AIR + 0.3));

    if (!this.gone && t >= GO_T) {
      this.gone = true;
      this.takeOff();
    }
    if (t < GO_T) {
      // The wind-up: the firebird forms over her and grows, its wings spread and rise; for the last fifth it holds, drawn back.
      const k = t / GO_T;
      const form = easeOut(k / 0.7), hold = smoothstep((k - 0.78) / 0.22);
      this.birdPos.copy(this.from).addScaledVector(this.dir, 1.2 - HEAD - 0.5 * hold).setY(2.0 + 0.8 * form);
      this.bird.pose(this.plumes, this.flames, this.birdPos, yaw, {
        scale: BIRD_S * (0.35 + 0.65 * form), spread: easeOut(k / 0.6), flap: 0.3 + 0.5 * form + 0.05 * Math.sin(t * 10), time: t, grow: easeOut(k / 0.35),
      });
      this.drawEdges(k * 1.25 * BIRD_LENGTH, -1, t);
      // a pool of gold light under her
      this.glow.visible = true;
      this.glow.position.set(this.from.x, 0.04, this.from.z);
      this.glow.scale.setScalar(0.6 + 0.4 * form);
      (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.3 * k;
    } else {
      const k = Math.min(1, (t - GO_T) / BIRD_AIR);
      const front = k * this.reach;
      // The flight: she is the bird's head. Her slide is fast at first and slows in (the engine's dash) while the hit's front
      // runs evenly, so the beak leads with her, never behind the hit's front, and the hit lands as its wings and train pass.
      // It dips over the lane and beats its wings twice.
      const p = this.ctx ? this.ctx.caster.group.position : this.from;
      const her = THREE.MathUtils.clamp((p.x - this.from.x) * this.dir.x + (p.z - this.from.z) * this.dir.z, 0, BIRD_LENGTH);
      const beak = Math.max(her + 0.6, Math.min(front + 1.2, BIRD_LENGTH));
      const a = t - END_T, grow = a <= 0 ? 1 : 1 - smoothstep(a / 0.2);
      this.birdPos.copy(this.from).addScaledVector(this.dir, beak - HEAD).setY(2.8 - 0.6 * Math.sin(Math.PI * k));
      if (grow > 0.02) {
        this.bird.pose(this.plumes, this.flames, this.birdPos, yaw, {
          scale: BIRD_S * (1 + 0.1 * Math.sin(Math.PI * k)), spread: 1, flap: 0.15 + 0.65 * Math.cos(k * Math.PI * 4), time: t, grow,
        });
      } else this.bird.hide();
      this.drawEdges(BIRD_LENGTH, beak - HEAD, t, grow);
      if (a < 0) {
        // a short trail of feathers falls from its wings and train
        this.shed += dt;
        while (this.shed > 0.014) {
          this.shed -= 0.014;
          const n = Math.random() < 0.3 ? 0 : 1;
          this.v1.copy(this.birdPos).addScaledVector(this.dir, -1.2 - Math.random() * 1.6).addScaledVector(this.left, (Math.random() - 0.5) * 4.4);
          (n === 0 ? this.plumes : this.flames).fall(this.v1, 1, 0.3, 0.6, 0.6, this.v2.copy(this.dir).multiplyScalar(8));
        }
      }
      // the take-off: a star and a ring of force where she stood, feathers flung up (the impact frame is the screen's)
      const b = t - GO_T, q = Math.min(1, b / 0.4);
      if (!this.offDone) {
        this.offDone = true;
        this.flames.burst(this.v1.set(this.from.x, 0.8, this.from.z), 14, 5, 0.55, 0.5);
        this.plumes.burst(this.v1, 5, 4, 0.6, 0.55);
      }
      const sp = StarBurst.pop(b, 0.04, 0.12);
      this.star.set(this.v1.set(this.from.x, 1.6, this.from.z), 2.0 * sp.scale + 1e-3, sp.opacity, b * 3);
      this.shock.set(this.v1.set(this.from.x, 0, this.from.z), 0.5 + 4 * q, 0.06 * (1 - q) * (1 - q));
      this.glow.visible = b < 0.3;
      (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.max(0, 1 - b / 0.3);
      // the end: it bursts into feathers where she lands
      if (a >= 0 && !this.endDone) {
        this.endDone = true;
        this.flames.burst(this.birdPos, 26, 5, 0.6, 0.7);
        this.plumes.burst(this.birdPos, 12, 4.5, 0.7, 0.75);
      }
      const ep = StarBurst.pop(a, 0.03, 0.1);
      this.endStar.set(this.v1.copy(this.birdPos).addScaledVector(this.dir, HEAD * 0.5), 1.4 * ep.scale + 1e-3, ep.opacity, a * 3);
      // The hit follows the beak as it is drawn (her live position leads the even front early in the slide), so what
      // is seen passing is what strikes.
      if (t <= END_T + 0.05) this.sweep(beak);
    }
    // One short impact frame at the take-off, in gold, and a pulse at the screen's edges.
    this.screen.impact = impactFrameAt(t, GO_T, [2], 0.04);
    this.screen.chroma = chromaPulse(t, GO_T, 0.45, 9);
    if (this.local) {
      // the nest she leaves, where no trait draws it (the VFX tool)
      const left = DURATION - t;
      this.local.visible = this.own && this.gone;
      this.local.position.set(this.from.x, 0.02, this.from.z);
      this.local.scale.setScalar(Math.max(left < 0.3 ? left / 0.3 : Math.min(1, 0.4 + (t - GO_T) * 3), 1e-4));
    }
    this.shake *= 0.88;
  }
}

export const firebirdModule: EffectModule = {
  label: 'firebird',
  category: 'hero: phoenix',
  // A line: the aim point only gives the direction (she crosses the 12 m wherever the cursor is).
  targeting: { mode: 'ground', radius: BIRD_WIDTH / 2 },
  create: () => new Firebird(),
  telegraphs(effect) {
    const e = effect as Firebird;
    if (!e.ctx) return [];
    const a = e.from, d = e.dir;
    // The real shape: the lane. She is rooted until she takes off.
    return [{
      shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + d.x * BIRD_LENGTH, z2: a.z + d.z * BIRD_LENGTH, width: BIRD_WIDTH },
      start: 0.04, impact: GO_T, until: END_T,
    }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.45, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as Firebird;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as Firebird).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
