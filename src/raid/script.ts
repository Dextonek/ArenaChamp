import * as THREE from 'three';
import { raidTierFactor } from '../../server/protocol.mjs';
import { grown } from '../arenas/hazards/base';
import { FloorGlows, Sparks } from '../arenas/hazards/fx';
import { TelegraphLayer, insideTelegraph, type TelegraphClip, type TelegraphSpec } from '../effects/telegraph';
import { ShowFx } from './fxShow';
import { LAVA } from './omens';
import { CLOSE_CALL } from './upgrades';
import type { BossCast, BossDef, BossWorld, Objective, PlayContext, PlayedMove, RaidLink, RaidSide, Threat } from './types';

/** Pale orange means leave, gold means stand here. Never the spells' red. */
export const LEAVE_COLOR = 0xe8863a;
export const STAND_COLOR = 0xffe27a;
/** White: stand still, wherever you are (a zone that burns only who walks, `Threat.moving`). Its move draws it. */
export const STILL_COLOR = 0xf2f6ff;
/** Such a zone looks at the moment before it lands (s), and lets a hero still go this far in it (m): a step that was ending, not a walk. */
export const STILL_WINDOW = 0.25;
export const STILL_SLACK = 0.25;
export const LEAVE_ALPHA = 0.72;
const STAND_ALPHA = 1;
/** What standing in a zone costs a summoned unit. */
const UNIT_HIT = 60;
/** The margin (m) an AI keeps round a zone. */
const MARGIN = 0.5;
/** How long a cast stays to hear a gold zone's result: longer than the hub waits for the other screen (s). */
const STOOD_WAIT = 2.5;
const CAST_LOCKOUT = 0.25;
/** Molten Ground's lava: deeper than the zones' pale orange. */
const LAVA_COLOR = 0xff5418;
const LAVA_ALPHA = 0.8;

/** A pool of lava an orange circle left (the Molten Ground omen). */
interface Pool {
  x: number;
  z: number;
  radius: number;
  age: number;
  /** When it last burnt this screen's hero. */
  burnt: number;
  layer: TelegraphLayer;
}

interface Active {
  cast: BossCast;
  played: PlayedMove;
  began: number;
  leave: TelegraphLayer;
  stand: TelegraphLayer;
  /** When this cast last hit this screen's hero. */
  struck?: number;
  /** One of its zones just missed this hero (Close Call). */
  close?: boolean;
}

/**
 * Plays casts: draws their zones, lands them, and decides the hits on this screen's hero. It never reads a hero to place
 * anything; each zone comes from the cast (see the rules in ./types.ts). Several moves can run at once, in both colours.
 */
export class BossScript {
  readonly group = new THREE.Group();
  /** Counts the casts so far: an AI rolls its reaction once per cast. */
  eventId = 0;
  /** What every hit on this screen's hero is multiplied by: more once the boss enrages. */
  rage = 1;
  /** The same for this tier's omens (Brittle), for the whole fight. */
  harm = 1;
  /** Molten Ground: an orange circle leaves lava where it lands. */
  molten = false;
  /** Close Call: an orange zone that lands just beside this hero (not on it). */
  closeCall: (() => void) | null = null;
  /** Sun Eater: this hero stood in a gold zone as it landed. */
  ateSun: (() => void) | null = null;
  /** Twin Flames: the line this boss's zones stop at while the wall of fire stands, or null (src/raid/twin.ts). */
  clip: (() => TelegraphClip | null) | null = null;
  private pools: Pool[] = [];
  private active: Active[] = [];
  private clock = 0;
  private sparks = new Sparks(280, 0.18);
  private glows = new FloorGlows(10);
  /** The big moments' effects, shared by every cast of this fight. */
  readonly show: ShowFx;
  private ctx: PlayContext;

  constructor(private def: BossDef, private world: BossWorld, private link: RaidLink, extra: Pick<PlayContext, 'flash' | 'guard'> & Partial<Pick<PlayContext, 'label' | 'might'>>, tier = 1) {
    this.show = new ShowFx(world.camera);
    this.group.add(this.sparks.points, this.glows.group, this.show.group);
    const pace = raidTierFactor(tier);
    this.ctx = {
      shown: (seconds) => (seconds <= 1 ? seconds : Math.max(1, seconds * pace)),
      camera: world.camera,
      group: this.group,
      sparks: this.sparks,
      glows: this.glows,
      cover: () => world.cover(),
      rayStop: (ax, az, bx, bz) => world.rayStop(ax, az, bx, bz),
      crackFirst: (ax, az, bx, bz) => {
        const i = world.firstWall(ax, az, bx, bz);
        if (i >= 0) world.crackWall(i);
      },
      flash: extra.flash,
      exposed: (s) => world.exposed(s),
      say: (text, color, x, z) => world.say(text, color, x, z),
      solo: link.solo,
      tag: (form, x, z, rx, rz) => world.tag(form, x, z, rx, rz),
      dragMe: (x, z, meters) => {
        const me = world.me();
        if (world.down()) return;
        const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
        if (d > 2.5) world.carryMe((dx / d) * meters, (dz / d) * meters);
      },
      heroAt: (side) => world.heroes().find((h) => h.side === side) ?? null,
      side: link.side,
      hint: (text) => world.hint(text),
      reward: (key, id) => { if (link.brain) link.reward(key, id); },
      cancel: (id) => this.cancel(id),
      heavy: (on) => world.heavy(on),
      mute: (on) => world.mute(on),
      addStone: (x, z, radius, seconds) => world.addStone(x, z, radius, seconds),
      firstStone: (ax, az, bx, bz) => world.firstStone(ax, az, bx, bz),
      dropStone: (o) => world.dropStone(o),
      delayLate: (seconds) => world.delayLate(seconds),
      guard: extra.guard,
      act: (name, step, x, z, seconds) => world.act(name, step, x, z, seconds),
      spawnAdd: (spec) => world.spawnAdd(spec),
      addHit: (id, part, amount) => link.addHit(id, part, amount),
      report: (id, part) => link.objective(id, part),
      bossMax: link.maxHp,
      show: this.show,
      shake: (amount) => world.shake(amount),
      breakCover: (index, dir) => world.breakCover(index, dir),
      label: extra.label ?? (() => {}),
      carry: (to) => {
        if (world.down()) return;
        const me = world.me(), at = to(me.x, me.z);
        if (at && (at.x !== me.x || at.z !== me.z)) world.carryMe(at.x - me.x, at.z - me.z);
      },
      down: () => world.down(),
      might: extra.might ?? (() => {}),
      banner: (text, seconds) => world.banner(text, seconds),
    };
  }

  /** A step of a move reached this screen. */
  play(cast: BossCast) {
    const move = this.def.moves[cast.move];
    if (!move) return;
    // A stage takes the floor: a move that held it (The Hour Strikes) is called off, on every screen at this same cast.
    if (move.stage && cast.step === 0) this.yieldFloor();
    const played = move.play(cast, this.ctx);
    // A cast with nothing to walk out of (only beats to stand still for) is no new event to an AI: its roll for what is in the air stays.
    if (cast.step === 0 && !(played.threats.length && played.threats.every((th) => th.moving))) this.eventId++;
    // A gold zone waits for its result from the hub, which waits for the other screen.
    const gold = played.threats.filter((th) => th.kind === 'stand').map((th) => th.at + STOOD_WAIT);
    if (gold.length) played.duration = Math.max(played.duration, ...gold);
    const leave = new TelegraphLayer(), stand = new TelegraphLayer();
    leave.clip = stand.clip = this.clip?.() ?? null;
    const spec = (th: Threat): TelegraphSpec => ({ shape: th.shape, start: th.show ?? 0, impact: th.at, until: th.to });
    const shown = played.threats.filter((th) => !th.hidden && !th.shapeAt && !th.hits);
    leave.set(shown.filter((th) => th.kind !== 'stand').map(spec), LEAVE_COLOR, LEAVE_ALPHA);
    stand.set(shown.filter((th) => th.kind === 'stand').map(spec), STAND_COLOR, STAND_ALPHA);
    this.group.add(leave.group, stand.group);
    this.active.push({ cast, played, began: this.clock, leave, stand });
  }

  /** One frame. `live`: hits count. */
  update(dt: number, live: boolean) {
    this.clock += dt;
    this.sparks.update(dt);
    this.glows.update(dt);
    this.show.update(dt);
    for (const a of this.active) {
      const t = this.clock - a.began;
      a.leave.update(t);
      a.stand.update(t);
      a.played.look?.update?.(t, dt);
      if (live) this.objectives(a, t, dt);
      for (const th of a.played.threats) {
        if (t < th.at) continue;
        if (!th.landed) {
          th.landed = true;
          a.played.look?.land?.(th);
          if (live) this.land(a, th, t);
          if (live && this.molten) this.pour(th);
        } else if (live && th.to !== undefined && t <= th.to && th.every !== undefined) {
          this.tickZone(a, th, t);
        }
      }
    }
    this.burn(dt, live);
    for (const a of this.active) if (this.clock - a.began >= a.played.duration) this.forget(a);
    this.active = this.active.filter((a) => this.clock - a.began < a.played.duration);
  }

  /** Molten Ground: an orange circle that lands leaves a pool of lava, at most `LAVA.radius` wide, for `LAVA.seconds`. */
  private pour(th: Threat) {
    if (th.kind === 'stand' || th.warn || th.hidden || th.hits || th.shapeAt || !(th.share > 0) || th.shape.kind !== 'circle') return;
    const { x, z } = th.shape, radius = Math.min(LAVA.radius, th.shape.radius);
    const layer = new TelegraphLayer();
    layer.set([{ shape: { kind: 'circle', x, z, radius }, start: 0, impact: 0, until: LAVA.seconds }], LAVA_COLOR, LAVA_ALPHA);
    this.group.add(layer.group);
    this.pools.push({ x, z, radius, age: 0, burnt: -Infinity, layer });
  }

  /** The lava's pools: they age, burn this hero once a second while it stands in one, and go. */
  private burn(dt: number, live: boolean) {
    if (!this.pools.length) return;
    const me = this.world.me(), down = this.world.down();
    for (const p of this.pools) {
      p.age += dt;
      p.layer.update(p.age);
      if (!live || down || p.age > LAVA.seconds || Math.hypot(me.x - p.x, me.z - p.z) > p.radius) continue;
      if (this.clock - p.burnt < LAVA.every) continue;
      // One burn a second, however many pools it stands in.
      for (const q of this.pools) q.burnt = this.clock;
      this.world.hitMe({ share: LAVA.share * this.rage * this.harm, from: { x: p.x, z: p.z }, move: 'lava' });
      break;
    }
    for (const p of this.pools) if (p.age > LAVA.seconds) this.drain(p);
    this.pools = this.pools.filter((p) => p.age <= LAVA.seconds);
  }

  private drain(p: Pool) {
    p.layer.set([]);
    p.layer.group.removeFromParent();
  }

  /** This screen's hero takes a spot: at once, or by holding it. It reports once, and the first report wins. */
  private objectives(a: Active, t: number, dt: number) {
    for (const o of a.played.objectives ?? []) {
      // An add is taken by killing it: its look reports that.
      if (o.kill || o.done || o.reported || this.world.down() || t > (o.until ?? Infinity)) continue;
      const me = this.world.me();
      const inside = Math.hypot(me.x - o.x, me.z - o.z) <= o.radius && (o.can?.() ?? true);
      if (o.hold) {
        o.held = inside && !this.world.busy() ? (o.held ?? 0) + dt / o.hold : Math.max(0, (o.held ?? 0) - dt / o.hold);
        if (o.held < 1) continue;
      } else if (!inside) continue;
      o.reported = true;
      this.link.objective(a.cast.id, o.part);
    }
  }

  /** A hero took an objective, this one or the partner. */
  done(id: number, part: number, side: RaidSide) {
    const a = this.active.find((x) => x.cast.id === id), o = a?.played.objectives?.find((x) => x.part === part);
    if (!a || !o || o.done) return;
    o.done = true;
    a.played.look?.done?.(o, side);
  }

  /** The partner hit an add of cast `id` on its screen. */
  addHit(id: number, part: number, amount: number) {
    this.active.find((x) => x.cast.id === id)?.played.look?.hurt?.(part, amount);
  }

  /** What is still to land of a cast is off. Its look gets a moment to end. */
  private cancel(id: number) {
    const a = this.active.find((x) => x.cast.id === id);
    if (!a) return;
    a.played.look?.off?.();
    a.played.threats = [];
    a.played.objectives = [];
    a.leave.set([]);
    a.stand.set([]);
    a.played.duration = Math.min(a.played.duration, this.clock - a.began + 1.2);
  }

  /** A stage is coming: a move that holds the floor (The Hour Strikes) is called off. Whether there was one. */
  yieldFloor() {
    const held = this.active.filter((a) => this.def.moves[a.cast.move]?.holds && a.played.threats.some((th) => !th.landed));
    for (const a of held) this.cancel(a.cast.id);
    return held.length > 0;
  }

  /** The objectives this screen's hero can take now. */
  private open(): Objective[] {
    const out: Objective[] = [];
    if (this.world.down()) return out;
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const o of a.played.objectives ?? []) if (!o.kill && !o.done && !o.reported && t <= (o.until ?? Infinity) && (o.can?.() ?? true)) out.push(o);
    }
    return out;
  }

  /** The nearest spot an AI should go and take, if one shows. */
  objectiveGoal(x: number, z: number) {
    let best: Objective | null = null, bd = Infinity;
    for (const o of this.open()) {
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private shapeOf(th: Threat, t: number) {
    return th.shapeAt ? th.shapeAt(t) : th.shape;
  }

  /** Whether (x, z) is in a threat at time `t`. */
  private inThreat(th: Threat, t: number, x: number, z: number) {
    return th.hits ? th.hits(x, z, t) : insideTelegraph(this.shapeOf(th, t), x, z);
  }

  /** The first moment of a threat: a gold zone reports who stands in it, an orange one hits who does. */
  private land(a: Active, th: Threat, t: number) {
    // A warning only shows an AI where a later step's hit can reach.
    if (th.warn) return;
    const me = this.world.me();
    const inside = !this.world.down() && this.inThreat(th, t, me.x, me.z);
    if (th.kind === 'stand') {
      th.inside = inside;
      if (inside && !th.tally) this.ateSun?.();
      // A fallen hero's screen has nothing to report: the hub counts the heroes standing.
      if (!this.world.down()) this.link.stood(a.cast.id, th.part ?? 0, inside);
      return;
    }
    if (th.moving) {
      // Only who walks is burnt (`strike`). Nothing just missed, and a unit is left alone.
      if (inside) this.strike(a, th, t);
      return;
    }
    if (inside) this.strike(a, th, t);
    else if (this.closeCall && !this.world.down() && !a.close && !th.hits && !th.shapeAt && insideTelegraph(grown(th.shape, CLOSE_CALL.reach), me.x, me.z)) {
      // Once a cast, however many of its zones just missed.
      a.close = true;
      this.closeCall();
    }
    // A summoned unit doesn't dodge: anything in the zone takes the hit.
    for (const u of this.world.units()) {
      if (this.inThreat(th, t, u.pos.x, u.pos.z) && (!th.source || this.world.sees(th.source.x, th.source.z, u.pos.x, u.pos.z))) this.world.hitUnit(u.figure, UNIT_HIT);
    }
  }

  private tickZone(a: Active, th: Threat, t: number) {
    const me = this.world.me();
    if (this.world.down() || !this.inThreat(th, t, me.x, me.z)) return;
    if (th.lastHit !== undefined && t - th.lastHit < (th.every ?? 1)) return;
    this.strike(a, th, t);
  }

  private strike(a: Active, th: Threat, t: number) {
    const me = this.world.me();
    // A hero standing still as it lands takes nothing.
    if (th.moving && this.world.walked(STILL_WINDOW) <= STILL_SLACK) return;
    if (th.source && !this.world.sees(th.source.x, th.source.z, me.x, me.z)) {
      // Cover saved this hero. The wall that did it falls; a column doesn't.
      if (th.breaks) {
        const wall = this.world.firstWall(th.source.x, th.source.z, me.x, me.z);
        // The room's own walls save a hero too (the Hall of Noon's corners), and stand.
        if (wall >= 0 && !this.def.place.obstacles[wall]?.fixed) this.link.wallSaved(wall);
      }
      return;
    }
    // Zones of one cast that overlap hit once: a fan's lines meet at its source.
    if (a.struck !== undefined && t - a.struck < CAST_LOCKOUT) return;
    a.struck = t;
    th.lastHit = t;
    const move = this.def.moves[a.cast.move];
    this.world.hitMe({ share: th.share * this.rage * this.harm, lethal: th.lethal, knock: th.knock, from: th.source ?? { x: a.cast.fx, z: a.cast.fz }, move: a.cast.move, big: move?.big });
  }

  /**
   * A `stand` zone's result, from whoever keeps it. If nobody stood in it, everyone pays in full. A zone that splits (Shared
   * Burden, Falling Star) costs those in it a share each of its `soak` and those outside nothing; any other (Anchors) is simply held.
   */
  stood(id: number, part: number, count: number) {
    const a = this.active.find((x) => x.cast.id === id);
    if (!a) return;
    const th = a.played.threats.find((x) => x.kind === 'stand' && (x.part ?? 0) === part);
    // A late report can't settle a zone twice.
    if (!th || th.settled) return;
    th.settled = true;
    const hit = (share: number) => this.world.hitMe({ share: share * this.rage * this.harm, from: { x: a.cast.fx, z: a.cast.fz }, move: a.cast.move, big: true });
    // A shelter that holds only so many (`Threat.most`): what those over the number would have taken is shared by all in it.
    if (th.most !== undefined) {
      if (th.inside && count > th.most) {
        this.world.say('CROWDED', '#ffb050', this.world.me().x, this.world.me().z);
        hit((th.share * (count - th.most)) / count);
      }
      return;
    }
    // A zone that is only counted: its move says what the count means, and what the whole party pays for it.
    if (th.tally) {
      const cost = th.tally(count);
      if (cost) hit(cost);
      return;
    }
    if (count <= 0) {
      this.ctx.flash('rgba(255,214,120,0.8)', 0.45);
      hit(th.share);
      return;
    }
    if (th.split) {
      if (th.inside) hit((th.soak ?? th.share) / count);
      return;
    }
    this.world.say('HELD', '#ffe27a', this.world.me().x, this.world.me().z);
  }

  /** Whether (x, z) is hit, or will be within `within` seconds. The AI's walk-out check. */
  danger(x: number, z: number, within: number) {
    for (const p of this.pools) if (p.age < LAVA.seconds - 0.2 && Math.hypot(x - p.x, z - p.z) <= p.radius + MARGIN) return true;
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const th of a.played.threats) {
        // A gold zone is no danger, and neither is a beat that burns only who walks: there is nowhere to walk out of it to.
        if (th.kind === 'stand' || th.moving) continue;
        const end = th.to ?? th.at;
        if (t > end) continue;
        const look = Math.max(within, th.look ?? 0);
        if (th.at - t > look) continue;
        if (th.hits) {
          const m = th.margin ?? 0;
          for (let k = Math.max(t, th.at); k <= Math.min(end, t + look); k += 0.2) {
            if (th.hits(x, z, k) || (m > 0 && (th.hits(x + m, z, k) || th.hits(x - m, z, k) || th.hits(x, z + m, k) || th.hits(x, z - m, k)))) return true;
          }
          continue;
        }
        if (th.shapeAt) {
          // A zone that moves: where it will be over the next moments.
          for (let k = Math.max(t, th.at); k <= Math.min(end, t + look); k += 0.2) {
            if (insideTelegraph(grown(th.shapeAt(k), MARGIN), x, z)) return true;
          }
          continue;
        }
        if (!insideTelegraph(grown(th.shape, MARGIN), x, z)) continue;
        if (th.source && !this.world.sees(th.source.x, th.source.z, x, z)) continue;
        return true;
      }
    }
    return false;
  }

  /** The gold zone an AI should go and stand in, if one shows. */
  standGoal(x: number, z: number) {
    let best: { x: number; z: number } | null = null, bd = Infinity;
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const th of a.played.threats) {
        if (th.kind !== 'stand' || th.landed || t < (th.show ?? 0) || th.shape.kind !== 'circle') continue;
        const d = Math.hypot(th.shape.x - x, th.shape.z - z);
        if (d < bd) { bd = d; best = { x: th.shape.x, z: th.shape.z }; }
      }
    }
    return best;
  }

  /** The gold zones showing now that are still to land. */
  goldSpots() {
    const out: { x: number; z: number }[] = [];
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const th of a.played.threats) {
        if (th.kind === 'stand' && !th.landed && t >= (th.show ?? 0) && th.shape.kind === 'circle') out.push({ x: th.shape.x, z: th.shape.z });
      }
    }
    for (const o of this.open()) out.push({ x: o.x, z: o.z });
    return out;
  }

  /** A warning of a killing hit shows: an AI goes where it can't reach, whatever its habits, and stays there. */
  get mustHide() {
    return this.active.some((a) => a.played.threats.some((th) => th.warn && !th.landed));
  }

  /** Whether (x, z) is out of reach of every killing hit a warning shows now. */
  hidden(x: number, z: number) {
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const th of a.played.threats) if (th.warn && !th.landed && this.inThreat(th, Math.max(t, th.at), x, z)) return false;
    }
    return true;
  }

  /** Seconds until the next beat that burns whoever walks (`Threat.moving`), or Infinity: an AI stops walking just before it. */
  get stillIn() {
    let best = Infinity;
    for (const a of this.active) {
      const t = this.clock - a.began;
      for (const th of a.played.threats) if (th.moving && !th.landed) best = Math.min(best, th.at - t);
    }
    return best;
  }

  /**
   * A move that holds the floor is in the air (The Hour Strikes): how long until it lands, and the moves he may do meanwhile. For a
   * screen that takes the brain over.
   */
  get held() {
    for (const a of this.active) {
      const only = this.def.moves[a.cast.move]?.holds?.only, t = this.clock - a.began;
      const left = only ? Math.max(0, ...a.played.threats.filter((th) => !th.landed).map((th) => th.at - t)) : 0;
      if (only && left > 0) return { left, only };
    }
    return null;
  }

  /** A move is coming after whoever it aims at: an AI starts no long cast now. */
  get wary() {
    return this.active.some((a) => this.def.moves[a.cast.move]?.chases && a.played.threats.some((th) => !th.landed));
  }

  private forget(a: Active) {
    a.leave.set([]);
    a.stand.set([]);
    a.leave.group.removeFromParent();
    a.stand.group.removeFromParent();
    a.played.look?.dispose?.();
  }

  /** Every move stops. The fight is over. */
  clear() {
    for (const a of this.active) this.forget(a);
    this.active = [];
    for (const p of this.pools) this.drain(p);
    this.pools = [];
  }

  dispose() {
    this.clear();
    this.show.dispose();
    this.group.removeFromParent();
    this.sparks.points.geometry.dispose();
    (this.sparks.points.material as THREE.Material).dispose();
  }
}
