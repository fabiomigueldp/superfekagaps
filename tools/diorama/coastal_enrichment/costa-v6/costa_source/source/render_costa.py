"""Original Costa dos Gaps diorama. Blender 4.x: blender -b -t 8 -P tools/diorama/render_costa.py -- [--preview]
All topology is authored procedurally; deterministic seed. Outputs RGBA artwork + camera anchors.
"""
import bpy, bmesh, math, random, json, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
random.seed(4317)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/assets/world/map'); os.makedirs(OUT,exist_ok=True)
PREVIEW='--preview' in sys.argv
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials: bpy.data.materials.remove(data)

def mat(name,color,rough=.85,metal=0):
 color=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in color)
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
sand=mat('warm shell sand',(0.90,.69,.39));sandlight=mat('pale paths',(.99,.83,.53));sandshade=mat('sand edges',(.69,.40,.20))
rock=[mat('sandstone '+str(i),c) for i,c in enumerate([(.68,.36,.18),(.78,.46,.23),(.87,.59,.32),(.93,.68,.41),(.70,.42,.26),(.80,.53,.32)])]
cream=mat('aged warm plaster',(.94,.85,.64));white=mat('ivory paint',(.97,.92,.77));red=mat('coral lighthouse',(.74,.16,.105));redroof=mat('terracotta roof',(.64,.20,.09));roofhi=mat('tile edges',(.83,.31,.12))
grass=[mat('meadow '+str(i),c) for i,c in enumerate([(.27,.45,.08),(.39,.59,.10),(.51,.67,.13),(.35,.53,.09)])]
leaf=[mat('leaf '+str(i),c) for i,c in enumerate([(.12,.33,.11),(.23,.48,.105),(.36,.58,.12),(.50,.68,.14)])]
wood=mat('honey wood',(.41,.22,.10));woodlight=mat('cut timber',(.60,.35,.16));wooddark=mat('timber shadow',(.20,.12,.085));rope=mat('hemp',(.68,.51,.29));iron=mat('dark blue iron',(.07,.14,.17),.38,.35);glass=mat('teal glass',(.09,.42,.49),.23,.20);gold=mat('warm brass',(.9,.57,.15),.3,.5)
flower=[mat('flower '+str(i),c) for i,c in enumerate([(.99,.75,.16),(.92,.39,.34),(.98,.93,.66)])]


def assign(o,m):o.data.materials.append(m);return o

def bevel(o,w=.07,seg=2):
 m=o.modifiers.new('soft handcrafted edge','BEVEL');m.width=w;m.segments=seg
 n=o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL');return o

def cube(name,loc,scale,m,be=.03,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;o.rotation_euler[2]=rot;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m)
 if be:bevel(o,be)
 return o

def ico(name,loc,scale,m,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;assign(o,m);return o

def cyl(name,loc,r,depth,m,n=12,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc);o=bpy.context.object;o.name=name;assign(o,m);bevel(o,.025,2);return o

def line(name,pts,thick,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=thick;c.bevel_resolution=2
 s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);assign(o,m);return o

def beam(name,a,b,r,m,n=8):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,m,n);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def mesh(name,verts,faces,m):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);assign(o,m);return o

# Organic ring geology: contrasting tapered strata and individualized buttress columns.
def island(name,x,y,rx,ry,z,height,n=30,grassy=True,seed=0):
 rng=random.Random(seed);angles=[i*math.tau/n for i in range(n)];rnd=[rng.uniform(.92,1.06) for i in range(n)]
 levels=[(z,.84),(z+height*.12,1),(z+height*.44,.96),(z+height*.77,.99),(z+height,1.025)]
 vs=[]
 for h,sc in levels:
  for i,a in enumerate(angles):vs.append((x+math.cos(a)*rx*rnd[i]*sc,y+math.sin(a)*ry*rnd[i]*sc,h+rng.uniform(-.035,.035)))
 faces=[]
 for j in range(len(levels)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.extend([tuple(range(n-1,-1,-1)),tuple((len(levels)-1)*n+i for i in range(n))]);o=mesh(name,vs,faces,rock[0])
 for m in rock[1:]:o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=rng.choice([0,1,2,2,3,4,5])
 bevel(o,.045,2)
 # Three purposeful sediment ribbons.
 for j in [1,2,3]:
  zh=z+height*([0,.23,.53,.82][j]);coords=[]
  for i,a in enumerate(angles):coords.append((x+math.cos(a)*rx*rnd[i]*1.009,y+math.sin(a)*ry*rnd[i]*1.009,zh))
  line(name+' sediment seam',coords+[coords[0]],.024,rock[1 if j%2 else 3])
 if grassy:
  top=[(x+math.cos(a)*rx*rnd[i]*1.038,y+math.sin(a)*ry*rnd[i]*1.038,z+height+.07) for i,a in enumerate(angles)]
  low=[(a,b,c-.17-rng.random()*.07) for a,b,c in top];cap=mesh(name+' scalloped turf',top+low,[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)],grass[1]);bevel(cap,.055,2)
  # Turf tufts draping over the cliff edge, deliberately sparse and irregular.
  for i,a in enumerate(angles):
   if rng.random()<.67:
    px=x+math.cos(a)*rx*rnd[i];py=y+math.sin(a)*ry*rnd[i];ico('turf lip',(px,py,z+height+.04),(.20,.20,.12),rng.choice(grass),1)
 return z+height+.09

# One continuous sculpted beach footprint, with shallow coves and no stacked disks.
n=64;rng=random.Random(82);rim=[]
for i in range(n):
 a=i*math.tau/n;rad=1+.035*math.sin(5*a)+.025*math.sin(9*a+.7)+.014*math.sin(15*a)
 rim.append((-.1+7.05*math.cos(a)*rad,-.38+4.29*math.sin(a)*rad,.32))
vs=[(-.1,-.38,.335)]+rim+[(x*.973,y*.973,.06) for x,y,z in rim]
fs=[(0,i+1,(i+1)%n+1) for i in range(n)]+[(i+1,n+i+1,n+(i+1)%n+1,(i+1)%n+1) for i in range(n)]
o=mesh('single sculpted sand shoreline',vs,fs,sand);o.data.materials.append(rock[3])
for p in o.data.polygons:
 if p.index>=n:p.material_index=1
bevel(o,.06,3)
# Main stepped terraces and distinct western headland. Gap beneath bridge is real.
island('western bridge headland',-4.5,.6,1.3,1.8,.29,2.65,26,True,5)
island('central green backbone',-.25,1.35,1.60,1.75,.29,2.55,28,True,8)
island('east lower climbing terrace',3.65,-.65,2.25,1.6,.28,2.42,34,True,22)
island('east lighthouse bastion',3.4,2.15,1.45,1.92,.3,4.28,32,True,53)
island('far west low outcrop',-6.1,1.85,.8,1.13,.30,1.3,14,True,54)
island('right sea stack',6.3,.8,.85,.75,.12,1.18,14,True,12)
# Individually cleft vertical cliff buttresses. Flattened taper, warm rock strata.
for x,y,z,sx,sy,sz in [(-5.4,-.85,1.25,.60,.52,1.27),(-1.1,.04,1.24,.55,.57,1.17),(5.5,-1.65,1.25,.59,.52,1.4),(4.4,.82,3.6,.44,.58,.95)]:
 ico('split sandstone buttress',(x,y,z),(sx,sy,sz),random.choice(rock),2)
# Monumental natural sea arch: irregular voussoir rock, continuous extruded curved band.
archx=-.6; archy=-2.20; yfront=archy-.5;yback=archy+.4;n=19
outer=[];inner=[]
for i in range(n):
 a=math.pi-i*math.pi/(n-1);outer.append((archx+1.82*math.cos(a),.38+2.35*math.sin(a)));inner.append((archx+1.02*math.cos(a),.35+1.64*math.sin(a)))
vs=[]
for yy in [yfront,yback]:
 for curve in [outer,inner]:vs.extend([(x,yy,z) for x,z in curve])
fs=[]
for i in range(n-1):
 fs.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
fs.extend([(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)]);o=mesh('wind carved sandstone arch',vs,fs,rock[3])
for m in rock:o.data.materials.append(m)
for p in o.data.polygons:p.material_index=random.choice([1,2,3,3,4,5,6])
bevel(o,.06,2)
# Angular masonry-like stone irregularities break a perfect ring silhouette.
for i in [2,4,6,8,10,12,15]:
 x,z=outer[i];ico('arch weathered ridge',(x,archy-.46,z-.15),(.27,.20,.24),random.choice(rock[1:]),1)
for i in range(14):
 a=random.uniform(.25,math.pi-.25);ico('arch crown foliage',(archx+1.65*math.cos(a),archy+random.uniform(-.25,.25),.44+2.35*math.sin(a)),(.22,.32,.13),random.choice(grass),1)

# Five generous natural circular stopping clearings, exported exactly from camera.
NODES={'1-1':(-5.25,-2.75,.385),'1-2':(-4.55,.25,3.08),'1-3':(-.55,-3.63,.385),'1-4':(3.80,-1.32,2.80),'1-5':(2.90,1.36,4.72)}
for key,(x,y,z) in NODES.items():
 o=cyl('natural clearing '+key,(x,y,z),.60,.024,sandlight,32);o.scale.y=.89
 # Little rim stones read as part of the terrain, never artificial UI markers.
 for i in range(6):
  a=i*math.tau/6+random.uniform(-.12,.12);ico('clearing edge pebble',(x+.72*math.cos(a),y+.64*math.sin(a),z+.055),(.105,.08,.058),rock[3],1)

# Broad footpaths lie flush with ground. Winding stairs climb the side of each terrace.
def trail(points,width=.22):
 # Flat, gently curved ribbon with thin edges, never a round tube.
 pts=[Vector(p) for p in points];smooth=[]
 for i in range(len(pts)-1):
  p0,p1,p2,p3=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
  for j in range(6):
   t=j/6;smooth.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
 smooth.append(pts[-1]);vs=[]
 for i,p in enumerate(smooth):
  d=smooth[min(i+1,len(smooth)-1)]-smooth[max(0,i-1)];side=Vector((-d.y,d.x,0)).normalized()*width
  vs.extend([tuple(p+side+Vector((0,0,.008))),tuple(p-side+Vector((0,0,.008)))])
 fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(smooth)-1)]
 o=mesh('worn sandstone footpath',vs,fs,sandlight);sol=o.modifiers.new('thin worn trail','SOLIDIFY');sol.thickness=.022

# Beach route to west stairs.
trail([(-5.25,-2.75,.375),(-5.40,-2.10,.38),(-6.02,-1.96,.39)],.30)
# Stone steps, each separately beveled; continuous ascent can be read from a distance.
STAIR_ROUTES=[]
def steps(name,points,width=.84,treadmat=None):
 treadmat=treadmat or sandlight;STAIR_ROUTES.append((name,points,width))
 pts=[Vector(p) for p in points]
 # Routes stand fully outside deliberately shaped cliff footprints; no Boolean cuts.
 # Smooth the walking centerline, then distribute shared-edge winder treads by arc length.
 dense=[]
 for i in range(len(pts)-1):
  p0,p1,p2,p3=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
  for j in range(24):
   t=j/24;dense.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
 dense.append(pts[-1]);dist=[0]
 for i in range(1,len(dense)):dist.append(dist[-1]+(dense[i]-dense[i-1]).length)
 n=max(3,int(dist[-1]/.17));bounds=[];cursor=0
 for i in range(n+1):
  want=dist[-1]*i/n
  while cursor<len(dist)-2 and dist[cursor+1]<want:cursor+=1
  t=(want-dist[cursor])/max(.000001,dist[cursor+1]-dist[cursor]);bounds.append(dense[cursor].lerp(dense[cursor+1],t))
 sides=[]
 for i,p in enumerate(bounds):
  d=bounds[min(i+1,n)]-bounds[max(0,i-1)];sides.append(Vector((-d.y,d.x,0)).normalized()*width/2)
 verts=[];faces=[];mats=[]
 for i in range(n):
  a,b=bounds[i],bounds[i+1];za=(a.z+b.z)/2
  if i==0:za=pts[0].z
  if i==n-1:za=pts[-1].z
  quad=[a-sides[i],a+sides[i],b+sides[i+1],b-sides[i+1]];base=len(verts)
  verts.extend([(p.x,p.y,za) for p in quad]+[(p.x,p.y,.325) for p in quad])
  # Each top meets its neighboring tread at exactly the same horizontal edge.
  faces.extend([tuple(base+j for j in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]]);mats.extend([0,1,1,1,1,1])
 ob=mesh(name+' continuous supported treads',verts,faces,treadmat);ob.data.materials.append(rock[2])
 for p,mi in zip(ob.data.polygons,mats):p.material_index=mi
 bevel(ob,.012,2)
steps('west ascent carved step',[(-6.02,-1.96,.43),(-6.48,-1.10,1.14),(-6.58,-.20,1.93),(-6.39,.47,2.59),(-5.92,.72,3.08)],.82)
trail([(-5.92,.72,3.08),(-5.42,.27,3.08),(-4.55,.25,3.08),(-3.30,.57,3.05)],.28)
# Suspended rope bridge, built from distinct planks with sag and actual side ropes.
def bridge(name,a,b,width=.79,sag=.15):
 a,b=Vector(a),Vector(b);d=b-a;lat=Vector((-d.y,d.x,0)).normalized();count=max(7,int(d.length/.24))
 def p(t,side=0):return a+d*t+lat*side+Vector((0,0,-sag*math.sin(math.pi*t)))
 for i in range(count):
  t=(i+.5)/count;q=p(t);angle=math.atan2(d.y,d.x);o=cube(name+' plank',q,(d.length/count*.89,width,.11),woodlight if i%3 else wood,.026,angle)
 for side in [-width*.57,width*.57]:
  pts=[tuple(p(i/30,side)+Vector((0,0,.64))) for i in range(31)];line(name+' sagging upper rope',pts,.035,rope)
  line(name+' load bearing cable',[tuple(p(i/30,side)+Vector((0,0,.04))) for i in range(31)],.030,rope)
  for i in range(count+1):
   t=i/count;q=p(t,side);line(name+' rope tie',[tuple(q+Vector((0,0,.05))),tuple(q+Vector((0,0,.63)))],.021,rope)
  for t in [0,1]:
   q=p(t,side);cyl(name+' anchor timber',(q.x,q.y,q.z+.35),.07,.95,wood,8);cyl(name+' brass cap',(q.x,q.y,q.z+.845),.087,.075,gold,12)
bridge('western gap bridge',(-3.30,.57,3.12),(-1.68,.70,3.08),.90)
trail([(-1.68,.7,3.0),(-1.36,.54,2.99)],.29)
steps('arch descent carved step',[(-1.36,.54,2.99),(-1.45,-.05,2.96),(-2.26,-.58,2.34),(-3.05,-.93,1.63),(-3.31,-1.67,.96),(-3.31,-2.44,.43)],.86)
trail([(-3.31,-2.44,.385),(-2.87,-3.19,.385),(-1.63,-3.53,.385),(-.55,-3.63,.385),(.53,-3.36,.385),(1.75,-3.10,.385)],.28)
# Right stair runs up visible cliff face, with short landing doglegs.
steps('east ascent carved step',[(1.75,-3.10,.44),(2.80,-3.10,1.17),(4.00,-2.99,1.95),(4.80,-2.62,2.59),(5.02,-2.14,2.83)],.88)
cube('east stair open arrival landing',(4.91,-2.08,1.565),(.82,.72,2.49),rock[2],.022)
trail([(5.02,-2.14,2.83),(4.61,-1.77,2.83),(3.8,-1.32,2.83),(3.21,-.79,2.83),(2.4,-.30,2.83)],.28)
steps('highpoint climbing step',[(2.4,-.3,2.85),(1.58,.0,3.31),(1.10,.54,3.81),(1.19,1.12,4.26),(1.77,1.4,4.73)],.88)
bridge('lighthouse approach bridge',(1.79,1.40,4.76),(2.55,1.40,4.76),.94,sag=.0)
trail([(3.23,1.80,4.74),(3.40,2.0,4.74)],.18) # End at the clearing rim; avoid folded/coplanar ribbons over its center.
# Narrow but physically supported secret ledge climb: outside the arch's east pier.
# It bypasses the east clearing, then shares the open lighthouse ascent.
SECRET_POINTS=[(1.65,-2.93,.48),(1.65,-2.38,.91),(1.43,-1.95,1.36),(1.13,-1.53,1.81),(.90,-.95,2.31),(.95,-.45,2.84),(1.60,-.45,2.84)]
steps('secret ledge climb',SECRET_POINTS,.44,treadmat=rock[3])
cube('secret branch beach landing',(1.67,-3.02,.40),(1.02,.74,.14),sandlight,.035)
trail([(1.60,-.45,2.84),(1.98,-.40,2.84),(2.4,-.30,2.85)],.17)

# Dock in right foreground, small but fully constructed.
cube('dock shore approach step',(5.55,-1.86,.37),(.92,.20,.07),woodlight,.02)
cube('dock shore upper step',(5.55,-2.05,.445),(1.06,.22,.17),woodlight,.02)
for i in range(11):cube('dock weathered plank',(5.56,-2.2-i*.22,.6),(1.13,.196,.11),woodlight if i%3 else wood,.025)
for x in [5.10,6.03]:
 for y in [-2.21,-3.31,-4.36]:
  cyl('dock pile',(x,y,.53),.09,1.30,wood,9);cyl('pile cut end',(x,y,1.21),.113,.075,woodlight,12)
 line('dock mooring rope',[(x,-2.23,1.02),(x,-2.8,.83),(x,-3.31,1.02),(x,-3.83,.82),(x,-4.36,1.02)],.025,rope)
for x,y in [(5.43,-2.36),(5.61,-2.71)]:
 cyl('dock barrel',(x,y,.88),.20,.46,woodlight,14);cyl('barrel iron band',(x,y,.80),.207,.035,iron,14);cyl('barrel iron band',(x,y,1.02),.207,.035,iron,14)
# Mooring ring and coiled rope.
bpy.ops.mesh.primitive_torus_add(major_radius=.13,minor_radius=.018,major_segments=20,minor_segments=6,location=(5.63,-3.7,.68));assign(bpy.context.object,rope)

# Lighthouse and keeper's cottage on highest grassy headland.
lx,ly,lz=3.75,2.15,4.74
cyl('lighthouse footing',(lx,ly,lz+.1),.68,.20,rock[3],24)
for i in range(6):
 z=lz+.2+(i+.5)*.43;r=.51-i*.030;r2=.51-(i+1)*.030;cyl('lighthouse broad painted band',(lx,ly,z),r,.436,white if i%2==0 else red,24,r2)
# Entrance on front face, deep dark inset + wooden panel.
cube('lighthouse door surround',(lx,ly-.475,lz+.48),(.38,.08,.69),cream,.06)
cube('lighthouse door',(lx,ly-.526,lz+.445),(.25,.03,.52),wooddark,.045)
for z,xx in [(lz+1.23,lx-.04),(lz+2.07,lx+.035)]:
 cube('lighthouse small window trim',(xx,ly-(.43 if z<lz+2 else .365),z),(.22,.045,.34),cream,.024)
 cube('lighthouse blue window',(xx,ly-(.46 if z<lz+2 else .394),z),(.13,.024,.23),glass,.02)
# Lantern room, balcony, handrail and octagonal lantern panes.
top=lz+2.82
cyl('lighthouse balcony',(lx,ly,top),.64,.14,cream,24)
cyl('lantern glass chamber',(lx,ly,top+.33),.35,.58,glass,12)
cyl('lantern inner glow',(lx,ly,top+.31),.11,.40,gold,12)
for i in range(12):
 a=i*math.tau/12;xx=lx+.56*math.cos(a);yy=ly+.56*math.sin(a);cyl('balcony slender rail',(xx,yy,top+.26),.020,.48,iron,6)
 if i%2==0:beam('lantern glazing bar',(lx+.355*math.cos(a),ly+.355*math.sin(a),top+.05),(lx+.355*math.cos(a),ly+.355*math.sin(a),top+.63),.025,cream)
line('continuous balcony railing',[(lx+.56*math.cos(i*math.tau/48),ly+.56*math.sin(i*math.tau/48),top+.50) for i in range(49)],.027,iron)
cyl('lantern roof eave',(lx,ly,top+.65),.51,.12,redroof,16)
cyl('lighthouse pointed roof',(lx,ly,top+.90),.51,.48,red,16,.025)
beam('weathervane',(lx,ly,top+1.1),(lx,ly,top+1.40),.035,iron)
ico('finial brass ball',(lx,ly,top+1.44),(.07,.07,.07),gold,2)
# One small triangular pennant.
mesh('red pennant',[(lx,ly,top+1.36),(lx+.45,ly,top+1.32),(lx,ly,top+1.19)],[(0,1,2)],red)
# Cottage to the rear-left, house dimensions deliberately village scale.
hx,hy,hz=2.63,2.90,4.72
cube('keeper cottage plaster',(hx,hy,hz+.51),(1.17,.92,1.04),cream,.055)
# Gable roof along X, tiled strips along slope.
vs=[(hx-.69,hy-.60,hz+1.01),(hx+.69,hy-.60,hz+1.01),(hx+.69,hy,hz+1.46),(hx-.69,hy,hz+1.46),(hx-.69,hy+.60,hz+1.01),(hx+.69,hy+.60,hz+1.01)]
mesh('keeper pitched tile roof',vs,[(0,1,2,3),(3,2,5,4)],redroof)
for gx in [hx-.59,hx+.59]:mesh('house end gable',[(gx,hy-.47,hz+.98),(gx,hy+.47,hz+.98),(gx,hy,hz+1.42)],[(0,1,2)],cream)
for i in range(12):
 x=hx-.65+i*.118
 for sy in [-1,1]:beam('individual terracotta tile rib',(x,hy,hz+1.48),(x,hy+sy*.61,hz+1.015),.042,roofhi,8)
for j in range(1,4):
 for sy in [-1,1]:line('roof horizontal tile overlap',[(hx-.68,hy+sy*j*.145,hz+1.46-j*.108),(hx+.68,hy+sy*j*.145,hz+1.46-j*.108)],.015,redroof)
cube('keeper door',(hx+.20,hy-.481,hz+.36),(.29,.045,.66),wood,.025)
cube('keeper window surround',(hx-.32,hy-.485,hz+.65),(.30,.055,.35),white,.025)
cube('keeper teal window',(hx-.32,hy-.52,hz+.65),(.21,.023,.26),glass,.01)
beam('window cross vertical',(hx-.32,hy-.54,hz+.52),(hx-.32,hy-.54,hz+.78),.016,cream)
beam('window cross horizontal',(hx-.42,hy-.54,hz+.65),(hx-.22,hy-.54,hz+.65),.016,cream)
cube('cottage chimney',(hx+.36,hy+.17,hz+1.48),(.21,.21,.60),cream,.025);cube('chimney cap',(hx+.36,hy+.17,hz+1.81),(.29,.28,.10),redroof,.025)

# Curving coconut palms with segmented warm trunks and individually shaped folded fronds.
def palm(name,x,y,z,scale=1,lean=(.3,.0)):
 h=2.20*scale;pts=[]
 for i in range(11):
  t=i/10;pts.append(Vector((x+lean[0]*t*t,y+lean[1]*t*t,z+h*t)))
 for i in range(10):
  a,b=pts[i],pts[i+1];beam(name+' trunk segment',a,b,(.115-.03*i/10)*scale,woodlight,9)
  cyl(name+' trunk growth collar',b,(.124-.03*i/10)*scale,.035*scale,wood,10)
 top=pts[-1]
 for i in range(8):
  a=i*math.tau/8+random.uniform(-.14,.14);L=random.uniform(.92,1.37)*scale;w=.27*scale;direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
  vs=[];ns=7
  for j in range(ns):
   t=j/(ns-1);center=top+direction*L*t+Vector((0,0,scale*(.40*math.sin(t*math.pi)-.26*t)))
   wid=w*math.sin(t*math.pi)**.7;vs.extend([tuple(center-side*wid+Vector((0,0,-.07*scale))),tuple(center+Vector((0,0,.055*scale))),tuple(center+side*wid+Vector((0,0,-.07*scale)))])
  faces=[]
  for j in range(ns-1):faces.extend([(j*3,j*3+1,(j+1)*3+1,(j+1)*3),(j*3+1,j*3+2,(j+1)*3+2,(j+1)*3+1)])
  ob=mesh(name+' folded leaf',vs,faces,leaf[(i+1)%4]);sol=ob.modifiers.new('leaf thickness','SOLIDIFY');sol.thickness=.012
  line(name+' leaf central vein',[tuple(top+direction*L*j/6+Vector((0,0,scale*(.40*math.sin(j/6*math.pi)-.26*j/6)+.06))) for j in range(7)],.012*scale,leaf[2])
 for dx,dy in [(-.13,0),(.10,.11),(.12,-.13)]:ico('coconut',top+Vector((dx,dy,-.13)),(.13*scale,.13*scale,.15*scale),wooddark,2)
for args in [('arrival palm',-5.85,-2.62,.40,.83,(.28,.05)),('western crown palm',-5.05,1.27,3.04,1.04,(-.3,.07)),('western companion',-3.73,1.23,3.03,.66,(.18,.05)),('backbone palm',-.4,2.28,2.95,.88,(-.15,.09)),('east beach palm',5.85,-.7,.36,.83,(.17,-.03)),('lighthouse palm',4.2,3.01,4.69,.63,(.20,.04))]:palm(*args)

# Clumps have designed silhouettes: broad leaves, succulent fans, flowering meadow cushions.
def bush(x,y,z,s=.5):
 for dx,dy,dz,sc in [(-.21,0,.1,.73),(.19,.08,.14,.83),(0,-.13,.23,1)]:ico('rounded coastal shrub',(x+dx*s,y+dy*s,z+dz*s),(.46*s*sc,.38*s*sc,.43*s*sc),random.choice(leaf[:3]),2)
def agave(x,y,z,s=.6):
 for i in range(7):
  a=i*math.tau/7;L=random.uniform(.4,.7)*s;v=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0));p=Vector((x,y,z));mesh('coastal aloe blade',[tuple(p),tuple(p+v*L*.35+side*.10*s+Vector((0,0,.31*s))),tuple(p+v*L+Vector((0,0,.25*s))),tuple(p+v*L*.35-side*.10*s+Vector((0,0,.31*s)))],[(0,1,2),(0,2,3)],random.choice(leaf))
for x,y,z,s in [(-5.4,1.64,3.06,.65),(-4.05,1.85,3.08,.8),(-3.40,1.20,3.02,.40),(-1.0,2.85,2.95,.7),(-.2,1.0,2.96,.60),(2.3,-1.50,2.8,.65),(5.1,-.1,2.83,.65),(4.1,.75,4.73,.63),(2.6,3.4,4.72,.62),(-2.28,-2.67,.4,.48),(-6.2,-3.1,.4,.40)]:bush(x,y,z,s)
for x,y,z,s in [(-6.65,-2.58,.4,.7),(-4.42,-1.8,.36,.85),(-3.85,-3.20,.38,.75),(4.74,-2.88,.37,1),(5.04,-.77,2.8,.85),(-1.73,1.77,2.96,.9),(2.5,2.2,4.7,.50)]:agave(x,y,z,s)
# Little flowers tucked away from route, with discrete stalk and five-petal shapes.
for x,y,z in [(-5.2,1.88,3.1),(-4.0,-.64,3.1),(-.4,1.3,2.98),(4.65,-.95,2.86),(4.8,.2,2.86),(3.3,.53,4.74),(2.75,3.25,4.76),(-4.3,-2.8,.41)]:
 for j in range(5):
  xx=x+random.uniform(-.24,.24);yy=y+random.uniform(-.21,.21);zz=z+random.uniform(.15,.25);beam('flower stem',(xx,yy,z),(xx,yy,zz),.009,leaf[0],5)
  m=random.choice(flower)
  for k in range(5):ico('wildflower petal',(xx+.04*math.cos(k*math.tau/5),yy+.04*math.sin(k*math.tau/5),zz),(.043,.043,.026),m,1)
  ico('flower heart',(xx,yy,zz+.013),(.018,.018,.015),gold,1)
# Foliage cascades down cliff cracks, tying the meadow caps into sandstone.
for x,y,z,L in [(-5.60,-.69,2.97,.72),(-3.60,-.88,2.97,.52),(-1.27,-.21,2.88,.56),(2.92,-2.64,2.75,.57),(4.80,-2.02,2.73,.75),(4.0,.55,4.66,.63),(3.1,.35,4.64,.92)]:
 pts=[(x+.05*math.sin(j),y-.025*j,z-L*j/6) for j in range(7)];line('trailing cliff vine',pts,.018,leaf[0])
 for j in range(1,7):
  px,py,pz=pts[j];ico('trailing coastal leaf',(px+(.072 if j%2 else -.072),py-.026,pz),(.11,.055,.075),leaf[(j%2)+1],1)
# Pebbles, shell fragments and tidewashed boulders along the shore.
for x,y,s in [(-6.86,-2.25,.32),(-5.42,-3.85,.26),(-4.10,-3.66,.22),(-2.4,-3.94,.20),(1.5,-4.09,.25),(2.9,-3.6,.22),(3.8,-3.72,.33),(6.55,-1.9,.45),(-6.86,.2,.45)]:
 ico('tide worn sandstone boulder',(x,y,.28+s*.48),(s,s*.77,s*.71),rock[4],2)
for i in range(60):
 a=random.uniform(0,math.tau);x=-.3+math.cos(a)*random.uniform(6.0,6.6);y=-.65+math.sin(a)*random.uniform(3.45,3.95)
 if x>4.7 and y<-2:continue
 ico('beach small shell',(x,y,.36),(random.uniform(.04,.09),random.uniform(.03,.07),.025),random.choice([cream,rock[3],sandlight]),1)
# A pair of red sea stars, tiny storytelling details with no glyphs.
for x,y in [(-3.8,-3.23),(2.42,-3.73)]:
 vs=[(x,y,.4)]+[(x+(.16 if i%2==0 else .058)*math.cos(i*math.pi/5),y+(.16 if i%2==0 else .058)*math.sin(i*math.pi/5),.39) for i in range(10)];mesh('coral sea star',vs,[(0,i+1,(i+1)%10+1) for i in range(10)],red)

# Stratum colors are built into the rock faces. Remove decorative seam cords so
# none can hang across a genuinely cut stair opening.
for ob in list(bpy.context.scene.objects):
 if ob.type=='CURVE' and 'sediment seam' in ob.name:bpy.data.objects.remove(ob,do_unlink=True)

# Camera: elevated three-quarter view, purposely generous margin for compositing.
scene=bpy.context.scene
bpy.ops.object.camera_add(location=(11,-20,17.5));cam=bpy.context.object;cam.name='diorama orthographic camera';target=Vector((0,0,2.7));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20.6;scene.camera=cam
world=bpy.data.worlds.new('soft sea sky');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6

def area(name,loc,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('large warm key',(-8,-10,18),2100,9,(1,.85,.64));area('blue sky fill',(8,3,12),1250,8,(.66,.82,1));area('warm crown rim',(-4,10,13),1500,7,(1,.94,.77))
scene.render.engine='CYCLES';scene.cycles.samples=48 if PREVIEW else 192;scene.cycles.use_denoising=False
scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=50 if PREVIEW and "--qa" not in sys.argv else 100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=35
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
scene.render.fps=30
# Embed all precise marker and trail geometry in a public implementation contract.
def project(co):
 p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
ROUTES={
 'main':[
 ['1-1','1-2',[NODES['1-1'],(-5.40,-2.10,.40),(-6.02,-1.96,.46),(-6.48,-1.10,1.18),(-6.58,-.20,1.97),(-6.39,.47,2.63),(-5.92,.72,3.10),(-5.42,.27,3.10),NODES['1-2']]],
 ['1-2','1-3',[NODES['1-2'],(-3.30,.57,3.16),(-1.68,.70,3.12),(-1.36,.54,3.02),(-1.45,-.05,2.99),(-2.26,-.58,2.38),(-3.05,-.93,1.67),(-3.31,-1.67,1.00),(-3.31,-2.44,.47),(-2.87,-3.19,.43),(-1.63,-3.53,.43),NODES['1-3']]],
 ['1-3','1-4',[NODES['1-3'],(.53,-3.36,.43),(1.75,-3.10,.48),(2.80,-3.10,1.21),(4.00,-2.99,1.99),(4.80,-2.62,2.63),(5.02,-2.14,2.87),(4.61,-1.77,2.87),NODES['1-4']]],
 ['1-4','1-5',[NODES['1-4'],(3.21,-.79,2.87),(2.4,-.30,2.89),(1.58,.0,3.35),(1.10,.54,3.85),(1.19,1.12,4.30),(1.79,1.4,4.80),(2.55,1.4,4.80),NODES['1-5']]]],
 'secret':[['1-3','1-5',[NODES['1-3'],(.53,-3.36,.43),(1.65,-2.93,.52),(1.65,-2.38,.95),(1.43,-1.95,1.40),(1.13,-1.53,1.85),(.90,-.95,2.35),(.95,-.45,2.88),(1.60,-.45,2.88),(1.98,-.40,2.88),(2.4,-.30,2.89),(1.58,.0,3.35),(1.10,.54,3.85),(1.19,1.12,4.30),(1.79,1.4,4.80),(2.55,1.4,4.80),NODES['1-5']]]]
}
metadata={'version':1,'size':{'width':1920,'height':1200},'coordinateSystem':'Normalized image space, top-left origin; render full image without crop. World uses Z up.','camera':{'position':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale},'nodes':{k:{**project(v),'world':list(v),'clearingRadius':.60} for k,v in NODES.items()},'routes':{str(i)+':'+str(i+1):[project(p) for p in pts] for i,(_,_,pts) in enumerate(ROUTES['main'])},'secretRoute':[project(p) for p in ROUTES['secret'][0][2]],'worldRoutes':{kind:[{'from':a,'to':b,'world':[list(p) for p in pts]} for a,b,pts in paths] for kind,paths in ROUTES.items()}}
with open(os.path.join(OUT,'costa-diorama.meta.json'),'w') as f:json.dump(metadata,f,indent=2)
import runpy
runpy.run_path(os.path.join(ROOT,'tools/diorama/check_clearance.py'),run_name='__main__')
bpy.ops.wm.save_as_mainfile(filepath='/tmp/costa-diorama-source.blend')
if '--staged' in sys.argv and not PREVIEW:
 scene.render.resolution_percentage=50;scene.cycles.samples=32;scene.render.filepath=os.path.join(OUT,'costa-diorama-preview.png');bpy.ops.render.render(write_still=True)
 scene.render.resolution_percentage=100;scene.cycles.samples=192
scene.render.filepath=os.path.join(OUT,'costa-diorama-preview.png' if PREVIEW else 'costa-diorama.png');bpy.ops.render.render(write_still=True)
print('DIORAMA_METADATA='+json.dumps(metadata['nodes']))

# Independent RGBA contact shadow layer, same camera and exact canvas.
if not PREVIEW:
 for ob in list(scene.objects):
  if ob.type in {'MESH','CURVE'}: ob.visible_camera=False
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.04));shadow=bpy.context.object;shadow.name='separate contact shadow catcher';shadow.is_shadow_catcher=True;assign(shadow,mat('ocean shadow receiver',(.30,.60,.65)))
 scene.cycles.samples=24;scene.render.filepath=os.path.join(OUT,'costa-shadow.png');bpy.ops.render.render(write_still=True)

if not PREVIEW:
 import runpy
 runpy.run_path(os.path.join(ROOT,"tools/diorama/polish_shadow.py"),run_name="__main__")
