"""The White Sister (the War's quest giver out at the field hospital): she mends whoever is carried in, whatever the
colour of their banner. A calm woman in a white veil and a pale linen wimple, a long white habit to the floor with a gold
hem and a pale blue scapular bearing a gold star, a satchel of bandages on a strap across her. In the LEFT hand a tall
white staff flying a white pennant, the cloth of truce, a pale blue stone at its top her one light (hold: torch).
Signature shape: the white veil and the pennant."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_a as PA
from real import parts_c as P
import folk as K


def build():
    R = Real("war_sister", sex="f", height=0.99, width=0.94, depth=0.96, skin="#d4ae96")
    z = R.z
    R.mat("white", "#e6e2d8", rough=0.75, double=True)
    R.mat("linen", "#d8d2c2", rough=0.8, double=True)
    R.mat("blue", "#7a96b8", rough=0.65, double=True)
    R.mat("leather", "#5a3a22", rough=0.6, double=True)
    R.mat("dark", "#2a2630", rough=0.6, double=True)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85, double=True)
    R.mat("glow", "#e8f4ff", rough=0.25, emit="#9ccaff", strength=1.0)
    R.hair(None, "#4a3a30")

    R.fitted("Habit", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "white", offset=0.008)
    R.fitted("Under", ["thigh", "calf"], "white", offset=0.004)
    R.boots("dark", top=z["ankle"] + 0.05)
    P.toes(R, "dark")
    for n in "lr":
        P.sleeve(R, n, "white", t0=0.45, t1=0.98, r0=0.012, r1=0.065, rim="gold", rim_r=0.005, seg=16, n=3)
    hem = z["ankle"] + 0.012
    f, rings = P.skirt(R, "white", hem, flare=1.58, depth=1.12, folds=9, amp=0.024, trim="gold", trim_h=0.022, seg=52)
    up = R.piece(P.trunk_w(R, hem))
    P.wrap(R, up, "blue", z["waist"] - 0.02, z["neck"] - 0.03, -0.4, 0.4, off=0.016)
    P.wrap(R, up, "blue", z["waist"] - 0.02, z["neck"] - 0.03, PI - 0.4, PI + 0.4, off=0.016)
    sfn = PA.skirt_fn(R, hem, flare=1.58, depth=1.12)
    PA.panel(R, f, "blue", sfn, -0.3, 0.3, z["waist"] - 0.02, hem + 0.1, out=0.012, nu=4, nv=8)
    for s in (1, -1):
        f.tube("gold", [sfn(0.3 * s, z["waist"] - 0.02 - (z["waist"] - hem - 0.12) * k / 8, 0.016) for k in range(9)], 0.005, seg=5)
    p, out = P.on_trunk(R, z["chest"] - 0.04, 0.0, off=0.022)
    P.star(up, "gold", p, (0, 0, 1), out, 0.05, 0.02, thick=0.008, points=8)
    R.band("leather", z["waist"], height=0.03, grow=1.15)

    # the satchel of bandages, its strap across her
    sf, point = PA.strap(R, "leather", width=0.035, lift=0.2, grow=1.12, high_side=1, out=0.022)
    q = point(0.75, -0.16)
    sb = R.piece("pelvis")
    P.box(sb, "leather", q + Vector((-0.04, 0.0, -0.05)), (0.035, 0.09, 0.075))
    for k in range(3):
        sb.tube("linen", [q + Vector((-0.04, -0.06 + 0.06 * k, 0.03)), q + Vector((-0.04, -0.06 + 0.06 * k, 0.07))], 0.022, seg=10)

    # the wimple and the white veil
    PA.cowl(R, "linen", grow=1.02, low=0.08, high=0.0)
    PA.hood(R, "linen", grow=1.2, open=0.34, tilt=0.4, shape=(1.0, 1.04, 1.06), shift=(0, 0.015, -0.01), nu=26, nv=10)
    K.veil(R, "white", lining="linen", edge="gold", hem=z["waist"] - 0.05, width=0.3, spread=1.25, grow=1.34, open=0.44)

    # the staff with the white pennant
    h = K.hand(R)
    top = K.pole(h, "white", back=1.25, front=0.72, r=0.013, butt="gold", rings=(-0.7, 0.2))
    hf = h.f
    hf.ellipsoid("gold", top, P.rr(R, 0.022), seg=(10, 8))
    hf.ellipsoid("glow", top + h.d * 0.03 * h.s, P.rr(R, 0.024), seg=(10, 8))
    pts = []
    for k in range(9):
        t = k / 8
        pts.append((K.at(h, 0.64 - 0.0 * t, side=-0.02 - 0.42 * t, fwd=0.03 * math.sin(PI * t * 1.5)), K.at(h, 0.38 + 0.13 * t, side=-0.02 - 0.42 * t, fwd=0.03 * math.sin(PI * t * 1.5))))
    PA.grid(hf, "white", lambda u, v: pts[int(round(u * 8))][0].lerp(pts[int(round(u * 8))][1], v), 8, 3)
    hf.tube("gold", [p[0] for p in pts], 0.004, seg=5)
    return R
