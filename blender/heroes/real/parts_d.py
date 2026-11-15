"""Shared parts of the revamps (docs/lore/codex/revamp.md, 2026-11-15): the marks of a hero's people built on the pack's
body. Crystal grown out of the skin (Opaline, Gloaming folk), cracks of light along the skin (Brannoc, Kilnborn),
antlers (Hank, Wood folk). Each is placed from the body's own surface (`Real.surface`), at the pack body's own size.
(Grandma Ironknit's ears are built in real/yarn.py the way the twins' are, real/parts_c.py.)"""
import math
import random

from mathutils import Vector

from realkit import PI
from real.parts_b import shard


def V(x, y, z):
    return Vector((x, y, z))


def frame(n):
    """Two directions square to `n` and to each other."""
    n = Vector(n).normalized()
    u = (V(0, 0, 1) if abs(n.z) < 0.9 else V(1, 0, 0)).cross(n).normalized()
    return u, n.cross(u).normalized()


def crystals(f, key, c, n, size, count=4, lean=0.45, bias=(0, 0, 0), seed=0, sink=0.3, thick=0.2, faces=6, spread=0.3):
    """A cluster of crystals grown out of a surface at `c` (normal `n`): the first and longest straight out, the others
    leaning round it. `size` the longest one's length; `bias` leans the whole cluster (up, outward); `sink` how much of
    each is under the surface; `thick` the width against the length."""
    rnd = random.Random(seed)
    n = (Vector(n).normalized() + Vector(bias)).normalized()
    u, v = frame(n)
    for k in range(count):
        ang = 2 * PI * k / max(1, count - 1) + rnd.uniform(-0.5, 0.5)
        side = u * math.cos(ang) + v * math.sin(ang)
        tilt = 0.0 if k == 0 else rnd.uniform(lean * 0.5, lean)
        d = (n + side * tilt).normalized()
        L = size * (1.0 if k == 0 else rnd.uniform(0.4, 0.75))
        base = c + (side * size * spread * rnd.uniform(0.5, 1.0) if k else Vector())
        shard(f, key, base - d * L * sink, base + d * L * (1 - sink), L * thick, n=faces, mid=0.28 + 0.1 * rnd.random())


def on_skin(R, p, way, out=0.0):
    """The body's surface hit from `p` toward `way`, pushed `out` along its normal: (point, normal), or (p, -way)."""
    hit, nrm = R.surface(p, way)
    if hit is None:
        return Vector(p), -Vector(way).normalized()
    return hit + nrm * out, nrm


def crack(R, f, key, pts, way, r=0.004, out=0.0025, jag=0.012, seed=0, steps=3, flat=0.45):
    """A crack of light on the skin through `pts` (seen along `way`): each leg broken into `steps` jagged bits, every
    point laid on the surface and lifted `out`. A flat tube, so it reads as a line drawn on the skin, not a cord."""
    rnd = random.Random(seed)
    way = Vector(way).normalized()
    path = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        for s in range(steps):
            t = s / steps
            q = a.lerp(b, t)
            if s:
                q += Vector((rnd.uniform(-jag, jag), rnd.uniform(-jag, jag), rnd.uniform(-jag, jag))) * 0.6
            path.append(q)
    path.append(Vector(pts[-1]))
    laid = []
    for q in path:
        hit, nrm = R.surface(q - way * 0.4, way)
        if hit is not None:
            laid.append((hit + nrm * out, nrm))
    if len(laid) < 2:
        return 0
    radii = [r * (0.45 if i in (0, len(laid) - 1) else rnd.uniform(0.8, 1.15)) for i in range(len(laid))]
    avg = sum((n for _, n in laid), Vector()).normalized()
    f.tube(key, [p for p, _ in laid], radii, seg=5, squash=(avg, flat))
    return len(laid)


def antler(f, key, base, up, out, length, r0, r1, tines, curve=0.25, seg=7, saw=None):
    """One antler from `base`: the beam rises along `up`, sweeps back and `out`; `tines` are (t along the beam, length,
    lean forward, lean out). Every tip is cut flat (`saw` the cap's material: the pale cut wood of a sawn tine)."""
    up, out = Vector(up).normalized(), Vector(out).normalized()
    back = up.cross(out).normalized()
    if back.y < 0:
        back = -back
    n = 9
    beam = []
    for i in range(n + 1):
        t = i / n
        p = base + up * length * t + out * length * (0.35 * t + 0.12 * t * t) + back * length * curve * t * t
        beam.append(p)
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    f.tube(key, beam, radii, seg=seg)
    if saw:
        tip_d = (beam[-1] - beam[-2]).normalized()
        f.tube(saw, [beam[-1] - tip_d * 0.003, beam[-1] + tip_d * 0.004], radii[-1] * 1.02, seg=seg)
    for t, ln, fw, ow in tines:
        i = min(n - 1, max(1, round(t * n)))
        p = beam[i]
        bd = (beam[i + 1] - beam[i - 1]).normalized()
        d = (bd * 0.45 + (-back) * fw + out * ow + up * 0.5).normalized()
        rr = radii[i] * 0.72
        q1 = p + d * ln * 0.55
        d2 = (d + up * 0.4).normalized()
        q2 = q1 + d2 * ln * 0.45
        f.tube(key, [p - d * rr, q1, q2], [rr, rr * 0.82, rr * 0.66], seg=seg)
        if saw:
            f.tube(saw, [q2 - d2 * 0.003, q2 + d2 * 0.004], rr * 0.68, seg=seg)
