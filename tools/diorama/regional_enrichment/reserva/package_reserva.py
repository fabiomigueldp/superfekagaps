"""Package audited Reserva base art without requiring review images or a cached scene."""
from pathlib import Path
from PIL import Image
import argparse, hashlib, json

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--render', required=True, type=Path)
parser.add_argument('--audit-dir', required=True, type=Path)
parser.add_argument('--output-dir', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent
for name in ['reserva-validation.json', 'connector-clearance.json']:
    audit = json.loads((args.audit_dir / name).read_text())
    assert audit['status'] == 'PASS', name
image = Image.open(args.render).convert('RGBA')
assert image.size == (1920, 1200)
alpha = image.getchannel('A')
box = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
assert box and min(box[:2]) > 0 and box[2] < 1920 and box[3] < 1200
assert all(alpha.crop(edge).getextrema()[1] == 0 for edge in [(0, 0, 1920, 1), (0, 1199, 1920, 1200), (0, 0, 1, 1200), (1919, 0, 1920, 1200)])
metadata = json.loads((root / 'source/baseline.meta.json').read_text())
metadata['artBounds'] = {key: value / dimension for key, value, dimension in zip(['left', 'top', 'right', 'bottom'], box, [1920, 1200, 1920, 1200])}
args.output_dir.mkdir(parents=True, exist_ok=True)
path = args.output_dir / 'reserva-diorama.webp'
image.save(path, 'WEBP', quality=92, method=6, alpha_quality=100)
decoded = Image.open(path).convert('RGBA')
assert decoded.size == image.size and decoded.getchannel('A').tobytes() == alpha.tobytes()
(args.output_dir / 'reserva-diorama.meta.json').write_text(json.dumps(metadata, indent=2) + '\n')
report = {'status': 'PASS', 'size': list(image.size), 'alphaBoundsThreshold8': list(box), 'baseReplacementOnly': True,
          'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [path, args.output_dir / 'reserva-diorama.meta.json']}}
(args.output_dir / 'package-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
