"""Package island-name blanks and prove original bitmap labels at native size.

python tools/diorama/package_map_island_signs.py --repo-root REPO \
  --render-dir RENDERS --output-dir ASSETS --proof-dir PROOFS

Only the atlas and runtime metadata are emitted into ASSETS. PROOFS contains
the labelled 1x/3x contact sheets and validation JSON, and should stay outside
Git. Optional --verify-against ASSETS compares both deliverables byte-for-byte.
Requires Pillow and NumPy; the Blender renderer supplies DPR4 PNGs.
"""
import argparse
import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root', type=Path, required=True)
parser.add_argument('--render-dir', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--proof-dir', type=Path)
parser.add_argument('--verify-against', type=Path)
args = parser.parse_args()
repo, renders, output = args.repo_root.resolve(), args.render_dir.resolve(), args.output_dir.resolve()
proof = args.proof_dir.resolve() if args.proof_dir else None
frozen = args.verify_against.resolve() if args.verify_against else None
if frozen == output:
    parser.error('Verification output must differ from the frozen assets')
output.mkdir(parents=True, exist_ok=True)
if proof:
    proof.mkdir(parents=True, exist_ok=True)
kinds = ['island', 'island-selected', 'island-locked']
labels = ['1 COSTA', '2 PORTO', '3 FÁBRICA', '4 SERRA', '5 RESERVA', '6 DOMÍNIO']
metas = json.loads((renders / 'island-signs.render.meta.json').read_text())
if [frame['kind'] for frame in metas] != kinds:
    raise ValueError('Render all three island states in canonical order')
font = (repo / 'src/graphics/BitmapFont.ts').read_text()
glyphs = {match.group(1) or match.group(2): match.group(3).split('/')
          for match in re.finditer(r"(?:'([^']+)'|\b([A-Z]))\s*:\s*'([01/]+)'", font)}


def advance(char):
    return 4 if char == ' ' else len(glyphs[unicodedata.normalize('NFD', char)[0]][0]) + 1


def text_width(label):
    return (sum(advance(char) for char in label) - 1) * 2


def glyph_cells(label, center):
    # Match BitmapFont.pixelText including JS Math.round and acute accent cells.
    x, y = math.floor(center['x'] - text_width(label) / 2 + .5), math.floor(center['y'] - 7 + .5)
    cells = []
    for char in label:
        if char != ' ':
            decomposed = unicodedata.normalize('NFD', char)
            for row_y, row in enumerate(glyphs[decomposed[0]]):
                for row_x, bit in enumerate(row):
                    if bit == '1':
                        cells.append((x + row_x * 2, y + row_y * 2))
            if len(decomposed) > 1:
                if decomposed[1] != '\u0301':
                    raise ValueError('Review proof renderer for newly introduced accent')
                cells.extend([(x + 6, y - 4), (x + 4, y - 2)])
        x += advance(char) * 2
    return cells


atlas = Image.new('RGBA', (768, 88))
frames = []
for index, meta in enumerate(metas):
    if (meta['cssWidth'], meta['cssHeight'], meta['dpr']) != (128, 44, 4):
        raise ValueError('Each intermediate must be 128 x 44 CSS at DPR4')
    if meta['letterPixelScale'] != 2 or meta['palette']['letters'] != '#191f35':
        raise ValueError('Preserve original bitmap scale and ink color')
    image = Image.open(renders / meta['image']).convert('RGBA')
    if image.size != (512, 176):
        raise ValueError('Unexpected intermediate dimensions')
    pixels = np.array(image)
    height, width = pixels.shape[:2]
    yy, xx = np.mgrid[:height, :width]
    fade = np.minimum.reduce([xx / 16, (width - 1 - xx) / 16,
                              yy / 16, (height - 1 - yy) / 16,
                              np.ones_like(xx)]).clip(0, 1)
    pixels[:, :, 3] = np.where(pixels[:, :, 3] < 170,
                               pixels[:, :, 3] * fade, pixels[:, :, 3]).astype(np.uint8)
    packed = Image.fromarray(pixels).resize((256, 88), Image.Resampling.LANCZOS)
    pixels = np.array(packed)
    pixels[:2, :, 3] = pixels[-2:, :, 3] = 0
    pixels[:, :2, 3] = pixels[:, -2:, 3] = 0
    atlas.alpha_composite(Image.fromarray(pixels), (index * 256, 0))
    frame = {key: value for key, value in meta.items() if key not in {'image', 'dpr'}}
    frame.update({'dpr': 2, 'sourceRect': {'x': index * 256, 'y': 0, 'width': 256, 'height': 88},
                  'displaySize': {'width': 128, 'height': 44},
                  'decorativeTranslateY': round(44 - meta['foot']['y'], 3)})
    frames.append(frame)
for key in ('foot', 'letterCenter', 'usableFace'):
    if any(frame[key] != frames[0][key] for frame in frames):
        raise ValueError('Island state switch must preserve ' + key)
atlas_path = output / 'island-signs.webp'
atlas.save(atlas_path, 'WEBP', quality=90, method=6, alpha_quality=100)
manifest = {
    'version': 1,
    'coordinateSystem': 'sourceRect is physical atlas pixels; displaySize, foot, letterCenter, usableFace and decorativeTranslateY are CSS pixels. Glyph cells are integer2CSSpx.',
    'atlas': {'image': atlas_path.name, 'width': 768, 'height': 88, 'bytes': atlas_path.stat().st_size},
    'frames': frames,
}
(output / 'island-signs.meta.json').write_text(json.dumps(manifest, indent=2) + '\n')

decoded = Image.open(atlas_path).convert('RGBA')
checks, native_frames = [], []
for frame in frames:
    rect = frame['sourceRect']
    crop = decoded.crop((rect['x'], 0, rect['x'] + rect['width'], rect['height']))
    alpha = np.asarray(crop)[:, :, 3]
    if max(int(alpha[:2, :].max()), int(alpha[-2:, :].max()),
           int(alpha[:, :2].max()), int(alpha[:, -2:].max())) != 0:
        raise ValueError('Each frame must have two fully transparent physical edge pixels')
    safe = frame['usableFace']
    if safe['width'] < 108 or safe['height'] < 18:
        raise ValueError('The authored face must preserve full name and accent headroom')
    label_checks = []
    for label in labels:
        cells = glyph_cells(label, frame['letterCenter'])
        for x, y in cells:
            if not (safe['x'] <= x and x + 2 <= safe['x'] + safe['width'] and
                    safe['y'] <= y and y + 2 <= safe['y'] + safe['height']):
                raise ValueError(f'Original glyph cell outside safe face: {label} {x, y}')
            if int(alpha[y * 2:(y + 2) * 2, x * 2:(x + 2) * 2].min()) < 250:
                raise ValueError(f'Original glyph cell lacks solid board backing: {label} {x, y}')
        label_checks.append({'label': label, 'width': text_width(label),
                             'inkBounds': [min(x for x, y in cells), min(y for x, y in cells),
                                           max(x + 2 for x, y in cells), max(y + 2 for x, y in cells)]})
    checks.append({'kind': frame['kind'], 'transparentEdges': True,
                   'solidGlyphBacking': True, 'labels': label_checks})
    native_frames.append(crop.resize((128, 44), Image.Resampling.LANCZOS))

if proof:
    # Third column repeats the native keyboard-focus geometry from map.css:
    # 3px paper outline, offset3px, plus 6px ink shadow. The nameboard itself
    # stays exactly128x44; parent runtime QA verifies the real DOM focus state.
    sheet = Image.new('RGBA', (468, 388), '#286279')
    draw = ImageDraw.Draw(sheet)
    for index, title in enumerate(('island', 'selected', 'locked + focus')):
        draw.text((14 + index * 156, 3), title, fill='#f5efd3')
    for row, label in enumerate(labels):
        for column, image in enumerate(native_frames):
            x, y = 14 + column * 156, 26 + row * 60
            if column == 2:
                draw.rectangle((x - 6, y - 6, x + 133, y + 49), fill='#191f35')
                draw.rectangle((x - 6, y - 6, x + 133, y + 49), outline='#fff9e6', width=3)
                draw.rectangle((x - 3, y - 3, x + 130, y + 46), fill='#286279')
            sheet.alpha_composite(image, (x, y))
            for cell_x, cell_y in glyph_cells(label, frames[column]['letterCenter']):
                draw.rectangle((x + cell_x, y + cell_y, x + cell_x + 1, y + cell_y + 1), fill='#191f35')
    sheet.save(proof / 'island-signs-labels-1x.png')
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.Resampling.NEAREST).save(proof / 'island-signs-labels-3x.png')
hashes = {name: hashlib.sha256((output / name).read_bytes()).hexdigest()
          for name in ('island-signs.webp', 'island-signs.meta.json')}
verification = {name: (output / name).read_bytes() == (frozen / name).read_bytes()
                for name in hashes} if frozen else None
if verification and not all(verification.values()):
    raise ValueError('Frozen asset comparison failed: ' + str(verification))
validation = {'atlasSize': list(decoded.size), 'atlasBytes': atlas_path.stat().st_size,
              'frameCount': 3, 'displaySize': [128, 44], 'foot': frames[0]['foot'],
              'letterCenter': frames[0]['letterCenter'], 'usableFace': frames[0]['usableFace'],
              'hashes': hashes, 'frozenByteComparison': verification, 'checks': checks}
if proof:
    (proof / 'island-signs-validation.json').write_text(json.dumps(validation, indent=2) + '\n')
print(json.dumps(validation, indent=2))
