"""
The Climb review of one floor (docs/tower/review/): runs the four parts one after the other in headless browsers on the review's dev
server and prints what to look at. Each part stops itself within 590 s.

    python -I pipeline/tools/climb-review-floor.py 2 [--raw <folder for the raw pictures>] [--port 5196] [--parts static,route,shots,phone]

The dev server: `npx vite --config pipeline/tools/vite.review.config.ts` (port 5196; REVIEW_PORT to change it). The JSON of each part
goes to docs/tower/review/floors-01-30/fNN/ (or floors-31-50 for those floors); the pictures to --raw/fNN (default: the same folder).
Choose the pictures for the page with climb-review-page.py.
"""
import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'pipeline' / 'tools'


def up(port):
    try:
        urllib.request.urlopen(f'http://localhost:{port}/game', timeout=10)
        return True
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('floor', type=int)
    ap.add_argument('--raw', default='')
    ap.add_argument('--port', type=int, default=5196)
    ap.add_argument('--hero', default='Lyra')
    ap.add_argument('--parts', default='static,route,shots,phone')
    a = ap.parse_args()
    n = a.floor
    if not up(a.port):
        sys.exit(f'no dev server on {a.port}: npx vite --config pipeline/tools/vite.review.config.ts')
    group = 'floors-01-30' if n <= 30 else 'floors-31-50'
    out = f'docs/tower/review/{group}/f{n:02d}'
    pics = str(Path(a.raw) / f'f{n:02d}') if a.raw else out
    runs = {
        'static': ['climb-review-static.js', []],
        'route': ['climb-review-route.js', []],
        'shots': ['climb-review-shots.js', []],
        'phone': ['climb-review-shots.js', ['--size', '390x844', '--touch', '--json', 'phone']],
    }
    for part in a.parts.split(','):
        js, extra = runs[part]
        cmd = [sys.executable, '-I', str(TOOLS / 'climb-review.py'), str(TOOLS / js), '--floor', str(n), '--out', out, '--pics', pics, '--port', str(a.port), '--hero', a.hero, *extra]
        print(f'--- {part}', flush=True)
        try:
            p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=620)
            print(p.stdout.strip().splitlines()[-1] if p.stdout.strip() else p.stderr[-800:])
            for line in p.stdout.splitlines():
                if line.startswith('  ERR'):
                    print(line)
        except subprocess.TimeoutExpired:
            print(f'{part}: timed out')
    summary(ROOT / out)


def load(folder, name):
    p = folder / f'{name}.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None


def summary(folder):
    s, r, sh, ph = (load(folder, k) for k in ('static', 'route', 'shots', 'phone'))
    if s:
        x = s['result']
        t = x['texts']
        print(f"floor {x['floor']}: {t['name']} | {t['blurb']}")
        st = x['check']['states']
        print('reachable:', [(q['paths'], q['reachableM2'], q['unreachable'], [b for b in q['barriers'] if b['viaM'] == 'none' or b['viaM'] < 12]) for q in st], 'most units', x['check']['mostUnitsNear'])
        print('people in cover:', x['peopleInCover'])
        pr = x.get('props', {})
        print('props:', pr.get('counts'), 'grass steep:', [(k['kind'], k['over06'], k['over10'], k['offMax']) for k in x.get('grass', {}).get('kinds', []) if k['over06'] or k['offMax'] > 0.3])
        print('packs table:', x['packsTable'])
        print('errors static:', s['errors'][:3])
    if r:
        x = r['result']
        q = x.get('route', {})
        if q:
            print(f"route: ok {q.get('ok')} cleared {q.get('floorCleared')} {q.get('seconds')} s, falls {q.get('falls')}, restarts {q.get('restarts')}, kills {q.get('kills')}, stars {q.get('stars')}, notDone {q.get('notDone')}, gate tries {q.get('gateTries')}, ruler tries {q.get('rulerTries')}")
            print('  log:', q.get('gameLog'))
            print('  errors:', q.get('errors'), r['errors'][:3])
            print('  packs end:', [(p['id'], p['state']) for p in (x.get('packsEnd') or []) if p['state'] != 'cleared'])
            stuck = [w for w in x.get('whyAll') or [] if 'STILL' in w]
            if stuck:
                print('  STILL:', stuck[:6])
        else:
            print('route failed:', x)
    if sh:
        x = sh['result']
        print('shots: errors', sh['errors'][:3], '| frames', x.get('frames'), '| ruler', x.get('ruler'))
    if ph:
        print('phone: errors', ph['errors'][:3])


if __name__ == '__main__':
    main()
