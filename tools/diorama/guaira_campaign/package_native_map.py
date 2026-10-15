"""Package the paired native-map render, never an unrelated/stale depth pass."""
import json, hashlib, shutil
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'output/guaira/native-map-2026-10-13';OUT=ROOT/'public/assets/world/map/guaira-campaign'
DOC=ROOT/'docs/world/guaira/native-map-2026-10-13'
n=json.loads((WORK/'navigation.json').read_text());w,h=n['depth']['width'],n['depth']['height']
image=Image.open(WORK/'guaira.png').convert('RGBA');assert image.size==(w,h)==(1920,1200)
image.save(OUT/'guaira.webp',quality=91,method=6,exact=True)
d=np.frombuffer((WORK/'depth.u16').read_bytes(),dtype='<u2').reshape(h,w)
rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[:,:,0]=d>>8;rgba[:,:,1]=d&255;rgba[:,:,3]=255
Image.fromarray(rgba).save(OUT/'guaira-depth.png',optimize=True)
(OUT/'guaira-navigation.json').write_text(json.dumps(n,indent=2)+'\n')
meta=json.loads((OUT/'guaira.meta.json').read_text())
# Preserve aircraft/camera and old local nodes: transports rely on this contract.
bounds=image.getchannel('A').getbbox();meta['artBounds']={k:v/size for k,v,size in zip(['left','top','right','bottom'],bounds,[w,h,w,h])}
meta['image']['bytes']=(OUT/'guaira.webp').stat().st_size
meta['nativeMapRevision']=1;meta['nativeNavigation']='guaira-navigation.json';meta['nativeDepth']='guaira-depth.png'
(OUT/'guaira.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
shutil.copyfile(WORK/'navigation.json',DOC/'navigation.json')
files={f:{'bytes':(OUT/f).stat().st_size,'sha256':hashlib.sha256((OUT/f).read_bytes()).hexdigest()}
       for f in ['guaira.webp','guaira-depth.png','guaira-navigation.json']}
(DOC/'asset-manifest.json').write_text(json.dumps({'revision':1,'files':files,'source':'guaira-native.blend','renderer':'Blender 5.2.1 LTS, Cycles CPU, 48 samples, paired beauty + linear depth'},indent=2)+'\n')
print('PACKAGED',files)
