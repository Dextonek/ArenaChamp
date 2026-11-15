// Shared by the tests in this folder (the engine pieces of pipeline/designs/heroes20-engine.md). Each test is the body of an
// async function for the tool page, run by `python pipeline/tools/page-shots.py <test.js> <out> --port 5261 --json <name>.json`.
// A test begins with:
//
//   const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
//
// and gets: L.duel(hero, foe, { arena, trait, foeTrait }) to start a CPU duel ('run': both sides played by the CPU) with a test
// trait put in front of a hero's own for this page only (`TRAITS` is an exported record; no file changes), L.step(seconds) to
// play on at a fixed 60 steps a second, L.shot() for a picture of the game camera, and L.check(name, ok, detail) to collect
// results. Nothing here is a second copy of a rule: the duel, the traits and the CPU are the game's.
export async function lib() {
  const traits = await import('/src/traits/index.ts');
  const mech = await import('/src/mech/index.ts').catch(() => null);
  // three's vector class, from a figure the page already has (no second copy of three).
  const V3 = vfx.arena.caster.group.position.constructor;
  const realNow = performance.now.bind(performance);
  let simMs = realNow();
  performance.now = () => simMs;
  const errors = [];
  const log = console.error;
  console.error = (...a) => { if (errors.length < 10) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 400)); log(...a); };
  window.addEventListener('error', (e) => { if (errors.length < 10) errors.push(String(e.error?.stack ?? e.message).slice(0, 400)); });
  vfx.view.paused = true;
  if (!vfx.duel.on) vfx.setDuel(true, 'run');
  const saved = new Map();
  const checks = [];
  const L = {
    traits, mech, V3, errors, checks,
    v: (x, z) => new V3(x, 0, z),
    d: vfx.duel, a: vfx.arena, hm: vfx.heroMode,
    /** Puts `over` in front of `name`'s own trait (its hooks first, the hero's own for the rest) until `restore()`. */
    wrap(name, over) {
      if (!saved.has(name)) saved.set(name, traits.TRAITS[name]);
      const base = saved.get(name) ?? { passive: { name: 'test', blurb: '' } };
      traits.TRAITS[name] = { ...base, ...over };
    },
    restore() {
      for (const [k, v] of saved) { if (v) traits.TRAITS[k] = v; else delete traits.TRAITS[k]; }
      saved.clear();
    },
    /** A CPU duel: `hero` is the player's side (driven by the autopilot), `foe` the opponent. */
    duel(hero, foe, o = {}) {
      if (o.trait) L.wrap(hero, o.trait);
      if (o.foeTrait) L.wrap(foe, o.foeTrait);
      const d = vfx.duel;
      d.opponentChoice = foe;
      d.arenaChoice = o.arena ?? 'temple';
      d.hazardsInRuns = false;
      d.shiftsInRuns = false;
      if (vfx.heroPickCtrl.getValue() !== hero) vfx.heroPickCtrl.setValue(hero);
      d.start('run');
      if (o.still) {
        // Neither side acts: the test moves them by hand.
        d.autopilot = false;
        d.think = 1e9;
      }
      return d;
    },
    step(seconds, each) {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        simMs += 1000 / 60;
        vfx.step(1 / 60);
        if (each && each(i / 60) === false) return i / 60;
      }
      return seconds;
    },
    shot(w = 640, h = 400) {
      vfx.render();
      const c = document.querySelector('canvas');
      const o = document.createElement('canvas');
      o.width = w; o.height = h;
      o.getContext('2d').drawImage(c, 0, 0, w, h);
      return o.toDataURL('image/jpeg', 0.82);
    },
    check(name, ok, detail) {
      checks.push({ name, ok: !!ok, detail });
      return ok;
    },
    pos(f) { const p = f.group.position; return [+p.x.toFixed(2), +p.z.toFixed(2)]; },
    done(extra = {}) {
      L.restore();
      return { ok: checks.every((c) => c.ok) && errors.length === 0, checks, errors, ...extra };
    },
  };
  return L;
}
