"""The Bell-Warden (the Sea's keeper, who gives the main quest): she rings the harbour bell that calls the drowned ships
home. A tall older woman, silver hair in buns. A deep sea-navy gown to the floor falling in folds, a gold hem, a gold
seam down the front; a wide flared collar of sea-foam cream with a gold rim and a small gold bell at its foot; a wine
sash (the harbour's own colour) knotted at the hip; gold cuffs. In the LEFT hand a tall black lacquer staff whose head
bends forward into a gold crook, and from it hangs the harbour bell, its clapper a cold sea-glass light: her one glow
(hold: torch). Signature shape: the bell."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("sea_keeper", sex="f", height=1.03, width=0.95, depth=0.95, skin="#c49a80")
    z = R.z
    R.mat("navy", "#173a52", rough=0.62, double=True)
    R.mat("deep", "#0e2233", rough=0.75, double=True)
    R.mat("foam", "#e4e6dc", rough=0.7, double=True)
    R.mat("wine", "#6a1c2c", rough=0.6, double=True)
    R.mat("lacquer", "#1d1b21", rough=0.45)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#d8f6ff", rough=0.3, emit="#7fdcf5", strength=1.0)
    R.hair("Hair_Buns", "#c9ccd2", rough=0.7)

    # the gown: fitted to the wrists, then the long skirt in folds to the floor
    R.fitted("Gown", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "navy", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "deep", offset=0.004)
    R.boots("deep", top=z["ankle"] + 0.06)
    P.toes(R, "deep")
    R.cuffs("gold", at=(0.93,), offset=0.012, thick=0.008)
    for n in "lr":
        P.sleeve(R, n, "navy", t0=0.62, t1=0.97, r0=0.012, r1=0.06, rim="gold", rim_r=0.006, seg=16, n=3)
    hem = z["ankle"] + 0.015
    f, rings = P.skirt(R, "navy", hem, flare=1.75, depth=1.12, folds=9, amp=0.03, trim="gold", trim_h=0.03, seg=56)
    # a gold seam down the front of the skirt and up the bodice
    P.seam(f, "gold", rings, 0.0, r=0.009, off=0.012)
    up = R.piece(P.trunk_w(R, hem))
    P.band_on(R, up, "gold", [(z["waist"] - 0.01, 0.0), (z["chest"] - 0.04, 0.0), (z["neck"] - 0.07, 0.0)], 0.022, thick=0.008, off=0.014)

    # the wine sash, knotted at her right hip, two ends falling
    how = R.hang_w(z["waist"], hem)
    R.band("wine", z["waist"], height=0.07, grow=1.13, how=how)
    cw, rxw, ryw = R.ring(z["waist"])
    k = R.piece(how)
    a = -1.05
    kn = Vector((cw.x + rxw * 1.18 * math.sin(a), cw.y - ryw * 1.18 * math.cos(a), z["waist"] - 0.005))
    k.ellipsoid("wine", kn, (0.032, 0.03, 0.034), seg=(12, 8))
    k.torus("gold", kn, 0.03, 0.006, normal=(math.sin(a), -math.cos(a), 0), seg=(14, 5))
    for da, ln, w in ((-0.08, 0.36, 0.034), (0.1, 0.27, 0.03)):
        b = a + da
        out = Vector((math.sin(b), -math.cos(b), 0))
        p0 = kn + out * 0.01
        f2 = R.piece(how)
        f2.tube("wine", [p0, p0 + out * 0.03 + Vector((0, 0, -ln * 0.5)), p0 + out * 0.045 + Vector((0, 0, -ln))], [w, w * 0.95, w * 0.8], seg=8, squash=(tuple(out), 0.25))
        f2.tube("gold", [p0 + out * 0.045 + Vector((0, 0, -ln - 0.004)), p0 + out * 0.045 + Vector((0, 0, -ln + 0.012))], w * 0.85, seg=8, squash=(tuple(out), 0.3))

    # the standing collar of sea-foam, a gold rim, a small gold bell at its foot
    fc, foot, top = P.collar(R, "foam", height=0.08, grow=1.3, flare=0.3, arc=(0.32, 2 * PI - 0.32))
    fc.ellipsoid("gold", foot + Vector((0, -0.012, -0.012)), (0.016, 0.012, 0.016), seg=(10, 8))
    P.hull(fc, "gold", [foot + Vector((0, -0.014, -0.025)), foot + Vector((0, -0.016, -0.05)), foot + Vector((0, -0.018, -0.062))], [0.012, 0.019, 0.022], seg=12)
    # the bell staff in the left hand: black lacquer, gold rings, a forward crook, the bell hanging from it
    s = P.along(R)
    f, o, d, upv = R.held("l")
    back, front = 1.28 * s, 0.62 * s
    f.tube("lacquer", [o - d * back, o + d * front], 0.014, seg=10)
    f.ellipsoid("gold", o - d * (back + 0.01), P.rr(R, 0.02), seg=(10, 8))
    for t in (-0.9, -0.45, 0.2, 0.45):
        f.tube("gold", [o + d * (t - 0.02) * s, o + d * (t + 0.02) * s], 0.019, seg=10)
    fwd = R.bone("hand_l") - R.bone("middle_01_l")
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    base = o + d * front
    f.torus("gold", base, 0.024, 0.008, normal=d, seg=(14, 6))
    crook = []
    rad = 0.075
    for i in range(13):
        ang = 0.85 * PI * i / 12
        crook.append(base + fwd * rad * (1 - math.cos(ang)) + d * rad * math.sin(ang) * 1.25)
    f.tube("gold", crook, [0.014 - 0.005 * i / 12 for i in range(13)], seg=8)
    tip = crook[-1]
    f.ellipsoid("gold", tip, P.rr(R, 0.013), seg=(8, 6))
    # the bell: a gold bell mouth-down (down is -d when the staff stands), a glowing clapper
    b0 = tip - d * 0.012 * s
    prof = [(0.0, 0.012), (0.02, 0.03), (0.05, 0.038), (0.085, 0.046), (0.11, 0.062), (0.122, 0.07)]
    pts = [b0 - d * h * s for h, _ in prof]
    P.hull(f, "gold", pts, [r for _, r in prof], seg=18, side=fwd, caps=False)
    P.hull(f, "lacquer", [b0 - d * 0.02 * s, b0 - d * 0.118 * s], [0.026, 0.06], seg=18, side=fwd)
    f.torus("gold", b0 - d * 0.12 * s, 0.07, 0.006, normal=d, seg=(24, 6))
    f.tube("gold", [b0 - d * 0.03 * s, b0 - d * 0.11 * s], 0.004, seg=5)
    f.ellipsoid("glow", b0 - d * 0.125 * s, P.rr(R, 0.024), seg=(12, 8))
    return R
