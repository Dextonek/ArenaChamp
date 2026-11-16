// Today's canvas icons (each kit's own `icon()`) at 128 px, the size the game draws them at, for the side-by-side on the
// batch pages (docs/icons/batch-<n>/) and the ranking sheet. Every hero, and Pom (the other half of Pim and Pom):
//
//   python pipeline/tools/page-shots.py pipeline/icons/vectorcraft/old-icons.js docs/icons/old --port 5263
//
// Saves docs/icons/old/<stem>-<slot>.png; the stem is the hero's slug (`heroStem` in src/icons/vc.ts).
const { HERO_KITS } = await import('/src/heroes.ts');
const { heroStem, kitIcon } = await import('/src/icons/vc.ts');
const out = {};
const seen = new Set();
for (const k of HERO_KITS) {
  for (const kit of k.alt ? [k, k.alt] : [k]) {
    const stem = heroStem(kit);
    for (const s of kit.spells) {
      if (seen.has(s)) continue; // Tag Out: one spell, both halves
      seen.add(s);
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      kitIcon(s)(c.getContext('2d'), 128);
      out[`${stem}-${s.key.toLowerCase()}`] = c.toDataURL('image/png');
    }
  }
}
return out;
