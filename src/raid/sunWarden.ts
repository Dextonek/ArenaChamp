import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { COURT_R, setCourtRadius, sunCourtArena } from '../arenas/suncourt';
import { HALL_ARMS, HALL_HALF, armSpot, inArm, intoHall, sunHallArena } from '../arenas/sunhall';
import { RAID_PARTY_MAX, raidRing } from '../../server/protocol.mjs';
import { GlowBeam } from '../arenas/hazards/fx';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { TelegraphLayer, type TelegraphShape } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import { hourStoneLook } from './bodies/adds';
import { wardenLook } from './bodies/warden';
import { AimLane, FallingStone, LightPillar, NumberMark, ShadowFloor, SunOrb } from './fx';
import { LEAVE_ALPHA, LEAVE_COLOR, STAND_COLOR } from './script';
import { stageMove } from './stage';
import type { AimContext, BossDef, BossMove, BossPhase, Objective, PlayContext, RaidSide, Threat } from './types';

const CORE = 0xffc060;
const GLOW = 0xd86a18;
const SPARK = 0xf09030;
/** The court's middle: the altar, round which his biggest moves turn. */
const C = { x: RING.x, z: RING.z };

/** How many the fight is tuned for now (`resize`): what his mechanics for 10, 20 and 40 ask (`BossMove.minBand`). */
let size = 2;
/** A party is in: the Warden fights in the Hall of Noon (`resize`). */
let party = false;
/** In the hall, what he aims stays this far inside its walls (m): a fallen stone's width and a little, so none lands in the stone. */
const HALL_AIM = 1.8;
/** In the hall, how far from the Sun Well Sun Order's wedges reach (the crossing and its corners), and how far from him Eclipse's far ring. */
const HALL_ORDER = 19;
const HALL_ECLIPSE = 20;

/** Aims at the target from where the boss stands. */
const atTarget = (c: AimContext) => {
  const t = party ? intoHall(c.target.x, c.target.z, HALL_AIM) : c.target;
  return { x: t.x, z: t.z, dir: Math.atan2(t.x - c.boss.x, t.z - c.boss.z) };
};

/** How far from (x, z) along yaw `dir` the rim is. */
function toRim(x: number, z: number, dir: number) {
  const dx = Math.sin(dir), dz = Math.cos(dir), px = x - C.x, pz = z - C.z;
  const b = px * dx + pz * dz, k = px * px + pz * pz - COURT_R * COURT_R;
  return -b + Math.sqrt(Math.max(0, b * b - k));
}

const beam = (p: PlayContext, core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, width: number) => {
  const b = new GlowBeam(core, glow, width);
  p.group.add(b.mesh);
  return b;
};
const dropBeam = (b: GlowBeam) => {
  b.mesh.removeFromParent();
  b.mesh.geometry.dispose();
  (b.mesh.material as THREE.Material).dispose();
};

// --- phase 1, Awake: teaches the language --------------------------------------------------------------------------

/** A cone in front of him. Walk out, or get behind him. */
const stoneSweep: BossMove = {
  id: 'sweep', name: 'Stone Sweep', charge: 1.6, lock: 2.1, cooldown: 6, range: 8.5, pose: 'swing',
  body: { name: 'sweep', seconds: 1.6 },
  aim: atTarget,
  play(c, p) {
    const radius = 6.5, angle = 120, at = p.shown(1.6);
    const th: Threat = { shape: { kind: 'cone', x: c.fx, z: c.fz, radius, angle, dir: c.dir }, at, share: 0.2, knock: 3 };
    return {
      threats: [th], duration: at + 0.5,
      look: {
        land() {
          for (let k = -3; k <= 3; k++) {
            const a = c.dir + (k / 3) * THREE.MathUtils.degToRad(angle / 2), r = radius * 0.8;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.3, z, 6, 3, 2.5, 0.6, 0xb8a080);
            p.glows.flash(x, z, 1.4, GLOW, 0.5, 0.3);
          }
        },
      },
    };
  },
};

/** How long a fallen stone stands as cover (s), and how wide it is (m). */
const STONE_STAYS = 8;
const STONE_R = 1.05;
/** A sun shard falls this far from the altar (m), and a shard's carrier walks this much slower. */
const SHARD_OUT = 9;

/** Three stones, each where the target stood at that moment. Keep walking. They stay a while: his ray breaks on them. */
const pillarFall: BossMove = {
  id: 'pillars', name: 'Pillar Fall', charge: 2.9, lock: 2.9, cooldown: 9, steps: [0, 0.7, 1.4], chases: true, pose: 'raise',
  body: { name: 'pillars', seconds: 1.5 },
  aim: atTarget,
  play(c, p) {
    const radius = 2.2, at = p.shown(1.5);
    const th: Threat = { shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.15 };
    const stone = new FallingStone(c.x, c.z, radius, at, STONE_STAYS);
    p.group.add(stone.mesh);
    return {
      threats: [th], duration: at + STONE_STAYS + 0.9,
      look: {
        update: (t) => stone.update(t),
        land() {
          p.sparks.emit(c.x, 0.2, c.z, 26, 4.5, 3, 0.7, 0xb8a080);
          p.glows.flash(c.x, c.z, radius, GLOW, 0.6, 0.35);
          p.addStone(c.x, c.z, STONE_R, STONE_STAYS);
          p.hint('Keep a fallen stone between you and his ray');
        },
        dispose: () => stone.mesh.removeFromParent(),
      },
    };
  },
};

/** A line across the ring through the target's spot, stopped by cover. It cracks the wall it hits. */
const sunRay: BossMove = {
  id: 'ray', name: 'Sun Ray', charge: 2.5, lock: 3, cooldown: 8, pose: 'thrust',
  aim: atTarget,
  play(c, p) {
    const at = p.shown(2.5), width = 2, y = 2.6;
    const full = toRim(c.fx, c.fz, c.dir);
    const ex = c.fx + Math.sin(c.dir) * full, ez = c.fz + Math.cos(c.dir) * full;
    const k = p.rayStop(c.fx, c.fz, ex, ez);
    const x2 = c.fx + (ex - c.fx) * k, z2 = c.fz + (ez - c.fz) * k;
    // What it stops at: a fallen stone breaks, and that hurts him.
    const stoneHit = p.firstStone(c.fx, c.fz, ex, ez);
    const th: Threat = { shape: { kind: 'line', x1: c.fx, z1: c.fz, x2, z2, width }, at, share: 0.22 };
    const ray = beam(p, CORE, GLOW, 1.6);
    const a = new THREE.Vector3(c.fx, y, c.fz), b = new THREE.Vector3(x2, 0.9, z2);
    let time = 0;
    return {
      threats: [th], duration: at + 0.45,
      look: {
        update(t, dt) {
          time += dt;
          // A thin line while it charges, then the ray itself.
          if (t < at) ray.set(a, b, p.camera, time, 0.15 + 0.5 * (t / at), 0.2);
          else ray.set(a, b, p.camera, time, Math.max(0, 1 - (t - at) / 0.45), 1.6);
        },
        land() {
          p.sparks.emit(x2, 0.9, z2, 22, 4, 3.2, 0.6, SPARK);
          p.glows.flash(x2, z2, 1.8, GLOW, 0.6, 0.4);
          if (stoneHit) {
            p.dropStone(stoneHit);
            p.reward('ray', c.id);
            p.show.triumph(x2, z2, 0xffd890);
            p.say('THE RAY BREAKS', '#ffe27a', x2, z2);
            p.sparks.emit(x2, 1, z2, 40, 6, 5, 0.8, 0xb8a080);
          } else p.crackFirst(c.fx, c.fz, ex, ez);
        },
        dispose: () => dropBeam(ray),
      },
    };
  },
};

/** Fists of the Court: left, right, left, each flies out and comes down where the target stood. Keep walking. */
const fists: BossMove = {
  id: 'fists', name: 'Fists of the Court', charge: 2.8, lock: 3, cooldown: 10, steps: [0, 0.8, 1.6], chases: true, range: 14, pose: 'raise',
  body: { name: 'fists', seconds: 1.2 },
  aim: atTarget,
  play(c, p) {
    const radius = 2.5, at = p.shown(1.2);
    return {
      threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.16, knock: 3 }], duration: at + 0.6,
      look: {
        land() {
          p.sparks.emit(c.x, 0.3, c.z, 30, 5, 3.5, 0.7, 0xb8a080);
          p.glows.flash(c.x, c.z, radius + 0.4, GLOW, 0.6, 0.4);
        },
      },
    };
  },
};

// --- phase 2, High Noon: cover becomes the puzzle -------------------------------------------------------------------

/**
 * Turn the light: he gathers noon while sun shards fall far from the altar. Walk over one to carry it, and walk it to the altar: one
 * alone, one each for two. Then there is no noon, and he kneels. If not, the whole ring burns: only cover between you and him is safe,
 * a screen wall that saved someone falls, and he stands open after.
 */
const noon: BossMove = {
  id: 'noon', name: 'Gathering Noon', charge: 8, lock: 13, cooldown: 30, big: true, pose: 'raise',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const at = p.shown(8), show = Math.max(0, at - 4), exposed = 5;
    const source = { x: c.fx, z: c.fz };
    const th: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: COURT_R + 1 }, at, show, share: 0.4, source, breaks: true, look: 2.6 };
    const shadows = new ShadowFloor(source, () => p.cover(), STAND_COLOR, COURT_R);
    const sun = new SunOrb(c.fx, 7, c.fz);
    p.group.add(shadows.mesh, sun.sprite);
    p.hint('Carry a sun shard to the altar, or hide from the light');
    // Where the shards fall comes from the seed, so both screens agree. A hero carries one, and delivers it once.
    const rng = seeded(c.seed), base = rng() * Math.PI * 2, need = c.alone ?? p.solo ? 1 : 2;
    const carrying = new Set<RaidSide>(), delivered = new Set<RaidSide>();
    // Each hero's delivery is its own objective, and every screen has both: the partner's must be heard here too.
    const me = p.side, DELIVER = 10;
    const shards = Array.from({ length: need }, (_, i) => {
      const x = C.x + Math.sin(base + i * Math.PI) * SHARD_OUT, z = C.z + Math.cos(base + i * Math.PI) * SHARD_OUT;
      const light = new LightPillar(x, z, 1.3, 6, STAND_COLOR), orb = new SunOrb(x, 1.1, z);
      p.group.add(light.mesh, orb.sprite);
      return { part: i, x, z, light, orb };
    });
    const altar = new LightPillar(C.x, C.z, 2.4, 7, STAND_COLOR);
    p.group.add(altar.mesh);
    const objectives: Objective[] = [
      ...shards.map((s): Objective => ({ part: s.part, x: s.x, z: s.z, radius: 1.3, until: at, can: () => !carrying.has(me) && !delivered.has(me) })),
      // In a party whoever picked a shard up brings it in: one way in for each seat.
      ...Array.from({ length: party ? RAID_PARTY_MAX : 2 }, (_, side): Objective => ({ part: DELIVER + side, x: C.x, z: C.z, radius: 2.4, until: at, beats: true, can: () => side === me && carrying.has(side) })),
    ];
    const held = new Map<RaidSide, SunOrb>();
    let turned = -1, time = 0;
    return {
      threats: [th], objectives, duration: at + 1,
      look: {
        update(t, dt) {
          time = t;
          const pulse = 0.55 + 0.2 * Math.sin(t * 5);
          for (const s of shards) {
            const gone = objectives[s.part].done || t >= at || turned >= 0;
            s.light.opacity = gone ? 0 : pulse;
            s.orb.set(1.6, gone ? 0 : 0.95);
          }
          altar.opacity = carrying.size && turned < 0 && t < at ? pulse : 0;
          for (const [side, orb] of held) {
            const h = p.heroAt(side);
            if (h) orb.sprite.position.set(h.x, 3.1, h.z);
            orb.set(1.5, 0.95);
          }
          void dt;
          if (turned >= 0) {
            // The light goes back at him.
            const f = Math.max(0, 1 - (t - turned) * 2);
            shadows.update(t, 0);
            sun.set(11 * (1 - f) + 2, 0.9 * f);
            return;
          }
          const k = Math.min(1, t / at), s = show < at ? Math.min(1, Math.max(0, (t - show) / (at - show))) : 1;
          shadows.update(t, t < show ? 0 : t < at ? 0.2 + 0.35 * s : Math.max(0, 0.55 * (1 - (t - at) * 2)));
          sun.set(2 + 9 * k, t < at ? 0.25 + 0.65 * k * k : Math.max(0, 0.9 * (1 - (t - at) * 1.5)));
        },
        done(o, side) {
          if (o.part < DELIVER) {
            carrying.add(side);
            const orb = new SunOrb(C.x, 3.1, C.z);
            p.group.add(orb.sprite);
            held.set(side, orb);
            if (side === me) p.heavy(true);
            return;
          }
          carrying.delete(side);
          delivered.add(side);
          held.get(side)?.dispose();
          held.delete(side);
          if (side === me) p.heavy(false);
          p.sparks.emit(C.x, 1, C.z, 24, 4, 4, 0.7, STAND_COLOR);
          if (delivered.size < need) return;
          turned = time;
          p.cancel(c.id);
          p.reward('noon', c.id);
          p.show.triumph(C.x, C.z, 0xffe0a0, 1.5);
          p.shake(0.08);
          p.flash('rgba(255,226,140,0.7)', 0.5);
          p.say('THE LIGHT TURNS', '#ffe27a', C.x, C.z);
          p.sparks.emit(c.fx, 4, c.fz, 60, 7, 2, 1, SPARK, 5);
        },
        land() {
          p.flash('rgba(255,206,130,0.85)', 0.8);
          p.exposed(exposed);
          p.say('EXPOSED', '#ffb050', c.fx, c.fz);
          p.sparks.emit(c.fx, 6, c.fz, 60, 7, 2, 1, SPARK, 5);
        },
        dispose() {
          shadows.dispose();
          sun.dispose();
          altar.dispose();
          for (const s of shards) {
            s.light.dispose();
            s.orb.dispose();
          }
          for (const orb of held.values()) orb.dispose();
          if (carrying.has(me)) p.heavy(false);
        },
      },
    };
  },
};

/** Four wedges round the altar show 1-2-3-4, then fire in that order. Stand next to 1, then step into it once it has fired. */
const sunOrder: BossMove = {
  id: 'order', name: 'Sun Order', charge: 4.9, lock: 4.9, cooldown: 16, pose: 'raise',
  body: { name: 'order', seconds: 2.5 },
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const rng = seeded(c.seed);
    const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
    // In the hall the wedges cover the crossing and no more: deep in an arm no edge of a wedge is near enough to step over.
    const first = p.shown(2.5), apart = 0.8, radius = party ? HALL_ORDER : COURT_R + 1;
    const marks: NumberMark[] = [];
    const threats: Threat[] = [0, 1, 2, 3].map((i) => {
      const dir = start + spin * i * (Math.PI / 2);
      const mark = new NumberMark(String(i + 1), C.x + Math.sin(dir) * 7.5, C.z + Math.cos(dir) * 7.5);
      p.group.add(mark.sprite);
      marks.push(mark);
      return { shape: { kind: 'cone', x: C.x, z: C.z, radius, angle: 90, dir }, at: first + i * apart, share: 0.16 };
    });
    return {
      threats, duration: first + 3 * apart + 0.5,
      look: {
        land(th) {
          const i = threats.indexOf(th);
          marks[i].sprite.visible = false;
          const dir = start + spin * i * (Math.PI / 2);
          for (const r of [4, 8, 12]) {
            const x = C.x + Math.sin(dir) * r, z = C.z + Math.cos(dir) * r;
            p.sparks.emit(x, 0.3, z, 10, 3.5, 3, 0.6, SPARK);
            p.glows.flash(x, z, 2.6, GLOW, 0.55, 0.4);
          }
        },
        dispose: () => marks.forEach((m) => m.dispose()),
      },
    };
  },
};

/**
 * A gold circle where the target stood, too heavy for one hero: its cost is split between the heroes in it, and if nobody is
 * in it everyone pays in full. Only with two players. Come together, right after a move that spread you out.
 */
const sharedBurden: BossMove = {
  id: 'burden', name: 'Shared Burden', charge: 3, lock: 3.4, cooldown: 18, coop: true, pose: 'raise',
  aim: atTarget,
  play(c, p) {
    const radius = 2.4, at = p.shown(3);
    const light = new LightPillar(c.x, c.z, radius, 7, STAND_COLOR);
    p.group.add(light.mesh);
    return {
      threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, kind: 'stand', split: true, at, share: 0.4, part: 0 }],
      duration: at + 0.5,
      look: {
        update(t) { light.opacity = t < at ? 0.3 + 0.35 * (t / at) : Math.max(0, 0.65 * (1 - (t - at) * 2)); },
        land() {
          p.sparks.emit(c.x, 0.4, c.z, 30, 3.4, 4, 0.8, STAND_COLOR);
          p.glows.flash(c.x, c.z, radius, GLOW, 0.6, 0.4);
        },
        dispose: () => light.dispose(),
      },
    };
  },
};

// --- the stage, The Long Hour: halfway down, his sundial's stones rise -----------------------------------------------

/**
 * He floats back behind the Sun Well in a shell of light and can't be hurt. Three of the dial's Hour Stones rise round the court and
 * shoot beams through one hero and then the other: step aside. Break all three before his cast bar fills and he falls to his knees.
 * If not, the dial strikes: the whole court burns, and only cover between you and him is safe.
 */
const longHour = stageMove({
  id: 'hour', name: 'The Long Hour', pose: 'channel',
  hold: { x: C.x, z: C.z - 2.4 }, shell: { radius: 3.1, y: 2.8, color: 0xffc070 },
  center: C, ring: 9, turns: [[0, 120, 240], [60, 180, 300]],
  look: hourStoneLook, color: '#c8b088', shot: 'beam', shotColor: SPARK,
  fail: { share: 0.55, cover: true, get radius() { return COURT_R + 1; }, text: 'THE DIAL STRIKES', blast: 'flare' },
  win: 'THE HOUR BREAKS', hint: 'Break the three Hour Stones before his bar fills',
});

// --- phase 3, Last Light: everything at once ----------------------------------------------------------------------

/** Near him, far from him, near again. Read and swap. */
const eclipse: BossMove = {
  id: 'eclipse', name: 'Eclipse', charge: 4.8, lock: 4.8, cooldown: 14, steps: [0, 1.6, 3.2], pose: 'burst',
  body: { name: 'eclipse', seconds: 1.6 },
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) }),
  play(c, p) {
    const at = p.shown(1.6), near = 5.5;
    const far = c.step === 1;
    // In the hall the far ring ends where a hero could still have run in from: it does not fill an arm he is not in.
    const reach = party ? HALL_ECLIPSE : Math.hypot(c.fx - C.x, c.fz - C.z) + COURT_R;
    const shape: TelegraphShape = far ? { kind: 'ring', x: c.fx, z: c.fz, inner: near, outer: reach } : { kind: 'circle', x: c.fx, z: c.fz, radius: near };
    return {
      threats: [{ shape, at, share: 0.15 }], duration: at + 0.4,
      look: {
        land() {
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2, r = far ? near + 2.5 : near * 0.7;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.3, z, 5, 3, 2.6, 0.55, SPARK);
            p.glows.flash(x, z, 1.8, GLOW, 0.45, 0.28);
          }
        },
      },
    };
  },
};

/** Gold circles on opposite sides: each needs a hero in it when it lands, or the whole ring pays. Alone, one and then the other. */
const anchors: BossMove = {
  id: 'anchors', name: 'Anchors', charge: 3, lock: 6.6, cooldown: 24, steps: [0, 3.5], pose: 'channel',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const rng = seeded(c.seed);
    const base = rng() * Math.PI * 2, radius = 2.3, out = 7.6, at = p.shown(3);
    const spot = (i: number) => ({ x: C.x + Math.sin(base + i * Math.PI) * out, z: C.z + Math.cos(base + i * Math.PI) * out });
    // With one hero up each step is one circle. With two the first step is both, and the second does nothing.
    const parts = c.alone ?? p.solo ? [c.step] : c.step === 0 ? [0, 1] : [];
    const lights: LightPillar[] = [];
    const threats: Threat[] = parts.map((i) => {
      const s = spot(i);
      const light = new LightPillar(s.x, s.z, radius, 7, STAND_COLOR);
      p.group.add(light.mesh);
      lights.push(light);
      return { shape: { kind: 'circle', x: s.x, z: s.z, radius }, kind: 'stand', at, share: 0.25, part: i };
    });
    return {
      threats, duration: at + 0.5,
      look: {
        update(t) {
          for (const l of lights) l.opacity = t < at ? 0.25 + 0.35 * (t / at) : Math.max(0, 0.6 * (1 - (t - at) * 2));
        },
        land(th) {
          const s = spot(th.part ?? 0);
          p.sparks.emit(s.x, 0.4, s.z, 24, 3, 4, 0.8, STAND_COLOR);
        },
        dispose: () => lights.forEach((l) => l.dispose()),
      },
    };
  },
};

/** A slow ray turns round the altar while other moves go on. Keep ahead of it, or behind cover. */
const walkingSun: BossMove = {
  id: 'walking', name: 'Walking Sun', charge: 2, lock: 0, cooldown: 24, alongside: true, pose: 'channel',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
  play(c, p) {
    const rng = seeded(c.seed);
    const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
    const warm = p.shown(2), end = 12, speed = THREE.MathUtils.degToRad(24), width = 1.4, inner = 1.25;
    const angleAt = (t: number) => start + spin * speed * Math.max(0, t - warm);
    // Cover stops the ray: remembered per small turn, because an AI's look ahead asks many times a frame.
    const reach = new Map<number, number>();
    let coverCount = -1;
    const lengthAt = (a: number) => {
      const n = p.cover().length;
      if (n !== coverCount) { reach.clear(); coverCount = n; }
      const key = Math.round(a * 20);
      let k = reach.get(key);
      if (k === undefined) {
        const x1 = C.x + Math.sin(a) * inner, z1 = C.z + Math.cos(a) * inner;
        k = p.rayStop(x1, z1, C.x + Math.sin(a) * COURT_R, C.z + Math.cos(a) * COURT_R);
        reach.set(key, k);
      }
      return inner + (COURT_R - inner) * k;
    };
    const shapeAt = (t: number): TelegraphShape => {
      const a = angleAt(t), len = lengthAt(a);
      return { kind: 'line', x1: C.x + Math.sin(a) * inner, z1: C.z + Math.cos(a) * inner, x2: C.x + Math.sin(a) * len, z2: C.z + Math.cos(a) * len, width };
    };
    const th: Threat = { shape: shapeAt(warm), at: warm, to: end, every: 1, share: 0.12, look: 1.2, shapeAt };
    const ray = beam(p, CORE, GLOW, 1.5), floor = beam(p, 0xc06a20, 0x7a3208, 2.2);
    const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
    let time = 0;
    return {
      threats: [th], duration: end + 0.4,
      look: {
        update(t, dt) {
          time += dt;
          const a = angleAt(t), len = lengthAt(a), dx = Math.sin(a), dz = Math.cos(a);
          const on = t < warm ? 0.2 + 0.35 * (t / warm) : t < end ? 1 : Math.max(0, 1 - (t - end) / 0.4);
          a3.set(C.x + dx * 0.6, 1.75, C.z + dz * 0.6);
          b3.set(C.x + dx * len, 0.95, C.z + dz * len);
          ray.set(a3, b3, p.camera, time, on, t < warm ? 0.25 : 1.5);
          if (t >= warm && t < end && Math.random() < dt * 30) p.sparks.emit(b3.x, b3.y, b3.z, 3, 3, 3, 0.5, SPARK);
          a3.y = b3.y = 0.05;
          floor.set(a3, b3, p.camera, time, on * 0.55, 2.2, true);
        },
        dispose() {
          dropBeam(ray);
          dropBeam(floor);
        },
      },
    };
  },
};

// --- the hall's own: The Hour Strikes --------------------------------------------------------------------------------

/**
 * The Hour Strikes' numbers.
 * - `seconds`: from his call to the bell at tier 1, and `least`: never shorter, whatever the tier. Measured with the autopilot
 *   (3.5 m/s: a slow hero, or any hero under Heavy Air) from the far end of each arm to each other arm
 *   (`pipeline/tools/hour-walk.js`): see `docs/architecture/raid.md` for the table.
 * - `share`: what the bell costs whoever is not in the safe arm, of max HP. More than anything else he has (Gathering Noon 40 %, the
 *   Long Hour failed 55 %), because it is the one blow the whole party can walk out of; not a kill from full HP at tier 1, even
 *   with Brittle and a Reckless Pact together (60 % x 1.2 x 1.25 = 90 %). Enraged it doubles, and kills.
 * - `call`: how long he stands still to call it. After that he walks and fights on.
 * - `inset`: an AI counts itself safe this far past the crossing's edge.
 */
export const HOUR = { seconds: 23, least: 19, share: 0.6, call: 3, inset: 2, first: 20, every: 55 };
/** While an hour is in the air he does only these: nothing that covers the floor, and nothing to stand in. */
const HOUR_ONLY = ['sweep', 'pillars', 'ray', 'fists'];
const SUNFIRE = 0xff9a3a;

/**
 * Only in the Hall of Noon (user, 2026-11-11, card W1 of pipeline/designs/raid-mechanics.html): "He calls an hour. Three of the hall's
 * four arms fill with sunfire; the sun road on the floor lights up in the one safe arm. The whole party runs there before the bell."
 *
 * The arm comes from the cast's seed (`seed % 4`, its place in `HALL_ARMS`), so every screen lights the same road. Each screen
 * decides for its own hero whether it stands in that arm when the bell strikes. He stands still only for the call, then walks and
 * fights on with his small moves (`holds`); a stage calls the hour off.
 */
const strikes: BossMove = {
  id: 'strikes', name: 'The Hour Strikes', charge: HOUR.seconds, least: HOUR.least, lock: HOUR.call, cooldown: HOUR.every, due: HOUR.first, big: true, pose: 'raise',
  holds: { only: HOUR_ONLY },
  body: { name: 'strikes', seconds: HOUR.call },
  // He turns to the arm he calls, and his fists point down it.
  aim: (c) => {
    const spot = armSpot(c.seed % 4, HALL_HALF + 8);
    return { x: spot.x, z: spot.z, dir: Math.atan2(spot.x - c.boss.x, spot.z - c.boss.z) };
  },
  play(c, p) {
    const arm = c.seed % 4, hall = HALL_ARMS[arm];
    const at = Math.max(HOUR.least, p.shown(HOUR.seconds));
    // The bell: everywhere but the safe arm. No shape says that, so the look draws it.
    const th: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: COURT_R }, hits: (x, z) => !inArm(arm, x, z), at, share: HOUR.share, look: 3 };
    // Where to run: each screen has one spot of its own, open while its hero is not in the safe arm yet. Nobody takes it: it is the
    // arrow at the screen's edge, and where an AI walks.
    const goal = armSpot(arm, HALL_HALF + 8);
    const objectives: Objective[] = [{
      part: p.side, x: goal.x, z: goal.z, radius: 1, hold: Infinity, until: at,
      can: () => {
        const h = p.heroAt(p.side);
        return !!h && !inArm(arm, h.x, h.z, HOUR.inset);
      },
    }];
    // The three arms that burn and the crossing, as the zones every move draws: they fill from the crossing outward.
    const fire = new TelegraphLayer(), W = HALL_HALF;
    const burning = HALL_ARMS.map((a, i) => ({ a, i })).filter((x) => x.i !== arm);
    const rect = (x1: number, z1: number, x2: number, z2: number) => ({ shape: { kind: 'line' as const, x1, z1, x2, z2, width: W * 2 }, start: 0, impact: at });
    fire.set([
      rect(C.x - Math.sin(hall.dir) * W, C.z - Math.cos(hall.dir) * W, C.x + Math.sin(hall.dir) * W, C.z + Math.cos(hall.dir) * W),
      ...burning.map(({ a, i }) => { const from = armSpot(i, W), to = armSpot(i, a.reach); return rect(from.x, from.z, to.x, to.z); }),
    ], LEAVE_COLOR, LEAVE_ALPHA);
    // The sun road in the safe arm, lit from the crossing outward, and a gold line across the arm's mouth: past it is safe.
    const road = new AimLane(STAND_COLOR), mouth = armSpot(arm, W);
    const sill = beam(p, 0xfff0b0, STAND_COLOR, 1.1);
    const sa = new THREE.Vector3(mouth.x - Math.cos(hall.dir) * W, 0.08, mouth.z + Math.sin(hall.dir) * W);
    const sb = new THREE.Vector3(mouth.x + Math.cos(hall.dir) * W, 0.08, mouth.z - Math.sin(hall.dir) * W);
    p.group.add(fire.group, road.mesh);
    p.hint('The hour is called: run to the arm with the lit road');
    p.say('THE HOUR IS CALLED', '#ffe27a', mouth.x, mouth.z);
    p.show.ring(C.x, C.z, { radius: 30, life: 1.4, color: 0xffe0b0, width: 0.9, peak: 0.6 });
    /** A spot in the fire: somewhere in the crossing or a burning arm. */
    const inFire = () => {
      const k = Math.floor(Math.random() * (burning.length + 1)), across = (Math.random() * 2 - 1) * (W - 1);
      const b = burning[k], dir = b ? b.a.dir : hall.dir, along = b ? W + Math.random() * (b.a.reach - W - 1) : (Math.random() * 2 - 1) * (W - 1);
      return { x: C.x + Math.sin(dir) * along + Math.cos(dir) * across, z: C.z + Math.cos(dir) * along - Math.sin(dir) * across };
    };
    const TOLLS = 4;
    let tolled = 0, belled = false, off = -1, time = 0;
    return {
      threats: [th], objectives, duration: at + 1.6,
      look: {
        update(t, dt) {
          time += dt;
          // Called off (a stage began): it all goes out in a second.
          const on = off < 0 ? 1 : Math.max(0, 1 - (t - off));
          const k = Math.min(1, t / at), after = Math.max(0, t - at);
          fire.update(t);
          fire.group.visible = off < 0;
          // The road runs out from the crossing in the first seconds and stays; brighter as the bell nears, gone a moment after it.
          const lit = Math.min(1, t / 2.5), fade = Math.max(0, 1 - after / 0.8) * on;
          road.set(mouth.x, mouth.z, hall.dir, (hall.reach - W - 1) * (1 - (1 - lit) ** 2), 5, (0.5 + 0.35 * k) * fade, time);
          sill.set(sa, sb, p.camera, time, (0.55 + 0.25 * Math.sin(time * 5)) * fade, 1.1, true);
          if (off >= 0 || t >= at) return;
          // Sunfire: embers rising all over what burns, more and higher as the bell nears, and tongues of flame from a third of the way
          // on. Kept to what a phone can draw: at most about 300 embers and 45 tongues at once (a tongue is a draw call of its own).
          for (let n = Math.random() < dt * (60 + 240 * k * k) ? 1 + Math.floor(k * 1.5) : 0; n > 0; n--) {
            const s = inFire();
            p.show.burst(s.x, 0.1, s.z, 2, 0.8, 1.6 + 3.5 * k, 0.9 + 0.4 * k, SUNFIRE, 0.5);
          }
          if (k > 0.35 && Math.random() < dt * 55 * ((k - 0.35) / 0.65)) {
            const s = inFire();
            p.show.column(s.x, s.z, { radius: 0.3 + Math.random() * 0.45, height: 1.5 + (2.5 + Math.random() * 4.5) * k, life: 0.8, color: SUNFIRE, peak: 0.35 + 0.4 * k });
          }
          // The hall's bell tolls on the way: a ring from the Sun Well, and his halo answers it.
          if (tolled < TOLLS && t >= ((tolled + 1) / (TOLLS + 1)) * at) {
            tolled++;
            p.act('toll', tolled, c.x, c.z, 0.45);
            p.show.ring(C.x, C.z, { radius: 34, life: 1.5, color: 0xffe0b0, width: 0.9, peak: 0.4 + 0.1 * tolled });
          }
          // His fists come together as it strikes.
          if (!belled && t >= at - 0.8) {
            belled = true;
            p.act('bell', 0, c.x, c.z, 0.8);
          }
        },
        land() {
          // The bell: light over the whole hall, rings from the Sun Well to its far walls, and the three arms go up in sunfire, the
          // nearest first.
          p.flash('rgba(255,214,150,0.85)', 0.7);
          p.shake(0.16);
          p.say('THE HOUR STRIKES', '#ffb050', C.x, C.z);
          p.show.column(C.x, C.z, { radius: 5, height: 46, life: 1.5, color: 0xfff0d0, peak: 0.9 });
          for (const [i, delay] of [0, 0.22, 0.44].entries()) p.show.ring(C.x, C.z, { radius: 52, life: 1.5 + i * 0.2, color: i ? 0xffb060 : 0xfff0d0, width: 2.4 - i * 0.5, delay });
          p.show.burst(C.x, 9, C.z, 120, 12, 4, 1.4, 0xffd890, 4);
          // Many thin columns of different heights, a little off their rows, read as fire; a few wide ones as glass tubes.
          const flame = (x: number, z: number, delay: number) => p.show.column(x + (Math.random() - 0.5) * 3, z + (Math.random() - 0.5) * 3, {
            radius: 1 + Math.random() * 1.3, height: 9 + Math.random() * 13, life: 1 + Math.random() * 0.6, color: SUNFIRE, peak: 0.85, delay,
          });
          for (const across of [-8, 0, 8]) {
            for (const along of [-8, 0, 8]) flame(C.x + Math.sin(hall.dir) * along + Math.cos(hall.dir) * across, C.z + Math.cos(hall.dir) * along - Math.sin(hall.dir) * across, 0.04);
            for (const { a, i } of burning) {
              for (let along = W + 3; along < a.reach - 1; along += 7) {
                const s = armSpot(i, along);
                flame(s.x + Math.cos(a.dir) * across, s.z - Math.sin(a.dir) * across, 0.08 + (along - W) * 0.014);
              }
            }
          }
        },
        off() { off = time; },
        dispose() {
          fire.set([]);
          fire.group.removeFromParent();
          road.dispose();
          dropBeam(sill);
        },
      },
    };
  },
};

// --- the boss -------------------------------------------------------------------------------------------------------

/** Draws his portrait: a stone sun. */
function portrait(g: CanvasRenderingContext2D, s: number) {
  const m = s / 2;
  const bg = g.createRadialGradient(m, m, s * 0.05, m, m, m);
  bg.addColorStop(0, '#5a3c1c');
  bg.addColorStop(1, '#120c08');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = '#ffc060';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.arc(m, m, s * 0.2, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(m + Math.cos(a) * s * 0.28, m + Math.sin(a) * s * 0.28);
    g.lineTo(m + Math.cos(a) * s * 0.42, m + Math.sin(a) * s * 0.42);
    g.stroke();
  }
}

const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });

/** A floating stone sentinel of its own, posed by `wardenLook`. Built by blender/bosses/boss_bodies.py. */
const MODEL = 'models/bosses/warden.glb';
/** What the hub keeps online: one source for both. */
const NUMBERS = RAID_BOSSES.sun;
/** In the hall: how far inside the south gate a party's first row stands, and how far before the choir's end wall the way out. */
const HALL_START = 1.4;
const HALL_GATE = 4;

const PHASES: BossPhase[] = [
  { name: 'Awake', at: 1, moves: ['sweep', 'pillars', 'ray', 'fists'], gap: [1.9, 2.8] },
  { name: 'High Noon', at: NUMBERS.phases[0], moves: ['sweep', 'pillars', 'ray', 'fists', 'noon', 'order', 'burden'], opener: 'noon', gap: [2, 3] },
  { name: 'The Long Hour', at: NUMBERS.phases[1], moves: ['sweep', 'pillars', 'ray', 'fists', 'noon', 'order', 'burden'], opener: 'hour', gap: [2, 3] },
  { name: 'Last Light', at: NUMBERS.phases[2], moves: ['sweep', 'pillars', 'ray', 'fists', 'noon', 'order', 'burden', 'eclipse', 'anchors', 'walking'], opener: 'walking', gap: [1.6, 2.6] },
];
/** In the hall he also calls the hour, in every phase: it comes by its own clock (`BossMove.due`). */
const HALL_PHASES: BossPhase[] = PHASES.map((ph) => ({ ...ph, moves: [...ph.moves, 'strikes'] }));

export const SUN_WARDEN: BossDef = {
  id: 'sun',
  name: 'The Sun Warden',
  title: 'Keeper of the Sun Court',
  get place() { return party ? sunHallArena : sunCourtArena; },
  // The hall's way in stands in the gate's passage, as the court's does past its rim; its way out before the throne, at the choir's
  // end (past its rim is the stone).
  get gates() { return party ? { enter: 0, exit: 180, exitR: HALL_ARMS[2].reach - HALL_GATE } : { enter: 0, exit: 180 }; },
  // Heroes come in at the south gate, wherever the rim is now. In the hall: just inside the gate, where a party's rows of eight
  // (`partyStart` in src/duel.ts) stand clear of the nave's cover, all but seat 39 of 40.
  get starts() {
    const z = party ? RING.z + HALL_ARMS[0].reach - HALL_START : RING.z + COURT_R - 6.5;
    return { boss: { x: 0, z: -1.5 }, heroes: [{ x: 0, z }, { x: -1.6, z }, { x: 1.6, z }] as [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }] };
  },
  /** For two, the Sun Court. A party fights in the Hall of Noon (`raidRing`): set before the fight is built. */
  resize: (band) => {
    party = band > 2;
    size = band;
    setCourtRadius(raidRing('sun', band));
  },
  get band() { return size; },
  kit: (hp) => ({
    name: 'The Sun Warden', title: 'Keeper of the Sun Court', accent: '#e8a040', foil: '#ffd27a', portrait, model: MODEL, look: wardenLook, maxHp: hp,
    spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')],
  } as HeroKit),
  hp: NUMBERS.hp,
  scale: 1,
  body: { radius: 1.2, height: 5.4 },
  speed: 2,
  keepAt: 4.5,
  staggerMax: NUMBERS.staggerMax,
  kneel: NUMBERS.kneel,
  phasePause: 2.5,
  get phases() { return party ? HALL_PHASES : PHASES; },
  /** A higher tier brings these in from the first phase on, one a tier. */
  extra: ['order', 'walking', 'eclipse'],
  moves: { sweep: stoneSweep, pillars: pillarFall, ray: sunRay, fists, noon, order: sunOrder, burden: sharedBurden, hour: longHour, eclipse, anchors, walking: walkingSun, strikes },
  /**
   * 2:30 in he enrages: about where the slowest third of the autopilot's wins at a person's pace end (pipeline/designs/raid-noonfall.md).
   * In the hall 3:15: the party walks 40 m up the nave to him first, and each hour takes the fight away from him for a while (the
   * same ten heroes' wins took 35 to 75 s longer there: pipeline/designs/raid-party.md).
   */
  get enrage() { return party ? 195 : 150; },
  /** Past 5 minutes the temple's sunfire closes in, and at 6 Last stand ends it. The shift's own clock has Last stand at 105 s. */
  late: () => ({
    offset: -255,
    shift: new ArenaShift('The sun comes down', 0xd08a20, '#ffb050', [
      { at: 45, zones: [{ shape: { kind: 'ring', x: C.x, z: C.z, inner: 7, outer: COURT_R }, share: 0.03 }] },
    ], new ZoneFloor('sun', [{ edge: 7 }], undefined, undefined, COURT_R), COURT_R),
  }),
};


