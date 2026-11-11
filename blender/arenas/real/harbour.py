"""Drowned Harbour: the round head of a stone quay at dusk, the sea all round it.

Cover (point-symmetric about (0, 7)): a cluster of barrels in the middle (low), two rows of stacked sea chests guarding
the starts (low), two mooring dolphins with a lantern each flanking the middle (tall), two cannons on the wings aimed
out to sea (low), two wet boulders in the far corners (low).

Round it: a three-master moored on the left, a wooden pier leading off to the right with its gallows frame at the far
end, low pier stubs and floating wreckage before and behind (the cameras sit there: nothing over 2 m), sea stacks far
out. Run:  blender --background --factory-startup --python blender/arenas/real/harbour.py [-- <check picture path>]
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Matrix, Vector  # noqa: E402

from kit import Arena, S, pillar, twin, wall  # noqa: E402

PI = math.pi
A = Arena("harbour", paint=64)
rnd = random.Random(7)

# ---- props --------------------------------------------------------------------------------------------------------
m = A.load("wooden_barrels_01")
A.template("barrelA", [m["wooden_barrels_01_barrel01"]], tris=900)
A.template("barrelB", [m["wooden_barrels_01_barrel02"]], tris=900)
A.template("staves", [m["wooden_barrels_01_piece01"]], tris=500)
A.template("stavesB", [m["wooden_barrels_01_piece03"]], tris=400)
m = A.load("wooden_crate_02")
A.template("chest", [m["wooden_crate_02_crate"], m["wooden_crate_02_lid"]], tris=700)
m = A.load("wooden_crate_01")
A.template("crate", [m["wooden_crate_01"], m["wooden_crate_01_lid"]], tris=600)
m = A.load("wooden_bucket_01", tex=256, normal=False)
A.template("bucket", [m["wooden_bucket_01"], m["wooden_bucket_01_handle"]], tris=400)
m = A.load("wooden_lantern_01", tex=256)
A.template("lantern", [m["wooden_lantern_01"], m["wooden_lantern_01_door"], m["wooden_lantern_01_handle"]], tris=700, origin=None)
m = A.load("cannon_01")
A.template("cannon", [v for k, v in m.items() if k != "Icosphere" and "ball" not in k], tris=4200)
A.template("ball", [m["cannon_01_ball_01"]], tris=120)
m = A.load("rock_moss_set_01")
A.template("boulder", [m["rock_moss_set_01_rock02"]], tris=1300)
A.template("rockA", [m["rock_moss_set_01_rock04"]], tris=500)
A.template("rockB", [m["rock_moss_set_01_rock06"]], tris=500)
m = A.load("boulder_01", normal=False)
A.template("stack", [m["boulder_01"]], tris=1500)
m = A.load("modular_wooden_pier", loose=("modular_wooden_pier_poles",))
poles = [v for k, v in m.items() if k.startswith("modular_wooden_pier_poles.")]
poles = [p for p in poles if max(v.co.z for v in p.data.vertices) - min(v.co.z for v in p.data.vertices) > 1.5][:4]
print("POLES", [(len(p.data.polygons), round(max(v.co.z for v in p.data.vertices) - min(v.co.z for v in p.data.vertices), 2)) for p in poles])
NP = len(poles)
for i, p in enumerate(poles):
    A.template(f"pole{i}", [p], tris=260)
for i in (1, 2, 3, 4):
    A.template(f"pier{i}", [m[f"modular_wooden_pier_section_0{i}"]], tris=2600)
A.template("deck", [m["modular_wooden_pier_planks"]], tris=1200)
m = A.load("dutch_ship_large_01", normal=False)
A.template("ship", [(m["dutch_ship_large_01_hull"], Matrix.Identity(4))], tris=9000, origin=None)
A.template("rigging", [m["dutch_ship_large_01_rigging"]], tris=5000, origin=None)
A.template("sails", [m["dutch_ship_large_01_sails"]], tris=1800, origin=None)

rope = A.flat("rope", "#7a6648", rough=0.95)
iron = A.flat("iron", "#2a2a2e", rough=0.5, metal=0.8)


def ring(key, mat, radius, thick, seg=(20, 6)):
    import bpy
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thick, major_segments=seg[0], minor_segments=seg[1])
    ob = bpy.context.object
    ob.data.materials.append(mat)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    A.store.objects.link(ob)
    A.templates[key] = ob
    return ob


ring("lash", rope, 0.3, 0.035)
ring("hook", iron, 0.07, 0.012, seg=(12, 5))


def pole_h(i):
    return A.size(f"pole{i}").z


# ---- cover --------------------------------------------------------------------------------------------------------
def barrels(o, turn):
    """Three barrels standing close, staves and a bucket beside them."""
    x, z = o["ax"], o["az"]
    for k, key in enumerate(("barrelA", "barrelB", "barrelA")):
        a = turn + k * 2 * PI / 3
        A.put(key, x + 0.5 * math.sin(a), z + 0.5 * math.cos(a), yaw=a * 1.7)
    A.put("bucket", x + 0.15, z - 0.1, yaw=1.0, y=0.92 * S * 0.98)


def chests(o, turn):
    """A row of sea chests two high along a wall, the top row broken by a gap, a crate and a bucket on it."""
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    length = math.hypot(bx - ax, bz - az) + 2 * o["r"]
    yaw = math.atan2(bx - ax, bz - az)          # the wall's line as a turn about the vertical
    cx, cz, ux, uz = (ax + bx) / 2, (az + bz) / 2, math.sin(yaw), math.cos(yaw)
    cl, ch = 1.17 * S, 0.47 * S                  # a chest's length and height
    n = max(2, round(length / cl))
    step = length / n
    for i in range(n):
        t = (i - (n - 1) / 2) * step
        A.put("chest", cx + ux * t, cz + uz * t, yaw=yaw + rnd.uniform(-0.05, 0.05), stretch=(1.25, step / cl, 1.0))
        if i != (1 if turn else n - 2):
            A.put("chest", cx + ux * t, cz + uz * t, yaw=yaw + rnd.uniform(-0.12, 0.12), y=ch, stretch=(1.2, step / cl * 0.92, 1.0))
        else:
            A.put("crate", cx + ux * t, cz + uz * t, yaw=yaw + PI / 2 + 0.2, y=ch)
    e = (n - 1) / 2 * step
    A.put("bucket", cx + ux * e, cz + uz * e, yaw=0.5, y=2 * ch)


def dolphin(o, turn):
    """Three piles driven in together, lashed with rope near the top, a lantern on an iron hook."""
    x, z = o["ax"], o["az"]
    h = o["height"]
    for k in range(3):
        a = turn + k * 2 * PI / 3
        lean = 0.09
        s = h / pole_h(k % NP) * (1.0 if k == 0 else 0.9 - 0.06 * k)
        A.put(f"pole{k % NP}", x + 0.36 * math.sin(a), z + 0.36 * math.cos(a), yaw=a, scale=(1.9, 1.9, s), tilt=(lean, 0.0))
    A.put("lash", x, z, y=h * 0.72, scale=(1.5, 1.5, 3.2))
    A.put("lash", x, z, y=h * 0.3, scale=(1.75, 1.75, 3.0))
    lx, lz = x + 0.62 * math.sin(turn + PI / 3), z + 0.62 * math.cos(turn + PI / 3)
    A.put("hook", lx, lz, y=h * 0.72 - 0.05, scale=1.6, tilt=(PI / 2, 0.0), yaw=turn + PI / 3)
    A.put("lantern", lx, lz, y=h * 0.72 - 0.78, scale=1.5, yaw=turn)
    A.mark("lantern", lx, lz, h * 0.72 - 0.78 + 0.28)


def cannon(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    yaw = math.atan2(bx - ax, bz - az) + PI      # the muzzle looks from a to b, out to sea
    A.put("cannon", (ax + bx) / 2, (az + bz) / 2, yaw=yaw, scale=S * 1.12)
    for k in range(3):
        A.put("ball", ax - 0.55 * math.cos(yaw) + 0.2 * k * math.sin(yaw), az + 0.55 * math.sin(yaw) + 0.2 * k * math.cos(yaw), scale=S * 1.2)


def boulder(o, turn):
    ax, az, bx, bz = o["ax"], o["az"], o["bx"], o["bz"]
    length = math.hypot(bx - ax, bz - az) + 2 * o["r"]
    yaw = math.atan2(bx - ax, bz - az)
    s = A.size("boulder")
    A.put("boulder", (ax + bx) / 2, (az + bz) / 2, yaw=yaw + turn, scale=(1.5 / s.x, length / s.y, o["height"] / s.z), y=-0.1)


LAYOUT = [
    (pillar(0, 7, 0.9, 1.3), barrels, False),
    (wall(-2.6, 3.8, -5.6, 2.4, 0.4, 1.3), chests, True),
    (pillar(4.3, 4.7, 0.7, 3.9), dolphin, True),
    (wall(7.3, 7.5, 9.0, 8.4, 0.4, 1.15), cannon, True),
    (wall(6.0, 1.5, 7.9, 3.3, 0.45, 1.2), boulder, True),
]
o, build, _ = LAYOUT[0]
A.cover(o)
build(o, 0.3)
for o, build, _ in LAYOUT[1:]:
    A.cover(o)
    build(o, 0.0)
    A.cover(twin(o))
    build(twin(o), PI)

# ---- backdrop -----------------------------------------------------------------------------------------------------
A.back()
SEA = -1.7
# the three-master, moored along the left side (|x| > 12), bows toward the far camera
for key in ("ship", "rigging", "sails"):
    A.put(key, -25.5, 9.0, yaw=PI / 2, scale=1.0, y=SEA - 2.3)
# the pier to the right: decks level with the quay, the gallows frame at its far end
deck_y = -2.63 * S + 0.02
for i, key in enumerate(("pier2", "pier3", "pier4", "pier1")):
    A.put(key, 14.6 + i * 3.25 * S, 7.0 + 0.15 * (i % 2), yaw=PI / 2, y=deck_y - (2.63 - 2.63) * S)
# low pier stubs toward both cameras (nothing over 2 m on the z axis), and piles standing in the water
for sgn in (1, -1):
    A.put("deck", 0.4 * sgn, 7 + sgn * 14.3, yaw=0.05 * sgn, y=-0.12)
    A.put("deck", -0.2 * sgn, 7 + sgn * 17.0, yaw=-0.1 * sgn, y=-0.35, tilt=(0.06 * sgn, 0.03))
    for k, (dx, dz) in enumerate(((-1.7, 13.6), (1.9, 13.9), (-1.6, 16.4), (1.8, 16.9), (-1.3, 19.5), (1.5, 20.4))):
        A.put(f"pole{k % NP}", dx * sgn, 7 + sgn * dz, yaw=k, scale=(1.7, 1.7, 1.0), y=SEA - 1.6 + 0.25 * (k % 3), tilt=(0.05 * (k % 2), 0.04))
# wreckage afloat and loose cargo on the kerb
for a, r, key in ((0.5, 14.2, "barrelA"), (2.2, 15.0, "staves"), (3.6, 14.0, "barrelB"), (4.4, 15.6, "stavesB"), (5.5, 14.6, "staves"), (1.3, 16.5, "chest")):
    A.put(key, 15 * 0 + r * math.sin(a), 7 + r * math.cos(a), yaw=a * 3, y=SEA - 0.28, tilt=(1.3 if key.startswith("barrel") else 0.2, 0.3))
# rocks awash round the quay's foot, and sea stacks: tall ones only beyond 26 m or well off the z axis
for k in range(9):
    a = 0.4 + k * 2 * PI / 9 + 0.25 * math.sin(k * 3.1)
    r = 13.3 + 0.5 * (k % 3)
    A.put("rockA" if k % 2 else "rockB", r * math.sin(a), 7 + r * math.cos(a), yaw=k * 1.7, scale=0.9 + 0.25 * (k % 3), y=SEA - 0.85)
for a, r, sc in ((0.55, 34, 6.5), (1.25, 30, 5.0), (1.95, 38, 8.0), (2.6, 31, 5.5), (3.7, 33, 7.0), (4.3, 29, 4.6), (4.95, 40, 9.0), (5.75, 32, 6.0), (0.05, 46, 6.0),
                 (3.2, 48, 7.5)):
    A.put("stack", r * math.sin(a), 7 + r * math.cos(a), yaw=a * 2.3, scale=(sc, sc, sc * 1.5), y=SEA - 0.25 * sc)

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0], sea=SEA)
