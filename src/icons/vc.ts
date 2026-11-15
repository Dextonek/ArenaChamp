import type { HeroKit } from '../heroes';

/**
 * A SAMPLE, not the game's icons (docs/icons/sample/index.html): with `?icons=vc` in the URL, the heroes drawn with
 * VectorCraft (pipeline/icons/vectorcraft/) show those icons (variant A) wherever a spell's `icon` is drawn; checked in the
 * duel's spell bar (docs/icons/sample/bar/). Without the flag this module is never loaded and nothing changes. Take it out
 * (and the hook in heroes.ts) before any merge: with it, a build carries one more lazy chunk and the sample's SVGs.
 *
 * Each icon is one SVG file (about 4-18 KB), loaded as an image and drawn into the slot's canvas. `HeroSpell.icon` draws
 * synchronously, once, so a slot built before its image has decoded is drawn again into the same canvas when it has.
 */
const FILES = import.meta.glob('../../docs/icons/sample/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const HEROES: Record<string, string> = { Anka: 'anka', Mum: 'mum' };

export function useVcIcons(kits: HeroKit[]) {
  for (const kit of kits) {
    const stem = HEROES[kit.name];
    if (!stem) continue;
    for (const spell of kit.spells) {
      const url = FILES[`../../docs/icons/sample/${stem}-${spell.key.toLowerCase()}.svg`];
      if (!url) continue;
      const img = new Image();
      img.src = url;
      spell.icon = (g, s) => {
        const draw = () => {
          g.clearRect(0, 0, s, s);
          g.drawImage(img, 0, 0, s, s);
        };
        if (img.complete && img.naturalWidth) draw();
        else img.addEventListener('load', draw, { once: true });
      };
    }
  }
}
