"""Grounded rice landscape, applied after terrain/building redesigns.

Keeps navigation and the three water-surface names. All flooded beds remain at
z=1.81 so the runtime's paddy ripples use the authored water level. The low earth
terraces are solids rooted into the widened island, with real inlet notches.
Only the bridge-side culvert drops below the unchanged dry route/deck.
"""
import bpy
import math
from random import Random
from mathutils import Vector

_rice_rng = Random(6100517)
_rice_collection = bpy.data.collections.new('Guaira grounded rice landscape')
bpy.context.scene.collection.children.link(_rice_collection)
_rice_mats = {name: bpy.data.materials[name] for name in (
    'Compacted irrigation banks', 'Old canal sandstone', 'Clean turquoise water',
    'Canal bed', 'Dry timber', 'Gate wood', 'Young rice', 'Rice highlights',
    'Golden rice tips')}

def _rice_mesh(name, vertices, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    _rice_collection.objects.link(ob)
    data.materials.append(_rice_mats[material] if isinstance(material, str) else material)
    ob['guaira_rice_redesign'] = True
    return ob

def _rice_box(name, center, dimensions, material, bevel=.015):
    x,y,z = center; w,d,h = (q/2 for q in dimensions)
    vs=[(x+sx*w,y+sy*d,z+sz*h) for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)]
    ob=_rice_mesh(name,vs,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)],material)
    if bevel:
        mod=ob.modifiers.new('Quiet worn edge','BEVEL'); mod.width=bevel; mod.segments=2
        ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return ob

def _rice_rod(name,a,b,r,material,sides=10):
    a,b=Vector(a),Vector(b); axis=b-a
    rot=axis.to_track_quat('Z','Y').to_matrix()
    vs=[tuple(p+rot@Vector((r*math.cos(k*math.tau/sides),r*math.sin(k*math.tau/sides),0)))
        for p in (a,b) for k in range(sides)]
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
    fs += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return _rice_mesh(name,vs,fs,material)

def _rice_solid(name,points,top,bottom,material):
    if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))<0:
        points=list(reversed(points))
    n=len(points)
    vs=[(x,y,z) for z in (bottom,top) for x,y in points]
    return _rice_mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+
        [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],material)

def _rice_inside(x,y,pts):
    inside=False;j=len(pts)-1
    for i,(xi,yi) in enumerate(pts):
        xj,yj=pts[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi: inside=not inside
        j=i
    return inside

def _rice_dist_segment(p,a,b):
    p,a,b=Vector(p[:2]),Vector(a[:2]),Vector(b[:2]);delta=b-a
    t=max(0,min(1,(p-a).dot(delta)/delta.length_squared))
    return (p-(a+delta*t)).length

def _rice_route_clear(x,y,margin=.63):
    route_distance=min(_rice_dist_segment((x,y),a,b) for route in ROUTES for a,b in zip(route,route[1:]))
    node_distance=min(math.hypot(x-p[0],y-p[1]) for p in NODES.values())
    return route_distance>margin and node_distance>.87

# Replace the old top-only beds, packed border beads, ornamental plants and
# perched keeper group as one authored agricultural landscape. The reservoir,
# diversion, water restoration props, route meshes and bridge deck survive.
_rice_remove=(
    'Connected Upper earth terrace','Connected Lower earth terrace','Connected Cross earth terrace',
    'Upper cyan irrigated paddy','Lower cyan irrigated paddy','Cross cyan irrigated paddy',
    'Embedded old paddy bank stone','Curved rice leaves','Rice grain head',
    'Bowed mature rice panicle','Rice grain pair','Shared field supply',
    'Eastern communicating canal','Lower shared outflow','Bridge lateral clean inlet',
    'Bridge bank stops before walk','Quiet canal glint','Water keeper bucket',
    'Bucket bronze hoop','Bucket loop handle','Irrigation rake','Rake teeth',
    'Keeper rack','Tied harvested rice stalk','Harvest bundle binding',
    'Foreground harvested sheaf','Harvest sheaf grain','Foreground sheaf tie',
    'Keeper spare rake shaft','Keeper rake crossbar','Damp bank sedge')
for _ob in list(bpy.data.objects):
    if _ob.name.startswith(_rice_remove): bpy.data.objects.remove(_ob,do_unlink=True)
# Old bank agaves stood on the unsupported rim. Remove only the field group.
for _ob in list(bpy.data.objects):
    if _ob.name.startswith('Dry agave blade') and _ob.type=='MESH':
        _vs=[_ob.matrix_world@v.co for v in _ob.data.vertices]
        if _vs and sum(v.x for v in _vs)/len(_vs)>3.7 and sum(v.y for v in _vs)/len(_vs)<.1:
            bpy.data.objects.remove(_ob,do_unlink=True)

# Ring vertices run clockwise. Open edge intervals are low, flooded notches,
# not hidden lines under continuous soil banks. Broad sloped toes join terrain.
_rice_beds=[
    dict(name='Upper',outer=[(3.80,-.28),(5.63,-.28),(5.88,-.62),(5.83,-1.58),(5.58,-1.83),(3.81,-1.83)],
         inner=[(4.00,-.49),(5.53,-.49),(5.67,-.68),(5.62,-1.49),(5.50,-1.62),(4.01,-1.62)],
         openings={0:[(.19,.55)],2:[(.28,.76)],5:[(0.,.42)]},crest=1.895,mature=False),
    dict(name='Lower',outer=[(3.79,-2.08),(5.61,-2.08),(5.83,-2.33),(5.73,-3.57),(5.42,-3.89),(3.79,-3.89)],
         inner=[(4.00,-2.28),(5.52,-2.28),(5.62,-2.39),(5.52,-3.48),(5.33,-3.68),(4.00,-3.68)],
         openings={2:[(.31,.60)],4:[(.29,.80)]},crest=1.875,mature=True),
    dict(name='Cross',outer=[(1.09,-3.43),(3.34,-3.40),(3.80,-3.64),(3.76,-4.23),(3.41,-4.35),(1.02,-4.30)],
         inner=[(1.28,-3.61),(3.28,-3.59),(3.56,-3.70),(3.56,-4.12),(3.34,-4.15),(1.23,-4.10)],
         openings={2:[(0.,1.)]},crest=1.855,mature=True),
]
_rice_water_z=1.81
_rice_root_z=1.778
_rice_contact_points=[]
_rice_plant_roots=[]
for _bed in _rice_beds:
    name,outer,inner=_bed['name'],_bed['outer'],_bed['inner']; n=len(outer)
    # Actual sediment floor and volume below the water, buried 15cm into island.
    _rice_solid('Connected '+name+' earth terrace',outer,1.778,1.60,'Compacted irrigation banks')
    _water_ob=_rice_mesh(name+' cyan irrigated paddy',[(x,y,_rice_water_z) for x,y in inner],[tuple(range(n-1,-1,-1))],'Clean turquoise water')
    _water_ob['rice_bed_name']=name
    _rice_contact_points.extend([(x,y,1.60) for x,y in outer])
    for edge in range(n):
        a,b=Vector(outer[edge]),Vector(outer[(edge+1)%n]); c,d=Vector(inner[edge]),Vector(inner[(edge+1)%n])
        openings=_bed['openings'].get(edge,[])
        cuts=sorted(set([0.,1.]+[t for interval in openings for t in interval]))
        for lo,hi in zip(cuts,cuts[1:]):
            if any(start<(lo+hi)/2<end for start,end in openings): continue
            oa,ob=a.lerp(b,lo),a.lerp(b,hi); ia,ib=c.lerp(d,lo),c.lerp(d,hi)
            ca,cb=oa.lerp(ia,.52),ob.lerp(ib,.52)
            vs=[(*oa,1.758),(*ob,1.758),(*cb,_bed['crest']),(*ca,_bed['crest']),
                (*ia,1.822),(*ib,1.822),(*oa,1.60),(*ob,1.60),(*ia,1.60),(*ib,1.60)]
            _rice_mesh(name+' sloped compacted berm',vs,[(0,1,2,3),(3,2,5,4),(0,3,4,8,6),(1,7,9,5,2),(4,5,9,8),(6,8,9,7),(0,6,7,1)],'Compacted irrigation banks')
        # A few fitted stones at erosion-prone corners replace a toy-like ring.
        if edge in (2,3,4) and name!='Cross' or name=='Cross' and edge in (2,3):
            for t in (.16,.83):
                if any(lo-.12<t<hi+.12 for lo,hi in openings):continue
                p=a.lerp(b,t).lerp(c.lerp(d,t),.42)
                if not _rice_route_clear(p.x,p.y):continue
                q=_rice_box(name+' embedded retaining stone',(p.x,p.y,1.825),(.26,.15,.145),'Old canal sandstone',.025)
                # Rotate mesh in place, since helper leaves vertices in world space.
                center=Vector((p.x,p.y,1.825)); angle=math.atan2((b-a).y,(b-a).x)
                for v in q.data.vertices:
                    dv=v.co-center; v.co=center+Vector((math.cos(angle)*dv.x-math.sin(angle)*dv.y,math.sin(angle)*dv.x+math.cos(angle)*dv.y,dv.z))
    # Ordered planted rows with open water at all inlets and at the perimeter.
    xmin,xmax=min(p[0] for p in inner),max(p[0] for p in inner)
    ymin,ymax=min(p[1] for p in inner),max(p[1] for p in inner)
    leaves=[]; faces=[]; roots=[]
    for row in range(16):
        yy=ymin+.16+row*.24
        if yy>ymax-.13:break
        for col in range(20):
            xx=xmin+.15+col*.25
            if xx>xmax-.12:break
            xx+=_rice_rng.uniform(-.018,.018);y=yy+_rice_rng.uniform(-.018,.018)
            if not _rice_inside(xx,y,inner):continue
            edge_distance=min(_rice_dist_segment((xx,y),a,b) for a,b in zip(inner,inner[1:]+inner[:1]))
            if edge_distance<.12:continue
            # The central irrigation corridor is visibly wider than plant gaps.
            if name=='Upper' and abs(xx-4.5)<.095:continue
            roots.append((xx,y,_rice_root_z)); _rice_plant_roots.append((name,xx,y,_rice_root_z))
            for blade in range(6):
                angle=blade*2.399+_rice_rng.uniform(-.16,.16)
                h=_rice_rng.uniform(.23,.34) if _bed['mature'] else _rice_rng.uniform(.18,.28)
                lean=_rice_rng.uniform(.065,.105); dx,dy=math.cos(angle),math.sin(angle)
                offset=len(leaves)
                leaves += [(xx-dy*.023,y+dx*.023,_rice_root_z),(xx+dy*.023,y-dx*.023,_rice_root_z),
                    (xx+dx*lean*.43,y+dy*lean*.43,_rice_root_z+h*.76),(xx+dx*lean,y+dy*lean,_rice_root_z+h)]
                faces.extend([(offset,offset+1,offset+2),(offset,offset+2,offset+3)])
            if _bed['mature'] and (row+col)%3==0:
                ps=[(xx,y,2.005),(xx+.008,y,2.12),(xx+.052,y+.01,2.155),(xx+.09,y+.015,2.12)]
                for a,b in zip(ps,ps[1:]):_rice_rod('Bowed mature rice panicle',a,b,.010,'Golden rice tips',6)
                for i in range(3):
                    _rice_rod('Rice grain pair',(xx+.025+i*.019,y-.014,2.13),(xx+.047+i*.019,y+.017,2.124-i*.005),.012,'Golden rice tips',6)
    leaf_ob=_rice_mesh(name+' rooted rice rows',leaves,faces,'Young rice');leaf_ob.data.materials.append(_rice_mats['Rice highlights'])
    for face in leaf_ob.data.polygons:face.material_index=(face.index//2)%3==0
    leaf_ob['planted_roots']=[list(p) for p in roots]
    leaf_ob['rice_bed_name']=name

# Every channel has a solid dark sediment bed. Flat narrow water ribbons keep
# the runtime exporter contract (a-side pair, b-side pair). Side walls stop at
# open junctions rather than drawing masonry through flooded fields.
_rice_channels=[]
def _rice_channel(name,a,b,width=.24,rails=True):
    a,b=Vector(a),Vector(b)
    # Tiny ordered separation avoids coplanar self-shadowing at wet junctions.
    # This is below a source pixel and preserves the basin's z1.81 contract.
    epsilon=.00045*(len(_rice_channels)+1)
    a.z+=epsilon; b.z+=epsilon
    direction=b-a;side=Vector((-direction.y,direction.x,0)).normalized()
    corners=[a-side*width/2,a+side*width/2,b+side*width/2,b-side*width/2]
    _rice_mesh(name+' clean flowing water',[tuple(p) for p in corners],[(3,2,1,0)],'Clean turquoise water')
    low=[(p.x,p.y,p.z-.028) for p in corners]
    vs=low+[(p.x,p.y,1.70) for p in corners]
    _rice_mesh(name+' seated sediment bed',vs,[(3,2,1,0),(1,5,4,0),(2,6,5,1),(3,7,6,2),(0,4,7,3),(4,5,6,7)],'Canal bed')
    if rails:
        for sign in (-1,1):
          intervals=(rails[sign] if isinstance(rails,dict) else [(0.,1.)] if rails is True else rails)
          for lo,hi in intervals:
            aa=a.lerp(b,lo)+side*(width/2)*sign;bb=a.lerp(b,hi)+side*(width/2)*sign
            # Full wedge wall rests below ground, not a floating cylindrical lip.
            outer_a=aa+side*.11*sign;outer_b=bb+side*.11*sign
            vertices=[(aa.x,aa.y,aa.z+.037),(bb.x,bb.y,bb.z+.037),
                (outer_b.x,outer_b.y,bb.z+.025),(outer_a.x,outer_a.y,aa.z+.025),
                (aa.x,aa.y,1.69),(bb.x,bb.y,1.69),(outer_b.x,outer_b.y,1.69),(outer_a.x,outer_a.y,1.69)]
            _rice_mesh(name+' founded retaining lip',vertices,[(0,1,2,3),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(7,6,5,4)],'Old canal sandstone')
    _rice_channels.append({'name':name,'a':list(a),'b':list(b),'width':width})

_rice_channel('Shared field supply',(4.5,1.55,1.86),(4.5,-.65,1.81),.38)
# The original eastern supply descends into a spreading pool, then reaches a
# dry-bank spine through open notches in both paddies' east berms.
_rice_channel('Upper paddy lateral feed',(5.44,-1.06,1.81),(5.99,-1.06,1.81),.27,False)
_rice_channel('Eastern communicating canal',(5.98,-.925,1.81),(5.98,-4.09,1.81),.24,{-1:[(.105,.555),(.70,.89)],1:[(0.,1.)]})
_rice_channel('Lower paddy lateral feed',(5.98,-2.91,1.81),(5.39,-2.91,1.81),.27,False)
# South collection gutter meets the lower field and the cross field, with the
# existing drain gate still explaining control of the shared outflow.
_rice_channel('Lower paddy drain',(4.48,-3.48,1.81),(4.48,-3.96,1.81),.30,False)
_rice_channel('Lower shared outflow',(5.98,-3.96,1.81),(3.49,-3.96,1.81),.26,{-1:[(.07,.44),(.74,.91)],1:[(0.,.95)]})
# Continuous outside banks close both right-angle turns. Only the inward lips
# have field inlet gaps; no blue edge protrudes into the dry working shoulder.
_rice_box('Eastern canal north return bank',(5.955,-.87,1.779),(.51,.11,.162),'Old canal sandstone',.006)
_rice_box('Eastern canal south return bank',(5.955,-4.145,1.779),(.51,.11,.162),'Old canal sandstone',.006)
# The bridge itself remains in exactly the original place. Its wet approach
# drops below the walking surface; the buried culvert is occluded by the deck.
_rice_channel('Bridge lateral clean inlet',(4.18,-1.32,1.81),(3.81,-1.59,1.81),.28,False)
_rice_channel('Bridge inlet drop',(3.81,-1.59,1.81),(3.64,-1.74,1.77),.28,False)
_rice_channel('Bridge contained culvert',(3.64,-1.74,1.77),(2.63,-1.74,1.77),.28,False)
for x in (2.68,3.52):
    for y in (-2.10,-1.45):
        _rice_box('Paddy bridge founded abutment',(x,y,1.747),(.17,.18,.076),'Old canal sandstone',.009)
for x in (2.78,3.42):
    _rice_box('Paddy bridge timber bearer',(x,-1.765,1.769),(.09,.88,.032),'Gate wood',.004)
# The old path is a solid visual route above this culvert, so no excavation or
# changes to route vertices, normals, sprite contact, IDs or navigation occur.

# Gate piers get small founded footings. The world positions of the recognizable
# gate machinery are preserved; the supply/outflow now actually run beneath it.
for x,y in [(4.20,.15),(4.80,.15),(4.20,-3.95),(4.80,-3.95)]:
    _rice_box('Field sluice founded stone foot',(x,y,1.754),(.25,.28,.09),'Old canal sandstone',.020)

# Keeper shed is relocated to a working bank with 20cm clearance from the canal.
# Feet penetrate the broad island shoulder; its shelf and sheaves remain small.
_hx,_hy=6.43,-2.14
_pad=[(6.10,-1.64),(6.69,-1.60),(6.85,-1.86),(6.84,-2.64),(6.36,-2.77),(6.12,-2.59)]
_rice_solid('Keeper compacted working bank',_pad,1.757,1.68,'Compacted irrigation banks')
for dx in (-.23,.23):
    for dy in (-.28,.28):
        _rice_rod('Keeper rack upright',(_hx+dx,_hy+dy,1.73),(_hx+dx,_hy+dy,2.30),.029,'Gate wood')
        _rice_contact_points.append((_hx+dx,_hy+dy,1.73))
for k in range(6):_rice_box('Keeper rack shade slat',(_hx,_hy-.30+k*.12,2.32),(.65,.105,.05),'Dry timber',.008)
_rice_box('Keeper rack dry shelf',(_hx,_hy,1.85),(.54,.56,.045),'Gate wood',.007)
for dx,dy in [(-.12,-.11),(.12,.04),(-.05,.17)]:
    x,y=_hx+dx,_hy+dy
    for k in range(8):
        a=k*math.tau/8
        _rice_rod('Tied harvested rice stalk',(x+math.cos(a)*.085,y+math.sin(a)*.07,1.873),(x+math.cos(a)*.093,y+math.sin(a)*.07,2.105+(k%3)*.013),.009,'Golden rice tips',6)
    _rice_rod('Harvest bundle binding',(x,y,1.969),(x,y,2.001),.047,'Dry timber')
# One drying sheaf outside the shade; no decorative clusters at every bank corner.
x,y=_hx-.015,_hy-.46
for k in range(12):
    a=k*math.tau/12; ps=[(x+math.cos(a)*.10,y+math.sin(a)*.075,1.75),(x+math.cos(a)*.035,y+math.sin(a)*.03,1.98),(x+math.cos(a)*.13,y+math.sin(a)*.09,2.13)]
    for aa,bb in zip(ps,ps[1:]):_rice_rod('Foreground harvested sheaf',aa,bb,.010,'Golden rice tips',6)
_rice_rod('Foreground sheaf tie',(x,y,1.964),(x,y,1.997),.054,'Dry timber')
_rice_rod('Keeper spare rake shaft',(6.75,-1.79,1.75),(6.67,-1.83,2.24),.017,'Dry timber')
_rice_rod('Keeper rake crossbar',(6.58,-1.85,2.22),(6.82,-1.85,2.22),.021,'Gate wood')
# Narrow earth footings lead from the rack to the two existing fieldwork banks.
_rice_solid('Keeper canal-side work path',[(6.14,-1.22),(6.28,-1.22),(6.31,-2.70),(6.15,-2.70)],1.757,1.70,'Compacted irrigation banks')

bpy.context.view_layer.update()
# Readable audit metadata, consumed by focused geometry verification.
bpy.context.scene['guaira_rice_contact_points']=[list(p) for p in _rice_contact_points]
bpy.context.scene['guaira_rice_water_level']=_rice_water_z
bpy.context.scene['guaira_rice_bed_count']=len(_rice_beds)
bpy.context.scene['guaira_rice_planted_clumps']=len(_rice_plant_roots)
for _name,_x,_y,_z in _rice_plant_roots:
    assert _rice_route_clear(_x,_y), 'Rice encroached into a route or clearing'
print('GUAIRA_RICE: three solid earth beds, '+str(len(_rice_plant_roots))+' rooted clumps, connected supply and founded keeper bank; route meshes preserved')
