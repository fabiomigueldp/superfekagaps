"""Package rendered buoys with the approved placement contract into scratch.

python tools/diorama/package_maritime_buoys.py --source /tmp/feka-maritime-buoys
Pass --output-dir explicitly to choose another destination. Installation remains
a separate reviewed copy; this command does not publish or change runtime files.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output-dir', type=Path)
args = parser.parse_args()
source = args.source.resolve()
destination = (args.output_dir or source / 'package').resolve()
destination.mkdir(parents=True, exist_ok=True)
runtime = json.loads((ROOT / 'public/assets/world/map/maritime-buoys.meta.json').read_text())
authored = json.loads((source / 'maritime-buoys-source.meta.json').read_text())
records = []
for variant in authored['variants']:
    key = {'coral-conical': 'coral', 'sage-can': 'sage'}[variant['kind']]
    expected = runtime['sprites'][key]
    assert variant['frame'] == {'width': expected['width'], 'height': expected['height']}
    assert abs(variant['widthInMap'] - expected['widthInMap']) < 1e-10
    assert all(abs(variant['waterlineAnchor'][axis] - expected['waterlineAnchor'][axis]) < 1e-4 for axis in ['x', 'y'])
    image = Image.open(source / variant['image']).convert('RGBA')
    assert image.size == (expected['width'], expected['height']) and image.getextrema()[3][1] > 0
    output = destination / Path(expected['path']).name
    image.save(output, 'WEBP', quality=90, method=6)
    records.append({'path': output.name, 'bytes': output.stat().st_size,
                    'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
assert {record['path'] for record in records} == {'maritime-buoy-coral.webp', 'maritime-buoy-sage.webp'}
(destination / 'maritime-buoys.meta.json').write_text(json.dumps(runtime, indent=2) + '\n')
print(json.dumps({'output': str(destination), 'assets': records,
                  'imageBytes': sum(record['bytes'] for record in records)}, indent=2))
