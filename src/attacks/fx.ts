import * as THREE from 'three';

/**
 * Basic-attack looks (one per hero style, picked by `AttackSpec.look`, coloured by the kit). Ranged attacks fly a
 * homing missile; melee attacks play a short swing in front of the attacker.
 *
 * Ranged: orb (default) · arrow · spear (a bigger, sun-bright arrow) · prism (a spinning crystal pyramid) · icicle ·
 * dart (a poison needle dripping drops) · spark (a jittering lightning knot) · note (a music note bobbing) · rivet
 * (tumbling) · gear (a spinning cog) · bone (tumbling) · petal (two fluttering petals) · drop (a stretched blood drop) ·
 * wave (a flat water crescent) · sand (a swirling knot of grains) · ink (blots left along the path).
 * Melee: slash (default) · twin (two quick dagger cuts) · smash (an overhead arc and a ground shock ring) · claw (three
 * raking streaks) · sweep (a wide wind ring) · cleave (a heavy dark crescent with a pale edge).
 */
export type RangedLook = 'orb' | 'arrow' | 'spear' | 'prism' | 'icicle' | 'dart' | 'spark' | 'note' | 'rivet' | 'gear' | 'bone' | 'petal' | 'drop' | 'wave' | 'sand' | 'ink';
export type MeleeLook = 'slash' | 'twin' | 'smash' | 'claw' | 'sweep' | 'cleave';
export type AttackLook = RangedLook | MeleeLook;

interface Bolt {
  holder: THREE.Group;
  spin: THREE.Group;
  trail: THREE.Mesh | null;
  look: RangedLook;
  pos: THREE.Vector3;
  aim: () => THREE.Vector3 | null;
  speed: number;
  arrive: () => void;
  age: number;
  /** Bits left behind (ink blots, poison drops) fading on their own. */
  dropT: number;
  color: string;
}

interface Swing {
  holder: THREE.Group;
  t: number;
  life: number;
  look: MeleeLook;
}

interface Bit {
  mesh: THREE.Mesh;
  t: number;
  life: number;
  vy: number;
}

const HIT_HEIGHT = 1.05;
const GLOW = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;

const glow = (color: THREE.ColorRepresentation, opacity = 0.9, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshBasicMaterial({ color, opacity, side, ...GLOW });
const solid = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

/** Mixes a css colour toward white (k 0..1), for hot cores and pale edges. */
function pale(color: string, k: number) {
  return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), k);
}

// Shared geometries (built once).
const G = {
  orb: new THREE.IcosahedronGeometry(0.13, 1),
  trail: new THREE.CylinderGeometry(0.06, 0.005, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5),
  shaft: new THREE.CylinderGeometry(0.018, 0.018, 0.62, 5).rotateX(Math.PI / 2),
  head: new THREE.ConeGeometry(0.055, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0, 0.38),
  fletch: new THREE.PlaneGeometry(0.12, 0.08).translate(0, 0, -0.28),
  pyramid: new THREE.TetrahedronGeometry(0.16, 0),
  icicle: new THREE.ConeGeometry(0.07, 0.5, 6).rotateX(Math.PI / 2),
  needle: new THREE.CylinderGeometry(0.012, 0.004, 0.42, 4).rotateX(Math.PI / 2),
  bead: new THREE.SphereGeometry(0.045, 8, 6),
  noteHead: new THREE.SphereGeometry(0.075, 10, 8).scale(1.3, 1, 0.9),
  noteStem: new THREE.CylinderGeometry(0.014, 0.014, 0.26, 5).translate(0.085, 0.13, 0),
  noteFlag: new THREE.PlaneGeometry(0.11, 0.06).translate(0.14, 0.23, 0),
  rivet: new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8),
  rivetCap: new THREE.CylinderGeometry(0.085, 0.085, 0.04, 10).translate(0, 0.08, 0),
  gear: new THREE.TorusGeometry(0.11, 0.035, 6, 12),
  tooth: new THREE.BoxGeometry(0.05, 0.05, 0.05),
  boneShaft: new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6),
  boneKnob: new THREE.SphereGeometry(0.045, 8, 6),
  petal: new THREE.CircleGeometry(0.09, 10).scale(0.55, 1, 1),
  drop: new THREE.SphereGeometry(0.08, 10, 8).scale(1, 1, 2.2),
  wave: new THREE.RingGeometry(0.22, 0.34, 20, 1, -Math.PI * 0.4, Math.PI * 0.8).rotateX(-Math.PI / 2),
  grain: new THREE.TetrahedronGeometry(0.04, 0),
  blot: new THREE.CircleGeometry(0.12, 12).rotateX(-Math.PI / 2),
  sparkSeg: new THREE.BoxGeometry(0.025, 0.025, 0.22),
  slash: new THREE.RingGeometry(1.1, 1.75, 24, 1, -Math.PI * 0.42, Math.PI * 0.84),
  thin: new THREE.RingGeometry(1.15, 1.35, 20, 1, -Math.PI * 0.3, Math.PI * 0.6),
  wide: new THREE.RingGeometry(0.9, 1.9, 40, 1, -Math.PI * 0.75, Math.PI * 1.5),
  shock: new THREE.RingGeometry(0.2, 0.42, 32).rotateX(-Math.PI / 2),
  streak: new THREE.PlaneGeometry(0.1, 1.3),
  cleave: new THREE.RingGeometry(1.0, 1.9, 28, 1, -Math.PI * 0.45, Math.PI * 0.9),
  edge: new THREE.RingGeometry(1.84, 1.98, 28, 1, -Math.PI * 0.45, Math.PI * 0.9),
};

export class AttackFx {
  readonly group = new THREE.Group();
  private bolts: Bolt[] = [];
  private swings: Swing[] = [];
  private bits: Bit[] = [];

  /** A homing missile from `from` to wherever `aim()` says the target is; `arrive` runs on contact (not when it is gone). */
  bolt(from: THREE.Vector3, aim: () => THREE.Vector3 | null, speed: number, color: string, arrive: () => void, look: RangedLook = 'orb') {
    const holder = new THREE.Group(), spin = new THREE.Group();
    holder.add(spin);
    holder.position.copy(from);
    let trail: THREE.Mesh | null = null;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, to: THREE.Object3D = spin) => {
      const m = new THREE.Mesh(geo, mat);
      to.add(m);
      return m;
    };
    // Cores are solid (not additive): a pale additive core blooms into a white blob.
    const core = pale(color, 0.35);
    switch (look) {
      case 'arrow':
      case 'spear': {
        add(G.shaft, solid(look === 'spear' ? core : color));
        add(G.head, solid(core));
        const f = add(G.fletch, glow(color, 0.6, THREE.DoubleSide));
        f.rotation.z = Math.PI / 4;
        if (look === 'spear') spin.scale.setScalar(1.6);
        trail = add(G.trail, glow(color, look === 'spear' ? 0.45 : 0.25), holder);
        break;
      }
      case 'prism': {
        add(G.pyramid, solid(color, 0.9));
        add(G.pyramid, glow(color, 0.3)).scale.setScalar(1.35);
        trail = add(G.trail, glow(core, 0.3), holder);
        break;
      }
      case 'icicle': {
        add(G.icicle, solid(core, 0.9));
        add(G.icicle, glow(color, 0.4)).scale.setScalar(1.25);
        trail = add(G.trail, glow('#dff4ff', 0.25), holder);
        break;
      }
      case 'dart': {
        add(G.needle, solid(core));
        add(G.bead, glow(color, 0.9)).position.z = -0.16;
        break;
      }
      case 'spark': {
        for (let i = 0; i < 4; i++) {
          const s = add(G.sparkSeg, i % 2 ? solid(core) : glow(color, 0.7));
          s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        }
        add(G.orb, solid(core)).scale.setScalar(0.5);
        break;
      }
      case 'note': {
        const mat = solid(color);
        mat.side = THREE.DoubleSide;
        add(G.noteHead, mat);
        add(G.noteStem, mat);
        add(G.noteFlag, mat);
        break;
      }
      case 'rivet': {
        add(G.rivet, solid(core));
        add(G.rivetCap, solid(color));
        trail = add(G.trail, glow(color, 0.25), holder);
        break;
      }
      case 'gear': {
        const mat = solid(color);
        add(G.gear, mat);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          add(G.tooth, mat).position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
        }
        spin.scale.setScalar(1.4);
        break;
      }
      case 'bone': {
        const mat = solid('#eee6cf');
        add(G.boneShaft, mat);
        add(G.boneKnob, mat).position.y = 0.16;
        add(G.boneKnob, mat).position.y = -0.16;
        add(G.orb, glow(color, 0.15)).scale.setScalar(1.2);
        spin.scale.setScalar(1.3);
        break;
      }
      case 'petal': {
        for (let i = 0; i < 2; i++) {
          const p = add(G.petal, solid(i ? core : color));
          (p.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
          p.position.x = i ? 0.07 : -0.07;
          p.rotation.z = i ? 0.6 : -0.6;
        }
        spin.scale.setScalar(1.7);
        break;
      }
      case 'drop': {
        add(G.drop, solid(color));
        add(G.drop, glow(core, 0.35)).scale.setScalar(1.3);
        trail = add(G.trail, glow(color, 0.35), holder);
        break;
      }
      case 'wave': {
        const w = add(G.wave, solid(core, 0.9));
        (w.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
        add(G.wave, glow(color, 0.35, THREE.DoubleSide)).scale.setScalar(1.35);
        break;
      }
      case 'sand': {
        for (let i = 0; i < 9; i++) {
          const g = add(G.grain, solid(i % 3 ? color : core));
          const a = (i / 9) * Math.PI * 2;
          g.position.set(Math.cos(a) * 0.14, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.14);
        }
        break;
      }
      case 'ink': {
        add(G.orb, solid('#0d0b14')).scale.setScalar(1.1);
        add(G.orb, glow(color, 0.45)).scale.setScalar(1.45);
        break;
      }
      default: {
        add(G.orb, glow(color, 0.8));
        trail = add(G.trail, glow(color, 0.4), holder);
      }
    }
    this.group.add(holder);
    this.bolts.push({ holder, spin, trail, look, pos: from.clone(), aim, speed, arrive, age: 0, dropT: 0, color });
  }

  /** A melee swing in front of a figure at `at` facing `yaw`. */
  slash(at: THREE.Vector3, yaw: number, color: string, look: MeleeLook = 'slash') {
    const holder = new THREE.Group();
    holder.position.set(at.x, 1.0, at.z);
    holder.rotation.y = yaw;
    const core = pale(color, 0.5);
    // RingGeometry arcs are centred on +X in the XY plane: turn to +Y, then lay them nearly flat facing forward (+Z).
    const arc = (geo: THREE.BufferGeometry, mat: THREE.Material, tilt = Math.PI / 2 - 0.25, roll = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.set(tilt, roll, Math.PI / 2);
      holder.add(m);
      return m;
    };
    let life = 0.2;
    switch (look) {
      case 'twin': {
        arc(G.thin, glow(core, 0.9, THREE.DoubleSide), Math.PI / 2 - 0.6, 0.35);
        arc(G.thin, glow(color, 0.9, THREE.DoubleSide), Math.PI / 2 + 0.1, -0.35).visible = false;
        life = 0.24;
        break;
      }
      case 'smash': {
        const a = arc(G.slash, glow(color, 0.85, THREE.DoubleSide), 0.15);
        a.position.z = 0.4;
        const shock = new THREE.Mesh(G.shock, glow(core, 0.9, THREE.DoubleSide));
        shock.position.set(0, -0.95, 1.6);
        shock.name = 'shock';
        holder.add(shock);
        life = 0.32;
        break;
      }
      case 'claw': {
        for (let i = -1; i <= 1; i++) {
          const s = new THREE.Mesh(G.streak, glow(i ? color : core, 0.9, THREE.DoubleSide));
          s.position.set(i * 0.22, 0.1, 1.15);
          s.rotation.set(-0.3, 0, 0.55);
          holder.add(s);
        }
        life = 0.18;
        break;
      }
      case 'sweep': {
        arc(G.wide, glow(core, 0.6, THREE.DoubleSide), Math.PI / 2 - 0.05);
        arc(G.wide, glow(color, 0.45, THREE.DoubleSide), Math.PI / 2 + 0.12).scale.setScalar(1.12);
        life = 0.26;
        break;
      }
      case 'cleave': {
        arc(G.cleave, solid('#120a1c', 0.85));
        arc(G.edge, glow(color, 0.95, THREE.DoubleSide));
        arc(G.edge, glow(core, 0.6, THREE.DoubleSide)).scale.setScalar(0.97);
        life = 0.26;
        break;
      }
      default:
        arc(G.slash, glow(color, 0.85, THREE.DoubleSide));
    }
    this.group.add(holder);
    this.swings.push({ holder, t: 0, life, look });
  }

  update(dt: number) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const at = b.aim();
      if (!at) { this.dropBolt(i); continue; }
      b.age += dt;
      const goal = new THREE.Vector3(at.x, HIT_HEIGHT, at.z);
      const d = goal.clone().sub(b.pos);
      const step = b.speed * dt;
      if (d.length() <= step + 0.15) {
        this.impact(b);
        b.arrive();
        this.dropBolt(i);
        continue;
      }
      d.normalize();
      b.pos.addScaledVector(d, step);
      b.holder.position.copy(b.pos);
      b.holder.lookAt(b.pos.clone().add(d));
      this.animate(b, dt, d);
      if (b.trail) b.trail.scale.set(1, 1, Math.min(1.2, 0.35 + b.speed * 0.04));
    }
    for (let i = this.swings.length - 1; i >= 0; i--) {
      const s = this.swings[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.life);
      s.holder.children.forEach((c, j) => {
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (s.look === 'twin' && j === 1) c.visible = k > 0.4; // the second cut follows the first
        const local = s.look === 'twin' && j === 1 ? Math.max(0, (k - 0.4) / 0.6) : k;
        if (!m.userData.o) m.userData.o = m.opacity;
        m.opacity = m.userData.o * (1 - local);
        if (c.name === 'shock') c.scale.setScalar(1 + 5 * local);
        else if (s.look === 'claw') c.position.y = 0.1 - 0.5 * local;
        else c.scale.setScalar(0.85 + 0.25 * local);
      });
      if (k >= 1) {
        this.group.remove(s.holder);
        s.holder.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
        this.swings.splice(i, 1);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.t += dt;
      b.mesh.position.y = Math.max(0.03, b.mesh.position.y + b.vy * dt);
      b.vy -= 6 * dt;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - b.t / b.life);
      if (b.t >= b.life) {
        this.group.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.bits.splice(i, 1);
      }
    }
  }

  /** Per-look motion in flight (`d` the flight direction). */
  private animate(b: Bolt, dt: number, d: THREE.Vector3) {
    const t = b.age, s = b.spin;
    switch (b.look) {
      case 'prism': s.rotation.z += dt * 14; s.rotation.x += dt * 6; break;
      case 'rivet': case 'bone': s.rotation.x += dt * 22; break;
      case 'gear': s.rotation.z += dt * 18; break;
      case 'spark': s.position.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, 0); s.rotation.z = Math.random() * 6; break;
      case 'note': s.position.y = Math.sin(t * 18) * 0.08; s.rotation.y = -Math.PI / 2; break;
      case 'petal': s.rotation.z = t * 9; s.position.x = Math.sin(t * 11) * 0.08; break;
      case 'wave': s.rotation.z = Math.sin(t * 20) * 0.15; break;
      case 'sand': s.rotation.z += dt * 16; s.rotation.y += dt * 7; break;
      case 'dart':
      case 'ink': {
        b.dropT -= dt;
        if (b.dropT <= 0) {
          b.dropT = b.look === 'ink' ? 0.045 : 0.07;
          const ink = b.look === 'ink';
          const m = new THREE.Mesh(ink ? G.blot : G.bead, ink ? solid('#0d0b14', 0.85) : glow(b.color, 0.85));
          m.position.copy(b.pos).addScaledVector(d, -0.15);
          if (ink) m.scale.setScalar(0.5 + Math.random() * 0.6);
          this.group.add(m);
          this.bits.push({ mesh: m, t: 0, life: ink ? 0.5 : 0.4, vy: ink ? -2.5 : -1 });
        }
        break;
      }
      default:
    }
  }

  /** A small burst where a missile lands: a ring of its colour. */
  private impact(b: Bolt) {
    const m = new THREE.Mesh(G.shock, glow(pale(b.color, 0.3), 0.85, THREE.DoubleSide));
    m.position.copy(b.pos);
    m.rotation.x = Math.random() * 0.8;
    m.scale.setScalar(0.6);
    this.group.add(m);
    this.bits.push({ mesh: m, t: 0, life: 0.18, vy: 0 });
  }

  /** Removes every missile, swing and leftover bit (a new round). */
  clear() {
    for (let i = this.bolts.length - 1; i >= 0; i--) this.dropBolt(i);
    for (const s of this.swings) {
      this.group.remove(s.holder);
      s.holder.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
    }
    this.swings = [];
    for (const b of this.bits) { this.group.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); }
    this.bits = [];
  }

  private dropBolt(i: number) {
    const b = this.bolts[i];
    this.group.remove(b.holder);
    b.holder.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
    this.bolts.splice(i, 1);
  }
}
