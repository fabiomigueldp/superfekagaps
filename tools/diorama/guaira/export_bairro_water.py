"""Export the actual authored bowl/fall into a tiny conservative vector clip.
blender -b guaira-diorama.blend --python export_bairro_water.py -- --output-dir DIR
The source scene is never saved. A 1px inset protects the actual stone opening.
"""
import bpy,json,math,sys,os,argparse,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
args=argparse.ArgumentParser();args.add_argument('--output-dir',required=True);a=args.parse_args(sys.argv[sys.argv.index('--')+1:])
os.makedirs(a.output_dir,exist_ok=True)
s=bpy.context.scene;cam=s.camera;bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();W,H=1920,1200;PREFIX='Bairro public water '
def project(p):
 v=world_to_camera_view(s,cam,Vector(p));return [v.x*W,(1-v.y)*H]
def world_vertices(name):
 o=bpy.data.objects[PREFIX+name];return [o.matrix_world@v.co for v in o.data.vertices]
def area(poly):return sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(poly,poly[1:]+poly[:1]))/2
def ccw(poly):return poly if area(poly)>0 else list(reversed(poly))
def clip(poly,edges,inset=0):
 poly=ccw(poly);edges=ccw(edges)
 for p,q in zip(edges,edges[1:]+edges[:1]):
  ex,ey=q[0]-p[0],q[1]-p[1];length=math.hypot(ex,ey)
  def signed(v):return (ex*(v[1]-p[1])-ey*(v[0]-p[0]))/length-inset
  result=[]
  for aa,bb in zip(poly,poly[1:]+poly[:1]):
   da,db=signed(aa),signed(bb)
   if da>=0:result.append(aa)
   if (da>=0)!=(db>=0):
    t=da/(da-db);result.append([aa[0]+(bb[0]-aa[0])*t,aa[1]+(bb[1]-aa[1])*t])
  poly=result
  if not poly:break
 return poly
water=world_vertices('SOURCE bowl water');opening=world_vertices('carved trough')[16:24]
# The visible water is exactly bounded by its plane and the projected opening.
# Inset both so anti-aliased painting cannot touch any stone/beveled interior edge.
bowl=clip([project(v) for v in water],[project(v) for v in water],1.0)
bowl=clip(bowl,[project(v) for v in opening],1.0)
fall_world=world_vertices('SOURCE contained fall')
# Inset the actual top edge below the outlet by .025 world units (~1.92px).
for v in fall_world:
 if v.z>2:v.z-=.025
fall=ccw([project(v) for v in fall_world])
# Visibility evidence uses evaluated triangles for the complete original/new art.
def tree(include_new=True):
 vs=[];fs=[];owners=[]
 for ob in s.objects:
  if ob.hide_render or ob.type not in {'MESH','CURVE','SURFACE','FONT','META'} or (not include_new and ob.name.startswith(PREFIX)):continue
  ev=ob.evaluated_get(deps);me=ev.to_mesh()
  if not me:continue
  st=len(vs);vs.extend([ev.matrix_world@v.co for v in me.vertices]);me.calc_loop_triangles()
  for t in me.loop_triangles:fs.append(tuple(st+i for i in t.vertices));owners.append(ob.name)
  ev.to_mesh_clear()
 return BVHTree.FromPolygons(vs,fs,all_triangles=True),owners
bvh,names=tree();base,basenames=tree(False)
basis=cam.matrix_world.to_3x3();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));view=-toward
pixscale=cam.data.ortho_scale/W
# Pixel coordinates -> orthographic ray origin centered on camera.
def origin(x,y):return cam.location+right*((x-W/2)*pixscale)+up*((H/2-y)*pixscale)
def inside(p,poly):return all((q[0]-r[0])*(p[1]-r[1])-(q[1]-r[1])*(p[0]-r[0])>=-1e-7 for r,q in zip(poly,poly[1:]+poly[:1]))
# Intersect an orthographic ray with the actual receiving plane (or fall plane).
def world_on_plane(px,py,z=None,y=None):
 o=origin(px,py);t=(z-o.z)/view.z if z is not None else (y-o.y)/view.y;return o+view*t
checks={}
for label,poly in [('bowl',bowl),('fall',fall)]:
 samples=0;blocked=[]
 for yy in range(math.floor(min(p[1] for p in poly)),math.ceil(max(p[1] for p in poly))):
  for xx in range(math.floor(min(p[0] for p in poly)),math.ceil(max(p[0] for p in poly))):
   for dx,dy in [(.125,.125),(.5,.5),(.875,.875),(.125,.875),(.875,.125)]:
    x,y=xx+dx,yy+dy
    if not inside((x,y),poly):continue
    samples+=1;p=world_on_plane(x,y,z=1.905) if label=='bowl' else world_on_plane(x,y,y=1.33)
    loc,norm,index,dist=bvh.ray_cast(p+toward*.0001,toward,100)
    if index is not None:blocked.append({'pixel':[x,y],'object':names[index]})
 checks[label]={'samples':samples,'blocked':blocked}
 if blocked:raise AssertionError((label,blocked[:8]))
# Dry silhouette's old visible objects must be ground, not ribs or repair bay.
new_bounds=[]
for ob in s.objects:
 if ob.name.startswith(PREFIX) and not ob.hide_render:
  ev=ob.evaluated_get(deps);me=ev.to_mesh();new_bounds.extend(project(ev.matrix_world@v.co) for v in me.vertices);ev.to_mesh_clear()
xmin=math.floor(min(p[0] for p in new_bounds));xmax=math.ceil(max(p[0] for p in new_bounds));ymin=math.floor(min(p[1] for p in new_bounds));ymax=math.ceil(max(p[1] for p in new_bounds))
under={};occlusions=[];structural_leg_occlusions=[];retaining_facing_occlusions=[];new_samples=0
for y in range(ymin,ymax):
 for x in range(xmin,xmax):
  o=origin(x+.5,y+.5);loc,n,ix,d=bvh.ray_cast(o,view,100)
  if ix is None or not names[ix].startswith(PREFIX):continue
  new_samples+=1;loc0,n0,i0,d0=base.ray_cast(o,view,100);old=basenames[i0] if i0 is not None else None;under[old]=under.get(old,0)+1
  if (old or '').startswith('Workbench four grounded legs'):
   # The whole-scene structural redesign adds real legs behind the pre-existing
   # foreground receiver. This is legitimate depth: the dry vessel may hide a
   # leg, but its water polygons must still pass the independent visibility rays.
   structural_leg_occlusions.append({'pixel':[x,y],'baselineObject':old})
  elif (old or '').startswith('Civic fitted retaining stone '):
   # This facing is the new, real retaining ground behind the existing receiver,
   # not a facade, road or navigation object. Preserve its depth in the report.
   retaining_facing_occlusions.append({'pixel':[x,y],'baselineObject':old})
  elif old not in {'Continuous clay island'} and not (old or '').startswith(('Low eroded shoulder','Fine branching dry fissure','Fissure fine branch','Branched soil fissure')):occlusions.append({'pixel':[x,y],'baselineObject':old})
support=[]
for x in [-1.24,-1,-.76]:
 for y in [1.175,1.34,1.505]:
  loc,n,idx,d=base.ray_cast(Vector((x,y,1.78)),Vector((0,0,-1)),.1);support.append({'xy':[x,y],'z':loc.z if loc else None,'object':basenames[idx] if idx is not None else None})
assert all(p['object']=='Continuous clay island' and abs(p['z']-1.75)<1e-5 for p in support)
polys=bowl+fall;x0=math.floor(min(p[0] for p in polys))-2;y0=math.floor(min(p[1] for p in polys))-2;x1=math.ceil(max(p[0] for p in polys))+2;y1=math.ceil(max(p[1] for p in polys))+2
runtime={'bounds':[x0,y0,x1-x0,y1-y0],'bowl':[[round(v,3) for v in p] for p in bowl],'fall':[[round(v,3) for v in p] for p in fall]}
assert runtime['bounds'][2]<=80 and runtime['bounds'][3]<=80
json.dump(runtime,open(a.output_dir+'/GuairaBairroWaterData.json','w'),separators=(',',':'))
report={'method':'Actual source mesh projection, convex plane/opening intersection, one-source-pixel inset; evaluated full-scene visibility rays','sourceSize':[W,H],'dryGeometryBounds':[xmin,ymin,xmax-xmin,ymax-ymin],'water':runtime,'visibleWaterChecks':checks,'support':support,'newVisiblePropSamples':new_samples,'originalObjectsUnderProp':under,'protectedSceneryOcclusions':occlusions,'structuralLegOcclusionsBehindReceiver':structural_leg_occlusions,'retainingFacingOcclusionsBehindReceiver':retaining_facing_occlusions,'localSceneryCoveredExplanation':'The existing foreground receiver naturally occludes a small part of the newly grounded workbench legs, plus fitted civic retaining ground, clay/earthen shoulder/ground fissures. Only those named structural and retaining-ground overlaps are allowed. Independent water-polygon visibility rays remain mandatory; no bay opening, building facade, road or navigation object may be obscured','worldWaterVertices':[list(v) for v in water],'worldFallVertices':[list(v) for v in fall_world],'worldOpeningVertices':[list(v) for v in opening],'sourceRenderIsDry':True}
report['protectedOcclusionOwners']=dict(collections.Counter(p['baselineObject'] for p in occlusions))
json.dump(report,open(a.output_dir+'/water-geometry-audit.json','w'),indent=2)
assert not occlusions,report['protectedOcclusionOwners']
print(json.dumps({'bounds':runtime['bounds'],'dryGeometryBounds':report['dryGeometryBounds'],'visibility':checks,'under':under,'protectedSceneryOcclusions':len(occlusions),'structuralLegOcclusionsBehindReceiver':len(structural_leg_occlusions),'retainingFacingOcclusionsBehindReceiver':len(retaining_facing_occlusions)}))
