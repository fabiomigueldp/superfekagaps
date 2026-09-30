"""Read-only projected actor clearance for a cached or freshly built connector.

blender -b /tmp/feka-journey/costa/journey-dock.blend -P tools/diorama/check_journey_projection.py -- costa
Blender's evaluated geometry, camera rays and the real 48x78-atlas-pixel actor
envelope are used; this is independent of the vertical support/headroom audit.
"""
import bpy, json, os, sys, math
from mathutils import Vector

island=JOURNEY_ISLAND if 'JOURNEY_ISLAND' in globals() else ('porto' if 'porto' in sys.argv else 'costa')
path=f'/tmp/feka-journey/{island}/dock.meta.json'
meta=JOURNEY_META if 'JOURNEY_META' in globals() else json.load(open(path))
scene=bpy.context.scene;cam=scene.camera
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
right=cam.matrix_world.to_quaternion()@Vector((1,0,0))
up=cam.matrix_world.to_quaternion()@Vector((0,1,0))
forward=cam.matrix_world.to_quaternion()@Vector((0,0,-1))
half_width=(48/384*4.15)/2
height=78/384*4.15
conflicts=[];lower_contacts=[];samples=0
route=meta.get('junctionToDock',meta['approach'])+meta['boardingRoute'][1:]
for si,(aa,bb) in enumerate(zip(route,route[1:])):
    a,b=Vector(aa['world']),Vector(bb['world']);n=max(2,math.ceil((b-a).length/.08))
    for i in range(n+1):
        foot=a.lerp(b,i/n)
        for frac in [.38,.64,.88]:
            for side in [-.66,0,.66]:
                target=foot+up*height*frac+right*half_width*side
                hit,loc,normal,face,obj,matrix=scene.ray_cast(deps,target-forward*60,forward,distance=59.96)
                samples+=1
                if hit:
                    issue={'segment':si,'t':round(i/n,3),'heightFraction':frac,'side':side,'hit':obj.name,'worldFoot':[round(v,5) for v in foot]}
                    (lower_contacts if frac==.38 else conflicts).append(issue)
report={'method':'Orthographic camera rays through a billboard envelope matching the 48x78 pixel original Feka used in the boat proof. Three width positions at 38%, 64% and 88% of actor height, every ≤0.08 world units on new junction/dock/boarding paths. Lower guardrail contact is reported separately from upper-body blockage.','sampleCount':samples,'upperBodyConflictCount':len(conflicts),'lowerBodyContactCount':len(lower_contacts),'upperBodyConflicts':conflicts,'lowerBodyContacts':lower_contacts}
meta['projectedClearance']=report
with open(path,'w') as handle:json.dump(meta,handle,indent=2)
print('JOURNEY_PROJECTED_AUDIT='+json.dumps({key:value for key,value in report.items() if not isinstance(value,list)}))
