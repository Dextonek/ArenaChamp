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
HAND = {"R": lambda p: {"hand.R": 1.0}, "L": lambda p: {"hand.L": 1.0}}
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
    # Kaia, the Tempest Caller: a storm-blue rain cloak over a pale tunic, wind-swept silver-blue hair, storm eyes;
    # a small storm cloud floating over her head, a hooked staff with a blue stone, a bolt emblem on the chest.
    "storm": dict(robe="#d8e4ee", inner="#eef4f8", trim=("#4aa8ff", "#2a3a52"), sash="#2a3a52", over="#2a3a52",
                  female=True, slim=True, hair="loose", strands=True, hair_color="#c8e0f0", brow_color="#9ab4c8",
                  headwear=False, skin="#e2c4b0", eye_glow="#8fd8ff", sleeve="narrow", over_gap=0.35,
                  extras={"mantle": dict(color="#22324a", name="Yunjian", lobes=4, silk=True, noise=0.0, flare=0.04,
                                         bottom=1.3, trim="silver")},
                  props={"cloud_crown": {}, "hooked_staff": {}, "bolt_emblem": {}}),
    # Sefu, the Dune Sovereign: layered linen, a gold and turquoise nemes headcloth, a broad collar, gold cuffs and a
    # sandstone crook.
    "sand": dict(robe="#e6d6b4", inner="#efe2c4", trim=("#c9a24a", "#c8913f"), sash="#c9a24a", over="#d8c49a",
                 hair="shaved", headwear=False, pendant=False, skin="#a8744c", beard="goatee", sleeve="narrow",
                 over_sleeves=False, over_hem=0.6, over_gap=0.3,
                 props={"nemes": {}, "broad_collar": {}, "sand_crook": {}, "gold_cuffs": {}}),
    # Nyx, the Umbral Stalker: a tattered black cloak with a violet edge, a deep hood, a dark half mask, violet eyes
    # and twin curved daggers at the hips.
    "shadow": dict(robe="#120c18", inner="#1e1626", trim=("#c88cff", "#07050a"), sash="#6a2ec0", over="#0c0810",
                   female=True, slim=True, tattered=True, hair="loose", hair_color="#1a1220", headwear=False,
                   skin="#cfc0d4", eye_glow="#c88cff", sleeve="narrow", over_gap=0.25, pendant=False,
                   props={"deep_hood": {}, "twin_daggers": {}}),
    # Fenna, the Grove Warden: a leaf-green robe over bark cream, auburn hair with small branch antlers and blossoms,
    # a leaf mantle, a vine spiralling up her body and a living staff that blooms at the top.
    "grove": dict(robe="#3f9a46", inner="#e8dcc0", trim=("#6a4a2a", "#2a5a22"), sash="#6a4a2a", over="#2f6a28",
                  female=True, slim=True, hair="loose", strands=True, hair_color="#8a4a2a", headwear=False,
                  skin="#d8b490", eye_glow="#7fe07a", sleeve="narrow", over_gap=0.3, pendant=False,
                  props={"branch_antlers": {}, "leaf_mantle": {}, "body_vine": {}, "bloom_staff": {}}),
    # Auriel, the Dawn Paladin: ivory and gold plate over a white tabard, golden hair, a halo of hard-light panels,
    # a hard-light sword and a gold kite shield.
    "dawn": dict(robe="#efe6d2", inner="#f6efe0", trim=("#f2b83c", "#c9a24a"), sash="#c9a24a",
                 hair="crown", hair_color="#e8c46a", headwear=False, skin="#e6c8a8", eye_glow="#7fd8ff",
                 sleeve="bracer", bracer="#d8cbb0", pendant=False,
                 extras={"armour": dict(plate="#e6dcc4", cord="#c9a24a", rivet="gold", rows=3, apron=False)},
                 props={"panel_halo": {}, "light_sword": {}, "kite_shield": {}}),
    # Marin, the Tide Dancer: a deep teal dancer's dress with sea-glass layers, a sea-green braid with a coral clip,
    # water rings on her wrists and two water sashes swirling around her.
    "tide": dict(robe="#0f5f86", inner="#1f9fd6", trim=("#bff2ff", "#05253a"), sash="#ff9a6a", skirt="#1f9fd6",
                 female=True, slim=True, qixiong=True, pleats=True, hair="braid", hair_color="#2a8a7a", headwear=False,
                 skin="#c89878", eye_glow="#7fe8ff", sleeve="narrow", pendant=False,
                 props={"coral_clip": {}, "wrist_rings": {}, "water_sashes": {}}),
    # Zephyr, the Wind Blade (melee): a white and mint wrap coat with a split skirt, wrapped legs, windswept
    # pale-teal hair under a mint headband; a long mint scarf streaming in the wind and a slim curved sword.
    "sky": dict(robe="#dff0ea", inner="#eef3f6", trim=("#7fe6c8", "#0d2a2a"), sash="#0d2a2a", over="#9fd8c6",
                slim=True, short=True, leg_wraps=True, hair="loose", strands=True, hair_color="#bfe8de",
                headwear="band", skin="#e6c4a2", eye_glow="#7fe6c8", sleeve="narrow", over_gap=0.3, pendant=False,
                props={"wind_scarf": {}, "curved_sword": {}}),
    # Mortis, the Ossuary Lord: a tall tattered grave robe in grey and teal, a deep hood with a teal edge, a
    # ribcage mantle over the chest, skulls on the shoulders and a staff topped with a skull with soulfire eyes.
    "bone": dict(robe="#5a6664", inner="#2a4a44", trim=("#3fd8b8", "#1c2422"), sash="#1c2422", over="#6a7472",
                 tattered=True, hair="shaved", headwear=False, pendant=False, skin="#b8b2a4", eye_glow="#3fd8b8",
                 sleeve="narrow", over_gap=0.3,
                 props={"bone_hood": {}, "rib_mantle": {}, "shoulder_skulls": {}, "skull_staff": {}}),
    # Ada, the Artificer: a copper long coat over a dark vest with steel buttons, auburn hair, brass goggles pushed
    # up on the forehead, a backpack of brass gears and a spring-loaded wrist launcher with a cyan lens.
    "clockwork": dict(robe="#c06a34", inner="#2a1a10", trim=("#c9a24a", "#1a0f08"), sash="#1a0f08", over="#a85a2a",
                      female=True, slim=True, hair="loose", hair_color="#8a3a1a", headwear=False, skin="#e6c4a2",
                      eye_glow="#6affea", sleeve="rolled", over_gap=0.3, pendant=False,
                      props={"goggles": {}, "gear_backpack": {}, "wrist_launcher": {}}),
    # Opaline, the Lightbreaker: a long pale lavender robe over white, platinum hair, crystal epaulettes, a ring of
    # small floating prisms behind her head and a crystal-tipped wand; thin spectral bands on the sash.
    "prism": dict(robe="#b8acf0", inner="#f0f4ff", trim=("#b8b0ff", "#14102a"), sash="#14102a", over="#c8bef6",
                  female=True, slim=True, hair="loose", hair_color="#e8e4f4", brow_color="#c8c4d8", headwear=False,
                  skin="#ecd6c6", eye_glow="#b8b0ff", sleeve="narrow", over_gap=0.3, pendant=False,
                  props={"prism_ring": {}, "crystal_epaulettes": {}, "crystal_wand": {}, "spectral_sash": {}}),
    # Sirix, the Swarm Warden: broad black chitin plate with amber stripes, a crested insect helm with amber eye
    # lenses, hexagonal pauldrons, serrated claw gauntlets and a translucent wing cloak.
    "hive": dict(robe="#1c1608", inner="#120e06", trim=("#f0b020", "#120e06"), sash="#f0b020",
                 coarse=True, hair="shaved", headwear=False, pendant=False, skin="#8a6a4a", eye_glow="#ffd24a",
                 sleeve="bracer", bracer="#2a2010",
                 extras={"armour": dict(plate="#2a2010", cord="#f0b020", rivet="gold", rows=3, apron=False)},
                 props={"insect_helm": {}, "hex_pauldrons": {}, "claw_gauntlets": {}, "wing_cloak": {}}),
    # Cantor, the Last Verse: a rose and plum long coat over a cream shirt, dark hair, a wide plum hat with a rose
    # feather, a parchment scarf printed with notes and a golden lyre in his left hand.
    "bard": dict(robe="#5a1a4a", inner="#f2e6d0", trim=("#ffd24a", "#1e0a1a"), sash="#ffd24a", over="#c03a8a",
                 slim=True, leg_wraps=True, hair="loose", hair_color="#2a1410", headwear=False, skin="#c8946c",
                 eye_glow="#ffd24a", sleeve="narrow", over_gap=0.3, pendant=False,
                 props={"feathered_hat": {}, "note_scarf": {}, "golden_lyre": {}}),
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


    # ---- storm ------------------------------------------------------------------------------------------
    def cloud_crown(self):
        """A small dark storm cloud floating over her head, a pale underside and a short glowing bolt under it."""
        cloud = self._mat("cloud", "#2a3346", roughness=0.9)
        under = self._mat("cloudunder", "#c8d4de", roughness=0.9)
        bolt = self._mat("bolt", "#d6f2ff", roughness=0.4, emission="#8fd8ff", strength=2.0)
        c = Vector((0, 0.02, 2.02))
        for k, (x, y, z, r) in enumerate([(-0.11, 0.0, 0.0, 0.085), (0.0, 0.02, 0.03, 0.105), (0.11, -0.01, 0.0, 0.08), (0.05, 0.06, 0.02, 0.07)]):
            self.add(kit.blob(f"Cloud{k}", c + Vector((x, y, z)), (r, r * 0.8, r * 0.62), cloud, (12, 8)), HEAD)
        self.add(kit.blob("CloudUnder", c + Vector((0, 0.01, -0.035)), (0.2, 0.09, 0.02), under, (16, 6)), HEAD)
        pts = [c + Vector(v) for v in [(0.0, -0.01, -0.05), (-0.02, -0.01, -0.09), (0.015, -0.01, -0.1), (-0.01, -0.01, -0.15)]]
        self.add(kit.chain("CrownBolt", pts, [0.008, 0.007, 0.006, 0.002], bolt, seg=5), HEAD)

    def hooked_staff(self):
        """A tall dark staff in her left hand with a pale hooked head holding a blue storm stone."""
        wood = self._mat("staff", "#3a2a1c", roughness=0.7)
        steel = self._mat("staffhook", "#c9d6e0", metallic=0.8, roughness=0.3)
        stone = self._mat("stormstone", "#4aa8ff", roughness=0.2, emission="#4aa8ff", strength=1.5)
        a, b = Vector((0.31, -0.11, 0.05)), Vector((0.33, -0.13, 1.92))
        self.add(kit.tube("Staff", a, b, [(0, 0.014, 0.014), (1, 0.016, 0.016)], wood, seg=8), HAND["L"])
        hook = [b + Vector(v) for v in [(0, 0, 0), (0.01, 0, 0.08), (0.06, 0, 0.12), (0.11, 0, 0.09), (0.1, 0, 0.03), (0.06, 0, 0.02)]]
        self.add(kit.chain("StaffHook", hook, [0.016, 0.015, 0.013, 0.012, 0.01, 0.008], steel, seg=8), HAND["L"])
        self.add(kit.blob("StormStone", b + Vector((0.065, 0, 0.065)), (0.028, 0.028, 0.028), stone, (10, 8)), HAND["L"])

    def bolt_emblem(self):
        bolt = self._mat("bolt", "#d6f2ff", roughness=0.4, emission="#8fd8ff", strength=2.0)
        c = Vector((0, -0.12, 1.3))
        pts = [c + Vector(v) for v in [(0.02, 0, 0.07), (-0.02, -0.002, 0.01), (0.015, -0.002, 0.005), (-0.025, 0, -0.07)]]
        self.add(kit.chain("BoltEmblem", pts, [0.012, 0.012, 0.012, 0.004], bolt, seg=4), CHEST)

    # ---- sand -------------------------------------------------------------------------------------------
    def nemes(self):
        """The striped royal headcloth: a gold cap over the head and two lappets falling to the chest."""
        gold = self._mat("nemesgold", "#c9a24a", metallic=0.6, roughness=0.35)
        blue = self._mat("nemesblue", "#3fd4c8", roughness=0.4)
        top = Vector((0, 0.01, 1.66))
        self.add(kit.blob("NemesCap", top + Vector((0, 0.01, 0.04)), (0.105, 0.115, 0.09), gold, (20, 12),
                          keep=lambda co: co.z > -0.02), HEAD)
        self.add(kit.torus("NemesBand", top + Vector((0, -0.005, 0.03)), 0.104, 0.008, blue, seg=(32, 6)), HEAD)
        self.add(kit.blob("Uraeus", top + Vector((0, -0.105, 0.08)), (0.012, 0.012, 0.02), blue, (8, 6)), HEAD)
        for side, sx in SIDES:
            # a long flat gold lappet from behind the ear down onto the chest, with three turquoise stripes
            p0, p1 = Vector((0.095 * sx, -0.015, 1.64)), Vector((0.11 * sx, -0.07, 1.36))
            self.add(kit.tube(f"Lappet{side}", p0, p1, [(0, 0.04, 0.012), (1, 0.05, 0.012)], gold, seg=6), CHEST)
            for k, t in enumerate((0.3, 0.55, 0.8)):
                q = p0.lerp(p1, t) + Vector((0, -0.006, 0))
                self.add(kit.box(f"LappetStripe{side}{k}", q, (0.1, 0.014, 0.018), blue, bevel=0.002), CHEST)

    def broad_collar(self):
        gold = self._mat("collargold", "#c9a24a", metallic=0.6, roughness=0.35)
        blue = self._mat("nemesblue", "#3fd4c8", roughness=0.4)
        c = Vector((0, -0.01, 1.47))
        self.add(kit.torus("BroadCollar", c, 0.13, 0.03, gold, seg=(32, 8)), CHEST)
        self.add(kit.torus("BroadCollarInlay", c + Vector((0, 0, 0.012)), 0.13, 0.012, blue, seg=(32, 6)), CHEST)

    def sand_crook(self):
        stone = self._mat("sandstone", "#e8d8b4", roughness=0.85)
        blue = self._mat("nemesblue", "#3fd4c8", roughness=0.4)
        a, b = Vector((-0.31, -0.11, 0.05)), Vector((-0.33, -0.13, 1.85))
        self.add(kit.tube("Crook", a, b, [(0, 0.02, 0.02), (1, 0.022, 0.022)], stone, seg=8), HAND["R"])
        hook = [b + Vector(v) for v in [(0, 0, 0), (0, 0, 0.08), (0.04, 0, 0.14), (0.1, 0, 0.13), (0.12, 0, 0.07)]]
        self.add(kit.chain("CrookHook", hook, [0.022, 0.022, 0.02, 0.018, 0.016], stone, seg=8), HAND["R"])
        for k, z in enumerate((0.9, 1.35)):
            p = a.lerp(b, (z - a.z) / (b.z - a.z))
            self.add(kit.torus(f"CrookBand{k}", p, 0.024, 0.008, blue, seg=(16, 6)), HAND["R"])

    def gold_cuffs(self):
        gold = self._mat("collargold", "#c9a24a", metallic=0.6, roughness=0.35)
        for side, sx in SIDES:
            p = Vector((0.28 * sx, -0.045, 0.97))
            self.add(kit.torus(f"Cuff{side}", p, 0.042, 0.014, gold, seg=(20, 6)), FORE[side])

    # ---- shadow -----------------------------------------------------------------------------------------
    def deep_hood(self):
        """A deep hood over the head, open at the face, with a thin violet edge around the opening."""
        cloth = self._mat("hood", "#0c0810", roughness=0.9, double_sided=True)
        edge = self._mat("hoodedge", "#c88cff", roughness=0.5, emission="#c88cff", strength=0.8)
        top = Vector((0, 0.02, 1.64))
        face = lambda co: not (co.y < -0.04 and abs(co.x) < 0.075 and -0.11 < co.z < 0.06)  # noqa: E731
        self.add(kit.blob("Hood", top + Vector((0, 0.012, 0.02)), (0.12, 0.13, 0.15), cloth, (24, 16), keep=face), HEAD)
        rim = [top + Vector((0.08 * math.sin(a), -0.115, 0.012 + 0.1 * math.cos(a))) for a in [i * math.pi / 8 - math.pi * 0.65 for i in range(15)]]
        self.add(kit.chain("HoodEdge", rim, [0.006] * len(rim), edge, seg=5), HEAD)
        self.add(kit.blob("HoodDrape", Vector((0, 0.06, 1.47)), (0.15, 0.1, 0.07), cloth, (16, 10)), CHEST)

    def twin_daggers(self):
        """Two curved daggers at the hips, pale steel with a violet edge, black grips."""
        steel = self._mat("dagger", "#cfcad8", metallic=0.8, roughness=0.25)
        edge = self._mat("hoodedge", "#c88cff", roughness=0.5, emission="#c88cff", strength=0.8)
        grip = self._mat("grip", "#2a1e34", roughness=0.6)
        for side, sx in SIDES:
            # worn in front of the hips over the cloak, blades curving down and out
            base = Vector((0.21 * sx, -0.15, 1.0))
            self.add(kit.tube(f"Grip{side}", base, base + Vector((0, 0, 0.09)), [(0, 0.015, 0.015), (1, 0.015, 0.015)], grip, seg=6), PELVIS)
            blade = [base + Vector((0.06 * sx * math.sin(t * 1.4), -0.015, -0.03 - 0.3 * t)) for t in [i / 6 for i in range(7)]]
            self.add(kit.chain(f"Dagger{side}", blade, kit.lerp_list([0.024, 0.02, 0.014, 0.004], 7), steel, seg=6), PELVIS)
            self.add(kit.chain(f"DaggerEdge{side}", [b + Vector((0.018 * sx, 0, 0)) for b in blade[1:]], [0.004] * 6, edge, seg=4), PELVIS)


    # ---- grove ------------------------------------------------------------------------------------------
    def branch_antlers(self):
        bark = self._mat("bark", "#6a4a2a", roughness=0.8)
        petal = self._mat("petal", "#ff7ab8", roughness=0.5)
        for side, sx in SIDES:
            base = Vector((0.05 * sx, 0.0, 1.76))
            tip = base + Vector((0.09 * sx, 0.01, 0.16))
            mid = base.lerp(tip, 0.5)
            self.add(kit.chain(f"Antler{side}", [base, mid + Vector((0.01 * sx, 0, 0.02)), tip], [0.012, 0.009, 0.005], bark, seg=6), HEAD)
            self.add(kit.tube(f"AntlerTine{side}", mid, mid + Vector((0.07 * sx, 0, 0.03)), [(0, 0.007, 0.007), (1, 0.003, 0.003)], bark, seg=5), HEAD)
            self.add(kit.blob(f"Blossom{side}", tip, (0.018, 0.018, 0.012), petal, (8, 6)), HEAD)

    def leaf_mantle(self):
        leaf = self._mat("leaf", "#5cbf55", roughness=0.6, double_sided=True)
        dark = self._mat("leafdark", "#2f6a28", roughness=0.6, double_sided=True)
        for k in range(12):
            a = -math.pi / 2 + (k - 5.5) * 0.26
            r = 0.2
            p = Vector((r * math.cos(a), 0.02 + r * 0.8 * math.sin(a), 1.43 - 0.02 * abs(k - 5.5)))
            rot = Euler((0.4, 0, a + math.pi / 2))
            self.add(kit.blob(f"MantleLeaf{k}", p, (0.06, 0.012, 0.035), leaf if k % 2 else dark, (10, 6), rotation=rot), CHEST)

    def body_vine(self):
        vine = self._mat("vine", "#3a8a34", roughness=0.6)
        leaf = self._mat("leaf", "#5cbf55", roughness=0.6, double_sided=True)
        pts = []
        for i in range(30):
            t = i / 29
            a = t * math.pi * 4.2
            z = 0.98 + 0.5 * t
            r = 0.2 - 0.03 * t
            pts.append(Vector((r * math.cos(a), 0.01 + r * 0.82 * math.sin(a), z)))
        self.add(kit.chain("BodyVine", pts, [0.009] * len(pts), vine, seg=6), CHEST)
        for k in range(0, 30, 5):
            self.add(kit.blob(f"VineLeaf{k}", pts[k] + Vector((0, -0.01, 0.01)), (0.03, 0.006, 0.016), leaf, (8, 4)), CHEST)

    def bloom_staff(self):
        bark = self._mat("bark", "#6a4a2a", roughness=0.8)
        petal = self._mat("petal", "#ff7ab8", roughness=0.5)
        pollen = self._mat("pollen", "#ffe36a", roughness=0.4, emission="#ffe36a", strength=1.5)
        a, b = Vector((-0.31, -0.11, 0.05)), Vector((-0.36, -0.13, 1.9))
        pts = [a.lerp(b, t) + Vector((0.02 * math.sin(t * 9), 0, 0)) for t in [i / 10 for i in range(11)]]
        self.add(kit.chain("BloomStaff", pts, [0.018] * 11, bark, seg=8), HAND["R"])
        top = b + Vector((0, 0, 0.04))
        for k in range(5):
            ang = k * 2 * math.pi / 5
            d = Vector((math.cos(ang), 0.0, math.sin(ang)))
            self.add(kit.blob(f"StaffPetal{k}", top + d * 0.05 + Vector((0, -0.02, 0)), (0.035, 0.01, 0.022), petal, (8, 6),
                              rotation=Euler((0, -ang, 0))), HAND["R"])
        self.add(kit.blob("StaffPollen", top + Vector((0, -0.03, 0)), (0.02, 0.012, 0.02), pollen, (8, 6)), HAND["R"])

    # ---- dawn -------------------------------------------------------------------------------------------
    def panel_halo(self):
        gold = self._mat("halogold", "#f2b83c", metallic=0.6, roughness=0.3)
        ivory = self._mat("haloivory", "#efe6d2", roughness=0.4, emission="#fff4d0", strength=0.4)
        c = Vector((0, 0.13, 1.66))
        self.add(kit.torus("Halo", c, 0.22, 0.012, gold, seg=(48, 8), axis=(0, 1, 0)), HEAD)
        self.add(kit.torus("HaloInner", c, 0.2, 0.006, ivory, seg=(48, 6), axis=(0, 1, 0)), HEAD)
        for k in range(8):
            ang = k * math.pi / 4
            p = c + Vector((math.cos(ang) * 0.235, 0, math.sin(ang) * 0.235))
            self.add(kit.blob(f"HaloPanel{k}", p, (0.022, 0.006, 0.022), gold, (4, 2), rotation=Euler((0, ang, 0))), HEAD)

    def light_sword(self):
        ivory = self._mat("bladeivory", "#f6efe0", roughness=0.35)
        core = self._mat("bladecore", "#fffdf2", roughness=0.3, emission="#ffe7a0", strength=2.0)
        gold = self._mat("halogold", "#f2b83c", metallic=0.6, roughness=0.3)
        g = Vector((-0.3, -0.09, 0.84))
        self.add(kit.box("SwordGuard", g, (0.16, 0.03, 0.025), gold, bevel=0.005), HAND["R"])
        self.add(kit.tube("SwordGrip", g, g - Vector((0, 0, 0.1)), [(0, 0.014, 0.014), (1, 0.014, 0.014)], gold, seg=6), HAND["R"])
        tip = g + Vector((-0.02, -0.02, 0.85))
        self.add(kit.tube("SwordBlade", g, tip, [(0, 0.035, 0.008), (0.85, 0.03, 0.008), (1, 0.002, 0.002)], ivory, seg=4), HAND["R"])
        self.add(kit.tube("SwordCore", g + Vector((0, -0.009, 0.02)), tip + Vector((0, -0.009, -0.06)), [(0, 0.006, 0.003), (1, 0.003, 0.002)], core, seg=4), HAND["R"])

    def kite_shield(self):
        gold = self._mat("halogold", "#f2b83c", metallic=0.6, roughness=0.3)
        core = self._mat("bladecore", "#fffdf2", roughness=0.3, emission="#ffe7a0", strength=2.0)
        c = Vector((0.33, -0.08, 1.05))
        pts = [c + Vector(v) for v in [(0, 0, 0.17), (0.0, 0, 0.0), (0, 0, -0.2)]]
        self.add(kit.chain("Shield", pts, [(0.11, 0.025), (0.12, 0.03), (0.01, 0.02)], gold, seg=4), FORE["L"])
        self.add(kit.tube("ShieldCrossV", c + Vector((0, -0.03, 0.14)), c + Vector((0, -0.03, -0.14)), [(0, 0.008, 0.004), (1, 0.008, 0.004)], core, seg=4), FORE["L"])
        self.add(kit.tube("ShieldCrossH", c + Vector((-0.07, -0.03, 0.04)), c + Vector((0.07, -0.03, 0.04)), [(0, 0.008, 0.004), (1, 0.008, 0.004)], core, seg=4), FORE["L"])

    # ---- tide -------------------------------------------------------------------------------------------
    def coral_clip(self):
        coral = self._mat("coral", "#ff9a6a", roughness=0.5)
        self.add(kit.blob("CoralClip", Vector((0.08, 0.01, 1.74)), (0.022, 0.018, 0.022), coral, (10, 8)), HEAD)

    def wrist_rings(self):
        water = self._mat("waterring", "#bff2ff", roughness=0.2, emission="#7fe8ff", strength=0.8)
        for side, sx in SIDES:
            p = Vector((0.28 * sx, -0.045, 0.98))
            self.add(kit.torus(f"WaterRing{side}", p, 0.05, 0.011, water, seg=(24, 8)), FORE[side])

    def water_sashes(self):
        water = self._mat("watersash", "#1f9fd6", roughness=0.35, alpha=0.85)
        foam = self._mat("foam", "#eaf8fb", roughness=0.6)
        for k, (z0, z1, r, turns, ph) in enumerate([(1.2, 0.85, 0.32, 0.9, 0.0), (0.7, 0.35, 0.38, 0.8, 2.6)]):
            pts = []
            for i in range(22):
                t = i / 21
                a = ph + t * turns * 2 * math.pi
                z = z0 + (z1 - z0) * t + 0.05 * math.sin(t * 6)
                pts.append(Vector((r * math.cos(a), r * 0.85 * math.sin(a), z)))
            self.add(kit.chain(f"Sash{k}", pts, [(0.032, 0.012)] * len(pts), water, seg=6), PELVIS)
            self.add(kit.blob(f"SashFoam{k}", pts[-1], (0.03, 0.03, 0.02), foam, (8, 6)), PELVIS)


    # ---- sky --------------------------------------------------------------------------------------------
    def wind_scarf(self):
        """A long mint scarf wrapped at the neck, its tail streaming out to his right and back as if in wind."""
        mint = self._mat("scarf", "#7fe6c8", roughness=0.6, double_sided=True)
        self.add(kit.torus("ScarfWrap", Vector((0, 0.0, 1.5)), 0.085, 0.03, mint, seg=(24, 8)), CHEST)
        pts = []
        for i in range(14):
            t = i / 13
            pts.append(Vector((-0.06 - 0.75 * t, 0.06 + 0.25 * t, 1.5 - 0.08 * t + 0.07 * math.sin(t * 7))))
        self.add(kit.chain("ScarfTail", pts, [(0.05, 0.012)] * len(pts), mint, seg=6), CHEST)

    def curved_sword(self):
        """A slim curved sword held low in his right hand, pale steel with a mint edge."""
        steel = self._mat("blade", "#eef3f6", metallic=0.7, roughness=0.25)
        edge = self._mat("bladeedge", "#7fe6c8", roughness=0.4, emission="#7fe6c8", strength=1.2)
        grip = self._mat("swordgrip", "#0d2a2a", roughness=0.6)
        g = Vector((-0.3, -0.1, 0.84))
        self.add(kit.tube("SwordGrip", g + Vector((0, 0, 0.1)), g, [(0, 0.014, 0.014), (1, 0.014, 0.014)], grip, seg=6), HAND["R"])
        self.add(kit.torus("SwordGuard", g, 0.03, 0.008, edge, seg=(16, 6)), HAND["R"])
        blade = [g + Vector((-0.06 * math.sin(t * 1.3), -0.02 - 0.1 * t * t, -0.72 * t)) for t in [i / 8 for i in range(9)]]
        self.add(kit.chain("SwordBlade", blade, [(0.022, 0.006)] * 8 + [(0.002, 0.002)], steel, seg=4), HAND["R"])
        self.add(kit.chain("SwordEdge", [b + Vector((0.012, 0, 0)) for b in blade[1:-1]], [0.004] * 7, edge, seg=4), HAND["R"])

    # ---- bone -------------------------------------------------------------------------------------------
    def bone_hood(self):
        """A deep grave hood open at the face, with a thin teal edge."""
        cloth = self._mat("hood", "#3a4442", roughness=0.9, double_sided=True)
        edge = self._mat("hoodedge", "#3fd8b8", roughness=0.5, emission="#3fd8b8", strength=0.8)
        top = Vector((0, 0.02, 1.64))
        face = lambda co: not (co.y < -0.04 and abs(co.x) < 0.075 and -0.11 < co.z < 0.06)  # noqa: E731
        self.add(kit.blob("Hood", top + Vector((0, 0.012, 0.015)), (0.115, 0.125, 0.135), cloth, (24, 16), keep=face), HEAD)
        rim = [top + Vector((0.08 * math.sin(a), -0.12, 0.012 + 0.1 * math.cos(a))) for a in [i * math.pi / 8 - math.pi * 0.65 for i in range(15)]]
        self.add(kit.chain("HoodEdge", rim, [0.006] * len(rim), edge, seg=5), HEAD)
        self.add(kit.blob("HoodDrape", Vector((0, 0.06, 1.47)), (0.16, 0.1, 0.07), cloth, (16, 10)), CHEST)

    def rib_mantle(self):
        """A ribcage worn over the chest: a sternum and three pairs of curved ribs of uneven length."""
        bone = self._mat("bone", "#ece4d0", roughness=0.75)
        self.add(kit.tube("Sternum", Vector((0, -0.16, 1.44)), Vector((0, -0.17, 1.2)), [(0, 0.02, 0.012), (1, 0.016, 0.01)], bone, seg=6), CHEST)
        for k, (z, w, d) in enumerate([(1.42, 0.17, 0.045), (1.34, 0.16, 0.04), (1.26, 0.14, 0.036)]):
            for side, sx in SIDES:
                pts = [Vector((0.015 * sx, -0.165, z)), Vector((w * 0.55 * sx, -0.16, z - 0.012)), Vector((w * 1.02 * sx, -0.1, z - 0.045)),
                       Vector((w * 1.1 * sx, -0.02, z - 0.08))]
                self.add(kit.chain(f"Rib{side}{k}", pts, [0.018, 0.017, 0.015, 0.01], bone, seg=6), CHEST)

    def shoulder_skulls(self):
        bone = self._mat("bone", "#ece4d0", roughness=0.75)
        soul = self._mat("soulfire", "#3fd8b8", roughness=0.4, emission="#3fd8b8", strength=2.0)
        dark = self._mat("socket", "#1c140c", roughness=0.9)
        for side, sx in SIDES:
            c = Vector((0.21 * sx, -0.02, 1.5))
            self.add(kit.blob(f"ShoulderSkull{side}", c, (0.07, 0.075, 0.065), bone, (14, 10)), ARM[side])
            self.add(kit.box(f"ShoulderJaw{side}", c + Vector((0, -0.035, -0.045)), (0.06, 0.035, 0.025), bone, bevel=0.006), ARM[side])
            for ex in (-0.02, 0.02):
                e = c + Vector((ex, -0.05, 0.005))
                self.add(kit.blob(f"ShoulderSocket{side}{ex}", e, (0.014, 0.008, 0.014), dark, (8, 6)), ARM[side])
                self.add(kit.blob(f"ShoulderEye{side}{ex}", e + Vector((0, -0.004, 0)), (0.007, 0.005, 0.007), soul, (6, 4)), ARM[side])

    def skull_staff(self):
        """A bone staff in his right hand topped with a skull whose eyes burn with teal soulfire."""
        bone = self._mat("bone", "#ece4d0", roughness=0.75)
        soul = self._mat("soulfire", "#3fd8b8", roughness=0.4, emission="#3fd8b8", strength=2.0)
        dark = self._mat("socket", "#1c140c", roughness=0.9)
        a, b = Vector((-0.31, -0.11, 0.05)), Vector((-0.33, -0.13, 1.84))
        self.add(kit.tube("Staff", a, b, [(0, 0.016, 0.016), (1, 0.018, 0.018)], bone, seg=8), HAND["R"])
        for k, z in enumerate((0.6, 1.1, 1.5)):
            q = a.lerp(b, (z - a.z) / (b.z - a.z))
            self.add(kit.torus(f"StaffKnuckle{k}", q, 0.022, 0.009, bone, seg=(14, 6)), HAND["R"])
        sk = b + Vector((0, 0, 0.075))
        self.add(kit.blob("StaffSkull", sk, (0.07, 0.075, 0.07), bone, (16, 12)), HAND["R"])
        self.add(kit.box("StaffJaw", sk + Vector((0, -0.035, -0.06)), (0.075, 0.045, 0.03), bone, bevel=0.008), HAND["R"])
        for ex in (-0.026, 0.026):
            e = sk + Vector((ex, -0.062, 0.008))
            self.add(kit.blob(f"StaffSocket{ex}", e, (0.018, 0.01, 0.018), dark, (8, 6)), HAND["R"])
            self.add(kit.blob(f"StaffEye{ex}", e + Vector((0, -0.005, 0)), (0.01, 0.006, 0.01), soul, (6, 4)), HAND["R"])

    # ---- clockwork --------------------------------------------------------------------------------------
    def _gear(self, name, c, radius, teeth, thick, body, hub, bone, axis=(0, 1, 0)):
        self.add(kit.torus(f"{name}Rim", c, radius * 0.82, radius * 0.16, body, seg=(32, 8), axis=axis), bone)
        self.add(kit.blob(f"{name}Hub", c, (radius * 0.28, radius * 0.28, radius * 0.28), hub, (12, 8)), bone)
        for k in range(teeth):
            ang = k * 2 * math.pi / teeth
            d = Vector((math.cos(ang), 0, math.sin(ang)))
            self.add(kit.box(f"{name}Tooth{k}", c + d * radius, (radius * 0.22, thick, radius * 0.22), body, bevel=0.002,
                             rotation=Euler((0, -ang, 0))), bone)
        for k in range(4):
            ang = k * math.pi / 2 + 0.4
            d = Vector((math.cos(ang), 0, math.sin(ang)))
            self.add(kit.tube(f"{name}Spoke{k}", c + d * radius * 0.25, c + d * radius * 0.72,
                              [(0, radius * 0.07, radius * 0.07), (1, radius * 0.06, radius * 0.06)], body, seg=5), bone)

    def gear_backpack(self):
        """A backpack of meshing brass and copper gears on her back."""
        brass = self._mat("brass", "#c9a24a", metallic=0.7, roughness=0.35)
        copper = self._mat("copper", "#d9773a", metallic=0.7, roughness=0.35)
        iron = self._mat("iron", "#1a0f08", metallic=0.5, roughness=0.6)
        self.add(kit.box("Pack", Vector((0, 0.15, 1.3)), (0.24, 0.08, 0.28), iron, bevel=0.02), CHEST)
        self._gear("GearBig", Vector((-0.13, 0.2, 1.52)), 0.17, 12, 0.035, brass, iron, CHEST)
        self._gear("GearSmall", Vector((0.17, 0.2, 1.6)), 0.1, 9, 0.035, copper, iron, CHEST)
        self._gear("GearLow", Vector((0.08, 0.2, 1.2)), 0.06, 8, 0.03, brass, iron, CHEST)

    def goggles(self):
        brass = self._mat("brass", "#c9a24a", metallic=0.7, roughness=0.35)
        lens = self._mat("lens", "#6affea", roughness=0.1, emission="#6affea", strength=1.5)
        strap = self._mat("strap", "#2a1a10", roughness=0.8)
        self.add(kit.torus("GoggleStrap", Vector((0, 0.01, 1.72)), 0.1, 0.008, strap, seg=(28, 6)), HEAD)
        for ex in (-0.04, 0.04):
            c = Vector((ex, -0.09, 1.74))
            self.add(kit.torus(f"Goggle{ex}", c, 0.028, 0.009, brass, seg=(16, 6)), HEAD)
            self.add(kit.blob(f"GoggleLens{ex}", c, (0.022, 0.006, 0.022), lens, (10, 6)), HEAD)

    def wrist_launcher(self):
        """A spring-loaded launcher on her left forearm: a brass box, a coiled steel spring and a cyan lens."""
        brass = self._mat("brass", "#c9a24a", metallic=0.7, roughness=0.35)
        steel = self._mat("steel", "#d8dde2", metallic=0.8, roughness=0.3)
        lens = self._mat("lens", "#6affea", roughness=0.1, emission="#6affea", strength=1.5)
        c = Vector((0.28, -0.06, 1.02))
        self.add(kit.box("Launcher", c, (0.07, 0.09, 0.07), brass, bevel=0.01), FORE["L"])
        self.add(kit.blob("LauncherLens", c + Vector((0, -0.05, 0)), (0.022, 0.008, 0.022), lens, (10, 6)), FORE["L"])
        coil = [c + Vector((0.045 + 0.02 * math.cos(t * 10), 0.02 * math.sin(t * 10), -0.03 - 0.1 * t)) for t in [i / 24 for i in range(25)]]
        self.add(kit.chain("LauncherSpring", coil, [0.005] * len(coil), steel, seg=5), FORE["L"])


    # ---- prism ------------------------------------------------------------------------------------------
    def _crystal(self, name, c, d, length, width, mat, bone):
        """An elongated octahedron crystal centred at c along direction d."""
        d = d.normalized()
        self.add(kit.tube(name, c - d * length * 0.5, c + d * length * 0.5,
                          [(0, 0.001, 0.001), (0.45, width, width), (1, 0.001, 0.001)], mat, seg=4, smooth=False), bone)

    def prism_ring(self):
        glass = self._mat("prismglass", "#b8b0ff", roughness=0.15, emission="#b8b0ff", strength=0.6)
        c = Vector((0, 0.1, 1.68))
        for k in range(7):
            ang = math.pi * (0.1 + 0.8 * k / 6)
            p = c + Vector((math.cos(ang) * 0.24, 0, math.sin(ang) * 0.24))
            self._crystal(f"HaloPrism{k}", p, Vector((math.cos(ang), 0, math.sin(ang))), 0.09, 0.022, glass, HEAD)

    def crystal_epaulettes(self):
        glass = self._mat("prismglass", "#b8b0ff", roughness=0.15, emission="#b8b0ff", strength=0.6)
        for side, sx in SIDES:
            base = Vector((0.2 * sx, 0.0, 1.5))
            for k, (out, up, ln) in enumerate([(0.9, 0.4, 0.16), (0.6, 0.8, 0.13), (1.0, 0.0, 0.11)]):
                d = Vector((out * sx, 0.05 * (k - 1), up))
                self._crystal(f"Epaulette{side}{k}", base + d.normalized() * ln * 0.5, d, ln, 0.03, glass, ARM[side])

    def crystal_wand(self):
        dark = self._mat("wand", "#14102a", roughness=0.5)
        glass = self._mat("wandtip", "#f0f4ff", roughness=0.1, emission="#d8d0ff", strength=1.6)
        a, b = Vector((-0.3, -0.1, 0.86)), Vector((-0.34, -0.2, 1.3))
        self.add(kit.tube("Wand", a, b, [(0, 0.012, 0.012), (1, 0.008, 0.008)], dark, seg=6), HAND["R"])
        self._crystal("WandTip", b + (b - a).normalized() * 0.06, b - a, 0.14, 0.03, glass, HAND["R"])

    def spectral_sash(self):
        for k, col in enumerate(("#ff5a6a", "#ffd24a", "#5ab8ff")):
            m = self._mat(f"band{k}", col, roughness=0.4, emission=col, strength=0.5)
            self.add(kit.torus(f"SpectrumBand{k}", Vector((0, 0.0, 1.06 - 0.022 * k)), 0.17, 0.006, m, seg=(32, 5)), PELVIS)

    # ---- hive -------------------------------------------------------------------------------------------
    def insect_helm(self):
        chitin = self._mat("chitin", "#1c1608", roughness=0.35, metallic=0.3)
        amber = self._mat("amber", "#f0b020", roughness=0.3, metallic=0.4)
        lens = self._mat("lens", "#ffd24a", roughness=0.1, emission="#ffb020", strength=1.6)
        top = Vector((0, 0.0, 1.66))
        face = lambda co: not (co.y < -0.06 and abs(co.x) < 0.05 and co.z < -0.04)  # noqa: E731
        self.add(kit.blob("Helm", top + Vector((0, 0.005, 0.01)), (0.115, 0.125, 0.13), chitin, (24, 16), keep=face), HEAD)
        for sx in (-1, 1):
            self.add(kit.blob(f"HelmEye{sx}", top + Vector((0.05 * sx, -0.1, 0.0)), (0.035, 0.02, 0.026), lens, (12, 8)), HEAD)
            crest = [top + Vector(v) for v in [(0.03 * sx, -0.02, 0.11), (0.08 * sx, 0.0, 0.2), (0.14 * sx, 0.03, 0.25)]]
            self.add(kit.chain(f"HelmCrest{sx}", crest, [0.018, 0.012, 0.004], amber, seg=6), HEAD)
            mand = [top + Vector(v) for v in [(0.04 * sx, -0.09, -0.09), (0.03 * sx, -0.12, -0.13), (0.008 * sx, -0.12, -0.15)]]
            self.add(kit.chain(f"Mandible{sx}", mand, [0.012, 0.009, 0.003], amber, seg=5), HEAD)

    def hex_pauldrons(self):
        chitin = self._mat("chitin", "#1c1608", roughness=0.35, metallic=0.3)
        amber = self._mat("amber", "#f0b020", roughness=0.3, metallic=0.4)
        for side, sx in SIDES:
            c = Vector((0.22 * sx, 0.0, 1.49))
            self.add(kit.blob(f"Pauldron{side}", c, (0.1, 0.1, 0.06), chitin, (6, 6), smooth=False), ARM[side])
            self.add(kit.torus(f"PauldronRim{side}", c + Vector((0, 0, 0.01)), 0.1, 0.012, amber, seg=(6, 4)), ARM[side])

    def claw_gauntlets(self):
        chitin = self._mat("chitin", "#1c1608", roughness=0.35, metallic=0.3)
        amber = self._mat("amber", "#f0b020", roughness=0.3, metallic=0.4)
        for side, sx in SIDES:
            w = Vector((0.3 * sx, -0.06, 0.86))
            self.add(kit.blob(f"Gauntlet{side}", w + Vector((0, 0, 0.06)), (0.05, 0.05, 0.08), chitin, (10, 8)), HAND[side])
            for k, (dx, ln) in enumerate([(-0.025, 0.2), (0.0, 0.26), (0.025, 0.2)]):
                pts = [w + Vector((dx * sx, -0.01, 0)), w + Vector((dx * sx * 1.4, -0.06, -ln * 0.6)), w + Vector((dx * sx * 1.2, -0.04, -ln))]
                self.add(kit.chain(f"Claw{side}{k}", pts, [0.016, 0.011, 0.002], amber, seg=5), HAND[side])

    def wing_cloak(self):
        wing = self._mat("wing", "#f6e6b0", roughness=0.3, alpha=0.35, double_sided=True)
        vein = self._mat("wingvein", "#2a2010", roughness=0.6)
        for side, sx in SIDES:
            c = Vector((0.2 * sx, 0.16, 1.05))
            self.add(kit.blob(f"Wing{side}", c, (0.17, 0.012, 0.42), wing, (12, 8), rotation=Euler((0, 0.22 * sx, 0))), CHEST)
            self.add(kit.tube(f"WingVein{side}", Vector((0.06 * sx, 0.15, 1.42)), Vector((0.3 * sx, 0.16, 0.7)),
                              [(0, 0.006, 0.006), (1, 0.003, 0.003)], vein, seg=4), CHEST)

    def amber_stripes(self):
        amber = self._mat("amber", "#f0b020", roughness=0.3, metallic=0.4)
        for k, (z, r) in enumerate([(0.62, 0.25), (0.46, 0.28), (0.3, 0.31)]):
            self.add(kit.torus(f"Stripe{k}", Vector((0, 0.01, z)), r, 0.018, amber, seg=(32, 6)), PELVIS)

    # ---- bard -------------------------------------------------------------------------------------------
    def feathered_hat(self):
        plum = self._mat("hat", "#5a1a4a", roughness=0.7, double_sided=True)
        rose = self._mat("feather", "#e04aa8", roughness=0.6, double_sided=True)
        gold = self._mat("hatband", "#ffd24a", metallic=0.6, roughness=0.35)
        top = Vector((0, 0.01, 1.74))
        self.add(kit.torus("HatBrim", top, 0.15, 0.02, plum, seg=(32, 6)), HEAD)
        self.add(kit.blob("HatBrimFill", top, (0.15, 0.15, 0.008), plum, (24, 6)), HEAD)
        self.add(kit.blob("HatCrown", top + Vector((0, 0, 0.05)), (0.09, 0.09, 0.07), plum, (16, 10)), HEAD)
        self.add(kit.torus("HatBand", top + Vector((0, 0, 0.02)), 0.088, 0.008, gold, seg=(24, 5)), HEAD)
        pts = [top + Vector(v) for v in [(0.06, 0.02, 0.06), (0.12, 0.05, 0.13), (0.2, 0.09, 0.17), (0.27, 0.13, 0.16)]]
        self.add(kit.chain("Feather", pts, [(0.012, 0.004), (0.03, 0.005), (0.026, 0.004), (0.004, 0.002)], rose, seg=6), HEAD)

    def note_scarf(self):
        parch = self._mat("scarf", "#f2e6d0", roughness=0.7, double_sided=True)
        ink = self._mat("ink", "#1e0a1a", roughness=0.6)
        self.add(kit.torus("ScarfWrap", Vector((0, 0.0, 1.5)), 0.085, 0.028, parch, seg=(24, 8)), CHEST)
        pts = [Vector((0.05 + 0.5 * t, 0.05 + 0.18 * t, 1.5 - 0.1 * t + 0.05 * math.sin(t * 6))) for t in [i / 11 for i in range(12)]]
        self.add(kit.chain("ScarfTail", pts, [(0.045, 0.01)] * 12, parch, seg=6), CHEST)
        for k in (3, 6, 9):
            p = pts[k] + Vector((0, -0.012, 0))
            self.add(kit.blob(f"ScarfNote{k}", p, (0.012, 0.004, 0.009), ink, (8, 4)), CHEST)

    def golden_lyre(self):
        gold = self._mat("lyre", "#ffd24a", metallic=0.7, roughness=0.3)
        string = self._mat("lyrestring", "#f2e6d0", roughness=0.4, emission="#ffd24a", strength=0.6)
        c = Vector((0.33, -0.14, 0.98))
        for sx in (-1, 1):
            arm = [c + Vector(v) for v in [(0.03 * sx, 0, -0.1), (0.07 * sx, 0, 0.0), (0.06 * sx, 0, 0.1), (0.035 * sx, 0, 0.16)]]
            self.add(kit.chain(f"LyreArm{sx}", arm, [0.012, 0.012, 0.01, 0.008], gold, seg=6), HAND["L"])
        self.add(kit.tube("LyreBar", c + Vector((-0.045, 0, 0.14)), c + Vector((0.045, 0, 0.14)), [(0, 0.008, 0.008), (1, 0.008, 0.008)], gold, seg=6), HAND["L"])
        self.add(kit.tube("LyreBase", c + Vector((-0.035, 0, -0.1)), c + Vector((0.035, 0, -0.1)), [(0, 0.012, 0.012), (1, 0.012, 0.012)], gold, seg=6), HAND["L"])
        for k in range(4):
            x = -0.024 + 0.016 * k
            self.add(kit.tube(f"LyreString{k}", c + Vector((x, 0, -0.1)), c + Vector((x, 0, 0.14)), [(0, 0.0025, 0.0025), (1, 0.0025, 0.0025)], string, seg=4), HAND["L"])


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
