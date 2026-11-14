#!/bin/sh
# Runs one test of this folder on the dev server at 5261 and prints its checks (pictures saved, long values left out).
# sh pipeline/tools/heroes20-engine/run.sh sleep [out folder]
t=$1; out=${2:-pipeline/sim/out/heroes20-engine/$t}
python pipeline/tools/page-shots.py pipeline/tools/heroes20-engine/$t.js "$out" --port 5261 --timeout 280 --json result.json > /dev/null 2>&1
python -c "
import json,sys
d=json.load(open(sys.argv[1]+'/result.json'))
print('OK' if d.get('ok') else 'FAILED', sys.argv[2])
for c in d.get('checks',[]): print(' ', 'ok ' if c['ok'] else 'NO ', c['name'], '' if c['ok'] else json.dumps(c.get('detail'))[:300])
for e in d.get('errors',[]): print('  error:', e[:300])
" "$out" "$t"
