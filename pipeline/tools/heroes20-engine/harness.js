// The harness itself: a test trait put in front of Lyra's own fires in a running CPU duel, and her own hooks still run.
const L = await (await import('/pipeline/tools/heroes20-engine/lib.js')).lib();
let ticks = 0, own = 0;
const base = L.traits.TRAITS.Lyra;
L.duel('Lyra', 'Isolde', { trait: { tick(t, dt) { ticks++; base.tick?.(t, dt); } } });
L.step(3);
own = L.d.heroRt?.trait?.passive?.name;
L.check('the test trait ticks', ticks > 100, ticks);
L.check('the rest is still Lyra', own === base.passive.name, own);
return L.done({ shot: L.shot() });
