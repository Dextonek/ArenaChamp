"""Hank the Moss Hewer (src/kits/timber.ts): the Horned of the Wood folk in moss and bark, a great double axe whose edges
and runes glow green, and the trees he grows and fells."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Moss / rune" (Hank; src/kits/timber.ts S): the axe's rune green, a warm wood accent, the forest's dark.
PAL["hank"] = row("#f4ffe0", "#c8f08a", "#7fbf55", "#e8b868", "#1c120b",
                  wood="#b5763a", bark="#6a4426", pine="#3f6b3a", pine_lo="#23421f", steel="#cfd5d8")
PAL["hank"].update(lit="#2c3a1e", mid="#1a2212")


def axe(ic, grip, ang, L=30, s=1.0):
    """The double axe: a haft with a leather wrap, two bearded blades with green rune edges."""
    p = ic.p
    a, b = place([(0, 0), (L, 0)], ang, grip)
    ic.line(poly([a, b], closed=False), ic.grad("#d8a868", (1, p["bark"])), 3.2 * s, ink_w=6 * s)
    head = place([(L - 4, 0)], ang, grip)[0]
    for side in (-1, 1):
        blade = [(-2.6, 0), (-3.6, side * 4), (-6.5, side * 10.5), (0, side * 8.5), (6.5, side * 10.5), (3.6, side * 4),
                 (2.6, 0)]
        ic.shape(curve(place([(x * s, y * s) for x, y in blade], ang, head), sharp=(0, 2, 4, 6), k=0.5),
                 ic.grad("#ffffff", (0.45, p["steel"]), (1, "#5a6468")))
        edge = [(-6.5, side * 10.5), (0, side * 8.5), (6.5, side * 10.5)]
        ic.line(curve(place([(x * s, y * s) for x, y in edge], ang, head), closed=False), ic.grad(p["core"], (1, p["body"])),
                1.8, ink=False)
    for u in (0.12, 0.3):
        a, b = place([(u * L, -2), (u * L + 2, 2)], ang, grip)
        ic.line(poly([a, b], closed=False), GOLD[1], 1.2, ink=False)
    dot(ic, head[0], head[1], 1.8 * s, p["body"])
    glow(ic, head[0], head[1], 4 * s, p["body"], opacity=80)


def pine(ic, foot, h, ang=0, fill=None):
    """A pine: three tiers of boughs on a short trunk, turned by ang about its foot."""
    p = ic.p
    w = h * 0.36
    pts = [(-0.12 * w, 0), (-0.12 * w, -0.14 * h), (-w, -0.14 * h), (-0.45 * w, -0.42 * h), (-0.8 * w, -0.42 * h),
           (-0.3 * w, -0.7 * h), (-0.55 * w, -0.7 * h), (0, -h), (0.55 * w, -0.7 * h), (0.3 * w, -0.7 * h), (0.8 * w, -0.42 * h),
           (0.45 * w, -0.42 * h), (w, -0.14 * h), (0.12 * w, -0.14 * h), (0.12 * w, 0)]
    ic.shape(poly(place([(x, y) for x, y in pts], ang, foot)), fill or ic.grad(p["hot"], (0.4, p["body"]), (1, p["pine_lo"])))


def han_q(ic):
    """Axe Swing: a quick swing in front of him; any tree of his it touches falls."""
    p = ic.p
    swoosh(ic, (26, 40), 25, -160, -20, 7, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.62)
    axe(ic, (22, 46), -58, 32)


def han_w(ic):
    """Fast Growth: a tree bursts up at the spot and throws whoever stands there into the air."""
    p = ic.p
    ring(ic, 32, 50, 17, 4.4, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    for x, ang, h in ((20, -120, 9), (44, -60, 9)):
        ic.shape(curve(place(tongue_pts(h, 4.4, lean=0.1), ang, (x, 49))), ic.grad("#e8d0a0", (1, p["wood"])), shadow=False,
                 ink_w=2.4)
    pine(ic, (32, 50), 42)
    for x in (16, 48):
        chevron(ic, (x, 20), -90, 3.4, p["hot"], 2.2)
        ic.line(poly([(x, 21), (x, 29)], closed=False), p["hot"], 2.2)


def han_e(ic):
    """Caber Toss: he rips up a tree and hurls it end over end."""
    p = ic.p
    for r in (18, 24):
        ic.line(poly(arc_pts((32, 32), r, 200, 290, 8), closed=False), p["core"], 1.8)
    c, ang, L = (34, 30), -35, 36
    trunk = [(-L / 2, -3.4), (L / 2, -2.6), (L / 2, 2.6), (-L / 2, 3.4)]
    ic.shape(poly(place(trunk, ang, c)), ic.grad("#d8a868", (0.5, p["wood"]), (1, p["bark"])))
    for u in (-8, 2, 10):
        a, b = place([(u, -2.8), (u + 3, 2.8)], ang, c)
        ic.line(poly([a, b], closed=False), p["bark"], 1.0, ink=False)
    end = place([(-L / 2, 0)], ang, c)[0]
    e = ic.add("shape.ellipse", x=end[0] - 2.4, y=end[1] - 3.6, width=4.8, height=7.2, rotation=ang)
    ic.solid(ic.id(e), ic.grad("#f4dcae", (1, "#c89a62")), shadow=False, ink_w=2.2)
    top = place([(L / 2, 0)], ang, c)[0]
    pine(ic, top, 13, ang=ang + 90, fill=ic.grad(p["hot"], (1, p["pine"])))
    for x, y in ((14, 40), (19, 44)):
        dot(ic, x, y, 1.6, "#a07848")


def han_r(ic):
    """TIMBER!: five trees grow in a row; at his swing they fall like dominoes along it."""
    p = ic.p
    ic.line(poly([(12, 50), (58, 50)], closed=False), p["bark"], 2.2, ink_w=4)
    for k, (x, ang) in enumerate(((14, 0), (23, 14), (32, 32), (41, 56))):
        pine(ic, (x, 50), 28 - k * 1.5, ang=ang)
    for r, a0 in ((26, -100), (19, -84)):
        ic.line(poly(arc_pts((41, 50), r, a0, a0 + 26, 6), closed=False), p["core"], 1.8)
    chevron(ic, (41 + 26 * math.cos(math.radians(-74)), 50 + 26 * math.sin(math.radians(-74))), 16, 3, p["core"], 2.0)


ICONS = {"q": han_q, "w": han_w, "e": han_e, "r": han_r}
