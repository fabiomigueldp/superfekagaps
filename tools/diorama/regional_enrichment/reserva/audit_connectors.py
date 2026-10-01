"""Test only new geometry against existing connector passengers and envelopes."""
import argparse,collections,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--scene',required=True);p.add_argument('--output-dir',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);HERE=Path(__file__).resolve().parent;out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(a.scene).resolve()));sc=bpy.context.scene;cam=sc.camera;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
meta=json.loads(sc['reserva_metadata']);source=json.loads((HERE/'source/feka-sprite.json').read_text());dock=json.loads((HERE/'source/dock.meta.json').read_text())['islands']['reserva'];terminal=json.loads((HERE/'source/terminal.meta.json').read_text())
paths=[('ferry-junction-and-boarding',[p['world'] for p in dock['junctionToDock']+dock['boardingRoute'][1:]])]
def project(p):
 q=world_to_camera_view(sc,cam,Vector(p));return Vector((q.x,1-q.y))
zero=project((0,0,0));bases=[project(p)-zero for p in [(1,0,0),(0,1,0),(0,0,1)]];inv=Matrix(((bases[0].x,bases[1].x),(bases[0].y,bases[1].y))).inverted()
def unproject(p,z=1.35):
 q=inv@(Vector((p['x'],p['y']))-zero-bases[2]*z);return [q.x,q.y,z]
paths.append(('passenger-stage-platform',[unproject(p) for p in terminal['stations']['upper']['stageToPlatform']]))
for k,lane in terminal['lanes'].items():paths.append(('passenger-boarding-'+k,[unproject(p) for p in lane['upper']['boardingRoute']]))
verts=[];triangles=[];names=[];solids=[]
for o in sc.objects:
 if not o.get('enrichment_group') or o.type not in {'MESH','CURVE'}:continue
 ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();vv=[o.matrix_world@v.co for v in me.vertices];tt=[tuple(t.vertices) for t in me.loop_triangles];offset=len(verts);verts+=vv;triangles.extend([tuple(offset+i for i in t) for t in tt]);names += [o.name]*len(tt)
 solids.append((o.name,BVHTree.FromPolygons(vv,tt,all_triangles=True),[min(v[i] for v in vv) for i in range(3)],[max(v[i] for v in vv) for i in range(3)]));ev.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,triangles,all_triangles=True)
right,up,toward=[cam.rotation_euler.to_matrix()@Vector(v) for v in [(1,0,0),(0,1,0),(0,0,1)]];pixel=source['pixelMapWidth']*cam.data.ortho_scale
opaque=set()
for rows in source['frames'].values():
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,c in enumerate(row):
    if c=='_':continue
    xx=15-x if flip else x
    for fx,fy in [(.5,.5),(.08,.08),(.92,.08),(.08,.92),(.92,.92)]:opaque.add((xx+fx-8,26-y-fy))
contacts=collections.Counter();footcontacts=collections.Counter();body=collections.Counter();examples={};samples=0;rays=0
for name,path in paths:
 for si,(aa,bb) in enumerate(zip(path,path[1:])):
  aa,bb=Vector(aa),Vector(bb);steps=max(2,math.ceil((bb-aa).length/.08));side=Vector((-(bb-aa).y,(bb-aa).x,0)).normalized()
  for j in range(steps+1):
   f=aa.lerp(bb,j/steps);samples+=1
   for lateral in [-.28,0,.28]:
    q=f+side*lateral;hit=bvh.ray_cast(q+Vector((0,0,.16)),Vector((0,0,1)),1.00)
    if hit[0] is not None:body[names[hit[2]]]+=1
    for on,ob,lo,hi in solids:
     for z in [.2,.5,.85]:
      pp=q+Vector((0,0,z))
      if all(lo[k]<pp[k]<hi[k] for k in range(3)):
       # Nearest inward face sign is diagnostic for closed authored convex details.
       near,normal,idx,dist=ob.find_nearest(pp)
       if near is not None and (pp-near).dot(normal)<-.002:body[on]+=1
   for px,py in opaque:
    q=f+right*(px*pixel)+Vector((0,0,py*pixel/up.z));hit=bvh.ray_cast(q+toward*.012,toward,40);rays+=1
    if hit[0] is not None:
     on=names[hit[2]];(contacts if py>2 else footcontacts)[on]+=1;examples.setdefault(on,{'route':name,'segment':si,'t':j/steps,'sourceHeightPixels':py})
report={'status':'PASS' if not contacts and not body else 'FAIL','scope':'New props/ice only versus unchanged Reserva ferry junction, descending pier, boarding lip, passenger platform and both cableway boarding routes. Original actor idle and six walk frames, two facings, five probes per opaque cell; additional closed-solid/body checks. This does not replace the integrated ferry64 sailing/compositing audit.','pathCount':len(paths),'routeSamples':samples,'sourceMaskRays':rays,'newBodyScreenContacts':dict(contacts),'newFootScreenContacts':dict(footcontacts),'newBodyOrHeadroomContacts':dict(body),'firstExamples':examples,'paths':paths}
(out/'connector-clearance.json').write_text(json.dumps(report,indent=2)+'\n');print('CONNECTORS='+json.dumps({k:v for k,v in report.items() if k!='paths'}));assert report['status']=='PASS'
