"""Professor Puff the Aeronaut (src/kits/balloon.ts): an alchemist of the air: glowing glass spheres of rose gas on brass
chains, a brass air hose, his coat of aubergine; the air itself drawn as crescents."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Aether" (Professor Puff; src/kits/balloon.ts S): white, rose, the gas's pink, a sky-blue accent, aubergine.
PAL["professor-puff"] = row("#ffffff", "#ffd2e3", "#ff8fb8", "#8fd8ff", "#2a1424",
                            gas="#ff5c9c", shade="#c9507f", deep="#8a2f5a", brass="#d9a441", brass_lo="#7a5218")


def brass(ic):
    p = ic.p
    return ic.grad(GOLD[0], (0.45, p["brass"]), (1, p["brass_lo"]))


def sphere(ic, c, r, cap=True):
    """A glass sphere of glowing rose gas, a brass cap and ring on top, a highlight at the upper left."""
    p = ic.p
    glow(ic, c[0], c[1], r * 1.6, p["gas"], opacity=75)
    disc(ic, c[0], c[1], r, ic.grad(p["core"], (0.25, p["hot"]), (0.65, p["body"]), (1, p["deep"]), kind="radial",
                                     start=[c[0] - r * 0.35, c[1] - r * 0.35], end=[c[0] + r * 0.95, c[1] - r * 0.35]))
    ic.line(poly(arc_pts(c, r * 0.7, 195, 245, 6), closed=False), p["core"], 1.5, ink=False)
    if cap:
        top = (c[0], c[1] - r)
        cp = ic.add("shape.rectangle", x=top[0] - r * 0.32, y=top[1] - 2.2, width=r * 0.64, height=3.4, radius=0.8)
        ic.solid(ic.id(cp), brass(ic), shadow=False, ink_w=2.4)
        lp = ic.add("shape.ellipse", x=top[0] - 1.8, y=top[1] - 6, width=3.6, height=4)
        ic.paint(ic.id(lp), fill="none", stroke=p["dark"], weight=2.8)
        lp2 = ic.add("shape.ellipse", x=top[0] - 1.8, y=top[1] - 6, width=3.6, height=4)
        ic.paint(ic.id(lp2), fill="none", stroke=brass(ic), weight=1.3)


def puff_q(ic):
    """Air Hose: a jet of air from the brass nozzle: it hits and pushes."""
    p = ic.p
    for r, w, a in ((11, 4.2, 50), (17.5, 4.0, 46), (24, 3.4, 42)):
        swoosh(ic, (26, 30), r, -a, a, w, (p["core"], (0.55, p["hot"]), (1, p["accent"])), head=0.5, ink_w=2.6)
    noz = poly([(8, 25.5), (22, 27.5), (26, 26), (26, 34), (22, 32.5), (8, 34.5)])
    ic.shape(noz, brass(ic))
    for x in (12, 18):
        ic.line(poly([(x, 26), (x, 34)], closed=False), p["brass_lo"], 1.2, ink=False)
    ic.line(curve([(8, 30), (4, 33), (5, 38), (9, 40)], closed=False), ic.grad(p["shade"], (1, p["deep"])), 3.0, ink_w=5.6)


def puff_w(ic):
    """Helium Bomb: a sphere of gas floats to the spot and bursts."""
    p = ic.p
    ring(ic, 33, 51, 18, 4.4, p["body"], w=2.0, dash=[3, 2.4])
    for a in range(0, 360, 45):
        ca, sa = math.cos(math.radians(a - 22.5)), math.sin(math.radians(a - 22.5))
        ic.line(poly([(33 + ca * 17, 28 + sa * 17), (33 + ca * 23, 28 + sa * 23)], closed=False), p["hot"], 2.2,
                ink=True)
    sphere(ic, (33, 29), 12.5)
    ic.line(curve([(33, 41.5), (31, 45), (34, 48)], closed=False), p["brass"], 1.2, ink=False)


def puff_e(ic):
    """Hot Air: he swells and floats away from where you aim; whoever stood by him is blown aside."""
    p = ic.p
    ring(ic, 33, 52, 16, 4, p["accent"], w=1.8)
    for x, ang in ((50, 0), (16, 180)):
        chevron(ic, (x + (2 if ang == 0 else -2), 52), ang, 2.6, p["accent"], 2.0)
    env = curve([(36, 6), (47.5, 13), (49, 24), (42, 33), (38, 36), (34, 36), (30, 33), (23, 24), (24.5, 13)],
                sharp=(5, 6), k=0.75)
    glow(ic, 36, 21, 20, p["gas"], opacity=70)
    ic.shape(env, ic.grad(p["core"], (0.25, p["hot"]), (0.65, p["body"]), (1, p["deep"])))
    for a, b in (((30.5, 12), (31.5, 34)), ((41.5, 12), (40.5, 34))):
        ic.line(curve([a, ((a[0] + b[0]) / 2 - 1.6 if a[0] < 36 else (a[0] + b[0]) / 2 + 1.6, 22), b], closed=False),
                p["shade"], 1.1, ink=False)
    for a, b in (((33, 36), (32, 41)), ((39, 36), (40, 41))):
        ic.line(poly([a, b], closed=False), p["brass_lo"], 1.0, ink=False)
    g = ic.add("shape.rectangle", x=30.5, y=40.5, width=11, height=5, radius=1.2)
    ic.solid(ic.id(g), brass(ic), shadow=False, ink_w=2.6)
    for x in (18, 54):
        chevron(ic, (x, 16), -90, 3.2, p["core"], 2.0)
        ic.line(poly([(x, 17), (x, 26)], closed=False), p["core"], 2.0)


def puff_r(ic):
    """Pop!: a brass pin flies at you, and all your air goes out at once."""
    p = ic.p
    c = (41, 36)
    star(ic, c[0], c[1], 17, 5, ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), points=8, ink_w=3)
    star(ic, c[0], c[1], 9, 3, p["core"], points=4, rotation=45, ink_w=0)
    for x, y, a in ((57, 22, -30), (58, 47, 40), (27, 51, 140)):
        shard(ic, (x - 3, y), a, 5.6, 1.6, ic.grad(p["hot"], (1, p["shade"])), shadow=False, ink_w=2.2)
    ic.line(poly([(12, 9), (36, 31)], closed=False), ic.grad("#ffffff", (1, "#9aa0aa")), 2.0, ink_w=4.4)
    disc(ic, 12, 9, 4.2, brass(ic), shadow=True, ink_w=3)
    dot(ic, 10.7, 7.6, 1.2, GOLD[0])
    streaks(ic, [(18, 6, 23, 11), (8, 16, 13, 21)], color=p["core"], weight=1.6)


ICONS = {"q": puff_q, "w": puff_w, "e": puff_e, "r": puff_r}
