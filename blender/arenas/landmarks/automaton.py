"""
The Ember Caldera's landmark (2026-11-19; the user: "lets make more models for the arenas too and make them special"): a great forge
automaton of the Underforge, an ancient bronze smith that stands at an anvil on a basalt shelf in the lava lake and raises its hammer
slowly, then brings it down on a glowing ingot every few seconds (posed in code, src/arenas/landmarks/automaton.ts). It is the
Underforge's oldest worker, a tall figure in bronze plate and dark iron with a calm mask under a high crest, a smith's apron of iron
plates, a beard of bronze scales and a gold sun on its chest.

Built as the arenas' props are (blender/arenas/real/STYLE.md): clean forms, smooth shading, the heroes' palette plus the caldera's own
bronze, a thin gold line on the edges, one small light (the ingot). With the bosses' toolkit for its parts:
automaton > base, legs, ingot, torso > head, armL > foreL, armR > foreR > hammer. Rest pose: the hammer lying on the ingot (the blow).
Faces -Y, z up, metres; z = 0 is the lava's surface, the basalt shelf stands 0.6 above it.

    blender --background --factory-startup --python blender/arenas/landmarks/run.py -- automaton
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, _limb_xf
from boss_wyrm import S, seg

HEIGHT = 9.0
HERO_X = -5.5
VIEW = 0.75


def build_automaton():
    B = Boss("automaton", 9.0)
    B.smooth = True
    bronze = B.m("bronze", "#9a6a34", 0.8, 0.38)
    iron = B.m("iron", "#3c3f47", 0.75, 0.42)
    lacq = B.m("lacquer", "#1d1b21", 0.0, 0.45)
    stone = B.m("basalt", "#26242b", 0.0, 0.85)
    gold = B.m("gold", "#c9a24a", 0.85, 0.32)
    wood = B.m("wood", "#4a3220", 0.0, 0.7)
    ingotm = B.m("ingot", "#5a1c08", 0.0, 0.5, emit="#ff7a22", strength=0.9)

    def loop(part, p0, p1, t, r, m, w=0.06, out=0.06, sides=12):
        """A thin band round the limb p0-p1 at its fraction t."""
        L = (Vector(p1) - Vector(p0)).length
        part.lathe([(-w, r), (-w, r + out), (w, r + out), (w, r)], m, sides=sides, xf=_limb_xf(p0, p1) @ T(0, 0, L * t), loop=True)

    # --- the shelf: a round basalt slab in the lava with a gold line on its rim; the anvil on a stump --------------------------------------
    AX, AY = -0.9, -3.0          # the anvil's middle
    base = B.part("base", (0, 0, 0))
    base.lathe([(0.0, 0.02), (0.0, 6.4), (0.35, 6.4), (0.55, 5.9), (0.6, 5.8), (0.6, 0.02)], stone, sides=22)
    base.lathe([(0.3, 6.33), (0.3, 6.42), (0.4, 6.42), (0.4, 6.33)], gold, sides=22, loop=True)
    base.lathe([(0.6, 0.02), (0.6, 1.3), (2.0, 1.1), (2.0, 0.02)], stone, sides=12, xf=T(AX, AY, 0))          # the stump
    base.lathe([(0.62, 1.22), (0.62, 1.34), (0.72, 1.34), (0.72, 1.22)], gold, sides=12, xf=T(AX, AY, 0), loop=True)
    # the anvil: foot, waist, a long face, a horn to the figure's left
    base.chunk((2.3, 1.5, 0.3), iron, at=(AX, AY, 2.15), bevel=0.06)
    base.chunk((1.2, 0.9, 0.8), iron, at=(AX, AY, 2.7), bevel=0.06)
    base.chunk((3.1, 1.3, 0.34), iron, at=(AX, AY, 3.13), bevel=0.05)
    base.hull([(AX + 1.55, AY + 0.55, 2.96), (AX + 1.55, AY - 0.55, 2.96), (AX + 1.55, AY + 0.55, 3.3), (AX + 1.55, AY - 0.55, 3.3),
               (AX + 2.9, AY, 3.1), (AX + 2.9, AY, 3.16)], iron)
    base.chunk((3.0, 0.06, 0.05), gold, at=(AX, AY - 0.66, 3.2), bevel=0.012)
    base.finish()

    # --- the ingot: a short bar of glowing iron on the anvil's face ---------------------------------------------------------------------
    IX = -1.5
    ing = B.part("ingot", (IX, AY, 3.3))
    ing.chunk((1.3, 0.55, 0.22), ingotm, at=(IX, AY, 3.41), bevel=0.04)
    ing.finish()

    # --- the legs and the kilt: bronze greaves on iron boots, a kilt of three flared bands -------------------------------------------------
    lg = B.part("legs", (0, 0, 0))
    for sx in (-1, 1):
        x = sx * 0.85
        lg.chunk((0.95, 1.7, 0.5), iron, at=(x, -0.2, 0.85), bevel=0.07, taper=(0.8, 0.85))
        seg(lg, (x, 0.0, 1.0), (x, -0.05, 2.55), 0.46, 0.4, bronze, sides=12)
        seg(lg, (x, -0.05, 2.5), (x, 0.0, 3.95), 0.42, 0.52, bronze, sides=12)
        lg.lathe([(0.0, 0.02), (0.0, 0.46), (0.55, 0.0)], bronze, sides=12, xf=T(x, -0.05, 2.5) @ R(0, 0, 0))
        lg.chunk((0.5, 0.06, 0.7), gold, at=(x, -0.43, 1.75), bevel=0.012)
        loop(lg, (x, 0.0, 1.0), (x, -0.05, 2.55), 0.1, 0.46, gold)
    for zt, rt, zb, rb in ((3.95, 1.05, 3.45, 1.22), (3.6, 1.2, 3.0, 1.4), (3.15, 1.35, 2.45, 1.56)):
        lg.lathe([(zb, rb), (zt, rt)], bronze, sides=14, rot0=0.2 + zb)
        lg.lathe([(zb, rb - 0.05), (zb, rb + 0.04), (zb + 0.07, rb + 0.04), (zb + 0.07, rb - 0.05)], gold, sides=14, rot0=0.2 + zb, loop=True)
    lg.finish()

    # --- the torso: a bronze cuirass over a dark core, a belt, an apron of three iron plates, pauldrons, two chimneys behind --------------
    tor = B.part("torso", (0, 0, 3.9))
    prof = [(3.9, 1.0, 0.64), (4.6, 1.16, 0.72), (5.5, 1.5, 0.9), (6.1, 1.58, 0.86), (6.4, 0.8, 0.5)]
    pts = []
    for z, hx, hy in prof:
        for k in range(14):
            a = k * math.tau / 14
            pts.append((hx * math.cos(a), hy * math.sin(a), z))
    tor.hull(pts, bronze)
    tor.lathe([(-0.12, 1.0), (-0.12, 1.1), (0.12, 1.1), (0.12, 1.0)], iron, sides=14, xf=T(0, 0, 4.05) @ S(1.0, 0.72, 1.0), loop=True)
    tor.lathe([(-0.12, 1.1), (-0.12, 1.13), (-0.08, 1.13), (-0.08, 1.1)], gold, sides=14, xf=T(0, 0, 4.05) @ S(1.0, 0.72, 1.0), loop=True)
    tor.chunk((0.5, 0.12, 0.34), gold, at=(0, -0.8, 4.05), bevel=0.03)
    # the gold sun on the chest and a collar band
    tor.lathe([(0.0, 0.42), (0.06, 0.42), (0.11, 0.28), (0.14, 0.02)], gold, sides=16, xf=T(0, -0.9, 5.35) @ R(math.pi / 2, 0, 0))
    tor.lathe([(-0.02, 0.5), (-0.02, 0.58), (0.03, 0.58), (0.03, 0.5)], gold, sides=16, xf=T(0, -0.9, 5.35) @ R(math.pi / 2, 0, 0), loop=True)
    for k in range(8):
        a = k * math.tau / 8
        tor.hull([(0.58 * math.cos(a) - 0.05, -0.92, 5.35 + 0.58 * math.sin(a)), (0.58 * math.cos(a) + 0.05, -0.92, 5.35 + 0.58 * math.sin(a)),
                  (0.82 * math.cos(a), -0.94, 5.35 + 0.82 * math.sin(a))], gold)
    # the apron: three iron plates hanging from the belt, with gold hems
    for x, w, h, z in ((0, 0.95, 1.35, 3.25), (-0.82, 0.6, 1.1, 3.38), (0.82, 0.6, 1.1, 3.38)):
        tor.chunk((w, 0.12, h), iron, at=(x, -1.28 if x == 0 else -1.12, z), bevel=0.04, taper=(0.9, 1.0))
        tor.chunk((w * 0.9, 0.05, 0.06), gold, at=(x, -1.35 if x == 0 else -1.19, z - h / 2 + 0.03), bevel=0.012)
    # the gorget and the neck
    seg(tor, (0, 0, 6.3), (0, 0, 6.65), 0.5, 0.4, iron, sides=12)
    tor.lathe([(6.15, 1.0), (6.5, 0.62)], bronze, sides=14)
    tor.lathe([(6.13, 0.98), (6.13, 1.04), (6.2, 1.04), (6.2, 0.98)], gold, sides=14, loop=True)
    # the pauldrons: domed bronze plates with a gold rim, tilted out
    for sx in (-1, 1):
        px = sx * 1.9
        xf = T(px, 0, 5.95) @ R(0, sx * 0.35, 0)
        tor.lathe([(-0.2, 0.85), (0.05, 0.92), (0.4, 0.68), (0.62, 0.3), (0.7, 0.02)], bronze, sides=14, xf=xf)
        tor.lathe([(-0.24, 0.8), (-0.24, 0.9), (-0.16, 0.9), (-0.16, 0.8)], gold, sides=14, xf=xf, loop=True)
    # two iron chimneys on its back
    for sx in (-1, 1):
        seg(tor, (sx * 0.72, 0.65, 5.2), (sx * 0.78, 1.0, 7.3), 0.2, 0.17, iron, sides=10)
        tor.lathe([(0.0, 0.2), (0.0, 0.25), (0.1, 0.25), (0.1, 0.2)], gold, sides=10, xf=T(sx * 0.78, 1.0, 7.25), loop=True)
    tor.finish()

    # --- the head: a bronze helm under a tall iron crest, a calm mask with sunk eyes, a beard of scales ------------------------------------
    hp = Vector((0, 0, 6.55))
    hd = B.part("head", hp, "torso")
    hd.rock((0, 0.05, 7.15), (0.62, 0.7, 0.68), bronze, n=30, rough=0.0)
    # the mask: a long straight face plate, brow to chin, a nose ridge, two slits
    face = []
    for sx in (-1, 1):
        face += [(sx * 0.5, -0.5, 7.45), (sx * 0.56, -0.62, 7.1), (sx * 0.44, -0.72, 6.7), (sx * 0.3, -0.62, 6.35),
                 (sx * 0.5, -0.2, 7.45), (sx * 0.5, -0.1, 6.5), (sx * 0.32, -0.2, 6.3)]
    hd.hull(face, bronze)
    hd.hull([(0.0, -0.72, 7.15), (0.05, -0.74, 7.15), (-0.05, -0.74, 7.15), (0.0, -0.9, 6.75), (0.05, -0.76, 6.55), (-0.05, -0.76, 6.55), (0, -0.72, 6.5)], bronze)
    for sx in (-1, 1):
        hd.chunk((0.3, 0.08, 0.07), lacq, xf=T(sx * 0.26, -0.72, 7.05) @ R(0, -sx * 0.18, 0), bevel=0.015)
        hd.chunk((0.4, 0.06, 0.05), gold, xf=T(sx * 0.26, -0.7, 7.2) @ R(0, -sx * 0.1, 0), bevel=0.012)
        hd.hull([(sx * 0.6, -0.3, 6.5), (sx * 0.66, -0.2, 7.0), (sx * 0.55, 0.3, 6.6), (sx * 0.58, 0.2, 7.0), (sx * 0.5, -0.5, 6.45)], bronze)   # cheek guards
    hd.lathe([(-0.04, 0.62), (-0.04, 0.7), (0.04, 0.7), (0.04, 0.62)], gold, sides=18, xf=T(0, 0.04, 7.45), loop=True)
    # the crest: a swept iron fin from brow to nape, gold on its edge
    hd.hull([(0.06, -0.45, 7.7), (-0.06, -0.45, 7.7), (0.06, 0.7, 7.85), (-0.06, 0.7, 7.85), (0.05, 1.05, 8.75), (-0.05, 1.05, 8.75),
             (0.05, 0.15, 8.35), (-0.05, 0.15, 8.35)], iron)
    seg(hd, (0, -0.4, 7.75), (0, 0.15, 8.38), 0.045, 0.045, gold, sides=6)
    seg(hd, (0, 0.15, 8.38), (0, 1.05, 8.77), 0.045, 0.045, gold, sides=6)
    # the beard: four scaled wedges stepping down from the chin
    for i, (z0, w, d) in enumerate(((6.4, 0.34, 0.78), (6.1, 0.28, 0.9), (5.8, 0.21, 0.98), (5.52, 0.13, 0.99))):
        hd.hull([(-w, -0.55, z0), (w, -0.55, z0), (-w * 0.7, -d, z0 - 0.02), (w * 0.7, -d, z0 - 0.02), (-w * 0.8, -0.55, z0 - 0.32),
                 (w * 0.8, -0.55, z0 - 0.32), (-w * 0.35, -d + 0.1, z0 - 0.36), (w * 0.35, -d + 0.1, z0 - 0.36)], bronze if i % 2 == 0 else gold)
    hd.finish()

    # --- the arms. The figure's right (x < 0) swings the hammer; its left holds the tongs ------------------------------------------------------
    def arm(side, S0, E0, W0, ru, rf, hand):
        sn = "R" if side < 0 else "L"
        a = B.part("arm" + sn, S0, "torso")
        seg(a, S0, E0, ru, ru * 0.84, bronze, sides=12)
        loop(a, S0, E0, 0.55, ru * 0.9, gold)
        a.rock(tuple(S0), (ru * 1.12,) * 3, bronze, n=20, rough=0.0)
        a.finish()
        f = B.part("fore" + sn, E0, "arm" + sn)
        f.rock(tuple(E0), (ru * 0.98,) * 3, bronze, n=20, rough=0.0)
        seg(f, E0, W0, rf, rf * 0.8, iron, sides=12)
        loop(f, E0, W0, 0.3, rf * 0.95, gold)
        f.lathe([(0.0, rf * 0.9), (0.0, rf * 1.12), (0.45, rf * 0.9)], bronze, sides=12, xf=_limb_xf(E0, W0) @ T(0, 0, 0.2))
        f.rock(tuple(W0), (hand,) * 3, iron, n=18, rough=0.0)
        return f

    # right arm: the hammer on the ingot; the elbow out and behind, the forearm forward
    SR, ER, WR = Vector((-1.9, 0, 6.0)), Vector((-2.6, 0.1, 4.2)), Vector((-1.5, -1.7, 3.95))
    fr = arm(-1, SR, ER, WR, 0.52, 0.42, 0.42)
    fr.finish()
    hm = B.part("hammer", WR, "foreR")
    shaft0, shaft1 = Vector((IX, -0.75, WR.z)), Vector((IX, AY, WR.z))
    seg(hm, shaft0, shaft1, 0.1, 0.1, wood, sides=8)
    hm.lathe([(0, 0.14), (0, 0.17), (0.1, 0.17), (0.1, 0.14)], gold, sides=8, xf=_limb_xf(shaft0, shaft1) @ T(0, 0, 0.05), loop=True)
    hm.lathe([(-0.55, 0.38), (-0.48, 0.44), (0.48, 0.44), (0.55, 0.38)], iron, sides=12, xf=T(IX, AY, WR.z + 0.05))
    for dz in (-0.33, 0.33):
        hm.lathe([(dz - 0.04, 0.4), (dz - 0.04, 0.48), (dz + 0.04, 0.48), (dz + 0.04, 0.4)], gold, sides=12, xf=T(IX, AY, WR.z + 0.05), loop=True)
    hm.finish()
    # left arm: out to the side, the tongs held on the ingot's far end
    SL, EL, WL = Vector((1.9, 0, 6.0)), Vector((2.55, -1.0, 4.5)), Vector((1.0, -2.0, 3.9))
    fl = arm(1, SL, EL, WL, 0.5, 0.4, 0.4)
    tg0, tg1 = Vector((1.75, -1.7, 4.05)), Vector((IX + 0.62, AY, 3.55))
    seg(fl, tg0, tg1, 0.07, 0.05, iron, sides=8)
    seg(fl, tg0 + Vector((0, 0, 0.17)), tg1 + Vector((0, 0, 0.06)), 0.07, 0.05, iron, sides=8)
    fl.finish()
    return B


def register():
    bb.BUILD["automaton"] = build_automaton
