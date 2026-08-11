from __future__ import annotations

import json
import math
import struct
import sys
import zlib
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = PROJECT_ROOT / "assets" / "3d" / "ff_mbt_01"
TEXTURE_DIR = ASSET_DIR / "textures"
SPRITE_DIR = PROJECT_ROOT / "assets" / "sprites" / "ff_mbt_01"
ASSET_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
SPRITE_DIR.mkdir(parents=True, exist_ok=True)
SKIP_SPRITES = "--skip-sprites" in sys.argv
SKIP_PREVIEW = "--skip-preview" in sys.argv


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


clear_scene()
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.color_depth = "8"
scene.view_settings.look = "AgX - Medium High Contrast"

asset_collection = bpy.data.collections.new("FF_MBT_01_ASSET")
scene.collection.children.link(asset_collection)


def move_to_asset_collection(obj: bpy.types.Object) -> bpy.types.Object:
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    asset_collection.objects.link(obj)
    return obj


def material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission is not None:
        principled.inputs["Emission Color"].default_value = emission
        principled.inputs["Emission Strength"].default_value = emission_strength
    return mat


MAT_GUNMETAL = material("M_Gunmetal", (0.105, 0.125, 0.125, 1), 0.72, 0.32)
MAT_PANEL = material("M_ArmorPanel", (0.105, 0.125, 0.118, 1), 0.42, 0.43)
MAT_DARK = material("M_Recess", (0.012, 0.017, 0.018, 1), 0.3, 0.58)
MAT_RUBBER = material("M_TrackRubber", (0.018, 0.022, 0.021, 1), 0.05, 0.82)
MAT_STEEL = material("M_Steel", (0.235, 0.255, 0.245, 1), 0.82, 0.29)
MAT_AMBER = material("M_AmberArmor", (0.49, 0.19, 0.035, 1), 0.38, 0.44)
MAT_IVORY = material("M_UnitMarking", (0.72, 0.73, 0.66, 1), 0.24, 0.48)
MAT_CYAN = material(
    "M_CyanSignal",
    (0.015, 0.42, 0.52, 1),
    0.15,
    0.25,
    (0.0, 0.72, 0.95, 1),
    4.5,
)
MAT_GROUND = material("M_PreviewGround", (0.19, 0.185, 0.155, 1), 0.0, 0.96)


def hash01(x: int, y: int, seed: int) -> float:
    value = (x * 374761393 + y * 668265263 + seed * 69069) & 0xFFFFFFFF
    value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((value ^ (value >> 16)) & 0xFFFF) / 65535.0


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def value_noise(x: int, y: int, cell_size: int, seed: int) -> float:
    """Bilinear value noise without the square cells visible in the old baseline."""
    cell_x = math.floor(x / cell_size)
    cell_y = math.floor(y / cell_size)
    tx = smoothstep((x / cell_size) - cell_x)
    ty = smoothstep((y / cell_size) - cell_y)
    top = hash01(cell_x, cell_y, seed) * (1.0 - tx) + hash01(cell_x + 1, cell_y, seed) * tx
    bottom = hash01(cell_x, cell_y + 1, seed) * (1.0 - tx) + hash01(cell_x + 1, cell_y + 1, seed) * tx
    return top * (1.0 - ty) + bottom * ty


def write_rgba_png(path: Path, width: int, height: int, pixels: list[float]) -> None:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    rows = bytearray()
    stride = width * 4
    for y in range(height):
        rows.append(0)
        offset = y * stride
        rows.extend(round(max(0.0, min(1.0, value)) * 255) for value in pixels[offset:offset + stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(rows), level=9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


TEXTURE_SIZE = 512


def save_image(name: str, pixels: list[float], colorspace: str) -> bpy.types.Image:
    path = TEXTURE_DIR / f"{name}.png"
    write_rgba_png(path, TEXTURE_SIZE, TEXTURE_SIZE, pixels)
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = colorspace
    return image


def build_validation_pbr(
    mat: bpy.types.Material,
    key: str,
    base_rgb: tuple[float, float, float],
    metallic: float,
    roughness: float,
    seed: int,
) -> None:
    """Create deterministic, exportable validation textures from the asset master.

    The hero baseline uses compact 512px maps. Silhouette and authored geometry do
    the visual work; these maps add restrained material breakup without noisy pixels.
    """
    size = TEXTURE_SIZE
    base_pixels: list[float] = []
    normal_pixels: list[float] = []
    orm_pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            coarse = value_noise(x, y, 34, seed)
            fine = value_noise(x, y, 7, seed + 19)
            broad = value_noise(x, y, 96, seed + 7)
            grime = max(0.0, 0.5 - y / size) * 0.065 + max(0.0, coarse - 0.82) * 0.065
            chip = 0.78 if hash01(x // 3, y // 3, seed + 71) > 0.9975 else 1.0
            scratch_line = (x + y * 3 + seed * 17) % 257
            scratch = 0.9 if scratch_line < 2 and hash01(x // 18, y // 18, seed + 89) > 0.68 else 1.0
            variation = (0.925 + coarse * 0.035 + broad * 0.035 + fine * 0.012 - grime) * chip * scratch
            base_pixels.extend((
                min(1.0, max(0.0, base_rgb[0] * variation)),
                min(1.0, max(0.0, base_rgb[1] * variation)),
                min(1.0, max(0.0, base_rgb[2] * variation)),
                1.0,
            ))

            height_x = (value_noise(x + 1, y, 5, seed + 131) - value_noise(x - 1, y, 5, seed + 131)) * 0.11
            height_y = (value_noise(x, y + 1, 5, seed + 131) - value_noise(x, y - 1, 5, seed + 131)) * 0.11
            nx, ny, nz = -height_x, -height_y, 1.0
            inv_len = 1.0 / math.sqrt(nx * nx + ny * ny + nz * nz)
            normal_pixels.extend((nx * inv_len * 0.5 + 0.5, ny * inv_len * 0.5 + 0.5, nz * inv_len, 1.0))

            local_roughness = min(1.0, max(0.04, roughness + (coarse - 0.5) * 0.16 + grime * 0.6))
            local_metallic = min(1.0, max(0.0, metallic * (0.92 + fine * 0.08)))
            orm_pixels.extend((1.0 - grime * 0.35, local_roughness, local_metallic, 1.0))

    base_image = save_image(f"{key}_basecolor", base_pixels, "sRGB")
    normal_image = save_image(f"{key}_normal", normal_pixels, "Non-Color")
    orm_image = save_image(f"{key}_orm", orm_pixels, "Non-Color")

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = nodes.get("Principled BSDF")
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = f"{key}_BaseColor"
    base_node.image = base_image
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"{key}_Normal"
    normal_node.image = normal_image
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.22
    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = f"{key}_ORM"
    orm_node.image = orm_image
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(base_node.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])


build_validation_pbr(MAT_GUNMETAL, "gunmetal", (0.105, 0.125, 0.12), 0.42, 0.42, 11)
build_validation_pbr(MAT_PANEL, "armor_panel", (0.18, 0.205, 0.19), 0.18, 0.48, 23)
build_validation_pbr(MAT_DARK, "recess", (0.028, 0.036, 0.035), 0.08, 0.7, 37)
build_validation_pbr(MAT_RUBBER, "track_rubber", (0.04, 0.046, 0.043), 0.0, 0.88, 41)
build_validation_pbr(MAT_STEEL, "steel", (0.33, 0.35, 0.34), 0.68, 0.32, 53)
build_validation_pbr(MAT_AMBER, "amber_armor", (0.58, 0.22, 0.035), 0.12, 0.48, 67)


def empty(name: str, location=(0.0, 0.0, 0.0), parent=None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    asset_collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.25
    return obj


def add_box(name, size, location, mat, parent=None, bevel=0.06, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = move_to_asset_collection(bpy.context.object)
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("EdgeBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_cylinder(
    name,
    radius,
    depth,
    location,
    mat,
    parent=None,
    vertices=16,
    rotation=(0.0, 0.0, 0.0),
    bevel=0.025,
):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = move_to_asset_collection(bpy.context.object)
    obj.name = name
    if bevel > 0:
        modifier = obj.modifiers.new("EdgeBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_wedge(name, width, depth, bottom_z, front_top_z, rear_top_z, location, mat, parent=None, bevel=0.04):
    x0, x1 = -width / 2, width / 2
    y0, y1 = -depth / 2, depth / 2
    verts = [
        (x0, y0, bottom_z), (x1, y0, bottom_z), (x1, y1, bottom_z), (x0, y1, bottom_z),
        (x0, y0, front_top_z), (x1, y0, front_top_z), (x1, y1, rear_top_z), (x0, y1, rear_top_z),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    asset_collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(mat)
    if bevel > 0:
        modifier = obj.modifiers.new("EdgeBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    return obj


def add_text_marking(name, text, size, location, mat, parent=None, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = move_to_asset_collection(bpy.context.object)
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.012
    obj.data.bevel_depth = 0.006
    obj.data.materials.append(mat)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.parent = parent
    return obj


def join_wreck_part(name: str, objects: list[bpy.types.Object], parent: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    if len(objects) > 1:
        bpy.ops.object.join()
    active.name = name
    active.parent = parent
    active["wreck_part"] = name
    return active


def build_wreck_visual(parent: bpy.types.Object) -> bpy.types.Object:
    """Build a flattened, recognizable MBT wreck using existing material domains."""
    wreck = empty("wreck_visual_root", parent=parent)
    wreck["presentation_role"] = "wreck_visual"
    wreck["default_visible"] = False
    wreck["runtime_visibility_owner"] = "scene"
    wreck["wreck_profile"] = "battle_tank"

    chassis_parts = [
        add_box("wreck_hull_low", (2.62, 4.08, 0.42), (0, 0.08, 0.38), MAT_DARK, wreck, 0.08, (0.04, -0.08, 0.03)),
        add_box("wreck_glacis_crushed", (2.32, 1.48, 0.32), (-0.08, -1.36, 0.62), MAT_DARK, wreck, 0.06, (0.14, -0.06, -0.05)),
        add_box("wreck_engine_burn", (2.15, 1.05, 0.2), (0.12, 1.38, 0.7), MAT_DARK, wreck, 0.04, (-0.09, 0.12, 0.05)),
    ]
    turret_parts = [
        add_box("wreck_turret_shell", (1.82, 1.7, 0.54), (0.38, -0.12, 0.92), MAT_GUNMETAL, wreck, 0.09, (0.08, 0.17, math.radians(24))),
        add_cylinder("wreck_barrel_broken", 0.13, 2.08, (0.95, -1.15, 0.97), MAT_GUNMETAL, wreck, 12, (math.pi / 2 + 0.12, 0.08, math.radians(-24)), 0.015),
        add_box("wreck_mantlet", (0.68, 0.5, 0.42), (0.55, -0.68, 0.95), MAT_GUNMETAL, wreck, 0.05, (0.08, 0.17, math.radians(24))),
    ]
    track_parts = []
    for side, x in enumerate((-1.4, 1.4)):
        track_parts.append(add_box(f"wreck_track_bed_{side}", (0.58, 4.22, 0.34), (x, 0.02, 0.25), MAT_RUBBER, wreck, 0.06, (0.02, 0.08 if side else -0.05, -0.05 if side else 0.03)))
    for index, (x, y, rz) in enumerate(((-1.52, -1.72, -0.16), (-1.6, -0.76, 0.10), (1.6, 0.62, -0.12), (1.48, 1.58, 0.18))):
        track_parts.append(add_box(f"wreck_track_link_{index}", (0.68, 0.72, 0.13), (x, y, 0.16), MAT_RUBBER, wreck, 0.012, (0.05, 0.12, rz)))

    join_wreck_part("wreck_chassis", chassis_parts, wreck)
    join_wreck_part("wreck_turret", turret_parts, wreck)
    join_wreck_part("wreck_track_debris", track_parts, wreck)
    wreck.hide_render = True
    return wreck


root = empty("FF_MBT_01")
root["asset_id"] = "ff_mbt_01"
root["asset_role"] = "medium_battle_tank"
root["asset_revision"] = "hero-baseline-v3"
root["render_profile"] = "strategic-camera-hero"
chassis = empty("chassis_root", parent=root)
track_left = empty("track_left", parent=chassis)
track_right = empty("track_right", parent=chassis)

# Tracks, six readable road wheels per side, and layered side armor.
wheel_positions = (-1.62, -0.98, -0.34, 0.34, 0.98, 1.62)
for side_name, x, track_parent in (("L", -1.38, track_left), ("R", 1.38, track_right)):
    add_box(f"track_bed_{side_name}", (0.5, 4.45, 0.68), (x, 0.0, 0.62), MAT_RUBBER, track_parent, 0.11)
    add_box(f"track_guard_{side_name}", (0.62, 4.08, 0.24), (x, 0.0, 1.02), MAT_GUNMETAL, track_parent, 0.06)
    for index, y in enumerate(wheel_positions, start=1):
        add_cylinder(
            f"roadwheel_{side_name}_{index:02d}", 0.36, 0.18, (x + (-0.28 if x < 0 else 0.28), y, 0.61),
            MAT_RUBBER, track_parent, 20, (0.0, math.pi / 2, 0.0), 0.02,
        )
        add_cylinder(
            f"hub_{side_name}_{index:02d}", 0.19, 0.2, (x + (-0.385 if x < 0 else 0.385), y, 0.61),
            MAT_STEEL if index % 2 else MAT_GUNMETAL, track_parent, 16, (0.0, math.pi / 2, 0.0), 0.015,
        )
    for index, y in enumerate([-1.95 + i * 0.3 for i in range(14)]):
        add_box(f"tread_top_{side_name}_{index:02d}", (0.61, 0.24, 0.12), (x, y, 1.12), MAT_RUBBER, track_parent, 0.015)
        add_box(f"tread_bottom_{side_name}_{index:02d}", (0.61, 0.24, 0.12), (x, y, 0.18), MAT_RUBBER, track_parent, 0.015)
    # Close the visible track silhouette around both idlers. The large readable
    # tread blocks survive strategic zoom better than a smooth rubber capsule.
    for end_sign in (-1, 1):
        for arc_index, degrees in enumerate((-72, -48, -24, 0, 24, 48, 72)):
            angle = math.radians(degrees)
            y = end_sign * (1.95 + math.cos(angle) * 0.31)
            z = 0.65 + math.sin(angle) * 0.47
            rotation_x = end_sign * angle
            add_box(
                f"tread_arc_{side_name}_{end_sign:+d}_{arc_index:02d}",
                (0.61, 0.24, 0.12),
                (x, y, z),
                MAT_RUBBER,
                track_parent,
                0.012,
                (rotation_x, 0.0, 0.0),
            )

# Grounded, layered hull with a sloped front glacis.
add_box("lower_hull", (2.65, 4.2, 0.48), (0, 0.08, 0.72), MAT_GUNMETAL, chassis, 0.1)
add_box("belly_recess", (2.05, 3.5, 0.22), (0, 0.18, 0.5), MAT_DARK, chassis, 0.05)
add_wedge("front_glacis", 2.45, 1.5, 0.0, 0.28, 0.72, (0, -1.42, 0.94), MAT_PANEL, chassis, 0.07)
add_box("upper_hull", (2.28, 2.25, 0.5), (0, 0.45, 1.28), MAT_PANEL, chassis, 0.1)
add_box("engine_deck", (2.25, 1.05, 0.18), (0, 1.42, 1.58), MAT_GUNMETAL, chassis, 0.05)
for x in (-0.64, 0.0, 0.64):
    add_box(f"engine_vent_{x:+.2f}", (0.45, 0.72, 0.08), (x, 1.43, 1.71), MAT_DARK, chassis, 0.025)
for x in (-1.08, 1.08):
    add_box(f"fender_{x:+.2f}", (0.24, 3.72, 0.18), (x, -0.02, 1.12), MAT_GUNMETAL, chassis, 0.035)
    add_box(f"side_armor_{x:+.2f}", (0.18, 2.55, 0.42), (x, 0.1, 1.27), MAT_PANEL, chassis, 0.055)
    accent_x = x + (-0.102 if x < 0 else 0.102)
    for panel_index, y in enumerate((-1.18, -0.4, 0.38, 1.16)):
        add_box(
            f"side_skirt_panel_{x:+.2f}_{panel_index}",
            (0.055, 0.66, 0.34),
            (accent_x, y, 1.25),
            MAT_GUNMETAL if panel_index != 1 else MAT_AMBER,
            chassis,
            0.018,
        )

# Readable return rollers and armored end caps close the running-gear silhouette.
for side_name, x, track_parent in (("L", -1.38, track_left), ("R", 1.38, track_right)):
    outer_x = x + (-0.34 if x < 0 else 0.34)
    for y in (-1.9, 1.9):
        add_cylinder(f"idler_outer_{side_name}_{y:+.1f}", 0.43, 0.16, (outer_x, y, 0.64), MAT_GUNMETAL, track_parent, 20, (0.0, math.pi / 2, 0.0), 0.025)
        add_cylinder(f"idler_hub_{side_name}_{y:+.1f}", 0.19, 0.19, (outer_x + (-0.1 if x < 0 else 0.1), y, 0.64), MAT_STEEL, track_parent, 14, (0.0, math.pi / 2, 0.0), 0.014)

# Layered upper-deck plates replace one broad toy-like surface with a readable
# armored vehicle rhythm. Orange remains a thin faction recognition stripe.
add_box("glacis_center_plate", (1.16, 0.86, 0.08), (0, -1.43, 1.37), MAT_GUNMETAL, chassis, 0.025)
for x in (-0.76, 0.76):
    add_box(f"glacis_outer_plate_{x:+.2f}", (0.55, 0.74, 0.07), (x, -1.44, 1.32), MAT_PANEL, chassis, 0.022)
    add_box(f"faction_slash_{x:+.2f}", (0.12, 0.58, 0.075), (x, -1.45, 1.39), MAT_AMBER, chassis, 0.015, (0, 0, -0.18 if x < 0 else 0.18))
for y in (-0.65, 0.15, 0.94):
    add_box(f"deck_service_panel_{y:+.2f}", (0.72, 0.58, 0.045), (0, y, 1.57), MAT_GUNMETAL, chassis, 0.018)

# Front recognition: towing points, armored lamps and cyan signals.
for x in (-0.72, 0.72):
    add_cylinder(f"tow_ring_{x:+.2f}", 0.12, 0.12, (x, -2.12, 0.7), MAT_STEEL, chassis, 12, (math.pi / 2, 0, 0), 0.015)
    add_box(f"headlamp_guard_{x:+.2f}", (0.42, 0.18, 0.25), (x, -2.14, 1.08), MAT_AMBER, chassis, 0.04)
    add_box(f"headlamp_{x:+.2f}", (0.24, 0.06, 0.09), (x, -2.245, 1.08), MAT_CYAN, chassis, 0.015)
add_box("front_bumper", (2.0, 0.16, 0.18), (0, -2.19, 0.43), MAT_STEEL, chassis, 0.035)
add_box("front_lower_armor", (1.48, 0.12, 0.34), (0, -2.12, 0.78), MAT_DARK, chassis, 0.02)
for x in (-0.34, 0.34):
    add_box(f"front_sensor_{x:+.2f}", (0.18, 0.07, 0.07), (x, -2.205, 0.92), MAT_CYAN, chassis, 0.012)

# Front glacis ribs and recovery cable anchors add scale cues without obscuring the wedge.
for x in (-0.48, 0.48):
    add_box(f"glacis_rib_{x:+.2f}", (0.07, 0.88, 0.055), (x, -1.47, 1.43), MAT_STEEL, chassis, 0.012)
    add_cylinder(f"recovery_pin_{x:+.2f}", 0.075, 0.16, (x, -1.92, 1.16), MAT_STEEL, chassis, 10, (math.pi / 2, 0, 0), 0.01)

# Rear exhausts and fuel/storage modules.
for x in (-0.83, 0.83):
    exhaust = add_cylinder(f"exhaust_{'left' if x < 0 else 'right'}", 0.13, 0.72, (x, 1.84, 1.72), MAT_STEEL, chassis, 12, (0, 0, 0), 0.02)
    exhaust.rotation_euler.x = 0.1 * (-1 if x < 0 else 1)
    add_box(f"rear_storage_{x:+.2f}", (0.52, 0.34, 0.42), (x, 1.86, 1.2), MAT_GUNMETAL, chassis, 0.045)
    add_box(f"rear_warning_{x:+.2f}", (0.25, 0.055, 0.08), (x, 2.045, 1.22), MAT_AMBER, chassis, 0.012)
    add_cylinder(f"exhaust_cap_{x:+.2f}", 0.16, 0.08, (x, 1.84, 2.08), MAT_DARK, chassis, 12, (0, 0, 0), 0.012)

# Independent turret hierarchy.
turret = empty("turret_yaw", (0, -0.08, 1.62), chassis)
add_cylinder("turret_ring", 0.88, 0.2, (0, 0, 0.05), MAT_DARK, turret, 24, (0, 0, 0), 0.025)
add_box("turret_lower", (1.82, 1.82, 0.36), (0, 0.02, 0.35), MAT_GUNMETAL, turret, 0.13)
add_wedge("turret_front", 1.72, 1.18, -0.12, 0.34, 0.58, (0, -0.54, 0.44), MAT_PANEL, turret, 0.09)
add_box("turret_rear", (1.72, 0.72, 0.56), (0, 0.73, 0.48), MAT_PANEL, turret, 0.09)
for x in (-0.78, 0.78):
    add_box(f"turret_cheek_{x:+.2f}", (0.28, 0.92, 0.45), (x, -0.2, 0.42), MAT_GUNMETAL, turret, 0.045)
    add_box(f"turret_cheek_stripe_{x:+.2f}", (0.06, 0.62, 0.22), (x + (-0.16 if x < 0 else 0.16), -0.24, 0.44), MAT_AMBER, turret, 0.012)
add_box("turret_roof_plate", (1.18, 1.04, 0.11), (0, 0.16, 0.73), MAT_GUNMETAL, turret, 0.035)
for x in (-0.48, 0.48):
    add_box(f"turret_roof_rail_{x:+.2f}", (0.09, 0.84, 0.09), (x, 0.18, 0.82), MAT_STEEL, turret, 0.018)
add_cylinder("commander_hatch", 0.38, 0.13, (-0.35, 0.17, 0.82), MAT_STEEL, turret, 20, (0, 0, 0), 0.025)
add_cylinder("hatch_ring", 0.29, 0.12, (-0.35, 0.17, 0.92), MAT_GUNMETAL, turret, 20, (0, 0, 0), 0.02)
add_box("turret_signal", (0.3, 0.13, 0.12), (0.46, -0.82, 0.64), MAT_CYAN, turret, 0.02)
add_box("optic_housing", (0.34, 0.3, 0.28), (0.42, -0.02, 0.96), MAT_GUNMETAL, turret, 0.035)
add_box("optic_lens", (0.18, 0.055, 0.1), (0.42, -0.19, 0.98), MAT_CYAN, turret, 0.012)

# Hero-readability pass: roof chevrons, vehicle number, rear bustle and smoke launchers.
for x, angle in ((-0.19, -0.5), (0.19, 0.5)):
    add_box(f"roof_chevron_{x:+.2f}", (0.11, 0.52, 0.028), (x, 0.07, 0.805), MAT_AMBER, turret, 0.008, (0, 0, angle))
add_text_marking("turret_unit_number", "17", 0.24, (0, 0.44, 0.807), MAT_IVORY, turret)
for x in (-0.58, 0.58):
    add_box(f"turret_bustle_{x:+.2f}", (0.38, 0.42, 0.28), (x, 0.9, 0.5), MAT_GUNMETAL, turret, 0.035)
    add_box(f"bustle_latch_{x:+.2f}", (0.16, 0.04, 0.12), (x, 1.125, 0.51), MAT_IVORY, turret, 0.01)
    for launcher_index in range(3):
        add_cylinder(
            f"smoke_launcher_{x:+.2f}_{launcher_index}",
            0.055,
            0.28,
            (x, -0.65 + launcher_index * 0.12, 0.7 + launcher_index * 0.035),
            MAT_GUNMETAL,
            turret,
            10,
            (math.radians(58), 0, math.radians(-16 if x < 0 else 16)),
            0.008,
        )

# Compact remote weapon station gives the turret a stronger asymmetrical silhouette.
add_cylinder("rws_base", 0.18, 0.11, (0.43, 0.42, 0.87), MAT_DARK, turret, 16, (0, 0, 0), 0.015)
add_box("rws_housing", (0.28, 0.34, 0.22), (0.43, 0.35, 1.02), MAT_GUNMETAL, turret, 0.025)
add_cylinder("rws_barrel", 0.035, 0.66, (0.43, -0.12, 1.03), MAT_STEEL, turret, 10, (math.pi / 2, 0, 0), 0.006)

barrel = empty("barrel_pitch", (0, -0.78, 0.55), turret)
add_cylinder("gun_mantlet", 0.31, 0.55, (0, -0.16, 0), MAT_DARK, barrel, 20, (math.pi / 2, 0, 0), 0.045)
add_cylinder("main_cannon", 0.12, 2.85, (0, -1.65, 0), MAT_STEEL, barrel, 16, (math.pi / 2, 0, 0), 0.018)
for index, y in enumerate((-0.7, -1.25, -2.42), start=1):
    add_cylinder(f"barrel_band_{index}", 0.16, 0.18, (0, y, 0), MAT_AMBER if index == 2 else MAT_GUNMETAL, barrel, 16, (math.pi / 2, 0, 0), 0.018)
add_cylinder("muzzle_brake", 0.19, 0.5, (0, -3.0, 0), MAT_GUNMETAL, barrel, 16, (math.pi / 2, 0, 0), 0.025)
for x in (-0.17, 0.17):
    add_box(f"muzzle_port_{x:+.2f}", (0.08, 0.26, 0.12), (x, -3.0, 0), MAT_DARK, barrel, 0.01)
muzzle_socket = empty("muzzle_socket", (0, -3.27, 0), barrel)
muzzle_socket["socket_role"] = "projectile_origin"

# Antenna and stable selection anchor.
add_cylinder("antenna_base", 0.11, 0.2, (0.68, 0.55, 0.84), MAT_AMBER, turret, 12, (0, 0, 0), 0.015)
add_cylinder("antenna", 0.025, 1.25, (0.68, 0.55, 1.5), MAT_STEEL, turret, 8, (0, 0, 0), 0.006)
selection_anchor = empty("selection_anchor", (0, 0, 0.05), root)
selection_anchor["socket_role"] = "selection_ground"
damage_engine = empty("damage_socket_engine", (0, 1.42, 1.78), chassis)
damage_engine["socket_role"] = "damage_emitter"
damage_turret = empty("damage_socket_turret", (0, 0.1, 1.18), turret)
damage_turret["socket_role"] = "damage_emitter"
wreck_anchor = empty("wreck_anchor", (0, 0, 0.08), root)
wreck_anchor["socket_role"] = "wreck_replacement"
wreck_visual_root = build_wreck_visual(root)

# Add small panel fasteners where they remain readable in strategic view.
for x in (-0.78, 0.78):
    for y in (-1.4, -0.7, 0.4, 1.1):
        add_cylinder(f"deck_bolt_{x:+.2f}_{y:+.2f}", 0.035, 0.035, (x, y, 1.62), MAT_STEEL, chassis, 8, (0, 0, 0), 0.004)

# Studio ground, camera and motivated lighting are preview-only and excluded from GLB export.
bpy.ops.mesh.primitive_plane_add(size=28, location=(0, 0, 0))
ground = bpy.context.object
ground.name = "PREVIEW_GROUND"
ground.data.materials.append(MAT_GROUND)

bpy.ops.object.camera_add(location=(7.4, -8.6, 7.1))
camera = bpy.context.object
camera.name = "PREVIEW_CAMERA"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 7.25
scene.camera = camera


def point_camera(camera_obj: bpy.types.Object, target=(0, 0, 1.15)) -> None:
    direction = Vector(target) - camera_obj.location
    camera_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


point_camera(camera)

bpy.ops.object.light_add(type="AREA", location=(-4.5, -5.5, 8.5))
key = bpy.context.object
key.name = "PREVIEW_KEY"
key.data.energy = 1150
key.data.shape = "DISK"
key.data.size = 5.5
point_camera(key, (0, 0, 1))

bpy.ops.object.light_add(type="AREA", location=(5.5, -1.0, 4.2))
fill = bpy.context.object
fill.name = "PREVIEW_FILL"
fill.data.energy = 650
fill.data.size = 4.0
point_camera(fill, (0, 0, 1.2))

bpy.ops.object.light_add(type="AREA", location=(0, 5.0, 6.5))
rim = bpy.context.object
rim.name = "PREVIEW_RIM"
rim.data.energy = 900
rim.data.size = 3.0
point_camera(rim, (0, 0, 1.5))

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.06, 0.055, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32

# Guarantee every exported mesh has a deterministic UV set for the texture pipeline.
for mesh_obj in [obj for obj in asset_collection.all_objects if obj.type == "MESH"]:
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.025)
    bpy.ops.object.mode_set(mode="OBJECT")

# Save editable master before export.
blend_path = ASSET_DIR / "ff_mbt_01_v1.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

# The editable master keeps named plates and tread blocks. The runtime copy is
# consolidated by material inside the three animation domains so the richer model
# does not multiply draw calls. Semantic empties and gameplay sockets remain intact.
def is_under(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    current = obj.parent
    while current is not None:
        if current == ancestor:
            return True
        current = current.parent
    return False


def runtime_domain(obj: bpy.types.Object) -> bpy.types.Object:
    if is_under(obj, barrel):
        return barrel
    if is_under(obj, turret):
        return turret
    return chassis


all_runtime_meshes = [obj for obj in asset_collection.all_objects if obj.type == "MESH"]
for mesh_obj in all_runtime_meshes:
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    for modifier in list(mesh_obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)

runtime_meshes = [obj for obj in all_runtime_meshes if not is_under(obj, wreck_visual_root)]
mesh_groups: dict[tuple[str, str], list[bpy.types.Object]] = {}
domain_lookup = {chassis.name: chassis, turret.name: turret, barrel.name: barrel}
for mesh_obj in runtime_meshes:
    domain = runtime_domain(mesh_obj)
    material_name = mesh_obj.data.materials[0].name if mesh_obj.data.materials else "Unassigned"
    mesh_groups.setdefault((domain.name, material_name), []).append(mesh_obj)

for (domain_name, material_name), objects in mesh_groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for mesh_obj in objects:
        mesh_obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    if len(objects) > 1:
        bpy.ops.object.join()
    world_matrix = active.matrix_world.copy()
    active.parent = domain_lookup[domain_name]
    active.matrix_world = world_matrix
    active.name = f"{domain_name}_{material_name}_runtime"

# Export only the semantic asset collection.
bpy.ops.object.select_all(action="DESELECT")
for obj in asset_collection.all_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
glb_path = ASSET_DIR / "ff_mbt_01_v1.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_extras=True,
)

# High-resolution proof render.
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.film_transparent = False
scene.render.filepath = str(ASSET_DIR / "ff_mbt_01_v1_preview.png")
if not SKIP_PREVIEW:
    bpy.ops.render.render(write_still=True)
    wreck_meshes = {obj for obj in asset_collection.all_objects if obj.type == "MESH" and is_under(obj, wreck_visual_root)}
    normal_meshes = {obj for obj in asset_collection.all_objects if obj.type == "MESH"} - wreck_meshes
    for obj in normal_meshes:
        obj.hide_render = True
    wreck_visual_root.hide_render = False
    scene.render.filepath = str(ASSET_DIR / "ff_mbt_01_v1_wreck_preview.png")
    bpy.ops.render.render(write_still=True)
    wreck_visual_root.hide_render = True
    for obj in normal_meshes:
        obj.hide_render = False

# Layered isometric frames from the same 3D master. Body, turret and shadow can
# be composed independently by a classic 2.5D renderer without divergent art.
ground.hide_render = True
scene.render.resolution_x = 192
scene.render.resolution_y = 192
scene.render.film_transparent = True
camera.data.ortho_scale = 6.8


def descendants(parent: bpy.types.Object) -> set[bpy.types.Object]:
    result: set[bpy.types.Object] = set()
    pending = list(parent.children)
    while pending:
        child = pending.pop()
        result.add(child)
        pending.extend(child.children)
    return result


turret_tree = descendants(turret) | {turret}
asset_meshes = {obj for obj in asset_collection.all_objects if obj.type == "MESH"}
turret_meshes = {obj for obj in turret_tree if obj.type == "MESH"}
body_meshes = asset_meshes - turret_meshes

body_directions = []
for obj in turret_meshes:
    obj.hide_render = True
for direction_index in range(8):
    angle_degrees = direction_index * 45
    root.rotation_euler.z = math.radians(angle_degrees)
    if not SKIP_SPRITES:
        scene.render.filepath = str(SPRITE_DIR / f"body_{direction_index:02d}.png")
        bpy.ops.render.render(write_still=True)
    body_directions.append({"index": direction_index, "degrees": angle_degrees, "file": f"body_{direction_index:02d}.png"})
root.rotation_euler.z = 0
for obj in turret_meshes:
    obj.hide_render = False
for obj in body_meshes:
    obj.hide_render = True

turret_directions = []
for direction_index in range(16):
    angle_degrees = direction_index * 22.5
    turret.rotation_euler.z = math.radians(angle_degrees)
    if not SKIP_SPRITES:
        scene.render.filepath = str(SPRITE_DIR / f"turret_{direction_index:02d}.png")
        bpy.ops.render.render(write_still=True)
    turret_directions.append({"index": direction_index, "degrees": angle_degrees, "file": f"turret_{direction_index:02d}.png"})
turret.rotation_euler.z = 0
for obj in body_meshes:
    obj.hide_render = False

# A compact, neutral contact shadow layer. It is intentionally independent of
# collision and can be omitted or replaced by runtime shadows.
shadow_pixels: list[float] = []
shadow_size = 192
for y in range(shadow_size):
    for x in range(shadow_size):
        dx = (x - 96) / 57.0
        dy = (y - 79) / 21.0
        distance = dx * dx + dy * dy
        alpha = max(0.0, min(0.46, (1.0 - distance) * 0.52))
        alpha *= alpha / 0.46 if alpha > 0 else 0.0
        shadow_pixels.extend((0.0, 0.0, 0.0, alpha))
write_rgba_png(SPRITE_DIR / "shadow.png", shadow_size, shadow_size, shadow_pixels)

metadata = {
    "assetId": "ff_mbt_01",
    "sourceBlend": str(blend_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    "sourceGlb": str(glb_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    "bodyDirections": body_directions,
    "turretDirections": turret_directions,
    "shadow": "shadow.png",
    "frameSize": {"width": 192, "height": 192},
    "camera": {"projection": "orthographic", "azimuthDegrees": 45, "elevationDegrees": 55},
    "nodes": {
        "chassis": "chassis_root",
        "turret": "turret_yaw",
        "barrel": "barrel_pitch",
        "muzzle": "muzzle_socket",
        "selection": "selection_anchor",
    },
    "runtimeStatus": "hero-baseline-v3",
    "textureStatus": "deterministic-hero-pbr-v3",
    "assetRevision": "hero-baseline-v3",
    "damageSockets": ["damage_socket_engine", "damage_socket_turret", "wreck_anchor"],
    "spriteRenderStatus": "preserved-previous-baseline" if SKIP_SPRITES else "refreshed-hero-baseline-v3",
}
with (SPRITE_DIR / "ff_mbt_01_v1.json").open("w", encoding="utf-8") as handle:
    json.dump(metadata, handle, indent=2, ensure_ascii=False)

print(f"FF_MBT_01_BLEND={blend_path}")
print(f"FF_MBT_01_GLB={glb_path}")
print(f"FF_MBT_01_PREVIEW={ASSET_DIR / 'ff_mbt_01_v1_preview.png'}")
print(f"FF_MBT_01_SPRITES={SPRITE_DIR}")
