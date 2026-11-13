import * as THREE from 'three';
import { softDotTexture } from '../../effects/common';
import { HoldRing, LightPillar } from '../../raid/fx';
import { STAND_COLOR } from '../../raid/script';
import type { QuestDef, Spot, Step } from './def';
import type { QuestLine } from './hud';
import { personLook } from './looks';
import type { ZoneCtx } from './ctx';
import type { SummonUnit } from '../../effects/summon';

/**
 * The quest verbs of the closed vocabulary (pipeline/designs/tower-worlds-build.md): `reach`, `fell`, `fell-named`, `light`, `hold`,
 * `carry`, `open`, `lead`. A quest is a list of steps; a step is one verb with its place and number, done when its condition holds,
 * and the hero's walk is what does it, so a phone needs no new button. The state is the run's (`WorldRun.quests`), so the zone is
 * rebuilt from it at any time; this class holds only what is drawn and what is alive (a wave, the escorted one).
 */

const FLAME = 0xffb050, KEY = 0xffd27a;
/** How near the hero must be to pick the carried thing up (m), and the wait after it dropped (s). */
const PICK = 1.7, DROP_WAIT = 1.2;
/** The carry's walk speed against the hero's own. */
const CARRY_SLOW = 0.85;
const LIGHT_R = 2.4;

export class Quests {
  /** The quest the screen follows. */
  trackedId: string | null = null;
  private mark: LightPillar;
  private ring: HoldRing | null = null;
  private ringFor = '';
  private waveAt = 0;
  private waves = 0;
  private lights = new Map<string, { pillar: LightPillar; orb: THREE.Sprite }>();
  private litFor = new Map<string, number>();
  private key: { group: THREE.Group; pillar: LightPillar } | null = null;
  private dropWait = 0;
  private lastHp = -1;
  private lead: { unit: SummonUnit | null; at: number; started: boolean; made: boolean } | null = null;
  private leadFor = '';
  private t = 0;
  private marks = new Set<LightPillar>();
  /** For the tool: the verbs done at least once in this zone. */
  readonly doneVerbs = new Set<string>();

  constructor(private z: ZoneCtx) {
    this.mark = new LightPillar(0, 0, 1.3, 7, STAND_COLOR);
    z.p.group.add(this.mark.mesh);
    this.marks.add(this.mark);
    this.trackedId = this.pickTracked();
    // Lit things stay lit: a beacon where they were.
    for (const q of z.def.quests) for (const s of q.steps) if (s.verb === 'light') for (const th of s.things) if (z.run.lit.includes(th.id)) this.beacon(th.id, th.at, true);
    // A thing carried when the zone was rebuilt is carried still.
    if (z.run.carry?.held) this.z.mute(true);
  }

  private questOf(id: string) {
    return this.z.def.quests.find((q) => q.id === id)!;
  }
  private stepOf(q: QuestDef): Step | null {
    const st = this.z.run.q(q.id);
    return st.taken && !st.done ? q.steps[st.step] ?? null : null;
  }
  /** Quests taken and not done, the main one first. */
  active() {
    return this.z.def.quests.filter((q) => this.z.run.q(q.id).taken && !this.z.run.q(q.id).done).sort((a, b) => Number(!!b.main) - Number(!!a.main));
  }
  private pickTracked() {
    if (this.trackedId && this.z.run.q(this.trackedId).taken && !this.z.run.q(this.trackedId).handedIn) return this.trackedId;
    const open = this.z.def.quests.filter((q) => this.z.run.q(q.id).taken && !this.z.run.q(q.id).handedIn);
    return (open.find((q) => q.main) ?? open[0])?.id ?? null;
  }
  track(id: string) {
    this.trackedId = id;
  }

  /** How far a step is: k of n. */
  progressOf(step: Step, st: { progress: number }): { k: number; n: number } {
    const z = this.z;
    switch (step.verb) {
      case 'fell': {
        let n = 0, left = 0;
        for (const id of step.packs) { const pk = z.packs.get(id); if (pk) { n += pk.total; left += pk.state === 'cleared' ? 0 : pk.left; } }
        return { k: n - left, n };
      }
      case 'light': return { k: step.things.filter((t) => z.run.lit.includes(t.id)).length, n: step.things.length };
      case 'hold': return { k: Math.floor(st.progress), n: step.seconds };
      case 'lead': return { k: st.progress, n: step.path.length };
      default: return { k: 0, n: 1 };
    }
  }

  lines(): QuestLine[] {
    const z = this.z;
    return z.def.quests.filter((q) => z.run.q(q.id).taken && !z.run.q(q.id).handedIn).map((q) => {
      const st = z.run.q(q.id), step = q.steps[Math.min(st.step, q.steps.length - 1)];
      const { k, n } = this.progressOf(step, st);
      return { id: q.id, name: q.name, text: step.text, k, n, done: st.done, tracked: q.id === this.trackedId, side: !q.main };
    });
  }

  take(id: string) {
    const z = this.z, st = z.run.q(id), q = this.questOf(id);
    if (st.taken) return;
    st.taken = true;
    st.step = 0;
    st.progress = 0;
    if (!this.trackedId || q.main) this.trackedId = id;
    z.banner(q.name, q.steps[0].text);
    z.save();
  }

  /** Done with every step: the giver pays. */
  handIn(id: string) {
    const z = this.z, st = z.run.q(id), q = this.questOf(id);
    if (!st.done || st.handedIn) return;
    st.handedIn = true;
    z.pay(q.reward.shards);
    if (q.reward.relic) z.giveRelic();
    if (q.reward.boon) z.offerBoon(`${q.name}: choose a boon`);
    z.banner('Quest done', q.name);
    if (this.trackedId === id) this.trackedId = this.pickTracked();
    z.save();
  }

  /** Where the tracked step is: for the mark and the arrow. */
  target(): Spot | null {
    const z = this.z;
    if (!this.trackedId) return null;
    const q = this.questOf(this.trackedId), st = z.run.q(q.id);
    if (st.done) return z.def.people.find((p) => p.id === q.giver)?.at ?? null;
    const s = q.steps[st.step];
    if (!s) return null;
    switch (s.verb) {
      case 'reach': case 'hold': return s.at;
      case 'fell': {
        const open = s.packs.map((id) => z.packs.get(id)).filter((p) => p && p.state !== 'cleared');
        return open[0]?.home ?? null;
      }
      case 'fell-named': return z.packs.get(s.pack)?.home ?? null;
      case 'light': return s.things.find((t) => !z.run.lit.includes(t.id))?.at ?? null;
      case 'carry': return z.run.carry?.held ? s.to : z.run.carry ? z.run.carry.at : s.from;
      case 'open': return z.def.doors.find((d) => d.id === s.door)?.at ?? null;
      case 'lead': return this.lead?.unit?.alive ? { x: this.lead.unit.pos.x, z: this.lead.unit.pos.z } : s.from;
    }
  }

  private beacon(id: string, at: Spot, lit: boolean) {
    let b = this.lights.get(id);
    if (!b) {
      const pillar = new LightPillar(at.x, at.z, 1.6, 12, FLAME);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: FLAME, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      orb.position.set(at.x, 2.2, at.z);
      orb.scale.setScalar(2.4);
      this.z.p.group.add(pillar.mesh, orb);
      this.marks.add(pillar);
      b = { pillar, orb };
      this.lights.set(id, b);
    }
    b.pillar.opacity = lit ? 0.62 : 0;
    b.orb.visible = lit;
  }

  private finishStep(q: QuestDef, extra?: () => void) {
    const z = this.z, st = z.run.q(q.id), step = q.steps[st.step];
    this.doneVerbs.add(step.verb);
    extra?.();
    st.step++;
    st.progress = 0;
    if (st.step >= q.steps.length) {
      st.done = true;
      z.banner('Step done', `${q.name}: return to ${z.def.people.find((p) => p.id === q.giver)?.name ?? 'the giver'}`, 3);
    } else z.banner('Step done', `Next: ${q.steps[st.step].text}`, 2.4);
    this.dropRing();
    z.save();
  }

  private dropRing() {
    this.ring?.dispose();
    this.ring = null;
    this.ringFor = '';
  }

  update(dt: number) {
    const z = this.z, hero = z.hero;
    this.t += dt;
    this.trackedId = this.pickTracked();
    // The mark over the tracked step's place.
    const tg = this.target();
    this.mark.mesh.visible = !!tg;
    if (tg) {
      this.mark.mesh.position.set(tg.x, 0.04, tg.z);
      this.mark.opacity = 0.3 + 0.12 * Math.sin(this.t * 3);
    }
    // The carried thing's drop: a hit that lands (health falls).
    const hp = z.api.duel.heroHp;
    const hit = this.lastHp >= 0 && hp < this.lastHp - 0.5;
    this.lastHp = hp;
    this.dropWait = Math.max(0, this.dropWait - dt);
    if (hit && z.run.carry?.held) {
      z.run.carry = { item: z.run.carry.item, held: false, at: { x: hero.x, z: hero.z } };
      this.dropWait = DROP_WAIT;
      z.mute(false);
      z.speed('carry', 1);
      z.say('Dropped', '#ff9a8a', hero);
      z.p.sparks.emit(hero.x, 1, hero.z, 14, 3, 3, 0.6, KEY);
    }
    for (const q of this.active()) {
      const st = z.run.q(q.id), step = q.steps[st.step];
      if (!step) continue;
      this.stepUpdate(q, step, st, dt);
    }
    // The ring and the key and the beacons are only where a step wants them.
    if (this.key) {
      const bob = Math.sin(this.t * 2.4) * 0.12;
      this.key.group.position.y = 0.9 + bob;
      this.key.group.rotation.y += dt * 1.6;
    }
    for (const b of this.lights.values()) b.orb.scale.setScalar(2.2 + Math.sin(this.t * 3) * 0.25);
  }

  private stepUpdate(q: QuestDef, step: Step, st: { progress: number; step: number }, dt: number) {
    const z = this.z, hero = z.hero, dist = (a: Spot) => Math.hypot(hero.x - a.x, hero.z - a.z);
    switch (step.verb) {
      case 'reach':
        if (dist(step.at) < step.r) this.finishStep(q, () => z.p.show.ring(step.at.x, step.at.z, { radius: step.r, life: 0.8, color: 0xffe27a, width: 0.5, peak: 0.6 }));
        break;
      case 'fell': {
        const { k, n } = this.progressOf(step, st);
        if (n > 0 && k >= n && step.packs.every((id) => z.packs.get(id)?.state === 'cleared')) this.finishStep(q);
        break;
      }
      case 'fell-named':
        if (z.packs.get(step.pack)?.state === 'cleared') this.finishStep(q);
        break;
      case 'light': {
        for (const th of step.things) {
          if (z.run.lit.includes(th.id)) continue;
          // The thing waits as a dim light; standing by it for a while lights it.
          this.beacon(th.id, th.at, false);
          const near = dist(th.at) < LIGHT_R;
          const held = near ? (this.litFor.get(th.id) ?? 0) + dt : Math.max(0, (this.litFor.get(th.id) ?? 0) - dt * 2);
          this.litFor.set(th.id, held);
          const b = this.lights.get(th.id)!;
          b.pillar.opacity = 0.2 + 0.4 * Math.min(1, held / step.seconds);
          b.orb.visible = held > 0.05;
          if (near && Math.random() < 0.4) z.p.sparks.emit(th.at.x, 1.2 + Math.random(), th.at.z, 2, 2, 3, 0.7, FLAME);
          if (held >= step.seconds) {
            z.run.lit.push(th.id);
            this.beacon(th.id, th.at, true);
            z.p.show.column(th.at.x, th.at.z, { radius: 1.6, height: 18, life: 1.2, color: FLAME, peak: 0.7 });
            z.p.show.burst(th.at.x, 1.5, th.at.z, 40, 6, 3, 1, FLAME);
            z.p.shake(0.15);
            z.say('Lit', '#ffd27a', th.at);
          }
        }
        if (step.things.every((t) => z.run.lit.includes(t.id))) this.finishStep(q);
        break;
      }
      case 'hold': {
        if (this.ringFor !== q.id) {
          this.dropRing();
          this.ring = new HoldRing(step.at.x, step.at.z, step.r, STAND_COLOR);
          z.p.group.add(this.ring.mesh);
          this.ringFor = q.id;
          this.waves = 0;
          this.waveAt = 0;
          z.p.hint('Gold means stand here');
        }
        const inside = dist(step.at) < step.r;
        if (inside) {
          st.progress += dt;
          this.waveAt += dt;
          if (this.waveAt >= step.waves.every * (this.waves + 0.35)) this.wave(q, step);
        }
        this.ring!.set(st.progress / step.seconds);
        (this.ring!.mesh.material as THREE.MeshBasicMaterial).opacity = inside ? 1 : 0.55;
        if (st.progress >= step.seconds) {
          // The sea pulls the rest back.
          for (const [id, pk] of z.packs) if (id.startsWith(`hold-${q.id}`)) pk.dispose();
          this.finishStep(q, () => z.p.show.ring(step.at.x, step.at.z, { radius: step.r * 2, life: 0.9, color: STAND_COLOR, width: 0.8, peak: 0.6 }));
        }
        break;
      }
      case 'carry': {
        const c = z.run.carry;
        if (!c) {
          this.keyAt(step.from);
          if (dist(step.from) < PICK && this.dropWait <= 0) this.pickUp(step);
        } else if (!c.held) {
          this.keyAt(c.at);
          if (dist(c.at) < PICK && this.dropWait <= 0) this.pickUp(step);
        } else {
          this.keyAt(null);
          if (dist(step.to) < step.r) {
            this.finishStep(q, () => {
              z.run.carry = null;
              z.mute(false);
              z.speed('carry', 1);
              z.say('Delivered', '#ffd27a', step.to);
              z.p.show.column(step.to.x, step.to.z, { radius: 1.6, height: 12, life: 1, color: KEY, peak: 0.6 });
              if (step.opens) z.openDoor(step.opens);
            });
          }
        }
        break;
      }
      case 'open': {
        const d = z.def.doors.find((x) => x.id === step.door)!;
        if (dist(d.at) < d.r + 3) this.finishStep(q, () => z.openDoor(step.door));
        break;
      }
      case 'lead':
        this.leadUpdate(q, step, st, dt);
        break;
    }
  }

  private wave(q: QuestDef, step: Extract<Step, { verb: 'hold' }>) {
    const z = this.z, ring = step.at;
    // From the ring's edge, on the side the hero is not looking at the sea from: the first clear spot of a few.
    let at = { x: ring.x, z: ring.z };
    for (let i = 0; i < 8; i++) {
      const a = (this.waves * 2.1 + i * 0.8) % (Math.PI * 2), x = ring.x + Math.cos(a) * (step.r + 5), zz = ring.z + Math.sin(a) * (step.r + 5);
      if (z.api.arena.lineOfSight(new THREE.Vector3(x, 0, zz), new THREE.Vector3(ring.x, 0, ring.z))) { at = { x, z: zz }; break; }
    }
    const counts = new Map<string, number>();
    for (const k of step.waves.kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    const pack = z.hunt({ id: `hold-${q.id}-${this.waves}`, at, mix: [...counts].map(([kind, n]) => ({ kind, n })) });
    pack.spawn(true);
    this.waves++;
    z.banner('They come', '', 1.4);
  }

  private keyAt(at: Spot | null) {
    if (!at) {
      if (this.key) { this.key.pillar.dispose(); this.key.group.removeFromParent(); this.key = null; }
      return;
    }
    if (!this.key) {
      const group = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 0.8, roughness: 0.3, emissive: 0xffb050, emissiveIntensity: 0.7 });
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16), gold);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), gold);
      shaft.position.y = -0.6;
      for (const y of [-0.8, -0.62]) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), gold);
        tooth.position.set(0.18, y, 0);
        group.add(tooth);
      }
      bow.position.y = 0.05;
      group.add(bow, shaft);
      group.scale.setScalar(1.3);
      const pillar = new LightPillar(at.x, at.z, 0.9, 5, KEY);
      pillar.opacity = 0.5;
      this.z.p.group.add(group, pillar.mesh);
      this.marks.add(pillar);
      this.key = { group, pillar };
    }
    this.key.group.position.x = at.x;
    this.key.group.position.z = at.z;
    this.key.pillar.mesh.position.set(at.x, 0.04, at.z);
  }

  private pickUp(step: Extract<Step, { verb: 'carry' }>) {
    const z = this.z;
    z.run.carry = { item: step.item, held: true, at: { x: z.hero.x, z: z.hero.z } };
    z.mute(true);
    z.speed('carry', CARRY_SLOW);
    z.say('The captain’s key', '#ffd27a', z.hero);
    z.banner('You have the key', 'Carry it to the winch. A hit makes you drop it.', 2.6);
    z.save();
  }

  private leadUpdate(q: QuestDef, step: Extract<Step, { verb: 'lead' }>, st: { progress: number }, dt: number) {
    const z = this.z, arena = z.api.arena;
    if (this.leadFor !== q.id || !this.lead) {
      this.leadFor = q.id;
      this.lead = { unit: null, at: st.progress, started: false, made: false };
    }
    const L = this.lead;
    if (!L.unit || !L.unit.alive) {
      if (L.made && L.unit && !L.unit.alive) {
        // He fell: he stands again where the road began, and the walk starts over.
        z.banner(`${step.name} fell`, 'He stands again at the start of the road.', 2.4);
        st.progress = 0;
        L.at = 0;
        L.started = false;
      }
      const at = st.progress > 0 ? step.path[Math.min(step.path.length - 1, st.progress - 1)] : step.from;
      const handle = arena.summonFor('hero', {
        kind: 'melee', at: new THREE.Vector3(at.x, 0, at.z), hp: 260, seconds: 3600, damage: 0.001, attackEvery: 999, speed: 2.5, color: '#e8d8a8', look: personLook(),
        // The summon system walks a unit only toward a victim (there is none while nothing is awake), so the escort is walked from
        // here; its `goal` keeps it from running at whatever stirs.
        goal: (pos) => pos.clone(),
      });
      L.unit = handle.units[0] ?? null;
      L.made = !!L.unit;
      L.at = st.progress;
      return;
    }
    const u = L.unit, far = Math.hypot(z.hero.x - u.pos.x, z.hero.z - u.pos.z);
    if (!L.started && far < 4.5) {
      L.started = true;
      z.say(`${step.name} follows`, '#e8d8a8', u.pos);
    }
    // He walks the road from waypoint to waypoint, waiting while the hero is far; a waypoint reached is kept in the run.
    const wp = step.path[Math.min(L.at, step.path.length - 1)];
    if (L.started && far <= 11 && L.at < step.path.length) {
      const to = new THREE.Vector3(wp.x, 0, wp.z), way = arena.route(u, u.pos, to).point, dx = way.x - u.pos.x, dz = way.z - u.pos.z, len = Math.hypot(dx, dz) || 1;
      u.pos.x += (dx / len) * Math.min(len, 2.5 * dt);
      u.pos.z += (dz / len) * Math.min(len, 2.5 * dt);
      arena.keepInside(u.pos, 0.5);
      u.figure.group.rotation.y = Math.atan2(dx, dz);
    }
    if (Math.hypot(u.pos.x - wp.x, u.pos.z - wp.z) < 1.4 && L.at < step.path.length) {
      L.at++;
      st.progress = L.at;
    }
    if (L.at >= step.path.length) {
      const last = step.path[step.path.length - 1];
      if (Math.hypot(u.pos.x - last.x, u.pos.z - last.z) < step.r + 1.5) {
        arena.summons.dismiss(u);
        this.lead = null;
        z.say(`${step.name} is home`, '#ffd27a', last);
        this.finishStep(q);
      }
    }
  }

  /** The escorted one's place, for the bot and the arrow. */
  get leadAt(): Spot | null {
    const u = this.lead?.unit;
    return u?.alive ? { x: u.pos.x, z: u.pos.z } : null;
  }
  get leadStarted() {
    return !!this.lead?.started;
  }
  /** The place the escorted one walks to next. */
  leadNext(): Spot | null {
    const q = this.active().find((x) => this.stepOf(x)?.verb === 'lead');
    if (!q || !this.lead) return null;
    const s = this.stepOf(q) as Extract<Step, { verb: 'lead' }>;
    return s.path[Math.min(this.lead.at, s.path.length - 1)];
  }

  dispose() {
    this.dropRing();
    for (const m of this.marks) m.dispose();
    for (const b of this.lights.values()) { b.orb.removeFromParent(); b.orb.material.dispose(); }
    this.lights.clear();
    this.key?.group.removeFromParent();
    this.key = null;
    if (this.lead?.unit?.alive) this.z.api.arena.summons.dismiss(this.lead.unit);
    this.lead = null;
  }
}
