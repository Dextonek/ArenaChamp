"""
The Drowned Harbour's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): the Harbour
Serpent, an old sea serpent of the Drowned Coast that coils in the bay beyond the quay. Three arches of its body stand out of the sea
behind it, a fluke further back, and its neck rises out of the water to watch the duel, then sinks again (posed in code,
src/arenas/landmarks/serpent.ts).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned forms, smooth shading, the heroes' palette plus the
harbour's own wine, a thin gold line on the edges of its fins, one small light (its eyes). With the bosses' toolkit for its parts:
serpent > neck1 > neck2 > neck3 > head > jaw; arch1, arch2, arch3; fluke. Faces -Y (toward the quay), z up, metres; z = 0 is the sea's
surface: what is under it is under the water.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- serpent
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss
from boss_wyrm import cone, panel, seg

HEIGHT = 9.0
HERO_X = -6.0
VIEW = 1.6


def build_serpent():
    B = Boss("serpent", 12.0)
    B.smooth = True
    body = B.m("body", "#1f4650", 0.0, 0.55)
    dark = B.m("dark", "#14262c", 0.0, 0.6)
    belly = B.m("belly", "#cdbf9c", 0.0, 0.7)
    wine = B.m("wine", "#5e1a28", 0.0, 0.6)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    eye = B.m("eye", "#ffcf80", 0.0, 0.4, emit="#ffb03a", strength=1.4)

    def fin_row(part, pts, h, n_every=2):
        """Wine fins along a curve's top, each a thin sail with a gold rim."""
        for i in range(0, len(pts) - 1, n_every):
            a, b = Vector(pts[i]), Vector(pts[i + 1])
            up = Vector((0, 0, 1))
            tip = a.lerp(b, 0.7) + up * h + (b - a).normalized() * 0.4
            panel(part, [a + up * 0.2, b + up * 0.2, tip], wine, th=0.05)
            seg(part, a + up * 0.2, tip, 0.05, 0.02, gold, sides=5)

    def arch(name, y0, r, thick):
        """A coil of its body standing out of the sea: a half ring along the y axis, its ends under the water."""
        part = B.part(name, (0, y0, 0))
        n = 10
        pts = []
        for i in range(n + 1):
            a = math.pi * (-0.08 + 1.16 * i / n)
            pts.append((0, y0 - r * math.cos(a), r * math.sin(a) - 0.6))
        for i in range(n):
            t = i / n
            th = thick * (0.85 + 0.3 * math.sin(math.pi * t))
            seg(part, pts[i], Vector(pts[i + 1]) + (Vector(pts[i + 1]) - Vector(pts[i])) * 0.06, th, th, body, sides=14)
            # its belly, a cream band underneath
            mid = Vector(pts[i]).lerp(Vector(pts[i + 1]), 0.5)
            inward = (Vector((0, y0, -0.6)) - mid)
            inward.z = 0 if abs(inward.z) < 1e-6 else inward.z
            seg(part, Vector(pts[i]) + inward.normalized() * th * 0.55, Vector(pts[i + 1]) + inward.normalized() * th * 0.55, th * 0.55, th * 0.55, belly, sides=10)
        fin_row(part, pts[2:-2], thick * 1.4)
        part.finish()

    arch("arch1", 7.0, 3.2, 1.0)
    arch("arch2", 15.0, 2.8, 0.85)
    arch("arch3", 22.0, 2.3, 0.7)

    # the fluke: a forked tail standing out of the water at the far end
    fl = B.part("fluke", (0, 28.0, 0))
    seg(fl, (0, 27.5, -0.5), (0, 28.6, 2.6), 0.5, 0.3, body, sides=12)
    for s in (-1, 1):
        panel(fl, [(0, 28.4, 2.2), (s * 0.3, 29.4, 4.8), (s * 2.6, 30.4, 4.2)], wine, th=0.08)
        seg(fl, (s * 0.3, 29.4, 4.8), (s * 2.6, 30.4, 4.2), 0.07, 0.04, gold, sides=5)
    fl.finish()

    # the neck: three pieces rising out of the sea in a curve, up and toward the quay
    npts = [(0, 1.5, -1.0), (0, 0.6, 2.6), (0, -0.6, 5.6), (0, -2.0, 7.8)]
    nrad = [1.15, 1.0, 0.86, 0.74]
    parent = None
    for i in range(3):
        p0, p1 = Vector(npts[i]), Vector(npts[i + 1])
        nk = B.part(f"neck{i + 1}", p0, parent)
        seg(nk, p0, p1 + (p1 - p0) * 0.1, nrad[i], nrad[i + 1], body, sides=14, belly=1.03)
        d = (p1 - p0).normalized()
        front = Vector((0, -d.z, d.y))
        seg(nk, p0 + front * nrad[i] * 0.55, p1 + front * nrad[i + 1] * 0.55, nrad[i] * 0.55, nrad[i + 1] * 0.55, belly, sides=10)
        back = -front
        for k in range(2):
            c = p0.lerp(p1, 0.25 + 0.45 * k) + back * nrad[i] * 0.85
            tip = c + back * nrad[i] * 1.3 + d * 0.5
            panel(nk, [c - d * 0.5, c + d * 0.5, tip], wine, th=0.05)
            seg(nk, c + d * 0.5, tip, 0.05, 0.02, gold, sides=5)
        nk.finish()
        parent = f"neck{i + 1}"

    # the head: a long dragon-like skull leaning down toward the quay, a frill of fins, deep-set eyes
    hp = Vector(npts[-1])
    head = B.part("head", hp, "neck3")
    skull = []
    for sx in (-1, 1):
        skull += [(sx * 0.72, -1.8, 7.5), (sx * 0.7, -1.9, 8.55), (sx * 0.78, -2.9, 7.55), (sx * 0.66, -3.0, 8.6),
                  (sx * 0.5, -4.4, 7.35), (sx * 0.4, -4.4, 7.95), (sx * 0.3, -5.4, 7.2), (sx * 0.24, -5.4, 7.55)]
    head.hull(skull, body)
    # brow ridges over the eyes, and the eyes sunk under them
    for s in (-1, 1):
        head.hull([(s * 0.35, -2.8, 8.62), (s * 0.82, -2.75, 8.5), (s * 0.78, -3.35, 8.38), (s * 0.35, -3.4, 8.45),
                   (s * 0.5, -2.95, 8.78)], dark)
        head.hull([(s * 0.62, -3.05, 8.22), (s * 0.8, -3.0, 8.25), (s * 0.78, -3.2, 8.13), (s * 0.6, -3.25, 8.12), (s * 0.7, -3.12, 8.2)], eye)
        # the frill: three wine fins fanning back from behind the jaw, gold rims
        for k in range(3):
            base = Vector((s * 0.65, -1.9 + k * 0.15, 8.0 + k * 0.25))
            tip = base + Vector((s * (1.6 - 0.25 * k), 1.0 + 0.3 * k, 0.6 + 0.5 * k))
            panel(head, [base, base + Vector((0, 0.5, -0.5)), tip], wine, th=0.05)
            seg(head, base, tip, 0.05, 0.02, gold, sides=5)
        # two swept horns of dark bone
        cone(head, (s * 0.35, -2.2, 8.6), (s * 0.7, -0.8, 9.6), 0.16, dark, sides=8)
    # teeth along the upper jaw
    for i in range(6):
        y = -3.0 - i * 0.4
        for s in (-1, 1):
            cone(head, (s * (0.5 - i * 0.04), y, 7.38), (s * (0.48 - i * 0.04), y - 0.05, 7.1), 0.06, belly, sides=5)
    head.finish()

    jaw = B.part("jaw", Vector((0, -1.9, 7.4)), "head")
    jp = []
    for sx in (-1, 1):
        jp += [(sx * 0.66, -1.9, 7.4), (sx * 0.6, -2.0, 6.95), (sx * 0.34, -5.1, 7.15), (sx * 0.26, -5.1, 6.95)]
    jaw.hull(jp, body)
    seg(jaw, (0, -2.1, 7.0), (0, -5.0, 7.0), 0.22, 0.14, belly, sides=8)
    jaw.finish()
    return B


def register():
    bb.BUILD["serpent"] = build_serpent
