"""Package the audited local prototype into the agreed integration contract."""
from pathlib import Path
import json,hashlib,copy,os,sys,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('FEKA_BRIDGE_OUT','/tmp/feka-port-factory-bridge'));EXPORT=OUT/'export'
meta=json.loads((OUT/'cargo-bridge.meta.json').read_text());billboard=json.loads((OUT/'bridge-states-billboard-audit.json').read_text())
assert meta['audits']['physicalIssueCount']==0 and meta['audits']['projectedContactCount']==0
for kind in ['loweredCrossing','raisedOriginalPortRoutesNewBridgeContacts']:
    assert billboard[kind]['upperBodyContactCount']==0 and billboard[kind]['lowerBodyContactCount']==0
overlays={}
for state in ['open','closed']:
    full=Image.open(EXPORT/f'port-factory-bridge-{state}.png').convert('RGBA');assert full.size==(4032,1488)
    bbox=full.getbbox();assert bbox
    crop=full.crop(bbox);path=EXPORT/f'port-factory-bridge-{state}.webp';crop.save(path,'WEBP',quality=93,method=6,alpha_quality=100)
    assert Image.open(path).size==crop.size
    overlays[state]={'path':'/assets/world/map/'+path.name,'width':crop.width,'height':crop.height,'left':round(1.01+bbox[0]/1920,9),'top':round(-.22+bbox[1]/1200,9),'widthInMap':round(crop.width/1920,9),'heightInMap':round(crop.height/1200,9),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
approach_bounds=json.loads((EXPORT/'open-approach-bounds.json').read_text())
def local(p,origin):return {'x':round(p['x']-origin[0],6),'y':round(p['y']-origin[1],6)}
path=meta['pathAtlas'];port_approach=[local(p,(1.1,-.12)) for p in path[:2]];factory_approach=[local(p,(1.98,.03)) for p in reversed(path[2:])]
islands={
    'porto':{'version':1,'island':'porto','size':{'width':1920,'height':1200},'join':{**port_approach[0],'route':'3:4','from':'2-4','to':'2-5','segment':0,'t':.5},'landing':port_approach[-1],'junctionToLanding':port_approach,'approachBounds':approach_bounds['porto']},
    'fabrica':{'version':1,'island':'fabrica','size':{'width':1920,'height':1200},'join':{**factory_approach[0],'node':'3-1'},'landing':factory_approach[-1],'junctionToLanding':factory_approach,'approachBounds':approach_bounds['fabrica']}}
for name,island in islands.items():
    b=island['approachBounds']
    for p in island['junctionToLanding']:
        assert b['left']<=p['x']<=b['right'] and b['top']<=p['y']<=b['bottom'],(name,p,b)
contract={'version':1,'connection':'port-factory-bridge','placements':{k:meta['placements'][k] for k in ['porto','fabrica']},'islands':islands,'bridgeRoute':{'coordinateSystem':'atlas','points':path[1:3],'durationSeconds':3.2},'overlays':overlays,'source':'Original lowered cargo-bridge transition in docs/world/campanha.md:66. Local prototype authored in Blender; existing phase nodes/routes and Costa↔Porto placements preserved.'}
(EXPORT/'port-factory-bridge.meta.json').write_text(json.dumps(contract,indent=2)+'\n')
factory_image=Image.open(EXPORT/'fabrica-diorama.png').convert('RGBA');assert factory_image.size==(1920,1200)
factory_path=EXPORT/'fabrica-diorama.webp';factory_image.save(factory_path,'WEBP',quality=91,method=6,alpha_quality=100)
factory_meta=json.loads((ROOT/'public/assets/world/map/fabrica-diorama.meta.json').read_text())
b=factory_image.getbbox();factory_meta['artBounds']={'left':round(b[0]/1920,6),'top':round(b[1]/1200,6),'right':round(b[2]/1920,6),'bottom':round(b[3]/1200,6)}
(EXPORT/'fabrica-diorama.meta.json').write_text(json.dumps(factory_meta,indent=2)+'\n')
original=json.loads((ROOT/'public/assets/world/map/fabrica-diorama.meta.json').read_text())
assert all(original[k]==factory_meta[k] for k in ['nodes','routes','worldRoutes','secretRoute','camera','size'])
manifest={'sourceCommit':'eab1a34addb278a898e95a1c9e77bcd8b2de68e6','existingCameraNodesAndRoutesUnchanged':True,'factoryOnlyLocalArtAdjustment':'Move coastal scrub.001 0.38world units west to clear new receiving approach. No phase surface or stage prop changed.','bridgePhysicalAudit':meta['audits'],'bridgeBillboardAudit':{k:{kk:vv for kk,vv in billboard[k].items() if not isinstance(vv,list)} for k in ['loweredCrossing','raisedOriginalPortRoutesNewBridgeContacts']},'movingSpan':meta['movingSpan'],'assets':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [factory_path,EXPORT/'fabrica-diorama.meta.json',EXPORT/'port-factory-bridge.meta.json',EXPORT/'port-factory-bridge-open.webp',EXPORT/'port-factory-bridge-closed.webp']}}
manifest['totalRuntimeBytes']=sum(v['bytes'] for v in manifest['assets'].values())
(OUT/'bridge-art-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'totalRuntimeBytes':manifest['totalRuntimeBytes'],'overlays':overlays,'islands':islands},indent=2))

if '--install-assets' in sys.argv:
    target=ROOT/'public/assets/world/map'
    for name in manifest['assets']:shutil.copy2(EXPORT/name,target/name)
    docs=ROOT/'docs/world/diorama'
    for name in ['bridge-art-manifest.json','cargo-bridge.meta.json','bridge-states-billboard-audit.json']:
        shutil.copy2(OUT/name,docs/('port-factory-'+name))
