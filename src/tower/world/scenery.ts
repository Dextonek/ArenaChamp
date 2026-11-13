import * as THREE from 'three';
import { softDotTexture } from '../../effects/common';
import { LightPillar } from '../../raid/fx';
import type { ZoneCtx } from './ctx';
import type { DoorDef, Spot } from './def';

/**
 * What stands in a floor besides its people and enemies, drawn from the floor's data and acted on by the hero's walk alone:
 * waystones (touch one to step back to it from the camp and wake there after a fall), caches (shards, sometimes a boon), the lore
 * stone (two lines), the winch a carried thing is brought to, and the doors (the ruler's lair behind its chain, the trial vault, the
 * gate up). A door is a wall in the arena's cover until a step opens it (`ZoneCtx.openDoor`); walking into its doorway calls
 * `enter(door)`.
 */

const GOLD = 0xc9a24a, BLUE = 0x6ec8ff, WARM = 0xffd27a;
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

export class Scenery {
  private group = new THREE.Group();
  private own: { dispose(): void }[] = [];
  private stones = new Map<string, { glow: THREE.Sprite; pillar: LightPillar; ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial }>();
  private chests = new Map<string, { g: THREE.Group; glow: THREE.Sprite; hint: LightPillar }>();
  private doors = new Map<string, { g: THREE.Group; lift: THREE.Object3D | null; glow: THREE.Sprite | null; lifted: number; sealed: THREE.Mesh | null }>();
  private lore: { glow: THREE.Sprite } | null = null;
  private t = 0;
  private lockedAt = new Map<string, number>();
  private loreAt = -99;
  /** Called when the hero walks into a door that is ready. */
  enter: (door: DoorDef) => void = () => {};
  /** Called when the hero reads the lore stone (a card or, for the autopilot, nothing). */
  read: (lines: string[]) => void = () => {};

  constructor(private z: ZoneCtx) {
    z.p.group.add(this.group);
    const mat = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...o });
      this.own.push(m);
      return m;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T) => { this.own.push(g); return g; };
    const stone = mat(0x2f323c), gold = mat(GOLD, { metalness: 0.8, roughness: 0.4, emissive: 0xffb050, emissiveIntensity: 0.25 }), wood = mat(0x4a3626), iron = mat(0x23252c, { metalness: 0.5, roughness: 0.55 });
    const glowMat = (color: number) => new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    const sprite = (color: number, size: number, at: Spot, y: number) => {
      const s = new THREE.Sprite(glowMat(color));
      s.position.set(at.x, y, at.z);
      s.scale.setScalar(size);
      this.group.add(s);
      this.own.push(s.material);
      return s;
    };

    // Waystones: an obelisk on a plinth with a ring that lights when touched.
    for (const w of z.def.waystones) {
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.95, 1.15, 0.3, 8)), stone);
      plinth.position.y = 0.15;
      const spire = new THREE.Mesh(geo(new THREE.ConeGeometry(0.55, 2.8, 4)), stone);
      spire.position.y = 1.7;
      spire.rotation.y = Math.PI / 4;
      spire.castShadow = true;
      const ringMat = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.4 });
      this.own.push(ringMat);
      const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(0.8, 0.04, 6, 24)), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.34;
      const top = new THREE.Mesh(geo(new THREE.OctahedronGeometry(0.2)), gold);
      top.position.y = 3.35;
      g.add(plinth, spire, ring, top);
      g.position.set(w.at.x, 0, w.at.z);
      this.group.add(g);
      const pillar = new LightPillar(w.at.x, w.at.z, 0.9, 6, BLUE);
      this.group.add(pillar.mesh);
      const glow = sprite(BLUE, 2.4, w.at, 3.4);
      this.stones.set(w.id, { glow, pillar, ring, ringMat });
    }

    // Caches: a small chest with a gold band, half buried; it only glows a little.
    for (const c of z.def.caches) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(geo(new THREE.BoxGeometry(0.9, 0.55, 0.6)), wood);
      body.position.y = 0.28;
      const lid = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2)), wood);
      lid.position.set(0, 0.55, 0);
      lid.rotation.y = Math.PI / 2;
      const band = new THREE.Mesh(geo(new THREE.BoxGeometry(0.95, 0.12, 0.08)), gold);
      band.position.set(0, 0.35, 0.3);
      g.add(body, lid, band);
      g.position.set(c.at.x, 0, c.at.z);
      g.rotation.y = (c.at.x * 7.3) % 3;
      this.group.add(g);
      const glow = sprite(WARM, 1.8, c.at, 0.8);
      glow.material.opacity = 0.5;
      const hint = new LightPillar(c.at.x, c.at.z, 0.9, 8, WARM);
      hint.opacity = 0;
      this.group.add(hint.mesh);
      this.chests.set(c.id, { g, glow, hint });
    }

    // The lore stone: a dark slab with a pale glyph.
    {
      const l = z.def.lore, g = new THREE.Group();
      const slab = new THREE.Mesh(geo(new THREE.BoxGeometry(1.2, 2.6, 0.45)), stone);
      slab.position.y = 1.3;
      slab.rotation.z = 0.05;
      slab.castShadow = true;
      const glyph = new THREE.Mesh(geo(new THREE.TorusGeometry(0.3, 0.04, 5, 14)), new THREE.MeshBasicMaterial({ color: 0xcfefff }));
      this.own.push(glyph.material as THREE.Material);
      glyph.position.set(0, 1.5, 0.24);
      g.add(slab, glyph);
      g.position.set(l.at.x, 0, l.at.z);
      g.rotation.y = 2.6;
      this.group.add(g);
      this.lore = { glow: sprite(0xcfefff, 2.2, l.at, 1.6) };
    }

    // The winch (or whatever a carried thing is brought to).
    for (const q of z.def.quests) for (const s of q.steps) if (s.verb === 'carry') {
      const g = new THREE.Group();
      for (const x of [-0.7, 0.7]) {
        const post = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6)), wood);
        post.position.set(x, 1.1, 0);
        g.add(post);
      }
      const drum = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 10).rotateZ(Math.PI / 2)), iron);
      drum.position.y = 1.9;
      const crank = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, 0.7, 0.08)), gold);
      crank.position.set(0.85, 1.9, 0);
      const base = new THREE.Mesh(geo(new THREE.BoxGeometry(2.0, 0.2, 1.0)), stone);
      base.position.y = 0.1;
      g.add(drum, crank, base);
      g.position.set(s.to.x, 0, s.to.z);
      g.rotation.y = 0.5;
      this.group.add(g);
    }

    // The doors.
    for (const d of z.def.doors) {
      const g = new THREE.Group();
      g.position.set(d.at.x, 0, d.at.z);
      let lift: THREE.Object3D | null = null, glow: THREE.Sprite | null = null, sealed: THREE.Mesh | null = null;
      if (d.wall) {
        // A heavy chained gate in the wall's doorway; it lifts when the chain falls.
        const w = d.wall, mid = { x: (w.ax + w.bx) / 2, z: (w.az + w.bz) / 2 }, len = Math.hypot(w.bx - w.ax, w.bz - w.az);
        const leaf = new THREE.Group();
        const slab = new THREE.Mesh(geo(new THREE.BoxGeometry(len, w.height, 0.5)), iron);
        slab.position.y = w.height / 2;
        for (let k = -2; k <= 2; k++) {
          const bar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.12, w.height, 0.6)), gold);
          bar.position.set(k * (len / 5), w.height / 2, 0);
          leaf.add(bar);
        }
        const chain = new THREE.Mesh(geo(new THREE.TorusGeometry(0.6, 0.09, 6, 16)), gold);
        chain.position.set(0, w.height * 0.55, 0.3);
        leaf.add(slab, chain);
        leaf.position.set(mid.x - d.at.x, 0, mid.z - d.at.z);
        leaf.rotation.y = Math.atan2(w.bx - w.ax, w.bz - w.az) + Math.PI / 2;
        g.add(leaf);
        lift = leaf;
        glow = sprite(0xff8a6a, 3, { x: mid.x, z: mid.z }, 2.4);
        if (z.run.opened.includes(d.id)) { leaf.position.y = w.height + 0.5; glow.visible = false; }
      } else {
        // An arch: two posts and a lintel, a light in it. The gate up is sealed with a gold sheet until the ruler falls.
        for (const x of [-d.r * 0.9, d.r * 0.9]) {
          const post = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.35, 0.45, 3.6, 7)), stone);
          post.position.set(x, 1.8, 0);
          post.castShadow = true;
          g.add(post);
        }
        const lintel = new THREE.Mesh(geo(new THREE.BoxGeometry(d.r * 2.2, 0.5, 0.7)), stone);
        lintel.position.y = 3.75;
        const trim = new THREE.Mesh(geo(new THREE.BoxGeometry(d.r * 2.3, 0.1, 0.8)), gold);
        trim.position.y = 4.05;
        g.add(lintel, trim);
        const tone = d.piece === 'gate' ? WARM : BLUE;
        const sheet = new THREE.Mesh(geo(new THREE.PlaneGeometry(d.r * 1.8, 3.4)), new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.own.push(sheet.material as THREE.Material);
        sheet.position.y = 1.8;
        g.add(sheet);
        sealed = sheet;
        glow = sprite(tone, 3.4, d.at, 2.6);
      }
      g.rotation.y = d.id === 'gate' ? Math.PI / 2 : d.id === 'trial' ? Math.PI / 2 : 0;
      this.group.add(g);
      this.doors.set(d.id, { g, lift, glow, lifted: z.run.opened.includes(d.id) ? 1 : 0, sealed });
    }
  }

  /** A door's wall opened just now: the leaf lifts with a shower of sparks. */
  opened(id: string) {
    const z = this.z, d = z.def.doors.find((x) => x.id === id);
    if (!d?.wall) return;
    const w = d.wall;
    z.p.show.shards((w.ax + w.bx) / 2, 2, (w.az + w.bz) / 2, { count: 40, color: 0x6a6a70, speed: 5, life: 1.2, size: 0.25, up: 0.6 });
    z.p.shake(0.2);
  }

  update(dt: number) {
    const z = this.z, hero = z.hero;
    this.t += dt;
    for (const w of z.def.waystones) {
      const s = this.stones.get(w.id)!, touched = z.run.waystones.includes(w.id);
      s.pillar.opacity = touched ? 0.5 + 0.1 * Math.sin(this.t * 2) : 0.12;
      s.ringMat.opacity = touched ? 0.95 : 0.35;
      s.glow.visible = touched;
      if (!touched && dist(hero, w.at) < 1.9) {
        z.run.waystones.push(w.id);
        z.run.lastWaystone = w.id;
        z.p.show.ring(w.at.x, w.at.z, { radius: 4, life: 0.9, color: BLUE, width: 0.6, peak: 0.6 });
        z.p.show.column(w.at.x, w.at.z, { radius: 0.9, height: 8, life: 1, color: BLUE, peak: 0.6 });
        z.banner('Waystone', `${w.name}: step back to it from the camp, and wake here after a fall`, 3);
        z.save();
      }
    }
    for (const c of z.def.caches) {
      const ch = this.chests.get(c.id)!, found = z.run.caches.includes(c.id);
      ch.g.visible = !found;
      ch.glow.visible = !found && dist(hero, c.at) < 16;
      ch.glow.scale.setScalar(1.6 + 0.2 * Math.sin(this.t * 3));
      ch.hint.opacity = !found && z.run.hintShown.includes(c.id) ? 0.4 + 0.15 * Math.sin(this.t * 3) : 0;
      if (!found && dist(hero, c.at) < 1.7) {
        z.run.caches.push(c.id);
        z.pay(c.shards, c.at);
        z.p.sparks.emit(c.at.x, 0.8, c.at.z, 30, 4, 4, 0.9, WARM);
        z.p.show.column(c.at.x, c.at.z, { radius: 0.9, height: 6, life: 0.9, color: WARM, peak: 0.6 });
        z.banner('A cache', `${c.shards} shards${c.boon ? ' and a boon' : ''}`, 2.4);
        if (c.boon) z.offerBoon('The cache holds a boon');
        z.save();
      }
    }
    if (this.lore) {
      const l = z.def.lore, read = z.run.lore.includes(l.id);
      this.lore.glow.scale.setScalar(read ? 1.6 : 2.2 + 0.3 * Math.sin(this.t * 2.5));
      if (dist(hero, l.at) < 2.6 && this.t - this.loreAt > 8) {
        this.loreAt = this.t;
        if (!read) { z.run.lore.push(l.id); z.pay(5, l.at); z.save(); }
        this.read(l.text);
      }
    }
    for (const d of z.def.doors) {
      const dr = this.doors.get(d.id)!, open = d.wall ? z.run.opened.includes(d.id) : true, ready = this.ready(d);
      if (dr.lift && d.wall) {
        dr.lifted += ((open ? 1 : 0) - dr.lifted) * Math.min(1, dt * 1.6);
        dr.lift.position.y = dr.lifted * (d.wall.height + 0.6);
      }
      if (dr.glow) {
        dr.glow.material.opacity = (open ? (ready ? 0.9 : 0.35) : 0.7) + 0.1 * Math.sin(this.t * 2.2);
        dr.glow.visible = !(d.wall && dr.lifted > 0.95);
      }
      if (dr.sealed) (dr.sealed.material as THREE.MeshBasicMaterial).opacity = ready ? 0.5 + 0.12 * Math.sin(this.t * 2) : 0.14;
      if (dist(hero, d.at) < d.r) {
        if (ready) this.enter(d);
        else if (d.locked && this.t - (this.lockedAt.get(d.id) ?? -99) > 7) {
          this.lockedAt.set(d.id, this.t);
          z.banner(d.name, d.locked, 3);
        }
      }
    }
  }

  /** Whether walking into the door starts its piece. */
  ready(d: DoorDef) {
    const z = this.z;
    if (d.wall && !z.run.opened.includes(d.id)) return false;
    if (d.needs?.won && !z.run.has(d.needs.won)) return false;
    if (d.piece === 'trial' && z.run.has('trial')) return false;
    if (d.piece === 'ruler' && z.run.has('ruler')) return false;
    if (d.piece === 'gate' && z.run.has('gate')) return false;
    return true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const s of this.stones.values()) s.pillar.dispose();
    for (const c of this.chests.values()) c.hint.dispose();
    for (const o of this.own) o.dispose();
  }
}
