"""Shared parts of the heroes of batch C (referee, chef, courier, janitor, mole, weather, sheep, magic, door, pim, pom),
on top of realkit.py and figkit.py: cloth that falls in folds, forms with oval sections, caps and helms with a clean
rim, straps and panels laid on the trunk's own surface, small wings, and the Changeling Twins' one shared body.

Stateless: every function takes the `Real` (or one of its pieces); nothing of Blender is kept between heroes.
Angles round the body start at the front (0), go to its left (pi/2) and its back (pi), as in figkit.
"""
import math
from types import SimpleNamespace

import bmesh
import numpy as np
from mathutils import Matrix, Vector

from realkit import PI, Real

FINGERS = ("index_", "middle_", "ring_", "pinky_", "thumb_")
HAND = ("hand_",) + FINGERS
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def along(R):
    """What a length along a held thing must be multiplied by, so that it comes out in the figure's own height: the
    build scales the hand's front axis by `depth` and the hand's height by `height`."""
    w, d, h, hd = R.build
    return h / d


def rr(R, r):
    """Radii of a ball in a hand that stays round after the build is applied."""
    w, d, h, hd = R.build
    return (r / w, r / d, r / h)


def rot_to(n):
    """A rotation that turns the Z axis to `n` (for a flat ellipsoid or a lens facing `n`)."""
    return Vector(n).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()


def hair(R, style, color, beard=None, rough=0.5):
    """Hair and brows, and a beard of the pack in the same material."""
    key = f"hair_{len(R.M)}"
    R.hair(style, color, rough=rough)
    if beard:
        ob = R.hair(beard, color, rough=rough, brows=False)
        ob.data.materials.clear()
        ob.data.materials.append(R.M[key])
    return key


# ---- cloth ----------------------------------------------------------------------------------------------------------
def ring_at(rings, z):
    """The outline (centre, rx, ry) at height z of stacked rings (bottom to top), smoothly between them."""
    n = len(rings)
    zs = [Vector(r[0]).z for r in rings]
    vals = [np.array((Vector(r[0]).x, Vector(r[0]).y, r[1], r[2]), dtype=float) for r in rings]
    if z <= zs[0]:
        v = vals[0]
    elif z >= zs[-1]:
        v = vals[-1]
    else:
        i = max(k for k in range(n - 1) if zs[k] <= z)
        h = zs[i + 1] - zs[i]
        t = (z - zs[i]) / h

        def m(j):
            a, b = max(0, j - 1), min(n - 1, j + 1)
            return (vals[b] - vals[a]) / (zs[b] - zs[a])
        t2, t3 = t * t, t * t * t
        v = (2 * t3 - 3 * t2 + 1) * vals[i] + (t3 - 2 * t2 + t) * h * m(i) + (-2 * t3 + 3 * t2) * vals[i + 1] + (t3 - t2) * h * m(i + 1)
        # never thinner than the thinner of the two rings it lies between
        for q in (2, 3):
            v[q] = max(v[q], min(vals[i][q], vals[i + 1][q]))
    return Vector((v[0], v[1], z)), float(v[2]), float(v[3])


def cloth(f, key, rings, arc=None, seg=40, rows=12, folds=0, amp=0.0, phase=0.0, power=1.4, z0=None, z1=None, off=0.0, fade=0.12):
    """Cloth over stacked rings (as Fig.loft), cut into `rows` and falling in folds: `folds` waves round the whole
    circle, `amp` m deep at the lowest ring and none at the top one. `z0`, `z1`: only that part of the height (a hem
    trim, with `off` m more radius, follows the same folds). An arc's folds die away toward its two edges."""
    bm = f.bm(key)
    lo, hi = Vector(rings[0][0]).z, Vector(rings[-1][0]).z
    z0 = lo if z0 is None else z0
    z1 = hi if z1 is None else z1
    a0, a1 = arc or (0.0, 2 * PI)
    n = seg if arc is None else seg + 1
    f2 = round(folds * 1.5)
    grid = []
    for j in range(rows + 1):
        zz = z0 + (z1 - z0) * j / rows
        c, rx, ry = ring_at(rings, zz)
        u = max(0.0, 1 - (zz - lo) / max(1e-6, hi - lo))
        row = []
        for k in range(n):
            a = a0 + (a1 - a0) * k / seg
            o = off
            if folds and amp:
                w = amp * u ** power
                if arc is not None and fade > 0:
                    w *= smooth(min(k, seg - k) / seg / fade)
                o += w * (math.cos(folds * a + phase) + 0.35 * math.cos(f2 * a + phase * 2.1 + 1.3))
            row.append(bm.verts.new((c.x + (rx + o) * math.sin(a), c.y - (ry + o) * math.cos(a), zz)))
        grid.append(row)
    for r0, r1 in zip(grid, grid[1:]):
        for k in range(n if arc is None else n - 1):
            bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    return grid


def skirt_rings(R, hem, flare=1.5, depth=1.3, top=None, grow=1.0):
    """The rings of realkit's skirt: from the waist (`top`) over the hips to `hem`."""
    z = R.z
    top = z["waist"] if top is None else top
    cw, rxw, ryw = R.ring(top)
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    if hem > ch.z - 0.04:
        return [(Vector((ch.x, ch.y, hem)), rxh * flare * grow, ryh * flare * depth * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]
    mid = (hem + ch.z) / 2
    k = min(1.0, (ch.z - hem) / 0.25)
    return [(Vector((ch.x, ch.y - 0.01 * k, hem)), rxh * flare * grow, ryh * flare * depth * grow),
            (Vector((ch.x, ch.y - 0.005 * k, mid)), rxh * (1.24 + (flare - 1.24) * 0.55) * grow, ryh * (1.34 + (flare * depth - 1.34) * 0.5) * grow),
            (ch, rxh * 1.24 * grow, ryh * 1.34 * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]


def skirt(R, key, hem, flare=1.5, depth=1.3, top=None, arc=None, folds=10, amp=0.02, trim=None, trim_h=0.025, grow=1.0, seg=48, rows=12,
          phase=0.0, how=None, power=1.4):
    """realkit's skirt, falling in folds. Returns (piece, rings): panels, seams and trims can be laid on the rings."""
    top = R.z["waist"] if top is None else top
    rings = skirt_rings(R, hem, flare, depth, top, grow)
    f = R.piece(how or R.hang_w(top, hem))
    cloth(f, key, rings, arc, seg, rows, folds, amp, phase, power)
    if trim:
        cloth(f, trim, rings, arc, seg, 1, folds, amp, phase, power, z0=hem - 0.003, z1=hem + trim_h, off=0.005)
    return f, rings


def seam(f, key, rings, a, r=0.008, off=0.008, z0=None, z1=None, n=12, squash=None):
    """A cord or braid down a skirt's rings at angle a."""
    lo, hi = Vector(rings[0][0]).z, Vector(rings[-1][0]).z
    z0 = lo if z0 is None else z0
    z1 = hi if z1 is None else z1
    pts = []
    for k in range(n + 1):
        c, rx, ry = ring_at(rings, z0 + (z1 - z0) * k / n)
        pts.append(Vector((c.x + (rx + off) * math.sin(a), c.y - (ry + off) * math.cos(a), c.z)))
    f.tube(key, pts, r, seg=6, squash=squash)
    return pts


def trunk_w(R, hem=None):
    """Weights for cloth that lies on the trunk and hangs on over the legs: the spine by height, then realkit's hang."""
    z = R.z
    hang = R.hang_w(z["waist"], z["knee"] if hem is None else hem)
    chain = ["pelvis", "spine_01", "spine_02", "spine_03"]

    def w(co):
        if co.z >= z["chest"]:
            return {"spine_03": 1.0}
        if co.z >= z["waist"]:
            t = (co.z - z["waist"]) / (z["chest"] - z["waist"]) * 3
            i = min(2, int(t))
            t -= i
            out = {chain[i]: 1 - t}
            if t > 0.001:
                out[chain[i + 1]] = t
            return out
        return hang(co)
    return w


def cape_w(R, soft=0.0):
    """Weights for a cape down the back: the chest above, the hips below, and a little of each thigh under the hips."""
    z = R.z
    hip, chest = z["hip"], z["chest"]

    def w(co):
        if co.z > chest:
            return {"spine_03": 1.0}
        if co.z > hip:
            t = (co.z - hip) / (chest - hip)
            return {"spine_03": t, "pelvis": 1 - t}
        if soft <= 0:
            return {"pelvis": 1.0}
        s = soft * min(1.0, (hip - co.z) / 0.4)
        left = max(0.0, min(1.0, 0.5 + co.x / 0.2))
        return {"pelvis": 1 - s, "thigh_l": s * left + 1e-4, "thigh_r": s * (1 - left) + 1e-4}
    return w


def head_spine_w(R, z_head, z_spine):
    """Weights for a braid or a hood's tail: the head above `z_head`, the chest below `z_spine`."""
    def w(co):
        t = smooth((co.z - z_spine) / max(1e-4, z_head - z_spine))
        out = {}
        if t > 0.001:
            out["Head"] = t
        if t < 0.999:
            out["spine_03"] = 1 - t
        return out
    return w


# ---- the trunk's own surface ----------------------------------------------------------------------------------------
def _trunk(R):
    if not hasattr(R, "_c_trunk"):
        idx = [i for i, d in enumerate(R.dom) if d.startswith(("pelvis", "spine", "clavicle", "neck", "thigh"))]
        R._c_trunk = np.array([R.world[i][:] for i in idx], dtype=float)
    return R._c_trunk


def surf(R, z, a, dz=0.022, da=0.17):
    """How far the trunk's surface is from the body's upright axis at height z in direction a."""
    P = _trunk(R)
    for grow in (1, 2, 4):
        Q = P[np.abs(P[:, 2] - z) < dz * grow]
        if len(Q):
            ang = np.arctan2(Q[:, 0], -Q[:, 1])
            d = np.abs((ang - a + np.pi) % (2 * np.pi) - np.pi)
            rad = np.hypot(Q[:, 0], Q[:, 1])[d < da * grow]
            if len(rad):
                return float(rad.max())
    return 0.12


def on_trunk(R, z, a, off=0.0):
    """A point on the trunk's surface (pushed out by `off`) and the way out there."""
    r = surf(R, z, a) + off
    n = Vector((math.sin(a), -math.cos(a), 0))
    return Vector((r * math.sin(a), -r * math.cos(a), z)), n


def trunk_path(R, stations, off=0.012, n=20):
    """Points and outward directions along a path over the trunk through `stations` [(z, a), ...]."""
    L = [0.0]
    for (z0, a0), (z1, a1) in zip(stations, stations[1:]):
        L.append(L[-1] + math.hypot(z1 - z0, (a1 - a0) * 0.15) + 1e-6)
    zs, as_, rs = [], [], []
    for k in range(n + 1):
        s = L[-1] * k / n
        i = max(j for j in range(len(L) - 1) if L[j] <= s + 1e-9)
        t = (s - L[i]) / (L[i + 1] - L[i])
        zz = stations[i][0] + (stations[i + 1][0] - stations[i][0]) * t
        aa = stations[i][1] + (stations[i + 1][1] - stations[i][1]) * t
        zs.append(zz)
        as_.append(aa)
        rs.append(surf(R, zz, aa))
    # the surface is sampled from vertices: smooth it along the path
    for _ in range(2):
        rs = [rs[0]] + [(rs[i - 1] + 2 * rs[i] + rs[i + 1]) / 4 for i in range(1, n)] + [rs[-1]]
    pts = [Vector(((r + off) * math.sin(a), -(r + off) * math.cos(a), zz)) for r, a, zz in zip(rs, as_, zs)]
    nrm = [Vector((math.sin(a), -math.cos(a), 0)) for a in as_]
    return pts, nrm


def band_on(R, f, key, stations, width, thick=0.008, off=0.012, n=20, seg=8):
    """A strap, a braid or a lapel lying on the trunk through `stations` [(z, a), ...]."""
    pts, nrm = trunk_path(R, stations, off, n)
    sides = []
    for i in range(len(pts)):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        sides.append(t.cross(nrm[i]))
    w = width if isinstance(width, (list, tuple)) else [width] * len(pts)
    hull(f, key, pts, [x / 2 for x in w], thick / 2, seg=seg, side=sides)
    return pts, nrm


def wrap(R, f, key, z0, z1, a0, a1, off=0.02, seg=10, rows=10, taper=None):
    """A panel lying on the trunk between two heights and two angles (a shirt front, a tabard's chest, a bib).
    `taper` (t0, t1): the panel's width at the bottom and the top against its angles (a V front)."""
    bm = f.bm(key)
    R_ = []
    for j in range(rows + 1):
        zz = z0 + (z1 - z0) * j / rows
        k = 1.0 if taper is None else taper[0] + (taper[1] - taper[0]) * j / rows
        am, ah = (a0 + a1) / 2, (a1 - a0) / 2 * k
        R_.append([(surf(R, zz, am + ah * (2 * i / seg - 1)), am + ah * (2 * i / seg - 1), zz) for i in range(seg + 1)])
    # smooth the sampled radii over the panel
    rad = np.array([[q[0] for q in row] for row in R_])
    for _ in range(2):
        p = np.pad(rad, 1, mode="edge")
        rad = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * rad) / 8
    grid = []
    for j, row in enumerate(R_):
        grid.append([bm.verts.new(((rad[j][i] + off) * math.sin(a), -(rad[j][i] + off) * math.cos(a), zz)) for i, (_, a, zz) in enumerate(row)])
    for r0, r1 in zip(grid, grid[1:]):
        for i in range(seg):
            bm.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i]))
    return grid


# ---- forms ----------------------------------------------------------------------------------------------------------
def hull(f, key, pts, rx, rz=None, seg=14, side=X, caps=True):
    """A smooth form along a path with oval sections: half width rx[i] toward `side` (one vector or one per point),
    half height rz[i] across it."""
    bm = f.bm(key)
    pts = [Vector(p) for p in pts]
    n = len(pts)
    rx = list(rx) if isinstance(rx, (list, tuple)) else [rx] * n
    rz = rx if rz is None else (list(rz) if isinstance(rz, (list, tuple)) else [rz] * n)
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        s = Vector(side[i]) if isinstance(side, list) else Vector(side)
        a = s - t * s.dot(t)
        if a.length < 1e-6:
            a = t.orthogonal()
        a.normalize()
        b = t.cross(a).normalized()
        rings.append([bm.verts.new(p + a * (rx[i] * math.cos(2 * PI * k / seg)) + b * (rz[i] * math.sin(2 * PI * k / seg))) for k in range(seg)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])


def curl(c, u, v, r0, r1, a0, a1, n=16, drift=None):
    """Points on a spiral round `c` in the plane of u and v: radius r0 to r1, angle a0 to a1, moving by `drift` in all."""
    c, u, v = Vector(c), Vector(u).normalized(), Vector(v).normalized()
    out = []
    for k in range(n + 1):
        t = k / n
        a = a0 + (a1 - a0) * t
        p = c + (u * math.cos(a) + v * math.sin(a)) * (r0 + (r1 - r0) * t)
        out.append(p + Vector(drift) * t if drift is not None else p)
    return out


def plate(f, key, pts, thick, normal=None):
    """A flat cut-out shape: the outline `pts` in order, `thick` m thick."""
    bm = f.bm(key)
    pts = [Vector(p) for p in pts]
    if normal is None:
        normal = Vector((0, 0, 0))
        for i in range(len(pts)):
            normal += pts[i].cross(pts[(i + 1) % len(pts)])
    n = Vector(normal).normalized()
    front = [bm.verts.new(p + n * thick / 2) for p in pts]
    back = [bm.verts.new(p - n * thick / 2) for p in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    m = len(pts)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((front[j], front[i], back[i], back[j]))


def star(f, key, c, point, normal, big, small, thick=0.012, points=5):
    """A flat star at c facing `normal`, one of its points toward `point`."""
    bm = f.bm(key)
    n = Vector(normal).normalized()
    u = Vector(point)
    u = (u - n * u.dot(n)).normalized()
    v = n.cross(u)
    front, back = [], []
    for i in range(points * 2):
        a = PI * i / points
        r = big if i % 2 == 0 else small
        p = Vector(c) + (u * math.cos(a) + v * math.sin(a)) * r
        front.append(bm.verts.new(p + n * thick / 2))
        back.append(bm.verts.new(p - n * thick / 2))
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    m = len(front)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((front[j], front[i], back[i], back[j]))


def box(f, key, c, half, ax=X, ay=Y):
    """A box at c: half sizes along `ax`, `ay` and the axis across both."""
    bm = f.bm(key)
    ax = Vector(ax).normalized()
    ay = Vector(ay)
    ay = (ay - ax * ay.dot(ax)).normalized()
    az = ax.cross(ay)
    m = Matrix((ax, ay, az)).transposed().to_4x4()
    bmesh.ops.create_cube(bm, size=2.0, matrix=Matrix.Translation(Vector(c)) @ m @ Matrix.Diagonal((half[0], half[1], half[2], 1.0)))


def shell(f, key, c, r, edge, seg=32, rows=9, rim=None, rim_r=0.008):
    """A cap, a helm or a hood: the part of the ellipsoid (c, r) above a rim. `edge(a)` says how low the rim is at
    angle a round the head: 1 the very top, 0 the middle, -1 the bottom. Returns the rim's points."""
    bm = f.bm(key)
    c = Vector(c)
    top = bm.verts.new(c + Vector((0, 0, r[2])))
    grid = []
    for k in range(1, rows + 1):
        row = []
        for j in range(seg):
            a = 2 * PI * j / seg
            th = math.acos(max(-1.0, min(1.0, edge(a)))) * k / rows
            row.append(bm.verts.new(c + Vector((r[0] * math.sin(th) * math.sin(a), -r[1] * math.sin(th) * math.cos(a), r[2] * math.cos(th)))))
        grid.append(row)
    for j in range(seg):
        bm.faces.new((top, grid[0][j], grid[0][(j + 1) % seg]))
    for r0, r1 in zip(grid, grid[1:]):
        for j in range(seg):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % seg], r0[(j + 1) % seg]))
    pts = [v.co.copy() for v in grid[-1]]
    if rim:
        f.tube(rim, pts + pts[:2], rim_r, seg=6, caps=False)
    return pts


def rim_line(front, side, back=None, w0=0.55, w1=1.15):
    """A rim for `shell`: `front` high over the face, `side` over the ears, `back` at the nape."""
    back = side if back is None else back

    def e(a):
        a = abs((a + PI) % (2 * PI) - PI)
        v = front + (side - front) * smooth((a - w0) / (w1 - w0))
        return v + (back - side) * smooth((a - 1.9) / 0.9)
    return e


def on_shell(c, r, a, e):
    """The point of the ellipsoid (c, r) at angle a and height e (as `shell`'s edge), and the way out there."""
    th = math.acos(max(-1.0, min(1.0, e)))
    d = Vector((r[0] * math.sin(th) * math.sin(a), -r[1] * math.sin(th) * math.cos(a), r[2] * math.cos(th)))
    n = Vector((d.x / r[0] ** 2, d.y / r[1] ** 2, d.z / r[2] ** 2)).normalized()
    return Vector(c) + d, n


def wing(f, key, root, out, up, length=0.16, n=4, spread=1.0, thin=None, wide=0.2):
    """A small wing: `n` broad feathers fanned from `root`, the longest along `out`, the others turning toward -`up`
    and shorter, overlapping into one wing shape; flat across `thin`."""
    out, up = Vector(out).normalized(), Vector(up).normalized()
    up = (up - out * up.dot(out)).normalized()
    nrm = Vector(thin).normalized() if thin is not None else out.cross(up)
    root = Vector(root)
    for k in range(n):
        t = k / max(1, n - 1)
        a = spread * t
        d = out * math.cos(a) - up * math.sin(a)
        ln = length * (1 - 0.5 * t)
        w = ln * wide
        f.tube(key, [root - d * 0.01, root + d * ln * 0.3, root + d * ln * 0.62 + up * ln * 0.03, root + d * ln], [w * 0.5, w * 0.95, w, 0.003], seg=8, squash=(tuple(nrm), 0.2))
    f.ellipsoid(key, root, (length * 0.14,) * 3, seg=(10, 8))


def toes(R, key, size=1.0):
    """A shoe's toe box and vamp over the toes of realkit's boots (the fitted boot keeps every toe's shape, and the
    body's feet are not centred on their bones): measured from the feet themselves."""
    for n in "lr":
        heel, tb = R.bone(f"foot_{n}"), R.bone(f"ball_{n}")
        toe = [p for p, d in zip(R.world, R.dom) if d == f"ball_{n}"]
        foot = [p for p, d in zip(R.world, R.dom) if d == f"foot_{n}"]
        x0, x1, y0, z1 = min(p.x for p in toe), max(p.x for p in toe), min(p.y for p in toe), max(p.z for p in toe)
        top = z1 + 0.024 * size
        R.piece(f"ball_{n}").ellipsoid(key, Vector(((x0 + x1) / 2, y0 + 0.049, (top - 0.008) / 2)), (((x1 - x0) / 2 + 0.02) * size, 0.073 * size, (top + 0.008) / 2), seg=(16, 10))
        x0, x1 = min(p.x for p in foot), max(p.x for p in foot)
        R.piece(f"foot_{n}").ellipsoid(key, Vector(((x0 + x1) / 2, (heel.y + tb.y) / 2 - 0.01, 0.05)), (((x1 - x0) / 2 + 0.012) * size, 0.13 * size, 0.058 * size), seg=(16, 10))


def puffs(R, key, specs, seg=(16, 10)):
    """Soft heaped balls (cloud, fleece): [(bone, centre, radii), ...]."""
    by = {}
    for bone, c, r in specs:
        if bone not in by:
            by[bone] = R.piece(bone)
        by[bone].ellipsoid(key, Vector(c), r, seg=seg)


def collar(R, key, height=0.08, grow=1.0, flare=0.0, rim=None, rim_r=0.006, arc=None, seg=28, base=1.5):
    """A standing collar round the base of the neck: `flare` opens its top outward; `arc` leaves the front open.
    Returns (piece, the point at its front foot for a brooch, its top ring)."""
    z = R.z["neck"]
    neck = [p for p, d in zip(R.world, R.dom) if d == "neck_01" and abs(p.z - (z + 0.02)) < 0.03]
    cx, cy = sum(p.x for p in neck) / len(neck), sum(p.y for p in neck) / len(neck)
    rx, ry = max(abs(p.x - cx) for p in neck), max(abs(p.y - cy) for p in neck)
    f = R.piece("spine_03")
    rings = [(Vector((cx, cy, z - 0.02)), rx * base * grow, ry * (base - 0.05) * grow),
             (Vector((cx, cy, z - 0.02 + height * 0.5)), rx * (1.22 + flare * 0.4) * grow, ry * (1.2 + flare * 0.4) * grow),
             (Vector((cx, cy + flare * 0.01, z - 0.02 + height)), rx * (1.14 + flare) * grow, ry * (1.12 + flare) * grow)]
    f.loft(key, rings, seg=seg, arc=arc)
    if rim:
        c, a, b = rings[-1]
        a0, a1 = arc or (0.0, 2 * PI)
        pts = [Vector((c.x + a * math.sin(a0 + (a1 - a0) * k / seg), c.y - b * math.cos(a0 + (a1 - a0) * k / seg), c.z)) for k in range(seg + 1)]
        f.tube(rim, pts + (pts[1:2] if arc is None else []), rim_r, seg=6, caps=arc is not None)
    return f, Vector((cx, cy - ry * base * grow, z - 0.03)), rings[-1]


def sleeve(R, side, key, t0=0.3, t1=1.0, r0=0.0, r1=0.085, rim=None, rim_r=0.007, bones=("lowerarm", "hand"), seg=14, bind=None, n=4):
    """A loose sleeve round that arm from share t0 to t1 of the way along it: the arm's own radius plus r0 at its start,
    r1 m at its mouth."""
    f = R.piece(bind or f"{bones[0]}_{side}")
    e, w = R.bone(f"{bones[0]}_{side}"), R.bone(f"{bones[1]}_{side}")
    pts, rad = [], []
    for k in range(n + 1):
        t = t0 + (t1 - t0) * k / n
        c, r = R.arm_r(side, min(t, 1.0), bones=bones)
        if t > 1.0:
            c = c + (w - e) * (t - 1.0)
        pts.append(c)
        rad.append((r + r0) + (r1 - r - r0) * smooth(k / n) if r1 > r + r0 else r + r0)
    f.tube(key, pts, rad, seg=seg, caps=False)
    if rim:
        f.torus(rim, pts[-1], rad[-1], rim_r, normal=(w - e), seg=(20, 6))
    return f, pts, rad


def gloves(R, key, offset=0.004):
    R.fitted("Gloves", lambda i: R.dom[i].startswith(HAND), key, offset=offset)


def head(R):
    """The head's measures: c, rx, ry, rz of the skull, the heights of eye, brow, chin and top, the ears."""
    pts = [p for p, d in zip(R.world, R.dom) if d == "Head"]
    z0, top = R.z["head"], R.z["top"]
    y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
    rx = max(abs(p.x) for p in pts)
    eye = z0 + (top - z0) * 0.45
    front = [p for p in pts if p.y < y0 + 0.05 and abs(p.x) < 0.03]
    chin = min(front, key=lambda p: p.z + p.y * 0.5) if front else Vector((0, y0 + 0.02, z0))
    jaw = min(p.z for p in pts)
    return SimpleNamespace(rx=rx, y0=y0, y1=y1, top=top, base=z0, eye=eye, brow=eye + 0.035, chin=chin, jaw=jaw,
                           c=Vector((0, (y0 + 0.025 + y1) / 2, top - 0.105)), ry=(y1 - y0 - 0.025) / 2, rz=0.105,
                           ear=Vector((rx * 0.93, (y0 + y1) / 2 + 0.015, eye - 0.01)))


def held_rod(R, side, key, back, front, r=0.013, seg=8):
    """A shaft in that hand from `back` m behind the palm to `front` m in front of it (in the figure's own height)."""
    f, o, d, up = R.held(side)
    s = along(R)
    f.tube(key, [o - d * back * s, o + d * front * s], r, seg=seg)
    return f, o, d, up, s


def leaf(f, key, p0, p1, width, flat):
    """A leaf from its stalk p0 to its tip p1, `width` m wide, flat across `flat`."""
    p0, p1 = Vector(p0), Vector(p1)
    f.tube(key, [p0, p0.lerp(p1, 0.3), p0.lerp(p1, 0.6), p1], [width * 0.2, width * 0.48, width * 0.5, 0.003], seg=8, squash=(tuple(flat), 0.16))


def neck(R):
    """The neck's base: (cx, cy, rx, ry, z)."""
    z = R.z["neck"]
    pts = [p for p, d in zip(R.world, R.dom) if d == "neck_01" and abs(p.z - (z + 0.02)) < 0.03]
    cx, cy = sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts)
    return cx, cy, max(abs(p.x - cx) for p in pts), max(abs(p.y - cy) for p in pts), z


def ring_band(f, key, rings, stations, width, thick=0.01, off=0.008, n=16, seg=8):
    """A strap lying on stacked rings (a loose tunic, a skirt) through `stations` [(z, a), ...]."""
    L = [0.0]
    for (z0, a0), (z1, a1) in zip(stations, stations[1:]):
        L.append(L[-1] + math.hypot(z1 - z0, (a1 - a0) * 0.15) + 1e-6)
    pts, nrm = [], []
    for k in range(n + 1):
        s = L[-1] * k / n
        i = max(j for j in range(len(L) - 1) if L[j] <= s + 1e-9)
        t = (s - L[i]) / (L[i + 1] - L[i])
        zz = stations[i][0] + (stations[i + 1][0] - stations[i][0]) * t
        a = stations[i][1] + (stations[i + 1][1] - stations[i][1]) * t
        c, rx, ry = ring_at(rings, zz)
        pts.append(Vector((c.x + (rx + off) * math.sin(a), c.y - (ry + off) * math.cos(a), zz)))
        nrm.append(Vector((math.sin(a) / max(rx, 1e-4), -math.cos(a) / max(ry, 1e-4), 0)).normalized())
    sides = []
    for i in range(len(pts)):
        t = (pts[min(i + 1, n)] - pts[max(i - 1, 0)]).normalized()
        sides.append(t.cross(nrm[i]))
    hull(f, key, pts, width / 2, thick / 2, seg=seg, side=sides)
    return pts, nrm


def twin(name, tunic, leaf_c, glow, emit):
    """Pim and Pom, the Changeling Twins: the one body they share (the same build, head, pointed ears, hair, legs and
    boots; the game swaps the model when they tag, so only the colours and what they wear on the head and hold differ).
    A loose short tunic with a hem of hanging leaves and a collar of small leaves, dark moss leggings, bark boots with
    a gold cuff, bark bracers, a bark belt with a gold leaf clasp, a small woven satchel on the back.
    Returns (R, T): T.H the head's measures, T.rings the tunic's rings, T.hair the hair's material."""
    R = Real(name, sex="f", height=0.74, width=0.82, depth=0.86, head=1.24, skin="#d2a080")
    z = R.z
    R.mat("tunic", tunic, rough=0.78, double=True)
    R.mat("leaf", leaf_c, rough=0.7, double=True)
    R.mat("legs", "#2e3220", rough=0.8)
    R.mat("bark", "#4a3220", rough=0.8, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("ear", "#d2a080", rough=0.62)
    R.mat("weave", "#8a6a3a", rough=0.9)
    R.mat("glow", glow, rough=0.3, emit=emit, strength=1.0)
    hk = hair(R, "Hair_BuzzedFemale", "#6a3c1c", rough=0.6)

    R.fitted("Shirt", ["spine", "pelvis", "clavicle", "upperarm"], "tunic", offset=0.008)
    R.fitted("Legs", ["thigh", "calf"], "legs", offset=0.004)
    R.fitted("Bracers", ["lowerarm"], "bark", offset=0.01)
    R.cuffs("gold", at=(0.08, 0.94), offset=0.012)
    R.boots("bark", top=z["knee"] - 0.06, cuff="gold")
    toes(R, "bark")

    # the loose tunic, straight from the chest to its hem, and the two rows of leaves hanging from the hem
    hem = z["knee"] + 0.21
    cw, rxw, ryw = R.ring(z["waist"])
    cc, rxc, ryc = R.ring(z["chest"])
    ch, rxh, ryh = R.ring(z["hip"])
    rings = [(Vector((0, ch.y - 0.01, hem)), rxh * 1.42, ryh * 1.85), (Vector((0, ch.y * 0.6, z["hip"])), rxh * 1.14, ryh * 1.5),
             (Vector((0, (cw.y + cc.y) / 2, z["waist"])), rxh * 0.88, ryc * 1.12), (Vector((0, cc.y, z["chest"])), rxc * 1.1, ryc * 1.17),
             (Vector((0, 0.006, z["chest"] + 0.11)), rxc * 1.0, ryc * 0.92)]
    folds, amp = 10, 0.014
    f = R.piece(trunk_w(R, hem))
    cloth(f, "tunic", rings, seg=40, rows=12, folds=folds, amp=amp)
    c, rx, ry = rings[0]
    for row, (key, n, dz, ln, w, out) in enumerate((("leaf", 14, 0.012, 0.1, 0.085, 0.004), ("tunic", 14, 0.04, 0.085, 0.08, 0.012))):
        for k in range(n):
            a = 2 * PI * (k + 0.5 * row) / n
            o = Vector((math.sin(a), -math.cos(a), 0))
            p0 = Vector((c.x + (rx + out) * math.sin(a), c.y - (ry + out) * math.cos(a), hem + dz))
            leaf(f, key, p0, p0 + o * 0.012 + Vector((0, 0, -ln)), w, o)
    # the bark belt, low on the hips, with its gold leaf clasp
    bz = z["waist"] - 0.035
    cloth(f, "bark", rings, seg=40, rows=1, folds=folds, amp=amp, z0=bz - 0.025, z1=bz + 0.025, off=0.006)
    c, rx, ry = ring_at(rings, bz)
    p = Vector((0, c.y - ry - 0.014, bz))
    leaf(f, "gold", p + Vector((-0.05, 0.004, 0.0)), p + Vector((0.055, 0.004, 0.012)), 0.06, (0, 1, 0))
    # the collar of small leaves round the neck
    cx, cy, nrx, nry, nz = neck(R)
    g = R.piece("spine_03")
    g.loft("bark", [(Vector((cx, cy, nz - 0.02)), nrx * 1.45, nry * 1.4), (Vector((cx, cy, nz + 0.012)), nrx * 1.2, nry * 1.18)], seg=24)
    for k in range(10):
        a = 2 * PI * (k + 0.5) / 10
        o = Vector((math.sin(a), -math.cos(a), 0))
        drop = 0.04 + 0.05 * math.cos(a) ** 2
        p0 = Vector((cx + nrx * 1.3 * math.sin(a), cy - nry * 1.3 * math.cos(a), nz - 0.005))
        p1 = Vector((cx + (nrx * 1.3 + 0.1) * math.sin(a), cy - (nry * 1.3 + 0.085) * math.cos(a), nz - 0.005 - drop))
        leaf(g, "leaf" if k % 2 else "tunic", p0, p1, 0.075, Vector((-o.x * drop, -o.y * drop, 0.09)).normalized())
    # the small woven satchel on the back, its bark flap, its strap across the chest
    c, rx, ry = ring_at(rings, z["chest"] - 0.07)
    sc = Vector((0.02, c.y + ry + 0.055, z["chest"] - 0.075))
    g.ellipsoid("weave", sc, (0.12, 0.065, 0.1), seg=(18, 12))
    for dz in (-0.045, 0.0):
        g.tube("bark", [sc + Vector((0.121 * math.sin(a), 0.066 * math.cos(a), dz)) for a in [(-1.6 + 3.2 * i / 12) for i in range(13)]], 0.006, seg=5)
    g.ellipsoid("bark", sc + Vector((0, 0.006, 0.02)), (0.126, 0.068, 0.09), seg=(18, 12), keep=lambda co: co.z > sc.z + 0.03)
    g.ellipsoid("gold", sc + Vector((0, 0.07, 0.035)), (0.018, 0.01, 0.018), seg=(10, 6))
    ring_band(f, "bark", rings, [(z["chest"] + 0.11, 0.85), (z["chest"] + 0.02, 0.3), (z["waist"] + 0.05, -0.6), (z["waist"] + 0.03, -1.45), (z["chest"] - 0.06, -2.5)], 0.034, off=0.01, n=28)
    ring_band(f, "bark", rings, [(z["chest"] + 0.11, 0.85), (z["chest"] + 0.11, 1.7), (z["chest"] + 0.05, 2.7)], 0.034, off=0.01, n=12)

    # the long pointed ears
    H = head(R)
    g = R.piece("Head")
    for s in (1, -1):
        e = Vector((H.ear.x * s * 0.94, H.ear.y, H.ear.z))
        g.tube("ear", [e + Vector((-0.012 * s, -0.004, -0.012)), e + Vector((0.03 * s, 0.012, 0.012)), e + Vector((0.085 * s, 0.04, 0.05)), e + Vector((0.14 * s, 0.075, 0.095))],
               [0.02, 0.03, 0.02, 0.003], seg=8, squash=((0, 1, 0), 0.32))
    return R, SimpleNamespace(H=H, rings=rings, hem=hem, hair=hk)
