"""Read-only center/edge clearance audit of the loaded Blender scene and exported routes."""
import bpy,os,json,collections
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
meta=json.load(open(os.path.join(ROOT,'public/assets/world/map/costa-diorama.meta.json')))
scene=bpy.context.scene;bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get()
walkable=('west ascent carved step','arch descent carved step','east ascent carved step','highpoint climbing step','secret ledge climb','secret branch beach landing','worn sandstone footpath','natural clearing','western gap bridge plank','lighthouse approach bridge plank')
flags=[];rays=0;center=0;edge=0
for kind,routes in meta['worldRoutes'].items():
 for route_index,route in enumerate(routes):
  points=route['world']
  for seg in range(len(points)-1):
   a,b=Vector(points[seg]),Vector(points[seg+1]);d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(3,int(d.length/.13))
   for i in range(n):
    t=i/n;p=a.lerp(b,t)
    for off in [-.12,0,.12] if kind=='secret' else [-.23,0,.23]:
     q=p+side*off;rays+=1;center+=int(off==0);edge+=int(off!=0)
     hit,loc,normal,index,ob,mat=scene.ray_cast(depsgraph,q+Vector((0,0,.85)),Vector((0,0,-1)),distance=1.3)
     if hit and loc.z>p.z+.18 and not ob.name.startswith(walkable):flags.append({'route':kind+':'+str(route_index),'segment':seg,'t':round(t,2),'side':off,'world':[round(v,3) for v in q],'hit':ob.name,'heightAboveRoute':round(loc.z-p.z,3)})
report={'method':'Vertical rays at route center and lateral offsets; flags non-walkable geometry >0.18 world units above intended footline within 0.85 headroom. Visual inspection is also required. Handrail edge contacts are reported, not silently ignored.','rayCount':rays,'centerRayCount':center,'edgeRayCount':edge,'flagCount':len(flags),'centerFlagCount':sum(f['side']==0 for f in flags),'edgeFlagCount':sum(f['side']!=0 for f in flags),'byObject':dict(collections.Counter(f['hit'] for f in flags)),'flags':flags}
json.dump(report,open(os.path.join(ROOT,'docs/world/diorama/art-route-clearance.json'),'w'),indent=2)
print('ROUTE_AUDIT='+json.dumps(report))
