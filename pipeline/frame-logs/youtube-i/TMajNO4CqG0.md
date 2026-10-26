# MainB – Realtime VFX Portfolio Showreel (TMajNO4CqG0)
https://www.youtube.com/watch?v=TMajNO4CqG0 · 3:12 · 141K views · Unreal and Unity clips on a grey checker floor. Three effects logged: crimson blade burst + blood kit (7.7-20.4), fire phoenix dive (27.4-31.0), violet void pillar (169.5-175.0).

Brightness scan 6-48 s (0.1 s): 7.7 fade-in from black; 10.3 big flash (L164, floor lit orange); 17.3 smaller flash; 20.5 cut to dark; 27.4-30.2 fire clip with flash at 29.3 (L161) and a long warm floor tint (hue #e09070).

## Frame log – A: crimson blade burst and blood kit (8.0-18.5)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 8.00 | caster and two dummies, calm | | |
| 8.70 | a small red point of light at the caster's hand with a short horizontal flare; the floor below glows red | point light + flare streak | gather |
| 9.00 | a ring of dark red smoke wisps around the caster, long thin horizontal red flare (~10 m) | dark smoke ring (normal #3a0008), flare (additive #ff2a2a) | |
| 9.20 | a spiky dark-red "urchin" burst around the caster: hundreds of thin dark spikes with a red glow core | dark spike burst (normal) + red core | dark burst |
| 9.50 | spikes thrown out as long dark thorny tendrils whipping around | tendrils (thin ribbons, dark red) | |
| 9.80 | tendrils retract; a red blade appears in the hand | | |
| 10.10 | red blade + red star at the hand | | |
| 10.20 | a vertical red line from the hand | | tell |
| 10.27 | red motion smear: the caster dashes | motion blur ribbon | |
| 10.30 | caster gone in a yellow-white flash at the target, the whole floor lit orange | point light spike (huge radius), core flash | IMPACT (L164) |
| 10.37 | golden splash crown at the hit point (liquid-like spikes) | crown splash (additive gold #ffd060) | |
| 10.47 | the gold turns into a dark-red bramble burst: sharp thin thorns radiating out of a red core | thorn burst (normal #4a0010 with red glow) | colour drops hot → dark |
| 10.53-10.70 | brambles spread flat on the floor like cracks, still glowing red at the centre | | |
| 10.85 | brambles thin out, dark red specks | | |
| 11.00-11.20 | only small dark marks; caster back | | clean in 0.9 s |
| 11.80-12.10 | next attack: dash; dark red liquid splats appear on the floor along the path | splat decals (normal #5a0010, glossy) | marks stay |
| 12.40 | a short red crescent slash on the dummy | | |
| 12.70 | splats on the floor around both dummies | | |
| 13.30 | caster glows red-white (charging) | | |
| 13.90-14.10 | a big horizontal crescent slash around the caster: hot red edge, dark crimson body, thick wet tail; a dark splash flies off its end | crescent (normal dark + additive edge) | |
| 14.50 | small orange spark burst at the dummy, new splats | | |
| 15.20 | a third line of splats; old splats still there | | splats persist 5 s+ |
| 16.00 | a dark-red liquid geyser rises from the floor at the dummy (2 m column, curling top) | liquid column mesh (normal) | |
| 17.30 | dash line of splats ending in a hot orange ring crater (molten rim) | crater ring (additive orange) | flash |
| 18.50 | a long trail of splats across the floor | | ground story of the fight |

## Frame log – B: fire phoenix dive (27.4-31.0)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 27.60 | a dark winged creature hovering over a ring of flames, red light on floor | dark wing mesh, flame ring | |
| 28.00 | flames blow outward into a wide fire wreath on the ground | flame sprites | |
| 28.50 | the dark wings spread wide (black-red, ragged) over a hot core | | silhouette |
| 29.00 | wings turn into fire: flame-feather fans | flame ribbons along the wing shape | colour switch dark → fire |
| 29.20 | a tall fire phoenix shape rising, wings up | | apex |
| 29.27 | phoenix dives; the floor is lit pink-orange | point light | |
| 29.33-29.40 | phoenix crashes, wings spread flat, yellow-white core | | IMPACT (L161) |
| 29.60 | a wide fire disc on the ground with feather streaks | | |
| 29.90 | the disc burns down into a rune circle of fire (lines and arcs) with flame tongues | burning rune decal | |
| 30.20 | rune circle with ember sparks, flames thinning | | |
| 31.00 | cut | | |

## Frame log – C: violet void pillar (169.5-175.0)
| t (s) | on screen | visible layers | change |
|---|---|---|---|
| 169.50 | caster on a dark floor; a white-violet star glint at the hand; a magenta ring around the caster | 4-pt glint, ground ring | |
| 170.20 | dark violet tendrils swirl above the caster, a magenta orb in the hand | dark ribbons (normal), glow sphere | charge |
| 170.80 | same, ring brighter | | |
| 171.30 | the orb flashes white-violet (big soft glow) | | release |
| 171.80 | at the far target a white-hot pillar slams down, violet crystal shards splayed at its base | light pillar (white core), crystal skirt | IMPACT |
| 172.30 | pillar turns violet, its inside full of dark vertical streaks scrolling down | pillar with scrolling dark streak texture | colour cools |
| 172.60-173.60 | pillar holds, shards flicker at the base, a few dark sparks fly | | hold 1.8 s |
| 174.20 | pillar gone; faint dark ring on the floor | | |
| 175.00 | clean | | |

## Technique notes
- **Hot flash, dark body.** In A the impact is gold/white for 2 frames, then the burst is made of DARK red thorns. The bright colour only marks the moment; the shape that stays is dark.
- **Floor as a light receiver.** The impact lights the whole floor (huge point light) for 2-3 frames: the brightest thing is the floor colour change, not a sprite.
- **Persistent ground story.** Every hit leaves a glossy dark splat decal that stays for many seconds, so the floor records the fight (longer than §2's "ground mark lasts longest").
- **Dark silhouette → fire.** In B the creature is first a dark winged silhouette, then turns into fire for the dive, then burns into a rune circle. Shape (dark), energy (fire), mark (rune).
- **Pillar with dark streaks inside.** The violet pillar is not a flat glow: dark streaks scroll down inside it, which gives it volume and motion while total brightness stays flat (matches §7 sustain-without-more-light).
- Build: thorn burst = instanced thin cones (normal-blended dark red) with a small additive core; splats = ground-decal sprites with a glossy normal map look (NEW: decal pool with long life); pillar = LightPillar with a scrolling streak texture and a crystal skirt of instanced shards.
