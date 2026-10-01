"""Read-only fresh-source support/headroom and projected actor-silhouette checks."""
import bpy,json,os,math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=globals().get('FABRICA_OUT',os.path.join(ROOT,'public/assets/world/map'));DOC=globals().get('FABRICA_DOC',os.path.join(ROOT,'docs/world/diorama'))
os.makedirs(OUT,exist_ok=True);os.makedirs(DOC,exist_ok=True)
meta=FABRICA_META if 'FABRICA_META' in globals() else json.load(open(os.path.join(OUT,'fabrica-diorama.meta.json')))
scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();cam=scene.camera
obstacles=[];unsupported=[];occluded=[];rays=0;projected=0;max_rise=0
# Camera-facing rays test actual foreground occlusion rather than treating all rear
# architecture whose bounding box meets a marker as if it were in front of the actor.
toward=cam.rotation_euler.to_matrix()@Vector((0,0,1));right=cam.rotation_euler.to_matrix()@Vector((1,0,0))
for kind,routes in meta['worldRoutes'].items():
 for ri,route in enumerate(routes):
  for si,(aa,bb) in enumerate(zip(route['world'],route['world'][1:])):
   a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(2,math.ceil(d.length/.13));max_rise=max(max_rise,abs(d.z)/n)
   for i in range(n+1):
    p=a.lerp(b,i/n);identity={'route':kind+':'+str(ri),'segment':si,'t':round(i/n,4),'world':[round(v,4) for v in p]}
    for off in [-.20,0,.20] if kind=='secret' else [-.28,0,.28]:
     q=p+side*off;rays+=1
     hit,loc,normal,idx,ob,mat=scene.ray_cast(deps,q+Vector((0,0,.88)),Vector((0,0,-1)),distance=1.3)
     if hit and loc.z>p.z+.17:obstacles.append({**identity,'side':off,'object':ob.name,'heightAboveFoot':round(loc.z-p.z,4)})
     hit,loc,normal,idx,ob,mat=scene.ray_cast(deps,q+Vector((0,0,.11)),Vector((0,0,-1)),distance=.33)
     if not hit or not ob.name.startswith('walk_') or loc.z<p.z-.16:unsupported.append({**identity,'side':off,'object':ob.name if hit else None,'heightDelta':round(loc.z-p.z,4) if hit else None})
    # 0.52-unit-wide, 0.98-unit-tall actor, four vertical levels. The 0.22 foot
    # clearance excludes floor self-contact while including the body's lower edge.
    for off in [-.26,0,.26]:
     for z in [.22,.46,.72,.98]:
      q=p+right*off+Vector((0,0,z));projected+=1
      hit,loc,normal,idx,ob,mat=scene.ray_cast(deps,q+toward*.015,toward,distance=40)
      if hit:occluded.append({**identity,'side':off,'height':z,'object':ob.name,'distance':round((loc-q).length,4)})
report={'method':'Read-only rays at route center and both edges, every <=0.13 world unit. Support is an authored walk_ surface within 0.16 under the foot; headroom checked to0.88.','sampleCount':rays,'headroomRayCount':rays,'supportRayCount':rays,'obstructionCount':len(obstacles),'unsupportedCount':len(unsupported),'maxAdjacentSampleRise':round(max_rise,4),'obstructions':obstacles,'unsupported':unsupported}
project={'method':'Actual camera-facing ray intersections from actor silhouette samples, rather than overlapping screen bounding boxes. Every route step uses three lateral samples and four body heights.','actorWorldEnvelope':{'halfWidth':.26,'height':.98,'lowestTestHeight':.22},'sampleCount':projected,'conflictCount':len(occluded),'conflicts':occluded}
json.dump(report,open(os.path.join(DOC,'fabrica-clearance.json'),'w'),indent=2);json.dump(project,open(os.path.join(DOC,'fabrica-projected-clearance.json'),'w'),indent=2)
meta['auditSummary']={k:v for k,v in report.items() if k not in {'method','obstructions','unsupported'}};meta['projectedAuditSummary']={k:project[k] for k in ['sampleCount','conflictCount']};
import runpy
runpy.run_path(os.path.join(ROOT,'tools/diorama/check_fabrica_billboard.py'),init_globals={'FABRICA_META':meta,'FABRICA_DOC':DOC},run_name='__main__')
print('FABRICA_AUDIT='+json.dumps(meta['auditSummary']));print('FABRICA_PROJECTED='+json.dumps(meta['projectedAuditSummary']))
assert rays>0 and projected>0
assert not obstacles and not unsupported and not occluded,'Fabrica route clearance failed; inspect reports'

# Only a completely passing audit may replace metadata used by the runtime pair.
import tempfile
fd,temporary=tempfile.mkstemp(prefix='.fabrica-metadata-',suffix='.json',dir=OUT)
with os.fdopen(fd,'w') as handle:json.dump(meta,handle,indent=2)
os.replace(temporary,os.path.join(OUT,'fabrica-diorama.meta.json'))
