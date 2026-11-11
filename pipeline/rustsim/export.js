// The heroes' data sheets for the rough Rust model (pipeline/rustsim), read from the game itself, never typed by hand:
//
//   python pipeline/tools/page-shots.py pipeline/rustsim/export.js pipeline/rustsim/data
//
// It is the body of an async function run in the tool page (page-shots.py), which prints what it returns; refresh.py
// calls it and writes pipeline/rustsim/data/heroes.json. Per hero: HP, walk speed, the basic attack, and per spell its
// name, cooldown, reach, the damage its own settings give (`default<Name>().damage`, where it has one) and the flags
// the CPU reads. Damage per hit, hit rates and how long a hero lives are NOT here: the model takes those from the real
// simulator's fights.
const { traitFor } = await import('/src/traits/index.ts');
const { attackFor } = await import('/src/attacks/index.ts');
const { TARGETED_MODULES } = await import('/src/spells/targeted/index.ts').then((m) => ({ TARGETED_MODULES: m.TARGETED_MODULES ?? m.targetedModules ?? m.default ?? Object.values(m).find((v) => Array.isArray(v)) }));
const byLabel = new Map((TARGETED_MODULES ?? []).map((m) => [m.label, m]));
const heroes = vfx.duel.host.kits.map((kit) => {
  const trait = traitFor(kit.name), atk = attackFor(kit);
  return {
    name: kit.name, title: kit.title, hp: kit.maxHp ?? 600, melee: !!kit.melee, speed: trait?.speed ?? 4,
    attack: { kind: atk.kind, range: atk.range, damage: atk.damage, interval: atk.interval },
    passive: trait?.passive?.name ?? null,
    spells: kit.spells.map((s) => {
      const mod = byLabel.get(s.label);
      let damage = null;
      try { const d = mod?.create()?.settings?.damage; if (typeof d === 'number') damage = d; } catch { /* a spell that needs a cast to exist */ }
      return {
        key: s.key, name: s.name, label: s.label, cooldown: s.cooldown, range: s.range, damage,
        mode: mod?.targeting?.mode ?? null, radius: mod?.targeting?.radius ?? null,
        cc: !!s.cc, dash: !!s.dash, escape: !!s.escape, summon: !!s.summon, line: s.aim === 'line',
      };
    }),
  };
});
return { heroes, count: heroes.length, modules: byLabel.size };
