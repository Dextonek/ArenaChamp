import type { HeroKit } from '../heroes';

/**
 * Sheep kit data: Bo, the angry shepherd (kits v5, new heroes). Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: a dusk-green pasture ground, mid-tone wool, a black sheep face, dark wood and a little hay yellow and anger red. Signature
 * shape: the lumpy cloud of a sheep with its black face and four stick legs, and the crook.
 */
const S = {
  core: '#f6f1df', accent: '#f0ead6', wool: '#b8b2a4', woolHi: '#d3cdbc', woolLo: '#8f897b', black: '#1e1a19', wood: '#7a5a3a', woodHi: '#a8845a',
  hay: '#c9b26a', red: '#e0603a', skin: '#d9a89a', dark: '#14110f', grass: '#3c4a2a',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#3d4a2a');
  r.addColorStop(1, '#15180e');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(120,150,70,0.18)';
  for (let i = 0; i < 9; i++) g.fillRect(s * (0.08 + (i * 0.37) % 0.86), s * (0.82 + ((i * 0.13) % 0.14)), s * 0.012, s * 0.05);
}

/** A cloud of wool centred on (cx, cy), `r` its half-width: dark outline, mid-tone lumps, a few lit ones. */
function fleece(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, tint = S.wool) {
  const lumps: [number, number, number][] = [
    [-0.6, 0.1, 0.5], [-0.3, -0.3, 0.52], [0.1, -0.4, 0.55], [0.5, -0.2, 0.5], [0.65, 0.15, 0.45], [0.3, 0.35, 0.48], [-0.2, 0.4, 0.5], [0, 0, 0.62],
  ];
  g.fillStyle = S.dark;
  for (const [x, y, k] of lumps) { g.beginPath(); g.arc(cx + x * r, cy + y * r * 0.8, k * r + r * 0.09, 0, Math.PI * 2); g.fill(); }
  lumps.forEach(([x, y, k], i) => {
    g.fillStyle = i % 3 === 0 ? S.woolLo : tint;
    g.beginPath();
    g.arc(cx + x * r, cy + y * r * 0.8, k * r, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = S.woolHi;
  for (const [x, y, k] of [lumps[1], lumps[2], lumps[7]]) { g.beginPath(); g.arc(cx + (x - 0.1) * r, cy + (y - 0.12) * r * 0.8, k * r * 0.45, 0, Math.PI * 2); g.fill(); }
}

/** A sheep seen from the side, facing right: fleece, black head and ears, four stick legs. `r` is the fleece half-width. */
function sheep(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, tint = S.wool) {
  g.strokeStyle = S.black;
  g.lineCap = 'round';
  g.lineWidth = r * 0.17;
  for (const x of [-0.5, -0.2, 0.2, 0.5]) { g.beginPath(); g.moveTo(cx + x * r, cy + r * 0.4); g.lineTo(cx + x * r, cy + r * 0.95); g.stroke(); }
  fleece(g, cx, cy, r, tint);
  g.fillStyle = S.black;
  g.beginPath();
  g.ellipse(cx + r * 0.95, cy - r * 0.05, r * 0.34, r * 0.28, 0.25, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + r * 0.78, cy - r * 0.3, r * 0.2, r * 0.1, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.core;
  g.beginPath();
  g.arc(cx + r * 1.05, cy - r * 0.12, r * 0.06, 0, Math.PI * 2);
  g.fill();
}

/** The crook: a staff from (x1,y1) to (x2,y2) with its pale hook curled over at the (x2,y2) end. */
function crook(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.lineCap = 'round';
  for (const [c, k] of [[S.dark, 1.5], [S.wood, 1]] as [string, number][]) {
    g.strokeStyle = c;
    g.lineWidth = w * k;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.beginPath();
    g.arc(x2 + Math.cos(a - Math.PI / 2) * w * 2.2, y2 + Math.sin(a - Math.PI / 2) * w * 2.2, w * 2.2, a + Math.PI / 2, a + Math.PI * 1.9, false);
    g.stroke();
  }
  g.strokeStyle = S.woodHi;
  g.lineWidth = w * 0.3;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

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

/** A speed streak. */
function streak(g: CanvasRenderingContext2D, x1: number, y: number, x2: number, w: number, c = S.hay) {
  g.strokeStyle = c;
  g.globalAlpha = 0.7;
  g.lineCap = 'round';
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y);
  g.lineTo(x2, y);
  g.stroke();
  g.globalAlpha = 1;
}

export const sheepKit: HeroKit = {
  name: 'Bo',
  title: 'the angry shepherd',
  accent: S.accent,
  foil: S.wood,
  maxHp: 620,
  portrait(g, s) {
    iconGround(g, s);
    // A sheep under his arm, bottom right, looking unimpressed.
    sheep(g, s * 0.78, s * 0.8, s * 0.13);
    // The crook, shaken up beside his head.
    crook(g, s * 0.12, s * 0.98, s * 0.2, s * 0.14, s * 0.026);
    // Shoulders in a thick brown wool coat with a shaggy collar.
    g.fillStyle = '#5a4230';
    g.beginPath();
    g.moveTo(s * 0.12, s);
    g.quadraticCurveTo(s * 0.14, s * 0.72, s * 0.34, s * 0.64);
    g.quadraticCurveTo(s * 0.5, s * 0.58, s * 0.66, s * 0.64);
    g.quadraticCurveTo(s * 0.86, s * 0.72, s * 0.88, s);
    g.closePath();
    g.fill();
    fleece(g, s * 0.5, s * 0.66, s * 0.2, S.woolLo);
    // A huge grey-white beard under a red, furious face.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.62, s * 0.215, s * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b9b3a6';
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.46);
    g.quadraticCurveTo(s * 0.28, s * 0.74, s * 0.5, s * 0.84);
    g.quadraticCurveTo(s * 0.72, s * 0.74, s * 0.7, s * 0.46);
    g.quadraticCurveTo(s * 0.5, s * 0.58, s * 0.3, s * 0.46);
    g.fill();
    g.fillStyle = '#d6d0c2';
    g.beginPath();
    g.ellipse(s * 0.42, s * 0.62, s * 0.05, s * 0.1, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c4604a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.14, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    // Eyes under a scowl, a shouting mouth in the beard.
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.018;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.36);
    g.lineTo(s * 0.47, s * 0.4);
    g.moveTo(s * 0.6, s * 0.36);
    g.lineTo(s * 0.53, s * 0.4);
    g.stroke();
    g.fillStyle = S.core;
    g.fillRect(s * 0.42, s * 0.415, s * 0.04, s * 0.02);
    g.fillRect(s * 0.54, s * 0.415, s * 0.04, s * 0.02);
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.58, s * 0.06, s * 0.045, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b8473a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.595, s * 0.035, s * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c4604a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.5, s * 0.025, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    // The wide hat: a brim and a low crown, a hay band.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.31, s * 0.34, s * 0.075, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6a5034';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.305, s * 0.32, s * 0.06, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a4230';
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.3);
    g.quadraticCurveTo(s * 0.36, s * 0.12, s * 0.5, s * 0.12);
    g.quadraticCurveTo(s * 0.64, s * 0.12, s * 0.66, s * 0.3);
    g.closePath();
    g.fill();
    g.fillStyle = S.hay;
    g.fillRect(s * 0.345, s * 0.24, s * 0.31, s * 0.03);
    glint(g, s * 0.86, s * 0.22, s * 0.04);
  },
  spells: [
    {
      key: 'Q', label: 'crook whack', name: 'Crook Whack', range: 4, cooldown: 3.5,
      blurb: 'He shakes his crook, then whacks a 4 m cone: 45 damage, and a sheep at the feet of whoever he hits. Stay out of 4 m.',
      icon(g, s) {
        iconGround(g, s);
        // The swept wedge on the ground, a sheep at its far end, the crook coming down.
        g.fillStyle = 'rgba(201,178,106,0.35)';
        g.beginPath();
        g.moveTo(s * 0.18, s * 0.9);
        g.arc(s * 0.18, s * 0.9, s * 0.78, -Math.PI * 0.42, -Math.PI * 0.02);
        g.closePath();
        g.fill();
        g.strokeStyle = S.hay;
        g.lineWidth = s * 0.02;
        g.stroke();
        sheep(g, s * 0.68, s * 0.7, s * 0.14);
        crook(g, s * 0.1, s * 0.2, s * 0.5, s * 0.62, s * 0.04);
        glint(g, s * 0.52, s * 0.64, s * 0.1);
        glint(g, s * 0.84, s * 0.38, s * 0.045, S.hay);
      },
    },
    {
      key: 'W', label: 'spare sheep', name: 'Spare Sheep', range: 8, cooldown: 8, summon: true,
      blurb: 'Three sheep land at a spot (8 m) for 6 s: 30 HP each. They walk to whoever is nearest, him or you, and each touch adds Wool. Six units a side at most.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(201,178,106,0.6)';
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.82, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        // Three sheep in a small ring, the back one highest; a little arc over the top shows them thrown.
        sheep(g, s * 0.5, s * 0.34, s * 0.12);
        sheep(g, s * 0.3, s * 0.64, s * 0.14);
        sheep(g, s * 0.64, s * 0.7, s * 0.15);
        g.strokeStyle = S.hay;
        g.setLineDash([s * 0.03, s * 0.035]);
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.moveTo(s * 0.06, s * 0.3);
        g.quadraticCurveTo(s * 0.12, s * 0.02, s * 0.36, s * 0.1);
        g.stroke();
        g.setLineDash([]);
        glint(g, s * 0.82, s * 0.2, s * 0.05);
      },
    },
    {
      key: 'E', label: 'shear', name: 'Shear', range: 8, cooldown: 11, aim: 'line',
      blurb: 'Needs a sheep within 6 m: he shears it, it runs on naked and fast, and he throws the wool (8 m): 40 damage and 3 Wool.',
      icon(g, s) {
        iconGround(g, s);
        // A naked pink sheep at the bottom left, a ball of wool flying up and right on a pale line, a pair of shears.
        const sx = s * 0.26, sy = s * 0.74;
        g.strokeStyle = S.black;
        g.lineCap = 'round';
        g.lineWidth = s * 0.026;
        for (const x of [-0.07, -0.03, 0.04, 0.08]) { g.beginPath(); g.moveTo(sx + x * s, sy + s * 0.04); g.lineTo(sx + x * s, sy + s * 0.15); g.stroke(); }
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(sx, sy, s * 0.14, s * 0.075, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.skin;
        g.beginPath();
        g.ellipse(sx, sy, s * 0.125, s * 0.06, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.black;
        g.beginPath();
        g.ellipse(sx + s * 0.14, sy - s * 0.01, s * 0.05, s * 0.04, 0.2, 0, Math.PI * 2);
        g.fill();
        streak(g, s * 0.36, s * 0.46, s * 0.62, s * 0.03);
        fleece(g, s * 0.72, s * 0.34, s * 0.2);
        // Shears: two crossed blades with round bows.
        g.save();
        g.translate(s * 0.34, s * 0.52);
        for (const a of [0.5, -0.5]) {
          g.rotate(a);
          g.fillStyle = S.dark;
          g.fillRect(-s * 0.02, -s * 0.2, s * 0.045, s * 0.26);
          g.fillStyle = '#b0b6bd';
          g.fillRect(-s * 0.012, -s * 0.19, s * 0.026, s * 0.24);
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.03;
          g.beginPath();
          g.arc(0, s * 0.1, s * 0.035, 0, Math.PI * 2);
          g.stroke();
          g.rotate(-a);
        }
        g.restore();
        glint(g, s * 0.9, s * 0.12, s * 0.05);
      },
    },
    {
      key: 'R', label: 'stampede', name: 'Stampede', range: 12, cooldown: 22,
      blurb: 'Eight sheep run down a 12 m line, 4 m wide, after 0.8 s: 25 each, three hits at most, and each hit adds Wool. Step out of the line.',
      icon(g, s) {
        iconGround(g, s);
        // A row of sheep charging right, one rank behind another, dust and speed lines streaming back.
        g.fillStyle = 'rgba(201,178,106,0.14)';
        g.fillRect(0, s * 0.3, s, s * 0.46);
        for (const y of [0.4, 0.52, 0.64]) streak(g, s * 0.02, s * y, s * (0.22 + y * 0.12), s * 0.025);
        g.fillStyle = 'rgba(168,154,120,0.5)';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(s * (0.1 + i * 0.07), s * (0.78 + (i % 2) * 0.05), s * (0.04 + (i % 3) * 0.01), 0, Math.PI * 2); g.fill(); }
        sheep(g, s * 0.5, s * 0.34, s * 0.12);
        sheep(g, s * 0.78, s * 0.46, s * 0.13);
        sheep(g, s * 0.4, s * 0.58, s * 0.14);
        sheep(g, s * 0.7, s * 0.74, s * 0.15);
        glint(g, s * 0.9, s * 0.16, s * 0.05);
      },
    },
  ],
};
