import * as THREE from 'three';
import { RING, seeded } from '../arenas/common';
import { TOWER_R } from '../arenas/tower';
import { FallingStone, LightPillar } from '../raid/fx';
import { LEAVE_ALPHA, LEAVE_COLOR, STAND_COLOR } from '../raid/script';
import type { AimContext, BossMove, PlayContext, PlayedMove, RaidAdd, Threat } from '../raid/types';

/**
 * What a Tower floor does to a hero, as moves on the Raid's engine (src/raid/types.ts): the same rules, the same two colours.
 * Pale orange means leave, gold means stand here. A room with nobody in it (a gauntlet, a time to hold out) has a brain all the
 * same, and it casts these at the hero by its clock; an echo of a hero casts its own from where it stands.
 *
 * `share`: what a hit costs, as a share of the hero's max health, already raised for the floor's height.
 */

const atHero = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });
const WHITE = 0xfff4e0;
const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();

/** A room's own move: no cast bar, no pose, and nobody stands still for it. */
export const ofRoom = (m: BossMove): BossMove => ({ ...m, quiet: true, lock: 0 });

/** Stones fall where you stood, one after another: keep walking. An echo that casts from range calls down light instead. */
export function stones(o: { id?: string; name?: string; share: number; radius?: number; count?: number; light?: boolean; cooldown?: number }): BossMove {
  const r = o.radius ?? 1.9, n = o.count ?? 3;
  return {
    id: o.id ?? 'stones', name: o.name ?? 'Falling Stones', charge: 1.3, lock: 1.2, cooldown: o.cooldown ?? 4, chases: true, pose: 'raise',
    steps: Array.from({ length: n }, (_, i) => i * 0.75),
    aim: atHero,
    play(c, p): PlayedMove {
      const land = p.shown(1.3);
      const stone = o.light ? null : new FallingStone(c.x, c.z, r, land);
      if (stone) p.group.add(stone.mesh);
      else p.show.column(c.x, c.z, { radius: r * 0.7, height: 12, life: 0.5, color: WHITE, delay: land - 0.12, peak: 0.7 });
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: r }, at: land, share: o.share }], duration: land + 1.6,
        look: {
          update: (t) => stone?.update(t),
          land: () => {
            p.sparks.emit(c.x, 0.3, c.z, 18, 4, 3, 0.6, o.light ? 0xffe8c0 : 0xd8c8a8);
            p.show.ring(c.x, c.z, { radius: r + 0.9, life: 0.5, color: o.light ? WHITE : 0xd8c8a8, width: 0.35, peak: 0.6 });
            p.shake(0.03);
          },
          dispose: () => stone?.mesh.removeFromParent(),
        },
      };
    },
  };
}

/** A band of the room a fire can sweep: from `z0` to `z1`, south to north. */
export interface SweepBand { z0: number; z1: number }

const barGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/**
 * Sweeping fire: a wall of flame crosses the room from one side to the other, in the half of its band where the hero stood
 * when it was called. It waits a moment at the wall first, so you see which half, then it comes: step into the other half.
 * It burns for as long as you stand in it.
 */
export function sweep(o: { bands: SweepBand[]; share: number; speed?: number; cooldown?: number }): BossMove {
  const speed = o.speed ?? 3.3, thick = 1.3;
  return {
    id: 'sweep', name: 'Sweeping Fire', charge: 1.2, lock: 0, cooldown: o.cooldown ?? 6, quiet: true, pose: 'channel',
    aim: (c) => ({ x: c.target.x, z: c.target.z, dir: 0 }),
    play(c, p): PlayedMove {
      const rng = seeded(c.seed);
      const band = o.bands.find((b) => c.z >= b.z0 - 0.3 && c.z <= b.z1 + 0.3) ?? o.bands[Math.floor(rng() * o.bands.length)];
      const mid = (band.z0 + band.z1) / 2;
      const [za, zb] = c.z < mid ? [band.z0, mid] : [mid, band.z1];
      // From the side the hero is farther from, so it is seen coming.
      const dir = c.x > RING.x ? 1 : -1, x0 = RING.x - dir * (TOWER_R + 0.5), far = TOWER_R * 2 + 1;
      const warn = p.shown(1.2), end = warn + far / speed;
      const xAt = (t: number) => x0 + dir * speed * Math.min(far / speed, Math.max(0, t - warn));
      const shapeAt = (t: number) => ({ kind: 'line' as const, x1: xAt(t), z1: za, x2: xAt(t), z2: zb, width: thick });
      const mat = new THREE.MeshBasicMaterial({ color: LEAVE_COLOR, transparent: true, opacity: 0, depthWrite: false });
      const bar = new THREE.Mesh(barGeo, mat);
      bar.scale.set(thick, 1, zb - za);
      bar.renderOrder = 2;
      const edge = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0, depthWrite: false }));
      edge.scale.set(0.18, 1, zb - za);
      edge.renderOrder = 3;
      p.group.add(bar, edge);
      let puff = 0;
      return {
        threats: [{ shape: shapeAt(0), shapeAt, at: warn, to: end, every: 0.5, share: o.share, look: 1.7 }],
        duration: end + 0.4,
        look: {
          update(t, dt) {
            const x = xAt(t), z = (za + zb) / 2;
            bar.position.set(x, 0.05, z);
            edge.position.set(x + dir * thick * 0.5, 0.06, z);
            // Gathering at the wall, then burning as it goes, then out.
            const k = t < warn ? 0.25 + 0.3 * (t / warn) + 0.12 * Math.sin(t * 16) : t < end ? LEAVE_ALPHA : Math.max(0, LEAVE_ALPHA * (1 - (t - end) * 3));
            mat.opacity = k;
            (edge.material as THREE.MeshBasicMaterial).opacity = t >= warn && t < end ? 0.9 : 0;
            puff -= dt;
            if (t >= warn && t < end && puff <= 0) {
              puff = 0.07;
              const f = Math.random();
              p.sparks.emit(x, 0.2, za + (zb - za) * f, 3, 1.4, 3.4, 0.55, f < 0.5 ? 0xff9a40 : 0xffc070, 2);
            }
          },
          dispose() {
            bar.removeFromParent();
            edge.removeFromParent();
            mat.dispose();
            (edge.material as THREE.Material).dispose();
          },
        },
      };
    },
  };
}

/** Four wedges of the room burn, then the four between them: stand between, then step into where the first fired. */
export function spokes(o: { share: number; cooldown?: number }): BossMove {
  return {
    id: 'spokes', name: 'Turning Fire', charge: 2, lock: 2, cooldown: o.cooldown ?? 9, pose: 'slam',
    aim: (c) => ({ x: RING.x, z: RING.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) }),
    play(c, p): PlayedMove {
      const first = p.shown(2), second = first + p.shown(1.3), base = (c.seed % 360) * (Math.PI / 180);
      const wedge = (k: number, at: number, show: number): Threat => ({
        shape: { kind: 'cone', x: RING.x, z: RING.z, radius: TOWER_R + 0.5, angle: 45, dir: base + k * (Math.PI / 4) }, at, show, share: o.share,
      });
      const threats = [0, 2, 4, 6].map((k) => wedge(k, first, 0)).concat([1, 3, 5, 7].map((k) => wedge(k, second, first)));
      // One ring of heat out of the middle for each four that land.
      let rang = -1;
      return {
        threats, duration: second + 0.8,
        look: {
          land(th) {
            if (th.at === rang) return;
            rang = th.at;
            p.show.ring(RING.x, RING.z, { radius: TOWER_R, life: 0.5, color: 0xffa860, width: 0.9, peak: 0.5 });
            p.shake(0.03);
          },
        },
      };
    },
  };
}

/** Half the room burns, the half you stand in: cross to the other. */
export function halves(o: { share: number; cooldown?: number }): BossMove {
  return {
    id: 'halves', name: 'The Room Tilts', charge: 3, lock: 3, cooldown: o.cooldown ?? 10, pose: 'slam',
    aim(c) {
      // Toward the hero from the middle, turned a way to one side: its edge is never straight behind you.
      const turn = ((c.seed % 2 ? 1 : -1) * (35 + (c.seed % 26)) * Math.PI) / 180;
      return { x: RING.x, z: RING.z, dir: Math.atan2(c.target.x - RING.x, c.target.z - RING.z) + turn };
    },
    play(c, p): PlayedMove {
      const at = p.shown(3);
      return {
        threats: [{ shape: { kind: 'cone', x: RING.x, z: RING.z, radius: TOWER_R + 0.5, angle: 180, dir: c.dir }, at, share: o.share, look: 2.6 }],
        duration: at + 0.8,
        look: { land: () => { p.flash('rgba(255,150,70,0.8)', 0.18); p.shake(0.05); } },
      };
    },
  };
}

/** The walls burn, then the middle: come in, then go out. Round an echo it is the other way: near it, then far. */
export function tide(o: { share: number; cooldown?: number; inner?: number; near?: boolean; id?: string; name?: string }): BossMove {
  const inner = o.inner ?? 6.5;
  return {
    id: o.id ?? 'tide', name: o.name ?? 'Tide of Fire', charge: 2, lock: 2, cooldown: o.cooldown ?? 10, pose: 'slam',
    aim: (c) => (o.near ? { x: c.boss.x, z: c.boss.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) } : { x: RING.x, z: RING.z, dir: 0 }),
    play(c, p): PlayedMove {
      const first = p.shown(o.near ? 1.5 : 2), second = first + p.shown(1.4);
      const circle: Threat['shape'] = { kind: 'circle', x: c.x, z: c.z, radius: inner };
      const ring: Threat['shape'] = { kind: 'ring', x: c.x, z: c.z, inner, outer: o.near ? inner * 2.1 : TOWER_R * 2 };
      const threats: Threat[] = o.near
        ? [{ shape: circle, at: first, share: o.share }, { shape: ring, at: second, show: first, share: o.share }]
        : [{ shape: ring, at: first, share: o.share }, { shape: circle, at: second, show: first, share: o.share }];
      return {
        threats, duration: second + 0.8,
        look: { land: (th) => p.show.ring(c.x, c.z, { radius: th.shape.kind === 'circle' ? inner : inner * 2, life: 0.6, color: 0xffa860, width: 0.8, peak: 0.6 }) },
      };
    },
  };
}

/**
 * A gold circle a few steps off: stand in it before it lands, or pay. Nothing else is called until it has landed (`lock`): a
 * stone called onto the circle would say "leave" where the circle says "stand", and the autopilot obeys the stone.
 */
export function stand(o: { share: number; cooldown?: number }): BossMove {
  return {
    id: 'stand', name: 'The Lantern Calls', charge: 4.2, lock: 4.4, cooldown: o.cooldown ?? 14, quiet: true, pose: 'raise',
    aim(c) {
      // A few steps from the hero, on the middle's side and a way round, and never at the wall.
      const back = Math.atan2(RING.x - c.target.x, RING.z - c.target.z) + (((c.seed % 121) - 60) * Math.PI) / 180;
      let x = c.target.x + Math.sin(back) * 5.5, z = c.target.z + Math.cos(back) * 5.5;
      const d = Math.hypot(x - RING.x, z - RING.z), most = TOWER_R - 3;
      if (d > most) { x = RING.x + ((x - RING.x) / d) * most; z = RING.z + ((z - RING.z) / d) * most; }
      return { x, z, dir: 0 };
    },
    play(c, p): PlayedMove {
      const at = p.shown(4.2), r = 2.3;
      const light = new LightPillar(c.x, c.z, r, 4.5, STAND_COLOR);
      p.group.add(light.mesh);
      p.hint('Gold means stand here');
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: r }, kind: 'stand', at, share: o.share }], duration: at + 0.6,
        look: {
          update: (t) => { light.opacity = t < at ? 0.45 + 0.2 * Math.sin(t * 5) : Math.max(0, 0.6 * (1 - (t - at) * 3)); },
          land: () => p.show.column(c.x, c.z, { radius: r * 0.9, height: 9, life: 0.6, color: STAND_COLOR, peak: 0.5 }),
          dispose: () => light.dispose(),
        },
      };
    },
  };
}

/** Each sentry still standing shoots a beam through where you stood: step aside. With none left it is nothing. */
export function volley(o: { share: number; sentries: () => readonly RaidAdd[]; cooldown?: number }): BossMove {
  return {
    id: 'volley', name: 'Sentry Fire', charge: 1.4, lock: 0, cooldown: o.cooldown ?? 4.5, quiet: true, pose: 'point',
    aim: atHero,
    play(c, p): PlayedMove {
      const at = p.shown(1.4), y = 2.2;
      const threats: Threat[] = [];
      for (const a of o.sentries()) {
        if (!a.alive) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 1, far = d + 3;
        threats.push({ shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + (dx / d) * far, z2: a.z + (dz / d) * far, width: 1.2 }, at, share: o.share });
        p.show.charge(a.x, y, a.z, at, 0xffb060, 1.4);
      }
      if (!threats.length) return { threats, duration: 0.1 };
      return {
        threats, duration: at + 1,
        look: {
          land(th) {
            const sh = th.shape;
            if (sh.kind !== 'line') return;
            p.show.beam(V0.set(sh.x1, y, sh.z1), V1.set(sh.x2, 0.7, sh.z2), { life: 0.45, core: WHITE, glow: 0xffb060, width: 1 });
            p.glows.flash(sh.x2, sh.z2, 1.6, 0xffb060, 0.4, 0.35);
          },
        },
      };
    },
  };
}

/** More of the horde come in by the doors, and whoever called them can't be hurt until they have fallen. */
export function call(o: { raise: (count: number, seed: number, p: PlayContext) => void; count: number; cooldown?: number; name?: string }): BossMove {
  return {
    id: 'call', name: o.name ?? 'The Keepers Wake', charge: 1.2, lock: 1.2, cooldown: o.cooldown ?? 16, pose: 'raise',
    aim: atHero,
    play(c, p): PlayedMove {
      o.raise(o.count, c.seed, p);
      return { threats: [], duration: 0.3 };
    },
  };
}

// --- an echo's own blows: from where it stands, at the size it is drawn -----------------------------------------

/** A wide swing: the cone in front of it. Get behind it, or back out. */
export function cleave(o: { share: number; k: number }): BossMove {
  const radius = 3.6 + 1.5 * o.k;
  return {
    id: 'cleave', name: 'Cleave', charge: 1.4, lock: 1.5, cooldown: 4, range: radius + 1.5, pose: 'swing',
    aim: atHero,
    play(c, p): PlayedMove {
      const at = p.shown(1.4);
      return {
        threats: [{ shape: { kind: 'cone', x: c.fx, z: c.fz, radius, angle: 115, dir: c.dir }, at, share: o.share, knock: 3 }], duration: at + 0.6,
        look: { land: () => { p.sparks.emit(c.fx + Math.sin(c.dir) * radius * 0.6, 0.6, c.fz + Math.cos(c.dir) * radius * 0.6, 22, 5, 2, 0.5, 0xffd0a0); p.shake(0.04); } },
      };
    },
  };
}

/** It runs through where you stood: a lane from it, and it comes down the lane as the lane lands. Step aside. */
export function lunge(o: { share: number; k: number }): BossMove {
  const length = 11, width = 1.5 + 0.7 * o.k;
  return {
    id: 'lunge', name: 'Lunge', charge: 1.3, lock: 1.9, cooldown: 7, pose: 'lunge',
    steps: [0, 1.3],
    aim(c) {
      if (c.step > 0 && c.prev) return c.prev;
      const d = Math.hypot(c.target.x - c.boss.x, c.target.z - c.boss.z) || 1, dir = Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z);
      // It stops short of the wall, and a step past where the hero stood.
      let x = c.boss.x + Math.sin(dir) * Math.min(length, d + 2.5), z = c.boss.z + Math.cos(dir) * Math.min(length, d + 2.5);
      const far = Math.hypot(x - RING.x, z - RING.z), most = TOWER_R - 2;
      if (far > most) { x = RING.x + ((x - RING.x) / far) * most; z = RING.z + ((z - RING.z) / far) * most; }
      return { x, z, dir };
    },
    // Only the screen that runs the brain moves it, as its lane lands.
    act: (world, c) => { if (c.step === 1) world.dash(c.x, c.z, 0.28); },
    play(c, p): PlayedMove {
      if (c.step > 0) return { threats: [], duration: 0.1 };
      const at = p.shown(1.3);
      return {
        threats: [{ shape: { kind: 'line', x1: c.fx, z1: c.fz, x2: c.x, z2: c.z, width }, at, share: o.share, knock: 2 }], duration: at + 0.6,
        look: { land: () => p.show.ring(c.x, c.z, { radius: 2.6, life: 0.4, color: 0xffd0a0, width: 0.4, peak: 0.6 }) },
      };
    },
  };
}

/** A fan of bolts from it: stand in a gap, or behind a pillar. */
export function fan(o: { share: number; k: number }): BossMove {
  return {
    id: 'fan', name: 'Fan of Light', charge: 1.4, lock: 1.5, cooldown: 4, pose: 'thrust',
    aim: atHero,
    play(c, p): PlayedMove {
      const at = p.shown(1.4), turns = [-0.56, -0.28, 0, 0.28, 0.56];
      const threats: Threat[] = turns.map((t) => {
        const dir = c.dir + t, stop = p.rayStop(c.fx, c.fz, c.fx + Math.sin(dir) * 16, c.fz + Math.cos(dir) * 16) * 16;
        return { shape: { kind: 'line', x1: c.fx, z1: c.fz, x2: c.fx + Math.sin(dir) * stop, z2: c.fz + Math.cos(dir) * stop, width: 0.9 + 0.3 * o.k }, at, share: o.share };
      });
      return {
        threats, duration: at + 0.6,
        look: {
          land(th) {
            const sh = th.shape;
            if (sh.kind === 'line') p.show.beam(V0.set(sh.x1, 1.4 * o.k, sh.z1), V1.set(sh.x2, 0.8, sh.z2), { life: 0.35, core: WHITE, glow: 0xffc070, width: 0.7 });
          },
        },
      };
    },
  };
}
