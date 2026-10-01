from pathlib import Path
from PIL import Image
import json,math,hashlib,os,sys,shutil
R=Path(__file__).resolve().parents[2];O=Path(os.environ.get('FEKA_FACTORY_SERRA_OUT','/tmp/feka-factory-serra-link'));E=O/'final';m=json.load(open(O/'factory-serra-open.meta.json'));frame=json.load(open(E/'overlay-frame.json'));assert frame['size']==[1920,1080] and frame['samples']==96
assert all(m['sourcePreservation'].values()),'An original source object or route changed'
structure=json.load(open(O/'audit-structure.json'));assert structure['unrootedCount']==0 and structure['missingBearingCount']==0 and structure['booleanModifierCount']==0
for state in ['open','closed']:
 a=json.load(open(O/f'audit-{state}.json'));rr=json.load(open(O/f'audit-{state}-raster.json'));assert a['sourceBlendSha256']==hashlib.sha256((O/f'factory-serra-{state}.blend').read_bytes()).hexdigest(),'Audit does not match the freshly authored scene'
 assert a['unsupportedCount']==0 and not a['existingFactoryNewObjectContactsByObject']
 assert all(not p['existingFactoryBodyContactsByObject'] for p in rr['profiles'])
 if state=='open':assert a['headroomCount']==0 and not a['bodyContactsByObject'] and all(not p['bodyContactsByObject'] for p in rr['profiles'])
 else:
  assert a['headroomCount']>0 and all('retracting equipment' in k or 'gate dark hazard stripe' in k for k in a['bodyContactsByObject'])
  assert all('retracting equipment' in item['object'] or 'gate dark hazard stripe' in item['object'] for item in a['headroomIssues'])
images={st:Image.open(E/f'factory-serra-{st}-layer-full.png').convert('RGBA') for st in ['open','closed']};box=None
for im in images.values():
 assert im.size==(1920,1080);b=im.getchannel('A').getbbox();assert b;box=b if box is None else (min(box[0],b[0]),min(box[1],b[1]),max(box[2],b[2]),max(box[3],b[3]))
box=(max(0,box[0]-4),max(0,box[1]-4),min(1920,box[2]+4),min(1080,box[3]+4));overlays={}
for state,im in images.items():
 crop=im.crop(box);p=E/f'factory-serra-link-{state}.webp';crop.save(p,'WEBP',quality=94,method=6,alpha_quality=100);check=Image.open(p).convert('RGBA');assert check.size==crop.size;assert check.getchannel('A').tobytes()==crop.getchannel('A').tobytes()
 crop.save(E/f'factory-serra-link-{state}.png');overlays[state]={'path':'/assets/world/map/'+p.name,'width':crop.width,'height':crop.height,'left':round(frame['left']+box[0]/1920,9),'top':round(frame['top']+box[1]/1200,9),'widthInMap':round(crop.width/1920,9),'heightInMap':round(crop.height/1200,9),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
placements={'fabrica':m['placements']['3'],'serra':m['placements']['4']};p=m['pathAtlas'];fm=json.load(open(O/'factory-source.meta.json'));sm=json.load(open(O/'serra-source.meta.json'))
def local(q,origin):return {'x':round(q['x']-origin['x'],7),'y':round(q['y']-origin['y'],7)}
islands={}
for name,node,world,points,source in [('fabrica','3-5',3,p[:4],fm),('serra','4-1',4,list(reversed(p[4:])),sm)]:
 org=placements[name]['origin'];route=[local(q,org) for q in points];join={'x':source['nodes'][node]['x'],'y':source['nodes'][node]['y'],'node':node};route[0]={k:join[k] for k in ['x','y']};b=m['approachBounds']['factory' if name=='fabrica' else 'serra'].copy();rad=source['nodes'][node]['clearingRadius'];c=source['camera'];v=[x-y for x,y in zip(c['position'],c['target'])];tilt=abs(v[2])/math.sqrt(sum(x*x for x in v));dx=rad/20.6+.004;dy=rad*tilt/12.875+.004
 b={'left':round(min(b['left'],join['x']-dx),7),'top':round(min(b['top'],join['y']-dy),7),'right':round(max(b['right'],join['x']+dx),7),'bottom':round(max(b['bottom'],join['y']+dy),7)}
 islands[name]={'version':1,'island':name,'world':world,'size':{'width':1920,'height':1200},'join':join,'landing':route[-1],'approachDurationSeconds':2.7052 if name=='fabrica' else .7225,'junctionToLanding':route,'approachBounds':b}
 assert all(b['left']<=q['x']<=b['right'] and b['top']<=q['y']<=b['bottom'] for q in route)
contract={'version':1,'connection':'factory-serra-link','placements':placements,'islands':islands,'walkRoute':{'coordinateSystem':'atlas','points':p[3:5],'durationSeconds':6.2398},'overlays':overlays,'unlock':{'stage':'3-5','stateBefore':'closed','stateAfter':'open'},'source':'docs/world/campanha.md:115: after C1 the equipment blocking the Serra exit stops. Permanent supported walkway; side-retracting inspection stop. Original Factory source camera, all five nodes, paths and objects preserved. Serra entry/camera approved at placement (2.78,-0.65), scale1.'}
for name,index in [('fabrica',0),('serra',1)]:
 q=islands[name]['landing'];org=placements[name]['origin'];atlas=contract['walkRoute']['points'][index];assert abs(q['x']+org['x']-atlas['x'])<1e-6 and abs(q['y']+org['y']-atlas['y'])<1e-6
(E/'factory-serra-link.meta.json').write_text(json.dumps(contract,indent=2)+'\n')
assets=[E/n for n in ['factory-serra-link.meta.json','factory-serra-link-open.webp','factory-serra-link-closed.webp']]
manifest={'status':'source-rebuild-awaiting-visual-package-review','render':{'pixelsPerAtlasX':1920,'pixelsPerAtlasY':1200,'samples':96,'resizedFromPrototype':False,'commonCrop':box},'sourceCodeHashes':m['sources'],'geometry':{'factoryFootZ':2.37,'serraFootZ':1.65,'deckOffsetZ':-.004,'spanLength':m['spanLength'],'slopeDegrees':m['spanSlopeDegrees'],'walkingWidths':[.94,1.92,1.4],'booleanModifiers':0},'assets':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in assets},'totalRuntimeBytes':sum(p.stat().st_size for p in assets),'qa':{'idealSource':'audit-open.json and audit-closed.json','actualRoundedRaster':'audit-open-raster.json and audit-closed-raster.json','structure':'audit-structure.json','runtimeFitting':'pending integrated graph, label, transition and real fitted zoom QA'}}
(E/'factory-serra-link-art-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'overlays':overlays,'islands':islands,'totalRuntimeBytes':manifest['totalRuntimeBytes']},indent=2))

# Packaging does not install by default. Installation is a separate, explicit step
# after reviewing both final rendered states; only this link's three assets copy.
if '--install-assets' in sys.argv:
 destination=R/'public/assets/world/map'
 for asset in assets:
  shutil.copy2(asset,destination/asset.name)
  assert hashlib.sha256((destination/asset.name).read_bytes()).hexdigest()==manifest['assets'][asset.name]['sha256']
 print('INSTALLED_FACTORY_SERRA_LINK='+json.dumps([p.name for p in assets]))
