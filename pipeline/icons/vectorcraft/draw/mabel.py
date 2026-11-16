"""Mabel the Deepdelver (src/kits/mole.ts): a mole-folk miner of the Deep: huge gold-tipped digging claws, a crystal
lantern on her helm, soil and the dark under it."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Deep / lantern" (Mabel; src/kits/mole.ts S): the lantern crystal's ladder, a cave-crystal teal accent.
PAL["mabel"] = row("#fff6d6", "#ffcf5a", "#ffb040", "#6fd0c8", "#120b06",
                   soil="#a98258", dirt="#6b4e33", earth="#3a2818", claw="#e8e0cc")
PAL["mabel"].update(lit="#3a2a1a", mid="#21160c")


def soil(ic):
    p = ic.p
    return ic.grad("#d9b98a", (0.45, p["soil"]), (1, p["dirt"]))


def clods(ic, pts):
    p = ic.p
    for x, y, r in pts:
        ic.shape(blob_d((x, y), r, n=4, wobble=0.22, ry=r * 0.8, phase=x), soil(ic), shadow=False, ink_w=2.2)


def claw(ic, base, ang, L, w):
    """One digging claw: dark horn curving to a gold-tipped point."""
    p = ic.p
    pts = [(0, -w), (0.5 * L, -w * 0.9), (0.85 * L, -w * 0.3), (L, 0.5 * w), (0.6 * L, 0.2 * w), (0, w)]
    ic.shape(curve(place(pts, ang, base), sharp=(3,), k=0.6), ic.grad(p["claw"], (0.5, "#9a8a70"), (1, "#4a3a2a")),
             ink_w=3.2)
    tip = place([(0.72 * L, -0.25 * w), (L, 0.5 * w), (0.66 * L, 0.32 * w)], ang, base)
    ic.path(poly(tip), fill=ic.grad(GOLD[0], (1, GOLD[1])), stroke="none")


def mab_q(ic):
    """Claw: a swipe of her digging claws, three gold-tipped hooks through the air."""
    p = ic.p
    for r, w in ((15, 5.4), (21, 5.0), (27, 4.2)):
        swoosh(ic, (14, 46), r, -100, -5, w, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.55, ink_w=2.6)
    # The paw: a broad dark palm with three claws out along the swipe.
    paw = ic.add("shape.ellipse", x=31, y=31, width=15, height=13, rotation=-30)
    ic.solid(ic.id(paw), ic.grad("#7a6658", (1, "#2e2420")), ink_w=4)
    for ang, dx, dy in ((-60, 38, 31), (-28, 43, 34), (2, 44.5, 39.5)):
        claw(ic, (dx, dy), ang, 14, 2.6)
    clods(ic, [(54, 48, 2.6), (47, 52, 2.0)])


def mab_w(ic):
    """Dig: a hole opens at the spot: fall in and you are stuck, then slowed."""
    p = ic.p
    rim = ic.add("shape.ellipse", x=13, y=33, width=40, height=17)
    ic.solid(ic.id(rim), soil(ic), ink_w=4.6)
    hole = ic.add("shape.ellipse", x=17.5, y=36, width=31, height=11.5)
    ic.paint(ic.id(hole), fill=ic.grad("#000000", (0.7, p["earth"]), (1, p["dirt"]), angle=90), stroke="none")
    hole2 = ic.add("shape.ellipse", x=17.5, y=36, width=31, height=11.5)
    ic.paint(ic.id(hole2), fill="none", stroke=p["dark"], weight=1.6)
    for side in (-1, 1):
        for k, (dx, dy, r) in enumerate(((6, -10, 3.0), (10, -17, 2.4), (13, -23, 1.8))):
            clods(ic, [(33 + side * (dx + 6), 36 + dy, r)])
    for x, y, a in ((33, 12, -90), (24, 17, -120), (42, 17, -60)):
        ic.line(poly([(x - 3 * math.cos(math.radians(a)), y - 3 * math.sin(math.radians(a))), (x, y)], closed=False),
                p["hot"], 1.6, ink=False, opacity=80)
    glow(ic, 33, 41.5, 10, p["body"], opacity=35, ry=3.5)


def mab_e(ic):
    """Mole Run: she dives and tunnels under the floor, a mound showing her way, and bursts up under you."""
    p = ic.p
    ic.line(curve([(12, 36), (24, 40), (36, 38), (47, 33)], closed=False), p["hot"], 1.6, ink=False, dash=[2.4, 2.4],
            opacity=80)
    for x, y, r in ((17, 36, 4.0), (27, 38.5, 4.8), (37, 37, 5.4)):
        ic.shape(f"M{f(x - r * 1.3)} {f(y + 1)} C{f(x - r)} {f(y - r * 1.3)} {f(x + r)} {f(y - r * 1.3)} {f(x + r * 1.3)} {f(y + 1)} Z",
                 soil(ic), shadow=False, ink_w=3)
    star(ic, 49, 29, 13, 3.6, ic.grad(p["core"], (0.45, p["hot"]), (1, p["body"])), points=4, ink_w=3)
    clods(ic, [(43, 15, 2.6), (55.5, 16, 2.2), (57, 33, 2.0), (41, 24.5, 2.0)])
    chevron(ic, (49, 8), -90, 4.2, p["core"], 2.6)
    ic.line(poly([(49, 9), (49, 15.5)], closed=False), p["core"], 2.6)


def mab_r(ic):
    """Sinkhole: the ground falls away under you, a pit four metres wide."""
    p = ic.p
    # Seen from the side: the floor breaks in the middle and drops into the dark.
    pit = poly([(20, 27), (44, 27), (38, 50), (26, 50)])
    ic.path(pit, fill=ic.grad(p["dirt"], (0.5, p["earth"]), (1, "#000000"), angle=-90), stroke="none")
    for side in (-1, 1):
        x0 = 32 + side * 26
        slab = [(x0, 27), (32 + side * 12, 27), (32 + side * 9, 33), (32 + side * 7, 46), (x0, 40)]
        ic.shape(poly(slab), soil(ic))
        ic.line(poly([(x0, 27.4), (32 + side * 12, 27.4)], closed=False), "#e8d0a8", 1.2, ink=False)
    for x, y, a, r in ((30, 34, 20, 2.8), (35, 40, -25, 2.4), (31, 45, 40, 2.0)):
        ic.shape(poly(place([(-r, -r * 0.6), (r * 0.4, -r), (r, 0.2), (0, r), (-r * 0.9, r * 0.5)], a, (x, y))), soil(ic),
                 shadow=False, ink_w=2.2)
    glow(ic, 32, 49, 6, p["accent"], opacity=55, ry=2.4)
    ring(ic, 32, 27, 14, 3.4, ic.grad(p["hot"], (1, p["body"])), w=2.0, dash=[3, 2.4])
    for y in (10, 17):
        chevron(ic, (32, y + 3.5), 90, 4.2, p["hot"] if y == 17 else p["core"], 2.6)


ICONS = {"q": mab_q, "w": mab_w, "e": mab_e, "r": mab_r}
