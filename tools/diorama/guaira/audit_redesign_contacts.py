"""Independent representative load-path contacts against evaluated real terrain.
blender -b FINAL.blend -P audit_redesign_contacts.py -- --output report.json
Only the selected actual foundation/post bottoms are sampled; roofs, decorative
cliff panels, roads and water cannot count as supporting ground.
"""
import bpy,json,sys,argparse
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);scene=bpy.context.scene
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
terrain={'Continuous clay island','Civic terrace','Civic continuous earthen ascent','Reservoir support','STOL continuous irregular landing meadow'}
vs=[];fs=[];owners=[];solids=[]
for ob in scene.objects:
    if ob.name not in terrain or ob.hide_render:continue
    ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();offset=len(vs)
    local_vertices=[ev.matrix_world@v.co for v in me.vertices]
    local_faces=[tuple(face.vertices) for face in me.loop_triangles]
    solids.append((ob.name,BVHTree.FromPolygons(local_vertices,local_faces,all_triangles=True)))
    vs.extend(local_vertices)
    for face in me.loop_triangles:fs.append(tuple(offset+i for i in face.vertices));owners.append(ob.name)
    ev.to_mesh_clear()
tree=BVHTree.FromPolygons(vs,fs,all_triangles=True)
prefixes=('Neighborhood home foundation','Repair shop foundation','Small granary foundation','Casa da Vazao foundation',
          'Neighborhood home threshold','Repair shop threshold','Small granary threshold','Casa da Vazao threshold',
          'Porch column foot','Civic base plinth','Tank grounded stone foot','Repair bay seated timber post',
          'Workbench four grounded legs','Windpump grounded timber leg','Manifold grounded masonry shoe','Reservoir grounded deck post',
          'STOL seated shelter timber post','STOL grounded bench leg','STOL earth boarding trail')
def containing_ground(point):
    # A seated post can legitimately extend into sloped closed rock. Starting
    # a short downward ray inside that volume would miss its upper surface.
    # Test actual solid containment, rather than relaxing the maximum air gap.
    for name,solid in solids:
        origin=point+Vector((0,0,.00001));crossings=0;first=None
        for _ in range(32):
            hit,normal,index,distance=solid.ray_cast(origin,Vector((0,0,1)),20)
            if index is None:break
            if first is None:first=hit
            crossings+=1;origin=hit+Vector((0,0,.0001))
        if crossings%2:return name,first
    return None,None
checks=[];failures=[]
for ob in scene.objects:
    if not ob.name.startswith(prefixes):continue
    ev=ob.evaluated_get(deps);me=ev.to_mesh();vertices=[ev.matrix_world@v.co for v in me.vertices];bottom=min(v.z for v in vertices)
    low=[v for v in vertices if v.z<bottom+.006];ev.to_mesh_clear()
    x0,x1=min(v.x for v in low),max(v.x for v in low);y0,y1=min(v.y for v in low),max(v.y for v in low)
    # Inside the actual evaluated bottom envelope, away from beveled perimeters.
    for u,v in [(.5,.5),(.2,.2),(.8,.2),(.2,.8),(.8,.8)]:
        x=x0+(x1-x0)*u;y=y0+(y1-y0)*v
        hit,normal,index,distance=tree.ray_cast(Vector((x,y,bottom+.08)),Vector((0,0,-1)),.25)
        inside_name,exit_point=containing_ground(Vector((x,y,bottom)))
        if inside_name:hit=exit_point
        gap=bottom-hit.z if hit is not None else None
        item={'object':ob.name,'xy':[round(x,4),round(y,4)],'bottomZ':round(bottom,5),'groundZ':round(hit.z,5) if hit is not None else None,'groundObject':inside_name or (owners[index] if index is not None else None),'contactMode':'embedded-in-closed-solid' if inside_name else 'surface','gap':round(gap,5) if gap is not None else None}
        checks.append(item)
        if not inside_name and (gap is None or gap>.008):failures.append(item)
assert checks,'No redesigned building contacts found'
report={'method':'Independent evaluated foundation-bottom points; downward rays restricted to actual terrain, excluding buildings/roads/water','objects':len(set(v['object'] for v in checks)),'probes':len(checks),'failures':failures,'embeddedContacts':sum(v['contactMode']=='embedded-in-closed-solid' for v in checks),'checks':checks}
json.dump(report,open(a.output,'w'),indent=2)
print(json.dumps({k:v if k not in {'checks','failures'} else len(v) for k,v in report.items()}))
assert not failures,'Floating foundation contact: see report'
