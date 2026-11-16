"""Write the game's lore data, src/game/lore.ts, from docs/lore/LORE.md (the same source as the lore page).

    python pipeline/tools/lore-game.py

Only the heroes in the game are written (status `roster` in LORE.md): when a new hero ships, change its status there to
`roster`, give it its `- home:` and `- age:` lines, and run this again. The game loads the file only when a hero's lore is
first shown (a dynamic import), so the page's start does not grow.
"""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lorepage', ROOT / 'pipeline' / 'tools' / 'lore-page.py')
lp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lp)


def main():
    lore = lp.read(lp.SRC)
    facs = lore['factions']
    places = {p['id']: p['name'] for p in lore['places']}
    heroes = {h['name']: h for h in lore['heroes'] if h['status'] == 'roster'}
    ties = {n: [] for n in heroes}
    for t in lore['ties']:
        if t['sym']:
            wa = wb = lp.SYM[t['kind']]
        else:
            wa, wb = lp.ASYM[t['kind']]
        if t['a'] in heroes and t['b'] in heroes:
            ties[t['a']].append({'other': t['b'], 'kind': wa, 'pair': t['kind'], 'what': t['what'], 'strong': t['strong']})
            ties[t['b']].append({'other': t['a'], 'kind': wb, 'pair': t['kind'], 'what': t['what'], 'strong': t['strong']})
    out_f = {}
    for fid, f in facs.items():
        cols = [c[0] for c in f.get('colours', [])]
        out_f[fid] = {'name': f['name'], 'colours': cols, 'home': f.get('home', ''), 'wants': f.get('wants', ''), 'sigil': f.get('sigil', '')}
    out_h = {}
    for n, h in heroes.items():
        missing = [k for k in ('spot', 'age', 'line', 'people') if not h.get(k)]
        if missing:
            raise SystemExit(f'{n}: missing {", ".join(missing)} in LORE.md')
        out_h[n] = {
            'faction': h['faction'], 'place': h['home'], 'from': h['spot'], 'age': h['age'], 'line': h['line'],
            'legend': h['legend'], 'ties': ties[n], 'people': h['people'], 'kin': h['kin'],
            'origin': lore['origins'][n][0],
        }
    peoples = {pid: {'name': pe['name'], 'kind': pe['kind'], 'look': pe.get('look', ''), 'life': pe.get('life', ''),
                     'text': ' '.join(pe['text'])} for pid, pe in lore['peoples'].items()}
    head = (
        '// Made by pipeline/tools/lore-game.py from docs/lore/LORE.md: edit the lore there and run the script again.\n'
        '// The world of the Dial, its factions, peoples and places, and each hero\'s lore (faction, people, home, age, line,\n'
        '// legend, ties). The depth, the Codex screen, is made from docs/lore/codex/ by pipeline/tools/lore-codex.py.\n\n'
        'export interface LoreFaction { name: string; colours: string[]; home: string; wants: string; sigil: string }\n'
        'export interface LoreTie { other: string; kind: string; pair: string; what: string; strong: boolean }\n'
        'export interface LorePeople { name: string; kind: string; look: string; life: string; text: string }\n'
        '/** `people` is a key of PEOPLES; `kin` its kin inside it where that matters (a Briarkin court, a Fallborn kind).\n'
        ' * `origin` (the canon, 2026-11-15): dial, returned (taken by the Tower and come back out), halfkept, spilled (made by the\n'
        ' * Fall), followed (came after the Tower through the Tear). */\n'
        'export interface LoreHero {\n'
        '  faction: string; people: string; kin: string; place: string; from: string; age: string; line: string; legend: string;\n'
        '  origin: string;\n'
        '  ties: LoreTie[];\n'
        '}\n\n'
    )
    body = (
        f'export const FACTIONS: Record<string, LoreFaction> = {json.dumps(out_f, ensure_ascii=False, indent=1)};\n\n'
        f'export const PLACES: Record<string, string> = {json.dumps(places, ensure_ascii=False, indent=1)};\n\n'
        f'export const PEOPLES: Record<string, LorePeople> = {json.dumps(peoples, ensure_ascii=False, indent=1)};\n\n'
        f'export const LORE: Record<string, LoreHero> = {json.dumps(out_h, ensure_ascii=False, indent=1)};\n\n'
        '/** The tie between two heroes, as the first one sees it (null: none). */\n'
        'export function tieBetween(a: string, b: string): LoreTie | null {\n'
        '  return LORE[a]?.ties.find((t) => t.other === b) ?? null;\n'
        '}\n'
    )
    dst = ROOT / 'src' / 'game' / 'lore.ts'
    dst.write_text(head + body, encoding='utf-8')
    print(f'wrote {dst.relative_to(ROOT)}: {len(out_h)} heroes, {sum(len(t) for t in ties.values()) // 2} ties, {len(out_f)} factions, {len(peoples)} peoples')


if __name__ == '__main__':
    main()
