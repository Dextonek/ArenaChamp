import { clamp, easeInOut, lerp, rng, rgba, seg, type Ctx, type Pt } from '../../core';
import { halftone as halftoneSafe } from '../paper';
import { C, GOLD, HAND_FROM, HOUR, INDIGO, MINUTE, SKY, SPACE, STAR, glint, handOf, polar } from './common';

/**
 * The night side: the indigo-black ground, a field of faint stars, the chart's constellations turned to light, and the
 * stars pulled out of them to make the clock's two hands.
 */

/** When the hands' stars are pulled in, when the hands start to sweep, and when time stops (the hands meet at the top). */
export const PULL0 = 5.05;
export const SWEEP0 = 5.85;
export const T_STOP = 7.4;

/** The whole sky turns slowly round the clock (frozen when time stops). */
export const skyRot = (t: number) => 0.035 * (Math.min(t, T_STOP) - 3.2);

/** The hands' angles at time t: they gather speed and both arrive at the top at T_STOP. */
export function handAngles(t: number) {
  const k = seg(Math.min(t, T_STOP), SWEEP0, T_STOP), e = 1 - k ** 2.3;
  const top = -Math.PI / 2;
  return {
    m: top - (Math.PI * 2 * 2 + (Math.PI * 2) / 3) * e,
    h: top - (Math.PI * 2 * 0.5 + Math.PI / 2) * e,
    /** Angular speed of the minute hand (radians a second), for its trail. */
    speed: (2.3 * k ** 1.3 * (Math.PI * 2 * 2 + (Math.PI * 2) / 3)) / (T_STOP - SWEEP0),
  };
}

/** A sky star's place at time t (turned with the sky). */
export function skyPos(p: Pt, t: number): Pt {
  const a = skyRot(t), dx = p.x - C.x, dy = p.y - C.y;
  return { x: C.x + dx * Math.cos(a) - dy * Math.sin(a), y: C.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** A hand slot's place at time t. */
export function slotPos(hand: 'h' | 'm', slot: number, t: number): Pt {
  const ang = handAngles(t)[hand];
  const [d, side] = (hand === 'h' ? HOUR : MINUTE).slots[slot];
  return polar(ang, d, side);
}

/** How far a hand star has been pulled from its constellation into its hand (0 to 1). */
export const pullK = (n: number, t: number) => easeInOut(seg(t, PULL0 + n * 0.055, PULL0 + n * 0.055 + 0.6));

/** Where sky star (c, i) is at time t: in the sky, or on its way to (or in) its hand. */
export function starPos(c: number, i: number, t: number): Pt {
  const p = skyPos(SKY[c].stars[i], t);
  const h = handOf(c, i);
  if (h < 0) return p;
  const k = pullK(h, t);
  if (k <= 0) return p;
  const q = slotPos(HAND_FROM[h].hand, HAND_FROM[h].slot, t);
  // A slight curve on the way in, so the stars swirl into place.
  const bend = Math.sin(Math.PI * k) * 90;
  const mx = lerp(p.x, q.x, k), my = lerp(p.y, q.y, k);
  const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
  return { x: mx - (dy / l) * bend, y: my + (dx / l) * bend };
}

/** The night ground: deep indigo to black, a halftone glow round the clock, a faint band of nebula (flat). */
export function spaceGround(ctx: Ctx, mono = 0) {
  const lerpHex = (a: string, b: string) => (mono > 0.5 ? b : a);
  const g = ctx.createRadialGradient(C.x, C.y, 60, C.x, C.y, 1200);
  g.addColorStop(0, lerpHex('#1d2360', '#5a554c'));
  g.addColorStop(0.45, lerpHex(INDIGO, '#2c2a26'));
  g.addColorStop(1, lerpHex(SPACE, '#100f0d'));
  ctx.fillStyle = g;
  ctx.fillRect(-300, -300, 2520, 1680);
  // A soft band of nebula across the frame.
  ctx.save();
  ctx.translate(C.x, C.y);
  ctx.rotate(-0.42);
  const n = ctx.createLinearGradient(0, -380, 0, 380);
  n.addColorStop(0, 'rgba(0,0,0,0)');
  n.addColorStop(0.5, mono > 0.5 ? 'rgba(150,145,135,0.12)' : 'rgba(92,70,170,0.16)');
  n.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = n;
  ctx.fillRect(-1600, -380, 3200, 760);
  ctx.restore();
  halftoneSafe(ctx, mono > 0.5 ? 'rgba(170,162,148,0.22)' : 'rgba(80,96,200,0.2)', 14, (x, y) => {
    const d = Math.hypot(x - C.x, y - C.y);
    return 0.9 - Math.abs(d - 560) / 300;
  }, { x: C.x - 900, y: C.y - 900, w: 1800, h: 1800 });
}

/** A field of faint stars, turning with the sky at half speed (flat). */
export function starField(ctx: Ctx, t: number, k = 1, mono = 0) {
  if (k <= 0) return;
  const r = rng(4242), rot = skyRot(t) * 0.5;
  const tw = Math.min(t, T_STOP);
  for (let i = 0; i < 340; i++) {
    const x = r.range(-200, 2120), y = r.range(-200, 1280), s = r.next() < 0.9 ? r.range(0.8, 1.8) : r.range(2.2, 3.2);
    const dx = x - C.x, dy = y - C.y;
    const px = C.x + dx * Math.cos(rot) - dy * Math.sin(rot), py = C.y + dx * Math.sin(rot) + dy * Math.cos(rot);
    const twinkle = 0.65 + 0.35 * Math.sin(tw * r.range(2, 6) + r.range(0, 6.28));
    ctx.fillStyle = rgba(mono > 0.5 ? '#d8d2c6' : r.next() < 0.8 ? STAR : '#9fb4ff', k * twinkle * r.range(0.35, 0.9));
    ctx.beginPath();
    ctx.arc(px, py, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The constellations as light: lines and glints on the glow layer, star dots on the flat one. Lines to a star being pulled
 * into a hand stretch and fade. `mono` draws them in grey on the flat layer only (time stopped).
 */
export function skyConstellations(flat: Ctx, glow: Ctx, t: number, k: number, mono = 0) {
  if (k <= 0) return;
  for (let c = 0; c < SKY.length; c++) {
    const con = SKY[c];
    const pos = con.stars.map((_, i) => starPos(c, i, t));
    for (const [i, j] of con.edges) {
      const hi = handOf(c, i), hj = handOf(c, j);
      const fade = 1 - Math.max(hi >= 0 ? pullK(hi, t) : 0, hj >= 0 ? pullK(hj, t) : 0);
      const a = k * clamp(fade * 1.4);
      if (a <= 0) continue;
      if (mono > 0.5) {
        flat.strokeStyle = `rgba(220,214,200,${0.5 * a})`;
        flat.lineWidth = 2;
        flat.beginPath(); flat.moveTo(pos[i].x, pos[i].y); flat.lineTo(pos[j].x, pos[j].y); flat.stroke();
        continue;
      }
      for (const [w, col, al] of [[7, GOLD, 0.16], [2.2, '#ffe9bc', 0.7]] as const) {
        glow.strokeStyle = rgba(col, al * a);
        glow.lineWidth = w;
        glow.beginPath(); glow.moveTo(pos[i].x, pos[i].y); glow.lineTo(pos[j].x, pos[j].y); glow.stroke();
      }
    }
    con.stars.forEach((_, i) => {
      if (handOf(c, i) >= 0) return; // drawn with the hands
      const p = pos[i], big = i === 0 ? 1.25 : 1;
      flat.fillStyle = mono > 0.5 ? `rgba(235,230,220,${k})` : rgba(STAR, k);
      flat.beginPath();
      flat.arc(p.x, p.y, 4 * big, 0, Math.PI * 2);
      flat.fill();
      if (mono <= 0.5) glint(glow, p, 9 * big, 0.85 * k, '#ffe2a0', 0.2 + 0.1 * Math.sin(t * 2 + i));
    });
  }
}

/** The stars of the hands (wherever they are on their way), as flat dots and glints. */
export function handStars(flat: Ctx, glow: Ctx, t: number, k: number, mono = 0) {
  if (k <= 0) return;
  HAND_FROM.forEach((h, n) => {
    const p = starPos(h.c, h.i, t), tip = h.slot === (h.hand === 'h' ? HOUR : MINUTE).slots.length - 1;
    const arrive = pullK(n, t);
    flat.fillStyle = mono > 0.5 ? `rgba(240,235,222,${k})` : rgba(STAR, k);
    flat.beginPath();
    flat.arc(p.x, p.y, (4 + (tip ? 3 : 1) * arrive), 0, Math.PI * 2);
    flat.fill();
    const size = (9 + (tip ? 12 : 2) * arrive) * (1 + 0.3 * Math.sin(Math.PI * arrive)) * (mono > 0.5 && !tip ? 0.55 : 1);
    glint(glow, p, size, k * (mono > 0.5 ? 1 : 0.9), mono > 0.5 ? GOLD : '#ffe6b0', 0.15);
  });
}
