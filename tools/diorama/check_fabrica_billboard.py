"""Physical atlas actor clearance and separate pixel-envelope diagnostics.
Physical geometry uses atlasActorBounds; tiny panorama pixel overdraw is retained
as a visual diagnostic rather than interpreted as a change to collision geometry.
"""
import collections
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from fabrica_tools import validate_envelopes, write_json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
DOC = globals().get('FABRICA_DOC', os.path.join(ROOT, 'docs/world/diorama'))
meta = FABRICA_META
scene = bpy.context.scene
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
camera = scene.camera
profiles = validate_envelopes(meta)
basis = camera.rotation_euler.to_matrix()
right, up, toward = basis @ Vector((1, 0, 0)), basis @ Vector((0, 1, 0)), basis @ Vector((0, 0, 1))
width = camera.data.ortho_scale
height = width * 1200 / 1920


def sample(bounds):
    contacts = []
    samples = 0
    for kind, routes in meta['worldRoutes'].items():
        for route_index, route in enumerate(routes):
            for segment, (aa, bb) in enumerate(zip(route['world'], route['world'][1:])):
                a, b = Vector(aa), Vector(bb)
                steps = max(2, math.ceil((b - a).length / .13))
                for step in range(steps + 1):
                    foot = a.lerp(b, step / steps)
                    for x in (bounds['left'], 0, bounds['right']):
                        for fraction in (.10, .25, .50, .75, 1.0):
                            y = -bounds['top'] * fraction
                            # A world-upright body, rather than camera-up lifting its
                            # head behind the actual actor into the rear facade.
                            point = foot + right * x * width + Vector((0, 0, y * height / up.z))
                            samples += 1
                            hit, location, normal, index, obj, matrix = scene.ray_cast(
                                deps, point + toward * .015, toward, distance=40)
                            if hit:
                                expected = obj.name.startswith('walk_') or 'rail' in obj.name or 'stringer' in obj.name
                                contacts.append({'route': kind + ':' + str(route_index), 'segment': segment,
                                                 't': round(step / steps, 4), 'normalizedOffset': [round(x, 6), round(-y, 6)],
                                                 'bodyFractionAboveFoot': fraction, 'object': obj.name,
                                                 'distanceTowardCamera': round((location - point).length, 4),
                                                 'classification': 'path-edge-or-guardrail' if expected else 'equipment-or-scenery'})
    equipment = [contact for contact in contacts if contact['classification'] == 'equipment-or-scenery']
    return {'sampleCount': samples, 'equipmentContactCount': len(equipment),
            'pathEdgeContactCount': len(contacts) - len(equipment),
            'objects': dict(collections.Counter(contact['object'] for contact in contacts)), 'contacts': contacts}


physical = sample(profiles['physicalNormalized'])
cache = {}
results = []
for case in profiles['profiles']:
    key = tuple(round(case['normalized'][field], 12) for field in ('left', 'top', 'right', 'bottom'))
    if key not in cache:
        cache[key] = sample(case['normalized'])
    results.append({**case, **cache[key]})
raster_contacts = sum(case['equipmentContactCount'] for case in results)
report = {'method': 'Camera-directed rays at three horizontal and five vertical samples per <=0.13 world-unit route step. Physical body uses current atlasActorBounds, independently of zoom. Pixel-envelope overdraw is sampled separately and retained as a panorama visual diagnostic. Conservative full-grid contacts do not claim opaque sprite-pixel collisions.',
          'model': profiles['model'], 'metadataSha256': profiles['metadataSha256'], 'sourceHashes': profiles['sourceHashes'],
          'scope': profiles['scope'], 'footNote': 'Lowest body sample is 10% of height. Foot support and shadow are separate checks.',
          'sampleCount': physical['sampleCount'], 'equipmentContactCount': physical['equipmentContactCount'],
          'pathEdgeContactCount': physical['pathEdgeContactCount'],
          'physicalNormalized': profiles['physicalNormalized'], 'physical': physical,
          'rasterSampleCount': sum(case['sampleCount'] for case in cache.values()),
          'rasterEquipmentContactCount': raster_contacts, 'profiles': results}
write_json(os.path.join(DOC, 'fabrica-billboard-clearance.json'), report)
meta['billboardAuditSummary'] = {key: report[key] for key in
                               ('sampleCount', 'equipmentContactCount', 'pathEdgeContactCount', 'rasterSampleCount', 'rasterEquipmentContactCount')}
print('FABRICA_BILLBOARD=' + json.dumps(meta['billboardAuditSummary']))
if not physical['sampleCount'] or physical['equipmentContactCount']:
    raise ValueError('Factory physical atlas actor intersects foreground equipment; inspect its physical report.')
