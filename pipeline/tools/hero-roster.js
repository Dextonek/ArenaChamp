// The roster as the game page sees it (pipeline/tools/hero-roster.py): run on /game.html of a dev server, it returns every
// hero's kit field by field (and Pim and Pom's other half), the tooltips letter for letter, models, bodies, the passives,
// a pixel hash of every canvas icon (the kit's own drawing, `kitIcon`) and portrait, which VectorCraft SVG each slot asks for, and every spell the game registers with its targeting, bloom, settings and length.
// Used to prove that moving heroes into folders (docs/pipeline/hero-framework.md) changes nothing the game reads.
async () => {
  const { HERO_KITS, HERO_BODIES } = await import('/src/heroes.ts');
  const { TRAITS } = await import('/src/traits/index.ts');
  const { gameModules } = await import('/src/spells/targeted/game.ts');
  const { targetedModules } = await import('/src/spells/targeted/index.ts');
  const { kitIcon } = await import('/src/icons/vc.ts');

  // which pictures a hero's slot icons ask for: the image addresses set while they draw (a hero's files load together)
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  let srcs = [];
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get: srcDesc.get, set(v) { srcs.push(String(v).replace(location.origin, '')); srcDesc.set.call(this, v); } });

  // a value as plain data: functions by name only, objects by their own keys (sorted), cycles cut
  const plain = (v, seen = new Set()) => {
    if (typeof v === 'function') return '<fn>';
    if (v === undefined) return '<undefined>';
    if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '<cycle>';
    seen.add(v);
    if (v.isColor) return '#' + v.getHexString();
    if (v.isVector3 || v.isVector2) return v.toArray();
    if (Array.isArray(v)) return v.map((x) => plain(x, seen));
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = plain(v[k], seen);
    return out;
  };

  const hashPixels = async (draw, size) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    try { draw(g, size); } catch (e) { return 'error: ' + String(e); }
    const data = g.getImageData(0, 0, size, size).data;
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const kitOf = async (k) => {
    const fields = {};
    for (const key of Object.keys(k).sort()) {
      if (key === 'spells' || key === 'alt' || key === 'base' || key === 'portrait') continue;
      fields[key] = plain(k[key]);
    }
    const spells = [];
    srcs = [];
    for (const s of k.spells) {
      const sp = {};
      for (const key of Object.keys(s).sort()) if (key !== 'icon') sp[key] = plain(s[key]);
      sp.icon64 = await hashPixels(kitIcon(s), 64);
      sp.icon32 = await hashPixels(kitIcon(s), 32);
      await hashPixels(s.icon, 32);
      spells.push(sp);
    }
    const svgs = srcs.slice().sort();
    const portrait = await hashPixels(k.portrait, 96);
    return { fields, portrait, spells, svgs };
  };

  const kits = [];
  for (const k of HERO_KITS) {
    const one = await kitOf(k);
    if (k.alt) one.alt = await kitOf(k.alt);
    kits.push(one);
  }

  const traits = {};
  for (const name of Object.keys(TRAITS).sort()) {
    const t = TRAITS[name];
    const o = {};
    for (const key of Object.keys(t).sort()) o[key] = plain(t[key]);
    traits[name] = o;
  }

  const modules = {};
  for (const m of gameModules) {
    const o = { category: m.category, targeting: plain(m.targeting), bloom: plain(m.bloom), hooks: Object.keys(m).filter((k) => typeof m[k] === 'function').sort() };
    try {
      const e = m.create();
      o.settings = plain(e.settings);
      o.duration = e.duration;
      o.effectHooks = ['cast', 'play', 'update', 'dispose', 'screen'].filter((k) => k in e);
    } catch (err) {
      o.createError = String(err);
    }
    if (modules[m.label]) o.duplicate = true;
    modules[m.label] = o;
  }
  const named = new Set();
  for (const k of HERO_KITS) for (const kit of [k, k.alt].filter(Boolean)) for (const s of kit.spells) named.add(s.label);
  const missing = [...named].filter((l) => !modules[l]).sort();

  return {
    roster: HERO_KITS.map((k) => k.name),
    kits,
    bodies: plain(HERO_BODIES),
    traits,
    modules,
    gameOrder: gameModules.map((m) => m.label),
    toolLabels: targetedModules.map((m) => m.label).sort(),
    missing,
  };
}
