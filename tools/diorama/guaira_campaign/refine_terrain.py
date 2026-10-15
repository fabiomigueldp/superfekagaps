"""Guaíra terrain revision 2: unified coast, dry relief and grounded landscape.

Load docs/world/guaira/native-map-2026-10-13/guaira-native.blend.
Run export_terrain_inputs.py + layout_terrain.py first. --draft is a paired
1280px review; --no-render writes the editable final scene without rendering.
The source camera, all transport anchors, routes and water geometry survive.
"""
import bpy,bmesh,json,math,sys,random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from array import array
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/terrain-polish-2026-10-15'
DOC=ROOT/'docs/world/guaira/terrain-polish-2026-10-15';DOC.mkdir(parents=True,exist_ok=True)
layout=json.loads((WORK/'terrain-layout.json').read_text());scene=bpy.context.scene
draft='--draft' in sys.argv;random.seed(61015);new=[]
def linear(color):
    c=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
def material(name,color):
    c=linear(color);m=bpy.data.materials.new('Terrain v2 '+name);m.use_nodes=True;m.diffuse_color=(*c,1)
    ns=m.node_tree.nodes;ls=m.node_tree.links;p=ns.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.87
    p.inputs['Specular IOR Level'].default_value=.22
    geom=ns.new('ShaderNodeNewGeometry');noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.45;noise.inputs['Detail'].default_value=2
    ls.new(geom.outputs['Position'],noise.inputs['Vector']);ramp=ns.new('ShaderNodeValToRGB')
    for element,pos,factor in zip(ramp.color_ramp.elements,(.18,.82),(.91,1.065)):
        element.position=pos;element.color=tuple(v*factor for v in c)+(1,)
    ls.new(noise.outputs['Fac'],ramp.inputs['Fac']);ls.new(ramp.outputs['Color'],p.inputs['Base Color'])
    grain=ns.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=31;grain.inputs['Detail'].default_value=1
    ls.new(geom.outputs['Position'],grain.inputs['Vector']);bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.09;bump.inputs['Distance'].default_value=.012
    ls.new(grain.outputs['Fac'],bump.inputs['Height']);ls.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m
mats={name:material(name,color) for name,color in [('soil','C5804C'),('upper','B9693F'),('seam','9D5F3A'),('lower','AE704B'),('foot','946848')]}
ns=mats['soil'].node_tree.nodes;ls=mats['soil'].node_tree.links;p=ns.get('Principled BSDF');color=p.inputs['Base Color'].links[0].from_socket
attr=ns.new('ShaderNodeAttribute');attr.attribute_name='airstrip_dust';mix=ns.new('ShaderNodeMixRGB');mix.inputs[2].default_value=(*linear('C5A071'),1)
ls.new(attr.outputs['Fac'],mix.inputs[0]);ls.new(color,mix.inputs[1]);ls.new(mix.outputs[0],p.inputs['Base Color'])

archive=bpy.data.collections.new('Terrain v1 - preserved source');scene.collection.children.link(archive)
removed=[]
for ob in list(scene.objects):
    if ob.hide_render:continue
    if ob.name in {'Continuous clay island','STOL continuous irregular landing meadow','STOL graded dirt clearing'} or ob.name.startswith((
        'Fitted fractured cliff ','Broken horizontal sediment seam','Low eroded shoulder','Shoulder broken cap')):
        name=ob.name;ob.hide_render=True;ob.hide_viewport=True
        for col in list(ob.users_collection):col.objects.unlink(ob)
        archive.objects.link(ob);ob.name='Archived v1 - '+name;removed.append(name)
collection=bpy.data.collections.new('Guaíra continuous terrain v2');scene.collection.children.link(collection)
def mesh(name,vertices,faces,materials,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);assert all(e.is_manifold for e in bm.edges),name+' is not closed'
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True);assert volume>0,name+' has invalid volume'
    bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);collection.objects.link(ob)
    for m in materials:me.materials.append(m)
    if bevel:
        mod=ob.modifiers.new('Soft worn stone arris','BEVEL');mod.width=bevel;mod.segments=2
        ob.modifiers.new('Weighted stone normals','WEIGHTED_NORMAL')
    new.append({'name':name,'vertices':len(vertices),'faces':len(faces),'volume':round(volume,6)})
    return ob
terrain=mesh('Continuous clay island',layout['vertices'],layout['faces'],list(mats.values()))
for face,mat in zip(terrain.data.polygons,layout['materials']):
    face.material_index=list(mats).index(mat);face.use_smooth=face.index<layout['surfaceFaces']
# Smooth color transition across the old landing-platform seam. Geometry stays
# perfectly level throughout the original wheel envelope.
attr=terrain.data.attributes.new('airstrip_dust','FLOAT','POINT')
def smooth(a,b,v):
    t=min(1,max(0,(v-a)/(b-a)));return t*t*(3-2*t)
for i,v in enumerate(terrain.data.vertices):
    x,y,z=v.co;side=abs(x+6.39)+.065*math.sin(y*2.1+x)
    weight=(1-smooth(.64,1.34,side))*(1-smooth(2.10,2.86,abs(y+.48)))
    attr.data[i].value=weight*.84
terrain['terrain_revision']=2;terrain['shared_closed_coast']=True
terrain.data.calc_loop_triangles()
surface=BVHTree.FromPolygons([v.co for v in terrain.data.vertices],
    [tuple(t.vertices) for t in terrain.data.loop_triangles],all_triangles=True)
top_surface=BVHTree.FromPolygons([v.co for v in terrain.data.vertices],
    [tuple(t.vertices) for t in terrain.data.loop_triangles if t.polygon_index<layout['surfaceFaces']],all_triangles=True)
def ground(x,y):
    hit,_,_,_=surface.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
    assert hit is not None,('Missing landscape support',x,y)
    return hit.z

# A few broad, half-buried outcrops replace the old concentric cactus plinths.
# Their material follows the exposed coast; their shape has no repeated rim.
def rock(name,x,y,rx,ry,h,angle=0):
    z=ground(x,y)-.035;n=8;points=[]
    radii=[.92,1.02,.87,1.03,.94,1.04,.89,.96]
    for layer,(height,scale) in enumerate([(-.045,.88),(.035,1),(h,.66)]):
        for k,r in enumerate(radii):
            a=k*math.tau/n+.07*math.sin(k*2);dx=math.cos(a)*rx*r*scale;dy=math.sin(a)*ry*r*scale
            points.append((x+dx*math.cos(angle)-dy*math.sin(angle),y+dx*math.sin(angle)+dy*math.cos(angle),z+height+(0 if layer==0 else .014*math.sin(k))))
    faces=[tuple(range(n-1,-1,-1)),tuple(range(2*n,3*n))]
    faces += [(r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i) for r in range(2) for i in range(n)]
    ob=mesh(name,points,faces,[mats['upper'],mats['soil']],.015);ob.data.polygons[1].material_index=1
    return ob
for i,(x,y,rx,ry,h,a) in enumerate([
    (-3.43,-3.55,.53,.23,.17,-.22),(-2.30,-3.71,.41,.21,.14,-.12),(-1.56,-3.94,.31,.19,.13,.2),
    (-.12,-4.38,.49,.22,.15,.12),(.55,-4.49,.28,.17,.12,.18),
    (6.49,-2.67,.23,.46,.15,.1),(6.35,-3.44,.24,.30,.12,-.15),
    (5.91,1.19,.33,.36,.14,.2),(5.94,2.18,.30,.43,.15,-.18),
    (-1.65,1.59,.41,.24,.12,.15)]):
    rock('Terrain v2 embedded outcrop '+str(i),x,y,rx,ry,h,a)

# Small rooted dry-grass groups accent the ground/field transition without a
# ring of repeated dots or bushes crossing the playable streets.
grass=material('dry grass ochre','9D9457');grass_tip=material('dry grass sunlit','BEB27A')
for group,(x,y,scale) in enumerate([(-2.87,-3.92,.9),(-1.12,-4.12,.7),(.45,-4.33,.66),(6.43,-2.13,.9),(6.35,-3.65,.7),(5.96,1.72,.8)]):
    z=ground(x,y)-.012
    for k in range(7):
        angle=k*2.399+group*.43;dx,dy=math.cos(angle),math.sin(angle);width=.025*scale;h=(.20+.04*math.sin(k*1.8))*scale;lean=(.11+.03*(k%3))*scale
        v=[(x-dy*width,y+dx*width,z),(x+dy*width,y-dx*width,z),(x+dx*lean,y+dy*lean,z+h),
           (x,y,z-.035),(x+dx*lean*.4,y+dy*lean*.4,z+h*.35)]
        mesh(f'Terrain v2 rooted dry grass {group}-{k}',v,[(0,1,2),(0,3,1),(0,2,4),(2,1,4),(1,3,4),(3,0,4)],
             [grass_tip if k%3==0 else grass])

# Soil linework must be on the new ground, not floating at an old Z constant.
seated=[];trimmed=[]
for ob in scene.objects:
    if ob.hide_render or ob.type!='CURVE' or not ob.name.startswith(('Sparse dry crack','Branched soil fissure','Fissure fine branch')):continue
    inv=ob.matrix_world.inverted()
    supported=True
    for spline in ob.data.splines:
        world=[ob.matrix_world@Vector(p.co[:3]) for p in spline.points]
        for a,b in zip(world,world[1:]):
            for k in range(9):
                q=a.lerp(b,k/8);hit,_,_,_=top_surface.ray_cast(Vector((q.x,q.y,4)),Vector((0,0,-1)),5)
                if hit is None:supported=False
    if not supported:
        # Do not drape a soil crack down the cliff when its old endpoint lies
        # outside the newly rounded bank. Preserve it hidden in the source.
        ob.hide_render=True;ob.hide_viewport=True;trimmed.append(ob.name);continue
    for spline in ob.data.splines:
        for p in spline.points:
            world=ob.matrix_world@Vector(p.co[:3]);world.z=ground(world.x,world.y)+.002
            p.co=(*(inv@world),1)
    ob.data.bevel_depth=min(ob.data.bevel_depth,.007);seated.append(ob.name)

bpy.context.view_layer.update()
nav=json.loads(scene['native_navigation']);nav['revision']=2
nav['source']='docs/world/guaira/terrain-polish-2026-10-15/guaira-terrain.blend'
w,h=(1280,800) if draft else (1920,1200);nav['depth']['width']=w;nav['depth']['height']=h
scene['native_map_revision']=2;scene['native_navigation']=json.dumps(nav)
scene['terrain_revision_notes']='Single shared closed coast/airport; curved soil shoulder; broad sediment strata; protected navigation and wheel heights.'
scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU'
scene.cycles.samples=16 if draft else 64;scene.cycles.use_denoising=True;scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Terrain v2 paired beauty depth','CompositorNodeTree');scene.compositing_node_group=group
group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene;out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='depth-'+('draft-' if draft else 'final-')
file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB';file.save_as_render=False
file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(nav,indent=2)+'\n')
report={'revision':2,'newClosedMeshes':new,'archivedSourceObjects':removed,'groundedFissures':len(seated),
        'trimmedCoastalFissures':trimmed,'coastVertices':layout['boundaryVertices'],'groundArea':layout['area'],'allRoutesPreserved':True}
(WORK/'model-report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-terrain.blend'))
print('GUAIRA_TERRAIN_AUTHORED',len(new),'closed meshes',len(removed),'superseded objects',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    im=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(im.pixels);im.pixels.foreach_get(pixels);packed=array('H')
    for y in reversed(range(h)):
        for x in range(w):
            z=pixels[(y*w+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes())
    print('GUAIRA_TERRAIN_RENDERED',w,h,flush=True)
