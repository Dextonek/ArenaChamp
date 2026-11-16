"""Ada the Artificer (src/kits/clockwork.ts): brass and steel machines that hum with a cyan spark: a homing drone,
turrets, a grappling hook, a siege gun (the art bible's Clockwork row, steel as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["ada"] = row("#ffffff", "#ffd08a", "#d9773a", "#6affea", "#1a0f08", steel="#d8dde2", steel_lo="#6a7480",
                 brass="#d9a441", brass_lo="#7a5218")


def brass(ic):
    p = ic.p
    return ic.grad(GOLD[0], (0.45, p["brass"]), (1, p["brass_lo"]))


def steel(ic):
    p = ic.p
    return ic.grad("#ffffff", (0.45, p["steel"]), (1, p["steel_lo"]))


def gear(ic, c, r, teeth=10, fill=None):
    p = ic.p
    pts = []
    for k in range(teeth * 2):
        a = math.radians(k * 180 / teeth)
        rr = r if k % 2 == 0 else r * 0.8
        for da in (-0.12, 0.12):
            pts.append((c[0] + rr * math.cos(a + da * (1 if k % 2 == 0 else 0.6)),
                        c[1] + rr * math.sin(a + da * (1 if k % 2 == 0 else 0.6))))
    ic.shape(poly(pts), fill or brass(ic), shadow=False, ink_w=2.6)
    dot(ic, c[0], c[1], r * 0.3, p["dark"])


def eye(ic, c, r):
    p = ic.p
    glow(ic, c[0], c[1], r * 2.2, p["accent"], opacity=80)
    disc(ic, c[0], c[1], r, ic.grad("#ffffff", (0.4, p["accent"]), (1, "#1a8a80")), shadow=False, ink_w=2)


def ada_q(ic):
    """Homing Drone: a drone flies out and always finds you; it tags you for her turrets."""
    p = ic.p
    ring(ic, 48, 47, 9, 2.8, p["accent"], w=1.8)
    ic.line(curve([(22, 30), (32, 46), (44, 46)], closed=False), p["accent"], 1.6, ink=False, dash=[2.2, 2])
    chevron(ic, (45, 46), 0, 2.6, p["accent"], 1.8)
    c = (22, 24)
    for side in (-1, 1):
        ic.line(poly([(c[0] + side * 5, c[1] - 3), (c[0] + side * 13, c[1] - 7)], closed=False), steel(ic), 1.8, ink_w=3.6)
        rot_ = ic.add("shape.ellipse", x=c[0] + side * 13 - 6, y=c[1] - 8.6, width=12, height=3.2)
        ic.paint(ic.id(rot_), fill=ic.grad((0, "#ffffff", 0.7), (1, p["steel"], 0.4)), stroke=p["dark"], weight=1.0)
    disc(ic, c[0], c[1], 7.5, brass(ic), ink_w=3.6)
    eye(ic, (c[0] + 1.4, c[1] + 1.2), 2.8)


def turret(ic, foot, s=1.0):
    p = ic.p
    x, y = foot
    for dx in (-8, 0, 8):
        ic.line(poly([(x, y - 9 * s), (x + dx * s, y)], closed=False), steel(ic), 2.0 * s, ink_w=4.2 * s)
    gear(ic, (x, y - 11 * s), 7 * s, teeth=8)
    ic.shape(poly([(x - 1, y - 14.5 * s), (x + 16 * s, y - 18 * s), (x + 16.5 * s, y - 13 * s), (x + 1, y - 9.5 * s)]),
             steel(ic), shadow=False, ink_w=2.6)
    eye(ic, (x, y - 11 * s), 2.4 * s)


def ada_w(ic):
    """Deploy Turret: a turret at the spot; near her it fires faster and glows."""
    p = ic.p
    ring(ic, 30, 50, 17, 4.4, p["accent"], w=1.8)
    turret(ic, (28, 50), 1.5)
    for k in range(3):
        dot(ic, 53 + k * 2, 22 - k * 1.3, 1.4, p["hot"])
    star(ic, 54, 20, 5.6, 1.4, p["hot"], points=4, ink_w=0)


def ada_e(ic):
    """Grapple: a hook on a chain: on you it slows, on a wall or a turret she reels herself to it."""
    p = ic.p
    chain = [(10 + k * 4.2, 46 - k * 3.3) for k in range(7)]
    for x, y in chain:
        e = ic.add("shape.ellipse", x=x - 2.2, y=y - 1.4, width=4.4, height=2.8, rotation=-38)
        ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=2.8)
        e2 = ic.add("shape.ellipse", x=x - 2.2, y=y - 1.4, width=4.4, height=2.8, rotation=-38)
        ic.paint(ic.id(e2), fill="none", stroke=steel(ic), weight=1.2)
    c = (42, 21)
    ic.line(poly([(38.5, 24.5), (46, 15)], closed=False), steel(ic), 2.6, ink_w=5)
    for a in (-40, 60, 160):
        pts = arc_pts((46 + 0, 15), 6, a, a + 90, 6)
        ic.line(curve(pts, closed=False), steel(ic), 2.4, ink_w=4.8)
    disc(ic, 46, 15, 2.4, brass(ic), shadow=False, ink_w=2)
    streaks(ic, [(48, 30, 54, 26), (52, 36, 58, 32)], color=p["accent"], weight=1.6)


def ada_r(ic):
    """Siege Mode: she braces, rooted; her turrets fire twice as fast and she fires heavy rounds."""
    p = ic.p
    gear(ic, (22, 38), 12, teeth=12)
    gear(ic, (36, 46), 7, teeth=8, fill=steel(ic))
    barrel = poly([(20, 33), (48, 18), (51, 24), (24, 41)])
    ic.shape(barrel, steel(ic))
    for u in (0.3, 0.65):
        a = (20 + (48 - 20) * u, 33 + (18 - 33) * u)
        b = (24 + (51 - 24) * u, 41 + (24 - 41) * u)
        ic.line(poly([a, b], closed=False), brass(ic), 2.0, ink=True, ink_w=3.6)
    mouth = ic.add("shape.ellipse", x=47, y=17, width=5, height=8.6, rotation=-28)
    ic.solid(ic.id(mouth), ic.grad("#3a3a40", (1, "#000000")), shadow=False, ink_w=2.2)
    star(ic, 55, 17, 7.5, 2, ic.grad("#ffffff", (0.5, p["hot"]), (1, p["body"])), points=4, ink_w=2.4)
    eye(ic, (22, 38), 2.6)
    for x in (10, 30):
        ic.line(poly([(x, 52), (x + 4, 46)], closed=False), p["hot"], 1.4, ink=False)


ICONS = {"q": ada_q, "w": ada_w, "e": ada_e, "r": ada_r}
