# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Second bounded prototype pass: patchy shallows and a readable fishing nook."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

OUT = Path(os.environ["FEKA_OUTPUT_DIR"])
ROOT = Path(os.environ["FEKA_REPO_ROOT"])
scene = bpy.context.scene
random.seed(211026)
bpy.context.view_layer.update()
base = [obj for obj in scene.objects if not obj.get('enrichment_group')]
matrices = {obj.name: obj.matrix_world.copy() for obj in base}
for obj in list(scene.objects):
    if obj.get('enrichment_group') in ['shoreline', 'fishing_corner']:
        bpy.data.objects.remove(obj, do_unlink=True)

def finish(obj, name, material, floor=False):
    obj.name = 'prototype v2 ' + name
    obj.data.materials.append(material)
    obj['enrichment_group'] = 'shoreline_organic' if floor else 'fishing_corner_v2'
    obj['decorative_floor'] = floor
    return obj

def curve(name, points, thickness, material, floor=False):
    data = bpy.data.curves.new(name, 'CURVE'); data.dimensions = '3D'; data.resolution_u = 3
    data.bevel_depth = thickness; data.bevel_resolution = 2
    spline = data.splines.new('POLY'); spline.points.add(len(points) - 1)
    for vertex, coordinate in zip(spline.points, points): vertex.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    return finish(obj, name, material, floor)

def cylinder(name, point, radius, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth, location=point)
    return finish(bpy.context.object, name, material)

def beam(name, a, b, radius, material):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a + b) / 2, radius, (b - a).length, material)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj

def soft_material(name, color):
    material = bpy.data.materials.new(name); material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links; nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    mix = nodes.new('ShaderNodeMixShader')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (*tuple(((c + .055) / 1.055) ** 2.4 for c in color), 1)
    colors = nodes.new('ShaderNodeVertexColor'); colors.layer_name = 'WaterFade'
    links.new(colors.outputs['Alpha'], mix.inputs[0]); links.new(transparent.outputs[0], mix.inputs[1])
    links.new(diffuse.outputs[0], mix.inputs[2]); links.new(mix.outputs[0], output.inputs[0])
    return material

shallow = soft_material('v2 faded localized aquamarine', (.19, .63, .58))
wet = soft_material('v2 localized wet sand', (.68, .48, .26))
foam = bpy.data.materials['additive warm ivory shoreline foam']
foam_light = bpy.data.materials['additive broken outer foam']
wood, woodlight = bpy.data.materials['honey wood'], bpy.data.materials['cut timber']
rope = bpy.data.materials['hemp']; iron = bpy.data.materials['dark blue iron']

def patch(name, x, y, rx, ry, angle, z, opacity, material, seed):
    rng = random.Random(seed); count = 56
    phase = rng.random() * math.tau
    vertices, alpha = [(x, y, z)], [opacity]
    for ring, falloff in [(.32, .98), (.66, .64), (.88, .20), (1, 0)]:
        for i in range(count):
            a = i * math.tau / count
            radius = 1 + .11 * math.sin(3 * a + phase) + .045 * math.sin(7 * a - phase)
            dx, dy = rx * math.cos(a) * radius * ring, ry * math.sin(a) * radius * ring
            vertices.append((x + dx * math.cos(angle) - dy * math.sin(angle), y + dx * math.sin(angle) + dy * math.cos(angle), z))
            alpha.append(opacity * falloff)
    faces = [(0, 1 + i, 1 + (i + 1) % count) for i in range(count)]
    for ring in range(3):
        for i in range(count):
            a, b = 1 + ring * count + i, 1 + ring * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(vertices, [], faces); mesh.update()
    attribute = mesh.color_attributes.new(name='WaterFade', type='FLOAT_COLOR', domain='CORNER')
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            attribute.data[loop].color = (1, 1, 1, alpha[mesh.loops[loop].vertex_index])
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj); finish(obj, name, material, True)

def shore(angle, radial=1, z=.029):
    radius = 1 + .035 * math.sin(5 * angle) + .025 * math.sin(9 * angle + .7) + .014 * math.sin(15 * angle)
    return (-.1 + 7.05 * math.cos(angle) * radius * radial, -.38 + 4.29 * math.sin(angle) * radius * radial, z)

# Independent translucent coves, fading to zero alpha; no complete island outline.
for i, (degrees, length, width, opacity) in enumerate([(-160, 1.22, .48, .25), (-133, 1.10, .57, .20), (-100, 1.27, .48, .23), (18, .86, .40, .20)]):
    angle = math.radians(degrees); x, y, _ = shore(angle, 1.045)
    tangent = math.atan2(4.29 * math.cos(angle), -7.05 * math.sin(angle))
    patch('soft shallow cove', x, y, length, width, tangent, .020, opacity, shallow, 90 + i)
    sx, sy, _ = shore(angle, .98)
    patch('small irregular wet sand patch', sx, sy, length * .70, .17, tangent, .335, .26, wet, 160 + i)

# Short curved lace at selected real shoreline contacts; no evenly spaced dashes.
for i, (degrees, length) in enumerate([(-169, .080), (-159, .058), (-145, .045), (-137, .060), (-123, .051), (-108, .083), (-98, .039), (-88, .067), (10, .052), (20, .067)]):
    start = math.radians(degrees)
    points = []
    for j in range(17):
        t = j / 16; a = start + length * t
        points.append(shore(a, 1.012 + .004 * math.sin(t * math.pi * 2.2 + i), .033))
    curve('broken curved shore foam', points, .011 + .004 * (i % 3), foam, True)
    if i in [0, 3, 5, 9]:
        points = [shore(start + .02 + length * j / 19, 1.036 + .006 * math.sin(j / 19 * math.pi), .026) for j in range(20)]
        curve('thin receding wash', points, .007, foam_light, True)

# Readable leaning net frame, two creels and a grouped crate, all on original sand.
depsgraph = bpy.context.evaluated_depsgraph_get(); vertices, faces = [], []
for obj in base:
    if obj.type != 'MESH' or 'single sculpted sand shoreline' not in obj.name: continue
    evaluated = obj.evaluated_get(depsgraph); data = evaluated.to_mesh(); offset = len(vertices)
    vertices.extend(obj.matrix_world @ point.co for point in data.vertices)
    faces.extend(tuple(offset + n for n in face.vertices) for face in data.polygons); evaluated.to_mesh_clear()
terrain = BVHTree.FromPolygons(vertices, faces)
def ground(x, y):
    location, normal, _, _ = terrain.ray_cast(Vector((x, y, 10)), Vector((0, 0, -1)), 15)
    assert location is not None and normal.z > .8
    return location.z + .008

x, y = -4.32, -3.76
z = ground(x, y)
for dx in [-.49, .49]:
    beam('leaning net timber post', (x + dx, y + .06, z), (x + dx, y - .06, z + 1.12), .035, wood)
beam('net top timber', (x - .54, y - .06, z + 1.10), (x + .54, y - .06, z + 1.10), .040, woodlight)
for row in range(7):
    height = .21 + row * .135
    curve('hanging net horizontal', [(x - .47 + j * .94 / 12, y - .055, z + height - .075 * math.sin(j / 12 * math.pi)) for j in range(13)], .009, rope)
for col in range(9):
    xx = x - .47 + col * .94 / 8
    curve('hanging net vertical', [(xx, y - .055, z + .17), (xx, y - .055, z + 1.04)], .008, rope)

for xx, yy, radius, height in [(x - .20, y + .35, .19, .32), (x + .23, y + .33, .145, .255)]:
    zz = ground(xx, yy)
    cylinder('wicker creel body', (xx, yy, zz + height / 2), radius, height, woodlight)
    cylinder('open dark creel interior', (xx, yy, zz + height + .004), radius * .82, .013, iron)
    for ring in range(4):
        curve('creel rope weave', [(xx + (radius + .007) * math.cos(j * math.tau / 24), yy + (radius + .007) * math.sin(j * math.tau / 24), zz + .04 + ring * height / 4) for j in range(25)], .014, rope)
    curve('creel carrying handle', [(xx + radius * .85 * math.cos(j * math.pi / 16), yy, zz + height + .14 * math.sin(j * math.pi / 16)) for j in range(17)], .018, rope)

xx, yy, size = x + .50, y + .32, .28
zz = ground(xx, yy)
bpy.ops.mesh.primitive_cube_add(size=1, location=(xx, yy, zz + size / 2)); obj = bpy.context.object; obj.dimensions = (size, size * .78, size)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); finish(obj, 'fishers crate', woodlight)
for height in [.08, .20]:
    beam('crate front brace', (xx - size / 2, yy - size * .42, zz + height), (xx + size / 2, yy - size * .42, zz + height), .017, wood)

# Reuse the exact first-pass body/view sampling function without scene building.
original = json.loads((ROOT / 'public/assets/world/map/costa-diorama.meta.json').read_text())
camera = scene.camera
namespace = {'target': Vector((0, 0, 2.7))}
source = (OUT / 'build_prototype.py').read_text()
function = source.split('def audit_additions():', 1)[1].split('\nfirst_audit =', 1)[0]
exec('def audit_additions():' + function, globals())
audit = audit_additions()
assert not audit['flags'], json.dumps(audit['flags'])
bpy.context.view_layer.update()
assert all(obj.matrix_world == matrices[obj.name] for obj in base), 'Approved geometry moved'
(OUT / 'shoreline-v2-audit.json').write_text(json.dumps({'bodyRays': audit['bodyRays'], 'cameraRays': audit['cameraRays'], 'newObstructionFlags': audit['flags'], 'baseMatricesUnchanged': True, 'water': 'Four independently feathered patches and ten curved contact-wash segments; no continuous outline.', 'limits': 'Static decorative prototype. Same source routes/camera; sampled rays are not complete gameplay validation.'}, indent=2))
scene.cycles.samples = 24; scene.render.resolution_percentage = 50
scene.render.filepath = str(OUT / 'costa-after-v2.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'costa-enrichment-prototype-v2.blend'))
render_if_requested()
print('COSTA_SHORELINE_V2_READY=' + str(OUT / 'costa-after-v2.png'))
