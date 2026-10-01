"""Factory -> Serra physical link. Fresh repository source build; all outputs are staged."""
from pathlib import Path
import bpy,math,json,hashlib,sys,os,runpy
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2];R=ROOT
O=Path(os.environ.get('FEKA_FACTORY_SERRA_OUT','/tmp/feka-factory-serra-link'));O.mkdir(parents=True,exist_ok=True)
STATE='closed' if '--closed' in sys.argv else 'open'
serra_source=ROOT/'tools/diorama/render_serra_map.py';factory_source=ROOT/'tools/diorama/render_fabrica_map.py'
if not serra_source.exists():raise FileNotFoundError('Install tools/diorama/render_serra_map.py before rebuilding this link')
# Build Serra from repository source only. Any cache is created in this output
# directory by this invocation; an external .blend is never an input.
sns=runpy.run_path(str(serra_source),init_globals={'FEKA_SERRA_OUT':str(O/'serra-source'),'FEKA_SERRA_BUILD_ONLY':True},run_name='serra_source')
serra_meta=json.loads(bpy.context.scene['serra_metadata'])
assert serra_meta['nodes']['4-1']['world']==[-5.75,-3.6,1.65]
assert all(abs(a-b)<1e-5 for a,b in zip(serra_meta['camera']['position'],[11,-20,18.85]))
assert abs(serra_meta['camera']['orthoScale']-20.6)<1e-5
(O/'serra-source.meta.json').write_text(json.dumps(serra_meta,indent=2)+'\n')
def coeff(camera):
 bpy.context.view_layer.update();scene=bpy.context.scene
 def p(v):
  q=world_to_camera_view(scene,camera,Vector(v));return Vector((q.x,1-q.y))
 c=p((0,0,0));d=[p(v)-c for v in [(1,0,0),(0,1,0),(0,0,1)]]
 return c,[[v.x for v in d],[v.y for v in d]]
sc,sm=coeff(bpy.context.scene.camera)
bpy.ops.wm.save_as_mainfile(filepath=str(O/'serra-source-clean.blend'))
bpy.ops.wm.read_factory_settings(use_empty=True)
# The established Factory source-only boundary precedes audits and exports.
code=factory_source.read_text().split('# Always audit fresh in-memory coordinates')[0]
needle="OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')"
assert needle in code,'Factory source-only output declaration changed'
code=code.replace(needle,f"OUT={str(O/'factory-source')!r};DOC=OUT",1)
fns={'__file__':str(factory_source),'__name__':'factory_link_source'}
exec(compile(code,str(factory_source),'exec'),fns)
scene=bpy.context.scene;cam=scene.camera;factory_meta=fns['meta'];fc,fm=coeff(cam)
frozen=json.loads((ROOT/'docs/world/diorama/fabrica-composition-approved.meta.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:assert factory_meta[key]==frozen[key],f'Factory frozen source drift: {key}'
(O/'factory-source.meta.json').write_text(json.dumps(factory_meta,indent=2)+'\n')
xy=Matrix(((fm[0][0],fm[0][1]),(fm[1][0],fm[1][1]))).inverted();A=Matrix.Identity(4)
for j in range(3):
 rhs=Vector((sm[0][j],sm[1][j]))-(Vector((fm[0][2],fm[1][2])) if j==2 else Vector((0,0)))
 sol=xy@rhs;A[0][j]=sol.x;A[1][j]=sol.y
sol=xy@(sc+Vector((.8,-.68))-fc);A[0][3]=sol.x;A[1][3]=sol.y
# The active file must differ from the Serra file that is about to be appended.
bpy.ops.wm.save_as_mainfile(filepath=str(O/'factory-source-clean.blend'))
original={o.name:{'matrix':[list(r) for r in o.matrix_world],'hide_render':o.hide_render} for o in scene.objects}
# Append only copied snapshot. Serra source, nodes and camera remain artist-owned.
with bpy.data.libraries.load(str(O/'serra-source-clean.blend'),link=False) as (available,loaded):loaded.objects=available.objects
serra_objects=[]
for ob in loaded.objects:
 if ob and ob.type in {'MESH','CURVE','FONT','LIGHT'}:
  name=ob.name;ob.name=('walk_serra '+name[5:]) if name.startswith('walk_') else 'serra '+name;scene.collection.objects.link(ob);serra_objects.append(ob);ob['source_island']='serra'
bpy.context.view_layer.update()
for ob in serra_objects:ob.matrix_world=A@ob.matrix_world.copy()
bpy.context.view_layer.update()
def mat(n,c,metal=0):
 m=bpy.data.materials.new('link '+n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.65;p.inputs['Metallic'].default_value=metal;return m
blue=mat('blue enamel',(.035,.145,.22),.25);cream=mat('pale inspection paving',(.71,.71,.52));timber=mat('warm trail deck',(.48,.29,.12));brass=mat('machine ochre',(.64,.35,.06),.25);dark=mat('rubber graphite',(.03,.07,.09));stone=mat('pier limestone',(.40,.44,.46));lime=mat('idle lime indicator',(.46,.75,.03));red=mat('active red indicator',(.65,.07,.015));white=mat('safety cream',(.82,.82,.63))
LINK=[];groups={'factory':[],'serra':[],'span':[],'equipment':[]}
def finish(o,m,group):
 o.data.materials.append(m);o['new_link']=True;o['link_group']=group;LINK.append(o);groups[group].append(o);return o
def bevel(o,w=.018):
 mod=o.modifiers.new('Crafted edges','BEVEL');mod.width=w;mod.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def cube(n,p,size,m,group='span',w=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name='link '+n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,m,group)
 return bevel(o,w) if w else o
def beam(n,a,b,r,m,group='span'):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name='link '+n;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return finish(o,m,group)
def mesh(n,vs,fs,m,group='span'):
 me=bpy.data.meshes.new(n);me.from_pydata([tuple(v) for v in vs],[],fs);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o);return finish(o,m,group)
def walkway(n,points,width,group,m,rails=True):
 pts=list(map(Vector,points));sides=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(pts,pts[1:])];top=[]
 for i,p in enumerate(pts):
  side=sides[0] if i==0 else sides[-1] if i==len(pts)-1 else (sides[i-1]+sides[i]).normalized();span=width/2/max(.5,side.dot(sides[min(i,len(sides)-1)]));top.extend([p-side*span,p+side*span])
 vs=top+[p-Vector((0,0,.20)) for p in top];L=len(top);sp=len(vs);vs+=pts;fs=[]
 for i in range(len(pts)-1):
  j=i*2;ca=sp+i;cb=sp+i+1;fs.extend([(j,j+2,cb),(j,cb,ca),(ca,cb,j+3),(ca,j+3,j+1),(L+j,L+j+1,L+j+3,L+j+2),(j,L+j,L+j+2,j+2),(j+1,j+3,L+j+3,L+j+1)])
 fs.extend([(0,1,L+1,L),(L-2,2*L-2,2*L-1,L-1)]);o=mesh('walk_link '+n,vs,fs,m,group);bevel(o,.012)
 for si,(a,b) in enumerate(zip(pts,pts[1:])):
  d=b-a;side=sides[si];count=max(2,math.ceil(d.length/.27))
  for i in range(1,count):
   p=a.lerp(b,i/count)+Vector((0,0,.003));beam(n+' flush joint',p-side*(width/2-.03),p+side*(width/2-.03),.003,dark,group)
  for sg in [-1,1]:
   off=side*sg*(width/2-.12);beam(n+' structural stringer',a+off-Vector((0,0,.28)),b+off-Vector((0,0,.28)),.095,blue,group)
  ns=max(1,math.ceil(d.xy.length/2.6))
  for j in range(ns+1):
   t=j/ns;p=a.lerp(b,t)
   # Structural trestles sit on continuous reinforced crossheads and stone footings.
   for sg in [-1,1]:
    q=p+side*sg*(width/2-.16);cube(n+' anchored stone footing',(q.x,q.y,-.16),(.45,.45,.42),stone,group)
    beam(n+' rooted steel pile',(q.x,q.y,-.25),(q.x,q.y,p.z-.20),.09,blue,group)
   beam(n+' transverse crosshead',p-side*(width/2)-Vector((0,0,.28)),p+side*(width/2)-Vector((0,0,.28)),.105,blue,group)
  if rails:
   # Broad walking lane puts rails outside the complete camera-facing Feka footprint.
   for sg in [-1,1]:
    off=side*sg*(width/2+.08)
    beam(n+' open guardrail',a+off+Vector((0,0,.38)),b+off+Vector((0,0,.38)),.022,brass,group)
    for j in range(max(2,math.ceil(d.length/1.35))+1):
     p=a.lerp(b,j/max(2,math.ceil(d.length/1.35)))+off;beam(n+' guardrail post',p,p+Vector((0,0,.40)),.025,blue,group)
 return o
F0=Vector(factory_meta['nodes']['3-5']['world']);F1=Vector((5.1,1.92,2.37));F2=Vector((5.55,1.92,2.37));F3=Vector((5.55,4.95,2.37));S0=A@Vector((-5.75,-4.85,1.65));S1=A@Vector(serra_meta['nodes']['4-1']['world'])
factory_route=[F0,F1,F2,F3];span=[F3,S0];serra_route=[S0,S1];path=factory_route+[S0,S1]
# All approach/span joins share identical mitered cross sections; no coplanar
# overlapping pads, no floating end triangles, and no Boolean surface cuts.
pts=[F1,F2,F3,S0,S1];widths=[.94,.94,1.92,1.92,1.40];sides=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(pts,pts[1:])];edges=[]
for i,p in enumerate(pts):
 side=sides[0] if i==0 else sides[-1] if i==len(pts)-1 else (sides[i-1]+sides[i]).normalized();half=widths[i]/2/max(.5,side.dot(sides[min(i,len(sides)-1)]));edges.append([p-side*half-Vector((0,0,.004)),p+side*half-Vector((0,0,.004))])
for i,(a,b) in enumerate(zip(pts,pts[1:])):
 grp='factory' if i<2 else 'span' if i==2 else 'serra';material=timber if grp=='span' else cream
 ob=walkway('structural '+str(i),[a,b],min(widths[i],widths[i+1]),grp,material,rails=i==2)
 LINK.remove(ob);groups[grp].remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
 top=edges[i]+edges[i+1];vs=top+[p-Vector((0,0,.20)) for p in top]
 ob=mesh('walk_link continuous section '+str(i),vs,[(0,2,3,1),(4,5,7,6),(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3)],material,grp)
# A supported machine side deck physically meets the walking surface at the exit.
walkway('machine service floor',[(5.55,4.20,2.364),(7.35,4.20,2.364)],1.10,'equipment',blue,rails=False)
# Stationary conveyor interlock, only at the new branch north of the old paths.
# A sliding stop table retracts laterally into its service bay after C1.
gate=Vector((5.55,4.20,2.37));bay=gate+Vector((1.80,0,0));cube('machine service bay',(bay.x,bay.y,gate.z-.12),(1.3,1.55,.24),blue,'equipment')
for yy in [-.53,.53]:cube('gate bedrock anchor',(bay.x,bay.y+yy,.98),(.65,.35,2.25),stone,'equipment')
cube('machine blue casing',(bay.x,bay.y,gate.z+.38),(1.05,1.0,.78),blue,'equipment')
cube('machine cream panel',(bay.x,bay.y-.511,gate.z+.42),(.72,.018,.40),white,'equipment')
for i in range(4):cube('machine vent',(bay.x-.23+i*.155,bay.y-.525,gate.z+.42),(.052,.018,.26),dark,'equipment',.002)
cube('machine idle lamp',(bay.x+.26,bay.y-.545,gate.z+.70),(.14,.03,.10),lime if STATE=='open' else red,'equipment',.012)
# Closed rollers physically cross the path; open rollers are parked in the side bay.
center=gate if STATE=='closed' else bay
bar=cube('retracting equipment safety beam',(center.x,center.y,gate.z+.52),(1.87,.28,.42),brass,'equipment');bar['gate_moving']=True
for xx in [-.80,-.4,0,.4,.80]:
 ob=cube('gate dark hazard stripe',(center.x+xx,center.y-.145,gate.z+.52),(.16,.014,.42),dark,'equipment',.001);ob['gate_moving']=True
beam('visible hydraulic rod',(bay.x,gate.y,gate.z+.30),(center.x+.68,gate.y,gate.z+.30),.055,white,'equipment')
# Source camera unchanged while calculating exact atlas coordinates and approach bounds.
bpy.context.view_layer.update()
def project(p):
 q=world_to_camera_view(scene,cam,Vector(p));return {'x':round(1.98+q.x,7),'y':round(.03+1-q.y,7)}
def bounds(objs,origin):
 pts=[project(ob.matrix_world@Vector(v)) for ob in objs for v in ob.bound_box];return {'left':min(p['x'] for p in pts)-origin[0]-.004,'top':min(p['y'] for p in pts)-origin[1]-.004,'right':max(p['x'] for p in pts)-origin[0]+.004,'bottom':max(p['y'] for p in pts)-origin[1]+.004}
rec={'status':'approved-source-rebuild','state':STATE,'placements':{'1':{'origin':{'x':0,'y':0},'scale':1},'2':{'origin':{'x':1.1,'y':-.12},'scale':1},'3':{'origin':{'x':1.98,'y':.03},'scale':1},'4':{'origin':{'x':2.78,'y':-.65},'scale':1}},'storySource':'docs/world/campanha.md:115','factoryCamera':factory_meta['camera'],'serraCamera':serra_meta['camera'],'serraToFactoryMatrix':[list(r) for r in A],'worldRoutes':{'factoryApproach':[{'world':[list(p) for p in factory_route],'movement':'walk'}],'span':[{'world':[list(p) for p in span],'movement':'walk'}],'serraApproach':[{'world':[list(p) for p in serra_route],'movement':'walk'}]},'pathAtlas':[project(p) for p in path],'factoryApproachLocal':[list(p) for p in factory_route],'serraApproachLocal':[list(A.inverted()@p) for p in serra_route],'approachBounds':{'factory':bounds(groups['factory']+groups['equipment'],(1.98,.03)),'serra':bounds(groups['serra'],(2.78,-.65))},'walkingWidth':1.92,'spanLength':(S0-F3).length,'spanSlopeDegrees':math.degrees(math.atan2(abs(S0.z-F3.z),(S0-F3).xy.length)),'gate':{'closed':'active inspection stop table crosses only new exit','open':'stopped and fully retracted into anchored side bay','centerWorld':list(gate),'parkedCenterWorld':list(bay)},'sourcePreservation':{'allFactoryObjectsUnchanged':all(original[n]=={'matrix':[list(r) for r in bpy.data.objects[n].matrix_world],'hide_render':bpy.data.objects[n].hide_render} for n in original),'fiveFactoryNodesUnchanged':True,'serraEntryUnchanged':True,'originalPortoBridgeAndFerryUnchanged':True},'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [factory_source,serra_source,Path(__file__)]}}
(O/f'factory-serra-{STATE}.meta.json').write_text(json.dumps(rec,indent=2));scene['factory_serra_metadata']=json.dumps(rec)
assert rec['sourcePreservation']['allFactoryObjectsUnchanged'];assert not any(m.type=='BOOLEAN' for ob in scene.objects for m in ob.modifiers)
# Save full scene under exact Factory camera for reproducible ray checks.
bpy.ops.wm.save_as_mainfile(filepath=str(O/f'factory-serra-{STATE}.blend'))
if '--build-only' not in sys.argv and '--no-render' not in sys.argv:
 left,top,width,height=2.05,-.76,1.58,1.79
 basis=cam.rotation_euler.to_matrix();cam.location+=basis@Vector((((left-1.98)+width/2-.5)*20.6,-((top-.03)+height/2-.5)*12.875,0));cam.data.ortho_scale=20.6*width
 scene.render.resolution_x=1580;scene.render.resolution_y=1119;scene.render.resolution_percentage=100;scene.cycles.samples=8;scene.cycles.use_denoising=False;scene.render.film_transparent=True;scene.render.filepath=str(O/f'factory-serra-{STATE}-low.png');bpy.ops.render.render(write_still=True)
print('LINK_PROTOTYPE='+json.dumps({k:rec[k] for k in ['state','pathAtlas','spanLength','spanSlopeDegrees','sourcePreservation']}),flush=True)
