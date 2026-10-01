from pathlib import Path
import bpy,json,os
from mathutils import Vector
O=Path(os.environ.get('FEKA_FACTORY_SERRA_OUT','/tmp/feka-factory-serra-link'));bpy.ops.wm.open_mainfile(filepath=str(O/'factory-serra-open.blend'));s=bpy.context.scene;bpy.context.view_layer.update()
def bounds(o):
 vs=[o.matrix_world@Vector(v) for v in o.bound_box];return [[min(v[j] for v in vs) for j in range(3)],[max(v[j] for v in vs) for j in range(3)]]
footings=[(o,bounds(o)) for o in s.objects if o.get('new_link') and 'anchored stone footing' in o.name];slabs=[(o,bounds(o)) for o in s.objects if o.get('new_link') and (o.name.startswith('walk_') or 'crosshead' in o.name or 'stringer' in o.name)];result=[]
for ob in s.objects:
 if not ob.get('new_link') or 'rooted steel pile' not in ob.name:continue
 lo,hi=bounds(ob);x,y=ob.location.x,ob.location.y
 anchors=[o.name for o,(a,b) in footings if a[0]-.001<=x<=b[0]+.001 and a[1]-.001<=y<=b[1]+.001 and a[2]-.001<=lo[2]<=b[2]+.001]
 above=[o.name for o,(a,b) in slabs if a[0]-.12<=x<=b[0]+.12 and a[1]-.12<=y<=b[1]+.12 and a[2]-.12<=hi[2]<=b[2]+.12]
 result.append({'pile':ob.name,'baseZ':lo[2],'topZ':hi[2],'rootFootings':anchors,'bearingMembers':above})
report={'method':'Independent evaluated world bounding boxes: every vertical steel pile base is embedded in a stone footing and its top intersects a deck/stringer/crosshead envelope. This validates modeled engineered support connectivity, not geotechnical seabed depth.','pileCount':len(result),'unrootedCount':sum(not x['rootFootings'] for x in result),'missingBearingCount':sum(not x['bearingMembers'] for x in result),'piles':result,'booleanModifierCount':sum(m.type=='BOOLEAN' for o in s.objects for m in o.modifiers)}
(O/'audit-structure.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='piles'}))
