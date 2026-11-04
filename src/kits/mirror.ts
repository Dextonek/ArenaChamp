import type { HeroKit } from '../heroes';

/**
 * Mirror kit data: Silvane, the Vain (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a deep blue-black ground, polished silver, pale blue glass and a little violet. Signature shape: the oval hand mirror with its
 * handle and a bright slanted streak across the glass.
 */
const S = {
  core: '#ffffff', hot: '#f4f9ff', body: '#cfe6ff', shade: '#8fa8cc', silver: '#c6cedb', steel: '#7d8aa0', violet: '#d9b8ff', dark: '#121a2e',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#26365a');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A hand mirror centred at (cx,cy), `h` the oval's half-height, turned by `rot` (0 = upright, handle down). */
function handMirror(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0, glassTint = S.body) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const w = h * 0.76;
  // The handle first, then a dark outline, the silver rim, the glass with a slanted streak.
  g.fillStyle = S.dark;
  g.fillRect(-h * 0.17, h * 0.8, h * 0.34, h * 0.95);
  g.fillStyle = S.silver;
  g.fillRect(-h * 0.1, h * 0.85, h * 0.2, h * 0.85);
  g.fillStyle = S.violet;
  g.beginPath();
  g.arc(0, h * 1.75, h * 0.12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.dark;
  g.beginPath();
  g.ellipse(0, 0, w * 1.2, h * 1.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.silver;
  g.beginPath();
  g.ellipse(0, 0, w * 1.08, h * 1.08, 0, 0, Math.PI * 2);
  g.fill();
  const gl = g.createLinearGradient(-w, -h, w, h);
  gl.addColorStop(0, S.hot);
  gl.addColorStop(0.5, glassTint);
  gl.addColorStop(1, S.shade);
  g.fillStyle = gl;
  g.beginPath();
  g.ellipse(0, 0, w * 0.9, h * 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(0, 0, w * 0.9, h * 0.9, 0, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = S.core;
  g.lineWidth = h * 0.16;
  g.beginPath();
  g.moveTo(-w * 0.9, h * 0.3);
  g.lineTo(w * 0.1, -h * 0.9);
  g.stroke();
  g.lineWidth = h * 0.06;
  g.beginPath();
  g.moveTo(-w * 0.4, h * 0.8);
  g.lineTo(w * 0.7, -h * 0.35);
  g.stroke();
  g.restore();
  g.restore();
}

/** A thin ray from (x1,y1) to (x2,y2): a white core in a pale blue (or `tint`) band. */
function ray(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, tint = S.body) {
  g.lineCap = 'round';
  g.strokeStyle = tint;
  g.globalAlpha = 0.8;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = S.core;
  g.lineWidth = w * 0.4;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** A small four-point glint. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = S.core) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.22, y - r * 0.22);
  g.lineTo(x + r, y);
  g.lineTo(x + r * 0.22, y + r * 0.22);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.22, y + r * 0.22);
  g.lineTo(x - r, y);
  g.lineTo(x - r * 0.22, y - r * 0.22);
  g.closePath();
  g.fill();
}

/** A tall arched standing mirror, its base at y = `base`, `h` tall, `w` wide, centred on `cx`. */
function standMirror(g: CanvasRenderingContext2D, cx: number, base: number, h: number, w: number) {
  const arch = (hw: number, top: number, bottom: number) => {
    g.beginPath();
    g.moveTo(cx - hw, bottom);
    g.lineTo(cx - hw, top + hw);
    g.arc(cx, top + hw, hw, Math.PI, 0, false);
    g.lineTo(cx + hw, bottom);
    g.closePath();
  };
  const top = base - h;
  g.fillStyle = S.dark;
  g.fillRect(cx - w * 0.42, base - h * 0.08, w * 0.22, h * 0.1);
  g.fillRect(cx + w * 0.2, base - h * 0.08, w * 0.22, h * 0.1);
  arch(w * 0.56, top - w * 0.06, base - h * 0.06);
  g.fill();
  g.fillStyle = S.silver;
  arch(w * 0.5, top, base - h * 0.08);
  g.fill();
  const gl = g.createLinearGradient(cx - w * 0.4, top, cx + w * 0.4, base);
  gl.addColorStop(0, S.hot);
  gl.addColorStop(0.55, S.body);
  gl.addColorStop(1, S.shade);
  g.fillStyle = gl;
  arch(w * 0.38, top + w * 0.12, base - h * 0.12);
  g.fill();
  g.save();
  arch(w * 0.38, top + w * 0.12, base - h * 0.12);
  g.clip();
  g.strokeStyle = S.core;
  g.lineWidth = w * 0.1;
  g.beginPath();
  g.moveTo(cx - w * 0.4, base - h * 0.2);
  g.lineTo(cx + w * 0.3, top + h * 0.2);
  g.stroke();
  g.lineWidth = w * 0.035;
  g.beginPath();
  g.moveTo(cx - w * 0.15, base - h * 0.1);
  g.lineTo(cx + w * 0.4, top + h * 0.4);
  g.stroke();
  g.restore();
  g.fillStyle = S.violet;
  g.beginPath();
  g.moveTo(cx, top - w * 0.26);
  g.lineTo(cx + w * 0.08, top - w * 0.1);
  g.lineTo(cx, top + w * 0.02);
  g.lineTo(cx - w * 0.08, top - w * 0.1);
  g.closePath();
  g.fill();
}

export const mirrorKit: HeroKit = {
  name: 'Silvane',
  maxHp: 560,
  title: 'the Vain',
  accent: S.body,
  foil: S.violet,
  portrait(g, s) {
    iconGround(g, s);
    // A tall oval looking-glass behind her head: a silver frame, a pale sheen.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.3, s * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.silver;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.275, s * 0.375, 0, 0, Math.PI * 2);
    g.fill();
    const gl = g.createLinearGradient(s * 0.25, s * 0.05, s * 0.75, s * 0.7);
    gl.addColorStop(0, '#3a4d7a');
    gl.addColorStop(1, '#1a2542');
    g.fillStyle = gl;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.245, s * 0.345, 0, 0, Math.PI * 2);
    g.fill();
    ray(g, s * 0.3, s * 0.52, s * 0.56, s * 0.12, s * 0.03);
    glint(g, s * 0.76, s * 0.2, s * 0.05);
    glint(g, s * 0.2, s * 0.66, s * 0.035, S.violet);
    // Shoulders in a silver gown with a high stiff collar.
    g.fillStyle = '#9aa7bd';
    g.beginPath();
    g.moveTo(s * 0.12, s);
    g.quadraticCurveTo(s * 0.16, s * 0.7, s * 0.34, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.54, s * 0.66, s * 0.6);
    g.quadraticCurveTo(s * 0.84, s * 0.7, s * 0.88, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.hot;
    g.lineWidth = s * 0.02;
    g.stroke();
    g.fillStyle = S.silver;
    g.beginPath();
    g.moveTo(s * 0.37, s * 0.66);
    g.lineTo(s * 0.33, s * 0.5);
    g.lineTo(s * 0.43, s * 0.6);
    g.lineTo(s * 0.5, s * 0.52);
    g.lineTo(s * 0.57, s * 0.6);
    g.lineTo(s * 0.67, s * 0.5);
    g.lineTo(s * 0.63, s * 0.66);
    g.closePath();
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.008;
    g.stroke();
    g.fillStyle = S.violet;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.66);
    g.lineTo(s * 0.53, s * 0.71);
    g.lineTo(s * 0.5, s * 0.77);
    g.lineTo(s * 0.47, s * 0.71);
    g.closePath();
    g.fill();
    // Head tipped back, nose in the air: a pale face, hair swept up in a perfect silver-blue wave.
    g.fillStyle = '#efdcd8';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.105, s * 0.14, -0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b9cbea';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.15, s * 0.13, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.35, s * 0.34);
    g.quadraticCurveTo(s * 0.31, s * 0.48, s * 0.4, s * 0.54);
    g.quadraticCurveTo(s * 0.4, s * 0.44, s * 0.43, s * 0.34);
    g.moveTo(s * 0.65, s * 0.34);
    g.quadraticCurveTo(s * 0.69, s * 0.48, s * 0.6, s * 0.54);
    g.quadraticCurveTo(s * 0.6, s * 0.44, s * 0.57, s * 0.34);
    g.fill();
    g.fillStyle = '#d7e4f8';
    g.beginPath();
    g.ellipse(s * 0.45, s * 0.27, s * 0.045, s * 0.02, -0.5, 0, Math.PI * 2);
    g.fill();
    // Closed, heavy-lidded eyes with long lashes, a pointed nose, a small smug mouth.
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.008;
    for (const sx of [0.46, 0.54]) {
      g.beginPath();
      g.moveTo(s * (sx - 0.03), s * 0.405);
      g.quadraticCurveTo(s * sx, s * 0.425, s * (sx + 0.03), s * 0.405);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.41);
    g.lineTo(s * 0.52, s * 0.46);
    g.lineTo(s * 0.495, s * 0.465);
    g.stroke();
    g.strokeStyle = '#a45b6e';
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.505);
    g.quadraticCurveTo(s * 0.5, s * 0.52, s * 0.54, s * 0.5);
    g.stroke();
    // The hand mirror, held up in her right hand with her own reflection of the sky in it.
    handMirror(g, s * 0.82, s * 0.62, s * 0.11, 0.25);
    glint(g, s * 0.88, s * 0.52, s * 0.03);
  },
  spells: [
    {
      key: 'Q', label: 'hand mirror', name: 'Hand Mirror', range: 10, cooldown: 3.5, aim: 'line', bank: true,
      blurb: 'A spinning hand mirror (10 m): 40 damage, +25% for each of up to three bounces. A mirror that lands after a bounce lies 2.5 s: walk within 1 m to catch it, and Hand Mirror is ready again.',
      icon(g, s) {
        iconGround(g, s);
        // A wall on the right, a ray in from the lower left, out to the upper left; a hand mirror on the ray.
        g.fillStyle = S.dark;
        g.fillRect(s * 0.78, s * 0.08, s * 0.18, s * 0.84);
        g.fillStyle = S.shade;
        g.fillRect(s * 0.78, s * 0.08, s * 0.04, s * 0.84);
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.014;
        g.strokeRect(s * 0.78, s * 0.08, s * 0.18, s * 0.84);
        ray(g, s * 0.06, s * 0.88, s * 0.78, s * 0.52, s * 0.05);
        ray(g, s * 0.78, s * 0.52, s * 0.12, s * 0.14, s * 0.05, S.violet);
        handMirror(g, s * 0.36, s * 0.7, s * 0.14, 0.9);
        glint(g, s * 0.78, s * 0.52, s * 0.14);
        glint(g, s * 0.22, s * 0.3, s * 0.045);
      },
    },
    {
      key: 'W', label: 'vanity stand', name: 'Vanity Stand', range: 8, cooldown: 12,
      blurb: 'A standing mirror at a spot (8 m) for 6 s, or until 60 damage breaks it. It blocks walking, sight and bolts, and her mirrors bounce off it. Whoever breaks it has Bad Luck: 15% less damage for 7 s.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(244,249,255,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.9, s * 0.34, s * 0.07, 0, 0, Math.PI * 2);
        g.stroke();
        ray(g, s * 0.02, s * 0.28, s * 0.38, s * 0.46, s * 0.04);
        standMirror(g, s * 0.58, s * 0.9, s * 0.78, s * 0.46);
        glint(g, s * 0.82, s * 0.2, s * 0.06);
        glint(g, s * 0.18, s * 0.7, s * 0.04, S.violet);
      },
    },
    {
      key: 'E', label: 'through the glass', name: 'Through the Glass', range: 9, cooldown: 10, dash: true,
      blurb: 'Step into her Stand and out of the far side, up to 9 m in all. With no Stand, a 3 m step toward the aim.',
      icon(g, s) {
        iconGround(g, s);
        // A mirror seen edge-on in the middle; a silver streak goes in on the left and a violet one comes out on the right, with a glint at the glass.
        standMirror(g, s * 0.5, s * 0.92, s * 0.8, s * 0.36);
        ray(g, s * 0.04, s * 0.6, s * 0.4, s * 0.52, s * 0.07);
        ray(g, s * 0.6, s * 0.44, s * 0.96, s * 0.3, s * 0.07, S.violet);
        g.fillStyle = S.core;
        g.beginPath();
        g.moveTo(s * 0.9, s * 0.22);
        g.lineTo(s * 0.97, s * 0.3);
        g.lineTo(s * 0.86, s * 0.33);
        g.closePath();
        g.fill();
        glint(g, s * 0.5, s * 0.48, s * 0.15);
      },
    },
    {
      key: 'R', label: 'hall of mirrors', name: 'Hall of Mirrors', range: 0, cooldown: 22,
      blurb: 'She spins and throws eight mirrors outward in a ring (12 m): 30 damage each, bouncing twice. Stand in a gap. Up to four that land can be caught: each cuts 2 s off this spell.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(244,249,255,0.45)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.54, s * 0.44, s * 0.26, 0, 0, Math.PI * 2);
        g.stroke();
        const pts: [number, number][] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          pts.push([s * (0.5 + Math.cos(a) * 0.36), s * (0.54 + Math.sin(a) * 0.22)]);
        }
        pts.forEach(([x, y], i) => ray(g, s * 0.5, s * 0.54, x, y, s * 0.03, i % 2 ? S.violet : S.body));
        pts.sort((a, b) => a[1] - b[1]);
        for (const [x, y] of pts) handMirror(g, x, y - s * 0.02, s * 0.075, (x - s * 0.5) * 0.012);
        glint(g, s * 0.5, s * 0.54, s * 0.12);
      },
    },
  ],
};
