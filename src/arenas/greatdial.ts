import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from './common';
import layout from './real/greatdial.json';
import { Glows, realProps, type RealLayout } from './real';
import { COURT_STAGE, eclipseTexture } from './suncourt';
import type { ArenaDef, WallState } from './types';

/**
 * The Great Dial: the Sun Warden's court for a party of up to 40 (user, 2026-11-11: "make like custom arena in blender ... for the
 * boss, it don't need to follow the other arenas"). One vast sundial, 46 m from the Sun Well to its rim, that the fallen sun broke.
 * Its cover and everything round it are built in blender/arenas/real/greatdial.py (clean forms, the heroes' materials, gold on the
 * edges, lantern light as the only glow), which also writes the obstacle list (`real/greatdial.json`).
 *
 * From the middle: the court for two as it was (six hour screens, eight obelisks), the FALLEN HALO (a broken gold ring 38 m across,
 * lying on the floor in five arcs), the twelve HOUR STONES, ray shards and braziers, the broken colonnade. Round it: the gnomon, a
 * blade of dark stone 40 m high behind the Warden's empty throne; twelve hour pylons; a second great halo half sunk to the north-east.
 *
 * A smaller party gets less of it: the floor is walkable out to `setDialSize` (`raidRing` for the band), where a wall of light
 * stands; what lies beyond is scenery. Built here: the dial's floor, the rim's steps, the wall of light, the lanterns' glow.
 */
const LAYOUT = layout as RealLayout;
/** The whole dial's reach (m), as built in Blender. */
export const DIAL_RIM = 46;
const GOLD = 0xc9a24a;

let reach = DIAL_RIM;
/** The cover inside the wall of light, and which piece of the layout each is. */
export const DIAL_OBSTACLES: Obstacle[] = [];
let shown: number[] = [];

/** How far a party may walk: everything further out stays, as scenery. Set before the fight is built. */
export function setDialSize(r: number) {
  reach = Math.min(DIAL_RIM, r);
  shown = LAYOUT.obstacles.map((_, i) => i).filter((i) => {
    const o = LAYOUT.obstacles[i];
    return Math.hypot((o.ax + o.bx) / 2 - RING.x, (o.az + o.bz) / 2 - RING.z) <= reach - 1.5;
  });
  DIAL_OBSTACLES.length = 0;
  DIAL_OBSTACLES.push(...shown.map((i) => LAYOUT.obstacles[i]));
}
setDialSize(DIAL_RIM);

/** The dial's face: dark slate in rings of slabs, a gold line under each ring of cover, the hour lines running out to the rim. */
function dialFloor() {
  return canvasTexture(2048, (g, s) => {
    const rnd = seeded(1212), ppm = s / (DIAL_RIM * 2);
    g.fillStyle = '#12141f';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (let r0 = 1.2, ri = 0; r0 < DIAL_RIM; r0 += 2.3, ri++) {
      const r1 = Math.min(DIAL_RIM, r0 + 2.3), n = Math.max(8, Math.round(r0 * 2.6));
      for (let k = 0; k < n; k++) {
        const a0 = ((k + (ri % 2) * 0.5) / n) * Math.PI * 2, a1 = ((k + 1 + (ri % 2) * 0.5) / n) * Math.PI * 2;
        g.fillStyle = rnd() < 0.5 ? `rgba(120,130,170,${0.012 + rnd() * 0.022})` : `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
        g.beginPath();
        g.arc(0, 0, r1 * ppm, a0, a1);
        g.arc(0, 0, r0 * ppm, a1, a0, true);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(4,4,9,0.8)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    // Where the halo fell: the floor under it is burnt.
    const burn = g.createRadialGradient(0, 0, 16.5 * ppm, 0, 0, 21.5 * ppm);
    burn.addColorStop(0, 'rgba(0,0,0,0)');
    burn.addColorStop(0.5, 'rgba(30,10,2,0.5)');
    burn.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = burn;
    g.beginPath();
    g.arc(0, 0, 21.5 * ppm, 0, Math.PI * 2);
    g.arc(0, 0, 16.5 * ppm, 0, Math.PI * 2, true);
    g.fill('evenodd');
    // A gold line under each ring of cover, and the rim's band.
    g.strokeStyle = 'rgba(190,150,70,0.3)';
    g.lineWidth = 3;
    for (const r of [1.5, 3, 14, 24, 30, 37.5, 44.6]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    // The hours: twelve long lines from the old court to the rim, a short one between each two.
    g.fillStyle = 'rgba(190,150,70,0.09)';
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, long = k % 2 === 0, w = long ? 0.012 : 0.008, r0 = long ? 3 : 30, r1 = long ? 44.4 : 44.4;
      g.beginPath();
      g.moveTo(Math.cos(a - w * 3) * r0 * ppm, Math.sin(a - w * 3) * r0 * ppm);
      g.lineTo(Math.cos(a - w) * r1 * ppm, Math.sin(a - w) * r1 * ppm);
      g.lineTo(Math.cos(a + w) * r1 * ppm, Math.sin(a + w) * r1 * ppm);
      g.lineTo(Math.cos(a + w * 3) * r0 * ppm, Math.sin(a + w * 3) * r0 * ppm);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // The minutes: small marks round the rim.
    g.fillStyle = 'rgba(200,160,80,0.3)';
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2;
      g.beginPath(); g.arc(Math.cos(a) * 43.6 * ppm, Math.sin(a) * 43.6 * ppm, k % 5 ? 2.5 : 5, 0, Math.PI * 2); g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

export const greatDialArena: ArenaDef = {
  id: 'greatdial',
  name: 'The Great Dial',
  get ring() { return reach; },
  obstacles: DIAL_OBSTACLES,
  breakable: true,
  stage: { ...COURT_STAGE, fogNear: 95, fogFar: 260 },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];
    const R = DIAL_RIM;
    const ground = new THREE.MeshStandardMaterial({ color: 0x100e16, roughness: 0.95 });
    const face = new THREE.MeshStandardMaterial({ map: dialFloor(), roughness: 0.82, metalness: 0.12 });
    const apron = floorDisc(R + 60, ground, 0.004, 64), disc = floorDisc(R, face, 0.012, 160);
    const rimLine = flatRing(R - 0.16, R, GOLD, 0.75, 0.02);
    // The rim: wide steps up and out, so the dial reads as sunken. Under 2 m, so the camera looks over them.
    const stepsMat = new THREE.MeshStandardMaterial({ color: 0x35303c, roughness: 0.9, side: THREE.DoubleSide });
    const steps = new THREE.Mesh(
      new THREE.LatheGeometry([[R, 0], [R, 0.35], [R + 0.9, 0.35], [R + 0.9, 0.7], [R + 1.8, 0.7], [R + 1.8, 1.05], [R + 2.7, 1.05], [R + 2.7, 1.4], [R + 3.8, 1.4], [R + 3.8, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 160),
      stepsMat,
    );
    steps.position.set(RING.x, 0, RING.z);
    steps.castShadow = steps.receiveShadow = true;
    const stepLine = flatRing(R + 0.02, R + 0.16, GOLD, 0.9, 0.355);
    g.add(apron, disc, rimLine, steps, stepLine);
    own.push(apron.geometry, disc.geometry, ground, face.map!, face, rimLine.geometry, rimLine.material as THREE.Material, steps.geometry, stepsMat, stepLine.geometry, stepLine.material as THREE.Material);

    // A smaller party: a wall of light where its floor ends.
    if (reach < R - 0.5) {
      const wallMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const light = new THREE.Mesh(new THREE.CylinderGeometry(reach, reach, 2.6, 128, 1, true).translate(0, 1.3, 0), wallMat);
      light.position.set(RING.x, 0, RING.z);
      const line = flatRing(reach - 0.12, reach + 0.12, 0xffd27a, 0.85, 0.03);
      g.add(light, line);
      own.push(light.geometry, wallMat, line.geometry, line.material as THREE.Material);
    }

    const SIZE: Record<string, number> = { lantern: 1.1, lamp: 1.9, beacon: 4.5 };
    const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xffa040, 1.5);
    g.add(glows.group);
    own.push(glows);

    const eclipse = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclipseTexture(), transparent: true, depthWrite: false, fog: false }));
    eclipse.scale.set(230, 230, 1);
    eclipse.position.set(-70, 95, RING.z - 230);
    g.add(eclipse);
    own.push(eclipse.material.map!, eclipse.material);

    let disposed = false;
    let cover: (THREE.Object3D | null)[] = [];
    /** How far each piece has sunk: a broken screen goes down into the floor. */
    const sink = new Map<THREE.Object3D, number>();
    void realProps('greatdial', LAYOUT.obstacles.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.0 }, cream: { dim: 0.55 }, stone: { dim: 0.85 }, slate: { dim: 0.85 }, gold: { dim: 0.62, rough: 0.5 }, copper: { dim: 0.7, rough: 0.5 } },
    }).then((props) => {
      if (disposed) return;
      cover = props.cover;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('great dial: props failed to load', e));

    return {
      group: g,
      update(dt, time) {
        glows.update(time);
        for (const [o, to] of sink) o.position.y += (to - o.position.y) * Math.min(1, dt * 5);
      },
      wallState(index: number, state: WallState) {
        const o = cover[shown[index]];
        if (!o) return;
        // Whole, leaning a hand's width into the floor, or gone under it.
        sink.set(o, state === 'whole' ? 0 : state === 'cracked' ? -0.25 : -2.2);
        if (state === 'whole') o.position.y = 0;
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
