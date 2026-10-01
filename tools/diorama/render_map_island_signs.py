"""Author the non-directional island-name boards with Blender 4.3.2.

blender -b -t 8 -P tools/diorama/render_map_island_signs.py -- \
  --repo-root REPO --output-dir RENDERS --samples 64

The three blanks share a 128 x 44 CSS-pixel frame and camera. PNG intermediates
are rendered at DPR4, then packaged at DPR2. Optional .blend files and all
proofs belong outside Git. No existing sign art or runtime files are changed.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--save-blend', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.samples < 1:
    parser.error('--samples must be positive')
repo, output = args.repo_root.resolve(), args.output_dir.resolve()
output.mkdir(parents=True, exist_ok=True)
palette = dict(re.findall(r"([A-Za-z][A-Za-z0-9]*)\s*:\s*'(#[0-9a-fA-F]{6})'",
                          (repo / 'src/graphics/palette.ts').read_text()))
expected = {'soilLight': '#bc845d', 'soil': '#92604c', 'paper': '#f5efd3',
            'soilDark': '#523748', 'inkLight': '#303650', 'gold': '#e9ad4c',
            'ink': '#191f35', 'red': '#ca5357', 'muted': '#a7b4bb'}
if any(palette.get(key) != color for key, color in expected.items()):
    raise ValueError('Game palette changed; review the frozen island-sign art before rebuilding')


def material(name, color, grain=False):
    rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    rgb = tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in rgb)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .88
    if grain:
        texture = nodes.new('ShaderNodeTexNoise')
        texture.inputs['Scale'].default_value = 6
        texture.inputs['Detail'].default_value = 1
        coord = nodes.new('ShaderNodeTexCoord')
        stretch = nodes.new('ShaderNodeVectorMath')
        stretch.operation = 'MULTIPLY'
        stretch.inputs[1].default_value = (.7, 8, 16)
        mat.node_tree.links.new(coord.outputs['Generated'], stretch.inputs[0])
        mat.node_tree.links.new(stretch.outputs[0], texture.inputs[0])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .12
        ramp.color_ramp.elements[0].color = tuple(v * .84 for v in rgb) + (1,)
        ramp.color_ramp.elements[1].position = .86
        ramp.color_ramp.elements[1].color = tuple(min(1, v * 1.06) for v in rgb) + (1,)
        mat.node_tree.links.new(texture.outputs['Fac'], ramp.inputs[0])
        mat.node_tree.links.new(ramp.outputs[0], shader.inputs['Base Color'])
    return mat


def cube(name, location, size, mat, bevel=.016):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name, obj.dimensions = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new('worn edge', 'BEVEL')
    modifier.width, modifier.segments = bevel, 2
    obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return obj


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new('hand-cut edge', 'BEVEL')
    modifier.width, modifier.segments = .016, 2
    obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return obj


frames = []
for kind in ('island', 'island-selected', 'island-locked'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    timber = material('Original soil warm timber', palette['soilLight'], True)
    edge = material('Original soil end grain', palette['soil'], True)
    face = material('Original paper weathered paint', palette['paper'], True)
    post = material('Original soil shadow', palette['soilDark'], True)
    iron = material('Original ink forged fixing', palette['inkLight'])
    brass = material('Original gold selection paint', palette['gold'])
    red = material('Original red closed-route pin', palette['red'])
    if kind == 'island-locked':
        # Muted wood and a single red keeper distinguish locked islands while
        # retaining the full original dark bitmap lettering contrast.
        timber = material('Muted locked timber', '#aa8973', True)
        face = material('Muted locked ivory paint', '#dedaca', True)

    half, bottom, top = 1.96, .39, 1.32
    outline = [(-half + .05, bottom), (-half, bottom + .05),
               (-half, top - .05), (-half + .04, top),
               (half - .055, top - .012), (half, top - .06),
               (half - .015, bottom + .02)]
    count = len(outline)
    vertices = [(x, y, z) for y in (-.095, .105) for x, z in outline]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, 2 * count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
              for i in range(count)]
    mesh('Single rectangular solid timber nameboard', vertices, faces, timber)
    center_z = (bottom + top) / 2
    inset = [(x * .953, -.109, center_z + (z - center_z) * .94)
             for x, z in outline]
    mesh('Inset ivory lettering face', inset, [tuple(range(count - 1, -1, -1))], face)
    for x in (-1.36, 1.36):
        cube('Short square timber support', (x, .065, .31), (.095, .125, .62), post)
        cube('Sunlit support grain', (x - .022, -.001, .24), (.022, .011, .44), timber, .004)
        cube('Rear strengthening cleat', (x, .145, .80), (.11, .11, .55), edge)
    for x in (-1.80, 1.80):
        for z in (.54, 1.17):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6,
                                               radius=.019, location=(x, -.127, z))
            nail = bpy.context.object
            nail.name, nail.scale = 'Small forged fixing', (1, .33, 1)
            nail.data.materials.append(iron)
    if kind == 'island-selected':
        cube('Restrained brass selection stroke', (-1.85, -.130, .84), (.052, .015, .64), brass, .01)
        cube('Brass support cap', (-1.36, -.005, .32), (.118, .145, .065), brass, .01)
    elif kind == 'island-locked':
        cube('Single red closed-route keeper', (1.36, -.020, .32), (.115, .045, .075), red, .008)

    scene = bpy.context.scene
    target = Vector((0, 0, .69))
    bpy.ops.object.camera_add(location=(0, -8, 4.66))
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 4.16
    scene.camera = camera
    world = bpy.data.worlds.new('Original diorama daylight')
    scene.world, world.use_nodes = world, True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.50, .66, .78, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .5
    for location, power, size, color in [((-3, -4, 7), 470, 4, (1, .90, .72)),
                                        ((4, 1, 6), 300, 4, (.72, .85, 1))]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy, light.data.size, light.data.color = power, size, color
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, -.018))
    floor = bpy.context.object
    floor.name, floor.is_shadow_catcher = 'Transparent contact shadow receiver', True
    floor.data.materials.append(material('Neutral shadow receiver', '#c8c0a6'))
    scene.render.engine = 'CYCLES'
    scene.cycles.samples, scene.cycles.use_denoising, scene.cycles.seed = args.samples, False, 0
    scene.render.resolution_x, scene.render.resolution_y = 512, 176
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format, scene.render.image_settings.color_mode = 'PNG', 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look, scene.view_settings.exposure = 'AgX - Medium High Contrast', .2
    bpy.context.view_layer.update()

    def project(point):
        projected = world_to_camera_view(scene, camera, Vector(point))
        return {'x': round(projected.x * 128, 3), 'y': round((1 - projected.y) * 44, 3)}

    # The text anchor is authored on the face plane to land at integer CSS y22.
    letter_z = target.z + .13 * (camera.location.z - target.z) / 8
    frames.append({'kind': kind, 'image': kind + '.png', 'cssWidth': 128,
                   'cssHeight': 44, 'dpr': 4, 'foot': project((0, 0, 0)),
                   'letterCenter': project((0, -.13, letter_z)),
                   'usableFace': {'x': 10, 'y': 10, 'width': 108, 'height': 20},
                   'letterPixelScale': 2,
                   'palette': {'letters': palette['ink'], 'closedLetters': palette['ink'],
                               'selected': palette['gold']}})
    scene.render.filepath = str(output / (kind + '.png'))
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(output / (kind + '.blend')))
    bpy.ops.render.render(write_still=True)
(output / 'island-signs.render.meta.json').write_text(json.dumps(frames, indent=2) + '\n')
print('ISLAND_SIGN_RENDERS=' + str(output))
