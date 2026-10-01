"""Read-only focused Reserva terrain audit against recorded current ferry64 poses."""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import distance_transform_edt
p=argparse.ArgumentParser();p.add_argument('--asset-dir',required=True);p.add_argument('--samples',required=True);p.add_argument('--candidate',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.asset_dir)
meta=json.loads((root/'journey-boat.meta.json').read_text());atlas=Image.open(root/Path(meta['atlas']['path']).name).convert('RGBA');assert meta['headingCount']==64
frames=[]
for f in meta['frames']:
 r=f['sourceRects']['base'];im=atlas.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']));r2=f['sourceRects']['foreground'];im.alpha_composite(atlas.crop((r2['x'],r2['y'],r2['x']+r2['width'],r2['y']+r2['height'])))
 scale=f['widthInMap']*1920/r['width'];im=im.resize((round(r['width']*scale),round(r['height']*scale)),Image.Resampling.LANCZOS);yy,xx=np.where(np.asarray(im.getchannel('A'))>32);frames.append((xx,yy,{k:v*scale for k,v in f['passengerFootPixels'].items()}))
masks={};distances={}
for name,path in [('published',root/'reserva-diorama.webp'),('candidate',Path(a.candidate))]:
 im=Image.open(path).convert('RGBA');assert im.size==(1920,1200);mask=np.asarray(im.getchannel('A'))>32;masks[name]=np.pad(mask,64);distances[name]=distance_transform_edt(~masks[name])
cases=[]
for case in json.loads(Path(a.samples).read_text()):
 if case['from'] not in [5,6]:continue
 counts={k:0 for k in masks};minima={k:64 for k in masks};contacts=[]
 for s in case['samples']:
  state=s['after'];xx,yy,anchor=frames[state['frameIndex']];foot=state['foot'];x=xx+round((foot['x']-2.7)*1920-anchor['x'])+64;y=yy+round((foot['y']+1.8)*1200-anchor['y'])+64;ok=(x>=0)&(y>=0)&(x<2048)&(y<1328);x,y=x[ok],y[ok]
  for name in masks:
   n=int(masks[name][y,x].sum()) if len(x) else 0;d=min(64,math.floor(float(distances[name][y,x].min()))) if len(x) else 64;minima[name]=min(minima[name],d);counts[name]+=bool(n)
   if n:contacts.append({'time':s['time'],'layer':name,'pixels':n,'heading':state['frameIndex']})
 cases.append({'from':case['from'],'to':case['to'],'reversal':case.get('reversal'),'poseCount':len(case['samples']),'contactPoseCount':counts,'minimumTerrainClearanceNativePixelsCapped64':minima,'contacts':contacts})
report={'status':'PASS' if all(c['contactPoseCount']['candidate']==0 for c in cases) else 'FAIL','scope':'Only the changed Reserva base image against the actual packaged 64-view ferry hull+foreground masks, recorded inbound/outbound/reversal positions, including terminal manoeuvres. No dock or other-island contact is reclassified. Broader integration and passenger travel remain separate gates.','sampleSha256':hashlib.sha256(Path(a.samples).read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256(Path(a.candidate).read_bytes()).hexdigest(),'boatAtlasSha256':hashlib.sha256((root/Path(meta['atlas']['path']).name).read_bytes()).hexdigest(),'alphaThreshold':32,'cases':cases}
Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert report['status']=='PASS'
