"""Original STOL courier, true orthographic headings matching world dioramas.
blender -b -t 6 -P tools/diorama/render_journey_aircraft.py -- --output-dir output/aircraft
Then python tools/diorama/package_journey_aircraft.py --render-dir output/aircraft.
The reproducible source is the model; no external assets or downloaded meshes.
"""
import bpy, math, os, sys, json, argparse
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--output-dir',required=True);p.add_argument('--headings',type=int,default=32);p.add_argument('--samples',type=int,default=24);p.add_argument('--metadata-only',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);os.makedirs(a.output_dir,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(*[(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92) for v in color],1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=.48;return m
ivory=material('warm linen ivory',(.97,.9,.7));coral=material('sunburnt coral enamel',(.87,.28,.17));teal=material('river teal stripe',(.12,.44,.46));glass=material('blue smoked cockpit',(.16,.35,.41),.35);rubber=material('charcoal tyres',(.13,.18,.18));steel=material('brushed alloy',(.65,.7,.67),.55);gold=material('yellow hub',(.97,.66,.23));green=material('passenger cap green',(.32,.61,.25))
objects=[]
def finish(o,name,m,bevel=0):
    o.name=name;o.data.materials.append(m);objects.append(o)
    if bevel:
        mod=o.modifiers.new('rounded handmade edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return o
def cube(name,loc,size,m,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bevel)
def mesh(name,v,f,m,bevel=.025):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,m,bevel)
def beam(name,start,end,r,m):
    start,end=Vector(start),Vector(end);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(end-start).length,location=(start+end)/2);o=bpy.context.object;o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler();return finish(o,name,m,.008)
def sphere(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,m)
# Nose faces local +X. Tapered fuselage with visible shoulder and warm belly.
rings=[(-1.95,.075,.1,.87),(-1.25,.19,.22,.87),(-.55,.34,.38,.94),(.58,.37,.37,.96),(1.12,.31,.3,.96),(1.48,.21,.24,.96)]
v=[]
for x,wy,h,z in rings:
    v += [(x,math.sin(i*math.tau/12)*wy,z+math.cos(i*math.tau/12)*h) for i in range(12)]
f=[tuple(range(11,-1,-1))]+[(r*12+i,r*12+(i+1)%12,(r+1)*12+(i+1)%12,(r+1)*12+i) for r in range(len(rings)-1) for i in range(12)]+[tuple(range((len(rings)-1)*12,len(rings)*12))]
mesh('lofted courier fuselage',v,f,ivory)
sphere('coral radial cowling',(1.22,0,.99),(.44,.335,.335),coral)
for y in [-.345,.345]:
    mesh('side teal sweep',[(-1.62,y*.42,.88),(.86,y,.82),(.9,y,.9),(-1.62,y*.42,.94)],[(0,1,2,3)],teal,.003)
# Faceted cockpit glazing, split windshield, thick ivory posts.
for y in [-1,1]:
    mesh('pilot side glazing',[(.17,y*.367,.99),(.72,y*.318,1.03),(.52,y*.30,1.29),(.15,y*.305,1.32)],[(0,1,2,3)],glass,.012)
    mesh('passenger side glazing',[(-.50,y*.338,.99),(.06,y*.367,.99),(.04,y*.306,1.32),(-.49,y*.292,1.26)],[(0,1,2,3)],glass,.012)
    beam('cabin ivory window post',(.105,y*.37,.97),(.10,y*.31,1.34),.023,ivory)
    beam('door outline',(-.52,y*.34,.75),(-.52,y*.34,1.23),.013,teal)
    cube('door brass handle',(-.35,y*.358,.93),(.11,.025,.028),gold,.01)
    # Small cap and face detail embedded in cabin window: no standing passenger on roof.
    sphere('Feka cap behind side window',(-.20,y*.357,1.18),(.10,.016,.043),green)
    sphere('passenger face behind side window',(-.20,y*.357,1.11),(.066,.015,.064),ivory)
mesh('slanted windscreen',[(.73,-.27,1.04),(.73,.27,1.04),(.52,.27,1.29),(.52,-.27,1.29)],[(0,1,2,3)],glass)
beam('windshield central post',(.74,0,1.04),(.53,0,1.30),.023,ivory)
# One broad high wing; shaped tips, real airfoil thickness, coral tips and ailerons.
def wing(name,inner,outer,m):
    verts=[(-.70,inner,1.42),(.67,inner,1.42),(.47,outer,1.47),(-.47,outer,1.47),(-.70,inner,1.50),(.67,inner,1.56),(.47,outer,1.55),(-.47,outer,1.51)]
    return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m,.045)
for sign in [-1,1]:
    wing('ivory high lift wing',0,sign*2.12,ivory);wing('coral swept wingtip',sign*2.1,sign*2.43,coral)
    beam('wing teal pinstripe',(.48,sign*.4,1.565),(.34,sign*2.1,1.56),.024,teal)
    beam('aileron hinge',(-.45,sign*.8,1.525),(-.36,sign*2.03,1.535),.012,teal)
    beam('load bearing wing strut',(-.17,sign*.27,.70),(-.12,sign*1.68,1.44),.027,steel)
    beam('wing leading brace',(.3,sign*.28,.77),(.34,sign*1.52,1.46),.020,steel)
    # sprung landing gear: wheel contact at z=0.
    beam('landing gear leg',(.55,sign*.23,.77),(.43,sign*.62,.23),.044,steel)
    sphere('tyre',(.43,sign*.65,.22),(.23,.11,.22),rubber)
    beam('wheel hub',(.43,sign*.70,.22),(.43,sign*.78,.22),.084,gold)
    cube('wheel spat',(.43,sign*.65,.33),(.49,.24,.15),coral,.07)
# Tailplane and generous sculpted fin, with rudder seam.
mesh('ivory tailplane',[(-1.99,-.93,.94),(-1.48,-.76,.94),(-1.28,0,.94),(-1.48,.76,.94),(-1.99,.93,.94)],[(0,1,2,3,4)],ivory,.028)
mesh('coral vertical tail',[(-2.0,0,.87),(-1.98,0,1.73),(-1.76,0,1.75),(-1.32,0,.95)],[(0,1,2,3)],coral,.04)
beam('tail fin ivory slash',(-1.93,-.026,1.2),(-1.70,-.026,1.41),.034,ivory)
beam('tail wheel spring',(-1.66,0,.77),(-1.79,0,.15),.024,steel);sphere('tailwheel',(-1.80,0,.13),(.13,.075,.13),rubber)
# Static prop hub; the blades are separate runtime articulation anchored in metadata.
beam('propeller shaft',(1.51,0,.99),(1.78,0,.99),.066,steel);sphere('yellow spinner',(1.75,0,.99),(.15,.115,.115),gold)
beam('cabin aerial',(-.50,0,1.53),(-.58,0,1.81),.012,steel)
scene=bpy.context.scene;target=Vector((0,0,.87));cv=Vector((11,-20,17.5))
bpy.ops.object.camera_add(location=target+cv);cam=bpy.context.object;cam.rotation_euler=(-cv).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.0;scene.camera=cam
world=bpy.data.worlds.new('warm highland sky');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('warm key',(-4,-6,9),850,5,(1,.85,.64)),('sky fill',(5,2,7),520,5,(.66,.82,1)),('rim',(-4,6,8),620,4,(1,.94,.77))]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=False
W=384;H=320;scene.render.resolution_x=W;scene.render.resolution_y=H;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
orig={o.name:o.matrix_world.copy() for o in objects}
def project(v):
    q=world_to_camera_view(scene,cam,v);return {'x':round(q.x*W,5),'y':round((1-q.y)*H,5)}
frames=[]
for i in range(a.headings):
    angle=i*math.tau/a.headings;rot=Matrix.Rotation(angle,4,'Z')
    for o in objects:o.matrix_world=rot@orig[o.name]
    bpy.context.view_layer.update();origin=project(Vector((0,0,0)));nose=project(rot@Vector((1,0,0)))
    frames.append({'index':i,'screenHeading':math.atan2(nose['y']-origin['y'],nose['x']-origin['x']),'groundAnchor':origin,'passengerAnchor':project(rot@Vector((-.2,0,1.10))),'propeller':project(rot@Vector((1.8,0,.99))),'propellerUp':project(rot@Vector((1.8,0,1.59))),'propellerSide':project(rot@Vector((1.8,.60,.99))),'wingTips':[project(rot@Vector((0,-2.4,1.50))),project(rot@Vector((0,2.4,1.50)))],'flaps':[[project(rot@Vector((x,sign*y,z))) for x,y,z in [(-.44,.72,1.531),(-.38,1.92,1.54),(-.51,1.92,1.523),(-.64,.72,1.505)]] for sign in [-1,1]]})
    scene.render.filepath=f'{a.output_dir}/heading-{i:02d}.png'
    if not a.metadata_only:bpy.ops.render.render(write_still=True)
meta={'version':1,'kind':'stol-courier','frame':{'width':W,'height':H,'widthInMap':6/20.6},'headingCount':a.headings,'frames':frames,'dimensions':{'length':3.95,'span':4.86,'height':1.81},'source':'tools/diorama/render_journey_aircraft.py'}
open(f'{a.output_dir}/aircraft.meta.json','w').write(json.dumps(meta,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=f'{a.output_dir}/journey-aircraft.blend')
