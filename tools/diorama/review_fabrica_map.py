"""Local review-only route and actor overlays, never a runtime asset."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/world/map';DOC=ROOT/'docs/world/diorama'
im=Image.open(OUT/'fabrica-diorama-preview.png').convert('RGBA');bg=Image.new('RGBA',im.size,'#d4e7e2');bg.alpha_composite(im);draw=ImageDraw.Draw(bg,'RGBA');w,h=im.size;meta=json.loads((OUT/'fabrica-diorama.meta.json').read_text());profiles=json.loads((DOC/'fabrica-runtime-envelopes.json').read_text())['profiles']
for route in meta['routes'].values():draw.line([(p['x']*w,p['y']*h) for p in route],fill='#ecba27',width=3)
draw.line([(p['x']*w,p['y']*h) for p in meta['secretRoute']],fill='#b267d0',width=3)
for key,p in meta['nodes'].items():
 x,y=p['x']*w,p['y']*h;draw.ellipse((x-15,y-7,x+15,y+7),fill=(255,247,172,105),outline='#97511e',width=2)
 for name,color in [('desktop',(212,76,51,230)),('portrait',(166,66,199,145))]:
  profile=next(p for p in profiles if p['profile']==name and p['mode']=='panorama');b=profile['normalized'];draw.rectangle((x+b['left']*w,y+b['top']*h,x+b['right']*w,y+b['bottom']*h),outline=color,width=1)
 draw.text((x+18,y-9),key,fill='#183c46')
draw.text((16,16),'Review only: gold main route / purple maintenance / coral desktop actor / purple portrait actor',fill='#234b50')
bg.convert('RGB').save(DOC/'fabrica-path-review.png');print(DOC/'fabrica-path-review.png')
