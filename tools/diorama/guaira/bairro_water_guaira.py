"""Small dry public standpipe and receiving trough, beside the existing repair bay.

Executed after craft_guaira.py by build_guaira.py; also usable on the matching
saved third-pass scene. Adds only its prefixed collection. Static art is dry.
The hidden source meshes provide exact geometry for the chapter-only water clip.
No existing mesh, material, camera, light or navigation metadata is modified.
"""
import bpy, math
from mathutils import Vector
PREFIX='Bairro public water '
if bpy.data.collections.get(PREFIX.strip()):
    raise RuntimeError('The Bairro public water source pass was already applied')
collection=bpy.data.collections.new(PREFIX.strip());bpy.context.scene.collection.children.link(collection)
def material(label,color,rough=.75,metal=0):
    m=bpy.data.materials.new(PREFIX+label);m.use_nodes=True
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m.diffuse_color=(*linear,1);p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*linear,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
stone=material('carved sandstone','ACA184');bed=material('dry sheltered basin','8A7B62')
bronze=material('weathered bronze','A57C3E',.46,.38);patina=material('joint patina','667364',.57,.30)
dark=material('spout interior','413D32');water=material('water source reference','4EAAB2',.38)
nt=stone.node_tree;no=nt.nodes.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=31
b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.13;b.inputs['Distance'].default_value=.008
nt.links.new(no.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
def mesh(label,vs,fs,mat):
    me=bpy.data.meshes.new(PREFIX+label);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new(PREFIX+label,me);collection.objects.link(o);me.materials.append(mat);return o
def bevel(o,r,segments=2):
    mod=o.modifiers.new('Small worn stone arris','BEVEL');mod.width=r;mod.segments=segments
    o.modifiers.new('Weighted crafted normals','WEIGHTED_NORMAL');return o
# Eight-sided clipped corners make a solid carved vessel, not four floating bars.
cx,cy=-1.00,1.34
outer=[(-.25,-.155),(-.23,-.175),(.23,-.175),(.25,-.155),(.25,.155),(.23,.175),(-.23,.175),(-.25,.155)]
inner=[(-.194,-.101),(-.176,-.119),(.176,-.119),(.194,-.101),(.194,.101),(.176,.119),(-.176,.119),(-.194,.101)]
rings=[]
for outline,z,scale in [(outer,1.750,.95),(outer,1.965,1),(inner,1.965,1),(inner,1.802,.95)]:
    rings.extend([(cx+x*scale,cy+y*scale,z) for x,y in outline])
faces=[]
for k in range(8):
    j=(k+1)%8;faces.extend([(k,j,8+j,8+k),(8+k,8+j,16+j,16+k),(16+k,16+j,24+j,24+k)])
faces.extend([tuple(range(24,32)),tuple(range(7,-1,-1))])
vessel=mesh('carved trough',rings,faces,stone);vessel.data.materials.append(bed)
for i,p in enumerate(vessel.data.polygons):
    if i%3==2 or i==24:p.material_index=1
bevel(vessel,.006,2)
# The actual supply riser enters the terrain behind the basin. Its buried lower
# segment deliberately conveys a local buried supply without a speculative run.
def tube(label,ps,r,mat):
    c=bpy.data.curves.new(PREFIX+label,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=2;c.resolution_u=12
    s=c.splines.new('POLY');s.points.add(len(ps)-1)
    for p,co in zip(s.points,ps):p.co=(*co,1)
    o=bpy.data.objects.new(PREFIX+label,c);collection.objects.link(o);c.materials.append(mat);return o
def cylinder(label,p,r,d,mat,axis=(0,0,1),sides=12):
    vs=[(r*math.cos(k*math.tau/sides),r*math.sin(k*math.tau/sides),z) for z in [-d/2,d/2] for k in range(sides)]
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(k,(k+1)%sides,(k+1)%sides+sides,k+sides) for k in range(sides)]
    o=mesh(label,vs,fs,mat);o.location=p;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();return o
# Rounded elbows keep the short bronze outlet modest at native map scale.
ps=[(-1,1.56,1.715),(-1,1.56,2.08)]
for k in range(1,7):
    a=k*math.pi/12;ps.append((-1,1.51+.05*math.cos(a),2.08+.05*math.sin(a)))
ps.append((-1,1.365,2.13))
for k in range(1,7):
    a=k*math.pi/12;ps.append((-1,1.365-.035*math.sin(a),2.095+.035*math.cos(a)))
ps.append((-1,1.33,2.052));tube('buried riser and spout',ps,.017,bronze)
cylinder('buried riser socket',(-1,1.56,1.78),.034,.07,patina)
cylinder('riser union collar',(-1,1.56,1.975),.024,.037,bronze)
cylinder('outlet lip',(-1,1.33,2.055),.023,.018,bronze)
cylinder('open outlet throat',(-1,1.33,2.045),.013,.002,dark)
# These reference meshes are part of the portable source only. They are excluded
# from dry renders and serve the exporter/visibility audit, never a runtime PNG.
waterZ=1.905
# Linear cross-section of the tapered hollow at water height.
scale=.95+.05*(waterZ-1.802)/(1.965-1.802)
vs=[(cx+x*scale,cy+y*scale,waterZ) for x,y in inner]
surface=mesh('SOURCE bowl water',vs,[tuple(range(8))],water);surface.hide_render=True;surface.hide_viewport=True
# Small camera-facing ribbon for the actual vertical fall within the receiving bowl.
# World X is sufficiently lateral to show a narrow ~2-source-pixel fall.
fall=mesh('SOURCE contained fall',[(-1.010,1.33,2.043),(-.990,1.33,2.043),(-.990,1.33,1.905),(-1.010,1.33,1.905)],[(0,1,2,3)],water);fall.hide_render=True;fall.hide_viewport=True
print('GUAIRA_BAIRRO_WATER: dry carved stone receiver + buried bronze standpipe; scene/layout unchanged')
