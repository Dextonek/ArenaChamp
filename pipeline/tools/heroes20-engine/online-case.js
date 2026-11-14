// The test layer of the two-screen check (online.py injects it into both game pages before they queue). It puts rules in front
// of Lyra's and Isolde's own that use every engine message, each decided where pipeline/designs/heroes20-engine.md says:
//   sleep (#z):  every 3rd hit of Lyra's (spell or attack) puts Isolde to sleep 1.2 s (decided on Isolde's screen)
//   seal (#s):   every 2nd spell hit of Isolde's seals Lyra's W for 3 s            (on Lyra's screen)
//   leash (#l):  every 4th hit of Lyra's leashes Isolde to her, 5 m, 3 s           (on Isolde's screen)
//   token (#k):  a circlet starts on Lyra; a spell hit by its holder passes it on   (on the screen of the one hit)
//   cover (#c):  every 4 s Isolde's client takes 60 off the arena cover nearest her (on Isolde's screen)
//   wards:       each Q of Lyra's raises a ward across its way, from the cast        (built on both screens)
// and samples what this screen has of each, ten times a second, by hero name: window._mech.
(async () => {
  const T = await import('/src/traits/index.ts');
  const d = game.api.duel, a = game.api.arena, hm = game.api.heroMode, m = d.mech;
  const base = { Lyra: T.TRAITS.Lyra, Isolde: T.TRAITS.Isolde };
  const count = { lyra: 0, isolde: 0 };
  const sideOf = (name) => (hm.currentKit.name === name ? 'hero' : 'opponent');
  const pass = (t, hit) => {
    const tok = t.mech?.token('c', sideOf('Lyra'));
    if (tok && tok.holder === t.side) tok.claim(t.mech.enemySide, undefined, t.time);
  };
  const spellHit = (hit) => hit.kind === 'spell' && hit.victimIsHero && !hit.blocked;
  T.TRAITS.Lyra = {
    ...base.Lyra,
    marks(t) { t.mech?.token('c', sideOf('Lyra')); return base.Lyra.marks?.(t) ?? []; },
    dealt(t, hit) {
      base.Lyra.dealt?.(t, hit);
      if (!hit.victimIsHero || hit.blocked || (hit.kind !== 'spell' && hit.kind !== 'attack')) return;
      count.lyra++;
      if (count.lyra % 3 === 0) window._tries.push(['sleep', +t.time.toFixed(2), t.mech.sleepEnemy(1.2)]);
      if (count.lyra % 4 === 0) window._tries.push(['leash', +t.time.toFixed(2), !!t.mech.leashEnemy(5, 3)]);
      if (spellHit(hit)) pass(t, hit);
    },
  };
  T.TRAITS.Isolde = {
    ...base.Isolde,
    marks(t) { t.mech?.token('c', sideOf('Lyra')); return base.Isolde.marks?.(t) ?? []; },
    dealt(t, hit) {
      base.Isolde.dealt?.(t, hit);
      if (!spellHit(hit)) return;
      count.isolde++;
      if (count.isolde % 2 === 0) t.mech.sealEnemy(1, 3);
      pass(t, hit);
    },
    tick(t, dt) {
      base.Isolde.tick?.(t, dt);
      t.mem.coverT = (t.mem.coverT ?? 0) + dt;
      if (t.mem.coverT < 4) return;
      t.mem.coverT = 0;
      const p = t.self().group.position;
      const near = t.mech.coverNear(p, 30).map((i) => ({ i, o: t.arenaCover()[i] })).sort((x, y) => Math.hypot(x.o.ax - p.x, x.o.az - p.z) - Math.hypot(y.o.ax - p.x, y.o.az - p.z))[0];
      if (near) t.mech.hurtCover(near.i, 60, { x: p.x, z: p.z });
    },
  };
  // Wards from Lyra's Q: built from the cast's own numbers on both screens (as a spell would build it).
  const note = m.noteCast.bind(m);
  m.noteCast = (side, slot, from, point) => {
    note(side, slot, from, point);
    const name = side === 'hero' ? hm.currentKit.name : d.opponentKit.name;
    if (name !== 'Lyra' || slot !== 0) return;
    const mx = (from.x + point.x) / 2, mz = (from.z + point.z) / 2, dx = point.x - from.x, dz = point.z - from.z, L = Math.hypot(dx, dz) || 1;
    m.ward({ x: mx - (dz / L) * 1.5, z: mz + (dx / L) * 1.5 }, { x: mx + (dz / L) * 1.5, z: mz - (dx / L) * 1.5 }, 3);
  };
  window._mech = [];
  window._tries = [];
  window._msgs = [];
  { const n = game.net, send = n.send.bind(n); n.send = (msg) => { if (msg.t === 'stacks' && msg.name[0] === '#') window._msgs.push([Date.now(), 'out', msg.name, msg.n]); return send(msg); };
    n.on('peer_stacks', (msg) => { if (msg.name[0] === '#') window._msgs.push([Date.now(), 'in', msg.name, msg.n]); }); }
  setInterval(() => {
    const { match } = game;
    if (!match.active || !d.on || !d.foe || d.over) return;
    const L = sideOf('Lyra'), I = sideOf('Isolde');
    const tok = m.tokens?.get('c');
    const holder = tok ? (tok.holder ? (tok.holder === L ? 'Lyra' : 'Isolde') : 'ground') : 'none';
    const cover = (d.currentArena?.obstacles ?? []).map((o) => (a.obstacles?.includes(o) ? 1 : 0)).join('');
    const wards = m.wardsNow().filter((w) => w.alive).map((w) => `${w.a.x.toFixed(1)},${w.a.z.toFixed(1)}`).sort().join(' ');
    const leash = m.leashesOf(I).length + (m.shownLeashes ?? []).filter((l) => l.side === I && l.until > d.time).length;
    const lyra = L === 'hero' ? d.playerHp : a.hpOf(d.foe), isolde = I === 'hero' ? d.playerHp : a.hpOf(d.foe);
    window._mech.push({ w: Date.now(), round: d.round, t: +d.time.toFixed(2), asleep: m.asleep(I) ? 1 : 0, sealed: m.sealedLeft(L, 1) > 0 ? 1 : 0, holder, version: tok?.state.version ?? 0, leash: leash ? 1 : 0, cover, wards, lyra: Math.round(lyra), isolde: Math.round(isolde) });
  }, 100);
})();
