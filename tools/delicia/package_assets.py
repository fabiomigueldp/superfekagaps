"""Encode preserved image/audio masters into the expansion's shipped derivatives.

Requires Pillow and ffmpeg. Makes no API calls. Original generation files stay
under docs/world/delicia; only WebP, Opus and map metadata ship to the browser.
"""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/world/delicia'
OUT = ROOT / 'public/assets/delicia'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'audio').mkdir(exist_ok=True)
manifest = {'images': [], 'audio': []}

def entry(source, output, **metadata):
    return {'source': source.relative_to(ROOT).as_posix(), 'file': output.relative_to(ROOT).as_posix(),
            'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), **metadata}

for name in ['key-art', 'backdrop', 'environment-atlas', 'portraits', 'props', 'boss-atlas', 'island', 'world-concept-v2', 'enemies-v2', 'jaja-motion-v2', 'guina-motion-v2', 'landmarks-v2', 'terrain-v2']:
    if name == 'island':
        original = next(SOURCE / candidate for candidate in ['island-render-v4.png', 'island-render-v3.png', 'island-render-v2.png', 'island-render.png'] if (SOURCE / candidate).exists())
    elif name == 'landmarks-v2' and (SOURCE / 'landmarks-v5.png').exists():
        original = SOURCE / 'landmarks-v5.png'
    elif name == 'props' and (SOURCE / 'props-v5.png').exists():
        original = SOURCE / 'props-v5.png'
    else:
        original = SOURCE / (name + '.png')
    output = OUT / (name + '.webp')
    img = Image.open(original)
    if not output.exists() or original.stat().st_mtime > output.stat().st_mtime:
        img.save(output, 'WEBP', quality=84 if name.endswith('-v2') else 86, method=6)
    manifest['images'].append(entry(original, output, width=img.width, height=img.height, alpha=img.mode == 'RGBA'))

for original in sorted((SOURCE / 'audio').glob('*.mp3')):
    output = OUT / 'audio' / (original.stem + '.ogg')
    if not output.exists() or original.stat().st_mtime > output.stat().st_mtime:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(original),
                        '-c:a', 'libopus', '-b:a', '80k', '-vbr', 'on', str(output)], check=True)
    manifest['audio'].append(entry(original, output, codec='Opus', bitrate='80k VBR'))

(SOURCE / 'runtime-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'runtimeImages': len(manifest['images']), 'runtimeAudio': len(manifest['audio']),
                  'bytes': sum(a['bytes'] for items in manifest.values() for a in items)}), flush=True)
