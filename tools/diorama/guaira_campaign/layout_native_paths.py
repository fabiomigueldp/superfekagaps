"""Author Guaíra's walkable network and joined paving. Run with Python + Shapely.

The centerlines are shared by Blender and WorldJourneyModel; phase entrances
are measured places, including the two opening choices and two side rooms.
"""
import json, math
from pathlib import Path
from shapely.geometry import LineString, box
from shapely import unary_union, constrained_delaunay_triangles, set_precision

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'output/guaira/native-map-2026-10-13'
OUT.mkdir(parents=True, exist_ok=True)
Z = 1.835
nodes = {
    'guaira-arrival': (-5, -2.8, Z),
    'guaira-travessia': (-5, -1.48, Z),
    'village': (-4, .05, Z),
    'workshop-junction': (-2.8, -.15, Z),
    'guaira-patio-comportas': (-3.10, -1.13, Z),
    'gallery': (-2.964, .48, Z),
    'relief': (-1.48, .30, Z),
    'guaira-respiros': (2, -2.5, Z),
    'guaira-lab': (3.10, .65, Z),
    'guaira-subida': (2.95, 1.10, Z),
    'stair-top': (1.80, 2.55, 2.465),
    'guaira-prefeito': (.60, 2.55, 2.465),
}
routes = []
def route(id, a, b, mids=(), width=1.02, kind='ground'):
    routes.append(dict(id=id, **{'from':a,'to':b}, world=[nodes[a], *mids, nodes[b]], width=width, kind=kind))
route('arrival', 'guaira-arrival', 'guaira-travessia')
route('village', 'guaira-travessia', 'village', [(-4.8,-.5,Z)])
route('workshop', 'village', 'workshop-junction')
route('gallery-door', 'workshop-junction', 'gallery', width=.72)
route('relief-door', 'workshop-junction', 'relief', [(-2.15,.05,Z)], width=.80)
route('patio-gate', 'workshop-junction', 'guaira-patio-comportas', [(-3.30,-.56,Z)], width=.86)
route('rice-road', 'workshop-junction', 'guaira-respiros', [(-1.90,-1.25,Z),(.40,-2.5,Z)])
route('rice-bridge', 'guaira-respiros', 'guaira-lab', [(3.10,-2.5,Z),(3.10,-2.28,Z),
    (3.10,-2.18,1.89),(3.10,-1.32,1.89),(3.10,-1.22,Z)])
route('corral-gate', 'guaira-lab', 'guaira-subida', width=1.02)

# Closed, individually modeled treads. World data follows the top of each tread,
# including its riser, rather than sliding up a line above a decorative staircase.
start=(2.85,1.28,Z); end=nodes['stair-top']; count=7
stairs=[]; line=[nodes['guaira-subida'],start]
for i in range(count):
    t0,t1=i/count,(i+1)/count
    a=[start[j]+(end[j]-start[j])*t0 for j in range(2)]
    b=[start[j]+(end[j]-start[j])*t1 for j in range(2)]
    h=Z+(end[2]-Z)*t1
    line.extend([(*a,h),(*b,h)])
    stairs.append({'a':a,'b':b,'top':h,'bottom':1.68,'width':1.13})
routes.append({'id':'civic-stairs','from':'guaira-subida','to':'stair-top','world':line,'width':1.13,'kind':'stairs'})
route('civic-square','stair-top','guaira-prefeito',width=1.12,kind='upper')

def rounded_pad(x,y,w,d):
    return box(x-w/2+.16,y-d/2+.16,x+w/2-.16,y+d/2-.16).buffer(.16,quad_segs=4)
def encode(poly):
    poly=set_precision(poly,.00001)
    return {'ring':list(poly.exterior.coords)[:-1],
            'holes':[list(r.coords)[:-1] for r in poly.interiors],
            'triangles':[list(t.exterior.coords)[:3] for t in constrained_delaunay_triangles(poly).geoms]}
surfaces=[]
for kind,h in [('ground',Z),('upper',2.465)]:
    parts=[LineString([p[:2] for p in r['world']]).buffer(r['width']/2,quad_segs=5,join_style='round')
           for r in routes if r['kind']==kind]
    pads=['guaira-travessia','village','guaira-patio-comportas','guaira-respiros','guaira-lab','relief'] if kind=='ground' else ['guaira-prefeito']
    parts.extend(rounded_pad(*nodes[id][:2],1.30 if id!='relief' else .92,1.10) for id in pads)
    if kind=='upper':parts.append(rounded_pad(.60,2.83,1.48,.92))
    surface=unary_union(parts)
    if kind=='ground':
        # Water and a real timber deck remain visible through the crossing.
        surface=surface.difference(box(2.57,-2.22,3.63,-1.28))
        # Square junction with the first riser; no circular asphalt-like cap.
        surface=surface.difference(LineString([start[:2],end[:2]]).buffer(.565,cap_style='flat'))
    else:
        # Union the final tread with the upper plaza; coplanar, overlapping
        # caps otherwise leave a black seam at this precisely visible join.
        last=stairs[-1]
        surface=surface.union(LineString([last['a'],last['b']]).buffer(.565,cap_style='flat'))
        surface=surface.difference(LineString([start[:2],last['a']]).buffer(.565,cap_style='flat'))
    pieces=[surface] if surface.geom_type=='Polygon' else list(surface.geoms)
    for p in pieces:surfaces.append({**encode(p),'kind':kind,'top':h,'bottom':1.69})

data={'revision':1,'nodes':nodes,'routes':routes,'surfaces':surfaces,'stairs':stairs}
(OUT/'layout.json').write_text(json.dumps(data,indent=2)+'\n')
print('GUAIRA_LAYOUT',len(nodes),'nodes',len(routes),'routes',len(surfaces),'joined paving solids')
