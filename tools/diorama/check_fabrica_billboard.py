"""Viewport-specific billboard legibility, separate from world support/headroom.
Profiles come from the measured mapActorScale/frameMapPins runtime output. This is
conservative rectangle sampling, not a claim that every opaque sprite pixel is hit.
"""
import bpy,json,os,math,collections
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));DOC=globals().get('FABRICA_DOC',os.path.join(ROOT,'docs/world/diorama'))
meta=FABRICA_META;scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();cam=scene.camera
profiles=json.load(open(os.path.join(ROOT,'docs/world/diorama/fabrica-runtime-envelopes.json')))
basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));W=cam.data.ortho_scale;H=W*1200/1920
results=[];total_equipment=0;total_contacts=0;total_samples=0
for case in profiles['profiles']:
 bounds=case['normalized'];height=-bounds['top'];contacts=[];samples=0
 for kind,routes in meta['worldRoutes'].items():
  for ri,route in enumerate(routes):
   for si,(aa,bb) in enumerate(zip(route['world'],route['world'][1:])):
    a,b=Vector(aa),Vector(bb);n=max(2,math.ceil((b-a).length/.13))
    for i in range(n+1):
     p=a.lerp(b,i/n)
     for xn in [bounds['left'],0,bounds['right']]:
      for frac in [.10,.25,.50,.75,1.0]:
       yn=height*frac
       # A projected upright actor plane at the foot's world location. Using
       # camera-up as world-up would move its head behind the actual character
       # and incorrectly call the rear factory facade a foreground obstruction.
       q=p+right*xn*W+Vector((0,0,yn*H/up.z));samples+=1
       hit,loc,normal,idx,ob,matrix=scene.ray_cast(deps,q+toward*.015,toward,distance=40)
       if hit:
        expected=ob.name.startswith('walk_') or 'rail' in ob.name or 'stringer' in ob.name
        contacts.append({'route':kind+':'+str(ri),'segment':si,'t':round(i/n,4),'normalizedOffset':[round(xn,6),round(-yn,6)],'bodyFractionAboveFoot':frac,'object':ob.name,'distanceTowardCamera':round((loc-q).length,4),'classification':'path-edge-or-guardrail' if expected else 'equipment-or-scenery'})
 equipment=[c for c in contacts if c['classification']=='equipment-or-scenery'];total_equipment+=len(equipment);total_contacts+=len(contacts);total_samples+=samples
 results.append({**case,'sampleCount':samples,'equipmentContactCount':len(equipment),'pathEdgeContactCount':len(contacts)-len(equipment),'objects':dict(collections.Counter(c['object'] for c in contacts)),'contacts':contacts})
report={'method':'Foreground camera-directed rays through each measured upright projected actor rectangle. Three horizontal samples and five vertical body fractions at every <=0.13 world-unit route step. Rear geometry is excluded by ray direction; support/guardrail contacts are reported separately, never silently discarded.','scope':profiles['scope'],'footNote':'The lowest billboard sample is10% of its height. Foot raster overshoot belongs to the independent world support test. Rectangle edge contacts are conservative and need the actual sprite browser review.','sampleCount':total_samples,'equipmentContactCount':total_equipment,'pathEdgeContactCount':total_contacts-total_equipment,'profiles':results}
json.dump(report,open(os.path.join(DOC,'fabrica-billboard-clearance.json'),'w'),indent=2)
meta['billboardAuditSummary']={k:report[k] for k in ['sampleCount','equipmentContactCount','pathEdgeContactCount']}
print('FABRICA_BILLBOARD='+json.dumps(meta['billboardAuditSummary']))
assert total_samples>0 and total_equipment==0,'Fabrica viewport billboard intersects foreground equipment; inspect report'
