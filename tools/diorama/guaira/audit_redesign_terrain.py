"""Independent support audit of a fully generated Guaíra Blender scene.

blender -b FINAL.blend -t 4 -P tools/diorama/guaira/audit_redesign_terrain.py -- \
    --output REPORT.json

Uses the loaded scene's actual evaluated geometry. Terrain support excludes
walk meshes, water, props and decorative cliff skins; those must not disguise
an empty space below a foundation. This is geometric QA, not gameplay QA.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
scene = bpy.context.scene
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
solid_names = ('Continuous clay island', 'Civic terrace', 'Civic continuous earthen ascent')
assert all(name in scene.objects for name in solid_names), 'Missing redesigned terrain solid'


def world_bvh(ob):
    evaluated = ob.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    tree = BVHTree.FromPolygons(
        [evaluated.matrix_world @ v.co for v in mesh.vertices],
        [tuple(triangle.vertices) for triangle in mesh.loop_triangles],
        all_triangles=True)
    evaluated.to_mesh_clear()
    return tree


# The core and shelf are sufficient even if every decorative fracture is hidden.
terrain = [(name, world_bvh(scene.objects[name])) for name in solid_names]
facing = [(ob.name, world_bvh(ob)) for ob in scene.objects
          if ob.type == 'MESH' and ob.name.startswith('Civic fitted retaining stone ')]


def highest_below(x, y, start_z, objects=terrain):
    hits = []
    for name, tree in objects:
        position, normal, index, distance = tree.ray_cast(
            Vector((x, y, start_z)), Vector((0, 0, -1)), 12)
        if position is not None:
            hits.append((float(position.z), name))
    return max(hits, default=(None, None))


def support_record(name, point, contact_z, ray_z, tolerance):
    z, support = highest_below(point.x, point.y, ray_z)
    gap = None if z is None else contact_z - z
    return {'name': name, 'point': [round(v, 5) for v in point],
            'contactZ': contact_z, 'groundZ': z, 'support': support,
            'gap': gap, 'supported': gap is not None and gap <= tolerance}


def summarize(records):
    failures = [record for record in records if not record['supported']]
    return {'sampleCount': len(records), 'unsupportedCount': len(failures),
            'maximumGap': max((r['gap'] for r in records if r['gap'] is not None), default=None),
            'failures': failures}


# Required inhabited footprints agreed between terrain, building and farm
# authors. These are contact zones, not camera-space bounding rectangles.
footprints = [
    ('Neighborhood', -5.11, -3.69, .68, 1.92, 1.75),
    ('Repair and work bay', -3.36, -1.26, .65, 1.89, 1.75),
    ('Granary', -5.84, -4.76, 1.93, 3.06, 1.75),
    ('Windpump', -3.92, -3.48, 2.90, 3.30, 1.75),
    ('Civic hall and porch', -.61, 1.81, 2.91, 4.535, 2.40),
    ('Civic tank', -1.31, -.69, 3.49, 4.11, 2.40),
    ('Upper field', 3.88, 5.83, -1.77, -.30, 1.75),
    ('Lower field', 3.88, 5.84, -3.82, -2.10, 1.75),
    ('Cross field', 1.13, 3.66, -4.29, -3.48, 1.75),
    ('Keeper pad', 5.95, 6.70, -2.70, -1.30, 1.75),
    ('Reservoir service approach', 5.62, 6.10, 1.70, 3.20, 1.75),
    ('Southeast canal return', 6.10, 6.21, -4.20, -4.09, 1.75),
]
footprint_checks = {}
for name, x0, x1, y0, y1, contact in footprints:
    records = []
    for i in range(11):
        for j in range(11):
            point = Vector((x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * j / 10, contact))
            records.append(support_record(name, point, contact, contact + .003, .025))
    footprint_checks[name] = summarize(records)

# Interpolate each actual route mesh's paired upper vertices. No metadata or
# assumed slope replaces the final source geometry; the full width is checked.
route_underbodies, intrusions = [], []
intrusion_count = 0
for name in ('walk_0', 'walk_1', 'walk_2', 'walk_3'):
    ob = scene.objects[name]
    vertices = [ob.matrix_world @ v.co for v in ob.data.vertices]
    top = vertices[:len(vertices) // 2]
    for i in range(0, len(top) - 2, 2):
        for j in range(21):
            a, b = top[i].lerp(top[i + 2], j / 20), top[i + 1].lerp(top[i + 3], j / 20)
            for lateral in (0, .15, .5, .85, 1):
                point = a.lerp(b, lateral)
                route_underbodies.append(support_record(name, point, point.z - .10, point.z + .003, .015))
        for j in range(51):
            a, b = top[i].lerp(top[i + 2], j / 50), top[i + 1].lerp(top[i + 3], j / 50)
            for lateral in (0, .1, .25, .5, .75, .9, 1):
                point = a.lerp(b, lateral)
                z, hit = highest_below(point.x, point.y, 8, terrain + facing)
                intrusion_count += 1
                if z is not None and z > point.z + .012:
                    intrusions.append({'route': name, 'point': list(point),
                                       'object': hit, 'groundZ': z, 'excess': z - point.z})

# Probe each actual clearing's lower perimeter rather than just its center.
node_perimeters = []
for number in range(1, 6):
    name = 'walk_guaira-%d clearing' % number
    ob = scene.objects[name]
    vertices = [ob.matrix_world @ v.co for v in ob.data.vertices]
    bottom, top_z = min(p.z for p in vertices), max(p.z for p in vertices)
    for point in vertices:
        if abs(point.z - bottom) < .0001:
            node_perimeters.append(support_record(name, point, bottom, top_z + .003, .03))

# Raw shared-edge topology proves each support is a closed authored volume.
# The decorative exposed cliff panels are intentionally open facing meshes.
closed = []
for name in solid_names:
    mesh = scene.objects[name].data
    counts = Counter(edge for polygon in mesh.polygons for edge in polygon.edge_keys)
    bad = sum(count != 2 for count in counts.values())
    closed.append({'name': name, 'faces': len(mesh.polygons),
                   'boundaryEdges': sum(count == 1 for count in counts.values()),
                   'nonManifoldEdges': bad, 'closed': bool(counts) and bad == 0})

report = {
    'sceneFile': bpy.data.filepath,
    'supportObjects': list(solid_names),
    'footprints': footprint_checks,
    'routeUnderbodies': summarize(route_underbodies),
    'nodePerimeters': summarize(node_perimeters),
    'terrainIntrusions': {'sampleCount': intrusion_count, 'count': len(intrusions), 'failures': intrusions},
    'closedSolids': closed,
}
report['passed'] = (all(r['unsupportedCount'] == 0 for r in footprint_checks.values())
                    and report['routeUnderbodies']['unsupportedCount'] == 0
                    and report['nodePerimeters']['unsupportedCount'] == 0
                    and not intrusions and all(r['closed'] for r in closed))
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print('GUAIRA_TERRAIN_AUDIT=' + json.dumps({
    'passed': report['passed'],
    'footprintSamples': sum(r['sampleCount'] for r in footprint_checks.values()),
    'routeSamples': len(route_underbodies), 'nodeSamples': len(node_perimeters),
    'intrusionSamples': intrusion_count, 'output': str(output)}))
assert report['passed'], 'Unsupported or obstructing Guaíra terrain; inspect ' + str(output)
