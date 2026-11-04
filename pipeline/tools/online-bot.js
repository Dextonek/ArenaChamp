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
  window._botStop = () => { clearInterval(timer); return 'stopped'; };

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
      if (log.samples.length < 60) log.samples.push({ me: Math.round(d.playerHp), foe: Math.round(arena.hpOf(foe)), dist: +dist.toFixed(1), over: !!d.over, res: d.result?.winner ?? null, kit: hm.currentKit.name });
    }
    if (d.round !== lastRound) { lastRound = d.round; log.rounds.push(d.round); }
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
