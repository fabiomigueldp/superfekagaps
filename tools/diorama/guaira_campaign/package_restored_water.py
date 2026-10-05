"""Package earned water and derive tiny motion crops from actual rendered alpha.
Run after build_restored_water.py. The full earned layer remains authoritative;
motion clips to its alpha and allocates only these measured components.
"""
import argparse, json, hashlib
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,default=ROOT/'public/assets/world/map/guaira-campaign/guaira-water-restored.png')
parser.add_argument('--source',type=Path,default=ROOT/'public/assets/world/map/guaira-campaign/restored-water-source.json')
parser.add_argument('--output',type=Path,default=ROOT/'public/assets/world/map/guaira-campaign/guaira-water-restored.webp')
parser.add_argument('--data-output',type=Path,default=ROOT/'src/adventure/GuairaCampaignWaterData.json')
args=parser.parse_args()
image=Image.open(args.input).convert('RGBA');assert image.size==(1920,1200)
alpha=image.getchannel('A');source=json.loads(args.source.read_text())
x0,y0,x1,y1=source['bowlBounds']
assert 0<=x0<x1<=1920 and 0<=y0<y1<=1200
assert alpha.crop((x0,y0,x1,y1)).getbbox(), 'Earned public water is entirely occluded'
patches=[[x0,y0,x1-x0,y1-y0]]
remaining=alpha.copy();ImageDraw.Draw(remaining).rectangle((x0,y0,x1-1,y1-1),fill=0)
# A two-pixel connected neighborhood includes bilinear-filter fringes and joins
# near-touching pieces of one authored glint; it never manufactures visible water.
grown=np.asarray(remaining.point(lambda x:255 if x else 0).filter(ImageFilter.MaxFilter(5))).copy()
while np.any(grown):
 yy,xx=np.nonzero(grown);seed=(int(xx[0]),int(yy[0]));queue=[seed];grown[seed[1],seed[0]]=0
 minx=maxx=seed[0];miny=maxy=seed[1]
 while queue:
  x,y=queue.pop();minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
  for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
   if 0<=nx<1920 and 0<=ny<1200 and grown[ny,nx]:grown[ny,nx]=0;queue.append((nx,ny))
 patches.append([minx,miny,maxx-minx+1,maxy-miny+1])
patches[1:]=sorted(patches[1:],key=lambda p:(p[1],p[0]))
# Measured alpha coverage prevents changed occluders silently breaking motion.
coverage=Image.new('L',image.size,0);draw=ImageDraw.Draw(coverage)
for x,y,w,h in patches:draw.rectangle((x,y,x+w-1,y+h-1),fill=255)
assert not np.any((np.asarray(alpha)>0)&(np.asarray(coverage)==0))
pixels=sum(w*h for _,_,w,h in patches)
assert len(patches)<=16 and pixels<=8192, f'Unexpected restoration scope ({len(patches)} crops / {pixels} pixels); review authored alpha'
args.output.parent.mkdir(parents=True,exist_ok=True);image.save(args.output,lossless=True,method=6,exact=False)
contract={'sourceSize':[1920,1200],'patches':patches,'scratchPixels':pixels,'sourceSHA256':hashlib.sha256(args.input.read_bytes()).hexdigest()}
args.data_output.parent.mkdir(parents=True,exist_ok=True);args.data_output.write_text(json.dumps(contract,separators=(',',':'))+'\n')
print(json.dumps(contract,indent=2))
