import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import { OMENS, omensFor, type Omen, type OmenId } from './omens';
import type { Upgrade } from './upgrades';

/**
 * Paths between bosses (user, 2026-11-11: "evolve the raid", option D). From the second hall of a run on, once the pick is in, two
 * side doors open beside the gate: the Vault (one more upgrade, a rare or a gold one, and one more omen for the rest of the tier) and
 * the Shrine (an omen of this tier lifted, for 15 s on the run's time). Or straight through the gate. A side room is the hall again,
 * with its own altars, and then the gate as always. For two, a door opens only when both walk into the same one (the hub decides).
 */
export type PathId = 'vault' | 'shrine';

export interface PathDoor {
  id: PathId;
  name: string;
  blurb: string;
}

/** What the Shrine costs, on the run's time (s). The hub keeps the same number (`RAID_SHRINE_S`). */
export const SHRINE_SECONDS = 15;

/** The Shrine's one altar: taking it is only a blessing, the omen went as the hero walked in. */
export const shrineCard = (lifted: Omen | null): Upgrade => ({
  id: 'shrine', name: 'The Shrine’s blessing', blurb: lifted ? `${lifted.name} is lifted for the rest of the tier.` : 'The omens are quiet.',
});

/**
 * The omens of a tier and what the paths have done to them so far. Both screens of a raid for two keep one, and change it only on
 * what the hub says, so they agree.
 */
export class TierOmens {
  private added: OmenId[] = [];
  private lifted: OmenId[] = [];

  constructor(private seed: string, private tier: number) {}

  /** The omens on now. */
  get list(): Omen[] {
    const base = omensFor(this.seed, this.tier).filter((o) => !this.lifted.includes(o.id));
    const more = OMENS.filter((o) => this.added.includes(o.id) && !this.lifted.includes(o.id) && !base.includes(o));
    return [...base, ...more];
  }

  /** The omen the Vault would add: one not on yet, from the seed. */
  next(): Omen | null {
    const on = this.list.map((o) => o.id);
    const left = OMENS.filter((o) => !on.includes(o.id) && !this.lifted.includes(o.id));
    if (!left.length) return null;
    const rng = seeded(seedNumber(`${this.seed}-vault-${this.tier}-${this.added.length}`));
    return left[Math.floor(rng() * left.length)];
  }

  /** The omen the Shrine would lift: the first one on. */
  first(): Omen | null {
    return this.list[0] ?? null;
  }

  add(id: OmenId) {
    if (!this.added.includes(id)) this.added.push(id);
  }

  lift(id: OmenId) {
    if (!this.lifted.includes(id)) this.lifted.push(id);
  }
}

/** The side doors of a hall: none in the first hall of a run or after a side room; the Shrine only while an omen is on. */
export function doorsFor(depth: number, omens: TierOmens, sideDone: boolean): PathDoor[] {
  if (depth <= 0 || sideDone) return [];
  const doors: PathDoor[] = [];
  const more = omens.next();
  doors.push({ id: 'vault', name: 'The Vault', blurb: `One more upgrade, rare or better. Then the omen ${more ? more.name : 'of the deep'} follows you to the end of the tier.` });
  const first = omens.first();
  if (first) doors.push({ id: 'shrine', name: 'The Shrine', blurb: `Lifts ${first.name} for the rest of the tier. Costs ${SHRINE_SECONDS} s on the run’s time.` });
  return doors;
}
