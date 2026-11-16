import type { HeroKit, HeroSpell } from '../heroes';

/**
 * The spell icons drawn with VectorCraft (pipeline/icons/vectorcraft/make.py, docs/icons/): one SVG per spell, served from
 * `public/icons/spells/<stem>-<slot>.svg` (the picture at 118%, its big shapes over the octagon frame's edge: version B).
 *
 * A hero listed in DRAWN has its spells' `icon(g, size)` replaced by one that draws the SVG into the same canvas, so the
 * code that builds the spell bar, the heroes table and the shop does not change. Nothing is fetched until a slot of that
 * hero is first drawn: then its four files are asked for together, and until they have loaded (or if one fails) the
 * kit's own canvas icon is drawn, and the file's picture replaces it in that canvas once it has decoded.
 */
const DRAWN = new Set<string>([
  'ada',
  'anka',
  'barry-cloudsley',
  'big-yoko',
  'bo',
  'bram',
  'fenna',
  'grandma-ironknit',
  'gus',
  'hank',
  'isolde',
  'kaia',
  'lyra',
  'mabel',
  'madame-cleaver',
  'mortis',
  'mr-ledger',
  'mum',
  'nyx',
  'oblivion',
  'opaline',
  'pim',
  'pip',
  'pom',
  'professor-puff',
  'referee-whistler',
  'sefu',
  'silvane',
  'sir-whiskers',
  'sirix',
  'tempo',
  'the-great-zambini',
  'vesper',
  'wick',
  'zephyr',
]);

/** A hero's file stem: its name in lower case with dashes (`Big Yoko` -> `big-yoko`); the twins are `pim` and `pom`. */
export function heroStem(kit: HeroKit): string {
  if (kit.name === 'Pim and Pom') return kit.base ? 'pom' : 'pim';
  return kit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type Draw = HeroSpell['icon'];
interface Pic { img: HTMLImageElement; ok: boolean; failed: boolean; waiting: Array<() => void> }

const pics = new Map<string, Pic>();
/** Each spell's own canvas icon, kept for the fallback (and for the side-by-side pages: pipeline/icons/vectorcraft/old-icons.js). */
const KIT_ICON = new WeakMap<HeroSpell, Draw>();

/** The kit's own canvas drawing of a spell's icon, whatever is drawn in the game. */
export const kitIcon = (spell: HeroSpell): Draw => KIT_ICON.get(spell) ?? spell.icon;

const version = typeof __BUILD__ !== 'undefined' && __BUILD__ !== 'dev' ? `?v=${__BUILD__}` : '';

function pic(url: string): Pic {
  let p = pics.get(url);
  if (p) return p;
  const img = new Image();
  img.decoding = 'async';
  p = { img, ok: false, failed: false, waiting: [] };
  const q = p;
  img.addEventListener('load', () => {
    q.ok = img.naturalWidth > 0;
    q.failed = !q.ok;
    for (const w of q.waiting.splice(0)) if (q.ok) w();
  }, { once: true });
  img.addEventListener('error', () => {
    q.failed = true;
    q.waiting.length = 0;
  }, { once: true });
  img.src = url;
  pics.set(url, p);
  return p;
}

function paint(g: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, size, size);
  g.restore();
}

/** Puts the VectorCraft icons on the heroes that have them (src/heroes.ts calls this once, in the browser). */
export function useVcIcons(kits: HeroKit[]) {
  if (typeof document === 'undefined') return;
  for (const k of kits) {
    for (const kit of k.alt ? [k, k.alt] : [k]) {
      const stem = heroStem(kit);
      if (!DRAWN.has(stem)) continue;
      const urls = kit.spells.map((s) => `/icons/spells/${stem}-${s.key.toLowerCase()}.svg${version}`);
      kit.spells.forEach((spell, i) => {
        if (KIT_ICON.has(spell)) return; // a spell shared by both halves of a hero (Tag Out) is wrapped once
        const own = spell.icon;
        KIT_ICON.set(spell, own);
        spell.icon = (g, size) => {
          const all = urls.map(pic); // the first slot drawn asks for all four of the hero's files
          const p = all[i];
          if (p.ok) return paint(g, p.img, size);
          own(g, size);
          if (!p.failed) p.waiting.push(() => paint(g, p.img, size));
        };
      });
    }
  }
}
