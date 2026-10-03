from PIL import Image,ImageDraw
import json,math
from pathlib import Path
repo=Path(__file__).resolve().parents[3];root=repo/'public/assets/world/map';out=repo/'docs/world/diorama/guaira-campaign';out.mkdir(exist_ok=True)
a=json.loads((root/'journey-aircraft.meta.json').read_text());sheet=Image.new('RGB',(1440,1000),'#254952')
for i,region in enumerate(['fabrica','guaira','serra']):
 im=Image.new('RGBA',(1920,1200),'#32606A')
 if region=='fabrica':im.alpha_composite(Image.open(root/f'{region}-diorama.webp').convert('RGBA'))
 over=Image.open(root/f'guaira-campaign/{region}.png').convert('RGBA')
 if region=='fabrica':over=over.resize((3840,2400));im.alpha_composite(over,(-960,-600))
 else:im.alpha_composite(over)
 m=json.loads((root/f'guaira-campaign/{region}.meta.json').read_text());g=m['terminal']['groundAnchor'];start=m['terminal']['runwayStart'];end=m['terminal']['runwayEnd'];heading=math.atan2((end['y']-start['y'])*1200,(end['x']-start['x'])*1920);f=max(a['frames'],key=lambda f:math.cos(f['screenHeading']-heading));r=f['source'];plane=Image.open(root/'journey-aircraft.webp').crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']));scale=1920*a['frame']['widthInMap']*.65*20.6/m['camera']['orthoScale']/r['width'];plane=plane.resize((round(plane.width*scale),round(plane.height*scale)));im.alpha_composite(plane,(round(g['x']*1920-f['groundAnchor']['x']*scale),round(g['y']*1200-f['groundAnchor']['y']*scale)))
 im.convert('RGB').resize((960,600)).save(out/f'{region}-composition.jpg',quality=92)
 thumb=im.convert('RGB').resize((720,450));sheet.paste(thumb,((i%2)*720,(i//2)*500));ImageDraw.Draw(sheet).text(((i%2)*720+24,(i//2)*500+20),region.upper(),fill='white')
sheet.save(out/'composition-contact-sheet.jpg',quality=92)
