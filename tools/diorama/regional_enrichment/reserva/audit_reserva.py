"""Rebuild and audit Reserva's frozen base island; no cached .blend dependency.

blender -b -t 8 -P tools/diorama/check_reserva_map.py -- --output-dir /tmp/reserva-audit
Audits all four main edges, the shipping shortcut and retained station approach.
The separate inter-island source owns additive terminals, cabins and their audits.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', default='/tmp/feka-reserva-audit')
parser.add_argument('--scene', required=True)
parser.add_argument('--step', type=float, default=.10)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
assert 0 < args.step <= .15
ROOT = Path(__file__).resolve().parent
OUT = Path(args.output_dir)
OUT.mkdir(parents=True, exist_ok=True)
BUILDER = ROOT / 'enrich_reserva.py'
bpy.ops.wm.open_mainfile(filepath=str(Path(args.scene).resolve()))
scene = bpy.context.scene
meta = json.loads(scene['reserva_metadata'])
source = json.loads((ROOT / 'source/feka-sprite.json').read_text())
cam = scene.camera
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
basis = cam.rotation_euler.to_matrix()
right, up, toward = [basis @ Vector(v) for v in [(1, 0, 0), (0, 1, 0), (0, 0, 1)]]
pixel = source['pixelMapWidth'] * cam.data.ortho_scale
head_height = 26 * pixel / up.z
started = time.monotonic()

# One evaluated triangle BVH gives actual rendered foreground visibility. Closed
# mesh containment separately catches bodies starting inside solid equipment.
vertices, triangles, objects, walk_triangles, walk_objects, solids, foundations = [], [], [], [], [], [], []
for obj in scene.objects:
    if obj.type not in {'MESH', 'CURVE', 'FONT', 'SURFACE'} or obj.hide_render:
        continue
    evaluated = obj.evaluated_get(deps)
    me = evaluated.to_mesh()
    if me is None:
        continue
    me.calc_loop_triangles()
    world_vertices = [obj.matrix_world @ v.co for v in me.vertices]
    local_triangles = [tuple(t.vertices) for t in me.loop_triangles]
    offset = len(vertices)
    vertices.extend(world_vertices)
    new_triangles = [tuple(offset + i for i in t) for t in local_triangles]
    triangles.extend(new_triangles)
    objects.extend([obj.name] * len(new_triangles))
    if obj.name.startswith('walk_'):
        walk_triangles.extend(new_triangles)
        walk_objects.extend([obj.name] * len(new_triangles))
    counts = collections.Counter()
    for face in me.polygons:
        ids = list(face.vertices)
        for a, b in zip(ids, ids[1:] + ids[:1]):
            counts[tuple(sorted((a, b)))] += 1
    bvh = BVHTree.FromPolygons(world_vertices, local_triangles, all_triangles=True)
    if counts and all(n == 2 for n in counts.values()):
        solids.append((obj.name, bvh, tuple(min(v[i] for v in world_vertices) for i in range(3)),
                       tuple(max(v[i] for v in world_vertices) for i in range(3))))
    if obj.name in {'continuous ice-bound bedrock', 'walk_cold-store foundation', 'walk_western chamber terrace'}:
        foundations.append((obj.name, bvh))
    evaluated.to_mesh_clear()
scene_bvh = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
walk_bvh = BVHTree.FromPolygons(vertices, walk_triangles, all_triangles=True)


def ray(origin, direction, distance=40):
    loc, normal, index, depth = scene_bvh.ray_cast(origin, direction, distance)
    return None if loc is None else (objects[index], loc, depth)


def inside(bvh, point):
    near, normal, index, distance = bvh.find_nearest(point)
    if near is None or distance <= .002:
        return False
    votes = 0
    for vector in [(1, .317, .239), (.271, 1, .317), (.193, .283, 1)]:
        direction = Vector(vector).normalized()
        origin = point.copy()
        count = 0
        for _ in range(100):
            loc, normal, index, depth = bvh.ray_cast(origin, direction, 100)
            if loc is None:
                break
            count += 1
            origin = loc + direction * .00002
        votes += count % 2
    return votes >= 2


samples = []
for group, routes in meta['worldRoutes'].items():
    for ri, route in enumerate(routes):
        for si, (aa, bb) in enumerate(zip(route['world'], route['world'][1:])):
            a, b = Vector(aa), Vector(bb)
            side = Vector((-(b - a).y, (b - a).x, 0)).normalized()
            count = max(2, math.ceil((b - a).length / args.step))
            for j in range(count + 1):
                samples.append(({'route': group + ':' + str(ri), 'segment': si, 't': round(j / count, 6)},
                                a.lerp(b, j / count), side))
physical_counts = collections.Counter()
physical_examples = collections.defaultdict(list)


def physical_issue(kind, record):
    physical_counts[kind] += 1
    if len(physical_examples[kind]) < 12:
        physical_examples[kind].append(record)


for identity, foot, side in samples:
    for off in [-.28, 0, .28]:
        q = foot + side * off
        loc, normal, index, depth = walk_bvh.ray_cast(q + Vector((0, 0, .08)), Vector((0, 0, -1)), .30)
        if loc is None or abs(loc.z - foot.z) > .055:
            physical_issue('footSupport', {**identity, 'side': off, 'object': walk_objects[index] if loc is not None else None,
                                           'heightDelta': round(loc.z - foot.z, 6) if loc is not None else None})
        hit = ray(q + Vector((0, 0, .16)), Vector((0, 0, 1)), head_height - .16)
        if hit:
            physical_issue('headroom', {**identity, 'side': off, 'object': hit[0]})
        for name, bvh, low, high in solids:
            if not low[0] < q.x < high[0] or not low[1] < q.y < high[1] or high[2] < foot.z + .16:
                continue
            for height in [.20, .50, .85]:
                probe = q + Vector((0, 0, height))
                if low[2] < probe.z < high[2] and inside(bvh, probe):
                    physical_issue('solidBodyContainment', {**identity, 'side': off, 'object': name, 'height': height})
                    break

anchors = []
for obj in scene.objects:
    if 'bedrock-rooted pier' not in obj.name or obj.name.startswith('reserved heated western dock'):
        continue
    bounds = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
    base, top = min(p.z for p in bounds), max(p.z for p in bounds)
    terrain = []
    for name, bvh in foundations:
        loc, normal, index, depth = bvh.ray_cast(Vector((obj.location.x, obj.location.y, 20)), Vector((0, 0, -1)), 40)
        if loc is not None:
            terrain.append((loc.z, name))
    highest = max(terrain) if terrain else None
    rooted = highest is not None and base <= highest[0] + .04
    anchors.append({'object': obj.name, 'baseZ': round(base, 6), 'topZ': round(top, 6),
                    'foundation': highest[1] if highest else None, 'rooted': rooted})
    if not rooted:
        physical_issue('unrootedPier', {'object': obj.name, 'baseZ': base})

# Exact original source masks:7 animation frames,2 facings. Every opaque square
# contributes its center and four inset corners; membership retains head/face data.
opaque = {}
raster_cells = {}
for frame, rows in source['frames'].items():
    head_y = 1 if frame in {'walk2', 'walk5'} else 0
    for flip in [False, True]:
        for y, row in enumerate(rows):
            for x, color in enumerate(row):
                if color == '_':
                    continue
                xx = 15 - x if flip else x
                head = y <= head_y + 11 and 3 <= x <= 14
                face = head and color in 'SsL'
                for fx, fy in [(.5, .5), (.08, .08), (.92, .08), (.08, .92), (.92, .92)]:
                    key = (xx + fx - 8, 26 - y - fy)
                    old = opaque.get(key, (False, False))
                    opaque[key] = (head or old[0], face or old[1])
                old = raster_cells.get((xx, y), (False, False))
                raster_cells[(xx, y)] = (head or old[0], face or old[1])


def visibility_report():
    return {'rayCount': 0, 'bodyContacts': collections.Counter(), 'footContacts': collections.Counter(),
            'headContacts': 0, 'faceContacts': 0, 'firstContacts': {}}


def contact(report, hit, identity, height, head, face):
    name, location, depth = hit
    report['footContacts' if height <= 2 else 'bodyContacts'][name] += 1
    report['headContacts'] += head
    report['faceContacts'] += face
    report['firstContacts'].setdefault(name, {**identity, 'heightInSourcePixels': round(height, 4),
                                            'world': [round(v, 5) for v in location]})


continuous = visibility_report()
for identity, foot, side in samples:
    for (px, py), (head, face) in opaque.items():
        q = foot + right * (px * pixel) + Vector((0, 0, py * pixel / up.z))
        continuous['rayCount'] += 1
        hit = ray(q + toward * .012, toward)
        if hit:
            contact(continuous, hit, identity, py, head, face)

profiles = []
for name, width, height, zoom in [('desktop', 1180, 757, 1.0), ('portrait', 400, 606, 1.05), ('landscape', 846, 392, 1.0)]:
    report = visibility_report()
    canvas = min(width / 1.6, height) * 1.6 * zoom
    scale = canvas * source['pixelMapWidth']
    size = math.ceil(scale)
    for identity, foot, side in samples:
        p = world_to_camera_view(scene, cam, foot)
        fx, fy = (p.x - .5) * canvas + width / 2, (.5 - p.y) * canvas / 1.6 + height / 2
        pixels = {}
        for (sx, sy), (head, face) in raster_cells.items():
            x0, y0 = math.floor(fx + (sx - 8) * scale + .5), math.floor(fy + (sy - 26) * scale + .5)
            for dx in range(size):
                for dy in range(size):
                    key = x0 + dx + .5, y0 + dy + .5
                    old = pixels.get(key, (False, False))
                    pixels[key] = head or old[0], face or old[1]
        for (x, y), (head, face) in pixels.items():
            q = foot + right * ((x - fx) / canvas * cam.data.ortho_scale) + Vector((0, 0, (fy - y) / canvas * cam.data.ortho_scale / up.z))
            report['rayCount'] += 1
            hit = ray(q + toward * .012, toward)
            if hit:
                contact(report, hit, identity, (fy - y) / scale, head, face)
    profiles.append({'profile': name, 'viewport': [width, height], 'zoom': zoom,
                     'actorScaleCssPixels': scale, 'paintPixelSize': size, **report})

passed = not physical_counts and not continuous['bodyContacts'] and all(not p['bodyContacts'] for p in profiles)
result = {'status': 'PASS' if passed else 'FAIL',
          'scope': 'Enriched Reserva base: all four main routes, freight shortcut and retained station approach, all five landings. New addition contacts against the full passenger and ferry boarding paths are tested separately by audit_connectors.py. Runtime compositing and inter-island motion remain integration gates.',
          'builder': {'path': str(BUILDER.relative_to(ROOT)), 'sha256': hashlib.sha256(BUILDER.read_bytes()).hexdigest()},
          'checker': {'path': str(Path(__file__).relative_to(ROOT)), 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
          'metadataSha256': hashlib.sha256(json.dumps(meta, sort_keys=True).encode()).hexdigest(),
          'methods': {'physical': 'Evaluated triangles:three footprint rays, upright headroom, closed-solid containment, and every active-route pier rooted into authored bedrock/foundation.',
                      'source': 'Original idle plus6 walk frames, both facings, every opaque square center plus4 inset corners, world-vertical actor plane and camera-directed rays.',
                      'raster': 'Exact Math.round pixel origin and Math.ceil square size from paintMapActor at occupied CSS-pixel centers. Fixed review profiles at island scale1; browser camera fitting remains a separate runtime gate.',
                      'footContacts': 'Original source pixels at height<=2 are reported separately. They include intended floor contact and fractional CSS footprint overlap; no contact is silently discarded.'},
          'sampleStepWorld': args.step, 'routeSampleCount': len(samples), 'footprintRayCount': len(samples) * 3,
          'headroomRayCount': len(samples) * 3, 'actualFekaWorldPixel': pixel, 'actualFekaWorldHeight': head_height,
          'physicalCounts': dict(physical_counts), 'physicalExamples': dict(physical_examples),
          'pierCount': len(anchors), 'piers': anchors, 'sourceProjection': continuous, 'rasterProfiles': profiles,
          'elapsedSeconds': round(time.monotonic() - started, 2)}
(OUT / 'reserva-validation.json').write_text(json.dumps(result, indent=2) + '\n')
print('RESERVA_FINAL_AUDIT=' + json.dumps({'status': result['status'], 'routeSamples': len(samples),
      'physical': dict(physical_counts), 'pierCount': len(anchors), 'sourceBody': dict(continuous['bodyContacts']),
      'rasterBody': {p['profile']: dict(p['bodyContacts']) for p in profiles}, 'seconds': result['elapsedSeconds']}), flush=True)
assert passed, 'Reserva frozen-base gate failed; inspect reserva-validation.json'
