"""The Sunburst: the Heart of Noon's boss room for a party of up to 40 (user, 2026-11-11: "what if the arena is not like
a round arena, let's just forget all and let's make boss room"). The place under the hall where the sun fell: a crater
in the shape of the sun itself, cut into dark stone. Not a ring, and not the Hall of Noon's cross.

    the well     round, 18 m to its rim, the Heart floating over its middle: where the fight is
    the rays     eight bays, 11.6 m wide, cut straight out from the well to 34 m, one every 45 degrees. The south one is
                 the party's way in (a gate's passage at its end), the north one ends in the alcove of the way out,
                 under the keepers' sun sign
    the spurs    the stone left between two rays, each ending in a blunt nose on the well's rim

Why a sun: everything the Heart does runs outward from the middle. In this shape every ray is a straight lane from the
Heart to an end wall, so its rings, beams and rays run the whole length of each, and no wall ever stands between the
Heart and a hero: the only shelter from its beat is what the party raises. The spurs split a party into eight bays that
do not see each other. And its fight is all eights: the Crown of Rays fires down four bays and then the other four,
Solar Flare opens one half of every bay, a crust plate falls in front of each spur's nose.

Cover that fits the fight: in each bay a piece of the fallen armillary lies across half its width. The rings' beams
stop at it (the Heart's beat, which comes from above, does not). The walls are the stone the crater is cut from: 1.3 m
on the camera's side (it looks over them), stepping up to 9.5 and 13 m to the north, with lit lantern niches and gold
lines. The room's own walls are obstacles that never break (`fixed`). Run:
    blender --background --factory-startup --python blender/arenas/real/sunburst.py [-- <check picture path>]
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from kit import Arena, wall  # noqa: E402

PI, TAU = math.pi, math.tau
A = Arena("sunburst")
V = Vector
CX, CZ = 0.0, 7.0
# The sun: how many rays, the well's radius, half a ray's width, how far a ray reaches, how far the stone goes.
N, WELL, W, LEN, OUT = 8, 18.0, 5.8, 34.0, 62.0
# The gate's passage (half its width), and how deep the alcove at the north end is.
GATE, ALCOVE = 3.2, 41.0
# Where a ray's walls meet the well's rim, along its axis.
MOUTH = math.sqrt(WELL * WELL - W * W)
# The fallen armillary's pieces: how far out they lie, and from where to where across the bay.
ARC_AT, ARC_FROM, ARC_TO = 22.5, 1.95, 4.95
LOW, MID, HIGH, TOP, END = 1.3, 6.5, 9.5, 13.0, 11.0
# The shelf: how wide the low step is on a spur that has floor to its north.
SHELF = 5.0

A.mat("stone", "#2c3140", rough=0.85)
A.mat("slate", "#3a4052", rough=0.8)
A.mat("lacquer", "#1d1b21", rough=0.45)
A.mat("gold", "#c9a24a", rough=0.32, metal=0.85)
A.mat("scorch", "#6e2a18", rough=0.7)                  # the arena's own colour: the stone the falling sun burnt red
A.mat("glow", "#ffcf80", rough=0.4, emit="#ffb03a", strength=1.0)


def axis(k):
    """Ray `k`'s direction out from the Heart and the direction across it (toward ray k + 1), in the game's (x, z).
    Ray 0 runs south, to the camera."""
    a = k * TAU / N
    return (math.sin(a), math.cos(a)), (math.cos(a), -math.sin(a))


def B(k, along, lat=0.0):
    """The game's (x, z) of a spot `along` ray `k` from the Heart and `lat` across it."""
    (ux, uz), (vx, vz) = axis(k)
    return CX + ux * along + vx * lat, CZ + uz * along + vz * lat


def facing(dx, dz):
    """The yaw that turns a prop built looking along +y to look along the game's (dx, dz)."""
    return math.atan2(-dx, -dz)


def solid(f, key, pts):
    """A clean faceted solid: the hull of the points."""
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


def clip(poly, p0, n):
    """The part of a convex outline on the side of the line through `p0` that `n` points to."""
    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        da = (a[0] - p0[0]) * n[0] + (a[1] - p0[1]) * n[1]
        db = (b[0] - p0[0]) * n[0] + (b[1] - p0[1]) * n[1]
        if da >= 0:
            out.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def shrunk(poly, d):
    """A convex outline with `d` metres taken off every side: what is left may have fewer corners."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    s = 1.0 if area > 0 else -1.0
    out = poly
    for i in range(n):
        (ax, az), (bx, bz) = poly[i], poly[(i + 1) % n]
        dx, dz = bx - ax, bz - az
        ln = math.hypot(dx, dz)
        nx, nz = -s * dz / ln, s * dx / ln
        out = clip(out, (ax + nx * d, az + nz * d), (nx, nz))
    return out


# ---- props, in metres, standing on z = 0; +y looks into the room -----------------------------------------------------
def arc():
    """A piece of the fallen armillary: a thick gold band lying across the floor, a little bowed, its foot burnt, rune
    studs of dark stone let into its back. Built along x."""
    f = A.fig()
    half, bow, n = (ARC_TO - ARC_FROM) / 2 + 0.5, 9.0, 6
    st = []
    for i in range(n + 1):
        x = -half + 2 * half * i / n
        st.append((x, math.sqrt(bow * bow - x * x) - bow))
    for (x0, y0), (x1, y1) in zip(st, st[1:]):
        solid(f, "gold", [(x, y + sy * w, z) for x, y in ((x0, y0), (x1, y1)) for sy in (-1, 1) for w, z in ((0.5, 0.0), (0.36, 1.0))])
        solid(f, "scorch", [(x, y + sy * 0.57, z) for x, y in ((x0, y0), (x1, y1)) for sy in (-1, 1) for z in (0.0, 0.15)])
    for i in (1, 3, 5):
        x, y = st[i]
        f.box("lacquer", (x, y, 1.02), (0.5, 0.42, 0.08))
    A.built("arc", f, bevel=0.015)


def lantern(key, tall):
    """A lantern of the Heart's keepers, as in its room for two: a basalt post, a gold cap, a caged sun."""
    f = A.fig()
    f.turned("stone", (0, 0, 0), (0, 0, 0.28), [(0, 0.5), (1, 0.44)], seg=6)
    f.turned("stone", (0, 0, 0.28), (0, 0, tall), [(0, 0.3), (1, 0.2)], seg=6)
    f.turned("gold", (0, 0, tall * 0.6), (0, 0, tall * 0.6 + 0.1), [(0, 0.27), (1, 0.27)], seg=6)
    f.turned("gold", (0, 0, tall), (0, 0, tall + 0.12), [(0, 0.22), (1, 0.34)], seg=6)
    f.ellipsoid("glow", (0, 0, tall + 0.52), (0.19, 0.19, 0.25), seg=(12, 8))
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        f.tube("gold", [(0.3 * math.cos(a), 0.3 * math.sin(a), tall + 0.12), (0.34 * math.cos(a), 0.34 * math.sin(a), tall + 0.52), (0, 0, tall + 0.98)],
               [0.024, 0.024, 0.014], seg=5)
    f.turned("gold", (0, 0, tall + 0.95), (0, 0, tall + 1.3), [(0, 0.07), (1, 0.006)], seg=6)
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


def pilaster(key, h):
    f = A.fig()
    f.box("stone", (0, 0, 0.25), (1.5, 0.7, 0.5))
    f.box("slate", (0, 0, 0.5 + (h - 1.2) / 2), (1.0, 0.5, h - 1.2))
    f.box("gold", (0, 0, h - 0.55), (1.4, 0.7, 0.3))
    A.built(key, f, bevel=0.012)


def sign():
    """The keepers' sun sign for the alcove's back wall: the armillary whole, three rings round a lit disc, eight rays."""
    f = A.fig()
    f.torus("gold", (0, 0.3, 0), 2.55, 0.2, normal=(0, 1, 0), seg=(56, 8))
    f.torus("scorch", (0, 0.22, 0), 2.05, 0.09, normal=(0, 1, 0), seg=(48, 6))
    f.torus("gold", (0, 0.42, 0), 1.75, 0.1, normal=(0.45, 1, 0.25), seg=(44, 6))
    f.torus("gold", (0, 0.42, 0), 1.45, 0.08, normal=(-0.4, 1, -0.5), seg=(40, 6))
    f.turned("glow", (0, 0.12, 0), (0, 0.2, 0), [(0, 0.95), (1, 0.95)], seg=28)
    for k in range(8):
        a, far = k * TAU / 8, (3.75 if k % 2 == 0 else 3.3)
        c, s = math.cos(a), math.sin(a)
        solid(f, "gold", [(c * 2.85 + s * 0.26, 0.14, s * 2.85 - c * 0.26), (c * 2.85 - s * 0.26, 0.14, s * 2.85 + c * 0.26), (c * 2.85, 0.4, s * 2.85), (c * far, 0.14, s * far)])
    A.built("sign", f, bevel=0.012)


def ray():
    """A ray of its crown, snapped off: a long gold blade, built lying along +y."""
    f = A.fig()
    solid(f, "gold", [(-0.55, 0, 0), (0.55, 0, 0), (0, 0, 1.0), (0, 0.4, 0.5), (0, 9.5, 0.12)])
    solid(f, "scorch", [(-0.62, -0.05, 0), (0.62, -0.05, 0), (0, -0.05, 1.1), (-0.55, 0.5, 0), (0.55, 0.5, 0), (0, 0.5, 1.0)])
    A.built("ray", f, bevel=0.01)


arc(); sign(); ray()
lantern("lantern", 1.0)
lantern("post", 1.9)
niche("niche", 3.2)
niche("niche_tall", 4.6)
pilaster("pilaster", 9.0)
pilaster("pilaster_mid", 6.0)


# ---- the layout ------------------------------------------------------------------------------------------------------
def fixed(p, q, height):
    """A stretch of the room's own wall: an obstacle that never breaks, with no mesh of its own (the stone is the backdrop)."""
    A.cover(dict(wall(p[0], p[1], q[0], q[1], 0.6, height), fixed=True))


# How high the spur after ray k stands (between rays k and k + 1). "step": low along the ray to its north, MID behind.
SPUR = [LOW, LOW, "step", HIGH, HIGH, "step", LOW, LOW]
# How high the stone past each ray's end stands.
CAP = [LOW, LOW, MID, HIGH, END, HIGH, MID, LOW]


def side_height(k, sign_):
    """The height of ray `k`'s wall on the side `sign_` (+1 toward ray k + 1)."""
    s = SPUR[k if sign_ > 0 else (k - 1) % N]
    if s != "step":
        return s
    # The stepped spurs are MID along the east and west rays, and low along the rays north of them.
    return MID if k in (2, 6) else LOW


# The fallen armillary's pieces, one in each bay, on alternate sides: the only cover the room has.
for k in range(N):
    s = 1 if k % 2 == 0 else -1
    (ax, az), (bx, bz) = B(k, ARC_AT, s * ARC_FROM), B(k, ARC_AT, s * ARC_TO)
    A.cover(wall(ax, az, bx, bz, 0.5, 1.0))
    mx, mz = B(k, ARC_AT, s * (ARC_FROM + ARC_TO) / 2)
    A.put("arc", mx, mz, yaw=k * TAU / N, scale=1.0)

# The room's own walls, round the sun (they never break).
for k in range(N):
    for s in (-1, 1):
        fixed(B(k, MOUTH, s * W), B(k, LEN, s * W), side_height(k, s))
    if k in (0, N // 2):
        # The way in and the way out: a gate's passage through the end wall. The ring ends the south one; the north one is an alcove.
        for s in (-1, 1):
            fixed(B(k, LEN, s * W), B(k, LEN, s * GATE), CAP[k])
            fixed(B(k, LEN, s * GATE), B(k, ALCOVE, s * GATE), CAP[k])
        if k:
            fixed(B(k, ALCOVE, -GATE), B(k, ALCOVE, GATE), CAP[k])
    else:
        fixed(B(k, LEN, -W), B(k, LEN, W), CAP[k])
    # The spur's nose on the well's rim.
    fixed(B(k, MOUTH, W), B((k + 1) % N, MOUTH, -W), LOW if SPUR[k] == "step" else SPUR[k])

# ---- the stone the crater is cut from, and what is on its walls ------------------------------------------------------
A.back()
masses = 0


def mass(poly, h, z0=0.0):
    """A block of the stone over a convex outline, `h` high: a gold line under its top, burnt red at its foot."""
    global masses
    f = A.fig()
    prism(f, "stone", poly, z0, z0 + h - 0.1)                     # under its cap: two tops in one plane would flicker
    prism(f, "gold", grown(poly, 0.12), z0 + h - 0.34, z0 + h - 0.2)
    prism(f, "lacquer", grown(poly, 0.05), z0 + h - 0.2, z0 + h)
    prism(f, "scorch", grown(poly, 0.08), z0, z0 + 0.32)
    key = f"mass{masses}"
    masses += 1
    A.built(key, f)
    A.put(key, 0, 0, scale=1.0)


def spur(k):
    """The outline of the spur after ray k: its nose on the well's rim, widening out to where the stone ends."""
    j = (k + 1) % N
    return [B(k, MOUTH, W), B(j, MOUTH, -W), B(j, OUT, -W), B(k, OUT, W)]


for k in range(N):
    poly = spur(k)
    if SPUR[k] == "step":
        # Low all over, and MID only behind a shelf along the ray to its north: the camera must see that ray's floor.
        north = 3 if k == 2 else 5
        (vx, vz) = axis(north)[1]
        back = clip(poly, B(north, 0, -(W + SHELF)) if k == 2 else B(north, 0, W + SHELF), (-vx, -vz) if k == 2 else (vx, vz))
        mass(poly, LOW)
        mass(back, MID - LOW, LOW)
    elif SPUR[k] == HIGH:
        mass(poly, HIGH)
        mass(shrunk(poly, 4.5), TOP - HIGH, HIGH)
    else:
        mass(poly, LOW)

for k in range(N):
    h = CAP[k]
    if k in (0, N // 2):
        for s in (-1, 1):
            lo, hi = sorted((s * GATE, s * W))
            mass([B(k, LEN, lo), B(k, LEN, hi), B(k, OUT, hi), B(k, OUT, lo)], h)
        if k:
            mass([B(k, ALCOVE, -GATE), B(k, ALCOVE, GATE), B(k, OUT, GATE), B(k, OUT, -GATE)], h)
    else:
        poly = [B(k, LEN, -W), B(k, LEN, W), B(k, OUT, W), B(k, OUT, -W)]
        mass(poly, h)
        if h == HIGH:
            mass(shrunk(poly, 4.5), TOP - HIGH, HIGH)


def lamp(key, k, along, lat, base, flame, kind="lantern"):
    x, z = B(k, along, lat)
    A.put(key, x, z, scale=1.0, y=base)
    A.mark(kind, x, z, base + flame)


def wall_niche(key, k, along, s, flame):
    """A niche on ray k's wall on side `s`, looking into the bay."""
    (vx, vz) = axis(k)[1]
    x, z = B(k, along, s * (W + 0.02))
    A.put(key, x, z, yaw=facing(-s * vx, -s * vz), scale=1.0)
    lx, lz = B(k, along, s * (W - 0.45))
    A.mark("lamp", lx, lz, flame)


def wall_pilaster(key, k, along, s):
    (vx, vz) = axis(k)[1]
    x, z = B(k, along, s * (W - 0.15))
    A.put(key, x, z, yaw=facing(-s * vx, -s * vz), scale=1.0)


# The keepers' lanterns on the low stone: three along the middle of each low spur, and along the two shelves.
for k in (0, 1, 6, 7):
    a = (k + 0.5) * TAU / N
    for r in (21.5, 27.0, 32.5):
        x, z = CX + math.sin(a) * r, CZ + math.cos(a) * r
        A.put("lantern", x, z, scale=1.0, y=LOW)
        A.mark("lantern", x, z, LOW + 1.52)
for k, s in ((3, -1), (5, 1)):
    for along in (22.5, 27.5, 32.5):
        lamp("lantern", k, along, s * (W + 2.4), LOW, 1.52)
# Beside the gate's passage, on the low stone.
for s in (-1, 1):
    lamp("post", 0, LEN + 1.6, s * (GATE + 1.5), LOW, 2.42)

# Lit niches and pilasters on the tall walls: the east and west rays' north sides, the four northern rays, the alcove.
for k, s in ((2, 1), (6, -1)):
    for along in (23.5, 28.0, 32.5):
        wall_niche("niche", k, along, s, 3.3)
    for along in (25.75, 30.25):
        wall_pilaster("pilaster_mid", k, along, s)
for k, s in ((3, 1), (4, -1), (4, 1), (5, -1)):
    for along in (20.0, 24.5, 29.0, 33.3):
        wall_niche("niche_tall", k, along, s, 4.1)
    for along in (22.25, 26.75, 31.15):
        wall_pilaster("pilaster", k, along, s)
for k in (2, 3, 5, 6):
    # The end walls the camera sees.
    (ux, uz) = axis(k)[0]
    for lat in ((-2.9, 2.9) if k in (3, 5) else (0.0,)):
        x, z = B(k, LEN + 0.02, lat)
        A.put("niche_tall" if k in (3, 5) else "niche", x, z, yaw=facing(-ux, -uz), scale=1.0)
        A.mark("lamp", *B(k, LEN - 0.45, lat), 4.1 if k in (3, 5) else 3.3)
for s in (-1, 1):
    x, z = B(4, LEN + 0.02, s * (GATE + 1.3))
    A.put("niche_tall", x, z, yaw=facing(0, 1), scale=1.0)
    A.mark("lamp", *B(4, LEN - 0.45, s * (GATE + 1.3)), 4.1)

# The alcove: the keepers' sun sign over the way out.
x, z = B(4, ALCOVE - 0.05, 0)
A.put("sign", x, z, yaw=facing(0, 1), scale=1.0, y=7.3)
A.mark("beacon", *B(4, ALCOVE - 0.6, 0), 7.3)

# What broke off the Heart as it fell: rays of its crown, lying on the northern terraces and across the low stone.
for k, r, turn, y, tilt in ((3, 30.0, 0.5, HIGH, 0.0), (4, 38.0, 2.4, HIGH, 0.0), (2, 47.0, 1.9, MID, 0.0), (5, 44.0, -1.2, MID, 0.0), (6, 40.0, 0.7, LOW, 0.0)):
    a = (k + 0.5) * TAU / N
    A.put("ray", CX + math.sin(a) * r, CZ + math.cos(a) * r, yaw=turn, scale=1.0, y=y, tilt=(tilt, 0.0))

A.finish()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    A.render(args[0])
