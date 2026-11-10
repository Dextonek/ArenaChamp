"""Shared parts of the second v4 batch (bard, prism, void, ink, chrono, mirror, mason, timber, balloon, ledger, sumo, mime).

Hard-edged shapes (plates, blades, shards, boxes) for a figkit Fig, and a few things the kit has no word for: moving the
body's own skin (a belly, bigger hands), finding the body's surface, bell sleeves, braids, a hood.

How a left-hand prop stands in the game (measured on `Idle_Torch_Loop` in public/models/anim/ual.glb): the grip's `d`
(the T-pose's front) points up, the T-pose's up points to the hero's left, and the fingers' way (X) points forward. So a
flat thing that should face the viewer (a lyre, a mirror, a clock hand, a feather) lies in the plane of `d` and `up`.
"""
import math

import bpy
from mathutils import Vector

from realkit import PI

FINGERS = ("hand_", "index_", "middle_", "ring_", "pinky_", "thumb_")
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def _hard(faces):
    for fc in faces:
        for e in fc.edges:
            e.smooth = False


def plate(f, key, c, outline, u, v, thick=0.01):
    """A flat plate with hard edges: `outline` [(a, b)] along `u` and `v` from `c`; `thick` a number or f(a, b)."""
    bm = f.bm(key)
    c, u, v = Vector(c), Vector(u).normalized(), Vector(v).normalized()
    n = u.cross(v).normalized()
    top, bot = [], []
    for a, b in outline:
        p = c + u * a + v * b
        t = (thick(a, b) if callable(thick) else thick) / 2
        top.append(bm.verts.new(p + n * t))
        bot.append(bm.verts.new(p - n * t))
    faces = [bm.faces.new(top), bm.faces.new(list(reversed(bot)))]
    m = len(top)
    for i in range(m):
        j = (i + 1) % m
        faces.append(bm.faces.new((top[j], top[i], bot[i], bot[j])))
    _hard(faces)


def disc(f, key, c, normal, r, thick=0.01, seg=24, ry=None):
    """A round (or oval) plate facing `normal`."""
    n = Vector(normal).normalized()
    u = n.orthogonal().normalized()
    if abs(n.z) < 0.9:
        u = Z.cross(n).normalized()
    v = n.cross(u).normalized()
    plate(f, key, c, [(r * math.cos(2 * PI * k / seg), (ry or r) * math.sin(2 * PI * k / seg)) for k in range(seg)], u, v, thick)


def box(f, key, c, half, axes=None):
    """A box with hard edges: half sizes along `axes` (three directions; default the world's)."""
    bm = f.bm(key)
    ax = [Vector(a).normalized() for a in (axes or (X, Y, Z))]
    c = Vector(c)
    vs = {}
    for i in (-1, 1):
        for j in (-1, 1):
            for k in (-1, 1):
                vs[(i, j, k)] = bm.verts.new(c + ax[0] * half[0] * i + ax[1] * half[1] * j + ax[2] * half[2] * k)
    quads = [((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)), ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)),
             ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)), ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)),
             ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)), ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
    _hard([bm.faces.new([vs[q] for q in quad]) for quad in quads])


def shard(f, key, a, b, r, n=6, mid=0.35, flat=None):
    """A crystal: a point at `a`, its widest ring `mid` of the way to the point at `b`; `flat` (axis, factor) thins it."""
    bm = f.bm(key)
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = t.orthogonal().normalized()
    if flat:
        ax = Vector(flat[0]).normalized()
        w = ax - t * ax.dot(t)
        if w.length > 1e-4:
            u = w.normalized()
    v = t.cross(u).normalized()
    c = a.lerp(b, mid)
    ring = []
    for k in range(n):
        ang = 2 * PI * (k + 0.5) / n
        ring.append(bm.verts.new(c + u * math.cos(ang) * r * (flat[1] if flat else 1.0) + v * math.sin(ang) * r))
    va, vb = bm.verts.new(a), bm.verts.new(b)
    faces = []
    for k in range(n):
        j = (k + 1) % n
        faces.append(bm.faces.new((va, ring[j], ring[k])))
        faces.append(bm.faces.new((vb, ring[k], ring[j])))
    _hard(faces)


def blade(f, key, base, d, up, length, width, thick=0.02, tip=0.22, waist=None, root=None):
    """A blade with a ridge down both faces: from `base` along `d`, `width` wide along `up`, to a point. `waist` (t, k):
    the width is k times as wide at t of the length (a leaf or a flared blade). `root`: the width at the base."""
    bm = f.bm(key)
    base, d, up = Vector(base), Vector(d).normalized(), Vector(up).normalized()
    n = d.cross(up).normalized()
    secs = [(0.0, (root if root is not None else width))]
    if waist:
        secs.append((waist[0], width * waist[1]))
    secs.append((1 - tip, width))
    rows = []
    for t, w in secs:
        p = base + d * length * t
        rows.append([bm.verts.new(p + up * w / 2), bm.verts.new(p + n * thick / 2), bm.verts.new(p - up * w / 2), bm.verts.new(p - n * thick / 2)])
    apex = bm.verts.new(base + d * length)
    faces = [bm.faces.new(list(reversed(rows[0])))]
    for r0, r1 in zip(rows, rows[1:]):
        for k in range(4):
            faces.append(bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k])))
    last = rows[-1]
    for k in range(4):
        faces.append(bm.faces.new((last[k], last[(k + 1) % 4], apex)))
    _hard(faces)


def flats(R):
    """The kit keeps `flat=True` on its own Fig only: hand it to every piece (call last, before returning R)."""
    for f in R.pieces:
        f.flat |= R.fig.flat
    return R


def staff_back(R, floor=1.28):
    """How far behind the left palm a floor-length staff must reach. A held thing lies along the T-pose's front, so the
    figure's depth stretches it while its height lifts the hand: the kit's 1.28 m holds only when the two are equal."""
    w, d, h, hd = R.build
    return floor * h / d


def round_r(R, r):
    """Radii of a ball that is still round after the figure's build is applied."""
    w, d, h, hd = R.build
    return (r / w, r / d, r / h)


def reshape(R, fn):
    """Moves the body's own skin: fn(co, index) -> a new co or None. Call before anything is cut from the body."""
    body = R.body
    mw, inv = body.matrix_world, body.matrix_world.inverted()
    for v in body.data.vertices:
        q = fn(mw @ v.co, v.index)
        if q is not None:
            v.co = inv @ q
    body.data.update()
    R._read()


def belly(R, amount=0.1, z=None, spread=0.2, back=0.25, power=1.3, groups=("pelvis", "spine_01", "spine_02", "spine_03", "thigh")):
    """A belly: the trunk's skin pushed out from its own axis round height `z`, most at the front, `back` of it behind."""
    z = R.z["waist"] if z is None else z
    c = R.ring(z)[0]

    def fn(p, i):
        if not R.dom[i].startswith(groups):
            return None
        k = math.exp(-((p.z - z) / spread) ** 2)
        if k < 0.01:
            return None
        out = Vector((p.x - c.x, p.y - c.y, 0))
        if out.length < 1e-5:
            return None
        o = out.normalized()
        g = back + (1 - back) * ((1 - o.y) / 2) ** power      # -o.y: 1 at the front, -1 at the back
        return p + o * amount * k * g
    reshape(R, fn)


def big_hands(R, k=1.3):
    """The hands and fingers `k` times as big, skin and bones (the clips turn bones, so longer fingers still bend right)."""
    body, rig = R.body, R.rig
    idx = {g.index: g.name for g in body.vertex_groups if g.name.startswith(FINGERS)}
    wrist = {n: R.bone(f"hand_{n}") for n in "lr"}
    wts = {}
    for v in body.data.vertices:
        s = sum(g.weight for g in v.groups if g.group in idx)
        if s > 0.01:
            wts[v.index] = min(1.0, s)

    def fn(p, i):
        w = wts.get(i)
        if not w:
            return None
        o = wrist["l" if p.x > 0 else "r"]
        return o + (p - o) * (1 + (k - 1) * w)
    reshape(R, fn)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    inv = rig.matrix_world.inverted()
    for b in rig.data.edit_bones:
        if not b.name.startswith(FINGERS):
            continue
        o = inv @ wrist[b.name[-1]]
        if not b.name.startswith("hand_"):
            b.head = o + (b.head - o) * k
        b.tail = o + (b.tail - o) * k
    bpy.ops.object.mode_set(mode="OBJECT")
    R._read()


def front_y(R, x, z, dx=0.035, dz=0.035, groups=("pelvis", "spine", "clavicle", "thigh", "neck")):
    """The y of the body's front surface near (x, z)."""
    ys = [p.y for p, d in zip(R.world, R.dom) if abs(p.x - x) < dx and abs(p.z - z) < dz and d.startswith(groups)]
    if not ys:
        return front_y(R, x, z, dx * 2, dz * 2, groups) if dx < 0.3 else 0.0
    return min(ys)


def back_y(R, x, z, dx=0.035, dz=0.035, groups=("pelvis", "spine", "clavicle", "thigh", "neck")):
    ys = [p.y for p, d in zip(R.world, R.dom) if abs(p.x - x) < dx and abs(p.z - z) < dz and d.startswith(groups)]
    if not ys:
        return back_y(R, x, z, dx * 2, dz * 2, groups) if dx < 0.3 else 0.0
    return max(ys)


def on_front(R, x, z, off=0.012):
    return Vector((x, front_y(R, x, z) - off, z))


def on_back(R, x, z, off=0.012):
    return Vector((x, back_y(R, x, z) + off, z))


def bell_sleeves(R, mat, k0=1.25, k1=2.6, t0=0.1, t1=0.98, drop=0.5, trim=None, trim_r=0.008, seg=14):
    """Wide sleeves over the forearms: `k0` times the arm's radius at the elbow, `k1` at the wrist, hanging `drop` of
    the extra radius below the arm. The material should be double-sided: the sleeve is open at the wrist."""
    for n in "lr":
        f = R.piece(f"lowerarm_{n}")
        pts, rad = [], []
        for i in range(5):
            t = t0 + (t1 - t0) * i / 4
            c, r = R.arm_r(n, t)
            k = k0 + (k1 - k0) * (i / 4) ** 1.4
            pts.append(c + Vector((0, 0, -r * (k - 1) * drop)))
            rad.append(r * k)
        f.tube(mat, pts, rad, seg=seg, caps=False)
        if trim:
            f.torus(trim, pts[-1], rad[-1], trim_r, normal=(pts[-1] - pts[-2]), seg=(24, 6))


def braid(f, key, pts, r, squash=0.8):
    """A plait: overlapping beads along `pts`, `r` a number or one per point."""
    pts = [Vector(p) for p in pts]
    for i, p in enumerate(pts):
        rr = r[i] if isinstance(r, (list, tuple)) else r
        s = 1 if i % 2 else -1
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.cross(Y)
        if a.length < 1e-3:
            a = t.cross(X)
        f.ellipsoid(key, p + a.normalized() * rr * 0.22 * s, (rr, rr * squash, rr * 1.15), seg=(10, 6))


def path(pts, n=12):
    """A smooth line through a few points (Catmull-Rom), `n` steps per span."""
    pts = [Vector(p) for p in pts]
    if len(pts) < 3:
        return pts
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


def ellipse(c, rx, ry, a0=0.0, a1=2 * PI, n=36, z=None):
    """Points round the body's upright axis (0 the front, pi/2 its left, pi the back)."""
    c = Vector(c)
    return [Vector((c.x + rx * math.sin(a0 + (a1 - a0) * k / n), c.y - ry * math.cos(a0 + (a1 - a0) * k / n), c.z if z is None else z)) for k in range(n + 1)]


def hood(f, key, c, hr, open_y=0.42, edge=None, edge_r=0.014, tail=None):
    """A hood round the head: open at the face (`open_y` of its radius before the centre), an optional rolled edge and a
    point down the back."""
    c = Vector(c)
    f.ellipsoid(key, c, (hr, hr * 1.05, hr * 1.08), seg=(26, 16), keep=lambda co: co.y > c.y - hr * open_y)
    if edge:
        k = math.sqrt(max(0.05, 1 - (open_y / 1.05) ** 2))
        f.torus(edge, Vector((c.x, c.y - hr * open_y, c.z)), hr * k * 1.0, edge_r, normal=(0, 1, 0), seg=(28, 6))
    if tail:
        f.tube(key, [c + Vector((0, hr * 0.8, hr * 0.5)), c + Vector((0, hr * 1.35, -hr * 0.2)), c + Vector((0, hr * 1.2, -hr * tail))], [hr * 0.6, hr * 0.42, 0.006], seg=10)


def skirt_rings(R, hem, flare=1.5, depth=1.3, top=None, grow=1.0):
    """The rings `R.skirt` lofts through (bottom to top), to place things on a skirt's surface."""
    z = R.z
    top = z["waist"] if top is None else top
    cw, rxw, ryw = R.ring(top)
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    mid = (hem + ch.z) / 2
    k = min(1.0, (ch.z - hem) / 0.25)
    if hem > ch.z - 0.04:
        return [(Vector((ch.x, ch.y, hem)), rxh * flare * grow, ryh * flare * depth * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]
    return [(Vector((ch.x, ch.y - 0.01 * k, hem)), rxh * flare * grow, ryh * flare * depth * grow),
            (Vector((ch.x, ch.y - 0.005 * k, mid)), rxh * (1.24 + (flare - 1.24) * 0.55) * grow, ryh * (1.34 + (flare * depth - 1.34) * 0.5) * grow),
            (ch, rxh * 1.24 * grow, ryh * 1.34 * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]


def ring_pt(rings, a, zz, off=0.0):
    """The point at angle `a` and height `zz` on a loft through `rings`, `off` outside it."""
    rings = sorted(rings, key=lambda r: r[0].z)
    zz = max(rings[0][0].z, min(rings[-1][0].z, zz))
    for (c0, rx0, ry0), (c1, rx1, ry1) in zip(rings, rings[1:]):
        if zz <= c1.z + 1e-9:
            t = (zz - c0.z) / max(1e-6, c1.z - c0.z)
            c = c0.lerp(c1, t)
            rx, ry = rx0 + (rx1 - rx0) * t + off, ry0 + (ry1 - ry0) * t + off
            return Vector((c.x + rx * math.sin(a), c.y - ry * math.cos(a), zz))
    return rings[-1][0].copy()


def on_ring(f, key, rings, a, zz, outline, thick=0.008, off=0.006):
    """A flat plate lying on a loft's surface at (a, zz): `outline` [(across, up the surface)]."""
    p = ring_pt(rings, a, zz, off)
    up = ring_pt(rings, a, zz + 0.03, off) - ring_pt(rings, a, zz - 0.03, off)
    across = ring_pt(rings, a + 0.05, zz, off) - ring_pt(rings, a - 0.05, zz, off)
    if up.length < 1e-6:
        up = Z
    plate(f, key, p, outline, across, up, thick)


def diamond(w, h):
    return [(0, h), (w, 0), (0, -h), (-w, 0)]


def hair_key(R, which=0):
    """The material key of the hair (`R.hair` names it by a count): for built hair, braids, a topknot."""
    return [k for k in R.M if k.startswith("hair_")][which]


ARM = ("upperarm_", "lowerarm_")


def arms(R, length=1.0, thick_y=1.0, thick_z=1.0):
    """The arms' own build, before the figure's: `length` times as long from shoulder to wrist (the hand keeps its size),
    `thick_y` and `thick_z` times as thick. For a very wide figure, whose width would stretch the arms too."""
    body, rig = R.body, R.rig
    arm_i = {g.index for g in body.vertex_groups if g.name.startswith(ARM)}
    hand_i = {g.index for g in body.vertex_groups if g.name.startswith(FINGERS)}
    sh = {n: R.bone(f"upperarm_{n}") for n in "lr"}
    wr = {n: R.bone(f"hand_{n}") for n in "lr"}
    wt = {}
    for v in body.data.vertices:
        a = sum(g.weight for g in v.groups if g.group in arm_i)
        hn = sum(g.weight for g in v.groups if g.group in hand_i)
        if a + hn > 0.01:
            wt[v.index] = (min(1.0, a + hn), min(1.0, a))

    def mapx(x, n):
        s, w = sh[n].x, wr[n].x
        if abs(x) <= abs(s):
            return x
        if abs(x) <= abs(w):
            return s + (x - s) * length
        return s + (w - s) * length + (x - w)

    def fn(p, i):
        t = wt.get(i)
        if not t:
            return None
        n = "l" if p.x > 0 else "r"
        ax = sh[n]
        return Vector((p.x + (mapx(p.x, n) - p.x) * t[0], ax.y + (p.y - ax.y) * (1 + (thick_y - 1) * t[1]), ax.z + (p.z - ax.z) * (1 + (thick_z - 1) * t[1])))
    reshape(R, fn)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    mw, inv = rig.matrix_world, rig.matrix_world.inverted()
    for b in rig.data.edit_bones:
        if not b.name.startswith(ARM + FINGERS):
            continue
        n = b.name[-1]
        for end in ("head", "tail"):
            q = mw @ getattr(b, end)
            q.x = mapx(q.x, n)
            setattr(b, end, inv @ q)
    bpy.ops.object.mode_set(mode="OBJECT")
    R._read()


def arm_top(R, n, t, way, bones=("lowerarm", "hand"), off=0.006, dx=0.025, lat=0.03):
    """The point on that arm's skin, `t` of the way along it, on the side facing `way`."""
    e, w = R.bone(f"{bones[0]}_{n}"), R.bone(f"{bones[1]}_{n}")
    c = e.lerp(w, t)
    way = Vector(way).normalized()
    best = None
    for p, d in zip(R.world, R.dom):
        if abs(p.x - c.x) < dx and p.x * c.x > 0 and d.startswith(("lowerarm_", "upperarm_", "hand_")):
            r = p - c
            hgt = r.dot(way)
            side = r - way * hgt
            side.x = 0
            if side.length < lat and (best is None or hgt > best):
                best = hgt
    return c + way * ((best if best is not None else 0.04) + off)


def ring_at(rings, zz, off=0.0):
    """(centre, rx, ry) of a loft through `rings` at height `zz`."""
    rings = sorted(rings, key=lambda r: r[0].z)
    zz = max(rings[0][0].z, min(rings[-1][0].z, zz))
    for (c0, rx0, ry0), (c1, rx1, ry1) in zip(rings, rings[1:]):
        if zz <= c1.z + 1e-9:
            t = (zz - c0.z) / max(1e-6, c1.z - c0.z)
            return c0.lerp(c1, t), rx0 + (rx1 - rx0) * t + off, ry0 + (ry1 - ry0) * t + off
    c, rx, ry = rings[-1]
    return c.copy(), rx + off, ry + off


def skirt_band(f, key, rings, z0, z1, off=0.004, seg=36, arc=None, steps=3):
    """A band lying on a skirt between two heights (a hem washed in ink, a front panel)."""
    f.loft(key, [ring_at(rings, z0 + (z1 - z0) * k / steps, off) for k in range(steps + 1)], seg=seg, arc=arc)


def edge_line(f, key, rings, a, z0, z1, r=0.008, off=0.004, n=8):
    """A cord down a skirt at angle `a` (the edge of an open front or of a panel)."""
    f.tube(key, [ring_pt(rings, a, z0 + (z1 - z0) * k / n, off) for k in range(n + 1)], r, seg=6)


def open_front(R, top=0.075, bottom=0.02, z0=None, z1=None):
    """A test for `R.fitted(where=...)`: everything but a V down the front, `top` half-wide at the neck, `bottom` at the waist."""
    z0 = R.z["waist"] - 0.06 if z0 is None else z0
    z1 = R.z["neck"] + 0.03 if z1 is None else z1

    def where(p):
        if p.y > 0.03 or p.z < z0:
            return True
        t = max(0.0, min(1.0, (p.z - z0) / (z1 - z0)))
        return abs(p.x) > bottom + (top - bottom) * t
    return where


def lapels(R, f, key, top=0.075, bottom=0.02, z0=None, z1=None, r=0.016, off=0.016, n=8):
    """Rolled edges down both sides of that V."""
    z0 = R.z["waist"] - 0.06 if z0 is None else z0
    z1 = R.z["neck"] - 0.005 if z1 is None else z1
    zt = R.z["neck"] + 0.03
    for s in (1, -1):
        pts = []
        for k in range(n + 1):
            zz = z1 + (z0 - z1) * k / n
            t = max(0.0, min(1.0, (zz - z0) / (zt - z0)))
            x = (bottom + (top - bottom) * t + r * 0.4) * s
            pts.append(on_front(R, x, zz, off))
        f.tube(key, pts, r, seg=7, squash=((0, 1, 0), 0.5))


def legs_under(R, mat, offset=0.004, name="Hose", x0=0.085, drop=0.07):
    """Hose or trousers under a skirt or a coat: the legs' own surface, but not the outside of the hip, which is wider
    than a skirt is just under its waist and would show through it (that skin is removed)."""
    hipz = R.z["hip"] - drop

    def outer(i):
        return R.dom[i].startswith("thigh") and R.world[i].z > hipz and abs(R.world[i].x) > x0
    R.fitted(name, lambda i: R.dom[i].startswith(("thigh", "calf")) and not outer(i), mat, offset=offset)
    R.covered.update(i for i in range(len(R.world)) if outer(i))


def neck_band(R, mat, z0=-0.03, z1=0.055, grow=1.1):
    """A close band round the neck itself, bound to the neck (which takes the head's size, not the body's): it hides a
    garment's cut edge where a collar on the shoulders stands away from it. Use a double-sided material."""
    z = R.z["neck"]
    neck = [p for p, d in zip(R.world, R.dom) if d == "neck_01" and abs(p.z - (z + 0.02)) < 0.03]
    cx, cy = sum(p.x for p in neck) / len(neck), sum(p.y for p in neck) / len(neck)
    rx, ry = max(abs(p.x - cx) for p in neck), max(abs(p.y - cy) for p in neck)
    f = R.piece("neck_01")
    f.loft(mat, [(Vector((cx, cy, z + z0)), rx * 1.34 * grow, ry * 1.3 * grow), (Vector((cx, cy, z + (z0 + z1) / 2)), rx * 1.1 * grow, ry * 1.1 * grow),
                 (Vector((cx, cy, z + z1)), rx * 1.03 * grow, ry * 1.03 * grow)], seg=24)
    return f
