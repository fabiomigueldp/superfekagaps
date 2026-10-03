"""Pack true 3D courier headings into one alpha-safe runtime WebP atlas."""
import argparse,json,math,hashlib
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--render-dir',required=True);p.add_argument('--output-dir',default='public/assets/world/map');a=p.parse_args();src=Path(a.render_dir);out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
meta=json.loads((src/'aircraft.meta.json').read_text());frames=[Image.open(src/f'heading-{i:02d}.png').convert('RGBA') for i in range(meta['headingCount'])]
assert all(im.size==(384,320) and im.getbbox() for im in frames)
bounds=[im.getbbox() for im in frames];crop=(max(0,min(b[0] for b in bounds)-3),max(0,min(b[1] for b in bounds)-3),min(384,max(b[2] for b in bounds)+3),min(320,max(b[3] for b in bounds)+3));w,h=crop[2]-crop[0],crop[3]-crop[1]
atlas=Image.new('RGBA',(w*8,h*math.ceil(len(frames)/8)))
for f,im in zip(meta['frames'],frames):
    i=f['index'];atlas.paste(im.crop(crop),(i%8*w,i//8*h));f['source']={'x':i%8*w,'y':i//8*h,'width':w,'height':h}
    for key in ['groundAnchor','passengerAnchor','propeller','propellerUp','propellerSide']:
        f[key]['x']-=crop[0];f[key]['y']-=crop[1]
    for point in f['wingTips']:point['x']-=crop[0];point['y']-=crop[1]
    for flap in f['flaps']:
        for point in flap:point['x']-=crop[0];point['y']-=crop[1]
meta['frame']={'width':w,'height':h,'widthInMap':6/20.6*w/384};meta['rawFrame']={'width':384,'height':320,'crop':crop};meta['camera']={'position':[11,-20,17.5],'orthoScale':6};meta['modelFootprint']={'lengthWorld':3.95,'wingSpanWorld':4.86,'runwayLengthWorld':7.6,'runwayWidthWorld':5.2};meta['drawOrder']=['ground shadow','ground dust','aircraft atlas','articulated propeller','subtle wingtip air wisps'];meta['passengerPolicy']='Enclosed seated cabin: hide the separate ground avatar while in flight; green cap is visible through both windows.'
path=out/'journey-aircraft.webp';atlas.save(path,'WEBP',quality=88,method=6,alpha_quality=100);meta['atlas']={'path':'/assets/world/map/journey-aircraft.webp','width':atlas.width,'height':atlas.height,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(out/'journey-aircraft.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
# Human review sheet with sea-blue matte; not shipped.
contact=Image.new('RGB',(w*8,h*4),'#34545c');contact.paste(atlas,(0,0),atlas);contact.save(src/'contact-sheet.jpg',quality=92)
print(json.dumps({'frames':len(frames),'crop':crop,'atlasBytes':path.stat().st_size,'atlasSize':atlas.size}))
