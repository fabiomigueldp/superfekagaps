"""Additive passenger cableway between the released Serra and authored Reserva.

Rebuilds both islands from their repository sources. Intermediate scenes and proof
images go to scratch, never the release asset directory. The common 20.6 camera
is solved from metadata; berth coordinates are not screen-space guesses.

blender -b -t 8 -P tools/diorama/render_serra_reserva_link.py -- --build-only
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import runpy
import subprocess
import sys

import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', default='/tmp/feka-serra-reserva-link')
parser.add_argument('--build-only', action='store_true')
parser.add_argument('--render-overlays', action='store_true')
parser.add_argument('--final', action='store_true')
parser.add_argument('--cabin-meta', default=str(ROOT/'public/assets/world/map/reserva-passenger-cabin.meta.json'))
ARGS = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = Path(ARGS.output_dir)
OUT.mkdir(parents=True, exist_ok=True)
PLACEMENTS = {'serra': {'origin': {'x': 2.78, 'y': -.65}, 'scale': 1},
              'reserva': {'origin': {'x': 2.7, 'y': -1.8}, 'scale': 1}}


def coefficients(camera):
    bpy.context.view_layer.update()
    def project(p):
        v = world_to_camera_view(bpy.context.scene, camera, Vector(p))
        return Vector((v.x, 1-v.y))
    origin = project((0, 0, 0))
    return origin, [project(p)-origin for p in [(1, 0, 0), (0, 1, 0), (0, 0, 1)]]


# Build Reserva first; preserve its exact source camera and save our own snapshot.
old_argv = sys.argv[:]
sys.argv = [old_argv[0], '--', '--build-only', '--output-dir', str(OUT/'reserva-source')]
runpy.run_path(str(ROOT/'tools/diorama/render_reserva_map.py'), run_name='reserva_source')
reserva_meta = json.loads(bpy.context.scene['reserva_metadata'])
rc, rm = coefficients(bpy.context.scene.camera)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'reserva-source.blend'))
sys.argv = old_argv
runpy.run_path(str(ROOT/'tools/diorama/render_serra_map.py'),
               init_globals={'FEKA_SERRA_OUT': str(OUT/'serra-source'), 'FEKA_SERRA_BUILD_ONLY': True},
               run_name='serra_source')
scene = bpy.context.scene
camera = scene.camera
serra_meta = json.loads(scene['serra_metadata'])
sc, sm = coefficients(camera)
assert all(abs(m['camera']['orthoScale']-20.6) < 1e-5 for m in [serra_meta, reserva_meta])
original = {o.name: {'matrix': [list(row) for row in o.matrix_world], 'hide_render': o.hide_render}
            for o in scene.objects}
# Blender cannot append from the active file, even after rebuilding its scene.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'serra-source.blend'))

# Project all Reserva geometry into the Serra 3D frame while retaining real Z.
# Matching projection + preserved Z uniquely determine each transformed X/Y.
xy = Matrix(((sm[0].x, sm[1].x), (sm[0].y, sm[1].y))).inverted()
transform = Matrix.Identity(4)
for j in range(3):
    v = xy @ (rm[j] - (sm[2] if j == 2 else Vector((0, 0))))
    transform[0][j], transform[1][j] = v.x, v.y
v = xy @ (rc + Vector((2.7-2.78, -1.8+.65)) - sc)
transform[0][3], transform[1][3] = v.x, v.y
inverse = transform.inverted()
with bpy.data.libraries.load(str(OUT/'reserva-source.blend'), link=False) as (available, loaded):
    loaded.objects = available.objects
reserva_objects = []
for obj in loaded.objects:
    if obj and obj.type in {'MESH', 'CURVE', 'FONT'}:
        obj.name = 'reserva ' + obj.name
        scene.collection.objects.link(obj)
        obj['source_island'] = 'reserva'
        reserva_objects.append(obj)
bpy.context.view_layer.update()
for obj in reserva_objects:
    obj.matrix_world = transform @ obj.matrix_world.copy()
bpy.context.view_layer.update()


def material(name, rgb, metal=0):
    rgb = tuple(((v+.055)/1.055)**2.4 if v > .04045 else v/12.92 for v in rgb)
    mat = bpy.data.materials.new('passenger link '+name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .58
    shader.inputs['Metallic'].default_value = metal
    return mat


blue = material('blue steel', (.19, .33, .41), .25)
cream = material('cream decking', (.88, .84, .68))
ice = material('insulated pale decking', (.69, .79, .83), .15)
dark = material('cable graphite', (.10, .17, .23), .4)
amber = material('warm safety edge', (.95, .64, .20))
stone = material('rooted stone footings', (.46, .48, .52))
red = material('closed line warning', (.72, .19, .13))
GROUPS = {'lower': [], 'upper': [], 'cables': [], 'carrier': []}
SUPPORT = {'lower': [], 'upper': []}


def finish(obj, mat, group):
    obj.data.materials.append(mat)
    obj['passenger_link'] = True
    obj['link_group'] = group
    GROUPS[group].append(obj)
    return obj


def cube(name, at, size, mat, group, bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.name = 'passenger link '+name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat, group)
    if bevel:
        mod = obj.modifiers.new('Manufactured edges', 'BEVEL')
        mod.width, mod.segments = bevel, 2
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def beam(name, a, b, radius, mat, group):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = 'passenger link '+name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, mat, group)


def mesh(name, vertices, faces, mat, group):
    data = bpy.data.meshes.new(name)
    data.from_pydata([tuple(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new('passenger link '+name, data)
    scene.collection.objects.link(obj)
    return finish(obj, mat, group)


def project(p, terminal=None):
    q = world_to_camera_view(scene, camera, Vector(p))
    atlas = Vector((2.78+q.x, -.65+1-q.y))
    if terminal:
        origin = PLACEMENTS['serra' if terminal == 'lower' else 'reserva']['origin']
        atlas -= Vector((origin['x'], origin['y']))
    return {'x': round(atlas.x, 7), 'y': round(atlas.y, 7)}


def add_support_polygon(points, terminal):
    SUPPORT[terminal].append([project(p, terminal) for p in points])


def walkway(name, points, width, terminal):
    """Real continuous joined solids; mitered quad strips also define support."""
    pts = list(map(Vector, points))
    if 'joined passenger deck' in name:
        # The logical last turn remains fixed. A square end apron supports the
        # whole actor footprint and the gate pivot beside that turn.
        pts[-1] += (pts[-1]-pts[-2]).normalized()*.56
    sides = [Vector((-(b-a).y, (b-a).x, 0)).normalized() for a, b in zip(pts, pts[1:])]
    tops = []
    for i, p in enumerate(pts):
        side = sides[0] if i == 0 else sides[-1] if i == len(pts)-1 else (sides[i-1]+sides[i]).normalized()
        extent = width/2/max(.5, side.dot(sides[min(i, len(sides)-1)]))
        tops += [p-side*extent, p+side*extent]
    n = len(tops)
    vertices = tops+[p-Vector((0, 0, .16)) for p in tops]
    faces = []
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        j = i*2
        faces += [(j, j+2, j+3, j+1), (n+j, n+j+1, n+j+3, n+j+2),
                  (j, n+j, n+j+2, j+2), (j+1, j+3, n+j+3, n+j+1)]
        add_support_polygon([tops[j], tops[j+2], tops[j+3], tops[j+1]], terminal)
        side = sides[i]
        for sign in [-1, 1]:
            offset = side*sign*(width/2-.11)
            beam(name+' structural stringer', a+offset-Vector((0, 0, .21)), b+offset-Vector((0, 0, .21)), .065, blue, terminal)
        if 'joined passenger deck' in name:
            # A continuous cantilever girder carries the entire fork back into
            # the existing rock/foundation. No isolated feet over the sea.
            depth = 2.30 if terminal == 'lower' else .80
            count = max(1, math.ceil((b-a).length/1.7))
            for sign in [-1, 1]:
                offset = side*sign*(width/2-.08)
                aa, bb = a+offset-Vector((0, 0, depth)), b+offset-Vector((0, 0, depth))
                beam(name+' continuous lower chord', aa, bb, .105 if terminal == 'lower' else .080, blue, terminal)
                for k in range(count+1):
                    q = a.lerp(b, k/count)+offset
                    beam(name+' girder vertical', q-Vector((0, 0, depth)), q-Vector((0, 0, .21)), .075, blue, terminal)
                for k in range(count):
                    q, r = a.lerp(b, k/count)+offset, a.lerp(b, (k+1)/count)+offset
                    if k % 2:
                        q, r = r, q
                    beam(name+' diagonal girder web', q-Vector((0, 0, depth)), r-Vector((0, 0, .21)), .067, blue, terminal)
            for q in [a, b]:
                beam(name+' torsion crosshead', q-side*(width/2)-Vector((0, 0, depth)),
                     q+side*(width/2)-Vector((0, 0, depth)), .095, blue, terminal)
    faces += [(0, 1, n+1, n), (n-2, 2*n-2, 2*n-1, n-1)]
    return mesh('walk '+name, vertices, faces, cream if terminal == 'lower' else ice, terminal)


LOWER_A = Vector((7.7, 3.3, 5.45))
UPPER_A_LOCAL = Vector((7.9, .05, 1.35))
UPPER_A = transform @ UPPER_A_LOCAL
delta = UPPER_A-LOWER_A
lane_offset = Vector((delta.y, -delta.x, 0)).normalized()*4.5
FEET = {'lower': [LOWER_A, LOWER_A+lane_offset], 'upper': [UPPER_A, UPPER_A+lane_offset]}
LOWER_STAGE = Vector(serra_meta['nodes']['4-5']['world'])
UPPER_STAGE = transform @ Vector(reserva_meta['nodes']['5-1']['world'])
LOWER_PLATFORM = Vector((9.35, 3.3, 5.45))
UPPER_PLATFORM = transform @ Vector((6.25, -1.5, 1.35))
APPROACHES = {
    'lower': [LOWER_STAGE, Vector((5.2, 1.18, 5.45)), Vector((9.35, 1.18, 5.45)), LOWER_PLATFORM],
    'upper': [UPPER_STAGE, transform@Vector((5.4, -1.5, 1.35)), UPPER_PLATFORM]}
BOARDS = {'lower': [], 'upper': []}
DOORS = {'lower': [], 'upper': []}
for i in range(2):
    low, up = FEET['lower'][i], FEET['upper'][i]
    lstage = low+Vector((1.65, 0, 0))
    ustage = up-Vector((1.65, 0, 0))
    ldoor, udoor = low+Vector((.81, 0, 0)), up-Vector((.81, 0, 0))
    low_walk = [LOWER_PLATFORM]
    if i:
        low_walk.append(Vector((lstage.x, LOWER_PLATFORM.y, LOWER_PLATFORM.z)))
    if (low_walk[-1]-lstage).length > 1e-5:
        low_walk.append(lstage)
    low_walk.append(ldoor)
    if i == 0:
        up_walk = [UPPER_PLATFORM, ustage, udoor]
    else:
        up_walk = [UPPER_PLATFORM, transform@Vector((6.25, .05, 1.35)),
                   transform@Vector((6.25, 1.65, 1.35)),
                   Vector((ustage.x, (transform@Vector((6.25, 1.65, 1.35))).y, ustage.z)), ustage, udoor]
    for terminal, route, foot, door in [('lower', low_walk, low, ldoor), ('upper', up_walk, up, udoor)]:
        # Final narrow lip ends at the real door threshold; no solid lies under
        # the carrier floor or in front of the approaching/returning car.
        sign = 1 if terminal == 'lower' else -1
        lip_start = foot+Vector((sign*1.10, 0, 0))
        walkway(terminal+' door lip '+str(i), [lip_start, door], .84, terminal)
        route.insert(len(route)-1, foot+Vector((sign*1.20, 0, 0)))
        BOARDS[terminal].append(route+[foot])
        DOORS[terminal].append(door)
        add_support_polygon([foot+Vector((x, y, 0)) for x, y in [(-.81, -.55), (.81, -.55), (.81, .55), (-.81, .55)]], terminal)

# Existing approaches remain unchanged. Only genuinely new Serra and Reserva
# extensions are rendered, while support metadata includes the exact joins.
walkway('Serra joined passenger deck', [Vector((5.83, 1.18, 5.45)), Vector((9.35, 1.18, 5.45)),
                                       LOWER_PLATFORM, Vector((FEET['lower'][1].x+1.65, 3.3, 5.45)),
                                       FEET['lower'][1]+Vector((1.65, 0, 0))], 1.10, 'lower')
walkway('Reserva joined passenger deck', [UPPER_PLATFORM, transform@Vector((6.25, 1.65, 1.35)),
                                         Vector((FEET['upper'][1].x-1.65, (transform@Vector((6.25, 1.65, 1.35))).y, 1.35)),
                                         FEET['upper'][1]-Vector((1.65, 0, 0))], 1.10, 'upper')
# The Serra girder roots are visibly socketed into the unchanged limestone.
for yy in [.71, 1.65]:
    cube('Serra cliff anchor socket', (4.95, yy, 3.40), (.68, .58, 1.05), blue, 'lower')
    beam('Serra rooted lower chord', (4.95, yy, 3.15), (5.83, yy, 3.15), .13, blue, 'lower')
    beam('Serra cliff diagonal', (4.95, yy, 2.95), (5.83, yy, 5.24), .13, blue, 'lower')
# Reserva's shorter frame bears inside the existing cold-store foundation.
for xx in [5.78, 6.72]:
    q = transform@Vector((xx, -1.5, .90))
    cube('Reserva foundation socket', q, (.40, .55, .72), blue, 'upper')
for terminal, route in APPROACHES.items():
    for a, b in zip(route, route[1:]):
        side = Vector((-(b-a).y, (b-a).x, 0)).normalized()*.50
        add_support_polygon([a-side, b-side, b+side, a+side], terminal)

PATHS = []
for i in range(2):
    a, b = FEET['lower'][i], FEET['upper'][i]
    path = [a.lerp(b, j/48)-Vector((0, 0, .16*4*(j/48)*(1-j/48))) for j in range(49)]
    PATHS.append(path)
    for p, q in zip(path, path[1:]):
        beam('authored overhead cable '+str(i), p+Vector((0, .13, 2.60)), q+Vector((0, .13, 2.60)), .026, dark, 'cables')
    for terminal, foot in [('lower', a), ('upper', b)]:
        sign = 1 if terminal == 'lower' else -1
        post = foot+Vector((sign*2.40, .95, 0))
        base_z = foot.z-(2.30 if terminal == 'lower' else .80)
        deck_bearing = (Vector((post.x, 3.3, foot.z)) if terminal == 'lower' and i == 0 else
                        FEET[terminal][i]+Vector((sign*1.65, 0, 0)))
        base = Vector((post.x, post.y, base_z))
        cube(terminal+' bolted pylon crosshead '+str(i), base, (.38, .38, .22), blue, terminal)
        beam(terminal+' frame-rooted upright '+str(i), base, post+Vector((0, 0, 3.12)), .12, blue, terminal)
        beam(terminal+' pylon base outrigger '+str(i), Vector((deck_bearing.x, deck_bearing.y, base_z)), base, .11, blue, terminal)
        beam(terminal+' pylon diagonal brace '+str(i), deck_bearing-Vector((0, 0, .21)), base, .095, blue, terminal)
        # Above the complete hanger envelope, clear of both end doors and head.
        beam(terminal+' cantilever '+str(i), post+Vector((0, 0, 3.12)), foot+Vector((0, .13, 3.12)), .095, blue, terminal)
        beam(terminal+' sheave bracket '+str(i), foot+Vector((0, .13, 3.12)), foot+Vector((0, .13, 2.77)), .065, blue, terminal)
        cube(terminal+' sheave '+str(i), foot+Vector((0, .13, 2.72)), (.32, .13, .14), amber, terminal)

# Each fixed boarding lip has a modest pivoting safety arm. Open arms lie along
# the outer shoulder, below Feka's head; closed arms visibly cross the doorway.
GATES = []
for terminal in ['lower', 'upper']:
    sign = 1 if terminal == 'lower' else -1
    for i, foot in enumerate(FEET[terminal]):
        pivot = foot+Vector((sign*1.20, .48, .42))
        open_pivot = pivot-Vector((0, 0, .62))
        stem = beam(terminal+' retractable gate pivot '+str(i), open_pivot-Vector((0, 0, .42)), open_pivot, .045, blue, terminal)
        arm = beam(terminal+' B2 gate arm '+str(i), open_pivot, open_pivot+Vector((sign*.96, 0, 0)), .045, red, terminal)
        cube(terminal+' flush gate socket '+str(i), foot+Vector((sign*1.20, .48, -.045)), (.16, .16, .09), blue, terminal, .008)
        arm['gate_moving'] = True
        stem['gate_moving'] = True
        GATES.append((arm, pivot, sign, terminal, stem))


def length(points, screen=False):
    if screen:
        return sum(math.hypot((b['x']-a['x'])*1.6, b['y']-a['y']) for a, b in zip(points, points[1:]))
    return sum((b-a).length for a, b in zip(points, points[1:]))


def support(terminal):
    points = [p for poly in SUPPORT[terminal] for p in poly]
    return {'bounds': {'left': min(p['x'] for p in points), 'top': min(p['y'] for p in points),
                       'right': max(p['x'] for p in points), 'bottom': max(p['y'] for p in points)},
            'polygons': SUPPORT[terminal]}


stations = {}
for terminal, world, stage in [('lower', 4, '4-5'), ('upper', 5, '5-1')]:
    route = APPROACHES[terminal]
    stations[terminal] = {'world': world, 'stage': stage, 'platform': project(route[-1], terminal),
                         'stageToPlatform': [project(p, terminal) for p in route],
                         'approachDurationSeconds': round(length(route)/2.15, 6), 'support': support(terminal)}
lanes = {}
for i, lane in enumerate(['a', 'b']):
    lanes[lane] = {'pathPoints': [project(p) for p in PATHS[i]]}
    for terminal in ['lower', 'upper']:
        route = [project(p, terminal) for p in BOARDS[terminal][i]]
        lanes[lane][terminal] = {'foot': project(FEET[terminal][i], terminal), 'boardingRoute': route,
                                 'doorway': project(DOORS[terminal][i], terminal),
                                 'aboardProgress': round(length(route[:-1], True)/length(route, True), 9),
                                 'boardingDurationSeconds': round(length(BOARDS[terminal][i])/1.7, 6)}

record = {'version': 1, 'connection': 'serra-reserva-passenger', 'coordinateSystem': 'atlas',
          'placements': PLACEMENTS, 'stations': stations, 'lanes': lanes, 'paintOrder': ['b', 'a'],
          'rideDurationSeconds': round(length(PATHS[0])/3.5, 6), 'overlays': [],
          'cablePolylines': [[project(p+Vector((0, .13, 2.60))) for p in path] for path in PATHS],
          'geometry': {'serraCamera': serra_meta['camera'], 'reservaCamera': reserva_meta['camera'],
                       'reservaToSerraMatrix': [list(row) for row in transform],
                       'laneSpacing': lane_offset.length, 'laneOffsetWorld': list(lane_offset),
                       'routeDeltaWorld': list(delta), 'doorXOffset': .81, 'stagingXOffset': 1.20, 'broadWalkXOffset': 1.65,
                       'cableAttachment': [0, .13, 2.60], 'sag': .16,
                       'supportDesign': 'Continuous deep cantilever trusses socketed into existing Serra rock and Reserva foundation; diagonal pylon outriggers; no isolated sea footings',
                       'worldFeet': {t: [list(p) for p in pts] for t, pts in FEET.items()},
                       'worldApproaches': {t: [list(p) for p in pts] for t, pts in APPROACHES.items()},
                       'worldBoardingRoutes': {t: [[list(p) for p in route] for route in routes] for t, routes in BOARDS.items()},
                       'worldPassengerPaths': [[list(p) for p in path] for path in PATHS],
                       'worldDoors': {t: [list(p) for p in pts] for t, pts in DOORS.items()}},
          'sourcePreservation': {'serraOriginalObjectsUnchanged': all(original[n] == {'matrix': [list(r) for r in bpy.data.objects[n].matrix_world], 'hide_render': bpy.data.objects[n].hide_render} for n in original),
                                 'serraNodesAndRoutesUnchanged': True, 'reservaFiveNodesAndRoutesUnchanged': True},
          'sources': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in [Path(__file__), ROOT/'tools/diorama/render_serra_map.py', ROOT/'tools/diorama/render_reserva_map.py', ROOT/'tools/diorama/render_passenger_cabin.py']},
          'status': 'initial-geometry-proof-awaiting-clearance'}
atlas_contract = Path(ARGS.cabin_meta)
bpy.context.view_layer.update()
if atlas_contract.exists():
    cabin_assets = json.loads(atlas_contract.read_text())
    record.update({key: cabin_assets[key] for key in ['atlas', 'frame']})
    for terminal in ['lower', 'upper']:
        points = [p for polygon in SUPPORT[terminal] for p in polygon]
        points += [project(obj.matrix_world@Vector(p), terminal) for obj in GROUPS[terminal] for p in obj.bound_box]
        frame = record['frame']
        px = frame['widthInMap']/frame['width']
        for foot in FEET[terminal]:
            p = project(foot, terminal)
            points += [{'x': p['x']-frame['passengerFoot']['x']*px, 'y': p['y']-frame['passengerFoot']['y']*px*1.6},
                       {'x': p['x']+(frame['width']-frame['passengerFoot']['x'])*px,
                        'y': p['y']+(frame['height']-frame['passengerFoot']['y'])*px*1.6}]
        stations[terminal]['artBounds'] = {'left': min(p['x'] for p in points)-.004, 'top': min(p['y'] for p in points)-.004,
                                         'right': max(p['x'] for p in points)+.004, 'bottom': max(p['y'] for p in points)+.004}
assert record['sourcePreservation']['serraOriginalObjectsUnchanged']
bpy.context.view_layer.update()
(OUT/'serra-reserva-link.meta.json').write_text(json.dumps(record, indent=2)+'\n')
scene['serra_reserva_metadata'] = json.dumps(record)

# Actual authored passenger carriers, never the smaller maintenance proxy.
spec = importlib.util.spec_from_file_location('passenger_cabin', ROOT/'tools/diorama/render_passenger_cabin.py')
cabin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cabin)
before = set(scene.objects)
cabin.build_cabin('passenger carrier A', FEET['lower'][0])
cabin.build_cabin('passenger carrier B', FEET['upper'][1])
for obj in set(scene.objects)-before:
    obj['link_group'] = 'carrier'
    GROUPS['carrier'].append(obj)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'serra-reserva-link.blend'))
print('PASSENGER_CONTRACT='+str(OUT/'serra-reserva-link.meta.json'), flush=True)
print('PASSENGER_GEOMETRY='+json.dumps(record['geometry']), flush=True)


def render_crop(path, bounds, density=1200):
    left, top, right, bottom = bounds
    width, height = right-left, bottom-top
    basis = camera.rotation_euler.to_matrix()
    original_location = camera.location.copy()
    camera.location += basis@Vector((((left-2.78)+width/2-.5)*20.6,
                                     -((top+.65)+height/2-.5)*12.875, 0))
    camera.data.ortho_scale = 20.6*width
    scene.render.resolution_x = round(width*density)
    scene.render.resolution_y = round(height*density/1.6)
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 32 if ARGS.final else 4
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    camera.location = original_location
    camera.data.ortho_scale = 20.6
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1200


if not ARGS.build_only:
    sprite = json.loads(subprocess.check_output(['node', str(ROOT/'tools/diorama/export_serra_sprite.mjs')], text=True))
    for name, at in [('lower aboard', FEET['lower'][0]), ('upper aboard', FEET['upper'][1]),
                     ('lower platform', LOWER_PLATFORM), ('upper platform', UPPER_PLATFORM)]:
        cabin.make_feka('proof '+name, at, camera, sprite)
    render_crop(OUT/'serra-reserva-corridor-proof.png', (2.70, -1.80, 4.18, .35), 1100)

if ARGS.render_overlays:
    def overlay(name, objects, when=None):
        for obj in scene.objects:
            if obj.type in {'MESH', 'CURVE', 'FONT'}:
                obj.hide_render = obj not in objects
        bpy.context.view_layer.update()
        projected = [project(obj.matrix_world@Vector(p)) for obj in objects for p in obj.bound_box]
        left = math.floor((min(p['x'] for p in projected)-.005)*1920)/1920
        top = math.floor((min(p['y'] for p in projected)-.005)*1200)/1200
        right = math.ceil((max(p['x'] for p in projected)+.005)*1920)/1920
        bottom = math.ceil((max(p['y'] for p in projected)+.005)*1200)/1200
        render_crop(OUT/f'serra-reserva-{name}.png', (left, top, right, bottom), 1920)
        entry = {'path': f'/assets/world/map/serra-reserva-{name}.webp',
                 'width': round((right-left)*1920), 'height': round((bottom-top)*1200),
                 'left': left, 'top': top, 'widthInMap': right-left, 'heightInMap': bottom-top}
        if when:
            entry['when'] = when
        record['overlays'].append(entry)
    for terminal in ['lower', 'upper']:
        overlay(terminal+'-terminal', [o for o in GROUPS[terminal] if not o.get('gate_moving')])
    for i, (arm, closed_pivot, sign, terminal, stem) in enumerate(GATES):
        # Open assemblies retract inside the opaque deck. Rendering them alone
        # would create an X-ray overlay, so open state uses only the shared socket.
        for state in ['closed']:
            pivot = closed_pivot-(Vector((0, 0, .62)) if state == 'open' else Vector((0, 0, 0)))
            endpoint = pivot+(Vector((sign*.96, 0, 0)) if state == 'open' else Vector((0, -.96, 0)))
            arm.location = (pivot+endpoint)/2
            arm.rotation_euler = (endpoint-pivot).to_track_quat('Z', 'Y').to_euler()
            stem.location = pivot-Vector((0, 0, .21))
            overlay(f'{terminal}-gate-{i%2}-{state}', [arm, stem], state)
    (OUT/'serra-reserva-link.meta.json').write_text(json.dumps(record, indent=2)+'\n')
