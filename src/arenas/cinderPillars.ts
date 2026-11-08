import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { softDotTexture } from '../effects/common';
import type { Obstacle } from '../obstacles';
import { canvasTexture, seeded } from './common';

/**
 * The Cinder Pit's six pillars (user, 2026-11-08: "6 different pillars noticeable from others"): the only cover in the pit, and
 * the only thing that stops Ash's Charge, which breaks them one by one. Six-sided basalt with veins and a crown of sun-glass:
 * pale blue-white, the one cool colour in the pit, so they read at a glance and never as a warning (orange) or a place to stand
 * (gold). Each has its own crown and a glass ring on the floor round its foot. All drawn in code.
 */

/** The glass's colour. */
export const PILLAR_GLASS = 0x8fe4ff;

/** How tall the shaft is over its plinth (m), and the plinth. */
const SHAFT = 2.9;
const PLINTH = 0.42;
/** Chunks thrown out when one breaks. */
const ROCKS = 96;
const SHARDS = 60;
const GRAVITY = 14;

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Basalt with cracks of glass running up it: one drawing for the colour, one for the glow, wrapped once round the shaft. */
function veins() {
  const rnd = seeded(4242), size = 512;
  const cracks: [number, number][][] = [];
  for (let k = 0; k < 9; k++) {
    let x = rnd() * size, y = size;
    const pts: [number, number][] = [[x, y]];
    while (y > 0) {
      y -= 18 + rnd() * 40;
      x += (rnd() - 0.5) * 46;
      pts.push([x, y]);
    }
    cracks.push(pts);
  }
  const draw = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineCap = g.lineJoin = 'round';
    for (const pts of cracks) {
      g.lineWidth = width;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  };
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#17141b';
    g.fillRect(0, 0, s, s);
    // Hewn faces: bands of lighter and darker stone.
    for (let y = 0; y < s; y += 24) {
      g.fillStyle = `rgba(${60 + rnd() * 30},${55 + rnd() * 25},${70 + rnd() * 30},${0.12 + rnd() * 0.12})`;
      g.fillRect(0, y, s, 10 + rnd() * 14);
    }
    draw(g, '#0a090c', 9);
    draw(g, '#6fa8c0', 2.5);
  });
  const glow = canvasTexture(size, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    draw(g, '#2a6a88', 9);
    draw(g, '#ffffff', 3);
  });
  return { color, glow };
}

/** A six-sided shaft, hewn: each corner a little in or out, so no two pillars are the same. Its foot at y = 0. */
function shaftGeo(r: number, rnd: () => number) {
  const geo = new THREE.CylinderGeometry(r * 0.8, r * 0.94, SHAFT, 6, 5).translate(0, SHAFT / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y <= 0.01) continue;
    const k = 1 + (rnd() - 0.5) * 0.12;
    p.setXYZ(i, p.getX(i) * k, y + (y >= SHAFT - 0.01 ? (rnd() - 0.5) * 0.25 : 0), p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** The glass: two bands round the shaft and a crown of crystals, each pillar's its own. In the shaft's space. */
function glassGeo(r: number, rnd: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const y of [SHAFT * 0.34, SHAFT * 0.7]) parts.push(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.13, 6, 1, true).translate(0, y, 0));
  const n = 4 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const tall = k === 0 ? 1.3 : 0.6 + rnd() * 0.5;
    const c = new THREE.OctahedronGeometry(0.28 + rnd() * 0.08, 0).scale(1, 2.6 * tall, 1);
    const a = (k / n) * Math.PI * 2 + rnd(), off = k === 0 ? 0 : r * (0.25 + rnd() * 0.35);
    c.rotateZ((k === 0 ? 0 : 0.35 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1));
    c.rotateY(a);
    c.translate(Math.sin(a) * off, SHAFT + 0.35 * tall, Math.cos(a) * off);
    parts.push(c);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
}

/** What is left of a broken pillar: a jagged stump on its plinth. */
function stubGeo(r: number, rnd: () => number) {
  const h = 0.75;
  const geo = new THREE.CylinderGeometry(r * 0.86, r * 0.94, h, 6, 1).translate(0, h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h - 0.01) p.setY(i, h - rnd() * 0.5);
  geo.computeVertexNormals();
  return geo;
}

interface Pillar {
  o: Obstacle;
  /** What falls: the shaft and its glass, turning about the plinth's top. */
  pivot: THREE.Group;
  crown: THREE.Sprite;
  stub: THREE.Mesh;
  ring: THREE.Mesh;
  fall: { dir: number; t: number; seconds: number } | null;
  broken: boolean;
}

/**
 * The pillars of `list`, standing, and what `ArenaScene` needs of them: `coverFall` (index into `obstacles`), `resetShift`, `update`.
 */
export function buildPillars(obstacles: readonly Obstacle[], list: readonly Obstacle[]) {
  const group = new THREE.Group();
  const tex = veins();
  const stone = new THREE.MeshStandardMaterial({
    map: tex.color, color: 0xffffff, roughness: 0.72, metalness: 0.1, flatShading: true, emissive: 0x5fc8f0, emissiveMap: tex.glow, emissiveIntensity: 0.45,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: 0.85, flatShading: true });
  // A broken one's stump: its glass gone dark, so nobody takes it for cover.
  const dead = new THREE.MeshStandardMaterial({ map: tex.color, color: 0x8a8890, roughness: 0.85, metalness: 0.05, flatShading: true, emissive: 0x2a4652, emissiveMap: tex.glow, emissiveIntensity: 0.15 });
  // Under the game's bloom a bright glass is all that shows from above: kept low, so the crystals keep their shape.
  const glass = new THREE.MeshStandardMaterial({ color: 0x6fc8e0, roughness: 0.2, metalness: 0, flatShading: true, emissive: 0x4fc4f0, emissiveIntensity: 0.38 });
  const ringMat = new THREE.MeshBasicMaterial({ color: PILLAR_GLASS, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const deadRing = new THREE.MeshBasicMaterial({ color: 0x2a4652, transparent: true, opacity: 0.35, depthWrite: false });
  const shadowed = <T extends THREE.Mesh>(m: T) => { m.castShadow = m.receiveShadow = true; return m; };

  const pillars: Pillar[] = list.map((o, i) => {
    const rnd = seeded(900 + i * 37), r = o.r;
    const plinth = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.45, PLINTH, 6).translate(0, PLINTH / 2, 0), dark));
    plinth.position.set(o.ax, 0, o.az);
    plinth.rotation.y = rnd() * Math.PI;
    const pivot = new THREE.Group();
    pivot.position.set(o.ax, PLINTH, o.az);
    const inner = new THREE.Group();
    inner.rotation.y = plinth.rotation.y;
    inner.add(shadowed(new THREE.Mesh(shaftGeo(r, rnd), stone)), new THREE.Mesh(glassGeo(r, rnd), glass));
    const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0x4fb8e8, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    crown.position.set(0, SHAFT + 0.5, 0);
    crown.scale.setScalar(2);
    pivot.add(inner, crown);
    const stub = shadowed(new THREE.Mesh(stubGeo(r, rnd), dead));
    stub.position.set(o.ax, PLINTH, o.az);
    stub.rotation.y = plinth.rotation.y;
    stub.visible = false;
    // A ring of glass on the floor round its foot: from straight above, where the camera looks, it is what shows.
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.55, r * 1.78, 6, 1).rotateX(-Math.PI / 2), ringMat);
    ring.position.set(o.ax, 0.035, o.az);
    ring.rotation.y = plinth.rotation.y;
    ring.renderOrder = 1;
    group.add(plinth, pivot, stub, ring);
    return { o, pivot, crown, stub, ring, fall: null, broken: false };
  });

  // Chunks of stone and glass thrown out when one breaks: they fly, land and lie there until the fight ends.
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.17, 0), dark, ROCKS);
  const shardMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.13, 0).scale(1, 1.8, 1), glass, SHARDS);
  for (const m of [rockMesh, shardMesh]) {
    m.castShadow = true;
    // Hidden at zero scale when built: their bounds would never follow.
    m.frustumCulled = false;
    for (let i = 0; i < m.count; i++) m.setMatrixAt(i, HIDDEN);
    group.add(m);
  }
  interface Chunk { p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; s: number; live: boolean; still: boolean }
  const chunks = (n: number) => Array.from({ length: n }, (): Chunk => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), s: 1, live: false, still: false }));
  const sets = [{ mesh: rockMesh, list: chunks(ROCKS), next: 0 }, { mesh: shardMesh, list: chunks(SHARDS), next: 0 }];
  const crnd = seeded(77);
  const throwOut = (p: Pillar, dir: number) => {
    const fx = Math.sin(dir), fz = Math.cos(dir);
    for (const [set, n] of [[sets[0], 16], [sets[1], 10]] as const) {
      for (let j = 0; j < n; j++) {
        const c = set.list[set.next];
        set.next = (set.next + 1) % set.list.length;
        // Along the fallen shaft, and on away from him.
        const along = crnd() * SHAFT;
        c.p.set(p.o.ax + fx * along + (crnd() - 0.5) * 0.8, 0.4 + crnd() * 1.2, p.o.az + fz * along + (crnd() - 0.5) * 0.8);
        c.v.set(fx * (2 + crnd() * 4) + (crnd() - 0.5) * 4, 2.5 + crnd() * 4, fz * (2 + crnd() * 4) + (crnd() - 0.5) * 4);
        c.spin.set(crnd() * 9, crnd() * 9, crnd() * 9);
        c.s = 0.7 + crnd() * 1.4;
        c.live = true;
        c.still = false;
      }
    }
  };

  const _axis = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _qq = new THREE.Quaternion();

  return {
    group,
    /** Pillar `index` (into `obstacles`) topples along yaw `dir`, flat after `seconds`, and breaks up as it lands. */
    coverFall(index: number, dir: number, seconds: number) {
      const p = pillars.find((x) => x.o === obstacles[index]);
      if (!p || p.broken || p.fall) return;
      p.fall = { dir, t: 0, seconds: Math.max(0.1, seconds) };
      // The glass goes dark the moment he hits it.
      p.ring.material = deadRing;
    },
    /** A new fight: all six stand again. */
    resetShift() {
      for (const p of pillars) {
        p.fall = null;
        p.broken = false;
        p.pivot.visible = true;
        p.pivot.quaternion.identity();
        p.stub.visible = false;
        p.ring.material = ringMat;
      }
      for (const set of sets) {
        for (let i = 0; i < set.list.length; i++) { set.list[i].live = false; set.mesh.setMatrixAt(i, HIDDEN); }
        set.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    update(dt: number, time: number) {
      for (const [i, p] of pillars.entries()) {
        if (!p.broken) p.crown.material.opacity = 0.26 + 0.08 * Math.sin(time * 1.7 + i * 1.3);
        const f = p.fall;
        if (!f) continue;
        f.t += dt;
        const u = Math.min(1, f.t / f.seconds);
        p.pivot.quaternion.setFromAxisAngle(_axis.set(Math.cos(f.dir), 0, -Math.sin(f.dir)), u * u * Math.PI * 0.45);
        if (u < 1) continue;
        // It lands, and breaks: a stump on the plinth, the rest in pieces on the floor.
        p.fall = null;
        p.broken = true;
        p.pivot.visible = false;
        p.stub.visible = true;
        throwOut(p, f.dir);
      }
      for (const set of sets) {
        let moved = false;
        for (let i = 0; i < set.list.length; i++) {
          const c = set.list[i];
          if (!c.live || c.still) continue;
          moved = true;
          c.v.y -= GRAVITY * dt;
          c.p.addScaledVector(c.v, dt);
          const floor = 0.12 * c.s;
          if (c.p.y <= floor) {
            c.p.y = floor;
            // A bounce, then it lies still.
            if (Math.abs(c.v.y) < 2) c.still = true;
            c.v.set(c.v.x * 0.4, -c.v.y * 0.3, c.v.z * 0.4);
          }
          if (!c.still) c.rot.set(c.rot.x + c.spin.x * dt, c.rot.y + c.spin.y * dt, c.rot.z + c.spin.z * dt);
          set.mesh.setMatrixAt(i, _m.compose(c.p, _qq.setFromEuler(c.rot), _s.setScalar(c.s)));
        }
        if (moved) set.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      tex.color.dispose();
      tex.glow.dispose();
      for (const p of pillars) p.crown.material.dispose();
      ringMat.dispose();
      deadRing.dispose();
    },
  };
}
