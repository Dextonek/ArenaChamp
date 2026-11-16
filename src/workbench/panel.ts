import type { TelegraphSpec } from '../effects/telegraph';

/** A spell's last cast, as the workbench saw it: its danger zones (start, impact, until) and the effect's length. */
export interface LastCast { zones: TelegraphSpec[]; length: number | null; at: number }

export interface TimingRow {
  key: string; name: string; color: string; cooldown: number; range: number;
  /** From the blocks' rules (a spell written as its own code has none until it is cast). */
  windup?: number; impact?: number; length?: number; blocks: boolean; shape?: string;
  last: LastCast | null;
}

const CSS = `
/* top left, under the duel's header and clear of the hero bar at the bottom; on a phone it starts folded (its header
   only) at the top right, under the panel's title, clear of the joystick and the spell buttons */
.wb { position: fixed; left: 8px; top: 92px; z-index: 30; width: min(420px, calc(100vw - 16px)); max-height: calc(100vh - 250px);
  overflow: auto; font: 12px/1.35 ui-sans-serif, system-ui, sans-serif; color: #dfe4ee; background: rgba(12, 14, 20, 0.88);
  border: 1px solid #2a3142; border-radius: 8px; box-sizing: border-box; }
.wb * { box-sizing: border-box; }
.wb header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #232a38; position: sticky; top: 0;
  background: rgba(12, 14, 20, 0.96); }
.wb header b { font-size: 14px; }
.wb .badge { font-size: 10px; padding: 1px 6px; border-radius: 9px; background: #6a4a12; color: #ffd98a; letter-spacing: .04em; }
.wb header button { margin-left: auto; }
.wb button { font: inherit; color: #dfe4ee; background: #1d2330; border: 1px solid #343d52; border-radius: 5px; padding: 2px 8px; cursor: pointer; }
.wb section { padding: 8px 10px; border-bottom: 1px solid #1c2230; }
.wb h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8b93a7; font-weight: 600; }
.wb .row { display: grid; grid-template-columns: 22px 1fr; gap: 2px 6px; margin-bottom: 6px; }
.wb .key { font-weight: 700; text-align: center; border-radius: 4px; color: #0b0d12; }
.wb .meta { color: #a9b1c3; }
.wb svg { width: 100%; height: 18px; display: block; grid-column: 2; }
.wb code { font: 11px ui-monospace, Consolas, monospace; color: #cfe7ff; background: #151a24; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
.wb .cmd { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
.wb .cmd code { flex: 1; }
.wb .ok { color: #9be86b; } .wb .bad { color: #ff8a7a; } .wb .dim { color: #79819a; }
.wb ul { margin: 4px 0 0; padding-left: 16px; }
.wb.closed section { display: none; }
.wb.closed { width: auto; }
@media (max-width: 699px) { .wb { top: 46px; max-height: 64vh; } .wb.closed { left: auto; right: 8px; } }
`;

/**
 * The workbench's overlay: the hero, each spell's timing (its last cast's danger zones on a time line: shown, impact, lasting,
 * and the effect's length), the balance check (the commands to run and their last saved results), and the numbers changed.
 */
export class Panel {
  readonly el: HTMLDivElement;
  private titleEl: HTMLElement;
  private timingEl: HTMLElement;
  private balanceEl: HTMLElement;
  private changesEl: HTMLElement;
  private rows: TimingRow[] = [];
  private nowSlot = -1;
  private nowT = -1;
  private lines: string[] = [];

  constructor() {
    if (!document.getElementById('wb-css')) {
      const st = document.createElement('style');
      st.id = 'wb-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.el = document.createElement('div');
    this.el.className = 'wb';
    this.el.innerHTML = `<header><span class="t"></span><button type="button">hide</button></header>
      <section><h4>Timing (seconds from the cast)</h4><div class="timing"></div></section>
      <section><h4>Balance check</h4><div class="balance"></div></section>
      <section><h4>Numbers changed (not saved: copy them into the files)</h4><div class="changes"></div></section>`;
    this.titleEl = this.el.querySelector('.t')!;
    this.timingEl = this.el.querySelector('.timing')!;
    this.balanceEl = this.el.querySelector('.balance')!;
    this.changesEl = this.el.querySelector('.changes')!;
    const btn = this.el.querySelector('header button') as HTMLButtonElement;
    btn.onclick = () => {
      this.el.classList.toggle('closed');
      btn.textContent = this.el.classList.contains('closed') ? 'show' : 'hide';
    };
    document.body.appendChild(this.el);
    if (innerWidth < 700) btn.click();
    this.changes([]);
  }

  hero(name: string, draft: boolean, folder: string) {
    this.titleEl.innerHTML = `<b>${esc(name)}</b> ${draft ? '<span class="badge">DRAFT</span>' : ''} <span class="dim">src/heroes/${esc(folder)}/</span>`;
    this.balance(name, draft);
  }

  timing(rows: TimingRow[]) {
    this.rows = rows;
    this.drawTiming();
  }

  /** The spell playing now (its slot) and its clock, for the moving mark; -1: none. */
  now(slot: number, t: number) {
    if (slot === this.nowSlot && Math.abs(t - this.nowT) < 0.03) return;
    this.nowSlot = slot;
    this.nowT = t;
    this.drawTiming();
  }

  changes(lines: string[]) {
    this.lines = lines;
    this.changesEl.innerHTML = lines.length
      ? `<ul>${lines.map((l) => `<li><code>${esc(l)}</code></li>`).join('')}</ul><div class="cmd"><button type="button">copy all</button></div>`
      : '<span class="dim">none yet: change a number in the panel (Numbers)</span>';
    const b = this.changesEl.querySelector('button');
    if (b) b.onclick = () => copy(this.lines.join('\n'));
  }

  private drawTiming() {
    const span = Math.max(1.5, ...this.rows.map((r) => Math.max(r.last?.length ?? 0, r.length ?? 0, ...((r.last?.zones ?? []).map((z) => z.until ?? z.impact)))));
    const x = (t: number) => `${(100 * Math.min(Math.max(t, 0), span)) / span}%`;
    this.timingEl.innerHTML = this.rows.map((r, i) => {
      const bits: string[] = [];
      const zones = r.last?.zones ?? [];
      const len = r.last?.length ?? r.length;
      if (len) bits.push(`<rect x="0" y="8" width="${x(len)}" height="2" fill="#3a4258"/>`);
      zones.forEach((z) => {
        bits.push(`<rect x="${x(z.start)}" y="4" width="${pct(z.impact - z.start, span)}" height="10" fill="${r.color}" opacity="0.35"/>`);
        if (z.until !== undefined && z.until > z.impact) bits.push(`<rect x="${x(z.impact)}" y="6" width="${pct(z.until - z.impact, span)}" height="6" fill="${r.color}" opacity="0.8"/>`);
        bits.push(`<rect x="${x(z.impact)}" y="1" width="2" height="16" fill="${r.color}"/>`);
      });
      if (!zones.length && r.windup !== undefined) {
        bits.push(`<rect x="${x(r.windup)}" y="3" width="1.5" height="12" fill="#cfd6e4"/>`);
        if (r.impact !== undefined) bits.push(`<rect x="${x(r.impact)}" y="1" width="2" height="16" fill="${r.color}"/>`);
      }
      if (i === this.nowSlot && this.nowT >= 0) bits.push(`<rect x="${x(this.nowT)}" y="0" width="1.5" height="18" fill="#ffffff"/>`);
      const z0 = zones[0];
      const when = z0
        ? `zone at ${fix(z0.start)} s, hit at ${fix(z0.impact)} s${z0.until !== undefined ? `, lasts to ${fix(z0.until)} s` : ''}${zones.length > 1 ? ` (${zones.length} zones)` : ''}`
        : r.windup !== undefined ? `wind-up ${fix(r.windup)} s, hit at ${fix(r.impact ?? r.windup)} s (from its rules; cast it to see its zones)` : 'cast it to see its zones';
      return `<div class="row"><span class="key" style="background:${r.color}">${esc(r.key)}</span>
        <span><b>${esc(r.name)}</b> <span class="meta">cooldown ${fix(r.cooldown)} s${r.range > 0 ? ` · reach ${fix(r.range)} m` : ''}${len ? ` · plays ${fix(len)} s` : ''} · ${r.blocks ? `blocks: ${esc(r.shape ?? '')}` : 'own code'}</span><br><span class="meta">${when}</span></span>
        <svg viewBox="0 0 100 18" preserveAspectRatio="none">${bits.join('')}</svg></div>`;
    }).join('') + `<div class="meta">The bar runs 0 to ${fix(span)} s. Pale: the danger zone shows; tick: the hit; bold: it lasts; grey line: the effect plays.</div>`;
  }

  private async balance(name: string, draft: boolean) {
    const q = name.includes(' ') ? `"${name}"` : name;
    const sim = `python pipeline/sim/sim.py hero ${q}${draft ? ' --drafts' : ''}`;
    const check = `python pipeline/tools/hero-check.py ${q}`;
    const cmd = (c: string) => `<div class="cmd"><code>${esc(c)}</code><button type="button" data-c="${esc(c)}">copy</button></div>`;
    this.balanceEl.innerHTML = `<div class="dim">The page cannot start Python: run these in the repo, then reload.</div>${cmd(sim)}${cmd(check)}<div class="res">reading the last results...</div>`;
    this.balanceEl.querySelectorAll('button[data-c]').forEach((b) => ((b as HTMLButtonElement).onclick = () => copy((b as HTMLElement).dataset.c ?? '')));
    const [s, c] = await Promise.all([json(`/pipeline/sim/out/last/${encodeURIComponent(name)}.json`), json(`/pipeline/sim/out/check/${encodeURIComponent(name)}.json`)]);
    const res = this.balanceEl.querySelector('.res');
    if (!res) return;
    const out: string[] = [];
    if (s?.row) {
      const r = s.row, good = r.pct >= 40 && r.pct <= 60;
      out.push(`<div>Simulator, ${esc(s.meta?.date ?? '')}: <b class="${good ? 'ok' : 'bad'}">${r.pct}% ±${r.ci}</b> over ${r.n} fights against ${esc((s.foes ?? []).join(', '))}${s.errorCount ? `, <span class="bad">${s.errorCount} errors</span>` : ''} <span class="dim">(target 40-60%)</span></div>`);
    } else out.push('<div class="dim">No simulator result saved for this hero yet (pipeline/sim/out/last/).</div>');
    if (c?.steps) {
      out.push(`<div>Checks, ${esc(c.date ?? '')}:</div><ul>${c.steps.map((st: { name: string; status: string; summary: string }) =>
        `<li><span class="${st.status === 'pass' ? 'ok' : st.status === 'fail' ? 'bad' : 'dim'}">${esc(st.status)}</span> ${esc(st.name)}: ${esc(st.summary)}</li>`).join('')}</ul>`);
    } else out.push('<div class="dim">No check result saved yet (pipeline/sim/out/check/).</div>');
    res.innerHTML = out.join('');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(url: string): Promise<any> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

const fix = (v: number) => String(+v.toFixed(2));
const pct = (d: number, span: number) => `${Math.max(0.5, (100 * Math.max(0, d)) / span)}%`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
