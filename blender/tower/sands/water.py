"""The Water-Carrier (a walker of the Sands' floors, docs/tower/life/index.html): a Dune woman of the last caravan who
carries water from the cistern to the camp through the storm. Plainer than the named people: no light, no gold. Dark
bronze skin, long black hair. Layered linen in sand (no lighter than the darkened cream: nothing of
hers blooms in the Sands' light) under an ochre overskirt, a turquoise sash, a turquoise collar,
copper armlets on bare forearms, sandals. On her head, on a cloth ring, a clay water jar with a turquoise band: it is
bound to the head and rides it. The hands are free (walkers play the pack's walking clip with both arms). Signature
shape: the jar on the head."""
import math

from mathutils import Vector

from realkit import PI, Real
from real import parts_c as P


def build():
    R = Real("sands_water", sex="f", height=1.0, width=0.93, depth=0.94, skin="#8e5a3a")
    z = R.z
    R.mat("sand", "#b9a47a", rough=0.82, double=True)
    R.mat("ochre", "#a8702c", rough=0.72, double=True)
    R.mat("turq", "#2a8884", rough=0.55, double=True)
    R.mat("copper", "#b0683a", rough=0.35, metal=0.8, double=True)
    R.mat("clay", "#a65e3a", rough=0.85)
    R.mat("leather", "#4a3222", rough=0.6, double=True)
    R.hair("Hair_Long", "#140e0b", rough=0.5)

    # the linen dress, sleeves to the elbow, bare forearms with copper armlets; the collar
    el = R.bone("lowerarm_l").x
    R.fitted("Dress", lambda i: R.dom[i].startswith(("spine", "pelvis", "clavicle", "upperarm")) or (R.dom[i].startswith("lowerarm") and abs(R.world[i].x) < el + 0.03), "sand", offset=0.008)
    for n in "lr":
        P.sleeve(R, n, "sand", t0=-0.04, t1=0.1, r0=0.02, r1=0.0, bones=("lowerarm", "hand"), seg=14, n=2)
    R.cuffs("copper", at=(0.55, 0.85), offset=0.006, thick=0.006)
    P.collar(R, "turq", height=0.035, grow=1.0, flare=0.22)

    # the long sand skirt to the ankle, the ochre overskirt to the knee, the sash, sandals
    R.fitted("Under", ["thigh", "calf"], "sand", offset=0.004)
    R.boots("leather", top=z["ankle"] + 0.02)
    P.toes(R, "leather")
    hem = z["ankle"] + 0.05
    P.skirt(R, "sand", hem, flare=1.62, depth=1.15, folds=10, amp=0.026, seg=56)
    P.skirt(R, "ochre", z["knee"] - 0.06, flare=1.66, depth=1.15, folds=8, amp=0.024, grow=1.05, seg=48)
    how = R.hang_w(z["waist"], hem)
    R.band("turq", z["waist"] - 0.04, height=0.06, grow=1.16, how=how)
    cw, rxw, ryw = R.ring(z["waist"] - 0.04)
    sf = R.piece(how)
    kn = Vector((-rxw * 0.9, cw.y - ryw * 0.85, z["waist"] - 0.05))
    sf.ellipsoid("turq", kn, (0.024, 0.02, 0.022), seg=(10, 6))
    sf.tube("turq", [kn + Vector((0, -0.006, -0.01)), kn + Vector((-0.01, -0.012, -0.2))], [0.02, 0.014], seg=8, squash=((0, 1, 0), 0.3))

    # the cloth ring on her head and the water jar on it, bound to the head
    h = P.head(R)
    hp = R.piece("Head")
    c = Vector((0, h.c.y + 0.005, h.top - 0.012))
    hp.torus("ochre", c, 0.05, 0.016, seg=(20, 8))
    b = c + Vector((0, 0, 0.012))
    jar = [b + Vector((0, 0, 0.26 * t)) for t in (0.0, 0.13, 0.39, 0.65, 0.81, 0.94, 1.0)]
    rad = [0.026, 0.085, 0.106, 0.09, 0.043, 0.034, 0.045]
    P.hull(hp, "clay", jar, rad, rad, seg=22, side=Vector((1, 0, 0)))
    hp.torus("turq", b + Vector((0, 0, 0.145)), 0.099, 0.009, seg=(28, 5))
    hp.torus("clay", b + Vector((0, 0, 0.26)), 0.043, 0.007, seg=(20, 5))
    return R
