// Paste into the VFX tool page under the dev server (browser javascript tool), or run headless with page-shots.py. Forces each of the
// Eclipse Wyrm's moves in a stepped fight and checks its rules: what it costs in the zone, that the way out works, Pin the Tail, the
// stage (Shadows Stand), the disc that rolls, and then the real brain through all three phases (pipeline/designs/raid-wyrm.md).
//
//   eval(await (await fetch('/pipeline/tools/wyrm-check.js')).text());
//   await _raidWyrm()    // { ok, failed: [...], rows: [...] }
(() => {
  window._raidWyrm = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { ECLIPSE_WYRM: def } = await import('/src/raid/wyrm.ts');
    const { WYRM_LIVE } = await import('/src/raid/bodies/wyrm.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const { RAID_RUN, RAID_REWARDS } = await import('/server/protocol.mjs');
    const V = a.caster.group.position.constructor;
    const rows = [], failed = [];
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const check = (name, got, want, tol = 0.012) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+(+got).toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    const yes = (name, v) => check(name, v ? 1 : 0, 1, 0);
    // The boss stands in the middle of the Roost, facing south (+z), where the heroes come in.
    const H = { x: 0, z: 7 };
    let seq = 9000;
    const errors = [];
    const logError = console.error;
    console.error = (...m) => { errors.push(m.map(String).join(' ')); logError(...m); };
    const fresh = () => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'wyrm', mode: 'play' });
      d.boss.brain.pause = 1e9;
      // Wingshade comes by the clock, whatever the brain's pause: none of its own here.
      d.boss.brain.timedDone = 1e9;
      d.countdown = -1;
      a.placeFoe(d.foe, new V(H.x, 0, H.z));
      step(0.05);
    };
    const place = (x, z) => a.caster.group.position.set(x, 0, z);
    /** A spot `r` m from the boss at `deg` degrees from its front (0 south, toward the heroes; 90 its left, +x). */
    const polar = (deg, r) => ({ x: H.x + Math.sin((deg * Math.PI) / 180) * r, z: H.z + Math.cos((deg * Math.PI) / 180) * r });
    const cast = (move, o = {}) => {
      const me = a.caster.group.position, x = o.x ?? me.x, z = o.z ?? me.z;
      const c = { id: ++seq, move, step: o.step ?? 0, x, z, fx: H.x, fz: H.z, dir: o.dir ?? Math.atan2(x - H.x, z - H.z), seed: o.seed ?? 4242, target: 0 };
      d.boss.link.cast(c);
      return c;
    };
    const live = (id) => d.boss.script.active.find((x) => x.cast.id === id);
    const lost = () => (d.playerMax - d.playerHp) / d.playerMax;
    const take = (fn, s) => { d.playerHp = d.playerMax; fn(); step(s); return lost(); };
    const gauge = () => d.boss.link.gauge ?? 0;
    try {
      // The run and the hub.
      yes('the run is four bosses, the wyrm last', RAID_RUN.length === 4 && RAID_RUN[3] === 'wyrm');
      yes('its rewards: the pin +40, the stage a kneel', RAID_REWARDS.wyrm.pin.stagger === 40 && RAID_REWARDS.wyrm.stand.kneel === true);
      yes('every move\'s name passes the hub', Object.keys(def.moves).every((id) => /^[a-z]{1,16}$/.test(id)));
      fresh();
      yes('the Roost: its own room, 14 m', d.currentArena?.id === 'roost' && def.place.ring === 14);

      // Claw Rake: three lanes fanning from its front, from 3.2 m out. On one: hit; in a gap further out, under its chin, behind it: not.
      const S = 0; // its front: the cast aims south, at the hero
      let p0 = polar(S, 7);
      place(p0.x, p0.z);
      check('rake: on the middle lane', take(() => cast('rake'), 2), 0.16);
      p0 = polar(S + 13, 9);
      place(p0.x, p0.z);
      check('rake: in the gap between two lanes, 9 m out', take(() => cast('rake', { dir: 0 }), 2), 0);
      p0 = polar(S, 2.3);
      place(p0.x, p0.z);
      check('rake: under its chin, inside where the lanes start', take(() => cast('rake', { dir: 0 }), 2), 0);
      p0 = polar(180, 5);
      place(p0.x, p0.z);
      check('rake: behind it', take(() => cast('rake', { dir: 0 }), 2), 0);

      // Tail Sweep: its back toward the hero it aims at; 230 degrees round its back, 7 m. In front of it, or far: nothing.
      fresh();
      p0 = polar(0, 4.5);
      place(p0.x, p0.z);
      // Facing away from the hero (north): the hero is behind it.
      check('tail: behind it', take(() => cast('tail', { dir: Math.PI }), 2), 0.2);
      p0 = polar(180, 4);
      place(p0.x, p0.z);
      check('tail: in front of its face', take(() => cast('tail', { dir: Math.PI }), 2), 0);
      p0 = polar(0, 8.5);
      place(p0.x, p0.z);
      check('tail: past its reach', take(() => cast('tail', { dir: Math.PI }), 2), 0);
      p0 = polar(80, 4.5);
      place(p0.x, p0.z);
      check('tail: beside it, the sweep reaches round', take(() => cast('tail', { dir: Math.PI }), 2), 0.2);

      // Pin the Tail: the tip a gold spot 6.2 m behind it after the sweep. Held 1.5 s: +40 on the gauge, once a sweep.
      fresh();
      p0 = polar(0, 9);
      place(p0.x, p0.z);
      let c = cast('tail', { dir: Math.PI, x: H.x, z: H.z });
      step(0.05);
      const pin = live(c.id).played.objectives[0];
      check('pin: its spot is 6.2 m behind it', Math.hypot(pin.x - H.x, pin.z - H.z), 6.2, 0.01);
      place(pin.x, pin.z);
      step(0.6);
      yes('pin: not before the sweep lands', !pin.done);
      const g0 = gauge();
      step(1.1 + 1.6);
      yes('pin: held after the sweep, it is pinned', pin.done === true);
      check('pin: +40 on the gauge', gauge() - g0, 40, 0);
      step(2);
      check('pin: once a sweep', gauge() - g0, 40, 0);

      // Shadow Breath: a cone sweeping 130 degrees across its front, once a cast; behind it, beyond 11 m: nothing.
      fresh();
      p0 = polar(0, 6);
      place(p0.x, p0.z);
      check('breath: in its path, hit once for the whole sweep', take(() => cast('breath', { dir: 0 }), 4.2), 0.14);
      p0 = polar(180, 5);
      place(p0.x, p0.z);
      check('breath: behind it', take(() => cast('breath', { dir: 0 }), 4.2), 0);
      p0 = polar(20, 12);
      place(p0.x, p0.z);
      check('breath: past its reach', take(() => cast('breath', { dir: 0 }), 4.2), 0);
      {
        fresh();
        place(polar(0, 6).x, polar(0, 6).z);
        c = cast('breath', { dir: 0 });
        step(0.05);
        const th = live(c.id).played.threats.find((t) => t.hits);
        // Where its fire is at the start and at the end of the sweep: on the two sides of its front.
        const firstAt = [-60, 60].find((deg) => th.hits(polar(deg, 6).x, polar(deg, 6).z, th.at + 0.02));
        const lastAt = [-60, 60].find((deg) => th.hits(polar(deg, 6).x, polar(deg, 6).z, th.to - 0.02));
        yes('breath: it sweeps from one side of its front to the other', firstAt !== undefined && lastAt !== undefined && firstAt === -lastAt);
        // Standing on the side it ends on and walking round behind it before then: nothing.
        place(polar(lastAt, 6).x, polar(lastAt, 6).z);
        d.playerHp = d.playerMax;
        step(th.at + 0.3);
        place(polar(180, 6).x, polar(180, 6).z);
        step(2.5);
        check('breath: on the side it ends, then behind it', lost(), 0);
      }

      // Wingshade: the whole roof burns but under its wings (4.8 m).
      fresh();
      p0 = polar(30, 3.2);
      place(p0.x, p0.z);
      check('shade: under its wings', take(() => cast('shade', { x: H.x, z: H.z }), 4), 0);
      p0 = polar(30, 8);
      place(p0.x, p0.z);
      check('shade: out on the roof', take(() => cast('shade', { x: H.x, z: H.z }), 4), 0.38);

      // Tearfall: each shard where the hero stood; a step aside is enough.
      fresh();
      place(0, 14);
      check('rain: where you stand', take(() => cast('rain', { x: 0, z: 14 }), 1.8), 0.14);
      place(2.8, 14);
      check('rain: a step aside', take(() => cast('rain', { x: 0, z: 14 }), 1.8), 0);

      // Wing Gust: a cone in front, and a push back.
      fresh();
      p0 = polar(0, 5);
      place(p0.x, p0.z);
      d.playerHp = d.playerMax;
      cast('gust', { dir: 0 });
      step(1.9);
      check('gust: in front', lost(), 0.12);
      check('gust: thrown back from 5 m (m from it)', Math.hypot(a.caster.group.position.x - H.x, a.caster.group.position.z - H.z), 8, 2.6);
      p0 = polar(180, 5);
      place(p0.x, p0.z);
      check('gust: behind it', take(() => cast('gust', { dir: 0 }), 1.9), 0);

      // The Eclipse Rolls: its disc out along the line through where you stood and back, once a cast.
      fresh();
      p0 = polar(0, 8);
      place(p0.x, p0.z);
      d.playerHp = d.playerMax;
      c = cast('roll', { x: p0.x, z: p0.z });
      step(0.05);
      const roll = live(c.id).played.threats.find((t) => t.hits);
      step(roll.at + 0.4);
      yes('roll: the disc is off its brow while it rolls', WYRM_LIVE.disc === false);
      step(roll.to - roll.at + 0.6);
      check('roll: on its line, hit once though it passes twice', lost(), 0.18);
      yes('roll: the disc back on its brow after', WYRM_LIVE.disc === true);
      p0 = polar(25, 8);
      place(p0.x, p0.z);
      check('roll: off its line', take(() => cast('roll', { x: polar(0, 8).x, z: polar(0, 8).z }), 4.5), 0);

      // Shadows Stand, the stage: it hovers, can't be hurt, three shades; cut down, it kneels and lands.
      fresh();
      place(0, 14);
      c = cast('stand', { x: H.x, z: H.z });
      step(1);
      yes('stand: it takes wing', WYRM_LIVE.hover === true);
      check('stand: three Cast shades', a.summons.alive('opponent').length, 3, 0);
      const hp0 = a.hpOf(d.foe);
      a.hit(d.foe, { damage: 50, knock: 0 });
      check('stand: it can\'t be hurt', hp0 - a.hpOf(d.foe), 0, 0);
      for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 9999, knock: 0 });
      step(0.2);
      yes('stand: the shades cut down, it kneels', d.boss.stats.kneels === 1);
      step(3);
      yes('stand: and it is down from the air', WYRM_LIVE.hover === false);

      // The real brain, all three phases: its moves come, Wingshade by the clock, the stage and the disc as openers, no errors.
      fresh();
      place(0, 13);
      const seen = [], on = d.boss.link.on;
      d.boss.link.on = { ...on, cast: (x) => { seen.push(x); on.cast(x); } };
      d.boss.brain.pause = 0;
      d.boss.brain.wait = 0;
      d.boss.brain.timedDone = 0;
      const hitTo = (share) => { for (let i = 0; i < 900 && a.hpOf(d.foe) / def.hp.solo > share; i++) a.hit(d.foe, { damage: 10, knock: 0 }); };
      for (let i = 0; i < 30; i++) { d.playerHp = d.playerMax; step(1); }
      yes('Shadowfall: rake, tail and breath from the brain', ['rake', 'tail', 'breath'].every((m) => seen.some((x) => x.move === m)));
      yes('Shadowfall: Wingshade by the clock', seen.some((x) => x.move === 'shade'));
      hitTo(0.65);
      yes('Taking Wing at 66 %', d.boss.stats.phases === 1);
      for (let i = 0; i < 6; i++) { d.playerHp = d.playerMax; step(1); }
      yes('Taking Wing: the brain opens the stage', seen.some((x) => x.move === 'stand' && x.step === 0));
      for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 9999, knock: 0 });
      for (let i = 0; i < 40; i++) { d.playerHp = d.playerMax; step(1); }
      yes('Taking Wing: Tearfall or Wing Gust come', seen.some((x) => x.move === 'rain' || x.move === 'gust'));
      hitTo(0.32);
      yes('Totality at 33 %', d.boss.stats.phases === 2);
      for (let i = 0; i < 8; i++) { d.playerHp = d.playerMax; step(1); }
      yes('Totality: it opens with the disc rolling', seen.some((x) => x.move === 'roll'));
      for (let i = 0; i < 25; i++) { d.playerHp = d.playerMax; step(1); }
      const HUB = ['id', 'move', 'step', 'x', 'z', 'fx', 'fz', 'dir', 'seed', 'target', 'alone', 'rim', 'form', 'flag', 'which', 'mate'];
      yes('every cast it sent has only what the hub passes on', seen.every((x) => Object.keys(x).every((k) => HUB.includes(k)) && [x.id, x.step, x.x, x.z, x.fx, x.fz, x.dir, x.seed, x.target].every(Number.isFinite)));
      check('no errors in the page', errors.length, 0, 0);
      rows.push(`     casts seen: ${[...new Set(seen.map((x) => x.move))].join(', ')}`);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    console.error = logError;
    delete performance.now;
    return { ok: !failed.length, failed, rows, errors: errors.slice(0, 5) };
  };
})();
