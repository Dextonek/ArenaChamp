"""Bo the Ramherd (src/kits/sheep.ts): a mountain herdsman-druid in a ram-horn hood, a crook of dark wood with a glowing
bell, and his flock: black-faced, curl-horned mountain sheep, drawn as fleece and horn, never as toys."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Fold / bell" (Bo; src/kits/sheep.ts S): fleece cream to the bell's warm gold, a meadow green accent, peat.
PAL["bo"] = row("#f6f1df", "#ffe9a8", "#ffc462", "#7fbf5a", "#14110f",
                wool="#d3cdbc", wool_lo="#8f897b", wood="#7a5a3a", wood_hi="#a8845a", horn="#c9b07a", face="#2a2421")
PAL["bo"].update(lit="#2e3a22", mid="#1a2114")  # the high meadow at dusk, not the bell's brown


def spiral_d(c, r0, r1, a0, turns, n=18):
    pts = []
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + 360 * turns * t)
        r = r0 + (r1 - r0) * t
        pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    return curve(pts, closed=False)


def sheep(ic, c, r, facing=1, horn=True, tone=None):
    """A black-faced mountain sheep seen from the side: a fleece of curls, a long dark face, a curled horn."""
    p = ic.p
    fx = facing
    for lx in (-0.45, 0.4):  # legs, under the fleece
        ic.line(poly([(c[0] + lx * r * fx, c[1] + 0.5 * r), (c[0] + lx * r * fx, c[1] + 1.0 * r)], closed=False),
                p["face"], max(1.6, r * 0.2), ink_w=max(3.0, r * 0.38))
    fleece = blob_d(c, r, n=7, wobble=0.13, ry=r * 0.74, phase=0.3)
    ic.shape(fleece, tone or ic.grad(p["core"], (0.5, p["wool"]), (1, p["wool_lo"])), ink_w=max(3.0, r * 0.42))
    hx, hy = c[0] + fx * r * 0.78, c[1] - r * 0.02
    head = ic.add("shape.ellipse", x=hx - r * 0.28, y=hy - r * 0.42, width=r * 0.56, height=r * 0.86, rotation=-38 * fx)
    ic.solid(ic.id(head), ic.grad("#5a4e46", (1, p["face"])), shadow=False, ink_w=max(2.4, r * 0.3))
    dot(ic, hx + fx * r * 0.02, hy - r * 0.16, max(0.6, r * 0.08), p["hot"])
    if horn:
        ic.line(spiral_d((hx - fx * r * 0.18, hy - r * 0.18), r * 0.42, r * 0.1, -90 if fx > 0 else -90, -0.85 * fx),
                ic.grad(p["core"], (1, p["horn"])), max(1.6, r * 0.2), ink_w=max(3.2, r * 0.38))


def bell(ic, cx, top, s=1.0):
    p = ic.p
    glow(ic, cx, top + 4.5 * s, 7.5 * s, p["body"], opacity=90)
    d = curve([(cx - 1.4 * s, top), (cx + 1.4 * s, top), (cx + 2.6 * s, top + 4 * s), (cx + 4 * s, top + 7 * s),
               (cx - 4 * s, top + 7 * s), (cx - 2.6 * s, top + 4 * s)], sharp=(3, 4))
    ic.shape(d, ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), shadow=False, ink_w=2.6)
    dot(ic, cx, top + 7.6 * s, 1.1 * s, p["hot"])


def crook(ic, foot, top, hook_r=5.2):
    """The herdsman's crook: a dark wooden staff ending in a hook that curls back over itself."""
    p = ic.p
    ang = math.atan2(top[1] - foot[1], top[0] - foot[0])
    c = (top[0] - hook_r * math.cos(ang + math.pi / 2), top[1] - hook_r * math.sin(ang + math.pi / 2))
    a0 = math.degrees(ang) + 90
    hook = arc_pts(c, hook_r, a0, a0 - 230, 10)
    d = curve([foot, ((foot[0] + top[0]) / 2, (foot[1] + top[1]) / 2)] + hook, closed=False, sharp=(0, 1))
    ic.line(d, ic.grad(p["wood_hi"], (1, p["wood"])), 3.8, ink_w=6.8)
    ic.line(poly([((foot[0] * 3 + top[0]) / 4, (foot[1] * 3 + top[1]) / 4),
                  ((foot[0] * 3 + top[0]) / 4 + 0.01, (foot[1] * 3 + top[1]) / 4 + 0.01)], closed=False),
            GOLD[1], 4.2, ink=False)
    return hook[-1]


def bo_q(ic):
    """Crook Whack: he swings the crook through a cone in front of him; the bell rings on its hook."""
    p = ic.p
    swoosh(ic, (22, 34), 27, -58, 50, 5.6, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.7)
    end = crook(ic, (46, 55), (28, 12))
    bell(ic, end[0] + 0.2, end[1] + 0.6, 0.95)
    ic.line(poly([end, (end[0] + 0.2, end[1] + 0.8)], closed=False), GOLD[1], 1.2, ink=False)


def bo_w(ic):
    """Spare Sheep: three sheep drop onto a spot and stand in the bell's ring."""
    p = ic.p
    ring(ic, 33, 50.5, 19, 4.6, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    streaks(ic, [(19, 10, 19, 17), (45.5, 8, 45.5, 15), (33, 6, 33, 12)], color=p["core"], weight=1.8)
    sheep(ic, (21, 31), 7.2, facing=-1, horn=False, tone=ic.grad(p["wool"], (1, p["wool_lo"])))
    sheep(ic, (45, 29), 7.2, facing=1, horn=False, tone=ic.grad(p["wool"], (1, p["wool_lo"])))
    sheep(ic, (32, 40.5), 9.6, facing=1)


def bo_e(ic):
    """Shear: the old one-piece shears close, and the fleece flies off at you."""
    p = ic.p
    steel = ic.grad("#ffffff", (0.45, "#c8c8cc"), (1, "#6a6a70"))
    # The bow spring at the foot and the two blades, a little open.
    ic.line(curve(arc_pts((40, 47), 5.2, -30, 210, 10), closed=False), steel, 2.6, ink_w=5.2)
    for base, tip, w in (((35.5, 44.5), (15, 15), 3.3), ((44.5, 44.5), (24, 11), 3.3)):
        ang = math.degrees(math.atan2(tip[1] - base[1], tip[0] - base[0]))
        L = math.dist(base, tip)
        ic.shape(poly(place([(0, -1.2), (0.55 * L, -w), (L, 0), (0.55 * L, w * 0.25), (0, 1.2)], ang, base)), steel,
                 ink_w=3.2)
    ic.line(poly([(37, 37), (42.5, 37)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.6, ink=False)
    streaks(ic, [(33, 22, 39, 20), (34, 30, 40, 29)], color=p["hot"], weight=1.8)
    ic.shape(blob_d((48.5, 22), 7.4, n=6, wobble=0.16, ry=5.8), ic.grad(p["core"], (0.55, p["wool"]), (1, p["wool_lo"])),
             ink_w=3.2)
    spark(ic, 53.5, 13.5, 3.2, p["hot"])


def bo_r(ic):
    """Stampede: the flock charges down a line, the old ram in front, head down, horns first."""
    p = ic.p
    for y, x0, x1 in ((18, 6, 15), (28, 4, 12)):
        ic.line(poly([(x0, y), (x1, y)], closed=False), p["core"], 2.0)

    echo = ic.grad(p["wool"], (1, p["wool_lo"]))
    m = ic.mark()
    sheep(ic, (21, 24), 7.4, facing=1, horn=False, tone=echo)
    sheep(ic, (27, 37), 8.2, facing=1, horn=False, tone=echo)
    ic.add("object.setProps", ids=[ic.group(m)], opacity=72)
    sheep(ic, (41.5, 31), 12, facing=1)
    for t in (40, 48):
        chevron(ic, (56, t + 0.5), 0, 3.0, p["hot"], 2.2)


ICONS = {"q": bo_q, "w": bo_w, "e": bo_e, "r": bo_r}
