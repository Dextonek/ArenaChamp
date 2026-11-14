import * as THREE from 'three';
import { attackFor } from '../../attacks';
import { Enemy } from '../../effects/common';
import type { TargetingSpec } from '../../effects/targeting';
import type { HeroKit } from '../../heroes';
import { HeroFigure, castStyle } from '../../heroFigure';
import type { WorldPlayer, WorldSink } from '../../net/world';
import type { GameApi, Runtime } from '../../runtime';

/**
 * The other players on this Climb floor (the open world, stage 1: pipeline/designs/climb-open-world.md): their heroes, drawn where
 * their own screens say they walk, with their names over their heads. Drawn only: nothing here can hit them, aim at them or bump
 * into them, and nothing they do counts on this screen (no hits, no damage); a cast is its look. The nearest `FULL` are full figures,
 * the rest light stand-ins (a slim figure of the hero's colour), as the Raid draws a big party, so seven others cost a phone little.
 *
 * Places come in about ten times a second and are played back `DELAY` ms late between two reports, as a duel's other hero is
 * (docs/architecture/multiplayer.md, "Smooth movement"). Nothing is allocated per frame: reports go into a fixed ring of slots.
 *
 * `fake(n)`: n made-up others walking about the hero, with no server (the speed test's switch: `?others=7` on the game page, or
 * `perf.py` scenes with `others`).
 */

/** Full figures for the nearest this many; light stand-ins past them. */
const FULL = 3;
/** How far behind the newest report a figure is drawn (ms), how long a pause counts as standing still, and a jump that snaps. */
const DELAY = 100, GAP = 160, STEP = 50, JUMP = 6;
/** Reports kept per player. */
const RING = 12;
/** How often the nearest are looked for again (s). */
const SORT_EVERY = 0.5;
/** A cast is drawn where its caster stands on this screen unless its own screen put it farther than this (m). */
const SNAP = 3;

const LITE_BODY = new THREE.CylinderGeometry(0.16, 0.3, 1.2, 7).translate(0, 0.6, 0);
const LITE_HEAD = new THREE.IcosahedronGeometry(0.2, 0).translate(0, 1.42, 0);
const LITE_RING = new THREE.RingGeometry(0.45, 0.55, 24).rotateX(-Math.PI / 2).translate(0, 0.04, 0);
const NAME_COLOR = '#a8e0b0';
const STILL = {};

/** A player's reported places on this screen's clock, in a fixed ring, played back a little late. */
class Glide {
  private at = new Float64Array(RING);
  private xs = new Float32Array(RING);
  private zs = new Float32Array(RING);
  private yaws = new Float32Array(RING);
  /** The oldest slot in use and how many are. */
  private head = 0;
  private n = 0;
  private clock: number | null = null;

  reset(x: number, z: number, yaw: number) {
    this.n = 0;
    this.add(performance.now() - DELAY - 1, x, z, yaw);
  }

  push(x: number, z: number, yaw: number, ts?: number) {
    const now = performance.now();
    let at = now;
    if (ts !== undefined) {
      // The sender's clock on this one: the smallest gap seen is the quickest delivery.
      this.clock = this.clock === null ? now - ts : Math.min(this.clock, now - ts);
      at = ts + this.clock;
    }
    if (this.n) {
      const l = (this.head + this.n - 1) % RING;
      if (Math.hypot(x - this.xs[l], z - this.zs[l]) > JUMP) this.n = 0;
      else {
        at = Math.max(at, this.at[l] + 1);
        // It stood still in between (nothing is sent then): hold the old spot until just before the new report.
        if (at - this.at[l] > GAP) this.add(at - STEP, this.xs[l], this.zs[l], this.yaws[l]);
      }
    }
    this.add(at, x, z, yaw);
  }

  private add(at: number, x: number, z: number, yaw: number) {
    if (this.n === RING) { this.head = (this.head + 1) % RING; this.n--; }
    const i = (this.head + this.n) % RING;
    this.at[i] = at; this.xs[i] = x; this.zs[i] = z; this.yaws[i] = yaw;
    this.n++;
  }

  /** Where it is drawn now, into `out` (its y is the facing). False before the first report. */
  sample(out: THREE.Vector3) {
    if (!this.n) return false;
    const t = performance.now() - DELAY;
    let k = 0;
    while (k < this.n - 1 && this.at[(this.head + k + 1) % RING] <= t) k++;
    const a = (this.head + k) % RING, b = (this.head + Math.min(k + 1, this.n - 1)) % RING;
    const f = this.at[b] > this.at[a] ? Math.min(1, Math.max(0, (t - this.at[a]) / (this.at[b] - this.at[a]))) : 1;
    const turn = Math.atan2(Math.sin(this.yaws[b] - this.yaws[a]), Math.cos(this.yaws[b] - this.yaws[a]));
    out.set(this.xs[a] + (this.xs[b] - this.xs[a]) * f, this.yaws[a] + turn * f, this.zs[a] + (this.zs[b] - this.zs[a]) * f);
    return true;
  }
}

/** A name over a head: drawn once on a small canvas. */
function nameTag(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  if (g) {
    g.font = '800 58px ui-sans-serif, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(10, 10, 16, 0.9)';
    g.strokeText(text, 192, 50, 372);
    g.fillStyle = NAME_COLOR;
    g.fillText(text, 192, 50, 372);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(2.8, 0.7, 1);
  sprite.renderOrder = 6;
  return sprite;
}

/** One other player's hero on this screen. */
class Other {
  readonly group = new THREE.Group();
  readonly figure = new HeroFigure();
  /** Where it stands, for the casts' looks (a bare figure: no meshes, in no list of foes). */
  readonly caster = new Enemy({ bare: true });
  /** Where a cast of its aims (an enemy-target spell plays toward it). */
  readonly aim = new Enemy({ bare: true });
  readonly glide = new Glide();
  readonly tag: THREE.Sprite;
  private liteGroup = new THREE.Group();
  private liteMat: THREE.MeshStandardMaterial;
  private liteRingMat: THREE.MeshBasicMaterial;
  lite = true;
  hp = 1;
  down = false;
  private downT = 0;
  /** Distance to this screen's hero (m), for the nearest. */
  dist = 0;
  private s = new THREE.Vector3();

  constructor(readonly id: number, public name: string, public kit: HeroKit, x: number, z: number, yaw: number) {
    this.caster.body = null;
    this.aim.body = null;
    this.caster.group.position.set(x, 0, z);
    this.caster.group.rotation.y = yaw;
    this.glide.reset(x, z, yaw);
    this.liteMat = new THREE.MeshStandardMaterial({ color: kit.accent, roughness: 0.55, metalness: 0.2, emissive: kit.accent, emissiveIntensity: 0.25, flatShading: true });
    this.liteRingMat = new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: 0.6, depthWrite: false });
    this.liteGroup.add(new THREE.Mesh(LITE_BODY, this.liteMat), new THREE.Mesh(LITE_HEAD, this.liteMat), new THREE.Mesh(LITE_RING, this.liteRingMat));
    this.tag = nameTag(name);
    this.group.add(this.figure.group, this.liteGroup, this.tag);
    this.figure.group.visible = false;
  }

  get pos() {
    return this.caster.group.position;
  }

  /** Another hero (the player changed): a new model and colour. */
  setKit(kit: HeroKit) {
    if (kit === this.kit) return;
    this.kit = kit;
    this.liteMat.color.set(kit.accent);
    this.liteMat.emissive.set(kit.accent);
    this.liteRingMat.color.set(kit.accent);
    if (!this.lite) this.loadFigure();
  }

  /** Full figure or light stand-in. The model loads the first time it is wanted. */
  setLite(on: boolean) {
    if (on === this.lite) return;
    this.lite = on;
    if (!on) this.loadFigure();
  }

  private loaded: HeroKit | null = null;
  private loadFigure() {
    if (this.loaded === this.kit) return;
    this.loaded = this.kit;
    this.figure.setModel(this.kit.model, this.pos, this.kit);
    if (this.down) this.figure.fall(1);
    else this.figure.stand();
  }

  health(hp: number) {
    this.hp = hp;
    if (hp <= 0 && !this.down) { this.down = true; this.downT = 0; }
    else if (hp > 0 && this.down) { this.down = false; if (this.loaded) this.figure.stand(); }
  }

  update(dt: number) {
    // A fallen hero lies where it fell: a late report must not slide it.
    if (!this.down && this.glide.sample(this.s)) {
      this.pos.set(this.s.x, 0, this.s.z);
      this.caster.group.rotation.y = this.s.y;
    }
    const yaw = this.caster.group.rotation.y;
    this.figure.group.visible = !this.lite;
    this.liteGroup.visible = this.lite;
    if (this.lite) {
      this.liteGroup.position.copy(this.pos);
      this.liteGroup.rotation.set(this.down ? Math.PI / 2 : 0, yaw, 0);
    } else {
      this.figure.follow(dt, this.pos, yaw, STILL);
      if (this.down) this.figure.fall(Math.min(1, (this.downT += dt) / 0.6));
    }
    this.tag.position.set(this.pos.x, this.lite ? 2.05 : 2.55, this.pos.z);
  }

  dispose() {
    this.figure.setModel(undefined);
    this.liteMat.dispose();
    this.liteRingMat.dispose();
    this.tag.material.map?.dispose();
    this.tag.material.dispose();
  }
}

export class WorldOthers implements WorldSink {
  readonly group = new THREE.Group();
  private list = new Map<number, Other>();
  /** The same players, kept for sorting by distance without a new array. */
  private order: Other[] = [];
  private sortIn = 0;
  /** The shard's name, and a change of how many others there are (for the HUD's line). */
  shard = '';
  onCount: ((n: number) => void) | null = null;
  private fakes: { o: Other; cx: number; cz: number; r: number; w: number; a: number; sendIn: number; castIn: number }[] = [];
  private fakeT = 0;

  constructor(private api: GameApi) {
    this.group.name = 'world-others';
    api.duel.group.add(this.group);
  }

  get count() {
    return this.list.size;
  }

  private kitOf(hero: string) {
    return this.api.kits.find((k) => k.name === hero) ?? null;
  }

  // --- what the hub says (WorldSink) ------------------------------------------------------------------------------------

  roster(shard: string, players: WorldPlayer[]) {
    this.shard = shard;
    const keep = new Set(players.map((p) => p.id));
    for (const id of [...this.list.keys()]) if (id >= 0 && !keep.has(id)) this.remove(id);
    for (const p of players) this.joined(p);
    this.onCount?.(this.list.size);
  }

  joined(p: WorldPlayer) {
    const kit = this.kitOf(p.hero);
    if (!kit) return;
    let o = this.list.get(p.id);
    if (o) {
      o.setKit(kit);
      o.name = p.name;
    } else {
      o = new Other(p.id, p.name, kit, p.x, p.z, p.yaw);
      this.list.set(p.id, o);
      this.order.push(o);
      this.group.add(o.group);
      this.sortIn = 0;
    }
    o.health(p.hp ?? 1);
    this.onCount?.(this.list.size);
  }

  moved(id: number, x: number, z: number, yaw: number, _walk: boolean, hp: number, ts?: number) {
    const o = this.list.get(id);
    if (!o) return;
    o.glide.push(x, z, yaw, ts);
    o.health(hp);
  }

  /**
   * A cast of theirs: its look from their figure, at the spot they aimed. Nothing in it counts: no hits, no knock, no walls, no units,
   * nothing on this screen's hero. A spell this screen's own hero also has only shows the pose (the game keeps one effect per spell,
   * and a replay would cut this hero's own cast short), and so does a light stand-in (its look would cost a phone for no one).
   */
  cast(id: number, label: string, x: number, z: number, tx: number, tz: number) {
    const o = this.list.get(id);
    if (!o || o.down) return;
    const kit = o.kit, base = kit.base ?? kit;
    const all = [...base.spells, ...(base.alt?.spells ?? [])];
    const slot = all.findIndex((s) => s.label === label);
    if (slot < 0) return;
    const spell = all[slot], melee = attackFor(kit).kind === 'melee';
    const rt = this.api as GameApi & Partial<Pick<Runtime, 'castAs' | 'slots'>>;
    const spec: TargetingSpec | undefined = rt.slots?.get(label)?.module.targeting;
    const own = this.api.heroMode.currentKit, ownBase = own.base ?? own;
    const mine = [...ownBase.spells, ...(ownBase.alt?.spells ?? [])].some((s) => s.label === label);
    const toEnemy = spec?.mode === 'enemy' || spec?.mode === 'enemies';
    if (!spec || !rt.castAs || mine || o.lite) {
      if (!o.lite) o.figure.cast(castStyle(spell, slot % 4, toEnemy, melee, 0.6), 0.6, slot % 4 === 3);
      return;
    }
    if (o.pos.distanceTo(new THREE.Vector3(x, 0, z)) > SNAP) { o.pos.set(x, 0, z); o.glide.reset(x, z, o.caster.group.rotation.y); }
    const from = o.pos.clone().setY(0);
    o.aim.group.position.set(tx, 0, tz);
    const point = spec.mode === 'self' ? from.clone() : new THREE.Vector3(tx, 0, tz);
    const targets = toEnemy ? [o.aim] : [];
    const ctx = this.api.arena.contextFor({
      caster: o.caster, from, point, targets, enemy: o.aim, targetPos: targets.map((t) => t.group.position.clone()),
      // A spell cast straight ahead (self) goes the way the figure faces: from and point are the same spot, which has no direction.
      aim: spec.mode === 'self' ? o.caster.group.rotation.y : undefined,
      hit: () => {}, displace: () => {}, sentFrom: new THREE.Vector3(x, 0, z),
    });
    ctx.shieldSelf = ctx.healSelf = ctx.moveCaster = ctx.releaseCaster = undefined;
    ctx.summon = undefined;
    ctx.carry = undefined;
    ctx.confine = undefined;
    ctx.boltWall = undefined;
    ctx.addObstacle = undefined;
    ctx.removeObstacle = undefined;
    ctx.enemies = () => targets;
    const zones = rt.castAs(label, ctx);
    const hold = Math.min(zones.length ? Math.max(...zones.map((z) => z.impact)) : 0.5, 2.5);
    o.figure.cast(castStyle(spell, slot % 4, toEnemy, melee, hold), hold, slot % 4 === 3);
  }

  left(id: number) {
    this.remove(id);
    this.onCount?.(this.list.size);
  }

  clear() {
    for (const id of [...this.list.keys()]) if (id >= 0) this.remove(id);
    this.shard = '';
    this.onCount?.(this.list.size);
  }

  private remove(id: number) {
    const o = this.list.get(id);
    if (!o) return;
    this.list.delete(id);
    const i = this.order.indexOf(o);
    if (i >= 0) this.order.splice(i, 1);
    this.group.remove(o.group);
    o.dispose();
    this.fakes = this.fakes.filter((f) => f.o !== o);
  }

  // --- each frame ---------------------------------------------------------------------------------------------------------

  /** `hero`: where this screen's hero stands. `shown`: a zone is on (the others are hidden in a set piece and on the result card). */
  update(dt: number, hero: THREE.Vector3, shown: boolean) {
    this.group.visible = shown && this.list.size > 0;
    if (!shown || !this.list.size) return;
    if (this.fakes.length) this.stepFakes(dt, hero);
    if ((this.sortIn -= dt) <= 0) {
      this.sortIn = SORT_EVERY;
      for (const o of this.order) o.dist = Math.hypot(o.pos.x - hero.x, o.pos.z - hero.z);
      this.order.sort((a, b) => a.dist - b.dist);
      for (let i = 0; i < this.order.length; i++) this.order[i].setLite(i >= FULL);
    }
    for (const o of this.order) o.update(dt);
  }

  dispose() {
    for (const id of [...this.list.keys()]) this.remove(id);
    this.api.duel.group.remove(this.group);
  }

  // --- made-up others, for the speed test ------------------------------------------------------------------------------------

  /**
   * `n` made-up others walking circles of 4 to 12 m round this screen's hero, wherever it goes, through the same path a real one's
   * reports take (ten a second, with their own clock), each casting one of its spells every 3 to 6 s. Their ids are negative, so a
   * real roster never touches them. `fake(0)` takes them away.
   */
  fake(n: number, hero: THREE.Vector3) {
    for (const f of this.fakes.splice(0)) this.remove(f.o.id);
    const kits = this.api.kits.filter((k) => k.model);
    for (let i = 0; i < n; i++) {
      const kit = kits[(i * 7 + 3) % kits.length], r = 4 + (i % 5) * 2, a = (i / Math.max(1, n)) * Math.PI * 2;
      const x = hero.x + Math.cos(a) * r, z = hero.z + Math.sin(a) * r;
      this.joined({ id: -1 - i, name: `Guest ${i + 1}`, hero: kit.name, x, z, yaw: 0, hp: 1 });
      const o = this.list.get(-1 - i);
      if (o) this.fakes.push({ o, cx: hero.x, cz: hero.z, r, w: (i % 2 ? 1 : -1) * (2.6 / r), a, sendIn: (i % 10) / 100, castIn: 2 + (i % 4) });
    }
    this.onCount?.(this.list.size);
  }

  private stepFakes(dt: number, hero: THREE.Vector3) {
    this.fakeT += dt;
    for (const f of this.fakes) {
      f.a += f.w * dt;
      // Round the hero where it is now (the speed test sets it down beside one pack after another).
      f.cx = hero.x;
      f.cz = hero.z;
      if ((f.sendIn -= dt) <= 0) {
        f.sendIn += 0.1;
        const x = f.cx + Math.cos(f.a) * f.r, z = f.cz + Math.sin(f.a) * f.r;
        // Facing along the circle.
        const yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.w), Math.cos(f.a) * Math.sign(f.w));
        this.moved(f.o.id, x, z, yaw, true, 1, this.fakeT * 1000);
      }
      if ((f.castIn -= dt) <= 0) {
        f.castIn = 3 + ((f.o.id * -13) % 4);
        const spells = f.o.kit.spells, s = spells[Math.floor(this.fakeT * 10 + f.o.id * -3) % spells.length];
        if (s) this.cast(f.o.id, s.label, f.o.pos.x, f.o.pos.z, f.o.pos.x + Math.sin(f.o.caster.group.rotation.y) * 6, f.o.pos.z + Math.cos(f.o.caster.group.rotation.y) * 6);
      }
    }
  }
}
