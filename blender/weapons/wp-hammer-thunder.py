"""
wp-hammer-thunder: the Thunder-Drum Hammer (concept: C:\\projectG\\weapons\\hammer_thunder.png).
A double drum head of dark cracked iron bound in bronze, set with jade studs; a taiji medallion in a
bagua ring on both faces; a bronze dome with a spike on top; a beast head roaring from one end and a
jade boss on the other; bronze talismans hanging on jade rings. A dark haft with bronze bands, horned
collars top and bottom, and a small bell with tassels at the butt. Lightning cracks glow faintly.

Size: about 1.0 m tall, head about 0.6 m wide; grip centred on the origin, head up +Z, medallion
facing -Y, the beast head on +X.

VFX notes for later (not modelled): purple-white lightning arcing round the head and down the haft,
a white qi spiral round the haft, storm clouds below, the taiji spinning and glowing on impact.
"""
import math

from mathutils import Matrix, Vector

import kit
import _azure_common as az
import _treasure_common as tc
import _wp

WID = "wp-hammer-thunder"
HZ = 0.43          # height of the head's axis


def X(x, r_list, name, mat, seg=32):
    """A tube along X from x0 to x1 with radii [(t, r)]."""
    x0, x1, radii = x[0], x[1], r_list
    return kit.tube(name, (x0, 0, HZ), (x1, 0, HZ), [(t, r, r) for t, r in radii], mat, seg=seg, side=(0, 0, 1))


def taiji(m, y, s):
    """A taiji disc in a jade bagua ring, facing out of the head at depth y (s = +1 back, -1 front)."""
    parts = []
    R = 0.04
    yy, dark = [], []
    n = 24
    # the light half: the right half circle, then the S back up through the centre
    for i in range(n + 1):
        a = math.pi / 2 - math.pi * i / n
        yy.append((R * math.cos(a), R * math.sin(a)))
    for i in range(1, n):
        a = -math.pi / 2 - math.pi * i / n
        yy.append((R / 2 * math.cos(a), -R / 2 + R / 2 * math.sin(a)))
    for i in range(n):
        a = -math.pi / 2 + math.pi * i / n
        yy.append((R / 2 * math.cos(a), R / 2 + R / 2 * math.sin(a)))
    dark = [(-x, -z) for x, z in yy]
    for name, ol, mat in (("yang", yy, m["pearl"]), ("yin", dark, m["ink"])):
        parts.append(kit.extrude_shape(f"{name}{s}", [(x, z + HZ) for x, z in ol], 0.004, mat, centre=(0, y, 0)))
    for name, z, mat in (("dotyin", R / 2, m["ink"]), ("dotyang", -R / 2, m["pearl"])):
        parts.append(kit.blob(f"{name}{s}", (0, y + s * 0.0022, HZ + z), (0.0065, 0.0016, 0.0065), mat, segs=(12, 6)))
    parts.append(az_ring(f"ring{s}", y, R + 0.002, R + 0.028, m["jade"]))
    parts.append(kit.torus(f"frame_in{s}", (0, y, HZ), R + 0.003, 0.0035, m["bronze"], seg=(40, 8), axis=(0, 1, 0)))
    parts.append(kit.torus(f"frame_out{s}", (0, y, HZ), R + 0.03, 0.0055, m["bronze"], seg=(48, 8), axis=(0, 1, 0)))
    # the eight trigrams round the ring
    for k in range(8):
        a = k * math.pi / 4
        c = Vector((math.cos(a), 0, math.sin(a))) * (R + 0.0155)
        for j, broken in enumerate((k % 2, (k // 2) % 2, (k // 4) % 2)):
            r = (j - 1) * 0.0055
            off = Vector((math.cos(a), 0, math.sin(a))) * r
            t = Vector((-math.sin(a), 0, math.cos(a)))
            pieces = [(-0.0065, -0.0015), (0.0015, 0.0065)] if broken else [(-0.0065, 0.0065)]
            for q, (u0, u1) in enumerate(pieces):
                ctr = c + off + t * (u0 + u1) / 2
                bar = kit.box(f"tri{s}{k}{j}{q}", (0, 0, 0), (u1 - u0, 0.003, 0.0026), m["bronze"])
                kit.transform(bar, Matrix.Translation((ctr.x, y + s * 0.0024, HZ + ctr.z)) @ Matrix.Rotation(-a + math.pi / 2, 4, "Y"))
                parts.append(bar)
    return parts


def az_ring(name, y, r0, r1, mat):
    """A flat disc ring facing Y."""
    rings = []
    for r, dy in ((r0, -0.002), (r1, -0.002), (r1, 0.002), (r0, 0.002)):
        rings.append((Vector((0, y + dy, HZ)), Vector((r, 0, 0)), Vector((0, 0, r))))
    return kit.loft(name, rings, mat, 48, closed=True, smooth=False)


def head(m):
    parts = []
    # the core barrel and the two drums
    parts.append(X((-0.13, 0.13), [(0, 0.082), (0.5, 0.09), (1, 0.082)], "core", m["iron"]))
    for sx in (1, -1):
        a, b = sorted((sx * 0.125, sx * 0.265))
        parts.append(X((a, b), [(0, 0.1), (0.12, 0.114), (0.5, 0.122), (0.88, 0.114), (1, 0.1)], f"drum{sx}", m["iron"]))
        for x in (0.135, 0.255):
            parts.append(kit.torus(f"band{sx}{x}", (sx * x, 0, HZ), 0.112, 0.0085, m["bronze"], seg=(48, 8), axis=(1, 0, 0)))
        parts.append(kit.torus(f"bandmid{sx}", (sx * 0.195, 0, HZ), 0.1225, 0.005, m["bronze"], seg=(48, 6), axis=(1, 0, 0)))
        # jade studs in bronze cups round the drum
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            d = Vector((0, math.cos(a), math.sin(a)))
            c = Vector((sx * 0.195, 0, HZ)) + d * 0.122
            parts.append(kit.torus(f"cup{sx}{k}", c, 0.0135, 0.0032, m["bronze"], seg=(20, 6), axis=d))
            parts.append(kit.blob(f"stud{sx}{k}", c + d * 0.003, (0.0115, 0.0115, 0.0115), m["jade"], segs=(12, 8)))
        # end face: a bronze rim
        parts.append(kit.torus(f"rim{sx}", (sx * 0.267, 0, HZ), 0.096, 0.007, m["bronze"], seg=(48, 8), axis=(1, 0, 0)))
    # the -X end: a jade boss in a bronze petal ring
    parts.append(X((-0.29, -0.262), [(0, 0.035), (0.5, 0.05), (1, 0.06)], "boss", m["jade"], seg=28))
    for k in range(12):
        a = k * math.pi / 6
        d = Vector((0, math.cos(a), math.sin(a)))
        base = Vector((-0.266, 0, HZ)) + d * 0.062
        parts.append(tc.cone(f"bpetal{k}", base, base + d * 0.022 + Vector((-0.012, 0, 0)), 0.012, m["bronze"], seg=6,
                             side=Vector((1, 0, 0)), flat=0.4))
    # the +X end: a roaring beast head
    beast = tc.dragon("beast", [(0.18, 0, HZ), (0.23, 0, HZ), (0.272, 0, HZ + 0.004)], 0.03, m["bronze"], m["bronze"],
                      m["eye"], (0, 0, 1), seg=10, legs=(), lift=0.12, n=10, head_scale=1.25, open_jaw=0.5,
                      whisker_mat=m["bronze"])
    parts += beast
    # medallions front and back
    for s in (-1, 1):
        parts += taiji(m, s * 0.092, s)
    # bronze dome with jade studs and a spike on top
    top = HZ + 0.085
    parts.append(kit.lathe("dome", [(0.06, top - 0.012), (0.066, top), (0.062, top + 0.02), (0.05, top + 0.045),
                                    (0.03, top + 0.062), (0.014, top + 0.07), (0.012, top + 0.08)], m["iron"], seg=32))
    parts.append(kit.torus("domeband", (0, 0, top + 0.004), 0.066, 0.006, m["bronze"], seg=(40, 8)))
    parts.append(kit.torus("domeband2", (0, 0, top + 0.05), 0.043, 0.0045, m["bronze"], seg=(32, 6)))
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        d = Vector((math.cos(a), math.sin(a), 0))
        c = d * 0.056 + Vector((0, 0, top + 0.026))
        parts.append(kit.blob(f"dstud{k}", c, (0.0095, 0.0095, 0.0095), m["jade"], segs=(12, 8)))
    parts.append(kit.lathe("spike", [(0.016, top + 0.078), (0.019, top + 0.086), (0.012, top + 0.094), (0.007, top + 0.12),
                                     (0.0006, top + 0.15)], m["bronze"], seg=16))
    return parts


def cracks(m):
    """Thin lines of lightning-light in the iron of the head."""
    parts = []
    spec = [(-0.12, 0.6, 0.10, 0.09), (0.05, -0.4, 0.09, 0.09), (-0.2, 2.0, 0.07, 0.121), (0.2, 2.4, 0.07, 0.121),
            (-0.18, -0.9, 0.06, 0.121), (0.17, -1.2, 0.06, 0.121), (0.08, 1.7, 0.08, 0.09)]
    for i, (x0, a0, length, r) in enumerate(spec):
        pts = []
        for j in range(7):
            u = j / 6
            a = a0 + 0.35 * u + (0.08 if j % 2 else -0.08)
            x = x0 + length * (u - 0.5) * (1 if i % 2 else -1)
            pts.append(Vector((x, math.cos(a) * (r + 0.0015), HZ + math.sin(a) * (r + 0.0015))))
        parts.append(kit.chain(f"crack{i}", pts, kit.lerp_list([0.0022, 0.0018, 0.0008], 7), m["bolt"], seg=4))
    return parts


def talismans(m):
    """Bronze tablets hung on jade rings under the drums, each with a few incised strokes."""
    parts = []
    for i, x in enumerate((-0.235, -0.165, 0.165, 0.235)):
        drop = 0.03 + 0.012 * (i % 2)
        ztop = HZ - 0.122
        parts.append(kit.torus(f"tring{i}", (x, 0, ztop - 0.012), 0.011, 0.003, m["jade"], seg=(20, 6), axis=(0, 1, 0)))
        parts.append(kit.chain(f"tcord{i}", [(x, 0, ztop - 0.023), (x, 0, ztop - 0.023 - drop)], [0.0016, 0.0016], m["bronze"], seg=5))
        zc = ztop - 0.023 - drop - 0.032
        parts.append(kit.box(f"tab{i}", (x, 0, zc), (0.03, 0.005, 0.062), m["bronze"], bevel=0.0012, segments=1))
        for s in (1, -1):
            for j, (dx, dz, w, h) in enumerate(((0, 0.018, 0.016, 0.003), (0, 0.004, 0.003, 0.02), (-0.006, -0.014, 0.012, 0.003),
                                                (0.004, -0.02, 0.003, 0.012))):
                parts.append(kit.box(f"glyph{i}{s}{j}", (x + dx, s * 0.0027, zc + dz), (w, 0.0012, h), m["ink"]))
    return parts


def haft(m):
    parts = []
    parts.append(kit.lathe("haft", [(0.021, -0.31), (0.0225, -0.15), (0.0225, 0.15), (0.0215, 0.305)], m["iron"], seg=20))
    for z in (0.25, 0.1, -0.1, -0.25):
        parts.append(kit.lathe(f"hband{z}", [(0.021, z - 0.01), (0.026, z - 0.006), (0.026, z + 0.006), (0.021, z + 0.01)],
                               m["bronze"], seg=24))
    for z in (0.175, -0.175):
        for s in (1, -1):
            parts.append(kit.blob(f"hjade{z}{s}", (0, s * 0.022, z), (0.008, 0.005, 0.014), m["jade"], segs=(12, 8)))
    for z0, flip in ((0.305, 1), (-0.31, -1)):
        parts += collar(m, z0, flip)
    # the butt: a lotus knob, a small bell and two tassels
    zb = -0.39
    parts.append(kit.lathe("knob", [(0.026, -0.31), (0.02, -0.328), (0.015, -0.348), (0.011, -0.368), (0.008, zb + 0.006)], m["bronze"], seg=20))
    parts.append(kit.lathe("bell", [(0.006, zb + 0.004), (0.012, zb - 0.004), (0.016, zb - 0.02), (0.021, zb - 0.034),
                                    (0.022, zb - 0.04), (0.018, zb - 0.042)], m["bronze"], seg=24, cap=(True, False)))
    parts.append(kit.blob("clapper", (0, 0, zb - 0.042), (0.006,) * 3, m["iron"], segs=(10, 6)))
    for sx in (1, -1):
        top = Vector((sx * 0.016, 0, -0.34))
        pts = kit.spline([top, top + Vector((sx * 0.006, 0, -0.025)), top + Vector((sx * 0.01, 0.004, -0.05))], 8)
        parts.append(kit.chain(f"tcord{sx}", pts, [0.0018] * 8, m["bronze"], seg=5))
        parts.append(kit.blob(f"tbead{sx}", pts[-1], (0.006,) * 3, m["jade"], segs=(10, 6)))
        parts.append(kit.lathe(f"tfringe{sx}", [(0.003, -0.006), (0.006, -0.016), (0.008, -0.04), (0.005, -0.042)],
                               m["tassel"], seg=10, centre=pts[-1]))
    return parts


def collar(m, z0, flip):
    """A bronze lotus collar with two horns sweeping out and curling back (top: under the head)."""
    parts = []
    f = flip
    prof = [(0.022, z0 - f * 0.05), (0.03, z0 - f * 0.04), (0.026, z0 - f * 0.028), (0.034, z0 - f * 0.014), (0.04, z0)]
    if f < 0:
        prof = list(reversed(prof))
    parts.append(kit.lathe(f"collar{f}", prof, m["bronze"], seg=28))
    for sx in (1, -1):
        zb = z0 - f * 0.03   # both pairs of horns sweep out and curl upward
        ctrl = [(sx * 0.03, 0, zb), (sx * 0.055, 0, zb + 0.008), (sx * 0.07, 0, zb + 0.03),
                (sx * 0.068, 0, zb + 0.06), (sx * 0.058, 0, zb + 0.075)]
        P = kit.spline(ctrl, 16)
        parts.append(kit.chain(f"horn{f}{sx}", P, kit.lerp_list([(0.011, 0.007), (0.009, 0.006), (0.006, 0.0045), (0.002, 0.002)], 16),
                               m["bronze"], seg=8, side=(0, 1, 0)))
    for s in (1, -1):
        parts.append(kit.blob(f"cgem{f}{s}", (0, s * 0.031, z0 - f * 0.026), (0.009, 0.006, 0.011), m["jade"], segs=(12, 8)))
    return parts


def build():
    coll = kit.collection(WID)
    m = _wp.mats(WID, jade="#6fb894", tassel="#c8a86a")
    m["iron"] = kit.material(f"{WID}_iron", "#33363a", metallic=0.65, roughness=0.55)
    m["bronze"] = kit.material(f"{WID}_bronze", "#a9874c", metallic=1.0, roughness=0.34)
    m["pearl"] = kit.material(f"{WID}_pearl", "#eef2ee", roughness=0.2, coat=0.8, emission="#eef2ff", strength=0.4)
    m["ink"] = kit.material(f"{WID}_ink", "#1c2420", roughness=0.4)
    m["eye"] = kit.material(f"{WID}_eye", "#7fffd0", roughness=0.1, emission="#7fffd0", strength=3.0)
    m["bolt"] = kit.material(f"{WID}_bolt", "#dccfff", roughness=0.3, emission="#c9b6ff", strength=5.0)
    parts = head(m) + cracks(m) + talismans(m) + haft(m)
    az.join_static(WID, parts)
    return coll
