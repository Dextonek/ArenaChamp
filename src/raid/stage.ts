import * as THREE from 'three';
import { seeded } from '../arenas/common';
import type { MinionLook } from '../effects/parts/minion';
import type { CastStyle } from '../heroFigure';
import { FallingStone, ShadowFloor } from './fx';
import { STAND_COLOR } from './script';
import type { BossCast, BossMove, Objective, PlayContext, PlayedMove, RaidAdd, Threat } from './types';

/**
 * A stage (pipeline/designs/raid-noonfall.md, "Stages, enrage, soak and summons"): halfway down, the boss stands apart where it
 * can't be hurt and calls three adds. They stand still and shoot at the heroes, one hero and then the other. Kill all three before
 * its cast bar fills and the boss falls to its knees; if not, a blow over the whole floor. One move does all of it, and both
 * screens play it from its casts: the adds stand where the seed puts them, each add's HP is per screen with the hits passed on, and
 * the first screen that sees one die says so (an objective), so both agree.
 */

/** How long a stage lasts at tier 1 (s): its cast bar fills over it, and then it fails. */
export const STAGE_S = 32;
/** When the adds shoot, from the stage's start (s, tier 1). */
const SHOTS = [5, 8.5, 12, 15.5, 19, 22.5, 26, 29];
/** An add's HP, as a share of the boss's max. */
const ADD_SHARE = 0.035;
/** What one add's shot costs. */
const SHOT_SHARE = 0.07;
const BEAM_WIDTH = 1.3;
const LOB_RADIUS = 1.7;

export interface StageSpec {
  id: string;
  name: string;
  pose: CastStyle;
  /** Where the boss waits it out, and the light round it there. */
  hold: { x: number; z: number };
  shell: { radius: number; y: number; color: THREE.ColorRepresentation };
  /** The middle of the room, how far out the adds stand, and the turns (degrees, 0 the south) they may stand at: the seed picks a set. */
  center: { x: number; z: number };
  ring: number;
  turns: number[][];
  look: MinionLook;
  color: string;
  /** How they shoot: a beam from each add through the hero, or a lob that lands round the hero. */
  shot: 'beam' | 'lob';
  shotColor: THREE.ColorRepresentation;
  /** If any add still stands when it runs out: what the whole floor costs, whether cover from the boss saves, and the words. */
  fail: { share: number; cover: boolean; radius: number; text: string };
  win: string;
  hint: string;
}

/** The adds of each stage on this screen, by the cast's seed: its later steps shoot from those still standing. */
const standing = new Map<number, RaidAdd[]>();
const shellGeo = new THREE.SphereGeometry(1, 32, 16);

export function stageMove(s: StageSpec): BossMove {
  return {
    id: s.id, name: s.name, charge: STAGE_S, lock: STAGE_S, cooldown: 999, stage: true, spread: true, big: true, pose: s.pose,
    steps: [0, ...SHOTS],
    aim: (c) => (c.step === 0
      ? { x: s.hold.x, z: s.hold.z, dir: Math.atan2(s.center.x - s.hold.x, s.center.z - s.hold.z) }
      : { x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) }),
    act: (world, c) => { if (c.step === 0) world.dash(s.hold.x, s.hold.z, 0.9); },
    play: (c, p) => (c.step === 0 ? open(s, c, p) : shoot(s, c, p)),
  };
}

/** The stage begins: the adds, the light that keeps the boss safe, and the blow waiting at its end. */
function open(s: StageSpec, c: BossCast, p: PlayContext): PlayedMove {
  const end = p.shown(STAGE_S), show = Math.max(0, end - 4);
  const rng = seeded(c.seed);
  const turns = s.turns[Math.floor(rng() * s.turns.length)];
  const hp = Math.max(40, Math.round(p.bossMax * ADD_SHARE));
  const objectives: Objective[] = [], adds: RaidAdd[] = [];
  turns.forEach((deg, part) => {
    const a = THREE.MathUtils.degToRad(deg), x = s.center.x + Math.sin(a) * s.ring, z = s.center.z + Math.cos(a) * s.ring;
    const o: Objective = { part, x, z, radius: 0, kill: true, until: end };
    objectives.push(o);
    adds.push(p.spawnAdd({
      x, z, hp, look: s.look, color: s.color,
      hurt: (n) => p.addHit(c.id, part, n),
      died: () => {
        if (o.done || o.reported) return;
        o.reported = true;
        p.report(c.id, part);
      },
    }));
  });
  standing.set(c.seed, adds);
  p.guard(end + 0.5);
  p.hint(s.hint);
  const source = s.fail.cover ? { x: s.hold.x, z: s.hold.z } : undefined;
  const fail: Threat = { shape: { kind: 'circle', x: s.center.x, z: s.center.z, radius: s.fail.radius }, at: end, show, share: s.fail.share, source, look: 2.6 };
  const shadows = source ? new ShadowFloor(source, () => p.cover(), STAND_COLOR, s.fail.radius - 1) : null;
  const mat = new THREE.MeshBasicMaterial({ color: s.shell.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const shell = new THREE.Mesh(shellGeo, mat);
  shell.scale.setScalar(s.shell.radius);
  shell.position.set(s.hold.x, s.shell.y, s.hold.z);
  p.group.add(shell);
  if (shadows) p.group.add(shadows.mesh);
  let won = false, fell = false, guarded = true;
  const unguard = () => {
    if (!guarded) return;
    guarded = false;
    p.guard(0);
  };
  return {
    threats: [fail], objectives, duration: end + 1.2,
    look: {
      update(t) {
        const on = won || fell ? Math.max(0, mat.opacity - 0.02) : Math.min(1, t / 0.6) * (0.05 + 0.02 * Math.sin(t * 3));
        mat.opacity = on;
        shell.rotation.y = t * 0.4;
        if (shadows) shadows.update(t, won || t < show ? 0 : t < end ? 0.2 + 0.35 * ((t - show) / Math.max(0.1, end - show)) : Math.max(0, 0.55 * (1 - (t - end) * 2)));
      },
      hurt(part, amount) {
        adds[part]?.hurt(amount);
      },
      done(o) {
        adds[o.part]?.slay();
        if (won || fell || objectives.some((x) => !x.done)) return;
        // All three down: the boss falls to its knees (the reward), and what was still to land is off.
        won = true;
        p.cancel(c.id);
        unguard();
        p.reward(s.id, c.id);
        p.flash('rgba(255,236,190,0.8)', 0.35);
        p.say(s.win, '#ffe27a', s.hold.x, s.hold.z);
        p.sparks.emit(s.hold.x, s.shell.y, s.hold.z, 60, 6, 3, 1, s.shotColor);
      },
      land() {
        fell = true;
        for (const a of adds) {
          if (!a.alive) continue;
          p.sparks.emit(a.x, 0.8, a.z, 24, 4, 4, 0.8, s.shotColor);
          a.remove();
        }
        p.flash('rgba(255,150,70,0.85)', 0.55);
        p.say(s.fail.text, '#ff9a6a', s.center.x, s.center.z);
        unguard();
      },
      dispose() {
        for (const a of adds) a.remove();
        standing.delete(c.seed);
        shell.removeFromParent();
        mat.dispose();
        shadows?.dispose();
        unguard();
      },
    },
  };
}

/** One volley: every add still standing shoots at where the hero this step aims at stood. */
function shoot(s: StageSpec, c: BossCast, p: PlayContext): PlayedMove {
  const all = standing.get(c.seed) ?? [];
  const at = p.shown(1.5);
  // The rolls go by the add's place in the stage, standing or not, so one screen that saw an add die first draws the rest the same.
  const rng = seeded(c.seed + c.step * 7919);
  const threats: Threat[] = [];
  const stones: FallingStone[] = [];
  all.forEach((a, part) => {
    // A lob: the first at the hero, the others round it but clear of it, a moment apart. Step out of the first, not into the next.
    const turn = rng() * Math.PI * 2, off = part === 0 ? 0 : LOB_RADIUS + 0.6 + rng() * 0.9;
    if (!a.alive) return;
    if (s.shot === 'beam') {
      const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 1, far = d + 3;
      threats.push({ shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + (dx / d) * far, z2: a.z + (dz / d) * far, width: BEAM_WIDTH }, at, share: SHOT_SHARE, part });
      return;
    }
    const x = c.x + Math.sin(turn) * off, z = c.z + Math.cos(turn) * off, when = at + part * 0.3;
    threats.push({ shape: { kind: 'circle', x, z, radius: LOB_RADIUS }, at: when, share: SHOT_SHARE, part });
    const stone = new FallingStone(x, z, LOB_RADIUS * 0.6, when);
    p.group.add(stone.mesh);
    stones.push(stone);
  });
  if (!threats.length) return { threats, duration: 0.1 };
  return {
    threats, duration: at + 1.4,
    look: {
      update(t) {
        for (const st of stones) st.update(t);
      },
      land(th) {
        const sh = th.shape;
        if (sh.kind === 'line') {
          for (let k = 1; k <= 6; k++) {
            const f = k / 6, x = sh.x1 + (sh.x2 - sh.x1) * f, z = sh.z1 + (sh.z2 - sh.z1) * f;
            p.sparks.emit(x, 0.9, z, 4, 3, 2.5, 0.5, s.shotColor);
          }
          p.glows.flash(sh.x2, sh.z2, 1.6, s.shotColor, 0.4, 0.3);
        } else if (sh.kind === 'circle') {
          p.sparks.emit(sh.x, 0.3, sh.z, 18, 4, 3.5, 0.7, s.shotColor);
          p.glows.flash(sh.x, sh.z, sh.radius + 0.3, s.shotColor, 0.5, 0.4);
        }
      },
      dispose() {
        for (const st of stones) st.mesh.removeFromParent();
      },
    },
  };
}
