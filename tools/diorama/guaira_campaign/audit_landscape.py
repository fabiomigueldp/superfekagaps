"""Read-only revision 3 geometry, camera, water and support verification."""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/guaira/landscape-finish-2026-10-15'
scene=bpy.context.scene;nav=json.loads(scene['native_navigation'])
before=json.loads((OUT/'landscape-input.json').read_text())
bpy.context.view_layer.update()
terrain=bpy.data.objects['Continuous clay island']
top_error=max((terrain.data.vertices[i].co-Vector(p)).length for i,p in before['terrainTop'])
water_error=max((bpy.data.objects[name].matrix_world@v.co-Vector(p)).length
                for name,points in before['waterMeshes'].items()
                for v,p in zip(bpy.data.objects[name].data.vertices,points))
water_counts_same=all(len(bpy.data.objects[name].data.vertices)==len(points) for name,points in before['waterMeshes'].items())
navigation_same=all(nav[k]==before['navigation'][k] for k in ('nodes','junctions','nodeDepths','routes','depth'))
inverse=scene.camera.matrix_world.inverted();projection_errors=[];depth_errors=[]
for route in nav['routes']:
    for world,point,depth in zip(route['world'],route['points'],route['depths']):
        projected=world_to_camera_view(scene,scene.camera,Vector(world))
        projection_errors.extend([abs(projected.x-point['x']),abs(1-projected.y-point['y'])])
        depth_errors.append(abs(-(inverse@Vector(world)).z-depth))
checks=[];new_verts=[];new_faces=[];new_owners=[]
for ob in scene.objects:
    if ob.hide_render or ob.type!='MESH' or not (ob.name=='Continuous clay island' or ob.name.startswith(('Terrain v2 ','Landscape v3 '))):continue
    bm=bmesh.new();bm.from_mesh(ob.data);nonmanifold=sum(not e.is_manifold for e in bm.edges)
    remaining=set(bm.verts);components=0
    while remaining:
        components+=1;pending=[remaining.pop()]
        while pending:
            for edge in pending.pop().link_edges:
                for v in edge.verts:
                    if v in remaining:remaining.remove(v);pending.append(v)
    checks.append({'name':ob.name,'components':components,'nonManifoldEdges':nonmanifold,
                   'degenerateFaces':sum(f.calc_area()<1e-12 for f in bm.faces),'volume':bm.calc_volume(signed=True)})
    bm.free()
    if ob.name.startswith('Landscape v3 '):
        ob.data.calc_loop_triangles();offset=len(new_verts)
        new_verts.extend(ob.matrix_world@v.co for v in ob.data.vertices)
        for t in ob.data.loop_triangles:new_faces.append(tuple(offset+i for i in t.vertices));new_owners.append(ob.name)
new_tree=BVHTree.FromPolygons(new_verts,new_faces,all_triangles=True)
channel=[]
for x in (4.33,4.50,4.67):
    for k in range(33):
        y=1.55+.8*k/32;water_z=y+.31
        p,_,i,_=new_tree.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
        channel.append({'x':x,'y':y,'waterZ':water_z,'solidZ':p.z if p else None,'solid':new_owners[i] if p else None})
terrain.data.calc_loop_triangles()
base_tree=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],
                             [tuple(t.vertices) for t in terrain.data.loop_triangles],all_triangles=True)
probes=[]
for x in [-6.15,-6.03,-5.95,-5.8,-5.6]:
    for y in [-2.5,-1.75,-1.,-.25,.5,1.25,2.]:
        p,_,_,_=base_tree.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),4)
        probes.append({'x':x,'y':y,'height':p.z if p else None})
for x,y in [(6.1,-1.06),(6.1,-2.91),(5.98,-4.16),(4.48,-4.2),(3.49,-4.25),(1.13,-4.38)]:
    p,_,_,_=base_tree.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),4)
    probes.append({'x':x,'y':y,'height':p.z if p else None})
rings=json.loads(scene['landscape_coast_rings'])
report={'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
        'navigationUnchanged':navigation_same,'terrainTopMaximumChange':top_error,
        'waterMeshesUnchanged':water_counts_same and water_error<1e-8,'waterMaximumChange':water_error,
        'maximumProjectionError':max(projection_errors),'maximumDepthErrorMeters':max(depth_errors),
        'closedMeshes':len(checks),'meshes':checks,'seamAndBankProbes':probes,
        'unsupported':sum(p['height'] is None for p in probes),
        'channelProbes':channel,'channelObstructions':[p for p in channel if p['solidZ'] is None or p['solidZ']>p['waterZ']-.009],
        'coastRings':[[list(terrain.data.vertices[i].co) for i in ring] for ring in rings]}
(OUT/'landscape-integrity.json').write_text(json.dumps(report,indent=2)+'\n')
assert navigation_same and top_error<1e-8 and report['waterMeshesUnchanged']
assert not report['unsupported'] and not report['channelObstructions'], report['channelObstructions'][:3]
assert max(projection_errors)<1e-6 and max(depth_errors)<1e-5
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in checks), [r for r in checks if r['components']!=1 or r['nonManifoldEdges'] or r['degenerateFaces'] or r['volume']<=0]
print('LANDSCAPE_INTEGRITY_OK',len(checks),'closed solids;',len(channel),'clear channel probes; terrain top, camera, navigation and water unchanged',flush=True)
