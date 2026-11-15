"""Opaline, the Lightbreaker (mage), of the Gloaming folk (docs/lore/codex/heroes/opaline.md; revamped 2026-11-15 by
docs/lore/codex/revamp.md). Slim and calm. Where she went down the Prism Stair the Deep's light grew into her: clear
amethyst crystal out of her cheekbones, her collarbones, the tops of her shoulders and the backs of her hands, with a
faint light in it; her people's eyeshine (violet); skin pale with the Gloaming folk's cool cast; hair violet-black, cut
at the jaw. A gown of deep amethyst open over cream, an open neckline edged in gold, a cutter's leather apron at the
right hip with her glazier's tools, the dark sash with the four spectrum bands, a ring of floating prisms behind her head,
and the wand in the left hand whose crystal tip is the one bright light. Her sister Silvane keeps lavender and silver."""
import math

from mathutils import Vector

from realkit import PI, Real
from real.parts_a import panel, skirt_fn
from real.parts_b import ellipse, flats, legs_under, shard
from real.parts_d import V, crystals, on_skin


def build():
    R = Real("prism", sex="f", height=1.0, width=0.95, depth=0.95, skin="#e6dce2")
    z = R.z
    R.mat("robe", "#46205f", rough=0.62, double=True)
    R.mat("cream", "#ece2cc", rough=0.7, double=True)
    R.mat("dark", "#14102a", rough=0.6, double=True)
    R.mat("leather", "#5e3b28", rough=0.72, double=True)
    R.mat("glass", "#c4bcff", rough=0.12, metal=0.25, emit="#8f84ff", strength=0.4)
    R.mat("amethyst", "#9a5ad8", rough=0.1, metal=0.2, emit="#7a3ad8", strength=0.45)
    R.mat("core", "#ffffff", rough=0.2, emit="#e6e0ff", strength=1.0)
    R.mat("gold", "#d2ae55", rough=0.3, metal=0.85)
    R.mat("steel", "#c8ccd4", rough=0.3, metal=0.8)
    R.mat("red", "#ff5a6a", rough=0.45)
    R.mat("green", "#5aff9a", rough=0.45)
    R.mat("blue", "#5ab8ff", rough=0.45)
    # the hair she cut on the Stair: the pack's long hair, cut at the jaw, violet-black
    eye, half = R.eye_box()
    hair = R.hair("Hair_Long", "#1d1326", rough=0.38)
    R.trim_hair(hair, below=eye.z - 0.085)
    # her people's eyeshine
    R.eye_look(color="#d8c8ff", emit="#a070ff", strength=0.55)

    # the gown: a scooped neckline that shows the collarbones (the crystal grows there)
    neck, rise, wide = z["chest"] + 0.07, 0.11, 0.13

    def cut(x):
        return neck + rise * min(1.0, abs(x) / wide) ** 1.7

    def gown(p):
        return not (p.y < 0.03 and abs(p.x) < wide and p.z > cut(p.x))
    R.fitted("Dress", ["spine", "pelvis", "clavicle", "upperarm", "lowerarm"], "robe", where=gown)
    legs_under(R, "cream", offset=0.003)
    R.boots("cream", top=z["ankle"] + 0.1, toe="gold")
    R.cuffs("gold", at=(0.93,), offset=0.009, thick=0.008)
    # gold along the neckline's edge
    f = R.piece("near")
    line = []
    for k in range(25):
        x = -wide * 0.97 + 2 * wide * 0.97 * k / 24
        hit, nrm = R.surface(V(x, -0.5, cut(x) + 0.004), V(0, 1, 0))
        if hit is not None:
            line.append(hit + nrm * 0.008)
    f.tube("gold", line, 0.0065, seg=6)

    # the gown's skirt: cream beneath, the amethyst open over it at the front
    hem = z["ankle"] + 0.04
    R.skirt("cream", hem=hem, flare=1.7, depth=1.2)
    R.skirt("robe", hem=hem - 0.01, flare=1.8, depth=1.2, trim="gold", trim_h=0.025, arc=(0.42, 2 * PI - 0.42), grow=1.04)
    ch, rxh, ryh = R.ring(z["hip"] - 0.02)
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece(R.hang_w(z["waist"], hem))
    for s in (1, -1):  # gold down both edges of the opening
        a = 0.42 * s
        top = Vector((cw.x + rxw * 1.12 * math.sin(a), cw.y - ryw * 1.16 * math.cos(a), z["waist"]))
        mid = Vector((ch.x + rxh * 1.3 * math.sin(a), ch.y - ryh * 1.42 * math.cos(a), ch.z))
        low = Vector((ch.x + rxh * 1.8 * 1.04 * math.sin(a), ch.y - 0.01 - ryh * 1.8 * 1.2 * 1.04 * math.cos(a), hem))
        half_ = Vector((ch.x + rxh * 1.56 * math.sin(a), ch.y - 0.005 - ryh * 1.78 * math.cos(a), (hem + ch.z) / 2))
        f.tube("gold", [top, mid, half_, low], 0.008, seg=6)

    # the dark sash and its four spectrum bands
    R.band("dark", z["waist"], height=0.12, grow=1.1, how=R.hang_w(z["waist"], hem))
    f = R.piece(R.hang_w(z["waist"], hem))
    for k, key in enumerate(("red", "gold", "green", "blue")):
        zz = z["waist"] + 0.036 - 0.024 * k
        f.tube(key, ellipse(cw, rxw * 1.135, ryw * 1.17, PI, 3 * PI, n=40, z=zz), 0.0065, seg=5)
    # the sash's two ends down the left of the front
    for dx, ln in ((0.075, 0.42), (0.115, 0.32)):
        p = Vector((dx, cw.y - ryw * 1.25, z["waist"] - 0.03))
        q = Vector((dx + 0.03, ch.y - ryh * 1.75, z["waist"] - ln))
        f.tube("dark", [p, p.lerp(q, 0.5) + Vector((0, -0.02, 0)), q], [0.026, 0.03, 0.034], seg=8, squash=((0, 1, 0), 0.22))
        f.tube("gold", [q + Vector((-0.034, 0, 0)), q + Vector((0.034, 0, 0))], 0.007, seg=6)

    # the cutter's apron at the right hip: dark leather on the gown, a pocket, the tools standing in it
    sf = skirt_fn(R, hem - 0.01, flare=1.8, depth=1.2, grow=1.04)
    a0, a1, top, low = -1.45, -0.5, z["waist"] - 0.05, z["hip"] - 0.27
    panel(R, f, "leather", sf, a0, a1, top, low, out=0.012, nu=8, nv=6)
    f.tube("gold", [sf(a0 + (a1 - a0) * k / 12, low, 0.014) for k in range(13)], 0.004, seg=5)
    panel(R, f, "leather", sf, a0 + 0.18, a1 - 0.18, z["hip"] - 0.1, low + 0.05, out=0.022, nu=4, nv=3)
    for k, (t, ln, key) in enumerate(((0.32, 0.11, "steel"), (0.5, 0.14, "dark"), (0.66, 0.1, "gold"))):
        a = a0 + 0.18 + (a1 - a0 - 0.36) * t
        b = sf(a, z["hip"] - 0.12, 0.03)
        f.tube(key, [b, b + V(0, -0.004, ln)], 0.0065 if key != "dark" else 0.008, seg=6)
        if key == "steel":  # the cutting wheel
            f.torus("steel", b + V(0, -0.004, ln + 0.008), 0.009, 0.003, normal=(1, 0, 0), seg=(12, 4))

    # a short amethyst cape down the back, gold at its hem
    R.cape("robe", hem=z["hip"] - 0.08, width=0.3, trim="gold")

    # a fine gold chain at the throat with the crystal pendant on the open breast
    f = R.piece("spine_03")
    ring = []
    for k in range(21):
        a = -PI * 0.42 + PI * 0.84 * k / 20
        p, _ = on_skin(R, V(0.3 * math.sin(a), -0.3 * math.cos(a), z["neck"] - 0.035) + V(0, 0.04, 0), V(-math.sin(a), math.cos(a), 0), out=0.009)
        ring.append(p)
    f.tube("gold", ring, 0.0035, seg=5)
    hang, nrm = on_skin(R, V(0, -0.5, neck + 0.035), V(0, 1, 0), out=0.012)
    f.tube("gold", [ring[10], hang + V(0, 0, 0.03)], 0.0025, seg=4)
    shard(f, "glass", hang + V(0, 0, 0.03), hang + V(0, -0.004, -0.04), 0.017, n=6, mid=0.3, flat=((0, 1, 0), 0.5))

    # the crystal grown into her. The tops of the shoulders, more on the left (her wand side): big enough to break
    # her outline from the game's camera
    for s, n, big in ((1, "l", 1.0), (-1, "r", 0.72)):
        f = R.piece(f"clavicle_{n}")
        sh = R.bone(f"upperarm_{n}")
        p, nrm = on_skin(R, sh + V(-0.02 * s, 0.0, 0.4), V(0, 0, -1))
        crystals(f, "amethyst", p, nrm, 0.15 * big, count=6, lean=0.6, bias=(0.35 * s, 0.05, 0.2), seed=3 if s > 0 else 7, thick=0.2, spread=0.35)
        p, nrm = on_skin(R, sh + V(0.06 * s, 0.0, 0.4), V(0, 0, -1))
        crystals(f, "amethyst", p, nrm, 0.07 * big, count=3, lean=0.5, bias=(0.6 * s, 0, 0.1), seed=11 + s, thick=0.22)
        # along the collarbone, smaller toward the throat
        g = R.piece("spine_03")
        for k, (x, sz) in enumerate(((0.115, 0.07), (0.085, 0.05), (0.058, 0.032))):
            p, nrm = on_skin(R, V(x * s, -0.5, cut(x) + 0.02), V(0, 1, 0))
            crystals(g, "amethyst", p, nrm, sz * big ** 0.5, count=4, lean=0.6, bias=(0.9 * s, 0, 0.2), seed=20 + k + (5 if s > 0 else 0), thick=0.24, spread=0.5)
        # the back of the hand
        h = R.piece(f"hand_{n}")
        hb, mb = R.bone(f"hand_{n}"), R.bone(f"middle_01_{n}")
        for k, (t, sz) in enumerate(((0.25, 0.028), (0.6, 0.02))):
            p, nrm = on_skin(R, hb.lerp(mb, t) + V(0.0, 0.0, 0.3), V(0, 0, -1))
            crystals(h, "amethyst", p, nrm, sz, count=3, lean=0.5, bias=(-0.3 * s, 0, 0), seed=40 + k + (3 if s > 0 else 0), thick=0.25)

    # and along the cheekbones, from under the eye toward the temple: flat facets breaking out of the skin, lying along it
    f, c, r = R.head_piece()
    for s in (1, -1):
        for k, (dx, dz, sz) in enumerate(((0.95, -0.36, 0.026), (1.2, -0.12, 0.038), (1.34, 0.2, 0.03), (1.42, 0.5, 0.022))):
            p, nrm = on_skin(R, V(half * dx * s, -0.5, eye.z + half * dz), V(0, 1, 0))
            along = (V(0.55 * s, 0, 1)).normalized()
            d = (nrm * 0.45 + along).normalized()
            shard(f, "amethyst", p - d * sz * 0.35 - nrm * 0.002, p + d * sz * 0.65 + nrm * 0.004, sz * 0.32, n=5, mid=0.35, flat=(nrm, 0.45))

    # the ring of floating prisms behind her head
    back = c + Vector((0, r + 0.085, 0.03))
    for k in range(9):
        a = PI * (-0.18 + 1.36 * k / 8)
        d = Vector((math.cos(a), 0, math.sin(a)))
        big = k % 2 == 0
        shard(f, "glass", back + d * 0.2, back + d * (0.38 if big else 0.33), 0.042 if big else 0.03, n=4, mid=0.38, flat=((0, 1, 0), 0.6))
    shard(f, "core", back + Vector((0, 0, 0.215)), back + Vector((0, 0, 0.27)), 0.014, n=4, mid=0.5)
    # a thin gold circlet with a crystal at the brow
    f.torus("gold", c + Vector((0, 0.005, r * 0.55)), r * 0.98, 0.005, normal=(0, 0.25, 1), seg=(28, 5))
    brow = c + Vector((0, -r * 0.93, r * 0.6))
    shard(f, "glass", brow + Vector((0, -0.004, 0.022)), brow + Vector((0, -0.012, -0.022)), 0.011, n=4, mid=0.45)

    # the wand: gold, a crown of small crystals, and the bright tip
    f, o, d, up = R.held("l")
    side = d.cross(up)
    f.tube("gold", [o - d * 0.2, o + d * 0.4], [0.009, 0.013], seg=8)
    f.ellipsoid("gold", o - d * 0.21, (0.02, 0.02, 0.02), seg=(10, 8))
    f.torus("gold", o + d * 0.4, 0.03, 0.008, normal=d, seg=(16, 6))
    shard(f, "core", o + d * 0.38, o + d * 0.68, 0.05, n=6, mid=0.32)
    for k in range(4):
        a = PI / 4 + PI / 2 * k
        out = up * math.cos(a) + side * math.sin(a)
        shard(f, "glass", o + d * 0.37 + out * 0.03, o + d * 0.52 + out * 0.085, 0.022, n=4, mid=0.4)
    return flats(R)
