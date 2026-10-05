"""Package only the visible retaining-face neighborhood over existing Guaíra art.

Inputs are the current Blender color render and its export_terrace_mask.py mask.
This deliberately preserves all earlier authored RGB outside the bounded mask
before WebP encoding, and preserves the existing alpha byte-for-byte afterward.
Do not feed the output back as the baseline when reproducing this pass.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', type=Path, required=True)
parser.add_argument('--render', type=Path, required=True)
parser.add_argument('--mask', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--master', type=Path, required=True)
parser.add_argument('--quality', type=int, default=92)
args = parser.parse_args()
# This is a one-time authored pass, not a general image recompressor.
# Refuse its own output and any unreviewed baseline to prevent cumulative drift.
baseline_hash = hashlib.sha256(args.baseline.read_bytes()).hexdigest()
expected_quality = {
    'c2079e61d833233b2535f1f036d2e3c9836bfb80448fb73efea1ab2bd3852279': 92,
    'a19515eddae719c5697d54581ba576ca1fe19b61d32b20c75d2a444440f72d92': 91,
}
assert baseline_hash in expected_quality, 'Use the original reviewed c1bd522 Guaíra WebP baseline'
assert args.quality == expected_quality[baseline_hash], 'Keep the reviewed regional encoding quality'
base = Image.open(args.baseline).convert('RGBA')
render = Image.open(args.render).convert('RGBA')
mask_image = Image.open(args.mask).convert('RGB')
assert base.size == render.size == mask_image.size == (1920, 1200)
# White visible facing with a small contact-shadow neighborhood. The 7px outer
# falloff joins the existing master gently, with no full-frame color replacement.
mask = mask_image.getchannel('R').point(lambda v: 255 if v > 8 else 0)
visible_bounds = mask.getbbox()
assert visible_bounds, 'Missing visible facing'
mask = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2))
# Both images have a wholly opaque terrace interior; never modify silhouette.
alpha = base.getchannel('A')
mask_array = np.asarray(mask).copy()
mask_array[np.asarray(alpha) != 255] = 0
# The chapter's tiny earned-water vector uses this exact original receiver
# envelope. Exclude even the contact falloff there, retaining its master pixels.
protected = [908, 597, 37, 18] if expected_quality[baseline_hash] == 92 else None
if protected:
    x, y, w, h = protected
    mask_array[y:y + h, x:x + w] = 0
mask = Image.fromarray(mask_array)
master = Image.composite(render, base, mask)
master.putalpha(alpha)
source = np.asarray(base).astype(np.int16)
result = np.asarray(master).astype(np.int16)
active = mask_array > 0
assert np.array_equal(source[~active], result[~active])
assert np.array_equal(source[:, :, 3], result[:, :, 3])
args.master.parent.mkdir(parents=True, exist_ok=True)
master.save(args.master)
args.output.parent.mkdir(parents=True, exist_ok=True)
master.save(args.output, quality=args.quality, method=6, exact=True)
encoded = np.asarray(Image.open(args.output).convert('RGBA')).astype(np.int16)
assert np.array_equal(encoded[:, :, 3], source[:, :, 3])
drift = np.max(np.abs(encoded[:, :, :3] - result[:, :, :3]), axis=2)
changed = np.max(np.abs(encoded[:, :, :3] - source[:, :, :3]), axis=2)
report = {
    'baselineSHA256': hashlib.sha256(args.baseline.read_bytes()).hexdigest(),
    'outputSHA256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
    'size': list(base.size), 'quality': args.quality,
    'baselineBytes': args.baseline.stat().st_size,
    'outputBytes': args.output.stat().st_size,
    'deltaBytes': args.output.stat().st_size - args.baseline.stat().st_size,
    'visibleFacingBoundsXYXY': visible_bounds,
    'sourcePatchBoundsXYXY': mask.getbbox(),
    'sourcePatchPixels': int(active.sum()),
    'sourcePixelsOutsidePatchExact': True,
    'sourceAndEncodedAlphaExact': True,
    'protectedBairroWaterEnvelopeXYWH': protected,
    'protectedBairroSourcePixelsExact': True if protected else None,
    'codecDriftOutsidePatch': {
        'changedPixels': int(np.count_nonzero(drift[~active])),
        'meanMaxChannelDelta': float(drift[~active].mean()),
        'maxChannelDelta': int(drift[~active].max()),
        'pixelsAbove8': int(np.count_nonzero(drift[~active] > 8)),
        'note': 'Lossy WebP RGB re-encoding only; source RGB outside the facing neighborhood is exact.'
    },
    'wholeEncodedChangedRGBPixels': int(np.count_nonzero(changed)),
}
args.report.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
