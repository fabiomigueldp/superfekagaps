"""Revision 11: walk into the garden; stepped, seated links to the campanile.

Run from preserved v10. --draft renders the review; --audit-only verifies v11.
Navigation, visible masonry and camera depth are exported from the same model.
"""
import bpy, bmesh, bisect, json, math, shutil, subprocess, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/world/delicia'
REVIEW=ROOT/'output/delicia/garden-access-2026-10-13'
REVIEW.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/delicia'))
import island_geometry as G
from export_island_navigation import export_island
scene=bpy.context.scene
audit_only='--audit-only' in sys.argv
assert scene.get('model_revision')==(11 if audit_only else 10)
G.M={m.name:m for m in bpy.data.materials}
python=shutil.which('python');assert python
terrain=next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
terrain_bvh=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],[list(p.vertices) for p in terrain.data.polygons])

def ground(x,y):
    p=terrain_bvh.ray_cast(Vector((x,y,40)),Vector((0,0,-1)))[0]
    assert p is not None,f'No terrain: {x},{y}'
    return p.z

def close(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    assert all(e.is_manifold for e in bm.edges),f'Open solid: {obj.name}'
    assert all(f.calc_area()>1e-11 for f in bm.faces),f'Degenerate face: {obj.name}'
    # Paving is wound explicitly from oriented planar triangles. Recalculating
    # across every near-coplanar sliver is both unnecessary and very expensive.
    if obj.name.startswith('Unified masonry paving'):
        bm.normal_update()
        assert bm.calc_volume(signed=True)>0,f'Inside-out paving: {obj.name}'
    else:bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free();obj['v11_closed']=True
    return obj

def meshes():return [o for o in scene.objects if o.name.startswith('Unified masonry paving') and not o.hide_render]
def triangles(objects,top_only=True):
    vertices=[];faces=[]
    for o in objects:
        o.data.calc_loop_triangles();n=len(vertices)
        vertices.extend(list(o.matrix_world@v.co) for v in o.data.vertices)
        faces.extend([n+i for i in t.vertices] for t in o.data.loop_triangles
                     if not top_only or (o.data.polygons[t.polygon_index].normal.z>.01 if o.get('v11_flight')
                                         else o.data.polygons[t.polygon_index].material_index==0))
    return vertices,faces

def seat(check=False):
    tv,tf=triangles([terrain],False)
    pv,pf=triangles(meshes()+[o for o in scene.objects if o.get('v11_flight')])
    path=REVIEW/('export-surface' if check else 'surface')
    path.with_suffix('.json').write_text(json.dumps({'minimumTerrainHeight':-.25,'terrain':{'vertices':tv,'triangles':tf},'paving':{'vertices':pv,'triangles':pf}}))
    subprocess.run([python,str(ROOT/'tools/delicia/fit_paving_terrain.py'),str(path.with_suffix('.json')),str(path.with_suffix('.result.json'))],check=True)
    result=json.loads(path.with_suffix('.result.json').read_text())
    if check:assert result['audit']['intersectionsBefore']==0
    else:
        for i,z in result['vertices'].items():terrain.data.vertices[int(i)].co.z=z
        terrain.data.update()
    return result['audit']

if audit_only:
    solids=[o for o in scene.objects if o.get('v11_closed') and not o.hide_render]
    for o in solids:close(o)
    report={'revision':11,'closedMeshes':len(solids),'surface':seat(True)}
    (REVIEW/'export-geometry-audit.json').write_text(json.dumps(report,indent=2))
    print('V11 EXPORTED ACCESS VERIFIED',json.dumps(report),flush=True);sys.exit(0)

G.collection('18 • Garden gates, stair courts and campanile access')
preserved=[]
def preserve(o):
    if o.hide_render:return
    o.hide_render=True;o.hide_viewport=True;o['v11_replaced']=True;preserved.append(o.name)
def line(points,spacing=.12):
    result=[]
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b);count=max(1,math.ceil((b-a).length/spacing))
        result.extend(a.lerp(b,i/count) for i in range(count))
    return result+[Vector(points[-1])]
def smooth(points,rounds=2):
    points=[Vector(p) for p in points]
    for _ in range(rounds):
        new=[points[0]]
        for a,b in zip(points,points[1:]):new.extend((a*.75+b*.25,a*.25+b*.75))
        points=new+[points[-1]]
    return line(points)
def rect(a,b,width):
    a,b=Vector(a),Vector(b);d=(b-a);d.z=0;d.normalize();n=Vector((-d.y,d.x,0))*width/2
    return [list(p.xy) for p in (a-n,b-n,b+n,a+n)]

curves={o.name.split(' • ')[0]:o for o in scene.objects if o.type=='CURVE' and 'from' in o}
routes={k:[o.matrix_world@Vector(p.co[:3]) for p in o.data.splines[0].points] for k,o in curves.items()}
original_routes={k:[list(p) for p in v] for k,v in routes.items()}
metadata=json.loads((SOURCE/'island-map-v10.json').read_text())
old_paving=meshes();pv,pf=triangles(old_paving)
old_surface=BVHTree.FromPolygons([Vector(p) for p in pv],pf,all_triangles=True)
old_node=routes['garden-gate'][-1].copy()
new_node=Vector((19.35,-9,3.825))
north_top=routes['garden-gate'][2].copy()
north_bottom=Vector((18.70,-6.05,3.825))
east_top=Vector((20.0,-9,3.825));middle_west=Vector((22.25,-9,2.09))
middle_east=Vector((22.85,-9,2.09));east_bottom=Vector((24.9,-9,.85))
clock_node=routes['clock-sanctuary'][-1].copy()
flights=[('Garden north descent',north_bottom,north_top,1.06,10),
         ('Garden east upper stair',middle_west,east_top,1.12,9),
         ('Campanile lower stair',east_bottom,middle_east,1.12,8)]
reserved=[rect(a,b,w) for _,a,b,w,_ in flights]
routes['garden-gate']=line([*routes['garden-gate'][:3],north_bottom,(19.35,-6.20,3.825),(19.35,-6.85,3.825),new_node])
lower_curve=smooth([east_bottom,(25.1,-8.75,.85),(25.1,-7.65,.85),(24.6,-7.55,.85),clock_node])
routes['clock-sanctuary']=line([new_node,east_top,middle_west,middle_east,east_bottom])+lower_curve[1:]
for o in scene.objects:
    if o.get('stage_id')=='delicia-9' or o.name.startswith('delicia-9 '):o.location+=new_node-old_node
bpy.context.view_layer.update()

# Replace only the southeast corridor. The coastal walk joins the lower court,
# while the tower door has its own level threshold on the middle landing.
coast_source=bpy.data.objects['Walk of the last harvest']
coast_vertices=[coast_source.matrix_world@v.co for v in coast_source.data.vertices]
coast=[list((a+b)/2) for a,b in zip(coast_vertices[::2],coast_vertices[1::2])]
coast_keep=[Vector(p) for p in coast if p[0]<18.4]
coast_new=smooth([coast_keep[-1],(20,-11.5,.65),(22.4,-10.8,.74),(24.5,-10.2,.85),east_bottom])
coast_line=coast_keep+coast_new[1:]
tower=line([middle_west,(22,-8.4,2.09),(22,-7.28,2.168)])
roads=[{'id':'north-garden','points':[list(p) for p in routes['garden-gate']],'width':.76},
       {'id':'garden-clock','points':[list(p) for p in routes['clock-sanctuary']],'width':.78},
       {'id':'coastal-walk','points':[list(p) for p in coast_line],'width':.76},
       {'id':'tower-threshold','points':[list(p) for p in tower],'width':.90}]
# A landing wide enough to turn on, with no diagonal fan across different grades.
platforms=[[[21.83,-9.57],[22.92,-9.57],[22.92,-8.43],[21.83,-8.43]]]
mask=[16.7,-14,27,-4.25]
layout={'vertices':pv,'triangles':pf,'mask':mask,'roads':roads,'stairs':reserved,
        'courts':[[*new_node,.52],[*clock_node,.67]],'platforms':platforms}
(REVIEW/'paving-input.json').write_text(json.dumps(layout))
subprocess.run([python,str(ROOT/'tools/delicia/layout_garden_access.py'),str(REVIEW/'paving-input.json'),str(REVIEW/'paving-layout.json')],check=True)
patches=json.loads((REVIEW/'paving-layout.json').read_text())['patches']
segments=[]
for r in roads:
    pts=[Vector(p) for p in r['points']]
    for a,b in zip(pts,pts[1:]):
        d=b-a;l2=d.x*d.x+d.y*d.y
        if l2>1e-10:segments.append((a,d,l2))
def surface(x,y):
    old=old_surface.ray_cast(Vector((x,y,40)),Vector((0,0,-1)))[0]
    if old is None:
        for dx,dy in ((.00001,0),(-.00001,0),(0,.00001),(0,-.00001)):
            old=old_surface.ray_cast(Vector((x+dx,y+dy,40)),Vector((0,0,-1)))[0]
            if old is not None:break
    if x<mask[0]+.12 or y>mask[3]-.10:
        if old is not None:return old.z
    if 21.83-1e-5<=x<=22.92+1e-5 and -9.57-1e-5<=y<=-8.43+1e-5:return 2.076
    if math.hypot(x-clock_node.x,y-clock_node.y)<.68:return clock_node.z-.014
    if 18.1<x<20.05 and -10<y<-6.05:return new_node.z-.014
    if old is not None and not(mask[0]<=x<=mask[2] and mask[1]<=y<=mask[3]):return old.z
    if not(mask[0]-.1<=x<=mask[2]+.1 and mask[1]-.1<=y<=mask[3]+.1):
        nearest=old_surface.find_nearest(Vector((x,y,ground(x,y)+.06)))[0]
        assert nearest is not None
        return nearest.z
    candidates=[]
    for a,d,l2 in segments:
        t=max(0,min(1,((x-a.x)*d.x+(y-a.y)*d.y)/l2));p=a+d*t
        candidates.append(((x-p.x)**2+(y-p.y)**2,p.z-.014))
    candidates.sort();near=candidates[0]
    same=[p for p in candidates[:6] if p[0]<near[0]+.025 and abs(p[1]-near[1])<.16]
    weights=[1/(p[0]+.002)**3 for p in same]
    return sum(p[1]*w for p,w in zip(same,weights))/sum(weights)

for obj in old_paving:preserve(obj)
for i,patch in enumerate(patches):
    top=[(x,y,surface(x,y)) for x,y in patch['vertices']];n=len(top)
    print('PAVING HEIGHTS',i+1,flush=True)
    base=[(x,y,min(z-.15,ground(x,y)-.10)) for x,y,z in top]
    faces=[tuple(t) for t in patch['triangles']]+[tuple(n+i for i in reversed(t)) for t in patch['triangles']]
    for ring in patch['rings']:
        faces.extend((a,n+a,n+b,b) for a,b in zip(ring,ring[1:]+ring[:1]))
    obj=G.mesh(f'Unified masonry paving v11 {i+1}',top+base,faces,['trail','stone-warm'],indices=[0]*len(patch['triangles'])+[1]*(len(faces)-len(patch['triangles'])))
    print('PAVING VOLUME',i+1,flush=True)
    close(obj)
    G.bevel(obj,.007,1)
    print('PAVING BUILT',i+1,len(top),flush=True)

# Remove all the superseded curbs and the local wall skin below the old ramps.
for o in list(scene.objects):
    if o.hide_render:continue
    p=o.matrix_world.translation
    if o.name.startswith('Fitted limestone coping'):preserve(o)
    if o.name.startswith('Retaining wall dressed stone') and mask[0]<p.x<mask[2] and mask[1]<p.y<mask[3]:preserve(o)

# A real opening in the north balustrade; each cut end receives a newel.
for o in list(scene.objects):
    if o.hide_render or not o.name.startswith('Garden stone balustrade'):continue
    p=o.matrix_world.translation
    if o.type=='CURVE':
        pts=[o.matrix_world@Vector(v.co[:3]) for v in o.data.splines[0].points]
        if all(abs(v.y+6.65)<.03 for v in pts):
            preserve(o)
            G.pipe('Garden north wall coping west',[(12.2,-6.65,4.47),(18.72,-6.65,4.47)],.052,'limestone')
    elif abs(p.y+6.65)<.03 and p.x>18.65:preserve(o)
for x in (18.72,19.96):
    G.box('Garden gate pier',(x,-6.65,4.10),(.20,.20,.66),'limestone',.022)
    G.box('Garden gate capital',(x,-6.65,4.46),(.26,.26,.08),'stone-light',.01)

# Recess the pergola's eastern bay as a complete structural assembly. The
# columns, runner, rafters and vines still meet, but the entry is an open aisle.
for old in list(scene.objects):
    if old.hide_render or not old.name.startswith(('Pergola stone column','Pergola runner','Pergola oak rafter','Pergola trailing foliage')):continue
    if not old.name.startswith('Pergola oak rafter') and old.matrix_world.translation.x<18:continue
    new=old.copy();new.data=old.data.copy();G.COLLECTION.objects.link(new);new.name=old.name+' • recessed east bay'
    if old.name.startswith('Pergola oak rafter'):
        # Beams use local Z for their length. Keep the west end fixed.
        new.location.x-=.30;new.scale.z*=(7.1-.6)/7.1
    else:new.location.x-=.60
    preserve(old)

relocated=[]
def relocate_tree(prefixes,trunk_prefix,near,target):
    trunks=[o for o in scene.objects if o.name.startswith(trunk_prefix) and not o.hide_render]
    positions={o:o.matrix_world.translation.copy() for o in trunks}
    trunk=min(trunks,key=lambda o:(positions[o].xy-Vector(near)).length)
    center=positions[trunk];shift=Vector((target[0]-center.x,target[1]-center.y,ground(*target)-ground(center.x,center.y)))
    parts=[o for o in scene.objects if o.name.startswith(prefixes) and not o.hide_render]
    owners={o:min(trunks,key=lambda t:(positions[t]-o.matrix_world.translation).xy.length_squared) for o in parts}
    for old in parts:
        if owners[old]!=trunk:continue
        new=old.copy();new.data=old.data.copy();G.COLLECTION.objects.link(new);new.name=old.name+' • replanted clear of access';new.location+=shift;preserve(old)
    relocated.append({'tree':trunk.name,'from':list(center),'to':target})
relocate_tree(('Cypress trunk','Tapering cypress foliage'),'Cypress trunk',(20.3,-9.6),(20.2,-10.7))
relocate_tree(('Cypress trunk','Tapering cypress foliage'),'Cypress trunk',(20,-6.5),(20.65,-6.2))
relocate_tree(('Gnarled orange trunk','Citrus branch','Angular leafy crown','Ripe citrus fruit'),'Gnarled orange trunk',(24,-10),(25.2,-4.4))
shrub=bpy.data.objects['Coastal shrub cluster.017'];copy=shrub.copy();copy.data=shrub.data.copy();G.COLLECTION.objects.link(copy)
copy.name='Coastal shrub • beside the garden gate';p=shrub.matrix_world.translation
copy.location+=Vector((-1.05,0,ground(p.x-1.05,p.y)-ground(p.x,p.y)));preserve(shrub)

stair_audit=[]
ashlar_v=[];ashlar_f=[];ashlar_count=0
def dressed_stone(a,b,outward,low,high_a,high_b):
    global ashlar_count
    if min(high_a,high_b)-low<.035:return
    offset=len(ashlar_v)
    for depth in (-.012,.020):
        aa=a+outward*depth;bb=b+outward*depth
        ashlar_v.extend([(aa.x,aa.y,low),(bb.x,bb.y,low),(bb.x,bb.y,high_b),(aa.x,aa.y,high_a)])
    ashlar_f.extend(tuple(offset+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    ashlar_count+=1
for name,a,b,width,count in flights:
    delta=b-a;length=delta.xy.length;d=Vector((delta.x,delta.y,0)).normalized();n=Vector((-d.y,d.x,0))
    rise=delta.z/count;tread=length/count
    assert .20<=tread and 0<rise<=.20
    floor=min(ground(a.x,a.y),ground(b.x,b.y),a.z)-.22
    profile=[(0,floor),(0,a.z-.014)]
    for i in range(count):profile.extend(((length*i/count,a.z+(i+1)*rise-.014),(length*(i+1)/count,a.z+(i+1)*rise-.014)))
    profile.append((length,floor));nv=len(profile)
    verts=[(a.x+d.x*t+n.x*side*width/2,a.y+d.y*t+n.y*side*width/2,z) for side in (-1,1) for t,z in profile]
    faces=[tuple(reversed(range(nv))),tuple(range(nv,2*nv))]+[(i,(i+1)%nv,(i+1)%nv+nv,i+nv) for i in range(nv)]
    obj=close(G.mesh(name+' closed stone flight',verts,faces,'limestone'));obj['v11_flight']=True;G.bevel(obj,.010,2)
    for side in (-1,1):
        aa=a+n*side*(width/2+.045);bb=b+n*side*(width/2+.045)
        vv=[(p.x+n.x*s*.055,p.y+n.y*s*.055,z) for s in (-1,1) for p,z in [(aa,floor),(bb,floor),(bb,b.z+.15),(aa,a.z+.15)]]
        close(G.mesh(name+' cheek',vv,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone-warm'))
        G.pipe(name+' sloping coping',[(*aa.xy,a.z+.17),(*bb.xy,b.z+.17)],.060,'limestone',False,1)
        # Bed horizontal stone courses into the closed cheek, trimming their
        # upper edges to its slope instead of stacking rotated boxes.
        wall_a=aa+n*side*.055;wall_b=bb+n*side*.055
        for row in range(math.floor(floor/.24),math.ceil((b.z+.15)/.24)):
            low=max(floor,row*.24+.006)
            cuts=[0]+[t for k in range(math.ceil(length/.54)+1) if 0<(t:=k*.54+(row%2)*.27)<length]+[length]
            for start,end in zip(cuts,cuts[1:]):
                if end-start<.045:continue
                ta=(start+.006)/length;tb=(end-.006)/length
                pa=wall_a.lerp(wall_b,ta);pb=wall_a.lerp(wall_b,tb)
                ha=min((row+1)*.24-.006,a.z+delta.z*ta+.125)
                hb=min((row+1)*.24-.006,a.z+delta.z*tb+.125)
                if max(ha,hb)<min(ground(pa.x,pa.y),ground(pb.x,pb.y))-.05:continue
                dressed_stone(pa,pb,n*side,low,ha,hb)
        for p in (aa,bb):
            G.box(name+' end pier',(p.x,p.y,p.z+.105),(.18,.18,.28),'limestone',.02)
    stair_audit.append({'name':name,'steps':count,'rise':round(rise,4),'tread':round(tread,4),'width':width})
cladding=close(G.mesh('Stair cheeks • fitted stone courses',ashlar_v,ashlar_f,'stone-warm'))
G.bevel(cladding,.005,1)
for x in (21.52,22.48):
    G.railing('Campanile threshold low balustrade',[(x,-8.35,2.08),(x,-7.43,2.15)],.28,'limestone',.32)
    for y,z in ((-8.35,2.08),(-7.43,2.15)):
        G.box('Campanile threshold terminal',(x,y,z+.16),(.15,.15,.32),'limestone',.015)

# Matched coping follows the new surface; the stair and terrace thresholds stay open.
pv,pf=triangles(meshes());openings=reserved[:]
for o in scene.objects:
    if o.hide_render or o.type!='MESH':continue
    if o.name.endswith('closed stone flight') or o.name in ('Aqueduct pedestrian deck','Ponte das Cinco Safras roadway'):
        openings.append([list((o.matrix_world@v.co).xy) for v in o.data.vertices])
(REVIEW/'edge-input.json').write_text(json.dumps({'vertices':pv,'triangles':pf,'openings':openings}))
subprocess.run([python,str(ROOT/'tools/delicia/layout_masonry_edges.py'),str(REVIEW/'edge-input.json'),str(REVIEW/'edge-layout.json')],check=True)
runs=json.loads((REVIEW/'edge-layout.json').read_text())['runs']
bvh=BVHTree.FromPolygons([Vector(p) for p in pv],pf,all_triangles=True)
cv=[];cf=[];stones=0
for run in runs:
    points=[Vector(p) for p in run];distances=[0]
    for a,b in zip(points,points[1:]):distances.append(distances[-1]+(b-a).length)
    total=distances[-1];count=max(1,round(total/.48));cyclic=(points[0]-points[-1]).length<1e-5
    def section(distance):
        i=min(len(points)-2,max(0,bisect.bisect_right(distances,distance)-1));p=points[i].lerp(points[i+1],(distance-distances[i])/(distances[i+1]-distances[i]))
        tangent=(points[i+1]-points[i]).normalized();normal=Vector((-tangent.y,tangent.x))
        if abs(distance-distances[i])<1e-6 and (i>0 or cyclic):
            prev=(points[i]-points[i-1]).normalized() if i else (points[-1]-points[-2]).normalized();m=normal+Vector((-prev.y,prev.x))
            if m.length>.05:m.normalize();normal=m/max(.55,m.dot(normal))
        hit=None
        for sign in (1,-1):
            q=p+normal.normalized()*.008*sign;hit=bvh.ray_cast(Vector((q.x,q.y,40)),Vector((0,0,-1)))[0]
            if hit is not None:break
        assert hit is not None
        return p,normal,hit.z
    for j in range(count):
        start=total*j/count+(.003 if j or cyclic else 0);end=total*(j+1)/count-(.003 if j<count-1 or cyclic else 0)
        samples=[start]+[d for d in distances[1:-1] if start+1e-5<d<end-1e-5]+[end];offset=len(cv)
        for distance in samples:
            p,n,z=section(distance)
            for side,dz in [(-.05,-.045),(.05,-.045),(.05,.026),(.035,.041),(-.035,.041),(-.05,.026)]:
                q=p+n*side;cv.append((q.x,q.y,z+dz))
        cf.extend([tuple(offset+i for i in reversed(range(6))),tuple(offset+6*(len(samples)-1)+i for i in range(6))])
        cf.extend((offset+6*k+i,offset+6*k+(i+1)%6,offset+6*(k+1)+(i+1)%6,offset+6*(k+1)+i) for k in range(len(samples)-1) for i in range(6));stones+=1
close(G.mesh('Fitted limestone coping v11',cv,cf,'limestone'))

surface_audit=seat()
walk_v,walk_f=triangles(meshes()+[o for o in scene.objects if o.get('v11_flight')])
walk_surface=BVHTree.FromPolygons([Vector(p) for p in walk_v],walk_f,all_triangles=True)
route_audit=[]
for name,points in routes.items():
    shifts=[];foot_errors=[];missing=[]
    for i,p in enumerate(line(points,.045)):
        hit=walk_surface.ray_cast(Vector((p.x,p.y,40)),Vector((0,0,-1)))[0]
        old=old_surface.ray_cast(Vector((p.x,p.y,40)),Vector((0,0,-1)))[0]
        if name in ('garden-gate','clock-sanctuary'):
            if hit is None:missing.append(i)
            else:foot_errors.append(abs(p.z-hit.z))
        elif hit is not None and old is not None:shifts.append(abs(hit.z-old.z))
    if name in ('garden-gate','clock-sanctuary'):
        assert not missing,f'Walking route leaves masonry: {name}: {missing}'
        assert max(foot_errors)<.205,f'Foot misses the tread: {name}: {max(foot_errors)}'
    route_audit.append({'id':name,'maxPavingChangeMeters':round(max(shifts,default=0),5),'maxFootGapMeters':round(max(foot_errors,default=0),5)})
for name in ('garden-gate','clock-sanctuary'):
    obj=curves[name];obj.data.splines.clear();spline=obj.data.splines.new('POLY');spline.points.add(len(routes[name])-1)
    for p,q in zip(spline.points,routes[name]):p.co=(*q,1)
for name in routes:
    if name not in ('garden-gate','clock-sanctuary'):assert original_routes[name]==[list(p) for p in routes[name]]
report={'revision':11,'stairs':stair_audit,'gardenArrivalBefore':list(old_node),'gardenArrivalAfter':list(new_node),
        'unchangedRoutes':14,'changedRoutes':['garden-gate','clock-sanctuary'],'copingStones':stones,'stairFacingStones':ashlar_count,'relocatedTrees':relocated,'preservedObjects':preserved,'terrain':surface_audit,'walkingSurfaces':route_audit}
(REVIEW/'access-audit.json').write_text(json.dumps(report,indent=2))
export_island(scene,metadata,routes,11,SOURCE,REVIEW,'--draft' in sys.argv,'--no-render' not in sys.argv)
