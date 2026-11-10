"""Ada, the Artificer (ranged, builds turrets): a slim inventor. A copper long coat with brass edges, open over a dark
vest with steel buttons, its sleeves rolled to the elbow, bare forearms, loose copper-red hair, brass goggles pushed up
on the forehead, a tool belt, tall leather boots, a brass backpack of meshing brass, copper and steel gears with two
exhaust pipes, and a spring-loaded brass launcher on the RIGHT wrist with a glowing cyan lens."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as P
from real.parts_a import V


def build():
    R = Real("clockwork", sex="f", height=0.98, width=0.95, skin="#e6c4a2")
    z = R.z
    R.mat("coat", "#a85a2a", rough=0.65, double=True)
    R.mat("vest", "#2a1a10", rough=0.6)
    R.mat("leather", "#3f2817", rough=0.6)
    R.mat("brass", "#c9a24a", rough=0.3, metal=0.85)
    R.mat("copper", "#b8683a", rough=0.35, metal=0.8)
    R.mat("steel", "#d8dde2", rough=0.3, metal=0.8)
    R.mat("cyan", "#d4fff8", rough=0.2, emit="#6affea", strength=1.0)
    R.hair("Hair_Long", "#9a431c", rough=0.5)
    cc, rxc, ryc = R.ring(z["chest"])

    R.fitted("Vest", ["spine", "pelvis", "clavicle"], "vest")
    R.fitted("Coat", ["spine", "clavicle"], "coat", offset=0.012, keep_skin=True,
             where=lambda p: p.y > cc.y - 0.02 or abs(p.x) > 0.07 or p.z > z["neck"] - 0.03)
    R.fitted("Sleeves", ["upperarm"], "coat", offset=0.012)
    R.fitted("Trousers", ["thigh", "calf"], "vest", offset=0.004)
    R.boots("leather", top=z["knee"] - 0.03, cuff="brass", toe="brass")
    # the sleeves rolled to the elbow, a leather wrist wrap on the left
    P.arm_band(R, "coat", 0.9, offset=0.012, thick=0.017)
    P.arm_band(R, "brass", 0.8, offset=0.016, thick=0.005)
    R.fitted("Wrap", ["lowerarm_l"], "leather", offset=0.006, where=lambda p: p.x > R.bone("lowerarm_l").lerp(R.bone("hand_l"), 0.55).x)
    P.arm_band(R, "brass", 0.55, bones=("lowerarm", "hand"), offset=0.01, thick=0.006, sides="l")

    # lapels down the coat's open front, steel buttons on the vest, a popped collar
    f = R.piece("near")
    for s in (1, -1):
        pts = [P.surf(R, zz, a * s, out=0.013) for zz, a in ((z["neck"] - 0.05, 0.75), (z["chest"] + 0.08, 0.6), (z["chest"] - 0.02, 0.55), (z["chest"] - 0.12, 0.5), (z["waist"] + 0.03, 0.5))]
        f.tube("coat", pts, [0.02, 0.03, 0.026, 0.02, 0.012], seg=8, squash=((0, 1, 0), 0.22))
        f.tube("brass", [p + V(-0.02 * s, -0.004, 0) for p in pts], 0.004, seg=5)
    for k in range(4):
        f.ellipsoid("steel", P.surf(R, z["waist"] + 0.05 + 0.062 * k, 0, out=0.008), (0.011, 0.006, 0.011), seg=(8, 6))
    R.collar("coat", height=0.07, grow=1.22)

    # the coat's skirt, open in front; the tool belt
    hem = z["knee"] - 0.13
    R.skirt("coat", hem=hem, flare=1.52, depth=1.2, arc=(0.5, 2 * PI - 0.5), trim="brass", trim_h=0.018, grow=1.04, seg=40)
    hang = R.hang_w(z["waist"], hem)
    R.band("leather", z["waist"] - 0.01, height=0.06, grow=1.16, how=hang)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    f.ellipsoid("brass", V(0, cw.y - ryw * 1.3, z["waist"] - 0.01), (0.034, 0.013, 0.03), seg=(10, 8))
    f.ellipsoid("leather", V(rxw * 1.2, cw.y - 0.03, z["waist"] - 0.085), (0.04, 0.06, 0.06), seg=(10, 8))
    f.ellipsoid("brass", V(rxw * 1.2 + 0.036, cw.y - 0.03, z["waist"] - 0.06), (0.009, 0.013, 0.013), seg=(6, 4))
    w0 = V(-rxw * 1.22, cw.y - 0.04, z["waist"] - 0.04)  # a wrench in a belt loop
    f.tube("steel", [w0, w0 + V(-0.01, 0, -0.17)], 0.008, seg=6)
    f.torus("steel", w0 + V(-0.012, 0, -0.19), 0.022, 0.007, normal=(1, 0, 0), seg=(12, 6), arc=(0.6, 2 * PI - 0.6))

    # brass goggles pushed up on the forehead
    f, c, r = R.head_piece()
    zg = P.face_z(R, 0.8)
    f.tube("leather", P.outline(R, zg, -PI, PI, n=24, out=0.022), 0.008, seg=5, squash=((0, 0, 1), 1.6))
    fr = P.outline(R, zg, 0, 0, n=1, out=0.03)[0]
    for s in (1, -1):
        e = fr + V(0.038 * s, 0.008, 0.004)
        nrm = V(0.25 * s, -1, 0.45)
        f.torus("brass", e, 0.029, 0.009, normal=nrm, seg=(16, 6))
        f.ellipsoid("steel", e + V(0, 0.004, -0.002), (0.026, 0.01, 0.026), seg=(10, 6), rot=P.frame_rot((1, 0.25 * s, 0), nrm, (0, 0.45, 1)))
    f.tube("brass", [fr + V(-0.012, 0.004, 0.004), fr + V(0.012, 0.004, 0.004)], 0.006, seg=5)

    # the backpack: a brass tank, three meshing gears, two exhaust pipes, a winding key
    f = R.piece("spine_03")
    b = V(0, cc.y + ryc + 0.085, z["chest"] + 0.0)
    f.tube("brass", [b + V(0, 0, -0.17), b + V(0, 0, -0.15), b + V(0, 0, 0.15), b + V(0, 0, 0.17)], [0.1, 0.135, 0.135, 0.1], seg=10, squash=((0, 1, 0), 0.55))
    for dz in (-0.11, 0.11):
        f.tube("copper", [b + V(0, 0, dz - 0.012), b + V(0, 0, dz + 0.012)], 0.139, seg=10, squash=((0, 1, 0), 0.56), caps=False)
    gy = 0.085
    P.gear(f, "brass", b + V(0.035, gy, 0.045), 0.105, teeth=12, thick=0.022, hub="copper")
    P.gear(f, "copper", b + V(-0.105, gy - 0.004, -0.045), 0.07, teeth=9, thick=0.02, turn=0.2, hub="steel")
    P.gear(f, "steel", b + V(0.115, gy + 0.004, -0.09), 0.05, teeth=8, thick=0.018, turn=0.1, hub="brass")
    for s in (1, -1):
        f.tube("copper", [b + V(0.075 * s, -0.01, 0.15), b + V(0.085 * s, 0.0, 0.3), b + V(0.11 * s, 0.03, 0.37)], [0.028, 0.026, 0.03], seg=8)
        f.torus("steel", b + V(0.11 * s, 0.03, 0.37), 0.03, 0.006, normal=(0.3 * s, 0.4, 1), seg=(12, 5))
        f.tube("leather", [b + V(0.085 * s, -0.05, 0.1), V(0.085 * s, cc.y + 0.02, z["neck"] - 0.035), P.surf(R, z["chest"] + 0.1, 0.62 * s, out=0.022), P.surf(R, z["chest"] - 0.03, 0.75 * s, out=0.024)],
               0.013, seg=6, squash=((0, 1, 0), 0.5))
    f.tube("steel", [b + V(-0.135, 0.0, 0.06), b + V(-0.2, 0.0, 0.06)], 0.008, seg=6)
    f.torus("steel", b + V(-0.225, 0.0, 0.06), 0.028, 0.007, normal=(0, 1, 0), seg=(12, 6))

    # the wrist launcher on the right forearm: a brass barrel, a coiled spring, a cyan lens
    f = R.piece("lowerarm_r")
    c0, r0 = R.arm_r("r", 0.22)
    c1, r1 = R.arm_r("r", 0.92)
    a0, a1 = c0 + V(0, 0, r0 + 0.026), c1 + V(-0.05, 0, r1 + 0.03)
    f.tube("brass", [a0, a1], [0.03, 0.026], seg=10)
    for k in range(6):
        p = a0.lerp(a1, 0.12 + 0.11 * k)
        f.torus("copper", p, 0.034, 0.006, normal=(a1 - a0), seg=(14, 5))
    f.torus("steel", a1, 0.03, 0.008, normal=(a1 - a0), seg=(14, 6))
    f.ellipsoid("cyan", a1 + (a1 - a0).normalized() * 0.006, (0.012, 0.024, 0.024), seg=(10, 8))
    f.ellipsoid("steel", a0, (0.034, 0.034, 0.034), seg=(10, 8))
    for t in (0.25, 0.85):
        cb, rb = R.arm_r("r", t)
        f.torus("leather", cb, rb + 0.01, 0.009, normal=(1, 0, 0), seg=(16, 6))
    return R
