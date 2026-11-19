import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { ROOST_R, wyrmRoostArena } from '../arenas/wyrmRoost';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import { WYRM_LIVE, resetWyrmLive, wyrmLook } from './bodies/wyrm';
import { castShadeLook } from './bodies/wyrmShade';
import { HoldRing, LightPillar } from './fx';
import { STAND_COLOR } from './script';
import { stageMove } from './stage';
import type { AimContext, BossDef, BossMove, BossPhase, Objective, Threat } from './types';

/**
 * The Eclipse Wyrm, the Raid's fourth boss (pipeline/designs/raid-wyrm.md): the shadow the sun threw as it fell, which took wing and
 * roosts on the Tower's crown under the Tear, a black disc on its brow. It walks on four legs and fights with claws, tail and breath.
 *
 * Every other boss pushes heroes away; its own mechanic, Wingshade, by the clock in every phase, asks them to run in under its wings.
 * Its back is its most dangerous side (Tail Sweep), and after a sweep its tail can be pinned (+40 on the gauge).
 *
 * Phases: Shadowfall; Taking Wing (66 %), which opens with its stage, Shadows Stand (it hovers over the middle and three Cast shades
 * shoot; kill them for a kneel, or Tearfall burns the roof); Totality (33 %), which opens with The Eclipse Rolls (its disc rolls out
 * along the floor and back).
 *
 * Fought by one hero or two in the Roost. A party fights it there too, with its band's HP: not tuned for a party.
 */

const C = { x: RING.x, z: RING.z };
const NUMBERS = RAID_BOSSES.wyrm;
const MODEL = 'models/bosses/wyrm.glb';
/** How far its body reaches from its middle (m). */
const BODY_R = 2.3;

/** Its fire: the Tear's violet with the swallowed sun's gold in it. */
const VIOLET = 0x8a6af0;
const PINK = 0xff6ab8;
const GOLDEN = 0xffc870;
const SPARK = 0xd8a0ff;

const atTarget = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });
const deg = THREE.MathUtils.degToRad;
const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });

/** How far from (x, z) along yaw `a` to the edge of the roof, less `pad` (m). */
function toRim(x: number, z: number, a: number, pad: number) {
  const dx = Math.sin(a), dz = Math.cos(a), px = x - C.x, pz = z - C.z, R = ROOST_R - pad;
  const b = px * dx + pz * dz, cc = px * px + pz * pz - R * R;
  return Math.max(0, -b + Math.sqrt(Math.max(0, b * b - cc)));
}

/** A wedge of its fire on the floor, turned each frame (the breath): an additive fan, bright at its root. */
function fireWedge(radius: number, angle: number) {
  const half = angle / 2;
  const geo = new THREE.CircleGeometry(radius, 24, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
  // CircleGeometry's wedge points along +y, which rotateX takes to -z; the yaw below measures from +z, so turn it round.
  geo.rotateY(Math.PI);
  const colors: number[] = [];
  const P = geo.attributes.position, hot = new THREE.Color(GOLDEN), cool = new THREE.Color(VIOLET), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const d = Math.hypot(P.getX(i), P.getZ(i)) / radius;
    c.copy(hot).lerp(cool, Math.min(1, d * 1.3));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.12;
  mesh.renderOrder = 3;
  return { mesh, mat, dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
}

// --- every phase ------------------------------------------------------------------------------------------------------

/** Claw Rake: three lanes fan from its front. They start past its claws and widen apart as they go: step into a gap, or get round it. */
const RAKE = { from: 3.2, to: 12, width: 1.4, apart: 26, share: 0.16 };
const rake: BossMove = {
  id: 'rake', name: 'Claw Rake', charge: 1.5, lock: 1.9, cooldown: 5, range: 9, pose: 'swing',
  body: { name: 'rake', seconds: 1.5 },
  aim: atTarget,
  play(c, p) {
    const at = p.shown(1.5);
    const threats: Threat[] = [-1, 0, 1].map((k) => {
      const a = c.dir + deg(RAKE.apart) * k, dx = Math.sin(a), dz = Math.cos(a);
      return {
        shape: { kind: 'line', x1: c.fx + dx * RAKE.from, z1: c.fz + dz * RAKE.from, x2: c.fx + dx * RAKE.to, z2: c.fz + dz * RAKE.to, width: RAKE.width },
        at, share: RAKE.share, knock: 1.5,
      };
    });
    return {
      threats, duration: at + 0.5,
      look: {
        land() {
          for (let k = -1; k <= 1; k++) {
            const a = c.dir + deg(RAKE.apart) * k;
            for (let j = 0; j < 4; j++) {
              const r = RAKE.from + ((RAKE.to - RAKE.from) * (j + 0.5)) / 4, x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
              p.sparks.emit(x, 0.3, z, 5, 3, 2.2, 0.5, SPARK);
              p.glows.flash(x, z, 1.1, VIOLET, 0.4, 0.25);
            }
          }
          p.shake(0.05);
        },
      },
    };
  },
};

/**
 * Tail Sweep: it turns its back on the hero it aims at and sweeps the floor behind and beside it. Get in front of it, or far away.
 * Then its tail lies out behind it a moment, its tip a gold spot: Pin the Tail (hold it 1.5 s) for +40 on the gauge.
 */
const TAIL = { radius: 7, angle: 230, share: 0.2, pinOut: 6.2, pinR: 1.2, pinHold: 1.5, pinFor: 3.5 };
const tail: BossMove = {
  id: 'tail', name: 'Tail Sweep', charge: 1.4, lock: 2.2, cooldown: 6, range: 8, pose: 'swing',
  body: { name: 'tail', seconds: 1.4 },
  // It faces away from the hero: its back, and the sweep, are toward them.
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(c.boss.x - c.target.x, c.boss.z - c.target.z) }),
  play(c, p) {
    const at = p.shown(1.4), back = c.dir + Math.PI, end = at + TAIL.pinFor;
    const px = c.fx + Math.sin(back) * TAIL.pinOut, pz = c.fz + Math.cos(back) * TAIL.pinOut;
    let time = 0, pinned = false;
    const light = new LightPillar(px, pz, TAIL.pinR, 4, STAND_COLOR), held = new HoldRing(px, pz, TAIL.pinR, STAND_COLOR);
    p.group.add(light.mesh, held.mesh);
    const open = () => !pinned && time >= at + 0.2 && time < end;
    const objectives: Objective[] = [{ part: 0, x: px, z: pz, radius: TAIL.pinR, hold: TAIL.pinHold, until: end, can: () => open() }];
    return {
      threats: [{ shape: { kind: 'cone', x: c.fx, z: c.fz, radius: TAIL.radius, angle: TAIL.angle, dir: back }, at, share: TAIL.share, knock: 3 }],
      objectives, duration: end + 0.3,
      look: {
        update(t) {
          time = t;
          const on = open();
          light.opacity = on ? 0.45 + 0.15 * Math.sin(t * 5) : 0;
          held.set(on ? objectives[0].held ?? 0 : 0);
        },
        land() {
          for (let k = -4; k <= 4; k++) {
            const a = back + (k / 4) * deg(TAIL.angle / 2), r = TAIL.radius * 0.7;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.3, z, 4, 3.5, 2, 0.55, SPARK);
            p.glows.flash(x, z, 1.3, VIOLET, 0.4, 0.25);
          }
          p.shake(0.07);
          p.hint('Stand on its tail’s gold tip to pin it');
        },
        done() {
          if (pinned) return;
          pinned = true;
          p.reward('pin', c.id);
          p.show.triumph(px, pz, 0xffd890, 0.8);
          p.say('TAIL PINNED', '#ffe27a', px, pz);
        },
        dispose() {
          light.dispose();
          held.dispose();
        },
      },
    };
  },
};

/**
 * Shadow Breath: after it draws breath, a cone of its fire sweeps across its front from one side to the other. While it draws breath
 * its head turns to the side the fire starts on and the fire glows there, faint: step round to that side (past where it starts) or
 * behind it, or out past its reach. Whoever the cone passes over burns once.
 */
const BREATH = { radius: 11, width: 28, sweep: 110, seconds: 1.6, share: 0.13 };
const breath: BossMove = {
  id: 'breath', name: 'Shadow Breath', charge: 1.6, lock: 3.6, cooldown: 9, range: 10, pose: 'thrust',
  body: { name: 'breath', seconds: 1.6 },
  // Which side it starts on, a roll of the brain's: the cast is aimed at a spot on that side, so the body turns its head there first
  // (its look reads the side from where the step is aimed) and both screens read the side from the cast.
  aim: (c) => {
    const dir = Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z), side = seeded(c.seed)() < 0.5 ? -1 : 1, a = dir + side * deg(BREATH.sweep / 2);
    return { x: c.boss.x + Math.sin(a) * 6, z: c.boss.z + Math.cos(a) * 6, dir };
  },
  play(c, p) {
    const warm = p.shown(1.6), end = warm + BREATH.seconds;
    const side = Math.sin(Math.atan2(c.x - c.fx, c.z - c.fz) - c.dir) < 0 ? -1 : 1;
    const from = c.dir + side * deg(BREATH.sweep / 2), turn = -side * deg(BREATH.sweep);
    const angleAt = (t: number) => from + turn * Math.min(1, Math.max(0, (t - warm) / BREATH.seconds));
    const half = deg(BREATH.width / 2);
    const hits = (x: number, z: number, t: number) => {
      if (t < warm || t > end) return false;
      const dx = x - c.fx, dz = z - c.fz, d = Math.hypot(dx, dz);
      if (d > BREATH.radius || d < 0.6) return false;
      const diff = Math.atan2(Math.sin(Math.atan2(dx, dz) - angleAt(t)), Math.cos(Math.atan2(dx, dz) - angleAt(t)));
      return Math.abs(diff) <= half;
    };
    const fire = fireWedge(BREATH.radius, deg(BREATH.width));
    fire.mesh.position.x = c.fx;
    fire.mesh.position.z = c.fz;
    p.group.add(fire.mesh);
    const threats: Threat[] = [
      // What it will sweep, while it draws breath: an AI keeps out of all of it.
      { shape: { kind: 'cone', x: c.fx, z: c.fz, radius: BREATH.radius, angle: BREATH.sweep + BREATH.width, dir: c.dir }, at: warm, share: 0, warn: true },
      // An AI sees the whole sweep ahead (as a person sees the fan of its fire turn), not only the next second of it.
      { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: BREATH.radius }, at: warm, to: end, every: 99, share: BREATH.share, hits, look: BREATH.seconds + 0.6 },
    ];
    return {
      threats, duration: end + 0.4,
      look: {
        update(t, dt) {
          // Drawing breath: a faint glow where the fire will start, growing. Then the fire itself.
          const on = t < warm ? 0.12 + 0.2 * (t / warm) : t < end ? 0.85 : Math.max(0, 0.85 - (t - end) * 3);
          fire.mat.opacity = on;
          fire.mesh.rotation.y = angleAt(t);
          // Its head follows the fire (the body's look reads this).
          WYRM_LIVE.sweep = t < warm || t > end + 0.4 ? -1 : (t - warm) / BREATH.seconds;
          WYRM_LIVE.side = side;
          if (on > 0 && Math.random() < dt * 40) {
            const a = angleAt(t) + (Math.random() - 0.5) * 2 * half, r = 2 + Math.random() * (BREATH.radius - 2);
            p.sparks.emit(c.fx + Math.sin(a) * r, 0.4, c.fz + Math.cos(a) * r, 2, 2.5, 2.5, 0.5, Math.random() < 0.4 ? GOLDEN : SPARK);
          }
        },
        land() {
          p.shake(0.04);
        },
        dispose() {
          WYRM_LIVE.sweep = -1;
          fire.dispose();
        },
      },
    };
  },
};

/**
 * Wingshade, on its own clock in every phase: the Tear above flares and the whole roof burns, except under its wings. Run in to it: within
 * 4.8 m of its middle (a gold circle) is safe. It is `due` (first 14 s in, then each `cooldown`), as Ash's Charge is, so it waits for the
 * move before it to end, a kneel and the stage: a move by the phase's clock (`BossPhase.timed`) is sent whatever the boss is doing.
 */
const SHADE = { inner: 4.8, share: 0.38, shown: 3.2 };
const shade: BossMove = {
  id: 'shade', name: 'Wingshade', charge: SHADE.shown, lock: SHADE.shown + 0.6, cooldown: 22, due: 14, big: true, pose: 'raise',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) }),
  play(c, p) {
    const at = p.shown(SHADE.shown);
    const light = new LightPillar(c.fx, c.fz, SHADE.inner - 0.2, 5, STAND_COLOR);
    p.group.add(light.mesh);
    p.hint('Run in under its wings');
    return {
      threats: [{ shape: { kind: 'ring', x: c.fx, z: c.fz, inner: SHADE.inner, outer: ROOST_R * 2 + 4 }, at, share: SHADE.share }],
      duration: at + 0.6,
      look: {
        update(t) {
          light.opacity = t < at ? 0.2 + 0.35 * (t / at) : Math.max(0, 0.55 - (t - at) * 1.5);
        },
        land() {
          p.flash('#ffd6f4', 0.45);
          p.show.ring(c.fx, c.fz, { radius: ROOST_R, life: 0.7, color: 0xffb0e0, width: 1.2 });
          p.show.rays(c.fx, c.fz, { count: 10, length: ROOST_R, life: 0.6, core: 0xfff0ff, glow: PINK, width: 0.7 });
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2, r = SHADE.inner + 1 + Math.random() * 6;
            p.sparks.emit(c.fx + Math.sin(a) * r, 0.3, c.fz + Math.cos(a) * r, 4, 3, 3, 0.6, PINK);
          }
          p.shake(0.12);
        },
        dispose() {
          light.dispose();
        },
      },
    };
  },
};

// --- phase 2, Taking Wing ---------------------------------------------------------------------------------------------

/**
 * Shadows Stand, the stage: it takes wing over the middle in a shell of the Tear's light and can't be hurt, and three Cast shades
 * stand up out of its shadow round the roof and shoot. Cut them down before its bar fills and it comes down hard and kneels; if not,
 * Tearfall burns the whole roof.
 */
const stage = stageMove({
  id: 'stand', name: 'Shadows Stand', pose: 'channel',
  hold: { x: C.x, z: C.z }, shell: { radius: 3.4, y: 4.2, color: VIOLET },
  center: C, ring: 8.5, turns: [[0, 120, 240], [60, 180, 300]],
  look: castShadeLook, color: '#2a2440', shot: 'beam', shotColor: PINK,
  fail: { share: 0.5, cover: false, radius: ROOST_R + 1, text: 'TEARFALL', blast: 'flare' },
  win: 'THE WYRM FALLS', hint: 'Cut down its three shadows before its bar fills',
});
/** The same stage, and its body in the air while it lasts. */
const stand: BossMove = {
  ...stage,
  play(c, p) {
    const played = stage.play(c, p);
    if (c.step !== 0) return played;
    WYRM_LIVE.hover = true;
    const look = played.look;
    const land = () => { WYRM_LIVE.hover = false; };
    return {
      ...played,
      look: {
        ...look,
        off() { land(); look?.off?.(); },
        dispose() { land(); look?.dispose?.(); },
      },
    };
  },
};

/** Tearfall: three shards of the Tear's light, each where the hero stands then. Keep walking. */
const rain: BossMove = {
  id: 'rain', name: 'Tearfall', charge: 2.2, lock: 2.6, cooldown: 10, steps: [0, 0.9, 1.8], chases: true, pose: 'raise',
  body: { name: 'rain', seconds: 1.3 },
  aim: atTarget,
  play(c, p) {
    const at = p.shown(1.3), r = 2.2;
    p.show.meteor(new THREE.Vector3(c.x + 1.5, 16, c.z - 6), new THREE.Vector3(c.x, 0, c.z), at, { core: 0xfff0ff, glow: PINK, size: 0.7, trail: 3 });
    return {
      threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: r }, at, share: 0.14 }], duration: at + 0.5,
      look: {
        land() {
          p.show.ring(c.x, c.z, { radius: r + 0.8, life: 0.45, color: 0xffb0e0, width: 0.4 });
          p.sparks.emit(c.x, 0.4, c.z, 16, 4, 3.5, 0.6, PINK);
          p.glows.flash(c.x, c.z, r, VIOLET, 0.5, 0.3);
          p.shake(0.05);
        },
      },
    };
  },
};

/** Wing Gust: both wings beat forward. A cone in front; whoever it catches is thrown back. */
const gust: BossMove = {
  id: 'gust', name: 'Wing Gust', charge: 1.3, lock: 1.8, cooldown: 8, range: 9, pose: 'burst',
  body: { name: 'gust', seconds: 1.3 },
  aim: atTarget,
  play(c, p) {
    const at = p.shown(1.3), radius = 9, angle = 80;
    return {
      threats: [{ shape: { kind: 'cone', x: c.fx, z: c.fz, radius, angle, dir: c.dir }, at, share: 0.12, knock: 4 }], duration: at + 0.5,
      look: {
        land() {
          for (let k = -3; k <= 3; k++) {
            const a = c.dir + (k / 3) * deg(angle / 2);
            for (const r of [3, 5.5, 8]) p.sparks.emit(c.fx + Math.sin(a) * r, 0.6, c.fz + Math.cos(a) * r, 2, 5, 1.2, 0.45, 0xd0c8ff);
          }
          p.shake(0.05);
        },
      },
    };
  },
};

// --- phase 3, Totality ------------------------------------------------------------------------------------------------

/**
 * The Eclipse Rolls: the black disc leaves its brow and rolls along the floor in a straight line, from it through where the hero stood
 * to the rim, and back along the same line. Step off the line, and stay off it on the way back.
 */
const ROLL = { r: 1.3, speed: 9, share: 0.18, start: 2.2 };
const discGeo = new THREE.CylinderGeometry(ROLL.r, ROLL.r, 0.36, 32).rotateZ(Math.PI / 2);
const coronaGeo = new THREE.TorusGeometry(ROLL.r + 0.08, 0.17, 6, 40).rotateY(Math.PI / 2);
/** The pink glow round its corona, and the track it rolls along (a strip of the floor, 1 m long, stretched along its line). */
const haloGeo = new THREE.TorusGeometry(ROLL.r + 0.3, 0.32, 6, 40).rotateY(Math.PI / 2);
const trackGeo = new THREE.PlaneGeometry(ROLL.r * 2, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
const roll: BossMove = {
  id: 'roll', name: 'The Eclipse Rolls', charge: 1.6, lock: 2.2, cooldown: 11, pose: 'thrust',
  body: { name: 'roll', seconds: 1.6 },
  aim: atTarget,
  play(c, p) {
    const warm = p.shown(1.6), dx = Math.sin(c.dir), dz = Math.cos(c.dir);
    const far = Math.max(ROLL.start + 1, toRim(c.fx, c.fz, c.dir, 0.9));
    const out = (far - ROLL.start) / ROLL.speed, end = warm + out * 2;
    /** How far along its line the disc is at `t`. */
    const along = (t: number) => {
      const u = t - warm;
      return u <= 0 ? ROLL.start : u < out ? ROLL.start + u * ROLL.speed : Math.max(ROLL.start, far - (u - out) * ROLL.speed);
    };
    const hits = (x: number, z: number, t: number) => {
      if (t < warm || t > end) return false;
      const s = along(t);
      return Math.hypot(x - (c.fx + dx * s), z - (c.fz + dz * s)) <= ROLL.r + 0.25;
    };
    const black = new THREE.MeshStandardMaterial({ color: 0x0b0a12, roughness: 0.6, metalness: 0.2 });
    const rim = new THREE.MeshBasicMaterial({ color: GOLDEN, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    // Its line on the floor while it rolls, pale orange (leave), out to the rim: it comes back along it.
    const trackMat = new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(c.fx + dx * ROLL.start, 0.06, c.fz + dz * ROLL.start);
    track.rotation.y = c.dir;
    track.scale.z = far - ROLL.start;
    track.renderOrder = 2;
    p.group.add(track);
    const disc = new THREE.Group();
    disc.add(new THREE.Mesh(discGeo, black), new THREE.Mesh(coronaGeo, rim), new THREE.Mesh(haloGeo, halo));
    disc.rotation.y = c.dir;
    disc.visible = false;
    p.group.add(disc);
    const wheel = disc.children[0];
    const threats: Threat[] = [
      // Its line, while it gets ready: the way out and back.
      { shape: { kind: 'line', x1: c.fx + dx * ROLL.start, z1: c.fz + dz * ROLL.start, x2: c.fx + dx * far, z2: c.fz + dz * far, width: ROLL.r * 2 }, at: warm, share: 0, warn: true },
      { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: far + ROLL.r }, at: warm, to: end, every: 99, share: ROLL.share, hits, look: end - warm + 0.6 },
    ];
    return {
      threats, duration: end + 0.3,
      look: {
        update(t, dt) {
          const live = t >= warm && t <= end;
          WYRM_LIVE.disc = !live;
          disc.visible = live;
          trackMat.opacity = live ? 0.22 : 0;
          if (!live) return;
          const s = along(t);
          disc.position.set(c.fx + dx * s, ROLL.r, c.fz + dz * s);
          const back = t - warm > out ? -1 : 1;
          wheel.rotation.x += back * (ROLL.speed / ROLL.r) * dt;
          if (Math.random() < dt * 30) p.sparks.emit(disc.position.x, 0.2, disc.position.z, 2, 2, 1.5, 0.45, GOLDEN);
          if (Math.abs(t - warm - out) < dt) {
            p.show.ring(disc.position.x, disc.position.z, { radius: 2.4, life: 0.4, color: 0xffd890, width: 0.35 });
            p.shake(0.05);
          }
        },
        dispose() {
          WYRM_LIVE.disc = true;
          disc.removeFromParent();
          track.removeFromParent();
          trackMat.dispose();
          halo.dispose();
          black.dispose();
          rim.dispose();
        },
      },
    };
  },
};

const PHASES: BossPhase[] = [
  { name: 'Shadowfall', at: 1, moves: ['rake', 'tail', 'breath', 'shade'], gap: [2, 3] },
  { name: 'Taking Wing', at: NUMBERS.phases[0], moves: ['rake', 'tail', 'breath', 'rain', 'gust', 'shade'], opener: 'stand', gap: [1.9, 2.8] },
  { name: 'Totality', at: NUMBERS.phases[1], moves: ['rake', 'tail', 'breath', 'rain', 'gust', 'roll', 'shade'], opener: 'roll', gap: [1.6, 2.5] },
];

/** Its portrait: a black disc with a gold corona, a violet wing behind it, on the night of the Tear. */
function portrait(g: CanvasRenderingContext2D, s: number) {
  const m = s / 2;
  const bg = g.createRadialGradient(m, m * 0.9, s * 0.05, m, m, m * 1.1);
  bg.addColorStop(0, '#5a3aa8');
  bg.addColorStop(0.55, '#1c1640');
  bg.addColorStop(1, '#08060f');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#6a49c8';
  g.beginPath();
  g.moveTo(m * 0.2, m * 1.6);
  g.lineTo(m * 0.55, m * 0.45);
  g.lineTo(m * 1.45, m * 0.45);
  g.lineTo(m * 1.8, m * 1.6);
  g.lineTo(m, m * 1.25);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ffc870';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.arc(m, m * 0.95, s * 0.24, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#0b0a12';
  g.beginPath();
  g.arc(m, m * 0.95, s * 0.21, 0, Math.PI * 2);
  g.fill();
}

export const ECLIPSE_WYRM: BossDef = {
  id: 'wyrm',
  name: 'The Eclipse Wyrm',
  title: 'Shadow of the Fallen Sun',
  place: wyrmRoostArena,
  gates: { enter: 0, exit: 180 },
  starts: {
    boss: { x: C.x, z: C.z - 2.5 },
    heroes: [{ x: C.x, z: C.z + 9.5 }, { x: C.x - 1.6, z: C.z + 9.5 }, { x: C.x + 1.6, z: C.z + 9.5 }],
  },
  kit: (hp) => {
    // A new fight: its disc on its brow, on the ground.
    resetWyrmLive();
    return {
      name: 'The Eclipse Wyrm', title: 'Shadow of the Fallen Sun', accent: '#6a49c8', foil: '#ffc870', portrait, model: MODEL, look: wyrmLook, maxHp: hp,
      spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')],
    } as HeroKit;
  },
  hp: NUMBERS.hp,
  scale: 1,
  body: { radius: BODY_R, height: 6.5 },
  speed: 2.2,
  keepAt: 4.8,
  staggerMax: NUMBERS.staggerMax,
  kneel: NUMBERS.kneel,
  phasePause: 2.5,
  phases: PHASES,
  /** A higher tier brings these in from the first phase on, one a tier. */
  extra: ['rain', 'gust', 'roll'],
  moves: { rake, tail, breath, shade, stand, rain, gust, roll },
  /** It enrages 2:40 in: the last boss of a run, measured to clear about as often as the Warden (pipeline/designs/raid-wyrm.md). */
  enrage: 160,
  /** Past 5 minutes the Tear's light comes down from the rim inward, and at 6 Last stand ends it. */
  late: () => ({
    offset: -255,
    shift: new ArenaShift('The Tear opens', 0xb050d0, '#ff9ae0', [
      { at: 45, zones: [{ shape: { kind: 'ring', x: C.x, z: C.z, inner: 6, outer: ROOST_R }, share: 0.03 }] },
    ], new ZoneFloor('sun', [{ edge: 6 }], undefined, undefined, ROOST_R), ROOST_R),
  }),
};
