"""Anka the Firebird (src/kits/phoenix.ts): the sample's first hero."""
import math

from vclib import *  # noqa: F401,F403  the builder, the geometry and the rules
from vclib import GOLD, PAL

PAL['anka'] = dict(core="#fff6d8", hot="#ffc24a", body="#ff7b3a", accent="#2fb8a8", dark="#1a0806",
                 ash="#eadcc4", red="#c23a22", gold="#e0a935", lit="#4a170c", mid="#2e0d08")


def ember_ring(ic, cx, cy, rx, ry, tongues):
    """Anka's ember: flame tongues (x, angle, height, width) behind a ring of embers."""
    p = ic.p
    for x, ang, h, w in tongues:
        ic.shape(curve(place(tongue_pts(h, w), ang, (x, cy - ry * 0.35))), ic.grad(p["core"], (0.35, p["hot"]), (1, p["body"]),
                 angle=-90 - 0), shadow=False)
    d = f"M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 0 {f(cx + rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 0 {f(cx - rx)} {f(cy)} Z"
    e = ic.add("shape.ellipse", x=cx - rx, y=cy - ry, width=2 * rx, height=2 * ry)
    ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=5.4)
    e2 = ic.add("shape.ellipse", x=cx - rx, y=cy - ry, width=2 * rx, height=2 * ry)
    # Embers, not a gold hoop: hot at the lit side, ember red at the far one.
    ic.paint(ic.id(e2), fill="none", stroke=ic.grad(p["hot"], (0.45, p["body"]), (1, p["red"])), weight=2.6)
    return d


def feather(ic, back, tip, w, eye=True, colors=None, flames=0, notches=True, shadow=True):
    """One of Anka's feathers from its round back to its tip: notched on each edge, a gold quill down the middle, a teal
    eye near the back. With `flames`, its back end breaks into that many licks of flame (united into one shape)."""
    p = ic.p
    L = math.dist(back, tip)
    ang = math.degrees(math.atan2(tip[1] - back[1], tip[0] - back[0]))
    base = ic.add("path.create", d=curve(place(feather_pts(L, w), ang, back), sharp=(0,)))
    parts = [ic.id(base)]
    if flames:
        spread = [0] if flames == 1 else [(-1 + 2 * i / (flames - 1)) for i in range(flames)]
        for k in spread:
            h = L * (0.42 - 0.1 * abs(k))
            at = place([(0.16 * L, k * w * 0.45)], ang, back)[0]
            lick = ic.add("path.create", d=curve(place(tongue_pts(h, w * 1.05, lean=-0.35 * k), ang + 180 + 13 * k, at)))
            parts.append(ic.id(lick))
        base = ic.add("object.pathfinder.unite", ids=parts)
        parts = [ic.ids(base)]
    shape = base
    if notches:
        # Notches on the edges: little triangles cut out with Pathfinder (Minus Front).
        cuts = []
        for u, side in ((0.5, 1), (0.68, -1), (0.4, -1), (0.66, 1)):
            vw = w * (0.98 if u < 0.6 else 0.72)
            tri = [((u - 0.04) * L, side * (vw + 2)), ((u + 0.16) * L, side * vw * 0.1), ((u + 0.1) * L, side * (vw + 2))]
            cuts.append(ic.id(ic.add("path.create", d=poly(place(tri, ang, back)))))
        first = parts[0]
        ids = ([first] if not first.endswith(".ids") else [f"{first[:-4]}.ids.0"]) + cuts
        shape = ic.add("object.pathfinder.minusFront", ids=ids)
    ref = ic.ids(shape) if (notches or flames) else ic.id(shape)
    c = colors or (p["core"], p["hot"], p["body"])
    ic.solid(ref, ic.grad(c[0], (0.4, c[1]), (1, c[2])), shadow=shadow)
    # The quill: gold, lit from the upper left.
    q = place([(-0.04 * L, 0), (0.94 * L, 0)], ang, back)
    ic.line(poly(q, closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    if eye:
        ex, ey = place([(0.27 * L, 0)], ang, back)[0]
        rx, ry = 0.12 * L, 0.6 * w
        for (k, fill) in ((1.0, p["dark"]), (0.78, GOLD[1]), (0.58, p["accent"])):
            e = ic.add("shape.ellipse", x=ex - rx * k, y=ey - ry * k, width=2 * rx * k, height=2 * ry * k, rotation=ang)
            ic.paint(ic.id(e), fill=fill, stroke="none")
        dot = ic.add("shape.ellipse", x=ex - rx * 0.22 - 0.4, y=ey - ry * 0.22 - 0.5, width=rx * 0.44, height=ry * 0.44)
        ic.paint(ic.id(dot), fill=p["core"], stroke="none")


def anka_q(ic):
    """Ember Quill: a feather thrown point first, its back breaking into flame, toward the ember it becomes."""
    ember_ring(ic, 45.5, 50, 11.5, 4.4, [(38.5, -100, 7, 4.2), (46, -88, 10, 5), (53, -78, 7, 4.2)])
    feather(ic, (21, 20), (46.5, 45.5), 5.6, flames=3)


def anka_w(ic):
    """Fan the Flames: her open fan, pleated in fire, over an ember that flares into a ring of flame."""
    p = ic.p
    pv = (32, 41)
    R, notch, r0, n = 26, 22.5, 8, 8
    a0, a1 = -172, -8
    step = (a1 - a0) / n
    def at(r, deg):
        return (pv[0] + r * math.cos(math.radians(deg)), pv[1] + r * math.sin(math.radians(deg)))
    # The handle: dark lacquer, below the pivot.
    ic.shape(poly([(30, 42), (34, 42), (33.3, 50.5), (30.7, 50.5)]), ic.grad("#5a463a", (1, "#1c1410")), shadow=False,
             ink_w=3)
    # The whole fan's outline and shadow: a sector with a scalloped edge, from the pivot.
    edge = [at(notch, a0)]
    for i in range(n):
        edge += [at(R, a0 + (i + 0.5) * step), at(notch, a0 + (i + 1) * step)]
    ic.shape(poly([pv] + edge), p["dark"])
    # The pleats: one pair (a lit fold and a shaded fold), turned about the pivot with Rotate (copy). The gradients are
    # centred on the pivot, so every copy is lit the same way: fire hottest at the edge.
    lit = ic.grad(p["body"], (0.55, p["hot"]), (1, p["core"]), kind="radial", start=list(pv), end=[pv[0] + R, pv[1]])
    shade = ic.grad(p["red"], (0.55, p["body"]), (1, p["hot"]), kind="radial", start=list(pv), end=[pv[0] + R, pv[1]])
    m = ic.mark()
    for i, fill in ((0, lit), (1, shade)):
        lo, hi = a0 + i * step, a0 + (i + 1) * step
        ic.path(poly([at(r0, lo), at(notch, lo), at(R, (lo + hi) / 2), at(notch, hi), at(r0, hi)]), fill=fill, stroke="none")
    pair = ic.group(m)
    for k in (1, 2, 3):
        ic.add("object.rotate", ids=[pair], angle=-2 * step * k, origin=list(pv), copy=True)
    # The two guard sticks and the rivet: gold on the structure.
    for deg in (a0, a1):
        ic.line(poly([pv, at(notch - 0.5, deg)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.8, ink_w=3.6)
    r = ic.add("shape.ellipse", x=pv[0] - 2.8, y=pv[1] - 2.8, width=5.6, height=5.6)
    ic.solid(ic.id(r), ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), shadow=False, ink_w=2.4)
    # In front of the fan: the ember it fans, flaring into a ring of flame.
    ember_ring(ic, 32, 52.5, 17, 4.8, [(14.5, -122, 12, 5.2), (21.5, -100, 8, 4.2), (42.5, -80, 8, 4.2), (49.5, -58, 12, 5.2)])


def comet(ic, a, c, b, w, colors):
    """A streak along the quadratic curve a -> c -> b, from nothing at a to `w` wide and round at b."""
    def q(t):
        return ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])
    left, right = [], []
    n = 14
    for i in range(n + 1):
        t = i / n
        x, y = q(t)
        t0, t1 = max(0, t - 0.01), min(1, t + 0.01)
        dx, dy = q(t1)[0] - q(t0)[0], q(t1)[1] - q(t0)[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        ww = w * (t ** 0.8)
        left.append((x + nx * ww, y + ny * ww))
        right.append((x - nx * ww, y - ny * ww))
    x, y = q(1)
    x0, y0 = q(0.98)
    l = math.hypot(x - x0, y - y0)
    head = (x + (x - x0) / l * w, y + (y - y0) / l * w)
    pts = left + [head] + list(reversed(right))
    s = ic.add("path.create", d=curve(pts, sharp=(0, len(pts) - 1)))
    ic.paint(ic.id(s), fill=ic.grad(*colors, start=list(a), end=list(head)), stroke="none")
    return ic.id(s)


def anka_e(ic):
    """Ember Flight: she streaks in an arc to her ember and lands in a burst."""
    p = ic.p
    land = (43, 44)
    ember_ring(ic, 43, 49.5, 13.5, 5, [])
    # The streak: a dark wake under it, then the flame, fading to nothing at its start.
    comet(ic, (6, 55), (11, 12), (39, 39), 6.6, ((0, p["dark"], 0), (0.4, p["dark"], 0.7), (1, p["dark"])))
    comet(ic, (6, 55), (11, 12), (39, 39), 4.6, ((0, p["body"], 0), (0.4, p["body"]), (0.8, p["hot"]), (1, p["core"])))
    # The landing: an eight-point burst (two four-point stars, the small one turned 45 degrees).
    st = ic.add("shape.star", cx=land[0], cy=land[1], radius1=7.5, radius2=2.4, points=4, rotation=45)
    ic.solid(ic.id(st), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=3)
    st = ic.add("shape.star", cx=land[0], cy=land[1], radius1=12.5, radius2=3, points=4)
    ic.solid(ic.id(st), ic.grad(p["core"], (0.6, p["hot"]), (1, p["body"])), ink_w=3.4)
    d = ic.add("shape.ellipse", x=land[0] - 2, y=land[1] - 2, width=4, height=4)
    ic.paint(ic.id(d), fill="#ffffff", stroke="none")


def anka_r(ic):
    """Firebird: a great firebird seen from above, wings of fire spread, a tail of eyed feathers."""
    p = ic.p
    m = ic.mark()
    feather(ic, (41.5, 55), (34, 40), 3.4, notches=False, shadow=True)
    side_tail = ic.group(m)
    ic.add("object.reflect", ids=[side_tail], axis="vertical", origin=[32, 32], copy=True)
    feather(ic, (32, 58), (32, 40), 3.8, notches=False, shadow=True)
    # The right wing (a scalloped edge of four primaries), its gold leading edge and its coverts; then Reflect (copy).
    m = ic.mark()
    wing = [(34.5, 25), (40, 18), (46.5, 13.5), (53.5, 10.5), (50.5, 17.5), (57, 19.5), (51.5, 23.5), (56, 29.5),
            (48.5, 29.5), (50, 37), (43.5, 33.5), (40, 38), (35, 34)]
    ic.shape(curve(wing, sharp=(3, 4, 5, 6, 7, 8, 9, 10, 11)), ic.grad(p["hot"], (0.5, p["body"]), (1, p["red"])))
    cov = [(35, 26.5), (40, 21.5), (46, 18), (44.5, 25), (40, 30), (35.5, 31.5)]
    ic.shape(curve(cov, sharp=(2,)), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=3)
    ic.line(curve([(35.5, 24), (40, 18), (46.5, 13.5), (53, 10.8)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.4,
            ink=False)
    right = ic.group(m)
    ic.add("object.reflect", ids=[right], axis="vertical", origin=[32, 32], copy=True)
    # Body and head (one shape: Pathfinder Unite), a hot core, a gold beak.
    body = ic.add("path.create", d=curve([(32, 19), (35, 23.5), (36, 31), (34.5, 39), (32, 44), (29.5, 39), (28, 31),
                                          (29, 23.5)], sharp=(4,)))
    head = ic.add("shape.ellipse", x=28.4, y=12.8, width=7.2, height=7.4)
    bh = ic.add("object.pathfinder.unite", ids=[ic.id(body), ic.id(head)])
    ic.solid(ic.ids(bh), ic.grad(p["core"], (0.45, p["hot"]), (1, p["body"])))
    g = ic.add("shape.ellipse", x=30, y=24, width=3.4, height=12)
    ic.paint(ic.id(g), fill=p["core"], stroke="none")
    ic.shape(poly([(32, 8.6), (34, 13.4), (30, 13.4)]), ic.grad(GOLD[0], (1, GOLD[1])), shadow=False, ink_w=2.4)


ICONS = {'q': anka_q, 'w': anka_w, 'e': anka_e, 'r': anka_r}
