"""
Shared helpers for the weapon models (blender/weapons/wp-*.py). They reuse the Dao Archive modelling kit
(C:\\projectG\\xianxia\\blender: kit, _azure_common, _treasure_common) read-only, and export into this
repo's public/models/weapons/ instead of the game's manifest.

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\weapons")
    import _wp; importlib.reload(_wp)
    _wp.run("wp-sword-dragon")                 # build, preview, export, then clear it from the scene
    _wp.run("wp-sword-dragon", export_it=False)   # build and preview only (stays in the scene)

Weapon convention (what the VFX step attaches to):
    metres, z up; origin = the centre of the grip (where the hand holds it);
    the blade / head points along +Z; the flat of a blade faces -Y (Blender's Front view), width along X.
"""
import importlib
import importlib.util
import os
import sys

XB = r"C:\projectG\xianxia\blender"
for _p in (XB, os.path.join(XB, "props")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import bpy  # noqa: E402

import kit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "models", "weapons")
PREVIEWS = os.path.join(ROOT, "docs", "weapons")


# --------------------------------------------------------------------------------------- palette
def mats(wid, **colors):
    """The usual weapon materials, named '<id>_<part>'. Override a colour with part='#hex'."""
    c = {"gold": "#c9a24a", "steel": "#dbe5ec", "jade": "#3fb8a8", "glow": "#8ff5ff", "grip": "#d6ddd8",
         "dark": "#2a2f2c", "tassel": "#7fd8d0", **colors}
    return {
        "gold": kit.material(f"{wid}_gold", c["gold"], metallic=1.0, roughness=0.28),
        "steel": kit.material(f"{wid}_steel", c["steel"], metallic=1.0, roughness=0.16, coat=0.4),
        "jade": kit.material(f"{wid}_jade", c["jade"], roughness=0.2, coat=0.8, emission=c["jade"], strength=0.45),
        "gem": kit.material(f"{wid}_gem", c["glow"], roughness=0.1, coat=1.0, emission=c["glow"], strength=3.0),
        "glow": kit.material(f"{wid}_glow", c["glow"], roughness=0.3, emission=c["glow"], strength=6.0),
        "grip": kit.material(f"{wid}_grip", c["grip"], roughness=0.45, coat=0.3),
        "dark": kit.material(f"{wid}_dark", c["dark"], metallic=0.6, roughness=0.45),
        "tassel": kit.material(f"{wid}_tassel", c["tassel"], roughness=0.8, sheen=0.8),
    }


# ----------------------------------------------------------------------------------------- build
def _module(wid):
    path = os.path.join(HERE, f"{wid}.py")
    spec = importlib.util.spec_from_file_location(wid.replace("-", "_"), path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _reload():
    import _azure_common
    import _treasure_common
    import _beast_common
    for m in (kit, _azure_common, _treasure_common, _beast_common):
        importlib.reload(m)


def build(wid):
    _reload()
    coll = _module(wid).build()
    # the joined object (the glTF node) and its mesh carry the weapon's id
    meshes = [o for o in coll.all_objects if o.type == "MESH"]
    if len(meshes) == 1:
        meshes[0].name = meshes[0].data.name = wid
    return coll


def preview(wid, views=(0, 35, 90), lens=50, size=720, tag=""):
    os.makedirs(PREVIEWS, exist_ok=True)
    return kit.preview(wid, name=f"{wid}{tag}", views=views, elevation=8, size=size, out_dir=PREVIEWS, lens=lens)


def export(wid):
    """Write public/models/weapons/<id>.glb (plain glTF: no Draco, no meshopt)."""
    import dao_blender as dao
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{wid}.glb")
    objs = [o for o in bpy.data.collections[wid].all_objects]
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                export_animations=False, export_cameras=False, export_lights=False,
                export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=False)
    return path


def clear(wid, meshes_before):
    """Delete the weapon's collection and only the data it created (the shared scene is not purged)."""
    kit.clear(wid)
    for me in [m for m in bpy.data.meshes if m.users == 0 and m.name not in meshes_before]:
        bpy.data.meshes.remove(me)
    for ma in [m for m in bpy.data.materials if m.users == 0 and m.name.startswith(wid + "_")]:
        bpy.data.materials.remove(ma)


def run(wid, export_it=True, previews=True, keep=False, **kw):
    before = {m.name for m in bpy.data.meshes}
    build(wid)
    out = {"stats": kit.stats(wid)}
    if previews:
        out["previews"] = preview(wid, **kw)
    if export_it:
        out["glb"] = export(wid)
        out["mb"] = round(os.path.getsize(out["glb"]) / 1e6, 2)
        if not keep:
            clear(wid, before)
    return out
