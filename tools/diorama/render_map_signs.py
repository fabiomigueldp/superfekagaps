"""Render the original map-sign blanks with Blender 4.3+.

blender -b -t 8 -P render_map_signs.py -- --repo-root REPO --output-dir RENDERS
FEKA_SIGN_REPO_ROOT and FEKA_SIGN_OUTPUT_DIR may supply the same arguments.
Only PNG intermediates and measured JSON are written to the output directory.
"""
import bpy, math, os, json, sys, argparse, re
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
cli = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root', default=os.environ.get('FEKA_SIGN_REPO_ROOT'))
parser.add_argument('--output-dir', default=os.environ.get('FEKA_SIGN_OUTPUT_DIR'))
parser.add_argument('--only', choices=['stage','selected','complete','locked','selected-complete','dock-right','dock-left','factory-right'])
args = parser.parse_args(cli)
if not args.repo_root or not args.output_dir:
    parser.error('--repo-root and --output-dir (or FEKA_SIGN_* equivalents) are required')
REPO = Path(args.repo_root).expanduser().resolve()
OUT = str(Path(args.output_dir).expanduser().resolve())
colors = dict(re.findall(r"([A-Za-z][A-Za-z0-9]*)\s*:\s*'(#[0-9a-fA-F]{6})'", (REPO/'src/graphics/palette.ts').read_text()))
expected = {'soilLight':'#bc845d','soil':'#92604c','paper':'#f5efd3','soilDark':'#523748','inkLight':'#303650','gold':'#e9ad4c','teal':'#4eafa7','ink':'#191f35'}
for name, value in expected.items():
    if colors.get(name) != value:
        raise ValueError(f'Game palette changed at {name}; review the frozen sign art before rebuilding')
os.makedirs(OUT, exist_ok=True)

def material(name,color,grain=False):
    rgb=tuple(int(color[i:i+2],16)/255 for i in (1,3,5))
    rgb=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb)
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=.88
    if grain:
        nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=6;tex.inputs['Detail'].default_value=1
        coord=nt.nodes.new('ShaderNodeTexCoord');stretch=nt.nodes.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(.7,8,16);nt.links.new(coord.outputs['Generated'],stretch.inputs[0]);nt.links.new(stretch.outputs[0],tex.inputs[0])
        ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.12;ramp.color_ramp.elements[0].color=tuple(v*.84 for v in rgb)+(1,);ramp.color_ramp.elements[1].position=.86;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.06) for v in rgb)+(1,);nt.links.new(tex.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
    return m
def cube(name,loc,size,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('worn edge','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return o
def mesh(name,vs,fs,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    b=o.modifiers.new('hand-cut edge','BEVEL');b.width=.016;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o
kinds=['stage','selected','complete','locked','selected-complete','dock-right','dock-left']
if args.only:kinds=[args.only]
outputs=[item for item in json.load(open(f'{OUT}/signs.meta.json')) if item['kind'] not in kinds] if args.only and Path(OUT, 'signs.meta.json').exists() else []
for kind in kinds:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):bpy.data.materials.remove(m)
    timber=material('Original soil warm timber','#bc845d',True);edge=material('Original soil end grain','#92604c',True);face=material('Original paper pale weathered plank','#f5efd3',True);post=material('Original soil shadow','#523748',True);nail=material('Original ink iron nail','#303650');gold=material('Original gold paint','#e9ad4c');teal=material('Original teal completion cloth','#4eafa7')
    factory=kind=='factory-right';dock=kind.startswith('dock') or factory
    half=1.80 if factory else 1.42 if dock else .72;top=1.24;bottom=.59
    # Tiny natural chips keep the silhouette tactile without noisy ornament.
    outline=[(-half+.05,bottom),(-half,bottom+.07),(-half,top-.05),(-half+.035,top),(half-.055,top-.012),(half,top-.06),(half-.015,bottom+.02)]
    if dock:
        sign=1 if kind in {'dock-right','factory-right'} else -1
        board_top=1.40 if factory else 1.20
        outline=[(-half+.04,.58),(-half,.64),(-half,board_top-.06),(-half+.045,board_top),(half-.32,board_top-.01),(half, .995 if factory else .895),(half-.32,.59)]
        if sign==-1:outline=[(-x,z) for x,z in reversed(outline)]
    n=len(outline);verts=[(x,y,z) for y in [-.095,.105] for x,z in outline]
    mesh('single solid weathered board',verts,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],timber)
    # Painted face is inset from a visible, beveled solid wood edge.
    face_center=.99 if factory else .91
    inset=[(x*.93,-.109,face_center+(z-face_center)*.91) for x,z in outline]
    mesh('thin warm ivory painted face',inset,[tuple(range(n-1,-1,-1))],face)
    support_x = [-1.29] if factory else [.91] if kind=='dock-left' else [-.91] if kind=='dock-right' else [-.44,.44]
    for x in support_x:
        cube('square timber support post',(x,.065,.36),(.095,.125,.72),post,.017)
        cube('sunlit post grain',(x-.022,-.001,.32),(.022,.011,.56),timber,.004)
        cube('rear strengthening cleat',(x,.145,.90),(.11,.11,.65),edge,.017)
    # Dock signs cantilever from the pier-side post; the short rear bracket
    # stays below the name and leaves all canvas/camera/anchor geometry fixed.
    if dock:
        x=support_x[0]; inward=-1 if x>0 else 1
        a=Vector((x,.13,.37));b=Vector((x+inward*.46,.13,.66));o=cube('small cantilever knee brace',(a+b)/2,(.075,.10,(b-a).length),edge,.012);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    # Four modest forged fixings, not an outline around the whole sign.
    for x in [-half*.80,half*.78]:
        for z in [.70,1.12]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.019,location=(x,-.127,z));bpy.context.object.scale=(1,.33,1);bpy.context.object.data.materials.append(nail)
    if kind in {'selected','selected-complete'}:
        cube('narrow hand painted gold selection edge',(-.635,-.130,.91),(.047,.015,.43),gold,.01)
        cube('gold selection cap',(-.44,.044,.51),(.118,.145,.072),gold,.01)
    if kind in {'complete','selected-complete'}:
        cube('small completion pin',(.60,.02,1.275),(.023,.035,.30),edge,.004)
        mesh('small teal completion pennant',[(.61,-.018,1.40),(.78,-.018,1.37),(.70,-.018,1.29),(.62,-.018,1.30)],[(0,1,2,3)],teal)
    if kind=='locked':
        cube('small closed-route iron keeper',(.54,-.118,.56),(.072,.035,.17),nail,.012)
        cube('warm brass keeper pin',(.54,-.145,.61),(.089,.020,.038),gold,.006)
    scene=bpy.context.scene
    target=Vector((0,0,.63));bpy.ops.object.camera_add(location=(0,-8,4.6));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.32*128/104 if factory else 3.32 if dock else 1.78;scene.camera=cam
    world=bpy.data.worlds.new('diorama daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.66,.78,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
    for loc,power,size,color in [((-3,-4,7),470,4,(1,.90,.72)),((4,1,6),300,4,(.72,.85,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=50,location=(0,0,-.018));floor=bpy.context.object;floor.name='transparent contact shadow receiver';floor.is_shadow_catcher=True;floor.data.materials.append(material('neutral shadow receiver','#c8c0a6'))
    width,height=(512,224) if factory else (416,224) if dock else (224,232)
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False;scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.2
    bpy.context.view_layer.update()
    def project(p):
        q=world_to_camera_view(scene,cam,Vector(p));return {'x':round(q.x*width/4,3),'y':round((1-q.y)*height/4,3)}
    letter_center=project((-.09 if kind in {'dock-right','factory-right'} else .09 if kind=='dock-left' else 0,-.13,.905))
    half_safe=1.45 if factory else 1.04 if dock else .59;corners=[project((x,-.13,z)) for x in [-half_safe,half_safe] for z in [.65,1.34 if factory else 1.18]]
    face_rect={'x':min(p['x'] for p in corners),'y':min(p['y'] for p in corners),'width':max(p['x'] for p in corners)-min(p['x'] for p in corners),'height':max(p['y'] for p in corners)-min(p['y'] for p in corners)}
    data={'kind':kind,'image':kind+'.png','cssWidth':width//4,'cssHeight':height//4,'dpr':4,'foot':project((0,0,0)),'letterCenter':letter_center,'usableFace':face_rect,'letterPixelScale':2,'palette':{'letters':'#191f35','closedLetters':'#191f35','selected':'#e9ad4c'}}
    scene.render.filepath=f'{OUT}/{kind}.png';bpy.ops.render.render(write_still=True);outputs.append(data)
json.dump(outputs,open(f'{OUT}/signs.meta.json','w'),indent=2)
print('SIGN_PROTOTYPE='+OUT)
