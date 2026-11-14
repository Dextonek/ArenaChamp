import * as THREE from 'three';
import type { MinionLook, MinionPalette, MinionPose, MinionRig } from '../../effects/parts/minion';
import { gaitInfo } from '../../motion/clips';
import { HOLD, RealHero, realClipInfo, type Layer } from '../../motion/real';

/**
 * The Climb's enemies as models of their own (docs/tower/models/README.md, *Enemies*; the user, 2026-11-14: "make new ones also for
 * enemies, just make new, don't just reuse heroes"): figures of the fourth style built in Blender (blender/tower/<chapter>/<name>.py,
 * finished lighter: about 10,000 faces, five draw calls) and drawn from public/models/tower/<id>_v4.glb, moved by the pack's clips as
 * the heroes are. A model look is a `MinionLook` like the code-drawn ones (`looks.ts` `lookOf` picks it by the spec's `look`), so the
 * summon system, the packs, the tactics (which read the look's first word for a role) and the other players' copies are unchanged.
 *
 * - The file is parsed once (`RealHero` keeps it by its address) and each unit clones the skeleton. A unit that goes back to the pool
 *   gives its figure to a free list of that file, and the next unit of that file takes it: a pack that appears clones nothing it has
 *   cloned before.
 * - Until a figure has loaded and been posed, the unit shows the code look it replaces (`fallback`): a unit is never invisible and
 *   never stands in a T-pose. The floor's files are loaded when its fight begins (prewarm.ts), so that is rare.
 * - The pose: the idle, the walk or the jog by how fast the unit goes (paced to its size, so the feet do not slide), a hold on one
 *   arm (a staff, a shield), the strike clip timed so that its blow lands when the game's does (`swing` 1), the spell push or the
 *   throw when a shot leaves; a hit flash from the figure's own palette (the arena's flash drives `palette.body`); the death is the
 *   figure's puff, as before.
 * - `globalThis.__codeFoes = true` before a floor starts draws every enemy in code again (and every ruler as its stand-in hero): the A/B.
 */

export interface FoeModel {
  /** The model's file stem: `models/tower/<id>_v4.glb`. */
  id: string;
  /** How tall the figure stands before the unit's own scale (m): about the code look's height it replaces. */
  height: number;
  /** The blow: a blade (the pack's sword cuts), a heavy weapon swung over (`Sword_Attack`), fists, a hooking claw, a thrust (`Sword_Dash`). */
  strike?: 'blade' | 'heavy' | 'fist' | 'claw' | 'thrust';
  /** A shot: the spell push (a staff, a hand), an overhand throw (a sling, a net) or the right arm thrust at the victim (a crossbow aimed). */
  shot?: 'spell' | 'throw' | 'aim';
  /** What one arm holds whenever it does not strike: a staff upright in the left hand, a shield on the left arm, a lantern up in the right. */
  hold?: 'torch' | 'shield' | 'lantern';
  /** The `livery` material's colour (the War's two armies). */
  livery?: number;
  /** A colour laid over the whole figure, and how much (a named enemy that shares its kind's model). */
  tint?: [number, number];
  /** The health bar's height over the feet (m, before the unit's scale); default a little over `height`. */
  barY?: number;
}

const POOL = new Map<string, RealHero[]>();
let made = 0;
const URL_OF = (id: string) => `models/tower/${id}_v4.glb`;
/** The model figures stand this tall at their own size (the pack's body at 1.8 m, the game's figures drawn 1.3 times). */
const NATURAL = 1.8 * 1.3;

type Entry = { m: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color };
const ORIGINAL = new WeakMap<RealHero, THREE.Color[]>();

/** A free figure of that file, or a new one (which starts loading it). */
function take(id: string) {
  return POOL.get(id)?.pop() ?? new RealHero(URL_OF(id), 0.9);
}

function give(id: string, r: RealHero) {
  r.setFlash(0);
  r.root.removeFromParent();
  let list = POOL.get(id);
  if (!list) POOL.set(id, (list = []));
  if (list.length < 12) list.push(r);
}

/** Starts loading a model's file now (a floor's kinds, when its fight begins): resolves when it has loaded. */
export function preloadFoe(id: string): Promise<RealHero> {
  const r = take(id);
  return new Promise((ok) => {
    const t0 = performance.now();
    const wait = () => {
      if (r.loaded || performance.now() - t0 > 30000) ok(r);
      else setTimeout(wait, 50);
    };
    wait();
  });
}
/** Puts a figure that `preloadFoe` gave back in its file's pool. */
export const returnFoe = (id: string, r: RealHero) => give(id, r);

/** The materials of a loaded figure (RealHero keeps them, with the colours its flash goes back to). */
const entriesOf = (r: RealHero) => ((r as unknown as { mats?: Entry[] }).mats ?? []);

/** The model's own colours, with this look's livery and tint, as the colours the flash goes back to. */
function dress(r: RealHero, f: FoeModel) {
  const es = entriesOf(r);
  let orig = ORIGINAL.get(r);
  if (!orig) ORIGINAL.set(r, (orig = es.map((e) => e.color.clone())));
  const tint = f.tint ? new THREE.Color(f.tint[0]) : null;
  es.forEach((e, i) => {
    e.color.copy(orig![i]);
    if (f.livery !== undefined && e.m.name.endsWith('_livery')) e.color.set(f.livery).multiplyScalar(0.9);
    if (tint) e.color.lerp(tint, f.tint![1]);
    e.m.color.copy(e.color);
  });
  for (const o of meshesOf(r)) o.castShadow = false;
}

const meshesOf = (r: RealHero) => {
  const out: THREE.SkinnedMesh[] = [];
  r.root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh); });
  return out;
};
const CULLED = new WeakSet<RealHero>();
/**
 * Off-screen units are not drawn: three does not cull a skinned mesh by itself (RealHero leaves culling off), so each figure gets a
 * sphere measured on its first pose, half as big again for the reach of a blow.
 */
function cullable(r: RealHero) {
  if (CULLED.has(r)) return;
  CULLED.add(r);
  r.root.updateMatrixWorld(true);
  for (const m of meshesOf(r)) {
    m.computeBoundingSphere();
    if (m.boundingSphere) m.boundingSphere.radius *= 1.5;
    m.frustumCulled = true;
  }
}

const STRIKE: Record<NonNullable<FoeModel['strike']>, string[]> = {
  blade: ['Sword_Regular_A', 'Sword_Regular_B'], heavy: ['Sword_Attack'], fist: ['Punch_Jab', 'Punch_Cross'], claw: ['Melee_Hook'], thrust: ['Sword_Dash'],
};
/** How long a blow's end plays on after it lands, and a shot's (s). */
const TAIL = 0.4;
const SHOT_LEAD = 0.18;

/**
 * A `MinionLook` drawn from a model. `fallback` is the code look shown until the model is ready; `speed` the unit's walking speed
 * (m/s) and `scale` its spec's scale, for the stride.
 */
export function modelLook(f: FoeModel, fallback: MinionLook, unit: { speed: number; scale?: number }): MinionLook {
  return (kind, p: MinionPalette): MinionRig => {
    const hero = take(f.id);
    // The code look only while the file is still loading (a figure from the pool is ready at once: nothing else is built).
    const code = hero.loaded ? null : fallback(kind, p);
    const root = new THREE.Group();
    const holder = new THREE.Group();
    holder.scale.setScalar(f.height / NATURAL);
    holder.visible = false;
    if (code) root.add(code.root);
    root.add(holder);
    holder.add(hero.root);
    hero.root.position.set(0, 0, 0);
    hero.root.rotation.set(0, 0, 0);
    // Out of step with the pack's others, without `Math.random` (the perf scenes and the route bot replay a seeded one).
    const k0 = (made++ * 0.618034) % 1;
    let dressed = false, posed = 0, clock = k0 * 4, phase = k0, gait = 0;
    let lastSwing = -1, after = -1, which = 0, shotT = -1, lastShot = 0;
    const strikes = STRIKE[f.strike ?? 'blade'];
    const hold = f.hold ? HOLD[f.hold] : null;
    const layers: Layer[] = [];
    const flashTint = new THREE.Color();
    const all = (clip: string, t: number, loop: boolean, w: number) => { if (w > 0.001) layers.push({ clip, t, loop, legs: w, torso: w, armR: w, armL: w }); };
    const over = (clip: string, t: number, upper: number, legs: number) => {
      if (upper <= 0.001 && legs <= 0.001) return;
      for (const l of layers) {
        l.legs = (l.legs ?? 0) * (1 - legs);
        l.torso = (l.torso ?? 0) * (1 - upper);
        l.armR = (l.armR ?? 0) * (1 - upper);
        l.armL = (l.armL ?? 0) * (1 - upper);
      }
      layers.push({ clip, t, loop: false, legs, torso: upper, armR: upper, armL: upper });
    };
    const rig: MinionRig = {
      root,
      barY: f.barY ?? f.height + 0.15,
      animate(dt: number, pose: MinionPose) {
        if (!hero.loaded) {
          code?.animate(dt, pose);
          return;
        }
        if (!dressed) { dress(hero, f); dressed = true; }
        clock += dt;
        // the walk: idle, walk and jog on one stride, paced by how fast the unit goes for its size
        gait += (pose.walk - gait) * Math.min(1, dt * 8);
        const size = (f.height / NATURAL) * (unit.scale ?? 1) * hero.legLength * 1.3;
        const legSpeed = (unit.speed * pose.walk) / Math.max(0.2, size);
        const gw = gaitInfo('Walk_Loop'), gj = gaitInfo('Jog_Fwd_Loop');
        const jog = Math.min(1, Math.max(0, (legSpeed - gw.speed) / (gj.speed - gw.speed)));
        const dur = (1 - jog) * gw.dur + jog * gj.dur, carried = (1 - jog) * gw.speed + jog * gj.speed;
        phase += (dt * Math.min(1.6, Math.max(0.5, legSpeed / Math.max(0.1, carried)))) / dur;
        layers.length = 0;
        all('Idle_Loop', clock, true, 1 - gait);
        all('Walk_Loop', gw.leftFwd + phase * gw.dur, true, gait * (1 - jog));
        all('Jog_Fwd_Loop', gj.leftFwd + phase * gj.dur, true, gait * jog);
        if (hold) {
          for (const l of layers) l[hold[1]] = 0;
          layers.push({ clip: hold[0], t: clock, loop: true, [hold[1]]: 1 });
        }
        // the blow: up to the clip's hit as the swing goes 0 to 1, then its end
        if (pose.swing >= 0 && lastSwing < 0) which = (which + 1) % strikes.length;
        if (pose.swing < 0 && lastSwing >= 0) after = 0;
        lastSwing = pose.swing;
        const clip = strikes[which], info = realClipInfo(clip);
        if (pose.swing >= 0) {
          const lead = Math.min(info.hit, 0.55);
          over(clip, info.hit - lead * (1 - pose.swing), 1, (1 - gait) * info.legs);
        } else if (after >= 0) {
          after += dt;
          const w = 1 - after / TAIL;
          if (w <= 0) after = -1;
          else over(clip, info.hit + Math.min(info.dur - info.hit, TAIL) * (after / TAIL), w, w * (1 - gait) * info.legs);
        }
        // a shot: the push (or the throw) from a little before its release through its end
        if (pose.shot > lastShot + 0.3) shotT = 0;
        lastShot = pose.shot;
        if (shotT >= 0) {
          shotT += dt;
          const sc = f.shot === 'throw' ? 'OverhandThrow' : f.shot === 'aim' ? 'Punch_Jab' : 'Spell_Simple_Shoot', si = realClipInfo(sc);
          const t = si.hit - SHOT_LEAD + shotT, w = Math.min(1, 1.6 - shotT / 0.45);
          if (w <= 0 || t > si.dur) shotT = -1;
          else over(sc, t, w, w * (1 - gait) * si.legs);
        }
        hero.pose(layers);
        // the hit flash: the arena drives the palette's body (tinted or white); the figure's materials follow it
        const e = p.body.emissive, k = Math.max(e.r, e.g, e.b);
        if (k > 0.01) {
          flashTint.setRGB(e.r / k, e.g / k, e.b / k);
          hero.setFlash(Math.min(1, k / 0.45), k > 1.2 ? undefined : flashTint);
        } else hero.setFlash(0);
        // Shown once posed (a figure is never drawn in its T-pose); the code look goes then.
        if (posed < 2 && ++posed >= 2) {
          cullable(hero);
          holder.visible = true;
          if (code) code.root.visible = false;
        }
      },
      dispose() {
        code?.dispose?.();
        give(f.id, hero);
      },
    };
    return rig;
  };
}
