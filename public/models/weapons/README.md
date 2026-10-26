# Weapon models

Five weapons modelled in Blender from the concepts in `C:\projectG\weapons\`. Built by code in
`blender/weapons/` (shared helpers in `_wp.py`, which reuse the Dao Archive kit in
`C:\projectG\xianxia\blender` read-only). Preview renders are in `docs/weapons/`.

Rebuild one inside Blender (MCP code tool):

```python
import sys, importlib
sys.path.insert(0, r"C:\VFXTool\blender\weapons")
import _wp; importlib.reload(_wp)
_wp.run("wp-sword-dragon")                   # build, preview, export, clear from the scene
_wp.run("wp-sword-dragon", export_it=False)  # build + preview only, stays in the scene
```

## Convention (what the VFX attaches to)

- Plain glTF binary: no Draco and no meshopt, so three's `GLTFLoader` loads the files without a decoder. One node per file, named after the weapon id.
- Units are metres. Blender z-up is exported as glTF/three **y-up**.
- **Origin = centre of the grip** (where the hand holds it). The blade or head points **+Y** in three (+Z in Blender).
- The face of the blade, medallion or fan looks towards **+Z** in three (−Y in Blender, the Front view). The width runs along X.
- Emissive materials (gems, glow lines, cracks) are set up for the bloom pass.

| File | Weapon | Concept | Size (w × h × d, m) | Triangles | MB |
|---|---|---|---|---|---|
| `wp-sword-dragon.glb` | Azure Dragon-Spine Sword | sword_dragon.png | 0.22 × 1.43 × 0.09 | 18,176 | 0.52 |
| `wp-sword-ice.glb` | Frost-Crystal Sword | sword_ice.png | 0.24 × 1.23 × 0.06 | 13,644 | 0.39 |
| `wp-glaive-guandao.glb` | Green Dragon Crescent Blade | glaive_guandao.png | 0.31 × 1.39 × 0.08 | 15,016 | 0.42 |
| `wp-hammer-thunder.glb` | Thunder-Drum Hammer | hammer_thunder.png | 0.70 × 1.10 × 0.25 | 30,236 | 0.78 |
| `wp-fan-fire.glb` | Jade-Leaf Phoenix Fan | fan_fire.png | 0.73 × 0.86 × 0.04 | 29,588 | 1.06 |

## VFX notes (to build once the forge-vfx pipeline is done)

These models contain only the physical weapon. Each concept's aura is left out so it can be built as
particles later:

- **Dragon sword:** a large translucent azure dragon spiralling up around the blade, cyan qi wisps and sparkles, the guard orb pulsing, light running along the centre line.
- **Ice sword:** snowflakes and ice glitter drifting off the blade, cold mist rolling down from the pommel, a frost ring on the ground, light flickering along the inner cracks.
- **Guandao:** green and gold qi ribbons spiralling around the weapon, jade sparks, the dragon relief glowing, a crescent slash trail.
- **Thunder hammer:** purple-white lightning arcing around the head and down the haft, a white qi spiral round the haft, storm clouds below, the taiji spinning and flashing on impact.
- **Fire fan:** iridescent fire and wind ribbons (orange, cyan, white) sweeping around the fan, glowing embers, a gust wave on each swing, the gems pulsing.
