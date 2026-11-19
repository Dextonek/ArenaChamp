"""
The Fallen Battlefield's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special", then "Yes, do
the rest"): a great trebuchet of the old war, standing on a far ridge of the Field of Banners. Its arm winds back slowly on the
windlass, then whips over and throws a stone that arcs far off out of sight; a torn banner of the field's blue hangs on its frame
(posed in code, src/arenas/landmarks/trebuchet.ts).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned and boxed timbers, smooth shading, the heroes' palette plus
the field's own banner blue, a thin gold line on the bands and rims. With the bosses' toolkit for its parts:
trebuchet > frame, windlass, arm > (weight, sling), stone, flag1 > flag2. Faces -Y (the broadside toward the ring), throws toward -X
(the model's right), z up, metres; z = 0 is the ground. The arm is built cocked: the long end down at the rear (+X), the counterweight
up at the front end of the short arm, the sling lying back along the trough with the stone in it.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- trebuchet
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, T
from boss_wyrm import cone, panel, plate, seg

HEIGHT = 10.0
HERO_X = -7.0
VIEW = 0.7

# The machine in numbers (the pose in src/arenas/landmarks/trebuchet.ts uses the same ones). D is the throwing side: -1 = toward -X.
D = -1
H = 5.4            # the axle's height
ALPHA = math.radians(36)   # the cocked arm: long end this far below the horizontal, at the rear
LONG, SHORT = 6.4, 1.8     # arm lengths from the axle
SLING = 4.0        # the rope
STONE_R = 0.46


def P(x, y, z):
    """A point given as for a machine that throws toward +X, put on the throwing side D."""
    return Vector((D * x, y, z))


def beam(part, a, b, w, m, up=(0, 0, 1)):
    """A squared timber from a to b, `w` thick, its edges lightly chamfered."""
    a, b = Vector(a), Vector(b)
    d = b - a
    u = Vector(up)
    if abs(d.normalized().dot(u)) > 0.95:
        u = Vector((1, 0, 0))
    plate(part, (a + b) / 2, d, u, (w, d.length, w), m, taper=(1.0, 1.0), bevel=0.04)


def build_trebuchet():
    B = Boss("trebuchet", 11.0)
    B.smooth = True
    wood = B.m("wood", "#4a3220", 0.0, 0.7)
    plank = B.m("plank", "#6b4226", 0.0, 0.75)
    iron = B.m("iron", "#3c3f47", 0.75, 0.42)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    blue = B.m("blue", "#2a4a7a", 0.0, 0.6)
    rope = B.m("rope", "#b89a5a", 0.0, 0.9)
    stone = B.m("stone", "#2c3140", 0.0, 0.85)
    cream = B.m("cream", "#d8cfb4", 0.0, 0.8)

    # ---- the frame: base rails, two A-frames, the axle, the windlass posts, the stone's trough, the banner pole -----------------
    fr = B.part("frame", (0, 0, 0))
    for y in (-1.55, 1.55):
        beam(fr, P(-4.6, y, 0.28), P(4.6, y, 0.28), 0.5, wood)
        # the A-frame: two raking legs, a cross-tie, a lower brace
        beam(fr, P(-3.5, y, 0.4), P(0.0, y, H + 0.45), 0.42, wood)
        beam(fr, P(3.5, y, 0.4), P(0.0, y, H + 0.45), 0.42, wood)
        beam(fr, P(-1.75, y, 2.9), P(1.75, y, 2.9), 0.3, plank)
        beam(fr, P(-3.0, y, 0.7), P(0.9, y, 3.6), 0.2, plank)
        # a plate of iron on the apex, gold on its rim
        fr.chunk((0.9, 0.2, 0.9), iron, at=(D * 0.0, y + (-0.28 if y < 0 else 0.28), H), bevel=0.05)
    for x in (-4.1, 4.1):
        beam(fr, P(x, -1.55, 0.3), P(x, 1.55, 0.3), 0.45, wood, up=(1, 0, 0))
    beam(fr, P(-1.8, -1.55, 0.3), P(-1.8, 1.55, 0.3), 0.35, plank, up=(1, 0, 0))
    # the axle, with gold collars outside each frame
    seg(fr, P(0, -2.3, H), P(0, 2.3, H), 0.24, 0.24, iron, sides=14)
    for y in (-2.1, -1.8, 1.8, 2.1):
        seg(fr, P(0, y - 0.05, H), P(0, y + 0.05, H), 0.31, 0.31, gold, sides=14)
    # the windlass' posts and the trough the stone lies in (the rear), two rails with rope-lashed ends
    for y in (-1.55, 1.55):
        beam(fr, P(-3.8, y, 0.4), P(-3.8, y, 1.4), 0.3, wood)
        beam(fr, P(-5.2, y * 0.45, 0.1), P(-9.9, y * 0.45, 0.1), 0.3, plank)
        beam(fr, P(-4.6, y, 0.3), P(-5.2, y * 0.45, 0.1), 0.26, plank)
    for x in (-6.6, -9.0):
        beam(fr, P(x, -0.9, 0.08), P(x, 0.9, 0.08), 0.22, wood, up=(1, 0, 0))
    # the banner's pole stands on the front frame's apex; a gold point on top and a cross-bar for the cloth
    seg(fr, P(0, -1.75, H + 0.4), P(0, -1.75, 9.9), 0.15, 0.1, wood, sides=10)
    cone(fr, P(0, -1.75, 9.85), P(0, -1.75, 10.6), 0.17, gold, sides=8)
    seg(fr, P(-1.1, -1.75, 9.35), P(1.1, -1.75, 9.35), 0.08, 0.08, wood, sides=8)
    for x in (-1.1, 1.1):
        fr.rock(P(x, -1.75, 9.35), (0.12, 0.12, 0.12), gold, n=8, rough=0.0)
    fr.finish()

    # ---- the windlass: a drum between the posts with its hand-spikes; it turns as the arm is wound back -------------------------
    WX, WZ = -3.8, 1.3
    wl = B.part("windlass", P(WX, 0, WZ), "trebuchet")
    seg(wl, P(WX, -1.4, WZ), P(WX, 1.4, WZ), 0.45, 0.45, wood, sides=14)
    for y in (-1.4, 1.4):
        seg(wl, P(WX, y - 0.06, WZ), P(WX, y + 0.06, WZ), 0.52, 0.52, gold, sides=14)
    for y in (-0.8, 0.8):
        for a in (0.0, math.pi / 2):
            d = Vector((math.cos(a), 0, math.sin(a)))
            beam(wl, Vector((D * WX, y, WZ)) - d * 1.0, Vector((D * WX, y, WZ)) + d * 1.0, 0.16, plank)
    wl.finish()

    # ---- the arm: built cocked. Long end down at the rear, the short end up at the front -----------------------------------------
    ca, sa = math.cos(ALPHA), math.sin(ALPHA)
    P0 = P(0, 0, H)
    tip = P(-LONG * ca, 0, H - LONG * sa)
    short = P(SHORT * ca, 0, H + SHORT * sa)
    arm = B.part("arm", P0, "trebuchet")
    seg(arm, P0, tip, 0.46, 0.2, wood, sides=14)
    seg(arm, P0, short, 0.46, 0.38, wood, sides=14)
    for k in (0.18, 0.45, 0.75):
        c = P0.lerp(tip, k)
        r = 0.46 + (0.2 - 0.46) * k
        seg(arm, c - (tip - P0).normalized() * 0.07, c + (tip - P0).normalized() * 0.07, r + 0.07, r + 0.07, gold, sides=14)
    # an iron collar and a ring at the tip, a block of iron over the axle, an iron cap on the short end
    seg(arm, tip + (P0 - tip).normalized() * 0.5, tip, 0.27, 0.27, iron, sides=12)
    arm.rock(tip, (0.2, 0.2, 0.2), iron, n=10, rough=0.0)
    arm.chunk((0.8, 0.8, 0.8), iron, at=tuple(P0), bevel=0.06)
    arm.rock(short, (0.34, 0.34, 0.34), iron, n=12, rough=0.0)
    arm.finish()

    # the counterweight: a stone box with iron straps and a gold rim, hung from the short end on two rods so it stays upright
    wt = B.part("weight", short, "arm")
    top = short.z - 1.2
    cx = short.x
    for y in (-0.85, 0.85):
        seg(wt, Vector((cx, y, short.z)), Vector((cx, y, top)), 0.07, 0.07, iron, sides=8)
    seg(wt, Vector((cx, -0.95, short.z)), Vector((cx, 0.95, short.z)), 0.1, 0.1, iron, sides=8)
    wt.chunk((1.9, 2.0, 2.0), stone, at=(cx, 0, top - 1.0), bevel=0.1)
    for dz in (-0.3, -1.7):
        wt.chunk((2.02, 2.12, 0.16), iron, at=(cx, 0, top + dz), bevel=0.03)
    wt.chunk((2.06, 2.16, 0.06), gold, at=(cx, 0, top - 0.02), bevel=0.02)
    wt.finish()

    # the sling: a rope from the tip back to where the stone lies (S0), a leather pouch at its end
    S0 = P(-LONG * ca - 3.822, 0, 0.45)       # LONG*ca + 3.822 = the stone's x behind the axle: tip + 4.0 m of rope
    sl = B.part("sling", tip, "arm")
    seg(sl, tip, S0, 0.06, 0.06, rope, sides=6)
    pd = (S0 - tip).normalized()
    sl.lathe([(-0.03, 0.46), (0.05, 0.44), (0.12, 0.3), (0.14, 0.0)], cream, sides=14,
             xf=T(*S0) @ pd.to_track_quat("Z", "Y").to_matrix().to_4x4() @ T(0, 0, -0.2))
    sl.finish()

    # the stone: a great round shot with a thin gold band round it
    st = B.part("stone", S0, "trebuchet")
    st.rock(tuple(S0), (STONE_R, STONE_R, STONE_R), stone, n=40, rough=0.0)
    seg(st, S0 + Vector((0, -0.05, 0)), S0 + Vector((0, 0.05, 0)), STONE_R * 1.02, STONE_R * 1.02, gold, sides=24)
    st.finish()

    # ---- the banner: blue cloth hung from the cross-bar, torn off in three tails of different length ------------------------------
    f1 = B.part("flag1", P(0, -1.8, 9.35), "trebuchet")
    y = -1.82
    panel(f1, [P(-1.0, y, 9.3), P(1.0, y, 9.3), P(1.0, y, 7.7), P(-1.0, y, 7.7)], blue, th=0.035)
    seg(f1, P(-1.0, y - 0.02, 9.3), P(1.0, y - 0.02, 9.3), 0.05, 0.05, gold, sides=6)
    seg(f1, P(-1.0, y - 0.02, 9.3), P(-1.0, y - 0.02, 7.75), 0.035, 0.035, gold, sides=5)
    seg(f1, P(1.0, y - 0.02, 9.3), P(1.0, y - 0.02, 7.75), 0.035, 0.035, gold, sides=5)
    f1.finish()
    f2 = B.part("flag2", P(0, -1.8, 7.7), "flag1")
    panel(f2, [P(-1.0, y, 7.7), P(-0.3, y, 7.7), P(-0.55, y, 6.0), P(-0.95, y, 5.5)], blue, th=0.035)   # the left tail, ragged
    panel(f2, [P(-0.3, y, 7.7), P(0.4, y, 7.7), P(0.05, y, 6.6)], blue, th=0.035)                        # the middle, torn short
    panel(f2, [P(0.4, y, 7.7), P(1.0, y, 7.7), P(1.0, y, 5.0), P(0.7, y, 5.7)], blue, th=0.035)          # the right tail, longest
    f2.finish()
    return B


def register():
    bb.BUILD["trebuchet"] = build_trebuchet
