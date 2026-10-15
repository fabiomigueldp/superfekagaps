"""Revision 9: fitted path coping, open thresholds and a waterfall belvedere.

Start with imperio-delicia-v8.blend. --draft renders a review preview;
--audit-only validates the saved v9 geometry without modifying the file.
"""
import bpy
import bmesh
import bisect
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/world/delicia'
REVIEW = ROOT / 'output/delicia/masonry-polish-2026-10-13'
REVIEW.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/delicia'))
import island_geometry as G
from export_island_navigation import export_island

scene = bpy.context.scene
audit_only = '--audit-only' in sys.argv
assert scene.get('model_revision') == (9 if audit_only else 8)
G.M = {m.name: m for m in bpy.data.materials}
python = shutil.which('python')
assert python


def paving_meshes():
    return [o for o in scene.objects if o.name.startswith('Unified masonry paving') and not o.hide_render]


def triangles(objects, top_only=True):
    verts, faces = [], []
    for obj in objects:
        obj.data.calc_loop_triangles()
        start = len(verts)
        verts.extend(list(obj.matrix_world @ v.co) for v in obj.data.vertices)
        faces.extend([start + i for i in t.vertices] for t in obj.data.loop_triangles
                     if not top_only or obj.data.polygons[t.polygon_index].material_index == 0)
    return verts, faces


def closed(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bad = sum(not e.is_manifold for e in bm.edges)
    bm.to_mesh(obj.data)
    bm.free()
    assert bad == 0, f'Open masonry: {obj.name}: {bad}'


def seat_terrain(check_only=False):
    terrain = next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
    tv, tf = triangles([terrain], False)
    pv, pf = triangles(paving_meshes())
    prefix = 'export-surface' if check_only else 'surface'
    source, result_file = REVIEW / (prefix + '-input.json'), REVIEW / (prefix + '-output.json')
    source.write_text(json.dumps({'terrain': {'vertices': tv, 'triangles': tf},
                                 'paving': {'vertices': pv, 'triangles': pf}}, separators=(',', ':')), encoding='utf-8')
    subprocess.run([python, str(ROOT / 'tools/delicia/fit_paving_terrain.py'), str(source), str(result_file)], check=True)
    result = json.loads(result_file.read_text(encoding='utf-8'))
    if check_only:
        assert result['audit']['intersectionsBefore'] == 0, 'Terrain breaks through exported paving.'
    else:
        inverse = terrain.matrix_world.inverted()
        for index, z in result['vertices'].items():
            p = Vector(tv[int(index)])
            p.z = z
            terrain.data.vertices[int(index)].co = inverse @ p
        terrain.data.update()
    (REVIEW / (prefix + '-audit.json')).write_text(json.dumps(result['audit'], indent=2) + '\n', encoding='utf-8')


if audit_only:
    for obj in paving_meshes() + [o for o in scene.objects if o.get('v9_closed')]:
        closed(obj)
    seat_terrain(True)
    print('V9 EXPORTED MASONRY VERIFIED', flush=True)
    sys.exit(0)

G.collection('16 • Fitted stone edges and waterfall belvedere')
preserved = []


def preserve(obj):
    obj.hide_render = True
    obj.hide_viewport = True
    obj['v9_replaced'] = True
    preserved.append(obj.name)


# Give the existing seventh landing an architectural destination. The foundation
# is a closed volume, unioned with its road before edging or terrain fitting.
node = next(o for o in scene.objects if o.get('stage_id') == 'delicia-7')
level = node.matrix_world.translation.z - .014
cx, cy, rx, ry, radius = 4.10, -11.83, 1.42, 1.15, .42
outline = []
for x, y, angle in [(cx+rx-radius, cy+ry-radius, 0), (cx-rx+radius, cy+ry-radius, 90),
                    (cx-rx+radius, cy-ry+radius, 180), (cx+rx-radius, cy-ry+radius, 270)]:
    for i in range(9):
        a = math.radians(angle + i * 90 / 8)
        outline.append((x+radius*math.cos(a), y+radius*math.sin(a)))
n = len(outline)
top = [(x, y, level) for x, y in outline]
base = [(x, y, level-.42) for x, y in outline]
faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
faces += [(i, n+i, n+(i+1)%n, (i+1)%n) for i in range(n)]
terrace = G.mesh('Waterfall belvedere foundation', top+base, faces, ['trail', 'stone-warm'], indices=[0]+[1]*(len(faces)-1))
closed(terrace)
original = next(o for o in paving_meshes() if o.ray_cast(o.matrix_world.inverted() @ Vector((4.2,-11.7,30)), Vector((0,0,-1)))[0])
road = original.copy()
road.data = original.data.copy()
road.name = original.name + ' • belvedere joined'
G.COLLECTION.objects.link(road)
road.modifiers.clear()
bpy.context.view_layer.objects.active = road
road.select_set(True)
union = road.modifiers.new('Join the arrival court to its road', 'BOOLEAN')
union.operation = 'UNION'
union.solver = 'EXACT'
union.object = terrace
bpy.ops.object.modifier_apply(modifier=union.name)
closed(road)
G.bevel(road, .012, 2)
preserve(original)
preserve(terrace)

# Extract the REAL road boundary. Each curb stone sweeps through every bend
# instead of rotating a box between endpoints; neighbouring cuts share a miter.
for obj in list(scene.objects):
    if obj.name.startswith('Dressed path kerb') and not obj.hide_render:
        preserve(obj)
pv, pf = triangles(paving_meshes())
openings = []
for obj in scene.objects:
    if obj.hide_render or obj.type != 'MESH':
        continue
    if obj.name.endswith('closed stone flight') or obj.name in ('Aqueduct pedestrian deck', 'Ponte das Cinco Safras roadway'):
        openings.append([list((obj.matrix_world @ v.co).xy) for v in obj.data.vertices])
edge_input, edge_output = REVIEW / 'edge-input.json', REVIEW / 'edge-layout.json'
edge_input.write_text(json.dumps({'vertices': pv, 'triangles': pf, 'openings': openings}, separators=(',', ':')), encoding='utf-8')
subprocess.run([python, str(ROOT / 'tools/delicia/layout_masonry_edges.py'), str(edge_input), str(edge_output)], check=True)
runs = json.loads(edge_output.read_text(encoding='utf-8'))['runs']
surface = BVHTree.FromPolygons([Vector(p) for p in pv], pf, all_triangles=True)
curb_verts, curb_faces = [], []
stones = 0


def stone_surface(x, y, inward):
    # A small inset avoids floating point misses exactly on a boundary edge.
    hit = surface.ray_cast(Vector((x+inward.x*.008, y+inward.y*.008, 40)), Vector((0,0,-1)))
    if hit[0] is None:
        hit = surface.ray_cast(Vector((x-inward.x*.008, y-inward.y*.008, 40)), Vector((0,0,-1)))
    assert hit[0] is not None, f'Unseated curb at {x}, {y}'
    return hit[0].z


for run in runs:
    points = [Vector(p) for p in run]
    distances = [0.0]
    for a, b in zip(points, points[1:]):
        distances.append(distances[-1] + (b-a).length)
    total = distances[-1]
    if total < .12:
        continue
    cyclic = (points[0]-points[-1]).length < 1e-5

    def section(distance):
        i = min(len(points)-2, max(0, bisect.bisect_right(distances, distance)-1))
        length = distances[i+1]-distances[i]
        p = points[i].lerp(points[i+1], (distance-distances[i])/length)
        tangent = (points[i+1]-points[i]).normalized()
        inward = Vector((-tangent.y, tangent.x))
        # At an authored corner both adjoining faces use the same cross-section.
        if abs(distance-distances[i]) < 1e-6 and (i > 0 or cyclic):
            previous = (points[i]-points[i-1]).normalized() if i else (points[-1]-points[-2]).normalized()
            normal = Vector((-previous.y, previous.x))
            miter = inward+normal
            if miter.length > .05:
                miter.normalize()
                inward = miter / max(.55, miter.dot(inward))
        z = stone_surface(p.x, p.y, inward.normalized())
        return p, inward, z

    count = max(1, round(total/.48))
    for j in range(count):
        start = total*j/count + (.003 if j or cyclic else 0)
        end = total*(j+1)/count - (.003 if j<count-1 or cyclic else 0)
        samples = [start] + [d for d in distances[1:-1] if start+1e-5 < d < end-1e-5] + [end]
        offset = len(curb_verts)
        # A bevelled dressed-stone profile, bedded into the road's edge.
        profile = [(-.050,-.045),(.050,-.045),(.050,.026),(.035,.041),(-.035,.041),(-.050,.026)]
        for distance in samples:
            p, inward, z = section(distance)
            for side, dz in profile:
                q = p+inward*side
                curb_verts.append((q.x,q.y,z+dz))
        faces = [tuple(offset+i for i in reversed(range(6))), tuple(offset+6*(len(samples)-1)+i for i in range(6))]
        faces += [(offset+6*k+i,offset+6*k+(i+1)%6,offset+6*(k+1)+(i+1)%6,offset+6*(k+1)+i)
                  for k in range(len(samples)-1) for i in range(6)]
        curb_faces.extend(faces)
        stones += 1
curb = G.mesh('Fitted limestone coping • all paths', curb_verts, curb_faces, 'limestone')
closed(curb)
curb['v9_closed'] = True
curb['stone_count'] = stones

# A low river-facing balustrade matches the bridge. The north entrance stays
# open and the landing marker remains at exactly its original walking position.
rail = [(5.26,-12.57,level),(3.10,-12.57,level),(2.90,-12.35,level),(2.90,-11.20,level),(3.10,-10.98,level),(3.65,-10.98,level)]
G.railing('Belvedere river balustrade',rail,.48,'limestone',.48)
for x,y,z in [rail[0],rail[1],rail[-1]]:
    G.box('Belvedere terminal pier',(x,y,z+.27),(.22,.22,.55),'stone-warm',.025)
    G.box('Belvedere pier capital',(x,y,z+.57),(.30,.30,.075),'limestone',.012)
for y in (-12.27,-11.45):
    G.box('Belvedere bench support',(5.12,y,level+.15),(.27,.20,.30),'stone-warm',.018)
G.box('Belvedere stone bench',(5.12,-11.86,level+.35),(.36,1.17,.14),'limestone',.024)
# Larger inlaid slabs articulate this quiet arrival court, without path markers.
for x in (3.38,4.02,4.66):
    for y in (-12.26,-11.69):
        G.box('Belvedere inset flagstone',(x,y,level+.007),(.61,.54,.020),'trail',.008)

seat_terrain()
metadata = json.loads((SOURCE / 'island-map-v8.json').read_text(encoding='utf-8'))
routes = {o.name.split(' • ')[0]: [o.matrix_world @ Vector(p.co[:3]) for p in o.data.splines[0].points]
          for o in scene.objects if o.type == 'CURVE' and 'from' in o}
(REVIEW / 'masonry-audit.json').write_text(json.dumps({'revision':9,'fittedStones':stones,'copingRuns':len(runs),
    'preservedObjects':len(preserved),'closedPavingMeshes':[o.name for o in paving_meshes()],
    'belvedereLanding':list(node.matrix_world.translation),'northEntranceOpen':True},indent=2)+'\n',encoding='utf-8')
export_island(scene,metadata,routes,9,SOURCE,REVIEW,'--draft' in sys.argv,'--no-render' not in sys.argv)
