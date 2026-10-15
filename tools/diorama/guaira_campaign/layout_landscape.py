"""Fit the civic retaining wall to the saved terrace and native stair envelope.

Run in system Python (Shapely 2.1), after refine_landscape.py --export-inputs
has read the revision 2 Blender source. Blocks include their actual corners;
the stair opening is cut from the wall rather than omitting whole stones.
"""
import json, math
from pathlib import Path
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / 'output/guaira/landscape-finish-2026-10-15'
data = json.loads((WORK / 'landscape-input.json').read_text())
terrace = orient(Polygon(data['civicOutline']), sign=1)
boundary = terrace.exterior
stairs = next(r for r in data['navigation']['routes'] if r['id'] == 'civic-stairs')
opening = LineString([p[:2] for p in stairs['world']]).buffer(.695, cap_style='round', join_style='round')
front = box(-3, -1, 4, 3.54)
pieces = []

def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [p for g in geometry.geoms for p in polygons(g)]

def record(name, shape, bottom, top, kind, bevel):
    for i, poly in enumerate(polygons(shape)):
        if poly.area < .00008:
            continue
        poly = orient(poly, sign=1)
        pieces.append({'name': name + ' ' + str(i), 'bottom': bottom, 'top': top,
                       'kind': kind, 'bevel': bevel,
                       'ring': list(poly.exterior.coords)[:-1],
                       'holes': [list(h.coords)[:-1] for h in poly.interiors],
                       'triangles': [list(orient(t, sign=1).exterior.coords)[:-1]
                                     for t in constrained_delaunay_triangles(poly).geoms]})

def band(outer, inner):
    return terrace.buffer(outer, join_style='mitre').difference(
        terrace.buffer(inner, join_style='mitre')).intersection(front).difference(opening)

record('civic recessed mortar backing', band(.111, -.12), 1.68, 2.402, 'mortar', 0)
for row, (low, high, outer) in enumerate([(1.71, 1.938, .142), (1.950, 2.158, .133), (2.170, 2.393, .123), (2.392, 2.455, .143)]):
    shape = band(outer, -.16 if row == 3 else -.09)
    module = .64 if row == 3 else .53
    cuts = []
    distance = (.26 if row % 2 else .08)
    while distance < boundary.length:
        # Cross cuts stop immediately behind the facing. They cannot slice
        # another side of the wall at an inward corner.
        a = boundary.interpolate(distance - .015)
        b = boundary.interpolate(distance + .015)
        p = boundary.interpolate(distance)
        dx, dy = b.x - a.x, b.y - a.y
        length = math.hypot(dx, dy)
        nx, ny = -dy / length, dx / length
        cut = LineString([(p.x - nx * .22, p.y - ny * .22),
                          (p.x + nx * .22, p.y + ny * .22)])
        cuts.append(cut.buffer(.005, cap_style='flat'))
        distance += module
    shape = shape.difference(unary_union(cuts))
    record('civic fitted course ' + str(row), shape, low, high,
           'cap' if row == 3 else 'stone', .007)

assert all(Polygon(p['ring'], p['holes']).is_valid for p in pieces)
(WORK / 'landscape-layout.json').write_text(json.dumps({'pieces': pieces}, separators=(',', ':')) + '\n')
print('LANDSCAPE_LAYOUT', len(pieces), 'closed fitted masonry pieces')
