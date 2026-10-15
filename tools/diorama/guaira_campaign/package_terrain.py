"""Package revision 2 beauty/depth and assert every navigation/flight anchor."""
import json,hashlib,shutil
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/terrain-polish-2026-10-15'
OUT=ROOT/'public/assets/world/map/guaira-campaign';DOC=ROOT/'docs/world/guaira/terrain-polish-2026-10-15'
nav=json.loads((WORK/'navigation.json').read_text());old=json.loads((ROOT/'docs/world/guaira/native-map-2026-10-13/navigation.json').read_text())
assert {k:v for k,v in nav.items() if k not in ('source','revision')}=={k:v for k,v in old.items() if k not in ('source','revision')},'Navigation contract moved'
w,h=nav['depth']['width'],nav['depth']['height'];image=Image.open(WORK/'guaira.png').convert('RGBA')
assert image.size==(w,h)==(1920,1200)
image.save(OUT/'guaira.webp',quality=92,method=6,exact=True)
d=np.frombuffer((WORK/'depth.u16').read_bytes(),dtype='<u2').reshape(h,w)
rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[:,:,0]=d>>8;rgba[:,:,1]=d&255;rgba[:,:,3]=255
Image.fromarray(rgba).save(OUT/'guaira-depth.png',optimize=True)
meta=json.loads((OUT/'guaira.meta.json').read_text());bounds=image.getchannel('A').getbbox()
meta['artBounds']={k:v/size for k,v,size in zip(['left','top','right','bottom'],bounds,[w,h,w,h])}
meta['image']['bytes']=(OUT/'guaira.webp').stat().st_size;meta['nativeMapRevision']=2;meta['terrainRevision']=2
meta['supportFootprint']['terrainMode']='continuous-island-and-landing-ground'
(OUT/'guaira.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
(OUT/'guaira-navigation.json').write_text(json.dumps(nav,indent=2)+'\n')
shutil.copyfile(WORK/'navigation.json',DOC/'navigation.json')
files={f:{'bytes':(OUT/f).stat().st_size,'sha256':hashlib.sha256((OUT/f).read_bytes()).hexdigest()}
       for f in ['guaira.webp','guaira-depth.png','guaira-navigation.json','guaira-water-restored.webp']}
(DOC/'asset-manifest.json').write_text(json.dumps({'revision':2,'files':files,'source':'guaira-terrain.blend',
 'renderer':'Blender 5.2.1 LTS, Cycles CPU, 64 samples, paired beauty + linear depth',
 'navigationChanged':False,'flightAnchorsChanged':False,
 'sourceSHA256':hashlib.sha256((DOC/'guaira-terrain.blend').read_bytes()).hexdigest()},indent=2)+'\n')
print('TERRAIN_PACKAGED',files,flush=True)
