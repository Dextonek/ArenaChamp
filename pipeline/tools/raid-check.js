// Paste into the VFX tool page under the dev server (browser javascript tool). Forces each boss move in a stepped fight
// and checks its rules: what it costs in the zone, that walking out dodges it, what cover does, and the boss's own rules.
//
//   eval(await (await fetch('/pipeline/tools/raid-check.js')).text());
//   await _raidCheck()    // { ok, failed: [...], rows: [...] }
//   await _raidHeart()    // the same for the Heart of Noon: its moves, Hold Still, Lock a ring and Shade the heart, alone and with a partner
//                         // and for a party in the Sunburst, its own room (bands 5, 10 and 40)
(() => {
  // Every hero's four spells and basic attack replayed as a partner: nothing in them may touch this screen's hero or the boss.
  //   _raidPartners(['Lyra', 'Bram'])  in the background; _raidPartners.result() when done
  let partners = { done: true, rows: [], errors: [] };
  window._raidPartners = (names) => {
    if (!partners.done) return 'already running';
    partners = { done: false, rows: [], errors: [], n: 0 };
    const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
    (async () => {
      const d = vfx.duel, a = vfx.arena;
      const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
      const { LocalLink } = await import('/src/raid/link.ts');
      const { HERO_KITS } = await import('/src/heroes.ts');
      const V = a.caster.group.position.constructor;
      let simMs = performance.now();
      performance.now = () => simMs;
      const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
      const logError = console.error;
      let now = '';
      console.error = (...x) => { if (partners.errors.length < 20) partners.errors.push(`${now}: ${x.map((v) => String(v?.stack ?? v)).join(' ').slice(0, 300)}`); logError(...x); };
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      d.holdStart = false;
      try {
        for (const name of names) {
          const kit = HERO_KITS.find((k) => k.name === name);
          vfx.heroPickCtrl.setValue(name === 'Lyra' ? 'Bram' : 'Lyra');
          for (let slot = 0; slot < 5; slot++) {
            now = `${name} slot ${slot}`;
            // A fresh fight: the hero to one side and the partner to the other, the boss between them.
            const link = new LocalLink(def);
            d.startBoss({ def, link, seed: 'partners', mode: 'play', name: 'me', partner: { kit, name: 'partner' } });
            d.boss.brain.pause = 1e9;
            a.placeFoe(d.foe, new V(0, 0, 7.5 + 1));
            a.obstacles = [];
            const me = a.caster.group.position;
            me.set(-6, 0, 11);
            d.partnerMove(6, 11, 0, undefined);
            step(0.2);
            const before = { hp: d.playerHp, boss: a.hpOf(d.foe), x: me.x, z: me.z, units: a.summons.alive('opponent').length + a.summons.alive('hero').length };
            if (slot < 4) {
              const spell = kit.spells[slot], spec = vfx.targeting?.(spell.label);
              const b = d.foe.group.position;
              d.partnerCast({ id: 1, slot, x: b.x, z: b.z, fx: 6, fz: 11, enemy: true, yaw: Math.atan2(b.x - 6, b.z - 11), bend: spell.aim === 'arc' ? 0.6 : undefined });
              void spec;
            } else d.partnerAttack();
            step(3.5);
            const st = a.statusOf(a.caster);
            const row = {
              hp: d.playerHp - before.hp, boss: a.hpOf(d.foe) - before.boss, moved: Math.hypot(me.x - before.x, me.z - before.z),
              status: !!st && (st.stunned || st.cannotMove || st.cannotCast || st.speedMul !== 1), buffs: st?.activeBuffs().length ?? 0,
              units: a.summons.alive('opponent').length + a.summons.alive('hero').length - before.units,
            };
            partners.n++;
            if (row.hp || row.boss || row.moved > 0.001 || row.status || row.buffs || row.units) partners.rows.push({ name, slot, ...row });
            await tick();
          }
        }
      } catch (e) {
        partners.errors.push(`${now}: ${String(e?.stack ?? e)}`);
      }
      delete performance.now;
      console.error = logError;
      partners.done = true;
    })();
    return 'started';
  };
  window._raidPartners.result = () => partners;

  // Ash and Ember: each move forced in turn, what it costs and how to get out of it, the tag, and the lava at Together.
  //   await _raidAsh()   // { ok, failed, rows }
  window._raidAsh = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { ASH_AND_EMBER: def } = await import('/src/raid/ashEmber.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const V = a.caster.group.position.constructor;
    const rows = [], failed = [];
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const check = (name, got, want, tol = 0.012) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    const yes = (name, v) => check(name, v ? 1 : 0, 1, 0);
    let seq = 5000;
    const fresh = (bx = 0, bz = 3) => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'ash', mode: 'play' });
      d.boss.brain.pause = 1e9;
      d.boss.brain.rimWait = 1e9;
      a.placeFoe(d.foe, new V(bx, 0, bz));
      a.obstacles = a.obstacles.slice();
      step(0.05);
    };
    const place = (x, z) => a.caster.group.position.set(x, 0, z);
    const cast = (move, o = {}) => {
      const b = d.foe.group.position, me = a.caster.group.position;
      const x = o.x ?? me.x, z = o.z ?? me.z;
      d.boss.link.cast({ id: ++seq, move, step: o.step ?? 0, x, z, fx: o.fx ?? b.x, fz: o.fz ?? b.z, dir: o.dir ?? Math.atan2(x - b.x, z - b.z), seed: o.seed ?? 777, target: 0, form: o.form, flag: o.flag, alone: o.alone });
    };
    const lost = () => (d.playerMax - d.playerHp) / d.playerMax;
    const take = (fn, s) => { d.playerHp = d.playerMax; fn(); step(s); return lost(); };
    try {
      fresh();
      place(0, 6);
      check('slam: close', take(() => cast('slam'), 1.7), 0.18);
      place(0, 12);
      check('slam: backed away', take(() => cast('slam'), 1.7), 0);

      // Charge: a warning while he winds up, then a run through where you are that kills whatever it reaches. Only a pillar stops
      // it, and breaks; he is stunned. Each step as the brain sends it: aimed by the move's own aim, and his run its `act`.
      const { PILLARS } = await import('/src/arenas/cinderpit.ts');
      const charging = () => {
        const m = def.moves.charge, world = d.boss.script.world;
        const send = (n) => {
          const b = d.foe.group.position, me = a.caster.group.position;
          const aim = m.aim({ boss: { x: b.x, z: b.z }, ring: { x: b.x, z: b.z }, target: { x: me.x, z: me.z }, step: n, seed: 1, rayStop: (ax, az, bx, bz) => world.rayStop(ax, az, bx, bz), cover: () => world.cover() });
          const c = { id: ++seq, move: 'charge', step: n, x: aim.x, z: aim.z, fx: b.x, fz: b.z, dir: aim.dir, seed: 1, target: 0, flag: aim.flag };
          d.boss.link.cast(c);
          m.act(world, c);
          return c;
        };
        send(0);
        return { go: () => send(1) };
      };
      fresh(0, 1);
      place(-1, 9);
      d.playerHp = d.playerMax;
      let ch = charging();
      step(2.9);
      check('charge: the wind-up hits nobody', lost(), 0);
      yes('charge: an AI must hide from it', d.boss.script.mustHide);
      yes('charge: in the open, nowhere it can\'t reach', !d.boss.script.hidden(-1, 9));
      let run = ch.go();
      step(1);
      check('charge: in his way, it kills', lost(), 1);
      yes('charge: nothing in his way: he ran on to the rim, and no pillar broke', !run.flag && a.obstacles.length === PILLARS.length);
      // From him at (0, 1) toward the first pillar: 5 m from him in front of it, and 2.5 m behind it.
      const P0 = PILLARS[0], toP = Math.hypot(P0.ax, P0.az - 1), ux = P0.ax / toP, uz = (P0.az - 1) / toP;
      const front = { x: ux * (toP - 5), z: 1 + uz * (toP - 5) }, behind = { x: P0.ax + ux * 2.5, z: P0.az + uz * 2.5 };
      check('charge: four pillars in the pit', PILLARS.length, 4, 0);
      // In front of a pillar is no cover: he runs through you, and into it.
      fresh(0, 1);
      place(front.x, front.z);
      d.playerHp = d.playerMax;
      ch = charging();
      step(3);
      run = ch.go();
      step(1);
      check('charge: in front of a pillar, it kills', lost(), 1);
      // Alone, the fight ends there, before he reaches it.
      yes('charge: his run went on into the pillar behind you', run.flag === true);

      fresh(0, 1);
      // Behind the first pillar, as he sees it.
      place(behind.x, behind.z);
      d.playerHp = d.playerMax;
      ch = charging();
      step(2.9);
      yes('charge: behind a pillar, an AI may stay', d.boss.script.hidden(behind.x, behind.z));
      run = ch.go();
      step(1);
      check('charge: behind a pillar, it does not', lost(), 0);
      yes('charge: he hit the pillar', run.flag === true);
      check('charge: and it broke', a.obstacles.length, PILLARS.length - 1, 0);
      check('charge: he stopped up against it', Math.hypot(d.foe.group.position.x - PILLARS[0].ax, d.foe.group.position.z - PILLARS[0].az), PILLARS[0].r + 0.5 + 1, 0.3);
      yes('charge: stunned, he kneels and stands open', !!a.statusOf(d.foe).stunned && a.statusOf(d.foe).buff('vulnerable') === 0.5);
      step(5);
      // A broken pillar stops nothing: the same Charge again runs through where it stood.
      a.placeFoe(d.foe, new V(0, 0, 1));
      d.playerHp = d.playerMax;
      ch = charging();
      step(3);
      run = ch.go();
      step(1);
      check('charge: where a pillar broke, it kills', lost(), 1);
      fresh(0, 1);
      check('charge: a new fight, all of them stand again', a.obstacles.length, PILLARS.length, 0);
      // No shield or toughness holds it.
      place(1.5, 9);
      d.playerHp = d.playerMax;
      a.shieldFigure(a.caster, 5000, 20, '#ffffff');
      ch = charging();
      step(3);
      ch.go();
      step(1);
      check('charge: through a shield, it still kills', lost(), 1);

      fresh(0, 3);
      place(0, 14);
      const before = a.caster.group.position.z;
      d.playerHp = d.playerMax;
      cast('drag');
      step(1);
      yes('drag: pulls the hero in', a.caster.group.position.z < before - 1);
      fresh(0, 3);
      place(0, 14);
      check('drag: far from him, the ring burns', take(() => cast('drag'), 2.2), 0.16);
      fresh(0, 3);
      place(0, 6);
      check('drag: close to him, it does not', take(() => cast('drag'), 2.2), 0);

      fresh(0, 3);
      place(0, 8);
      d.playerHp = d.playerMax;
      cast('trail', { x: 0, z: 8 });
      step(1.2);
      yes('trail: a puddle burns', lost() > 0.03 && lost() < 0.09);
      place(5, 8);
      const was = d.playerHp;
      step(1.5);
      check('trail: step off it', d.playerHp - was, 0);

      fresh(0, 3);
      place(0, 10);
      check('fan: in a line', take(() => cast('fan', { x: 0, z: 10 }), 1.7), 0.14);
      // Between two lines 20° apart: 10° off the middle, far enough out for the gap to be wider than a line.
      const off = 0.174;
      place(Math.sin(off) * 11, 3 + Math.cos(off) * 11);
      check('fan: in a gap', take(() => cast('fan', { x: 0, z: 14 }), 1.7), 0);
      fresh(0, 3);
      place(0, 2.6);
      check('fan: where lines meet it hits once', take(() => cast('fan', { x: 0, z: 14, fx: 0, fz: 2.2 }), 1.7), 0.14);

      fresh(0, 3);
      place(0, 10);
      check('marked: under the bomb', take(() => cast('marked', { step: 1, x: 0, z: 10 }), 1.1), 0.18);
      step(1.2);
      yes('marked: and a puddle after', lost() > 0.18);
      fresh(0, 3);
      place(0, 10);
      check('marked: walked out', take(() => { cast('marked', { step: 1, x: 0, z: 10 }); place(4, 10); }, 2), 0);

      // Knuckle Quake: two cracks cross where you stood. A step aside, and neither reaches you.
      fresh(0, 2);
      place(0, 9);
      check('quake: where they cross', take(() => cast('quake', { x: 0, z: 9, dir: 0 }), 2), 0.15);
      fresh(0, 2);
      place(3.5, 9);
      check('quake: stepped aside', take(() => cast('quake', { x: 0, z: 9, dir: 0 }), 2), 0);

      // Lantern Toss: either side of you. Standing still, nothing; a step to one side, a lantern.
      fresh(0, 2);
      place(0, 10);
      check('lanterns: stood still between them', take(() => cast('lanterns', { x: 0, z: 10, dir: 0 }), 2), 0);
      fresh(0, 2);
      place(3.2, 10);
      check('lanterns: under one', take(() => cast('lanterns', { x: 0, z: 10, dir: 0 }), 2), 0.14);

      // Burn your own: the brain says in the cast whether the boss stood under it, and then it pays.
      fresh(0, 10);
      const burnHp = a.hpOf(d.foe), burnGauge = d.boss.link.gauge ?? 0;
      place(8, 10);
      cast('marked', { step: 1, x: 0, z: 10, flag: true });
      step(1.2);
      check('burn your own: 4 % off', (burnHp - a.hpOf(d.foe)) / def.hp.solo, 0.04, 0.002);
      check('burn your own: and the gauge', (d.boss.link.gauge ?? 0) - burnGauge, 40, 0);
      fresh(0, 10);
      const missHp = a.hpOf(d.foe);
      place(8, 10);
      cast('marked', { step: 1, x: 0, z: 2 });
      step(1.2);
      check('burn your own: not under it, nothing', a.hpOf(d.foe), missHp, 0);
      const ringAim = def.moves.marked.aim({ step: 1, boss: { x: 0, z: -9 }, ring: { x: 1, z: 10 }, target: { x: 0, z: 10 }, seed: 1 });
      yes('burn your own: the brain counts the one in the ring', ringAim.flag === true);
      yes('and not the one on the rim', !def.moves.marked.aim({ step: 1, boss: { x: 0, z: 10 }, ring: { x: 9, z: 10 }, target: { x: 0, z: 10 }, seed: 1 }).flag);

      // Seal the vent: hold it 4 s, and the lava waits. Walking off lets it slip.
      fresh(0, -4);
      const offset0 = d.shiftOffset, sealGauge = d.boss.link.gauge ?? 0;
      place(0, 7);
      cast('seal');
      step(2);
      place(6, 7);
      step(1);
      const slip = d.boss.script.active[d.boss.script.active.length - 1].played.objectives[0];
      yes('seal the vent: walking off, it slips back', slip.held > 0 && slip.held < 0.5 && !slip.done);
      place(0, 7);
      step(3.8);
      yes('seal the vent: held, it is done', slip.done === true);
      check('seal the vent: the lava waits 20 s', offset0 - d.shiftOffset, 20, 0);
      check('seal the vent: the gauge', (d.boss.link.gauge ?? 0) - sealGauge, 40, 0);

      fresh(0, 3);
      place(0, 10);
      check('bombs: between the pair', take(() => cast('bombs', { x: 0, z: 10 }), 1.7), 0);
      place(2.7, 10);
      check('bombs: on one', take(() => cast('bombs', { x: 0, z: 10, dir: 0 }), 1.7), 0.12);

      fresh(0, 3);
      d.playerHp = d.playerMax;
      cast('wave', { seed: 99 });
      const sc = d.boss.script, wave = sc.active[sc.active.length - 1].played.threats[0];
      // At one moment past the start: inside the gap's angle it passes; off it, it burns.
      const t = wave.at + 1.6, r = (t - wave.at) * 5;
      let gapAngle = 0, found = false;
      for (let k = 0; k < 360 && !found; k++) {
        const an = (k / 360) * 6.283;
        if (!wave.hits(Math.sin(an) * r, 7 + Math.cos(an) * r, t)) { gapAngle = an + 0.2; found = true; }
      }
      yes('wave: the ring has a gap', found);
      yes('wave: most of it burns', wave.hits(Math.sin(gapAngle + 3) * r, 7 + Math.cos(gapAngle + 3) * r, t));
      yes('wave: not ahead of the ring', !wave.hits(Math.sin(gapAngle + 3) * (r + 3), 7 + Math.cos(gapAngle + 3) * (r + 3), t));
      place(0, 6);
      step(wave.at + 3);
      check('wave: it hits once as it passes', lost(), 0.16);

      // The tag: both screens swap at one moment, from a cast.
      fresh(0, 3);
      place(0, 14);
      cast('tag', { x: 3, z: 7, fx: 0, fz: -10.4, form: 1 });
      step(0.5);
      check('tag: not yet', d.bossForm, 0, 0);
      step(1.2);
      check('tag: Ember is in the ring', d.bossForm, 1, 0);
      check('tag: where the zone showed', Math.hypot(d.foe.group.position.x - 3, d.foe.group.position.z - 7), 0, 0.05);
      check('tag: Ash is on the rim', d.rimAt.z, -10.4);
      yes('tag: the body changes', d.foe.body.radius === def.forms[1].body.radius);
      yes('the boss is still one bar', a.hpOf(d.foe) === def.hp.solo);

      // Falling Star, the soak: under it it costs its share, split between those under it; nobody under it, everyone pays more.
      {
        fresh(0, 3);
        place(0, 10);
        check('falling star: alone, under it', take(() => cast('star', { x: 0, z: 10 }), 3.6), 0.1);
        check('falling star: alone, nobody under it', take(() => { cast('star', { x: 0, z: 10 }); place(5, 10); }, 3.6), 0.3);
        place(0, 10);
        check('falling star: for two, alone under it', take(() => cast('star', { x: 0, z: 10, alone: false }), 3.6), 0.3);
        const link = d.boss.link;
        link.stood = (id, part) => d.boss.script.stood(id, part, 2);
        place(0, 10);
        check('falling star: for two, both under it', take(() => cast('star', { x: 0, z: 10, alone: false }), 3.6), 0.15);
        place(5, 10);
        check('falling star: for two, the other one under it', take(() => cast('star', { x: 0, z: 10, alone: false }), 3.6), 0);
        delete link.stood;
      }

      // Eruption, the stage: three Coal Hearts lob lava; the one in the ring can't be hurt; hearts left, the vent erupts over everyone.
      {
        fresh(0, -6);
        place(0, 13);
        cast('eruption', { seed: 31 });
        step(0.2);
        check('eruption: three Coal Hearts', a.summons.alive('opponent').length, 3, 0);
        check('eruption: a lob, stood still', take(() => cast('eruption', { step: 1, seed: 31 }), 2.4), 0.08);
        d.playerHp = d.playerMax;
        cast('eruption', { step: 1, seed: 31 });
        step(0.1);
        const me0 = a.caster.group.position.clone();
        let out = null;
        for (let k = 0; k < 24 && !out; k++) {
          const an = (k / 24) * 6.283, x = me0.x + Math.sin(an) * 2.6, z = me0.z + Math.cos(an) * 2.6;
          if (!d.boss.script.danger(x, z, 3)) out = { x, z };
        }
        if (out) place(out.x, out.z);
        step(2.3);
        check('eruption: a lob, stepped out', lost(), 0);
        const h0 = a.hpOf(d.foe);
        a.hit(d.foe, { damage: 100, knock: 0 });
        check('eruption: the one in the ring cannot be hurt', h0 - a.hpOf(d.foe), 0, 0);
        place(0, 13);
        check('eruption: hearts left, the vent erupts', take(() => {}, 32), 0.45);
        check('eruption: and the hearts burst', a.summons.alive('opponent').length, 0, 0);
      }

      // The phases swap by themselves; Eruption opens the stage, put out they kneel, and Together starts the lava.
      fresh(0, 3);
      place(0, 14);
      d.boss.brain.pause = 0;
      d.boss.brain.wait = 0;
      // Small hits down to a share: one big hit (with the hero's own power on it) could pass two marks at once.
      const hitTo = (share) => { for (let i = 0; i < 600 && a.hpOf(d.foe) / def.hp.solo > share; i++) a.hit(d.foe, { damage: 10, knock: 0 }); };
      hitTo(0.65);
      yes('phase 2 at 66 %', d.boss.stats.phases === 1);
      step(5);
      check('phase 2: Ember comes in', d.bossForm, 1, 0);
      d.playerHp = d.playerMax;
      hitTo(0.49);
      yes('Eruption at 50 %', d.boss.stats.phases === 2);
      step(3.8);
      yes('Eruption: the brain opens the stage', d.boss.script.active.some((x) => x.cast.move === 'eruption' && x.cast.step === 0));
      check('Eruption: Ember waits it out in the vent', Math.hypot(d.foe.group.position.x, d.foe.group.position.z - 7), 0, 0.15);
      check('Eruption: three Coal Hearts from the brain', a.summons.alive('opponent').length, 3, 0);
      for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 9999, knock: 0 });
      step(0.1);
      yes('Eruption: put out, they kneel', d.boss.stats.kneels === 1);
      d.playerHp = d.playerMax;
      hitTo(0.32);
      yes('Together at 33 %', d.boss.stats.phases === 3);
      const off0 = d.shiftOffset + d.hazardClock;
      check('Together: the lava starts now', off0, 45, 0.2);
      d.boss.brain.pause = 1e9;
      // One hit past all three: the stage still comes first, before any swap.
      fresh(0, 3);
      d.boss.brain.pause = 0;
      a.hit(d.foe, { damage: def.hp.solo * 0.69, knock: 0 });
      yes('one hit past 66, 50 and 33 %: the stage still comes first', d.boss.stats.phases === 3 && d.boss.brain.opener === 'eruption');
      d.boss.brain.pause = 1e9;
      yes('their enrage timer shows', /^ENRAGE \d:\d\d$/.test(d.boss.hud.rageText));
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    delete performance.now;
    d.stop();
    return { ok: !failed.length, failed, rows };
  };

  // Each upgrade changes the number it says, and nothing lasts past the run. Tiers: more boss HP, shorter shown times.
  //   await _raidUpgrades()    // { ok, failed, rows }
  window._raidUpgrades = async (hero = 'Bram') => {
    const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
    const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const { RunUpgrades, offersFor, UPGRADES, STACKING, RARE, GOLD, DARK } = await import('/src/raid/upgrades.ts');
    const { HERO_KITS } = await import('/src/heroes.ts');
    const { NO_MODS } = await import('/src/traits/index.ts');
    const rows = [], failed = [];
    const check = (name, got, want, tol = 0.011) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    vfx.view.paused = true;
    if (!d.on) vfx.setDuel(true, 'play');
    vfx.heroPickCtrl.setValue(hero);
    d.holdStart = false;
    const kit = HERO_KITS.find((k) => k.name === hero);
    const fresh = (ids = [], tier = 1) => {
      const up = new RunUpgrades();
      for (const id of ids) up.add(id);
      const link = new LocalLink(def, tier);
      d.startBoss({ def, link, seed: 'up', mode: 'play', upgrades: up, tier });
      d.boss.brain.pause = 1e9;
      return { up, link };
    };
    const dealt = (damage = 100) => d.resolve('hero', d.foe, { damage }, NO_MODS, 'spell', 0, 1).damage;
    const base = kit.maxHp ?? 600;
    try {
      fresh([]);
      const cool0 = hm.castRules(0, 10, 1), cool3 = hm.castRules(3, 10, 1), walk = hm.speed;
      check('no upgrades: damage', dealt(), 100, 0.5);

      fresh(['hands']);
      check('Quick Hands: Q', hm.castRules(0, 10, 1) / cool0, 0.85);
      fresh(['ready']);
      check('Ready Again: R', hm.castRules(3, 10, 1) / cool3, 0.75);
      check('Ready Again: Q untouched', hm.castRules(0, 10, 1) / cool0, 1);
      fresh(['stride']);
      check('Long Stride', hm.speed / walk, 1.15);
      fresh(['glass']);
      check('Glass Edge: max HP', d.heroMax / base, 0.85, 0.002);
      check('Glass Edge: damage', dealt(), 125, 0.5);
      fresh(['stone']);
      check('Stone Skin: max HP', d.heroMax / base, 1.2, 0.002);
      check('it starts full', d.heroHp / d.heroMax, 1);
      // A boss's share is of the hero's own HP, so more max HP takes more hits to lose.
      d.bossWorld().hitMe({ share: 0.2, from: { x: 0, z: 0 }, move: 'test' });
      check('Stone Skin: a hit of 20 % takes 20 % of the HP without it', (d.heroMax - d.heroHp) / base, 0.2, 0.012);
      fresh(['glass']);
      d.bossWorld().hitMe({ share: 0.2, from: { x: 0, z: 0 }, move: 'test' });
      check('Glass Edge: the same hit, out of less', (d.heroMax - d.heroHp) / base, 0.2, 0.012);

      fresh(['opportunist']);
      check('Opportunist: not open', dealt(), 100, 0.5);
      d.boss.exposedFor(3);
      check('Opportunist: open', dealt(), 160 * 1, 0.5);

      const b = fresh(['breaker']);
      a.applyStatus(d.foe, 'stun', 1);
      check('Bone Breaker: the gauge', b.link.gauge, 22 * 1.4);

      const w = d.boss.script.world;
      const st = fresh(['stubborn']);
      const world = d.boss.script.world;
      void w;
      world.hitMe({ share: 5, from: { x: 0, z: 0 }, move: 'test' });
      check('Stubborn: a killing hit leaves 1 HP', d.heroHp, 1);
      world.hitMe({ share: 5, from: { x: 0, z: 0 }, move: 'test' });
      check('Stubborn: only once a fight', d.heroHp, 0);
      void st;

      fresh(['fresh']);
      d.boss.link.on.phase(1);
      check('Fresh Start: a shield at a phase', a.shieldOf(a.caster).amount / d.heroMax, 0.1);

      fresh(['ricochet']);
      check('Ricochet: a bolt bounces once', a.heroBolt({ reflect: 0 }).reflect, 1);

      // Nothing lasts past the run.
      fresh([]);
      check('without it: speed', hm.speed / walk, 1);
      check('without it: max HP', d.heroMax / base, 1);
      check('without it: no bounce', a.heroBolt ? 1 : 0, 0);

      // Offers: three, only what the hero can use, none it holds.
      const owned = new RunUpgrades();
      const offers = offersFor(kit, owned, 'a');
      check('three offers', offers.length, 3);
      check('the same seed, the same offers', offersFor(kit, owned, 'a').map((u) => u.id).join() === offers.map((u) => u.id).join() ? 1 : 0, 1);
      owned.add(offers[0].id);
      check('none it holds', offersFor(kit, owned, 'a').some((u) => u.id === offers[0].id) ? 1 : 0, 0);
      // They never run out: what can be taken again fills the cards, and each time counts.
      const allTaken = new RunUpgrades();
      for (const u of [...UPGRADES, ...RARE, ...GOLD, ...DARK]) allTaken.add(u.id);
      const lastOnes = offersFor(kit, allTaken, 'b');
      check('everything taken: still three offers', lastOnes.length, 3);
      check('and all three can be taken again', lastOnes.every((u) => STACKING.includes(u)) ? 1 : 0, 1);
      const nearly = new RunUpgrades();
      const fitting = UPGRADES.filter((u) => u.fits?.(kit) ?? true);
      for (const u of [...fitting.slice(2), ...RARE, ...GOLD, ...DARK]) nearly.add(u.id);
      const mixed = offersFor(kit, nearly, 'c');
      check('two left: those two come first', mixed.slice(0, 2).every((u) => fitting.slice(0, 2).includes(u)) ? 1 : 0, 1);
      check('and one that can be taken again', STACKING.includes(mixed[2]) ? 1 : 0, 1);
      // Rarer ones: deep in a run some come up blue or gold, and from the second hall the third card may be a pact (never the first).
      const deep = Array.from({ length: 40 }, (_, i) => offersFor(kit, new RunUpgrades(), `deep-${i}`, 5));
      check('deep in a run: some rare or gold cards', deep.some((o) => o.some((u) => u.rarity === 'rare' || u.rarity === 'gold')) ? 1 : 0, 1);
      check('deep in a run: some pacts, only as the third card', deep.some((o) => o[2].rarity === 'dark') && deep.every((o) => o[0].rarity !== 'dark' && o[1].rarity !== 'dark') ? 1 : 0, 1);
      check('the first hall: no pact', Array.from({ length: 40 }, (_, i) => offersFor(kit, new RunUpgrades(), `first-${i}`, 0)).some((o) => o.some((u) => u.rarity === 'dark')) ? 1 : 0, 0);
      fresh(['whetstone', 'whetstone']);
      check('Whetstone twice: damage', dealt(), 100 * 1.08 * 1.08, 0.5);
      fresh(['breath', 'breath']);
      check('Steady Breath twice: Q', hm.castRules(0, 10, 1) / cool0, 0.95 * 0.95);
      fresh(['hide', 'hide']);
      check('Thick Hide twice: max HP', d.heroMax / base, 1.21, 0.002);
      d.bossWorld().hitMe({ share: 0.2, from: { x: 0, z: 0 }, move: 'test' });
      check('Thick Hide: a hit of 20 % takes 20 % of the HP without it', (d.heroMax - d.heroHp) / base, 0.2, 0.012);
      const noBolts = HERO_KITS.filter((k) => !UPGRADES.find((u) => u.id === 'ricochet').fits(k)).length;
      rows.push(`note heroes with no line bolts, never offered Ricochet: ${noBolts}`);

      // Tiers.
      const t3 = fresh([], 3);
      check('tier 3: boss HP', t3.link.maxHp, def.hp.solo * 1.15 ** 2, 1);
      const shown = d.boss.script.ctx.shown;
      check('tier 3: a shown time', shown(2.5), 2.5 * 0.81);
      check('tier 3: never under 1 s', shown(1.1), 1);
      check('tier 3: two extra moves', d.boss.brain.extra.length, 2, 0);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    d.stop();
    return { ok: !failed.length, failed, rows };
  };

  window._raidCheck = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const THREE_V = a.caster.group.position.constructor;
    const rows = [], failed = [];
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const check = (name, got, want, tol = 0.012) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    const yes = (name, v) => check(name, v ? 1 : 0, 1, 0);
    let seq = 1000;
    const fresh = (bx = 0, bz = 2) => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'check', mode: 'play' });
      d.boss.brain.pause = 1e9;
      a.placeFoe(d.foe, new THREE_V(bx, 0, bz));
      step(0.05);
    };
    const place = (x, z) => { a.caster.group.position.set(x, 0, z); };
    const cast = (move, o = {}) => {
      const b = d.foe.group.position, me = a.caster.group.position;
      const x = o.x ?? me.x, z = o.z ?? me.z;
      d.boss.link.cast({ id: ++seq, move, step: o.step ?? 0, x, z, fx: b.x, fz: b.z, dir: o.dir ?? Math.atan2(x - b.x, z - b.z), seed: o.seed ?? 12345, target: 0 });
    };
    const lost = (before) => (before - d.playerHp) / d.playerMax;
    const take = (fn, seconds) => { d.playerHp = d.playerMax; fn(); step(seconds); return lost(d.playerMax); };

    try {
      // Stone Sweep: in the cone, behind him, walking out.
      fresh(0, 1);
      place(0, 5);
      check('sweep: in the cone', take(() => cast('sweep'), 1.8), 0.2);
      place(0, 5);
      check('sweep: walked out', take(() => { cast('sweep'); place(6.5, 1); }, 1.8), 0);
      place(0, -0.5);
      check('sweep: behind him', take(() => cast('sweep', { x: 0, z: 5 }), 1.8), 0);

      // Pillar Fall: under a stone, or stepped away.
      fresh(0, 1);
      place(-3, 13);
      check('pillar: stood still', take(() => cast('pillars'), 1.7), 0.15);
      place(-3, 13);
      check('pillar: walked out', take(() => { cast('pillars'); place(3, 13); }, 1.7), 0);

      // Fists of the Court: a fist where you stood. Walking on, it misses.
      fresh(0, 1);
      place(-3, 13);
      check('fists: stood still', take(() => cast('fists'), 1.4), 0.16);
      place(-3, 13);
      check('fists: walked out', take(() => { cast('fists'); place(3, 13); }, 1.4), 0);

      // Sun Ray: stopped by cover, cracks the wall.
      fresh(0, 1);
      place(0, 5);
      check('ray: in the line', take(() => cast('ray'), 2.7), 0.22);
      fresh(3.5, 7);
      place(9.5, 7);
      const hp0 = d.wallHp.reduce((s, v) => s + Math.max(0, v), 0);
      check('ray: behind a wall', take(() => cast('ray'), 2.7), 0);
      check('ray: the wall took a hit', hp0 - d.wallHp.reduce((s, v) => s + Math.max(0, v), 0), 1, 0);

      // Noon: open floor, behind a wall (it falls), behind a column (it stays).
      fresh(0, 1);
      place(0, 5);
      check('noon: in the open', take(() => cast('noon'), 8.2), 0.4);
      yes('noon: he stands open', a.statusOf(d.foe).buff('vulnerable') === 0.5);
      fresh(3.5, 7);
      place(9.5, 7);
      const n0 = a.obstacles.length;
      check('noon: behind a wall', take(() => cast('noon'), 8.2), 0);
      check('noon: that wall fell', n0 - a.obstacles.length, 1, 0);
      const col = a.obstacles.find((o) => o.kind === 'pillar' && o.height >= 2), cl = Math.hypot(col.ax, col.az - 7), cdx = col.ax / cl, cdz = (col.az - 7) / cl;
      fresh(col.ax - cdx * 3.5, col.az - cdz * 3.5);
      place(col.ax + cdx * 1.6, col.az + cdz * 1.6);
      const n1 = a.obstacles.length;
      check('noon: behind a column', take(() => cast('noon'), 8.2), 0);
      check('noon: the column stands', n1 - a.obstacles.length, 0, 0);

      // Turn the light: a shard to the altar, and there is no noon. He kneels and pays.
      fresh(0, 1);
      place(0, 18);
      cast('noon');
      step(0.1);
      const turn = d.boss.script.active[d.boss.script.active.length - 1];
      const shard = turn.played.objectives.find((o) => o.part === 0);
      yes('turn the light: alone, one shard', turn.played.objectives.filter((o) => o.part < 10).length === 1);
      check('turn the light: the shard is far from the altar', Math.hypot(shard.x, shard.z - 7), 9, 0.01);
      const walk0 = vfx.heroMode.speed;
      place(shard.x, shard.z);
      step(0.1);
      yes('turn the light: walking over it takes it', shard.done === true);
      check('turn the light: its carrier walks slower', vfx.heroMode.speed / walk0, 0.85);
      const hpTurn = a.hpOf(d.foe), kneels0 = d.boss.stats.kneels;
      d.playerHp = d.playerMax;
      place(2, 7);
      step(0.1);
      yes('turn the light: he kneels', d.boss.stats.kneels === kneels0 + 1);
      check('turn the light: and pays 5 %', (hpTurn - a.hpOf(d.foe)) / def.hp.solo, 0.05, 0.002);
      yes('turn the light: its carrier walks as before', Math.abs(vfx.heroMode.speed - walk0) < 0.001);
      place(0, 5);
      const noonOff = d.playerHp;
      step(8.5);
      check('turn the light: no noon comes', (noonOff - d.playerHp) / d.playerMax, 0);

      // For two: a shard each, and the light turns only when both are in, the partner's heard from the hub.
      fresh(0, 1);
      place(0, 18);
      d.boss.link.cast({ id: 9001, move: 'noon', step: 0, x: 0, z: 1, fx: 0, fz: 1, dir: 0, seed: 777, target: 0, alone: false });
      step(0.1);
      const duo = d.boss.script.active[d.boss.script.active.length - 1];
      yes('turn the light for two: two shards', duo.played.objectives.filter((o) => o.part < 10).length === 2);
      const mine = duo.played.objectives.find((o) => o.part === 0);
      const duoKneels = d.boss.stats.kneels;
      place(mine.x, mine.z);
      step(0.1);
      d.boss.script.done(9001, 1, 1);
      place(2, 7);
      step(0.1);
      yes('turn the light for two: one delivered, he still gathers', d.boss.stats.kneels === duoKneels && duo.played.threats.length === 1);
      d.boss.script.done(9001, 11, 1);
      step(0.1);
      yes('turn the light for two: the partner delivers, and he kneels', d.boss.stats.kneels === duoKneels + 1 && duo.played.threats.length === 0);

      // The altar takes nothing from a hero with no shard.
      fresh(0, 1);
      place(2, 7);
      cast('noon');
      step(0.5);
      yes('turn the light: no shard, nothing at the altar', d.boss.stats.kneels === 0);

      // Break the ray: Pillar Fall's stone stays, stops his ray, and breaks. That fills the gauge.
      // Down the open south side of the court, where nothing but the stone stands in the way.
      fresh(0, 20.5);
      place(0, 13);
      const cover0 = a.obstacles.length;
      cast('pillars', { x: 0, z: 16 });
      step(1.7);
      check('break the ray: the stone stands as cover', a.obstacles.length - cover0, 1, 0);
      d.playerHp = d.playerMax;
      const gauge0 = d.boss.link.gauge ?? 0;
      place(0, 13);
      cast('ray', { x: 0, z: 13, fx: 0, fz: 20.5, dir: Math.PI });
      step(2.7);
      check('break the ray: it stops at the stone', (d.playerMax - d.playerHp) / d.playerMax, 0);
      check('break the ray: the gauge fills', (d.boss.link.gauge ?? 0) - gauge0, 40, 0);
      check('break the ray: the stone is gone', a.obstacles.length - cover0, 0, 0);

      // Sun Order: wedge 1 fires at 2.5 s. Stood in it, hit once; stepping into it after it fired, nothing.
      const spot = (s) => ({ x: s.x + Math.sin(s.dir) * 5, z: s.z + Math.cos(s.dir) * 5 });
      const wedges = () => { cast('order'); const sc = d.boss.script; return sc.active[sc.active.length - 1].played.threats.map((t) => spot(t.shape)); };
      fresh(0, 1);
      const [s1] = wedges();
      place(s1.x, s1.z);
      d.playerHp = d.playerMax;
      step(2.7);
      check('order: stood in wedge 1', lost(d.playerMax), 0.16);
      step(3);
      fresh(0, 1);
      const [a1, a2] = wedges();
      place(a2.x, a2.z);
      d.playerHp = d.playerMax;
      step(2.6);
      place(a1.x, a1.z);
      step(3);
      check('order: stepped into 1 after it fired', lost(d.playerMax), 0);

      // Eclipse: near, far, near.
      fresh(0, 1);
      place(0, 3);
      check('eclipse near: close', take(() => cast('eclipse', { step: 0 }), 1.8), 0.15);
      place(0, 12);
      check('eclipse near: far off', take(() => cast('eclipse', { step: 0 }), 1.8), 0);
      place(0, 12);
      check('eclipse far: far off', take(() => cast('eclipse', { step: 1 }), 1.8), 0.15);
      place(0, 3);
      check('eclipse far: close', take(() => cast('eclipse', { step: 1 }), 1.8), 0);

      // Anchors, alone: stand in the gold or pay.
      fresh(0, 1);
      const before = d.boss.script;
      place(-11, 7);
      check('anchor: nobody in it', take(() => cast('anchors', { step: 0 }), 3.2), 0.25);
      cast('anchors', { step: 0 });
      const gold = before.active[before.active.length - 1].played.threats[0].shape;
      place(gold.x, gold.z);
      d.playerHp = d.playerMax;
      step(3.2);
      check('anchor: stood in it', lost(d.playerMax), 0);

      // Walking Sun: a turn of the ray hits each time it passes.
      fresh(0, 1);
      const sc = d.boss.script;
      cast('walking');
      const ray = sc.active[sc.active.length - 1].played.threats[0];
      const s4 = ray.shapeAt(4);
      place(s4.x2 * 0.5 + s4.x1 * 0.5, s4.z2 * 0.5 + s4.z1 * 0.5);
      d.playerHp = d.playerMax;
      step(4.3);
      check('walking sun: it passed once', lost(d.playerMax), 0.12);

      // The boss's own rules: not moved, stagger, kneel, +50 %.
      fresh(0, 2);
      const at = d.foe.group.position.clone();
      a.hitFilter = null;
      a.hit(d.foe, { damage: 1, knock: 8, pull: 4, from: new THREE_V(0, 0, 10) });
      a.carryFigure(d.foe, new THREE_V(3, 0, 0));
      step(0.5);
      check('not moved by knock, pull or carry', d.foe.group.position.distanceTo(at), 0, 0.001);
      yes('stun does not hold him', !a.applyStatus(d.foe, 'stun', 1.2) && !a.statusOf(d.foe).stunned);
      yes('root does not hold him', !a.applyStatus(d.foe, 'root', 1.2) && a.statusOf(d.foe).speedMul > 0);
      a.applyStatus(d.foe, 'slow', 2);
      step(1.1);
      yes('slow runs at half length', !a.statusOf(d.foe).has('slow'));
      // What a hero lays on the boss goes to the other screen once, and what comes from there goes no further.
      const told = [], shared = d.boss.link;
      shared.bossDebuff = (kind, amount, seconds) => told.push({ kind, amount, seconds });
      a.applyStatus(d.foe, 'slow', 2);
      yes('a slow is told to the other screen, already halved', told.length === 1 && told[0].kind === 'slow' && told[0].seconds === 1);
      told.length = 0;
      a.hit(d.foe, { damage: 1, knock: 0, debuff: { kind: 'weaken', amount: 0.2, seconds: 2 } });
      a.hit(d.foe, { damage: 1, knock: 0, debuff: { kind: 'vulnerable', amount: 0.2, seconds: 2 } });
      a.hit(d.foe, { damage: 1, knock: 0, debuff: { kind: 'grounded', amount: 0.5, seconds: 2 } });
      yes('a hit\'s weaken and vulnerable are told, nothing else', told.map((t) => t.kind).join() === 'weaken,vulnerable');
      told.length = 0;
      d.bossWorld().exposed(1);
      yes('the boss standing open is not: both screens do that themselves', told.length === 0);
      told.length = 0;
      a.clearStatuses(d.foe);
      d.bossDebuff('slow', 0, 1);
      d.bossDebuff('weaken', 0.25, 1);
      yes('from the other screen: it lands, at the length it came with', a.statusOf(d.foe).remaining('slow') === 1 && a.statusOf(d.foe).dealtMul === 0.75);
      yes('and goes no further', told.length === 0);
      delete shared.bossDebuff;
      a.clearStatuses(d.foe);
      for (let i = 0; i < 6; i++) a.applyStatus(d.foe, 'stun', 1.2);
      yes('a full gauge makes him kneel', d.boss.stats.kneels === 1);
      yes('kneeling he takes +50 %', a.statusOf(d.foe).buff('vulnerable') === 0.5);
      yes('kneeling counts as stunned', a.statusOf(d.foe).stunned);

      // The Long Hour: three Hour Stones, he can't be hurt, they shoot through you. Break them and he kneels.
      {
        fresh(0, 1);
        place(0, 12);
        const kids0 = d.boss.script.group.children.length;
        cast('hour', { seed: 4242 });
        step(0.2);
        const hourCast = d.boss.script.active[d.boss.script.active.length - 1];
        const stones = () => a.summons.alive('opponent');
        check('long hour: three Hour Stones', stones().length, 3, 0);
        check('long hour: each has 3.5 % of his HP', stones()[0]?.max ?? 0, Math.round(def.hp.solo * 0.035), 0);
        const hourHp = a.hpOf(d.foe);
        a.hit(d.foe, { damage: 200, knock: 0 });
        check('long hour: he cannot be hurt', hourHp - a.hpOf(d.foe), 0, 0);
        yes('long hour: nothing aims at him', !a.liveFoes().some((f) => f.figure === d.foe));
        yes('long hour: the stones can be aimed at', stones().every((u) => a.liveFoes().some((f) => f.figure === u.figure)));
        const stoneAt = stones().map((u) => ({ x: u.pos.x, z: u.pos.z }));
        yes('long hour: they stand round the court', stoneAt.every((s) => Math.abs(Math.hypot(s.x, s.z - 7) - 9) < 0.05));
        check('long hour: a volley, stood still', take(() => cast('hour', { step: 1, seed: 4242 }), 1.8), 0.08);
        d.playerHp = d.playerMax;
        cast('hour', { step: 1, seed: 4242 });
        step(0.1);
        // A step that leaves every beam, found by the script's own danger test.
        const me0 = a.caster.group.position.clone();
        let out = null;
        for (let k = 0; k < 24 && !out; k++) {
          const an = (k / 24) * 6.283, x = me0.x + Math.sin(an) * 3, z = me0.z + Math.cos(an) * 3;
          if (!d.boss.script.danger(x, z, 3)) out = { x, z };
        }
        if (out) place(out.x, out.z);
        step(1.7);
        check('long hour: a volley, stepped aside', lost(d.playerMax), 0);
        // What happens to a stone on the partner's screen comes off here, and a stone the hub says broke, breaks here.
        const relayed = [], link = d.boss.link;
        link.addHit = (id, part, amount) => relayed.push({ id, part, amount });
        const u0 = stones()[0];
        a.hit(u0.figure, { damage: 30, knock: 6, from: new THREE_V(0, 0, 7) });
        yes('long hour: a hit on a stone is told to the other screen', relayed.length === 1 && relayed[0].id === hourCast.cast.id && relayed[0].amount > 0);
        const hp1 = u0.hp;
        d.boss.script.addHit(hourCast.cast.id, 0, 20);
        check('long hour: a hit from the other screen comes off here', hp1 - u0.hp, 20, 0);
        yes('and is not told back', relayed.length === 1);
        delete link.addHit;
        step(0.3);
        yes('long hour: a stone is not knocked off its spot', Math.hypot(u0.pos.x - stoneAt[0].x, u0.pos.z - stoneAt[0].z) < 0.01);
        d.boss.script.done(hourCast.cast.id, 1, 1);
        check('long hour: a stone the other screen broke breaks here', stones().length, 2, 0);
        const kneels0 = d.boss.stats.kneels;
        for (const u of stones()) a.hit(u.figure, { damage: 9999, knock: 0 });
        step(0.1);
        yes('long hour: all three broken, he kneels', d.boss.stats.kneels === kneels0 + 1);
        const back = a.hpOf(d.foe);
        a.hit(d.foe, { damage: 50, knock: 0 });
        yes('long hour: and can be hurt again', a.hpOf(d.foe) < back);
        place(0, 12);
        check('long hour: and the dial does not strike', take(() => {}, 33), 0);
        // Its looks leave nothing behind: the shell and the shadows go with the cast, and every effect has ended.
        check('long hour: nothing of it is left in the scene', d.boss.script.group.children.length, kids0, 0);
        check('long hour: and no effect still plays', d.boss.script.show.live.length, 0, 0);
      }
      {
        fresh(0, 1);
        // In the open, in his sight from where he waits (the altar itself shades the floor due south of him).
        const sight = [[-3, 9.5], [3, 9.5], [-4, 3], [4, 3]].find(([x, z]) => a.lineOfSight(new THREE_V(0, 0, 4.6), new THREE_V(x, 0, z)));
        place(sight[0], sight[1]);
        check('long hour: stones left, the dial strikes', take(() => cast('hour', { seed: 4242 }), 33), 0.55);
        check('long hour: and the stones crumble', a.summons.alive('opponent').length, 0, 0);
        fresh(0, 1);
        // Behind the east wall, as seen from where he waits.
        const hold = { x: 0, z: 4.6 }, wx = 6.5, wz = 7, l = Math.hypot(wx - hold.x, wz - hold.z);
        place(hold.x + ((wx - hold.x) / l) * (l + 2.2), hold.z + ((wz - hold.z) / l) * (l + 2.2));
        yes('long hour: that spot is out of his sight', !a.lineOfSight(new THREE_V(hold.x, 0, hold.z), a.caster.group.position));
        check('long hour: behind a wall when it strikes', take(() => cast('hour', { seed: 4242 }), 33), 0);
      }
      // From the brain: one hit past 70, 50 and 35 %, the stage still comes first; broken, he kneels, and then he fights on.
      {
        fresh(0, 2);
        place(0, 12);
        d.boss.brain.pause = 0;
        d.boss.brain.wait = 0;
        a.hit(d.foe, { damage: def.hp.solo * 0.6, knock: 0 });
        yes('one hit past 70, 50 and 35 %: Last Light', d.boss.stats.phases === 3);
        // A kneel that lands with the phase: the brain waits it out, and he stays safe until the stage comes.
        d.boss.link.on.kneel(def.kneel);
        step(4.5);
        const hp2 = a.hpOf(d.foe);
        a.hit(d.foe, { damage: 100, knock: 0 });
        check('from the phase on he cannot be hurt, a kneel or not', hp2 - a.hpOf(d.foe), 0, 0);
        step(2.4);
        yes('the brain still opens the stage first, once the kneel is over', d.boss.script.active.some((x) => x.cast.move === 'hour' && x.cast.step === 0));
        step(1);
        check('and he waits it out behind the Sun Well', Math.hypot(d.foe.group.position.x, d.foe.group.position.z - 4.6), 0, 0.15);
        const ev = d.boss.script.eventId;
        for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 9999, knock: 0 });
        step(0.1);
        yes('broken, he kneels', d.boss.stats.kneels === 2);
        step(def.kneel + 4);
        yes('and after the kneel he fights again', d.boss.script.eventId > ev);
        d.boss.brain.pause = 1e9;
      }
      // Enrage: a timer under his bar, and at 4:00 every hit costs half as much again and the quiet between moves shrinks.
      {
        fresh(0, 1);
        step(0.1);
        const clock = (s) => `ENRAGE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        yes('the enrage timer shows', [clock(def.enrage), clock(def.enrage - 1)].includes(d.boss.hud.rageText));
        d.boss.fought = def.enrage - 0.05;
        step(0.1);
        yes('at 4:00 he enrages', d.boss.enraged === true && d.boss.hud.rageText === 'ENRAGED');
        check('enraged: the quiet between moves', d.boss.brain.rage, 0.5, 0);
        place(0, 5);
        check('enraged: a sweep costs twice as much', take(() => cast('sweep'), 1.8), 0.4);
        // A higher tier: more HP, so the enrage comes later by as much.
        d.startBoss({ def, link: new LocalLink(def, 3), seed: 'tier', mode: 'play', tier: 3 });
        d.boss.brain.pause = 1e9;
        check('at tier 3 the enrage comes later, as the HP grows', d.boss.enrageAt / def.enrage, 1.15 ** 2, 0.005);
        yes('a fight left while enraged: the next boss is not red', d.figure.body?.rage === false);
      }
      // The body: its pose lasts the whole cast, so it strikes when the zone lands (no hero's 2.5 s cap), sooner at a higher tier by as
      // much as the zone; a move's steps that overlap act out together.
      {
        const { raidTierFactor } = await import('/server/protocol.mjs');
        fresh(0, 1);
        cast('noon');
        step(0.05);
        check('the body: Gathering Noon strikes at 8 s, when it lands', d.figure.castNow?.dur ?? 0, 8, 0.01);
        d.startBoss({ def, link: new LocalLink(def, 3), seed: 'tier3', mode: 'play', tier: 3 });
        d.boss.brain.pause = 1e9;
        step(0.05);
        cast('sweep');
        step(0.05);
        check('the body at tier 3: its strike comes sooner with the zone', d.figure.castNow?.dur ?? 0, 1.6 * raidTierFactor(3), 0.01);
        fresh(0, 1);
        cast('pillars', { step: 0 });
        step(0.7);
        cast('pillars', { step: 1 });
        step(0.1);
        yes('the body: Pillar Fall\'s first two steps act out together', d.figure.bodyActs.filter((a) => a.name === 'pillars').map((a) => a.step).join() === '0,1');
      }

      // Phases: HP thresholds; the end of the fight.
      fresh(0, 2);
      // Small hits down to a share: one big hit (with the hero's own power on it) could pass two marks at once.
      const hitTo = (share) => { for (let i = 0; i < 600 && a.hpOf(d.foe) / def.hp.solo > share; i++) a.hit(d.foe, { damage: 10, knock: 0 }); };
      hitTo(0.69);
      yes('phase 2 at 70 %', d.boss.stats.phases === 1);
      hitTo(0.49);
      yes('the Long Hour at 50 %', d.boss.stats.phases === 2);
      d.boss.guard(0);
      hitTo(0.34);
      yes('Last Light at 35 %', d.boss.stats.phases === 3);
      a.hit(d.foe, { damage: def.hp.solo, knock: 0 });
      step(0.1);
      yes('he falls at 0', d.result?.winner === vfx.heroMode.currentKit.name);

      // The shadows drawn for Noon against what really blocks the light.
      fresh(0, 1);
      cast('noon');
      step(0.1);
      const noon = d.boss.script.active[d.boss.script.active.length - 1];
      const mesh = d.boss.script.group.children.find((c) => c.isMesh && c.material.uniforms?.uCenter);
      const pos = mesh.geometry.attributes.position;
      const inTri = (p, q, r, x, z) => {
        const s = (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x), t = (r.x - q.x) * (z - q.z) - (r.z - q.z) * (x - q.x), u = (p.x - r.x) * (z - r.z) - (p.z - r.z) * (x - r.x);
        return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
      };
      const shadowed = (x, z) => {
        for (let i = 0; i < pos.count; i += 3) {
          const v = (k) => ({ x: pos.getX(i + k), z: pos.getZ(i + k) });
          if (inTri(v(0), v(1), v(2), x, z)) return true;
        }
        return false;
      };
      let wrong = 0, n = 0;
      const src = noon.cast;
      for (let k = 0; k < 1500; k++) {
        const r = 15.5 * Math.sqrt(Math.random()), an = Math.random() * 6.283, x = Math.cos(an) * r, z = 7 + Math.sin(an) * r;
        if (a.obstacles.some((o) => { const dx = o.bx - o.ax, dz = o.bz - o.az, l = dx * dx + dz * dz, t = l ? Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / l)) : 0; return Math.hypot(x - o.ax - dx * t, z - o.az - dz * t) <= o.r + 0.1; })) continue;
        n++;
        const open = a.lineOfSight(new THREE_V(src.fx, 0, src.fz), new THREE_V(x, 0, z));
        if (open === shadowed(x, z)) wrong++;
      }
      check('shadows match what blocks the light (share wrong)', wrong / n, 0, 0.03);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    delete performance.now;
    return { ok: !failed.length, failed, rows };
  };
  // The Heart of Noon: each move forced in turn, what it costs and how to get out of it; Lock a ring and Shade the heart, by this hero and
  // by a partner (the hub's `done` for the other side, as it reaches this screen).
  //   await _raidHeart()   // { ok, failed, rows }
  window._raidHeart = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { HEART_OF_NOON: def } = await import('/src/raid/heart.ts');
    const { HEART_LIVE } = await import('/src/raid/bodies/heart.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const V = a.caster.group.position.constructor;
    const rows = [], failed = [];
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const check = (name, got, want, tol = 0.012) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    const yes = (name, v) => check(name, v ? 1 : 0, 1, 0);
    const H = { x: 0, z: 7 };
    let seq = 9000;
    const fresh = () => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'heart', mode: 'play' });
      d.boss.brain.pause = 1e9;
      // Hold Still comes by the clock, whatever the brain's pause: none of its own here.
      d.boss.brain.timedDone = 1e9;
      a.placeFoe(d.foe, new V(H.x, 0, H.z));
      step(0.05);
    };
    const place = (x, z) => a.caster.group.position.set(x, 0, z);
    const polar = (deg, r) => ({ x: H.x + Math.sin((deg * Math.PI) / 180) * r, z: H.z + Math.cos((deg * Math.PI) / 180) * r });
    const cast = (move, o = {}) => {
      const me = a.caster.group.position, x = o.x ?? me.x, z = o.z ?? me.z;
      const c = { id: ++seq, move, step: o.step ?? 0, x, z, fx: H.x, fz: H.z, dir: o.dir ?? Math.atan2(x - H.x, z - H.z), seed: o.seed ?? 4242, target: 0, alone: o.alone };
      d.boss.link.cast(c);
      return c;
    };
    const live = (id) => d.boss.script.active.find((x) => x.cast.id === id);
    const since = (id) => d.boss.script.clock - live(id).began;
    const lost = () => (d.playerMax - d.playerHp) / d.playerMax;
    const take = (fn, s) => { d.playerHp = d.playerMax; fn(); step(s); return lost(); };
    const gauge = () => d.boss.link.gauge ?? 0;
    const apart = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
    /** Where a ring of Solar Flare leaves its two gaps, from its own zone: the angle (degrees) at radius `r` of one, the other opposite. */
    const gapOf = (th, r) => {
      const t = th.at + (r - 2) / 5.5;
      // Doubled angles: the two gaps, 180 degrees apart, fall on one another.
      let sx = 0, sz = 0;
      for (let k = 0; k < 360; k++) {
        const p = polar(k, r);
        if (!th.hits(p.x, p.z, t)) { sx += Math.sin((2 * k * Math.PI) / 180); sz += Math.cos((2 * k * Math.PI) / 180); }
      }
      return (Math.atan2(sx, sz) * 90) / Math.PI;
    };
    /** Where a ring's beam points at time `t` after its cast (degrees), found from its own zone at radius 6, or null when it is out. */
    const beamAt = (th, t) => {
      for (let k = 0; k < 720; k++) { const p = polar(k / 2, 6); if (th.hits(p.x, p.z, t)) return k / 2; }
      return null;
    };
    try {
      fresh();
      // Blade Sweep: an arc in front; behind it, nothing.
      place(0, 12);
      check('sweep: in front', take(() => cast('sweep'), 2), 0.18);
      place(0, 2.5);
      check('sweep: behind it', take(() => cast('sweep', { x: 0, z: 12, dir: 0 }), 2), 0);

      // Blade Fall: each step a line through where you stood, the second across the first.
      fresh();
      place(0, 13);
      check('fall: on the line', take(() => cast('fall', { x: 0, z: 13 }), 1.7), 0.15);
      place(2.4, 13);
      check('fall: a step aside', take(() => cast('fall', { x: 0, z: 13 }), 1.7), 0);
      place(0, 15.5);
      check('fall: the second blade lies across: along the first, safe', take(() => cast('fall', { x: 0, z: 13, step: 1, dir: 0 }), 1.7), 0);
      place(3.5, 13);
      check('fall: the second blade lies across: beside it, hit', take(() => cast('fall', { x: 0, z: 13, step: 1, dir: 0 }), 1.7), 0.15);

      // Solar Flare: three rings, each with a gap a little further round. Standing still away from them, each ring hits; stepping from
      // gap to gap as each one comes, none does.
      fresh();
      place(0, 13);
      // Every flare here aimed the same way (at the hero at (0, 13)): its first gap follows the hero it aims at.
      let c = cast('flare', { x: 0, z: 13 });
      step(0.05);
      const flares = live(c.id).played.threats;
      check('flare: three rings', flares.length, 3, 0);
      const gaps = flares.map((th) => gapOf(th, 6));
      // Each pair of gaps a little on from the last: compare the nearer of the two.
      const step2 = (x, y) => Math.min(apart(x, y), apart(x + 180, y));
      yes('flare: each pair of gaps 12 to 20 degrees on from the last', step2(gaps[0], gaps[1]) >= 11 && step2(gaps[0], gaps[1]) <= 21 && step2(gaps[1], gaps[2]) >= 11 && step2(gaps[1], gaps[2]) <= 21);
      const toHero = 0;
      yes('flare: the first gap opens 20 to 45 degrees to one side of the hero it aims at', Math.min(apart(gaps[0], toHero), apart(gaps[0] + 180, toHero)) >= 19 && Math.min(apart(gaps[0], toHero), apart(gaps[0] + 180, toHero)) <= 46);
      fresh();
      let p0 = polar(gaps[0] + 90, 6);
      place(p0.x, p0.z);
      check('flare: standing where no gap is, every ring hits', take(() => cast('flare', { x: 0, z: 13 }), 7), 0.36, 0.02);
      fresh();
      d.playerHp = d.playerMax;
      c = cast('flare', { x: 0, z: 13 });
      let t0 = 0;
      for (let i = 0; i < 3; i++) {
        // Into ring i's gap a moment before it reaches radius 6.
        const reach = flares[i].at + 4 / 5.5;
        step(Math.max(0, reach - 0.3 - t0));
        t0 = reach - 0.3;
        const g = polar(gaps[i] + 180, 6);
        place(g.x, g.z);
      }
      step(2);
      check('flare: stepping through each gap', lost(), 0);

      // The Rings Turn: three casts, one beam each, turning. A beam burns once a second; holding a ring's spot 2 s stops it for 8 s,
      // pays the gauge once, and it burns again after a warning.
      fresh();
      place(0, 16);
      const rc = [0, 1, 2].map((i) => cast('rings', { step: i, x: H.x, z: H.z }));
      step(0.05);
      const beams = rc.map((x) => live(x.id).played.threats[0]);
      const warm = beams[0].at;
      step(warm + 0.5);
      yes('rings: all three are down round its foot', HEART_LIVE.rings.every((r) => r.down > 0.99));
      const ang = beamAt(beams[0], since(rc[0].id) + 0.05);
      yes('rings: ring A throws a beam', ang !== null);
      const pb = polar(ang ?? 0, 6);
      d.playerHp = d.playerMax;
      place(pb.x, pb.z);
      step(0.1);
      check('rings: standing in a beam', lost(), 0.1, 0.002);
      // The spot that locks ring B, by this hero.
      const spot = live(rc[1].id).played.objectives[0];
      const g0 = gauge();
      place(spot.x, spot.z);
      step(2.3);
      yes('rings: holding a spot 2 s locks its ring', spot.done === true);
      check('rings: a lock fills the gauge by 40', gauge() - g0, 40, 0);
      const tl = since(rc[1].id);
      yes('rings: a locked ring\'s beam is out', beamAt(beams[1], tl + 1) === null && beamAt(beams[1], tl + 7.5) === null);
      yes('rings: it burns again after 8 s and a warning', beamAt(beams[1], tl + 9.2) !== null);
      step(0.1);
      yes('rings: the body shows it dark', HEART_LIVE.rings[1].lit === 0);
      // The same spot again, as a late report: paid once.
      d.boss.script.done(rc[1].id, 0, 1);
      check('rings: a lock is paid once', gauge() - g0, 40, 0);
      // Ring C, locked by the partner on its own screen: the hub's `done` for side 1 reaches this one.
      const g1 = gauge();
      d.boss.script.done(rc[2].id, 0, 1);
      step(0.1);
      const tl2 = since(rc[2].id);
      yes('rings: the partner\'s lock puts its beam out here too', beamAt(beams[2], tl2 + 1) === null);
      check('rings: and pays its gauge', gauge() - g1, 40, 0);

      // Heartbeat: plates fall as gold spots; hold one 3 s and it stands up on the heart's side. The beat burns the floor it can see.
      fresh();
      const n0 = a.obstacles.length;
      const bc = cast('heartbeat', { x: H.x, z: H.z });
      step(0.05);
      const hb = live(bc.id), beatAt = hb.played.threats[0].at;
      const plates = hb.played.objectives;
      check('heartbeat: three plates fall', plates.length, 3, 0);
      step(1);
      place(plates[0].x, plates[0].z);
      step(3.3);
      yes('heartbeat: holding a plate 3 s raises it', plates[0].done === true);
      check('heartbeat: it stands as cover', a.obstacles.length - n0, 1, 0);
      yes('heartbeat: it stands between the spot and the heart', !a.lineOfSight(new V(H.x, 0, H.z), new V(plates[0].x, 0, plates[0].z)));
      // Plate 1, by the partner: it stands here too.
      d.boss.script.done(bc.id, 1, 1);
      step(0.1);
      check('heartbeat: the partner\'s plate stands here too', a.obstacles.length - n0, 2, 0);
      d.playerHp = d.playerMax;
      place(plates[1].x, plates[1].z);
      step(beatAt - since(bc.id) + 0.3);
      check('heartbeat: behind the partner\'s plate, safe', lost(), 0);
      step(1.5);
      check('heartbeat: every plate is gone at the same moment after the beat', a.obstacles.length - n0, 0, 0);
      fresh();
      p0 = polar(30, 8);
      place(p0.x, p0.z);
      check('heartbeat: in the open, it burns', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0.4, 0.002);
      fresh();
      p0 = polar(30, 2);
      place(p0.x, p0.z);
      check('heartbeat: right at its foot it does not reach (a hole, so Molten Ground leaves no pool under it)', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0);
      check('heartbeat: comes every 20 s', def.moves.heartbeat.cooldown, 20, 0);

      // The Crown of Rays: four rays, then the four between them.
      fresh();
      place(0, 14);
      check('corona: on a first ray', take(() => cast('corona', { x: 0, z: 14 }), 3.5), 0.15);
      p0 = polar(45, 8);
      place(p0.x, p0.z);
      check('corona: on a second ray', take(() => cast('corona', { x: 0, z: 14, dir: 0 }), 3.5), 0.15);
      p0 = polar(22.5, 8);
      place(p0.x, p0.z);
      check('corona: between them', take(() => cast('corona', { x: 0, z: 14, dir: 0 }), 3.5), 0);

      // Hold Still: a run of beats over the whole floor. Each burns only a hero that is walking as it lands: by its own walk or a dash,
      // not by a blow, a carry or a stone raised under it. The rhythm quickens phase by phase.
      const world = d.boss.script.world;
      const beatsOf = (id) => live(id).played.threats.map((th) => th.at);
      const walkFor = (s, dx = 0.06) => { for (let i = 0; i < Math.round(s * 60); i++) { a.walk(new V(dx, 0, 0)); step(1 / 60); } };
      /** Steps to `before` seconds ahead of beat `n` of cast `id`. */
      const toBeat = (id, n, before) => step(beatsOf(id)[n] - since(id) - before);
      fresh();
      place(-3, 13);
      d.playerHp = d.playerMax;
      const ev0 = d.boss.script.eventId;
      let sc = cast('still', { x: H.x, z: H.z });
      step(0.05);
      const b1 = beatsOf(sc.id);
      check('still: three beats in Embers Wake', b1.length, 3, 0);
      check('still: the first comes 3 s after it shows', b1[0], 3, 0.001);
      check('still: 2.6 s apart', b1[1] - b1[0], 2.6, 0.001);
      yes('still: it is no new event to an AI (its roll for what is in the air stays)', d.boss.script.eventId === ev0);
      yes('still: it is no zone to leave', !d.boss.script.danger(-3, 13, 5));
      check('still: an AI is told how long until the beat', d.boss.script.stillIn, 3 - since(sc.id), 0.02);
      yes('still: the heart fills toward the beat', (toBeat(sc.id, 0, 0.3), HEART_LIVE.fill > 0.8));
      step(0.6);
      check('still: standing still through a beat', lost(), 0);
      yes('still: the heart clenched on it', HEART_LIVE.clench < 0.5 && HEART_LIVE.fill < 0.3);
      // The second beat: walking through it.
      toBeat(sc.id, 1, 0.5);
      walkFor(1);
      check('still: walking through a beat burns', lost(), 0.12);
      // The third: it walks, and stops just in time.
      d.playerHp = d.playerMax;
      toBeat(sc.id, 2, 1);
      walkFor(0.7);
      step(0.8);
      check('still: stopped 0.3 s before the beat', lost(), 0);
      yes('still: the run is over', (step(1), d.boss.script.stillIn === Infinity && !live(sc.id)));
      // Stopping too late, and a dash.
      fresh();
      place(-3, 13);
      d.playerHp = d.playerMax;
      sc = cast('still', { x: H.x, z: H.z });
      step(0.05);
      toBeat(sc.id, 0, 1);
      walkFor(0.9);
      step(0.6);
      check('still: stopped 0.1 s before the beat, too late', lost(), 0.12);
      d.playerHp = d.playerMax;
      toBeat(sc.id, 1, 0.2);
      a.moveFigure(a.caster, new V(a.caster.group.position.x + 3, 0, 13), 0.3);
      step(0.7);
      check('still: a dash through a beat burns', lost(), 0.12);
      // Knocked by a blow, carried, or pushed out by a stone raised under it: none of them is a walk.
      toBeat(sc.id, 2, 0.15);
      d.playerHp = d.playerMax;
      let at0 = a.caster.group.position.clone();
      world.hitMe({ share: 0.02, knock: 6, from: { x: H.x, z: H.z }, move: 'test' });
      const knocked = lost();
      yes('still: the blow knocked it away', a.caster.group.position.distanceTo(at0) > 0.8 && knocked > 0);
      step(0.5);
      check('still: knocked through a beat, the beat costs nothing', lost() - knocked, 0, 0.001);
      fresh();
      place(-3, 13);
      d.playerHp = d.playerMax;
      sc = cast('still', { x: H.x, z: H.z });
      step(0.05);
      toBeat(sc.id, 0, 0.15);
      at0 = a.caster.group.position.clone();
      world.carryMe(1.5, 0);
      step(0.5);
      yes('still: carried by the boss', a.caster.group.position.distanceTo(at0) > 1.4);
      check('still: carried through a beat', lost(), 0);
      toBeat(sc.id, 1, 0.15);
      at0 = a.caster.group.position.clone();
      const under = world.addStone(at0.x, at0.z, 1, 2);
      step(0.5);
      yes('still: a stone raised under it pushed it out', a.caster.group.position.distanceTo(at0) > 0.5);
      check('still: pushed out through a beat', lost(), 0);
      world.dropStone(under);
      // The rhythm, phase by phase.
      fresh();
      const b2 = (sc = cast('still2', { x: H.x, z: H.z }), step(0.05), beatsOf(sc.id));
      check('still: four beats in The Rings Turn', b2.length, 4, 0);
      check('still: 2.1 s apart', b2[1] - b2[0], 2.1, 0.001);
      fresh();
      const b3 = (sc = cast('still3', { x: H.x, z: H.z }), step(0.05), beatsOf(sc.id));
      check('still: five beats in Noon Falls', b3.length, 5, 0);
      check('still: 1.6 s apart', b3[1] - b3[0], 1.6, 0.001);
      yes('still: each phase has its own, by the clock', def.phases.map((x) => x.timed?.move).join() === 'still,still2,still3');
      yes('still: a new phase\'s first run comes after the last phase\'s has ended', def.phases.slice(1).every((x) => x.timed.first >= 3 + 4 * 1.6 + 0.9));
      // By the brain's own clock: the first run waits 9 s into the fight, the next comes 21 s after it.
      fresh();
      d.boss.brain.timedDone = 0;
      const runs = () => d.boss.script.active.filter((x) => x.cast.move === 'still').length;
      step(8.5);
      check('still: none in the first 8.5 s of the fight', runs(), 0, 0);
      step(1.1);
      check('still: the first run comes 9 s in', runs(), 1, 0);
      step(11);
      check('still: it has ended by 20 s', runs(), 0, 0);
      step(10);
      check('still: the next comes 21 s after the first', runs(), 1, 0);
      // With Solar Flare: where the three rings' gaps overlap a hero stands still through the flare and the beats alike.
      fresh();
      place(0, 13);
      c = cast('flare', { x: 0, z: 13 });
      step(0.05);
      const lanes = live(c.id).played.threats.map((th) => gapOf(th, 6));
      // The middle ring's gap, on the side of the first ring's: within 20 degrees of both others, and a gap is 60 wide.
      const mid = apart(lanes[1], lanes[0]) <= 90 ? lanes[1] : lanes[1] + 180;
      p0 = polar(mid, 6);
      place(p0.x, p0.z);
      d.playerHp = d.playerMax;
      sc = cast('still3', { x: H.x, z: H.z });
      step(10);
      check('still: with Solar Flare, standing where its gaps overlap costs nothing', lost(), 0);
      // With the Heartbeat: holding a plate is standing still, so the plate rises and the beats cost nothing behind it.
      fresh();
      const hc = cast('heartbeat', { x: H.x, z: H.z });
      step(1);
      const pl = live(hc.id).played.objectives[0];
      place(pl.x, pl.z);
      d.playerHp = d.playerMax;
      cast('still3', { x: H.x, z: H.z });
      step(10.6);
      yes('still: with the Heartbeat, a plate is raised through the beats', pl.done === true);
      check('still: and neither the beats nor the Heartbeat cost anything behind it', lost(), 0);

      // Its phases.
      check('phases: three', def.phases.length, 3, 0);
      yes('phases: The Rings Turn opens with the rings', def.phases[1].opener === 'rings');
      yes('phases: Noon Falls opens with the Heartbeat', def.phases[2].opener === 'heartbeat');

      // A party (a band over 2) fights in the Sunburst: a well and eight rays, 35 m to the far corners. Every move reaches the walls,
      // and what the mechanics ask grows with the band (src/raid/heart.ts, `party`).
      const { burstAt } = await import('/src/arenas/sunburst.ts');
      const party = (band) => {
        d.startBoss({ def, link: new LocalLink(def), seed: 'heart', mode: 'play', band });
        d.boss.brain.pause = 1e9;
        d.boss.brain.timedDone = 1e9;
        a.placeFoe(d.foe, new V(H.x, 0, H.z));
        step(0.05);
      };
      const deg = (x, z) => ((Math.atan2(x - H.x, z - H.z) * 180) / Math.PI + 360) % 360;
      const sees = (p, q) => a.lineOfSight(new V(p.x, 0, p.z), new V(q.x, 0, q.z));
      const rays = [0, 1, 2, 3, 4, 5, 6, 7];
      party(10);
      yes('party: the room is the Sunburst', d.currentArena?.id === 'sunburst' && def.place.id === 'sunburst');
      check('party: its floor reaches 35 m', d.currentArena?.ring ?? 0, 35, 0);
      check('party: the party starts at the far end of the south ray', def.starts.heroes[0].z - H.z, 30, 0.01);
      yes('party: the Heart sees the far end of every ray', rays.every((k) => sees(H, burstAt(k, 32.5))));
      yes('party: two rays do not see each other', !sees(burstAt(0, 28), burstAt(1, 28)) && !sees(burstAt(3, 28), burstAt(5, 28)));
      let q0 = burstAt(1, 32.5);
      place(q0.x, q0.z);
      for (let i = 0; i < 180; i++) { a.walk(new V(0.07, 0, 0.07)); step(1 / 60); }
      yes('party: a hero can not walk out through the end of a ray', Math.hypot(a.caster.group.position.x - H.x, a.caster.group.position.z - H.z) < 34.5);

      // Solar Flare: four gaps, each over a spur and the near half of the ray on either side, the same for all three rings.
      c = cast('flare', { x: 0, z: 13 });
      step(0.05);
      const pf = live(c.id).played.threats;
      const openAt = (th, r, a0) => { const q = polar(a0, r); return !th.hits(q.x, q.z, th.at + (r - 2) / 5.5); };
      const gapsOf = (th, r) => { let n = 0; for (let k = 0; k < 720; k++) if (openAt(th, r, k / 2) && !openAt(th, r, (k - 1) / 2)) n++; return n; };
      check('party flare: three rings', pf.length, 3, 0);
      check('party flare: four gaps in a ring', gapsOf(pf[0], 6), 4, 0);
      const odd = openAt(pf[0], 10, 22.5) ? 0 : 1;
      yes('party flare: each gap lies over a spur, every other one', rays.every((k) => openAt(pf[0], 10, k * 45 + 22.5) === (k % 2 === odd)));
      // 3 degrees to each side of a ray's middle: inside its two halves, and clear of the shade of the piece of cover that lies in one.
      yes('party flare: so in every ray one half is open and one burns, out to its end', rays.every((k) => [20, 28, 33].every((r) => openAt(pf[0], r, k * 45 + 3) !== openAt(pf[0], r, k * 45 - 3))));
      yes('party flare: the open half is at least 3.5 m of floor 20 m out', rays.every((k) => { let n = 0; for (let x = -13.5; x <= 13.5; x += 0.25) if (openAt(pf[0], 20, k * 45 + x)) n++; return n * 0.25 * (Math.PI / 180) * 20 >= 3.5; }));
      yes('party flare: all three rings open the same lanes', [0, 1, 2].every((i) => rays.every((k) => openAt(pf[i], 12, k * 45 + 22.5) === openAt(pf[0], 12, k * 45 + 22.5) && openAt(pf[i], 28, k * 45 + 3) === openAt(pf[0], 28, k * 45 + 3))));
      check('party flare: a lane is 42 degrees wide: 4.4 m at 6 m from the Heart', (() => { let n = 0; for (let x = 0; x < 90; x += 0.25) if (openAt(pf[0], 6, x)) n++; return n * 0.25; })(), 42, 0.5);
      check('party flare: a ring runs to the end of a ray', pf[0].to - pf[0].at, (35.6 - 2) / 5.5, 0.01);
      party(10);
      q0 = polar(22.5 + 45 * (1 - odd), 10);
      place(q0.x, q0.z);
      check('party flare: standing between two lanes, every ring hits', take(() => cast('flare', { x: 0, z: 13 }), 12), 0.36, 0.02);
      // The east ray: which of its halves this cast opens (its half toward ray 3 is where its piece of cover lies).
      const plus = openAt(pf[0], 20, 93);
      party(10);
      q0 = burstAt(2, 30, plus ? 3 : -3);
      place(q0.x, q0.z);
      check('party flare: standing in the open half at the far end of a ray costs nothing', take(() => cast('flare', { x: 0, z: 13 }), 14), 0);
      party(10);
      q0 = burstAt(2, 30, plus ? -3 : 1.3);
      place(q0.x, q0.z);
      check('party flare: and in the other half every ring hits', take(() => cast('flare', { x: 0, z: 13 }), 14), 0.36, 0.02);

      // The flare's rings stop at cover. A cast whose lanes lie over the other four spurs: then the half of the east ray where its piece
      // of the fallen armillary lies burns.
      let burnSeed = -1;
      for (const seed of [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) {
        party(10);
        const fc = cast('flare', { x: 0, z: 13, seed });
        step(0.05);
        if (!openAt(live(fc.id).played.threats[0], 20, 93)) { burnSeed = seed; break; }
      }
      yes('party flare: the seed says which four spurs the lanes lie over', burnSeed >= 0);
      party(10);
      q0 = burstAt(2, 27, 3.4);
      place(q0.x, q0.z);
      check('party flare: behind the fallen armillary\'s piece, in the half that burns, no ring reaches', take(() => cast('flare', { x: 0, z: 13, seed: burnSeed }), 14), 0);
      party(10);
      q0 = burstAt(2, 20, 3.4);
      place(q0.x, q0.z);
      check('party flare: in front of the piece every ring hits', take(() => cast('flare', { x: 0, z: 13, seed: burnSeed }), 14), 0.36, 0.02);

      // The Rings Turn: a beam runs to the walls and stops at the fallen armillary's piece; a ring's spots stand in a row down a ray.
      party(10);
      place(0, 16);
      let prc = [0, 1, 2].map((i) => cast('rings', { step: i, x: H.x, z: H.z }));
      step(0.05);
      let pbeams = prc.map((x) => live(x.id).played.threats[0]);
      const everHit = (pt) => { for (let t = pbeams[0].at; t < pbeams[0].to; t += 0.02) if (pbeams.some((th) => th.hits(pt.x, pt.z, t))) return true; return false; };
      yes('party rings: a beam reaches the far end of a ray', everHit(burstAt(1, 33, 3)));
      // Ray 2's piece lies across its half toward ray 3: behind it no beam ever comes; beside it, and in front of it, one does.
      yes('party rings: behind the fallen armillary\'s piece no beam reaches', !everHit(burstAt(2, 26, 3.4)) && !everHit(burstAt(2, 31, 4.2)));
      yes('party rings: beside it and in front of it one does', everHit(burstAt(2, 26, -3.4)) && everHit(burstAt(2, 20, 3.4)));
      check('party rings: one spot a ring at band 10', live(prc[0].id).played.objectives.length, 1, 0);
      const s10 = prc.map((x) => live(x.id).played.objectives[0]);
      yes('party rings: the spots stand out in three different rays, 23.5 m from the Heart', s10.every((o) => Math.abs(Math.hypot(o.x - H.x, o.z - H.z) - 23.5) < 0.01 && Math.abs(deg(o.x, o.z) / 45 - Math.round(deg(o.x, o.z) / 45)) < 0.001)
        && new Set(s10.map((o) => Math.round(deg(o.x, o.z) / 45) % 8)).size === 3);
      party(40);
      place(0, 16);
      prc = [0, 1, 2].map((i) => cast('rings', { step: i, x: H.x, z: H.z }));
      step(0.05);
      pbeams = prc.map((x) => live(x.id).played.threats[0]);
      const row = live(prc[1].id).played.objectives;
      check('party rings: four spots a ring at band 40', row.length, 4, 0);
      yes('party rings: in a row down one ray, 3 m apart', row.every((o, j) => Math.abs(Math.hypot(o.x - H.x, o.z - H.z) - (23.5 + 3 * j)) < 0.01) && new Set(row.map((o) => Math.round(deg(o.x, o.z)))).size === 1);
      step(pbeams[0].at + 0.5);
      const pg0 = gauge();
      for (let j = 0; j < 3; j++) { place(row[j].x, row[j].z); step(2.2); }
      yes('party rings: three of four held, the ring still turns', row.slice(0, 3).every((o) => o.done) && beamAt(pbeams[1], since(prc[1].id) + 0.5) !== null);
      check('party rings: and nothing is paid yet', gauge() - pg0, 0, 0);
      // The last of the row, by a partner on its own screen.
      d.boss.script.done(prc[1].id, 3, 1);
      step(0.1);
      yes('party rings: the last one locks it', beamAt(pbeams[1], since(prc[1].id) + 1) === null && HEART_LIVE.rings[1].lit === 0);
      check('party rings: a lock is paid once', gauge() - pg0, 40, 0);

      // Heartbeat: a plate for every five heroes, each in front of a spur's nose; only a raised plate's pocket shelters, and only five.
      party(10);
      let pbc = cast('heartbeat', { x: H.x, z: H.z, dir: (100 * Math.PI) / 180 });
      step(0.05);
      let php = live(pbc.id), pat = php.played.threats[0].at;
      check('party heartbeat: two plates at band 10', php.played.objectives.length, 2, 0);
      check('party heartbeat: the first falls at the spur nearest its aim', deg(php.played.objectives[0].x, php.played.objectives[0].z), 112.5, 0.01);
      check('party heartbeat: the second across the well from it', deg(php.played.objectives[1].x, php.played.objectives[1].z), 292.5, 0.01);
      check('party heartbeat: 13.5 m out, in front of the spur\'s nose', Math.hypot(php.played.objectives[0].x - H.x, php.played.objectives[0].z - H.z), 13.5, 0.01);
      step(1);
      const pn0 = a.obstacles.length;
      place(php.played.objectives[0].x, php.played.objectives[0].z);
      step(3.3);
      yes('party heartbeat: holding a plate 3 s raises it', php.played.objectives[0].done === true && a.obstacles.length - pn0 === 1);
      yes('party heartbeat: its pocket shows as a gold zone to stand in', d.boss.script.goldSpots().length >= 1 && !!d.boss.script.standGoal(0, 7));
      d.playerHp = d.playerMax;
      q0 = polar(112.5, 15.5);
      place(q0.x, q0.z);
      step(pat - since(pbc.id) + 0.3);
      check('party heartbeat: in the pocket behind a raised plate, safe', lost(), 0);
      // The hub's count for a pocket, in place of the local link's (which counts this one hero): five are sheltered, and what a sixth
      // to an eighth would have taken is shared by all eight.
      const crowd = (count) => {
        party(10);
        pbc = cast('heartbeat', { x: H.x, z: H.z, dir: (100 * Math.PI) / 180 });
        step(1.05);
        php = live(pbc.id);
        pat = php.played.threats[0].at;
        d.boss.script.done(pbc.id, 0, 1);
        d.playerHp = d.playerMax;
        q0 = polar(112.5, 15.5);
        place(q0.x, q0.z);
        let said = null;
        d.boss.link.stood = (id, part, inside) => { said = { id, part, inside }; };
        step(pat - since(pbc.id) + 0.3);
        if (said) d.boss.script.stood(said.id, said.part, count);
        return said;
      };
      // The beat's own look comes once, however many pockets land with it; and a pocket with too many in it says so before the beat.
      party(10);
      pbc = cast('heartbeat', { x: H.x, z: H.z, dir: (100 * Math.PI) / 180 });
      step(1.05);
      d.boss.script.done(pbc.id, 0, 1);
      d.boss.script.done(pbc.id, 1, 1);
      const show = d.boss.script.show, ring0 = show.ring;
      let ringsShown = 0;
      show.ring = (...x) => { ringsShown++; return ring0.apply(show, x); };
      step(live(pbc.id).played.threats[0].at - since(pbc.id) + 0.2);
      show.ring = ring0;
      check('party heartbeat: with two plates up the beat shows once', ringsShown, 1, 0);
      const { HERO_KITS } = await import('/src/heroes.ts');
      d.startBoss({ def, link: new LocalLink(def), seed: 'heart', mode: 'play', band: 10, party: HERO_KITS.filter((k) => k.name !== hero).slice(0, 6).map((kit, i) => ({ side: i + 1, kit, name: kit.name })) });
      d.boss.brain.pause = 1e9;
      d.boss.brain.timedDone = 1e9;
      a.placeFoe(d.foe, new V(H.x, 0, H.z));
      step(0.05);
      pbc = cast('heartbeat', { x: H.x, z: H.z, dir: (100 * Math.PI) / 180 });
      step(1.05);
      d.boss.script.done(pbc.id, 0, 1);
      q0 = polar(112.5, 15.5);
      place(q0.x, q0.z);
      [...d.party.values()].forEach((pt, i) => { const at = polar(112.5 + (i % 2 ? 2 : -2), 13.2 + i * 0.7); pt.enemy.group.position.set(at.x, 0, at.z); });
      const words = [], say0 = a.say;
      a.say = (text, ...rest) => { words.push(text); return say0.call(a, text, ...rest); };
      step(live(pbc.id).played.threats[0].at - since(pbc.id) - 0.2);
      a.say = say0;
      yes('party heartbeat: a pocket with seven in it says 7/5 while there is time to leave', words.includes('7/5'));
      let said = crowd(8);
      yes('party heartbeat: a hero in a partner\'s pocket says so as the beat lands', !!said && said.part === 0 && said.inside === true);
      check('party heartbeat: eight in a pocket for five share what three would take', lost(), (0.4 * 3) / 8, 0.002);
      said = crowd(5);
      check('party heartbeat: five in a pocket pay nothing', lost(), 0);
      // A raised plate's pocket is shelter from the flare too, whether the flare's lane lies over its spur or not.
      const pocketFlare = (seed) => {
        party(10);
        pbc = cast('heartbeat', { x: H.x, z: H.z, dir: (100 * Math.PI) / 180 });
        step(1.05);
        d.boss.script.done(pbc.id, 0, 1);
        step(0.1);
        d.playerHp = d.playerMax;
        q0 = polar(112.5, 15.5);
        place(q0.x, q0.z);
        const fc = cast('flare', { x: 0, z: 13, seed });
        step(0.05);
        const inLane = openAt(live(fc.id).played.threats[0], 10, 112.5);
        step(8.5);
        return { inLane, lost: lost() };
      };
      const seen = {};
      for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
        const r = pocketFlare(seed);
        seen[r.inLane ? 'lane' : 'burns'] = r.lost;
        if (seen.lane !== undefined && seen.burns !== undefined) break;
      }
      check('party heartbeat: behind a raised plate under a lane, the flare costs nothing', seen.lane ?? -1, 0);
      check('party heartbeat: behind a raised plate where the flare burns, it does not reach either', seen.burns ?? -1, 0);
      party(10);
      q0 = burstAt(2, 27, 3.4);
      place(q0.x, q0.z);
      check('party heartbeat: the fallen armillary\'s piece is no shelter from it', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0.4, 0.002);
      party(10);
      q0 = burstAt(5, 33, -4);
      place(q0.x, q0.z);
      check('party heartbeat: it reaches the far corner of a ray', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0.4, 0.002);
      party(40);
      pbc = cast('heartbeat', { x: H.x, z: H.z });
      step(0.05);
      const p40 = live(pbc.id).played.objectives.map((o) => (deg(o.x, o.z) - 22.5) / 45);
      check('party heartbeat: eight plates at band 40', p40.length, 8, 0);
      yes('party heartbeat: one in front of each spur', new Set(p40.map((v) => Math.round(v))).size === 8 && p40.every((v) => Math.abs(v - Math.round(v)) < 0.001));
      party(5);
      pbc = cast('heartbeat', { x: H.x, z: H.z });
      step(0.05);
      check('party heartbeat: one plate at band 5', live(pbc.id).played.objectives.length, 1, 0);

      // The Crown of Rays: down four rays, the one nearest its aim among them, then the four between.
      party(10);
      const aim80 = { dir: (80 * Math.PI) / 180 };
      q0 = burstAt(2, 30);
      place(q0.x, q0.z);
      check('party corona: far down a first ray', take(() => cast('corona', aim80), 3.5), 0.15);
      q0 = burstAt(3, 30, 1.5);
      place(q0.x, q0.z);
      check('party corona: far down a second ray', take(() => cast('corona', aim80), 3.5), 0.15);
      q0 = burstAt(3, 30, 3.6);
      place(q0.x, q0.z);
      check('party corona: beside the ray, by the wall', take(() => cast('corona', aim80), 3.5), 0);

      // Hold Still: the beat reaches the far end of a ray.
      party(10);
      q0 = burstAt(6, 30);
      place(q0.x, q0.z);
      d.playerHp = d.playerMax;
      sc = cast('still', { x: H.x, z: H.z });
      step(0.05);
      toBeat(sc.id, 0, 0.5);
      walkFor(1);
      check('party still: walking through a beat at the far end of a ray burns', lost(), 0.12);
      d.playerHp = d.playerMax;
      toBeat(sc.id, 1, 0.5);
      step(1);
      check('party still: standing still there costs nothing', lost(), 0);

      // Back to the room for two: nothing of the party's stays.
      fresh();
      yes('party: the next fight for two is in the Sunken Heart again', d.currentArena?.id === 'sunkenheart' && def.place.id === 'sunkenheart' && def.starts.heroes[0].z === 16.5);
      c = cast('heartbeat', { x: H.x, z: H.z });
      step(0.05);
      check('party: and its Heartbeat throws three plates again', live(c.id).played.objectives.length, 3, 0);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    // The room for two, for whatever runs next in this page.
    def.resize?.(2);
    delete performance.now;
    return { ok: !failed.length, failed, rows };
  };
})();
