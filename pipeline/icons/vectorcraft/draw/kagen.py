"""Kagen, the Scarlet Sheath (src/heroes/sheath/): the spell icons and the passive's, in the family's rules (vclib.py).

    python pipeline/icons/vectorcraft/make.py kagen

Q Issen (One Flash): one slash of white steel across the icon with a cinnabar after-line behind it.
W Noto (The Click): the scarlet sheath standing in its ring, the blade sliding home into its gold mouth.
E Senbon (Thousand Swords): katanas falling point-down into a ring, two more behind.
R Sekai-giri (World Sever): one long cut tearing open like a burning almond, cinnabar light in the dark.
P Scarlet Sheath (the passive; slot `p`, the game draws it from the same folder): the sheath with its two paper seals,
  his signature shape.
Colours: cinnabar, rice paper, black lacquer, steel and gold (src/heroes/sheath/numbers.ts `C`). Gold only on the sword
fittings (the mouth, the guard), as the family wants it: on edges.
"""
import math

from vclib import *  # noqa: F401,F403  the builder, the geometry and the rules
from vclib import GOLD, PAL

# core: the steel's flash, hot: rice paper, body: cinnabar, accent: rice paper, dark: black lacquer
PAL["kagen"] = row("#fffaf0", "#ebe8e2", "#cf4a1c", "#ebe8e2", "#14100c", red="#8e2a10", flare="#ff8a52",
                   steel="#f4f1ea", steelLo="#9fa8b2", paper="#ebe8e2", paperLo="#bdb8ae")


def steel(ic):
    p = ic.p
    return ic.grad(p["core"], (0.45, p["steel"]), (1, p["steelLo"]))


def lacquer(ic):
    p = ic.p
    return ic.grad(p["flare"], (0.4, p["body"]), (1, p["red"]))


def lens_d(a, c, b, w, n=16, pw=0.9):
    """A slim leaf along the quadratic curve a -> c -> b: a point at each end, `w` half-wide in the middle."""
    def q(t):
        return ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        x, y = q(t)
        t0, t1 = max(0, t - 0.01), min(1, t + 0.01)
        dx, dy = q(t1)[0] - q(t0)[0], q(t1)[1] - q(t0)[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        ww = w * math.sin(math.pi * t) ** pw
        left.append((x + nx * ww, y + ny * ww))
        right.append((x - nx * ww, y - ny * ww))
    pts = left + list(reversed(right[1:n]))
    return curve(pts, sharp=(0, n)), q


def blade(ic, tip, ang, L, w, grip=9.0, shadow=True):
    """A katana pointing away from `ang` (its tip at `tip`): blade, gold guard, dark grip with a cinnabar wrap."""
    p = ic.p
    at = tip
    ic.shape(poly(place([(0, 0), (3.2, -w), (L, -w), (L, w), (3.2, w)], ang, at)), steel(ic), shadow=shadow, ink_w=3.0)
    # the edge's line: a thin shade down the lower half of the blade
    ic.line(poly(place([(4, w * 0.35), (L, w * 0.35)], ang, at), closed=False), p["steelLo"], 0.9, ink=False)
    ic.shape(poly(place([(L, -w * 1.9), (L + 1.8, -w * 1.9), (L + 1.8, w * 1.9), (L, w * 1.9)], ang, at)),
             ic.grad(GOLD[0], (1, GOLD[1])), shadow=False, ink_w=2.4)
    ic.shape(poly(place([(L + 1.8, -w * 0.8), (L + 1.8 + grip, -w * 0.8), (L + 1.8 + grip, w * 0.8), (L + 1.8, w * 0.8)], ang, at)),
             ic.grad("#3a2e26", (1, p["dark"])), shadow=False, ink_w=2.4)
    ic.line(poly(place([(L + 4.6, -w * 0.8), (L + 4.6, w * 0.8)], ang, at), closed=False), p["body"], 1.2, ink=False)
    ic.line(poly(place([(L + 7.4, -w * 0.8), (L + 7.4, w * 0.8)], ang, at), closed=False), p["body"], 1.2, ink=False)


def sheath_pts(L, w):
    """The sheath along +u from its mouth (u=0) to its tip (u=L): straight, a rounded foot."""
    return [(0, -w), (L - 5, -w), (L - 1.2, -w * 0.72), (L + 1.5, 0), (L - 1.2, w * 0.72), (L - 5, w), (0, w)]


def kagen_q(ic):
    """Q Issen: one white-steel slash, the cinnabar after-line behind it, a glint at its end."""
    p = ic.p
    d2, _ = lens_d((5, 24), (28, 33), (50, 56), 2.0)
    s = ic.add("path.create", d=d2)
    ic.solid(ic.id(s), lacquer(ic), shadow=False, ink_w=3.0)
    d1, _ = lens_d((7, 12), (30, 24), (57, 50), 3.2)
    s = ic.add("path.create", d=d1)
    ic.solid(ic.id(s), steel(ic), ink_w=3.6)
    ic.line(poly([(14, 16), (45, 33)], closed=False), p["core"], 1.0, ink=False, opacity=80)
    spark(ic, 55.5, 48, 5.2)
    spark(ic, 47, 21, 2.6)


def kagen_w(ic):
    """W Noto: the sheath in its ring, the blade sliding home into the gold mouth."""
    p = ic.p
    ring(ic, 32, 47, 24, 9, p["body"], w=2.8)
    M, ang, L, w = (37, 24), 110, 33, 5.4
    ic.shape(curve(place(sheath_pts(L, w), ang, M), sharp=(0, 1, 2, 4, 5, 6)), lacquer(ic), ink_w=3.2)
    # the lacquer's highlight, down the upper-left edge
    ic.line(poly(place([(3, -w * 0.55), (L - 8, -w * 0.55)], ang, M), closed=False), p["flare"], 1.0, ink=False, opacity=85)
    # the blade, sliding in from the upper right (a short glint of its edge), then the guard and the grip
    ic.shape(poly(place([(-19, -1.9), (1.2, -1.9), (1.2, 1.9), (-19, 1.9)], ang, M)), steel(ic), shadow=False, ink_w=2.8)
    ic.shape(poly(place([(-21, -4.6), (-19, -4.6), (-19, 4.6), (-21, 4.6)], ang, M)), ic.grad(GOLD[0], (1, GOLD[1])),
             shadow=False, ink_w=2.4)
    ic.shape(poly(place([(-21, -1.6), (-30, -1.6), (-30, 1.6), (-21, 1.6)], ang, M)), ic.grad("#3a2e26", (1, p["dark"])),
             shadow=False, ink_w=2.4)
    # the mouth's gold collar, over the blade's end
    ic.shape(poly(place([(-1.6, -w - 1.4), (3.2, -w - 1.4), (3.2, w + 1.4), (-1.6, w + 1.4)], ang, M)),
             ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), shadow=False, ink_w=2.6)
    spark(ic, 47.5, 31, 3.2)
    spark(ic, 25, 18, 2.2)


def kagen_e(ic):
    """E Senbon: katanas falling point-down into a ring, two more behind."""
    p = ic.p
    ring(ic, 33, 50, 22, 8.5, p["body"], w=2.8)
    back = ic.grad("#d8d3c9", (1, "#7e8791"))
    for tip, ang in (((27, 42), -96), ((39.5, 43), -84)):
        ic.shape(poly(place([(0, 0), (2.6, -1.8), (21, -1.8), (21, 1.8), (2.6, 1.8)], ang, tip)), back, shadow=False, ink_w=2.6)
        ic.shape(poly(place([(21, -3.2), (22.6, -3.2), (22.6, 3.2), (21, 3.2)], ang, tip)), ic.grad(GOLD[0], (1, GOLD[1])),
                 shadow=False, ink_w=2.0)
    blade(ic, (19.5, 47), -102, 28, 2.1, grip=7)
    blade(ic, (46.5, 48), -78, 28, 2.1, grip=7)
    blade(ic, (33, 52), -90, 31, 2.5, grip=8)
    spark(ic, 33, 52.5, 3.6)


def kagen_r(ic):
    """R Sekai-giri: one long cut tearing open like a burning almond, cinnabar light in the dark."""
    p = ic.p
    a, c, b = (42, 0), (32, 32), (22, 64)
    glow(ic, 32, 32, 22, p["body"], opacity=55, ry=32)
    # flame licks along both edges, behind the cut
    for (x, y, ang, h, wd) in ((24, 28, -104, 13, 4.2), (40.5, 38, -76, 13, 4.2), (23, 46, -98, 10, 3.6), (41.5, 20, -82, 10, 3.6)):
        ic.shape(curve(place(tongue_pts(h, wd), ang, (x, y))), ic.grad(p["core"], (0.35, p["flare"]), (1, p["body"])),
                 shadow=False, ink_w=2.4)
    d, _ = lens_d(a, c, b, 8.4, n=20, pw=0.75)
    s = ic.add("path.create", d=d)
    ic.solid(ic.id(s), ic.grad(p["steel"], (0.1, p["dark"]), (1, p["dark"]), kind="radial", start=[32, 32], end=[32, 52]),
             ink_w=3.2)
    ic.path(d, fill="none", stroke=p["paper"], weight=1.2)
    d2, _ = lens_d((40, 6), (32, 32), (24, 58), 5.4, n=20, pw=0.75)
    ic.path(d2, fill=ic.grad((0, p["core"]), (0.25, p["flare"]), (0.7, p["body"]), (1, p["red"]), kind="radial",
                             start=[32, 32], end=[32, 52]), stroke="none")
    ic.line(poly([(41, 5), (32, 32), (23, 59)], closed=False), p["core"], 1.5, ink=False)
    spark(ic, 32, 32, 4.6)
    spark(ic, 45.5, 51, 2.6)
    spark(ic, 19, 12, 2.4)


def kagen_p(ic):
    """P Scarlet Sheath: the sheath with its two paper seals (his signature shape)."""
    p = ic.p
    M, ang, L, w = (50, 49), 223.5, 50, 5.6
    ic.shape(curve(place(sheath_pts(L, w), ang, M), sharp=(0, 1, 2, 4, 5, 6)), lacquer(ic), ink_w=3.2)
    ic.line(poly(place([(5, w * 0.55), (L - 8, w * 0.55)], ang, M), closed=False), p["flare"], 1.0, ink=False, opacity=85)
    # the dark foot-cap, then the gold mouth
    ic.shape(poly(place([(L - 5, -w), (L - 1.2, -w * 0.72), (L + 1.5, 0), (L - 1.2, w * 0.72), (L - 5, w)], ang, M)),
             ic.grad("#3a2e26", (1, p["dark"])), shadow=False, ink_w=2.4)
    ic.shape(poly(place([(-1.8, -w - 1.3), (3.4, -w - 1.3), (3.4, w + 1.3), (-1.8, w + 1.3)], ang, M)),
             ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), shadow=False, ink_w=2.6)
    # the two paper seals across it: rice paper, a cinnabar mark on each
    for u in (19, 34):
        ic.shape(poly(place([(u - 3.4, -w - 3.4), (u + 3.4, -w - 3.0), (u + 3.4, w + 3.4), (u - 3.4, w + 3.0)], ang, M)),
                 ic.grad(p["core"], (0.5, p["paper"]), (1, p["paperLo"])), shadow=True, ink_w=2.6)
        ic.line(poly(place([(u, -w - 1.2), (u, w + 1.2)], ang, M), closed=False), p["body"], 1.9, ink=False)
    spark(ic, 14, 14, 3.0)


ICONS = {"q": kagen_q, "w": kagen_w, "e": kagen_e, "r": kagen_r, "p": kagen_p}
