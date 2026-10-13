"""Revision 5: walkable Delicia, authored in the same space as the island.

blender --background --factory-startup --disable-autoexec \
  docs/world/delicia/imperio-delicia-v4.blend \
  --python tools/delicia/integrate_map_paths.py -- --draft

Omit --draft for the release render and editable v5 source. --no-render only
exports geometry/metadata. The v4 source is never overwritten. Route curves,
terrain ribbons and projected runtime paths share the exact sampled centerline.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import island_geometry as G
from island_landscape import height

ROOT = HERE.parents[1]
SOURCE = ROOT / 'docs/world/delicia'
REVIEW = ROOT / 'output/delicia/map-integration-2026-10-10'
REVIEW.mkdir(parents=True, exist_ok=True)
DRAFT = '--draft' in sys.argv
scene = bpy.context.scene
assert scene.get('model_revision') == 4, 'Start from the preserved v4 source.'
G.M = {m.name: m for m in bpy.data.materials}
G.collection('13 • Walkable lanes, landings and sanctuary approaches')


def ground(x, y):
    return (x, y, height(x, y) + .075)


# A landing is a place to stand, outside the fountain, vats and juice channel.
NODES = {
    'delicia-1': (-15.8, -15.65, 1.78),
    'delicia-2': ground(-13.3, 3.25),
    'delicia-3': (-10.65, 1.85, 8.55),
    'delicia-4': (-5.2, -6.2, 4.24),
    'delicia-5': ground(7.4, -.8),
    'delicia-6': (-2.65, 7.7, 7.28),
    'delicia-7': ground(4.2, -11.7),
    'delicia-8': ground(12.9, -4.05),
    'delicia-9': ground(20.7, -8.5),
    'delicia-10': ground(17.2, -.7),
    'delicia-11': ground(12, 3.6),
    'delicia-12': (12, 7.7, 12.18),
    'delicia-raizes': ground(-15.4, 8.8),
    'delicia-relogio': ground(23.25, -7.55),
    'delicia-crossroads': (5.4, -6.2, 4.24),
    'delicia-east-road': ground(17.0, -3.85),
}


def rounded(controls):
    """Corner cuts stay inside the authored corridor; never spline overshoot."""
    points = [Vector(p) for p in controls]
    for _ in range(2):
        result = [points[0]]
        for a, b in zip(points, points[1:]):
            result.extend((a * .75 + b * .25, a * .25 + b * .75))
        points = result + [points[-1]]
    dense = []
    for a, b in zip(points, points[1:]):
        count = max(1, math.ceil((b - a).length / .22))
        dense.extend(a.lerp(b, i / count) for i in range(count))
    return dense + [points[-1]]


ROUTES = []


def route(name, start, end, via=(), width=.72, surface='ground', draw=True):
    line = rounded([NODES[start], *via, NODES[end]])
    # Sample the island's own heightfield, with blended joins to raised decks.
    if surface == 'ground':
        distances = [0.0]
        for a, b in zip(line, line[1:]):
            distances.append(distances[-1] + math.hypot(b.x-a.x, b.y-a.y))
        for i, p in enumerate(line):
            z = height(p.x, p.y) + .075
            if name == 'harbor-orchard' and p.y < -15.2:
                z = max(z, 1.78)  # A continuous quay-top promenade between piers.
            head = max(0, 1 - distances[i] / 1.6)
            tail = max(0, 1 - (distances[-1]-distances[i]) / 1.6)
            head_ground = ground(*NODES[start][:2])[2]
            if name == 'harbor-orchard': head_ground = max(head_ground, 1.78)
            p.z = z + (NODES[start][2]-head_ground)*head + (NODES[end][2]-ground(*NODES[end][:2])[2])*tail
    line[0] = Vector(NODES[start]); line[-1] = Vector(NODES[end])
    if draw:
        verts, faces = [], []
        for i, p in enumerate(line):
            tangent = line[min(i+1, len(line)-1)] - line[max(0, i-1)]
            normal = Vector((-tangent.y, tangent.x, 0)).normalized() * width/2
            for q in (p-normal, p+normal):
                # Decks stay level; shoulders conform to the ground nearby.
                z = p.z if surface != 'ground' else p.z + height(q.x, q.y)-height(p.x, p.y)
                verts.append((q.x, q.y, z-.014))
            if i: faces.append((2*i-2, 2*i-1, 2*i+1, 2*i))
        G.mesh(name + ' • limestone walking surface', verts, faces, 'trail')
        # Raised joins have a stone foundation all the way to the terrain;
        # no thin ribbon floats between an aqueduct deck and the hillside.
        sides, sidefaces = [], []
        for side in (0,1):
            base = len(sides)
            for i in range(len(line)):
                x,y,z = verts[2*i+side]
                sides.extend(((x,y,z),(x,y,min(z-.03,height(x,y)-.025))))
                if i: sidefaces.append((base+2*i-2,base+2*i-1,base+2*i+1,base+2*i))
        G.mesh(name + ' • bedded path edges',sides,sidefaces,'stone-warm')
    # Editable, non-rendering centerline: inspect in Blender without a game tool.
    curve = bpy.data.curves.new(name + ' • route', 'CURVE'); curve.dimensions = '3D'
    spline = curve.splines.new('POLY'); spline.points.add(len(line)-1)
    for target, point in zip(spline.points, line): target.co = (*point, 1)
    obj = bpy.data.objects.new(name + ' • route', curve); G.COLLECTION.objects.link(obj)
    obj.hide_render = True; obj.show_in_front = True
    obj['from'] = start; obj['to'] = end; obj['walk_width_m'] = width
    length = sum((b-a).length for a, b in zip(line, line[1:]))
    ROUTES.append({'id': name, 'from': start, 'to': end, 'line': line,
                   'duration': round(max(.6, length / 8), 3), 'width': width})


route('harbor-orchard', 'delicia-1', 'delicia-2', [ground(x,y) for x,y in
      [(-13.2,-16.5),(-10.8,-17.2),(-7.6,-16),(-6.5,-13.8),(-6.2,-10.8),
       (-6,-8.3),(-6.9,-3.5),(-8,-1.4),(-11.5,-.1),(-11.8,3.2)]], .8)
route('orchard-aqueduct', 'delicia-2', 'delicia-3', [ground(-11.8,3.2),ground(-11.7,1.85)], .75)
route('west-bank', 'delicia-3', 'delicia-4', [ground(x,y) for x,y in
      [(-11.9,1.65),(-11.5,-.1),(-8,-1.4),(-6.9,-3.5),(-5.7,-5.1)]], .8)
route('five-harvests-bridge', 'delicia-4', 'delicia-crossroads', surface='deck', draw=False)
route('archive-approach', 'delicia-crossroads', 'delicia-5', [ground(7.6,-4.35),ground(8,-2.3)], .75)

# The aqueduct carries juice. A separate, supported maintenance walk carries Feka.
G.box('Aqueduct pedestrian deck',(-3.0,1.85,8.42),(15.3,.92,.22),'limestone',.04)
for x in [-10.5+i*1.15 for i in range(14)]:
    G.beam('Walkway corbel',(x,2.5,7.87),(x,1.48,8.32),.08,'stone-warm',4)
    G.box('Walkway paving joint',(x,1.85,8.538),(.022,.83,.01),'stone-warm',0)
G.railing('Aqueduct walking balustrade',[(-10.55,1.34,8.54),(4.55,1.34,8.54)],.57,'limestone',.65)
G.stairs('Aqueduct east access steps',ground(4.55,.1),(4.55,1.85,8.54),.95,14)
route('aqueduct-promenade', 'delicia-3', 'delicia-5', [(4.55,1.85,8.55),ground(4.55,.1),ground(6.5,-.3)], surface='deck', draw=False)
route('source-pilgrims', 'delicia-3', 'delicia-6',
      [(-11.4,1.85,8.55),(-11.4,4.25,8.65),(-9.5,4.25,8.75),(-6.5,4.25,8.75),
       (-4.3,4.6,8.3),(-3.4,6.5,7.28)], .75, surface='deck')
G.railing('Source walking terrace',[(-10.7,4.7,8.75),(-6.5,4.7,8.75),(-4.1,5.0,8.15)],.5,'limestone',.7)
route('roots-sanctuary', 'delicia-2', 'delicia-raizes', [ground(x,y) for x,y in
      [(-12,3.55),(-11.7,5.6),(-14.3,6.1),(-15.4,7.3)]], .65)
route('orange-tide', 'delicia-crossroads', 'delicia-7', [ground(5.2,-8.2),ground(4.8,-10)], .72)
route('refinery-street', 'delicia-crossroads', 'delicia-8', [ground(7,-4.3),ground(10,-4.3)], .85)
route('refinery-court', 'delicia-8', 'delicia-east-road', [ground(15.1,-4.1)], .85)
route('garden-gate', 'delicia-east-road', 'delicia-9', [ground(x,y) for x,y in
      [(18.8,-5.3),(19.1,-6.8),(20.7,-7.8)]], .72)
route('clock-sanctuary', 'delicia-9', 'delicia-relogio', [ground(21.9,-8.45),ground(23.1,-8.2)], .65)
route('boiler-approach', 'delicia-east-road', 'delicia-10', [ground(17.4,-2.4)], .85)
route('palace-ascent', 'delicia-10', 'delicia-11', [ground(x,y) for x,y in
      [(18.4,1.1),(17.7,4),(14.4,4.7)]], .95)
route('palace-stair', 'delicia-11', 'delicia-12', [(12,6.06,12.18),(12,6.35,12.18)], surface='deck', draw=False)

# Small inlaid arrival courts, restrained materials from the existing island.
for sid, p in NODES.items():
    if sid in ('delicia-crossroads','delicia-east-road'): continue
    stage = next((o for o in scene.objects if o.get('stage_id') == sid), None)
    if stage is None:
        stage = bpy.data.objects.new(sid + ' landing', None); G.COLLECTION.objects.link(stage)
    stage.location = p; stage['stage_id'] = sid
    stage.empty_display_type = 'SPHERE'; stage.empty_display_size = .2
    r = .53 if sid not in ('delicia-raizes','delicia-relogio') else .7
    G.cyl(sid+' arrival paving',(p[0],p[1],p[2]-.035),r,.05,'limestone',32)
    G.ring(sid+' inlaid landing rim',(p[0],p[1],p[2]-.004),r*.78,.018,'stone-warm',False,32)
    for i in range(4):
        angle = math.pi/4+i*math.pi/2
        o = G.box(sid+' mosaic petal',(p[0]+.22*math.cos(angle),p[1]+.22*math.sin(angle),p[2]-.004),(.1,.1,.012),'mosaic',.005)
        o.rotation_euler.z = angle

# Give both secrets a real, legible place, with the same masonry and copperwork.
for sid, material in [('delicia-raizes','wood'),('delicia-relogio','copper')]:
    x,y,z = NODES[sid]
    for side in (-1,1):
        G.lathe(sid+' carved entrance post',(x+side*.91,y+.5,z-.05),[(.17,0),(.15,.15),(.095,.9),(.15,1.03)],'limestone',16)
    G.beam(sid+' sanctuary lintel',(x-.93,y+.5,z+1.06),(x+.93,y+.5,z+1.06),.11,material,4)
    G.ring(sid+' citrus medallion',(x,y+.46,z+.92),.22,.035,'brass',True,24)
    G.cyl(sid+' wayside urn',(x+1.02,y+.72,z+.22),.2,.46,'tile',20,.28)

# Open actual orchard gates where the new walking centerline meets low walls.
# Preserve the wall objects, editable in v5, rather than destructive deletion.
opened = []
for obj in list(scene.objects):
    if not obj.name.startswith(('Old orchard retaining wall','Upper orchard dry stone wall')): continue
    p = obj.matrix_world.translation
    if any(abs(p.z-q.z)<.7 and math.hypot(p.x-q.x,p.y-q.y)<.58 for r in ROUTES for q in r['line']):
        obj.hide_render = True; obj.hide_viewport = True; obj['v5_opened_gate'] = True; opened.append(obj.name)

# Move complete trees aside as living alleys, preserving each crown/fruit/trunk
# assembly. The original v4 grove was planted without the new footpaths.
trunks = [o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Cypress trunk'))]
parts = [o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Citrus branch','Angular leafy crown','Ripe citrus fruit','Cypress trunk','Tapering cypress foliage'))]
positions = {o: o.matrix_world.translation.copy() for o in trunks}
groups = {o: [] for o in trunks}
for obj in parts:
    p = obj.matrix_world.translation
    nearest = min(trunks,key=lambda tree:(positions[tree].x-p.x)**2+(positions[tree].y-p.y)**2)
    groups[nearest].append(obj)
ground_lines = [r for r in ROUTES if r['id'] not in ('aqueduct-promenade','five-harvests-bridge','palace-stair')]
def clearance(x,y):
    return min(math.hypot(x-p.x,y-p.y)-r['width']/2 for r in ground_lines for p in r['line'])
moved_trees = []
for tree, p in positions.items():
    if clearance(p.x,p.y) >= .92: continue
    candidates = []
    for radius in (1.4,2.0,2.7):
        for n in range(16):
            angle = n*math.tau/16
            x,y = p.x+math.cos(angle)*radius,p.y+math.sin(angle)*radius
            if clearance(x,y)<1.02 or height(x,y)<2: continue
            if any(other!=tree and math.hypot(x-q.x,y-q.y)<1.25 for other,q in positions.items()): continue
            # Stay in the orchard or open bank, away from existing buildings.
            if not (-18<x<-5 and 0<y<10) and not (-7<x<-4 and -14<y<-5): continue
            candidates.append((radius,x,y))
    if not candidates: continue
    _,x,y = min(candidates)
    delta = Vector((x-p.x,y-p.y,height(x,y)-height(p.x,p.y)))
    for obj in groups[tree]: obj.location += delta
    positions[tree] = p+delta
    moved_trees.append({'tree':tree.name,'shift':list(delta)})

# Preserve sight lines into the root sanctuary, too. A valid ground coordinate
# hidden beneath a foreground crown would still look like Feka is on a tree.
owners = {part:tree for tree, assembly in groups.items() for part in assembly}
perimeter = [(-25,5),(-24,8),(-23,11.8),(-21.5,14.5),(-18.5,15.5),(-15.4,16.2),(-24.3,1.8),(-25.5,-1.2)]
for _ in range(3):
    bpy.context.view_layer.update(); deps = bpy.context.evaluated_depsgraph_get()
    toward = scene.camera.matrix_world.to_quaternion() @ Vector((0,0,1))
    trees = set()
    for r in ROUTES:
        if r['id'] not in ('roots-sanctuary','harbor-orchard','orchard-aqueduct'): continue
        for p in r['line'][::3]:
            hit,loc,normal,face,obj,matrix = scene.ray_cast(deps,p+toward*160,-toward,distance=159.7)
            if hit and obj in owners: trees.add(owners[obj])
    for tree in sorted(trees,key=lambda obj:obj.name):
        if not perimeter: break
        x,y = perimeter.pop(0); p = positions[tree]
        delta = Vector((x-p.x,y-p.y,height(x,y)-height(p.x,p.y)))
        for obj in groups[tree]: obj.location += delta
        positions[tree] = p+delta
        moved_trees.append({'tree':tree.name,'shift':list(delta),'reason':'sanctuary sight line'})

bpy.context.view_layer.update()
def project(p):
    q = world_to_camera_view(scene, scene.camera, Vector(p))
    return {'x': round(q.x,7), 'y': round(1-q.y,7)}

metadata = json.loads((ROOT/'public/assets/delicia/island-map.json').read_text(encoding='utf-8'))
metadata.update({'revision':5, 'nodes':{k:project(v) for k,v in NODES.items() if k not in ('delicia-crossroads','delicia-east-road')},
    'junctions':{k:project(v) for k,v in NODES.items() if k in ('delicia-crossroads','delicia-east-road')},
    'routes':[{'id':r['id'],'from':r['from'],'to':r['to'],'points':[project(p) for p in r['line']],
               'duration':r['duration'],'mode':'walk','widthMeters':r['width']} for r in ROUTES],
    'objects':len(scene.objects), 'source':'docs/world/delicia/imperio-delicia-v5.blend',
    'navigation':'14 grounded landings, 2 crossroads, supported aqueduct promenade and 16 authored walking paths',
    'image':{'width':2560,'height':1600}})
scene['model_revision'] = 5
scene['navigation_revision'] = 1
scene.render.resolution_x = 1440 if DRAFT else 2560
scene.render.resolution_y = 900 if DRAFT else 1600
scene.render.resolution_percentage = 100
scene.cycles.samples = 16 if DRAFT else 48
scene.cycles.device = 'CPU'
scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
scene.render.filepath = str(REVIEW/'island-v5-draft.png' if DRAFT else SOURCE/'island-render-v5.png')
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
destination = REVIEW if DRAFT else SOURCE
bpy.ops.wm.save_as_mainfile(filepath=str(destination/'imperio-delicia-v5.blend'))
(destination/'island-map-v5.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(REVIEW/'geometry-audit.json').write_text(json.dumps({'landings':NODES,'openedGates':opened,
    'movedTrees':moved_trees,
    'routes':[{'id':r['id'],'samples':len(r['line']),'seconds':r['duration']} for r in ROUTES]},indent=2),encoding='utf-8')
print('DELICIA V5: saved editable geometry and matching navigation',flush=True)
if '--no-render' not in sys.argv: bpy.ops.render.render(write_still=True)
