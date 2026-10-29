"""
Rigged hero figures for the hero kits (src/kits, src/heroes.ts): the Dao Archive figure kit (C:\\projectG\\xianxia\\blender:
figure_kit, kit, dao_blender, read-only) dressed per hero, plus each hero's signature props. Exports into this
repo's public/models/heroes/ (never into the game's models or manifest).

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\heroes")
    import hero_figures; importlib.reload(hero_figures)
    hero_figures.build("forge")              # into the collection "Fig forge" (stays for previews)
    hero_figures.export("forge")             # build + public/models/heroes/forge.glb, then clear
    hero_figures.preview("forge")            # build + docs/heroes/forge_*.png turnaround renders

Same rig and bone names as public/models/figures/hero.glb, so src/effects/weapons/hero.ts can pose them.
Blender coordinates: metres, z up, the figure faces -Y; +X is the figure's left.
"""
import importlib
import math
import os
import sys

XB = r"C:\projectG\xianxia\blender"
if XB not in sys.path:
    sys.path.insert(0, XB)

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import figure_kit  # noqa: E402
import kit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "models", "heroes")
PREVIEWS = os.path.join(ROOT, "docs", "heroes")

CHEST = lambda p: {"chest": 1.0}  # noqa: E731
HEAD = lambda p: {"head": 1.0}  # noqa: E731
ARM = {"R": lambda p: {"upper_arm.R": 1.0}, "L": lambda p: {"upper_arm.L": 1.0}}
FORE = {"R": lambda p: {"forearm.R": 1.0}, "L": lambda p: {"forearm.L": 1.0}}
SIDES = (("R", -1), ("L", 1))  # bone side, sign of x
PELVIS = lambda p: {"pelvis": 1.0}  # noqa: E731

# Each look: figure_kit options (see figure_looks.py in the Dao kit) + "props" (HeroFigure methods below).
LOOKS = {
    # Vesper, the Crimson Countess: a black left-lapped robe, a crimson-lined open over-robe, a tall vampire
    # collar, a silk cloud mantle, loose black hair, red eyes; a blood gem at the throat.
    "blood": dict(robe="#1a1214", inner="#5a0f18", trim=("#c9a24a", "#120a0c"), sash="#8c0f22", over="#3a0a12",
                  female=True, slim=True, zuoren=True, hair="loose", strands=True, hair_color="#0e0a0c",
                  headwear="silver-crown", skin="#e6d2c8", eye_glow="#ff2a3a", lips="#7a1a24", sleeve="pipa",
                  over_gap=0.4,
                  extras={"high_collar": dict(scale=1.6),
                          "mantle": dict(color="#5a0a14", name="Yunjian", lobes=4, silk=True, noise=0.0, flare=0.04,
                                         bottom=1.3, trim="gold")},
                  props={"blood_gem": {}, "blood_thorns": {}, "vampire_collar": {}}),
    # Brannoc, the Ashen Smith: broad, a rolled-sleeve work robe under iron lamellar, a leather apron, wrapped
    # legs, a beard; a glowing forge in his chest and a great hammer on his back.
    "forge": dict(robe="#3a2a22", inner="#1c1612", trim=("#ff7a2a", "#1a1210"), sash="#5a2a14",
                  coarse=True, short=True, leg_wraps=True, hair="loose", hair_color="#2a1a14", headwear="band",
                  beard="long", pendant=False, skin="#9a6a50", sleeve="rolled", eye_glow="#ff8a2a",
                  extras={"apron": dict(color="#3a2416", length=0.55, width=0.6)},
                  props={"chest_forge": {}, "slag_pauldrons": {}, "molten_veins": {}, "back_hammer": {}}),
    # Isolde, the Winter Warden: the frost mistress's pale layered silks and cloud collar, silver hair; an ice crown.
    "frost": dict(robe="#adc6d9", inner="#d4e1ea", trim=("#d8ecfa", "#3f6f98"), sash="#2f5f88", over="#bcd2e2",
                  skirt="#8eb0cc", female=True, slim=True, qixiong=True, pleats=True, hair="maiden", tall_loops=True,
                  hair_color="#dfe6ee", brow_color="#b8c4d0", headwear=False, skin="#ecd8c8", lips="#9a7a8a",
                  eye_glow="#8fd8ff", sleeve="pipa",
                  extras={"pibo": dict(color="#bfe0ff", glow="#9fd4ff"),
                          "mantle": dict(color="#e8f4ff", name="Yunjian", lobes=4, silk=True, noise=0.0, flare=0.035,
                                         bottom=1.3, trim="silver")},
                  props={"ice_crown": {}, "ice_mantle": {}}),
    # Lyra, the Star Archer: a night-violet robe with gold trim, archer's bracers, a braid; a star circlet, a bow
    # and a quiver across her back.
    "astral": dict(robe="#2a1f5a", inner="#e8e0c8", trim=("#e0bb62", "#1a1238"), sash="#e0bb62",
                   female=True, slim=True, hair="braid", hair_color="#1a1430", headwear=False, skin="#e8cfbe",
                   sleeve="bracer", bracer="#1a1238", eye_glow="#ffe08a",
                   extras={"mantle": dict(color="#1a1238", name="Yunjian", lobes=4, silk=True, noise=0.0, flare=0.03,
                                          bottom=1.33, trim="gold")},
                   props={"star_circlet": {}, "star_halo": {}, "mantle_stars": {}, "robe_stars": {}, "back_bow": {}, "quiver": {}}),
    # Vex, the Plague Alchemist: a long dark coat over a stained robe, a leather apron, a wide conical hat; a beaked
    # plague mask with glass eyes and a bandolier of glowing vials.
    "alchemy": dict(robe="#2e3a2a", inner="#a8a88a", trim=("#9acd4a", "#1a2014"), sash="#4a3a24", over="#1e261c",
                    coarse=True, hair="tail", hair_color="#1a1a14", headwear="douli", pendant=False, skin="#c9b8a0",
                    sleeve="narrow", over_gap=0.3,
                    extras={"apron": dict(color="#3a2a1c", length=0.5, width=0.5), "gourd": dict(color="#4fbf2a", x=0.16)},
                    props={"plague_mask": {}, "vial_bandolier": {}, "back_alembic": {}, "held_flask": {}}),
}


class HeroFigure(figure_kit.Figure):
    """figure_kit.Figure plus the heroes' props (rigid parts skinned to one bone)."""

    def build(self):
        coll = super().build()
        return coll

    # The props are added before the kit merges and skins the parts: hook in after the extras.
    def add_chains(self, rig):
        for prop, kw in self.look.get("props", {}).items():
            getattr(self, prop)(**kw)
        super().add_chains(rig)

    def _mat(self, part, color, **kw):
        return kit.material(f"fig_{self.key}_{part}", color, **kw)

    # ---- blood ------------------------------------------------------------------------------------------
    def blood_gem(self):
        gem = self._mat("bloodgem", "#8c0f22", roughness=0.1, coat=0.8, emission="#ff2a3a", strength=1.2)
        p = Vector((0, -0.105, 1.43))
        self.add(kit.blob("BloodGem", p, (0.018, 0.012, 0.024), gem, (12, 10)), CHEST)
        self.add(kit.torus("GemSetting", p + Vector((0, 0.004, 0)), 0.022, 0.004, self.m["gold"], seg=(20, 6)), CHEST)

    def blood_thorns(self):
        ruby = self._mat("ruby", "#5a0a14", roughness=0.15, coat=0.9, emission="#c0102a", strength=0.6)
        for side, sx in SIDES:
            base = Vector((0.2 * sx, 0.02, 1.47))
            for k, (out, up, ln, w) in enumerate([(0.35, 1.0, 0.36, 0.042), (0.8, 0.7, 0.27, 0.034), (0.15, 0.9, 0.2, 0.028), (1.0, 0.25, 0.16, 0.024)]):
                d = Vector((out * sx, 0.05 * (k - 1.5), up)).normalized()
                p0 = base + Vector((0.015 * sx * k, 0.02 * (k - 1.5), 0))
                self.add(kit.tube(f"Thorn{side}{k}", p0, p0 + d * ln, [(0, w, w), (1, 0.001, 0.001)], ruby, seg=6), ARM[side])

    def vampire_collar(self):
        """A fan of tall, flat collar blades standing behind the head, dark with a crimson face and gold tips."""
        dark = self._mat("collarblade", "#14080a", roughness=0.4, metallic=0.3)
        face = self._mat("collarface", "#5a0f18", roughness=0.5, double_sided=True)
        n = 9
        for k in range(n):
            t = (k - (n - 1) / 2) / ((n - 1) / 2)  # -1 (her right) .. 1 (left), behind the neck
            a = math.pi / 2 + t * 1.25  # around the back of the neck
            base = Vector((0.1 * math.cos(a), 0.03 + 0.09 * math.sin(a), 1.47))
            ln = 0.2 + 0.2 * abs(t) ** 0.8 + (0.14 if k == (n - 1) // 2 else 0.0)  # tall at the sides, a tall centre
            d = Vector((0.55 * math.cos(a), 0.25 + 0.4 * math.sin(a), 1.0)).normalized()
            tip = base + d * ln
            self.add(kit.tube(f"CollarBlade{k}", base, tip, [(0, 0.035, 0.007), (0.7, 0.022, 0.005), (1, 0.001, 0.001)], dark, seg=6), CHEST)
            self.add(kit.tube(f"CollarFace{k}", base + Vector((0, -0.006, 0.01)), base + d * ln * 0.75, [(0, 0.022, 0.003), (1, 0.001, 0.001)], face, seg=6), CHEST)
            self.add(kit.blob(f"CollarTip{k}", tip - d * 0.02, (0.006, 0.006, 0.014), self.m["gold"], (6, 4)), CHEST)
        ring = [Vector((0.105 * math.cos(math.pi / 2 + t * 1.3), 0.03 + 0.095 * math.sin(math.pi / 2 + t * 1.3), 1.47)) for t in [i / 10 - 1 for i in range(21)]]
        self.add(kit.chain("CollarBand", ring, [0.008] * len(ring), self.m["gold"], seg=6), CHEST)

    # ---- forge ------------------------------------------------------------------------------------------
    def slag_pauldrons(self):
        iron = self._mat("iron", "#2a2624", metallic=0.8, roughness=0.45)
        crack = self._mat("crack", "#ff6a1a", roughness=0.6, emission="#ff6a12", strength=3.0)
        for side, sx in SIDES:
            c = Vector((0.23 * sx, 0.0, 1.45))
            self.add(kit.blob(f"Pauldron{side}", c, (0.15, 0.15, 0.095), iron, (20, 12)), ARM[side])
            self.add(kit.blob(f"PauldronLip{side}", c + Vector((0.05 * sx, 0, -0.06)), (0.12, 0.14, 0.035), iron, (16, 8)), ARM[side])
            # glowing slag cracks running over the plate, uneven
            for k, (y0, y1, z0, z1) in enumerate([(-0.08, -0.01, 1.48, 1.51), (0.0, 0.07, 1.5, 1.47), (-0.04, 0.05, 1.44, 1.46)]):
                pts = [Vector((0.31 * sx, y0, z0 + 0.01)), Vector((0.35 * sx, (y0 + y1) / 2, (z0 + z1) / 2 + 0.025)), Vector((0.33 * sx, y1, z1 + 0.01))]
                self.add(kit.chain(f"PauldronCrack{side}{k}", pts, [0.006, 0.008, 0.004], crack, seg=6), ARM[side])

    def molten_veins(self):
        crack = self._mat("crack", "#ff6a1a", roughness=0.6, emission="#ff6a12", strength=3.0)
        for side, sx in SIDES:
            a, b = Vector((0.255 * sx, 0, 1.16)), Vector((0.285 * sx, -0.05, 0.93))
            for k, off in enumerate((-1, 1)):
                pts = [a.lerp(b, t) + Vector((0.035 * sx, -0.03 + 0.025 * off, 0.01 * math.sin(t * 9 + k))) for t in (0.0, 0.3, 0.6, 1.0)]
                self.add(kit.chain(f"Vein{side}{k}", pts, [0.006, 0.008, 0.006, 0.003], crack, seg=6), FORE[side])

    def chest_forge(self):
        iron = self._mat("iron", "#2a2624", metallic=0.8, roughness=0.45)
        ember = self._mat("ember", "#ff6a1a", roughness=0.6, emission="#ff7a2a", strength=3.0)
        c = Vector((0, -0.16, 1.3))
        self.add(kit.blob("ForgeCore", c, (0.075, 0.03, 0.075), ember, (16, 12)), CHEST)
        self.add(kit.torus("ForgeRing", c + Vector((0, -0.006, 0)), 0.09, 0.018, iron, seg=(28, 8), axis=(0, 1, 0)), CHEST)
        for k in range(4):  # grate bars across the glow
            z = c.z - 0.05 + 0.033 * k
            self.add(kit.box(f"ForgeBar{k}", Vector((0, c.y - 0.03, z)), (0.16, 0.01, 0.008), iron, bevel=0.002), CHEST)

    def back_hammer(self):
        wood = self._mat("haft", "#4a3020", roughness=0.7)
        iron = self._mat("iron", "#2a2624", metallic=0.8, roughness=0.45)
        hot = self._mat("hotedge", "#ff6a1a", roughness=0.5, emission="#ff5a12", strength=1.6)
        # Diagonal across the back: grip low at the right hip, head up behind the left shoulder.
        a, b = Vector((-0.22, 0.18, 0.78)), Vector((0.27, 0.21, 1.72))
        self.add(kit.tube("HammerHaft", a, b, [(0, 0.02, 0.02), (1, 0.022, 0.022)], wood, seg=10), CHEST)
        d = (b - a).normalized()
        head = b + d * 0.04
        rot = Euler((0, math.atan2(d.x, d.z), 0))  # the head's long axis across the haft
        self.add(kit.box("HammerHead", head, (0.36, 0.2, 0.2), iron, bevel=0.018, segments=2, rotation=rot), CHEST)
        across = Vector((1, 0, 0))
        across.rotate(rot)
        for s in (-1, 1):
            self.add(kit.box(f"HammerFace{s}", head + across * (0.185 * s), (0.014, 0.21, 0.21), hot, bevel=0.004, rotation=rot), CHEST)

    # ---- frost ------------------------------------------------------------------------------------------
    def ice_crown(self):
        ice = self._mat("ice", "#9fd4ff", roughness=0.08, coat=1.0, emission="#6fc8ff", strength=0.2)
        top = Vector((0, 0.015, 1.74))
        n = 9
        for k in range(n):
            a = -math.pi / 2 + (k - (n - 1) / 2) * 0.32  # a fan over the front and sides
            r = 0.085
            base = top + Vector((math.cos(a) * r, math.sin(a) * r, 0))
            ln = 0.07 + 0.09 * (1 - abs(k - (n - 1) / 2) / ((n - 1) / 2))  # tallest in front
            tip = base + Vector((math.cos(a) * 0.02, math.sin(a) * 0.02, ln))
            self.add(kit.tube(f"IceSpike{k}", base, tip, [(0, 0.012, 0.012), (1, 0.001, 0.001)], ice, seg=6), HEAD)
        self.add(kit.torus("IceBand", top, 0.088, 0.008, self.m["silver"], seg=(32, 6)), HEAD)

    def ice_mantle(self):
        """A fan of ice shards standing up behind the shoulders, and crystal clusters at the shoulders and wrists."""
        ice = self._mat("ice", "#9fd4ff", roughness=0.08, coat=1.0, emission="#6fc8ff", strength=0.2)
        n = 11
        for k in range(n):
            t = (k - (n - 1) / 2) / ((n - 1) / 2)  # -1..1 across the back
            base = Vector((0.2 * t, 0.13, 1.42 - 0.05 * t * t))
            ln = 0.78 - 0.38 * t * t
            d = Vector((1.1 * t, 0.3, 1.0)).normalized()
            self.add(kit.tube(f"IceFan{k}", base, base + d * ln, [(0, 0.034, 0.034), (0.6, 0.022, 0.022), (1, 0.001, 0.001)], ice, seg=5), CHEST)
        for side, sx in SIDES:
            c = Vector((0.2 * sx, 0.0, 1.46))
            for k, (out, ln) in enumerate([(0.5, 0.13), (0.9, 0.09), (0.2, 0.08)]):
                d = Vector((out * sx, 0.1 * (k - 1), 0.8)).normalized()
                self.add(kit.tube(f"IcePaul{side}{k}", c, c + d * ln, [(0, 0.016, 0.016), (1, 0.001, 0.001)], ice, seg=5), ARM[side])
            w = Vector((0.28 * sx, -0.04, 0.95))
            for k in range(3):
                d = Vector((0.6 * sx, -0.2 + 0.2 * k, 0.4)).normalized()
                self.add(kit.tube(f"IceCuff{side}{k}", w, w + d * 0.07, [(0, 0.01, 0.01), (1, 0.001, 0.001)], ice, seg=5), FORE[side])

    # ---- astral -----------------------------------------------------------------------------------------
    def star_halo(self):
        """A thin gold ring standing behind her head with star points on it: a constellation halo."""
        star = self._mat("star", "#fff1c0", roughness=0.3, emission="#ffe08a", strength=2.5)
        c = Vector((0, 0.16, 1.66))
        self.add(kit.torus("Halo", c, 0.2, 0.004, self.m["gold"], seg=(48, 6), axis=(0, 1, 0)), HEAD)
        pts = []
        for k, (a, s) in enumerate([(0.3, 0.02), (1.1, 0.013), (1.9, 0.024), (2.6, 0.012), (3.4, 0.018), (4.4, 0.014), (5.3, 0.02)]):
            p = c + Vector((math.cos(a) * 0.2, 0, math.sin(a) * 0.2))
            pts.append(p)
            self.add(kit.blob(f"HaloStar{k}", p, (s, 0.006, s), star, (8, 6)), HEAD)
        for k in range(0, len(pts) - 1, 2):  # a few constellation lines across the ring
            self.add(kit.chain(f"HaloLine{k}", [pts[k], pts[(k + 3) % len(pts)]], [0.002, 0.002], self.m["gold"], seg=4), HEAD)

    def mantle_stars(self):
        import random
        star = self._mat("star", "#fff1c0", roughness=0.3, emission="#ffe08a", strength=2.5)
        rnd = random.Random(7)
        for k in range(14):
            x = rnd.uniform(-0.2, 0.2)
            z = rnd.uniform(1.33, 1.47)
            y = 0.155 - 0.4 * x * x
            s = rnd.choice((0.006, 0.008, 0.011))
            self.add(kit.blob(f"MantleStar{k}", Vector((x, y, z)), (s, 0.004, s), star, (6, 4)), CHEST)

    def star_circlet(self):
        star = self._mat("star", "#fff1c0", roughness=0.3, emission="#ffe08a", strength=2.5)
        top = Vector((0, 0.015, 1.72))
        self.add(kit.torus("Circlet", top, 0.095, 0.005, self.m["gold"], seg=(32, 6)), HEAD)
        for k, (a, s) in enumerate([(-math.pi / 2, 0.022), (-math.pi / 2 - 0.5, 0.013), (-math.pi / 2 + 0.5, 0.013)]):
            p = top + Vector((math.cos(a) * 0.097, math.sin(a) * 0.097, 0.012))
            self.add(kit.blob(f"CircletStar{k}", p, (s, s * 0.5, s), star, (8, 6)), HEAD)

    def back_bow(self):
        wood = self._mat("bow", "#1a1238", roughness=0.4, metallic=0.2)
        string = self._mat("string", "#e8e0c8", roughness=0.6)
        # A recurve bow on her back, standing upright, slightly tilted.
        pts = []
        for i in range(13):
            t = i / 12
            z = 0.75 + 0.95 * t
            bulge = 0.09 * math.sin(math.pi * t) - 0.03 * math.sin(2 * math.pi * t) * (1 if t > 0.5 else -1) * 0.3
            pts.append(Vector((0.05 + 0.08 * (t - 0.5), 0.19 + bulge, z)))
        self.add(kit.chain("Bow", pts, kit.lerp_list([0.008, 0.014, 0.016, 0.014, 0.008], len(pts)), wood, seg=8), CHEST)
        self.add(kit.chain("BowGold", pts[5:8], [0.018, 0.019, 0.018], self.m["gold"], seg=8), CHEST)
        self.add(kit.chain("BowString", [pts[0], pts[-1]], [0.002, 0.002], string, seg=4), CHEST)

    def quiver(self):
        leather = self._mat("quiver", "#3a2a1c", roughness=0.7)
        fletch = self._mat("fletch", "#e8e0c8", roughness=0.8, double_sided=True)
        a, b = Vector((0.16, 0.16, 1.0)), Vector((-0.1, 0.17, 1.5))
        self.add(kit.tube("Quiver", a, b, [(0, 0.04, 0.035), (1, 0.05, 0.04)], leather, seg=12), CHEST)
        self.add(kit.torus("QuiverRim", b, 0.05, 0.006, self.m["gold"], seg=(20, 6)), CHEST)
        d = (b - a).normalized()
        for k in range(4):
            off = Vector(((k - 1.5) * 0.018, 0.0, 0))
            self.add(kit.tube(f"Arrow{k}", b + off - d * 0.05, b + off + d * 0.16, [(0, 0.004, 0.004), (1, 0.004, 0.004)], self.m["gold"], seg=6), CHEST)
            self.add(kit.blob(f"Fletch{k}", b + off + d * 0.13, (0.012, 0.004, 0.03), fletch, (6, 4)), CHEST)

    # ---- alchemy ----------------------------------------------------------------------------------------
    def plague_mask(self):
        leather = self._mat("mask", "#2a2418", roughness=0.6)
        glass = self._mat("lens", "#9acd4a", roughness=0.05, coat=1.0, emission="#9acd4a", strength=1.2)
        face = Vector((0, -0.085, 1.62))
        # Beak: a lathe cone pointing forward (-Y), curving down a little.
        pts = [face + Vector((0, -0.01 - 0.05 * t, -0.015 - 0.04 * t * t)) for t in (0, 0.5, 1.0, 1.5, 2.0)]
        self.add(kit.chain("Beak", pts, [0.045, 0.036, 0.025, 0.014, 0.003], leather, seg=12), HEAD)
        for s in (-1, 1):
            p = face + Vector((0.032 * s, 0.006, 0.03))
            self.add(kit.blob(f"Lens{s}", p, (0.019, 0.008, 0.019), glass, (12, 8)), HEAD)
            self.add(kit.torus(f"LensRim{s}", p, 0.02, 0.004, self.m["gold"], seg=(16, 6)), HEAD)

    def vial_bandolier(self):
        strap = self._mat("strap", "#3a2a1c", roughness=0.7)
        glass = self._mat("vialglass", "#6f9a8c", roughness=0.12, coat=0.6)
        juice = self._mat("vialjuice", "#5fd02a", roughness=0.2, emission="#9acd4a", strength=1.5)
        # A strap from the right shoulder to the left hip across the front, with six vials.
        a, b = Vector((-0.12, -0.11, 1.45)), Vector((0.14, -0.13, 1.0))
        self.add(kit.tube("Bandolier", a, b, [(0, 0.012, 0.012), (1, 0.012, 0.012)], strap, seg=8), CHEST)
        for k in range(6):
            t = 0.12 + 0.15 * k
            p = a.lerp(b, t) + Vector((0, -0.018, 0))
            self.add(kit.tube(f"Vial{k}", p - Vector((0, 0, 0.042)), p + Vector((0, 0, 0.042)), [(0, 0.018, 0.018), (1, 0.013, 0.013)], glass, seg=8), CHEST)
            self.add(kit.blob(f"Juice{k}", p - Vector((0, 0, 0.01)), (0.014, 0.014, 0.028), juice, (8, 6)), CHEST)


    def robe_stars(self):
        """Gold stars scattered over the front of the robe skirt (they sway with it)."""
        import random
        star = self._mat("star", "#fff1c0", roughness=0.3, emission="#ffe08a", strength=2.5)
        rnd = random.Random(11)
        for k in range(12):
            t = rnd.uniform(0.25, 0.95)
            a = -math.pi / 2 + rnd.uniform(-1.0, 1.0)
            p = self.B.skirt(t, a, lift=0.008)
            sz = rnd.choice((0.007, 0.009, 0.012))
            self.add(kit.blob(f"RobeStar{k}", p, (sz, sz, sz), star, (6, 4)), self.skirt_w)

    def held_flask(self):
        """A round flask of glowing acid held in the right hand."""
        glass = self._mat("vialglass", "#6f9a8c", roughness=0.12, coat=0.6)
        juice = self._mat("vialjuice", "#5fd02a", roughness=0.2, emission="#9acd4a", strength=1.5)
        HAND = lambda q: {"hand.R": 1.0}  # noqa: E731
        c = Vector((-0.305, -0.1, 0.74))
        self.add(kit.blob("HeldFlask", c, (0.05, 0.05, 0.055), glass, (16, 12)), HAND)
        self.add(kit.blob("HeldJuice", c + Vector((0, 0, -0.008)), (0.042, 0.042, 0.04), juice, (12, 10)), HAND)
        self.add(kit.tube("HeldNeck", c + Vector((0, 0, 0.045)), c + Vector((0, 0, 0.1)), [(0, 0.014, 0.014), (1, 0.012, 0.012)], glass, seg=8), HAND)
        self.add(kit.blob("HeldCork", c + Vector((0, 0, 0.105)), (0.013, 0.013, 0.012), self.m["sash"], (8, 6)), HAND)

    def back_alembic(self):
        """A glass alembic strapped to her back: a round flask of green liquid, a copper neck and coil."""
        glass = self._mat("vialglass", "#6f9a8c", roughness=0.12, coat=0.6)
        juice = self._mat("vialjuice", "#5fd02a", roughness=0.2, emission="#9acd4a", strength=1.5)
        copper = self._mat("copper", "#b8642a", metallic=1.0, roughness=0.35)
        c = Vector((0.0, 0.25, 1.2))
        self.add(kit.blob("Alembic", c, (0.12, 0.1, 0.13), glass, (20, 14)), CHEST)
        self.add(kit.blob("AlembicJuice", c + Vector((0, 0, -0.03)), (0.1, 0.085, 0.09), juice, (16, 12)), CHEST)
        neck0 = c + Vector((0, 0, 0.12))
        neck1 = neck0 + Vector((0.12, 0.02, 0.22))
        self.add(kit.tube("AlembicNeck", neck0, neck1, [(0, 0.03, 0.03), (1, 0.012, 0.012)], copper, seg=10), CHEST)
        coil = [neck1 + Vector((0.035 * math.cos(t), 0.035 * math.sin(t), -0.025 * t)) for t in [i * 0.5 for i in range(16)]]
        self.add(kit.chain("AlembicCoil", coil, [0.007] * len(coil), copper, seg=6), CHEST)
        for sgn in (-1, 1):
            self.add(kit.chain(f"AlembicStrap{sgn}", [Vector((0.12 * sgn, 0.12, 1.42)), c + Vector((0.1 * sgn, -0.03, -0.06))], [0.01, 0.01], self.m["sash"], seg=6), CHEST)


def _reload():
    for mod in (kit, dao, figure_kit):
        importlib.reload(mod)


def build(name, reload=True):
    if reload:
        _reload()
    dao.setup_scene()
    look = dict(LOOKS[name])
    f = HeroFigure(name, look)
    coll = f.build()
    if look.get("broad"):  # a heavier build: wider and deeper, same height
        s = look["broad"]
        for ob in coll.objects:
            if ob.type in ("MESH", "ARMATURE"):
                ob.scale = (s, s, 1.0)
    return coll, f


def export(name, keep=False, reload=True):
    """Build a hero and export it to public/models/heroes/<name>.glb (meshopt, skinned)."""
    coll, f = build(name, reload)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.glb")
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = list(coll.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=True, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
    )
    st = kit.stats(coll)
    if not keep:
        kit.clear(coll)
        kit.purge()
    return {"hero": name, "triangles": st["triangles"], "kb": round(os.path.getsize(path) / 1024), "path": path}


def preview(name, views=(20, 200), size=640):
    """Build a hero and render turnaround previews into docs/heroes/."""
    coll, f = build(name)
    os.makedirs(PREVIEWS, exist_ok=True)
    return kit.preview(coll, name=f"{name}", views=views, size=size, out_dir=PREVIEWS)
