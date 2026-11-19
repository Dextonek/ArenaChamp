"""
The spell rules sheet and its answer check (docs/knowledge/moba-spell-mechanics.md, changes 1 and 2).

    python pipeline/tools/spell-rules.py            # build src/heroes/rules.ts and the check page
    python pipeline/tools/spell-rules.py --check    # only print the check (exit 1 if a spell fails the agreed reading)

Inputs:
- pipeline/tools/out/spell-measure.json: every hero spell's danger zones as the engine draws them, measured in the tool page by
  pipeline/tools/spell-rules-measure.js (re-run it after changing a spell);
- docs/knowledge/moba-research/our-spells-inventory.md: each spell's written answer (its "Counterplay" column) and parts;
- pipeline/designs/spell-rules-overrides.json: hand corrections per spell label (any field), which win.

Outputs:
- src/heroes/rules.ts (generated; do not edit by hand): one record per spell label, read by the tooltips;
- docs/heroes/spell-rules-check.html and docs/heroes/spell-rules.md: the sheet and the check, per hero.

The check (rule 4 of docs/pipeline/new-hero.md): a hero walks 4 m/s and reacts in 0.25 s, so a zone that must be walked out of
warns for at least 0.25 + d / 4 seconds, d being the walk. It is computed with two readings of d, because the rule's text
says "radius":
- radius reading: d is the circle's radius (a victim at its middle);
- walk reading: for a zone round the caster, d is the radius minus the caster's own attack reach (the victim stands where
  the caster could already hit it); for a zone cast at a spot, the radius as before.
Lines: d is half the width. Bolts also: the bolt reaches 6 m no sooner than 0.5 s after the cast.
"""
import argparse
import html
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MEASURE = ROOT / 'pipeline/tools/out/spell-measure.json'
INVENTORY = ROOT / 'docs/knowledge/moba-research/our-spells-inventory.md'
OVERRIDES = ROOT / 'pipeline/designs/spell-rules-overrides.json'
OUT_TS = ROOT / 'src/heroes/rules.ts'
OUT_HTML = ROOT / 'docs/heroes/spell-rules-check.html'
OUT_MD = ROOT / 'docs/heroes/spell-rules.md'
WALK, REACT = 4.0, 0.25
NA = {'sure': 'a sure hit or a mark: its answer is sight, not a step', 'placement': 'it only places something; nothing is hit when it lands',
      'spacing': 'a quick melee swing: the answer is to stand out of reach before it', 'lingering': 'it hurts while you stand in it; there is no landing'}


def inventory():
    """{(hero, key or spell name): {mechanic, parts, counterplay, input}} from the inventory's per-hero tables."""
    rows, hero = {}, None
    text = INVENTORY.read_text(encoding='utf-8')
    sec = text[text.index('## 1. Every hero spell'):text.index('## 2. Every tool spell')]
    for line in sec.splitlines():
        m = re.match(r'^\*\*(.+?)\*\* \(`src/', line)
        if m:
            hero = m.group(1)
            continue
        if hero and line.startswith('|') and not line.startswith('|---') and not line.startswith('| Slot'):
            c = [x.strip() for x in line.strip('|').split('|')]
            if len(c) < 10:
                continue
            # a CC cell like "push|pull" splits into more cells: the counterplay is always second to last
            rec = {'key': c[0], 'spell': c[1], 'input': c[2], 'mechanic': c[3], 'parts': c[4], 'cc': ', '.join(c[5:-4]), 'counterplay': c[-2]}
            if rec['counterplay'] == '-':
                rec['counterplay'] = ''
            rows[(hero, c[1].lower())] = rec
            rows.setdefault((hero, c[0]), rec)
    return rows


def need(d):
    return REACT + max(0.0, d) / WALK


def judge(spell):
    """The sheet's fields and the check for one measured spell."""
    zones = spell['zones']
    reach = spell['reach'] or 2.2
    checks = []
    for z in zones:
        warn = round(z['impact'] - max(0.0, z['start']), 2)
        if z['kind'] in ('circle', 'ring'):
            r = z.get('radius', z.get('outer', 0))
            on = z.get('onCaster', False)
            d_rad = r
            d_walk = r - reach if on else r
            what = f"{'ring' if z['kind'] == 'ring' else 'circle'} {r:g} m{' round the caster' if on else ''}"
        elif z['kind'] == 'cone':
            half = math.radians(min(z['angle'], 180) / 2)
            d_rad = min(z['radius'], z['radius'] * math.sin(half)) if z['angle'] < 180 else z['radius']
            d_walk = min(max(0.0, z['radius'] - reach), reach * math.sin(half)) if z['angle'] < 180 else max(0.0, z['radius'] - reach)
            what = f"cone {z['radius']:g} m, {z['angle']:g} deg"
        else:
            d_rad = d_walk = z['width'] / 2
            what = f"line {z['length']:g} m by {z['width']:g} m"
            if z.get('until') is not None and z['until'] > z['impact'] + 0.01:
                # A front that travels (a bolt, a dash down a lane): a victim 6 m out has until the front gets there, and the
                # project's bolt rule says that is no sooner than 0.5 s after the cast. Judged at 6 m (or the end if shorter).
                speed = z['length'] / (z['until'] - z['impact'])
                x = min(6.0, z['length'])
                t = z['impact'] + x / speed
                c = {'what': what + f", travels {speed:.0f} m/s", 'warn': round(t - max(0.0, z['start']), 2),
                     'need_radius': round(need(d_rad), 2), 'need_walk': round(need(d_walk), 2), 'bolt_6m': round(t, 2), 'at': x}
                c['ok_radius'] = c['warn'] + 1e-6 >= c['need_radius']
                c['ok_walk'] = c['warn'] + 1e-6 >= c['need_walk']
                c['ok_bolt'] = x < 6 or t + 1e-6 >= 0.5
                c['margin'] = round(c['warn'] - c['need_walk'], 2)
                checks.append(c)
                continue
        if warn <= 0.001 and z['kind'] != 'line':
            continue  # a zone that lands as it shows (a lingering ground, a buff ring): no walk-out answer to check
        c = {'what': what, 'warn': warn, 'need_radius': round(need(d_rad), 2), 'need_walk': round(need(d_walk), 2)}
        c['ok_radius'] = warn + 1e-6 >= c['need_radius']
        c['ok_walk'] = warn + 1e-6 >= c['need_walk']
        c['margin'] = round(warn - c['need_walk'], 2)
        checks.append(c)
    return checks


def fields(spell, inv):
    """stops / cover / dodge / windup / answer for the sheet."""
    zones = spell['zones']
    parts = (inv or {}).get('parts', '')
    mech = (inv or {}).get('mechanic', '')
    first = min(zones, key=lambda z: z['impact']) if zones else None
    windup = round(first['impact'], 2) if first else None
    if first and first['kind'] == 'line':
        bolt = first.get('until') is not None and not spell['overCover'] and 'pierce' not in parts and 'dash' not in mech
        stops = 'first' if bolt else 'pierce'
        cover = 'stops' if (spell['aim'] in ('line', 'arc') and not spell['overCover']) else 'ignores'
        dodge = 'step out'
    elif first:
        stops, cover, dodge = 'area', 'ignores', 'step out'
    elif spell['mode'] == 'enemy' or spell['mode'] == 'enemies':
        stops, cover = 'sure', 'sight'
        dodge = 'break sight' if 'sight' in (inv or {}).get('counterplay', '') else 'none'
    elif 'summon' in spell['flags']:
        stops, cover, dodge = 'unit', 'ignores', 'kill it'
    else:
        stops, cover, dodge = 'self', 'ignores', 'none'
    return {'stops': stops, 'cover': cover, 'dodge': dodge, 'windup': windup, 'answer': (inv or {}).get('counterplay', '')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--reading', choices=['radius', 'walk'], default='walk', help='the agreed reading for the exit code')
    a = ap.parse_args()
    data = json.loads(MEASURE.read_text(encoding='utf-8'))
    inv = inventory()
    over = json.loads(OVERRIDES.read_text(encoding='utf-8')) if OVERRIDES.exists() else {}
    rows = []
    for s in data['spells']:
        i = inv.get((s['hero'], s['name'].lower())) or inv.get((s['hero'], s['key']))
        f = fields(s, i)
        ov = over.get(s['label'], {})
        f.update({k: v for k, v in ov.items() if k != 'check'})
        checks = judge(s)
        for c in checks:
            if ov.get('check'):
                c['na'] = ov['check']
        rows.append({'spell': s, 'f': f, 'checks': checks})
    fails = [(r, c) for r in rows for c in r['checks'] if not c.get('na') and (not c[f'ok_{a.reading}'] or c.get('ok_bolt') is False)]
    for r, c in fails:
        s = r['spell']
        print(f"FAIL ({a.reading}) {s['hero']} {s['key']} {s['name']}: {c['what']} warns {c['warn']} s, needs {c[f'need_{a.reading}']} s"
              + (f"; bolt at 6 m after {c['bolt_6m']} s" if c.get('ok_bolt') is False else ''))
    if a.check:
        sys.exit(1 if fails else 0)

    # src/heroes/rules.ts
    out = ['/**',
           ' * Every hero spell\'s resolution rules, one record per spell label: what it stops on, what cover does, how to answer it,',
           ' * when it lands and the written answer. GENERATED by pipeline/tools/spell-rules.py from the engine\'s own danger zones',
           ' * (pipeline/tools/spell-rules-measure.js), the spells inventory and the hand corrections in',
           ' * pipeline/designs/spell-rules-overrides.json. Do not edit by hand: change the overrides and run the script.',
           ' * Why: docs/knowledge/moba-spell-mechanics.md, change 1.',
           ' */',
           "export type Stops = 'first' | 'pierce' | 'area' | 'sure' | 'unit' | 'self';",
           "export type Cover = 'stops' | 'sight' | 'ignores';",
           'export interface SpellRules {',
           '  /** What the hit lands on: the first in its path, everyone along it, everyone in the area, the chosen enemy, a unit it makes, or the caster. */',
           '  stops: Stops;',
           '  /** Cover stops it, it needs sight of the target, or it ignores cover. */',
           '  cover: Cover;',
           '  /** The answer in one or two words. */',
           '  dodge: string;',
           '  /** Seconds from the cast to the first hit (null: no zone to time). */',
           '  windup: number | null;',
           '  /** The written answer, in a sentence. */',
           '  answer: string;',
           '}',
           '',
           'export const SPELL_RULES: Record<string, SpellRules> = {']
    for r in rows:
        f = r['f']
        out.append(f"  {json.dumps(r['spell']['label'])}: {{ stops: {json.dumps(f['stops'])}, cover: {json.dumps(f['cover'])}, dodge: {json.dumps(f['dodge'])}, "
                   f"windup: {json.dumps(f['windup'])}, answer: {json.dumps(f['answer'])} }},")
    out += ['};', '',
            "const STOPS: Record<Stops, string> = { first: 'hits the first in its path', pierce: 'hits all along its path', area: 'hits all in the area', sure: 'lands on the chosen enemy', unit: 'makes a unit', self: 'on himself' };",
            "const COVER: Record<Cover, string> = { stops: 'stopped by cover', sight: 'needs sight', ignores: 'ignores cover' };",
            '',
            '/** One short line for a tooltip: "hits all in the area, ignores cover, lands after 0.8 s. Answer: step out." */',
            'export function rulesLine(label: string): string {',
            '  const r = SPELL_RULES[label];',
            "  if (!r) return '';",
            "  const verb = r.stops === 'first' || r.stops === 'pierce' ? 'sets off' : 'lands';",
            "  const when = r.windup !== null && r.windup > 0.05 ? `, ${verb} after ${r.windup} s` : '';",
            "  const answer = r.answer ? ` Answer: ${r.answer}.` : r.dodge !== 'none' ? ` Answer: ${r.dodge}.` : '';",
            "  return `${STOPS[r.stops]}, ${COVER[r.cover]}${when}.${answer}`;",
            '}', '']
    OUT_TS.write_text('\n'.join(out), encoding='utf-8', newline='\n')

    # the sheet and the check, as a page and as markdown
    def cell_checks(r):
        bits = []
        for c in r['checks']:
            if c.get('na'):
                bits.append(f"{c['what']}: warns {c['warn']} s; not judged ({NA[c['na']]})")
                continue
            ok_r, ok_w = c['ok_radius'], c['ok_walk']
            mark = 'pass' if ok_r and ok_w else ('walk only' if ok_w else 'FAIL')
            b = f"{c['what']}: warns {c['warn']} s, needs {c['need_radius']} (radius) / {c['need_walk']} (walk) = {mark}"
            if 'bolt_6m' in c:
                b += f"; 6 m at {c['bolt_6m']} s" + ('' if c['ok_bolt'] else ' FAIL')
            bits.append(b)
        return bits or ['no zone to walk out of']

    md = ['---', 'title: Spell rules sheet', 'tags: [heroes, spells, rules, counterplay]', 'updated: 2026-11-19',
          'status: generated by pipeline/tools/spell-rules.py; do not edit by hand', '---', '',
          '# Spell rules sheet', '',
          'Every hero spell\'s resolution rules and its answer, checked with arithmetic (docs/knowledge/moba-spell-mechanics.md, changes 1 '
          'and 2). Zones and times are the engine\'s own, measured in the tool page. "needs" is `0.25 + d / 4` s: with d the radius '
          '(radius reading) or, for a zone round the caster, the radius minus his attack reach (walk reading).', '']
    hero = None
    n_fail_r = sum(1 for r in rows for c in r['checks'] if not c.get('na') and not c['ok_radius'])
    n_fail_w = sum(1 for r in rows for c in r['checks'] if not c.get('na') and not c['ok_walk'])
    n_fail_b = sum(1 for r in rows for c in r['checks'] if not c.get('na') and c.get('ok_bolt') is False)
    n_na = sum(1 for r in rows for c in r['checks'] if c.get('na'))
    md.append(f'**{len(rows)} spells.** Zones failing the radius reading: {n_fail_r}; the walk reading: {n_fail_w}; bolts too fast: {n_fail_b}.')
    md.append('')
    for r in rows:
        s, f = r['spell'], r['f']
        if s['hero'] != hero:
            hero = s['hero']
            md += ['', f'## {hero}', '', '| Key | Spell | Stops | Cover | Lands after | Answer | Check |', '|---|---|---|---|---|---|---|']
        md.append(f"| {s['key']} | {s['name']} | {f['stops']} | {f['cover']} | {f['windup'] if f['windup'] is not None else '-'} | "
                  f"{f['answer'] or f['dodge']} | {'<br>'.join(cell_checks(r))} |")
    OUT_MD.write_text('\n'.join(md) + '\n', encoding='utf-8', newline='\n')

    trs, hero = [], None
    for r in rows:
        s, f = r['spell'], r['f']
        if s['hero'] != hero:
            hero = s['hero']
            trs.append(f'<tr class="h"><td colspan="6">{html.escape(hero)}</td></tr>')
        bad = any(not c.get('na') and (not c['ok_radius'] or not c['ok_walk'] or c.get('ok_bolt') is False) for c in r['checks'])
        cls = ' class="bad"' if bad else ''
        trs.append(f"<tr{cls}><td>{s['key']}</td><td><b>{html.escape(s['name'])}</b></td><td>{f['stops']}<br><span>{f['cover']}</span></td>"
                   f"<td>{f['windup'] if f['windup'] is not None else '-'}</td><td>{html.escape(f['answer'] or f['dodge'])}</td>"
                   f"<td>{'<br>'.join(html.escape(b) for b in cell_checks(r))}</td></tr>")
    fail_list = ''.join(
        f"<li><b>{html.escape(r['spell']['hero'])} {r['spell']['key']} {html.escape(r['spell']['name'])}</b>: {html.escape(c['what'])}, warns {c['warn']} s; "
        f"needs {c['need_radius']} s by the radius, {c['need_walk']} s by the walk"
        + (f"; reaches 6 m at {c['bolt_6m']} s" if c.get('ok_bolt') is False else '')
        + (' <span>(walk reading: within 0.04 s, the time the zone takes to appear)</span>' if not c['ok_walk'] and c['margin'] >= -0.045 else '')
        + ('' if c['ok_walk'] else '' ) + ('' if not c['ok_walk'] else ' <span>(passes the walk reading)</span>') + '</li>'
        for r in rows for c in r['checks'] if not c.get('na') and (not c['ok_radius'] or not c['ok_walk'] or c.get('ok_bolt') is False))
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spell rules check</title><style>
:root {{ --bg:#0f0e13; --panel:#19171f; --line:#2f2b39; --ink:#ece6da; --ink2:#a9a1b3; --gold:#e0b45a; --bad:#ff8a6a; }}
html {{ background:var(--bg); }} body {{ margin:0 auto; max-width:1100px; padding:18px 16px 40px; color:var(--ink); font:14px/1.45 system-ui,sans-serif; }}
h1 {{ font:700 26px Georgia,serif; color:var(--gold); margin:4px 0; }} h2 {{ font:700 18px Georgia,serif; color:var(--gold); margin:22px 0 6px; }}
.sub,span {{ color:var(--ink2); }} table {{ width:100%; border-collapse:collapse; }} td {{ border-top:1px solid var(--line); padding:6px; vertical-align:top; }}
tr.h td {{ color:var(--gold); font:700 16px Georgia,serif; padding-top:16px; }} tr.bad td:last-child {{ color:var(--bad); }}
.box {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin:10px 0; }} li {{ margin:4px 0; }}
@media (max-width:700px) {{ table, tbody, tr, td {{ display:block; }} td {{ border:0; padding:2px 6px; }} tr {{ border-top:1px solid var(--line); padding:6px 0; }} }}
</style></head><body>
<h1>Spell rules check</h1>
<p class="sub">All {len(rows)} hero spells: what each hit stops on, what cover does, when it lands and its answer, with the engine's own danger zones measured in the tool page and checked against the rule "a hero walks 4 m/s and reacts in 0.25 s, so a zone warns at least 0.25 + d / 4 s".</p>
<div class="box">{n_na} zones are not judged by this rule, each with its reason (sure hits, placements, quick melee swings, lingering fields). <b>Two readings of d.</b> By the <b>radius</b> (a victim in the middle): {n_fail_r} zones fail. By the <b>walk</b> (for a zone round the caster, the radius minus his attack reach, where the victim already stands in a fight): {n_fail_w} fail. Bolts too fast (6 m sooner than 0.5 s): {n_fail_b}.</div>
<h2>Zones that fail a reading</h2><ul>{fail_list or '<li>none</li>'}</ul>
<h2>Every spell</h2><table>{''.join(trs)}</table></body></html>'''
    OUT_HTML.write_text(page, encoding='utf-8', newline='\n')
    print(f'{len(rows)} spells; fails: radius {n_fail_r}, walk {n_fail_w}, bolts {n_fail_b}')
    print(f'wrote {OUT_TS.relative_to(ROOT)}, {OUT_MD.relative_to(ROOT)}, {OUT_HTML.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
