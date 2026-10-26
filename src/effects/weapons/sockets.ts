import * as THREE from 'three';

/**
 * Attach points on the five Blender weapons (`public/models/weapons/*.glb`), in each weapon's own space, taken from
 * their build scripts (`blender/weapons/wp-*.py`; three (x, y, z) = Blender (x, z, -y)). Use these, never the
 * loaded geometry: effects are created before the model has finished loading.
 *
 * Every weapon: origin = centre of the grip, blade / head up +Y, its face (medallion, fan, flat of the blade)
 * towards +Z, width along X. Units are metres.
 */
export type WeaponId = 'wp-sword-dragon' | 'wp-sword-ice' | 'wp-glaive-guandao' | 'wp-hammer-thunder' | 'wp-fan-fire';

const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

export const SOCKETS = {
  'wp-sword-dragon': {
    /** Spirit orb in the guard (the focal point). */
    orb: v(0, 0.138, 0),
    tip: v(0, 1.042, 0),
    pommel: v(0, -0.152, 0),
    /** Coiled dragon's head, resting left of the orb. */
    dragonHead: v(-0.07, 0.13, 0.02),
    /** Blade: centre line from guard to tip, half width at the base. */
    bladeBase: v(0, 0.19, 0),
    bladeHalfWidth: 0.05,
    /** Dragon vertebrae along the back (-X) edge. */
    spine: [v(-0.07, 0.24), v(-0.072, 0.4), v(-0.07, 0.56), v(-0.066, 0.72)],
    /** Rough centre and radius for camera framing. */
    centre: v(0, 0.42, 0),
    radius: 0.82,
  },
  'wp-sword-ice': {
    /** The guard's white-jade hub; frost gems sit on its faces. */
    hub: v(0, 0.13, 0),
    gemFront: v(0, 0.152, 0.017),
    tip: v(0, 1.03, 0),
    pommel: v(0, -0.155, 0),
    /** Where the crystal blade grows out of its shard crown. */
    bladeBase: v(0, 0.17, 0),
    bladeHalfWidth: 0.03,
    /** Tips of the two big cloud scrolls of the guard. */
    scrollTips: [v(-0.1, 0.2, 0), v(0.1, 0.2, 0)],
    centre: v(0, 0.42, 0),
    radius: 0.72,
  },
  'wp-glaive-guandao': {
    /** Jade orb on the front of the lotus collar. */
    orb: v(0, 0.268, 0.033),
    collar: v(0, 0.25, 0),
    butt: v(0, -0.338, 0),
    tip: v(0.196, 0.978, 0),
    /** Tips of the collar's cloud wings. */
    wingTips: [v(-0.084, 0.33, 0), v(0.084, 0.33, 0)],
    /** Cutting edge (-X side), from the collar up to the point. */
    edge: [v(-0.054, 0.3), v(-0.086, 0.44), v(-0.112, 0.6), v(-0.112, 0.68), v(-0.099, 0.76), v(-0.073, 0.83),
      v(-0.029, 0.885), v(0.029, 0.925), v(0.087, 0.95), v(0.145, 0.966), v(0.196, 0.978)],
    /** Gold relief dragon, tail to head, on the front face (z = +reliefZ; the back face is mirrored). */
    relief: [v(0.006, 0.34), v(0.026, 0.39), v(-0.029, 0.45), v(0.017, 0.52), v(-0.041, 0.6), v(-0.006, 0.68),
      v(0.015, 0.74), v(0.017, 0.79), v(0.023, 0.83)],
    reliefZ: 0.0075,
    /** The haft: bottom and top of the lacquered shaft, radius. */
    haft: [v(0, -0.285), v(0, 0.2)],
    haftRadius: 0.02,
    centre: v(0.03, 0.32, 0),
    radius: 0.82,
  },
  'wp-hammer-thunder': {
    /** Taiji medallions (front faces +Z). */
    taijiFront: v(0, 0.43, 0.092),
    taijiBack: v(0, 0.43, -0.092),
    /** Head axis height and its two ends (the beast head is on +X). */
    headY: 0.43,
    headEnds: [v(-0.29, 0.43), v(0.27, 0.43)],
    beastMouth: v(0.37, 0.44, 0),
    beastEyes: [v(0.33, 0.465, 0.02), v(0.33, 0.465, -0.02)],
    spikeTop: v(0, 0.665, 0),
    bell: v(0, -0.43, 0),
    haft: [v(0, -0.31), v(0, 0.3)],
    haftRadius: 0.023,
    /** Drum radius and the x of each drum's ring of jade studs. */
    drumRadius: 0.122,
    studRingX: [-0.195, 0.195],
    centre: v(0.03, 0.15, 0),
    radius: 0.7,
  },
  'wp-fan-fire': {
    /** The pivot gem (front). */
    pivot: v(0, 0.115, 0.0105),
    pivotCentre: v(0, 0.115, 0),
    /** Rib angles from vertical (degrees, + towards +X) and the rib tip radius from the pivot. */
    ribAngles: [-75, -45, -15, 15, 45, 75],
    ribTipR: 0.345,
    /** Leaf centre angles and the leaf span from the pivot (inner, outer radius). */
    leafAngles: [-60, -30, 0, 30, 60],
    leafR: [0.06, 0.33],
    handleEnd: v(0, -0.155, 0),
    centre: v(0, 0.16, 0),
    radius: 0.62,
  },
} as const;

/** Point at `r` from the fan's pivot along `deg` from vertical (+ towards +X), at depth z. */
export function fanPoint(deg: number, r: number, z = 0): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(deg);
  const c = SOCKETS['wp-fan-fire'].pivotCentre;
  return new THREE.Vector3(c.x + Math.sin(a) * r, c.y + Math.cos(a) * r, z);
}
