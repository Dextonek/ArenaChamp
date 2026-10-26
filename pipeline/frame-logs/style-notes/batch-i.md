# Style notes from batch-i (YouTube, 14 videos) – new versus VFX_PRINCIPLES §1–§11

1. **Anti-flash: go darker than normal right before a whiteout.** One frame ~10-15 % darker than the base image (or a soft black blob over the caster for 1-2 frames) immediately before the white blowout. Dark → white reads much stronger than base → white. (V-zNBHnx1kY at 7.00 and 14.10)
2. **Collapse the flash onto the ground.** The blowout is a sphere for exactly one frame; on the next frame it is replaced by a flat radial spray and a ring on the floor. The energy visibly lands. Pair it with one empty frame between contact and blowout. (2fwT64lFtao 6.77-6.87)
3. **Chromatic aberration can be the only colour.** A strictly black/grey/white move whose only hue is a 2-3 px RGB-split fringe on bright shards and a pink/teal tint at the screen edges, pulsed per hit. Also works as a cheap upgrade for a plain light streak. (V-zNBHnx1kY, 2fwT64lFtao 2.3)
4. **Drain the colour, keep one hue.** Desaturate the character first, then the whole world, leaving only the move's colour; the drain itself announces the ultimate. A static, calm stage prop (a big white crescent arc behind the target, mirrored in a wet floor) frames the busy hits. (3KIzXAukn5I)
5. **Impact cards can carry meaning.** Inside the 2-frame card sequence, an X-ray card (flat skeleton silhouette of the target on black, or its outline on white) says "this went through the bone". Show a slash as its cut path: a black band with a glowing white rim on a dark screen that rotates and thins to a hairline in 0.25 s. Precede it with 1+ s of close-ups with no VFX. (cL3SOjXcMlU)
6. **Crack, freeze, then shatter.** A full-screen web of glowing cracks appears in one frame and nothing moves for ~1.3 s; then rays, two focus-line frames and the screen breaks into falling shards. A frozen frame after a sudden change is a stronger anticipation than any charge. (3KIzXAukn5I 7.55-9.65)
7. **Darkness can be the aftermath.** After a distant whiteout, drop the world to ~35 % for 3-4 s while one flickering element carries the frame, then end it with a second whiteout that restores the normal grade. Stage the payoff on the horizon so it reads huge, and let a giant ring wall roll through the camera. (l_sIXrFQdZE)
8. **Toon explosions are shape, not light.** Mean brightness barely changes. Pop at ~70 % of final size in one frame, add the dark shaded core 2 frames later, ramp pastel colours, and let the fill vanish before the outline so the exit is outline fragments. Spikes live only for the first 0.15 s; shock rings are hand-drawn scribbles. (k7mN6a-TY4o)
9. **Hot for 2 frames, dark for the rest – and the floor remembers.** The impact is gold/white for 2-3 frames (lighting the whole floor with a big point light), then the burst that stays is dark (thorns, brambles that flatten into cracks). Glossy dark splat decals at every hit persist 5-8 s and record the fight. (TMajNO4CqG0)
10. **Auras: one-signed spin, zero speed, brightness via transparency.** All swirls rotate the same direction (rotation-speed range on one side of zero), particles barely move (speed ≈ 0, spread 0-1°), floor rings get a small symmetric spin, and over-brightness is fixed by raising transparency (0.3-0.9) instead of darkening colours. One static ring glues the moving layers. (OxFo5lRNR0c)

## New parts / options the kit would need
1. **Emitter `flipbook {cols, rows, fps, randomStart}`** – looping flame/smoke sheets tinted by colour-over-life (xzZeP65SSlA, OxFo5lRNR0c).
2. **Emitter `orient: 'up'`** – flat horizontal sprites for floor rings and swirl-slice tornadoes (zYW9-zrcCwI, OxFo5lRNR0c).
3. **Emitter signed `rotSpeed` range** – one-direction spin (OxFo5lRNR0c).
4. **ScreenFx chromatic aberration** with a per-beat intensity curve and edge tint (V-zNBHnx1kY).
5. **ScreenFx anti-flash** – a one-frame darken before the white (V-zNBHnx1kY).
6. **ScreenFx crack-web overlay + screen shatter pass** (3KIzXAukn5I).
7. **Silhouette/X-ray card** – the target rendered as a flat skeleton fill or outline for an impact card (cL3SOjXcMlU).
8. **Rotating rim band card** – a camera-facing black band with a white rim that rotates and thins (cL3SOjXcMlU).
9. **Rim-only glass bubble shell** – fresnel sphere with crack lines, hollow centre (V-zNBHnx1kY).
10. **Line-cone telegraph** – thin vertical light lines on an inverted cone with a top ring (HOeAQEvFDNA).
11. **SmokeBall toon mode** – 3-band ramp, outline, fill-before-outline erosion, coloured rim on black puffs (k7mN6a-TY4o, y083IZMPV7g).
12. **Scribble ring texture** for createRing with a dash-break erosion (k7mN6a-TY4o).
13. **LightPillar scrolling dark-streak texture** (TMajNO4CqG0).
14. **Long-life splat decal pool** – ring buffer of glossy ground splats (TMajNO4CqG0).
15. **Burn-reveal mask for rune decals** – lines light up along a moving front (NComttnprDU).
16. Small assets: petal mesh, wing mesh, six-fold snowflake decal, leaf-shaped StarBurst spikes, horned mushroom-cloud silhouette sprite.
