"""Focused Serra hardware check on an authored .blend, no browser/game changes.
blender -b serra-campaign.blend -P tools/diorama/check_serra_sheave_mounts.py -- --output report.json
Covers the four fixed mounts, continuous carrier clearance and head/face raster
visibility against only the changed hardware. Other scenery is not re-audited.
"""
import argparse, bpy, bmesh, collections, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--allow-detached',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
scene=bpy.context.scene; cam=scene.camera; bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get(); meta=json.loads(scene['serra_metadata'])
root=Path(__file__).resolve().parents[2]
source=json.loads((root/'tools/diorama/regional_enrichment/serra/source/serra-audit-sprite-source.json').read_text())

def geometry(ob):
 e=ob.evaluated_get(deps); me=e.to_mesh(); me.calc_loop_triangles()
 vertices=[ob.matrix_world@v.co for v in me.vertices]
 faces=[tuple(t.vertices) for t in me.loop_triangles]
 e.to_mesh_clear()
 return vertices,faces,BVHTree.FromPolygons(vertices,faces,all_triangles=True)

def intersection(left,right):
 return len(left[2].overlap(right[2]))

def contained(bvh,point):
 hits=0; direction=Vector((.917,.317,.239)).normalized();origin=point.copy()
 for _ in range(100):
  loc,normal,index,distance=bvh.ray_cast(origin,direction,100)
  if loc is None:break
  hits+=1;origin=loc+direction*.00002
 return bool(hits%2)

hardware={};mounts=[]
for terminal,berths in [('lower',meta['maintenanceCabin']['departureBerths']),('upper',meta['maintenanceCabin']['arrivalBerths'])]:
 prefix=terminal+' maintenance terminal'
 for lane,foot in enumerate(berths):
  wheel=bpy.data.objects[prefix+' sheave'+('' if lane==0 else '.001')]
  arm=bpy.data.objects[prefix+' short sheave support '+str(lane)]
  post=bpy.data.objects[prefix+' side blue support '+str(lane)]
  axle=bpy.data.objects.get(prefix+' sheave axle '+str(lane))
  wg,ag,pg=geometry(wheel),geometry(arm),geometry(post)
  gap=min([ag[2].find_nearest(v)[3] for v in wg[0]]+[wg[2].find_nearest(v)[3] for v in ag[0]])
  checks={'uprightToCantilever':intersection(pg,ag)>0,'cantileverToAxle':False,'axleToSheave':False}
  if axle:
   xg=geometry(axle);checks['cantileverToAxle']=intersection(ag,xg)>0;checks['axleToSheave']=intersection(xg,wg)>0;hardware[axle.name]=xg
  hardware[wheel.name]=wg;hardware[arm.name]=ag
  # Cable is fixed. Its centerline should graze the lower gold rim within radius.
  cable_point=Vector(foot)+Vector((0,0,meta['maintenanceCabin']['overheadCableZOffset']))
  tangent_gap=wg[2].find_nearest(cable_point)[3]
  checks['cableAtLowerRim']=0<=tangent_gap<=.0261
  mounts.append({'terminal':terminal,'lane':lane,'checks':checks,'directArmWheelSeparation':round(gap,7),'cableCenterToRim':round(tangent_gap,7),'hubWorld':list(wheel.location)})

# Verify 24 exact linear intervals per lane for every convex cabin component.
# The clamp and hanger are the only parts allowed to meet a running sheave.
ride=meta['maintenanceCabin'];anchor=Vector(ride['departureBerths'][ride['phase']])
parts={ob.name:[v-anchor for v in geometry(ob)[0]] for ob in scene.objects if ob.name.startswith('maintenance carrier A')}
collisions=[];running_contacts=[];hulls=0
for lane,path in enumerate(ride['passengerFootPaths']):
 for interval,(start,end) in enumerate(zip(path,path[1:])):
  for part,vertices in parts.items():
   bm=bmesh.new()
   for vertex in [v+Vector(pos) for pos in [start,end] for v in vertices]:bm.verts.new(vertex)
   bm.verts.ensure_lookup_table();bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
   bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
   for i,vertex in enumerate(bm.verts):vertex.index=i
   hv=[v.co.copy() for v in bm.verts];hf=[tuple(v.index for v in f.verts) for f in bm.faces]
   hull=BVHTree.FromPolygons(hv,hf);hlo=[min(v[i] for v in hv) for i in range(3)];hhi=[max(v[i] for v in hv) for i in range(3)]
   for name,(sv,sf,sb) in hardware.items():
    slo=[min(v[i] for v in sv) for i in range(3)];shi=[max(v[i] for v in sv) for i in range(3)]
    if any(hlo[i]>shi[i] or slo[i]>hhi[i] for i in range(3)):continue
    hit=bool(hull.overlap(sb)) or contained(hull,sum(sv,Vector())/len(sv)) or contained(sb,sum(hv,Vector())/len(hv))
    if hit:
     record={'lane':lane,'interval':interval,'part':part,'hardware':name}
     is_wheel=' sheave' in name and ' axle' not in name and ' support' not in name
     (running_contacts if is_wheel and part.endswith(('cable grip','hanger')) else collisions).append(record)
   hulls+=1;bm.free()

# Exact rounded/ceil source head and face CSS pixels at the current camera.
verts=[];faces=[];names=[]
for name,(vs,fs,bvh) in hardware.items():
 offset=len(verts);verts.extend(vs);faces.extend(tuple(offset+i for i in f) for f in fs);names.extend([name]*len(fs))
hardware_bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
basis=cam.matrix_world.to_quaternion();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));W=cam.data.ortho_scale
cells={}
for fn,rows in source['frames'].items():
 hy=1 if fn in ['walk2','walk5'] else 0
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,ch in enumerate(row):
    if ch=='_' or not (y<=hy+11 and 3<=x<=14):continue
    key=(15-x if flip else x,y);cells[key]=cells.get(key,False) or ch in 'SsL'
paths=[(kind+':'+str(i),r['world']) for kind,routes in meta['worldRoutes'].items() for i,r in enumerate(routes)]
paths += [('ride:'+str(i),path) for i,path in enumerate(ride['passengerFootPaths'])]
poses=[]
for label,path in paths:
 for interval,(aa,bb) in enumerate(zip(path,path[1:])):
  av,bv=Vector(aa),Vector(bb);N=max(2,math.ceil((bv-av).length/.025))
  if label.startswith('ride:'):N=max(N,84) # >= 2017 samples per lane
  poses.extend((label,interval,i/N,av.lerp(bv,i/N)) for i in range(N+1))
visibility=[]
for profile,w,h,zoom in [('desktop',1180,757,1),('portrait',400,606,1.05),('landscape',846,392,1)]:
 C=min(w/1.6,h)*1.6*zoom;scale=C*source['pixelMapWidth'];size=math.ceil(scale);hits=[];rays=0
 for label,interval,t,foot in poses:
  projected=world_to_camera_view(scene,cam,foot);fx=(projected.x-.5)*C+w/2;fy=(.5-projected.y)*C/1.6+h/2;pixels={}
  for (sx,sy),face in cells.items():
   x0=math.floor(fx+(sx-8)*scale+.5);y0=math.floor(fy+(sy-26)*scale+.5)
   for dx in range(size):
    for dy in range(size):key=(x0+dx+.5,y0+dy+.5);pixels[key]=pixels.get(key,False) or face
  hitnames=collections.Counter();facehits=0
  for (x,y),face in pixels.items():
   origin=foot+right*((x-fx)/C*W)+Vector((0,0,(fy-y)/C*W/up.z));loc,n,idx,dist=hardware_bvh.ray_cast(origin+toward*.012,toward,40);rays+=1
   if loc is not None:hitnames[names[idx]]+=1;facehits+=int(face)
  if hitnames:hits.append({'route':label,'segment':interval,'t':t,'objects':dict(hitnames),'facePixels':facehits})
 visibility.append({'profile':profile,'poses':len(poses),'rays':rays,'headContactPoses':len(hits),'faceContactPoses':sum(bool(h['facePixels']) for h in hits),'contacts':hits})

published=json.loads((root/'tools/diorama/regional_enrichment/serra/source/base-serra.meta.json').read_text())
contracts={k:meta[k]==published[k] for k in ['camera','nodes','routes','secretTransport','secretRoute','routeDurationsSeconds','size']}
report={'status':'PASS' if all(all(m['checks'].values()) for m in mounts) and not collisions and not any(v['headContactPoses'] for v in visibility) and all(contracts.values()) else 'FAIL','scene':Path(bpy.data.filepath).name,'scope':'Four Serra maintenance mounts only; other scenery and browser behavior not re-audited.','mounts':mounts,'carrierSweep':{'hulls':hulls,'collisionCount':len(collisions),'collisions':collisions,'runningInterfaceContactCount':len(running_contacts),'runningInterfaceContacts':running_contacts},'headFaceRaster':visibility,'unchangedRuntimeContracts':contracts,'metadataSha256':hashlib.sha256(json.dumps(meta,sort_keys=True).encode()).hexdigest()}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n')
print('SERRA_MOUNTS='+json.dumps({k:v for k,v in report.items() if k not in {'headFaceRaster','carrierSweep'}}),flush=True)
print('SERRA_MOUNT_SWEEP='+json.dumps({'hulls':hulls,'collisions':collisions,'runningContacts':len(running_contacts)}),flush=True)
print('SERRA_MOUNT_VISIBILITY='+json.dumps([{k:v for k,v in row.items() if k!='contacts'} for row in visibility]),flush=True)
assert a.allow_detached or report['status']=='PASS',str(a.output)
