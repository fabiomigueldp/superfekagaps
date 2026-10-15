"""Extract fitted coping runs from the actual paving and open walking thresholds."""
import json
import sys
from pathlib import Path
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

source, destination = map(Path, sys.argv[1:3])
data = json.loads(source.read_text(encoding='utf-8'))
vertices = data['vertices']
footprint = unary_union([Polygon([vertices[i][:2] for i in face]) for face in data['triangles']])
openings = unary_union([Polygon(points).convex_hull for points in data['openings']]).buffer(.095)
polygons = [footprint] if footprint.geom_type == 'Polygon' else list(footprint.geoms)
runs = []
for polygon in polygons:
    polygon = orient(polygon, sign=1)
    for ring in [polygon.exterior, *polygon.interiors]:
        line = LineString(ring.coords).simplify(.004)
        cut = line.difference(openings)
        pieces = [cut] if cut.geom_type == 'LineString' else list(cut.geoms)
        for piece in pieces:
            if piece.length > .12:
                runs.append([list(p) for p in piece.coords])
destination.write_text(json.dumps({'runs': runs, 'area': footprint.area}, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'copingRuns': len(runs), 'pavedArea': round(footprint.area, 3)}), flush=True)
