"""Read-only geometry, cavities and native-map contract checks for revision 6."""
import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/path-finish-2026-10-15'
scene=bpy.context.scene;before=json.loads((OUT/'path-input.json').read_text());model=json.loads((OUT/'model-report.json').read_text());nav=json.loads(scene['native_navigation']);bpy.context.view_layer.update()
terrain=bpy.data.objects['Continuous clay island'];terrain_error=max((v.co-Vector(p)).length for v,p in zip(terrain.data.vertices,before['terrain']))
water_error=max((bpy.data.objects[name].matrix_world@v.co-Vector(p)).length for name,ps in before['water'].items() for v,p in zip(bpy.data.objects[name].data.vertices,ps))
water_same=all(len(bpy.data.objects[name].data.vertices)==len(ps) for name,ps in before['water'].items()) and water_error<1e-8
camera_same=all(abs(scene.camera.matrix_world[i][j]-before['camera'][i][j])<1e-8 for i in range(4) for j in range(4))
navigation_same=all(nav[k]==before['navigation'][k] for k in ('nodes','junctions','nodeDepths','routes'))
landmark_positions_same=all(all(l[k]==before['navigation']['landmarks'][id][k] for k in ('arrivalWorld','anchorWorld','anchor','place','cue','kind')) for id,l in nav['landmarks'].items())
inv=scene.camera.matrix_world.inverted();projection_errors=[];depth_errors=[]
for r in nav['routes']:
    for world,p,d in zip(r['world'],r['points'],r['depths']):
        projected=world_to_camera_view(scene,scene.camera,Vector(world));projection_errors.extend([abs(projected.x-p['x']),abs(1-projected.y-p['y'])]);depth_errors.append(abs(-(inv@Vector(world)).z-d))
checks=[];vs=[];fs=[];owners=[];solid_vs=[];solid_fs=[];solid_owners=[];deps=bpy.context.evaluated_depsgraph_get()
for ob in scene.objects:
    if ob.hide_render or ob.type not in ('MESH','CURVE','FONT'):continue
    if ob.type=='MESH' and (ob.name=='Continuous clay island' or ob.name.startswith(('Terrain v2 ','Landscape v3 ','Landmark v4 ','Finish v5 ','Path v6 '))):
        bm=bmesh.new();bm.from_mesh(ob.data);remaining=set(bm.verts);components=0
        while remaining:
            components+=1;pending=[remaining.pop()]
            while pending:
                for e in pending.pop().link_edges:
                    for v in e.verts:
                        if v in remaining:remaining.remove(v);pending.append(v)
        checks.append({'name':ob.name,'components':components,'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-12 for f in bm.faces),'volume':bm.calc_volume(signed=True)});bm.free()
    ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();offset=len(vs);vs.extend(ev.matrix_world@v.co for v in me.vertices)
    for t in me.loop_triangles:fs.append(tuple(offset+i for i in t.vertices));owners.append(ob.name)
    if ob.name.startswith(('Landscape v3 ','Landmark v4 ','Finish v5 ','Path v6 ')):
        offset=len(solid_vs);solid_vs.extend(ev.matrix_world@v.co for v in me.vertices)
        for t in me.loop_triangles:solid_fs.append(tuple(offset+i for i in t.vertices));solid_owners.append(ob.name)
    ev.to_mesh_clear()
tree=BVHTree.FromPolygons(vs,fs,all_triangles=True);channel_tree=BVHTree.FromPolygons(solid_vs,solid_fs,all_triangles=True)
terrain.data.calc_loop_triangles();base=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],[tuple(t.vertices) for t in terrain.data.loop_triangles],all_triangles=True)
footings=[]
for f in model['foundedBases']:
    p,_,_,_=base.ray_cast(Vector((f['x'],f['y'],4)),Vector((0,0,-1)),5)
    footings.append({**f,'terrainZ':p.z if p else None,'unsupported':not p or f['bottom']>p.z+.012})
cavities=[]
for c in model['cavities']:
    p,_,i,_=tree.ray_cast(Vector((c['x'],c['y'],c['rimZ']-.015)),Vector((0,0,-1)),.5)
    cavities.append({**c,'measuredFloor':p.z if p else None,'hit':owners[i] if p else None,'depth':c['rimZ']-p.z if p else None})
# The revised solid fixtures must not cover the old, intentional water mesh.
channel=[]
for x in (4.33,4.50,4.67):
    for k in range(33):
        y=1.55+.8*k/32;water_z=y+.31;p,_,i,_=channel_tree.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
        channel.append({'x':x,'y':y,'waterZ':water_z,'solidZ':p.z if p else None,'solid':solid_owners[i] if p else None})
landmarks=[]
for id,l in nav['landmarks'].items():
    col=bpy.data.collections[l['collection']];marker=bpy.data.objects['ENTRADA | '+id]
    landmarks.append({'id':id,'meshes':sum(o.type=='MESH' and not o.hide_render for o in col.objects),'owned':all(o.get('stage_id')==id for o in col.objects),'markerError':(marker.location-Vector(l['arrivalWorld'])).length})
# Verify the structural underside above the public-water culvert, not just the
# walking surface on top of it. Guard posts and stone heads stay at its banks.
bridge_water=[]
for x in (2.67,2.70,2.73,3.47,3.50,3.53):
    for y in (-1.85,-1.74,-1.63):
        water_z=1.77405;p,_,i,_=tree.ray_cast(Vector((x,y,water_z+.001)),Vector((0,0,1)),.3)
        bridge_water.append({'x':x,'y':y,'clearance':p.z-water_z if p else None,'underside':owners[i] if p else None})
assert all(p['clearance'] and p['clearance']>.015 for p in bridge_water),bridge_water
report={'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'navigationUnchanged':navigation_same,'landmarkPositionsUnchanged':landmark_positions_same,
    'terrainMaximumChange':terrain_error,'cameraUnchanged':camera_same,'waterMeshesUnchanged':water_same,'waterMaximumChange':water_error,
    'maximumProjectionError':max(projection_errors),'maximumDepthErrorMeters':max(depth_errors),'closedMeshes':len(checks),'meshes':checks,
    'footings':footings,'unsupportedBases':sum(f['unsupported'] for f in footings),'cavities':cavities,'landmarks':landmarks,'channelProbes':channel,'bridgeWaterClearance':bridge_water,
    'unsupportedChannel':sum(p['solidZ'] is None or p['solidZ']<p['waterZ']-.08 for p in channel),
    'channelObstructions':[p for p in channel if p['solidZ'] is not None and p['solidZ']>p['waterZ']-.009]}
(OUT/'path-integrity.json').write_text(json.dumps(report,indent=2)+'\n')
assert navigation_same and landmark_positions_same and camera_same and water_same and terrain_error<1e-8
assert not report['unsupportedBases'] and not report['unsupportedChannel'] and not report['channelObstructions']
assert all(c['depth'] and c['depth']>.10 and abs(c['measuredFloor']-c['floorZ'])<.01 for c in cavities),cavities
assert all(l['owned'] and l['markerError']<1e-6 and l['meshes'] for l in landmarks)
assert max(projection_errors)<1e-6 and max(depth_errors)<1e-5
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in checks),[r for r in checks if r['components']!=1 or r['nonManifoldEdges'] or r['degenerateFaces'] or r['volume']<=0]
print('PATH_INTEGRITY_OK',len(checks),'closed solids;',len(cavities),'unobstructed real cavities;',len(footings),'founded bases',flush=True)
