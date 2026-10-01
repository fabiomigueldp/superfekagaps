"""Sweep the unchanged shipped8-heading boat alpha against both frozen islands.

python tools/diorama/check_reserva_dominio_raster.py --source SCRATCH
The middle sea segment exercises all8 silhouettes; the lateral docking legs
retain heading6 until clear of their authored boarding gates.
"""
from pathlib import Path
import argparse,json,math
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);a=p.parse_args()
meta=json.loads((a.source/'reserva-dominio-docks.meta.json').read_text());boat=json.loads((ROOT/'public/assets/world/map/journey-boat.meta.json').read_text())
# Native1920x1200 pixels per normalized island unit keep silhouettes unrounded
# until final raster placement, matching the runtime compositor scale.
LEFT,TOP=1.45,-1.88;W,H=4400,1800
terrain=Image.new('L',(W,H),0)
for name in ['reserva','dominio']:
    im=Image.open(ROOT/'public/assets/world/map'/f'{name}-diorama.webp').convert('RGBA');origin=meta['placements'][name]['origin'];terrain.paste(im.getchannel('A'),(round((origin['x']-LEFT)*1920),round((origin['y']-TOP)*1200)))
mask=np.array(terrain)>16;atlas=Image.open(ROOT/'public'/boat['atlas']['path'].lstrip('/')).convert('RGBA');frames=[]
for f in boat['frames']:
    r=f['sourceRects']['base'];im=atlas.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']));scale=f['widthInMap']*1920/r['width'];im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    frames.append((np.array(im.getchannel('A'))>16,f['passengerFootPixels']['x']*scale,f['passengerFootPixels']['y']*scale))
failures=[];poses=0;max_overlap=0
for segment,(p,q) in enumerate(zip(meta['sailRoute']['points'],meta['sailRoute']['points'][1:])):
    native=math.hypot((q['x']-p['x'])*1920,(q['y']-p['y'])*1200);n=max(1,math.ceil(native/6))
    for i in range(n+1):
        t=i/n;x=p['x']+(q['x']-p['x'])*t;y=p['y']+(q['y']-p['y'])*t
        for heading in range(8) if segment==1 else [6]:
            ship,fx,fy=frames[heading];sx=round((x-LEFT)*1920-fx);sy=round((y-TOP)*1200-fy);h,w=ship.shape
            assert sx>=0 and sy>=0 and sx+w<=W and sy+h<=H
            overlap=int(np.count_nonzero(mask[sy:sy+h,sx:sx+w]&ship));max_overlap=max(max_overlap,overlap);poses+=1
            if overlap:failures.append({'segment':segment,'t':t,'heading':heading,'overlapPixels':overlap})
report={'passed':not failures,'scope':'Exact unchanged journey-boat.webp8-heading alpha against frozen Reserva and Domínio base WebPs, at native island scale; geometric dock contact is audited separately.',
        'alphaThreshold':16,'maximumStepNativePixels':6,'poseCount':poses,'failureCount':len(failures),'maximumOverlapPixels':max_overlap,'failures':failures}
(a.source/'reserva-dominio-raster.audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='failures'},indent=2))
raise SystemExit(0 if report['passed'] else 1)
