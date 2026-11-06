import { TOUCH } from '../touch';
import type { BossDef } from './types';

/**
 * The boss's bar at the top of the screen: its HP with the phases marked, the move it is casting and at whom, the stagger
 * gauge and its state (exposed, kneeling). Only reads what it is told. Also the whole-screen flash of its biggest moves.
 */
export class BossHud {
  private root = document.createElement('div');
  private name = document.createElement('div');
  private bar = document.createElement('div');
  private fill = document.createElement('div');
  private ticks = document.createElement('div');
  private number = document.createElement('div');
  private gauge = document.createElement('div');
  private gaugeFill = document.createElement('div');
  private castBox = document.createElement('div');
  private castFill = document.createElement('div');
  private castText = document.createElement('div');
  private state = document.createElement('div');
  private flashEl = document.createElement('div');
  private castLeft = 0;
  private castLen = 1;
  private stateLeft = 0;
  private flashV = 0;

  constructor() {
    const small = TOUCH || innerWidth < 760;
    this.root.style.cssText =
      `position:fixed;left:50%;top:calc(${small ? 6 : 12}px + env(safe-area-inset-top, 0px));transform:translateX(-50%);z-index:6;display:none;` +
      `width:min(${small ? '94vw' : '620px'}, calc(100vw - ${small ? 12 : 220}px));box-sizing:border-box;flex-direction:column;gap:3px;pointer-events:none;user-select:none;` +
      'font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;';
    this.name.style.cssText = `display:flex;justify-content:space-between;align-items:baseline;font:700 ${small ? 13 : 15}px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;text-shadow:0 1px 4px #000;`;
    this.state.style.cssText = 'font:800 12px ui-sans-serif,system-ui;letter-spacing:2px;color:#ff9a6a;';
    const nameText = document.createElement('span');
    this.name.append(nameText, this.state);
    this.bar.style.cssText = `position:relative;height:${small ? 12 : 16}px;border-radius:5px;background:#21131a;border:1px solid #6a5a3a;overflow:hidden;box-shadow:0 2px 10px #000a;`;
    this.fill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(180deg,#f2b84a,#b5651d);transition:width 0.12s;';
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
    this.root.append(this.name, this.bar, this.gauge, this.castBox);
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
    this.root.style.display = 'flex';
  }

  setHp(hp: number, max: number) {
    this.fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
    this.number.textContent = `${Math.ceil(hp)} / ${max}`;
  }

  /** The stagger gauge, 0..1. */
  setGauge(share: number) {
    this.gaugeFill.style.width = `${Math.min(1, Math.max(0, share)) * 100}%`;
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
  }
}
