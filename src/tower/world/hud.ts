import { BOON_COLOR, type Boon } from '../boons';
import { clockOf } from '../floors';
import { TOUCH } from '../../touch';

/**
 * What the zone puts on the screen (pipeline/designs/tower-worlds-build.md, stage 1): the floor and its law, the lives and the
 * hero's health, shards and the clock, the quest list with the step in hand, a short banner when a step is done, a mark and an edge
 * arrow to the step's place, the talk card of a person, the boon cards, and the floor's result. Page elements with their own styles,
 * as the weekly Tower's `TowerHud` has (src/tower/hud.ts): the tool page shows them too. Readable at 375 px wide.
 */

export interface QuestLine { id: string; name: string; text: string; k: number; n: number; done: boolean; tracked: boolean; side: boolean }
export interface CardButton { label: string; sub?: string; off?: boolean; tone?: 'gold' | 'green' | 'blue' | 'red'; click(): void }
export interface Mark { id: string; glyph: string; label?: string; tone: string; x: number; y: number; show: boolean; click(): void }

const small = () => TOUCH || innerWidth < 760;
const TONES = { gold: '#ffd27a', green: '#9df0b4', blue: '#8cc4ff', red: '#ff9a8a' };

export class WorldHud {
  private root = document.createElement('div');
  private titleEl = document.createElement('div');
  private lawEl = document.createElement('div');
  private hearts = document.createElement('div');
  private hpFill = document.createElement('div');
  private statEl = document.createElement('div');
  /** The open world's line: how many others walk this floor's shard (hidden when the climb is alone, offline). */
  private othersEl = document.createElement('div');
  private quests = document.createElement('div');
  private banner = document.createElement('div');
  private arrow = document.createElement('div');
  private flood = document.createElement('div');
  private card = document.createElement('div');
  private cards = document.createElement('div');
  private result = document.createElement('div');
  private marks = new Map<string, HTMLButtonElement>();
  private bannerLeft = 0;
  private lives = -1;
  private lawText = '';
  private questKey = '';
  private statKey = '';
  /** What the screen's talk card is for, so the zone can close it when the hero walks off. */
  cardFor = '';
  onLeave: (() => void) | null = null;

  constructor() {
    const s = small();
    this.root.className = 'world-hud';
    this.root.style.cssText =
      `position:fixed;left:${s ? 6 : 12}px;top:calc(${s ? 182 : 150}px + env(safe-area-inset-top, 0px));z-index:6;display:none;flex-direction:column;gap:3px;` +
      `padding:${s ? '4px 8px 5px' : '5px 11px 6px'};border-radius:10px;background:rgba(8,6,10,0.82);border:1px solid #6a5a3a;box-shadow:0 2px 10px #000a;` +
      `max-width:${s ? '62vw' : '270px'};box-sizing:border-box;pointer-events:none;user-select:none;font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;`;
    this.titleEl.style.cssText = `font:700 ${s ? 13 : 15}px ui-serif,Georgia,serif;letter-spacing:1px;color:#ffd27a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    this.lawEl.style.cssText = `font:600 ${s ? 11 : 12}px ui-sans-serif,system-ui;color:#8cc4ff;`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    this.hearts.style.cssText = `display:flex;gap:2px;font:400 ${s ? 14 : 16}px/1 ui-sans-serif,system-ui;`;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:relative;flex:1;min-width:60px;height:7px;border-radius:4px;background:#21131a;border:1px solid #4a4032;overflow:hidden;';
    this.hpFill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(180deg,#8ee6a4,#3f9a5c);transition:width 0.15s;';
    bar.append(this.hpFill);
    row.append(this.hearts, bar);
    this.statEl.style.cssText = `font:600 ${s ? 11 : 12}px ui-sans-serif,system-ui;color:#f2e6c8;display:flex;gap:10px;`;
    this.quests.style.cssText = `display:flex;flex-direction:column;gap:3px;margin-top:2px;border-top:1px solid #3a3242;padding-top:3px;font:600 ${s ? 11 : 12}px/1.25 ui-sans-serif,system-ui;`;
    this.othersEl.style.cssText = `font:600 ${s ? 10 : 11}px ui-sans-serif,system-ui;color:#a8e0b0;display:none;`;
    this.root.append(this.titleEl, this.lawEl, row, this.statEl, this.othersEl, this.quests);

    this.banner.style.cssText = `position:fixed;left:50%;top:${s ? 46 : 17}%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;display:none;text-align:center;max-width:92vw;text-shadow:0 3px 14px #000;transition:opacity 0.5s;`;
    this.arrow.style.cssText = 'position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:none;width:34px;height:34px;margin:-17px 0 0 -17px;';
    this.flood.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;display:none;box-shadow:inset 0 0 90px 24px rgba(40,120,170,0.55);background:rgba(30,90,130,0.12);';
    this.card.style.cssText = `position:fixed;left:50%;bottom:${TOUCH ? 150 : 40}px;transform:translateX(-50%);z-index:10;display:none;width:min(440px,calc(100vw - 20px));box-sizing:border-box;padding:12px 14px;border-radius:12px;background:rgba(14,11,12,0.95);border:2px solid #8a7a52;box-shadow:0 6px 24px #000c;color:#f2e6c8;font:500 14px/1.4 ui-sans-serif,system-ui;`;
    this.cards.style.cssText = `position:fixed;left:50%;bottom:${TOUCH ? 150 : 40}px;transform:translateX(-50%);z-index:10;display:none;gap:8px;width:min(620px,calc(100vw - 12px));box-sizing:border-box;`;
    this.result.style.cssText = 'position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:rgba(4,3,6,0.72);';
    document.body.append(this.flood, this.root, this.banner, this.arrow, this.card, this.cards, this.result);
    // The duel's boss bar would say "13 / 13" for the whole floor (the zone's unseen boss has no health to speak of): hidden while a zone is on.
    this.hideBar.id = 'world-hide-bosshud';
    this.hideBar.textContent = 'body > div[style*="z-index: 6"][style*="left: 50%"][style*="width: min("][style*="flex-direction: column"]{display:none !important}';
    document.head.append(this.hideBar);
  }
  private hideBar = document.createElement('style');

  show(on: boolean) {
    this.root.style.display = on ? 'flex' : 'none';
    if (!on) { this.banner.style.display = 'none'; this.arrow.style.display = 'none'; this.flood.style.display = 'none'; this.closeCard(); this.clearCards(); this.result.style.display = 'none'; this.clearMarks(); }
  }

  /** The floor's name and its law, once. */
  floor(name: string, law: string) {
    this.titleEl.textContent = name;
    this.lawEl.textContent = law;
    this.lawText = law;
  }

  /** The law's live line ("The tide comes in 42 s") and whether it is hurting now. */
  law(text: string, active: boolean, warn: boolean) {
    if (text !== this.lawText) { this.lawText = text; this.lawEl.textContent = text; }
    this.lawEl.style.color = active ? '#ff9a8a' : warn ? '#ffd27a' : '#8cc4ff';
    this.flood.style.display = active ? '' : 'none';
  }

  setLives(n: number) {
    if (n === this.lives) return;
    this.lives = n;
    this.hearts.title = `${n} of 3 lives`;
    this.hearts.replaceChildren(...[0, 1, 2].map((i) => {
      const h = document.createElement('span');
      h.textContent = '♥';
      h.style.color = i < n ? '#ff6a6a' : '#3a3038';
      return h;
    }));
  }

  setHealth(hp: number, max: number) {
    const share = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    this.hpFill.style.width = `${share * 100}%`;
    this.hpFill.style.background = share < 0.3 ? 'linear-gradient(180deg,#ff8a6a,#b03a2a)' : 'linear-gradient(180deg,#8ee6a4,#3f9a5c)';
  }

  /** How many others are on this floor's shard (the open world), or null for none of it (not signed in, offline). */
  setOthers(n: number | null) {
    this.othersEl.style.display = n === null ? 'none' : '';
    if (n !== null) this.othersEl.textContent = n === 0 ? 'No one else on this floor yet' : `${n} ${n === 1 ? 'other' : 'others'} on this floor`;
  }

  stats(shards: number, seconds: number, extra = '') {
    const key = `${shards}|${Math.floor(seconds)}|${extra}`;
    if (key === this.statKey) return;
    this.statKey = key;
    const part = (t: string, c: string) => { const e = document.createElement('span'); e.textContent = t; e.style.color = c; return e; };
    this.statEl.replaceChildren(part(`◆ ${shards}`, '#8cc4ff'), part(clockOf(seconds), '#f2e6c8'), ...(extra ? [part(extra, '#ffd27a')] : []));
  }

  setQuests(lines: QuestLine[]) {
    // On a phone: the step in hand and a count of the rest (the full list is for a screen with room).
    const all = lines;
    const more = small() ? Math.max(0, all.filter((l) => !l.done).length - 1) : 0;
    if (small()) lines = [all.find((l) => l.tracked && !l.done) ?? all.find((l) => !l.done) ?? all[0]].filter(Boolean);
    const key = JSON.stringify(lines) + more;
    if (key === this.questKey) return;
    this.questKey = key;
    this.quests.replaceChildren(...lines.map((l) => {
      const row = document.createElement('div');
      row.dataset.quest = l.id;
      row.style.cssText = `display:flex;flex-direction:column;opacity:${l.tracked ? 1 : 0.72};`;
      const name = document.createElement('div');
      name.style.cssText = `color:${l.done ? '#9df0b4' : l.side ? '#8cc4ff' : '#ffd27a'};font-weight:700;`;
      name.textContent = `${l.done ? '✔ ' : l.tracked ? '▸ ' : ''}${l.name}`;
      const step = document.createElement('div');
      step.style.cssText = 'color:#f2e6c8;font-weight:500;';
      step.textContent = l.done ? 'Return to the one who asked' : `${l.text}${l.n > 1 ? ` (${l.k}/${l.n})` : ''}`;
      row.append(name, step);
      return row;
    }), ...(more ? [(() => {
      const m = document.createElement('div');
      m.style.cssText = 'color:#a89870;font-weight:600;';
      m.textContent = `+${more} more ${more === 1 ? 'quest' : 'quests'}`;
      return m;
    })()] : []));
  }

  /** Two lines across the screen for a moment. */
  say(title: string, sub = '', seconds = 2.6) {
    const s = small();
    const big = document.createElement('div');
    big.style.cssText = `font:800 ${s ? 24 : 36}px ui-serif,Georgia,serif;letter-spacing:3px;color:#ffd27a;`;
    big.textContent = title;
    const line = document.createElement('div');
    line.style.cssText = `font:600 ${s ? 13 : 16}px ui-sans-serif,system-ui;color:#f2e6c8;margin-top:2px;`;
    line.textContent = sub;
    this.banner.replaceChildren(big, line);
    this.banner.style.display = '';
    this.banner.style.opacity = '1';
    this.bannerLeft = seconds;
  }

  /** Once a frame. */
  update(dt: number) {
    if (this.bannerLeft <= 0) return;
    this.bannerLeft -= dt;
    if (this.bannerLeft <= 0.5) this.banner.style.opacity = '0';
    if (this.bannerLeft <= 0) this.banner.style.display = 'none';
  }

  /**
   * The arrow to the step's place: `p` is where it is on the screen in pixels (or null: none to show), `inside` whether that is in the
   * view. Outside, an arrow sits on the screen's edge and points to it; inside, nothing (the world's own light pillar marks it).
   */
  pointTo(p: { x: number; y: number; behind: boolean } | null, label = '') {
    if (!p) { this.arrow.style.display = 'none'; return; }
    const w = innerWidth, h = innerHeight, m = 34, topM = small() ? 230 : 60, botM = small() ? 190 : 80;
    const cx = w / 2, cy = h / 2;
    let x = p.x, y = p.y;
    const inside = !p.behind && x > m && x < w - m && y > topM && y < h - botM;
    if (inside) { this.arrow.style.display = 'none'; return; }
    let dx = x - cx, dy = y - cy;
    if (p.behind) { dx = -dx; dy = -dy; }
    const k = Math.min((w / 2 - m) / Math.max(1e-3, Math.abs(dx)), (h / 2 - Math.max(topM, botM) + 20) / Math.max(1e-3, Math.abs(dy)));
    x = cx + dx * Math.min(k, 1e4);
    y = cy + dy * Math.min(k, 1e4);
    x = Math.max(m, Math.min(w - m, x));
    y = Math.max(topM, Math.min(h - botM, y));
    const ang = Math.atan2(dy, dx);
    this.arrow.style.display = '';
    this.arrow.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    this.arrow.innerHTML = `<svg width="34" height="34" viewBox="-17 -17 34 34" style="transform:rotate(${ang}rad);filter:drop-shadow(0 1px 4px #000)"><path d="M-9 -10 L12 0 L-9 10 L-4 0 Z" fill="#ffd27a" stroke="#3a2a10" stroke-width="1.5"/></svg>${label ? `<div style="position:absolute;left:50%;top:34px;transform:translateX(-50%);font:700 11px ui-sans-serif,system-ui;color:#ffd27a;white-space:nowrap;text-shadow:0 1px 3px #000">${label}</div>` : ''}`;
  }

  /** Marks over people's heads (and other things worth a tap): a glyph, tapped to walk there. */
  setMarks(marks: Mark[]) {
    const seen = new Set<string>();
    for (const m of marks) {
      seen.add(m.id);
      let el = this.marks.get(m.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.dataset.mark = m.id;
        el.style.cssText = 'position:fixed;left:0;top:0;z-index:7;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #8a7a52;background:rgba(14,11,12,0.82);font:800 22px/1 ui-serif,Georgia,serif;cursor:pointer;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:0;touch-action:manipulation;position:fixed;';
        el.addEventListener('click', (e) => { e.stopPropagation(); this.marks.get(m.id) && (el as HTMLButtonElement & { act?: () => void }).act?.(); });
        document.body.append(el);
        this.marks.set(m.id, el);
      }
      (el as HTMLButtonElement & { act?: () => void }).act = m.click;
      const key = m.glyph + '|' + (m.label ?? '');
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.replaceChildren(document.createTextNode(m.glyph));
        if (m.label) {
          const l = document.createElement('span');
          l.textContent = m.label;
          l.style.cssText = 'position:absolute;top:44px;left:50%;transform:translateX(-50%);white-space:nowrap;font:700 11px ui-sans-serif,system-ui;color:#f2e6c8;text-shadow:0 1px 3px #000,0 0 6px #000;pointer-events:none;';
          el.append(l);
        }
      }
      el.style.color = m.tone;
      el.style.borderColor = m.tone;
      el.style.display = m.show ? 'flex' : 'none';
      el.style.transform = `translate(${Math.round(m.x)}px,${Math.round(m.y)}px)`;
    }
    for (const [id, el] of this.marks) if (!seen.has(id)) { el.remove(); this.marks.delete(id); }
  }
  clearMarks() {
    for (const el of this.marks.values()) el.remove();
    this.marks.clear();
  }

  /** A card with a name, a few lines and buttons. */
  openCard(o: { for: string; name: string; role: string; lines: string[]; buttons: CardButton[]; accent?: string }) {
    this.cardFor = o.for;
    const accent = o.accent ?? '#8a7a52';
    this.card.style.borderColor = accent;
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:baseline;gap:8px;margin-bottom:6px;';
    const name = document.createElement('div');
    name.style.cssText = 'font:700 18px ui-serif,Georgia,serif;color:#ffd27a;';
    name.textContent = o.name;
    const role = document.createElement('div');
    role.style.cssText = 'font:600 11px ui-sans-serif,system-ui;letter-spacing:0.08em;text-transform:uppercase;color:#a89870;flex:1;';
    role.textContent = o.role;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close');
    close.style.cssText = 'background:none;border:0;color:#a89870;font:700 24px/1 ui-sans-serif,system-ui;cursor:pointer;padding:0 4px;touch-action:manipulation;';
    close.addEventListener('click', () => this.closeCard());
    head.append(name, role, close);
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:10px;';
    for (const l of o.lines) {
      const p = document.createElement('div');
      p.textContent = l;
      body.append(p);
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    for (const b of o.buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.disabled = !!b.off;
      el.dataset.act = b.label;
      const tone = TONES[b.tone ?? 'gold'];
      el.style.cssText = `flex:1 1 140px;min-height:44px;padding:6px 10px;border-radius:9px;border:2px solid ${b.off ? '#4a4032' : tone};background:rgba(30,24,20,0.95);color:${b.off ? '#7a7060' : '#f2e6c8'};cursor:${b.off ? 'default' : 'pointer'};text-align:left;font:600 13px/1.25 ui-sans-serif,system-ui;touch-action:manipulation;`;
      const t = document.createElement('div');
      t.style.cssText = `font-weight:700;color:${b.off ? '#7a7060' : tone};`;
      t.textContent = b.label;
      el.append(t);
      if (b.sub) {
        const s = document.createElement('div');
        s.style.cssText = 'font:500 11px ui-sans-serif,system-ui;opacity:0.85;';
        s.textContent = b.sub;
        el.append(s);
      }
      el.addEventListener('click', () => { if (!b.off) b.click(); });
      row.append(el);
    }
    this.card.replaceChildren(head, body, row);
    this.card.style.display = '';
  }
  closeCard() {
    this.cardFor = '';
    this.card.style.display = 'none';
    this.card.replaceChildren();
  }
  get cardOpen() {
    return this.card.style.display !== 'none';
  }

  /** The three boons to take one of. */
  showBoons(label: string, offers: Boon[], take: (i: number) => void) {
    this.cards.style.display = 'flex';
    const title = document.createElement('div');
    title.textContent = label;
    title.style.cssText = 'position:absolute;left:0;right:0;top:-24px;text-align:center;font:700 14px ui-serif,Georgia,serif;color:#ffd27a;text-shadow:0 2px 8px #000;';
    this.cards.replaceChildren(title, ...offers.map((b, i) => {
      const tone = BOON_COLOR[b.kind];
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.boon = b.id;
      el.style.cssText = `flex:1;min-width:0;padding:${TOUCH ? '6px 7px' : '9px 11px'};border-radius:10px;border:2px solid ${tone.edge};background:rgba(18,15,14,0.95);color:#f2e6c8;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:3px;font:600 13px ui-sans-serif,system-ui;box-shadow:0 4px 14px #000a;touch-action:manipulation;`;
      el.innerHTML = `<div style="font:700 9px ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;color:${tone.edge}">${tone.word}</div><div style="font:700 ${TOUCH ? 12 : 15}px ui-serif,Georgia,serif;color:${tone.name}">${b.name}</div><div style="font:500 ${TOUCH ? 10 : 12}px/1.25 ui-sans-serif,system-ui;opacity:.92">${b.blurb}</div>`;
      el.addEventListener('click', () => take(i));
      return el;
    }));
  }
  clearCards() {
    this.cards.style.display = 'none';
    this.cards.replaceChildren();
  }
  get cardsOpen() {
    return this.cards.style.display !== 'none';
  }

  /**
   * The floor's result: its four stars and what it took, the sigil to keep (one of the boons carried; a tap picks, the first is picked
   * to begin with), and two buttons: one floor up (or a line that the way up is still being built) and back to the Tower.
   */
  showResult(o: { name: string; stars: { label: string; got: boolean }[]; lines: string[]; sigils: { label: string; sub: string }[]; picked: number; pick(i: number): void; climb: CardButton; back: CardButton }) {
    const box = document.createElement('div');
    box.dataset.result = '1';
    box.style.cssText = 'width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:16px 16px 14px;border-radius:14px;background:rgba(14,11,12,0.97);border:2px solid #8a7a52;box-shadow:0 8px 40px #000;color:#f2e6c8;font:500 14px/1.4 ui-sans-serif,system-ui;text-align:center;';
    const head = document.createElement('div');
    head.style.cssText = 'font:800 24px ui-serif,Georgia,serif;letter-spacing:3px;color:#ffd27a;';
    head.textContent = `${o.name} cleared`;
    const stars = document.createElement('div');
    stars.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin:10px 0;align-items:stretch;text-align:left;';
    stars.dataset.stars = o.stars.map((s) => (s.got ? 1 : 0)).join('');
    for (const s of o.stars) {
      const r = document.createElement('div');
      r.style.cssText = `display:flex;gap:8px;align-items:center;color:${s.got ? '#ffd27a' : '#7a7060'};font-weight:600;`;
      r.innerHTML = `<span style="font-size:20px">${s.got ? '★' : '☆'}</span><span>${s.label}</span>`;
      stars.append(r);
    }
    const info = document.createElement('div');
    info.style.cssText = 'font-size:12px;color:#c8bca0;margin-bottom:10px;';
    info.textContent = o.lines.join(' · ');
    box.append(head, stars, info);
    if (o.sigils.length) {
      const t = document.createElement('div');
      t.style.cssText = 'font:700 11px ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;color:#a89870;margin-bottom:4px;';
      t.textContent = 'Keep one boon as a sigil for every later climb';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;';
      const btns: HTMLButtonElement[] = [];
      const paint = (k: number) => btns.forEach((b, i) => { b.style.borderColor = i === k ? '#ffd27a' : '#4a4032'; b.style.background = i === k ? 'rgba(60,46,20,0.95)' : 'rgba(30,24,20,0.95)'; b.setAttribute('aria-pressed', String(i === k)); });
      for (const [i, g] of [...o.sigils, { label: 'None', sub: 'Keep nothing' }].entries()) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.sigil = String(i);
        b.style.cssText = 'flex:1;min-width:0;min-height:44px;padding:5px 6px;border-radius:9px;border:2px solid #4a4032;color:#f2e6c8;cursor:pointer;text-align:left;font:700 12px/1.2 ui-sans-serif,system-ui;touch-action:manipulation;';
        b.innerHTML = `<div style="color:#ffd27a">${g.label}</div><div style="font:500 10px/1.2 ui-sans-serif,system-ui;opacity:.85">${g.sub}</div>`;
        b.addEventListener('click', () => { const k = i < o.sigils.length ? i : -1; o.pick(k); paint(i); });
        btns.push(b);
        row.append(b);
      }
      paint(o.picked < 0 ? btns.length - 1 : o.picked);
      box.append(t, row);
    }
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    for (const [k, b] of [['climb', o.climb], ['back', o.back]] as const) {
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.act = k;
      el.disabled = !!b.off;
      el.textContent = b.label;
      el.style.cssText = `min-height:44px;border-radius:9px;border:2px solid ${b.off ? '#4a4032' : '#ffd27a'};background:rgba(30,24,20,0.95);color:${b.off ? '#7a7060' : '#ffd27a'};font:700 14px ui-sans-serif,system-ui;cursor:${b.off ? 'default' : 'pointer'};touch-action:manipulation;`;
      el.addEventListener('click', () => { if (!b.off) b.click(); });
      col.append(el);
    }
    box.append(col);
    this.result.replaceChildren(box);
    this.result.style.display = 'flex';
  }
  hideResult() {
    this.result.style.display = 'none';
    this.result.replaceChildren();
  }

  dispose() {
    this.show(false);
    for (const e of [this.flood, this.root, this.banner, this.arrow, this.card, this.cards, this.result, this.hideBar]) e.remove();
  }
}
