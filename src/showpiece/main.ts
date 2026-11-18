import { Compositor } from './compositor';
import { H, W } from './core';
import type { Piece } from './piece';

/**
 * The showpiece page (/showpiece): plays short anime special moves drawn in 2D (the first, "Scarlet Sheath", after the
 * user's reference clip of 2026-11-18), with a timeline of each one's beats, and saves them as videos.
 *
 * `?piece=<id>` picks a piece. For tools: `window.showpiece.draw(t)` draws the frame at time t (seconds); `setSize(w, h)`
 * sets the drawing size; `ready` resolves when the piece's font is loaded; `canvas` is the picture.
 */

const found = import.meta.glob<{ default: Piece }>('./pieces/*.ts', { eager: true });
const PIECES = Object.values(found).map((m) => m.default).filter(Boolean)
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.title.localeCompare(b.title));
const wanted = new URLSearchParams(location.search).get('piece');
const piece = PIECES.find((p) => p.id === wanted) ?? PIECES[0];
const DURATION = piece.duration;
const BEATS = piece.beats;
const drawFrame = piece.draw;

document.title = `${piece.title} · Showpiece`;
document.getElementById('name')!.textContent = piece.title;
document.getElementById('sub')!.textContent = piece.subtitle;
document.getElementById('about')!.textContent = piece.about;
const list = document.getElementById('pieces')!;
for (const p of PIECES) {
  const a = document.createElement('a');
  a.href = `?piece=${p.id}`;
  a.textContent = p.title;
  if (p === piece) a.className = 'on';
  list.appendChild(a);
}

/** The piece's font, only its few characters. */
const ready: Promise<void> = (async () => {
  // A piece's models must be in before a frame is filmed: a missing one would film without it, silently.
  const models = piece.preload?.();
  const f = piece.fonts;
  if (!f) {
    await models;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weight}&text=${encodeURIComponent(f.text)}&display=block`;
  document.head.appendChild(link);
  await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
  try {
    await Promise.race([document.fonts.load(`${f.weight} 40px "${f.family}"`, f.text), new Promise((r) => setTimeout(r, 4000))]);
  } catch { /* the device's own font, then */ }
  await models;
})();

const canvas = document.getElementById('picture') as HTMLCanvasElement;
const comp = new Compositor(canvas);
const layers = { flat: comp.flatCtx, glow: comp.glowCtx };

let t = 0;
let playing = true;
let loop = true;
let recording = false;
let last = performance.now();
/** A drawing size chosen by a tool; otherwise it follows the window. */
let fixedSize: [number, number] | null = null;

function draw(time: number) {
  comp.begin();
  const screen = drawFrame(layers, time);
  comp.present(screen, time);
}

function fit() {
  if (fixedSize) {
    comp.setSize(fixedSize[0], fixedSize[1]);
    return;
  }
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Phones draw at 1280 at most: the 2D layers are drawn by the processor.
  const cap = Math.min(window.innerWidth, window.innerHeight) < 700 ? 1280 : W;
  const w = Math.min(cap, Math.max(320, box.width * dpr));
  comp.setSize(w, (w * H) / W);
}

// --- The controls ---------------------------------------------------------------------------------------------------
const playBtn = document.getElementById('play') as HTMLButtonElement;
const loopBtn = document.getElementById('loop') as HTMLButtonElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const time = document.getElementById('time')!;
const bar = document.getElementById('bar')!;
const head = document.getElementById('head')!;
const beatName = document.getElementById('beat')!;

for (const b of BEATS) {
  const tick = document.createElement('button');
  tick.className = 'tick';
  tick.style.left = `${(b.t0 / DURATION) * 100}%`;
  tick.style.width = `${((b.t1 - b.t0) / DURATION) * 100}%`;
  tick.title = b.name;
  tick.innerHTML = `<span>${b.name}</span>`;
  tick.onclick = (e) => {
    e.stopPropagation();
    t = b.t0;
    showTime();
  };
  bar.appendChild(tick);
}

function showTime() {
  head.style.left = `${(t / DURATION) * 100}%`;
  time.textContent = `${t.toFixed(2)} / ${DURATION.toFixed(1)} s`;
  const b = BEATS.find((x) => t >= x.t0 && t < x.t1) ?? BEATS[BEATS.length - 1];
  beatName.textContent = b.name;
  for (const [i, el] of [...bar.querySelectorAll('.tick')].entries()) el.classList.toggle('on', BEATS[i] === b);
}

function setPlaying(p: boolean) {
  playing = p;
  playBtn.textContent = p ? 'Pause' : 'Play';
  last = performance.now();
}

playBtn.onclick = () => {
  if (!playing && t >= DURATION) t = 0;
  setPlaying(!playing);
};
loopBtn.onclick = () => {
  loop = !loop;
  loopBtn.classList.toggle('on', loop);
};
loopBtn.classList.toggle('on', loop);

// Dragging on the timeline scrubs.
let scrubbing = false;
const scrubTo = (e: PointerEvent) => {
  const r = bar.getBoundingClientRect();
  t = Math.max(0, Math.min(DURATION, ((e.clientX - r.left) / r.width) * DURATION));
  showTime();
};
bar.addEventListener('pointerdown', (e) => {
  if (recording) return;
  scrubbing = true;
  bar.setPointerCapture(e.pointerId);
  setPlaying(false);
  scrubTo(e);
});
bar.addEventListener('pointermove', (e) => scrubbing && scrubTo(e));
bar.addEventListener('pointerup', () => (scrubbing = false));

window.addEventListener('keydown', (e) => {
  if (recording) return;
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  if (e.code === 'ArrowRight') { setPlaying(false); t = Math.min(DURATION, t + 1 / 30); showTime(); }
  if (e.code === 'ArrowLeft') { setPlaying(false); t = Math.max(0, t - 1 / 30); showTime(); }
});

// --- Saving a video ---------------------------------------------------------------------------------------------------
/**
 * Plays the whole piece once from the start in real time and records the picture. A browser's recorder stamps each frame
 * with the clock, so it cannot go faster than real time; mp4 where the browser can make it (iPhones do not play webm).
 */
saveBtn.onclick = async () => {
  if (recording) return;
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const type = types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  if (!type) {
    saveBtn.textContent = 'This browser cannot record';
    return;
  }
  recording = true;
  document.body.classList.add('recording');
  saveBtn.textContent = 'Recording…';
  fixedSize = Math.min(window.innerWidth, window.innerHeight) < 700 ? [1280, 720] : [1920, 1080];
  fit();
  t = 0;
  draw(0);
  const stream = canvas.captureStream(60);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  setPlaying(true);
  await new Promise<void>((r) => {
    const wait = () => (t >= DURATION ? r() : requestAnimationFrame(wait));
    wait();
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((x) => x.stop());
  const blob = new Blob(chunks, { type: type.split(';')[0] });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${piece.id}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  recording = false;
  fixedSize = null;
  document.body.classList.remove('recording');
  saveBtn.textContent = 'Save video';
  fit();
};

// --- The loop -------------------------------------------------------------------------------------------------------
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    t += dt;
    if (t >= DURATION) {
      if (loop && !recording) t -= DURATION;
      else { t = DURATION; if (!recording) setPlaying(false); }
    }
  }
  fit();
  draw(Math.min(t, DURATION - 1e-4));
  showTime();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

declare global {
  interface Window {
    showpiece: {
      draw: (t: number) => void;
      setSize: (w: number, h: number) => void;
      pause: () => void;
      duration: number;
      beats: typeof BEATS;
      piece: string;
      pieces: string[];
      ready: Promise<void>;
      canvas: HTMLCanvasElement;
      /** The two drawn layers before the screen pass (for checks). */
      layers: { flat: HTMLCanvasElement; glow: HTMLCanvasElement };
    };
  }
}

window.showpiece = {
  draw: (time: number) => { t = time; draw(time); showTime(); },
  setSize: (w: number, h: number) => { fixedSize = [w, h]; fit(); },
  pause: () => setPlaying(false),
  duration: DURATION,
  beats: BEATS,
  piece: piece.id,
  pieces: PIECES.map((p) => p.id),
  ready,
  canvas,
  layers: { flat: comp.flat, glow: comp.glow },
};
