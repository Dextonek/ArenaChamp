import type { HeroKit } from '../heroes';

/**
 * Alchemy kit data (Vex, the Plague Alchemist): dark green ground, pale glass foil, acid green, a little gold. Icons are
 * drawn on canvases in the kit palette, one signature shape each (see pipeline/designs/kit-alchemy.md).
 */
const A = {
  core: '#f4ffe0', hot: '#c8ff4a', body: '#4fbf2a', accent: '#ff5ad8', dark: '#0c1606', glass: '#dcefe6', gold: '#e8b84a',
  deep: '#1d3a10', coat: '#16240e',
};

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#1d3a10');
  r.addColorStop(1, A.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A round flask centred at (cx, cy): glass outline, dark acid inside, a cork. `w` is the body width. */
function flask(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const r = w / 2;
  // Liquid.
  g.fillStyle = A.deep;
  g.beginPath(); g.arc(0, 0, r * 0.9, Math.PI * 0.05, Math.PI * 0.95); g.closePath(); g.fill();
  g.fillStyle = A.body;
  g.beginPath(); g.arc(0, 0, r * 0.9, Math.PI * 0.2, Math.PI * 0.8); g.closePath(); g.fill();
  // Glass: body circle, neck, lip.
  g.strokeStyle = A.glass;
  g.lineWidth = Math.max(1.5, w * 0.07);
  g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(-r * 0.3, -r * 0.93); g.lineTo(-r * 0.26, -r * 1.55); g.moveTo(r * 0.3, -r * 0.93); g.lineTo(r * 0.26, -r * 1.55); g.stroke();
  g.fillStyle = '#6b5232';
  g.fillRect(-r * 0.3, -r * 1.85, r * 0.6, r * 0.34);
  // A pinpoint highlight.
  g.fillStyle = A.core;
  g.beginPath(); g.arc(-r * 0.45, -r * 0.3, w * 0.04, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** A bubble: green disc, dark rim, pinpoint highlight. */
function bubble(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = A.body;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = A.hot;
  g.lineWidth = Math.max(1, r * 0.25);
  g.beginPath(); g.arc(x, y, r * 0.8, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  g.strokeStyle = A.dark;
  g.lineWidth = Math.max(1, r * 0.2);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}

/** A glass shard: a thin pale triangle. */
function shard(g: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = 'rgba(220,239,230,0.55)';
  g.strokeStyle = A.core;
  g.lineWidth = Math.max(1, size * 0.12);
  g.beginPath(); g.moveTo(0, -size); g.lineTo(-size * 0.55, size * 0.7); g.lineTo(size * 0.6, size * 0.55); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

/** A curl of dark fume with a hot rim. */
function fume(g: CanvasRenderingContext2D, x: number, y: number, h: number) {
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const px = x + Math.sin(k * 5) * h * 0.22, py = y - k * h, pr = h * (0.1 + 0.07 * k);
    g.fillStyle = '#16300c';
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = A.hot;
    g.lineWidth = Math.max(1, pr * 0.2);
    g.beginPath(); g.arc(px, py, pr, Math.PI * 1.15, Math.PI * 1.75); g.stroke();
  }
}

/** The alchemical circle: a ring, a hexagram and an inner ring, in the given colour. */
function circleGlyph(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string, lw: number, squash = 1) {
  g.save();
  g.translate(cx, cy);
  g.scale(1, squash);
  g.strokeStyle = colour;
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.82, 0, Math.PI * 2); g.stroke();
  for (const rot of [-Math.PI / 2, Math.PI / 2]) {
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2;
      if (k === 0) g.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); else g.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
    }
    g.closePath();
    g.stroke();
  }
  g.restore();
}

export const alchemyKit: HeroKit = {
  name: 'Vex',
  title: 'the Plague Alchemist',
  accent: A.body,
  foil: A.glass,
  portrait(g, s) {
    ground(g, s);
    // A dark hood, a pale glass mask with two round green lenses, and a coat with a bandolier of vials.
    g.fillStyle = A.coat;
    g.beginPath();
    g.moveTo(s * 0.08, s);
    g.quadraticCurveTo(s * 0.12, s * 0.66, s * 0.34, s * 0.6);
    g.lineTo(s * 0.66, s * 0.6);
    g.quadraticCurveTo(s * 0.88, s * 0.66, s * 0.92, s);
    g.closePath();
    g.fill();
    g.fillStyle = '#0f1a09';
    g.beginPath();
    g.moveTo(s * 0.24, s * 0.56);
    g.quadraticCurveTo(s * 0.22, s * 0.12, s * 0.5, s * 0.1);
    g.quadraticCurveTo(s * 0.78, s * 0.12, s * 0.76, s * 0.56);
    g.quadraticCurveTo(s * 0.5, s * 0.66, s * 0.24, s * 0.56);
    g.closePath();
    g.fill();
    g.strokeStyle = A.glass;
    g.lineWidth = s * 0.012;
    g.stroke();
    // The mask: a pale glass face plate with a long beak-like snout.
    g.fillStyle = A.glass;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.3);
    g.quadraticCurveTo(s * 0.5, s * 0.24, s * 0.66, s * 0.3);
    g.quadraticCurveTo(s * 0.68, s * 0.5, s * 0.56, s * 0.6);
    g.lineTo(s * 0.5, s * 0.74);
    g.lineTo(s * 0.44, s * 0.6);
    g.quadraticCurveTo(s * 0.32, s * 0.5, s * 0.34, s * 0.3);
    g.closePath();
    g.fill();
    for (const x of [0.42, 0.58]) {
      g.fillStyle = A.dark;
      g.beginPath(); g.arc(s * x, s * 0.37, s * 0.058, 0, Math.PI * 2); g.fill();
      g.fillStyle = A.hot;
      g.beginPath(); g.arc(s * x, s * 0.37, s * 0.04, 0, Math.PI * 2); g.fill();
      g.fillStyle = A.core;
      g.beginPath(); g.arc(s * (x - 0.012), s * 0.355, s * 0.011, 0, Math.PI * 2); g.fill();
    }
    // The vial bandolier across the chest.
    g.strokeStyle = '#6b5232';
    g.lineWidth = s * 0.03;
    g.beginPath(); g.moveTo(s * 0.2, s * 0.78); g.lineTo(s * 0.82, s * 0.98); g.stroke();
    for (let i = 0; i < 4; i++) {
      const k = i / 3, x = s * (0.3 + 0.38 * k), y = s * (0.81 + 0.15 * k);
      g.fillStyle = i % 2 === 0 ? A.body : A.hot;
      g.fillRect(x - s * 0.025, y - s * 0.02, s * 0.05, s * 0.09);
      g.strokeStyle = A.glass;
      g.lineWidth = s * 0.008;
      g.strokeRect(x - s * 0.025, y - s * 0.02, s * 0.05, s * 0.09);
    }
    bubble(g, s * 0.84, s * 0.2, s * 0.04);
    bubble(g, s * 0.9, s * 0.34, s * 0.025);
  },
  spells: [
    {
      key: 'Q', label: 'volatile flask', name: 'Volatile Flask', range: 10, cooldown: 3,
      blurb: 'Lobs a flask in a high arc. It shatters on the enemy in glass and caustic splash, and burns for a moment.',
      icon(g, s) {
        ground(g, s);
        // Thrown arc, a flask at the top, and the splash with bubbles and shards below.
        g.strokeStyle = 'rgba(220,239,230,0.55)';
        g.lineWidth = s * 0.025;
        g.setLineDash([s * 0.04, s * 0.05]);
        g.beginPath(); g.moveTo(s * 0.12, s * 0.62); g.quadraticCurveTo(s * 0.4, s * 0.0, s * 0.74, s * 0.58); g.stroke();
        g.setLineDash([]);
        flask(g, s * 0.5, s * 0.27, s * 0.3, 0.6);
        g.fillStyle = A.body;
        g.beginPath(); g.ellipse(s * 0.74, s * 0.8, s * 0.2, s * 0.07, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = A.hot;
        g.lineWidth = s * 0.015;
        g.beginPath(); g.ellipse(s * 0.74, s * 0.8, s * 0.2, s * 0.07, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
        bubble(g, s * 0.68, s * 0.74, s * 0.05);
        bubble(g, s * 0.82, s * 0.72, s * 0.035);
        shard(g, s * 0.58, s * 0.66, s * 0.07, 0.4);
        shard(g, s * 0.88, s * 0.6, s * 0.06, -0.5);
        g.fillStyle = A.accent;
        g.beginPath(); g.arc(s * 0.74, s * 0.66, s * 0.025, 0, Math.PI * 2); g.fill();
      },
    },
    {
      key: 'W', label: 'caustic pool', name: 'Caustic Pool', range: 10, cooldown: 7,
      blurb: 'Two flasks shatter on the point and an alchemical circle fills with boiling acid that burns everything in it.',
      icon(g, s) {
        ground(g, s);
        circleGlyph(g, s * 0.5, s * 0.66, s * 0.44, A.glass, s * 0.018, 0.34);
        g.fillStyle = A.body;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.66, s * 0.34, s * 0.12, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = A.hot;
        g.lineWidth = s * 0.015;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.66, s * 0.34, s * 0.12, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
        bubble(g, s * 0.36, s * 0.66, s * 0.06);
        bubble(g, s * 0.52, s * 0.6, s * 0.08);
        bubble(g, s * 0.66, s * 0.68, s * 0.05);
        fume(g, s * 0.4, s * 0.52, s * 0.4);
        fume(g, s * 0.64, s * 0.5, s * 0.3);
      },
    },
    {
      key: 'E', label: 'mutagen', name: 'Mutagen', range: 0, cooldown: 9,
      blurb: 'She drinks a flask. Four flasks orbit her and spit acid at every enemy nearby, twice, then shatter.',
      icon(g, s) {
        ground(g, s);
        g.strokeStyle = 'rgba(200,255,74,0.4)';
        g.lineWidth = s * 0.015;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.34, s * 0.34, 0, 0, Math.PI * 2); g.stroke();
        // A green glow in the middle and four flasks around it.
        const gr = g.createRadialGradient(s * 0.5, s * 0.5, s * 0.02, s * 0.5, s * 0.5, s * 0.22);
        gr.addColorStop(0, A.hot);
        gr.addColorStop(1, 'rgba(79,191,42,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.22, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5;
          flask(g, s * 0.5 + Math.cos(a) * s * 0.34, s * 0.5 + Math.sin(a) * s * 0.34, s * 0.2, a + Math.PI / 2 + 0.4);
        }
        bubble(g, s * 0.5, s * 0.5, s * 0.06);
        fume(g, s * 0.5, s * 0.46, s * 0.3);
      },
    },
    {
      key: 'R', label: 'grand transmutation', name: 'Grand Transmutation', range: 13, cooldown: 20,
      blurb: 'Ultimate. A giant circle turns the whole zone and everything in it to gold, then shatters it.',
      icon(g, s) {
        ground(g, s);
        circleGlyph(g, s * 0.5, s * 0.5, s * 0.46, A.gold, s * 0.02, 1);
        // The gold statue (a hooded shape) with cracks, and a green core below it.
        g.fillStyle = A.gold;
        g.beginPath();
        g.moveTo(s * 0.36, s * 0.7);
        g.quadraticCurveTo(s * 0.36, s * 0.46, s * 0.5, s * 0.42);
        g.quadraticCurveTo(s * 0.64, s * 0.46, s * 0.64, s * 0.7);
        g.closePath();
        g.fill();
        g.beginPath(); g.arc(s * 0.5, s * 0.34, s * 0.075, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff0c0';
        g.beginPath(); g.moveTo(s * 0.4, s * 0.68); g.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.47, s * 0.46); g.lineTo(s * 0.45, s * 0.68); g.closePath(); g.fill();
        g.strokeStyle = A.dark;
        g.lineWidth = s * 0.016;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.54, s * 0.44); g.lineTo(s * 0.5, s * 0.54); g.lineTo(s * 0.57, s * 0.62); g.lineTo(s * 0.52, s * 0.7); g.stroke();
        g.beginPath(); g.moveTo(s * 0.5, s * 0.54); g.lineTo(s * 0.42, s * 0.6); g.stroke();
        bubble(g, s * 0.5, s * 0.8, s * 0.045);
        shard(g, s * 0.22, s * 0.3, s * 0.05, 0.5);
        shard(g, s * 0.8, s * 0.7, s * 0.05, -0.4);
      },
    },
  ],
};
