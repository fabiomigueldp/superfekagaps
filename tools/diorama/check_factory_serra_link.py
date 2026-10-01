from pathlib import Path
import bpy,json,math,collections,sys,time,hashlib,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(__file__).resolve().parents[2];O=Path(os.environ.get('FEKA_FACTORY_SERRA_OUT','/tmp/feka-factory-serra-link'));state='closed' if '--closed' in sys.argv else 'open';start=time.time();bpy.ops.wm.open_mainfile(filepath=str(O/f'factory-serra-{state}.blend'))
s=bpy.context.scene;cam=s.camera;meta=json.loads(s['factory_serra_metadata']);source=json.loads((O/'feka-sprite-source.json').read_text());bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));pixel=source['pixelMapWidth']*20.6;headHeight=26*pixel/up.z
verts=[];tris=[];obs=[];newtris=[];newobs=[];walktris=[];walkobs=[]
for ob in s.objects:
 if ob.type not in {'MESH','CURVE','FONT'} or ob.hide_render:continue
 e=ob.evaluated_get(deps);me=e.to_mesh();me.calc_loop_triangles();offset=len(verts);verts.extend([ob.matrix_world@v.co for v in me.vertices])
 for t in me.loop_triangles:
  tri=tuple(offset+i for i in t.vertices);tris.append(tri);obs.append(ob)
  if ob.get('new_link'):newtris.append(tri);newobs.append(ob)
  if ob.name.startswith('walk_'):walktris.append(tri);walkobs.append(ob)
 e.to_mesh_clear()
allb=BVHTree.FromPolygons(verts,tris,all_triangles=True);newb=BVHTree.FromPolygons(verts,newtris,all_triangles=True);walkb=BVHTree.FromPolygons(verts,walktris,all_triangles=True)
def samples(routes):
 out=[]
 for kind,rs in routes.items():
  for ri,r in enumerate(rs):
   for si,(aa,bb) in enumerate(zip(r['world'],r['world'][1:])):
    a,b=Vector(aa),Vector(bb);side=Vector((-(b-a).y,(b-a).x,0)).normalized();N=max(2,math.ceil((b-a).length/.10))
    for i in range(N+1):out.append(({'route':kind,'segment':si,'t':round(i/N,5),'world':list(a.lerp(b,i/N))},a.lerp(b,i/N),side))
 return out
link=samples(meta['worldRoutes']);old=samples(json.loads((O/'factory-source.meta.json').read_text())['worldRoutes'])
opaque=set()
for rows in source['frames'].values():
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,c in enumerate(row):
    if c=='_':continue
    px=15-x if flip else x
    for fx,fy in [(.5,.5),(.08,.08),(.92,.08),(.08,.92),(.92,.92)]:opaque.add((px+fx-8,26-y-fy))
support=[];head=[];feet=[];body=[];oldcontacts=[];raycount=0
for ident,p,side in link:
 for off in [-.28,0,.28]:
  q=p+side*off;loc,n,idx,d=walkb.ray_cast(q+Vector((0,0,.11)),Vector((0,0,-1)),.27)
  if loc is None or abs(loc.z-p.z)>.055:support.append({**ident,'offset':off,'object':walkobs[idx].name if loc else None,'delta':loc.z-p.z if loc else None})
  loc,n,idx,d=allb.ray_cast(q+Vector((0,0,headHeight+.015)),Vector((0,0,-1)),headHeight-.155)
  if loc is not None and loc.z>p.z+.17:head.append({**ident,'offset':off,'object':obs[idx].name,'height':loc.z-p.z})
 for px,py in opaque:
  q=p+right*(px*pixel)+Vector((0,0,py*pixel/up.z));loc,n,idx,d=allb.ray_cast(q+toward*.012,toward,40);raycount+=1
  if loc is not None:(feet if py<=2 else body).append({**ident,'object':obs[idx].name,'pixel':[px,py],'distance':d})
for ident,p,side in old:
 for px,py in opaque:
  q=p+right*(px*pixel)+Vector((0,0,py*pixel/up.z));loc,n,idx,d=newb.ray_cast(q+toward*.012,toward,40);raycount+=1
  if loc is not None:oldcontacts.append({**ident,'object':newobs[idx].name,'pixel':[px,py],'distance':d})
report={'state':state,'sourceBlendSha256':hashlib.sha256((O/f'factory-serra-{state}.blend').read_bytes()).hexdigest(),'method':'All paths <=0.10 unit step; three support/headroom samples; actual opaque sprite pixel union (idle and six walk frames, both facings), square centers and four corners. Existing Factory paths tested against new link objects only. Height-preserving source registration.','runtimeScope':'Actual ideal source pixels at island scale1; CSS rounded/ceil raster overshoot still requires integrated runtime validation.','routeSamples':len(link),'existingFactorySamples':len(old),'spriteHeightWorld':headHeight,'rayCount':raycount,'unsupportedCount':len(support),'headroomCount':len(head),'bodyContactsByObject':dict(collections.Counter(c['object'] for c in body)),'footContactsByObject':dict(collections.Counter(c['object'] for c in feet)),'existingFactoryNewObjectContactsByObject':dict(collections.Counter(c['object'] for c in oldcontacts)),'supportIssues':support,'headroomIssues':head,'bodyFirstContacts':{n:next(c for c in body if c['object']==n) for n in set(c['object'] for c in body)},'oldFirstContacts':{n:next(c for c in oldcontacts if c['object']==n) for n in set(c['object'] for c in oldcontacts)},'elapsed':time.time()-start}
(O/f'audit-{state}.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['supportIssues','headroomIssues','bodyFirstContacts','oldFirstContacts']},indent=2))
# Verify exact paintMapActor Math.round/Math.ceil raster coverage at named
# prototype viewports. Atlas integration must still measure actual fitted zoom.
from bpy_extras.object_utils import world_to_camera_view
pixel_frames=set()
for rows in source['frames'].values():
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,c in enumerate(row):
    if c!='_':pixel_frames.add((15-x if flip else x,y))
profiles=[]
for name,w,h,zoom in [('desktop',1180,757,1.0),('portrait',400,606,1.05),('landscape',846,392,1.0)]:
 C=min(w/1.6,h)*1.6*zoom;scale=C*source['pixelMapWidth'];size=math.ceil(scale);bc=collections.Counter();fc=collections.Counter();oldc=collections.Counter();oldbody=collections.Counter();oldfeet=collections.Counter();first={};rc=0
 for existing,samps,bvh,objects in [(False,link,allb,obs),(True,old,newb,newobs)]:
  for ident,p,side in samps:
   proj=world_to_camera_view(s,cam,p);footx=(proj.x-.5)*C+w/2;footy=(.5-proj.y)*C/1.6+h/2;raster=set()
   for sx,sy in pixel_frames:
    x0=math.floor(footx+(sx-8)*scale+.5);y0=math.floor(footy+(sy-26)*scale+.5)
    for dx in range(size):
     for dy in range(size):raster.add((x0+dx+.5,y0+dy+.5))
   for rx,ry in raster:
    q=p+right*((rx-footx)/C*20.6)+Vector((0,0,(footy-ry)/C*20.6/up.z));loc,n,idx,dist=bvh.ray_cast(q+toward*.012,toward,40);rc+=1
    if loc is not None:
     height=(footy-ry)/scale;name2=objects[idx].name;(oldc if existing else fc if height<=2 else bc)[name2]+=1
     if existing:(oldfeet if height<=2 else oldbody)[name2]+=1
     if name2 not in first or height>first[name2]['height']:first[name2]={**ident,'height':height,'existingFactoryRoute':existing}
 profiles.append({'profile':name,'viewport':[w,h],'zoom':zoom,'spriteCssScale':scale,'paintPixelCssSize':size,'rayCount':rc,'bodyContactsByObject':dict(bc),'footContactsByObject':dict(fc),'existingFactoryNewObjectContactsByObject':dict(oldc),'existingFactoryBodyContactsByObject':dict(oldbody),'existingFactoryFootContactsByObject':dict(oldfeet),'highestContact':first})
(O/f'audit-{state}-raster.json').write_text(json.dumps({'state':state,'scope':'Actual round/ceil source raster at explicitly declared prototype viewports; actual integrated atlas zoom and final label rectangles remain a runtime check.','profiles':profiles},indent=2));print('RASTER='+json.dumps([{k:v for k,v in p.items() if k!='highestContact'} for p in profiles]))
