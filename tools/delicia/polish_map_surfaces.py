"""Revision 8: continuous paving, without terrain poking through its surface.

Start with the preserved v7 model; paths, camera, architecture and animation
anchors remain authored in the same scene. --draft renders a review preview.
"""
import bpy
import bmesh
import json
import shutil
import subprocess
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/world/delicia'
REVIEW = ROOT / 'output/delicia/wayfinding-polish-2026-10-11'
REVIEW.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/delicia'))
from export_island_navigation import export_island

scene = bpy.context.scene
audit_only = '--audit-only' in sys.argv
assert scene.get('model_revision') == (8 if audit_only else 7), 'Use v7 to author, v8 to audit.'
terrain = next(o for o in scene.objects if o.name.startswith('Continuous landmass'))
paving = [o for o in scene.objects if o.name.startswith('Unified masonry paving') and not o.hide_render]
assert len(paving) == 6

# Freeze quad diagonals before fitting. Otherwise Blender can flip a diagonal
# after the height edit and create a new intersection between corrected corners.
# BMesh carries the existing vertex tint and smooth shading into the triangles.
if not audit_only:
    bm = bmesh.new()
    bm.from_mesh(terrain.data)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(terrain.data)
    bm.free()
    terrain.data.update()
terrain.data.calc_loop_triangles()
terrain_vertices = [list(terrain.matrix_world @ v.co) for v in terrain.data.vertices]
terrain_faces = [list(t.vertices) for t in terrain.data.loop_triangles]
road_vertices, road_faces = [], []
for obj in paving:
    obj.data.calc_loop_triangles()
    start = len(road_vertices)
    road_vertices.extend(list(obj.matrix_world @ v.co) for v in obj.data.vertices)
    road_faces.extend([start + i for i in t.vertices] for t in obj.data.loop_triangles
                      if obj.data.polygons[t.polygon_index].material_index == 0)

prefix = 'terrain-export-audit' if audit_only else 'terrain-contact'
contact_input = REVIEW / (prefix + '-input.json')
contact_output = REVIEW / (prefix + '-output.json')
contact_input.write_text(json.dumps({
    'terrain': {'vertices': terrain_vertices, 'triangles': terrain_faces},
    'paving': {'vertices': road_vertices, 'triangles': road_faces},
}, separators=(',', ':')), encoding='utf-8')
python = shutil.which('python')
assert python, 'System Python with Shapely is required.'
subprocess.run([python, str(ROOT / 'tools/delicia/fit_paving_terrain.py'),
                str(contact_input), str(contact_output)], check=True)
result = json.loads(contact_output.read_text(encoding='utf-8'))
if audit_only:
    assert result['audit']['intersectionsBefore'] == 0, 'Exported terrain still breaks through paving.'
    (REVIEW / 'export-surface-audit.json').write_text(json.dumps(result['audit'], indent=2) + '\n', encoding='utf-8')
    print('EXPORTED SURFACES VERIFIED', flush=True)
    sys.exit(0)
inverse = terrain.matrix_world.inverted()
for index, z in result['vertices'].items():
    point = Vector(terrain_vertices[int(index)])
    point.z = z
    terrain.data.vertices[int(index)].co = inverse @ point
terrain.data.update()
terrain['v8_finish'] = 'Terrain fitted beneath the complete triangulated paving footprint, including shoulders and junctions.'
(REVIEW / 'surface-audit.json').write_text(json.dumps(result['audit'], indent=2) + '\n', encoding='utf-8')

metadata = json.loads((SOURCE / 'island-map-v7.json').read_text(encoding='utf-8'))
routes = {obj.name.split(' • ')[0]: [obj.matrix_world @ Vector(p.co[:3]) for p in obj.data.splines[0].points]
          for obj in scene.objects if obj.type == 'CURVE' and 'from' in obj}
export_island(scene, metadata, routes, 8, SOURCE, REVIEW,
              '--draft' in sys.argv, '--no-render' not in sys.argv)
