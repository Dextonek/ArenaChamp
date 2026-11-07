"""
Ash and Ember's den props (the Raid's Cinder Pit room, see pipeline/designs/raid-noonfall.md "The lairs"): the crater
the sun fell into, where it still burns under the floor. Not the caldera duel arena's basalt and ridges: black glass
spires with ember cracks, walls of cooled slag with drips and hot seams, anvil stones with live coals, a perch with an
iron arm and a hanging lantern for Ember, and for the backdrop a huge fallen sun shard half sunk in the slag, the ribs
of something that burned, a post with two lanterns and crater rock. Each prop is built in its own collection at the
origin (its base centre, front toward -Y), painted (blender/heroes/sculpt.py) and exported together to
public/models/arenas/den_props.glb as objects named "<Prop>__<material>" (materials: obsidian, slag, basalt, iron,
gold, glow), like caldera_props.glb. Shared helpers (hulls, chunks, the sheet renderer, the export) come from
sanctum_props.py and caldera_props.py.

Sizes are the game's collision shapes: Spire r 0.9 and 3.3 m tall, Ridge 4.22 m long (x) and 0.8 m deep and ~2.1 m
tall, Stump r 0.8 and 1.27 m tall, Perch ~3 m across with its top flat at 0.7 m.

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import den_props; importlib.reload(den_props)
    den_props.export()        # builds everything, writes the GLB, returns triangles per prop
    den_props.sheet()         # the review sheet, docs/arenas/den_props_sheet.jpg (EEVEE)
    den_props.clear()

Blender coordinates: metres, z up. In three.js (y up) the model's -Y becomes +Z.
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
from mathutils.bvhtree import BVHTree  # noqa: E402

import caldera_props as cp  # noqa: E402
import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sanctum_props as sp  # noqa: E402
import sculpt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "models", "arenas", "den_props.glb")
SHEET = os.path.join(ROOT, "docs", "arenas", "den_props_sheet.jpg")

OBSIDIAN = "#1d1622"
SLAG = "#3b2b25"
BASALT = "#4f433c"
IRON = "#4a4a52"
GOLD = "#b98532"
GLOW = "#ff9440"


class DenProps(sp.Props):
    def __init__(self):
        super().__init__("den_props")

    def materials(self):
        return (self.mat("obsidian", OBSIDIAN, roughness=0.14, metallic=0.1, coat=0.6),
                self.mat("slag", SLAG, roughness=0.95), self.mat("basalt", BASALT, roughness=0.88),
                self.mat("iron", IRON, metallic=0.6, roughness=0.5), self.mat("gold", GOLD, metallic=0.6, roughness=0.45),
                self.mat("glow", GLOW, emission="#ff5a14", strength=3.0))


# ---- shape helpers -----------------------------------------------------------------------------------------------

def _mound(name, mat, rnd, blobs, voxel, target, chisel, keep=0.0, squash=(1.0, 1.0), amp=0.05, scale=2.2):
    """Cooled slag: blobs (centre, radii) melted into one lumpy mass, cut at the floor, roughened and chiselled."""
    parts = [kit.blob(f"{name}{i}", c, r, mat, segs=(18, 10)) for i, (c, r) in enumerate(blobs)]
    ob = sculpt.fuse(parts, name, voxel=voxel, smooth=8, target=target)
    cp._cut_below(ob)
    cp._rough(ob, amp, scale, rnd.random() * 10, up=0.6)
    cp._chisel(ob, rnd, chisel, keep=keep, squash=squash)
    return ob


def _seams(name, ob, glow, rnd, starts, r=0.03, steps=5, step=0.22):
    """Hot seams running down a surface seen from the front or the back: from (x, z, side) a ray along y finds the
    face, the seam steps down with a jitter, each point sunk half into the face, tapered ends."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    out = []
    for i, (x, z, side) in enumerate(starts):
        pts = []
        for _ in range(steps):
            loc, nrm, _, _ = tree.ray_cast(Vector((x, -side * 40.0, z)), Vector((0, side, 0)))
            if loc is None or loc.z < 0.08:
                break
            pts.append(loc - nrm * r * 0.3)
            z -= step * (0.6 + rnd.random() * 0.8)
            x += (rnd.random() - 0.5) * step * 1.4
        if len(pts) < 3:
            continue
        radii = [r * (0.35 if k in (0, len(pts) - 1) else 0.8 + rnd.random() * 0.4) for k in range(len(pts))]
        out.append(kit.chain(f"{name}{i}", pts, radii, glow, seg=5, smooth=False))
    return out


def _jag(ob, rnd, amp, n=10):
    """Uneven sides on a lathe: each of the n sides at its own radius (the top stays flat)."""
    fac = [1 - amp * rnd.random() for _ in range(n)]
    for v in ob.data.vertices:
        if v.co.xy.length > 1e-4:
            k = round(math.atan2(v.co.y, v.co.x) / (2 * math.pi / n)) % n
            v.co.x *= fac[k]
            v.co.y *= fac[k]


def _lantern(P, cx, cy, ztop, s=1.0):
    """A hanging iron lantern with a glowing core: cap, four posts, base; `s` scales it. Hangs from `ztop`."""
    obs, slag, bas, iron, gold, glow = P.materials()
    h, w = 0.55 * s, 0.13 * s
    zb = ztop - 0.12 * s - h
    parts = [
        sp.hull("LCap", [(cx + dx * 0.17 * s, cy + dy * 0.17 * s, ztop - 0.12 * s) for dx in (-1, 1) for dy in (-1, 1)] + [(cx, cy, ztop)], iron),
        sp.hull("LBase", [(cx + dx * 0.15 * s, cy + dy * 0.15 * s, zb + 0.06 * s) for dx in (-1, 1) for dy in (-1, 1)]
                + [(cx + dx * 0.07 * s, cy + dy * 0.07 * s, zb - 0.04 * s) for dx in (-1, 1) for dy in (-1, 1)], iron),
        kit.blob("LCore", (cx, cy, zb + h * 0.55), (0.1 * s, 0.1 * s, 0.17 * s), glow, segs=(10, 8)),
    ]
    for dx in (-1, 1):
        for dy in (-1, 1):
            parts.append(kit.tube("LPost", (cx + dx * w, cy + dy * w, zb + 0.06 * s), (cx + dx * w, cy + dy * w, ztop - 0.12 * s),
                                  [(0, 0.016 * s, 0.016 * s), (1, 0.016 * s, 0.016 * s)], iron, seg=4, smooth=False))
    parts.append(kit.torus("LRing", (cx, cy, ztop + 0.04 * s), 0.05 * s, 0.014 * s, iron, seg=(10, 4)))
    return parts


# ---- cover -------------------------------------------------------------------------------------------------------

def spire(P, coll):
    """An obsidian spire cluster covering r 0.9, 3.3 m tall: one tall black glass spire among six shorter ones and a
    ring of small shards, standing in a low mound of cooled slag, with ember cracks glowing in the slag and between
    the shards."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(31)
    blobs = [((0, 0, 0), (0.78, 0.78, 0.28))]
    for k in range(6):
        a = k * math.pi / 3 + rnd.random() * 0.4
        blobs.append(((math.cos(a) * 0.55, math.sin(a) * 0.55, 0), (0.34, 0.3, 0.16 + rnd.random() * 0.1)))
    mound = _mound("SpireSlag", slag, rnd, blobs, 0.035, 600, 8, keep=0.65)
    parts = [mound, cp._shard("Main", (0, 0, 0), 0.6, 0.46, 3.3, 0.8, 0.05, obs, rnd, n=8)]
    for k in range(6):
        a = k * math.pi / 3 + 0.25 + rnd.random() * 0.3
        r = 0.4 + rnd.random() * 0.12
        h = 1.4 + (k % 3) * 0.45 + rnd.random() * 0.3
        parts.append(cp._shard(f"Spire{k}", (math.cos(a) * r, math.sin(a) * r, 0.0), 0.34 + rnd.random() * 0.1, 0.28, h, a, 0.12 + rnd.random() * 0.1,
                               obs, rnd, n=7))
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.9 + rnd.random() * 0.4
        parts.append(cp._shard(f"Shard{k}", (math.cos(a) * 0.68, math.sin(a) * 0.68, 0.04), 0.2 + rnd.random() * 0.06, 0.17, 0.5 + rnd.random() * 0.4, a,
                               0.35 + rnd.random() * 0.25, obs, rnd, n=6))
    starts = [(math.cos(a) * 0.55, math.sin(a) * 0.55, a + (rnd.random() - 0.5) * 0.5) for a in (k * 2 * math.pi / 6 + 0.5 for k in range(6))]
    parts += cp._cracks("SpireCrack", mound, glow, rnd, starts, r=0.03, steps=5, step=0.12)
    for k in range(5):
        # ember light between the shards, low in the cluster
        a = k * 2 * math.pi / 5 + 0.3
        parts.append(kit.tube(f"Ember{k}", (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.1), (math.cos(a) * 0.26, math.sin(a) * 0.26, 0.45 + 0.1 * (k % 3)),
                              [(0, 0.045, 0.03), (1, 0.0, 0.0)], glow, seg=4, smooth=False))
    return parts


def ridge(P, coll, L=4.22):
    """A slag wall `L` long (x), 0.8 m deep and ~2.1 m tall: cooled lava piled into a tall crusted wall, broken slag plates
    along its crest, drips running down both faces (some ending in a glowing bead) and hot seams between the plates."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(12)
    half = L / 2
    blobs = []
    n = 8
    for k in range(n):
        x = -half + 0.35 + (L - 0.7) * k / (n - 1)
        end = k in (0, n - 1)
        blobs.append(((x, (rnd.random() - 0.5) * 0.15, 0.0), (0.58, 0.36 + rnd.random() * 0.06, (1.05 if end else 1.35 + rnd.random() * 0.6))))
    for k in range(5):
        side = 1 if k % 2 else -1
        blobs.append(((-half + 0.6 + (L - 1.2) * k / 4, side * 0.33, 0.0), (0.5, 0.2, 0.55 + rnd.random() * 0.25)))
    wall = _mound("RidgeSlag", slag, rnd, blobs, 0.05, 2400, 16, keep=0.28, squash=(half / 0.4, 1.0), amp=0.05)
    parts = [wall]
    bm = bmesh.new()
    bm.from_mesh(wall.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    for k in range(5):
        x = -half + 0.6 + (L - 1.2) * (k + rnd.random() * 0.5) / 4.5
        loc, nrm, _, _ = tree.ray_cast(Vector((x, 0, 4)), Vector((0, 0, -1)))
        zt = loc.z if loc else 1.8
        parts.append(sp.chunk(f"Plate{k}", (x, (rnd.random() - 0.5) * 0.2, zt + 0.1), (0.7 + rnd.random() * 0.3, 0.4, 0.45 + rnd.random() * 0.2), bas, rnd,
                              yaw=(rnd.random() - 0.5) * 0.4, tilt=((rnd.random() - 0.5) * 0.3, (rnd.random() - 0.5) * 0.3), top=0.7))
    for k in range(12):
        side = 1 if k % 2 else -1
        x = -half + 0.4 + (L - 0.8) * (k + rnd.random() * 0.7) / 12
        z = 0.75 + rnd.random() * 0.55
        loc, nrm, _, _ = tree.ray_cast(Vector((x, -side * 5, z)), Vector((0, side, 0)))
        if loc is None:
            continue
        ln = 0.35 + rnd.random() * 0.5
        r = 0.07 + rnd.random() * 0.04
        parts.append(kit.tube(f"Drip{k}", tuple(loc + nrm * 0.0), tuple(loc + nrm * 0.1 + Vector((0, 0, -ln))), [(0, r * 1.6, r * 1.6), (0.7, r, r), (1, r * 1.2, r * 1.2)],
                              slag, seg=5, smooth=False))
        if k % 2 == 0:
            parts.append(kit.blob(f"Bead{k}", tuple(loc + nrm * 0.1 + Vector((0, 0, -ln - 0.02))), (r * 1.3, r * 1.3, r * 1.6), glow, segs=(8, 6)))
    starts = [(-half + 0.5 + (L - 1.0) * (k + rnd.random() * 0.6) / 14, 1.0 + rnd.random() * 0.35, 1 if k % 2 else -1) for k in range(14)]
    parts += _seams("RidgeSeam", wall, glow, rnd, starts, r=0.04, steps=6, step=0.22)
    return parts


def stump(P, coll):
    """An anvil stone covering r 0.8, 1.27 m tall: a broad foot, a waist, a flat-topped body with a horn, a black glass
    face plate and a bed of live coals on top, in a skirt of slag."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(14)
    parts = [
        sp.chunk("Foot", (0, 0, 0.2), (1.25, 0.9, 0.4), bas, rnd, top=0.85, jitter=0.1),
        sp.chunk("Waist", (0.0, 0.0, 0.63), (0.72, 0.52, 0.5), bas, rnd, jitter=0.08),
    ]
    top = [(x, y, z) for x in (-0.62, 0.5) for y in (-0.3, 0.3) for z in (0.85, 1.1)] + [(0.78, 0.0, 1.0), (0.6, 0.1, 0.9), (0.6, -0.1, 0.9)]
    parts.append(sp.hull("Body", top, bas))
    parts.append(sp.hull("Face", [(x, y, z) for x in (-0.58, 0.48) for y in (-0.26, 0.26) for z in (1.09, 1.14)], obs))
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.3
        parts.append(kit.blob(f"Skirt{k}", (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.02), (0.3, 0.22, 0.14), slag, segs=(10, 6), rotation=Euler((0, 0, a))))
    for k, (x, y, r) in enumerate(((-0.4, 0.05, 0.13), (-0.15, -0.1, 0.16), (0.1, 0.12, 0.14), (0.3, -0.05, 0.12), (-0.05, 0.05, 0.1), (0.38, 0.14, 0.08),
                                   (-0.5, -0.12, 0.08))):
        parts.append(kit.blob(f"Coal{k}", (x, y, 1.16 + r * 0.45), (r * 1.1, r, r * 0.8), glow, segs=(8, 6)))
    for k, (x, y) in enumerate(((-0.28, 0.12), (0.0, -0.12), (0.2, 0.06), (0.4, -0.12))):
        parts.append(sp.chunk(f"Ash{k}", (x, y, 1.19), (0.14, 0.12, 0.1), slag, rnd, yaw=rnd.random() * 3, jitter=0.2))
    return parts


def perch(P, coll):
    """Where the boss on the rim waits: a plinth ~3 m across of tiered slag and basalt, its top flat at 0.7 m, a glowing
    ring inlaid in the top, black glass shards at the rim, and at the back an iron post with a hooked arm holding a
    hanging lantern for Ember."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(23)
    low = kit.lathe("Low", [(0.0, 0.0), (1.55, 0.0), (1.48, 0.35), (0.0, 0.35)], slag, seg=10, smooth=False)
    up = kit.lathe("Up", [(0.0, 0.35), (1.38, 0.35), (1.32, 0.7), (0.0, 0.7)], bas, seg=10, smooth=False)
    _jag(low, rnd, 0.12)
    _jag(up, rnd, 0.1)
    parts = [low, up, kit.torus("Ring", (0, 0, 0.705), 0.95, 0.022, glow, seg=(40, 4))]
    for k in range(3):
        a = 2.4 + k * 0.9
        parts.append(cp._shard(f"Rim{k}", (math.cos(a) * 1.25, math.sin(a) * 1.25, 0.65), 0.3, 0.24, 0.55 + 0.2 * k, a, 0.25, obs, rnd, n=6))
    for k in range(6):
        a = k * math.pi / 3 + 0.2
        parts.append(sp.chunk(f"Foot{k}", (math.cos(a) * 1.55, math.sin(a) * 1.55, 0.1), (0.5, 0.4, 0.22), slag, rnd, yaw=a, jitter=0.2))
    px, py = -1.05, 0.8
    parts.append(kit.tube("Post", (px, py, 0.4), (px, py, 2.95), [(0, 0.14, 0.14), (0.5, 0.1, 0.1), (1, 0.08, 0.08)], iron, seg=6, smooth=False))
    parts.append(kit.box("PostFoot", (px, py, 0.62), (0.4, 0.4, 0.14), iron, bevel=0.02, segments=1))
    parts.append(kit.chain("Arm", [(px, py, 2.9), (px + 0.12, py - 0.03, 3.18), (px + 0.45, py - 0.12, 3.26), (px + 0.78, py - 0.2, 3.12), (px + 0.84, py - 0.22, 2.88)],
                           [0.075, 0.065, 0.055, 0.05, 0.035], iron, seg=6, smooth=False))
    lx, ly = px + 0.84, py - 0.22
    parts.append(kit.tube("Chain", (lx, ly, 2.9), (lx, ly, 2.62), [(0, 0.02, 0.02), (1, 0.02, 0.02)], iron, seg=4, smooth=False))
    parts += _lantern(P, lx, ly, 2.62, 1.2)
    return parts


# ---- backdrop ----------------------------------------------------------------------------------------------------

def sun_shard(P, coll):
    """A huge gold fragment of the fallen sun, ~12 m, half sunk: one tall faceted shard leaning over two lesser ones, in
    a heaped skirt of cooled slag with hot seams in the slag and veins of light down the shard's face."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(40)
    blobs = [((0, 0, 0), (4.6, 3.6, 1.6))]
    for k in range(8):
        a = k * math.pi / 4 + rnd.random() * 0.4
        blobs.append(((math.cos(a) * 3.6, math.sin(a) * 2.9, 0), (1.9 + rnd.random() * 0.8, 1.5, 0.8 + rnd.random() * 0.6)))
    mound = _mound("ShardSlag", slag, rnd, blobs, 0.14, 1800, 16, keep=3.0, amp=0.25, scale=0.6)
    main = cp._shard("Main", (0.3, 0.3, 0.2), 5.2, 3.4, 12.0, 0.4, 0.12, gold, rnd, n=9, blunt=0.0)
    parts = [mound, main,
             cp._shard("SideA", (-3.2, -0.6, 0.2), 3.0, 2.4, 7.0, 3.6, 0.28, gold, rnd, n=8),
             cp._shard("SideB", (3.3, -1.2, 0.2), 2.2, 1.8, 4.6, -0.4, 0.3, gold, rnd, n=7)]
    starts = [(x, z, -1) for x, z in ((-1.0, 8.5), (0.4, 9.5), (1.4, 7.5), (-0.5, 6.0), (0.9, 5.0))]
    parts += _seams("Vein", main, glow, rnd, starts, r=0.09, steps=7, step=0.9)
    starts = [(math.cos(a) * 4.2, math.sin(a) * 3.4, a + 0.4) for a in (k * 2 * math.pi / 7 + 0.3 for k in range(7))]
    parts += cp._cracks("SlagCrack", mound, glow, rnd, starts, r=0.12, steps=6, step=0.5)
    return parts


def ribs(P, coll):
    """The ribs of something huge that burned: seven charred ribs in an arc, each rising from the slag and curving
    inward to ~8 m, thick at the root, with knuckled joints, two broken short, rooted in lumps of slag with ember cracks."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(52)
    parts = []
    n = 8
    for i in range(n):
        th = math.radians(22 + 136 * i / (n - 1))
        R0 = 5.0 + 0.4 * math.sin(i * 1.7)
        top = (8.0, 8.4, 7.6, 8.0, 5.2, 7.8, 4.4)[i] if False else (7.2, 8.0, 7.6, 8.2, 5.0, 7.8, 6.6, 7.0)[i]
        pts, radii = [], []
        m = 12
        for j in range(m + 1):
            t = j / m
            r = R0 + 1.1 * math.sin(math.pi * t * 0.8) - 4.0 * t * t
            z = top * t ** 0.8
            pts.append((math.cos(th) * r, math.sin(th) * r, z))
            radii.append(0.3 * (1 - t) ** 0.8 + 0.06 + (0.05 if j % 4 == 0 else 0.0))
        parts.append(kit.chain(f"Rib{i}", pts, radii, bas, seg=6, smooth=False))
        a = th
        parts.append(sp.chunk(f"Root{i}", (math.cos(a) * R0, math.sin(a) * R0, 0.35), (1.6, 1.3, 0.8), slag, rnd, yaw=a, jitter=0.25))
        if i in (1, 3, 6):
            ep = [(p[0] * 0.995, p[1] * 0.995, p[2]) for p in pts[1:6]]
            parts.append(kit.chain(f"Ember{i}", [(p[0], p[1] - 0.02, p[2]) for p in ep], [0.05] * 5, glow, seg=4, smooth=False))
    return parts


def lantern_post(P, coll):
    """An iron post ~6 m with a cross-arm and two hanging lanterns whose cores glow: a heavy slag foot, a tapering
    six-sided post with collars, a spike finial, chains and big iron lanterns at the arm ends."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(61)
    parts = [sp.chunk("Foot", (0, 0, 0.35), (1.6, 1.4, 0.7), slag, rnd, top=0.8, jitter=0.12),
             kit.tube("Post", (0, 0, 0.5), (0, 0, 5.7), [(0, 0.24, 0.24), (0.5, 0.15, 0.15), (1, 0.1, 0.1)], iron, seg=6, smooth=False),
             kit.tube("Finial", (0, 0, 5.65), (0, 0, 6.25), [(0, 0.11, 0.11), (1, 0.0, 0.0)], iron, seg=6, smooth=False),
             kit.tube("Arm", (-1.5, 0, 5.2), (1.5, 0, 5.2), [(0, 0.06, 0.06), (0.5, 0.1, 0.1), (1, 0.06, 0.06)], iron, seg=6, smooth=False)]
    for z in (1.5, 3.3):
        parts.append(kit.torus(f"Collar{z}", (0, 0, z), 0.2 - 0.02 * z, 0.05, iron, seg=(12, 4)))
    for s in (-1, 1):
        x = s * 1.4
        parts.append(kit.tube(f"Chain{s}", (x, 0, 5.2), (x, 0, 4.72), [(0, 0.025, 0.025), (1, 0.025, 0.025)], iron, seg=4, smooth=False))
        parts += _lantern(P, x, 0, 4.72, 1.7)
        parts.append(kit.chain(f"Curl{s}", [(s * 1.5, 0, 5.2), (s * 1.55, 0, 5.4), (s * 1.42, 0, 5.52), (s * 1.3, 0, 5.4)], [0.05, 0.045, 0.04, 0.03], iron, seg=5, smooth=False))
    return parts


def crater_rock(P, coll):
    """Big rough crater rock, ~6 m wide and ~4.5 m tall: fused basalt blobs chiselled into broken planes, slag lumps at
    its foot and hot seams between the planes."""
    obs, slag, bas, iron, gold, glow = P.materials()
    rnd = random.Random(73)
    blobs = [((0, 0, 0), (2.8, 2.4, 4.2)), ((1.6, 0.4, 0), (1.9, 1.6, 2.8)), ((-1.8, -0.3, 0), (1.7, 1.5, 2.4)), ((0.2, 1.2, 0.5), (1.5, 1.3, 5.2)),
             ((-0.6, -1.4, 0), (1.5, 1.2, 1.8))]
    rock = _mound("Rock", bas, rnd, blobs, 0.12, 2200, 20, keep=1.6, amp=0.14, scale=0.9)
    parts = [rock]
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        parts.append(sp.chunk(f"Lump{k}", (math.cos(a) * 3.0, math.sin(a) * 2.5, 0.35), (1.3, 1.0, 0.7), slag, rnd, yaw=a, jitter=0.3))
    starts = [(x, z, -1 if k % 2 else 1) for k, (x, z) in enumerate(((-1.8, 4.2), (-0.2, 4.8), (1.4, 4.0), (-2.4, 2.6), (0.6, 3.0), (2.2, 2.2)))]
    parts += _seams("RockSeam", rock, glow, rnd, starts, r=0.06, steps=6, step=0.5)
    return parts


#: name: (builder, height for the paint's height gradient, AO distance)
PROPS = {
    "Spire": (spire, 3.3, 0.25),
    "Ridge": (ridge, 2.1, 0.25),
    "Stump": (stump, 1.27, 0.2),
    "Perch": (perch, 3.2, 0.3),
    "SunShard": (sun_shard, 12.0, 1.0),
    "Ribs": (ribs, 8.0, 0.8),
    "LanternPost": (lantern_post, 6.2, 0.4),
    "CraterRock": (crater_rock, 4.5, 0.8),
}
COVER = ("Spire", "Ridge", "Stump", "Perch")
BACKDROP = ("SunShard", "Ribs", "LanternPost", "CraterRock")
COLL = "Den "
PREFIX = "den_props_"
SHARP = {"obsidian": 18, "slag": 40, "basalt": 30, "iron": 30, "gold": 24, "glow": 40}
TINTS = {"obsidian": {"shadow": (0.62, 0.52, 0.78)}, "basalt": {"shadow": (0.78, 0.66, 0.62)}, "slag": {"shadow": (0.9, 0.55, 0.45)}}


def build(only=None):
    """Builds the props (all, or the names in `only`) into collections "Den <name>" (emptied first)."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    P = DenProps()
    colls = []
    for name, (fn, height, ao) in PROPS.items():
        if only and name not in only:
            continue
        coll = kit.collection(COLL + name)
        sp._merge(name, fn(P, coll), prefix=PREFIX, sharp=SHARP)
        sculpt.paint(coll, height=height, ao_dist=ao, tints=TINTS)
        colls.append(coll)
    return colls


def export():
    colls = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    return sp._export(colls, OUT)


def clear():
    sp.clear()


def sheet(path=SHEET):
    missing = [n for n in COVER + BACKDROP if not (bpy.data.collections.get(COLL + n) and bpy.data.collections[COLL + n].objects)]
    if missing:
        build(missing)
    return sp.render_sheet([("cover", COVER, 22.0, 0.5), ("backdrop", BACKDROP, 60.0, 1.2)], path, prefix_coll=COLL)
