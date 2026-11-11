import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, floorDisc } from './common';
import layout from './real/harbour.json';
import { Glows, Sea, realGround, realProps, type RealLayout } from './real';
import type { ArenaDef } from './types';

/**
 * Drowned Harbour: the round head of a stone quay at dusk, the sea all round it. The first arena of the realistic style
 * (`real.ts`): its cover and everything round the ring are scanned props laid out in blender/arenas/real/harbour.py,
 * which also writes the obstacle list (`real/harbour.json`).
 *
 * Cover: three barrels in the middle (low), two rows of stacked sea chests guarding the starts (low), two mooring
 * dolphins with a lantern each flanking the middle (tall), two cannons on the wings aimed out to sea (low), two mossy
 * boulders in the far corners (low). Round it: a three-master moored on the left, a wooden pier leading off to the
 * right, low pier stubs and piles toward both cameras, rocks awash at the quay's foot, sea stacks far out.
 *
 * Built here: the cobbled floor (a scanned ground, dimmed into the floors' dark band and wet), the kerb and the quay's
 * wall, the sea, and the lanterns' glow (no lamps: the arena rules allow no extra lights).
 */
const LAYOUT = layout as RealLayout;
export const HARBOUR_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

/** The sea's level, as in harbour.py. */
const SEA = -1.7;
/** How far the quay's stone reaches past the ring. */
const KERB = 0.8;

/** The kerb and the wall below it: one turned profile, its UVs stretched so the cobbles keep their size. */
function quayGeometry() {
  const r = RING.r;
  // from the sea bed up the wall and in over the kerb: a profile that climbs faces outward
  const profile = [[r + KERB + 0.12, SEA - 2.5], [r + KERB + 0.03, -0.5], [r + KERB, 0.08], [r + KERB - 0.1, 0.17], [r + 0.02, 0.17], [r - 0.05, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 128);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 18, uv.getY(i) * 2.2);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

export const harbourArena: ArenaDef = {
  id: 'harbour',
  name: 'Drowned Harbour',
  obstacles: HARBOUR_OBSTACLES,
  hideGround: true,
  stage: {
    background: 0x1c2230,
    zenith: 0x0e1730,
    horizon: 0x5a5068,
    glow: 0xe89a62,
    stars: 0.25,
    fog: 0x3a4256,
    fogNear: 26,
    fogFar: 105,
    hemiSky: 0xa9c0e6,
    hemiGround: 0x2a2622,
    hemiIntensity: 0.7,
    sun: 0xffc694,
    sunIntensity: 1.5,
    rim: 0x86a6e2,
    rimIntensity: 0.9,
  },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];

    // the quay: wet cobbles, a kerb round them, the wall down into the water
    const cobbles = realGround('harbour_floor', 6, 0x34363d, 0.95, 0.25);
    const floor = floorDisc(RING.r, cobbles, 0.012, 128);
    const stone = realGround('harbour_floor', 1, 0x55585f, 0.95, 0.2);
    const quay = new THREE.Mesh(quayGeometry(), stone);
    quay.receiveShadow = true;
    quay.castShadow = true;
    g.add(floor, quay);
    own.push(floor.geometry, cobbles, quay.geometry, stone);

    const sea = new Sea({ y: SEA, inner: RING.r + KERB + 0.1, deep: 0x0d2630, sky: 0x8a7a8c, glint: 0xffc890, sun: new THREE.Vector3(0.85, 0.2, 0.25), foam: 0x9aa6ae });
    g.add(sea.mesh);
    own.push(sea);

    const glows = new Glows(LAYOUT.marks.filter((m) => m.kind === 'lantern'), 0xffa040, 1.5);
    g.add(glows.group);
    own.push(glows);

    let disposed = false;
    void realProps('harbour', HARBOUR_OBSTACLES.length, {
      dim: 0.62, env: 0.4,
      parts: { glass: { emissive: 0xffa040, strength: 2.2 }, sails: { dim: 0.5 }, rigging: { dim: 0.5 }, hull: { dim: 0.55 }, boulder_01: { dim: 0.3, tint: 0x9aa4c0 }, rock_moss: { dim: 0.3, tint: 0xa8b0c8, rough: 0.6 } },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('harbour: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        sea.update(time);
        glows.update(time);
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
