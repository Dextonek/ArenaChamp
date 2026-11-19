"""
The dust wraith as a model (2026-11-19; the user: "Yes, do them all"). Until now a cone, four tori and a ball in code (`wraith` in
src/tower/world/looksWild.ts). A spirit of the Sands' storm: no legs, a tall hooded shape that tapers into a whirl at the bottom, rigid
rings of pale bone and blades of dark sand that turn about its axis, a dark hollow hood with two pale slits for eyes, and two long arms
of sand that end in curved blades. Dark umber and rust, so it reads inside the storm's sand-coloured haze; the rings are the only pale.
Mythic, never cartoon (docs/ART_BIBLE.md section 1).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, helpers from boss_wyrm.py). Faces -Y, z up, metres, the whirl's tip
on z = 0; about 2.45 m tall (the unit draws it at its scale, 1.2).

Parts: wraith > body > (hood, armL > bladeL, armR > bladeR, ring1, ring2, ring3, ring4). The rings turn about the body's axis (y in the
game's terms, local z here is up).

    blender --background --factory-startup --python blender/tower/beasts/run.py -- wraith
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss, R, T, interp
from boss_wyrm import S, cone, panel, plate, seg

HEIGHT = 1.8  # run.py's cameras


def build_wraith():
    B = Boss("wraith", 1.0)
    umber = B.m("umber", "#3d2c22", 0.0, 0.95)
    umber_dk = B.m("umber_dark", "#241914", 0.0, 0.95)
    rust = B.m("rust", "#8a4a27", 0.0, 0.9)
    bone = B.m("bone", "#d2c4a0", 0.0, 0.7)
    void = B.m("void", "#0a0706", 0.0, 1.0)
    eye = B.m("eye", "#e8dcb4", 0.0, 0.4, emit="#cdbf98", strength=1.2)

    # --- the body: a robe tapering to a point at the ground, wide at the shoulders; one lathe about the vertical axis ----------
    prof = [(0.0, 0.01), (0.3, 0.1), (0.7, 0.2), (1.1, 0.28), (1.45, 0.34), (1.62, 0.28), (1.72, 0.14)]
    body = B.part("body", (0, 0, 0.02))
    body.lathe(prof, [umber_dk, umber, umber, rust, umber, umber_dk], sides=10, rot0=math.pi / 10)

    def r_at(z):
        return interp(prof, z)

    # shreds of rust cloth hanging on the front and back of the robe, like torn sashes
    for i, z in enumerate((1.4, 1.05, 0.7, 0.42)):
        for s in (-1, 1):
            r = r_at(z) * 0.95
            for yy in (-1, 1):
                a = Vector((s * 0.03, yy * r, z))
                panel(body, [a + Vector((-0.045, 0, 0)), a + Vector((0.045, 0, 0)), a + Vector((s * 0.08, yy * 0.12, -0.34))],
                      rust if (i + yy) % 2 else umber_dk, th=0.012)
    # the shoulders: two blocky pauldron plates of dark sand
    for s in (-1, 1):
        plate(body, (s * 0.3, 0.0, 1.62), (0, 1, 0), (s, 0, 1), (0.22, 0.3, 0.07), umber_dk, taper=(0.7, 0.8), bevel=0.02)
    body.finish()

    # --- the hood: tall, pointed, curled at the tip; the hollow inside dark, two pale slits for eyes --------------------------
    hood = B.part("hood", (0, 0, 1.7), "body")
    hp = [(1.62, 0.3), (1.78, 0.285), (1.98, 0.23), (2.18, 0.14), (2.36, 0.02)]
    hood.lathe(hp, [umber, umber_dk, rust, umber_dk], sides=10, xf=S(1.0, 1.18, 1.0), rot0=math.pi / 10)
    # the hollow: a dark wedge set into the front, the eyes sunk in it under a hard brow
    pts = []
    for z, w, y in ((1.74, 0.13, -0.3), (1.95, 0.16, -0.31), (2.15, 0.09, -0.24)):
        for sx in (-1, 1):
            pts += [(sx * w, y, z), (sx * w * 0.8, y + 0.08, z)]
    hood.hull(pts, void)
    for s in (-1, 1):
        hood.hull([(s * 0.04, -0.328, 1.96), (s * 0.125, -0.332, 1.99), (s * 0.12, -0.328, 1.94), (s * 0.05, -0.325, 1.93)], eye)
        # the brow ridge over each slit
        hood.hull([(s * 0.03, -0.31, 2.03), (s * 0.15, -0.31, 2.06), (s * 0.15, -0.35, 2.01), (s * 0.03, -0.35, 2.0)], umber_dk)
    # the hood's rim, rust, framing the hollow
    for s in (-1, 1):
        plate(hood, (s * 0.2, -0.28, 1.95), (0.12 * -s, 0, 1), (s, -1, 0.3), (0.05, 0.4, 0.04), rust, taper=(0.8, 0.8), bevel=0.01)
    # the curled tip, streaming back
    cone(hood, (0, 0.0, 2.3), (0, 0.32, 2.5), 0.05, umber_dk, sides=5)
    hood.finish()

    # --- arms: long arms of sand, an elbow, a ragged trail from it, a curved blade --------------------------------------------
    def arm(s, n):
        sh, el, hand = Vector((s * 0.34, 0, 1.55)), Vector((s * 0.5, 0.05, 1.2)), Vector((s * 0.5, -0.1, 0.85))
        a = B.part("arm" + n, sh, "body")
        seg(a, sh, el, 0.1, 0.075, umber, sides=6, belly=1.1)
        seg(a, el, hand, 0.075, 0.05, umber_dk, sides=6, belly=1.05)
        for k in range(4):  # ragged sand trailing from the forearm
            c = el.lerp(hand, 0.15 + 0.2 * k)
            panel(a, [c + Vector((0, 0, 0.02)), c + Vector((0, 0.05, -0.02)), c + Vector((s * 0.05, 0.12, -0.3 - 0.05 * (k % 2)))], rust if k % 2 else umber_dk, th=0.01)
        cone(a, el, el + Vector((s * 0.14, 0.12, 0.1)), 0.06, rust, sides=4)
        a.finish()
        bl = B.part("blade" + n, hand, "arm" + n)
        L = 0.62
        pts = []
        for sx in (-0.012, 0.012):
            pts += [(hand.x + sx, hand.y + 0.06, hand.z), (hand.x + sx, hand.y - 0.05, hand.z),
                    (hand.x + sx, hand.y + 0.07, hand.z - L * 0.5), (hand.x + sx, hand.y - 0.1, hand.z - L * 0.5),
                    (hand.x + sx + s * 0.03, hand.y + 0.22, hand.z - L)]
        bl.hull(pts, bone)
        # a dark spine along the blade's back
        bl.hull([(hand.x + dx, hand.y + yy, hand.z + dz) for dx in (-0.018, 0.018) for (yy, dz) in ((0.06, 0), (0.08, -L * 0.5), (0.05, -L * 0.8))], umber_dk)
        bl.chunk((0.1, 0.15, 0.05), rust, xf=T(hand.x, hand.y, hand.z + 0.02), bevel=0.012)
        bl.finish()

    arm(1, "L")
    arm(-1, "R")

    # --- rings: pale bone rings with blades of dark sand swept off them, round the lower whirl; they turn about the axis ---------
    def ring(n, zc, ri, ro, thick, blades, sweep, tilt):
        rp = B.part("ring" + n, (0, 0, zc), "body")
        segs = 12
        for k in range(segs):
            a0, a1 = k * math.tau / segs, (k + 1) * math.tau / segs
            pts = []
            for a, w in ((a0, 1), (a1, 1)):
                pts += [(ri * math.cos(a), ri * math.sin(a), zc - thick), (ri * math.cos(a), ri * math.sin(a), zc + thick),
                        (ro * math.cos(a), ro * math.sin(a), zc - thick * 0.6), (ro * math.cos(a), ro * math.sin(a), zc + thick * 0.6)]
            rp.hull(pts, bone)
        # long thin ribbons of sand: flat panels that start on the ring, wrap round the body in the way it turns and trail back and down,
        # a slight twist along them
        for k in range(blades):
            a0 = k * math.tau / blades + 0.4 * zc
            pts = []
            n = 6
            for i in range(n + 1):
                u = i / n
                a = a0 + sweep * u
                rad = ro + 0.03 + 0.05 * math.sin(u * math.pi) - 0.05 * u
                z = zc - tilt * u * u
                wdt = 0.06 * (1 - u) + 0.012
                tw = 0.5 * u  # the twist: the ribbon's width leans over
                dz, dr = wdt * math.cos(tw), wdt * math.sin(tw)
                for sgn in (-1, 1):
                    pts.append(Vector(((rad + sgn * dr) * math.cos(a), (rad + sgn * dr) * math.sin(a), z + sgn * dz)))
            for i in range(n):
                q = [pts[2 * i], pts[2 * i + 1], pts[2 * i + 3], pts[2 * i + 2]]
                rp.face(q, rust if k % 2 else umber_dk)
                rp.face(q[::-1], rust if k % 2 else umber_dk)
        rp.finish()

    ring("1", 0.28, 0.14, 0.22, 0.03, 3, 3.2, 0.22)
    ring("2", 0.62, 0.25, 0.34, 0.032, 3, 3.4, 0.3)
    ring("3", 0.96, 0.34, 0.44, 0.034, 4, 3.4, 0.34)
    ring("4", 1.3, 0.42, 0.53, 0.036, 4, 3.6, 0.38)
    return B


def register():
    bb.BUILD["wraith"] = build_wraith
