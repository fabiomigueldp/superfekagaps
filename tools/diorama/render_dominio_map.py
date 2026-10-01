"""Domínio Pizzarino: authored coastal residence and garden map.

blender -b -t 8 -P tools/diorama/render_dominio_map.py -- --output-dir DIR
Use --build-only for inexpensive geometric checks and --final --static for export.
All Blender scenes and proofs belong in scratch, never the runtime repository.
"""
import bpy
import json
import math
import os
import re
import subprocess
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[ARGS.index('--output-dir') + 1] if '--output-dir' in ARGS else '/tmp/feka-dominio-build'
FINAL = '--final' in ARGS
BUILD_ONLY = '--build-only' in ARGS
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, metal=0):
    color = tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in rgb)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .5
    p.inputs['Metallic'].default_value = metal
    return m


cream = material('Warm cream limestone', (.91, .84, .66))
light = material('Limestone sunlit caps', (.99, .93, .76))
blue = material('Mediterranean blue stone', (.38, .56, .66))
rock = material('Coastal lilac bedrock', (.51, .54, .61))
pathmat = material('Warm garden paving', (.89, .84, .68))
grass = material('Cared-for garden lawn', (.40, .58, .27))
green = material('Dark cypress foliage', (.14, .37, .22))
leaf = material('Fresh garden foliage', (.31, .55, .23))
rose = material('Garden pink flowers', (.89, .31, .54))
white = material('Garden ivory flowers', (.99, .95, .80))
roof = material('Warm terracotta tiles', (.74, .29, .18))
roofhi = material('Terracotta sunlit ridges', (.89, .41, .25))
red = material('Pizzarino red awnings', (.78, .20, .18))
wood = material('Lived-in warm timber', (.46, .28, .15))
teal = material('Painted teal shutters', (.15, .43, .41))
gold = material('Golden oven and lamps', (1, .68, .21), .12)
dark = material('Dark wrought iron', (.13, .20, .23))


def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width=.025):
    mod = obj.modifiers.new('Crafted edge', 'BEVEL')
    mod.width = width
    mod.segments = 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def cube(name, loc, dims, mat, radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return bevel(obj, radius) if radius else obj


def cyl(name, loc, radius, depth, mat, count=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=count, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return bevel(obj, .015)


def beam(name, a, b, radius, mat):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a + b) / 2, radius, (b - a).length, mat, 12)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return assign(obj, mat)


def polygon_solid(name, outline, top, bottom, mat):
    n = len(outline)
    vertices = [(x, y, top) for x, y in outline] + [(x, y, bottom) for x, y in outline]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return bevel(mesh(name, vertices, faces, mat), .03)


# The front sea cleft is part of the authored outline. The great bridge crosses
# an actual opening instead of disguising a flat foundation with a dark decal.
OUTLINE = [(-6.6, -3.15), (-4.85, -3.65), (-3.52, -3.45),
           (-3.52, -.92), (-.74, -.92), (-.74, -3.30), (1.70, -3.65),
           (4.45, -3.45), (6.65, -2.98), (6.90, -1.2), (6.55, 2.80),
           (4.8, 3.85), (1.7, 4.30), (-2.0, 4.35), (-5.7, 3.75), (-6.65, 1.2)]
polygon_solid('continuous coastal bedrock', OUTLINE, .77, -.30, rock)
polygon_solid('walk_garden foundation', [(x*.993, y*.993) for x,y in OUTLINE], 1.17, .70, cream)
polygon_solid('garden lawn top', [(x*.985, y*.985) for x,y in OUTLINE], 1.195, 1.165, grass)
WEST = [(-4.73,-.50),(-2.0,-.50),(-2.0,3.68),(-5.60,3.58),
        (-6.05,2.7),(-6.05,.85),(-4.73,.85)]
polygon_solid('walk_residence upper terrace', WEST, 2.48, 1.10, cream)
polygon_solid('upper terrace garden edge', [(x,y) for x,y in WEST], 2.505, 2.48, grass)

NODES = {'6-1':(5.3,-2.4,1.35), '6-2':(2.65,-.50,1.35),
         '6-3':(-.12,-1.80,1.35), '6-4':(-4.28,-1.80,1.35),
         '6-5':(-4.25,.70,2.70)}
MAIN = [[NODES['6-1'],(5.10,-1.0,1.35),(4.0,-.50,1.35),NODES['6-2']],
        [NODES['6-2'],(1.20,-.50,1.35),(.60,-1.80,1.35),NODES['6-3']],
        [NODES['6-3'],NODES['6-4']],
        [NODES['6-4'],(-5.55,-1.80,1.35),(-5.55,-1.35,1.35),
         (-5.55,.50,2.70),(-5.55,1.25,2.70),(-4.25,1.25,2.70),NODES['6-5']]]
SECRET = [NODES['6-3'],(-.12,-.60,1.35),(-.12,1.20,2.70),
          (-.12,2.00,2.70),(-1.70,2.00,2.70),(-3.50,.70,2.70),NODES['6-5']]
ENTRY = {'status':'reserved-open-garden-ingress','stage':'6-1',
         'approach':[NODES['6-1'],(6.35,-2.4,1.35)],'width':1.30,
         'terminalGeometryOwner':'additive-reserva-dominio-connector',
         'clearLandingRadius':1.0,'previousWorld':5}


def walkway(name, path, width=1.42, mat=pathmat, bottom=.95):
    # Independent joined path surfaces are subtly separated at shared landings.
    layer = -.014 if 'service' in name else -.018 if 'arrival' in name else -.003 * int(name.rsplit(' ',1)[1])
    points=[Vector(p)+Vector((0,0,layer)) for p in path]
    if 'arrival' in name:
        points[-1] += (points[-1]-points[-2]).normalized()*.03
    sides=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(points,points[1:])]
    top=[]
    for i,p in enumerate(points):
        side=sides[0] if i==0 else sides[-1] if i==len(points)-1 else (sides[i-1]+sides[i]).normalized()
        extent=width/2/max(.5,side.dot(sides[min(i,len(sides)-1)]))
        top += [p-side*extent,p+side*extent]
    count=len(top)
    verts=top+[Vector((p.x,p.y,bottom)) for p in top]
    center=len(verts); verts+=points; faces=[]
    for i in range(len(points)-1):
        j=2*i
        faces += [(j,j+2,center+i+1),(j,center+i+1,center+i),
                  (center+i,center+i+1,j+3),(center+i,j+3,j+1),
                  (count+j,count+j+1,count+j+3,count+j+2),
                  (j,count+j,count+j+2,j+2),(j+1,j+3,count+j+3,count+j+1)]
    faces += [(0,1,count+1,count),(count-2,2*count-2,2*count-1,count-1)]
    return mesh('walk_'+name,[tuple(p) for p in verts],faces,mat)

for i,route in enumerate(MAIN):
    walkway('main garden route '+str(i+1),route,1.44,bottom=1.12 if i==2 else .75)
# A fully supported inclined service path visually reads as shallow stone stairs.
# Tiny flush joints follow its actual slope; no separate floating step boxes.
walkway('back passage service stairs',SECRET,1.34,light,bottom=.75)
walkway('open eastern garden arrival',ENTRY['approach'],1.30,bottom=.75)
for key,p in NODES.items():
    cyl('walk_'+key+' generous garden landing',(p[0],p[1],p[2]-.119),1.0 if key=='6-1' else .90,.24,pathmat,40)


def arch_spandrel(name, left, right, y, depth, spring, crown, top, mat=cream):
    # Ring of filled quadrilateral segments between a true elliptical intrados
    # and the level deck. Each closed segment is a structural masonry voussoir.
    center=(left+right)/2; radius=(right-left)/2; n=14
    for i in range(n):
        a=math.pi-math.pi*i/n; b=math.pi-math.pi*(i+1)/n
        x0,x1=center+math.cos(a)*radius,center+math.cos(b)*radius
        z0,z1=spring+math.sin(a)*(crown-spring),spring+math.sin(b)*(crown-spring)
        vs=[(x0,y-depth/2,z0),(x1,y-depth/2,z1),(x1,y-depth/2,top),(x0,y-depth/2,top),
            (x0,y+depth/2,z0),(x1,y+depth/2,z1),(x1,y+depth/2,top),(x0,y+depth/2,top)]
        mesh(name+' voussoir '+str(i),vs,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],light if i%3==0 else mat)

# The broad cream arch has blue impost blocks and foundations rooted to the
# solid coastal shoulders; the open intrados remains visible above the sea.
arch_spandrel('great last-crossing arch',-3.58,-.68,-1.80,1.47,-.10,.82,1.17)
for x in [-3.77,-.50]:
    cube('great bridge rooted abutment',(x,-1.80,.43),(.55,1.72,1.46),cream,.025)
    cube('great bridge blue impost',(x,-1.80,.86),(.70,1.83,.18),blue,.02)
    cube('great bridge submerged foundation',(x,-1.80,-.22),(.85,1.99,.20),blue,.025)
# Low far-side parapet leaves the near-side actor silhouette wholly exposed.
cube('great bridge far blue parapet',(-2.30,-.97,1.57),(3.20,.12,.40),blue,.02)
for x in [-3.73,-2.80,-1.62,-.78]:
    cube('great bridge far cream post',(x,-.96,1.62),(.15,.20,.54),cream,.015)
    cyl('great bridge far cap',(x,-.96,1.92),.13,.09,light,16)


def pitched_roof(name,x,y,z,w,d,rise):
    x0,x1=x-w/2,x+w/2;y0,y1=y-d/2,y+d/2
    mesh(name+' terracotta roof',[(x0,y0,z),(x1,y0,z),(x1,y,z+rise),(x0,y,z+rise),
                               (x0,y1,z),(x1,y1,z)],[(0,1,2,3),(3,2,5,4)],roof)
    for i in range(15):
        xx=x0+i*w/14
        beam(name+' overlapping clay tile rib',(xx,y0,z+.02),(xx,y,z+rise+.02),.036,roofhi)
        beam(name+' rear clay tile rib',(xx,y,z+rise+.02),(xx,y1,z+.02),.034,roofhi)
    beam(name+' rounded roof ridge',(x0,y,z+rise+.04),(x1,y,z+rise+.04),.095,roofhi)


def house(name,x,y,z,w,d,h):
    cube(name+' warm cream walls',(x,y,z+h/2),(w,d,h),cream,.055)
    cube(name+' blue foundation course',(x,y,z+.13),(w+.12,d+.10,.26),blue,.03)
    pitched_roof(name,x,y,z+h+.05,w+.42,d+.40,.59)
    for dx in [-w*.24,w*.24]:
        xx=x+dx;yy=y-d/2-.045
        cube(name+' golden window',(xx,yy,z+h*.58),(.42,.055,.64),gold,.025)
        for sx in [-.28,.28]:
            cube(name+' teal shutter',(xx+sx,yy-.035,z+h*.58),(.14,.08,.71),teal,.015)
        beam(name+' window central mullion',(xx,yy-.05,z+h*.29),(xx,yy-.05,z+h*.88),.027,wood)
        cube(name+' cream sill',(xx,yy-.10,z+h*.28),(.63,.24,.09),light,.018)
    cube(name+' red front awning',(x,y-d/2-.32,z+h-.26),(w+.15,.67,.10),red,.025)
    for dx in [-w*.43,w*.43]:
        beam(name+' awning bracket',(x+dx,y-d/2,z+h-.38),(x+dx,y-d/2-.55,z+h-.27),.032,wood)

house('Pizzarino coastal home',-4.18,2.77,2.51,2.65,1.72,1.90)
house('oven cottage',2.80,2.40,1.20,2.80,1.63,1.85)
# Roofless back entrance stays behind the service lane. The frame is built from
# separate jambs and a shallow cap so the visible path is never under a roof.
cube('back passage cream wall',(-1.28,3.15,2.30),(1.45,.38,2.22),cream,.035)
cube('back passage blue door recess',(-1.28,2.938,2.13),(.70,.045,1.53),teal,.03)
cube('back passage timber door',(-1.28,2.907,2.08),(.50,.035,1.30),wood,.025)
cube('back passage red lintel',(-1.28,2.93,3.34),(1.58,.55,.13),roof,.025)

# Golden oven: a formed dome with an open-looking dark front, hearth and arched
# crown. It sits on the garden shoulder behind6-2, not over its walking corridor.
x,y,z=2.5,.93,1.20
cube('oven stone hearth foundation',(x,y,z+.27),(1.75,1.0,.54),blue,.045)
cube('oven broad cream hearth',(x,y-.04,z+.59),(1.95,1.21,.17),light,.03)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(x,y,z+.72))
o=bpy.context.object;o.name='golden terracotta oven dome';o.scale=(.80,.55,.87);assign(o,roof)
cube('oven dark mouth',(x,y-.533,z+.92),(.78,.05,.62),dark,.06)
arch_spandrel('oven golden arch',x-.47,x+.47,y-.58,.14,z+.70,z+1.35,z+1.46,gold)
cube('oven warm hearth glow',(x,y-.579,z+.77),(.64,.028,.16),gold,.025)
cube('oven short chimney',(x+.37,y+.12,z+1.61),(.32,.35,.75),cream,.04)
cube('oven chimney terracotta cap',(x+.37,y+.12,z+2.02),(.46,.46,.12),roof,.02)


def shrub(name,x,y,z,sx=.48,sy=.38,h=.45):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+h*.48))
    o=bpy.context.object;o.name=name;o.scale=(sx,sy,h);assign(o,leaf)


def cypress(name,x,y,z,h=2.7):
    cyl(name+' rooted trunk',(x,y,z+.30),.075,.60,wood,10)
    for i,(zz,rr,hh) in enumerate([(.65,.36,1.0),(1.25,.32,1.1),(1.90,.23,.95)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z+zz*h/2.7))
        o=bpy.context.object;o.name=name+' tapered crown '+str(i);o.scale=(rr,rr*.87,hh*h/2.7);assign(o,green)


def flowerbed(name,x,y,z,w,d):
    cube(name+' cream planter',(x,y,z+.13),(w,d,.26),cream,.035)
    shrub(name+' garden foliage',x,y,z+.25,w*.51,d*.52,.32)
    for i in range(5):
        xx=x+(i-2)*w*.17;yy=y+(.08 if i%2 else -.08)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.065,location=(xx,yy,z+.65))
        o=bpy.context.object;o.name=name+' pink and ivory blooms';assign(o,rose if i%2 else white)

# Gardens give the house a tended silhouette while leaving all centerline body
# corridors and the eastern ferry ingress open.
for i,(x,y,z,h) in enumerate([(-5.8,3.15,2.51,2.8),(-2.5,3.65,2.51,2.2),
                            (5.5,2.4,1.2,3.0),(4.7,3.45,1.2,2.4),(1.0,3.65,1.2,2.6)]):
    cypress('residence cypress '+str(i),x,y,z,h)
for i,values in enumerate([(5.50,.66,1.20,1.15,.55),(3.40,-2.50,1.20,1.15,.57),
                           (1.0,-2.94,1.20,1.04,.49),(-4.4,-3.0,1.20,1.28,.45),
                           (-3.95,1.76,2.51,1.05,.37),(-2.70,2.72,2.51,.54,.65),
                           (4.60,1.35,1.20,.62,.92)]):
    flowerbed('tended flowerbed '+str(i),*values)
# Discreet couple bench beside the house, safely behind the landing circulation.
for x in [-4.78,-4.20]:
    cube('couple bench timber seat',(x,1.84,2.97),(.48,.42,.10),wood,.025)
    cube('couple bench timber back',(x,2.03,3.22),(.48,.08,.43),wood,.025)
    for dx in [-.16,.16]:
        beam('couple bench iron leg',(x+dx,1.73,2.51),(x+dx,1.73,2.93),.026,dark)
# Guarding the upper terrace only on its distant exterior edge.
for x in [-5.70,-4.90,-3.95,-3.00]:
    cube('upper residence blue border cap',(x,3.56,2.65),(.70,.18,.27),blue,.02)

# Visible fine stone joints on inclines stay flush with the actual route surface.
for name,path,width in [('last terrace ascent',MAIN[3],1.44),('service stairs',SECRET,1.34)]:
    for a,b in zip(path,path[1:]):
        a,b=Vector(a),Vector(b)
        if abs(a.z-b.z)<.2:continue
        side=Vector((-(b-a).y,(b-a).x,0)).normalized()
        for i in range(1,11):
            p=a.lerp(b,i/11)+Vector((0,0,-.0135 if name=='service stairs' else -.0115))
            along=(b-a).normalized()*.012
            mesh('walk_'+name+' flush stone tread joint',
                 [p-side*(width*.48)-along,p+side*(width*.48)-along,
                  p+side*(width*.48)+along,p-side*(width*.48)+along],[(0,1,2,3)],blue)

# Single approved craft pass: all circulation and the ferry ingress stay frozen.
# Individual courses follow the real closed coast outline, including the arch
# cleft. Sparse blue stones tie the residence masonry to the sea below it.
def masonry_edge(name,a,b,z,height,depth=.075,block=.72,mat=cream):
    a,b=Vector((a[0],a[1],z)),Vector((b[0],b[1],z))
    d=b-a;outward=Vector((d.y,-d.x,0)).normalized()
    count=max(1,round(d.length/block))
    for i in range(count):
        p=a.lerp(b,(i+.5)/count)+outward*(depth*.43)
        stone=cube(name+' fitted stone '+str(i),p,(d.length/count-.026,depth,height),
                   light if i%5==0 else mat,.008)
        stone.rotation_euler.z=math.atan2(d.y,d.x)

for i,(a,b) in enumerate(zip(OUTLINE,OUTLINE[1:]+OUTLINE[:1])):
    masonry_edge('coastal cream retaining course '+str(i),a,b,.95,.26,.075,.72)
    masonry_edge('coastal blue lower course '+str(i),a,b,.57,.22,.09,1.00,blue)
# Upper residence walls have broad legible blocks, no clutter along their cap.
for i,(a,b) in enumerate(zip(WEST,WEST[1:]+WEST[:1])):
    for j,z in enumerate([1.43,1.77,2.11]):
        masonry_edge('upper terrace course '+str(i)+'-'+str(j),a,b,z,.30,.065,.68,
                     blue if j==0 and i==0 else cream)

# The front arch ring has a separate, clearly cut set of voussoirs. These are
# full shallow stone blocks, attached to the spandrel behind the exposed face.
left,rightx=-3.58,-.68;cx=(left+rightx)/2;rr=(rightx-left)/2
for i in range(13):
    a=math.pi-math.pi*(i+.018)/13;b=math.pi-math.pi*(i+.982)/13
    inner=[(cx+math.cos(q)*rr,-2.552,-.10+math.sin(q)*.92) for q in [a,b]]
    outer=[(cx+math.cos(q)*(rr+.15),-2.552,-.10+math.sin(q)*1.095) for q in [a,b]]
    verts=[inner[0],inner[1],outer[1],outer[0]]
    back=[(x,y+.065,z) for x,y,z in verts]
    mesh('great bridge individually cut arch ring '+str(i),verts+back,
         [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],
         light if i%2 else cream)
# A short horizontal blue drip course emphasizes that the open arch carries the
# uninterrupted deck, while the entire view-facing parapet remains absent.
cube('great bridge blue under-deck drip course',(-2.13,-2.555,1.08),(3.25,.085,.09),blue,.012)
for x in [-3.77,-.50]:
    for z in [.16,.48]:
        cube('great bridge abutment mortar reveal',(x,-2.666,z),(.51,.015,.018),blue,.002)

# A warm oven mouth and a real little wood store make the house feel occupied.
fire=material('Oven amber flame',(1,.40,.035))
firehi=material('Oven yellow flame',(1,.86,.23))
for i,(dx,height) in enumerate([(-.20,.27),(0,.46),(.20,.32)]):
    yy=.338;zz=1.99
    mesh('oven individual warm flame '+str(i),[(2.5+dx-.095,yy,zz),(2.5+dx+.10,yy,zz),
                                              (2.5+dx+.055,yy,zz+height*.49),
                                              (2.5+dx-.02,yy,zz+height)],[(0,1,2,3)],fire)
    mesh('oven golden flame core '+str(i),[(2.5+dx-.055,yy-.008,zz),(2.5+dx+.055,yy-.008,zz),
                                          (2.5+dx,yy-.008,zz+height*.64)],[(0,1,2)],firehi)
cube('oven wood-store dark niche',(2.5,.415,1.47),(1.28,.028,.36),dark,.015)
for i,x in enumerate([2.13,2.37,2.62,2.86]):
    log=cyl('oven neatly stacked firewood',(x,.38,1.40+(i%2)*.025),.092,.35,wood,12)
    log.rotation_euler.x=math.pi/2
    end=cyl('oven visible cut log end',(x,.195,1.40+(i%2)*.025),.075,.016,roofhi,12)
    end.rotation_euler.x=math.pi/2
# The long-handled peel is attached beside the oven on its distant shoulder.
beam('oven peel timber handle',(3.55,1.12,1.28),(3.33,1.27,2.64),.028,wood)
peel=cube('oven peel rounded blade',(3.31,1.28,2.76),(.27,.06,.34),gold,.06)
peel.rotation_euler.y=-.16

# Two modest chairs share the quiet recess by the residence facade.
for x in [-4.78,-4.20]:
    for dx in [-.23,.23]:
        beam('couple chair arm',(x+dx,1.74,3.13),(x+dx,2.00,3.13),.025,wood)
        beam('couple chair rear leg',(x+dx*.70,1.99,2.51),(x+dx*.70,1.99,3.40),.022,wood)
# Small paired ceramic cups are the only couple motif; no new sign or character.
cube('couple side table',(-3.83,1.91,2.96),(.27,.28,.07),wood,.02)
beam('couple side table support',(-3.83,1.91,2.51),(-3.83,1.91,2.95),.038,wood)
for x in [-3.89,-3.77]:
    cyl('couple tiny ceramic cup',(x,1.91,3.025),.030,.07,white,12)


def garden_pot(name,x,y,z,r=.22,height=.43):
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=r*.73,radius2=r,depth=height,location=(x,y,z+height/2))
    obj=bpy.context.object;obj.name=name+' terracotta vessel';assign(obj,roofhi);bevel(obj,.014)
    cyl(name+' rounded rim',(x,y,z+height-.01),r+.03,.08,roofhi,24)
    shrub(name+' fresh foliage',x,y,z+height,.28,.25,.33)
    for dx,dy,mat in [(-.12,.04,white),(.10,.07,rose),(.01,-.12,rose)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.07,location=(x+dx,y+dy,z+height+.54))
        o=bpy.context.object;o.name=name+' restrained flowers';assign(o,mat)

garden_pot('oven herb pot',1.18,1.28,1.20,.22,.43)
garden_pot('east garden ceramic pot',5.78,1.35,1.20,.24,.52)
garden_pot('residence doorway pot',-2.65,2.28,2.505,.18,.36)

# Authored enrichment: architectural finish and planted recesses only.
# All walk geometry, camera, lights, actors and ferry ingress remain frozen.
claysoft=material('Sun washed clay tile',(0.80,.36,.23))
claydeep=material('Aged terracotta tile',(0.66,.245,.155))
soil=material('Rich herb garden soil',(.24,.22,.13))
sage=material('Silvery coastal sage',(.51,.64,.36))
lavender=material('Quiet lavender bloom',(.61,.44,.74))
bronze=material('Weathered lantern bronze',(.30,.29,.20),.25)

# Shallow interlocking terracotta courses add hand-built scale to the original roofs.
for label,x,y,z,w,d,rise in [('home',-4.18,2.77,4.46,3.07,2.12,.59),('cottage',2.80,2.40,3.10,3.22,2.03,.59)]:
    for side in [-1,1]:
        for row in range(4):
            t0=row/4; t1=(row+1)/4
            for col in range(14):
                xa=x-w/2+col*w/14+.042;xb=x-w/2+(col+1)*w/14-.042
                ya=y+side*d/2*(1-t0);yb=y+side*d/2*(1-t1)
                za=z+rise*t0+.009;zb=z+rise*t1+.009
                mat=[roof,roof,claysoft,roof,claydeep][(row*7+col*3)%5]
                mesh(label+' individual clay tile course',[(xa,ya,za),(xb,ya,za),(xb,yb,zb),(xa,yb,zb)],[(0,1,2,3)],mat)
            beam(label+' subtle overlap lip',(x-w/2,y+side*d/2*(1-t0),z+rise*t0+.018),(x+w/2,y+side*d/2*(1-t0),z+rise*t0+.018),.021,roof)
    beam(label+' timber eaves fascia',(x-w/2,y-d/2,z-.045),(x+w/2,y-d/2,z-.045),.055,wood)

# Carefully fitted corner quoins and shutter joinery enrich the two facades.
for name,x,y,z,w,d,h in [('home',-4.18,2.77,2.51,2.65,1.72,1.90),('cottage',2.80,2.40,1.20,2.80,1.63,1.85)]:
    for side in [-1,1]:
        for row in range(5):
            cube(name+' corner limestone quoin',(x+side*(w/2-.10),y-d/2-.026,z+.38+row*.29),(.23 if row%2 else .31,.08,.235),light,.014)
    for dx in [-w*.24,w*.24]:
        for sx in [-.28,.28]:
            for j in range(5):
                cube(name+' shutter recessed louvre',(x+dx+sx,y-d/2-.089,z+h*.58-.25+j*.12),(.107,.018,.027),blue,.006)
    # Discreet central wall lantern safely over the existing facade.
    lx=x; ly=y-d/2-.085; lz=z+1.00
    cube(name+' lantern backplate',(lx,ly,lz),(.13,.05,.29),bronze,.012)
    cube(name+' warm lantern glass',(lx,ly-.075,lz),(.10,.10,.18),gold,.012)
    cube(name+' lantern canopy',(lx,ly-.075,lz+.13),(.18,.16,.05),bronze,.015)

# One espalier on the home side wall, contained inside its silhouette.
for j in range(4):
    yy=2.19+j*.32
    beam('home side espalier upright',(-2.827,yy,2.70),(-2.827,yy,4.20),.018,wood)
for zz in [2.9,3.30,3.70,4.08]:
    beam('home side espalier rung',(-2.82,2.08,zz),(-2.82,3.26,zz),.018,wood)
for j in range(8):
    yy=2.16+(j%4)*.29; zz=2.95+(j//4)*.70+(j%2)*.16
    shrub('trained climbing vine',-2.80,yy,zz,.075,.19,.19)
    if j in [1,4,6]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.062,location=(-2.71,yy,zz+.14))
        assign(bpy.context.object,white);bpy.context.object.name='espalier small ivory blossom'

# Replace the five identical dots per bed with planted, varied flower heads.
for obj in list(bpy.data.objects):
    if 'pink and ivory blooms' in obj.name:
        bpy.data.objects.remove(obj,do_unlink=True)
for bed,x,y,z,w,d in [(0,5.50,.66,1.20,1.15,.55),(1,3.40,-2.50,1.20,1.15,.57),(2,1.0,-2.94,1.20,1.04,.49),(3,-4.4,-3.0,1.20,1.28,.45),(4,-3.95,1.76,2.51,1.05,.37),(5,-2.70,2.72,2.51,.54,.65),(6,4.60,1.35,1.20,.62,.92)]:
    for i in range(5):
        xx=x+(i-2)*w*.16; yy=y+(.065 if i%2 else -.065)
        height=.72+(i%3)*.035
        if bed in [0,2,6]:
            beam('garden lavender stem',(xx,yy,z+.43),(xx,yy,z+height+.13),.012,green)
            for k in range(3):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.048-k*.006,location=(xx,yy,z+height+k*.045))
                obj=bpy.context.object;obj.name='lavender flower spike';obj.scale=(.8,.8,1.2);assign(obj,lavender)
        else:
            for k in range(5):
                angle=k*2*math.pi/5
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.042,location=(xx+.045*math.cos(angle),yy+.045*math.sin(angle),z+height))
                obj=bpy.context.object;obj.name='garden open flower petal';obj.scale.z=.53;assign(obj,white if i%2==0 else rose)
            cyl('garden flower golden center',(xx,yy,z+height+.015),.022,.027,gold,10)

# Baker's work shelf attached behind the oven, clear of the approach and stairs.
cube('oven cottage flour shelf',(3.64,1.53,1.92),(.62,.36,.10),wood,.020)
for xx in [3.40,3.86]:
    beam('flour shelf wall bracket',(xx,1.67,1.58),(xx,1.38,1.86),.025,bronze)
cyl('bakery ivory flour jar',(3.73,1.53,2.10),.11,.26,white,20)
cyl('bakery terracotta jar lid',(3.73,1.53,2.245),.125,.04,roofhi,20)
cube('bakers folded linen',(3.48,1.53,1.996),(.22,.22,.035),white,.015)

scene = bpy.context.scene
bpy.ops.object.camera_add(location=(11, -20, 17.5))
cam = bpy.context.object
target = Vector((0, .25, 2.25))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 20.6
scene.camera = cam
world = bpy.data.worlds.new('Warm coastal air')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.58, .69, .88, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55
for name, loc, power, size, color in [('warm key', (-8, -10, 19), 2400, 9, (1, .83, .65)),
                                      ('coastal fill', (8, 3, 13), 1700, 8, (.67, .80, 1)),
                                      ('coastal rim', (-4, 10, 17), 1800, 7, (.80, .92, 1))]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = power
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.data.color = color
    obj.rotation_euler = (Vector((0, 0, 2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48 if FINAL else 8
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 4
scene.render.resolution_x = 1920
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100 if FINAL else 50
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .30
bpy.context.view_layer.update()


def project(point):
    p = world_to_camera_view(scene, cam, Vector(point))
    return {'x': round(p.x, 6), 'y': round(1 - p.y, 6)}


meta = {'version':1, 'world':6, 'status':'frozen-authored-base-island',
        'size':{'width':1920,'height':1200},
        'camera':{'position':list(cam.location),'target':list(target),'orthoScale':20.6},
        'placementProposal':{'origin':{'x':1.5,'y':-1.8},'scale':1},
        'nodes':{key:{**project(p),'world':p,'clearingRadius':1.0 if key=='6-1' else .90} for key,p in NODES.items()},
        'routes':{str(i)+':'+str(i+1):[project(p) for p in route] for i,route in enumerate(MAIN)},
        'secretRoute':[project(p) for p in SECRET],
        'worldRoutes':{'main':[{'from':'6-'+str(i+1),'to':'6-'+str(i+2),'world':path,
                               'movement':'walk','width':1.44} for i,path in enumerate(MAIN)],
                       'secret':[{'from':'6-3','to':'6-5','world':SECRET,'movement':'walk','width':1.34}],
                       'entryApproach':[{'from':'6-1','world':ENTRY['approach'],'movement':'walk','width':1.30}]},
        'futureEntry':ENTRY,
        'secretDesign':'Open exterior back passage with a supported service ascent; bypasses6-4.',
        'campaignSources':['docs/world/campanha.md:M6','docs/world/conceitos/imagens/06-dominio-pizzarino.png',
                           'docs/world/conceitos/imagens/13-arquipelago.png']}
length3=lambda points:sum((Vector(b)-Vector(a)).length for a,b in zip(points,points[1:]))
meta['routeDurationsSeconds']={str(i)+':'+str(i+1):round(length3(path)/1.73,6) for i,path in enumerate(MAIN)}
meta['secretDurationSeconds']=round(length3(SECRET)/1.73,6)
meta['entryApproachDurationSeconds']=round(length3(ENTRY['approach'])/1.73,6)
meta['timingCalibration']={'walkWorldUnitsPerSecond':1.73,'source':'Same real-world pace as released Serra and Reserva routes.'}

# Use the exact source-authored sprite, never a proxy human or resized world actor.
source = json.loads(subprocess.check_output(['node', ROOT + '/tools/diorama/export_serra_sprite.mjs'], text=True))
json.dump(source, open(os.path.join(OUT, 'dominio-sprite-source.json'), 'w'), indent=2)
pixel = source['pixelMapWidth'] * cam.data.ortho_scale
meta['fekaScale'] = {'source': source['source'], 'pixelMapWidth': source['pixelMapWidth'],
                     'worldPixelWidth': pixel, 'projectedHeightAt1920': 26 * source['pixelMapWidth'] * 1920}
scene['dominio_metadata'] = json.dumps(meta)
json.dump(meta, open(os.path.join(OUT, 'dominio-prototype.meta.json'), 'w'), indent=2)
assert all(mod.type != 'BOOLEAN' for obj in scene.objects for mod in obj.modifiers)

if not BUILD_ONLY:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'dominio-prototype.blend'))
    scene.render.filepath = os.path.join(OUT, 'dominio-diorama.png' if '--static' in ARGS else 'dominio-craft.png')
    bpy.ops.render.render(write_still=True)

if not BUILD_ONLY and '--static' not in ARGS:
    # Actual pixel geometry is upright in world-space and projected exactly like
    # the runtime actor; it participates in depth so this proof reveals obstruction.
    palette_text = open(ROOT + '/src/graphics/palette.ts').read()
    colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", palette_text))
    player_text = open(ROOT + '/src/assets/playerSpriteSpec.ts').read()
    mapping = dict(re.findall(r'(\w): ART\.(\w+)', player_text))
    mats = {}
    for symbol, key in mapping.items():
        hexcolor = colors[key].lstrip('#')
        m = material('original Feka pixel ' + symbol, tuple(int(hexcolor[i:i + 2], 16) / 255 for i in (0, 2, 4)))
        m.node_tree.nodes.clear()
        emission = m.node_tree.nodes.new('ShaderNodeEmission')
        emission.inputs[0].default_value = m.diffuse_color
        out = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(emission.outputs[0], out.inputs['Surface'])
        mats[symbol] = m
    basis = cam.rotation_euler.to_matrix()
    right = basis @ Vector((1, 0, 0))
    up = basis @ Vector((0, 1, 0))
    toward = basis @ Vector((0, 0, 1))
    for key, foot in {**NODES, 'bridge':(-2.20,-1.80,1.35), 'service':(-.12,.35,2.0625), 'ascent':(-5.55,-.20,2.189189189), 'entry':(6.10,-2.4,1.35)}.items():
        foot = Vector(foot) + toward * .008
        for y, row in enumerate(source['frames']['idle']):
            for x, symbol in enumerate(row):
                if symbol == '_':
                    continue
                a = foot + right * ((x - 8) * pixel) + Vector((0, 0, (25 - y) * pixel / up.z))
                b = a + right * pixel
                c = b + Vector((0, 0, pixel / up.z))
                d = a + Vector((0, 0, pixel / up.z))
                actor = mesh('proof_' + key + ' original Feka', [a, b, c, d], [(0, 1, 2, 3)], mats[symbol])
                actor.visible_shadow = False
    scene.render.filepath = os.path.join(OUT, 'dominio-craft-feka.png')
    bpy.ops.render.render(write_still=True)
    print('DOMINIO_CRAFT=' + scene.render.filepath)
