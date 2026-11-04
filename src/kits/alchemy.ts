import type { HeroKit } from '../heroes';

/**
 * Alchemy kit data (Vitriol, the Plague Alchemist): dark green ground, pale glass foil, three reagent colours (green, orange, violet). Icons are
 * drawn on canvases in the kit palette, one signature shape each (see pipeline/designs/kit-alchemy.md).
 */
const A = {
  tox: '#6bff3a', fire: '#ff8a2a', acid: '#b872ff', fireHot: '#ffc23a', acidHot: '#d9a6ff',
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
function flask(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, rot = 0, liquid = A.body) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const r = w / 2;
  // Liquid.
  g.fillStyle = A.deep;
  g.beginPath(); g.arc(0, 0, r * 0.9, Math.PI * 0.05, Math.PI * 0.95); g.closePath(); g.fill();
  g.fillStyle = liquid;
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
  name: 'Vitriol',
  title: 'the Plague Alchemist',
  maxHp: 510,
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
      key: 'Q', label: 'toxin dart', name: 'Toxin Dart', range: 9, cooldown: 3, aim: 'line',
      blurb: 'A fast glass dart (9 m): 20, then 25 more over 3 s. Leaves green toxin on the enemy for 4 s. Reaches 6 m in about half a second: step off the line.',
      icon(g, s) {
        ground(g, s);
        // A dart flying up-right: glass shell, green core, needle tip, a bubble trail and a green splat spark.
        g.save();
        g.translate(s * 0.52, s * 0.48);
        g.rotate(-0.62);
        g.fillStyle = 'rgba(220,239,230,0.28)';
        g.strokeStyle = A.glass;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.roundRect(-s * 0.3, -s * 0.07, s * 0.46, s * 0.14, s * 0.07); g.fill(); g.stroke();
        g.fillStyle = A.tox;
        g.beginPath(); g.roundRect(-s * 0.27, -s * 0.045, s * 0.4, s * 0.09, s * 0.045); g.fill();
        g.fillStyle = A.hot;
        g.fillRect(-s * 0.22, -s * 0.035, s * 0.3, s * 0.02);
        g.fillStyle = A.core;
        g.beginPath(); g.moveTo(s * 0.16, -s * 0.045); g.lineTo(s * 0.34, 0); g.lineTo(s * 0.16, s * 0.045); g.closePath(); g.fill();
        g.fillStyle = A.glass;
        g.beginPath(); g.arc(-s * 0.31, 0, s * 0.055, 0, Math.PI * 2); g.fill();
        g.restore();
        bubble(g, s * 0.26, s * 0.7, s * 0.04);
        bubble(g, s * 0.18, s * 0.78, s * 0.028);
        bubble(g, s * 0.34, s * 0.78, s * 0.022);
        // The green toxin clinging: a drip below the tip.
        g.fillStyle = A.tox;
        g.beginPath(); g.arc(s * 0.82, s * 0.3, s * 0.05, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(s * 0.82, s * 0.36); g.quadraticCurveTo(s * 0.8, s * 0.5, s * 0.82, s * 0.56); g.quadraticCurveTo(s * 0.86, s * 0.5, s * 0.82, s * 0.36); g.fill();
        g.strokeStyle = A.hot;
        g.lineWidth = s * 0.012;
        g.beginPath(); g.arc(s * 0.82, s * 0.3, s * 0.035, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      },
    },
    {
      key: 'W', label: 'fire vial', name: 'Fire Vial', range: 7, cooldown: 6,
      blurb: 'A vial of fire that cannot miss (7 m, needs sight): 18, then 25 more over 2 s. Leaves orange fire on the enemy for 4 s.',
      icon(g, s) {
        ground(g, s);
        // A vial with orange liquid, tilted, bursting into flame tongues.
        flask(g, s * 0.4, s * 0.55, s * 0.4, -0.5, A.fire);
        const tongue = (x: number, y: number, h: number, w: number, col: string) => {
          g.fillStyle = col;
          g.beginPath();
          g.moveTo(x - w, y);
          g.quadraticCurveTo(x - w * 0.9, y - h * 0.5, x + w * 0.1, y - h);
          g.quadraticCurveTo(x + w * 0.5, y - h * 0.45, x + w, y);
          g.closePath();
          g.fill();
        };
        tongue(s * 0.72, s * 0.84, s * 0.5, s * 0.1, A.fire);
        tongue(s * 0.86, s * 0.84, s * 0.34, s * 0.07, A.fire);
        tongue(s * 0.6, s * 0.84, s * 0.3, s * 0.06, A.fire);
        tongue(s * 0.72, s * 0.84, s * 0.3, s * 0.05, A.fireHot);
        g.fillStyle = A.fireHot;
        g.beginPath(); g.arc(s * 0.22, s * 0.28, s * 0.028, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(s * 0.3, s * 0.18, s * 0.02, 0, Math.PI * 2); g.fill();
        shard(g, s * 0.62, s * 0.4, s * 0.06, 0.6);
        shard(g, s * 0.84, s * 0.54, s * 0.05, -0.4);
      },
    },
    {
      key: 'E', label: 'acid splash', name: 'Acid Splash', range: 4, cooldown: 8,
      blurb: 'A 4 m cone of violet acid in front of her: 40 and a shove back. Leaves violet acid on the enemy for 4 s. Her answer to being rushed.',
      icon(g, s) {
        ground(g, s);
        // A cone of violet spray fanning out from a smashed flask at the bottom left.
        const gr = g.createRadialGradient(s * 0.2, s * 0.8, s * 0.02, s * 0.2, s * 0.8, s * 0.9);
        gr.addColorStop(0, A.acidHot);
        gr.addColorStop(1, 'rgba(184,114,255,0.15)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(s * 0.2, s * 0.8); g.arc(s * 0.2, s * 0.8, s * 0.85, -Math.PI * 0.42, -Math.PI * 0.02); g.closePath(); g.fill();
        g.strokeStyle = A.acid;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.arc(s * 0.2, s * 0.8, s * 0.85, -Math.PI * 0.42, -Math.PI * 0.02); g.stroke();
        g.beginPath(); g.moveTo(s * 0.2, s * 0.8); g.lineTo(s * 0.2 + Math.cos(-Math.PI * 0.42) * s * 0.85, s * 0.8 + Math.sin(-Math.PI * 0.42) * s * 0.85); g.moveTo(s * 0.2, s * 0.8); g.lineTo(s * 0.2 + Math.cos(-Math.PI * 0.02) * s * 0.85, s * 0.8 + Math.sin(-Math.PI * 0.02) * s * 0.85); g.stroke();
        // Droplets across the fan and the smashed flask.
        g.fillStyle = A.acid;
        for (const [x, y, r] of [[0.5, 0.46, 0.04], [0.62, 0.62, 0.05], [0.74, 0.44, 0.035], [0.82, 0.66, 0.045], [0.56, 0.7, 0.03], [0.7, 0.32, 0.03]] as const) {
          g.beginPath(); g.arc(s * x, s * y, s * r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = A.acidHot;
          g.lineWidth = s * 0.01;
          g.beginPath(); g.arc(s * x, s * y, s * r * 0.7, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
        }
        flask(g, s * 0.2, s * 0.8, s * 0.26, 0.9, A.acid);
        shard(g, s * 0.36, s * 0.6, s * 0.06, 0.5);
        shard(g, s * 0.3, s * 0.86, s * 0.045, -0.6);
      },
    },
    {
      key: 'R', label: 'homunculus', name: 'Homunculus', range: 10, cooldown: 25, summon: true,
      blurb: 'Ultimate. A little walking bomb (120 HP, 4 m/s) climbs out at her feet with all three reagents in its belly and walks at the enemy. It bursts on the enemy for 55 and sets off every reaction at once. Shoot it down or outrun it.',
      icon(g, s) {
        ground(g, s);
        circleGlyph(g, s * 0.5, s * 0.78, s * 0.42, A.glass, s * 0.016, 0.3);
        // The homunculus: a glass belly with three reagent orbs, a cork neck and a lit fuse, two little legs.
        g.fillStyle = '#6b5232';
        g.fillRect(s * 0.44, s * 0.2, s * 0.12, s * 0.07);
        g.strokeStyle = A.glass;
        g.lineWidth = s * 0.022;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.45, s * 0.27); g.lineTo(s * 0.43, s * 0.36); g.moveTo(s * 0.55, s * 0.27); g.lineTo(s * 0.57, s * 0.36); g.stroke();
        g.fillStyle = A.deep;
        g.beginPath(); g.arc(s * 0.5, s * 0.56, s * 0.22, 0, Math.PI * 2); g.fill();
        g.stroke();
        for (const [x, y, c] of [[0.43, 0.52, A.tox], [0.57, 0.52, A.fire], [0.5, 0.64, A.acid]] as const) {
          g.fillStyle = c;
          g.beginPath(); g.arc(s * x, s * y, s * 0.07, 0, Math.PI * 2); g.fill();
          g.fillStyle = A.core;
          g.beginPath(); g.arc(s * (x - 0.02), s * (y - 0.02), s * 0.015, 0, Math.PI * 2); g.fill();
        }
        // Eyes and legs.
        g.fillStyle = A.hot;
        g.beginPath(); g.arc(s * 0.44, s * 0.4, s * 0.025, 0, Math.PI * 2); g.arc(s * 0.56, s * 0.4, s * 0.025, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#6b5232';
        g.lineWidth = s * 0.04;
        g.beginPath(); g.moveTo(s * 0.4, s * 0.76); g.lineTo(s * 0.36, s * 0.86); g.moveTo(s * 0.6, s * 0.76); g.lineTo(s * 0.66, s * 0.84); g.stroke();
        // The fuse: a spark on a curl.
        g.strokeStyle = A.glass;
        g.lineWidth = s * 0.012;
        g.beginPath(); g.moveTo(s * 0.52, s * 0.2); g.quadraticCurveTo(s * 0.6, s * 0.1, s * 0.66, s * 0.14); g.stroke();
        g.fillStyle = A.fireHot;
        g.beginPath(); g.moveTo(s * 0.66, s * 0.08); g.lineTo(s * 0.69, s * 0.14); g.lineTo(s * 0.75, s * 0.15); g.lineTo(s * 0.69, s * 0.18); g.lineTo(s * 0.66, s * 0.24); g.lineTo(s * 0.63, s * 0.18); g.lineTo(s * 0.57, s * 0.15); g.lineTo(s * 0.63, s * 0.14); g.closePath(); g.fill();
        bubble(g, s * 0.82, s * 0.5, s * 0.03);
        fume(g, s * 0.2, s * 0.8, s * 0.3);
      },
    },
  ],
};
