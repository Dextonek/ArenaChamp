# Green Dragon Crescent (weapon aura)

- **Label:** `green dragon crescent` · **File:** `src/spells/weapons/greenDragonCrescent.ts` · **Module:** `greenDragonCrescentModule`
- **Mode:** idle loop on `wp-glaive-guandao`, category `weapons`, period 4 s, ignition 0.9 s.
- **Recipes:** `f-spiderlily-scythe-ribbon` (a long silk-flame ribbon trailing back off the blade; the scythe is the
  closest weapon in the reference), `e-geodraws-crimson-pillar` (spiral ribbons wound round a vertical form),
  `f-spiderlily-bow-crest` (two bright points of different sizes for a focal hierarchy, a crest of ribbons).
- **Palette:** gold-white #fff6d0 → jade #5cff9a → green #1f9a50 → deep #0a3a1e; gold accents #ffd070.
  Model tint a dark green-black (#0a1a10), rim #6dffa0.

## Layers (sockets from `SOCKETS['wp-glaive-guandao']`)
1. Model: `darken` 0.12, tint #0a1a10, rim #6dffa0.
2. **The relief dragon lights up (hero):** a `FlowRibbon` along `relief` (tail → head) on the front face at
   z = +reliefZ + 0.006 (mirrored on the back), width 0.02, gold → jade. A band of light travels from tail to head
   once per loop: build it as 3 overlapping ribbon pieces with staggered opacity phases.
3. Silk ribbons: two long `FlowRibbon`s (`cross: true`, width 0.04) spiralling down the haft from the collar to the
   butt, half a turn apart, green → jade → gold, sway 0.02.
4. Blade banner: one wide `FlowRibbon` streaming back (towards +X and up) off the blade's back edge, like the
   reference scythe's banner: rooted around x 0.06–0.1, y 0.5–0.9, sweeping out 0.25 m, translucent green.
5. Edge glint: a small `StarFlare` that sweeps along `edge` from the collar to the tip once per loop (bright for
   only ~0.5 s of the loop).
6. Focal `StarFlare` on the collar orb (jade-white, streak ×4); a smaller one on the butt orb.
7. Jade motes: an additive emitter fed along the blade edge and the haft (rate ~12, rising).
8. Halo: a faint green `GlowSphere` round the collar.
9. Dark layer: a normal-blended, dark-green eroded mist low round the butt.

**Ignition:** the ribbons unspool down the haft (fade in top → bottom), the orb pops, and gold flecks (a gold,
small `PetalSwarm`) burst from the collar.
