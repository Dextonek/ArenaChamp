#!/bin/sh
# The gate of one batch of hero moves (docs/pipeline/hero-framework.md, sections 10 and 11), run in Git Bash:
#   sh pipeline/tools/hero-checks.sh <ref> <out>
# <ref>: a folder with the references taken on the code before the batch's work:
#   roster.json    python pipeline/tools/hero-roster.py take <ref>/roster.json
#   selftest.json  python pipeline/tools/hero-roster.py selftest <ref>/selftest.json
#   guard.txt      python pipeline/rustfull/guard.py > <ref>/guard.txt
# <out>: where this run's files go. Prints: tsc, the roster diff, the self test, the guard, the 80 fight prints, the build.
REF="$1"; T="$2"
[ -n "$REF" ] && [ -n "$T" ] || { echo "usage: hero-checks.sh <ref> <out>"; exit 2; }
mkdir -p "$T"
cd "$(dirname "$0")/../.." || exit 1
echo "== tsc"
npx tsc --noEmit -p . > "$T/tsc.txt" 2>&1; echo "tsc exit $?"; head -20 "$T/tsc.txt"
echo "== roster"
python pipeline/tools/hero-roster.py take "$T/roster.json" --port 5195
python pipeline/tools/hero-roster.py diff "$REF/roster.json" "$T/roster.json" | tail -40
echo "== self test"
python pipeline/tools/hero-roster.py selftest "$T/selftest.json" --port 5195
python -c "
import json,sys
a=json.load(open(sys.argv[1],encoding='utf-8')); b=json.load(open(sys.argv[2],encoding='utf-8'))
print('self test identical' if a==b else 'SELF TEST DIFFERS: '+str([k for k in a if a[k]!=b.get(k)]))" "$REF/selftest.json" "$T/selftest.json"
echo "== guard"
python pipeline/rustfull/guard.py > "$T/guard.txt" 2>&1
diff "$T/guard.txt" "$REF/guard.txt" > /dev/null && echo "guard: the same lines" || { echo "GUARD DIFFERS"; diff "$T/guard.txt" "$REF/guard.txt"; }
echo "== prints (Isolde)"
python pipeline/tools/hero-prints.py check --port 5192 --jobs 5 > "$T/prints-isolde.txt" 2>&1; echo "exit $?"
grep -E "ANOTHER|CRASH|of 40" "$T/prints-isolde.txt"
echo "== prints (Brannoc)"
python pipeline/tools/hero-prints.py check --foe Brannoc --port 5192 --jobs 5 > "$T/prints-brannoc.txt" 2>&1; echo "exit $?"
grep -E "ANOTHER|CRASH|of 40" "$T/prints-brannoc.txt"
echo "== build"
npm run build > "$T/build.txt" 2>&1; echo "build exit $?"
grep -E "assets/(game|runtime)-.*\.js" "$T/build.txt" | head -4
