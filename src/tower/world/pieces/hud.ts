/**
 * What a set piece puts on the page while a person plays it (nothing in the autopilot's run): a line of goal at the top left, and
 * big words across the screen for a moment ("At the gate your boons are set aside"). Page elements with their own styles, as the
 * Tower's hud has them (`src/tower/hud.ts`).
 */
export class PieceHud {
  private root = document.createElement('div');
  private title = document.createElement('div');
  private goalEl = document.createElement('div');
  private banner = document.createElement('div');
  private dark = document.createElement('div');
  private left = 0;
  private alive = true;
  private goal = '';

  constructor(title: string) {
    this.root.style.cssText = 'position:fixed;left:10px;top:64px;z-index:8;max-width:300px;padding:6px 10px;border-radius:8px;background:rgba(8,6,10,0.78);border:1px solid #3a3242;pointer-events:none;';
    this.title.style.cssText = 'font:700 12px ui-sans-serif,system-ui;color:#ffd27a;letter-spacing:1px;';
    this.goalEl.style.cssText = 'font:600 13px ui-sans-serif,system-ui;color:#f2e6c8;margin-top:2px;';
    this.title.textContent = title;
    this.root.append(this.title, this.goalEl);
    this.banner.style.cssText = 'position:fixed;left:0;right:0;top:22%;z-index:9;text-align:center;pointer-events:none;display:none;text-shadow:0 2px 8px #000;padding:0 16px;';
    this.dark.className = 'tower-night';
    this.dark.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;display:none;' +
      'background:radial-gradient(circle at 50% 56%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 13%,rgba(2,2,8,0.96) 30%);';
    document.body.append(this.dark, this.root, this.banner);
    let last = performance.now();
    const frame = () => {
      if (!this.alive) return;
      const now = performance.now();
      this.update(Math.min(0.1, (now - last) / 1000));
      last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  setGoal(text: string) {
    if (text === this.goal) return;
    this.goal = text;
    this.goalEl.textContent = text;
  }

  /** Two lines across the screen for a moment. */
  say(title: string, sub = '', seconds = 2.6) {
    const small = innerWidth < 760;
    const big = document.createElement('div');
    big.style.cssText = `font:800 ${small ? 26 : 38}px ui-serif,Georgia,serif;letter-spacing:3px;color:#ffd27a;`;
    big.textContent = title;
    const line = document.createElement('div');
    line.style.cssText = `font:600 ${small ? 13 : 16}px ui-sans-serif,system-ui;color:#f2e6c8;margin-top:4px;`;
    line.textContent = sub;
    this.banner.replaceChildren(big, line);
    this.banner.style.display = '';
    this.banner.style.opacity = '1';
    this.left = seconds;
  }

  setDark(on: boolean) {
    this.dark.style.display = on ? '' : 'none';
  }

  private update(dt: number) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0.5) this.banner.style.opacity = '0';
    if (this.left <= 0) this.banner.style.display = 'none';
  }

  dispose() {
    this.alive = false;
    this.root.remove();
    this.banner.remove();
    this.dark.remove();
  }
}
