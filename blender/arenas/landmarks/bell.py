"""
The Night Temple's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special", then "Yes, do the
rest"): the great bronze bell of Gloaming, hung in an open stone tower beyond the temple court. It swings slowly on its headstock; its
clapper strikes at the ends of each swing and a faint ring of light on the bell's lip answers each stroke, kept low (posed in code,
src/arenas/landmarks/bell.ts).

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean turned and boxed forms, smooth shading, the heroes' palette plus the
temple's own violet (the roof), a thin gold line on the edges, one small light (the ring). With the bosses' toolkit for its parts:
bell > tower, bellbody > (clapper, ring). Faces -Y (the open front toward the court), the bell swings along X, z up, metres.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- bell
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, T
from boss_wyrm import cone, seg

HEIGHT = 19.0
HERO_X = -7.0
VIEW = 0.7

AXLE = 12.5        # the bell's axle height (the pose in src/arenas/landmarks/bell.ts swings about it)
BELL_Z = 9.0       # the lip's height at rest
PIER = 2.75        # the belfry's piers stand this far from the middle


def build_bell():
    B = Boss("bell", 19.0)
    B.smooth = True
    stone = B.m("stone", "#2c3140", 0.0, 0.85)
    lacquer = B.m("lacquer", "#1d1b21", 0.0, 0.45)
    violet = B.m("violet", "#3a2a5c", 0.0, 0.6)
    wood = B.m("wood", "#4a3220", 0.0, 0.7)
    iron = B.m("iron", "#3c3f47", 0.75, 0.42)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    bronze = B.m("bronze", "#8a5a28", 0.8, 0.38)
    glow = B.m("glow", "#ffcf80", 0.0, 0.4, emit="#ffb03a", strength=1.0)

    # ---- the tower: a stepped plinth, a tapering shaft with slit windows, the belfry's piers and lintels, a violet roof -----------
    tw = B.part("tower", (0, 0, 0))
    tw.chunk((8.2, 8.2, 0.6), stone, at=(0, 0, 0.3), bevel=0.1)
    tw.chunk((7.2, 7.2, 0.4), stone, at=(0, 0, 0.8), bevel=0.08)
    tw.chunk((7.5, 7.5, 0.1), gold, at=(0, 0, 0.62), bevel=0.02)
    tw.lathe([(1.0, 4.53), (7.0, 3.96)], stone, sides=4, rot0=math.pi / 4)
    tw.chunk((6.0, 6.0, 0.2), gold, at=(0, 0, 7.0), bevel=0.04)
    tw.chunk((6.9, 6.9, 0.4), stone, at=(0, 0, 7.25), bevel=0.08)
    for (dx, dy) in ((0, -1), (0, 1), (1, 0), (-1, 0)):
        for z in (2.6, 5.2):
            w = 3.05 - (z - 1.0) * 0.045
            tw.chunk((0.5 if dx == 0 else 0.1, 0.1 if dx == 0 else 0.5, 1.5), lacquer, at=(dx * w, dy * w, z), bevel=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tw.chunk((0.95, 0.95, 6.2), stone, at=(sx * PIER, sy * PIER, 10.55), bevel=0.08)
            tw.chunk((1.05, 1.05, 0.14), gold, at=(sx * PIER, sy * PIER, 7.5), bevel=0.02)
    for s in (-1, 1):
        tw.chunk((6.6, 0.95, 0.5), stone, at=(0, s * PIER, 13.35), bevel=0.06)
        tw.chunk((0.95, 6.6, 0.5), stone, at=(s * PIER, 0, 13.35), bevel=0.06)
        tw.chunk((5.0, 0.06, 0.06), gold, at=(0, s * (PIER - 0.5), 13.06), bevel=0.01)
        tw.chunk((0.06, 5.0, 0.06), gold, at=(s * (PIER - 0.5), 0, 13.06), bevel=0.01)
        # the bearings the headstock turns in
        tw.chunk((0.7, 0.6, 0.5), iron, at=(0, s * PIER, 12.75), bevel=0.05)
    tw.lathe([(13.6, 4.8), (14.1, 4.4), (15.6, 2.2), (17.8, 0.0)], violet, sides=4, rot0=math.pi / 4)
    tw.chunk((6.8, 6.8, 0.12), gold, at=(0, 0, 13.68), bevel=0.02)
    tw.rock((0, 0, 17.85), (0.3, 0.3, 0.3), gold, n=14, rough=0.0)
    cone(tw, (0, 0, 18.0), (0, 0, 19.1), 0.12, gold, sides=8)
    tw.finish()

    # ---- the bell: turned in one piece (a hollow shell), gold bands, a crown with its yoke and the headstock it turns on -------------
    bl = B.part("bellbody", (0, 0, AXLE), "bell")
    prof_out = [(0.0, 1.45), (0.12, 1.32), (0.5, 1.14), (1.2, 0.96), (2.0, 0.76), (2.6, 0.56), (3.0, 0.4), (3.12, 0.3)]
    prof_in = [(2.95, 0.22), (2.6, 0.38), (2.0, 0.62), (1.2, 0.82), (0.5, 1.0), (0.12, 1.14), (0.0, 1.2)]
    bl.lathe(prof_out + prof_in, bronze, sides=28, xf=T(0, 0, BELL_Z), cap=False)
    for z0, z1, r0, r1 in ((0.0, 0.3, 1.45, 1.22), (1.15, 1.35, 0.97, 0.93), (2.55, 2.7, 0.57, 0.54)):
        bl.lathe([(z0, r0 - 0.02), (z0, r0 + 0.05), (z1, r1 + 0.05), (z1, r1 - 0.02)], gold, sides=28, xf=T(0, 0, BELL_Z), loop=True, cap=False)
    # the crown: a stout iron boss and two straps up to the headstock
    bl.chunk((0.8, 0.6, 0.5), iron, at=(0, 0, BELL_Z + 3.3), bevel=0.06)
    for s in (-1, 1):
        bl.chunk((0.14, 0.2, 0.9), iron, at=(0, s * 0.28, BELL_Z + 3.75), bevel=0.02)
    seg(bl, (0, -PIER - 0.15, AXLE), (0, PIER + 0.15, AXLE), 0.3, 0.3, wood, sides=14)
    for y in (-PIER + 0.45, PIER - 0.45):
        seg(bl, (0, y - 0.05, AXLE), (0, y + 0.05, AXLE), 0.38, 0.38, gold, sides=14)
    bl.finish()

    # the ring of light: a thin band on the lip, the only glow
    rg = B.part("ring", (0, 0, AXLE), "bellbody")
    rg.lathe([(0.0, 1.43), (0.0, 1.5), (0.1, 1.46), (0.1, 1.4)], glow, sides=28, xf=T(0, 0, BELL_Z + 0.02), loop=True, cap=False)
    rg.finish()

    # the clapper: an iron rod from the crown inside the bell, a ball at its end
    cpv = Vector((0, 0, BELL_Z + 2.7))
    cl = B.part("clapper", cpv, "bellbody")
    seg(cl, cpv, (0, 0, BELL_Z + 0.5), 0.07, 0.06, iron, sides=8)
    cl.rock((0, 0, BELL_Z + 0.4), (0.26, 0.26, 0.3), iron, n=16, rough=0.0)
    cl.rock(tuple(cpv), (0.13, 0.13, 0.13), gold, n=10, rough=0.0)
    cl.finish()
    return B


def register():
    bb.BUILD["bell"] = build_bell
