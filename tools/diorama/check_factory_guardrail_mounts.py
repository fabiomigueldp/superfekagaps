"""Read-only evaluated-mesh connectivity test for Factory ramp guardrails.

Run on a fresh Factory scene:
blender -b /tmp/fabrica-map-prototype.blend --python-exit-code 1 \
  -P tools/diorama/check_factory_guardrail_mounts.py -- --output-dir /tmp/factory-rail-audit
The original unconnected rail scene is an expected negative control.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
options = parser.parse_args(args)
options.output_dir.mkdir(parents=True, exist_ok=True)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene
posts = sorted((ob for ob in scene.objects if ob.name.startswith(
    ('quality access rail upright', 'maintenance rail upright'))), key=lambda ob: ob.name)
sockets = [ob for ob in scene.objects if ob.name.startswith('enrich_ramp_guardrail_mounts guardrail post socket')]
ties = [ob for ob in scene.objects if ob.name.startswith('enrich_ramp_guardrail_mounts guardrail slab outrigger')]
assert len(posts) == 12, 'Expected the twelve unchanged original ramp uprights'
cache = {}

def geometry(ob):
    if ob.name not in cache:
        evaluated = ob.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [list(face.vertices) for face in mesh.polygons]
        cache[ob.name] = (BVHTree.FromPolygons(vertices, polygons), vertices)
        evaluated.to_mesh_clear()
    return cache[ob.name]


def xy_distance(a, b):
    return ((a.location.x - b.location.x) ** 2 + (a.location.y - b.location.y) ** 2) ** .5


results = []
for post in posts:
    slab = scene.objects['walk_main inspection lane 3' if post.name.startswith('quality')
                         else 'walk_dry maintenance catwalk']
    socket = min(sockets, key=lambda ob: xy_distance(ob, post), default=None)
    tie = min(ties, key=lambda ob: xy_distance(ob, post), default=None)
    if socket is not None and xy_distance(socket, post) > 1e-4:
        socket = None
    if tie is not None and xy_distance(tie, post) > .063:
        tie = None
    post_bvh, post_vertices = geometry(post)
    slab_bvh, _ = geometry(slab)
    # The minimum distance is sampled at every evaluated upright vertex.
    # The positive original separation is independent of missing new parts.
    gap = min(slab_bvh.find_nearest(vertex)[3] for vertex in post_vertices)
    counts = {'postToSocket': 0, 'socketToOutrigger': 0, 'outriggerToSlab': 0}
    if socket is not None and tie is not None:
        socket_bvh, _ = geometry(socket)
        tie_bvh, _ = geometry(tie)
        counts = {'postToSocket': len(post_bvh.overlap(socket_bvh)),
                  'socketToOutrigger': len(socket_bvh.overlap(tie_bvh)),
                  'outriggerToSlab': len(tie_bvh.overlap(slab_bvh))}
    results.append({'post': post.name, 'slab': slab.name,
                    'socket': socket.name if socket else None,
                    'outrigger': tie.name if tie else None,
                    'unchangedUprightToSlabVertexGap': round(gap, 6),
                    'intersectingTrianglePairs': counts,
                    'connected': all(count > 0 for count in counts.values())})
report = {'method': 'World-space BVH intersections of evaluated mesh triangles; no AABB-only approval',
          'postCount': len(posts), 'socketCount': len(sockets), 'outriggerCount': len(ties),
          'connectedCount': sum(result['connected'] for result in results), 'posts': results}
(options.output_dir / 'factory-guardrail-mounts.json').write_text(json.dumps(report, indent=2) + '\n')
print('FACTORY_GUARDRAIL_MOUNTS=' + json.dumps({key: value for key, value in report.items() if key != 'posts'}))
assert len(sockets) == len(ties) == len(posts) == 12, 'Missing or duplicated guardrail mounts'
assert report['connectedCount'] == 12, 'Disconnected post, socket, outrigger or actual ramp slab'
