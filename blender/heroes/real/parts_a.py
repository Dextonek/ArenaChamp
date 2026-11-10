"""Shared parts for the first batch of v4 heroes (blood, alchemy, storm, sand, shadow, grove, dawn, tide, sky, bone,
clockwork, hive): sheets of cloth, flat blades and feathers, hoods, cowls, cloaks with tails and linings, staffs, straps,
gears and skulls. Everything is written at the pack body's own size and placed from the body (`R.z`, `R.ring`, bones)."""
import math

import bmesh
from mathutils import Matrix, Vector

from realkit import PI


def V(x, y, z):
    return Vector((x, y, z))


def hair(R, style, color, **kw):
    """`R.hair`, returning the hair material's key (for locks, braids and beards built by hand)."""
    key = f"hair_{len(R.M)}"
    R.hair(style, color, **kw)
    return key


def grid(f, key, fn, nu, nv, close=False):
    """A sheet of quads: fn(u, v) -> point for u, v in 0..1. `close`: u wraps round (a tube of cloth)."""
    bm = f.bm(key)
    cols = nu if close else nu + 1
    rows = [[bm.verts.new(fn(i / nu, j / nv)) for i in range(cols)] for j in range(nv + 1)]
    for r0, r1 in zip(rows, rows[1:]):
        for i in range(nu):
            j = (i + 1) % cols
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    return rows


def weld(f, key, dist=0.0006):
    bm = f.bm(key)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=dist)


def blade(f, key, a, b, width, normal, thick=0.12, belly=0.4, n=6, seg=6, tip=0.001, root=0.3, bend=None):
    """A flat leaf, feather or blade from a to b: `width` (half) at `belly` of the way, flat across `normal`."""
    a, b = Vector(a), Vector(b)
    pts, rad = [], []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        if bend is not None:
            p = p + Vector(bend) * math.sin(PI * t)
        if t < belly:
            w = root + (1 - root) * math.sin(PI / 2 * t / belly)
        else:
            w = max(0.0, math.cos(PI / 2 * (t - belly) / (1 - belly))) ** 0.8
        pts.append(p)
        rad.append(max(tip, width * w))
    f.tube(key, pts, rad, seg=seg, squash=(tuple(normal), thick))


def frame_rot(side, front, up):
    """A rotation for `ellipsoid(rot=)`: its x along `side`, its -y along `front`, its z along `up`."""
    s, fr, u = Vector(side).normalized(), Vector(front).normalized(), Vector(up).normalized()
    m = Matrix((s, -fr, u)).transposed()
    return m.to_4x4()


def outline(R, z, a0=-PI, a1=PI, n=24, groups=("Head",), dz=0.012, out=0.0, xmax=None, win=0.22):
    """Points on the body's surface at height z, round its upright axis from angle a0 to a1 (0 the front, + its left),
    pushed `out` metres outward."""
    groups = tuple(groups)
    pts = [p for p, d in zip(R.world, R.dom) if abs(p.z - z) < dz and d.startswith(groups) and (xmax is None or abs(p.x) < xmax)]
    if len(pts) < 8:
        return outline(R, z, a0, a1, n, groups, dz * 2, out, xmax, win) if dz < 0.1 else []
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    pol = [(math.atan2(p.x, -(p.y - cy)), math.hypot(p.x, p.y - cy)) for p in pts]
    res = []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        best = 0.0
        for pa, pr in pol:
            da = abs((pa - a + PI) % (2 * PI) - PI)
            if da < win and pr > best:
                best = pr
        if best == 0.0:
            best = max(p.x * math.sin(a) - (p.y - cy) * math.cos(a) for p in pts)
        r = best + out
        res.append(V(r * math.sin(a), cy - r * math.cos(a), z))
    return res


def face_z(R, share):
    """A height on the head: 0 the chin line (the head bone), 1 the crown. Eyes about 0.45, nose 0.3, mouth 0.2."""
    return R.z["head"] + (R.z["top"] - R.z["head"]) * share


# ---- hoods and cowls ---------------------------------------------------------------------------------------------
def hood(R, mat, lining=None, edge=None, grow=1.32, open=0.42, tilt=0.2, shape=(1.0, 1.05, 1.08), shift=(0, 0.02, 0.0),
         edge_r=0.013, peak=0.0, nu=28, nv=12):
    """A hood up round the head, bound to it: an egg cut by a plane in front of the face (`open`: how far in front of
    the head's middle, in hood radii; `tilt`: the brow comes forward). `peak`: the back of the crown drawn out to a
    point. Returns (fig, centre, hood radius, the rim points)."""
    f, c, r = R.head_piece()
    hr = r * grow
    c = c + Vector(shift)
    rad = V(hr * shape[0], hr * shape[1], hr * shape[2])
    n = V(0, -math.cos(tilt), -math.sin(tilt))

    def make(key, rad, lift=0.0):
        m = V(rad.x * n.x, rad.y * n.y, rad.z * n.z)
        dist = (hr * open * math.cos(tilt)) / m.length
        mh = m.normalized()
        u = V(1, 0, 0)
        v = mh.cross(u).normalized()
        t0 = math.acos(max(-1.0, min(1.0, dist)))

        def fn(a, b):
            th = t0 + (PI - t0) * b
            ph = 2 * PI * a
            q = mh * math.cos(th) + (u * math.cos(ph) + v * math.sin(ph)) * math.sin(th)
            p = c + V(rad.x * q.x, rad.y * q.y, rad.z * q.z)
            if peak:
                k = max(0.0, (p.y - c.y) / rad.y) ** 2 * max(0.0, (p.z - c.z) / rad.z + 0.3)
                p = p + V(0, peak * 0.9, peak * 0.5) * k
            return p
        if key:
            grid(f, key, fn, nu, nv, close=True)
        return [fn(k / nu, 0.0) for k in range(nu)]
    rim = make(mat, rad)
    if lining:
        make(lining, rad * 0.955)
    if edge:
        f.tube(edge, rim + [rim[0], rim[1]], edge_r, seg=6, caps=False)
    return f, c, hr, rim


def cowl(R, mat, grow=1.0, low=0.085, high=0.05, how="spine_03", seg=26, front=0.0):
    """A cowl from the shoulders up round the neck (it joins a hood or a helm to the body and hides a tunic's edge)."""
    z = R.z
    sh = R.bone("upperarm_l").x
    ny = R.bone("neck_01").y
    f = R.piece(how)
    f.loft(mat, [(V(0, ny - 0.03 - front, z["neck"] - low), sh * 0.98 * grow, 0.135 * grow + front),
                 (V(0, ny - 0.025 - front * 0.5, z["neck"] - low * 0.35), sh * 0.72 * grow, 0.112 * grow + front * 0.5),
                 (V(0, ny - 0.02, z["neck"] + high), 0.08 * grow, 0.092 * grow)], seg=seg)
    return f


# ---- cloaks ----------------------------------------------------------------------------------------------------------
def spine_w(R):
    """Weights for cloth down the back: the chest above, the pelvis below the hips."""
    hip, chest = R.z["hip"], R.z["chest"]

    def w(co):
        if co.z > chest:
            return {"spine_03": 1.0}
        if co.z > hip:
            t = (co.z - hip) / (chest - hip)
            return {"spine_03": t, "pelvis": 1 - t}
        return {"pelvis": 1.0}
    return w


def cloak(R, mat, hem, width=0.36, depth=0.83, spread=1.3, lining=None, trim=None, tails=1, split=None, ragged=0.0,
          teeth=7, back=0.0, top_spread=None, gap=0.012, nu=18, nv=12, hip_w=0.75, point=0.25, trim_r=0.007):
    """A cloak down the back from the base of the neck to height `hem`, `spread` radians to each side of the back at
    the hem. `tails` > 1 splits it below `split` into that many pointed tails. `ragged`: a torn hem, that deep.
    `lining`: a second sheet just inside, in another colour. Returns (fig, fn): fn(u, v) is the last sheet's surface
    (u across, v from the neck 0 to the hem 1)."""
    z = R.z
    cc, rxc, ryc = R.ring(z["chest"])
    sh = R.bone("upperarm_l").x
    ny = R.bone("neck_01").y
    hip, chest, top = z["hip"], z["chest"], z["neck"] - 0.04
    rings = [r for r in ((top, ny, sh * 0.66, 0.105), (chest, cc.y + 0.01, rxc * 1.14, ryc * 1.32),
                         (hip, cc.y + 0.02 + back * 0.6, width * hip_w, width * hip_w * depth * 0.95)) if r[0] > hem + 0.03]
    rings.append((hem, cc.y + 0.03 + back, width, width * depth))
    split = hip if split is None else split
    ts = spread if top_spread is None else top_spread

    def at(zz):
        for (z0, y0, rx0, ry0), (z1, y1, rx1, ry1) in zip(rings, rings[1:]):
            if zz >= z1 - 1e-6:
                t = (z0 - zz) / max(1e-6, z0 - z1)
                return y0 + (y1 - y0) * t, rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t
        return rings[-1][1:]

    f = R.piece(spine_w(R))

    def sheet(key, k, shrink):
        def fn(u, v):
            # the whole sheet's own u, so a torn hem runs on across the tails
            gu = (k + u) / tails
            bottom = hem + (ragged * abs(math.sin(gu * teeth * PI)) if ragged else 0.0)
            zz = top + (bottom - top) * v
            cy, rx, ry = at(max(zz, hem))
            sp = ts + (spread - ts) * min(1.0, (top - zz) / max(1e-6, top - chest))
            half = sp / tails
            mid = PI - sp + (2 * k + 1) * half
            if tails > 1 and zz < split:
                t = (split - zz) / max(1e-6, split - bottom)
                half *= (1 - 0.3 * t) if t < 1 - point else (1 - 0.3 * (1 - point)) * max(0.0, (1 - t) / point)
            a = mid + half * (2 * u - 1)
            return V((rx - shrink) * math.sin(a), cy - (ry - shrink) * math.cos(a), zz)
        grid(f, key, fn, max(4, nu // tails), nv)
        return fn
    for k in range(tails):
        fn = sheet(mat, k, 0.0)
        if lining:
            sheet(lining, k, gap)
        if trim:
            if tails > 1:
                v0 = (top - split) / (top - hem)
                path = [fn(0.0, v0 + (1 - v0) * i / 8) for i in range(9)] + [fn(1.0, v0 + (1 - v0) * i / 8) for i in range(7, -1, -1)]
            else:
                m = max(16, 4 * teeth) if ragged else 16
                path = [fn(i / m, 1.0) for i in range(m + 1)]
            f.tube(trim, path, trim_r, seg=6 if not ragged else 4)
    return f, fn


def rag_hem(R, f, mat, hem, flare, depth=1.3, n=14, drop=0.09, width=0.05, grow=1.0, arc=None):
    """Torn strips hanging from the hem of `R.skirt(mat, hem, flare, depth=depth)` (pass the skirt's own fig)."""
    ch, rxh, ryh = R.ring(R.z["hip"] - 0.02)
    k = min(1.0, (ch.z - hem) / 0.25)
    a0, a1 = arc or (0.0, 2 * PI)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5 + 0.15 * (i % 2)) / n
        p = V(ch.x + rxh * flare * grow * math.sin(a), ch.y - 0.01 * k - ryh * flare * depth * grow * math.cos(a), hem + 0.012)
        q = p + V(0.012 * math.sin(a), -0.012 * math.cos(a), -drop * (0.55 + 0.45 * ((i * 7) % 5) / 4))
        blade(f, mat, p, q, width, (math.sin(a), -math.cos(a), 0), thick=0.1, belly=0.25, root=0.8, n=4)


# ---- things held, worn and carried -----------------------------------------------------------------------------
def staff(R, mat, back=1.28, front=0.6, r=0.013, side="l", seg=8):
    """A shaft in that hand, the butt `back` m behind the palm. Returns (fig, palm, d (toward the top), up (the back
    of the hand), fwd (toward the wrist: with the pack's torch-holding arm, checked by posing Idle_Torch_Loop, that is
    the hero's front when the shaft stands upright, so a crook's hook or a skull's face goes this way)).

    A held shaft lies along the body's depth in the T-pose, so the figure's build would scale its length by `depth`
    while the hand's height off the floor goes by `height`: `d` comes back longer by height / depth, so that `back`
    and `front` are metres at a body of the pack's own size, whatever the build (a floor-length staff: 1.28)."""
    f, o, d, up = R.held(side)
    d = d * (R.build[2] / R.build[1])
    fwd = (R.bone(f"hand_{side}") - R.bone(f"middle_01_{side}"))
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    f.tube(mat, [o - d * back, o + d * front], r, seg=seg)
    return f, o, d, up, fwd


def hook(f, mat, base, d, side, radius, r=0.013, turn=1.5 * PI, n=14, seg=8, taper=0.6):
    """A crook's hook: from `base` the shaft bends round toward `side`. Returns its points."""
    c = base + side * radius
    pts = []
    for i in range(n + 1):
        a = turn * i / n
        pts.append(c - side * radius * math.cos(a) + d * radius * math.sin(a))
    f.tube(mat, pts, [r * (1 - (1 - taper) * i / n) for i in range(n + 1)], seg=seg)
    return pts


def strap(R, mat, width=0.05, lift=0.2, mid=None, grow=1.08, high_side=1, nu=32, out=0.012):
    """A bandolier or sash slung across the torso: over the shoulder on `high_side` (1 its left), down to the other
    hip. Returns (fig, point(u)): u 0 the front middle, 0.25 the high side, 0.5 the back."""
    z = R.z
    mid = (z["chest"] + z["waist"]) / 2 + 0.03 if mid is None else mid
    rings = [(zz,) + tuple(R.ring(zz)) for zz in (z["waist"] - 0.04, z["waist"], (z["waist"] + z["chest"]) / 2, z["chest"], z["chest"] + 0.08)]
    top = z["neck"] - 0.035
    sh = R.bone("upperarm_l").x
    ny = R.bone("neck_01").y
    rings.append((top, V(0, ny - 0.01, top), sh * 0.6, 0.1))

    def at(zz):
        zz = max(rings[0][0], min(rings[-1][0], zz))
        for (z0, c0, rx0, ry0), (z1, c1, rx1, ry1) in zip(rings, rings[1:]):
            if zz <= z1 + 1e-6:
                t = (zz - z0) / max(1e-6, z1 - z0)
                return c0.y + (c1.y - c0.y) * t, rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t
        return rings[-1][1].y, rings[-1][2], rings[-1][3]

    def point(u, dz=0.0):
        a = 2 * PI * u
        zz = mid + lift * math.sin(a) * high_side + dz
        cy, rx, ry = at(zz)
        return V((rx * grow + out) * math.sin(a), cy - (ry * grow + out) * math.cos(a), zz)
    f = R.piece("near")
    grid(f, mat, lambda u, v: point(u, (v - 0.5) * width), nu, 1, close=True)
    return f, point


def gear(f, key, c, r, normal=(0, 1, 0), teeth=10, thick=0.02, turn=0.0, hub=None):
    """A toothed wheel facing `normal`."""
    f.star(key, c, r, r * 0.8, thick=thick, points=teeth, normal=normal, turn=turn)
    f.torus(hub or key, c, r * 0.5, thick * 0.45, normal=normal, seg=(16, 6))
    n = Vector(normal).normalized()
    f.ellipsoid(hub or key, Vector(c), (r * 0.2, r * 0.2, r * 0.2), seg=(8, 6))


def skull(f, bone, dark, c, s, front=(0, -1, 0), up=(0, 0, 1), eye=None, jaw=True, fit=None):
    """A skull of size `s` (its half width) at `c`, looking toward `front`. `eye`: a material in the sockets. `fit`:
    the Real, so that the skull keeps its shape under a build that is not the same in width, depth and height."""
    fr, u = Vector(front).normalized(), Vector(up).normalized()
    side = fr.cross(u).normalized()
    pre = Matrix.Identity(4)
    if fit is not None:
        w, d, h, _ = fit.build
        pre = Matrix.Diagonal((h / w, h / d, 1.0, 1.0))
    rot = pre @ frame_rot(side, fr, u)
    c = Vector(c)

    def at(v):
        return c + pre.to_3x3() @ v
    f.ellipsoid(bone, c, (s, s * 1.12, s * 0.95), seg=(14, 10), rot=rot)
    if jaw:
        f.ellipsoid(bone, at(fr * s * 0.45 - u * s * 0.72), (s * 0.62, s * 0.55, s * 0.5), seg=(10, 8), rot=rot)
    for sx in (1, -1):
        e = fr * s * 0.92 + side * s * 0.4 * sx - u * s * 0.12
        f.ellipsoid(dark, at(e), (s * 0.27, s * 0.2, s * 0.25), seg=(8, 6), rot=rot)
        if eye:
            f.ellipsoid(eye, at(e + fr * s * 0.1), (s * 0.13, s * 0.1, s * 0.13), seg=(8, 6), rot=rot)
    f.ellipsoid(dark, at(fr * s * 1.02 - u * s * 0.45), (s * 0.1, s * 0.1, s * 0.16), seg=(6, 4), rot=rot)


def arm_sec(R, side, t, bones=("upperarm", "lowerarm"), dx=0.015):
    """(centre, radius) of that arm at share t of the bone, the radius a snug one: between the mean and the widest."""
    e, w = R.bone(f"{bones[0]}_{side}"), R.bone(f"{bones[1]}_{side}")
    c = e.lerp(w, t)
    pts = [p for p, d in zip(R.world, R.dom) if abs(p.x - c.x) < dx and d.startswith(("lowerarm_", "upperarm_", "hand_")) and p.x * c.x > 0]
    if not pts:
        return c, 0.04
    c = V(c.x, sum(p.y for p in pts) / len(pts), sum(p.z for p in pts) / len(pts))
    ds = [math.hypot(p.y - c.y, p.z - c.z) for p in pts]
    return c, 0.55 * sum(ds) / len(ds) + 0.45 * max(ds)


def shoulder_ring(R, mat, thick=0.006, t=0.1, offset=0.004, seg=(20, 6)):
    """A ring round each arm just below the shoulder seam (the edge of a sleeveless garment)."""
    for n in "lr":
        c, r = arm_sec(R, n, t)
        R.piece(f"upperarm_{n}").torus(mat, c, r + offset, thick, normal=(1, 0, 0), seg=seg)


def arm_band(R, mat, t, bones=("upperarm", "lowerarm"), thick=0.008, offset=0.004, width=0.0, seg=(20, 6), sides="lr"):
    """A ring (or with `width`, a sleeve band) round each arm at share t of that bone."""
    for n in sides:
        c, r = arm_sec(R, n, t, bones)
        f = R.piece(f"{bones[0]}_{n}")
        if width:
            s = 1 if n == "l" else -1
            f.tube(mat, [c - V(width / 2 * s, 0, 0), c + V(width / 2 * s, 0, 0)], r + offset, seg=14)
        else:
            f.torus(mat, c, r + offset, thick, normal=(1, 0, 0), seg=seg)


def bell_sleeve(R, mat, t0=0.15, t1=0.97, flare=1.9, drop=0.05, seg=14, cuff=None, sides="lr"):
    """A loose sleeve over each forearm, widening toward the wrist and hanging a little below it."""
    for n in sides:
        c0, r0 = R.arm_r(n, t0)
        c1, r1 = R.arm_r(n, t1)
        f = R.piece(f"lowerarm_{n}")
        pts = [c0, c0.lerp(c1, 0.5) + V(0, 0, -drop * 0.3), c1 + V(0, 0, -drop)]
        rad = [r0 + 0.012, (r0 + r1) / 2 * (1 + (flare - 1) * 0.5) + 0.012, r1 * flare + 0.012]
        f.tube(mat, pts, rad, seg=seg, caps=False)
        if cuff:
            f.torus(cuff, pts[-1], rad[-1], 0.008, normal=(1, 0, 0), seg=(20, 6))


# ---- points on the body and on its skirts ---------------------------------------------------------------------
def surf(R, z, a, groups=("spine", "pelvis", "clavicle"), out=0.0, xmax=0.2, dz=0.012):
    """One point on the body's surface at height z and angle a (0 the front, + its left), pushed `out` outward."""
    pts = outline(R, z, a, a, n=1, groups=groups, out=out, xmax=xmax, dz=dz)
    return pts[0] if pts else V(0, 0, z)


def skirt_fn(R, hem, flare=1.5, depth=1.3, grow=1.0, top=None):
    """The surface of `R.skirt(mat, hem, flare, depth=depth, grow=grow, top=top)`: fn(a, z, out=0) -> point."""
    z = R.z
    top = z["waist"] if top is None else top
    cw, rxw, ryw = R.ring(top)
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    mid = (hem + ch.z) / 2
    k = min(1.0, (ch.z - hem) / 0.25)
    rings = [(hem, ch.y - 0.01 * k, rxh * flare * grow, ryh * flare * depth * grow),
             (mid, ch.y - 0.005 * k, rxh * (1.24 + (flare - 1.24) * 0.55) * grow, ryh * (1.34 + (flare * depth - 1.34) * 0.5) * grow),
             (ch.z, ch.y, rxh * 1.24 * grow, ryh * 1.34 * grow), (top, cw.y, rxw * 1.07 * grow, ryw * 1.1 * grow)]
    if hem > ch.z - 0.04:
        rings = [(hem, ch.y, rxh * flare * grow, ryh * flare * depth * grow), (top, cw.y, rxw * 1.07 * grow, ryw * 1.1 * grow)]

    def fn(a, zz, out=0.0):
        zz2 = max(rings[0][0], min(rings[-1][0], zz))
        for (z0, y0, rx0, ry0), (z1, y1, rx1, ry1) in zip(rings, rings[1:]):
            if zz2 <= z1 + 1e-6:
                t = (zz2 - z0) / max(1e-6, z1 - z0)
                cy, rx, ry = y0 + (y1 - y0) * t, rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t
                break
        return V((rx + out) * math.sin(a), cy - (ry + out) * math.cos(a), zz)
    return fn


def panel(R, f, key, sfn, a0, a1, z0, z1, out=0.006, nu=6, nv=6, taper=0.0):
    """A sheet lying on a skirt (`sfn` from skirt_fn) from angle a0 to a1 and height z0 (top) down to z1; `taper`
    narrows it toward the bottom (a pointed tabard)."""
    am, ah = (a0 + a1) / 2, (a1 - a0) / 2
    grid(f, key, lambda u, v: sfn(am + ah * (2 * u - 1) * (1 - taper * v), z0 + (z1 - z0) * v, out), nu, nv)


# ---- ribbons, braids ------------------------------------------------------------------------------------------------
def smooth(pts, k=6):
    """A smooth curve through the points (Catmull-Rom), k steps per span."""
    pts = [Vector(p) for p in pts]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for j in range(k):
            t = j / k
            out.append(0.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


def ribbon(f, key, pts, width, across, k=6):
    """A flat band along a smooth curve through `pts`. `width`: its half breadth (a number or f(t)); `across`: the way
    its breadth lies (a vector or f(t))."""
    path = smooth(pts, k) if k else [Vector(p) for p in pts]
    m = len(path) - 1

    def fn(u, v):
        i = min(m, int(round(u * m)))
        t = i / m
        w = width(t) if callable(width) else width
        ac = Vector(across(t) if callable(across) else across).normalized()
        return path[i] + ac * w * (2 * v - 1)
    grid(f, key, fn, m, 2)
    return path


def braid(R, key, pts, r0=0.03, r1=0.018, n=10, head_n=2, clasp=None):
    """A braid down the back along `pts`: the first `head_n` knots follow the head, the rest the chest."""
    path = smooth(pts, 8)
    fh, fs = R.piece("Head"), R.piece("spine_03")
    for i in range(n):
        t = i / (n - 1)
        p = path[min(len(path) - 1, int(round(t * (len(path) - 1))))]
        r = r0 + (r1 - r0) * t
        f = fh if i < head_n else fs
        f.ellipsoid(key, p + V(r * 0.3 * (1 if i % 2 else -1), 0, 0), (r * 1.15, r, r * 1.45), seg=(10, 6))
    if clasp:
        fs.torus(clasp, path[-1] + V(0, 0, r1 * 1.2), r1 * 1.05, 0.006, seg=(14, 6))
    return path[-1]


def hair_cap(R, key, grow=1.07, line=0.37, slope=0.84):
    """Hair combed back over the skull (under a hood or a circlet, above a braid): a smooth cap from a clean hairline
    over the brow back and down to the nape. `line`: how far forward the hairline sits; `slope`: how steeply it falls
    toward the nape."""
    return hood(R, key, grow=grow, open=line, tilt=slope, shape=(1.0, 1.26, 1.03), shift=(0, 0.03, 0.0), nu=28, nv=12)


def wavy_skirt(R, key, hem, flare=1.5, depth=1.3, grow=1.0, waves=6, amp=0.04, phase=0.0, trim=None, nu=48, nv=6):
    """A skirt layer whose hem rises and falls in soft waves (`amp` up and down round `hem`)."""
    z = R.z
    sfn = skirt_fn(R, hem - amp, flare, depth, grow)
    f = R.piece(R.hang_w(z["waist"], hem))

    def fn(u, v):
        a = 2 * PI * u
        low = hem + amp * math.sin(waves * a + phase)
        return sfn(a, z["waist"] + (low - z["waist"]) * v)
    grid(f, key, fn, nu, nv, close=True)
    if trim:
        f.tube(trim, [fn(i / nu, 1.0) for i in range(nu + 1)], 0.005, seg=5, caps=False)
    return f


def drape(R, q, bands, r0=(0.078, 0.088), length=0.15, side=0.75, na=40, step=0.012, off=0.011,
          groups=("spine_03", "spine_02", "clavicle", "neck", "upperarm"), how="near"):
    """A broad collar lying on the shoulders and chest round `q` (the base of the neck), in rows of colour from the
    neck outward: it follows the body's own surface outward and hangs down where the body falls away. `bands`:
    [(material, share of the length)]; `side`: how far it reaches over the shoulders against front and back."""
    groups = tuple(groups)
    zmin = q.z - length - 0.2
    pts = [p for p, d in zip(R.world, R.dom) if d.startswith(groups) and p.z > zmin]

    def top(x, y, rad=0.024):
        best = None
        for p in pts:
            if abs(p.x - x) < rad and abs(p.y - y) < rad and (best is None or p.z > best):
                best = p.z
        return best

    def reach(dx, dy, zz, lim, rad=0.025):
        best = 0.0
        for p in pts:
            if abs(p.z - zz) < rad:
                px, py = p.x - q.x, p.y - q.y
                d = px * dx + py * dy
                if abs(px * dy - py * dx) < rad and best < d < lim:
                    best = d
        return best
    lines = []
    for i in range(na):
        a = 2 * PI * i / na
        dx, dy = math.sin(a), -math.cos(a)
        ln = length * (1 - (1 - side) * abs(dx) ** 1.5)
        n = max(2, int(round(ln / step)))
        st = ln / n
        rho = math.hypot(r0[0] * dx, r0[1] * dy)
        zc = top(q.x + rho * dx, q.y + rho * dy) or q.z
        line = [V(q.x + rho * dx, q.y + rho * dy, zc + off)]
        hang = False
        for k in range(n):
            zt = None if hang else top(q.x + (rho + st) * dx, q.y + (rho + st) * dy)
            if zt is None or zc - zt > st * 1.6:
                hang = True
                zc -= st
                rho = max(rho + st * 0.12, reach(dx, dy, zc, rho + 0.035))
                o = V(dx, dy, 0) * off
            else:
                dz = zt - zc
                k2 = st / math.hypot(st, dz)
                rho, zc = rho + st * k2, zc + dz * k2
                o = V(dx * 0.35, dy * 0.35, 0.9) * off
            line.append(V(q.x + rho * dx, q.y + rho * dy, zc) + o)
        lines.append(line)
    for _ in range(2):  # even out the rows round the neck (each line took its own way down)
        lines = [[lines[i - 1][k] * 0.25 + lines[i][k] * 0.5 + lines[(i + 1) % na][k] * 0.25 if len(lines[i - 1]) > k < len(lines[(i + 1) % na]) else lines[i][k]
                  for k in range(len(lines[i]))] for i in range(na)]
    f = R.piece(how)
    t0 = 0.0
    total = sum(sh for _, sh in bands)
    for key, share in bands:
        t1 = t0 + share / total

        def fn(u, v, t0=t0, t1=t1):
            line = lines[int(round(u * na)) % na]
            t = (t0 + (t1 - t0) * v) * (len(line) - 1)
            i = min(len(line) - 2, int(t))
            return line[i].lerp(line[i + 1], t - i)
        grid(f, key, fn, na, max(1, int(round((t1 - t0) * 8))), close=True)
        t0 = t1
    return f, lines
