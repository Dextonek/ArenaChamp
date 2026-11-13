/**
 * The picture's quality: how many pixels the game draws and how fine its shadows are. Drawing is what limits the frame
 * rate (docs/pipeline/performance.md): the time for a frame grows with the number of pixels, so drawing fewer and letting
 * the browser stretch the picture is what makes a slow graphics card smooth. It costs sharpness, nothing else: the same
 * spells, lights and glow at every level.
 *
 *  - `high`:   the screen's own pixels (two to a point at most, as always).
 *  - `medium`: at most 1.2 million pixels (full HD has 2.1), softer shadows.
 *  - `low`:    at most 0.6 million pixels, no shadows under the figures.
 *  - `auto`:   between `high` and `low`, set by the device itself: before each fight the scene is drawn a few times
 *              and timed, and the number of pixels is chosen so a frame fits in a 60th of a second; during the fight it
 *              follows the frame rate (down quickly, up carefully).
 *
 * The player's choice is kept in the browser (`aok.quality`), with the share of pixels `auto` last settled on.
 */
export type QualityLevel = 'auto' | 'high' | 'medium' | 'low';

export const QUALITY_NAMES: Record<QualityLevel, string> = { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' };
export const QUALITY_ORDER: QualityLevel[] = ['auto', 'high', 'medium', 'low'];
/** What a browser that has never chosen starts with. `high` is the look the game always had. */
export const QUALITY_DEFAULT: QualityLevel = 'high';

/** A fixed level: the most pixels it draws, and its shadow map's size (0: no shadows). */
export const QUALITY_SPEC: Record<Exclude<QualityLevel, 'auto'>, { maxPixels: number; shadow: number }> = {
  high: { maxPixels: Infinity, shadow: 2048 },
  medium: { maxPixels: 1.2e6, shadow: 1024 },
  low: { maxPixels: 0.6e6, shadow: 0 },
};

/** `auto` never draws fewer pixels than this (or than three tenths of the screen's own). */
export const AUTO_MIN_PIXELS = 0.45e6;
export const AUTO_MIN_SHARE = 0.3;
/** A frame at rest should take this long (ms), so a fight's spells still fit in 16.7. */
export const AUTO_REST_MS = 12.5;

const STORE = 'aok.quality', STORE_SHARE = 'aok.quality.share';

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* a private window: the choice lasts for the page */ }
}

export function loadQuality(): QualityLevel {
  // `?quality=low` in the address: for pictures and for trying a level without changing what is kept.
  const asked = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null;
  const v = asked ?? read(STORE);
  return v === 'auto' || v === 'high' || v === 'medium' || v === 'low' ? v : QUALITY_DEFAULT;
}
export function saveQuality(level: QualityLevel) {
  write(STORE, level);
}
/** The share of the screen's own pixels `auto` last drew (1: all of them). */
export function loadShare() {
  const v = Number(read(STORE_SHARE));
  return v > 0 && v <= 1 ? v : 1;
}
export function saveShare(share: number) {
  write(STORE_SHARE, share.toFixed(3));
}

/**
 * Follows the frame rate during a fight and says when `auto` should draw fewer pixels or may draw more. Fed every
 * frame's length; it judges windows of 40 frames by their mean without the three longest (a stutter is not a slow card).
 * Down as soon as a window is slow, by as much as the window was too long. Up only after four fast windows in a row, a
 * little, and if that makes the next window slow it goes back and waits longer each time before trying again.
 */
export class FramePacer {
  private frames: number[] = [];
  private fast = 0;
  private triedUp = false;
  /** Windows to wait before the next try to go up (grows when a try fails). */
  private wait = 4;
  private hold = 0;

  /** Forgets what it has seen (a new fight, a level set by hand, the tab was hidden). */
  reset() {
    this.frames.length = 0;
    this.fast = 0;
    this.triedUp = false;
    this.hold = 0;
  }

  /** One frame took `ms`. Returns the factor to change the share of pixels by (below 1: fewer), or 0 for no change. */
  feed(ms: number): number {
    // A frame of a quarter second is a tab that slept or a load, not a frame rate.
    if (ms > 250) { this.reset(); return 0; }
    this.frames.push(ms);
    if (this.frames.length < 40) return 0;
    const sorted = this.frames.sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < sorted.length - 3; i++) sum += sorted[i];
    const mean = sum / (sorted.length - 3);
    this.frames.length = 0;
    if (mean > 19.5) {
      // Too slow. If this follows a try to go up, the try failed: back down, and wait longer next time.
      this.fast = 0;
      if (this.triedUp) this.wait = Math.min(this.wait * 2, 64);
      this.triedUp = false;
      return Math.max(0.6, Math.min(0.92, 16.7 / mean));
    }
    this.triedUp = false;
    if (mean < 17.4) {
      if (this.hold > 0) { this.hold--; return 0; }
      if (++this.fast >= this.wait) {
        this.fast = 0;
        this.triedUp = true;
        this.hold = 1;
        return 1.1;
      }
    } else this.fast = 0;
    return 0;
  }
}
