"""
Night Temple cover props, in the heroes' sculpted-and-painted style (see blender/heroes/sculpt.py): a fluted column,
a carved screen-wall module, the low sun altar in the middle of the ring and a brazier. Each prop is built in its
own collection at the origin (its base centre), painted (ambient occlusion, edge light, height gradient), and
exported together to public/models/arenas/temple_props.glb as objects named "<Prop>__<material>" for
src/arenas/temple.ts to instance.

Sizes match the collision capsules in src/arenas/temple.ts: the column covers a pillar of r 0.85 (height 4.2), the
wall module is 3.14 m long and 0.7 m deep (a wall of r 0.35 from its segment ends), the altar covers r 1.0 and
stays low (the gameplay camera looks along the z axis over it).

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import temple_props; importlib.reload(temple_props)
    temple_props.export()

Blender coordinates: metres, z up. In three.js (y up) the model's -Y becomes +Z.
"""
import importlib
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(os.path.dirname(HERE), "heroes"), r"C:\projectG\xianxia\blender"):
    if p not in sys.path:
        sys.path.insert(0, p)

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "temple_props.glb")

STONE = "#6a6580"
STONE_DARK = "#48435a"
STONE_LIGHT = "#7c7794"
GOLD = "#d8ae52"


class Props:
    def __init__(self):
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"temple_props_{part}", color, **kw)
        return self.mats[part]

    def materials(self):
        return (self.mat("stone", STONE, roughness=0.85), self.mat("dark", STONE_DARK, roughness=0.9),
                self.mat("light", STONE_LIGHT, roughness=0.8), self.mat("gold", GOLD, metallic=0.75, roughness=0.32),
                self.mat("glow", "#ffcf6a", emission="#ffb43a", strength=3.0))


def _flute(ob, n, depth, z0, z1, r_of):
    """Presses `n` rounded flutes into a lathe shaft between heights z0 and z1 (fading out at both ends)."""
    for v in ob.data.vertices:
        z = v.co.z
        if z < z0 or z > z1:
            continue
        k = min(1.0, (z - z0) / 0.12, (z1 - z) / 0.12)
        a = math.atan2(v.co.y, v.co.x)
        d = 0.5 + 0.5 * math.cos(n * a)  # 1 on the ridge, 0 in the flute
        s = 1 - depth * (1 - d) ** 2 * k / max(r_of(z), 1e-3)
        v.co.x *= s
        v.co.y *= s


def _octagon(name, r, z0, z1, mat, bevel=0.03):
    """An octagonal block (a lathe of 8 sides with a soft bevel)."""
    ob = kit.lathe(name, [(0.0, z0), (r, z0), (r, z1), (0.0, z1)], mat, seg=8, smooth=False)
    md = ob.modifiers.new("Bevel", "BEVEL")
    md.width, md.segments, md.limit_method = bevel, 3, "ANGLE"
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=md.name)
    return ob


def column(P, coll):
    """(Parts land in the current kit collection, `coll`.) Fluted column on a square plinth with a gold necking and a carved capital; 4.2 m tall, base half-width 0.9."""
    stone, dark, light, gold, _ = P.materials()
    parts = [
        kit.box("Plinth", (0, 0, 0.17), (1.8, 1.8, 0.34), dark, bevel=0.05, segments=3),
        kit.box("PlinthStep", (0, 0, 0.4), (1.56, 1.56, 0.12), stone, bevel=0.03, segments=3),
        kit.torus("Torus", (0, 0, 0.53), 0.72, 0.1, light, seg=(48, 10)),
        kit.torus("Scotia", (0, 0, 0.66), 0.68, 0.05, stone, seg=(64, 8)),
    ]
    r_of = lambda z: 0.7 - 0.08 * (z - 0.66) / 2.7  # noqa: E731
    shaft = kit.lathe("Shaft", [(0.0, 0.62), (0.72, 0.62), (0.7, 0.7), (0.66, 2.0), (0.62, 3.36), (0.0, 3.36)], light, seg=80)
    _flute(shaft, 16, 0.07, 0.76, 3.28, r_of)
    parts.append(shaft)
    parts.append(kit.torus("Necking", (0, 0, 3.38), 0.64, 0.05, gold, seg=(64, 8)))
    parts.append(kit.lathe("Echinus", [(0.0, 3.4), (0.64, 3.4), (0.86, 3.62), (0.9, 3.7), (0.0, 3.7)], stone, seg=64))
    parts.append(kit.box("Abacus", (0, 0, 3.84), (1.74, 1.74, 0.28), light, bevel=0.05, segments=3))
    parts.append(kit.box("AbacusCap", (0, 0, 4.05), (1.56, 1.56, 0.14), dark, bevel=0.03, segments=3))
    parts.append(kit.box("GoldBand", (0, 0, 3.94), (1.76, 1.76, 0.05), gold, bevel=0.01, segments=2))
    # carved volute scrolls on each face of the capital
    for k in range(4):
        a = k * math.pi / 2
        c = Vector((math.cos(a) * 0.86, math.sin(a) * 0.86, 3.6))
        parts.append(kit.torus(f"Volute{k}", tuple(c), 0.1, 0.035, light, seg=(16, 6), axis=(math.cos(a), math.sin(a), 0)))
        parts.append(kit.blob(f"VoluteEye{k}", tuple(c + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, 0))), (0.04, 0.04, 0.04), gold, segs=(10, 8)))
    return parts


def wall(P, coll, L=3.14, depth=0.7):
    """A carved screen wall `L` long (x) and `depth` deep (y): plinth, three panels with sun reliefs, pilasters with
    gold caps, a cornice; the panels ruined to slightly uneven heights. About 2.3 m tall."""
    stone, dark, light, gold, glow = P.materials()
    parts = [kit.box("WallPlinth", (0, 0, 0.2), (L + 0.12, depth + 0.16, 0.4), dark, bevel=0.05, segments=2)]
    n = 3
    pw = L / n
    heights = (1.72, 1.95, 1.6)
    for i in range(n):
        x = -L / 2 + pw * (i + 0.5)
        h = heights[i]
        parts.append(kit.box(f"Panel{i}", (x, 0, 0.4 + h / 2), (pw - 0.06, depth - 0.08, h), stone, bevel=0.04, segments=2))
        parts.append(kit.box(f"Cornice{i}", (x, 0, 0.4 + h + 0.06), (pw + 0.02, depth + 0.04, 0.12), light, bevel=0.03, segments=2))
        parts.append(kit.box(f"Frieze{i}", (x, 0, 0.4 + h - 0.12), (pw - 0.02, depth - 0.02, 0.1), gold, bevel=0.012, segments=2))
        for side in (-1, 1):
            y = side * (depth / 2 - 0.04)
            cz = 0.4 + h * 0.45
            # recessed frame and a round sun relief in it, on both faces
            parts.append(kit.box(f"Frame{i}{side}", (x, y, cz), (pw * 0.66, 0.03, h * 0.52), dark, bevel=0.012, segments=2))
            parts.append(kit.torus(f"Sun{i}{side}", (x, y + side * 0.03, cz), 0.16, 0.025, gold, seg=(24, 6), axis=(0, 1, 0)))
            parts.append(kit.blob(f"SunCore{i}{side}", (x, y + side * 0.03, cz), (0.08, 0.03, 0.08), gold, segs=(12, 8)))
            for r in range(8):
                a = r * math.pi / 4
                p0 = Vector((x + math.cos(a) * 0.2, y + side * 0.03, cz + math.sin(a) * 0.2))
                p1 = Vector((x + math.cos(a) * 0.29, y + side * 0.03, cz + math.sin(a) * 0.29))
                parts.append(kit.tube(f"Ray{i}{side}{r}", tuple(p0), tuple(p1), [(0, 0.018, 0.018), (1, 0.006, 0.006)], gold, seg=4))
    for i in range(n + 1):
        x = max(-L / 2 + 0.17, min(L / 2 - 0.17, -L / 2 + pw * i))
        parts.append(kit.box(f"Pilaster{i}", (x, 0, 1.36), (0.32, depth + 0.08, 1.92), light, bevel=0.04, segments=2))
        parts.append(kit.box(f"PilasterCap{i}", (x, 0, 2.36), (0.4, depth + 0.14, 0.1), gold, bevel=0.015, segments=2))
    return parts


def wall_cracked(P, coll, L=3.14, depth=0.7):
    """The screen wall after its first hits (breakable walls, src/duel.ts): the middle panel broken off short with a
    jagged top, a cornice block knocked askew, a pilaster cap gone and dark cracks across both faces."""
    import random
    rnd = random.Random(4)
    stone, dark, light, gold, glow = P.materials()
    parts = wall(P, coll, L, depth)
    keep = []
    for ob in parts:
        # the middle panel's top and the right pilaster's cap are gone
        if ob.name in ("Cornice1", "Frieze1", "PilasterCap2"):
            bpy.data.objects.remove(ob, do_unlink=True)
            continue
        if ob.name == "Panel1":
            for v in ob.data.vertices:
                if v.co.z > 1.4:
                    v.co.z = 1.4 + 0.22 * abs(math.sin(v.co.x * 9.0 + 1.3)) + rnd.uniform(-0.05, 0.05)
        keep.append(ob)
    pw = L / 3
    # the knocked cornice lying across the broken panel, leaning
    keep.append(kit.box("CorniceFallen", (0.12, -0.05, 1.62), (pw * 0.8, depth * 0.9, 0.12), light, bevel=0.03, segments=2,
                        rotation=Euler((0.25, 0.18, 0.1))))
    # cracks: thin dark seams zig-zagging down both faces
    for side in (-1, 1):
        y = side * (depth / 2 + 0.002)
        for c in range(3):
            x0, z0 = rnd.uniform(-L / 2 + 0.3, L / 2 - 0.3), rnd.uniform(1.4, 1.9)
            pts = [(x0, y, z0)]
            for _ in range(4):
                x0 += rnd.uniform(-0.18, 0.18)
                z0 -= rnd.uniform(0.15, 0.3)
                pts.append((x0, y, z0))
            keep.append(kit.chain(f"Crack{side}{c}", pts, [0.016, 0.014, 0.012, 0.008, 0.003], dark, seg=4))
    return keep


def wall_rubble(P, coll, L=3.14, depth=0.7):
    """A fallen screen wall: the plinth cracked in two, stumps of the pilasters and a low heap of tumbled panel
    blocks, cornice pieces and a dropped gold sun relief. Under 0.75 m: heroes see and walk over it."""
    import random
    rnd = random.Random(11)
    stone, dark, light, gold, glow = P.materials()
    parts = [
        kit.box("RubblePlinthA", (-L / 4 - 0.04, 0, 0.16), (L / 2 - 0.1, depth + 0.16, 0.32), dark, bevel=0.05, segments=2,
                rotation=Euler((0.0, 0.03, 0.02))),
        kit.box("RubblePlinthB", (L / 4 + 0.04, 0.02, 0.14), (L / 2 - 0.1, depth + 0.12, 0.28), dark, bevel=0.05, segments=2,
                rotation=Euler((0.04, -0.05, -0.03))),
    ]
    for i in range(4):
        x = max(-L / 2 + 0.17, min(L / 2 - 0.17, -L / 2 + L / 3 * i))
        h = rnd.uniform(0.25, 0.55)
        parts.append(kit.box(f"Stump{i}", (x, 0, 0.3 + h / 2), (0.32, depth + 0.06, h), light, bevel=0.04, segments=2,
                             rotation=Euler((rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), 0))))
    for k in range(9):
        w, d, h = rnd.uniform(0.3, 0.6), rnd.uniform(0.25, 0.45), rnd.uniform(0.18, 0.3)
        x, y = rnd.uniform(-L / 2 + 0.2, L / 2 - 0.2), rnd.uniform(-0.55, 0.55)
        mat = (stone, stone, light, dark)[k % 4]
        parts.append(kit.box(f"Block{k}", (x, y, 0.3 + h / 2 if abs(y) < depth / 2 else h / 2), (w, d, h), mat, bevel=0.035, segments=2,
                             rotation=Euler((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), rnd.uniform(0, math.pi)))))
    parts.append(kit.torus("FallenSun", (0.4, -0.62, 0.05), 0.16, 0.025, gold, seg=(24, 6), axis=(0.2, 0.1, 1.0)))
    parts.append(kit.box("FallenFrieze", (-0.7, 0.6, 0.06), (0.8, 0.12, 0.1), gold, bevel=0.012, segments=2, rotation=Euler((0, 0, 0.5))))
    return parts


def altar(P, coll):
    """The low sun altar in the middle of the ring: a stepped round drum (radius 1.0) with an octagonal pedestal and
    a glowing sun disc on top, 1.45 m tall."""
    stone, dark, light, gold, glow = P.materials()
    parts = [
        kit.lathe("Drum", [(0.0, 0.0), (1.02, 0.0), (1.02, 0.22), (0.9, 0.26), (0.9, 0.42), (0.0, 0.42)], dark, seg=96),
        kit.torus("DrumGold", (0, 0, 0.24), 0.97, 0.025, gold, seg=(96, 8)),
        _octagon("Pedestal", 0.62, 0.42, 1.0, stone),
        kit.lathe("Bowl", [(0.0, 1.0), (0.5, 1.0), (0.72, 1.14), (0.74, 1.2), (0.0, 1.2)], light, seg=64),
        kit.torus("BowlRim", (0, 0, 1.2), 0.72, 0.035, gold, seg=(64, 8)),
        kit.blob("SunDisc", (0, 0, 1.3), (0.34, 0.34, 0.12), glow, segs=(32, 12)),
    ]
    for k in range(12):
        a = k * math.pi / 6
        p0 = (math.cos(a) * 0.38, math.sin(a) * 0.38, 1.27)
        p1 = (math.cos(a) * (0.58 if k % 2 else 0.66), math.sin(a) * (0.58 if k % 2 else 0.66), 1.24)
        parts.append(kit.tube(f"AltarRay{k}", p0, p1, [(0, 0.035, 0.02), (1, 0.008, 0.008)], gold, seg=8))
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        parts.append(kit.box(f"Rune{k}", (math.cos(a) * 0.6, math.sin(a) * 0.6, 0.72), (0.05, 0.22, 0.3), gold, bevel=0.01, segments=2,
                             rotation=Euler((0, 0, a))))
    return parts


def brazier(P, coll):
    """A brazier on three legs with a gold-rimmed bowl, 1.15 m tall (the coals and flames are drawn in three.js)."""
    stone, dark, light, gold, _ = P.materials()
    parts = [kit.lathe("BrazierBase", [(0.0, 0.0), (0.42, 0.0), (0.4, 0.12), (0.28, 0.2), (0.0, 0.2)], dark, seg=48)]
    for k in range(3):
        a = k * 2 * math.pi / 3
        top = (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.95)
        bot = (math.cos(a) * 0.16, math.sin(a) * 0.16, 0.18)
        parts.append(kit.tube(f"Leg{k}", bot, top, [(0, 0.04, 0.04), (0.5, 0.03, 0.03), (1, 0.045, 0.045)], dark, seg=10))
    parts.append(kit.lathe("Bowl", [(0.0, 0.9), (0.24, 0.9), (0.46, 1.08), (0.48, 1.14), (0.42, 1.12), (0.0, 1.0)], stone, seg=48))
    parts.append(kit.torus("BowlGold", (0, 0, 1.13), 0.47, 0.03, gold, seg=(48, 8)))
    return parts


PROPS = {"Column": (column, 4.2), "Wall": (wall, 2.4), "WallCracked": (wall_cracked, 2.4), "WallRubble": (wall_rubble, 0.8),
         "Altar": (altar, 1.45), "Brazier": (brazier, 1.15)}


def _tidy(ob):
    """Welds seams (a lathe's first and last ring) and dissolves flat areas: fewer triangles, no seam lines."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.6), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    # sharp edges stay sharp (box sides), curved surfaces stay smooth
    ob.data.set_sharp_from_angle(angle=math.radians(40))


def _merge(name, parts):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("temple_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob)
        out.append(ob)
    return out


def build():
    importlib.reload(sculpt)
    dao.setup_scene()
    P = Props()
    colls = []
    for name, (fn, height) in PROPS.items():
        coll = kit.collection(f"Temple {name}")
        _merge(name, fn(P, coll))
        sculpt.paint(coll, height=height, ao_dist=0.25)
        colls.append(coll)
    return colls


def export():
    colls = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    tris = {c.name: kit.stats(c)["triangles"] for c in colls}
    return {"triangles": tris, "kb": round(os.path.getsize(OUT) / 1024), "path": OUT}
