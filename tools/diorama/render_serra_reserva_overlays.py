"""Focused terminal overlay export with depth holdouts from the frozen scene.

blender -b /tmp/link/serra-reserva-link.blend -t 8 \
  -P tools/diorama/render_serra_reserva_overlays.py -- --output-dir /tmp/link-occlusion

Renders only the two terminal overlays. Island/cabin assets, camera/route metadata
and all geometry remain untouched. Also imported by the full source builder.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]


def set_overlay_visibility(scene, targets):
    """Keep fixed scene depth as alpha holdouts instead of making X-ray art."""
    targets = set(targets)
    count = 0
    for obj in scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        moving = (obj.name.startswith(('maintenance carrier ', 'passenger carrier ', 'proof ')) or
                  obj.get('link_group') in {'carrier', 'cables'} or obj.get('gate_moving'))
        holdout = obj not in targets and not moving
        obj.hide_render = obj not in targets and not holdout
        obj.is_holdout = holdout
        count += int(holdout)
    bpy.context.view_layer.update()
    return count


def geometry_digest(scene):
    digest = hashlib.sha256()
    for obj in sorted(scene.objects, key=lambda o: o.name):
        if obj.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        digest.update(json.dumps([obj.name, obj.type, [list(row) for row in obj.matrix_world]], separators=(',', ':')).encode())
        if obj.type == 'MESH':
            digest.update(json.dumps([[list(v.co) for v in obj.data.vertices], [list(p.vertices) for p in obj.data.polygons]], separators=(',', ':')).encode())
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, default=ROOT/'public/assets/world/map/serra-reserva-link.meta.json')
    parser.add_argument('--samples', type=int, default=32)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    camera = scene.camera
    meta = json.loads(args.metadata.read_text())
    before = geometry_digest(scene)
    original_location, original_scale = camera.location.copy(), camera.data.ortho_scale
    original_size = scene.render.resolution_x, scene.render.resolution_y
    saved_visibility = {obj.name: (obj.hide_render, obj.is_holdout) for obj in scene.objects}
    rendered = []
    for terminal in ['lower', 'upper']:
        targets = [obj for obj in scene.objects if obj.get('link_group') == terminal and not obj.get('gate_moving')]
        layer = next(layer for layer in meta['overlays'] if layer['path'].endswith(terminal+'-terminal.webp'))
        count = set_overlay_visibility(scene, targets)
        left, top, width, height = [layer[key] for key in ['left', 'top', 'widthInMap', 'heightInMap']]
        camera.location = original_location+camera.rotation_euler.to_matrix()@Vector(
            (((left-2.78)+width/2-.5)*20.6, -((top+.65)+height/2-.5)*12.875, 0))
        camera.data.ortho_scale = 20.6*width
        scene.render.resolution_x, scene.render.resolution_y = layer['width'], layer['height']
        scene.render.resolution_percentage = 100
        scene.cycles.samples = args.samples
        scene.render.film_transparent = True
        target = args.output_dir/(Path(layer['path']).stem+'.png')
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        rendered.append({'terminal': terminal, 'file': target.name, 'holdoutObjects': count,
                         'width': layer['width'], 'height': layer['height']})
    camera.location, camera.data.ortho_scale = original_location, original_scale
    scene.render.resolution_x, scene.render.resolution_y = original_size
    for obj in scene.objects:
        obj.hide_render, obj.is_holdout = saved_visibility[obj.name]
    bpy.context.view_layer.update()
    after = geometry_digest(scene)
    assert before == after, 'Overlay export modified scene geometry'
    record = {'geometryUnchanged': True, 'geometrySha256': before,
              'metadataSha256': hashlib.sha256(args.metadata.read_bytes()).hexdigest(),
              'method': 'Cycles object holdouts from all fixed scene geometry preserve real front/back occlusion; moving carriers, cables, actors and retracted gates are excluded.',
              'rendered': rendered,
              'exportSource': str(Path(__file__).relative_to(ROOT)),
              'exportSourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (args.output_dir/'occlusion-export.json').write_text(json.dumps(record, indent=2)+'\n')
    print('OCCLUSION_EXPORT='+json.dumps(record), flush=True)


if __name__ == '__main__':
    main()
