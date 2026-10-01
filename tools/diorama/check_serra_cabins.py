"""Read-only evaluated-geometry sweep of both maintenance carriers and pair crossing.
blender -b serra-prototype.blend -P check_serra_cabins.py -- --label final
"""
import bpy,json,math,os,sys,re,argparse,collections,hashlib,time
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=os.environ.get('FEKA_SERRA_AUDIT_OUT',os.path.dirname(bpy.data.filepath))
p=argparse.ArgumentParser();p.add_argument('--label',default='latest');p.add_argument('--step',type=float,default=.055);p.add_argument('--continuous',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();meta=json.loads(scene['serra_metadata']);ride=meta['maintenanceCabin'];phase=ride['phase'];paths=ride['passengerFootPaths'];anchor=Vector(ride['departureBerths'][phase]);start=time.time()
stamp={'blend':bpy.data.filepath,'blendMtime':os.path.getmtime(bpy.data.filepath),'metadataSha256':hashlib.sha256(json.dumps(meta,sort_keys=True).encode()).hexdigest(),'label':a.label}
static_v=[];static_t=[];static_names=[];static_solid=[];moving_v=[];moving_t=[];moving_names=[];components=[];excluded=[]
def bounds(v):return tuple(min(q[j] for q in v) for j in range(3)),tuple(max(q[j] for q in v) for j in range(3))
for ob in scene.objects:
 if ob.type not in {'MESH','CURVE','SURFACE','FONT'} or ob.hide_render:continue
 n=ob.name
 if n.startswith('maintenance carrier B') or n.startswith('maintenance paired cable') or re.search(r'maintenance terminal sheave(?:\.\d+)?$',n):excluded.append(n);continue
 e=ob.evaluated_get(deps);me=e.to_mesh()
 if not me:continue
 me.calc_loop_triangles();verts=[ob.matrix_world@v.co for v in me.vertices];tris=[tuple(t.vertices) for t in me.loop_triangles]
 if n.startswith('maintenance carrier A'):
  verts=[q-anchor for q in verts];off=len(moving_v);moving_v.extend(verts);moving_t.extend(tuple(off+i for i in tri) for tri in tris);moving_names.extend([n]*len(tris));lo,hi=bounds(verts);components.append((n,Vector(tuple((lo[j]+hi[j])/2 for j in range(3))),lo,hi))
 else:
  off=len(static_v);static_v.extend(verts);static_t.extend(tuple(off+i for i in tri) for tri in tris);static_names.extend([n]*len(tris))
  edges=collections.Counter()
  for face in me.polygons:
   ids=list(face.vertices)
   for aa,bb in zip(ids,ids[1:]+ids[:1]):edges[tuple(sorted((aa,bb)))]+=1
  if verts and edges and all(c==2 for c in edges.values()):static_solid.append((n,BVHTree.FromPolygons(verts,tris,all_triangles=True),*bounds(verts)))
 e.to_mesh_clear()
static=BVHTree.FromPolygons(static_v,static_t,all_triangles=True);mlo,mhi=bounds(moving_v)
def footAt(lane,t):
 pts=paths[lane];u=min(len(pts)-1,max(0,t*(len(pts)-1)));i=min(len(pts)-2,int(u));return Vector(pts[i]).lerp(Vector(pts[i+1]),u-i)
def inside_closed(bvh,q):
 near,normal,idx,distance=bvh.find_nearest(q)
 if near is None or distance<=.002:return False
 votes=0
 for direction in [Vector((.917,.317,.239)).normalized(),Vector((.271,.923,.317)).normalized(),Vector((.193,.283,.939)).normalized()]:
  origin=q.copy();count=0
  for _ in range(200):
   loc,n,i,d=bvh.ray_cast(origin,direction,100)
   if loc is None:break
   count+=1;origin=loc+direction*.00002
  votes+=count%2
 return votes>=2
def boundsOverlap(lo,hi,otherlo,otherhi):return all(lo[j]<=otherhi[j] and otherlo[j]<=hi[j] for j in range(3))
records=[];poseCount=0
for lane in range(2):
 length=sum((Vector(v)-Vector(u)).length for u,v in zip(paths[lane],paths[lane][1:]));N=max(48,math.ceil(length/a.step))
 for i in range(N+1):
  t=i/N;foot=footAt(lane,t);verts=[q+foot for q in moving_v];bvh=BVHTree.FromPolygons(verts,moving_t,all_triangles=True);contacts=collections.defaultdict(lambda:{'movingParts':set(),'trianglePairCount':0,'sampleContactZ':[],'maxStaticTriangleZ':-float('inf'),'methods':set()})
  for mi,si in bvh.overlap(static):
   n=static_names[si];c=contacts[n];c['movingParts'].add(moving_names[mi]);c['trianglePairCount']+=1;c['methods'].add('evaluated-mesh-intersection');c['maxStaticTriangleZ']=max(c['maxStaticTriangleZ'],max(static_v[j].z for j in static_t[si]))
   if len(c['sampleContactZ'])<10:c['sampleContactZ'].append(sum(verts[k].z for k in moving_t[mi])/3)
  lo=tuple(mlo[j]+foot[j] for j in range(3));hi=tuple(mhi[j]+foot[j] for j in range(3))
  for name,solid,slo,shi in static_solid:
   if not boundsOverlap(lo,hi,slo,shi):continue
   for part,center,clo,chi in components:
    q=center+foot
    if not all(slo[j]<q[j]<shi[j] for j in range(3)):continue
    if inside_closed(solid,q):
     contacts[name]['movingParts'].add(part);contacts[name]['methods'].add('moving-component-center-contained')
  for name,c in contacts.items():
   # A cabin parked with its sole on an authored platform may touch that floor.
   # Every nonterminal floor intersection remains a reported swept collision.
   cls='terminal-floor-contact' if name.startswith('walk_') and (i==0 or i==N) and c['maxStaticTriangleZ']<=foot.z+.022 and all('red lower body' in x or 'mountain symbol' in x for x in c['movingParts']) else 'swept-collision'
   records.append({'lane':lane,'t':round(t,6),'foot':[round(v,5) for v in foot],'object':name,'movingParts':sorted(c['movingParts']),'trianglePairCount':c['trianglePairCount'],'methods':sorted(c['methods']),'classification':cls})
  poseCount+=1
# Continuous piecewise-linear pair-envelope separation, not just sample frames.
# Unrotated carriers use the actual evaluated envelope, including the hanger.
# A positive gap proves the detailed meshes cannot intersect.
def pairGap(t):
 fa,fb=footAt(0,t),footAt(1,1-t);gaps=[max(0,(mlo[j]+fa[j])-(mhi[j]+fb[j]),(mlo[j]+fb[j])-(mhi[j]+fa[j])) for j in range(3)];return math.sqrt(sum(g*g for g in gaps)),fa,fb,gaps
best=(float('inf'),None,None,None,None)
for k in range(len(paths[0])-1):
 lo=k/(len(paths[0])-1);hi=(k+1)/(len(paths[0])-1)
 # Distance between two boxes whose centers move linearly is convex on each piece.
 for _ in range(70):
  aa=lo+(hi-lo)/3;bb=hi-(hi-lo)/3
  if pairGap(aa)[0]<=pairGap(bb)[0]:hi=bb
  else:lo=aa
 for t in [k/(len(paths[0])-1),(k+1)/(len(paths[0])-1),(lo+hi)/2]:
  gap,fa,fb,xyz=pairGap(t)
  if gap<best[0]:best=(gap,t,fa,fb,xyz)
summary=collections.Counter((x['lane'],x['object'],x['classification']) for x in records);conflicts=[x for x in records if x['classification']=='swept-collision']
report={'stamp':stamp,'method':'Both lane foot curves swept every <=step units using the actual evaluated carrier A mesh (body, roof, trim, long hanger and grip). Surface triangle overlap is supplemented by three-direction closed-mesh ray-parity containment of moving part centers. Both static parked carriers are replaced by moving geometry. Scenery, terminal supports, headbeams and cantilevers remain obstacles. Exact own maintenance cables and terminal sheaves are excluded by explicit names; the scenic passenger system remains in scope. Parked sole/platform contact is separately recorded only at terminal poses.','step':a.step,'poseCount':poseCount,'carrierLocalBounds':{'min':mlo,'max':mhi},'excludedObjects':excluded,'staticTriangles':len(static_t),'carrierTriangles':len(moving_t),'collisionPoseObjectCount':len(conflicts),'objects':[{'lane':l,'object':o,'classification':c,'poseCount':n} for (l,o,c),n in summary.items()],'pairCrossing':{'method':'Minimum distance between full evaluated carrier axis-aligned envelopes over every piecewise-linear interval of lane0(t) against lane1(1-t), convex minimization plus endpoints. Positive separation guarantees mesh separation.','minimumClearance':round(best[0],6),'t':round(best[1],6),'lane0Foot':[round(v,5) for v in best[2]],'lane1Foot':[round(v,5) for v in best[3]],'axisGaps':[round(v,6) for v in best[4]],'passed':best[0]>.001},'contacts':records,'elapsedSeconds':round(time.time()-start,2)}
json.dump(report,open(OUT+'/serra-audit-cabins-'+a.label+'.json','w'),indent=2)
print('SERRA_CABINS='+json.dumps({k:report[k] for k in ['stamp','poseCount','collisionPoseObjectCount','objects','pairCrossing','elapsedSeconds']}),flush=True)

if a.continuous:
 import bmesh
 parts={}
 for part in set(moving_names):
  ids=set(i for tri,n in zip(moving_t,moving_names) if n==part for i in tri);parts[part]=[moving_v[i] for i in ids]
 continuous_contacts=[];hull_count=0
 for lane in range(2):
  for interval,(aa,bb) in enumerate(zip(paths[lane],paths[lane][1:])):
   va,vb=Vector(aa),Vector(bb)
   for part,pverts in parts.items():
    # Every carrier part in this scene is independently convex (walls, pillars,
    # floor, roof, hanger, grip, badge). Its linear sweep equals this convex hull.
    bm=bmesh.new()
    for co in [v+pos for pos in [va,vb] for v in pverts]:bm.verts.new(co)
    bm.verts.ensure_lookup_table()
    try:bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
    except Exception:
     bm.free();continue
    bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
    for idx,v in enumerate(bm.verts):v.index=idx
    hv=[v.co.copy() for v in bm.verts];hf=[tuple(v.index for v in f.verts) for f in bm.faces]
    if not hf:bm.free();continue
    hbvh=BVHTree.FromPolygons(hv,hf);names={static_names[si] for mi,si in hbvh.overlap(static)};hlo,hhi=bounds(hv)
    for name,solid,slo,shi in static_solid:
     if name in names or not boundsOverlap(hlo,hhi,slo,shi):continue
     mid=(va+vb)/2+Vector(tuple((min(v[j] for v in pverts)+max(v[j] for v in pverts))/2 for j in range(3)))
     if inside_closed(solid,mid):names.add(name)
    for name in sorted(names):continuous_contacts.append({'lane':lane,'interval':interval,'t0':interval/(len(paths[lane])-1),'t1':(interval+1)/(len(paths[lane])-1),'fromFoot':list(va),'toFoot':list(vb),'object':name,'movingPart':part})
    hull_count+=1;bm.free()
 expected_hulls=sum(len(path)-1 for path in paths)*len(parts)
 assert hull_count==expected_hulls,(hull_count,expected_hulls)
 continuous={'stamp':stamp,'expectedHullCount':expected_hulls,'method':'Continuous piecewise-linear sweep. Independently convex evaluated carrier parts are translated between each authored path knot, then convex-hulled. The convex hull equals the exact swept volume of each convex part. Hull/static-surface triangle overlap plus moving-center containment catches contacts between discrete poses. Same explicit own-cable/sheave exclusions as the pose audit. No convex hull is made across separate cabin parts or across a curve bend.','hullCount':hull_count,'contactCount':len(continuous_contacts),'contacts':continuous_contacts,'carrierPartCount':len(parts),'pathIntervalsPerLane':[len(x)-1 for x in paths]}
 json.dump(continuous,open(OUT+'/serra-audit-cabins-continuous-'+a.label+'.json','w'),indent=2)
 print('SERRA_CONTINUOUS='+json.dumps({'hullCount':hull_count,'contactCount':len(continuous_contacts),'objects':dict(collections.Counter(x['object'] for x in continuous_contacts))}),flush=True)
