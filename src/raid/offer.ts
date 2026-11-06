import type { Upgrade } from './upgrades';

/**
 * The pick between fights: three upgrades and a clock. Time running out takes the first, so nobody holds the run up. Big
 * cards in a column that also works on a phone.
 */
export class OfferScreen {
  private root = document.createElement('div');
  private title = document.createElement('div');
  private line = document.createElement('div');
  private cards = document.createElement('div');
  private clock = document.createElement('div');
  private timer = 0;

  constructor() {
    this.root.style.cssText =
      'position:fixed;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;' +
      'background:radial-gradient(ellipse at center,rgba(40,26,14,0.94),rgba(6,5,8,0.98));font:600 13px ui-sans-serif,system-ui;color:#e9dcc6;overflow:auto;';
    this.title.style.cssText = 'font:700 26px ui-serif,Georgia,serif;letter-spacing:2px;color:#ffd27a;text-align:center;';
    this.line.style.cssText = 'opacity:0.75;text-align:center;';
    this.cards.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;width:min(760px,100%);';
    this.clock.style.cssText = 'font:700 15px ui-sans-serif,system-ui;opacity:0.7;min-height:20px;';
    this.root.append(this.title, this.line, this.cards, this.clock);
    document.body.append(this.root);
  }

  /** Shows the offers. `pick` gets one call: a card, or the first when time runs out. With nothing to offer it answers at once. */
  show(o: { title: string; line: string; offers: Upgrade[]; seconds: number; waiting?: string }, pick: (u: Upgrade | null) => void) {
    clearInterval(this.timer);
    if (!o.offers.length) {
      pick(null);
      return;
    }
    let left = o.seconds, done = false;
    this.title.textContent = o.title;
    this.line.textContent = o.line;
    const chosen = (u: Upgrade) => {
      if (done) return;
      done = true;
      clearInterval(this.timer);
      if (o.waiting) {
        this.cards.replaceChildren();
        this.clock.textContent = '';
        this.line.textContent = `${u.name}. ${o.waiting}`;
      }
      pick(u);
    };
    this.cards.replaceChildren(...o.offers.map((u, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'raid-offer';
      b.dataset.upgrade = u.id;
      b.style.cssText =
        'flex:1 1 200px;max-width:320px;min-height:112px;padding:16px;border-radius:12px;border:1px solid #8a7a52;background:#1e1a14;color:#f2e6c8;cursor:pointer;text-align:left;' +
        'display:flex;flex-direction:column;gap:8px;font:inherit;';
      const name = document.createElement('div');
      name.style.cssText = 'font:700 18px ui-serif,Georgia,serif;color:#ffd27a;';
      name.textContent = u.name;
      const blurb = document.createElement('div');
      blurb.style.cssText = 'font:500 14px ui-sans-serif,system-ui;line-height:1.35;opacity:0.9;';
      blurb.textContent = u.blurb;
      b.append(name, blurb);
      if (i === 0) {
        const first = document.createElement('div');
        first.style.cssText = 'font:500 11px ui-sans-serif,system-ui;opacity:0.55;margin-top:auto;';
        first.textContent = 'Taken if time runs out';
        b.append(first);
      }
      b.addEventListener('click', () => chosen(u));
      return b;
    }));
    const tick = () => {
      this.clock.textContent = `${Math.max(0, Math.ceil(left))} s`;
      if (left <= 0) chosen(o.offers[0]);
      left -= 1;
    };
    tick();
    this.timer = window.setInterval(tick, 1000);
    this.root.style.display = 'flex';
  }

  hide() {
    clearInterval(this.timer);
    this.root.style.display = 'none';
  }
}
