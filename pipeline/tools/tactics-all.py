"""The packs' tactics (src/tower/world/tactics.ts) over many floors: the tactics probe (tactics-probe.py: every pack woken and fought by a
hero standing still, tactics on and off) on each floor, plus each kind's role and which of its specials fired. Writes one JSON line a
floor to <out> and prints the faults:

- page errors; a zone left on the ground (`left` > 0);
- a pack that takes far more with tactics (on > 1.5 x off and on > 0.3 of the hero's health);
- kinds with no role (they fight as before), and kinds with a role whose special never fired on any floor.

    python pipeline/tools/tactics-all.py <port> <first>-<last> <out.jsonl> [hero] [seconds]
    python pipeline/tools/tactics-all.py --sum <out.jsonl> [more.jsonl ...]    (the summary over files already written)
"""
import asyncio, json, sys

JS = """async ([n, hero, secs, off]) => {
  globalThis.__noTactics = off;
  const T = await import('/src/tower/world/tactics.ts');
  if (n !== 1) await _worldGen(n);
  await _world({ floor: n, hero, mode: 'play', persist: false });
  const g = _world.game(), z = g.zone, arena = vfx.arena, out = [];
  const zonesLeft = () => arena.group.children.filter((c) => c.name === 'tactics-zone').length;
  const max = vfx.duel.heroMax ?? vfx.duel.heroHp;
  // Who took it: every blow on the hero by the move's name (a pack's kind's name), so a neighbour drawn in is told apart.
  let byMove = {};
  const hurt0 = vfx.duel.hurtHero.bind(vfx.duel);
  vfx.duel.hurtHero = (o) => { const was = vfx.duel.heroHp, r = hurt0(o), d = was - vfx.duel.heroHp; if (d > 0) byMove[String(o?.move)] = (byMove[String(o?.move)] ?? 0) + d; return r; };
  const kinds = {};
  for (const pk of [...z.packs.values()]) for (const s of pk.slots) {
    const sp = s.spec;
    kinds[sp.id] = { look: sp.look, melee: sp.melee, name: sp.name, role: T.roleOf(sp) };
  }
  const all = [...z.packs.values()];
  for (const pk of all) {
    if (pk.state === 'cleared') continue;
    // Alone: every other pack is put away while this one is fought (else the six-unit cap leaves it no room, or a neighbour joins).
    for (const o of all) if (o !== pk) { if (o.state !== 'cleared' && o.state !== 'unborn') o.hide(); o.offWas ??= o.off; o.off = true; }
    const h = pk.home;
    _world.go(h.x + 6, h.z);
    _world.step(1);
    if (pk.state === 'unborn') pk.spawn(true);
    if (pk.state !== 'awake') pk.wake('probe');
    vfx.duel.heroHp = max;
    byMove = {};
    const at = arena.caster.group.position, stand = { x: at.x, z: at.z };
    let lost = 0, was = vfx.duel.heroHp, maxZones = 0;
    for (let s = 0; s < secs * 10; s++) {
      _world.go(stand.x, stand.z);
      _world.step(0.1);
      const hp = vfx.duel.heroHp;
      if (hp < was) lost += was - hp;
      if (hp <= max * 0.2) vfx.duel.heroHp = max;
      was = vfx.duel.heroHp;
      maxZones = Math.max(maxZones, zonesLeft());
    }
    const ks = pk.slots.map((s) => s.spec.id), own = new Set(pk.slots.map((s) => s.spec.name));
    let mine = 0, others = 0;
    for (const [k, v] of Object.entries(byMove)) if (own.has(k)) mine += v; else others += v;
    const stats = { ...pk.mind.stats }, byKind = JSON.parse(JSON.stringify(pk.mind.byKind ?? {}));
    pk.off = true; pk.dispose(); pk.offWas = true;
    for (const o of all) if (o !== pk) o.off = o.offWas;
    _world.step(0.2);
    out.push({ id: pk.id, kinds: [...new Set(ks)], n: ks.length, took: +(lost / max).toFixed(3), own: +(mine / max).toFixed(3), others: +(others / max).toFixed(3), stats, byKind, maxZones, left: zonesLeft() });
  }
  // Every kind the floor has (waves, storms and set pieces' too), with its role.
  const every = {};
  for (const [id, sp] of Object.entries(g.floor.enemies ?? {})) every[id] = { look: sp.look, melee: sp.melee, name: sp.name, role: T.roleOf(sp) };
  return JSON.stringify({ kinds, all: every, packs: out, zonesLive: T.Zones.live, endLeft: zonesLeft() });
}"""

EXPECT = {'brute': ['slam'], 'charger': ['charge'], 'hunter': ['lunge'], 'pouncer': ['pounce'], 'warden': ['slam', 'charge'], 'caster': ['fan']}


async def run(port, floors, out, hero, secs):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', headless=True, args=['--mute-audio', '--ignore-gpu-blocklist'])
        for n in floors:
            row = {'floor': n, 'hero': hero, 'errors': {}}
            for off in (False, True):
                key = 'off' if off else 'on'
                pg = await b.new_page(viewport={'width': 960, 'height': 540})
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
                try:
                    await pg.goto(f'http://localhost:{port}/', wait_until='load', timeout=180000)
                    await pg.wait_for_function('!!window.vfx && !!window.vfx.duel', timeout=180000)
                    await pg.evaluate("async () => { eval(await (await fetch('/pipeline/tools/world-tool.js')).text()); }")
                    row[key] = json.loads(await pg.evaluate(JS, [n, hero, secs, off]))
                except Exception as e:  # noqa: BLE001
                    errs.append('probe: ' + str(e)[:300])
                if errs:
                    row['errors'][key] = errs[:5]
                await pg.close()
            with open(out, 'a', encoding='utf-8') as f:
                f.write(json.dumps(row) + '\n')
            on = sum(p['took'] for p in row.get('on', {}).get('packs', []))
            of = sum(p['took'] for p in row.get('off', {}).get('packs', []))
            print(f'floor {n}: took on {on:.2f} off {of:.2f}, errors {row["errors"] or "none"}', flush=True)
        await b.close()


def summary(files):
    rows = [json.loads(l) for f in files for l in open(f, encoding='utf-8') if l.strip()]
    rows.sort(key=lambda r: r['floor'])
    kinds, fired, seen, allk = {}, {}, {}, {}
    print(f"{'floor':>5} {'took on':>8} {'off':>6}  faults")
    for r in rows:
        faults = []
        if r['errors']:
            faults.append(f"errors {r['errors']}")
        on, off = r.get('on'), r.get('off')
        if not on or not off:
            print(f"{r['floor']:>5}  (no result)  {faults}")
            continue
        if on.get('zonesLive'):
            faults.append(f"Zones.live {on['zonesLive']} at the end")
        if on.get('endLeft'):
            faults.append(f"{on['endLeft']} zone(s) on the ground at the end")
        for k, v in on.get('all', {}).items():
            allk.setdefault(k, {**v, 'floors': set()})['floors'].add(r['floor'])
        offp = {p['id']: p for p in off['packs']}
        for p in on['packs']:
            o = offp.get(p['id'])
            key = 'own' if 'own' in p else 'took'
            if o and p[key] > 0.3 and p[key] > 1.5 * o[key]:
                faults.append(f"{p['id']} ({','.join(sorted(set(p['kinds'])))}): {key} {p[key]} on vs {o[key]} off")
            for k in set(p['kinds']):
                seen.setdefault(k, set()).add(r['floor'])
                for what, c in p['byKind'].get(k, {}).items():
                    fired.setdefault(k, {}).setdefault(what, 0)
                    fired[k][what] += c
        for k, v in on['kinds'].items():
            kinds.setdefault(k, v)
        ton = sum(p['took'] for p in on['packs']); toff = sum(p['took'] for p in off['packs'])
        print(f"{r['floor']:>5} {ton:>8.2f} {toff:>6.2f}  {'; '.join(faults) or '-'}")
    print('\nkinds (id, look, melee, role, floors, specials fired):')
    for k in sorted(kinds, key=lambda k: (str(kinds[k]['role']), k)):
        v = kinds[k]
        fl = sorted(seen.get(k, []))
        span = f'{fl[0]}-{fl[-1]} ({len(fl)})' if fl else '-'
        f = fired.get(k, {})
        miss = [s for s in EXPECT.get(v['role'] or '', []) if not f.get(s)]
        if v['look'] == 'netter':
            miss = []  # the netter shoots no fan by design (its net holds)
        flag = (' NEVER: ' + ','.join(miss)) if miss else ''
        print(f"  {k:<22}{v['look']:<22}{'melee' if v['melee'] else 'ranged':<7}{str(v['role']):<9}{span:<14}{json.dumps(f)}{flag}")
    rest = {k: v for k, v in allk.items() if k not in kinds}
    if rest:
        print('\nkinds in no pack (waves, storms, set pieces), id, look, melee, role, floors:')
        for k in sorted(rest, key=lambda k: (str(rest[k]['role']), k)):
            v = rest[k]; fl = sorted(v['floors'])
            print(f"  {k:<22}{v['look']:<22}{'melee' if v['melee'] else 'ranged':<7}{str(v['role']):<9}{fl[0]}-{fl[-1]} ({len(fl)})")


if __name__ == '__main__':
    if sys.argv[1] == '--sum':
        summary(sys.argv[2:])
    else:
        a, b = (int(x) for x in sys.argv[2].split('-'))
        asyncio.run(run(int(sys.argv[1]), list(range(a, b + 1)), sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else 'Bram', float(sys.argv[5]) if len(sys.argv) > 5 else 12))
