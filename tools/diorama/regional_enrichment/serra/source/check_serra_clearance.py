"""Read-only independent Serra prototype audit; writes only serra-audit*.json.
Run: blender -b serra-prototype.blend -P check_serra.py -- [--meta file] [--label label]
Metadata defaults to the loaded blend's embedded serra_metadata to avoid stale sidecars.
"""
import bpy, json, os, sys, math, hashlib, time, collections, argparse
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=os.environ.get('FEKA_SERRA_AUDIT_OUT',os.path.dirname(bpy.data.filepath))
parser=argparse.ArgumentParser();parser.add_argument('--meta');parser.add_argument('--label',default='latest');parser.add_argument('--step',type=float,default=.11);parser.add_argument('--placement-scale',type=float,default=1.0);parser.add_argument('--raster',action='store_true');parser.add_argument('--phase',type=int,choices=[0,1])
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene; bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); cam=scene.camera
meta=json.load(open(args.meta)) if args.meta else json.loads(scene['serra_metadata'])
saved_phase=meta.get('maintenanceCabin',{}).get('phase',0)
if args.phase is not None and args.phase!=saved_phase:
 for name,station,oldidx,newidx in [('maintenance carrier A','departureBerths',saved_phase,args.phase),('maintenance carrier B','arrivalBerths',1-saved_phase,1-args.phase)]:
  shift=Vector(meta['maintenanceCabin'][station][newidx])-Vector(meta['maintenanceCabin'][station][oldidx])
  for ob in scene.objects:
   if ob.name.startswith(name):ob.location+=shift
 meta['maintenanceCabin']['phase']=args.phase
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
phase=meta.get('maintenanceCabin',{}).get('phase',0)

source=json.load(open(OUT+'/serra-audit-sprite-source.json'));start=time.time()
basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));W=cam.data.ortho_scale;H=W*scene.render.resolution_y/scene.render.resolution_x
pixel=source['pixelMapWidth']*W/args.placement_scale
headHeight=26*pixel/up.z
stamp={'blend':bpy.data.filepath,'blendMtime':os.path.getmtime(bpy.data.filepath),'metadataSource':args.meta or 'loaded scene[serra_metadata]','metadataSha256':hashlib.sha256(json.dumps(meta,sort_keys=True).encode()).hexdigest(),'label':args.label,'savedPhase':saved_phase,'auditedPhase':phase,'phaseSimulation':args.phase is not None and args.phase!=saved_phase}
# Evaluated world-space triangle BVH is equivalent to visible scene rays and avoids
# repeated scene/dependency dispatch for hundreds of thousands of sprite samples.
verts=[];triangles=[];triangle_objects=[];walk_triangles=[];walk_triangle_objects=[];solid_objects=[]
for ob in scene.objects:
 if ob.type not in {'MESH','CURVE','SURFACE','FONT'} or ob.hide_render:continue
 e=ob.evaluated_get(deps);me=e.to_mesh()
 if not me:continue
 me.calc_loop_triangles();offset=len(verts);worldverts=[ob.matrix_world@v.co for v in me.vertices];verts.extend(worldverts)
 localtris=[tuple(t.vertices) for t in me.loop_triangles]
 edgecounts=collections.Counter()
 for face in me.polygons:
  ids=list(face.vertices)
  for aa,bb in zip(ids,ids[1:]+ids[:1]):edgecounts[tuple(sorted((aa,bb)))]+=1
 if edgecounts and all(count==2 for count in edgecounts.values()):
  solid_objects.append((ob.name,BVHTree.FromPolygons(worldverts,localtris,all_triangles=True),tuple(min(v[j] for v in worldverts) for j in range(3)),tuple(max(v[j] for v in worldverts) for j in range(3))))
 for tri in me.loop_triangles:
  triangles.append(tuple(offset+i for i in tri.vertices));triangle_objects.append(ob)
  if ob.name.startswith('walk_'):
   walk_triangles.append(tuple(offset+i for i in tri.vertices));walk_triangle_objects.append(ob)
 e.to_mesh_clear()
scene_bvh=BVHTree.FromPolygons(verts,triangles,all_triangles=True)
walk_bvh=BVHTree.FromPolygons(verts,walk_triangles,all_triangles=True)
def ray_scene(deps,origin,direction,distance=40):
 loc,n,idx,dist=scene_bvh.ray_cast(origin,direction,distance)
 return (False,None,None,None,None,None) if loc is None else (True,loc,n,idx,triangle_objects[idx],None)
# Terrain BVHs exclude all walk surfaces and timber supports. Foundations are valid support.
terrain=[]
for ob in scene.objects:
 if ob.type!='MESH':continue
 n=ob.name.lower()
 if not ('limestone' in n or any(s in n for s in ['mountain foot','crag','escarpment','buttress','needle','foundation','bedrock'])):continue
 if 'pine' in n or 'needles' in n:continue
 e=ob.evaluated_get(deps);me=e.to_mesh();vs=[ob.matrix_world@v.co for v in me.vertices];fs=[tuple(p.vertices) for p in me.polygons]
 terrain.append((ob.name,BVHTree.FromPolygons(vs,fs)));e.to_mesh_clear()
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

def containedBody(q,footz):
 found=[]
 for name,bvh,lo,hi in solid_objects:
  if not (lo[0]<q.x<hi[0] and lo[1]<q.y<hi[1] and hi[2]>footz+.17 and lo[2]<footz+headHeight):continue
  for h in [.20,.50,.85]:
   p=Vector((q.x,q.y,footz+h))
   if not lo[2]<p.z<hi[2]:continue
   near,normal,idx,distance=bvh.find_nearest(p)
   if inside_closed(bvh,p):
    found.append({'object':name,'bodyHeight':h,'penetrationDepth':round(distance,5)});break
 return found

def terrainTop(x,y):
 best=None
 for name,bvh in terrain:
  loc,n,i,dist=bvh.ray_cast(Vector((x,y,40)),Vector((0,0,-1)),80)
  if loc is not None and (best is None or loc.z>best[1]):best=(name,loc.z)
 return best
samples=[];support=[];head=[];structure=[];walk_mismatch=[];rays=0;counts=collections.Counter()
for kind,routes in meta['worldRoutes'].items():
 for ri,route in enumerate(routes):
  if route.get('movement','walk') not in {'walk','board'}:continue
  for si,(aa,bb) in enumerate(zip(route['world'],route['world'][1:])):
   a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();N=max(2,math.ceil(d.length/args.step))
   for i in range(N+1):
    p=a.lerp(b,i/N);ident={'route':kind+':'+str(ri),'movement':route.get('movement','walk'),'phaseAvailable':ri==(phase if kind in {'terminalWalkA','boardingA'} else 1-phase) if kind in {'terminalWalkA','terminalWalkB','boardingA','boardingB'} else True,'segment':si,'t':round(i/N,5),'world':[round(v,5) for v in p],'distanceToTerminal':round((b-p).length+sum((Vector(y)-Vector(x)).length for x,y in zip(route['world'][si+1:],route['world'][si+2:])),5)};samples.append((ident,p))
    for off in [-.28,0,.28]:
     q=p+side*off;rays+=1
     for penetration in containedBody(q,p.z):
      head.append({**ident,'side':off,'object':penetration['object'],'heightAboveFoot':penetration['bodyHeight'],'penetrationDepth':penetration['penetrationDepth'],'method':'closed-solid-containment'})
     walkloc,walknormal,walkidx,walkdist=walk_bvh.ray_cast(q+Vector((0,0,1.6)),Vector((0,0,-1)),3.2)
     if walkloc is None or abs(walkloc.z-p.z)>.055:
      walk_mismatch.append({**ident,'side':off,'walkSurface':walk_triangle_objects[walkidx].name if walkloc is not None else None,'heightDelta':round(walkloc.z-p.z,5) if walkloc is not None else None,'interpretation':'no-walk-surface' if walkloc is None else 'foot-below-surface' if walkloc.z>p.z else 'foot-above-surface'})
     hit,loc,normal,idx,ob,mat=ray_scene(deps,q+Vector((0,0,.11)),Vector((0,0,-1)),distance=.33)
     if not hit or not (ob.name.startswith('walk_') or (route.get('movement')=='board' and ident['phaseAvailable'] and ob.name.startswith('maintenance carrier '+('A' if kind=='boardingA' else 'B')) and 'interior floor' in ob.name)) or loc.z<p.z-.16:
      support.append({**ident,'side':off,'object':ob.name if hit else None,'heightDelta':round(loc.z-p.z,5) if hit else None})
     hit,loc,normal,idx,ob,mat=ray_scene(deps,q+Vector((0,0,headHeight+.015)),Vector((0,0,-1)),distance=headHeight-.155)
     if hit and loc.z>p.z+.17:head.append({**ident,'side':off,'object':ob.name,'heightAboveFoot':round(loc.z-p.z,5)})
    t=terrainTop(p.x,p.y)
    structure.append({**ident,'terrain':t[0] if t else None,'terrainZ':round(t[1],5) if t else None,'deckToTerrainGap':round(p.z-.17-t[1],5) if t else None})
anchors=[]
for ob in scene.objects:
 if 'anchored timber post' not in ob.name:continue
 bounds=[ob.matrix_world@Vector(v) for v in ob.bound_box];bottom=min(v.z for v in bounds);top=max(v.z for v in bounds);x,y=ob.location.x,ob.location.y;t=terrainTop(x,y);gap=bottom-t[1] if t else None
 anchors.append({'object':ob.name,'base':[round(x,5),round(y,5),round(bottom,5)],'topZ':round(top,5),'terrain':t[0] if t else None,'terrainZ':round(t[1],5) if t else None,'gap':round(gap,5) if gap is not None else None,'status':'unsupported' if gap is None or gap>.08 else 'rooted'})
floating=[p for p in anchors if p['status']=='unsupported']
physical={'stamp':stamp,'method':'All declared walk and board approach paths sampled every <= step units including junctions and endpoints. Three footprint rays (center and +/-0.28 normal to route), authored walk_ surface <=0.16 below foot, headroom uses true atlas sprite height plus body-point containment in closed evaluated meshes (detecting rays that start inside tall solids); every timber anchor is independently compared with evaluated geological/foundation triangles. Cables and scenic ride centerlines are intentionally not walk routes. Board-route contacts retain movement=board and distanceToTerminal, because a mounted-layer contract is not yet defined.','step':args.step,'routeSampleCount':len(samples),'supportRayCount':rays,'headroomRayCount':rays,'actualSpriteWorldHeight':headHeight,'unsupportedFootCount':len(support),'headroomObstructionCount':len(head),'floatingTimberAnchorCount':len(floating),'walkSurfaceMismatchCount':len(walk_mismatch),'centerWalkSurfaceMismatchCount':sum(v['side']==0 for v in walk_mismatch),'unsupportedFeet':support,'walkSurfaceMismatches':walk_mismatch,'headroomObstructions':head,'timberAnchors':anchors,'terrainUnderRoutes':structure,'scenicRide':meta.get('maintenanceCabin')}
json.dump(physical,open(OUT+'/serra-audit-physical-'+args.label+'.json','w'),indent=2)
print('SERRA_PHYSICAL='+json.dumps({k:physical[k] for k in ['routeSampleCount','supportRayCount','actualSpriteWorldHeight','unsupportedFootCount','headroomObstructionCount','floatingTimberAnchorCount']}),flush=True)
# Opaque squares from the actual authored source, every animation frame and facing.
# Union ray keys retain their exact frame memberships and never include transparent pixels.
opaque=collections.defaultdict(set)
for frame,rows in source['frames'].items():
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,c in enumerate(row):
    if c=='_':continue
    px=15-x if flip else x
    for fx,fy in [(.5,.5),(.08,.08),(.92,.08),(.08,.92),(.92,.92)]:
     opaque[(px+fx-8,26-y-fy)].add(frame+('Left' if flip else 'Right'))
contacts=[];body_counts=collections.Counter();feet_counts=collections.Counter();tested=0;object_first={};route_objects=collections.Counter()
for ident,p in samples:
 for (px,py),frames in opaque.items():
  q=p+right*(px*pixel)+Vector((0,0,py*pixel/up.z));tested+=1
  hit,loc,normal,idx,ob,mat=ray_scene(deps,q+toward*.012,toward,distance=40)
  if hit:
   foot=py<=2.0;cl='foot-level-contact' if foot else 'walk-surface' if ob.name.startswith('walk_') else 'guardrail' if (' rail' in ob.name or 'stringer' in ob.name) else 'scenery-or-equipment'
   entry={**ident,'pixelRelativeToFoot':[round(px,2),round(py,2)],'object':ob.name,'contactWorld':[round(v,5) for v in loc],'distanceTowardCamera':round((loc-q).length,5),'classification':cl,'frames':sorted(frames)}
   contacts.append(entry);(feet_counts if foot else body_counts)[ob.name]+=1;route_objects[(ident['route'],ob.name,cl)]+=1
   object_first.setdefault(ob.name,entry)
projection={'stamp':stamp,'method':'Camera-directed rays from each opaque source pixel square, center plus four inset corners, union of idle and six walk frames with both facings, at all walking samples. World-vertical actor plane matches the game projection. Rear scenery is excluded by ray direction. Foot pixels <=2 px high are classified separately; no contacts are discarded.','scope':'Exact continuous source pixel grid at atlas island placement scale '+str(args.placement_scale)+'. No Serra runtime placement exists yet; scale=1 is explicit prototype assumption. CSS per-pixel round/ceil overshoot is NOT covered by these ideal-source rays; validate actual raster profiles before runtime integration.','spriteSource':source['source'],'pixelMapWidth':source['pixelMapWidth'],'pixelWorldWidth':pixel,'heightWorld':headHeight,'opaqueSamplePositions':len(opaque),'routeSampleCount':len(samples),'rayCount':tested,'foregroundContactCount':len(contacts),'bodyContactsByObject':dict(body_counts),'footContactsByObject':dict(feet_counts),'routeObjects':[{'route':r,'object':o,'classification':c,'count':n} for (r,o,c),n in route_objects.items()],'firstContactByObject':object_first,'contacts':contacts}
json.dump(projection,open(OUT+'/serra-audit-billboard-'+args.label+'.json','w'),indent=2)
summary={'stamp':stamp,'elapsedSeconds':round(time.time()-start,2),'routeSampleCount':len(samples),'mainRouteSampleCount':sum(x['route'].startswith('main:') for x,p in samples),'mainUnsupportedFootCount':sum(x['route'].startswith('main:') for x in support),'mainHeadroomObstructionCount':sum(x['route'].startswith('main:') for x in head),'walkMovementUnsupportedFootCount':sum(x['movement']=='walk' and x['phaseAvailable'] for x in support),'walkMovementHeadroomObstructionCount':sum(x['movement']=='walk' and x['phaseAvailable'] for x in head),'walkMovementSurfaceMismatchCount':sum(x['movement']=='walk' and x['phaseAvailable'] for x in walk_mismatch),'walkMovementNonFloorForegroundContactCount':sum(x['movement']=='walk' and x['phaseAvailable'] and x['pixelRelativeToFoot'][1]>2 and not x['object'].startswith('walk_') for x in contacts),'supportRayCount':rays,'unsupportedFootCount':len(support),'headroomObstructionCount':len(head),'floatingTimberAnchorCount':len(floating),'walkSurfaceMismatchCount':len(walk_mismatch),'centerWalkSurfaceMismatchCount':sum(v['side']==0 for v in walk_mismatch),'billboardRayCount':tested,'billboardBodyContactsByObject':dict(body_counts),'billboardFootContactsByObject':dict(feet_counts),'status':'issues-found' if support or head or floating or walk_mismatch or body_counts else 'passed-prototype-scope'}
json.dump(summary,open(OUT+'/serra-audit-'+args.label+'.json','w'),indent=2)
print('SERRA_AUDIT='+json.dumps(summary),flush=True)

# Actual paintMapActor rounded/ceil raster footprint at explicitly declared review
# profiles. These are prototype QA profiles, not a claim about unimplemented Serra HUD fitting.
if args.raster:
 from bpy_extras.object_utils import world_to_camera_view
 profiles=[('desktop',1180,757,1.0),('portrait',400,606,1.05),('landscape',846,392,1.0)]
 reports=[]
 pixel_frames=collections.defaultdict(set);pixel_head_frames=collections.defaultdict(set);pixel_face_frames=collections.defaultdict(set)
 for fn,rows in source['frames'].items():
  for flip in [False,True]:
   for y,row in enumerate(rows):
    for x,c in enumerate(row):
     if c!='_':
      key=(15-x if flip else x,y);ff=fn+('Left' if flip else 'Right');pixel_frames[key].add(ff)
      hy=1 if fn in ['walk2','walk5'] else 0
      if y<=hy+11 and 3<=x<=14:
       pixel_head_frames[key].add(ff)
       if c in 'SsL':pixel_face_frames[key].add(ff)
 for name,w,h,zoom in profiles:
  C=min(w/1.6,h)*1.6*zoom;scale=C*source['pixelMapWidth'];size=math.ceil(scale);body=collections.Counter();feet=collections.Counter();first={};active_first={};total=0;routeCounts=collections.Counter();active_heads=collections.Counter();active_faces=collections.Counter();active_head_first={}
  for ident,p in samples:
   proj=world_to_camera_view(scene,cam,p);footx=(proj.x-.5)*C+w/2;footy=(.5-proj.y)*C/1.6+h/2
   raster={};raster_heads=collections.defaultdict(set);raster_faces=collections.defaultdict(set)
   for (sx,sy),frames in pixel_frames.items():
    # JS Math.round is floor(value+.5), including negatives; Python round differs.
    x0=math.floor(footx+(sx-8)*scale+.5);y0=math.floor(footy+(sy-26)*scale+.5)
    for dx in range(size):
     for dy in range(size):
      key=(x0+dx+.5,y0+dy+.5);raster.setdefault(key,set()).update(frames);raster_heads[key].update(pixel_head_frames[(sx,sy)]);raster_faces[key].update(pixel_face_frames[(sx,sy)])
   for (rx,ry),frames in raster.items():
    offx=(rx-footx)/C*W;offz=(footy-ry)/C*W/up.z;q=p+right*offx+Vector((0,0,offz));total+=1
    hit,loc,n,idx,ob,mat=ray_scene(deps,q+toward*.012,toward,distance=40)
    if hit:
     sourceHeight=(footy-ry)/scale;target=feet if sourceHeight<=2 else body;target[ob.name]+=1;routeCounts[(ident['route'],ob.name,'feet' if sourceHeight<=2 else 'body')]+=1
     if ob.name not in first or sourceHeight>first[ob.name]['heightInSourcePixels']:
      first[ob.name]={**ident,'object':ob.name,'heightInSourcePixels':round(sourceHeight,4),'cssPixelCenter':[rx,ry],'spriteFrames':sorted(frames),'contactWorld':[round(v,5) for v in loc]}
     if ident['phaseAvailable'] and (ob.name not in active_first or sourceHeight>active_first[ob.name]['heightInSourcePixels']):
      active_first[ob.name]={**ident,'object':ob.name,'heightInSourcePixels':round(sourceHeight,4),'cssPixelCenter':[rx,ry],'spriteFrames':sorted(frames),'contactWorld':[round(v,5) for v in loc]}
     if ident['phaseAvailable'] and raster_heads[(rx,ry)]:
      active_heads[ob.name]+=1
      if raster_faces[(rx,ry)]:active_faces[ob.name]+=1
      active_head_first.setdefault(ob.name,{**ident,'object':ob.name,'cssPixelCenter':[rx,ry],'headFrames':sorted(raster_heads[(rx,ry)]),'faceFrames':sorted(raster_faces[(rx,ry)]),'contactWorld':[round(v,5) for v in loc]})
  reports.append({'profile':name,'viewport':[w,h],'zoom':zoom,'actorScaleCssPixels':scale,'paintPixelSizeCssPixels':size,'rayCount':total,'bodyContactsByObject':dict(body),'footContactsByObject':dict(feet),'highestContactByObject':first,'highestActiveContactByObject':active_first,'activeHeadContactsByObject':dict(active_heads),'activeFaceContactsByObject':dict(active_faces),'firstActiveHeadContactByObject':active_head_first,'routeObjects':[{'route':r,'object':o,'region':c,'count':n} for (r,o,c),n in routeCounts.items()]})
 raster_report={'stamp':stamp,'method':'Exact source idle +6 walk frame masks, both facings, actual Math.round start and Math.ceil square size from paintMapActor. Ray through every occupied CSS-pixel center at every declared walking sample. Pixel-rounded source coverage is unioned by source frame memberships. Image viewport center=.5,.5 and island scale1; these declared profiles are prototype scenarios, not measured Serra runtime fitting.','profiles':reports}
 json.dump(raster_report,open(OUT+'/serra-audit-raster-'+args.label+'.json','w'),indent=2)
 print('SERRA_RASTER='+json.dumps([{k:v for k,v in r.items() if k in ['profile','rayCount','bodyContactsByObject']} for r in reports]),flush=True)
