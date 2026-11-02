"""
Frostfall Lake backdrop props, in the cover's sculpted-and-painted style (blender/arenas/frost_props.py): snow-laden
pines (three forest variants, a cheap far one and a low scrub pine), a frozen dead tree, snow-capped boulders and
small rocks, broken shore ice plates, an ice pressure ridge and two far mountain peaks. Exported to
public/models/arenas/frost_backdrop.glb as objects named "<Prop>__<material>" and placed (seeded) by
src/arenas/frost.ts.

The ice, snow and rock materials are the cover's (frost_props_ice / snow / rock), so in three.js the backdrop shares
the cover's tuned materials; bark, needle and dead (pale frozen wood) are new. Pine needles are drooping, jagged
tiers melted into one mass (`sculpt.fuse`); the snow on the branches is draped over their upward faces
(`glade_props._drape`). Cheaper than the cover (coarse voxels, small triangle targets): it is seen from 12 m and
further, the peaks from 60 m.

Run inside Blender (through the MCP server), one or two props per call, then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import frost_backdrop as fb; importlib.reload(fb)
    fb.build("PineA")   # ... see BACKDROP
    fb.export()         # builds what is missing, writes the GLB
    fb.clear()

Blender coordinates: metres, z up, every prop stands on its base centre (in three.js the model's -Y becomes +Z).
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
from mathutils import Euler, Matrix, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import frost_props as fp  # noqa: E402  (the cover's materials and rock / snow helpers)
import glade_props as gp  # noqa: E402  (shape helpers: _drape, _break, _chisel, _rough, _tidy)
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "frost_backdrop.glb")
PREFIX = "FrostBack"

BARK = "#3e3430"
NEEDLE = "#264238"
DEAD = "#8c847c"

SHARP = {"ice": 30, "snow": 60, "rock": 30, "bark": 50, "needle": 70, "dead": 35}
TINTS = dict(fp.TINTS, needle={"shadow": (0.5, 0.66, 0.78)}, bark={"shadow": (0.7, 0.66, 0.8)}, dead={"shadow": (0.7, 0.74, 0.9)})


def _mats(P):
    ice, snow, rock = P.materials()
    return ice, snow, rock, P.mat("bark", BARK, roughness=0.95), P.mat("needle", NEEDLE, roughness=0.95), P.mat("dead", DEAD, roughness=0.9)


# ---- trees -------------------------------------------------------------------------------------------------------

def _upper(f):
    """Height (fraction of the tier's `h`) of a tier's upper surface at radius fraction `f` (0 apex, 1 rim)."""
    return 0.5 * (1 - f) / 0.58 if f >= 0.42 else 0.5 + 0.5 * (0.42 - f) / 0.42


class _Tier:
    """One drooping branch tier: a cone `h` tall over a star-shaped skirt of `n` branch tips (radius `r` at height
    `z0`), the tips hanging down by `droop` (fraction of `h`), each tip its own length."""

    def __init__(self, rnd, z0, r, h, droop, n):
        self.z0, self.r, self.h, self.droop, self.n = z0, r, h, droop, n
        self.ph = rnd.random() * 6.28
        self.tips = [0.8 + 0.35 * rnd.random() for _ in range(n)]
        self.notch = 0.3 + 0.1 * rnd.random()

    def point(self, f, zf, j, lift=0.0):
        """The point at radius fraction `f`, height fraction `zf`, on spoke `j` (even: a tip, odd: a notch)."""
        a = self.ph + j * math.pi / self.n
        s = self.tips[(j // 2) % self.n] if j % 2 == 0 else (1 - self.notch)
        s = 1 + (s - 1) * f ** 1.5
        z = self.z0 + self.h * zf - self.droop * self.h * f ** 3 * s + lift
        return Vector((math.cos(a) * self.r * f * s, math.sin(a) * self.r * f * s, z))

    def mesh(self, name, mat, rings, apex_lift=0.0, close=False):
        """A skirt through `rings` [(f, zf, lift)] from the apex outward (closed at the bottom with `close`)."""
        bm = bmesh.new()
        m = 2 * self.n
        apex = bm.verts.new(self.point(0, 1, 0, apex_lift))
        loops = [[bm.verts.new(self.point(f, zf, j, lift)) for j in range(m)] for f, zf, lift in rings]
        for j in range(m):
            bm.faces.new((apex, loops[0][j], loops[0][(j + 1) % m]))
        for r0, r1 in zip(loops, loops[1:]):
            for j in range(m):
                bm.faces.new((r0[j], r1[j], r1[(j + 1) % m], r0[(j + 1) % m]))
        if close:
            bot = bm.verts.new(Vector((0, 0, self.z0 - 0.12 * self.h)))
            for j in range(m):
                bm.faces.new((loops[-1][(j + 1) % m], loops[-1][j], bot))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return kit.mesh_object(name, bm, mat, smooth=True)


def pine(P, coll, seed=1, H=11.0, R=2.6, tiers=5, droop=0.35, n=6, snow=0.12, lean=0.0, gaps=False):
    """A snow-laden pine: a thin trunk under `tiers` drooping, star-shaped branch tiers of `n` tips each, a snow cap
    lying on the top of every tier (following its branches, thinning toward the tips). `gaps`: tiers spaced apart
    (a wind-torn, sparse tree)."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    out = [kit.lathe("Trunk", [(0.0, -0.3), (R * 0.1, -0.3), (R * 0.07, H * 0.3), (R * 0.03, H * 0.9), (0.0, H * 0.95)], bark, seg=6)]
    for k in range(tiers):
        t = k / max(1, tiers - 1)
        z0 = H * (0.16 + 0.6 * t) + (rnd.random() - 0.5) * H * 0.03
        r = R * (1 - 0.72 * t) * (0.9 + 0.2 * rnd.random())
        h = H * ((0.22 if gaps else 0.3) - 0.1 * t)
        tr = _Tier(rnd, z0, r, h, droop, n)
        out.append(tr.mesh(f"Tier{k}", needle, [(0.42, _upper(0.42), 0), (0.76, _upper(0.76), 0), (1.0, 0.0, 0)], close=True))
        # the snow's edge lies on the tier's middle ring (so it never floats over the chord of the drooping skirt)
        th = snow * (1.4 if k == tiers - 1 else 1.0)
        out.append(tr.mesh(f"Snow{k}", snw, [(0.4, _upper(0.4), th), (0.76, _upper(0.76), 0.015)], apex_lift=th * 1.3))
    if lean:
        m = Matrix.Rotation(lean, 4, "X")
        for ob in out:
            ob.data.transform(m)
    return out


def dead_tree(P, coll, seed=5, H=7.0):
    """A frozen dead tree: a grey trunk forking into bare, upturned branches, its top snapped off (pale wood), a thin
    crust of snow on the upper faces of trunk and branches."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    ph = rnd.random() * 6.28
    trunk = kit.lathe("DTrunk", [(0.5, -0.3), (0.42, 0.0), (0.3, 0.5), (0.24, H * 0.4), (0.17, H * 0.75), (0.12, H)], dead, seg=10)
    for v in trunk.data.vertices:
        v.co.x += 0.3 * math.sin(v.co.z * 0.35 + ph)
    parts = [trunk]
    limbs = []  # (points, radii) of every branch, for the snow lying on them
    for k in range(6):
        a = ph + k * 2.4 + rnd.random() * 0.5
        z0 = H * (0.3 + 0.1 * k + rnd.random() * 0.04)
        ln = H * (0.34 + rnd.random() * 0.12) * (1 - 0.09 * k)
        p0 = Vector((0.3 * math.sin(z0 * 0.35 + ph), 0, z0))
        d = Vector((math.cos(a), math.sin(a), 0.35 + rnd.random() * 0.4)).normalized()
        pts = [p0, p0 + d * ln * 0.5, p0 + d * ln + Vector((0, 0, ln * 0.22))]
        limbs.append((pts, [0.16, 0.1, 0.035]))
        # a fork from the middle, turning off to one side
        a2 = a + (0.7 if k % 2 else -0.7)
        d2 = Vector((math.cos(a2), math.sin(a2), 0.6)).normalized()
        limbs.append(([pts[1], pts[1] + d2 * ln * 0.4], [0.07, 0.025]))
    for i, (pts, rad) in enumerate(limbs):
        parts.append(kit.chain(f"DBr{i}", pts, rad, dead, seg=6))
    ob = sculpt.fuse(parts, "DeadWood", voxel=0.05, smooth=3, target=600)
    gp._cut_below(ob)
    gp._grooves(ob, 7, 0.03, seed)
    out = [ob, gp._break(ob, [((0.3 * math.sin(H * 0.95 * 0.35 + ph), 0, H * 0.93), (0.5, 0.3, 1))], dead, "Snap")]
    # snow: a ridge along the top of each branch (thinning to the tip) and a cap on the snapped trunk
    for i, (pts, rad) in enumerate(limbs):
        sp = [p + Vector((0, 0, r * 0.75)) for p, r in zip(pts, rad)]
        out.append(kit.chain(f"DSnow{i}", sp, [r * 0.85 for r in rad[:-1]] + [0.015], snw, seg=5))
    top = Vector((0.3 * math.sin(H * 0.9 * 0.35 + ph), 0, H * 0.9))
    out.append(kit.blob("DCap", top + Vector((0, 0, 0.05)), (0.2, 0.2, 0.09), snw, segs=(8, 5)))
    return out


# ---- rocks -------------------------------------------------------------------------------------------------------

def boulder(P, coll, seed=7, R=1.6, H=1.3, target=600, snow=0.14):
    """A chiselled boulder half buried in snow, a thick snow cap on its top faces."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    ob = fp._rock_base("BRock", rock, rnd, R, H, n=6, target=target)
    cap = gp._drape(ob, "BSnow", snw, rnd, up=0.62, thresh=-0.12, thick=snow, scale=1.4 / R)
    return [ob, cap]


# ---- shore ice -------------------------------------------------------------------------------------------------

def _slab(name, ice, rnd, size, at, rot, el=(-0.12, 0.12), cuts=5):
    """A broken ice slab: a thin box with its edges cut into a jagged outline (plane cuts with normals between
    elevations `el`), tilted by `rot` and moved to `at`."""
    ob = kit.box(name, (0, 0, 0), size, ice, bevel=0.02, segments=1)
    gp._chisel(ob, rnd, cuts, keep=min(size[0], size[1]) * 0.3, depth=(0.6, 0.9), el=el)
    ob.data.transform(Matrix.Translation(Vector(at)) @ Euler(rot).to_matrix().to_4x4())
    return ob


def plates(P, coll, seed=11, n=5, R=1.4):
    """Broken shore ice plates pushed up on each other (a cluster `R` across, under 0.6 m)."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    out = []
    for k in range(n):
        a, d = k * 2 * math.pi / n + rnd.random() * 0.6, R * (0.2 + 0.5 * rnd.random())
        w, dd = rnd.uniform(0.7, 1.2), rnd.uniform(0.5, 0.9)
        tilt = rnd.uniform(0.2, 0.6)
        out.append(_slab(f"Pl{k}", ice, rnd, (w, dd, 0.14), (math.cos(a) * d, math.sin(a) * d, 0.02 + math.sin(tilt) * dd * 0.4),
                         (tilt * math.cos(a), tilt * math.sin(a), rnd.random() * 3)))
    return out


def ridge(P, coll, seed=13, L=4.4):
    """An ice pressure ridge `L` long (x): broken slabs shoved up edge-on, leaning both ways along a crack, snow
    drifted against its foot. Under 1 m."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    out = []
    n = 8
    for k in range(n):
        x = -L / 2 + (k + 0.5) * L / n + (rnd.random() - 0.5) * 0.25
        h = 0.45 + 0.4 * math.sin(math.pi * (k + 0.5) / n) * (0.7 + 0.5 * rnd.random())
        side = 1 if k % 2 else -1
        out.append(_slab(f"Rs{k}", ice, rnd, (rnd.uniform(0.5, 0.8), 0.13, h * 1.3), (x, side * 0.12, h * 0.42),
                         (side * rnd.uniform(0.3, 0.7), rnd.uniform(-0.25, 0.25), rnd.uniform(-0.3, 0.3)), el=(-0.1, 1.2), cuts=4))
    blobs = [((-L / 2 + (k + 0.5) * L / 5, (rnd.random() - 0.5) * 0.3, 0.0), (L / 5 * 0.8, 0.75, 0.26 + 0.08 * rnd.random())) for k in range(5)]
    out.append(fp._snow_cap("RSnow", snw, rnd, blobs, target=360))
    return out


# ---- far peaks ---------------------------------------------------------------------------------------------------

def peak(P, coll, seed=17, W=40.0, H=24.0, n=5):
    """A far mountain: a main peak with shoulder masses melted into one, chiselled into big rock faces, snow lying
    on the upper slopes (none on the steep faces). `W` across, `H` tall."""
    ice, snw, rock, bark, needle, dead = _mats(P)
    rnd = random.Random(seed)
    parts = [kit.lathe("PMain", [(0.0, -2.0), (W * 0.5, -2.0), (W * 0.26, H * 0.35), (W * 0.07, H * 0.85), (0.0, H)], rock, seg=12)]
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.8
        d = W * (0.22 + 0.12 * rnd.random())
        hh = H * (0.35 + 0.3 * rnd.random())
        parts.append(kit.lathe(f"PSh{k}", [(0.0, -2.0), (W * 0.26, -2.0), (W * 0.06, hh * 0.85), (0.0, hh)], rock, seg=9,
                               centre=(math.cos(a) * d, math.sin(a) * d, 0)))
    ob = sculpt.fuse(parts, "PeakRock", voxel=W * 0.012, smooth=3, target=900)
    gp._cut_below(ob, 0.0)
    gp._rough(ob, W * 0.012, 6.0 / W, seed)
    gp._chisel(ob, rnd, 14, keep=W * 0.42, depth=(0.88, 0.97), el=(0.3, 1.0))
    snow = gp._drape(ob, "PeakSnow", snw, rnd, up=0.45, thresh=-0.3, thick=W * 0.008, scale=8.0 / W, where=lambda c: c.z > H * 0.35)
    return [ob, snow]


BACKDROP = {
    "PineA": (pine, {"seed": 41, "H": 11.0, "R": 2.6, "tiers": 5}),
    "PineB": (pine, {"seed": 43, "H": 8.5, "R": 1.7, "tiers": 5, "droop": 0.45}),
    "PineC": (pine, {"seed": 47, "H": 13.5, "R": 2.7, "tiers": 5, "gaps": True, "droop": 0.5, "lean": 0.04}),
    "PineFar": (pine, {"seed": 53, "H": 12.0, "R": 2.6, "tiers": 4, "n": 5, "snow": 0.16}),
    "PineS": (pine, {"seed": 59, "H": 1.7, "R": 0.75, "tiers": 3, "n": 5, "snow": 0.05}),
    "DeadTree": (dead_tree, {"seed": 61, "H": 7.0}),
    "BoulderA": (boulder, {"seed": 67, "R": 1.6, "H": 1.3, "target": 600}),
    "BoulderB": (boulder, {"seed": 71, "R": 1.0, "H": 0.8, "target": 380, "snow": 0.1}),
    "RockS": (boulder, {"seed": 73, "R": 0.5, "H": 0.38, "target": 150, "snow": 0.05}),
    "Plates": (plates, {"seed": 79}),
    "Ridge": (ridge, {"seed": 83}),
    "PeakA": (peak, {"seed": 89, "W": 40.0, "H": 24.0}),
    "PeakB": (peak, {"seed": 97, "W": 34.0, "H": 15.0, "n": 6}),
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
        short = mname.replace("frost_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        gp._tidy(ob, SHARP.get(short, 40))
        out.append(ob)
    return out


def build(name):
    """Builds one backdrop prop into the collection "FrostBack <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, kw = BACKDROP[name]
    kit.clear(f"{PREFIX} {name}")
    coll = kit.collection(f"{PREFIX} {name}")
    objs = _merge(name, fn(fp.Props(), coll, **kw))
    top = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    sculpt.paint(coll, height=max(top, 1.0), ao_dist=0.25 if top < 3 else (0.8 if top < 16 else 3.0), tints=TINTS)
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
