// Tokens (Asenet's circlet, Orren's ember): one hero holds it at a time; `claim` changes the holder on the screen whose word
// counts, and the other screen follows. Here: a test trait passes Lyra's circlet to Isolde when Lyra's spell hits (decided where
// the hit is, `dealt`); the message a claim sends is read back; two screens claiming the same number settle on the earlier start.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
const d = L.d, a = L.a, m = d.mech;
const out = { passes: [] };
L.duel('Lyra', 'Isolde', {
  trait: {
    dealt(t, hit) {
      L.traits.TRAITS.Lyra.__base?.dealt?.(t, hit);
      const tok = t.mech.token('c', 'hero');
      if (hit.kind === 'spell' && hit.victimIsHero && tok.holder === 'hero') {
        tok.claim('opponent', undefined, t.time);
        out.passes.push(+t.time.toFixed(2));
      }
    },
  },
});
const tok = m.views.hero.token('c', 'hero');
L.step(12, () => (tok.holder === 'hero' ? undefined : false));
L.check('a spell hit passes it to the one hit', tok.holder === 'opponent' && out.passes.length === 1, { holder: tok.holder, passes: out.passes });
out.shot = L.shot();

// The message a claim sends, read back (as the other screen would: its sides turned round).
const sent = [];
const send0 = m.host.send;
m.host.send = (name, n) => sent.push([name, n]);
tok.claim(null, { x: 3.7, z: -2.2 }, 7.25);
m.host.send = send0;
const [name, n] = sent[0];
out.message = { name, n, length: name.length };
const echo = new L.mech.Mech({ ...m.host, send() {}, seat: () => 1 });
const t2 = echo.token('c', 'hero');
echo.receive(name, n, true);
L.check('a claim travels in one message of 16 characters at most', name.length <= 16 && t2.holder === null && Math.abs(t2.state.x - 3.7) < 0.06 && Math.abs(t2.state.z + 2.2) < 0.06 && Math.abs(t2.state.start - 7.25) < 0.006 && t2.state.version === tok.state.version, { name, n, got: t2.state });

// Both screens make claim number v at once: each keeps the one that started first.
const mk = (seat) => new L.mech.Mech({ ...m.host, send() {}, seat: () => seat });
const s0 = mk(0), s1 = mk(1);
const k0 = s0.token('e', null), k1 = s1.token('e', null);
k0.claim('hero', { x: 1, z: 1 }, 10.0); // seat 0's hero picks it up, starting at 10.0
k1.claim('hero', { x: 1, z: 1 }, 10.4); // seat 1's hero, starting at 10.4
const flip = (st) => ({ ...st, holder: st.holder === 'hero' ? 'opponent' : st.holder === 'opponent' ? 'hero' : null });
k0.receive(flip(k1.state));
k1.receive(flip(k0.state));
out.conflict = { seat0: k0.holder, seat1: k1.holder };
L.check('two claims of one number settle on the earlier start, on both screens', k0.holder === 'hero' && k1.holder === 'opponent', out.conflict);
k1.receive({ ...flip(k0.state), version: k0.state.version - 1, holder: null });
L.check('an older claim is ignored', k1.holder === 'opponent', k1.holder);
return L.done(out);
