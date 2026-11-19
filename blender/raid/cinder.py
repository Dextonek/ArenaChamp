"""
The Raid's cinder rock as a model (2026-11-19; the user: "lets make more models for the raid too"). Until now Ash's thrown rocks and the
Twin Forge's falling rocks were one drum of grey stone (`stoneGeo` in src/raid/fx.ts). Now: a basalt boulder from the Cinder Pit,
faceted, split by a thin crack of lava that runs round it, two smaller cracks on its shoulder, a few chips of it lying at its foot. The
glow is low on purpose (under the game's bloom a bright one is a white blob).

Built with the Raid bosses' toolkit (blender/bosses/boss_bodies.py, boss_wyrm.py). Still: one part. About 1.4 m across, 1.3 m high, foot
at z = 0, faces -Y, z up, metres. `FallingStone` (src/raid/fx.ts) draws it at the stone's radius.

    blender --background --factory-startup --python blender/raid/run.py -- cinder
"""
import math

from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss

HEIGHT = 1.3


def _shell(rng, a, b, c, zc, n_lat=6, n_lon=9, rough=0.18):
    """Points of a rough ellipsoid, the part under z = 0 pressed flat onto the floor."""
    pts = []
    for i in range(n_lat + 1):
        th = i / n_lat * math.pi
        k = 1 if i in (0, n_lat) else n_lon
        for j in range(k):
            ph = (j + 0.5 * (i % 2)) / n_lon * math.tau + rng.uniform(-0.12, 0.12)
            q = 1 + rng.uniform(-rough, rough)
            pts.append(Vector((a * q * math.sin(th) * math.cos(ph), b * q * math.sin(th) * math.sin(ph), zc + c * q * math.cos(th))))
    return [Vector((p.x, p.y, max(0.0, p.z))) for p in pts]


def build_cinder():
    B = Boss("cinder", HEIGHT)
    bas = B.m("basalt", "#302a27", 0.05, 0.92)
    hi = B.m("basalt_hi", "#4a3f39", 0.05, 0.88)
    lava = B.m("lava", "#4a1608", 0.0, 0.6, "#ff6a20", 0.75)

    rock = B.part("cinder", (0, 0, 0))
    r = rock.rng
    pts = _shell(r, 0.72, 0.66, 0.68, 0.62)
    # the crack: a tilted plane through the boulder; a gap between the two halves, the lava in it set back from the surface
    g = 0.04

    def split(p):
        return 0.5 + 0.16 * p.x - 0.1 * p.y

    lower, upper = [], []
    for p in pts:
        s = split(p)
        lower.append(p if p.z <= s - g / 2 else Vector((p.x, p.y, s - g / 2)))
        upper.append(p if p.z >= s + g / 2 else Vector((p.x, p.y, s + g / 2)))
    rock.hull([(p.x, p.y, p.z) for p in lower], bas)
    # the upper half is split again by a steep crack, so the face is three blocks, not two loaves
    def side(p):
        return 0.92 * p.x + 0.4 * p.y - 0.06

    left = [p if side(p) <= -g / 2 else p - Vector((0.92, 0.4, 0)) * (side(p) + g / 2) / 1.0 for p in upper]
    right = [p if side(p) >= g / 2 else p - Vector((0.92, 0.4, 0)) * (side(p) - g / 2) / 1.0 for p in upper]
    rock.hull([(p.x, p.y, p.z) for p in left], hi)
    rock.hull([(p.x, p.y, p.z) for p in right], bas)
    ring = []
    for k in range(12):
        a = k * math.tau / 12
        x, y = 0.6 * math.cos(a), 0.55 * math.sin(a)
        for dz in (-g * 0.9, g * 0.9):
            ring.append((x, y, split(Vector((x, y, 0))) + dz))
    rock.hull(ring, lava)
    # the steep crack's lava: a thin sheet standing in it, from the girdle up, set back from the surface
    nrm, tan = Vector((0.92, 0.4, 0)), Vector((-0.4, 0.92, 0))
    c0 = nrm * 0.06
    pts2 = []
    for u, z1 in ((-0.42, 0.86), (0.42, 0.9)):
        base = c0 + tan * u
        for q in (-g * 0.4, g * 0.4):
            pts2 += [base + nrm * q + Vector((0, 0, split(base) + 0.02)), base + nrm * q + Vector((0, 0, z1))]
    rock.hull(pts2, lava)
    # a smaller boulder leaning on it, and chips round its foot
    small = _shell(r, 0.3, 0.26, 0.26, 0.2, 4, 7, 0.18)
    rock.hull([(p.x - 0.62, p.y - 0.28, p.z) for p in small], bas)
    for k in range(4):
        a = 1.0 + k * 1.55
        rr = 0.78 + 0.1 * (k % 2)
        c = _shell(r, 0.11, 0.1, 0.07, 0.04, 3, 5, 0.25)
        rock.hull([(p.x + rr * math.cos(a), p.y + rr * math.sin(a), p.z) for p in c], hi if k % 2 else bas)
    rock.finish()
    return B


def register():
    bb.BUILD["cinder"] = build_cinder
