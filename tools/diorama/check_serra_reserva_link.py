"""Targeted evaluated-geometry audit of the NEW passenger link and its joins.

blender -b /tmp/link/serra-reserva-link.blend -P tools/diorama/check_serra_reserva_link.py
The old maintenance carriers/routes are only checked against added geometry.
Untouched island art is not rebuilt or repeatedly re-audited by this checker.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import math
import subprocess
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--output', default=None)
p.add_argument('--step', type=float, default=.12)
p.add_argument('--base', default='ca6deac')
args = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene = bpy.context.scene
meta = json.loads(scene['serra_reserva_metadata'])
serra = json.loads(scene['serra_metadata'])
out = Path(args.output) if args.output else Path(bpy.data.filepath).parent/'serra-reserva-clearance.json'
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()


def evaluated(objects, origin=(0, 0, 0)):
    vertices, triangles, names = [], [], []
    for obj in objects:
        mesh_obj = obj.evaluated_get(deps)
        mesh = mesh_obj.to_mesh()
        mesh.calc_loop_triangles()
        start = len(vertices)
        vertices.extend(obj.matrix_world@v.co-Vector(origin) for v in mesh.vertices)
        triangles.extend(tuple(start+j for j in tri.vertices) for tri in mesh.loop_triangles)
        names.extend([obj.name]*len(mesh.loop_triangles))
        mesh_obj.to_mesh_clear()
    return vertices, triangles, names


def bvh(data, offset=(0, 0, 0)):
    return BVHTree.FromPolygons([v+Vector(offset) for v in data[0]], data[1], all_triangles=True)


visible = [o for o in scene.objects if o.type in {'MESH', 'CURVE', 'FONT'} and not o.hide_render]
passenger = evaluated([o for o in visible if o.name.startswith('passenger carrier A')], meta['geometry']['worldFeet']['lower'][0])
maintenance = evaluated([o for o in visible if o.name.startswith('maintenance carrier A')], serra['maintenanceCabin']['departureBerths'][serra['maintenanceCabin']['phase']])
static_objects = [o for o in visible if not o.name.startswith(('passenger carrier ', 'maintenance carrier ')) and
                  o.get('link_group') != 'cables' and not (o.name.startswith('passenger link ') and any(n in o.name for n in ['sheave', 'bracket']))]
static = evaluated(static_objects)
static_bvh = bvh(static)
added = evaluated([o for o in visible if o.get('passenger_link')])
added_bvh = bvh(added)


def sample(path, step):
    for segment, (a, b) in enumerate(zip(path, path[1:])):
        a, b = Vector(a), Vector(b)
        count = max(1, math.ceil((b-a).length/step))
        for j in range(count+1):
            yield a.lerp(b, j/count), segment, j/count


def swept(data, paths, obstacles, obstacle_names):
    contacts, count = [], 0
    for lane, path in enumerate(paths):
        for foot, segment, progress in sample(path, args.step):
            moving = bvh(data, foot)
            names = collections.defaultdict(set)
            for moving_id, fixed_id in moving.overlap(obstacles):
                names[obstacle_names[fixed_id]].add(data[2][moving_id])
            for name, parts in names.items():
                contacts.append({'lane': lane, 'segment': segment, 'progress': progress,
                                 'object': name, 'parts': sorted(parts)})
            count += 1
    return {'poseCount': count, 'contactCount': len(contacts), 'contacts': contacts}


passenger_sweep = swept(passenger, meta['geometry']['worldPassengerPaths'], static_bvh, static[2])
maintenance_sweep = swept(maintenance, serra['maintenanceCabin']['passengerFootPaths'], added_bvh, added[2])

# A grounded query uses evaluated triangles. The stationary cabin floor is
# translated to each berth, including the two berths not occupied in this phase.
walk_data = evaluated([o for o in static_objects if o.name.startswith(('walk_', 'reserva walk_', 'passenger link walk '))])
walk_bvh = bvh(walk_data)
support_failures, support_count = [], 0
ground_right = scene.camera.rotation_euler.to_matrix()@Vector((1, 0, 0))
for terminal in ['lower', 'upper']:
    routes = [meta['geometry']['worldApproaches'][terminal]]+meta['geometry']['worldBoardingRoutes'][terminal]
    for ri, route in enumerate(routes):
        carrier = bvh(passenger, meta['geometry']['worldFeet'][terminal][ri-1]) if ri else None
        for foot, segment, progress in sample(route, .09):
            for across in [-.24, 0, .24]:
                origin = foot+ground_right*across+Vector((0, 0, .045))
                candidates = [walk_bvh.ray_cast(origin, Vector((0, 0, -1)), .16)]
                if carrier:
                    candidates.append(carrier.ray_cast(origin, Vector((0, 0, -1)), .16))
                # Released landing caps sit .018-.019 above their path anchors.
                hits = [hit for hit in candidates if hit[0] is not None and foot.z-.065 <= hit[0].z <= foot.z+.030]
                if not hits:
                    support_failures.append({'terminal': terminal, 'route': ri, 'segment': segment,
                                             'progress': progress, 'across': across, 'foot': list(foot)})
                support_count += 1

# Exact opaque original-Feka head pixels, not a resized proxy cylinder. Body
# occlusions are also recorded, with <=.12-high sole contact classified separately.
source = json.loads(subprocess.check_output(['node', str(ROOT/'tools/diorama/export_serra_sprite.mjs')], text=True))
basis = scene.camera.rotation_euler.to_matrix()
right, up, toward = [basis@Vector(v) for v in [(1, 0, 0), (0, 1, 0), (0, 0, 1)]]
pixel = source['pixelMapWidth']*20.6
pixels = [(x, y) for y, row in enumerate(source['frames']['idle']) for x, symbol in enumerate(row) if symbol != '_']


def actor_visibility(routes, obstacle, names, step=.16):
    heads, bodies, count = [], [], 0
    for label, path in routes:
        for foot, segment, progress in sample(path, step):
            head_objects, body_objects = set(), set()
            for x, y in pixels:
                q = foot+right*((x-7.5)*pixel)+Vector((0, 0, (25.5-y)*pixel/up.z))+toward*.02
                hit = obstacle.ray_cast(q, toward, 100)
                if hit[0] is None:
                    continue
                if y < 12:
                    head_objects.add(names[hit[2]])
                elif hit[0].z > foot.z+.12:
                    body_objects.add(names[hit[2]])
            record = {'route': label, 'segment': segment, 'progress': progress}
            if head_objects:
                heads.append({**record, 'objects': sorted(head_objects)})
            if body_objects:
                bodies.append({**record, 'objects': sorted(body_objects)})
            count += 1
    return {'poseCount': count, 'headContactCount': len(heads), 'bodyContactCount': len(bodies),
            'headContacts': heads, 'bodyContacts': bodies}


new_routes = []
for terminal in ['lower', 'upper']:
    new_routes.append((terminal+' approach', meta['geometry']['worldApproaches'][terminal]))
    new_routes += [(terminal+' board '+str(i), route) for i, route in enumerate(meta['geometry']['worldBoardingRoutes'][terminal])]
new_routes += [('passenger ride '+str(i), path) for i, path in enumerate(meta['geometry']['worldPassengerPaths'])]
new_visibility = actor_visibility(new_routes, static_bvh, static[2])
old_routes = []
for kind, routes in serra['worldRoutes'].items():
    old_routes += [('maintenance source '+kind+' '+str(i), item['world']) for i, item in enumerate(routes)]
old_routes += [('maintenance ride '+str(i), path) for i, path in enumerate(serra['maintenanceCabin']['passengerFootPaths'])]
old_visibility = actor_visibility(old_routes, added_bvh, added[2])

# Conservative independent-phase screen envelopes prove the passenger system
# never paints over any position of the released maintenance pair.
old_meta = json.loads((ROOT/'public/assets/world/map/serra-maintenance-cable.meta.json').read_text())


def frame_bounds(point, frame):
    px = frame['widthInMap']/frame['width']
    return (point['x']-frame['passengerFoot']['x']*px,
            point['y']-frame['passengerFoot']['y']*px*1.6,
            point['x']+(frame['width']-frame['passengerFoot']['x'])*px,
            point['y']+(frame['height']-frame['passengerFoot']['y'])*px*1.6)


old_rects = [frame_bounds({'x': q['x']+2.78, 'y': q['y']-.65}, old_meta['frame']) for lane in old_meta['lanes'].values() for q in lane['pathPoints']]
overlaps = []
for lane_name, lane in meta['lanes'].items():
    for i, q in enumerate(lane['pathPoints']):
        a = frame_bounds(q, meta['frame'])
        for j, b in enumerate(old_rects):
            if a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]:
                overlaps.append({'lane': lane_name, 'knot': i, 'oldEnvelope': j})

source_hashes = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() == sha for name, sha in meta['sources'].items()}
released_files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', args.base, '--', 'public/assets/world/map'], cwd=ROOT, text=True).splitlines()
protected = ['tools/diorama/render_serra_map.py']+[name for name in released_files if Path(name).name.startswith('serra-')]
protected_drift = subprocess.check_output(['git', 'diff', '--name-only', args.base, '--', *protected], cwd=ROOT, text=True).splitlines()
released = json.loads((ROOT/'public/assets/world/map/serra-diorama.meta.json').read_text())
node_matches = all(abs(serra['nodes'][k][axis]-released['nodes'][k][axis]) < 1e-6 for k in serra['nodes'] for axis in ['x', 'y'])
preserved = {'recordedSourceHashesMatch': source_hashes, 'releasedSerraNodesUnchanged': node_matches,
             'protectedFilesChanged': protected_drift, 'originalObjectTransformsUnchanged': meta['sourcePreservation']['serraOriginalObjectsUnchanged'],
             'maintenancePassengerFrameOverlapCount': len(overlaps), 'maintenancePassengerFrameOverlaps': overlaps}
passed = not (passenger_sweep['contactCount'] or maintenance_sweep['contactCount'] or support_failures or
              new_visibility['headContactCount'] or old_visibility['headContactCount'] or
              new_visibility['bodyContactCount'] or old_visibility['bodyContactCount'] or overlaps or protected_drift)
passed = passed and all(source_hashes.values()) and node_matches and preserved['originalObjectTransformsUnchanged']
report = {'passed': passed, 'scope': 'Frozen new passenger link only; released maintenance preservation checked against added geometry',
          'blend': bpy.data.filepath, 'step': args.step,
          'method': 'Evaluated triangle intersections; exact grounded triangle rays; all original opaque actor pixels ray-cast toward the common camera; independent phase conservative maintenance/passenger frame bounds. Own passenger cable and terminal sheave contact are explicit running interfaces.',
          'passengerSweep': passenger_sweep, 'maintenancePreservationSweep': maintenance_sweep,
          'support': {'poseCount': support_count, 'failureCount': len(support_failures), 'failures': support_failures},
          'newActorVisibility': new_visibility, 'oldActorPreservation': old_visibility, 'preservation': preserved}
out.write_text(json.dumps(report, indent=2)+'\n')
print('PASSENGER_LINK_AUDIT='+json.dumps({'passed': passed, 'passengerContacts': passenger_sweep['contactCount'],
      'maintenanceContacts': maintenance_sweep['contactCount'], 'supportFailures': len(support_failures),
      'newHeadContacts': new_visibility['headContactCount'], 'oldHeadContacts': old_visibility['headContactCount'],
      'bodyContacts': new_visibility['bodyContactCount'], 'output': str(out)}), flush=True)
if not passed:
    raise SystemExit(1)
