"""Package one freshly audited native-resolution Reserva render. Requires Pillow.

python tools/diorama/package_reserva_map.py --input-dir /tmp/reserva-final \
  --audit /tmp/reserva-audit/reserva-validation.json --output-dir /tmp/reserva-runtime
Use --docs-dir to put the concise manifest and gate report with project docs.
No .blend file, cached render or earlier island asset is an input.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--input-dir', required=True)
parser.add_argument('--audit', required=True)
parser.add_argument('--output-dir', default='/tmp/feka-reserva-runtime')
parser.add_argument('--docs-dir')
args = parser.parse_args()
root, out = Path(args.input_dir), Path(args.output_dir)
docs = Path(args.docs_dir) if args.docs_dir else out
repo = Path(__file__).resolve().parents[2]
out.mkdir(parents=True, exist_ok=True)
docs.mkdir(parents=True, exist_ok=True)
source = json.loads((root / 'reserva-prototype.meta.json').read_text())
audit = json.loads(Path(args.audit).read_text())
builder = repo / 'tools/diorama/render_reserva_map.py'
builder_hash = hashlib.sha256(builder.read_bytes()).hexdigest()
assert audit['status'] == 'PASS', 'Final frozen-source actor and structure gates must pass'
assert audit['builder']['sha256'] == builder_hash, 'Source changed after final audit'
assert audit['metadataSha256'] == hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest(), 'Render/audit metadata differ'
assert source['placementProposal'] == {'origin': {'x': 2.7, 'y': -1.8}, 'scale': 1}
picture = Image.open(root / 'reserva-diorama.png').convert('RGBA')
assert picture.size == (1920, 1200), 'Use the builder with --final --static'
box = picture.getchannel('A').getbbox()
assert box and 0 < box[0] < box[2] < 1920 and 0 < box[1] < box[3] < 1200, 'Clipped or empty island frame'
bounds = {'left': box[0] / 1920, 'top': box[1] / 1200, 'right': box[2] / 1920, 'bottom': box[3] / 1200}
picture.save(out / 'reserva-diorama.webp', quality=93, method=6)
decoded = Image.open(out / 'reserva-diorama.webp').convert('RGBA')
assert decoded.size == picture.size and decoded.getchannel('A').getbbox() == box
metadata = {key: source[key] for key in ['version', 'world', 'size', 'camera', 'nodes', 'routes', 'secretRoute',
                                        'routeDurationsSeconds', 'secretDurationSeconds', 'stationApproachDurationSeconds']}
metadata['coordinateSystem'] = 'Normalized top-left image space in the complete1920x1200 frame; worldZ is up.'
metadata['artBounds'] = bounds
(out / 'reserva-diorama.meta.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
validation = {key: audit[key] for key in ['status', 'scope', 'builder', 'checker', 'metadataSha256', 'methods',
                                         'sampleStepWorld', 'routeSampleCount', 'footprintRayCount', 'headroomRayCount',
                                         'actualFekaWorldPixel', 'actualFekaWorldHeight', 'physicalCounts', 'pierCount']}
validation['allActiveRoutePiersRooted'] = all(p['rooted'] for p in audit['piers'])
validation['sourceProjection'] = {k: v for k, v in audit['sourceProjection'].items() if k != 'firstContacts'}
validation['rasterProfiles'] = [{k: v for k, v in p.items() if k != 'firstContacts'} for p in audit['rasterProfiles']]
validation['browserGate'] = 'Authoring gates pass; browser walkthrough and combined passenger-link gates belong to integration.'
(docs / 'reserva-validation.json').write_text(json.dumps(validation, indent=2) + '\n')
manifest = {'status': 'frozen-source-physical-original-sprite-and-raster-gates-pass-browser-integration-pending',
            'sourceBuilder': str(builder.relative_to(repo)), 'builderSha256': builder_hash,
            'checker': 'tools/diorama/check_reserva_map.py', 'packager': 'tools/diorama/package_reserva_map.py',
            'validation': 'docs/world/diorama/reserva-validation.json', 'size': source['size'],
            'placement': source['placementProposal'], 'alphaBoundsPixels': list(box), 'artBounds': bounds,
            'quality': 93, 'actorsOrPassengerCabinsBaked': False,
            'timingCalibration': source['timingCalibration'], 'mainRouteSeconds': source['routeDurationsSeconds'],
            'shippingShortcutSeconds': source['secretDurationSeconds'],
            'stationApproachSeconds': source['stationApproachDurationSeconds'],
            'futureHeatedDock': 'Reserved boundary only; no world6 route or new physics.', 'files': []}
for name in ['reserva-diorama.webp', 'reserva-diorama.meta.json']:
    content = (out / name).read_bytes()
    manifest['files'].append({'path': '/assets/world/map/' + name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
(docs / 'reserva-art-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
