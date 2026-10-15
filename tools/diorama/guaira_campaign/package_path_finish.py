"""Publish revision 6 local game assets from the verified, saved Blender source."""
import json,hashlib,shutil,io
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/path-finish-2026-10-15'
OUT=ROOT/'public/assets/world/map/guaira-campaign';DOC=ROOT/'docs/world/guaira/path-finish-2026-10-15'
nav=json.loads((WORK/'navigation.json').read_text(encoding='utf-8'));audit=json.loads((WORK/'path-integrity.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert audit['sourceSHA256']==sha(DOC/'guaira-paths.blend')
assert audit['navigationUnchanged'] and audit['landmarkPositionsUnchanged'] and audit['cameraUnchanged'] and audit['waterMeshesUnchanged'] and audit['terrainMaximumChange']==0
assert not audit['channelObstructions'] and not audit['unsupportedBases'] and not audit['unsupportedChannel']
assert all(c['depth']>.10 and abs(c['measuredFloor']-c['floorZ'])<.01 for c in audit['cavities'])
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in audit['meshes'])
def save(image,name,format,**options):
    encoded=io.BytesIO();image.save(encoded,format=format,**options);p=OUT/(name+'.pending');p.write_bytes(encoded.getvalue());p.replace(OUT/name)
w,h=nav['depth']['width'],nav['depth']['height'];image=Image.open(WORK/'guaira.png').convert('RGBA');assert image.size==(w,h)==(1920,1200)
save(image,'guaira.webp','WEBP',quality=92,method=6,exact=True)
depth=np.frombuffer((WORK/'depth.u16').read_bytes(),dtype='<u2').reshape(h,w);rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[:,:,0]=depth>>8;rgba[:,:,1]=depth&255;rgba[:,:,3]=255
save(Image.fromarray(rgba),'guaira-depth.png','PNG',optimize=True)
meta=json.loads((OUT/'guaira.meta.json').read_text());bounds=image.getchannel('A').getbbox()
meta['artBounds']={k:v/size for k,v,size in zip(['left','top','right','bottom'],bounds,[w,h,w,h])};meta['image']['bytes']=(OUT/'guaira.webp').stat().st_size;meta['nativeMapRevision']=6
(OUT/'guaira.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
(OUT/'guaira-navigation.json').write_text(json.dumps(nav,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');shutil.copyfile(WORK/'navigation.json',DOC/'navigation.json')
files={f:{'bytes':(OUT/f).stat().st_size,'sha256':sha(OUT/f)} for f in ['guaira.webp','guaira-depth.png','guaira-navigation.json','guaira-water-restored.webp']}
(DOC/'asset-manifest.json').write_text(json.dumps({'revision':6,'files':files,'source':'guaira-paths.blend','sourceSHA256':sha(DOC/'guaira-paths.blend'),
    'renderer':'Blender 5.2.1 LTS, Cycles CPU, 64 samples, paired beauty + linear depth','navigationChanged':False,'phaseLocationsChanged':False,'flightAnchorsChanged':False,'terrainChanged':False,
    'pavingChange':'Continuous fitted curb stones, founded bridge heads, connected bearers and sloped bridge approaches.'},indent=2)+'\n')
print('PATH_ASSETS_PACKAGED',files,flush=True)
