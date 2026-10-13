"""Publish matching Blender beauty, depth and projected walking paths.
Run after the revision's final render. Earlier masters are preserved.
"""
import argparse
import hashlib
import json
import shutil
from array import array
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/world/delicia'
OUT = ROOT / 'public/assets/delicia'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--revision',type=int,choices=[6,7,8],default=8)
revision=parser.parse_args().revision
review=ROOT/'output/delicia'/{6:'map-depth-2026-10-10',7:'geometry-polish-2026-10-11',8:'wayfinding-polish-2026-10-11'}[revision]
metadata = json.loads((SOURCE / f'island-map-v{revision}.json').read_text(encoding='utf-8'))
assert metadata['revision']==revision
original = SOURCE / f'island-render-v{revision}.png'
output = OUT / 'island.webp'
with Image.open(original) as image:
    assert image.size == (metadata['image']['width'], metadata['image']['height'])
    assert image.mode == 'RGBA'
    image.save(output, 'WEBP', quality=90, method=6)
    entry = {'source':original.relative_to(ROOT).as_posix(), 'file':output.relative_to(ROOT).as_posix(),
             'bytes':output.stat().st_size, 'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
             'width':image.width,'height':image.height,'alpha':True}
(OUT/'island-map.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest_path = SOURCE / 'runtime-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['images'] = [entry if row['file']==entry['file'] else row for row in manifest['images']]
depths = array('H')
depths.frombytes((review/'depth.u16').read_bytes())
assert len(depths) == metadata['depth']['width'] * metadata['depth']['height']
packed = bytearray()
for value in depths: packed.extend((value >> 8, value & 255, 0))
depth_image = Image.frombytes('RGB',(metadata['depth']['width'],metadata['depth']['height']),bytes(packed))
master = SOURCE/f'island-depth-v{revision}.png'; depth_output = OUT/'island-depth.png'
depth_image.save(master,'PNG',optimize=True)
with Image.open(master) as encoded:
    assert encoded.tobytes() == bytes(packed), 'Camera distance must survive packaging without colour conversion.'
for point in metadata['nodes'].values():
    x=min(depth_image.width-1,int(point['x']*depth_image.width))
    y=min(depth_image.height-1,int(point['y']*depth_image.height))
    assert depths[y*depth_image.width+x] != 65535, 'Every landing needs rendered ground.'
shutil.copyfile(master,depth_output)
depth_entry = {'source':master.relative_to(ROOT).as_posix(),'file':depth_output.relative_to(ROOT).as_posix(),
    'bytes':depth_output.stat().st_size,'sha256':hashlib.sha256(depth_output.read_bytes()).hexdigest(),
    'width':depth_image.width,'height':depth_image.height,'alpha':False,'encoding':'rg16-linear-camera-depth'}
manifest['images'] = [row for row in manifest['images'] if row['file']!=depth_entry['file']] + [depth_entry]
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps([entry,depth_entry]))
