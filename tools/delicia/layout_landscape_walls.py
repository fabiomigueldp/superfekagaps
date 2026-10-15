"""Cut landscape walls at the actual paved approaches, preserving walk openings."""
import json
import sys
from pathlib import Path
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

source, destination = map(Path, sys.argv[1:3])
data = json.loads(source.read_text(encoding='utf-8'))
vertices = data['paving']['vertices']
footprint = unary_union([Polygon([vertices[i][:2] for i in face]) for face in data['paving']['triangles']])
clearance = footprint.buffer(.32)
result = []
audit = []
for wall in data['walls']:
    cut = LineString(wall['points']).difference(clearance)
    runs = [cut] if cut.geom_type == 'LineString' else list(cut.geoms)
    kept = [list(line.coords) for line in runs if line.length > .60]
    result.append({'name': wall['name'], 'height': wall['height'], 'runs': kept})
    for index, run in enumerate(kept):
        # Include the square pier caps: their diagonal is wider than a round
        # curb end, especially where a wall meets the road at an oblique angle.
        envelope = unary_union([LineString(run).buffer(.175)] +
                              [box(x-.20,y-.20,x+.20,y+.20) for x,y in (run[0],run[-1])])
        overlap = envelope.intersection(footprint).area
        assert overlap < 1e-8, f'Wall cap crosses the pavement: {wall["name"]}'
        audit.append({'name':wall['name'],'run':index+1,'pavingOverlapM2':overlap,
                      'minimumClearanceM':round(envelope.distance(footprint),5)})
destination.write_text(json.dumps(result), encoding='utf-8')
destination.with_name('wall-clearance-audit.json').write_text(json.dumps(audit,indent=2)+'\n', encoding='utf-8')
print(json.dumps({'walls': len(result), 'runs': sum(len(w['runs']) for w in result)}), flush=True)
