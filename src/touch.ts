/**
 * Phone and tablet controls for hero mode: a floating joystick on the left of the screen walks the hero, the spell
 * slots double as aim buttons (tap: cast at the nearest enemy, drag: aim, drag back onto the button: cancel), a
 * round attack button attacks the nearest enemy, and two fingers on the scene pinch the camera zoom.
 * Docs: docs/architecture/hero-mode.md (Touch controls).
 */

/**
 * Touch layout on: the device's main pointer is a finger (phones, tablets; a touch laptop with a mouse stays on
 * the desktop layout). `?touch=1` in the URL forces it, `?touch=0` turns it off.
 */
export const TOUCH = (() => {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(location.search).get('touch');
  if (q !== null) return q !== '0';
  return matchMedia('(pointer: coarse)').matches;
})();

/** What the touch controls drive (HeroMode implements it). */
export interface TouchTarget {
  /** Walks toward a screen direction (px right, px down; length 0..1 is the stick's push), or stops on null. */
  steer(dx: number, dy: number, push: number): void;
  stopSteer(): void;
  /** A tap on the scene at client coordinates (walk there, or attack the enemy there). */
  tapAt(x: number, y: number): void;
  /** Starts aiming slot `i`; false if it can't be aimed (cooldown, silence) or it went off at once (self cast). */
  aimPress(i: number): boolean;
  /** The aim follows a screen drag (px right, px down) of `f` 0..1 of the full pull; null aims at the nearest enemy. */
  aimDrag(dx: number, dy: number, f: number): void;
  aimAuto(): void;
  /** Releases the aim: casts it, or drops it when `cancel`. */
  aimEnd(cancel: boolean): void;
  /** Multiplies the camera zoom (pinch). */
  zoomBy(f: number): void;
}

/** Pixels of drag that count as a full pull of the stick or the aim. */
const STICK = 56;
const AIM_PULL = 120;
/** Below this many pixels a press is a tap (no drag). */
const TAP = 12;

/** The left-side joystick: appears where the thumb lands, walks the hero while held. A short tap is a tap-to-move. */
export class Joystick {
  readonly el: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private id = -1;
  private ox = 0;
  private oy = 0;
  private moved = false;
  private t0 = 0;

  constructor(private target: TouchTarget, accent: string) {
    this.el = document.createElement('div');
    // The lower-left of the screen (above the safe area); taps elsewhere go to the scene.
    this.el.style.cssText =
      'position:fixed;left:0;bottom:0;width:48vw;height:62vh;z-index:5;touch-action:none;pointer-events:auto;';
    this.base = document.createElement('div');
    this.base.style.cssText =
      `position:absolute;width:${STICK * 2}px;height:${STICK * 2}px;margin:-${STICK}px 0 0 -${STICK}px;border-radius:50%;` +
      `border:2px solid color-mix(in srgb, ${accent} 60%, #fff);background:radial-gradient(circle, rgba(0,0,0,0.05), rgba(0,0,0,0.32));` +
      'pointer-events:none;opacity:0.35;transition:opacity 0.15s;';
    this.knob = document.createElement('div');
    this.knob.style.cssText =
      `position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;` +
      `background:color-mix(in srgb, ${accent} 70%, #fff);box-shadow:0 2px 10px rgba(0,0,0,0.5);opacity:0.85;`;
    this.base.appendChild(this.knob);
    this.el.appendChild(this.base);
    this.rest();

    this.el.addEventListener('pointerdown', (e) => {
      if (this.id >= 0) return;
      e.preventDefault();
      try { this.el.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no live pointer */ }
      this.id = e.pointerId;
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.moved = false;
      this.t0 = performance.now();
      this.place(e.clientX, e.clientY);
      this.base.style.opacity = '1';
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.id) return;
      let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
      const len = Math.hypot(dx, dy);
      if (len > TAP) this.moved = true;
      if (!this.moved) return;
      if (len > STICK) { dx *= STICK / len; dy *= STICK / len; }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.target.steer(dx, dy, Math.min(1, len / STICK));
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      this.id = -1;
      if (this.moved) this.target.stopSteer();
      else if (performance.now() - this.t0 < 350) this.target.tapAt(e.clientX, e.clientY);
      this.rest();
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  /** Lets go (a round ended, hero mode off). */
  release() {
    if (this.id >= 0 && this.moved) this.target.stopSteer();
    this.id = -1;
    this.rest();
  }

  private place(x: number, y: number) {
    const r = this.el.getBoundingClientRect();
    this.base.style.left = `${x - r.left}px`;
    this.base.style.top = `${y - r.top}px`;
    this.knob.style.transform = '';
  }

  /** The idle hint: a faint stick in the lower-left corner (the zone's own size, so it works before layout). */
  private rest() {
    this.base.style.left = `${Math.min(110, innerWidth * 0.16) + 20}px`;
    this.base.style.top = `calc(100% - ${STICK + 40}px - env(safe-area-inset-bottom, 0px))`;
    this.knob.style.transform = '';
    this.base.style.opacity = '0.35';
  }
}

/**
 * Turns a slot button into an aim button: press starts the aim (holding charges a hold slot), dragging aims away
 * from the button, releasing casts; dragging out and back onto the button cancels. A press without a drag casts
 * at the nearest enemy.
 */
export function aimButton(box: HTMLElement, slot: number, target: TouchTarget) {
  let id = -1, ox = 0, oy = 0, dragged = false;
  box.style.touchAction = 'none';
  box.addEventListener('pointerdown', (e) => {
    if (id >= 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!target.aimPress(slot)) return;
    try { box.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no live pointer */ }
    id = e.pointerId;
    const r = box.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
    dragged = false;
    target.aimAuto();
  });
  box.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - ox, dy = e.clientY - oy, len = Math.hypot(dx, dy);
    if (len > TAP + box.offsetWidth / 2) dragged = true;
    if (!dragged) return;
    target.aimDrag(dx, dy, Math.min(1, len / AIM_PULL));
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    const r = box.getBoundingClientRect();
    const back = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    target.aimEnd(e.type === 'pointercancel' || (dragged && back));
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

/** Two fingers on `dom` pinch the camera zoom. Returns the number of fingers down (a scene tap ignores pinches). */
export function pinchZoom(dom: HTMLElement, target: TouchTarget) {
  const pts = new Map<number, { x: number; y: number }>();
  let last = 0;
  const spread = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  dom.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) last = spread();
  });
  dom.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size !== 2) return;
    const s = spread();
    if (last > 0 && s > 0) target.zoomBy(last / s);
    last = s;
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); last = 0; };
  dom.addEventListener('pointerup', up);
  dom.addEventListener('pointercancel', up);
  return () => pts.size;
}
