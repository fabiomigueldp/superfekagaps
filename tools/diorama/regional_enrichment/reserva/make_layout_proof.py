"""Static native-scale review: published connectors + candidate island + original actor."""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--asset-dir',required=True);a=p.parse_args();root=Path(a.asset_dir);HERE=Path(__file__).resolve().parent
im=Image.new('RGBA',(2360,1240),(101,163,179,255));shift=(160,20)
def put(img,x,y):im.alpha_composite(img.convert('RGBA'),(round(x)+shift[0],round(y)+shift[1]))
put(Image.open(HERE/'candidate/reserva-diorama.webp'),0,0)
for file,match in [('reserva-dominio-journey.meta.json','reserva-dominio-reserva.webp'),('serra-reserva-link.meta.json','serra-reserva-upper-terminal.webp')]:
 d=json.loads((root/file).read_text())
 for o in d['overlays']:
  if Path(o['path']).name!=match:continue
  art=Image.open(root/match).resize((round(o['widthInMap']*1920),round(o['heightInMap']*1200)),Image.Resampling.LANCZOS);put(art,(o['left']-2.7)*1920,(o['top']+1.8)*1200)
source=json.loads((HERE/'source/feka-sprite.json').read_text());palette=json.loads((HERE/'source/feka-palette.json').read_text());meta=json.loads((HERE/'candidate/reserva-diorama.meta.json').read_text());draw=ImageDraw.Draw(im);sc=1920*source['pixelMapWidth'];paint=math.ceil(sc)
def actor(foot):
 fx=foot['x']*1920+shift[0];fy=foot['y']*1200+shift[1]
 for y,row in enumerate(source['frames']['idle']):
  for x,c in enumerate(row):
   if c=='_':continue
   xx=math.floor(fx+(x-8)*sc+.5);yy=math.floor(fy+(y-26)*sc+.5);draw.rectangle((xx,yy,xx+paint-1,yy+paint-1),fill=palette[c])
for n in meta['nodes'].values():actor(n)
boat=json.loads((root/'journey-boat.meta.json').read_text());f=boat['frames'][48];atlas=Image.open(root/Path(boat['atlas']['path']).name);foot=json.loads((HERE/'source/dock.meta.json').read_text())['islands']['reserva']['berth']['passenger'];s=f['widthInMap']*1920/f['sourceRects']['base']['width'];bx=foot['x']*1920-f['passengerFootPixels']['x']*s;by=foot['y']*1200-f['passengerFootPixels']['y']*s
for key in ['base','foreground']:
 r=f['sourceRects'][key];img=atlas.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height'])).resize((round(r['width']*s),round(r['height']*s)),Image.Resampling.LANCZOS);put(img,bx,by)
 if key=='base':actor(foot)
draw.text((20,12),'Static placement proof: original Feka at all 5 nodes; unchanged terminal, ferry dock and boat64 at native map scale',fill='white')
im.convert('RGB').save(HERE/'reserva-feka-connectors-proof.png')
