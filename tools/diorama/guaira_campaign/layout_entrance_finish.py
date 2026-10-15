"""Union the service-hoist apron with the measured native paving (Shapely 2.1)."""
import json
from pathlib import Path
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles, set_precision
from shapely.geometry.polygon import orient
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/entrance-finish-2026-10-15'
data=json.loads((OUT/'finish-input.json').read_text())
before=unary_union([Polygon(t) for t in data['paving']])
apron=box(3.25,1.18,4.00,1.45).buffer(.065,quad_segs=4)
cx,cy=-1.48,.82;hx,hy,r=.44,.28,.035
collector=Polygon([(cx+x,cy+y) for x,y in [(hx-r,-hy),(hx,-hy+r),(hx,hy-r),(hx-r,hy),(-hx+r,hy),(-hx,hy-r),(-hx,-hy+r),(-hx+r,-hy)]]).buffer(-.025)
# Remove the old round paving cap from inside the collector. Its edge stays
# seated beneath the curb wall, leaving the modeled cavity genuinely empty.
joined=set_precision(before.union(apron).difference(collector),.00001)
parts=[joined] if joined.geom_type=='Polygon' else list(joined.geoms)
assert len(parts)==2,'The apron must join the street, not create an isolated island'
surfaces=[]
for p in parts:
    p=orient(p,sign=1);assert p.is_valid
    surfaces.append({'ring':list(p.exterior.coords)[:-1],'holes':[list(r.coords)[:-1] for r in p.interiors],
        'triangles':[list(orient(t,sign=1).exterior.coords)[:-1] for t in constrained_delaunay_triangles(p).geoms]})
(OUT/'finish-layout.json').write_text(json.dumps({'surfaces':surfaces,'addedPavingArea':before.union(apron).area-before.area,
    'removedPavingArea':before.union(apron).area-joined.area})+'\n')
print('FINISH_LAYOUT',len(parts),'joined solids;',round(before.union(apron).area-before.area,3),'square metres of service approach')
