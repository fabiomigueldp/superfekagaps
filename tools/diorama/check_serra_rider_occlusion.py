"""Read-only moving rider versus countercar pixel audit, both lanes and directions."""
import bpy,json,math,os,sys,argparse,collections,hashlib,time
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=os.environ.get('FEKA_SERRA_AUDIT_OUT',os.path.dirname(bpy.data.filepath))
p=argparse.ArgumentParser();p.add_argument('--label',default='countercar');p.add_argument('--step',type=float,default=.005);p.add_argument('--lane-spacing',type=float);p.add_argument('--arm-offset-x',type=float,default=0);p.add_argument('--scenery',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();meta=json.loads(scene['serra_metadata']);ride=meta['maintenanceCabin'];paths=ride['passengerFootPaths'];phase=ride['phase'];cam=scene.camera;basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));src=json.load(open(OUT+'/serra-audit-sprite-source.json'));pixel=src['pixelMapWidth']*cam.data.ortho_scale;start=time.time()
stamp={'blend':bpy.data.filepath,'blendMtime':os.path.getmtime(bpy.data.filepath),'metadataSha256':hashlib.sha256(json.dumps(meta,sort_keys=True).encode()).hexdigest(),'label':a.label}
spacing_perp=Vector((-(Vector(paths[0][-1])-Vector(paths[0][0])).y,(Vector(paths[0][-1])-Vector(paths[0][0])).x,0)).normalized();spacing_delta=(a.lane_spacing-ride['laneDistance'])/2 if a.lane_spacing is not None else 0
# Actual geometry of both named carriers, localized around each authored passenger foot.
models={}
for letter,station,index in [('A','departureBerths',phase),('B','arrivalBerths',1-phase)]:
 anchor=Vector(ride[station][index]);verts=[];tris=[];names=[]
 for ob in scene.objects:
  if not ob.name.startswith('maintenance carrier '+letter) or ob.hide_render:continue
  e=ob.evaluated_get(deps);me=e.to_mesh()
  if not me:continue
  me.calc_loop_triangles();off=len(verts);armshift=Vector((a.arm_offset_x,0,0)) if (' hanger' in ob.name or ' cable grip' in ob.name) else Vector();verts.extend(ob.matrix_world@v.co-anchor+armshift for v in me.vertices)
  for tri in me.loop_triangles:tris.append(tuple(off+i for i in tri.vertices));names.append(ob.name)
  e.to_mesh_clear()
 models[letter]={'bvh':BVHTree.FromPolygons(verts,tris,all_triangles=True),'names':names,'vertexCount':len(verts),'triangleCount':len(tris)}
static_model=None
if a.scenery:
 verts=[];tris=[];names=[]
 for ob in scene.objects:
  if ob.type not in {'MESH','CURVE','SURFACE','FONT'} or ob.hide_render or ob.name.startswith(('maintenance carrier A','maintenance carrier B')):continue
  e=ob.evaluated_get(deps);me=e.to_mesh()
  if not me:continue
  me.calc_loop_triangles();off=len(verts);verts.extend(ob.matrix_world@v.co for v in me.vertices)
  for tri in me.loop_triangles:tris.append(tuple(off+i for i in tri.vertices));names.append(ob.name)
  e.to_mesh_clear()
 static_model={'bvh':BVHTree.FromPolygons(verts,tris,all_triangles=True),'names':names}
def foot(lane,t):
 pts=paths[lane];u=min(len(pts)-1,max(0,t*(len(pts)-1)));i=min(len(pts)-2,int(u));return Vector(pts[i]).lerp(Vector(pts[i+1]),u-i)+spacing_perp*spacing_delta*(1 if lane==0 else -1)
# Each record retains canonical source pixel identities, face colors and head band.
positions=collections.defaultdict(list);frame_info={}
for fn,rows in src['frames'].items():
 hy=1 if fn in ['walk2','walk5'] else 0
 for flip in [False,True]:
  ff=fn+('Left' if flip else 'Right');totals={'opaquePixels':0,'headPixels':0,'faceSkinPixels':0}
  for row,text in enumerate(rows):
   for col,ch in enumerate(text):
    if ch=='_':continue
    head=row<=hy+11 and 3<=col<=14;face=head and ch in 'SsL';totals['opaquePixels']+=1;totals['headPixels']+=head;totals['faceSkinPixels']+=face;rendered=15-col if flip else col
    for fx,fy in [(.5,.5),(.08,.08),(.92,.08),(.08,.92),(.92,.92)]:positions[(rendered+fx-8,26-row-fy)].append((ff,row,col,ch,head,face,fx==.5))
  frame_info[ff]=totals
samples=[(right*(x*pixel)+Vector((0,0,y*pixel/up.z)),ids) for (x,y),ids in positions.items()]
cache={}
def evaluate(lane,t):
 key=(lane,round(t,9))
 if key in cache:return cache[key]
 fp=foot(lane,t);cp=foot(1-lane,1-t);model=models['B' if lane==0 else 'A'];delta=fp-cp;byframe=collections.defaultdict(lambda:{'pixels':set(),'head':set(),'face':set(),'headCenters':set(),'faceCenters':set()});objects=collections.Counter();head_objects=collections.defaultdict(set);face_objects=collections.defaultdict(set)
 for offset,ids in samples:
  loc,normal,idx,distance=model['bvh'].ray_cast(delta+offset+toward*.012,toward,40)
  hitname=model['names'][idx] if loc is not None else None
  if a.scenery:
   own=models['A' if lane==0 else 'B']
   for geometry,origin in [(own,offset),(static_model,fp+offset)]:
    ll,nn,ii,dd=geometry['bvh'].ray_cast(origin+toward*.012,toward,40)
    if ll is not None and (hitname is None or dd<distance):hitname=geometry['names'][ii];distance=dd
  if hitname is None:continue
  objects[hitname]+=1
  for ff,row,col,ch,head,face,center in ids:
   f=byframe[ff];f['pixels'].add((row,col))
   if head:f['head'].add((row,col))
   if face:f['face'].add((row,col))
   if center and head:f['headCenters'].add((row,col))
   if center and face:f['faceCenters'].add((row,col))
   if head:head_objects[hitname].add((ff,row,col))
   if face:face_objects[hitname].add((ff,row,col))
 frames={ff:{'opaquePixelCount':len(v['pixels']),'headPixelCount':len(v['head']),'faceSkinPixelCount':len(v['face']),'headPixelCenterCount':len(v['headCenters']),'faceSkinPixelCenterCount':len(v['faceCenters']),'headPixels':[list(x) for x in sorted(v['head'])],'faceSkinPixels':[list(x) for x in sorted(v['face'])]} for ff,v in byframe.items()}
 result={'lane':lane,'pathProgress':round(t,8),'riderFoot':[round(v,6) for v in fp],'countercarFoot':[round(v,6) for v in cp],'objects':dict(objects),'headObjects':{k:len(v) for k,v in head_objects.items()},'faceObjects':{k:len(v) for k,v in face_objects.items()},'frames':frames,'anyBody':any(v['opaquePixelCount'] for v in frames.values()),'anyHead':any(v['headPixelCount'] for v in frames.values()),'anyFaceSkin':any(v['faceSkinPixelCount'] for v in frames.values())};cache[key]=result;return result
N=math.ceil(1/a.step);lanes=[]
for lane in [0,1]:
 timeline=[evaluate(lane,i/N) for i in range(N+1)]
 intervals={}
 for flag in ['anyBody','anyHead','anyFaceSkin']:
  spans=[];first=None
  for i,sample in enumerate(timeline+[{'sentinel':True,flag:False}]):
   if sample[flag] and first is None:first=i
   if not sample[flag] and first is not None:
    last=i-1;lo=first/N;hi=last/N
    if first>0:
     aa=(first-1)/N;bb=first/N
     for _ in range(12):
      m=(aa+bb)/2
      if evaluate(lane,m)[flag]:bb=m
      else:aa=m
     lo=bb
    if last<N:
     aa=last/N;bb=(last+1)/N
     for _ in range(12):
      m=(aa+bb)/2
      if evaluate(lane,m)[flag]:aa=m
      else:bb=m
     hi=aa
    spans.append({'fromLowerProgress':[round(lo,6),round(hi,6)],'fromUpperProgress':[round(1-hi,6),round(1-lo,6)],'fractionOfConstantProgressTrip':round(hi-lo,6),'entryFoot':list(foot(lane,lo)),'exitFoot':list(foot(lane,hi))});first=None
  intervals[flag]=spans
 peaks={}
 for ff,total in frame_info.items():
  peak=max(timeline,key=lambda x:(x['frames'].get(ff,{}).get('faceSkinPixelCount',0),x['frames'].get(ff,{}).get('headPixelCount',0)))
  frame=peak['frames'].get(ff,{})
  peaks[ff]={'pathProgress':peak['pathProgress'],'riderFoot':peak['riderFoot'],'countercarFoot':peak['countercarFoot'],'objects':peak['objects'],'spriteTotals':total,**frame}
 lane_report={'lane':lane,'intervals':intervals,'peaksByFrame':peaks,'sampleCount':len(timeline),'contactSamples':[x for x in timeline if x['anyBody']]};lanes.append(lane_report)
 print('RIDER_LANE='+json.dumps({'lane':lane,'intervals':intervals,'worstIdleRight':peaks['idleRight']}),flush=True)
report={'stamp':stamp,'method':'Camera-facing rays through every actual opaque idle/walk sprite source pixel center plus4 inset corners,both facings. Rider foot follows lane(t); countercar geometry follows otherLane(1-t). Both real evaluated carrier meshes are used. Opposite trip direction is the same paired geometry with progress reversed. No scene or source writes. All7 frames are conservative; aboard idle is reported explicitly.','includesSceneryAndOwnCarrier':a.scenery,'units':'Windows are fractions of authored path progress, not seconds. For constant-progress travel multiply fraction by ride duration. No duration contract is present. Boundary bisection resolves detected windows to ~0.0000025 progress; tiny disjoint windows shorter than base step might be missed.','laneSpacing':a.lane_spacing or ride['laneDistance'],'armOffsetWorldX':a.arm_offset_x,'simulationOnly':a.lane_spacing is not None or a.arm_offset_x!=0,'baseStep':1/N,'pixelWorldWidth':pixel,'carrierModels':{k:{q:v[q] for q in ['vertexCount','triangleCount']} for k,v in models.items()},'lanes':lanes,'elapsedSeconds':round(time.time()-start,3)}
json.dump(report,open(OUT+'/serra-audit-rider-'+a.label+'.json','w'),indent=2);print('RIDER_DONE='+str(report['elapsedSeconds']),flush=True)
