"""Sir Whiskers, an upright tawny cat fencer, very pleased with himself. A cat first: a big round head with dark stripes,
tall ears with pink insides and black tufts, a cream muzzle, a pink nose, long pale whiskers, half-closed gold-green
eyes. Dark gunmetal plate with gold edges, gold knee cops, a short wine-red cape, a thick striped tail curling up
behind him, and a long rapier in the right paw with a glowing amber gem in its guard."""
import math

from mathutils import Matrix, Vector

from realkit import PI, Real


def build():
    R = Real("cat", sex="m", height=0.8, width=0.82, depth=0.88)
    z = R.z
    R.mat("fur", "#c98a3c", rough=0.85)
    R.mat("stripe", "#5a3414", rough=0.85)
    R.mat("cream", "#f0e2c4", rough=0.8)
    R.mat("pink", "#e89aa0", rough=0.6)
    R.mat("plate", "#2c3038", rough=0.35, metal=0.8)
    R.mat("gold", "#d2ae55", rough=0.32, metal=0.85)
    R.mat("wine", "#6e1a2c", rough=0.7, double=True)
    R.mat("steel", "#d6dde4", rough=0.25, metal=0.9)
    R.mat("eye", "#b8c83c", rough=0.3, emit="#6a7a10", strength=0.4)
    R.mat("black", "#0c0a08", rough=0.5)
    R.mat("amber", "#ffb03a", rough=0.3, emit="#ff9a1c", strength=1.0)
    R.faceless()

    fingers = ("hand_", "index_", "middle_", "ring_", "pinky_", "thumb_")
    R.fitted("Fur", lambda i: R.dom[i].startswith(("neck_",) + fingers), "fur", offset=0.004)
    R.fitted("Hose", ["thigh", "pelvis"], "black", offset=0.004)
    R.fitted("Cuirass", ["spine", "clavicle"], "plate", offset=0.012)
    R.fitted("Arms", ["upperarm", "lowerarm"], "plate", offset=0.009)
    R.fitted("Tassets", ["pelvis", "thigh"], "plate", offset=0.011, above=z["hip"] - 0.14, keep_skin=True)
    R.boots("plate", top=z["knee"] + 0.03, toe="gold")
    R.cuffs("gold", at=(0.06, 0.94), offset=0.011)
    R.pauldrons("plate", size=(0.085, 0.075, 0.045))
    R.band("gold", z["waist"], height=0.04, grow=1.14)
    f, gem = R.collar("gold", height=0.05, grow=1.1)
    for n in "lr":
        k = R.bone(f"calf_{n}")
        R.piece(f"calf_{n}").ellipsoid("gold", k + Vector((0, -0.05, 0.0)), (0.045, 0.03, 0.05), seg=(12, 8))
    R.cape("wine", hem=z["hip"] - 0.08, width=0.27, trim="gold")

    # the head: round, striped, tall ears, a cream muzzle
    f, c, r = R.head_piece()
    c = c + Vector((0, 0.0, 0.02))
    hr = 0.155
    f.ellipsoid("fur", c, (hr, hr * 0.92, hr * 0.9), seg=(28, 18))
    f.ellipsoid("cream", c + Vector((0, -hr * 0.72, -hr * 0.3)), (hr * 0.5, hr * 0.36, hr * 0.34), seg=(18, 12))
    f.ellipsoid("pink", c + Vector((0, -hr * 1.05, -hr * 0.2)), (0.018, 0.012, 0.012), seg=(10, 6))
    f.tube("black", [c + Vector((0, -hr * 1.04, -hr * 0.27)), c + Vector((0, -hr * 1.0, -hr * 0.42))], 0.004, seg=5)
    for s in (1, -1):
        e = c + Vector((hr * 0.4 * s, -hr * 0.8, hr * 0.12))
        f.ellipsoid("eye", e, (0.034, 0.012, 0.016), seg=(12, 8), rot=Matrix.Rotation(0.18 * s, 4, "Y"))
        f.ellipsoid("black", e + Vector((0, -0.01, 0)), (0.007, 0.006, 0.015), seg=(8, 6))
        f.tube("fur", [e + Vector((-0.04 * s, -0.004, 0.022)), e + Vector((0.045 * s, -0.004, 0.02))], 0.011, seg=6)  # the lazy upper lid
        # the ear, its pink inside and its black tuft
        base = c + Vector((hr * 0.62 * s, 0.01, hr * 0.62))
        tip = base + Vector((0.05 * s, 0.0, 0.15))
        f.tube("fur", [base, base.lerp(tip, 0.6), tip], [0.06, 0.04, 0.004], seg=10, squash=((0, 1, 0), 0.45))
        f.tube("pink", [base + Vector((0, -0.016, 0.01)), base.lerp(tip, 0.75) + Vector((0, -0.014, 0))], [0.038, 0.006], seg=8, squash=((0, 1, 0), 0.3))
        f.tube("black", [tip, tip + Vector((0.012 * s, 0, 0.045))], [0.006, 0.001], seg=5)
        for k in (-1, 0, 1):
            w0 = c + Vector((hr * 0.3 * s, -hr * 0.98, -hr * 0.3 + 0.012 * k))
            f.tube("cream", [w0, w0 + Vector((0.17 * s, -0.02, 0.03 * k))], [0.003, 0.001], seg=4)
    for k, a in enumerate((-0.5, 0.0, 0.5)):
        f.torus("stripe", c + Vector((hr * 0.5 * math.sin(a), 0.01, 0)), hr * (0.93 - 0.06 * abs(k - 1)), 0.012, normal=(math.cos(a), 0, -math.sin(a)), seg=(20, 6), arc=(PI * 0.2, PI * 0.8))

    # the tail: thick, striped, curling up behind him
    f = R.piece("pelvis")
    hip = z["hip"]
    n = 16
    pts = [Vector((0.24 * (k / n) ** 1.6, 0.1 + 0.36 * math.sin(k / n * PI * 0.78), hip - 0.14 * math.sin(k / n * PI * 1.15) + 0.72 * (k / n) ** 2)) for k in range(n + 1)]
    f.tube("fur", pts, [0.04 + 0.008 * math.sin(k / n * PI) - 0.018 * (k / n) ** 4 for k in range(n + 1)], seg=12)
    for i in (3, 6, 9, 12, 14):
        f.torus("stripe", pts[i], 0.047, 0.011, normal=(pts[i + 1] - pts[i - 1]), seg=(16, 6))

    # the rapier
    f, o, d, up = R.held("r")
    f.tube("steel", [o + d * 0.05, o + d * 0.5, o + d * 0.95], [0.009, 0.006, 0.0015], seg=6)
    f.torus("gold", o + d * 0.06, 0.05, 0.007, normal=d, seg=(24, 6))
    f.ellipsoid("gold", o + d * 0.04, (0.045, 0.02, 0.045), seg=(14, 8))
    f.ellipsoid("amber", o + d * 0.085, (0.016, 0.016, 0.016), seg=(10, 8))
    f.tube("gold", [o - d * 0.1, o + d * 0.04], 0.012, seg=8)
    f.ellipsoid("gold", o - d * 0.11, (0.02, 0.02, 0.02), seg=(10, 8))
    return R
