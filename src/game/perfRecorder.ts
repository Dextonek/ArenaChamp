import type * as THREE from 'three';
import type { GameApi } from '../runtime';

/**
 * A recorder for measuring the game on a real device, a phone above all: the performance tool (docs/pipeline/performance.md)
 * measures a computer with a phone-sized screen, not a phone. It is loaded only when the address has `?perf=1`
 * (src/game/main.ts): without that nothing of this file runs, nothing is recorded and nothing is kept.
 *
 * While a fight is on screen it times every frame and notes once a second what is being drawn. A small line at the screen's
 * left edge shows it working. Back in the menu a card says how it went in plain words, with Copy and Save for the whole
 * record (JSON), so it can be pasted into a chat or laid beside the tool's numbers (`python pipeline/tools/perf-phone.py`).
 * The last few records are kept in the browser (`aok.perf.records`). Nothing is sent anywhere.
 */

const STORE = 'aok.perf.records';
/** How many records are kept. */
const KEEP = 6;
/** A stretch shorter than this (s) is not a record. */
const LEAST = 3;
/** The frame-length buckets of a record, by their upper edge (ms); the last takes everything longer. */
const EDGES = [9, 13, 17.5, 21, 34, 50, 100];

interface Second { t: number; frames: number; longest: number; canvas: [number, number]; level: string; share: number; lean: boolean; calls: number; triangles: number }

export interface PerfRecord {
  version: 1;
  at: string;
  /** What was played ('CPU duel', 'Raid', ...), the hero and the last room. */
  mode: string;
  hero: string;
  room: string;
  seconds: number;
  frames: number;
  /** Frame lengths in ms. */
  median: number;
  mean: number;
  p95: number;
  p99: number;
  longest: number;
  /** The share of frames longer than a 60th and a 30th of a second (with a little room), and how many took over 50 and 100 ms. */
  missed60: number;
  missed30: number;
  over50: number;
  over100: number;
  /** Frames by length: up to 9, 13, 17.5, 21, 34, 50, 100 ms, and longer. */
  buckets: number[];
  /** What was drawn at the end: the canvas in pixels, the Graphics level, Auto's share of pixels and whether it left the shadows out. */
  canvas: [number, number];
  level: string;
  share: number;
  lean: boolean;
  /** Draw calls and triangles a frame (the median of the per-second notes). */
  calls: number;
  triangles: number;
  device: { ua: string; screen: [number, number]; window: [number, number]; pixelRatio: number; gpu: string; cores: number; memoryGB: number; touch: boolean };
  build: string;
  /** One row a second (the first ten minutes). */
  perSecond: Second[];
}

function readStore(): PerfRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function median(list: number[]) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Starts recording. `renderer`: the game's own; `mode`: what is being played now ('' in the menu). */
export function startPerfRecorder(api: GameApi, renderer: THREE.WebGLRenderer, mode: () => string) {
  // All of a frame's passes are counted (three would start again at each pass): this recorder resets the count once a frame.
  renderer.info.autoReset = false;
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const nav = navigator as Navigator & { deviceMemory?: number };
  const device = (): PerfRecord['device'] => ({
    ua: navigator.userAgent,
    screen: [screen.width, screen.height],
    window: [innerWidth, innerHeight],
    pixelRatio: +devicePixelRatio.toFixed(2),
    gpu: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    cores: navigator.hardwareConcurrency ?? 0,
    memoryGB: nav.deviceMemory ?? 0,
    touch: navigator.maxTouchPoints > 0,
  });

  // --- what is on the page -------------------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
    .perf-line { position: fixed; left: calc(4px + env(safe-area-inset-left, 0px)); top: 42%; z-index: 9; pointer-events: none; display: none;
      font: 600 10px/1.35 ui-monospace, Consolas, monospace; color: #d8f5c8; background: rgba(8, 6, 10, 0.55); padding: 3px 5px; border-radius: 5px; white-space: pre; }
    .perf-line.slow { color: #ffd27a; } .perf-line.bad { color: #ff9a8a; }
    /* A phone held sideways: the hero's panel takes the left edge's middle, the corner above it is free. */
    @media (orientation: landscape) and (max-height: 520px) { .perf-line { top: calc(4px + env(safe-area-inset-top, 0px)); } }
    .perf-chip { position: fixed; right: calc(8px + env(safe-area-inset-right, 0px)); top: calc(54px + env(safe-area-inset-top, 0px)); z-index: 40;
      font: 600 11px ui-sans-serif, system-ui; color: #efe4cf; background: rgba(20, 16, 26, 0.94); border: 1px solid #c9a24a; border-radius: 999px; padding: 4px 10px; cursor: pointer; }
    .perf-card { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; padding: 14px; background: rgba(4, 3, 6, 0.72); }
    .perf-card > div { width: min(460px, 100%); max-height: 100%; overflow: auto; background: #17131d; border: 1px solid #c9a24a; border-radius: 12px; padding: 16px 16px 14px;
      color: #efe4cf; font: 500 14px/1.5 ui-sans-serif, system-ui; box-shadow: 0 12px 50px rgba(0, 0, 0, 0.7); }
    .perf-card h3 { margin: 0 0 2px; font-size: 18px; color: #e6bd62; } .perf-card .sub { color: #a79c8b; font-size: 12px; margin-bottom: 10px; }
    .perf-card .big { font-size: 26px; font-weight: 700; } .perf-card .big small { font-size: 13px; font-weight: 500; color: #a79c8b; }
    .perf-card ul { margin: 8px 0 12px; padding-left: 18px; } .perf-card li { margin: 3px 0; }
    .perf-card .row { display: flex; gap: 8px; flex-wrap: wrap; } .perf-card button { flex: 1 1 90px; padding: 9px 10px; border-radius: 8px; border: 1px solid #5a4a2a;
      background: #241c12; color: #f3e6c8; font: 600 13px ui-sans-serif, system-ui; cursor: pointer; } .perf-card button.main { background: linear-gradient(180deg, #e2bb62, #a57a2a); color: #1a1208; border-color: #e2bb62; }
    .perf-card .note { color: #a79c8b; font-size: 12px; margin-top: 10px; }
  `;
  document.head.append(css);
  const line = document.createElement('div');
  line.className = 'perf-line';
  const chip = document.createElement('button');
  chip.className = 'perf-chip';
  const card = document.createElement('div');
  card.className = 'perf-card';
  const box = document.createElement('div');
  card.append(box);
  document.body.append(line, chip, card);
  card.addEventListener('click', (e) => { if (e.target === card) card.style.display = 'none'; });

  let records = readStore();
  const keep = () => {
    records = records.slice(0, KEEP);
    try { localStorage.setItem(STORE, JSON.stringify(records)); } catch { /* a private window: the records last for the page */ }
  };
  const showChip = () => { chip.textContent = records.length ? `Recorder on · ${records.length} ${records.length === 1 ? 'record' : 'records'}` : 'Recorder on · play a fight'; };
  chip.addEventListener('click', () => { if (records.length) show(0); });
  showChip();

  const rate = (ms: number) => (ms > 0 ? Math.round(1000 / ms) : 0);
  const pct = (share: number) => (share < 0.005 ? 'none' : share < 0.1 ? `${(share * 100).toFixed(1)} %` : `${Math.round(share * 100)} %`);

  /** The card for record `i` (0: the newest). */
  function show(i: number) {
    const r = records[i];
    if (!r) return;
    const drawn = `${r.canvas[0]} × ${r.canvas[1]} pixels, Graphics: ${r.level}${r.level === 'auto' ? ` (${Math.round(r.share * 100)} % of the screen's own pixels${r.lean ? ', shadows left out' : ''})` : ''}`;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
    const big = el('div', '', 'big');
    big.append(`${rate(r.median)} `, el('small', `frames a second (a frame takes ${r.median.toFixed(1)} ms)`));
    const list = el('ul');
    for (const text of [
      `Frames that missed 60 a second: ${pct(r.missed60)}; that missed 30 a second: ${pct(r.missed30)}.`,
      `The longest frame: ${Math.round(r.longest)} ms. Frames over 50 ms: ${r.over50}; over 100 ms: ${r.over100}.`,
      `The slowest 1 in 100 frames took ${r.p99.toFixed(0)} ms or more.`,
      `Drawn: ${drawn}.`,
      `${r.calls} draw calls and ${r.triangles.toLocaleString()} triangles a frame.`,
      `Device: ${r.device.gpu || 'graphics card not named'}; screen ${r.device.screen[0]} × ${r.device.screen[1]} at ${r.device.pixelRatio} pixels a point.`,
    ]) list.append(el('li', text));
    const row = el('div', '', 'row');
    const copy = el('button', 'Copy', 'main'), save = el('button', 'Save'), older = el('button', i + 1 < records.length ? 'Older' : 'Newest'), close = el('button', 'Close');
    const text = () => JSON.stringify(r);
    copy.addEventListener('click', () => {
      const done = (ok: boolean) => { copy.textContent = ok ? 'Copied' : 'Could not copy: use Save'; };
      const byHand = () => {
        // Where the clipboard is not allowed (an old browser, a page not on https): select the text in a hidden box.
        const t = document.createElement('textarea');
        t.value = text();
        t.style.cssText = 'position:fixed;left:-999px;top:0';
        document.body.append(t);
        t.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        t.remove();
        done(ok);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text()).then(() => done(true), byHand);
      else byHand();
    });
    save.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text()], { type: 'application/json' }));
      a.download = `arena-of-kits-perf-${r.at.replace(/[:.]/g, '-')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    older.addEventListener('click', () => show(i + 1 < records.length ? i + 1 : 0));
    close.addEventListener('click', () => { card.style.display = 'none'; });
    row.append(copy, save);
    if (records.length > 1) row.append(older);
    row.append(close);
    box.replaceChildren(
      el('h3', 'How it ran'),
      el('div', `${r.mode}${r.hero ? `, ${r.hero}` : ''}${r.room ? `, ${r.room}` : ''} · ${Math.round(r.seconds)} s · ${new Date(r.at).toLocaleString()} · record ${i + 1} of ${records.length}`, 'sub'),
      big, list, row,
      el('div', 'Copy puts the whole record on the clipboard, to paste into a chat; Save downloads it as a file. Nothing is sent anywhere. The recorder is on because the address has ?perf=1.', 'note'),
    );
    card.style.display = 'flex';
  }

  // --- the recording ---------------------------------------------------------------------------------------------------
  let frames: number[] = [];
  let seconds: Second[] = [];
  let playing = '', hero = '', room = '', startedAt = '';
  let inSecond = 0, secondT = 0, secondLongest = 0, total = 0;
  let last = 0;
  const reset = () => { frames = []; seconds = []; inSecond = 0; secondT = 0; secondLongest = 0; total = 0; playing = ''; };

  function finish() {
    const n = frames.length;
    if (total >= LEAST * 1000 && n > 30) {
      const sorted = [...frames].sort((a, b) => a - b);
      const at = (p: number) => sorted[Math.min(n - 1, Math.floor(n * p))];
      const buckets = new Array(EDGES.length + 1).fill(0);
      for (const ms of frames) { let b = 0; while (b < EDGES.length && ms > EDGES[b]) b++; buckets[b]++; }
      const lastSecond = seconds[seconds.length - 1];
      const record: PerfRecord = {
        version: 1, at: startedAt, mode: playing, hero, room, seconds: +(total / 1000).toFixed(1), frames: n,
        median: +at(0.5).toFixed(2), mean: +(total / n).toFixed(2), p95: +at(0.95).toFixed(1), p99: +at(0.99).toFixed(1), longest: +sorted[n - 1].toFixed(1),
        missed60: +(frames.filter((ms) => ms > 17.5).length / n).toFixed(4), missed30: +(frames.filter((ms) => ms > 34).length / n).toFixed(4),
        over50: frames.filter((ms) => ms > 50).length, over100: frames.filter((ms) => ms > 100).length, buckets,
        canvas: lastSecond?.canvas ?? [renderer.domElement.width, renderer.domElement.height], level: api.quality.level, share: +api.quality.share.toFixed(3), lean: api.quality.lean,
        calls: median(seconds.map((s) => s.calls)), triangles: median(seconds.map((s) => s.triangles)),
        device: device(), build: typeof __BUILD__ === 'string' ? __BUILD__ : '', perSecond: seconds.slice(0, 600),
      };
      records.unshift(record);
      keep();
      showChip();
      show(0);
    }
    reset();
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    const info = renderer.info.render;
    const calls = info.calls, triangles = info.triangles;
    renderer.info.reset();
    const ms = now - last;
    last = now;
    const on = api.duel.on && !api.view.covered;
    chip.style.display = on || card.style.display === 'flex' ? 'none' : '';
    if (!on) {
      line.style.display = 'none';
      if (frames.length) finish();
      return;
    }
    // Behind a loading page, in a hidden tab or after a pause nothing is a frame of the fight: the stretch goes on after it.
    if (api.view.loading || document.hidden || ms > 1000 || ms <= 0) return;
    if (!frames.length) { startedAt = new Date().toISOString(); }
    playing = mode() || playing || 'Fight';
    hero = api.heroMode.kitName;
    room = api.duel.currentArena?.name ?? room;
    if (frames.length < 72000) frames.push(ms);
    total += ms;
    inSecond++;
    secondT += ms;
    if (ms > secondLongest) secondLongest = ms;
    if (secondT >= 1000) {
      const c = renderer.domElement;
      const q = api.quality;
      seconds.push({ t: Math.round(total / 1000), frames: inSecond, longest: Math.round(secondLongest), canvas: [c.width, c.height], level: q.level, share: +q.share.toFixed(2), lean: q.lean, calls, triangles });
      const fps = Math.round((inSecond * 1000) / secondT);
      line.textContent = `${fps} fps\n${c.width}×${c.height}\n${q.level}${q.level === 'auto' ? ` ${Math.round(q.share * 100)}%` : ''}`;
      line.className = `perf-line${fps < 28 ? ' bad' : fps < 50 ? ' slow' : ''}`;
      line.style.display = 'block';
      inSecond = 0;
      secondT = 0;
      secondLongest = 0;
    }
  }
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  return { records: () => records, show };
}
