import { roman } from '../arenas/tower';
import { TOUCH } from '../touch';
import { BOON_COLOR, type Boon } from './boons';
import { KIND_NAME, TWISTS, type FloorPlan } from './week';

/** Narrower than this (px), the boon cards sit in a row instead of over their altars. */
const NARROW = 560;

/**
 * What the Tower puts on the screen over a floor: which floor and what kind, the three lives, the hero's health (it carries
 * over, so it is always in sight), the floor's goal in a few words, the floor's name as it begins, and the boon cards on a
 * landing. Page elements with their own styles, as the boss's bar has: the tool page shows them too.
 */
export class TowerHud {
  private root = document.createElement('div');
  private floorEl = document.createElement('div');
  private hearts = document.createElement('div');
  private hpFill = document.createElement('div');
  private goalEl = document.createElement('div');
  private banner = document.createElement('div');
  private dark = document.createElement('div');
  private cards: HTMLButtonElement[] = [];
  private goal = '';
  private lives = -1;
  private bannerLeft = 0;

  constructor() {
    const small = TOUCH || innerWidth < 760;
    this.root.className = 'tower-hud';
    this.root.style.cssText =
      `position:fixed;left:${small ? 6 : 12}px;top:calc(${small ? 68 : 12}px + env(safe-area-inset-top, 0px));z-index:6;display:none;flex-direction:column;gap:3px;` +
      `padding:${small ? '4px 8px 5px' : '5px 11px 6px'};border-radius:10px;background:rgba(8,6,10,0.82);border:1px solid #6a5a3a;box-shadow:0 2px 10px #000a;` +
      `max-width:${small ? '52vw' : '250px'};box-sizing:border-box;pointer-events:none;user-select:none;font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;`;
    this.floorEl.style.cssText = `font:700 ${small ? 13 : 15}px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;white-space:nowrap;`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    this.hearts.className = 'tower-lives';
    this.hearts.style.cssText = `display:flex;gap:2px;font:400 ${small ? 14 : 16}px/1 ui-sans-serif,system-ui;`;
    const bar = document.createElement('div');
    bar.title = 'Your health: it carries over from floor to floor';
    bar.style.cssText = 'position:relative;flex:1;min-width:70px;height:7px;border-radius:4px;background:#21131a;border:1px solid #4a4032;overflow:hidden;';
    this.hpFill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(180deg,#8ee6a4,#3f9a5c);transition:width 0.15s;';
    bar.append(this.hpFill);
    row.append(this.hearts, bar);
    this.goalEl.className = 'tower-goal';
    this.goalEl.style.cssText = `font:600 ${small ? 12 : 13}px ui-sans-serif,system-ui;color:#f2e6c8;`;
    this.root.append(this.floorEl, row, this.goalEl);
    this.banner.className = 'tower-banner';
    this.banner.style.cssText =
      `position:fixed;left:50%;top:${small ? 31 : 17}%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;display:none;text-align:center;max-width:92vw;` +
      'text-shadow:0 3px 14px #000;transition:opacity 0.5s;';
    this.dark.className = 'tower-night';
    this.dark.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;display:none;' +
      'background:radial-gradient(circle at 50% 55%, transparent 0, transparent 22vmin, rgba(2,2,8,0.55) 42vmin, rgba(2,2,8,0.85) 70vmin);';
    document.body.append(this.dark, this.root, this.banner);
  }

  /**
   * A floor begins: its number and kind, and what is odd about it. `foe`: the room has something to fight, so on a phone the
   * hero's own panel (its portrait and passive) holds the top left corner, and this box goes under it.
   */
  floor(plan: FloorPlan, lives: number, foe: boolean) {
    if (TOUCH || innerWidth < 760) this.root.style.top = `calc(${foe ? 158 : 68}px + env(safe-area-inset-top, 0px))`;
    this.floorEl.textContent = `Floor ${plan.n} · ${KIND_NAME[plan.kind]}`;
    this.setLives(lives);
    this.setGoal('');
    this.dark.style.display = plan.twist === 'dark' ? '' : 'none';
    this.root.style.display = 'flex';
  }

  /** The floor's name across the screen as it begins: its numeral, its kind, and its twist if it has one. */
  announce(plan: FloorPlan, extra = '') {
    const twist = plan.twist ? TWISTS[plan.twist] : null;
    const line = [KIND_NAME[plan.kind], plan.mix ? `with ${plan.mix === 'gauntlet' ? 'sweeping fire' : plan.mix === 'horde' ? 'keepers' : plan.mix === 'break' ? 'a sentry' : 'a lantern to stand by'}` : '', extra].filter(Boolean).join(' ');
    this.say(`Floor ${roman(plan.n)}`, twist ? `${line} · ${twist.name}: ${twist.blurb}` : line);
  }

  /** Two lines across the screen for a moment. */
  say(title: string, sub = '', seconds = 2.6) {
    const small = TOUCH || innerWidth < 760;
    const big = document.createElement('div');
    big.style.cssText = `font:800 ${small ? 28 : 40}px ui-serif,Georgia,serif;letter-spacing:4px;color:#ffd27a;`;
    big.textContent = title;
    const line = document.createElement('div');
    line.style.cssText = `font:600 ${small ? 13 : 16}px ui-sans-serif,system-ui;color:#f2e6c8;margin-top:2px;`;
    line.textContent = sub;
    this.banner.replaceChildren(big, line);
    this.banner.style.display = '';
    this.banner.style.opacity = '1';
    this.bannerLeft = seconds;
  }

  setLives(lives: number) {
    if (lives === this.lives) return;
    this.lives = lives;
    this.hearts.title = `${lives} of 3 lives`;
    this.hearts.replaceChildren(...[0, 1, 2].map((i) => {
      const h = document.createElement('span');
      h.textContent = '♥';
      h.style.color = i < lives ? '#ff6a6a' : '#3a3038';
      return h;
    }));
  }

  setGoal(text: string) {
    if (text === this.goal) return;
    this.goal = text;
    this.goalEl.textContent = text;
  }

  setHealth(hp: number, max: number) {
    const share = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    this.hpFill.style.width = `${share * 100}%`;
    this.hpFill.style.background = share < 0.3 ? 'linear-gradient(180deg,#ff8a6a,#b03a2a)' : 'linear-gradient(180deg,#8ee6a4,#3f9a5c)';
  }

  /** Once a frame, from the run. */
  update(dt: number) {
    if (this.bannerLeft <= 0) return;
    this.bannerLeft -= dt;
    if (this.bannerLeft <= 0.5) this.banner.style.opacity = '0';
    if (this.bannerLeft <= 0) this.banner.style.display = 'none';
  }

  /** A card for each boon on a landing. A tap on one asks for the hero to walk to its altar. */
  showCards(offers: Boon[], tap: (i: number) => void) {
    this.clearCards();
    const width = TOUCH ? 'min(118px,30vw)' : '184px';
    this.cards = offers.map((b, i) => {
      const tone = BOON_COLOR[b.kind];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tower-boon';
      el.dataset.boon = b.id;
      el.style.cssText = `position:fixed;left:0;top:0;z-index:6;width:${width};padding:${TOUCH ? '6px 7px' : '9px 11px'};border-radius:10px;border:2px solid ${tone.edge};background:rgba(18,15,14,0.92);color:#f2e6c8;` +
        'cursor:pointer;text-align:left;pointer-events:auto;display:flex;flex-direction:column;gap:3px;font:600 13px ui-sans-serif,system-ui;box-shadow:0 4px 14px #000a;';
      const kind = document.createElement('div');
      kind.style.cssText = `font:700 ${TOUCH ? 8 : 10}px ui-sans-serif,system-ui;letter-spacing:0.08em;text-transform:uppercase;color:${tone.edge};`;
      kind.textContent = tone.word;
      const name = document.createElement('div');
      name.style.cssText = `font:700 ${TOUCH ? 12 : 15}px ui-serif,Georgia,serif;color:${tone.name};`;
      name.textContent = b.name;
      const blurb = document.createElement('div');
      blurb.style.cssText = `font:500 ${TOUCH ? 10 : 12}px ui-sans-serif,system-ui;line-height:1.25;opacity:0.92;`;
      blurb.textContent = b.blurb;
      el.append(kind, name, blurb);
      el.addEventListener('click', () => tap(i));
      document.body.append(el);
      return el;
    });
  }

  /**
   * The three cards in a row near the bottom of the screen, left, middle and right as the altars stand: the green, gold and blue
   * lights over the altars say which is which. Over the altars themselves the cards hid them: seen from the south the three
   * stand closer on the screen than a card is wide. On a phone the row sits just over the stick.
   */
  placeCards() {
    if (!this.cards.length) return;
    const w = innerWidth, h = innerHeight, narrow = w < NARROW;
    const gap = narrow ? 6 : 10, cw = narrow ? Math.floor((w - 12 - 2 * gap) / 3) : this.cards[0].offsetWidth;
    const all = this.cards.length * cw + (this.cards.length - 1) * gap, left = Math.max(6, (w - all) / 2);
    let tall = 0;
    for (const c of this.cards) {
      if (narrow) c.style.width = `${cw}px`;
      tall = Math.max(tall, c.offsetHeight);
    }
    const y = h - tall - (TOUCH ? 185 : narrow ? 120 : 64);
    this.cards.forEach((c, i) => { c.style.transform = `translate(${Math.round(left + i * (cw + gap))}px,${Math.round(y)}px)`; });
  }

  clearCards() {
    for (const c of this.cards) c.remove();
    this.cards = [];
  }

  hide() {
    this.clearCards();
    this.root.style.display = 'none';
    this.banner.style.display = 'none';
    this.dark.style.display = 'none';
    this.bannerLeft = 0;
  }
}
