// Paste into the VFX tool page (http://localhost:5194/, browser javascript tool). The Tower's floors as worlds
// (pipeline/designs/tower-worlds-build.md, src/tower/world/): one walking zone a floor with packs, quests, people, caches, waystones,
// a law (the tide) and doors to the set pieces. The route bot plays a floor from its data with no person.
//
//   eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
//   await _world({ floor: 1, hero: 'Lyra' })            // manual: you step time (_world.step(s)); { person: true }: the page's own loop runs it
//   await _worldRoute({ floor: 1, hero: 'Lyra' })       // the bot plays the whole floor, camp to gate; returns the report (see below)
//   await _worldRoute({ hero: 'Lyra', resume: true })   // continues the saved run (after a page reload)
//   await _worldVerbs()                                 // every quest verb and every law piece once, in a scratch zone
//   _world.status()                                     // clock, hero, lives, shards, quests, packs, the log
//   _world.go(x, z) / _world.step(seconds)              // put the hero somewhere / run time
//   await _worldWalk(['market', [x, z]])                // (stage 0) walk by place name through the zone and report each leg
//   await _worldBench('zone', 240)  _worldBench.duel()  _worldPath()    // (stage 0) CPU time per frame, path-finding time
//
// The route's report: per checkpoint (a quest step, a cache, a waystone, the lore stone, the race, each door and piece) done or
// stuck with the clock, the hero's health, lives and shards at the moment; then the totals. Time is stepped by the tool (60 steps a
// second of game time), so a floor takes a few minutes of wall time. The numbers are game seconds, not wall seconds.
(() => {
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  let api = null, mod = null, game = null;
  const gl = (document.querySelector('#app canvas') ?? document.querySelector('canvas'))?.getContext('webgl2');
  const r2 = (x) => +x.toFixed(2);

  // GL counters (stage 0's bench): draw calls and triangles, summed over every pass of a frame.
  const counts = { calls: 0, tris: 0 };
  if (!window.__glCounted) {
    window.__glCounted = true;
    const P = WebGL2RenderingContext.prototype;
    const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
    for (const [name, nIdx, instIdx] of [['drawElements', 1, -1], ['drawArrays', 2, -1], ['drawElementsInstanced', 1, 4], ['drawArraysInstanced', 2, 3], ['drawRangeElements', 3, -1]]) {
      const orig = P[name];
      P[name] = function (...a) {
        const c = window.__glCounts;
        if (c) { c.calls++; c.tris += tri(a[0], a[nIdx]) * (instIdx >= 0 ? a[instIdx] : 1); }
        return orig.apply(this, a);
      };
    }
  }
  window.__glCounts = counts;
  const sorted = (xs) => xs.slice().sort((a, b) => a - b);
  const median = (xs) => sorted(xs)[Math.floor(xs.length / 2)] ?? 0;

  async function setup() {
    if (!mod) {
      mod = {
        game: await import('/src/tower/world/game.ts'), zone: await import('/src/tower/world/zone.ts'), floors: await import('/src/tower/world/floors/index.ts'),
        doors: await import('/src/tower/world/doors.ts'), state: await import('/src/tower/world/state.ts'), heroes: await import('/src/heroes.ts'),
      };
    }
    // The game page's own runtime (`game.api`), or the tool page's.
    api = window.game?.api ?? { arena: vfx.arena, heroMode: vfx.heroMode, duel: vfx.duel, kits: mod.heroes.HERO_KITS, setHeroMode: vfx.setHeroMode, setKit: (n) => vfx.heroPickCtrl.setValue(n), step: vfx.step, view: vfx.view };
  }
  const spot = (p) => {
    if (typeof p === 'string') return { ...(game?.floor.places ?? mod.zone.PLACES)[p].stand };
    return Array.isArray(p) ? { x: p[0], z: p[1] } : p;
  };
  const zoneOf = () => game?.zone;

  /** Steps the game one frame: the duel's own, and the run's tick. */
  const frame = () => { api.step(1 / 60); game.tick(1 / 60); };

  /** Starts a floor. `person` (or `manual: false`): the page's own loop runs it and nothing is paused. */
  window._world = async (o = {}) => {
    await setup();
    if (game) { game.stop(); game = null; }
    const person = o.person ?? (o.manual === false);
    api.view.paused = !person;
    game = new mod.game.WorldGame(api, { hero: o.hero ?? 'Lyra', mode: o.mode ?? 'play', floor: o.floor ?? 1, persist: o.persist ?? !!person });
    game.manual = !person;
    mod.doors.stubWaits.length = 0;
    // On the game page the menu is hidden while a climb is on (as `game.world` does for a person's).
    if (window.game?.world && !window.game.world.active) { window.game.world.active = true; window.game.render(); window.__worldHid = true; }
    game.start({ resume: !!o.resume });
    if (!person) for (let i = 0; i < 10; i++) frame();
    window._worldGame = game;
    return { ok: true, floor: game.floor.n, hero: game.run.hero, packs: [...game.zone.packs.values()].map((p) => `${p.id}:${p.total}`), ring: game.floor.ring, cover: game.floor.cover.length };
  };
  const questStatus = () => game.floor.quests.map((q) => { const s = game.run.q(q.id); return `${q.id}: ${s.handedIn ? 'handed in' : s.done ? 'done' : s.taken ? `step ${s.step + 1}/${q.steps.length} (${s.progress})` : 'not taken'}`; });
  window._world.status = () => {
    const z = game.zone, run = game.run;
    return {
      clock: r2(run.clock), hero: z?.ctx ? { x: r2(z.ctx.hero.x), z: r2(z.ctx.hero.z), hp: Math.round(api.duel.heroHp), max: Math.round(api.duel.heroMax) } : null,
      lives: run.lives, shards: run.shards, falls: run.falls, kills: run.kills, quests: questStatus(), rival: run.rival, won: run.won, caches: run.caches, waystones: run.waystones,
      opened: run.opened, boons: run.boons.list(), over: !!api.duel.over, finished: game.finished, piece: game.piece, law: z?.law?.status?.(),
      packs: z ? [...z.packs.values()].map((p) => ({ id: p.id, state: p.state, left: p.left, total: p.total })) : [], liveUnits: api.arena.summons.alive('opponent').length, log: z?.log.slice(-20), gameLog: game.log,
    };
  };
  /** Stops the floor and, on the game page, brings the menu back. */
  window._world.end = () => {
    game?.stop(); game = null;
    if (window.__worldHid && window.game?.world) { window.game.world.active = false; window.game.render(); window.__worldHid = false; }
  };
  window._world.packs = (on) => zoneOf()?.setPacks(on);
  window._world.wakeAll = () => zoneOf()?.wakeAll();
  window._world.go = (x, z) => { const h = api.arena.caster.group.position; h.set(x, 0, z); api.heroMode.halt(); api.heroMode.snapCameraNow(); };
  window._world.step = (seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) frame(); };
  window._world.place = (name) => game.floor.places[name];
  window._world.game = () => game;
  window._world.at = (name) => (name === 'camp' ? game.floor.start : game.floor.places[name]?.stand);

  // --- the route bot ------------------------------------------------------------------------------------------------------

  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /**
   * One decision of the bot: where to go (or null to stay), and what to do when there. Reads the run and the floor's data only; the
   * autopilot walks (`zone.bot.goal`) and fights what is awake near it. Returns { goal, why, act? }.
   */
  let botOpts = {};
  function decide() {
    const z = game.zone, run = game.run, def = game.floor, ctx = z.ctx, hero = ctx.hero, q = z.quests;
    const person = (id) => def.people.find((p) => p.id === id);
    const byRole = (role) => def.people.find((p) => p.role === role);
    const near = (p) => dist(hero, p.at) < 2.8;
    const toPerson = (id, why) => { const p = person(id); const at = { x: p.at.x + Math.sin(p.face) * 1.5, z: p.at.z + Math.cos(p.face) * 1.5 }; return { goal: at, why, act: near(p) ? () => z.people.auto(id) : null }; };
    const hp = run.hp;
    // The law first: on low ground when the tide turns, go to dry ground; on dry ground, wait it out.
    const law = z.law.status();
    if ((law.warn || law.active) && def.law.kind === 'tide') {
      if (!z.law.safe(hero.x, hero.z, 0) || (law.warn && !z.law.safe(hero.x, hero.z, 8))) {
        // The nearest dry spot of a ring of tries round the hero.
        let best = null, bd = 1e9;
        for (let r = 3; r <= 18; r += 3) for (let a = 0; a < 6.28; a += 0.52) {
          const s = { x: hero.x + Math.cos(a) * r, z: hero.z + Math.sin(a) * r };
          if (Math.hypot(s.x - 0, s.z - 7) > def.ring - 2) continue;
          if (z.law.safe(s.x, s.z, 8) && z.law.safe(s.x, s.z, 0) && dist(s, hero) < bd) { bd = dist(s, hero); best = s; }
        }
        if (best) return { goal: best, why: 'tide: to dry ground' };
      } else if (law.warn || law.active) return { goal: null, why: 'tide: waiting on dry ground' };
    }
    // A race that is running comes before everything else (a person who stops to hand in a quest loses it). The autopilot's own walk
    // through the zone takes 22 to 33 s to the lighthouse where a person who goes straight needs 9 to 12, so the bot sprints (x3) during a race:
    // that is the stand-in for a person's straight walk. `_worldRoute({ noSprint: true })` leaves it off (the bot then loses the race).
    z.ctx.speed('bot-race', run.rival === 'running' && !botOpts.noSprint ? 3 : 1);
    if (run.rival === 'running') return { goal: def.rival.to, why: 'race: run' };
    // Hand in what is done, take what is offered.
    for (const qd of def.quests) {
      const st = run.q(qd.id);
      if (st.done && !st.handedIn) return toPerson(qd.giver, `hand in ${qd.id}`);
    }
    // Heal at the trader when hurt and able.
    if (byRole('trader') && hp < 0.5 && run.shards >= def.shop.heal && ![...z.packs.values()].some((p) => p.state === 'awake')) return toPerson(byRole('trader').id, 'heal');
    const untaken = def.quests.find((qd) => !run.q(qd.id).taken);
    if (untaken) return toPerson(untaken.giver, `take ${untaken.id}`);
    // The race, once: its start is at the rival.
    const rv = byRole('rival');
    if (run.rival === 'none' && rv) return toPerson(rv.id, 'race: start');
    if (run.rival === 'running') return { goal: def.rival.to, why: 'race: run' };
    // A waystone or a cache a short way off is touched on the way.
    for (const w of def.waystones) if (!run.waystones.includes(w.id) && dist(hero, w.at) < 16) return { goal: w.at, why: `waystone ${w.id}` };
    for (const c of def.caches) if (!run.caches.includes(c.id) && dist(hero, c.at) < 14) return { goal: c.at, why: `cache ${c.id}` };
    // The quests in hand, the main one first.
    for (const qd of q.active()) {
      const st = run.q(qd.id), step = qd.steps[st.step];
      if (!step) continue;
      switch (step.verb) {
        case 'lead': {
          const u = q.leadAt, next = q.leadNext();
          if (!u) return { goal: step.from, why: `lead ${qd.id}: to ${step.name}` };
          if (!q.leadStarted || dist(hero, u) > 9) return { goal: u, why: `lead ${qd.id}: to ${step.name}` };
          return { goal: next ?? u, why: `lead ${qd.id}: ahead` };
        }
        case 'open': return { goal: def.doors.find((d) => d.id === step.door).at, why: `open ${step.door}` };
        default: { const t = q.target(); if (t) return { goal: t, why: `${qd.id}.${st.step}: ${step.verb}` }; }
      }
    }
    // Everything asked is done: the rest of the secrets, then the doors.
    for (const w of def.waystones) if (!run.waystones.includes(w.id)) return { goal: w.at, why: `waystone ${w.id}` };
    for (const c of def.caches) if (!run.caches.includes(c.id)) return { goal: c.at, why: `cache ${c.id}` };
    if (!run.lore.includes(def.lore.id)) return { goal: def.lore.at, why: 'lore stone' };
    const door = (piece) => def.doors.find((d) => d.piece === piece);
    if (byRole('trader') && hp < 0.6 && run.shards >= def.shop.heal) return toPerson(byRole('trader').id, 'heal');
    if (!run.has('trial') && door('trial')) return { goal: door('trial').at, why: 'door: trial' };
    if (!run.has('ruler') && door('ruler') && (!door('ruler').wall || run.opened.includes(door('ruler').id))) return { goal: door('ruler').at, why: 'door: ruler' };
    if (run.has('ruler') && !run.has('gate')) return { goal: door('gate').at, why: 'door: gate' };
    return { goal: null, why: 'nothing left' };
  }

  /** The checkpoints of a floor, from its data: what a route should reach, in the order it is listed. */
  function checkpoints(def) {
    const list = [];
    const run = () => game.run;
    for (const q of def.quests) {
      list.push([`${q.id}: taken`, () => run().q(q.id).taken]);
      q.steps.forEach((s, i) => list.push([`${q.id}.${i + 1}: ${s.verb}`, () => run().q(q.id).step > i || run().q(q.id).done]));
      list.push([`${q.id}: handed in`, () => run().q(q.id).handedIn]);
    }
    if (def.people.some((p) => p.role === 'rival')) list.push(['race with the rival', () => run().rival === 'won' || run().rival === 'lost']);
    for (const w of def.waystones) list.push([`waystone ${w.id}`, () => run().waystones.includes(w.id)]);
    for (const c of def.caches) list.push([`cache ${c.id}`, () => run().caches.includes(c.id)]);
    list.push(['lore stone read', () => run().lore.includes(def.lore.id)]);
    for (const d of def.doors) { if (d.wall) list.push([`door ${d.id} opened`, () => run().opened.includes(d.id)]); list.push([`piece ${d.piece} won`, () => run().has(d.piece)]); }
    list.push(['floor cleared', () => game.finished]);
    return list;
  }

  /**
   * Plays the floor from camp to gate with no person. `hero`, `floor`, `maxSeconds` (game seconds, default 2400), `resume`, `persist`.
   * Returns { ok, seconds, hp, lives, shards, falls, restarts, checkpoints: [...], notDone: [...], errors }.
   */
  window._worldRoute = async (o = {}) => {
    await setup();
    const errors = [], logError = console.error;
    console.error = (...a) => { if (errors.length < 10) errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 300)); logError(...a); };
    const onErr = (e) => { if (errors.length < 10) errors.push(String(e.error?.stack ?? e.message).slice(0, 300)); };
    window.addEventListener('error', onErr);
    const t0 = performance.now();
    botOpts = o;
    try {
      await window._world({ floor: o.floor ?? 1, hero: o.hero ?? 'Lyra', mode: 'run', persist: o.persist ?? !!o.resume, resume: !!o.resume, manual: true });
      const run = () => game.run, def = game.floor, cps = checkpoints(def), got = new Map();
      const maxSec = o.maxSeconds ?? 2400;
      let frames = 0, lastWhy = '', lastPos = null, stillSince = 0, lastTask = '';
      const whyLog = [];
      const note = () => { for (const [name, ok] of cps) if (!got.has(name) && ok()) got.set(name, { t: r2(run().clock), hp: r2(run().hp), lives: run().lives, shards: run().shards }); };
      while (!game.finished && run().clock < maxSec && frames < maxSec * 60 * 2) {
        frame();
        frames++;
        if (frames % 30 === 0) {
          note();
          const z = game.zone;
          if (z?.ctx && api.duel.heroHp > 0) {
            const d = decide();
            if (d.why !== lastWhy) { whyLog.push(`${r2(run().clock)}s ${d.why}`); lastWhy = d.why; }
            const key = d.goal ? `${d.why}|${r2(d.goal.x)}|${r2(d.goal.z)}` : d.why;
            // The goal is moved when the target changes (a moving one: the escort, the patrol, changes each time).
            if (key !== lastTask) { z.bot.goal(d.goal); lastTask = key; }
            if (d.act) { const did = d.act(); if (did?.length) whyLog.push(`${r2(run().clock)}s did ${did.join(',')}`); }
            // Stuck: the hero has not moved for 45 s of game time while it had a goal and nothing was awake near it.
            const p = z.ctx.hero;
            if (lastPos && dist(p, lastPos) < 0.3 && d.goal && !z.bot.fighting) { if (!stillSince) stillSince = run().clock; } else stillSince = 0;
            if (stillSince && run().clock - stillSince > 45) { whyLog.push(`${r2(run().clock)}s STILL for 45 s: ${d.why}`); stillSince = 0; z.bot.goal({ x: p.x + 4, z: p.z + 4 }); lastTask = ''; }
            lastPos = p.clone();
          }
        }
        if (frames % 600 === 0) await tick();
        if (o.until && o.until(game)) break;
      }
      note();
      const out = cps.map(([name]) => (got.has(name) ? { step: name, status: 'done', ...got.get(name) } : { step: name, status: 'stuck' }));
      return {
        ok: game.finished && out.every((c) => c.status === 'done'), floorCleared: game.finished, seconds: r2(run().clock), hp: r2(run().hp), lives: run().lives, shards: run().shards, falls: run().falls, restarts: game.restarts,
        kills: run().kills, stars: run().result?.stars ?? game.stars().map((s) => (s.got ? 1 : 0)), checkpoints: out, notDone: out.filter((c) => c.status !== 'done').map((c) => c.step), errors,
        gateTries: game.log.filter((l) => /^piece gate/.test(l)).length, rulerTries: game.log.filter((l) => /^piece ruler/.test(l)).length, pieceFalls: game.pieceFalls,
        frames, whyLog: whyLog.slice(-70), gameLog: game.log, last: window._world.status(), wallSeconds: r2((performance.now() - t0) / 1000), boons: run().boons.list(),
      };
    } finally {
      console.error = logError;
      window.removeEventListener('error', onErr);
    }
  };

  /**
   * The route bot for several heroes, each `reps` times, one after the other, in the background (a browser call stops after about 45 s):
   *   _worldSix(['Lyra','Bram'], 2)  ...  _worldSix.result()  -> { done, rows: [{ hero, run, seconds, falls, fellAt, stars, gateFirst, ... }] }
   */
  const six = { done: true, rows: [], err: null, now: '' };
  window._worldSix = (heroes, reps = 2, o = {}) => {
    if (!six.done) return 'already running';
    six.done = false; six.rows = []; six.err = null;
    (async () => {
      try {
        for (let r = 0; r < reps; r++) for (const hero of heroes) {
          six.now = `${hero} #${r + 1}`;
          const out = await window._worldRoute({ floor: o.floor ?? 1, hero, maxSeconds: o.maxSeconds ?? 1800 });
          const fell = (out.gameLog ?? []).filter((l) => /^fall|lost/.test(l));
          six.rows.push({ hero, run: r + 1, ok: out.ok, seconds: out.seconds, falls: out.falls, restarts: out.restarts, fellAt: fell, stars: (out.stars ?? []).join(''), gateFirst: out.gateTries === 1 && (out.gameLog ?? []).some((l) => /^piece gate won/.test(l)), gateTries: out.gateTries, rulerTries: out.rulerTries, rival: out.last?.rival, hp: out.hp, shards: out.shards, kills: out.kills, notDone: out.notDone, errors: out.errors, wall: out.wallSeconds });
        }
      } catch (e) { six.err = String(e?.stack ?? e).slice(0, 400); }
      window._world.end();
      six.done = true;
    })();
    return 'started';
  };
  window._worldSix.result = () => ({ done: six.done, now: six.now, err: six.err, rows: six.rows });

  // --- every verb and every law, once ---------------------------------------------------------------------------------------

  /**
   * Runs each quest verb once in a scratch zone (a floor whose only quest asks every verb, played by the bot) and each law piece once,
   * and reports.
   */
  window._worldVerbs = async (o = {}) => {
    await setup();
    const base = mod.floors.FLOORS[1];
    const out = { verbs: {}, laws: {}, errors: [] };
    const logError = console.error;
    console.error = (...a) => { if (out.errors.length < 10) out.errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 300)); logError(...a); };
    const Z = 7;
    try {
      const testDoor = { id: 'test-door', piece: 'trial', name: 'A test door', at: { x: 6, z: Z + 30 }, r: 2, wall: { ax: 3, az: Z + 28, bx: 9, bz: Z + 28, r: 0.4, height: 3 }, locked: '' };
      const quest = {
        id: 'verbs', name: 'Every verb', giver: 'gus', main: true, intro: ['Every verb.'], outro: ['All of them.'], reward: { shards: 1 },
        steps: [
          { verb: 'reach', text: 'reach', at: { x: -10, z: Z + 18 }, r: 3 },
          { verb: 'fell', text: 'fell the market', packs: ['market'] },
          { verb: 'fell-named', text: 'fell the named', pack: 'barnacle' },
          { verb: 'light', text: 'light', things: [{ id: 't1', at: { x: 10, z: Z + 14 } }, { id: 't2', at: { x: 14, z: Z + 14 } }], seconds: 2 },
          { verb: 'hold', text: 'hold', at: { x: 0, z: Z + 20 }, r: 3, seconds: 8, waves: { kinds: ['docker', 'docker'], every: 4 } },
          { verb: 'carry', text: 'carry', item: 'key', itemName: 'The key', toName: 'the post', from: { x: -6, z: Z + 26 }, to: { x: 4, z: Z + 26 }, r: 2, opens: 'lair' },
          { verb: 'open', text: 'open the test door', door: 'test-door' },
          { verb: 'lead', text: 'lead', name: 'Tam', from: { x: -4, z: Z + 20 }, r: 2.5, path: [{ x: 0, z: Z + 24 }, { x: 4, z: Z + 28 }] },
        ],
      };
      const scratch = { ...base, id: 'scratch', quests: [quest], doors: [...base.doors, testDoor], people: base.people.filter((p) => p.id !== 'zephyr'), caches: [], waystones: [] };
      mod.floors.FLOORS[1] = scratch;
      const bot = await window._worldRoute({ floor: 1, hero: o.hero ?? 'Lyra', maxSeconds: 900, persist: false, until: (g) => g.run.q('verbs').done });
      const st = game.run.q('verbs');
      out.verbs = { allDone: st.done, seconds: bot.seconds, steps: quest.steps.map((s, i) => ({ verb: s.verb, done: st.step > i || st.done })), lives: bot.lives, falls: bot.falls, notes: bot.whyLog.slice(-14), errors: bot.errors };
      mod.floors.FLOORS[1] = base;
    } catch (e) { out.verbs = { error: String(e?.stack ?? e).slice(0, 400) }; mod.floors.FLOORS[1] = base; }
    // The laws: each in the harbour's zone, with the law swapped and the hero put where it matters.
    const lawDefs = {
      tide: base.law,
      storm: { kind: 'storm', name: 'The storm', blurb: 'test', every: 30, lasts: 20, warn: 4, burn: 0.03, width: 10 },
      dark: { kind: 'dark', name: 'The dark', blurb: 'test', radius: 22, lit: 40, lights: [{ x: 24, z: Z - 19 }] },
      paths: { kind: 'paths', name: 'The wood moves', blurb: 'test', every: 10, walls: [{ a: { x: -8, z: Z + 20 }, b: { x: 8, z: Z + 20 }, r: 0.5, height: 3, set: 0 }, { a: { x: -8, z: Z + 10 }, b: { x: 8, z: Z + 10 }, r: 0.5, height: 3, set: 1 }] },
      sides: { kind: 'sides', name: 'The war', blurb: 'test', banners: [{ id: 'red', name: 'red banner', color: 0xb03030, at: { x: -3, z: Z + 36 }, packs: ['market'] }, { id: 'blue', name: 'blue banner', color: 0x3060b0, at: { x: 3, z: Z + 36 }, packs: ['caves'] }] },
    };
    for (const [kind, law] of Object.entries(lawDefs)) {
      try {
        mod.floors.FLOORS[1] = { ...base, law };
        await window._world({ floor: 1, hero: 'Lyra', mode: 'play', persist: false });
        const z = game.zone, hero = z.ctx.hero, res = { kind, notes: [] };
        const stepSeconds = (s) => { for (let i = 0; i < Math.round(s * 60); i++) frame(); };
        if (kind === 'tide') {
          const low = law.low[0];
          game.run.clock = law.every - 3;
          hero.set(low.x, 0, low.z);
          const hp0 = api.duel.heroHp, spd = [];
          for (let i = 0; i < 12 * 60; i++) { frame(); if (i % 60 === 59) spd.push(r2(api.heroMode.speedBonus)); }
          res.notes.push(`warned ${law.warn} s before the flood; flood at ${law.every} s for ${law.lasts} s; the hero standing in it lost ${Math.round(hp0 - api.duel.heroHp)} hp over its first 9 s; speed bonus each second ${spd.join(',')}`);
          hero.set(base.start.x, 0, base.start.z);
          api.heroMode.halt();
          const hp1 = api.duel.heroHp;
          stepSeconds(4);
          res.notes.push(`on dry ground during the flood: ${Math.round(hp1 - api.duel.heroHp)} hp lost, speed ${r2(api.heroMode.speedBonus)}`);
        } else if (kind === 'storm') {
          game.run.clock = law.every + 2;
          const mid = base.start.z - 34, zb = mid - 38 + (2 / law.lasts) * 76;
          hero.set(-8, 0, zb);
          const hp0 = api.duel.heroHp;
          stepSeconds(1.6);
          res.notes.push(`the hero in the open band lost ${Math.round(hp0 - api.duel.heroHp)} hp; facts ${JSON.stringify(z.law.facts())}`);
        } else if (kind === 'dark') {
          const r0 = z.law.facts().radius;
          game.run.lit.push('lighthouse');
          hero.set(24, 0, Z - 19);
          stepSeconds(2);
          res.notes.push(`overlay present: ${!!document.querySelector('.world-dark')}; clear radius ${r0} -> ${z.law.facts().radius} (it grows near a lit thing)`);
        } else if (kind === 'paths') {
          const f0 = z.law.facts();
          stepSeconds(10.5);
          const f1 = z.law.facts();
          res.notes.push(`walls changed ${f0.changes} -> ${f1.changes} times; set ${f0.set} -> ${f1.set}; list swap + one route: ${f1.lastRebuildMs} ms`);
        } else if (kind === 'sides') {
          hero.set(-3, 0, Z + 36);
          stepSeconds(1);
          const m = z.packs.get('market'), c = z.packs.get('caves');
          res.notes.push(`took the red banner: its pack (market) off=${m.off}, the other (caves) off=${c.off} leash ${c.leashAt}; facts ${JSON.stringify(z.law.facts())}`);
        }
        out.laws[kind] = res;
      } catch (e) { out.laws[kind] = { kind, error: String(e?.stack ?? e).slice(0, 400) }; }
    }
    mod.floors.FLOORS[1] = base;
    console.error = logError;
    out.errorsTotal = out.errors.length;
    game?.stop();
    game = null;
    return out;
  };

  // --- stage 0: walking and measuring ---------------------------------------------------------------------------------------

  /** Walks the hero through `points`, one after the other, by walk orders (a game in 'play' mode), stepping the simulation. */
  window._worldWalk = async (points, opts = {}) => {
    if (!game) throw new Error('_world() first');
    const hm = api.heroMode, hero = api.arena.caster.group.position, maxSec = opts.maxSeconds ?? 90;
    api.view.paused = true;
    const out = { legs: [], falls: 0, minHp: api.duel.heroHp, seconds: 0 };
    const falls0 = game.run.falls;
    for (const raw of points) {
      const to = spot(raw);
      hm.walkTo(to.x, to.z);
      let f = 0, still = 0, result = 'timeout';
      const last = hero.clone(), start = hero.clone();
      while (f < maxSec * 60) {
        frame();
        f++;
        out.minHp = Math.min(out.minHp, api.duel.heroHp);
        if (opts.heal && api.duel.heroHp > 0) api.duel.setPlayerHp(api.duel.heroMax);
        const d = Math.hypot(hero.x - to.x, hero.z - to.z);
        if (d < 1) { result = 'reached'; break; }
        if (f % 30 === 0) {
          still = hero.distanceTo(last) < 0.1 ? still + 1 : 0;
          last.copy(hero);
          if (!hm.moveTo && d >= 1) { result = d < 3 ? 'ended near' : 'ended far'; break; }
          if (still >= 4) { result = 'stuck'; break; }
        }
        if (f % 600 === 0) await tick();
      }
      out.legs.push({ to: typeof raw === 'string' ? raw : [r2(to.x), r2(to.z)], result, seconds: r2(f / 60), from: [r2(start.x), r2(start.z)], at: [r2(hero.x), r2(hero.z)], off: r2(Math.hypot(hero.x - to.x, hero.z - to.z)) });
      out.seconds += f / 60;
    }
    out.falls = game.run.falls - falls0;
    out.seconds = r2(out.seconds);
    return out;
  };

  const mix = () => [...game.zone.packs.values()].map((p) => `${p.id}:${p.state}`).join(' ');
  window._worldBench = async (label, frames = 240, opts = {}) => {
    const runs = [];
    for (let r = 0; r < (opts.runs ?? 3); r++) {
      const step = [], render = [], whole = [], fin = [], calls = [], tris = [];
      for (let i = 0; i < frames; i++) {
        window.__glCounts = { calls: 0, tris: 0 };
        const t0 = performance.now();
        game ? frame() : api.step(1 / 60);
        const t1 = performance.now();
        vfx.render();
        const t2 = performance.now();
        gl?.finish();
        const t3 = performance.now();
        step.push(t1 - t0); render.push(t2 - t1); whole.push(t2 - t0); fin.push(t3 - t0);
        calls.push(window.__glCounts.calls); tris.push(window.__glCounts.tris);
        if (i % 120 === 119) await tick();
      }
      runs.push({ stepMed: r2(median(step)), renderMed: r2(median(render)), medMs: r2(median(whole)), p95Ms: r2(sorted(whole)[Math.floor(frames * 0.95)]), worstMs: r2(Math.max(...whole)), finishMedMs: r2(median(fin)), calls: Math.round(median(calls)), tris: Math.round(median(tris)) });
    }
    window.__glCounts = counts;
    return { label, frames, runs, packs: game ? mix() : '' };
  };
  window._worldBench.duel = async (o = {}) => {
    await setup();
    api.view.paused = true;
    if (api.duel.on) api.duel.stop();
    game = null;
    vfx.setHeroMode(true);
    vfx.heroPickCtrl.setValue('Lyra');
    vfx.duel.opponentChoice = 'Bram';
    vfx.duel.arenaChoice = o.arena ?? 'harbour';
    vfx.duel.start('run');
    for (let i = 0; i < 360; i++) api.step(1 / 60);
    return window._worldBench(`duel on ${o.arena ?? 'harbour'}`, o.frames ?? 240, o);
  };
  window._worldPath = () => {
    const arena = api.arena, V = arena.caster.group.position.constructor, from = new V(), to = new V(), P = mod.zone.PLACES;
    const out = [];
    for (const [a, b] of [['camp', 'caves'], ['market', 'lighthouse'], ['wreck', 'caves'], ['camp', 'lighthouse']]) {
      from.set(P[a].x, 0, P[a].z); to.set(P[b].x, 0, P[b].z);
      const t = [];
      for (let k = 0; k < 3; k++) { const t0 = performance.now(); arena.route({}, from, to); t.push(performance.now() - t0); }
      out.push({ leg: `${a} -> ${b}`, msFirst3: t.map(r2) });
    }
    return out;
  };
})();
