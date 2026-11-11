import * as THREE from 'three';
import { RAID_RUN } from '../../server/protocol.mjs';
import { HALL_ALTARS, HALL_GATES, HALL_STARTS, KeepGate, noonfallHall, type GateTone } from '../arenas/noonfall';
import { RING } from '../arenas/common';
import { softDotTexture } from '../effects/common';
import type { HeroKey, HeroKit, HeroSpell } from '../heroes';
import type { GameApi } from '../runtime';
import { TOUCH } from '../touch';
import { LightPillar } from './fx';
import { STAND_COLOR } from './script';
import type { BossCast, BossDef, BossMove, Objective, PlayContext, RaidEvents, RaidLink, RaidSide } from './types';
import { RARITY_COLOR, type Upgrade } from './upgrades';
import type { Omen } from './omens';

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, done() {}, wall() {}, end() {} };
/** Which objective the gate is: the altars are 0, 1 and 2. */
const GATE = 9;
const ALTAR_R = 1.5;
/** How far from a gate's spot its posts stand, toward the rim (m). */
const GATE_BACK = 1.5;
/** Narrower than this (px), the cards sit in a row instead of over their altars. */
const NARROW = 560;
/** How long the screen takes to go dark, or to come back (ms). */
const FADE_MS = 260;

const fadeEl = document.createElement('div');
fadeEl.style.cssText = `position:fixed;inset:0;z-index:18;background:#050306;opacity:0;pointer-events:none;transition:opacity ${FADE_MS}ms linear;`;

/** The screen goes dark, or comes back: walking through a gate is a fade, not a menu. */
export function fadeTo(dark: boolean, at = FADE_MS) {
  if (!fadeEl.parentElement) document.body.append(fadeEl);
  fadeEl.style.transitionDuration = `${at}ms`;
  fadeEl.style.opacity = dark ? '1' : '0';
  return new Promise<void>((done) => { setTimeout(done, at); });
}

/** Nothing here is shared: each screen has its own altars, and the hub only waits for the picks and the gate. */
class HallLink implements RaidLink {
  readonly brain = false;
  readonly maxHp = 1;
  on = NO_EVENTS;
  constructor(readonly solo: boolean, readonly side: RaidSide) {}
  cast() {}
  damage() {}
  stagger() {}
  stood() {}
  reward() {}
  addHit() {}
  wallSaved() {}
  heroDown() {}
  heroHp() {}
  revive() {}
  heroAlt() {}
  bossDebuff() {}
  heroCast() {}
  heroAttack() {}
  tick() {}
  objective(id: number, part: number) {
    this.on.done(id, part, this.side);
  }
}

const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });

/** What the screen needs to know of one stay in the hall. */
export interface HallVisit {
  hero: string;
  name?: string;
  partner?: { kit: HeroKit; name: string };
  side: RaidSide;
  solo: boolean;
  /** The boss beyond the gate. */
  next: BossDef;
  tier: number;
  offers: Upgrade[];
  /** This tier's omens, shown under the words on top. */
  omens?: readonly Omen[];
  /** How long the pick has before it takes the first (s). */
  seconds: number;
  seed: string;
  /** Who else has to pick, for the words on screen. */
  waiting?: string;
  /** An upgrade was taken: an altar walked onto, or the first when time ran out. */
  pick(u: Upgrade): void;
  /** This hero walked into the open gate. */
  enter(): void;
}

/**
 * Noonfall's hall, where a run lives between its fights. It is a boss fight with no boss: the same duel path, so a hero walks and a
 * partner shows as in a fight, and the altars and the gate are objectives, so arrows, the autopilot and the bots all find them.
 */
export class RaidHall {
  private root = document.createElement('div');
  private head = document.createElement('div');
  private clock = document.createElement('div');
  private omenEl = document.createElement('div');
  private cards: HTMLButtonElement[] = [];
  private spot = new THREE.Vector3();
  private visit: HallVisit | null = null;
  private picked: Upgrade | null = null;
  private gateOn = false;
  private entered = false;
  private gateLeft = 0;

  constructor(private api: GameApi) {
    this.root.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;display:none;user-select:none;font:600 13px ui-sans-serif,system-ui;color:#e9dcc6;';
    this.head.style.cssText = `position:absolute;left:50%;top:calc(${TOUCH ? 10 : 16}px + env(safe-area-inset-top, 0px));transform:translateX(-50%);width:max-content;max-width:calc(100vw - 110px);text-align:center;` +
      `font:700 ${TOUCH ? 14 : 17}px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;text-shadow:0 1px 5px #000;`;
    this.clock.style.cssText = 'font:600 12px ui-sans-serif,system-ui;letter-spacing:0;color:#e9dcc6;opacity:0.85;margin-top:2px;';
    this.omenEl.className = 'raid-omens';
    this.omenEl.style.cssText = `display:flex;flex-direction:column;gap:3px;align-items:center;margin-top:${TOUCH ? 5 : 8}px;font:500 ${TOUCH ? 11 : 12}px ui-sans-serif,system-ui;letter-spacing:0;color:#f2e6c8;`;
    this.root.append(this.head);
    document.body.append(this.root);
  }

  /** The screen goes dark, the hall loads, and it comes back with the hero standing in it. */
  async enter(v: HallVisit, ready: (when: Promise<void>) => Promise<void>) {
    const { api } = this;
    this.visit = v;
    this.picked = null;
    this.gateOn = this.entered = false;
    this.gateLeft = 0;
    await fadeTo(true);
    if (this.visit !== v) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(v.hero);
    api.setHeroMode(true);
    api.duel.holdStart = false;
    const link = new HallLink(v.solo, v.side);
    api.duel.startBoss({ def: this.def(v), link, seed: v.seed, mode: 'play', name: v.name, partner: v.partner });
    this.showCards(v);
    this.root.style.display = '';
    const cast: BossCast = { id: 1, move: 'hall', step: 0, x: RING.x, z: RING.z, fx: RING.x, fz: RING.z, dir: 0, seed: 1, target: v.side };
    link.on.cast(cast);
    await ready(api.duel.whenReady());
    if (this.visit !== v) return;
    await fadeTo(false);
  }

  /** The gate to the next boss opens. `seconds`: how long it waits for this hero, when something is waiting at all. */
  openGate(seconds = 0) {
    this.gateOn = true;
    this.gateLeft = seconds;
  }

  /** The hall is done with: what it put on the page goes. */
  close() {
    this.visit = null;
    this.root.style.display = 'none';
    for (const c of this.cards) c.remove();
    this.cards = [];
  }

  private def(v: HallVisit): BossDef {
    return {
      id: 'hall', hall: true, name: 'Noonfall', title: '', place: noonfallHall,
      starts: { boss: { x: RING.x, z: RING.z - 11 }, heroes: HALL_STARTS },
      kit: () => ({ name: 'Noonfall', title: '', accent: '#e8a040', foil: '#ffd27a', portrait: noIcon, maxHp: 1, spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')] } as unknown as HeroKit),
      hp: { solo: 1, duo: 1 }, scale: 1, body: { radius: 0.1, height: 0.1 }, speed: 0, keepAt: 999, staggerMax: 999, kneel: 0, phasePause: 0,
      phases: [{ name: '', at: 1, moves: [], gap: [1, 1] }],
      moves: { hall: this.move(v) },
    };
  }

  /** A card over each altar: what it gives. A tap walks the hero there. */
  private showCards(v: HallVisit) {
    for (const c of this.cards) c.remove();
    const width = TOUCH ? 'min(116px,30vw)' : '178px';
    this.cards = v.offers.map((u, i) => {
      const tone = RARITY_COLOR[u.rarity ?? 'common'];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'raid-offer';
      b.dataset.upgrade = u.id;
      b.style.cssText = `position:absolute;left:0;top:0;width:${width};padding:${TOUCH ? '6px 7px' : '9px 11px'};border-radius:10px;border:${u.rarity ? 2 : 1}px solid ${tone.edge};background:${u.rarity === 'dark' ? 'rgba(30,8,14,0.92)' : 'rgba(20,16,14,0.9)'};color:#f2e6c8;` +
        `cursor:pointer;text-align:left;pointer-events:auto;display:flex;flex-direction:column;gap:3px;font:inherit;box-shadow:0 4px 14px #000a;`;
      const name = document.createElement('div');
      name.style.cssText = `font:700 ${TOUCH ? 12 : 15}px ui-serif,Georgia,serif;color:${tone.name};`;
      name.textContent = u.name;
      if (u.rarity) {
        const kind = document.createElement('div');
        kind.style.cssText = `font:700 ${TOUCH ? 8 : 10}px ui-sans-serif,system-ui;letter-spacing:0.08em;text-transform:uppercase;color:${tone.edge};`;
        kind.textContent = u.rarity === 'rare' ? 'Rare' : u.rarity === 'gold' ? 'Legendary' : 'Dark pact';
        b.append(kind);
      }
      const blurb = document.createElement('div');
      blurb.style.cssText = `font:500 ${TOUCH ? 10 : 12}px ui-sans-serif,system-ui;line-height:1.25;opacity:0.9;`;
      blurb.textContent = u.blurb;
      b.append(name, blurb);
      b.addEventListener('click', () => {
        const a = HALL_ALTARS[i];
        this.api.heroMode.walkTo(a.x, a.z);
      });
      this.root.append(b);
      return b;
    });
  }

  /**
   * Each card over its altar, as the camera moves. On a narrow screen the altars stand too close for three cards, so they sit in a row
   * near the bottom instead, left, middle and right like the altars.
   */
  private placeCards() {
    const cam = this.api.arena.camera, w = innerWidth, h = innerHeight;
    if (w < NARROW) {
      const cw = Math.floor((w - 24) / 3);
      this.cards.forEach((c, i) => {
        c.style.width = `${cw}px`;
        // Just over the joystick, where the hero coming in from the south has already walked past.
        c.style.transform = `translate(${6 + i * (cw + 6)}px,${Math.round(h - (TOUCH ? 185 : 120) - c.offsetHeight)}px)`;
      });
      return;
    }
    this.cards.forEach((c, i) => {
      const a = HALL_ALTARS[i];
      this.spot.set(a.x, 2.1, a.z).project(cam);
      const cw = c.offsetWidth, ch = c.offsetHeight;
      const x = Math.min(w - cw - 6, Math.max(6, ((this.spot.x + 1) / 2) * w - cw / 2));
      const y = Math.min(h - ch - 6, Math.max(TOUCH ? 58 : 66, ((1 - this.spot.y) / 2) * h - ch));
      c.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    });
  }

  /** Everything the hall does, as one long cast. */
  private move(v: HallVisit): BossMove {
    const hall = this;
    return {
      id: 'hall', name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
      aim: () => ({ x: RING.x, z: RING.z, dir: 0 }),
      play(c, p) {
        return hall.play(v, c, p);
      },
    };
  }

  private play(v: HallVisit, c: BossCast, p: PlayContext) {
    const target = HALL_GATES[v.next.id] ?? HALL_GATES.sun;
    const makeGate = (id: GateTone) => {
      const g = HALL_GATES[id], dx = g.x - RING.x, dz = g.z - RING.z, d = Math.hypot(dx, dz);
      const gate = new KeepGate(g.x + (dx / d) * GATE_BACK, g.z + (dz / d) * GATE_BACK, g.yaw, id);
      p.group.add(gate.group);
      return gate;
    };
    // One gate for each boss of the run.
    const gates = (RAID_RUN as GateTone[]).filter((id) => HALL_GATES[id]).map((id) => ({ id, gate: makeGate(id) }));
    const open = (gates.find((g) => g.id === v.next.id) ?? gates[0]).gate;
    const gateLight = new LightPillar(target.x, target.z, 2, 5, STAND_COLOR);
    p.group.add(gateLight.mesh);

    // The altars: a low dais a hero walks onto, with a light over it.
    const daisMat = new THREE.MeshStandardMaterial({ color: 0x2e2a30, roughness: 0.7, metalness: 0.2, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.3 });
    const daisGeo = new THREE.CylinderGeometry(ALTAR_R, ALTAR_R + 0.2, 0.14, 12).translate(0, 0.07, 0);
    const trimGeo = new THREE.TorusGeometry(ALTAR_R - 0.08, 0.05, 6, 36).rotateX(Math.PI / 2).translate(0, 0.15, 0);
    const altars = HALL_ALTARS.slice(0, v.offers.length).map((a, i) => {
      const tone = RARITY_COLOR[v.offers[i].rarity ?? 'common'];
      const dais = new THREE.Mesh(daisGeo, daisMat), trim = new THREE.Mesh(trimGeo, trimMat);
      dais.position.set(a.x, 0, a.z);
      trim.position.set(a.x, 0, a.z);
      dais.receiveShadow = true;
      const light = new LightPillar(a.x, a.z, ALTAR_R - 0.1, 4, tone.light);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: tone.light, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      orb.position.set(a.x, 1.5, a.z);
      orb.scale.setScalar(0.9);
      p.group.add(dais, trim, light.mesh, orb);
      return { dais, trim, light, orb };
    });

    const take = (u: Upgrade, i: number) => {
      if (this.picked) return;
      this.picked = u;
      p.sparks.emit(HALL_ALTARS[i].x, 1, HALL_ALTARS[i].z, 34, 4, 4, 0.8, STAND_COLOR);
      p.say(u.name, '#ffe27a', HALL_ALTARS[i].x, HALL_ALTARS[i].z);
      for (const card of this.cards) card.remove();
      this.cards = [];
      // A tap on a card walked the hero here: that order is done, or it would keep the hero on the altar.
      this.api.heroMode.halt();
      v.pick(u);
    };

    const objectives: Objective[] = [
      ...v.offers.map((_, i): Objective => ({ part: i, x: HALL_ALTARS[i].x, z: HALL_ALTARS[i].z, radius: ALTAR_R, can: () => !this.picked })),
      { part: GATE, x: target.x, z: target.z, radius: 2, can: () => this.gateOn && !this.entered },
    ];
    const headText = document.createTextNode('');
    this.head.replaceChildren(headText, this.clock, this.omenEl);
    this.omenEl.replaceChildren(...(v.omens ?? []).map((o) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:3px 9px;border-radius:8px;background:rgba(40,14,8,0.78);border:1px solid #a0502a;box-shadow:0 2px 8px #0008;';
      const name = document.createElement('b');
      name.style.cssText = 'color:#ff9a5a;font-weight:700;';
      name.textContent = `Omen · ${o.name}: `;
      row.append(name, o.blurb);
      return row;
    }));
    const nextName = `${v.next.name}${v.tier > 1 ? `, tier ${v.tier}` : ''}`;
    let last = 0;
    return {
      threats: [], objectives, duration: Infinity,
      look: {
        update: (t: number, dt: number) => {
          last = t;
          for (const g of gates) g.gate.update(dt, t);
          open.setOpen(this.gateOn);
          const pulse = 0.5 + 0.18 * Math.sin(t * 3.4);
          altars.forEach((a, i) => {
            const taken = !!this.picked;
            a.light.opacity = taken ? 0 : pulse;
            a.orb.visible = !taken;
            a.orb.position.y = 1.5 + 0.12 * Math.sin(t * 2 + i * 2);
          });
          gateLight.opacity = this.gateOn && !this.entered ? pulse : 0;
          this.placeCards();
          // The words on top, and the pick's clock: time running out takes the first.
          if (!this.picked) {
            const left = v.seconds - t;
            headText.textContent = 'Walk onto an altar to take its upgrade';
            this.clock.textContent = `Next: ${nextName} · ${Math.max(0, Math.ceil(left))} s`;
            if (left <= 0) take(v.offers[0], 0);
          } else if (this.entered) {
            headText.textContent = v.waiting ?? 'Noonfall';
            this.clock.textContent = '';
          } else if (this.gateOn) {
            headText.textContent = `The gate to ${v.next.name} is open`;
            if (this.gateLeft > 0) this.gateLeft = Math.max(0, this.gateLeft - dt);
            this.clock.textContent = this.gateLeft > 0 ? `Walk through · ${Math.ceil(this.gateLeft)} s` : 'Walk through';
          } else {
            headText.textContent = v.waiting ?? 'The gate is opening';
            this.clock.textContent = `Next: ${nextName}`;
          }
        },
        done: (o: Objective) => {
          void last;
          if (o.part === GATE) {
            this.entered = true;
            v.enter();
            return;
          }
          take(v.offers[o.part], o.part);
        },
        dispose: () => {
          for (const g of gates) g.gate.dispose();
          gateLight.dispose();
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
  }
}
