import * as THREE from 'three';
import { RING } from '../arenas/common';
import { TOWER_ALTARS, TOWER_R, TOWER_STAIRS } from '../arenas/tower';
import type { ArenaDef } from '../arenas/types';
import { softDotTexture } from '../effects/common';
import { LightPillar } from '../raid/fx';
import { STAND_COLOR } from '../raid/script';
import type { BossDef, BossMove, Objective, PlayContext, PlayedMove } from '../raid/types';
import type { GameApi } from '../runtime';
import { BOON_COLOR, type Boon } from './boons';
import { unseen } from './floors';
import type { TowerHud } from './hud';
import { TowerLink } from './link';

const ALTAR_R = 1.4;
/** Which objective the stairs are: the altars are 0, 1 and 2. */
const STAIRS = 9;
const LANDING_CAST = 900002;
/** How long after the altars rise one can be taken (s): a hero standing where one comes up does not take it unasked. */
const ALTAR_WAIT = 0.7;

/** What a landing needs to know. */
export interface LandingVisit {
  api: GameApi;
  /** The room of the floor just cleared: the landing is that room again, with nothing in it. */
  place: ArenaDef;
  /** Where the hero stood as the floor ended. */
  at: { x: number; z: number };
  offers: Boon[];
  /** The autopilot's choice: only that altar can be taken. */
  only?: number;
  /** Where the floor's crystal stood: it scatters as the landing begins. */
  broke?: { x: number; z: number };
  /** The cards over the altars, when a person plays. */
  hud: TowerHud | null;
  goal(text: string): void;
  pick(boon: Boon, i: number): void;
  climb(): void;
}

/**
 * The landing after a floor: the same room, cleared. Three altars rise before the stairs, each with a boon; walk onto one (or
 * tap its card and the hero walks there), and the stairs light up; walk onto them and the next floor begins. It is what
 * Noonfall's hall is to a raid (src/raid/hall.ts): a boss fight with no boss, only walking, the altars and the stairs as
 * objectives, so the arrows at the screen's edge and the autopilot find them.
 */
export function buildLanding(v: LandingVisit): { def: BossDef; link: TowerLink; begin(): void } {
  // Not on an altar's spot, and not in the wall.
  const at = { ...v.at };
  const far = Math.hypot(at.x - RING.x, at.z - RING.z), most = TOWER_R - 1.2;
  if (far > most) { at.x = RING.x + ((at.x - RING.x) / far) * most; at.z = RING.z + ((at.z - RING.z) / far) * most; }
  for (const a of TOWER_ALTARS) if (Math.hypot(at.x - a.x, at.z - a.z) < ALTAR_R + 1) at.z = a.z + ALTAR_R + 1.4;
  let picked = false, climbed = false, clock = 0;

  const play = (_c: unknown, p: PlayContext): PlayedMove => {
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.7, metalness: 0.2, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.3 });
    const daisGeo = new THREE.CylinderGeometry(ALTAR_R, ALTAR_R + 0.2, 0.14, 12).translate(0, 0.07, 0);
    const trimGeo = new THREE.TorusGeometry(ALTAR_R - 0.08, 0.05, 6, 36).rotateX(Math.PI / 2).translate(0, 0.15, 0);
    const altars = v.offers.map((b, i) => {
      const a = TOWER_ALTARS[i], tone = BOON_COLOR[b.kind];
      const dais = new THREE.Mesh(daisGeo, daisMat), trim = new THREE.Mesh(trimGeo, trimMat);
      dais.position.set(a.x, 0, a.z);
      trim.position.set(a.x, 0, a.z);
      dais.receiveShadow = true;
      const light = new LightPillar(a.x, a.z, ALTAR_R - 0.1, 4, tone.light);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: tone.light, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      orb.position.set(a.x, 1.5, a.z);
      orb.scale.setScalar(0.9);
      p.group.add(dais, trim, light.mesh, orb);
      // They rise: a column of each one's light.
      p.show.column(a.x, a.z, { radius: ALTAR_R * 0.8, height: 7, life: 0.9, color: tone.light, peak: 0.55, delay: 0.1 * i });
      return { dais, trim, light, orb };
    });
    // The stairs: a light at their foot, and light in the arch above them once a boon is taken.
    const stairLight = new LightPillar(TOWER_STAIRS.x, TOWER_STAIRS.z, 1.8, 5, STAND_COLOR);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 4.4), glowMat);
    glow.position.set(RING.x, 2.3, RING.z - TOWER_R - 2.05);
    glow.renderOrder = 2;
    p.group.add(stairLight.mesh, glow);
    if (v.broke) {
      // What sealed the stairs breaks apart.
      p.show.shards(v.broke.x, 2.6, v.broke.z, { count: 60, color: 0x3a3650, speed: 8, life: 1.5, size: 0.3, up: 0.8 });
      p.show.ring(v.broke.x, v.broke.z, { radius: 12, life: 1, color: 0xfff4e0, width: 1 });
      p.show.column(v.broke.x, v.broke.z, { radius: 1.4, height: 14, life: 0.9, color: 0xfff4e0, peak: 0.6 });
      p.show.burst(v.broke.x, 2.6, v.broke.z, 60, 7, 3, 1, 0xffb060);
    }
    v.hud?.showCards(v.offers, (i) => v.api.heroMode.walkTo(TOWER_ALTARS[i].x, TOWER_ALTARS[i].z));
    const take = (i: number) => {
      if (picked) return;
      picked = true;
      const a = TOWER_ALTARS[i], b = v.offers[i];
      p.sparks.emit(a.x, 1, a.z, 34, 4, 4, 0.8, BOON_COLOR[b.kind].light);
      p.say(b.name, BOON_COLOR[b.kind].name, a.x, a.z);
      v.hud?.clearCards();
      // A tap on a card walked the hero here: that order is done, or it would hold the hero on the altar.
      v.api.heroMode.halt();
      v.pick(b, i);
    };
    const objectives: Objective[] = [
      ...v.offers.map((_, i): Objective => ({ part: i, x: TOWER_ALTARS[i].x, z: TOWER_ALTARS[i].z, radius: ALTAR_R, can: () => !picked && clock > ALTAR_WAIT && (v.only === undefined || v.only === i) })),
      { part: STAIRS, x: TOWER_STAIRS.x, z: TOWER_STAIRS.z, radius: 1.8, can: () => picked && !climbed },
    ];
    return {
      threats: [], objectives, duration: Infinity,
      look: {
        update(t) {
          clock = t;
          const pulse = 0.5 + 0.18 * Math.sin(t * 3.4);
          altars.forEach((a, i) => {
            a.light.opacity = picked ? 0 : pulse * Math.min(1, t / 0.6);
            a.orb.visible = !picked;
            a.orb.position.y = 1.5 + 0.12 * Math.sin(t * 2 + i * 2);
          });
          stairLight.opacity = picked && !climbed ? pulse : 0;
          glowMat.opacity += ((picked ? 0.5 + 0.12 * Math.sin(t * 2.6) : 0) - glowMat.opacity) * 0.1;
          v.hud?.placeCards();
          v.goal(climbed ? '' : picked ? 'Climb the stairs' : 'Walk onto an altar: take one boon');
        },
        done(o) {
          if (o.part === STAIRS) {
            climbed = true;
            v.climb();
            return;
          }
          take(o.part);
        },
        dispose() {
          v.hud?.clearCards();
          stairLight.dispose();
          glow.removeFromParent();
          glow.geometry.dispose();
          glowMat.dispose();
          for (const a of altars) {
            a.light.dispose();
            a.dais.removeFromParent();
            a.trim.removeFromParent();
            a.orb.removeFromParent();
            a.orb.material.dispose();
          }
          daisMat.dispose();
          trimMat.dispose();
          daisGeo.dispose();
          trimGeo.dispose();
        },
      },
    };
  };
  const move: BossMove = {
    id: 'floor', name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
    aim: () => ({ x: RING.x, z: RING.z, dir: 0 }),
    play,
  };
  const def: BossDef = {
    id: 'tower-landing', hall: true, name: 'The landing', title: '', place: v.place,
    starts: { boss: { x: TOWER_STAIRS.x, z: TOWER_STAIRS.z }, heroes: [at, at, at] },
    kit: () => unseen('The landing', 1), hp: { solo: 1, duo: 1 }, scale: 1, body: { radius: 0.1, height: 0.1 }, speed: 0, keepAt: 999,
    staggerMax: 1e9, kneel: 0, phasePause: 0, phases: [{ name: '', at: 1, moves: [], gap: [1, 1] }],
    moves: { floor: move },
  };
  // Nothing here needs a brain: the altars and the stairs only wait.
  const link = new TowerLink(def, 1, {}, false);
  return {
    def, link,
    begin: () => link.on.cast({ id: LANDING_CAST, move: 'floor', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed: 1, target: 0 }),
  };
}
