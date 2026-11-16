import * as THREE from 'three';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import type { TelegraphShape } from '../../effects/telegraph';
import type { Look } from './blocks';
import type { Cast } from './spell';

/**
 * The sketch: the look a new hero's spells have until their own is drawn at gate 4 (docs/pipeline/new-hero.md). It draws only
 * what the rules already say, in the hero's accent: a bolt as the game's plain bolt, and at the impact a flat flash of the
 * hit's own shape (a circle, a cone, a strip, the sure hit's mark) that fades in 0.4 s. The danger zones come from the rules
 * as for every spell on the blocks, so a sketched spell can be played, aimed, dodged and balanced before it has a look.
 *
 * Its objects are made when the spell is first built (the constructor), never when the file is loaded: a draft's files are
 * loaded with the game's (src/heroes/index.ts keeps them out of play), and an object made on loading would shift the fight's
 * dice for every hero.
 *
 *     look: sketch(C.accent),           // in a spell file of src/heroes/<theme>/spells/
 */
export function sketch<S, K extends string = never>(color: string, rim = '#14100c') {
  const bolt: BoltLook = { core: '#fff6e8', body: color, rim, size: 0.3, trail: 2.2, hit: color };
  const FLASH = 0.4;
  return class SketchLook implements Look<S, K> {
    private bolts: BoltSet;
    private flashes: THREE.Mesh[] = [];
    private mat: THREE.MeshBasicMaterial;
    private at = -1;

    constructor(group: THREE.Group) {
      this.bolts = new BoltSet(group);
      this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
        m.visible = false;
        m.renderOrder = 2;
        this.flashes.push(m);
        group.add(m);
      }
    }

    reset() {
      this.at = -1;
      this.bolts.clear();
      this.mat.opacity = 0;
      for (const m of this.flashes) m.visible = false;
    }

    tick(dt: number) {
      this.bolts.update(dt);
    }

    released(c: Cast<S, K>) {
      if (c.bolt) this.bolts.follow(c.bolt, bolt);
    }

    /** The impact: a flash of each shape that hit (a circle that still burned, the zone, the sure hit's mark). */
    impact(c: Cast<S, K>, lit: readonly boolean[]) {
      const r = c.def.rules, sh = r.shape;
      const shapes: TelegraphShape[] = [];
      if (sh.kind === 'circle') c.centres.forEach((p, i) => { if (lit[i]) shapes.push({ kind: 'circle', x: p.x, z: p.z, radius: sh.radius }); });
      else if (sh.kind === 'zone' && c.area) shapes.push(c.area);
      else if (sh.kind === 'target' && lit[0] && c.target) {
        const p = c.target.group.position;
        shapes.push({ kind: 'circle', x: p.x, z: p.z, radius: 0.9 });
      }
      this.show(c, shapes);
    }

    /** A lane's front struck someone: a small flash at their feet. */
    struck(c: Cast<S, K>, who: { group: THREE.Object3D }) {
      const p = who.group.position;
      this.show(c, [{ kind: 'circle', x: p.x, z: p.z, radius: 0.9 }]);
    }

    after(c: Cast<S, K>, t: number) {
      if (this.at < 0) return;
      const k = (t - this.at) / FLASH;
      this.mat.opacity = k >= 1 ? 0 : 0.55 * (1 - k) * (1 - k);
      if (k >= 1) for (const m of this.flashes) m.visible = false;
      c.shake = k < 1 ? 0.15 * (1 - k) : 0;
    }

    private show(c: Cast<S, K>, shapes: TelegraphShape[]) {
      if (!shapes.length) return;
      this.at = c.time;
      this.flashes.forEach((m, i) => {
        const s = shapes[i];
        m.visible = !!s;
        if (!s) return;
        m.geometry.dispose();
        m.geometry = flat(s);
      });
    }
  };
}

/** A flat mesh of a ground shape, a hair above the floor. */
function flat(s: TelegraphShape): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (s.kind) {
    case 'circle':
      g = new THREE.CircleGeometry(s.radius, 40).rotateX(-Math.PI / 2).translate(s.x, 0.04, s.z);
      break;
    case 'ring':
      g = new THREE.RingGeometry(s.inner, s.outer, 40).rotateX(-Math.PI / 2).translate(s.x, 0.04, s.z);
      break;
    case 'cone': {
      const half = THREE.MathUtils.degToRad(s.angle) / 2;
      // CircleGeometry's sector runs counter-clockwise from +x in its own plane; laid flat, its +y is the ground's -z.
      g = new THREE.CircleGeometry(s.radius, 32, 0, 2 * half).rotateZ(Math.PI / 2 - half).rotateX(-Math.PI / 2)
        .rotateY(s.dir + Math.PI).translate(s.x, 0.04, s.z);
      break;
    }
    case 'line': {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1, len = Math.hypot(dx, dz) || 0.01;
      g = new THREE.PlaneGeometry(s.width, len).rotateX(-Math.PI / 2).translate(0, 0.04, -len / 2)
        .rotateY(Math.atan2(-dx, -dz)).translate(s.x1, 0, s.z1);
      break;
    }
  }
  return g;
}
