"""Package rendered RGBA source art as high-quality and lossless WebP.
No color grading or geometric changes: render_costa.py is the art source of truth.
Run with Python + Pillow after Blender has written the PNG files.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/world/map'
records={}
for name in ('costa-diorama','costa-shadow','porto-distant'):
    source=OUT/f'{name}.png'
    if not source.exists():
        print(f'Skipping missing {source.name}')
        continue
    im=Image.open(source).convert('RGBA')
    if name=='costa-diorama':
        im.resize((960,600),Image.Resampling.LANCZOS).save(OUT/'costa-diorama-preview.png')
    if name=='costa-shadow':
        # A contact shadow is deliberately low frequency: ship a smooth 1/3-size alpha layer.
        if im.size != (640,400):
            a=im.getchannel('A').resize((640,400),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))
            a=a.point(lambda v: min(255,round(v/4)*4) if v>4 else 0)
            im=Image.new('RGBA',(640,400),(0,0,0,0));im.putalpha(a);im.save(source,compress_level=9)
        im.save(OUT/f'{name}.webp','WEBP',lossless=True,method=6)
    else:
        im.save(OUT/f'{name}.webp','WEBP',quality=91,method=6,exact=True)
        im.save(OUT/f'{name}.lossless.webp','WEBP',lossless=True,method=6,exact=True)
    records[name]={'width':im.width,'height':im.height,'mode':'RGBA','alphaBounds':list(im.getchannel('A').getbbox() or ()),'files':{p.name:p.stat().st_size for p in sorted(OUT.glob(name+'.*')) if p.suffix in ('.png','.webp')}}
(OUT/'art-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
