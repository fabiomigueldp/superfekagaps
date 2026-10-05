"""Small, editable architectural vocabulary for the third island model.

All surfaces are geometry. No generated illustration is used as the map render.
Coordinates inside a site are local; a single parent locates/rotates the building.
"""
import bpy, math, random
from mathutils import Vector

TAU = math.tau
M = {}
ACTIVE = None
COLLECTION = None
TEMPLATES = {}


def linear(hex_value):
    rgb = [int(hex_value.strip('#')[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def material(name, color, roughness=.75, metallic=0, grain=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear(color), 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = m.diffuse_color
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    if grain:
        n = m.node_tree.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = 13
        n.inputs['Detail'].default_value = 3
        b = m.node_tree.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = .19
        b.inputs['Distance'].default_value = grain
        m.node_tree.links.new(n.outputs['Fac'], b.inputs['Height'])
        m.node_tree.links.new(b.outputs['Normal'], p.inputs['Normal'])
    M[name] = m
    return m


def collection(name):
    global COLLECTION, ACTIVE
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    COLLECTION = c
    ACTIVE = None
    return c


def site(name, p=(0, 0, 0), angle=0):
    global ACTIVE
    o = bpy.data.objects.new(name, None)
    COLLECTION.objects.link(o)
    o.location = p
    o.rotation_euler.z = angle
    ACTIVE = o
    return o


def end_site():
    global ACTIVE
    ACTIVE = None


def mesh(name, verts, faces, mat, p=(0, 0, 0), indices=None, smooth=False):
    d = bpy.data.meshes.new(name)
    d.from_pydata(verts, [], faces)
    d.update()
    o = bpy.data.objects.new(name, d)
    COLLECTION.objects.link(o)
    if ACTIVE:
        o.parent = ACTIVE
    o.location = p
    mats = mat if isinstance(mat, list) else [mat]
    for m in mats:
        d.materials.append(M[m] if isinstance(m, str) else m)
    for i, face in enumerate(d.polygons):
        face.use_smooth = smooth
        if indices:
            face.material_index = indices[i]
    return o


def bevel(o, radius=.04, segments=2):
    if radius:
        mod = o.modifiers.new('Soft masonry edges', 'BEVEL')
        mod.width = radius
        mod.segments = segments
        mod = o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return o


def box(name, p, dims, mat, edge=.025):
    x, y, z = (d/2 for d in dims)
    verts = [(-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z),
             (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z)]
    return bevel(mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),
                       (1,2,6,5),(2,3,7,6),(3,0,4,7)], mat, p), edge)


def lathe(name, p, profile, mat, n=40, caps=True):
    verts = [(r*math.cos(i*TAU/n), r*math.sin(i*TAU/n), z)
             for r,z in profile for i in range(n)]
    faces = []
    for j in range(len(profile)-1):
        faces.extend((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n))
    if caps:
        faces += [tuple(reversed(range(n))), tuple((len(profile)-1)*n+i for i in range(n))]
    o = mesh(name, verts, faces, mat, p, smooth=True)
    if caps:
        o.data.polygons[-1].use_smooth = False
        o.data.polygons[-2].use_smooth = False
    return o


def cyl(name, p, radius, height, mat, n=24, r2=None):
    return lathe(name, p, [(radius,-height/2),(radius if r2 is None else r2,height/2)], mat,n)


def pipe(name, points, radius, mat, cyclic=False, resolution=2):
    d = bpy.data.curves.new(name, 'CURVE')
    d.dimensions = '3D'
    d.bevel_depth = radius
    d.bevel_resolution = resolution
    sp = d.splines.new('POLY')
    sp.points.add(len(points)-1)
    for a,b in zip(sp.points, points):
        a.co = (*b,1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name,d)
    COLLECTION.objects.link(o)
    if ACTIVE:
        o.parent = ACTIVE
    d.materials.append(M[mat])
    return o


def beam(name, a, b, radius, mat, n=12):
    a,b = Vector(a), Vector(b)
    o = cyl(name,(a+b)*.5,radius,(b-a).length,mat,n)
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return o


def ring(name, p, radius, thickness, mat, vertical=False, n=64):
    pts = [(p[0]+radius*math.cos(i*TAU/n),p[1]+(0 if vertical else radius*math.sin(i*TAU/n)),
            p[2]+(radius*math.sin(i*TAU/n) if vertical else 0)) for i in range(n)]
    return pipe(name,pts,thickness,mat,True)


def organic(name, p, scale, mat, seed=0, irregular=.13, sub=2, smooth=True):
    key = (sub,seed%11,round(irregular,3))
    if key not in TEMPLATES:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1)
        src = bpy.context.object
        d = src.data.copy()
        rr = random.Random(seed%11)
        for v in d.vertices:
            v.co *= 1+rr.uniform(-irregular,irregular)
        bpy.data.objects.remove(src,do_unlink=True)
        TEMPLATES[key] = d
    d = TEMPLATES[key].copy()
    d.materials.clear()
    mats=mat if isinstance(mat,list) else [mat]
    for m in mats:
        d.materials.append(M[m])
    rr=random.Random(seed)
    # Variation belongs to a whole leaf cluster / rock, not unrelated triangles.
    color=rr.randrange(len(mats))
    for f in d.polygons:
        f.use_smooth=smooth
        f.material_index=color
    o=bpy.data.objects.new(name,d)
    COLLECTION.objects.link(o)
    if ACTIVE:o.parent=ACTIVE
    o.location=p
    o.scale=scale
    return o


def extrude_xz(name, poly, y, depth, mat):
    n=len(poly)
    verts=[(x,yy,z) for yy in (y,y+depth) for x,z in poly]
    return mesh(name,verts,[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
                +[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)


def arch_panel(name, x,y,z, w,h, mat, depth=.05):
    r=w/2
    poly=[(x-r,z),(x+r,z)]+[(x+r*math.cos(i*math.pi/16),z+h-r+r*math.sin(i*math.pi/16)) for i in range(17)]
    return extrude_xz(name,poly,y,depth,mat)


def arch_frame(name,x,y,z,w,h,t=.12,depth=.16,mat='limestone'):
    # Individually jointed voussoirs, assembled into a single editable mesh.
    verts=[];faces=[];ids=[]
    def piece(poly,mid):
        k=len(verts);n=len(poly)
        verts.extend((xx,yy,zz) for yy in (y,y+depth) for xx,zz in poly)
        ff=[tuple(k+i for i in reversed(range(n))),tuple(k+n+i for i in range(n))]
        ff += [(k+i,k+(i+1)%n,k+(i+1)%n+n,k+i+n) for i in range(n)]
        faces.extend(ff);ids.extend([mid]*len(ff))
    r=w/2;spring=z+h-r
    for i in range(11):
        a=i*math.pi/11+.012;b=(i+1)*math.pi/11-.012
        piece([(x+r*math.cos(a),spring+r*math.sin(a)),(x+(r+t)*math.cos(a),spring+(r+t)*math.sin(a)),
               (x+(r+t)*math.cos(b),spring+(r+t)*math.sin(b)),(x+r*math.cos(b),spring+r*math.sin(b))],i%3)
    for side in (-1,1):
        for i in range(4):
            za=z+(spring-z)*i/4+.008;zb=z+(spring-z)*(i+1)/4-.008
            xx=x+side*r
            piece([(xx,za),(xx+side*t,za),(xx+side*t,zb),(xx,zb)],i%3)
    return mesh(name,verts,faces,[mat,'stone-light','stone-warm'],indices=ids)


def window(x,y,z,w=.48,h=.9,shutters=True,balcony=False):
    arch_panel('Recessed arched window',x,y,z,w,h,'recess')
    arch_frame('Carved window surround',x,y-.018,z,w,h,.08,.075)
    box('Window centre mullion',(x,y-.04,z+h*.48),(.025,.04,h*.86),'wood-dark',0)
    box('Stone window sill',(x,y-.09,z-.04),(w+.23,.23,.11),'stone-light')
    if shutters:
        for side in (-1,1):
            sx=x+side*(w*.7)
            box('Teal shutter frame',(sx,y-.07,z+h*.43),(w*.32,.07,h*.84),'shutter',.01)
            for k in range(6):
                box('Shutter louvre',(sx,y-.12,z+.09+k*h*.12),(w*.29,.06,.06),'shutter-light',.008)
    if balcony:
        box('Juliet balcony',(x,y-.24,z-.06),(w+.5,.48,.14),'limestone')
        for i in range(7):beam('Balcony iron spindle',(x-w/2-.15+i*(w+.3)/6,y-.46,z),(x-w/2-.15+i*(w+.3)/6,y-.46,z+.45),.014,'iron',8)
        beam('Balcony handrail',(x-w/2-.18,y-.46,z+.46),(x+w/2+.18,y-.46,z+.46),.025,'iron')


def door(x,y,z,w=.8,h=1.55):
    arch_panel('Deep doorway shadow',x,y,z,w,h,'recess',.08)
    arch_panel('Timber arched door',x,y-.015,z+.02,w*.84,h*.94,'wood',.03)
    arch_frame('Door cut stone',x,y-.045,z,w,h,.14,.15)
    for xx in (x-w*.23,x,x+w*.23):
        box('Door plank seam',(xx,y-.05,z+h*.43),(.018,.015,h*.78),'wood-dark',0)
    ring('Brass door ring',(x+w*.2,y-.08,z+.65),.065,.017,'brass',True,20)
    box('Entry threshold',(x,y-.2,z),(w+.42,.55,.12),'limestone')


def tiled_roof(name, w,d,z,rise, mat='tile', hip=False):
    e=.22;wx=w/2+e;dy=d/2+e
    # Ridge and eave surfaces support every individual barrel tile.
    ridge=wx-.65 if hip else wx
    verts=[(-wx,-dy,z),(wx,-dy,z),(wx,dy,z),(-wx,dy,z),(-ridge,0,z+rise),(ridge,0,z+rise)]
    mesh(name+' roof underlay',verts,[(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)],mat)
    verts=[];faces=[];indices=[]
    cols=max(9,round(w/.19));rows=max(4,round(dy/.34))
    pitch=w/cols;rr=random.Random(int(w*d*100))
    for side in (-1,1):
        for row in range(rows):
            y0=side*(row/rows)*dy;y1=side*min(dy,(row+1.12)/rows*dy)
            for col in range(cols+2):
                x=-wx+(col+.35)*pitch
                if hip and abs(x)>ridge+(abs(y0)/dy)*.65-.05:continue
                base=len(verts)
                for yy in (y0,y1):
                    for j in range(7):
                        a=j*math.pi/6
                        verts.append((x+math.cos(a)*pitch*.55,yy,z+rise*(1-abs(yy)/dy)+.025+math.sin(a)*pitch*.28))
                color=rr.randrange(5)
                for j in range(6):faces.append((base+j,base+j+1,base+j+8,base+j+7));indices.append(color)
    mesh(name+' individually curved tiles',verts,faces,[mat+str(i) for i in range(5)],indices=indices,smooth=True)
    beam('Terracotta ridge cap',(-ridge,0,z+rise+.04),(ridge,0,z+rise+.04),.08,mat+'2',12)
    for side in (-1,1):
        box('Carved eave band',(0,side*dy,z-.025),(w+.52,.13,.12),'stone-light')
        for i in range(max(4,int(w/.42))):
            box('Timber roof corbel',(-w/2+.2+i*.42,side*(dy-.06),z-.13),(.09,.28,.16),'wood-dark',.01)


def house(name,p,w=2.8,d=2.1,h=3.1,angle=0,wall='plaster',floors=2,roof='tile',balconies=False):
    site(name,p,angle)
    box('Foundation',(0,0,-.35),(w+.17,d+.17,1.35),'stone-warm',.05)
    box('Limewashed walls',(0,0,h/2+.18),(w,d,h),wall,.045)
    for z in (.35,h+.08):box('Facade stone stringcourse',(0,-d/2-.04,z),(w+.11,.12,.14),'limestone')
    for side in (-1,1):
        for i in range(int(h/.34)):
            box('Dressed corner quoin',(side*(w/2-.08),-d/2-.036,.5+i*.33),(.23,.11,.22),'stone-light',.012)
    door(0,-d/2-.065,.33,.68,min(1.42,h*.58))
    if floors==2:
        for x in (-w*.29,w*.29):window(x,-d/2-.065,h*.58,.46,.83,True,balconies)
    elif w>2.6:window(-w*.28,-d/2-.06,.88,.44,.66)
    # A second visible facade prevents the buildings reading as stage flats.
    front=ACTIVE
    side_group=site('Right return elevation',(w/2+.06,0,0),math.pi/2)
    side_group.parent=front
    for x in (-d*.23,d*.23):window(x,0,h*.57,.43,.8,True)
    global_parent(front)
    for label,location,angle,width in [('Left return elevation',(-w/2-.06,0,0),-math.pi/2,d),('Rear elevation',(0,d/2+.06,0),math.pi,w)]:
        side_group=site(label,location,angle)
        side_group.parent=front
        for x in (-width*.23,width*.23):window(x,0,h*.57,.43,.8,True)
        global_parent(front)
    tiled_roof(name,w,d,h+.22,.72 if floors==2 else .55,roof)
    box('Lime chimney',(-w*.29,.3,h+1.03),(.34,.34,.7),'plaster')
    box('Chimney coping',(-w*.29,.3,h+1.41),(.46,.43,.11),'limestone')
    box('Chimney dark mouth',(-w*.29,.3,h+1.47),(.27,.23,.015),'recess',0)
    end_site()


def global_parent(parent):
    global ACTIVE
    ACTIVE=parent


def railing(name, points, height=.7, mat='limestone', spacing=.5):
    pipe(name+' coping',[(x,y,z+height) for x,y,z in points],.055,mat)
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b);n=max(1,round((b-a).length/spacing))
        for i in range(n):
            p=a+(b-a)*(i/n)
            lathe(name+' turned baluster',p,[(.08,0),(.06,.1),(.038,height*.55),(.066,height*.8),(.055,height)],mat,8)


def stairs(name,a,b,width,steps,mat='limestone'):
    a,b=Vector(a),Vector(b);delta=b-a;horizontal=Vector((delta.x,delta.y,0));length=horizontal.length
    angle=math.atan2(delta.y,delta.x)-math.pi/2
    for i in range(steps):
        p=a+delta*((i+.5)/steps)
        top=a.z+delta.z*(i+1)/steps
        h=.16+max(.01,abs(delta.z)/steps)
        o=box(name,(p.x,p.y,top-h/2),(width,length/steps+.05,h),mat,.014);o.rotation_euler.z=angle
