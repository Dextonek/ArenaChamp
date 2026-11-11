import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { DEFAULT_STAGE, RING, floorDisc } from './common';
import layout from './real/cavern.json';
import type { RealLayout } from './real';
import type { ArenaDef } from './types';

/** Crystal Cavern: a placeholder until the arena is built (see `harbour.ts` for a finished one). */
const LAYOUT = layout as RealLayout;
export const CAVERN_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

export const cavernArena: ArenaDef = {
  id: 'cavern',
  name: 'Crystal Cavern',
  obstacles: CAVERN_OBSTACLES,
  stage: DEFAULT_STAGE,
  build() {
    const g = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: 0.6 });
    const floor = floorDisc(RING.r, material);
    g.add(floor);
    return { group: g, dispose: () => { floor.geometry.dispose(); material.dispose(); } };
  },
};
