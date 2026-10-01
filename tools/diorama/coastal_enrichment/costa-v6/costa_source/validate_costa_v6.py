import os
"""Independent read-only before/after checks. Run with blender -b -P this_file.py."""
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
P=Path(os.environ["FEKA_OUTPUT_DIR"])
meta=json.loads((P/'base-costa.meta.json').read_text());journey=json.loads((P/'base-coast-port-journey.meta.json').read_text());dock=journey['islands']['costa']
def protected(o):return any(t in o.name for t in ['continuous supported treads','worn sandstone footpath','natural clearing ','secret branch beach landing','east stair open arrival landing','dock ','pile cut end','western gap bridge','lighthouse approach bridge'])
def support_obj(o):return o.type=='MESH' and (protected(o) or any(t in o.name for t in ['scalloped turf','single sculpted sand shoreline']))
samples=[]
for kind,routes in meta['worldRoutes'].items():
 for route in routes:
  for a,b in zip(route['world'],route['world'][1:]):
   a,b=Vector(a),Vector(b);d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(3,math.ceil(d.length/.12))
   for j in range(n+1):
    for off in [-.10,0,.10]:samples.append(a.lerp(b,j/n)+side*off)

def inspect_scene(file):
 bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 vs=[];fs=[]
 for o in s.objects:
  if not support_obj(o):continue
  ev=o.evaluated_get(dg);me=ev.to_mesh();off=len(vs);vs.extend(o.matrix_world@v.co for v in me.vertices);fs.extend(tuple(off+i for i in p.vertices) for p in me.polygons);ev.to_mesh_clear()
 tree=BVHTree.FromPolygons(vs,fs);support=[]
 for pt in samples:
  hit,normal,_,_=tree.ray_cast(pt+Vector((0,0,.18)),Vector((0,0,-1)),1.5);support.append(None if hit is None else [*hit])
 signatures={}
 for o in s.objects:
  if not protected(o):continue
  coords=[tuple(v.co) for v in o.data.vertices] if o.type=='MESH' else [[tuple(p.co) for p in spline.points]for spline in o.data.splines] if o.type=='CURVE' else []
  signatures[o.name]=hashlib.sha256(repr(([list(r) for r in o.matrix_world],coords)).encode()).hexdigest()
 return {'protected':signatures,'support':support,'cameraMatrix':[list(r) for r in s.camera.matrix_world],'orthoScale':s.camera.data.ortho_scale,'size':[s.render.resolution_x,s.render.resolution_y]}
base=inspect_scene(P/'base-v5.blend');new=inspect_scene(P/'costa-v6.blend')
protected_diff=[name for name,sig in base['protected'].items() if new['protected'].get(name)!=sig]
support_diff=[]
for i,(a,b) in enumerate(zip(base['support'],new['support'])):
 if (a is None)!=(b is None) or (a is not None and (Vector(a)-Vector(b)).length>.0001):support_diff.append({'sample':i,'before':a,'after':b})
scene=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();towards=scene.camera.matrix_world.to_3x3()@Vector((0,0,1));flags=[];rays=views=0
for name in ['junctionToDock','boardingRoute']:
 pts=[Vector(p['world']) for p in dock[name]]
 for a,b in zip(pts,pts[1:]):
  d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(3,math.ceil(d.length/.1))
  for i in range(n+1):
   p=a.lerp(b,i/n)
   for off in [-.18,0,.18]:
    rays+=1;hit,loc,_,_,o,_=scene.ray_cast(dg,p+side*off+Vector((0,0,1.15)),Vector((0,0,-1)),distance=1.6)
    if hit and o.get('enrichment_group') and not o.get('decorative_floor') and loc.z>p.z+.18:flags.append({'type':'body','route':name,'object':o.name})
   for h in [.20,.65,1.0]:
    views+=1;actor=p+Vector((0,0,h));hit,_,_,_,o,_=scene.ray_cast(dg,actor+towards*35,-towards,distance=34.99)
    if hit and o.get('enrichment_group') and not o.get('decorative_floor'):flags.append({'type':'view','route':name,'object':o.name})
report={'protectedObjectCount':len(base['protected']),'protectedGeometryAndTransformsChanged':protected_diff,'routeSupportSampleCount':len(samples),'routeSupportChanges':support_diff,'cameraAndSizeIdentical':all(base[k]==new[k] for k in ['cameraMatrix','orthoScale','size']),'dockBodyRays':rays,'dockCameraRays':views,'dockObstructionFlags':flags,'scope':'Independent local static comparison against bundled v5. Does not certify live travel animation or boat64 integration.'}
(P/'independent-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert not protected_diff and not support_diff and not flags and report['cameraAndSizeIdentical']
