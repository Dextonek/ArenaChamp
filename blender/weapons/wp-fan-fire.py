"""
wp-fan-fire: the Jade-Leaf Phoenix Fan (concept: C:\\projectG\\weapons\\fan_fire.png).
An open war fan of five pearl leaves, each with a jade heart and gold veins, held between six gold
ribs with dark inlay, jade beads and flame-shaped tips (the two outer guard ribs larger, ending in
curls). A jade gem in a gold lozenge at the pivot, a dark handle bound in gold with a jade gem at its
end, and a silk tassel.

Size: about 0.6 m tall, 0.62 m across when open; grip centred on the origin, the fan opening up +Z,
its face towards -Y.

VFX notes for later (not modelled): iridescent fire and wind ribbons (orange, cyan, white) sweeping
round the fan, glowing embers, a gust wave on each swing, the gems pulsing.
"""
import math

from mathutils import Matrix, Vector

import kit
import _azure_common as az
import _treasure_common as tc
import _wp

WID = "wp-fan-fire"
PIVOT = Vector((0, 0, 0.115))
RIBS = [-75, -45, -15, 15, 45, 75]       # rib angles from vertical (degrees, + towards +X)
LEAVES = [-60, -30, 0, 30, 60]


def polar(a_deg, r, v=0.0, y=0.0):
    """A point r out from the pivot along angle a (from +Z towards +X), v across to the right."""
    a = math.radians(a_deg)
    d = Vector((math.sin(a), 0, math.cos(a)))
    s = Vector((math.cos(a), 0, -math.sin(a)))
    return PIVOT + d * r + s * v + Vector((0, y, 0))


def leaf_outline(a, r0, r1, W, n=18):
    pts = []
    for i in range(n + 1):           # up the right side
        u = i / n
        hw = W * math.sin(math.pi * min(u * 0.92 + 0.04, 1.0)) ** 0.75 * (1 - 0.25 * u)
        p = polar(a, r0 + (r1 - r0) * u, hw)
        pts.append((p.x, p.z))
    for i in range(n - 1, 0, -1):    # and back down the left
        u = i / n
        hw = W * math.sin(math.pi * min(u * 0.92 + 0.04, 1.0)) ** 0.75 * (1 - 0.25 * u)
        p = polar(a, r0 + (r1 - r0) * u, -hw)
        pts.append((p.x, p.z))
    return pts


def leaves(m):
    parts = []
    for k, a in enumerate(LEAVES):
        y = 0.0012 * (k - 2)          # overlapping slightly, like folded paper
        r0, r1, W = 0.06, 0.33, 0.08
        parts.append(kit.extrude_shape(f"leaf{k}", leaf_outline(a, r0, r1, W), 0.003, m["pearl"], centre=(0, y, 0)))
        for s in (1, -1):
            yy = y + s * 0.0018
            parts.append(kit.extrude_shape(f"heart{k}{s}", leaf_outline(a, r0 + 0.03, r1 - 0.06, W * 0.55), 0.0006, m["jade"],
                                           centre=(0, yy, 0)))
            rim = [Vector((x, yy + s * 0.0004, z)) for x, z in leaf_outline(a, r0, r1, W)]
            rim.append(rim[0])
            parts.append(kit.chain(f"rim{k}{s}", rim, [0.0013] * len(rim), m["gold"], seg=4))
            vein = [polar(a, r0 + (r1 - r0) * u, 0, yy + s * 0.0008) for u in (i / 9 * 0.92 for i in range(10))]
            parts.append(kit.chain(f"vein{k}{s}", vein, kit.lerp_list([0.0018, 0.0008], 10), m["gold"], seg=4))
            for j in range(4):
                u0 = 0.18 + j * 0.17
                for side in (1, -1):
                    pts = [polar(a, r0 + (r1 - r0) * (u0 + 0.09 * t), side * W * 0.62 * t ** 0.8, yy + s * 0.0008)
                           for t in (i / 5 for i in range(6))]
                    parts.append(kit.chain(f"sv{k}{s}{j}{side}", pts, kit.lerp_list([0.0011, 0.0005], 6), m["gold"], seg=4))
    return parts


def rib(m, a, k, big):
    parts = []
    g = 1.45 if big else 1.0
    L = 0.27

    def strip(w0, w1, r0, r1, n=8):
        right = [polar(a, r0 + (r1 - r0) * i / n, (w0 + (w1 - w0) * i / n) / 2) for i in range(n + 1)]
        left = [polar(a, r0 + (r1 - r0) * i / n, -(w0 + (w1 - w0) * i / n) / 2) for i in reversed(range(n + 1))]
        return [(p.x, p.z) for p in right + left]
    for s in (1, -1):
        y = s * 0.0042
        parts.append(kit.extrude_shape(f"rib{k}{s}", strip(0.013 * g, 0.009 * g, 0.0, L), 0.0034, m["gold"], bevel=0.0009,
                                       centre=(0, y, 0)))
        parts.append(kit.extrude_shape(f"inlay{k}{s}", strip(0.0055 * g, 0.004 * g, 0.03, L - 0.03), 0.0012, m["wood"],
                                       centre=(0, y + s * 0.0019, 0)))
        for r in (0.07, 0.15, 0.22):
            parts.append(kit.blob(f"bead{k}{s}{r}", polar(a, r, 0, y + s * 0.0028), (0.0042 * g, 0.0022, 0.0055 * g), m["gem"], segs=(10, 6)))
    # a flame-shaped tip at the top of the rib
    tip = [(0, 0), (0.012, 0.012), (0.009, 0.026), (0.016, 0.04), (0.006, 0.05), (0.004, 0.066), (0, 0.078),
           (-0.004, 0.066), (-0.006, 0.05), (-0.016, 0.04), (-0.009, 0.026), (-0.012, 0.012)]
    ol = []
    for v, u in tip:
        p = polar(a, L - 0.004 + u * g, v * g)
        ol.append((p.x, p.z))
    parts.append(kit.extrude_shape(f"tip{k}", ol, 0.007 * g, m["gold"], bevel=0.0012))
    for s in (1, -1):
        parts.append(kit.blob(f"tipgem{k}{s}", polar(a, L + 0.03 * g, 0, s * 0.0035 * g), (0.0055 * g, 0.0022, 0.008 * g), m["gem"], segs=(10, 6)))
    if big:
        # the guard ribs end in a scroll curling outward
        side = 1 if a > 0 else -1
        pts = []
        for i in range(20):
            u = i / 19
            ang = u * 1.6 * math.pi
            r = 0.022 * (1 - 0.65 * u)
            pts.append(polar(a, L - 0.03 + r * math.sin(ang) * 1.2, side * (0.012 + r * (1 - math.cos(ang)))))
        parts.append(kit.chain(f"curl{k}", pts, kit.lerp_list([(0.0045, 0.0055), (0.0025, 0.0035), (0.0012, 0.002)], 20),
                               m["gold"], seg=8, side=(0, 1, 0)))
    return parts


def pivot(m):
    parts = []
    loz = [(0, 0.032), (0.016, 0.018), (0.022, 0.0), (0.016, -0.02), (0, -0.034), (-0.016, -0.02), (-0.022, 0.0), (-0.016, 0.018)]
    for s in (1, -1):
        y = s * 0.0075
        parts.append(kit.extrude_shape(f"loz{s}", [(x, z + PIVOT.z) for x, z in loz], 0.004, m["gold"], bevel=0.0012, centre=(0, y, 0)))
        parts.append(kit.blob(f"pgem{s}", (0, s * 0.0105, PIVOT.z), (0.011, 0.0045, 0.016), m["gem"], segs=(16, 10)))
        parts.append(kit.torus(f"pbez{s}", (0, s * 0.0098, PIVOT.z), 0.0135, 0.0018, m["gold"], seg=(28, 6), axis=(0, 1, 0)))
        # small scroll wings beside the lozenge
        for sx in (1, -1):
            pts = kit.spline([(sx * 0.018, s * 0.0095, PIVOT.z + 0.012), (sx * 0.032, s * 0.0095, PIVOT.z + 0.02),
                              (sx * 0.04, s * 0.0095, PIVOT.z + 0.008), (sx * 0.033, s * 0.0095, PIVOT.z + 0.001)], 12)
            parts.append(kit.chain(f"pwing{s}{sx}", pts, kit.lerp_list([0.0032, 0.0012], 12), m["gold"], seg=5))
    parts.append(kit.tube("rivet", (0, -0.009, PIVOT.z), (0, 0.009, PIVOT.z), [(0, 0.006, 0.006), (1, 0.006, 0.006)], m["gold"], seg=16))
    # a small pendant hanging on the right of the pivot, as in the concept
    top = PIVOT + Vector((0.03, 0, -0.03))
    parts.append(kit.chain("pcord", [top, top + Vector((0.004, 0, -0.03))], [0.0012, 0.0012], m["gold"], seg=4))
    parts.append(kit.blob("pbead", top + Vector((0.004, 0, -0.034)), (0.0045,) * 3, m["gold"], segs=(10, 6)))
    parts.append(kit.lathe("pfringe", [(0.002, -0.004), (0.005, -0.012), (0.006, -0.03), (0.004, -0.032)], m["tassel"], seg=10,
                           centre=top + Vector((0.004, 0, -0.036))))
    return parts


def handle(m):
    parts = []
    parts.append(kit.lathe("handle", [(0.0095, -0.13), (0.0115, -0.06), (0.0118, 0.0), (0.0108, 0.06), (0.0085, 0.09)],
                           m["wood"], seg=18))
    for i in range(2):
        pts = az.helix(0.0116, -0.11, 0.07, 3.0, phase=i * math.pi, sign=1, n=60)
        parts.append(kit.chain(f"wrap{i}", pts, [(0.0024, 0.0012)] * 60, m["gold"], seg=5, side=(0, 0, 1)))
    parts.append(kit.lathe("neck", [(0.009, 0.085), (0.012, 0.09), (0.0095, 0.1), (0.008, 0.108)], m["gold"], seg=18))
    # the end: a gold cup with a jade gem in a frame, a finial and the tassel
    parts.append(kit.lathe("cup", [(0.0095, -0.128), (0.014, -0.136), (0.0165, -0.152), (0.016, -0.17), (0.011, -0.18),
                                   (0.005, -0.186)], m["gold"], seg=20))
    for s in (1, -1):
        parts.append(kit.blob(f"egem{s}", (0, s * 0.0145, -0.155), (0.0075, 0.004, 0.011), m["gem"], segs=(12, 8)))
        parts.append(kit.torus(f"ebez{s}", (0, s * 0.014, -0.155), 0.0095, 0.0016, m["gold"], seg=(24, 6), axis=(0, 1, 0)))
    parts.append(kit.torus("ering", (0, 0, -0.194), 0.006, 0.0016, m["gold"], seg=(16, 6), axis=(0, 1, 0)))
    tp = az.tassel_parts({"tassel": m["tassel"], "fit": m["gold"]}, 1.0, "tassel", strands=10)
    for p in tp:
        kit.transform(p, Matrix.Translation((0, 0, -0.03)))
    parts += tp
    return parts


def build():
    coll = kit.collection(WID)
    m = _wp.mats(WID, jade="#6fd29a", glow="#7affb0", gold="#d2ae55", tassel="#efe6cc")
    m["pearl"] = kit.material(f"{WID}_pearl", "#f1eee4", roughness=0.25, coat=0.8, sheen=0.4, emission="#fff4e0", strength=0.15)
    m["wood"] = kit.material(f"{WID}_wood", "#3b2a24", roughness=0.45, coat=0.5)
    m["jade"] = kit.material(f"{WID}_jadeleaf", "#7cc99a", roughness=0.25, coat=0.7, emission="#7cc99a", strength=0.2)
    parts = leaves(m)
    for k, a in enumerate(RIBS):
        parts += rib(m, a, k, big=abs(a) == 75)
    parts += pivot(m) + handle(m)
    az.join_static(WID, parts)
    return coll
