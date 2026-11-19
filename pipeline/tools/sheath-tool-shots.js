// Contact sheets of the Scarlet Sheath's four spells as the TOOL page plays them (no hero, no duel: the shared arena and its
// training targets), one sheet a spell:
//
//   MSYS_NO_PATHCONV=1 python pipeline/tools/page-shots.py pipeline/tools/sheath-tool-shots.js docs/spells/kagen/tool --browser msedge
//
// The body of an async function run in the tool page (see page-shots.py), with pipeline/tools/contact-sheet.js's `_review`.
eval(await (await fetch('/pipeline/tools/contact-sheet.js')).text());
const out = {};
const jobs = [
  ['issen', 'issen', [0.2, 0.42, 0.5, 0.56, 0.75, 1.0], { dist: 11, h: 7, ty: 0.8, caster: [0, 0, 5], dur: 2 }],
  ['noto', 'noto', [0.15, 0.4, 0.52, 0.6, 0.8, 1.1], { dist: 11, h: 7, ty: 1.0, caster: [0, 0, 1.5], count: 6, dur: 2 }],
  ['senbon', 'senbon', [0.5, 0.9, 1.05, 1.45, 1.85, 2.3], { dist: 13, h: 7, ty: 1.2, caster: [0, 0, 7], dur: 3 }],
  ['sekai giri', 'sekai-giri', [0.4, 1.0, 1.25, 1.36, 1.6, 2.1], { dist: 16, h: 9, ty: 1.5, caster: [0, 0, 8], count: 6, dur: 3 }],
];
for (const [label, slug, times, opts] of jobs) {
  const r = await _review(label, slug, times, opts);
  const i = r.indexOf('data:image');
  out[slug] = r.slice(i);
  out[slug + '_self'] = r.slice(0, i).split('NAME:')[0].trim();
}
return out;
