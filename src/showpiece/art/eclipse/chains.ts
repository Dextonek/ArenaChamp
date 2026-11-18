import { easeOut, lerp, rgba, smooth, seg, wobble, type Ctx, type Pt } from '../../core';
import { C, MOON_R } from './sky';

/**
 * Black Sun Eclipse, the chains of shadow: four chains lash out from the black sun's rim towards the frame's corners,
 * whipping as they go, and pull taut into an X. Each link is black with a violet edge; the head is a black spear point.
 * Later they shatter into black shards.
 */

interface Chain {
  /** The angle it leaves the disc at, and where it ends (beyond the frame's corner). */
  angle: number;
  end: Pt;
  /** When it lashes out, and how long its head takes. */
  t0: number;
  dur: number;
  /** Which way it first whips. */
  side: number;
  seed: number;
}

const ENDS: Pt[] = [{ x: 2060, y: -90 }, { x: -140, y: 1170 }, { x: -140, y: -90 }, { x: 2060, y: 1170 }];
export const CHAINS: Chain[] = ENDS.map((end, i) => ({
  angle: Math.atan2(end.y - C.y, end.x - C.x),
  end,
  t0: 4.3 + i * 0.27,
  dur: 0.62,
  side: i % 2 ? 1 : -1,
  seed: 300 + i * 17,
}));

/** When the four pull taut together. */
export const LOCK = 6.08;

/** The spacing of links along a chain, in picture units. */
const STEP = 64;

/** A chain's centre line at time t: from the rim to its head, whipping until it is taut. */
export function chainLine(ch: Chain, t: number): { pts: Pt[]; head: number } {
  const start = { x: C.x + Math.cos(ch.angle) * (MOON_R - 10), y: C.y + Math.sin(ch.angle) * (MOON_R - 10) };
  const head = easeOut(seg(t, ch.t0, ch.t0 + ch.dur));
  const taut = smooth(seg(t, LOCK - 0.12, LOCK + 0.02));
  const ax = ch.end.x - start.x, ay = ch.end.y - start.y, len = Math.hypot(ax, ay);
  const nx = -ay / len, ny = ax / len;
  const w = wobble(ch.seed);
  // The whip: a travelling wave that dies down after the head arrives, and is pulled straight at the lock.
  const settle = 1 - 0.65 * smooth(seg(t, ch.t0 + ch.dur, ch.t0 + ch.dur + 0.6));
  const amp = 110 * settle * (1 - taut);
  const pts: Pt[] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * head;
    const wave = Math.sin(s * 9 - (t - ch.t0) * 13) * ch.side + 0.4 * w(s * 4 + t * 2);
    const off = amp * wave * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (0.4 + 0.6 * s);
    // At the lock it overshoots a little, a snap back along its length.
    const snap = 1 + 0.02 * Math.sin(seg(t, LOCK, LOCK + 0.3) * Math.PI) * (1 - seg(t, LOCK, LOCK + 0.3));
    pts.push({ x: start.x + ax * s * snap + nx * off, y: start.y + ay * s * snap + ny * off });
  }
  return { pts, head };
}

/** A link's place: its centre and direction, every STEP along the line. */
export interface Link { x: number; y: number; a: number; face: boolean; i: number }

export function links(pts: Pt[]): Link[] {
  const out: Link[] = [];
  let acc = STEP / 2, i = 0;
  for (let j = 1; j < pts.length; j++) {
    const p = pts[j - 1], q = pts[j];
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    while (acc <= seg) {
      const u = acc / seg;
      out.push({ x: lerp(p.x, q.x, u), y: lerp(p.y, q.y, u), a, face: i % 2 === 0, i });
      i++;
      acc += STEP;
    }
    acc -= seg;
  }
  return out;
}

export type ChainStyle = 'flat' | 'glow' | 'ink' | 'cut';

/** A face-on link: a long ring (stadium), as an outline path. */
function stadium(ctx: Ctx, hl: number, hw: number) {
  ctx.moveTo(-hl + hw, -hw);
  ctx.lineTo(hl - hw, -hw);
  ctx.arc(hl - hw, 0, hw, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-hl + hw, hw);
  ctx.arc(-hl + hw, 0, hw, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

/** Draws one link in a style: flat (black, violet edge), glow (a thin violet glint), ink (black on paper), cut (opaque black on glow). */
export function drawLink(ctx: Ctx, l: Link, style: ChainStyle, scale = 1, alpha = 1) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.a);
  ctx.scale(scale, scale);
  const hl = 50, hw = 25, th = 16;
  if (l.face) {
    ctx.beginPath();
    stadium(ctx, hl, hw);
    // The inner hole, wound the other way.
    ctx.save();
    ctx.scale(-1, 1);
    stadium(ctx, hl - th, hw - th);
    ctx.restore();
    if (style === 'glow') {
      // A glint along the top of the ring only.
      ctx.beginPath();
      ctx.moveTo(-hl + hw + 2, -hw + 3);
      ctx.lineTo(hl - hw - 2, -hw + 3);
      ctx.strokeStyle = rgba('#d8bcff', 0.7 * alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = style === 'cut' ? `rgba(6,3,10,${alpha})` : rgba('#0a0710', alpha);
      ctx.fill('evenodd');
      if (style === 'flat') {
        ctx.strokeStyle = rgba('#7d4ae0', alpha);
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }
  } else {
    ctx.beginPath();
    const bl = hl + 2, bw = 9;
    ctx.moveTo(-bl + bw, -bw);
    ctx.lineTo(bl - bw, -bw);
    ctx.arc(bl - bw, 0, bw, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-bl + bw, bw);
    ctx.arc(-bl + bw, 0, bw, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.closePath();
    if (style === 'glow') {
      ctx.beginPath();
      ctx.moveTo(-bl + 10, -2);
      ctx.lineTo(bl - 10, -2);
      ctx.strokeStyle = rgba('#e0c4ff', 0.6 * alpha);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      ctx.fillStyle = style === 'cut' ? `rgba(6,3,10,${alpha})` : rgba('#0a0710', alpha);
      ctx.fill();
      if (style === 'flat') {
        ctx.strokeStyle = rgba('#7d4ae0', alpha);
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** The spear point at a chain's head (flat black with a violet edge, or plain ink). */
function spear(ctx: Ctx, at: Pt, a: number, style: ChainStyle) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(a);
  ctx.scale(1.45, 1.45);
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(10, -24);
  ctx.lineTo(18, -6);
  ctx.lineTo(-14, -10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-14, 10);
  ctx.lineTo(18, 6);
  ctx.lineTo(10, 24);
  ctx.closePath();
  if (style === 'glow') {
    ctx.strokeStyle = rgba('#e4ccff', 0.8);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    ctx.fillStyle = style === 'cut' ? '#06030a' : '#0a0710';
    ctx.fill();
    if (style === 'flat') {
      ctx.strokeStyle = '#a36cff';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A trail of shadow smoke behind a lashing chain (flat): a ragged dark violet ribbon along it. */
function smoke(ctx: Ctx, pts: Pt[], k: number, seed: number) {
  if (k <= 0 || pts.length < 2) return;
  const w = wobble(seed);
  ctx.fillStyle = rgba('#12071f', 0.55 * k);
  const n = pts.length;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const u = i / (n - 1);
    const width = (34 + 26 * w(u * 9)) * Math.sin(Math.PI * Math.min(1, u * 1.05)) * k;
    left.push({ x: pts[i].x + nx * width, y: pts[i].y + ny * width });
    right.push({ x: pts[i].x - nx * width * (0.7 + 0.3 * w(u * 7 + 3)), y: pts[i].y - ny * width * (0.7 + 0.3 * w(u * 7 + 3)) });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

/** All four chains in a style at time t. `smokeK` shows the shadow trail behind them. */
export function drawChains(ctx: Ctx, t: number, style: ChainStyle, smokeK = 0) {
  for (const ch of CHAINS) {
    const { pts, head } = chainLine(ch, t);
    if (head <= 0) continue;
    if (style === 'flat') smoke(ctx, pts, smokeK, ch.seed + 5);
    const ls = links(pts);
    // The side links first, then the face links over them.
    for (const pass of [false, true]) for (const l of ls) if (l.face === pass) drawLink(ctx, l, style);
    if (head < 1) {
      const p = pts[pts.length - 1], q = pts[pts.length - 3];
      spear(ctx, p, Math.atan2(p.y - q.y, p.x - q.x), style);
    }
  }
}

/** The taut chains' links (for the shatter): where every link was at the lock. */
export function tautLinks(): (Link & { chain: number })[] {
  const out: (Link & { chain: number })[] = [];
  CHAINS.forEach((ch, c) => {
    for (const l of links(chainLine(ch, LOCK + 1).pts)) out.push({ ...l, chain: c });
  });
  return out;
}

/** A violet ring burst at a point (glow): rings and short rays thrown out over k (0 to 1). */
export function ringBurst(ctx: Ctx, at: Pt, k: number, size = 1) {
  if (k <= 0 || k >= 1) return;
  const a = (1 - k) ** 1.5, L = lerp(60, 150, Math.sqrt(k)) * size, w = 5 * a + 1;
  // A four-pointed glint, a little turned, and a small ring.
  ctx.fillStyle = rgba('#f4e8ff', a);
  for (const [dx, dy] of [[0.97, 0.26], [-0.26, 0.97]] as const) {
    ctx.beginPath();
    ctx.moveTo(at.x - dx * L, at.y - dy * L);
    ctx.lineTo(at.x + dy * w, at.y - dx * w);
    ctx.lineTo(at.x + dx * L, at.y + dy * L);
    ctx.lineTo(at.x - dy * w, at.y + dx * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(at.x, at.y, lerp(10, 70, Math.sqrt(k)) * size, 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#c49bff', 0.8 * a);
  ctx.lineWidth = 2;
  ctx.stroke();
}
