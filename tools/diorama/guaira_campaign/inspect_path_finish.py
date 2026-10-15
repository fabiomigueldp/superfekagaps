"""Export revision 5 contracts and actual paving boundaries for the path pass."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/path-finish-2026-10-15'
OUT.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;bpy.context.view_layer.update()
rows=[];paving=[]
for ob in scene.objects:
    if ob.hide_render or ob.type not in ('MESH','CURVE'):continue
    bb=[ob.matrix_world@Vector(p) for p in ob.bound_box]
    low=[min(p[i] for p in bb) for i in range(3)];high=[max(p[i] for p in bb) for i in range(3)]
    rows.append({'name':ob.name,'min':low,'max':high,'materials':[m.name if m else None for m in ob.data.materials]})
    if ob.name.startswith('Finish v5 joined ground paving'):
        ob.data.calc_loop_triangles()
        paving.extend([[list((ob.matrix_world@ob.data.vertices[i].co)[:2]) for i in t.vertices]
            for t in ob.data.loop_triangles if all(abs((ob.matrix_world@ob.data.vertices[i].co).z-1.835)<1e-5 for i in t.vertices)])
terrain=bpy.data.objects['Continuous clay island']
water={ob.name:[list(ob.matrix_world@v.co) for v in ob.data.vertices]
       for ob in scene.objects if not ob.hide_render and ob.type=='MESH' and any(m and m.name=='Clean turquoise water' for m in ob.data.materials)}
data={'objects':rows,'paving':paving,'terrain':[list(v.co) for v in terrain.data.vertices],'water':water,
      'navigation':json.loads(scene['native_navigation']),'camera':[list(r) for r in scene.camera.matrix_world],
      'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()}
(OUT/'path-input.json').write_text(json.dumps(data)+'\n')
print('PATH_FINISH_INPUT',len(rows),'visible objects',flush=True)
for row in rows:
    low,high=row['min'],row['max']
    if (2.3<low[0] and high[0]<3.9 and -2.6<low[1] and high[1]<-1.0) or 'bridge' in row['name'].lower():print(row)
