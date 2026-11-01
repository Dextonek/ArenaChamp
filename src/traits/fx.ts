import * as THREE from 'three';

/**
 * Visuals of the hero identity layer in a duel:
 *
 * - **Stack pips** over a hero's head: one small token per stack another hero keeps on it, in a slow arc, each mechanic
 *   with its own token (toxin drops, chill snowflakes, seed sprouts, void marks; a gem for any other).
 * - **Proc bursts**: a ground ring, a short pillar of light and flying shards where a passive fires (a trait's
 *   floating word, small) or where stacks pop (big: toxin burst, freeze, bloom, silence mark).
 *
 * Owned by the duel; add `group` to the scene, call `pips` and `update` every frame.
 */

const STACK_LOOK: Record<string, { color: string; shape: 'drop' | 'flake' | 'sprout' | 'mark' | 'gem' }> = {
  toxin: { color: '#9cff4a', shape: 'drop' },
  chill: { color: '#c8ecff', shape: 'flake' },
  seed: { color: '#c8e86a', shape: 'sprout' },
  mark: { color: '#b58cff', shape: 'mark' },
};

const glow = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color });

function token(shape: string, color: string): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.Color(color).multiplyScalar(0.35);
  switch (shape) {
    case 'drop': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1.5, 1), flat(color)));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 8), flat(color));
      tip.position.y = 0.11;
      g.add(tip);
      break;
    }
    case 'flake': {
      for (let i = 0; i < 3; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), flat(color));
        bar.rotation.z = (i * Math.PI) / 3;
        g.add(bar);
      }
      break;
    }
    case 'sprout': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 5), flat(dark));
      g.add(stem);
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8).scale(0.5, 1, 1), flat(color));
        leaf.position.set(s * 0.04, 0.07, 0);
        leaf.rotation.z = s * -0.8;
        g.add(leaf);
      }
      break;
    }
    case 'mark': {
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.05, 0.085, 16), flat(color)));
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), flat('#120a1c')));
      break;
    }
    default:
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), flat(color)));
  }
  // A soft halo behind every token so it reads against the sky and the floor.
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), glow(color, 0.22));
  halo.position.z = -0.02;
  g.add(halo);
  return g;
}

interface Burst {
  group: THREE.Group;
  t: number;
  life: number;
  ring: THREE.Mesh;
  pillar: THREE.Mesh;
  shards: { mesh: THREE.Mesh; v: THREE.Vector3 }[];
}

/** The colour of a kind of stacks (toxin, chill, ...), or undefined for an unknown kind. */
export function stackColor(name: string): string | undefined {
  return STACK_LOOK[name]?.color;
}

export class TraitFx {
  readonly group = new THREE.Group();
  /** Pips over each hero (by key), rebuilt when the stacks change. */
  private rows = new Map<string, { holder: THREE.Group; key: string }>();
  private bursts: Burst[] = [];
  private clock = 0;
  private ringGeo = new THREE.RingGeometry(0.2, 0.32, 40).rotateX(-Math.PI / 2);
  private pillarGeo = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 16, 1, true).translate(0, 1.3, 0);
  private shardGeo = new THREE.TetrahedronGeometry(0.07, 0);

  /** Shows `stacks` over the figure at `pos` (the row named `who`), facing the camera. `fallback` colours unknown kinds. */
  pips(who: string, pos: THREE.Vector3 | null, stacks: { name: string; n: number }[], camera: THREE.Camera, fallback: string) {
    let row = this.rows.get(who);
    if (!row) {
      row = { holder: new THREE.Group(), key: '' };
      this.rows.set(who, row);
      this.group.add(row.holder);
    }
    const key = stacks.map((s) => `${s.name}${s.n}`).join();
    if (key !== row.key) {
      row.key = key;
      for (const c of [...row.holder.children]) {
        row.holder.remove(c);
        c.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
      }
      const all: { look: { color: string; shape: string } }[] = [];
      for (const s of stacks) for (let i = 0; i < s.n; i++) all.push({ look: STACK_LOOK[s.name] ?? { color: fallback, shape: 'gem' } });
      all.forEach((a, i) => {
        const tk = token(a.look.shape, a.look.color);
        const x = (i - (all.length - 1) / 2) * 0.26;
        tk.position.set(x, -Math.abs(x) * 0.25, 0);
        row!.holder.add(tk);
      });
    }
    row.holder.visible = !!pos && stacks.length > 0;
    if (pos) {
      row.holder.position.set(pos.x, Math.max(0, pos.y) + 2.6, pos.z);
      row.holder.quaternion.copy(camera.quaternion);
      row.holder.children.forEach((c, i) => { c.position.y = -Math.abs(c.position.x) * 0.25 + 0.04 * Math.sin(this.clock * 4 + i); });
    }
  }

  /** A proc burst at `at` in `color`; `big` for stacks popping. */
  burst(at: THREE.Vector3, color: string, big = false) {
    const group = new THREE.Group();
    group.position.set(at.x, 0.05, at.z);
    const ring = new THREE.Mesh(this.ringGeo, glow(color, 0.85));
    const pillar = new THREE.Mesh(this.pillarGeo, glow(color, big ? 0.35 : 0.2));
    group.add(ring, pillar);
    const shards: Burst['shards'] = [];
    const n = big ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.shardGeo, glow(i % 2 ? '#ffffff' : color, 0.9));
      const a = (i / n) * Math.PI * 2;
      mesh.position.set(0, 1.0, 0);
      shards.push({ mesh, v: new THREE.Vector3(Math.cos(a) * (big ? 4 : 2.5), 2 + Math.random() * 2, Math.sin(a) * (big ? 4 : 2.5)) });
      group.add(mesh);
    }
    group.scale.setScalar(big ? 1.3 : 0.8);
    this.group.add(group);
    this.bursts.push({ group, t: 0, life: big ? 0.55 : 0.4, ring, pillar, shards });
  }

  update(dt: number) {
    this.clock += dt;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.life);
      b.ring.scale.setScalar(1 + 7 * k);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      b.pillar.scale.set(1 - 0.6 * k, 1 + 0.3 * k, 1 - 0.6 * k);
      (b.pillar.material as THREE.MeshBasicMaterial).opacity = (b.shards.length > 5 ? 0.35 : 0.2) * (1 - k);
      for (const s of b.shards) {
        s.v.y -= 9 * dt;
        s.mesh.position.addScaledVector(s.v, dt);
        s.mesh.rotation.x += dt * 9;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      }
      if (k >= 1) {
        this.group.remove(b.group);
        b.group.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
        this.bursts.splice(i, 1);
      }
    }
  }

  /** Drops every pip row and burst (the duel stopped). */
  clear() {
    for (const r of this.rows.values()) r.holder.visible = false;
    for (const b of this.bursts) {
      this.group.remove(b.group);
      b.group.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
    }
    this.bursts = [];
  }
}
