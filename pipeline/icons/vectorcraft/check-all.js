// Every hero's spell icons through the game's own hook (src/icons/vc.ts), all at once: each spell of each kit (and of
// Pom, the other half of Pim and Pom) is drawn into a 64 px canvas through `spell.icon`, as the spell bar, the Heroes
// table and the Shop do; after the files have loaded, each canvas is compared with its SVG drawn straight from the file.
// A canvas that differs still shows the kit's fallback (or the wrong file).
//
//   python pipeline/tools/page-shots.py pipeline/icons/vectorcraft/check-all.js <out folder> --port 5264
const { HERO_KITS } = await import('/src/heroes.ts');
const { heroStem } = await import('/src/icons/vc.ts');
performance.setResourceTimingBufferSize(5000);
const draws = [];
for (const k of HERO_KITS) for (const kit of k.alt ? [k, k.alt] : [k]) for (const s of kit.spells) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  s.icon(c.getContext('2d'), 64);
  draws.push({ name: `${heroStem(kit)}-${s.key.toLowerCase()}`, c, s });
}
const t0 = performance.now();
while (performance.now() - t0 < 20000) {
  await new Promise((ok) => setTimeout(ok, 500));
  const n = performance.getEntriesByType('resource').filter((e) => e.name.includes('/icons/spells/')).length;
  if (n >= 163) break;
}
await new Promise((ok) => setTimeout(ok, 1500));
const files = performance.getEntriesByType('resource').filter((e) => e.name.includes('/icons/spells/'));
let replaced = 0;
const same = [];
for (const d of draws) {
  const file = d.name === 'pom-r' ? 'pim-r' : d.name;
  const img = new Image();
  img.src = `/icons/spells/${file}.svg`;
  await img.decode().catch(() => null);
  const ref = document.createElement('canvas');
  ref.width = ref.height = 64;
  ref.getContext('2d').drawImage(img, 0, 0, 64, 64);
  const a = d.c.getContext('2d').getImageData(0, 0, 64, 64).data, b = ref.getContext('2d').getImageData(0, 0, 64, 64).data;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) diff++;
  if (diff < 40) replaced++; else same.push(`${d.name} (${diff} px differ)`);
}
// a sheet of what was drawn, 16 to a row
const sheet = document.createElement('canvas');
sheet.width = 16 * 66; sheet.height = Math.ceil(draws.length / 16) * 66;
const g = sheet.getContext('2d');
g.fillStyle = '#0e0c12'; g.fillRect(0, 0, sheet.width, sheet.height);
draws.forEach((d, i) => g.drawImage(d.c, (i % 16) * 66 + 1, Math.floor(i / 16) * 66 + 1));
return { canvases: draws.length, files: files.length, replaced, stillFallback: same, sheet: sheet.toDataURL('image/png') };
