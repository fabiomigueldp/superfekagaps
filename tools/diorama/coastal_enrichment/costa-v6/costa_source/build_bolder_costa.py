# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Ambitious but bounded Costa art prototype, built on the approved scratch scene."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector

OUT = Path(os.environ["FEKA_OUTPUT_DIR"])
ROOT = Path(os.environ["FEKA_REPO_ROOT"])
# Apply organic water and the enlarged net, before its separate audit/render tail.
revision = (OUT / 'refine_shoreline.py').read_text().split('# Reuse the exact first-pass')[0]
exec(compile(revision, str(OUT / 'refine_shoreline.py'), 'exec'), globals())
random.seed(90311)

def material(name, rgb):
    item = bpy.data.materials.new(name); item.use_nodes = True
    shader = item.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*tuple(((v + .055) / 1.055) ** 2.4 for v in rgb), 1)
    shader.inputs['Roughness'].default_value = .82
    return item

leaf_dark = material('v3 shaded broad foliage', (.13, .34, .12))
leaf_mid = material('v3 broadleaf spring green', (.29, .52, .14))
leaf_light = material('v3 young foliage green', (.43, .62, .20))
flower_coral = material('v3 coral flower groups', (.84, .34, .20))
flower_ivory = material('v3 ivory flower groups', (.98, .88, .57))
rock_dark = material('v3 damp lower sandstone', (.57, .42, .29))
rock_mid = material('v3 weathered ochre sandstone', (.79, .57, .34))
rock_light = material('v3 pale exposed sandstone', (.89, .69, .44))
linen = material('v3 warm fishers linen canopy', (.91, .79, .53))

def tag(obj, name, group):
    obj.name = 'prototype v3 ' + name
    obj['enrichment_group'] = group; obj['decorative_floor'] = False
    return obj

def polygon_mesh(name, vertices, faces, palette, group):
    data = bpy.data.meshes.new(name); data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    for mat in palette: data.materials.append(mat)
    for face in data.polygons: face.material_index = min(len(palette) - 1, face.index % len(palette))
    return tag(obj, name, group)

def soft_cube(name, location, size, mat, group, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location); obj = bpy.context.object; obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('worked rounded corners', 'BEVEL'); modifier.width = bevel; modifier.segments = 2
        obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return tag(obj, name, group)

def stone(name, location, size, mat, group):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object; obj.scale = size; obj.data.materials.append(mat)
    return tag(obj, name, group)

def twig(name, points, radius, mat, group):
    obj = curve(name, points, radius, mat)
    return tag(obj, name, group)

original_metadata = json.loads((ROOT / 'public/assets/world/map/costa-diorama.meta.json').read_text())
samples = []
for routes in original_metadata['worldRoutes'].values():
    for route in routes:
        for a, b in zip(route['world'], route['world'][1:]):
            a, b = Vector(a), Vector(b)
            samples.extend(a.lerp(b, i / 16) for i in range(17))

# Existing strata get wider coherent weathering and a small amount of cleft relief
# only away from walking lines. No boolean cuts or stair edits are involved.
geology_names = ['western bridge headland', 'central green backbone', 'east lower climbing terrace', 'east lighthouse bastion', 'far west low outcrop', 'right sea stack']
changed_vertices = 0
for name in geology_names:
    obj = bpy.data.objects[name]
    low, high = min(v.co.z for v in obj.data.vertices), max(v.co.z for v in obj.data.vertices)
    center_x = sum(v.co.x for v in obj.data.vertices) / len(obj.data.vertices)
    center_y = sum(v.co.y for v in obj.data.vertices) / len(obj.data.vertices)
    for vertex in obj.data.vertices:
        relative_z = (vertex.co.z - low) / (high - low)
        if .07 < relative_z < .77 and min((vertex.co - p).length for p in samples) > .85:
            normal = Vector((vertex.co.x - center_x, vertex.co.y - center_y, 0)).normalized()
            amount = .050 * math.sin(vertex.co.x * 4.7 + vertex.co.y * 3.3 + relative_z * 4)
            vertex.co += normal * amount; changed_vertices += 1
    for mat in [rock_dark, rock_mid, rock_light]: obj.data.materials.append(mat)
    first = len(obj.data.materials) - 3
    for face in obj.data.polygons:
        if face.normal.z > .7: continue
        center = sum((obj.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
        level = (center.z - low) / (high - low) + .055 * math.sin(center.x * 1.8 + center.y)
        face.material_index = first + (0 if level < .20 else 1 if level < .62 else 2)
    obj['enrichment_group'] = 'weathered_geology'; obj['decorative_floor'] = False

# A genuine deep vault with articulated blocks and a larger open intrados. Its
# footprint avoids the existing beach path and secret stair; those are rechecked.
for obj in list(scene.objects):
    if obj.name.startswith(('wind carved sandstone arch', 'arch weathered ridge', 'arch crown foliage')):
        bpy.data.objects.remove(obj, do_unlink=True)
count, cx = 18, -.60
outer, inner = [], []
for i in range(count + 1):
    angle = math.pi - i * math.pi / count
    outer.append((cx + 1.84 * math.cos(angle), .35 + (2.46 + .035 * math.sin(i * 1.7)) * math.sin(angle)))
    inner.append((cx + 1.16 * math.cos(angle), .33 + 1.91 * math.sin(angle)))
for i in range(count):
    front = -2.83 + .045 * math.sin(i * 1.9); back = -1.15 + .025 * math.cos(i)
    points = [(x, y, z) for y in [front, back] for x, z in [outer[i], outer[i + 1], inner[i + 1], inner[i]]]
    obj = polygon_mesh('deep coastal arch block', points, [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],
                       [rock_mid, rock_light, rock_dark], 'deep_arch')
    modifier = obj.modifiers.new('weathered block corners', 'BEVEL'); modifier.width = .034; modifier.segments = 2
    obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')

# Broad, curved fronds and clustered undergrowth create varied foliage masses.
def frond(name, root, angle, length, width, height, group):
    root = Vector(root); direction = Vector((math.cos(angle), math.sin(angle), 0)); side = Vector((-direction.y, direction.x, 0))
    vertices = []
    centers = []
    for i in range(10):
        t = i / 9; center = root + direction * length * t + Vector((0, 0, height * math.sin(t * math.pi * .82)))
        extent = width * math.sin(t * math.pi) ** .8
        centers.append(tuple(center + Vector((0, 0, .013))))
        vertices += [tuple(center - side * extent), tuple(center + Vector((0, 0, .045))), tuple(center + side * extent)]
    faces = []
    for i in range(9): faces += [(3*i,3*i+1,3*i+4,3*i+3),(3*i+1,3*i+2,3*i+5,3*i+4)]
    obj = polygon_mesh(name, vertices, faces, [leaf_mid, leaf_light, leaf_dark], group)
    thickness = obj.modifiers.new('leaf thickness', 'SOLIDIFY'); thickness.thickness = .012
    twig('broad leaf midrib', centers, .009, leaf_light, group)

plant_groups = [
    ('west_lush_understory', (-5.44, -.68, 3.05), [.10, .72, 1.32], .90),
    ('low_cove_foliage', (-6.20, 2.06, 1.65), [-.30, .60, 1.8, 2.8], .85),
    ('east_lush_understory', (5.25, -.47, 2.83), [-.05, .70, 1.5], .90),
    ('backbone_lush_garden', (.50, 2.60, 2.99), [0, .9, 1.8, 2.7], .85),
    ('keeper_flower_garden', (3.16, 3.40, 4.76), [0, .9, 2.0], .65),
]
for group, root, angles, scale in plant_groups:
    for i, angle in enumerate(angles): frond('large sculpted coastal leaf', root, angle, scale * (1.0 + .12 * i), .20 * scale, .64 * scale, group)
    for i in range(8):
        angle = i * 2.4; radius = .18 + .055 * (i % 3)
        p = Vector(root) + Vector((math.cos(angle) * radius, math.sin(angle) * radius, .11 + .06 * (i % 2)))
        stone('soft grouped coastal leaves', p, (.22 * scale, .18 * scale, .17 * scale), [leaf_dark, leaf_mid, leaf_light][i % 3], group)
    for i in range(4):
        p = Vector(root) + Vector((-.24 + .17 * i, -.17, .30 + .06 * (i % 2)))
        twig('flower stalk', [tuple(p - Vector((0, 0, .18))), tuple(p)], .009, leaf_dark, group)
        for j in range(4):
            offset = Vector((.055 * math.cos(j * math.tau / 4), .055 * math.sin(j * math.tau / 4), 0))
            stone('grouped flower petal', p + offset, (.065, .053, .027), flower_coral if i % 2 else flower_ivory, group)

# Trailing foliage belongs to the cliff/arch edges, never loose floating sprigs.
for index, (x, y, z, length) in enumerate([(-5.55,-.80,3.0,1.03),(-3.66,-.86,3.0,.75),(5.55,-1.01,2.78,.96),(-1.09,-2.87,2.63,.77),(.15,-2.88,2.52,.63)]):
    group = 'cliff_vines_' + str(index)
    points = [(x + .045 * math.sin(i * .8), y - .012 * i, z - length * i / 10) for i in range(11)]
    twig('rooted trailing liana', points, .017, leaf_dark, group)
    for i, p in enumerate(points[1:]):
        stone('trailing heart leaf', (p[0] + (.08 if i % 2 else -.08), p[1] - .025, p[2]), (.13, .07, .105), leaf_mid if i % 2 else leaf_light, group)

# Relocate and group the fishing corner on a supported western shore extension,
# away from the clear landing at1-1. A low linen awning gives it a legible silhouette.
for obj in list(scene.objects):
    if obj.get('enrichment_group') == 'fishing_corner_v2':
        obj.location += Vector((-2.86, 1.68, .080))
        obj['enrichment_group'] = 'west_fishing_hamlet'
group = 'west_fishing_hamlet'
center_x, center_y = -7.14, -1.98
for i in range(8):
    soft_cube('supported fishing deck board', (center_x - .73 + i * .205, center_y, .394), (.190, 1.04, .09), woodlight if i % 3 else wood, group, .012)
for xx in [center_x - .67, center_x + .67]:
    for yy in [center_y - .43, center_y + .43]:
        obj = beam('fishers rooted timber pile', (xx, yy, -.18), (xx, yy, .46), .070, wood)
        tag(obj, 'fishers rooted timber pile', group)
for i in range(5):
    soft_cube('shore access board', (-6.40 + i * .16, -1.80, .388), (.145, .60, .08), woodlight, group, .010)
for xx, yy in [(center_x - .66, center_y + .39), (center_x + .12, center_y + .39), (center_x - .66, center_y - .38)]:
    obj = beam('small shelter timber', (xx, yy, .42), (xx, yy, 1.62 if yy > center_y else 1.40), .035, wood)
    tag(obj, 'small shelter timber', group)
vertices = [(center_x-.76,center_y-.43,1.41),(center_x+.17,center_y-.43,1.39),(center_x+.17,center_y+.43,1.64),(center_x-.76,center_y+.43,1.62),
            (center_x-.30,center_y,1.49)]
obj = polygon_mesh('small linen fishing shelter', vertices, [(0,1,4),(1,2,4),(2,3,4),(3,0,4)], [linen], group)
solid = obj.modifiers.new('woven canopy thickness', 'SOLIDIFY'); solid.thickness = .014
for a, b in [(0,1),(1,2),(2,3),(3,0)]: twig('canopy hem', [vertices[a],vertices[b]], .012, rope, group)

# Inspect body and camera corridors before rendering; unsafe individual decorative
# groups are removed, while structural arch failures stop the pass for correction.
original = original_metadata; camera = scene.camera; namespace = {'target': Vector((0,0,2.7))}
source = (OUT / 'build_prototype.py').read_text()
exec('def audit_additions():' + source.split('def audit_additions():',1)[1].split('\nfirst_audit =',1)[0], globals())
first = audit_additions()
unsafe = sorted({flag['group'] for flag in first['flags']})
assert not any(name in ['deep_arch','weathered_geology','west_fishing_hamlet'] for name in unsafe), json.dumps(first['flags'])
for obj in list(scene.objects):
    if obj.get('enrichment_group') in unsafe: bpy.data.objects.remove(obj, do_unlink=True)
final = audit_additions() if unsafe else first
assert not final['flags']
report = {'stage': 'stronger art prototype', 'camera': original['camera'], 'fiveNodeIDsPreserved': list(original['nodes']),
          'routesChanged': False, 'dockAndBoatCorridorChanged': False, 'baseVerticesDressedAwayFromRoutes': changed_vertices,
          'arch': {'previousDepth': .9, 'newDepth': 1.68, 'openingHeightBefore': 1.64, 'openingHeightAfter': 1.91, 'booleanOperations': False},
          'removedUnsafeDecorativeGroups': unsafe, 'initialAudit': first, 'finalAudit': final,
          'limits': 'Same camera/scale; structural art changes in scratch only. Sampled body/view clearance is not a substitute for visual quality or gameplay tests.'}
(OUT / 'bolder-costa-audit.json').write_text(json.dumps(report, indent=2))
scene.cycles.samples = 24; scene.render.resolution_percentage = 50
scene.render.filepath = str(OUT / 'costa-after-v3.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'costa-enrichment-prototype-v3.blend'))
render_if_requested()
print('BOLDER_COSTA_READY=' + str(OUT / 'costa-after-v3.png'))
