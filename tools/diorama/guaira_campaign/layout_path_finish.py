"""Cut dressed curb stones out of continuous, mitered boundary ribbons.

Small segments around a corner remain in the ribbon. Expansion joints cut
across the whole ribbon, so consecutive rectangular beam ends cannot leave
triangular gaps. All intentional door, bridge and stair openings stay open.
"""
import json,math
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles,set_precision
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/path-finish-2026-10-15'
data=json.loads((OUT/'path-input.json').read_text())
paving=set_precision(unary_union([Polygon(t) for t in data['paving']]),.00001)
parts=[paving] if paving.geom_type=='Polygon' else list(paving.geoms)
def omit(x,y):
    return ((2.50<x<3.72 and -2.32<y<-1.18) or (1.25<y<2.75 and 1.15<x<3.50)
        or (y<-2.45 and x<-4.45) or (abs(x-2.02)<.01 and -.26<y<.56)
        or (3.50<x<4.10 and 1.4<y<1.6) or (-1.96<x<-1.0 and .50<y<1.13))
def encode(p):
    p=orient(p,sign=1)
    return {'ring':list(p.exterior.coords)[:-1],'holes':[list(r.coords)[:-1] for r in p.interiors],
        'triangles':[list(orient(t,sign=1).exterior.coords)[:-1] for t in constrained_delaunay_triangles(p).geoms]}
runs=[];stones=[];joints=[]
for part in parts:
    ring=list(orient(part,sign=1).exterior.coords)[:-1];n=len(ring)
    allowed=[not omit((ring[i][0]+ring[(i+1)%n][0])/2,(ring[i][1]+ring[(i+1)%n][1])/2) for i in range(n)]
    start=next((i for i in range(n) if not allowed[(i-1)%n]),0);run=[]
    for step in range(n):
        i=(start+step)%n
        if allowed[i]:
            if not run:run.append(ring[i])
            run.append(ring[(i+1)%n])
        elif run:runs.append(run);run=[]
    if run:runs.append(run)
for index,run in enumerate(runs):
    line=LineString(run)
    if line.length<.025:continue
    ribbon=line.buffer(.0475,cap_style=2,join_style=2,mitre_limit=2)
    cuts=[];count=max(1,math.ceil(line.length/.58))
    for j in range(1,count):
        distance=line.length*j/count
        # Keep a joint on a straight portion, away from a tiny bevel corner.
        vertices=[line.project(Point(p)) for p in run[1:-1]]
        for _ in range(5):
            if all(abs(distance-v)>.022 for v in vertices):break
            distance+=.013
        distance=min(distance,line.length-.02)
        p=line.interpolate(distance);a=line.interpolate(distance-.0001);b=line.interpolate(distance+.0001)
        dx,dy=b.x-a.x,b.y-a.y;l=math.hypot(dx,dy);dx/=l;dy/=l
        cut=Polygon([(p.x+dx*t-dy*w,p.y+dy*t+dx*w) for t,w in [(-.0015,-.085),(.0015,-.085),(.0015,.085),(-.0015,.085)]])
        cuts.append(cut);joints.append({'run':index,'station':distance,'width':.003})
    dressed=set_precision(ribbon.difference(unary_union(cuts)),.000001)
    blocks=[dressed] if dressed.geom_type=='Polygon' else list(dressed.geoms)
    for block in blocks:
        assert block.is_valid and block.area>.00001
        stones.append({'run':index,**encode(block)})
    assert abs(unary_union(blocks).area+ribbon.intersection(unary_union(cuts)).area-ribbon.area)<.00001
(OUT/'path-layout.json').write_text(json.dumps({'stones':stones,'runs':runs,'joints':joints,'pavingArea':paving.area})+'\n')
print('PATH_LAYOUT',len(stones),'fitted stones;',len(joints),'3 mm joints;',len(runs),'continuous curb runs')
