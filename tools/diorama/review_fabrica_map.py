"""Produce a local route and current-atlas actor overlay for visual review."""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

from fabrica_tools import RUNTIME, read_json, validate_envelopes

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input-dir', type=Path, required=True)
options = parser.parse_args()
root = options.input_dir.resolve()
source = root / 'package/fabrica-diorama.webp'
if not source.exists():
    source = root / 'export/fabrica-diorama.png'
meta = read_json(RUNTIME / 'fabrica-diorama.meta.json')
profiles = validate_envelopes(meta)['profiles']
with Image.open(source) as image:
    image = image.convert('RGBA').resize((960, 600), Image.Resampling.LANCZOS)
background = Image.new('RGBA', image.size, '#d4e7e2')
background.alpha_composite(image)
draw = ImageDraw.Draw(background, 'RGBA')
width, height = image.size
for route in meta['routes'].values():
    draw.line([(point['x'] * width, point['y'] * height) for point in route], fill='#ecba27', width=3)
draw.line([(point['x'] * width, point['y'] * height) for point in meta['secretRoute']], fill='#b267d0', width=3)
for name, point in meta['nodes'].items():
    x, y = point['x'] * width, point['y'] * height
    draw.ellipse((x - 15, y - 7, x + 15, y + 7), fill=(255, 247, 172, 105), outline='#97511e')
    for profile, color in [('desktop', '#d44c33'), ('narrow-portrait', '#a642c7')]:
        bounds = next(case for case in profiles if case['profile'] == profile and case['mode'] == 'panorama')['normalized']
        draw.rectangle((x + bounds['left'] * width, y + bounds['top'] * height,
                        x + bounds['right'] * width, y + bounds['bottom'] * height), outline=color)
    draw.text((x + 18, y - 9), name, fill='#183c46')
draw.text((16, 16), 'Review: gold main route / purple shortcut / coral desktop / violet narrow portrait', fill='#234b50')
target = root / 'review/fabrica-path-review.png'
target.parent.mkdir(parents=True, exist_ok=True)
background.convert('RGB').save(target)
print('FABRICA_REVIEW=' + str(target))
