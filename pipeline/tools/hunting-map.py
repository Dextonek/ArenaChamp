"""
A floor's layout as a picture (SVG) with the open ground where a hunting plain could go (2026-11-19, the user: "make some zone where to
fight mobs like plains where mobs spawn"). Reads a baked floor file (src/tower/world/floors/gen/<file>.ts): its outline, roads, places,
packs and cover, and finds the widest open discs of walkable ground clear of all of them.

    python -I pipeline/tools/hunting-map.py sea-04 [--plains 2] > out.svg
"""
import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    s = (ROOT / 'src/tower/world/floors/gen' / f'{name}.ts').read_text(encoding='utf-8')
    i = s.index('{', s.index('GenFloor = '))
    return json.loads(s[i:s.rindex('}') + 1])


def seg_d(px, pz, ax, az, bx, bz):
    ex, ez = bx - ax, bz - az
    l2 = ex * ex + ez * ez
    t = max(0.0, min(1.0, ((px - ax) * ex + (pz - az) * ez) / l2)) if l2 > 0 else 0.0
    return math.hypot(px - ax - ex * t, pz - az - ez * t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('floor')
    ap.add_argument('--plains', type=int, default=2)
    ap.add_argument('--size', type=int, default=560)
    a = ap.parse_args()
    g = load(a.floor)
    look, fl = g['look'], g['floor']
    RX, RZ = 0, 7
    rim = look['rim']
    n = len(rim)

    def rim_at(dx, dz):
        ang = math.atan2(dz, dx) % (2 * math.pi)
        k = ang / (2 * math.pi) * n
        i = int(k) % n
        f = k - int(k)
        return rim[i] * (1 - f) + rim[(i + 1) % n] * f

    paths = [[(p[0], p[1]) for p in path] for path in look['paths']]
    places = [(v['x'] - RX, v['z'] - RZ, v['r']) for v in fl['places'].values()]
    packs = [(p['at']['x'] - RX, p['at']['z'] - RZ) for p in fl['packs']]
    cover = [((pc['o']['ax'] - RX, pc['o']['az'] - RZ, pc['o']['bx'] - RX, pc['o']['bz'] - RZ, pc['o']['r'])) for pc in look['pieces'] if pc.get('look') != 'edge']
    spots = [(p['at']['x'] - RX, p['at']['z'] - RZ) for p in fl['people']] + [(c['at']['x'] - RX, c['at']['z'] - RZ) for c in fl['caches']] + [(w['at']['x'] - RX, w['at']['z'] - RZ) for w in fl['waystones']]

    def clear(dx, dz):
        """How far (dx, dz) is from anything a plain must keep off (negative: outside the walkable ground)."""
        d = rim_at(dx, dz) - 6 - math.hypot(dx, dz)
        for path in paths:
            for i in range(1, len(path)):
                d = min(d, seg_d(dx, dz, *path[i - 1], *path[i]) - 3)
        for (x, z, r) in places:
            d = min(d, math.hypot(dx - x, dz - z) - r - 6)
        for (x, z) in packs:
            d = min(d, math.hypot(dx - x, dz - z) - 14)
        for (x, z) in spots:
            d = min(d, math.hypot(dx - x, dz - z) - 4)
        for (ax, az, bx, bz, r) in cover:
            d = min(d, seg_d(dx, dz, ax, az, bx, bz) - r - 1)
        return d

    R = max(rim) + 4
    plains = []
    cand = []
    for x in range(int(-R), int(R) + 1, 3):
        for z in range(int(-R), int(R) + 1, 3):
            c = clear(x, z)
            if c > 8:
                cand.append((c, x, z))
    cand.sort(reverse=True)
    for c, x, z in cand:
        if len(plains) >= a.plains:
            break
        if all(math.hypot(x - px, z - pz) > pr + c + 25 for (px, pz, pr) in plains):
            plains.append((x, z, min(c, 26)))

    S = a.size
    sc = S / (2 * R)
    X = lambda dx: (dx + R) * sc
    Z = lambda dz: (dz + R) * sc
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="Floor {g["n"]} from above">']
    pts = ' '.join(f'{X(math.cos(i / n * 2 * math.pi) * rim[i]):.1f},{Z(math.sin(i / n * 2 * math.pi) * rim[i]):.1f}' for i in range(n))
    out.append(f'<polygon points="{pts}" fill="var(--land)" stroke="var(--edge)" stroke-width="1.5"/>')
    for (ax, az, bx, bz, r) in cover:
        out.append(f'<line x1="{X(ax):.1f}" y1="{Z(az):.1f}" x2="{X(bx):.1f}" y2="{Z(bz):.1f}" stroke="var(--cover)" stroke-width="{max(1.2, 2 * r * sc):.1f}" stroke-linecap="round"/>')
    for path in paths:
        d = ' '.join(f'{"M" if i == 0 else "L"}{X(x):.1f},{Z(z):.1f}' for i, (x, z) in enumerate(path))
        out.append(f'<path d="{d}" fill="none" stroke="var(--road)" stroke-width="{max(2, 3.6 * sc):.1f}" stroke-linecap="round" stroke-linejoin="round"/>')
    for (x, z, r), (k, v) in zip(places, fl['places'].items()):
        out.append(f'<circle cx="{X(x):.1f}" cy="{Z(z):.1f}" r="{r * sc:.1f}" fill="var(--place)"/>')
    for k, (x, z, r) in enumerate(plains):
        out.append(f'<circle cx="{X(x):.1f}" cy="{Z(z):.1f}" r="{r * sc:.1f}" fill="var(--plain)" fill-opacity="0.35" stroke="var(--plain)" stroke-width="2" stroke-dasharray="6 4"/>')
        out.append(f'<text x="{X(x):.1f}" y="{Z(z) + 4:.1f}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">plain {k + 1}</text>')
    for (x, z) in packs:
        out.append(f'<circle cx="{X(x):.1f}" cy="{Z(z):.1f}" r="5" fill="var(--pack)" stroke="var(--card)" stroke-width="1.5"/>')
    cx, cz = places[0][0], places[0][1]
    out.append(f'<text x="{X(cx):.1f}" y="{Z(cz) + 20:.1f}" text-anchor="middle" font-size="12" fill="var(--ink)">camp</text>')
    out.append('</svg>')
    print('\n'.join(out))
    print(json.dumps({'floor': g['n'], 'across': round(2 * max(rim)), 'packs': len(packs), 'plains': [[round(x), round(z + RZ), round(r)] for x, z, r in plains]}), file=sys.stderr)


if __name__ == '__main__':
    main()
