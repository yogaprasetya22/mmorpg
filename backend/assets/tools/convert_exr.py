"""
Blender batch converter: EXR → HDR (skybox) + EXR → PNG (terrain PBR maps)
Run with: blender --background --python convert_exr.py
"""
import bpy
import os

BASE = os.path.dirname(os.path.abspath(__file__))

CONVERSIONS = [
    # Skybox HDRIs → HDR
    (
        os.path.join(BASE, "Textures/qwantani_night_1k.exr"),
        os.path.join(BASE, "Textures/qwantani_night_1k.hdr"),
        "HDR",
    ),
    (
        os.path.join(BASE, "Textures/qwantani_sunset_1k.exr"),
        os.path.join(BASE, "Textures/qwantani_sunset_1k.hdr"),
        "HDR",
    ),
    # Terrain PBR normal/roughness → PNG
    (
        os.path.join(BASE, "Textures/Textures/texture_1/textures/marble_cliff_03_nor_gl_1k.exr"),
        os.path.join(BASE, "Textures/Textures/texture_1/textures/marble_cliff_03_nor_gl_1k.png"),
        "PNG",
    ),
    (
        os.path.join(BASE, "Textures/Textures/texture_1/textures/marble_cliff_03_rough_1k.exr"),
        os.path.join(BASE, "Textures/Textures/texture_1/textures/marble_cliff_03_rough_1k.png"),
        "PNG",
    ),
    (
        os.path.join(BASE, "Textures/Textures/texture_2/textures/rocky_terrain_02_nor_gl_1k.exr"),
        os.path.join(BASE, "Textures/Textures/texture_2/textures/rocky_terrain_02_nor_gl_1k.png"),
        "PNG",
    ),
    (
        os.path.join(BASE, "Textures/Textures/texture_2/textures/rocky_terrain_02_rough_1k.exr"),
        os.path.join(BASE, "Textures/Textures/texture_2/textures/rocky_terrain_02_rough_1k.png"),
        "PNG",
    ),
]

for inp, out, fmt in CONVERSIONS:
    if not os.path.exists(inp):
        print(f"[SKIP] Not found: {inp}")
        continue
    name = os.path.basename(inp)
    print(f"[CONVERT] {name} → {os.path.basename(out)}")

    # Remove stale image block if it exists
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])

    bpy.ops.image.open(filepath=inp)
    img = bpy.data.images[name]

    # Force pixels to load into memory
    img.pixels[0]  # accessing pixels forces a full load

    img.filepath_raw = out
    img.file_format = fmt
    img.save()
    bpy.data.images.remove(img)
    print(f"[OK] Saved: {out}")

print("[DONE] All conversions complete.")
