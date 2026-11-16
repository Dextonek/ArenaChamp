import * as THREE from 'three';
import { RING } from '../../arenas/common';
import type { GameApi } from '../../runtime';
import { TOUCH } from '../../touch';
import type { FloorDef, Spot } from './def';
import type { WorldOthers } from './others';
import type { Zone } from './world';

/**
 * The floor's map (the user, 2026-11-14: "let's make a small minimap at top left", "also M for map"): a round minimap in the top-left
 * corner that follows the hero, and the whole floor on a big map that M (or a tap on the minimap) opens and closes.
 *
 * What it shows is the floor itself, seen from straight above: once a zone is built and its fight compiled (`whenReady`, behind the
 * loading page), the scene is drawn once from above into a small target (an orthographic camera turned as the game's camera is, so
 * the map's up is the screen's up), read back and kept as a picture (about 10 ms to draw and 40 to 70 ms to read back, once a zone).
 * Fog is pushed out of the way rather than switched off, and the target is the composer's kind (half floats, no colour space), so no
 * shader is compiled again for it; the tone curve and sRGB are applied here, as the output pass does.
 *
 * Over it, a few times a second: the hero (an arrow, its facing), the packs still standing (red; brighter awake, at their units), the
 * people (gold), the doors (a gold square), the waystones (blue), the tracked quest step (a gold star; on the minimap at its edge when
 * outside) and the others on the floor (green). The big map adds the places' names and a key.
 *
 * Only for a person playing (`mode: 'play'`): the route bot's runs draw nothing.
 */

const SNAP = 512;
/** The minimap's view across (m) and its size on the screen (px). */
const VIEW = 60;
const small = () => TOUCH || innerWidth < 760;
export const miniSize = () => (small() ? 104 : 150);
/** How far the minimap pushes the boxes under it down (px). */
export const miniRoom = () => miniSize() + (small() ? 8 : 12);

const COL = {
  hero: '#ffffff', heroEdge: '#3a2a10', pack: '#ff5a4a', packSleep: '#b04a3e', person: '#ffd27a', door: '#ffd27a', way: '#8cc4ff',
  quest: '#ffd27a', other: '#7cf09a', edge: 'rgba(255,210,122,0.85)',
};

let toneLut: Uint8Array | null = null;
/** Half float -> 8-bit sRGB through ACES (the renderer's tone mapping), once a page. */
function lut(exposure: number) {
  if (toneLut) return toneLut;
  const t = new Uint8Array(65536);
  const aces = (v: number) => {
    // Three's ACESFilmicToneMapping, for one channel (the input and output matrices left out: they mix the channels a little).
    v *= exposure / 0.6;
    const a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.432951) + 0.238081;
    return Math.min(1, Math.max(0, a / b));
  };
  const enc = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  for (let i = 0; i < 65536; i++) {
    const f = THREE.DataUtils.fromHalfFloat(i);
    t[i] = Number.isFinite(f) && f > 0 ? Math.round(255 * enc(aces(f))) : 0;
  }
  return (toneLut = t);
}

export class WorldMap {
  private mini = document.createElement('div');
  private miniCanvas = document.createElement('canvas');
  private big = document.createElement('div');
  private bigCanvas = document.createElement('canvas');
  private bigTitle = document.createElement('div');
  private room = document.createElement('style');
  /** The floor from above, and the frame it was taken in. */
  private pic: HTMLCanvasElement | null = null;
  private frame: { cx: number; cz: number; half: number; fx: number; fz: number } | null = null;
  private zone: Zone | null = null;
  private floor: FloorDef | null = null;
  private wait = 0;
  private gen = 0;
  private time = 0;
  private open = false;
  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!this.pic && !this.open) return;
      this.toggle();
      e.preventDefault();
    } else if (e.code === 'Escape' && this.open) {
      this.toggle(false);
      e.stopPropagation();
    }
  };

  constructor(private api: GameApi, private others: WorldOthers) {
    const s = miniSize();
    this.mini.className = 'world-minimap';
    this.mini.title = 'Map (M)';
    // Over the people's marks (7) that walk under it as the camera moves, under the banner (9), the cards (10) and the big map (11).
    this.mini.style.cssText =
      `position:fixed;left:${small() ? 6 : 12}px;top:calc(${small() ? 6 : 12}px + env(safe-area-inset-top, 0px));z-index:8;width:${s}px;height:${s}px;` +
      'border-radius:50%;border:2px solid #8a7a52;box-shadow:0 2px 10px #000a;background:#0e0b0c;display:none;' +
      'cursor:pointer;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;';
    this.miniCanvas.style.cssText = 'width:100%;height:100%;display:block;border-radius:50%;';
    this.mini.append(this.miniCanvas);
    if (!TOUCH) {
      const key = document.createElement('div');
      key.textContent = 'M';
      key.style.cssText = 'position:absolute;right:-3px;bottom:-1px;width:17px;height:17px;border-radius:4px;background:rgba(14,11,12,0.9);border:1px solid #8a7a52;color:#ffd27a;font:700 10px/17px ui-sans-serif,system-ui;text-align:center;pointer-events:none;';
      this.mini.append(key);
    }
    this.mini.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(true); });
    this.mini.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.big.className = 'world-bigmap';
    this.big.style.cssText = 'position:fixed;inset:0;z-index:11;display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:rgba(4,3,6,0.72);touch-action:manipulation;';
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 10px 8px;border-radius:14px;background:rgba(14,11,12,0.95);border:2px solid #8a7a52;box-shadow:0 8px 40px #000;max-width:calc(100vw - 12px);box-sizing:border-box;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;';
    this.bigTitle.style.cssText = 'flex:1;font:700 17px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close the map');
    close.style.cssText = 'background:none;border:0;color:#a89870;font:700 26px/1 ui-sans-serif,system-ui;cursor:pointer;padding:0 4px;min-width:44px;min-height:36px;touch-action:manipulation;';
    close.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(false); });
    head.append(this.bigTitle, close);
    this.bigCanvas.style.cssText = 'display:block;border-radius:10px;';
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;font:600 11px ui-sans-serif,system-ui;color:#c8bca0;';
    const item = (c: string, shape: string, label: string) => {
      const e = document.createElement('span');
      e.innerHTML = `<span style="color:${c};font-size:13px">${shape}</span> ${label}`;
      return e;
    };
    legend.append(item(COL.hero, '▲', 'You'), item(COL.quest, '★', 'Quest'), item(COL.person, '●', 'People'), item(COL.pack, '●', 'Enemies'),
      item(COL.door, '■', 'Doors'), item(COL.way, '◆', 'Waystones'), item(COL.other, '●', 'Other players'));
    const hint = document.createElement('div');
    hint.style.cssText = 'font:500 11px ui-sans-serif,system-ui;color:#8a7e66;';
    hint.textContent = TOUCH ? 'Tap anywhere to close' : 'M or Esc to close';
    box.append(head, this.bigCanvas, legend, hint);
    box.addEventListener('click', (e) => e.stopPropagation());
    this.big.append(box);
    this.big.addEventListener('click', () => this.toggle(false));
    this.big.addEventListener('pointerdown', (e) => e.stopPropagation());

    // The boxes under the minimap step down while it shows: the Climb's own (hud.ts), the hero's bar in a boss fight (desktop)
    // and the hero's plate (a phone).
    const r = miniRoom();
    this.room.textContent =
      `body.world-map-on .duel-hud[data-corner="left"]{top:calc(${86 + r}px + env(safe-area-inset-top, 0px)) !important}` +
      `body.world-map-on .hero-plate{top:calc(${78 + r}px + env(safe-area-inset-top, 0px)) !important}` +
      `body.world-map-on .world-hud{top:calc(${(small() ? 182 : 150) + r}px + env(safe-area-inset-top, 0px)) !important}`;
    document.head.append(this.room);
    document.body.append(this.mini, this.big);
    addEventListener('keydown', this.onKey, true);
  }

  get shown() {
    return this.mini.style.display !== 'none';
  }
  get isOpen() {
    return this.open;
  }

  /** A zone was built (or put away: null). The picture is taken once its fight is compiled. */
  setZone(zone: Zone | null, floor: FloorDef | null) {
    this.zone = zone;
    this.floor = floor;
    this.pic = null;
    this.frame = null;
    this.toggle(false);
    this.show(false);
    const gen = ++this.gen;
    if (!zone || !floor) return;
    this.bigTitle.textContent = floor.name;
    const duel = this.api.duel as unknown as { whenReady?(ms?: number): Promise<unknown> };
    void (duel.whenReady?.() ?? Promise.resolve()).then(() => {
      // Two frames more: the zone's first frame places what it places.
      this.wait = 2;
      this.pending = gen;
    });
  }
  private pending = -1;
  private acc = 1;

  private show(on: boolean) {
    this.mini.style.display = on ? '' : 'none';
    document.body.classList.toggle('world-map-on', on);
  }

  toggle(on = !this.open) {
    if (on && !this.pic) return;
    this.open = on;
    this.big.style.display = on ? 'flex' : 'none';
    if (on) this.draw(this.bigCanvas, true);
  }

  /** Once a frame. `live`: the zone is on (not a door's piece, not the result). */
  update(dt: number, live: boolean) {
    if (this.pending === this.gen && this.zone && (this.wait -= 1) < 0) {
      this.pending = -1;
      this.snap();
    }
    const on = live && !!this.pic;
    if (on !== this.shown) this.show(on);
    if (!on) { if (this.open) this.toggle(false); return; }
    this.time += dt;
    // Ten times a second is enough for a map.
    if ((this.acc += dt) < 0.1) return;
    this.acc = 0;
    this.draw(this.miniCanvas, false);
    if (this.open) this.draw(this.bigCanvas, true);
  }

  /** The floor from straight above, once. */
  private snap() {
    const api = this.api, floor = this.floor!;
    const rt0 = api as unknown as { renderer?: THREE.WebGLRenderer; camera?: THREE.Camera };
    const renderer = rt0.renderer, scene = api.duel.group.parent as THREE.Scene | null;
    if (!renderer || !scene) return;
    const b = api.arena.bounds ?? { x: RING.x, z: RING.z, r: floor.ring };
    const half = b.r + 4;
    // The map's up is the game camera's forward on the ground.
    const cam = rt0.camera ?? null;
    const f = new THREE.Vector3(0, 0, -1);
    if (cam) { cam.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize(); }
    const o = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 400);
    o.up.set(f.x, 0, f.z);
    o.position.set(b.x, 70, b.z);
    o.lookAt(b.x, 0, b.z);
    o.updateMatrixWorld();
    if (cam) o.layers.mask = cam.layers.mask;
    const rt = new THREE.WebGLRenderTarget(SNAP, SNAP, { type: THREE.HalfFloatType });
    const fog = scene.fog as (THREE.Fog & THREE.FogExp2) | null;
    const was = fog ? { near: fog.near, far: fog.far, density: fog.density } : null;
    if (fog) { if ((fog as THREE.FogExp2).isFogExp2) fog.density = 0; else { fog.near = 1e5; fog.far = 2e5; } }
    const hero = api.arena.caster.group, heroWas = hero.visible;
    hero.visible = false;
    const rtWas = renderer.getRenderTarget();
    const half16 = new Uint16Array(SNAP * SNAP * 4);
    try {
      renderer.setRenderTarget(rt);
      renderer.render(scene, o);
      renderer.readRenderTargetPixels(rt, 0, 0, SNAP, SNAP, half16);
    } finally {
      renderer.setRenderTarget(rtWas);
      if (fog && was) { fog.near = was.near; fog.far = was.far; fog.density = was.density; }
      hero.visible = heroWas;
      rt.dispose();
    }
    const t = lut(renderer.toneMappingExposure ?? 1);
    const pic = document.createElement('canvas');
    pic.width = pic.height = SNAP;
    const g = pic.getContext('2d')!;
    const img = g.createImageData(SNAP, SNAP), d = img.data;
    for (let y = 0; y < SNAP; y++) {
      // The target's first row is the picture's bottom.
      let src = (SNAP - 1 - y) * SNAP * 4, dst = y * SNAP * 4;
      for (let x = 0; x < SNAP; x++, src += 4, dst += 4) {
        d[dst] = t[half16[src]]; d[dst + 1] = t[half16[src + 1]]; d[dst + 2] = t[half16[src + 2]]; d[dst + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Past the walk's circle: darker, so the floor's own ground stands out.
    g.save();
    g.fillStyle = 'rgba(6,5,8,0.5)';
    g.beginPath();
    g.rect(0, 0, SNAP, SNAP);
    g.arc(SNAP / 2, SNAP / 2, (b.r / half) * (SNAP / 2), 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.restore();
    this.pic = pic;
    this.frame = { cx: b.x, cz: b.z, half, fx: f.x, fz: f.z };
  }

  /** World (x, z) to the picture's 0..1 (u right, v down). */
  private uv(x: number, z: number) {
    const fr = this.frame!, dx = x - fr.cx, dz = z - fr.cz;
    // right = forward x up = (-fz, fx)
    return { u: 0.5 + (dx * -fr.fz + dz * fr.fx) / (2 * fr.half), v: 0.5 - (dx * fr.fx + dz * fr.fz) / (2 * fr.half) };
  }

  private draw(cv: HTMLCanvasElement, whole: boolean) {
    const pic = this.pic, fr = this.frame, zone = this.zone, floor = this.floor;
    if (!pic || !fr || !zone || !floor) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const css = whole ? Math.round(Math.min(innerWidth - 32, innerHeight - (small() ? 150 : 170), 640)) : miniSize();
    const px = Math.round(css * dpr);
    if (cv.width !== px) { cv.width = cv.height = px; cv.style.width = cv.style.height = `${css}px`; }
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    const hero = this.api.arena.caster.group.position;
    // The window on the picture: the whole floor, or VIEW m round the hero.
    const me = this.uv(hero.x, hero.z);
    const span = whole ? 1 : VIEW / (2 * fr.half);
    const u0 = whole ? 0 : me.u - span / 2, v0 = whole ? 0 : me.v - span / 2;
    const toPx = (u: number, v: number) => ({ x: ((u - u0) / span) * px, y: ((v - v0) / span) * px });
    g.imageSmoothingEnabled = true;
    g.fillStyle = '#0e0b0c';
    g.fillRect(0, 0, px, px);
    g.drawImage(pic, u0 * SNAP, v0 * SNAP, span * SNAP, span * SNAP, 0, 0, px, px);
    const k = px / (whole ? 420 : 150); // marks' size: about the same on both maps
    const at = (s: Spot) => { const p = this.uv(s.x, s.z); return toPx(p.u, p.v); };
    const inside = (p: { x: number; y: number }, m = 0) => p.x > -m && p.y > -m && p.x < px + m && p.y < px + m;
    const dot = (p: { x: number; y: number }, r: number, fill: string, edge = 'rgba(0,0,0,0.8)') => {
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1, r * 0.35); g.strokeStyle = edge; g.stroke();
    };
    const diamond = (p: { x: number; y: number }, r: number, fill: string) => {
      g.beginPath(); g.moveTo(p.x, p.y - r); g.lineTo(p.x + r, p.y); g.lineTo(p.x, p.y + r); g.lineTo(p.x - r, p.y); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1, r * 0.3); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.stroke();
    };
    const star = (p: { x: number; y: number }, r: number, fill: string) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1, r * 0.22); g.strokeStyle = '#3a2a10'; g.stroke();
    };
    // A name is kept inside the picture, and steps down or up a line when it would cover one already written (two doors by a camp).
    const taken: number[][] = [];
    const label = (p: { x: number; y: number }, text: string, color: string, dy: number) => {
      g.font = `700 ${Math.round(11 * dpr)}px ui-sans-serif,system-ui`;
      g.textAlign = 'center';
      const hw = g.measureText(text).width / 2 + 2 * dpr, x = Math.max(hw, Math.min(px - hw, p.x)), line = 13 * dpr;
      const box = (y: number) => [x - hw, y - 10 * dpr, x + hw, y + 3 * dpr];
      const cover = (b: number[]) => taken.reduce((s, t) => s + Math.max(0, Math.min(b[2], t[2]) - Math.max(b[0], t[0])) * Math.max(0, Math.min(b[3], t[3]) - Math.max(b[1], t[1])), 0);
      const y0 = Math.max(12 * dpr, Math.min(px - 5 * dpr, p.y + dy));
      let y = y0, least = cover(box(y));
      for (const k of [1, -1, 2, -2, 3, -3]) { if (least === 0) break; const at = y0 + k * line, c = cover(box(at)); if (c < least && at >= 12 * dpr && at <= px - 5 * dpr) { y = at; least = c; } }
      taken.push(box(y));
      g.lineWidth = 3 * dpr;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(text, x, y);
      g.fillStyle = color;
      g.fillText(text, x, y);
    };

    // Waystones and doors.
    for (const w of floor.waystones) { const p = at(w.at); if (inside(p, 8)) diamond(p, 4.2 * k, COL.way); }
    for (const d of floor.doors) {
      const p = at(d.at);
      if (!inside(p, 8)) continue;
      const r = 4.2 * k;
      g.fillStyle = COL.door; g.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
      g.lineWidth = Math.max(1, r * 0.35); g.strokeStyle = '#3a2a10'; g.strokeRect(p.x - r, p.y - r, 2 * r, 2 * r);
    }
    // People.
    for (const pe of floor.people) { const p = at(pe.at); if (inside(p, 8)) dot(p, 3.6 * k, COL.person, '#3a2a10'); }
    // Packs still standing: their units when awake, else where they are.
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    for (const pk of zone.packs.values()) {
      if (pk.state === 'cleared' || pk.left === 0 || pk.off) continue;
      const units = pk.state === 'awake' || pk.state === 'leashed' ? pk.units : [];
      if (units.length) for (const u of units) { const p = at(u.pos); if (inside(p, 6)) dot(p, (2.4 + pulse * 0.8) * k, COL.pack); }
      else { const p = at(pk.home); if (inside(p, 6)) dot(p, 3.4 * k, COL.packSleep); }
    }
    // The others on the floor.
    this.others.forEachPlace((x, z) => { const p = at({ x, z }); if (inside(p, 6)) dot(p, 3.2 * k, COL.other); });
    // The tracked quest step: a star, or on the minimap's edge a small one pointing the way.
    const tg = zone.quests?.target() ?? null;
    if (tg) {
      const p = at(tg);
      const c = px / 2, rim = px / 2 - 9 * k;
      const dx = p.x - c, dy = p.y - c, dist = Math.hypot(dx, dy);
      if (whole || dist <= rim) star(p, (6 + pulse * 1.2) * k, COL.quest);
      else star({ x: c + (dx / dist) * rim, y: c + (dy / dist) * rim }, (6.5 + pulse) * k, COL.quest);
    }
    // The names last but the hero, so no mark covers them: the places' a little under their middle, the doors' over theirs.
    if (whole) {
      for (const pl of Object.values(floor.places)) label(at(pl), pl.name, '#f2e6c8', 15 * dpr);
      for (const d of floor.doors) label(at(d.at), d.name, COL.door, -8 * dpr);
    }
    // The hero: an arrow its way (the figure faces +z turned by its yaw).
    {
      const p = at(hero);
      const yaw = this.api.arena.caster.group.rotation.y;
      const wx = Math.sin(yaw), wz = Math.cos(yaw);
      // The facing in the picture's frame: right = (-fz, fx), up = (fx, fz).
      const sx = wx * -fr.fz + wz * fr.fx, sy = -(wx * fr.fx + wz * fr.fz);
      const a = Math.atan2(sy, sx), r = 7 * k;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(a);
      g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.75, r * 0.7); g.lineTo(-r * 0.35, 0); g.lineTo(-r * 0.75, -r * 0.7); g.closePath();
      g.fillStyle = COL.hero; g.fill(); g.lineWidth = Math.max(1.2, r * 0.22); g.strokeStyle = COL.heroEdge; g.stroke();
      g.restore();
    }
    if (!whole) {
      // A soft ring inside the round frame.
      const grad = g.createRadialGradient(px / 2, px / 2, px * 0.36, px / 2, px / 2, px * 0.5);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = grad;
      g.fillRect(0, 0, px, px);
    }
  }

  dispose() {
    removeEventListener('keydown', this.onKey, true);
    this.show(false);
    this.mini.remove();
    this.big.remove();
    this.room.remove();
  }
}
