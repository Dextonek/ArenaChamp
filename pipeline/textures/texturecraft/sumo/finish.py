"""Big Yoko for TextureCraft, step 4 (Blender, headless): puts TextureCraft's textures on the hero and writes the GLB.

    blender --background --factory-startup --python pipeline/textures/texturecraft/sumo/finish.py -- <work folder> <out.glb>

Reads <work folder>/sumo_prep.blend (prep.py: the same atlas UVs TextureCraft painted on) and, when they are there, the
textures paint.json exported into <work folder>/tex:
- costume_color.png: the costume's colour (the palette's own colours, with the baked shadow and the gold edges in it);
- skin_color.png: the skin texture with the painted underwear covered.
Each costume material keeps its name, its roughness, metalness and emission (the crest); only its colour now comes from
the atlas (colour factor white). The two textures are encoded here as JPEG at the size and quality in `JPEG` (the budget
is 300-600 KB a hero), and the exporter embeds those files as they are. Exported as the build does (`Real.finish`):
meshopt, the skeleton as it is. Without the textures it writes the hero with only the new UVs (to measure their cost).
"""
import os
import sys

import bpy

COSTUME = ("sumo_crimson", "sumo_rope", "sumo_gold", "sumo_twist", "sumo_crest", "sumo_paper", "sumo_lacquer")
# texture: (size in px, JPEG quality)
JPEG = {"costume_color": (512, 80), "skin_color": (1024, 80)}


def jpeg(src, name, work):
    size, q = JPEG[name]
    img = bpy.data.images.load(src)
    if img.size[0] != size:
        img.scale(size, size)
    sc = bpy.context.scene
    # save_render passes the pixels through the scene's view transform (AgX by default in Blender 5), which paled the
    # skin and the cloth; Standard writes them as they are
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.quality = q
    os.makedirs(os.path.join(work, "jpg"), exist_ok=True)
    out = os.path.join(work, "jpg", name + ".jpg")
    img.save_render(out, scene=sc)
    bpy.data.images.remove(img)
    j = bpy.data.images.load(out)
    j.name = name
    print(f"JPEG {name} {size} px q{q}: {round(os.path.getsize(out) / 1024)} KB")
    return j


def centre_swatches(body):
    """The swatch materials (prep.SWATCH) get their swatch's middle as the one UV of every vertex. TextureCraft painted
    them with the UVs spread over the swatch (a triangle must cover texels to be painted), but spread UVs on small
    triangles make the GPU take small mip levels, where the swatch bleeds into the black around it: the gold went from
    #d2ac5a to #7b6539 at 32 px. One UV for all: the exact colour at every distance, and still no vertex added."""
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "prep.py"), encoding="utf-8").read()
    consts = {}
    for line in src.splitlines():  # read the constants without running prep's main()
        if line.startswith(("SWATCH =", "ATLAS_U =", "SW =")):
            exec(line, consts)
    me = body.data
    uv = me.uv_layers[0].data
    names = [m.name for m in me.materials]
    for name, row in consts["SWATCH"].items():
        idx = names.index(name)
        u = consts["ATLAS_U"] + 0.008 + consts["SW"] * 0.5
        v = 0.01 + row * (consts["SW"] + 0.025) + consts["SW"] * 0.5
        for p in me.polygons:
            if p.material_index == idx:
                for li in p.loop_indices:
                    uv[li].uv = (u, v)
    print("SWATCHES centred:", ", ".join(consts["SWATCH"]))


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    work, out = os.path.abspath(args[0]), os.path.abspath(args[1])
    bpy.ops.wm.open_mainfile(filepath=os.path.join(work, "sumo_prep.blend"))
    tex = os.path.join(work, "tex")
    have = os.path.exists(os.path.join(tex, "costume_color.png"))
    if have:
        color = jpeg(os.path.join(tex, "costume_color.png"), "costume_color", work)
        for mat in bpy.data.materials:
            if mat.name in COSTUME:
                nt = mat.node_tree
                bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
                node = nt.nodes.new("ShaderNodeTexImage")
                node.image = color
                bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
                nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        skin_path = os.path.join(tex, "skin_color.png")
        if os.path.exists(skin_path):
            mat = bpy.data.materials["MI_Superhero_Male"]
            node = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
            node.image = jpeg(skin_path, "skin_color", work)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    if have:
        centre_swatches(body)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig
    # AUTO keeps each image in the format it has: the JPEGs written above are embedded as they are
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True,
                              export_animations=False, export_skins=True, export_cameras=False, export_lights=False,
                              export_image_format="AUTO", export_image_quality=80,
                              export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
                              export_vertex_color="NONE")
    print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB, textures: {'yes' if have else 'no (UVs only)'}")


main()
