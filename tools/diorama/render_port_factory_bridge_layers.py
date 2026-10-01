"""Export compact, same-camera prototype layers exclusively to local staging."""
from pathlib import Path
import bpy,json,sys,os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('FEKA_BRIDGE_OUT','/tmp/feka-port-factory-bridge'));EXPORT=OUT/'export';EXPORT.mkdir(parents=True,exist_ok=True)
mode=sys.argv[-1] if sys.argv[-1] in ['open','closed','factory'] else 'open'
if mode=='factory':
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'factory-source-clean.blend'))
    scene=bpy.context.scene;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.cycles.samples=96;scene.render.filepath=str(EXPORT/'fabrica-diorama.png')
    bpy.ops.render.render(write_still=True)
else:
    filename='cargo-bridge.blend' if mode=='open' else 'cargo-bridge-raised.blend'
    bpy.ops.wm.open_mainfile(filepath=str(OUT/filename))
    scene=bpy.context.scene;cam=scene.camera
    # Integer source raster:2.1*1920=4032 and1.24*1200=1488. Camera center
    # remains identical to the approved review; bounds are atlas(1.01,-.22).
    cam.data.ortho_scale=20.6*2.1;scene.render.resolution_x=4032;scene.render.resolution_y=1488;scene.render.resolution_percentage=100
    scene.cycles.samples=48
    groups={'porto':[],'fabrica':[]}
    for ob in scene.objects:
        if ob.type not in {'MESH','CURVE','FONT'}:continue
        if 'bridge ' not in ob.name:ob.is_holdout=True
        elif 'bridge Porto ' in ob.name or ob.name.startswith(('bridge hinge concrete','bridge visible pivot')):groups['porto'].append(ob)
        elif 'bridge receiving ' in ob.name:groups['fabrica'].append(ob)
    bpy.context.view_layer.update()
    def bounds(objs,origin):
        pts=[]
        for ob in objs:
            for v in ob.bound_box:
                p=world_to_camera_view(scene,cam,ob.matrix_world@Vector(v))
                pts.append((1.01+p.x*2.1-origin[0],-.22+(1-p.y)*1.24-origin[1]))
        return {'left':round(min(p[0] for p in pts)-.004,6),'top':round(min(p[1] for p in pts)-.004,6),'right':round(max(p[0] for p in pts)+.004,6),'bottom':round(max(p[1] for p in pts)+.004,6)}
    (EXPORT/f'{mode}-approach-bounds.json').write_text(json.dumps({k:bounds(v,(1.1,-.12) if k=='porto' else (1.98,.03)) for k,v in groups.items()},indent=2)+'\n')
    scene.render.filepath=str(EXPORT/f'port-factory-bridge-{mode}.png');bpy.ops.render.render(write_still=True)
print('BRIDGE_EXPORT='+mode)
