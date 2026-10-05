"""Validate the encoded terrace pass against its fixed reviewed baseline.

Run from any directory with Python + Pillow + NumPy after packaging. This is
asset/contract QA, not browser, GPU, scene-geometry, or full repository testing.
"""
import hashlib
import json
import subprocess
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[3]
base = 'c1bd522463b23998e68272542f13558dbf63edc6'
report = json.loads((root / 'docs/world/diorama/guaira-terrace/validation.json').read_text())

def original(path):
    return subprocess.check_output(['git', '-C', str(root), 'show', f'{base}:{path}'])

for region, path in [('chapter', 'public/assets/world/experimental/guaira/guaira-diorama.webp'),
                     ('atlas', 'public/assets/world/map/guaira-campaign/guaira.webp')]:
    data = (root / path).read_bytes()
    summary = report['assets'][region]
    assert hashlib.sha256(data).hexdigest() == summary['outputSHA256']
    assert len(data) == summary['outputBytes']
    image = Image.open(BytesIO(data)).convert('RGBA')
    before = Image.open(BytesIO(original(path))).convert('RGBA')
    assert image.size == before.size == (1920, 1200)
    assert np.array_equal(np.asarray(image.getchannel('A')), np.asarray(before.getchannel('A')))

for path in report['unchangedFiles']:
    assert (root / path).read_bytes() == original(path), path

path = 'public/assets/world/map/guaira-campaign/guaira.meta.json'
metadata = json.loads((root / path).read_text())
before = json.loads(original(path))
assert metadata['image']['bytes'] == report['assets']['atlas']['outputBytes']
assert metadata['validation']['objects'] == before['validation']['objects'] + 30
metadata['image']['bytes'] = before['image']['bytes']
metadata['validation']['objects'] = before['validation']['objects']
assert metadata == before, 'Any navigation or framing edit is outside this art pass'

optional = sum((root / f'public/assets/world/map/guaira-campaign/{name}.webp').stat().st_size
               for name in ['fabrica', 'guaira', 'serra'])
assert optional < 500_000
print(json.dumps({'alphaAndFrameExact': True, 'unchangedAssetContracts': len(report['unchangedFiles']),
                  'metadataOnlyBytesAndObjectCount': True, 'campaignArtBytes': optional,
                  'campaignArtBudget': 500_000}, indent=2))
