import type { HeroKit } from '../heroes';

/**
 * Hidden test kits for the mechanics engine, not in `HERO_KITS`: `meleeTestKit` (shield, dash, heal, melee AI), reachable
 * through `vfx.testKits.melee`, `rangedTestKit` (skillshots), through `vfx.testKits.ranged`, and `summonTestKit` (summoned
 * units), through `vfx.testKits.summon`. The melee kit's Q is a cone cleave, W a gap-closing dash, E a shield, R a heal, all
 * from the `test: mechanics` spells. Plain steel-grey icons, no model (the capsule caster stands in).
 */
const T = { light: '#e6eef8', mid: '#9fb4cc', dark: '#2b3a50', bg: '#10161f' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#26364a');
  r.addColorStop(1, T.bg);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

function stroke(g: CanvasRenderingContext2D, s: number, w: number, color = T.light) {
  g.strokeStyle = color;
  g.lineWidth = s * w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
}

export const meleeTestKit: HeroKit = {
  name: 'Testwarden',
  title: 'the mechanics dummy',
  accent: T.mid,
  foil: T.light,
  maxHp: 780,
  melee: true,
  portrait(g, s) {
    ground(g, s);
    g.fillStyle = T.mid;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = T.dark;
    g.fillRect(s * 0.34, s * 0.4, s * 0.32, s * 0.08);
    g.fillRect(s * 0.46, s * 0.4, s * 0.08, s * 0.3);
  },
  spells: [
    {
      key: 'Q', label: 'cleave test', name: 'Cleave', range: 3, cooldown: 2.5,
      blurb: 'A wide swing in front of the warden: 45 to everyone inside the cone.',
      icon(g, s) {
        ground(g, s);
        stroke(g, s, 0.1, T.mid);
        g.beginPath();
        g.arc(s * 0.5, s * 0.78, s * 0.5, Math.PI * 1.2, Math.PI * 1.8);
        g.stroke();
        stroke(g, s, 0.04);
        g.beginPath();
        g.arc(s * 0.5, s * 0.78, s * 0.5, Math.PI * 1.22, Math.PI * 1.78);
        g.stroke();
      },
    },
    {
      key: 'W', label: 'dash test', name: 'Dash', range: 8, cooldown: 6, dash: true,
      blurb: 'Rushes to a spot in a quarter second and hits what is there for 20.',
      icon(g, s) {
        ground(g, s);
        stroke(g, s, 0.09);
        for (const x of [0.26, 0.5, 0.74]) {
          g.beginPath();
          g.moveTo(s * (x - 0.1), s * 0.26);
          g.lineTo(s * (x + 0.1), s * 0.5);
          g.lineTo(s * (x - 0.1), s * 0.74);
          g.stroke();
        }
      },
    },
    {
      key: 'E', label: 'shield test', name: 'Shield', range: 0, cooldown: 10,
      blurb: 'A 60 point shield for 4 seconds.',
      icon(g, s) {
        ground(g, s);
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.14);
        g.lineTo(s * 0.8, s * 0.26);
        g.lineTo(s * 0.76, s * 0.58);
        g.quadraticCurveTo(s * 0.7, s * 0.8, s * 0.5, s * 0.9);
        g.quadraticCurveTo(s * 0.3, s * 0.8, s * 0.24, s * 0.58);
        g.lineTo(s * 0.2, s * 0.26);
        g.closePath();
        g.fillStyle = T.mid;
        g.fill();
        stroke(g, s, 0.04);
        g.stroke();
      },
    },
    {
      key: 'R', label: 'heal test', name: 'Mend', range: 0, cooldown: 20,
      blurb: 'Ultimate. Heals 80.',
      icon(g, s) {
        ground(g, s);
        g.fillStyle = '#6aff9a';
        g.fillRect(s * 0.42, s * 0.2, s * 0.16, s * 0.6);
        g.fillRect(s * 0.2, s * 0.42, s * 0.6, s * 0.16);
        stroke(g, s, 0.025, T.dark);
        g.strokeRect(s * 0.42, s * 0.2, s * 0.16, s * 0.6);
        g.strokeRect(s * 0.2, s * 0.42, s * 0.6, s * 0.16);
      },
    },
  ],
};

/** Ranged skillshot dummy: Q a bolt, W a bolt that splits on its first hit, E a bolt that bounces, R a piercing lance. */
export const rangedTestKit: HeroKit = {
  name: 'Testranger',
  title: 'the skillshot dummy',
  accent: '#7ab8ff',
  foil: T.light,
  portrait(g, s) {
    ground(g, s);
    g.fillStyle = '#7ab8ff';
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = T.dark;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.12, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'bolt test', name: 'Bolt', range: 12, cooldown: 3, aim: 'line',
      blurb: 'A fast bolt along the aim line: 45 to the first enemy it touches. Step off the line to dodge it.',
      icon(g, s) {
        ground(g, s);
        boltIcon(g, s, 0.5, 0.5, 0, '#ff9a3c', '#ffe3a8');
      },
    },
    {
      key: 'W', label: 'split bolt test', name: 'Split bolt', range: 12, cooldown: 7, aim: 'line',
      blurb: 'A bolt that deals 35 and bursts into three bolts of 15 at its first hit.',
      icon(g, s) {
        ground(g, s);
        for (const a of [-0.45, 0, 0.45]) boltIcon(g, s, 0.5, 0.62, a, '#3ad0c8', '#c9fff4');
      },
    },
    {
      key: 'E', label: 'bounce bolt test', name: 'Ricochet', range: 12, cooldown: 9, aim: 'line',
      blurb: 'A bolt that deals 30, then jumps to the nearest other enemy within 6 m, twice.',
      icon(g, s) {
        ground(g, s);
        stroke(g, s, 0.05, '#7ad84a');
        g.beginPath();
        g.moveTo(s * 0.18, s * 0.78);
        g.lineTo(s * 0.4, s * 0.3);
        g.lineTo(s * 0.62, s * 0.7);
        g.lineTo(s * 0.84, s * 0.24);
        g.stroke();
      },
    },
    {
      key: 'R', label: 'pierce bolt test', name: 'Lance', range: 12, cooldown: 20, aim: 'line',
      blurb: 'Ultimate. A beam-like lance that passes through everyone in its path for 40 each.',
      icon(g, s) {
        ground(g, s);
        stroke(g, s, 0.07, '#7ab8ff');
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.92);
        g.lineTo(s * 0.5, s * 0.14);
        g.stroke();
        stroke(g, s, 0.03, '#e0f0ff');
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.9);
        g.lineTo(s * 0.5, s * 0.2);
        g.stroke();
      },
    },
  ],
};

/** Summoner dummy: Q a bolt, W two melee units, E a turret, R two ranged units. */
export const summonTestKit: HeroKit = {
  name: 'Testsummoner',
  title: 'the minion dummy',
  accent: '#b48cff',
  foil: T.light,
  portrait(g, s) {
    ground(g, s);
    g.fillStyle = '#b48cff';
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = T.dark;
    for (const x of [0.36, 0.5, 0.64]) {
      g.beginPath();
      g.arc(s * x, s * (x === 0.5 ? 0.42 : 0.58), s * 0.07, 0, Math.PI * 2);
      g.fill();
    }
  },
  spells: [
    {
      key: 'Q', label: 'summoner bolt test', name: 'Bolt', range: 12, cooldown: 3, aim: 'line',
      blurb: 'A fast bolt along the aim line: 45 to the first enemy it touches, units included.',
      icon(g, s) {
        ground(g, s);
        boltIcon(g, s, 0.5, 0.5, 0, '#ff9a3c', '#ffe3a8');
      },
    },
    {
      key: 'W', label: 'summon melee test', name: 'Guards', range: 6, cooldown: 9, summon: true,
      blurb: 'Two guards (40 HP, 6 s) walk to the nearest enemy and hit it for 6 every second.',
      icon(g, s) {
        ground(g, s);
        for (const x of [0.36, 0.64]) minionIcon(g, s, x, 0.66, 0.26, '#8fb4e8');
      },
    },
    {
      key: 'E', label: 'turret test', name: 'Turret', range: 6, cooldown: 12, summon: true,
      blurb: 'A turret (80 HP, 6 s) that fires a bolt of 10 every 1.4 s at what comes within 8 m.',
      icon(g, s) {
        ground(g, s);
        g.fillStyle = '#e8c86a';
        g.fillRect(s * 0.4, s * 0.5, s * 0.2, s * 0.3);
        g.fillRect(s * 0.28, s * 0.74, s * 0.44, s * 0.1);
        g.fillStyle = T.light;
        g.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.24);
        g.fillStyle = T.dark;
        g.beginPath();
        g.arc(s * 0.5, s * 0.42, s * 0.07, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'R', label: 'summon ranged test', name: 'Archers', range: 6, cooldown: 20, summon: true,
      blurb: 'Ultimate. Two archers (35 HP, 6 s) keep 6 m away and shoot 8 every 1.5 s.',
      icon(g, s) {
        ground(g, s);
        for (const x of [0.34, 0.66]) {
          minionIcon(g, s, x, 0.66, 0.26, '#c49cff');
          g.fillStyle = '#e4d0ff';
          g.beginPath();
          g.arc(s * (x + 0.14), s * 0.3, s * 0.05, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
  ],
};

/** A little figure (body cone and head) with its feet at (x, y), `h` tall, in `color`. */
function minionIcon(g: CanvasRenderingContext2D, s: number, x: number, y: number, h: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(s * (x - h * 0.4), s * y);
  g.lineTo(s * (x + h * 0.4), s * y);
  g.lineTo(s * x, s * (y - h * 0.9));
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(s * x, s * (y - h * 1.1), s * h * 0.28, 0, Math.PI * 2);
  g.fill();
  stroke(g, s, 0.02, T.dark);
  g.stroke();
}

/** A small bolt pointing up (rotated by `turn` radians) at (x, y): dark rim, coloured body, pale core. */
function boltIcon(g: CanvasRenderingContext2D, s: number, x: number, y: number, turn: number, body: string, core: string) {
  g.save();
  g.translate(s * x, s * y);
  g.rotate(turn);
  const blob = (rx: number, ry: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, s * rx, s * ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  g.fillStyle = body;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.moveTo(-s * 0.08, 0);
  g.lineTo(s * 0.08, 0);
  g.lineTo(0, s * 0.4);
  g.fill();
  g.globalAlpha = 1;
  blob(0.12, 0.17, T.dark);
  blob(0.09, 0.13, body);
  blob(0.045, 0.07, core);
  g.restore();
}
