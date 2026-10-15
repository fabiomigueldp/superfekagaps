"""Guaíra revision 4: authored, geographically coherent phase entrances.

Open revision 3 guaira-landscape.blend. Export inputs, run layout_landmarks.py,
then reopen that same source to author --draft or final paired beauty/depth.
Every entrance has its own collection, metadata and measured arrival marker.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector
from array import array
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'output/guaira/phase-landmarks-2026-10-15'
DOC=ROOT/'docs/world/guaira/phase-landmarks-2026-10-15'
WORK.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;bpy.context.view_layer.update()
nav=json.loads(scene['native_navigation'])
if '--export-inputs' in sys.argv:
    terrain=bpy.data.objects['Continuous clay island']
    indices=sorted({i for p in terrain.data.polygons if len(p.vertices)==3 for i in p.vertices})
    paving=[];objects=[]
    for ob in scene.objects:
        if ob.hide_render or ob.type not in ('MESH','CURVE'):continue
        bb=[ob.matrix_world@Vector(p) for p in ob.bound_box]
        objects.append({'name':ob.name,'min':[min(p[i] for p in bb) for i in range(3)],
                        'max':[max(p[i] for p in bb) for i in range(3)]})
        if ob.name.startswith('Native joined ground paving'):
            ob.data.calc_loop_triangles()
            paving.append({'name':ob.name,'triangles':[[list((ob.matrix_world@ob.data.vertices[i].co)[:2]) for i in t.vertices]
                for t in ob.data.loop_triangles if all(abs((ob.matrix_world@ob.data.vertices[i].co).z-1.835)<1e-5 for i in t.vertices)]})
    water={o.name:[list(o.matrix_world@v.co) for v in o.data.vertices]
        for o in scene.objects if not o.hide_render and o.type=='MESH' and any(m and m.name=='Clean turquoise water' for m in o.data.materials)}
    data={'navigation':nav,'paving':paving,'objects':objects,
          'terrainTop':[[i,list(terrain.data.vertices[i].co)] for i in indices],
          'waterMeshes':water,'materials':[m.name for m in bpy.data.materials],
          'cameraMatrix':[list(row) for row in scene.camera.matrix_world]}
    (WORK/'landmark-input.json').write_text(json.dumps(data)+'\n')
    print('LANDMARK_INPUT_EXPORTED',len(paving),flush=True);sys.exit(0)

draft='--draft' in sys.argv
layout=json.loads((WORK/'landmark-layout.json').read_text())
root=bpy.data.collections.new('Guaíra v4 — lugares das fases');scene.collection.children.link(root)
archive=bpy.data.collections.new('Landmarks v3 — preserved source');scene.collection.children.link(archive)
new=[];archived=[];phase='paths';collections={}
def collection(id):
    if id not in collections:
        collections[id]=bpy.data.collections.new('Guaíra v4 | '+id);root.children.link(collections[id])
    return collections[id]
def preserve(ob):
    if ob.hide_render:return
    archived.append(ob.name);ob.hide_render=True;ob.hide_viewport=True
    for c in list(ob.users_collection):c.objects.unlink(ob)
    archive.objects.link(ob);ob.name='Archived v3 - '+ob.name
def mesh(name,vs,fs,mat,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me)
    assert all(e.is_manifold for e in bm.edges),name+': open edge'
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True)
    assert volume>1e-10 and all(f.calc_area()>1e-12 for f in bm.faces),name+': invalid solid'
    bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new('Landmark v4 '+name,me);collection(phase).objects.link(ob)
    me.materials.append(mat);ob['stage_id']=phase
    if bevel:
        mod=ob.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=2
        ob.modifiers.new('Area weighted normals','WEIGHTED_NORMAL')
    new.append({'name':ob.name,'phase':phase,'volume':volume});return ob
def linear(color):
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in [int(color[i:i+2],16)/255 for i in (0,2,4)])
def material(name,color,roughness=.8,metallic=0):
    m=bpy.data.materials.new('Landmark v4 '+name);m.use_nodes=True;rgb=(*linear(color),1);m.diffuse_color=rgb
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=rgb;p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metallic;p.inputs['Specular IOR Level'].default_value=.23;return m
stone=bpy.data.materials['Guaira native honed limestone tread']
wood=material('weathered corral timber','99703E');woodlight=material('worn timber edges','B18B56')
wooddark=material('timber end grain','755235');earth=material('compacted dry corral','CA9363')
ochre=material('sluice sandstone','C9AE82');dark=material('recessed shadow','39423B')
metal=material('aged teal machinery','417F7C',.58,.15);bronze=material('brass valve hardware','BC944F',.48,.25)
ivory=material('bone and gauge face','E7D7AE');rust=material('repair clay','B9714E')
paving=bpy.data.materials['Guaira native warm paving'] if 'Guaira native warm paving' in bpy.data.materials else bpy.data.objects['Native joined ground paving 0'].data.materials[0]
edging=bpy.data.objects[next(o.name for o in scene.objects if o.name.startswith('Native paving edge 0-'))].data.materials[0]
def box(name,p,d,mat,bevel=.008):
    x,y,z=p;a,b,c=[v/2 for v in d]
    vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat,bevel)
def beam(name,a,b,width,mat,thickness=None):
    a,b=Vector(a),Vector(b);delta=b-a
    ob=box(name,(0,0,0),(width,thickness or width,delta.length),mat,min(.007,width*.16))
    ob.location=(a+b)/2;ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return ob
def pipe(name,points,radius,mat,sides=10):
    points=[Vector(p) for p in points];vs=[];previous=None
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
        u=(previous-tangent*previous.dot(tangent)).normalized() if previous is not None else tangent.cross(ref).normalized()
        v=tangent.cross(u).normalized();previous=u
        vs.extend(tuple(p+radius*(math.cos(k*2*math.pi/sides)*u+math.sin(k*2*math.pi/sides)*v)) for k in range(sides))
    fs=[tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
    for j in range(len(points)-1):
        fs.extend((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k) for k in range(sides))
    return mesh(name,vs,fs,mat)
def ring(name,center,radius,tube,mat,normal=(0,-1,0)):
    n=Vector(normal).normalized();u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized();v=n.cross(u)
    vs=[];N=20;M=8;c=Vector(center)
    for i in range(N):
        axis=math.cos(i*2*math.pi/N)*u+math.sin(i*2*math.pi/N)*v
        for j in range(M):vs.append(tuple(c+(radius+tube*math.cos(j*2*math.pi/M))*axis+tube*math.sin(j*2*math.pi/M)*n))
    return mesh(name,vs,[(i*M+j,i*M+(j+1)%M,((i+1)%N)*M+(j+1)%M,((i+1)%N)*M+j) for i in range(N) for j in range(M)],mat)
def valve(name,x,y,z,r=.12):
    ring(name+' wheel',(x,y,z),r,.018,bronze)
    pipe(name+' spindle',[(x,y-.02,z),(x,y+.12,z)],.024,bronze)
    for angle in (0,math.pi/2):
        pipe(name+' spoke',[(x-r*.88*math.cos(angle),y,z-r*.88*math.sin(angle)),(x+r*.88*math.cos(angle),y,z+r*.88*math.sin(angle))],.012,bronze,8)
def gauge(name,x,y,z,r=.12):
    pipe(name+' case',[(x,y+.04,z),(x,y,z)],r,bronze,16)
    pipe(name+' dial',[(x,y-.002,z),(x,y-.011,z)],r*.80,ivory,16)
    beam(name+' needle',(x,y-.018,z),(x+r*.38,y-.018,z+r*.48),.014,dark)
def solid(name,shape,low,high,mat,bevel=0):
    vs=[];ids={};fs=[]
    def vertex(x,y,z):
        key=(round(x,6),round(y,6),z)
        if key not in ids:ids[key]=len(vs);vs.append(key)
        return ids[key]
    for tri in shape['triangles']:
        fs.append(tuple(vertex(x,y,high) for x,y in tri));fs.append(tuple(vertex(x,y,low) for x,y in reversed(tri)))
    for outline in [shape['ring'],*shape['holes']]:
        for a,b in zip(outline,outline[1:]+outline[:1]):fs.append((vertex(*a,low),vertex(*b,low),vertex(*b,high),vertex(*a,high)))
    return mesh(name,vs,fs,mat,bevel)

# One continuous paving solid at each side of the bridge, including the new
# short branch. No floating layer, curb through a doorway or route over props.
for ob in list(scene.objects):
    if ob.name.startswith(('Native joined ground paving','Native paving edge 0-','Native paving edge 1-','Corral post','Corral open fence')) or ob.name in layout['archive']:preserve(ob)
terrain=bpy.data.objects['Continuous clay island']
for index,z in layout['grade']:terrain.data.vertices[index].co.z=z
terrain.data.update();terrain['terrain_revision']=4
for i,s in enumerate(layout['surfaces']):
    solid('joined ground paving '+str(i),s,1.69,1.835,paving,.008)
    for j,(a,b) in enumerate(zip(s['ring'],s['ring'][1:]+s['ring'][:1])):
        a,b=Vector((*a,1.817)),Vector((*b,1.817));m=(a+b)/2
        if (2.50<m.x<3.72 and -2.32<m.y<-1.18) or (1.25<m.y<2.75 and 1.15<m.x<3.50):continue
        if m.y<-2.45 and m.x<-4.45 or abs(m.x-2.02)<.01 and -.26<m.y<.56:continue
        if (b-a).length<.15:continue
        count=max(1,math.ceil((b-a).length/.64))
        for k in range(count):
            aa=a.lerp(b,k/count);bb=a.lerp(b,(k+1)/count);v=(bb-aa).normalized()*.004
            beam(f'paving edge {i}-{j}-{k}',aa+v,bb-v,.095,edging)

# The old central cactus family remains intact; moving the whole group avoids
# arms, roots or undergrowth crossing the rear corral rails.
source=json.loads((WORK/'landmark-input.json').read_text())
plants=[]
for row in source['objects']:
    if (row['name'].startswith(('Cactus','Cluster cactus','Curved cactus','Long cactus','Dry agave','Sheltered dry vegetation'))
        and row['min'][0]>-.3 and row['max'][0]<.9 and row['min'][1]>.55 and row['max'][1]<1.35):
        ob=bpy.data.objects[row['name']];ob.location.y+=.28;plants.append(ob.name)

phase='guaira-lab'
solid('compacted corral court',layout['corral'],1.685,1.79,earth,.018)
outline=layout['corral']['ring']
for j,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):
    if a[0]==2.02 and b[0]==2.02:continue # real open east gate
    a,b=Vector((*a,1.79)),Vector((*b,1.79));count=max(1,math.ceil((b-a).length/.6))
    height=.46 if (a.y+b.y)/2>0 else .30
    for k in range(count):
        p=a.lerp(b,k/count);q=a.lerp(b,(k+1)/count)
        box('corral stone post shoe',(p.x,p.y,1.795),(.15,.15,.16),ochre)
        box('corral squared post',(p.x,p.y,1.81+height/2),(.083,.083,height+.06),wood)
        for z in (1.9,1.79+height*.83):beam('corral rail',(p.x,p.y,z),(q.x,q.y,z),.066,woodlight,.045)
for y in (-.26,.56):
    box('gate founded stone shoe',(2.02,y,1.795),(.23,.20,.20),ochre)
    box('corral entrance post',(2.02,y,2.12),(.14,.14,.72),wood)
beam('corral entrance lintel',(2.02,-.35,2.50),(2.02,.65,2.50),.17,woodlight,.13)
# A carved bovine crest, part of the timber gate rather than a second boss.
box('bone crest brow',(2.112,.15,2.52),(.08,.22,.17),ivory,.025)
box('bone crest muzzle',(2.118,.15,2.423),(.073,.12,.12),ivory,.018)
for side in (-1,1):
    pipe('carved horn',[(2.105,.15+side*.08,2.56),(2.105,.15+side*.21,2.59),(2.105,.15+side*.27,2.72)],.033,ivory)
    box('crest eye',(2.157,.15+side*.061,2.528),(.012,.034,.028),wooddark,.004)
box('corral dry trough',(1.18,.63,1.875),(.59,.23,.18),ochre,.02)
box('corral empty trough recess',(1.18,.63,1.974),(.47,.13,.025),dark,.012)
beam('corral fallen repair timber',(.12,-.65,1.82),(.61,-.57,1.82),.07,wooddark)

phase='guaira-travessia'
# Gate mechanism stays inside the existing eastern pier envelope, away from
# the airport approach. Dry downstream throat belongs to Vala Seca.
box('dry sluice inspection face',(-4.35,-1.595,2.04),(.20,.065,.27),metal)
valve('Vala Seca gate',-4.35,-1.645,2.13,.11)
pipe('dry sluice stem',[(-4.35,-1.53,1.81),(-4.35,-1.53,2.09)],.035,bronze)

phase='guaira-patio-comportas'
for ob in list(scene.objects):
    if ob.name.startswith(('Native patio','Native valve spoke','Native valve upright')):preserve(ob)
box('paired controls foundation',(-3.10,-1.83,1.83),(1.17,.46,.20),ochre,.018)
box('paired controls bench',(-3.10,-1.84,2.025),(1.09,.29,.35),stone,.018)
for index,x in enumerate((-3.38,-2.82)):
    box('control '+str(index)+' enamel plate',(x,-2.00,2.08),(.40,.035,.28),metal)
    valve('control '+str(index),x,-2.048,2.09,.095)
    pipe('paired inlet '+str(index),[(x,-1.75,1.76),(x,-1.69,1.95),(x,-1.73,2.11)],.035,bronze)
    # Short engraved-style A/B brass strokes on the horizontal cap.
    strokes=[((-.055,0), (0,.10)),((0,.10),(.055,0)),((-.03,.045),(.03,.045))] if not index else [((-.04,0),(-.04,.10)),((-.04,.10),(.03,.08)),((.03,.08),(-.04,.05)),((-.04,.05),(.035,.025)),((.035,.025),(-.04,0))]
    for a,b in strokes:beam('control letter '+('B' if index else 'A'),(x+a[0],-1.88+a[1],2.208),(x+b[0],-1.88+b[1],2.208),.013,bronze)
pipe('shared paired inlet',[(-3.38,-1.70,1.84),(-2.82,-1.70,1.84)],.033,metal)

phase='guaira-respiros'
box('two vents service bank',(1.96,-3.235,1.805),(1.13,.42,.18),ochre,.018)
for index,x in enumerate((1.67,2.25)):
    box('vent '+str(index)+' raised rim',(x,-3.235,1.92),(.39,.31,.17),metal,.018)
    box('vent '+str(index)+' dark throat',(x,-3.235,2.013),(.29,.22,.025),dark,.005)
    for k in range(4):box('vent '+str(index)+' iron grille',(x-.105+.07*k,-3.235,2.036),(.023,.235,.025),bronze,.004)
    pipe('vent '+str(index)+' pressure riser',[(x,-3.35,1.79),(x,-3.35,2.15)],.025,metal)
    gauge('vent '+str(index)+' gauge',x,-3.39,2.16,.076)
pipe('respiros collector',[(1.67,-3.33,1.83),(2.25,-3.33,1.83)],.036,metal)

phase='gallery'
# The original doorway is the workshop basement. Reinforce its existing jambs
# with patched voussoirs, rather than inventing a free-standing portal.
for x in (-3.34,-2.59):
    for j in range(3):box('gallery patch jamb',(x,.635,1.87+j*.18),(.15,.22,.16),stone if j%2 else ochre,.012)
beam('gallery repaired lintel',(-3.42,.80,2.56),(-2.51,.80,2.56),.16,stone,.15)
box('gallery clay patch',(-3.30,.512,2.055),(.19,.025,.15),rust)
box('gallery wall lamp bracket',(-2.57,.48,2.48),(.065,.12,.08),bronze)
box('gallery inspection lamp',(-2.57,.40,2.40),(.10,.09,.14),metal,.012)
box('gallery lamp lens',(-2.57,.349,2.40),(.06,.012,.085),ivory,.004)

phase='relief'
gauge('relief pressure meter',-1.48,.57,2.36,.145)
pipe('relief meter stem',[(-1.48,.65,2.18),(-1.48,.65,2.35)],.035,bronze)
pipe('relief return elbow',[(-1.08,.82,1.78),(-1.08,.82,2.08),(-1.16,.73,2.14),(-1.29,.73,2.14)],.055,metal)
ring('relief pipe flange',(-1.08,.82,1.85),.084,.022,bronze,(0,0,1))
box('relief hatch handle',(-1.48,.545,2.10),(.19,.038,.035),bronze)

phase='guaira-subida'
# Inspection hoist beside the real staircase; the public walk stays clear.
box('inspection lift footing',(3.79,1.77,1.795),(.56,.57,.21),ochre,.02)
for x in (3.57,4.01):
    box('inspection hoist shoe',(x,1.96,1.84),(.14,.17,.24),stone)
    box('inspection hoist upright',(x,1.96,2.25),(.065,.075,1.02),wood)
beam('inspection hoist header',(3.51,1.96,2.77),(4.07,1.96,2.77),.10,woodlight)
ring('inspection hoist pulley',(3.79,1.94,2.70),.07,.016,bronze)
pipe('inspection hoist cable',[(3.79,1.92,2.67),(3.79,1.92,2.01)],.008,wooddark,8)
for k in range(5):box('inspection lift deck',(3.79,1.58+k*.076,1.93),(.44,.069,.06),woodlight,.005)
valve('inspection lift winch',4.01,1.88,2.16,.09)

phase='guaira-prefeito'
box('public registration panel',(1.49,3.17,2.98),(.42,.08,.43),metal,.016)
for i in range(3):
    pipe('public registration seal '+str(i),[(1.36+i*.13,3.12,3.05),(1.36+i*.13,3.098,3.05)],.047,bronze,12)
beam('registration slider',(1.33,3.10,2.89),(1.65,3.10,2.89),.025,bronze)

# Physical and semantic map contract, all projected from this saved camera.
world={}
for r in nav['routes']:
    world[r['from']]=r['world'][0];world[r['to']]=r['world'][-1]
world['guaira-lab']=[2.44,.15,1.835];world['corral-junction']=[3.10,.15,1.835]
for r in nav['routes']:
    if r['id']=='rice-bridge':r['to']='corral-junction';r['world'][-1]=world['corral-junction']
    if r['id']=='corral-gate':r.update({'from':'corral-junction','to':'guaira-lab','world':[world['corral-junction'],world['guaira-lab']],'width':.78})
nav['routes'].append({'id':'ascent-approach','from':'corral-junction','to':'guaira-subida',
                     'world':[world['corral-junction'],world['guaira-subida']],'width':1.02,'kind':'ground'})
definitions={
 'guaira-travessia':('Estrada do Vento','Atravesse a comporta da vala seca.',[-4.35,-1.47,2.13],'required-opening'),
 'guaira-patio-comportas':('Pátio das Comportas','Dois controles A/B dividem a mesma entrada de água.',[-3.1,-1.84,2.11],'alternative-opening'),
 'guaira-respiros':('Passarela dos Arrozais','As duas grades de pressão ficam junto aos arrozais.',[1.96,-3.235,2.03],'required'),
 'guaira-lab':('Curral da Comporta','O portão com chifres abre para o curral seco.',[2.02,.15,2.50],'required'),
 'guaira-subida':('Inspeção da Casa da Vazão','Escada de serviço e pequeno elevador de inspeção.',[3.79,1.77,2.18],'required'),
 'guaira-prefeito':('Casa da Vazão','O registro público fica na casa acima da escadaria.',[1.49,3.17,3.05],'required'),
 'gallery':('Subsolo do Bairro Vala Seca','Entrada remendada sob a oficina, ao lado da lanterna.',[-2.964,.72,2.51],'optional'),
 'relief':('Coletor de Alívio','Alçapão com manômetro e tubo de retorno.',[-1.48,.65,2.36],'optional')}
bpy.context.view_layer.update();camera=scene.camera;inverse=camera.matrix_world.inverted()
project=lambda p:{'x':round(world_to_camera_view(scene,camera,Vector(p)).x,7),'y':round(1-world_to_camera_view(scene,camera,Vector(p)).y,7)}
depth=lambda p:round(-(inverse@Vector(p)).z,6)
nav['nodes']={id:project(world[id]) for id in nav['nodes']}
nav['junctions']={id:project(p) for id,p in world.items() if id not in nav['nodes']}
nav['nodeDepths']={id:depth(p) for id,p in world.items()}
nav['landmarks']={}
for id,(place,cue,anchor,kind) in definitions.items():
    col=collection(id);col.name='Guaíra v4 | '+id+' | '+place
    marker=bpy.data.objects.new('ENTRADA | '+id,None);col.objects.link(marker);marker.location=world[id]
    marker.empty_display_type='ARROWS';marker.empty_display_size=.17;marker['stage_id']=id;marker['place']=place;marker['cue']=cue
    for ob in col.objects:ob['stage_id']=id
    nav['landmarks'][id]={'place':place,'cue':cue,'kind':kind,'arrivalWorld':world[id],
        'anchorWorld':anchor,'anchor':project(anchor),'collection':col.name}
for r in nav['routes']:
    length=sum((Vector(b)-Vector(a)).length for a,b in zip(r['world'],r['world'][1:]))
    r.update(points=[project(p) for p in r['world']],depths=[depth(p) for p in r['world']],duration=round(max(.55,length/1.65),3))
nav['revision']=4;nav['source']='docs/world/guaira/phase-landmarks-2026-10-15/guaira-landmarks.blend'
w,h=(1280,800) if draft else (1920,1200);nav['depth'].update(width=w,height=h)
scene['native_map_revision']=4;scene['native_navigation']=json.dumps(nav,ensure_ascii=False)
scene['landmark_revision_notes']='Eight authored phase locations; separate corral branch; two irrigation vents; paired opening controls; underground inspection and relief; service hoist.'
scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU'
scene.cycles.samples=16 if draft else 64;scene.cycles.use_denoising=True;scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Landmarks v4 paired beauty depth','CompositorNodeTree');scene.compositing_node_group=group
group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene;out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='depth-'+('draft-' if draft else 'final-')
file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB';file.save_as_render=False
file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(nav,indent=2,ensure_ascii=False)+'\n')
(WORK/'model-report.json').write_text(json.dumps({'revision':4,'newClosedMeshes':new,'archivedSourceObjects':archived,
    'gradedCourtVertices':len(layout['grade']),'relocatedCactusGroup':plants,'phaseLandmarks':len(definitions)},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-landmarks.blend'))
print('GUAIRA_LANDMARKS_AUTHORED',len(new),'closed meshes;',len(definitions),'phase collections',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    im=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(im.pixels);im.pixels.foreach_get(pixels);packed=array('H')
    for y in reversed(range(h)):
        for x in range(w):
            z=pixels[(y*w+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes())
    print('GUAIRA_LANDMARKS_RENDERED',w,h,flush=True)
