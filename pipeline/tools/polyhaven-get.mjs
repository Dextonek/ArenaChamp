// Fetches models and textures from Poly Haven (https://polyhaven.com, all CC0) into pipeline/assets/polyhaven/<id>/:
// a model as glTF with its textures, a texture set as its diffuse, normal (GL), roughness and AO maps (JPG).
//
//   node pipeline/tools/polyhaven-get.mjs [--size] [--res 1k] <id> [<id> ...]
//
// `--size` only lists what would be fetched and how big it is. The raw files are the source for the Blender arena
// builds (blender/arenas/real/); the game ships only what those export. Not committed: see .gitignore.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const only = args.includes('--size');
const ri = args.indexOf('--res');
const res = ri >= 0 ? args[ri + 1] : '1k';
const ids = args.filter((a, i) => !a.startsWith('--') && (ri < 0 || i !== ri + 1));
const UA = { 'User-Agent': 'asset-fetch/1.0' };
const root = path.resolve('pipeline/assets/polyhaven');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function get(url, file) {
  if (fs.existsSync(file)) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

for (const id of ids) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  const dir = path.join(root, id);
  const list = [];
  if (files.gltf) {
    const g = files.gltf[res]?.gltf ?? files.gltf['1k']?.gltf;
    if (!g) { console.log(id, 'no gltf at', res); continue; }
    list.push([g.url, path.join(dir, path.basename(g.url)), g.size]);
    for (const [rel, inc] of Object.entries(g.include ?? {})) list.push([inc.url, path.join(dir, rel), inc.size]);
  } else {
    // a texture set: the maps a real-time material uses
    for (const [map, name] of [['Diffuse', 'diff'], ['nor_gl', 'nor'], ['Rough', 'rough'], ['AO', 'ao'], ['Displacement', 'disp']]) {
      const f = files[map]?.[res]?.jpg;
      if (f) list.push([f.url, path.join(dir, `${id}_${name}_${res}.jpg`), f.size]);
    }
  }
  const total = list.reduce((s, l) => s + (l[2] ?? 0), 0);
  console.log(id.padEnd(28), list.length, 'files', mb(total));
  if (only) continue;
  for (const [url, file] of list) await get(url, file);
}
