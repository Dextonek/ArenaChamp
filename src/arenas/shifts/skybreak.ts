import * as THREE from 'three';
import { RING } from '../common';
import type { HazardWorld } from '../hazards/base';
import { Sparks } from '../hazards/fx';
import type { ArenaScene } from '../types';
import { REVEAL, type ShiftLook } from './base';
import { ZoneFloor } from './floor';

/**
 * Sky Ruins: while a stage shows, dust rises along the coming edge. When it lands the scene drops the floor beyond it
 * (`ArenaScene.ringBreak`: the meshes are the arena's). Last stand is a storm over what is left.
 */
export class SkyBreakLook implements ShiftLook {
  readonly group = new THREE.Group();
  readonly drawsZones = true;
  private dust = new Sparks(180, 0.2);
  private storm: ZoneFloor;
  private showing = -1;
  private left = 0;

  constructor(private scene: ArenaScene, private radii: number[]) {
    // No edge or channels at any stage: only Last stand's whole floor, and it stops where the floor does.
    this.storm = new ZoneFloor('storm', radii.map((r) => ({ clip: r })));
    this.group.add(this.dust.points, this.storm.group);
  }

  begin(index: number) {
    this.storm.begin(index);
    this.showing = index < this.radii.length ? index : -1;
    this.left = REVEAL;
  }

  land(index: number) {
    this.storm.land(index);
    if (index < this.radii.length) this.scene.ringBreak?.(this.radii[index]);
    this.showing = -1;
  }

  update(dt: number, clock: number, world: HazardWorld) {
    this.storm.update(dt, clock, world);
    this.dust.update(dt);
    if (this.showing < 0) return;
    this.left -= dt;
    // Thicker as it gets close.
    const rate = 30 + 110 * (1 - Math.max(0, this.left) / REVEAL);
    const r = this.radii[this.showing];
    for (let n = Math.floor(dt * rate + Math.random()); n > 0; n--) {
      const a = Math.random() * Math.PI * 2;
      this.dust.emit(RING.x + Math.cos(a) * r, 0.05, RING.z + Math.sin(a) * r, 1, 0.8, 1.5, 0.9, 0x6a6f86, 2);
    }
  }
}
