---
title: Lessons
tags: [knowledge, gotchas, rendering, three.js, blender]
updated: 2026-10-29
---

# Lessons

Technical things this project learned the hard way: the bug, why it happens, and the fix that is now in the code
or the rules. Look lessons (how things should read on screen) live in the art bible's do/don't table; this page is
for technique. Add a row whenever a fix took more than one try.

## Rendering and shaders
| Problem | Cause | Fix |
|---|---|---|
| The distortion pass did nothing | `ShaderPass` clones its uniforms; the cloned render-target texture no longer points at the target | Re-link after construction: `distortPass.uniforms.tDistort.value = distortTarget.texture` ([main.ts](../../src/main.ts)) |
| `shader compile error: 'flat' : syntax error` | `flat` is a reserved word in GLSL 3 | Never name a GLSL variable `flat` (Lunar Tide used `flatDir`) |
| A frame turns black or NaN in places | A lit instanced mesh with an instance scaled to exactly 0: its normals become NaN | Never scale an instance below `1e-4`; `selfTest` reports these as singular frames |
| Colours a little off | `setRGB` / `setHSL` are linear, hex codes are sRGB | Use hex (`0x…`, `'#…'`) or pass `THREE.SRGBColorSpace` |
| White blobs under bloom | Emissive > 1, stacked additive layers, low bloom threshold | Emissive ≤ 1, additive opacity ≤ 0.5, bloom threshold ≥ 0.8 (kit spells use 0.86) |
| Soft square points | `PointsMaterial` without a texture | Use `softDotTexture()` |
| Impact-frame silhouettes miss shader ribbons | The silhouette mask renders with an override material, which custom ribbon shaders don't survive | Add a solid stand-in mesh, visible only during the impact frames (Celestial Hunt's stag) |
| A cinematic's fog swap had no effect | `main.ts` sets `scene.fog = null` while a cinematic camera is active | Don't change fog from an effect |

## Cameras and framing
| Problem | Cause | Fix |
|---|---|---|
| Auto-fit cameras back off 40–60 units on huge creatures | Fitting to the whole bounding box | Place hero shots explicitly and clamp the distance to the look-at (~24) |
| Ultimate objects only show their tips | Built 10+ above the ground; the gameplay camera (16 back, 8 up, fov 50) can't see them | Build big objects ~4–9 above the point |
| An orange disk floods the frame for a whole aura | A self spell's telegraph with a long `until` | End a self aura's telegraph at its first pulse |

## Arena, targeting and hero mode
| Problem | Cause | Fix |
|---|---|---|
| Enemies healed after every cast | `Arena.context()` resets the pack | `arena.persist = true` keeps HP and deaths (hero mode); dead enemies respawn after `respawnAfter` |
| The hero walked off to the far edge on a click | The click came without a mouse-move before it, so the cursor was stale | Hero mode updates the cursor from the click event itself |
| A second spell cut off the first | One active effect at a time | Hero mode keeps replaced effects in the `lingering` set until they finish; shake, distortion and screen feedback read from all live effects |
| The same spell can't run twice at once | One effect instance per label | Accepted limit; a duel must give the two sides different kits |
| A lingering effect's cinematic camera is ignored | `render()` reads only the active effect's `cinematic` | Hero kits don't use cinematics; keep it that way for overlapping spells |
| Selecting an effect from a script left the dropdowns stale | `vfx.mode.name = …; vfx.setMode()` skips the category sync | Use `vfx.selectMode(label)` |
| A new kit's parts are not in `effects/parts/index.ts` | Only the core parts and the blood kit are re-exported (names would collide across kits) | Spells import their kit's parts file directly |
| A hero GLB fails to load with a plain loader | Hero figures are meshopt-compressed (weapons are plain glTF) | Load through `Hero`, which sets the `MeshoptDecoder` |
| Pale costumes glowed white in hero mode | The particle preset's bloom threshold (0.55) stayed active until the first cast | Hero mode sets the kit bloom on entry |
| Hit flashes turned enemies purple or white | The arena tints the flash with the hit colour | Pass the kit's body or hot colour as `color` to `ctx.hit` (a string) |

## Models and Blender
| Problem | Cause | Fix |
|---|---|---|
| Dark hero robes rendered near-white from above | The figure kit exports cloth with full white sheen | `Hero({ tintSheen: true })` tints the sheen with the cloth colour |
| The white disciple robe blew out under bloom | Pale albedo near the bloom threshold | `Hero` scales base colours (`shade`, 0.45 for the disciple, 0.9 for the heroes) |
| `NameError: bpy` in the Blender MCP | Every `execute_blender_code` call is a fresh scope | Import `bpy` (and reload modules) in each call |
| A rotated prop lost its rotation after the merge | The kit joins parts by material | Pass rotations through the kit's `rotation=` argument, not `rotation_euler` |
| Workbench renders show no glow | The preview renderer ignores emission | Judge glow in the game, not in the Blender preview |

## Browser automation
| Problem | Cause | Fix |
|---|---|---|
| Waiting for the scene changed nothing | The hidden browser pane doesn't run animation frames | Step time yourself: `vfx.step(1/60)` |
| Keys didn't reach the page | The automation's key events went elsewhere | `window.dispatchEvent(new KeyboardEvent('keydown', { code, key }))` |
| A long sweep call failed | Tool time limit | Chunks of about 40 effects |
| The sweep picked up emitter shapes as effect names | It read the 5th dropdown, whose order changed | Take names from `vfx.slots` |
| A sweep reported errors in five cinematic heroes once | Unknown; each passed alone and in a re-run | Capture `r.errors[0]` if it comes back |

## See also
- [Art bible do/don't table](../ART_BIBLE.md) (look lessons)
- [Review tools](../pipeline/review-tools.md)
- [Glossary](glossary.md)
- [Docs home](../README.md)
