"""Revision 6: seated bridge approaches and real foreground depth.

blender --background --factory-startup --disable-autoexec \
  docs/world/delicia/imperio-delicia-v5.blend \
  --python tools/delicia/polish_map_depth.py -- --draft

Preserves v5. Both passes use the unchanged orthographic camera; depth is linear
camera distance, not lighting or a hand-painted silhouette. The rendered depth
EXR is an intermediate; package_island.py packs it losslessly for Canvas.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/world/delicia'
REVIEW = ROOT / 'output/delicia/map-depth-2026-10-10'
REVIEW.mkdir(parents=True, exist_ok=True)
DRAFT = '--draft' in sys.argv
scene = bpy.context.scene
assert scene.get('model_revision') == 5, 'Start from the preserved v5 source.'
metadata = json.loads((SOURCE/'island-map-v5.json').read_text(encoding='utf-8'))
routes = {o.name.split(' • ')[0]: [o.matrix_world @ Vector(p.co[:3]) for p in o.data.splines[0].points]
          for o in scene.objects if o.type == 'CURVE' and 'from' in o}
sys.path.insert(0,str(ROOT/'tools/delicia'))
import island_geometry as G
from island_landscape import height
G.M = {m.name:m for m in bpy.data.materials}
G.collection('14 • Clear orchard approaches')
def ground(x,y): return (x,y,height(x,y)+.075)
def rebuild_route(name, controls, grounded=True):
    record = next(r for r in metadata['routes'] if r['id']==name)
    # Keep the first iteration inspectable in the source file, but only one
    # road surface and centerline participate in the new render/export.
    for suffix in (' • route',' • limestone walking surface',' • bedded path edges'):
        old=bpy.data.objects.get(name+suffix)
        if old:
            old.name='v5 preserved • '+old.name; old.hide_render=True;old.hide_viewport=True
            if 'from' in old: del old['from']
    points=[Vector(p) for p in controls]
    for _ in range(2):
        smooth=[points[0]]
        for a,b in zip(points,points[1:]):smooth.extend((a*.75+b*.25,a*.25+b*.75))
        points=smooth+[points[-1]]
    line=[]
    for a,b in zip(points,points[1:]):
        count=max(1,math.ceil((b-a).length/.18))
        line.extend(a.lerp(b,i/count) for i in range(count))
    line.append(points[-1])
    if grounded:
        for p in line:
            p.z=height(p.x,p.y)+.075
            if name=='harbor-orchard' and p.y< -15.2:p.z=max(p.z,1.78)
    line[0]=Vector(controls[0]);line[-1]=Vector(controls[-1])
    verts=[];faces=[];sides=[];sidefaces=[];half=record['widthMeters']/2
    for i,p in enumerate(line):
        t=line[min(i+1,len(line)-1)]-line[max(0,i-1)]
        n=Vector((-t.y,t.x,0)).normalized()*half
        for q in (p-n,p+n):verts.append((q.x,q.y,p.z-.014))
        if i:faces.append((2*i-2,2*i-1,2*i+1,2*i))
    G.mesh(name+' • limestone walking surface',verts,faces,'trail')
    for side in (0,1):
        base=len(sides)
        for i in range(len(line)):
            x,y,z=verts[2*i+side];sides.extend(((x,y,z),(x,y,min(z-.03,height(x,y)-.025))))
            if i:sidefaces.append((base+2*i-2,base+2*i-1,base+2*i+1,base+2*i))
    G.mesh(name+' • bedded path edges',sides,sidefaces,'stone-warm')
    curve=bpy.data.curves.new(name+' • route','CURVE');curve.dimensions='3D'
    spline=curve.splines.new('POLY');spline.points.add(len(line)-1)
    for q,p in zip(spline.points,line):q.co=(*p,1)
    obj=bpy.data.objects.new(name+' • route',curve);G.COLLECTION.objects.link(obj)
    obj.hide_render=True;obj.show_in_front=True;obj['from']=record['from'];obj['to']=record['to'];obj['walk_width_m']=half*2
    routes[name]=line
    record['duration']=round(max(.6,sum((b-a).length for a,b in zip(line,line[1:]))/8),3)
    record['points']=[]
    for p in line:
        q=world_to_camera_view(scene,scene.camera,p)
        record['points'].append({'x':round(q.x,7),'y':round(1-q.y,7)})

# These paths previously crossed the solid retaining wall of the north walk.
# Approach its west landing from the foreground; keep the sanctuary in its grove.
rebuild_route('harbor-orchard',[routes['harbor-orchard'][0],*[ground(x,y) for x,y in
    [(-13.2,-16.5),(-10.8,-17.2),(-7.6,-16),(-6.5,-13.8),(-6.2,-10.8),(-6,-8.3),
     (-6.9,-3.5),(-8,-1.4),(-11.5,-.1),(-13.1,.3),(-14.2,1.8)]],routes['harbor-orchard'][-1]])
rebuild_route('orchard-aqueduct',[routes['orchard-aqueduct'][0],(-13.5,1.9,7.5),(-12.9,.65,8.05),
    (-11.6,.9,8.55),routes['orchard-aqueduct'][-1]],False)
rebuild_route('west-bank',[routes['west-bank'][0],(-10.65,1.45,8.55),ground(-10.65,-.65),
    *[ground(x,y) for x,y in [(-9,-1.6),(-8,-1.4),(-6.9,-3.5),(-5.7,-5.1)]],routes['west-bank'][-1]],False)
# Wider stair shoulders express the descent; the sampled center remains the
# same ramp used by the native walk, so there is no vertical jump at its ends.
G.stairs('West aqueduct access',ground(-10.65,-.65),(-10.65,1.45,8.55),1.15,14)
rebuild_route('roots-sanctuary',[routes['roots-sanctuary'][0],*[ground(x,y) for x,y in
    [(-14.6,4.1),(-15.1,6.5),(-15.4,7.3)]],routes['roots-sanctuary'][-1]])

# Clear the whole upright character, not just his feet. Relocate complete tree
# assemblies so trunks, fruit and crowns stay together and remain editable.
trunks=[o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Cypress trunk'))]
parts=[o for o in scene.objects if o.name.startswith(('Gnarled orange trunk','Citrus branch','Angular leafy crown','Ripe citrus fruit','Cypress trunk','Tapering cypress foliage'))]
positions={o:o.matrix_world.translation.copy() for o in trunks};groups={o:[] for o in trunks};owners={}
for o in parts:
    p=o.matrix_world.translation
    tree=min(trunks,key=lambda t:(positions[t].x-p.x)**2+(positions[t].y-p.y)**2)
    groups[tree].append(o);owners[o]=tree
perimeter=[(-22.5,13.5),(-19.5,16.4),(-12.7,17),(-10.4,15.2),(-24.5,10.8),(-8.2,13.9)]
moved=[]
for _ in range(3):
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    toward=scene.camera.matrix_world.to_quaternion()@Vector((0,0,1));blocked=set()
    for name in ('harbor-orchard','orchard-aqueduct','roots-sanctuary'):
        for p in routes[name][::2]:
            for dz in (.3,.8,1.15):
                head=p+Vector((0,0,dz))
                hit,loc,n,f,o,m=scene.ray_cast(deps,head+toward*160,-toward,distance=159.88)
                if hit and o in owners:blocked.add(owners[o])
    for tree in sorted(blocked,key=lambda o:o.name):
        if not perimeter:break
        x,y=perimeter.pop(0);p=positions[tree];delta=Vector((x-p.x,y-p.y,height(x,y)-height(p.x,p.y)))
        for o in groups[tree]:o.location+=delta
        positions[tree]=p+delta;moved.append({'tree':tree.name,'shift':list(delta)})

# The v4 bank rose 20–35 cm through the bridge deck. Seat the existing road
# into the terrain with gently feathered shoulders, retaining the river bed.
# Spatial buckets keep this reproducible for the full high-resolution mesh.
buckets = {}
for r in metadata['routes']:
    for p in routes[r['id']]:
        key = (math.floor(p.x), math.floor(p.y))
        buckets.setdefault(key, []).append((p, r['widthMeters']/2))
terrain = next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
lowered = 0; deepest = 0
for vertex in terrain.data.vertices:
    x,y,z = vertex.co; target = z
    if z < 1: continue
    for bx in range(math.floor(x)-1, math.floor(x)+2):
        for by in range(math.floor(y)-1, math.floor(y)+2):
            for p, half in buckets.get((bx,by), []):
                d = math.hypot(x-p.x,y-p.y)
                if d > half+.42 or z < p.z-.035 or z > p.z+1: continue
                t = min(1, max(0, (d-half)/.42)); weight = 1-t*t*(3-2*t)
                target = min(target,z+(p.z-.035-z)*weight)
    if target < z-.001:
        vertex.co.z = target; lowered += 1; deepest = max(deepest,z-target)
terrain.data.update()

# Retain original buildings and foliage. Rails and crowns can now genuinely
# sit in front of the native pixel actor instead of being painted beneath him.
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
camera = scene.camera; inverse = camera.matrix_world.inverted()
toward = camera.matrix_world.to_quaternion() @ Vector((0,0,1))
def distance(point): return round(-(inverse @ point).z, 6)
def visible(point):
    origin = point+toward*160
    for _ in range(12):
        remaining = (origin-point).dot(toward)-.12
        if remaining <= 0: return True
        hit,loc,normal,face,obj,matrix = scene.ray_cast(deps,origin,-toward,distance=remaining)
        if not hit: return True
        if not obj.hide_render: return False
        origin = loc-toward*.002
    return True
for route in metadata['routes']:
    line = routes[route['id']]
    route['depths'] = [distance(p) for p in line]
    route['visible'] = [visible(p) for p in line]
metadata['nodeDepths'] = {o['stage_id']:distance(o.matrix_world.translation) for o in scene.objects if 'stage_id' in o}
for r in metadata['routes']:
    metadata['nodeDepths'][r['from']] = r['depths'][0]
    metadata['nodeDepths'][r['to']] = r['depths'][-1]
metadata['revision'] = 6
metadata['source'] = 'docs/world/delicia/imperio-delicia-v6.blend'
metadata['objects'] = len(scene.objects)
metadata['depth'] = {'file':'island-depth.png','encoding':'rg16','unitMeters':1/256,
    'empty':65535,'width':2560,'height':1600,
    'uprightDepthPerImageHeight':round(camera.data.ortho_scale/1.6*toward.z/math.hypot(toward.x,toward.y),6)}
metadata['navigation'] += '; seated bridge banks, camera depth and per-path visibility'
scene['model_revision'] = 6; scene['navigation_revision'] = 2
scene.render.resolution_x = 1440 if DRAFT else 2560
scene.render.resolution_y = 900 if DRAFT else 1600
scene.render.resolution_percentage = 100
scene.cycles.samples = 16 if DRAFT else 48
scene.cycles.device = 'CPU'; scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
scene.view_layers[0].use_pass_z = True
group = bpy.data.node_groups.new('Island beauty and linear camera depth', 'CompositorNodeTree')
scene.compositing_node_group = group
group.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
render = group.nodes.new('CompositorNodeRLayers'); render.scene = scene
out = group.nodes.new('NodeGroupOutput'); group.links.new(render.outputs['Image'],out.inputs['Image'])
depth = group.nodes.new('CompositorNodeOutputFile')
depth.directory = str(REVIEW); depth.file_name = 'depth-v6-draft' if DRAFT else 'depth-v6'
depth.format.media_type = 'IMAGE'; depth.format.file_format = 'OPEN_EXR'
depth.format.color_depth = '32'; depth.format.color_mode = 'RGB'
depth.save_as_render = False
depth.file_output_items.new('RGBA','Depth')
group.links.new(render.outputs['Depth'],depth.inputs[0])
destination = REVIEW if DRAFT else SOURCE
scene.render.filepath = str(destination/('island-v6-draft.png' if DRAFT else 'island-render-v6.png'))
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
bpy.ops.wm.save_as_mainfile(filepath=str(destination/'imperio-delicia-v6.blend'))
(destination/'island-map-v6.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(REVIEW/'geometry-audit.json').write_text(json.dumps({'terrainVerticesSeated':lowered,'maximumCutMeters':deepest,'movedTrees':moved,
    'routes':[{ 'id':r['id'],'samples':len(r['visible']),'hidden':r['visible'].count(False)} for r in metadata['routes']]},indent=2),encoding='utf-8')
print('DELICIA V6: geometry and depth metadata saved',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    # Read scene-linear floats inside Blender; no third-party EXR decoder needed.
    from array import array
    path = max(REVIEW.glob('depth-v6-draft*.exr' if DRAFT else 'depth-v6Depth*.exr'),key=lambda p:p.stat().st_mtime)
    image = bpy.data.images.load(str(path),check_existing=False)
    pixels = array('f',[0])*len(image.pixels); image.pixels.foreach_get(pixels)
    width,height = image.size
    packed = array('H')
    for y in reversed(range(height)):
        for x in range(width):
            z=pixels[(y*width+x)*4]
            packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (REVIEW/('depth-draft.u16' if DRAFT else 'depth.u16')).write_bytes(packed.tobytes())
    print('DEPTH_PACKED',width,height,flush=True)
