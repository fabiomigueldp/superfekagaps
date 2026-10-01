"""Fresh ray checks and pixels for the lowered/raised local prototype."""
from pathlib import Path
import bpy,json,math,sys,os
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('FEKA_BRIDGE_OUT','/tmp/feka-port-factory-bridge'));REPO=ROOT
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cargo-bridge.blend'))
scene=bpy.context.scene;cam=scene.camera;meta=json.loads((OUT/'cargo-bridge.meta.json').read_text())
# First review caught coplanar pad seams. Lift only the new pads 0.025 units;
# both remain fully supported, with a 0.025-unit walking threshold.
if not scene.get('bridge_pad_fix'):
    for ob in scene.objects:
        if 'bridge Porto hinge turn pad' in ob.name or 'bridge receiving turn pad' in ob.name:ob.location.z+=.025
    scene['bridge_pad_fix']=True
basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1))
half_width=(48/384*4.15)/2;height=78/384*4.15
def audit(paths,only_bridge=False):
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();samples=0;contacts=[]
    for name,path in paths:
        for si,(aa,bb) in enumerate(zip(path,path[1:])):
            a,b=Vector(aa),Vector(bb);n=max(2,math.ceil((b-a).length/.08))
            for i in range(n+1):
                p=a.lerp(b,i/n)
                for frac in [.10,.25,.38,.64,.88,1.0]:
                    for side in [-1,-.5,0,.5,1]:
                        q=p+right*half_width*side+up*height*frac;samples+=1
                        hit,loc,normal,face,ob,matrix=scene.ray_cast(deps,q+toward*.015,toward,distance=40)
                        if hit and (not only_bridge or 'bridge ' in ob.name):
                            contacts.append({'route':name,'segment':si,'t':round(i/n,4),'bodyFraction':frac,'side':side,'object':ob.name})
    upper=[c for c in contacts if c['bodyFraction']>=.38]
    return {'sampleCount':samples,'upperBodyContactCount':len(upper),'lowerBodyContactCount':len(contacts)-len(upper),'upperBodyContacts':upper,'lowerBodyContacts':[c for c in contacts if c['bodyFraction']<.38]}
lowered=audit([('new crossing',meta['pathPortoAuthoringWorld'])])
scene.render.filepath=str(OUT/'port-factory-lowered-bridge.png');scene.cycles.samples=32
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cargo-bridge.blend'));bpy.ops.render.render(write_still=True)
# A simple raised candidate is enough to test the existing port circulation.
# This demonstrates two physical states; no animation has been integrated.
a,b=Vector(meta['movingSpan']['start']),Vector(meta['movingSpan']['end']);d=b-a;axis=Vector((-d.y,d.x,0)).normalized();pivot=a-Vector((0,0,.12))
transform=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-70),4,axis)@Matrix.Translation(-pivot)
moving=[]
for ob in scene.objects:
    if 'lowered moving cargo span' in ob.name:
        ob.matrix_world=transform@ob.matrix_world;moving.append(ob.name)
port=json.loads((REPO/'public/assets/world/map/porto-diorama.meta.json').read_text())
paths=[(f'original {kind}:{i}',r['world']) for kind,routes in port['worldRoutes'].items() for i,r in enumerate(routes)]
raised=audit(paths,only_bridge=True)
scene.render.filepath=str(OUT/'port-factory-raised-bridge.png');bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cargo-bridge-raised.blend'));bpy.ops.render.render(write_still=True)
report={'status':'prototype geometry only','billboardContract':'WorldAtlasArt.ts atlasActorScale: 16×26 original Feka at 3× pixels in boat frame 384px / orthoScale4.15. Fixed world envelope: width0.51875, projected height0.842969. Samples five widths and six body heights every≤0.08 world unit.','loweredCrossing':lowered,'raisedAngleDegrees':70,'raisedOriginalPortRoutesNewBridgeContacts':raised,'movingObjectCount':len(moving),'limitation':'Runtime/browser interaction, walk frame raster edges, collision gating and lowering animation are not part of this prototype. Low-body contacts are reported, not silently dismissed.'}
(OUT/'bridge-states-billboard-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('BILLBOARD_SUMMARY='+json.dumps({k:({a:b for a,b in v.items() if not isinstance(b,list)} if isinstance(v,dict) else v) for k,v in report.items()}))
