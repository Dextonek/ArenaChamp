"""
The Sun Warden's sanctum props (the Raid's Sun Court room, see pipeline/designs/raid-noonfall.md "The lairs"): the
boss's own home, not the duel temple's. Dark violet stone like the Warden himself, with his gold inlay bars and sun
rings, chiselled and faceted. Cover: three screen-wall modules (whole, cracked, rubble), a sun obelisk, the Sun Well
and a sun bowl. Backdrop: his empty throne under a halo round a small sun, a tall obelisk, a broken sun arch and
three floating stones. Each prop is built in its own collection at the origin (its base centre, front toward -Y),
painted (ambient occlusion, edge light, height gradient, see blender/heroes/sculpt.py) and exported together to
public/models/arenas/sanctum_props.glb as objects named "<Prop>__<material>" (materials: stone, dark, light, gold,
glow), like temple_props.glb.

Sizes are the game's collision shapes: Wall* 3.14 m long (x) and 0.7 m deep, Column r 0.85 and 4.2 m tall, Altar r 1.0
and under 1.45 m, Brazier ~1 m tall (it stands on a 1.05 m step).

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import sanctum_props; importlib.reload(sanctum_props)
    sanctum_props.export()        # builds everything, writes the GLB, returns triangles per prop
    sanctum_props.sheet()         # the review sheet, docs/arenas/sanctum_props_sheet.jpg (EEVEE)
    sanctum_props.clear()

Blender coordinates: metres, z up. In three.js (y up) the model's -Y becomes +Z.
"""
import importlib
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(os.path.dirname(HERE), "heroes"), r"C:\projectG\xianxia\blender"):
    if p not in sys.path:
        sys.path.insert(0, p)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "models", "arenas", "sanctum_props.glb")
SHEET = os.path.join(ROOT, "docs", "arenas", "sanctum_props_sheet.jpg")

STONE = "#4d4866"
STONE_DARK = "#352f4c"
STONE_LIGHT = "#645e80"
GOLD = "#c79a3a"
GLOW = "#ffc65c"


class Props:
    def __init__(self, prefix="sanctum_props"):
        self.prefix = prefix
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"{self.prefix}_{part}", color, **kw)
        return self.mats[part]

    def materials(self):
        return (self.mat("stone", STONE, roughness=0.85), self.mat("dark", STONE_DARK, roughness=0.9),
                self.mat("light", STONE_LIGHT, roughness=0.8), self.mat("gold", GOLD, metallic=0.7, roughness=0.34),
                self.mat("glow", GLOW, emission="#ffb23a", strength=2.6))


# ---- shape helpers -----------------------------------------------------------------------------------------------

def hull(name, pts, mat):
    """The convex hull of points: a faceted chunk."""
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(bm, input=verts)
    loose = {g for g in res["geom_interior"] + res["geom_unused"] if isinstance(g, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(loose), context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit.mesh_object(name, bm, mat, smooth=False)


def chunk(name, centre, size, mat, rnd, yaw=0.0, tilt=(0.0, 0.0), jitter=0.16, top=1.0):
    """A chiselled block (a box whose corners are knocked about), `top` < 1 narrows its top."""
    w, d, h = size
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                k = top if sz > 0 else 1.0
                pts.append((sx * w / 2 * k * (1 - jitter * rnd.random()), sy * d / 2 * k * (1 - jitter * rnd.random()),
                            sz * h / 2 * (1 - jitter * 0.7 * rnd.random())))
    ob = hull(name, pts, mat)
    ob.data.transform(Matrix.Translation(Vector(centre)) @ Euler((tilt[0], tilt[1], yaw)).to_matrix().to_4x4())
    return ob


def prism4(name, profile, mat, centre=(0, 0, 0)):
    """A four-sided tapering shaft: profile [(half-width, z), ...] (axis-aligned square, add (0, z) ends to close)."""
    ob = kit.lathe(name, [(max(h, 1e-4) * math.sqrt(2), z) for h, z in profile], mat, seg=4, smooth=False)
    ob.data.transform(Matrix.Translation(Vector(centre)) @ Matrix.Rotation(math.pi / 4, 4, "Z"))
    return ob


def turn(ob, k, n=4):
    """Rotates an object's mesh about the z axis by k/n of a turn (copies a face detail onto the other faces)."""
    ob.data.transform(Matrix.Rotation(2 * math.pi * k / n, 4, "Z"))
    return ob


def crack(name, pts, r, mat):
    """A zig-zag crack of light with tapered ends."""
    radii = [r * (0.3 if i in (0, len(pts) - 1) else 1.0 - 0.5 * i / len(pts)) for i in range(len(pts))]
    return kit.chain(name, pts, radii, mat, seg=4, smooth=False)


def sun_ring(name, centre, r, gold, glow, axis=(1, 0, 0), rays=8, ray_len=0.1, core=0.5, minor=None):
    """A gold sun ring with a glowing core and short rays, facing along `axis`."""
    minor = minor or r * 0.17
    a = Vector(axis).normalized()
    u = a.orthogonal().normalized()
    v = a.cross(u)
    c = Vector(centre)
    flat = [r * core, r * core, r * core]
    flat[max(range(3), key=lambda i: abs(a[i]))] = r * core * 0.35
    parts = [kit.torus(f"{name}Ring", tuple(c), r, minor, gold, seg=(max(14, int(r * 70)), 5), axis=tuple(a)),
             kit.blob(f"{name}Core", tuple(c), tuple(flat), glow, segs=(12, 6))]
    for k in range(rays):
        t = 2 * math.pi * k / rays
        d = u * math.cos(t) + v * math.sin(t)
        parts.append(kit.tube(f"{name}Ray{k}", tuple(c + d * (r + minor * 0.6)), tuple(c + d * (r + minor + ray_len)),
                              [(0, minor * 0.9, minor * 0.9), (1, 0.004, 0.004)], gold, seg=4, smooth=False))
    return parts


# ---- cover -------------------------------------------------------------------------------------------------------

def _slab(name, x, top, w, mat, skew=0.0, depth=0.56):
    """A sun-stone slab: a tall block with a faceted crown, extruded across the wall's depth."""
    t = top
    # a sundial wedge: the crown slopes from a low shoulder up to a sharp high corner (skew < 0 mirrors it)
    sgn = 1 if skew >= 0 else -1
    outline = [(-w, 0.3), (w, 0.3), (w, t - 0.7), (w * 0.86, t - 0.5), (w * sgn, t - 0.5 + (0.0 if sgn > 0 else 0.0)),
               (w * 0.3 * sgn, t), (-w * 0.9 * sgn, t - 0.34), (-w, t - 0.5), (-w, t - 0.7)]
    outline = [(x, z) for x, z in outline]
    if sgn > 0:
        outline = [(-w, 0.3), (w, 0.3), (w, t - 0.45), (w * 0.35, t), (-w * 0.1, t - 0.04), (-w, t - 0.5)]
    else:
        outline = [(-w, 0.3), (w, 0.3), (w, t - 0.5), (w * 0.1, t - 0.04), (-w * 0.35, t), (-w, t - 0.45)]
    return kit.extrude_shape(name, outline, depth, mat, bevel=0.03, axis="Y", centre=(x, 0, 0))


def wall(P, coll, variant="whole", L=3.14):
    """A screen-wall module `L` long (x), 0.7 m deep: a dark plinth, a solid carved body 1.3 m high with a raised light
    panel, a gold lozenge and seam bars on both faces (the Warden's inlay), and a crown of five sun-ray fins of
    different heights rising to 2.3 m. variant "cracked": the middle fins are broken short, the body is split by
    cracks of light and a chunk lies fallen at the foot."""
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(5)
    parts = [kit.box("Plinth", (0, 0, 0.17), (L + 0.1, 0.76, 0.34), dark, bevel=0.04, segments=2),
             kit.box("Body", (0, 0, 0.72), (L - 0.12, 0.62, 0.76), stone, bevel=0.04, segments=2),
             kit.box("Cap", (0, 0, 1.12), (L - 0.02, 0.68, 0.1), dark, bevel=0.03, segments=2)]
    cracked = variant == "cracked"
    for i, (x, t, w) in enumerate(((-1.28, 2.0, 0.3), (-0.64, 1.75, 0.3), (0.0, 2.3, 0.3), (0.64, 1.85, 0.3), (1.28, 2.1, 0.3))):
        if cracked and i in (2, 3):
            t = (1.6, 1.45)[i - 2]
            outline = [(-w, 1.1), (w, 1.1), (w, t - 0.1), (w * 0.2, t + 0.12), (-w * 0.3, t - 0.1), (-w, t + 0.02)]
        else:
            outline = [(-w, 1.1), (w, 1.1), (w, t - 0.7), (0, t), (-w, t - 0.7)]
        parts.append(kit.extrude_shape(f"Fin{i}", outline, 0.46, light if i % 2 else stone, bevel=0.025, axis="Y", centre=(x, 0, 0)))
        for side in (-1, 1):
            parts.append(kit.box(f"FinBar{i}{side}", (x, side * 0.235, 1.4), (0.04, 0.03, 0.26), gold, bevel=0.005, segments=1))
    for i, x in enumerate((-1.0, 0.0, 1.0)):
        for side in (-1, 1):
            y = side * 0.315
            parts.append(kit.box(f"Panel{i}{side}", (x, y, 0.72), (0.8, 0.05, 0.52), light, bevel=0.015, segments=1))
            if cracked and i == 1:
                continue
            yg = side * 0.34
            parts.append(kit.extrude_shape(f"Lozenge{i}{side}", [(0, -0.21), (0.15, 0), (0, 0.21), (-0.15, 0)], 0.035, gold, bevel=0.006, axis="Y", centre=(x, yg, 0.72)))
            for k in (-1, 1):
                parts.append(kit.box(f"Dash{i}{side}{k}", (x + k * 0.3, yg, 0.72), (0.12, 0.03, 0.03), gold, bevel=0.005, segments=1))
    for sx in (-0.5, 0.5):
        for side in (-1, 1):
            parts.append(kit.box(f"Seam{sx}{side}", (sx, side * 0.32, 0.72), (0.04, 0.03, 0.7), dark, bevel=0.005, segments=1))
    if cracked:
        parts.append(chunk("Fallen", (0.2, -0.4, 0.2), (0.62, 0.36, 0.38), stone, rnd, yaw=0.5, tilt=(0.0, 0.25)))
        parts.append(chunk("FallenB", (-0.35, 0.42, 0.12), (0.4, 0.3, 0.22), dark, rnd, yaw=1.1))
        parts.append(chunk("FallenC", (0.75, 0.4, 0.1), (0.3, 0.25, 0.2), light, rnd, yaw=2.1))
        for side in (-1, 1):
            y = side * 0.343
            parts.append(crack(f"CrackA{side}", [(-1.35, y, 1.08), (-1.2, y, 0.9), (-1.3, y, 0.72), (-1.08, y, 0.55), (-1.18, y, 0.42), (-1.0, y, 0.3)], 0.018, glow))
            parts.append(crack(f"CrackB{side}", [(0.95, y, 1.08), (1.1, y, 0.9), (1.0, y, 0.72), (1.22, y, 0.55), (1.12, y, 0.42), (1.3, y, 0.3)], 0.018, glow))
            parts.append(crack(f"CrackC{side}", [(-0.3, y, 1.05), (-0.1, y, 0.88), (-0.22, y, 0.7), (0.0, y, 0.55), (-0.1, y, 0.4)], 0.016, glow))
    return parts


def wall_rubble(P, coll, L=3.14):
    """A fallen screen wall under 0.6 m: the plinth split in two, stumps of slabs, a heap of broken sun-stone blocks
    with a few gold inlay bars lying among them and one block still cracked with light."""
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(17)
    parts = [
        kit.box("PlinthA", (-0.8, 0.02, 0.1), (1.35, 0.78, 0.2), dark, bevel=0.04, segments=2, rotation=Euler((0.0, 0.04, 0.03))),
        kit.box("PlinthB", (0.85, -0.03, 0.09), (1.4, 0.76, 0.18), dark, bevel=0.04, segments=2, rotation=Euler((0.03, -0.05, -0.04))),
    ]
    for i, (x, w, h) in enumerate(((-1.15, 0.8, 0.45), (0.05, 0.6, 0.3), (1.1, 0.8, 0.38))):
        parts.append(chunk(f"Stump{i}", (x, 0.0, 0.2 + h / 2), (w, 0.56, h), stone, rnd, yaw=(rnd.random() - 0.5) * 0.2, top=0.8))
    for k in range(10):
        w, d, h = 0.28 + rnd.random() * 0.34, 0.24 + rnd.random() * 0.2, 0.16 + rnd.random() * 0.2
        x = -1.3 + 2.6 * (k + rnd.random() * 0.6) / 10
        y = (rnd.random() - 0.5) * 0.55
        z = 0.22 + h / 2 if abs(y) < 0.3 and abs(x) < 1.2 and rnd.random() < 0.4 else h / 2 + 0.02
        parts.append(chunk(f"Block{k}", (x, y, z), (w, d, h), (stone, light, stone, dark)[k % 4], rnd, yaw=rnd.random() * 3.14,
                           tilt=((rnd.random() - 0.5) * 0.4, (rnd.random() - 0.5) * 0.4)))
    for k, (x, y, yaw) in enumerate(((0.4, -0.4, 0.3), (-0.6, 0.35, 2.5), (1.35, 0.3, 1.2))):
        parts.append(kit.box(f"Inlay{k}", (x, y, 0.045), (0.34, 0.045, 0.04), gold, bevel=0.006, segments=1, rotation=Euler((0, 0, yaw))))
    parts.append(chunk("Glowing", (-0.05, -0.36, 0.14), (0.42, 0.3, 0.24), dark, rnd, yaw=0.6))
    parts.append(crack("RubCrack", [(-0.2, -0.51, 0.1), (-0.08, -0.51, 0.2), (0.02, -0.5, 0.12)], 0.014, glow))
    return parts


def column(P, coll):
    """A sun obelisk: a four-sided shaft tapering from 1.16 m to 0.76 m across on a two-step plinth (1.68 m square at
    the foot), vertical gold bars on every face, a gold sun ring with a glowing core near the top, a pyramid cap with a
    gold tip. 4.2 m tall."""
    stone, dark, light, gold, glow = P.materials()
    half = lambda z: 0.58 - 0.2 * (z - 0.5) / 2.85  # noqa: E731
    slope = math.atan(0.2 / 2.85)
    parts = [
        prism4("Foot", [(0, 0), (0.84, 0), (0.84, 0.26), (0.0, 0.26)], dark),
        prism4("Step", [(0, 0.26), (0.7, 0.26), (0.7, 0.5), (0.0, 0.5)], stone),
        prism4("Shaft", [(0, 0.5), (0.58, 0.5), (0.38, 3.35), (0.0, 3.35)], light),
        prism4("Capstone", [(0, 3.35), (0.43, 3.35), (0.43, 3.5), (0.3, 3.55), (0.04, 4.0), (0.0, 4.0)], stone),
        prism4("Tip", [(0, 3.96), (0.07, 3.96), (0.0, 4.2)], gold),
        prism4("Collar", [(0, 3.3), (0.47, 3.3), (0.47, 3.38), (0.0, 3.38)], dark),
        prism4("Band", [(0, 1.5), (half(1.5) + 0.025, 1.5), (half(1.5) + 0.025, 1.56), (0, 1.56)], gold),
    ]
    for k in range(4):
        for dx in (-0.2, 0.2):
            zc = 0.95
            b = kit.box(f"Bar{k}{dx}", (half(zc) + 0.004, dx, zc), (0.045, 0.05, 0.6), gold, bevel=0.007, segments=1, rotation=Euler((0, -slope, 0)))
            parts.append(turn(b, k))
        zs = 2.75
        for ob in sun_ring(f"Sun{k}", (half(zs) + 0.02, 0, zs), 0.17, gold, glow, axis=(1, 0, 0), rays=8, ray_len=0.07, core=0.55):
            parts.append(turn(ob, k))
        # a stepped notch under the ring
        parts.append(turn(kit.box(f"Notch{k}", (half(2.2) + 0.004, 0, 2.2), (0.04, 0.3, 0.05), gold, bevel=0.006, segments=1, rotation=Euler((0, -slope, 0))), k))
    return parts


def altar(P, coll):
    """The Sun Well, r 1.0 and 1.4 m tall: a stepped drum, a faceted twelve-sided well wall with a gold rim, a pool of
    sun inside with a crown of light rising from it, four gnomon stones round the rim and gold hour marks on the step."""
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(3)
    parts = [
        kit.lathe("Drum", [(0.0, 0.0), (1.0, 0.0), (1.0, 0.16), (0.94, 0.22), (0.94, 0.3), (0.0, 0.3)], dark, seg=24, smooth=False),
        kit.lathe("Wall", [(0.0, 0.3), (0.84, 0.3), (0.8, 0.5), (0.8, 0.7), (0.0, 0.7)], stone, seg=12, smooth=False),
        kit.lathe("Rim", [(0.5, 0.68), (0.86, 0.68), (0.86, 0.78), (0.52, 0.78)], light, seg=12, smooth=False),
        kit.torus("RimGold", (0, 0, 0.8), 0.69, 0.04, gold, seg=(36, 5)),
        kit.lathe("Pool", [(0.0, 0.7), (0.5, 0.7)], glow, seg=24),
    ]
    for k in range(12):
        a = k * math.pi / 6 + math.pi / 12
        parts.append(kit.box(f"Hour{k}", (math.cos(a) * 0.9, math.sin(a) * 0.9, 0.305), (0.16, 0.035, 0.02), gold, bevel=0.004, segments=1, rotation=Euler((0, 0, a))))
    for k in range(4):
        a = k * math.pi / 2
        c = (math.cos(a) * 0.86, math.sin(a) * 0.86)
        parts.append(chunk(f"Gnomon{k}", (c[0], c[1], 0.3 + 0.4), (0.22, 0.34, 0.8), stone, rnd, yaw=a, top=0.6, jitter=0.1))
        parts.append(kit.box(f"GnomonCap{k}", (c[0] * 1.0, c[1] * 1.0, 1.12), (0.12, 0.2, 0.06), gold, bevel=0.01, segments=1, rotation=Euler((0, 0, a))))
    # the crown of light
    parts.append(kit.tube("Beam", (0, 0, 0.72), (0, 0, 1.42), [(0, 0.1, 0.1), (0.5, 0.05, 0.05), (1, 0.0, 0.0)], glow, seg=6, smooth=False))
    for k in range(9):
        a = k * 2 * math.pi / 9 + 0.2
        r0, r1 = 0.3, 0.38 + 0.12 * (k % 3)
        h = 1.0 + 0.2 * (k % 3 == 0) + 0.12 * (k % 2)
        parts.append(kit.tube(f"Ray{k}", (math.cos(a) * r0, math.sin(a) * r0, 0.72), (math.cos(a) * r1, math.sin(a) * r1, h),
                              [(0, 0.06, 0.03), (1, 0.0, 0.0)], glow, seg=4, smooth=False))
    return parts


def brazier(P, coll):
    """A sun bowl on a short stand, ~1 m tall: a dark footing and a tapered stem with a gold collar, three stone
    struts, a wide gold dish with a flat rim and a bed of glowing coals."""
    stone, dark, light, gold, glow = P.materials()
    parts = [
        kit.lathe("Foot", [(0.0, 0.0), (0.4, 0.0), (0.4, 0.08), (0.3, 0.16), (0.0, 0.16)], dark, seg=8, smooth=False),
        kit.lathe("Stem", [(0.0, 0.14), (0.2, 0.14), (0.12, 0.34), (0.14, 0.58), (0.0, 0.58)], stone, seg=8, smooth=False),
        kit.torus("Collar", (0, 0, 0.36), 0.14, 0.035, gold, seg=(16, 5)),
        kit.lathe("Dish", [(0.0, 0.5), (0.18, 0.5), (0.34, 0.62), (0.5, 0.84), (0.54, 0.88), (0.5, 0.9), (0.4, 0.84), (0.3, 0.78), (0.0, 0.74)], gold, seg=16, smooth=False),
        kit.lathe("Coals", [(0.0, 0.8), (0.34, 0.8)], glow, seg=14),
    ]
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.5
        parts.append(kit.tube(f"Strut{k}", (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.3), (math.cos(a) * 0.38, math.sin(a) * 0.38, 0.62),
                              [(0, 0.04, 0.04), (1, 0.03, 0.03)], dark, seg=5, smooth=False))
    for k in range(6):
        a = k * math.pi / 3
        parts.append(kit.tube(f"Flame{k}", (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.8), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.98 + 0.06 * (k % 2)),
                              [(0, 0.05, 0.05), (1, 0.0, 0.0)], glow, seg=4, smooth=False))
    return parts


# ---- backdrop ----------------------------------------------------------------------------------------------------

def _pyramid_obelisk(P, base, top, steps, shaft_z0, shaft_z1, h0, h1, cap_z, tip_z, rings, face_z, slits=True):
    stone, dark, light, gold, glow = P.materials()
    slope = math.atan((h0 - h1) / (shaft_z1 - shaft_z0))
    half = lambda z: h0 - (h0 - h1) * (z - shaft_z0) / (shaft_z1 - shaft_z0)  # noqa: E731
    parts = []
    z = 0.0
    for i, (hw, hh) in enumerate(steps):
        parts.append(prism4(f"Step{i}", [(0, z), (hw, z), (hw, z + hh), (0, z + hh)], dark if i % 2 == 0 else stone))
        z += hh
    parts.append(prism4("Shaft", [(0, shaft_z0), (h0, shaft_z0), (h1, shaft_z1), (0, shaft_z1)], light))
    parts.append(prism4("Collar", [(0, shaft_z1 - 0.1), (h1 + 0.12, shaft_z1 - 0.1), (h1 + 0.12, shaft_z1 + 0.15), (0, shaft_z1 + 0.15)], dark))
    parts.append(prism4("Capstone", [(0, shaft_z1 + 0.15), (h1 + 0.05, shaft_z1 + 0.15), (0.06, tip_z - 0.35), (0, tip_z - 0.35)], stone))
    parts.append(prism4("Tip", [(0, tip_z - 0.4), (0.22, tip_z - 0.4), (0.0, tip_z)], gold))
    for zr in rings:
        parts.append(prism4(f"Band{zr}", [(0, zr), (half(zr) + 0.05, zr), (half(zr) + 0.05, zr + 0.12), (0, zr + 0.12)], gold))
    for k in range(4):
        zs = face_z
        r = h1 * 0.55
        for ob in sun_ring(f"Sun{k}", (half(zs) + 0.04, 0, zs), r, gold, glow, axis=(1, 0, 0), rays=12, ray_len=r * 0.5, core=0.55):
            parts.append(turn(ob, k))
        if slits:
            for dx in (-0.28 * h0, 0.28 * h0):
                for zs2, ln in ((shaft_z0 + 1.2, 1.6), (shaft_z0 + 3.6, 1.2)):
                    zc = zs2 + ln / 2
                    parts.append(turn(kit.box(f"Slit{k}{dx}{zs2}", (half(zc) + 0.002, dx, zc), (0.05, 0.07, ln), glow, segments=1, rotation=Euler((0, -slope, 0))), k))
        for dx in (-0.5 * h0, 0.5 * h0):
            zc = face_z - 1.4
            parts.append(turn(kit.box(f"Bar{k}{dx}", (half(zc) + 0.003, dx, zc), (0.06, 0.08, 1.2), gold, bevel=0.008, segments=1, rotation=Euler((0, -slope, 0))), k))
    return parts


def obelisk(P, coll):
    """A tall sun obelisk, ~10 m: three plinth steps, a four-sided shaft tapering from 1.9 m to 1.1 m across with gold
    bands, bars and glowing slits on every face, a great gold sun ring near the top and a pyramid cap with a gold tip."""
    return _pyramid_obelisk(P, 1.3, 0.55, [(1.55, 0.5), (1.3, 0.5)], 1.0, 8.8, 0.95, 0.55, 9.0, 10.0, (3.0, 5.4), 7.6)


def throne(P, coll):
    """The Warden's empty throne, ~9.3 m tall: four stepped tiers with gold edge lines, the seat between two arm blocks
    and a tall crowned back with gold bars, two obelisk pylons at its sides and, floating above the empty seat, a
    stone halo ring with gold inner ring and spikes round a small glowing sun."""
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(8)
    parts = [
        kit.box("Tier1", (0, 0, 0.3), (9.0, 7.0, 0.6), dark, bevel=0.08, segments=2),
        kit.box("Tier2", (0, 0.2, 0.85), (7.6, 5.8, 0.5), stone, bevel=0.08, segments=2),
        kit.box("Tier3", (0, 0.4, 1.35), (6.2, 4.6, 0.5), dark, bevel=0.08, segments=2),
        kit.box("Dais", (0, 0.6, 1.95), (4.6, 3.4, 0.7), stone, bevel=0.07, segments=2),
        kit.box("Edge2", (0, -2.705, 1.0), (5.2, 0.05, 0.07), gold, bevel=0.01, segments=1),
        kit.box("Edge3", (0, -1.905, 1.5), (4.2, 0.05, 0.07), gold, bevel=0.01, segments=1),
        kit.box("Edge4", (0, -1.105, 2.2), (3.2, 0.05, 0.07), gold, bevel=0.01, segments=1),
        kit.box("Seat", (0, 0.9, 2.85), (2.4, 1.9, 1.1), light, bevel=0.06, segments=2),
        kit.box("Cushion", (0, 0.8, 3.46), (2.0, 1.5, 0.14), dark, bevel=0.04, segments=2),
    ]
    for s in (-1, 1):
        parts.append(chunk(f"Arm{s}", (s * 1.5, 0.9, 3.15), (0.7, 2.0, 1.7), stone, rnd, top=0.85, jitter=0.05))
        parts.append(kit.box(f"ArmGold{s}", (s * 1.5, 0.0, 4.0), (0.5, 0.05, 0.06), gold, bevel=0.01, segments=1))
    back = [(-1.5, 2.3), (1.5, 2.3), (1.5, 4.4), (1.2, 4.6), (1.2, 5.3), (0.5, 5.8), (-0.5, 5.8), (-1.2, 5.3), (-1.2, 4.6), (-1.5, 4.4)]
    parts.append(kit.extrude_shape("Back", back, 0.7, stone, bevel=0.05, axis="Y", centre=(0, 1.7, 0)))
    parts.append(kit.extrude_shape("BackFace", [(-1.05, 3.6), (1.05, 3.6), (1.05, 4.8), (0.8, 5.05), (-0.8, 5.05), (-1.05, 4.8)], 0.06, light, bevel=0.015, axis="Y",
                                   centre=(0, 1.34, 0)))
    yb = 1.3
    for x in (-0.8, -0.55, 0.55, 0.8):
        parts.append(kit.box(f"Bar{x}", (x, yb, 4.15), (0.05, 0.04, 0.9), gold, bevel=0.008, segments=1))
    parts.append(kit.tube("ChevL", (-0.5, yb, 4.6), (0.0, yb, 3.95), [(0, 0.04, 0.02), (1, 0.04, 0.02)], gold, seg=4, smooth=False))
    parts.append(kit.tube("ChevR", (0.5, yb, 4.6), (0.0, yb, 3.95), [(0, 0.04, 0.02), (1, 0.04, 0.02)], gold, seg=4, smooth=False))
    # pylons at its sides
    for s in (-1, 1):
        for i, ob in enumerate(_pyramid_obelisk(P, 0.45, 0.3, [(0.7, 0.3)], 0.3, 4.6, 0.5, 0.3, 4.7, 5.4, (2.4,), 3.6, slits=False)):
            ob.data.transform(Matrix.Translation((s * 3.4, 0.8, 1.1)))
            parts.append(ob)
    # the halo over the empty seat
    hc = (0, 2.0, 7.3)
    parts.append(kit.torus("Halo", hc, 1.55, 0.2, light, seg=(36, 6), axis=(0, 1, 0)))
    parts.append(kit.torus("HaloGold", (hc[0], hc[1] - 0.12, hc[2]), 1.34, 0.055, gold, seg=(36, 5), axis=(0, 1, 0)))
    parts.append(kit.blob("Sun", (hc[0], hc[1] - 0.05, hc[2]), (0.5, 0.2, 0.5), glow, segs=(14, 8)))
    for k in range(14):
        a = k * 2 * math.pi / 14
        r0, r1 = 1.7, 2.05 + 0.2 * (k % 2)
        parts.append(kit.tube(f"Spike{k}", (hc[0] + math.cos(a) * r0, hc[1], hc[2] + math.sin(a) * r0),
                              (hc[0] + math.cos(a) * r1, hc[1], hc[2] + math.sin(a) * r1), [(0, 0.1, 0.07), (1, 0.0, 0.0)], gold, seg=4, smooth=False))
    for k in range(7):
        # dark notches round the ring
        a = (k + 0.5) * 2 * math.pi / 7
        parts.append(kit.box(f"Notch{k}", (hc[0] + math.cos(a) * 1.55, hc[1] - 0.14, hc[2] + math.sin(a) * 1.55), (0.22, 0.1, 0.22), dark, bevel=0.01, segments=1,
                             rotation=Euler((0, -a, 0))))
    return parts


def arch(P, coll):
    """A broken sun arch, ~8 m: two legs on stepped feet, a half ring of carved voussoirs rising from the left leg and
    over the top with a gold inlay line and a gold sun at its crown, broken off before the right leg (which is also
    snapped short), the missing blocks lying at the foot."""
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(21)
    R, zc = 2.9, 4.6
    parts = []
    for s, top in ((-1, 4.6), (1, 3.2)):
        x = s * R
        parts.append(kit.box(f"Foot{s}", (x, 0, 0.25), (2.0, 1.6, 0.5), dark, bevel=0.05, segments=2))
        parts.append(kit.box(f"Foot2{s}", (x, 0, 0.6), (1.5, 1.2, 0.3), stone, bevel=0.04, segments=2))
        if s == -1:
            parts.append(kit.box(f"Leg{s}", (x, 0, (0.75 + top) / 2), (1.1, 1.0, top - 0.75), light, bevel=0.04, segments=2))
        else:
            parts.append(chunk(f"Leg{s}", (x, 0, (0.75 + top) / 2), (1.1, 1.0, top - 0.75), light, rnd, jitter=0.05))
            parts.append(chunk("Snap", (x, 0.05, top + 0.1), (0.9, 0.8, 0.5), light, rnd, yaw=0.4, top=0.5))
        parts.append(kit.box(f"LegGold{s}", (x, -0.505, 1.9), (0.07, 0.03, 1.2), gold, bevel=0.008, segments=1))
    n = 18
    for i in range(n + 1):
        th = math.pi - i * (math.pi - 0.62) / n
        pos = (R * math.cos(th), 0, zc + R * math.sin(th))
        ln = R * (math.pi - 0.62) / n * 1.02
        rot = Euler((0, math.pi / 2 - th, 0))
        parts.append(kit.box(f"V{i}", pos, (ln, 1.0, 0.9), (light, stone)[i % 2], bevel=0.035, segments=1, rotation=rot))
        # gold inlay along the inner face, on every other block
        if i % 2 == 0:
            pin = (pos[0] * (R - 0.46) / R, -0.51, zc + (pos[2] - zc) * (R - 0.46) / R)
            parts.append(kit.box(f"Inlay{i}", pin, (ln * 0.7, 0.03, 0.06), gold, segments=1, rotation=rot))
    ktop = (0, -0.52, zc + R + 0.0)
    for ob in sun_ring("Crown", ktop, 0.3, gold, glow, axis=(0, 1, 0), rays=10, ray_len=0.16, core=0.55):
        parts.append(ob)
    # the blocks that fell
    for k, (x, y, yaw) in enumerate(((1.9, -1.3, 0.4), (2.7, -1.9, 1.7), (0.9, -2.0, 2.4))):
        parts.append(chunk(f"Fall{k}", (x, y, 0.4), (1.0, 0.9, 0.8), (light, stone, light)[k], rnd, yaw=yaw, tilt=(0.15, 0.1)))
    return parts


def _rock(P, r, h, seed, gold_bit=True):
    stone, dark, light, gold, glow = P.materials()
    rnd = random.Random(seed)
    pts = []
    n = 9
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.4
        pts.append((math.cos(a) * r * (0.72 + rnd.random() * 0.26), math.sin(a) * r * (0.72 + rnd.random() * 0.26), h))
        a2 = a + 0.3
        pts.append((math.cos(a2) * r * (0.95 + rnd.random() * 0.2), math.sin(a2) * r * (0.95 + rnd.random() * 0.2), h * 0.68))
    for k in range(6):
        a = k * 2 * math.pi / 6 + rnd.random()
        pts.append((math.cos(a) * r * (0.45 + rnd.random() * 0.2), math.sin(a) * r * (0.45 + rnd.random() * 0.2), h * 0.3))
    pts.append(((rnd.random() - 0.5) * r * 0.3, (rnd.random() - 0.5) * r * 0.3, 0.0))
    pts.append(((rnd.random() - 0.5) * r * 0.2, (rnd.random() - 0.5) * r * 0.2, h * 0.06))
    parts = [hull("Rock", pts, stone)]
    if gold_bit:
        a = rnd.random() * 6
        parts.append(chunk("Inlay", (math.cos(a) * r * 0.45, math.sin(a) * r * 0.45, h + 0.01), (r * 0.7, r * 0.1, 0.05), gold, rnd, yaw=a + 1.57, jitter=0.0))
        parts.append(chunk("Inlay2", (-math.cos(a) * r * 0.3, -math.sin(a) * r * 0.3, h + 0.01), (r * 0.4, r * 0.08, 0.05), gold, rnd, yaw=a + 0.5, jitter=0.0))
        parts.append(kit.blob("Spark", (math.cos(a + 2.4) * r * 0.2, math.sin(a + 2.4) * r * 0.2, h), (r * 0.12, r * 0.12, r * 0.06), glow, segs=(8, 5)))
    return parts


def float_rock_a(P, coll):
    """A big drifting stone, ~2 m wide: a flat faceted top, bulging flanks, a tapering underside, gold inlay bars."""
    return _rock(P, 1.0, 1.4, 4)


def float_rock_b(P, coll):
    """A mid stone, ~1.3 m."""
    return _rock(P, 0.65, 0.95, 9)


def float_rock_c(P, coll):
    """A small stone, ~0.7 m."""
    return _rock(P, 0.35, 0.55, 15)


#: name: (builder, height used for the paint's height gradient, AO distance)
PROPS = {
    "Wall": (lambda P, c: wall(P, c, "whole"), 2.3, 0.25),
    "WallCracked": (lambda P, c: wall(P, c, "cracked"), 2.3, 0.25),
    "WallRubble": (wall_rubble, 0.6, 0.2),
    "Column": (column, 4.2, 0.25),
    "Altar": (altar, 1.4, 0.2),
    "Brazier": (brazier, 1.0, 0.15),
    "Throne": (throne, 9.3, 0.7),
    "Obelisk": (obelisk, 10.0, 0.7),
    "Arch": (arch, 8.0, 0.6),
    "FloatRockA": (float_rock_a, 1.4, 0.3),
    "FloatRockB": (float_rock_b, 0.95, 0.25),
    "FloatRockC": (float_rock_c, 0.55, 0.15),
}
COVER = ("Wall", "WallCracked", "WallRubble", "Column", "Altar", "Brazier")
BACKDROP = ("Throne", "Obelisk", "Arch", "FloatRockA", "FloatRockB", "FloatRockC")
COLL = "Sanctum "
PREFIX = "sanctum_props_"

#: Normals sharper than this stay faceted.
SHARP = {"stone": 30, "dark": 30, "light": 30, "gold": 28, "glow": 40}


def _tidy(ob, sharp):
    """Welds seams and dissolves flat areas: fewer triangles, no seam lines."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.6), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(sharp))


def _merge(name, parts, prefix=PREFIX, sharp=SHARP):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace(prefix, "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob, sharp.get(short, 40))
        out.append(ob)
    return out


def build(only=None):
    """Builds the props (all, or the names in `only`) into collections "Sanctum <name>" (emptied first)."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    P = Props()
    colls = []
    for name, (fn, height, ao) in PROPS.items():
        if only and name not in only:
            continue
        coll = kit.collection(COLL + name)
        _merge(name, fn(P, coll))
        sculpt.paint(coll, height=height, ao_dist=ao)
        colls.append(coll)
    return colls


def export():
    colls = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    return _export(colls, OUT)


def _export(colls, out):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        out, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    info = {}
    for c in colls:
        st = kit.stats(c)
        info[c.name] = {"tris": st["triangles"], "size_xyz_blender": [round(st["max"][i] - st["min"][i], 2) for i in range(3)],
                        "min": st["min"], "max": st["max"], "parts": [o.name for o in c.objects]}
    return {"props": info, "kb": round(os.path.getsize(out) / 1024), "path": out}


def clear():
    """Deletes the prop collections and the sheet's helpers (after exporting: keep the shared scene light)."""
    for name in [c.name for c in bpy.data.collections if c.name.startswith(("Sanctum ", "Den ", "SheetHelp"))]:
        kit.clear(name)
        if name in bpy.data.collections:
            bpy.data.collections.remove(bpy.data.collections[name])
    for ob in [o for o in bpy.data.objects if o.name.startswith("Sheet")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    kit.purge()


# ---- review sheets -----------------------------------------------------------------------------------------------

def _hero(x, y, mat):
    """A 1.8 m reference figure (legs, body, arms, head) at (x, y), in a plain mid blue-grey."""
    parts = []
    for dx in (-0.1, 0.1):
        parts.append(kit.box("SheetLeg", (x + dx, y, 0.45), (0.16, 0.2, 0.9), mat, segments=1))
    parts.append(kit.box("SheetBody", (x, y, 1.2), (0.46, 0.26, 0.6), mat, segments=1))
    for dx in (-0.3, 0.3):
        parts.append(kit.box("SheetArm", (x + dx, y, 1.2), (0.12, 0.16, 0.6), mat, segments=1))
    parts.append(kit.blob("SheetHead", (x, y, 1.62), (0.12, 0.13, 0.16), mat, segs=(12, 8)))
    return parts


def _label(text, x, y, size, mat):
    cu = bpy.data.curves.new("SheetText", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    ob = bpy.data.objects.new("SheetText", cu)
    ob.location = (x, y, 0.0)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.data.materials.append(mat)
    ob.visible_shadow = False
    bpy.context.scene.collection.objects.link(ob)
    return ob


def render_sheet(groups, path, prefix_coll=COLL):
    """Renders each group of props in a row from the game's camera (55 degrees down, 22 m for the cover row, farther for
    the backdrop) and from the front, each with a 1.8 m figure beside the prop, and stacks the pictures into one jpg.
    groups: [(title, [prop names], camera distance, label size)]."""
    import numpy as np
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.045, 0.04, 0.07, 1)
    bg.inputs["Strength"].default_value = 1.0
    hide = [o for o in bpy.data.objects if o.type in ("LIGHT", "CAMERA") and not o.name.startswith("Sheet")]
    for o in hide:
        o.hide_render = True
    hc = kit.collection("SheetHelp")
    gmat = kit.material("sheet_ground", "#2a2630", roughness=0.9)
    hmat = kit.material("sheet_hero", "#7f9ab8", roughness=0.7)
    tmat = kit.material("sheet_text", "#d8d0c0", emission="#d8d0c0", strength=1.0)
    lmat = kit.material("sheet_line", "#8a8a90", emission="#8a8a90", strength=0.6)
    shots = []
    for title, names, dist, tsize in groups:
        # lay the props out in a row, left to right, gaps of 1.4 m
        for c in bpy.data.collections:
            if c.name.startswith(prefix_coll):
                for o in c.objects:
                    o.hide_render = c.name[len(prefix_coll):] not in names
        x = 0.0
        cells = []
        for nm in names:
            c = bpy.data.collections[prefix_coll + nm]
            lo = Vector((1e9, 1e9, 1e9))
            hi = Vector((-1e9, -1e9, -1e9))
            for o in c.objects:
                for v in o.bound_box:
                    w = o.matrix_world @ Vector(v)
                    lo = Vector(map(min, lo, w))
                    hi = Vector(map(max, hi, w))
            w = hi.x - lo.x
            cells.append((nm, c, x - lo.x, w, hi.z, x))
            x += w + (1.4 if tsize < 0.8 else 4.0)
        total = x
        for nm, c, ox, w, _, _x in cells:
            for o in c.objects:
                o.location.x = ox
        # ground and labels
        gp = kit.box("SheetGround", (total / 2 - 0.7, 0, -0.1), (total + 40, 120, 0.2), gmat, segments=1)
        heroes = []
        for nm, c, ox, w, hz, xl in cells:
            _label(nm, xl + w / 2, -2.2 if tsize < 0.8 else -4.0, min(tsize, max(0.2, w / (len(nm) * 0.62))), tmat)
            hs = 0.9 if tsize < 0.8 else 2.0
            heroes += _hero(xl + w + 0.5 if tsize < 0.8 else xl - 1.0, -1.0, hmat)
        # lights
        sun = bpy.data.objects.new("SheetSun", bpy.data.lights.new("SheetSun", "SUN"))
        sun.data.energy = 2.6
        sun.data.color = (1.0, 0.92, 0.82)
        sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
        bpy.context.scene.collection.objects.link(sun)
        fill = bpy.data.objects.new("SheetFill", bpy.data.lights.new("SheetFill", "SUN"))
        fill.data.energy = 0.9
        fill.data.color = (0.7, 0.75, 1.0)
        fill.rotation_euler = (math.radians(60), 0, math.radians(150))
        bpy.context.scene.collection.objects.link(fill)
        span = total + 2.0
        maxh = max(cl[4] for cl in cells)
        cx = total / 2 - 0.7
        cam = bpy.data.objects.new("SheetCam", bpy.data.cameras.new("SheetCam"))
        bpy.context.scene.collection.objects.link(cam)
        sc.camera = cam
        res_x = 2000
        sc.render.resolution_x = res_x
        for view in ("game", "front"):
            if view == "game":
                tz = maxh * 0.3
                cam.location = (cx, -dist * math.cos(math.radians(55)), tz + dist * math.sin(math.radians(55)))
                cam.rotation_euler = (math.radians(35), 0, 0)
                vh = span * 0.34
            else:
                cam.location = (cx, -dist, maxh * 0.45)
                cam.rotation_euler = (math.radians(90), 0, 0)
                vh = max(maxh * 1.25, span * 0.2)
            sc.render.resolution_y = int(res_x * (vh / span)) if view == "front" else int(res_x * 0.34)
            cam.data.sensor_fit = "HORIZONTAL"
            cam.data.sensor_width = 36
            cam.data.lens = 36 * dist / (span * 1.04)
            cam.data.clip_end = 400
            tmp = os.path.join(os.environ.get("TEMP", "."), f"sheet_{len(shots)}.png")
            sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(tmp)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
            bpy.data.images.remove(img)
            shots.append(px)
        for o in [sun, fill, cam, gp] + heroes:
            bpy.data.objects.remove(o, do_unlink=True)
        for o in [o for o in bpy.data.objects if o.name.startswith("SheetText")]:
            bpy.data.objects.remove(o, do_unlink=True)
        for nm, c, ox, w, hz, xl in cells:
            for o in c.objects:
                o.location.x = 0.0
    width = max(s.shape[1] for s in shots)
    rows = []
    for s in shots:
        rows.append(s)
        rows.append(np.full((6, width, 4), 0.02, dtype=np.float32))
    sheet = np.concatenate(rows[::-1], axis=0)  # bottom-up image: the last picture goes first
    out = bpy.data.images.new("SheetOut", sheet.shape[1], sheet.shape[0])
    out.pixels = sheet.ravel().tolist()
    out.filepath_raw = path
    out.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    out.save()
    bpy.data.images.remove(out)
    for o in hide:
        o.hide_render = False
    for c in bpy.data.collections:
        if c.name.startswith(prefix_coll):
            for o in c.objects:
                o.hide_render = False
    return path


def sheet(path=SHEET):
    missing = [n for n in COVER + BACKDROP if not (bpy.data.collections.get(COLL + n) and bpy.data.collections[COLL + n].objects)]
    if missing:
        build(missing)
    return render_sheet([("cover", COVER, 22.0, 0.5), ("backdrop", BACKDROP, 60.0, 1.2)], path)
