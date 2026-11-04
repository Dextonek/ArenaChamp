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

const STACK_LOOK: Record<string, { color: string; shape: NonNullable<PipLook['shape']> }> = {
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
  air: { color: '#ff8fb8', shape: 'balloon' },
  wool: { color: '#c9c0a8', shape: 'balloon' },
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
    case 'balloon': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10).scale(1, 1.2, 1), flat(color)));
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 6), flat(dark));
      knot.position.y = -0.115;
      g.add(knot);
      const shine = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), flat('#fff1a8'));
      shine.position.set(-0.03, 0.045, 0.082);
      g.add(shine);
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

/** Height of the bars over a hero's head, as a share of the camera's distance: about 3.6% of the screen's height. */
const PLATE_SCALE = 0.034;

/** What the bars over a hero's head show (`TraitFx.plate`). */
export interface PlateData {
  hp: number;
  max: number;
  shield: number;
  /** Cuts in the HP bar (`HeroKit.hpChunks`); 0: none. */
  chunks: number;
  /** The viewer's own hero: green; the enemy: red. */
  mine: boolean;
  meter: { name: string; value: number; max: number; color: string } | null;
}

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function outlinedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, fill = '#ffffff') {
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(6, 6, 10, 0.95)';
  g.strokeText(text, x, y, maxW);
  g.fillStyle = fill;
  g.fillText(text, x, y, maxW);
}

function drawPlate(c: HTMLCanvasElement, d: PlateData) {
  const g = c.getContext('2d')!;
  const W = c.width, x = 6, w = W - 12;
  g.clearRect(0, 0, W, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // HP: a dark case, the fill, the shield after it (pushed back inside the bar when it would run out), cuts, the number.
  const hpY = 6, hpH = 46;
  roundedRect(g, x - 3, hpY - 3, w + 6, hpH + 6, 9);
  g.fillStyle = 'rgba(8, 8, 12, 0.92)';
  g.fill();
  g.save();
  roundedRect(g, x, hpY, w, hpH, 6);
  g.clip();
  g.fillStyle = '#2a1a1e';
  g.fillRect(x, hpY, w, hpH);
  const hpK = Math.max(0, Math.min(1, d.hp / d.max));
  const fill = g.createLinearGradient(0, hpY, 0, hpY + hpH);
  if (d.mine) { fill.addColorStop(0, '#62e07c'); fill.addColorStop(1, '#2c9a4a'); }
  else { fill.addColorStop(0, '#f2585c'); fill.addColorStop(1, '#a8262c'); }
  g.fillStyle = fill;
  g.fillRect(x, hpY, w * hpK, hpH);
  if (d.shield > 0) {
    const sh = Math.min(1, d.shield / d.max);
    g.fillStyle = 'rgba(232, 240, 250, 0.9)';
    g.fillRect(x + w * Math.min(hpK, 1 - sh), hpY, w * sh, hpH);
  }
  if (d.chunks > 1) {
    g.fillStyle = 'rgba(0, 0, 0, 0.8)';
    for (let i = 1; i < d.chunks; i++) g.fillRect(x + (w * i) / d.chunks - 1.5, hpY, 3, hpH);
  }
  g.restore();
  g.font = '800 34px ui-sans-serif, system-ui, sans-serif';
  outlinedText(g, String(Math.max(0, Math.ceil(d.hp))) + (d.shield > 0 ? ` +${Math.ceil(d.shield)}` : ''), W / 2, hpY + hpH / 2 + 2, w - 12);
  // The meter: pips when it counts a few things, one bar when it counts many, and its name and number on it.
  const m = d.meter;
  if (!m) return;
  const my = hpY + hpH + 8, mh = 40;
  roundedRect(g, x - 3, my - 3, w + 6, mh + 6, 8);
  g.fillStyle = 'rgba(8, 8, 12, 0.92)';
  g.fill();
  g.fillStyle = m.color;
  if (m.max <= 9) {
    const n = Math.round(m.max), gap = 4, each = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const on = Math.round(m.value) > i;
      g.globalAlpha = on ? 1 : 0.16;
      roundedRect(g, x + i * (each + gap), my, each, mh, 4);
      g.fill();
    }
    g.globalAlpha = 1;
  } else {
    g.globalAlpha = 0.16;
    roundedRect(g, x, my, w, mh, 5);
    g.fill();
    g.globalAlpha = 1;
    roundedRect(g, x, my, Math.max(2, w * (m.value / m.max)), mh, 5);
    g.fill();
  }
  g.font = '800 26px ui-sans-serif, system-ui, sans-serif';
  outlinedText(g, `${m.name} ${Math.round(m.value)}/${m.max}`, W / 2, my + mh / 2 + 2, w - 12);
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
  /** The HP and meter bars over each hero's head, by slot. */
  private plates = new Map<string, { sprite: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string }>();
  private bursts: Burst[] = [];
  private clock = 0;
  private ringGeo = new THREE.RingGeometry(0.2, 0.32, 40).rotateX(-Math.PI / 2);
  private pillarGeo = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 16, 1, true).translate(0, 1.3, 0);
  private shardGeo = new THREE.TetrahedronGeometry(0.07, 0);

  /**
   * The bars over a hero's head (the slot named `who`, at `height` m; null hides them): HP with its number, the shield as a pale
   * segment after it, cuts for `chunks`, and the meter under it, cut into pips when it counts a few things. Drawn on a canvas,
   * and only redrawn when a number changes. Green for your hero, red for the enemy, the same way for both players.
   */
  plate(who: string, pos: THREE.Vector3 | null, height: number, d: PlateData | null, camera?: THREE.Camera) {
    let p = this.plates.get(who);
    if (!pos || !d) {
      if (p) p.sprite.visible = false;
      return height;
    }
    if (!p) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 112;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      // A fixed size on screen, near or far, so it reads on a phone at the game camera.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      sprite.scale.set(PLATE_SCALE * (384 / 112), PLATE_SCALE, 1);
      sprite.renderOrder = 7;
      p = { sprite, canvas, tex, key: '' };
      this.plates.set(who, p);
      this.group.add(sprite);
    }
    const m = d.meter;
    // Its feet at `height`: without a meter the empty lower half of the canvas hangs below that.
    p.sprite.center.set(0.5, m ? 0 : 0.47);
    const key = [Math.ceil(d.hp), d.max, Math.ceil(d.shield), d.mine, d.chunks, m?.name, m && Math.round(m.value), m?.max, m?.color].join('|');
    if (p.key !== key) {
      p.key = key;
      drawPlate(p.canvas, d);
      p.tex.needsUpdate = true;
    }
    p.sprite.visible = true;
    p.sprite.position.set(pos.x, height, pos.z);
    // The height of its top in the world, for what sits above it: a fixed screen size is taller the farther the camera.
    const far = camera ? camera.position.distanceTo(p.sprite.position) : 12;
    return height + PLATE_SCALE * far * (m ? 1 : 0.53);
  }

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
