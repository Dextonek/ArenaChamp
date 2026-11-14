// Every hero's four spells as the engine sees them, and the kind `spellShape` gives each (Kohaku's copy: a bolt, a dash, a
// ring or a shield). For reading by eye: a kind that is plainly wrong is a rule to change in src/mech/index.ts.
const { spellShape } = await import('/src/mech/index.ts');
const kits = vfx.duel.host.kits;
const rows = [], count = { bolt: 0, dash: 0, ring: 0, shield: 0 };
for (const k of kits) {
  for (const s of k.spells) {
    const mode = vfx.duel.host.targeting(s.label)?.mode;
    const shape = spellShape(s, mode);
    count[shape]++;
    rows.push(`${k.name.padEnd(18)} ${s.name.padEnd(22)} ${String(mode).padEnd(7)} ${String(s.aim ?? '').padEnd(5)} r${s.range} ${['dash', 'escape', 'save', 'parry', 'barrier', 'summon', 'cc'].filter((f) => s[f]).join(',')}${s.buff ? ',buff' : ''} -> ${shape}`);
  }
}
return { heroes: kits.length, count, rows };
