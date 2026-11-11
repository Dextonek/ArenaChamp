// A hand on the game page's hero: casts what is ready, attacks, walks to the enemy (as pipeline/tools/online-bot.js's step
// does), and keeps a record of what this screen saw. `window._drv.mode`: 'all' plays every spell, 'quills' only lays embers and
// stands (so the CPU fells her with a nest burning), 'off' does nothing.
(() => {
  const log = { mode: 'off', casts: [0, 0, 0, 0], attacks: 0, errors: [], rises: 0, riseHp: [], ashSeen: 0, foeRises: 0, embersMax: 0, fights: 0 };
  window._drv = log;
  const oe = console.error;
  console.error = (...a) => { if (log.errors.length < 30) log.errors.push(a.map((x) => String(x?.stack ?? x)).join(' ').slice(0, 500)); oe(...a); };
  window.addEventListener('error', (e) => { if (log.errors.length < 30) log.errors.push(`ERR ${e.message}`); });
  window.addEventListener('unhandledrejection', (e) => { if (log.errors.length < 30) log.errors.push(`REJ ${String(e.reason?.stack ?? e.reason).slice(0, 400)}`); });
  let wasReborn = 0, foeReborn = 0, wasAsh = 0;
  window._drvState = () => {
    const { api } = window.game, d = api.duel, hm = api.heroMode, a = api.arena, rt = d.heroRt, ot = d.oppRt;
    const emb = (r) => (r?.trait?.meter?.name === 'EMBERS' ? r.trait.meter.value(r) : null);
    return {
      on: d.on, over: d.isOver, result: d.result?.winner ?? null, waiting: !!d.waiting, countdown: d.countdown, locked: hm.locked,
      hero: hm.currentKit?.name, foe: d.opponentChoice, hp: Math.round(d.playerHp ?? 0), foeHp: d.foe ? Math.round(a.hpOf(d.foe)) : null,
      time: +(d.time ?? 0).toFixed(1), embers: emb(rt), foeEmbers: emb(ot),
      ash: rt?.mem?.ash ? 1 : 0, reborn: rt?.mem?.reborn ? 1 : 0, foeAsh: ot ? ot.own?.('ash') ?? 0 : 0, foeRebornMem: ot?.mem?.reborn ? 1 : 0,
    };
  };
  setInterval(() => {
    const { api } = window.game;
    const d = api.duel, hm = api.heroMode, arena = api.arena;
    if (!d.on || d.isOver) { wasReborn = 0; foeReborn = 0; wasAsh = 0; return; }
    const foe = d.foe;
    if (!foe) return;
    const rt = d.heroRt, ot = d.oppRt;
    // Her second life, as this screen sees it: on her own side and on the CPU's.
    if (rt?.mem?.reborn && !wasReborn) log.rises++;
    wasReborn = rt?.mem?.reborn ? 1 : 0;
    if (wasAsh && !rt?.mem?.ash) log.riseHp.push(Math.round(d.playerHp));
    wasAsh = rt?.mem?.ash ? 1 : 0;
    if (wasAsh) log.ashSeen++;
    if (ot?.mem?.reborn && !foeReborn) log.foeRises++;
    foeReborn = ot?.mem?.reborn ? 1 : 0;
    const embers = rt?.trait?.meter?.name === 'EMBERS' ? rt.trait.meter.value(rt) : 0;
    log.embersMax = Math.max(log.embersMax, embers);
    if (log.mode === 'off') return;
    if (d.waiting || d.countdown > 0 || hm.locked) return;
    const me = arena.caster.group.position, at = foe.group.position;
    const dist = Math.hypot(me.x - at.x, me.z - at.z);
    const st = arena.statusOf(arena.caster);
    const anka = hm.currentKit.name === 'Anka';
    if (!st?.cannotCast) {
      for (let i = 3; i >= 0; i--) {
        if (log.mode === 'quills' && i !== 0) continue;
        if (!hm.ready(i)) continue;
        const spell = hm.currentKit.spells[i];
        const spec = d.host.targeting(spell.label);
        if (!spec) continue;
        if (spec.mode !== 'self' && dist > spell.range) continue;
        // Fan the Flames and Ember Flight want an ember; without one they would be thrown away.
        if (anka && (i === 1 || i === 2) && embers === 0) continue;
        const target = spec.mode === 'enemy' || spec.mode === 'enemies' ? { enemy: foe } : { point: at.clone() };
        if (hm.autoCast(i, target)) { log.casts[i]++; return; }
      }
    }
    if (log.mode === 'quills') return;
    if (hm.attackWinding) return;
    if (hm.autoAttack(foe)) { log.attacks++; return; }
    if (dist > 3 && !st?.cannotMove) {
      const dx = at.x - me.x, dz = at.z - me.z, k = (4 * 0.1) / dist;
      arena.walk(new at.constructor(dx * k, 0, dz * k), Infinity, true);
    }
  }, 100);
})();
