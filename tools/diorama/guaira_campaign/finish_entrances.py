"""Revision 5: fitted workshop entrance, hollow fixtures and a connected service hoist.

Open revision 4 guaira-landmarks.blend. Run inspect_entrance_finish.py and
layout_entrance_finish.py first. --draft renders a preview; final saves revision 5.
The twelve walking routes, eight arrival points, terrain and water stay fixed.
"""
import bpy,bmesh,json,math,sys
from pathlib import Path
from mathutils import Vector
from array import array
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/entrance-finish-2026-10-15';DOC=ROOT/'docs/world/guaira/entrance-finish-2026-10-15'
WORK.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;nav=json.loads(scene['native_navigation']);layout=json.loads((WORK/'finish-layout.json').read_text())
draft='--draft' in sys.argv;new=[];archived=[];phase='paths';footings=[];cavities=[]
root=bpy.data.collections['Guaíra v4 — lugares das fases'];root.name='Guaíra — lugares das fases'
collections={}
for id,l in nav['landmarks'].items():
    col=bpy.data.collections[l['collection']];col.name='Guaíra | '+id+' | '+l['place'];l['collection']=col.name;collections[id]=col
collections['paths']=bpy.data.collections['Guaíra v4 | paths'];collections['paths'].name='Guaíra | caminhos'
archive=bpy.data.collections.new('Entrance v4 — preserved source');scene.collection.children.link(archive)
def preserve(ob):
    if ob.hide_render:return
    archived.append(ob.name);ob.hide_render=True;ob.hide_viewport=True
    for c in list(ob.users_collection):c.objects.unlink(ob)
    archive.objects.link(ob);ob.name='Archived v4 - '+ob.name
def hide_prefix(*prefixes):
    for ob in list(scene.objects):
        if ob.name.startswith(prefixes):preserve(ob)
def mesh(name,vs,fs,mat,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();bm=bmesh.new();bm.from_mesh(me)
    assert all(e.is_manifold for e in bm.edges),name+': open edge'
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True)
    assert volume>1e-10 and all(f.calc_area()>1e-12 for f in bm.faces),name+': invalid solid'
    bm.to_mesh(me);bm.free();ob=bpy.data.objects.new('Finish v5 '+name,me);collections[phase].objects.link(ob);me.materials.append(mat);ob['stage_id']=phase
    if bevel:
        mod=ob.modifiers.new('Worn arris','BEVEL');mod.width=bevel;mod.segments=2;ob.modifiers.new('Area weighted normals','WEIGHTED_NORMAL')
    new.append({'name':ob.name,'phase':phase,'volume':volume});return ob
def linear(hex):return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in [int(hex[i:i+2],16)/255 for i in (0,2,4)])
def material(name,color,rough=.8,metallic=0):
    m=bpy.data.materials.new('Finish v5 '+name);m.use_nodes=True;rgb=(*linear(color),1);m.diffuse_color=rgb
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=rgb;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic;p.inputs['Specular IOR Level'].default_value=.23;return m
stone=bpy.data.materials['Guaira native honed limestone tread'];ochre=bpy.data.materials['Landmark v4 sluice sandstone']
bronze=bpy.data.materials['Landmark v4 brass valve hardware'];teal=bpy.data.materials['Landmark v4 aged teal machinery'];bone=bpy.data.materials['Landmark v4 bone and gauge face']
dark=material('recessed aged iron','354D4A',.62,.12);wood=material('seasoned joinery','987243');woodlight=material('cut timber edges','B08A54');rope=material('waxed hoist rope','69513A')
clay=material('old repair brick','BB7D58');mortar=material('recessed sandstone joints','95856A');doorwood=material('gallery door oak','9D7847')
paving=bpy.data.objects['Landmark v4 joined ground paving 0'].data.materials[0]
edge_mat=next(o for o in scene.objects if o.name.startswith('Landmark v4 paving edge')).data.materials[0]
def grain(mat,low,high):
    ns=mat.node_tree.nodes;ls=mat.node_tree.links
    tex=ns.new('ShaderNodeTexCoord');scale=ns.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(6,7,.65)
    noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.0;noise.inputs['Detail'].default_value=1.0
    ramp=ns.new('ShaderNodeValToRGB')
    for el,pos,col in zip(ramp.color_ramp.elements,(.30,.75),(low,high)):el.position=pos;el.color=(*linear(col),1)
    ls.new(tex.outputs['Generated'],scale.inputs[0]);ls.new(scale.outputs['Vector'],noise.inputs['Vector']);ls.new(noise.outputs['Fac'],ramp.inputs['Fac']);ls.new(ramp.outputs['Color'],ns['Principled BSDF'].inputs['Base Color'])
grain(wood,'946D40','A07948');grain(doorwood,'967044','A5804E');grain(woodlight,'AC8552','B48F5B')
def box(name,p,d,mat,bevel=.007):
    x,y,z=p;a,b,c=[v/2 for v in d];vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat,bevel)
def beam(name,a,b,width,mat,thickness=None):
    a,b=Vector(a),Vector(b);v=b-a;ob=box(name,(0,0,0),(width,thickness or width,v.length),mat,min(.006,width*.15));ob.location=(a+b)/2;ob.rotation_euler=v.to_track_quat('Z','Y').to_euler();return ob
def pipe(name,points,radius,mat,sides=12):
    ps=[Vector(p) for p in points];radii=radius if isinstance(radius,list) else [radius]*len(ps);vs=[];previous=None
    for i,(p,r) in enumerate(zip(ps,radii)):
        t=(ps[min(i+1,len(ps)-1)]-ps[max(i-1,0)]).normalized();ref=Vector((0,0,1)) if abs(t.z)<.9 else Vector((0,1,0))
        u=(previous-t*previous.dot(t)).normalized() if previous is not None else t.cross(ref).normalized();v=t.cross(u).normalized();previous=u
        vs.extend(tuple(p+r*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v)) for k in range(sides))
    fs=[tuple(reversed(range(sides))),tuple((len(ps)-1)*sides+k for k in range(sides))]
    fs.extend((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k) for j in range(len(ps)-1) for k in range(sides))
    return mesh(name,vs,fs,mat)
def ring(name,c,r,tube,mat,normal=(0,-1,0)):
    c=Vector(c);n=Vector(normal).normalized();u=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized();v=n.cross(u);N=24;M=8;vs=[]
    for i in range(N):
        axis=math.cos(i*math.tau/N)*u+math.sin(i*math.tau/N)*v
        for j in range(M):vs.append(tuple(c+(r+tube*math.cos(j*math.tau/M))*axis+tube*math.sin(j*math.tau/M)*n))
    return mesh(name,vs,[(i*M+j,i*M+(j+1)%M,((i+1)%N)*M+(j+1)%M,((i+1)%N)*M+j) for i in range(N) for j in range(M)],mat)
def extrusion(name,outline,axis,low,high,mat,bevel=0):
    def point(a,b,c):return (c,a,b) if axis=='X' else (a,c,b) if axis=='Y' else (a,b,c)
    n=len(outline);vs=[point(*p,c) for c in (low,high) for p in outline]
    return mesh(name,vs,[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat,bevel)
def solid(name,s,low,high,mat):
    vs=[];ids={};fs=[]
    def vert(x,y,z):
        key=(round(x,6),round(y,6),z)
        if key not in ids:ids[key]=len(vs);vs.append(key)
        return ids[key]
    for tri in s['triangles']:
        fs.extend([tuple(vert(x,y,high) for x,y in tri),tuple(vert(x,y,low) for x,y in reversed(tri))])
    for r in [s['ring'],*s['holes']]:
        fs.extend((vert(*a,low),vert(*b,low),vert(*b,high),vert(*a,high)) for a,b in zip(r,r[1:]+r[:1]))
    return mesh(name,vs,fs,mat,.008)
def rounded_rect(hx,hy,r):return [(hx-r,-hy),(hx,-hy+r),(hx,hy-r),(hx-r,hy),(-hx+r,hy),(-hx,hy-r),(-hx,-hy+r),(-hx+r,-hy)]
def basin(name,center,profiles,mat):
    # Cross-section goes from the outer underside, up over the lip, then down
    # to the actual inner floor. This is one closed hollow solid, not a decal.
    x,y=center;vs=[(x+a,y+b,z) for hx,hy,r,z in profiles for a,b in rounded_rect(hx,hy,r)]
    fs=[tuple(reversed(range(8))),tuple(range((len(profiles)-1)*8,len(profiles)*8))]
    fs.extend((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(len(profiles)-1) for i in range(8))
    ob=mesh(name,vs,fs,mat,.005);cavities.append({'name':ob.name,'x':x,'y':y,'rimZ':profiles[-2][3],'floorZ':profiles[-1][3]});return ob
def footing(name,p,d,mat):
    ob=box(name,p,d,mat,.012);footings.append({'name':ob.name,'x':p[0],'y':p[1],'bottom':p[2]-d[2]/2});return ob
def cut(ob,cutter):
    mod=ob.modifiers.new('Carved recess','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.context.view_layer.objects.active=ob
    while ob.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name);new[:]=[r for r in new if r['name']!=cutter.name];bpy.data.objects.remove(cutter,do_unlink=True)

# Join the hoist's boarding approach to the existing road. Curbs stop at the
# boarding steps; no doubled faces or decorative curb across an entrance.
hide_prefix('Landmark v4 joined ground paving','Landmark v4 paving edge')
for i,s in enumerate(layout['surfaces']):
    solid('joined ground paving '+str(i),s,1.69,1.835,paving)
    for j,(aa,bb) in enumerate(zip(s['ring'],s['ring'][1:]+s['ring'][:1])):
        a,b=Vector((*aa,1.817)),Vector((*bb,1.817));m=(a+b)/2
        if (2.50<m.x<3.72 and -2.32<m.y<-1.18) or (1.25<m.y<2.75 and 1.15<m.x<3.50):continue
        if m.y<-2.45 and m.x<-4.45 or abs(m.x-2.02)<.01 and -.26<m.y<.56:continue
        if 3.50<m.x<4.10 and 1.4<m.y<1.6:continue
        if -1.96<m.x<-1.0 and .50<m.y<1.13:continue
        if (b-a).length<.15:continue
        count=max(1,math.ceil((b-a).length/.64))
        for k in range(count):
            p=a.lerp(b,k/count);q=a.lerp(b,(k+1)/count);v=(q-p).normalized()*.004;beam(f'paving edge {i}-{j}-{k}',p+v,q-v,.095,edge_mat)

phase='guaira-lab'
hide_prefix('Landmark v4 bone crest','Landmark v4 carved horn','Landmark v4 crest eye','Landmark v4 corral dry trough','Landmark v4 corral empty trough','Landmark v4 corral fallen repair timber')
hide_prefix('Sparse dry crack.006') # superseded dry relief floated above the graded court
for ob in list(scene.objects):
    if ob.hide_render or not ob.name.startswith('Landmark v4 corral stone post shoe'):continue
    p=sum((ob.matrix_world@Vector(v) for v in ob.bound_box),Vector())/8;preserve(ob)
    footing('low corral stone shoe',(p.x,p.y,1.77),(.134,.134,.11),ochre)
    # A restrained heel reinforces the post without a second decorative cap.
for ob in scene.objects:
    if not ob.hide_render and ob.name.startswith(('Landmark v4 corral squared post','Landmark v4 corral entrance post')):ob.data.materials[0]=wood
    if not ob.hide_render and ob.name.startswith(('Landmark v4 corral rail','Landmark v4 corral entrance lintel')):ob.data.materials[0]=woodlight
outline=[(.15-.12,2.62),(.15+.12,2.62),(.15+.15,2.56),(.15+.09,2.49),(.15+.055,2.37),(.15-.055,2.37),(.15-.09,2.49),(.15-.15,2.56)]
skull=extrusion('carved bovine crest',outline,'X',2.105,2.178,bone,.012)
for side in (-1,1):
    y=.15+side*.076
    cutter=extrusion('temporary eye socket',[(y-.041,2.55),(y,2.572),(y+.041,2.55),(y,2.525)],'X',2.075,2.205,dark)
    cut(skull,cutter)
    pipe('tapered curved horn',[(2.133,.15+side*.105,2.595),(2.128,.15+side*.20,2.622),(2.112,.15+side*.295,2.70),(2.108,.15+side*.323,2.78),(2.11,.15+side*.305,2.82)],[.052,.043,.030,.014,.0035],bone)
    cutter=pipe('temporary nose carving',[(2.15,.15+side*.025,2.408),(2.20,.15+side*.025,2.408)],.011,dark,8);cut(skull,cutter)
# Gentle threshold down into the dry court, with its outer edge flush to paving.
mesh('corral fitted threshold',[(x,y,z) for x,top in [(1.84,1.793),(2.02,1.835)] for y,z in [(-.245,1.69),(.545,1.69),(.545,top),(-.245,top)]],
     [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],stone,.006)
basin('hollow dry stone trough',(1.18,.63),[(.295,.125,.025,1.785),(.315,.145,.03,2.015),(.252,.082,.018,2.015),(.232,.064,.014,1.86)],ochre)
for y in (-.26,.56):
    for z in (1.97,2.29):box('gate iron joinery strap',(2.098,y,z),(.019,.155,.038),dark,.003)
beam('rear fence repair brace',(-.24,.77,1.88),(.42,.90,2.16),.042,wood)
beam('stored replacement timber',(.10,.59,1.80),(.02,.76,2.14),.063,woodlight)

phase='gallery'
hide_prefix('Native gallery','Landmark v4 gallery patch','Landmark v4 gallery repaired','Landmark v4 gallery clay',
    'Repair shop door plank','Repair shop doorway','Repair shop threshold','Repair shop door iron hinge','Repair shop brass door latch')
cx=-2.964;spring=2.23;inner=.235;outer=.345
for side in (-1,1):
    x=cx+side*(inner+outer)/2
    footing('gallery founded jamb',(x,.755,1.795),(.145,.25,.17),ochre)
    box('gallery recessed jamb bed',(x,.785,2.045),(.109,.16,.44),mortar,.003)
    for j in range(3):box('gallery dressed jamb',(x,.73,1.855+j*.145),(.108,.19,.134),clay if side<0 and j==1 else stone,.008)
for j in range(9):
    a0=j*math.pi/9+.009;a1=(j+1)*math.pi/9-.009
    outline=[(cx+inner*math.cos(a0+(a1-a0)*k/3),spring+inner*math.sin(a0+(a1-a0)*k/3)) for k in range(4)]
    outline += [(cx+outer*math.cos(a0+(a1-a0)*k/3),spring+outer*math.sin(a0+(a1-a0)*k/3)) for k in reversed(range(4))]
    extrusion('gallery arch stone '+str(j),outline,'Y',.72,.86,ochre if j in (1,7) else stone,.005)
# Door boards follow the actual arch; the new frame clears the shutter to its right.
box('gallery recessed door shadow',(cx,.816,2.14),(.47,.027,.65),dark,.003)
for j in range(5):
    x0=cx-.22+j*.088+.003;x1=x0+.082
    top=lambda x:spring+math.sqrt(max(0,inner*inner-(x-cx)**2))-.012
    outline=[(x0,1.835),(x1,1.835),(x1,top(x1)),((x0+x1)/2,top((x0+x1)/2)),(x0,top(x0))]
    extrusion('arched gallery door board '+str(j),outline,'Y',.772,.813,doorwood,.004)
box('gallery seated threshold',(cx,.69,1.78),(.49,.27,.18),stone,.008)
for z in (1.96,2.19):box('gallery fitted door strap',(cx-.055,.762,z),(.31,.022,.027),dark,.003)
pipe('gallery door latch spindle',[(cx+.12,.74,2.09),(cx+.12,.78,2.09)],.018,bronze,10)
ring('gallery door ring pull',(cx+.12,.728,2.054),.037,.009,bronze)
# Retain the lantern position, adding the bracket and a protective hood.
beam('gallery lantern bracket',(-2.57,.72,2.49),(-2.57,.39,2.49),.025,dark)
box('gallery lantern rain hood',(-2.57,.40,2.488),(.145,.14,.035),dark,.008)

phase='relief'
hide_prefix('Native relief','Landmark v4 relief meter stem','Landmark v4 relief hatch handle')
basin('relief collector curb',(-1.48,.82),[(.44,.28,.035,1.73),(.44,.28,.035,1.98),(.345,.19,.025,1.98),(.32,.17,.02,1.80)],ochre)
box('relief rear hinge wall',(-1.48,1.055,1.98),(.87,.12,.47),stone,.012)
for x in (-1.80,-1.16):beam('relief inclined hatch frame',(x,.58,2.005),(x,1.04,2.215),.041,teal)
for y,z in [(.58,2.005),(1.04,2.215)]:beam('relief hatch crossmember',(-1.80,y,z),(-1.16,y,z),.041,teal)
for j in range(7):
    x=-1.72+j*.08;beam('relief open iron grille',(x,.60,2.017),(x,1.02,2.207),.021,dark)
for x in (-1.72,-1.24):pipe('relief seated hinge',[(x-.035,1.042,2.22),(x+.035,1.042,2.22)],.031,bronze)
pipe('relief connected gauge stem',[(-1.48,.65,2.035),(-1.48,.65,2.35)],.028,bronze)
pipe('relief lifting handle',[(-1.55,.606,2.02),(-1.55,.606,2.075),(-1.41,.606,2.075),(-1.41,.606,2.02)],.012,bronze,8)

phase='guaira-respiros'
hide_prefix('Landmark v4 two vents service bank','Landmark v4 vent 0 raised rim','Landmark v4 vent 1 raised rim',
    'Landmark v4 vent 0 dark throat','Landmark v4 vent 1 dark throat','Landmark v4 vent 0 iron grille','Landmark v4 vent 1 iron grille','Landmark v4 respiros collector')
bank=extrusion('respiros founded service bank',[(1.96+x,-3.32+y) for x,y in rounded_rect(.64,.27,.055)],'Z',1.69,1.90,ochre,.012)
footings.append({'name':bank.name,'x':1.96,'y':-3.32,'bottom':1.69})
for index,x in enumerate((1.67,2.25)):
    basin('hollow respiro '+str(index),(x,-3.235),[(.194,.153,.025,1.83),(.194,.153,.025,2.045),(.146,.109,.017,2.045),(.138,.101,.014,1.902)],teal)
    for k in range(4):box('seated respiro grille',(x-.105+.07*k,-3.235,2.034),(.024,.22,.025),bronze,.004)
    pipe('respiro inlet elbow',[(x,-3.385,1.958),(x,-3.445,1.958),(x,-3.482,1.935)],.031,teal)
    box('collector pipe saddle',(x,-3.482,1.914),(.075,.09,.04),dark,.005)
pipe('visible shared pressure collector',[(1.40,-3.482,1.73),(1.40,-3.482,1.91),(1.47,-3.482,1.942),(2.25,-3.482,1.942)],.034,teal)
for x in (1.60,2.17):ring('collector fitted collar',(x,-3.482,1.942),.042,.009,bronze,(1,0,0))

phase='guaira-subida'
hide_prefix('Landmark v4 inspection hoist','Landmark v4 inspection lift deck','Landmark v4 inspection lift winch')
# Preserve the founded plinth. Two small boarding steps meet the joined apron.
box('inspection boarding step',(3.79,1.46,1.83),(.48,.24,.26),stone,.012)
for x in (3.57,4.01):
    footing('hoist founded shoe',(x,1.96,1.84),(.17,.18,.24),ochre)
    beam('hoist seated upright',(x,1.96,1.94),(x,1.96,2.97),.083,wood)
    pipe('hoist metal guide',[(x,1.907,1.98),(x,1.907,2.79)],.018,dark)
    box('hoist carriage shoe',(x,1.87,2.14),(.064,.063,.21),teal,.006)
    beam('hoist platform bearer',(x,1.54,2.015),(x,1.90,2.015),.055,dark)
beam('hoist fitted header',(3.50,1.96,2.92),(4.08,1.96,2.92),.10,woodlight)
beam('hoist rear brace left',(3.57,2.018,2.02),(4.01,2.018,2.81),.038,wood)
beam('hoist rear brace right',(4.01,2.035,2.02),(3.57,2.035,2.81),.038,wood)
for k in range(5):box('hoist deck board',(3.79,1.58+k*.076,2.06),(.44,.069,.06),woodlight,.005)
beam('hoist carriage crossbar',(3.57,1.87,2.13),(4.01,1.87,2.13),.05,teal)
for y in (1.90,1.98):beam('pulley hanger',(3.79,y,2.92),(3.79,y,2.70),.029,dark)
pipe('pulley supported axle',[(3.79,1.882,2.70),(3.79,1.998,2.70)],.024,bronze)
ring('hoist sheave',(3.79,1.94,2.70),.070,.015,bronze)
for a in (0,math.pi/2):beam('hoist pulley spoke',(3.79-.055*math.cos(a),1.94,2.70-.055*math.sin(a)),(3.79+.055*math.cos(a),1.94,2.70+.055*math.sin(a)),.013,bronze)
pipe('hoist winch drum',[(4.01,1.915,2.30),(4.01,2.01,2.30)],.069,dark,16)
for y in (1.908,2.018):pipe('winch drum flange',[(4.01,y-.008,2.30),(4.01,y+.008,2.30)],.087,bronze,16)
pipe('hoist crank axle',[(4.01,1.84,2.30),(4.01,2.04,2.30)],.023,bronze)
ring('hoist crank wheel',(4.01,1.835,2.30),.105,.015,bronze)
for a in (0,math.pi/2):beam('hoist crank spoke',(4.01-.085*math.cos(a),1.835,2.30-.085*math.sin(a)),(4.01+.085*math.cos(a),1.835,2.30+.085*math.sin(a)),.014,bronze)
pipe('hoist crank grip',[(4.01,1.83,2.20),(4.01,1.78,2.20)],.018,wood)
pipe('continuous lifting rope',[(3.95,1.94,2.31),(3.865,1.94,2.69),(3.847,1.94,2.75),(3.79,1.94,2.775),(3.737,1.94,2.75),(3.715,1.94,2.70),(3.715,1.87,2.16)],.0085,rope,8)
ring('carriage lifting eye',(3.715,1.87,2.16),.024,.008,bronze)

# The authored geography is identical. Only the collection names and asset
# revision change; phase receipts and travel state belong to the native game.
bpy.context.view_layer.update();nav['revision']=5;nav['source']='docs/world/guaira/entrance-finish-2026-10-15/guaira-entrances.blend'
w,h=(1280,800) if draft else (1920,1200);nav['depth'].update(width=w,height=h)
scene['native_map_revision']=5;scene['native_navigation']=json.dumps(nav,ensure_ascii=False)
scene['entrance_finish_notes']='Fitted arched workshop doorway; hollow trough, vents and collector; carved corral crest; physically connected hoist and joined boarding apron.'
scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU';scene.cycles.samples=16 if draft else 64;scene.cycles.use_denoising=True;scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Entrance finish paired beauty depth','CompositorNodeTree');scene.compositing_node_group=group;group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene;out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='depth-'+('draft-' if draft else 'final-');file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB';file.save_as_render=False
file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(nav,indent=2,ensure_ascii=False)+'\n')
for record in new:
    ob=bpy.data.objects[record['name']];bm=bmesh.new();bm.from_mesh(ob.data);record['volume']=bm.calc_volume(signed=True);bm.free()
(WORK/'model-report.json').write_text(json.dumps({'revision':5,'newClosedMeshes':new,'archivedSourceObjects':archived,'foundedBases':footings,'cavities':cavities,'addedPavingArea':layout['addedPavingArea'],'removedPavingArea':layout['removedPavingArea']},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-entrances.blend'))
print('GUAIRA_ENTRANCES_AUTHORED',len(new),'closed meshes;',len(cavities),'real cavities',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True);exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    im=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(im.pixels);im.pixels.foreach_get(pixels);packed=array('H')
    for y in reversed(range(h)):
        for x in range(w):
            z=pixels[(y*w+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes());print('GUAIRA_ENTRANCES_RENDERED',w,h,flush=True)
