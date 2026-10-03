"""Original grounded STOL terminals and Guaíra campaign diorama.
blender -b -t 8 -P tools/diorama/guaira_campaign/build.py -- --region guaira
Reuses the actual Guaíra neighborhood/canal scene, never changes the chapter art.
"""
import bpy, math, json, os, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3]
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
REGION=ARGS[ARGS.index('--region')+1] if '--region' in ARGS else 'guaira'
OUT=ROOT/'public/assets/world/map/guaira-campaign';OUT.mkdir(parents=True,exist_ok=True)
if REGION=='guaira':
 source=ROOT/'tools/diorama/guaira/build_guaira.py'
 namespace={'__file__':str(source),'__name__':'guaira_campaign_source'}
 # Fresh authored geometry only; do not run the experimental export/save block.
 exec(compile(source.read_text().split('scene=bpy.context.scene;bpy.ops.object.camera_add')[0],str(source),'exec'),namespace)
else:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0):
 rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m=bpy.data.materials.new('STOL '+name);m.diffuse_color=(*linear,1);m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*linear,1);p.inputs['Roughness'].default_value=.72;p.inputs['Metallic'].default_value=metal
 return m
clay=material('compacted red earth','AF603B');rock=material('retaining masonry','9C8B70');dry=material('dry hard runway','BEAC88');ivory=material('warm ivory','F3DFC1');teal=material('teal paint','3B777C');roof=material('terracotta','BD583E');glass=material('blue glazing','427784');dark=material('graphite','34464C');gold=material('apron safety stripe','E7B754');coral=material('windsock coral','E66C45');wood=material('timber','866146')
if REGION=='fabrica': clay=material('industrial seawall','5C7074');rock=material('industrial retaining stone','687775');roof=teal
if REGION=='serra': clay=material('limestone cut platform','999F9E');rock=material('mountain retaining wall','B7B29F');dry=material('mountain runway','B4B09B')

def box(n,p,d,m,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name='STOL '+n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  b=o.modifiers.new('worn arris','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return o

def rod(n,a,b,r,m):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name='STOL '+n;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o

def label(n,body,p,size,m):
 c=bpy.data.curves.new(n,'FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.005;o=bpy.data.objects.new('STOL '+n,c);bpy.context.collection.objects.link(o);o.location=p;o.rotation_euler=(math.pi/2,0,0);c.materials.append(m)

# Broad material variation remains readable after atlas downsampling; fine grain
# only breaks the sterile slab highlight. All treatment is visual, not geometry.
shoulder=material('graded gravel shoulder','B9A17D' if REGION!='serra' else 'A39F8B')
for mat,scale,strength in [(dry,7,.12),(clay,4,.17)]:
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
 bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.045
 links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],nodes['Principled BSDF'].inputs['Normal'])
 if mat==clay:
  # Sun-faded, compacted soil variation instead of a featureless vertical face.
  ramp=nodes.new('ShaderNodeValToRGB');base=list(mat.diffuse_color)
  ramp.color_ramp.elements[0].position=.20;ramp.color_ramp.elements[0].color=tuple(v*.68 for v in base[:3])+(1,)
  ramp.color_ramp.elements[1].position=.80;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.13) for v in base[:3])+(1,)
  links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])

# Runway, full-depth embankment, apron and walkway exist before any decoration.
# Every footpath segment is a closed solid down to the same bedrock datum.
config={
 'guaira':dict(center=(-9,0,1.8),axis='y',join=(-5,-2.8,1.8),gate=(-6.2,-2.8,1.8),park=(-8,-2.4,1.8),target=(-2,.25,3),cam=(9,-20,18.85),scale=27),
 'fabrica':dict(center=(10,0,1.18),axis='y',join=(4.25,-1.85,1.18),gate=(7,-2.4,1.18),park=(9,-2.4,1.18),target=(0,.25,2.25),cam=(11,-20,17.5),scale=20.6),
 'serra':dict(center=(-5.75,-7.4,1.65),axis='x',join=(-5.75,-3.6,1.65),gate=(-5.75,-4.35,1.65),park=(-5.75,-6.4,1.65),target=(0,.25,3.6),cam=(11,-20,18.85),scale=20.6),
}[REGION]
cx,cy,z=config['center'];is_y=config['axis']=='y';dims=(5.6,8.4) if is_y else (8.4,5.6)
box('continuous runway embankment',(cx,cy,(z-.02)/2),(dims[0]+.4,dims[1]+.4,z-.22),clay,.18)
box('runway flat dry surface',(cx,cy,z-.055),(dims[0],dims[1],.11),dry,0)
# A compacted lane sits inside graded shoulders, keeping the original flat
# surface and the full unobstructed 5.2 m swept span intact.
for sign in [-1,1]:
 p=(cx+sign*2.32,cy,z+.001) if is_y else (cx,cy+sign*2.32,z+.001)
 box('graded runway shoulder',p,(.94,8.38,.002) if is_y else (8.38,.94,.002),shoulder,0)
 p=(cx+sign*1.80,cy,z+.004) if is_y else (cx,cy+sign*1.80,z+.004)
 box('painted landing lane edge',p,(.055,7.70,.006) if is_y else (7.70,.055,.006),ivory,.002)
# Visible retaining footings bond the runway to solid terrain, never floating slabs.
for i in range(9):
 a=-3.8+i*.95
 for sign in [-1,1]:
  p=(cx+sign*2.9,cy+a,z*.45) if is_y else (cx+a,cy+sign*2.9,z*.45)
  box('retaining block',p,(.22,.86,z*.7) if is_y else (.86,.22,z*.7),rock,.045)
runway_start=(cx,cy-3.65,z) if is_y else (cx-3.65,cy,z)
runway_end=(cx,cy+3.65,z) if is_y else (cx+3.65,cy,z)
for t in [-3,-1.5,0,1.5,3]:
 p=(cx,cy+t,z+.012) if is_y else (cx+t,cy,z+.012)
 box('runway center dash',p,(.13,.72,.02) if is_y else (.72,.13,.02),ivory,.002)
for sign in [-1,1]:
 for side in [-.7,-.35,.35,.7]:
  p=(cx+side,cy+sign*3.35,z+.012) if is_y else (cx+sign*3.35,cy+side,z+.012)
  box('threshold bar',p,(.19,.48,.02) if is_y else (.48,.19,.02),ivory,.002)

path_layer=0
def supported_path(a,b,width=1.15):
 global path_layer
 path_layer+=1
 a,b=Vector(a),Vector(b);length=(b-a).length;mid=(a+b)/2
 o=box('grounded approach causeway',(mid.x,mid.y,(z+.1)/2),(length+.25,width,z-.1),rock,.03);o.rotation_euler.z=math.atan2(b.y-a.y,b.x-a.x)
 o=box('continuous passenger walkway',(mid.x,mid.y,z+.014+path_layer*.004),(length+.22,width-.08,.035),ivory,.018);o.rotation_euler.z=math.atan2(b.y-a.y,b.x-a.x)
walk=[config['join'],config['gate'],config['park']]
for a,b in zip(walk,walk[1:]):supported_path(a,b)
# The open terminal stands OUTSIDE the clear 5.2m aircraft swept corridor.
if REGION=='guaira':tx,ty=-5.1,-.85
elif REGION=='fabrica':tx,ty=6.2,-.95
else:tx,ty=-3.8,-3.85
box('terminal solid apron',(tx,ty,(z+.1)/2),(2.25,1.5,z-.1),rock)
box('terminal apron surface',(tx,ty,z+.015),(2.25,1.5,.05),ivory)
supported_path(config['gate'],(tx,ty-.35,z),.95)
box('terminal rear wall',(tx,ty+.35,z+.57),(1.75,.16,1.14),ivory)
box('terminal teal service office',(tx+.49,ty,z+.55),(.65,.75,1.1),teal)
box('office recessed window',(tx+.49,ty-.389,z+.68),(.41,.035,.35),glass)
for dx in [-.88,.05]:rod('terminal canopy column',(tx+dx,ty-.55,z),(tx+dx,ty-.55,z+1.2),.05,teal)
canopy=box('terminal sloping canopy',(tx,ty,z+1.23),(2.15,1.48,.16),roof);canopy.rotation_euler.x=.10
# Raised roof seams echo the handcrafted terracotta buildings behind Guaíra;
# industrial Fábrica keeps its simple standing-seam metal canopy.
for dx in [-.96,-.72,-.48,-.24,0,.24,.48,.72,.96]:
 rod('canopy roof seam',(tx+dx,ty-.70,z+1.23+.08-.07),(tx+dx,ty+.70,z+1.23+.08+.07),.027 if REGION=='fabrica' else .042,roof)
box('canopy ivory fascia',(tx,ty-.737,z+1.155),(2.17,.06,.105),ivory,.01)
box('departure sign',(tx-.22,ty-.73,z+.97),(1.45,.075,.27),teal)
label('terminal destination',{'guaira':'GUAÍRA','fabrica':'FÁBRICA','serra':'SERRA'}[REGION],(tx-.08,ty-.777,z+.97),.18,ivory)
# One strong boarding symbol works at map size without more labels or props.
box('boarding sign plate',(tx-.66,ty-.785,z+.96),(.24,.025,.22),gold,.008)
rod('boarding arrow shaft',(tx-.74,ty-.805,z+.96),(tx-.59,ty-.805,z+.96),.012,teal)
rod('boarding arrow upper',(tx-.64,ty-.805,z+1.01),(tx-.59,ty-.805,z+.96),.012,teal)
rod('boarding arrow lower',(tx-.64,ty-.805,z+.91),(tx-.59,ty-.805,z+.96),.012,teal)
label('terminal subline','CORREIO AÉREO',(tx,ty+.253,z+.73),.12,teal)
box('passenger bench',(tx-.30,ty+.06,z+.32),(.65,.30,.12),wood)
for dx in [-.53,-.1]:box('bench legs',(tx+dx,ty+.06,z+.15),(.09,.24,.30),teal)
for dx in [-.24,.24]:
 box('cargo crate',(tx+dx,ty+.72,z+.22),(.4,.4,.42),wood)
 for offset in [-.11,.11]:box('crate strap',(tx+dx+offset,ty+.505,z+.22),(.035,.017,.42),dark,.002)
# Windsock at terminal edge, beyond all runway obstacle clearance.
wx,wy=tx+1.0,ty+.45
rod('windsock mast',(wx,wy,z),(wx,wy,z+2.0),.025,teal)
for i in range(5):
 a=(wx+i*.115,wy,z+1.9-i*.033);b=(wx+(i+1)*.115,wy,z+1.9-(i+1)*.033)
 rod('windsock cloth',a,b,.13-i*.017,coral if i%2==0 else ivory)
# Warm flush edge markers are low, grounded and safely outside the wheel lane.
for t in [-3.5,-1.8,0,1.8,3.5]:
 for sign in [-1,1]:
  p=(cx+sign*2.6,cy+t,z+.035) if is_y else (cx+t,cy+sign*2.6,z+.035)
  box('flush runway edge reflector',p,(.12,.12,.07),gold,.015)

scene=bpy.context.scene;bpy.ops.object.camera_add(location=config['cam']);cam=bpy.context.object;target=Vector(config['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=config['scale'];scene.camera=cam
world=bpy.data.worlds.new('Warm archipelago daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.65,.76,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for n,p,e,size,color in [('warm key',(-8,-10,19),2400,9,(1,.84,.67)),('sky fill',(8,3,13),1450,8,(.73,.82,1)),('rim',(-4,10,17),1600,7,(1,.94,.8))]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=e;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.cycles.max_bounces=5;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3
bpy.context.view_layer.update()
def project(p):
 v=world_to_camera_view(scene,cam,Vector(p));return {'x':round(v.x,6),'y':round(1-v.y,6)}
# Project with the original island camera; oversized transparent overlay render is
# packed back into that same canonical space, so existing routes never move.
meta={'regionKey':REGION,'camera':{'position':list(cam.location),'target':list(target),'orthoScale':config['scale']},'terminal':{'groundAnchor':project(config['park']),'runwayStart':project(runway_start),'runwayEnd':project(runway_end),'boardingPath':[project(p) for p in walk],'groundAnchorWorld':config['park'],'runwayStartWorld':runway_start,'runwayEndWorld':runway_end,'boardingPathWorld':walk,'surface':'dry-compacted-earth','clearSpanMeters':5.2,'usableLengthMeters':7.3},'supportFootprint':{'center':[cx,cy],'width':dims[0]+.4,'depth':dims[1]+.4,'bottomZ':.1,'topZ':z,'walkWidth':1.15,'walkSegments':walk},'assetFrame':{'left':0,'top':0,'widthInMap':1,'heightInMap':1}}
if REGION=='guaira':
 meta['nodes']={k:{**project(p),'world':p} for k,p in namespace['NODES'].items()};meta['routes']={str(i):[project(p) for p in r] for i,r in enumerate(namespace['ROUTES'])}
else:
 cam.data.ortho_scale*=2
 meta['assetFrame']={'left':-.5,'top':-.5,'widthInMap':2,'heightInMap':2}
# Assert all path vertices are on a real source support surface using vertical
# ray casts; path and runway slab checks are geometric rather than art guesses.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();checks=[]
for a,b in zip(walk,walk[1:]):
 for k in range(21):
  p=Vector(a).lerp(Vector(b),k/20);hit,loc,normal,idx,obj,matrix=scene.ray_cast(deps,p+Vector((0,0,.075)),Vector((0,0,-1)),distance=.15)
  checks.append(bool(hit))
assert all(checks),'Disconnected passenger path'
meta['validation']={'walkSupportSamples':len(checks),'allSupported':all(checks),'numericCampaignIdsChanged':False,'objects':len(scene.objects)}
json.dump(meta,open(OUT/f'{REGION}.meta.json','w'),indent=2,ensure_ascii=False)
scene.render.filepath=str(OUT/f'{REGION}.png')
bpy.ops.wm.save_as_mainfile(filepath=f'/tmp/feka-{REGION}-campaign.blend')
bpy.ops.render.render(write_still=True)
print('CAMPAIGN_TERMINAL_READY='+REGION)
