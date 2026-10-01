"""Render the two approved decorative maritime buoys into scratch.

blender -b -t 4 -P tools/diorama/render_maritime_buoys.py -- --output-dir /tmp/feka-maritime-buoys
PNG frames and authoring metadata stay outside the runtime repository.
See docs/world/maritime-buoys.md for the approved payload and audit limits.
"""
import argparse, bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

parser=argparse.ArgumentParser()
parser.add_argument('--output-dir',type=Path,default=Path('/tmp/feka-maritime-buoys'))
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.output_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,rgb,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb),1)
    p.inputs['Roughness'].default_value=.68;p.inputs['Metallic'].default_value=metal
    return m

cream=mat('shared boat ivory',(.98,.89,.67))
red=mat('weathered coral enamel',(.80,.27,.17))
green=mat('weathered sage enamel',(.28,.49,.34))
iron=mat('petrol iron cage',(.14,.24,.26),.12)
brass=mat('small brass lamp',(.84,.61,.26),.25)
foam=mat('quiet pale sea ripple',(.42,.68,.67))
prop=[]

def finish(o,name,m):
    o.name=name;o.data.materials.append(m);prop.append(o)
    bevel=o.modifiers.new('soft working edge','BEVEL');bevel.width=.014;bevel.segments=2
    o.modifiers.new('weighted face normals','WEIGHTED_NORMAL')
    return o

def cylinder(name,z,r,depth,m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=depth,location=(0,0,z))
    return finish(bpy.context.object,name,m)

def cone(name,z,r1,r2,depth,m):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=depth,location=(0,0,z))
    return finish(bpy.context.object,name,m)

def beam(name,a,b,r,m):
    a,b=Vector(a),Vector(b)
    o=cylinder(name,0,r,(b-a).length,m);o.location=(a+b)/2
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

scene=bpy.context.scene
target=Vector((0,0,.56));direction=Vector((11,-20,17.5))
bpy.ops.object.camera_add(location=target+direction);cam=bpy.context.object
cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.5;scene.camera=cam
world=bpy.data.worlds.new('shared maritime sky');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('warm key',(-4,-6,9),680,5,(1,.85,.64)),('sea fill',(5,2,7),420,5,(.66,.82,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.data.color=color
    o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=160;scene.render.resolution_y=208;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
records=[]
for kind,color in [('coral-conical',red),('sage-can',green)]:
    for o in prop:bpy.data.objects.remove(o,do_unlink=True)
    prop=[]
    cylinder('partly immersed dark float',.025,.33,.11,iron)
    cone('painted buoy shoulder',.18,.31,.22,.25,color)
    cylinder('ivory identification collar',.29,.235,.075,cream)
    cone('painted upper shoulder',.40,.23,.145,.16,color)
    cylinder('iron cage lower ring',.50,.145,.05,iron)
    for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
        p=(.10*math.cos(angle),.10*math.sin(angle))
        beam('short service cage post',(p[0],p[1],.50),(p[0],p[1],.91),.022,iron)
    cylinder('cage top collar',.915,.145,.05,cream)
    cylinder('quiet brass light',.96,.065,.07,brass)
    if kind=='coral-conical':cone('red conical daymark',1.075,.125,.015,.16,color)
    else:cylinder('green cylindrical daymark',1.06,.105,.14,color)
    # Two broken contact ripples only, painted geometry on the water plane.
    for start,end in [(math.radians(205),math.radians(280)),(math.radians(30),math.radians(102))]:
        knots=[(.44*math.cos(a),.44*math.sin(a),-.015) for a in [start+(end-start)*i/10 for i in range(11)]]
        for a,b in zip(knots,knots[1:]):beam('subtle broken ripple',a,b,.009,foam)
    bpy.context.view_layer.update()
    anchor=world_to_camera_view(scene,cam,Vector((0,0,0)))
    scene.render.filepath=str(OUT/(kind+'.png'));bpy.ops.render.render(write_still=True)
    records.append({'kind':kind,'image':kind+'.png','frame':{'width':160,'height':208},
        'widthInMap':1.5/20.6,'waterlineAnchor':{'x':anchor.x*160,'y':(1-anchor.y)*208},
        'heightWorld':1.155,'beamWorld':.66,'objectCount':len(prop)})
(OUT/'maritime-buoys-source.meta.json').write_text(json.dumps({'sourceCommit':'87453281d62436bc647a8a5b443e51520999df3e','purpose':'approved decorative buoy source','variants':records},indent=2))
print('MARITIME_BUOY_OUTPUT='+str(OUT))
