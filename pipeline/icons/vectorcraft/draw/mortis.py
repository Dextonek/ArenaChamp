"""Mortis the Ossuary Lord (src/kits/bone.ts): old bone in ivory, the grave's teal light in it (art bible section 2, the
Bone row), the ember-red accent only in a socket's spark."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["mortis"] = row("#f4fffb", "#b8fff0", "#3fd8b8", "#ff5a3a", "#0a1412", bone="#ece4d0", bone_lo="#a89c80")
BONE = None


def bone_fill(ic):
    p = ic.p
    return ic.grad("#fffaf0", (0.45, p["bone"]), (1, p["bone_lo"]))


def bone_line(ic, a, b, w=3.0, knobs=True):
    """A bone between a and b: a shaft with a knuckle at each end."""
    p = ic.p
    ic.line(poly([a, b], closed=False), bone_fill(ic), w, ink_w=w + 2.8)
    if knobs:
        for q in (a, b):
            dot(ic, q[0], q[1], w * 0.62, p["bone"])


def skull(ic, c, s=1.0):
    """A skull, three-quarter calm: a high cranium, deep sockets that hold the grave light, a set jaw."""
    p = ic.p
    x, y = c
    head = curve([(x - 8.5 * s, y - 1), (x - 7.6 * s, y - 8 * s), (x, y - 11.5 * s), (x + 7.6 * s, y - 8 * s),
                  (x + 8.5 * s, y - 1), (x + 6.4 * s, y + 4.6 * s), (x + 4.2 * s, y + 9.6 * s), (x - 4.2 * s, y + 9.6 * s),
                  (x - 6.4 * s, y + 4.6 * s)], sharp=(5, 6, 7, 8), k=0.7)
    ic.shape(head, bone_fill(ic), ink_w=4.4)
    for dx in (-3.6, 3.6):
        e = ic.add("shape.ellipse", x=x + dx * s - 2.5 * s, y=y - 1.6 * s - 2.1 * s, width=5 * s, height=4.6 * s,
                   rotation=12 if dx < 0 else -12)
        ic.paint(ic.id(e), fill=ic.p["dark"], stroke="none")
        dot(ic, x + dx * s, y - 1.4 * s, 1.05 * s, p["hot"])
    ic.path(poly([(x, y + 1.6 * s), (x + 1.4 * s, y + 4.4 * s), (x - 1.4 * s, y + 4.4 * s)]), fill=p["dark"], stroke="none")
    for k in (-2.4, 0, 2.4):
        ic.line(poly([(x + k * s, y + 6.2 * s), (x + k * s, y + 9.2 * s)], closed=False), p["bone_lo"], 0.9, ink=False)


def mor_q(ic):
    """Bone Fan: three thin bone shards flicked out in a fan, the grave's light in their wake."""
    p = ic.p
    o = (13, 32)
    for ang in (-24, 0, 24):
        a = math.radians(ang)
        tail = (o[0] + 6 * math.cos(a), o[1] + 6 * math.sin(a))
        mid = (o[0] + 22 * math.cos(a), o[1] + 22 * math.sin(a))
        ic.line(poly([tail, mid], closed=False), ic.grad((0, p["body"], 0), (1, p["hot"])), 2.4, ink=False)
        shard(ic, (o[0] + 18 * math.cos(a), o[1] + 18 * math.sin(a)), ang, 29, 3.0, bone_fill(ic), back=0.18, ink_w=3)
    dot(ic, 13, 32, 3.2, p["hot"])
    glow(ic, 13, 32, 8, p["body"], opacity=80)


def mor_w(ic):
    """Raise Dead: a skeleton claws its way up out of the ground where he points."""
    p = ic.p
    glow(ic, 33, 47, 18, p["body"], opacity=85, ry=6)
    hole = ic.add("shape.ellipse", x=17, y=42.5, width=32, height=9)
    ic.solid(ic.id(hole), ic.grad("#05100c", (1, "#000000")), shadow=False, ink_w=2.4)
    e = ic.add("shape.ellipse", x=17, y=42.5, width=32, height=9)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(p["hot"], (1, p["body"])), weight=1.8)
    skull(ic, (33, 29), 1.25)
    for fx, base in ((-1, (22, 46)), (1, (44, 46))):
        bone_line(ic, base, (base[0] + fx * 3, base[1] - 9), 2.4)
        for k in (-1, 0, 1):
            tip = (base[0] + fx * 3 + k * 2.2, base[1] - 14 + abs(k))
            bone_line(ic, (base[0] + fx * 3, base[1] - 9), tip, 1.5, knobs=False)


def mor_e(ic):
    """Bone Armour: a cage of ribs closes round him; when it breaks, its shards fly."""
    p = ic.p
    glow(ic, 32, 31, 22, p["body"], opacity=60)
    hexa = ic.add("shape.polygon", cx=32, cy=31, radius=23, sides=6, rotation=0)
    ic.paint(ic.id(hexa), fill="none", stroke=p["body"], weight=1.6)
    ic.add("object.setProps", ids=[ic.id(hexa)], opacity=80)
    bone_line(ic, (32, 10), (32, 50), 3.4)
    for i, (y, wdt) in enumerate(((17, 13), (24.5, 16), (32, 16.5), (39.5, 14.5))):
        for fx in (-1, 1):
            pts = [(32 + fx * 1.5, y), (32 + fx * wdt * 0.7, y - 2.4), (32 + fx * wdt, y + 2.6),
                   (32 + fx * wdt * 0.8, y + 6.4)]
            ic.line(curve(pts, closed=False), bone_fill(ic), 2.6, ink_w=5.2)
    for x, y, a in ((53, 14, -40), (55.5, 24, -10)):
        shard(ic, (x - 4, y + 2), a, 7, 1.4, bone_fill(ic), back=0.3, shadow=False, ink_w=2.2)


def mor_r(ic):
    """Grave Grasp: a great hand of bone rises out of the ring and closes on whoever is still inside."""
    p = ic.p
    ring(ic, 33, 50, 21, 5.4, ic.grad(p["hot"], (1, p["body"])), w=2.6)
    glow(ic, 33, 49, 16, p["body"], opacity=80, ry=5)
    bone_line(ic, (29, 51), (30, 40), 3.6)
    bone_line(ic, (36, 51), (35, 40), 3.6)
    wrist = (32.5, 37)
    fingers = [((-9, -9), (-13, -17), (-9, -23)), ((-3.5, -12), (-5, -22), (0, -27)), ((2.5, -12), (5, -21), (10, -24)),
               ((8, -9), (14, -14), (16, -20))]
    for knuckle, mid, tip in fingers:
        k = (wrist[0] + knuckle[0], wrist[1] + knuckle[1])
        m = (wrist[0] + mid[0], wrist[1] + mid[1])
        t = (wrist[0] + tip[0], wrist[1] + tip[1])
        bone_line(ic, wrist, k, 2.6)
        bone_line(ic, k, m, 2.4)
        bone_line(ic, m, t, 2.0)
    bone_line(ic, wrist, (wrist[0] - 11, wrist[1] - 2), 2.6)
    bone_line(ic, (wrist[0] - 11, wrist[1] - 2), (wrist[0] - 14, wrist[1] - 9), 2.2)
    dot(ic, wrist[0], wrist[1], 3.6, p["bone"])
    spark(ic, 33, 13.5, 3.0, p["hot"])


ICONS = {"q": mor_q, "w": mor_w, "e": mor_e, "r": mor_r}
