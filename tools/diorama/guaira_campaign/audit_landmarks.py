"""Verify revision 4 solids, route projection, phase ownership and unchanged water/camera."""
import bpy,bmesh,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/phase-landmarks-2026-10-15'
scene=bpy.context.scene;nav=json.loads(scene['native_navigation']);before=json.loads((OUT/'landmark-input.json').read_text())
layout=json.loads((OUT/'landmark-layout.json').read_text());grade=dict(layout['grade']);bpy.context.view_layer.update()
terrain=bpy.data.objects['Continuous clay island'];top_errors=[];changed=[]
for i,p in before['terrainTop']:
    expected=Vector(p);expected.z=grade.get(i,p[2]);top_errors.append((terrain.data.vertices[i].co-expected).length)
    if abs(terrain.data.vertices[i].co.z-p[2])>1e-6:changed.append(i)
water_error=max((bpy.data.objects[name].matrix_world@v.co-Vector(p)).length
    for name,points in before['waterMeshes'].items() for v,p in zip(bpy.data.objects[name].data.vertices,points))
water_same=all(len(bpy.data.objects[name].data.vertices)==len(points) for name,points in before['waterMeshes'].items()) and water_error<1e-8
camera_same=all(abs(scene.camera.matrix_world[i][j]-before['cameraMatrix'][i][j])<1e-8 for i in range(4) for j in range(4))
unmoved=all(nav['nodes'][id]==p for id,p in before['navigation']['nodes'].items() if id!='guaira-lab')
unmoved=unmoved and all(nav['junctions'][id]==p for id,p in before['navigation']['junctions'].items())
inverse=scene.camera.matrix_world.inverted();projection_errors=[];depth_errors=[]
for r in nav['routes']:
    for world,p,d in zip(r['world'],r['points'],r['depths']):
        projected=world_to_camera_view(scene,scene.camera,Vector(world))
        projection_errors.extend([abs(projected.x-p['x']),abs(1-projected.y-p['y'])]);depth_errors.append(abs(-(inverse@Vector(world)).z-d))
checks=[];new_vs=[];new_fs=[];owners=[]
for ob in scene.objects:
    if ob.hide_render or ob.type!='MESH' or not (ob.name=='Continuous clay island' or ob.name.startswith(('Terrain v2 ','Landscape v3 ','Landmark v4 '))):continue
    bm=bmesh.new();bm.from_mesh(ob.data);remaining=set(bm.verts);components=0
    while remaining:
        components+=1;pending=[remaining.pop()]
        while pending:
            for e in pending.pop().link_edges:
                for v in e.verts:
                    if v in remaining:remaining.remove(v);pending.append(v)
    checks.append({'name':ob.name,'components':components,'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),
        'degenerateFaces':sum(f.calc_area()<1e-12 for f in bm.faces),'volume':bm.calc_volume(signed=True)});bm.free()
    if ob.name.startswith(('Landscape v3 ','Landmark v4 ')):
        ob.data.calc_loop_triangles();offset=len(new_vs);new_vs.extend(ob.matrix_world@v.co for v in ob.data.vertices)
        for t in ob.data.loop_triangles:new_fs.append(tuple(offset+i for i in t.vertices));owners.append(ob.name)
tree=BVHTree.FromPolygons(new_vs,new_fs,all_triangles=True);channel=[]
for x in (4.33,4.50,4.67):
    for k in range(33):
        y=1.55+.8*k/32;p,_,i,_=tree.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
        channel.append({'x':x,'y':y,'waterZ':y+.31,'solidZ':p.z if p else None,'solid':owners[i] if p else None})
terrain.data.calc_loop_triangles();base=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],[tuple(t.vertices) for t in terrain.data.loop_triangles],all_triangles=True)
footings=[]
for ob in scene.objects:
    if ob.hide_render or not ob.name.startswith('Landmark v4 ') or not any(s in ob.name for s in ('stone post shoe','founded stone shoe','controls foundation','vents service bank','lift footing','compacted corral court')):continue
    bb=[ob.matrix_world@Vector(p) for p in ob.bound_box];x=sum(p.x for p in bb)/8;y=sum(p.y for p in bb)/8;bottom=min(p.z for p in bb)
    hit,_,_,_=base.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
    footings.append({'object':ob.name,'terrainZ':hit.z if hit else None,'bottom':bottom,'unsupported':not hit or bottom>hit.z+.012})
landmarks=[]
for id,landmark in nav['landmarks'].items():
    marker=bpy.data.objects['ENTRADA | '+id];col=bpy.data.collections[landmark['collection']]
    objs=[o for o in col.objects if not o.hide_render and o.type=='MESH']
    landmarks.append({'id':id,'meshes':len(objs),'markerError':(marker.location-Vector(landmark['arrivalWorld'])).length,
        'owned':all(o.get('stage_id')==id for o in col.objects)})
report={'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'cameraUnchanged':camera_same,
    'unaffectedEntrancesUnchanged':unmoved,'courtVerticesChanged':len(changed),'maximumTerrainLayoutError':max(top_errors),
    'waterMeshesUnchanged':water_same,'waterMaximumChange':water_error,'maximumProjectionError':max(projection_errors),
    'maximumDepthErrorMeters':max(depth_errors),'closedMeshes':len(checks),'meshes':checks,'landmarks':landmarks,
    'footings':footings,'unsupported':sum(p['unsupported'] for p in footings),'channelProbes':channel,
    'channelObstructions':[p for p in channel if p['solidZ'] is None or p['solidZ']>p['waterZ']-.009],
    'coastRings':[[list(terrain.data.vertices[i].co) for i in ring] for ring in json.loads(scene['landscape_coast_rings'])]}
(OUT/'landmark-integrity.json').write_text(json.dumps(report,indent=2)+'\n')
assert camera_same and unmoved and water_same and max(top_errors)<1e-6
assert max(projection_errors)<1e-6 and max(depth_errors)<1e-5
assert not report['unsupported'] and not report['channelObstructions']
assert len(landmarks)==8 and all(l['meshes']>0 and l['markerError']<1e-6 and l['owned'] for l in landmarks)
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in checks)
print('LANDMARK_INTEGRITY_OK',len(checks),'closed solids;',len(footings),'founded bases; 8 measured phase locations',flush=True)
