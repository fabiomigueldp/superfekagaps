"""Second production pass over the preserved island source; run in background Blender.
blender -b --python tools/delicia/enrich_island.py
Produces independent v2 BLEND/GLB/render and camera-projected runtime map metadata.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'docs/world/delicia'
OUT=ROOT/'public/assets/delicia'
bpy.ops.wm.open_mainfile(filepath=str(SRC/'imperio-delicia.blend'))
scene=bpy.context.scene
rng=random.Random(5102026)
M={m.name:m for m in bpy.data.materials}
collection=bpy.data.collections.new('Second harvest • handcrafted landmarks');scene.collection.children.link(collection)

def finish(o,name,mat):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o);o.data.materials.clear();o.data.materials.append(M[mat]);return o
def cube(name,p,scale,mat,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=finish(bpy.context.object,name,mat);o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Crafted arris','BEVEL');b.width=bevel;b.segments=2
    return o
def cyl(name,p,r,h,mat,r2=None,n=20):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=h,location=p)
    return finish(bpy.context.object,name,mat)
def sphere(name,p,scale,mat,sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p);o=finish(bpy.context.object,name,mat);o.scale=scale
    for face in o.data.polygons:face.use_smooth=True
    return o
def pipe(name,points,r,mat):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2
    s=d.splines.new('POLY');s.points.add(len(points)-1)
    for a,b in zip(s.points,points):a.co=(*b,1)
    o=bpy.data.objects.new(name,d);collection.objects.link(o);d.materials.append(M[mat]);return o
def beam(name,a,b,r,mat):
    a,b=Vector(a),Vector(b);o=cyl(name,(a+b)*.5,r,(b-a).length,mat,n=10);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def ring(name,p,r,t,mat,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=40,minor_segments=8,location=p,rotation=rot);return finish(bpy.context.object,name,mat)
def mesh(name,verts,faces,mat):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);collection.objects.link(o);d.materials.append(M[mat]);return o

# The shoreline has real buttresses, erosion strata and small offshore discoveries.
for i in range(64):
    a=i*math.tau/64;r=1+.02*math.sin(i*4.3);x=20*math.cos(a)*r;y=14*math.sin(a)*r
    sphere('Eroded sandstone pillar',(x,y,-.05),(.5+rng.random()*.6,.45+rng.random()*.65,1.5+rng.random()*.5),'stone',1)
    if i%3==0:
        sphere('Foam at rocky shoreline',(x*1.035,y*1.045,-1.25),(.8,.52,.12),'foam')
        sphere('Citrus coastal shrub',(x*.94,y*.94,1.95),(.45,.4,.35),'leaf')
for i in range(11):
    x=-22.3-i*.24;y=-6+i*1.15
    sphere('Outer reef discovery',(x,y,-.8),(.7,.9,.85+rng.random()),'strata',1)

# Build a western windmill peninsula, physically extending the island.
for i in range(3):
    cyl('Windmill peninsula layer',(-20,2,1+i*.45),3.7-i*.14,.6,'strata' if i==0 else 'sand',n=32)
cyl('Windmill peninsula lawn',(-20,2,2.25),3.35,.15,'grass',n=32)
cyl('Windmill taper',(-20,2,4),.9,3.5,'cream',r2=.65,n=32)
cyl('Windmill tile roof',(-20,2,6),1.1,1.3,'roof',r2=0,n=32)
hub=(-20,.96,5.05)
for i in range(4):
    a=i*math.pi/2+.35
    end=(hub[0]+math.cos(a)*2.25,hub[1],hub[2]+math.sin(a)*2.25)
    beam('Windmill sail spar',hub,end,.065,'wood')
    for j in range(6):
        d=.8+j*.26;p=(hub[0]+math.cos(a)*d,hub[1],hub[2]+math.sin(a)*d)
        v=Vector((math.sin(a)*.43,0,-math.cos(a)*.43));beam('Windmill linen battens',Vector(p)-v,Vector(p)+v,.08,'cream')
sphere('Mill axle cap',hub,(.2,.16,.2),'brass')
pipe('Mill approach trail',[(-16,0,2.4),(-17,1,2.42),(-18,2,2.43),(-20,1,2.43)],.3,'cream')

# A luminous, multi-tiered chalice at the heart of Jajá's amphitheatre.
cyl('Nascente chalice stem',(0,0,6.1),.32,1.4,'brass')
cyl('Nascente chalice bowl',(0,0,7.1),.48,1.1,'gold',r2=1.35,n=48)
cyl('Nascente first shared cup',(0,0,7.68),1.29,.1,'juice',n=48)
ring('Chalice engraved lip',(0,0,7.7),1.34,.085,'cream')
for i in range(12):
    a=i*math.tau/12
    pipe('Cup fountain arc',[(math.cos(a)*1.25,math.sin(a)*1.25,7.72),(math.cos(a)*1.65,math.sin(a)*1.65,7.45),(math.cos(a)*1.8,math.sin(a)*1.8,5.85)],.04,'juice')
for r,z in [(3.65,5.22),(4.0,5.03),(4.35,4.85)]:
    for i in range(23):
        a=(i/23)*math.pi*1.5-.1
        o=cube('Amphitheatre sandstone seat',(math.cos(a)*r,math.sin(a)*r,z),(.45,.35,.22),'cream');o.rotation_euler.z=a
for i in range(9):
    a=math.pi*.08+i*math.pi/11
    x=math.cos(a)*4.25;y=math.sin(a)*4.25
    cyl('Amphitheatre column',(x,y,6.15),.15,2,'cream',n=16)
    cyl('Amphitheatre gilded capital',(x,y,7.2),.23,.15,'gold')

# Five wide waterfalls have layered ribbons, foam, basin stones and a service bridge.
for i in range(5):
    x=-1.5+i*.62
    pipe('Five falls broad ribbons',[(x,-2.9,5.84),(x,-3.35,5.7),(x,-3.7,4.1),(x,-4.1,2.4),(x,-5.45,.5)],.22,'juice')
    pipe('Waterfall sunlit seam',[(x-.06,-3.06,5.85),(x-.06,-3.46,5.68),(x-.06,-3.82,4.1),(x-.06,-4.2,2.4)],.035,'foam')
    for j in range(5):sphere('Juice foam droplets',(x+rng.uniform(-.3,.3),-5.5+rng.uniform(-.3,.3),.5+rng.random()*.35),(.13,.15,.09),'foam')
for j in range(26):
    x=-4+j*.31;cube('Canyon crossing deck',(x,-5.55,2.95),(.28,1.1,.13),'wood')
for y in (-6.1,-5):
    pipe('Canyon rope balustrade',[(x,y,3.7-.2*math.sin((x+4)*math.pi/8)) for x in [-4+j*.4 for j in range(21)]],.035,'wood')
    for j in range(9):cyl('Canyon rope stanchion',(-4+j,y,3.33),.035,.76,'wood',n=8)

# The Archive: two-storey vaulted portico and bottles of preserved memory.
cube('Archive lower hall',(4,-1,5.9),(3.4,2.8,1.5),'teal',.08)
cube('Archive cornice',(4,-1,6.74),(3.65,3,.2),'cream')
cyl('Archive observatory',(4,-1,7.35),1.25,1.1,'cream',n=32)
cyl('Archive tiled lantern roof',(4,-1,8.25),1.4,.8,'roof',r2=.2,n=32)
for x in (2.6,3.3,4,4.7,5.4):
    cyl('Archive column',(x,-2.5,6),.08,1.3,'cream',n=12)
    cube('Memory glass window',(x,-2.45,6.05),(.4,.06,.8),'glass')
    for j in range(3):sphere('Bottled amber memory',(x+(j-1)*.12,-2.5,5.92),(.055,.055,.17),'juice')

# Village life: striped stalls, individual roof tiles, laundry, benches, crates.
for x,y in [(-14,-6),(-9,-7.3),(-6,-7.7),(-12,-10)]:
    z=2.3
    for dx in (-.8,.8):
        for dy in (-.45,.45):cyl('Market stall post',(x+dx,y+dy,z+.7),.045,1.4,'wood',n=8)
    for i in range(8):cube('Striped citrus market canopy',(x-.8+i*.22,y,z+1.5),(.23,1.3,.13),'cream' if i%2 else 'orange')
    cube('Market counter',(x,y,z+.45),(1.7,.9,.18),'wood')
    for i in range(12):sphere('Fruit at the market',(x-.65+(i%6)*.23,y-.18+(i//6)*.3,z+.59),(.1,.1,.1),'orange')
for base in [o for o in list(scene.objects) if o.name.startswith('Island village plaster')]:
    x,y,z=base.location;s=base.dimensions.x/1.6
    for side in (-1,1):
        for row in range(5):
            for col in range(6):
                xx=x+side*(.12+row*.16)*s;yy=y+(-.72+col*.28)*s;zz=z+(.8+.64-row*.13)*s
                o=cube('Individual terracotta roof tile',(xx,yy,zz),(.23*s,.3*s,.045),'roof',.012);o.rotation_euler.y=side*.65
    cube('Village flowerbox',(x+.5*s,y-.85*s,z+.17*s),(.42*s,.18,.16),'wood')
    for j in range(3):sphere('Window citrus blossom',(x+(.36+j*.13)*s,y-.9*s,z+.33*s),(.07,.08,.08),'foam')
for x,y in [(-12,-5.5),(-8,-8),(-6,-6)]:
    cube('Table of the shared cup',(x,y,2.9),(1.1,.75,.12),'wood')
    for dx in (-.42,.42):cube('Table leg',(x+dx,y,2.6),(.08,.6,.55),'wood')
    for dx in (-.3,0,.3):cyl('Empty cup waiting for somebody',(x+dx,y,3.04),.055,.16,'cream',n=12)

# Readable orchard alleys, ladders, fruit outside the foliage and a root sanctuary.
for row in range(5):
    for col in range(7):
        x=-14.8+col*1.6;y=.1+row*1.7
        for j in range(5):
            a=j*2.399;sphere('Visible ripe fruit',(x+math.cos(a)*.64,y-.55+math.sin(a)*.21,5.35+(j%2)*.28),(.11,)*3,'orange')
for y in (1,4.4,7.6):pipe('Orchard walking alley',[(-16,y,4.05),(-12,y,4.05),(-8,y,4.05),(-4.4,y,4.05)],.13,'sand')
cyl('Root sanctuary steps',(-17,6,3.9),1.8,.3,'cream',n=32)
for i in range(8):
    a=i*math.tau/8;x=-17+math.cos(a)*1.5;y=6+math.sin(a)*1.5
    cyl('Root sanctuary column',(x,y,4.95),.14,1.8,'cream')
ring('Root sanctuary entablature',(-17,6,5.9),1.5,.19,'cream')
sphere('Root sanctuary orange seed',(-17,6,4.6),(.35,.35,.6),'juice')

# Refinery machinery: external pistons, huge cog, gauges, inspection walkways.
for i in range(3):
    x=7.2+i*1.9
    cyl('Press vertical piston',(x,.2,6.8),.15,2.5,'brass')
    cube('Press crosshead',(x,.2,5.85),(1.3,.65,.28),'gold')
    cube('Press bolted base',(x,.2,4.85),(1.4,.9,.23),'dark')
    ring('Inspection pressure gauge',(x,-.5,7.5),.28,.05,'brass',(math.pi/2,0,0))
    sphere('Pressure gauge face',(x,-.49,7.5),(.23,.04,.23),'cream')
    beam('Gauge needle',(x,-.55,7.5),(x+.12,-.55,7.65),.017,'dark')
ring('Refinery great gear',(13,.55,8.35),1.35,.16,'brass',(math.pi/2,0,0))
for i in range(20):
    a=i*math.tau/20
    o=cube('Great gear machined tooth',(13+math.cos(a)*1.42,.55,8.35+math.sin(a)*1.42),(.28,.25,.28),'gold');o.rotation_euler.y=-a
    if i%4==0:beam('Great gear spokes',(13,.55,8.35),(13+math.cos(a)*1.3,.55,8.35+math.sin(a)*1.3),.07,'teal')
for z in (6.1,7.4):
    cube('Refinery inspection balcony',(10,.2,z),(7.2,.6,.12),'brass')
    for x in [6.5+i*.45 for i in range(17)]:cyl('Inspection balcony railing',(x,-.1,z+.35),.023,.7,'gold',n=8)
    beam('Balcony handrail',(6.4,-.1,z+.7),(13.6,-.1,z+.7),.04,'gold')

# Guina's architecture finally looks inhabited and overbearing.
for x in (8.2,9.1,10.9,11.8):
    cube('Citadel luminous tall window',(x,5.67,9.1),(.48,.09,1.5),'glass',.12)
    cube('Citadel window lintel',(x,5.62,9.95),(.67,.16,.15),'gold')
for x in (7.6,12.4):
    beam('Banner mast',(x,5.35,8.2),(x,5.35,11.15),.04,'brass')
    mesh('Guina purple hanging banner',[(x-.35,5.32,11),(x+.35,5.32,11),(x+.35,5.32,9.4),(x,5.32,9.12),(x-.35,5.32,9.4)],[(0,1,2,3,4)],'purple')
    sphere('Banner citrus seal',(x,5.26,10.4),(.18,.04,.22),'gold')
for i in range(12):
    a=i*math.tau/12
    cyl('Citadel dome balustrade',(10+math.cos(a)*2.8,8+math.sin(a)*2.5,10.6),.065,.8,'cream',n=12)

# A secret bell tower and geometric hedge maze beyond the factory.
x,y,z=15,-5,1.9
cube('Forbidden garden terrace',(x,y,z),(4.4,4.4,.25),'cream')
for dx in (-1.7,-.5,.6,1.7):
    for yy in (-1.7,1.6):cube('Clipped citrus hedge',(x+dx,y+yy,z+.35),(.8,.3,.6),'leaf',.13)
for dx,dy in [(-1.8,0),(1.8,0),(-.5,-.2),(.8,.6)]:cube('Garden maze hedge',(x+dx,y+dy,z+.35),(.3,2.6,.6),'leaf',.13)
cyl('Garden fountain',(x,y,z+.18),.65,.4,'cream');cyl('Garden juice',(x,y,z+.4),.52,.04,'juice')
cube('Hidden bell tower',(18,-4,3.7),(1.15,1.15,3.5),'cream')
for dx in (-.46,.46):cyl('Bell arcade column',(18+dx,-4.45,5.6),.075,.9,'cream')
cyl('Bronze bell',(18,-4.3,5.6),.32,.48,'brass',r2=.12)
cyl('Bell tower roof',(18,-4,6.35),.85,.7,'teal',r2=0,n=4)

# Tiny sailing boats make the landmass scale readable.
for x,y in [(-15,-16.7),(-9,-16.1),(-20,-11)]:
    sphere('Wooden citrus boat hull',(x,y,-.2),(1.25,.47,.37),'wood')
    cube('Boat decking',(x,y,.05),(1.75,.66,.08),'cream')
    beam('Sailboat mast',(x,y,.06),(x,y,2.1),.035,'wood')
    mesh('Linen triangular sail',[(x,y,2.05),(x,y,.4),(x+1.0,y,.4)],[(0,1,2)],'cream')
    pipe('Boat wake',[(x-1.4,y-.55,-.5),(x-2,y-.9,-.5),(x-2.8,y-1.0,-.5)],.035,'foam')

# Carve a real open canyon, including the turf caps, to expose the five falls.
# Rounded walls and a deep basin give the aqueduct structural height.
cutter=cube('Canyon cutter',(0,-9.1,.5),(4.2,11.8,13),'stone',.6)
bpy.context.view_layer.objects.active=cutter
bpy.ops.object.modifier_apply(modifier=cutter.modifiers[0].name)
for o in list(scene.objects):
    if o.type!='MESH' or not any(o.name.startswith(n) for n in ['Great citrus island foundation','Aqueduct heart','Orange delta']):continue
    bpy.context.view_layer.objects.active=o
    if 'turf' in o.name:
        solid=o.modifiers.new('Ground cap thickness','SOLIDIFY');solid.thickness=.13;bpy.ops.object.modifier_apply(modifier=solid.name)
    cut=o.modifiers.new('Open waterfall canyon','BOOLEAN');cut.operation='DIFFERENCE';cut.object=cutter;cut.solver='EXACT';bpy.ops.object.modifier_apply(modifier=cut.name)
bpy.data.objects.remove(cutter,do_unlink=True)
for o in list(scene.objects):
    if (o.name.startswith('Eroded sandstone pillar') or o.name.startswith('Foam at rocky shoreline')) and abs(o.location.x)<2.4 and o.location.y<-10:bpy.data.objects.remove(o,do_unlink=True)
stream=[(0,-5,.2),(.4,-7,-.25),(-.35,-9,-.6),(.3,-11,-1.1),(0,-14,-1.25)]
mesh('Canyon juice surface',[(x+side*.8,y,z) for x,y,z in stream for side in (-1,1)],[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(stream)-1)],'juice')
for o in list(scene.objects):
    if any(o.name.startswith(prefix) for prefix in ['Orchard trunk','Layered citrus foliage','Fruit on branches','River maintenance steps']) and abs(o.location.x)<3.1 and o.location.y<-3:
        bpy.data.objects.remove(o,do_unlink=True)
    elif o.type=='CURVE' and 'mineral seam' in o.name and any(o.name.startswith(n) for n in ['Great citrus island foundation','Aqueduct heart','Orange delta']):
        runs=[];run=[];radius=o.data.bevel_depth
        for point in o.data.splines[0].points:
            x,y,z=point.co[:3]
            if abs(x)<2.5 and y<-3.1:
                if len(run)>1:runs.append(run)
                run=[]
            else:run.append((x,y,z))
        if len(run)>1:runs.append(run)
        for points in runs:pipe('Canyon rim mineral layer',points,radius,'strata')
        bpy.data.objects.remove(o,do_unlink=True)
for i in range(24):
    a=i*math.tau/24;sphere('Canyon pool foam',(math.cos(a)*1.6,-6+math.sin(a)*1.2,.05),(.16,.17,.08),'foam')

# Camera changes and pin projection are one operation, never hand-positioned UI.
camera=scene.camera;camera.location=(40,-60,52);camera.rotation_euler=(Vector((-1,0,3.7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=54
scene.render.resolution_x=2400;scene.render.resolution_y=1500;scene.cycles.samples=40
scene.render.film_transparent=True;scene.render.filepath=str(SRC/'island-render-v2.png')
scene['production_pass']='Second harvest';scene['physical_width_m']=48.4
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
bpy.context.view_layer.update()
nodes={}
for i in range(12):
    o=next(o for o in scene.objects if o.name=='Stage '+str(i+1)+' landing')
    q=world_to_camera_view(scene,camera,o.location+Vector((0,0,.2)));nodes['delicia-'+str(i+1)]={'x':round(q.x,6),'y':round(1-q.y,6)}
metadata={'title':'Império da Delícia','revision':2,'physicalWidthMeters':48.4,'image':{'width':2400,'height':1500},'nodes':nodes,'routes':[[nodes['delicia-'+str(i+1)],nodes['delicia-'+str(i+2)]] for i in range(11)],'objects':len(scene.objects),'materials':len(bpy.data.materials),'seed':5102026}
(OUT/'island-map.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'imperio-delicia-v2.blend'))
bpy.ops.render.render(write_still=True)
bpy.ops.export_scene.gltf(filepath=str(SRC/'imperio-delicia-v2.glb'),export_format='GLB',export_cameras=True,export_lights=True)
print(json.dumps(metadata),flush=True)
