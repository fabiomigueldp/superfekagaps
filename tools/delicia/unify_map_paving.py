"""Planar masonry layout for the v7 Blender authoring pass (Shapely 2.1+).

Union BEFORE triangulation removes overlapping road strips at junctions.
Elevation is assigned by Blender from the original 3D centerlines afterwards.
"""
import json
import sys
from pathlib import Path
from shapely import constrained_delaunay_triangles, segmentize
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

source, destination = map(Path, sys.argv[1:3])
data = json.loads(source.read_text(encoding='utf-8'))
pieces = [LineString([(p[0],p[1]) for p in r['points']]).buffer(r['width']/2,quad_segs=8,cap_style='round',join_style='round') for r in data['roads']]
pieces += [Point(n[0],n[1]).buffer(n[3],quad_segs=16) for n in data['courts']]
pieces += [Polygon(p) for p in data['platforms']]
paving = unary_union(pieces).buffer(.07,quad_segs=6).buffer(-.07,quad_segs=6)
reserved = unary_union([Polygon(p) for p in data['stairs']])
paving = paving.difference(reserved)
if paving.geom_type=='Polygon':polygons=[paving]
else:polygons=list(paving.geoms)
output={'patches':[],'area':paving.area,'overlapRemoved':sum(p.area for p in pieces)-unary_union(pieces).area}
for poly in polygons:
    if poly.area<.005:continue
    poly=orient(segmentize(poly,.19),sign=1)
    verts=[];lookup={}
    def vertex(p):
        key=(round(p[0],7),round(p[1],7))
        if key not in lookup:lookup[key]=len(verts);verts.append(key)
        return lookup[key]
    faces=[]
    for triangle in constrained_delaunay_triangles(poly).geoms:
        points=list(orient(triangle,sign=1).exterior.coords)[:-1]
        faces.append([vertex(p) for p in points])
    rings=[[vertex(p) for p in list(r.coords)[:-1]] for r in [poly.exterior,*poly.interiors]]
    # Evenly laid border stones, not one tiny block per triangulation edge.
    borders=[]
    for ring in [poly.exterior,*poly.interiors]:
        line=LineString(ring.coords);count=max(1,round(line.length/.42))
        for i in range(count):
            a=line.interpolate(line.length*(i+.018)/count);b=line.interpolate(line.length*(i+.982)/count)
            mid=line.interpolate(line.length*(i+.5)/count)
            if reserved.distance(mid)<.095:continue
            borders.append([[a.x,a.y],[b.x,b.y]])
    output['patches'].append({'vertices':verts,'triangles':faces,'rings':rings,'borders':borders})
destination.write_text(json.dumps(output,separators=(',',':')),encoding='utf-8')
print(json.dumps({'patches':len(output['patches']),'squareMeters':round(output['area'],2),'overlapRemoved':round(output['overlapRemoved'],2)}))
