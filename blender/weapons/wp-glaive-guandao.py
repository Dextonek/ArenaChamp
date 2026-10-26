"""
wp-glaive-guandao: the Green Dragon Crescent Blade (concept: C:\\projectG\\weapons\\glaive_guandao.png).
A broad crescent blade of green jade with a steel edge, a back spike, and a gold dragon in relief on
both faces; a gold lotus collar with spirit orbs and swept cloud wings; a short black-lacquer haft
with a gold spiral inlay and a jade orb butt. Proportions follow the concept (a short haft), not the
2 m pole of a historical guandao.

Size: about 1.4 m, grip centred on the origin (middle of the haft), blade up +Z, flats facing -Y,
cutting edge on -X.

VFX notes for later (not modelled): green and gold qi ribbons spiralling around the whole weapon,
jade sparks, the dragon relief glowing, a crescent slash trail.
"""
import math

from mathutils import Matrix, Vector

import kit
import _azure_common as az
import _treasure_common as tc
import _wp

WID = "wp-glaive-guandao"

# the blade silhouette in x/z: up the back (+X) to the tip, then down the cutting edge (-X)
EDGE = [(0.032, 0.30), (0.036, 0.40), (0.04, 0.50), (0.044, 0.60), (0.078, 0.642), (0.052, 0.668), (0.054, 0.72),
        (0.062, 0.80), (0.08, 0.87), (0.105, 0.93), (0.135, 0.978), (0.1, 0.966), (0.06, 0.95), (0.02, 0.925),
        (-0.02, 0.885), (-0.05, 0.83), (-0.068, 0.76), (-0.077, 0.68), (-0.077, 0.60), (-0.071, 0.52),
        (-0.059, 0.44), (-0.045, 0.36), (-0.037, 0.30)]
# the jade body inside the steel: flush with the back, set in from the edge and the point
JADE = [(0.027, 0.305), (0.031, 0.40), (0.035, 0.50), (0.039, 0.60), (0.045, 0.662), (0.047, 0.72), (0.054, 0.80),
        (0.068, 0.862), (0.086, 0.91), (0.098, 0.937), (0.06, 0.928), (0.02, 0.903), (-0.014, 0.866),
        (-0.037, 0.818), (-0.053, 0.755), (-0.06, 0.68), (-0.06, 0.60), (-0.055, 0.52), (-0.045, 0.44),
        (-0.034, 0.36), (-0.028, 0.305)]
SX = 1.45   # the concept's blade is broad: widen the outlines (drawn narrow) across X
EDGE = [(x * SX, z) for x, z in EDGE]
JADE = [(x * SX, z) for x, z in JADE]


def blade(m):
    parts = [kit.extrude_shape("edge", EDGE, 0.0055, m["steel"], bevel=0.0018)]
    parts.append(kit.extrude_shape("body", JADE, 0.0135, m["jade"], bevel=0.0025))
    for s in (1, -1):
        y = s * 0.0068
        loop = [Vector((x, y, z)) for x, z in JADE] + [Vector((JADE[0][0], y, JADE[0][1]))]
        parts.append(kit.chain(f"border{s}", loop, [0.0022] * len(loop), m["gold"], seg=6))
    return parts


def relief(m):
    """A gold dragon climbing each face, flattened into a low relief."""
    parts = []
    ctrl = [(0.004, 0.34), (0.018, 0.39), (-0.02, 0.45), (0.012, 0.52), (-0.028, 0.6), (-0.004, 0.68), (0.01, 0.74),
            (0.012, 0.79), (0.016, 0.83)]
    for s in (1, -1):
        y0 = s * 0.0072
        objs = tc.dragon(f"relief{s}", [(x * SX, y0, z) for x, z in ctrl], 0.0105, m["gold"], m["gold"], m["gem"], (0, s, 0),
                         seg=8, legs=(0.3, 0.6), lift=0.0, n=40, head_scale=1.9, open_jaw=0.3)
        M = Matrix.Translation((0, y0, 0)) @ Matrix.Diagonal((1, 0.42, 1, 1)) @ Matrix.Translation((0, -y0, 0))
        for o in objs:
            kit.transform(o, M)
        parts += objs
    return parts


def collar(m):
    parts = []
    parts.append(kit.lathe("lotus", [(0.0205, 0.2), (0.026, 0.206), (0.03, 0.22), (0.026, 0.235), (0.03, 0.25),
                                     (0.036, 0.268), (0.034, 0.284), (0.03, 0.296), (0.038, 0.302), (0.038, 0.31)],
                           m["gold"], seg=28))
    # petals round the collar
    for k in range(10):
        a = k * 2 * math.pi / 10
        d = Vector((math.cos(a), math.sin(a), 0))
        base = d * 0.029 + Vector((0, 0, 0.236))
        parts.append(tc.cone(f"petal{k}", base, base + d * 0.012 + Vector((0, 0, 0.03)), 0.0075, m["gold"], seg=6,
                             side=d.cross(Vector((0, 0, 1))), flat=0.35))
    # swept cloud wings either side, curling up like the concept's dragon horns
    for sx in (1, -1):
        ol = [(0.03, 0.272), (0.05, 0.27), (0.068, 0.278), (0.082, 0.296), (0.086, 0.318), (0.078, 0.33),
              (0.07, 0.322), (0.072, 0.308), (0.064, 0.296), (0.05, 0.292), (0.04, 0.3), (0.03, 0.302)]
        parts.append(kit.extrude_shape(f"wing{sx}", [(sx * x, z) for x, z in ol], 0.018, m["gold"], bevel=0.0025))
        parts.append(kit.blob(f"winggem{sx}", (sx * 0.058, 0, 0.284), (0.006, 0.0115, 0.006), m["gem"], segs=(10, 8)))
    for s in (1, -1):
        parts.append(kit.torus(f"bezel{s}", (0, s * 0.034, 0.268), 0.0135, 0.0032, m["gold"], seg=(28, 8), axis=(0, 1, 0)))
        parts.append(kit.blob(f"orb{s}", (0, s * 0.033, 0.268), (0.0118, 0.0075, 0.0118), m["gem"], segs=(16, 10)))
    return parts


def haft(m):
    parts = []
    shaft = kit.lathe("haft", [(0.0185, -0.285), (0.0195, -0.1), (0.0195, 0.1), (0.0188, 0.205)], m["lacquer"], seg=20)
    parts.append(shaft)
    for i in range(2):
        pts = az.helix(0.0195, -0.27, 0.19, 3.5, phase=i * math.pi, sign=1, n=80)
        parts.append(kit.chain(f"inlay{i}", pts, [(0.0034, 0.0016)] * 80, m["gold"], seg=6, side=(0, 0, 1)))
    for z in (0.198, -0.278):
        parts.append(kit.lathe(f"ring{z}", [(0.019, z - 0.008), (0.023, z - 0.004), (0.023, z + 0.004), (0.019, z + 0.008)],
                               m["gold"], seg=24))
    # butt: a gold cup holding a jade orb, a band of studs, a finial and two small drops
    parts.append(kit.lathe("cup", [(0.019, -0.284), (0.024, -0.292), (0.03, -0.306), (0.026, -0.312)], m["gold"], seg=24))
    zc = -0.338
    parts.append(kit.blob("butt", (0, 0, zc), (0.034, 0.034, 0.032), m["jade"], segs=(24, 16)))
    parts.append(kit.torus("buttband", (0, 0, zc), 0.0338, 0.0032, m["gold"], seg=(40, 8)))
    for k in range(8):
        a = k * math.pi / 4
        parts.append(kit.blob(f"stud{k}", (math.cos(a) * 0.0345, math.sin(a) * 0.0345, zc), (0.0045,) * 3, m["gold"], segs=(8, 6)))
    for s in (1, -1):
        parts.append(kit.blob(f"bgem{s}", (0, s * 0.03, zc + 0.012), (0.008, 0.005, 0.008), m["gem"], segs=(12, 8)))
    parts.append(kit.lathe("finial", [(0.014, zc - 0.03), (0.011, zc - 0.04), (0.006, zc - 0.046), (0.0005, zc - 0.05)],
                           m["gold"], seg=16))
    for sx in (1, -1):
        top = Vector((sx * 0.008, 0, zc - 0.042))
        parts.append(kit.chain(f"drop{sx}", [top, top + Vector((sx * 0.004, 0, -0.018))], [0.0015, 0.0015], m["gold"], seg=5))
        parts.append(tc.cone(f"dropcone{sx}", top + Vector((sx * 0.004, 0, -0.016)), top + Vector((sx * 0.004, 0, -0.034)),
                             0.0055, m["gold"], seg=8))
    return parts


def build():
    coll = kit.collection(WID)
    m = _wp.mats(WID, jade="#2f9a55", glow="#6dff9c", gold="#c9a446")
    m["jade"] = kit.material(f"{WID}_jade", "#2e8f52", roughness=0.18, coat=0.9, emission="#2e8f52", strength=0.25)
    m["lacquer"] = kit.material(f"{WID}_lacquer", "#1d2420", roughness=0.3, coat=0.8)
    m["gem"] = kit.material(f"{WID}_gem", "#3fe07a", roughness=0.08, coat=1.0, emission="#3fe07a", strength=2.5)
    parts = blade(m) + relief(m) + collar(m) + haft(m)
    az.join_static(WID, parts)
    return coll
