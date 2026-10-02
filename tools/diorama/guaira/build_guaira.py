"""Second polish pass of the original deterministic Guaíra candidate. Blender 4.3+, CPU Cycles.
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
# Second authored pass: civic craft, geological strata, and connected irrigation.
# Walk geometry and camera contract are deliberately untouched.
random.seed(61027)
def remove_prefix(*prefixes):
 for o in list(bpy.data.objects):
  if any(o.name.startswith(p) for p in prefixes):bpy.data.objects.remove(o,do_unlink=True)
cream=mat('Civic limestone trim','E3C394');warmwhite=mat('Weathered civic stucco','D7BA8B');claydark=mat('Iron-rich clay seams','90442C');claylight=mat('Fresh terracotta breaks','C86C39');sand=mat('Weathered dry crust','CB8850');bank=mat('Compacted irrigation banks','9E7847');wetstone=mat('Old canal sandstone','9A9474');patina=mat('Bronze aged patina','567568',.52,.45);tiledeep=mat('Curved tile shadow','93442A');fadedpurple=mat('Civic plum cloth','805180');leafdark=mat('Cactus shaded ribs','405D30');leaflight=mat('Cactus sun ribs','759747');reed=mat('Golden rice tips','C6BA60');crackmat=mat('Fine deep drought fissures','874C32');waterdeep=mat('Irrigated cyan shallows','348F9B',.22)
def set_color(material,h):
 c=[int(h[k:k+2],16)/255 for k in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c];material.diffuse_color=(*c,1);material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1)
set_color(water,'168F9B');set_color(rice,'3D7228');set_color(ricehi,'66932E');set_color(reed,'A99C45')
for material in [water,rice,ricehi]:material.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.14
water.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.38
# Fine deterministic tonal finish replaces the flat-looking top and paved ribbon.
def color_noise(m,colors,scale,detail=2):
 nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=detail;noise.inputs['Roughness'].default_value=.68
 ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1]);
 for i,(pos,h) in enumerate(colors):
  el=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);el.position=pos;c=[int(h[k:k+2],16)/255 for k in (0,2,4)];el.color=(*[s/12.92 if s<=.04045 else ((s+.055)/1.055)**2.4 for s in c],1)
 nt.links.new(noise.outputs['Fac'],ramp.inputs['Fac']);nt.links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
color_noise(soil,[(.2,'A94F2B'),(.8,'CA7242')],3.2)
color_noise(sun,[(.18,'B35A31'),(.82,'D78145')],4.2)
color_noise(trail,[(.2,'C98B52'),(.52,'D39B60'),(.8,'E0AD72')],8)
color_noise(bank,[(.2,'916D46'),(.8,'B28D58')],6)
color_noise(plaster,[(.18,'D8B888'),(.82,'EAD2A4')],5)
# Additional very fine dry grit on the walk material is shading, never topology.
nt=trail.node_tree;no=nt.nodes.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=85;b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.17;b.inputs['Distance'].default_value=.012;nt.links.new(no.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
# Feathered dust coloration softens the engineered mesh outline. This only
# edits the walk material; every authored vertex and support face stays intact.
nt=trail.node_tree;nodes=nt.nodes;links=nt.links;bs=nodes.get('Principled BSDF')
oldcolor=bs.inputs['Base Color'].links[0].from_socket
geom=nodes.new('ShaderNodeNewGeometry');split=nodes.new('ShaderNodeSeparateXYZ');links.new(geom.outputs['Position'],split.inputs[0]);xy=nodes.new('ShaderNodeCombineXYZ');links.new(split.outputs['X'],xy.inputs['X']);links.new(split.outputs['Y'],xy.inputs['Y'])
def vop(op,a,b=None):
 n=nodes.new('ShaderNodeVectorMath');n.operation=op
 if hasattr(a,'node'):links.new(a,n.inputs[0])
 else:n.inputs[0].default_value=a
 if b is not None:
  if hasattr(b,'node'):links.new(b,n.inputs[1])
  else:n.inputs[1].default_value=b
 return n
nearest=None
for rr in ROUTES:
 for aa,bb in zip(rr,rr[1:]):
  aa=Vector((aa[0],aa[1],0));bb=Vector((bb[0],bb[1],0));dv=bb-aa
  rel=vop('SUBTRACT',xy.outputs[0],aa);dot=vop('DOT_PRODUCT',rel.outputs[0],dv/dv.length_squared)
  clamp=nodes.new('ShaderNodeClamp');links.new(dot.outputs['Value'],clamp.inputs['Value'])
  mul=vop('SCALE',dv);links.new(clamp.outputs[0],mul.inputs['Scale']);delta=vop('SUBTRACT',rel.outputs[0],mul.outputs[0]);dist=vop('LENGTH',delta.outputs[0]).outputs['Value']
  if nearest is None:nearest=dist
  else:
   mn=nodes.new('ShaderNodeMath');mn.operation='MINIMUM';links.new(nearest,mn.inputs[0]);links.new(dist,mn.inputs[1]);nearest=mn.outputs[0]
for pp in NODES.values():
 d=vop('DISTANCE',xy.outputs[0],(pp[0],pp[1],0)).outputs['Value'];sub=nodes.new('ShaderNodeMath');sub.operation='SUBTRACT';links.new(d,sub.inputs[0]);sub.inputs[1].default_value=.27
 mn=nodes.new('ShaderNodeMath');mn.operation='MINIMUM';links.new(nearest,mn.inputs[0]);links.new(sub.outputs[0],mn.inputs[1]);nearest=mn.outputs[0]
ramp=nodes.new('ShaderNodeMapRange');links.new(nearest,ramp.inputs['Value']);ramp.inputs['From Min'].default_value=.27;ramp.inputs['From Max'].default_value=.49;ramp.inputs['To Min'].default_value=0;ramp.inputs['To Max'].default_value=.82
mix=nodes.new('ShaderNodeMixRGB');links.new(ramp.outputs['Result'],mix.inputs[0]);links.new(oldcolor,mix.inputs[1]);mix.inputs[2].default_value=sun.diffuse_color;links.new(mix.outputs[0],bs.inputs['Base Color'])
# Remove regular rim pegs, replacing them with an irregular continuous sediment face.
remove_prefix('Faceted edge ')
base=bpy.data.objects['Continuous clay island'];N=9
ring=[Vector(v.co) for v in base.data.vertices[18:27]]
# Keep the original continuous solid clay core behind the fractured skin.
# This closes all joints, including the left platform and low front seams.
# Interlocking angular cliff panels match the original top contour. The
# silhouette uses shared seams and irregular chips, never a repeated peg ring.
for face in range(9):
 pa,pb=ring[face],ring[(face+1)%9];tangent=(pb-pa).normalized();normal=Vector((tangent.y,-tangent.x,0));normal.normalize()
 steps=5 if (pb-pa).length>4 else 4
 cuts=[0]+sorted([i/steps+random.uniform(-.052,.052) for i in range(1,steps)])+[1]
 for bay,(ta,tb) in enumerate(zip(cuts,cuts[1:])):
  a,b=pa.lerp(pb,ta),pa.lerp(pb,tb);mid=(a+b)/2
  top=random.uniform(1.69,1.78);zz=random.uniform(.15,.30);bulge=random.uniform(.05,.24);split=random.uniform(.69,1.14)
  # Wide angular slabs fit the core face, with a broken bevel on each side.
  vs=[tuple(a+Vector((0,0,top-a.z))),tuple(b+Vector((0,0,top-b.z))),
      tuple(b*1.115+normal*bulge+Vector((0,0,split-b.z*1.115))),tuple(mid*1.135+normal*bulge+Vector((0,0,split*.91-mid.z*1.135))),
      tuple(a*1.115+normal*bulge+Vector((0,0,split-a.z*1.115))),
      tuple(a/0.9+Vector((0,0,zz-a.z/0.9))),tuple(b/0.9+Vector((0,0,zz-b.z/0.9))),
      tuple(a*.95+Vector((0,0,top+.015-a.z*.95))),tuple(b*.95+Vector((0,0,top+.015-b.z*.95)))]
  ob=mesh('Fitted fractured cliff %d %d'%(face,bay),vs,[(0,1,3),(1,2,3),(0,3,4),(4,3,5),(3,2,6,5),(0,7,8,1)],soil)
  ob.data.materials.append(claylight);ob.data.materials.append(claydark)
  for poly in ob.data.polygons:poly.material_index=1 if poly.index in [0,5] else 2 if (bay+poly.index)%4==0 else 0
  bevel(ob,.008)
  if bay%2==0:
   # One angular sediment break is embedded in each alternating face.
   seam=[(v[0],v[1],v[2]) for v in vs[2:5]]
   curve('Broken horizontal sediment seam',seam,.017,claydark)
# Layered smaller exposed shoulders within the island and at the civic terrace.
for x,y,rx,ry in [(-3.25,-3.56,.66,.32),(-1.6,-3.63,.56,.28),(-5.5,1.85,.43,.45),(-1.7,1.82,.72,.29),(.05,1.25,.60,.28),(5.62,.85,.36,.62)]:
 if clear(x,y,1.10):
  rock('Low eroded shoulder',x,y,1.67,rx,ry,.22)
  rock('Shoulder broken cap',x-.06,y+.03,1.84,rx*.65,ry*.65,.15)
# Coherent branching drought fissures in generous dry interior patches.
for ci,(x,y,sx,sy) in enumerate([(-2.8,-2.65,.6,.45),(-.7,-.12,1.0,.75),(-1.15,1.0,.60,.35),(-4.1,-3.55,.45,.25),(-5.2,.35,.35,.48),(.35,-3.70,.42,.22),(-3.45,2.8,.4,.3)]):
 for k in range(8):
  xx=x+random.uniform(-sx,sx);yy=y+random.uniform(-sy,sy)
  if not clear(xx,yy,.69):continue
  aa=random.uniform(0,math.tau);ps=[(xx,yy,1.764)]
  for j in range(3):
   aa+=random.uniform(-.6,.6);xx+=math.cos(aa)*random.uniform(.12,.25);yy+=math.sin(aa)*random.uniform(.12,.25)
   if not clear(xx,yy,.65):break
   ps.append((xx,yy,1.765+random.uniform(0,.002)))
  if len(ps)>1:
   curve('Branched soil fissure',ps,.009 if k%3 else .014,crackmat)
   mid=ps[len(ps)//2];curve('Fissure fine branch',[mid,(mid[0]+.13*math.cos(aa+1.1),mid[1]+.13*math.sin(aa+1.1),1.766)],.007,crackmat)
# Natural cactus groups have tapered stems and longitudinal ribs.
def cactustip(n,p,r):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=r,location=p);ob=bpy.context.object;ob.name=n;ob.scale.z=.70;assign(ob,leaf)
def cactus_ribbed(x,y,z,h,r=.10):
 beam('Cluster cactus stem',(x,y,z),(x,y,z+h),r,leaf);cactustip('Rounded cactus tip',(x,y,z+h),r)
 for k in range(7):
  a=k*math.tau/7;curve('Long cactus rib',[(x+math.cos(a)*r,y+math.sin(a)*r,z+.08),(x+math.cos(a)*r*.98,y+math.sin(a)*r*.98,z+h-.035)],.012,leaflight if k%2 else leafdark)
 for sg,f in [(-1,.43),(1,.66)]:
  reach=r*2.3;beam('Curved cactus arm',(x,y,z+h*f),(x+sg*reach,y,z+h*f+.05),r*.62,leaf);beam('Cluster upright',(x+sg*reach,y,z+h*f+.05),(x+sg*reach,y,z+h*(f+.23)),r*.62,leaf);cactustip('Cactus arm tip',(x+sg*reach,y,z+h*(f+.23)),r*.62)
def rosette(x,y,z,s,matl=leaflight):
 for i in range(7):
  a=i*math.tau/7;dx,dy=math.cos(a),math.sin(a);v=(-dy*.055*s,dx*.055*s,0)
  mesh('Dry agave blade',[(x-v[0],y-v[1],z),(x+v[0],y+v[1],z),(x+dx*.22*s,y+dy*.22*s,z+.11*s),(x+dx*.32*s,y+dy*.32*s,z+.16*s)],[(0,1,2),(0,2,3)],matl)
for gi,(x,y,h) in enumerate([(-5.58,.92,1.0),(-3.83,-3.15,.68),(-.86,-3.59,.64),(.34,.94,.79),(-1.89,3.33,.76),(5.71,1.10,.85)]):
 if clear(x,y,1.05):
  cactus_ribbed(x+.1,y,1.76,h,.085)
  cactus_ribbed(x-.18,y+.1,1.76,h*.48,.065)
  for j in range(3):
   dx,dy=[(-.30,-.13),(.20,.22),(.34,-.06)][j]
   if clear(x+dx,y+dy,1):rock('Cactus family stones',x+dx,y+dy,1.755,.11+.02*j,.08,.08+.03*j)
  rosette(x+.28,y+.15,1.765,.6)
# Civic facade: local stucco, projecting cornices, arched porch, and water crest.
remove_prefix('Civic portico column','Civic portico beam','Civic ceramic water plaque','Casa da Vazao window')
cube('Civic base plinth',(.6,3.53,2.48),(2.43,.35,.14),stone,.035)
for x in [-.45,.6,1.65]:
 cube('Porch column foot',(x,3.12,2.51),(.24,.25,.17),cream,.022)
 cube('Porch stucco pier',(x,3.12,2.97),(.16,.19,.88),cream,.018)
 cube('Porch column capital',(x,3.12,3.41),(.26,.26,.12),cream,.016)
def arch(n,x,y,z,w,h,thick,material):
 # Semicircular ring in the facade plane with actual empty opening.
 vs=[]
 for yy in [y-.045,y+.045]:
  for r in [w/2,w/2+thick]:
   for k in range(13):
    a=k*math.pi/12;vs.append((x+r*math.cos(a),yy,z+h+r*math.sin(a)))
 fs=[]
 for k in range(12):fs.extend([(k,k+1,13+k+1,13+k),(26+k,39+k,39+k+1,26+k+1),(k,26+k,26+k+1,k+1),(13+k,13+k+1,39+k+1,39+k)])
 mesh(n,vs,fs,material)
for x in [.075,1.125]:arch('Porch open arc',x,3.12,2.4,.86,.73,.11,cream)
cube('Civic porch entablature',(.6,3.12,3.62),(2.46,.30,.18),cream,.018)
cube('Porch shadow cornice',(.6,3.08,3.76),(2.52,.34,.095),roof,.016)
# Two shuttered upper windows and windowed side wall give the building all-around craft.
for x in [-.16,1.33]:
 cube('Upper dark window',(x,3.294,3.67),(.31,.05,.35),dark,.025)
 for xx in [x-.13,x+.13]:cube('Civic teal shutters',(xx,3.245,3.67),(.11,.07,.32),patina,.012)
 cube('Upper carved sill',(x,3.22,3.48),(.41,.15,.065),cream,.012)
for y in [3.65,4.17]:
 cube('Side recessed tall window',(1.768,y,3.29),(.035,.27,.62),dark,.018)
 for yy in [y-.15,y+.15]:cube('Side window jamb',(1.798,yy,3.29),(.065,.045,.67),cream,.010)
 cube('Side window lintel',(1.80,y,3.63),(.08,.35,.065),cream,.010)
 cube('Side window transom',(1.805,y,3.35),(.065,.27,.034),timber,.004)
# Modest central pediment rises from the existing roof rather than a boss-sized palace.
vs=[(-.06,3.16,3.82),(1.26,3.16,3.82),(.6,3.16,4.48),(-.06,3.34,3.82),(1.26,3.34,3.82),(.6,3.34,4.48)]
mesh('Civic central triangular pediment',vs,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],plaster)
for a,b in [((-.11,3.11,3.84),(.6,3.11,4.53)),((.6,3.11,4.53),(1.31,3.11,3.84))]:beam('Pediment terracotta coping',a,b,.065,roof)
cube('Civic crest ceramic field',(.6,3.095,4.13),(.30,.055,.27),deep,.025)
# Three bronze wavelets read as a water seal without baked text.
for zz in [4.07,4.13,4.19]:curve('Bronze water crest',[(.49,3.058,zz),(.55,3.057,zz+.025),(.61,3.057,zz),(.67,3.057,zz-.022),(.72,3.057,zz)],.014,brass)
# Small banners on the two side piers, short enough to keep every arrival visible.
for x in [-.43,1.64]:
 cube('Restrained civic cloth',(x,3.27,3.31),(.12,.035,.39),fadedpurple,.006)
 beam('Banner brass rod',(x-.11,3.25,3.54),(x+.11,3.25,3.54),.018,brass)
# Tile course joins turn the flat roof strips into a crafted clay roof.
for obj in list(bpy.data.objects):
 if obj.name.startswith(('Casa da Vazao ridge tile','Casa da Vazao back tile')):
  obj.data.materials[0]=tiledeep
for y,z in [(3.37,3.99),(3.55,4.10),(3.73,4.21),(4.10,4.21),(4.29,4.10),(4.48,3.99)]:
 beam('Civic overlapping tile course',(-.66,y,z),(1.86,y,z),.025,roofhi)
# Bronze manifold has flanges, brackets and a legible meter, independent of the mystery tank.
for x,y,z in [(2.80,3.7,3.0),(3.40,3.0,2.8),(4.08,3.0,2.8)]:
 for dx in [-.055,.055]:
  ob=cyl('Diversion flanged collar',(x+dx,y,z),.10,.025,brass);ob.rotation_euler.y=math.pi/2
for x,y,z in [(2.80,3.7,3.0),(3.40,3.0,2.8)]:
 beam('Pipe support bracket',(x,y,2.1),(x,y,z),.038,wood)
# Dial faces toward the same viewing camera; no written labels.
beam('Civic meter neck',(1.85,3.7,3.0),(1.85,3.7,3.30),.035,brass)
ob=cyl('Civic bronze pressure gauge',(1.85,3.64,3.34),.14,.055,brass,24);ob.rotation_euler.x=math.pi/2
ob=cyl('Pressure gauge ivory face',(1.85,3.605,3.34),.11,.015,bone,24);ob.rotation_euler.x=math.pi/2
beam('Pressure gauge needle',(1.85,3.59,3.34),(1.81,3.59,3.40),.012,dark)
# Mysterious purple material stays sealed and visibly separate from the clean supply.
bpy.data.materials['Separate clandestine juice tank'].name='Sealed mysterious purple slime'
for xx in [-1.18,-.82]:beam('Mystery tank cage',(xx,3.65,2.60),(xx,3.65,3.41),.026,brass)
for z in [2.73,3.20]:
 ob=cyl('Mystery tank thin bronze collar',(-1,3.8,z),.247,.022,brass,20)
# Irrigation: three larger ponds share an earthen terrace and common cyan channels.
remove_prefix('Paddy ','Rice tuft','Paddy earthen bank','Lower paddy feed','Paddy lateral inlet','Lower return','Field feeder')
# Low contiguous banks retain the island surface, avoiding separate tray silhouettes.
terraces=[('Upper',[(3.72,-.38),(5.58,-.38),(5.77,-1.32),(5.55,-1.91),(3.70,-1.91)]),('Lower',[(3.77,-2.04),(5.55,-2.04),(5.65,-3.64),(5.30,-3.94),(3.74,-3.93)]),('Cross',[(1.13,-3.39),(3.49,-3.36),(3.78,-3.64),(3.52,-4.26),(1.03,-4.25)])]
def patch(n,points,z,material):return mesh(n,[(x,y,z) for x,y in points],[tuple(range(len(points)))],material)
for name,pts in terraces:
 patch('Connected '+name+' earth terrace',pts,1.787,bank)
 # Water inset uses a shared bank material rather than a raised toy frame.
 cx=sum(p[0] for p in pts)/len(pts);cy=sum(p[1] for p in pts)/len(pts);inner=[(cx+(x-cx)*.89,cy+(y-cy)*.86) for x,y in pts]
 patch(name+' cyan irrigated paddy',inner,1.81,water)
 # Broken, modest-height sandstone blocks sit in the broad earthen banks.
 for a,b in zip(pts,pts[1:]+pts[:1]):
  av,bv=Vector(a),Vector(b);ll=(bv-av).length;steps=max(1,round(ll/.30))
  for i in range(steps):
   p=av.lerp(bv,(i+.5)/steps)
   if not clear(p.x,p.y,.56):continue
   ob=cube('Embedded old paddy bank stone',(p.x,p.y,1.835),(.27,.14,.105),wetstone,.026);ob.rotation_euler.z=math.atan2(b[1]-a[1],b[0]-a[0]);ob.rotation_euler.z+=random.uniform(-.035,.035)
 # Ordered but hand-planted rice clumps; readable channels remain between rows.
 xmin,xmax=min(x for x,y in inner),max(x for x,y in inner);ymin,ymax=min(y for x,y in inner),max(y for x,y in inner)
 for row in range(round((ymax-ymin)/.24)):
  for col in range(round((xmax-xmin)/.24)):
   xx=xmin+.12+col*.24+random.uniform(-.025,.025);yy=ymin+.12+row*.24+random.uniform(-.025,.025)
   if xx>xmax-.1 or yy>ymax-.1:continue
   # Polygon inside test; keeps rice entirely inside the water bank.
   inside=False;j=len(inner)-1
   for i in range(len(inner)):
    xi,yi=inner[i];xj,yj=inner[j]
    if (yi>yy)!=(yj>yy) and xx<(xj-xi)*(yy-yi)/(yj-yi)+xi:inside=not inside
    j=i
   if not inside:continue
   for blade in range(5):
    a=blade*2.4;h=random.uniform(.18,.32);lean=.075+random.random()*.035
    mesh('Curved rice leaves',[(xx-.031,yy,1.82),(xx+.031,yy,1.82),(xx+math.cos(a)*lean*.45,yy+math.sin(a)*lean*.45,1.82+h*.75),(xx+math.cos(a)*lean,yy+math.sin(a)*lean,1.82+h)],[(0,1,2),(0,2,3)],rice if blade%2 else ricehi)
   if (row+col)%4==0:beam('Rice grain head',(xx,yy,2.02),(xx+.035,yy,2.08),.012,reed)
# All irrigated beds connect to the existing water descent and crossing.
channel('Shared field supply',(4.5,1.55,1.86),(4.5,-.30,1.82),.48)
channel('Eastern communicating canal',(5.45,-.55,1.825),(5.45,-3.88,1.825),.24)
channel('Lower shared outflow',(5.42,-3.85,1.825),(3.38,-3.85,1.825),.27)
channel('Bridge lateral clean inlet',(4.35,-1.74,1.825),(2.56,-1.74,1.825),.40)
# Canal banks stop outside the unchanged crossing, preserving all sprite feet.
remove_prefix('Bridge lateral clean inlet retaining lip')
for yy in [-1.94,-1.54]:beam('Bridge bank stops before walk',(4.35,yy,1.825),(3.68,yy,1.825),.055,stone)
# Subtle short ripples reinforce flow without busy animated-looking decoration.
for x,y,ll in [(4.50,1.15,.18),(4.50,.62,.18),(5.46,-1.64,.13),(5.46,-2.52,.13),(4.1,-3.85,.20)]:
 curve('Quiet canal glint',[(x-ll/2,y,1.837),(x,y-.017,1.839),(x+ll/2,y,1.837)],.007,white)
# Bank-side tools make irrigation feel worked, kept away from the walk crossing.
for x,y in [(5.60,-.17),(5.78,-2.02),(4.14,-4.13)]:
 cyl('Water keeper bucket',(x,y,1.88),.085,.19,timber,12)
 for zz in [1.815,1.95]:cyl('Bucket bronze hoop',(x,y,zz),.09,.019,brass,12)
 curve('Bucket loop handle',[(x-.083,y,1.98),(x-.055,y,2.07),(x+.055,y,2.07),(x+.083,y,1.98)],.012,dark)
beam('Irrigation rake handle',(5.68,-2.24,1.80),(5.82,-2.05,2.18),.018,timber)
beam('Irrigation rake head',(5.63,-2.29,1.80),(5.78,-2.29,1.80),.018,wood)
for xx in [5.64,5.68,5.72,5.76]:beam('Rake teeth',(xx,-2.29,1.8),(xx,-2.35,1.8),.010,wood)
# The reservoir receives laid masonry, a low cyan lip, and bank vegetation.
for k in range(22):
 a=k*math.tau/22;xx=4.5+math.cos(a)*1.0;yy=3.2+math.sin(a)*1.0
 if yy<2.40 and abs(xx-4.5)<.35:continue
 ob=cube('Reservoir laid rim stone',(xx,yy,2.66),(.29,.19,.22),wetstone,.04);ob.rotation_euler.z=a+math.pi/2
for x,y,s in [(5.70,-3.63,.66),(5.88,-1.50,.62),(5.76,.0,.66),(4.84,-4.11,.48),(1.03,-4.00,.5),(5.41,2.55,.8),(4.0,4.03,.7)]:
 if clear(x,y,.9):rosette(x,y,1.77 if y<2 else 2.4,s,leaf)

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
