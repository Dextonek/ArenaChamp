/**
 * Five ability slots along the bottom of the screen, cast with keys 1–5 (or a click on the key badge). Click a
 * slot's name to put any effect in it. Assignments are remembered in localStorage (per browser, best effort).
 */
export interface HotbarGroup {
  category: string;
  labels: string[];
}

const STORAGE_KEY = 'vfx-hotbar-v1';
const SLOTS = 5;

export class Hotbar {
  readonly slots: (string | null)[];
  private root: HTMLDivElement;
  private names: HTMLSpanElement[] = [];
  private sweeps: HTMLDivElement[] = [];
  private active = -1;

  constructor(groups: HotbarGroup[], defaults: string[], private onCast: (label: string) => void) {
    const known = new Set(groups.flatMap((g) => g.labels));
    const saved = load();
    this.slots = Array.from({ length: SLOTS }, (_, i) => {
      const s = saved?.[i] ?? defaults[i] ?? null;
      return s && known.has(s) ? s : null;
    });

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);display:flex;gap:8px;z-index:5;' +
      'font:600 12px ui-sans-serif,system-ui;user-select:none;';
    document.body.appendChild(this.root);

    for (let i = 0; i < SLOTS; i++) {
      const slot = document.createElement('div');
      slot.style.cssText =
        'position:relative;width:104px;height:58px;border-radius:8px;overflow:hidden;' +
        'background:rgba(16,20,30,0.82);border:1px solid #3a4560;box-shadow:0 4px 14px rgba(0,0,0,0.45);';
      const key = document.createElement('div');
      key.textContent = String(i + 1);
      key.title = `cast (key ${i + 1})`;
      key.style.cssText =
        'position:absolute;left:6px;top:5px;width:20px;height:20px;border-radius:5px;background:#26314a;' +
        'color:#ffd27a;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;';
      key.addEventListener('click', () => this.cast(i));
      const name = document.createElement('span');
      name.style.cssText =
        'position:absolute;left:6px;right:6px;bottom:6px;color:#d8deeb;line-height:1.2;max-height:30px;overflow:hidden;';
      // Transparent native select over the name: a click opens the effect list.
      const select = document.createElement('select');
      select.title = 'put an effect in this slot';
      select.style.cssText = 'position:absolute;left:0;right:0;top:28px;bottom:0;opacity:0;cursor:pointer;z-index:1;';
      select.add(new Option('— empty —', ''));
      for (const g of groups) {
        const og = document.createElement('optgroup');
        og.label = g.category;
        for (const l of g.labels) og.appendChild(new Option(l, l));
        select.appendChild(og);
      }
      select.value = this.slots[i] ?? '';
      select.addEventListener('change', () => {
        this.slots[i] = select.value || null;
        this.render();
        save(this.slots);
        select.blur();
      });
      const sweep = document.createElement('div');
      sweep.style.cssText = 'position:absolute;left:0;bottom:0;height:3px;width:0;background:#ffb03a;';
      slot.append(name, key, select, sweep);
      this.root.appendChild(slot);
      this.names.push(name);
      this.sweeps.push(sweep);
    }
    this.render();
  }

  setVisible(on: boolean) {
    this.root.style.display = on ? 'flex' : 'none';
  }

  /** Casts slot `i` (0-based); empty slots do nothing. */
  cast(i: number) {
    const label = this.slots[i];
    if (!label) return;
    this.active = i;
    this.onCast(label);
  }

  /** Progress bar under the slot that was cast last: 0..1 while its effect plays, null hides it. */
  setProgress(p: number | null) {
    this.sweeps.forEach((s, i) => {
      s.style.width = i === this.active && p !== null ? `${Math.round(Math.min(1, p) * 100)}%` : '0';
    });
  }

  private render() {
    this.names.forEach((n, i) => {
      n.textContent = this.slots[i] ?? 'click to assign';
      n.style.color = this.slots[i] ? '#d8deeb' : '#5d6880';
    });
  }
}

function load(): (string | null)[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function save(slots: (string | null)[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Storage blocked (private window): the bar still works for this session.
  }
}
