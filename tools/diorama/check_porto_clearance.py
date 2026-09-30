"""Read-only Porto route support, headroom and projected actor/load checks."""
import bpy,os,json,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')
OUT=globals().get('PORTO_OUT',OUT);DOC=globals().get('PORTO_DOC',DOC)
os.makedirs(OUT,exist_ok=True);os.makedirs(DOC,exist_ok=True)
scene=bpy.context.scene;cam=scene.camera
# Canonical builds supply their newly projected metadata. Standalone cached-scene
# audits retain the explicit on-disk metadata input used by render_porto_cached.py.
meta=PORTO_META if 'PORTO_META' in globals() else json.load(open(os.path.join(OUT,'porto-diorama.meta.json')))
world_routes=meta['worldRoutes']
def project(co):
 p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
# Read-only audits include BOTH headroom and actual walkable support under all route samples.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();obstacles=[];unsupported=[];rays=0;max_rise=0.0
for kind,routes in world_routes.items():
 for ri,route in enumerate(routes):
  for si,(aa,bb) in enumerate(zip(route['world'],route['world'][1:])):
   a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(2,int(d.length/.13));max_rise=max(max_rise,abs(d.z)/n)
   for i in range(n+1):
    p=a.lerp(b,i/n)
    for off in [-.20,0,.20] if kind=='secret' else [-.28,0,.28]:
     q=p+side*off;rays+=1;identity={'route':kind+':'+str(ri),'segment':si,'t':round(i/n,3),'side':off,'world':[round(v,4) for v in q]}
     hit,loc,normal,idx,ob,mat=scene.ray_cast(deps,q+Vector((0,0,.88)),Vector((0,0,-1)),distance=1.3)
     if hit and loc.z>p.z+.17:obstacles.append({**identity,'object':ob.name,'heightAboveFoot':round(loc.z-p.z,4)})
     hit,loc,normal,idx,ob,mat=scene.ray_cast(deps,q+Vector((0,0,.11)),Vector((0,0,-1)),distance=.33)
     if not hit or not ob.name.startswith('walk_') or loc.z<p.z-.16:unsupported.append({**identity,'object':ob.name if hit else None,'heightDelta':round(loc.z-p.z,4) if hit else None})
report={'method':'Read-only center and edge vertical rays. Obstructions above footline+0.17 inside 0.88 headroom are flagged, including railings. Support must be an authored walk_ surface within 0.16 below footline.','sampleCount':rays,'headroomRayCount':rays,'supportRayCount':rays,'obstructionCount':len(obstacles),'unsupportedCount':len(unsupported),'maxAdjacentSampleRise':round(max_rise,4),'obstructions':obstacles,'unsupported':unsupported}
json.dump(report,open(os.path.join(DOC,'porto-prototype-clearance.json'),'w'),indent=2);meta['auditSummary']={k:v for k,v in report.items() if k not in {'obstructions','unsupported','method'}}
projected_corners=[]
for ob in scene.objects:
 if ob.name.startswith(('suspended cargo load','cargo hazard sling','lifting sling dark band','load bridle','visible steel lifting hook','taut lifting cable','hoist yellow casing','hoist graphite stripe','crane hoist wheel')):
  projected_corners.extend(project(ob.matrix_world@Vector(v)) for v in ob.bound_box)
box={'left':min(p['x'] for p in projected_corners),'right':max(p['x'] for p in projected_corners),'top':min(p['y'] for p in projected_corners),'bottom':max(p['y'] for p in projected_corners)}
conflicts=[];tested=0
for key,path in list(meta['routes'].items())+[('secret',meta['secretRoute'])]:
 for si,(a,b) in enumerate(zip(path,path[1:])):
  for j in range(13):
   t=j/12;x=a['x']+(b['x']-a['x'])*t;y=a['y']+(b['y']-a['y'])*t;tested+=1
   if x+.035>box['left'] and x-.035<box['right'] and y+.008>box['top'] and y-.105<box['bottom']:conflicts.append({'route':key,'segment':si,'t':round(t,3),'foot':{'x':x,'y':y}})
projected={'purpose':'Conservative image-space route and actor envelope against the entire suspended-load/hoist assembly. Complements 3D headroom and support checks.','actorEnvelope':{'halfWidth':.035,'height':.105,'footMargin':.008},'loadBounds':box,'sampleCount':tested,'conflictCount':len(conflicts),'conflicts':conflicts}
json.dump(projected,open(os.path.join(DOC,'porto-projected-clearance.json'),'w'),indent=2);meta['projectedAuditSummary']={'sampleCount':tested,'conflictCount':len(conflicts)}
print('PORTO_AUDIT='+json.dumps(report));print('PORTO_PROJECTED='+json.dumps(projected))
assert rays>0 and tested>0,'Porto audit must sample both world and projected routes'
assert not obstacles and not unsupported and not conflicts,'Porto route clearance failed; inspect audit reports'
json.dump(meta,open(os.path.join(OUT,'porto-diorama.meta.json'),'w'),indent=2)
