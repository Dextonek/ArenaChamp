"""Professor Puff, the Aeronaut (mage): small and round, an alchemist of the air. A long aubergine coat with a high collar,
two rows of brass buttons and a brass-bound hem over a round belly, dark leggings and brown shoes, wild silver hair at
the sides, brass goggles pushed up on his brow, a brass gas tank on his back with leather straps and a hose, four glass
gas spheres glowing rose in brass cradles on rods above his shoulders, and a brass nozzle in the right hand."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_b import arms, back_y, belly, disc, legs_under, neck_band, ellipse, flats, front_y, hair_key, on_front, path, round_r


def build():
    R = Real("balloon", sex="m", height=0.72, width=0.95, depth=1.2, head=1.25, skin="#eccdb8")
    arms(R, length=0.82)
    belly(R, amount=0.085, z=R.z["waist"] + 0.02, spread=0.19, back=0.3)
    z = R.z
    w, d, h, hd = R.build
    R.mat("coat", "#44204c", rough=0.6, double=True)
    R.mat("brass", "#c2923c", rough=0.34, metal=0.85)
    R.mat("gas", "#ffb0cc", rough=0.15, emit="#ff6fa6", strength=0.9)
    R.mat("dark", "#1e1420", rough=0.6, double=True)
    R.mat("brown", "#5a3a26", rough=0.7)
    R.mat("lens", "#274a5c", rough=0.1, metal=0.4)
    R.hair("Hair_Buzzed", "#d8d8de", rough=0.5)
    hk = hair_key(R)

    R.fitted("Coat", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "coat", offset=0.008)
    legs_under(R, "dark", name="Leggings")
    R.boots("brown", top=z["ankle"] + 0.08, toe="brass")
    R.cuffs("brass", at=(0.86, 0.95), offset=0.012, thick=0.009)
    hem = z["knee"] - 0.14
    R.skirt("coat", hem=hem, flare=1.5, depth=1.15, trim="brass", trim_h=0.035)
    R.band("brown", z["waist"] - 0.07, height=0.06, grow=1.08, how=R.hang_w(z["waist"] - 0.07, hem))
    cb, rxb, ryb = R.ring(z["waist"] - 0.07)
    f = R.piece("pelvis")
    f.ellipsoid("brass", Vector((0, cb.y - ryb * 1.16, z["waist"] - 0.07)), (0.045, 0.014, 0.04), seg=(12, 8))
    neck_band(R, "dark", z1=0.06)
    f, gem = R.collar("coat", height=0.1, grow=1.38)
    f.torus("brass", Vector((gem.x, gem.y + 0.01, z["neck"] - 0.02)), 0.012, 0.005, normal=(0, 1, 0), seg=(10, 5))

    # two rows of brass buttons down the chest and the belly, a brass placket line between them
    f = R.piece("near")
    for k in range(5):
        zz = z["chest"] + 0.1 - 0.085 * k
        for s in (1, -1):
            f.ellipsoid("brass", on_front(R, 0.065 * s, zz, off=0.013), (0.02, 0.01, 0.02 * w / h), seg=(10, 6))
    f.tube("brass", [on_front(R, 0, z["chest"] + 0.15 - 0.06 * k, off=0.012) for k in range(9)], 0.005, seg=5)

    # goggles pushed up on the brow, wild silver hair at the sides
    f, c, r = R.head_piece()
    gz = z["head"] + (z["top"] - z["head"]) * 0.76
    f.torus("brown", Vector((0, c.y + 0.012, gz)), r * 1.03, 0.012, normal=(0, 0.28, 1), seg=(28, 6))
    for s in (1, -1):
        g = Vector((0.04 * s, c.y - r * 1.02, gz + 0.022))
        nrm = Vector((0.25 * s, -1, 0.45)).normalized()
        f.torus("brass", g, 0.033, 0.01, normal=nrm, seg=(18, 6))
        disc(f, "lens", g - nrm * 0.004, nrm, 0.031, thick=0.012, seg=16)
        for dy, dz, rr in ((0.02, 0.0, 0.052), (0.065, -0.03, 0.048), (0.075, 0.035, 0.044), (0.11, 0.0, 0.04)):
            f.ellipsoid(hk, Vector((r * 0.98 * s, c.y + 0.02 + dy, c.z - 0.01 + dz)), (rr, rr * 1.1, rr), seg=(12, 8))
        for dy, dz, rr in ((0.04, 0.035, 0.036), (0.1, -0.02, 0.034), (0.05, -0.05, 0.034)):   # a few rounded tufts further out
            f.ellipsoid(hk, Vector((r * 1.3 * s, c.y + 0.02 + dy, c.z - 0.01 + dz)), (rr * 1.25, rr, rr), seg=(10, 6))
    f.tube("brass", [Vector((-0.012, c.y - r * 1.05, gz + 0.022)), Vector((0.012, c.y - r * 1.05, gz + 0.022))], 0.007, seg=6)

    # the gas tank on his back: a brass cylinder with two bands and a valve, leather straps over the shoulders, a hose
    by = back_y(R, 0, z["chest"]) + 0.105
    b = Vector((0, by, z["chest"] - 0.02))
    f = R.piece("spine_03")
    f.tube("brass", [b + Vector((0, 0, dz)) for dz in (-0.24, -0.21, -0.15, 0.13, 0.19, 0.22)], [0.03, 0.075, 0.1, 0.1, 0.075, 0.03], seg=16)
    for dz in (-0.11, 0.09):
        f.torus("brown", b + Vector((0, 0, dz)), 0.102, 0.011, seg=(22, 6))
    top = b + Vector((0, 0, 0.22))
    f.tube("brass", [top, top + Vector((0, 0, 0.05))], 0.022, seg=8)
    f.torus("brass", top + Vector((0, 0, 0.065)), 0.03, 0.007, normal=(0, 1, 0), seg=(14, 5))
    for s in (1, -1):
        sx = 0.1 * s
        tz = max(p.z for p, dom in zip(R.world, R.dom) if abs(p.x - sx) < 0.03 and dom.startswith(("spine", "clavicle")))
        strap = [Vector((sx, front_y(R, sx, z["chest"] - 0.1) - 0.012, z["chest"] - 0.1)), Vector((sx, front_y(R, sx, z["chest"] + 0.06) - 0.012, z["chest"] + 0.06)),
                 Vector((sx, front_y(R, sx, tz - 0.03) - 0.01, tz - 0.02)), Vector((sx, 0.03, tz + 0.016)), Vector((sx * 0.9, by - 0.07, z["chest"] + 0.1))]
        f.tube("brown", path(strap, 5), 0.024, seg=6, squash=((0, 1, 0.6), 0.3))
    hose = [b + Vector((-0.09, 0.0, -0.17)), b + Vector((-0.17, -0.06, -0.2)), Vector((-0.2, cb.y, z["waist"] - 0.02)), Vector((-0.14, cb.y - ryb * 1.05, z["waist"] - 0.05))]
    f.tube("dark", path(hose, 6), 0.016, seg=7)

    # four glass spheres glowing rose, each in a brass cradle on a rod from the tank
    rs = 0.105
    rx, ry, rz = round_r(R, rs)
    for sx, sz, sy in ((0.27, 2.2, 0.02), (-0.27, 2.2, 0.02), (0.56, 1.9, -0.01), (-0.56, 1.9, -0.01)):
        c = Vector((sx, by + sy, sz))
        f.ellipsoid("gas", c, (rx, ry, rz), seg=(20, 12))
        k = 0.42
        f.ellipsoid("brass", c, (rx * 1.04, ry * 1.04, rz * 1.04), seg=(20, 12), keep=lambda co, c=c: co.z < c.z - rz * k)
        q = math.sqrt(1 - k * k)
        f.tube("brass", ellipse(c, rx * q * 1.05, ry * q * 1.05, n=24, z=c.z - rz * k), 0.008, seg=5)
        f.ellipsoid("brass", c + Vector((0, 0, rz * 1.0)), (rx * 0.28, ry * 0.28, rz * 0.16), seg=(10, 6))
        s = 1 if sx > 0 else -1
        rod = [top + Vector((0.02 * s, 0, 0.0)), Vector((sx * 0.45, by + sy, (top.z + sz) / 2 - 0.02)), Vector((sx * 0.92, by + sy, sz - rz * 1.5)), c + Vector((0, 0, -rz * 1.02))]
        f.tube("brass", path(rod, 6), 0.008, seg=5)

    # the nozzle
    f, o, d, up = R.held("r")
    f.tube("dark", [o - d * 0.07, o + d * 0.07], 0.02, seg=8)
    f.tube("brass", [o + d * 0.06, o + d * 0.1, o + d * 0.3, o + d * 0.33, o + d * 0.4], [0.026, 0.024, 0.016, 0.02, 0.045], seg=10)
    f.torus("brass", o + d * 0.4, 0.045, 0.007, normal=d, seg=(16, 5))
    f.torus("brass", o + d * 0.08, 0.027, 0.007, normal=d, seg=(14, 5))
    f.tube("dark", path([o - d * 0.07, o - d * 0.13 - up * 0.02, o - d * 0.17 - up * 0.1, o - d * 0.15 - up * 0.2], 5), 0.014, seg=6)
    return flats(R)
