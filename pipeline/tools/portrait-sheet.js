// The heroes' 2D portraits (each kit's `portrait`, drawn on a canvas as the game draws them) side by side at 256 px, with
// their names. Run with pipeline/tools/page-shots.py:
//   python pipeline/tools/page-shots.py pipeline/tools/portrait-sheet.js <out folder> --page /game --port 5284
// `window._only` (a list of hero names) narrows it; with `window._old`, a { name: dataURL } of earlier portraits, each is
// shown beside its earlier one. Returns `portraits` (the sheet) and, per hero, `p_<name>` at 256 px.
const t0 = performance.now();
while (!(window.game && game.api) && performance.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 200));
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
const only = window._only ?? [];
const list = only.length ? only.map((n) => kits.find((k) => k.name === n)).filter(Boolean) : kits;
const S = 256, cols = Math.min(list.length, 6), rows = Math.ceil(list.length / cols);
const c = document.createElement('canvas');
c.width = cols * S;
c.height = rows * (S + 24);
const g = c.getContext('2d');
g.fillStyle = '#111';
g.fillRect(0, 0, c.width, c.height);
const out = {};
list.forEach((k, i) => {
  const x = (i % cols) * S, y = Math.floor(i / cols) * (S + 24);
  const p = document.createElement('canvas');
  p.width = p.height = S;
  k.portrait(p.getContext('2d'), S);
  g.drawImage(p, x, y + 24);
  g.fillStyle = '#fc8';
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'center';
  g.fillText(k.name, x + S / 2, y + 17);
  out[`p_${k.name.replace(/[^A-Za-z]+/g, '-').toLowerCase()}`] = p.toDataURL('image/png');
});
out.portraits = c.toDataURL('image/jpeg', 0.92);
return out;
