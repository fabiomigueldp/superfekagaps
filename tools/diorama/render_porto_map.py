"""Porto do Bielzao map prototype. Original Blender 4.x source; no Boolean operations.
Run: blender -b -t 12 -P tools/diorama/render_porto_map.py
Default: low-sample prototype. Add -- --final for the full 1920x1200 render.
Add -- --audit-only to build and audit fresh source without rendering or saving a cache.
Costa/distant layers stay untouched.
"""
import bpy, math, os, json, random, collections, sys, tempfile
from array import array
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')
os.makedirs(OUT,exist_ok=True);os.makedirs(DOC,exist_ok=True);random.seed(22031)
FINAL='--final' in sys.argv
AUDIT_ONLY='--audit-only' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)

def material(name,c,rough=.82,metal=0):
 c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c)
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
wood=material('Porto warm dock timber',(.56,.34,.17));woodlight=material('Porto worn walking boards',(.71,.49,.26));wooddark=material('Porto timber end grain',(.34,.21,.12));steel=material('Porto navy gantry',(.14,.31,.42),.50,.25);steelhi=material('Porto blue edges',(.27,.48,.59),.48,.25);dark=material('Porto deep iron',(.08,.16,.19),.5,.3);teal=material('Porto teal container',(.14,.52,.49));coral=material('Porto coral container',(.72,.24,.15));mustard=material('Porto mustard cargo',(.88,.60,.17));cream=material('Porto ivory trim',(.94,.86,.67));rope=material('Porto hemp',(.68,.52,.31));glass=material('Porto blue glazing',(.13,.51,.59),.23,.18);red=material('Porto tug coral',(.68,.19,.11));stone=material('Porto old quay stone',(.60,.53,.41));leaf=material('Porto coastal olive',(.35,.55,.18));yellow=material('Porto safety yellow',(.97,.72,.16));black=material('Porto hazard graphite',(.10,.13,.13))

def assign(o,m):o.data.materials.append(m);return o

def bevel(o,r=.035):
 b=o.modifiers.new('handcrafted soft edges','BEVEL');b.width=r;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o

def cube(name,loc,dims,m,r=.025,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dims;o.rotation_euler.z=rot;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m)
 if r:bevel(o,r)
 return o

def cylinder(name,loc,radius,depth,m,n=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;assign(o,m);bevel(o,.015);return o

def beam(name,a,b,r,m,n=8):
 a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,m,n);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def mesh(name,vs,fs,m):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);assign(o,m);return o

def ico(name,loc,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=s;assign(o,m);return o

# Surface topology first. Boards share a solid structural slab underneath.
def deck(name,x0,x1,y0,y1,z,boards=True):
 cube('walk_'+name+' structural deck',((x0+x1)/2,(y0+y1)/2,z-.115),(x1-x0,y1-y0,.23),wood,.045)
 if boards:
  n=max(2,int((x1-x0)/.31));vs=[];fs=[]
  for i in range(n):
   a=x0+i*(x1-x0)/n+.009;b=x0+(i+1)*(x1-x0)/n-.009;j=len(vs);vs.extend([(a,y0+.01,z+.012),(b,y0+.01,z+.012),(b,y1-.01,z+.012),(a,y1-.01,z+.012)]);fs.append((j,j+1,j+2,j+3))
  o=mesh('walk_'+name+' board surface',vs,fs,woodlight);o.data.materials.append(wood)
  for p in o.data.polygons:p.material_index=1 if p.index%5==0 else 0
 # Corner/midpoint piles go to the waterline; nothing is held up only by its painted edge.
 xs=[x0+.12,(x0+x1)/2,x1-.12];ys=[y0+.12,y1-.12]
 for x in xs:
  for y in ys:
   cylinder(name+' structural pile',(x,y,(z-.24)/2),.115,z-.24,wooddark,10)
 for y in ys:
  cube(name+' side bearer',((x0+x1)/2,y,z-.26),(x1-x0,.15,.23),wooddark,.015)
  for i in range(2):beam(name+' diagonal pier brace',(xs[i],y,.10),(xs[i+1],y,z-.25),.065,wood)

# A stepped horseshoe quay rather than a single background slab.
deck('arrival pier',-6.2,-3.7,-3.80,-2.15,.95)
deck('counterweight berth',-6.2,-3.10,-.44,2.45,1.65)
deck('container courtyard',-3.14,1.35,-2.95,2.42,1.65)
deck('cargo apron',1.31,6.20,-3.0,1.64,1.65)
deck('operations platform',1.50,5.90,1.63,3.82,2.55)
# Solid old quay footings remain visibly below the walking timber.
for x,y,w,d in [(-2.7,1.35,1.0,1.65),(1.65,.7,.65,1.0),(4.8,2.8,1.3,1.2)]:cube('old masonry quay footing',(x,y,.35),(w,d,.70),stone,.09)

# Continuous ramps: welded steel beams, real piles, flat top surfaces, open ends.
def walkway(name,points,width,rails=True,trim_start=0,trim_end=0):
 pts=[Vector(p) for p in points]
 for seg,(a,b) in enumerate(zip(pts,pts[1:])):
  d=b-a;flat=Vector((d.x,d.y,0));L=flat.length;side=Vector((-d.y,d.x,0)).normalized();v=[a-side*width/2,a+side*width/2,b+side*width/2,b-side*width/2]
  top=[tuple(p) for p in v];bottom=[tuple(p-Vector((0,0,.15))) for p in v];o=mesh('walk_'+name+' continuous surface',top+bottom,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],woodlight);bevel(o,.014)
  for sign in [-1,1]:
   off=side*sign*(width/2-.06);beam(name+' load bearing steel stringer',a+off-Vector((0,0,.22)),b+off-Vector((0,0,.22)),.095,steel)
   for t in [0,.5,1]:
    p=a.lerp(b,t)+off;cylinder(name+' foundation pile',(p.x,p.y,max(.1,(p.z-.29)/2)),.075,max(.2,p.z-.29),steel,8)
  # Cross-board seams sit below the clearance threshold and keep the route visibly walkable.
  for i in range(max(2,int(L/.27))):
   t=(i+.5)/max(2,int(L/.27));p=a.lerp(b,t);beam('walk_'+name+' board seam',p-side*(width/2-.035)+Vector((0,0,.009)),p+side*(width/2-.035)+Vector((0,0,.009)),.010,wood)
  if rails:
   lo=trim_start/L if seg==0 else .12;hi=1-trim_end/L if seg==len(pts)-2 else .88
   if hi>lo:
    for sign in [-1,1]:
     off=side*sign*(width/2+.10);pa=a.lerp(b,lo)+off;pb=a.lerp(b,hi)+off
     beam(name+' top guardrail',pa+Vector((0,0,.66)),pb+Vector((0,0,.66)),.035,yellow)
     beam(name+' middle guardrail',pa+Vector((0,0,.34)),pb+Vector((0,0,.34)),.020,steelhi)
     for t in [lo,(lo+hi)/2,hi]:
      p=a.lerp(b,t)+off;beam(name+' guardrail upright',p,p+Vector((0,0,.69)),.037,steel)

walkway('arrival ramp',[(-5,-2.2,.962),(-5,-.44,1.662)],1.20,True,.15,.25)
walkway('operations access ramp',[(5,-.65,1.662),(5,1.63,2.562)],1.20,True,.20,.63)
walkway('maintenance rising catwalk',[(.35,-.30,1.662),(.35,1.42,2.562),(.35,2.0,2.562)],.82,True,.12,.65)
deck('maintenance turn landing',-.21,.91,1.44,2.56,2.55,False)
walkway('maintenance level catwalk',[(.35,2.0,2.562),(1.65,2.0,2.562)],.82,True,.62,.16)

# Five open landing pads are intentionally free of text, markers and characters.
NODES={'2-1':(-5.0,-2.83,.992),'2-2':(-4.60,.90,1.692),'2-3':(-.70,-1.85,1.692),'2-4':(4.15,-1.80,1.692),'2-5':(3.10,2.00,2.592)}
for key,(x,y,z) in NODES.items():
 # Flat, subtle loading-bay stencils; the wood remains visible under runtime markers.
 for sx in [-1,1]:
  for sy in [-1,1]:
   cube('walk_loading stencil '+key,(x+sx*.50,y+sy*.50,z-.027),(.24,.035,.004),cream,.001)
   cube('walk_loading stencil '+key,(x+sx*.60,y+sy*.40,z-.027),(.035,.24,.004),cream,.001)

MAIN=[
 [NODES['2-1'],(-5,-2.2,.992),(-5,-.44,1.692),(-4.85,.20,1.692),NODES['2-2']],
 [NODES['2-2'],(-3.0,.90,1.692),(-2.35,.25,1.692),(-2.10,-.85,1.692),NODES['2-3']],
 [NODES['2-3'],(1.2,-1.85,1.692),(2.9,-1.85,1.692),NODES['2-4']],
 [NODES['2-4'],(5,-.65,1.692),(5,1.63,2.592),(5,1.94,2.592),NODES['2-5']]
]
SECRET=[NODES['2-3'],(.35,-.65,1.692),(.35,-.30,1.692),(.35,1.42,2.592),(.35,2.0,2.592),(1.65,2.0,2.592),NODES['2-5']]

# Campaign-scale landmarks only. Detailed weathering and small prop dressing follow prototype review.
def container(name,x,y,z,w,d,h,m):
 cube(name+' box',(x,y,z+h/2),(w,d,h),m,.065)
 for i in range(7):
  xx=x-w*.43+i*w*.86/6;cube(name+' front corrugation',(xx,y-d/2-.018,z+h/2),(.034,.038,h*.91),m,.008)
 for xx in [x-w*.46,x+w*.46]:cube(name+' corner iron',(xx,y-d/2-.035,z+h/2),(.075,.06,h),steelhi,.012)
 cube(name+' top edge',(x,y-d/2-.035,z+h-.045),(w+.04,.065,.085),steelhi,.012)
container('teal container stack',-1.1,.60,1.67,1.35,2.0,1.25,teal)
container('coral stacked cargo',-1.1,1.12,2.92,1.28,.85,.62,coral)
container('mustard loading cargo',2.45,.35,1.67,1.60,1.35,1.10,mustard)
container('teal cargo upper',2.45,.35,2.77,1.50,1.25,.58,teal)
container('east waiting cargo',5.60,-2.50,1.67,.75,.62,.62,coral)
# Left receiving shed, away from the counterweight-to-container route.
hx,hy,z=-2.0,1.83,1.67
cube('receiving warehouse',(hx,hy,z+.60),(1.75,1.04,1.20),steel,.065)
mesh('warehouse roof',[(hx-.96,hy-.62,z+1.15),(hx+.96,hy-.62,z+1.15),(hx+.96,hy,z+1.63),(hx-.96,hy,z+1.63),(hx-.96,hy+.62,z+1.15),(hx+.96,hy+.62,z+1.15)],[(0,1,2,3),(3,2,5,4)],steelhi)
cube('warehouse broad door',(hx,hy-.54,z+.45),(.72,.05,.9),wooddark,.025)
# The boss arrival is the operations cabin, not a random decorative lighthouse.
cube('operations cabin',(3.50,3.23,3.18),(1.90,1.00,1.24),cream,.065)
cube('operations blue roof',(3.50,3.23,3.86),(2.12,1.18,.16),steel,.055)
cube('operations front glazing',(3.50,2.715,3.30),(1.48,.035,.52),glass,.025)
for x in [3.0,3.5,4.0]:cube('operations glazing mullion',(x,2.685,3.30),(.035,.04,.56),steelhi,.005)

# Park the suspended load in the outer-right lifting bay, clear in both 3D and projection.
LOAD_X,LOAD_Y,LOAD_Z=7.025,.95,4.15
# A recognizable two-leg cargo gantry frames the rear skyline; nothing hangs over circulation.
for x in [1.62,5.72]:
 cube('main gantry steel tower',(x,3.37,4.41),(.25,.34,3.70),steel,.035)
 cube('main gantry foot',(x,3.37,2.63),(.64,.69,.18),yellow,.025)
 cube('main gantry steel knee',(x,3.15,5.68),(.46,.66,.30),steelhi,.025)
cube('main gantry top girder',(3.67,3.37,6.36),(4.62,.43,.44),steel,.04)
beam('crane working jib',(4.8,3.37,6.36),(LOAD_X,LOAD_Y,6.36),.13,steel)
beam('crane diagonal stay',(5.42,3.37,6.1),(LOAD_X,LOAD_Y,6.36),.035,steelhi)
cylinder('crane hoist wheel',(LOAD_X,LOAD_Y,6.16),.20,.20,yellow,16)
beam('load lifting cable',(LOAD_X,LOAD_Y,6.15),(LOAD_X,LOAD_Y,LOAD_Z+.40),.022,dark)
cube('suspended cargo load',(LOAD_X,LOAD_Y,LOAD_Z),(.70,.60,.66),coral,.045)
for sx in [-.33,.33]:cube('cargo hazard sling',(LOAD_X+sx,LOAD_Y,LOAD_Z),(.085,.64,.70),yellow,.01)
# Compact counterweight system for 2-2, safely beside the open landing.
for x in [-5.82,-3.88]:cube('counterweight gantry upright',(x,1.69,2.91),(.16,.20,2.50),steel,.025)
cube('counterweight overhead rail',(-4.85,1.69,4.18),(2.25,.26,.25),steelhi,.025)
beam('counterweight cable',(-5.60,1.49,4.12),(-5.60,1.49,2.62),.022,dark)
cube('counterweight yellow load',(-5.60,1.49,2.26),(.53,.56,.69),mustard,.045)
cube('counterweight control pedestal',(-3.77,1.58,1.99),(.43,.40,.62),steel,.025)
beam('counterweight control lever',(-3.77,1.58,2.32),(-3.65,1.58,2.65),.035,red)

# Small tug and nautical silhouette: a restrained reminder of the arrival, not a second map layer.
x,y=-4.38,-4.46
vs=[(x-1,y-.34,.10),(x+.70,y-.34,.10),(x+1.04,y,.10),(x+.70,y+.34,.10),(x-1,y+.34,.10),(x-.95,y-.42,.61),(x+.72,y-.42,.61),(x+1.15,y,.61),(x+.72,y+.42,.61),(x-.95,y+.42,.61)]
mesh('arrival tug hull',vs,[(0,1,2,3,4),(5,9,8,7,6)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],red)
cube('tug ivory cabin',(x-.25,y,.90),(.72,.66,.60),cream,.045);cube('tug blue roof',(x-.25,y,1.23),(.89,.80,.12),steel,.025)
cube('tug side window',(x-.25,y-.345,.99),(.49,.035,.29),glass,.014)
cylinder('tug stack',(x-.61,y,1.47),.073,.47,dark,10)
# A few edge props only: no one is asked to walk through a decorative crate or mooring rope.
for x,y in [(-5.95,-3.55),(-3.93,-3.55),(5.97,-2.83)]:
 cylinder('edge mooring bollard',(x,y,1.17 if x<0 else 1.87),.105,.30,dark,10)
for x,y,z in [(-5.85,2.16,1.65),(5.65,.75,1.65)]:
 cube('lamp base',(x,y,z+.04),(.24,.24,.08),steel,.025);beam('harbor lamp post',(x,y,z+.08),(x,y,z+1.45),.055,steel);cube('harbor lamp lantern',(x,y,z+1.48),(.20,.20,.23),yellow,.025)
for x,y,z in [(-3.9,2.2,1.65),(5.65,3.62,2.55)]:ico('small coast greenery',(x,y,z+.19),(.32,.26,.26),leaf)

# ---- Bounded dock-craft pass. Accepted decks, route geometry and camera are unchanged. ----
def curve(name,pts,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);assign(o,m);return o

def tire(name,loc,r=.17):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=r*.27,major_segments=16,minor_segments=6,location=loc);o=bpy.context.object;o.name=name;o.rotation_euler.x=math.pi/2;assign(o,rubber);return o

rubber=material('Porto old rubber',(.075,.105,.11),.95)
# Gentle directional timber grain and restrained paint variation preserve the crafted Costa style.
for m,axis,depth in [(woodlight,(70,3,8),.025),(wood,(62,3,8),.020),(wooddark,(35,3,8),.017),(steel,(5,5,5),.007),(steelhi,(5,5,5),.007)]:
 nt=m.node_tree;p=nt.nodes['Principled BSDF'];base=tuple(p.inputs['Base Color'].default_value[:3]);coord=nt.nodes.new('ShaderNodeTexCoord');stretch=nt.nodes.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=axis;nt.links.new(coord.outputs['Generated'],stretch.inputs[0]);noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=1.3;nt.links.new(stretch.outputs[0],noise.inputs['Vector']);ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=tuple(v*.88 for v in base)+(1,);ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.09) for v in base)+(1,);nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color']);bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=depth;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])

# Fascia timbers, restrained bolt heads and weathered outer edges, all below the walking plane.
for name,x0,x1,y0,y1,z in [('arrival',-6.2,-3.7,-3.80,-2.15,.95),('western',-6.2,-3.10,-.44,2.45,1.65),('central',-3.14,1.35,-2.95,2.42,1.65),('eastern',1.31,6.20,-3.0,1.64,1.65),('operations',1.50,5.90,1.63,3.82,2.55)]:
 for y in [y0,y1]:
  cube(name+' thick fascia',((x0+x1)/2,y,z-.14),(x1-x0+.025,.15,.26),wood,.025)
  for i in range(max(3,int((x1-x0)/.55))):
   xx=x0+.20+i*(x1-x0-.40)/max(2,int((x1-x0)/.55)-1);o=cylinder(name+' fascia fixing',(xx,y-.084 if y==y0 else y+.084,z-.12),.032,.026,steel,8);o.rotation_euler.x=math.pi/2
 # A thin dark outer trim reads as construction, not a raised walking barrier.
 for x in [x0,x1]:cube(name+' edge end grain',(x,(y0+y1)/2,z-.13),(.12,y1-y0,.22),wooddark,.017)

# Fenders and mooring wraps lie outside every navigable corridor.
for x,y,z in [(-2.8,-3.08,1.05),(-1.2,-3.08,1.05),(.35,-3.08,1.05),(1.95,-3.12,1.05),(3.65,-3.12,1.05),(5.4,-3.12,1.05)]:
 tire('quay tire fender',(x,y,z),.17);curve('fender mooring rope',[(x-.04,y,1.62),(x-.055,y-.015,z+.12),(x+.055,y-.015,z+.12),(x+.04,y,1.62)],.018,rope)
for x,y,z in [(-5.95,-3.55,1.09),(-3.93,-3.55,1.09),(5.97,-2.83,1.79)]:
 for k in range(3):
  bpy.ops.mesh.primitive_torus_add(major_radius=.117,minor_radius=.016,major_segments=16,minor_segments=5,location=(x,y,z+k*.031));assign(bpy.context.object,rope)
curve('arrival edge mooring line',[(-5.95,-3.55,1.25),(-5.48,-3.60,1.12),(-4.60,-3.60,1.11),(-3.93,-3.55,1.25)],.022,rope)

# Cargo doors, corners and locking bars give scale without filling the open routes.
for name,x,y,z,w,d,h,m in [('teal',-1.1,.60,1.67,1.35,2.,1.25,teal),('coral',-1.1,1.12,2.92,1.28,.85,.62,coral),('mustard',2.45,.35,1.67,1.60,1.35,1.10,mustard),('upper teal',2.45,.35,2.77,1.50,1.25,.58,teal),('waiting',5.60,-2.50,1.67,.75,.62,.62,coral)]:
 yy=y-d/2-.060
 cube(name+' cargo bottom rail',(x,yy,z+.045),(w,.06,.085),steelhi,.011)
 cube(name+' door center seam',(x,yy,z+h/2),(.017,.018,h*.88),dark,.003)
 for side in [-1,1]:
  xx=x+side*w*.21;beam(name+' door locking bar',(xx,yy-.032,z+.12),(xx,yy-.032,z+h-.10),.016,cream)
  cube(name+' door latch',(xx,yy-.058,z+h*.45),(.105,.040,.035),dark,.006)
  for frac in [.25,.74]:cube(name+' heavy cargo hinge',(x+side*w*.445,yy-.024,z+h*frac),(.10,.035,.048),steelhi,.008)
 # An unlettered worn shipping patch, not a baked stage label.
 cube(name+' worn shipping patch',(x-w*.30,yy-.025,z+h*.66),(w*.14,.011,h*.11),cream,.002)

# Cabin framing, sills, door and roof vent stay behind the boss-arrival clearing.
for x in [2.58,4.42]:
 for y in [2.74,3.72]:cube('operations corner frame',(x,y,3.18),(.085,.075,1.25),steelhi,.011)
cube('operations window sill',(3.50,2.68,3.01),(1.60,.10,.065),steelhi,.012)
cube('operations front door',(4.30,2.704,3.01),(.23,.028,.88),steel,.015)
cube('operations door glass',(4.30,2.677,3.16),(.15,.025,.27),glass,.009)
cylinder('operations door handle',(4.23,2.65,2.98),.026,.035,mustard,10)
cube('operations roof vent',(3.66,3.4,4.00),(.42,.30,.20),steelhi,.025)
for x in [-2.27,-1.73]:beam('warehouse door brace',(x,1.27,1.80),(-x-4.0,1.27,2.50),.026,woodlight)
for x in [-2.81,-2.40,-2.0,-1.6,-1.19]:
 beam('warehouse standing roof seam',(x,1.20,2.83),(x,1.83,3.32),.021,steel)
 beam('warehouse rear roof seam',(x,1.83,3.32),(x,2.46,2.83),.021,steel)

# The gantry receives real triangular bracing and visible hoist/bridle connections.
for ob in list(bpy.context.scene.objects):
 if ob.name in {'crane working jib','crane diagonal stay','load lifting cable'}:bpy.data.objects.remove(ob,do_unlink=True)
a,b=Vector((4.8,3.37,6.36)),Vector((LOAD_X,LOAD_Y,6.36));d=b-a
for dz in [-.13,.13]:beam('gantry lattice chord',a+Vector((0,0,dz)),b+Vector((0,0,dz)),.070,steel)
for i in range(6):
 pa=a+d*i/6;pb=a+d*(i+1)/6;beam('gantry triangular jib brace',pa+Vector((0,0,.13)),pb-Vector((0,0,.13)),.032,steelhi)
for x in [1.62,5.72]:
 for z in [2.85,3.85,4.85,5.85]:
  cube('gantry column connecting plate',(x,3.175,z),(.36,.035,.28),steelhi,.015)
  for dx in [-.11,.11]:
   for dz in [-.075,.075]:
    o=cylinder('gantry plate rivet',(x+dx,3.145,z+dz),.025,.022,cream,8);o.rotation_euler.x=math.pi/2
cube('hoist yellow casing',(LOAD_X,LOAD_Y,6.11),(.33,.29,.35),yellow,.04)
for k in range(3):cube('hoist graphite stripe',(LOAD_X-.10+k*.09,LOAD_Y-.156,6.10),(.045,.012,.28),black,.002,rot=0)
beam('taut lifting cable',(LOAD_X,LOAD_Y,5.95),(LOAD_X,LOAD_Y,LOAD_Z+.83),.023,dark)
curve('visible steel lifting hook',[(LOAD_X,LOAD_Y,LOAD_Z+.83),(LOAD_X,LOAD_Y,LOAD_Z+.72),(LOAD_X-.07,LOAD_Y,LOAD_Z+.69),(LOAD_X-.07,LOAD_Y,LOAD_Z+.60),(LOAD_X-.01,LOAD_Y,LOAD_Z+.57),(LOAD_X+.05,LOAD_Y,LOAD_Z+.61),(LOAD_X+.04,LOAD_Y,LOAD_Z+.66)],.026,steel)
for dx in [-.30,.30]:beam('load bridle',(LOAD_X-.01,LOAD_Y,LOAD_Z+.60),(LOAD_X+dx,LOAD_Y,LOAD_Z+.335),.022,dark)
for dx in [-.33,.33]:
 for z in [LOAD_Z-.23,LOAD_Z-.05,LOAD_Z+.13,LOAD_Z+.28]:cube('lifting sling dark band',(LOAD_X+dx,LOAD_Y-.328,z),(.092,.017,.07),black,.004)
# Compact counterweight hooks and dark caution bands keep its meaning distinct.
curve('counterweight load shackle',[(-5.60,1.49,2.68),(-5.66,1.49,2.64),(-5.60,1.49,2.60),(-5.54,1.49,2.64),(-5.60,1.49,2.68)],.018,steel)
for z in [2.06,2.22,2.38]:cube('counterweight caution band',(-5.6,1.195,z),(.48,.017,.052),black,.003)

# Tug: bulwark, waterline, fenders and glazing make the same accepted hull read as a boat.
x,y=-4.38,-4.46
curve('tug ivory gunwale',[(x-.95,y-.425,.62),(x+.72,y-.425,.62),(x+1.15,y,.62),(x+.72,y+.425,.62),(x-.95,y+.425,.62),(x-.95,y-.425,.62)],.032,cream)
curve('tug waterline stripe',[(x-.98,y-.38,.30),(x+.72,y-.38,.30),(x+1.09,y,.30),(x+.72,y+.38,.30),(x-.98,y+.38,.30)],.027,cream)
for xx in [x-.75,x+.13,x+.73]:tire('tug rubber fender',(xx,y-.465,.41),.115)
cube('tug front windshield',(x+.128,y,.99),(.034,.44,.30),glass,.012)
for xx in [x-.43,x-.07]:beam('tug side window mullion',(xx,y-.369,.83),(xx,y-.369,1.14),.013,cream)
beam('tug radio mast',(x-.64,y,1.25),(x-.64,y,1.89),.021,steel)
beam('tug mast crosspiece',(x-.64,y-.18,1.74),(x-.64,y+.18,1.74),.014,steel)
cylinder('tug chimney cap',(x-.61,y,1.72),.097,.067,steel,12)
# Small unlettered lifebuoy mounted on the cabin side.
for off in [-1,1]:
 bpy.ops.mesh.primitive_torus_add(major_radius=.082,minor_radius=.025,major_segments=16,minor_segments=6,location=(x-.67,y+off*.352,.91));ob=bpy.context.object;ob.name='tug lifebuoy';ob.rotation_euler.x=math.pi/2;assign(ob,cream)

# Restrained coastal context behind the quay, safely below and behind all route surfaces.
shore=[(-5.35,2.60,.25,.75,.55,.48),(-3.35,2.65,.24,.82,.57,.52),(-1.72,2.77,.25,.92,.65,.56),(.05,2.81,.24,.75,.66,.51),(3.92,3.99,.23,1.00,.54,.53),(5.12,3.92,.19,.69,.50,.46)]
for i,(x,y,z,sx,sy,sz) in enumerate(shore):
 ico('low coastal retaining rock',(x,y,z),(sx,sy,sz),stone)
 for j in range(2):ico('salt tolerant coast scrub',(x+(-.18 if j else .14),y+.08,z+sz*.86),(.20,.16,.18),leaf)
# No extra architecture, labels, distant factory or character is introduced in this pass.

# Flush timber threshold plates bridge bevelled fascia/ramp seams with explicit walkable geometry.
cube('walk_arrival ramp threshold',(-5,-.44,1.665),(1.22,.18,.035),woodlight,.008)
cube('walk_operations ramp threshold',(5,1.63,2.565),(1.22,.18,.035),woodlight,.008)

# The same family of orthographic camera, soft key and sRGB-to-linear materials as Costa.
scene=bpy.context.scene;bpy.ops.object.camera_add(location=(11,-20,17.5));cam=bpy.context.object;target=Vector((0,0,2.45));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20.6;scene.camera=cam
world=bpy.data.worlds.new('warm maritime sky');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('warm key',(-8,-10,18),2100,9,(1,.85,.64)),('sea fill',(8,3,12),1250,8,(.66,.82,1)),('warm rim',(-4,10,13),1500,7,(1,.94,.77))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=192 if FINAL else 32;scene.cycles.use_denoising=False;scene.cycles.max_bounces=6;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100 if FINAL else 50;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35

def project(co):
 p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
world_routes={'main':[{'from':f'2-{i+1}','to':f'2-{i+2}','world':[list(p) for p in path]} for i,path in enumerate(MAIN)],'secret':[{'from':'2-3','to':'2-5','world':[list(p) for p in SECRET]}]}
meta={'version':1,'world':2,'status':'craft-pass-awaiting-visual-review','size':{'width':1920,'height':1200},'coordinateSystem':'Normalized top-left image space; preserve the full 8:5 frame. World Z is up.','camera':{'position':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale},'nodes':{key:{**project(co),'world':list(co),'clearingRadius':.64} for key,co in NODES.items()},'routes':{f'{i}:{i+1}':[project(p) for p in path] for i,path in enumerate(MAIN)},'secretRoute':[project(p) for p in SECRET],'worldRoutes':world_routes,'campaignSources':['src/adventure/campaign.ts','docs/world/campanha.md#M2','docs/world/conceitos/imagens/02-porto-do-bielzao.png']}

# Audit this build's fresh coordinates, never metadata left by an earlier export.
# The checker is read-only with respect to geometry and persists its report/metadata.
if FINAL:meta['status']='authored-candidate-for-runtime-review'
import runpy
audit_out=tempfile.mkdtemp(prefix='porto-source-audit-') if AUDIT_ONLY else OUT
audit=runpy.run_path(os.path.join(ROOT,'tools/diorama/check_porto_clearance.py'),init_globals={'PORTO_META':meta,'PORTO_OUT':audit_out,'PORTO_DOC':audit_out if AUDIT_ONLY else DOC},run_name='__main__')
meta=audit['meta']
if AUDIT_ONLY:
 print('PORTO_AUDIT_ONLY_COMPLETE='+json.dumps({'metadata':os.path.join(audit_out,'porto-diorama.meta.json'),'reports':audit_out,'rendered':False}))
 sys.exit(0)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/porto-map-prototype.blend')
scene.render.filepath=os.path.join(OUT,'porto-diorama.png' if FINAL else 'porto-diorama-preview.png');bpy.ops.render.render(write_still=True)
# Exact nonzero-alpha silhouette bounds, excluding any separate shadow.
im=bpy.data.images.load(scene.render.filepath,check_existing=False);w,h=im.size;px=array('f',[0])*(w*h*4);im.pixels.foreach_get(px);xs=[];ys=[]
for i in range(w*h):
 if px[i*4+3]>0:xs.append(i%w);ys.append(i//w)
meta['artBounds']={'top':round(1-(max(ys)+1)/h,6),'bottom':round(1-min(ys)/h,6),'left':round(min(xs)/w,6),'right':round((max(xs)+1)/w,6)}
json.dump(meta,open(os.path.join(OUT,'porto-diorama.meta.json'),'w'),indent=2);print('PORTO_NODES='+json.dumps(meta['nodes']));print('PORTO_BOUNDS='+json.dumps(meta['artBounds']))
