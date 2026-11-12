"""The Twin Forge: Ash and Ember's boss room for a party of up to 40 (user, 2026-11-11: "what if the arena is not like
a round arena, let's just forget all and let's make boss room"; 2026-11-12: the room changes with their phases). Two
halls side by side under one roofless forge, a channel of flame between them. Not a ring, not the Hall of Noon's cross
and not the Sunburst's sun: a long rectangle cut into dark stone, split down its length.

    the west hall    Ash's: basalt, his pillars, a square hearth in the north wall and a great anvil before it
    the east hall    Ember's: her vents, a lantern-headed hearth with three hanging lanterns and a great brazier
    the channel      the wall of fire runs in it from the north wall to the gate; three thresholds cross it (the gates
                     that open for The Changing of the Flames)
    the gate         the party's way in: one passage in the south wall, the channel running out through its middle, so
                     each half of the party comes in on its own side

It transforms twice (src/raid/twinForge.ts): the floor cracks into islands (lava channels, drawn by the game; the
bridges of cooled crust over them are objects of this file, `bridge0`..., which the game raises and sinks), and the
pit floods to one last island in the middle. Every number of the plan is here and goes to the game in the json
(`forge`): the halls, the gate, the channels, the bridges, the thresholds, the island, and where the two of them, the
pillars and the vents are (src/arenas/twinpit.ts reads them).

The walls are the stone the forge is cut from: 1.3 m on the camera's side (it looks over them), stepping up along the
flanks to 9.5 and 13 m in the north. The room's own walls are obstacles that never break (`fixed`). Run:
    blender --background --factory-startup --python blender/arenas/real/twinforge.py [-- <check picture path>]
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from kit import Arena, pillar, wall  # noqa: E402

PI, TAU = math.pi, math.tau
A = Arena("twinforge")
V = Vector
CX, CZ = 0.0, 7.0
# The forge: half its width, how far it reaches north and south of the middle, the channel's half width.
HX, HN, HS, CHAN = 26.0, 27.0, 27.0, 0.9
# The gate's passage: half its width, and how far south of the middle it ends.
GX, GS = 9.4, 37.0
# How far the stone goes.
OX, ON, OS = 44.0, 45.0, 47.0
LOW, MID, HIGH, TOP = 1.3, 5.0, 9.5, 13.0
# Where the flanks step up, from the south: low to here, then mid, then high.
STEP1, STEP2 = 9.0, -9.0
# The lava channels of the second phase: half their width, and where they run (east half; the west is its mirror).
LAVA = 1.3
EW0, EW1 = 10.4, 13.2          # an east-west channel: how far from the middle it is at the channel of flame and at the flank
NSX0, NSX1 = 16.2, 19.0        # a north-south channel: where it leaves the east-west one, where it meets the end wall
BRIDGE_W, BRIDGE_L = 3.2, 3.9
# The thresholds across the channel of flame (north to south, from the middle), and half their width.
GATES, GATE_HALF = [-19.0, 0.0, 19.0], 2.0
# The last island, when the pit has flooded: half its width and half its length.
ISLE_X, ISLE_Z = 10.0, 11.0
# Where the two of them stand, Ash's pillars (in the order they are added as the party grows) and Ember's vents.
HOLD = [(-14.0, 7.0), (14.0, 7.0)]
PILLARS = [(-6.6, 14.4), (-6.6, -0.4), (-21.4, -0.4), (-21.4, 14.4), (-12, 25), (-12, -11), (-24.5, 7), (-4.5, 24), (-4.5, -10), (-21, 25), (-21, -11)]
VENTS = [(7, 22.5), (7, -8.5), (22, 15), (22, -1), (14, 27), (14, -13)]
# Ash's half has vents of its own for Seal the Vents: slag vents, cold until then.
SLAG = [(-7, 22.5), (-7, -8.5), (-23.5, 28), (-23.5, -14)]
VENT_R, GREAT_R = 1.0, 1.6

A.mat("stone", "#2c3140", rough=0.85)
A.mat("slate", "#3a4052", rough=0.8)
A.mat("basalt", "#22242b", rough=0.9)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("iron", "#3c3f47", rough=0.42, metal=0.75)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("cinder", "#8a3216", rough=0.7)                   # the arena's own colour: stone the forge has burnt red
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)
A.mat("coals", "#7a2a10", rough=0.6, emit="#e0601a", strength=0.55)


def Z(dz):
    """The game's z of a spot `dz` south of the middle."""
    return CZ + dz


def facing(dx, dz):
    """The yaw that turns a prop built looking along +y to look along the game's (dx, dz)."""
    return math.atan2(-dx, -dz)


def solid(f, key, pts):
    bm = f.bm(key)
    vs = [bm.verts.new(V(p)) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)


def prism(f, key, poly, z0, z1):
    """A convex outline in the game's (x, z), standing from `z0` to `z1`."""
    solid(f, key, [(x, -z, h) for x, z in poly for h in (z0, z1)])


def grown(poly, d):
    """A convex outline pushed out by `d` metres on every side (in, when negative)."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    s = 1.0 if area > 0 else -1.0
    lines = []
    for i in range(n):
        (ax, az), (bx, bz) = poly[i], poly[(i + 1) % n]
        dx, dz = bx - ax, bz - az
        ln = math.hypot(dx, dz)
        lines.append(((ax + s * dz / ln * d, az - s * dx / ln * d), (dx / ln, dz / ln)))
    out = []
    for i in range(n):
        (p, u), (q, w) = lines[i - 1], lines[i]
        den = u[0] * w[1] - u[1] * w[0]
        t = ((q[0] - p[0]) * w[1] - (q[1] - p[1]) * w[0]) / den
        out.append((p[0] + u[0] * t, p[1] + u[1] * t))
    return out


def rect(x0, x1, dz0, dz1):
    return [(x0, Z(dz0)), (x1, Z(dz0)), (x1, Z(dz1)), (x0, Z(dz1))]


# ---- props, in metres, standing on z = 0; +y looks into the room -----------------------------------------------------
def lantern(key, tall):
    """A keeper's lantern: a basalt post, a gold cap, a caged light."""
    f = A.fig()
    f.turned("basalt", (0, 0, 0), (0, 0, 0.28), [(0, 0.5), (1, 0.44)], seg=6)
    f.turned("basalt", (0, 0, 0.28), (0, 0, tall), [(0, 0.3), (1, 0.2)], seg=6)
    f.turned("gold", (0, 0, tall * 0.6), (0, 0, tall * 0.6 + 0.1), [(0, 0.27), (1, 0.27)], seg=6)
    f.turned("gold", (0, 0, tall), (0, 0, tall + 0.12), [(0, 0.22), (1, 0.34)], seg=6)
    f.ellipsoid("glow", (0, 0, tall + 0.52), (0.19, 0.19, 0.25), seg=(12, 8))
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        f.tube("gold", [(0.3 * math.cos(a), 0.3 * math.sin(a), tall + 0.12), (0.34 * math.cos(a), 0.34 * math.sin(a), tall + 0.52), (0, 0, tall + 0.98)],
               [0.024, 0.024, 0.014], seg=5)
    f.turned("gold", (0, 0, tall + 0.95), (0, 0, tall + 1.3), [(0, 0.07), (1, 0.006)], seg=6)
    A.built(key, f)


def anvil(key, s):
    """An anvil on its block: the smith's own form, clean and new. Built with its horn along +x."""
    f = A.fig()
    f.box("slate", (0, 0, 0.3 * s), (2.3 * s, 1.5 * s, 0.6 * s))
    f.box("gold", (0, 0, 0.62 * s), (2.36 * s, 1.56 * s, 0.06 * s))
    f.box("iron", (0, 0, 0.85 * s), (1.5 * s, 1.0 * s, 0.4 * s))
    solid(f, "iron", [(sx * 0.42 * s, sy * 0.3 * s, 1.05 * s) for sx in (-1, 1) for sy in (-1, 1)] + [(sx * 0.62 * s, sy * 0.42 * s, 1.5 * s) for sx in (-1, 1) for sy in (-1, 1)])
    f.box("iron", (-0.1 * s, 0, 1.7 * s), (1.9 * s, 0.84 * s, 0.4 * s))
    f.box("gold", (-0.1 * s, 0, 1.915 * s), (1.94 * s, 0.88 * s, 0.035 * s))
    f.turned("iron", (0.85 * s, 0, 1.7 * s), (1.95 * s, 0, 1.78 * s), [(0, 0.2 * s), (1, 0.03 * s)], seg=14)
    A.built(key, f, bevel=0.012)


def brazier(key, s):
    """A great brazier: a lacquer bowl with a gold rim on a turned foot, coals glowing in it."""
    f = A.fig()
    f.turned("basalt", (0, 0, 0), (0, 0, 0.9 * s), [(0, 0.75 * s), (0.2, 0.62 * s), (0.5, 0.3 * s), (1, 0.42 * s)], seg=20)
    f.turned("lacquer", (0, 0, 0.9 * s), (0, 0, 1.5 * s), [(0, 0.42 * s), (0.5, 0.95 * s), (1, 1.15 * s)], seg=24)
    f.torus("gold", (0, 0, 1.5 * s), 1.15 * s, 0.07 * s, seg=(28, 6))
    f.torus("gold", (0, 0, 0.9 * s), 0.43 * s, 0.05 * s, seg=(20, 6))
    f.ellipsoid("coals", (0, 0, 1.5 * s), (1.0 * s, 1.0 * s, 0.3 * s), seg=(18, 8))
    A.built(key, f)


def collar(key, r, ring_key):
    """The collar of a vent: a low turned ring of stone with a gold line, round a dark mouth."""
    f = A.fig()
    f.torus(ring_key, (0, 0, 0.06), r + 0.2, 0.17, seg=(26, 6))
    f.torus("gold", (0, 0, 0.2), r + 0.2, 0.035, seg=(26, 5))
    A.built(key, f)


def niche(key, h):
    """A lantern niche for a tall wall's face: a dark recess in a gold frame with a pointed head, a lantern hanging in it."""
    f = A.fig()
    f.box("lacquer", (0, 0, 1.5 + h / 2), (1.5, 0.24, h))
    for sx in (-1, 1):
        f.box("gold", (sx * 0.82, 0.05, 1.5 + h / 2), (0.14, 0.36, h + 0.1))
    f.box("gold", (0, 0.05, 1.43), (1.86, 0.4, 0.13))
    top = 1.5 + h
    solid(f, "gold", [(-0.93, -0.13, top), (0.93, -0.13, top), (-0.93, 0.23, top), (0.93, 0.23, top), (0, -0.13, top + 0.85), (0, 0.23, top + 0.85)])
    f.tube("gold", [(0, 0.2, top), (0, 0.2, 1.5 + h * 0.74)], [0.022, 0.022], seg=6)
    f.turned("gold", (0, 0.2, 1.5 + h * 0.74), (0, 0.2, 1.5 + h * 0.66), [(0, 0.05), (1, 0.24)], seg=12)
    f.ellipsoid("glow", (0, 0.2, 1.5 + h * 0.56), (0.21, 0.21, 0.32), seg=(14, 8))
    f.turned("gold", (0, 0.2, 1.5 + h * 0.46), (0, 0.2, 1.5 + h * 0.42), [(0, 0.18), (1, 0.05)], seg=12)
    A.built(key, f, bevel=0.01)


def pilaster(key, h, mat):
    f = A.fig()
    f.box("stone", (0, 0, 0.25), (1.5, 0.7, 0.5))
    f.box(mat, (0, 0, 0.5 + (h - 1.2) / 2), (1.0, 0.5, h - 1.2))
    f.box("gold", (0, 0, h - 0.55), (1.4, 0.7, 0.3))
    A.built(key, f, bevel=0.012)


def hearth_ash():
    """Ash's hearth: a square mouth between two heavy piers under a lintel with an anvil on it, an iron grate before the coals."""
    f = A.fig()
    f.box("lacquer", (0, -0.2, 3.3), (8.4, 0.5, 6.6))
    f.box("coals", (0, 0.08, 2.5), (7.0, 0.1, 4.2))
    for sx in (-1, 1):
        f.box("basalt", (sx * 4.9, 0.3, 3.6), (1.6, 1.5, 7.2))
        f.box("gold", (sx * 4.9, 0.3, 7.25), (1.75, 1.65, 0.16))
        f.box("cinder", (sx * 4.9, 0.3, 0.2), (1.8, 1.7, 0.4))
    f.box("basalt", (0, 0.3, 7.95), (11.8, 1.6, 1.3))
    f.box("gold", (0, 0.3, 8.68), (12.0, 1.8, 0.14))
    f.box("lacquer", (0, 0.3, 8.85), (11.9, 1.7, 0.2))
    for k in range(7):
        x = -3.0 + k * 1.0
        f.tube("iron", [(x, 0.45, 0.2), (x, 0.45, 4.7)], [0.09, 0.09], seg=8)
    f.box("iron", (0, 0.45, 4.75), (7.2, 0.22, 0.2))
    f.box("iron", (0, 0.45, 0.3), (7.2, 0.22, 0.2))
    # The anvil on the lintel, in relief.
    solid(f, "gold", [(-1.5, 1.14, 7.5), (1.5, 1.14, 7.5), (-1.5, 1.2, 7.5), (1.5, 1.2, 7.5), (-0.7, 1.14, 7.9), (0.7, 1.14, 7.9), (-0.7, 1.2, 7.9), (0.7, 1.2, 7.9)])
    solid(f, "gold", [(-1.9, 1.14, 8.05), (2.3, 1.14, 8.2), (-1.9, 1.2, 8.05), (2.3, 1.2, 8.2), (-1.9, 1.14, 8.45), (1.5, 1.14, 8.45), (-1.9, 1.2, 8.45), (1.5, 1.2, 8.45)])
    f.box("gold", (0, 1.17, 7.98), (0.9, 0.06, 0.2))
    A.built("hearth_ash", f, bevel=0.015)


def hearth_ember():
    """Ember's hearth: a mouth with a lantern's pointed head in a gold frame, three lanterns hanging before the coals."""
    f = A.fig()
    f.box("lacquer", (0, -0.2, 2.6), (7.4, 0.5, 5.2))
    solid(f, "lacquer", [(-3.7, -0.45, 5.2), (3.7, -0.45, 5.2), (-3.7, 0.05, 5.2), (3.7, 0.05, 5.2), (0, -0.45, 8.6), (0, 0.05, 8.6)])
    f.box("coals", (0, 0.08, 2.4), (6.2, 0.1, 4.0))
    solid(f, "coals", [(-3.1, 0.03, 4.4), (3.1, 0.03, 4.4), (-3.1, 0.13, 4.4), (3.1, 0.13, 4.4), (0, 0.03, 7.3), (0, 0.13, 7.3)])
    for sx in (-1, 1):
        f.box("slate", (sx * 4.3, 0.3, 2.9), (1.2, 1.3, 5.8))
        f.box("gold", (sx * 4.3, 0.3, 5.85), (1.35, 1.45, 0.16))
        f.box("cinder", (sx * 4.3, 0.3, 0.2), (1.4, 1.5, 0.4))
        # The head's two rafters, in gold.
        solid(f, "gold", [(sx * 4.9, -0.1, 5.95), (sx * 4.9, 0.9, 5.95), (sx * 3.9, -0.1, 5.95), (sx * 3.9, 0.9, 5.95), (0, -0.1, 9.55), (0, 0.9, 9.55), (0, -0.1, 8.75), (0, 0.9, 8.75)])
    f.ellipsoid("gold", (0, 0.4, 9.75), (0.42, 0.42, 0.6), seg=(14, 8))
    for x, z in ((-1.9, 4.6), (0.0, 3.5), (1.9, 4.6)):
        top = 6.2 if x else 7.4
        f.tube("gold", [(x, 0.75, top), (x, 0.75, z + 0.75)], [0.03, 0.03], seg=6)
        f.turned("gold", (x, 0.75, z + 0.75), (x, 0.75, z + 0.55), [(0, 0.06), (1, 0.34)], seg=12)
        f.ellipsoid("glow", (x, 0.75, z + 0.2), (0.3, 0.3, 0.44), seg=(14, 8))
        f.turned("gold", (x, 0.75, z - 0.2), (x, 0.75, z - 0.32), [(0, 0.26), (1, 0.06)], seg=12)
    A.built("hearth_ember", f, bevel=0.015)


def chimney(key, mat):
    """A stack over a hearth: tall, tapering, a gold band and a lacquer lip."""
    f = A.fig()
    solid(f, mat, [(sx * 3.1, sy * 2.4, 0) for sx in (-1, 1) for sy in (-1, 1)] + [(sx * 2.2, sy * 1.7, 11.0) for sx in (-1, 1) for sy in (-1, 1)])
    f.box("gold", (0, 0, 8.6), (5.0, 3.9, 0.28))
    f.box("lacquer", (0, 0, 11.2), (5.0, 4.0, 0.5))
    f.box("cinder", (0, 0, 0.3), (6.4, 5.0, 0.6))
    A.built(key, f, bevel=0.02)


def threshold():
    """A threshold across the channel of flame: a slab of slate, gold along the two edges a hero steps over."""
    f = A.fig()
    f.box("slate", (0, 0, 0.05), (CHAN * 2 + 1.5, GATE_HALF * 2, 0.1))
    for sx in (-1, 1):
        f.box("gold", (sx * (CHAN + 0.7), 0, 0.06), (0.14, GATE_HALF * 2 + 0.04, 0.13))
    for sy in (-1, 1):
        f.box("lacquer", (0, sy * (GATE_HALF + 0.14), 0.2), (CHAN * 2 + 1.9, 0.28, 0.4))
        f.box("gold", (0, sy * (GATE_HALF + 0.14), 0.42), (CHAN * 2 + 1.95, 0.32, 0.06))
    A.built("threshold", f, bevel=0.008)


def bridge():
    """A bridge of cooled crust: a thick dark slab, three plates of slate let into its top, built with its length along +x."""
    f = A.fig()
    f.box("basalt", (0, 0, -0.13), (BRIDGE_L, BRIDGE_W, 0.42))
    for k in (-1, 0, 1):
        f.box("slate", (k * BRIDGE_L / 3.1, 0, 0.085), (BRIDGE_L / 3.4, BRIDGE_W - 0.5, 0.03))
    for sy in (-1, 1):
        f.box("cinder", (0, sy * (BRIDGE_W / 2 - 0.07), 0.09), (BRIDGE_L - 0.1, 0.1, 0.03))
    A.built("bridge", f, bevel=0.02)


lantern("lantern", 1.0)
lantern("post", 1.9)
anvil("anvil", 1.0)
anvil("great_anvil", 1.55)
brazier("brazier", 0.6)
brazier("great_brazier", 1.2)
collar("vent", VENT_R, "stone")
collar("great_vent", GREAT_R, "stone")
collar("slag", VENT_R, "iron")
niche("niche", 3.2)
niche("niche_tall", 4.6)
pilaster("pilaster_b", 9.0, "basalt")
pilaster("pilaster_s", 9.0, "slate")
pilaster("pilaster_mid_b", 4.6, "basalt")
pilaster("pilaster_mid_s", 4.6, "slate")
hearth_ash(); hearth_ember(); threshold(); bridge()
chimney("chimney_b", "basalt")
chimney("chimney_s", "slate")


# ---- the layout ------------------------------------------------------------------------------------------------------
def fixed(ax, dza, bx, dzb, height):
    """A stretch of the room's own wall: an obstacle that never breaks, with no mesh of its own (the stone is the backdrop)."""
    A.cover(dict(wall(ax, Z(dza), bx, Z(dzb), 0.6, height), fixed=True))


W = 0.6
# The two great pieces of cover that are not Ash's pillars: his anvil and her brazier, before their hearths. They never break.
A.cover(dict(pillar(HOLD[0][0], Z(-HN + 4.2), 1.75, 3.0), fixed=True))
A.put("great_anvil", HOLD[0][0], Z(-HN + 4.2), yaw=0.0, scale=1.0)
A.cover(dict(pillar(HOLD[1][0], Z(-HN + 4.2), 1.5, 1.9), fixed=True))
A.put("great_brazier", HOLD[1][0], Z(-HN + 4.2), scale=1.0)
A.mark("beacon", HOLD[1][0], Z(-HN + 4.2), 2.0)

# The flanks, from the south: low, mid, high.
for s in (-1, 1):
    x = s * (HX + W)
    fixed(x, HS + W, x, STEP1, LOW)
    fixed(x, STEP1, x, STEP2, MID)
    fixed(x, STEP2, x, -HN - W, HIGH)
    # The south wall either side of the gate, the passage's sides.
    fixed(s * (HX + W), HS + W, s * (GX + W), HS + W, LOW)
    fixed(s * (GX + W), HS + W, s * (GX + W), GS + W, LOW)
fixed(-HX - W, -HN - W, HX + W, -HN - W, HIGH)
fixed(-GX - W, GS + W, GX + W, GS + W, LOW)

# ---- the stone the forge is cut from, and what is on its walls -------------------------------------------------------
A.back()
masses = 0


def mass(poly, h, z0=0.0, mat="stone"):
    """A block of the stone over a convex outline, `h` high: a gold line under its top, burnt red at its foot."""
    global masses
    f = A.fig()
    prism(f, mat, poly, z0, z0 + h - 0.1)
    prism(f, "gold", grown(poly, 0.12), z0 + h - 0.34, z0 + h - 0.2)
    prism(f, "lacquer", grown(poly, 0.05), z0 + h - 0.2, z0 + h)
    if z0 == 0.0:
        prism(f, "cinder", grown(poly, 0.08), 0.0, 0.32)
    key = f"mass{masses}"
    masses += 1
    A.built(key, f)
    A.put(key, 0, 0, scale=1.0)


# South: low all along, the gate's passage cut through its middle.
for s in (-1, 1):
    lo, hi = sorted((s * GX, s * OX))
    mass(rect(lo, hi, HS, OS), LOW)
mass(rect(-GX, GX, GS, OS), LOW)
# The flanks: Ash's of basalt, Ember's of slate; each steps up to the north.
for s, mat in ((-1, "basalt"), (1, "slate")):
    lo, hi = sorted((s * HX, s * OX))
    mass(rect(lo, hi, STEP1, HS), LOW, mat=mat)
    mass(rect(lo, hi, STEP2, STEP1), MID, mat=mat)
    mass(rect(lo, hi, -HN, STEP2), HIGH, mat=mat)
    inner = sorted((s * (HX + 5.0), s * OX))
    mass(rect(inner[0], inner[1], -HN, STEP2 - 5.0), TOP - HIGH, HIGH, mat=mat)
# North: the forge's back wall, one half of basalt and one of slate, a terrace behind.
mass(rect(-OX, 0, -ON, -HN), HIGH, mat="basalt")
mass(rect(0, OX, -ON, -HN), HIGH, mat="slate")
mass(rect(-OX, 0, -ON, -HN - 5.0), TOP - HIGH, HIGH, mat="basalt")
mass(rect(0, OX, -ON, -HN - 5.0), TOP - HIGH, HIGH, mat="slate")

# The two hearths in the back wall, a stack over each.
south = facing(0, 1)
A.put("hearth_ash", HOLD[0][0], Z(-HN - 0.02), yaw=south, scale=1.0)
A.put("hearth_ember", HOLD[1][0], Z(-HN - 0.02), yaw=south, scale=1.0)
A.mark("hearth", HOLD[0][0], Z(-HN + 0.6), 2.6)
A.mark("hearth", HOLD[1][0], Z(-HN + 0.6), 2.6)
for (x, _), key in zip(HOLD, ("chimney_b", "chimney_s")):
    A.put(key, x, Z(-HN - 8.5), scale=1.0, y=TOP)
for x, z in ((-1.9, 4.6), (0.0, 3.5), (1.9, 4.6)):
    A.mark("lamp", HOLD[1][0] + x, Z(-HN + 0.75), z + 0.2)

# The channel of flame: a kerb along each side, open at the thresholds.
kerbs = 0
stops = [-HN] + [g + sgn * (GATE_HALF + 0.28) for g in GATES for sgn in (-1, 1)] + [GS]
for i in range(0, len(stops), 2):
    a, b = stops[i], stops[i + 1]
    f = A.fig()
    for s in (-1, 1):
        f.box("lacquer", (s * (CHAN + 0.2), 0, 0.09), (0.36, b - a, 0.18))
        f.box("gold", (s * (CHAN + 0.2), 0, 0.195), (0.2, b - a, 0.035))
    A.built(f"kerb{kerbs}", f, bevel=0.008)
    A.put(f"kerb{kerbs}", 0, Z((a + b) / 2), scale=1.0)
    kerbs += 1
for g in GATES:
    A.put("threshold", 0, Z(g), scale=1.0)
    A.mark("gate", 0, Z(g), 0.0)

# Ember's vents and Ash's slag vents: a collar round each mouth. They stop nobody.
for x, z in VENTS:
    A.put("vent", x, z, scale=1.0)
A.put("great_vent", HOLD[1][0], HOLD[1][1], scale=1.0)
for x, z in SLAG:
    A.put("slag", x, z, scale=1.0)

# On the low stone: Ash's side a row of anvils, Ember's a row of lanterns and braziers; posts beside the gate.
for dz in (12.5, 17.5, 22.5):
    A.put("anvil", -HX - 2.6, Z(dz), yaw=PI / 2, scale=1.0, y=LOW)
    A.put("lantern", -HX - 5.2, Z(dz + 2.5), scale=1.0, y=LOW)
    A.mark("lantern", -HX - 5.2, Z(dz + 2.5), LOW + 1.52)
    A.put("lantern", HX + 2.4, Z(dz), scale=1.0, y=LOW)
    A.mark("lantern", HX + 2.4, Z(dz), LOW + 1.52)
for dz in (15.0, 20.0):
    A.put("brazier", HX + 5.0, Z(dz), scale=1.0, y=LOW)
    A.mark("lantern", HX + 5.0, Z(dz), LOW + 1.1)
for x in (-22.0, -16.5, -11.5):
    A.put("anvil", x, Z(HS + 2.6), yaw=(0.0 if x > -20 else PI), scale=1.0, y=LOW)
for x in (11.5, 16.5, 22.0):
    A.put("lantern", x, Z(HS + 2.4), scale=1.0, y=LOW)
    A.mark("lantern", x, Z(HS + 2.4), LOW + 1.52)
for s in (-1, 1):
    A.put("post", s * (GX + 1.7), Z(HS + 1.8), scale=1.0, y=LOW)
    A.mark("lantern", s * (GX + 1.7), Z(HS + 1.8), LOW + 2.42)
    A.put("post", s * (GX + 1.7), Z(GS - 1.5), scale=1.0, y=LOW)
    A.mark("lantern", s * (GX + 1.7), Z(GS - 1.5), LOW + 2.42)

# On the mid and the tall walls: lit niches between pilasters, looking into the halls.
for s, pm, pt in ((-1, "pilaster_mid_b", "pilaster_b"), (1, "pilaster_mid_s", "pilaster_s")):
    into = facing(-s, 0)
    for dz in (5.0, 0.0, -5.0):
        A.put("niche", s * (HX + 0.02), Z(dz), yaw=into, scale=0.82)
        A.mark("lamp", s * (HX - 0.4), Z(dz), 2.7)
    for dz in (7.5, 2.5, -2.5, -7.5):
        A.put(pm, s * (HX - 0.15), Z(dz), yaw=into, scale=1.0)
    for dz in (-13.5, -18.5, -23.5):
        A.put("niche_tall", s * (HX + 0.02), Z(dz), yaw=into, scale=1.0)
        A.mark("lamp", s * (HX - 0.45), Z(dz), 4.1)
    for dz in (-11.0, -16.0, -21.0, -26.0):
        A.put(pt, s * (HX - 0.15), Z(dz), yaw=into, scale=1.0)
    # The back wall either side of the hearth.
    for x in (s * 3.2, s * 23.6):
        A.put("niche_tall", x, Z(-HN - 0.02), yaw=south, scale=1.0)
        A.mark("lamp", x, Z(-HN + 0.45), 4.1)
    for x in (s * 5.6, s * 21.3):
        A.put(pt, x, Z(-HN + 0.15), yaw=south, scale=1.0)

# ---- the second phase: the lava channels, and the bridges of cooled crust over them ------------------------------------
channels, bridges = [], []


def ew(x, sgn):
    """How far from the middle the east-west channel is at `x` (east half), north (`sgn` -1) or south."""
    return sgn * (EW0 + (EW1 - EW0) * (x - CHAN) / (HX - CHAN))


def nsx(dz):
    """Where the north-south channel is, `dz` from the middle (either sign)."""
    return NSX0 + (NSX1 - NSX0) * (abs(dz) - abs(ew(NSX0, 1))) / (HN - abs(ew(NSX0, 1)))


for half, s in ((0, -1), (1, 1)):
    for sgn in (-1, 1):
        c_ew, c_ns = len(channels), len(channels) + 1
        channels.append({"half": half, "ax": s * CHAN, "az": Z(ew(CHAN, sgn)), "bx": s * HX, "bz": Z(ew(HX, sgn)), "r": LAVA})
        channels.append({"half": half, "ax": s * NSX0, "az": Z(ew(NSX0, sgn)), "bx": s * NSX1, "bz": Z(sgn * HN), "r": LAVA})
        # The home island and the inner one, and the inner and the outer one, have two bridges each, which stand in turn; the
        # home island and the narrow outer one have one, which comes and goes.
        ew_yaw = math.atan2(EW1 - EW0, HX - CHAN)
        ns_yaw = math.atan2(NSX1 - NSX0, HN - abs(ew(NSX0, 1)))
        slots = [
            (c_ew, 0, 0, 5.6, ew(5.6, sgn), PI / 2 - s * sgn * ew_yaw), (c_ew, 0, 1, 11.4, ew(11.4, sgn), PI / 2 - s * sgn * ew_yaw),
            (c_ew, 1, 0, 22.6, ew(22.6, sgn), PI / 2 - s * sgn * ew_yaw),
            (c_ns, 2, 0, nsx(15.9), sgn * 15.9, s * sgn * ns_yaw), (c_ns, 2, 1, nsx(23.3), sgn * 23.3, s * sgn * ns_yaw),
        ]
        for ch, adj, turn, x, dz, yaw in slots:
            name = f"bridge{len(bridges)}"
            # `adj`: which two islands it joins, of this half and this end; `turn`: which of the pair's two it is; `alone`: the pair has no other.
            bridges.append({"name": name, "half": half, "channel": ch, "adj": half * 6 + (0 if sgn < 0 else 3) + adj, "turn": turn, "alone": adj == 1,
                            "x": round(s * x, 3), "z": round(Z(dz), 3), "yaw": round(yaw, 4), "w": BRIDGE_W, "len": BRIDGE_L})
            A.back(name)
            A.put("bridge", s * x, Z(dz), yaw=yaw, scale=1.0)

A.extra["forge"] = {
    "hx": HX, "hn": HN, "hs": HS, "chan": CHAN, "gx": GX, "gs": GS, "lava": LAVA,
    "gates": [Z(g) for g in GATES], "gateHalf": GATE_HALF, "isle": {"hx": ISLE_X, "hz": ISLE_Z},
    "hold": [{"x": x, "z": z} for x, z in HOLD], "pillars": [list(p) for p in PILLARS], "vents": [list(v) for v in VENTS], "slag": [list(v) for v in SLAG],
    "ventR": VENT_R, "greatVentR": GREAT_R, "channels": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in c.items()} for c in channels], "bridges": bridges,
}

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0])
