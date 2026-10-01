from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,math,argparse
p=argparse.ArgumentParser();p.add_argument('--image',required=True);a=p.parse_args();root=Path(__file__).resolve().parent;S=root/'source';out=root/'proof';out.mkdir(parents=True,exist_ok=True);c=json.load(open(S/'serra-maintenance-cable.meta.json'));m=json.load(open(S/'base-serra.meta.json'));frame=c['frame'];atlas=Image.open(S/'serra-maintenance-cabin.webp').convert('RGBA');base=Image.open(a.image).convert('RGBA');spec=json.load(open(S/'serra-audit-sprite-source.json'));colors=json.load(open(S/'feka-palette.json'))
def sprite(im,foot):
 d=ImageDraw.Draw(im);sz=frame['passengerPixelScale']
 for row,line in enumerate(spec['frames']['idle']):
  for col,k in enumerate(line):
   if k=='_':continue
   x=math.floor(foot[0]-8*sz+col*sz+.5);y=math.floor(foot[1]-26*sz+row*sz+.5);d.rectangle((x,y,x+math.ceil(sz)-1,y+math.ceil(sz)-1),fill=colors[k])
def crop(key):
 q=frame[key];return atlas.crop((q['x'],q['y'],q['x']+q['w'],q['y']+q['h']))
rear,front=crop('rear'),crop('foreground');mounted=rear.copy();sprite(mounted,(frame['passengerFoot']['x'],frame['passengerFoot']['y']));mounted.alpha_composite(front);empty=Image.alpha_composite(rear,front)
def sample(path,t):
 lens=[math.hypot((b['x']-a['x'])*1.6,b['y']-a['y']) for a,b in zip(path,path[1:])];goal=sum(lens)*t
 for aa,bb,L in zip(path,path[1:],lens):
  if goal<=L:return {'x':aa['x']+(bb['x']-aa['x'])*goal/L,'y':aa['y']+(bb['y']-aa['y'])*goal/L}
  goal-=L
 return path[-1]
positions={key:sample(v['pathPoints'],.5) for key,v in c['lanes'].items()};overview=Image.new('RGBA',base.size,'#37798e');overview.alpha_composite(base)
for key,q in m['nodes'].items():sprite(overview,(q['x']*1920,q['y']*1200))
for key,foot in sorted(positions.items(),key=lambda item:item[1]['y']):
 vehicle=mounted if key=='a' else empty;xy=(round(foot['x']*1920-frame['passengerFoot']['x']),round(foot['y']*1200-frame['passengerFoot']['y']));overview.alpha_composite(vehicle,xy)
overview.convert('RGB').save(out/'serra-feka-clearance-proof.png')
