"""Original Blender Fábrica de Suco diorama. No borrowed meshes or Boolean terrain.
blender -b -t 12 -P tools/diorama/render_fabrica_map.py [-- --final | --audit-only]
"""
import bpy, math, os, json, random, sys, runpy, tempfile
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')
os.makedirs(OUT,exist_ok=True);os.makedirs(DOC,exist_ok=True);random.seed(33019)
FINAL='--final' in sys.argv;AUDIT_ONLY='--audit-only' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)
def mat(name,c,rough=.65,metal=0):
 c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
blue=mat('Fabrica blue enamel',(.22,.40,.53),.38,.3);edge=mat('Fabrica light blue edges',(.42,.65,.74),.4,.22);dark=mat('Fabrica dark navy',(.10,.20,.28),.58,.3);cream=mat('Fabrica cream porcelain',(.95,.88,.71));pathmat=mat('Warm inspection lane',(.83,.81,.67));pavement=mat('Blue concrete floor',(.46,.61,.63));purple=mat('Concentrated violet juice',(.49,.16,.70),.24,.13);lilac=mat('Foam and glass reflection',(.79,.58,.92),.24);glass=mat('Purple sight glass',(.53,.37,.74),.18,.3);copper=mat('Copper supply pipe',(.72,.40,.22),.36,.62);copperhi=mat('Copper sleeve highlight',(.91,.60,.34),.32,.52);coral=mat('Calabrezzo red accents',(.78,.30,.20));lime=mat('Lime status lamps',(.77,.89,.31),.35);sand=mat('Warm coastal masonry',(.64,.58,.43));stone=mat('Blue coastal rock',(.34,.43,.45));leaf=mat('Salt resistant coastal green',(.40,.57,.24));wood=mat('Pallet warm timber',(.58,.38,.19));rubber=mat('Belt rubber',(.10,.14,.19));yellow=mat('Safety gold',(.95,.70,.22));white=mat('Warm window glow',(.99,.80,.41),.45)
def assign(o,m):o.data.materials.append(m);return o
def bevel(o,r=.035):
 b=o.modifiers.new('Rounded crafted edge','BEVEL');b.width=r;b.segments=3;o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');return o
def cube(name,loc,dims,m,r=.025,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dims;o.rotation_euler.z=rot;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m)
 if r:bevel(o,r)
 return o
def cyl(name,loc,r,d,m,n=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=loc);o=bpy.context.object;o.name=name;assign(o,m);bevel(o,.016);return o
def beam(name,a,b,r,m,n=12):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,m,n);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(name,vs,fs,m):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);assign(o,m);return o
def ico(name,loc,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=s;assign(o,m);return o
def curve(name,pts,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);assign(o,m);return o
def text(name,body,loc,size,m):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.006;c.bevel_depth=.003;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);assign(o,m);return o
# An irregular coastal stone foundation; mesh sides are authored explicitly.
outline=[(-6.6,-3.05),(-5.4,-3.6),(-3.3,-3.5),(-1.4,-3.85),(.6,-3.65),(2.9,-3.65),(5.45,-3.35),(6.75,-2.45),(7.05,-.9),(6.7,1.8),(5.6,3.35),(3.1,4.15),(.8,4.2),(-1.5,4.55),(-3.4,4),(-5.5,3.65),(-6.7,2),(-6.9,-.5)]
n=len(outline);vs=[(x,y,1.04) for x,y in outline]+[(x*.98,y*.98,.24) for x,y in outline];fs=[tuple(range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
o=mesh('walk_irregular factory foundation',vs,fs,pavement);o.data.materials.append(stone);o.data.materials.append(sand)
for p in o.data.polygons:p.material_index=0 if p.index==0 else 1+p.index%2
bevel(o,.055)
for i,(x,y) in enumerate(outline):
 ico('coastal retaining boulder',(x,y,.20),(.42+random.random()*.2,.32+random.random()*.2,.35),stone if i%3 else sand)
# Raised quality terrace has real masonry support, not a floating platform.
cube('walk_quality terrace',(3.35,2.15,1.635),(5.30,2.6,1.19),pavement,.08)
for x in [1.1,2.2,3.3,4.4,5.5]:cube('quality terrace stone block',(x,3.44,1.6),(1.04,.13,1.03),sand,.025)
# Broad chamfered inspection lane plus supported ramps. Every route center/edge is audited.
def walkway(name,points,width,rails=False):
 pts=[Vector(p)+Vector((0,0,.012 if name.startswith('dry') else 0)) for p in points];sides=[]
 for a,b in zip(pts,pts[1:]):
  d=b-a;sides.append(Vector((-d.y,d.x,0)).normalized())
 top=[]
 for i,p in enumerate(pts):
  side=sides[0] if i==0 else sides[-1] if i==len(pts)-1 else (sides[i-1]+sides[i]).normalized()
  span=width/2/max(.5,side.dot(sides[min(i,len(sides)-1)]));top.extend([p-side*span,p+side*span])
 verts=top+[p-Vector((0,0,.10)) for p in top];n=len(top);faces=[]
 for i in range(len(pts)-1):
  j=i*2;faces.extend([(j,j+2,j+3,j+1),(n+j,n+j+1,n+j+3,n+j+2),(j,n+j,n+j+2,j+2),(j+1,j+3,n+j+3,n+j+1)])
 faces.extend([(0,1,n+1,n),(n-2,2*n-2,2*n-1,n-1)])
 o=mesh('walk_'+name,[tuple(p) for p in verts],faces,pathmat);bevel(o,.012)
 for a,b in zip(pts,pts[1:]):
  d=b-a;side=Vector((-d.y,d.x,0)).normalized()
  if abs(d.z)>.05:
   for sg in [-1,1]:
    off=side*(width/2-.05)*sg;beam(name+' steel stringer',a+off-Vector((0,0,.15)),b+off-Vector((0,0,.15)),.095,blue)
    for t in [.12,.5,.85]:
     p=a.lerp(b,t)+off;beam(name+' stone-supported column',(p.x,p.y,1.03),(p.x,p.y,p.z-.16),.065,blue)
   for i in range(1,14):
    p=a.lerp(b,i/14);beam('walk_'+name+' flush tread',p-side*(width/2-.08)+Vector((0,0,.008)),p+side*(width/2-.08)+Vector((0,0,.008)),.008,edge)
  if rails:
   for sg in [-1,1]:
    off=side*(width/2+.08)*sg;pa=a.lerp(b,.14)+off;pb=a.lerp(b,.84)+off;beam(name+' open-ended guardrail',pa+Vector((0,0,.52)),pb+Vector((0,0,.52)),.027,copperhi)
    for t in [.14,.5,.84]:
     p=a.lerp(b,t)+off;beam(name+' guardrail post',p,p+Vector((0,0,.55)),.026,blue)
NODES={'3-1':(-5.25,-2.58,1.18),'3-2':(-4.55,.12,1.18),'3-3':(-.20,-1.85,1.18),'3-4':(4.25,-1.85,1.18),'3-5':(3.90,1.92,2.37)}
MAIN=[[NODES['3-1'],(-5.25,-.70,1.18),NODES['3-2']],[NODES['3-2'],(-2.80,.12,1.18),(-2.30,-1.35,1.18),NODES['3-3']],[NODES['3-3'],(2,-1.85,1.18),NODES['3-4']],[NODES['3-4'],(5.10,-.80,1.18),(5.10,.85,2.37),(5.10,1.92,2.37),NODES['3-5']]]
SECRET=[NODES['3-3'],(.75,-.55,1.18),(.75,.85,2.37),(1.65,1.92,2.37),NODES['3-5']]
for i,p in enumerate(MAIN):walkway('main inspection lane '+str(i),p,1.04)
walkway('dry maintenance catwalk',SECRET,.80)
# Extra round junction patches make turns continuous across the beveled strip ends.
for p in NODES.values():cyl('walk_stage landing paving',(p[0],p[1],p[2]-.035),.64,.09,pathmat,32)
# Minimal steel guardrails only along the two slopes, with open entries.
for name,a,b,width in [('quality access',MAIN[3][1],MAIN[3][2],1.04),('maintenance',SECRET[1],SECRET[2],.80)]:
 a,b=Vector(a),Vector(b);side=Vector((-(b-a).y,(b-a).x,0)).normalized()
 for sg in [-1,1]:
  off=side*(width/2+.08)*sg;beam(name+' outer rail',a.lerp(b,.12)+off+Vector((0,0,.55)),a.lerp(b,.86)+off+Vector((0,0,.55)),.025,copperhi)
  for t in [.12,.5,.86]:
   p=a.lerp(b,t)+off;beam(name+' rail upright',p,p+Vector((0,0,.57)),.028,blue)
# Bottling hall's asymmetrical sawtooth roof and warm windows communicate a working business.
def hall(name,x,y,z,w,d,h):
 cube(name+' blue body',(x,y,z+h/2),(w,d,h),blue,.07)
 for xx in [x-w*.43,x+w*.43]:cube(name+' masonry pilaster',(xx,y-d/2-.035,z+h/2),(.10,.10,h),cream,.018)
 cube(name+' cream foundation',(x,y-d/2-.025,z+.14),(w+.04,.1,.23),cream,.018)
 for i in range(3):
  xx=x-w*.29+i*w*.29;cube(name+' warm glazing',(xx,y-d/2-.058,z+h*.56),(w*.22,.03,h*.35),white,.018);cube(name+' window center',(xx,y-d/2-.080,z+h*.56),(.034,.025,h*.37),edge,.005)
 roof=[(x-w/2-.12,y-d/2-.12,z+h),(x+w/2+.12,y-d/2-.12,z+h),(x+w/2+.12,y+.12,z+h+.50),(x-w/2-.12,y+.12,z+h+.50),(x-w/2-.12,y+d/2+.12,z+h+.13),(x+w/2+.12,y+d/2+.12,z+h+.13)]
 mesh(name+' folded blue roof',roof,[(0,1,2,3),(3,2,5,4)],edge)
hall('bottling works',-3.5,2.1,1.08,3.60,2.15,1.70)
cube('bottling ivory business sign',(-3.5,.968,2.86),(3.3,.12,.51),cream,.045);text('Fabrica de Suco facade','FÁBRICA DE SUCO',(-3.5,.885,2.86),.265,blue)
text('Calabrezzo company signature','CALABREZZO',(-3.5,.898,2.39),.175,cream)
# Receiving store with stacked purple product barrels, clear of the landing.
for x,y in [(-6.05,-1.5),(-6.05,-.80),(-5.7,2.85)]:
 cube('receiving pallet',(x,y,1.115),(.63,.65,.15),wood,.015);cyl('purple receiving barrel',(x,y,1.54),.25,.68,purple)
 for z in [1.24,1.84]:cyl('receiving barrel metal hoop',(x,y,z),.274,.07,edge)
 cyl('barrel cream lid',(x,y,1.895),.245,.035,cream)
# Iconic glass mixing vessel: front purple panel, metallic cradle, broad polished cap.
def tank(name,x,y,z,r,h):
 cyl(name+' violet liquid vessel',(x,y,z+h*.47),r,h*.84,purple,40)
 for dz in [.08,h*.84]:cyl(name+' broad blue band',(x,y,z+dz),r+.065,.16,blue,40)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=12,radius=1,location=(x,y,z+h*.91));o=bpy.context.object;o.name=name+' shallow domed lid';o.scale=(r+.065,r+.065,h*.14);assign(o,edge)
 for ang in [0,math.pi/2,math.pi,3*math.pi/2]:
  xx=x+math.cos(ang)*(r+.025);yy=y+math.sin(ang)*(r+.025);beam(name+' exterior metal rib',(xx,yy,z+.10),(xx,yy,z+h*.85),.055,edge)
 # Opaque stylized liquid with a distinct level and reflection strips, no transparent sorting.
 cyl(name+' lilac liquid level',(x,y,z+h*.68),r+.012,.048,lilac,40)
 for dx in [-.34,.34]:beam(name+' sight glass highlight',(x+dx*r,y-math.sqrt(max(.01,r*r-(dx*r)**2))-.018,z+h*.24),(x+dx*r,y-math.sqrt(max(.01,r*r-(dx*r)**2))-.018,z+h*.74),.022,lilac)
 cyl(name+' top pipe coupling',(x,y,z+h*1.08),r*.21,.18,copperhi)
 for dx in [-r*.66,r*.66]:cube(name+' steel cradle foot',(x+dx,y,z-.02),(.23,r*1.52,.26),blue,.03)
 return z+h*1.08
big=tank('main Calabrezzo mixing tank',-.55,3.08,1.36,1.10,3.30)
tank('small mixing vat',-1.30,1.02,1.19,.54,1.56)
# An original droplet seal, not a borrowed character portrait.
def droplet(name,x,y,z,s,m):
 vs=[(x,y,z+s),(x-s*.53,y,z+s*.17),(x-s*.47,y,z-s*.32),(x,y,z-s*.51),(x+s*.47,y,z-s*.32),(x+s*.53,y,z+s*.17)];return mesh(name,vs,[tuple(range(6))],m)
droplet('large product droplet',-.55,1.961,3.35,.37,cream)
# The bottling conveyor contains products and has no collision with inspection circulation.
cube('bottling conveyor chassis',(-3.62,.80,1.37),(2.32,.42,.24),blue,.08);cube('bottling conveyor belt',(-3.62,.80,1.53),(2.28,.39,.06),rubber,.055)
for i in range(5):
 x=-4.42+i*.39;cyl('filled juice bottle',(x,.80,1.76),.094,.38,glass,16);cyl('bottle cream cap',(x,.80,1.975),.065,.055,cream,16);cube('bottle label',(x,.701,1.75),(.12,.015,.14),lilac,.009)
for x in [-4.7,-2.5]:cube('conveyor steel foot',(x,.80,1.22),(.09,.40,.35),blue,.018)
# Pressure apparatus occupies the outer east bay, away from the route to the upper terrace.
cube('pressure compressor base',(6.50,-.38,1.31),(1.05,1.42,.38),blue,.08)
tank('pressure accumulator',6.50,-.40,1.53,.41,1.38)
curve('pressure copper inlet',[(6.47,-.45,3.12),(6.47,.15,3.12),(6.47,.36,2.91),(6.47,.36,1.60)],.085,copper)
# Quality control sits behind its wide, accessible raised forecourt.
cube('quality control cream booth',(3.75,3.12,2.925),(2.90,1.14,1.37),cream,.09)
cube('quality control dark flat roof',(3.75,3.12,3.67),(3.10,1.36,.18),blue,.055)
cube('quality control panoramic window',(3.53,2.526,3.04),(2.07,.042,.66),glass,.035)
for x in [2.54,3.19,3.87,4.56]:cube('quality booth window frame',(x,2.49,3.04),(.055,.05,.75),blue,.012)
cube('quality control blue door',(4.83,2.53,2.86),(.46,.04,1.02),blue,.025)
cube('quality door warm glazing',(4.83,2.50,3.05),(.28,.025,.32),white,.014)
cube('quality door handle',(4.69,2.466,2.73),(.025,.035,.11),copperhi,.009)
cube('quality control sign',(3.75,2.503,3.41),(2.45,.075,.29),cream,.027);text('quality sign letters','CONTROLE DE QUALIDADE',(3.75,2.452,3.41),.145,blue)
# Main copper header follows the back of the factory and never crosses a walking lane.
curve('back copper supply header',[(-4.6,3.2,2.30),(-4.6,3.2,3.73),(-4.45,3.2,3.88),(-2.0,3.2,3.88),(-1.85,3.2,4.03),(-1.85,3.2,4.9),(-1.68,3.2,5.07),(-.55,3.2,5.07),(-.55,3.08,big)],.10,copper)
for x,y,z in [(-6.0,2.7,1.1),(-5.75,-3.1,1.1),(6.3,1.8,1.1)]:ico('coastal scrub',(x,y,z+.18),(.28,.28,.24),leaf)
# ---- Bounded craft pass: the approved five landings and camera stay fixed. ----
# Restrained enamel variation and masonry grain keep the manufactured island tactile.
for material,depth in [(blue,.008),(edge,.006),(pavement,.018),(sand,.025)]:
 nt=material.node_tree;p=nt.nodes['Principled BSDF'];base=tuple(p.inputs['Base Color'].default_value[:3]);coord=nt.nodes.new('ShaderNodeTexCoord');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=9;noise.inputs['Detail'].default_value=2;nt.links.new(coord.outputs['Generated'],noise.inputs['Vector']);ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=tuple(v*.92 for v in base)+(1,);ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.06) for v in base)+(1,);nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color']);bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=depth;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])
# Continuous lower reef binds the individual rocks into the coast rather than loose props.
v=[(x*1.005,y*1.005,.29) for x,y in outline]+[(x*1.025,y*1.025,.06) for x,y in outline]
mesh('continuous warm coastal bedrock',v,[tuple(range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],sand)
for ob in scene.objects if 'scene' in globals() else bpy.context.scene.objects:
 if ob.name.startswith('coastal retaining boulder'):
  ob.location.x*=.975;ob.location.y*=.975;ob.scale.z*=.75
# Every visible retaining edge is made of coursed blocks seated against the solid foundation.
for i,(aa,bb) in enumerate(zip(outline,outline[1:]+outline[:1])):
 a,b=Vector((*aa,0)),Vector((*bb,0));d=b-a;L=d.length;theta=math.atan2(d.y,d.x);normal=Vector((d.y,-d.x,0)).normalized();count=max(2,round(L/.80))
 for row,z in enumerate([.45,.79]):
  for k in range(count):
   p=a.lerp(b,(k+.5)/count)+normal*.005;cube('coastal retaining masonry',(p.x,p.y,z),(L/count-.035,.17,.285),sand if (i+k+row)%4 else stone,.026,theta)
 # A blue stone coping ties floor to masonry, below all walkable route surfaces.
 p=(a+b)/2;cube('coastal edge coping',(p.x,p.y,1.015),(L+.035,.20,.12),pavement,.025,theta)
# Raised forecourt front wall gets regular masonry joints and blue steel corner piers.
for row,z in enumerate([1.29,1.64,1.99]):
 for i in range(6):
  x=.78+(i+.5)*5.13/6;cube('quality terrace warm masonry',(x,.838,z),(5.13/6-.027,.075,.31),sand if (i+row)%4 else pavement,.02)
for x in [.79,5.91]:cube('quality terrace steel corner',(x,.84,1.65),(.14,.13,1.20),blue,.025)
# Floor expansion joints give the open circulation areas an industrial yard scale.
for y in [-3.05,-2.52]:
 for x in [-4.10,-2.95,-1.80,-.65,.50,1.65,2.80,3.95]:
  cube('courtyard flush stone seam',(x,y,1.046),(1.10,.013,.007),stone,.002)
# Pallet stock belongs in the receiving bay, outside both navigation and actor silhouettes.
for x,y in [(-3.60,-2.67),(-3.09,-2.66)]:
 cube('receiving timber pallet',(x,y,1.11),(.45,.56,.12),wood,.018);cyl('short stored product barrel',(x,y,1.37),.19,.44,purple,20)
 for dz in [1.18,1.55]:cyl('short barrel broad hoop',(x,y,dz),.208,.062,edge,20)
 cyl('stored product barrel lid',(x,y,1.60),.182,.028,cream,20)
# The bottling hall becomes sawtooth industrial architecture with roof seams and clerestory vents.
for x in [-5.16,-4.76,-4.36,-3.96,-3.56,-3.16,-2.76,-2.36,-1.96]:
 beam('bottling standing roof seam',(x,.905,2.80),(x,2.22,3.30),.018,blue)
 beam('bottling rear roof seam',(x,2.22,3.30),(x,3.295,2.93),.018,blue)
for x in [-4.76,-2.34]:
 cube('bottling roof ventilator',(x,2.70,3.13),(.42,.53,.34),blue,.035)
 cube('bottling ventilator cap',(x,2.70,3.34),(.54,.64,.12),cream,.035)
 for z in [3.03,3.13,3.23]:cube('ventilator louvre',(x,2.412,z),(.34,.035,.035),dark,.006)
# Broad awning brackets and warm exterior lamps, enough size to survive small screens.
for x in [-4.97,-2.03]:
 beam('factory sign bracket',(x,1.04,2.61),(x,.78,2.91),.033,copper)
 beam('factory wall lamp arm',(x,1.01,2.27),(x,.75,2.27),.028,blue)
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.15,radius2=.07,depth=.11,location=(x,.71,2.25));assign(bpy.context.object,blue);bpy.context.object.name='warm factory hooded lamp';cyl('factory lamp lens',(x,.71,2.18),.105,.04,white,16)
# A mechanical roller line and filling head make the bottles belong to an actual machine.
for x in [-4.60,-4.22,-3.84,-3.46,-3.08,-2.70]:
 beam('bottling visible roller',(x,.59,1.435),(x,1.01,1.435),.052,edge,16)
 cyl('bottling roller bearing',(x,.571,1.435),.062,.03,copperhi,16).rotation_euler.x=math.pi/2
for x in [-4.77,-2.47]:cube('bottling filling head upright',(x,.93,1.86),(.07,.07,.75),blue,.018)
cube('bottling filling head lintel',(-3.62,.93,2.24),(2.42,.12,.14),edge,.025)
for x in [-4.42,-4.03,-3.64,-3.25,-2.86]:beam('bottle filling spout',(x,.91,2.18),(x,.80,2.04),.026,copperhi)
# Distinct empty glass headspace and a foamy violet liquid level on all three vessels.
for name,x,y,z,r,h in [('main',-.55,3.08,1.36,1.10,3.30),('mixing',-1.30,1.02,1.19,.54,1.56),('pressure',6.50,-.40,1.53,.41,1.38)]:
 cyl(name+' glass headspace',(x,y,z+h*.775),r+.003,h*.18,glass,40)
 for j in range(11 if name=='main' else 7):
  ang=math.pi+math.pi*(j+.5)/(11 if name=='main' else 7);rr=r+.022;xx=x+math.cos(ang)*rr;yy=y+math.sin(ang)*rr
  ico(name+' rounded lilac foam',(xx,yy,z+h*.685+random.uniform(-.028,.025)),(.070 if name=='main' else .042,.06 if name=='main' else .034,.045 if name=='main' else .025),lilac)
 # Rivets belong to the two substantial metal retaining bands.
 for zz in [z+.08,z+h*.84]:
  for j in range(10):
   a=2*math.pi*j/10;xx=x+math.cos(a)*(r+.073);yy=y+math.sin(a)*(r+.073);ico(name+' band fixing',(xx,yy,zz),(.035,.035,.035),cream)
# Product inspection porthole and pressure dial are readable symbols, not tiny text.
def disk(name,x,y,z,r,depth,m):
 o=cyl(name,(x,y,z),r,depth,m,32);o.rotation_euler.x=math.pi/2;return o
def gauge(name,x,y,z,r):
 disk(name+' blue bezel',x,y,z,r,.11,blue);disk(name+' ivory dial',x,y-.064,z,r*.83,.014,cream)
 for a in [-2.35,-1.55,-.78,0,.78]:
  xx=x+math.sin(a)*r*.65;zz=z+math.cos(a)*r*.65;beam(name+' dial tick',(xx,y-.078,zz),(x+math.sin(a)*r*.76,y-.078,z+math.cos(a)*r*.76),.012,dark,8)
 beam(name+' coral needle',(x,y-.093,z),(x+r*.46,y-.093,z+r*.45),.018,coral);disk(name+' needle hub',x,y-.10,z,.034,.018,copperhi)
gauge('pressure maximum manometer',6.50,-.872,2.55,.26)
gauge('main mixing pressure gauge',-.55,1.958,2.38,.245)
# Original crest: droplet above a small proud cream nameplate, no borrowed character graphic.
cube('mixing maker plaque',(-.55,1.952,3.09),(.69,.035,.17),cream,.024);text('mixing maker signature','C',(-.55,1.923,3.09),.13,blue)
# Big red valve wheel in the pressure bay and copper elbows with proper flange joints.
def valve(name,x,y,z,r):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.035,major_segments=24,minor_segments=8,location=(x,y,z),rotation=(math.pi/2,0,0));assign(bpy.context.object,coral);bpy.context.object.name=name+' red handwheel'
 for a in [0,math.pi*2/3,math.pi*4/3]:beam(name+' handwheel spoke',(x,y,z),(x+math.sin(a)*r,y,z+math.cos(a)*r),.024,coral)
 disk(name+' brass spindle',x,y+.03,z,.055,.16,copperhi)
valve('pressure control',6.00,-.75,2.00,.19)
curve('pressure valve feed',[(6.05,-.65,2.0),(5.97,-.65,1.62),(6.03,-.65,1.53),(6.40,-.65,1.53)],.065,copper)
for x,y,z,axis in [(-4.6,3.2,3.25,'Z'),(-3.9,3.2,3.88,'X'),(-2.55,3.2,3.88,'X'),(-1.85,3.2,4.45,'Z'),(-.94,3.2,5.07,'X'),(6.47,.36,2.30,'Z')]:
 d=Vector((1,0,0) if axis=='X' else (0,0,1));p=Vector((x,y,z));beam('copper pipe joining flange',p-d*.055,p+d*.055,.15,copperhi,20)
 for sg in [-1,1]:beam('flange dark gasket',p+d*sg*.067-d*.012,p+d*sg*.067+d*.012,.127,dark,20)
# The rear header has a wall bracket rather than hovering above the roof.
for x,z in [(-4.60,3.62),(-2.25,3.88)]:
 beam('copper header structural bracket',(x,3.25,z-.06),(x,3.25,2.85),.04,blue)
 cube('header bracket base',(x,3.25,2.85),(.26,.24,.09),blue,.025)
# Dry maintenance slope is supported at the terrace transition; all joints are real meshes.
for x,y,z in [(.75,.85,2.37),(1.25,1.45,2.37)]:
 beam('maintenance outer support',(x-.30,y,1.05),(x-.30,y,z-.15),.06,blue)
 beam('maintenance diagonal brace',(x-.30,y,1.12),(x+.27,y,z-.18),.035,edge)
# Quality booth: an inspection bench behind glass, roof fan, antenna, and a clear status beacon.
cube('inspection bench',(3.53,2.48,2.60),(1.80,.12,.12),blue,.018)
for x in [2.79,3.22,3.65]:cube('quality inspection instrument',(x,2.476,2.79),(.25,.07,.21),dark,.02)
for x in [2.74,3.17,3.60]:cube('instrument lime status',(x,2.429,2.81),(.055,.011,.045),lime,.01)
cyl('quality roof fan casing',(3.75,3.25,3.84),.26,.23,edge,24)
cyl('quality roof fan lid',(3.75,3.25,3.98),.33,.08,blue,24)
for x in [2.57,4.94]:cube('quality booth structural edge',(x,2.512,2.93),(.10,.09,1.43),blue,.02)
beam('quality signal mast',(4.97,3.37,3.78),(4.97,3.37,4.28),.035,copper)
cyl('quality ready beacon',(4.97,3.37,4.30),.105,.20,lime,16);cyl('quality beacon cap',(4.97,3.37,4.42),.13,.04,blue,16)
# A low inspection/service machine occupies the recessed space between the two ramps.
# Its height deliberately stays below the raised route's feet.
cube('recessed pump machine',(3.10,.17,1.43),(1.48,.76,.71),blue,.09)
cube('recessed machine cream panel',(3.10,-.226,1.46),(1.18,.04,.41),cream,.04)
for x in [2.73,2.90,3.07]:cube('recessed machine ventilation',(x,-.251,1.46),(.065,.025,.25),dark,.01)
gauge('recessed pump gauge',3.43,-.26,1.46,.13)
curve('low pump copper outlet',[(3.82,.28,1.58),(4.13,.28,1.58),(4.24,.28,1.47),(4.24,.60,1.26)],.065,copper)
# Coast plants grow from cracks in the base, with warm stone at their roots.
for x,y in [(-5.8,2.7),(-6.0,-2.75),(5.80,-2.87),(5.70,2.8),(-1.9,3.99)]:
 for j in range(2):ico('rooted coastal leaf',(x+(j-.5)*.17,y,1.085),(.16,.19,.14),leaf)

# Demonstrated mobile silhouette corrections: move only the outer pressure bay and
# the receiving stock; approved navigation coordinates and camera remain frozen.
for ob in bpy.context.scene.objects:
 if ob.name.startswith('pressure'):ob.location.y+=1.35
 if ob.location.x < -5.95 and ob.name.startswith(('receiving pallet','purple receiving barrel','receiving barrel metal hoop','barrel cream lid')):ob.location.x-=.23
 if ob.name=='large product droplet':ob.location.y-=.10
 if ob.name in {'mixing maker plaque','mixing maker signature'}:ob.location.y-=.10

# Keep the bridge receiving corridor clear without moving its phase landing.
scrub=bpy.data.objects.get('coastal scrub.001')
if scrub: scrub.location.x-=.38

# Camera and color management retain the Costa/Porto toy-model family.
scene=bpy.context.scene;bpy.ops.object.camera_add(location=(11,-20,17.5));cam=bpy.context.object;target=Vector((0,.25,2.25));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20.6;scene.camera=cam
world=bpy.data.worlds.new('warm maritime sky');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('warm key',(-8,-10,18),2100,9,(1,.85,.64)),('sea fill',(8,3,12),1250,8,(.66,.82,1)),('warm rim',(-4,10,13),1500,7,(1,.94,.77))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=192 if FINAL else 16;scene.cycles.use_denoising=False;scene.cycles.max_bounces=6;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100 if FINAL else 50;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
bpy.context.view_layer.update()
def project(co):
 p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
world_routes={'main':[{'from':f'3-{i+1}','to':f'3-{i+2}','world':[list(p) for p in path]} for i,path in enumerate(MAIN)],'secret':[{'from':'3-3','to':'3-5','world':[list(p) for p in SECRET]}]}
meta={'version':1,'world':3,'status':'authored-candidate-for-runtime-review' if FINAL else 'craft-pass-awaiting-visual-review','size':{'width':1920,'height':1200},'coordinateSystem':'Normalized top-left image space; preserve the full 8:5 frame. World Z is up.','camera':{'position':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale},'nodes':{key:{**project(co),'world':list(co),'clearingRadius':.64} for key,co in NODES.items()},'routes':{f'{i}:{i+1}':[project(p) for p in path] for i,path in enumerate(MAIN)},'secretRoute':[project(p) for p in SECRET],'worldRoutes':world_routes,'campaignSources':['src/adventure/campaign.ts','docs/world/campanha.md#M3','docs/world/lore.md','docs/world/conceitos/imagens/03-fabrica-de-suco.png']}
assert all(mod.type!='BOOLEAN' for ob in scene.objects for mod in ob.modifiers)
# Bounded coastal craft enrichment; applied to the fresh model before every
# source-only consumer (bridge/Serra), clearance audit and final export.
enrichment=runpy.run_path(os.path.join(ROOT,'tools/diorama/factory_enrichment.py'))['apply'](globals())
scene['factory_enrichment_invariants']=json.dumps(enrichment)
# Always audit fresh in-memory coordinates; never let a prior metadata file approve a new build.
audit_out=tempfile.mkdtemp(prefix='fabrica-source-audit-') if AUDIT_ONLY else OUT
audit=runpy.run_path(os.path.join(ROOT,'tools/diorama/check_fabrica_clearance.py'),init_globals={'FABRICA_META':meta,'FABRICA_OUT':audit_out,'FABRICA_DOC':audit_out if AUDIT_ONLY else DOC},run_name='__main__');meta=audit['meta']
if AUDIT_ONLY:
 print('FABRICA_AUDIT_ONLY_COMPLETE='+json.dumps({'reports':audit_out,'rendered':False}));sys.exit(0)
scene['fabrica_metadata']=json.dumps(meta)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/fabrica-map-prototype.blend')
scene.render.filepath=os.path.join(OUT,'fabrica-diorama.png' if FINAL else 'fabrica-diorama-preview.png');bpy.ops.render.render(write_still=True)
from array import array
im=bpy.data.images.load(scene.render.filepath,check_existing=False);w,h=im.size;px=array('f',[0])*(w*h*4);im.pixels.foreach_get(px);xs=[];ys=[]
for i in range(w*h):
 if px[i*4+3]>0:xs.append(i%w);ys.append(i//w)
meta['artBounds']={'top':round(1-(max(ys)+1)/h,6),'bottom':round(1-min(ys)/h,6),'left':round(min(xs)/w,6),'right':round((max(xs)+1)/w,6)}
json.dump(meta,open(os.path.join(OUT,'fabrica-diorama.meta.json'),'w'),indent=2)
print('FABRICA_RENDER='+scene.render.filepath)
