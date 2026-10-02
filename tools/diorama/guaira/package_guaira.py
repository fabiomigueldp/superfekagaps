"""Package a fresh Blender export for the isolated map, preserving camera projections."""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--quality', type=int, default=92, choices=range(1, 101), help='WebP quality; 92 preserves the polish within the original payload budget')
args = parser.parse_args()
image = Image.open(args.input / 'guaira-diorama.png').convert('RGBA')
assert image.size == (1920, 1200), 'Never package a --draft render'
assert image.getchannel('A').getextrema() == (0, 255), 'Transparent scene required'
metadata = json.loads((args.input / 'guaira-diorama.meta.json').read_text())
assert metadata['worldId'] == 'guaira' and metadata['campaignIntegrated'] is False
for i in range(4):
    route = metadata['routes'][f'{i}:{i + 1}']
    for endpoint, node in [(route[0], metadata['nodes'][f'guaira-{i + 1}']), (route[-1], metadata['nodes'][f'guaira-{i + 2}'])]:
        assert endpoint == {k: node[k] for k in ['x', 'y']}
bounds = image.getchannel('A').getbbox()
metadata['artBounds'] = dict(zip(['left', 'top', 'right', 'bottom'], [bounds[0] / 1920, bounds[1] / 1200, bounds[2] / 1920, bounds[3] / 1200]))
metadata['status'] = 'experimental-isolated-map'
metadata['note'] = 'Projected Blender geometry for the isolated Guaíra experiment. No campaign world number, save schema, or persistent progress.'
args.output.mkdir(parents=True, exist_ok=True)
image.save(args.output / 'guaira-diorama.webp', quality=args.quality, method=6, exact=True)
(args.output / 'guaira-diorama.meta.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
print('Packaged 1920×1200 RGBA image and exact camera metadata.')
