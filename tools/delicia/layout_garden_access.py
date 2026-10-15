"""Join the v11 garden access to the existing paved footprint (Shapely 2.1+).

Keep the old footprint outside the authored work area. Interior refinement
prevents long fan triangles across the newly graded courts and junctions.
"""
import json
import math
import sys
from pathlib import Path
from shapely import constrained_delaunay_triangles, segmentize, set_precision
from shapely.geometry import Polygon, LineString, Point, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

source, destination = map(Path, sys.argv[1:3])
data = json.loads(source.read_text())
old = unary_union([Polygon([data['vertices'][i][:2] for i in tri]) for tri in data['triangles']])
mask = box(*data['mask'])
roads = [LineString([p[:2] for p in r['points']]).buffer(r['width']/2, quad_segs=8) for r in data['roads']]
roads += [Point(p[0],p[1]).buffer(p[3],quad_segs=16) for p in data['courts']]
roads += [Polygon(p) for p in data['platforms']]
local = unary_union(roads).buffer(.045,quad_segs=4).buffer(-.045,quad_segs=4)
reserved = unary_union([Polygon(p) for p in data['stairs']])
footprint = old.difference(mask).union(local.intersection(mask.buffer(.08))).difference(reserved)
# Boolean seams in the earlier belvedere can leave sub-micron rings. Resolve
# those before indexing vertices, at a tolerance far below a visible pixel.
footprint = set_precision(footprint,.00001)
polygons = [footprint] if footprint.geom_type=='Polygon' else list(footprint.geoms)
out=[]
for polygon in polygons:
    if polygon.area < .004:continue
    poly=orient(segmentize(polygon,.18),sign=1)
    verts=[];lookup={}
    def vertex(p):
        key=(round(p[0],7),round(p[1],7))
        if key not in lookup:lookup[key]=len(verts);verts.append(key)
        return lookup[key]
    faces=[]
    for triangle in constrained_delaunay_triangles(poly).geoms:
        faces.append(tuple(vertex(p) for p in list(orient(triangle,sign=1).exterior.coords)[:-1]))
    rings=[[vertex(p) for p in list(r.coords)[:-1]] for r in [poly.exterior,*poly.interiors]]
    # Split shared edges together, including boundary rings: no T-junctions.
    for _ in range(12):
        split={}
        for face in faces:
            for a,b in zip(face,face[1:]+face[:1]):
                p,q=verts[a],verts[b]
                if math.dist(p,q)>.32:
                    split[tuple(sorted((a,b)))]=vertex(((p[0]+q[0])/2,(p[1]+q[1])/2))
        if not split:break
        refined=[]
        for face in faces:
            a,b,c=face
            mids=[split.get(tuple(sorted(edge))) for edge in ((a,b),(b,c),(c,a))]
            count=sum(m is not None for m in mids)
            if count==0:refined.append(face);continue
            if count==3:
                ab,bc,ca=mids
                refined.extend(((a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)))
                continue
            # Rotate the triangle to put the one split edge first, or the two
            # split edges consecutively. Bisection avoids skinny centroid fans.
            while not (mids[0] is not None and (mids[1] is not None if count==2 else True)):
                a,b,c=b,c,a;mids=mids[1:]+mids[:1]
            ab=mids[0]
            if count==1:refined.extend(((a,ab,c),(ab,b,c)))
            else:
                bc=mids[1]
                refined.extend(((ab,b,bc),(a,ab,c),(ab,bc,c)))
        faces=refined
        for i,ring in enumerate(rings):
            new=[]
            for a,b in zip(ring,ring[1:]+ring[:1]):
                new.append(a)
                mid=split.get(tuple(sorted((a,b))))
                if mid is not None:new.append(mid)
            rings[i]=new
    out.append({'vertices':verts,'triangles':faces,'rings':rings})
destination.write_text(json.dumps({'patches':out,'area':footprint.area},separators=(',',':')))
print(json.dumps({'patches':len(out),'triangles':sum(len(p['triangles']) for p in out),'pavedArea':round(footprint.area,3)}),flush=True)
