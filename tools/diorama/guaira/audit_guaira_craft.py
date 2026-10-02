"""Read-only baseline/candidate geometry and exact native Feka differential audit.

Create PROOF/baseline and PROOF/candidate using the respective build source.
Export actor data with export_guaira_actor.mjs, then run:
blender -b -t 8 --python tools/diorama/guaira/audit_guaira_craft.py -- REPO PROOF
The baseline must be the c270193 scene; candidate is the current saved scene.
The auditor reports inherited foot/floor contacts instead of hiding them.
"""
import bpy,json,math,sys,os,collections,hashlib
from types import SimpleNamespace
from mathutils import Vector
from mathutils.bvhtree import BVHTree
A=sys.argv[sys.argv.index('--')+1:]
root=A[0];out=A[1]
def snapshot():
 def obdata(o):
  result={'matrix':[list(v) for v in o.matrix_world]}
  if o.type=='MESH':result.update(vertices=[list(v.co) for v in o.data.vertices],faces=[list(p.vertices) for p in o.data.polygons],modifiers=[(m.type,getattr(m,'width',None),getattr(m,'segments',None)) for m in o.modifiers])
  return result
 return {'walk':{o.name:obdata(o) for o in bpy.data.objects if o.name.startswith('walk_')},'water':{o.name:obdata(o) for o in bpy.data.objects if o.type=='MESH' and any(m and m.name=='Clean turquoise water' for m in o.data.materials)},'camera':{'matrix':[list(v) for v in bpy.context.scene.camera.matrix_world],'scale':bpy.context.scene.camera.data.ortho_scale},'lights':{o.name:{**obdata(o),'energy':o.data.energy,'color':list(o.data.color),'size':o.data.size} for o in bpy.data.objects if o.type=='LIGHT'}}
def scene_bvh():
 scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 verts=[];polys=[];owners=[]
 for ob in scene.objects:
  if ob.hide_render or ob.type not in {'MESH','CURVE','SURFACE','FONT','META'}:continue
  ev=ob.evaluated_get(deps);me=ev.to_mesh()
  if not me:continue
  start=len(verts);verts.extend([ev.matrix_world@v.co for v in me.vertices])
  me.calc_loop_triangles()
  for tri in me.loop_triangles:
   polys.append(tuple(start+i for i in tri.vertices));owners.append(SimpleNamespace(name=ob.name))
  ev.to_mesh_clear()
 bvh=BVHTree.FromPolygons(verts,polys,all_triangles=True)
 return bvh,owners
def tree_cast(tree,owners,origin,direction,distance):
 loc,norm,index,d=tree.ray_cast(origin,direction,distance)
 return (index is not None,loc,norm,index,owners[index] if index is not None else None,None)
bpy.ops.wm.open_mainfile(filepath=out+'/baseline/guaira-diorama.blend');baseline=snapshot();base_tree,base_owners=scene_bvh()
bpy.ops.wm.open_mainfile(filepath=out+'/candidate/guaira-diorama.blend');candidate=snapshot()
exact={k:baseline[k]==candidate[k] for k in baseline}
assert all(exact.values()),exact
oldmeta=json.load(open(root+'/public/assets/world/experimental/guaira/guaira-diorama.meta.json'));newmeta=json.load(open(out+'/candidate/guaira-diorama.meta.json'))
metaexact={k:oldmeta[k]==newmeta[k] for k in ['camera','nodes','routes','worldRoutes','routeWidth','futureBossArea']};assert all(metaexact.values())
scene=bpy.context.scene;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();cam=scene.camera
tree,owners=scene_bvh()
def cast(origin,direction,distance):return tree_cast(tree,owners,origin,direction,distance)
def basecast(origin,direction,distance):return tree_cast(base_tree,base_owners,origin,direction,distance)
basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));toward=basis@Vector((0,0,1));up=basis@Vector((0,1,0))
sprite=json.load(open(out+'/feka-actor-source.json'));pixel=sprite['pixelWorldWidth'];points=sprite['opaqueUnion']
probes=[];contacts=[];samples=0;rays=0;headroom=[];newcontacts=[];newprobes=[];rows=collections.Counter()
for ri,route in enumerate(newmeta['worldRoutes']):
 for si,(aa,bb) in enumerate(zip(route,route[1:])):
  a,b=Vector(aa),Vector(bb);side=Vector((-(b-a).y,(b-a).x,0)).normalized();steps=max(2,math.ceil((b-a).length/.10))
  for i in range(steps+1):
   p=a.lerp(b,i/steps);samples+=1
   for off in [-.28,0,.28]:
    q=p+side*off;hit,loc,normal,idx,ob,mx=cast(q+Vector((0,0,.12)),Vector((0,0,-1)),distance=.32)
    if not hit or not ob.name.startswith('walk_') or abs(loc.z-p.z)>.16:
     item={'route':ri,'segment':si,'t':i/steps,'side':off,'object':ob.name if hit else None};probes.append(item)
     bh,bl,bn,bi,bo,bm=basecast(q+Vector((0,0,.12)),Vector((0,0,-1)),distance=.32)
     if bh!=hit or (hit and (bo.name!=ob.name or (bl-loc).length>.0001)):newprobes.append(item)
    hit,loc,normal,idx,ob,mx=cast(q+Vector((0,0,1.1)),Vector((0,0,-1)),distance=1.02)
    if hit and not ob.name.startswith('walk_') and loc.z>p.z+.17:headroom.append({'route':ri,'segment':si,'object':ob.name})
   for facing in [-1,1]:
    for x,y in points:
     for dx,dy in [(.5,.5),(.07,.07),(.93,.07),(.07,.93),(.93,.93)]:
      xx=(x+dx-8)*pixel*facing;zz=(26-y-dy)*pixel/up.z
      q=p+right*xx+Vector((0,0,zz));rays+=1
      hit,loc,normal,idx,ob,mx=cast(q+toward*.003,toward,distance=40)
      if hit:
       item={'route':ri,'segment':si,'t':round(i/steps,4),'pixel':[x,y],'subpixel':[dx,dy],'facing':facing,'object':ob.name,'distance':round((loc-q).length,4)};contacts.append(item);rows[y]+=1
       bh,bl,bn,bi,bo,bm=basecast(q+toward*.003,toward,distance=40)
       if not bh or bo.name!=ob.name or (bl-loc).length>.0001:newcontacts.append(item)
report={'exactStructure':exact,'exactNavigation':metaexact,'walkMeshCount':len(candidate['walk']),'waterMeshCount':len(candidate['water']),'nativeFrames':len(sprite['frames']),'opaqueUnion':len(points),'routeSamples':samples,'supportProbes':samples*3,'unsupported':probes,'headroom':headroom,'method':'Evaluated Blender geometry with Blender loop triangulation; both-facing native opaque-pixel union, 5 subpixel rays per pixel; full-body and face included','opaquePixelRays':rays,'foregroundContacts':len(contacts),'newForegroundContacts':newcontacts,'foregroundPixelRows':dict(rows),'newUnsupported':newprobes,'objects':dict(collections.Counter(c['object'] for c in contacts)),'contacts':contacts[:500]}
json.dump(report,open(out+'/final-audit.json','w'),indent=2)
print(json.dumps({k:v for k,v in report.items() if k not in ['contacts','unsupported','headroom']}))
assert not newprobes and not headroom and not newcontacts,'Candidate added a new geometry conflict; inspect final-audit.json'
