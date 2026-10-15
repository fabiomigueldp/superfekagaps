"""Package revision 3 beauty/depth from the final saved Blender scene."""
import json,hashlib,shutil,io
from pathlib import Path
from PIL import Image
import numpy as np
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/landscape-finish-2026-10-15'
OUT=ROOT/'public/assets/world/map/guaira-campaign';DOC=ROOT/'docs/world/guaira/landscape-finish-2026-10-15'
nav=json.loads((WORK/'navigation.json').read_text());old=json.loads((ROOT/'docs/world/guaira/terrain-polish-2026-10-15/navigation.json').read_text())
assert {k:v for k,v in nav.items() if k not in ('source','revision')}=={k:v for k,v in old.items() if k not in ('source','revision')},'Navigation contract moved'
integrity=json.loads((WORK/'landscape-integrity.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert integrity['sourceSHA256']==sha(DOC/'guaira-landscape.blend')
assert not integrity['channelObstructions'] and not integrity['unsupported']
assert all(Polygon([p[:2] for p in ring]).is_valid for ring in integrity['coastRings']), 'Coast contour folds over itself'
assert all(a[2]>b[2] for upper,lower in zip(integrity['coastRings'],integrity['coastRings'][1:]) for a,b in zip(upper,lower)), 'Crossed strata'
assert all(r['components']==1 and not r['nonManifoldEdges'] and not r['degenerateFaces'] and r['volume']>0 for r in integrity['meshes'])
def save_image(image, filename, format, **options):
    # Encode before replacing: a live dev server must never read a partially
    # truncated image, and Windows readers may still hold the previous file.
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
meta['image']['bytes']=(OUT/'guaira.webp').stat().st_size;meta['nativeMapRevision']=3;meta['terrainRevision']=3
meta['supportFootprint']['terrainMode']='continuous-island-and-landing-ground'
(OUT/'guaira.meta.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
(OUT/'guaira-navigation.json').write_text(json.dumps(nav,indent=2)+'\n')
shutil.copyfile(WORK/'navigation.json',DOC/'navigation.json')
files={f:{'bytes':(OUT/f).stat().st_size,'sha256':sha(OUT/f)} for f in ['guaira.webp','guaira-depth.png','guaira-navigation.json','guaira-water-restored.webp']}
(DOC/'asset-manifest.json').write_text(json.dumps({'revision':3,'files':files,'source':'guaira-landscape.blend',
 'renderer':'Blender 5.2.1 LTS, Cycles CPU, 64 samples, paired beauty + linear depth',
 'navigationChanged':False,'flightAnchorsChanged':False,'terrainTopChanged':False,
 'sourceSHA256':sha(DOC/'guaira-landscape.blend')},indent=2)+'\n')
print('LANDSCAPE_PACKAGED',files,flush=True)
