"""Package compact additive dock crops only after the targeted source audit.

python tools/diorama/package_reserva_dominio_docks.py --source SCRATCH
Never writes a proof, Blender scene, or changed world1–5 asset into the repo.
"""
from pathlib import Path
import argparse,hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);a=p.parse_args()
meta=json.loads((a.source/'reserva-dominio-docks.meta.json').read_text());audit=json.loads((a.source/'reserva-dominio-docks.audit.json').read_text())
raster=json.loads((a.source/'reserva-dominio-raster.audit.json').read_text())
assert audit['passed'] and raster['passed'],'Exact targeted geometry and raster audits must pass'
assert all(hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha for name,sha in meta['sources'].items()),'Source drifted since render'
assets=ROOT/'public/assets/world/map';docs=ROOT/'docs/world/diorama';packed=[];overlays=[]
for item in meta['overlays']:
    dest=assets/Path(item['path']).name;im=Image.open(a.source/(dest.stem+'.png')).convert('RGBA')
    assert im.size==(item['width'],item['height']) and im.getextrema()[3][1]>0
    im.save(dest,'WEBP',quality=94,method=6)
    entry={key:item[key] for key in ['id','path','left','top','width','height','widthInMap','heightInMap']}
    if item['state']=='closed':entry['when']='closed'
    overlays.append(entry);packed.append({'path':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
islands={}
for name,dock in meta['dockInstances'].items():
    static=next(o for o in meta['overlays'] if o['id']==name);origin=meta['placements'][name]['origin'];left=static['left']-origin['x'];top=static['top']-origin['y']
    art={'left':left,'top':top,'right':left+static['widthInMap'],'bottom':top+static['heightInMap']}
    # Include the exact shipped boat frame around its passenger anchor for camera
    # framing, while path/safe support remain independent polygons.
    boat=json.loads((assets/'journey-boat.meta.json').read_text());frame=boat['frames'][6];scale=frame['widthInMap']/boat['frame']['width'];foot=dock['berth']['passenger']
    box={'left':foot['x']-frame['passengerFootPixels']['x']*scale,'top':foot['y']-frame['passengerFootPixels']['y']*scale*1.6,
         'right':foot['x']+(boat['frame']['width']-frame['passengerFootPixels']['x'])*scale,'bottom':foot['y']+(boat['frame']['height']-frame['passengerFootPixels']['y'])*scale*1.6}
    for key in ['left','top']:art[key]=min(art[key],box[key],dock['approachBounds'][key])
    for key in ['right','bottom']:art[key]=max(art[key],box[key],dock['approachBounds'][key])
    islands[name]={'version':1,'island':name,'size':meta['size'],
         'join':{**{k:dock['approach'][0][k] for k in ['x','y']},'node':dock['stage']},
         'dock':dock['dock'],'junctionToDock':dock['approach'],'boardingRoute':dock['boardingRoute'],'berth':dock['berth'],
         'approachDurationSeconds':dock['approachDurationSeconds'],'boardingDurationSeconds':dock['boardingDurationSeconds'],'aboardProgress':dock['aboardProgress'],
         'support':dock['support'],'approachBounds':dock['approachBounds'],'artBounds':art}
sail={key:meta['sailRoute'][key] for key in ['points','durationSeconds','segmentHeadings','reverseSegmentHeadings']};sail['coordinateSystem']='atlas'
for endpoint,name in [(0,'reserva'),(-1,'dominio')]:
    sail['points'][endpoint]={axis:islands[name]['berth']['passenger'][axis]+meta['placements'][name]['origin'][axis] for axis in ['x','y']}
runtime={'version':1,'connection':'reserva-dominio-ferry','placements':meta['placements'],'boatMetadata':meta['boatAsset'],'islands':islands,'sailRoute':sail,'overlays':overlays}
(assets/'reserva-dominio-journey.meta.json').write_text(json.dumps(runtime,indent=2)+'\n')
(docs/'reserva-dominio-docks-approved.meta.json').write_text(json.dumps({**meta,'status':'approved-source-rebuild','assets':packed,'audit':audit,'rasterAudit':raster},indent=2)+'\n')
print(json.dumps({'metadata':'public/assets/world/map/reserva-dominio-journey.meta.json','overlayCount':len(packed),'bytes':sum(p['bytes'] for p in packed),'auditPassed':audit['passed']},indent=2))
