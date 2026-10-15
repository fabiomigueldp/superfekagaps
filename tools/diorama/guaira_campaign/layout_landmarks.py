"""Fit eight phase landmarks and Ossabravo's branch to the saved revision 3 scene.

Run refine_landmarks.py --export-inputs in Blender first, then this in system
Python (Shapely 2.1). The existing bridge, stairs and airport stay in place.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles, set_precision
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / 'output/guaira/phase-landmarks-2026-10-15'
source = json.loads((WORK / 'landmark-input.json').read_text())
corral = Polygon([(-.32,-.94),(.10,-1.16),(1.34,-1.08),(1.93,-.62),
                  (2.02,-.26),(2.02,.56),(1.70,.83),(.90,.90),
                  (-.12,.76),(-.43,.36)])

def encode(poly):
    poly = orient(set_precision(poly, .00001), sign=1)
    assert poly.is_valid and not poly.is_empty
    return {'ring': list(poly.exterior.coords)[:-1],
            'holes': [list(r.coords)[:-1] for r in poly.interiors],
            'triangles': [list(orient(t, sign=1).exterior.coords)[:-1]
                          for t in constrained_delaunay_triangles(poly).geoms]}

old = unary_union([Polygon(t) for s in source['paving'] for t in s['triangles']])
branch = LineString([(3.1,.15),(2.02,.15)]).buffer(.39, cap_style='flat')
joined = set_precision(old.union(branch), .00001)
surfaces = [joined] if joined.geom_type == 'Polygon' else list(joined.geoms)
grade = []
for index, p in source['terrainTop']:
    distance = corral.distance(Point(p[:2]))
    if distance < .22:
        t = max(0., min(1., 1-distance/.22))
        t = t*t*(3-2*t)
        grade.append([index, p[2]+(1.755-p[2])*t])
archive = []
for ob in source['objects']:
    if ob['name'].startswith(('Tumbleweed', 'Sparse soil', 'Branched soil', 'Fissure fine')):
        bounds = Polygon([(ob['min'][0],ob['min'][1]),(ob['max'][0],ob['min'][1]),
                          (ob['max'][0],ob['max'][1]),(ob['min'][0],ob['max'][1])])
        if corral.buffer(.18).intersects(bounds): archive.append(ob['name'])

result = {'surfaces': [encode(s) for s in surfaces], 'corral': encode(corral),
          'grade': grade, 'archive': archive,
          'pavingAreaBefore': old.area, 'pavingAreaAfter': joined.area}
(WORK / 'landmark-layout.json').write_text(json.dumps(result, separators=(',', ':'))+'\n')
print('LANDMARK_LAYOUT',len(surfaces),'joined paving solids;',len(grade),'court vertices graded')
