import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import type { BossDef, BossMove, BossWorld, RaidLink, RaidSide } from './types';

/**
 * The boss's mind: who it aims at, which move comes next, where it walks. It runs on one screen and sends its choices
 * as casts, so it is the only part of a fight that reads the heroes. Its rolls come from the seed, so a run can be replayed.
 */
export class BossBrain {
  private rng: () => number;
  private time = 0;
  private wait = 1.2;
  private locked = 0;
  private pause = 0;
  private seq = 0;
  private pending: { at: number; move: BossMove; step: number; seed: number; target: RaidSide }[] = [];
  private ready = new Map<string, number>();
  private phase = 0;
  private opener: string | null = null;
  private last = '';
  private aimedAt = [-Infinity, -Infinity];
  private next: RaidSide = 0;

  constructor(private def: BossDef, private world: BossWorld, private link: RaidLink, seed: string) {
    this.rng = seeded(seedNumber(`${seed}-brain`));
    this.opener = def.phases[0].opener ?? null;
    this.next = link.side;
  }

  /** A new phase: a pause, and what comes next starts over. The moves in the air go on. */
  setPhase(i: number) {
    this.phase = i;
    this.pause = this.def.phasePause;
    this.pending = [];
    this.locked = 0;
    this.wait = 0;
    this.opener = this.def.phases[i].opener ?? null;
  }

  /** Kneeling: steps not yet sent are dropped. What already shows still lands. */
  kneel(seconds: number) {
    this.pause = Math.max(this.pause, seconds);
    this.pending = [];
    this.locked = 0;
  }

  update(dt: number) {
    this.time += dt;
    for (const p of this.pending.filter((x) => x.at <= this.time)) this.send(p.move, p.step, p.seed, p.target);
    this.pending = this.pending.filter((x) => x.at > this.time);
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.locked = Math.max(0, this.locked - dt);
    this.wait = Math.max(0, this.wait - dt);
    if (this.locked > 0) return;
    const heroes = this.world.heroes();
    const up = heroes.filter((h) => !h.down);
    if (!up.length) return;
    const target = up.find((h) => h.side === this.next) ?? up[0];
    const boss = this.world.boss();
    const dist = Math.hypot(target.x - boss.x, target.z - boss.z);
    if (this.wait <= 0) {
      const move = this.pick(dist);
      if (move) {
        this.begin(move, target.side);
        return;
      }
    }
    if (dist > this.def.keepAt) this.world.walk(dt, target.x, target.z, this.def.speed);
    else this.world.face(Math.atan2(target.x - boss.x, target.z - boss.z));
  }

  private pick(dist: number) {
    const { moves } = this.def;
    if (this.opener) {
      const m = moves[this.opener];
      this.opener = null;
      if (m && (!m.coop || !this.link.solo)) return m;
    }
    const open = this.def.phases[this.phase].moves
      .map((id) => moves[id])
      .filter((m) => m && (!m.coop || !this.link.solo) && (this.ready.get(m.id) ?? 0) <= this.time && (m.range === undefined || dist <= m.range));
    const fresh = open.filter((m) => m.id !== this.last);
    const list = fresh.length ? fresh : open;
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  private begin(m: BossMove, side: RaidSide) {
    const gap = this.def.phases[this.phase].gap;
    this.ready.set(m.id, this.time + m.cooldown);
    this.aimedAt[side] = this.time;
    if (!m.alongside) {
      this.last = m.id;
      this.locked = m.lock;
      this.wait = m.lock + gap[0] + this.rng() * (gap[1] - gap[0]);
    }
    const seed = Math.floor(this.rng() * 2147483647);
    for (const [i, at] of (m.steps ?? [0]).entries()) {
      if (at <= 0) this.send(m, i, seed, side);
      else this.pending.push({ at: this.time + at, move: m, step: i, seed, target: side });
    }
    this.next = this.chooseNext();
  }

  /** A move aimed at "you" takes the hero it aimed at less recently, and a seeded coin when level. */
  private chooseNext(): RaidSide {
    if (this.link.solo) return this.link.side;
    const [a, b] = this.aimedAt;
    if (a === b) return this.rng() < 0.5 ? 0 : 1;
    return a < b ? 0 : 1;
  }

  private send(m: BossMove, step: number, seed: number, side: RaidSide) {
    const boss = this.world.boss();
    const hero = this.world.heroes().find((h) => h.side === side) ?? { x: boss.x, z: boss.z };
    const aim = m.aim({ boss: { x: boss.x, z: boss.z }, target: { x: hero.x, z: hero.z }, step, seed });
    if (!m.alongside) this.world.face(aim.dir);
    this.link.cast({
      id: ++this.seq, move: m.id, step, x: +aim.x.toFixed(3), z: +aim.z.toFixed(3), fx: +boss.x.toFixed(3), fz: +boss.z.toFixed(3),
      dir: +aim.dir.toFixed(4), seed, target: side,
    });
  }
}
