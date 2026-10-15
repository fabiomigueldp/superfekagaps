"""Author one continuous coast/soil mesh, with flat transport and prop footprints.

Run export_terrain_inputs.py in Blender on guaira-native.blend first.
Python 3 + Shapely 2.1. The grid is clipped before triangulation, so the
surface and the geological skirt share every boundary vertex exactly.
"""
import json,math
from collections import Counter
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/terrain-polish-2026-10-15'
data=json.loads((WORK/'scene-input.json').read_text())
polys={name:Polygon([(p[0],p[1]) for p in ring]) for name,ring in data['outlines'].items()}
coast=unary_union([polys['Continuous clay island'],polys['STOL continuous irregular landing meadow']])
coast=orient(coast.buffer(.24,quad_segs=4).buffer(-.24,quad_segs=4).buffer(-.16,quad_segs=4).buffer(.20,quad_segs=4),sign=1)
assert coast.geom_type=='Polygon' and coast.is_valid and not coast.interiors
routes=unary_union([LineString([p[:2] for p in r['world']]).buffer(r['width']/2+.18,quad_segs=4)
                   for r in data['navigation']['routes']])
ignore=('Fitted fractured cliff','Broken horizontal sediment','Sparse dry crack','Branched soil fissure','Fissure fine branch',
        'STOL graded dirt clearing','STOL continuous irregular','Native joined','Tumbleweed','Dry agave','Small old rib','Old spine')
protected=[routes,polys['Civic terrace'],polys['Reservoir support']]
for o in data['objects']:
    name=o['name'];a,b=o['min'],o['max']
    if name=='Continuous clay island' or name.startswith(ignore):continue
    if a[2]<1.85 and b[2]>1.72:
        protected.append(box(a[0]-.035,a[1]-.035,b[0]+.035,b[1]+.035))
fixed=unary_union(protected)
airport=polys['STOL continuous irregular landing meadow']
def smooth(a,b,v):
    t=min(1,max(0,(v-a)/(b-a)));return t*t*(3-2*t)
def height(x,y):
    p=Point(x,y);airport_weight=1-smooth(0,.48,airport.distance(p))
    base=1.75+.023*airport_weight
    # Broad dry relief between the streets; at every prop and route the old
    # foundation elevation is preserved. No displacement noise on the runway.
    hills=[(.18,-.20,1.0,.82,.19),(-2.35,-3.33,.72,.48,.20),(6.10,2.6,.67,1.13,.22),
           (-3.18,2.82,.95,.62,.09),(.04,-4.25,.80,.36,.09),(6.48,-2.8,.4,.8,.07)]
    relief=sum(h*math.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2) for cx,cy,rx,ry,h in hills)
    relief+=(.014*math.sin(x*.8+y*.2)+.011*math.cos(y*1.25-x*.4))
    return base+relief*smooth(.03,.30,fixed.distance(p))*(1-airport_weight)
vertices=[];ids={};faces=[]
def vertex(x,y):
    key=(round(x,7),round(y,7))
    if key not in ids:ids[key]=len(vertices);vertices.append([*key,round(height(*key),6)])
    return ids[key]
x0,y0,x1,y1=coast.bounds;step=.32
for i in range(math.floor(x0/step),math.ceil(x1/step)):
    for j in range(math.floor(y0/step),math.ceil(y1/step)):
        cut=coast.intersection(box(i*step,j*step,(i+1)*step,(j+1)*step))
        if cut.is_empty:continue
        for tri in constrained_delaunay_triangles(cut).geoms:
            ring=list(orient(tri,sign=1).exterior.coords)[:-1]
            face=tuple(vertex(x,y) for x,y in ring)
            if len(set(face))==3 and tri.area>1e-12:faces.append(face)
counts=Counter(tuple(sorted((f[i],f[(i+1)%3]))) for f in faces for i in range(3))
boundary={}
for face in faces:
    for a,b in zip(face,face[1:]+face[:1]):
        if counts[tuple(sorted((a,b)))]==1:
            assert a not in boundary,'Surface boundary branches'
            boundary[a]=b
ring=[min(boundary)]
while boundary[ring[-1]]!=ring[0]:
    ring.append(boundary[ring[-1]]);assert len(ring)<=len(boundary)
assert len(ring)==len(boundary),'Disconnected ground surface'
normals=[]
for k,index in enumerate(ring):
    # Nested radial contours keep the winding monotone at the very short
    # boundary edges produced by clipping. Averaged corner normals folded
    # those edges back over one another and created dark vertical creases.
    x,y,_=vertices[index];dx,dy=x+.4,y-.05;l=math.hypot(dx,dy)
    normals.append((dx/l,dy/l))
# Shared contours, with a rounded soil shoulder, one recessed sediment seam,
# a broad sandstone foot and a small water-worn toe. All faces belong to ONE
# closed solid; no overlapping cliff panels, triangular overlays or rim pegs.
levels=[(.045,None,'soil'),(.16,1.42,'upper'),(.23,1.09,'upper'),(.16,.99,'seam'),
        (.25,.84,'lower'),(.21,.40,'lower'),(.05,.16,'foot'),(-.14,.085,'foot')]
materials=['soil']*len(faces);prev=ring[:]
for depth,(offset,z,mat) in enumerate(levels):
    current=[]
    for k,index in enumerate(ring):
        x,y,top=vertices[index];nx,ny=normals[k]
        wave=.105*math.sin(x*.67+y*.21)+.045*math.sin(y*.95-x*.25)
        zz=top-.08 if z is None else z+wave*(1 if depth<5 else .45 if depth==5 else .20)
        # Unequal exposures avoid mechanically parallel trim bands. Erosion
        # hollows are broad and shallow, carved into the same closed contour.
        erosion=sum(.065*math.exp(-((x-cx)**2+(y-cy)**2)/.32) for cx,cy in [(-3.55,-3.87),(-.8,-4.50),(3.25,-4.87),(6.96,-1.62)])
        radial=offset-erosion*(1 if 1<=depth<=5 else .20)
        current.append(len(vertices));vertices.append([round(x+nx*radial,7),round(y+ny*radial,7),round(zz,6)])
    assert Polygon([vertices[i][:2] for i in current]).is_valid,'Coast contour folds over itself'
    assert all(vertices[a][2]>vertices[b][2] for a,b in zip(prev,current)),'Geological layers cross vertically'
    for k in range(len(ring)):
        j=(k+1)%len(ring);faces.append([prev[k],current[k],current[j],prev[j]]);materials.append(mat)
    prev=current
faces.append(list(reversed(prev)));materials.append('foot')
all_edges=Counter(tuple(sorted((f[i],f[(i+1)%len(f)]))) for f in faces for i in range(len(f)))
assert all(v==2 for v in all_edges.values()),'Ground must be a single closed manifold'
result={'vertices':vertices,'faces':faces,'materials':materials,'surfaceFaces':len(materials)-len(ring)*len(levels)-1,
        'coast':list(coast.exterior.coords)[:-1],'boundaryVertices':len(ring),'protectedArea':round(fixed.area,3),
        'area':round(coast.area,3),'levels':levels}
(WORK/'terrain-layout.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('TERRAIN_LAYOUT',len(vertices),'vertices',len(faces),'faces',len(ring),'shared coast vertices',flush=True)
