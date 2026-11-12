// Paste into the VFX tool page under the dev server (browser javascript tool). Forces each boss move in a stepped fight
// and checks its rules: what it costs in the zone, that walking out dodges it, what cover does, and the boss's own rules.
//
//   eval(await (await fetch('/pipeline/tools/raid-check.js')).text());
//   await _raidCheck()    // { ok, failed: [...], rows: [...] }
//   await _raidHeart()    // the same for the Heart of Noon: its moves, Hold Still, Lock a ring and Shade the heart, alone and with a partner
//                         // and for a party in the Sunburst, its own room (bands 5, 10 and 40)
//   await _raidTwin()     // Twin Flames, a party's Ash and Ember both at once: what one screen can check of it
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

      // The Hall of Noon (a party's room) and The Hour Strikes, which he only calls there.
      {
        const { HOUR } = await import('/src/raid/sunWarden.ts');
        const { HALL_ARMS, armSpot, inHall } = await import('/src/arenas/sunhall.ts');
        const hall = (bx = 0, bz = 3, mode = 'play', tier = 1) => {
          d.startBoss({ def, link: new LocalLink(def, tier), seed: 'hall', mode, band: 5, tier });
          d.boss.brain.pause = 1e9;
          a.placeFoe(d.foe, new THREE_V(bx, 0, bz));
          step(0.05);
        };
        const watch = () => {
          const seen = [], on = d.boss.link.on;
          d.boss.link.on = { ...on, cast: (c) => { if (c.step === 0) seen.push(c.move); on.cast(c); } };
          return seen;
        };
        const T = HOUR.seconds + 0.4;
        fresh(0, 1);
        yes('the court for two: no hour in his lists', def.place.id === 'suncourt' && def.phases.every((ph) => !ph.moves.includes('strikes')));
        {
          // His brain runs for 30 s in the court: the hour never comes.
          const seen = watch();
          d.boss.brain.pause = 0;
          for (let i = 0; i < 30; i++) { d.playerHp = d.playerMax; step(1); }
          yes('the court for two: 30 s of his brain, and no hour', seen.length > 3 && !seen.includes('strikes'));
        }
        hall();
        yes('a party fights in the Hall of Noon', def.place.id === 'sunhall' && d.currentArena.id === 'sunhall' && def.phases.every((ph) => ph.moves.includes('strikes')));
        check('the hall: the way out stands before the throne (z)', d.boss.gates.exit.group.position.z, 7 - (HALL_ARMS[2].reach - 4), 0.01);
        yes('the hall: the way out is on its floor', inHall(d.boss.gates.exit.group.position.x, d.boss.gates.exit.group.position.z, 2));
        yes('the hall: a party\'s first spot is on its floor', inHall(def.starts.heroes[0].x, def.starts.heroes[0].z, 1));
        // Each seed lights its own arm: a hero 20 m down it is not hit, one in the crossing is. (A fresh fight every few hours: each
        // takes 23 s of the fight's clock, and past his enrage the bell would cost twice as much.)
        for (let arm = 0; arm < 4; arm++) {
          const s = armSpot(arm, 20);
          place(s.x, s.z);
          check(`hour: safe in ${HALL_ARMS[arm].name} when it is the one called`, take(() => cast('strikes', { seed: arm }), T), 0);
        }
        hall();
        place(3, 12);
        check('hour: in the crossing', take(() => cast('strikes', { seed: 1 }), T), HOUR.share);
        place(-20, 7);
        check('hour: in another arm', take(() => cast('strikes', { seed: 1 }), T), HOUR.share);
        place(13.6, 4);
        check('hour: just past the safe arm\'s edge', take(() => cast('strikes', { seed: 1 }), T), 0);
        place(12.4, 4);
        check('hour: just short of it', take(() => cast('strikes', { seed: 1 }), T), HOUR.share);
        yes('hour: (he had not enraged, and the hero stood)', !d.boss.enraged && d.playerHp > 0);
        hall();
        place(0, 30);
        check('hour: ran there in time', take(() => { cast('strikes', { seed: 1 }); step(8); place(20, 7); }, T - 8), 0);
        place(3, 12);
        cast('strikes', { seed: 1 });
        step(0.1);
        const hourCast = () => d.boss.script.active.find((x) => x.cast.move === 'strikes');
        check('hour: the bell comes after this long at tier 1', hourCast().played.threats[0].at, HOUR.seconds, 0.001);
        check('hour: his cast bar is its clock', d.boss.hud.castLen, HOUR.seconds, 0.001);
        cast('sweep');
        step(0.1);
        check('hour: a small move leaves the bar to it', d.boss.hud.castLen, HOUR.seconds, 0.001);
        // A stage does not wait: as its phase begins the hour is called off, and nothing lands.
        d.playerHp = d.playerMax;
        d.boss.link.on.phase(2);
        // The stage itself stays away in this row: its Hour Stones' beams are not what is checked.
        d.boss.brain.pause = 1e9;
        yes('hour: a stage takes the cast bar from it', d.boss.hud.castLeft === 0);
        step(HOUR.seconds + 0.5);
        check('hour: called off when a stage begins', lost(d.playerMax), 0);
        yes('hour: (the hero stood)', d.playerHp > 0 && !d.boss.over);
        // While it is in the air his brain picks only small moves, and an opener waits for the bell.
        hall();
        {
          const br = d.boss.brain;
          br.phase = 3;
          br.opener = 'walking';
          br.hold(10, def.moves.strikes.holds.only);
          const picked = new Set();
          for (let i = 0; i < 80; i++) picked.add(br.pick(3)?.id);
          yes('hour: meanwhile he does only small moves', [...picked].every((id) => def.moves.strikes.holds.only.includes(id)) && picked.size > 1);
          yes('hour: an opener waits for the bell', br.opener === 'walking');
          br.heldUntil = -Infinity;
          yes('hour: and comes after it', br.pick(3)?.id === 'walking');
          br.opener = 'hour';
          br.hold(10, def.moves.strikes.holds.only);
          yes('hour: a stage does not wait', br.pick(3)?.id === 'hour');
        }
        // By his own clock: first 20 s into the fight.
        hall();
        {
          const seen = watch();
          d.boss.brain.pause = 0;
          place(0, 12);
          for (let i = 0; i < HOUR.first + 6 && !seen.includes('strikes'); i++) { d.playerHp = d.playerMax; step(1); }
          yes('hour: he calls the first one about 20 s in', seen.includes('strikes'));
        }
        // A higher tier: sooner, but never under what the longest way takes.
        hall(0, 3, 'play', 4);
        place(3, 12);
        cast('strikes', { seed: 1 });
        step(0.1);
        check('hour at tier 4: the bell is never sooner than the longest way', hourCast().played.threats[0].at, HOUR.least, 0.001);
        check('hour at tier 4: the cast bar agrees', d.boss.hud.castLen, HOUR.least, 0.001);
        // The autopilot runs to the lit arm, from the far end of the nave to the choir, and is there when the bell strikes.
        hall(0, 3, 'run');
        place(0, 49);
        d.playerHp = d.playerMax;
        cast('strikes', { seed: 2 });
        step(T);
        check('hour: the autopilot ran from the gate to the choir', lost(d.playerMax), 0);
        yes('hour: and stands in the choir', a.caster.group.position.z < 7 - 13);
        // The hall's own walls: they hide a hero from Noon as cover does, and never fall.
        hall(0, 30);
        place(20, 18.5);
        const w0 = a.obstacles.length;
        check('the hall: round its corner, Noon does not reach', take(() => cast('noon'), 8.2), 0);
        check('the hall: its wall stands', w0 - a.obstacles.length, 0, 0);
        // What he aims stays on the hall's floor; his floor-wide moves do not fill its arms.
        const aimed = def.moves.pillars.aim({ boss: { x: 0, z: 30 }, ring: { x: 0, z: 30 }, target: { x: 12.4, z: 40 }, step: 0, seed: 1 });
        check('the hall: a stone aimed at a hero by the wall lands clear of it (x)', aimed.x, 13 - 1.8, 0.001);
        const gateAim = def.moves.pillars.aim({ boss: { x: 0, z: 30 }, ring: { x: 0, z: 30 }, target: { x: 1.5, z: 52 }, step: 0, seed: 1 });
        yes('the hall: a hero in the gate\'s passage is still aimed at, down its middle', gateAim.x === 0 && gateAim.z === 52);
        hall(0, 3);
        place(0, 40);
        check('the hall: Sun Order does not reach down the nave', take(() => cast('order', { x: 0, z: 3 }), 5.6), 0);
        place(0, 30);
        check('the hall: Eclipse\'s far ring ends 20 m from him', take(() => cast('eclipse', { step: 1 }), 1.8), 0);
        place(0, 15);
        check('the hall: and still hits inside that', take(() => cast('eclipse', { step: 1 }), 1.8), 0.15);
      }

      // The party's fight in the hall (src/raid/wardenHall.ts): the hall breaks open, the sun comes down, and what comes only for a
      // big party: Branded (10), Carry the Sun (20), The Four Hours (40). One hero on a local link stands for the party: what the hub
      // would say of the others (how many stood in a zone) is fed in by hand, and what the brain reads of them is given to `aim`.
      {
        const { HOUR } = await import('/src/raid/sunWarden.ts');
        const { BREACH, SUNFIRE, BRAND, CARRY, FOUR, HUNT_S, fireRadius, hallFight } = await import('/src/raid/wardenHall.ts');
        const H = await import('/src/arenas/sunhall.ts');
        const hall = (band = 5, mode = 'play') => {
          d.startBoss({ def, link: new LocalLink(def, 1), seed: 'party', mode, band });
          d.boss.brain.pause = 1e9;
          a.placeFoe(d.foe, new THREE_V(0, 0, 3));
          step(0.05);
        };
        const watch = () => {
          const seen = [], on = d.boss.link.on;
          d.boss.link.on = { ...on, cast: (c) => { seen.push(c); on.cast(c); } };
          return seen;
        };
        /** A cast as the brain would send it, from where he stands unless it says. */
        const send = (c) => d.boss.link.cast({ id: ++seq, fx: 0, fz: 3, dir: 0, seed: 55, alone: false, target: 0, step: 0, x: 0, z: 0, ...c });
        const open = (band = 5, mode = 'play') => { hall(band, mode); send({ move: 'breach' }); step(BREACH.warn + 0.4); };
        const active = (move) => d.boss.script.active.filter((x) => x.cast.move === move);
        const lists = (band) => {
          hall(band);
          return [0, 1, 2, 3].map((ph) => { d.boss.brain.phase = ph; return d.boss.brain.listOf(true); });
        };
        const has = (ls, id) => ls.some((l) => l.includes(id));
        const sees = (x1, z1, x2, z2) => a.lineOfSight(new THREE_V(x1, 0, z1), new THREE_V(x2, 0, z2));
        const fromWell = (p) => Math.hypot(p.x, p.z - 7);
        const freeOf = (s, room) => a.obstacles.every((o) => {
          const dx = o.bx - o.ax, dz = o.bz - o.az, l = dx * dx + dz * dz, t = l ? Math.min(1, Math.max(0, ((s.x - o.ax) * dx + (s.z - o.az) * dz) / l)) : 0;
          return Math.hypot(s.x - o.ax - dx * t, s.z - o.az - dz * t) - o.r >= room;
        });
        /** What the brain gives `aim`: he at (0, 3), `heroes` standing, the first of them his target. */
        const ctx = (heroes, stepN, seed) => ({ boss: { x: 0, z: 3 }, ring: { x: 0, z: 3 }, target: heroes[0], step: stepN, seed, heroes });
        const crowd = (n) => Array.from({ length: n }, (_, i) => ({ side: i, x: (i % 8) * 2 - 7, z: 12 + Math.floor(i / 8) * 2 }));
        /** The fight's clock runs on to `t` seconds after cast `c`. */
        const until = (c, t) => { while (d.boss.script.clock - c.began < t) step(0.1); };

        // Which party sees what.
        const GREAT = ['strikes', 'carry', 'four'];
        let ls = lists(5);
        yes('band 5: none of Branded, Carry the Sun, The Four Hours in his lists', !has(ls, 'brand') && !has(ls, 'carry') && !has(ls, 'four') && has(ls, 'noon'));
        yes('band 5: High Noon opens with Gathering Noon', def.phases[1].opener === 'noon');
        ls = lists(10);
        yes('band 10: Branded from High Noon on, and neither of the others', !ls[0].includes('brand') && ls[1].includes('brand') && ls[3].includes('brand') && !has(ls, 'carry') && !has(ls, 'four'));
        ls = lists(20);
        yes('band 20: Carry the Sun stands where Gathering Noon did, and opens High Noon', has(ls, 'brand') && !has(ls, 'noon') && !has(ls, 'four') && def.phases[1].opener === 'carry');
        yes('band 40: Carry the Sun opens High Noon', lists(40) && def.phases[1].opener === 'carry');
        // His great mechanics take turns, with a breath after each: which of them is in his list as each begins and ends.
        const turns = (band, n) => {
          hall(band);
          const next = () => { d.boss.brain.phase = 1; return d.boss.brain.listOf(true).filter((id) => GREAT.includes(id)).join('+'); };
          const out = [next()];
          for (let i = 0; i < n; i++) {
            const id = out[out.length - 1];
            def.moves[id].aim(ctx(crowd(band), 0, 1));
            step(def.moves[id].charge + 8);
            if (i === 0) out.push(`(${next()})`);
            step(9);
            out.push(next());
          }
          return out.join(' ');
        };
        yes('band 5: the hour is his one great mechanic, with a breath after it', turns(5, 2) === 'strikes () strikes strikes');
        yes('band 20: the hour and Carry the Sun take turns', turns(20, 3) === 'strikes () carry strikes carry');
        yes('band 40: the hour, Carry the Sun, the hour, The Four Hours', turns(40, 4) === 'strikes () carry strikes four strikes');
        fresh(0, 1);
        yes('the court for two: none of the party\'s moves in a phase, no clock, his walk as it was',
          def.phases.every((ph) => !ph.timed && !['brand', 'carry', 'four', 'breach', 'sunfall'].some((id) => ph.moves.includes(id))) && def.speed === 2 && def.keepAt === 4.5);
        yes('every move\'s name passes the hub', Object.keys(def.moves).every((id) => /^[a-z]{1,16}$/.test(id)));
        hall(5);
        {
          const seen = watch();
          d.boss.link.on.phase(1);
          d.boss.brain.pause = 0;
          for (let i = 0; i < 45; i++) { d.playerHp = d.playerMax; step(1); }
          yes('band 5: 45 s of High Noon, and none of the three', seen.length > 5 && !seen.some((c) => ['brand', 'carry', 'four'].includes(c.move)));
        }
        hall(40);
        {
          const seen = watch();
          d.boss.link.on.phase(1);
          d.boss.brain.pause = 0;
          for (let i = 0; i < 150 && !['brand', 'carry', 'four'].every((id) => seen.some((c) => c.move === id)); i++) { d.playerHp = d.playerMax; step(1); }
          yes('band 40: he opens High Noon with Carry the Sun, brands, and calls The Four Hours', seen.find((c) => c.step === 0 && !['brand'].includes(c.move))?.move === 'carry' && seen.some((c) => c.move === 'brand') && seen.some((c) => c.move === 'four'));
          // The hub passes a cast on field by field (server/hub.mjs, `boss_cast`): anything else would not arrive.
          const HUB = ['id', 'move', 'step', 'x', 'z', 'fx', 'fz', 'dir', 'seed', 'target', 'alone', 'rim', 'form', 'flag', 'which'];
          yes('every cast he sent has only what the hub passes on', seen.every((c) => Object.keys(c).every((k) => HUB.includes(k)) && [c.id, c.step, c.x, c.z, c.fx, c.fz, c.dir, c.seed, c.target].every(Number.isFinite)));
          const brandCast = seen.find((c) => c.move === 'brand' && c.step === 0), me = a.caster.group.position;
          yes('Branded: alone, the brain brands the one hero standing, where it stands', brandCast.target === 0 && !brandCast.flag && Math.hypot(brandCast.x - me.x, brandCast.z - me.z) < 12);
        }

        // The hall breaks open.
        hall(5);
        const n0 = a.obstacles.length;
        yes('the hall whole: the stone between the nave and a transept is no floor, and hides', !H.inHall(20, 27) && !sees(12, 27, 20, 19) && !H.hallBreak.open);
        place(12, 27);
        check('the hall breaks: a hero by a wall that goes is struck', take(() => send({ move: 'breach' }), BREACH.warn + 0.4), BREACH.share);
        yes('the hall breaks: it is the round court', H.hallBreak.open && H.inHall(20, 27) && !H.inHall(27, 34));
        check('the hall breaks: the walls between the arms are out of the game', n0 - a.obstacles.length, H.HALL_OPENS.length, 0);
        yes('the hall breaks: a look goes from the nave into the transept', sees(12, 27, 20, 19));
        yes('the hall breaks: its rubble stands as cover', H.HALL_RUBBLE.length === 24 && H.HALL_RUBBLE.every((i) => a.obstacles.includes(def.place.obstacles[i])));
        yes('the hall breaks: the court has a wall of its own', !sees(15, 37, 20, 47));
        yes('the round court: an arm is its quarter', H.inArm(0, 20, 32) && !H.inArm(1, 20, 32) && H.inArm(1, 32, 20) && !H.inArm(0, 5, 15));
        check('the round court: a spot in the stone is pulled in to its wall', fromWell(H.intoHall(37, 44, 1)), H.HALL_COURT - 1, 0.01);
        check('the round court: his aim stays inside its wall', fromWell(def.moves.pillars.aim({ boss: { x: 0, z: 3 }, ring: { x: 0, z: 3 }, target: { x: 30, z: 37 }, step: 0, seed: 1 })), H.HALL_COURT - 1.8, 0.01);
        hall(5);
        place(0, 27);
        check('the hall breaks: in the middle of the nave nothing lands', take(() => send({ move: 'breach' }), BREACH.warn + 0.4), 0);
        hall(5, 'run');
        place(12, 27);
        d.playerHp = d.playerMax;
        send({ move: 'breach' });
        step(BREACH.warn + 0.4);
        yes('the hall breaks: the autopilot walked away from the wall', lost(d.playerMax) === 0 && a.caster.group.position.x < 13 - BREACH.reach);
        for (const [name, x, z, want] of [['in the safe quarter, where the stone stood', 20, 32, 0], ['in another quarter', 32, 20, HOUR.share], ['in the crossing', 3, 14, HOUR.share]]) {
          open();
          place(x, z);
          check(`hour in the round court: ${name}`, take(() => send({ move: 'strikes', seed: 0 }), HOUR.seconds + 0.4), want);
        }
        hall(5);
        {
          const seen = watch();
          d.boss.link.on.phase(2);
          d.boss.brain.pause = 0;
          step(0.2);
          yes('The Long Hour: the hall begins to break at once', seen.some((c) => c.move === 'breach'));
          for (let i = 0; i < 8; i++) { d.playerHp = d.playerMax; step(1); }
          yes('The Long Hour: it breaks open while his stage runs', H.hallBreak.open && seen.some((c) => c.move === 'hour'));
        }
        hall(5);
        {
          const seen = watch();
          d.boss.link.on.phase(2);
          d.boss.link.on.phase(3);
          d.boss.brain.pause = 0;
          for (let i = 0; i < 6; i++) { d.playerHp = d.playerMax; step(1); }
          yes('one hit through two phases: Last Light breaks the hall itself', H.hallBreak.open && seen.some((c) => c.move === 'sunfall') && !seen.some((c) => c.move === 'breach') && hallFight.fire > 0);
        }
        hall(5);
        yes('a new fight: the hall is whole again, and nothing burns', !H.hallBreak.open && hallFight.fire === 0 && a.obstacles.length === n0);

        // The sun comes down.
        open();
        place(3, 10);
        check('sunfire: it burns where it wells up', take(() => send({ move: 'sunfall' }), SUNFIRE.warn + 0.5), SUNFIRE.share);
        check('sunfire: and each second after', take(() => {}, 3), SUNFIRE.share * 3);
        place(10, 7);
        check('sunfire: 4 m past its edge, nothing yet', take(() => {}, 5), 0);
        check('sunfire: its edge is where its clock says', hallFight.fire, fireRadius(SUNFIRE.warn + 8.5), 0.03);
        for (let i = 0; i < 40; i++) { d.playerHp = d.playerMax; step(1); }
        yes('sunfire: 40 s on it has grown past that spot', take(() => {}, 2) >= SUNFIRE.share - 0.001);
        yes('sunfire: it grows for two and a half minutes, and stops 12 m short of the court\'s wall', fireRadius(SUNFIRE.warn + 150) === SUNFIRE.to && fireRadius(1e5) === SUNFIRE.to && H.HALL_COURT - SUNFIRE.to > 12);
        yes('sunfire: he comes out of it to the party, faster and closer', def.speed === 3 && def.keepAt === 2.2);
        cast('noon');
        step(0.1);
        {
          const o = active('noon')[0].played.objectives, r = hallFight.fire;
          yes('sunfire: Gathering Noon\'s shard falls past it, and is brought to its edge', fromWell(o[0]) >= r + 5 && H.inHall(o[0].x, o[0].z, 1) && o[1].radius > r + 2);
        }
        a.placeFoe(d.foe, new THREE_V(4, 0, 7 + hallFight.fire + 6));
        send({ move: 'anchors', fx: 4, fz: 7 + hallFight.fire + 6, seed: 3 });
        step(0.1);
        {
          const s = active('anchors')[0].played.threats[0].shape, r = hallFight.fire;
          yes('sunfire: the circle of Anchors lies by him, clear of the fire and of cover', fromWell(s) >= r + 3.9 && Math.hypot(s.x - 4, s.z - (7 + r + 6)) < 12 && H.inHall(s.x, s.z, 2) && freeOf(s, 2));
        }
        open(5, 'run');
        place(2, 15);
        send({ move: 'sunfall' });
        d.boss.brain.pause = 0;
        for (let i = 0; i < 60; i++) { d.playerHp = d.playerMax; step(1); }
        yes('sunfire: the autopilot keeps out of it as it grows', fromWell(a.caster.group.position) > hallFight.fire && (d.boss.stats.hits.sunfall ?? 0) <= 8);

        // Branded.
        hall(10);
        {
          const hs = crowd(40), marks = [0, 1, 2, 3, 4].map((k) => def.moves.brand.aim(ctx(hs, k, 99)));
          yes('Branded: 40 standing, five of them, each once', marks.every((m) => !m.flag && m.target !== undefined) && new Set(marks.map((m) => m.target)).size === 5);
          yes('Branded: the sun is over the hero the brain named', marks.every((m) => m.x === hs[m.target].x && m.z === hs[m.target].z));
          const moved = hs.map((h) => ({ ...h, x: h.x + 20 })), bursts = [5, 6, 7, 8, 9].map((k) => def.moves.brand.aim(ctx(moved, k, 99)));
          yes('Branded: it bursts where each of them stands five seconds on', bursts.every((b, k) => b.target === marks[k].target && b.x === moved[b.target].x));
          const few = crowd(10), m10 = [0, 1, 2].map((k) => def.moves.brand.aim(ctx(few, k, 7)));
          yes('Branded: 10 standing, one of them', !m10[0].flag && m10[1].flag === true && m10[2].flag === true);
          yes('Branded: a branded hero that fell bursts nowhere', def.moves.brand.aim(ctx(few.filter((h) => h.side !== m10[0].target), 5, 7)).flag === true);
        }
        place(0, 20);
        send({ move: 'brand', step: 0, x: 0, z: 20, target: 0 });
        step(0.2);
        yes('Branded: the branded hero\'s own ring is no zone to it', active('brand')[0].played.threats.length === 0);
        check('Branded: its own burst costs it the light hit', take(() => send({ move: 'brand', step: 5, x: 0, z: 20, target: 0 }), 1), BRAND.light);
        check('Branded: another\'s burst costs the heavy one', take(() => send({ move: 'brand', step: 5, x: 2, z: 20, target: 7 }), 1), BRAND.heavy);
        place(0, 20 + BRAND.radius + 1.5);
        check('Branded: out of its circle, nothing', take(() => send({ move: 'brand', step: 6, x: 0, z: 20, target: 7 }), 1), 0);
        send({ move: 'brand', step: 1, x: 0, z: 20, target: 7 });
        step(0.2);
        yes('Branded: another\'s ring is a zone an AI walks out of', d.boss.script.danger(0, 20, 0.4) && !d.boss.script.danger(0, 20 + BRAND.radius + 1.5, 0.4));
        check('Branded: but the ring itself never lands', take(() => { place(0, 20); }, BRAND.seconds + 2), 0);
        {
          // What the hub says of the others: the hero stands clear, and is told how many stood in the burst.
          d.boss.link.stood = () => {};
          place(0, 40);
          d.playerHp = d.playerMax;
          send({ move: 'brand', step: 5, x: 0, z: 20, target: 7 });
          step(0.6);
          d.boss.link.on.stood(seq, 0, 4);
          check('Branded: a burst that caught three others costs everyone', lost(d.playerMax), Math.min(BRAND.crowdMost, BRAND.crowd * 3));
          d.playerHp = d.playerMax;
          send({ move: 'brand', step: 5, x: 0, z: 20, target: 7 });
          step(0.6);
          d.boss.link.on.stood(seq, 0, 2);
          check('Branded: one other caught is that hero\'s own to bear', lost(d.playerMax), 0);
        }

        // Carry the Sun.
        hall(20);
        {
          const shards = (n) => def.moves.carry.aim(ctx(crowd(n), 0, 1)).x;
          yes('Carry the Sun: a shard for every five standing, eight at most', shards(40) === 8 && shards(20) === 4 && shards(12) === 2 && shards(3) === 1);
        }
        const carryCast = (x, seed = 31) => { send({ move: 'carry', x, seed }); step(0.1); return active('carry')[0]; };
        for (const [name, opened] of [['the hall whole', false], ['the round court', true]]) {
          if (opened) open(20); else hall(20);
          const o = carryCast(8).played.objectives, spots = o.slice(0, 8);
          yes(`Carry the Sun, ${name}: eight shards on open floor, far out`, o.length === 48 && spots.every((s) => H.inHall(s.x, s.z, 1.5) && freeOf(s, 1.2) && fromWell(s) > 22));
          yes(`Carry the Sun, ${name}: no two shards on one spot`, spots.every((s, i) => spots.every((t, j) => i === j || Math.hypot(s.x - t.x, s.z - t.z) > 5)));
        }
        hall(20);
        place(0, 12);
        {
          const c4 = carryCast(4), o = c4.played.objectives, noon = c4.played.threats[0];
          check('Carry the Sun: no shard home, Noon costs everyone this', noon.share, CARRY.base + CARRY.miss, 0.001);
          check('Carry the Sun: Noon lands when his bar is full', noon.at, CARRY.seconds, 0.001);
          check('Carry the Sun: his cast bar is its clock', d.boss.hud.castLen, CARRY.seconds, 0.001);
          place(o[0].x, o[0].z);
          step(0.1);
          yes('Carry the Sun: walking over a shard, the hero carries it', hallFight.carriers.has(0) && o[0].done === true && hallFight.carrying === 1);
          place(0, 9);
          step(0.1);
          yes('Carry the Sun: at the Sun Well it is home, and the cast bar says so', !hallFight.carriers.has(0) && d.boss.hud.castText.textContent.includes('1 of 4'));
          check('Carry the Sun: one of four home, Noon costs less', noon.share, CARRY.base + CARRY.miss * 0.75, 0.001);
          d.playerHp = d.playerMax;
          until(c4, CARRY.seconds + 0.5);
          check('Carry the Sun: and that is what it took', lost(d.playerMax), CARRY.base + CARRY.miss * 0.75);
          yes('Carry the Sun: (the hero stood, and nobody carries after)', d.playerHp > 0 && hallFight.carrying === 0 && hallFight.carriers.size === 0);
        }
        hall(20);
        place(0, 12);
        {
          const c1 = carryCast(1), o = c1.played.objectives;
          place(o[0].x, o[0].z);
          step(0.1);
          place(0, 9);
          step(0.2);
          yes('Carry the Sun: every shard home, he kneels', d.boss.stats.kneels === 1 && [...d.boss.link.paid].some((k) => k.endsWith(':carry')));
          d.playerHp = d.playerMax;
          step(CARRY.seconds + 1);
          check('Carry the Sun: and there is no Noon', lost(d.playerMax), 0);
        }
        open(20);
        send({ move: 'sunfall' });
        place(0, 40);
        step(SUNFIRE.warn + 1);
        {
          const o = carryCast(1).played.objectives;
          place(o[0].x, o[0].z);
          step(0.1);
          place(0, 7 + hallFight.fire + 1);
          step(0.2);
          yes('Carry the Sun in the sunfire: a shard is home at the fire\'s edge', d.boss.stats.kneels === 1 && fromWell(o[0]) > hallFight.fire + 10);
        }
        hall(20);
        {
          hallFight.carriers.add(1);
          const hs = [{ side: 1, x: 0, z: 33 }, { side: 2, x: 0.5, z: 20 }, { side: 3, x: 6, z: 25 }];
          const r = def.moves.ray.aim(ctx(hs, 0, 1));
          yes('Carry the Sun: a hero in the ray\'s way takes it for the carrier (the brain flags the cast)', r.flag === true && r.x === 0.5 && r.z === 20);
          const none = def.moves.ray.aim(ctx(hs.filter((h) => h.side !== 2), 0, 1));
          yes('Carry the Sun: nobody in its way, it goes for the carrier', !none.flag && none.z === 33);
          hallFight.carriers.clear();
          yes('nobody carries: his ray is as it was', !def.moves.ray.aim(ctx(hs, 0, 1)).flag);
        }
        a.placeFoe(d.foe, new THREE_V(0, 0, 10));
        place(0, 33);
        check('Carry the Sun: behind the hero who shields, the carrier is not hit', take(() => send({ move: 'ray', fz: 10, x: 0.5, z: 20, target: 1, flag: true }), 2.8), 0);
        place(0.3, 19.5);
        check('Carry the Sun: the hero who shields takes the ray', take(() => send({ move: 'ray', fz: 10, x: 0.5, z: 20, target: 1, flag: true }), 2.8), 0.22);

        // Whom he goes for (`BossDef.choose`). The brain asks it only with more than one screen, so it is asked here by hand: four
        // heroes, two in the nave, one in each transept, nobody in the choir; `when` says he aimed at the lower seats longer ago.
        hall(20);
        {
          const hs = [{ side: 0, x: 0, z: 30 }, { side: 1, x: 2, z: 31 }, { side: 2, x: 25, z: 7 }, { side: 3, x: -24, z: 8 }];
          const ask = (time) => def.choose({ heroes: hs, boss: { x: 0, z: 3 }, time, when: (side) => side });
          const quarter = (side) => H.quarterOf(hs[side].x, hs[side].z);
          yes('whom he goes for: no fire and nobody carrying, it is the brain to say', ask(0) === undefined);
          hallFight.carriers.add(3);
          yes('whom he goes for: whoever carries a shard', ask(0) === 3);
          hallFight.carriers.add(2);
          yes('whom he goes for: of two carriers, the one he aimed at longer ago', ask(0) === 2);
          hallFight.carriers.clear();
          hallFight.fire = 12;
          const first = ask(100);
          yes('in the sunfire he hunts one quarter of the court', first === 2 && quarter(first) === 1);
          yes('in the sunfire: and stays with it', [101, 105, 100 + HUNT_S - 1].every((t) => ask(t) === first));
          const next = ask(100 + HUNT_S + 0.5);
          yes('in the sunfire: then on to the next quarter with someone in it, past the empty one', next === 3 && quarter(next) === 3);
          yes('in the sunfire: and round to the nave, to the one he aimed at longer ago', ask(100 + 2 * HUNT_S + 1) === 0);
          hallFight.fire = 0;
        }
        fresh(0, 1);
        yes('the court for two: whom he goes for is the brain\'s to say, whatever burns', def.choose({ heroes: [{ side: 0, x: 0, z: 10 }, { side: 1, x: 3, z: 10 }], boss: { x: 0, z: 3 }, time: 0, when: () => 0 }) === undefined);

        // The Four Hours.
        hall(40);
        yes('The Four Hours: the brain counts those standing', def.moves.four.aim(ctx(crowd(37), 0, 1)).x === 37);
        const fourCast = (x = 40, seed = 8) => { send({ move: 'four', x, seed }); step(0.1); return active('four')[0]; };
        const open4 = () => (d.boss.hud.castText.textContent.split('·')[1] ?? '').trim().split(' ').filter((w) => ['NAVE', 'EAST', 'CHOIR', 'WEST'].includes(w));
        const circles = (f) => f.played.threats.filter((t) => t.kind === 'stand' && t.shape.kind === 'circle');
        place(0, 12);
        {
          const f = fourCast(), th = f.played.threats;
          yes('The Four Hours: three gold circles, two burning lanes, a gold lane, three stones, two shards',
            circles(f).length === 3 && th.filter((t) => t.kind !== 'stand' && t.shape.kind === 'line').length === 2 && th.filter((t) => t.kind === 'stand' && t.shape.kind === 'line').length === 1
            && a.summons.alive('opponent').length === 3 && f.played.objectives.filter((o) => o.part < 10).length === 2);
          yes('The Four Hours: everything it asks lies on open floor', [...circles(f).map((t) => t.shape), ...f.played.objectives.filter((o) => o.part < 40)].every((s) => H.inHall(s.x, s.z, 1.5) && freeOf(s, 1.2)));
          yes('The Four Hours: his cast bar names the four arms', open4().length === 4);
          check('The Four Hours: nothing done, the hall burns for all four', take(() => {}, FOUR.seconds + 0.5), FOUR.fail * 4);
          yes('The Four Hours: his stones are gone after', a.summons.alive('opponent').length === 0);
        }
        hall(40);
        place(0, 12);
        {
          const L = d.boss.link;
          L.stood = () => {};
          const f = fourCast(), id = f.cast.id;
          until(f, FOUR.seconds - FOUR.settle + 0.3);
          for (const t of circles(f)) L.on.stood(id, t.part, 1);
          yes('The Four Hours: every gold circle held, that arm is done', open4().length === 3 && [...L.paid].includes(`${id}:fourb`));
          check('The Four Hours: an arm done pays a quarter of his gauge', L.gauge, 25, 0.001);
          L.on.stood(id, 30, 4);
          yes('The Four Hours: four in the gold lane where five must stand, and it is not done', open4().length === 3);
          d.playerHp = d.playerMax;
          until(f, FOUR.seconds + 0.5);
          check('The Four Hours: one arm done, the hall burns for three', lost(d.playerMax), FOUR.fail * 3);
        }
        hall(40);
        place(0, 12);
        {
          const L = d.boss.link;
          L.stood = () => {};
          // Twenty standing: five an arm, so one shard, two circles, three in the lane.
          const f = fourCast(20), id = f.cast.id, o = f.played.objectives, rings = circles(f);
          yes('The Four Hours: twenty standing, it asks less of each arm', rings.length === 2 && o.filter((x) => x.part < 10).length === 1);
          for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 1e6, knock: 0 });
          step(0.2);
          yes('The Four Hours: his three stones broken, that arm is done', [...L.paid].includes(`${id}:fourc`));
          const shard = o.find((x) => x.part < 10);
          place(shard.x, shard.z);
          step(0.1);
          place(0, 9);
          step(0.2);
          yes('The Four Hours: its shard home, that arm is done', [...L.paid].includes(`${id}:foura`) && open4().length === 2);
          place(0, 12);
          until(f, FOUR.seconds - FOUR.settle + 0.3);
          for (const t of rings) L.on.stood(id, t.part, 1);
          L.on.stood(id, 30, 3);
          yes('The Four Hours: all four done, and he kneels', d.boss.stats.kneels === 1 && d.boss.hud.castText.textContent.includes('all done') && [...L.paid].filter((k) => k.startsWith(`${id}:four`)).length === 4);
          d.playerHp = d.playerMax;
          step(FOUR.settle + 1);
          check('The Four Hours: and the hall does not burn', lost(d.playerMax), 0);
          yes('The Four Hours: (nobody carries after)', hallFight.carrying === 0 && hallFight.carriers.size === 0);
        }
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
      const c = { id: ++seq, move, step: o.step ?? 0, x, z, fx: H.x, fz: H.z, dir: o.dir ?? Math.atan2(x - H.x, z - H.z), seed: o.seed ?? 4242, target: 0, alone: o.alone, flag: o.flag };
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
      const b2 = (sc = cast('stillb', { x: H.x, z: H.z }), step(0.05), beatsOf(sc.id));
      check('still: four beats in The Rings Turn', b2.length, 4, 0);
      check('still: 2.1 s apart', b2[1] - b2[0], 2.1, 0.001);
      fresh();
      const b3 = (sc = cast('stillc', { x: H.x, z: H.z }), step(0.05), beatsOf(sc.id));
      check('still: five beats in Noon Falls', b3.length, 5, 0);
      check('still: 1.6 s apart', b3[1] - b3[0], 1.6, 0.001);
      yes('still: each phase has its own, by the clock', def.phases.map((x) => x.timed?.move).join() === 'still,stillb,stillc');
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
      sc = cast('stillc', { x: H.x, z: H.z });
      step(10);
      check('still: with Solar Flare, standing where its gaps overlap costs nothing', lost(), 0);
      // With the Heartbeat: holding a plate is standing still, so the plate rises and the beats cost nothing behind it.
      fresh();
      const hc = cast('heartbeat', { x: H.x, z: H.z });
      step(1);
      const pl = live(hc.id).played.objectives[0];
      place(pl.x, pl.z);
      d.playerHp = d.playerMax;
      cast('stillc', { x: H.x, z: H.z });
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
      const party = (band, more = {}) => {
        d.startBoss({ def, link: new LocalLink(def), seed: 'heart', mode: 'play', band, ...more });
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
      // The other plate, by a partner: at 10 or more a plate left lying costs everyone (Shade the Heart together, below).
      d.boss.script.done(pbc.id, 1, 1);
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
      // The beat, and 8 % for each of the two plates left lying.
      check('party heartbeat: the fallen armillary\'s piece is no shelter from it', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0.4 + 0.16, 0.002);
      party(10);
      q0 = burstAt(5, 33, -4);
      place(q0.x, q0.z);
      check('party heartbeat: it reaches the far corner of a ray', take(() => cast('heartbeat', { x: H.x, z: H.z }), 10.5), 0.4 + 0.16, 0.002);
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

      // ---- A party's room changes with its phases, and three mechanics come only for a big party (2026-11-12) -------------------
      {
      const { heartFight, ringAngle, TURN, SECTORS, SHADE, BLADE, HANDS } = await import('/src/raid/heart.ts');
      const { burstFloor, BURST_RINGS } = await import('/src/arenas/sunburst.ts');
      const { bandFits } = await import('/src/raid/types.ts');
      const { RunUpgrades } = await import('/src/raid/upgrades.ts');
      const radOf = (x, z) => Math.hypot(x - H.x, z - H.z);
      const angOf = (x, z) => Math.atan2(x - H.x, z - H.z);
      const turnOf = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
      const me = () => a.caster.group.position;
      const heal = () => { d.playerHp = d.playerMax; };
      const RAD = Math.PI / 180;
      /** What the brain sees when it aims: `n` heroes standing. */
      const aimCtx = (seed, n = 7, step = 0) => ({ boss: H, ring: H, target: { x: 0, z: 13 }, step, seed, heroes: Array.from({ length: n }, (_, i) => ({ side: i, x: 0, z: 13 })), rayStop: () => 1, cover: () => [] });

      // The gate by band: what a smaller party never sees.
      party(5);
      check('band: the Heart knows the band it is tuned for', def.band, 5, 0);
      yes('band: Take the Blade is for 20 or more, The Ring of Hands for 40', !bandFits(def, def.moves.blade) && !bandFits(def, def.moves.hands));
      party(10);
      d.boss.brain.phase = 2;
      yes('band: at 10 the brain leaves both out of its lists', !d.boss.brain.listOf(true).includes('blade') && !d.boss.brain.listOf(true).includes('hands'));
      party(20);
      yes('band: at 20 Take the Blade fits, The Ring of Hands does not', def.band === 20 && bandFits(def, def.moves.blade) && !bandFits(def, def.moves.hands));
      d.boss.brain.phase = 1;
      yes('band: and the brain has the blade in its list', d.boss.brain.listOf(true).includes('blade') && !d.boss.brain.listOf(true).includes('hands'));
      party(40);
      yes('band: at 40 both fit', bandFits(def, def.moves.blade) && bandFits(def, def.moves.hands));
      d.boss.brain.phase = 2;
      yes('band: its great mechanics take turns: the blade first', d.boss.brain.listOf(true).includes('blade') && !d.boss.brain.listOf(true).includes('hands'));
      // The blade begins (the brain's aim says so): neither is in its lists until it is over and a breath has passed; then the ring.
      def.moves.blade.aim(aimCtx(1));
      step(BLADE.lasts + 5);
      yes('band: while one is in the air, and for a breath after, neither comes', !d.boss.brain.listOf(true).includes('blade') && !d.boss.brain.listOf(true).includes('hands'));
      step(12);
      yes('band: then The Ring of Hands has its turn', d.boss.brain.listOf(true).includes('hands') && !d.boss.brain.listOf(true).includes('blade'));
      yes('party phases: The Rings Turn opens with the rings, and the floor turns as soon as it may', def.phases[1].opener === 'rings' && def.phases[1].moves.includes('turn') && def.moves.turn.due === 0);
      yes('party phases: Noon Falls begins with the crust falling, by its own clock, the Heartbeat next', !def.phases[2].opener && def.phases[2].moves[0] === 'crust' && def.moves.crust.due === 0 && def.phases[2].moves.includes('heartbeat'));
      yes('party phases: every move\'s name passes the hub (letters only)', Object.keys(def.moves).every((id) => /^[a-z]{1,16}$/.test(id)));

      // The floor turns: three rings, the inner one stands, the middle and the outer one turn against each other and carry.
      party(10);
      place(0, 16.5);
      const tc = cast('turn', { x: H.x, z: H.z });
      step(0.05);
      const warmT = heartFight.warm, sense = heartFight.sense;
      yes('turn: the floor turns from its cast on', heartFight.turning === true && Math.abs(sense) === 1);
      check('turn: it warns 5 s first', warmT, TURN.warn, 0.001);
      step(warmT - 0.3);
      yes('turn: nothing moves while it warns', burstFloor.mid === 0 && burstFloor.out === 0 && Math.abs(me().x) < 1e-6 && Math.abs(me().z - 16.5) < 1e-6);
      step(0.3 + TURN.spin + 4);
      check('turn: the middle ring stands where the rule of the time since the cast says', burstFloor.mid, ringAngle(sense * TURN.mid * RAD, since(tc.id), warmT), 1e-9);
      check('turn: the outer ring too', burstFloor.out, ringAngle(-sense * TURN.out * RAD, since(tc.id), warmT), 1e-9);
      yes('turn: the outer ring turns against the middle one', Math.sign(burstFloor.mid) === sense && Math.sign(burstFloor.out) === -sense);
      check('turn: at speed the middle ring makes 9 degrees a second', (ringAngle(TURN.mid * RAD, 20, 5) - ringAngle(TURN.mid * RAD, 19, 5)) / RAD, 9, 1e-9);
      check('turn: and the outer one 6', (ringAngle(TURN.out * RAD, 20, 5) - ringAngle(TURN.out * RAD, 19, 5)) / RAD, 6, 1e-9);
      check('turn: a hero on the middle ring is carried round with it', turnOf(0, angOf(me().x, me().z)), burstFloor.mid, 0.002);
      check('turn: and stays as far from the Heart', radOf(me().x, me().z), 9.5, 0.01);
      let q1 = polar(40, 15);
      const o0 = burstFloor.out;
      place(q1.x, q1.z);
      step(3);
      check('turn: a hero on the outer ring goes the other way', turnOf(40 * RAD, angOf(me().x, me().z)), burstFloor.out - o0, 0.002);
      place(0, 11);
      step(2);
      yes('turn: the inner ring stands', Math.abs(me().x) < 1e-6 && Math.abs(me().z - 11) < 1e-6);
      q1 = burstAt(1, 25);
      place(q1.x, q1.z);
      step(2);
      yes('turn: and so do the rays, with the lock spots and the fallen armillary', Math.abs(me().x - q1.x) < 1e-6 && Math.abs(me().z - q1.z) < 1e-6);
      // To be carried is no walk: Hold Still finds a hero on a turning ring standing.
      place(0, 16.5);
      heal();
      sc = cast('stillb', { x: H.x, z: H.z });
      step(0.05);
      const from0 = { x: me().x, z: me().z };
      toBeat(sc.id, 0, -0.3);
      yes('turn: a hero standing on a ring is carried through a beat', Math.hypot(me().x - from0.x, me().z - from0.z) > 3);
      check('turn: to be carried is no walk: the beat costs it nothing', lost(), 0);
      heal();
      toBeat(sc.id, 1, 0.5);
      walkFor(1);
      check('turn: walking on a ring through a beat still burns', lost(), 0.12);
      // The beams of The Rings Turn turn against the floor.
      const rb = [0, 1].map((i) => cast('rings', { step: i, x: H.x, z: H.z }));
      step(0.05);
      const rbT = rb.map((x) => live(x.id).played.threats[0]);
      const wayOf = (th) => Math.sign(turnOf(beamAt(th, th.at + 1) * RAD, beamAt(th, th.at + 2) * RAD));
      yes('turn: the beams turn against the floor: the first against the middle ring, the second against the outer', wayOf(rbT[0]) === -sense && wayOf(rbT[1]) === sense);
      const again = cast('turn', { x: H.x, z: H.z, seed: 99 });
      step(0.5);
      yes('turn: cast again (a brain that took the fight over), it does nothing', !live(again.id) && heartFight.sense === sense && Math.abs(burstFloor.mid - ringAngle(sense * TURN.mid * RAD, since(tc.id), warmT)) < 1e-9);

      // The crust falls: the rings stop when the brain says, each on an eighth of a turn.
      const stopAim = def.moves.crust.aim(aimCtx(5));
      check('crust: the brain names when the rings begin to stop, 1.5 s ahead on the floor\'s own clock', stopAim.x - heartFight.clock, TURN.lead, 0.02);
      const stopX = +stopAim.x.toFixed(3);
      cast('crust', { x: stopX, z: 0 });
      step(0.05);
      yes('crust: from its cast on a Heartbeat takes a sector', heartFight.crust === true && heartFight.stopAt === stopX);
      yes('crust: the rings rest within 8 s, and take at least 3 s over it', heartFight.restAt - stopX <= TURN.rest + 1e-9 && heartFight.restAt - stopX >= TURN.brake - 1e-9);
      d.boss.brain.phase = 2;
      yes('crust: the Heartbeat waits until they rest', !d.boss.brain.listOf(true).includes('heartbeat'));
      yes('crust: until they rest the brain says the floor still turns', def.moves.heartbeat.aim(aimCtx(3)).flag === true);
      step(heartFight.restAt - heartFight.clock + 0.2);
      const eighths = (v) => Math.abs(v / (Math.PI / 4) - Math.round(v / (Math.PI / 4)));
      yes('crust: each ring rests on an eighth of a turn', eighths(burstFloor.mid) < 1e-6 && eighths(burstFloor.out) < 1e-6);
      yes('crust: then the Heartbeat is in its list again', d.boss.brain.listOf(true).includes('heartbeat'));
      place(0, 16.5);
      step(2);
      yes('crust: and carries nobody any more', Math.abs(me().x) < 1e-6 && Math.abs(me().z - 16.5) < 1e-6);

      // After each Heartbeat a sector glows and falls: the brain's pick, from the cast's seed.
      const picks = Array.from({ length: 200 }, (_, k) => -def.moves.heartbeat.aim(aimCtx(k + 1)).z - 1);
      yes('crust: the brain names a sector in the Heartbeat\'s cast, and how many heroes stand', def.moves.heartbeat.aim(aimCtx(3)).x === 7 && picks.every((k) => k >= 0 && k <= 7));
      yes('crust: any ray but the north one, with the way out', !picks.includes(4) && new Set(picks).size === 7);
      yes('crust: the same seed, the same sector', def.moves.heartbeat.aim(aimCtx(3)).z === def.moves.heartbeat.aim(aimCtx(3)).z);
      yes('crust: the floor rests, so the plates fall before the spurs', def.moves.heartbeat.aim(aimCtx(3)).flag === undefined);
      q0 = burstAt(2, 28);
      place(q0.x, q0.z);
      pbc = cast('heartbeat', { x: 7, z: -3, dir: 0 });
      step(0.05);
      php = live(pbc.id);
      pat = php.played.threats[0].at;
      const fallT = php.played.threats.find((th) => th.hits && th.at > pat);
      check('crust: the sector goes 9 s after the beat', fallT.at - pat, SECTORS.warn, 0.001);
      step(pat - since(pbc.id) - 0.2);
      yes('crust: it does not glow before the beat', burstFloor.cracked(2) === 0);
      step(0.2 + 4.5);
      check('crust: it glows along its cracks from the beat on, more as it nears', burstFloor.cracked(2), 0.5, 0.02);
      yes('crust: an AI sees that ray as danger, and no other', d.boss.script.danger(q0.x, q0.z, 1) && !d.boss.script.danger(burstAt(3, 28).x, burstAt(3, 28).z, 1));
      const arc2 = def.place.obstacles[2];
      yes('crust: its piece of cover still stands', a.obstacles.includes(arc2));
      heal();
      step(fallT.at - since(pbc.id) + 0.1);
      yes('crust: the sector is gone', burstFloor.gone(2) && burstFloor.fallen === 1 && burstFloor.lost(q0.x, q0.z));
      check('crust: standing on it as it goes costs 40 %', lost(), SECTORS.share + SECTORS.burn, 0.002);
      yes('crust: its piece of cover went with it', !a.obstacles.includes(arc2));
      heal();
      step(2.05);
      check('crust: what is gone burns each second', lost(), 2 * SECTORS.burn, 0.002);
      heal();
      q0 = polar(112.5, 15);
      place(q0.x, q0.z);
      step(1.2);
      check('crust: a spoke of crust to each spur\'s nose stays', lost(), 0);
      const lostAt = (q) => burstFloor.lost(q.x, q.z);
      yes('crust: the inner ring and the other rays stay', !burstFloor.lost(0, 12) && !lostAt(burstAt(1, 25)) && !lostAt(burstAt(3, 25)) && !lostAt(burstAt(2, 6)));
      yes('crust: a sector is its ray and its slice of the well', lostAt(burstAt(2, 10)) && lostAt(burstAt(2, 33, 5)) && lostAt(burstAt(2, 14, -3)) && !lostAt(burstAt(2, 12, 4)));
      // The rings' rows of spots: only in rays that stand, and lost with their ray.
      const rr = [0, 1, 2].map((i) => cast('rings', { step: i, x: H.x, z: H.z }));
      step(0.05);
      const rayOfSpot = (o) => Math.round(deg(o.x, o.z) / 45) % 8;
      const rowRays = rr.map((x) => rayOfSpot(live(x.id).played.objectives[0]));
      yes('crust: the rings\' rows stand in three rays that still stand', !rowRays.includes(2) && new Set(rowRays).size === 3);
      const row0 = live(rr[0].id).played.objectives[0];
      step(live(rr[0].id).played.threats[0].at + 0.2);
      yes('crust: such a row can be held', row0.can() === true);
      burstFloor.fall(rowRays[0], true);
      yes('crust: and is lost when its ray falls', row0.can() === false);
      for (const k of [0, 1, 3, 5, 6, 7]) burstFloor.fall(k, true);
      yes('crust: six sectors at most: then the Heartbeat takes none', burstFloor.fallen >= SECTORS.most && def.moves.heartbeat.aim(aimCtx(9)).z === 0);
      d.boss.script.clear();
      yes('crust: when the fight ends what fell crusts over, to be walked on', burstFloor.fallen === 0 && !lostAt(burstAt(2, 28)));
      party(10);
      yes('crust: a new fight has the floor whole and still, and its cover back', burstFloor.mid === 0 && burstFloor.out === 0 && !heartFight.turning && !heartFight.crust && a.obstacles.includes(arc2));
      cast('crust', { x: 0, z: 0 });
      step(0.05);
      yes('crust: on a floor that never turned (one hit past the second phase) it simply begins', heartFight.crust && !heartFight.turning && heartFight.stopAt === Infinity);

      // Shade the Heart together (10 or more): a plate for every five heroes standing, and a plate left lying costs everyone.
      const platesFor = (b, x) => { party(b); const hb = cast('heartbeat', { x, z: 0 }); step(0.05); return live(hb.id).played; };
      check('shade: a plate for every five heroes standing: 7 stand, 2 plates', platesFor(10, 7).objectives.length, 2, 0);
      check('shade: 23 stand, 5 plates', platesFor(30, 23).objectives.length, 5, 0);
      check('shade: 40 stand, 8 plates, one before each spur', platesFor(40, 40).objectives.length, 8, 0);
      check('shade: 3 stand, one plate', platesFor(10, 3).objectives.length, 1, 0);
      const five = platesFor(5, 4);
      yes('shade: a party of five has its one plate, simply cover: a plate left lying costs nothing more', five.objectives.length === 1 && !five.threats.some((th) => th.tally));
      party(10);
      pbc = cast('heartbeat', { x: 10, z: 0, dir: 100 * RAD });
      step(1.05);
      d.boss.script.done(pbc.id, 0, 1);
      heal();
      q0 = polar(112.5, 15.5);
      place(q0.x, q0.z);
      step(live(pbc.id).played.threats[0].at - since(pbc.id) + 0.3);
      check('shade: one plate of two left lying costs everyone 8 %, sheltered or not', lost(), SHADE.leak, 0.002);
      party(40);
      pbc = cast('heartbeat', { x: 40, z: 0 });
      step(1.05);
      heal();
      place(0, 27);
      step(live(pbc.id).played.threats[0].at - since(pbc.id) + 0.3);
      check('shade: all eight left lying: the beat, and 32 % more at most', lost(), 0.4 + SHADE.most, 0.002);
      // On a floor that still turns the plates fall on the inner ring, which stands.
      party(10);
      cast('turn', { x: H.x, z: H.z });
      step(8);
      yes('shade: the brain says when the floor turns', def.moves.heartbeat.aim(aimCtx(3)).flag === true && def.moves.heartbeat.aim(aimCtx(3)).z === 0);
      pbc = cast('heartbeat', { x: 10, z: 0, dir: 100 * RAD, flag: true });
      step(1.05);
      php = live(pbc.id);
      check('shade: then a plate falls 4.9 m out, on the ring that stands', radOf(php.played.objectives[0].x, php.played.objectives[0].z), SHADE.innerOut, 0.001);
      d.boss.script.done(pbc.id, 0, 1);
      d.boss.script.done(pbc.id, 1, 1);
      heal();
      q0 = polar(112.5, 5.6);
      place(q0.x, q0.z);
      step(php.played.threats[0].at - since(pbc.id) + 0.3);
      check('shade: and its pocket is on that ring too', lost(), 0);

      // Take the Blade (20 or more).
      party(20, { upgrades: new RunUpgrades() });
      place(0, 20);
      const bc = cast('blade', { x: H.x, z: H.z });
      step(0.05);
      const bl = live(bc.id).played;
      step(BLADE.land + 0.1);
      const blades = [0, 1].map((k) => bl.objectives.find((o) => o.part === k * 10));
      yes('blade: its two blades stand in the floor 5.2 m from it, across from each other', blades.every((o) => Math.abs(radOf(o.x, o.z) - BLADE.out) < 0.01)
        && Math.abs(Math.abs(turnOf(angOf(blades[0].x, blades[0].z), angOf(blades[1].x, blades[1].z))) - Math.PI) < 0.01);
      yes('blade: the body shows them out of its hands, standing in the floor', HEART_LIVE.blades.every((k) => k.out === 1 && Math.abs(k.y - (2.2 * BLADE.stands - 0.5)) < 1e-9));
      yes('blade: both can be taken', blades.every((o) => o.can()) && d.boss.script.goldSpots().length >= 2);
      const walk0 = vfx.heroMode.speedBonus;
      place(blades[0].x, blades[0].z);
      step(0.1);
      yes('blade: walking onto one takes it', blades[0].done === true && heartFight.carriers.has(0));
      check('blade: its carrier\'s hits on the Heart count twice', d.boss.upgrades.dealtMul(false), BLADE.might, 0);
      yes('blade: and it walks slower', vfx.heroMode.speedBonus < walk0);
      yes('blade: one hero, one blade', blades[1].can() === false);
      check('blade: the Heart\'s aim goes to a carrier', def.choose({ heroes: [{ side: 3, x: 0, z: 9 }, { side: 0, x: 0, z: 20 }], boss: H, time: 0, when: () => 0 }), 0, 0);
      // A lance of light at the carrier: the brain aims it, and it ends on the first hero in its line.
      const lanceAim = (heroes) => def.moves.blade.aim({ ...aimCtx(4242, 0, 1), heroes });
      let la = lanceAim([{ side: 0, x: 0, z: 20 }, { side: 1, x: 6, z: 12 }]);
      yes('blade: with nobody in its line the lance ends on the carrier', la.target === 0 && la.x === 0 && la.z === 20 && !la.flag);
      la = lanceAim([{ side: 0, x: 0, z: 20 }, { side: 1, x: 0.4, z: 14 }, { side: 2, x: -0.5, z: 17 }]);
      yes('blade: a hero standing in its line stops it: the one nearest the Heart', la.target === 1 && la.x === 0.4 && la.z === 14);
      place(0, 20);
      heal();
      cast('blade', { step: 1, x: 0.4, z: 14, dir: 0 });
      step(BLADE.warn + 0.3);
      check('blade: behind a friend who stands in the lance, the carrier takes nothing', lost(), 0);
      yes('blade: and keeps the blade', heartFight.carriers.has(0));
      heal();
      cast('blade', { step: 1, x: 0, z: 20, dir: 0 });
      step(BLADE.warn + 0.3);
      check('blade: a lance that reaches the carrier costs it 35 %', lost(), BLADE.hit, 0.002);
      yes('blade: and knocks the blade from its hands', !heartFight.carriers.has(0) && d.boss.upgrades.dealtMul(false) === 1 && vfx.heroMode.speedBonus === walk0);
      const second = bl.objectives.find((o) => o.part === 1);
      yes('blade: it lies where the lance was aimed, for another', Math.abs(second.x) < 0.01 && Math.abs(second.z - 20) < 0.01 && Math.abs(HEART_LIVE.blades[0].y - (2.2 * BLADE.stands - 0.5)) < 1e-9 && Math.abs(HEART_LIVE.blades[0].z - 20) < 0.01);
      place(0, 20);
      step(0.2);
      yes('blade: who dropped it can not take it again at once', !heartFight.carriers.has(0));
      // A partner takes the other and falls: its own screen says so, and the blade lies there for another.
      d.boss.script.done(bc.id, 10, 1);
      yes('blade: a partner takes the other', heartFight.carriers.has(1) && blades[1].done === true);
      d.boss.script.done(bc.id, 110, 1);
      step(0.1);
      yes('blade: its carrier fell: it lies there again', !heartFight.carriers.has(1) && bl.objectives.find((o) => o.part === 11).can() === true);
      step(BLADE.again);
      place(0, 20);
      step(0.1);
      yes('blade: after 3 s the first can take one again', heartFight.carriers.has(0));
      step(BLADE.burn);
      yes('blade: a blade is spent after 12 s in heroes\' hands', !heartFight.carriers.has(0) && d.boss.upgrades.dealtMul(false) === 1);
      yes('blade: with no carrier standing the lance does not come', lanceAim([{ side: 0, x: 0, z: 20 }]).flag === true);
      step(BLADE.lasts - since(bc.id) + 2);
      yes('blade: at the end the blades are back in its hands', HEART_LIVE.blades.every((k) => k.out === 0) && !live(bc.id));
      yes('blade: while they are out it does only what needs no blade', ['sweep', 'fall'].every((m) => !def.moves.blade.holds.only.includes(m)));
      yes('blade: the crust still falls and the heart still beats meanwhile', ['crust', 'turn', 'heartbeat'].every((m) => def.moves.blade.holds.only.includes(m)));
      // The lance stops at cover, and costs who stands in its way less.
      party(20);
      q0 = burstAt(2, 27, 3.4);
      place(q0.x, q0.z);
      check('blade: behind the fallen armillary\'s piece the lance does not reach', take(() => cast('blade', { step: 1, x: q0.x, z: q0.z }), BLADE.warn + 0.3), 0);
      q0 = burstAt(2, 20, 3.4);
      place(q0.x, q0.z);
      check('blade: a hero who is no carrier pays 15 % for standing in it', take(() => cast('blade', { step: 1, x: q0.x, z: q0.z }), BLADE.warn + 0.3), BLADE.block, 0.002);

      // The Ring of Hands (40).
      party(40);
      place(0, 25);
      let hc = cast('hands', { x: 32, z: 0 });
      step(0.05);
      let hp = live(hc.id).played;
      check('hands: a gold spot for every hero standing', hp.objectives.length, 32, 0);
      yes('hands: all on the inner ring of the floor, which neither turns nor falls', hp.objectives.every((o) => radOf(o.x, o.z) + HANDS.radius < BURST_RINGS.inner));
      const nearest = (list) => { let m = Infinity; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.min(m, Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z)); return m; };
      yes('hands: no two spots overlap', nearest(hp.objectives) >= 2 * HANDS.radius);
      const labels = [], relabel0 = d.boss.hud.relabel;
      d.boss.hud.relabel = (text) => { labels.push(text); return relabel0.call(d.boss.hud, text); };
      place(hp.objectives[0].x, hp.objectives[0].z);
      step(HANDS.hold + 0.2);
      yes('hands: holding a spot a second makes it this hero\'s', hp.objectives[0].done === true);
      yes('hands: one hero, one spot', hp.objectives[1].can() === false);
      for (let i = 1; i < 25; i++) d.boss.script.done(hc.id, i, i);
      yes('hands: the count is on the cast bar', labels.at(-1) === 'The Ring of Hands · 25 of 26');
      const kn0 = d.boss.stats.kneels;
      heal();
      d.boss.script.done(hc.id, 25, 25);
      step(0.2);
      yes('hands: four in five held: the Heart is stunned, it kneels', d.boss.stats.kneels === kn0 + 1);
      step(HANDS.seconds);
      check('hands: and nobody is burnt', lost(), 0);
      d.boss.hud.relabel = relabel0;
      party(40);
      place(0, 25);
      hc = cast('hands', { x: 32, z: 0 });
      step(0.05);
      for (let i = 0; i < 25; i++) d.boss.script.done(hc.id, i, i + 1);
      const kn1 = d.boss.stats.kneels;
      heal();
      step(HANDS.seconds + 0.5);
      check('hands: one short when it closes: a broken ring burns everyone', lost(), HANDS.fail, 0.002);
      yes('hands: and the Heart does not kneel', d.boss.stats.kneels === kn1);
      party(40);
      hc = cast('hands', { x: 40, z: 0 });
      step(0.05);
      hp = live(hc.id).played;
      {
        // Through the hub the answer takes a moment. A hero midway between two neighbours, in reach of both, asks for one only.
        const asks = [], objective0 = d.boss.link.objective;
        d.boss.link.objective = (id, part) => { asks.push(part); };
        const pair = hp.objectives.slice(0, 2);
        yes('hands: the reach of two neighbours overlaps', Math.hypot(pair[0].x - pair[1].x, pair[0].z - pair[1].z) < 2 * HANDS.reach);
        place((pair[0].x + pair[1].x) / 2, (pair[0].z + pair[1].z) / 2);
        step(HANDS.hold + 0.4);
        d.boss.link.objective = objective0;
        check('hands: a hero in reach of two spots asks the hub for one, while its answer is on the way', asks.length, 1, 0);
        d.boss.script.done(hc.id, asks[0], 0);
        step(0.3);
        yes('hands: and none once it has one', asks.length === 1 && hp.objectives.every((o) => !o.can()));
      }
      yes('hands: forty spots for forty, two rings deep, none overlapping', hp.objectives.length === 40 && nearest(hp.objectives) >= 2 * HANDS.radius && hp.objectives.every((o) => radOf(o.x, o.z) + HANDS.radius < BURST_RINGS.inner));
      yes('hands: it does nothing else meanwhile', def.moves.hands.holds.only.length === 0);

      // The brain itself, through the phases: the floor turns, the crust falls, a Heartbeat takes a sector.
      d.startBoss({ def, link: new LocalLink(def), seed: 'heart-flow', mode: 'play', band: 10 });
      a.placeFoe(d.foe, new V(H.x, 0, H.z));
      const alive = (secs) => { for (let i = 0; i < secs * 4; i++) { heal(); step(0.25); } };
      alive(1);
      d.boss.link.damage(d.boss.link.maxHp * 0.36);
      alive(9);
      yes('flow: as The Rings Turn begins the brain turns the floor', heartFight.turning === true && d.boss.stats.phases === 1);
      alive(10);
      yes('flow: and it moves', Math.abs(burstFloor.mid) > 0.5 && Math.abs(burstFloor.out) > 0.3);
      d.boss.link.damage(d.boss.link.maxHp * 0.33);
      alive(5);
      yes('flow: as Noon Falls begins the crust falls, and the rings begin to stop', d.boss.stats.phases === 2 && heartFight.crust === true && heartFight.stopAt < Infinity);
      alive(31);
      yes('flow: the first Heartbeat of Noon Falls takes a sector with it', burstFloor.fallen === 1);

      // The room for two has none of it.
      fresh();
      const st2 = cast('turn', { x: H.x, z: H.z }), sk2 = cast('crust', { x: 0, z: 0 });
      step(0.2);
      yes('for two: the floor neither turns nor falls', !heartFight.turning && !heartFight.crust && !live(st2.id) && !live(sk2.id) && def.band === 2);
      yes('for two: its phases are as they were', def.phases[1].opener === 'rings' && def.phases[2].opener === 'heartbeat' && !def.phases[1].moves.includes('turn'));
      }

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

  // Twin Flames (a party's Ash and Ember, both at once, a wall of fire between them): what one screen can check, with the local
  // link deciding what the hub decides (src/raid/twin.ts). The room and the wall, each boss's moves in its own half, the other
  // boss's as a look only, the furious rule, a fall on either side of the wall, each half's stage and vent, the autopilot.
  //   await _raidTwin()   // { ok, failed, rows }
  window._raidTwin = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { twinFlames } = await import('/src/raid/ashEmber.ts');
    const { TwinLocalLink, FURY_HIT, FURY_GAP } = await import('/src/raid/twin.ts');
    const { TWIN_WALL, TWIN_PILLARS, TWIN_LAYOUT, TWIN_R, twinPillarCount } = await import('/src/arenas/twinpit.ts');
    const { RAID_TWIN, raidHp, raidStaggerMax } = await import('/server/protocol.mjs');
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
    let seq = 500, link;
    /** A new fight on this screen: its hero in `half` (0 west with Ash, 1 east with Ember), both brains quiet. */
    const fresh = (half = 0, band = 10) => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.autopilot = false;
      const def = twinFlames(half);
      link = new TwinLocalLink(def, band, half);
      d.startBoss({ def, link, seed: 'twin', mode: 'play', band, twin: link.setup });
      d.boss.brain.pause = 1e9;
      a.obstacles = a.obstacles.slice();
      step(0.05);
      return link;
    };
    const me = () => a.caster.group.position;
    const place = (x, z) => a.caster.group.position.set(x, 0, z);
    const boss = (x, z) => a.placeFoe(d.foe, new V(x, 0, z));
    /** A cast as a brain would send it: `which` 0 Ash, 1 Ember; from where that boss stands unless said. */
    const cast = (move, which, o = {}) => {
      const mine = d.boss.which === which, b = mine ? d.foe.group.position : d.twin.enemy.group.position;
      const x = o.x ?? me().x, z = o.z ?? me().z;
      const c = { id: ++seq + which * RAID_TWIN.ids, move, step: o.step ?? 0, x, z, fx: o.fx ?? b.x, fz: o.fz ?? b.z, dir: o.dir ?? Math.atan2(x - b.x, z - b.z), seed: o.seed ?? 777, target: 0, flag: o.flag, alone: o.alone, which };
      link.on.cast(c);
      return c;
    };
    const lost = () => (d.playerMax - d.playerHp) / d.playerMax;
    const take = (fn, s) => { d.playerHp = d.playerMax; fn(); step(s); return lost(); };
    const scriptOf = (which) => d.boss.twin.scripts[which];
    const POOL = Math.round(raidHp('ash', 10, 1) / 2);
    try {
      // The room and who stands where.
      fresh(0);
      check('room: the floor reaches 30 m', a.bounds.r, TWIN_R, 0);
      yes('room: the wall of fire is cover that never breaks', a.obstacles.includes(TWIN_WALL) && TWIN_WALL.fixed === true && d.wallHp === null);
      check('room: a party tuned for 10 has six pillars', TWIN_PILLARS.length, 6, 0);
      yes('room: 5 for 5, 8 for 20, 11 for 40', twinPillarCount(5) === 5 && twinPillarCount(20) === 8 && twinPillarCount(40) === 11);
      yes('room: every pillar is in Ash\'s half, and on the floor', TWIN_LAYOUT.pillars.every(([x, z]) => x < -2.5 && Math.hypot(x, z - 7) < TWIN_R - 2));
      yes('west: this hero comes in west of the wall, by the south gate', me().x < -1.5 && me().z > 7 + TWIN_R - 8);
      yes('west: its enemy is Ash, at his place in the west', d.boss.def.name === 'Ash' && d.foe.group.position.x < -5 && d.boss.which === 0);
      yes('west: Ember is across the wall, drawn only', d.twin.enemy.group.position.x > 5 && a.liveFoes().length === 1);
      check('each has half the HP of the band', link.maxHp, POOL, 0);
      check('and half its gauge', link.staggerMax, raidStaggerMax('ash', 10) / 2, 0);
      fresh(1);
      yes('east: this hero comes in east of the wall', me().x > 1.5);
      yes('east: its enemy is Ember, over her vent', d.boss.def.name === 'Ember' && d.foe.group.position.x > 5 && d.boss.which === 1 && d.twin.enemy.group.position.x < -5);

      // The wall: no walking, no sight, no bolt through it; a blow, a carry and a dash end at it.
      fresh(0);
      place(-3, 12);
      for (let i = 0; i < 180; i++) { a.walk(new V(4 / 60, 0, 0)); step(1 / 60); }
      yes('wall: a hero walking at it stays on its side', me().x < -TWIN_LAYOUT.wallHalf && me().x > -2.2);
      yes('wall: nobody sees through it', !a.lineOfSight(new V(-3, 0, 12), new V(3, 0, 12)) && a.lineOfSight(new V(-3, 0, 12), new V(-3, 0, 4)));
      check('wall: a bolt stops at its near face', a.coverStop({ x: -5, z: 12 }, { x: 5, z: 12 }), (5 - TWIN_LAYOUT.wallHalf) / 10, 0.03);
      place(-1.6, 12);
      d.boss.script.world.hitMe({ share: 0.01, knock: 6, from: { x: -6, z: 12 }, move: 'test' });
      step(1.2);
      yes('wall: a blow that throws a hero 6 m at it leaves it on its side', me().x < -TWIN_LAYOUT.wallHalf);
      place(-1.6, 12);
      for (let i = 0; i < 20; i++) { a.carryFigure(a.caster, new V(0.25, 0, 0)); step(1 / 60); }
      yes('wall: so does a carry', me().x < -TWIN_LAYOUT.wallHalf);
      place(-2.5, 12);
      a.moveFigure(a.caster, new V(4, 0, 12), 0.25);
      step(0.6);
      yes('wall: and a dash aimed across it ends at the wall', me().x < -TWIN_LAYOUT.wallHalf && me().x > -2);
      place(-2.5, 12);
      a.caster.group.position.set(6, 0, 12);
      step(0.05);
      yes('wall: whatever puts a hero across it, it is back in its half the next moment', me().x < -TWIN_LAYOUT.wallHalf);

      // Ash's moves in his half hit this hero; Ember's across the wall are a look only.
      fresh(0);
      boss(-10, 12);
      place(-8, 12);
      check('Ash: his slam costs what it does for two', take(() => cast('slam', 0), 1.7), 0.18);
      place(-8, 12);
      check('Ember: her bombs across the wall cost this hero nothing, wherever they are aimed', take(() => cast('bombs', 1), 1.9), 0);
      d.playerHp = d.playerMax;
      cast('bombs', 1, { x: -8, z: 12 });
      step(0.5);
      yes('Ember: and are no danger to an AI here', !d.boss.script.danger(-8 + 2.7, 12, 3) && scriptOf(1).active.length === 1);
      yes('Ember: her zones are cut off at the wall, on her side', scriptOf(1).clip().nx === 1 && scriptOf(0).clip().nx === -1);
      step(2);
      // A zone of Ash's that reaches across the wall: drawn to the wall, and the ring is the party's (4.5 to 14 m).
      boss(-3, 12);
      place(-3, 22.2);
      check('Ash: Drag Under burns from 4.5 to 14 m from him', take(() => cast('drag', 0), 2.3), 0.16);
      step(1);
      place(-3, 31.5);
      check('Ash: and nothing past 14 m (it has dragged this hero 3 m nearer by then)', take(() => cast('drag', 0), 2.3), 0);
      // Her stage is hers: this screen's boss stays open to hits, and her adds are out of this hero's reach.
      const es = cast('erupte', 1, { x: TWIN_LAYOUT.hold[1].x, z: TWIN_LAYOUT.hold[1].z });
      step(0.5);
      const adds = a.summons.alive('opponent');
      yes('Ember\'s Eruption: Ash can still be hurt here', d.bossGuard === false);
      yes('Ember\'s Eruption: her three Coal Hearts stand in her half, and the autopilot leaves them', adds.length === 3 && adds.every((u) => u.pos.x > 1) && adds.every((u) => !d.reachable(u.pos)));
      yes('Ember\'s Eruption: nothing of it is this hero\'s to do', d.boss.script.objectiveGoal(me().x, me().z) === null && d.boss.script.goldSpots().length === 0);
      const hp0 = a.hpOf(d.foe);
      a.hit(d.foe, { damage: 200, knock: 0 });
      yes('Ember\'s Eruption: a hit on Ash lands', hp0 - a.hpOf(d.foe) >= 200);
      void es;

      // Ash's Charge: it ends at the wall of fire, and at a pillar as in the pit for two.
      fresh(0);
      const charging = (tx, tz) => {
        const m = d.boss.def.moves.charge, world = d.boss.script.world, b = d.foe.group.position;
        place(tx, tz);
        const send = (n) => {
          const aim = m.aim({ boss: { x: b.x, z: b.z }, ring: { x: b.x, z: b.z }, target: { x: me().x, z: me().z }, step: n, seed: 1, rayStop: (ax, az, bx, bz) => world.rayStop(ax, az, bx, bz), cover: () => world.cover() });
          const c = { id: ++seq, move: 'charge', step: n, x: aim.x, z: aim.z, fx: b.x, fz: b.z, dir: aim.dir, seed: 1, target: 0, flag: aim.flag, which: 0 };
          link.on.cast(c);
          m.act(world, c);
          return c;
        };
        send(0);
        return { go: () => send(1) };
      };
      boss(-9, 20);
      d.playerHp = d.playerMax;
      let ch = charging(-4, 20);
      step(2.9);
      yes('charge: in the open, an AI must hide', d.boss.script.mustHide && !d.boss.script.hidden(-4, 20));
      let run = ch.go();
      step(1);
      check('charge: in his way, it kills', lost(), 1);
      yes('charge: he stops at the wall of fire, and breaks nothing', !run.flag && run.x < -TWIN_LAYOUT.wallHalf - 1 && d.foe.group.position.x < -TWIN_LAYOUT.wallHalf && a.obstacles.length === TWIN_PILLARS.length + 1);
      fresh(0);
      const P0 = TWIN_PILLARS[4], from = { x: -9, z: 17 };
      boss(from.x, from.z);
      const toP = Math.hypot(P0.ax - from.x, P0.az - from.z), ux = (P0.ax - from.x) / toP, uz = (P0.az - from.z) / toP;
      d.playerHp = d.playerMax;
      ch = charging(P0.ax + ux * 2.5, P0.az + uz * 2.5);
      step(2.9);
      yes('charge: behind a pillar, an AI may stay', d.boss.script.hidden(me().x, me().z));
      run = ch.go();
      step(1);
      check('charge: behind a pillar, it costs nothing', lost(), 0);
      yes('charge: he crashes into it, it breaks, and he kneels', run.flag === true && a.obstacles.length === TWIN_PILLARS.length && !!a.statusOf(d.foe).stunned);

      // Their health must fall together.
      fresh(0);
      link.hurt(0, POOL * 0.13);
      yes('13 points ahead of Ember: she grows furious, not Ash', d.boss.twins.furious === 1 && d.boss.script.rage === 1);
      link.hurt(1, POOL * 0.26);
      yes('Ember 13 points ahead: now Ash is furious', d.boss.twins.furious === 0);
      check('furious: his hits cost half as much again', d.boss.script.rage, FURY_HIT, 0);
      check('furious: his moves come faster', d.boss.brain.rage, FURY_GAP, 0);
      boss(-10, 12);
      place(-8, 12);
      check('furious: his slam costs 27 %', take(() => cast('slam', 0), 1.7), 0.18 * FURY_HIT);
      link.hurt(0, POOL * 0.08);
      yes('within 6 points again: he calms', d.boss.twins.furious === -1 && d.boss.script.rage === 1 && d.boss.brain.rage === 1);
      link.hurt(0, POOL * 0.05);
      yes('between 6 and 12 points nobody is furious', d.boss.twins.furious === -1);
      // The clock's enrage is the stronger one, and the two never multiply.
      d.boss.fought = 1e6;
      d.countdown = -1;
      step(0.1);
      link.hurt(1, POOL * 0.3);
      yes('past the enrage time and furious: the stronger counts, not both', d.boss.twins.furious === 0 && d.boss.script.rage === 2 && d.boss.brain.rage === 0.5);

      // The other falls first: the wall goes out, this screen's boss is furious to its end, and the fight goes on.
      fresh(0);
      link.hurt(1, POOL);
      step(0.2);
      yes('Ember falls: the wall of fire goes out', !a.obstacles.includes(TWIN_WALL) && a.lineOfSight(new V(-3, 0, 12), new V(3, 0, 12)));
      yes('Ember falls: Ash is furious, and the fight goes on', d.boss.twins.dead[1] && d.boss.twins.furious === 0 && d.boss.script.rage === FURY_HIT && d.boss.which === 0 && !d.over);
      yes('Ember falls: her zones are gone, and no zone is cut off now', scriptOf(1).active.length === 0 && scriptOf(0).clip() === null);
      place(-3, 12);
      for (let i = 0; i < 180; i++) { a.walk(new V(4 / 60, 0, 0)); step(1 / 60); }
      yes('the wall out: a hero walks across', me().x > 2);
      link.hurt(0, POOL);
      step(0.2);
      yes('both dead: the fight is won', d.over === 'win');

      // This screen's boss falls first: the other becomes its enemy.
      fresh(0);
      const ember = d.twin.enemy.group.position.clone();
      link.hurt(1, POOL * 0.2);
      link.hurt(0, POOL);
      step(0.2);
      yes('Ash falls: Ember is this screen\'s enemy now', d.boss.def.name === 'Ember' && d.boss.which === 1 && link.which === 1 && d.opponentKit.name === 'Ember' && !d.over);
      yes('Ash falls: she stands where she stood, with the HP she had', Math.hypot(d.foe.group.position.x - ember.x, d.foe.group.position.z - ember.z) < 0.5 && Math.abs(a.hpOf(d.foe) - POOL * 0.8) < 2);
      yes('Ash falls: he lies where he fell, drawn only', d.twin.fallT >= 0 && d.twin.enemy.group.position.x < -5 && a.liveFoes().length === 1);
      const before = link.pools[1].hp;
      a.hit(d.foe, { damage: 150, knock: 0 });
      step(0.2);
      yes('Ash falls: this hero\'s hits come off Ember', before - link.pools[1].hp >= 150 && link.pools[0].hp === 0);
      place(8, 20);
      check('Ash falls: her moves hit this hero now, and she is furious', take(() => cast('bombs', 1, { x: 8, z: 17.3, dir: Math.PI / 2 }), 1.9), 0.12 * FURY_HIT);
      yes('Ash falls: no brain is left on this screen', d.boss.brain === null && link.brain === false);
      d.boss.takeBrain(1);
      yes('the hub hands this screen her brain: its casts go on in her own range of ids', d.boss.brain !== null && d.boss.brain.seq >= RAID_TWIN.ids + 1000 && d.boss.brain.def.name === 'Ember');
      d.boss.brain.pause = 1e9;
      link.hurt(1, POOL);
      step(0.2);
      yes('then she falls: won', d.over === 'win');

      // Each has its own Eruption, in its own half.
      fresh(0);
      link.hurt(0, POOL * 0.51);
      yes('Ash at half his own HP: his Eruption is due, and he can\'t be hurt', d.boss.stats.phases === 2 && d.bossGuard === true && d.boss.twins.phase[1] === 0);
      const er = cast('eruptw', 0, { x: TWIN_LAYOUT.hold[0].x, z: TWIN_LAYOUT.hold[0].z });
      step(0.5);
      const mine = a.summons.alive('opponent');
      yes('his three Coal Hearts stand in his half, round his place', mine.length === 3 && mine.every((u) => u.pos.x < -1 && Math.abs(Math.hypot(u.pos.x - TWIN_LAYOUT.hold[0].x, u.pos.z - TWIN_LAYOUT.hold[0].z) - 6.5) < 0.2));
      for (const u of a.summons.alive('opponent')) a.hit(u.figure, { damage: 99999, knock: 0 });
      step(0.2);
      yes('put out: he kneels, and can be hurt again', d.boss.stats.kneels === 1 && d.bossGuard === false);
      void er;

      // Together: the lava rises for the whole room once either is at a third, and either vent holds it back for all.
      fresh(0);
      link.hurt(1, POOL * 0.68);
      check('Ember at a third of her HP: the lava starts on this screen too', d.shiftOffset + d.hazardClock, 45, 0.3);
      const before0 = d.shiftOffset;
      const sv = cast('seale', 1, { x: TWIN_LAYOUT.hold[1].x, z: TWIN_LAYOUT.hold[1].z });
      step(0.3);
      yes('her vent is not this hero\'s to seal', d.boss.script.objectiveGoal(me().x, me().z) === null);
      link.on.done(sv.id, 0, 3);
      check('her half seals it: the lava waits 20 s longer here too', before0 - d.shiftOffset, 20, 0.01);
      const sw = cast('sealw', 0, { x: TWIN_LAYOUT.hold[0].x, z: TWIN_LAYOUT.hold[0].z });
      boss(-22, 20);
      place(TWIN_LAYOUT.hold[0].x, TWIN_LAYOUT.hold[0].z);
      const g0 = link.pools[0].gauge;
      step(4.3);
      check('this hero seals Ash\'s: 20 s more', before0 - d.shiftOffset, 40, 0.01);
      check('and a mechanic fills half of what it fills for one boss', link.pools[0].gauge - g0, 40 * 5 / 2, 0.01);
      void sw;

      // Falling Star for a party: 45 % shared by whoever of her half stands under it.
      fresh(1);
      boss(14, 7);
      place(8, 20);
      link.stood = (id, part, inside) => link.on.stood(id, part, inside ? 3 : 0);
      check('Falling Star: three under it pay 15 % each', take(() => cast('star', 1), 3.6), 0.15);
      step(3);
      place(8, 20);
      d.playerHp = d.playerMax;
      cast('star', 1);
      place(20, 20);
      step(3.6);
      check('Falling Star: nobody under it costs her half 45 %', lost(), 0.45);
      // Her wave grows from her great vent over her own half, and stops at the wall.
      step(3);
      place(4, 7);
      d.playerHp = d.playerMax;
      const wv = cast('wave', 1, { x: TWIN_LAYOUT.hold[1].x, z: TWIN_LAYOUT.hold[1].z, seed: 5 });
      const th = scriptOf(1).active.find((x) => x.cast.id === wv.id).played.threats[0];
      yes('Lava Wave: from her vent, far enough to reach the corners of her half', th.shape.x === TWIN_LAYOUT.hold[1].x && th.shape.radius >= Math.hypot(14, TWIN_R));

      // The two brains never share an id, and each sees only its own half.
      fresh(1);
      const sent = [], on = link.on.cast;
      link.on.cast = (c) => { sent.push(c); on(c); };
      d.boss.brain.pause = 0;
      d.countdown = -1;
      for (let i = 0; i < 12; i++) { step(1); d.playerHp = d.playerMax; }
      yes('Ember\'s brain numbers its casts from a million, and says they are hers', sent.length > 1 && sent.every((c) => c.id > RAID_TWIN.ids && c.which === 1) && scriptOf(0).active.length === 0);
      yes('and only her own moves', sent.every((c) => ['fan', 'bombs', 'lanterns', 'marked'].includes(c.move)));

      // The autopilot fights on its own side and never tries to cross.
      fresh(0);
      d.boss.brain.pause = 0;
      d.autopilot = true;
      d.countdown = -1;
      let east = -Infinity, stuck = 0, last = me().clone();
      for (let i = 0; i < 40 && !d.over; i++) {
        step(1);
        east = Math.max(east, me().x);
        if (me().distanceTo(last) < 0.05 && me().x > -TWIN_LAYOUT.wallHalf - 0.8) stuck++;
        last = me().clone();
        d.playerHp = d.playerMax;
      }
      yes('autopilot: 40 s of fighting, never across the wall', east < -TWIN_LAYOUT.wallHalf);
      yes('autopilot: and never standing pressed against it', stuck < 3);
      yes('autopilot: it hurt Ash, and only Ash', link.pools[0].hp < POOL && link.pools[1].hp === POOL);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    delete performance.now;
    d.stop();
    return { ok: !failed.length, failed, rows };
  };

  // Twin Flames: every hero's four spells and basic attack replayed as a partner in the OTHER half, where they aim at the other
  // boss's stand-in (a figure with no body, `Duel.foeFor`). Nothing in them may throw, or touch this screen's hero or its boss.
  //   await _raidTwinPartners()            // every hero; { ok, n, rows, errors }
  //   await _raidTwinPartners(['Vesper'])
  window._raidTwinPartners = async (names) => {
    const d = vfx.duel, a = vfx.arena;
    const { twinFlames } = await import('/src/raid/ashEmber.ts');
    const { TwinLocalLink } = await import('/src/raid/twin.ts');
    const { HERO_KITS } = await import('/src/heroes.ts');
    const out = { ok: false, n: 0, rows: [], errors: [] };
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const logError = console.error;
    let now = '';
    console.error = (...x) => { if (out.errors.length < 30) out.errors.push(`${now}: ${x.map((v) => String(v?.stack ?? v)).join(' ').slice(0, 300)}`); logError(...x); };
    const onError = (e) => { if (out.errors.length < 30) out.errors.push(`${now}: ERR ${e.message}`); };
    window.addEventListener('error', onError);
    vfx.view.paused = true;
    if (!d.on) vfx.setDuel(true, 'play');
    d.holdStart = false;
    try {
      for (const kit of HERO_KITS.filter((k) => !names || names.includes(k.name))) {
        // A screen never replays a spell its own hero has: another hero for this screen.
        vfx.heroPickCtrl.setValue(kit.name === 'Lyra' ? 'Bram' : 'Lyra');
        for (let slot = 0; slot < 5; slot++) {
          now = `${kit.name} slot ${slot}`;
          const def = twinFlames(0), link = new TwinLocalLink(def, 10, 0);
          d.startBoss({ def, link, seed: 'twin-partners', mode: 'play', name: 'me', party: [{ side: 1, kit, name: 'partner' }], band: 10, twin: { ...link.setup, halves: [0, 1] } });
          d.boss.brain.pause = 1e9;
          const me = a.caster.group.position, ember = d.twin.enemy.group.position;
          me.set(-8, 0, 12);
          d.partnerMove(1, ember.x - 5, ember.z + 4, 0, undefined);
          step(0.3);
          const p = d.party.get(1), before = { hp: d.playerHp, boss: a.hpOf(d.foe), x: me.x, z: me.z };
          if (slot < 4) {
            const spell = kit.spells[slot];
            d.partnerCast(1, { id: 1, slot, x: ember.x, z: ember.z, fx: p.pos.x, fz: p.pos.z, enemy: true, yaw: Math.atan2(ember.x - p.pos.x, ember.z - p.pos.z), bend: spell.aim === 'arc' ? 0.6 : undefined });
          } else d.partnerAttack(1);
          step(3.5);
          const st = a.statusOf(a.caster);
          const row = {
            hp: d.playerHp - before.hp, boss: a.hpOf(d.foe) - before.boss, moved: Math.hypot(me.x - before.x, me.z - before.z),
            status: !!st && (st.stunned || st.cannotMove || st.cannotCast || st.speedMul !== 1), buffs: st?.activeBuffs().length ?? 0,
          };
          out.n++;
          if (row.hp || row.boss || row.moved > 0.001 || row.status || row.buffs) out.rows.push({ name: kit.name, slot, ...row });
        }
      }
    } catch (e) {
      out.errors.push(`${now}: ${String(e?.stack ?? e)}`);
    }
    delete performance.now;
    console.error = logError;
    window.removeEventListener('error', onError);
    d.stop();
    out.ok = !out.rows.length && !out.errors.length;
    return out;
  };
})();
