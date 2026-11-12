import { RAID_TWIN } from '../../server/protocol.mjs';
import { TOUCH } from '../touch';
import type { BossDef } from './types';

/**
 * The boss's bar at the top of the screen: its HP with the phases marked, the move it is casting and at whom, the stagger
 * gauge and its state (exposed, kneeling). Only reads what it is told. Also the whole-screen flash of its biggest moves.
 */
const BAR = 'linear-gradient(180deg,#f2b84a,#b5651d)';
const RAGE_BAR = 'linear-gradient(180deg,#ff7a4a,#a8301c)';
/** Twin Flames: how far apart the two HP shares may be before one grows furious, and where it calms again (points, as the hub has them). */
const GAP_ON = RAID_TWIN.gapOn * 100, GAP_OFF = RAID_TWIN.gapOff * 100;

/** One of Twin Flames' two bars. */
interface TwinBar { box: HTMLDivElement; fill: HTMLDivElement; text: HTMLDivElement; key: string }

export class BossHud {
  private root = document.createElement('div');
  private name = document.createElement('div');
  private bar = document.createElement('div');
  private fill = document.createElement('div');
  private ticks = document.createElement('div');
  private number = document.createElement('div');
  private gauge = document.createElement('div');
  private gaugeFill = document.createElement('div');
  /** The enrage timer, in the name's row: a phone has no height to spare under the bar. */
  private rage = document.createElement('div');
  private rageText = '';
  /** Ash's pillars still standing, a pip each, in the name's row too. */
  private pillars = document.createElement('div');
  private pillarsShown = -1;
  private castBox = document.createElement('div');
  private castFill = document.createElement('div');
  private castText = document.createElement('div');
  private state = document.createElement('div');
  private flashEl = document.createElement('div');
  private castLeft = 0;
  private castLen = 1;
  private stateLeft = 0;
  private flashV = 0;
  private arrows: HTMLDivElement[] = [];
  /** Twin Flames: a bar for each of the two, Ash's on the left as he is in the room, and between them how far apart they are. */
  private twinRow = document.createElement('div');
  private twinBars: TwinBar[] = [];
  private twinGap = document.createElement('div');
  private twinNames: [string, string] = ['', ''];
  private twinOn = false;
  private gapKey = '';

  constructor() {
    const small = TOUCH || innerWidth < 760;
    this.root.style.cssText =
      `position:fixed;left:50%;top:calc(${small ? 6 : 12}px + env(safe-area-inset-top, 0px));transform:translateX(-50%);z-index:6;display:none;` +
      `width:min(${small ? '94vw' : '620px'}, calc(100vw - ${small ? 12 : 220}px));box-sizing:border-box;flex-direction:column;gap:3px;pointer-events:none;user-select:none;` +
      'font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;';
    this.name.style.cssText = `display:flex;justify-content:space-between;align-items:baseline;font:700 ${small ? 13 : 15}px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;text-shadow:0 1px 4px #000;`;
    this.state.style.cssText = 'font:800 12px ui-sans-serif,system-ui;letter-spacing:2px;color:#ff9a6a;';
    const nameText = document.createElement('span');
    // A long name gives way to the state word, and stays on one line.
    nameText.style.cssText = 'min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    this.state.style.flex = 'none';
    this.state.style.marginLeft = '8px';
    this.rage.style.cssText = 'flex:none;margin-left:8px;font:700 11px ui-sans-serif,system-ui;letter-spacing:1px;color:#cdbfa6;';
    this.pillars.style.cssText = 'flex:none;display:none;gap:3px;margin-left:8px;align-self:center;';
    this.name.append(nameText, this.pillars, this.rage, this.state);
    this.bar.style.cssText = `position:relative;height:${small ? 12 : 16}px;border-radius:5px;background:#21131a;border:1px solid #6a5a3a;overflow:hidden;box-shadow:0 2px 10px #000a;`;
    this.fill.style.cssText = `position:absolute;inset:0 auto 0 0;width:100%;background:${BAR};transition:width 0.12s;`;
    this.ticks.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.number.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 10px ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 2px #000;';
    this.bar.append(this.fill, this.ticks, this.number);
    this.gauge.style.cssText = 'position:relative;height:4px;border-radius:2px;background:#0009;overflow:hidden;';
    this.gaugeFill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:0;background:#9ad0ff;transition:width 0.1s;';
    this.gauge.append(this.gaugeFill);
    this.castBox.style.cssText = `position:relative;align-self:center;width:min(360px,76%);height:${small ? 15 : 18}px;margin-top:2px;border-radius:4px;background:rgba(8,6,10,0.85);border:1px solid #6a5a3a;overflow:hidden;display:none;`;
    this.castFill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(90deg,#8a4a18,#e8863a);';
    this.castText.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 ${small ? 11 : 12}px ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap;`;
    this.castBox.append(this.castFill, this.castText);
    this.twinRow.style.cssText = 'display:none;align-items:stretch;gap:4px;';
    for (let i = 0; i < 2; i++) {
      const box = document.createElement('div'), fill = document.createElement('div'), ticks = document.createElement('div'), text = document.createElement('div');
      box.style.cssText = `position:relative;flex:1 1 0;min-width:0;height:${small ? 14 : 18}px;border-radius:5px;background:#21131a;border:1px solid #6a5a3a;overflow:hidden;box-shadow:0 2px 10px #000a;`;
      // Each drains toward the wall between them: Ash's from the left, Ember's from the right.
      fill.style.cssText = `position:absolute;top:0;bottom:0;${i === 0 ? 'right' : 'left'}:0;width:100%;background:${BAR};transition:width 0.12s;`;
      ticks.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      text.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 ${small ? 9 : 10}px ui-sans-serif,system-ui;letter-spacing:0.5px;color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap;`;
      box.append(fill, ticks, text);
      this.twinBars.push({ box, fill, text, key: '' });
    }
    this.twinGap.style.cssText = `flex:none;display:flex;align-items:center;justify-content:center;min-width:${small ? 46 : 78}px;padding:0 4px;border-radius:5px;background:rgba(8,6,10,0.85);border:1px solid #6a5a3a;font:800 ${small ? 9 : 11}px ui-sans-serif,system-ui;letter-spacing:0.5px;white-space:nowrap;`;
    this.twinRow.append(this.twinBars[0].box, this.twinGap, this.twinBars[1].box);
    this.root.append(this.name, this.bar, this.twinRow, this.gauge, this.castBox);
    this.flashEl.style.cssText = 'position:fixed;inset:0;z-index:7;pointer-events:none;opacity:0;';
    document.body.append(this.root, this.flashEl);
  }

  /** Shows the bar for `def`, with its phases marked. */
  show(def: BossDef) {
    (this.name.firstChild as HTMLElement).textContent = `${def.name} · ${def.title}`;
    this.ticks.replaceChildren(...def.phases.slice(1).map((p) => {
      const t = document.createElement('div');
      t.style.cssText = `position:absolute;top:0;bottom:0;left:${p.at * 100}%;width:2px;background:#0009;box-shadow:0 0 0 1px #ffd27a55;`;
      return t;
    }));
    this.castLeft = this.stateLeft = this.flashV = 0;
    this.castBox.style.display = 'none';
    this.state.textContent = '';
    this.gaugeFill.style.width = '0';
    this.flashEl.style.opacity = '0';
    this.rageText = this.rage.textContent = '';
    this.pillarsShown = -1;
    this.pillars.style.display = 'none';
    this.fill.style.background = BAR;
    this.twinOn = false;
    this.twinRow.style.display = 'none';
    this.bar.style.display = '';
    this.root.style.display = 'flex';
  }

  /**
   * Twin Flames: two bars in place of the one, with each one's phases marked (`marks`: the HP shares where they begin), and
   * between them how far apart their health is. Call after `show`.
   */
  showTwin(names: [string, string], marks: number[]) {
    this.twinOn = true;
    this.twinNames = names;
    (this.name.firstChild as HTMLElement).textContent = `Twin Flames · ${names[0]} and ${names[1]}`;
    this.bar.style.display = 'none';
    this.twinRow.style.display = 'flex';
    this.gapKey = '';
    this.twinBars.forEach((b, i) => {
      b.key = '';
      (b.box.children[1] as HTMLElement).replaceChildren(...marks.map((at) => {
        const t = document.createElement('div');
        t.style.cssText = `position:absolute;top:0;bottom:0;${i === 0 ? 'right' : 'left'}:${at * 100}%;width:2px;background:#0009;box-shadow:0 0 0 1px #ffd27a55;`;
        return t;
      }));
    });
  }

  /**
   * Twin Flames, each frame: both bars and the gap. `mine`: which of them is this screen's enemy (its bar has the bright edge).
   * The gap turns amber past where a fury ends and red past where one begins; the arrow points at the one with more health, the
   * one that grows furious if it is left behind.
   */
  setTwin(o: { mine: number; hp: [number, number]; max: [number, number]; furious: number; dead: [boolean, boolean] }) {
    if (!this.twinOn) return;
    const share = o.hp.map((hp, i) => (o.dead[i] ? 0 : Math.max(0, hp / (o.max[i] || 1))));
    this.twinBars.forEach((b, i) => {
      const pct = Math.ceil(share[i] * 100), fury = o.furious === i && !o.dead[i];
      const key = `${pct}|${fury}|${o.dead[i]}|${o.mine === i}`;
      if (key === b.key) return;
      b.key = key;
      b.fill.style.width = `${share[i] * 100}%`;
      b.fill.style.background = fury ? RAGE_BAR : BAR;
      b.box.style.borderColor = o.dead[i] ? '#3a3440' : o.mine === i ? '#ffd27a' : '#6a5a3a';
      b.box.style.opacity = o.dead[i] ? '0.55' : '1';
      b.text.textContent = o.dead[i] ? `${this.twinNames[i]} has fallen` : `${this.twinNames[i].toUpperCase()}${fury ? ' · FURIOUS' : ''} ${pct}%`;
    });
    const one = o.dead[0] || o.dead[1];
    const gap = Math.round(Math.abs(share[0] - share[1]) * 100), ahead = share[0] > share[1] ? 0 : 1;
    const key = one ? 'one' : `${gap}|${ahead}`;
    if (key === this.gapKey) return;
    this.gapKey = key;
    if (one) {
      this.twinGap.textContent = 'WALL OUT';
      this.twinGap.style.color = '#ff9a6a';
      return;
    }
    const small = TOUCH || innerWidth < 760;
    this.twinGap.textContent = gap === 0 ? 'LEVEL' : `${ahead === 0 ? '◀ ' : ''}${gap}${small ? '' : ' APART'}${ahead === 1 ? ' ▶' : ''}`;
    this.twinGap.style.color = gap > GAP_ON ? '#ff6a4a' : gap > GAP_OFF ? '#ffb060' : '#cdbfa6';
    this.twinGap.title = `Their health is ${gap} points apart. Over ${GAP_ON} and the one with more grows furious, until they are within ${GAP_OFF} again.`;
  }

  /** How many of the room's pillars still stand, of `total`: pale blue pips, red once one is left. */
  setPillars(left: number, total: number) {
    const key = left * 100 + total;
    if (key === this.pillarsShown) return;
    this.pillarsShown = key;
    this.pillars.style.display = total > 0 ? 'flex' : 'none';
    const on = left <= 1 ? '#ff7a5a' : '#8fe4ff';
    this.pillars.replaceChildren(...Array.from({ length: total }, (_, i) => {
      const pip = document.createElement('div');
      pip.style.cssText = `width:7px;height:11px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:${i < left ? on : '#3a3440'};`;
      return pip;
    }));
    this.pillars.title = `${left} of ${total} pillars standing`;
  }

  setHp(hp: number, max: number) {
    this.fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
    this.number.textContent = `${Math.ceil(hp)} / ${max}`;
  }

  /** The stagger gauge, 0..1. */
  setGauge(share: number) {
    this.gaugeFill.style.width = `${Math.min(1, Math.max(0, share)) * 100}%`;
  }

  /** The enrage timer: seconds left, or 0 once it has enraged (and the bar turns red). */
  setRage(left: number) {
    const s = Math.ceil(left);
    const text = left > 0 ? `ENRAGE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'ENRAGED';
    if (text === this.rageText) return;
    this.rageText = this.rage.textContent = text;
    this.rage.style.color = left <= 0 ? '#ff6a4a' : left <= 30 ? '#ffa070' : '#cdbfa6';
    this.fill.style.background = left <= 0 ? RAGE_BAR : BAR;
  }

  /** The cast bar goes (a stage won early). */
  stopCast() {
    this.castLeft = 0;
    this.castBox.style.display = 'none';
  }

  /** A move starts: its name fills the cast bar over `seconds`. */
  cast(name: string, seconds: number) {
    this.castLen = this.castLeft = Math.max(0.1, seconds);
    this.castText.textContent = name;
    this.castBox.style.display = '';
  }

  /** A word beside its name for a while: EXPOSED, KNEELING. */
  setState(text: string, seconds: number) {
    this.state.textContent = text;
    this.stateLeft = seconds;
  }

  flash(color: string, strength: number) {
    this.flashEl.style.background = color;
    this.flashV = Math.max(this.flashV, strength);
    this.flashEl.style.opacity = String(this.flashV);
  }

  /**
   * The fight is over and nothing here updates any more: the bar at its last, and nothing left half way. A flash doesn't stay
   * over the result card.
   */
  settle(won: boolean, max: number) {
    if (won) this.setHp(0, max);
    this.castLeft = this.stateLeft = this.flashV = 0;
    this.castBox.style.display = 'none';
    this.state.textContent = '';
    this.flashEl.style.opacity = '0';
    this.pointTo([]);
  }

  /**
   * Arrows at the edge of what the bars and buttons leave free, toward what is worth running to and can't be seen. A phone held
   * upright sees a slice of the floor. `x, y`: where it is on the screen, -1 to 1.
   */
  pointTo(list: { x: number; y: number; color: string }[]) {
    const w = innerWidth, h = innerHeight, small = TOUCH || w < 760;
    const left = 26, right = w - 26, top = small ? 150 : 110, bottom = h - (TOUCH ? 225 : 150);
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    let used = 0;
    for (const p of list) {
      const sx = ((p.x + 1) / 2) * w, sy = ((1 - p.y) / 2) * h;
      if (sx >= left && sx <= right && sy >= top && sy <= bottom) continue;
      const dx = sx - cx, dy = sy - cy;
      const k = Math.min(dx ? ((dx > 0 ? right : left) - cx) / dx : Infinity, dy ? ((dy > 0 ? bottom : top) - cy) / dy : Infinity);
      const arrow = this.arrows[used] ?? this.newArrow();
      used++;
      arrow.style.display = '';
      arrow.style.background = p.color;
      arrow.style.transform = `translate(${cx + dx * k}px,${cy + dy * k}px) translate(-50%,-50%) rotate(${Math.atan2(dx, -dy)}rad)`;
    }
    for (let i = used; i < this.arrows.length; i++) this.arrows[i].style.display = 'none';
  }

  private newArrow() {
    const arrow = document.createElement('div');
    arrow.style.cssText =
      'position:fixed;left:0;top:0;z-index:6;width:34px;height:34px;pointer-events:none;display:none;' +
      'clip-path:polygon(50% 0,100% 100%,50% 72%,0 100%);filter:drop-shadow(0 0 6px #000);';
    document.body.append(arrow);
    this.arrows.push(arrow);
    return arrow;
  }

  update(dt: number) {
    if (this.castLeft > 0) {
      this.castLeft -= dt;
      this.castFill.style.width = `${(1 - Math.max(0, this.castLeft) / this.castLen) * 100}%`;
      if (this.castLeft <= 0) this.castBox.style.display = 'none';
    }
    if (this.stateLeft > 0) {
      this.stateLeft -= dt;
      if (this.stateLeft <= 0) this.state.textContent = '';
    }
    if (this.flashV > 0) {
      this.flashV = Math.max(0, this.flashV - dt * 1.4);
      this.flashEl.style.opacity = String(this.flashV);
    }
  }

  hide() {
    this.root.style.display = 'none';
    this.flashEl.style.opacity = '0';
    this.pointTo([]);
  }
}
