"""Package only approved passenger-link overlays/metadata from a scratch build.

python tools/diorama/package_serra_reserva_link.py --source /tmp/feka-link
Requires the passing targeted audit and all exact source hashes; never copies a
.blend, reference image or work-in-progress proof into the repository.
"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
args = parser.parse_args()
meta = json.loads((args.source/'serra-reserva-link.meta.json').read_text())
audit = json.loads((args.source/'serra-reserva-clearance.json').read_text())
assert audit['passed'], 'The exact combined link audit must pass before packaging'
assert all(hashlib.sha256((ROOT/name).read_bytes()).hexdigest() == sha for name, sha in meta['sources'].items()), 'Source drift after frozen render'
assert len(meta['overlays']) == 6, 'Two static endpoints plus four raised closed barriers'
assets = ROOT/'public/assets/world/map'
docs = ROOT/'docs/world/diorama'
assets.mkdir(parents=True, exist_ok=True)
docs.mkdir(parents=True, exist_ok=True)
packed = []
for entry in meta['overlays']:
    target = assets/Path(entry['path']).name
    source = args.source/(target.stem+'.png')
    image = Image.open(source).convert('RGBA')
    assert image.size == (entry['width'], entry['height']), (source, image.size, entry)
    assert abs(entry['widthInMap']-image.width/1920) < 1e-8
    assert abs(entry['heightInMap']-image.height/1200) < 1e-8
    assert image.getextrema()[3][1] > 0, f'Empty overlay {source}'
    image.save(target, 'WEBP', quality=94, method=6)
    with Image.open(target) as verified:
        assert verified.size == image.size and verified.mode == 'RGBA'
    packed.append({'path': str(target.relative_to(ROOT)), 'bytes': target.stat().st_size,
                   'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
runtime_keys = ['version', 'connection', 'coordinateSystem', 'placements', 'stations', 'lanes',
                'paintOrder', 'rideDurationSeconds', 'atlas', 'frame', 'overlays', 'cablePolylines']
runtime = {key: meta[key] for key in runtime_keys}
(assets/'serra-reserva-link.meta.json').write_text(json.dumps(runtime, indent=2)+'\n')
approved = {**meta, 'status': 'approved-source-rebuild', 'assets': packed,
            'audit': {key: audit[key] for key in ['passed', 'step', 'scope', 'method', 'passengerSweep',
                                                 'maintenancePreservationSweep', 'support', 'newActorVisibility',
                                                 'oldActorPreservation', 'preservation']}}
(docs/'serra-reserva-link-approved.meta.json').write_text(json.dumps(approved, indent=2)+'\n')
print(json.dumps({'runtime': 'public/assets/world/map/serra-reserva-link.meta.json',
                  'overlays': len(packed), 'overlayBytes': sum(x['bytes'] for x in packed),
                  'auditPassed': audit['passed']}, indent=2))
