"""
Ember Caldera backdrop props, in the cover's sculpted-and-painted style (blender/arenas/caldera_props.py): a jagged
obsidian rim lip (two modules laid round the ring edge), basalt prism clusters (a tall one for the sides, a low
outcrop of stumps), cooled-lava boulders, volcanic vents with a glowing mouth, lava-crusted rock spires and crater-wall
segments with thin glowing lava falls running down their faces. Exported to public/models/arenas/caldera_backdrop.glb
as objects named "<Prop>__<material>" and placed (seeded) by src/arenas/caldera.ts.

The materials are the cover's (caldera_props_obsidian / basalt / crust / glow), so in three.js the backdrop shares the
cover's tuned materials. The glow is kept to thin seams (cracks, lava falls, vent mouths). Cheaper than the cover
(coarse voxels, small triangle targets): the lip is seen from 1 m, the spires from 30 m, the crater wall from 75 m.

Run inside Blender (through the MCP server), one or two props per call, then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import caldera_backdrop as cb; importlib.reload(cb)
    cb.build("LipA")   # ... see BACKDROP
    cb.export()        # builds what is missing, writes the GLB
    cb.clear()

Blender coordinates: metres, z up, every prop stands on its base centre (in three.js the model's -Y becomes +Z).
The crater-wall segments face -Y (three.js +Z): caldera.ts turns that side toward the ring.
"""
import importlib
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(os.path.dirname(HERE), "heroes"), r"C:\projectG\xianxia\blender"):
    if p not in sys.path:
        sys.path.insert(0, p)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import caldera_props as cp  # noqa: E402  (the cover's materials and shape helpers)
import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "caldera_backdrop.glb")
PREFIX = "CalderaBack"


# ---- helpers -----------------------------------------------------------------------------------------------------

def _mound(name, mat, rnd, blobs, voxel, target, chisel, keep, squash=(1.0, 1.0), rough=None, depth=(0.84, 0.94)):
    """Blobs (centre, radii) melted into one lumpy mass at a voxel size that fits the prop, roughened and chiselled
    (caldera_props._crust at any scale). `rough` = (amplitude, noise scale)."""
    parts = [kit.blob(f"{name}{i}", c, r, mat, segs=(16, 9)) for i, (c, r) in enumerate(blobs)]
    return _finish(sculpt.fuse(parts, name, voxel=voxel, smooth=6, target=target), rnd, chisel, keep, squash, rough, depth)


def _finish(ob, rnd, chisel, keep, squash=(1.0, 1.0), rough=None, depth=(0.84, 0.94)):
    cp._cut_below(ob)
    amp, sc = rough or (0.05, 2.2)
    cp._rough(ob, amp, sc, rnd.random() * 10, up=0.6)
    cp._chisel(ob, rnd, chisel, keep=keep, depth=depth, squash=squash)
    return ob


def _tree(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def _falls(name, ob, glow, rnd, starts, r, step, sink=0.35, wob=0.35, inward=None):
    """Thin glowing seams running DOWN a steep face: from each start (x, y, z), a ray toward the face (along +Y, or
    toward the z axis when `inward`) every `step` m lower, the hits joined into a tapered chain (half sunk)."""
    tree = _tree(ob)
    out = []
    for i, (x, y, z) in enumerate(starts):
        pts = []
        while z > 0.1:
            if inward:
                d = Vector((-x, -y, 0)).normalized()
                o = Vector((x, y, z)) - d * 40
            else:
                d, o = Vector((0, 1, 0)), Vector((x, y - 60, z))
            loc, nrm, _, _ = tree.ray_cast(o, d)
            if loc is None:
                if pts:
                    break
                z -= step  # above the crest here: start lower
                continue
            pts.append(loc - nrm * r * sink)
            x += (rnd.random() - 0.5) * wob * step
            if inward:
                y += (rnd.random() - 0.5) * wob * step
            z -= step
        if len(pts) < 3:
            continue
        n = len(pts)
        # thin where it starts, widening as it runs down
        radii = [r * (0.35 if k == 0 else (0.55 + 0.6 * k / n) * (0.85 + rnd.random() * 0.3)) for k in range(n)]
        out.append(kit.chain(f"{name}{i}", pts, radii, glow, seg=5, smooth=False))
    return out


# ---- the props ---------------------------------------------------------------------------------------------------

def lip(P, coll, seed=3, L=2.6, tall=False):
    """A rim lip module `L` long (x), lying on the ring edge: a low band of cooled crust with jagged glossy obsidian
    shards leaning outward (+Y, away from the ring) and two glowing cracks. Under 1.0 m (`tall`: one 1.3 m blade)."""
    obs, _, crust, glow = P.materials()
    rnd = random.Random(seed)
    half = L / 2
    blobs = [((-half + 0.2 + (L - 0.4) * k / 4, 0.05 + (rnd.random() - 0.5) * 0.08, 0.0),
              (0.42 + rnd.random() * 0.12, 0.32 + rnd.random() * 0.08, 0.2 + rnd.random() * 0.1)) for k in range(5)]
    band = _mound("LipCrust", crust, rnd, blobs, voxel=0.045, target=260, chisel=6, keep=0.25, squash=(half / 0.25, 1.0),
                  rough=(0.03, 3.0))
    parts = [band]
    # chunky faceted blocks like the cover's ridges, every other one taller (`tall`: one 1.3 m blade among them)
    n = 8
    for k in range(n):
        x = -half + 0.2 + (L - 0.4) * (k + 0.15 + rnd.random() * 0.7) / n
        big = tall and k == 3
        h = 1.3 if big else (0.55 + rnd.random() * 0.45 if k % 2 else 0.3 + rnd.random() * 0.25)
        w = 0.55 if big else 0.32 + rnd.random() * 0.3
        parts.append(cp._shard(f"Sh{k}", (x, 0.08 + rnd.random() * 0.14, 0.0), w, w * 0.75, h,
                               math.pi / 2 + (rnd.random() - 0.5) * 1.0, 0.12 + rnd.random() * 0.3, obs, rnd, n=7,
                               blunt=0.3 if big else 0.5 + rnd.random() * 0.3))
    for k in range(3):
        # chips fallen inward, onto the rim
        x = -half + 0.3 + (L - 0.6) * rnd.random()
        parts.append(cp._shard(f"Chip{k}", (x, -0.2 - rnd.random() * 0.08, 0.04), 0.14, 0.11, 0.16 + rnd.random() * 0.1,
                               -math.pi / 2 + (rnd.random() - 0.5), 1.2, obs, rnd, n=5, blunt=0.5))
    starts = [(-half + 0.5 + (L - 1.0) * k + (rnd.random() - 0.5) * 0.3, -0.05, (rnd.random() - 0.5) * 0.8) for k in (0, 1)]
    parts += cp._cracks("LipCrack", band, glow, rnd, starts, r=0.022, steps=6, step=0.12)
    return parts


def prisms(P, coll, seed=7, tall=True):
    """A basalt prism cluster on a crust mound. `tall`: about 15 columns in a hexagonal packing up to ~4.6 m, falling
    off to the edge, a few snapped, a fallen drum (beyond |x| > 12 only). Otherwise a low outcrop of snapped stumps
    (under 1.5 m) with two toppled columns."""
    _, bas, crust, glow = P.materials()
    rnd = random.Random(seed)
    R = 1.9 if tall else 1.6
    blobs = [((0, 0, 0), (R * 0.8, R * 0.75, 0.35))]
    for k in range(6):
        a = k * math.pi / 3 + rnd.random() * 0.5
        blobs.append(((math.cos(a) * R * 0.6, math.sin(a) * R * 0.6, 0.0), (R * 0.45, R * 0.4, 0.2 + rnd.random() * 0.15)))
    mound = _mound("PrCrust", crust, rnd, blobs, voxel=0.07, target=600, chisel=8, keep=R * 0.9, rough=(0.06, 1.6))
    parts = [mound]
    pitch = 0.62
    cells = [(0, 0)] + [(math.cos(k * math.pi / 3) * pitch, math.sin(k * math.pi / 3) * pitch) for k in range(6)]
    cells += [(math.cos(k * math.pi / 6) * pitch * (2 if k % 2 == 0 else 1.73), math.sin(k * math.pi / 6) * pitch * (2 if k % 2 == 0 else 1.73))
              for k in range(12)]
    rnd.shuffle(cells[7:])
    cells = cells[:16 if tall else 11]
    for k, (x, y) in enumerate(cells):
        d = math.hypot(x, y) / (pitch * 2)
        if tall:
            h = 4.6 * (1 - 0.55 * d) * (0.8 + rnd.random() * 0.3)
            slant = 0.5 + rnd.random() * 0.4 if rnd.random() < 0.3 else 0.0
        else:
            h = 1.45 * (1 - 0.5 * d) * (0.55 + rnd.random() * 0.45)
            slant = 0.3 + rnd.random() * 0.5 if rnd.random() < 0.7 else 0.0
        parts.append(cp._column(f"Col{k}", (x + (rnd.random() - 0.5) * 0.06, y + (rnd.random() - 0.5) * 0.06, 0), 0.3 + rnd.random() * 0.04,
                                h, bas, rnd, slant=slant, chips=1))
    for k in range(1 if tall else 2):
        a = rnd.random() * 6.28
        parts.append(cp._column(f"Fallen{k}", (math.cos(a) * R * 1.05, math.sin(a) * R * 1.05, 0.0), 0.24, 1.2 if tall else 0.9, bas, rnd,
                                chips=1, lean=a + math.pi + 0.4, tilt=1.35))
    starts = [(math.cos(a) * R * 0.7, math.sin(a) * R * 0.7, a + (rnd.random() - 0.5) * 0.5) for a in (k * 2 * math.pi / 5 + 0.3 for k in range(5))]
    parts += cp._cracks("PrCrack", mound, glow, rnd, starts, r=0.028, steps=5, step=0.15)
    return parts


def boulder(P, coll, seed=11, R=1.2, H=0.9, target=420, cracks=3):
    """A cooled lava boulder: lobes of crust melted into one rounded mass, chiselled, glowing cracks over its top."""
    _, _, crust, glow = P.materials()
    rnd = random.Random(seed)
    blobs = [((0, 0, 0), (R, R * 0.8, H))]
    for k in range(3):
        a = k * 2.1 + rnd.random()
        blobs.append(((math.cos(a) * R * 0.55, math.sin(a) * R * 0.5, 0.0), (R * 0.6, R * 0.5, H * (0.55 + rnd.random() * 0.3))))
    ob = _mound("BCrust", crust, rnd, blobs, voxel=R * 0.05, target=target, chisel=9, keep=R * 0.6, rough=(R * 0.05, 1.8 / R),
                depth=(0.8, 0.93))
    starts = [(math.cos(a) * R * 0.25, math.sin(a) * R * 0.25, a) for a in (k * 2 * math.pi / max(1, cracks) + rnd.random() for k in range(cracks))]
    return [ob] + cp._cracks("BCrack", ob, glow, rnd, starts, r=0.022 * max(1.0, R), steps=6, step=R * 0.18)


def vent(P, coll, seed=13, R=1.7, H=1.5):
    """A volcanic vent: a crust cone with a crater, lumps round its foot, a glowing pool in the mouth and glowing
    cracks running down the flanks."""
    _, _, crust, glow = P.materials()
    rnd = random.Random(seed)
    cone = kit.lathe("VCone", [(0.0, -0.2), (R, -0.2), (R * 0.72, H * 0.35), (R * 0.4, H * 0.92), (R * 0.33, H),
                               (R * 0.25, H * 0.88), (R * 0.12, H * 0.62), (0.0, H * 0.6)], crust, seg=16)
    parts = [cone]
    for k in range(5):
        a = k * 2 * math.pi / 5 + rnd.random() * 0.6
        parts.append(kit.blob(f"VLump{k}", (math.cos(a) * R * 0.8, math.sin(a) * R * 0.8, 0.0),
                              (R * 0.35, R * 0.3, H * (0.2 + rnd.random() * 0.15)), crust, segs=(12, 7)))
    ob = sculpt.fuse(parts, "VCrust", voxel=R * 0.035, smooth=4, target=600)
    ob = _finish(ob, rnd, 6, keep=R * 0.85, rough=(R * 0.03, 2.0 / R), depth=(0.9, 0.97))
    pool = kit.blob("VPool", (0, 0, H * 0.64), (R * 0.2, R * 0.2, 0.05), glow, segs=(10, 5))
    starts = [(math.cos(a) * R * 0.36, math.sin(a) * R * 0.36, a + (rnd.random() - 0.5) * 0.4) for a in (k * 2 * math.pi / 4 + rnd.random() for k in range(4))]
    return [ob, pool] + cp._cracks("VCrack", ob, glow, rnd, starts, r=0.03 * R, steps=7, step=R * 0.17)


def spire(P, coll, seed=17, H=16.0, R=3.0, n=3, falls=2):
    """A lava-crusted rock spire: a jagged basalt needle with shoulder crags melted into it, chiselled into big
    facets, a collar of cooled crust round its foot and thin glowing seams running down its sides."""
    _, bas, crust, glow = P.materials()
    rnd = random.Random(seed)
    lean = (rnd.random() - 0.5) * R * 0.5
    prof = [(R, -1.0), (R * 0.7, H * 0.25), (R * 0.42, H * 0.55), (R * 0.2, H * 0.85), (0.0, H)]
    parts = [kit.lathe("SMain", prof, bas, seg=9)]
    for v in parts[0].data.vertices:
        v.co.x += lean * (v.co.z / H) ** 2
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.8
        d = R * (0.45 + 0.2 * rnd.random())
        hh = H * (0.3 + 0.3 * rnd.random())
        parts.append(kit.lathe(f"SSh{k}", [(R * 0.55, -1.0), (R * 0.2, hh * 0.8), (0.0, hh)], bas, seg=7,
                               centre=(math.cos(a) * d, math.sin(a) * d, 0)))
    ob = sculpt.fuse(parts, "SRock", voxel=R * 0.06, smooth=3, target=int(260 + H * 22))
    ob = _finish(ob, rnd, 12, keep=R * 0.35, rough=(R * 0.04, 1.2 / R), depth=(0.93, 0.99))
    blobs = [((math.cos(a) * R * 0.8, math.sin(a) * R * 0.8, 0.0), (R * 0.55, R * 0.45, H * (0.06 + rnd.random() * 0.05)))
             for a in (k * 2 * math.pi / 6 + rnd.random() * 0.5 for k in range(6))]
    collar = _mound("SCrust", crust, rnd, blobs, voxel=R * 0.08, target=280, chisel=5, keep=R * 0.9, rough=(R * 0.04, 1.5 / R))
    starts = []
    for k in range(falls):
        a = rnd.random() * 6.28
        starts.append((math.cos(a) * R, math.sin(a) * R, H * (0.45 + rnd.random() * 0.3)))
    return [ob, collar] + _falls("SFall", ob, glow, rnd, starts, r=R * 0.03, step=H * 0.08, inward=True)


def wall(P, coll, seed=19, W=36.0, D=12.0, H=30.0, falls=3):
    """A crater-wall segment `W` wide (x): big buttresses of basalt melted into a cliff facing -Y, jagged crags on its
    crest, chiselled into large facets, a talus of crust along its foot and `falls` thin lava falls down its face."""
    _, bas, crust, glow = P.materials()
    rnd = random.Random(seed)
    parts = []
    n = 6
    for k in range(n):
        x = -W / 2 + W * (k + 0.5) / n + (rnd.random() - 0.5) * 2
        h = H * (0.7 + rnd.random() * 0.4)
        parts.append(kit.blob(f"WB{k}", (x, D * 0.35, -2.0), (W / n * 0.85, D * 0.7, h), bas, segs=(14, 10)))
        if rnd.random() < 0.7:
            # a buttress pushing forward from the face
            parts.append(kit.blob(f"WF{k}", (x + (rnd.random() - 0.5) * 3, -D * 0.05, -2.0), (W / n * 0.45, D * 0.4, h * (0.4 + rnd.random() * 0.25)),
                                  bas, segs=(12, 8)))
    for k in range(5):
        # crags on the crest
        x = -W / 2 + W * (k + 0.2 + rnd.random() * 0.6) / 5
        hh = H * (0.25 + rnd.random() * 0.3)
        parts.append(kit.lathe(f"WC{k}", [(W / 12, 0.0), (W / 30, hh * 0.7), (0.0, hh)], bas, seg=6,
                               centre=(x, D * 0.35 + (rnd.random() - 0.5) * 3, H * (0.55 + rnd.random() * 0.25))))
    ob = sculpt.fuse(parts, "WRock", voxel=W * 0.01, smooth=3, target=1600)
    ob = _finish(ob, rnd, 16, keep=D * 0.25, squash=(W / 2 / (D * 0.25), 1.0), rough=(W * 0.006, 4.0 / W), depth=(0.9, 0.98))
    blobs = [((-W / 2 + W * (k + 0.5) / 7, -D * 0.25 + (rnd.random() - 0.5) * 2, 0.0), (W / 7 * 0.7, D * 0.25, H * (0.06 + rnd.random() * 0.05)))
             for k in range(7)]
    talus = _mound("WCrust", crust, rnd, blobs, voxel=W * 0.02, target=320, chisel=6, keep=D * 0.1, squash=(W / 2 / (D * 0.1), 1.0),
                   rough=(W * 0.006, 4.0 / W))
    starts = [(-W / 2 + W * (k + 0.3 + rnd.random() * 0.4) / falls, 0.0, H * (0.55 + rnd.random() * 0.3)) for k in range(falls)]
    return [ob, talus] + _falls("WFall", ob, glow, rnd, starts, r=0.32, step=H * 0.06, wob=0.25)


BACKDROP = {
    "LipA": (lip, {"seed": 3}),
    "LipB": (lip, {"seed": 5, "tall": True}),
    "Prisms": (prisms, {"seed": 7, "tall": True}),
    "PrismsLow": (prisms, {"seed": 9, "tall": False}),
    "Boulder": (boulder, {"seed": 11}),
    "BoulderS": (boulder, {"seed": 23, "R": 0.5, "H": 0.36, "target": 140, "cracks": 1}),
    "Vent": (vent, {"seed": 13}),
    "SpireA": (spire, {"seed": 17, "H": 16.0, "R": 3.0}),
    "SpireB": (spire, {"seed": 29, "H": 9.0, "R": 2.2, "n": 2, "falls": 1}),
    "WallA": (wall, {"seed": 19}),
    "WallB": (wall, {"seed": 31, "H": 24.0, "falls": 2}),
}


def _merge(name, parts):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        if ob.name not in bpy.data.objects or ob.type != "MESH" or not len(ob.data.polygons):
            if ob.name in bpy.data.objects:
                bpy.data.objects.remove(ob, do_unlink=True)
            continue
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("caldera_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        cp._tidy(ob, cp.SHARP.get(short, 40))
        out.append(ob)
    return out


def build(name):
    """Builds one backdrop prop into the collection "CalderaBack <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, kw = BACKDROP[name]
    kit.clear(f"{PREFIX} {name}")
    coll = kit.collection(f"{PREFIX} {name}")
    objs = _merge(name, fn(cp.Props(), coll, **kw))
    top = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    sculpt.paint(coll, height=max(top, 1.0), ao_dist=0.25 if top < 3 else (0.8 if top < 12 else 3.0), tints=cp.TINTS)
    st = kit.stats(coll)
    st["height"] = round(top, 2)
    st["parts"] = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs}
    return st


def export():
    colls = []
    for name in BACKDROP:
        c = bpy.data.collections.get(f"{PREFIX} {name}")
        if c is None or not c.objects:
            build(name)
            c = bpy.data.collections[f"{PREFIX} {name}"]
        colls.append(c)
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


def clear():
    """Deletes the backdrop collections (after exporting: keep the shared scene light)."""
    for name in BACKDROP:
        kit.clear(f"{PREFIX} {name}")
    kit.purge()
