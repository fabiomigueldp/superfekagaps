"""Rebuild the Delicia map as a coherent architectural landscape, revision 4.

Blender 5.x, no external libraries or downloads:
  blender -b --python tools/delicia/rebuild_island.py -- --draft
  blender -b --python tools/delicia/rebuild_island.py

Drafts stay in output/delicia/island-v4. Final BLEND, GLB and transparent render
stay in docs/world/delicia. The shipped pins are projected from this same camera.
"""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import island_geometry as G
import island_landscape as L
from island_landscape import radius,river_x,height,PADS
from island_geometry import box,cyl,lathe,pipe,beam,ring,organic,mesh,site,end_site,house,window,door,arch_frame,extrude_xz,railing,stairs

ROOT=HERE.parents[1]
SOURCE=ROOT/'docs/world/delicia'
RUNTIME=ROOT/'public/assets/delicia'
REVIEW=ROOT/'output/delicia/island-v4'
REVIEW.mkdir(parents=True,exist_ok=True)
DRAFT='--draft' in sys.argv
SEED=51020263
rng=random.Random(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1

def progress(msg):print('DELICIA V4: '+msg,flush=True)

# Warm lime plaster and terracotta, blue-green carpentry, restrained brass.
for name,color,rough,metal,grain in [
 ('limestone','#DACBB0',.8,0,.025),('stone-light','#ECDFBD',.82,0,.03),('stone-warm','#B5A17D',.9,0,.035),
 ('plaster','#EBD7AE',.92,0,.025),('plaster-ochre','#DCBD82',.9,0,.02),('plaster-rose','#D8B4A0',.9,0,.025),
 ('plaster-sage','#ABBCAD',.9,0,.025),('recess','#293A36',1,0,0),('wood','#8F6742',.86,0,.025),
 ('wood-dark','#584330',.9,0,.02),('shutter','#37655E',.65,0,.014),('shutter-light','#60867B',.73,0,.013),
 ('iron','#2E4947',.38,.6,0),('brass','#C99C4E',.4,.58,.01),('bronze','#93816A',.46,.62,.02),
 ('copper','#B27449',.5,.48,.015),('purple','#614860',.9,0,.015),('linen','#F2E1B9',.9,0,.02),
 ('awning','#DC8843',.8,0,.02),('orange','#F3A337',.43,0,.009),('flower','#E8AD9B',.8,0,0),
 ('flower-white','#F3EACC',.8,0,0),('bark','#6D6548',.95,0,.03),('sand','#CAB995',.95,0,.06),
 ('trail','#CBBF9D',.93,0,.03),('mosaic','#EDD7A4',.75,0,.02),('juice','#EEAE46',.2,.15,.012),
 ('juice-shade','#CA853A',.25,.05,.03),('foam','#FBE8AA',.4,0,.015),('teal-water','#458F89',.24,.15,0),
 ('glass','#ADC4B4',.18,.25,0),('brick','#A0785D',.9,0,.03),('tile','#AA6143',.85,0,.014),
 ('slate','#356666',.57,.12,.01)
]:G.material(name,color,rough,metal,grain)
for key,colors in {
 'tile':['#9A553B','#B36646','#C27B53','#AB6242','#D08A62'],
 'slate':['#2E5759','#386B69','#437772','#355E62','#588A7A'],
 'rock':['#B3A08A','#CDBA9B','#BDB199','#D1C2A4','#A2927D','#918B7C'],
 'grass':['#77885A','#859867','#6D8059','#9BA675','#687D55'],
 'leaf':['#3E603A','#527142','#6E8952','#47663C','#83965C']
}.items():
    for i,c in enumerate(colors):G.material(key+str(i),c,.87 if key not in ('tile','slate') else .76,0,.018)

G.collection('01 • Eroded limestone, sheltered coves and river gorge')
progress('sculpting beaches, undercut waterfalls and embedded limestone')
terrain=L.build_terrain()
L.build_outcrops()

def catmull(points,steps=12):
    p=[Vector(points[0])]+[Vector(a) for a in points]+[Vector(points[-1])]
    out=[]
    for i in range(1,len(p)-2):
        a,b,c,d=p[i-1:i+3]
        for j in range(steps):
            t=j/steps
            out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    out.append(Vector(points[-1]));return out

def path_on_land(name,points,width=.6,mat='trail'):
    line=catmull([(x,y,0) for x,y in points]);v=[];f=[]
    for i,p in enumerate(line):
        tangent=line[min(i+1,len(line)-1)]-line[max(0,i-1)]
        tangent.normalize();perp=Vector((-tangent.y,tangent.x,0))*width/2
        for q in (p-perp,p+perp):v.append((q.x,q.y,height(q.x,q.y)+.045))
        if i:f.append((2*i-2,2*i-1,2*i+1,2*i))
    return mesh(name,v,f,mat)

def low_wall(name,points,h=.48):
    line=catmull([(x,y,0) for x,y in points],8)
    for a,b in zip(line,line[1:]):
        p=(a+b)*.5;length=(b-a).length
        if length<.04:continue
        z=height(p.x,p.y)
        o=box(name,(p.x,p.y,z+h/2),(.24,length+.015,h),'stone-warm',.024)
        o.rotation_euler.z=math.atan2(b.y-a.y,b.x-a.x)-math.pi/2
        o=box(name+' coping',(p.x,p.y,z+h+.025),(.32,length+.025,.09),'limestone',.025)
        o.rotation_euler.z=math.atan2(b.y-a.y,b.x-a.x)-math.pi/2

def bridge(name,x0,x1,y,deck,arches=3,thickness=1.0,channel=False):
    span=(x1-x0)/arches;opening=span-.5;radius=opening/2;spring=deck-.48-radius
    for i in range(arches+1):
        x=x0+i*span;ground=min(deck-.7,height(x,y))
        box(name+' dressed pier',(x,y,(deck+ground)/2),(.56,thickness+.18,deck-ground),'stone-warm',.045)
        box(name+' pier capital',(x,y,deck-.4),(.78,thickness+.33,.22),'limestone')
    for i in range(arches):
        x=x0+(i+.5)*span
        poly=[(x-radius,deck),(x+radius,deck)]+[(x+radius*math.cos(a*math.pi/24),spring+radius*math.sin(a*math.pi/24)) for a in range(25)]
        extrude_xz(name+' open arch spandrel',poly,y-thickness/2,thickness,'limestone')
        arch_frame(name+' arch voussoirs',x,y-thickness/2-.035,spring-.35,opening,radius+.35,.17,.14)
    box(name+' roadway',(sum((x0,x1))/2,y,deck+.09),(x1-x0+.7,thickness+.5,.19),'stone-light')
    for side in (-1,1):
        if channel:box('Aqueduct channel wall',((x0+x1)/2,y+side*(thickness/2+.12),deck+.43),(x1-x0+.7,.21,.62),'limestone')
        else:railing(name+' parapet',[(x0,y+side*(thickness/2+.1),deck+.22),(x1,y+side*(thickness/2+.1),deck+.22)],.56,spacing=.65)
    if channel:box('Amber channel surface',((x0+x1)/2,y,deck+.39),(x1-x0+.4,thickness-.17,.035),'juice',0)

def tree(x,y,scale=1,seed=0,kind='citrus'):
    z=height(x,y);rr=random.Random(seed)
    if kind=='cypress':
        cyl('Cypress trunk',(x,y,z+.5*scale),.08*scale,scale,'bark',10)
        for j in range(4):organic('Tapering cypress foliage',(x+rr.uniform(-.05,.05),y,z+scale*(.7+j*.42)),(scale*(.4-j*.075),scale*(.4-j*.075),scale*.72),['leaf0','leaf1'],seed+j,.22,2)
        return
    trunk_top=z+scale*1.1
    beam('Gnarled orange trunk',(x,y,z),(x+.12*scale,y+.04*scale,trunk_top),.095*scale,'bark')
    for j in range(5):
        a=j*2.399+rr.random()*.3
        dx=math.cos(a)*.42*scale;dy=math.sin(a)*.42*scale;zz=trunk_top+(.2+(j%2)*.28)*scale
        beam('Citrus branch',(x+.1,y,trunk_top-.3*scale),(x+dx,y+dy,zz),.035*scale,'bark',8)
        organic('Angular leafy crown',(x+dx,y+dy,zz),(.6*scale,.54*scale,.54*scale),['leaf'+str(k) for k in (0,1,2,3,4)],seed+j,.23,2,True)
    for j in range(13):
        a=j*2.399+rr.random();r=.55*scale
        organic('Ripe citrus fruit',(x+math.cos(a)*r,y+math.sin(a)*r,trunk_top+rr.uniform(-.1,.66)*scale),(.075*scale,)*3,'orange',seed+j,.035,1)

def flowerpot(x,y,z,scale=.3):
    lathe('Terracotta flower pot',(x,y,z),[(scale*.68,0),(scale,.38),(scale,.44),(scale*.81,.44),(scale*.78,.38)],'tile',16)
    for j in range(6):
        a=j*2.4
        organic('Trailing balcony flowers',(x+math.cos(a)*scale*.9,y+math.sin(a)*scale*.9,z+.44),(.13,.12,.1),'flower' if j%2 else 'leaf1',j,.16,1)

G.collection('02 • Porto da Partilha, inhabited coastal town')
progress('building the harbour with curved tiles, arcades and shutters')
# Pier-side masonry quay, laid in actual rectangular stones around the plaza.
for row in range(12):
    for col in range(18):
        x=-18.7+col*.57+(row%2)*.285;y=-14.6+row*.47
        if (x+13.8)**2/29+(y+11.9)**2/10<1.18:
            box('Harbour plaza paving',(x,y,2.645),(.545,.45,.06),'limestone' if (row+col)%5 else 'stone-warm',.01)
HOUSE_SITES=[
 ('Casa das primeiras laranjas',(-19.4,-10.1),2.9,2.3,3.05,-.07,'plaster'),
 ('Pensão da Dona Casca',(-16.0,-7.8),3.3,2.35,3.65,.035,'plaster-ochre'),
 ('Casa dos copos',(-12.1,-7.7),2.6,2.25,3.0,-.025,'plaster'),
 ('Correio do cais',(-8.8,-8.8),2.65,2.15,3.4,.07,'plaster-sage'),
 ('Taverna do primeiro gole',(-8.5,-12.5),3.0,2.1,3.15,.04,'plaster'),
 ('Armazém da maré',(-20.0,-13.0),3.1,2.35,2.8,-.08,'plaster-rose'),
 ('Oficina dos barcos',(-9.7,-15.2),2.9,2.0,2.5,.07,'plaster-ochre'),
 ('Sobrado das fontes',(-21.0,-5.0),2.6,2.1,3.35,-.14,'plaster'),
 ('Casa do sineiro',(-17.3,-2.7),2.5,2.0,2.9,.2,'plaster-rose'),
]
for i,(name,xy,w,d,h,angle,wall) in enumerate(HOUSE_SITES):
    x,y=xy;house(name,(x,y,height(x,y)),w,d,h,angle,wall,2,balconies=i%3==1)
    flowerpot(x-w*.3,y-d*.6,height(x,y)+.25,.2)

# Town hall: a small civic arcade with a bell, distinct from the later citadel.
site('Casa da Partilha, civic arcade',(-13.6,-4.5,height(-13.6,-4.5)))
box('Civic hall',(0,0,1.5),(3.7,2.1,3),'plaster')
for x in (-1.25,0,1.25):
    G.arch_panel('Portico shaded entrance',x,-1.08,.12,.87,1.6,'recess')
    arch_frame('Town hall portico',x,-1.15,.12,.87,1.6,.12,.17)
    window(x,-1.075,2.03,.47,.73,False)
G.tiled_roof('Town hall',4,2.35,3.1,.8)
box('Town hall bell tower',(1.35,.1,3.95),(1.2,1.1,2.7),'plaster')
for z in (3.1,4.48,5.3):box('Bell tower cornice',(1.35,.1,z),(1.36,1.27,.15),'stone-light')
G.arch_panel('Bell tower dark opening',1.35,-.47,4.46,.7,.72,'recess')
arch_frame('Bell arch',1.35,-.51,4.46,.7,.72,.09,.12)
lathe('Bronze noon bell',(1.35,-.55,4.65),[(.23,0),(.17,.1),(.11,.4),(.05,.47)],'brass',24)
parent=G.ACTIVE
roof_group=site('Civic bell roof placement',(1.35,.1,0));roof_group.parent=parent
G.tiled_roof('Bell lantern',1.25,1.25,5.37,.45,hip=True)
G.global_parent(parent)
end_site()

# Striped stalls are integrated into the square, with curved fabric and counters.
for i,(x,y,angle) in enumerate([(-16.2,-11.1,.07),(-11.6,-11.0,-.06),(-14.9,-14.6,.04)]):
    site('Citrus market stall',(x,y,2.64),angle)
    for xx in (-.85,.85):
        for yy in (-.55,.55):cyl('Stall timber post',(xx,yy,.84),.042,1.68,'wood',8)
    for k in range(10):
        xx=-1+k*.2
        mesh('Draped striped canvas',[(xx,-.74,1.48),(xx+.21,-.74,1.48),(xx+.21,0,1.88),(xx,0,1.88),(xx,.68,1.72),(xx+.21,.68,1.72)],[(0,1,2,3),(3,2,5,4)],'awning' if k%2 else 'linen')
        box('Scalloped awning edge',(xx+.1,-.75,1.41),(.205,.04,.18),'awning' if k%2 else 'linen',.065)
    box('Market counter',(0,0,.58),(1.8,1,.17),'wood')
    for k in range(20):organic('Fresh market oranges',(-.72+(k%5)*.33,-.33+(k//5)*.2,.74),(.1,.1,.1),'orange',k,.03,1)
    end_site()

# Civic fountain, stone basin and orange-slice paving.
px,py,pz=-14.0,-11.8,2.64
lathe('Plaza fountain stepped basin',(px,py,pz),[(1.32,0),(1.32,.16),(1.12,.16),(1.12,.38),(1.02,.46),(.92,.46),(.9,.2)],'limestone',64)
cyl('Plaza fountain water',(px,py,pz+.27),.91,.045,'teal-water',64)
lathe('Fountain carved pedestal',(px,py,pz+.25),[(.37,0),(.25,.15),(.18,.73),(.27,.92),(.28,1.03)],'stone-light')
lathe('First shared bowl',(px,py,pz+1.25),[(.12,0),(.38,.15),(.63,.28),(.64,.36),(.53,.36),(.31,.15)],'limestone')
for i in range(6):
    a=i*math.tau/6
    pipe('Fountain water arc',[(px+math.cos(a)*r,py+math.sin(a)*r,pz+z) for r,z in [(.5,1.52),(.66,1.46),(.81,1.1),(.86,.34)]],.025,'foam')

path_on_land('Port lane to the orchard',[(-14,-9),(-18,-6),(-21,-2),(-19,2),(-14,4)],1.0)
path_on_land('Road from the harbour to the gorge',[(-11,-11),(-7,-10),(-5,-7.5)],.85)

# Lighthouse with a real gallery and glazed lantern, at the harbour entrance.
lx,ly=-24.5,-8.8;lz=height(lx,ly)
site('Farol do Primeiro Gole',(lx,ly,lz))
lathe('Lighthouse dressed stone shaft',(0,0,0),[(.83,0),(.83,.3),(.64,.45),(.5,4.4),(.7,4.48),(.74,4.64)],'plaster',40)
for z in (.3,2.1,4.4):ring('Lighthouse stone belt',(0,0,z),.68 if z<3 else .59,.07,'limestone')
door(0,-.7,.2,.48,1.05)
cyl('Lantern glass',(0,0,5.05),.49,.85,'glass',32)
for i in range(8):
    a=i*math.tau/8;beam('Lighthouse lantern muntin',(.5*math.cos(a),.5*math.sin(a),4.63),(.5*math.cos(a),.5*math.sin(a),5.49),.025,'iron')
cyl('Lantern copper roof',(0,0,5.73),.67,.53,'slate',32,.11)
ring('Lighthouse gallery coping',(0,0,5.04),.83,.035,'iron')
for i in range(16):
    a=i*math.tau/16;beam('Gallery baluster',(.83*math.cos(a),.83*math.sin(a),4.62),(.83*math.cos(a),.83*math.sin(a),5.04),.016,'iron',8)
end_site()

G.collection('03 • Citrus hills, terraced orchards and root sanctuary')
progress('planting irregular groves and contour paths')
# Curving paths follow the hill. Tree placement leaves alleys and views open.
for row in range(4):
    y=1+row*2.5
    path_on_land('Orchard contour path',[(-22,y-.6),(-18,y+.3),(-13,y-.3),(-7,y+.5)],.48)
    for col in range(7):
        x=-22+col*2.15+rng.uniform(-.32,.32);yy=y+1.05+rng.uniform(-.28,.28)
        if x>-5.7 or (x<-18 and yy>8):continue
        tree(x,yy,rng.uniform(.9,1.27),row*20+col)
for x,y in [(-24,1),(-24,5),(-8,11),(-5,8),(-12,13),(-15,13.5),(-18,12.7)]:
    tree(x,y,1.0,int((x+y)*40))
for x,y in [(-22,-1),(-8,-5.5),(-6,-9.5),(-23,7.4),(-11,10.7)]:tree(x,y,.9,int(x*20),kind='cypress')
low_wall('Old orchard retaining wall',[(-23,.2),(-19,1.4),(-14,.9),(-9,1.7)],.42)
low_wall('Upper orchard dry stone wall',[(-21,6.3),(-17,6.7),(-13,6.3),(-8,7.2)],.45)

# A tapered stone windmill with a complete four-sail assembly.
site('Moinho das Cascas',(-20,10,6.4),-.13)
lathe('Windmill masonry taper',(0,0,0),[(1.04,0),(1.0,.27),(.77,3.6),(.9,3.73)],'plaster',48)
door(0,-1.025,.1,.55,1.18)
window(0,-.91,2.04,.4,.61,False)
cyl('Windmill copper cap',(0,0,4.26),1.08,1.1,'tile',48,.13)
hub=(0,-1.06,3.2)
for i in range(4):
    a=i*math.pi/2+.6
    tip=(math.cos(a)*2.17,hub[1],hub[2]+math.sin(a)*2.17)
    beam('Windmill oak sail spar',hub,tip,.053,'wood')
    for j in range(7):
        d=.7+j*.2;p=Vector((math.cos(a)*d,hub[1],hub[2]+math.sin(a)*d));v=Vector((-math.sin(a)*.36,0,math.cos(a)*.36))
        beam('Windmill sail lattice',p-v*.35,p+v,.019,'wood',8)
    mesh('Windmill stretched linen',[(math.cos(a)*.65,hub[1]+.02,hub[2]+math.sin(a)*.65),
        (math.cos(a)*2.04,hub[1]+.02,hub[2]+math.sin(a)*2.04),
        (math.cos(a)*2.04-math.sin(a)*.34,hub[1]+.02,hub[2]+math.sin(a)*2.04+math.cos(a)*.34),
        (math.cos(a)*.65-math.sin(a)*.34,hub[1]+.02,hub[2]+math.sin(a)*.65+math.cos(a)*.34)],[(0,1,2,3)],'linen')
organic('Mill axle cap',hub,(.17,.15,.17),'wood',2,0,2)
end_site()
house('Keeper of the roots',(-15.8,10.9,height(-15.8,10.9)),2.45,1.9,2.1,-.2,'plaster',1)

G.collection('04 • Aqueduct, amber cascades and carved bridges')
progress('constructing open arches and continuous sheets of falling juice')
bridge('Aqueduto dos Ecos',-10.6,8.0,3.0,8.35,5,1.15,True)
bridge('Ponte das Cinco Safras',-5.2,5.4,-6.2,4.03,3,1.1)
path_on_land('Approach to the aqueduct',[(-14,4),(-12,2.5),(-10.6,3)],.72)
path_on_land('Eastern aqueduct walk',[(8,3),(10,3.5),(11,5)],.75)

L.build_river()

# Turned hydraulic gates and a readable sluice at the aqueduct's western end.
for x in (-9.1,6.65):
    box('Aqueduct gate frame',(x,3.0,8.95),(.18,1.4,1.12),'wood')
    ring('Aqueduct gate handwheel',(x,2.27,9.26),.27,.035,'brass',True,32)
    for a in range(4):
        angle=a*math.pi/2;beam('Sluice wheel spoke',(x,2.27,9.26),(x+.25*math.cos(angle),2.27,9.26+.25*math.sin(angle)),.017,'brass')

G.collection('05 • Jajá, the shared chalice sanctuary')
site('Santuário da Nascente',(-.6,8.9,7.0))
# The amphitheatre is stone, with a human-scaled ceremonial cup at its centre.
lathe('Sanctuary dressed stone base',(0,0,0),[(3.8,-1.2),(3.7,-.18),(3.7,.08),(3.48,.17)],'limestone',80)
cyl('Sanctuary pavement',(0,0,.2),3.45,.08,'mosaic',80)
for i in range(12):
    a=i*math.tau/12+.045;b=(i+1)*math.tau/12-.045
    mesh('Inlaid citrus floor segment',[(.55*math.cos(a),.55*math.sin(a),.251),(2.45*math.cos(a),2.45*math.sin(a),.251),
       (2.45*math.cos(b),2.45*math.sin(b),.251),(.55*math.cos(b),.55*math.sin(b),.251)],[(0,1,2,3)],'tile2' if i%2 else 'stone-warm')
for i in range(9):
    a=.06*math.pi+i*math.pi*.89/8;x=3.15*math.cos(a);y=3.15*math.sin(a)
    lathe('Sanctuary stone column',(x,y,.22),[(.19,0),(.19,.19),(.12,.27),(.1,1.86),(.17,1.94),(.23,2.05)],'stone-light',20)
    if i<8:
        b=.06*math.pi+(i+1)*math.pi*.89/8
        xa=3.15*math.cos(b);ya=3.15*math.sin(b)
        parent=G.ACTIVE
        mid=(a+b)/2
        bay=site('Sanctuary arcade bay',((x+xa)/2,(y+ya)/2,0),mid+math.pi/2);bay.parent=parent
        arch_frame('Sanctuary round arch',0,-.08,.27,.93,1.91,.12,.22)
        G.global_parent(parent)
        beam('Supported sanctuary entablature',(x,y,2.4),(xa,ya,2.4),.18,'limestone',4)
for row in range(3):
    r=2.55+row*.31;z=.35+row*.16
    for i in range(18):
        a=.07*math.pi+i*math.pi*.86/17
        o=box('Curved amphitheatre seat',(r*math.cos(a),r*math.sin(a),z),(.4,.27,.19),'limestone');o.rotation_euler.z=a+math.pi/2
lathe('Jajá fountain pedestal',(0,-.65,.25),[(.74,0),(.74,.17),(.5,.23),(.3,.42),(.2,.85),(.32,.99)],'stone-light',48)
lathe('The shared cup, hollow bowl',(0,-.65,1.2),[(.25,0),(.45,.15),(.69,.46),(.76,.74),(.74,.84),(.65,.84),(.61,.65),(.4,.24)],'brass',64)
cyl('Juice inside the cup',(0,-.65,1.93),.635,.035,'juice',64)
ring('Chalice engraved lip',(0,-.65,2.04),.71,.04,'stone-light')
pipe('Chalice handle',[(.69,-.65,1.94),(.99,-.65,1.9),(1.08,-.65,1.66),(.91,-.65,1.48),(.59,-.65,1.48)],.065,'brass')
for i in range(3):
    x=-.33+i*.33
    pipe('First source spilling',[(x,-1.3,1.92),(x,-1.52,1.79),(x,-1.73,.7),(x,-1.92,.31)],.023,'juice')
end_site()
path_on_land('Sanctuary entrance',[(-3,5),(-3.1,7),(-1,7.5)],.75)

G.collection('06 • Arquivo Fermentado')
house('Arquivo, repository of forgotten harvests',(7.2,2.6,7.1),3.7,2.7,3.45,.02,'plaster-sage',2,'slate',True)
site('Archive clock and barrel court',(7.2,2.6,7.1))
ring('Archive clock stone surround',(0,-1.52,3.1),.33,.06,'limestone',True,40)
o=cyl('Archive clock face',(0,-1.54,3.1),.27,.05,'linen',40);o.rotation_euler.x=math.pi/2
beam('Clock minute hand',(0,-1.59,3.1),(.03,-1.59,3.31),.015,'iron')
beam('Clock hour hand',(0,-1.59,3.1),(-.14,-1.59,3.12),.022,'iron')
for i in range(4):
    x=-1.6+i*.77;y=-2.3
    lathe('Harvest memory barrel',(x,y,0),[(.22,0),(.29,.16),(.31,.39),(.28,.65),(.22,.74)],'wood',20)
    for z in (.11,.56):ring('Barrel iron hoop',(x,y,z),.283,.022,'iron',n=24)
end_site()

G.collection('07 • Refinery, masonry machine hall and copper plant')
progress('assembling the refinery as connected masonry and working machinery')
site('Engrenagens da Polpa',(13,-.6,6.1))
box('Refinery stone foundation',(0,0,.25),(6.5,4.4,.5),'stone-warm',.07)
box('Refinery machine hall',(0,.5,1.85),(5.8,3.4,3.25),'brick',.045)
for z in (.45,1.2,3.3):box('Factory dressed stone band',(0,-1.25,z),(6.0,.17,.14),'limestone')
for x in (-2.1,-.7,.7,2.1):
    G.arch_panel('Refinery high glass arch',x,-1.225,.65,.89,2.2,'recess')
    arch_frame('Refinery arch masonry',x,-1.29,.65,.89,2.2,.13,.18)
    for xx in (-.2,0,.2):box('Machine hall glazed mullion',(x+xx,-1.33,1.65),(.035,.04,1.75),'bronze',0)
    for zz in (1.2,1.8,2.4):box('Machine hall transom',(x,-1.33,zz),(.83,.04,.035),'bronze',0)
G.tiled_roof('Machine hall',6,3.6,3.58,1.0,'slate')
for x in (-2.2,2.2):
    lathe('Riveted juice vat',(x,-2.0,.45),[(.63,0),(.7,.12),(.7,2.48),(.61,2.7),(.32,2.87),(.15,2.95)],'copper',40)
    for zz in (.63,1.7,2.86):ring('Vat brass strap',(x,-2,zz),.706,.048,'brass')
    # A narrow sight glass and a framed pressure gauge, rather than bare cylinders.
    box('Amber sight glass',(x,-2.712,1.67),(.17,.04,1.65),'juice',.035)
    for side in (-1,1):box('Sight glass guard',(x+side*.12,-2.73,1.67),(.035,.04,1.85),'brass',.01)
    for zz in (.7,2.5):
        for k in range(18):
            a=k*math.tau/18
            organic('Tank rivet',(x+math.cos(a)*.713,-2+math.sin(a)*.713,zz),(.026,)*3,'brass',k,0,1)
    ring('Vat dial rim',(x,-2.75,2.8),.2,.035,'brass',True,32)
    o=cyl('Vat dial face',(x,-2.75,2.8),.16,.035,'linen',24);o.rotation_euler.x=math.pi/2
    beam('Dial needle',(x,-2.78,2.8),(x+.08,-2.78,2.89),.012,'iron')
    pipe('Feed pipe from hall',[(x,.5,4.63),(x,-.5,4.63),(x,-2,4.1),(x,-2,3.42)],.14,'brass')
lathe('Kiln chimney',(2.17,1.1,.3),[(.63,0),(.55,.22),(.45,5.85),(.54,5.92),(.54,6.18),(.36,6.18),(.36,5.97)],'brick',32)
for z in (2,4,5.96):ring('Chimney stone collar',(2.17,1.1,z),.49,.06,'limestone')
box('Factory inspection walkway',(0,-1.77,2.1),(5.1,.57,.14),'iron')
railing('Factory walkway guard',[(-2.5,-2.02,2.17),(2.5,-2.02,2.17)],.62,'bronze',.36)
for x in (-2.4,2.4):beam('Factory balcony knee brace',(x,-1.35,1.24),(x,-1.98,2.05),.055,'iron')
end_site()

# A water wheel stands on the river bank, supported by its own mill building.
wx,wy=5.3,-4.1;wz=height(wx,wy)
house('Casa da Roda',(wx+1.0,wy+.6,wz),2.1,2.2,2.55,.0,'plaster-ochre',1)
cy=(wx-1.0,wy-.7,wz+1.2)
for yy in (cy[1]-.34,cy[1]+.34):
    ring('Waterwheel oak rim',(cy[0],yy,cy[2]),1.39,.09,'wood',True,64)
    for i in range(8):
        a=i*math.tau/8;beam('Wheel spoke',(cy[0],yy,cy[2]),(cy[0]+math.cos(a)*1.35,yy,cy[2]+math.sin(a)*1.35),.045,'wood')
for i in range(24):
    a=i*math.tau/24
    o=box('Waterwheel paddle',(cy[0]+math.cos(a)*1.37,cy[1],cy[2]+math.sin(a)*1.37),(.24,.85,.075),'wood',.015);o.rotation_euler.y=-a
beam('Wheel bearing shaft',(cy[0],cy[1]-.5,cy[2]),(cy[0],cy[1]+1.7,cy[2]),.12,'iron')
path_on_land('Factory inspection road',[(5,-6),(7,-4.3),(10,-4.3),(12,-3.5)],.7)

G.collection('08 • Walled citrus garden and coastal campanile')
site('Jardim Proibido',(16,-9,3.6))
box('Garden limestone terrace',(0,0,.05),(8.0,5.0,.24),'limestone',.08)
for x in (-2.5,0,2.5):
    box('Garden gravel promenade',(x,0,.2),(.64,4.4,.035),'sand',0)
for x in (-1.24,1.24):
    for y in (-1.2,1.2):
        box('Garden soil bed',(x,y,.2),(1.55,1.45,.1),'wood-dark')
        for side in (-1,1):
            box('Clipped parterre hedge',(x+side*.71,y,.53),(.23,1.5,.55),'leaf1',.09)
            box('Clipped parterre hedge',(x,y+side*.64,.53),(1.55,.23,.55),'leaf1',.09)
        for i in range(7):organic('Garden blossom',(x+rng.uniform(-.4,.4),y+rng.uniform(-.35,.35),.56),(.12,.12,.13),'flower',i,.15,1)
cyl('Garden fountain footing',(0,0,.24),.72,.18,'stone-light',48)
lathe('Garden fountain basin',(0,0,.35),[(.67,0),(.67,.22),(.56,.3),(.5,.3),(.48,.13)],'limestone',48)
cyl('Garden still water',(0,0,.56),.49,.03,'teal-water',40)
for side in (-1,1):
    railing('Garden stone balustrade',[(-3.8,side*2.35,.2),(3.8,side*2.35,.2)],.66,spacing=.47)
# Pergola has horizontal rafters, columns and climbing vines.
for x in (-3.25,3.25):
    for y in (-1.3,1.3):lathe('Pergola stone column',(x,y,.2),[(.17,0),(.14,.16),(.09,1.55),(.16,1.65)],'limestone',16)
    beam('Pergola runner',(x,-1.6,1.95),(x,1.6,1.95),.085,'wood',4)
for j in range(9):
    y=-1.6+j*.4;beam('Pergola oak rafter',(-3.55,y,2.05),(3.55,y,2.05),.05,'wood',4)
    if j%2==0:
        for x in (-3.25,3.25):organic('Pergola trailing foliage',(x,y,2.1),(.55,.35,.17),['leaf1','leaf2'],j,.2,2)
end_site()
for x,y in [(11.7,-9),(20.3,-9.6),(20,-6.5),(12,-11.6)]:tree(x,y,1.15,int(x*14),kind='cypress')

site('Campanário da Maré',(22,-6.4,height(22,-6.4)))
box('Campanile plinth',(0,0,.18),(1.9,1.9,.36),'stone-warm')
box('Campanile shaft',(0,0,2.6),(1.52,1.5,5.0),'plaster')
for z in (.4,3.55,4.85,5.3):box('Campanile cornice',(0,0,z),(1.74,1.74,.15),'limestone')
door(0,-.78,.25,.65,1.42)
G.arch_panel('Bell room opening',0,-.77,3.68,.92,1.13,'recess')
arch_frame('Bell room carved opening',0,-.81,3.68,.92,1.13,.12,.17)
lathe('Noon bell',(0,-.83,3.95),[(.31,0),(.25,.16),(.17,.53),(.05,.66)],'brass',32)
G.tiled_roof('Campanile crown',1.7,1.7,5.38,.77,'slate',True)
end_site()
path_on_land('Garden approach',[(12,-3),(15,-4.5),(17,-6.3),(16,-7)],.7)

G.collection('09 • Citadel of the last harvest')
progress('building the palace with grounded proportions, galleries and a copper dome')
site('Palácio da Última Safra',(12,10,11.6))
# A complete palace block anchors the roof and towers. Brass is trim, not walls.
box('Citadel podium',(0,0,.3),(10.4,6.6,.65),'stone-warm',.08)
box('Palace main body',(0,.65,2.6),(7.8,4.0,4.5),'plaster',.07)
for z in (.66,2.8,4.72):box('Palace horizontal cornice',(0,.65,z),(8.04,4.2,.18),'limestone')
for x in (-3.25,-1.62,0,1.62,3.25):
    if x==0:door(x,-1.45,.62,1.15,2.04)
    else:
        G.arch_panel('Grand arcade deep opening',x,-1.37,.67,1.06,1.9,'recess')
        arch_frame('Palace ground arcade',x,-1.48,.67,1.06,1.9,.15,.18)
    window(x,-1.43,3.24,.62,1.12,False,True)
# Roof lower wings and an octagonal drum keep the dome correctly supported.
G.tiled_roof('Palace roof',8.1,4.25,4.85,1.03,'slate',True)
lathe('Dome octagonal drum',(0,.7,5.28),[(1.55,0),(1.55,.16),(1.42,.25),(1.42,1.24),(1.57,1.32)],'limestone',8)
for i in range(8):
    a=i*math.tau/8
    x=math.sin(a)*1.34;y=.7-math.cos(a)*1.34
    group=G.ACTIVE
    face=site('Drum elevation',(x,y,5.83),a);face.parent=group
    G.arch_panel('Drum arched recess',0,-.035,0,.5,.67,'recess')
    arch_frame('Drum window stone',0,-.075,0,.5,.67,.06,.09)
    G.global_parent(group)
profile=[(1.52,0)]
for i in range(1,22):
    t=i/22*math.pi/2
    profile.append((1.52*math.cos(t),1.62*math.sin(t)))
profile.append((.075,1.65))
lathe('Segmented burnt orange copper dome',(0,.7,6.58),profile,'copper',96)
for i in range(12):
    a=i*math.tau/12
    pipe('Dome copper rib',[(r*math.cos(a),.7+r*math.sin(a),6.59+z) for r,z in profile],.022,'brass')
lathe('Dome lantern finial',(0,.7,8.2),[(.17,0),(.12,.25),(.23,.31),(.11,.49),(.045,.65)],'brass',24)

# The gatehouse towers share the same scale, masonry, windows and roof system.
for x in (-4.35,4.35):
    box('Citadel square tower',(x,-.8,3.2),(1.75,1.75,5.8),'plaster',.05)
    for z in (.65,3.2,5.68,6.15):box('Tower carved cornice',(x,-.8,z),(1.98,1.98,.18),'limestone')
    window(x,-1.715,1.15,.51,1.07,False)
    window(x,-1.715,3.8,.55,1.17,False)
    parent=G.ACTIVE
    tower_roof=site('Tower roof placement',(x,-.8,0));tower_roof.parent=parent
    G.tiled_roof('Palace tower roof',1.94,1.94,6.25,.87,'slate',True)
    G.global_parent(parent)
    beam('Purple pennant mast',(x,-.8,7.08),(x,-.8,8),.022,'brass')
    mesh('Tower pennant',[(x,-.8,7.98),(x+.85,-.79,7.7),(x,-.8,7.48)],[(0,1,2)],'purple')
for x in (-2.46,2.46):
    beam('Banner bracket',(x,-1.5,4.63),(x,-1.77,4.63),.034,'brass')
    mesh('Baronial purple hanging banner',[(x-.3,-1.77,4.59),(x+.3,-1.77,4.59),(x+.3,-1.83,2.58),(x,-1.81,2.32),(x-.3,-1.83,2.58)],[(0,1,2,3,4)],'purple')
    ring('Citrus banner heraldry',(x,-1.845,3.87),.16,.018,'brass',True,32)

# Front court, coped walls and many steps connect to the hillside below.
box('Palace front court',(0,-2.75,.43),(10.4,2.18,.21),'limestone',.035)
for row in range(3):
    for col in range(16):box('Palace court paver',(-4.7+col*.62,-3.4+row*.56,.553),(.595,.54,.035),'stone-light' if (row+col)%6 else 'stone-warm',.008)
for x0,x1 in [(-5.0,-1.95),(1.95,5.0)]:railing('Palace terrace balustrade',[(x0,-3.9,.56),(x1,-3.9,.56)],.77,spacing=.39)
for x in (-4.9,4.9):
    lathe('Terrace citrus urn',(x,-3.5,.56),[(.26,0),(.18,.25),(.37,.48),(.34,.72),(.28,.78)],'limestone',24)
    organic('Urn clipped foliage',(x,-3.5,1.54),(.4,.39,.44),['leaf1','leaf2'],int(x*6),.15,2)
end_site()
stairs('Grand palace stair',(12,3.6,height(12,3.6)+.06),(12,6.06,12.16),3.35,22)
for side in (-1,1):
    a=(12+side*1.92,3.6,height(12,3.6)+.15);b=(12+side*1.92,6.06,12.19)
    railing('Grand stair stone parapet',[a,b],.72,spacing=.45)
for x,y in [(6.3,8),(6,11.4),(18.3,8),(19,12.3),(8,15),(15.4,15)]:tree(x,y,1.25,int(x+y)*13,'cypress')
path_on_land('Way to the palace',[(15,-2.8),(18,1.1),(17.7,4.0),(14.4,4.7),(12,3.6)],.95)

# The eastern slope is an inhabited orchard and coastal walk, not blank fill.
G.collection('09b • Eastern hillside gardens and coastal paths')
path_on_land('Walk of the last harvest',[(7,-11.7),(10,-14.1),(16,-13.1),(21,-10.4),(22,-7.7)],.72)
low_wall('Coastal path retaining wall',[(8,-14.3),(12,-15.5),(17,-14.5),(21.5,-11.7)],.43)
low_wall('Refinery delivery court edge',[(20.1,1.2),(21.6,-1.6),(21.8,-4.6)],.56)
for i,(x,y,s) in enumerate([(7.4,-12.7,1.03),(9.4,-11.9,.97),(9.1,-15.5,.88),(12,-16.4,.98),
    (15,-15.0,.9),(18,-14.6,1.0),(21.7,-3.1,1.07),(23,-1.2,.92),(21.9,1.4,1.02),(22.4,5.2,1.1),
    (20.6,7.2,.88),(24.0,-9.8,.8),(-5,-12,.8),(-6,-14,.82)]):
    tree(x,y,s,301+i)
# Low, irregular flower and grass patches ground the walls and paths.
verts=[];faces=[];indices=[]
for i in range(650):
    x=rng.uniform(-25,25);y=rng.uniform(-17,16);z=height(x,y)
    if z<1.2 or radius(x,y)<.5 or abs(x-river_x(y))<4.6:continue
    if any(abs(x-px)<rx*.92 and abs(y-py)<ry*.92 for px,py,rx,ry,_ in PADS):continue
    if i%3==0:
        organic('Wildflower patch',(x,y,z+.08),(.085,.08,.11),'flower-white' if i%2 else 'flower',i,.12,1)
    for j in range(3):
        a=j*math.pi/3+i;dx=math.cos(a)*.055;dy=math.sin(a)*.055;k=len(verts)
        verts.extend([(x-dx,y-dy,z),(x+dx,y+dy,z),(x+dx*.6,y+dy*.6,z+.16+rng.random()*.12)])
        faces.append((k,k+1,k+2));indices.append(i%2)
mesh('Scattered meadow grass blades',verts,faces,['grass1','grass3'],indices=indices)

G.collection('10 • Shore, wooden piers and sailing boats')
progress('finishing shore contact, piers, boats and ground detail')
for i,(x,start,length) in enumerate([(-18,-16.3,5.6),(-12.2,-17.2,6.4),(-8.0,-16.2,5.5)]):
    z=.78
    box('Stone harbour quay',(x,start+.45,.51),(3.1,1.5,2.1),'stone-warm',.045)
    box('Quay dressed coping',(x,start+.45,1.63),(3.3,1.68,.18),'limestone',.04)
    for xx in (x-1.15,x+1.15):
        lathe('Mooring bollard',(xx,start+.22,1.72),[(.12,0),(.1,.18),(.16,.23),(.16,.29)],'iron',16)
    for row in range(4):
        for col in range(6):box('Quay face masonry',(x-1.25+col*.48+(row%2)*.09,start-.32,.15+row*.35),(.455,.08,.31),'stone-light' if (row+col)%4 else 'stone-warm',.012)
    stairs('Stair down to the timber pier',(x,start-.98,.83),(x,start-.29,1.72),1.3,5)
    for j in range(round(length/.23)):
        box('Harbour pier plank',(x,start-j*.23,z),(1.36,.21,.13),'wood' if j%4 else 'wood-dark',.02)
    for xx in (x-.52,x+.52):
        beam('Pier stringer',(xx,start+.1,z-.18),(xx,start-length,z-.18),.065,'wood',8)
        for j in range(5):
            y=start-j*length/4
            cyl('Timber harbour pile',(xx,y,-.01),.095,2.1,'wood-dark',12)
            ring('Pier rope collar',(xx,y,.91),.103,.023,'linen',n=20)
    path_on_land('Harbour descent',[(x,start+3),(x,start+1),(x,start)],.9)

def boat(name,x,y,scale=1,angle=0):
    site(name,(x,y,.04),angle)
    verts=[];faces=[];n=32
    # Pointed bow and narrower stern, rounded bilges, a real flat deck.
    for z,rx,ry in [(-.43,.97,.27),(-.2,1.27,.48),(.08,1.5,.53)]:
        for i in range(n):
            a=i*math.tau/n;xx=math.cos(a)*rx;yy=math.sin(a)*ry*(.7+.3*(1-math.cos(a)**2))
            verts.append((xx*scale,yy*scale,z*scale))
    for row in range(2):
        for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    mesh('Planked wooden sailing hull',verts,faces,'wood',smooth=True)
    mesh('Boat deck',verts[-n:],[tuple(range(n))],'wood-dark')
    for side in (-1,1):pipe('Boat gunwale',[(math.cos(i*math.pi/24)*1.5*scale,side*math.sin(i*math.pi/24)*.53*scale*(.7+.3*(1-math.cos(i*math.pi/24)**2)),.11*scale) for i in range(25)],.04*scale,'limestone')
    beam('Sailboat mast',(-.12*scale,0,.08*scale),(-.12*scale,0,2.8*scale),.035*scale,'wood')
    beam('Sail boom',(-.12*scale,0,.46*scale),(1.23*scale,0,.46*scale),.026*scale,'wood')
    sv=[];sf=[]
    for i in range(13):
        t=i/12;h=.49+2.26*t;width=1.36*(1-t)
        for j in range(7):
            u=j/6;sv.append(((-.12+u*width)*scale,math.sin(u*math.pi)*math.sin(t*math.pi)*.23*scale,h*scale))
        if i:
            for j in range(6):sf.append(((i-1)*7+j,(i-1)*7+j+1,i*7+j+1,i*7+j))
    mesh('Wind-filled linen sail',sv,sf,'linen',smooth=True)
    for a,b in [((-.12,0,2.72),(-1.25,0,.12)),((-.12,0,2.72),(1.4,0,.12))]:beam('Standing rigging',tuple(v*scale for v in a),tuple(v*scale for v in b),.008*scale,'linen',8)
    end_site()
boat('Barco do primeiro gole',-14.5,-22.3,1.05,.28)
boat('Barco do mercado',-22.7,-15.1,.9,-.5)
boat('Barco da maré',8.0,-22.9,1.1,.58)
boat('Barco das cartas',-6,-22.1,.67,-.08)

# Actual height-field waterline, translucent shoals and sheltered beach wash.
L.build_shore()

for i in range(75):
    x=rng.uniform(-27,26);y=rng.uniform(-17,18);z=height(x,y)
    if z<1 or radius(x,y)<.68 or abs(x-river_x(y))<4:continue
    organic('Coastal shrub cluster',(x,y,z+.22),(.45,.36,.32),['leaf0','leaf2'],i,.23,2,False)

G.collection('11 • Grounded route locations')
NODES=[(-14,-12,2.9),(-13.7,3.2,height(-13.7,3.2)+.2),(-5.6,3.0,8.7),(-3.6,-4.9,height(-3.6,-4.9)+.2),
       (7.2,.77,7.4),(-.6,8.0,7.3),(2.6,-12,height(2.6,-12)+.2),(11.8,-3.2,6.4),
       (16,-9,3.95),(16.1,.6,6.5),(12,4.7,10.4),(12,8.0,12.3)]
for i,p in enumerate(NODES):
    o=site('Stage '+str(i+1)+' landing',p)
    o.empty_display_type='SPHERE';o.empty_display_size=.2
    o['stage_id']='delicia-'+str(i+1)
end_site()

G.collection('12 • Camera and warm maritime light')
camera_data=bpy.data.cameras.new('Isometric coastal camera')
camera=bpy.data.objects.new('Delicia map camera',camera_data);G.COLLECTION.objects.link(camera)
camera.location=(45,-72,58)
target=Vector((0,.5,6.0));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=72
scene.camera=camera
scene.render.resolution_x=1440 if DRAFT else 2560
scene.render.resolution_y=900 if DRAFT else 1600
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.render.engine='CYCLES';scene.cycles.samples=20 if DRAFT else 48
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.03
scene.cycles.use_auto_tile=True;scene.cycles.tile_size=256
scene.cycles.denoising_use_gpu=False
scene.cycles.use_denoising=True;scene.cycles.max_bounces=8
scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3;scene.cycles.transparent_max_bounces=8
scene.cycles.device='CPU'
if '--cpu' in sys.argv:
    scene.render.threads_mode='FIXED';scene.render.threads=4
if '--cpu' not in sys.argv:
    try:
        pref=bpy.context.preferences.addons['cycles'].preferences
        pref.compute_device_type='CUDA';pref.get_devices()
        available=[d for d in pref.devices if d.type=='CUDA']
        if available:
            for d in pref.devices:d.use=d.type=='CUDA'
            scene.cycles.device='GPU'
            progress('CUDA render device: '+available[0].name)
    except Exception as exc:progress('Using CPU renderer: '+type(exc).__name__)
scene.world=bpy.data.worlds.new('Maritime blue sky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(*G.linear('#AFC8D3'),1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
for name,kind,power,size,loc,color in [
 ('Soft west sun','AREA',4800,22,(-27,-30,43),'#FFE1B6'),
 ('Cool sky fill','AREA',2400,28,(15,12,42),'#BCDADC')]:
    d=bpy.data.lights.new(name,kind);d.energy=power;d.shape='DISK';d.size=size;d.color=G.linear(color)
    o=bpy.data.objects.new(name,d);G.COLLECTION.objects.link(o);o.location=loc;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.lights.new('Long warm afternoon shadows','SUN');d.energy=2.1;d.angle=.16;d.color=G.linear('#FFE7C6')
o=bpy.data.objects.new('Long warm afternoon shadows',d);G.COLLECTION.objects.link(o);o.rotation_euler=(.47,-.48,-.65)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.1
scene['expansion']='Império da Delícia';scene['model_revision']=4;scene['seed']=SEED
bpy.context.view_layer.update()
projected={}
for i,p in enumerate(NODES):
    q=world_to_camera_view(scene,camera,Vector(p))
    projected['delicia-'+str(i+1)]={'x':round(q.x,6),'y':round(1-q.y,6)}
width=max(v.co.x for v in terrain.data.vertices)-min(v.co.x for v in terrain.data.vertices)
metadata={'title':'Império da Delícia','revision':4,'physicalWidthMeters':round(width,3),
 'image':{'width':scene.render.resolution_x,'height':scene.render.resolution_y},'nodes':projected,
 'routes':[[projected['delicia-'+str(i+1)],projected['delicia-'+str(i+2)]] for i in range(11)],
 'objects':len(scene.objects),'materials':sum(1 for mat in bpy.data.materials if mat.users),'seed':SEED,
 'render':{'engine':'Cycles','samples':scene.cycles.samples,'adaptiveThreshold':.03,'denoising':'CPU','tileSize':256},
 'geometry':'Eroded continuous terrain, pocket beaches, bedded limestone, curling waterfalls and plunge pools',
 'source':'docs/world/delicia/imperio-delicia-v4.blend'}
destination=REVIEW if DRAFT else SOURCE
scene.render.filepath=str(destination/'island-render-v4.png')
scene.render.use_file_extension=True
scene.render.image_settings.compression=35
scene['physical_width_m']=round(width,3)
bpy.ops.wm.save_as_mainfile(filepath=str(destination/'imperio-delicia-v4.blend'))
(destination/'island-map-v4.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
progress('rendering '+('draft' if DRAFT else 'final')+'; '+str(len(scene.objects))+' objects')
try:
    bpy.ops.render.render(write_still=True)
except RuntimeError:
    if scene.cycles.device!='GPU':raise
    progress('GPU rendering unavailable; completing with CPU')
    scene.cycles.device='CPU'
    bpy.ops.render.render(write_still=True)
if not DRAFT:
    (RUNTIME/'island-map.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    progress('exporting the editable glTF scene')
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/'imperio-delicia-v4.glb'),export_format='GLB',export_cameras=True,export_lights=True,export_apply=True)
print(json.dumps(metadata,ensure_ascii=False),flush=True)
