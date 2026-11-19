// Measures every hero spell's danger zones as the engine draws them (the shape, its size, when it shows and when it lands),
// for the spell rules sheet and its answer check (pipeline/tools/spell-rules.py; docs/knowledge/moba-spell-mechanics.md,
// changes 1 and 2). The body of an async function run in the tool page by page-shots.py:
//
//   MSYS_NO_PATHCONV=1 python pipeline/tools/page-shots.py pipeline/tools/spell-rules-measure.js pipeline/tools/out --page "/?drafts=1" --browser msedge --json spell-measure.json
//
// Each spell is cast once in the tool's own arena (the caster at its spot, the training targets as they stand) and stepped
// 0.1 s, then its module's `telegraphs()` are read: the same specs the duel draws and judges hits with.
const { traitFor } = await import('/src/traits/index.ts');
const kits = vfx.duel.host.kits;
const out = { spells: [], errors: [] };
const r2 = (v) => Math.round(v * 100) / 100;
for (const kit of kits) {
  const trait = traitFor(kit.name);
  const attack = trait?.attack ?? {};
  for (const s of kit.spells) {
    const rec = {
      hero: kit.name, key: s.key, name: s.name, label: s.label, range: s.range, cooldown: s.cooldown,
      aim: s.aim ?? null, overCover: !!s.overCover, flags: ['cc', 'dash', 'escape', 'save', 'parry', 'barrier', 'summon', 'anytime'].filter((f) => s[f]),
      melee: !!kit.melee, reach: attack.range ?? (kit.melee ? 2.2 : 6), zones: [],
    };
    try {
      const slot = vfx.slots.get(s.label);
      if (!slot) { rec.missing = true; out.spells.push(rec); continue; }
      rec.mode = slot.module.targeting?.mode ?? null;
      rec.targetRadius = slot.module.targeting?.radius ?? null;
      vfx.selectMode(s.label);
      const e = vfx.effect;
      vfx.view.paused = true;
      e.play();
      const c = vfx.arena.caster.group.position.clone();
      // Zones may appear after the cast (a mark that fixes, a recast): read them at several moments, keep each once.
      const seen = new Set(), specs = [];
      let t = 0;
      for (const at of [0.1, 0.4, 0.8, 1.3, 2.0, 3.0]) {
        for (; t < at; t += 1 / 60) vfx.step(1 / 60);
        for (const z of slot.module.telegraphs?.(e) ?? []) {
          const key = JSON.stringify([z.shape.kind, r2(z.start), r2(z.impact), z.shape.radius ?? z.shape.width ?? z.shape.outer]);
          if (!seen.has(key)) { seen.add(key); specs.push(z); }
        }
      }
      for (const z of specs) {
        const sh = z.shape;
        const zone = { kind: sh.kind, start: r2(z.start), impact: r2(z.impact), until: z.until !== undefined ? r2(z.until) : null };
        if (sh.kind === 'circle') Object.assign(zone, { radius: r2(sh.radius), onCaster: Math.hypot(sh.x - c.x, sh.z - c.z) < 0.6 });
        if (sh.kind === 'ring') Object.assign(zone, { inner: r2(sh.inner), outer: r2(sh.outer), onCaster: Math.hypot(sh.x - c.x, sh.z - c.z) < 0.6 });
        if (sh.kind === 'cone') Object.assign(zone, { radius: r2(sh.radius), angle: r2(sh.angle) });
        if (sh.kind === 'line') Object.assign(zone, { length: r2(Math.hypot(sh.x2 - sh.x1, sh.z2 - sh.z1)), width: r2(sh.width) });
        rec.zones.push(zone);
      }
      // let it finish so the next spell starts clean
      for (let i = 0; i < 360; i++) vfx.step(1 / 60);
    } catch (err) {
      rec.error = String(err?.message ?? err).slice(0, 200);
      out.errors.push(`${s.label}: ${rec.error}`);
    }
    out.spells.push(rec);
  }
}
out.count = out.spells.length;
return out;
