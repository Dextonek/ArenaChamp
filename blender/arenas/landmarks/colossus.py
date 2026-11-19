"""
The Sandstone Canyon's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): the
Colossus of the Dune Throne, a seated king of the Sands carved out of the canyon's wall, a sun-disc behind his head, hands on his
knees, who looks out over the caravan stop. His head slowly turns as if following the fight and his eyes burn low and warm
(posed in code, src/arenas/landmarks/colossus.ts). The Sands call the sun their father and the kings sit in its sight.

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned and boxed forms, smooth shading, one flat colour a part,
the heroes' palette plus the canyon's own turquoise, a thin gold line on the edges, one small light (the eyes). With the bosses'
toolkit: colossus > cliff, throne, torso, disc, head > eyes. Faces -Y (toward the ring), z up, metres; z = 0 is the ledge he sits on
(the cliff goes on under it, into the rock).

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- colossus
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T
from boss_wyrm import S, seg

HEIGHT = 22.0
HERO_X = -8.0
VIEW = 0.6


def build_colossus():
    B = Boss("colossus", 22.0)
    B.smooth = True
    rock = B.m("rock", "#5a3f38", 0.0, 0.88)
    rock2 = B.m("rock2", "#46312f", 0.0, 0.9)
    stone = B.m("stone", "#94745c", 0.0, 0.8)
    dark = B.m("dark", "#241a1e", 0.0, 0.6)
    teal = B.m("teal", "#1d5a56", 0.0, 0.6)
    cream = B.m("cream", "#d8cfb4", 0.0, 0.8)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    eye = B.m("eye", "#ffcf80", 0.0, 0.4, emit="#ffb03a", strength=1.2)

    def blob(part, c, r, m, n=40, xf=None):
        part.rock(Vector(c), r, m, n=n, rough=0.0, xf=xf)

    # ---- the cliff: a deep niche cut in the wall, a ledge under it, a lintel over it ----------------------------------------
    cl = B.part("cliff", (0, 3.0, 8.0))

    def bastion(cx, cy, rx, ry, h, z0=-3.0, seed=0):
        """A rounded bastion of slickrock, as the canyon's walls are: a flared foot, a wind-cut waist, a full belly, a domed top,
        two darker bands of stone."""
        prof = [(0.0, 1.12), (0.1, 1.06), (0.28, 0.92), (0.4, 0.9), (0.56, 1.0), (0.66, 0.99), (0.82, 0.9), (0.93, 0.68), (0.985, 0.34), (1.0, 0.06)]
        rings = [(z0 + t * (h - z0), r) for t, r in prof]
        mats = [rock2 if i in (2, 3, 6) else rock for i in range(len(rings) - 1)]
        cl.lathe(rings, mats, sides=24, rot0=0.2 + seed, xf=T(cx, cy, 0) @ S(rx, ry, 1.0), jitter=0.0)

    bastion(0.0, 8.5, 12.0, 5.6, 24.0, seed=0.3)             # the wall behind the niche
    bastion(-9.5, 0.5, 4.2, 6.4, 24.0, seed=0.7)             # the cliff either side of it
    bastion(9.5, 0.5, 4.2, 6.4, 22.0, seed=1.1)
    bastion(-17.0, 2.0, 5.2, 7.5, 12.0, seed=1.6)
    bastion(17.0, 2.0, 5.2, 7.5, 10.0, seed=2.0)
    blob(cl, (0.0, 0.6, 22.2), (10.4, 6.4, 2.6), rock2)       # the brow of rock over the niche
    for sx in (-1, 1):
        cl.chunk((1.1, 0.5, 19.0), teal, at=(sx * 5.35, -5.0, 9.8), bevel=0.1)
        cl.chunk((0.14, 0.14, 17.5), gold, at=(sx * 4.9, -5.0, 9.4), bevel=0.03)
    cl.chunk((11.0, 0.5, 0.9), teal, at=(0, -5.4, 19.6), bevel=0.1)
    cl.chunk((11.2, 0.14, 0.14), gold, at=(0, -5.5, 18.9), bevel=0.03)
    cl.chunk((27.0, 22.0, 3.2), rock2, at=(0, -1.0, -1.6), bevel=0.6)
    cl.chunk((13.0, 3.4, 0.9), rock, at=(0, -10.5, 0.45), bevel=0.3, taper=(0.9, 0.9))
    cl.chunk((13.2, 0.14, 0.14), gold, at=(0, -12.3, 0.8), bevel=0.03)
    cl.finish()

    # ---- the throne and his legs ---------------------------------------------------------------------------------------------
    th = B.part("throne", (0, -3.0, 0.0), "colossus")
    th.chunk((8.2, 9.0, 3.4), stone, at=(0, 0.2, 1.7), bevel=0.35)
    th.chunk((8.6, 0.16, 0.16), gold, at=(0, -4.35, 3.35), bevel=0.04)
    # the high back, with a turquoise band along its top
    th.chunk((8.2, 2.2, 7.0), stone, at=(0, 3.4, 5.5), bevel=0.35, taper=(0.9, 0.9))
    th.chunk((8.4, 0.5, 0.9), teal, at=(0, 2.2, 8.4), bevel=0.1)
    for sx in (-1, 1):
        # legs: thigh, shin, and a broad foot on a step
        seg(th, (sx * 1.9, -0.6, 4.7), (sx * 1.9, -5.8, 4.9), 1.55, 1.25, stone, sides=22, belly=1.05)
        blob(th, (sx * 1.9, -5.9, 4.6), (1.3, 1.3, 1.3), stone)
        seg(th, (sx * 1.9, -5.9, 4.5), (sx * 1.9, -6.4, 1.0), 1.2, 1.0, stone, sides=22)
        th.chunk((1.9, 3.4, 1.0), stone, at=(sx * 1.9, -7.4, 0.5), bevel=0.25, taper=(0.9, 0.7))
        th.chunk((1.9, 0.14, 0.2), gold, at=(sx * 1.9, -9.0, 0.6), bevel=0.04)
    # the kilt over his lap: a stiff cloth block with turquoise and gold bands
    th.chunk((4.6, 5.4, 0.7), cream, at=(0, -3.2, 6.1), bevel=0.2, taper=(0.9, 0.9))
    th.chunk((4.7, 0.5, 0.75), teal, at=(0, -5.9, 6.0), bevel=0.1)
    th.chunk((4.8, 0.14, 0.78), gold, at=(0, -6.3, 5.95), bevel=0.03)
    th.finish()

    # ---- the torso: broad chest, shoulders, arms with the hands flat on his knees ----------------------------------------------
    to = B.part("torso", (0, -0.6, 6.5), "colossus")
    blob(to, (0, -0.7, 6.6), (2.7, 1.8, 2.2), stone)
    blob(to, (0, -0.8, 9.4), (3.3, 1.9, 2.6), stone)
    to.chunk((4.2, 0.2, 0.9), gold, at=(0, -2.5, 9.9), bevel=0.05)            # a broad collar of gold across the chest
    to.chunk((4.6, 0.15, 0.4), teal, at=(0, -2.62, 9.3), bevel=0.05)
    to.chunk((2.9, 0.14, 0.14), gold, at=(0, -2.5, 8.3), bevel=0.03)
    to.chunk((5.0, 0.3, 0.25), gold, at=(0, -2.6, 5.7), bevel=0.05)           # his belt
    for sx in (-1, 1):
        blob(to, (sx * 3.4, -0.7, 10.6), (1.4, 1.35, 1.35), stone)
        seg(to, (sx * 3.5, -0.8, 10.2), (sx * 3.7, -1.5, 7.0), 1.15, 1.0, stone, sides=20)
        blob(to, (sx * 3.7, -1.6, 6.9), (1.0, 1.0, 1.0), stone)
        seg(to, (sx * 3.7, -1.6, 6.9), (sx * 2.4, -4.8, 6.6), 0.95, 0.8, stone, sides=20)
        to.chunk((1.4, 1.9, 0.6), stone, at=(sx * 2.2, -5.2, 6.55), bevel=0.2, taper=(0.9, 0.8))
        to.chunk((1.5, 0.14, 0.14), gold, at=(sx * 3.2, -3.2, 6.9), bevel=0.03)        # armlet
    to.finish()

    # ---- the sun behind him: a broad disc of gold over the wall of the niche ---------------------------------------------------
    di = B.part("disc", (0, 2.4, 14.6), "colossus")
    ring = [(0.0, 2.6), (0.3, 3.0), (0.3, 3.9), (0.0, 4.2), (-0.3, 3.9), (-0.3, 3.0)]
    di.lathe(ring, gold, sides=40, xf=T(0, 2.4, 14.6) @ R(math.pi / 2, 0, 0), loop=True)
    di.lathe([(0.0, 2.55), (0.12, 2.5), (0.12, 0.0)], teal, sides=40, xf=T(0, 2.3, 14.6) @ R(math.pi / 2, 0, 0))
    for k in range(16):
        a = k * math.tau / 16
        di.chunk((0.5, 0.35, 0.7), dark, xf=T(0, 2.4, 14.6) @ R(0, a, 0) @ T(0, 0, 4.35), bevel=0.08, taper=(0.7, 0.7))
    di.finish()

    # ---- the head: nemes headdress, strong brow, a long nose, a closed mouth, a plaited beard; it turns on the neck -----------------
    hp = Vector((0, -0.7, 12.4))
    hd = B.part("head", hp, "colossus")
    seg(hd, (0, -0.7, 11.6), (0, -0.8, 12.9), 1.2, 1.1, stone, sides=18)
    blob(hd, (0, -0.8, 14.3), (1.5, 1.55, 1.8), stone, n=48)
    # the face: a brow, a nose, lips, a chin
    hd.chunk((2.5, 0.8, 0.45), stone, at=(0, -2.0, 15.0), bevel=0.12)
    hd.chunk((0.6, 0.9, 1.7), stone, at=(0, -2.3, 14.0), bevel=0.12, taper=(0.7, 0.7))
    hd.chunk((1.2, 0.5, 0.28), stone, at=(0, -2.1, 13.1), bevel=0.08)
    hd.chunk((1.3, 0.1, 0.1), dark, at=(0, -2.4, 12.95), bevel=0.02)
    blob(hd, (0, -1.7, 12.5), (0.85, 0.8, 0.7), stone, n=24)
    hd.chunk((0.45, 0.5, 1.5), gold, at=(0, -2.0, 11.5), bevel=0.08, taper=(0.8, 0.8))    # the ceremonial beard
    # the nemes: lappets falling to the shoulders each side, a striped crown, a gold brow band with a rearing sun
    for sx in (-1, 1):
        hd.chunk((0.8, 1.9, 3.3), teal, at=(sx * 1.85, -1.1, 12.6), bevel=0.15, taper=(0.9, 0.9))
        hd.chunk((0.14, 1.9, 0.14), gold, at=(sx * 2.0, -1.2, 11.1), bevel=0.03)
        hd.chunk((0.14, 1.9, 0.14), gold, at=(sx * 2.0, -1.2, 12.3), bevel=0.03)
    hd.chunk((3.2, 3.2, 0.55), teal, at=(0, -0.7, 16.0), bevel=0.2, taper=(0.9, 0.9))
    hd.chunk((3.4, 0.2, 0.3), gold, at=(0, -2.1, 15.6), bevel=0.05)
    hd.chunk((0.5, 0.35, 0.9), gold, at=(0, -2.25, 16.1), bevel=0.08, taper=(0.5, 0.7))
    hd.finish()

    # eyes: two small slits under the brow, the only light (a part of its own: the game turns its glow)
    ey = B.part("eyes", hp, "head")
    for sx in (-1, 1):
        ey.chunk((0.55, 0.1, 0.2), eye, xf=T(sx * 0.55, -2.17, 14.45) @ R(0, -sx * 0.18, 0), bevel=0.03)
    ey.finish()
    return B


def register():
    bb.BUILD["colossus"] = build_colossus
