import * as THREE from 'three';
import type { GroundMark, HeroRing, PipLook } from './types';

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
  // Vitriol's reagents.
  fire: { color: '#ff9a3a', shape: 'drop' },
  acid: { color: '#c28cff', shape: 'drop' },
  // Marks of the v5 kits.
  judged: { color: '#ffd24a', shape: 'mark' },
  heat: { color: '#ff7a2a', shape: 'drop' },
  needle: { color: '#ff3b4e', shape: 'drop' },
  curse: { color: '#c0203a', shape: 'mark' },
  stain: { color: '#20182c', shape: 'mark' },
  barb: { color: '#ffb347', shape: 'gem' },
  brand: { color: '#ffe9a0', shape: 'mark' },
  tag: { color: '#ffc36a', shape: 'gem' },
  magnet: { color: '#7fd4ff', shape: 'mark' },
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

/** A small heap of pale bones on the ground, big enough to read at gameplay distance (Mortis's piles). */
function bonePile(): THREE.Group {
  const g = new THREE.Group();
  const bone = new THREE.MeshBasicMaterial({ color: '#e8dfc4' });
  const shade = new THREE.MeshBasicMaterial({ color: '#6f6450' });
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.62, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2418', transparent: true, opacity: 0.55, depthWrite: false }));
  under.position.y = 0.01;
  g.add(under);
  const shape = new THREE.CapsuleGeometry(0.055, 0.42, 3, 6);
  for (const [x, z, yaw, tilt] of [[-0.2, 0.08, 0.5, 1.45], [0.16, -0.12, -0.7, 1.5], [0.02, 0.22, 1.5, 1.35], [-0.04, -0.2, 2.4, 1.6], [0.24, 0.16, 0.2, 1.4]]) {
    const b = new THREE.Mesh(shape, bone);
    b.position.set(x, 0.08, z);
    b.rotation.set(tilt, yaw, 0);
    g.add(b);
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bone);
  skull.position.set(0.02, 0.17, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), shade);
  eye.position.set(-0.05, 0.19, 0.11);
  const eye2 = eye.clone();
  eye2.position.x = 0.09;
  g.add(skull, eye, eye2);
  g.visible = false;
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
  /** A ring at each hero's feet, by slot. */
  private rings = new Map<string, { outer: THREE.Mesh; arc: THREE.Mesh }>();
  /** Ground marks of each hero, by slot and kind. */
  private markPools = new Map<string, THREE.Object3D[]>();
  /** A word or number over each hero's head, by slot. */
  private labels = new Map<string, { sprite: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string }>();
  private bursts: Burst[] = [];
  private clock = 0;
  private ringGeo = new THREE.RingGeometry(0.2, 0.32, 40).rotateX(-Math.PI / 2);
  private pillarGeo = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 16, 1, true).translate(0, 1.3, 0);
  private shardGeo = new THREE.TetrahedronGeometry(0.07, 0);

  /** A word or number over a hero's head (`Trait.enemyLabel`), the slot named `who`, at `height` m. Null hides it. */
  label(who: string, pos: THREE.Vector3 | null, height: number, label: { text: string; color?: string } | null) {
    let l = this.labels.get(who);
    if (!pos || !label) {
      if (l) l.sprite.visible = false;
      return;
    }
    if (!l) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 96;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sprite.scale.set(2.4, 0.6, 1);
      sprite.renderOrder = 6;
      l = { sprite, canvas, tex, key: '' };
      this.labels.set(who, l);
      this.group.add(sprite);
    }
    const key = `${label.text}|${label.color ?? ''}`;
    if (l.key !== key) {
      l.key = key;
      const g = l.canvas.getContext('2d')!;
      g.clearRect(0, 0, 384, 96);
      g.font = '800 62px ui-sans-serif, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(10, 10, 16, 0.9)';
      g.strokeText(label.text, 192, 50, 372);
      g.fillStyle = label.color ?? '#ffffff';
      g.fillText(label.text, 192, 50, 372);
      l.tex.needsUpdate = true;
    }
    l.sprite.visible = true;
    l.sprite.position.set(pos.x, height, pos.z);
  }

  /**
   * A ring at a hero's feet (`Trait.ring`), the slot named `who`: an outer circle and, with `fill`, an inner arc that
   * empties. Null hides it.
   */
  ring(who: string, pos: THREE.Vector3 | null, ring: HeroRing | null) {
    let r = this.rings.get(who);
    if (!r) {
      const mat = (o: number) => new THREE.MeshBasicMaterial({ transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
      r = {
        outer: new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2), mat(0.7)),
        arc: new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 72, 1, 0, Math.PI * 2).rotateX(-Math.PI / 2), mat(0.85)),
      };
      r.outer.renderOrder = r.arc.renderOrder = 3;
      this.rings.set(who, r);
      this.group.add(r.outer, r.arc);
    }
    const on = !!pos && !!ring;
    r.outer.visible = on;
    r.arc.visible = on && ring!.fill !== undefined;
    if (!on) return;
    const o = ring!.opacity ?? 1;
    for (const [m, base] of [[r.outer, 0.7], [r.arc, 0.85]] as const) {
      m.position.set(pos!.x, 0.07, pos!.z);
      m.scale.setScalar(ring!.radius);
      const mm = m.material as THREE.MeshBasicMaterial;
      mm.color.set(ring!.color);
      mm.opacity = base * o;
    }
    if (ring!.fill !== undefined) r.arc.geometry.setDrawRange(0, 6 * Math.max(1, Math.round(72 * Math.min(1, ring!.fill))));
  }

  /**
   * What a passive keeps on the ground (`Trait.marks`), the slot named `who`: drawn from a pool per kind, popping in and
   * shrinking away in the last second of its life. `looks` builds a kind's object; 'bones' is built in.
   */
  marks(who: string, list: GroundMark[], looks?: Record<string, () => THREE.Object3D>) {
    const used = new Map<string, number>();
    for (const m of list) {
      const key = `${who}:${m.kind}`;
      let pool = this.markPools.get(key);
      if (!pool) {
        pool = [];
        this.markPools.set(key, pool);
      }
      const i = used.get(key) ?? 0;
      used.set(key, i + 1);
      if (i >= pool.length) {
        const o = looks?.[m.kind]?.() ?? bonePile();
        pool.push(o);
        this.group.add(o);
      }
      const g = pool[i];
      g.visible = true;
      g.position.set(m.x, 0.02, m.z);
      g.rotation.y = m.yaw ?? 0;
      const left = m.life - m.age;
      const k = left < 1 ? Math.max(0.05, left) : Math.min(1, 0.4 + m.age * 3);
      g.scale.set(k, k, (m.length ?? 1) * (m.length ? 1 : k));
    }
    // Whatever this slot did not use this frame is hidden.
    for (const [key, pool] of this.markPools) {
      if (!key.startsWith(`${who}:`)) continue;
      const n = used.get(key) ?? 0;
      for (let i = n; i < pool.length; i++) pool[i].visible = false;
    }
  }

  /**
   * Shows `stacks` over the figure at `pos` (the row named `who`), facing the camera. `fallback` colours unknown kinds; a
   * stack's own `look` (a hero's own state) wins over the shared table. `height`: metres above the figure's feet.
   */
  pips(who: string, pos: THREE.Vector3 | null, stacks: { name: string; n: number; look?: PipLook }[], camera: THREE.Camera, fallback: string, height = 2.6) {
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
      const all: { look: { color: string; shape?: string } }[] = [];
      for (const s of stacks) for (let i = 0; i < s.n; i++) all.push({ look: s.look ?? STACK_LOOK[s.name] ?? { color: fallback, shape: 'gem' } });
      all.forEach((a, i) => {
        const tk = token(a.look.shape ?? 'gem', a.look.color);
        const x = (i - (all.length - 1) / 2) * 0.26;
        tk.position.set(x, -Math.abs(x) * 0.25, 0);
        row!.holder.add(tk);
      });
    }
    row.holder.visible = !!pos && stacks.length > 0;
    if (pos) {
      row.holder.position.set(pos.x, Math.max(0, pos.y) + height, pos.z);
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
    for (const r of this.rings.values()) r.outer.visible = r.arc.visible = false;
    for (const pool of this.markPools.values()) for (const g of pool) g.visible = false;
    for (const b of this.bursts) {
      this.group.remove(b.group);
      b.group.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
    }
    this.bursts = [];
  }
}
