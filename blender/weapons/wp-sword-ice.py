"""
wp-sword-ice: the Frost-Crystal Sword (concept: C:\\projectG\\weapons\\sword_ice.png).
A faceted ice-crystal blade with frozen light cracks inside it, a crown of ice shards where it grows
out of the hilt, a white-jade guard of curling cloud scrolls trimmed in gold, a white-jade grip bound
with a gold spiral, and a jade orb pommel set with a frost gem.

Size: about 1.1 m, grip centred on the origin, blade up +Z, flats facing -Y.

VFX notes for later (not modelled): snowflakes and ice glitter drifting off the blade, a cold mist
rolling down from the pommel, a frost ring on the ground, light flickering along the inner cracks.
"""
import math

from mathutils import Matrix, Vector

import kit
import _azure_common as az
import _treasure_common as tc
import _wp

WID = "wp-sword-ice"
BASE, L = 0.17, 0.86


def half_width(t):
    w = 0.03 * (1 - 0.12 * t)
    if t > 0.78:
        w *= max((1 - t) / 0.22, 0.0) ** 1.1
    return w


def blade(m):
    """A six-sided crystal bar with a ridge down each face and a long faceted point."""
    prof = [(1, 0), (0.45, 0.8), (0, 1), (-0.45, 0.8), (-1, 0), (-0.45, -0.8), (0, -1), (0.45, -0.8)]
    ts = [i / 16 * 0.78 for i in range(17)] + [0.84, 0.9, 0.95, 0.985, 1.0]
    secs = []
    for t in ts:
        w = max(half_width(t), 0.0005)
        th = 0.0115 * (1 - 0.2 * t) * (1.0 if t <= 0.78 else max(((1 - t) / 0.22) ** 1.1, 0.04))
        secs.append([(a * w, b * th, BASE + L * t) for a, b in prof])
    return az.section_loft("blade", secs, m["ice"], smooth=False)


def cracks(m):
    """Frozen light inside the crystal: a bright core line and branching zigzag cracks."""
    parts = []
    core = [Vector((0, 0, BASE + L * t)) for t in (0.02 + i / 19 * 0.9 for i in range(20))]
    parts.append(kit.ribbon("core", core, lambda u: 0.006 * (1 - 0.7 * u), m["glow"], normal=(0, 1, 0), smooth=False))
    parts.append(kit.ribbon("core_x", core, lambda u: 0.0035 * (1 - 0.7 * u), m["glow"], normal=(1, 0, 0), smooth=False))
    rnd = [0.31, -0.62, 0.84, -0.27, 0.55, -0.9, 0.12, -0.48, 0.73, -0.15, 0.4, -0.7]
    for k in range(6):
        t0 = 0.08 + k * 0.12
        side = 1 if k % 2 else -1
        pts = []
        for i in range(6):
            u = i / 5
            t = t0 + u * 0.16
            w = half_width(t) * 0.85
            x = side * w * (0.15 + 0.85 * u) * (0.75 + 0.25 * rnd[(k + i) % 12])
            pts.append(Vector((x, 0.002 * rnd[(k * 3 + i) % 12], BASE + L * t + 0.01 * rnd[(k + 2 * i) % 12])))
        parts.append(kit.ribbon(f"crack{k}", pts, lambda u: 0.0025 * (1 - 0.8 * u), m["crack"], normal=(0, 1, 0), smooth=False))
    return parts


def shards(m):
    """Ice crystals bursting out round the root of the blade, longest at the sides."""
    parts = []
    spec = [(-1.0, 0.06, 0.012, 0.35), (-0.62, 0.075, 0.011, 0.2), (-0.3, 0.05, 0.009, 0.1), (0.3, 0.052, 0.009, -0.1),
            (0.62, 0.078, 0.011, -0.2), (1.0, 0.058, 0.012, -0.35)]
    for i, (x, length, r, tw) in enumerate(spec):
        for s in (1, -1):
            base = Vector((x * 0.028, s * 0.006, BASE - 0.004))
            d = Vector((x * 0.55, s * 0.18, 1.0)).normalized()
            parts.append(tc.crystal(f"shard{i}{s}", base + d * length * 0.42, length, r, m["ice"], axis=d, sides=5, twist=tw))
    return parts


def guard(m):
    """White-jade cloud scrolls curling outward, gold trim along their front and back."""
    parts = []
    zc = 0.13
    for sx in (1, -1):
        # the big outer scroll: out and up, then curling down into a spiral
        ctrl = [(0.012, zc - 0.006), (0.04, zc - 0.002), (0.072, zc + 0.012), (0.098, zc + 0.03), (0.112, zc + 0.05),
                (0.108, zc + 0.068), (0.092, zc + 0.074), (0.08, zc + 0.062), (0.086, zc + 0.05), (0.097, zc + 0.054)]
        pts = [Vector((sx * x, 0, z)) for x, z in ctrl]
        P = kit.spline(pts, 40)
        R = kit.lerp_list([0.016, 0.0155, 0.014, 0.012, 0.0098, 0.0078, 0.0062, 0.005], 40)
        parts.append(kit.chain(f"scroll{sx}", P, [(r, r * 0.8) for r in R], m["white"], seg=12, side=(0, 1, 0)))
        for s in (1, -1):
            T = [p + Vector((0, s * r * 0.97, 0)) for p, r in zip(P, R)]
            parts.append(kit.chain(f"trim{sx}{s}", T, [0.0022] * 40, m["gold"], seg=5))
        # the smaller lower scroll curling under
        ctrl2 = [(0.012, zc - 0.016), (0.036, zc - 0.024), (0.058, zc - 0.022), (0.066, zc - 0.01), (0.058, zc - 0.002),
                 (0.05, zc - 0.008), (0.054, zc - 0.014)]
        P2 = kit.spline([Vector((sx * x, 0, z)) for x, z in ctrl2], 26)
        R2 = kit.lerp_list([0.011, 0.0098, 0.0078, 0.0058, 0.0042], 26)
        parts.append(kit.chain(f"scrollb{sx}", P2, [(r, r * 0.8) for r in R2], m["white"], seg=10, side=(0, 1, 0)))
        for s in (1, -1):
            T2 = [p + Vector((0, s * r * 0.97, 0)) for p, r in zip(P2, R2)]
            parts.append(kit.chain(f"trimb{sx}{s}", T2, [0.0013] * 26, m["gold"], seg=5))
        # an upward cloud flame beside the blade
        ctrl3 = [(0.016, zc + 0.002), (0.03, zc + 0.026), (0.026, zc + 0.05), (0.034, zc + 0.066)]
        P3 = kit.spline([Vector((sx * x, 0, z)) for x, z in ctrl3], 16)
        parts.append(kit.chain(f"flame{sx}", P3, [(r, r * 0.75) for r in kit.lerp_list([0.013, 0.01, 0.006, 0.002], 16)],
                               m["white"], seg=10, side=(0, 1, 0)))
    # the heart of the guard: a jade boss with a frost gem on each face, a gold leaf rising behind the blade
    hub = kit.blob("hub", (0, 0, zc), (0.024, 0.016, 0.022), m["white"], segs=(20, 12))
    parts.append(hub)
    leaf = [(0, 0.085), (0.012, 0.06), (0.02, 0.035), (0.022, 0.012), (0.012, 0.0), (0, 0.004), (-0.012, 0.0),
            (-0.022, 0.012), (-0.02, 0.035), (-0.012, 0.06)]
    for s in (1, -1):
        y = s * 0.0145
        parts.append(kit.extrude_shape(f"leaf{s}", [(x, z + zc - 0.005) for x, z in leaf], 0.003, m["gold"], bevel=0.0008,
                                       centre=(0, y, 0)))
        inner = [(x * 0.65, z * 0.72 + 0.008) for x, z in leaf]
        parts.append(kit.extrude_shape(f"leafin{s}", [(x, z + zc - 0.005) for x, z in inner], 0.003, m["white"],
                                       centre=(0, y + s * 0.0012, 0)))
        parts.append(kit.blob(f"gem{s}", (0, s * 0.017, zc + 0.022), (0.0065, 0.004, 0.009), m["gem"], segs=(12, 8)))
        parts.append(tc.crystal(f"flake{s}", (0, s * 0.0175, zc + 0.002), 0.012, 0.0045, m["gem"], axis=(0, s, 0), sides=6))
    return parts


def hilt(m):
    parts = []
    grip = kit.lathe("grip", [(0.0145, -0.112), (0.017, -0.07), (0.0175, 0.0), (0.0168, 0.07), (0.0155, 0.11)], m["white"], seg=20)
    kit.transform(grip, Matrix.Diagonal((1, 0.9, 1, 1)))
    parts.append(grip)
    for i, (mat, r0) in enumerate(((m["gold"], 0.0026), (m["frost"], 0.002))):
        pts = az.helix(0.0172, -0.1, 0.1, 3.0, phase=i * math.pi, sign=1, n=70, squash=0.9)
        parts.append(kit.chain(f"wrap{i}", pts, [r0] * 70, mat, seg=6))
    parts.append(kit.lathe("ferrule", [(0.0165, 0.1), (0.02, 0.106), (0.019, 0.114), (0.014, 0.118)], m["gold"], seg=20))
    parts.append(kit.lathe("pcollar", [(0.0155, -0.11), (0.0195, -0.116), (0.02, -0.124), (0.016, -0.128)], m["gold"], seg=20))
    # orb pommel: white jade, a gold band of cloud scrolls, frost gems front and back
    zc = -0.155
    parts.append(kit.blob("orb", (0, 0, zc), (0.028, 0.026, 0.027), m["white"], segs=(24, 16)))
    parts.append(kit.torus("band", (0, 0, zc), 0.0272, 0.0026, m["gold"], seg=(40, 8), axis=(0, 0, 1)))
    for s in (1, -1):
        parts.append(kit.torus(f"bez{s}", (0, s * 0.024, zc), 0.0105, 0.0022, m["gold"], seg=(28, 6), axis=(0, 1, 0)))
        parts.append(kit.blob(f"pgem{s}", (0, s * 0.024, zc), (0.0095, 0.006, 0.0095), m["gem"], segs=(16, 10)))
        for sx in (1, -1):
            pts = kit.spline([(sx * 0.012, s * 0.024, zc + 0.008), (sx * 0.02, s * 0.019, zc + 0.016),
                              (sx * 0.026, s * 0.01, zc + 0.008), (sx * 0.022, s * 0.012, zc + 0.002)], 12)
            parts.append(kit.chain(f"pscroll{s}{sx}", pts, kit.lerp_list([0.002, 0.0012], 12), m["gold"], seg=5))
    parts.append(tc.cone("finial", Vector((0, 0, zc - 0.026)), Vector((0, 0, zc - 0.042)), 0.006, m["gold"], seg=10))
    return parts


def build():
    coll = kit.collection(WID)
    m = _wp.mats(WID, glow="#bff0ff", gold="#cdb06a")
    m["ice"] = kit.material(f"{WID}_ice", "#b8dcf5", roughness=0.04, coat=1.0, transmission=0.85,
                            emission="#7fc4ff", strength=0.25)
    m["crack"] = kit.material(f"{WID}_crack", "#d8f4ff", roughness=0.3, emission="#c8f0ff", strength=4.0)
    m["white"] = kit.material(f"{WID}_whitejade", "#e4ecee", roughness=0.22, coat=0.8, sheen=0.2)
    m["frost"] = kit.material(f"{WID}_frost", "#8fd0e8", roughness=0.25, coat=0.6, emission="#8fd0e8", strength=0.3)
    m["gem"] = kit.material(f"{WID}_frostgem", "#7fe4f0", roughness=0.08, coat=1.0, emission="#7fe4f0", strength=2.5)
    parts = [blade(m)] + cracks(m) + shards(m) + guard(m) + hilt(m)
    az.join_static(WID, parts)
    return coll
