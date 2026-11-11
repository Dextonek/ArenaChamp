// The game's own numbers for the full Rust simulator (pipeline/rustfull), read from the game itself, never typed by hand:
//
//   python pipeline/tools/page-shots.py pipeline/rustfull/export.js pipeline/rustfull/data --json game.json
//
// It is the body of an async function run in the tool page (page-shots.py). Per hero: HP, walk speed, body size, the
// basic attack, what the passive fixes without code (recast windows, ammo, the resource) and per spell the kit's
// flags, the spell module's targeting and the numbers of its own settings. Per arena: the ring and the cover.
// Numbers that live only inside a spell file as constants (a wind-up, a bolt's speed) are NOT here: the port mirrors
// those in its hero file and says so.
const { traitFor } = await import('/src/traits/index.ts');
const { attackFor } = await import('/src/attacks/index.ts');
const { HERO_BODIES } = await import('/src/heroes.ts');
const { ARENAS } = await import('/src/arenas/index.ts');
const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
const { stopsAtCover } = await import('/src/obstacles.ts');
const mods = await import('/src/spells/targeted/index.ts');
const list = mods.TARGETED_MODULES ?? mods.targetedModules ?? mods.default ?? Object.values(mods).find((v) => Array.isArray(v));
const byLabel = new Map((list ?? []).map((m) => [m.label, m]));
const plain = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o ?? {})) if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
  return out;
};
const arr = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const kitOf = (kit) => {
  const trait = traitFor(kit.name), atk = attackFor(kit);
  return {
    name: kit.name, title: kit.title, hp: kit.maxHp ?? 600, melee: !!kit.melee, speed: trait?.speed ?? 4,
    body: HERO_BODIES[kit.name]?.radius ?? 0.5,
    attack: { kind: atk.kind, range: atk.range, damage: atk.damage, interval: atk.interval, windup: atk.windup, speed: atk.speed ?? 0 },
    passive: trait?.passive?.name ?? null,
    recast: arr(trait?.recast).map((r) => ({ slot: r.slot, window: r.window, arm: r.arm ?? 0, power: r.power ?? 0.6, replay: r.replay !== false, aiWait: !!r.aiWait })),
    hold: arr(trait?.hold).map((h) => ({ slot: h.slot, seconds: h.seconds })),
    charges: trait?.charges ? { slot: trait.charges.slot, count: trait.charges.count, every: trait.charges.every } : null,
    resource: trait?.resource ? { max: trait.resource.max, start: trait.resource.start ?? 0 } : null,
    shieldMul: trait?.shieldMul ?? 1,
    hooks: Object.keys(trait ?? {}).filter((k) => typeof trait[k] === 'function').sort(),
    spells: kit.spells.map((s) => {
      const mod = byLabel.get(s.label);
      let settings = {};
      try { settings = plain(mod?.create()?.settings); } catch { /* a spell that needs a cast to exist */ }
      return {
        key: s.key, name: s.name, label: s.label, cooldown: s.cooldown, range: s.range,
        cc: !!s.cc, dash: !!s.dash, escape: !!s.escape, summon: !!s.summon, save: !!s.save, parry: !!s.parry, barrier: !!s.barrier,
        anytime: !!s.anytime, bank: !!s.bank, aim: s.aim ?? null, stopsAtCover: stopsAtCover(s), passesOwnWalls: !!s.passesOwnWalls,
        buff: s.buff ? { kind: s.buff.kind, amount: s.buff.amount, seconds: s.buff.seconds } : null,
        debuff: s.debuff ? { kind: s.debuff.kind, amount: s.debuff.amount, seconds: s.debuff.seconds } : null,
        mode: mod?.targeting?.mode ?? null, radius: mod?.targeting?.radius ?? null, maxTargets: mod?.targeting?.maxTargets ?? null,
        settings,
      };
    }),
  };
};
const heroes = vfx.duel.host.kits.map(kitOf);
const arenas = ARENAS.map((a) => ({
  id: a.id, name: a.name, ring: a.ring ?? 12, breakable: !!a.breakable, hazard: !!a.hazard, shift: !!a.shift,
  obstacles: a.obstacles.map((o) => ({ ax: o.ax, az: o.az, bx: o.bx, bz: o.bz, r: o.r, kind: o.kind ?? null })),
}));
return { heroes, arenas, level: plain(CPU_BALANCE), castGap: CPU_BALANCE.castGap, count: heroes.length, modules: byLabel.size };
