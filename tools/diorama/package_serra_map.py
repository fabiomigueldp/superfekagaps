"""Package fresh Blender Serra renders with camera-derived routes and cabin layers.
python tools/diorama/package_serra_map.py --input-dir /tmp/serra-build --output-dir /tmp/serra-runtime
No binary scene or existing runtime assets are inputs. Requires Pillow.
"""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--input-dir',required=True);p.add_argument('--output-dir',required=True);p.add_argument('--docs-dir');args=p.parse_args()
root=Path(args.input_dir);out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True);docs=Path(args.docs_dir) if args.docs_dir else out;docs.mkdir(parents=True,exist_ok=True)
source=json.loads((root/'serra-prototype.meta.json').read_text());main=Image.open(root/'serra-diorama.png').convert('RGBA');assert main.size==(1920,1200),'Use --final --static'
box=main.getchannel('A').getbbox();assert box
bounds={'left':box[0]/1920,'top':box[1]/1200,'right':box[2]/1920,'bottom':box[3]/1200}
main.save(out/'serra-diorama.webp',quality=93,method=6)
meta={k:source[k] for k in ['version','world','size','camera','nodes','routes','secretTransport','secretRoute','routeDurationsSeconds']};meta['artBounds']=bounds
meta['coordinateSystem']='Normalized top-left image coordinates in the complete1920x1200 frame.'
(out/'serra-diorama.meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
rear=Image.open(root/'maintenance-cabin-rear-full.png').convert('RGBA');front=Image.open(root/'maintenance-cabin-foreground-full.png').convert('RGBA');assert rear.size==front.size==(1920,1200)
alpha=Image.alpha_composite(rear,front).getchannel('A');crop=alpha.getbbox();assert crop
pad=8;crop=(max(0,crop[0]-pad),max(0,crop[1]-pad),min(1920,crop[2]+pad),min(1200,crop[3]+pad));rear=rear.crop(crop);front=front.crop(crop);w,h=rear.size
atlas=Image.new('RGBA',(w*2,h));atlas.alpha_composite(rear,(0,0));atlas.alpha_composite(front,(w,0));atlas.save(out/'serra-maintenance-cabin.webp',quality=94,method=6)
f=source['cabinFrameProjection'];frame={'width':w,'height':h,'widthInMap':w/1920,'passengerFoot':{'x':f['passengerFootPixels']['x']-crop[0],'y':f['passengerFootPixels']['y']-crop[1]},'passengerPixelScale':f['passengerPixelScale'],'rear':{'x':0,'y':0,'w':w,'h':h},'foreground':{'x':w,'y':0,'w':w,'h':h}}
assert abs(frame['widthInMap']*frame['passengerPixelScale']/frame['width']-(4.15/20.6)*3/384)<1e-12
cable=source['maintenanceProjection'];cable['atlas']={'path':'/assets/world/map/serra-maintenance-cabin.webp','width':w*2,'height':h};cable['frame']=frame
(out/'serra-maintenance-cable.meta.json').write_text(json.dumps(cable,ensure_ascii=False,indent=2)+'\n')
main_time=sum(meta['routeDurationsSeconds'][k] for k in ['2:3','3:4']);alternatives={}
for lane,data in cable['lanes'].items():
 alternatives[lane]=cable['rideDurationSeconds']+sum(cable['stations'][terminal]['approachDurationSeconds']+data[terminal]['boardingDurationSeconds'] for terminal in ['lower','upper'])
 assert alternatives[lane]<main_time,'Secret trip no longer beats supported main path; review geometry/timing honestly'
 for terminal in ['lower','upper']:
  assert data[terminal]['boardingRoute'][0]==cable['stations'][terminal]['platform']
  assert data[terminal]['boardingRoute'][-1]==data[terminal]['foot']
  assert 0<data[terminal]['aboardProgress']<1
 assert data['pathPoints'][0]==data['lower']['foot'] and data['pathPoints'][-1]==data['upper']['foot']
manifest={'status':'packaged-local-candidate-requires-current-audit-and-browser-review','sourceBuilder':'tools/diorama/render_serra_map.py','packager':'tools/diorama/package_serra_map.py','size':{'width':1920,'height':1200},'artBounds':bounds,'movingCarriersBakedIntoBackground':False,'cabinCrop':{'x':crop[0],'y':crop[1],'width':w,'height':h},'timingCalibration':source['timingCalibration'],'main43to45Seconds':main_time,'maintenance43to45Seconds':alternatives,'files':[]}
for name in ['serra-diorama.webp','serra-diorama.meta.json','serra-maintenance-cabin.webp','serra-maintenance-cable.meta.json']:
 content=(out/name).read_bytes();manifest['files'].append({'path':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
(docs/'serra-art-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
