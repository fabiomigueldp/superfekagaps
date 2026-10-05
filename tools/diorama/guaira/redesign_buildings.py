"""Structural Guaíra building pass, after the terrain/Bairro/craft passes.

Existing building positions, roof silhouettes and route geometry are retained.
Repairs close measured footing and roof gaps with actual load-bearing geometry:
seated foundations and doorsteps, closed roof gables, joined porch, tank legs,
braced workshop/windpump, and an accessible reservoir maintenance platform.
The campaign builder calls ground_campaign_shelter after authoring its shelter.
"""
import math as _gb_math
from mathutils import Vector as _GBVector
from mathutils.bvhtree import BVHTree as _GBBVHTree


def _gb_mesh(name, vertices, faces, material, bevel_width=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    data.materials.append(material)
    if bevel_width:
        edge = ob.modifiers.new('Small structural arris', 'BEVEL')
        edge.width = bevel_width
        edge.segments = 2
        ob.modifiers.new('Structural normals', 'WEIGHTED_NORMAL')
    return ob


def _gb_box(name, center, dimensions, material, bevel_width=.012):
    x,y,z = center
    a,b,c = [v/2 for v in dimensions]
    vertices = [(x+sx*a,y+sy*b,z+sz*c)
                for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
                                 (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return _gb_mesh(name,vertices,[(0,4,6,2),(1,3,7,5),(0,1,5,4),
                                  (2,6,7,3),(0,2,3,1),(4,5,7,6)],material,bevel_width)


def _gb_beam(name, a, b, radius, material, sides=10):
    a,b = _GBVector(a),_GBVector(b)
    axis = (b-a).normalized()
    reference = _GBVector((0,0,1)) if abs(axis.z)<.9 else _GBVector((0,1,0))
    u = axis.cross(reference).normalized()*radius
    v = axis.cross(u).normalized()*radius
    vertices = [tuple(p+u*_gb_math.cos(k*_gb_math.tau/sides)+v*_gb_math.sin(k*_gb_math.tau/sides))
                for p in [a,b] for k in range(sides)]
    faces = [tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    faces += [(k,(k+1)%sides,(k+1)%sides+sides,k+sides) for k in range(sides)]
    return _gb_mesh(name,vertices,faces,material)


def _gb_remove(*prefixes):
    for ob in list(bpy.data.objects):
        if any(ob.name.startswith(prefix) for prefix in prefixes):
            bpy.data.objects.remove(ob,do_unlink=True)


def _gb_lower_box(ob, bottom):
    """Deepen the actual footing mesh, preserving its authored upper surface."""
    world = [ob.matrix_world@v.co for v in ob.data.vertices]
    low = min(p.z for p in world)
    inverse = ob.matrix_world.inverted()
    for vertex,point in zip(ob.data.vertices,world):
        if abs(point.z-low)<.00001:
            point.z=bottom
            vertex.co=inverse@point
    ob.data.update()


def _gb_support_tree():
    # Only load-bearing terrain. Props, water, roofs and paths cannot disguise
    # a missing ground contact by satisfying the downward support probe.
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    vertices=[];faces=[]
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or ob.hide_render:
            continue
        if not ob.name.startswith(('Continuous clay island','Civic terrace','Reservoir support',
                                   'Civic continuous earthen ascent','Redesign terrain','Guaíra terrain','Guaira terrain')):
            continue
        evaluated=ob.evaluated_get(deps)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        offset=len(vertices)
        vertices += [evaluated.matrix_world@v.co for v in data.vertices]
        faces += [tuple(offset+i for i in tri.vertices) for tri in data.loop_triangles]
        evaluated.to_mesh_clear()
    return _GBBVHTree.FromPolygons(vertices,faces,all_triangles=True)


_gb_ground = _gb_support_tree()


def _gb_ground_height(x,y):
    point,normal,index,distance=_gb_ground.ray_cast(_GBVector((x,y,6)),_GBVector((0,0,-1)),8)
    if point is None:
        raise AssertionError('Missing building support terrain at '+str((x,y)))
    return point.z


# Footings are the existing masonry courses made structurally continuous down
# to the village substrate. Thresholds become solid single doorsteps, not lips.
_gb_houses=[('Neighborhood home',-4.4,1.4,1.8,1.3,.92,1.0),
            ('Repair shop',-2.7,1.35,1.8,1.2,.9,.85),
            ('Small granary',-5.3,2.6,1.8,.95,.8,.8),
            ('Casa da Vazao',.6,3.9,2.4,2.3,1.15,1.55)]
for _gb_n,_gb_x,_gb_y,_gb_z,_gb_w,_gb_d,_gb_h in _gb_houses:
    for _gb_ob in list(bpy.data.objects):
        if _gb_ob.name.startswith((_gb_n+' foundation',_gb_n+' dressed front footing',
                                  _gb_n+' dressed side footing',_gb_n+' threshold')):
            _gb_lower_box(_gb_ob,2.38 if _gb_n=='Casa da Vazao' else 1.73)
    # The old wall stopped at eave height while the roof rose above its face,
    # leaving open triangular roof ends and horizontal gaps behind the rafters.
    _gb_roof=bpy.data.objects[_gb_n+' gabled roof']
    _gb_solid=_gb_roof.modifiers.new('Load-bearing roof deck thickness','SOLIDIFY')
    _gb_solid.thickness=.034
    _gb_solid.offset=-1
    _gb_half=_gb_d/2+.14
    _gb_peak=_gb_z+_gb_h+.37-.033
    _gb_edge=_gb_z+_gb_h+.37*(1-(_gb_d/2)/_gb_half)-.033
    _gb_profile=[(_gb_y-_gb_d/2,_gb_z+_gb_h-.035),
                 (_gb_y+_gb_d/2,_gb_z+_gb_h-.035),
                 (_gb_y+_gb_d/2,_gb_edge),(_gb_y,_gb_peak),
                 (_gb_y-_gb_d/2,_gb_edge)]
    _gb_vertices=[(xx,yy,zz) for xx in [_gb_x-_gb_w/2,_gb_x+_gb_w/2] for yy,zz in _gb_profile]
    _gb_wall=bpy.data.objects[_gb_n+' plaster'].data.materials[0]
    _gb_mesh(_gb_n+' closed load-bearing gable',_gb_vertices,
             [(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],_gb_wall)
    # Pitched rafters now meet the roof deck and the wall plate, instead of
    # hovering beside flat eave blocks. Their extent stays within existing eaves.
    _gb_remove(_gb_n+' exposed eave rafter')
    for _gb_k in range(5):
        _gb_xx=_gb_x-_gb_w*.44+_gb_k*_gb_w*.22
        for _gb_side in [-1,1]:
            _gb_a=(_gb_xx,_gb_y+_gb_side*(_gb_d/2-.055),_gb_edge-.045+.034)
            _gb_b=(_gb_xx,_gb_y+_gb_side*(_gb_d/2+.135),_gb_z+_gb_h-.040)
            _gb_beam(_gb_n+' seated eave rafter',_gb_a,_gb_b,.032,timber)

# Existing civic porch stones now enter the civic substrate. Its entablature
# bears on the capitals, and a short pitched roof joins the porch to the hall.
for _gb_ob in list(bpy.data.objects):
    if _gb_ob.name.startswith(('Porch column foot','Civic base plinth')):
        _gb_lower_box(_gb_ob,2.38)
_gb_lower_box(bpy.data.objects['Civic porch entablature'],3.455)
_gb_roof_vertices=[(-.66,2.91,3.805),(1.86,2.91,3.805),(1.86,3.40,3.975),(-.66,3.40,3.975)]
_gb_porchoof=_gb_mesh('Civic joined porch roof',_gb_roof_vertices,[(0,1,2,3)],roof)
_gb_solid=_gb_porchoof.modifiers.new('Porch clay deck thickness','SOLIDIFY')
_gb_solid.thickness=.034;_gb_solid.offset=-1
for _gb_xx in [-.45,.6,1.65]:
    _gb_beam('Civic porch roof joist',(_gb_xx,3.02,3.785),(_gb_xx,3.37,3.910),.043,timber)
# Seat the pediment's lower edge into the porch roof/cornice rather than leave
# the previous 12.5 mm slit beneath its base.
_gb_lower_box(bpy.data.objects['Civic central triangular pediment'],3.797)
_gb_box('Civic entrance stone step',(.094,3.285,2.439),(.46,.26,.118),stone,.014)

# The sealed tank is elevated on a compact four-legged cradle; the tank itself
# remains at its authored elevation, distinct from clean irrigation water.
for _gb_dx in [-.17,.17]:
    for _gb_dy in [-.17,.17]:
        _gb_box('Tank grounded stone foot',(-1+_gb_dx,3.8+_gb_dy,2.435),(.13,.13,.11),wetstone,.014)
        _gb_beam('Tank load-bearing bronze leg',(-1+_gb_dx,3.8+_gb_dy,2.47),(-1+_gb_dx,3.8+_gb_dy,2.64),.034,brass)
for _gb_dy in [-.17,.17]:
    _gb_beam('Tank supporting saddle',(-1.25,3.8+_gb_dy,2.615),(-.75,3.8+_gb_dy,2.615),.046,wood)

# Reconstruct the workshop's real timber frame under the existing canvas. The
# previous posts missed its sloping roof by 26–29 mm and the side rails laterally.
_gb_remove('Repair bay timber post','Repair bay side brace','Repair bay front lintel','Workbench legs')
_gb_bx,_gb_by=-1.69,1.46
_gb_canvas=bpy.data.objects['Repair bay sage canvas']
_gb_solid=_gb_canvas.modifiers.new('Canvas folded thickness','SOLIDIFY');_gb_solid.thickness=.012;_gb_solid.offset=-1
for _gb_dx in [-.43,.43]:
    for _gb_dy in [-.43,.43]:
        _gb_top=2.48+(_gb_dy+.52)*(.18/1.01)
        _gb_beam('Repair bay seated timber post',(_gb_bx+_gb_dx,_gb_by+_gb_dy,1.73),(_gb_bx+_gb_dx,_gb_by+_gb_dy,_gb_top-.015),.043,wood)
    _gb_beam('Repair bay pitched roof bearer',(_gb_bx+_gb_dx,_gb_by-.52,2.437),(_gb_bx+_gb_dx,_gb_by+.49,2.617),.036,timber)
for _gb_dy in [-.43,.43]:
    _gb_top=2.48+(_gb_dy+.52)*(.18/1.01)-.045
    _gb_beam('Repair bay connected crossbeam',(_gb_bx-.47,_gb_by+_gb_dy,_gb_top),(_gb_bx+.47,_gb_by+_gb_dy,_gb_top),.037,timber)
    # Short corner knee braces leave the open work bay readable.
    for _gb_dx in [-.43,.43]:
        _gb_beam('Repair bay knee brace',(_gb_bx+_gb_dx,_gb_by+_gb_dy,_gb_top-.25),(_gb_bx+_gb_dx*.45,_gb_by+_gb_dy,_gb_top),.024,timber)
for _gb_dx in [-.31,.31]:
    for _gb_dy in [-.125,.125]:
        _gb_beam('Workbench four grounded legs',(_gb_bx+_gb_dx,_gb_by+.16+_gb_dy,1.73),(_gb_bx+_gb_dx,_gb_by+.16+_gb_dy,2.12),.034,wood)

# Windpump: the four timber legs enter the ground and meet a head frame. Its
# rotor now has a bearing and mast rather than hanging above four loose sticks.
_gb_remove('Windpump timber leg','Windpump cross brace')
for _gb_dx in [-.22,.22]:
    for _gb_dy in [-.2,.2]:
        _gb_beam('Windpump grounded timber leg',(-3.7+_gb_dx,3.1+_gb_dy,1.73),(-3.7+_gb_dx*.55,3.1+_gb_dy*.55,3.6),.042,wood)
for _gb_height in [.45,.95,1.45]:
    _gb_f=(_gb_height+.07)/1.87
    _gb_span=.22*(1-.45*_gb_f)
    _gb_yy=3.1-.2*(1-.45*_gb_f)
    _gb_beam('Windpump fitted front diagonal',(-3.7-_gb_span,_gb_yy,1.73+_gb_height),(-3.7+_gb_span*.91,_gb_yy+.02,1.73+_gb_height+.31),.026,timber)
for _gb_yy in [2.99,3.21]:
    _gb_beam('Windpump head frame',(-3.85,_gb_yy,3.59),(-3.55,_gb_yy,3.59),.043,wood)
_gb_beam('Windpump mast seat',(-3.7,2.99,3.59),(-3.7,3.21,3.59),.043,wood)
_gb_beam('Windpump bearing mast',(-3.7,3.1,3.54),(-3.7,3.1,3.79),.045,wood)
_gb_box('Windpump axle bearing',(-3.7,3.075,3.75),(.17,.13,.17),wood,.012)

# Re-seat the manifold's support shoes on actual terrain, not an arbitrary
# elevation. The old center shoe was buried, while the west upright floated.
_gb_remove('Pipe support bracket','Bronze pipe masonry shoe','Bronze pipe twin bracket')
for _gb_x,_gb_y,_gb_top in [(2.8,3.7,3.0),(3.42,3.0,2.8),(4.09,3.0,2.8)]:
    _gb_bottom=_gb_ground_height(_gb_x,_gb_y)-.015
    _gb_shoe_top=min(_gb_top-.075,_gb_bottom+.145)
    _gb_box('Manifold grounded masonry shoe',(_gb_x,_gb_y,(_gb_bottom+_gb_shoe_top)/2),(.23,.24,_gb_shoe_top-_gb_bottom),wetstone,.014)
    for _gb_dx in [-.07,.07]:
        _gb_beam('Manifold seated bronze upright',(_gb_x+_gb_dx,_gb_y,_gb_shoe_top-.016),(_gb_x+_gb_dx,_gb_y,_gb_top+.015),.025,patina)
    _gb_beam('Manifold pipe saddle',(_gb_x-.13,_gb_y,_gb_top-.036),(_gb_x+.13,_gb_y,_gb_top-.036),.038,wood)
_gb_beam('Civic pipe wall socket',(1.72,3.7,3.0),(1.945,3.7,3.0),.067,brass)
_gb_beam('Reservoir immersed bronze inlet',(4.1,3.0,2.61),(4.1,3.0,2.82),.062,brass)

# The previous five service boards were buried in the reservoir rock/basin.
# This narrow timber platform is genuinely outside the basin, with four legs,
# two bearers, knee braces, and four seated steps to the eastern dry ground.
_gb_remove('Reservoir bank service board','Reservoir deck support')
for _gb_i in range(6):
    _gb_box('Reservoir accessible service board',(5.85,2.515+_gb_i*.105,2.574),(.44,.092,.052),timber,.008)
for _gb_x in [5.69,6.01]:
    _gb_beam('Reservoir service deck bearer',(_gb_x,2.46,2.523),(_gb_x,3.10,2.523),.040,wood)
    for _gb_y in [2.51,3.04]:
        # A reservoir shoulder can drop sharply within one post footprint.
        # Seat below the lowest of nine foot-area samples, not merely its center.
        _gb_bottom=min(_gb_ground_height(_gb_x+dx,_gb_y+dy)
                       for dx in [-.055,0,.055] for dy in [-.055,0,.055])-.020
        _gb_beam('Reservoir grounded deck post',(_gb_x,_gb_y,_gb_bottom),(_gb_x,_gb_y,2.55),.037,wood)
        _gb_beam('Reservoir deck knee brace',(_gb_x,_gb_y,2.23),(_gb_x,2.78,2.523),.025,timber)
for _gb_i in range(4):
    _gb_y=1.79+_gb_i*.18
    _gb_top=1.965+_gb_i*.21
    _gb_box('Reservoir access stair tread',(5.85,_gb_y,_gb_top-.024),(.43,.19,.048),timber,.007)
for _gb_x in [5.69,6.01]:
    _gb_beam('Reservoir access stair stringer',(_gb_x,1.68,1.745),(_gb_x,2.36,2.558),.045,wood)
    _gb_beam('Reservoir stair deck connection',(_gb_x,2.36,2.54),(_gb_x,2.53,2.54),.039,wood)
# Deck-side handhold is below the reservoir rim and never crosses the channel.
for _gb_y in [2.49,3.07]:
    _gb_beam('Reservoir outer handhold post',(6.04,_gb_y,2.50),(6.04,_gb_y,2.97),.022,wood)
_gb_beam('Reservoir outer handrail',(6.04,2.49,2.96),(6.04,3.07,2.96),.024,timber)


def ground_campaign_shelter(tx,ty,z):
    """Seat the campaign-only pitched canopy and give its bench four legs."""
    _gb_remove('STOL boarding shelter timber post')
    canopy=bpy.data.objects['STOL small village boarding shelter']
    slope=canopy.rotation_euler.x
    shelter_wood=bpy.data.objects['STOL boarding shelter bench'].data.materials[0]
    for dx in [-.6,.6]:
        for dy in [-.38,.38]:
            underside=z+.91+dy*_gb_math.tan(slope)-.055/_gb_math.cos(slope)
            _gb_beam('STOL seated shelter timber post',(tx+dx,ty+dy,z-.07),(tx+dx,ty+dy,underside+.009),.035,shelter_wood)
    for dx in [-.6,.6]:
        _gb_beam('STOL shelter roof side bearer',(tx+dx,ty-.46,z+.91-.46*_gb_math.tan(slope)-.072),
                 (tx+dx,ty+.46,z+.91+.46*_gb_math.tan(slope)-.072),.033,shelter_wood)
    for dx in [-.35,.35]:
        for dy in [-.07,.07]:
            _gb_beam('STOL grounded bench leg',(tx+dx,ty+.2+dy,z-.07),(tx+dx,ty+.2+dy,z+.24),.028,shelter_wood)
    _gb_beam('STOL bench grounded frame',(tx-.37,ty+.2,z+.17),(tx+.37,ty+.2,z+.17),.025,shelter_wood)
    # These slim campaign props also need contact with the earth clearing.
    _gb_remove('STOL windsock mast','STOL shelter roof seams')
    _gb_beam('STOL grounded windsock mast',(tx+.85,ty+.5,z-.07),(tx+.85,ty+.5,z+1.45),.021,shelter_wood)
    for ob in list(bpy.data.objects):
        if ob.name.startswith('STOL white landing edge stone'):
            _gb_lower_box(ob,z-.055)
    canopy_material=canopy.data.materials[0]
    for dx in [-.6,-.3,0,.3,.6]:
        front=z+.91-.5*_gb_math.tan(slope)+.055/_gb_math.cos(slope)+.009
        back=z+.91+.5*_gb_math.tan(slope)+.055/_gb_math.cos(slope)+.009
        _gb_beam('STOL seated shelter roof seam',(tx+dx,ty-.5,front),(tx+dx,ty+.5,back),.024,canopy_material)


print('GUAIRA_BUILDINGS: seated foundations, closed gables, load paths, accessible reservoir deck')

# Remaining dry scenery is seated as complete assemblies, after the structural
# repairs. Never move isolated cactus arms or corral rails away from their roots.
def _gb_world_bounds(ob):
    corners=[ob.matrix_world@_GBVector(corner) for corner in ob.bound_box]
    return [min(p[i] for p in corners) for i in range(3)],[max(p[i] for p in corners) for i in range(3)]


def _gb_seat_families(root_prefix, part_prefixes, root_z, inset=.008):
    roots=[]
    for ob in bpy.data.objects:
        if ob.name.startswith(root_prefix):
            low,high=_gb_world_bounds(ob)
            x,y=(low[0]+high[0])/2,(low[1]+high[1])/2
            delta=min(0,_gb_ground_height(x,y)-inset-root_z)
            roots.append((x,y,delta))
    for ob in bpy.data.objects:
        if not any(ob.name==prefix or ob.name.startswith(prefix+'.') for prefix in part_prefixes) or not roots:
            continue
        low,high=_gb_world_bounds(ob)
        x,y=(low[0]+high[0])/2,(low[1]+high[1])/2
        root=min(roots,key=lambda p:(p[0]-x)**2+(p[1]-y)**2)
        ob.location.z+=root[2]


bpy.context.view_layer.update()
_gb_seat_families('Cactus stem',('Cactus stem','Cactus arm','Cactus upright'),1.80)
_gb_seat_families('Cluster cactus stem',('Cluster cactus stem','Rounded cactus tip',
    'Long cactus rib','Curved cactus arm','Cluster upright','Cactus arm tip'),1.76)
_gb_seat_families('Corral post',('Corral post','Corral open fence'),1.80)
# Dry grass and agave root vertices are authored together at the first two
# points; lower each complete blade to the soil, keeping its exact silhouette.
for _gb_ob in bpy.data.objects:
    if _gb_ob.type=='MESH' and _gb_ob.name.startswith(('Sheltered dry vegetation','Dry agave blade')):
        _gb_base=(_gb_ob.matrix_world@_gb_ob.data.vertices[0].co+_gb_ob.matrix_world@_gb_ob.data.vertices[1].co)/2
        _gb_ob.location.z+=min(0,_gb_ground_height(_gb_base.x,_gb_base.y)-.005-_gb_base.z)
    elif _gb_ob.name.startswith('Dry ditch broken edge'):
        _gb_lower_box(_gb_ob,1.735)
    elif _gb_ob.name.startswith('Dry ditch'):
        _gb_ob.location.z-=.041
    elif _gb_ob.name.startswith('Workshop leaning poles'):
        _gb_ob.location.z-=.055
# Cracks are inset into the surface rather than drawn as elevated wire.
# Discard an old decorative branch that extends beyond the inhabited outline;
# only structural contacts are allowed to require missing support terrain.
_gb_outside_cracks=[]
for _gb_ob in list(bpy.data.objects):
    if _gb_ob.type=='CURVE' and _gb_ob.name.startswith(('Sparse dry crack','Branched soil fissure','Fissure fine branch')):
        _gb_inverse=_gb_ob.matrix_world.inverted()
        for _gb_spline in _gb_ob.data.splines:
            for _gb_point in _gb_spline.points:
                _gb_world=_gb_ob.matrix_world@_GBVector(_gb_point.co[:3])
                _gb_hit,_,_,_=_gb_ground.ray_cast(_GBVector((_gb_world.x,_gb_world.y,6)),_GBVector((0,0,-1)),8)
                if _gb_hit is None:
                    _gb_outside_cracks.append(_gb_ob.name)
                    break
                _gb_world.z=min(_gb_world.z,_gb_hit.z+.001)
                _gb_point.co=(*(_gb_inverse@_gb_world),1)
for _gb_name in set(_gb_outside_cracks):
    bpy.data.objects.remove(bpy.data.objects[_gb_name],do_unlink=True)
# Whole low props retain their relative pieces. Bone ribs meet the spine;
# tumbleweed hoops and the cart wheel now actually touch the dry soil.
for _gb_ob in bpy.data.objects:
    if _gb_ob.name.startswith('Tumbleweed hoops'):
        _gb_ob.location.z-=.066
    elif _gb_ob.name.startswith(('Broken cart wheel','Cart wheel spoke')):
        _gb_ob.location.z-=.033
    elif _gb_ob.name.startswith('Small old rib'):
        _gb_ob.location.z-=.045
    elif _gb_ob.name.startswith('Old spine'):
        _gb_ob.location.z+=.085
