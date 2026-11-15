// The heroes' spells as data for the icon pages (docs/icons/spells.json):
//   python pipeline/tools/page-shots.py pipeline/icons/vectorcraft/spells.js docs/icons --port 5264 --json spells.json
const { HERO_KITS } = await import('/src/heroes.ts');
const { heroStem } = await import('/src/icons/vc.ts');
const kits = [];
for (const k of HERO_KITS) for (const kit of k.alt ? [k, k.alt] : [k])
  kits.push({ stem: heroStem(kit), name: kit.name, title: kit.title, accent: kit.accent, foil: kit.foil,
    spells: kit.spells.map((s) => ({ key: s.key, name: s.name, blurb: s.blurb })) });
return { kits };
