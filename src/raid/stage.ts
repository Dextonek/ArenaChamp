import * as THREE from 'three';
import { seeded } from '../arenas/common';
import type { MinionLook } from '../effects/parts/minion';
import type { CastStyle } from '../heroFigure';
import { ShadowFloor } from './fx';
import { Shell } from './fxShow';
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
export const STAGE_S = 30;
/** When the adds shoot, from the stage's start (s, tier 1). */
const SHOTS = [5, 8.5, 12, 15.5, 19, 22.5, 26, 29];
/** An add's HP, as a share of the boss's max. */
const ADD_SHARE = 0.035;
/** What one add's shot costs. */
const SHOT_SHARE = 0.08;
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
  /**
   * If any add still stands when it runs out: what the whole floor costs, whether cover from the boss saves, the words, and how it looks:
   * a flare of light from the boss along the floor, or a geyser out of the vent throwing lava everywhere.
   */
  fail: { share: number; cover: boolean; radius: number; text: string; blast: 'flare' | 'geyser' };
  win: string;
  hint: string;
}

/** The adds of each stage on this screen, by the cast's seed: its later steps shoot from those still standing. */
const standing = new Map<number, RaidAdd[]>();
/** Where an add's shot leaves from: its eye, its heart. */
const SHOT_Y = { beam: 1.9, lob: 1.35 };
const WHITE = 0xfff4e0;
const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();

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
  const end = p.shown(STAGE_S), warn = Math.max(0, end - 4);
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
  // The call: the boss goes up in a column of its light, a shockwave runs over the floor, and each add rises out of a column of its own.
  const fx = p.show;
  fx.column(s.hold.x, s.hold.z, { radius: s.shell.radius * 0.8, height: 16, life: 1.6, color: s.shell.color, peak: 0.7 });
  // Warm white, not gold: gold on the floor means a zone to stand in.
  fx.ring(s.hold.x, s.hold.z, { radius: 20, life: 1.6, color: s.fail.blast === 'flare' ? 0xffe8cc : s.shell.color, width: 1.1, peak: 0.8 });
  for (const a of adds) {
    fx.column(a.x, a.z, { radius: 0.9, height: 9, life: 1.3, color: s.shotColor, delay: 0.15 });
    fx.ring(a.x, a.z, { radius: 3.4, life: 0.8, color: s.shotColor, width: 0.4, delay: 0.15 });
    fx.burst(a.x, 0.4, a.z, 26, 4, 4.5, 0.9, s.shotColor);
  }
  p.shake(0.07);
  const source = s.fail.cover ? { x: s.hold.x, z: s.hold.z } : undefined;
  const fail: Threat = { shape: { kind: 'circle', x: s.center.x, z: s.center.z, radius: s.fail.radius }, at: end, show: warn, share: s.fail.share, source, look: 2.6 };
  const shadows = source ? new ShadowFloor(source, () => p.cover(), STAND_COLOR, s.fail.radius - 1) : null;
  // The shell: lit at its rim, so the boss shows through it, with bands of light running over it.
  const shell = new Shell(s.shell.color);
  shell.mesh.scale.setScalar(s.shell.radius);
  shell.mesh.position.set(s.hold.x, s.shell.y, s.hold.z);
  p.group.add(shell.mesh);
  if (shadows) p.group.add(shadows.mesh);
  let won = false, fell = false, guarded = true, gathered = false, gone = 1;
  const unguard = () => {
    if (!guarded) return;
    guarded = false;
    p.guard(0);
  };
  return {
    threats: [fail], objectives, duration: end + 1.2,
    look: {
      update(t, dt) {
        // Over its last seconds the shell beats faster and brighter, and the blow gathers inside it.
        const late = t > warn ? (t - warn) / Math.max(0.1, end - warn) : 0;
        if (won || fell) gone = Math.max(0, gone - dt * 5);
        shell.set(gone * Math.min(1, t / 0.6) * (0.5 + 0.12 * Math.sin(t * (3 + late * 14)) + late * 0.35), t);
        shell.mesh.rotation.y = t * 0.4;
        if (!gathered && !won && t > end - 3) {
          gathered = true;
          fx.charge(s.hold.x, s.shell.y, s.hold.z, Math.max(0.5, end - t), s.fail.blast === 'flare' ? WHITE : 0xff6a20, s.shell.radius * 2.6);
        }
        if (shadows) shadows.update(t, won || t < warn ? 0 : t < end ? 0.2 + 0.35 * late : Math.max(0, 0.55 * (1 - (t - end) * 2)));
      },
      hurt(part, amount) {
        adds[part]?.hurt(amount);
      },
      done(o) {
        const a = adds[o.part];
        a?.slay();
        // An add goes: it bursts in its own colour.
        if (a) {
          fx.shards(a.x, 1.2, a.z, { count: 16, color: s.color, speed: 5, life: 1, size: 0.2 });
          fx.column(a.x, a.z, { radius: 0.7, height: 6, life: 0.6, color: s.shotColor });
          fx.ring(a.x, a.z, { radius: 4, life: 0.7, color: s.shotColor, width: 0.45 });
          fx.burst(a.x, 1.2, a.z, 24, 5, 3, 0.7, s.shotColor);
        }
        if (won || fell || objectives.some((x) => !x.done)) return;
        // All three down: the shell shatters, the boss falls to its knees (the reward), and what was still to land is off.
        won = true;
        p.cancel(c.id);
        unguard();
        p.reward(s.id, c.id);
        fx.shards(s.hold.x, s.shell.y, s.hold.z, { count: 70, color: s.shell.color, speed: 9, life: 1.6, size: 0.32, up: 0.9 });
        fx.ring(s.hold.x, s.hold.z, { radius: 22, life: 1.4, color: WHITE, width: 1.4 });
        fx.column(s.hold.x, s.hold.z, { radius: s.shell.radius * 0.75, height: 18, life: 1.1, color: WHITE, peak: 0.55 });
        fx.burst(s.hold.x, s.shell.y, s.hold.z, 90, 8, 3, 1.1, s.shell.color);
        p.flash('rgba(255,240,210,0.9)', 0.4);
        p.shake(0.12);
        p.say(s.win, '#fff2c8', s.hold.x, s.hold.z);
      },
      land() {
        fell = true;
        for (const a of adds) {
          if (!a.alive) continue;
          fx.column(a.x, a.z, { radius: 0.8, height: 7, life: 0.8, color: s.shotColor });
          fx.burst(a.x, 0.8, a.z, 24, 4, 4, 0.8, s.shotColor);
          a.remove();
        }
        if (s.fail.blast === 'flare') {
          // The dial strikes: light out of him along the floor in every direction, white hot. The shadows behind cover stay dark.
          fx.rays(s.hold.x, s.hold.z, { count: 26, length: s.fail.radius + 4, life: 1.4, core: WHITE, glow: 0xffb050, width: 1.5, turn: (c.seed % 100) / 100 });
          fx.ring(s.hold.x, s.hold.z, { radius: s.fail.radius + 6, life: 1.3, color: 0xffe6b8, width: 1.8 });
          fx.column(s.hold.x, s.hold.z, { radius: s.shell.radius * 1.2, height: 26, life: 1.7, color: WHITE });
          fx.burst(s.hold.x, s.shell.y, s.hold.z, 120, 12, 2, 1.2, 0xffd890, 3);
          p.flash('rgba(255,246,226,0.95)', 0.75);
        } else {
          // The vent erupts: a geyser of fire, lava thrown over the whole pit, and a wave of heat across the floor.
          fx.column(s.center.x, s.center.z, { radius: 3.4, height: 24, life: 2.2, color: 0xff5a14 });
          fx.column(s.center.x, s.center.z, { radius: 1.5, height: 28, life: 1.8, color: 0xffd080, peak: 0.8 });
          fx.ring(s.center.x, s.center.z, { radius: s.fail.radius + 4, life: 1.5, color: 0xff6a20, width: 1.8 });
          const rng = seeded(c.seed + 13);
          for (let i = 0; i < 16; i++) {
            const an = rng() * Math.PI * 2, d = 4 + rng() * (s.fail.radius - 6), fly = 0.9 + rng() * 0.7;
            V0.set(s.center.x, 2, s.center.z);
            V1.set(s.center.x + Math.sin(an) * d, 0.2, s.center.z + Math.cos(an) * d);
            fx.arc(V0, V1, fly, { color: 0xff7a24, size: 0.32 + rng() * 0.2, height: 7 + rng() * 5 });
            fx.ring(V1.x, V1.z, { radius: 2.2, life: 0.6, color: 0xff6a20, width: 0.4, delay: fly });
          }
          fx.burst(s.center.x, 1, s.center.z, 140, 11, 7, 1.4, 0xff7a2a, 7);
          p.flash('rgba(255,110,36,0.92)', 0.7);
        }
        p.shake(0.2);
        p.say(s.fail.text, '#ff9a6a', s.center.x, s.center.z);
        unguard();
      },
      dispose() {
        for (const a of adds) a.remove();
        standing.delete(c.seed);
        shell.dispose();
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
  const fx = p.show, y = SHOT_Y[s.shot];
  all.forEach((a, part) => {
    // A lob: the first at the hero, the others round it but clear of it, a moment apart. Step out of the first, not into the next.
    const turn = rng() * Math.PI * 2, off = part === 0 ? 0 : LOB_RADIUS + 0.6 + rng() * 0.9;
    if (!a.alive) return;
    if (s.shot === 'beam') {
      const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 1, far = d + 3;
      threats.push({ shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + (dx / d) * far, z2: a.z + (dz / d) * far, width: BEAM_WIDTH }, at, share: SHOT_SHARE, part });
      // Its eye gathers light until the beam goes.
      fx.charge(a.x, y, a.z, at, s.shotColor, 1.5);
      return;
    }
    const x = c.x + Math.sin(turn) * off, z = c.z + Math.cos(turn) * off, when = at + part * 0.3;
    threats.push({ shape: { kind: 'circle', x, z, radius: LOB_RADIUS }, at: when, share: SHOT_SHARE, part });
    // The heart throws it: a burning lump on a high arc, so you see who threw it and where it comes down.
    fx.burst(a.x, y, a.z, 10, 3, 3, 0.5, s.shotColor);
    fx.arc(V0.set(a.x, y, a.z), V1.set(x, 0.25, z), when, { color: 0xff8a2a, size: 0.42, height: 6 });
  });
  if (!threats.length) return { threats, duration: 0.1 };
  return {
    threats, duration: at + 1.4,
    look: {
      land(th) {
        const sh = th.shape;
        if (sh.kind === 'line') {
          // The beam: from the eye down through where the hero stood, white hot at its core.
          fx.beam(V0.set(sh.x1, y, sh.z1), V1.set(sh.x2, 0.7, sh.z2), { life: 0.5, core: WHITE, glow: s.shotColor, width: 1.1 });
          for (let k = 1; k <= 6; k++) {
            const f = k / 6, x = sh.x1 + (sh.x2 - sh.x1) * f, z = sh.z1 + (sh.z2 - sh.z1) * f;
            fx.burst(x, 0.9, z, 5, 3, 2.5, 0.5, s.shotColor);
          }
          p.glows.flash(sh.x2, sh.z2, 1.8, s.shotColor, 0.45, 0.35);
        } else if (sh.kind === 'circle') {
          // The lump lands: a splash of fire and a ring of heat.
          fx.ring(sh.x, sh.z, { radius: sh.radius + 1, life: 0.6, color: s.shotColor, width: 0.45 });
          fx.column(sh.x, sh.z, { radius: sh.radius * 0.6, height: 3.5, life: 0.5, color: 0xff8a30 });
          fx.burst(sh.x, 0.3, sh.z, 22, 4.5, 4, 0.7, s.shotColor);
          p.glows.flash(sh.x, sh.z, sh.radius + 0.3, s.shotColor, 0.5, 0.4);
        }
      },
    },
  };
}
