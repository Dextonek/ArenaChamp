import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import { checkCameraRule, instance, loadKit, merged, templeCover, type Place } from './temple';
import type { ArenaDef, ArenaStage } from './types';

/** How far the walkable court reaches from its centre: wider than a duel ring, because a giant fights here. */
export const COURT_R = RAID_BOSSES.sun.ring;

const GOLD = 0xc9a24a;
/** Screen walls on a ring round the altar, and columns further out that never break. Point-symmetric, none on the z axis. */
const WALL_RING = 6.5;
const WALL_HALF = 1.6;
const COLUMN_RING = 11;

const walls: Obstacle[] = [30, 90, 150, 210, 270, 330].map((deg) => {
  const a = THREE.MathUtils.degToRad(deg);
  const cx = RING.x + Math.sin(a) * WALL_RING, cz = RING.z + Math.cos(a) * WALL_RING;
  const tx = Math.cos(a) * WALL_HALF, tz = -Math.sin(a) * WALL_HALF;
  return wall(cx - tx, cz - tz, cx + tx, cz + tz);
});
const columns: Obstacle[] = Array.from({ length: 8 }, (_, k) => {
  const a = THREE.MathUtils.degToRad(22.5 + k * 45);
  return pillar(RING.x + Math.sin(a) * COLUMN_RING, RING.z + Math.cos(a) * COLUMN_RING);
});

/**
 * Cover made for the Sun Warden's moves: Noon needs something to hide behind and something worth spending, and his rays
 * turn round the altar in the middle. Layout rules as in docs/architecture/arenas.md; both heroes start on the south side.
 */
export const COURT_OBSTACLES: Obstacle[] = [{ ...pillar(RING.x, RING.z, 1.0), height: 1.45 }, ...walls, ...columns];

/** Under an eclipse: a dark sky with a burning horizon, warm light from ahead, and no cold moonlight. */
const STAGE: ArenaStage = {
  background: 0x120b0f,
  zenith: 0x05050e,
  horizon: 0x4a2212,
  glow: 0xd8742a,
  stars: 0.5,
  fog: 0x24130f,
  fogNear: 62,
  fogFar: 175,
  hemiSky: 0xa8a4d8,
  hemiGround: 0x2a1408,
  hemiIntensity: 0.55,
  sun: 0xffc890,
  sunIntensity: 1.55,
  rim: 0xff9a50,
  rimIntensity: 0.85,
};

/**
 * The floor: slate slabs laid in rings, which also makes wedges easy to read, under one great sun wheel with its rays
 * running out to the rim. Dark and cool on purpose: pale orange and gold zones have to stand out on it, and every
 * ultimate darkens the world (`floorDisc`).
 */
function courtFloor() {
  return canvasTexture(1536, (g, s) => {
    const rnd = seeded(61);
    const ppm = s / (COURT_R * 2);
    const c = s / 2;
    g.fillStyle = '#12141f';
    g.fillRect(0, 0, s, s);
    g.translate(c, c);
    // Slabs in rings, each ring offset and each slab with its own slight tone.
    const rings = [[1.2, 3, 10], [3, 5, 16], [5, 7, 22], [7, 9, 28], [9, 11, 34], [11, 13, 40], [13, 16, 48]] as const;
    rings.forEach(([r0, r1, n], ri) => {
      for (let k = 0; k < n; k++) {
        const a0 = ((k + (ri % 2) * 0.5) / n) * Math.PI * 2, a1 = ((k + 1 + (ri % 2) * 0.5) / n) * Math.PI * 2;
        const t = rnd();
        g.fillStyle = t < 0.5 ? `rgba(120,130,170,${0.012 + rnd() * 0.02})` : `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
        g.beginPath();
        g.arc(0, 0, r1 * ppm, a0, a1);
        g.arc(0, 0, r0 * ppm, a1, a0, true);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(4,4,9,0.8)';
        g.lineWidth = 2.5;
        g.stroke();
      }
    });
    // The sun wheel: gold, low contrast. Long rays and short ones between them.
    g.strokeStyle = 'rgba(190,150,70,0.26)';
    g.lineWidth = 3;
    for (const r of [1.4, 3, 7, 15.2]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(190,150,70,0.075)';
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, long = k % 2 === 0, w = long ? 0.1 : 0.07, r = long ? 15 : 10.5;
      g.beginPath();
      g.moveTo(Math.cos(a - w) * 3 * ppm, Math.sin(a - w) * 3 * ppm);
      g.lineTo(Math.cos(a) * r * ppm, Math.sin(a) * r * ppm);
      g.lineTo(Math.cos(a + w) * 3 * ppm, Math.sin(a + w) * 3 * ppm);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // A band of small marks near the rim.
    g.fillStyle = 'rgba(200,160,80,0.25)';
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      g.beginPath(); g.arc(Math.cos(a) * 14.4 * ppm, Math.sin(a) * 14.4 * ppm, 3, 0, Math.PI * 2); g.fill();
    }
    // His sundial: twelve hour stones round the rim, pale stone, not gold, each cut with its count of notches.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
      g.save();
      g.rotate(a);
      g.fillStyle = 'rgba(150,150,170,0.16)';
      g.fillRect(13 * ppm, -0.55 * ppm, 2.1 * ppm, 1.1 * ppm);
      g.fillStyle = 'rgba(8,8,14,0.7)';
      const n = (k % 4) + 1;
      for (let j = 0; j < n; j++) g.fillRect((13.4 + j * 0.42) * ppm, -0.3 * ppm, 0.16 * ppm, 0.6 * ppm);
      g.restore();
    }
    // The gnomon's shadow, frozen at the moment the sun fell: a long dark wedge from the altar.
    g.save();
    g.rotate(-2.3);
    const shade = g.createLinearGradient(0, 0, 14 * ppm, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.42)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = shade;
    g.beginPath();
    g.moveTo(0, -1.1 * ppm);
    g.lineTo(14 * ppm, -0.25 * ppm);
    g.lineTo(14 * ppm, 0.25 * ppm);
    g.lineTo(0, 1.1 * ppm);
    g.closePath();
    g.fill();
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Scorch marks and wear: he has burned this floor before.
    for (let k = 0; k < 12; k++) {
      const x = rnd() * s, y = rnd() * s, r = (1.2 + rnd() * 2.4) * ppm;
      const burn = g.createRadialGradient(x, y, 0, x, y, r);
      burn.addColorStop(0, 'rgba(0,0,0,0.3)');
      burn.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = burn;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

/**
 * Where the sun tore through the floor on its way down: thin cracks of light from the altar, out toward the north gate. The glow
 * drawing of the court's floor; everything else in it is black.
 */
function courtGlow() {
  return canvasTexture(1536, (g, s) => {
    const rnd = seeded(91), ppm = s / (COURT_R * 2);
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    g.lineCap = 'round';
    // Warm white, not gold: gold on this floor means a zone to stand in.
    g.strokeStyle = '#f0c8a0';
    for (let k = 0; k < 9; k++) {
      // Mostly toward the north, where the sun went over the edge.
      let a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, r = 1.6, x = Math.cos(a) * r, y = Math.sin(a) * r;
      g.lineWidth = (k < 3 ? 2.6 : 1.5);
      g.beginPath();
      g.moveTo(x * ppm, y * ppm);
      const end = 6 + rnd() * 8;
      while (r < end) {
        r += 0.4 + rnd() * 0.5;
        a += (rnd() - 0.5) * 0.35;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
        g.lineTo(x * ppm, y * ppm);
      }
      g.stroke();
    }
  });
}

function apronTexture() {
  return canvasTexture(1024, (g, s) => {
    const rnd = seeded(32);
    g.fillStyle = '#100e16';
    g.fillRect(0, 0, s, s);
    const n = 4, slab = s / n;
    g.strokeStyle = 'rgba(4,3,7,0.9)';
    g.lineWidth = 5;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        g.fillStyle = `rgba(${34 + rnd() * 12},${30 + rnd() * 10},${40 + rnd() * 12},0.18)`;
        g.fillRect(col * slab + 4, row * slab + 4, slab - 8, slab - 8);
        g.strokeRect(col * slab, row * slab, slab, slab);
      }
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.arc(rnd() * s, rnd() * s, 2 + rnd() * 6, 0, Math.PI * 2); g.fill();
    }
  }, 18);
}

/** The eclipse: a black disc in a burning corona. */
function eclipseTexture() {
  return canvasTexture(512, (g, s) => {
    const c = s / 2, r = s * 0.17;
    const halo = g.createRadialGradient(c, c, r * 0.9, c, c, c);
    halo.addColorStop(0, 'rgba(255,190,110,0.95)');
    halo.addColorStop(0.1, 'rgba(255,130,50,0.6)');
    halo.addColorStop(0.45, 'rgba(200,70,20,0.14)');
    halo.addColorStop(1, 'rgba(160,50,10,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#05040a';
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
  });
}

function dotTexture() {
  return canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

/** His own kit (blender/arenas/sanctum_props.py): sun-stone walls, sun obelisks, the Sun Well, sun bowls, his throne. Baked for a dark
 *  room; only the glowing parts are held down, under the bloom. */
const sanctumProps = () => loadKit(['sanctum_props.glb'], (part, m) => {
  if (part === 'glow') m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.7);
});

/** Rocks like the Warden's own, drifting round the court: off the camera's side and away from the north one (see `checkCameraRule`). */
interface Rock { x: number; y: number; z: number; s: number; phase: number; spin: number }
const ROCKS: Record<string, Rock[]> = (() => {
  const rnd = seeded(4242), out: Record<string, Rock[]> = { FloatRockA: [], FloatRockB: [], FloatRockC: [] };
  for (let k = 0; k < 18; k++) {
    const side = k % 2 ? 1 : -1, x = side * (14 + rnd() * 12), z = RING.z - 18 + rnd() * 30;
    const name = (['FloatRockA', 'FloatRockB', 'FloatRockC'] as const)[k % 3];
    out[name].push({ x, y: 2.5 + rnd() * 5, z, s: 0.8 + rnd() * 0.9, phase: rnd() * 6.28, spin: (rnd() - 0.5) * 0.3 });
  }
  return out;
})();
const _rock = new THREE.Matrix4(), _rp = new THREE.Vector3(), _rq = new THREE.Quaternion(), _re = new THREE.Euler(), _rs = new THREE.Vector3();

/** Fire bowls on the rim, every 30° but none straight ahead or behind (the z axis stays open for the camera). */
const BOWLS = Array.from({ length: 12 }, (_, k) => {
  const a = THREE.MathUtils.degToRad(15 + k * 30);
  return { x: RING.x + Math.sin(a) * (COURT_R + 1.5), z: RING.z + Math.cos(a) * (COURT_R + 1.5) };
});
const BOWL_Y = 1.05;
const FLAMES = 12;

/**
 * The Sun Court: the Warden's own room, not one of the duel arenas (it is not in `ARENAS`, so no duel ever picks it). A wide
 * sunken court under an eclipse: a slate floor with a great sun wheel, a stepped rim with fire bowls, the temple's
 * sculpted cover in a new layout, and giant hooded guardians watching from the sides. All first-pass: the floor and rim
 * are drawn in code, and the props are the temple's, until an artist directs its own.
 */
export const sunCourtArena: ArenaDef = {
  id: 'suncourt',
  name: 'The Sun Court',
  ring: COURT_R,
  obstacles: COURT_OBSTACLES,
  breakable: true,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const apron = floorDisc(46, new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.92, metalness: 0.04 }), 0.004, 64);
    const disc = floorDisc(COURT_R, new THREE.MeshStandardMaterial({ map: courtFloor(), roughness: 0.82, metalness: 0.12, transparent: true, opacity: 0.94, emissive: 0xffffff, emissiveMap: courtGlow(), emissiveIntensity: 0.18 }));
    disc.receiveShadow = false;
    const band = flatRing(COURT_R - 1.1, COURT_R - 0.25, 0xb4561c, 0.2, 0.018);
    const rimLine = flatRing(COURT_R - 0.14, COURT_R, GOLD, 0.75, 0.02);
    g.add(apron, disc, band, rimLine);

    // The rim: wide steps, so the court reads as sunken. Under 2 m, so the camera looks over them.
    const R = COURT_R;
    const steps = new THREE.Mesh(
      new THREE.LatheGeometry([[R, 0], [R, 0.35], [R + 0.7, 0.35], [R + 0.7, 0.7], [R + 1.4, 0.7], [R + 1.4, 1.05], [R + 2.1, 1.05], [R + 2.1, 1.4], [R + 2.9, 1.4], [R + 2.9, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 128),
      new THREE.MeshStandardMaterial({ color: 0x35303c, roughness: 0.9, side: THREE.DoubleSide }),
    );
    steps.position.set(RING.x, 0, RING.z);
    steps.castShadow = steps.receiveShadow = true;
    g.add(steps, flatRing(R + 0.02, R + 0.14, GOLD, 0.9, 0.355));

    let disposed = false;
    // The bowls stand on the third step.
    const pots = BOWLS.map((b) => new THREE.Matrix4().makeTranslation(b.x, BOWL_Y, b.z));
    const cover = templeCover(g, COURT_OBSTACLES, pots, sanctumProps);
    const rockSets: { list: Rock[]; sets: THREE.InstancedMesh[] }[] = [];

    // Flames and the light they throw on the steps.
    const glowGeos: THREE.BufferGeometry[] = BOWLS.map((b) => new THREE.CircleGeometry(0.62, 20).rotateX(-Math.PI / 2).translate(b.x, BOWL_Y + 0.04, b.z));
    const glowGeo = new THREE.BufferGeometry();
    {
      const pos: number[] = [], idx: number[] = [];
      for (const geo of glowGeos) {
        const base = pos.length / 3, p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
        const index = geo.index!;
        for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
        geo.dispose();
      }
      glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      glowGeo.setIndex(idx);
    }
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    g.add(new THREE.Mesh(glowGeo, glowMat));
    const flamePos = new Float32Array(BOWLS.length * FLAMES * 3), flameCol = new Float32Array(BOWLS.length * FLAMES * 3), phase = new Float32Array(BOWLS.length * FLAMES);
    const frnd = seeded(78);
    for (let i = 0; i < phase.length; i++) phase[i] = frnd();
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3));
    const flames = new THREE.Points(flameGeo, new THREE.PointsMaterial({ size: 0.36, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flames.frustumCulled = false;
    g.add(flames);

    // The backdrop: his empty throne past the north gate, his obelisks and broken sun arches along the sides, and rocks like his own
    // drifting round the court. Nothing tall on the camera's side, and nothing tall near the north one (`checkCameraRule`).
    const rnd = seeded(808);
    const UP = new THREE.Vector3(0, 1, 0);
    const back: Place = {};
    const put = (into: Place, name: string, x: number, z: number, ry: number, s = 1) =>
      (into[name] ??= []).push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(s, s, s)));
    const facing = (x: number, z: number) => Math.atan2(RING.x - x, RING.z - z);
    put(back, 'Throne', RING.x, RING.z - 36, 0, 1.3);
    for (const side of [-1, 1]) {
      for (const dz of [-10, 2, 14]) put(back, 'Obelisk', side * 21, RING.z + dz, facing(side * 21, RING.z + dz), 0.9 + rnd() * 0.3);
      put(back, 'Arch', side * 27, RING.z - 6, facing(side * 27, RING.z - 6), 1.2);
      put(back, 'Arch', side * 17, RING.z - 27, facing(side * 17, RING.z - 27), 1.1);
    }
    void sanctumProps().then((props) => {
      if (disposed) return;
      const meshes = merged(props, back);
      checkCameraRule(meshes, COURT_R + 14);
      g.add(...meshes);
      // The drifting rocks, each kind instanced, with its own height, phase and turn.
      for (const [name, list] of Object.entries(ROCKS)) {
        const parts = props[name];
        if (!parts) continue;
        const sets = instance(parts, list.map(() => new THREE.Matrix4()));
        for (const m of sets) { m.frustumCulled = false; m.castShadow = false; }
        g.add(...sets);
        rockSets.push({ list, sets });
      }
    }).catch((e) => console.error('sun court: backdrop failed', e));

    // Motes of light, rising slowly over the court and fading.
    const MOTES = 70;
    const motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
    const mrnd = seeded(515);
    for (let i = 0; i < MOTES; i++) {
      moteSeed[i] = mrnd();
      const a = mrnd() * Math.PI * 2, r = Math.sqrt(mrnd()) * (COURT_R + 4);
      motePos[i * 3] = RING.x + Math.sin(a) * r;
      motePos[i * 3 + 2] = RING.z + Math.cos(a) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.16, map: dotTexture(), color: 0xffd88a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    motes.frustumCulled = false;
    g.add(motes);

    const eclipse = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclipseTexture(), transparent: true, depthWrite: false, fog: false }));
    eclipse.scale.set(190, 190, 1);
    eclipse.position.set(0, 74, RING.z - 170);
    g.add(eclipse);

    return {
      group: g,
      wallState: cover.wallState,
      coverFall: cover.coverFall,
      resetShift: cover.resetShift,
      update(dt, time) {
        cover.update(dt);
        for (let i = 0; i < MOTES; i++) motePos[i * 3 + 1] = ((time * (0.18 + moteSeed[i] * 0.2) + moteSeed[i] * 7) % 6);
        moteGeo.attributes.position.needsUpdate = true;
        for (const { list, sets } of rockSets) {
          list.forEach((r, k) => {
            _rock.compose(_rp.set(r.x, r.y + Math.sin(time * 0.5 + r.phase) * 0.45, r.z), _rq.setFromEuler(_re.set(Math.sin(time * 0.3 + r.phase) * 0.15, time * r.spin + r.phase, 0)), _rs.setScalar(r.s));
            for (const m of sets) m.setMatrixAt(k, _rock);
          });
          for (const m of sets) m.instanceMatrix.needsUpdate = true;
        }
        for (let b = 0; b < BOWLS.length; b++) {
          const bowl = BOWLS[b];
          for (let j = 0; j < FLAMES; j++) {
            const i = b * FLAMES + j, ph = phase[i], t = (time * 0.9 + ph) % 1;
            const w = 0.17 * (1 - t) * (0.6 + 0.4 * Math.sin(time * 7 + ph * 40));
            flamePos[i * 3] = bowl.x + Math.sin(ph * 60 + time * 4) * w;
            flamePos[i * 3 + 1] = BOWL_Y + 1.18 + t * 0.66;
            flamePos[i * 3 + 2] = bowl.z + Math.cos(ph * 47 + time * 3.4) * w;
            const f = Math.pow(1 - t, 0.9) * 0.8;
            flameCol[i * 3] = f;
            flameCol[i * 3 + 1] = f * (0.7 - 0.5 * t);
            flameCol[i * 3 + 2] = f * 0.2 * (1 - t);
          }
        }
        flameGeo.attributes.position.needsUpdate = true;
        flameGeo.attributes.color.needsUpdate = true;
        glowMat.opacity = 0.11 + 0.035 * Math.sin(time * 9) * Math.sin(time * 5.3 + 1);
      },
      dispose() {
        disposed = true;
        cover.dispose();
        (eclipse.material.map as THREE.Texture | null)?.dispose();
        eclipse.material.dispose();
        disposeTree(g);
      },
    };
  },
};
