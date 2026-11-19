"""
The Crystal Cavern's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): the Last
Light, a giant geode split open in the cavern's wall. When the sun fell its light ran down into the crystals of the Deep and hid
there: three veins of gold run down the rock from far above into the geode's mouth, and the amethyst grown inside it holds that
light, pulsing slowly from the top down. A few small crystals on the floor in front of it grow and settle (posed in code,
src/arenas/landmarks/geode.ts).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned forms, smooth shading, the heroes' palette plus the
cavern's own amethyst, a thin gold line on the lip, and the glow only where it matters (the crystals and the veins). With the
bosses' toolkit: geode > shell, vein1..vein3, core, crystal1..crystal6, grow1..grow3. Every glowing part has a material of its own
because the game scales a material's glow for the whole part. Faces -Y (toward the ring), z up, metres; z = 0 is the cave floor. The
mouth tilts a little up, toward the game's high camera.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- geode
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, _limb_xf
from boss_wyrm import S, seg

HEIGHT = 30.0
HERO_X = -10.0
VIEW = 0.5

TILT = -0.35
SC = 1.25                                # the geode is built at this size against the pillar
M = T(0, 0, 9.0) @ R(TILT, 0, 0) @ S(SC, SC, SC)       # the geode's own frame: its axis +Y runs into the wall, its mouth faces -Y

# the pillar the geode sits in: where its front stands at each height (a bastion's profile, as the canyon's, in the cave's dark rock)
PIL = dict(cy=14.5, rx=14.0, ry=8.0, h=31.0, z0=-3.0)
PROF = [(0.0, 1.12), (0.1, 1.06), (0.28, 0.92), (0.4, 0.9), (0.56, 1.0), (0.66, 0.99), (0.82, 0.9), (0.93, 0.68), (0.985, 0.34), (1.0, 0.06)]
# the lining's inner surface: (depth, radius) from the lip to the back
INNER = [(0.5, 6.0), (2.0, 5.6), (3.6, 4.6), (4.5, 2.6), (4.6, 0.0)]


def front_y(z):
    """Where the pillar's front face stands at height z."""
    t = (z - PIL["z0"]) / (PIL["h"] - PIL["z0"])
    for (t0, r0), (t1, r1) in zip(PROF, PROF[1:]):
        if t0 <= t <= t1:
            r = r0 + (r1 - r0) * (t - t0) / (t1 - t0)
            return PIL["cy"] - PIL["ry"] * r
    return PIL["cy"]


def inner_r(d):
    for (d0, r0), (d1, r1) in zip(INNER, INNER[1:]):
        if d0 <= d <= d1:
            return r0 + (r1 - r0) * (d - d0) / (d1 - d0)
    return INNER[0][1] if d < INNER[0][0] else 0.0


def build_geode():
    B = Boss("geode", 30.0)
    B.smooth = True
    rock = B.m("rock", "#3a3c4a", 0.0, 0.88)
    rock2 = B.m("rock2", "#2b2d3a", 0.0, 0.9)
    rind = B.m("rind", "#3d3547", 0.0, 0.8)
    cream = B.m("cream", "#cfc4d8", 0.0, 0.8)
    pale = B.m("pale", "#5e4f8c", 0.0, 0.6)
    agate = B.m("agate", "#a898cc", 0.0, 0.7)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)

    def amethyst(name, tone="#5b3a9c", em="#7a4be0", strength=1.0):
        return B.m(name, tone, 0.0, 0.35, emit=em, strength=strength)

    def P(v):
        return M @ Vector(v)

    def crystal(part, root, d, length, r, m):
        """A six-sided prism with a pointed tip, rooted at `root` and pointing along `d` (both in the geode's frame)."""
        d = Vector(d).normalized()
        p0, p1 = P(root), P(Vector(root) + d * length)
        L = length * SC
        r *= SC
        part.lathe([(0, r * 0.85), (L * 0.08, r), (L * 0.72, r), (L, 0.02)], m, sides=6, xf=_limb_xf(p0, p1), rot0=0.3)

    # ---- the shell: the pillar of dark rock, the geode's rind and chalcedony lining, a gold line round the lip, rocks about the lip ----
    sh = B.part("shell", (0, 5.0, 8.0), "geode")
    rings = [(PIL["z0"] + t * (PIL["h"] - PIL["z0"]), r) for t, r in PROF]
    mats = [rock2 if i in (2, 3, 6) else rock for i in range(len(rings) - 1)]
    sh.lathe(rings, mats, sides=26, rot0=0.4, xf=T(0, PIL["cy"], 0) @ S(PIL["rx"], PIL["ry"], 1.0))
    for cx, cy, rx, h, sd in ((-15.0, 17.0, 8.0, 24.0, 0.8), (15.0, 18.0, 8.0, 20.0, 1.5), (-24.0, 20.0, 8.0, 13.0, 2.1), (24.0, 21.0, 8.0, 11.0, 2.6)):
        rr = [(PIL["z0"] + t * (h - PIL["z0"]), r) for t, r in PROF]
        sh.lathe(rr, [rock if i not in (2, 3, 6) else rock2 for i in range(len(rr) - 1)], sides=22, rot0=sd, xf=T(cx, cy, 0) @ S(rx, 7.0, 1.0))
    # a lower step of rock round its foot, so the pillar stands in the cave floor
    sh.chunk((30.0, 14.0, 1.6), rock2, at=(0, 6.0, -0.4), bevel=0.5, taper=(0.92, 0.9))
    # the geode: a closed bowl (rind outside, lighter lining inside), turned about its axis
    bowl = [(-0.5, 6.3), (-0.5, 6.9), (1.0, 7.7), (3.0, 7.5), (5.0, 6.0), (6.4, 3.2), (7.0, 0.0),
            (4.6, 0.0), (4.5, 2.6), (3.6, 4.6), (2.0, 5.6), (0.5, 6.0)]
    bm = [cream, rind, rind, rind, rind, rind, rind, pale, pale, agate, agate, cream]
    sh.lathe(bowl, bm, sides=30, rot0=0.1, xf=M @ R(-math.pi / 2, 0, 0), loop=True)
    # the lip's thin gold line
    sh.lathe([(-0.45, 6.2), (-0.72, 6.3), (-0.72, 6.52), (-0.45, 6.62)], gold, sides=30, rot0=0.1, xf=M @ R(-math.pi / 2, 0, 0), loop=True)
    # rounded rocks round the lip, joining it to the pillar
    for k in range(12):
        a = k * math.tau / 12 + 0.2
        r = 7.9 + (k % 3) * 0.2
        sh.rock(P((r * math.cos(a), 0.9, r * math.sin(a))), ((1.5 + 0.25 * (k % 2)) * SC, 1.3 * SC, 1.5 * SC), rock if k % 2 else rock2, n=26, rough=0.0)
    sh.finish()

    # ---- the veins: three seams of the sun's light running down the rock into the mouth, one part each so the light can run -----
    paths = [[(2.0, 30.0), (0.6, 27.6), (1.5, 25.6)], [(1.5, 25.6), (0.2, 24.2), (-0.4, 22.8)], [(-0.4, 22.8), (-1.0, 21.8), (-0.3, 20.6)]]
    for i, path in enumerate(paths):
        m = B.m(f"vein{i + 1}", "#d9b25a", 0.0, 0.5, emit="#ffb03a", strength=1.2)
        vp = B.part(f"vein{i + 1}", (path[0][0], front_y(path[0][1]), path[0][1]), "geode")
        pts = [Vector((x, front_y(z) + 0.3, z)) for x, z in path]
        for a, b in zip(pts, pts[1:]):
            seg(vp, a, b, 0.36, 0.36, m, sides=6)
        # a short branch off the middle
        mid = pts[1]
        seg(vp, mid, mid + Vector((1.1 * (1 if i % 2 else -1), 0, -1.2)), 0.2, 0.08, m, sides=6)
        vp.finish()

    # ---- the crystals grown inside: a great one at the back, six clusters round the lining -------------------------------------
    core_m = amethyst("coremat", "#6a44b4", "#8a5cf0", 1.1)
    co = B.part("core", P((0, 3.6, 0)), "geode")
    crystal(co, (0.0, 4.4, 0.0), (0.0, -1.0, 0.12), 10.0, 1.4, core_m)
    crystal(co, (0.9, 4.2, 0.5), (0.35, -1.0, 0.2), 7.4, 0.9, core_m)
    crystal(co, (-0.8, 4.2, -0.4), (-0.4, -1.0, -0.05), 6.4, 0.8, core_m)
    co.finish()

    # six clusters, each at its own place round the lining and so its own height: the light reaches the top ones first
    spots = [(0.35, 1.3), (1.2, 2.6), (2.1, 1.0), (3.1, 2.8), (4.0, 1.5), (5.0, 2.7)]
    tones = [("#5b3a9c", "#7a4be0"), ("#7a56b8", "#9a6af0"), ("#4f3590", "#6e44d6")]
    for i, (phi, d) in enumerate(spots):
        t1, t2 = tones[i % 3]
        m = amethyst(f"crystal{i + 1}mat", t1, t2, 1.0)
        rad = Vector((math.cos(phi), 0, math.sin(phi)))
        cp = B.part(f"crystal{i + 1}", P(rad * inner_r(d) + Vector((0, d, 0))), "geode")
        for j, (dphi, dd, ln, rr) in enumerate(((0, 0, 6.4, 0.8), (0.28, 0.5, 4.6, 0.58), (-0.25, -0.4, 3.8, 0.5), (0.05, 0.3, 2.6, 0.38))):
            ph = phi + dphi
            rd = Vector((math.cos(ph), 0, math.sin(ph)))
            root = rd * inner_r(d + dd) + Vector((0, d + dd, 0))
            k = 0.45 + 0.5 * (1 - d / 4.6)
            crystal(cp, root, -rd * k + Vector((0, -1.0, 0.0)) + Vector((0, 0, 0.12 * j)), ln, rr, m)
        cp.finish()

    # ---- crystals on the cave floor in front of it, which grow a little and settle ------------------------------------------------
    for i, (x, y, h, r) in enumerate(((-6.4, -3.6, 3.4, 0.55), (6.8, -4.8, 2.8, 0.5), (1.6, -7.8, 2.2, 0.42))):
        m = amethyst(f"grow{i + 1}mat", tones[i % 3][0], tones[i % 3][1], 0.9)
        gp = B.part(f"grow{i + 1}", (x, y, 0.0), "geode")
        for dx, dy, hh, rr, lean in ((0, 0, h, r, 0.0), (0.7, 0.3, h * 0.6, r * 0.7, 0.22), (-0.6, 0.35, h * 0.45, r * 0.6, -0.25)):
            p0 = Vector((x + dx, y + dy, -0.1))
            seg_d = Vector((lean, 0.05, 1.0)).normalized()
            gp.lathe([(0, rr * 0.9), (hh * 0.07, rr), (hh * 0.7, rr), (hh, 0.02)], m, sides=6, xf=_limb_xf(p0, p0 + seg_d * hh), rot0=0.3)
        gp.finish()
    return B


def register():
    bb.BUILD["geode"] = build_geode
