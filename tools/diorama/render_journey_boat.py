"""Render the original working launch at genuine 3D headings (Blender 4.3+).

blender -b -t 8 -P render_journey_boat.py -- --output-dir RENDERS --headings 64
Model, camera transform, orthographic scale, lighting and passenger world point
match the original eight views. The default 384x288 raster adds vertical padding
for the mast; package_journey_boat.py makes the shared alpha-safe crop.
Use --headings 8 --height 256 to reproduce the legacy raw frame convention.
"""
import bpy, math, json, os, sys, argparse
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

parser=argparse.ArgumentParser()
parser.add_argument('--output-dir', required=True)
parser.add_argument('--headings', type=int, choices=[8,32,48,64], default=64)
parser.add_argument('--samples', type=int, default=48)
parser.add_argument('--height', type=int, default=288)
parser.add_argument('--indices', default='')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if args.samples < 1 or args.height < 1:
    parser.error('Sample count and raster height must be positive')
OUT = args.output_dir
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

def mat(name, rgb, metal=0):
    rgb = tuple(((v+.055)/1.055)**2.4 if v > .04045 else v/12.92 for v in rgb)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .68
    p.inputs['Metallic'].default_value = metal
    return m

navy=mat('deep petrol painted hull',(.12,.32,.39));teal=mat('faded turquoise cabin',(.22,.58,.59))
cream=mat('warm ivory sheer stripe',(.98,.89,.67));wood=mat('honey working deck',(.69,.43,.22))
wooddark=mat('deck seams',(.41,.25,.14));red=mat('coral lifering',(.91,.29,.15))
iron=mat('dark maritime rubber',(.10,.16,.19));glass=mat('blue pilot glass',(.18,.38,.45),.25)
gold=mat('brass deck hardware',(.84,.61,.26),.45)
objects=[]
def finish(o, name, m, foreground=False, bevel=.025):
    o.name=name;o.data.materials.append(m)
    if bevel:
        modifier=o.modifiers.new('soft worked edge','BEVEL');modifier.width=bevel;modifier.segments=2
        o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    o['possible_foreground']=foreground;objects.append(o)
    return o
def mesh(name, vertices, faces, m, foreground=False, bevel=.018):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    return finish(o,name,m,foreground,bevel)
def cube(name,loc,size,m,foreground=False,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,foreground,bevel)
def cylinder(name,loc,r,depth,m,foreground=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=depth,location=loc)
    return finish(bpy.context.object,name,m,foreground,.012)
def beam(name,a,b,r,m,foreground=False):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,m,foreground)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

# Three hand-shaped rings produce a rounded workboat bow and a broad transom.
outline=[(-1.43,-.45),(-1.25,-.59),(.66,-.61),(1.14,-.43),(1.48,-.15),
         (1.55,0),(1.48,.15),(1.14,.43),(.66,.61),(-1.25,.59),(-1.43,.45)]
vertices=[]
for z,sx,sy in [(.03,.83,.66),(.24,.96,.92),(.59,1,1)]:
    vertices += [(x*sx,y*sy,z) for x,y in outline]
n=len(outline);faces=[tuple(range(n-1,-1,-1))]
faces += [(ring*n+i,ring*n+(i+1)%n,(ring+1)*n+(i+1)%n,(ring+1)*n+i) for ring in range(2) for i in range(n)]
mesh('launch lofted navy hull',vertices,faces,navy)
mesh('inset honey deck',[(x*.94,y*.91,.575) for x,y in outline],[tuple(range(n))],wood)
for y in [-.40,-.25,-.10,.05,.20,.35]:
    cube('longitudinal deck seam',(-.07,y,.581),(2.43,.015,.009),wooddark,bevel=.002)
# Individual side sections can be composited in front of the actor when nearer
# the camera. There is an open gap at either stern quarter for boarding.
for i,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):
    if i==len(outline)-1: continue
    # A real 0.50-wide boarding gate on both sides aligns with the open deck.
    sections=[(a,b)]
    if i in [1,8]:
        left,right=sorted([a,b]);slope=(right[1]-left[1])/(right[0]-left[0])
        gate_left=(-.03,left[1]+(-.03-left[0])*slope)
        gate_right=(.47,left[1]+(.47-left[0])*slope)
        sections=[(left,gate_left),(gate_right,right)]
    for start,end in sections:
        for z,thickness,material in [(.58,.050,cream),(.70,.037,navy)]:
            beam('raised bulwark '+str(i),(start[0],start[1],z),(end[0],end[1],z),thickness,material,True)
    if i not in [0,1,8,9]:
        beam('bulwark upright '+str(i),(a[0],a[1],.59),(a[0],a[1],.71),.026,navy,True)

# The low stern pilothouse leaves the broad forward deck entirely open.
cube('small stern pilot cabin',(-.94,0,.83),(.68,.69,.51),teal,True,.06)
cube('ivory curved cabin roof',(-.94,0,1.12),(.82,.80,.12),cream,True,.065)
cube('pilot front windshield',(-.586,0,.90),(.028,.49,.23),glass,True,.015)
for y in [-.356,.356]:
    cube('pilot side glass',(-.96,y,.91),(.40,.025,.24),glass,True,.015)
    cube('window ivory mullion',(-.96,y*1.03,.91),(.030,.020,.25),cream,True,.006)
beam('short brass mast',(-1.12,.05,1.17),(-1.12,.05,1.52),.027,gold,True)
cube('folded coral pennant',(-1.04,.05,1.47),(.19,.026,.09),red,True,.012)
cube('stern bench',(-1.33,0,.67),(.18,.84,.16),wood,True,.025)
# A coiled hawser, tire fenders, cleats and the lifering make this a working
# transfer vessel rather than a scaled generic hull.
for x in [-1.06,.65]:
    for y in [-.615,.615]:
        bpy.ops.mesh.primitive_torus_add(major_radius=.115,minor_radius=.034,major_segments=20,minor_segments=8,location=(x,y,.46),rotation=(math.pi/2,0,0))
        finish(bpy.context.object,'hanging tire fender',iron,True,.0)
        beam('fender rope',(x,y,.67),(x,y,.56),.013,cream,True)
for x in [-1.31,1.17]:
    cylinder('mooring cleat base',(x,0,.63),.043,.09,gold)
    cube('mooring cleat horn',(x,0,.684),(.20,.041,.036),gold,True,.01)
bpy.ops.mesh.primitive_torus_add(major_radius=.16,minor_radius=.045,major_segments=24,minor_segments=8,location=(-.99,-.386,.81),rotation=(math.pi/2,0,0))
finish(bpy.context.object,'coral rescue ring',red,True,0)
for x in [-1.08,-.90]:cube('lifering ivory binding',(x,-.420,.81),(.041,.018,.29),cream,True,.004)
for radius in [.09,.115,.14]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.012,major_segments=24,minor_segments=6,location=(1.0,.06,.609))
    finish(bpy.context.object,'bow coil of rope',cream,False,0)

scene=bpy.context.scene
cam_position=Vector((11,-20,14.8));target=Vector((0,0,.55))
bpy.ops.object.camera_add(location=cam_position+target);cam=bpy.context.object
cam.rotation_euler=(-cam_position).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.15;scene.camera=cam
world=bpy.data.worlds.new('soft maritime sky');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('warm key',(-4,-6,9),680,5,(1,.85,.64)),('sea fill',(5,2,7),420,5,(.66,.82,1)),('warm rim',(-4,6,8),480,4,(1,.94,.77))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=False
scene.render.resolution_x=384;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
passenger=Vector((.22,0,.600));origin=Vector((0,0,.03))
originals={o.name:o.matrix_world.copy() for o in objects}
previous=json.load(open(f'{OUT}/boat.meta.json')) if args.indices and os.path.exists(f'{OUT}/boat.meta.json') else None
if previous and (previous.get('headingCount')!=args.headings or previous['frame']!={'width':384,'height':args.height} or previous.get('samples')!=args.samples):
    raise ValueError('Partial renders must use matching heading count, raster dimensions and sample count')
frames=previous['frames'] if previous else []
render_indices=[int(item) for item in args.indices.split(',')] if args.indices else list(range(args.headings))
if len(render_indices)!=len(set(render_indices)) or any(i<0 or i>=args.headings for i in render_indices):
    parser.error('Partial indices must be unique and within the heading count')
frames=[f for f in frames if f['index'] not in render_indices]
def project(p):
    q=world_to_camera_view(scene,cam,p);return {'x':round(q.x,6),'y':round(1-q.y,6)}
for index in render_indices:
    angle=index*math.tau/args.headings;rot=Matrix.Rotation(angle,4,'Z');foot=rot@passenger
    for o in objects:o.matrix_world=rot@originals[o.name]
    bpy.context.view_layer.update()
    # Foreground membership is based on the mesh's transformed center depth,
    # so reverse headings correctly put a nearer cabin/rail over the feet.
    near=[]
    for o in objects:
        center=sum((o.matrix_world@Vector(corner) for corner in o.bound_box),Vector())/8
        if o.get('possible_foreground') and (center-foot).dot(cam_position)>0:near.append(o)
    for layer in ['base','foreground']:
        for o in objects:o.hide_render=(o not in near) if layer=='foreground' else False
        scene.render.filepath=f'{OUT}/heading-{index}-{layer}.png'
        bpy.ops.render.render(write_still=True)
    front=project(rot@Vector((1,0,.03)));back=project(origin)
    frames.append({'index':index,'worldHeadingRadians':round(angle,6),'screenHeadingRadians':round(math.atan2((front['y']-back['y'])*args.height,(front['x']-back['x'])*384),6),'passengerFoot':project(foot),'waterlineAnchor':project(origin),'passengerWorld':list(foot),'foregroundObjectCount':len(near)})
for o in objects:o.hide_render=False
frames.sort(key=lambda f:f['index'])
def projected_vector(offset):
    start=world_to_camera_view(scene,cam,origin);end=world_to_camera_view(scene,cam,origin+Vector(offset))
    return {'x':round((end.x-start.x)*384,9),'y':round((start.y-end.y)*args.height,9)}
heading_projection={'xAxis':projected_vector((1,0,0)),'yAxis':projected_vector((0,1,0))}
meta={'version':1,'frame':{'width':384,'height':args.height},'orthoScale':4.15,'worldDimensions':{'length':2.98,'beam':1.22,'height':1.52},'passenger':{'heightWorld':1.02,'widthWorld':.48,'footWorld':[.22,0,.60],'openDeckBounds':{'xMin':-.30,'xMax':.72,'yMin':-.43,'yMax':.43},'drawOrder':['base','Feka at passengerFoot','foreground']},'frames':frames,'headingProjection':heading_projection,'headingCount':args.headings,'samples':args.samples,'source':'tools/diorama/render_journey_boat.py','note':'Original low-cabin working launch. Transparent fixed-size frames. Base contains the complete boat; nearer solid geometry is repeated on foreground to occlude actor feet correctly.'}
with open(f'{OUT}/boat.meta.json','w') as handle:json.dump(meta,handle,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/journey-boat.blend')
print('JOURNEY_BOAT_OUTPUT='+OUT)
