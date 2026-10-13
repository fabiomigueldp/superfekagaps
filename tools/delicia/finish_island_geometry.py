"""Revision 7: joined paving and finished architectural connections.

blender --background --factory-startup --disable-autoexec \
  docs/world/delicia/imperio-delicia-v6.blend \
  --python tools/delicia/finish_island_geometry.py -- --draft

Requires a Python on PATH with Shapely 2.1+. Uses it only for planar union and
constrained triangulation; all resulting geometry remains editable in Blender.
The v6 scene and replaced objects are preserved.
"""
import bpy,bmesh,json,math,sys,subprocess,shutil
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'docs/world/delicia'
REVIEW=ROOT/'output/delicia/geometry-polish-2026-10-11';REVIEW.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/delicia'))
import island_geometry as G
from island_landscape import height
from export_island_navigation import export_island
scene=bpy.context.scene;assert scene.get('model_revision')==6,'Start from preserved v6.'
metadata=json.loads((SOURCE/'island-map-v6.json').read_text(encoding='utf-8'))
G.M={m.name:m for m in bpy.data.materials};G.collection('15 • Joined paving and architectural finishing')
curves={o.name.split(' • ')[0]:o for o in scene.objects if o.type=='CURVE' and 'from' in o}
routes={name:[o.matrix_world@Vector(p.co[:3]) for p in o.data.splines[0].points] for name,o in curves.items()}
retired_palace=[p.copy() for name in ('palace-ascent','palace-stair') for p in routes[name]]
hidden=[]
def preserve(obj):
    if obj.hide_render:return
    obj.hide_render=True;obj.hide_viewport=True;obj['v7_replaced']=True;hidden.append(obj.name)
def hide_prefix(*prefixes):
    for obj in list(scene.objects):
        if obj.name.startswith(prefixes):preserve(obj)
def ground(x,y):return Vector((x,y,height(x,y)+.075))
def rebuild(name,controls,rounded=True,grounded=False):
    pts=[Vector(p) for p in controls]
    if rounded:
        for _ in range(2):
            row=[pts[0]]
            for a,b in zip(pts,pts[1:]):row.extend((a*.75+b*.25,a*.25+b*.75))
            pts=row+[pts[-1]]
    line=[]
    for a,b in zip(pts,pts[1:]):
        n=max(1,math.ceil((b-a).length/.13));line.extend(a.lerp(b,i/n) for i in range(n))
    line.append(pts[-1])
    if grounded:
        for p in line:p.z=height(p.x,p.y)+.075
    line[0]=Vector(controls[0]);line[-1]=Vector(controls[-1]);routes[name]=line
def polygon(a,b,width,extend=0):
    a,b=Vector(a),Vector(b);d=Vector((b.x-a.x,b.y-a.y,0)).normalized();n=Vector((-d.y,d.x,0))*width/2
    return [[p.x,p.y] for p in [a-d*extend-n,b+d*extend-n,b+d*extend+n,a-d*extend+n]]

# A real upper landing receives both flights; neither crosses another flight
# at a different height. The old narrow mound/ramp is removed below.
west_top=Vector((-10.65,1.12,8.55));west_foot=ground(-10.65,-1.75)
orchard_top=Vector((-11.95,1.85,8.55));orchard_foot=ground(-14.5,1.85)
rebuild('orchard-aqueduct',[routes['orchard-aqueduct'][0],ground(-14.2,3.15),ground(-14.6,2.75),
    orchard_foot,orchard_top,routes['orchard-aqueduct'][-1]],False)
rebuild('west-bank',[routes['west-bank'][0],west_top,west_foot,*[ground(x,y) for x,y in
    [(-9,-1.9),(-8,-1.4),(-6.9,-3.5),(-5.7,-5.1)]],routes['west-bank'][-1]],False)
# The lower court sits on the visible east flank, clear of the refinery roof.
# Two flights follow the contours, instead of one tall plinth above the factory.
palace_foot=ground(19.2,4.25);palace_top=Vector((12,6.1,12.18))
old_palace_foot=routes['palace-stair'][0].copy()
for obj in scene.objects:
    if obj.get('stage_id')=='delicia-11' or obj.name.startswith('delicia-11 '):
        obj.location+=palace_foot-old_palace_foot
turn_lower=Vector((15.95,4.5,10.0));turn_upper=Vector((15.95,5.35,10.0))
rebuild('palace-stair',[palace_foot,turn_lower,turn_upper,palace_top,Vector((12,6.5,12.18)),routes['palace-stair'][-1]],False)
rebuild('palace-ascent',[routes['palace-ascent'][0],*[ground(x,y) for x,y in
    [(18.4,1.1),(19.15,2.8)]],palace_foot],True,True)
archive_top=Vector((4.55,1.85,8.54));archive_foot=ground(4.55,-.7)
deck=routes['aqueduct-promenade'];last_deck=min(range(len(deck)),key=lambda i:(deck[i]-archive_top).length)
rebuild('aqueduct-promenade',[*deck[:last_deck],archive_top,archive_foot,ground(6.1,-.85),deck[-1]],False)

flights=[('Orchard west stair',orchard_foot,orchard_top,1.18,12),
         ('Aqueduct south stair',west_foot,west_top,1.18,14),
         ('Palace lower flight',palace_foot,turn_lower,1.5,13),
         ('Palace upper flight',turn_upper,palace_top,1.5,14),
         ('Archive access stair',archive_foot,archive_top,1.02,12)]
reserved=[polygon(a,b,w) for _,a,b,w,_ in flights]
platforms=[[[ -12.02,1.1],[-10.03,1.1],[-10.03,2.45],[-12.02,2.45]],
           [[15.19,3.75],[16.71,3.75],[16.71,6.1],[15.19,6.1]]]
platform_levels=[8.536,9.986]
hide_prefix('West aqueduct access','Aqueduct east access steps','Grand palace stair','Grand stair stone parapet')
hide_prefix('Approach to the aqueduct','Eastern aqueduct walk','Sanctuary entrance','Factory inspection road',
    'Garden approach','Way to the palace','Road from the harbour to the gorge','Orchard contour path')
for obj in list(scene.objects):
    if any(s in obj.name for s in (' • limestone walking surface',' • bedded path edges')):preserve(obj)

# Preserve the orchard as complete assemblies; clear the new west stair's
# approach without separating a crown from its trunk, branches or fruit.
trunks=[o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Cypress trunk'))]
parts=[o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Citrus branch','Angular leafy crown','Ripe citrus fruit','Cypress trunk','Tapering cypress foliage'))]
positions={o:o.matrix_world.translation.copy() for o in trunks}
owners={o:min(trunks,key=lambda t:(positions[t]-o.matrix_world.translation).xy.length_squared) for o in parts}
tree=owners[bpy.data.objects['Angular leafy crown.015']];p=positions[tree]
shift=Vector((-1.4,.55,height(p.x-1.4,p.y+.55)-height(p.x,p.y)))
for obj in parts:
    if owners[obj]==tree:obj.location+=shift

# The historic coastal footpath stays, joined to the same surface at its exits.
decor=[{'id':'Archive lower court','points':[list(archive_foot),list(ground(6.1,-.85)),list(routes['aqueduct-promenade'][-1])],'width':1.0}]
for prefix in ['Walk of the last harvest','Port lane to the orchard']:
    obj=bpy.data.objects.get(prefix)
    if not obj:continue
    v=[obj.matrix_world@p.co for p in obj.data.vertices]
    decor.append({'id':prefix,'points':[list((a+b)/2) for a,b in zip(v[::2],v[1::2])],'width':.72 if prefix.startswith('Walk') else 1.0})
    preserve(obj)
excluded={'five-harvests-bridge','aqueduct-promenade','palace-stair'}
roads=[{'id':r['id'],'points':[list(p) for p in routes[r['id']]],'width':r['widthMeters']} for r in metadata['routes'] if r['id'] not in excluded]+decor
# Moving a landing changes its evaluated transform only after this update.
# Both the paved court and exported route must use the relocated position.
bpy.context.view_layer.update()
nodes={o['stage_id']:o.matrix_world.translation.copy() for o in scene.objects if 'stage_id' in o}
assert (nodes['delicia-11']-palace_foot).length<1e-5
courts=[[*p,.52 if 'raizes' not in sid and 'relogio' not in sid else .67] for sid,p in nodes.items() if sid!='delicia-12']
layout={'roads':roads,'courts':courts,'stairs':reserved,'platforms':platforms}
(REVIEW/'paving-input.json').write_text(json.dumps(layout),encoding='utf-8')
python=shutil.which('python');assert python,'Python with Shapely is required for planar masonry union.'
subprocess.run([python,str(ROOT/'tools/delicia/unify_map_paving.py'),str(REVIEW/'paving-input.json'),str(REVIEW/'paving-layout.json')],check=True)
paving=json.loads((REVIEW/'paving-layout.json').read_text())

# Local nearest-segment interpolation preserves the original physical elevation
# exactly at the centerline; adjacent corridors blend only within the joint.
segments=[];buckets={}
for road in roads:
    points=[Vector(p) for p in road['points']]
    for a,b in zip(points,points[1:]):
        delta=b-a;l2=delta.x**2+delta.y**2
        if l2<1e-10:continue
        item=(a,b,delta,l2);index=len(segments);segments.append(item)
        for x in range(math.floor(min(a.x,b.x))-2,math.floor(max(a.x,b.x))+3):
            for y in range(math.floor(min(a.y,b.y))-2,math.floor(max(a.y,b.y))+3):buckets.setdefault((x,y),[]).append(index)
def elevation(x,y):
    for poly,z in zip(platforms,platform_levels):
        if min(p[0] for p in poly)-.015<=x<=max(p[0] for p in poly)+.015 and min(p[1] for p in poly)-.015<=y<=max(p[1] for p in poly)+.015:return z
    candidates=[]
    for i in buckets.get((math.floor(x),math.floor(y)),[]):
        a,b,d,l2=segments[i];t=max(0,min(1,((x-a.x)*d.x+(y-a.y)*d.y)/l2))
        ds=(x-a.x-t*d.x)**2+(y-a.y-t*d.y)**2
        candidates.append((ds,a.z+t*d.z-.014))
    if not candidates:return height(x,y)+.06
    candidates.sort();nearest=candidates[0]
    # Equal-distance joints use one elevation, rather than two crossing sheets.
    close=[p for p in candidates[:8] if p[0]<nearest[0]+.05 and abs(p[1]-nearest[1])<.25]
    if nearest[0]<.00002:return nearest[1]
    weights=[1/(p[0]+.005)**3 for p in close]
    return sum(p[1]*w for p,w in zip(close,weights))/sum(weights)

road_vertices=[];road_faces=[];curb_count=0;brick_count=0;closed_meshes=[]
for patch_index,patch in enumerate(paving['patches']):
    xy=patch['vertices'];n=len(xy);top=[(x,y,elevation(x,y)) for x,y in xy]
    base=[(x,y,min(z-.14,height(x,y)-.06)) for x,y,z in top]
    faces=[tuple(f) for f in patch['triangles']]+[tuple(n+i for i in reversed(f)) for f in patch['triangles']]
    for ring in patch['rings']:
        for a,b in zip(ring,ring[1:]+ring[:1]):faces.append((a,n+a,n+b,b))
    obj=G.mesh(f'Unified masonry paving {patch_index+1}',top+base,faces,['trail','stone-warm'],indices=[0]*len(patch['triangles'])+[1]*(len(faces)-len(patch['triangles'])))
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bad=sum(not e.is_manifold for e in bm.edges)
    assert bad==0,f'Open masonry volume: {obj.name}: {bad}'
    bm.to_mesh(obj.data);bm.free();closed_meshes.append(obj.name)
    G.bevel(obj,.012,2)
    for a,b in patch['borders']:
        aa=Vector((*a,elevation(*a)));bb=Vector((*b,elevation(*b)));d=bb-aa
        if d.length<.06:continue
        center=(aa+bb)/2
        block=G.box('Dressed path kerb',(center.x,center.y,center.z+.015),(.074,d.length+.008,.06),'limestone',.012)
        block.rotation_euler=d.to_track_quat('Y','Z').to_euler();curb_count+=1
        # Individual stone courses articulate exposed foundations; shallow
        # edges stay quiet. Every block is inset from its neighbours.
        floor=min(height(center.x,center.y)-.04,center.z-.16)
        if center.z-floor<.32:continue
        for row in range(max(0,math.floor(floor/.24)),math.ceil(center.z/.24)):
            lo=max(floor,row*.24+.009);hi=min(center.z-.025,(row+1)*.24-.009)
            if hi-lo<.045:continue
            o=G.box('Retaining wall dressed stone',(center.x,center.y,(lo+hi)/2),(.045,max(.035,d.xy.length-.018),hi-lo),'stone-warm' if row%5 else 'limestone',.009)
            o.rotation_euler.z=math.atan2(d.y,d.x)-math.pi/2;brick_count+=1

# Arrival medallions are inlaid into the unified court, not loose discs perched
# on the edge of a road. The existing mosaic/ring remains visible.
for obj in list(scene.objects):
    if 'arrival paving' in obj.name and not obj.name.startswith('delicia-12'):preserve(obj)

stair_audit=[]
def solid_stair(name,a,b,width,steps):
    d=Vector((b.x-a.x,b.y-a.y,0));length=d.length;d.normalize();normal=Vector((-d.y,d.x,0))
    assert length/steps>=.20 and 0<(b.z-a.z)/steps<=.20,f'Uncomfortable stair proportions: {name}'
    profile=[(0,min(a.z-.22,height(a.x,a.y)-.08)),(0,a.z-.014)]
    for i in range(steps):
        z=a.z+(b.z-a.z)*(i+1)/steps-.014
        profile.extend(((length*i/steps,z),(length*(i+1)/steps,z)))
    profile.append((length,min(a.z-.22,height(b.x,b.y)-.08)))
    verts=[]
    for side in (-1,1):
        for t,z in profile:
            p=a+d*t+normal*side*width/2;verts.append((p.x,p.y,z))
    n=len(profile);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=G.mesh(name+' closed stone flight',verts,faces,'limestone')
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges),f'Open stair volume: {name}'
    bm.to_mesh(obj.data);bm.free();G.bevel(obj,.012,2)
    # Newel blocks finish both ends. Sloped cheeks meet the foundation and
    # rise only 25cm, keeping the small native actor readable from the camera.
    for side in (-1,1):
        edge_a=a+normal*side*(width/2+.055);edge_b=b+normal*side*(width/2+.055)
        vv=[(p.x+normal.x*s*.065,p.y+normal.y*s*.065,z) for s in (-1,1) for p,z in
            [(edge_a,a.z-.22),(edge_b,b.z-.22),(edge_b,b.z+.23),(edge_a,a.z+.23)]]
        cheek=G.mesh(name+' coped cheek',vv,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone-warm');G.bevel(cheek,.014,2)
        G.pipe(name+' limestone cheek cap',[(*edge_a.xy,a.z+.25),(*edge_b.xy,b.z+.25)],.078,'limestone',False,1)
        for p in [edge_a,edge_b]:
            G.box(name+' terminal pier',(p.x,p.y,p.z+.14),(.23,.23,.38),'limestone',.026)
            G.box(name+' terminal cap',(p.x,p.y,p.z+.34),(.28,.28,.07),'stone-light',.012)
    stair_audit.append({'name':name,'treadMeters':round(length/steps,4),'riseMeters':round((b.z-a.z)/steps,4),'steps':steps})
for args in flights:solid_stair(*args)

# A low coping closes the exposed edge of the turning landing without
# obscuring the actor. Its ends meet the stair newels, with no unsupported tips.
G.box('Palace landing outer wall',(16.65,4.93,10.12),(.14,1.25,.32),'stone-warm',.018)
G.box('Palace landing outer coping',(16.65,4.93,10.31),(.22,1.36,.08),'limestone',.016)

# Complete the old balustrades with end posts; the previous helper omitted
# their last support, leaving several coping ends hanging in the air.
railing_heights={'Ponte das Cinco Safras parapet':.56,'Aqueduct walking balustrade':.57,
    'Source walking terrace':.5,'Palace terrace balustrade':.77,'Garden stone balustrade':.65}
newels=0
for obj in list(scene.objects):
    prefix=next((p for p in railing_heights if obj.name.startswith(p+' coping')),None)
    if not prefix or obj.hide_render or obj.type!='CURVE':continue
    h=railing_heights[prefix]
    for point in [obj.data.splines[0].points[0],obj.data.splines[0].points[-1]]:
        p=obj.matrix_world@Vector(point.co[:3]);base=p.z-h
        G.lathe(prefix+' finished end post',(p.x,p.y,base),[(.115,0),(.115,.1),(.072,.16),(.065,h-.10),(.12,h-.08),(.12,h+.025)],'limestone',12)
        newels+=1

# Restore the old heightfield under retired road cuts, then seat only the
# finished paving footprint. No grooves left where an old ribbon was removed.
terrain=next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
retired_buckets={}
for p in retired_palace:
    for bx in range(math.floor(p.x)-1,math.floor(p.x)+2):
        for by in range(math.floor(p.y)-1,math.floor(p.y)+2):retired_buckets.setdefault((bx,by),[]).append(p)
seated=0;restored=0
for vertex in terrain.data.vertices:
    x,y,z=vertex.co
    if z<1:continue
    # The old road's terrain cut must disappear too, even where no new road
    # is present. Otherwise a pale, angular trench remains above the chimney.
    old=retired_buckets.get((math.floor(x),math.floor(y)),[])
    if any(math.hypot(x-p.x,y-p.y)<1.12 for p in old):
        original=height(x,y)
        if abs(vertex.co.z-original)<1.4 and abs(vertex.co.z-original)>.002:
            vertex.co.z=original;restored+=1
    for name,a,b,width,steps in flights:
        d=b-a;l2=d.x*d.x+d.y*d.y
        t=((x-a.x)*d.x+(y-a.y)*d.y)/l2
        if -.035<=t<=1.035:
            dist=math.hypot(x-a.x-t*d.x,y-a.y-t*d.y)
            w=max(0,min(1,(width/2+.24-dist)/.24))
            surface=a.z+max(0,min(1,t))*d.z-.10
            if w and vertex.co.z>surface:vertex.co.z+=(surface-vertex.co.z)*w;seated+=1
    for poly,level in zip(platforms,platform_levels):
        dx=max(min(p[0] for p in poly)-x,0,x-max(p[0] for p in poly))
        dy=max(min(p[1] for p in poly)-y,0,y-max(p[1] for p in poly))
        w=max(0,1-math.hypot(dx,dy)/.24)
        if w and vertex.co.z>level-.06:vertex.co.z+=(level-.06-vertex.co.z)*w;seated+=1
    if (math.floor(x),math.floor(y)) not in buckets:continue
    original=height(x,y)
    if abs(z-original)<1.12 and vertex.co.z==z:vertex.co.z=original
    # Only carve within a corridor. Shoulders feather over 25cm.
    nearest=100
    for i in buckets[(math.floor(x),math.floor(y))]:
        a,b,d,l2=segments[i];t=max(0,min(1,((x-a.x)*d.x+(y-a.y)*d.y)/l2))
        nearest=min(nearest,math.hypot(x-a.x-t*d.x,y-a.y-t*d.y))
    if nearest<.62:
        surface=elevation(x,y)-.05;t=max(0,min(1,(nearest-.38)/.24));w=1-t*t*(3-2*t)
        if vertex.co.z>surface:vertex.co.z+=(surface-vertex.co.z)*w;seated+=1
terrain.data.update()

# Centerline meshes are exported from the very same authored routes. Step
# projection is kept continuous by the shared World walking interpolation.
for name,line in routes.items():
    obj=curves[name];spline=obj.data.splines[0];obj.data.splines.remove(spline)
    spline=obj.data.splines.new('POLY');spline.points.add(len(line)-1)
    for p,q in zip(spline.points,line):p.co=(*q,1)

(REVIEW/'geometry-audit.json').write_text(json.dumps({'revision':7,'preservedObjects':hidden,'closedPavingMeshes':closed_meshes,
    'overlapRemovedSquareMeters':paving['overlapRemoved'],'kerbStones':curb_count,'retainingStones':brick_count,
    'terminalPosts':newels,'seatedTerrainVertices':seated,'restoredTerrainVertices':restored,'relocatedTrees':[tree.name],
    'stairs':stair_audit},indent=2),encoding='utf-8')
export_island(scene,metadata,routes,7,SOURCE,REVIEW,'--draft' in sys.argv,'--no-render' not in sys.argv)
