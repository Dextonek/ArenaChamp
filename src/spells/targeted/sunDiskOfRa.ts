import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sun Disk of Ra (targeted, single enemy, ancient Egypt): cartouche glyphs (gold on dark) float up round the
 * caster while the world darkens warm. A hand-drawn winged sun disk (canvas sprite rig: gold disc with a lapis
 * band, two tiered wings in lapis / gold / turquoise, two uraeus cobras, black outlines, hard edges) unfolds
 * behind and above the caster, always turned to the camera, and a lapis scarab rolls across the disc face. The
 * disc tilts toward the target, a thin gold aim line and turquoise cobra-eye glints flash, there is a dead beat,
 * then the disc fires a sun beam: a dark sand under-beam, a gold core, a turquoise electric copy and a thin
 * cream line (white only there). It lands as a sun-strike column with short gold/black impact frames, a gold
 * toon star with a 2-frame lapis star, a sand ring and small dark dust. The beam holds, pinches to a line, a
 * burned ankh stays on the ground and the disc folds its wings and sinks.
 *
 * Gold is a material here: every sprite is unlit and sits below the bloom threshold. Palette is the "solar /
 * holy" row of the art bible plus lapis and turquoise accents.
 *
 * Recipes: e-yougelly-rune-portal-beam (a sigil that fires a beam), j-aguiar-layered-laser-beam (dark
 * under-beam, core, alpha-clipped electric copy), a-dota-invoker-sun-strike (beam column at a point).
 */
export interface SunDiskOfRaSettings {
  damage: number;
  loop: boolean;
}

export const defaultSunDiskOfRa = (): SunDiskOfRaSettings => ({
  damage: 65,
  loop: false,
});

// Timeline (seconds).
const GLYPH_END = 1.8;
const ROLL_START = 0.85;
const ROLL_END = 1.5;
const OPEN_START = 0.6;
const OPEN_END = 1.2;
const AIM_START = 1.5;
const D = 1.85; // beam fires
const HOLD_END = 2.25;
const PINCH_END = 2.6;
const BEAM_END = 2.75;
const FOLD_START = 2.7;
const FOLD_END = 3.2;
const SINK_START = 3.0;
const SINK_END = 3.7;
const ANKH_FADE = 3.6;
const DURATION = 4.4;

// Solar row, lapis / turquoise accents, sand dark.
const WHITE = 0xfffbe8;
const GOLD_HOT = 0xffd860;
const GOLD = 0xc8901a;
const LAPIS = 0x2a5ad8;
const TURQ = 0x3ad0c8;
const DARK = 0x20140a;

const GLYPHS = 12;
const BEAM_R = 0.42;

// Rig dimensions (metres at rig scale 1).
const DISC_S = 2.2;
const WING_S = 3.3;
const WING_ROOT_U = 12 / 256;
const WING_ROOT_V = 60 / 256;
const COBRA_W = 1.2;
const COBRA_H = 1.8;
const COBRA_X = 1.6;
const COBRA_Y = -0.1;
const COBRA_EYE_U = 94 / 128;
const COBRA_EYE_V = 27 / 192;
const SCARAB_S = 0.95;
const ANGLE_SPREAD = 0.18;
const ANGLE_FOLD = -1.4;
const HOLD_BACK = 3.7;
const HOLD_H = 8.5;

const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const k = Math.min(1, Math.max(0, x)) - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const OUT = '#120a04';

function makeTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A pointed feather from (x0, y0) along `ang` (0 = right, + = down), `len` long, `w` wide, with a colour ramp. */
function feather(
  g: CanvasRenderingContext2D, x0: number, y0: number, ang: number, len: number, w: number, c0: string, c1: string,
) {
  const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
  const px = -Math.sin(ang), py = Math.cos(ang);
  const mx = x0 + (x1 - x0) * 0.55, my = y0 + (y1 - y0) * 0.55;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(mx + px * w, my + py * w, x1, y1);
  g.quadraticCurveTo(mx - px * w, my - py * w, x0, y0);
  g.closePath();
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 3.5;
  g.stroke();
  g.strokeStyle = 'rgba(18,10,4,0.5)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x0 + Math.cos(ang) * 8, y0 + Math.sin(ang) * 8);
  g.lineTo(x0 + Math.cos(ang) * len * 0.9, y0 + Math.sin(ang) * len * 0.9);
  g.stroke();
}

/**
 * One wing (canvas 512 x 512; 256 grid), root at the left (12, 60), swept outward and slightly down. Three tiers of
 * long pointed feathers fan out from the root: gold on top (longest, the leading edge), lapis in the middle,
 * turquoise primaries below. Drawn bottom tier first so the upper tiers overlap. Black outline on every feather.
 */
function wingTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (g) => {
    const rx = 12, ry = WING_ROOT_V * 256;
    const tiers = [
      { a0: 0.30, a1: 0.82, l0: 190, l1: 120, w: 15, c: ['#3ad0c8', '#1f8a86'], dy: 8 },
      { a0: 0.10, a1: 0.58, l0: 212, l1: 132, w: 16, c: ['#2a5ad8', '#1a3a9a'], dy: 4 },
      { a0: -0.06, a1: 0.40, l0: 238, l1: 150, w: 16, c: ['#e8b840', '#a8741a'], dy: 0 },
    ];
    const n = 8;
    for (const t of tiers) {
      for (let i = n - 1; i >= 0; i--) {
        const u = i / (n - 1);
        feather(g, rx + 6, ry + t.dy, THREE.MathUtils.lerp(t.a0, t.a1, u), THREE.MathUtils.lerp(t.l0, t.l1, u), t.w, t.c[0], t.c[1]);
      }
    }
    // Shoulder cap.
    g.beginPath();
    g.arc(rx + 8, ry + 6, 17, 0, Math.PI * 2);
    g.fillStyle = css(GOLD);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 4;
    g.stroke();
  });
}

/** The sun disc (canvas 512 x 512; 256 grid): black rim, gold with a lapis band studded with dots, inner ring. */
function discTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (g) => {
    const c = 128;
    g.fillStyle = OUT;
    g.beginPath(); g.arc(c, c, 122, 0, Math.PI * 2); g.fill();
    const rad = g.createRadialGradient(c - 30, c - 34, 10, c, c, 118);
    rad.addColorStop(0, '#e8b840');
    rad.addColorStop(0.6, '#c8901a');
    rad.addColorStop(1, '#8a5e10');
    g.fillStyle = rad;
    g.beginPath(); g.arc(c, c, 114, 0, Math.PI * 2); g.fill();
    // Lapis band between two black lines.
    g.strokeStyle = OUT;
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 98, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(c, c, 78, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#2a5ad8';
    g.lineWidth = 16;
    g.beginPath(); g.arc(c, c, 88, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.fillStyle = i % 2 ? '#3ad0c8' : '#e0ac36';
      g.beginPath(); g.arc(c + Math.cos(a) * 88, c + Math.sin(a) * 88, 3.4, 0, Math.PI * 2); g.fill();
    }
    // Inner ring and a ring of short rays.
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, 46, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#9a6a14';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.save();
      g.translate(c, c);
      g.rotate(a);
      g.beginPath(); g.moveTo(52, -6); g.lineTo(72, 0); g.lineTo(52, 6); g.closePath(); g.fill();
      g.restore();
    }
    // Highlight arc, light from above left (stays below the bloom threshold).
    g.strokeStyle = '#f0c850';
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 106, Math.PI * 1.08, Math.PI * 1.45); g.stroke();
  });
}

/**
 * A rearing uraeus cobra in profile facing right (canvas 256 x 384; 128 x 192 grid): coiled gold body, a flared
 * hood with lapis / turquoise bands, a small head with a turquoise eye at (94, 27). Black outline.
 */
function cobraTexture(): THREE.CanvasTexture {
  return makeTexture(256, 384, (g) => {
    const body = () => {
      g.beginPath();
      g.moveTo(34, 188);
      g.bezierCurveTo(10, 176, 16, 150, 44, 146);
      g.bezierCurveTo(78, 142, 76, 112, 58, 92);
      g.bezierCurveTo(54, 84, 58, 78, 64, 72);
    };
    body();
    g.strokeStyle = OUT; g.lineWidth = 36; g.stroke();
    body();
    g.strokeStyle = '#c8901a'; g.lineWidth = 27; g.stroke();
    body();
    g.strokeStyle = '#a8741a'; g.lineWidth = 9; g.setLineDash([3, 11]); g.stroke(); g.setLineDash([]);
    // Hood: a wide flare behind the head.
    g.beginPath();
    g.moveTo(62, 84);
    g.bezierCurveTo(18, 70, 14, 28, 52, 14);
    g.bezierCurveTo(70, 8, 96, 14, 102, 34);
    g.bezierCurveTo(100, 56, 86, 76, 62, 84);
    g.closePath();
    const grad = g.createLinearGradient(30, 14, 90, 84);
    grad.addColorStop(0, '#e0ac36');
    grad.addColorStop(1, '#a8741a');
    g.fillStyle = grad; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 5; g.stroke();
    // Hood bands: lapis and turquoise arcs.
    g.lineWidth = 7;
    g.strokeStyle = '#2a5ad8';
    g.beginPath(); g.arc(70, 50, 28, Math.PI * 0.55, Math.PI * 1.35); g.stroke();
    g.strokeStyle = '#3ad0c8';
    g.beginPath(); g.arc(70, 50, 17, Math.PI * 0.55, Math.PI * 1.35); g.stroke();
    // Head.
    g.beginPath();
    g.ellipse(94, 30, 19, 13, 0.18, 0, Math.PI * 2);
    g.fillStyle = '#d8a42c'; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 5; g.stroke();
    // Eye: turquoise iris, black slit.
    g.fillStyle = '#3ad0c8';
    g.beginPath(); g.ellipse(COBRA_EYE_U * 128, COBRA_EYE_V * 192, 5.2, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.fillStyle = OUT;
    g.beginPath(); g.ellipse(COBRA_EYE_U * 128 + 1, COBRA_EYE_V * 192, 1.3, 3.2, 0, 0, Math.PI * 2); g.fill();
    // Forked tongue.
    g.strokeStyle = '#8a1a14'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(112, 34); g.lineTo(122, 36); g.moveTo(122, 36); g.lineTo(126, 32); g.moveTo(122, 36); g.lineTo(126, 40); g.stroke();
  });
}

/** A scarab seen from above (canvas 256 x 256; 128 grid): lapis wing cases split by a gold line, turquoise collar. */
function scarabTexture(): THREE.CanvasTexture {
  return makeTexture(256, 256, (g) => {
    g.strokeStyle = OUT;
    g.lineWidth = 8;
    for (const sy of [-1, 0, 1]) {
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(64 + sx * 22, 70 + sy * 16);
        g.lineTo(64 + sx * 44, 62 + sy * 26);
        g.lineTo(64 + sx * 50, 80 + sy * 30);
        g.stroke();
      }
    }
    // Body.
    g.beginPath();
    g.ellipse(64, 78, 28, 38, 0, 0, Math.PI * 2);
    const grad = g.createLinearGradient(40, 40, 90, 116);
    grad.addColorStop(0, '#3a6ae8');
    grad.addColorStop(1, '#14307a');
    g.fillStyle = grad; g.fill();
    g.lineWidth = 5; g.stroke();
    g.strokeStyle = css(GOLD); g.lineWidth = 3;
    g.beginPath(); g.moveTo(64, 52); g.lineTo(64, 114); g.stroke();
    // Collar and head.
    g.beginPath(); g.ellipse(64, 44, 22, 12, 0, 0, Math.PI * 2);
    g.fillStyle = '#3ad0c8'; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.ellipse(64, 28, 14, 10, 0, 0, Math.PI * 2);
    g.fillStyle = css(DARK); g.fill(); g.stroke();
    g.fillStyle = css(DARK);
    for (const x of [48, 56, 64, 72, 80]) { g.beginPath(); g.arc(x, 20, 3, 0, Math.PI * 2); g.fill(); }
  });
}

/** Glyph atlas: 4 x 2 cartouches (canvas 512 x 384; each cell 128 x 192 grid-px / 2): gold on dark. */
function glyphAtlas(): THREE.CanvasTexture {
  return makeTexture(1024, 768, (g) => {
    const gold = '#e0ac36';
    const draw: Array<() => void> = [
      () => { // ankh
        g.lineWidth = 9; g.strokeStyle = gold;
        g.beginPath(); g.ellipse(0, -26, 14, 18, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 40); g.moveTo(-22, 6); g.lineTo(22, 6); g.stroke();
      },
      () => { // eye of Horus
        g.fillStyle = gold; g.strokeStyle = gold; g.lineWidth = 5;
        g.beginPath(); g.moveTo(-32, 0); g.quadraticCurveTo(0, -26, 32, 0); g.quadraticCurveTo(0, 18, -32, 0); g.fill();
        g.fillStyle = css(DARK); g.beginPath(); g.arc(0, -2, 8, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(-32, -28); g.lineTo(32, -28); g.moveTo(-4, 14); g.lineTo(-4, 38); g.stroke();
      },
      () => { // feather of Maat
        g.fillStyle = gold;
        g.beginPath(); g.moveTo(0, -42); g.bezierCurveTo(26, -24, 22, 22, 0, 42); g.bezierCurveTo(-22, 22, -26, -24, 0, -42); g.fill();
        g.strokeStyle = css(DARK); g.lineWidth = 4;
        g.beginPath(); g.moveTo(0, -36); g.lineTo(0, 40); g.stroke();
      },
      () => { // water
        g.strokeStyle = gold; g.lineWidth = 7;
        for (const k of [-1, 0, 1]) {
          g.beginPath();
          for (let i = 0; i <= 6; i++) g.lineTo(-30 + i * 10, k * 18 + (i % 2 ? -6 : 6));
          g.stroke();
        }
      },
      () => { // sun disc
        g.strokeStyle = gold; g.lineWidth = 7;
        g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
        g.fillStyle = gold; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
      },
      () => { // scarab
        g.fillStyle = gold; g.strokeStyle = gold; g.lineWidth = 5;
        g.beginPath(); g.ellipse(0, 6, 18, 26, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(0, -24, 10, 0, Math.PI * 2); g.fill();
        for (const sy of [-8, 8, 24]) { g.beginPath(); g.moveTo(-18, sy); g.lineTo(-32, sy + 8); g.moveTo(18, sy); g.lineTo(32, sy + 8); g.stroke(); }
      },
      () => { // reed leaf
        g.fillStyle = gold;
        g.beginPath(); g.moveTo(0, -42); g.quadraticCurveTo(18, 0, 6, 42); g.lineTo(-6, 42); g.quadraticCurveTo(-18, 0, 0, -42); g.fill();
        g.strokeStyle = gold; g.lineWidth = 6; g.beginPath(); g.moveTo(-18, 30); g.lineTo(18, 30); g.stroke();
      },
      () => { // cobra
        g.strokeStyle = gold; g.lineWidth = 9;
        g.beginPath(); g.moveTo(-18, 40); g.bezierCurveTo(-34, 20, 20, 14, 4, -8); g.bezierCurveTo(-4, -20, -2, -30, 6, -34); g.stroke();
        g.fillStyle = gold; g.beginPath(); g.ellipse(10, -34, 12, 8, 0, 0, Math.PI * 2); g.fill();
      },
    ];
    draw.forEach((fn, i) => {
      const ox = (i % 4) * 128, oy = Math.floor(i / 4) * 192;
      g.save();
      g.translate(ox, oy);
      // Cartouche: dark stadium with a gold rope border and a bar.
      g.beginPath();
      g.roundRect(14, 10, 100, 172, 44);
      g.fillStyle = css(DARK); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 11; g.stroke();
      g.strokeStyle = '#c8901a'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#c8901a';
      g.fillRect(34, 148, 60, 7);
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(34, 148, 60, 7);
      g.translate(64, 84);
      g.scale(0.82, 0.82);
      draw[i]();
      g.restore();
    });
  });
}

/** A burned ankh (canvas 256 x 384; 128 x 192 grid): charred, with a deep gold glowing rim. */
function ankhTexture(): THREE.CanvasTexture {
  return makeTexture(256, 384, (g) => {
    const path = () => {
      g.beginPath(); g.ellipse(64, 54, 24, 32, 0, 0, Math.PI * 2);
      g.moveTo(64, 86); g.lineTo(64, 176);
      g.moveTo(26, 110); g.lineTo(102, 110);
    };
    path();
    g.strokeStyle = '#a8741a'; g.lineWidth = 24; g.stroke();
    path();
    g.strokeStyle = '#2a1608'; g.lineWidth = 17; g.stroke();
    path();
    g.strokeStyle = '#0c0603'; g.lineWidth = 10; g.stroke();
    // Char flecks around it.
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399;
      const r = 36 + ((i * 37) % 50);
      g.fillStyle = i % 3 ? '#0c0603' : '#8a5e10';
      g.beginPath(); g.arc(64 + Math.cos(a) * r * 0.8, 100 + Math.sin(a) * r * 1.2, 1.6 + (i % 3), 0, Math.PI * 2); g.fill();
    }
  });
}

// --- Beam material (three shader copies of one ribbon) -----------------------------------------------------

const BEAM_VERT = /* glsl */ `
  uniform vec3 uA, uB; uniform float uHalfW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 a = (modelMatrix * vec4(uA, 1.0)).xyz;
    vec3 b = (modelMatrix * vec4(uB, 1.0)).xyz;
    vec3 side = cross(b - a, cameraPosition - a);
    float sl = length(side);
    side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
    vec3 w = mix(a, b, uv.y) + side * (uv.x - 0.5) * 2.0 * uHalfW;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime, uScroll, uDistort, uClip, uOpacity, uLength, uDark, uSeed, uBase, uGain, uSharp;
  uniform vec3 uHot, uMid, uEdge;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float y = vUv.y;
    float c = vUv.x * 2.0 - 1.0;
    float pinch = 0.3 + 0.7 * sqrt(max(sin(3.14159265 * y), 0.0));
    float mask = smoothstep(0.0, 0.05, y) * mix(1.0, 0.6, smoothstep(0.35, 0.85, y)) * (1.0 - smoothstep(0.85, 1.0, y));
    float along = y * uLength * 0.35;
    vec2 q = vec2(along, c);
    vec2 d = vec2(noise(q * 3.0 + vec2(uTime * 3.0, uSeed)), noise(q * 3.0 + vec2(17.0 - uTime * 2.4, uSeed * 1.7 + 5.0)));
    float pc = c + (d.y - 0.5) * uDistort * 2.5;
    along += (d.x - 0.5) * uDistort * 2.0;
    float ap = abs(pc) / pinch;
    if (uDark > 0.5) {
      float n = noise(vec2(along * 0.8 - uTime * 1.2, pc * 2.0));
      float a = (1.0 - smoothstep(0.55, 1.0, ap)) * mask * uOpacity;
      gl_FragColor = vec4(mix(uEdge, uMid, n), a);
      return;
    }
    float prof = 1.0 - smoothstep(0.0, 1.0, ap);
    float sc = uTime * uScroll;
    float st = 0.6 * noise(vec2((along - sc) * 1.4, pc * 3.5)) + 0.4 * noise(vec2((along - sc * 1.4) * 3.0 + 9.0, pc * 7.0));
    float s = mix(st, smoothstep(0.35, 0.85, st), uSharp);
    float v = prof * (uBase + uGain * s);
    if (v < uClip) discard;
    float a = clamp(v, 0.0, 1.0) * smoothstep(uClip, uClip + 0.12, v) * mask * uOpacity;
    vec3 col = mix(uEdge, uMid, smoothstep(0.08, 0.55, v));
    col = mix(col, uHot, smoothstep(0.7, 1.1, v + 0.15 * prof * prof));
    gl_FragColor = vec4(col, a);
  }`;

interface BeamLayerOptions {
  dark?: boolean;
  hot: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  edge: THREE.ColorRepresentation;
  scroll: number;
  distort: number;
  clip: number;
  base: number;
  gain: number;
  sharp: number;
  seed: number;
  order: number;
}

/** One shader copy of the beam: a camera-facing ribbon from a to b. */
class BeamLayer {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(o: BeamLayerOptions) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: o.dark ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3(0, 0, 1) }, uHalfW: { value: 0.1 },
        uTime: { value: 0 }, uScroll: { value: o.scroll }, uDistort: { value: o.distort }, uClip: { value: o.clip },
        uOpacity: { value: 0 }, uLength: { value: 1 }, uDark: { value: o.dark ? 1 : 0 }, uSeed: { value: o.seed },
        uBase: { value: o.base }, uGain: { value: o.gain }, uSharp: { value: o.sharp },
        uHot: { value: new THREE.Color(o.hot) }, uMid: { value: new THREE.Color(o.mid) }, uEdge: { value: new THREE.Color(o.edge) },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = o.order;
    this.mesh.visible = false;
  }

  place(a: THREE.Vector3, b: THREE.Vector3, halfW: number, opacity: number, time: number) {
    const u = this.material.uniforms;
    (u.uA.value as THREE.Vector3).copy(a);
    (u.uB.value as THREE.Vector3).copy(b);
    const len = a.distanceTo(b);
    u.uHalfW.value = halfW;
    u.uOpacity.value = opacity;
    u.uTime.value = time;
    u.uLength.value = len;
    this.mesh.visible = opacity > 0.002 && halfW > 1e-3 && len > 0.02;
  }
}

export class SunDiskOfRa implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SunDiskOfRaSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private smokeStep = 0;
  private leafStep = 0;
  private sparkAcc = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3();
  private hold = new THREE.Vector3();
  private strike = new THREE.Vector3();
  private ground = new THREE.Vector3();
  private hitFrom = new THREE.Vector3();

  // Billboard state, written by the rigs' onBeforeRender and read in layout().
  private camQ = new THREE.Quaternion();
  private parentQ = new THREE.Quaternion();
  private camRight = new THREE.Vector3(1, 0, 0);
  private camUp = new THREE.Vector3(0, 1, 0);
  private tilt = 0;

  // The winged sun disk rig (turned to the camera each frame).
  private rig = new THREE.Group();
  private wingMat = new THREE.MeshBasicMaterial({
    map: wingTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide, color: 0xeeeeee,
  });
  private discMat = new THREE.MeshBasicMaterial({
    map: discTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide, color: 0xeeeeee,
  });
  private cobraMat = new THREE.MeshBasicMaterial({
    map: cobraTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide, color: 0xeeeeee,
  });
  private scarabMat = new THREE.MeshBasicMaterial({
    map: scarabTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide, color: 0xeeeeee,
  });
  private wingPivot: THREE.Group[] = [];
  private wingScale: THREE.Group[] = [];
  private cobras: THREE.Mesh[] = [];
  private scarab: THREE.Mesh;
  private rays = new StarBurst({ points: 32, inner: 0.9, jitter: 0, color: GOLD, core: GOLD, additive: false });
  private eyes = [0, 1].map(() => new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: TURQ, core: 0xdffffb, additive: false }));
  private flare = new StarBurst({ points: 8, inner: 0.3, jitter: 0.2, color: GOLD_HOT, core: 0xffe9a0, additive: false });

  // Glyphs: cartouches in a camera-facing plane around the caster.
  private glyphRoot = new THREE.Group();
  private glyphMats: THREE.MeshBasicMaterial[] = [];
  private glyphs: THREE.Mesh[] = [];

  // Aim line, beam, column.
  private aimLine: THREE.Line;
  private aimMat = new THREE.LineBasicMaterial({ color: GOLD_HOT, transparent: true, opacity: 0, depthWrite: false });
  private under = new BeamLayer({
    dark: true, hot: DARK, mid: 0x3a2610, edge: DARK, scroll: 0, distort: 0.1, clip: 0, base: 0, gain: 0, sharp: 0, seed: 3, order: 1,
  });
  private electric = new BeamLayer({
    hot: 0xcffff6, mid: TURQ, edge: LAPIS, scroll: 9, distort: 0.25, clip: 0.55, base: 0.05, gain: 1.6, sharp: 0, seed: 11, order: 2,
  });
  private core = new BeamLayer({
    hot: 0xffe9a0, mid: GOLD_HOT, edge: GOLD, scroll: 6, distort: 0.15, clip: 0.05, base: 0.45, gain: 0.75, sharp: 1, seed: 7, order: 3,
  });
  private line = new BeamLayer({
    hot: WHITE, mid: 0xfff0b0, edge: GOLD_HOT, scroll: 4, distort: 0.05, clip: 0, base: 0.85, gain: 0.2, sharp: 0, seed: 5, order: 4,
  });
  private pillar = new LightPillar(0xf2b53c, 0.85);

  // Impact.
  private goldStar = new StarBurst({ points: 12, color: GOLD, core: GOLD_HOT, additive: false });
  private lapisStar = new StarBurst({ points: 8, color: LAPIS, core: TURQ, additive: false });
  private ring = createRing(GOLD, 0.9, 1, 96);
  private ankh: THREE.Mesh;
  private ankhMat = new THREE.MeshBasicMaterial({
    map: ankhTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private smoke = new SmokeBall({ color: DARK, rim: 0x4a3418, flake: '#20140a', maxBalls: 4 });

  private sparks: Emitter;
  private embers: Emitter;
  private dust: Emitter;
  private leaves: Emitter;

  constructor(settings: SunDiskOfRaSettings = defaultSunDiskOfRa()) {
    this.settings = settings;
    this.screen.tint.set(0x6a4a28);
    this.screen.impactColor.set(0xf2b53c);
    this.screen.speedLineColor.set(GOLD_HOT);
    this.screen.edgeTint.set(LAPIS);
    this.goldStar.coreColor.set(0xe0ac36);

    // --- The rig: wings (behind), disc, cobras, scarab. ---
    const meshes: THREE.Mesh[] = [];
    for (let k = 0; k < 2; k++) {
      const pivot = new THREE.Group();
      const sc = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(WING_S, WING_S), this.wingMat);
      wing.position.set((0.5 - WING_ROOT_U) * WING_S, -(0.5 - WING_ROOT_V) * WING_S, 0);
      wing.renderOrder = 5;
      sc.add(wing);
      pivot.add(sc);
      pivot.position.set(k === 0 ? 0.7 : -0.7, -0.05, -0.02);
      if (k === 1) pivot.scale.x = -1;
      this.rig.add(pivot);
      this.wingPivot.push(pivot);
      this.wingScale.push(sc);
      meshes.push(wing);
    }
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(DISC_S, DISC_S), this.discMat);
    disc.renderOrder = 6;
    this.rig.add(disc);
    meshes.push(disc);
    for (let k = 0; k < 2; k++) {
      const cobra = new THREE.Mesh(new THREE.PlaneGeometry(COBRA_W, COBRA_H), this.cobraMat);
      cobra.renderOrder = 7;
      cobra.position.set(k === 0 ? COBRA_X : -COBRA_X, COBRA_Y, 0.02);
      if (k === 1) cobra.scale.x = -1;
      this.rig.add(cobra);
      this.cobras.push(cobra);
      meshes.push(cobra);
    }
    this.scarab = new THREE.Mesh(new THREE.PlaneGeometry(SCARAB_S, SCARAB_S), this.scarabMat);
    this.scarab.renderOrder = 8;
    this.scarab.position.z = 0.04;
    this.rig.add(this.scarab);
    meshes.push(this.scarab);
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      camera.getWorldQuaternion(this.camQ);
      this.camRight.set(1, 0, 0).applyQuaternion(this.camQ);
      this.camUp.set(0, 1, 0).applyQuaternion(this.camQ);
      this.rig.parent?.getWorldQuaternion(this.parentQ);
      this.rig.quaternion.copy(this.parentQ.invert().multiply(this.camQ));
      this.rig.rotateX(-this.tilt);
      this.rig.updateMatrixWorld(true);
    };
    for (const m of meshes) {
      m.onBeforeRender = face;
      m.frustumCulled = false;
    }
    this.rig.visible = false;
    this.group.add(this.rig);
    this.rays.mesh.traverse((o) => { o.renderOrder = 4; });
    this.flare.mesh.traverse((o) => { o.renderOrder = 9; });
    this.eyes.forEach((e) => e.mesh.traverse((o) => { o.renderOrder = 10; }));
    this.group.add(this.rays.mesh, this.flare.mesh, ...this.eyes.map((e) => e.mesh));

    // --- Glyph cartouches: a root turned to the camera, children placed in screen space. ---
    const atlas = glyphAtlas();
    for (let i = 0; i < GLYPHS; i++) {
      const geo = new THREE.PlaneGeometry(0.62, 0.93);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const cu = (i % 8) % 4, cv = Math.floor((i % 8) / 4);
      for (let j = 0; j < uv.count; j++) {
        uv.setXY(j, (cu + uv.getX(j)) / 4, (1 - (cv + 1) / 2) + uv.getY(j) * 0.5);
      }
      const mat = new THREE.MeshBasicMaterial({
        map: atlas, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, color: 0xeeeeee,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 11;
      m.frustumCulled = false;
      m.visible = false;
      this.glyphRoot.add(m);
      this.glyphs.push(m);
      this.glyphMats.push(mat);
    }
    const faceGlyphs = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      camera.getWorldQuaternion(this.camQ);
      this.glyphRoot.parent?.getWorldQuaternion(this.parentQ);
      this.glyphRoot.quaternion.copy(this.parentQ.invert().multiply(this.camQ));
      this.glyphRoot.updateMatrixWorld(true);
    };
    for (const m of this.glyphs) m.onBeforeRender = faceGlyphs;
    this.group.add(this.glyphRoot);

    // --- Aim line and beam. ---
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    this.aimLine = new THREE.Line(lineGeo, this.aimMat);
    this.aimLine.frustumCulled = false;
    this.aimLine.visible = false;
    this.group.add(this.aimLine, this.under.mesh, this.electric.mesh, this.core.mesh, this.line.mesh, this.pillar.mesh);

    // --- Impact: stars, ring, burned ankh on the ground. ---
    this.ankh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.9), this.ankhMat);
    this.ankh.rotation.order = 'YXZ';
    this.ankh.rotation.x = -Math.PI / 2;
    this.ankh.renderOrder = 0;
    this.ankh.visible = false;
    this.ring.mesh.visible = false;
    this.group.add(this.ankh, this.ring.mesh, this.goldStar.mesh, this.lapisStar.mesh, this.smoke.mesh);

    // Gold sparks: small, hot, short.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 10, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffd860', colorEnd: '#c8901a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 1.4, speedJitter: 0.6, spread: 60, gravity: -0.6, drag: 1.0,
      sizeStart: 0.16, sizeEnd: 0.02, colorStart: '#ffd860', colorEnd: '#c8901a',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0.4, spin: 0.5,
    });
    // Small, short sand-dark dust (normal blend).
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.6,
      sizeStart: 0.5, sizeEnd: 1.1, colorStart: '#4a3418', colorEnd: '#20140a',
      opacityStart: 0.55, opacityEnd: 0, additive: false, colorMid: '#3a2610', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
      groundFade: 0.3,
    });
    // Gold leaf shed from the wings: normal-blended, burns down to dark.
    this.leaves = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.8, lifetimeJitter: 0.45,
      shape: 'sphere', shapeSize: 0.3, speed: 0.7, speedJitter: 0.7, spread: 180, gravity: 1.4, drag: 0.9,
      sizeStart: 0.2, sizeEnd: 0.08, colorStart: '#c8901a', colorEnd: '#20140a',
      opacityStart: 0.95, opacityEnd: 0, additive: false, colorMid: '#a8741a', sizeJitter: 0.5, erosion: 0.3, spin: 0.8,
    });
    this.emitters.push(this.sparks, this.embers, this.dust, this.leaves, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).setY(1.5);
    this.hold.copy(ctx.from).addScaledVector(this.fwd, -HOLD_BACK).setY(HOLD_H);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.ground.copy(target).setY(0);
    this.strike.copy(this.ground).setY(1.1);
    this.hitFrom.copy(this.ground).addScaledVector(this.fwd, -1.2);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.strike);
    this.glyphRoot.position.copy(ctx.from).setY(0.2);
    this.ankh.position.set(this.ground.x, 0.03, this.ground.z);
    // Ankh upright as seen from the caster: its top points away from the caster, toward the target.
    this.ankh.rotation.y = ctx.aim + Math.PI;
    this.ring.mesh.position.set(this.ground.x, 0.05, this.ground.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.smokeStep = 0;
    this.leafStep = 0;
    this.sparkAcc = 0;
    this.shake = 0;
    this.tilt = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= D) this.onImpact();
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const ctx = this.ctx;
    const tmp = new THREE.Vector3();

    // --- Layer 1: the world darkens and warms (0.55), a deeper dip on the dead beat, released after the hit. ---
    const dead = t >= 1.65 && t < D ? 0.1 : 0;
    this.screen.darken = (0.55 * smoothstep(t / 0.6) + dead) * (1 - smoothstep((after - 0.1) / 1.3));
    this.screen.chroma = chromaPulse(t, D, 0.6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    const aimK = smoothstep((t - AIM_START) / 0.35);
    this.screen.speedLines = t < AIM_START ? 0 : after < 0 ? 0.6 * aimK : Math.max(0, 0.6 - after * 4);

    // --- Layer 2: cartouche glyphs float up round the caster, then give way to the disk. ---
    for (let i = 0; i < GLYPHS; i++) {
      const m = this.glyphs[i];
      const born = i * 0.04;
      const rise = smoothstep((t - born) / 0.9);
      const a = (i / GLYPHS) * Math.PI * 2 + t * 0.7;
      const r = 1.55 + 0.3 * (i % 3);
      const op = Math.min(smoothstep((t - born) / 0.3), 1 - smoothstep((t - 1.25) / (GLYPH_END - 1.25)));
      this.glyphMats[i].opacity = 0.95 * op;
      m.visible = op > 0.01;
      m.position.set(
        Math.cos(a) * r,
        0.5 + rise * (1.5 + (i % 4) * 0.55) + 0.06 * Math.sin(t * 3 + i),
        Math.sin(a) * 0.9,
      );
      m.rotation.z = 0.12 * Math.sin(t * 2 + i * 1.7);
      m.scale.setScalar(0.85 + 0.25 * (i % 3) / 2);
    }

    // --- Layer 3: the winged sun disk. Pose, position, scale. ---
    const alive = t >= OPEN_START - 0.1 && t < SINK_END;
    const sink = smoothstep((t - SINK_START) / (SINK_END - SINK_START));
    const rise = easeOutCubic((t - (OPEN_START - 0.1)) / 0.7);
    const pos = new THREE.Vector3().lerpVectors(this.chest, this.hold, rise);
    pos.y += 0.1 * Math.sin(t * 3.2) * smoothstep((t - 1.3) / 0.3) * (1 - sink);
    // Fires: the disk kicks back a little and swells for a beat.
    const kick = after >= 0 ? Math.exp(-after * 9) : 0;
    pos.addScaledVector(this.fwd, -0.4 * kick);
    pos.lerp(tmp.copy(this.from).setY(0.5), sink);
    const grow = easeOutBack((t - (OPEN_START - 0.1)) / 0.5);
    const rigScale = Math.max(1e-3, grow * (1 + 0.1 * kick) * (1 - 0.97 * sink));
    const open = easeOutBack((t - OPEN_START) / (OPEN_END - OPEN_START));
    const fold = clamp01((t - FOLD_START) / (FOLD_END - FOLD_START));
    const wingP = t < FOLD_START ? open : open * (1 - fold * fold);
    const flap = t >= OPEN_END && t < D ? 0.04 * Math.sin((t - OPEN_END) * 8) : 0;
    const angle = THREE.MathUtils.lerp(ANGLE_FOLD, ANGLE_SPREAD, wingP) + flap;
    const sx = THREE.MathUtils.lerp(0.35, 1, Math.min(1.1, Math.max(0, wingP)));
    for (let k = 0; k < 2; k++) {
      this.wingPivot[k].rotation.z = k === 0 ? angle : -angle;
      this.wingScale[k].scale.x = Math.max(1e-3, sx);
    }
    // Tilts toward the target during the aim and holds through the beam.
    this.tilt = 0.32 * aimK * (1 - smoothstep((t - FOLD_START) / 0.5));
    this.rig.position.copy(pos);
    this.rig.scale.setScalar(rigScale);
    this.rig.visible = alive && sink < 0.995;

    // Cobras rise out of the disc sides, swaying; the scarab rolls across the disc face.
    this.cobras.forEach((c, k) => {
      const up = easeOutBack((t - (OPEN_START + 0.15)) / 0.4);
      const s = Math.max(1e-3, up);
      c.scale.set((k === 1 ? -1 : 1) * s, s, 1);
      c.rotation.z = (k === 1 ? -1 : 1) * 0.05 * Math.sin(t * 2.3 + k * 2);
    });
    const roll = clamp01((t - ROLL_START) / (ROLL_END - ROLL_START));
    const scarabOn = t >= ROLL_START && t < AIM_START + 0.2;
    this.scarab.visible = scarabOn;
    this.scarab.position.x = THREE.MathUtils.lerp(-0.85, 0.85, smoothstep(roll));
    this.scarab.position.y = 0.04 * Math.sin(roll * 26);
    this.scarab.rotation.z = -Math.PI / 2 + 0.16 * Math.sin(roll * 26);
    this.scarab.scale.setScalar(Math.max(1e-3, easeOutBack((t - ROLL_START) / 0.15) * (1 - smoothstep((t - ROLL_END) / 0.2))));

    // Sun rays behind the disc; a gold flare pop at the source when the beam leaves.
    const rayOp = alive ? clamp01((t - OPEN_START) / 0.3) * (1 - sink) : 0;
    this.rays.set(pos, 1.5 * rigScale, 0.3 * rayOp, t * 0.25);
    const fl = StarBurst.pop(after, 0.06, 0.2);
    this.flare.set(tmp.copy(pos).addScaledVector(this.fwd, 0.4), 2.4 * fl.scale, fl.opacity, 0.3);

    // Cobra eyes glint turquoise on the aim beat.
    const eyeOn = t >= AIM_START + 0.05 && t < D - 0.02;
    this.eyes.forEach((e, k) => {
      const sgn = k === 0 ? 1 : -1;
      const ex = sgn * COBRA_X + sgn * (COBRA_EYE_U - 0.5) * COBRA_W;
      const ey = COBRA_Y + (0.5 - COBRA_EYE_V) * COBRA_H;
      const p = tmp.copy(pos).addScaledVector(this.camRight, ex * rigScale).addScaledVector(this.camUp, ey * rigScale);
      e.set(p, eyeOn ? (0.45 + 0.15 * Math.sin(t * 40 + k)) * rigScale : 0, eyeOn ? 1 : 0, t * 3);
    });

    // Gold leaf sheds from the wing tips while the disk is open.
    if (dt > 0 && alive && t >= OPEN_END && t < FOLD_START) {
      const step = Math.floor(t * 20);
      if (step !== this.leafStep) {
        this.leafStep = step;
        const side = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2.6);
        this.leaves.burst(1, tmp.copy(pos).addScaledVector(this.camRight, side).addScaledVector(this.camUp, -0.6 - Math.random()));
      }
    }

    // --- Layer 4: thin gold aim line (flickers) from the disc to the target on the aim beat. ---
    const aimOn = t >= AIM_START + 0.05 && t < D;
    this.aimLine.visible = aimOn;
    this.aimMat.opacity = aimOn ? 0.55 + 0.35 * Math.sin(t * 50) : 0;
    if (aimOn) {
      const a = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
      a.setXYZ(0, pos.x, pos.y, pos.z);
      a.setXYZ(1, this.strike.x, this.strike.y, this.strike.z);
      a.needsUpdate = true;
    }

    // --- Layer 5: the beam. Length snaps out in 0.1 s, holds, pinches to a line, ends. ---
    const lenK = after < 0 ? 0 : easeOutCubic(after / 0.1);
    const pinch = smoothstep((t - HOLD_END) / (PINCH_END - HOLD_END));
    const endFade = 1 - smoothstep((t - PINCH_END) / (BEAM_END - PINCH_END));
    const beamOn = lenK > 0.01 && endFade > 0.01;
    const a0 = tmp.copy(pos).addScaledVector(this.fwd, 0.3);
    const src = a0.clone();
    const b = new THREE.Vector3().lerpVectors(src, this.strike, lenK);
    const wob = 1 + 0.08 * Math.sin(t * 44);
    const coreW = BEAM_R * wob * THREE.MathUtils.lerp(1, 0.14, pinch);
    this.under.place(src, b, coreW * 2.5 + 0.08, beamOn ? 0.92 * endFade : 0, t);
    this.electric.place(src, b, coreW * 1.75, beamOn ? 0.4 * endFade : 0, t);
    this.core.place(src, b, coreW, beamOn ? 0.5 * endFade : 0, t);
    this.line.place(src, b, 0.05 + 0.03 * (1 - pinch), beamOn ? 0.55 * endFade : 0, t);

    // Sparks stream off the beam; gold flares keep landing on the target.
    if (dt > 0 && beamOn && lenK > 0.5) {
      this.sparkAcc += 60 * dt * endFade;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        this.sparks.burst(1, tmp.lerpVectors(src, b, Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)));
      }
    }

    // --- Layer 6: impact stars (gold toon, lapis for 2 frames), sun-strike column, ring. ---
    const gp = StarBurst.pop(after - 0.01, 0.08, 0.16);
    this.goldStar.set(tmp.set(this.ground.x, 1.4, this.ground.z), 3.2 * gp.scale, gp.opacity, 0.2);
    const lp = StarBurst.pop(after, 0.03, 0.05);
    this.lapisStar.set(tmp.set(this.ground.x, 0.9, this.ground.z), 3.4 * lp.scale, lp.opacity, 0.5);
    const pp = clamp01((after - 0.05) / 0.5);
    const pTop = after > 0 ? 16 - 14.4 * pp * pp : 0;
    this.pillar.set(this.ground.x, this.ground.z, 0, Math.max(1.2, pTop), after > 0 && after < 0.7 ? 0.32 * (1 - pp * 0.85) : 0);
    this.ring.mesh.visible = after >= 0 && after < 0.6;
    this.ring.mesh.scale.setScalar(1 + Math.max(0, after) * 24);
    this.ring.material.opacity = after >= 0 ? Math.max(0, 0.7 * (1 - after / 0.55)) : 0;

    // Toon smoke: two small dark balls either side of the crater.
    if (ctx && dt > 0 && this.smokeStep < 2 && after >= 0.2 + this.smokeStep * 0.12) {
      const side = this.smokeStep === 0 ? -1.4 : 1.4;
      this.smoke.trigger(tmp.set(this.ground.x, 0.5, this.ground.z).addScaledVector(this.camRight, side), 0.75, 0.9);
      this.smokeStep++;
    }

    // --- Layer 7: the burned ankh stays; it cools and fades last. ---
    const ankhIn = easeOutCubic((after - 0.08) / 0.3);
    const ankhOut = 1 - smoothstep((t - ANKH_FADE) / (DURATION - ANKH_FADE));
    this.ankhMat.opacity = after >= 0.08 ? 0.92 * ankhOut : 0;
    this.ankhMat.color.setScalar(THREE.MathUtils.lerp(1, 0.6, smoothstep((after - 0.3) / 1.5)));
    this.ankh.scale.setScalar(Math.max(1e-3, 0.55 + 0.45 * ankhIn));
    this.ankh.visible = this.ankhMat.opacity > 0.003;

    this.shake = after >= 0
      ? (after < 0.9 ? 0.15 : 0) + 0.7 * Math.exp(-after * 7)
      : t >= AIM_START ? 0.04 * aimK : t >= OPEN_START && t < OPEN_END ? 0.03 : 0;
  }

  private onImpact() {
    this.impacted = true;
    const c = this.ground;
    this.sparks.burst(240, tmp3.set(c.x, 0.7, c.z));
    this.embers.burst(60, tmp3.set(c.x, 0.6, c.z));
    this.dust.burst(50, tmp3.set(c.x, 0.3, c.z));
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => {
        ctx.hit(e, { damage: i === 0 ? this.settings.damage : 25, knock: 4, from: this.hitFrom, color: '#ffd860' });
      });
    }
  }
}

const tmp3 = new THREE.Vector3();

export const sunDiskOfRaModule: EffectModule = {
  label: 'sun disk of ra',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new SunDiskOfRa(),
  telegraphs(effect) {
    const e = effect as SunDiskOfRa;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.4 }, start: AIM_START, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SunDiskOfRa;
    if (e.ctx) frameCast(camera, controls, e.ctx, 11);
  },
  buildGui(f, effect) {
    const s = (effect as SunDiskOfRa).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
