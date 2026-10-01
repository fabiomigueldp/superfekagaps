# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Bounded additive Costa prototype. No production writes or route changes."""
import bpy, hashlib, json, math, random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(os.environ["FEKA_REPO_ROOT"])
OUT = Path(os.environ["FEKA_OUTPUT_DIR"])
source_path = OUT / 'source/render_costa.py'
source = source_path.read_text()
source = source.replace("ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))", 'ROOT=' + repr(str(ROOT)))
source = source.replace("OUT=os.path.join(ROOT,'public/assets/world/map'); os.makedirs(OUT,exist_ok=True)", 'OUT=' + repr(str(OUT)) + '; os.makedirs(OUT,exist_ok=True)')
marker = "with open(os.path.join(OUT,'costa-diorama.meta.json')"
assert marker in source
namespace = {'__file__': str(source_path), '__name__': 'costa_approved_source'}
exec(compile(source.split(marker)[0], str(source_path), 'exec'), namespace)
scene, camera = bpy.context.scene, bpy.context.scene.camera
original = json.loads((ROOT / 'public/assets/world/map/costa-diorama.meta.json').read_text())
for key in ['nodes', 'routes', 'secretRoute', 'worldRoutes', 'camera']:
    assert namespace['metadata'][key] == original[key], key + ' drifted'
bpy.context.view_layer.update()
base_objects = set(scene.objects)
original_matrices = {o.name: [list(row) for row in o.matrix_world] for o in base_objects}
scene.render.resolution_percentage = 50
scene.cycles.samples = 24
scene.render.filepath = str(OUT / 'costa-before.png')
if not (OUT / 'costa-before.png').exists():
    render_if_requested()

mat, mesh, line = namespace['mat'], namespace['mesh'], namespace['line']
ico, cube, beam = namespace['ico'], namespace['cube'], namespace['beam']
palm, bush, agave = namespace['palm'], namespace['bush'], namespace['agave']
leaf, wood, woodlight, rope = namespace['leaf'], namespace['wood'], namespace['woodlight'], namespace['rope']
rock, cream, gold, iron = namespace['rock'], namespace['cream'], namespace['gold'], namespace['iron']
random.seed(10012026)

def translucent(name, color, opacity):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    mix = nodes.new('ShaderNodeMixShader'); mix.inputs[0].default_value = opacity
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (*tuple(((v + .055) / 1.055) ** 2.4 for v in color), 1)
    links.new(transparent.outputs[0], mix.inputs[1]); links.new(diffuse.outputs[0], mix.inputs[2]); links.new(mix.outputs[0], output.inputs[0])
    return material

wet_sand = mat('additive damp honey shoreline', (.66, .48, .27))
shallow = translucent('additive translucent shallow aquamarine', (.22, .78, .67), .25)
shallow_outer = translucent('additive transparent shallow fade', (.25, .76, .71), .10)
foam = translucent('additive warm ivory shoreline foam', (.89, .96, .86), .75)
foam_outer = translucent('additive broken outer foam', (.72, .89, .82), .48)
wet_rock = mat('additive blue gray tide stone', (.34, .44, .43))
fishing_cloth = mat('additive sand linen', (.80, .73, .52))
groups = {}

def begin():
    return set(scene.objects)

def end(name, before, floor=False):
    items = set(scene.objects) - before
    for obj in items:
        obj['enrichment_group'] = name
        obj['decorative_floor'] = floor
    groups[name] = items

# Build a support-only tree from the unchanged authored terrain, not foliage.
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
vertices, faces = [], []
for obj in base_objects:
    if obj.type != 'MESH' or not ('scalloped turf' in obj.name or 'single sculpted sand shoreline' in obj.name):
        continue
    evaluated = obj.evaluated_get(depsgraph); data = evaluated.to_mesh(); offset = len(vertices)
    vertices.extend(obj.matrix_world @ vertex.co for vertex in data.vertices)
    faces.extend(tuple(offset + index for index in polygon.vertices) for polygon in data.polygons)
    evaluated.to_mesh_clear()
terrain = BVHTree.FromPolygons(vertices, faces)
support_records = []

def grounded(x, y):
    location, normal, _, _ = terrain.ray_cast(Vector((x, y, 15)), Vector((0, 0, -1)), 20)
    if location is None or normal.z < .6:
        raise ValueError('No approved terrain support at ' + repr((x, y)))
    support_records.append({'point': [x, y, location.z], 'normalZ': normal.z})
    return location.z + .006

# Water detail follows the exact sculpted rim; the departure corner stays clear.
rim = namespace['rim']
center = Vector((-.1, -.38, 0))
def rim_point(index, factor, z):
    point = Vector(rim[index % len(rim)])
    return (center.x + (point.x - center.x) * factor, center.y + (point.y - center.y) * factor, z)

before = begin()
for index in range(len(rim)):
    x, y, _ = rim[index]
    if x > 3.1 and y < -1.9:
        continue
    # Thin wet strip, followed by two low-opacity shallow-water bands.
    for inner, outer, z, material in [(.979, 1.003, .335, wet_sand), (1.00, 1.095, .025, shallow), (1.095, 1.16, .020, shallow_outer)]:
        points = [rim_point(index, inner, z), rim_point(index + 1, inner, z), rim_point(index + 1, outer, z), rim_point(index, outer, z)]
        mesh('additive tide band', points, [(0, 1, 2, 3)], material)
    if index % 5 not in [0, 4]:
        points = [rim_point(index, 1.021 + .004 * math.sin(index), .036), rim_point(index + 1, 1.024, .036)]
        line('additive contact foam', points, .025 + .008 * (index % 3), foam)
    if index % 9 == 2:
        line('additive receding broken foam', [rim_point(index, 1.11, .031), rim_point(index + 1, 1.13, .031)], .018, foam_outer)
end('shoreline', before, floor=True)

# A few submerged/bare outcrops provide shoreline rhythm away from ferry water.
before = begin()
for x, y, radius in [(-6.5, -3.45, .40), (-5.3, -4.32, .42), (-2.2, -4.72, .31), (.35, -4.8, .34), (-7.2, -.9, .30), (6.7, 2.0, .25)]:
    for j in range(3):
        r = radius * [1, .62, .4][j]
        xx, yy = x + (j - 1) * radius * .58, y + (.2 if j % 2 else -.12) * radius
        ico('additive tidewashed rock', (xx, yy, .02 + r * .23), (r, r * .79, r * .72), wet_rock if j else rock[4], 2)
    angles = [math.pi * .83 + j * math.pi * .7 / 12 for j in range(13)]
    line('additive foam at rock contact', [(x + radius * 1.5 * math.cos(a), y + radius * 1.25 * math.sin(a), .04) for a in angles], .020, foam_outer)
end('offshore_rocks', before)

# Deliberate garden clusters on free ground, with native source plant geometry.
for name, x, y, scale, lean in [
    ('west_low_grove', -6.12, 2.06, .68, (-.12, .05)),
    ('backbone_grove', .47, 2.52, .63, (.14, .02)),
    ('east_rear_grove', 5.11, -.05, .57, (.12, .09)),
]:
    before = begin(); z = grounded(x, y)
    palm('additive ' + name, x, y, z, scale, lean)
    for dx, dy, size in [(-.28, -.02, .62), (.24, .10, .47), (.10, -.25, .40)]:
        zz = grounded(x + dx, y + dy); bush(x + dx, y + dy, zz, size)
    end(name, before)

for name, x, y, size in [('west_coastal_garden', -5.60, -.62, .65), ('east_coastal_garden', 5.36, -.99, .60), ('keeper_back_garden', 3.20, 3.47, .54)]:
    before = begin(); z = grounded(x, y)
    bush(x, y, z, size)
    agave(x - .18, y + .16, grounded(x - .18, y + .16), size)
    end(name, before)

# A small, usable fishing corner; no new building or route moved for this pass.
before = begin()
x, y = -4.32, -3.78
z = grounded(x, y)
for xx in [x - .40, x + .40]:
    beam('additive fishing net post', (xx, y, z), (xx, y, z + .86), .035, wood)
for row in range(5):
    line('additive fishing net horizontal', [(x - .4, y, z + .21 + row * .14), (x, y + .025, z + .16 + row * .14), (x + .4, y, z + .21 + row * .14)], .009, rope)
for col in range(7):
    xx = x - .4 + col * .8 / 6
    line('additive fishing net vertical', [(xx, y, z + .20), (xx, y + .02, z + .77)], .008, rope)
for xx, yy, size in [(x + .30, y + .33, .34), (x - .18, y + .34, .27)]:
    zz = grounded(xx, yy)
    cube('additive fishers wooden crate', (xx, yy, zz + size / 2), (size, size * .82, size), woodlight, .025)
    for dz in [-.07, .07]:
        cube('additive crate brace', (xx, yy - size * .43, zz + size / 2 + dz), (size, .018, .04), wood, .004)
beam('additive fishing rod', (x + .46, y + .09, z), (x + .76, y + .10, z + 1.08), .014, wood)
line('additive fishing line', [(x + .76, y + .10, z + 1.08), (x + .85, y - .10, z + .23)], .003, rope)
cube('additive folded sand linen', (x - .18, y + .34, z + .30), (.25, .20, .045), fishing_cloth, .009)
end('fishing_corner', before)

before = begin()
x, y = 2.26, 2.36
z = grounded(x, y)
namespace['cyl']('additive keeper pot', (x, y, z + .17), .16, .32, namespace['redroof'], 12, .21)
for angle in [0, 1.5, 3.0, 4.5]:
    ico('additive keeper pot flowers', (x + .12 * math.cos(angle), y + .12 * math.sin(angle), z + .39), (.13, .11, .08), namespace['flower'][int(angle) % 3], 1)
end('keeper_pot', before)

# Same route/standing space, explicitly checked against the added objects only.
def audit_additions():
    bpy.context.view_layer.update(); depsgraph = bpy.context.evaluated_depsgraph_get()
    flags, rays, camera_checks = [], 0, 0
    camera_direction = (camera.location - namespace['target']).normalized()
    for kind, routes in original['worldRoutes'].items():
        for route in routes:
            points = route['world']
            for a, b in zip(points, points[1:]):
                a, b = Vector(a), Vector(b); direction = b - a
                side = Vector((-direction.y, direction.x, 0)).normalized()
                for i in range(max(3, math.ceil(direction.length / .15))):
                    point = a.lerp(b, i / max(3, math.ceil(direction.length / .15)))
                    for offset in [-.12, 0, .12] if kind == 'secret' else [-.23, 0, .23]:
                        p = point + side * offset; rays += 1
                        hit, location, _, _, obj, _ = scene.ray_cast(depsgraph, p + Vector((0, 0, 1.15)), Vector((0, 0, -1)), distance=1.6)
                        if hit and obj.get('enrichment_group') and not obj.get('decorative_floor') and location.z > point.z + .18:
                            flags.append({'type': 'body', 'group': obj['enrichment_group'], 'object': obj.name, 'point': list(point)})
                    for height in [.20, .65, 1.0]:
                        actor = point + Vector((0, 0, height)); camera_checks += 1
                        hit, _, _, _, obj, _ = scene.ray_cast(depsgraph, actor + camera_direction * 35, -camera_direction, distance=34.99)
                        if hit and obj.get('enrichment_group') and not obj.get('decorative_floor'):
                            flags.append({'type': 'view', 'group': obj['enrichment_group'], 'object': obj.name, 'point': list(point)})
    return {'bodyRays': rays, 'cameraRays': camera_checks, 'flags': flags}

first_audit = audit_additions()
rejected = sorted({flag['group'] for flag in first_audit['flags']})
for name in rejected:
    for obj in groups[name]: bpy.data.objects.remove(obj, do_unlink=True)
    del groups[name]
final_audit = audit_additions() if rejected else first_audit
assert not final_audit['flags'], 'Unresolved added-geometry body/view obstruction'
assert all([list(row) for row in obj.matrix_world] == original_matrices[obj.name] for obj in base_objects), 'Base object moved'
assert namespace['metadata']['nodes'] == original['nodes']
report = {'sourceCommit': 'eed5095831a670701f494dbe94c2e7f089f324fa', 'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
          'prototypeOnly': True, 'originalGeometryAndMatricesPreserved': True, 'nodesRoutesCameraPreserved': True,
          'retainedGroups': {name: len(objects) for name, objects in groups.items()}, 'rejectedGroups': rejected,
          'plantAndPropSupport': support_records, 'initialAudit': first_audit, 'finalAudit': final_audit,
          'render': {'width': 960, 'height': 600, 'samples': 24},
          'limits': 'Additive vertical-body and direct camera-ray checks; not full movement/collision validation. Water detail is static. No production asset replaced.'}
(OUT / 'prototype-audit.json').write_text(json.dumps(report, indent=2))
scene.render.filepath = str(OUT / 'costa-after.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'costa-enrichment-prototype.blend'))
render_if_requested()
print('COSTA_ENRICHMENT_READY=' + str(OUT))
print('AUDIT=' + json.dumps({'bodyRays': final_audit['bodyRays'], 'cameraRays': final_audit['cameraRays'], 'rejectedGroups': rejected, 'retainedGroups': list(groups)}))
