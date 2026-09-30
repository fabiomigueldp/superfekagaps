"""Author and verify the first sea crossing for the approved stable atlas layout.

Uses the packaged island/dock silhouettes and actual boat alpha footprint at
each selected heading; no browser/screen pixels or runtime geometry guesses.
Run after package_journey_assets.py. Re-run whenever placement/art changes.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, binary_dilation

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/world/map'
path=OUT/'coast-port-journey.meta.json';meta=json.loads(path.read_text())
boat=json.loads((OUT/'journey-boat.meta.json').read_text())
placements={'costa':{'origin':{'x':0,'y':0},'scale':1},'porto':{'origin':{'x':1.1,'y':-.12},'scale':1}}
def global_point(island,p):
    origin=placements[island]['origin'];return {'x':round(origin['x']+p['x'],6),'y':round(origin['y']+p['y'],6)}
start=global_point('costa',meta['islands']['costa']['berth']['passenger'])
end=global_point('porto',meta['islands']['porto']['berth']['passenger'])
route=[start,{'x':.663,'y':1.015},{'x':.775,'y':1.035},{'x':.887,'y':.970},{'x':.982,'y':.845},{'x':1.075,'y':.674},{'x':1.14,'y':.550},{'x':1.198,'y':.481},end]

# Half-native raster audit; minimum reported distances are conservatively
# rounded down after scaling back to the canonical 1920-pixel island width.
W,H=2400,1000;SX,SY=960,600;OX,OY=100,180
land=Image.new('L',(W,H));dock=Image.new('L',(W,H));old_dock=Image.new('L',(W,H));preview=Image.new('RGBA',(W,H),'#8bc5cb')
for island,placement in placements.items():
    origin=placement['origin'];x=round(OX+origin['x']*SX);y=round(OY+origin['y']*SY)
    art=Image.open(OUT/f'{island}-diorama.webp').convert('RGBA').resize((SX,SY),Image.Resampling.LANCZOS)
    preview.alpha_composite(art,(x,y));land.paste(art.getchannel('A'),(x,y))
    classification=Image.open(f'/tmp/feka-journey/{island}/original-dock-mask.png').getchannel('A').resize((SX,SY),Image.Resampling.LANCZOS)
    old_dock.paste(classification,(x,y))
    overlay=meta['islands'][island]['overlay'];image=Image.open(ROOT/'public'/overlay['path'].lstrip('/')).convert('RGBA')
    image=image.resize((round(overlay['widthInMap']*SX),round(overlay['heightInMap']*SY)),Image.Resampling.LANCZOS)
    pos=(round(x+overlay['left']*SX),round(y+overlay['top']*SY));preview.alpha_composite(image,pos);dock.paste(image.getchannel('A'),pos)
original_mask=np.asarray(land)>32
old_dock_mask=binary_dilation(np.asarray(old_dock)>4,iterations=1)
land_mask=original_mask & ~old_dock_mask
dock_mask=(np.asarray(dock)>32) | (original_mask & old_dock_mask)
distance=distance_transform_edt(~(land_mask|dock_mask))
atlas=Image.open(ROOT/'public'/boat['atlas']['path'].lstrip('/')).convert('RGBA');frames={}
for f in boat['frames']:
    rect=f['sourceRects']['base'];art=atlas.crop((rect['x'],rect['y'],rect['x']+rect['width'],rect['y']+rect['height']))
    scale=SX*boat['frame']['widthInMap']/boat['frame']['width'];art=art.resize((round(art.width*scale),round(art.height*scale)),Image.Resampling.LANCZOS)
    ys,xs=np.where(np.asarray(art.getchannel('A'))>32)
    frames[f['index']]={'x':xs,'y':ys,'foot':{key:value*scale for key,value in f['passengerFootPixels'].items()},'image':art,'angle':f['screenHeadingRadians']}
def angle_delta(a,b):return abs((a-b+math.pi)%(2*math.pi)-math.pi)
checks=[];collisions=[];dock_contacts=[];headings=[]
for segment,(a,b) in enumerate(zip(route,route[1:])):
    dx=(b['x']-a['x'])*SX;dy=(b['y']-a['y'])*SY;n=max(2,math.ceil(math.hypot(dx,dy)/3))
    heading=0 if segment==0 else 2 if segment==len(route)-2 else min(frames,key=lambda k:angle_delta(frames[k]['angle'],math.atan2(dy,dx)))
    headings.append(heading)
    for i in range(n+1):
        t=i/n;x=a['x']+(b['x']-a['x'])*t;y=a['y']+(b['y']-a['y'])*t;frame=frames[heading]
        xx=frame['x']+round(OX+x*SX-frame['foot']['x']);yy=frame['y']+round(OY+y*SY-frame['foot']['y'])
        count=int(np.count_nonzero(land_mask[yy,xx]));dock_count=int(np.count_nonzero(dock_mask[yy,xx]));clearance=float(np.min(distance[yy,xx]))
        check={'segment':segment,'t':round(t,5),'heading':heading,'passenger':{'x':round(x,6),'y':round(y,6)},'minimumLandClearanceNativePixels':math.floor(clearance*2),'landOverlapHalfNativePixels':count,'dockOverlapHalfNativePixels':dock_count};checks.append(check)
        if count:collisions.append(check)
        if count:
            hit=land_mask[yy,xx];check['collisionBoundsNativeAtlas']={'left':round((int(xx[hit].min())-OX)/SX,6),'right':round((int(xx[hit].max())-OX)/SX,6),'top':round((int(yy[hit].min())-OY)/SY,6),'bottom':round((int(yy[hit].max())-OY)/SY,6)}
        if dock_count:dock_contacts.append(check)
forward_checks=list(checks)
for item in forward_checks:
    heading=(item['heading']+4)%8;frame=frames[heading];p=item['passenger']
    xx=frame['x']+round(OX+p['x']*SX-frame['foot']['x']);yy=frame['y']+round(OY+p['y']*SY-frame['foot']['y'])
    count=int(np.count_nonzero(land_mask[yy,xx]));dock_count=int(np.count_nonzero(dock_mask[yy,xx]))
    check={**item,'heading':heading,'direction':'return','minimumLandClearanceNativePixels':math.floor(float(np.min(distance[yy,xx]))*2),'landOverlapHalfNativePixels':count,'dockOverlapHalfNativePixels':dock_count}
    check.pop('collisionBoundsNativeAtlas',None);checks.append(check)
    if count:collisions.append(check)
    if dock_count:dock_contacts.append(check)
draw=ImageDraw.Draw(preview)
points=[(OX+p['x']*SX,OY+p['y']*SY) for p in route];draw.line(points,fill='#fff0a2',width=3)
for x,y in points:draw.ellipse((x-4,y-4,x+4,y+4),fill='#fff0a2')
for sample in [forward_checks[0],forward_checks[len(forward_checks)//2],forward_checks[-1]]:
    f=frames[sample['heading']];p=sample['passenger'];preview.alpha_composite(f['image'],(round(OX+p['x']*SX-f['foot']['x']),round(OY+p['y']*SY-f['foot']['y'])))
preview.crop((60,80,2130,860)).resize((1656,624)).convert('RGB').save('/tmp/feka-journey/sea-route-review.jpg',quality=94)
open_water=[c for c in checks if c['segment'] not in [0,1,len(route)-3,len(route)-2]]
nonterminal_collisions=[c for c in collisions if c['segment'] not in [0,1,len(route)-3,len(route)-2]]
turn_minimum=10**9;turn_collisions=0
for item in open_water:
    p=item['passenger']
    for frame in frames.values():
        xx=frame['x']+round(OX+p['x']*SX-frame['foot']['x']);yy=frame['y']+round(OY+p['y']*SY-frame['foot']['y'])
        turn_minimum=min(turn_minimum,math.floor(float(np.min(distance[yy,xx]))*2));turn_collisions+=int(np.any((land_mask|dock_mask)[yy,xx]))
report={'placements':placements,'sailRoute':route,'method':'Sweep the real packaged base alpha footprint (hull, cabin, mast, rails and fenders, alpha>32) in both sailing directions every ≤3 half-native raster pixels (≤6 canonical pixels). Also test all8headings along open-water legs. Original dock objects are identified by a Blender camera-holdout mask. Two terminal manoeuvre legs at each end permit the intended projected overlap at the authored berths; this is reported explicitly, not called zero clearance. Costa cabin/mast project over the beach behind the physically offshore hull. At Costa the full boat beam is at least0.37world units south of the old dock; at Porto it is at least0.22world units west of the arrival deck. New gangways intentionally bridge these gaps. Open-water legs require zero silhouette intersection. Distances are isotropic raster Euclidean distances, rounded down in native1920px island units.','sampleCount':len(checks),'minimumLandClearanceNativePixels':min(c['minimumLandClearanceNativePixels'] for c in checks),'minimumOpenWaterClearanceNativePixels':min(c['minimumLandClearanceNativePixels'] for c in open_water),'allHeadingOpenWaterClearanceNativePixels':turn_minimum,'allHeadingOpenWaterCollisionCount':turn_collisions,'nonterminalSilhouetteOverlapCount':len(nonterminal_collisions),'terminalProjectionOverlapCount':len(collisions)-len(nonterminal_collisions),'landSilhouetteContacts':collisions,'dockContactCount':len(dock_contacts),'dockContacts':dock_contacts,'checks':checks}
(ROOT/'docs/world/diorama/coast-port-sail-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['checks','landSilhouetteContacts','dockContacts','method']},indent=2))
assert not nonterminal_collisions and not turn_collisions, 'Boat artwork overlaps an island outside the two terminal manoeuvre legs; inspect audit before export'
assert all(c['segment'] in [0,1,len(route)-3,len(route)-2] for c in dock_contacts), 'Boat touches a boarding structure outside terminal approach/departure'
meta['placements']=placements;meta['sailRoute']={'points':route,'durationSeconds':6,'coordinateSystem':'atlas','segmentHeadings':headings,'reverseSegmentHeadings':[(h+4)%8 for h in reversed(headings)]}
meta['sailAudit']={key:report[key] for key in ['sampleCount','minimumLandClearanceNativePixels','minimumOpenWaterClearanceNativePixels','allHeadingOpenWaterClearanceNativePixels','nonterminalSilhouetteOverlapCount','terminalProjectionOverlapCount','dockContactCount','method']}
meta['sources']=list(dict.fromkeys(meta['sources']+['tools/diorama/check_journey_projection.py','tools/diorama/render_journey_dock_masks.py','tools/diorama/author_journey_sail.py']))
path.write_text(json.dumps(meta,indent=2)+'\n')
