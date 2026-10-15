"""Package revision 4 beauty, measured navigation and paired depth atomically."""
import json,hashlib,shutil,io
from pathlib import Path
from PIL import Image
import numpy as np
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/phase-landmarks-2026-10-15'
OUT=ROOT/'public/assets/world/map/guaira-campaign';DOC=ROOT/'docs/world/guaira/phase-landmarks-2026-10-15'
nav=json.loads((WORK/'navigation.json').read_text(encoding='utf-8'));integrity=json.loads((WORK/'landmark-integrity.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert integrity['sourceSHA256']==sha(DOC/'guaira-landmarks.blend')
assert integrity['cameraUnchanged'] and integrity['unaffectedEntrancesUnchanged'] and integrity['waterMeshesUnchanged']
assert not integrity['channelObstructions'] and not integrity['unsupported']
assert all(Polygon([p[:2] for p in ring]).is_valid for ring in integrity['coastRings'])
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in integrity['meshes'])
def save_image(image,filename,format,**options):
    encoded=io.BytesIO();image.save(encoded,format=format,**options)
    pending=OUT/(filename+'.pending');pending.write_bytes(encoded.getvalue());pending.replace(OUT/filename)
w,h=nav['depth']['width'],nav['depth']['height'];image=Image.open(WORK/'guaira.png').convert('RGBA')
assert image.size==(w,h)==(1920,1200)
save_image(image,'guaira.webp','WEBP',quality=92,method=6,exact=True)
d=np.frombuffer((WORK/'depth.u16').read_bytes(),dtype='<u2').reshape(h,w)
rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[:,:,0]=d>>8;rgba[:,:,1]=d&255;rgba[:,:,3]=255
save_image(Image.fromarray(rgba),'guaira-depth.png','PNG',optimize=True)
meta=json.loads((OUT/'guaira.meta.json').read_text());bounds=image.getchannel('A').getbbox()
meta['artBounds']={k:v/size for k,v,size in zip(['left','top','right','bottom'],bounds,[w,h,w,h])}
meta['image']['bytes']=(OUT/'guaira.webp').stat().st_size;meta['nativeMapRevision']=4;meta['terrainRevision']=4
(OUT/'guaira.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
(OUT/'guaira-navigation.json').write_text(json.dumps(nav,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
shutil.copyfile(WORK/'navigation.json',DOC/'navigation.json')
files={f:{'bytes':(OUT/f).stat().st_size,'sha256':sha(OUT/f)} for f in ['guaira.webp','guaira-depth.png','guaira-navigation.json','guaira-water-restored.webp']}
(DOC/'asset-manifest.json').write_text(json.dumps({'revision':4,'files':files,'source':'guaira-landmarks.blend',
 'renderer':'Blender 5.2.1 LTS, Cycles CPU, 64 samples, paired beauty + linear depth',
 'navigationChanged':'Ossabravo arrival moved to its own corral branch; main street keeps access to the ascent.',
 'flightAnchorsChanged':False,'terrainTopChanged':'Only the compacted corral court and its feathered edge.',
 'phaseLandmarks':len(nav['landmarks']),'sourceSHA256':sha(DOC/'guaira-landmarks.blend')},indent=2)+'\n')
print('LANDMARKS_PACKAGED',files,flush=True)
