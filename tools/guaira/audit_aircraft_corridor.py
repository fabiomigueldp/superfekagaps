"""Non-mutating complete Guaíra flight audit.
blender -b FINAL_CAMPAIGN.blend -t 2 -P audit_aircraft_corridor.py -- \
  --poses /tmp/guaira-flight-corridor/poses.json --output /tmp/guaira-flight-corridor/audit.json
Records: {source,destination,elapsed,frame,pose:{...actual AircraftPose}}.
Default aircraft source is the verified metadata-only canonical model export.
"""
import argparse,bpy,json,math,collections,time,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
P=argparse.ArgumentParser(description=__doc__)
P.add_argument('--poses',default='/tmp/guaira-flight-corridor/poses.json')
P.add_argument('--output',default='/tmp/guaira-flight-corridor/audit.json')
P.add_argument('--aircraft',default='/tmp/guaira-aircraft-clearance/model/journey-aircraft.blend')
P.add_argument('--source-saved-frame',type=int,default=31)
P.add_argument('--margin',type=float,default=.05)
P.add_argument('--ground-z',type=float,default=1.8)
P.add_argument('--atlas-origin-x',type=float,default=3.65)
P.add_argument('--atlas-origin-y',type=float,default=.05)
P.add_argument('--atlas-scale',type=float,default=1.1)
P.add_argument('--skip-nearest-samples',action='store_true')
P.add_argument('--candidate-label',default='unspecified candidate')
P.add_argument('--aircraft-parts',choices=['all','animated-only'],default='all')
a=P.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:]);start=time.time()
input_dir=Path(a.output).parent/'audit-inputs';input_dir.mkdir(parents=True,exist_ok=True)
pose_bytes=Path(a.poses).read_bytes();pose_hash=hashlib.sha256(pose_bytes).hexdigest();pose_snapshot=input_dir/f'poses-{pose_hash[:16]}.json';pose_snapshot.write_bytes(pose_bytes)
blend_bytes=Path(bpy.data.filepath).read_bytes();blend_hash=hashlib.sha256(blend_bytes).hexdigest();blend_snapshot=input_dir/f'campaign-{blend_hash[:16]}.blend'
if not blend_snapshot.exists():blend_snapshot.write_bytes(blend_bytes)
provenance={'label':a.candidate_label,'auditStartedUtc':datetime.now(timezone.utc).isoformat(),'posesSha256':pose_hash,'posesSnapshot':str(pose_snapshot),'blendSha256':blend_hash,'blendSnapshot':str(blend_snapshot),'auditScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
scene=bpy.context.scene;cam=scene.camera;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
SUPPORT={'Continuous clay island','Civic terrace','Civic continuous earthen ascent','Reservoir support','STOL continuous irregular landing meadow'}
SURFACE_PREFIX=('walk_','STOL earth boarding trail','STOL graded dirt clearing','Fitted fractured cliff ', 'Broken horizontal sediment seam','Sparse dry crack','Branched soil fissure','Fissure fine branch','Low eroded shoulder','Connected Lower earth terrace','Connected Cross earth terrace','Connected Upper earth terrace','Keeper compacted working bank','Keeper canal-side work path')
def excluded(name):
 if name in SUPPORT:return 'support terrain, audited separately'
 if name.startswith(SURFACE_PREFIX):return 'authored ground/surface layer'
 if 'clean flowing water' in name or 'cyan irrigated paddy' in name or name=='Reservoir clean water':return 'water surface'
 return None

def geom(ob,transform=Matrix.Identity(4)):
 ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
 v=[transform@ev.matrix_world@p.co for p in me.vertices];f=[tuple(p.vertices) for p in me.loop_triangles];ev.to_mesh_clear();return v,f

def bounds(v):return np.min(v,axis=0),np.max(v,axis=0)
def gap(box1,box2):return float(np.linalg.norm(np.maximum(0,np.maximum(box1[0]-box2[1],box2[0]-box1[1]))))
def triangle_bounds(v,f):
 tri=v[np.asarray(f,dtype=int)];return np.min(tri,axis=1),np.max(tri,axis=1)
def closed(f):
 edges=collections.Counter(tuple(sorted((face[i],face[(i+1)%3]))) for face in f for i in range(3));return bool(edges) and all(n==2 for n in edges.values())
def inside(tree,point):
 # Two oblique parity rays agree. Boundary intersections are handled first.
 for direction in [Vector((.916,.331,.224)).normalized(),Vector((-.219,.869,.442)).normalized()]:
  origin=Vector(point);crossings=0
  for _ in range(128):
   hit,normal,index,distance=tree.ray_cast(origin,direction,1000)
   if hit is None:break
   crossings+=1;origin=hit+direction*.00001
  if crossings%2==0:return False
 return True

def tri_lower(A,B,stop_at):
 # Every triangle is contained by its AABB. The minimum triangle-AABB
 # separation is a conservative LOWER bound on minimum surface separation.
 best=float('inf')
 for off in range(0,len(A[0]),64):
  d=np.maximum(0,np.maximum(A[0][off:off+64,None,:]-B[1][None,:,:],B[0][None,:,:]-A[1][off:off+64,None,:]))
  best=min(best,float(np.sqrt(np.min(np.sum(d*d,axis=2)))))
  if best==0:break
 return best

def cells(box):
 # Broad phase only. Every visible prop remains included regardless of bounds.
 lo=np.floor(box[0]/2).astype(int);hi=np.floor(box[1]/2).astype(int)
 for x in range(lo[0],hi[0]+1):
  for y in range(lo[1],hi[1]+1):
   for z in range(lo[2],hi[2]+1):yield (x,y,z)

props=[];excluded_objects=[];support_v=[];support_f=[]
for ob in list(scene.objects):
 if ob.type not in ('MESH','CURVE','FONT') or ob.hide_render or (ob.users_collection and all(c.hide_render for c in ob.users_collection)):continue
 v,f=geom(ob)
 if not v or not f:continue
 why=excluded(ob.name)
 if ob.name in SUPPORT:
  off=len(support_v);support_v.extend(v);support_f.extend(tuple(off+i for i in face) for face in f)
 if why:excluded_objects.append({'name':ob.name,'reason':why});continue
 vv=np.asarray(v,dtype=float)
 props.append({'name':ob.name,'v':v,'np':vv,'f':f,'box':bounds(vv),'tri':triangle_bounds(vv,f),'tree':BVHTree.FromPolygons(v,f,all_triangles=True),'closed':closed(f)})
assert props and support_v,'Missing source props or supporting terrain'
support=BVHTree.FromPolygons(support_v,support_f,all_triangles=True)
grid=collections.defaultdict(set)
for i,p in enumerate(props):
 for cell in cells((p['box'][0]-a.margin,p['box'][1]+a.margin)):grid[cell].add(i)
with bpy.data.libraries.load(a.aircraft,link=False) as (fr,to):to.objects=[n for n in fr.objects if n not in ('Camera','warm key','sky fill','rim')]
for ob in to.objects:
 if ob and ob.type in ('MESH','CURVE'):scene.collection.objects.link(ob)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();plane=[]
for ob in to.objects:
 if not ob or ob.type not in ('MESH','CURVE'):continue
 v,f=geom(ob,Matrix.Rotation(-a.source_saved_frame*math.tau/32,4,'Z'))
 if v and f:plane.append({'name':ob.name,'v':v,'f':f,'closed':closed(f)})
assert plane,'Aircraft model unavailable'
# Conservative source-space swept envelopes for runtime-only articulation.
# Sprite source camera is384px/6world units =64px/world unit. Flap trailing
# deflection is <=1.82px, stroke halfwidth.275px: .034world isotropic expansion.
def box_part(name,lo,hi):
 v=[Vector((x,y,z)) for x in (lo[0],hi[0]) for y in (lo[1],hi[1]) for z in (lo[2],hi[2])]
 quads=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
 f=[t for a,b,c,d in quads for t in ((a,b,c),(a,c,d))]
 return {'name':name,'v':v,'f':f,'closed':True,'runtimeEnvelope':True}
n=64;radius=.615/math.cos(math.pi/n)
vv=[Vector((x,radius*math.cos(k*math.tau/n),.99+radius*math.sin(k*math.tau/n))) for x in (1.79,1.81) for k in range(n)]
ff=[]
for k in range(n):
 j=(k+1)%n;ff.extend([(k,j,n+j),(k,n+j,n+k)])
for k in range(1,n-1):ff.extend([(0,k+1,k),(n,n+k,n+k+1)])
plane.append({'name':'runtime propeller swept envelope','v':vv,'f':ff,'closed':True,'runtimeEnvelope':True})
for sign in (-1,1):
 y0,y1=sorted((sign*.72,sign*1.92))
 plane.append(box_part(f'runtime flap swept envelope {sign}',(-.64-.034,y0-.034,1.505-.034),(-.38+.034,y1+.034,1.54+.034)))
if a.aircraft_parts=='animated-only':plane=[p for p in plane if p.get('runtimeEnvelope')]

src=(-Vector((11,-20,17.5))).to_track_quat('-Z','Y').to_matrix().to_4x4();dst=cam.matrix_world.to_quaternion().to_matrix().to_4x4();up=dst.to_3x3()@Vector((0,1,0))
project=lambda p:Vector((world_to_camera_view(scene,cam,Vector(p)).x,1-world_to_camera_view(scene,cam,Vector(p)).y))
o=project((0,0,a.ground_z));dx=project((1,0,a.ground_z))-o;dy=project((0,1,a.ground_z))-o;inverse=Matrix(((dx.x,dy.x),(dx.y,dy.y))).inverted()
raw=json.loads(pose_bytes);records=raw['records'] if isinstance(raw,dict) else raw
summary={};checks=[];wheel_checks=[];pair_summary={};skipped=[]
for serial,r in enumerate(records):
 p=r['pose'];source=r['source'];destination=r.get('destination',r.get('to'));elapsed=r.get('elapsed',r.get('time'))
 leg=f"{source}->{destination}";variant=r.get('variant','final');key=f'{variant}:{leg}'
 if key not in summary:summary[key]={'samples':0,'collisionSamples':0,'conservativeMarginUnresolvedSamples':0,'wheelSamples':0,'unsupportedWheelSamples':0,'minTriangleAabbLowerBound':None,'minSampledSurfaceUpperBound':None,'stages':{}}
 s=summary[key];s['samples']+=1
 if p.get('reducedMotion'):
  skipped.append({'record':serial,'reason':'Reduced-motion dissolve/transfer has no physical runway or airborne trajectory'});continue
 ground=Vector(((p['ground']['x']-a.atlas_origin_x)/a.atlas_scale,(p['ground']['y']-a.atlas_origin_y)/a.atlas_scale));xy=inverse@(ground-o)
 physical_scale=p['scale']/a.atlas_scale*cam.data.ortho_scale/20.6
 yaw=Matrix.Rotation(r['frame']*math.tau/32,4,'Z');rotation=p['bank']+p['pitch']*math.cos(p['heading'])
 origin=Vector((xy.x,xy.y,a.ground_z))+up*((p['altitude']-p['suspension'])/a.atlas_scale*cam.data.ortho_scale/1.6)
 tr=Matrix.Translation(origin)@dst@Matrix.Rotation(-rotation,4,'Z')@src.inverted()@yaw@Matrix.Diagonal(Vector((physical_scale,physical_scale,physical_scale,1)))
 pv=[]
 for part in plane:
  vv=[tr@v for v in part['v']];nv=np.asarray(vv,dtype=float);pv.append((part,vv,nv,bounds(nv)))
 allbox=(np.min([v[3][0] for v in pv],axis=0),np.max([v[3][1] for v in pv],axis=0));candidate_ids=set()
 for cell in cells((allbox[0]-a.margin,allbox[1]+a.margin)):candidate_ids.update(grid.get(cell,()))
 hits=[];near=[]
 for part,vv,nv,box in pv:
  tree=None;tribox=None
  for index in candidate_ids:
   prop=props[index];lower=gap(box,prop['box'])
   if lower>=a.margin:continue
   if tree is None:tree=BVHTree.FromPolygons(vv,part['f'],all_triangles=True)
   overlaps=tree.overlap(prop['tree']);mode='surface' if overlaps else None
   if not overlaps:
    if prop['closed'] and all(prop['box'][0][k]<nv[0][k]<prop['box'][1][k] for k in range(3)) and inside(prop['tree'],nv[0]):mode='aircraft inside closed prop'
    elif part['closed'] and all(box[0][k]<prop['np'][0][k]<box[1][k] for k in range(3)) and inside(tree,prop['np'][0]):mode='prop inside closed aircraft part'
   pair=f"{part['name']} | {prop['name']}"
   if mode:
    hit={'aircraft':part['name'],'prop':prop['name'],'mode':mode,'trianglePairs':len(overlaps)};hits.append(hit);lower=0.;upper=0.
   else:
    if tribox is None:tribox=triangle_bounds(nv,part['f'])
    lower=tri_lower(tribox,prop['tri'],a.margin)
    if lower>=a.margin:continue
    upper=None
    if not a.skip_nearest_samples:
     distances=[]
     # At most32 vertices each way. An UPPER bound only, not certification.
     for v in vv[::max(1,math.ceil(len(vv)/32))]:
      result=prop['tree'].find_nearest(v)
      if result[-1] is not None:distances.append(result[-1])
     for v in prop['v'][::max(1,math.ceil(len(prop['v'])/32))]:
      result=tree.find_nearest(v)
      if result[-1] is not None:distances.append(result[-1])
     upper=min(distances) if distances else None
    near.append({'aircraft':part['name'],'prop':prop['name'],'triangleAabbLowerBound':lower,'sampledSurfaceUpperBound':upper})
   pk=f'{key}:{pair}'
   if pk not in pair_summary:pair_summary[pk]={'leg':key,'aircraft':part['name'],'prop':prop['name'],'firstTime':elapsed,'lastTime':elapsed,'collisionSamples':0,'potentialMarginSamples':0,'minLowerBound':lower,'minSampledUpperBound':upper}
   q=pair_summary[pk];q['lastTime']=elapsed;q['collisionSamples']+=bool(mode);q['potentialMarginSamples']+=not bool(mode);q['minLowerBound']=min(q['minLowerBound'],lower)
   if upper is not None:q['minSampledUpperBound']=upper if q['minSampledUpperBound'] is None else min(upper,q['minSampledUpperBound'])
   s['minTriangleAabbLowerBound']=lower if s['minTriangleAabbLowerBound'] is None else min(lower,s['minTriangleAabbLowerBound'])
   if upper is not None:s['minSampledSurfaceUpperBound']=upper if s['minSampledSurfaceUpperBound'] is None else min(upper,s['minSampledSurfaceUpperBound'])
  # End all-prop part check.
 s['collisionSamples']+=bool(hits);s['conservativeMarginUnresolvedSamples']+=bool(near)
 if hits:s['stages'][p['stage']]=s['stages'].get(p['stage'],0)+1
 checks.append({'record':serial,'leg':key,'elapsed':elapsed,'stage':p['stage'],'frame':r['frame'],'altitude':p['altitude'],'worldGround':[float(xy.x),float(xy.y)],'physicalScale':physical_scale,'hits':hits,'marginUnresolved':near})
 at_guaira=(source=='guaira' and p['stage'] in ('boarding','takeoff-roll')) or (destination=='guaira' and p['stage'] in ('landing-roll','arrived'))
 if at_guaira:
  for name,pt in [('left',(.43,-.65,0)),('right',(.43,.65,0)),('tail',(-1.8,0,0))]:
   world=Vector((xy.x,xy.y,a.ground_z))+(yaw@Vector(pt))*physical_scale
   for contact,point in [('authored',world),('billboard-aligned diagnostic',tr@Vector(pt))]:
    hit,normal,index,distance=support.ray_cast(point+Vector((0,0,.12)),Vector((0,0,-1)),.50);vertical_gap=float(point.z-hit.z) if hit is not None else None
    okay=hit is not None and -.02<=vertical_gap<=.06
    wheel_checks.append({'record':serial,'leg':key,'elapsed':elapsed,'wheel':name,'contactModel':contact,'xy':[float(point.x),float(point.y)],'gap':vertical_gap,'withinAuthoredSupportTolerance':okay})
    if contact=='authored':s['wheelSamples']+=1;s['unsupportedWheelSamples']+=not okay
 if serial and serial%300==0:print(f'Checked {serial}/{len(records)} poses',flush=True)
report={'provenance':provenance,'method':'Actual runtime pose billboard-aligned source reconstruction. All visible solid props included, with explicit support/ground/water exclusions. Surface triangle intersections plus two-ray closed-solid containment. Orthographic depth is authored embedding, not gameplay physics.','sourceBlend':bpy.data.filepath,'aircraftBlend':a.aircraft,'poses':a.poses,'seconds':time.time()-start,'marginMeters':a.margin,'marginMeaning':'Triangle-AABB minimum separation is a conservative lower bound. No unresolved pair means surfaces certified at least margin apart under this embedding (and no contained solid). Unresolved does not prove closeness; sparse vertex-nearest values are upper bounds and cannot certify margin. Explicit exclusions and sampled60Hz time coverage remain limitations.','supportMeaning':'Authored true wheel contact centers against only actual terrain; nominal tolerance -0.02..0.06m. Camera-aligned contacts recorded separately as diagnostics, never substituted as physical wheel proof.','visibleProps':len(props),'aircraftParts':len(plane),'aircraftCoverage':a.aircraft_parts,'articulationEnvelopes':'Propeller source-local X1.79..1.81 with circumscribed radius.615 aroundY0/Z.99, includes blade sweep and blur stroke. Two flap prisms expand original flap extrema isotropically.034source-world units to cover<=1.82px deflection and.275px half-stroke at64px/world. Conservative bounding solids, not additional game geometry.','excludedObjects':excluded_objects,'propInventory':[{'name':p['name'],'bounds':[p['box'][0].tolist(),p['box'][1].tolist()],'closed':p['closed']} for p in props],'summary':summary,'pairs':list(pair_summary.values()),'checks':checks,'wheelChecks':wheel_checks,'skipped':skipped}
json.dump(report,open(a.output,'w'),indent=2);print(json.dumps({'output':a.output,'seconds':report['seconds'],'visibleProps':len(props),'summary':summary},indent=2))
