"""
Every automatic check of one hero, in one command (docs/pipeline/new-hero.md, gate 5; the hero framework, section 13).

    python pipeline/tools/hero-check.py Anka                      # all the checks (about 5 to 15 minutes)
    python pipeline/tools/hero-check.py "Big Yoko" --only icons,model,lore    # some of them (seconds)
    python pipeline/tools/hero-check.py Anka --skip online --fights 32

The checks, in order (`--only` / `--skip` take these names):
  prints   the hero's two fight prints against their reference (pipeline/tools/hero-prints.py check <Name>, and --foe Brannoc):
           the same fight as before a change that should not change play. A draft has no reference yet (it is taken at gate 6).
  sim      the simulator (pipeline/sim/sim.py hero <Name>, through the heavy lock pipeline/tools/heavy.py): 40-60% against the
           six benchmark heroes, no errors. A draft is fought with --drafts.
  online   two screens through the dev server's hub (pipeline/tools/hero-gate5/online_pair.py <Name> <partner>): both screens
           agree on both heroes' HP and places. The server knows a hero only from its shop row (HERO_SHOP, server/protocol.mjs),
           so a draft is not checked online until its release. The bots' throwaway accounts are removed afterwards.
  icons    its four VectorCraft icons (public/icons/spells/<stem>-q.svg ...) exist and are drawn at 32 px and 64 px, as a picture
           to look at (the game shows them at about 32 px).
  model    its model (public/models/heroes/<theme>_v4.glb): 300-600 KB, at most about 25,000 triangles, emissive at most 1.
  lore     the lore scripts' checks (pipeline/tools/lore-page.py --check, lore-codex.py --check) and what they say of this hero.

It writes pipeline/sim/out/check/<Name>.json (the hero workbench shows it) and <Name>.html (a short page), and prints a table.
Each tool it runs gets a free port of its own (no other agent's server is used) and a time limit of its own (at most 10
minutes; the simulator's includes the wait for the heavy lock). Exit 1 if a check fails.
Works in Windows PowerShell 5.1 (quote a name of two words).
"""
import argparse
import asyncio
import datetime
import html
import json
import os
import re
import socket
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'pipeline' / 'sim' / 'out' / 'check'
STEPS = ['prints', 'sim', 'online', 'icons', 'model', 'lore']
PY = sys.executable


def say(msg=''):
    print(str(msg).encode('ascii', 'replace').decode('ascii'), flush=True)


def free_port(start=5230, end=5299, taken=()):
    for p in range(start, end):
        if p in taken:
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
            except OSError:
                continue
        # also nothing answering on localhost (an IPv6 listener)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            if s.connect_ex(('localhost', p)) == 0:
                continue
        return p
    raise SystemExit('no free port in 5230-5299')


def run(cmd, timeout, env=None):
    """A tool, with a time limit; its output (both streams) and exit code."""
    t = time.time()
    try:
        r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout,
                           env={**os.environ, **(env or {})})
        return r.returncode, (r.stdout or '') + (r.stderr or ''), time.time() - t
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b'').decode('utf-8', 'replace') if isinstance(e.stdout, bytes) else (e.stdout or '')
        return None, out + f'\n(timed out after {timeout} s)', time.time() - t


def find_hero(name):
    """Its folder and card: theme, draft or not, icon stem(s), model path, the planned model."""
    for f in sorted((ROOT / 'src' / 'heroes').glob('*/hero.ts')):
        t = f.read_text(encoding='utf-8')
        if re.search(r"^\s*name: '" + re.escape(name.replace("'", "\\'")) + r"',", t, re.M):
            icons = re.search(r'^  icons: (.+),$', t, re.M)
            stems = re.findall(r"'([^']+)'", icons.group(1)) if icons else []
            model = re.search(r"^  model: '([^']+)',", t, re.M)
            planned = re.search(r"^  model: '([^']+)',", re.search(r'export const pointers[\s\S]*', t).group(0), re.M) if 'pointers' in t else None
            return {
                'theme': f.parent.name, 'card': f.relative_to(ROOT).as_posix(), 'draft': bool(re.search(r'^\s*draft: true,', t, re.M)),
                'stems': stems, 'model': model.group(1) if model else '',
                'build': planned.group(1) if planned else f'blender/heroes/real/{f.parent.name}.py',
            }
    return None


# --------------------------------------------------------------------------------------------------------------------------
# The checks: each returns {status: pass|fail|warn|skip, summary, details}


def check_prints(name, hero, args):
    if hero['draft']:
        return {'status': 'skip', 'summary': 'a draft has no reference print yet: taken at its release (gate 6, hero-prints.py take)'}
    port = free_port(taken=args.ports)
    args.ports.add(port)
    res = []
    for foe in ('', 'Brannoc'):
        cmd = [PY, 'pipeline/tools/hero-prints.py', 'check', name, '--port', str(port)] + (['--foe', foe] if foe else [])
        code, out, secs = run(cmd, 600)
        last = [ln for ln in out.splitlines() if ln.strip()][-3:]
        res.append({'foe': foe or 'Isolde', 'code': code, 'secs': round(secs), 'tail': last})
    ok = all(r['code'] == 0 for r in res)
    return {'status': 'pass' if ok else 'fail',
            'summary': ('the same fight against Isolde and Brannoc' if ok else
                        'ANOTHER FIGHT or no answer: ' + '; '.join(f"{r['foe']}: exit {r['code']}" for r in res if r['code'] != 0)),
            'details': res}


def check_sim(name, hero, args):
    port = free_port(taken=args.ports)
    args.ports.add(port)
    out_name = f"check-{re.sub(r'[^a-z0-9]+', '-', name.lower())}"
    cmd = [PY, 'pipeline/tools/heavy.py', 'run', '--', PY, 'pipeline/sim/sim.py', 'hero', name, '--port', str(port),
           '--fights', str(args.fights), '--out', out_name, '--max-minutes', '8'] + (['--drafts'] if hero['draft'] else [])
    code, out, secs = run(cmd, 600)
    last = ROOT / 'pipeline' / 'sim' / 'out' / 'last' / f'{name}.json'
    page = ROOT / 'pipeline' / 'sim' / 'out' / f'{out_name}.html'
    if code != 0 or not last.exists() or last.stat().st_mtime < time.time() - secs - 5:
        return {'status': 'fail', 'summary': f'the simulator did not finish (exit {code})', 'details': out.splitlines()[-12:]}
    d = json.loads(last.read_text(encoding='utf-8'))
    r = d['row']
    errs = d.get('errorCount', 0)
    inside = 40 <= r['pct'] <= 60
    status = 'fail' if errs else ('pass' if inside else 'warn')
    noisy = 'noisy' in out.lower() or 'waited' in out.lower()
    return {'status': status,
            'summary': f"{r['pct']}% +-{r['ci']} over {r['n']} fights (target 40-60%){', ' + str(errs) + ' errors' if errs else ''}, {r['none']} without a winner"
                       + (', the lock was busy (numbers may be noisy)' if noisy else ''),
            'details': {'row': r, 'foes': d.get('foes'), 'page': page.relative_to(ROOT).as_posix(), 'secs': round(secs)}}


def check_online(name, hero, args):
    if hero['draft']:
        return {'status': 'skip', 'summary': 'a draft: the server knows a hero only from its shop row (HERO_SHOP), added at its release'}
    partner = args.partner or ('Brannoc' if name == 'Isolde' else 'Isolde')
    port = free_port(taken=args.ports)
    args.ports.add(port)
    users = ROOT / 'server' / 'data' / 'accounts.json'
    before = set(json.loads(users.read_text(encoding='utf-8')).get('users', {})) if users.exists() else set()
    code, out, secs = run([PY, 'pipeline/tools/hero-gate5/online_pair.py', name, partner, str(args.online_seconds)], 600,
                          env={'GATE5_PORT': str(port)})
    removed = remove_bots(users, before)
    res = ROOT / 'pipeline' / 'sim' / 'out' / 'gate5' / f'pair-{name}-{partner}.json'
    d = json.loads(res.read_text(encoding='utf-8')) if res.exists() and res.stat().st_mtime >= time.time() - secs - 5 else None
    if code != 0 or not d:
        return {'status': 'fail', 'summary': f'no result (exit {code})', 'details': out.splitlines()[-12:]}
    ag = d['agree']
    errs = d.get('errors') or []
    a, b = ag.get('hpSameA'), ag.get('hpSameB')
    status = 'fail' if errs or a is None else ('pass' if min(a, b) >= 0.9 else 'warn')
    return {'status': status,
            'summary': f"{name} against {partner}: HP the same on both screens in {round(100 * (a or 0))}% and {round(100 * (b or 0))}% of "
                       f"{ag['paired']} moments, places {ag['placeApartA']['median']} m apart (median){', ' + str(len(errs)) + ' errors' if errs else ''}; "
                       f"{removed} bot accounts removed",
            'details': d}


def remove_bots(users, before):
    """The throwaway accounts the bots made (named v5bot..., not there before), out of the git-ignored server/data/."""
    if not users.exists():
        return 0
    d = json.loads(users.read_text(encoding='utf-8'))
    u = d.get('users', {})
    gone = [k for k in u if k not in before and k.lower().startswith('v5bot')]
    for k in gone:
        del u[k]
    if gone:
        users.write_text(json.dumps(d, indent=2), encoding='utf-8')
    return len(gone)


def check_icons(name, hero, args):
    stems = hero['stems'] or [re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')]
    files = [ROOT / 'public' / 'icons' / 'spells' / f'{s}-{k}.svg' for s in stems for k in 'qwer']
    have = [f for f in files if f.exists() and f.stat().st_size > 200]
    if not have:
        draw = ', '.join(f"pipeline/icons/vectorcraft/draw/{s.replace('-', '_')}.py" for s in stems)
        return {'status': 'skip' if hero['draft'] else 'fail',
                'summary': f'no icons made yet ({draw}; then make.py {stems[0]})'}
    shot = OUT / f'{name}-icons.png'
    try:
        asyncio.run(icon_sheet(have, shot))
    except Exception as e:  # the picture is a help, not the check
        shot = None
        say(f'  (the icon picture failed: {e})')
    missing = [f.name for f in files if f not in have]
    return {'status': 'fail' if missing and not hero['draft'] else 'pass',
            'summary': f"{len(have)} icons drawn at 32 and 64 px" + (f"; missing: {', '.join(missing)}" if missing else ''),
            'details': {'picture': shot.relative_to(ROOT).as_posix() if shot else None, 'files': [f.relative_to(ROOT).as_posix() for f in have]}}


async def icon_sheet(files, out):
    from playwright.async_api import async_playwright
    import base64
    cells = ''.join(
        f'<div><img src="data:image/svg+xml;base64,{base64.b64encode(f.read_bytes()).decode()}" width="32" height="32">'
        f'<img src="data:image/svg+xml;base64,{base64.b64encode(f.read_bytes()).decode()}" width="64" height="64"><span>{html.escape(f.stem)}</span></div>'
        for f in files)
    page_html = ('<html><body style="margin:0;background:#14161c;font:12px sans-serif;color:#aab">'
                 '<div style="display:flex;flex-wrap:wrap;gap:14px;padding:12px">' + cells.replace('<div>', '<div style="display:flex;gap:8px;align-items:center">')
                 + '</div></body></html>')
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome", headless=True)
        p = await b.new_page(viewport={'width': 760, 'height': 120 + 40 * (len(files) // 4)})
        await p.set_content(page_html)
        await p.wait_for_timeout(300)
        el = await p.query_selector('div')
        await el.screenshot(path=str(out))
        await b.close()


def glb_stats(path):
    """Size, triangles (indexed or not, triangle modes only) and the brightest emissive of a .glb."""
    data = path.read_bytes()
    magic, _ver, _len = struct.unpack_from('<4sII', data, 0)
    if magic != b'glTF':
        raise ValueError('not a .glb')
    jlen, jtype = struct.unpack_from('<I4s', data, 12)
    gl = json.loads(data[20:20 + jlen])
    acc = gl.get('accessors', [])
    tris = 0
    for mesh in gl.get('meshes', []):
        for prim in mesh.get('primitives', []):
            mode = prim.get('mode', 4)
            n = acc[prim['indices']]['count'] if 'indices' in prim else acc[prim['attributes']['POSITION']]['count']
            tris += n // 3 if mode == 4 else (max(0, n - 2) if mode in (5, 6) else 0)
    emit = 0.0
    for m in gl.get('materials', []):
        f = max(m.get('emissiveFactor', [0, 0, 0]))
        s = m.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 1.0)
        emit = max(emit, f * s)
    return {'kb': round(len(data) / 1024), 'triangles': tris, 'emissive': round(emit, 3), 'meshes': len(gl.get('meshes', []))}


def check_model(name, hero, args):
    target = ROOT / 'public' / 'models' / 'heroes' / f"{hero['theme']}_v4.glb"
    if not target.exists():
        cur = hero['model']
        return {'status': 'skip' if hero['draft'] else 'fail',
                'summary': f"no model yet ({target.relative_to(ROOT).as_posix()} from {hero['build']}; the card stands in with {cur})"}
    s = glb_stats(target)
    bad = []
    if not 300 <= s['kb'] <= 600:
        bad.append(f"{s['kb']} KB (300-600)")
    # rule 9: it costs no more to draw than the heroes beside it (the other heroes' models, measured the same way)
    others = sorted(glb_stats(f)['triangles'] for f in (ROOT / 'public' / 'models' / 'heroes').glob('*_v4.glb') if f != target)
    most = others[-1] if others else 0
    median = others[len(others) // 2] if others else 0
    s['rosterMedian'], s['rosterMost'] = median, most
    if others and s['triangles'] > most:
        bad.append(f"{s['triangles']:,} triangles, more than any other hero (the most: {most:,})")
    if s['emissive'] > 1.0001:
        bad.append(f"emissive {s['emissive']} (at most 1)")
    return {'status': 'warn' if bad else 'pass',
            'summary': f"{target.relative_to(ROOT).as_posix()}: {s['kb']} KB, {s['triangles']:,} triangles (the other heroes: median "
                       f"{median:,}, most {most:,}), emissive {s['emissive']}" + (f" -- outside: {'; '.join(bad)}" if bad else ''),
            'details': s}


def check_lore(name, hero, args):
    lines, fails = [], []
    for tool in ('lore-page.py', 'lore-codex.py'):
        code, out, _ = run([PY, f'pipeline/tools/{tool}', '--check'], 300)
        mine = [ln.strip(' -') for ln in out.splitlines() if name in ln or f"heroes/{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}.md" in ln]
        lines += [f'{tool}: {ln}' for ln in mine]
        if code != 0:
            fails.append(tool)
    lore = (ROOT / 'docs' / 'lore' / 'LORE.md').read_text(encoding='utf-8')
    head = re.search(r'^### ' + re.escape(name) + r' \|[^\n]*\| (\S+)\s*$', lore, re.M)
    if not head:
        return {'status': 'fail', 'summary': 'no entry in docs/lore/LORE.md (rule 0: the lore first)', 'details': lines}
    status = head.group(1)
    if fails:
        return {'status': 'fail', 'summary': f"{', '.join(fails)} failed" + (f': {lines[0]}' if lines else ''), 'details': lines}
    if lines:
        return {'status': 'warn' if hero['draft'] else 'fail', 'summary': f'{len(lines)} still to write (status {status}): {lines[0]}', 'details': lines}
    return {'status': 'pass', 'summary': f'LORE.md and the codex check out (status {status})', 'details': lines}


CHECKS = {'prints': check_prints, 'sim': check_sim, 'online': check_online, 'icons': check_icons, 'model': check_model, 'lore': check_lore}
NAMES = {'prints': 'fight prints', 'sim': 'simulator', 'online': 'online, two screens', 'icons': 'icons at 32 px', 'model': 'model',
         'lore': 'lore'}


def page(name, hero, result):
    rows = ''.join(
        f"<tr><td>{html.escape(NAMES[s['key']])}</td><td class='{s['status']}'>{s['status']}</td><td>{html.escape(s['summary'])}</td></tr>"
        for s in result['steps'])
    pic = next((s['details'].get('picture') for s in result['steps'] if s['key'] == 'icons' and isinstance(s.get('details'), dict)), None)
    img = f"<h2>Icons at 32 and 64 px</h2><img src='{html.escape(Path(pic).name)}' style='max-width:100%'>" if pic else ''
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(name)}: checks</title><style>
body{{margin:0;padding:16px;background:#0f1117;color:#dfe4ee;font:15px/1.45 system-ui,sans-serif}} h1{{font-size:20px;margin:0 0 4px}}
.sub{{color:#8b93a7;margin-bottom:12px}} table{{border-collapse:collapse;width:100%;max-width:900px}} td{{padding:8px;border-bottom:1px solid #232a38;vertical-align:top}}
td:first-child{{white-space:nowrap;color:#aab3c5}} .pass{{color:#9be86b}} .fail{{color:#ff8a7a}} .warn{{color:#ffd25e}} .skip{{color:#79819a}}
code{{background:#171c27;padding:1px 5px;border-radius:4px}} h2{{font-size:15px;margin:18px 0 6px}}
</style></head><body><h1>{html.escape(name)}{' <small style="color:#ffd98a">(draft)</small>' if hero['draft'] else ''}</h1>
<div class="sub">{html.escape(result['date'])} · <code>{html.escape(result['command'])}</code> · {result['seconds']} s</div>
<table>{rows}</table>{img}</body></html>"""


def main():
    ap = argparse.ArgumentParser(description='Every automatic check of one hero, in one command.')
    ap.add_argument('name')
    ap.add_argument('--only', default='', help='comma separated: ' + ','.join(STEPS))
    ap.add_argument('--skip', default='')
    ap.add_argument('--fights', type=int, default=16, help='the simulator: fights per benchmark foe (16 -> 96)')
    ap.add_argument('--partner', default='', help='the online check: the other hero (default Isolde, or Brannoc for Isolde)')
    ap.add_argument('--online-seconds', type=int, default=150)
    args = ap.parse_args()
    args.ports = set()
    name = args.name.strip()
    hero = find_hero(name)
    if not hero:
        raise SystemExit(f'No hero folder has the card of {name} (src/heroes/*/hero.ts).')
    only = [s for s in args.only.split(',') if s] or STEPS
    skip = set(s for s in args.skip.split(',') if s)
    bad = [s for s in [*only, *skip] if s not in STEPS]
    if bad:
        raise SystemExit(f"unknown check {bad}: {', '.join(STEPS)}")
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    say(f"{name}: src/heroes/{hero['theme']}/{' (a draft)' if hero['draft'] else ''}")
    steps = []
    for key in STEPS:
        if key not in only or key in skip:
            continue
        say(f'  {NAMES[key]} ...')
        t = time.time()
        try:
            r = CHECKS[key](name, hero, args)
        except Exception as e:
            r = {'status': 'fail', 'summary': f'the check itself failed: {e}'}
        r['key'] = key
        r['secs'] = round(time.time() - t)
        steps.append(r)
        say(f"  {NAMES[key]:<20} {r['status'].upper():<5} {r['summary']}")
    result = {'name': name, 'hero': hero, 'date': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
              'command': 'python pipeline/tools/hero-check.py ' + ' '.join(f'"{a}"' if ' ' in a else a for a in sys.argv[1:]),
              'seconds': round(time.time() - t0), 'steps': steps}
    (OUT / f'{name}.json').write_text(json.dumps(result, indent=1), encoding='utf-8')
    (OUT / f'{name}.html').write_text(page(name, hero, result), encoding='utf-8')
    say()
    say(f"{sum(s['status'] == 'pass' for s in steps)} pass, {sum(s['status'] == 'warn' for s in steps)} to look at, "
        f"{sum(s['status'] == 'fail' for s in steps)} fail, {sum(s['status'] == 'skip' for s in steps)} not yet; {result['seconds']} s")
    say(f"page: pipeline/sim/out/check/{name}.html")
    if any(s['status'] == 'fail' for s in steps):
        sys.exit(1)


if __name__ == '__main__':
    main()
