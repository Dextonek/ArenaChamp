"""
Before and after pictures of the Climb's life (src/tower/world/life/): runs life-shots.js through world-shots.py twice, the life off
(`-before`) and on (`-after`), the same spots, the same steps.

    python -I pipeline/tools/life-shots.py --floor 12 --spots camp,v,e --out docs/tower/life/wood [--port 5185] [--only after]
                                           [--tier lite] [--size 844x390] [--step 4] [--off 6]

A spot is a place's id from the floor's look (the hero stands `off` m south of its middle) or x:z (world). Needs a dev server on the
port (npm run dev -- --port 5185).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--floor', type=int, required=True)
    ap.add_argument('--spots', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--port', type=int, default=5185)
    ap.add_argument('--only', default='')
    ap.add_argument('--tier', default='')
    ap.add_argument('--size', default='1280x720')
    ap.add_argument('--step', type=float, default=4)
    ap.add_argument('--off', type=float, default=6)
    ap.add_argument('--tag', default='')
    ap.add_argument('--zoom', type=float, default=0)
    a = ap.parse_args()
    spots = []
    for s in a.spots.split(','):
        if ':' in s and not s.startswith('@'):
            p = s.split(':')
            spots.append([float(p[0]), float(p[1])] + ([p[2]] if len(p) > 2 else []))
        else:
            spots.append(s)
    body = (ROOT / 'pipeline' / 'tools' / 'life-shots.js').read_text(encoding='utf-8')
    looks = ("const { GEN_FLOORS } = await import('/src/tower/world/floors/gen/index.ts');\n"
             "const { lifeLook } = await import('/src/tower/world/life/index.ts');\n"
             f"const LK = lifeLook({a.floor});\n")
    for life in ([False, True] if not a.only else [a.only == 'after']):
        tag = a.tag or ('after' if life else 'before')
        P = {'floor': a.floor, 'spots': spots, 'life': life, 'tier': a.tier or None, 'tag': tag, 'step': a.step, 'off': a.off, 'zoom': a.zoom or None}
        script = looks + f'const P = {json.dumps(P)};\nP.look = LK?.places ?? [];\n' + body
        fd, name = tempfile.mkstemp(suffix='.js', prefix='life-shots-')
        os.close(fd)
        tmp = Path(name)
        tmp.write_text(script, encoding='utf-8')
        try:
            r = subprocess.run([sys.executable, '-I', str(ROOT / 'pipeline' / 'tools' / 'world-shots.py'), str(tmp), '--page', '/game', '--port', str(a.port),
                                '--out', a.out, '--size', a.size] + (['--touch'] if a.tier == 'lite' and a.size != '1280x720' else []), cwd=str(ROOT), timeout=580)
        finally:
            tmp.unlink(missing_ok=True)
        if r.returncode:
            sys.exit(r.returncode)


if __name__ == '__main__':
    main()
