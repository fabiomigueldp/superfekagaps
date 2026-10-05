"""Author the expansion's actual 3D geography and export its camera-projected map.

Run in a NEW background Blender: blender -b --python tools/delicia/build_island.py
Never operates on the user's open Blender scene. Units are meters; geometry is
42m wide versus the released islands' approximately 20m camera footprint.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/delicia'
SOURCE = ROOT / 'docs/world/delicia'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(4471)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def mat(name, hex_color, metal=0, rough=.7, glow=0):
    h=hex_color.lstrip('#'); srgb=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
    rgb=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb)
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if glow:p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=glow
    if rough>.55:
        noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=6;noise.inputs['Detail'].default_value=2
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.075
        m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m
M={k:mat(k,c,metal,rough,glow) for k,c,metal,rough,glow in [
    ('sand','#E4BA78',0,.85,0),('stone','#C67843',0,.85,0),('strata','#9E523A',0,.9,0),('cream','#F8DEAB',0,.75,0),
    ('grass','#76954A',0,.85,0),('leaf','#3E703C',0,.8,0),('leaf-light','#72944C',0,.8,0),('bark','#775239',0,.8,0),
    ('orange','#FA932C',0,.38,0),('juice','#EEAA27',.12,.21,.12),('foam','#FFE9A3',0,.4,.1),('teal','#205954',.3,.46,0),
    ('dark','#233E3B',.4,.5,0),('brass','#CC9B45',.7,.34,0),('gold','#F2C857',.5,.3,0),('roof','#B85736',0,.78,0),
    ('wood','#A77640',0,.78,0),('glass','#A0DAC6',.35,.2,.15),('purple','#65446E',0,.6,0),('light','#FFF0BB',0,.4,2),
]}

def finish(obj,name,material):
    obj.name=name;obj.data.materials.append(M[material]);return obj
def bevel(obj,size=.07):
    mod=obj.modifiers.new('Crafted rounded edges','BEVEL');mod.width=size;mod.segments=2
    return obj
def cube(name,loc,size,material,edge=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=finish(bpy.context.object,name,material);o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if edge:bevel(o,edge)
    return o
def ico(name,loc,scale,material,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=finish(bpy.context.object,name,material);o.scale=scale
    if sub>=2:
        for polygon in o.data.polygons:polygon.use_smooth=True
    return o
def cylinder(name,loc,r,depth,material,n=16,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,material)
def beam(name,a,b,r,material):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)*.5,r,(b-a).length,material,10);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def path(name,points,r,material):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=2
    p=data.splines.new('POLY');p.points.add(len(points)-1)
    for dest,src in zip(p.points,points):dest.co=(*src,1)
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(M[material]);return o
def torus(name,loc,major,minor,material,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=6,location=loc,rotation=rotation)
    return finish(bpy.context.object,name,material)
def mesh(name,verts,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(M[material]);return o

def plateau(name,x,y,rx,ry,z,height,grass=True):
    n=44; jitter=[rng.uniform(.94,1.065) for _ in range(n)];vs=[]
    rings=[(z,.82),(z+height*.25,.98),(z+height*.6,1),(z+height,.96)]
    for h,scale in rings:
        for i in range(n):
            a=i*math.tau/n;vs.append((x+math.cos(a)*rx*scale*jitter[i],y+math.sin(a)*ry*scale*jitter[i],h))
    fs=[]
    for j in range(3):
        for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    fs += [tuple(range(n-1,-1,-1)),tuple(3*n+i for i in range(n))]
    o=mesh(name,vs,fs,'stone');o.data.materials.append(M['strata']);o.data.materials.append(M['sand'])
    for p in o.data.polygons:p.material_index=0 if p.index//n==1 else 1 if p.index//n==0 else 2
    bevel(o,.075)
    cap=[(vx,vy,vz+.06) for vx,vy,vz in vs[-n:]];mesh(name+' turf',cap,[tuple(range(n))],'grass' if grass else 'cream')
    for seam,h in enumerate((.28,.65)):
        points=[(x+math.cos(i*math.tau/n)*rx*jitter[i]*.995,y+math.sin(i*math.tau/n)*ry*jitter[i]*.995,z+height*h) for i in range(n)]
        path(name+' mineral seam '+str(seam),points+[points[0]],.035,'strata')
    return z+height+.08

# One large linked landmass, with a readable progression from harbor to throne.
base=plateau('Great citrus island foundation',0,0,20.3,14.4,-1.6,3.4)
west=plateau('Terraced orchard',-8,3,9,7,1.4,2.5)
center=plateau('Aqueduct heart',0,1,7,7,1.5,3.5)
east=plateau('Refinery foothill',10,2,8,8,1.3,3.1,False)
citadel=plateau('Guina crown rock',10,8,5.5,5.2,4.2,3,False)
low=plateau('Harbor terrace',-11,-8,7.5,5,1,1.2,False)
south=plateau('Orange delta',3,-7,9,5,1.2,1.3)

def orange_tree(x,y,z,size=1):
    cylinder('Orchard trunk',(x,y,z+.8*size),.13*size,1.6*size,'bark',9)
    for dx,dy,dz,sc in [(-.4,0,1.9,.9),(.35,.1,2.1,1),(0,-.4,2.4,.88)]:
        ico('Layered citrus foliage',(x+dx*size,y+dy*size,z+dz*size),(sc*size,sc*size,.8*size),'leaf' if dx<0 else 'leaf-light',2)
    for j in range(7):
        a=j*2.39;ico('Fruit on branches',(x+math.cos(a)*.75*size,y+math.sin(a)*.72*size,z+(2.0+(j%3)*.22)*size),(.15*size,)*3,'orange',2)
def house(x,y,z,scale=1):
    cube('Island village plaster',(x,y,z+.8*scale),(1.6*scale,1.5*scale,1.6*scale),'cream',.08)
    roof=mesh('Terracotta gabled roof',[(x+a*scale,y+b*scale,z+c*scale) for a,b,c in [(-.95,-.9,1.6),(.95,-.9,1.6),(.95,.9,1.6),(-.95,.9,1.6),(0,-.9,2.3),(0,.9,2.3)]],[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4)],'roof')
    bevel(roof,.035)
    cube('Dark doorway',(x,y-.763*scale,z+.48*scale),(.42*scale,.05,.96*scale),'teal',.04)
    for dx in (-.5,.5):cube('Village green shutters',(x+dx*scale,y-.766*scale,z+1.1*scale),(.26*scale,.055,.38*scale),'teal',.025)
    cylinder('Chimney',(x+.5*scale,y+.3*scale,z+2.0*scale),.12*scale,.8*scale,'cream',10)

for row in range(5):
    for col in range(7):orange_tree(-14.8+col*1.6+rng.uniform(-.2,.2),.1+row*1.7,west,.6+rng.random()*.27)
for x,y,z in [(-16,-7,low),(-14,-9,low),(-10,-9,low),(-8,-7,low),(-6,-9,low),(-5,4,west),(-10,6,west),(5,-7,south),(8,-5,south)]:house(x,y,z,.85)
for i in range(14):
    a=i*math.tau/14;orange_tree(3+math.cos(a)*6,-6+math.sin(a)*2,south,.65)
for row in range(3):
    for col in range(4):orange_tree(12+col*1.2,-4.4-row*1.3,base,.58)

# Harbor, foot-accessible piers, bollards and lighthouse.
for x in (-15,-10,-5):
    cube('Harbor boardwalk',(x,-12.6,1.3),(2.0,4.7,.22),'wood',.04)
    for j in range(10):cube('Boardwalk plank',(x,-14.8+j*.46,1.45),(2.0,.38,.07),'wood',.015)
    for dx in (-.85,.85):
        for y in (-14,-12,-10.7):cylinder('Pier pile',(x+dx,y,.5),.15,2.1,'wood',9)
cube('Village seafront walk',(-10,-10.35,low+.04),(12.7,.9,.16),'cream')
cylinder('Lighthouse foundation',(-17,-6,low+.2),1.05,.4,'cream',20)
cylinder('Lighthouse tower',(-17,-6,low+2.1),.65,3.8,'cream',24,r2=.47)
for z in (low+.9,low+1.8,low+2.7):cylinder('Lighthouse orange bands',(-17,-6,z),.65-(z-low)*.04,.22,'orange',24)
cylinder('Lighthouse balcony',(-17,-6,low+4.05),.85,.16,'teal',24)
cylinder('Lantern',(-17,-6,low+4.45),.45,.7,'glass',16)
cylinder('Lantern roof',(-17,-6,low+4.95),.7,.45,'brass',20,r2=0)

def fountain(x,y,z,r=1):
    cylinder('Public fountain basin',(x,y,z+.16),r,.34,'cream',32)
    cylinder('Open orange fountain',(x,y,z+.36),r*.86,.05,'juice',32)
    cylinder('Fountain pillar',(x,y,z+.82),.19,.9,'cream',12)
    ico('Fountain citrus crown',(x,y,z+1.38),(.42,)*3,'orange',3)
    for i in range(4):
        a=i*math.tau/4;path('Fountain stream',[(x,y,z+1.3),(x+math.cos(a)*.55,y+math.sin(a)*.55,z+1.1),(x+math.cos(a)*.7,y+math.sin(a)*.7,z+.4)],.035,'juice')
for x,y,z,r in [(-11,-6,low,1.2),(-7,5,west,.85),(5,-6,south,1),(11,5,east,.8)]:fountain(x,y,z,r)

def aqueduct(a,b,z):
    length=math.dist(a,b);steps=max(2,int(length/1.9));dx=(b[0]-a[0])/steps;dy=(b[1]-a[1])/steps
    for i in range(steps+1):
        x,y=a[0]+dx*i,a[1]+dy*i
        cube('Aqueduct masonry pier',(x,y,(z+1.7)/2),(.4,.55,z+1.7),'cream',.035)
        cylinder('Pier capital',(x,y,z+.8),.42,.18,'brass',8)
    beam('Aqueduct channel edge A',(a[0],a[1]-.25,z+1.3),(b[0],b[1]-.25,z+1.3),.19,'cream')
    beam('Aqueduct channel edge B',(a[0],a[1]+.25,z+1.3),(b[0],b[1]+.25,z+1.3),.19,'cream')
    beam('Orange water in aqueduct',(a[0],a[1],z+1.22),(b[0],b[1],z+1.22),.16,'juice')
    for i in range(steps):
        x,y=a[0]+dx*(i+.5),a[1]+dy*(i+.5)
        angle=math.atan2(dy,dx)
        pts=[]
        for k in range(13):
            t=k*math.pi/12;dist=math.cos(t)*length/steps*.48;pts.append((x+math.cos(angle)*dist,y+math.sin(angle)*dist,z-.35+math.sin(t)*.75))
        path('Visible aqueduct arch',pts,.15,'cream')
aqueduct((-11,5),(-3,5),west)
aqueduct((2,5),(9,5),center)
aqueduct((-1,-5),(-7,-8),base)

# The circular reservoir and animated waterfall geometry.
cylinder('Reservoir support',(0,0,center+.35),3.4,.7,'cream',64)
cylinder('Reservoir orange water',(0,0,center+.75),3.05,.14,'juice',64)
torus('Reservoir balustrade',(0,0,center+.85),3.3,.18,'brass')
for i in range(24):
    a=i*math.tau/24; cylinder('Reservoir railing',(math.cos(a)*3.3,math.sin(a)*3.3,center+1.16),.05,.6,'cream',8)
for j in range(3):
    x=-.8+j*.54;path('Main amber waterfall',[(x,-2.85,center+.72),(x,-3.25,center+.3),(x,-3.4,2.5),(x,-4.6,2.6),(x,-5.0,1.6),(x,-5.2,.25)],.26,'juice')
for i in range(18):ico('Waterfall spray',(-1.3+rng.random()*2.9,-5.0+rng.random()*.9,.3+rng.random()*.6),(.12,.12,.07),'foam',1)
path('Orange river through delta',[(-.8,-4.9,2.58),(1,-6.1,2.6),(4,-6.7,2.6),(8,-7.7,2.56),(12,-9,2.3),(15,-10,.3)],.48,'juice')
for i in range(7):
    x=1+i*1.6;cube('River maintenance steps',(x,-8.6,2.7),(.9,1,.2),'cream',.04)

def refinery_tower(x,y,z,height,r=1):
    cylinder('Refinery teal tank',(x,y,z+height/2),r,height,'teal',32)
    for h in (.15,.55,.9):torus('Tank brass band',(x,y,z+height*h),r+.03,.08,'brass')
    cylinder('Tank dome',(x,y,z+height+.25),r,.65,'brass',24,r2=.15)
    for j in range(4):cube('Tank viewing glass',(x-.3+j*.2,y-r-.01,z+height*.55),(.1,.05,.8),'glass',.01)
for x,y,h,r in [(7,2,3,1.0),(10,0,4,1.1),(14,1,4.5,1),(15,4,3.6,.9),(6,5,2.8,.75)]:refinery_tower(x,y,east,h,r)
cube('Refinery main hall',(10,3,east+1.6),(7,4.5,3.2),'teal',.15)
cube('Refinery tiled roof',(10,3,east+3.4),(7.5,4.9,.4),'brass',.1)
for i in range(8):
    x=6.8+i*.9;cube('Refinery arch window',(x,.72,east+1.8),(.45,.06,1.25),'glass',.12)
for x,y,height in [(8,4,6),(11,4.8,7),(14,5,5.6)]:
    cylinder('Articulated refinery chimney',(x,y,east+height/2),.27,height,'dark',16)
    for z in (.5,height-1,height):torus('Chimney rim',(x,y,east+z),.3,.06,'brass')
for a,b in [((7,2,east+1),(10,0,east+1)),((10,0,east+2),(14,1,east+2)),((14,1,east+1),(15,4,east+1))]:path('Exposed bent brass pipes',[a,(a[0],b[1],a[2]),b],.16,'brass')

# The crown, orange dome, and readable approach to the final boss.
cube('Guina citadel hall',(10,8,citadel+1.7),(5.2,4.6,3.4),'dark',.14)
for dx in (-2.7,2.7):
    for dy in (-2.3,2.3):
        cylinder('Crown corner tower',(10+dx,8+dy,citadel+2.1),.6,4.2,'teal',20)
        cylinder('Crown tower spire',(10+dx,8+dy,citadel+4.6),.78,1.4,'brass',20,r2=0)
ico('Guina gigantic orange dome',(10,8,citadel+4.15),(2.65,2.1,2.4),'orange',4)
for i in range(10):
    a=i*math.tau/10;path('Orange dome brass ribs',[(10+math.cos(a)*2.63*math.sin(t*math.pi/12),8+math.sin(a)*2.08*math.sin(t*math.pi/12),citadel+4.15+2.4*math.cos(t*math.pi/12)) for t in range(1,7)],.045,'gold')
cylinder('Dome crown valve',(10,8,citadel+6.7),.35,.7,'brass',16)
torus('Throne master pressure valve',(10,5.67,citadel+2),1.05,.11,'brass',(math.pi/2,0,0))
for i in range(6):
    a=i*math.tau/6;beam('Valve spokes',(10,5.67,citadel+2),(10+math.cos(a),5.67,citadel+2+math.sin(a)),.06,'brass')
cube('Citadel entrance',(10,5.61,citadel+.8),(1.2,.09,1.6),'purple',.15)
for i in range(17):cube('Citadel stone stair',(10,4.95-i*.27,citadel-.1-i*.14),(1.6,.36,.22),'cream',.04)

# Park paths, structural bridges and twelve true positions authored in 3D.
NODES=[(-12,-8,low),(-10,2,west),(-3,5,west),(-2,-5,base),(4,-1,center),(1,2,center),(6,-7,south),(8,0,east),(15,-5,base),(15,5,east),(6,7,citadel),(11,6,citadel)]
for i,(x,y,z) in enumerate(NODES):
    cylinder('Stage '+str(i+1)+' landing',(x,y,z+.06),.61,.13,'cream',24)
    torus('Stage '+str(i+1)+' citrus ring',(x,y,z+.16),.48,.06,'gold')
    if i not in (5,11):
        cylinder('Stage '+str(i+1)+' wayfinding post',(x+.65,y,z+.65),.07,1.3,'wood',8)
        cube('Stage '+str(i+1)+' marker',(x+.65,y,z+1.2),(.6,.12,.3),'teal',.02)
for i in range(len(NODES)-1):
    a,b=NODES[i],NODES[i+1]
    points=[(a[0]+(b[0]-a[0])*t/10,a[1]+(b[1]-a[1])*t/10,a[2]+(b[2]-a[2])*t/10+.10) for t in range(11)]
    path('Authored stage route '+str(i+1),points,.19,'sand')
    if abs(a[2]-b[2])>1:
        for j in range(8):
            t=(j+.5)/8;x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t;z=a[2]+(b[2]-a[2])*t
            cube('Trail elevation steps',(x,y,z),(.65,.5,.12),'cream',.025)

def waterwheel(x,y,z):
    torus('Waterwheel rim',(x,y,z),1.3,.14,'wood',(math.pi/2,0,0))
    for i in range(12):
        a=i*math.tau/12;beam('Wheel spoke',(x,y,z),(x+math.cos(a)*1.25,y,z+math.sin(a)*1.25),.07,'brass')
        o=cube('Wheel paddle',(x+math.cos(a)*1.23,y,z+math.sin(a)*1.23),(.32,.6,.3),'wood',.025);o.rotation_euler[1]=-a
waterwheel(-4,-3,3.4);waterwheel(7,-5,3.5)
for i in range(25):
    x,y=rng.uniform(-18,18),rng.uniform(-13,13)
    if (x/20)**2+(y/14)**2>.93:ico('Coastal fractured rock',(x,y,.2),(.4+rng.random()*.4,.35,.5),'strata',1)

# Fine-scale storytelling: maintained terraces, flowers, citrus crates and ruins.
for x,y,z in [(-13,-6,low),(-8,-6,low),(-9,5,west),(-3,6,west),(4,-7,south),(11,-4,base),(13,4,east)]:
    for i in range(3):
        cube('Stacked citrus crate',(x+i*.43,y,z+.23),(.38,.38,.42),'wood',.025)
        for j in range(3):ico('Crated oranges',(x+i*.43+(j-1)*.09,y-.03,z+.45),(.09,)*3,'orange',2)
for x,y,z in [(-15,-4,low),(-6,4,west),(-2,3,center),(2,-5,south),(8,-6,south),(12,3,east)]:
    for i in range(9):
        a=i*2.39;dx=math.cos(a)*.75;dy=math.sin(a)*.75
        ico('Terrace wild grass',(x+dx,y+dy,z+.15),(.19,.13,.2),'leaf-light',1)
        if i%2==0:ico('Amber terrace flower',(x+dx,y+dy,z+.32),(.065,)*3,'foam',2)
for x,y,z in [(-6,0,west),(-1,6,center),(5,2,center),(13,-7,base)]:
    for i in range(6):cube('Restored low terrace wall',(x+i*.28,y,z+.18),(.27,.33,.36),'cream',.025)
for i in range(12):
    a=i*math.tau/12;x=math.cos(a)*18.6;y=math.sin(a)*12.8
    ico('Individual coastal buttress',(x,y,.1),(.7,.7,1.5+rng.random()),'strata',1)
for i in range(16):
    a=i*math.tau/16;cylinder('Village lamppost',(-11+math.cos(a)*3.5,-7+math.sin(a)*2.2,low+.65),.035,1.3,'dark',8)
    ico('Lamppost lantern',(-11+math.cos(a)*3.5,-7+math.sin(a)*2.2,low+1.4),(.14,.14,.18),'light',2)

# Orthographic camera and map metadata always come from the same projection.
bpy.ops.object.camera_add(location=(37,-53,45));camera=bpy.context.object;camera.name='Delicia map export camera';camera.rotation_euler=(Vector((0,0,3.8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=48;scene.camera=camera
scene.render.resolution_x=2048;scene.render.resolution_y=1280;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.device='CPU'
scene.world=bpy.data.worlds.new('Delicia warm sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.4,.57,.63,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
bpy.ops.object.light_add(type='AREA',location=(-14,-18,33));light=bpy.context.object;light.name='Soft afternoon key';light.data.energy=3800;light.data.shape='DISK';light.data.size=22;light.rotation_euler=(Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(0,0,20));sun=bpy.context.object;sun.data.energy=2;sun.data.angle=.18;sun.rotation_euler=(.5,-.35,-.7)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene['expansion']='Império da Delícia';scene['seed']=4471;scene['physical_width_m']=40.6;scene['released_island_approx_width_m']=20
bpy.context.view_layer.update()
nodes={}
for i,p in enumerate(NODES):
    q=world_to_camera_view(scene,camera,Vector((p[0],p[1],p[2]+.16)));nodes['delicia-'+str(i+1)]={'x':round(q.x,6),'y':round(1-q.y,6)}
metadata={'title':'Império da Delícia','seed':4471,'physicalWidthMeters':40.6,'image':{'width':2048,'height':1280},'nodes':nodes,'routes':[[nodes['delicia-'+str(i+1)],nodes['delicia-'+str(i+2)]] for i in range(11)],'objects':len(scene.objects),'materials':len(M)}
(OUT/'island-map.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
scene.render.filepath=str(SOURCE/'island-render.png');bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'imperio-delicia.blend'))
bpy.ops.render.render(write_still=True)
# The complete source is reviewable; the glTF is an optional runtime/viewer asset.
try:
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/'imperio-delicia.glb'),export_format='GLB',export_cameras=True,export_lights=True)
except Exception as exc:print('GLB export unavailable:',type(exc).__name__)
print(json.dumps({'blend':str(SOURCE/'imperio-delicia.blend'),'render':str(SOURCE/'island-render.png'),'objects':len(scene.objects),'nodes':nodes}),flush=True)
