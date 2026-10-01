"""Original, deterministic Guaíra candidate. Blender 4.3+, CPU Cycles.
blender -b -t 8 --python source/build_guaira.py -- --output-dir . [--draft]
No campaign identifiers, no changes outside output directory.
"""
import bpy, math, random, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
A=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=os.path.abspath(A[A.index('--output-dir')+1] if '--output-dir' in A else os.path.join(os.path.dirname(__file__),'..'))
os.makedirs(OUT,exist_ok=True);random.seed(61026)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,h,rough=.78,metal=0):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c]
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
soil=mat('Red orange clay','BC592D');sun=mat('Terracotta sun faces','D67A3C');shade=mat('Warm ravine','873E32');trail=mat('Readable dry paths','EDB77A');plaster=mat('Warm plaster','E8C991');roof=mat('Clay tile roofs','B84D2C');roofhi=mat('Tile ridges','EB8550');wood=mat('Gate wood','754829');timber=mat('Dry timber','B38754');leaf=mat('Cactus green','547A3A');rice=mat('Young rice','829E41');ricehi=mat('Rice highlights','A3B64B');water=mat('Clean turquoise water','63B6BF',.23);deep=mat('Canal bed','326F81');stone=mat('Water retaining stone','AC9C79');bone=mat('Dry old bone','F0DDAE');brass=mat('Bronze fittings','BE863B',.4,.4);dark=mat('Door recesses','50382D');purple=mat('Separate clandestine juice tank','9D51E5',.3);white=mat('Foam','C4E7DF')
def assign(o,m):o.data.materials.append(m);return o
def bevel(o,r=.025):
 b=o.modifiers.new('Soft crafted edge','BEVEL');b.width=r;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def cube(n,p,d,m,r=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m)
 if r:bevel(o,r)
 return o
def cyl(n,p,r,d,m,v=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=p);o=bpy.context.object;o.name=n;assign(o,m);return o
def beam(n,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m,10);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(n,vs,fs,m):
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);assign(o,m);return o
def curve(n,ps,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(ps)-1)
 for p,co in zip(s.points,ps):p.co=(*co,1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);assign(o,m);return o
def rock(n,x,y,z,rx,ry,h):
 N=9;angles=[i*math.tau/N+random.uniform(-.12,.12) for i in range(N)];rs=[random.uniform(.88,1.10) for i in range(N)]
 vs=[(x+math.cos(a)*rx*r*s,y+math.sin(a)*ry*r*s,z+dz) for dz,s in [(0,1),(h*.4,1.04),(h,.90)] for a,r in zip(angles,rs)]
 fs=[tuple(range(N-1,-1,-1)),tuple(range(2*N,3*N))]+[(k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i) for k in range(2) for i in range(N)]
 o=mesh(n,vs,fs,soil);o.data.materials.append(sun);o.data.materials.append(shade)
 for p in o.data.polygons:p.material_index=1 if p.index==1 or p.normal.y<-.3 else 2 if p.normal.x>.4 else 0
 bevel(o,.035);return o
# Low single island, with a raised rear civic terrace rather than giant set pieces.
rock('Continuous clay island',0,0,.15,7.05,5.0,1.6)
for i in range(28):
 a=math.tau*i/28;rock('Faceted edge '+str(i),6.0*math.cos(a),4.1*math.sin(a),.12,.55,.55,1.6+random.uniform(-.2,.03))
rock('Civic terrace',.6,3.1,1.5,2.35,1.65,.9)
Z=1.80
NODES={'guaira-1':(-5,-2.8,Z),'guaira-2':(-4,.05,Z),'guaira-3':(2,-2.5,Z),'guaira-4':(3.1,.8,Z),'guaira-5':(.6,2.55,2.44)}
NAMES=['Estrada do Vento','Bairro da Vala Seca','Passarela dos Arrozais','Curral da Comporta','Casa da Vazão']
ROUTES=[[NODES['guaira-1'],(-5,-1.7,Z),(-4.8,-.5,Z),NODES['guaira-2']],[NODES['guaira-2'],(-2.8,-.15,Z),(-1.9,-1.25,Z),(.4,-2.5,Z),NODES['guaira-3']],[NODES['guaira-3'],(3.05,-2.5,Z),(3.1,-1.1,Z),NODES['guaira-4']],[NODES['guaira-4'],(2.65,1.6,2.05),(2.30,2.00,2.44),(1.8,2.55,2.44),NODES['guaira-5']]]
def distseg(p,a,b):
 p,a,b=Vector(p[:2]),Vector(a[:2]),Vector(b[:2]);v=b-a;t=max(0,min(1,(p-a).dot(v)/v.length_squared));return (p-a-t*v).length
def clear(x,y,margin=.85):return min(distseg((x,y),a,b) for r in ROUTES for a,b in zip(r,r[1:]))>margin
def path(n,pts,w=.98,m=trail):
 ps=[Vector(p) for p in pts];ss=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(ps,ps[1:])];top=[]
 for i,p in enumerate(ps):
  side=ss[0] if i==0 else ss[-1] if i==len(ps)-1 else (ss[i-1]+ss[i]).normalized();span=w/2/max(.5,side.dot(ss[min(i,len(ss)-1)]));top.extend([p-side*span,p+side*span])
 vs=top+[p-Vector((0,0,.10)) for p in top];L=len(top);fs=[]
 for i in range(len(ps)-1):
  j=2*i;fs.extend([(j,j+2,j+3,j+1),(j,j+L,j+L+2,j+2),(j+1,j+3,j+L+3,j+L+1)])
 mesh('walk_'+n,[tuple(p) for p in vs],fs,m)
for i,r in enumerate(ROUTES):path(str(i),r)
for key,p in NODES.items():cyl('walk_'+key+' clearing',(p[0],p[1],p[2]-.008),.76,.055,trail,32)
# Houses remain behind the road, leaving approach and character silhouettes clear.
def house(n,x,y,z,w=1.3,d=.92,h=1.0):
 cube(n+' foundation',(x,y,z+.04),(w+.12,d+.12,.12),stone)
 cube(n+' plaster',(x,y,z+h/2),(w,d,h),plaster,.06)
 cube(n+' door',(x-w*.22,y-d/2-.03,z+.34),(.28,.045,.65),dark)
 cube(n+' window',(x+w*.22,y-d/2-.034,z+.60),(.3,.055,.32),deep)
 beam(n+' lintel',(x-w/2,y-d/2-.045,z+h-.12),(x+w/2,y-d/2-.045,z+h-.12),.045,timber)
 a,b=x-w/2-.13,x+w/2+.13;f,g=y-d/2-.14,y+d/2+.14;peak=z+h+.37
 mesh(n+' gabled roof',[(a,f,z+h),(b,f,z+h),(b,y,peak),(a,y,peak),(a,g,z+h),(b,g,z+h)],[(0,1,2,3),(3,2,5,4)],roof)
 for i in range(11):
  xx=a+(b-a)*i/10;beam(n+' ridge tile',(xx,f,z+h+.03),(xx,y,peak+.03),.025,roofhi);beam(n+' back tile',(xx,y,peak+.03),(xx,g,z+h+.03),.025,roofhi)
 beam(n+' cap',(a,y,peak),(b,y,peak),.05,roofhi)
house('Neighborhood home',-4.4,1.4,Z);house('Repair shop',-2.7,1.35,Z,1.2,.9,.85);house('Small granary',-5.3,2.6,Z,.95,.8,.8)
# Small wind pump announces the dry neighborhood without dominating the model.
x,y=-3.7,3.1
for dx in [-.22,.22]:
 for dy in [-.2,.2]:beam('Windpump timber leg',(x+dx,y+dy,Z),(x+dx*.55,y+dy*.55,Z+1.8),.042,wood)
for zz in [.45,.95,1.45]:beam('Windpump cross brace',(x-.22,y-.2,Z+zz),(x+.18,y-.2,Z+zz+.32),.026,timber)
hub=Vector((x,y-.13,Z+1.95))
for k in range(10):
 a=k*math.tau/10;b=a+.27
 mesh('Windpump vane',[tuple(hub+Vector((r*math.cos(t),0,r*math.sin(t)))) for r,t in [(.14,a),(.57,a),(.57,b),(.17,b)]],[(0,1,2,3)],timber)
beam('Windpump hub',hub-Vector((0,.09,0)),hub+Vector((0,.09,0)),.085,brass)
# Civic building broad but modest: a two-storey central hall and arcade pillars.
house('Casa da Vazao',.6,3.9,2.40,2.3,1.15,1.55)
for x in [-.35,.6,1.55]:
 cube('Civic portico column',(x,3.06,2.95),(.12,.13,1.08),plaster)
cube('Civic portico beam',(.6,3.06,3.48),(2.1,.22,.17),plaster)
cube('Civic ceramic water plaque',(.6,3.30,3.60),(.44,.06,.30),deep)
# Separate small purple apparatus, not the irrigation water.
cyl('Sealed clandestine tank',(-1.0,3.8,3.0),.24,.8,purple)
for zz in [2.64,3.35]:cyl('Tank bronze band',(-1,3.8,zz),.26,.06,brass)
# Water source and hydraulic descent visible on the eastern edge.
rock('Reservoir support',4.5,3.2,1.65,1.28,1.20,.90)
cyl('Reservoir stone basin',(4.5,3.2,2.54),1.0,.20,stone,28);cyl('Reservoir clean water',(4.5,3.2,2.66),.88,.025,water,40)
def channel(n,a,b,width=.38):
 a,b=Vector(a),Vector(b);v=b-a;s=Vector((-v.y,v.x,0)).normalized()*width/2
 mesh(n+' clean flowing water',[tuple(p) for p in [a-s,a+s,b+s,b-s]],[(3,2,1,0)],water)
 for sg in [-1,1]:beam(n+' retaining lip',a+s*sg,b+s*sg,.055,stone)
channel('Gravity supply',(4.5,2.35,2.66),(4.5,1.55,1.86));channel('Field feeder',(4.5,1.55,1.86),(4.5,-.15,1.82));channel('Lower return',(4.5,-.15,1.82),(4.5,-4.0,1.79))
# Thin bronze clean-water diversion deliberately distinct from purple tank.
curve('Bronze civic diversion',[(4.1,3,2.8),(3.4,3,2.8),(2.8,3.7,3.0),(1.9,3.7,3.0)],.065,brass)
def gate(n,x,y,z):
 for dx in [-.30,.30]:cube(n+' stone pier',(x+dx,y,z+.18),(.19,.23,.48),stone)
 cube(n+' wooden shutter',(x,y,z+.18),(.46,.12,.34),wood)
 beam(n+' spindle',(x,y,z+.3),(x,y,z+.72),.028,brass)
 bpy.ops.mesh.primitive_torus_add(major_radius=.14,minor_radius=.024,major_segments=16,minor_segments=6,location=(x,y,z+.72));assign(bpy.context.object,brass);bpy.context.object.name=n+' valve wheel'
gate('Reservoir sluice',4.5,2.25,2.28);gate('Field distribution',4.5,.15,1.82);gate('Drain gate',4.5,-3.95,1.75)
# Flooded paddy rectangles east of the navigation spine.
for k,(x,y,w,d) in enumerate([(4.6,-1.1,1.50,1.35),(4.8,-2.7,1.60,1.35),(2.2,-3.8,1.65,.8)]):
 cube('Paddy '+str(k)+' wet bed',(x,y,1.77),(w,d,.035),deep,0);cube('Paddy '+str(k)+' clean water',(x,y,1.81),(w-.09,d-.09,.018),water,0)
 for dx in [-w/2,w/2]:cube('Paddy earthen bank',(x+dx,y,1.82),(.10,d+.13,.13),sun)
 for dy in [-d/2,d/2]:cube('Paddy earthen bank',(x,y+dy,1.82),(w+.1,.1,.13),sun)
 for i in range(6):
  for j in range(4):
   xx=x-w*.39+i*w*.15;yy=y-d*.34+j*d*.22
   for s in [-1,0,1]:
    h=random.uniform(.13,.25);mesh('Rice tuft',[(xx-.035,yy,1.82),(xx+.035,yy,1.82),(xx+s*.085,yy+.02,1.82+h)],[(0,1,2)],rice if (i+j)%2 else ricehi)
# Short bridge is a literal water crossing at stage 3 approach.
channel('Lower paddy feed',(4.5,-3.8,1.80),(3.0,-3.8,1.80),.24)
channel('Paddy lateral inlet',(3.8,-1.75,1.81),(2.5,-1.75,1.81),.4)
for i in range(7):cube('walk_paddy bridge plank',(3.1,-2.15+i*.13,1.835),(.99,.11,.10),timber,.01)
# Future boss arena: modest empty clearing, open gates, no literal boss miniature.
for i in range(15):
 a=i*math.tau/16
 if abs(math.sin(a))>.82:continue
 x=3.1+1.10*math.cos(a);y=.8+1.10*math.sin(a)
 if not clear(x,y,.6):continue
 beam('Corral post',(x,y,Z),(x,y,Z+.48),.045,wood)
 a2=a+.26;beam('Corral open fence',(x,y,Z+.30),(3.1+1.1*math.cos(a2),.8+1.1*math.sin(a2),Z+.30),.025,timber)
# Closed dry neighborhood canal and sculpted drought cracks.
for x in [-3.85,-3.2,-2.55]:
 cube('Dry ditch',(x,2.37,1.80),(.58,.32,.024),shade,0)
 for yy in [2.15,2.59]:cube('Dry ditch broken edge',(x,yy,1.84),(.52,.09,.1),stone)
gate('Closed neighborhood gate',-4.2,2.36,1.81)
def cactus(x,y,h):
 beam('Cactus stem',(x,y,Z),(x,y,Z+h),.105,leaf)
 for sg,zz in [(-1,.48),(1,.65)]:
  beam('Cactus arm',(x,y,Z+h*zz),(x+sg*.25,y,Z+h*zz),.07,leaf);beam('Cactus upright',(x+sg*.25,y,Z+h*zz),(x+sg*.25,y,Z+h*(zz+.23)),.07,leaf)
for x,y,h in [(-5.85,-1.6,1.15),(-5.6,.8,1.2),(-3.7,-3.1,.9),(-1.0,-3.55,.68),(.5,.9,.75),(5.6,1.55,.8),(-1.9,3.3,.9)]:
 if clear(x,y,.8):cactus(x,y,h)
for k in range(50):
 x=random.uniform(-5.8,5.7);y=random.uniform(-3.8,3.5)
 if not clear(x,y,.80) or x>3.5 or y>1.1:continue
 if k%4==0:
  for j in range(4):
   a=j*math.pi/4;pts=[(x+.19*math.cos(t)*math.cos(a),y+.19*math.cos(t)*math.sin(a),Z+.19+.17*math.sin(t)) for t in [i*math.tau/16 for i in range(17)]];curve('Tumbleweed hoops',pts,.012,timber)
 else:
  curve('Sparse dry crack',[(x-.19,y-.1,Z+.003),(x,y,Z+.004),(x+.13,y+.11,Z+.003)],.009,shade)
# Small animal bones, not boss anatomy; decoration entirely off paths.
for x,y in [(-2.7,-2.8),(-.7,.7)]:
 beam('Old spine',(x-.30,y,Z+.08),(x+.3,y,Z+.08),.035,bone)
 for i in range(4):
  xx=x-.2+i*.13;curve('Small old rib',[(xx,y-.18,Z+.015),(xx,y-.12,Z+.17),(xx,y,Z+.21),(xx,y+.12,Z+.17),(xx,y+.18,Z+.015)],.025,bone)
for x,y in [(-5.9,-2.8),(-4.8,3.5),(-3.5,-3.6),(-2,-3.1),(-1.3,.5),(.3,-3.6),(5.3,.9),(-1.8,2.6)]:
 if clear(x,y,.95):rock('Small eroded rock',x,y,1.74,.22,.16,.22)
# A broken cart wheel and axle, away from character travel.
x,y=-4.0,-2.2
bpy.ops.mesh.primitive_torus_add(major_radius=.20,minor_radius=.035,major_segments=16,minor_segments=6,location=(x,y,Z+.21),rotation=(math.pi/2,0,.3));assign(bpy.context.object,wood);bpy.context.object.name='Broken cart wheel'
for a in [0,math.pi/3,2*math.pi/3]:beam('Cart wheel spoke',(x-.17*math.cos(a),y,Z+.21-.17*math.sin(a)),(x+.17*math.cos(a),y,Z+.21+.17*math.sin(a)),.016,timber)
# A light worn material texture at prop scale, never over the route.
for m in [soil,sun,plaster,roof]:
 nt=m.node_tree;p=nt.nodes.get('Principled BSDF');n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=7;b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.12;b.inputs['Distance'].default_value=.04;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs[0],p.inputs['Normal'])
scene=bpy.context.scene;bpy.ops.object.camera_add(location=(11,-20,18.85));cam=bpy.context.object;target=Vector((0,.25,3.0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20.6;scene.camera=cam
world=bpy.data.worlds.new('Warm dry atmosphere');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.58,.80,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
for n,p,e,s,c in [('golden key',(-8,-10,19),2400,9,(1,.83,.65)),('lilac fill',(8,3,13),1700,8,(.73,.70,1)),('warm rim',(-4,10,17),1800,7,(.96,.90,1))]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=e;o.data.shape='DISK';o.data.size=s;o.data.color=c;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=16 if '--draft' in A else 48;scene.cycles.use_denoising=False;scene.cycles.max_bounces=5;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=50 if '--draft' in A else 100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.30
bpy.context.view_layer.update()
def project(p):
 v=world_to_camera_view(scene,cam,Vector(p));return {'x':round(v.x,6),'y':round(1-v.y,6)}
meta={'version':1,'worldId':'guaira','status':'experimental-isolated-map','campaignIntegrated':False,'size':{'width':1920,'height':1200},'coordinateSystem':'Normalized top-left coordinates in complete frame; projected from authored Blender camera','camera':{'position':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale},'nodes':{key:{**project(p),'world':list(p),'label':NAMES[i],'clearingRadius':.76} for i,(key,p) in enumerate(NODES.items())},'routes':{f'{i}:{i+1}':[project(p) for p in r] for i,r in enumerate(ROUTES)},'worldRoutes':ROUTES,'routeWidth':.98,'futureBossArea':{'localNode':'guaira-4','status':'reserved-empty-arena','bossModelIncluded':False},'fictionalSetting':True,'note':'Projected Blender geometry for the isolated Guaíra experiment. No campaign world number, save schema, or persistent progress.'}
json.dump(meta,open(os.path.join(OUT,'guaira-diorama.meta.json'),'w'),indent=2,ensure_ascii=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'guaira-diorama.blend'))
scene.render.filepath=os.path.join(OUT,'guaira-draft.png' if '--draft' in A else 'guaira-diorama.png');bpy.ops.render.render(write_still=True)
