"""Read the native Guaíra source for terrain layout. Does not modify the scene."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/guaira/terrain-polish-2026-10-15';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.view_layer.update();scene=bpy.context.scene
objects=[]
for ob in scene.objects:
    if ob.hide_render or ob.type not in {'MESH','CURVE','FONT'}:continue
    ps=[ob.matrix_world@Vector(p) for p in ob.bound_box]
    objects.append({'name':ob.name,'min':[min(p[i] for p in ps) for i in range(3)],
                    'max':[max(p[i] for p in ps) for i in range(3)]})
data={'objects':objects,'outlines':{},'navigation':json.loads(scene['native_navigation'])}
for name in ['Continuous clay island','STOL continuous irregular landing meadow','Civic terrace','Reservoir support']:
    ob=bpy.data.objects[name];points=[ob.matrix_world@v.co for v in ob.data.vertices];z=max(p.z for p in points)
    data['outlines'][name]=[list(p) for p in points if abs(p.z-z)<1e-5]
(OUT/'scene-input.json').write_text(json.dumps(data,indent=2)+'\n')
print('TERRAIN_INPUT_READY',len(objects),flush=True)
