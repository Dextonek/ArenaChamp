"""Reads the records of `online.py`: per match, how often the two screens had the same embers, how far apart they drew them,
how often the nest lay more than a metre apart, and where she rose on each screen."""
from srv import OUT
import json, math, sys
def parse(m): return [(t[0],) + tuple(float(v) for v in t[1:].split(',')) for t in m.split()] if m else []
tot = dict(paired=0, same=0, n=0, nd=0, rises=0, big=0)
for run in sys.argv[1:]:
    try:
        d = json.load(open(OUT / ('online-%s.json' % run))); sm = json.load(open(OUT / ('online-%s-samples.json' % run)))
    except Exception as e:
        print(run, 'missing', e); continue
    a = d['agree']
    A, K = sm['anka'], sm['kaia']; ki = 0; ds = []; nd = 0; n = 0; dists = []
    for s in A:
        if s['over']: continue
        while ki + 1 < len(K) and abs(K[ki + 1]['w'] - s['w']) <= abs(K[ki]['w'] - s['w']): ki += 1
        o = K[ki]
        if abs(o['w'] - s['w']) > 80 or o['round'] != s['round'] or o['over']: continue
        dists.append(math.hypot(s['x'] - s['kx'], s['z'] - s['kz']))
        P, Q = parse(s['marks']), parse(o['marks'])
        if len(P) != len(Q) or not P: continue
        n += 1
        ds.append(max(min(math.hypot(x - u, z - v) for _, u, v in Q) for _, x, z in P))
        na = [q for q in P if q[0] == 'n']; nb = [q for q in Q if q[0] == 'n']
        if na and nb and math.hypot(na[0][1] - nb[0][1], na[0][2] - nb[0][2]) > 1.0: nd += 1
    ds.sort(); dists.sort()
    big = sum(1 for v in ds if v > 1)
    print('run', run, 'ended', d['ended'], 'errors', d['errors'], d['anka']['errors'], d['kaia']['errors'], 'rounds', d['anka']['rounds'], 'quills', len([c for c in sm['casts']['anka'] if c['slot'] == 0]), 'paired', a['paired'], 'embersSame', a['embersSame'],
          '| apart median', round(dists[len(dists) // 2], 1), '| with embers', n, 'pos diff p90', round(ds[int(n * .9)], 2) if n else None, 'max', round(ds[-1], 2) if n else None, '>1m', big, 'nest>1m', nd,
          '| rises', [(r['round'], r['rosePos']) for r in d['risesOnHerScreen']], [(r['round'], r['rosePos']) for r in d['risesOnKaiasScreen']])
    tot['paired'] += a['paired']; tot['same'] += round(a['embersSame'] * a['paired']); tot['n'] += n; tot['nd'] += nd; tot['rises'] += len(d['risesOnHerScreen']); tot['big'] += big
print('TOTAL', tot, 'same share', round(tot['same'] / max(1, tot['paired']), 4))
