"""Render only a source-matched Factory cache, into a separate staged output.
blender -b .cache/diorama/fabrica/fabrica-map-prototype.blend --python-exit-code 1
  -P tools/diorama/render_fabrica_cached.py -- --output-dir .cache/diorama/fabrica-cached
"""
import argparse
import json
import runpy
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fabrica_tools import (DEFAULT_OUTPUT, ROOT, read_json, sha256, source_hashes,
                           stage_render_record, validate_geometry, write_json)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT.with_name('fabrica-cached'))
options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
scene = bpy.context.scene
cache = Path(bpy.data.filepath)
if not cache.is_file() or 'fabrica_source_hashes' not in scene:
    raise ValueError('Cache has no current source provenance; rebuild with render_fabrica_map.py --scene-only.')
provenance = read_json(cache.parent / 'fabrica-source-provenance.json')
if provenance['sceneSha256'] != sha256(cache) or provenance['sourceHashes'] != source_hashes():
    raise ValueError('Factory cache or source files changed; rebuild the scene from current source.')
if json.loads(scene['fabrica_source_hashes']) != source_hashes():
    raise ValueError('Factory cache embeds obsolete source hashes.')
meta = json.loads(scene['fabrica_metadata'])
validate_geometry(meta, read_json(ROOT / 'public/assets/world/map/fabrica-diorama.meta.json'))
output = options.output_dir.resolve()
if output == cache.parent:
    raise ValueError('Cached rendering requires a separate output directory to retain its source proof.')
export, docs = output / 'export', output / 'audit'
export.mkdir(parents=True, exist_ok=True)
docs.mkdir(parents=True, exist_ok=True)
scene.render.resolution_percentage = 100
scene.cycles.samples = 192
scene.cycles.use_denoising = False
scene.render.use_border = False
scene.render.use_crop_to_border = False
meta = runpy.run_path(str(ROOT / 'tools/diorama/check_fabrica_clearance.py'),
                     init_globals={'FABRICA_META': meta, 'FABRICA_OUT': str(export),
                                   'FABRICA_DOC': str(docs)}, run_name='__main__')['meta']
scene.render.filepath = str(export / 'fabrica-diorama.png')
bpy.ops.render.render(write_still=True)
from array import array
image = bpy.data.images.load(scene.render.filepath, check_existing=False)
width, height = image.size
pixels = array('f', [0]) * (width * height * 4)
image.pixels.foreach_get(pixels)
occupied = [i for i in range(width * height) if pixels[i * 4 + 3] > 0]
if not occupied:
    raise ValueError('Factory render contains no opaque pixels.')
xs, ys = [i % width for i in occupied], [i // width for i in occupied]
meta['artBounds'] = {'left': round(min(xs) / width, 6), 'right': round((max(xs) + 1) / width, 6),
                     'top': round(1 - (max(ys) + 1) / height, 6), 'bottom': round(1 - min(ys) / height, 6)}
write_json(export / 'fabrica-diorama.meta.json', meta)
scene['fabrica_metadata'] = json.dumps(meta)
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'fabrica-map-prototype.blend'))
stage_render_record(output, meta, scene, bpy.app.version_string, True)
print('FABRICA_CACHED_RENDER=' + scene.render.filepath)
