"""Small distant Porto do Bielzao companion layer. Blender 4.x, deterministic and transparent."""
import bpy, math, random, os
from mathutils import Vector
random.seed(204)
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../public/assets/world/map'));os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,c):
 c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c)
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85;return m
blue=mat('misty harbor blue',(.19,.34,.39));blue2=mat('faded blue shutters',(.33,.49,.51));red=mat('weathered terracotta',(.54,.30,.20));ochre=mat('ochre cargo',(.66,.49,.23));wood=mat('salty dock',(.44,.38,.27));endwood=mat('cut timber',(.60,.51,.34));rock=mat('slate headland',(.37,.44,.39));green=mat('olive distant shrubs',(.32,.47,.27));cream=mat('boat ivory',(.79,.77,.60));dark=mat('deep slate',(.17,.27,.30))
def assign(o,m):o.data.materials.append(m);return o
def bevel(o,r=.06):
 b=o.modifiers.new('rounded edges','BEVEL');b.width=r;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o
def cube(n,p,d,m,r=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m);bevel(o,r);return o
def cyl(n,p,r,h,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=h,location=p);o=bpy.context.object;o.name=n;assign(o,m);bevel(o,.02);return o
def beam(n,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(n,v,f,m):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);assign(o,m);return o
# Small rocky green headland hugs the port.
for p,s in [((-2,1,.25),(1.7,1.4,1.1)),((2.0,1.8,.3),(1.2,.9,.9))]:
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,location=p);o=bpy.context.object;o.scale=s;assign(o,rock)
for x,y in [(-2.4,1.6),(-1.9,2.2),(2.1,1.8)]:
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.55,location=(x,y,1.05));o=bpy.context.object;o.scale=(1,.7,.45);assign(o,green)
# Wharf boards supported on real piles.
for i in range(24):cube('long weathered wharf plank',(-2.8+i*.245,-.1,.77),(.224,3.4,.16),wood)
for x in [-2.8,-1.4,0,1.4,2.8]:
 for y in [-1.62,1.42]:
  cyl('wharf piling',(x,y,.63),.105,1.45,wood);cyl('pile cap',(x,y,1.39),.126,.06,endwood)
# Two warehouses and terracotta tile roofs.
for hx,hy,w,d,h,m in [(.6,.48,2.20,1.46,1.65,blue),(-1.77,.71,1.25,1.25,1.28,blue2)]:
 z=.87;cube('harbor warehouse',(hx,hy,z+h/2),(w,d,h),m,.07)
 vs=[(hx-w/2-.13,hy-d/2-.13,z+h),(hx+w/2+.13,hy-d/2-.13,z+h),(hx+w/2+.13,hy,z+h+.56),(hx-w/2-.13,hy,z+h+.56),(hx-w/2-.13,hy+d/2+.13,z+h),(hx+w/2+.13,hy+d/2+.13,z+h)]
 mesh('harbor tiled roof',vs,[(0,1,2,3),(3,2,5,4)],red)
 for j in range(int(w/.15)+1):
  xx=hx-w/2+j*.15
  for sy in [-1,1]:beam('roof tile roll',(xx,hy,z+h+.58),(xx,hy+sy*(d/2+.13),z+h),.025,ochre)
 cube('warehouse broad doors',(hx,hy-d/2-.025,z+.61),(w*.48,.05,1.15),dark,.03)
 for xx in [hx-w*.20,hx,hx+w*.20]:beam('sliding door planks',(xx,hy-d/2-.057,z+.06),(xx,hy-d/2-.057,z+1.16),.015,blue2)
# Cargo container, three little crates.
for x,y,z,w,d,h,m in [(1.85,-.7,1.17,.95,.68,.67,ochre),(-1.78,-.75,1.15,.69,.62,.63,red),(-2.38,-.75,1.06,.45,.52,.45,endwood)]:
 cube('cargo box',(x,y,z),(w,d,h),m)
 for k in range(5):cube('cargo corrugated ridge',(x-w*.4+k*w*.2,y-d/2-.015,z),(.035,.03,h*.88),m,.01)
# Open lattice crane, iconic skyline without resorting to a black silhouette.
for a,b in [((-2.4,.4,.8),(-2.4,.4,3.63)),((-2.4,.4,3.63),(-.05,-.95,4.0)),((-2.4,.4,3.3),(-.05,-.95,4.0))]:beam('steel crane frame',a,b,.085,blue)
for i in range(4):
 t=i/4;t2=(i+1)/4;a=(-2.4+2.35*t,.4-1.35*t,3.63+.37*t);b=(-2.4+2.35*t2,.4-1.35*t2,3.3+.7*t2);beam('crane diagonal brace',a,b,.035,blue2)
cube('crane machinery cabin',(-2.45,.39,2.81),(.65,.65,.67),blue,.04);cube('crane cab window',(-2.45,.045,2.86),(.42,.027,.31),cream,.012)
beam('crane hanging cable',(-.05,-.95,3.99),(-.05,-.95,2.39),.018,dark);cube('suspended cargo',(-.05,-.95,2.10),(.63,.52,.52),ochre,.03)
# Little tug at front of wharf, hull modeled as a pointed prism.
x,y=.3,-2.26
v=[(x-1,y-.34,.10),(x+.7,y-.34,.10),(x+1.04,y,.10),(x+.7,y+.34,.10),(x-1,y+.34,.10),(x-.95,y-.40,.57),(x+.72,y-.40,.57),(x+1.15,y,.57),(x+.72,y+.40,.57),(x-.95,y+.40,.57)]
mesh('small tug navy hull',v,[(0,1,2,3,4),(5,9,8,7,6)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],blue)
cube('tug cream cabin',(x-.3,y,.80),(.70,.62,.52),cream);cube('tug red roof',(x-.3,y,1.10),(.83,.73,.10),red)
cube('tug forward windshield',(x+.065,y,.87),(.025,.45,.24),dark,.01);cube('tug side window',(x-.3,y-.323,.87),(.43,.025,.24),blue2,.01)
cyl('tug exhaust',(x-.64,y,1.30),.07,.46,dark);beam('tug little mast',(x+.37,y,.60),(x+.37,y,1.28),.025,wood)
# Render distant scene with soft light and low contrast: runtime controls distance opacity.
scene=bpy.context.scene;bpy.ops.object.camera_add(location=(11,-20,17.5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=10.7;scene.camera=cam
world=bpy.data.worlds.new('hazy sky');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.77,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.8
bpy.ops.object.light_add(type='AREA',location=(-5,-6,12));o=bpy.context.object;o.data.energy=1100;o.data.size=8;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False;scene.render.resolution_x=960;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=os.path.join(OUT,'porto-distant.png');scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3
bpy.ops.render.render(write_still=True)
