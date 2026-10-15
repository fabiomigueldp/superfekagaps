"""Revision 10: grounded terraces and continuous landscape walls.

Start with the preserved v9 .blend. --draft renders a preview. --audit-only
checks the saved v10 solids, foundation seating and paving clearances.
The main camera, stage landings and navigation curves are preserved.
"""
import bpy
import bmesh
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
REVIEW = ROOT / 'output/delicia/landscape-polish-2026-10-13'
REVIEW.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/delicia'))
import island_geometry as G
from export_island_navigation import export_island

scene = bpy.context.scene
audit_only = '--audit-only' in sys.argv
assert scene.get('model_revision') == (10 if audit_only else 9)
G.M = {m.name: m for m in bpy.data.materials}
terrain = next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
terrain_bvh = BVHTree.FromPolygons([terrain.matrix_world @ v.co for v in terrain.data.vertices],
                                  [list(p.vertices) for p in terrain.data.polygons])


def ground(x, y):
    p = terrain_bvh.ray_cast(Vector((x, y, 40)), Vector((0, 0, -1)))[0]
    assert p is not None, f'No ground at {x}, {y}'
    return p.z


def close(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges), f'Open solid: {obj.name}'
    assert all(f.calc_area() > 1e-10 for f in bm.faces), f'Degenerate face: {obj.name}'
    bm.to_mesh(obj.data)
    bm.free()
    obj['v10_closed'] = True
    return obj


def paving_data():
    vertices, triangles = [], []
    for o in scene.objects:
        if o.hide_render or not o.name.startswith('Unified masonry paving'): continue
        o.data.calc_loop_triangles()
        offset = len(vertices)
        vertices.extend(list(o.matrix_world @ v.co) for v in o.data.vertices)
        triangles.extend([offset+i for i in t.vertices] for t in o.data.loop_triangles
                         if o.data.polygons[t.polygon_index].material_index == 0)
    return {'vertices': vertices, 'triangles': triangles}


def sample_line(line, spacing=.14):
    result = []
    for a, b in zip(line, line[1:]):
        a, b = Vector(a), Vector(b)
        count = max(1, math.ceil((b-a).length/spacing))
        result.extend(a.lerp(b, i/count) for i in range(count))
    return result + [Vector(line[-1])]


def audit_foundations():
    result = []
    for obj in scene.objects:
        if 'v10_foundation_outline' not in obj: continue
        outline = json.loads(obj['v10_foundation_outline'])
        bottom = obj['v10_foundation_bottom']
        boundary = sample_line(outline+[outline[0]], .035)
        clearances = [ground(p.x, p.y)-bottom for p in boundary]
        assert min(clearances) >= .12, f'Unsupported foundation: {obj.name}'
        result.append({'name': obj.name, 'boundarySamples': len(boundary),
                       'minimumEmbedMeters': round(min(clearances), 4),
                       'previousMaximumGapMeters': round(obj['v10_previous_gap'], 4)})
    return result


if audit_only:
    solids = [o for o in scene.objects if o.get('v10_closed')]
    for obj in solids: close(obj)
    foundations = audit_foundations()
    terrain.data.calc_loop_triangles()
    source = {'terrain': {'vertices': [list(terrain.matrix_world@v.co) for v in terrain.data.vertices],
                           'triangles': [list(t.vertices) for t in terrain.data.loop_triangles]},
              'paving': paving_data()}
    (REVIEW/'surface-input.json').write_text(json.dumps(source), encoding='utf-8')
    subprocess.run([shutil.which('python'), str(ROOT/'tools/delicia/fit_paving_terrain.py'),
                    str(REVIEW/'surface-input.json'), str(REVIEW/'surface-output.json')], check=True)
    surface = json.loads((REVIEW/'surface-output.json').read_text())['audit']
    assert surface['intersectionsBefore'] == 0
    report = {'revision': 10, 'closedNewMeshes': len(solids), 'foundations': foundations, 'paving': surface}
    (REVIEW/'export-geometry-audit.json').write_text(json.dumps(report, indent=2)+'\n')
    print('V10 EXPORTED SUPPORTS VERIFIED', json.dumps(report), flush=True)
    sys.exit(0)

G.collection('17 • Grounded terraces and graded landscape walls')
preserved = []


def preserve(obj):
    obj.hide_render = True
    obj.hide_viewport = True
    obj['v10_replaced'] = True
    preserved.append(obj.name)


def prism(name, outline, top, bottom, material='stone-warm'):
    n = len(outline)
    vertices = [(p.x, p.y, z) for z in (top, bottom) for p in outline]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
    faces += [(i, n+i, n+(i+1)%n, (i+1)%n) for i in range(n)]
    return close(G.mesh(name, vertices, faces, material))


# Closed stone courses share a quiet mortar core. Blocks are fitted to the
# local wall plane, with shallow bevels rather than a painted brick texture.
stone_vertices, stone_faces = [], []
stone_count = 0


def stone(a, b, lo_a, lo_b, hi_a, hi_b, depth=.036):
    global stone_count
    if min(hi_a-lo_a, hi_b-lo_b) < .035: return
    delta = b-a
    normal = Vector((delta.y, -delta.x)).normalized()
    origin = len(stone_vertices)
    for offset in (-.015, depth):
        aa, bb = a+normal*offset, b+normal*offset
        stone_vertices.extend([(aa.x, aa.y, lo_a), (bb.x, bb.y, lo_b),
                               (bb.x, bb.y, hi_b), (aa.x, aa.y, hi_a)])
    stone_faces.extend(tuple(origin+i for i in face) for face in
                       [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    stone_count += 1


foundation_names = ['Garden limestone terrace', 'Campanile plinth', 'Foundation',
                    'Foundation.005', 'Foundation.007', 'Waterfall belvedere foundation']
for name in foundation_names:
    source = bpy.data.objects[name]
    # The preserved v9 belvedere operand supplies its exact rounded footprint.
    face = min(source.data.polygons, key=lambda f: f.center.z)
    points = [source.matrix_world @ source.data.vertices[i].co for i in reversed(face.vertices)]
    old_bottom = min(p.z for p in points)
    xy = [Vector((p.x, p.y)) for p in points]
    area = sum(a.x*b.y-b.x*a.y for a,b in zip(xy, xy[1:]+xy[:1]))
    if area < 0: xy.reverse()
    # Recess the support beneath the original projecting cap.
    inset = []
    for i, p in enumerate(xy):
        prev = (p-xy[i-1]).normalized()
        nxt = (xy[(i+1)%len(xy)]-p).normalized()
        normal = Vector((-prev.y, prev.x))+Vector((-nxt.y, nxt.x))
        normal.normalize()
        inset.append(p+normal*.045/max(.5, normal.dot(Vector((-nxt.y,nxt.x)))))
    boundary = sample_line(inset+[inset[0]], .075)
    ground_values = [ground(p.x,p.y) for p in boundary]
    gap = old_bottom-min(ground_values)
    if gap <= .05: continue
    bottom = min(ground_values)-.22
    top = old_bottom+.07
    obj = prism(name+' • grounded stone base', inset, top, bottom)
    obj['v10_foundation_outline'] = json.dumps([list(p) for p in inset])
    obj['v10_foundation_bottom'] = bottom
    obj['v10_previous_gap'] = gap
    G.bevel(obj, .012, 2)
    for a,b in zip(inset,inset[1:]+inset[:1]):
        length=(b-a).length
        for row in range(math.floor(bottom/.24), math.ceil(top/.24)):
            low,high=max(bottom,row*.24+.006),min(top-.01,(row+1)*.24-.006)
            if high-low<.04: continue
            # Stagger the courses without leaving gaps at the corners.
            cuts=[0]+[x for i in range(math.ceil(length/.56)+1) if 0 < (x:=i*.56+(row%2)*.28) < length]+[length]
            for start,end in zip(cuts,cuts[1:]):
                if end-start<.04: continue
                aa=a+(b-a)*((start+.006)/length);bb=a+(b-a)*((end-.006)/length)
                if high < min(ground(aa.x,aa.y),ground(bb.x,bb.y))-.06: continue
                stone(aa,bb,low,low,high,high)


def catmull(points, steps=14):
    p=[Vector(points[0])]+[Vector(v) for v in points]+[Vector(points[-1])]
    line=[]
    for i in range(1,len(p)-2):
        a,b,c,d=p[i-1:i+3]
        for j in range(steps):
            t=j/steps
            line.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return line+[Vector(points[-1])]


wall_specs = [
    {'name':'Old orchard retaining wall','height':.42,'points':[(-23,.2),(-19,1.4),(-14,.9),(-9,1.7)]},
    {'name':'Coastal path retaining wall','height':.43,'points':[(8,-14.3),(12,-15.5),(17,-14.5),(21.5,-11.7)]}]
for spec in wall_specs:
    spec['points']=[list(p) for p in catmull(spec['points'])]
    for obj in list(scene.objects):
        if obj.name.startswith(spec['name']) and not obj.hide_render: preserve(obj)
wall_input={'paving':paving_data(),'walls':wall_specs}
(REVIEW/'wall-input.json').write_text(json.dumps(wall_input),encoding='utf-8')
subprocess.run([shutil.which('python'),str(ROOT/'tools/delicia/layout_landscape_walls.py'),
                str(REVIEW/'wall-input.json'),str(REVIEW/'wall-layout.json')],check=True)
walls=json.loads((REVIEW/'wall-layout.json').read_text())
wall_audit=[]

for spec in walls:
    for index, run in enumerate(spec['runs']):
        line=sample_line(run,.13)
        heights=[ground(p.x,p.y)+spec['height'] for p in line]
        # Smooth the small terrain ripples while following the broad grade.
        for _ in range(3):
            heights=[heights[0]]+[(heights[i-1]+2*heights[i]+heights[i+1])/4 for i in range(1,len(heights)-1)]+[heights[-1]]
        sides=[]
        for i,p in enumerate(line):
            tangent=(line[min(i+1,len(line)-1)]-line[max(0,i-1)]).normalized()
            normal=Vector((-tangent.y,tangent.x))
            sides.append((p-normal*.12,p+normal*.12))
        verts=[]
        for i,(left,right) in enumerate(sides):
            z=heights[i]
            verts.extend([(left.x,left.y,ground(left.x,left.y)-.20),(right.x,right.y,ground(right.x,right.y)-.20),
                          (right.x,right.y,z),(left.x,left.y,z)])
        faces=[(3,2,1,0),tuple(4*(len(line)-1)+i for i in range(4))]
        faces += [(4*k+i,4*k+(i+1)%4,4*(k+1)+(i+1)%4,4*(k+1)+i) for k in range(len(line)-1) for i in range(4)]
        core=close(G.mesh(f"{spec['name']} • graded core {index+1}",verts,faces,'stone-warm'))
        G.bevel(core,.009,2)
        # Continuous cap and two dressed-stone courses, fitted through every bend.
        capverts=[]
        for i,p in enumerate(line):
            tangent=(line[min(i+1,len(line)-1)]-line[max(0,i-1)]).normalized()
            normal=Vector((-tangent.y,tangent.x))
            for side,z in [(-.17,heights[i]-.018),(.17,heights[i]-.018),(.17,heights[i]+.060),(-.17,heights[i]+.060)]:
                q=p+normal*side;capverts.append((q.x,q.y,z))
        cap=close(G.mesh(f"{spec['name']} • continuous coping {index+1}",capverts,faces,'limestone'))
        G.bevel(cap,.014,2)
        # Pair consecutive samples into larger stones; the mortar core is sealed.
        for start in range(0,len(line)-1,4):
            end=min(start+4,len(line)-1)
            for side in (0,1):
                a,b=sides[start][side],sides[end][side]
                za,zb=heights[start],heights[end]
                delta=(b-a).normalized()*.006
                a,b=a+delta,b-delta
                if side==1:a,b,za,zb=b,a,zb,za
                for low,high in [(-.43,-.22),(-.208,-.02)]:
                    stone(a,b,za+low,zb+low,za+high,zb+high,.022)
        for i in (0,len(line)-1):
            p=line[i];base=ground(p.x,p.y)-.14;top=heights[i]+.105
            G.box(spec['name']+' finished pier',(p.x,p.y,(base+top)/2),(.33,.33,top-base),'stone-warm',.018)
            G.box(spec['name']+' pier coping',(p.x,p.y,top+.035),(.40,.40,.075),'limestone',.016)
        wall_audit.append({'wall':spec['name'],'run':index+1,'samples':len(line),
                           'lengthMeters':round(sum((b-a).length for a,b in zip(line,line[1:])),3)})

cladding=close(G.mesh('Fitted ashlar • supports and landscape walls',stone_vertices,stone_faces,'stone-warm'))
G.bevel(cladding,.006,1)

# Keep the grape-like vine masses over their pergola instead of projecting
# across the approach. Copies preserve the original editable foliage.
trimmed=[]
for old in list(scene.objects):
    if not old.name.startswith('Pergola trailing foliage') or old.hide_render:continue
    new=old.copy();new.data=old.data.copy();G.COLLECTION.objects.link(new)
    new.name=old.name+' • tucked above pergola'
    new.location.x*=.86
    new.location.z+=.08
    new.scale.x*=.90;new.scale.y*=.90
    preserve(old);trimmed.append(new.name)

report={'revision':10,'foundations':audit_foundations(),'walls':wall_audit,
        'dressedStones':stone_count,'trimmedVines':len(trimmed),'preservedObjects':preserved}
(REVIEW/'landscape-audit.json').write_text(json.dumps(report,indent=2)+'\n')
metadata=json.loads((SOURCE/'island-map-v9.json').read_text(encoding='utf-8'))
routes={o.name.split(' • ')[0]:[o.matrix_world@Vector(p.co[:3]) for p in o.data.splines[0].points]
        for o in scene.objects if o.type=='CURVE' and 'from' in o}
export_island(scene,metadata,routes,10,SOURCE,REVIEW,'--draft' in sys.argv,'--no-render' not in sys.argv)
