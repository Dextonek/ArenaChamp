// Today's canvas icons of the sample's heroes, drawn by each kit's own `icon()` at 128 px (the size the game draws them
// at), for the side-by-side on docs/icons/sample/index.html:
//
//   python pipeline/tools/page-shots.py pipeline/icons/vectorcraft/old-icons.js docs/icons/sample/old --port 5263
const { HERO_KITS } = await import('/src/heroes.ts');
const out = {};
for (const [name, file] of [['Anka', 'anka'], ['Mum', 'mum']]) {
  const kit = HERO_KITS.find((k) => k.name === name);
  for (const s of kit.spells) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    s.icon(c.getContext('2d'), 128);
    out[`${file}-${s.key.toLowerCase()}`] = c.toDataURL('image/png');
  }
}
return out;
