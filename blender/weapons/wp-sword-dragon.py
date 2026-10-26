"""
wp-sword-dragon: the Azure Dragon-Spine Sword (concept: C:\\projectG\\weapons\\sword_dragon.png).
A broad straight blade with a row of dragon vertebrae along its back edge, a teal jade inlay framed in
gold with a glowing centre line, a gold guard of flame scrolls around a spirit orb, and a small azure
dragon coiled round the grip whose head rests against the guard. Gold ring pommel with a silk tassel.

Size: about 1.0 m blade + hilt, grip centred on the origin, blade up +Z, flats facing -Y.

VFX notes for later (not modelled): a large translucent azure dragon spiralling up around the blade,
cyan qi wisps and sparkles, the orb pulsing, light running along the centre line.
"""
import math

import bpy

from mathutils import Matrix, Vector

import kit
import _azure_common as az
import _treasure_common as tc
import _wp

WID = "wp-sword-dragon"
BASE, L = 0.182, 0.86        # blade from z = BASE to BASE + L
TH = 0.0055                   # half thickness of the flat


def half_width(t):
    """Blade half-width along its length (t = 0 at the guard, 1 at the point)."""
    w = 0.045 + 0.005 * math.sin(math.pi * min(t / 0.8, 1.0))
    if t > 0.8:
        w *= max((1 - t) / 0.2, 0.0) ** 0.85
    return w


def blade(m):
    # a flat slab: sharp bevelled edge on +X, a blunt back on -X where the spine sits
    prof = [(1, 0), (0.62, 1), (0, 1), (-0.62, 1), (-1, 0.55), (-1, -0.55), (-0.62, -1), (0, -1), (0.62, -1)]
    ts = [i / 20 * 0.8 for i in range(21)] + [0.86, 0.92, 0.96, 0.99, 1.0]
    secs = []
    for t in ts:
        w = max(half_width(t), 0.0006)
        th = TH * (1.0 if t <= 0.8 else max(((1 - t) / 0.2) ** 0.7, 0.08))
        secs.append([(a * w, b * th, BASE + L * t) for a, b in prof])
    return az.section_loft("blade", secs, m["steel"], smooth=False)


def inlay(m):
    """The jade panel on each face, its gold frame, scrollwork and the glowing centre line."""
    parts = []
    ts = [0.04 + i / 23 * 0.74 for i in range(24)]
    right = [(0.5 * half_width(t), BASE + L * t) for t in ts]
    tip = (0.0, BASE + L * 0.83)
    outline = right + [tip] + [(-x, z) for x, z in reversed(right)]
    for s in (1, -1):
        y = s * (TH + 0.0006)
        parts.append(kit.extrude_shape(f"panel{s}", outline, 0.0012, m["jade"], centre=(0, y, 0)))
        frame = [Vector((x, s * (TH + 0.0013), z)) for x, z in outline] + [Vector((outline[0][0], s * (TH + 0.0013), outline[0][1]))]
        parts.append(kit.chain(f"frame{s}", frame, [0.0016] * len(frame), m["gold"], seg=5))
        base_line = [Vector((outline[-1][0], s * (TH + 0.0013), outline[-1][1])), Vector((outline[0][0], s * (TH + 0.0013), outline[0][1]))]
        parts.append(kit.chain(f"framebase{s}", base_line, [0.0016, 0.0016], m["gold"], seg=5))
        # the glowing line down the middle
        line = [Vector((0, s * (TH + 0.0019), BASE + L * t)) for t in (0.06 + i / 15 * 0.74 for i in range(16))]
        parts.append(kit.ribbon(f"line{s}", line, lambda u: 0.0032 * (1 - 0.5 * u), m["glow"], normal=(0, s, 0), smooth=False))
        # cloud scrolls either side of the line: small gold spirals
        for k, (t0, side) in enumerate(((0.12, 1), (0.24, -1), (0.36, 1), (0.48, -1), (0.6, 1), (0.7, -1))):
            w = 0.5 * half_width(t0)
            cx, cz = side * w * 0.42, BASE + L * t0
            pts = []
            for i in range(18):
                u = i / 17
                a = side * (u * 3.6 * math.pi)
                r = w * 0.62 * (1 - 0.8 * u)
                pts.append(Vector((cx + r * math.cos(a), s * (TH + 0.0014), cz + r * math.sin(a) * 1.4 + u * 0.004)))
            parts.append(kit.chain(f"scroll{s}{k}", pts, kit.lerp_list([0.0016, 0.0009], 18), m["gold"], seg=4))
    return parts


def spine(m):
    """Dragon vertebrae along the back (-X) edge of the blade, each with a small hooked process."""
    parts = []
    n = 17
    for i in range(n):
        t = 0.06 + i / (n - 1) * 0.6
        z = BASE + L * t
        x = -half_width(t)
        k = 1.0 - 0.4 * i / (n - 1)
        # a flat vertebral body jutting out of the back edge, a thin disc above it and a hooked process
        parts.append(kit.blob(f"vert{i}", (x - 0.008 * k, 0, z), (0.019 * k, 0.0085 * k, 0.0088 * k), m["bone"], segs=(14, 8)))
        parts.append(kit.blob(f"disc{i}", (x - 0.006 * k, 0, z + 0.0125 * k), (0.014 * k, 0.0062 * k, 0.0028 * k), m["bone"], segs=(12, 5)))
        base = Vector((x - 0.022 * k, 0, z + 0.002))
        parts.append(tc.cone(f"proc{i}", base, base + Vector((-0.012 * k, 0, 0.011 * k)), 0.0055 * k, m["bone"], seg=6,
                             side=(0, 1, 0), flat=0.6))
    return parts


def guard(m):
    parts = []
    zc = 0.138
    half = [(0, -0.034), (0.028, -0.03), (0.047, -0.017), (0.058, 0.004), (0.07, 0.03), (0.074, 0.058), (0.064, 0.074),
            (0.06, 0.06), (0.054, 0.042), (0.044, 0.028), (0.036, 0.032), (0.033, 0.05), (0.026, 0.064), (0.022, 0.05),
            (0.018, 0.036), (0.008, 0.036)]
    half = [(x * 1.3, z * 1.15) for x, z in half]
    outline = half + [(-x, z) for x, z in reversed(half[1:])]
    g = kit.extrude_shape("guard", outline, 0.022, m["gold"], bevel=0.0025, centre=(0, 0, zc))
    parts.append(g)
    # raised scroll ridges on each face of the guard
    for s in (1, -1):
        for sx in (1, -1):
            pts = kit.spline([(sx * 0.031, 0, zc - 0.03), (sx * 0.065, 0, zc - 0.009), (sx * 0.08, 0, zc + 0.035),
                              (sx * 0.083, 0, zc + 0.066)], 14)
            pts = [Vector((p.x, s * 0.0118, p.z)) for p in pts]
            parts.append(kit.chain(f"gridge{s}{sx}", pts, kit.lerp_list([0.0028, 0.0018, 0.001], 14), m["gold"], seg=5))
        parts.append(kit.torus(f"bezel{s}", (0, s * 0.0115, zc), 0.0195, 0.0038, m["gold"], seg=(32, 8), axis=(0, 1, 0)))
    parts.append(kit.blob("orb", (0, 0, zc), (0.0175, 0.0165, 0.0175), m["gem"], segs=(20, 14)))
    # collar where the blade enters the guard
    parts.append(kit.box("collar", (0, 0, 0.178), (0.1, 0.014, 0.012), m["gold"], bevel=0.003, segments=2))
    return parts


def hilt(m):
    parts = []
    grip = kit.lathe("grip", [(0.0148, -0.104), (0.017, -0.06), (0.0175, 0.0), (0.017, 0.06), (0.0152, 0.104)], m["grip"], seg=20)
    kit.transform(grip, Matrix.Diagonal((1, 0.85, 1, 1)))
    parts.append(grip)
    for z in (-0.104, -0.035, 0.035, 0.104):
        r = 0.0185 if abs(z) > 0.1 else 0.0182
        parts.append(kit.lathe(f"band{z}", [(r * 0.92, z - 0.006), (r, z - 0.003), (r, z + 0.003), (r * 0.92, z + 0.006)], m["gold"], seg=20))
    # pommel: a gold collar and a ring with a jade bead hung in it
    parts.append(kit.lathe("pcollar", [(0.0165, -0.106), (0.019, -0.112), (0.0175, -0.122), (0.011, -0.128)], m["gold"], seg=20))
    parts.append(kit.torus("pring", (0, 0, -0.152), 0.022, 0.0058, m["gold"], seg=(36, 10), axis=(0, 1, 0)))
    for a in range(8):
        ang = a * math.pi / 4
        c = Vector((math.cos(ang) * 0.022, 0, -0.152 + math.sin(ang) * 0.022))
        parts.append(kit.blob(f"pstud{a}", c + Vector((0, 0, 0)), (0.0042, 0.0072, 0.0042), m["gold"], segs=(8, 6)))
    parts.append(kit.blob("pbead", (0, 0, -0.152), (0.0085, 0.0085, 0.0085), m["jade"], segs=(14, 10)))
    # tassel: a cord with two jade beads and a silk fringe
    cord = kit.spline([(0, 0, -0.18), (0.004, 0.002, -0.21), (0.01, 0.004, -0.24), (0.016, 0.006, -0.27)], 12)
    parts.append(kit.chain("tcord", cord, [0.0022] * 12, m["tassel"], seg=5))
    for k, z in enumerate((-0.205, -0.232)):
        parts.append(kit.blob(f"tbead{k}", (0.004 + k * 0.004, 0.002 + k * 0.002, z), (0.0062,) * 3, m["jade"], segs=(12, 8)))
    fringe = az.tassel_parts({"tassel": m["tassel"], "fit": m["gold"]}, 1.0, "fringe", strands=10)
    for p in fringe[:2]:  # its own cord and knot: this sword has the beaded cord above instead
        bpy.data.objects.remove(p, do_unlink=True)
    for p in fringe[2:]:
        kit.transform(p, Matrix.Translation((0.014, -0.002, -0.0)))
        parts.append(p)
    return parts


def coiled_dragon(m):
    """A small dragon wound round the grip, climbing to the guard where its head rests by the orb."""
    pts = []
    for i in range(14):
        u = i / 13
        a = math.pi * 0.2 + u * 2.6 * math.pi
        r = 0.025 + 0.003 * math.sin(u * math.pi)
        pts.append((r * math.cos(a), r * math.sin(a) * 0.92, -0.118 + u * 0.215))
    pts += [(-0.04, -0.016, 0.115), (-0.07, -0.02, 0.13)]

    def up(p):
        v = Vector((p.x, p.y, 0.0))
        return v.normalized() if v.length > 1e-6 else Vector((0, 0, 1))
    return tc.dragon("dragon", pts, 0.0085, m["scale"], m["gold"], m["gem"], up, seg=8, legs=(0.42, 0.8), lift=0.2,
                     fin_mat=m["fin"], whisker_mat=m["gold"], n=44, head_scale=1.7, open_jaw=0.35, belly_mat=m["belly"])


def build():
    coll = kit.collection(WID)
    m = _wp.mats(WID, jade="#2fb3a6", glow="#8ff7ff", grip="#dde6e2", tassel="#8fe0d8")
    m["bone"] = kit.material(f"{WID}_bone", "#e6dfca", metallic=0.25, roughness=0.38, coat=0.3)
    m["scale"] = kit.material(f"{WID}_scale", "#3b9c94", metallic=0.45, roughness=0.32, coat=0.5)
    m["belly"] = kit.material(f"{WID}_belly", "#d9c88a", metallic=0.7, roughness=0.3)
    m["fin"] = kit.material(f"{WID}_fin", "#62d0c4", metallic=0.3, roughness=0.3, emission="#62d0c4", strength=0.3)
    parts = [blade(m)] + inlay(m) + spine(m) + guard(m) + hilt(m) + coiled_dragon(m)
    az.join_static(WID, parts)
    return coll
