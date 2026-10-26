// Merges pipeline/library/batch-*.json into pipeline/library/index.json and validates every recipe.
// Usage: node pipeline/build-index.mjs   (prints a tally; exits 1 on invalid recipes)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'library');
const PARTS = new Set(['core-flash', 'glow-sphere', 'emitter-sparks', 'emitter-smoke', 'emitter-wisps', 'emitter-embers',
  'ring-shockwave', 'ground-decal', 'rune-circle', 'light-pillar', 'beam-ribbon', 'trail-ribbon', 'mesh-projectile',
  'mesh-debris', 'lightning-arc', 'distortion', 'screen-flash', 'camera-shake', 'light']);
const TARGETING = new Set(['enemy', 'enemies', 'ground', 'self']);

const recipes = [];
const problems = [];
for (const f of readdirSync(dir).filter((n) => /^batch-.*\.json$/.test(n)).sort()) {
  for (const r of JSON.parse(readFileSync(join(dir, f), 'utf8'))) recipes.push({ ...r, batch: f });
}
const ids = new Set();
for (const r of recipes) {
  const where = `${r.batch}:${r.id}`;
  if (!r.id || ids.has(r.id)) problems.push(`${where}: missing or duplicate id`);
  ids.add(r.id);
  if (!TARGETING.has(r.targeting)) problems.push(`${where}: targeting "${r.targeting}"`);
  if (!r.source?.url?.startsWith('http')) problems.push(`${where}: no source url`);
  if (!Array.isArray(r.layers) || r.layers.length < 2) problems.push(`${where}: fewer than 2 layers`);
  for (const l of r.layers ?? []) if (!PARTS.has(l.part)) problems.push(`${where}: unknown part "${l.part}"`);
  if (!Array.isArray(r.phases) || !r.phases.length) problems.push(`${where}: no phases`);
}

recipes.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(dir, 'index.json'), JSON.stringify(recipes, null, 2) + '\n');

const tally = (k) => Object.entries(recipes.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {}))
  .map(([v, n]) => `${v} ${n}`).join(', ');
console.log(`${recipes.length} recipes`);
console.log(`archetype: ${tally('archetype')}`);
console.log(`targeting: ${tally('targeting')}`);
console.log(`element:   ${tally('element')}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
