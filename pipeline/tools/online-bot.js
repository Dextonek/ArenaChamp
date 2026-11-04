// Paste into two tabs of the game page under the dev server (http://localhost:5173/game.html), through the browser javascript tool.
// Plays real network duels through the real server with bots, to find what only breaks with two screens. No person is needed, and
// hidden tabs keep running.
//
//   eval(await (await fetch('/pipeline/tools/online-bot.js')).text());
//   await _botLogin();            // a throwaway account, name v5bot<random>; delete these from server/data/accounts.json afterwards
//   _botQueue('Mr. Ledger');      // joins the queue with this hero; the other tab joins with its own
//   _botLog()                     // what this screen saw: rounds, both HP bars, casts, errors
//   _botStop()
(() => {
  const log = { errors: [], casts: [0, 0, 0, 0], attacks: 0, rounds: [], samples: [], hero: '', foe: '', ended: null };
  window._botErrors = log.errors;
  const oe = console.error;
  console.error = (...a) => { if (log.errors.length < 20) log.errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 500)); oe(...a); };
  window.addEventListener('error', (e) => { if (log.errors.length < 20) log.errors.push(`ERR ${e.message}`); });
  window._botLog = () => JSON.stringify(log);

  window._botLogin = async () => {
    const { net, state } = window.game;
    const name = `v5bot${Math.random().toString(36).slice(2, 8)}`;
    state.profile = null; // a remembered login may already be in; each tab plays as its own new account
    net.send({ t: 'register', name, password: crypto.randomUUID() });
    for (let i = 0; i < 80 && !state.profile; i++) await new Promise((r) => setTimeout(r, 100));
    if (!state.profile) throw new Error('not logged in: see the page for the server message');
    log.name = name;
    return name;
  };

  let timer = 0;
  window._botQueue = (hero) => {
    log.hero = hero;
    window.game.net.send({ t: 'queue_join', hero });
    clearInterval(timer);
    timer = setInterval(step, 100);
    return 'queued';
  };
  window._botStop = () => { clearInterval(timer); clearInterval(series); return 'stopped'; };

  // A list of heroes, one match each: the other tab runs its own list, and the queue pairs them in order.
  //   _botSeries(['Bram', 'Gus']);  _botLog()  -> matches: per match who fought, casts, and the HP this screen saw at each sample
  let series = 0;
  window._botSeries = (heroes) => {
    log.matches = [];
    const left = [...heroes];
    let playing = false;
    clearInterval(series);
    series = setInterval(() => {
      const { match, state, api } = window.game;
      if (match.active) {
        playing = true;
        // The result card waits for a click on "Back to menu".
        if (api.duel.over && window._botShort && log.rounds.length >= 1) match.exit();
        return;
      }
      if (state.queue.on) return;
      if (playing) {
        playing = false;
        log.matches.push({ hero: log.hero, foe: log.foe, casts: [...log.casts], attacks: log.attacks, rounds: log.rounds.length, samples: log.samples.slice(-6), errors: log.errors.length });
        log.casts = [0, 0, 0, 0]; log.attacks = 0; log.rounds = []; log.samples = []; lastRound = -1;
      }
      const next = left.shift();
      if (!next) { clearInterval(series); clearInterval(timer); log.seriesDone = true; return; }
      window._botQueue(next);
    }, 500);
    return 'series started';
  };

  let lastRound = -1, lastSample = 0;
  function step() {
    const { api, match, state } = window.game;
    const d = api.duel, hm = api.heroMode, arena = api.arena;
    if (!match.active || !d.on) { if (log.rounds.length) log.ended = true; return; }
    log.foe = match.current?.foe?.hero ?? log.foe;
    const foe = d.foe;
    if (!foe) return;
    const now = performance.now();
    const me = arena.caster.group.position, at = foe.group.position;
    const dist = Math.hypot(me.x - at.x, me.z - at.z);
    if (now - lastSample > 2000) {
      lastSample = now;
      if (log.samples.length >= 60) log.samples.shift();
      log.samples.push({ me: Math.round(d.playerHp), foe: Math.round(arena.hpOf(foe)), dist: +dist.toFixed(1), over: !!d.over, res: d.result?.winner ?? null, kit: hm.currentKit.name });
    }
    if (d.time > 0.5 && d.round !== lastRound) {
      lastRound = d.round;
      log.rounds.push(d.round);
      // One round is enough to test a hero: `_botShort = true` ends the match when the second round starts.
      if (window._botShort && log.rounds.length >= 2) { window.game.net.send({ t: 'match_leave' }); return; }
    }
    if (d.over || d.waiting || d.countdown > 0 || hm.locked) return;
    const st = arena.statusOf(arena.caster);
    if (!st?.cannotCast) {
      for (let i = 3; i >= 0; i--) {
        if (!hm.ready(i)) continue;
        const spell = hm.currentKit.spells[i];
        const spec = d.host.targeting(spell.label);
        if (!spec) continue;
        if (spec.mode !== 'self' && dist > spell.range) continue;
        const target = spec.mode === 'enemy' || spec.mode === 'enemies' ? { enemy: foe } : { point: at.clone() };
        if (hm.autoCast(i, target)) { log.casts[i]++; return; }
      }
    }
    if (hm.attackWinding) return;
    if (hm.autoAttack(foe)) { log.attacks++; return; }
    // Walk to the enemy through the normal order, the way a right click does.
    if (dist > 3 && !st?.cannotMove) {
      const dx = at.x - me.x, dz = at.z - me.z, k = (4 * 0.1) / dist;
      arena.walk(new at.constructor(dx * k, 0, dz * k), Infinity, true);
    }
  }
})();
