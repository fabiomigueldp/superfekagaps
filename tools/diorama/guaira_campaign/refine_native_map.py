"""Guaíra: authored entrances, joined paths, masonry stairs and paired depth.

Load the campaign source produced by build.py --region guaira --build-only.
Run layout_native_paths.py first. --draft exports a quick review; --no-render
only saves the editable scene and navigation. Existing flight/water anchors stay.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
from array import array

ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'output/guaira/native-map-2026-10-13'
DOC=ROOT/'docs/world/guaira/native-map-2026-10-13'
DOC.mkdir(parents=True,exist_ok=True)
layout=json.loads((WORK/'layout.json').read_text())
scene=bpy.context.scene
draft='--draft' in sys.argv
new=[]
def material(name,color):
    c=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new('Guaira native '+name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.84
    return m
paving=material('warm limestone dust','D2AD77')
edging=material('worn sandstone edge','BCA17A')
steps=material('honed limestone tread','DCC49A')
grout=material('recessed masonry joint','847D67')
wood=bpy.data.materials['Dry timber'];bronze=bpy.data.materials['Bronze fittings'];teal=bpy.data.materials['Canal bed']
dark=bpy.data.materials['Door recesses']

def mesh(name,vs,fs,mat,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new('Native '+name,me);scene.collection.objects.link(o);me.materials.append(mat);new.append(o)
    bm=bmesh.new();bm.from_mesh(me)
    assert all(e.is_manifold for e in bm.edges), name+' must be a closed solid'
    # Recalculate only validated closed geometry; no microscopic Boolean rings.
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    if bevel:
        mod=o.modifiers.new('Worn small arris','BEVEL');mod.width=bevel;mod.segments=2
        o.modifiers.new('Area weighted normals','WEIGHTED_NORMAL')
    return o
def box(name,p,d,mat,bevel=.012):
    x,y,z=p;a,b,c=[v/2 for v in d]
    vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat,bevel)
def beam(name,a,b,width,height,mat,bevel=.01):
    a,b=Vector(a),Vector(b);center=(a+b)/2
    o=box(name,tuple(center),((b-a).length,width,height),mat,bevel)
    # Boxes have world-space vertices; rotate their mesh around their center.
    angle=math.atan2(b.y-a.y,b.x-a.x)
    for v in o.data.vertices:
        x,y=v.co.x-center.x,v.co.y-center.y
        v.co.x=center.x+x*math.cos(angle)-y*math.sin(angle)
        v.co.y=center.y+x*math.sin(angle)+y*math.cos(angle)
    return o

# Preserve source meshes in the editable file as an explicitly hidden collection.
old=bpy.data.collections.new('Original paths - superseded');scene.collection.children.link(old)
for ob in list(scene.objects):
    if ob.name.startswith('walk_') or ob.name=='Civic continuous earthen ascent':
        ob.hide_render=True;ob.hide_viewport=True
        for col in list(ob.users_collection):col.objects.unlink(ob)
        old.objects.link(ob)

for i,s in enumerate(layout['surfaces']):
    vs=[];ids={}
    def vertex(x,y,z):
        key=tuple(round(v,6) for v in (x,y,z))
        if key not in ids:ids[key]=len(vs);vs.append(key)
        return ids[key]
    fs=[]
    for tri in s['triangles']:
        fs.append(tuple(vertex(x,y,s['top']) for x,y in tri))
        fs.append(tuple(vertex(x,y,s['bottom']) for x,y in reversed(tri)))
    for ring in [s['ring'],*s['holes']]:
        for a,b in zip(ring,ring[1:]+ring[:1]):
            fs.append((vertex(*a,s['top']),vertex(*b,s['top']),vertex(*b,s['bottom']),vertex(*a,s['bottom'])))
    mesh('joined '+s['kind']+' paving '+str(i),vs,fs,paving,.008)
    # A continuous, restrained border cut from the actual union boundary. It
    # never draws individual dots along the navigation centerline.
    for j,(a,b) in enumerate(zip(s['ring'],s['ring'][1:]+s['ring'][:1])):
        a,b=Vector((*a,s['top']-.018)),Vector((*b,s['top']-.018))
        m=(a+b)/2
        if (2.50<m.x<3.72 and -2.32<m.y<-1.18) or (1.25<m.y<2.75 and 1.15<m.x<3.50):continue
        if m.y < -2.45 and m.x < -4.45:continue
        if (b-a).length<.15:continue
        count=max(1,math.ceil((b-a).length/.64))
        for k in range(count):
            aa=a.lerp(b,k/count);bb=a.lerp(b,(k+1)/count);v=(bb-aa).normalized()*.004
            beam(f'paving edge {i}-{j}-{k}',aa+v,bb-v,.095,.095,edging,.014)

for i,s in enumerate(layout['stairs']):
    a,b=Vector((*s['a'],0)),Vector((*s['b'],0));side=Vector((-(b-a).y,(b-a).x,0)).normalized()*s['width']/2
    ring=[a-side,b-side,b+side,a+side];top=s['top'];bottom=s['bottom']
    vs=[(p.x,p.y,z) for z in [bottom,top] for p in ring]
    if i<len(layout['stairs'])-1:
        mesh('civic stair solid '+str(i),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],steps,.009)
        # The worn edge sits on an unbeveled structural core. Adjacent cores
        # lap by 15 mm below the tread, closing hairline gaps under its arris.
        along=(b-a).normalized()*.015
        core_ring=[a-along-side,b+along-side,b+along+side,a-along+side]
        core=[(p.x,p.y,z) for z in (bottom,top-.025) for p in core_ring]
        mesh('civic stair bedding '+str(i),core,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],edging)
    # Paired cheeks are filled down to terrain, with a fitted coping at each
    # tread. No floating slabs, slope ornament, or exposed hollow staircase.
    for sign in (-1,1):
        aa=a+side*(sign*1.10);bb=b+side*(sign*1.10)
        h=top+.08;beam(f'stair cheek {i} {sign}',(aa.x,aa.y,(1.68+h)/2),(bb.x,bb.y,(1.68+h)/2),.16,h-1.68,edging,.009)
        beam(f'stair cheek cap {i} {sign}',(aa.x,aa.y,h+.025),(bb.x,bb.y,h+.025),.18,.05,steps,.009)

# Bridge deck: real joists and abutments remain; close unsafe plank-sized visual
# gaps, seat ends on the stone paths, and add low side rails away from the actor.
for i in range(10):
    y=-2.22+(i+.5)*.094
    box('bridge fitted plank '+str(i),(3.10,y,1.842),(1.06,.087,.096),wood,.008)
for x in (2.555,3.645):
    for y in (-2.16,-1.34):box('bridge low post',(x,y,1.94),(.07,.08,.36),wood)
    beam('bridge low rail',(x,-2.19,2.035),(x,-1.31,2.035),.055,.06,wood)

# Legible entrances use the village's own stone, wood and bronze vocabulary.
# The street remains the widest and brightest continuous shape in the scene.
# Keep the western pier outside the aircraft's real 32-heading wing-strut
# envelope, including taxi-in/out. The paved gate retains 0.96 m clear width.
for x in (-5.48,-4.35):
    box('vala seca threshold pier',(x,-1.47,2.025),(.17,.22,.54),edging)
    box('vala seca pier cap',(x,-1.47,2.315),(.22,.27,.07),steps)
    box('open gate leaf',(x,-1.05,2.01),(.075,.64,.30),wood)
    box('gate hinge',(x,-1.42,2.05),(.10,.05,.11),bronze,.003)

# Gallery now meets the actual repair-shop doorstep; decorative display lives
# beside the door and does not intrude into its access strip.
for x in (-3.34,-2.59):
    box('gallery doorway stone',(x,.67,2.07),(.12,.19,.57),steps)
box('gallery carved lintel',(-2.964,.74,2.51),(.93,.12,.13),edging)
for i in range(3):
    box('gallery repair plaque '+str(i),(-2.46,.77,2.04+i*.15),(.23,.04,.09),bronze if i==1 else teal,.006)

# Relief chamber's separate stone hatch, before the public standpipe. It is a
# visible architectural destination, rather than a second sign on the plaza.
box('relief hatch footing',(-1.48,.82,1.865),(.88,.54,.23),edging)
box('relief hatch recess',(-1.48,.73,2.045),(.58,.25,.14),dark)
for x in (-1.77,-1.19):box('relief hatch jamb',(x,.74,2.045),(.10,.29,.25),steps)
box('relief hatch lintel',(-1.48,.84,2.19),(.70,.18,.10),steps)
for x in (-1.65,-1.54,-1.43,-1.32):box('relief hatch bronze bar',(x,.60,2.06),(.025,.03,.16),bronze,.003)

box('patio valve pedestal',(-3.10,-1.73,1.98),(.57,.30,.45),edging)
box('patio valve panel',(-3.10,-1.88,2.11),(.42,.025,.21),teal,.005)
bpy.ops.mesh.primitive_torus_add(major_radius=.115,minor_radius=.023,major_segments=16,minor_segments=6,
    location=(-3.10,-1.91,2.16),rotation=(math.pi/2,0,0))
o=bpy.context.object;o.name='Native patio bronze handwheel';o.data.materials.append(bronze)
for a in (0,math.pi/2):
    # restrained cross spokes, entirely on the pedestal side of the landing
    beam('valve spoke',(-3.10-.09*math.cos(a),-1.915,2.16-.09*math.sin(a)),
        (-3.10+.09*math.cos(a),-1.915,2.16+.09*math.sin(a)),.02,.02,bronze,.003) if a==0 else box('valve upright',(-3.10,-1.915,2.16),(.02,.02,.18),bronze,.003)

# A shallow limestone cap closes the front civic wall, measured from its actual
# outline. Avoid the stair mouth instead of running coping through the route.
civic=bpy.data.objects['Civic terrace']
vs=[civic.matrix_world@v.co for v in civic.data.vertices]
ring=[p for p in vs if abs(p.z-2.4)<.0001]
for i,(a,b) in enumerate(zip(ring,ring[1:]+ring[:1])):
    mid=(a+b)/2
    if mid.y>3.15 or mid.x>1.40:continue
    length=(b-a).length;n=max(1,math.ceil(length/.6))
    for k in range(n):
        aa=a.lerp(b,k/n);bb=a.lerp(b,(k+1)/n);d=(bb-aa).normalized()*.006
        aa+=d;bb-=d;aa.z=bb.z=2.415
        beam(f'fitted civic coping {i}-{k}',aa,bb,.18,.075,steps)

# Remove only small dry crack/weed details physically overlapped by the new
# paths. Grouped authored scenery remains, preserving the drought narrative.
bpy.context.view_layer.update()
path_lines=[(Vector(a),Vector(b),r['width']/2+.10) for r in layout['routes']
            for a,b in zip(r['world'],r['world'][1:])]
removed=[]
for ob in scene.objects:
    if ob.hide_render or not ob.name.startswith(('Sparse dry crack','Tumbleweed hoops','Small old rib','Old spine')):continue
    points=[ob.matrix_world@Vector(p) for p in ob.bound_box];c=sum(points,Vector())/8
    def distance(a,b):
        a,b=Vector((a.x,a.y)),Vector((b.x,b.y));p=Vector((c.x,c.y));v=b-a
        t=max(0,min(1,(p-a).dot(v)/max(v.length_squared,1e-12)));return (p-a-t*v).length
    if any(distance(a,b)<w+.15 for a,b,w in path_lines):ob.hide_render=True;removed.append(ob.name)

bpy.context.view_layer.update()
camera=scene.camera;inverse=camera.matrix_world.inverted()
project=lambda p: {'x':round(world_to_camera_view(scene,camera,Vector(p)).x,7),'y':round(1-world_to_camera_view(scene,camera,Vector(p)).y,7)}
depth=lambda p:round(-(inverse@Vector(p)).z,6)
stage_ids=[id for id in layout['nodes'] if id.startswith('guaira-') and id!='guaira-arrival' or id in ('gallery','relief')]
navigation={'revision':1,'source':'docs/world/guaira/native-map-2026-10-13/guaira-native.blend',
 'nodes':{id:project(p) for id,p in layout['nodes'].items() if id in stage_ids},
 'junctions':{id:project(p) for id,p in layout['nodes'].items() if id not in stage_ids},
 'nodeDepths':{id:depth(p) for id,p in layout['nodes'].items()},'routes':[]}
for r in layout['routes']:
    length=sum((Vector(b)-Vector(a)).length for a,b in zip(r['world'],r['world'][1:]))
    navigation['routes'].append({k:r[k] for k in ('id','from','to','world','width','kind')} | {
       'points':[project(p) for p in r['world']], 'depths':[depth(p) for p in r['world']], 'duration':round(max(.55,length/1.65),3)})

# Orthographic upright slope matches WorldMapDepth's per-image-height model.
up=camera.matrix_world.to_quaternion()@Vector((0,1,0));toward=camera.matrix_world.to_quaternion()@Vector((0,0,1))
width,height=(1280,800) if draft else (1920,1200)
navigation['depth']={'width':width,'height':height,'unitMeters':1/256,
    'uprightDepthPerImageHeight':round(camera.data.ortho_scale*height/width*toward.z/up.z,7)}
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(navigation,indent=2)+'\n')
scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
scene.cycles.samples=12 if draft else 48;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU'
scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Guaíra native paired beauty and depth','CompositorNodeTree');scene.compositing_node_group=group
group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene
out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='guaira-depth-'+('draft-' if draft else 'final-')
file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB'
file.save_as_render=False;file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
scene['native_map_revision']=1;scene['native_navigation']=json.dumps(navigation)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-native.blend'))
(WORK/'model-report.json').write_text(json.dumps({'closedNewMeshes':len(new),'removedPathDebris':removed,'stairs':len(layout['stairs'])},indent=2)+'\n')
print('GUAIRA_NATIVE_AUTHORED',len(new),'closed solids',len(navigation['routes']),'projected routes',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    image=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(image.pixels);image.pixels.foreach_get(pixels)
    packed=array('H')
    for y in reversed(range(height)):
        for x in range(width):
            z=pixels[(y*width+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes())
    print('GUAIRA_NATIVE_RENDERED',width,height,flush=True)
