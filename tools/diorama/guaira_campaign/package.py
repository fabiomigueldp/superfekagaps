"""Crop transparent terminal layers without changing their projection contract."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/assets/world/map/guaira-campaign'
for region in ['guaira','fabrica','serra']:
 image=Image.open(OUT/f'{region}.png').convert('RGBA')
 meta=json.loads((OUT/f'{region}.meta.json').read_text())
 bounds=image.getchannel('A').getbbox();assert bounds and image.size==(1920,1200)
 if region!='guaira':
  # Keep two transparent pixels for bilinear filtering.
  x0,y0,x1,y1=bounds;x0=max(0,x0-2);y0=max(0,y0-2);x1=min(1920,x1+2);y1=min(1200,y1+2)
  frame={'left':-.5,'top':-.5,'widthInMap':2,'heightInMap':2};meta['assetFrame']={'left':frame['left']+x0/1920*frame['widthInMap'],'top':frame['top']+y0/1200*frame['heightInMap'],'widthInMap':(x1-x0)/1920*frame['widthInMap'],'heightInMap':(y1-y0)/1200*frame['heightInMap']}
  image=image.crop((x0,y0,x1,y1))
 else:
  meta['artBounds']={k:v/d for k,v,d in zip(['left','top','right','bottom'],bounds,[1920,1200,1920,1200])}
 image.save(OUT/f'{region}.webp',quality=91,method=6,exact=True)
 meta['image']={'path':f'/assets/world/map/guaira-campaign/{region}.webp','width':image.width,'height':image.height,'bytes':(OUT/f'{region}.webp').stat().st_size}
 (OUT/f'{region}.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
 print(region,image.size,meta['image']['bytes'],meta['assetFrame'])
