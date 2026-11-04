/**
 * What heroes keep on the ground that another hero can wipe away (Gus's mop): Kaia's rods, Fenna's flowers, Shiori's ink. Each of
 * those traits registers how to remove its own things near a spot. A spell effect calls `wipeGround` with the enemy's figure at
 * the moment it lands; effects play on both screens, so both lists stay equal.
 */
type Wiper = (owner: object, x: number, z: number, r: number) => void;

const wipers: Wiper[] = [];

export function addGroundWiper(w: Wiper) {
  wipers.push(w);
}

/** Removes what `owner` keeps on the ground within `r` m of (x, z). */
export function wipeGround(owner: object, x: number, z: number, r: number) {
  for (const w of wipers) w(owner, x, z, r);
}
