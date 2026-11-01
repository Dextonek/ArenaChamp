"""Check the collision tables in pipeline/designs/kit-identity-v2.md: every table under "Collision tables" and the
owned-verb registry must have 20 heroes and no repeated value. Prints each table's result; exits 1 on a duplicate."""
import re
import sys
from collections import Counter
from pathlib import Path

doc = Path(__file__).resolve().parents[1] / 'designs' / 'kit-identity-v2.md'
text = doc.read_text(encoding='utf8')

EXPECTED = ['Owned verbs (registry)', 'Passive mechanism', 'Twist: what fills it, what spends it',
            'Q: shape / rider', 'W: shape / rider', 'E: shape / rider', 'R: shape / rider']
seen = set()
bad = False
for title, body in re.findall(r'^#{2,3} (.+?)\n\n((?:\|.*\n)+)', text, re.M):
    rows = [[c.strip() for c in line.strip('|\n').split('|')] for line in body.splitlines()[2:]]
    if title not in EXPECTED:
        continue
    seen.add(title)
    if len(rows) != 20:
        print(f'BAD {title}: {len(rows)} rows, expected 20')
        bad = True
        continue
    values = Counter(r[1].lower() for r in rows)
    dupes = [v for v, n in values.items() if n > 1]
    heroes = len({r[0] for r in rows})
    ok = not dupes and heroes == 20
    bad |= not ok
    print(f"{'ok ' if ok else 'BAD'} {title}: {heroes} heroes, {len(values)} distinct" + (f", repeated: {dupes}" if dupes else ''))
for title in EXPECTED:
    if title not in seen:
        print(f'BAD {title}: table missing')
        bad = True
sys.exit(1 if bad else 0)
