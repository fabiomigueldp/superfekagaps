"""Package verified Blender journey renders into compact runtime WebP assets.

Run after render_journey_boat.py and both render_journey_docks.py --render
commands. Temporary PNGs/Blender caches stay under /tmp/feka-journey; only the
WebP atlas, small overlays and measured JSON contracts ship with the game.
"""
from pathlib import Path
import json, hashlib, sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
TEMP=Path('/tmp/feka-journey')
OUT=ROOT/'public/assets/world/map'
DOC=ROOT/'docs/world/diorama'
boat=json.loads((TEMP/'boat/boat.meta.json').read_text())
assert len(boat['frames'])==8, 'Render all eight final headings first'
w,h=boat['frame']['width'],boat['frame']['height']
atlas=Image.new('RGBA',(w*4,h*4))
for frame in boat['frames']:
    index=frame['index'];frame['sourceRects']={}
    for layer,row_offset in [('base',0),('foreground',2)]:
        image=Image.open(TEMP/f'boat/heading-{index}-{layer}.png').convert('RGBA')
        assert image.size==(w,h)
        x=(index%4)*w;y=(index//4+row_offset)*h
        atlas.alpha_composite(image,(x,y))
        frame['sourceRects'][layer]={'x':x,'y':y,'width':w,'height':h}
    frame['passengerFootPixels']={key:round(value*(w if key=='x' else h),4) for key,value in frame['passengerFoot'].items()}
    frame['waterlineAnchorPixels']={key:round(value*(w if key=='x' else h),4) for key,value in frame['waterlineAnchor'].items()}
    frame['widthInMap']=round(boat['orthoScale']/20.6,9)
atlas_path=OUT/'journey-boat.webp'
atlas.save(atlas_path,'WEBP',quality=92,method=6,alpha_quality=100)
check=Image.open(atlas_path)
assert check.size==atlas.size and check.mode=='RGBA'
boat['atlas']={'path':'/assets/world/map/journey-boat.webp','width':atlas.width,'height':atlas.height,'bytes':atlas_path.stat().st_size,'sha256':hashlib.sha256(atlas_path.read_bytes()).hexdigest()}
boat['frame']['widthInMap']=round(boat['orthoScale']/20.6,9)
boat['passengerPixelScale']=3
(OUT/'journey-boat.meta.json').write_text(json.dumps(boat,indent=2)+'\n')
if '--boat-only' in sys.argv:
    print(json.dumps({'boatAtlasBytes':atlas_path.stat().st_size,'boatMetadata':'public/assets/world/map/journey-boat.meta.json'}))
    sys.exit(0)
islands={}
for island in ['costa','porto']:
    full=json.loads((TEMP/f'{island}/dock.meta.json').read_text())
    assert all(a['issueCount']==0 for a in full['audit'].values()), f'{island} new route audit failed'
    assert full['projectedClearance']['upperBodyConflictCount']==0, f'{island} projected actor clearance failed'
    assert full['projectedClearance']['lowerBodyContactCount']==0, f'{island} projected lower-body clearance failed'
    assert full['existingFieldsUnchanged']
    if 'existingRouteAuditDelta' in full:assert full['existingRouteAuditDelta']['newIssueCount']==0
    image=Image.open(TEMP/f'{island}/dock-overlay.png').convert('RGBA')
    bbox=image.getbbox();assert bbox
    crop=image.crop(bbox);path=OUT/f'{island}-journey-dock.webp'
    crop.save(path,'WEBP',quality=93,method=6,alpha_quality=100)
    full['overlay']={'path':f'/assets/world/map/{island}-journey-dock.webp','width':crop.width,'height':crop.height,'left':round(bbox[0]/1920,9),'top':round((bbox[1]-120)/1200,9),'widthInMap':round(crop.width/1920,9),'heightInMap':round(crop.height/1200,9),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    # Keep detailed diagnostic rays with source documentation, not runtime.
    (DOC/f'{island}-journey-dock-audit.json').write_text(json.dumps(full,indent=2)+'\n')
    full.pop('existingRouteAudit',None)
    for audit in full['audit'].values():audit.pop('supportObjects',None)
    islands[island]=full
contract={'version':1,'coordinateSystem':'All points and overlay bounds are normalized local coordinates of the unchanged island 1920x1200 frames. The world renderer applies its own stable island transforms. Boat source rectangles use atlas pixels.','boatMetadata':'/assets/world/map/journey-boat.meta.json','islands':islands,'sources':['tools/diorama/render_journey_docks.py','tools/diorama/render_journey_boat.py','tools/diorama/package_journey_assets.py']}
(OUT/'coast-port-journey.meta.json').write_text(json.dumps(contract,indent=2)+'\n')
print(json.dumps({'boatAtlasBytes':atlas_path.stat().st_size,'docks':{key:value['overlay'] for key,value in islands.items()}},indent=2))
