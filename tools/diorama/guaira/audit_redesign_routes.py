"""Exact evaluated-mesh route audit for a terrain redesign, without freezing art.
blender -b -t 4 -P audit_redesign_routes.py -- --baseline BEFORE.blend --candidate AFTER.blend --metadata AFTER.meta.json --actor actor.json --output report.json
Preserves intentional walk/navigation while allowing all terrain/water/building
changes. Native opaque actor rays detect foreground contacts; support rays use
only actual terrain, so a walk mesh cannot disguise a floating road.
"""
import bpy,json,math,sys,argparse,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser(description=__doc__)
for k in ['baseline','candidate','metadata','actor','output']:p.add_argument('--'+k,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def snapshot():
    return {o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(f.vertices) for f in o.data.polygons]} for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('walk_')}
def tree(only_terrain=False):
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[];owners=[]
    for ob in bpy.context.scene.objects:
        if ob.hide_render or ob.type not in {'MESH','CURVE','FONT','SURFACE','META'}:continue
        if only_terrain and ob.name not in {'Continuous clay island','Civic terrace','Civic continuous earthen ascent'}:continue
        ev=ob.evaluated_get(deps);me=ev.to_mesh()
        if not me:continue
        start=len(vertices);vertices.extend(ev.matrix_world@v.co for v in me.vertices);me.calc_loop_triangles()
        for t in me.loop_triangles:faces.append(tuple(start+i for i in t.vertices));owners.append(ob.name)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(vertices,faces,all_triangles=True),owners
bpy.ops.wm.open_mainfile(filepath=a.baseline);old=snapshot()
bpy.ops.wm.open_mainfile(filepath=a.candidate);new=snapshot()
assert old==new,'Walk geometry changed: audit needs updated explicit route contract'
alltree,names=tree();ground,ground_names=tree(True);cam=bpy.context.scene.camera
meta=json.load(open(a.metadata));actor=json.load(open(a.actor));pixels=actor['opaqueUnion'];pixel=actor['pixelWorldWidth']
basis=cam.matrix_world.to_3x3();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1))
samples=rays=0;unsupported=[];blocked=[];floor_contacts=collections.Counter();headroom=[];shoulder_overhangs=[];support_count=0;supports=collections.Counter()
for ri,route in enumerate(meta['worldRoutes']):
    for si,(aa,bb) in enumerate(zip(route,route[1:])):
        start,end=Vector(aa),Vector(bb);side=Vector((-(end-start).y,(end-start).x,0)).normalized();steps=max(2,math.ceil((end-start).length/.20))
        for k in range(steps+1):
            point=start.lerp(end,k/steps);samples+=1
            for offset in [-.44,-.28,0,.28,.44]:
                q=point+side*offset;support_count+=1
                loc,n,idx,d=ground.ray_cast(q+Vector((0,0,.02)),Vector((0,0,-1)),.20)
                if idx is None or loc.z>point.z+.015:unsupported.append({'route':ri,'segment':si,'t':k/steps,'offset':offset,'z':point.z,'hit':ground_names[idx] if idx is not None else None})
                else:supports[ground_names[idx]]+=1
                # Full-width road backing includes shoulders; actor headroom
                # uses its actual lateral corridor, not the outer road verge.
                loc,n,idx,d=alltree.ray_cast(q+Vector((0,0,1.1)),Vector((0,0,-1)),1.02)
                if idx is not None and not names[idx].startswith('walk_') and loc.z>point.z+.17:
                    item={'route':ri,'segment':si,'t':k/steps,'offset':offset,'object':names[idx]}
                    (headroom if abs(offset)<=.28 else shoulder_overhangs).append(item)
            for facing in [-1,1]:
                for x,y in pixels:
                    for dx,dy in [(.5,.5),(.07,.07),(.93,.07),(.07,.93),(.93,.93)]:
                        q=point+right*((x+dx-8)*pixel*facing)+Vector((0,0,(26-y-dy)*pixel/up.z));rays+=1
                        loc,n,idx,d=alltree.ray_cast(q+toward*.003,toward,40)
                        if idx is not None:
                            item={'route':ri,'segment':si,'t':round(k/steps,4),'pixel':[x,y],'facing':facing,'object':names[idx],'hitZ':round(loc.z,5),'footZ':round(point.z,5)}
                            # Ground/road may touch only the actor's lowest native rows.
                            if y>=23 and (names[idx].startswith('walk_') or names[idx] in {'Continuous clay island','Civic terrace','Civic continuous earthen ascent'}) and loc.z<=point.z+.09:floor_contacts[names[idx]]+=1
                            else:blocked.append(item)
report={'method':'Evaluated Blender loop triangles; exact native idle/walk opaque union, both facings, five subpixel rays; independent terrain-only route backing','walkMeshesExact':True,'routeSamples':samples,'opaquePixelRays':rays,'terrainSupportProbes':support_count,'terrainSupportHits':dict(supports),'unsupported':unsupported,'headroom':headroom,'roadShoulderOverhangs':shoulder_overhangs,'foregroundContacts':blocked,'allowedLowestRowsFloorContacts':dict(floor_contacts),'browserQA':False}
json.dump(report,open(a.output,'w'),indent=2)
print(json.dumps({k:v if not isinstance(v,list) else len(v) for k,v in report.items()}))
assert not unsupported and not headroom and not blocked,'See exact conflicts in output JSON'
