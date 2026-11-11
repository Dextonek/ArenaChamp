// The fight simulator's half that runs inside the tool page (pipeline/sim/sim.py injects it). It plays whole CPU duels with
// the game's own code, stepping time itself, and hands each fight back as a record. Nothing here is a second copy of a
// rule: the duel, the kits, the traits and the CPU are the ones the game ships.
//
//   await _simInfo()            -> { heroes, arenas, foes }
//   await _simFight({ hero, foe, arena: 'random' | id, events: false, maxSeconds: 120 })
//     -> { hero, foe, arena, winner (a name, or null when nobody fell in time), seconds, heroHp, foeHp, heroMax, foeMax,
//          dealt: { Q, W, E, R, attack, unit, trait } (the hero's damage on the foe, by source), taken: the same for the
//          foe's damage on the hero, casts, foeCasts, errors, standing (only without a winner), ms (real time) }
//
// The hero is the player's side, played by the same CPU as the opponent (a 'run' duel at the balance level, as
// pipeline/tools/kit-balance.js runs them).
(() => {
  const FOES = ['Brannoc', 'Kaia', 'Isolde', 'Sirix', 'Cantor', 'Oblivion'];
  const realNow = performance.now.bind(performance);
  let level = null, simMs = 0, errors = [], label = '';

  const init = async () => {
    if (level) return;
    level = (await import('/src/cpuLevels.ts')).CPU_BALANCE;
    // Some rules time themselves with performance.now(): during a stepped fight it must follow the fight's own clock.
    simMs = realNow();
    performance.now = () => simMs;
    // Errors in a fight are bugs to fix, not noise: each fight carries its own.
    const log = console.error;
    console.error = (...a) => {
      if (errors.length < 6) errors.push(`${label}: ${a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 300)}`);
      log(...a);
    };
    window.addEventListener('error', (e) => { if (errors.length < 6) errors.push(`${label}: ${String(e.error?.stack ?? e.message).slice(0, 300)}`); });
    vfx.view.paused = true;
    if (!vfx.duel.on) vfx.setDuel(true, 'run');
  };

  window._simInfo = async () => {
    const arenas = (await import('/src/arenas/index.ts')).ARENAS.map((a) => a.id);
    return { heroes: vfx.duel.host.kits.map((k) => k.name), arenas, foes: FOES };
  };

  window._simFight = async (job) => {
    await init();
    const d = vfx.duel, a = vfx.arena, t0 = realNow();
    const dealt = {}, taken = {};
    errors = [];
    label = `${job.hero} vs ${job.foe}`;
    const resolve = Object.getPrototypeOf(d).resolve;
    d.resolve = function (dealer, victim, opts, mods, kind, slot, cast) {
      const o = resolve.call(this, dealer, victim, opts, mods, kind, slot, cast);
      if (o.damage) {
        const k = kind === 'spell' ? 'QWER'[slot ?? 0] : kind;
        if (dealer === 'hero' && victim === this.foe) dealt[k] = (dealt[k] || 0) + o.damage;
        else if (dealer === 'opponent' && victim === a.caster) taken[k] = (taken[k] || 0) + o.damage;
      }
      return o;
    };
    let out;
    try {
      d.cpuLevel = level;
      d.opponentChoice = job.foe;
      d.arenaChoice = job.arena ?? 'random';
      d.hazardsInRuns = !!job.events;
      d.shiftsInRuns = !!job.events;
      d.shiftOffset = 0;
      if (vfx.heroPickCtrl.getValue() !== job.hero) vfx.heroPickCtrl.setValue(job.hero);
      d.start('run');
      const max = (job.maxSeconds ?? 120) * 60;
      let f = 0;
      while (!d.result && f < max) { simMs += 1000 / 60; vfx.step(1 / 60); f++; }
      const r = d.result;
      out = {
        hero: job.hero, foe: job.foe, arena: d.currentArena?.id ?? null, winner: r ? r.winner : null, seconds: r ? r.seconds : f / 60,
        heroHp: Math.round(r ? r.playerHp : d.playerHp), foeHp: Math.round(r ? r.opponentHp : a.hpOf(d.foe)), heroMax: d.playerMax, foeMax: d.foeMax,
        dealt, taken, casts: r?.playerCasts ?? null, foeCasts: r?.opponentCasts ?? null, errors: errors.slice(),
      };
      if (!r) {
        // Where it stood when time ran out: enough to tell a stall from a fight that was still going.
        const h = a.caster.group.position, o = d.foe.group.position;
        out.standing = { me: [+h.x.toFixed(1), +h.z.toFixed(1)], them: [+o.x.toFixed(1), +o.z.toFixed(1)], dist: +Math.hypot(h.x - o.x, h.z - o.z).toFixed(1), sees: a.lineOfSight(h, o) };
      }
    } catch (e) {
      out = { hero: job.hero, foe: job.foe, arena: null, winner: null, seconds: 0, heroHp: 0, foeHp: 0, dealt, taken, errors: [...errors, `${label}: ${String(e?.stack ?? e).slice(0, 400)}`], crashed: true };
    }
    delete d.resolve;
    out.ms = Math.round(realNow() - t0);
    // one turn of the event loop between fights, so the page stays alive
    await new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
    return out;
  };
})();
