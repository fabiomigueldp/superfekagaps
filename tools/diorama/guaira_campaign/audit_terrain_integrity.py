"""Read-only validation of the continuous coast and retained authored anchors."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/terrain-polish-2026-10-15'
scene=bpy.context.scene;nav=json.loads(scene['native_navigation'])
before=json.loads((ROOT/'docs/world/guaira/native-map-2026-10-13/navigation.json').read_text())
navigation_same=all(nav[k]==before[k] for k in ('nodes','junctions','nodeDepths','routes','depth'))
bpy.context.view_layer.update();inverse=scene.camera.matrix_world.inverted()
projection_errors=[];depth_errors=[]
for route in nav['routes']:
    for world,point,depth in zip(route['world'],route['points'],route['depths']):
        projected=world_to_camera_view(scene,scene.camera,Vector(world))
        projection_errors.extend([abs(projected.x-point['x']),abs(1-projected.y-point['y'])])
        depth_errors.append(abs(-(inverse@Vector(world)).z-depth))
checks=[]
for ob in scene.objects:
    if ob.hide_render or ob.type!='MESH' or not (ob.name=='Continuous clay island' or ob.name.startswith('Terrain v2 ')):continue
    bm=bmesh.new();bm.from_mesh(ob.data);nonmanifold=sum(not e.is_manifold for e in bm.edges)
    # Component count detects a detached shell hidden behind a visually clean
    # render. Degenerate faces would corrupt shading and depth at the seams.
    remaining=set(bm.verts);components=0
    while remaining:
        components+=1;pending=[remaining.pop()]
        while pending:
            for edge in pending.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in remaining:remaining.remove(vertex);pending.append(vertex)
    row={'name':ob.name,'components':components,'nonManifoldEdges':nonmanifold,
         'degenerateFaces':sum(f.calc_area()<1e-12 for f in bm.faces),'volume':bm.calc_volume(signed=True)}
    checks.append(row);bm.free()
base=bpy.data.objects['Continuous clay island'];base.data.calc_loop_triangles()
tree=BVHTree.FromPolygons([base.matrix_world@v.co for v in base.data.vertices],
    [tuple(t.vertices) for t in base.data.loop_triangles],all_triangles=True)
# Interrogate the former model/platform seam and working-field perimeter,
# rather than just points conveniently chosen on the new triangles.
probes=[]
for x in [-6.15,-6.03,-5.95,-5.8,-5.6]:
    for y in [-2.5,-1.75,-1.,-.25,.5,1.25,2.]:
        p,n,_,_=tree.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),4)
        probes.append({'x':x,'y':y,'height':None if p is None else p.z})
for x,y in [(6.1,-1.06),(6.1,-2.91),(5.98,-4.16),(4.48,-4.2),(3.49,-4.25),(1.13,-4.38)]:
    p,n,_,_=tree.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),4)
    probes.append({'x':x,'y':y,'height':None if p is None else p.z})
report={'navigationUnchanged':navigation_same,'closedMeshes':len(checks),'meshes':checks,
        'maximumProjectionError':max(projection_errors),'maximumDepthErrorMeters':max(depth_errors),
        'seamAndBankProbes':probes,'unsupported':sum(p['height'] is None for p in probes)}
(OUT/'terrain-integrity.json').write_text(json.dumps(report,indent=2)+'\n')
assert navigation_same and not report['unsupported']
assert max(projection_errors)<1e-6 and max(depth_errors)<1e-5,'Scene camera no longer matches the exported journey'
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in checks)
print('TERRAIN_INTEGRITY_OK',len(checks),'closed connected meshes',len(probes),'supported seam/bank points',flush=True)
