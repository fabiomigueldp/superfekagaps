"""Reserva Gelada: portable authored Blender prototype, outside the runtime.

blender -b -t 8 -P tools/diorama/render_reserva_map.py -- --output-dir DIR
Use --build-only for inspection, --final only after the geometry review freezes.
Outputs, including the .blend and original-Feka proof, go to scratch only.
"""
import bpy
import json
import math
import os
import re
import subprocess
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[ARGS.index('--output-dir') + 1] if '--output-dir' in ARGS else '/tmp/feka-reserva-build'
FINAL = '--final' in ARGS
BUILD_ONLY = '--build-only' in ARGS
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, metal=0):
    color = tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in rgb)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .5
    p.inputs['Metallic'].default_value = metal
    return m


ice = material('Blue cold-store ice', (.37, .69, .83))
frost = material('White blue frost caps', (.84, .93, .96))
rock = material('Cold coastal rock', (.35, .45, .58))
steel = material('Pale insulated metal', (.69, .79, .83), .22)
navy = material('Dark pressure housings', (.16, .30, .41), .25)
lane = material('Dry inspection lane', (.85, .86, .77))
purple = material('Purple reserve behind glazing', (.50, .21, .70), .10)
glass = material('Violet glass reflection', (.78, .66, .91), .18)
amber = material('Warm dock and lamps', (1, .74, .30))
copper = material('Heated copper piping', (.73, .43, .25), .30)
dark = material('Rubber seals and rail', (.10, .17, .23))


def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width=.025):
    mod = obj.modifiers.new('Crafted edge', 'BEVEL')
    mod.width = width
    mod.segments = 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def cube(name, loc, dims, mat, radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return bevel(obj, radius) if radius else obj


def cyl(name, loc, radius, depth, mat, count=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=count, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return bevel(obj, .015)


def beam(name, a, b, radius, mat):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a + b) / 2, radius, (b - a).length, mat, 12)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return assign(obj, mat)


def polygon_solid(name, outline, top, bottom, mat):
    n = len(outline)
    vertices = [(x, y, top) for x, y in outline] + [(x, y, bottom) for x, y in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return bevel(mesh(name, vertices, faces, mat), .03)


# Structural island and cold wall masses are authored closed meshes, no Booleans.
OUTLINE = [(-6.6, -3.1), (-4.9, -3.9), (-1.9, -3.75), (.8, -3.8), (3.7, -3.6),
           (6.4, -3.05), (7.1, -1.7), (7.1, 2.15), (5.7, 3.5), (2.9, 4.3),
           (-.4, 4.4), (-3.6, 4.2), (-5.9, 3.25), (-6.7, 1.1)]
polygon_solid('continuous ice-bound bedrock', OUTLINE, .56, -.12, rock)
polygon_solid('walk_cold-store foundation', [(x * .99, y * .99) for x, y in OUTLINE], 1.17, .50, ice)
polygon_solid('walk_western chamber terrace', [(-4.95, .2), (-1.5, .2),
                                             (-1.5, 3.6), (-4.95, 3.3)], 2.49, 1.10, steel)

NODES = {'5-1': (5.4, -2.6, 1.35), '5-2': (3.4, -.45, 1.35),
         '5-3': (0, -1.9, 1.35), '5-4': (-4.5, -2.6, 1.35), '5-5': (-3.8, .6, 2.70)}
MAIN = [[NODES['5-1'], (4.8, -1.0, 1.35), NODES['5-2']],
        [NODES['5-2'], (1.8, -.45, 1.35), (.9, -1.9, 1.35), NODES['5-3']],
        [NODES['5-3'], (-2.2, -2.6, 1.35), NODES['5-4']],
        [NODES['5-4'], (-5.65, -2.6, 1.35), (-5.65, -1.7, 1.35),
         (-5.65, .6, 2.70), (-5.65, 1.25, 2.70), (-4.5, 1.25, 2.70), NODES['5-5']]]
SECRET = [NODES['5-3'], (0, -1.3, 1.35), (0, .90, 2.70),
          (0, 1.70, 2.70), (-2.3, 1.70, 2.70), NODES['5-5']]
TERMINAL = {'status': 'reservation-only-no-connection', 'stage': '5-1',
            'approach': [NODES['5-1'], (5.4, -1.5, 1.35), (6.35, -1.5, 1.35)],
            'terminalGeometryOwner': 'render_serra_reserva_link.py',
            'provisionalSlabRemoved': True,
            'futureSource': '4-5', 'mode': 'paired-passenger-cableway'}
DOCK = {'status': 'reservation-only-no-crossing', 'nextWorld': 6,
        'approach': [NODES['5-5'], (-4.5, 1.25, 2.70), (-5.65, 1.25, 2.70), (-6.5, 2.10, 2.70)],
        'campaignUnlock': '5-5 C2'}


def walkway(name, path, width, mat=lane):
    # Flush joined layers need a tiny explicit separation in Cycles; coincident
    # landing/route triangles otherwise produce black self-shadowing in previews.
    offset = -.012 if name == 'reserved heated western dock' else -.009 if name == 'passenger terminal approach reservation' else .006 if name == 'cutaway shipping tunnel route' else 0
    points = [Vector(p) + Vector((0, 0, offset)) for p in path]
    if name == 'passenger terminal approach reservation':
        # Keep the frozen endpoint inside the supported lip, not exactly on a
        # floating-point boundary of its last triangle after the slab removal.
        points[-1] += (points[-1] - points[-2]).normalized() * .025
    sides = [Vector((-(b - a).y, (b - a).x, 0)).normalized() for a, b in zip(points, points[1:])]
    top = []
    for i, p in enumerate(points):
        side = sides[0] if i == 0 else sides[-1] if i == len(points) - 1 else (sides[i - 1] + sides[i]).normalized()
        extent = width / 2 / max(.5, side.dot(sides[min(i, len(sides) - 1)]))
        top += [p - side * extent, p + side * extent]
    count = len(top)
    verts = top + [p - Vector((0, 0, .16)) for p in top]
    center = len(verts)
    verts += points
    faces = []
    for i in range(len(points) - 1):
        j = 2 * i
        # Triangulated surface retains a continuous exact centerline on turns/slopes.
        faces += [(j, j + 2, center + i + 1), (j, center + i + 1, center + i),
                  (center + i, center + i + 1, j + 3), (center + i, j + 3, j + 1),
                  (count + j, count + j + 1, count + j + 3, count + j + 2),
                  (j, count + j, count + j + 2, j + 2), (j + 1, j + 3, count + j + 3, count + j + 1)]
    faces += [(0, 1, count + 1, count), (count - 2, 2 * count - 2, 2 * count - 1, count - 1)]
    obj = mesh('walk_' + name, [tuple(p) for p in verts], faces, mat)
    for a, b in zip(points, points[1:]):
        side = Vector((-(b - a).y, (b - a).x, 0)).normalized()
        for sign in [-1, 1]:
            offset = side * (width / 2 - .10) * sign
            beam(name + ' load-bearing stringer', a + offset - Vector((0, 0, .20)), b + offset - Vector((0, 0, .20)), .075, navy)
            for t in [.12, .5, .88]:
                p = a.lerp(b, t) + offset
                beam(name + ' bedrock-rooted pier', (p.x, p.y, .52), (p.x, p.y, p.z - .16), .070, navy)
    return obj


for i, route in enumerate(MAIN):
    walkway('main inspection route ' + str(i + 1), route, 1.32)
walkway('cutaway shipping tunnel route', SECRET, 1.24, steel)
for key, p in NODES.items():
    cyl('walk_' + key + ' wide landing', (p[0], p[1], p[2] - .027), .82, .09, lane, 32)

# The link source owns the passenger terminal. Its carrier needs open air below
# the floor, so the provisional wide slab is removed while this approach freezes.
walkway('passenger terminal approach reservation', TERMINAL['approach'], 1.18)
walkway('reserved heated western dock', DOCK['approach'], 1.05)
for x in [-6.24, -6.06]:
    cube('heated dock inset copper strip', (x, 1.78, 2.709), (.055, .45, .012), copper, .003)

# Main identity: cold-room box with a large circular pressure door, safely behind5-5.
cube('western insulated cold chamber', (-3.65, 3.13, 3.67), (3.55, 1.80, 2.36), steel, .07)
cube('western pale frosted roof', (-3.65, 3.13, 4.89), (3.78, 2.00, .19), frost, .06)
cube('cold chamber front navy panel', (-3.65, 2.20, 3.68), (3.20, .10, 2.10), navy, .04)
for name, y, radius, depth, mat in [('rubber pressure seal', 2.11, 1.02, .13, dark),
                                ('circular pale door frame', 2.02, .94, .17, steel),
                                ('circular blue cold-room door', 1.91, .78, .12, ice)]:
    obj = cyl(name, (-3.65, y, 3.67), radius, depth, mat, 40)
    obj.rotation_euler.x = math.pi / 2
for angle in [0, math.pi / 3, 2 * math.pi / 3]:
    beam('door snowflake main arm', (-3.65 - math.cos(angle) * .36, 1.835, 3.67 - math.sin(angle) * .36),
         (-3.65 + math.cos(angle) * .36, 1.835, 3.67 + math.sin(angle) * .36), .035, frost)
for x in [-5.13, -2.18]:
    cube('cold chamber amber lamp', (x, 2.10, 4.29), (.20, .20, .26), amber)


def tank(name, x, y, z, radius, height):
    cyl(name + ' sealed purple sight glass', (x, y, z + height / 2), radius, height, purple, 32)
    for zz in [z + .10, z + height - .10]:
        cyl(name + ' pale pressure band', (x, y, zz), radius + .075, .18, steel, 32)
    cyl(name + ' frost cap', (x, y, z + height + .04), radius + .11, .13, frost, 32)
    for dx in [-.48, .48]:
        yy = y - radius * .89
        beam(name + ' vertical glass reflection', (x + dx * radius, yy, z + .35),
             (x + dx * radius, yy, z + height - .34), .026, glass)
    for dx in [-radius * .62, radius * .62]:
        cube(name + ' pedestal', (x + dx, y, z - .1), (.23, radius * 1.5, .3), navy)


tank('tall reserve cylinder', 1.30, 3.01, 1.44, .91, 3.15)
tank('secondary reserve cylinder', 3.05, 2.42, 1.44, .65, 2.35)
# Broad pipe gallery and chiller are behind the east inspection route, before terminal.
cube('eastern chiller machinery', (4.34, 2.86, 2.15), (1.65, 1.23, 1.96), steel, .06)
cube('chiller navy grille block', (4.34, 2.215, 2.28), (1.24, .065, .89), navy)
for x in [3.95, 4.21, 4.47, 4.73]:
    cube('large chiller ventilation rib', (x, 2.16, 2.28), (.09, .075, .70), steel, .01)
beam('insulated supply rising pipe', (5.10, 2.8, 1.3), (5.10, 2.8, 3.7), .18, navy)
beam('insulated supply overhead header', (5.10, 2.8, 3.7), (3.8, 2.8, 3.7), .18, navy)
beam('cold-store horizontal manifold', (3.8, 3.1, 3.7), (1.3, 3.1, 3.7), .15, steel)

# Shipping tunnel represented by its BACK wall and roof remnant. The view-facing
# wall and all roof over the path are deliberately cut away; no actor masking.
cube('shipping tunnel far retaining wall', (-1.20, 2.53, 3.18), (2.03, .16, 1.30), navy)
cube('shipping tunnel roof cutback remnant', (-1.20, 2.73, 3.88), (2.12, .48, .14), steel)
for x in [-2.11, -1.22, -.30]:
    cube('shipping tunnel exposed far rib', (x, 2.415, 3.21), (.08, .12, 1.38), steel, .015)
for x in [-1.95, -.55]:
    cube('shipping tunnel warm wall lamp', (x, 2.305, 3.51), (.15, .15, .19), amber)
# Barrel track on the far-side shoulder, not along Feka's centered walking path.
for y in [2.14, 2.25]:
    beam('shipping barrel flush steel rail', (-2.3, y, 2.72), (-.42, y, 2.72), .022, dark)
cube('reserve expediting crate', (-.47, 2.48, 1.63), (.58, .65, .86), purple)
cube('dry thermal service equipment', (-2.65, -1.60, 1.42), (1.1, .48, .50), navy)
beam('warm copper return pipe', (-3.15, -1.62, 1.72), (-2.15, -1.62, 1.72), .055, copper)

# Broad faceted cold shoulders, intentionally no forest or tiny decorative clutter.
for i, (x, y, sx, sy, h) in enumerate([(-6.2, 2.3, .70, .65, 1.10), (-5.7, 3.4, .78, .53, .96),
                                      (-.5, 3.9, .70, .60, .58), (6.1, 2.8, .6, .48, .62),
                                      (2.8, -3.2, .6, .35, .25)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y, 1.15 + h / 3))
    obj = bpy.context.object
    obj.name = 'faceted blue ice shoulder ' + str(i)
    obj.scale = (sx, sy, h)
    assign(obj, ice)

# ---- One bounded craft pass; all accepted circulation centerlines stay fixed. ----
def ring(name, center, radius, thickness, mat, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness,
                                    major_segments=40, minor_segments=8,
                                    location=center, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return assign(obj, mat)


def pipe(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return assign(obj, mat)


# Distinct concentric rubber gasket, fastening bolts and hinge/locking mechanism.
ring('cold-room black compressible gasket', (-3.65, 1.825, 3.67), .815, .037, dark)
ring('cold-room polished seal rim', (-3.65, 1.800, 3.67), .865, .027, steel)
for i in range(12):
    a = i * math.tau / 12
    x, z = -3.65 + math.cos(a) * .955, 3.67 + math.sin(a) * .955
    obj = cyl('cold-room captive flange bolt', (x, 1.905, z), .037, .045, navy, 8)
    obj.rotation_euler.x = math.pi / 2
for z in [3.13, 4.16]:
    cube('cold-room hinge mounting plate', (-4.49, 1.93, z), (.30, .105, .27), navy, .02)
    cyl('cold-room vertical hinge pin', (-4.55, 1.81, z), .065, .35, steel, 16)
    cube('cold-room hinge tongue', (-4.30, 1.80, z), (.38, .12, .095), steel, .018)
cube('cold-room lock mounting pad', (-3.08, 1.79, 3.42), (.20, .085, .31), navy)
beam('cold-room latch grip', (-3.07, 1.655, 3.29), (-3.07, 1.655, 3.60), .038, steel)
for z in [3.31, 3.58]:
    beam('cold-room latch stand-off', (-3.07, 1.79, z), (-3.07, 1.65, z), .030, navy)
# The snowflake emblem receives six readable branch tips, not tiny surface noise.
for i in range(6):
    a = i * math.pi / 3
    origin = Vector((-3.65 + math.cos(a) * .23, 1.824, 3.67 + math.sin(a) * .23))
    for sign in [-1, 1]:
        b = a + sign * .72
        tip = origin + Vector((math.cos(b) * .12, 0, math.sin(b) * .12))
        beam('door snowflake branch', origin, tip, .020, frost)

# Insulated panel courses and roof standing seams give the cold chamber a scale.
for x in [-5.33, -2.00]:
    cube('cold chamber front reinforced corner', (x, 2.13, 3.68), (.105, .14, 2.22), frost, .015)
for z in [3.03, 4.33]:
    cube('cold chamber side insulated panel seam', (-1.858, 3.15, z), (.025, 1.55, .026), navy, .004)
for y in [2.57, 3.19, 3.77]:
    cube('cold chamber side vertical panel joint', (-1.852, y, 3.68), (.026, .025, 2.16), navy, .003)
for x in [-4.95, -4.25, -3.55, -2.85, -2.15]:
    beam('cold chamber roof standing seam', (x, 2.24, 5.00), (x, 4.01, 5.00), .018, steel)
for x in [-5.13, -2.18]:
    cube('cold chamber lamp insulated hood', (x, 2.075, 4.46), (.30, .32, .09), navy, .027)
    beam('cold chamber lamp arm', (x, 2.25, 4.43), (x, 2.05, 4.43), .027, steel)

# Reserve vessel collars, liquid level and outer braces remain behind the route.
for name, x, y, radius, height in [('main', 1.30, 3.01, .91, 3.15), ('secondary', 3.05, 2.42, .65, 2.35)]:
    for angle in [0, math.pi / 2, math.pi, 3 * math.pi / 2]:
        xx, yy = x + math.cos(angle) * (radius + .035), y + math.sin(angle) * (radius + .035)
        beam(name + ' reserve pale outer brace', (xx, yy, 1.57), (xx, yy, 1.44 + height - .14), .045, steel)
    cyl(name + ' reserve visible liquid meniscus', (x, y, 1.44 + height * .69), radius + .010, .052, glass, 40)
    cyl(name + ' reserve valve boss', (x, y, 1.44 + height + .19), radius * .18, .21, navy)
    cube(name + ' reserve broad serial plate', (x, y - radius - .045, 2.04), (radius * .85, .060, .27), frost)
    cube(name + ' reserve serial marker', (x, y - radius - .080, 2.04), (.14, .022, .16), navy, .008)
    # An original droplet silhouette is stamped onto the actual glass vessel.
    zz = 1.44 + height * .52
    yy = y - radius - .06
    mesh(name + ' reserve juice droplet', [(x, yy, zz + .32), (x - .19, yy, zz + .05),
                                          (x - .16, yy, zz - .17), (x, yy, zz - .23),
                                          (x + .16, yy, zz - .17), (x + .19, yy, zz + .05)],
         [tuple(range(6))], glass)

# The low transfer line connects the reserve vessels to the5-3 valve shoulder.
# It passes beneath the raised freight corridor, never through its walking deck.
pipe('reserve to5-3 insulated transfer main', [(1.30, 3.75, 1.61), (-.82, 3.75, 1.61),
                                              (-.95, 3.61, 1.61), (-.95, -.75, 1.61),
                                              (-.95, -.91, 1.46)], .100, navy)
for y in [-.50, .35, 2.92, 3.40]:
    ring('transfer main pale support collar', (-.95, y, 1.61), .108, .032, steel)
    cube('transfer main bolted support shoe', (-.95, y, 1.29), (.29, .20, .22), steel)
cube('5-3 dry valve pedestal', (-.95, -.97, 1.33), (.55, .58, .31), navy)
beam('5-3 transfer valve spindle', (-.95, -.98, 1.63), (-.95, -1.22, 1.63), .045, steel)
ring('5-3 amber pressure control handwheel', (-.95, -1.25, 1.63), .19, .031, amber)
for angle in [0, math.pi / 3, 2 * math.pi / 3]:
    beam('5-3 pressure wheel spoke', (-.95 - math.cos(angle) * .17, -1.25, 1.63 - math.sin(angle) * .17),
         (-.95 + math.cos(angle) * .17, -1.25, 1.63 + math.sin(angle) * .17), .016, amber)
# One clear pressure dial, attached to its real line instead of floating garnish.
beam('reserve pressure gauge stem', (1.30, 2.07, 2.75), (1.30, 1.89, 2.75), .039, navy)
gauge = cyl('reserve pressure gauge case', (1.30, 1.86, 2.87), .19, .09, navy, 32)
gauge.rotation_euler.x = math.pi / 2
gauge = cyl('reserve pressure gauge face', (1.30, 1.802, 2.87), .157, .023, frost, 32)
gauge.rotation_euler.x = math.pi / 2
beam('reserve pressure gauge needle', (1.30, 1.781, 2.87), (1.38, 1.781, 2.97), .013, copper)

# The open shipping corridor shows loading rails and roof cut ends. The near side
# stays open; the rear rail is outside the lane, lower than Feka's head or torso.
beam('shipping corridor far shoulder rail', (-2.15, 2.31, 3.06), (-.38, 2.31, 3.06), .025, steel)
for x in [-2.11, -1.22, -.38]:
    beam('shipping corridor far rail support', (x, 2.31, 2.69), (x, 2.31, 3.08), .025, navy)
    cube('shipping cut roof exposed bracket', (x, 2.54, 3.77), (.095, .41, .14), navy, .014)
for x in [-1.95, -.55]:
    cube('shipping warm lamp protective hood', (x, 2.29, 3.635), (.23, .23, .055), navy, .018)
for x in [-1.87, -1.59, -1.31, -1.03, -.75]:
    cube('shipping rail cross tie', (x, 2.195, 2.701), (.08, .28, .032), steel, .009)

# Frost is concentrated at exposed roof and coastal edges. It never coats the
# playable footline or implies new slippery gameplay on the map.
for i, (x, y, z, length) in enumerate([(-5.24, 2.22, 4.82, .23), (-4.88, 2.22, 4.83, .15),
                                     (-2.50, 2.22, 4.83, .20), (-1.88, 2.59, 4.82, .24),
                                     (-1.88, 3.61, 4.82, .16)]):
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=.015, radius2=.068, depth=length, location=(x, y, z - length / 2))
    obj = bpy.context.object
    obj.name = 'restrained cold roof icicle ' + str(i)
    assign(obj, frost)
for x, y in [(-4.9, -3.74), (-2.8, -3.73), (-.6, -3.73), (1.6, -3.64), (4.45, -3.35)]:
    cube('coastal frost edge lip', (x, y, 1.17), (.65, .18, .10), frost, .037)
    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=.035, radius2=.14, depth=.42, location=(x - .13, y, .91))
    obj = bpy.context.object
    obj.name = 'coastal frozen drain below walking level'
    assign(obj, ice)

scene = bpy.context.scene
bpy.ops.object.camera_add(location=(11, -20, 17.5))
cam = bpy.context.object
target = Vector((0, .25, 2.25))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 20.6
scene.camera = cam
world = bpy.data.worlds.new('Cold lilac air')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.58, .69, .88, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55
for name, loc, power, size, color in [('warm key', (-8, -10, 19), 2400, 9, (1, .83, .65)),
                                      ('cold fill', (8, 3, 13), 1700, 8, (.67, .80, 1)),
                                      ('cold rim', (-4, 10, 17), 1800, 7, (.80, .92, 1))]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = power
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.data.color = color
    obj.rotation_euler = (Vector((0, 0, 2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48 if FINAL else 12
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 4
scene.render.resolution_x = 1920
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100 if FINAL else 50
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .30
bpy.context.view_layer.update()


def project(point):
    p = world_to_camera_view(scene, cam, Vector(point))
    return {'x': round(p.x, 6), 'y': round(1 - p.y, 6)}


meta = {'version': 1, 'world': 5, 'status': 'frozen-authored-base-island',
        'size': {'width': 1920, 'height': 1200},
        'camera': {'position': list(cam.location), 'target': list(target), 'orthoScale': 20.6},
        'placementProposal': {'origin': {'x': 2.7, 'y': -1.8}, 'scale': 1},
        'nodes': {key: {**project(p), 'world': p, 'clearingRadius': .82} for key, p in NODES.items()},
        'routes': {str(i) + ':' + str(i + 1): [project(p) for p in route] for i, route in enumerate(MAIN)},
        'secretRoute': [project(p) for p in SECRET],
        'worldRoutes': {'main': [{'from': '5-' + str(i + 1), 'to': '5-' + str(i + 2), 'world': path,
                                  'movement': 'walk', 'width': 1.32} for i, path in enumerate(MAIN)],
                        'secret': [{'from': '5-3', 'to': '5-5', 'world': SECRET, 'movement': 'walk', 'width': 1.24}],
                        'stationApproach': [{'from': '5-1', 'world': TERMINAL['approach'], 'movement': 'walk', 'width': 1.18}]},
        'futureEntry': TERMINAL, 'futureExit': DOCK,
        'secretDesign': 'Roof/view-facing wall cutaway; far wall and exposed rear ribs; barrel rails on shoulder.',
        'campaignSources': ['docs/world/campanha.md:M5', 'docs/world/conceitos/imagens/05-reserva-gelada.png',
                            'docs/world/conceitos/imagens/13-arquipelago.png']}
length3 = lambda points: sum((Vector(b) - Vector(a)).length for a, b in zip(points, points[1:]))
meta['routeDurationsSeconds'] = {str(i) + ':' + str(i + 1): round(length3(path) / 1.73, 6)
                                 for i, path in enumerate(MAIN)}
meta['secretDurationSeconds'] = round(length3(SECRET) / 1.73, 6)
meta['stationApproachDurationSeconds'] = round(length3(TERMINAL['approach']) / 1.73, 6)
meta['timingCalibration'] = {'walkWorldUnitsPerSecond': 1.73,
                             'source': 'Same real-world pace as released Serra routes; lengths follow the authored3D paths.'}

# Use the exact source-authored sprite, never a proxy human or resized world actor.
source = json.loads(subprocess.check_output(['node', ROOT + '/tools/diorama/export_serra_sprite.mjs'], text=True))
json.dump(source, open(os.path.join(OUT, 'reserva-sprite-source.json'), 'w'), indent=2)
pixel = source['pixelMapWidth'] * cam.data.ortho_scale
meta['fekaScale'] = {'source': source['source'], 'pixelMapWidth': source['pixelMapWidth'],
                     'worldPixelWidth': pixel, 'projectedHeightAt1920': 26 * source['pixelMapWidth'] * 1920}
scene['reserva_metadata'] = json.dumps(meta)
json.dump(meta, open(os.path.join(OUT, 'reserva-prototype.meta.json'), 'w'), indent=2)
assert all(mod.type != 'BOOLEAN' for obj in scene.objects for mod in obj.modifiers)

if not BUILD_ONLY:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'reserva-prototype.blend'))
    scene.render.filepath = os.path.join(OUT, 'reserva-diorama.png' if '--static' in ARGS else 'reserva-craft.png')
    bpy.ops.render.render(write_still=True)

if not BUILD_ONLY and '--static' not in ARGS:
    # Actual pixel geometry is upright in world-space and projected exactly like
    # the runtime actor; it participates in depth so this proof reveals obstruction.
    palette_text = open(ROOT + '/src/graphics/palette.ts').read()
    colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", palette_text))
    player_text = open(ROOT + '/src/assets/playerSpriteSpec.ts').read()
    mapping = dict(re.findall(r'(\w): ART\.(\w+)', player_text))
    mats = {}
    for symbol, key in mapping.items():
        hexcolor = colors[key].lstrip('#')
        m = material('original Feka pixel ' + symbol, tuple(int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4)))
        m.node_tree.nodes.clear()
        emission = m.node_tree.nodes.new('ShaderNodeEmission')
        emission.inputs[0].default_value = m.diffuse_color
        out = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(emission.outputs[0], out.inputs['Surface'])
        mats[symbol] = m
    basis = cam.rotation_euler.to_matrix()
    right = basis @ Vector((1, 0, 0))
    up = basis @ Vector((0, 1, 0))
    toward = basis @ Vector((0, 0, 1))
    for key, foot in NODES.items():
        foot = Vector(foot) + toward * .008
        for y, row in enumerate(source['frames']['idle']):
            for x, symbol in enumerate(row):
                if symbol == '_':
                    continue
                a = foot + right * ((x - 8) * pixel) + Vector((0, 0, (25 - y) * pixel / up.z))
                b = a + right * pixel
                c = b + Vector((0, 0, pixel / up.z))
                d = a + Vector((0, 0, pixel / up.z))
                actor = mesh('proof_' + key + ' original Feka', [a, b, c, d], [(0, 1, 2, 3)], mats[symbol])
                actor.visible_shadow = False
    scene.render.filepath = os.path.join(OUT, 'reserva-craft-feka.png')
    bpy.ops.render.render(write_still=True)
    print('RESERVA_CRAFT=' + scene.render.filepath)
