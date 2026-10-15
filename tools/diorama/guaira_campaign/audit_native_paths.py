"""Geometric QA of the exported, visible Guaíra scene. No geometry mutations."""
import bpy,json,math,argparse,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir',type=Path,default=ROOT/'output/guaira/native-map-2026-10-13')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.output_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;nav=json.loads(scene['native_navigation'])
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
vertices=[];faces=[];owners=[]
for ob in scene.objects:
    if ob.hide_render or ob.type not in {'MESH','CURVE','FONT'}:continue
    ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();offset=len(vertices)
    vertices.extend(ev.matrix_world@v.co for v in me.vertices)
    for tri in me.loop_triangles:faces.append(tuple(offset+i for i in tri.vertices));owners.append(ob.name)
    ev.to_mesh_clear()
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
unsupported=[];blocked=[];samples=0;stage_contacts=[]
for r in nav['routes']:
    for a,b in zip(r['world'],r['world'][1:]):
        a,b=Vector(a),Vector(b);v=b-a
        if Vector((v.x,v.y)).length<1e-6:continue # physical riser, not a tread
        side=Vector((-v.y,v.x,0)).normalized()
        for k in range(max(2,math.ceil(v.length/.04))+1):
            p=a.lerp(b,k/max(2,math.ceil(v.length/.04)));samples+=1
            for offset in (0,-.18,.18):
                q=p+side*offset
                # At a tread boundary the next 9 cm riser is itself the support;
                # start above both treads rather than inside the adjacent solid.
                hit,n,index,d=tree.ray_cast(q+Vector((0,0,.12)),Vector((0,0,-1)),.40)
                if hit is None:unsupported.append({'route':r['id'],'point':list(q)})
            for h in (.3,.72):
                for direction in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0)):
                    hit,n,index,d=tree.ray_cast(p+Vector((0,0,h)),Vector(direction),.20)
                    if hit is not None:blocked.append({'route':r['id'],'object':owners[index],'point':list(p),'height':h})
summary={'routeSamples':samples,'supportProbes':samples*3,'unsupported':unsupported,'bodyContacts':blocked}
(OUT/'geometry-audit.json').write_text(json.dumps(summary,indent=2)+'\n')
print('GUAIRA_GEOMETRY',samples,'samples',len(unsupported),'unsupported',len(blocked),'body contacts')
print('BLOCKERS',sorted(set(r['object'] for r in blocked)))
