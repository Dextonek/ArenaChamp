import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from '../../arenas/common';
import { MAX_UNITS } from '../../effects/summon';
import type { GameApi } from '../../runtime';
import type { FloorDef, PackDef, Spot } from './def';
import { Pack, type PackEnv } from './packs';
import { PLAINS, type PlainSpot } from './plains-table';
import { plainKinds } from './plainQuest';
import type { WorldRun } from './state';

/**
 * The Climb's hunting plains (2026-11-19, the user: "make some zone where to fight mobs like plains where mobs spawn", then "make the
 * hunting plains, hunt quest and 10 mobs"). Each floor has one (`plains-table.ts`, found by `pipeline/tools/plains.mts` in the floor's
 * widest open ground, clear of its roads, places, packs and spots), and on it:
 *
 * - **Ten wild ones** at a time, one a pack, of the floor's own plain kinds (the ones its packs are made of, no named or elite). Each
 *   walks a small loop of its own, slowly, and is a pack like any other (packs.ts): drawn when the hero is near, asleep until 9 m, then
 *   the whole fight, giving up past 20 m from its loop. But `wild`: this screen's alone (never shared with the shard), never kept as
 *   cleared, and it pays no shards.
 * - **They come back:** 20 to 30 s after one falls, a new one walks in on a loop at least 14 m from the hero (the far side).
 * - **The hunt quest** (`withPlain`): a giver of the floor asks for 12 of them; any wild one felled while the step is open counts.
 * - While the hero is near a plain the summon system holds 12 units a side (6 alone, else: packs.ts TOWER-HOOK cap), so all ten can be
 *   there; away from it the cap is what it was.
 */

export const PLAIN_MOBS = 10;
/** Units a side while the hero is near a plain (ten of its own and room for a wave or a pack walking in). */
export const PLAIN_CAP = 12;
const BACK = [20, 30] as const;

export class Plains {
  readonly spot: PlainSpot;
  private kinds: string[];
  private rnd: () => number;
  private slots: { pack: Pack | null; back: number; gen: number; kind: string }[] = [];
  private raised = false;
  private inside = false;

  constructor(
    private floor: FloorDef, private run: WorldRun, private api: GameApi, private env: PackEnv, private packs: Map<string, Pack>,
    private say: (text: string, color: string, at: Spot) => void, private banner: (title: string, sub: string) => void,
  ) {
    this.spot = PLAINS[floor.n];
    this.kinds = plainKinds(floor);
    this.rnd = seeded(5100 + floor.n * 37);
    if (!this.kinds.length) return;
    for (let i = 0; i < PLAIN_MOBS; i++) {
      const slot = { pack: null as Pack | null, back: 0, gen: 0, kind: this.kinds[i % Math.min(3, this.kinds.length)] };
      this.slots.push(slot);
      this.make(slot, i, null);
    }
  }

  /** A loop for one wild one: four points round a middle inside the plain (at least `away` m from the hero when it is given). */
  private loop(hero: THREE.Vector3 | null, away: number): Spot[] {
    const { x, z, r } = this.spot;
    let best: Spot | null = null, bestD = -1;
    for (let k = 0; k < 14; k++) {
      const a = this.rnd() * Math.PI * 2, d = Math.sqrt(this.rnd()) * r * 0.62, c = { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d };
      const hd = hero ? Math.hypot(hero.x - c.x, hero.z - c.z) : Infinity;
      if (hd >= away) { best = c; break; }
      if (hd > bestD) { bestD = hd; best = c; }
    }
    const c = best!, a0 = this.rnd() * Math.PI * 2, out: Spot[] = [];
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i / 4) * Math.PI * 2 + (this.rnd() - 0.5) * 0.6, d = 2 + this.rnd() * 2.2;
      let px = c.x + Math.cos(a) * d, pz = c.z + Math.sin(a) * d;
      const off = Math.hypot(px - x, pz - z);
      if (off > r * 0.85) { px = x + ((px - x) / off) * r * 0.85; pz = z + ((pz - z) / off) * r * 0.85; }
      out.push({ x: +px.toFixed(2), z: +pz.toFixed(2) });
    }
    return out;
  }

  private make(slot: Plains['slots'][number], i: number, hero: THREE.Vector3 | null) {
    const patrol = this.loop(hero, 14);
    const def: PackDef = { id: `wild-${i}-${slot.gen++}`, at: patrol[0], mix: [{ kind: slot.kind, n: 1 }], roam: { patrol, speed: 0.7 + this.rnd() * 0.4 }, leash: 20 };
    const pack = new Pack(def, this.env);
    pack.wild = true;
    this.packs.set(def.id, pack);
    slot.pack = pack;
  }

  /** A wild one fell (world.ts `fell`): it counts for every open hunt step. */
  fell(_pack: Pack, at: Spot) {
    for (const q of this.floor.quests) {
      const st = this.run.q(q.id), step = q.steps[st.step];
      if (!st.taken || st.done || step?.verb !== 'hunt') continue;
      st.progress = Math.min(step.n, Math.floor(st.progress) + 1);
      this.say(`${st.progress}/${step.n}`, '#ffd27a', at);
    }
  }

  /**
   * The plain's edge marked on the ground: hunters' stakes round it, each with a strip of red cloth tied at its top (10, merged: two
   * draws). Into the zone's fight group (world.ts `play`); gone with it.
   */
  private marks: THREE.Mesh[] = [];
  dress(group: THREE.Group) {
    if (!this.slots.length) return;
    const { x, z, r } = this.spot, posts: THREE.BufferGeometry[] = [], cloth: THREE.BufferGeometry[] = [], n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3, px = x + Math.cos(a) * (r - 0.6), pz = z + Math.sin(a) * (r - 0.6), lean = (i % 2 ? 1 : -1) * 0.06;
      posts.push(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 6).translate(0, 0.75, 0).rotateZ(lean).rotateY(-a).translate(px, 0, pz));
      cloth.push(new THREE.PlaneGeometry(0.16, 0.62).translate(0.08, -0.31, 0).rotateZ(0.25).rotateY(-a + Math.PI / 2).translate(px, 1.45, pz));
    }
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.85, flatShading: true });
    const red = new THREE.MeshStandardMaterial({ color: 0x9a3424, roughness: 0.9, side: THREE.DoubleSide });
    // a band of trodden earth round the edge, faint: where the hunters walk their bounds (one flat ring on the ground)
    const band = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.9, r + 0.5, 96, 1).rotateX(-Math.PI / 2).translate(x, 0.035, z),
      new THREE.MeshBasicMaterial({ color: 0x4a3020, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    band.renderOrder = 1;
    group.add(band);
    this.marks.push(band);
    for (const [geos, mat] of [[posts, wood], [cloth, red]] as const) {
      const merged = mergeGeometries(geos as THREE.BufferGeometry[], false)!;
      for (const gg of geos) gg.dispose();
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      group.add(m);
      this.marks.push(m);
    }
  }

  /** One frame, after the packs and the share (the share sets the cap each frame; this raises it near the plain). */
  update(dt: number, hero: THREE.Vector3) {
    if (!this.slots.length) return;
    const { x, z, r } = this.spot, d = Math.hypot(hero.x - x, hero.z - z);
    // the cap: ten of its own may be here at once
    const near = d < r + 22, summons = this.api.arena.summons;
    if (near) { if (summons.cap < PLAIN_CAP) { summons.cap = PLAIN_CAP; this.raised = true; } }
    else if (this.raised) { if (summons.cap === PLAIN_CAP) summons.cap = MAX_UNITS; this.raised = false; }
    // its name, as the hero walks in
    if (!this.inside && d < r) { this.inside = true; this.banner(this.spot.name, 'A hunting ground: the wild ones here come back'); }
    else if (this.inside && d > r + 10) this.inside = false;
    // the fallen come back, on the far side
    this.slots.forEach((slot, i) => {
      if (slot.pack && slot.pack.state === 'cleared') {
        slot.pack.dispose();
        this.packs.delete(slot.pack.id);
        slot.pack = null;
        slot.back = BACK[0] + this.rnd() * (BACK[1] - BACK[0]);
      }
      if (!slot.pack && (slot.back -= dt) <= 0) this.make(slot, i, hero);
    });
  }

  dispose() {
    for (const s of this.slots) if (s.pack) { s.pack.dispose(); this.packs.delete(s.pack.id); }
    this.slots.length = 0;
    for (const m of this.marks) { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.marks.length = 0;
    if (this.raised && this.api.arena.summons.cap === PLAIN_CAP) this.api.arena.summons.cap = MAX_UNITS;
  }
}
