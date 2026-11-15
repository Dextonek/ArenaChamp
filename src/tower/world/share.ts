import * as THREE from 'three';
import { CLIMB_PACKS } from '../../../server/climb-packs.mjs';
import { WORLD_PACKS } from '../../../server/protocol.mjs';
import type { Enemy } from '../../effects/common';
import { MAX_UNITS } from '../../effects/summon';
import type { PackBlow, PackReport, PackSink, SharedPackRec, WorldPresence } from '../../net/world';
import type { GameApi } from '../../runtime';
import type { EnemySpec, FloorDef, PackDef, Spot } from './def';
import type { WorldOthers } from './others';
import type { Pack, PackLink } from './packs';

/**
 * The floor's packs shared with the other players in its shard (the open world, stage 2: pipeline/designs/climb-open-world.md;
 * docs/architecture/multiplayer.md, "The Climb's open world, stage 2"). One for each zone that is built with a link to the hub (the
 * game page's, signed in or not), none in the tools: there the packs are as they always were.
 *
 * It is the packs' way to the hub (`PackLink`: claims, reports, hits, blows) and the hub's way to the packs (`PackSink`): whose screen
 * runs each, how many players it is set for, the owner's reports for the copies, the others' hits for the owner, a blow for this hero,
 * cleared, back. Ten times a second it sends what this screen runs (`report`), at once when a red zone begins. Alone in the shard it
 * runs its packs as before: claimed and answered, set for one, reported to nobody.
 *
 * While other players are on the floor, the summon cap is raised (`CROWD_CAP`) so their packs can be drawn beside this screen's own.
 *
 * `fake(k)`: `k` made-up packs for each made-up other (others.ts `fake`), copies run by a made-up owner that walks them round the hero,
 * swinging, shooting and laying red zones, through the same `state` path a real owner's reports take (the speed test's switch:
 * `game.html?others=7&packs=3`, or a perf scene with `others` and `packs`). With it this screen's own packs fight the made-up others too.
 */

/** Most units drawn a side while other players are on the floor (their packs' copies with this screen's own). */
export const CROWD_CAP = 24;
/**
 * Most copies drawn at once (units of packs other screens run), the nearest packs first: a copy is a whole figure of about twenty draw
 * calls, and a slowed phone paid about 1.2 ms a frame for each (perf.py `gen-2-fight-7`). Past it, a pack's copies wait until it is
 * among the nearest. A pack being drawn is not dropped for a nearer one until the budget is looked at again (twice a second).
 */
export const COPY_MAX = 6;
const SEND_S = 1 / WORLD_PACKS.stateHz;

interface FakeOwner { pack: Pack; a: number; r: number; w: number; sendIn: number; t: number; shots: number[]; max: number }

export class PackShare implements PackSink, PackLink {
  private packs = new Map<string, Pack>();
  private ids: Set<string>;
  private sendIn = 0;
  private hurry = false;
  private fakes: FakeOwner[] = [];
  fakeOwned = false;
  /** What went over the wire (for the two-tab test and the tools). */
  readonly stats = { reports: 0, heard: 0, hitsSent: 0, hitsHeard: 0, hurtsSent: 0, hurtsTaken: 0, shareTaken: 0 };

  constructor(
    private api: GameApi,
    private link: WorldPresence | null,
    private others: WorldOthers,
    private floor: FloorDef,
    /** Makes a pack of this zone (the made-up ones). */
    private make: (def: PackDef) => Pack,
  ) {
    this.ids = new Set((CLIMB_PACKS[floor.n] ?? []).map((r) => r[0]));
    // The hub's table is made from the floors (pipeline/tools/climb-packs.mjs): a floor changed since is said here, on the dev server.
    if (import.meta.env?.DEV) {
      const mine = floor.packs.map((p) => p.id), table = [...this.ids];
      if (mine.length !== table.length || mine.some((id) => !this.ids.has(id))) {
        console.warn(`[climb] floor ${floor.n}'s packs differ from server/climb-packs.mjs: run node pipeline/tools/climb-packs.mjs`);
      }
    }
    if (link) link.packs = this;
  }

  /** One of the floor's packs (the hub's table has it; a wave is never shared). */
  add(p: Pack) {
    if (this.ids.has(p.id)) this.packs.set(p.id, p);
  }

  get(id: string) {
    return this.packs.get(id) ?? this.fakes.find((f) => f.pack.id === id)?.pack;
  }

  // --- the packs' way to the hub (PackLink) ------------------------------------------------------------------------------

  get on() {
    const l = this.link;
    return !!l && l.online && l.you > 0;
  }
  knows(id: string) {
    return this.ids.has(id);
  }
  claim(p: Pack) {
    this.link?.claimPack(p.id, p.home.x, p.home.z);
  }
  heroes() {
    return this.others.heroes;
  }
  isHero(f: Enemy) {
    return this.others.idOf(f) !== 0;
  }
  sendHurt(p: Pack, figure: Enemy, share: number, from: Spot, kind: string, net?: EnemySpec['net']) {
    const id = this.others.idOf(figure);
    if (id <= 0) return;
    this.stats.hurtsSent++;
    this.link?.packHurt(p.id, id, share, from.x, from.z, kind, net ? { kind: net.kind, s: net.seconds } : undefined);
  }
  sendHit(p: Pack, slot: number, dmg: number) {
    this.stats.hitsSent++;
    this.link?.packHit(p.id, slot, dmg);
  }
  sendClear(p: Pack) {
    this.link?.packClear(p.id);
  }
  sendRelease(p: Pack) {
    this.link?.packRelease(p.id);
  }
  urgent() {
    this.hurry = true;
  }

  // --- the hub's word (PackSink) -----------------------------------------------------------------------------------------

  roster(you: number, recs: SharedPackRec[]) {
    const by = new Map(recs.map((r) => [r.id, r]));
    for (const p of this.packs.values()) {
      const r = by.get(p.id);
      if (!r) { if (p.mode !== 'local') p.setOwner(0, p.n); continue; }
      if (r.cleared) p.shardCleared();
      else p.setOwner(r.owner === you ? 'me' : r.owner, r.n);
    }
  }
  owner(pack: string, owner: number, n: number) {
    this.packs.get(pack)?.setOwner(owner > 0 && owner === this.link?.you ? 'me' : owner, n);
  }
  scale(pack: string, n: number) {
    this.packs.get(pack)?.scale(n);
  }
  state(list: PackReport[]) {
    this.stats.heard++;
    for (const r of list) this.get(r.id)?.apply(r);
  }
  hit(pack: string, u: number, dmg: number) {
    this.stats.hitsHeard++;
    this.packs.get(pack)?.remoteHit(u, dmg);
  }
  /** Another screen's pack struck this hero: taken as this screen's own pack's blow is (its shields, boons and the floor's law). */
  hurt(b: PackBlow) {
    const d = this.api.duel;
    if (d.heroHp <= 0) return;
    const script = d.boss?.script;
    this.stats.hurtsTaken++;
    this.stats.shareTaken += b.share;
    d.hurtHero({ share: b.share * (script?.rage ?? 1) * (script?.harm ?? 1), from: { x: b.x, z: b.z }, move: (b.kind ?? 'pack') as never });
    if (b.net && d.heroHp > 0) this.api.arena.applyStatus(this.api.arena.caster, b.net.kind, b.net.s);
  }
  cleared(pack: string) {
    this.packs.get(pack)?.shardCleared();
  }
  respawn(pack: string) {
    this.packs.get(pack)?.respawn();
  }
  clear() {
    for (const p of this.packs.values()) if (p.mode !== 'local') p.setOwner(0, p.n);
  }

  // --- each frame ---------------------------------------------------------------------------------------------------------

  private budgetIn = 0;
  /** The nearest copies within `COPY_MAX` may be drawn. */
  private budget() {
    const copies: Pack[] = [];
    for (const p of this.packs.values()) if (p.mode === 'mirror') copies.push(p);
    for (const f of this.fakes) copies.push(f.pack);
    copies.sort((a, b) => a.copyDist - b.copyDist);
    let n = 0;
    for (const p of copies) {
      n += p.left;
      p.drawOk = n <= COPY_MAX || n === p.left;
    }
  }

  update(dt: number, hero: THREE.Vector3) {
    this.api.arena.summons.cap = this.others.count > 0 || this.fakes.length > 0 ? CROWD_CAP : MAX_UNITS;
    if ((this.budgetIn -= dt) <= 0) { this.budgetIn = 0.5; this.budget(); }
    if (this.fakes.length) this.stepFakes(dt, hero);
    const live = this.on;
    if (!live && !this.fakeOwned) return;
    for (const p of this.packs.values()) if (p.zoneBegan()) this.hurry = true;
    this.sendIn -= dt;
    if (this.sendIn > 0 && !this.hurry) return;
    this.sendIn = SEND_S;
    this.hurry = false;
    const out: PackReport[] = [], ts = performance.now();
    for (const p of this.packs.values()) {
      const r = p.report(ts);
      if (r) out.push(r);
    }
    if (!out.length || !live) return;
    this.stats.reports++;
    this.link!.packStates(out);
  }

  dispose() {
    this.api.arena.summons.cap = MAX_UNITS;
    for (const f of this.fakes) f.pack.dispose();
    this.fakes.length = 0;
    if (this.link?.packs === this) this.link.packs = null;
  }

  // --- made-up packs, for the speed test ------------------------------------------------------------------------------------

  /** `k` made-up packs of three for each made-up other (`fake(0)` takes them away), and this screen's packs fight the made-up others. */
  fake(k: number) {
    for (const f of this.fakes.splice(0)) f.pack.dispose();
    const n = Math.max(0, Math.min(8, Math.floor(k))) * this.others.fakeCount;
    this.fakeOwned = n > 0 || this.others.fakeCount > 0;
    const kinds = Object.keys(this.floor.enemies);
    for (let i = 0; i < n; i++) {
      const kind = kinds[(i * 5 + 1) % kinds.length], r = 6 + (i % 4) * 2.5;
      const pack = this.make({ id: `fake-${i}`, at: { x: 0, z: 0 }, mix: [{ kind, n: 3 }] });
      pack.setOwner(-1 - (i % Math.max(1, this.others.fakeCount)), 1);
      this.fakes.push({ pack, a: (i / n) * Math.PI * 2, r, w: (i % 2 ? 1 : -1) * (1.8 / r), sendIn: (i % 10) / 100, t: 0, shots: [0, 0, 0], max: 100 });
    }
  }

  /** The made-up owners: ten reports a second, through `state` as a real owner's come. */
  private stepFakes(dt: number, hero: THREE.Vector3) {
    for (const [i, f] of this.fakes.entries()) {
      f.a += f.w * dt;
      f.t += dt;
      f.pack.update(dt, hero);
      if ((f.sendIn -= dt) > 0) continue;
      f.sendIn += SEND_S;
      const cx = hero.x + Math.cos(f.a) * f.r, cz = hero.z + Math.sin(f.a) * f.r;
      const u = [0, 1, 2].map((j) => {
        const b = f.t * 1.3 + (j / 3) * Math.PI * 2, x = cx + Math.cos(b) * 1.6, z = cz + Math.sin(b) * 1.6;
        const swing = (f.t + j * 0.6 + i * 0.37) % 1.8;
        if ((f.t + j) % 2.2 < SEND_S) f.shots[j]++;
        return [x, z, Math.atan2(cx - x, cz - z), 70, f.max, 1, swing < 0.3 ? swing / 0.3 : -1, -1, f.shots[j]];
      });
      const slam = (f.t + i * 0.9) % 6;
      const zn = slam < 1 ? [[0, 0, cx, cz, 2.3, 0, 0, slam, 1]] : [];
      this.state([{ id: f.pack.id, x: cx, z: cz, ts: f.t * 1000, u, zn }]);
    }
  }
}
